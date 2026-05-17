import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  type CanonicalShadowEvent,
} from './canonical-shadow-event-schema.js';
import {
  DECISION_TRACE_LOGGER_VERSION,
} from './decision-trace-logger.js';
import {
  SHADOW_RUNTIME_PIPELINE_VERSION,
} from './shadow-runtime-pipeline.js';
import {
  type SignalEvidenceRef,
} from './signal-relationship-contract.js';

export const BASELINE_COHORT_CONTRACT_VERSION =
  'attestor.baseline-cohort-contract.v1';

export const BASELINE_COHORT_SOURCE_ORIGINS = [
  'canonical-shadow-event',
  'shadow-runtime-pipeline',
  'decision-trace',
  'reviewer-label',
  'downstream-receipt',
  'incident-feedback',
] as const;
export type BaselineCohortSourceOrigin =
  typeof BASELINE_COHORT_SOURCE_ORIGINS[number];

export const BASELINE_COHORT_SOURCE_DECISIONS = [
  'admit',
  'narrow',
  'review',
  'block',
  'unknown',
] as const;
export type BaselineCohortSourceDecision =
  typeof BASELINE_COHORT_SOURCE_DECISIONS[number];

export const BASELINE_COHORT_EXCLUDED_SOURCE_DECISIONS = [
  'block',
] as const;
export type BaselineCohortExcludedSourceDecision =
  typeof BASELINE_COHORT_EXCLUDED_SOURCE_DECISIONS[number];

export const BASELINE_COHORT_SAFETY_LABELS = [
  'eligible',
  'needs-review',
  'poisoning-risk',
] as const;
export type BaselineCohortSafetyLabel =
  typeof BASELINE_COHORT_SAFETY_LABELS[number];

export const BASELINE_COHORT_PROMOTION_OUTCOMES = [
  'eligible-for-invariant-candidate-review',
  'held-for-review',
  'held-for-sample-floor',
  'held-for-safety-label',
  'rejected-relaxation',
] as const;
export type BaselineCohortPromotionOutcome =
  typeof BASELINE_COHORT_PROMOTION_OUTCOMES[number];

export const BASELINE_COHORT_MUTATION_MODES = [
  'strengthen-only',
  'relaxation-requested',
] as const;
export type BaselineCohortMutationMode =
  typeof BASELINE_COHORT_MUTATION_MODES[number];

export const BASELINE_COHORT_DEFAULT_MIN_SOURCE_EVENTS_FOR_PROMOTION = 3;

export interface BaselineCohortSourceEvent {
  readonly sourceOrigin: BaselineCohortSourceOrigin;
  readonly sourceEventDigest: string;
  readonly tenantRefDigest: string;
  readonly envelopeRefDigest: string | null;
  readonly traceRefDigest: string | null;
  readonly observedAt: string;
  readonly decision: BaselineCohortSourceDecision;
  readonly evidenceRefDigests: readonly string[];
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
}

export interface CreateBaselineCohortSourceFromShadowEventInput {
  readonly event: CanonicalShadowEvent;
  readonly sourceOrigin?: BaselineCohortSourceOrigin | null;
  readonly envelopeRefDigest?: string | null;
  readonly traceRefDigest?: string | null;
}

export interface CreateBaselineCohortCandidateInput {
  readonly cohortId: string;
  readonly tenantRefDigest: string;
  readonly generatedAt: string;
  readonly sourceEvents: readonly BaselineCohortSourceEvent[];
  readonly reviewerAffirmed?: boolean | null;
  readonly reviewerRefDigest?: string | null;
  readonly minimumSourceEventCountForPromotion?: number | null;
  readonly safetyLabel?: BaselineCohortSafetyLabel | null;
}

export interface BaselineCohortPromotionGate {
  readonly reviewerAffirmationRequired: true;
  readonly reviewerAffirmed: boolean;
  readonly reviewerRefDigest: string | null;
  readonly autoPromotionAllowed: false;
  readonly allowedMutationMode: 'strengthen-only';
  readonly relaxationAllowed: false;
  readonly minimumSourceEventCountForPromotion: number;
}

export interface BaselineCohortCandidate {
  readonly version: typeof BASELINE_COHORT_CONTRACT_VERSION;
  readonly cohortId: string;
  readonly cohortRefDigest: string;
  readonly tenantRefDigest: string;
  readonly generatedAt: string;
  readonly sourceEvents: readonly BaselineCohortSourceEvent[];
  readonly sourceEventCount: number;
  readonly sourceEventDigests: readonly string[];
  readonly safetyLabel: BaselineCohortSafetyLabel;
  readonly evidenceRefDigests: readonly string[];
  readonly promotionGate: BaselineCohortPromotionGate;
  readonly learnsFromTraffic: false;
  readonly trainingEnabled: false;
  readonly autoPromote: false;
  readonly crossTenantAggregation: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface EvaluateBaselineCohortPromotionInput {
  readonly candidate: BaselineCohortCandidate;
  readonly requestedMutationMode?: BaselineCohortMutationMode | null;
  readonly reviewerAffirmed?: boolean | null;
}

export interface BaselineCohortPromotionEvaluation {
  readonly version: typeof BASELINE_COHORT_CONTRACT_VERSION;
  readonly cohortRefDigest: string;
  readonly outcome: BaselineCohortPromotionOutcome;
  readonly promotionAllowed: boolean;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly string[];
  readonly reviewerAffirmationRequired: true;
  readonly autoPromotionAllowed: false;
  readonly relaxationAllowed: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface BaselineCohortContractDescriptor {
  readonly version: typeof BASELINE_COHORT_CONTRACT_VERSION;
  readonly canonicalShadowEventSchemaVersion:
    typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly shadowRuntimePipelineVersion: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly decisionTraceLoggerVersion: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly sourceOrigins: readonly BaselineCohortSourceOrigin[];
  readonly sourceDecisions: readonly BaselineCohortSourceDecision[];
  readonly excludedSourceDecisions: readonly BaselineCohortExcludedSourceDecision[];
  readonly safetyLabels: readonly BaselineCohortSafetyLabel[];
  readonly promotionOutcomes: readonly BaselineCohortPromotionOutcome[];
  readonly mutationModes: readonly BaselineCohortMutationMode[];
  readonly defaultMinimumSourceEventCountForPromotion: number;
  readonly reviewerAffirmationRequired: true;
  readonly excludesBlockedTraffic: true;
  readonly digestOnlyEvidenceRequired: true;
  readonly noRawPayload: true;
  readonly noCrossTenantAggregation: true;
  readonly noAutoPromotion: true;
  readonly noRelaxation: true;
  readonly learnsFromTraffic: false;
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

function digestValue(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Baseline cohort ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 512 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Baseline cohort ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Baseline cohort ${fieldName} must be a sha256 digest.`);
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
    throw new Error(`Baseline cohort ${fieldName} must be an ISO timestamp.`);
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
    throw new Error(`Baseline cohort ${fieldName} is not supported.`);
  }
  return normalized as Values[number];
}

function uniqueDigests(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value, index) =>
    normalizeDigest(value, `digest[${index}]`),
  ))].sort());
}

function normalizeMinimumSourceEventCount(value: number | null | undefined): number {
  const candidate = value ?? BASELINE_COHORT_DEFAULT_MIN_SOURCE_EVENTS_FOR_PROMOTION;
  if (!Number.isInteger(candidate) || candidate <= 0) {
    throw new Error(
      'Baseline cohort minimumSourceEventCountForPromotion must be a positive integer.',
    );
  }
  return candidate;
}

function normalizeSourceEvent(
  event: BaselineCohortSourceEvent,
  tenantRefDigest: string,
  index: number,
): BaselineCohortSourceEvent {
  const sourceOrigin = normalizeEnumValue(
    event.sourceOrigin,
    BASELINE_COHORT_SOURCE_ORIGINS,
    `sourceEvents[${index}].sourceOrigin`,
  ) as BaselineCohortSourceOrigin;
  const decision = normalizeEnumValue(
    event.decision,
    BASELINE_COHORT_SOURCE_DECISIONS,
    `sourceEvents[${index}].decision`,
  ) as BaselineCohortSourceDecision;

  if (decision === 'block') {
    throw new Error('Baseline cohort sourceEvents must exclude block decisions.');
  }

  const normalizedTenant = normalizeDigest(
    event.tenantRefDigest,
    `sourceEvents[${index}].tenantRefDigest`,
  );
  if (normalizedTenant !== tenantRefDigest) {
    throw new Error('Baseline cohort sourceEvents must stay within one tenant.');
  }

  if (
    event.rawPayloadStored !== false ||
    event.rawPromptStored !== false ||
    event.rawProviderBodyStored !== false
  ) {
    throw new Error('Baseline cohort sourceEvents must not store raw material.');
  }

  return Object.freeze({
    sourceOrigin,
    sourceEventDigest: normalizeDigest(
      event.sourceEventDigest,
      `sourceEvents[${index}].sourceEventDigest`,
    ),
    tenantRefDigest: normalizedTenant,
    envelopeRefDigest: normalizeOptionalDigest(
      event.envelopeRefDigest,
      `sourceEvents[${index}].envelopeRefDigest`,
    ),
    traceRefDigest: normalizeOptionalDigest(
      event.traceRefDigest,
      `sourceEvents[${index}].traceRefDigest`,
    ),
    observedAt: normalizeIsoTimestamp(
      event.observedAt,
      `sourceEvents[${index}].observedAt`,
    ),
    decision,
    evidenceRefDigests: uniqueDigests(event.evidenceRefDigests),
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  });
}

function assertCanonicalShadowEvent(event: CanonicalShadowEvent): void {
  if (event.version !== CANONICAL_SHADOW_EVENT_SCHEMA_VERSION) {
    throw new Error('Baseline cohort source event must use canonical shadow event schema v1.');
  }
  normalizeDigest(event.digest, 'event.digest');
  normalizeDigest(event.tenantRefDigest, 'event.tenantRefDigest');
  if (
    event.rawPayloadStored !== false ||
    event.rawMaterialBoundary.rawPayloadStored !== false ||
    event.rawMaterialBoundary.rawPromptStored !== false ||
    event.rawMaterialBoundary.rawProviderBodyStored !== false
  ) {
    throw new Error('Baseline cohort source event must not contain raw material.');
  }
}

function decisionFromShadowEvent(event: CanonicalShadowEvent): BaselineCohortSourceDecision {
  return event.decision.effectiveDecision ?? 'unknown';
}

function collectShadowEventEvidenceDigests(event: CanonicalShadowEvent): readonly string[] {
  return uniqueDigests([
    event.digest,
    ...event.evidenceRefs.map((ref) => ref.digest),
    ...event.approvalRefs.map((ref) => ref.digest),
    ...event.receiptRefs.map((ref) => ref.digest),
    ...event.policyRefs.map((ref) => ref.digest),
    ...event.simulationRefs.map((ref) => ref.digest),
    event.schemaRefDigest,
    event.replayRefDigest,
    event.idempotencyRefDigest,
  ].filter((digest): digest is string => typeof digest === 'string'));
}

function safetyLabelFor(
  sourceEvents: readonly BaselineCohortSourceEvent[],
  requested: BaselineCohortSafetyLabel | null | undefined,
): BaselineCohortSafetyLabel {
  if (requested) {
    return normalizeEnumValue(
      requested,
      BASELINE_COHORT_SAFETY_LABELS,
      'safetyLabel',
    ) as BaselineCohortSafetyLabel;
  }
  if (sourceEvents.some((event) => event.decision === 'unknown')) {
    return 'poisoning-risk';
  }
  if (sourceEvents.some((event) => event.decision === 'review')) {
    return 'needs-review';
  }
  return 'eligible';
}

function orderedReasonCodes(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) =>
    normalizeIdentifier(value, 'reasonCodes[]'),
  ))].sort());
}

export function createBaselineCohortSourceFromShadowEvent(
  input: CreateBaselineCohortSourceFromShadowEventInput,
): BaselineCohortSourceEvent {
  assertCanonicalShadowEvent(input.event);
  const sourceOrigin = normalizeEnumValue(
    input.sourceOrigin ?? 'canonical-shadow-event',
    BASELINE_COHORT_SOURCE_ORIGINS,
    'sourceOrigin',
  ) as BaselineCohortSourceOrigin;
  return Object.freeze({
    sourceOrigin,
    sourceEventDigest: input.event.digest,
    tenantRefDigest: input.event.tenantRefDigest,
    envelopeRefDigest: normalizeOptionalDigest(input.envelopeRefDigest, 'envelopeRefDigest'),
    traceRefDigest: normalizeOptionalDigest(
      input.traceRefDigest ?? input.event.traceRefDigest,
      'traceRefDigest',
    ),
    observedAt: input.event.observedAt,
    decision: decisionFromShadowEvent(input.event),
    evidenceRefDigests: collectShadowEventEvidenceDigests(input.event),
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  });
}

export function createBaselineCohortCandidate(
  input: CreateBaselineCohortCandidateInput,
): BaselineCohortCandidate {
  const tenantRefDigest = normalizeDigest(input.tenantRefDigest, 'tenantRefDigest');
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const cohortId = normalizeIdentifier(input.cohortId, 'cohortId');
  if (input.sourceEvents.length === 0) {
    throw new Error('Baseline cohort requires at least one source event.');
  }
  const sourceEvents = Object.freeze(input.sourceEvents.map((event, index) =>
    normalizeSourceEvent(event, tenantRefDigest, index)
  ));
  const sourceEventDigests = uniqueDigests(
    sourceEvents.map((event) => event.sourceEventDigest),
  );
  if (sourceEventDigests.length !== sourceEvents.length) {
    throw new Error('Baseline cohort sourceEvents must be unique by digest.');
  }
  const safetyLabel = safetyLabelFor(sourceEvents, input.safetyLabel);
  const evidenceRefDigests = uniqueDigests(
    sourceEvents.flatMap((event) => event.evidenceRefDigests),
  );
  const minimumSourceEventCountForPromotion =
    normalizeMinimumSourceEventCount(input.minimumSourceEventCountForPromotion);
  const reviewerRefDigest = normalizeOptionalDigest(
    input.reviewerRefDigest,
    'reviewerRefDigest',
  );
  const reviewerAffirmed = input.reviewerAffirmed === true;
  const cohortRefDigest = digestValue('baseline-cohort-ref', {
    version: BASELINE_COHORT_CONTRACT_VERSION,
    cohortId,
    tenantRefDigest,
    sourceEventDigests,
    safetyLabel,
  } as CanonicalReleaseJsonValue);
  const payload = {
    version: BASELINE_COHORT_CONTRACT_VERSION,
    cohortId,
    cohortRefDigest,
    tenantRefDigest,
    generatedAt,
    sourceEvents,
    sourceEventCount: sourceEvents.length,
    sourceEventDigests,
    safetyLabel,
    evidenceRefDigests,
    promotionGate: {
      reviewerAffirmationRequired: true,
      reviewerAffirmed,
      reviewerRefDigest,
      autoPromotionAllowed: false,
      allowedMutationMode: 'strengthen-only',
      relaxationAllowed: false,
      minimumSourceEventCountForPromotion,
    },
    learnsFromTraffic: false,
    trainingEnabled: false,
    autoPromote: false,
    crossTenantAggregation: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
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

export function evaluateBaselineCohortPromotion(
  input: EvaluateBaselineCohortPromotionInput,
): BaselineCohortPromotionEvaluation {
  const mutationMode = normalizeEnumValue(
    input.requestedMutationMode ?? 'strengthen-only',
    BASELINE_COHORT_MUTATION_MODES,
    'requestedMutationMode',
  ) as BaselineCohortMutationMode;
  const reviewerAffirmed = input.reviewerAffirmed ?? input.candidate.promotionGate.reviewerAffirmed;
  const reasonCodes: string[] = [];
  let outcome: BaselineCohortPromotionOutcome =
    'eligible-for-invariant-candidate-review';

  if (mutationMode !== 'strengthen-only') {
    outcome = 'rejected-relaxation';
    reasonCodes.push('baseline-cohort-relaxation-rejected');
  } else if (input.candidate.safetyLabel !== 'eligible') {
    outcome = 'held-for-safety-label';
    reasonCodes.push(`baseline-cohort-${input.candidate.safetyLabel}`);
  } else if (
    input.candidate.sourceEventCount <
    input.candidate.promotionGate.minimumSourceEventCountForPromotion
  ) {
    outcome = 'held-for-sample-floor';
    reasonCodes.push('baseline-cohort-sample-floor');
  } else if (reviewerAffirmed !== true) {
    outcome = 'held-for-review';
    reasonCodes.push('baseline-cohort-reviewer-affirmation-required');
  } else {
    reasonCodes.push('baseline-cohort-ready-for-invariant-candidate-review');
  }

  const promotionAllowed = outcome === 'eligible-for-invariant-candidate-review';
  const payload = {
    version: BASELINE_COHORT_CONTRACT_VERSION,
    cohortRefDigest: input.candidate.cohortRefDigest,
    outcome,
    promotionAllowed,
    failClosed: !promotionAllowed,
    reasonCodes: orderedReasonCodes(reasonCodes),
    reviewerAffirmationRequired: true,
    autoPromotionAllowed: false,
    relaxationAllowed: false,
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

export function baselineCohortContractDescriptor():
  BaselineCohortContractDescriptor {
  return Object.freeze({
    version: BASELINE_COHORT_CONTRACT_VERSION,
    canonicalShadowEventSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    decisionTraceLoggerVersion: DECISION_TRACE_LOGGER_VERSION,
    sourceOrigins: BASELINE_COHORT_SOURCE_ORIGINS,
    sourceDecisions: BASELINE_COHORT_SOURCE_DECISIONS,
    excludedSourceDecisions: BASELINE_COHORT_EXCLUDED_SOURCE_DECISIONS,
    safetyLabels: BASELINE_COHORT_SAFETY_LABELS,
    promotionOutcomes: BASELINE_COHORT_PROMOTION_OUTCOMES,
    mutationModes: BASELINE_COHORT_MUTATION_MODES,
    defaultMinimumSourceEventCountForPromotion:
      BASELINE_COHORT_DEFAULT_MIN_SOURCE_EVENTS_FOR_PROMOTION,
    reviewerAffirmationRequired: true,
    excludesBlockedTraffic: true,
    digestOnlyEvidenceRequired: true,
    noRawPayload: true,
    noCrossTenantAggregation: true,
    noAutoPromotion: true,
    noRelaxation: true,
    learnsFromTraffic: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-baseline-mining-engine',
      'not-learned-invariant-promotion',
      'not-live-enforcement',
      'not-cross-tenant-aggregation',
      'not-model-training',
      'not-production-ready',
    ]),
  });
}

export function evidenceRefDigestsForSignals(
  refs: readonly SignalEvidenceRef[],
): readonly string[] {
  return uniqueDigests(refs.map((ref) => ref.digest));
}
