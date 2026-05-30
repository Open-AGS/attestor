import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceOnboardingRedTeamFixtureDescriptor,
  createActionSurfaceOnboardingPacket,
  createActionSurfaceOnboardingRedTeamFixtureBundle,
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
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

function testDeclarationPacketGetsSurfaceSpecificFixtures(): void {
  const openapi = JSON.stringify({
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
          responses: {
            '200': {
              description: 'ok',
            },
          },
        },
      },
    },
  });
  const packet = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-12T19:00:00.000Z',
    attestorBaseUrl: 'https://attestor.example.com',
    manifests: [
      {
        text: openapi,
        sourceRef: 'openapi/refunds.json',
        downstreamSystem: 'refund-service',
        defaultDomain: 'money-movement',
        credentialPosture: 'agent-held-static-secret',
      },
    ],
  });
  const fixtures = createActionSurfaceOnboardingRedTeamFixtureBundle({
    packet,
    generatedAt: '2026-05-12T19:01:00.000Z',
  });
  const text = JSON.stringify(fixtures);

  equal(fixtures.version, 'attestor.action-surface-onboarding-red-team-fixtures.v1', 'Red-team fixtures: version is explicit');
  equal(fixtures.packetDigest, packet.digest, 'Red-team fixtures: source packet digest is retained');
  equal(fixtures.packetStatus, 'requires-review', 'Red-team fixtures: source packet status is retained');
  equal(fixtures.surfaceCount, 1, 'Red-team fixtures: surface count is retained');
  equal(fixtures.caseCount, 12, 'Red-team fixtures: stable case set is generated per surface');
  equal(fixtures.approvalRequired, true, 'Red-team fixtures: approval remains required');
  equal(fixtures.autoEnforce, false, 'Red-team fixtures: auto enforce is false');
  equal(fixtures.rawPayloadStored, false, 'Red-team fixtures: raw payload storage is false');
  equal(fixtures.productionReady, false, 'Red-team fixtures: production readiness is not claimed');
  equal(fixtures.executionPlanOnly, true, 'Red-team fixtures: output is plan-only');
  equal(fixtures.deploysInfrastructure, false, 'Red-team fixtures: deployment is false');
  equal(fixtures.issuesCredentials, false, 'Red-team fixtures: credential issuance is false');
  equal(fixtures.activatesEnforcement, false, 'Red-team fixtures: enforcement activation is false');
  equal(fixtures.nonBypassableClaimAllowed, false, 'Red-team fixtures: non-bypassable claim is blocked');
  equal(fixtures.evidenceReplayOnly, true, 'Red-team fixtures: output is evidence replay only');
  ok(fixtures.digest.startsWith('sha256:'), 'Red-team fixtures: bundle digest is generated');
  ok(
    fixtures.cases.some((entry) =>
      entry.kind === 'direct-credential-bypass' &&
      entry.reasonCodes.includes('agent-direct-credential-bypass-must-block')
    ),
    'Red-team fixtures: direct credential bypass case is generated',
  );
  ok(
    fixtures.cases.some((entry) =>
      entry.kind === 'review-required-auto-promote' &&
      entry.expectedOutcome === 'hold'
    ),
    'Red-team fixtures: review-required auto-promote case is generated',
  );
  ok(
    fixtures.cases.every((entry) =>
      entry.syntheticOnly === true &&
      entry.rawPayloadStored === false &&
      entry.executionAllowed === false &&
      entry.digest.startsWith('sha256:')
    ),
    'Red-team fixtures: every case is synthetic, redacted, and digest-bound',
  );
  excludes(text, /raw_prompt_must_not_escape/u, 'Red-team fixtures: raw OpenAPI descriptions are not serialized');
  excludes(text, /sk_live_must_not_escape/u, 'Red-team fixtures: secret-like text is not serialized');
}

function testObservedPacketStillGeneratesReviewOnlyFixtures(): void {
  const admission = createGenericAdmissionEnvelope({
    mode: 'observe',
    actor: 'support-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-12T19:05:00.000Z',
    decidedAt: '2026-05-12T19:05:01.000Z',
    policyRef: 'policy:refunds:v1',
    evidenceRefs: ['evidence:order'],
    authorityRef: 'authority:support',
  });
  const packet = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-12T19:06:00.000Z',
    declarations: [
      {
        sourceKind: 'openapi',
        actionSurface: 'refund-service.issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        action: 'issue_refund',
        method: 'post',
        path: '/refunds',
        credentialPosture: 'gateway-held-secret',
      },
    ],
    events: [
      createShadowAdmissionEvent({
        admission,
        occurredAt: '2026-05-12T19:05:02.000Z',
        downstreamOutcome: 'proceeded',
      }),
    ],
    readinessOverrides: [
      {
        actionSurface: 'refund-service.issue_refund',
        credentialIsolation: 'gateway-held-secret',
        signals: {
          admissionCallObserved: true,
          shadowCaptureObserved: true,
          downstreamContractBound: true,
          verifierImplemented: true,
          gatewayProxyConfigured: true,
          presentationBindingImplemented: true,
          replayProtectionImplemented: true,
          idempotencyKeyRequired: true,
          tenantBoundaryProven: true,
          policySimulationAvailable: true,
          customerApprovalRecorded: true,
          redTeamReplayPassed: true,
          generatedArtifactsReviewed: true,
        },
      },
    ],
  });
  const fixtures = createActionSurfaceOnboardingRedTeamFixtureBundle({
    packet,
    generatedAt: '2026-05-12T19:07:00.000Z',
  });

  equal(packet.surfacePlans[0]?.readinessStatus, 'scoped-enforce-eligible', 'Red-team fixture: packet can reach scoped eligibility');
  equal(fixtures.caseCount, 12, 'Red-team fixtures: scoped-eligible packet still receives the same adversarial case set');
  equal(fixtures.autoEnforce, false, 'Red-team fixtures: scoped eligibility still does not auto-enforce');
  equal(fixtures.productionReady, false, 'Red-team fixtures: scoped eligibility still does not claim production readiness');
  ok(
    fixtures.cases.some((entry) =>
      entry.kind === 'missing-verifier' &&
      entry.requiredControls.includes('downstream-verifier')
    ),
    'Red-team fixtures: missing verifier regression case remains present',
  );
}

function testEmptyPacketDescriptorAndDocs(): void {
  const packet = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-12T19:10:00.000Z',
  });
  const fixtures = createActionSurfaceOnboardingRedTeamFixtureBundle({
    packet,
    generatedAt: '2026-05-12T19:11:00.000Z',
  });
  equal(fixtures.caseCount, 0, 'Red-team fixtures: empty packet produces zero cases');
  equal(fixtures.surfaceCount, 0, 'Red-team fixtures: empty packet has zero surfaces');

  const descriptor = actionSurfaceOnboardingRedTeamFixtureDescriptor();
  equal(descriptor.executionPlanOnly, true, 'Red-team fixture descriptor: plan-only is explicit');
  equal(descriptor.evidenceReplayOnly, true, 'Red-team fixture descriptor: evidence replay boundary is explicit');
  equal(descriptor.autoEnforce, false, 'Red-team fixture descriptor: auto enforce is false');
  ok(descriptor.caseKinds.includes('review-required-auto-promote'), 'Red-team fixture descriptor: review auto-promote case is listed');
  ok(descriptor.caseKinds.includes('direct-credential-bypass'), 'Red-team fixture descriptor: direct credential bypass case is listed');

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-onboarding-packet.md');
  includes(doc, 'Action Surface Onboarding Red-Team Fixtures', 'Red-team fixture doc: title exists');
  includes(doc, 'createActionSurfaceOnboardingRedTeamFixtureBundle', 'Red-team fixture doc: API is named');
  includes(doc, 'synthetic review plans only', 'Red-team fixture doc: synthetic boundary is documented');
  excludes(doc, /fixtures prove production readiness/iu, 'Red-team fixture doc: production readiness is not overclaimed');

  const docsFrontDoor = readProjectFile('docs', 'README.md');
  includes(docsFrontDoor, '[Action surface onboarding packet](02-architecture/action-surface-onboarding-packet.md)', 'Docs front door links the action-surface onboarding packet');
  excludes(doc, /red-team fixtures activate enforcement/iu, 'Action-surface docs do not overclaim fixture activation');

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-onboarding-red-team-fixtures'],
    'tsx tests/action-surface-onboarding-red-team-fixtures.test.ts',
    'package.json exposes red-team fixture test',
  );
}

try {
  testDeclarationPacketGetsSurfaceSpecificFixtures();
  testObservedPacketStillGeneratesReviewOnlyFixtures();
  testEmptyPacketDescriptorAndDocs();
  console.log(`Action surface onboarding red-team fixture tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface onboarding red-team fixture tests failed:', error);
  process.exitCode = 1;
}
