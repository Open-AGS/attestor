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
import {
  SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
  SHADOW_ACTIVATION_WORK_KEY_VERSION,
  type ShadowActivationProfileContract,
} from './shadow-activation-profile-contract.js';

export const SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION =
  'attestor.shadow-outbox-work-item-contract.v1';

export const SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE =
  'attestor.shadow-runtime.activation.requested.v1';

export const SHADOW_OUTBOX_WORK_ITEM_SOURCE_ANCHORS = [
  'cloudevents-common-event-envelope',
  'transactional-outbox-pattern',
  'stripe-idempotency-key',
  'stripe-webhook-quick-2xx-before-work',
  'postgres-skip-locked-claim-follows-r03',
  'postgres-advisory-lock-tenant-scope-follows-r03',
  'kubernetes-controller-reconcile-loop',
  'opentelemetry-log-trace-context',
  'w3c-trace-context-correlation-not-authority',
  'lamport-happened-before-partial-order',
] as const;
export type ShadowOutboxWorkItemSourceAnchor =
  typeof SHADOW_OUTBOX_WORK_ITEM_SOURCE_ANCHORS[number];

export interface CreateShadowOutboxWorkItemContractInput {
  readonly activationProfile: ShadowActivationProfileContract;
  readonly sourceHistoryRefDigest: string;
  readonly requestedAt: string;
  readonly availableAt?: string | null;
  readonly sourceHistorySequence?: number | null;
}

export interface ShadowOutboxWorkItemContract {
  readonly version: typeof SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION;
  readonly eventType: typeof SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE;
  readonly status: 'pending';
  readonly activationProfileContractVersion:
    typeof SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION;
  readonly workKeyVersion: typeof SHADOW_ACTIVATION_WORK_KEY_VERSION;
  readonly sourceEventSchemaVersion:
    typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly cloudEventsSpecVersion:
    typeof CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION;
  readonly shadowRuntimePipelineVersion:
    typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly sourceEventDigest: string;
  readonly tenantRefDigest: string;
  readonly sourcePartitionDigest: string;
  readonly sourceHistoryRefDigest: string;
  readonly sourceHistorySequence: number | null;
  readonly activationProfileVersion: string;
  readonly activationProfileDigest: string;
  readonly activationWorkKeyDigest: string;
  readonly partitionKeyDigest: string;
  readonly sourceHistoryBindingDigest: string;
  readonly idempotencyBindingDigest: string;
  readonly outboxPayloadDigest: string;
  readonly outboxWorkItemDigest: string;
  readonly dedupeKeyDigest: string;
  readonly requestedAt: string;
  readonly availableAt: string;
  readonly deliverySemantics: 'at-least-once';
  readonly duplicateHandling: 'activation-work-key-digest';
  readonly orderingScope: 'tenant-source-partition';
  readonly clockAuthority: 'timestamps-are-evidence-not-ordering-proof';
  readonly attemptCount: 0;
  readonly maxAttempts: number;
  readonly leaseSeconds: number;
  readonly reconcileWindowSeconds: number;
  readonly claimTokenDigest: null;
  readonly claimWorkerDigest: null;
  readonly claimedAt: null;
  readonly claimExpiresAt: null;
  readonly reasonCodes: readonly string[];
  readonly pendingOnly: true;
  readonly atLeastOnceOnly: true;
  readonly exactlyOnceClaimed: false;
  readonly globalTotalOrderingClaimed: false;
  readonly rawIdempotencyKeyStored: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly claimBehaviorIncluded: false;
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

export interface ShadowOutboxWorkItemContractDescriptor {
  readonly version: typeof SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION;
  readonly eventType: typeof SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE;
  readonly activationProfileContractVersion:
    typeof SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION;
  readonly workKeyVersion: typeof SHADOW_ACTIVATION_WORK_KEY_VERSION;
  readonly sourceEventSchemaVersion:
    typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly cloudEventsSpecVersion:
    typeof CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION;
  readonly shadowRuntimePipelineVersion:
    typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly sourceAnchors: readonly ShadowOutboxWorkItemSourceAnchor[];
  readonly status: 'pending';
  readonly deliverySemantics: 'at-least-once';
  readonly duplicateHandling: 'activation-work-key-digest';
  readonly orderingScope: 'tenant-source-partition';
  readonly clockAuthority: 'timestamps-are-evidence-not-ordering-proof';
  readonly identityFormula: readonly string[];
  readonly payloadFormula: readonly string[];
  readonly pendingOnly: true;
  readonly rawIdempotencyKeyStored: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly claimBehaviorIncluded: false;
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
    throw new Error(`Shadow outbox work item ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 512 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Shadow outbox work item ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Shadow outbox work item ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeTimestamp(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Shadow outbox work item ${fieldName} must be an ISO timestamp.`);
  }
  return normalized;
}

function normalizeOptionalPositiveInteger(
  value: number | null | undefined,
  fieldName: string,
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new Error(
      `Shadow outbox work item ${fieldName} must be a positive bounded integer.`,
    );
  }
  return value;
}

function assertFalse(
  value: boolean,
  fieldName: string,
): void {
  if (value !== false) {
    throw new Error(`Shadow outbox work item activationProfile.${fieldName} must be false.`);
  }
}

function assertActivationProfile(profile: ShadowActivationProfileContract): void {
  if (profile.version !== SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION) {
    throw new Error(
      `Shadow outbox work item activationProfile.version must be ${SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION}.`,
    );
  }
  if (profile.workKeyVersion !== SHADOW_ACTIVATION_WORK_KEY_VERSION) {
    throw new Error(
      `Shadow outbox work item activationProfile.workKeyVersion must be ${SHADOW_ACTIVATION_WORK_KEY_VERSION}.`,
    );
  }
  if (profile.sourceEventSchemaVersion !== CANONICAL_SHADOW_EVENT_SCHEMA_VERSION) {
    throw new Error(
      `Shadow outbox work item activationProfile.sourceEventSchemaVersion must be ${CANONICAL_SHADOW_EVENT_SCHEMA_VERSION}.`,
    );
  }
  if (profile.cloudEventsSpecVersion !== CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION) {
    throw new Error(
      `Shadow outbox work item activationProfile.cloudEventsSpecVersion must be ${CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION}.`,
    );
  }
  if (profile.shadowRuntimePipelineVersion !== SHADOW_RUNTIME_PIPELINE_VERSION) {
    throw new Error(
      `Shadow outbox work item activationProfile.shadowRuntimePipelineVersion must be ${SHADOW_RUNTIME_PIPELINE_VERSION}.`,
    );
  }
  assertFalse(profile.exactlyOnceClaimed, 'exactlyOnceClaimed');
  assertFalse(profile.globalTotalOrderingClaimed, 'globalTotalOrderingClaimed');
  assertFalse(profile.rawIdempotencyKeyStored, 'rawIdempotencyKeyStored');
  assertFalse(profile.rawPayloadRead, 'rawPayloadRead');
  assertFalse(profile.rawPayloadStored, 'rawPayloadStored');
  assertFalse(profile.workerBehaviorIncluded, 'workerBehaviorIncluded');
  assertFalse(profile.outboxWriteIncluded, 'outboxWriteIncluded');
  assertFalse(profile.auditPlaneWriteIncluded, 'auditPlaneWriteIncluded');
  assertFalse(profile.packetSigningIncluded, 'packetSigningIncluded');
  assertFalse(profile.grantsAuthority, 'grantsAuthority');
  assertFalse(profile.canAdmit, 'canAdmit');
  assertFalse(profile.activatesEnforcement, 'activatesEnforcement');
  assertFalse(profile.autoEnforce, 'autoEnforce');
  assertFalse(profile.learnsFromTraffic, 'learnsFromTraffic');
  assertFalse(profile.productionReady, 'productionReady');
}

export function createShadowOutboxWorkItemContract(
  input: CreateShadowOutboxWorkItemContractInput,
): ShadowOutboxWorkItemContract {
  const activationProfile = input.activationProfile;
  assertActivationProfile(activationProfile);

  const sourceHistoryRefDigest = normalizeDigest(
    input.sourceHistoryRefDigest,
    'sourceHistoryRefDigest',
  );
  const requestedAt = normalizeTimestamp(input.requestedAt, 'requestedAt');
  const availableAt = normalizeTimestamp(input.availableAt ?? requestedAt, 'availableAt');
  if (Date.parse(availableAt) < Date.parse(requestedAt)) {
    throw new Error('Shadow outbox work item availableAt cannot be before requestedAt.');
  }
  const sourceHistorySequence = normalizeOptionalPositiveInteger(
    input.sourceHistorySequence,
    'sourceHistorySequence',
  );

  const sourceHistoryBindingDigest = digestValue(
    'attestor.shadow-outbox-source-history-binding.v1',
    {
      sourceEventDigest: activationProfile.sourceEventDigest,
      tenantRefDigest: activationProfile.tenantRefDigest,
      sourceHistoryRefDigest,
      sourceHistorySequence,
    },
  );
  const idempotencyBindingDigest = digestValue(
    'attestor.shadow-outbox-idempotency-binding.v1',
    {
      activationWorkKeyDigest: activationProfile.activationWorkKeyDigest,
      activationProfileDigest: activationProfile.digest,
      sourceHistoryRefDigest,
      eventType: SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
    },
  );
  const outboxPayloadDigest = digestValue('attestor.shadow-outbox-payload.v1', {
    sourceEventDigest: activationProfile.sourceEventDigest,
    tenantRefDigest: activationProfile.tenantRefDigest,
    sourceHistoryRefDigest,
    activationProfileDigest: activationProfile.digest,
    activationWorkKeyDigest: activationProfile.activationWorkKeyDigest,
    partitionKeyDigest: activationProfile.sourcePartitionDigest,
  });
  const outboxWorkItemDigest = digestValue('attestor.shadow-outbox-work-item-identity.v1', {
    version: SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
    eventType: SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
    sourceHistoryRefDigest,
    activationWorkKeyDigest: activationProfile.activationWorkKeyDigest,
    partitionKeyDigest: activationProfile.sourcePartitionDigest,
  });
  const reasonCodes = Object.freeze([
    'status:pending',
    'delivery:at-least-once',
    'duplicate-handling:activation-work-key-digest',
    'ordering:tenant-source-partition',
    'clock:timestamps-are-evidence-not-ordering-proof',
    'claim:excluded-r04',
    'worker:excluded-r04-r05',
    'authority:shadow-only-no-admit',
  ]);

  const material = {
    version: SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
    eventType: SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
    status: 'pending' as const,
    activationProfileContractVersion: SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
    workKeyVersion: SHADOW_ACTIVATION_WORK_KEY_VERSION,
    sourceEventSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    cloudEventsSpecVersion: CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    sourceEventDigest: activationProfile.sourceEventDigest,
    tenantRefDigest: activationProfile.tenantRefDigest,
    sourcePartitionDigest: activationProfile.sourcePartitionDigest,
    sourceHistoryRefDigest,
    sourceHistorySequence,
    activationProfileVersion: activationProfile.activationProfileVersion,
    activationProfileDigest: activationProfile.digest,
    activationWorkKeyDigest: activationProfile.activationWorkKeyDigest,
    partitionKeyDigest: activationProfile.sourcePartitionDigest,
    sourceHistoryBindingDigest,
    idempotencyBindingDigest,
    outboxPayloadDigest,
    outboxWorkItemDigest,
    dedupeKeyDigest: activationProfile.activationWorkKeyDigest,
    requestedAt,
    availableAt,
    deliverySemantics: 'at-least-once' as const,
    duplicateHandling: 'activation-work-key-digest' as const,
    orderingScope: 'tenant-source-partition' as const,
    clockAuthority: 'timestamps-are-evidence-not-ordering-proof' as const,
    attemptCount: 0 as const,
    maxAttempts: activationProfile.maxAttempts,
    leaseSeconds: activationProfile.leaseSeconds,
    reconcileWindowSeconds: activationProfile.reconcileWindowSeconds,
    claimTokenDigest: null,
    claimWorkerDigest: null,
    claimedAt: null,
    claimExpiresAt: null,
    reasonCodes,
    pendingOnly: true as const,
    atLeastOnceOnly: true as const,
    exactlyOnceClaimed: false as const,
    globalTotalOrderingClaimed: false as const,
    rawIdempotencyKeyStored: false as const,
    rawPayloadRead: false as const,
    rawPayloadStored: false as const,
    claimBehaviorIncluded: false as const,
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
  } satisfies Omit<ShadowOutboxWorkItemContract, 'canonical' | 'digest'>;
  const { canonical, digest } = canonicalObject(material);

  return Object.freeze({
    ...material,
    canonical,
    digest,
  });
}

export function shadowOutboxWorkItemContractDescriptor():
  ShadowOutboxWorkItemContractDescriptor {
  return Object.freeze({
    version: SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
    eventType: SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
    activationProfileContractVersion: SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
    workKeyVersion: SHADOW_ACTIVATION_WORK_KEY_VERSION,
    sourceEventSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    cloudEventsSpecVersion: CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    sourceAnchors: SHADOW_OUTBOX_WORK_ITEM_SOURCE_ANCHORS,
    status: 'pending',
    deliverySemantics: 'at-least-once',
    duplicateHandling: 'activation-work-key-digest',
    orderingScope: 'tenant-source-partition',
    clockAuthority: 'timestamps-are-evidence-not-ordering-proof',
    identityFormula: Object.freeze([
      'version',
      'eventType',
      'sourceHistoryRefDigest',
      'activationWorkKeyDigest',
      'partitionKeyDigest',
    ]),
    payloadFormula: Object.freeze([
      'sourceEventDigest',
      'tenantRefDigest',
      'sourceHistoryRefDigest',
      'activationProfileDigest',
      'activationWorkKeyDigest',
      'partitionKeyDigest',
    ]),
    pendingOnly: true,
    rawIdempotencyKeyStored: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    claimBehaviorIncluded: false,
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
      'not-claim-behavior',
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
