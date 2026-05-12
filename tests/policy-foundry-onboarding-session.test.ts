import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createActionSurfaceOnboardingPacket,
  createGenericAdmissionEnvelope,
  createPolicyFoundryActiveQuestionPacket,
  createPolicyFoundryOnboardingSession,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  evaluateAttestorIntegrationModeReadiness,
  evaluatePolicyFoundryReadiness,
  evaluatePolicyFoundryRedTeamReplay,
  policyFoundryOnboardingSessionDescriptor,
  type ShadowAdmissionEvent,
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
    `${message}\nExpected to include: ${expected}`,
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

function event(input: {
  readonly actor: string;
  readonly occurredAt: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly authorityRef?: string | null;
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
}): ShadowAdmissionEvent {
  const admission = createGenericAdmissionEnvelope({
    mode: 'observe',
    actor: input.actor,
    action: 'rotate_secret',
    domain: 'system-operation',
    downstreamSystem: 'secret-manager',
    requestedAt: input.occurredAt,
    decidedAt: input.occurredAt,
    requestId: `request:${input.actor}:${input.occurredAt}`,
    policyRef: input.policyRef === undefined ? 'policy:ops:v1' : input.policyRef,
    evidenceRefs: input.evidenceRefs ?? ['change:approved'],
    authorityRef: input.authorityRef === undefined ? 'authority:ops' : input.authorityRef,
    observedFeatures: input.observedFeatures ?? {},
    recipient: 'raw_recipient_must_not_escape',
  });
  return createShadowAdmissionEvent({
    admission,
    occurredAt: input.occurredAt,
    downstreamOutcome: 'proceeded',
    humanOutcome: 'approved',
    observedFeatures: {
      secretMarker: 'sk_live_must_not_escape',
      ...(input.observedFeatures ?? {}),
    },
  });
}

function candidateFor(events: readonly ShadowAdmissionEvent[]) {
  const report = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-12T14:30:00.000Z',
    minimumPromotionEvents: 5,
  });
  const candidates = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-12T14:31:00.000Z',
  });
  const candidate = candidates.candidates.find((item) =>
    item.actionSurface === 'secret-manager.rotate_secret'
  ) ?? null;
  return { report, candidate };
}

function packetFor(events: readonly ShadowAdmissionEvent[]) {
  return createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-12T14:32:00.000Z',
    declarations: [
      {
        sourceKind: 'openapi',
        actionSurface: 'secret-manager.rotate_secret',
        domain: 'system-operation',
        downstreamSystem: 'secret-manager',
        action: 'rotate_secret',
        method: 'post',
        path: '/secrets/rotate',
        credentialPosture: 'gateway-held-secret',
      },
    ],
    events,
    readinessOverrides: [
      {
        actionSurface: 'secret-manager.rotate_secret',
        credentialIsolation: 'gateway-held-secret',
        signals: {
          admissionCallObserved: events.length > 0,
          shadowCaptureObserved: events.length > 0,
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
}

function testEmptySessionIsIntakeOnly(): void {
  const session = createPolicyFoundryOnboardingSession({
    generatedAt: '2026-05-12T15:00:00.000Z',
    tenantId: 'tenant_raw_must_not_escape',
  });
  const serialized = JSON.stringify(session);

  equal(session.version, 'attestor.policy-foundry-onboarding-session.v1', 'Onboarding session: version is explicit');
  equal(session.stage, 'intake', 'Onboarding session: empty input starts at intake');
  equal(session.status, 'no-input', 'Onboarding session: empty input is no-input');
  equal(session.approvalRequired, true, 'Onboarding session: approval is required');
  equal(session.autoEnforce, false, 'Onboarding session: auto enforce is false');
  equal(session.rawPayloadStored, false, 'Onboarding session: raw payload storage is false');
  equal(session.dataMinimizationSurfaceKind, 'policy-foundry-onboarding-session', 'Onboarding session: data minimization surface is explicit');
  equal(session.productionReady, false, 'Onboarding session: production readiness is not claimed');
  equal(session.deploysInfrastructure, false, 'Onboarding session: deployment is false');
  equal(session.issuesCredentials, false, 'Onboarding session: credential issuance is false');
  equal(session.activatesEnforcement, false, 'Onboarding session: enforcement activation is false');
  equal(session.nonBypassableClaimAllowed, false, 'Onboarding session: non-bypassable claim is false');
  ok(session.currentlyDue.includes('provide-action-surface-inventory'), 'Onboarding session: inventory is currently due');
  ok(session.currentlyDue.includes('send-shadow-traffic'), 'Onboarding session: shadow traffic is currently due');
  ok(session.digest.startsWith('sha256:'), 'Onboarding session: digest is generated');
  ok(session.tenantDigest?.startsWith('sha256:'), 'Onboarding session: tenant is digested');
  ok(!serialized.includes('tenant_raw_must_not_escape'), 'Onboarding session: raw tenant id is not serialized');
}

function testActiveQuestionsBecomeCurrentlyDue(): void {
  const gapEvent = event({
    actor: 'single-agent',
    occurredAt: '2026-05-12T15:05:00.000Z',
    policyRef: null,
    evidenceRefs: [],
    authorityRef: null,
  });
  const packet = packetFor([gapEvent]);
  const { report, candidate } = candidateFor([gapEvent]);
  const readiness = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events: [gapEvent],
    generatedAt: '2026-05-12T15:06:00.000Z',
    minimumSampleSize: 20,
  });
  const questions = createPolicyFoundryActiveQuestionPacket({
    readiness,
    generatedAt: '2026-05-12T15:07:00.000Z',
    maxQuestions: 3,
  });
  const session = createPolicyFoundryOnboardingSession({
    generatedAt: '2026-05-12T15:08:00.000Z',
    onboardingPacket: packet,
    readiness,
    activeQuestionPacket: questions,
  });

  equal(session.stage, 'active-questions', 'Onboarding session: active questions stage is selected');
  equal(session.status, 'questions-required', 'Onboarding session: active questions are required');
  ok(session.currentlyDue.includes('answer-active-questions'), 'Onboarding session: answering questions is currently due');
  ok(session.currentlyDue.includes('choose-policy-template'), 'Onboarding session: policy template gap is currently due');
  ok(session.currentlyDue.includes('bind-evidence'), 'Onboarding session: evidence gap is currently due');
  ok(session.eventuallyDue.includes('approve-candidate'), 'Onboarding session: approval waits until blockers close');
  equal(session.sourceDigests.onboardingPacketDigest, packet.digest, 'Onboarding session: packet digest is bound');
  equal(session.sourceDigests.readinessDigest, readiness.digest, 'Onboarding session: readiness digest is bound');
  equal(session.sourceDigests.activeQuestionPacketDigest, questions.digest, 'Onboarding session: active question digest is bound');
}

function testCleanSessionCanReachScopedRolloutReviewReady(): void {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: `ops-agent-${index % 4}`,
      occurredAt: `2026-05-12T16:${String(index).padStart(2, '0')}:00.000Z`,
    }),
  );
  const packet = packetFor(events);
  const { report, candidate } = candidateFor(events);
  const replay = evaluatePolicyFoundryRedTeamReplay({
    candidate,
    report,
    events,
    tenantId: events[0]?.tenantId ?? null,
    generatedAt: '2026-05-12T16:40:00.000Z',
  });
  const readiness = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    generatedAt: '2026-05-12T16:41:00.000Z',
    customerApproved: true,
    tenantBoundaryProven: true,
    redTeamReplayStatus: replay.status,
    minimumSampleSize: 20,
  });
  const integration = evaluateAttestorIntegrationModeReadiness({
    workflowId: 'secret-rotation-workflow',
    mode: 'gateway-proxy',
    credentialIsolation: 'gateway-held-secret',
    actionSurface: 'secret-manager.rotate_secret',
    domain: 'system-operation',
    downstreamSystem: 'secret-manager',
    generatedAt: '2026-05-12T16:42:00.000Z',
    generatedArtifacts: [
      'gateway-proxy-config',
      'verifier-helper-config',
      'credential-isolation-plan',
      'policy-twin-backtest',
      'red-team-replay-fixture',
    ],
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
  });
  const session = createPolicyFoundryOnboardingSession({
    generatedAt: '2026-05-12T16:43:00.000Z',
    sessionId: 'session_secret_rotation',
    tenantId: 'tenant_secret_rotation_raw',
    onboardingPacket: packet,
    readiness,
    redTeamReplay: replay,
    integrationReadiness: [integration],
  });
  const serialized = JSON.stringify(session);

  equal(readiness.status, 'enforce-eligible', 'Onboarding session fixture: readiness is enforce-eligible');
  equal(integration.status, 'scoped-enforce-eligible', 'Onboarding session fixture: integration is scoped-enforce-eligible');
  equal(session.stage, 'scoped-rollout-ready', 'Onboarding session: clean evidence reaches scoped rollout review stage');
  equal(session.status, 'scoped-rollout-review-ready', 'Onboarding session: clean evidence is review-ready for scoped rollout');
  equal(session.currentlyDueCount, 0, 'Onboarding session: clean evidence has no currently due blockers');
  ok(session.satisfied.includes('send-shadow-traffic'), 'Onboarding session: shadow traffic is satisfied');
  ok(session.satisfied.includes('prepare-verifier-or-gateway'), 'Onboarding session: verifier/gateway is satisfied');
  ok(session.satisfied.includes('review-credential-isolation'), 'Onboarding session: credential isolation is satisfied');
  equal(session.sourceDigests.redTeamReplayDigest, replay.digest, 'Onboarding session: replay digest is bound');
  equal(session.sourceDigests.integrationReadinessDigests[0], integration.digest, 'Onboarding session: integration digest is bound');
  excludes(serialized, /tenant_secret_rotation_raw|raw_recipient_must_not_escape|sk_live_must_not_escape/iu, 'Onboarding session: serialized output excludes raw tenant and payload markers');
}

function testDescriptorDocsAndPackageScriptStayAligned(): void {
  const descriptor = policyFoundryOnboardingSessionDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-onboarding-session.v1', 'Onboarding session descriptor: version is explicit');
  equal(descriptor.autoEnforce, false, 'Onboarding session descriptor: auto enforce is false');
  equal(descriptor.activatesEnforcement, false, 'Onboarding session descriptor: enforcement activation is false');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-onboarding-session', 'Onboarding session descriptor: data minimization surface is explicit');
  includes(doc, 'src/consequence-admission/policy-foundry-onboarding-session.ts', 'Policy Foundry docs: session contract is named');
  includes(doc, 'test:policy-foundry-onboarding-session', 'Policy Foundry docs: session test command is named');
  includes(tracker, 'Step 01', 'Deepening tracker: Step 01 is present');
  includes(tracker, 'Onboarding Session Contract v1', 'Deepening tracker: session contract step is named');
  includes(tracker, 'requirements-aware blockers', 'Deepening tracker: requirements-aware blockers are named');
  equal(
    pkg.scripts['test:policy-foundry-onboarding-session'],
    'tsx tests/policy-foundry-onboarding-session.test.ts',
    'Package: onboarding session test is exposed',
  );
}

try {
  testEmptySessionIsIntakeOnly();
  testActiveQuestionsBecomeCurrentlyDue();
  testCleanSessionCanReachScopedRolloutReviewReady();
  testDescriptorDocsAndPackageScriptStayAligned();
  console.log(`Policy Foundry onboarding session tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry onboarding session tests failed:', error);
  process.exitCode = 1;
}
