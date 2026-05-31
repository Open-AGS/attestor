import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceIntegrationKitPacketDescriptor,
  createActionSurfaceIntegrationKitPacket,
  createActionSurfaceOnboardingPacket,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function createRefundOpenApi(): string {
  return JSON.stringify({
    openapi: '3.1.0',
    info: {
      title: 'Refund API',
      version: '1.0.0',
    },
    paths: {
      '/refunds': {
        post: {
          operationId: 'issueRefund',
          description: 'raw_prompt_must_not_escape sk_live_must_not_escape',
          tags: ['refunds'],
          responses: {
            '200': {
              description: 'ok',
            },
          },
        },
      },
    },
  });
}

function testPacketBuildsMachineReadableReviewFiles(): void {
  const onboardingPacket = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-31T09:00:00.000Z',
    attestorBaseUrl: 'https://attestor.example.com',
    manifests: [
      {
        text: createRefundOpenApi(),
        sourceRef: 'openapi/refunds.json',
        downstreamSystem: 'refund-service',
        defaultDomain: 'money-movement',
        credentialPosture: 'agent-held-static-secret',
      },
    ],
  });
  const kit = createActionSurfaceIntegrationKitPacket({
    packet: onboardingPacket,
    generatedAt: '2026-05-31T09:01:00.000Z',
  });
  const text = JSON.stringify(kit);

  equal(kit.version, 'attestor.action-surface-integration-kit-packet.v1', 'Integration kit: version is explicit');
  equal(kit.status, 'review-required', 'Integration kit: discovered surfaces require review');
  equal(kit.sourcePacketDigest, onboardingPacket.digest, 'Integration kit: source packet digest is retained');
  equal(kit.summary.sourcePacketDigest, onboardingPacket.digest, 'Integration kit: summary binds source digest');
  equal(kit.summary.surfaceCount, 1, 'Integration kit: summary counts surfaces');
  equal(kit.summary.outputFiles.length, 5, 'Integration kit: five review files are planned');
  ok(kit.digest.startsWith('sha256:'), 'Integration kit: packet digest is generated');
  ok(kit.summary.digest.startsWith('sha256:'), 'Integration kit: summary digest is generated');
  ok(
    kit.artifactManifest.digest === kit.summary.artifactManifestDigest,
    'Integration kit: artifact manifest digest is linked from summary',
  );
  ok(
    kit.noBypassProbePlan.digest === kit.summary.noBypassProbePlanDigest,
    'Integration kit: no-bypass probe plan digest is linked from summary',
  );
  ok(
    kit.approvalRecordTemplate.digest === kit.summary.approvalRecordTemplateDigest,
    'Integration kit: approval template digest is linked from summary',
  );
  equal(kit.approvalRequired, true, 'Integration kit: approval is required');
  equal(kit.autoEnforce, false, 'Integration kit: auto enforce is false');
  equal(kit.rawPayloadStored, false, 'Integration kit: raw payload storage is false');
  equal(kit.productionReady, false, 'Integration kit: production readiness is false');
  equal(kit.executionPlanOnly, true, 'Integration kit: output is plan-only');
  equal(kit.deploysInfrastructure, false, 'Integration kit: no infrastructure deployment');
  equal(kit.issuesCredentials, false, 'Integration kit: no credential issuance');
  equal(kit.activatesEnforcement, false, 'Integration kit: no enforcement activation');
  equal(kit.nonBypassableClaimAllowed, false, 'Integration kit: no non-bypassable claim');
  ok(!text.includes('raw_prompt_must_not_escape'), 'Integration kit: raw OpenAPI description is not serialized');
  ok(!text.includes('sk_live_must_not_escape'), 'Integration kit: secret-like text is not serialized');
}

function testArtifactManifestAndProbePlanStayReviewOnly(): void {
  const onboardingPacket = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-31T09:05:00.000Z',
    attestorBaseUrl: 'https://attestor.example.com',
    manifests: [
      {
        text: createRefundOpenApi(),
        sourceRef: 'openapi/refunds.json',
        downstreamSystem: 'refund-service',
        defaultDomain: 'money-movement',
        credentialPosture: 'agent-held-static-secret',
      },
    ],
  });
  const kit = createActionSurfaceIntegrationKitPacket({ packet: onboardingPacket });
  const artifact = kit.artifactManifest.artifacts[0];
  const probeKinds = new Set(kit.noBypassProbePlan.probeCases.map((probe) => probe.kind));

  equal(kit.artifactManifest.artifactCount, onboardingPacket.artifactCount, 'Integration kit: artifact count matches source packet');
  equal(artifact?.requiredReview, true, 'Integration kit: artifact entry requires review');
  equal(artifact?.rawPayloadStored, false, 'Integration kit: artifact entry stores no raw payload');
  equal(artifact?.productionReady, false, 'Integration kit: artifact entry is not production-ready');
  equal(kit.noBypassProbePlan.probeCaseCount, 6, 'Integration kit: one surface has six no-bypass probe cases');
  ok(
    probeKinds.has('direct-downstream-without-attestor-presentation'),
    'Integration kit: direct downstream bypass probe is present',
  );
  ok(
    probeKinds.has('stale-or-replayed-presentation'),
    'Integration kit: stale/replay probe is present',
  );
  ok(
    probeKinds.has('narrow-decision-with-original-wide-request'),
    'Integration kit: narrow mismatch probe is present',
  );
  ok(
    probeKinds.has('review-or-block-reaches-downstream-execution'),
    'Integration kit: review/block downstream probe is present',
  );
  ok(
    probeKinds.has('verifier-unavailable-in-enforcement-mode'),
    'Integration kit: verifier outage probe is present',
  );
  ok(
    probeKinds.has('observe-mode-would-block-recorded-only'),
    'Integration kit: observe-mode would-block probe is present',
  );
  equal(kit.noBypassProbePlan.liveProofRegisterRef, 'LP-CUSTOMER-PEP-NO-BYPASS', 'Integration kit: live proof ref is explicit');
  equal(kit.noBypassProbePlan.proofResultRecorded, false, 'Integration kit: probe plan is not a result');
  equal(kit.approvalRecordTemplate.grantsAuthority, false, 'Integration kit: approval template does not grant authority');
  ok(
    kit.approvalRecordTemplate.decisionOptions.includes('hold'),
    'Integration kit: approval template supports hold',
  );
}

function testEmptyPacketDescriptorDocsAndPackageScript(): void {
  const onboardingPacket = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-31T09:10:00.000Z',
  });
  const kit = createActionSurfaceIntegrationKitPacket({ packet: onboardingPacket });
  const descriptor = actionSurfaceIntegrationKitPacketDescriptor();

  equal(kit.status, 'no-surfaces', 'Integration kit: empty source has no-surfaces status');
  equal(kit.summary.surfaceCount, 0, 'Integration kit: empty source has zero surfaces');
  equal(kit.noBypassProbePlan.probeCaseCount, 0, 'Integration kit: empty source has zero probes');
  equal(descriptor.executionPlanOnly, true, 'Integration kit descriptor: plan-only is explicit');
  equal(descriptor.deploysInfrastructure, false, 'Integration kit descriptor: deployment is false');
  equal(descriptor.issuesCredentials, false, 'Integration kit descriptor: credential issuance is false');
  equal(descriptor.activatesEnforcement, false, 'Integration kit descriptor: enforcement activation is false');
  equal(descriptor.nonBypassableClaimAllowed, false, 'Integration kit descriptor: no-bypass claim is false');

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-integration-kit-buildout.md');
  includes(doc, 'Machine-Readable Contract', 'Integration kit doc: machine-readable contract section exists');
  includes(doc, 'action-surface-integration-kit-packet.ts', 'Integration kit doc: source contract is named');
  includes(doc, 'test:action-surface-integration-kit-packet', 'Integration kit doc: package script is named');
  excludes(doc, /integration kit packet deploys/iu, 'Integration kit doc: deployment is not overclaimed');

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-integration-kit-packet'],
    'tsx tests/action-surface-integration-kit-packet.test.ts',
    'package.json exposes integration kit packet test',
  );
}

try {
  testPacketBuildsMachineReadableReviewFiles();
  testArtifactManifestAndProbePlanStayReviewOnly();
  testEmptyPacketDescriptorDocsAndPackageScript();
  console.log(`Action surface integration kit packet tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface integration kit packet tests failed:', error);
  process.exitCode = 1;
}
