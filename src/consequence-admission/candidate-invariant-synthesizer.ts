import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  type AssuranceCaseNode,
  type AssuranceCaseTransition,
} from './assurance-case-contract.js';
import {
  BASELINE_COHORT_BUILDER_VERSION,
  type BaselineCohortBuilderRecord,
} from './baseline-cohort-builder.js';
import {
  CANDIDATE_INVARIANTS_CATALOG_VERSION,
  type CandidateInvariant,
} from './candidate-invariants-catalog.js';

export const CANDIDATE_INVARIANT_SYNTHESIZER_VERSION =
  'attestor.candidate-invariant-synthesizer.v1';

export const CANDIDATE_INVARIANT_SYNTHESIZER_SOURCE_ANCHORS = [
  'daikon-likely-invariant-not-proof',
  'texada-ltl-specification-mining',
  'synoptic-log-invariant-mining',
  'dwyer-property-specification-patterns',
  'codeql-modeling-alert-family-suppression',
  'assurance-case-claim-strategy-node',
] as const;
export type CandidateInvariantSynthesizerSourceAnchor =
  typeof CANDIDATE_INVARIANT_SYNTHESIZER_SOURCE_ANCHORS[number];

export const CANDIDATE_INVARIANT_SYNTHESIZER_OUTCOMES = [
  'invariant-claim-ready-for-open-defeater-review',
  'invariant-held-for-baseline-evidence',
  'invariant-held-for-candidate-readiness',
  'invariant-held-for-assurance-case',
  'invariant-rejected-danger-flag',
] as const;
export type CandidateInvariantSynthesizerOutcome =
  typeof CANDIDATE_INVARIANT_SYNTHESIZER_OUTCOMES[number];

export const CANDIDATE_INVARIANT_SYNTHESIZER_DANGER_FLAGS = [
  'baseline-evidence-not-ready',
  'candidate-not-review-ready',
  'candidate-danger-flag-present',
  'assurance-case-unbound',
  'tenant-mismatch',
  'cohort-ref-mismatch',
  'baseline-evidence-node-missing',
  'frequency-safety-danger',
  'relaxation-danger',
] as const;
export type CandidateInvariantSynthesizerDangerFlag =
  typeof CANDIDATE_INVARIANT_SYNTHESIZER_DANGER_FLAGS[number];

export interface CreateCandidateInvariantAssuranceCaseInput {
  readonly baselineEvidence: BaselineCohortBuilderRecord;
  readonly candidateInvariant: CandidateInvariant;
  readonly assuranceCaseRefDigest?: string | null;
  readonly createdByRefDigest: string;
  readonly createdAt: string;
  readonly claimNodeId?: string | null;
  readonly strategyNodeId?: string | null;
}

export interface CandidateInvariantSynthesizerRecord {
  readonly version: typeof CANDIDATE_INVARIANT_SYNTHESIZER_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly baselineCohortBuilderVersion: typeof BASELINE_COHORT_BUILDER_VERSION;
  readonly candidateInvariantsCatalogVersion:
    typeof CANDIDATE_INVARIANTS_CATALOG_VERSION;
  readonly invariantRefDigest: string;
  readonly candidateInvariantDigest: string;
  readonly baselineEvidenceDigest: string;
  readonly baselineEvidenceNodeDigest: string | null;
  readonly tenantRefDigest: string;
  readonly cohortRefDigest: string;
  readonly assuranceCaseRefDigest: string | null;
  readonly claimNode: AssuranceCaseNode | null;
  readonly strategyNode: AssuranceCaseNode | null;
  readonly claimTransition: AssuranceCaseTransition | null;
  readonly strategyTransition: AssuranceCaseTransition | null;
  readonly claimNodeDigest: string | null;
  readonly strategyNodeDigest: string | null;
  readonly claimBodyDigest: string;
  readonly strategyBodyDigest: string;
  readonly candidateReviewOutcome: CandidateInvariant['reviewOutcome'];
  readonly dangerFlags: readonly CandidateInvariantSynthesizerDangerFlag[];
  readonly reasonCodes: readonly string[];
  readonly outcome: CandidateInvariantSynthesizerOutcome;
  readonly readyForOpenDefeaterReview: boolean;
  readonly underminingDefeaterRequired: boolean;
  readonly failClosed: boolean;
  readonly claimOnly: true;
  readonly reviewOnly: true;
  readonly noMining: true;
  readonly noLearning: true;
  readonly noTraining: true;
  readonly noRelaxation: true;
  readonly noAutoPromotion: true;
  readonly noPolicyActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CandidateInvariantSynthesizerDescriptor {
  readonly version: typeof CANDIDATE_INVARIANT_SYNTHESIZER_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly baselineCohortBuilderVersion: typeof BASELINE_COHORT_BUILDER_VERSION;
  readonly candidateInvariantsCatalogVersion:
    typeof CANDIDATE_INVARIANTS_CATALOG_VERSION;
  readonly sourceAnchors: readonly CandidateInvariantSynthesizerSourceAnchor[];
  readonly outcomes: readonly CandidateInvariantSynthesizerOutcome[];
  readonly dangerFlags: readonly CandidateInvariantSynthesizerDangerFlag[];
  readonly createsClaimNode: true;
  readonly createsStrategyNode: true;
  readonly requiresBaselineEvidenceReady: true;
  readonly requiresCandidateReviewReady: true;
  readonly assuranceCaseContextRequired: true;
  readonly reviewOnly: true;
  readonly noMining: true;
  readonly noLearning: true;
  readonly noTraining: true;
  readonly noRelaxation: true;
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
    throw new Error(`Candidate invariant synthesizer ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Candidate invariant synthesizer ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Candidate invariant synthesizer ${fieldName} must be a sha256 digest.`);
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

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fieldName: string,
): string {
  const timestamp = new Date(value ?? '');
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Candidate invariant synthesizer ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function shortDigest(digest: string): string {
  return digest.slice('sha256:'.length, 'sha256:'.length + 16);
}

function flagsFor(input: {
  readonly baselineEvidence: BaselineCohortBuilderRecord;
  readonly candidateInvariant: CandidateInvariant;
  readonly assuranceCaseRefDigest: string | null;
}): readonly CandidateInvariantSynthesizerDangerFlag[] {
  const flags = new Set<CandidateInvariantSynthesizerDangerFlag>();
  if (!input.baselineEvidence.readyForCandidateClaim) {
    flags.add('baseline-evidence-not-ready');
  }
  if (input.baselineEvidence.evidenceNodeDigest === null) {
    flags.add('baseline-evidence-node-missing');
  }
  if (input.candidateInvariant.reviewOutcome !== 'review-ready') {
    flags.add('candidate-not-review-ready');
  }
  if (input.candidateInvariant.dangerFlags.length > 0) {
    flags.add('candidate-danger-flag-present');
  }
  if (input.assuranceCaseRefDigest === null) {
    flags.add('assurance-case-unbound');
  }
  if (
    input.baselineEvidence.tenantRefDigest !==
    input.candidateInvariant.scope.tenantRefDigest
  ) {
    flags.add('tenant-mismatch');
  }
  if (
    input.baselineEvidence.cohortRefDigest !==
    input.candidateInvariant.baselineCohortRefDigest
  ) {
    flags.add('cohort-ref-mismatch');
  }
  if (input.candidateInvariant.dangerFlags.includes('frequency-implies-safety')) {
    flags.add('frequency-safety-danger');
  }
  if (input.candidateInvariant.dangerFlags.includes('relaxes-existing-control')) {
    flags.add('relaxation-danger');
  }
  return uniqueSorted([...flags]);
}

function assertNoScopeMismatch(flags: readonly CandidateInvariantSynthesizerDangerFlag[]): void {
  if (flags.includes('tenant-mismatch')) {
    throw new Error('Candidate invariant synthesizer tenant mismatch.');
  }
  if (flags.includes('cohort-ref-mismatch')) {
    throw new Error('Candidate invariant synthesizer cohort ref mismatch.');
  }
}

function outcomeFor(
  flags: readonly CandidateInvariantSynthesizerDangerFlag[],
): CandidateInvariantSynthesizerOutcome {
  if (flags.includes('frequency-safety-danger') || flags.includes('relaxation-danger')) {
    return 'invariant-rejected-danger-flag';
  }
  if (
    flags.includes('baseline-evidence-not-ready') ||
    flags.includes('baseline-evidence-node-missing')
  ) {
    return 'invariant-held-for-baseline-evidence';
  }
  if (flags.includes('candidate-not-review-ready') || flags.includes('candidate-danger-flag-present')) {
    return 'invariant-held-for-candidate-readiness';
  }
  if (flags.includes('assurance-case-unbound')) {
    return 'invariant-held-for-assurance-case';
  }
  return 'invariant-claim-ready-for-open-defeater-review';
}

function reasonCodesFor(
  outcome: CandidateInvariantSynthesizerOutcome,
  flags: readonly CandidateInvariantSynthesizerDangerFlag[],
  candidateInvariant: CandidateInvariant,
): readonly string[] {
  const reasons = new Set<string>([
    `outcome:${outcome}`,
    ...flags.map((flag) => `flag:${flag}`),
    ...candidateInvariant.reasonCodes.map((reason) => `candidate:${reason}`),
  ]);
  if (flags.length === 0) {
    reasons.add('candidate-invariant-claim-ready-for-open-defeater-review');
  }
  return uniqueSorted([...reasons]);
}

function bodyDigest(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({
    kind,
    version: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    value,
  }).digest;
}

function transitionReasonDigest(reasonCodes: readonly string[]): string {
  return bodyDigest('candidate-invariant-synthesizer-transition-reason', {
    reasonCodes,
  });
}

export function synthesizeCandidateInvariantAssuranceCase(
  input: CreateCandidateInvariantAssuranceCaseInput,
): CandidateInvariantSynthesizerRecord {
  const baselineEvidence = input.baselineEvidence;
  const candidateInvariant = input.candidateInvariant;
  const createdAt = normalizeIsoTimestamp(input.createdAt, 'createdAt');
  const createdByRefDigest = normalizeDigest(input.createdByRefDigest, 'createdByRefDigest');
  const assuranceCaseRefDigest = normalizeOptionalDigest(
    input.assuranceCaseRefDigest,
    'assuranceCaseRefDigest',
  );
  const flags = flagsFor({ baselineEvidence, candidateInvariant, assuranceCaseRefDigest });
  assertNoScopeMismatch(flags);
  const outcome = outcomeFor(flags);
  const reasonCodes = reasonCodesFor(outcome, flags, candidateInvariant);
  const readyForOpenDefeaterReview =
    outcome === 'invariant-claim-ready-for-open-defeater-review';
  const claimBodyDigest = bodyDigest('candidate-invariant-claim-body', {
    invariantRefDigest: candidateInvariant.invariantRefDigest,
    candidateInvariantDigest: candidateInvariant.digest,
    baselineEvidenceDigest: baselineEvidence.digest,
    baselineEvidenceNodeDigest: baselineEvidence.evidenceNodeDigest,
    pattern: candidateInvariant.pattern,
    scope: candidateInvariant.scope,
    effect: candidateInvariant.effect,
  } as unknown as CanonicalReleaseJsonValue);
  const strategyBodyDigest = bodyDigest('candidate-invariant-strategy-body', {
    invariantRefDigest: candidateInvariant.invariantRefDigest,
    baselineEvidenceDigest: baselineEvidence.digest,
    evidenceNodeDigest: baselineEvidence.evidenceNodeDigest,
    reviewOutcome: candidateInvariant.reviewOutcome,
    reasonCodes,
  } as unknown as CanonicalReleaseJsonValue);
  const claimNodeId = normalizeIdentifier(
    input.claimNodeId ??
      `claim:candidate-invariant:${shortDigest(candidateInvariant.invariantRefDigest)}`,
    'claimNodeId',
  );
  const strategyNodeId = normalizeIdentifier(
    input.strategyNodeId ??
      `strategy:candidate-invariant:${shortDigest(candidateInvariant.invariantRefDigest)}`,
    'strategyNodeId',
  );
  const claimNode = readyForOpenDefeaterReview && assuranceCaseRefDigest !== null
    ? createAssuranceCaseNode({
        nodeId: claimNodeId,
        kind: 'claim',
        title: 'Candidate invariant claim',
        bodyDigest: claimBodyDigest,
        tenantRefDigest: candidateInvariant.scope.tenantRefDigest,
        scopeDigest: candidateInvariant.invariantRefDigest,
        createdByRefDigest,
        createdAt,
      })
    : null;
  const strategyNode = readyForOpenDefeaterReview && assuranceCaseRefDigest !== null
    ? createAssuranceCaseNode({
        nodeId: strategyNodeId,
        kind: 'strategy',
        title: 'Candidate invariant review strategy',
        bodyDigest: strategyBodyDigest,
        tenantRefDigest: candidateInvariant.scope.tenantRefDigest,
        scopeDigest: candidateInvariant.invariantRefDigest,
        createdByRefDigest,
        createdAt,
      })
    : null;
  const claimTransition = claimNode === null
    ? null
    : createAssuranceCaseTransition({
        transitionId: `transition:create:${claimNode.nodeId}`,
        transitionKind: 'create-node',
        actorRefDigest: createdByRefDigest,
        occurredAt: createdAt,
        reasonDigest: transitionReasonDigest(reasonCodes),
        nodeId: claimNode.nodeId,
        evidenceRefDigest: candidateInvariant.digest,
      });
  const strategyTransition = strategyNode === null
    ? null
    : createAssuranceCaseTransition({
        transitionId: `transition:create:${strategyNode.nodeId}`,
        transitionKind: 'create-node',
        actorRefDigest: createdByRefDigest,
        occurredAt: createdAt,
        reasonDigest: transitionReasonDigest(reasonCodes),
        nodeId: strategyNode.nodeId,
        evidenceRefDigest: baselineEvidence.evidenceNodeDigest,
      });
  const core: Omit<CandidateInvariantSynthesizerRecord, 'canonical' | 'digest'> = {
    version: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    baselineCohortBuilderVersion: BASELINE_COHORT_BUILDER_VERSION,
    candidateInvariantsCatalogVersion: CANDIDATE_INVARIANTS_CATALOG_VERSION,
    invariantRefDigest: candidateInvariant.invariantRefDigest,
    candidateInvariantDigest: candidateInvariant.digest,
    baselineEvidenceDigest: baselineEvidence.digest,
    baselineEvidenceNodeDigest: baselineEvidence.evidenceNodeDigest,
    tenantRefDigest: candidateInvariant.scope.tenantRefDigest,
    cohortRefDigest: candidateInvariant.baselineCohortRefDigest,
    assuranceCaseRefDigest,
    claimNode,
    strategyNode,
    claimTransition,
    strategyTransition,
    claimNodeDigest: claimNode?.digest ?? null,
    strategyNodeDigest: strategyNode?.digest ?? null,
    claimBodyDigest,
    strategyBodyDigest,
    candidateReviewOutcome: candidateInvariant.reviewOutcome,
    dangerFlags: flags,
    reasonCodes,
    outcome,
    readyForOpenDefeaterReview,
    underminingDefeaterRequired: !readyForOpenDefeaterReview,
    failClosed: !readyForOpenDefeaterReview,
    claimOnly: true,
    reviewOnly: true,
    noMining: true,
    noLearning: true,
    noTraining: true,
    noRelaxation: true,
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

export function candidateInvariantSynthesizerDescriptor():
  CandidateInvariantSynthesizerDescriptor {
  return Object.freeze({
    version: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    baselineCohortBuilderVersion: BASELINE_COHORT_BUILDER_VERSION,
    candidateInvariantsCatalogVersion: CANDIDATE_INVARIANTS_CATALOG_VERSION,
    sourceAnchors: CANDIDATE_INVARIANT_SYNTHESIZER_SOURCE_ANCHORS,
    outcomes: CANDIDATE_INVARIANT_SYNTHESIZER_OUTCOMES,
    dangerFlags: CANDIDATE_INVARIANT_SYNTHESIZER_DANGER_FLAGS,
    createsClaimNode: true,
    createsStrategyNode: true,
    requiresBaselineEvidenceReady: true,
    requiresCandidateReviewReady: true,
    assuranceCaseContextRequired: true,
    reviewOnly: true,
    noMining: true,
    noLearning: true,
    noTraining: true,
    noRelaxation: true,
    noAutoPromotion: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-invariant-mining-engine',
      'not-automatic-claim-acceptance',
      'not-learned-invariant-promotion',
      'not-model-training',
      'not-policy-activation',
      'not-live-enforcement',
      'not-production-ready',
    ]),
  });
}
