import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  ConsequenceAdmissionDecision,
  GenericAdmissionMode,
  GenericAdmissionShadowDecision,
} from './index.js';
import type {
  ShadowAdmissionDownstreamOutcome,
  ShadowAdmissionEvent,
  ShadowAdmissionHumanOutcome,
} from './shadow-events.js';

export const CANONICAL_SHADOW_EVENT_SCHEMA_VERSION =
  'attestor.canonical-shadow-event.v1';
export const CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION = '1.0';
export const CANONICAL_SHADOW_EVENT_OTEL_EVENT_NAME =
  'attestor.shadow_event';

export const CANONICAL_SHADOW_EVENT_SOURCE_KINDS = [
  'admission-shadow',
  'target-system-shadow',
  'integration-declaration',
  'crypto-execution-admission',
  'manual-import',
] as const;
export type CanonicalShadowEventSourceKind =
  typeof CANONICAL_SHADOW_EVENT_SOURCE_KINDS[number];

export const CANONICAL_SHADOW_EVENT_ACTION_KINDS = [
  'api-operation',
  'workflow-step',
  'tool-call',
  'mcp-tool',
  'webhook-callback',
  'transaction-proposal',
  'approval-step',
  'sql-execution',
  'identity-operation',
  'manual-import',
] as const;
export type CanonicalShadowEventActionKind =
  typeof CANONICAL_SHADOW_EVENT_ACTION_KINDS[number];

export const CANONICAL_SHADOW_EVENT_CONSEQUENCE_CLASSES = [
  'financial',
  'data-movement',
  'authority-change',
  'external-communication',
  'operational-execution',
  'programmable-money',
  'health-claims',
  'unknown',
] as const;
export type CanonicalShadowEventConsequenceClass =
  typeof CANONICAL_SHADOW_EVENT_CONSEQUENCE_CLASSES[number];

export const CANONICAL_SHADOW_EVENT_REFERENCE_KINDS = [
  'tenant',
  'actor',
  'target-account',
  'resource',
  'policy',
  'evidence',
  'simulation',
  'approval',
  'receipt',
  'idempotency',
  'replay',
  'trace',
  'schema',
  'action-surface',
  'authority',
  'provenance',
  'outbox',
] as const;
export type CanonicalShadowEventReferenceKind =
  typeof CANONICAL_SHADOW_EVENT_REFERENCE_KINDS[number];

export const CANONICAL_SHADOW_EVENT_DATA_ORIGINS = [
  'observed',
  'inferred',
  'operator-supplied',
] as const;
export type CanonicalShadowEventDataOrigin =
  typeof CANONICAL_SHADOW_EVENT_DATA_ORIGINS[number];

export const CANONICAL_SHADOW_EVENT_RAW_MATERIAL_POLICIES = [
  'digest-only',
  'metadata-only',
  'forbidden',
] as const;
export type CanonicalShadowEventRawMaterialPolicy =
  typeof CANONICAL_SHADOW_EVENT_RAW_MATERIAL_POLICIES[number];

export interface CanonicalShadowEventReference {
  readonly kind: CanonicalShadowEventReferenceKind;
  readonly digest: string;
  readonly origin: CanonicalShadowEventDataOrigin;
}

export interface CanonicalShadowEventAmountAssetChain {
  readonly amountBucket: string | null;
  readonly assetRefDigest: string | null;
  readonly chainRefDigest: string | null;
}

export interface CanonicalShadowEventAuthorityDelta {
  readonly authorityKind: string;
  readonly principalRefDigest: string | null;
  readonly resourceRefDigest: string | null;
  readonly permissionRefDigest: string | null;
}

export interface CanonicalShadowEventFactSet {
  readonly targetSystem: string | null;
  readonly targetAccountRefDigest: string | null;
  readonly actionName: string | null;
  readonly actionKind: CanonicalShadowEventActionKind | null;
  readonly consequenceClass: CanonicalShadowEventConsequenceClass | null;
  readonly resourceRefDigest: string | null;
  readonly dataClass: string | null;
  readonly amountAssetChain: CanonicalShadowEventAmountAssetChain | null;
  readonly authorityDelta: CanonicalShadowEventAuthorityDelta | null;
}

export interface CanonicalShadowEventDecision {
  readonly admissionDigest: string | null;
  readonly mode: GenericAdmissionMode | null;
  readonly shadowDecision: GenericAdmissionShadowDecision | null;
  readonly effectiveDecision: ConsequenceAdmissionDecision | null;
  readonly allowed: boolean | null;
  readonly failClosed: boolean | null;
  readonly reasonCodes: readonly string[];
}

export interface CanonicalShadowEventOutcome {
  readonly downstreamOutcome: ShadowAdmissionDownstreamOutcome | null;
  readonly humanOutcome: ShadowAdmissionHumanOutcome | null;
}

export interface CanonicalShadowEventRawMaterialBoundary {
  readonly policy: CanonicalShadowEventRawMaterialPolicy;
  readonly redactionPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
  readonly rawWalletMaterialStored: false;
  readonly rawCustomerIdentifierStored: false;
}

export interface CreateCanonicalShadowEventInput {
  readonly occurredAt: string;
  readonly observedAt?: string | null;
  readonly sourceKind: CanonicalShadowEventSourceKind;
  readonly producer: string;
  readonly tenantRefDigest: string;
  readonly actorRefDigest: string;
  readonly observed: CanonicalShadowEventFactSet;
  readonly inferred?: CanonicalShadowEventFactSet | null;
  readonly decision?: CanonicalShadowEventDecision | null;
  readonly outcome?: CanonicalShadowEventOutcome | null;
  readonly evidenceRefs?: readonly CanonicalShadowEventReference[] | null;
  readonly simulationRefs?: readonly CanonicalShadowEventReference[] | null;
  readonly approvalRefs?: readonly CanonicalShadowEventReference[] | null;
  readonly receiptRefs?: readonly CanonicalShadowEventReference[] | null;
  readonly policyRefs?: readonly CanonicalShadowEventReference[] | null;
  readonly idempotencyRefDigest?: string | null;
  readonly replayRefDigest?: string | null;
  readonly traceRefDigest?: string | null;
  readonly schemaRefDigest?: string | null;
  readonly rawMaterialPolicy?: CanonicalShadowEventRawMaterialPolicy | null;
}

export interface CanonicalShadowEvent {
  readonly version: typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly cloudEventsSpecversion: typeof CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION;
  readonly otelEventName: typeof CANONICAL_SHADOW_EVENT_OTEL_EVENT_NAME;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly observedAt: string;
  readonly sourceKind: CanonicalShadowEventSourceKind;
  readonly producer: string;
  readonly tenantRefDigest: string;
  readonly actorRefDigest: string;
  readonly observed: CanonicalShadowEventFactSet;
  readonly inferred: CanonicalShadowEventFactSet;
  readonly decision: CanonicalShadowEventDecision;
  readonly outcome: CanonicalShadowEventOutcome;
  readonly evidenceRefs: readonly CanonicalShadowEventReference[];
  readonly simulationRefs: readonly CanonicalShadowEventReference[];
  readonly approvalRefs: readonly CanonicalShadowEventReference[];
  readonly receiptRefs: readonly CanonicalShadowEventReference[];
  readonly policyRefs: readonly CanonicalShadowEventReference[];
  readonly idempotencyRefDigest: string | null;
  readonly replayRefDigest: string | null;
  readonly traceRefDigest: string | null;
  readonly schemaRefDigest: string | null;
  readonly rawMaterialBoundary: CanonicalShadowEventRawMaterialBoundary;
  readonly observedFieldCount: number;
  readonly inferredFieldCount: number;
  readonly rawPayloadStored: false;
  readonly autoEnforce: false;
  readonly approvalRequiredForPromotion: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface CanonicalShadowEventSchemaDescriptor {
  readonly version: typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly cloudEventsSpecversion: typeof CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION;
  readonly otelEventName: typeof CANONICAL_SHADOW_EVENT_OTEL_EVENT_NAME;
  readonly sourceKinds: typeof CANONICAL_SHADOW_EVENT_SOURCE_KINDS;
  readonly actionKinds: typeof CANONICAL_SHADOW_EVENT_ACTION_KINDS;
  readonly consequenceClasses: typeof CANONICAL_SHADOW_EVENT_CONSEQUENCE_CLASSES;
  readonly referenceKinds: typeof CANONICAL_SHADOW_EVENT_REFERENCE_KINDS;
  readonly dataOrigins: typeof CANONICAL_SHADOW_EVENT_DATA_ORIGINS;
  readonly rawMaterialPolicies: typeof CANONICAL_SHADOW_EVENT_RAW_MATERIAL_POLICIES;
  readonly separatesObservedAndInferredFacts: true;
  readonly rawPayloadStored: false;
  readonly autoEnforce: false;
  readonly approvalRequiredForPromotion: true;
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

function digestValue(kind: string, value: string): string {
  return canonicalObject({ kind, value }).digest;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Canonical shadow event ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeString(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Canonical shadow event ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Canonical shadow event ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalString(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeString(value, fieldName);
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeString(value, fieldName);
  if (!/^sha256:[a-f0-9]{64}$/u.test(normalized)) {
    throw new Error(`Canonical shadow event ${fieldName} must be a sha256 digest reference.`);
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  fieldName: string,
): T {
  const normalized = normalizeString(value, fieldName);
  if (!allowed.includes(normalized as T)) {
    throw new Error(
      `Canonical shadow event ${fieldName} must be one of: ${allowed.join(', ')}.`,
    );
  }
  return normalized as T;
}

function emptyFactSet(): CanonicalShadowEventFactSet {
  return Object.freeze({
    targetSystem: null,
    targetAccountRefDigest: null,
    actionName: null,
    actionKind: null,
    consequenceClass: null,
    resourceRefDigest: null,
    dataClass: null,
    amountAssetChain: null,
    authorityDelta: null,
  });
}

function normalizeAmountAssetChain(
  input: CanonicalShadowEventAmountAssetChain | null | undefined,
): CanonicalShadowEventAmountAssetChain | null {
  if (input === undefined || input === null) return null;
  return Object.freeze({
    amountBucket: normalizeOptionalString(input.amountBucket, 'amountAssetChain.amountBucket'),
    assetRefDigest: normalizeOptionalDigest(input.assetRefDigest, 'amountAssetChain.assetRefDigest'),
    chainRefDigest: normalizeOptionalDigest(input.chainRefDigest, 'amountAssetChain.chainRefDigest'),
  });
}

function normalizeAuthorityDelta(
  input: CanonicalShadowEventAuthorityDelta | null | undefined,
): CanonicalShadowEventAuthorityDelta | null {
  if (input === undefined || input === null) return null;
  return Object.freeze({
    authorityKind: normalizeString(input.authorityKind, 'authorityDelta.authorityKind'),
    principalRefDigest: normalizeOptionalDigest(input.principalRefDigest, 'authorityDelta.principalRefDigest'),
    resourceRefDigest: normalizeOptionalDigest(input.resourceRefDigest, 'authorityDelta.resourceRefDigest'),
    permissionRefDigest: normalizeOptionalDigest(input.permissionRefDigest, 'authorityDelta.permissionRefDigest'),
  });
}

function normalizeFactSet(
  input: CanonicalShadowEventFactSet | null | undefined,
): CanonicalShadowEventFactSet {
  if (input === undefined || input === null) return emptyFactSet();
  return Object.freeze({
    targetSystem: normalizeOptionalString(input.targetSystem, 'targetSystem'),
    targetAccountRefDigest: normalizeOptionalDigest(input.targetAccountRefDigest, 'targetAccountRefDigest'),
    actionName: normalizeOptionalString(input.actionName, 'actionName'),
    actionKind: input.actionKind === undefined || input.actionKind === null
      ? null
      : normalizeEnum(input.actionKind, CANONICAL_SHADOW_EVENT_ACTION_KINDS, 'actionKind'),
    consequenceClass: input.consequenceClass === undefined || input.consequenceClass === null
      ? null
      : normalizeEnum(
        input.consequenceClass,
        CANONICAL_SHADOW_EVENT_CONSEQUENCE_CLASSES,
        'consequenceClass',
      ),
    resourceRefDigest: normalizeOptionalDigest(input.resourceRefDigest, 'resourceRefDigest'),
    dataClass: normalizeOptionalString(input.dataClass, 'dataClass'),
    amountAssetChain: normalizeAmountAssetChain(input.amountAssetChain),
    authorityDelta: normalizeAuthorityDelta(input.authorityDelta),
  });
}

function countFactFields(facts: CanonicalShadowEventFactSet): number {
  return [
    facts.targetSystem,
    facts.targetAccountRefDigest,
    facts.actionName,
    facts.actionKind,
    facts.consequenceClass,
    facts.resourceRefDigest,
    facts.dataClass,
    facts.amountAssetChain,
    facts.authorityDelta,
  ].filter((value) => value !== null).length;
}

function normalizeReference(
  ref: CanonicalShadowEventReference,
  fieldName: string,
): CanonicalShadowEventReference {
  return Object.freeze({
    kind: normalizeEnum(ref.kind, CANONICAL_SHADOW_EVENT_REFERENCE_KINDS, `${fieldName}.kind`),
    digest: normalizeDigest(ref.digest, `${fieldName}.digest`),
    origin: normalizeEnum(ref.origin, CANONICAL_SHADOW_EVENT_DATA_ORIGINS, `${fieldName}.origin`),
  });
}

function normalizeRefs(
  refs: readonly CanonicalShadowEventReference[] | null | undefined,
  fieldName: string,
): readonly CanonicalShadowEventReference[] {
  return Object.freeze((refs ?? [])
    .map((ref, index) => normalizeReference(ref, `${fieldName}[${index}]`))
    .sort((left, right) => {
      const leftKey = `${left.kind}\u0000${left.digest}\u0000${left.origin}`;
      const rightKey = `${right.kind}\u0000${right.digest}\u0000${right.origin}`;
      if (leftKey < rightKey) return -1;
      if (leftKey > rightKey) return 1;
      return 0;
    }));
}

function defaultDecision(): CanonicalShadowEventDecision {
  return Object.freeze({
    admissionDigest: null,
    mode: null,
    shadowDecision: null,
    effectiveDecision: null,
    allowed: null,
    failClosed: null,
    reasonCodes: Object.freeze([]),
  });
}

function normalizeDecision(
  decision: CanonicalShadowEventDecision | null | undefined,
): CanonicalShadowEventDecision {
  if (decision === undefined || decision === null) return defaultDecision();
  return Object.freeze({
    admissionDigest: normalizeOptionalDigest(decision.admissionDigest, 'decision.admissionDigest'),
    mode: decision.mode ?? null,
    shadowDecision: decision.shadowDecision ?? null,
    effectiveDecision: decision.effectiveDecision ?? null,
    allowed: decision.allowed ?? null,
    failClosed: decision.failClosed ?? null,
    reasonCodes: Object.freeze([...decision.reasonCodes].map((reasonCode, index) =>
      normalizeString(reasonCode, `decision.reasonCodes[${index}]`)
    ).sort()),
  });
}

function normalizeOutcome(
  outcome: CanonicalShadowEventOutcome | null | undefined,
): CanonicalShadowEventOutcome {
  return Object.freeze({
    downstreamOutcome: outcome?.downstreamOutcome ?? null,
    humanOutcome: outcome?.humanOutcome ?? null,
  });
}

function createRawMaterialBoundary(
  policy: CanonicalShadowEventRawMaterialPolicy | null | undefined,
): CanonicalShadowEventRawMaterialBoundary {
  return Object.freeze({
    policy: policy === undefined || policy === null
      ? 'digest-only'
      : normalizeEnum(policy, CANONICAL_SHADOW_EVENT_RAW_MATERIAL_POLICIES, 'rawMaterialPolicy'),
    redactionPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
    rawWalletMaterialStored: false,
    rawCustomerIdentifierStored: false,
  });
}

function createEventId(input: {
  readonly occurredAt: string;
  readonly observedAt: string;
  readonly sourceKind: CanonicalShadowEventSourceKind;
  readonly producer: string;
  readonly tenantRefDigest: string;
  readonly actorRefDigest: string;
  readonly observed: CanonicalShadowEventFactSet;
  readonly inferred: CanonicalShadowEventFactSet;
  readonly decision: CanonicalShadowEventDecision;
  readonly outcome: CanonicalShadowEventOutcome;
}): string {
  return `canonical-shadow:${canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest}`;
}

export function createCanonicalShadowEvent(
  input: CreateCanonicalShadowEventInput,
): CanonicalShadowEvent {
  const occurredAt = normalizeIsoTimestamp(input.occurredAt, input.occurredAt, 'occurredAt');
  const observedAt = normalizeIsoTimestamp(input.observedAt, occurredAt, 'observedAt');
  const sourceKind = normalizeEnum(
    input.sourceKind,
    CANONICAL_SHADOW_EVENT_SOURCE_KINDS,
    'sourceKind',
  );
  const producer = normalizeString(input.producer, 'producer');
  const tenantRefDigest = normalizeDigest(input.tenantRefDigest, 'tenantRefDigest');
  const actorRefDigest = normalizeDigest(input.actorRefDigest, 'actorRefDigest');
  const observed = normalizeFactSet(input.observed);
  const inferred = normalizeFactSet(input.inferred);
  const decision = normalizeDecision(input.decision);
  const outcome = normalizeOutcome(input.outcome);
  const payload = {
    version: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    cloudEventsSpecversion: CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION,
    otelEventName: CANONICAL_SHADOW_EVENT_OTEL_EVENT_NAME,
    eventId: createEventId({
      occurredAt,
      observedAt,
      sourceKind,
      producer,
      tenantRefDigest,
      actorRefDigest,
      observed,
      inferred,
      decision,
      outcome,
    }),
    occurredAt,
    observedAt,
    sourceKind,
    producer,
    tenantRefDigest,
    actorRefDigest,
    observed,
    inferred,
    decision,
    outcome,
    evidenceRefs: normalizeRefs(input.evidenceRefs, 'evidenceRefs'),
    simulationRefs: normalizeRefs(input.simulationRefs, 'simulationRefs'),
    approvalRefs: normalizeRefs(input.approvalRefs, 'approvalRefs'),
    receiptRefs: normalizeRefs(input.receiptRefs, 'receiptRefs'),
    policyRefs: normalizeRefs(input.policyRefs, 'policyRefs'),
    idempotencyRefDigest: normalizeOptionalDigest(input.idempotencyRefDigest, 'idempotencyRefDigest'),
    replayRefDigest: normalizeOptionalDigest(input.replayRefDigest, 'replayRefDigest'),
    traceRefDigest: normalizeOptionalDigest(input.traceRefDigest, 'traceRefDigest'),
    schemaRefDigest: normalizeOptionalDigest(input.schemaRefDigest, 'schemaRefDigest'),
    rawMaterialBoundary: createRawMaterialBoundary(input.rawMaterialPolicy),
    observedFieldCount: countFactFields(observed),
    inferredFieldCount: countFactFields(inferred),
    rawPayloadStored: false as const,
    autoEnforce: false as const,
    approvalRequiredForPromotion: true as const,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function consequenceClassForDomain(domain: string): CanonicalShadowEventConsequenceClass {
  if (domain === 'money-movement' || domain === 'finance') return 'financial';
  if (domain === 'data-disclosure' || domain === 'data-iam') return 'data-movement';
  if (domain === 'system-operation') return 'operational-execution';
  if (domain === 'crypto' || domain === 'programmable-money') return 'programmable-money';
  if (domain === 'healthcare' || domain === 'health-insurance') return 'health-claims';
  return 'unknown';
}

function ref(kind: CanonicalShadowEventReferenceKind, digest: string): CanonicalShadowEventReference {
  return Object.freeze({
    kind,
    digest: normalizeDigest(digest, `${kind} digest`),
    origin: 'observed',
  });
}

export function createCanonicalShadowEventFromAdmissionEvent(
  event: ShadowAdmissionEvent,
  options?: {
    readonly targetAccountRefDigest?: string | null;
    readonly resourceRefDigest?: string | null;
    readonly actionKind?: CanonicalShadowEventActionKind | null;
    readonly traceRefDigest?: string | null;
  },
): CanonicalShadowEvent {
  const tenantRefDigest = event.tenantId
    ? digestValue('tenant', event.tenantId)
    : digestValue('tenant', 'unknown');
  const actionSurface = event.actionSurface ?? `${event.downstreamSystem}.${event.action}`;
  const actionSurfaceDigest = digestValue('actionSurface', actionSurface);
  const resourceRefDigest = options?.resourceRefDigest ?? actionSurfaceDigest;
  const policyRefs = event.policyRef
    ? Object.freeze([ref('policy', digestValue('policyRef', event.policyRef))])
    : Object.freeze([]);
  return createCanonicalShadowEvent({
    occurredAt: event.occurredAt,
    observedAt: event.occurredAt,
    sourceKind: 'admission-shadow',
    producer: 'attestor.consequence-admission',
    tenantRefDigest,
    actorRefDigest: digestValue('actor', event.actor),
    observed: {
      targetSystem: event.downstreamSystem,
      targetAccountRefDigest: options?.targetAccountRefDigest ?? null,
      actionName: event.action,
      actionKind: options?.actionKind ?? 'api-operation',
      consequenceClass: null,
      resourceRefDigest,
      dataClass: event.domain,
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: {
      ...emptyFactSet(),
      consequenceClass: consequenceClassForDomain(event.domain),
    },
    decision: {
      admissionDigest: event.admissionDigest,
      mode: event.mode,
      shadowDecision: event.shadowDecision,
      effectiveDecision: event.effectiveDecision,
      allowed: event.allowed,
      failClosed: event.failClosed,
      reasonCodes: event.reasonCodes,
    },
    outcome: {
      downstreamOutcome: event.downstreamOutcome,
      humanOutcome: event.humanOutcome,
    },
    evidenceRefs: Object.freeze([
      ref('evidence', event.admissionDigest),
      ref('provenance', event.originWitnessDigest),
      ref('provenance', event.redactionWitnessDigest),
    ]),
    policyRefs,
    replayRefDigest: digestValue('shadowEvent', event.eventId),
    traceRefDigest: options?.traceRefDigest ?? null,
    schemaRefDigest: digestValue('schema', CANONICAL_SHADOW_EVENT_SCHEMA_VERSION),
    rawMaterialPolicy: 'digest-only',
  });
}

export function canonicalShadowEventSchemaDescriptor(): CanonicalShadowEventSchemaDescriptor {
  return Object.freeze({
    version: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    cloudEventsSpecversion: CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION,
    otelEventName: CANONICAL_SHADOW_EVENT_OTEL_EVENT_NAME,
    sourceKinds: CANONICAL_SHADOW_EVENT_SOURCE_KINDS,
    actionKinds: CANONICAL_SHADOW_EVENT_ACTION_KINDS,
    consequenceClasses: CANONICAL_SHADOW_EVENT_CONSEQUENCE_CLASSES,
    referenceKinds: CANONICAL_SHADOW_EVENT_REFERENCE_KINDS,
    dataOrigins: CANONICAL_SHADOW_EVENT_DATA_ORIGINS,
    rawMaterialPolicies: CANONICAL_SHADOW_EVENT_RAW_MATERIAL_POLICIES,
    separatesObservedAndInferredFacts: true,
    rawPayloadStored: false,
    autoEnforce: false,
    approvalRequiredForPromotion: true,
  });
}
