import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  CALIBRATION_LOWER_BOUND_MIN_CONFIDENCE,
  CALIBRATION_LOWER_BOUND_RUNNER_VERSION,
  CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
  COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
  REVIEWER_OPEN_DEFEATER_MAX_QUESTIONS,
  REVIEWER_OPEN_DEFEATER_MAX_REASON_LINES,
  REVIEWER_OPEN_DEFEATER_VIEW_VERSION,
  createBaselineCohortCandidate,
  createBaselineCohortEvidence,
  createBaselineCohortSourceFromShadowEvent,
  createCalibrationLowerBoundRunner,
  createCandidateInvariantFromBaseline,
  createCanonicalShadowEvent,
  createCounterexampleMinimalWitness,
  createInvariantCalibrationRecord,
  createLearnedArtifactReleaseBudget,
  createReviewerOpenDefeaterView,
  createShadowDataQualityGate,
  reviewerOpenDefeaterViewDescriptor,
  synthesizeCandidateInvariantAssuranceCase,
  type BaselineCohortCandidate,
  type CalibrationLowerBoundRunnerRecord,
  type CandidateInvariant,
  type CandidateInvariantSynthesizerRecord,
  type CanonicalShadowEvent,
  type CounterexampleMinimalWitnessRecord,
  type CreateCanonicalShadowEventInput,
  type CreateCounterexampleMinimalWitnessInput,
  type CreateReviewerOpenDefeaterViewInput,
  type InvariantCalibrationRecord,
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

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const digestE = `sha256:${'e'.repeat(64)}`;
const digestF = `sha256:${'f'.repeat(64)}`;
const digest0 = `sha256:${'0'.repeat(64)}`;
const digest1 = `sha256:${'1'.repeat(64)}`;
const digest2 = `sha256:${'2'.repeat(64)}`;
const digest3 = `sha256:${'3'.repeat(64)}`;
const digest4 = `sha256:${'4'.repeat(64)}`;
const digest5 = `sha256:${'5'.repeat(64)}`;
const digest6 = `sha256:${'6'.repeat(64)}`;
const digest7 = `sha256:${'7'.repeat(64)}`;
const digest8 = `sha256:${'8'.repeat(64)}`;

function canonicalInput(
  suffix: string,
  overrides?: Partial<CreateCanonicalShadowEventInput>,
): CreateCanonicalShadowEventInput {
  return {
    occurredAt: `2026-05-18T14:00:0${suffix}.000Z`,
    observedAt: `2026-05-18T14:01:0${suffix}.000Z`,
    sourceKind: 'admission-shadow',
    producer: 'attestor.consequence-admission',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest: digestC,
      actionName: 'issue_refund',
      actionKind: 'api-operation',
      consequenceClass: 'financial',
      resourceRefDigest: digestD,
      dataClass: 'money-movement',
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: null,
    decision: {
      admissionDigest: digestE,
      mode: 'observe',
      shadowDecision: 'would_narrow',
      effectiveDecision: 'narrow',
      allowed: false,
      failClosed: true,
      reasonCodes: [`reviewer-open-defeater-view-${suffix}`],
    },
    outcome: {
      downstreamOutcome: null,
      humanOutcome: null,
    },
    evidenceRefs: [
      { kind: 'evidence', digest: digestE, origin: 'observed' },
      { kind: 'provenance', digest: digestF, origin: 'observed' },
    ],
    approvalRefs: [{ kind: 'approval', digest: digest0, origin: 'operator-supplied' }],
    receiptRefs: [{ kind: 'receipt', digest: digest1, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digestC, origin: 'observed' }],
    idempotencyRefDigest: digestD,
    replayRefDigest: digestE,
    traceRefDigest: digestF,
    schemaRefDigest: digest0,
    rawMaterialPolicy: 'digest-only',
    ...overrides,
  };
}

function event(
  suffix: string,
  overrides?: Partial<CreateCanonicalShadowEventInput>,
): CanonicalShadowEvent {
  return createCanonicalShadowEvent(canonicalInput(suffix, overrides));
}

function cohortCandidateFixture(): {
  readonly candidate: BaselineCohortCandidate;
  readonly events: readonly CanonicalShadowEvent[];
} {
  const events = [event('1'), event('2'), event('3')];
  const candidate = createBaselineCohortCandidate({
    cohortId: 'cohort:refunds:i07',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-18T14:02:00.000Z',
    sourceEvents: events.map((shadowEvent) =>
      createBaselineCohortSourceFromShadowEvent({
        event: shadowEvent,
        envelopeRefDigest: digest2,
        traceRefDigest: digestF,
      })),
    reviewerAffirmed: true,
    reviewerRefDigest: digestB,
  });
  return { candidate, events };
}

function invariantFor(
  candidate: BaselineCohortCandidate,
  overrides?: { readonly missingReviewer?: boolean },
): CandidateInvariant {
  return createCandidateInvariantFromBaseline({
    candidateId: 'candidate:refund-authority-evidence:i07',
    generatedAt: '2026-05-18T14:06:00.000Z',
    kind: 'authority-evidence-required',
    effect: 'strengthen-only',
    pattern: {
      templateKind: 'always',
      naturalLanguage: 'Refund create requests must include authority evidence.',
      formalShape: 'G(refund.create -> authorityEvidenceDigest.present)',
      parameters: {
        actionType: 'refund.create',
        evidenceKind: 'authority',
      },
    },
    scope: {
      tenantRefDigest: candidate.tenantRefDigest,
      baselineCohortRefDigest: candidate.cohortRefDigest,
      consequenceClass: 'financial',
      actionType: 'refund.create',
      appliesToPackFamilies: ['finance', 'general'],
    },
    baselineCohort: candidate,
    evidenceBases: ['baseline-cohort', 'counterexample-replay', 'operator-review'],
    evidenceRefDigests: [digestF],
    counterexampleReplayRefDigest: digestE,
    reviewerRefDigest: overrides?.missingReviewer ? null : digestF,
  });
}

function claimFixture(overrides?: {
  readonly missingCandidateReviewer?: boolean;
  readonly noAssuranceCase?: boolean;
}): {
  readonly candidateInvariant: CandidateInvariant;
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
} {
  const { candidate, events } = cohortCandidateFixture();
  const candidateInvariant = invariantFor(candidate, {
    missingReviewer: overrides?.missingCandidateReviewer,
  });
  const releaseBudget = createLearnedArtifactReleaseBudget({
    artifactId: 'learned-artifact:baseline-cohort-summary:i07',
    artifactKind: 'baseline-cohort-summary',
    artifactRefDigest: candidate.digest,
    tenantRefDigest: candidate.tenantRefDigest,
    cohortRefDigest: candidate.cohortRefDigest,
    generatedAt: '2026-05-18T14:03:00.000Z',
    requestedReleaseMode: 'assurance-review',
    sourceEventCount: candidate.sourceEventCount,
    minimumCohortEventCount: 3,
    privacyBudget: {
      budgetId: 'budget:tenant-a:i07',
      budgetRefDigest: digest3,
      tenantRefDigest: candidate.tenantRefDigest,
      cohortRefDigest: candidate.cohortRefDigest,
      totalBudgetUnits: 100,
      spentBudgetUnits: 5,
      requestedBudgetUnits: 5,
      expiresAt: '2026-06-18T14:00:00.000Z',
      accountingMode: 'release-budget-only',
      externalDpProofRefDigest: null,
    },
    reconstructionRisk: {
      riskLevel: 'low',
      reconstructionAttackConsidered: true,
      highResolutionPattern: false,
      uniqueSubjectRisk: false,
      frequentPatternCandidate: false,
      mitigationRefDigest: digest4,
    },
    assuranceCaseRefDigest: digest0,
    reviewerRefDigest: digest5,
  });
  const qualityGates = events.map((shadowEvent) =>
    createShadowDataQualityGate({
      event: shadowEvent,
      evaluatedAt: '2026-05-18T14:04:00.000Z',
      evaluatorRefDigest: digest1,
      assuranceCaseRefDigest: digest0,
      attacksNodeId: 'evidence:baseline-cohort:i07',
      trustedProducers: ['attestor.consequence-admission'],
    }));
  const baselineEvidence = createBaselineCohortEvidence({
    candidate,
    qualityGates,
    releaseBudget,
    assuranceCaseRefDigest: overrides?.noAssuranceCase ? null : digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T14:05:00.000Z',
  });
  const synthesizedClaim = synthesizeCandidateInvariantAssuranceCase({
    baselineEvidence,
    candidateInvariant,
    assuranceCaseRefDigest: overrides?.noAssuranceCase ? null : digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T14:07:00.000Z',
  });
  return { candidateInvariant, synthesizedClaim };
}

function calibrationFor(
  candidateInvariant: CandidateInvariant,
  overrides?: {
    readonly calibratedConfidence?: number;
    readonly sampleCount?: number;
    readonly reviewerRefDigest?: string | null;
  },
): InvariantCalibrationRecord {
  const sampleCount = overrides?.sampleCount ?? 100;
  return createInvariantCalibrationRecord({
    candidate: candidateInvariant,
    calibratedAt: '2026-05-18T14:08:00.000Z',
    method: 'platt-sigmoid',
    calibrationSetRefDigest: digest6,
    holdoutSetRefDigest: digest7,
    sampleCount,
    positiveLabelCount: Math.floor(sampleCount / 2),
    negativeLabelCount: sampleCount - Math.floor(sampleCount / 2),
    metrics: {
      expectedCalibrationError: 0.04,
      brierScore: 0.1,
      negativeLogLikelihood: 0.2,
      reliabilityBinCount: 10,
    },
    calibratedConfidence: overrides?.calibratedConfidence ?? 0.72,
    reviewerRefDigest: overrides?.reviewerRefDigest === undefined
      ? digest8
      : overrides.reviewerRefDigest,
  });
}

function witnessInput(
  synthesizedClaim: CandidateInvariantSynthesizerRecord,
  index: number,
  overrides?: Partial<CreateCounterexampleMinimalWitnessInput>,
): CreateCounterexampleMinimalWitnessInput {
  return {
    synthesizedClaim,
    witnessId: `witness:refund-authority-counterexample:i07:${index}`,
    witnessKind: 'cycle-witness',
    observedAt: `2026-05-18T14:09:${String(index).padStart(2, '0')}.000Z`,
    createdByRefDigest: digestB,
    sourceReplayDigest: digest6,
    replaySeedDigest: digest7,
    candidateInvariantDigest: synthesizedClaim.candidateInvariantDigest,
    invariantRefDigest: synthesizedClaim.invariantRefDigest,
    tenantRefDigest: synthesizedClaim.tenantRefDigest,
    cohortRefDigest: synthesizedClaim.cohortRefDigest,
    traceRefDigests: [digestF],
    eventRefDigests: [digestA, digestB],
    counterexampleRefDigests: [digestC],
    minimalityMethod: 'cycle-reduction',
    originalStepCount: 7 + index,
    minimalStepCount: 3,
    removedStepCount: 4 + index,
    reproducesViolation: true,
    ...overrides,
  };
}

function witnessFor(
  synthesizedClaim: CandidateInvariantSynthesizerRecord,
  index = 1,
  overrides?: Partial<CreateCounterexampleMinimalWitnessInput>,
): CounterexampleMinimalWitnessRecord {
  return createCounterexampleMinimalWitness(
    witnessInput(synthesizedClaim, index, overrides),
  );
}

function calibrationRunnerFor(input: {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly calibration: InvariantCalibrationRecord;
  readonly witnesses: readonly CounterexampleMinimalWitnessRecord[];
  readonly lowerBoundConfidence: number;
  readonly runnerId?: string;
}): CalibrationLowerBoundRunnerRecord {
  return createCalibrationLowerBoundRunner({
    synthesizedClaim: input.synthesizedClaim,
    calibration: input.calibration,
    counterexampleWitnesses: input.witnesses,
    runnerId: input.runnerId ?? 'calibration-lower-bound:refund-authority:i07',
    evaluatedAt: '2026-05-18T14:10:00.000Z',
    createdByRefDigest: digestB,
    method: 'eb05-style-lower-bound',
    confidenceLevel: 0.9,
    lowerBoundConfidence: input.lowerBoundConfidence,
    minimumLowerBoundConfidence: CALIBRATION_LOWER_BOUND_MIN_CONFIDENCE,
  });
}

function readyReviewInput(): CreateReviewerOpenDefeaterViewInput {
  const { candidateInvariant, synthesizedClaim } = claimFixture();
  const calibration = calibrationFor(candidateInvariant);
  const nonOpenWitness = witnessFor(synthesizedClaim, 1, {
    reproducesViolation: false,
  });
  const run = calibrationRunnerFor({
    synthesizedClaim,
    calibration,
    witnesses: [nonOpenWitness],
    lowerBoundConfidence: 0.66,
  });
  return {
    synthesizedClaim,
    counterexampleWitnesses: [nonOpenWitness],
    calibrationRuns: [run],
    packetId: 'reviewer-open-defeater-view:i07:ready',
    generatedAt: '2026-05-18T14:11:00.000Z',
    createdByRefDigest: digestB,
    reviewerRefDigest: digest8,
  };
}

function openDefeaterReviewInput(): CreateReviewerOpenDefeaterViewInput {
  const { candidateInvariant, synthesizedClaim } = claimFixture();
  const calibration = calibrationFor(candidateInvariant);
  const openWitness = witnessFor(synthesizedClaim, 1);
  const nonOpenWitness = witnessFor(synthesizedClaim, 2, {
    reproducesViolation: false,
  });
  const weakRun = calibrationRunnerFor({
    synthesizedClaim,
    calibration,
    witnesses: [nonOpenWitness],
    lowerBoundConfidence: 0.42,
    runnerId: 'calibration-lower-bound:refund-authority:i07:weak',
  });
  return {
    synthesizedClaim,
    counterexampleWitnesses: [openWitness],
    calibrationRuns: [weakRun],
    packetId: 'reviewer-open-defeater-view:i07:open',
    generatedAt: '2026-05-18T14:11:00.000Z',
    createdByRefDigest: digestB,
    reviewerRefDigest: digest8,
  };
}

function testDescriptorRecordsBoundaries(): void {
  const descriptor = reviewerOpenDefeaterViewDescriptor();

  equal(descriptor.version, REVIEWER_OPEN_DEFEATER_VIEW_VERSION, 'Reviewer open-defeater view: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Reviewer open-defeater view: binds assurance case');
  equal(descriptor.candidateInvariantSynthesizerVersion, CANDIDATE_INVARIANT_SYNTHESIZER_VERSION, 'Reviewer open-defeater view: binds synthesizer');
  equal(descriptor.counterexampleMinimalWitnessVersion, COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION, 'Reviewer open-defeater view: binds counterexample witness');
  equal(descriptor.calibrationLowerBoundRunnerVersion, CALIBRATION_LOWER_BOUND_RUNNER_VERSION, 'Reviewer open-defeater view: binds calibration runner');
  equal(descriptor.maxReasonLines, REVIEWER_OPEN_DEFEATER_MAX_REASON_LINES, 'Reviewer open-defeater view: max reason lines are bounded');
  equal(descriptor.maxQuestions, REVIEWER_OPEN_DEFEATER_MAX_QUESTIONS, 'Reviewer open-defeater view: max questions are bounded');
  ok(descriptor.sourceAnchors.includes('microsoft-human-ai-guidelines-explanation-and-uncertainty'), 'Reviewer open-defeater view: Microsoft HAI anchor is present');
  ok(descriptor.sourceAnchors.includes('google-pair-human-ai-mental-models'), 'Reviewer open-defeater view: Google PAIR anchor is present');
  ok(descriptor.sourceAnchors.includes('github-code-scanning-dismissal-reasons'), 'Reviewer open-defeater view: GitHub triage anchor is present');
  ok(descriptor.sourceAnchors.includes('gsn-open-defeater-render-view'), 'Reviewer open-defeater view: GSN anchor is present');
  equal(descriptor.rendersOpenDefeatersOnly, true, 'Reviewer open-defeater view: renders open defeat only');
  equal(descriptor.digestOnly, true, 'Reviewer open-defeater view: descriptor is digest-only');
  equal(descriptor.noRawEvidence, true, 'Reviewer open-defeater view: raw evidence is forbidden');
  equal(descriptor.noReviewerDecision, true, 'Reviewer open-defeater view: reviewer decision is forbidden');
  equal(descriptor.noDefeaterClosure, true, 'Reviewer open-defeater view: closure is forbidden');
  equal(descriptor.noPromotion, true, 'Reviewer open-defeater view: promotion is forbidden');
  equal(descriptor.canAdmit, false, 'Reviewer open-defeater view: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Reviewer open-defeater view: descriptor cannot enforce');
  ok(descriptor.nonClaims.includes('not-reviewer-ui'), 'Reviewer open-defeater view: reviewer UI is a non-claim');
}

function testOpenDefeatersRenderBoundedReviewPacket(): void {
  const record = createReviewerOpenDefeaterView(openDefeaterReviewInput());

  equal(record.version, REVIEWER_OPEN_DEFEATER_VIEW_VERSION, 'Reviewer open-defeater view: record version is explicit');
  equal(record.outcome, 'reviewer-view-ready-with-open-defeaters', 'Reviewer open-defeater view: open material is ready for reviewer');
  equal(record.readyForReviewer, true, 'Reviewer open-defeater view: ready for reviewer is true');
  equal(record.readyForPromotionGateInput, false, 'Reviewer open-defeater view: open defeat is not promotion input');
  equal(record.openDefeaterCount, 2, 'Reviewer open-defeater view: two open defeat lines are detected');
  equal(record.visibleOpenDefeaterCount, 2, 'Reviewer open-defeater view: both open lines are visible');
  equal(record.truncatedOpenDefeaterCount, 0, 'Reviewer open-defeater view: no truncation is needed');
  equal(record.reasonLines[0]?.priority, 'rebutting-counterexample', 'Reviewer open-defeater view: rebutting counterexample appears first');
  equal(record.reasonLines[1]?.priority, 'undercutting-calibration', 'Reviewer open-defeater view: undercutting calibration appears second');
  equal(record.questions.length, 2, 'Reviewer open-defeater view: one bounded question per visible line');
  ok(record.questions.every((question) => question.promptCode === 'resolve-open-defeater'), 'Reviewer open-defeater view: questions are resolution prompts');
  equal(record.openDefeatersOnly, true, 'Reviewer open-defeater view: only open defeat is rendered');
  equal(record.digestOnly, true, 'Reviewer open-defeater view: output is digest-only');
  equal(record.noRawEvidence, true, 'Reviewer open-defeater view: raw evidence is absent');
  equal(record.noReviewerDecision, true, 'Reviewer open-defeater view: no reviewer decision is recorded');
  equal(record.noDefeaterClosure, true, 'Reviewer open-defeater view: no defeater closure is recorded');
  equal(record.noPromotion, true, 'Reviewer open-defeater view: no promotion is recorded');
  equal(record.canAdmit, false, 'Reviewer open-defeater view: record cannot admit');
  equal(record.activatesEnforcement, false, 'Reviewer open-defeater view: record cannot enforce');
  ok(record.digest.startsWith('sha256:'), 'Reviewer open-defeater view: record has digest');
}

function testNoOpenDefeatersCanFeedPromotionGate(): void {
  const record = createReviewerOpenDefeaterView(readyReviewInput());

  equal(record.outcome, 'reviewer-view-ready-no-open-defeaters', 'Reviewer open-defeater view: no open defeat is explicit');
  equal(record.openDefeaterCount, 0, 'Reviewer open-defeater view: open count is zero');
  equal(record.reasonLines.length, 0, 'Reviewer open-defeater view: no reason lines are rendered');
  equal(record.questions.length, 0, 'Reviewer open-defeater view: no questions are rendered');
  equal(record.readyForReviewer, true, 'Reviewer open-defeater view: no-open state is reviewer-ready');
  equal(record.readyForPromotionGateInput, true, 'Reviewer open-defeater view: no-open state can feed promotion gate');
  ok(record.reasonCodes.includes('reviewer-open-defeater-view-no-open-defeaters'), 'Reviewer open-defeater view: no-open reason code is present');
}

function testHeldAndRejectedBoundaries(): void {
  const ready = readyReviewInput();
  const missing = createReviewerOpenDefeaterView({
    ...ready,
    counterexampleWitnesses: [],
    calibrationRuns: [],
    packetId: 'reviewer-open-defeater-view:i07:missing',
  });
  const unbound = claimFixture({ noAssuranceCase: true });
  const noCase = createReviewerOpenDefeaterView({
    synthesizedClaim: unbound.synthesizedClaim,
    counterexampleWitnesses: [],
    calibrationRuns: [],
    packetId: 'reviewer-open-defeater-view:i07:no-case',
    generatedAt: '2026-05-18T14:11:00.000Z',
    createdByRefDigest: digestB,
  });
  const rawRejected = createReviewerOpenDefeaterView({
    ...ready,
    packetId: 'reviewer-open-defeater-view:i07:raw-rejected',
    rawEvidenceRequested: true,
  });
  const authorityRejected = createReviewerOpenDefeaterView({
    ...ready,
    packetId: 'reviewer-open-defeater-view:i07:authority-rejected',
    authorityActionRequested: true,
  });

  equal(missing.outcome, 'reviewer-view-held-for-review-material', 'Reviewer open-defeater view: missing source material holds');
  ok(missing.dangerFlags.includes('missing-review-material'), 'Reviewer open-defeater view: missing-material flag is present');
  equal(noCase.outcome, 'reviewer-view-held-for-assurance-case', 'Reviewer open-defeater view: missing assurance case holds');
  ok(noCase.dangerFlags.includes('assurance-case-unbound'), 'Reviewer open-defeater view: assurance case flag is present');
  equal(rawRejected.outcome, 'reviewer-view-rejected-boundary', 'Reviewer open-defeater view: raw evidence request is rejected');
  ok(rawRejected.dangerFlags.includes('raw-evidence-requested'), 'Reviewer open-defeater view: raw evidence flag is present');
  equal(authorityRejected.outcome, 'reviewer-view-rejected-boundary', 'Reviewer open-defeater view: authority request is rejected');
  ok(authorityRejected.dangerFlags.includes('authority-action-requested'), 'Reviewer open-defeater view: authority flag is present');
}

function testFailClosedBindingMismatch(): void {
  const input = openDefeaterReviewInput();
  const mismatchedWitness = {
    ...input.counterexampleWitnesses[0],
    tenantRefDigest: digestC,
  } as CounterexampleMinimalWitnessRecord;
  const mismatchedRun = {
    ...input.calibrationRuns[0],
    cohortRefDigest: digestC,
  } as CalibrationLowerBoundRunnerRecord;

  throws(
    () => createReviewerOpenDefeaterView({
      ...input,
      counterexampleWitnesses: [mismatchedWitness],
    }),
    /witness tenant mismatch/u,
    'Reviewer open-defeater view: witness tenant mismatch fails closed',
  );
  throws(
    () => createReviewerOpenDefeaterView({
      ...input,
      calibrationRuns: [mismatchedRun],
    }),
    /calibration cohort mismatch/u,
    'Reviewer open-defeater view: calibration cohort mismatch fails closed',
  );
}

function testTruncationAndQuestionCap(): void {
  const { synthesizedClaim } = claimFixture();
  const witnesses = Array.from({ length: 9 }, (_, index) =>
    witnessFor(synthesizedClaim, index + 1));
  const record = createReviewerOpenDefeaterView({
    synthesizedClaim,
    counterexampleWitnesses: witnesses,
    calibrationRuns: [],
    packetId: 'reviewer-open-defeater-view:i07:truncated',
    generatedAt: '2026-05-18T14:11:00.000Z',
    createdByRefDigest: digestB,
  });
  const limited = createReviewerOpenDefeaterView({
    synthesizedClaim,
    counterexampleWitnesses: witnesses,
    calibrationRuns: [],
    packetId: 'reviewer-open-defeater-view:i07:limited',
    generatedAt: '2026-05-18T14:11:00.000Z',
    createdByRefDigest: digestB,
    maxReasonLines: 2,
    maxQuestions: 1,
  });

  equal(record.openDefeaterCount, 9, 'Reviewer open-defeater view: all open defeat lines are counted');
  equal(record.visibleOpenDefeaterCount, REVIEWER_OPEN_DEFEATER_MAX_REASON_LINES, 'Reviewer open-defeater view: visible lines are capped at seven');
  equal(record.questions.length, REVIEWER_OPEN_DEFEATER_MAX_QUESTIONS, 'Reviewer open-defeater view: questions are capped at three');
  equal(record.truncatedOpenDefeaterCount, 2, 'Reviewer open-defeater view: truncation count is retained');
  ok(record.dangerFlags.includes('open-defeater-view-truncated'), 'Reviewer open-defeater view: truncation flag is present');
  equal(limited.visibleOpenDefeaterCount, 2, 'Reviewer open-defeater view: caller can lower visible reason cap');
  equal(limited.questions.length, 1, 'Reviewer open-defeater view: caller can lower question cap');
}

function testDeterminismAndNoMutation(): void {
  const input = openDefeaterReviewInput();
  const before = JSON.stringify(input);
  const first = createReviewerOpenDefeaterView(input);
  const second = createReviewerOpenDefeaterView(input);

  equal(first.digest, second.digest, 'Reviewer open-defeater view: identical input yields identical digest');
  equal(JSON.stringify(input), before, 'Reviewer open-defeater view: input is not mutated');
  ok(Object.isFrozen(first), 'Reviewer open-defeater view: output is frozen');
}

function testDocsPackageOverviewAndProbe(): void {
  const docs = readProjectFile(
    'docs',
    '02-architecture',
    'reviewer-open-defeater-view.md',
  );
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const annex = readProjectFile('docs', 'research', 'cross-domain-pattern-sources.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile(
    'scripts',
    'probe',
    'probe-consequence-admission-package-surface.mjs',
  );

  for (const expected of [
    '# Reviewer Open Defeater View',
    'I07',
    'Microsoft Human-AI Interaction Guidelines',
    'Google People + AI Guidebook',
    'GitHub code scanning alert resolution',
    'GSN',
    'max 7 reason lines',
    'max 3 questions',
    'not-reviewer-ui',
    'not-defeater-closure',
    'not-live-enforcement',
  ]) {
    includes(docs, expected, `Reviewer open-defeater docs: records ${expected}`);
  }

  includes(overview, 'Progress: 14/14 complete after I13. 0 steps remain.', 'Overview: progress is updated');
  includes(overview, '| I07 | complete | Reviewer Packet / Open Defeater View |', 'Overview: I07 is complete');
  includes(overview, 'src/consequence-admission/reviewer-open-defeater-view.ts', 'Overview: I07 source file is tracked');
  includes(overview, 'tests/reviewer-open-defeater-view.test.ts', 'Overview: I07 test file is tracked');
  includes(overview, 'I07 turns I05 and I06 open defeaters into', 'Overview: I07 explanation is present');
  includes(annex, 'Reviewer open-defeater view', 'Research annex: I07 anchor is present');
  includes(annex, 'GitHub code scanning alert resolution', 'Research annex: GitHub triage anchor is present');
  includes(annex, 'Reviewer packets should render open defeaters only', 'Research annex: I07 translation rule is present');
  includes(ledger, 'docs/02-architecture/reviewer-open-defeater-view.md', 'Research ledger: I07 doc is indexed');
  equal(
    packageJson.scripts['test:reviewer-open-defeater-view'],
    'tsx tests/reviewer-open-defeater-view.test.ts',
    'Reviewer open-defeater view: package script is registered',
  );
  includes(packageProbe, 'REVIEWER_OPEN_DEFEATER_VIEW_VERSION', 'Package probe: I07 version is checked');
}

testDescriptorRecordsBoundaries();
testOpenDefeatersRenderBoundedReviewPacket();
testNoOpenDefeatersCanFeedPromotionGate();
testHeldAndRejectedBoundaries();
testFailClosedBindingMismatch();
testTruncationAndQuestionCap();
testDeterminismAndNoMutation();
testDocsPackageOverviewAndProbe();

console.log(`Reviewer open-defeater view tests: ${passed} passed, 0 failed`);
