import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionDecision,
  ConsequenceAdmissionResponse,
  GenericAdmissionEnvelope,
  GenericAdmissionFeatureValue,
  GenericAdmissionMode,
  GenericAdmissionShadowDecision,
} from './index.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import {
  normalizeGenericAdmissionGuardOutcomeTrace,
  type GenericAdmissionGuardOutcomeTraceEntry,
} from './generic-guard-outcome-trace.js';
import type { ConsequenceAdmissionDomain } from './taxonomy.js';

export const SHADOW_ADMISSION_EVENT_VERSION =
  'attestor.shadow-admission-event.v1';
export const SHADOW_ADMISSION_ORIGIN_WITNESS_VERSION =
  'attestor.shadow-admission-origin-witness.v1';
export const SHADOW_ADMISSION_REDACTION_WITNESS_VERSION =
  'attestor.shadow-admission-redaction-witness.v1';

export const SHADOW_ADMISSION_DOWNSTREAM_OUTCOMES = [
  'not-observed',
  'proceeded',
  'held',
  'blocked',
  'failed',
  'unknown',
] as const;
export type ShadowAdmissionDownstreamOutcome =
  typeof SHADOW_ADMISSION_DOWNSTREAM_OUTCOMES[number];

export const SHADOW_ADMISSION_HUMAN_OUTCOMES = [
  'not-reviewed',
  'approved',
  'rejected',
  'modified',
  'unknown',
] as const;
export type ShadowAdmissionHumanOutcome =
  typeof SHADOW_ADMISSION_HUMAN_OUTCOMES[number];

export const SHADOW_ADMISSION_REDACTION_LEVELS = [
  'digest-only',
  'metadata-only',
  'operator-supplied',
] as const;
export type ShadowAdmissionRedactionLevel =
  typeof SHADOW_ADMISSION_REDACTION_LEVELS[number];

export interface ShadowAdmissionOriginWitness {
  readonly version: typeof SHADOW_ADMISSION_ORIGIN_WITNESS_VERSION;
  readonly witnessKind: 'admission-response-digest-binding';
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly requestId: string;
  readonly decidedAt: string;
  readonly decision: ConsequenceAdmissionDecision;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly tenantId: string | null;
  readonly environment: string | null;
  readonly rawPayloadStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowAdmissionRedactionWitness {
  readonly version: typeof SHADOW_ADMISSION_REDACTION_WITNESS_VERSION;
  readonly witnessKind: 'redaction-policy-digest-binding';
  readonly redactionLevel: ShadowAdmissionRedactionLevel;
  readonly redactionPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly observedFeatureKeys: readonly string[];
  readonly observedFeatureDigest: string | null;
  readonly rawPayloadStored: false;
  readonly rawObservedValuesStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateShadowAdmissionEventInput {
  readonly admission: GenericAdmissionEnvelope | ConsequenceAdmissionResponse;
  readonly occurredAt?: string | null;
  readonly eventId?: string | null;
  readonly downstreamOutcome?: ShadowAdmissionDownstreamOutcome | null;
  readonly humanOutcome?: ShadowAdmissionHumanOutcome | null;
  readonly actionSurface?: string | null;
  readonly policyRef?: string | null;
  readonly observedFeatures?: Readonly<Record<string, GenericAdmissionFeatureValue>> | null;
  readonly guardOutcomes?: readonly GenericAdmissionGuardOutcomeTraceEntry[] | null;
  readonly redactionLevel?: ShadowAdmissionRedactionLevel | null;
}

export interface ShadowAdmissionEvent {
  readonly version: typeof SHADOW_ADMISSION_EVENT_VERSION;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly requestId: string;
  readonly mode: GenericAdmissionMode | null;
  readonly shadowDecision: GenericAdmissionShadowDecision | null;
  readonly effectiveDecision: ConsequenceAdmissionDecision;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly actor: string;
  readonly action: string;
  readonly domain: ConsequenceAdmissionDomain | string;
  readonly downstreamSystem: string;
  readonly actionSurface: string | null;
  readonly policyRef: string | null;
  readonly tenantId: string | null;
  readonly environment: string | null;
  readonly reasonCodes: readonly string[];
  readonly guardOutcomes: readonly GenericAdmissionGuardOutcomeTraceEntry[];
  readonly downstreamOutcome: ShadowAdmissionDownstreamOutcome;
  readonly humanOutcome: ShadowAdmissionHumanOutcome;
  readonly observedFeatureKeys: readonly string[];
  readonly observedFeatureDigest: string | null;
  readonly originWitness: ShadowAdmissionOriginWitness;
  readonly originWitnessDigest: string;
  readonly redactionWitness: ShadowAdmissionRedactionWitness;
  readonly redactionWitnessDigest: string;
  readonly evidenceRefCount: number;
  readonly nativeInputRefCount: number;
  readonly redactionLevel: ShadowAdmissionRedactionLevel;
  readonly rawPayloadStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowAdmissionEventSummary {
  readonly totalEvents: number;
  readonly byMode: Readonly<Record<string, number>>;
  readonly byShadowDecision: Readonly<Record<string, number>>;
  readonly byDomain: Readonly<Record<string, number>>;
  readonly downstreamOutcomes: Readonly<Record<string, number>>;
  readonly humanOutcomes: Readonly<Record<string, number>>;
  readonly policyGapCount: number;
  readonly reviewLoadCount: number;
  readonly blockedCount: number;
  readonly nonEnforcingEventCount: number;
  readonly rawPayloadEventCount: number;
}

export interface InMemoryShadowAdmissionEventRecorder {
  record(input: CreateShadowAdmissionEventInput | ShadowAdmissionEvent): ShadowAdmissionEvent;
  list(): readonly ShadowAdmissionEvent[];
  findByAdmissionId(admissionId: string): ShadowAdmissionEvent | null;
  summarize(): ShadowAdmissionEventSummary;
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Shadow admission event ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Shadow admission event ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Shadow admission event ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeEnumValue<T extends string>(
  value: string | null | undefined,
  allowedValues: readonly T[],
  fallback: T,
  fieldName: string,
): T {
  if (value === undefined || value === null) return fallback;
  const normalized = normalizeIdentifier(value, fieldName);
  if (!allowedValues.includes(normalized as T)) {
    throw new Error(
      `Shadow admission event ${fieldName} must be one of: ${allowedValues.join(', ')}.`,
    );
  }
  return normalized as T;
}

function isGenericAdmissionEnvelope(input: unknown): input is GenericAdmissionEnvelope {
  return (
    isRecord(input) &&
    isRecord(input.admission) &&
    typeof input.mode === 'string' &&
    typeof input.shadowDecision === 'string'
  );
}

function isShadowAdmissionEvent(input: unknown): input is ShadowAdmissionEvent {
  return (
    isRecord(input) &&
    input.version === SHADOW_ADMISSION_EVENT_VERSION &&
    typeof input.eventId === 'string' &&
    typeof input.digest === 'string'
  );
}

function readonlyStringArray(items: readonly string[]): readonly string[] {
  return Object.freeze([...items]);
}

export function normalizeShadowAdmissionEvent(event: ShadowAdmissionEvent): ShadowAdmissionEvent {
  return Object.freeze({
    ...event,
    guardOutcomes: normalizeGenericAdmissionGuardOutcomeTrace(
      event.guardOutcomes ?? null,
    ),
  });
}

function normalizeObservedFeatures(
  features: Readonly<Record<string, GenericAdmissionFeatureValue>> | null | undefined,
): {
  readonly keys: readonly string[];
  readonly digest: string | null;
} {
  if (!features) {
    return Object.freeze({
      keys: Object.freeze([]),
      digest: null,
    });
  }

  const normalized: Record<string, GenericAdmissionFeatureValue> = {};
  for (const [key, value] of Object.entries(features)) {
    const normalizedKey = normalizeIdentifier(key, 'observedFeatures key');
    if (
      value !== null &&
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      throw new Error(
        `Shadow admission event observedFeatures.${normalizedKey} must be scalar or null.`,
      );
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(
        `Shadow admission event observedFeatures.${normalizedKey} must be finite.`,
      );
    }
    normalized[normalizedKey] = value;
  }

  const keys = Object.freeze(Object.keys(normalized).sort());
  if (keys.length === 0) {
    return Object.freeze({
      keys,
      digest: null,
    });
  }

  const digest = canonicalObject(
    normalized as unknown as CanonicalReleaseJsonValue,
  ).digest;
  return Object.freeze({
    keys,
    digest,
  });
}

function defaultActionSurface(admission: ConsequenceAdmissionResponse): string {
  return `${admission.request.proposedConsequence.downstreamSystem}.${admission.request.proposedConsequence.action}`;
}

function createOriginWitness(admission: ConsequenceAdmissionResponse): ShadowAdmissionOriginWitness {
  const payload = {
    version: SHADOW_ADMISSION_ORIGIN_WITNESS_VERSION,
    witnessKind: 'admission-response-digest-binding',
    admissionId: admission.admissionId,
    admissionDigest: admission.digest,
    requestId: admission.request.requestId,
    decidedAt: admission.decidedAt,
    decision: admission.decision,
    allowed: admission.allowed,
    failClosed: admission.failClosed,
    tenantId: admission.request.policyScope.tenantId,
    environment: admission.request.policyScope.environment,
    rawPayloadStored: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function createRedactionWitness(input: {
  readonly redactionLevel: ShadowAdmissionRedactionLevel;
  readonly observedFeatureKeys: readonly string[];
  readonly observedFeatureDigest: string | null;
}): ShadowAdmissionRedactionWitness {
  const payload = {
    version: SHADOW_ADMISSION_REDACTION_WITNESS_VERSION,
    witnessKind: 'redaction-policy-digest-binding',
    redactionLevel: input.redactionLevel,
    redactionPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    observedFeatureKeys: input.observedFeatureKeys,
    observedFeatureDigest: input.observedFeatureDigest,
    rawPayloadStored: false,
    rawObservedValuesStored: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function createEventId(input: {
  readonly occurredAt: string;
  readonly admissionId: string;
  readonly requestId: string;
  readonly shadowDecision: GenericAdmissionShadowDecision | null;
  readonly downstreamOutcome: ShadowAdmissionDownstreamOutcome;
  readonly humanOutcome: ShadowAdmissionHumanOutcome;
  readonly observedFeatureDigest: string | null;
  readonly guardOutcomes: readonly GenericAdmissionGuardOutcomeTraceEntry[];
  readonly originWitnessDigest: string;
  readonly redactionWitnessDigest: string;
}): string {
  const digest = canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest;
  return `shadow:${digest}`;
}

export function createShadowAdmissionEvent(
  input: CreateShadowAdmissionEventInput,
): ShadowAdmissionEvent {
  const envelope = isGenericAdmissionEnvelope(input.admission) ? input.admission : null;
  const admission: ConsequenceAdmissionResponse =
    envelope === null ? input.admission as ConsequenceAdmissionResponse : envelope.admission;
  const occurredAt = normalizeIsoTimestamp(
    input.occurredAt,
    admission.decidedAt,
    'occurredAt',
  );
  const downstreamOutcome = normalizeEnumValue(
    input.downstreamOutcome,
    SHADOW_ADMISSION_DOWNSTREAM_OUTCOMES,
    'not-observed',
    'downstreamOutcome',
  );
  const humanOutcome = normalizeEnumValue(
    input.humanOutcome,
    SHADOW_ADMISSION_HUMAN_OUTCOMES,
    'not-reviewed',
    'humanOutcome',
  );
  const redactionLevel = normalizeEnumValue(
    input.redactionLevel,
    SHADOW_ADMISSION_REDACTION_LEVELS,
    'digest-only',
    'redactionLevel',
  );
  const observedFeatures = normalizeObservedFeatures(input.observedFeatures);
  const guardOutcomes = normalizeGenericAdmissionGuardOutcomeTrace(
    input.guardOutcomes ?? envelope?.guardOutcomes ?? null,
  );
  const actionSurface = normalizeOptionalIdentifier(
    input.actionSurface,
    'actionSurface',
  ) ?? defaultActionSurface(admission);
  const policyRef = normalizeOptionalIdentifier(
    input.policyRef,
    'policyRef',
  ) ?? admission.request.policyScope.policyRef;
  const originWitness = createOriginWitness(admission);
  const redactionWitness = createRedactionWitness({
    redactionLevel,
    observedFeatureKeys: observedFeatures.keys,
    observedFeatureDigest: observedFeatures.digest,
  });
  const eventId = normalizeOptionalIdentifier(input.eventId, 'eventId') ?? createEventId({
    occurredAt,
    admissionId: admission.admissionId,
    requestId: admission.request.requestId,
    shadowDecision: envelope?.shadowDecision ?? null,
    downstreamOutcome,
    humanOutcome,
    observedFeatureDigest: observedFeatures.digest,
    guardOutcomes,
    originWitnessDigest: originWitness.digest,
    redactionWitnessDigest: redactionWitness.digest,
  });
  const payload = {
    version: SHADOW_ADMISSION_EVENT_VERSION,
    eventId,
    occurredAt,
    admissionId: admission.admissionId,
    admissionDigest: admission.digest,
    requestId: admission.request.requestId,
    mode: envelope?.mode ?? null,
    shadowDecision: envelope?.shadowDecision ?? null,
    effectiveDecision: admission.decision,
    allowed: admission.allowed,
    failClosed: admission.failClosed,
    actor: admission.request.proposedConsequence.actor,
    action: admission.request.proposedConsequence.action,
    domain: String(admission.request.policyScope.dimensions.domain ?? 'custom'),
    downstreamSystem: admission.request.proposedConsequence.downstreamSystem,
    actionSurface,
    policyRef,
    tenantId: admission.request.policyScope.tenantId,
    environment: admission.request.policyScope.environment,
    reasonCodes: readonlyStringArray(admission.reasonCodes),
    guardOutcomes,
    downstreamOutcome,
    humanOutcome,
    observedFeatureKeys: observedFeatures.keys,
    observedFeatureDigest: observedFeatures.digest,
    originWitness,
    originWitnessDigest: originWitness.digest,
    redactionWitness,
    redactionWitnessDigest: redactionWitness.digest,
    evidenceRefCount: admission.request.evidence.length,
    nativeInputRefCount: admission.request.nativeInputRefs.length,
    redactionLevel,
    rawPayloadStored: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function countBy<T extends string | null>(
  events: readonly ShadowAdmissionEvent[],
  selector: (event: ShadowAdmissionEvent) => T,
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const key = selector(event) ?? 'none';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

export function summarizeShadowAdmissionEvents(
  events: readonly ShadowAdmissionEvent[],
): ShadowAdmissionEventSummary {
  return Object.freeze({
    totalEvents: events.length,
    byMode: countBy(events, (event) => event.mode),
    byShadowDecision: countBy(events, (event) => event.shadowDecision),
    byDomain: countBy(events, (event) => event.domain),
    downstreamOutcomes: countBy(events, (event) => event.downstreamOutcome),
    humanOutcomes: countBy(events, (event) => event.humanOutcome),
    policyGapCount: events.filter((event) =>
      event.reasonCodes.includes('policy-ref-missing'),
    ).length,
    reviewLoadCount: events.filter((event) =>
      event.shadowDecision === 'would_review' || event.effectiveDecision === 'review',
    ).length,
    blockedCount: events.filter((event) =>
      event.shadowDecision === 'would_block' || event.effectiveDecision === 'block',
    ).length,
    nonEnforcingEventCount: events.filter((event) =>
      event.reasonCodes.includes('non-enforcing-mode'),
    ).length,
    rawPayloadEventCount: events.filter((event) => event.rawPayloadStored).length,
  });
}

export function createInMemoryShadowAdmissionEventRecorder(
  initialEvents: readonly ShadowAdmissionEvent[] = [],
): InMemoryShadowAdmissionEventRecorder {
  const events: ShadowAdmissionEvent[] = [...initialEvents];

  return Object.freeze({
    record(input: CreateShadowAdmissionEventInput | ShadowAdmissionEvent): ShadowAdmissionEvent {
      const event = normalizeShadowAdmissionEvent(
        isShadowAdmissionEvent(input) ? input : createShadowAdmissionEvent(input),
      );
      events.push(event);
      return event;
    },
    list(): readonly ShadowAdmissionEvent[] {
      return Object.freeze([...events]);
    },
    findByAdmissionId(admissionId: string): ShadowAdmissionEvent | null {
      const normalized = normalizeIdentifier(admissionId, 'admissionId');
      return events.find((event) => event.admissionId === normalized) ?? null;
    },
    summarize(): ShadowAdmissionEventSummary {
      return summarizeShadowAdmissionEvents(events);
    },
  });
}
