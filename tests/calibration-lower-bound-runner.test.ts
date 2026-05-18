import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  CALIBRATION_LOWER_BOUND_MIN_CONFIDENCE,
  CALIBRATION_LOWER_BOUND_RUNNER_VERSION,
  CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
  COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
  INVARIANT_CALIBRATION_CONTRACT_VERSION,
  calibrationLowerBoundRunnerDescriptor,
  createBaselineCohortCandidate,
  createBaselineCohortEvidence,
  createBaselineCohortSourceFromShadowEvent,
  createCalibrationLowerBoundRunner,
  createCandidateInvariantFromBaseline,
  createCanonicalShadowEvent,
  createCounterexampleMinimalWitness,
  createInvariantCalibrationRecord,
  createLearnedArtifactReleaseBudget,
  createShadowDataQualityGate,
  synthesizeCandidateInvariantAssuranceCase,
  type BaselineCohortCandidate,
  type CalibrationLowerBoundRunnerRecord,
  type CandidateInvariant,
  type CandidateInvariantSynthesizerRecord,
  type CanonicalShadowEvent,
  type CounterexampleMinimalWitnessRecord,
  type CreateCalibrationLowerBoundRunnerInput,
  type CreateCanonicalShadowEventInput,
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
    occurredAt: `2026-05-18T13:00:0${suffix}.000Z`,
    observedAt: `2026-05-18T13:01:0${suffix}.000Z`,
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
      reasonCodes: [`calibration-lower-bound-${suffix}`],
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

function event(suffix: string, overrides?: Partial<CreateCanonicalShadowEventInput>):
  CanonicalShadowEvent {
  return createCanonicalShadowEvent(canonicalInput(suffix, overrides));
}

function cohortCandidateFixture(): {
  readonly candidate: BaselineCohortCandidate;
  readonly events: readonly CanonicalShadowEvent[];
} {
  const events = [event('1'), event('2'), event('3')];
  const candidate = createBaselineCohortCandidate({
    cohortId: 'cohort:refunds:i06',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-18T13:02:00.000Z',
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
    candidateId: 'candidate:refund-authority-evidence:i06',
    generatedAt: '2026-05-18T13:06:00.000Z',
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
    artifactId: 'learned-artifact:baseline-cohort-summary:i06',
    artifactKind: 'baseline-cohort-summary',
    artifactRefDigest: candidate.digest,
    tenantRefDigest: candidate.tenantRefDigest,
    cohortRefDigest: candidate.cohortRefDigest,
    generatedAt: '2026-05-18T13:03:00.000Z',
    requestedReleaseMode: 'assurance-review',
    sourceEventCount: candidate.sourceEventCount,
    minimumCohortEventCount: 3,
    privacyBudget: {
      budgetId: 'budget:tenant-a:i06',
      budgetRefDigest: digest3,
      tenantRefDigest: candidate.tenantRefDigest,
      cohortRefDigest: candidate.cohortRefDigest,
      totalBudgetUnits: 100,
      spentBudgetUnits: 5,
      requestedBudgetUnits: 5,
      expiresAt: '2026-06-18T13:00:00.000Z',
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
      evaluatedAt: '2026-05-18T13:04:00.000Z',
      evaluatorRefDigest: digest1,
      assuranceCaseRefDigest: digest0,
      attacksNodeId: 'evidence:baseline-cohort:i06',
      trustedProducers: ['attestor.consequence-admission'],
    }));
  const baselineEvidence = createBaselineCohortEvidence({
    candidate,
    qualityGates,
    releaseBudget,
    assuranceCaseRefDigest: overrides?.noAssuranceCase ? null : digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T13:05:00.000Z',
  });
  const synthesizedClaim = synthesizeCandidateInvariantAssuranceCase({
    baselineEvidence,
    candidateInvariant,
    assuranceCaseRefDigest: overrides?.noAssuranceCase ? null : digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T13:07:00.000Z',
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
    calibratedAt: '2026-05-18T13:08:00.000Z',
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

function witnessFor(
  synthesizedClaim: CandidateInvariantSynthesizerRecord,
  overrides?: {
    readonly reproducesViolation?: boolean;
    readonly originalStepCount?: number;
    readonly minimalStepCount?: number;
    readonly removedStepCount?: number;
  },
): CounterexampleMinimalWitnessRecord {
  return createCounterexampleMinimalWitness({
    synthesizedClaim,
    witnessId: 'witness:refund-authority-counterexample:i06',
    witnessKind: 'cycle-witness',
    observedAt: '2026-05-18T13:09:00.000Z',
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
    originalStepCount: overrides?.originalStepCount ?? 7,
    minimalStepCount: overrides?.minimalStepCount ?? 3,
    removedStepCount: overrides?.removedStepCount ?? 4,
    reproducesViolation: overrides?.reproducesViolation ?? false,
  });
}

function runnerInput(
  synthesizedClaim: CandidateInvariantSynthesizerRecord,
  calibration: InvariantCalibrationRecord,
  witnesses: readonly CounterexampleMinimalWitnessRecord[],
  overrides?: Partial<CreateCalibrationLowerBoundRunnerInput>,
): CreateCalibrationLowerBoundRunnerInput {
  return {
    synthesizedClaim,
    calibration,
    counterexampleWitnesses: witnesses,
    runnerId: 'calibration-lower-bound:refund-authority:i06',
    evaluatedAt: '2026-05-18T13:10:00.000Z',
    createdByRefDigest: digestB,
    method: 'eb05-style-lower-bound',
    confidenceLevel: 0.9,
    lowerBoundConfidence: 0.66,
    minimumLowerBoundConfidence: CALIBRATION_LOWER_BOUND_MIN_CONFIDENCE,
    ...overrides,
  };
}

function readyRunner(): CalibrationLowerBoundRunnerRecord {
  const { candidateInvariant, synthesizedClaim } = claimFixture();
  const calibration = calibrationFor(candidateInvariant);
  const witness = witnessFor(synthesizedClaim);
  return createCalibrationLowerBoundRunner(
    runnerInput(synthesizedClaim, calibration, [witness]),
  );
}

function testDescriptorRecordsBoundaries(): void {
  const descriptor = calibrationLowerBoundRunnerDescriptor();

  equal(descriptor.version, CALIBRATION_LOWER_BOUND_RUNNER_VERSION, 'Calibration lower bound: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Calibration lower bound: binds assurance case');
  equal(descriptor.candidateInvariantSynthesizerVersion, CANDIDATE_INVARIANT_SYNTHESIZER_VERSION, 'Calibration lower bound: binds synthesizer');
  equal(descriptor.invariantCalibrationContractVersion, INVARIANT_CALIBRATION_CONTRACT_VERSION, 'Calibration lower bound: binds calibration contract');
  equal(descriptor.counterexampleMinimalWitnessVersion, COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION, 'Calibration lower bound: binds counterexample witness');
  ok(descriptor.sourceAnchors.includes('fda-mgps-eb05-lower-bound'), 'Calibration lower bound: FDA EB05 anchor is present');
  ok(descriptor.sourceAnchors.includes('nist-measurement-uncertainty'), 'Calibration lower bound: NIST uncertainty anchor is present');
  ok(descriptor.sourceAnchors.includes('sklearn-probability-calibration'), 'Calibration lower bound: sklearn calibration anchor is present');
  equal(descriptor.requiresLowerBound, true, 'Calibration lower bound: lower bound is required');
  equal(descriptor.pointEstimateAuthorityAllowed, false, 'Calibration lower bound: point estimate authority is forbidden');
  equal(descriptor.lowerBoundAuthorityAllowed, false, 'Calibration lower bound: lower bound authority is forbidden');
  equal(descriptor.measurementMutationAllowed, false, 'Calibration lower bound: measurement mutation is forbidden');
  equal(descriptor.noAutoPromotion, true, 'Calibration lower bound: auto-promotion is forbidden');
  equal(descriptor.canAdmit, false, 'Calibration lower bound: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Calibration lower bound: descriptor cannot enforce');
}

function testReadyLowerBoundCreatesEvidenceNode(): void {
  const record = readyRunner();

  equal(record.version, CALIBRATION_LOWER_BOUND_RUNNER_VERSION, 'Calibration lower bound: record version is explicit');
  equal(record.outcome, 'lower-bound-ready-for-promotion-review', 'Calibration lower bound: clean lower bound is ready');
  equal(record.readyForPromotionReview, true, 'Calibration lower bound: ready flag is true');
  equal(record.evidenceNode?.kind, 'evidence', 'Calibration lower bound: evidence node is created');
  equal(record.undercuttingDefeater, null, 'Calibration lower bound: clean record opens no defeater');
  equal(record.pointConfidence, 0.72, 'Calibration lower bound: point confidence is retained');
  equal(record.lowerBoundConfidence, 0.66, 'Calibration lower bound: lower bound is retained');
  equal(record.minimumLowerBoundConfidence, 0.6, 'Calibration lower bound: threshold is retained');
  equal(record.counterexampleWitnessCount, 1, 'Calibration lower bound: witness count is retained');
  equal(record.openCounterexampleDefeaterCount, 0, 'Calibration lower bound: no open witness defeater');
  equal(record.pointEstimateAuthorityAllowed, false, 'Calibration lower bound: point estimate cannot be authority');
  equal(record.lowerBoundAuthorityAllowed, false, 'Calibration lower bound: lower bound cannot be authority');
  equal(record.noPolicyActivation, true, 'Calibration lower bound: policy activation is forbidden');
  equal(record.canAdmit, false, 'Calibration lower bound: record cannot admit');
  equal(record.activatesEnforcement, false, 'Calibration lower bound: record cannot enforce');
  ok(record.digest.startsWith('sha256:'), 'Calibration lower bound: record has digest');
}

function testWeakLowerBoundOpensUndercuttingDefeater(): void {
  const { candidateInvariant, synthesizedClaim } = claimFixture();
  const calibration = calibrationFor(candidateInvariant);
  const witness = witnessFor(synthesizedClaim);
  const record = createCalibrationLowerBoundRunner(
    runnerInput(synthesizedClaim, calibration, [witness], {
      lowerBoundConfidence: 0.42,
    }),
  );

  equal(record.outcome, 'held-for-lower-bound-threshold', 'Calibration lower bound: weak lower bound holds');
  ok(record.dangerFlags.includes('lower-bound-below-threshold'), 'Calibration lower bound: threshold flag is present');
  equal(record.undercuttingDefeater?.kind, 'undercutting', 'Calibration lower bound: undercutting defeater is created');
  equal(record.undercuttingDefeater?.state, 'open', 'Calibration lower bound: defeater is open');
  equal(record.undercuttingDefeater?.attacksNodeId, synthesizedClaim.strategyNode?.nodeId, 'Calibration lower bound: defeater attacks strategy node');
  equal(record.defeaterTransition?.transitionKind, 'open-defeater', 'Calibration lower bound: open-defeater transition exists');
  equal(record.evidenceNode, null, 'Calibration lower bound: weak lower bound creates no positive evidence node');
}

function testHeldStatesCreateNoPositiveEvidence(): void {
  const unready = claimFixture({ missingCandidateReviewer: true });
  const clean = claimFixture();
  const cleanCalibration = calibrationFor(clean.candidateInvariant);
  const cleanWitness = witnessFor(clean.synthesizedClaim);
  const unreadyRecord = createCalibrationLowerBoundRunner(
    runnerInput(
      unready.synthesizedClaim,
      calibrationFor(unready.candidateInvariant),
      [witnessFor(unready.synthesizedClaim)],
    ),
  );
  const calibrationHold = createCalibrationLowerBoundRunner(
    runnerInput(
      clean.synthesizedClaim,
      calibrationFor(clean.candidateInvariant, { sampleCount: 10 }),
      [cleanWitness],
    ),
  );
  const noWitness = createCalibrationLowerBoundRunner(
    runnerInput(clean.synthesizedClaim, cleanCalibration, []),
  );
  const openCounterexample = createCalibrationLowerBoundRunner(
    runnerInput(clean.synthesizedClaim, cleanCalibration, [
      witnessFor(clean.synthesizedClaim, { reproducesViolation: true }),
    ]),
  );

  equal(unreadyRecord.outcome, 'held-for-assurance-case', 'Calibration lower bound: unready synthesized claim without nodes holds at assurance-case boundary');
  equal(unreadyRecord.evidenceNode, null, 'Calibration lower bound: unready claim creates no evidence node');
  equal(calibrationHold.outcome, 'held-for-calibration-readiness', 'Calibration lower bound: unready calibration holds');
  ok(calibrationHold.dangerFlags.includes('calibration-not-ready'), 'Calibration lower bound: calibration flag is present');
  equal(noWitness.outcome, 'held-for-counterexample-evidence', 'Calibration lower bound: missing witness holds');
  ok(noWitness.dangerFlags.includes('missing-counterexample-witness'), 'Calibration lower bound: missing witness flag is present');
  equal(openCounterexample.outcome, 'held-for-open-counterexample-defeater', 'Calibration lower bound: open counterexample holds');
  ok(openCounterexample.dangerFlags.includes('open-counterexample-defeater-present'), 'Calibration lower bound: open counterexample flag is present');
}

function testAuthorityAndMismatchFailClosed(): void {
  const clean = claimFixture();
  const calibration = calibrationFor(clean.candidateInvariant);
  const witness = witnessFor(clean.synthesizedClaim);

  const authority = createCalibrationLowerBoundRunner(
    runnerInput(clean.synthesizedClaim, calibration, [witness], {
      authorityConfidenceRequested: true,
    }),
  );
  equal(authority.outcome, 'rejected-authority-confidence', 'Calibration lower bound: authority confidence is rejected');
  ok(authority.dangerFlags.includes('authority-confidence-requested'), 'Calibration lower bound: authority flag is present');
  equal(authority.canAdmit, false, 'Calibration lower bound: rejected authority still cannot admit');

  throws(
    () => createCalibrationLowerBoundRunner(
      runnerInput(clean.synthesizedClaim, calibration, [witness], {
        lowerBoundConfidence: 0.8,
      }),
    ),
    /lowerBoundConfidence must not exceed/u,
    'Calibration lower bound: lower bound above point estimate fails closed',
  );
  throws(
    () => createCalibrationLowerBoundRunner(
      runnerInput(clean.synthesizedClaim, calibration, [{
        ...witness,
        tenantRefDigest: digestC,
      }]),
    ),
    /witness tenant mismatch/u,
    'Calibration lower bound: witness tenant mismatch fails closed',
  );

  const other = claimFixture();
  const otherCalibration = calibrationFor(other.candidateInvariant, {
    calibratedConfidence: 0.7,
  });
  throws(
    () => createCalibrationLowerBoundRunner(
      runnerInput(clean.synthesizedClaim, {
        ...otherCalibration,
        candidateInvariantDigest: digestC,
      }, [witness]),
    ),
    /candidate and calibration record must bind the same invariant/u,
    'Calibration lower bound: calibration mismatch fails closed',
  );
}

function testDeterminismAndNoMutation(): void {
  const clean = claimFixture();
  const calibration = calibrationFor(clean.candidateInvariant);
  const witness = witnessFor(clean.synthesizedClaim);
  const input = runnerInput(clean.synthesizedClaim, calibration, [witness]);
  const before = JSON.stringify(input);
  const first = createCalibrationLowerBoundRunner(input);
  const second = createCalibrationLowerBoundRunner(input);

  equal(first.digest, second.digest, 'Calibration lower bound: identical input yields identical digest');
  equal(JSON.stringify(input), before, 'Calibration lower bound: input is not mutated');
  ok(Object.isFrozen(first), 'Calibration lower bound: output is frozen');
}

function testDocsPackageOverviewAndProbe(): void {
  const docs = readProjectFile(
    'docs',
    '02-architecture',
    'calibration-lower-bound-runner.md',
  );
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const annex = readProjectFile('docs', 'research', 'cross-domain-pattern-sources.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile(
    'scripts',
    'probe-consequence-admission-package-surface.mjs',
  );

  for (const expected of [
    '# Calibration Lower-Bound Runner',
    'I06',
    'FDA',
    'EB05',
    'NIST',
    'scikit-learn',
    'not-point-estimate-authority',
    'not-lower-bound-authority',
    'not-live-enforcement',
  ]) {
    includes(docs, expected, `Calibration lower bound docs: records ${expected}`);
  }

  includes(overview, 'Progress: 13/14 complete after I12. 1 step remains.', 'Overview: progress is updated');
  includes(overview, '| I06 | complete | Calibration Lower-Bound Runner |', 'Overview: I06 is complete');
  includes(overview, 'src/consequence-admission/calibration-lower-bound-runner.ts', 'Overview: I06 source file is tracked');
  includes(overview, 'tests/calibration-lower-bound-runner.test.ts', 'Overview: I06 test file is tracked');
  includes(overview, 'I06 turns W11 calibration records into', 'Overview: I06 explanation is present');
  includes(annex, 'Calibration lower-bound runner', 'Research annex: I06 anchor is present');
  includes(annex, 'FDA Data Mining White Paper', 'Research annex: FDA anchor is present');
  includes(annex, 'Calibration evidence must use lower bounds', 'Research annex: I06 translation rule is present');
  equal(
    packageJson.scripts['test:calibration-lower-bound-runner'],
    'tsx tests/calibration-lower-bound-runner.test.ts',
    'Calibration lower bound: package script is registered',
  );
  includes(packageProbe, 'CALIBRATION_LOWER_BOUND_RUNNER_VERSION', 'Package probe: I06 version is checked');
}

testDescriptorRecordsBoundaries();
testReadyLowerBoundCreatesEvidenceNode();
testWeakLowerBoundOpensUndercuttingDefeater();
testHeldStatesCreateNoPositiveEvidence();
testAuthorityAndMismatchFailClosed();
testDeterminismAndNoMutation();
testDocsPackageOverviewAndProbe();

console.log(`Calibration lower-bound runner tests: ${passed} passed, 0 failed`);
