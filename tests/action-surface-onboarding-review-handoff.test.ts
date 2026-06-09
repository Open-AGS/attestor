import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceOnboardingReviewHandoffDescriptor,
  createActionSurfaceOnboardingPacket,
  createActionSurfaceOnboardingReviewHandoff,
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

function checklistStatus(
  handoff: ReturnType<typeof createActionSurfaceOnboardingReviewHandoff>,
  kind: string,
): string {
  const item = handoff.checklistItems.find((entry) => entry.kind === kind);
  assert.ok(item, `Missing checklist item ${kind}`);
  return item.status;
}

function testDeclarationOnlyPacketProducesBlockedReviewHandoff(): void {
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
          description: 'raw_prompt_must_not_escape rk_live_must_not_escape',
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
    generatedAt: '2026-05-12T18:00:00.000Z',
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
  const handoff = createActionSurfaceOnboardingReviewHandoff({
    packet,
    generatedAt: '2026-05-12T18:01:00.000Z',
    reviewerRef: 'operator:security-reviewer',
  });
  const text = JSON.stringify(handoff);

  equal(handoff.version, 'attestor.action-surface-onboarding-review-handoff.v1', 'Review handoff: version is explicit');
  equal(handoff.packetDigest, packet.digest, 'Review handoff: source packet digest is retained');
  equal(handoff.packetStatus, 'requires-review', 'Review handoff: source packet status is retained');
  equal(handoff.reviewStatus, 'blocked', 'Review handoff: declaration-only direct credential flow is blocked');
  equal(handoff.surfaceCount, 1, 'Review handoff: surface count is retained');
  equal(handoff.blockedSurfaceCount, 1, 'Review handoff: blocked surface count is retained');
  equal(handoff.readyForReviewSurfaceCount, 0, 'Review handoff: ready surface count is retained');
  equal(handoff.approvalRequired, true, 'Review handoff: approval is required');
  equal(handoff.autoEnforce, false, 'Review handoff: auto enforce is false');
  equal(handoff.rawPayloadStored, false, 'Review handoff: raw payload storage is false');
  equal(handoff.productionReady, false, 'Review handoff: production readiness is not claimed');
  equal(handoff.executionPlanOnly, true, 'Review handoff: handoff remains plan-only');
  equal(handoff.deploysInfrastructure, false, 'Review handoff: deployment is false');
  equal(handoff.issuesCredentials, false, 'Review handoff: credential issuance is false');
  equal(handoff.activatesEnforcement, false, 'Review handoff: enforcement activation is false');
  equal(handoff.nonBypassableClaimAllowed, false, 'Review handoff: non-bypassable claim is blocked');
  equal(checklistStatus(handoff, 'packet-digest-reviewed'), 'ready-for-review', 'Review handoff: packet digest can be reviewed');
  equal(checklistStatus(handoff, 'shadow-capture-reviewed'), 'blocked', 'Review handoff: missing shadow capture blocks review');
  equal(checklistStatus(handoff, 'credential-boundary-reviewed'), 'blocked', 'Review handoff: direct credential posture blocks review');
  equal(checklistStatus(handoff, 'downstream-verifier-reviewed'), 'blocked', 'Review handoff: missing verifier blocks review');
  equal(checklistStatus(handoff, 'non-bypassable-claim-blocked'), 'ready-for-review', 'Review handoff: no-overclaim guard is explicit');
  ok(handoff.digest.startsWith('sha256:'), 'Review handoff: digest is generated');
  ok(handoff.remainingBlockers.includes('no-go:refund_service.issue_refund:agent-direct-credential-exposed'), 'Review handoff: no-go reason is retained');
  ok(handoff.nextReviewSteps.includes('add-shadow-capture'), 'Review handoff: next step includes shadow capture');
  ok(handoff.nextReviewSteps.includes('record-human-review-decision'), 'Review handoff: human review remains explicit');
  excludes(text, /raw_prompt_must_not_escape/u, 'Review handoff: raw OpenAPI descriptions are not serialized');
  excludes(text, /rk_live_must_not_escape/u, 'Review handoff: secret-like content is not serialized');
}

function testFullyObservedPacketProducesReadyForReviewHandoff(): void {
  const admission = createGenericAdmissionEnvelope({
    mode: 'observe',
    actor: 'support-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-12T18:05:00.000Z',
    decidedAt: '2026-05-12T18:05:01.000Z',
    policyRef: 'policy:refunds:v1',
    evidenceRefs: ['evidence:order'],
    authorityRef: 'authority:support',
  });
  const packet = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-12T18:06:00.000Z',
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
        occurredAt: '2026-05-12T18:05:02.000Z',
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
  const handoff = createActionSurfaceOnboardingReviewHandoff({
    packet,
    generatedAt: '2026-05-12T18:07:00.000Z',
  });

  equal(packet.surfacePlans[0]?.readinessStatus, 'scoped-enforce-eligible', 'Review handoff fixture: packet can reach scoped eligibility');
  equal(handoff.reviewStatus, 'ready-for-review', 'Review handoff: complete evidence becomes ready for human review');
  equal(handoff.blockedSurfaceCount, 0, 'Review handoff: no blocked surfaces remain');
  equal(handoff.readyForReviewSurfaceCount, 1, 'Review handoff: ready surface count is retained');
  equal(handoff.remainingBlockers.length, 0, 'Review handoff: no blockers remain');
  equal(checklistStatus(handoff, 'shadow-capture-reviewed'), 'ready-for-review', 'Review handoff: shadow capture can be reviewed');
  equal(checklistStatus(handoff, 'generated-artifacts-reviewed'), 'ready-for-review', 'Review handoff: generated artifacts can be reviewed');
  equal(checklistStatus(handoff, 'tenant-boundary-reviewed'), 'ready-for-review', 'Review handoff: tenant boundary can be reviewed');
  equal(handoff.autoEnforce, false, 'Review handoff: ready review still does not auto-enforce');
  equal(handoff.productionReady, false, 'Review handoff: ready review still does not claim production readiness');
}

function testEmptyPacketAndDocs(): void {
  const packet = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-12T18:10:00.000Z',
  });
  const handoff = createActionSurfaceOnboardingReviewHandoff({
    packet,
    generatedAt: '2026-05-12T18:11:00.000Z',
  });

  equal(handoff.reviewStatus, 'blocked', 'Review handoff: empty packet is blocked');
  equal(handoff.surfaceCount, 0, 'Review handoff: empty packet has zero surfaces');
  ok(handoff.remainingBlockers.includes('no-action-surfaces-discovered'), 'Review handoff: empty packet blocker is explicit');

  const descriptor = actionSurfaceOnboardingReviewHandoffDescriptor();
  equal(descriptor.executionPlanOnly, true, 'Review handoff descriptor: plan-only is explicit');
  equal(descriptor.deploysInfrastructure, false, 'Review handoff descriptor: deployment is false');
  equal(descriptor.activatesEnforcement, false, 'Review handoff descriptor: enforcement activation is false');

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-onboarding-packet.md');
  includes(doc, 'Action Surface Onboarding Review Handoff', 'Review handoff doc: title exists');
  includes(doc, 'createActionSurfaceOnboardingReviewHandoff', 'Review handoff doc: API is named');
  includes(doc, 'review checklist', 'Review handoff doc: checklist boundary is documented');
  excludes(doc, /handoff activates enforcement/iu, 'Review handoff doc: enforcement activation is not overclaimed');

  const readme = readProjectFile('README.md');
  const connectionGuide = readProjectFile('docs', '01-overview', 'how-attestor-connects-to-existing-systems.md');
  includes(
    readme,
    'href="docs/01-overview/how-attestor-connects-to-existing-systems.md"',
    'README links the existing-systems overview',
  );
  includes(connectionGuide, 'bounded review material', 'Existing-systems overview mentions review material');
  excludes(readme, /review handoff deploys/iu, 'README does not overclaim review handoff deployment');

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-onboarding-review-handoff'],
    'tsx tests/action-surface-onboarding-review-handoff.test.ts',
    'package.json exposes review handoff test',
  );
}

try {
  testDeclarationOnlyPacketProducesBlockedReviewHandoff();
  testFullyObservedPacketProducesReadyForReviewHandoff();
  testEmptyPacketAndDocs();
  console.log(`Action surface onboarding review handoff tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface onboarding review handoff tests failed:', error);
  process.exitCode = 1;
}
