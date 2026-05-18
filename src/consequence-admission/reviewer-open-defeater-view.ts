import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  type AssuranceCaseDefeater,
} from './assurance-case-contract.js';
import {
  CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
  type CandidateInvariantSynthesizerRecord,
} from './candidate-invariant-synthesizer.js';
import {
  CALIBRATION_LOWER_BOUND_RUNNER_VERSION,
  type CalibrationLowerBoundRunnerRecord,
} from './calibration-lower-bound-runner.js';
import {
  COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
  type CounterexampleMinimalWitnessRecord,
} from './counterexample-minimal-witness.js';

export const REVIEWER_OPEN_DEFEATER_VIEW_VERSION =
  'attestor.reviewer-open-defeater-view.v1';

export const REVIEWER_OPEN_DEFEATER_MAX_REASON_LINES = 7;
export const REVIEWER_OPEN_DEFEATER_MAX_QUESTIONS = 3;

export const REVIEWER_OPEN_DEFEATER_SOURCE_ANCHORS = [
  'microsoft-human-ai-guidelines-explanation-and-uncertainty',
  'microsoft-agentic-risk-human-oversight',
  'google-pair-human-ai-mental-models',
  'github-code-scanning-dismissal-reasons',
  'gsn-open-defeater-render-view',
  'assurance-case-open-defeater-review',
] as const;
export type ReviewerOpenDefeaterSourceAnchor =
  typeof REVIEWER_OPEN_DEFEATER_SOURCE_ANCHORS[number];

export const REVIEWER_OPEN_DEFEATER_SOURCE_KINDS = [
  'counterexample-minimal-witness',
  'calibration-lower-bound-runner',
] as const;
export type ReviewerOpenDefeaterSourceKind =
  typeof REVIEWER_OPEN_DEFEATER_SOURCE_KINDS[number];

export const REVIEWER_OPEN_DEFEATER_PRIORITIES = [
  'rebutting-counterexample',
  'undercutting-calibration',
] as const;
export type ReviewerOpenDefeaterPriority =
  typeof REVIEWER_OPEN_DEFEATER_PRIORITIES[number];

export const REVIEWER_OPEN_DEFEATER_QUESTION_KINDS = [
  'close-by-evidence',
  'close-by-scope',
  'accept-residual',
  'request-more-evidence',
] as const;
export type ReviewerOpenDefeaterQuestionKind =
  typeof REVIEWER_OPEN_DEFEATER_QUESTION_KINDS[number];

export const REVIEWER_OPEN_DEFEATER_OUTCOMES = [
  'reviewer-view-ready-with-open-defeaters',
  'reviewer-view-ready-no-open-defeaters',
  'reviewer-view-held-for-claim-readiness',
  'reviewer-view-held-for-assurance-case',
  'reviewer-view-held-for-review-material',
  'reviewer-view-rejected-boundary',
] as const;
export type ReviewerOpenDefeaterOutcome =
  typeof REVIEWER_OPEN_DEFEATER_OUTCOMES[number];

export const REVIEWER_OPEN_DEFEATER_DANGER_FLAGS = [
  'synthesized-claim-not-ready',
  'assurance-case-unbound',
  'claim-node-missing',
  'strategy-node-missing',
  'missing-review-material',
  'tenant-mismatch',
  'cohort-ref-mismatch',
  'invariant-ref-mismatch',
  'synthesized-claim-mismatch',
  'raw-evidence-requested',
  'authority-action-requested',
  'open-defeater-view-truncated',
] as const;
export type ReviewerOpenDefeaterDangerFlag =
  typeof REVIEWER_OPEN_DEFEATER_DANGER_FLAGS[number];

export interface CreateReviewerOpenDefeaterViewInput {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly counterexampleWitnesses: readonly CounterexampleMinimalWitnessRecord[];
  readonly calibrationRuns: readonly CalibrationLowerBoundRunnerRecord[];
  readonly packetId: string;
  readonly generatedAt: string;
  readonly createdByRefDigest: string;
  readonly reviewerRefDigest?: string | null;
  readonly maxReasonLines?: number | null;
  readonly maxQuestions?: number | null;
  readonly rawEvidenceRequested?: boolean | null;
  readonly authorityActionRequested?: boolean | null;
}

export interface ReviewerOpenDefeaterLine {
  readonly lineId: string;
  readonly lineDigest: string;
  readonly sourceKind: ReviewerOpenDefeaterSourceKind;
  readonly priority: ReviewerOpenDefeaterPriority;
  readonly defeaterId: string;
  readonly defeaterDigest: string;
  readonly defeaterKind: AssuranceCaseDefeater['kind'];
  readonly attacksNodeId: string;
  readonly reasonDigest: string;
  readonly evidenceRefDigest: string | null;
  readonly sourceRecordDigest: string;
  readonly summaryCode: string;
}

export interface ReviewerOpenDefeaterQuestion {
  readonly questionId: string;
  readonly questionDigest: string;
  readonly targetDefeaterId: string;
  readonly allowedQuestionKinds: readonly ReviewerOpenDefeaterQuestionKind[];
  readonly promptCode: 'resolve-open-defeater';
  readonly sourceLineDigest: string;
}

export interface ReviewerOpenDefeaterViewRecord {
  readonly version: typeof REVIEWER_OPEN_DEFEATER_VIEW_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly candidateInvariantSynthesizerVersion:
    typeof CANDIDATE_INVARIANT_SYNTHESIZER_VERSION;
  readonly counterexampleMinimalWitnessVersion:
    typeof COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION;
  readonly calibrationLowerBoundRunnerVersion:
    typeof CALIBRATION_LOWER_BOUND_RUNNER_VERSION;
  readonly packetId: string;
  readonly packetRefDigest: string;
  readonly generatedAt: string;
  readonly createdByRefDigest: string;
  readonly reviewerRefDigest: string | null;
  readonly synthesizedClaimDigest: string;
  readonly candidateInvariantDigest: string;
  readonly invariantRefDigest: string;
  readonly tenantRefDigest: string;
  readonly cohortRefDigest: string;
  readonly assuranceCaseRefDigest: string | null;
  readonly claimNodeDigest: string | null;
  readonly strategyNodeDigest: string | null;
  readonly counterexampleWitnessCount: number;
  readonly calibrationRunCount: number;
  readonly sourceRecordDigests: readonly string[];
  readonly openDefeaterCount: number;
  readonly visibleOpenDefeaterCount: number;
  readonly truncatedOpenDefeaterCount: number;
  readonly maxReasonLines: typeof REVIEWER_OPEN_DEFEATER_MAX_REASON_LINES;
  readonly maxQuestions: typeof REVIEWER_OPEN_DEFEATER_MAX_QUESTIONS;
  readonly reasonLines: readonly ReviewerOpenDefeaterLine[];
  readonly questions: readonly ReviewerOpenDefeaterQuestion[];
  readonly packetBodyDigest: string;
  readonly outcome: ReviewerOpenDefeaterOutcome;
  readonly dangerFlags: readonly ReviewerOpenDefeaterDangerFlag[];
  readonly reasonCodes: readonly string[];
  readonly readyForReviewer: boolean;
  readonly readyForPromotionGateInput: boolean;
  readonly openDefeatersOnly: true;
  readonly digestOnly: true;
  readonly boundedHumanReview: true;
  readonly noRawEvidence: true;
  readonly noReviewerDecision: true;
  readonly noDefeaterClosure: true;
  readonly noPromotion: true;
  readonly noPolicyActivation: true;
  readonly noLearning: true;
  readonly noTraining: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ReviewerOpenDefeaterViewDescriptor {
  readonly version: typeof REVIEWER_OPEN_DEFEATER_VIEW_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly candidateInvariantSynthesizerVersion:
    typeof CANDIDATE_INVARIANT_SYNTHESIZER_VERSION;
  readonly counterexampleMinimalWitnessVersion:
    typeof COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION;
  readonly calibrationLowerBoundRunnerVersion:
    typeof CALIBRATION_LOWER_BOUND_RUNNER_VERSION;
  readonly sourceAnchors: readonly ReviewerOpenDefeaterSourceAnchor[];
  readonly sourceKinds: readonly ReviewerOpenDefeaterSourceKind[];
  readonly priorities: readonly ReviewerOpenDefeaterPriority[];
  readonly questionKinds: readonly ReviewerOpenDefeaterQuestionKind[];
  readonly outcomes: readonly ReviewerOpenDefeaterOutcome[];
  readonly dangerFlags: readonly ReviewerOpenDefeaterDangerFlag[];
  readonly maxReasonLines: typeof REVIEWER_OPEN_DEFEATER_MAX_REASON_LINES;
  readonly maxQuestions: typeof REVIEWER_OPEN_DEFEATER_MAX_QUESTIONS;
  readonly rendersOpenDefeatersOnly: true;
  readonly digestOnly: true;
  readonly boundedHumanReview: true;
  readonly noRawEvidence: true;
  readonly noReviewerDecision: true;
  readonly noDefeaterClosure: true;
  readonly noPromotion: true;
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
    throw new Error(`Reviewer open-defeater view ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Reviewer open-defeater view ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Reviewer open-defeater view ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeIsoTimestamp(value: string | null | undefined, fieldName: string): string {
  const timestamp = new Date(value ?? '');
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Reviewer open-defeater view ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function bodyDigest(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({
    kind,
    version: REVIEWER_OPEN_DEFEATER_VIEW_VERSION,
    value,
  }).digest;
}

function shortDigest(digest: string): string {
  return digest.slice('sha256:'.length, 'sha256:'.length + 16);
}

function normalizeLineLimit(value: number | null | undefined): number {
  if (value === null || value === undefined) {
    return REVIEWER_OPEN_DEFEATER_MAX_REASON_LINES;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('Reviewer open-defeater view maxReasonLines must be positive.');
  }
  return Math.min(value, REVIEWER_OPEN_DEFEATER_MAX_REASON_LINES);
}

function normalizeQuestionLimit(value: number | null | undefined): number {
  if (value === null || value === undefined) {
    return REVIEWER_OPEN_DEFEATER_MAX_QUESTIONS;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Reviewer open-defeater view maxQuestions must be non-negative.');
  }
  return Math.min(value, REVIEWER_OPEN_DEFEATER_MAX_QUESTIONS);
}

function assertSourceBindings(input: {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly counterexampleWitnesses: readonly CounterexampleMinimalWitnessRecord[];
  readonly calibrationRuns: readonly CalibrationLowerBoundRunnerRecord[];
}): void {
  if (input.synthesizedClaim.version !== CANDIDATE_INVARIANT_SYNTHESIZER_VERSION) {
    throw new Error('Reviewer open-defeater view synthesized claim version mismatch.');
  }
  for (const witness of input.counterexampleWitnesses) {
    if (witness.version !== COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION) {
      throw new Error('Reviewer open-defeater view counterexample witness version mismatch.');
    }
    if (witness.synthesizedClaimDigest !== input.synthesizedClaim.digest) {
      throw new Error('Reviewer open-defeater view witness synthesized claim mismatch.');
    }
    if (witness.tenantRefDigest !== input.synthesizedClaim.tenantRefDigest) {
      throw new Error('Reviewer open-defeater view witness tenant mismatch.');
    }
    if (witness.cohortRefDigest !== input.synthesizedClaim.cohortRefDigest) {
      throw new Error('Reviewer open-defeater view witness cohort mismatch.');
    }
    if (witness.invariantRefDigest !== input.synthesizedClaim.invariantRefDigest) {
      throw new Error('Reviewer open-defeater view witness invariant mismatch.');
    }
  }
  for (const run of input.calibrationRuns) {
    if (run.version !== CALIBRATION_LOWER_BOUND_RUNNER_VERSION) {
      throw new Error('Reviewer open-defeater view calibration run version mismatch.');
    }
    if (run.synthesizedClaimDigest !== input.synthesizedClaim.digest) {
      throw new Error('Reviewer open-defeater view calibration synthesized claim mismatch.');
    }
    if (run.tenantRefDigest !== input.synthesizedClaim.tenantRefDigest) {
      throw new Error('Reviewer open-defeater view calibration tenant mismatch.');
    }
    if (run.cohortRefDigest !== input.synthesizedClaim.cohortRefDigest) {
      throw new Error('Reviewer open-defeater view calibration cohort mismatch.');
    }
    if (run.invariantRefDigest !== input.synthesizedClaim.invariantRefDigest) {
      throw new Error('Reviewer open-defeater view calibration invariant mismatch.');
    }
  }
}

function lineFromDefeater(input: {
  readonly sourceKind: ReviewerOpenDefeaterSourceKind;
  readonly priority: ReviewerOpenDefeaterPriority;
  readonly sourceRecordDigest: string;
  readonly sourceIndex: number;
  readonly defeater: AssuranceCaseDefeater;
  readonly evidenceRefDigest: string | null;
  readonly summaryCode: string;
}): ReviewerOpenDefeaterLine {
  const lineId =
    `line:${input.sourceKind}:${input.sourceIndex}:${shortDigest(input.defeater.digest)}`;
  const lineDigest = bodyDigest('reviewer-open-defeater-line', {
    lineId,
    sourceKind: input.sourceKind,
    priority: input.priority,
    sourceRecordDigest: input.sourceRecordDigest,
    defeaterDigest: input.defeater.digest,
    attacksNodeId: input.defeater.attacksNodeId,
    reasonDigest: input.defeater.reasonDigest,
    evidenceRefDigest: input.evidenceRefDigest,
    summaryCode: input.summaryCode,
  } as CanonicalReleaseJsonValue);
  return Object.freeze({
    lineId,
    lineDigest,
    sourceKind: input.sourceKind,
    priority: input.priority,
    defeaterId: input.defeater.defeaterId,
    defeaterDigest: input.defeater.digest,
    defeaterKind: input.defeater.kind,
    attacksNodeId: input.defeater.attacksNodeId,
    reasonDigest: input.defeater.reasonDigest,
    evidenceRefDigest: input.evidenceRefDigest,
    sourceRecordDigest: input.sourceRecordDigest,
    summaryCode: input.summaryCode,
  });
}

function collectOpenDefeaterLines(input: {
  readonly counterexampleWitnesses: readonly CounterexampleMinimalWitnessRecord[];
  readonly calibrationRuns: readonly CalibrationLowerBoundRunnerRecord[];
}): readonly ReviewerOpenDefeaterLine[] {
  const lines: ReviewerOpenDefeaterLine[] = [];
  for (const [index, witness] of input.counterexampleWitnesses.entries()) {
    if (witness.rebuttingDefeater?.state !== 'open') continue;
    lines.push(lineFromDefeater({
      sourceKind: 'counterexample-minimal-witness',
      priority: 'rebutting-counterexample',
      sourceRecordDigest: witness.digest,
      sourceIndex: index,
      defeater: witness.rebuttingDefeater,
      evidenceRefDigest: witness.evidenceNodeDigest ?? witness.witnessRefDigest,
      summaryCode: 'open-rebutting-counterexample',
    }));
  }
  for (const [index, run] of input.calibrationRuns.entries()) {
    if (run.undercuttingDefeater?.state !== 'open') continue;
    lines.push(lineFromDefeater({
      sourceKind: 'calibration-lower-bound-runner',
      priority: 'undercutting-calibration',
      sourceRecordDigest: run.digest,
      sourceIndex: index,
      defeater: run.undercuttingDefeater,
      evidenceRefDigest: run.evidenceNodeDigest ?? run.runnerRefDigest,
      summaryCode: 'open-undercutting-calibration',
    }));
  }
  return Object.freeze(lines.sort((a, b) => {
    const priority = REVIEWER_OPEN_DEFEATER_PRIORITIES.indexOf(a.priority) -
      REVIEWER_OPEN_DEFEATER_PRIORITIES.indexOf(b.priority);
    if (priority !== 0) return priority;
    return a.lineDigest.localeCompare(b.lineDigest);
  }));
}

function questionForLine(line: ReviewerOpenDefeaterLine): ReviewerOpenDefeaterQuestion {
  const questionId = `question:resolve:${shortDigest(line.defeaterDigest)}`;
  const questionDigest = bodyDigest('reviewer-open-defeater-question', {
    questionId,
    targetDefeaterId: line.defeaterId,
    sourceLineDigest: line.lineDigest,
    allowedQuestionKinds: REVIEWER_OPEN_DEFEATER_QUESTION_KINDS,
  } as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    questionId,
    questionDigest,
    targetDefeaterId: line.defeaterId,
    allowedQuestionKinds: REVIEWER_OPEN_DEFEATER_QUESTION_KINDS,
    promptCode: 'resolve-open-defeater',
    sourceLineDigest: line.lineDigest,
  });
}

function flagsFor(input: {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly sourceRecordCount: number;
  readonly truncatedOpenDefeaterCount: number;
  readonly rawEvidenceRequested: boolean;
  readonly authorityActionRequested: boolean;
}): readonly ReviewerOpenDefeaterDangerFlag[] {
  const flags = new Set<ReviewerOpenDefeaterDangerFlag>();
  if (!input.synthesizedClaim.readyForOpenDefeaterReview) {
    flags.add('synthesized-claim-not-ready');
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
  if (input.sourceRecordCount === 0) {
    flags.add('missing-review-material');
  }
  if (input.rawEvidenceRequested) {
    flags.add('raw-evidence-requested');
  }
  if (input.authorityActionRequested) {
    flags.add('authority-action-requested');
  }
  if (input.truncatedOpenDefeaterCount > 0) {
    flags.add('open-defeater-view-truncated');
  }
  return uniqueSorted([...flags]);
}

function outcomeFor(input: {
  readonly flags: readonly ReviewerOpenDefeaterDangerFlag[];
  readonly openDefeaterCount: number;
}): ReviewerOpenDefeaterOutcome {
  if (
    input.flags.includes('raw-evidence-requested') ||
    input.flags.includes('authority-action-requested')
  ) {
    return 'reviewer-view-rejected-boundary';
  }
  if (
    input.flags.includes('assurance-case-unbound') ||
    input.flags.includes('claim-node-missing') ||
    input.flags.includes('strategy-node-missing')
  ) {
    return 'reviewer-view-held-for-assurance-case';
  }
  if (input.flags.includes('synthesized-claim-not-ready')) {
    return 'reviewer-view-held-for-claim-readiness';
  }
  if (input.flags.includes('missing-review-material')) {
    return 'reviewer-view-held-for-review-material';
  }
  if (input.openDefeaterCount > 0) {
    return 'reviewer-view-ready-with-open-defeaters';
  }
  return 'reviewer-view-ready-no-open-defeaters';
}

function reasonCodesFor(input: {
  readonly outcome: ReviewerOpenDefeaterOutcome;
  readonly flags: readonly ReviewerOpenDefeaterDangerFlag[];
  readonly openDefeaterCount: number;
}): readonly string[] {
  const reasons = new Set<string>([
    `outcome:${input.outcome}`,
    `open-defeater-count:${input.openDefeaterCount}`,
    ...input.flags.map((flag) => `flag:${flag}`),
  ]);
  if (input.flags.length === 0 && input.openDefeaterCount > 0) {
    reasons.add('reviewer-open-defeater-view-ready');
  }
  if (input.flags.length === 0 && input.openDefeaterCount === 0) {
    reasons.add('reviewer-open-defeater-view-no-open-defeaters');
  }
  return uniqueSorted([...reasons]);
}

export function createReviewerOpenDefeaterView(
  input: CreateReviewerOpenDefeaterViewInput,
): ReviewerOpenDefeaterViewRecord {
  const packetId = normalizeIdentifier(input.packetId, 'packetId');
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const createdByRefDigest = normalizeDigest(input.createdByRefDigest, 'createdByRefDigest');
  const reviewerRefDigest = normalizeOptionalDigest(input.reviewerRefDigest, 'reviewerRefDigest');
  const maxReasonLines = normalizeLineLimit(input.maxReasonLines);
  const maxQuestions = normalizeQuestionLimit(input.maxQuestions);
  assertSourceBindings({
    synthesizedClaim: input.synthesizedClaim,
    counterexampleWitnesses: input.counterexampleWitnesses,
    calibrationRuns: input.calibrationRuns,
  });
  const sourceRecordDigests = uniqueSorted([
    ...input.counterexampleWitnesses.map((witness) => witness.digest),
    ...input.calibrationRuns.map((run) => run.digest),
  ]);
  const allOpenLines = collectOpenDefeaterLines({
    counterexampleWitnesses: input.counterexampleWitnesses,
    calibrationRuns: input.calibrationRuns,
  });
  const reasonLines = Object.freeze(allOpenLines.slice(0, maxReasonLines));
  const questions = Object.freeze(reasonLines.slice(0, maxQuestions).map(questionForLine));
  const truncatedOpenDefeaterCount = allOpenLines.length - reasonLines.length;
  const flags = flagsFor({
    synthesizedClaim: input.synthesizedClaim,
    sourceRecordCount: sourceRecordDigests.length,
    truncatedOpenDefeaterCount,
    rawEvidenceRequested: input.rawEvidenceRequested === true,
    authorityActionRequested: input.authorityActionRequested === true,
  });
  const outcome = outcomeFor({ flags, openDefeaterCount: allOpenLines.length });
  const reasonCodes = reasonCodesFor({
    outcome,
    flags,
    openDefeaterCount: allOpenLines.length,
  });
  const packetRefDigest = bodyDigest('reviewer-open-defeater-view-ref', {
    packetId,
    generatedAt,
    synthesizedClaimDigest: input.synthesizedClaim.digest,
    sourceRecordDigests,
  } as CanonicalReleaseJsonValue);
  const packetBodyDigest = bodyDigest('reviewer-open-defeater-view-body', {
    packetId,
    packetRefDigest,
    generatedAt,
    synthesizedClaimDigest: input.synthesizedClaim.digest,
    tenantRefDigest: input.synthesizedClaim.tenantRefDigest,
    cohortRefDigest: input.synthesizedClaim.cohortRefDigest,
    invariantRefDigest: input.synthesizedClaim.invariantRefDigest,
    openDefeaterCount: allOpenLines.length,
    visibleOpenDefeaterCount: reasonLines.length,
    truncatedOpenDefeaterCount,
    reasonLineDigests: reasonLines.map((line) => line.lineDigest),
    questionDigests: questions.map((question) => question.questionDigest),
    reasonCodes,
  } as unknown as CanonicalReleaseJsonValue);
  const readyForReviewer = outcome === 'reviewer-view-ready-with-open-defeaters' ||
    outcome === 'reviewer-view-ready-no-open-defeaters';
  const core: Omit<ReviewerOpenDefeaterViewRecord, 'canonical' | 'digest'> = {
    version: REVIEWER_OPEN_DEFEATER_VIEW_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    candidateInvariantSynthesizerVersion: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    counterexampleMinimalWitnessVersion: COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
    calibrationLowerBoundRunnerVersion: CALIBRATION_LOWER_BOUND_RUNNER_VERSION,
    packetId,
    packetRefDigest,
    generatedAt,
    createdByRefDigest,
    reviewerRefDigest,
    synthesizedClaimDigest: input.synthesizedClaim.digest,
    candidateInvariantDigest: input.synthesizedClaim.candidateInvariantDigest,
    invariantRefDigest: input.synthesizedClaim.invariantRefDigest,
    tenantRefDigest: input.synthesizedClaim.tenantRefDigest,
    cohortRefDigest: input.synthesizedClaim.cohortRefDigest,
    assuranceCaseRefDigest: input.synthesizedClaim.assuranceCaseRefDigest,
    claimNodeDigest: input.synthesizedClaim.claimNodeDigest,
    strategyNodeDigest: input.synthesizedClaim.strategyNodeDigest,
    counterexampleWitnessCount: input.counterexampleWitnesses.length,
    calibrationRunCount: input.calibrationRuns.length,
    sourceRecordDigests,
    openDefeaterCount: allOpenLines.length,
    visibleOpenDefeaterCount: reasonLines.length,
    truncatedOpenDefeaterCount,
    maxReasonLines: REVIEWER_OPEN_DEFEATER_MAX_REASON_LINES,
    maxQuestions: REVIEWER_OPEN_DEFEATER_MAX_QUESTIONS,
    reasonLines,
    questions,
    packetBodyDigest,
    outcome,
    dangerFlags: flags,
    reasonCodes,
    readyForReviewer,
    readyForPromotionGateInput: outcome === 'reviewer-view-ready-no-open-defeaters',
    openDefeatersOnly: true,
    digestOnly: true,
    boundedHumanReview: true,
    noRawEvidence: true,
    noReviewerDecision: true,
    noDefeaterClosure: true,
    noPromotion: true,
    noPolicyActivation: true,
    noLearning: true,
    noTraining: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
  };
  const canonical = canonicalObject(core as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...core, ...canonical });
}

export function reviewerOpenDefeaterViewDescriptor():
  ReviewerOpenDefeaterViewDescriptor {
  return Object.freeze({
    version: REVIEWER_OPEN_DEFEATER_VIEW_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    candidateInvariantSynthesizerVersion: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    counterexampleMinimalWitnessVersion: COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
    calibrationLowerBoundRunnerVersion: CALIBRATION_LOWER_BOUND_RUNNER_VERSION,
    sourceAnchors: REVIEWER_OPEN_DEFEATER_SOURCE_ANCHORS,
    sourceKinds: REVIEWER_OPEN_DEFEATER_SOURCE_KINDS,
    priorities: REVIEWER_OPEN_DEFEATER_PRIORITIES,
    questionKinds: REVIEWER_OPEN_DEFEATER_QUESTION_KINDS,
    outcomes: REVIEWER_OPEN_DEFEATER_OUTCOMES,
    dangerFlags: REVIEWER_OPEN_DEFEATER_DANGER_FLAGS,
    maxReasonLines: REVIEWER_OPEN_DEFEATER_MAX_REASON_LINES,
    maxQuestions: REVIEWER_OPEN_DEFEATER_MAX_QUESTIONS,
    rendersOpenDefeatersOnly: true,
    digestOnly: true,
    boundedHumanReview: true,
    noRawEvidence: true,
    noReviewerDecision: true,
    noDefeaterClosure: true,
    noPromotion: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-reviewer-ui',
      'not-promotion-gate',
      'not-defeater-closure',
      'not-review-decision',
      'not-raw-evidence-export',
      'not-policy-activation',
      'not-live-enforcement',
      'not-production-ready',
    ]),
  });
}
