import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceOnboardingPacketDescriptor,
  createActionSurfaceOnboardingPacket,
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

function testManifestToPacketPlan(): void {
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
  const packet = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-12T13:00:00.000Z',
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
  const text = JSON.stringify(packet);
  const plan = packet.surfacePlans[0];

  equal(packet.version, 'attestor.action-surface-onboarding-packet.v1', 'Onboarding packet: version is explicit');
  equal(packet.status, 'requires-review', 'Onboarding packet: discovered surfaces require review');
  equal(packet.manifestCount, 1, 'Onboarding packet: manifest count is retained');
  equal(packet.declarationCount, 1, 'Onboarding packet: declaration count is retained');
  equal(packet.profileCount, 1, 'Onboarding packet: profile count is retained');
  equal(packet.artifactCount, 5, 'Onboarding packet: artifact count is retained');
  equal(packet.readinessCount, 1, 'Onboarding packet: readiness count is retained');
  equal(packet.approvalRequired, true, 'Onboarding packet: approval is required');
  equal(packet.autoEnforce, false, 'Onboarding packet: auto enforce is false');
  equal(packet.rawPayloadStored, false, 'Onboarding packet: raw payload storage is false');
  equal(packet.productionReady, false, 'Onboarding packet: production readiness is not claimed');
  equal(packet.executionPlanOnly, true, 'Onboarding packet: packet is plan-only');
  equal(packet.deploysInfrastructure, false, 'Onboarding packet: packet does not deploy infrastructure');
  equal(packet.issuesCredentials, false, 'Onboarding packet: packet does not issue credentials');
  equal(packet.activatesEnforcement, false, 'Onboarding packet: packet does not activate enforcement');
  equal(packet.nonBypassableClaimAllowed, false, 'Onboarding packet: packet blocks non-bypassable claim');
  ok(packet.digest.startsWith('sha256:'), 'Onboarding packet: digest is generated');
  ok(packet.manifestDigests[0]?.startsWith('sha256:'), 'Onboarding packet: manifest digest is retained');
  ok(packet.profilerDigest.startsWith('sha256:'), 'Onboarding packet: profiler digest is retained');
  ok(packet.artifactBundleDigest.startsWith('sha256:'), 'Onboarding packet: artifact bundle digest is retained');
  ok(packet.readinessDigests[0]?.startsWith('sha256:'), 'Onboarding packet: readiness digest is retained');
  equal(plan.actionSurface, 'refund_service.issue_refund', 'Onboarding packet: action surface is normalized');
  equal(plan.recommendedIntegrationMode, 'gateway-proxy', 'Onboarding packet: gateway mode is recommended');
  equal(plan.credentialPosture, 'agent-held-static-secret', 'Onboarding packet: credential posture is retained');
  equal(plan.readinessStatus, 'no-go', 'Onboarding packet: declaration-only direct credential is no-go');
  ok(plan.noGoReasons.includes('missing-admission-call'), 'Onboarding packet: missing admission call is explicit');
  ok(plan.noGoReasons.includes('agent-direct-credential-exposed'), 'Onboarding packet: direct credential exposure is explicit');
  ok(plan.nextOnboardingSteps.includes('add-shadow-capture'), 'Onboarding packet: next step adds shadow capture');
  ok(plan.nextOnboardingSteps.includes('isolate-or-prove-credential-boundary'), 'Onboarding packet: next step isolates credential');
  ok(plan.nextOnboardingSteps.includes('review-generated-artifacts'), 'Onboarding packet: next step reviews artifacts');
  ok(plan.artifactKinds.includes('gateway-proxy-config'), 'Onboarding packet: gateway artifact is planned');
  ok(plan.artifactKinds.includes('credential-isolation-plan'), 'Onboarding packet: credential isolation plan is planned');
  ok(!text.includes('raw_prompt_must_not_escape'), 'Onboarding packet: raw OpenAPI descriptions are not serialized');
  ok(!text.includes('sk_live_must_not_escape'), 'Onboarding packet: secret-like text is not serialized');
}

function testObservedShadowAndOverridesCanReachReviewBoundary(): void {
  const admission = createGenericAdmissionEnvelope({
    mode: 'observe',
    actor: 'support-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-12T13:05:00.000Z',
    decidedAt: '2026-05-12T13:05:01.000Z',
    policyRef: 'policy:refunds:v1',
    evidenceRefs: ['evidence:order'],
    authorityRef: 'authority:support',
  });
  const packet = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-12T13:06:00.000Z',
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
        occurredAt: '2026-05-12T13:05:02.000Z',
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
  const plan = packet.surfacePlans[0];

  equal(packet.status, 'requires-review', 'Onboarding packet: even complete evidence remains a review packet');
  equal(plan.readinessStatus, 'scoped-enforce-eligible', 'Onboarding packet: readiness can expose scoped-enforce eligibility');
  equal(plan.bypassRisk, 'low', 'Onboarding packet: low bypass risk is retained from readiness');
  equal(packet.nonBypassableClaimAllowed, false, 'Onboarding packet: packet itself still blocks non-bypassable claim');
  ok(plan.nextOnboardingSteps.includes('review-generated-artifacts'), 'Onboarding packet: generated artifact review remains visible');
}

function testEmptyPacketAndDocs(): void {
  const packet = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-12T13:10:00.000Z',
  });
  equal(packet.status, 'no-surfaces', 'Onboarding packet: empty packet has no-surfaces status');
  equal(packet.profileCount, 0, 'Onboarding packet: empty packet has zero profiles');
  equal(packet.artifactCount, 0, 'Onboarding packet: empty packet has zero artifacts');
  equal(packet.readinessCount, 0, 'Onboarding packet: empty packet has zero readiness results');

  const descriptor = actionSurfaceOnboardingPacketDescriptor();
  equal(descriptor.executionPlanOnly, true, 'Onboarding packet descriptor: plan-only is explicit');
  equal(descriptor.deploysInfrastructure, false, 'Onboarding packet descriptor: deployment is false');
  equal(descriptor.activatesEnforcement, false, 'Onboarding packet descriptor: enforcement activation is false');

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-onboarding-packet.md');
  includes(doc, 'Action Surface Onboarding Packet', 'Onboarding packet doc: title exists');
  includes(doc, 'Terraform `plan` / `apply`', 'Onboarding packet doc: plan/apply anchor is documented');
  includes(doc, 'Backstage Software Templates', 'Onboarding packet doc: template anchor is documented');
  includes(doc, 'review-required packet', 'Onboarding packet doc: review boundary is documented');
  excludes(doc, /packet makes the workflow production-ready/iu, 'Onboarding packet doc: production readiness is not overclaimed');

  const readme = readProjectFile('README.md');
  includes(readme, '[Action surface onboarding packet](docs/02-architecture/action-surface-onboarding-packet.md)', 'README links onboarding packet');
  excludes(readme, /docs\/02-architecture\/action-surface-manifest-intake\.md/iu, 'README keeps supporting action-surface links inside the onboarding packet doc');
  excludes(readme, /onboarding packet deploys the gateway/iu, 'README does not overclaim deployment');

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-onboarding-packet'],
    'tsx tests/action-surface-onboarding-packet.test.ts',
    'package.json exposes onboarding packet test',
  );
}

try {
  testManifestToPacketPlan();
  testObservedShadowAndOverridesCanReachReviewBoundary();
  testEmptyPacketAndDocs();
  console.log(`Action surface onboarding packet tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface onboarding packet tests failed:', error);
  process.exitCode = 1;
}
