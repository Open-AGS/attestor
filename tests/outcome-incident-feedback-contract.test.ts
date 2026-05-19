import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFLICT_ABSTENTION_GATE_VERSION,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
  HUMAN_COMPREHENSION_GATE_VERSION,
  OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
  SIGNED_ASSURANCE_PACKET_VERSION,
  createOutcomeIncidentFeedbackContract,
  createSignedAssurancePacket,
  createSignedAssurancePacketHistoryBinding,
  createSignedAssurancePacketSigningPayload,
  evaluateHumanComprehensionGate,
  outcomeIncidentFeedbackContractDescriptor,
  type ConflictAbstentionGateResult,
  type CreateSignedAssurancePacketInput,
  type SignedAssurancePacket,
  type SignedAssurancePacketSignature,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function rejects(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const digestE = `sha256:${'e'.repeat(64)}`;
const digestF = `sha256:${'f'.repeat(64)}`;
const digest1 = `sha256:${'1'.repeat(64)}`;
const digest2 = `sha256:${'2'.repeat(64)}`;
const digest3 = `sha256:${'3'.repeat(64)}`;
const digest4 = `sha256:${'4'.repeat(64)}`;
const digest5 = `sha256:${'5'.repeat(64)}`;

function conflictGate(): ConflictAbstentionGateResult {
  return {
    version: CONFLICT_ABSTENTION_GATE_VERSION,
    relationshipAwareMonotoneFusionVersion:
      'attestor.relationship-aware-monotone-fusion.v1',
    signalRelationshipContractVersion: 'attestor.signal-relationship-contract.v1',
    layerOpinionSchemaVersion: 'attestor.layer-opinion-schema.v1',
    modulatorAuthorityTierVersion: 'attestor.modulator-authority-tier.v1',
    envelopeRefDigest: digestA,
    outcome: 'continue',
    conflictScore: 0,
    abstentionScore: 0,
    uncertaintyScore: 0.1,
    coverageGapScore: 0,
    blockPressure: 0,
    reviewPressure: 0.1,
    maxGateScore: 0.1,
    reasonCodes: ['no-admit-authority'],
    reviewedInputs: {
      opinionCount: 1,
      relationshipCount: 1,
      modulatorCount: 1,
      abstentionCount: 0,
      contradictionCount: 0,
      conflictOpinionCount: 0,
    },
    noLoosening: true,
    failClosedOnUncertainty: true,
    runsAfterRelationshipAwareFusion: true,
    canAdmit: false,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };
}

function compactHumanGate() {
  return evaluateHumanComprehensionGate({
    envelopeRefDigest: digestA,
    conflictGate: conflictGate(),
    reasonLineCandidates: [{
      lineId: 'line-1',
      severity: 'info',
      text: 'Feedback contract fixture is compact.',
      sourceDigest: digestB,
      reasonCodes: ['compact-input'],
      actionHint: null,
    }],
    activeQuestions: [],
    reviewLoad: {
      pendingReviewItemCount: 0,
      humanActionItemCount: 0,
      reviewerCapacityPerHour: 20,
      currentReviewRatePerMinute: 0,
    },
  });
}

function signedPacketInput(): CreateSignedAssurancePacketInput {
  const historyVerification = Object.freeze({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    historyId: 'history:outcome-incident',
    valid: true,
    failClosed: false,
    verifiedEntryCount: 3,
    rootDigest: digestC,
    firstEntryDigest: digestC,
    lastEntryDigest: digestD,
    failureReasons: [],
    reasonCodes: ['tamper-history-verified'],
    rawPayloadStored: false,
  });
  return {
    envelopeRefDigest: digestA,
    decisionBinding: {
      decision: 'block',
      decisionSourceDigest: digestB,
      reasonCodes: ['block-decision'],
    },
    historyBinding: createSignedAssurancePacketHistoryBinding(historyVerification),
    historyVerification,
    humanComprehensionGate: compactHumanGate(),
    policyRefDigests: [digestF],
    evidenceRefDigests: [digest1],
    signalRefDigests: [digest2],
    relationshipRefDigests: [digest3],
    replayRefDigests: [digest4],
    generatedAt: '2026-05-17T16:10:00.000Z',
  };
}

function productionSignature(
  input: CreateSignedAssurancePacketInput,
): SignedAssurancePacketSignature {
  const payload = createSignedAssurancePacketSigningPayload(input);
  return {
    algorithm: 'external-kms',
    signature: `external-kms-signature:${payload.digest}`,
    signerRef: 'kms:prod-assurance-packet-signer',
    publicKeyFingerprint: 'kms-fingerprint:prod-assurance-packet-signer',
    signedAt: '2026-05-17T16:10:01.000Z',
    signingBoundary: 'external-kms-hsm',
    payloadDigest: payload.digest,
    productionReady: true,
  };
}

function readyPacket(): SignedAssurancePacket {
  const input = signedPacketInput();
  return createSignedAssurancePacket({
    ...input,
    signature: productionSignature(input),
  });
}

function unreadyPacket(): SignedAssurancePacket {
  return createSignedAssurancePacket(signedPacketInput());
}

function testDescriptorRecordsNoAuthorityAndSourceSeparation(): void {
  const descriptor = outcomeIncidentFeedbackContractDescriptor();

  equal(
    descriptor.version,
    OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
    'Outcome incident feedback: descriptor exposes version',
  );
  equal(
    descriptor.assurancePacketVersion,
    SIGNED_ASSURANCE_PACKET_VERSION,
    'Outcome incident feedback: descriptor links signed assurance packet',
  );
  ok(
    descriptor.sourceClasses.includes('confirmed-incident'),
    'Outcome incident feedback: confirmed incident source class is present',
  );
  ok(
    descriptor.states.includes('postmortem'),
    'Outcome incident feedback: postmortem state is present',
  );
  equal(descriptor.digestOnlySources, true, 'Outcome incident feedback: sources are digest-only');
  equal(descriptor.separatesSourceClasses, true, 'Outcome incident feedback: source classes are separated');
  equal(descriptor.incidentPathFirstClass, true, 'Outcome incident feedback: incident path is first-class');
  equal(descriptor.replayRegressionTriggering, true, 'Outcome incident feedback: replay triggering is explicit');
  equal(descriptor.feedbackInputOnly, true, 'Outcome incident feedback: feedback is input-only');
  equal(descriptor.automaticPolicyMutationAllowed, false, 'Outcome incident feedback: policy mutation is blocked');
  equal(descriptor.automaticScoreMutationAllowed, false, 'Outcome incident feedback: score mutation is blocked');
  equal(descriptor.automaticCalibrationMutationAllowed, false, 'Outcome incident feedback: calibration mutation is blocked');
  equal(descriptor.llmTrainingAllowed, false, 'Outcome incident feedback: LLM training is blocked');
  equal(descriptor.canAdmit, false, 'Outcome incident feedback: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Outcome incident feedback: descriptor cannot enforce');
  equal(descriptor.rawPayloadStored, false, 'Outcome incident feedback: raw payload storage is blocked');
  equal(descriptor.productionReady, false, 'Outcome incident feedback: production readiness is not claimed');
}

function testPositiveDirectFeedbackBecomesLearningReadyOnly(): void {
  const feedback = createOutcomeIncidentFeedbackContract({
    assurancePacket: readyPacket(),
    generatedAt: '2026-05-17T16:11:00.000Z',
    feedbackEvents: [
      {
        eventId: 'receipt-1',
        sourceClass: 'downstream-receipt',
        sourceDigest: digest1,
        observedAt: '2026-05-17T16:10:30.000Z',
        state: 'receipted',
        outcome: 'succeeded',
        consequenceEffect: 'bounded',
        confidence: 0.98,
        replayRefDigest: digest4,
        reasonCodes: ['receipt-succeeded', 'secret=must_not_escape'],
      },
      {
        eventId: 'review-1',
        sourceClass: 'reviewer-label',
        sourceDigest: digest2,
        observedAt: '2026-05-17T16:10:35.000Z',
        state: 'learned',
        outcome: 'succeeded',
        consequenceEffect: 'bounded',
        confidence: 0.9,
        reviewerRefDigest: digest5,
        actionItemDigests: [digestE],
      },
    ],
  });
  const serialized = JSON.stringify(feedback);

  equal(feedback.status, 'learning-ready', 'Outcome incident feedback: clean direct feedback is learning-ready');
  equal(feedback.assurancePacketReady, true, 'Outcome incident feedback: ready packet is carried');
  equal(feedback.summary.eventCount, 2, 'Outcome incident feedback: events are counted');
  equal(feedback.summary.directEvidenceCount, 2, 'Outcome incident feedback: direct evidence is counted');
  equal(feedback.summary.inferredSignalCount, 0, 'Outcome incident feedback: inferred signals are absent');
  equal(feedback.summary.terminalState, 'learned', 'Outcome incident feedback: terminal state is learned');
  equal(feedback.summary.highestConsequenceEffect, 'bounded', 'Outcome incident feedback: effect is bounded');
  equal(feedback.replayRegressionRequired, false, 'Outcome incident feedback: clean success does not require replay regression');
  equal(feedback.noGoReasons.length, 0, 'Outcome incident feedback: no no-go reasons for clean feedback');
  equal(feedback.feedbackInputOnly, true, 'Outcome incident feedback: feedback remains input-only');
  equal(feedback.automaticPolicyMutationAllowed, false, 'Outcome incident feedback: policy mutation remains blocked');
  equal(feedback.llmTrainingAllowed, false, 'Outcome incident feedback: model training remains blocked');
  equal(feedback.canAdmit, false, 'Outcome incident feedback: learning-ready cannot admit');
  equal(feedback.rawPayloadStored, false, 'Outcome incident feedback: raw payload storage is blocked');
  ok(feedback.digest.startsWith('sha256:'), 'Outcome incident feedback: digest is generated');
  ok(!serialized.includes('secret=must_not_escape'), 'Outcome incident feedback: unsafe reason code is dropped');
}

function testIncidentPathRequiresReviewAndReplay(): void {
  const feedback = createOutcomeIncidentFeedbackContract({
    assurancePacket: readyPacket(),
    generatedAt: '2026-05-17T16:12:00.000Z',
    feedbackEvents: [{
      eventId: 'incident-1',
      sourceClass: 'confirmed-incident',
      sourceDigest: digest1,
      observedAt: '2026-05-17T16:11:00.000Z',
      state: 'incident',
      outcome: 'failed',
      consequenceEffect: 'customer-impact',
      confidence: 1,
      incidentRefDigest: digest2,
      replayRefDigest: digest3,
      actionItemDigests: [digest4],
      reasonCodes: ['customer-impact'],
    }],
  });

  equal(feedback.status, 'incident-review-required', 'Outcome incident feedback: incident path requires incident review');
  equal(feedback.incidentReviewRequired, true, 'Outcome incident feedback: incident review flag is true');
  equal(feedback.replayRegressionRequired, true, 'Outcome incident feedback: incident requires replay regression');
  ok(
    feedback.replayTriggerReasons.includes('failed-downstream-outcome'),
    'Outcome incident feedback: failed outcome triggers replay',
  );
  ok(
    feedback.replayTriggerReasons.includes('confirmed-incident'),
    'Outcome incident feedback: confirmed incident triggers replay',
  );
  ok(
    feedback.noGoReasons.includes('replay-regression-required'),
    'Outcome incident feedback: replay no-go is retained',
  );
  ok(
    feedback.noGoReasons.includes('customer-impact-review-required'),
    'Outcome incident feedback: customer impact review no-go is retained',
  );
}

function testPostmortemRequiresDigestAndRegression(): void {
  const feedback = createOutcomeIncidentFeedbackContract({
    assurancePacket: readyPacket(),
    generatedAt: '2026-05-17T16:13:00.000Z',
    feedbackEvents: [{
      eventId: 'postmortem-1',
      sourceClass: 'operator-annotation',
      sourceDigest: digest1,
      observedAt: '2026-05-17T16:12:00.000Z',
      state: 'postmortem',
      outcome: 'reversed',
      consequenceEffect: 'tenant-impact',
      confidence: 0.95,
      incidentRefDigest: digest2,
      replayRefDigest: digest3,
      actionItemDigests: [digest4],
    }],
  });

  equal(feedback.status, 'incident-review-required', 'Outcome incident feedback: postmortem without digest requires review');
  ok(
    feedback.noGoReasons.includes('postmortem-without-postmortem-ref'),
    'Outcome incident feedback: missing postmortem digest is no-go',
  );
  ok(
    feedback.replayTriggerReasons.includes('postmortem-required'),
    'Outcome incident feedback: postmortem state triggers replay regression',
  );
}

function testRequestedMutationIsRecordedAndBlocked(): void {
  const feedback = createOutcomeIncidentFeedbackContract({
    assurancePacket: readyPacket(),
    generatedAt: '2026-05-17T16:14:00.000Z',
    feedbackEvents: [{
      eventId: 'mutation-1',
      sourceClass: 'reviewer-label',
      sourceDigest: digest1,
      observedAt: '2026-05-17T16:13:00.000Z',
      state: 'learned',
      outcome: 'succeeded',
      consequenceEffect: 'bounded',
      confidence: 0.8,
      requestedMutations: ['policy-update', 'model-training', 'enforcement-activation'],
    }],
  });

  equal(feedback.status, 'collecting-feedback', 'Outcome incident feedback: mutation request keeps feedback collecting');
  equal(feedback.summary.blockedMutationCount, 3, 'Outcome incident feedback: blocked mutations are counted');
  ok(
    feedback.blockedMutationRequests.includes('policy-update'),
    'Outcome incident feedback: policy update request is blocked',
  );
  ok(
    feedback.blockedMutationRequests.includes('model-training'),
    'Outcome incident feedback: model training request is blocked',
  );
  ok(
    feedback.noGoReasons.includes('blocked-mutation-requested'),
    'Outcome incident feedback: blocked mutation no-go is retained',
  );
}

function testOnlyInferredAndUnreadyPacketStayCollecting(): void {
  const feedback = createOutcomeIncidentFeedbackContract({
    assurancePacket: unreadyPacket(),
    generatedAt: '2026-05-17T16:15:00.000Z',
    feedbackEvents: [{
      eventId: 'inferred-1',
      sourceClass: 'inferred-signal',
      sourceDigest: digest1,
      observedAt: '2026-05-17T16:14:00.000Z',
      state: 'receipted',
      outcome: 'unknown',
      consequenceEffect: 'none',
      confidence: 0.4,
    }],
  });

  equal(feedback.status, 'collecting-feedback', 'Outcome incident feedback: inferred-only input stays collecting');
  equal(feedback.assurancePacketReady, false, 'Outcome incident feedback: unready packet is visible');
  ok(
    feedback.noGoReasons.includes('assurance-packet-not-ready'),
    'Outcome incident feedback: unready packet no-go is retained',
  );
  ok(
    feedback.noGoReasons.includes('only-inferred-feedback'),
    'Outcome incident feedback: inferred-only no-go is retained',
  );
}

function testNoFeedbackAndValidationFailures(): void {
  const empty = createOutcomeIncidentFeedbackContract({
    assurancePacket: readyPacket(),
    generatedAt: '2026-05-17T16:16:00.000Z',
    feedbackEvents: [],
  });

  equal(empty.status, 'no-feedback', 'Outcome incident feedback: empty input is no-feedback');
  ok(
    empty.noGoReasons.includes('no-feedback-events'),
    'Outcome incident feedback: no feedback no-go is retained',
  );
  rejects(
    () => createOutcomeIncidentFeedbackContract({
      assurancePacket: readyPacket(),
      feedbackEvents: [{
        eventId: 'bad-digest',
        sourceClass: 'downstream-receipt',
        sourceDigest: 'raw-receipt-id',
        observedAt: '2026-05-17T16:16:00.000Z',
        state: 'receipted',
        outcome: 'succeeded',
        consequenceEffect: 'bounded',
        confidence: 0.9,
      }],
    }),
    /sourceDigest must be a sha256 digest/u,
    'Outcome incident feedback: raw source id fails closed',
  );
  rejects(
    () => createOutcomeIncidentFeedbackContract({
      assurancePacket: readyPacket(),
      feedbackEvents: [{
        eventId: 'bad-confidence',
        sourceClass: 'downstream-receipt',
        sourceDigest: digest1,
        observedAt: '2026-05-17T16:16:00.000Z',
        state: 'receipted',
        outcome: 'succeeded',
        consequenceEffect: 'bounded',
        confidence: 1.1,
      }],
    }),
    /confidence must be between 0 and 1/u,
    'Outcome incident feedback: invalid confidence fails closed',
  );
}

function testDocsAndPackageScriptStayAligned(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'outcome-incident-feedback-contract.md',
  );
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '# Outcome And Incident Feedback Contract',
    'attestor.outcome-incident-feedback-contract.v1',
    'downstream-receipt',
    'confirmed-incident',
    'postmortem',
    'automaticPolicyMutationAllowed = false',
    'NIST SP 800-61 or NIST AI RMF conformance',
  ]) {
    includes(doc, expected, `Outcome incident feedback doc: records ${expected}`);
  }
  includes(
    overview,
    '| 09 | complete | Outcome and incident feedback contract |',
    'Outcome incident feedback overview: Step 09 is complete',
  );
  includes(
    overview,
    'src/consequence-admission/outcome-incident-feedback-contract.ts',
    'Outcome incident feedback overview: source file is indexed',
  );
  equal(
    packageJson.scripts['test:outcome-incident-feedback-contract'],
    'tsx tests/outcome-incident-feedback-contract.test.ts',
    'Outcome incident feedback: package script is registered',
  );
}

testDescriptorRecordsNoAuthorityAndSourceSeparation();
testPositiveDirectFeedbackBecomesLearningReadyOnly();
testIncidentPathRequiresReviewAndReplay();
testPostmortemRequiresDigestAndRegression();
testRequestedMutationIsRecordedAndBlocked();
testOnlyInferredAndUnreadyPacketStayCollecting();
testNoFeedbackAndValidationFailures();
testDocsAndPackageScriptStayAligned();

console.log(`Outcome and incident feedback contract tests: ${passed} passed, 0 failed`);
