import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createActionSurfaceOnboardingPacket,
  createGenericAdmissionEnvelope,
  createPolicyFoundryCoverageScore,
  createPolicyFoundryGatePlanner,
  createPolicyFoundryOnboardingSession,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  evaluateAttestorIntegrationModeReadiness,
  evaluatePolicyFoundryReadiness,
  evaluatePolicyFoundryRedTeamReplay,
  policyFoundryGatePlannerDescriptor,
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
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
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
}): ShadowAdmissionEvent {
  const admission = createGenericAdmissionEnvelope({
    mode: 'observe',
    actor: input.actor,
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: input.occurredAt,
    decidedAt: input.occurredAt,
    requestId: `request:${input.actor}:${input.occurredAt}`,
    policyRef: input.policyRef === undefined ? 'policy:refund:v1' : input.policyRef,
    evidenceRefs: input.evidenceRefs ?? ['payment:captured'],
    authorityRef: input.authorityRef === undefined ? 'authority:support-lead' : input.authorityRef,
    recipient: 'raw_recipient_must_not_escape',
  });
  return createShadowAdmissionEvent({
    admission,
    occurredAt: input.occurredAt,
    downstreamOutcome: 'proceeded',
    humanOutcome: 'approved',
    observedFeatures: {
      secretMarker: 'whsec_must_not_escape',
    },
  });
}

function candidateFor(events: readonly ShadowAdmissionEvent[]) {
  const report = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-12T20:00:00.000Z',
    minimumPromotionEvents: 5,
  });
  const candidates = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-12T20:01:00.000Z',
  });
  const candidate = candidates.candidates.find((item) =>
    item.actionSurface === 'refund-service.issue_refund'
  ) ?? null;
  return { report, candidate };
}

function packetFor(
  events: readonly ShadowAdmissionEvent[],
  reviewedControls: boolean,
) {
  return createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-12T20:02:00.000Z',
    attestorBaseUrl: 'https://attestor.example.com',
    declarations: [
      {
        sourceKind: 'openapi',
        actionSurface: 'refund-service.issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        action: 'issue_refund',
        method: 'post',
        path: '/refunds',
        credentialPosture: reviewedControls ? 'gateway-held-secret' : 'agent-held-static-secret',
      },
    ],
    events,
    readinessOverrides: [
      {
        actionSurface: 'refund-service.issue_refund',
        credentialIsolation: reviewedControls ? 'gateway-held-secret' : 'agent-held-static-secret',
        signals: {
          admissionCallObserved: events.length > 0,
          shadowCaptureObserved: events.length > 0,
          downstreamContractBound: reviewedControls,
          verifierImplemented: reviewedControls,
          gatewayProxyConfigured: reviewedControls,
          presentationBindingImplemented: reviewedControls,
          replayProtectionImplemented: reviewedControls,
          idempotencyKeyRequired: reviewedControls,
          tenantBoundaryProven: reviewedControls,
          policySimulationAvailable: reviewedControls,
          customerApprovalRecorded: reviewedControls,
          redTeamReplayPassed: reviewedControls,
          generatedArtifactsReviewed: reviewedControls,
        },
      },
    ],
  });
}

function testNoCoverageChoosesShadowCaptureOnly(): void {
  const session = createPolicyFoundryOnboardingSession({
    generatedAt: '2026-05-12T20:05:00.000Z',
    tenantId: 'tenant_raw_must_not_escape',
  });
  const coverage = createPolicyFoundryCoverageScore({
    generatedAt: '2026-05-12T20:06:00.000Z',
    session,
  });
  const planner = createPolicyFoundryGatePlanner({
    generatedAt: '2026-05-12T20:07:00.000Z',
    coverage,
  });
  const serialized = JSON.stringify(planner);
  const plan = planner.plans[0]!;

  equal(planner.version, 'attestor.policy-foundry-gate-planner.v1', 'Gate planner: version is explicit');
  equal(planner.status, 'collect-shadow', 'Gate planner: no coverage starts with shadow collection');
  equal(plan.selectedMode, 'shadow-capture-sdk', 'Gate planner: no coverage selects shadow capture');
  equal(plan.gateStrength, 'shadow-only', 'Gate planner: no coverage is shadow-only');
  equal(plan.nonBypassableCandidate, false, 'Gate planner: shadow capture is not a non-bypassable candidate');
  equal(plan.nonBypassableClaimAllowed, false, 'Gate planner: non-bypassable claim is false');
  equal(planner.autoEnforce, false, 'Gate planner: auto enforce is false');
  equal(planner.productionReady, false, 'Gate planner: production readiness is false');
  ok(plan.requiredArtifacts.includes('sdk-snippet'), 'Gate planner: shadow capture includes SDK snippet artifact');
  ok(plan.requiredCustomerWork.includes('send-shadow-traffic'), 'Gate planner: asks for shadow traffic');
  excludes(serialized, /tenant_raw_must_not_escape|raw_recipient_must_not_escape|whsec_must_not_escape/iu, 'Gate planner: serialized output excludes raw tenant and payload markers');
}

function testPartialCoverageChoosesGatewayPlan(): void {
  const gapEvent = event({
    actor: 'support-agent-one',
    occurredAt: '2026-05-12T20:10:00.000Z',
    policyRef: null,
    evidenceRefs: [],
    authorityRef: null,
  });
  const packet = packetFor([gapEvent], false);
  const { report, candidate } = candidateFor([gapEvent]);
  const readiness = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events: [gapEvent],
    generatedAt: '2026-05-12T20:11:00.000Z',
    minimumSampleSize: 20,
    llmAuthoritySource: true,
  });
  const integration = packet.readinessResults[0]!;
  const session = createPolicyFoundryOnboardingSession({
    generatedAt: '2026-05-12T20:12:00.000Z',
    onboardingPacket: packet,
    readiness,
    integrationReadiness: [integration],
  });
  const coverage = createPolicyFoundryCoverageScore({
    generatedAt: '2026-05-12T20:13:00.000Z',
    session,
    onboardingPacket: packet,
    readiness,
    integrationReadiness: [integration],
  });
  const planner = createPolicyFoundryGatePlanner({
    generatedAt: '2026-05-12T20:14:00.000Z',
    coverage,
    onboardingPacket: packet,
    integrationReadiness: [integration],
  });
  const plan = planner.plans[0]!;

  equal(planner.status, 'prepare-gate', 'Gate planner: partial coverage prepares gate');
  equal(plan.selectedMode, 'gateway-proxy', 'Gate planner: direct static credential profile selects gateway proxy');
  equal(plan.gateStrength, 'gateway-bound', 'Gate planner: gateway proxy is gateway-bound');
  equal(plan.nonBypassableCandidate, true, 'Gate planner: gateway proxy is a non-bypassable candidate');
  equal(plan.nonBypassableClaimAllowed, false, 'Gate planner: candidate still cannot claim non-bypassability');
  ok(plan.blockingDimensions.includes('verifier-or-gateway'), 'Gate planner: verifier/gateway blocker remains visible');
  ok(plan.blockingDimensions.includes('credential-isolation'), 'Gate planner: credential blocker remains visible');
  ok(plan.requiredArtifacts.includes('gateway-proxy-config'), 'Gate planner: gateway proxy config is required');
  ok(plan.requiredArtifacts.includes('credential-isolation-plan'), 'Gate planner: credential isolation plan is required');
  ok(plan.artifactDigests.length > 0, 'Gate planner: review artifact digests are bound');
  ok(plan.requiredCustomerWork.includes('review-gateway-proxy-gate-draft'), 'Gate planner: asks for gateway draft review');
  ok(planner.prohibitedAutomations.includes('activate-enforcement'), 'Gate planner: enforcement activation is prohibited');
}

function testCleanCoverageCanReachScopedRolloutReviewPlan(): void {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: `support-agent-${index % 4}`,
      occurredAt: `2026-05-12T21:${String(index).padStart(2, '0')}:00.000Z`,
    }),
  );
  const packet = packetFor(events, true);
  const { report, candidate } = candidateFor(events);
  const replay = evaluatePolicyFoundryRedTeamReplay({
    candidate,
    report,
    events,
    tenantId: events[0]?.tenantId ?? null,
    generatedAt: '2026-05-12T21:40:00.000Z',
  });
  const readiness = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    generatedAt: '2026-05-12T21:41:00.000Z',
    customerApproved: true,
    tenantBoundaryProven: true,
    redTeamReplayStatus: replay.status,
    minimumSampleSize: 20,
  });
  const integration = evaluateAttestorIntegrationModeReadiness({
    workflowId: 'refund-workflow',
    mode: 'gateway-proxy',
    credentialIsolation: 'gateway-held-secret',
    actionSurface: 'refund-service.issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    generatedAt: '2026-05-12T21:42:00.000Z',
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
    generatedAt: '2026-05-12T21:43:00.000Z',
    onboardingPacket: packet,
    readiness,
    redTeamReplay: replay,
    integrationReadiness: [integration],
  });
  const coverage = createPolicyFoundryCoverageScore({
    generatedAt: '2026-05-12T21:44:00.000Z',
    session,
    onboardingPacket: packet,
    readiness,
    redTeamReplay: replay,
    integrationReadiness: [integration],
  });
  const planner = createPolicyFoundryGatePlanner({
    generatedAt: '2026-05-12T21:45:00.000Z',
    coverage,
    onboardingPacket: packet,
    integrationReadiness: [integration],
  });
  const plan = planner.plans[0]!;

  equal(planner.status, 'scoped-rollout-review-ready', 'Gate planner: clean coverage reaches scoped rollout review');
  equal(planner.gateReadySurfaceCount, 1, 'Gate planner: one gate-ready surface is counted');
  equal(plan.planStatus, 'scoped-rollout-review-ready', 'Gate planner: surface is scoped rollout review ready');
  equal(plan.selectedMode, 'gateway-proxy', 'Gate planner: keeps gateway proxy mode');
  equal(plan.coverageScore, 100, 'Gate planner: clean plan keeps coverage score');
  equal(plan.blockingDimensions.length, 0, 'Gate planner: no blocking dimensions remain');
  equal(plan.nonBypassableClaimAllowed, false, 'Gate planner: clean plan still cannot claim non-bypassability');
  ok(planner.approvalGatedAutomations.includes('prepare-scoped-rollout-review'), 'Gate planner: rollout preparation is approval gated');
  ok(planner.safeAutomations.includes('render-review-only-gate-plan'), 'Gate planner: review-only rendering is safe automation');
}

function testDescriptorDocsAndPackageScriptStayAligned(): void {
  const descriptor = policyFoundryGatePlannerDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-gate-planner.v1', 'Gate planner descriptor: version is explicit');
  equal(descriptor.autoEnforce, false, 'Gate planner descriptor: auto enforce is false');
  equal(descriptor.deploysInfrastructure, false, 'Gate planner descriptor: deploys infrastructure is false');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-gate-planner', 'Gate planner descriptor: data minimization surface is explicit');
  includes(doc, 'src/consequence-admission/policy-foundry-gate-planner.ts', 'Policy Foundry docs: gate planner contract is named');
  includes(doc, 'test:policy-foundry-gate-planner', 'Policy Foundry docs: gate planner test command is named');
  includes(tracker, 'Step 03', 'Deepening tracker: Step 03 is present');
  includes(tracker, 'Minimum Viable Gate Planner', 'Deepening tracker: gate planner step is named');
  includes(tracker, 'attestor.policy-foundry-gate-planner.v1', 'Deepening tracker: gate planner version is named');
  equal(
    pkg.scripts['test:policy-foundry-gate-planner'],
    'tsx tests/policy-foundry-gate-planner.test.ts',
    'Package: gate planner test is exposed',
  );
}

try {
  testNoCoverageChoosesShadowCaptureOnly();
  testPartialCoverageChoosesGatewayPlan();
  testCleanCoverageCanReachScopedRolloutReviewPlan();
  testDescriptorDocsAndPackageScriptStayAligned();
  console.log(`Policy Foundry gate planner tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry gate planner tests failed:', error);
  process.exitCode = 1;
}
