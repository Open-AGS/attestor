import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  createAssuranceCaseDefeater,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  type AssuranceCaseDefeater,
  type AssuranceCaseNode,
  type AssuranceCaseTransition,
} from './assurance-case-contract.js';
import {
  CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
  type CandidateInvariantSynthesizerRecord,
} from './candidate-invariant-synthesizer.js';
import {
  COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
  type CounterexampleMinimalWitnessRecord,
} from './counterexample-minimal-witness.js';
import {
  INVARIANT_CALIBRATION_CONTRACT_VERSION,
  type InvariantCalibrationRecord,
} from './invariant-calibration-contract.js';

export const CALIBRATION_LOWER_BOUND_RUNNER_VERSION =
  'attestor.calibration-lower-bound-runner.v1';

export const CALIBRATION_LOWER_BOUND_MIN_CONFIDENCE = 0.6;

export const CALIBRATION_LOWER_BOUND_SOURCE_ANCHORS = [
  'fda-mgps-eb05-lower-bound',
  'nist-measurement-uncertainty',
  'nist-exact-binomial-confidence-bounds',
  'sklearn-probability-calibration',
  'nist-ai-rmf-measure-uncertainty',
  'assurance-case-confidence-evidence',
] as const;
export type CalibrationLowerBoundSourceAnchor =
  typeof CALIBRATION_LOWER_BOUND_SOURCE_ANCHORS[number];

export const CALIBRATION_LOWER_BOUND_METHODS = [
  'eb05-style-lower-bound',
  'wilson-score-lower-bound',
  'bootstrap-percentile-lower-bound',
  'holdout-credible-lower-bound',
] as const;
export type CalibrationLowerBoundMethod =
  typeof CALIBRATION_LOWER_BOUND_METHODS[number];

export const CALIBRATION_LOWER_BOUND_OUTCOMES = [
  'lower-bound-ready-for-promotion-review',
  'held-for-candidate-readiness',
  'held-for-calibration-readiness',
  'held-for-counterexample-evidence',
  'held-for-open-counterexample-defeater',
  'held-for-lower-bound-threshold',
  'held-for-assurance-case',
  'rejected-authority-confidence',
] as const;
export type CalibrationLowerBoundOutcome =
  typeof CALIBRATION_LOWER_BOUND_OUTCOMES[number];

export const CALIBRATION_LOWER_BOUND_DANGER_FLAGS = [
  'candidate-not-ready',
  'calibration-not-ready',
  'missing-counterexample-witness',
  'open-counterexample-defeater-present',
  'lower-bound-below-threshold',
  'assurance-case-unbound',
  'claim-node-missing',
  'strategy-node-missing',
  'missing-calibration-reviewer',
  'authority-confidence-requested',
] as const;
export type CalibrationLowerBoundDangerFlag =
  typeof CALIBRATION_LOWER_BOUND_DANGER_FLAGS[number];

export interface CreateCalibrationLowerBoundRunnerInput {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly calibration: InvariantCalibrationRecord;
  readonly counterexampleWitnesses: readonly CounterexampleMinimalWitnessRecord[];
  readonly runnerId: string;
  readonly evaluatedAt: string;
  readonly createdByRefDigest: string;
  readonly method: CalibrationLowerBoundMethod;
  readonly confidenceLevel: number;
  readonly lowerBoundConfidence: number;
  readonly minimumLowerBoundConfidence?: number | null;
  readonly authorityConfidenceRequested?: boolean | null;
  readonly evidenceNodeId?: string | null;
  readonly defeaterId?: string | null;
}

export interface CalibrationLowerBoundRunnerRecord {
  readonly version: typeof CALIBRATION_LOWER_BOUND_RUNNER_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly candidateInvariantSynthesizerVersion:
    typeof CANDIDATE_INVARIANT_SYNTHESIZER_VERSION;
  readonly invariantCalibrationContractVersion:
    typeof INVARIANT_CALIBRATION_CONTRACT_VERSION;
  readonly counterexampleMinimalWitnessVersion:
    typeof COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION;
  readonly runnerId: string;
  readonly runnerRefDigest: string;
  readonly synthesizedClaimDigest: string;
  readonly calibrationDigest: string;
  readonly calibrationRefDigest: string;
  readonly candidateInvariantDigest: string;
  readonly invariantRefDigest: string;
  readonly tenantRefDigest: string;
  readonly cohortRefDigest: string;
  readonly assuranceCaseRefDigest: string | null;
  readonly claimNodeDigest: string | null;
  readonly strategyNodeDigest: string | null;
  readonly method: CalibrationLowerBoundMethod;
  readonly confidenceLevel: number;
  readonly pointConfidence: number;
  readonly lowerBoundConfidence: number;
  readonly minimumLowerBoundConfidence: number;
  readonly confidenceGap: number;
  readonly sampleCount: number;
  readonly positiveLabelCount: number;
  readonly negativeLabelCount: number;
  readonly expectedCalibrationError: number;
  readonly brierScore: number;
  readonly counterexampleWitnessCount: number;
  readonly readyCounterexampleWitnessCount: number;
  readonly openCounterexampleDefeaterCount: number;
  readonly counterexampleWitnessDigests: readonly string[];
  readonly evidenceBodyDigest: string;
  readonly transitionReasonDigest: string;
  readonly evidenceNode: AssuranceCaseNode | null;
  readonly undercuttingDefeater: AssuranceCaseDefeater | null;
  readonly evidenceTransition: AssuranceCaseTransition | null;
  readonly defeaterTransition: AssuranceCaseTransition | null;
  readonly evidenceNodeDigest: string | null;
  readonly undercuttingDefeaterDigest: string | null;
  readonly outcome: CalibrationLowerBoundOutcome;
  readonly dangerFlags: readonly CalibrationLowerBoundDangerFlag[];
  readonly reasonCodes: readonly string[];
  readonly readyForPromotionReview: boolean;
  readonly opensUndercuttingDefeater: boolean;
  readonly confidenceEvidenceOnly: true;
  readonly lowerBoundRequired: true;
  readonly pointEstimateAuthorityAllowed: false;
  readonly lowerBoundAuthorityAllowed: false;
  readonly measurementMutationAllowed: false;
  readonly noTraining: true;
  readonly noLearning: true;
  readonly noAutoPromotion: true;
  readonly noPolicyActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CalibrationLowerBoundRunnerDescriptor {
  readonly version: typeof CALIBRATION_LOWER_BOUND_RUNNER_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly candidateInvariantSynthesizerVersion:
    typeof CANDIDATE_INVARIANT_SYNTHESIZER_VERSION;
  readonly invariantCalibrationContractVersion:
    typeof INVARIANT_CALIBRATION_CONTRACT_VERSION;
  readonly counterexampleMinimalWitnessVersion:
    typeof COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION;
  readonly sourceAnchors: readonly CalibrationLowerBoundSourceAnchor[];
  readonly methods: readonly CalibrationLowerBoundMethod[];
  readonly outcomes: readonly CalibrationLowerBoundOutcome[];
  readonly dangerFlags: readonly CalibrationLowerBoundDangerFlag[];
  readonly minimumLowerBoundConfidence:
    typeof CALIBRATION_LOWER_BOUND_MIN_CONFIDENCE;
  readonly createsEvidenceNode: true;
  readonly opensUndercuttingDefeaterOnWeakLowerBound: true;
  readonly requiresLowerBound: true;
  readonly requiresCalibrationReady: true;
  readonly requiresCounterexampleWitnessEvidence: true;
  readonly pointEstimateAuthorityAllowed: false;
  readonly lowerBoundAuthorityAllowed: false;
  readonly measurementMutationAllowed: false;
  readonly noTraining: true;
  readonly noLearning: true;
  readonly noAutoPromotion: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function normalizeIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string {
  if (typeof value !== 'string') {
    throw new Error(`Calibration lower-bound runner ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Calibration lower-bound runner ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Calibration lower-bound runner ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string | null | undefined, fieldName: string): string {
  const timestamp = new Date(value ?? '');
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Calibration lower-bound runner ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeEnumValue<const Values extends readonly string[]>(
  value: string | null | undefined,
  values: Values,
  fieldName: string,
): Values[number] {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!values.includes(normalized)) {
    throw new Error(`Calibration lower-bound runner ${fieldName} is not supported.`);
  }
  return normalized as Values[number];
}

function normalizeUnitInterval(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Calibration lower-bound runner ${fieldName} must be in [0, 1].`);
  }
  return Number(value.toFixed(6));
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function shortDigest(digest: string): string {
  return digest.slice('sha256:'.length, 'sha256:'.length + 16);
}

function bodyDigest(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({
    kind,
    version: CALIBRATION_LOWER_BOUND_RUNNER_VERSION,
    value,
  }).digest;
}

function assertBindings(input: {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly calibration: InvariantCalibrationRecord;
  readonly witnesses: readonly CounterexampleMinimalWitnessRecord[];
}): void {
  if (input.synthesizedClaim.version !== CANDIDATE_INVARIANT_SYNTHESIZER_VERSION) {
    throw new Error('Calibration lower-bound runner synthesized claim version mismatch.');
  }
  if (input.calibration.version !== INVARIANT_CALIBRATION_CONTRACT_VERSION) {
    throw new Error('Calibration lower-bound runner calibration version mismatch.');
  }
  if (
    input.calibration.candidateInvariantDigest !==
      input.synthesizedClaim.candidateInvariantDigest ||
    input.calibration.candidateInvariantRefDigest !==
      input.synthesizedClaim.invariantRefDigest
  ) {
    throw new Error('Calibration lower-bound runner candidate and calibration record must bind the same invariant.');
  }
  for (const witness of input.witnesses) {
    if (witness.version !== COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION) {
      throw new Error('Calibration lower-bound runner counterexample witness version mismatch.');
    }
    if (witness.synthesizedClaimDigest !== input.synthesizedClaim.digest) {
      throw new Error('Calibration lower-bound runner witness must bind the same synthesized claim.');
    }
    if (witness.candidateInvariantDigest !== input.synthesizedClaim.candidateInvariantDigest) {
      throw new Error('Calibration lower-bound runner witness candidate invariant digest mismatch.');
    }
    if (witness.invariantRefDigest !== input.synthesizedClaim.invariantRefDigest) {
      throw new Error('Calibration lower-bound runner witness invariant ref mismatch.');
    }
    if (witness.tenantRefDigest !== input.synthesizedClaim.tenantRefDigest) {
      throw new Error('Calibration lower-bound runner witness tenant mismatch.');
    }
    if (witness.cohortRefDigest !== input.synthesizedClaim.cohortRefDigest) {
      throw new Error('Calibration lower-bound runner witness cohort mismatch.');
    }
  }
}

function flagsFor(input: {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly calibration: InvariantCalibrationRecord;
  readonly witnessCount: number;
  readonly openCounterexampleDefeaterCount: number;
  readonly lowerBoundConfidence: number;
  readonly minimumLowerBoundConfidence: number;
  readonly authorityConfidenceRequested: boolean;
}): readonly CalibrationLowerBoundDangerFlag[] {
  const flags = new Set<CalibrationLowerBoundDangerFlag>();
  if (input.authorityConfidenceRequested) {
    flags.add('authority-confidence-requested');
  }
  if (!input.synthesizedClaim.readyForOpenDefeaterReview) {
    flags.add('candidate-not-ready');
  }
  if (!input.calibration.readyForPromotionGate) {
    flags.add('calibration-not-ready');
  }
  if (input.witnessCount === 0) {
    flags.add('missing-counterexample-witness');
  }
  if (input.openCounterexampleDefeaterCount > 0) {
    flags.add('open-counterexample-defeater-present');
  }
  if (input.lowerBoundConfidence < input.minimumLowerBoundConfidence) {
    flags.add('lower-bound-below-threshold');
  }
  if (input.synthesizedClaim.assuranceCaseRefDigest === null) {
    flags.add('assurance-case-unbound');
  }
  if (input.synthesizedClaim.claimNodeDigest === null) {
    flags.add('claim-node-missing');
  }
  if (input.synthesizedClaim.strategyNodeDigest === null) {
    flags.add('strategy-node-missing');
  }
  if (input.calibration.reviewerRefDigest === null) {
    flags.add('missing-calibration-reviewer');
  }
  return uniqueSorted([...flags]);
}

function outcomeFor(
  flags: readonly CalibrationLowerBoundDangerFlag[],
): CalibrationLowerBoundOutcome {
  if (flags.includes('authority-confidence-requested')) {
    return 'rejected-authority-confidence';
  }
  if (
    flags.includes('assurance-case-unbound') ||
    flags.includes('claim-node-missing') ||
    flags.includes('strategy-node-missing')
  ) {
    return 'held-for-assurance-case';
  }
  if (flags.includes('candidate-not-ready')) {
    return 'held-for-candidate-readiness';
  }
  if (flags.includes('calibration-not-ready') || flags.includes('missing-calibration-reviewer')) {
    return 'held-for-calibration-readiness';
  }
  if (flags.includes('missing-counterexample-witness')) {
    return 'held-for-counterexample-evidence';
  }
  if (flags.includes('open-counterexample-defeater-present')) {
    return 'held-for-open-counterexample-defeater';
  }
  if (flags.includes('lower-bound-below-threshold')) {
    return 'held-for-lower-bound-threshold';
  }
  return 'lower-bound-ready-for-promotion-review';
}

function reasonCodesFor(input: {
  readonly outcome: CalibrationLowerBoundOutcome;
  readonly flags: readonly CalibrationLowerBoundDangerFlag[];
  readonly method: CalibrationLowerBoundMethod;
}): readonly string[] {
  const reasons = new Set<string>([
    `outcome:${input.outcome}`,
    `lower-bound-method:${input.method}`,
    ...input.flags.map((flag) => `flag:${flag}`),
  ]);
  if (input.flags.length === 0) {
    reasons.add('calibration-lower-bound-ready-for-promotion-review');
  }
  return uniqueSorted([...reasons]);
}

export function createCalibrationLowerBoundRunner(
  input: CreateCalibrationLowerBoundRunnerInput,
): CalibrationLowerBoundRunnerRecord {
  const runnerId = normalizeIdentifier(input.runnerId, 'runnerId');
  const evaluatedAt = normalizeIsoTimestamp(input.evaluatedAt, 'evaluatedAt');
  const createdByRefDigest = normalizeDigest(input.createdByRefDigest, 'createdByRefDigest');
  const method = normalizeEnumValue(
    input.method,
    CALIBRATION_LOWER_BOUND_METHODS,
    'method',
  ) as CalibrationLowerBoundMethod;
  const confidenceLevel = normalizeUnitInterval(input.confidenceLevel, 'confidenceLevel');
  if (confidenceLevel < 0.5) {
    throw new Error('Calibration lower-bound runner confidenceLevel must be at least 0.5.');
  }
  const lowerBoundConfidence = normalizeUnitInterval(
    input.lowerBoundConfidence,
    'lowerBoundConfidence',
  );
  const minimumLowerBoundConfidence = normalizeUnitInterval(
    input.minimumLowerBoundConfidence ?? CALIBRATION_LOWER_BOUND_MIN_CONFIDENCE,
    'minimumLowerBoundConfidence',
  );
  if (lowerBoundConfidence > input.calibration.cappedCalibratedConfidence) {
    throw new Error(
      'Calibration lower-bound runner lowerBoundConfidence must not exceed capped point confidence.',
    );
  }
  assertBindings({
    synthesizedClaim: input.synthesizedClaim,
    calibration: input.calibration,
    witnesses: input.counterexampleWitnesses,
  });
  const authorityConfidenceRequested = input.authorityConfidenceRequested === true;
  const openCounterexampleDefeaterCount = input.counterexampleWitnesses.filter((witness) =>
    witness.opensRebuttingDefeater).length;
  const readyCounterexampleWitnessCount = input.counterexampleWitnesses.filter((witness) =>
    witness.readyForReviewer).length;
  const flags = flagsFor({
    synthesizedClaim: input.synthesizedClaim,
    calibration: input.calibration,
    witnessCount: input.counterexampleWitnesses.length,
    openCounterexampleDefeaterCount,
    lowerBoundConfidence,
    minimumLowerBoundConfidence,
    authorityConfidenceRequested,
  });
  const outcome = outcomeFor(flags);
  const readyForPromotionReview = outcome === 'lower-bound-ready-for-promotion-review';
  const reasonCodes = reasonCodesFor({ outcome, flags, method });
  const counterexampleWitnessDigests = Object.freeze(
    input.counterexampleWitnesses.map((witness) => witness.digest).sort(),
  );
  const runnerRefDigest = bodyDigest('calibration-lower-bound-runner-ref', {
    runnerId,
    method,
    calibrationDigest: input.calibration.digest,
    synthesizedClaimDigest: input.synthesizedClaim.digest,
    counterexampleWitnessDigests,
  } as unknown as CanonicalReleaseJsonValue);
  const confidenceGap = Number(
    (input.calibration.cappedCalibratedConfidence - lowerBoundConfidence).toFixed(6),
  );
  const evidenceBodyDigest = bodyDigest('calibration-lower-bound-evidence-body', {
    runnerId,
    runnerRefDigest,
    method,
    confidenceLevel,
    pointConfidence: input.calibration.cappedCalibratedConfidence,
    lowerBoundConfidence,
    minimumLowerBoundConfidence,
    confidenceGap,
    sampleCount: input.calibration.sampleCount,
    expectedCalibrationError: input.calibration.metrics.expectedCalibrationError,
    brierScore: input.calibration.metrics.brierScore,
    calibrationRefDigest: input.calibration.calibrationRefDigest,
    calibrationDigest: input.calibration.digest,
    synthesizedClaimDigest: input.synthesizedClaim.digest,
    counterexampleWitnessDigests,
    reasonCodes,
  } as unknown as CanonicalReleaseJsonValue);
  const transitionReasonDigest = bodyDigest('calibration-lower-bound-transition-reason', {
    reasonCodes,
  } as CanonicalReleaseJsonValue);
  const evidenceNode = readyForPromotionReview
    ? createAssuranceCaseNode({
        nodeId: normalizeIdentifier(
          input.evidenceNodeId ??
            `evidence:calibration-lower-bound:${shortDigest(runnerRefDigest)}`,
          'evidenceNodeId',
        ),
        kind: 'evidence',
        title: 'Calibration lower-bound evidence',
        bodyDigest: evidenceBodyDigest,
        tenantRefDigest: input.synthesizedClaim.tenantRefDigest,
        scopeDigest: input.synthesizedClaim.invariantRefDigest,
        createdByRefDigest,
        createdAt: evaluatedAt,
      })
    : null;
  const opensUndercuttingDefeater = outcome === 'held-for-lower-bound-threshold' &&
    input.synthesizedClaim.strategyNode !== null;
  const undercuttingDefeater = opensUndercuttingDefeater
    ? createAssuranceCaseDefeater({
        defeaterId: normalizeIdentifier(
          input.defeaterId ??
            `defeater:undercutting-calibration:${shortDigest(runnerRefDigest)}`,
          'defeaterId',
        ),
        kind: 'undercutting',
        state: 'open',
        attacksNodeId: input.synthesizedClaim.strategyNode.nodeId,
        reasonDigest: evidenceBodyDigest,
        tenantRefDigest: input.synthesizedClaim.tenantRefDigest,
        openedByRefDigest: createdByRefDigest,
        openedAt: evaluatedAt,
      })
    : null;
  const evidenceTransition = evidenceNode === null
    ? null
    : createAssuranceCaseTransition({
        transitionId: `transition:create:${evidenceNode.nodeId}`,
        transitionKind: 'create-node',
        actorRefDigest: createdByRefDigest,
        occurredAt: evaluatedAt,
        reasonDigest: transitionReasonDigest,
        nodeId: evidenceNode.nodeId,
        evidenceRefDigest: runnerRefDigest,
      });
  const defeaterTransition = undercuttingDefeater === null
    ? null
    : createAssuranceCaseTransition({
        transitionId: `transition:open:${undercuttingDefeater.defeaterId}`,
        transitionKind: 'open-defeater',
        actorRefDigest: createdByRefDigest,
        occurredAt: evaluatedAt,
        reasonDigest: transitionReasonDigest,
        defeaterId: undercuttingDefeater.defeaterId,
        fromState: null,
        toState: 'open',
        evidenceRefDigest: runnerRefDigest,
      });
  const core: Omit<CalibrationLowerBoundRunnerRecord, 'canonical' | 'digest'> = {
    version: CALIBRATION_LOWER_BOUND_RUNNER_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    candidateInvariantSynthesizerVersion: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    invariantCalibrationContractVersion: INVARIANT_CALIBRATION_CONTRACT_VERSION,
    counterexampleMinimalWitnessVersion: COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
    runnerId,
    runnerRefDigest,
    synthesizedClaimDigest: input.synthesizedClaim.digest,
    calibrationDigest: input.calibration.digest,
    calibrationRefDigest: input.calibration.calibrationRefDigest,
    candidateInvariantDigest: input.synthesizedClaim.candidateInvariantDigest,
    invariantRefDigest: input.synthesizedClaim.invariantRefDigest,
    tenantRefDigest: input.synthesizedClaim.tenantRefDigest,
    cohortRefDigest: input.synthesizedClaim.cohortRefDigest,
    assuranceCaseRefDigest: input.synthesizedClaim.assuranceCaseRefDigest,
    claimNodeDigest: input.synthesizedClaim.claimNodeDigest,
    strategyNodeDigest: input.synthesizedClaim.strategyNodeDigest,
    method,
    confidenceLevel,
    pointConfidence: input.calibration.cappedCalibratedConfidence,
    lowerBoundConfidence,
    minimumLowerBoundConfidence,
    confidenceGap,
    sampleCount: input.calibration.sampleCount,
    positiveLabelCount: input.calibration.positiveLabelCount,
    negativeLabelCount: input.calibration.negativeLabelCount,
    expectedCalibrationError: input.calibration.metrics.expectedCalibrationError,
    brierScore: input.calibration.metrics.brierScore,
    counterexampleWitnessCount: input.counterexampleWitnesses.length,
    readyCounterexampleWitnessCount,
    openCounterexampleDefeaterCount,
    counterexampleWitnessDigests,
    evidenceBodyDigest,
    transitionReasonDigest,
    evidenceNode,
    undercuttingDefeater,
    evidenceTransition,
    defeaterTransition,
    evidenceNodeDigest: evidenceNode?.digest ?? null,
    undercuttingDefeaterDigest: undercuttingDefeater?.digest ?? null,
    outcome,
    dangerFlags: flags,
    reasonCodes,
    readyForPromotionReview,
    opensUndercuttingDefeater: undercuttingDefeater !== null,
    confidenceEvidenceOnly: true,
    lowerBoundRequired: true,
    pointEstimateAuthorityAllowed: false,
    lowerBoundAuthorityAllowed: false,
    measurementMutationAllowed: false,
    noTraining: true,
    noLearning: true,
    noAutoPromotion: true,
    noPolicyActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
  };
  const canonical = canonicalObject(core as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...core, ...canonical });
}

export function calibrationLowerBoundRunnerDescriptor():
  CalibrationLowerBoundRunnerDescriptor {
  return Object.freeze({
    version: CALIBRATION_LOWER_BOUND_RUNNER_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    candidateInvariantSynthesizerVersion: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    invariantCalibrationContractVersion: INVARIANT_CALIBRATION_CONTRACT_VERSION,
    counterexampleMinimalWitnessVersion: COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
    sourceAnchors: CALIBRATION_LOWER_BOUND_SOURCE_ANCHORS,
    methods: CALIBRATION_LOWER_BOUND_METHODS,
    outcomes: CALIBRATION_LOWER_BOUND_OUTCOMES,
    dangerFlags: CALIBRATION_LOWER_BOUND_DANGER_FLAGS,
    minimumLowerBoundConfidence: CALIBRATION_LOWER_BOUND_MIN_CONFIDENCE,
    createsEvidenceNode: true,
    opensUndercuttingDefeaterOnWeakLowerBound: true,
    requiresLowerBound: true,
    requiresCalibrationReady: true,
    requiresCounterexampleWitnessEvidence: true,
    pointEstimateAuthorityAllowed: false,
    lowerBoundAuthorityAllowed: false,
    measurementMutationAllowed: false,
    noTraining: true,
    noLearning: true,
    noAutoPromotion: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-calibration-training-engine',
      'not-point-estimate-authority',
      'not-lower-bound-authority',
      'not-promotion-gate',
      'not-policy-activation',
      'not-live-enforcement',
      'not-production-ready',
    ]),
  });
}
