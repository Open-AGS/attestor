import assert from 'node:assert/strict';
import {
  createGenericAdmissionEnvelope,
  createPolicyFoundryActiveQuestionPacket,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  evaluatePolicyFoundryReadiness,
  policyFoundryActiveQuestionPacketDescriptor,
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
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly occurredAt: string;
  readonly humanOutcome?: 'not-reviewed' | 'approved' | 'rejected';
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: input.actor,
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: input.occurredAt,
      decidedAt: input.occurredAt,
      requestId: `request:${input.actor}:${input.occurredAt}`,
      policyRef: input.policyRef === undefined ? null : input.policyRef,
      evidenceRefs: input.evidenceRefs ?? [],
      recipient: 'raw_recipient_must_not_escape',
      observedFeatures: {
        privateThreshold: 'raw_feature_must_not_escape',
      },
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: input.humanOutcome === 'rejected' ? 'blocked' : 'proceeded',
    humanOutcome: input.humanOutcome ?? 'not-reviewed',
    observedFeatures: {
      privateThreshold: 'raw_feature_must_not_escape',
    },
  });
}

function readinessFor(events: readonly ShadowAdmissionEvent[], customerApproved = false) {
  const report = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-05T23:00:00.000Z',
    minimumPromotionEvents: 5,
  });
  const bundle = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-05T23:01:00.000Z',
  });
  const candidate = bundle.candidates.find((item) =>
    item.actionSurface === 'refund-service.issue_refund'
  ) ?? null;
  return evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    generatedAt: '2026-05-05T23:02:00.000Z',
    customerApproved,
    redTeamReplayStatus: 'failed',
    minimumSampleSize: 20,
  });
}

function testPacketAsksOnlyTopBlockingQuestions(): void {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: `support-agent-${index % 3}`,
      occurredAt: `2026-05-05T22:${String(index).padStart(2, '0')}:02.000Z`,
    }),
  );
  const readiness = readinessFor(events);
  const packet = createPolicyFoundryActiveQuestionPacket({
    readiness,
    generatedAt: '2026-05-05T23:03:00.000Z',
  });
  const serialized = JSON.stringify(packet);

  equal(packet.version, 'attestor.policy-foundry-active-question-packet.v1', 'Policy Foundry active questions: version is explicit');
  equal(packet.status, 'questions-required', 'Policy Foundry active questions: missing controls produce questions');
  equal(packet.approvalRequired, true, 'Policy Foundry active questions: approval remains required');
  equal(packet.autoEnforce, false, 'Policy Foundry active questions: packet never auto-enforces');
  equal(packet.llmAuthorityAllowed, false, 'Policy Foundry active questions: LLM authority is not allowed');
  equal(packet.rawPayloadStored, false, 'Policy Foundry active questions: raw payload storage is false');
  equal(packet.decisionSupportOnly, true, 'Policy Foundry active questions: packet is decision support only');
  equal(packet.dataMinimizationSurfaceKind, 'policy-foundry-active-questions', 'Policy Foundry active questions: data minimization surface is explicit');
  equal(packet.questionCount, 3, 'Policy Foundry active questions: default packet asks at most three questions');
  ok(packet.omittedQuestionCount > 0, 'Policy Foundry active questions: lower priority questions are counted, not expanded');
  equal(packet.questions[0]?.kind, 'choose-policy-template', 'Policy Foundry active questions: policy schema comes first when sample is sufficient');
  equal(packet.questions[0]?.expectedAnswerKind, 'policy-template-ref', 'Policy Foundry active questions: policy question expects a reference');
  ok(
    packet.questions.some((question) => question.kind === 'bind-evidence'),
    'Policy Foundry active questions: evidence binding is requested',
  );
  ok(
    packet.questions.every((question) => question.blocksReasonCodes.length > 0),
    'Policy Foundry active questions: each question maps to no-go reason codes',
  );
  ok(packet.readinessDigest.startsWith('sha256:'), 'Policy Foundry active questions: readiness digest is retained');
  ok(packet.digest.startsWith('sha256:'), 'Policy Foundry active questions: packet digest is generated');
  ok(!serialized.includes('support-agent-'), 'Policy Foundry active questions: raw actor IDs are not serialized');
  ok(!serialized.includes('raw_recipient_must_not_escape'), 'Policy Foundry active questions: raw recipient is not serialized');
  ok(!serialized.includes('raw_feature_must_not_escape'), 'Policy Foundry active questions: raw features are not serialized');
}

function testPacketCanBeEmptyWhenReadinessHasNoQuestions(): void {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: `support-agent-${index % 4}`,
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['payment:verified'],
      occurredAt: `2026-05-06T22:${String(index).padStart(2, '0')}:02.000Z`,
      humanOutcome: index % 4 === 0 ? 'approved' : 'not-reviewed',
    }),
  );
  const report = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-06T23:00:00.000Z',
    minimumPromotionEvents: 5,
  });
  const bundle = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-06T23:01:00.000Z',
  });
  const candidate = bundle.candidates.find((item) =>
    item.actionSurface === 'refund-service.issue_refund'
  ) ?? null;
  const readiness = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    generatedAt: '2026-05-06T23:02:00.000Z',
    customerApproved: true,
    redTeamReplayStatus: 'passed',
    minimumSampleSize: 20,
  });
  const packet = createPolicyFoundryActiveQuestionPacket({
    readiness,
    generatedAt: '2026-05-06T23:03:00.000Z',
  });

  equal(readiness.noGoReasons.length, 0, 'Policy Foundry active questions: fixture is ready');
  equal(packet.status, 'no-active-questions', 'Policy Foundry active questions: clean readiness has no questions');
  equal(packet.questionCount, 0, 'Policy Foundry active questions: clean packet is empty');
  equal(packet.nextSafeStep, 'review-required', 'Policy Foundry active questions: packet retains next safe step');
}

function testDescriptorExposesSafetyBoundary(): void {
  const descriptor = policyFoundryActiveQuestionPacketDescriptor();

  equal(descriptor.version, 'attestor.policy-foundry-active-question-packet.v1', 'Policy Foundry active questions: descriptor version is explicit');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-active-questions', 'Policy Foundry active questions: descriptor binds data minimization surface');
  equal(descriptor.approvalRequired, true, 'Policy Foundry active questions: descriptor keeps approval required');
  equal(descriptor.autoEnforce, false, 'Policy Foundry active questions: descriptor never auto-enforces');
  equal(descriptor.llmAuthorityAllowed, false, 'Policy Foundry active questions: descriptor blocks LLM authority');
  equal(descriptor.defaultMaxQuestions, 3, 'Policy Foundry active questions: descriptor records default max questions');
}

testPacketAsksOnlyTopBlockingQuestions();
testPacketCanBeEmptyWhenReadinessHasNoQuestions();
testDescriptorExposesSafetyBoundary();

console.log(`Policy Foundry active questions tests: ${passed} passed, 0 failed`);
