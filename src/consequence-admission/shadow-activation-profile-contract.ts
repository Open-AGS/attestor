import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION,
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
} from './canonical-shadow-event-schema.js';
import {
  SHADOW_RUNTIME_PIPELINE_VERSION,
} from './shadow-runtime-pipeline.js';

export const SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION =
  'attestor.shadow-activation-profile-contract.v1';

export const SHADOW_ACTIVATION_WORK_KEY_VERSION =
  'attestor.runtime-activation-work-key.v1';

export const DEFAULT_SHADOW_ACTIVATION_PROFILE_VERSION =
  'attestor.shadow-activation-profile.default.v1';

export const SHADOW_ACTIVATION_TRIGGER_MODES = [
  'event-driven',
  'reconcile-loop',
  'hybrid-event-reconcile',
] as const;
export type ShadowActivationTriggerMode =
  typeof SHADOW_ACTIVATION_TRIGGER_MODES[number];

export const SHADOW_ACTIVATION_SOURCE_ANCHORS = [
  'cloudevents-common-event-envelope',
  'kubernetes-controller-reconcile-loop',
  'transactional-outbox-pattern',
  'stripe-idempotency-key',
  'stripe-webhook-quick-2xx-before-work',
  'postgres-skip-locked-queue-claim',
  'postgres-advisory-lock-application-resource',
  'opentelemetry-log-trace-context',
  'w3c-trace-context-correlation-not-authority',
  'lamport-happened-before-partial-order',
] as const;
export type ShadowActivationSourceAnchor =
  typeof SHADOW_ACTIVATION_SOURCE_ANCHORS[number];

export interface CreateShadowActivationProfileContractInput {
  readonly profileId?: string | null;
  readonly activationProfileVersion?: string | null;
  readonly triggerMode?: ShadowActivationTriggerMode | null;
  readonly sourceEventDigest: string;
  readonly tenantRefDigest: string;
  readonly sourcePartitionDigest: string;
  readonly traceContextDigest?: string | null;
  readonly sourceEventSchemaVersion?: string | null;
  readonly cloudEventsSpecVersion?: string | null;
  readonly shadowRuntimePipelineVersion?: string | null;
  readonly maxAttempts?: number | null;
  readonly leaseSeconds?: number | null;
  readonly reconcileWindowSeconds?: number | null;
}

export interface ShadowActivationProfileContract {
  readonly version: typeof SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION;
  readonly workKeyVersion: typeof SHADOW_ACTIVATION_WORK_KEY_VERSION;
  readonly sourceEventSchemaVersion:
    typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly cloudEventsSpecVersion:
    typeof CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION;
  readonly shadowRuntimePipelineVersion:
    typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly activationProfileVersion: string;
  readonly profileId: string;
  readonly triggerMode: ShadowActivationTriggerMode;
  readonly deliverySemantics: 'at-least-once';
  readonly duplicateHandling: 'activation-work-key-digest';
  readonly orderingScope: 'tenant-source-partition';
  readonly clockAuthority: 'timestamps-are-evidence-not-ordering-proof';
  readonly sourceEventDigest: string;
  readonly tenantRefDigest: string;
  readonly sourcePartitionDigest: string;
  readonly traceContextDigest: string | null;
  readonly maxAttempts: number;
  readonly leaseSeconds: number;
  readonly reconcileWindowSeconds: number;
  readonly activationWorkKeyDigest: string;
  readonly partitionBindingDigest: string;
  readonly idempotencyBindingDigest: string;
  readonly reasonCodes: readonly string[];
  readonly eventDrivenTriggerAllowed: boolean;
  readonly reconcileLoopAllowed: boolean;
  readonly hybridTriggerRequired: boolean;
  readonly atLeastOnceOnly: true;
  readonly exactlyOnceClaimed: false;
  readonly globalTotalOrderingClaimed: false;
  readonly rawIdempotencyKeyStored: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly workerBehaviorIncluded: false;
  readonly outboxWriteIncluded: false;
  readonly auditPlaneWriteIncluded: false;
  readonly packetSigningIncluded: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly learnsFromTraffic: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowActivationProfileContractDescriptor {
  readonly version: typeof SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION;
  readonly workKeyVersion: typeof SHADOW_ACTIVATION_WORK_KEY_VERSION;
  readonly defaultActivationProfileVersion:
    typeof DEFAULT_SHADOW_ACTIVATION_PROFILE_VERSION;
  readonly sourceEventSchemaVersion:
    typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly cloudEventsSpecVersion:
    typeof CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION;
  readonly shadowRuntimePipelineVersion:
    typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly sourceAnchors: readonly ShadowActivationSourceAnchor[];
  readonly triggerModes: readonly ShadowActivationTriggerMode[];
  readonly deliverySemantics: 'at-least-once';
  readonly duplicateHandling: 'activation-work-key-digest';
  readonly orderingScope: 'tenant-source-partition';
  readonly clockAuthority: 'timestamps-are-evidence-not-ordering-proof';
  readonly activationWorkKeyFormula: readonly string[];
  readonly rawIdempotencyKeyStored: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly workerBehaviorIncluded: false;
  readonly outboxWriteIncluded: false;
  readonly auditPlaneWriteIncluded: false;
  readonly packetSigningIncluded: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly learnsFromTraffic: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const DEFAULT_PROFILE_ID = 'shadow-runtime-default';
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LEASE_SECONDS = 300;
const DEFAULT_RECONCILE_WINDOW_SECONDS = 900;

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

function normalizeIdentifier(
  value: string | null | undefined,
  fieldName: string,
  fallback?: string,
): string {
  const raw = value ?? fallback;
  if (typeof raw !== 'string') {
    throw new Error(`Shadow activation profile ${fieldName} requires a string.`);
  }
  const normalized = raw.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 512 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Shadow activation profile ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Shadow activation profile ${fieldName} must be a sha256 digest.`);
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

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
  fallback: number,
  max: number,
): number {
  const raw = value ?? fallback;
  if (!Number.isInteger(raw) || raw <= 0 || raw > max) {
    throw new Error(
      `Shadow activation profile ${fieldName} must be a positive bounded integer.`,
    );
  }
  return raw;
}

function normalizeTriggerMode(
  value: ShadowActivationTriggerMode | null | undefined,
): ShadowActivationTriggerMode {
  const mode = value ?? 'hybrid-event-reconcile';
  if (!SHADOW_ACTIVATION_TRIGGER_MODES.includes(mode)) {
    throw new Error('Shadow activation profile triggerMode is not supported.');
  }
  return mode;
}

function assertExpectedVersion(
  actual: string | null | undefined,
  expected: string,
  fieldName: string,
): string {
  const normalized = normalizeIdentifier(actual, fieldName, expected);
  if (normalized !== expected) {
    throw new Error(`Shadow activation profile ${fieldName} must be ${expected}.`);
  }
  return normalized;
}

function activationWorkKeyDigest(input: {
  readonly sourceEventDigest: string;
  readonly tenantRefDigest: string;
  readonly shadowRuntimePipelineVersion: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly activationProfileVersion: string;
}): string {
  return digestValue(SHADOW_ACTIVATION_WORK_KEY_VERSION, {
    version: SHADOW_ACTIVATION_WORK_KEY_VERSION,
    sourceEventDigest: input.sourceEventDigest,
    tenantRefDigest: input.tenantRefDigest,
    shadowRuntimePipelineVersion: input.shadowRuntimePipelineVersion,
    activationProfileVersion: input.activationProfileVersion,
  });
}

export function createShadowActivationProfileContract(
  input: CreateShadowActivationProfileContractInput,
): ShadowActivationProfileContract {
  const profileId = normalizeIdentifier(input.profileId, 'profileId', DEFAULT_PROFILE_ID);
  const activationProfileVersion = normalizeIdentifier(
    input.activationProfileVersion,
    'activationProfileVersion',
    DEFAULT_SHADOW_ACTIVATION_PROFILE_VERSION,
  );
  const sourceEventDigest = normalizeDigest(input.sourceEventDigest, 'sourceEventDigest');
  const tenantRefDigest = normalizeDigest(input.tenantRefDigest, 'tenantRefDigest');
  const sourcePartitionDigest = normalizeDigest(
    input.sourcePartitionDigest,
    'sourcePartitionDigest',
  );
  const traceContextDigest = normalizeOptionalDigest(
    input.traceContextDigest,
    'traceContextDigest',
  );
  const sourceEventSchemaVersion = assertExpectedVersion(
    input.sourceEventSchemaVersion,
    CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    'sourceEventSchemaVersion',
  ) as typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  const cloudEventsSpecVersion = assertExpectedVersion(
    input.cloudEventsSpecVersion,
    CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION,
    'cloudEventsSpecVersion',
  ) as typeof CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION;
  const shadowRuntimePipelineVersion = assertExpectedVersion(
    input.shadowRuntimePipelineVersion,
    SHADOW_RUNTIME_PIPELINE_VERSION,
    'shadowRuntimePipelineVersion',
  ) as typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  const triggerMode = normalizeTriggerMode(input.triggerMode);
  const maxAttempts = normalizePositiveInteger(
    input.maxAttempts,
    'maxAttempts',
    DEFAULT_MAX_ATTEMPTS,
    100,
  );
  const leaseSeconds = normalizePositiveInteger(
    input.leaseSeconds,
    'leaseSeconds',
    DEFAULT_LEASE_SECONDS,
    86_400,
  );
  const reconcileWindowSeconds = normalizePositiveInteger(
    input.reconcileWindowSeconds,
    'reconcileWindowSeconds',
    DEFAULT_RECONCILE_WINDOW_SECONDS,
    86_400,
  );
  const workKeyDigest = activationWorkKeyDigest({
    sourceEventDigest,
    tenantRefDigest,
    shadowRuntimePipelineVersion,
    activationProfileVersion,
  });
  const partitionBindingDigest = digestValue('attestor.shadow-activation-partition-binding.v1', {
    sourceEventDigest,
    tenantRefDigest,
    sourcePartitionDigest,
  });
  const idempotencyBindingDigest = digestValue(
    'attestor.shadow-activation-idempotency-binding.v1',
    {
      activationWorkKeyDigest: workKeyDigest,
      sourceEventDigest,
      tenantRefDigest,
      activationProfileVersion,
      deliverySemantics: 'at-least-once',
      duplicateHandling: 'activation-work-key-digest',
    },
  );
  const eventDrivenTriggerAllowed =
    triggerMode === 'event-driven' || triggerMode === 'hybrid-event-reconcile';
  const reconcileLoopAllowed =
    triggerMode === 'reconcile-loop' || triggerMode === 'hybrid-event-reconcile';
  const reasonCodes = Object.freeze([
    `trigger:${triggerMode}`,
    'delivery:at-least-once',
    'duplicate-handling:activation-work-key-digest',
    'ordering:tenant-source-partition',
    'clock:timestamps-are-evidence-not-ordering-proof',
    'authority:shadow-only-no-admit',
  ]);

  const material = {
    version: SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
    workKeyVersion: SHADOW_ACTIVATION_WORK_KEY_VERSION,
    sourceEventSchemaVersion,
    cloudEventsSpecVersion,
    shadowRuntimePipelineVersion,
    activationProfileVersion,
    profileId,
    triggerMode,
    deliverySemantics: 'at-least-once' as const,
    duplicateHandling: 'activation-work-key-digest' as const,
    orderingScope: 'tenant-source-partition' as const,
    clockAuthority: 'timestamps-are-evidence-not-ordering-proof' as const,
    sourceEventDigest,
    tenantRefDigest,
    sourcePartitionDigest,
    traceContextDigest,
    maxAttempts,
    leaseSeconds,
    reconcileWindowSeconds,
    activationWorkKeyDigest: workKeyDigest,
    partitionBindingDigest,
    idempotencyBindingDigest,
    reasonCodes,
    eventDrivenTriggerAllowed,
    reconcileLoopAllowed,
    hybridTriggerRequired: triggerMode === 'hybrid-event-reconcile',
    atLeastOnceOnly: true as const,
    exactlyOnceClaimed: false as const,
    globalTotalOrderingClaimed: false as const,
    rawIdempotencyKeyStored: false as const,
    rawPayloadRead: false as const,
    rawPayloadStored: false as const,
    workerBehaviorIncluded: false as const,
    outboxWriteIncluded: false as const,
    auditPlaneWriteIncluded: false as const,
    packetSigningIncluded: false as const,
    grantsAuthority: false as const,
    canAdmit: false as const,
    activatesEnforcement: false as const,
    autoEnforce: false as const,
    learnsFromTraffic: false as const,
    productionReady: false as const,
  } satisfies Omit<ShadowActivationProfileContract, 'canonical' | 'digest'>;
  const { canonical, digest } = canonicalObject(material);

  return Object.freeze({
    ...material,
    canonical,
    digest,
  });
}

export function shadowActivationProfileContractDescriptor():
  ShadowActivationProfileContractDescriptor {
  return Object.freeze({
    version: SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
    workKeyVersion: SHADOW_ACTIVATION_WORK_KEY_VERSION,
    defaultActivationProfileVersion: DEFAULT_SHADOW_ACTIVATION_PROFILE_VERSION,
    sourceEventSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    cloudEventsSpecVersion: CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    sourceAnchors: SHADOW_ACTIVATION_SOURCE_ANCHORS,
    triggerModes: SHADOW_ACTIVATION_TRIGGER_MODES,
    deliverySemantics: 'at-least-once',
    duplicateHandling: 'activation-work-key-digest',
    orderingScope: 'tenant-source-partition',
    clockAuthority: 'timestamps-are-evidence-not-ordering-proof',
    activationWorkKeyFormula: Object.freeze([
      'version',
      'sourceEventDigest',
      'tenantRefDigest',
      'shadowRuntimePipelineVersion',
      'activationProfileVersion',
    ]),
    rawIdempotencyKeyStored: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    workerBehaviorIncluded: false,
    outboxWriteIncluded: false,
    auditPlaneWriteIncluded: false,
    packetSigningIncluded: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    learnsFromTraffic: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-worker-behavior',
      'not-outbox-write-integration',
      'not-audit-plane-write',
      'not-live-enforcement',
      'not-exactly-once-delivery',
      'not-global-total-ordering',
      'not-packet-signing',
      'not-production-readiness',
    ]),
  });
}
