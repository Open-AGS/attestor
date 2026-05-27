import assert from 'node:assert/strict';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  evaluatePolicyFoundryReadiness,
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

function event(input: {
  readonly actor: string;
  readonly action?: string;
  readonly domain?: string;
  readonly downstreamSystem?: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
  readonly occurredAt: string;
  readonly humanOutcome?: 'not-reviewed' | 'approved' | 'rejected';
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: input.actor,
      action: input.action ?? 'rotate_secret',
      domain: input.domain ?? 'system-operation',
      downstreamSystem: input.downstreamSystem ?? 'secret-manager',
      requestedAt: input.occurredAt,
      decidedAt: input.occurredAt,
      requestId: `request:${input.actor}:${input.occurredAt}`,
      policyRef: input.policyRef === undefined ? 'policy:ops:v1' : input.policyRef,
      evidenceRefs: input.evidenceRefs ?? ['change:approved'],
      recipient: 'raw_recipient_must_not_escape',
      authoritySources: [
        {
          sourceKind: 'authority-record',
          claimKind: 'authorization',
          sourceRef: `authority:${input.actor}`,
          trustClass: 'trusted-authority',
          evidenceDigest: `sha256:authority-${input.actor}`,
        },
      ],
      observedFeatures: input.observedFeatures ?? {},
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: input.humanOutcome === 'rejected' ? 'blocked' : 'proceeded',
    humanOutcome: input.humanOutcome ?? 'not-reviewed',
    observedFeatures: {
      secretMarker: 'raw_feature_must_not_escape',
      ...(input.observedFeatures ?? {}),
    },
  });
}

function candidateFor(events: readonly ShadowAdmissionEvent[]) {
  const report = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-01T23:00:00.000Z',
    minimumPromotionEvents: 5,
  });
  const bundle = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-01T23:01:00.000Z',
  });
  const candidate = bundle.candidates.find((item) =>
    item.actionSurface === 'secret-manager.rotate_secret'
  ) ?? null;
  return { report, bundle, candidate };
}

function testCleanDistributedTrafficCanBecomeScopedEnforceEligible(): void {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: `ops-agent-${index % 4}`,
      occurredAt: `2026-05-01T22:${String(index).padStart(2, '0')}:02.000Z`,
      humanOutcome: index % 4 === 0 ? 'approved' : 'not-reviewed',
    }),
  );
  const { report, candidate } = candidateFor(events);
  const evaluation = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    generatedAt: '2026-05-01T23:02:00.000Z',
    customerApproved: true,
    redTeamReplayStatus: 'passed',
    minimumSampleSize: 20,
  });
  const serialized = JSON.stringify(evaluation);

  equal(evaluation.version, 'attestor.policy-foundry-readiness.v1', 'Policy Foundry readiness: version is explicit');
  equal(evaluation.approvalRequired, true, 'Policy Foundry readiness: approval boundary is explicit');
  equal(evaluation.autoEnforce, false, 'Policy Foundry readiness: evaluation never auto-enforces');
  equal(evaluation.llmAuthorityAllowed, false, 'Policy Foundry readiness: LLM authority is disallowed');
  equal(evaluation.status, 'enforce-eligible', 'Policy Foundry readiness: clean approved traffic can become enforce-eligible');
  equal(evaluation.recommendedRolloutStep, 'scoped-enforce-low-risk', 'Policy Foundry readiness: rollout starts scoped, not full enforce');
  equal(evaluation.confidence.actorDistributionHealth, 'healthy', 'Policy Foundry readiness: distributed actors are healthy');
  equal(evaluation.confidence.redTeamReplayStatus, 'passed', 'Policy Foundry readiness: red-team replay status is retained');
  equal(evaluation.noGoReasons.length, 0, 'Policy Foundry readiness: clean sample has no no-go reasons');
  ok(evaluation.readinessScore >= 90, 'Policy Foundry readiness: clean sample scores high');
  ok(evaluation.digest.startsWith('sha256:'), 'Policy Foundry readiness: digest is generated');
  ok(!serialized.includes('ops-agent-'), 'Policy Foundry readiness: raw actor IDs are not serialized');
  ok(!serialized.includes('raw_recipient_must_not_escape'), 'Policy Foundry readiness: raw recipient is not serialized');
  ok(!serialized.includes('raw_feature_must_not_escape'), 'Policy Foundry readiness: raw feature value is not serialized');
}

function testSingleActorConcentrationBlocksEnforce(): void {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: 'single-operator-agent',
      occurredAt: `2026-05-02T22:${String(index).padStart(2, '0')}:02.000Z`,
    }),
  );
  const { report, candidate } = candidateFor(events);
  const evaluation = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    generatedAt: '2026-05-02T23:02:00.000Z',
    customerApproved: true,
    redTeamReplayStatus: 'passed',
    minimumSampleSize: 20,
    maxSingleActorConcentration: 0.8,
  });

  equal(evaluation.status, 'no-go', 'Policy Foundry readiness: single actor concentration blocks readiness');
  ok(evaluation.noGoReasons.includes('single-actor-concentration'), 'Policy Foundry readiness: concentration no-go is explicit');
  equal(evaluation.confidence.actorDistributionHealth, 'weak', 'Policy Foundry readiness: concentration health is weak');
  equal(evaluation.recommendedRolloutStep, 'observe-only', 'Policy Foundry readiness: concentrated sample remains observe-only');
  ok(
    evaluation.activeQuestions.some((question) => question.kind === 'confirm-representative-sample'),
    'Policy Foundry readiness: asks only the representative-sample question for concentration',
  );
}

function testMissingControlsAndNoSimulationStayNoGo(): void {
  const gapEvent = event({
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    policyRef: null,
    evidenceRefs: [],
    occurredAt: '2026-05-03T22:40:02.000Z',
  });
  const report = createShadowPolicySimulationReport({
    events: [gapEvent],
    proposedMode: 'review',
    generatedAt: '2026-05-03T23:00:00.000Z',
  });
  const bundle = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-03T23:01:00.000Z',
  });
  const candidate = bundle.candidates.find((item) =>
    item.actionSurface === 'refund-service.issue_refund'
  ) ?? null;
  const evaluation = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events: [gapEvent],
    generatedAt: '2026-05-03T23:02:00.000Z',
  });
  const missingSimulation = evaluatePolicyFoundryReadiness({
    candidate,
    report: null,
    events: [gapEvent],
    generatedAt: '2026-05-03T23:03:00.000Z',
  });

  equal(evaluation.status, 'no-go', 'Policy Foundry readiness: missing controls are no-go');
  ok(evaluation.noGoReasons.includes('missing-policy-schema'), 'Policy Foundry readiness: missing policy is explicit');
  ok(evaluation.noGoReasons.includes('missing-evidence-coverage'), 'Policy Foundry readiness: missing evidence is explicit');
  ok(evaluation.noGoReasons.includes('sample-size-too-small'), 'Policy Foundry readiness: small samples are explicit');
  ok(evaluation.noGoReasons.includes('customer-approval-required'), 'Policy Foundry readiness: approval remains required');
  ok(
    evaluation.activeQuestions.some((question) => question.kind === 'choose-policy-template') &&
      evaluation.activeQuestions.some((question) => question.kind === 'bind-evidence') &&
      evaluation.activeQuestions.some((question) => question.kind === 'continue-shadow'),
    'Policy Foundry readiness: active questions target only blocking gaps',
  );
  ok(missingSimulation.noGoReasons.includes('no-simulation-report'), 'Policy Foundry readiness: simulation remains required');
}

function testUnsafeAuthoritySignalsRemainNoGo(): void {
  const events = Array.from({ length: 20 }, (_, index) =>
    event({
      actor: `ops-agent-${index % 4}`,
      observedFeatures: index === 0 ? { highRisk: true } : {},
      occurredAt: `2026-05-04T22:${String(index).padStart(2, '0')}:02.000Z`,
    }),
  );
  const { report, candidate } = candidateFor(events);
  const evaluation = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    generatedAt: '2026-05-04T23:02:00.000Z',
    customerApproved: true,
    redTeamReplayStatus: 'passed',
    llmAuthoritySource: true,
    tenantBoundaryProven: false,
  });

  equal(evaluation.status, 'no-go', 'Policy Foundry readiness: unsafe authority signals block readiness');
  ok(evaluation.noGoReasons.includes('high-risk-auto-admit'), 'Policy Foundry readiness: high-risk auto-admit is explicit');
  ok(evaluation.noGoReasons.includes('llm-authority-source'), 'Policy Foundry readiness: LLM authority source is explicit');
  ok(evaluation.noGoReasons.includes('tenant-boundary-not-proven'), 'Policy Foundry readiness: tenant boundary proof is required when marked missing');
}

testCleanDistributedTrafficCanBecomeScopedEnforceEligible();
testSingleActorConcentrationBlocksEnforce();
testMissingControlsAndNoSimulationStayNoGo();
testUnsafeAuthoritySignalsRemainNoGo();

console.log(`Policy Foundry readiness tests: ${passed} passed, 0 failed`);
