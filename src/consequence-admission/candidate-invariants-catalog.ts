import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  BASELINE_COHORT_CONTRACT_VERSION,
  type BaselineCohortCandidate,
  type BaselineCohortPromotionEvaluation,
  evaluateBaselineCohortPromotion,
} from './baseline-cohort-contract.js';

export const CANDIDATE_INVARIANTS_CATALOG_VERSION =
  'attestor.candidate-invariants-catalog.v1';

export const CANDIDATE_INVARIANT_KINDS = [
  'field-presence',
  'digest-binding',
  'tenant-boundary',
  'authority-evidence-required',
  'freshness-window-bound',
  'temporal-precedence',
  'bounded-rate',
  'outcome-receipt-link',
  'counterexample-exclusion',
  'monotone-risk-floor',
] as const;
export type CandidateInvariantKind =
  typeof CANDIDATE_INVARIANT_KINDS[number];

export const CANDIDATE_INVARIANT_TEMPLATE_KINDS = [
  'always',
  'never',
  'precedence',
  'response',
  'bounded-window',
  'state-equality',
  'threshold-bound',
] as const;
export type CandidateInvariantTemplateKind =
  typeof CANDIDATE_INVARIANT_TEMPLATE_KINDS[number];

export const CANDIDATE_INVARIANT_EVIDENCE_BASES = [
  'baseline-cohort',
  'counterexample-replay',
  'operator-review',
  'formal-spec',
  'policy-source',
  'downstream-receipt',
  'frequency-only',
] as const;
export type CandidateInvariantEvidenceBasis =
  typeof CANDIDATE_INVARIANT_EVIDENCE_BASES[number];

export const CANDIDATE_INVARIANT_EFFECTS = [
  'strengthen-only',
  'review-only',
  'measure-only',
  'relaxation-requested',
] as const;
export type CandidateInvariantEffect =
  typeof CANDIDATE_INVARIANT_EFFECTS[number];

export const CANDIDATE_INVARIANT_DANGER_FLAGS = [
  'frequency-implies-safety',
  'post-hoc-correlation',
  'cross-tenant-generalization',
  'relaxes-existing-control',
  'uses-blocked-traffic',
  'raw-material-dependent',
  'insufficient-sample',
  'missing-counterexample-replay',
  'silent-authority-upgrade',
  'external-effect-unobserved',
  'unreviewed-promotion',
  'unsafe-baseline-cohort',
] as const;
export type CandidateInvariantDangerFlag =
  typeof CANDIDATE_INVARIANT_DANGER_FLAGS[number];

export const CANDIDATE_INVARIANT_REVIEW_OUTCOMES = [
  'review-ready',
  'held-for-counterexample-replay',
  'held-for-review',
  'held-for-baseline',
  'rejected-danger-flag',
] as const;
export type CandidateInvariantReviewOutcome =
  typeof CANDIDATE_INVARIANT_REVIEW_OUTCOMES[number];

export interface CandidateInvariantScope {
  readonly tenantRefDigest: string;
  readonly baselineCohortRefDigest: string;
  readonly consequenceClass: string;
  readonly actionType: string;
  readonly appliesToPackFamilies: readonly string[];
}

export interface CandidateInvariantPattern {
  readonly templateKind: CandidateInvariantTemplateKind;
  readonly naturalLanguage: string;
  readonly formalShape: string;
  readonly parameters: Readonly<Record<string, string | number | boolean | null>>;
}

export interface CreateCandidateInvariantInput {
  readonly candidateId: string;
  readonly generatedAt: string;
  readonly kind: CandidateInvariantKind;
  readonly effect: CandidateInvariantEffect;
  readonly pattern: CandidateInvariantPattern;
  readonly scope: CandidateInvariantScope;
  readonly baselineCohort: BaselineCohortCandidate;
  readonly baselinePromotion?: BaselineCohortPromotionEvaluation | null;
  readonly evidenceBases: readonly CandidateInvariantEvidenceBasis[];
  readonly evidenceRefDigests?: readonly string[] | null;
  readonly counterexampleReplayRefDigest?: string | null;
  readonly reviewerRefDigest?: string | null;
  readonly declaredDangerFlags?: readonly CandidateInvariantDangerFlag[] | null;
}

export interface CandidateInvariant {
  readonly version: typeof CANDIDATE_INVARIANTS_CATALOG_VERSION;
  readonly candidateId: string;
  readonly invariantRefDigest: string;
  readonly generatedAt: string;
  readonly kind: CandidateInvariantKind;
  readonly effect: CandidateInvariantEffect;
  readonly pattern: CandidateInvariantPattern;
  readonly scope: CandidateInvariantScope;
  readonly baselineCohortContractVersion: typeof BASELINE_COHORT_CONTRACT_VERSION;
  readonly baselineCohortDigest: string;
  readonly baselineCohortRefDigest: string;
  readonly baselinePromotionOutcome: BaselineCohortPromotionEvaluation['outcome'];
  readonly evidenceBases: readonly CandidateInvariantEvidenceBasis[];
  readonly evidenceRefDigests: readonly string[];
  readonly counterexampleReplayRefDigest: string | null;
  readonly reviewerRefDigest: string | null;
  readonly dangerFlags: readonly CandidateInvariantDangerFlag[];
  readonly reviewOutcome: CandidateInvariantReviewOutcome;
  readonly reasonCodes: readonly string[];
  readonly noFrequencyImpliesSafety: true;
  readonly noRelaxation: true;
  readonly reviewerRequired: true;
  readonly counterexampleReplayRequired: true;
  readonly autoPromote: false;
  readonly learnsFromTraffic: false;
  readonly trainingEnabled: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CandidateInvariantReviewEvaluation {
  readonly version: typeof CANDIDATE_INVARIANTS_CATALOG_VERSION;
  readonly invariantRefDigest: string;
  readonly outcome: CandidateInvariantReviewOutcome;
  readonly readyForReviewer: boolean;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly string[];
  readonly dangerFlags: readonly CandidateInvariantDangerFlag[];
  readonly autoPromote: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CandidateInvariantsCatalogDescriptor {
  readonly version: typeof CANDIDATE_INVARIANTS_CATALOG_VERSION;
  readonly baselineCohortContractVersion: typeof BASELINE_COHORT_CONTRACT_VERSION;
  readonly kinds: readonly CandidateInvariantKind[];
  readonly templateKinds: readonly CandidateInvariantTemplateKind[];
  readonly evidenceBases: readonly CandidateInvariantEvidenceBasis[];
  readonly effects: readonly CandidateInvariantEffect[];
  readonly dangerFlags: readonly CandidateInvariantDangerFlag[];
  readonly reviewOutcomes: readonly CandidateInvariantReviewOutcome[];
  readonly frequencyImpliesSafetyRejected: true;
  readonly counterexampleReplayRequired: true;
  readonly reviewerRequired: true;
  readonly noRelaxation: true;
  readonly noAutoPromotion: true;
  readonly learnsFromTraffic: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const REJECTING_DANGER_FLAGS = new Set<CandidateInvariantDangerFlag>([
  'frequency-implies-safety',
  'cross-tenant-generalization',
  'relaxes-existing-control',
  'uses-blocked-traffic',
  'raw-material-dependent',
  'silent-authority-upgrade',
]);

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

function digestValue(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Candidate invariant ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Candidate invariant ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Candidate invariant ${fieldName} must be a sha256 digest.`);
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
    throw new Error(`Candidate invariant ${fieldName} must be an ISO timestamp.`);
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
    throw new Error(`Candidate invariant ${fieldName} is not supported.`);
  }
  return normalized as Values[number];
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) =>
    normalizeIdentifier(value, 'string[]'),
  ))].sort());
}

function uniqueDigests(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value, index) =>
    normalizeDigest(value, `digest[${index}]`),
  ))].sort());
}

function normalizeEvidenceBases(
  values: readonly CandidateInvariantEvidenceBasis[],
): readonly CandidateInvariantEvidenceBasis[] {
  if (values.length === 0) {
    throw new Error('Candidate invariant evidenceBases requires at least one basis.');
  }
  return Object.freeze([...new Set(values.map((value) =>
    normalizeEnumValue(
      value,
      CANDIDATE_INVARIANT_EVIDENCE_BASES,
      'evidenceBases[]',
    ) as CandidateInvariantEvidenceBasis,
  ))].sort());
}

function normalizeDangerFlags(
  values: readonly CandidateInvariantDangerFlag[] | null | undefined,
): readonly CandidateInvariantDangerFlag[] {
  return Object.freeze([...new Set((values ?? []).map((value) =>
    normalizeEnumValue(
      value,
      CANDIDATE_INVARIANT_DANGER_FLAGS,
      'dangerFlags[]',
    ) as CandidateInvariantDangerFlag,
  ))].sort());
}

function normalizePattern(pattern: CandidateInvariantPattern): CandidateInvariantPattern {
  const parameters = Object.freeze({ ...pattern.parameters });
  return Object.freeze({
    templateKind: normalizeEnumValue(
      pattern.templateKind,
      CANDIDATE_INVARIANT_TEMPLATE_KINDS,
      'pattern.templateKind',
    ) as CandidateInvariantTemplateKind,
    naturalLanguage: normalizeIdentifier(pattern.naturalLanguage, 'pattern.naturalLanguage'),
    formalShape: normalizeIdentifier(pattern.formalShape, 'pattern.formalShape'),
    parameters,
  });
}

function normalizeScope(
  scope: CandidateInvariantScope,
  baseline: BaselineCohortCandidate,
): CandidateInvariantScope {
  const tenantRefDigest = normalizeDigest(scope.tenantRefDigest, 'scope.tenantRefDigest');
  if (tenantRefDigest !== baseline.tenantRefDigest) {
    throw new Error('Candidate invariant scope must match the baseline cohort tenant.');
  }
  const baselineCohortRefDigest = normalizeDigest(
    scope.baselineCohortRefDigest,
    'scope.baselineCohortRefDigest',
  );
  if (baselineCohortRefDigest !== baseline.cohortRefDigest) {
    throw new Error('Candidate invariant scope must bind the baseline cohort ref digest.');
  }
  return Object.freeze({
    tenantRefDigest,
    baselineCohortRefDigest,
    consequenceClass: normalizeIdentifier(scope.consequenceClass, 'scope.consequenceClass'),
    actionType: normalizeIdentifier(scope.actionType, 'scope.actionType'),
    appliesToPackFamilies: uniqueStrings(scope.appliesToPackFamilies),
  });
}

function derivedDangerFlags(input: {
  readonly effect: CandidateInvariantEffect;
  readonly baselineCohort: BaselineCohortCandidate;
  readonly baselinePromotion: BaselineCohortPromotionEvaluation;
  readonly evidenceBases: readonly CandidateInvariantEvidenceBasis[];
  readonly counterexampleReplayRefDigest: string | null;
  readonly reviewerRefDigest: string | null;
  readonly declaredDangerFlags: readonly CandidateInvariantDangerFlag[];
}): readonly CandidateInvariantDangerFlag[] {
  const flags = new Set<CandidateInvariantDangerFlag>(input.declaredDangerFlags);
  if (input.evidenceBases.includes('frequency-only')) {
    flags.add('frequency-implies-safety');
  }
  if (input.effect === 'relaxation-requested') {
    flags.add('relaxes-existing-control');
  }
  if (input.baselineCohort.safetyLabel !== 'eligible') {
    flags.add('unsafe-baseline-cohort');
  }
  if (input.baselinePromotion.outcome === 'held-for-sample-floor') {
    flags.add('insufficient-sample');
  }
  if (!input.counterexampleReplayRefDigest) {
    flags.add('missing-counterexample-replay');
  }
  if (!input.reviewerRefDigest) {
    flags.add('unreviewed-promotion');
  }
  return normalizeDangerFlags([...flags]);
}

function reviewOutcomeFor(input: {
  readonly baselinePromotion: BaselineCohortPromotionEvaluation;
  readonly dangerFlags: readonly CandidateInvariantDangerFlag[];
  readonly counterexampleReplayRefDigest: string | null;
  readonly reviewerRefDigest: string | null;
}): CandidateInvariantReviewOutcome {
  if (input.dangerFlags.some((flag) => REJECTING_DANGER_FLAGS.has(flag))) {
    return 'rejected-danger-flag';
  }
  if (!input.baselinePromotion.promotionAllowed) {
    return 'held-for-baseline';
  }
  if (!input.counterexampleReplayRefDigest) {
    return 'held-for-counterexample-replay';
  }
  if (!input.reviewerRefDigest) {
    return 'held-for-review';
  }
  return 'review-ready';
}

function reasonCodesFor(input: {
  readonly reviewOutcome: CandidateInvariantReviewOutcome;
  readonly dangerFlags: readonly CandidateInvariantDangerFlag[];
  readonly baselinePromotion: BaselineCohortPromotionEvaluation;
}): readonly string[] {
  const reasonCodes = new Set<string>([
    `candidate-invariant-${input.reviewOutcome}`,
    ...input.baselinePromotion.reasonCodes,
    ...input.dangerFlags.map((flag) => `candidate-invariant-${flag}`),
  ]);
  if (input.dangerFlags.length === 0) {
    reasonCodes.add('candidate-invariant-no-danger-flags');
  }
  return Object.freeze([...reasonCodes].sort());
}

export function createCandidateInvariantFromBaseline(
  input: CreateCandidateInvariantInput,
): CandidateInvariant {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const candidateId = normalizeIdentifier(input.candidateId, 'candidateId');
  const kind = normalizeEnumValue(
    input.kind,
    CANDIDATE_INVARIANT_KINDS,
    'kind',
  ) as CandidateInvariantKind;
  const effect = normalizeEnumValue(
    input.effect,
    CANDIDATE_INVARIANT_EFFECTS,
    'effect',
  ) as CandidateInvariantEffect;
  const pattern = normalizePattern(input.pattern);
  const scope = normalizeScope(input.scope, input.baselineCohort);
  const baselinePromotion = input.baselinePromotion ??
    evaluateBaselineCohortPromotion({ candidate: input.baselineCohort });
  const evidenceBases = normalizeEvidenceBases(input.evidenceBases);
  const evidenceRefDigests = uniqueDigests([
    ...input.baselineCohort.evidenceRefDigests,
    ...(input.evidenceRefDigests ?? []),
  ]);
  const counterexampleReplayRefDigest = normalizeOptionalDigest(
    input.counterexampleReplayRefDigest,
    'counterexampleReplayRefDigest',
  );
  const reviewerRefDigest = normalizeOptionalDigest(
    input.reviewerRefDigest,
    'reviewerRefDigest',
  );
  const dangerFlags = derivedDangerFlags({
    effect,
    baselineCohort: input.baselineCohort,
    baselinePromotion,
    evidenceBases,
    counterexampleReplayRefDigest,
    reviewerRefDigest,
    declaredDangerFlags: normalizeDangerFlags(input.declaredDangerFlags),
  });
  const reviewOutcome = reviewOutcomeFor({
    baselinePromotion,
    dangerFlags,
    counterexampleReplayRefDigest,
    reviewerRefDigest,
  });
  const invariantRefDigest = digestValue('candidate-invariant-ref', {
    version: CANDIDATE_INVARIANTS_CATALOG_VERSION,
    candidateId,
    kind,
    effect,
    templateKind: pattern.templateKind,
    baselineCohortRefDigest: input.baselineCohort.cohortRefDigest,
  } as CanonicalReleaseJsonValue);
  const reasonCodes = reasonCodesFor({
    reviewOutcome,
    dangerFlags,
    baselinePromotion,
  });
  const payload = {
    version: CANDIDATE_INVARIANTS_CATALOG_VERSION,
    candidateId,
    invariantRefDigest,
    generatedAt,
    kind,
    effect,
    pattern,
    scope,
    baselineCohortContractVersion: BASELINE_COHORT_CONTRACT_VERSION,
    baselineCohortDigest: input.baselineCohort.digest,
    baselineCohortRefDigest: input.baselineCohort.cohortRefDigest,
    baselinePromotionOutcome: baselinePromotion.outcome,
    evidenceBases,
    evidenceRefDigests,
    counterexampleReplayRefDigest,
    reviewerRefDigest,
    dangerFlags,
    reviewOutcome,
    reasonCodes,
    noFrequencyImpliesSafety: true,
    noRelaxation: true,
    reviewerRequired: true,
    counterexampleReplayRequired: true,
    autoPromote: false,
    learnsFromTraffic: false,
    trainingEnabled: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function evaluateCandidateInvariantReviewReadiness(
  candidate: CandidateInvariant,
): CandidateInvariantReviewEvaluation {
  const readyForReviewer = candidate.reviewOutcome === 'review-ready';
  const payload = {
    version: CANDIDATE_INVARIANTS_CATALOG_VERSION,
    invariantRefDigest: candidate.invariantRefDigest,
    outcome: candidate.reviewOutcome,
    readyForReviewer,
    failClosed: !readyForReviewer,
    reasonCodes: candidate.reasonCodes,
    dangerFlags: candidate.dangerFlags,
    autoPromote: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function candidateInvariantsCatalogDescriptor():
  CandidateInvariantsCatalogDescriptor {
  return Object.freeze({
    version: CANDIDATE_INVARIANTS_CATALOG_VERSION,
    baselineCohortContractVersion: BASELINE_COHORT_CONTRACT_VERSION,
    kinds: CANDIDATE_INVARIANT_KINDS,
    templateKinds: CANDIDATE_INVARIANT_TEMPLATE_KINDS,
    evidenceBases: CANDIDATE_INVARIANT_EVIDENCE_BASES,
    effects: CANDIDATE_INVARIANT_EFFECTS,
    dangerFlags: CANDIDATE_INVARIANT_DANGER_FLAGS,
    reviewOutcomes: CANDIDATE_INVARIANT_REVIEW_OUTCOMES,
    frequencyImpliesSafetyRejected: true,
    counterexampleReplayRequired: true,
    reviewerRequired: true,
    noRelaxation: true,
    noAutoPromotion: true,
    learnsFromTraffic: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-invariant-mining-engine',
      'not-learned-invariant-promotion',
      'not-live-enforcement',
      'not-policy-relaxation',
      'not-model-training',
      'not-production-ready',
    ]),
  });
}
