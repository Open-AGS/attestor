import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
  SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
  type ShadowOutboxWorkItemContract,
} from './shadow-outbox-work-item-contract.js';

export const SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION =
  'attestor.shadow-dispatch-claim-contract.v1';

export const SHADOW_DISPATCH_CLAIM_TOKEN_VERSION =
  'attestor.shadow-dispatch-claim-token.v1';

export const SHADOW_DISPATCH_CLAIM_MODES = [
  'event-driven',
  'reconcile-loop',
  'reconcile-expired-lease',
] as const;
export type ShadowDispatchClaimMode = typeof SHADOW_DISPATCH_CLAIM_MODES[number];

export const SHADOW_DISPATCH_CLAIM_SOURCE_ANCHORS = [
  'postgres-for-update-skip-locked-queue-claim',
  'postgres-transaction-advisory-lock-tenant-scope',
  'kubernetes-controller-reconcile-loop',
  'transactional-outbox-pattern',
  'stripe-idempotency-key',
  'stripe-webhook-quick-2xx-before-work',
  'cloudevents-common-event-envelope',
  'opentelemetry-log-trace-context',
  'w3c-trace-context-correlation-not-authority',
  'lamport-happened-before-partial-order',
] as const;
export type ShadowDispatchClaimSourceAnchor =
  typeof SHADOW_DISPATCH_CLAIM_SOURCE_ANCHORS[number];

export interface CreateShadowDispatchClaimContractInput {
  readonly workItem: ShadowOutboxWorkItemContract;
  readonly workerRefDigest: string;
  readonly claimedAt: string;
  readonly claimMode?: ShadowDispatchClaimMode | null;
  readonly dispatcherRunDigest?: string | null;
}

export interface ShadowDispatchClaimContract {
  readonly version: typeof SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION;
  readonly claimTokenVersion: typeof SHADOW_DISPATCH_CLAIM_TOKEN_VERSION;
  readonly sourceWorkItemContractVersion:
    typeof SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION;
  readonly sourceWorkItemEventType: typeof SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE;
  readonly claimMode: ShadowDispatchClaimMode;
  readonly claimStatus: 'claimed';
  readonly claimLeaseSemantics: 'time-bounded-lease';
  readonly rowLockSemantics: 'for-update-skip-locked';
  readonly advisoryLockScope: 'tenant-source-partition';
  readonly retrySemantics: 'bounded-attempt-increment';
  readonly duplicateHandling: 'activation-work-key-digest';
  readonly orderingScope: 'tenant-source-partition';
  readonly clockAuthority: 'timestamps-are-evidence-not-ordering-proof';
  readonly sourceEventDigest: string;
  readonly tenantRefDigest: string;
  readonly sourcePartitionDigest: string;
  readonly sourceHistoryRefDigest: string;
  readonly activationWorkKeyDigest: string;
  readonly outboxWorkItemDigest: string;
  readonly outboxPayloadDigest: string;
  readonly dedupeKeyDigest: string;
  readonly workerRefDigest: string;
  readonly dispatcherRunDigest: string | null;
  readonly claimAttempt: number;
  readonly maxAttempts: number;
  readonly leaseSeconds: number;
  readonly claimedAt: string;
  readonly claimExpiresAt: string;
  readonly claimTokenDigest: string;
  readonly claimLeaseDigest: string;
  readonly workerBindingDigest: string;
  readonly partitionClaimDigest: string;
  readonly reasonCodes: readonly string[];
  readonly claimContractIncluded: true;
  readonly claimStorageMutationIncluded: false;
  readonly workerBehaviorIncluded: false;
  readonly runnerInvocationIncluded: false;
  readonly outboxWriteIncluded: false;
  readonly auditPlaneWriteIncluded: false;
  readonly packetSigningIncluded: false;
  readonly leaseReleaseIncluded: false;
  readonly publishIncluded: false;
  readonly atLeastOnceOnly: true;
  readonly exactlyOnceClaimed: false;
  readonly globalTotalOrderingClaimed: false;
  readonly rawIdempotencyKeyStored: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly learnsFromTraffic: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowDispatchClaimContractDescriptor {
  readonly version: typeof SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION;
  readonly claimTokenVersion: typeof SHADOW_DISPATCH_CLAIM_TOKEN_VERSION;
  readonly sourceWorkItemContractVersion:
    typeof SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION;
  readonly sourceWorkItemEventType: typeof SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE;
  readonly sourceAnchors: readonly ShadowDispatchClaimSourceAnchor[];
  readonly claimModes: readonly ShadowDispatchClaimMode[];
  readonly claimStatus: 'claimed';
  readonly claimLeaseSemantics: 'time-bounded-lease';
  readonly rowLockSemantics: 'for-update-skip-locked';
  readonly advisoryLockScope: 'tenant-source-partition';
  readonly retrySemantics: 'bounded-attempt-increment';
  readonly duplicateHandling: 'activation-work-key-digest';
  readonly orderingScope: 'tenant-source-partition';
  readonly clockAuthority: 'timestamps-are-evidence-not-ordering-proof';
  readonly claimTokenFormula: readonly string[];
  readonly claimContractIncluded: true;
  readonly claimStorageMutationIncluded: false;
  readonly workerBehaviorIncluded: false;
  readonly runnerInvocationIncluded: false;
  readonly outboxWriteIncluded: false;
  readonly auditPlaneWriteIncluded: false;
  readonly packetSigningIncluded: false;
  readonly leaseReleaseIncluded: false;
  readonly publishIncluded: false;
  readonly atLeastOnceOnly: true;
  readonly exactlyOnceClaimed: false;
  readonly globalTotalOrderingClaimed: false;
  readonly rawIdempotencyKeyStored: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
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
    throw new Error(`Shadow dispatch claim ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 512 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Shadow dispatch claim ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Shadow dispatch claim ${fieldName} must be a sha256 digest.`);
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

function normalizeTimestamp(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Shadow dispatch claim ${fieldName} must be an ISO timestamp.`);
  }
  return normalized;
}

function addSeconds(timestamp: string, seconds: number): string {
  return new Date(Date.parse(timestamp) + seconds * 1000).toISOString();
}

function normalizeClaimMode(
  value: ShadowDispatchClaimMode | null | undefined,
): ShadowDispatchClaimMode {
  const mode = value ?? 'event-driven';
  if (!SHADOW_DISPATCH_CLAIM_MODES.includes(mode)) {
    throw new Error('Shadow dispatch claim claimMode is not supported.');
  }
  return mode;
}

function assertFalse(value: boolean, fieldName: string): void {
  if (value !== false) {
    throw new Error(`Shadow dispatch claim workItem.${fieldName} must be false.`);
  }
}

function assertPendingWorkItem(workItem: ShadowOutboxWorkItemContract): void {
  if (workItem.version !== SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION) {
    throw new Error(
      `Shadow dispatch claim workItem.version must be ${SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION}.`,
    );
  }
  if (workItem.eventType !== SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE) {
    throw new Error(
      `Shadow dispatch claim workItem.eventType must be ${SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE}.`,
    );
  }
  if (workItem.status !== 'pending') {
    throw new Error('Shadow dispatch claim workItem.status must be pending.');
  }
  if (workItem.attemptCount >= workItem.maxAttempts) {
    throw new Error('Shadow dispatch claim workItem attempts are exhausted.');
  }
  if (workItem.claimTokenDigest !== null || workItem.claimWorkerDigest !== null) {
    throw new Error('Shadow dispatch claim workItem must not already contain a claim.');
  }
  assertFalse(workItem.exactlyOnceClaimed, 'exactlyOnceClaimed');
  assertFalse(workItem.globalTotalOrderingClaimed, 'globalTotalOrderingClaimed');
  assertFalse(workItem.rawIdempotencyKeyStored, 'rawIdempotencyKeyStored');
  assertFalse(workItem.rawPayloadRead, 'rawPayloadRead');
  assertFalse(workItem.rawPayloadStored, 'rawPayloadStored');
  assertFalse(workItem.claimBehaviorIncluded, 'claimBehaviorIncluded');
  assertFalse(workItem.workerBehaviorIncluded, 'workerBehaviorIncluded');
  assertFalse(workItem.outboxWriteIncluded, 'outboxWriteIncluded');
  assertFalse(workItem.auditPlaneWriteIncluded, 'auditPlaneWriteIncluded');
  assertFalse(workItem.packetSigningIncluded, 'packetSigningIncluded');
  assertFalse(workItem.grantsAuthority, 'grantsAuthority');
  assertFalse(workItem.canAdmit, 'canAdmit');
  assertFalse(workItem.activatesEnforcement, 'activatesEnforcement');
  assertFalse(workItem.autoEnforce, 'autoEnforce');
  assertFalse(workItem.learnsFromTraffic, 'learnsFromTraffic');
  assertFalse(workItem.productionReady, 'productionReady');
}

export function createShadowDispatchClaimContract(
  input: CreateShadowDispatchClaimContractInput,
): ShadowDispatchClaimContract {
  const workItem = input.workItem;
  assertPendingWorkItem(workItem);

  const workerRefDigest = normalizeDigest(input.workerRefDigest, 'workerRefDigest');
  const dispatcherRunDigest = normalizeOptionalDigest(
    input.dispatcherRunDigest,
    'dispatcherRunDigest',
  );
  const claimedAt = normalizeTimestamp(input.claimedAt, 'claimedAt');
  if (Date.parse(claimedAt) < Date.parse(workItem.availableAt)) {
    throw new Error('Shadow dispatch claim claimedAt cannot be before workItem.availableAt.');
  }
  const claimMode = normalizeClaimMode(input.claimMode);
  const claimAttempt = workItem.attemptCount + 1;
  const claimExpiresAt = addSeconds(claimedAt, workItem.leaseSeconds);

  const claimTokenDigest = digestValue(SHADOW_DISPATCH_CLAIM_TOKEN_VERSION, {
    version: SHADOW_DISPATCH_CLAIM_TOKEN_VERSION,
    outboxWorkItemDigest: workItem.outboxWorkItemDigest,
    activationWorkKeyDigest: workItem.activationWorkKeyDigest,
    workerRefDigest,
    claimAttempt,
    claimedAt,
    claimMode,
  });
  const claimLeaseDigest = digestValue('attestor.shadow-dispatch-claim-lease.v1', {
    claimTokenDigest,
    claimedAt,
    claimExpiresAt,
    leaseSeconds: workItem.leaseSeconds,
  });
  const workerBindingDigest = digestValue('attestor.shadow-dispatch-worker-binding.v1', {
    workerRefDigest,
    tenantRefDigest: workItem.tenantRefDigest,
    sourcePartitionDigest: workItem.sourcePartitionDigest,
    claimTokenDigest,
  });
  const partitionClaimDigest = digestValue('attestor.shadow-dispatch-partition-claim.v1', {
    tenantRefDigest: workItem.tenantRefDigest,
    sourcePartitionDigest: workItem.sourcePartitionDigest,
    partitionKeyDigest: workItem.partitionKeyDigest,
    claimTokenDigest,
  });
  const reasonCodes = Object.freeze([
    `claim-mode:${claimMode}`,
    'status:claimed',
    'row-lock:for-update-skip-locked',
    'advisory-lock:tenant-source-partition',
    'retry:bounded-attempt-increment',
    'delivery:at-least-once',
    'duplicate-handling:activation-work-key-digest',
    'ordering:tenant-source-partition',
    'clock:timestamps-are-evidence-not-ordering-proof',
    'runner:excluded-r05',
    'authority:shadow-only-no-admit',
  ]);

  const material = {
    version: SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION,
    claimTokenVersion: SHADOW_DISPATCH_CLAIM_TOKEN_VERSION,
    sourceWorkItemContractVersion: SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
    sourceWorkItemEventType: SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
    claimMode,
    claimStatus: 'claimed' as const,
    claimLeaseSemantics: 'time-bounded-lease' as const,
    rowLockSemantics: 'for-update-skip-locked' as const,
    advisoryLockScope: 'tenant-source-partition' as const,
    retrySemantics: 'bounded-attempt-increment' as const,
    duplicateHandling: 'activation-work-key-digest' as const,
    orderingScope: 'tenant-source-partition' as const,
    clockAuthority: 'timestamps-are-evidence-not-ordering-proof' as const,
    sourceEventDigest: workItem.sourceEventDigest,
    tenantRefDigest: workItem.tenantRefDigest,
    sourcePartitionDigest: workItem.sourcePartitionDigest,
    sourceHistoryRefDigest: workItem.sourceHistoryRefDigest,
    activationWorkKeyDigest: workItem.activationWorkKeyDigest,
    outboxWorkItemDigest: workItem.outboxWorkItemDigest,
    outboxPayloadDigest: workItem.outboxPayloadDigest,
    dedupeKeyDigest: workItem.dedupeKeyDigest,
    workerRefDigest,
    dispatcherRunDigest,
    claimAttempt,
    maxAttempts: workItem.maxAttempts,
    leaseSeconds: workItem.leaseSeconds,
    claimedAt,
    claimExpiresAt,
    claimTokenDigest,
    claimLeaseDigest,
    workerBindingDigest,
    partitionClaimDigest,
    reasonCodes,
    claimContractIncluded: true as const,
    claimStorageMutationIncluded: false as const,
    workerBehaviorIncluded: false as const,
    runnerInvocationIncluded: false as const,
    outboxWriteIncluded: false as const,
    auditPlaneWriteIncluded: false as const,
    packetSigningIncluded: false as const,
    leaseReleaseIncluded: false as const,
    publishIncluded: false as const,
    atLeastOnceOnly: true as const,
    exactlyOnceClaimed: false as const,
    globalTotalOrderingClaimed: false as const,
    rawIdempotencyKeyStored: false as const,
    rawPayloadRead: false as const,
    rawPayloadStored: false as const,
    grantsAuthority: false as const,
    canAdmit: false as const,
    activatesEnforcement: false as const,
    autoEnforce: false as const,
    learnsFromTraffic: false as const,
    productionReady: false as const,
  } satisfies Omit<ShadowDispatchClaimContract, 'canonical' | 'digest'>;
  const { canonical, digest } = canonicalObject(material);

  return Object.freeze({
    ...material,
    canonical,
    digest,
  });
}

export function shadowDispatchClaimContractDescriptor():
  ShadowDispatchClaimContractDescriptor {
  return Object.freeze({
    version: SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION,
    claimTokenVersion: SHADOW_DISPATCH_CLAIM_TOKEN_VERSION,
    sourceWorkItemContractVersion: SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
    sourceWorkItemEventType: SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
    sourceAnchors: SHADOW_DISPATCH_CLAIM_SOURCE_ANCHORS,
    claimModes: SHADOW_DISPATCH_CLAIM_MODES,
    claimStatus: 'claimed',
    claimLeaseSemantics: 'time-bounded-lease',
    rowLockSemantics: 'for-update-skip-locked',
    advisoryLockScope: 'tenant-source-partition',
    retrySemantics: 'bounded-attempt-increment',
    duplicateHandling: 'activation-work-key-digest',
    orderingScope: 'tenant-source-partition',
    clockAuthority: 'timestamps-are-evidence-not-ordering-proof',
    claimTokenFormula: Object.freeze([
      'claimTokenVersion',
      'outboxWorkItemDigest',
      'activationWorkKeyDigest',
      'workerRefDigest',
      'claimAttempt',
      'claimedAt',
      'claimMode',
    ]),
    claimContractIncluded: true,
    claimStorageMutationIncluded: false,
    workerBehaviorIncluded: false,
    runnerInvocationIncluded: false,
    outboxWriteIncluded: false,
    auditPlaneWriteIncluded: false,
    packetSigningIncluded: false,
    leaseReleaseIncluded: false,
    publishIncluded: false,
    atLeastOnceOnly: true,
    exactlyOnceClaimed: false,
    globalTotalOrderingClaimed: false,
    rawIdempotencyKeyStored: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    learnsFromTraffic: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-storage-claim-mutation',
      'not-worker-behavior',
      'not-runner-invocation',
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
