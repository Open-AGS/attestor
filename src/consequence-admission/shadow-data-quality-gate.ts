import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
} from './assurance-case-contract.js';
import {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  type CanonicalShadowEvent,
} from './canonical-shadow-event-schema.js';

export const SHADOW_DATA_QUALITY_GATE_VERSION =
  'attestor.shadow-data-quality-gate.v1';

export const SHADOW_DATA_QUALITY_GATE_DEFAULT_MAX_OBSERVATION_LAG_MS =
  5 * 60 * 1000;
export const SHADOW_DATA_QUALITY_GATE_DEFAULT_MIN_OBSERVED_FIELD_COUNT = 3;

export const SHADOW_DATA_QUALITY_GATE_SOURCE_ANCHORS = [
  'cloudevents-required-context-and-privacy',
  'opentelemetry-timestamp-observedtimestamp-traceid',
  'w3c-prov-provenance-data-model',
  'w3c-trace-context-correlation',
  'openlineage-producer-schemaurl-eventtime',
  'great-expectations-validation-result',
  'aws-deequ-unit-tests-for-data',
  'assurance-case-undermining-defeater',
] as const;
export type ShadowDataQualityGateSourceAnchor =
  typeof SHADOW_DATA_QUALITY_GATE_SOURCE_ANCHORS[number];

export const SHADOW_DATA_QUALITY_DIMENSIONS = [
  'schema',
  'provenance',
  'freshness',
  'coverage',
  'redaction',
  'correlation',
  'decision-integrity',
] as const;
export type ShadowDataQualityDimension =
  typeof SHADOW_DATA_QUALITY_DIMENSIONS[number];

export const SHADOW_DATA_QUALITY_CHECK_STATUSES = [
  'pass',
  'warn',
  'fail',
] as const;
export type ShadowDataQualityCheckStatus =
  typeof SHADOW_DATA_QUALITY_CHECK_STATUSES[number];

export const SHADOW_DATA_QUALITY_CHECK_IDS = [
  'canonical-schema-version',
  'raw-material-boundary',
  'evidence-ref-presence',
  'provenance-ref-presence',
  'schema-ref-presence',
  'trace-correlation',
  'replay-or-idempotency-correlation',
  'timestamp-order',
  'observation-lag',
  'observed-fact-coverage',
  'inferred-fact-ratio',
  'producer-trust',
  'decision-fail-closed-posture',
] as const;
export type ShadowDataQualityCheckId =
  typeof SHADOW_DATA_QUALITY_CHECK_IDS[number];

export const SHADOW_DATA_QUALITY_DANGER_FLAGS = [
  'raw-material-present',
  'evidence-ref-missing',
  'provenance-ref-missing',
  'schema-ref-missing',
  'trace-ref-missing',
  'replay-or-idempotency-ref-missing',
  'observed-before-occurred',
  'observation-lag-exceeded',
  'observed-facts-sparse',
  'inferred-facts-dominate',
  'inferred-reference-origin',
  'producer-untrusted',
  'decision-fail-open',
  'assurance-case-unbound',
] as const;
export type ShadowDataQualityDangerFlag =
  typeof SHADOW_DATA_QUALITY_DANGER_FLAGS[number];

export const SHADOW_DATA_QUALITY_OUTCOMES = [
  'quality-ready-for-assurance-evidence',
  'quality-open-undermining-defeater',
  'quality-held-for-provenance',
  'quality-held-for-assurance-case',
  'quality-rejected-raw-material',
] as const;
export type ShadowDataQualityOutcome =
  typeof SHADOW_DATA_QUALITY_OUTCOMES[number];

export interface ShadowDataQualityCheck {
  readonly checkId: ShadowDataQualityCheckId;
  readonly dimension: ShadowDataQualityDimension;
  readonly status: ShadowDataQualityCheckStatus;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefDigests: readonly string[];
}

export interface CreateShadowDataQualityGateInput {
  readonly event: CanonicalShadowEvent;
  readonly evaluatedAt: string;
  readonly evaluatorRefDigest: string;
  readonly assuranceCaseRefDigest?: string | null;
  readonly attacksNodeId?: string | null;
  readonly trustedProducers?: readonly string[] | null;
  readonly maxObservationLagMs?: number | null;
  readonly minimumObservedFieldCount?: number | null;
  readonly requireTraceRef?: boolean | null;
  readonly requireReplayOrIdempotencyRef?: boolean | null;
}

export interface ShadowDataQualityGateRecord {
  readonly version: typeof SHADOW_DATA_QUALITY_GATE_VERSION;
  readonly canonicalShadowEventSchemaVersion:
    typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly assuranceCaseContractVersion:
    typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly eventId: string;
  readonly sourceEventDigest: string;
  readonly tenantRefDigest: string;
  readonly producer: string;
  readonly sourceKind: CanonicalShadowEvent['sourceKind'];
  readonly evaluatedAt: string;
  readonly evaluatorRefDigest: string;
  readonly assuranceCaseRefDigest: string | null;
  readonly attacksNodeId: string | null;
  readonly observedFieldCount: number;
  readonly inferredFieldCount: number;
  readonly observationLagMs: number;
  readonly maxObservationLagMs: number;
  readonly minimumObservedFieldCount: number;
  readonly evidenceRefCount: number;
  readonly provenanceRefCount: number;
  readonly approvalRefCount: number;
  readonly receiptRefCount: number;
  readonly policyRefCount: number;
  readonly traceRefPresent: boolean;
  readonly replayOrIdempotencyRefPresent: boolean;
  readonly checks: readonly ShadowDataQualityCheck[];
  readonly passedCheckCount: number;
  readonly warningCheckCount: number;
  readonly failedCheckCount: number;
  readonly dangerFlags: readonly ShadowDataQualityDangerFlag[];
  readonly reasonCodes: readonly string[];
  readonly outcome: ShadowDataQualityOutcome;
  readonly readyForAssuranceEvidence: boolean;
  readonly underminingDefeaterRequired: boolean;
  readonly underminingDefeaterKind: 'undermining';
  readonly underminingDefeaterReasonCodes: readonly string[];
  readonly failClosed: boolean;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
  readonly rawWalletMaterialStored: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowDataQualityGateEvaluation {
  readonly version: typeof SHADOW_DATA_QUALITY_GATE_VERSION;
  readonly sourceEventDigest: string;
  readonly tenantRefDigest: string;
  readonly outcome: ShadowDataQualityOutcome;
  readonly readyForAssuranceEvidence: boolean;
  readonly underminingDefeaterRequired: boolean;
  readonly dangerFlags: readonly ShadowDataQualityDangerFlag[];
  readonly reasonCodes: readonly string[];
  readonly passedCheckCount: number;
  readonly warningCheckCount: number;
  readonly failedCheckCount: number;
  readonly failClosed: boolean;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowDataQualityGateDescriptor {
  readonly version: typeof SHADOW_DATA_QUALITY_GATE_VERSION;
  readonly canonicalShadowEventSchemaVersion:
    typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly assuranceCaseContractVersion:
    typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly sourceAnchors: readonly ShadowDataQualityGateSourceAnchor[];
  readonly dimensions: readonly ShadowDataQualityDimension[];
  readonly checkStatuses: readonly ShadowDataQualityCheckStatus[];
  readonly checkIds: readonly ShadowDataQualityCheckId[];
  readonly dangerFlags: readonly ShadowDataQualityDangerFlag[];
  readonly outcomes: readonly ShadowDataQualityOutcome[];
  readonly defaultMaxObservationLagMs:
    typeof SHADOW_DATA_QUALITY_GATE_DEFAULT_MAX_OBSERVATION_LAG_MS;
  readonly defaultMinimumObservedFieldCount:
    typeof SHADOW_DATA_QUALITY_GATE_DEFAULT_MIN_OBSERVED_FIELD_COUNT;
  readonly opensUnderminingDefeaters: true;
  readonly assuranceCaseContextRequired: true;
  readonly digestOnlyEvidence: true;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly learnsFromTraffic: false;
  readonly trainingEnabled: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

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

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`Shadow data quality gate ${fieldName} must be a sha256 digest reference.`);
  }
  return value;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Shadow data quality gate ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeNonNegativeNumber(
  value: number | null | undefined,
  fallback: number,
  fieldName: string,
): number {
  if (value === null || value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Shadow data quality gate ${fieldName} must be a non-negative number.`);
  }
  return value;
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fallback: number,
  fieldName: string,
): number {
  if (value === null || value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Shadow data quality gate ${fieldName} must be a positive integer.`);
  }
  return value;
}

function normalizeOptionalNodeId(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  if (!/^[a-z0-9][a-z0-9_.:-]{2,160}$/u.test(normalized)) {
    throw new Error('Shadow data quality gate attacksNodeId must be a stable lowercase id.');
  }
  return normalized;
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function assertCanonicalShadowEvent(event: CanonicalShadowEvent): void {
  if (event.version !== CANONICAL_SHADOW_EVENT_SCHEMA_VERSION) {
    throw new Error('Shadow data quality gate input must use canonical shadow event schema v1.');
  }
  normalizeDigest(event.digest, 'event.digest');
  normalizeDigest(event.tenantRefDigest, 'event.tenantRefDigest');
  normalizeDigest(event.actorRefDigest, 'event.actorRefDigest');
  if (event.cloudEventsSpecversion !== '1.0') {
    throw new Error('Shadow data quality gate input must preserve CloudEvents specversion 1.0.');
  }
  if (event.rawPayloadStored !== false || event.rawMaterialBoundary.rawPayloadStored !== false) {
    throw new Error('Shadow data quality gate input must not store raw payload material.');
  }
  if (event.autoEnforce !== false) {
    throw new Error('Shadow data quality gate input must be shadow-only.');
  }
}

function check(input: {
  readonly checkId: ShadowDataQualityCheckId;
  readonly dimension: ShadowDataQualityDimension;
  readonly status: ShadowDataQualityCheckStatus;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefDigests?: readonly string[];
}): ShadowDataQualityCheck {
  return Object.freeze({
    checkId: input.checkId,
    dimension: input.dimension,
    status: input.status,
    reasonCodes: uniqueSorted(input.reasonCodes),
    evidenceRefDigests: uniqueSorted(input.evidenceRefDigests ?? []),
  });
}

function statusFor(condition: boolean, failingStatus: 'warn' | 'fail'): ShadowDataQualityCheckStatus {
  return condition ? 'pass' : failingStatus;
}

function evidenceDigests(event: CanonicalShadowEvent): readonly string[] {
  return uniqueSorted([
    event.digest,
    ...event.evidenceRefs.map((ref) => ref.digest),
    ...event.simulationRefs.map((ref) => ref.digest),
    ...event.approvalRefs.map((ref) => ref.digest),
    ...event.receiptRefs.map((ref) => ref.digest),
    ...event.policyRefs.map((ref) => ref.digest),
    ...(event.traceRefDigest ? [event.traceRefDigest] : []),
    ...(event.schemaRefDigest ? [event.schemaRefDigest] : []),
    ...(event.replayRefDigest ? [event.replayRefDigest] : []),
    ...(event.idempotencyRefDigest ? [event.idempotencyRefDigest] : []),
  ]);
}

function flagsFromChecks(
  checks: readonly ShadowDataQualityCheck[],
  assuranceCaseRefDigest: string | null,
  attacksNodeId: string | null,
): readonly ShadowDataQualityDangerFlag[] {
  const flags: ShadowDataQualityDangerFlag[] = [];
  const reasonCodes = new Set(checks.flatMap((qualityCheck) => qualityCheck.reasonCodes));
  const mappings: readonly [string, ShadowDataQualityDangerFlag][] = [
    ['raw-material-present', 'raw-material-present'],
    ['evidence-ref-missing', 'evidence-ref-missing'],
    ['provenance-ref-missing', 'provenance-ref-missing'],
    ['schema-ref-missing', 'schema-ref-missing'],
    ['trace-ref-missing', 'trace-ref-missing'],
    ['replay-or-idempotency-ref-missing', 'replay-or-idempotency-ref-missing'],
    ['observed-before-occurred', 'observed-before-occurred'],
    ['observation-lag-exceeded', 'observation-lag-exceeded'],
    ['observed-facts-sparse', 'observed-facts-sparse'],
    ['inferred-facts-dominate', 'inferred-facts-dominate'],
    ['inferred-reference-origin', 'inferred-reference-origin'],
    ['producer-untrusted', 'producer-untrusted'],
    ['decision-fail-open', 'decision-fail-open'],
  ];
  for (const [reasonCode, flag] of mappings) {
    if (reasonCodes.has(reasonCode)) flags.push(flag);
  }
  if (assuranceCaseRefDigest === null || attacksNodeId === null) {
    flags.push('assurance-case-unbound');
  }
  return uniqueSorted(flags);
}

function outcomeFor(
  dangerFlags: readonly ShadowDataQualityDangerFlag[],
  failedCheckCount: number,
  warningCheckCount: number,
): ShadowDataQualityOutcome {
  if (dangerFlags.includes('raw-material-present')) {
    return 'quality-rejected-raw-material';
  }
  if (
    dangerFlags.includes('evidence-ref-missing') ||
    dangerFlags.includes('provenance-ref-missing') ||
    dangerFlags.includes('schema-ref-missing')
  ) {
    return 'quality-held-for-provenance';
  }
  if (dangerFlags.includes('assurance-case-unbound')) {
    return 'quality-held-for-assurance-case';
  }
  if (failedCheckCount > 0 || warningCheckCount > 0 || dangerFlags.length > 0) {
    return 'quality-open-undermining-defeater';
  }
  return 'quality-ready-for-assurance-evidence';
}

function buildChecks(input: {
  readonly event: CanonicalShadowEvent;
  readonly trustedProducers: ReadonlySet<string>;
  readonly maxObservationLagMs: number;
  readonly minimumObservedFieldCount: number;
  readonly requireTraceRef: boolean;
  readonly requireReplayOrIdempotencyRef: boolean;
  readonly observationLagMs: number;
}): readonly ShadowDataQualityCheck[] {
  const {
    event,
    trustedProducers,
    maxObservationLagMs,
    minimumObservedFieldCount,
    requireTraceRef,
    requireReplayOrIdempotencyRef,
    observationLagMs,
  } = input;
  const allEvidence = evidenceDigests(event);
  const provenanceRefs = event.evidenceRefs.filter((ref) => ref.kind === 'provenance');
  const hasTrace = event.traceRefDigest !== null;
  const hasReplayOrIdempotency =
    event.replayRefDigest !== null || event.idempotencyRefDigest !== null;
  const anyInferredRef = [
    ...event.evidenceRefs,
    ...event.simulationRefs,
    ...event.approvalRefs,
    ...event.receiptRefs,
    ...event.policyRefs,
  ].some((ref) => ref.origin === 'inferred');
  const producerTrusted =
    trustedProducers.size === 0 || trustedProducers.has(event.producer);
  const rawBoundaryClean =
    event.rawPayloadStored === false &&
    event.rawMaterialBoundary.rawPayloadStored === false &&
    event.rawMaterialBoundary.rawPromptStored === false &&
    event.rawMaterialBoundary.rawProviderBodyStored === false &&
    event.rawMaterialBoundary.rawWalletMaterialStored === false &&
    event.rawMaterialBoundary.rawCustomerIdentifierStored === false;
  const timestampOrdered = observationLagMs >= 0;
  const observationLagAllowed =
    timestampOrdered && observationLagMs <= maxObservationLagMs;
  const observedCoverageEnough =
    event.observedFieldCount >= minimumObservedFieldCount;
  const inferredDominates = event.inferredFieldCount > event.observedFieldCount;
  const decisionFailClosed =
    !(event.decision.allowed === true && event.decision.failClosed === false);

  return Object.freeze([
    check({
      checkId: 'canonical-schema-version',
      dimension: 'schema',
      status: 'pass',
      reasonCodes: ['canonical-schema-version-valid'],
      evidenceRefDigests: [event.digest, ...(event.schemaRefDigest ? [event.schemaRefDigest] : [])],
    }),
    check({
      checkId: 'raw-material-boundary',
      dimension: 'redaction',
      status: statusFor(rawBoundaryClean, 'fail'),
      reasonCodes: rawBoundaryClean ? ['raw-material-boundary-clean'] : ['raw-material-present'],
      evidenceRefDigests: [event.digest],
    }),
    check({
      checkId: 'evidence-ref-presence',
      dimension: 'provenance',
      status: statusFor(event.evidenceRefs.length > 0, 'fail'),
      reasonCodes: event.evidenceRefs.length > 0
        ? ['evidence-ref-present']
        : ['evidence-ref-missing'],
      evidenceRefDigests: event.evidenceRefs.map((ref) => ref.digest),
    }),
    check({
      checkId: 'provenance-ref-presence',
      dimension: 'provenance',
      status: statusFor(provenanceRefs.length > 0, 'fail'),
      reasonCodes: provenanceRefs.length > 0
        ? ['provenance-ref-present']
        : ['provenance-ref-missing'],
      evidenceRefDigests: provenanceRefs.map((ref) => ref.digest),
    }),
    check({
      checkId: 'schema-ref-presence',
      dimension: 'schema',
      status: statusFor(event.schemaRefDigest !== null, 'fail'),
      reasonCodes: event.schemaRefDigest !== null
        ? ['schema-ref-present']
        : ['schema-ref-missing'],
      evidenceRefDigests: event.schemaRefDigest ? [event.schemaRefDigest] : [],
    }),
    check({
      checkId: 'trace-correlation',
      dimension: 'correlation',
      status: requireTraceRef ? statusFor(hasTrace, 'warn') : 'pass',
      reasonCodes: hasTrace || !requireTraceRef
        ? ['trace-ref-policy-satisfied']
        : ['trace-ref-missing'],
      evidenceRefDigests: event.traceRefDigest ? [event.traceRefDigest] : [],
    }),
    check({
      checkId: 'replay-or-idempotency-correlation',
      dimension: 'correlation',
      status: requireReplayOrIdempotencyRef
        ? statusFor(hasReplayOrIdempotency, 'warn')
        : 'pass',
      reasonCodes: hasReplayOrIdempotency || !requireReplayOrIdempotencyRef
        ? ['replay-or-idempotency-ref-present']
        : ['replay-or-idempotency-ref-missing'],
      evidenceRefDigests: [
        ...(event.replayRefDigest ? [event.replayRefDigest] : []),
        ...(event.idempotencyRefDigest ? [event.idempotencyRefDigest] : []),
      ],
    }),
    check({
      checkId: 'timestamp-order',
      dimension: 'freshness',
      status: statusFor(timestampOrdered, 'fail'),
      reasonCodes: timestampOrdered
        ? ['timestamp-order-valid']
        : ['observed-before-occurred'],
      evidenceRefDigests: [event.digest],
    }),
    check({
      checkId: 'observation-lag',
      dimension: 'freshness',
      status: statusFor(observationLagAllowed, 'fail'),
      reasonCodes: observationLagAllowed
        ? ['observation-lag-within-window']
        : ['observation-lag-exceeded'],
      evidenceRefDigests: [event.digest],
    }),
    check({
      checkId: 'observed-fact-coverage',
      dimension: 'coverage',
      status: statusFor(observedCoverageEnough, 'warn'),
      reasonCodes: observedCoverageEnough
        ? ['observed-facts-sufficient']
        : ['observed-facts-sparse'],
      evidenceRefDigests: allEvidence,
    }),
    check({
      checkId: 'inferred-fact-ratio',
      dimension: 'coverage',
      status: statusFor(!inferredDominates && !anyInferredRef, 'warn'),
      reasonCodes: [
        ...(inferredDominates ? ['inferred-facts-dominate'] : []),
        ...(anyInferredRef ? ['inferred-reference-origin'] : []),
        ...(!inferredDominates && !anyInferredRef ? ['observed-evidence-dominates'] : []),
      ],
      evidenceRefDigests: allEvidence,
    }),
    check({
      checkId: 'producer-trust',
      dimension: 'provenance',
      status: statusFor(producerTrusted, 'warn'),
      reasonCodes: producerTrusted ? ['producer-trusted-or-unscoped'] : ['producer-untrusted'],
      evidenceRefDigests: [event.digest],
    }),
    check({
      checkId: 'decision-fail-closed-posture',
      dimension: 'decision-integrity',
      status: statusFor(decisionFailClosed, 'fail'),
      reasonCodes: decisionFailClosed
        ? ['decision-fail-closed-posture-clean']
        : ['decision-fail-open'],
      evidenceRefDigests: [event.digest],
    }),
  ]);
}

export function createShadowDataQualityGate(
  input: CreateShadowDataQualityGateInput,
): ShadowDataQualityGateRecord {
  const event = input.event;
  assertCanonicalShadowEvent(event);

  const evaluatedAt = normalizeIsoTimestamp(input.evaluatedAt, 'evaluatedAt');
  const evaluatorRefDigest = normalizeDigest(input.evaluatorRefDigest, 'evaluatorRefDigest');
  const assuranceCaseRefDigest = normalizeOptionalDigest(
    input.assuranceCaseRefDigest,
    'assuranceCaseRefDigest',
  );
  const attacksNodeId = normalizeOptionalNodeId(input.attacksNodeId);
  const maxObservationLagMs = normalizeNonNegativeNumber(
    input.maxObservationLagMs,
    SHADOW_DATA_QUALITY_GATE_DEFAULT_MAX_OBSERVATION_LAG_MS,
    'maxObservationLagMs',
  );
  const minimumObservedFieldCount = normalizePositiveInteger(
    input.minimumObservedFieldCount,
    SHADOW_DATA_QUALITY_GATE_DEFAULT_MIN_OBSERVED_FIELD_COUNT,
    'minimumObservedFieldCount',
  );
  const trustedProducers = new Set(
    (input.trustedProducers ?? [])
      .map((producer) => producer.trim())
      .filter((producer) => producer.length > 0),
  );
  const requireTraceRef = input.requireTraceRef ?? true;
  const requireReplayOrIdempotencyRef = input.requireReplayOrIdempotencyRef ?? true;
  const occurredAt = new Date(event.occurredAt).getTime();
  const observedAt = new Date(event.observedAt).getTime();
  const observationLagMs = observedAt - occurredAt;
  const checks = buildChecks({
    event,
    trustedProducers,
    maxObservationLagMs,
    minimumObservedFieldCount,
    requireTraceRef,
    requireReplayOrIdempotencyRef,
    observationLagMs,
  });
  const passedCheckCount = checks.filter((qualityCheck) => qualityCheck.status === 'pass').length;
  const warningCheckCount = checks.filter((qualityCheck) => qualityCheck.status === 'warn').length;
  const failedCheckCount = checks.filter((qualityCheck) => qualityCheck.status === 'fail').length;
  const dangerFlags = flagsFromChecks(checks, assuranceCaseRefDigest, attacksNodeId);
  const outcome = outcomeFor(dangerFlags, failedCheckCount, warningCheckCount);
  const readyForAssuranceEvidence = outcome === 'quality-ready-for-assurance-evidence';
  const reasonCodes = uniqueSorted([
    ...checks.flatMap((qualityCheck) => qualityCheck.reasonCodes),
    ...dangerFlags,
    ...(readyForAssuranceEvidence
      ? ['shadow-data-quality-ready-for-assurance-evidence']
      : ['shadow-data-quality-defeater-material']),
  ]);
  const underminingDefeaterRequired = !readyForAssuranceEvidence;
  const payload = {
    version: SHADOW_DATA_QUALITY_GATE_VERSION,
    canonicalShadowEventSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    eventId: event.eventId,
    sourceEventDigest: event.digest,
    tenantRefDigest: event.tenantRefDigest,
    producer: event.producer,
    sourceKind: event.sourceKind,
    evaluatedAt,
    evaluatorRefDigest,
    assuranceCaseRefDigest,
    attacksNodeId,
    observedFieldCount: event.observedFieldCount,
    inferredFieldCount: event.inferredFieldCount,
    observationLagMs,
    maxObservationLagMs,
    minimumObservedFieldCount,
    evidenceRefCount: event.evidenceRefs.length,
    provenanceRefCount: event.evidenceRefs.filter((ref) => ref.kind === 'provenance').length,
    approvalRefCount: event.approvalRefs.length,
    receiptRefCount: event.receiptRefs.length,
    policyRefCount: event.policyRefs.length,
    traceRefPresent: event.traceRefDigest !== null,
    replayOrIdempotencyRefPresent:
      event.replayRefDigest !== null || event.idempotencyRefDigest !== null,
    checks,
    passedCheckCount,
    warningCheckCount,
    failedCheckCount,
    dangerFlags,
    reasonCodes,
    outcome,
    readyForAssuranceEvidence,
    underminingDefeaterRequired,
    underminingDefeaterKind: 'undermining' as const,
    underminingDefeaterReasonCodes: underminingDefeaterRequired ? reasonCodes : Object.freeze([]),
    failClosed: !readyForAssuranceEvidence,
    rawPayloadRead: false as const,
    rawPayloadStored: false as const,
    rawPromptStored: false as const,
    rawProviderBodyStored: false as const,
    rawWalletMaterialStored: false as const,
    grantsAuthority: false as const,
    canAdmit: false as const,
    activatesEnforcement: false as const,
    autoEnforce: false as const,
    productionReady: false as const,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function evaluateShadowDataQualityGate(
  record: ShadowDataQualityGateRecord,
): ShadowDataQualityGateEvaluation {
  const payload = {
    version: record.version,
    sourceEventDigest: record.sourceEventDigest,
    tenantRefDigest: record.tenantRefDigest,
    outcome: record.outcome,
    readyForAssuranceEvidence: record.readyForAssuranceEvidence,
    underminingDefeaterRequired: record.underminingDefeaterRequired,
    dangerFlags: record.dangerFlags,
    reasonCodes: record.reasonCodes,
    passedCheckCount: record.passedCheckCount,
    warningCheckCount: record.warningCheckCount,
    failedCheckCount: record.failedCheckCount,
    failClosed: record.failClosed,
    canAdmit: false as const,
    activatesEnforcement: false as const,
    productionReady: false as const,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function shadowDataQualityGateDescriptor(): ShadowDataQualityGateDescriptor {
  return Object.freeze({
    version: SHADOW_DATA_QUALITY_GATE_VERSION,
    canonicalShadowEventSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    sourceAnchors: SHADOW_DATA_QUALITY_GATE_SOURCE_ANCHORS,
    dimensions: SHADOW_DATA_QUALITY_DIMENSIONS,
    checkStatuses: SHADOW_DATA_QUALITY_CHECK_STATUSES,
    checkIds: SHADOW_DATA_QUALITY_CHECK_IDS,
    dangerFlags: SHADOW_DATA_QUALITY_DANGER_FLAGS,
    outcomes: SHADOW_DATA_QUALITY_OUTCOMES,
    defaultMaxObservationLagMs: SHADOW_DATA_QUALITY_GATE_DEFAULT_MAX_OBSERVATION_LAG_MS,
    defaultMinimumObservedFieldCount:
      SHADOW_DATA_QUALITY_GATE_DEFAULT_MIN_OBSERVED_FIELD_COUNT,
    opensUnderminingDefeaters: true,
    assuranceCaseContextRequired: true,
    digestOnlyEvidence: true,
    rawPayloadRead: false,
    rawPayloadStored: false,
    learnsFromTraffic: false,
    trainingEnabled: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-live-enforcement',
      'not-admission-decision',
      'not-policy-activation',
      'not-learning-system',
      'not-provenance-standard-conformance',
      'not-data-quality-platform',
      'not-production-ready',
    ]),
  });
}
