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
  SHADOW_RUNTIME_PIPELINE_VERSION,
  runShadowRuntimePipelineDryRun,
  type ShadowRuntimePipelineResult,
} from './shadow-runtime-pipeline.js';
import {
  type CreateShadowEnvelopeProjectionOptions,
} from './shadow-envelope-projector.js';
import {
  SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION,
  SHADOW_DISPATCH_CLAIM_TOKEN_VERSION,
  type ShadowDispatchClaimContract,
} from './shadow-dispatch-claim-contract.js';
import {
  SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
  SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
} from './shadow-outbox-work-item-contract.js';

export const SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION =
  'attestor.shadow-runtime-activation-runner.v1';

export const SHADOW_RUNTIME_ACTIVATION_RUNNER_SOURCE_ANCHORS = [
  'nasa-runtime-assurance-simplex-monitor',
  'kubernetes-controller-reconcile-loop',
  'transactional-outbox-pattern',
  'postgres-skip-locked-claim-precondition',
  'stripe-idempotency-key',
  'opentelemetry-log-trace-context',
  'w3c-trace-context-correlation-not-authority',
  'opa-decision-log-redaction-boundary',
  'cloudevents-common-event-envelope',
] as const;
export type ShadowRuntimeActivationRunnerSourceAnchor =
  typeof SHADOW_RUNTIME_ACTIVATION_RUNNER_SOURCE_ANCHORS[number];

export interface RunShadowRuntimeActivationInput {
  readonly claim: ShadowDispatchClaimContract;
  readonly event: CanonicalShadowEvent;
  readonly projectionOptions?: CreateShadowEnvelopeProjectionOptions | null;
  readonly generatedAt?: string | null;
  readonly reviewerCapacityPerHour?: number | null;
  readonly currentReviewRatePerMinute?: number | null;
}

export interface ShadowRuntimeActivationResult {
  readonly version: typeof SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION;
  readonly sourceClaimContractVersion:
    typeof SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION;
  readonly sourceClaimTokenVersion: typeof SHADOW_DISPATCH_CLAIM_TOKEN_VERSION;
  readonly sourceWorkItemContractVersion:
    typeof SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION;
  readonly sourceWorkItemEventType: typeof SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE;
  readonly shadowRuntimePipelineVersion: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly activationStatus: 'shadow-dry-run-complete';
  readonly executionMode: 'shadow-only';
  readonly claimTokenDigest: string;
  readonly claimLeaseDigest: string;
  readonly workerRefDigest: string;
  readonly claimAttempt: number;
  readonly claimedAt: string;
  readonly claimExpiresAt: string;
  readonly sourceEventDigest: string;
  readonly tenantRefDigest: string;
  readonly sourcePartitionDigest: string;
  readonly sourceHistoryRefDigest: string;
  readonly activationWorkKeyDigest: string;
  readonly outboxWorkItemDigest: string;
  readonly runnerInvocationDigest: string;
  readonly pipelineDigest: string;
  readonly projectionDigest: string;
  readonly envelopeRefDigest: string;
  readonly assurancePacketDigest: string;
  readonly generatedAt: string;
  readonly pipeline: ShadowRuntimePipelineResult;
  readonly reasonCodes: readonly string[];
  readonly claimLeaseChecked: true;
  readonly runnerInvocationIncluded: true;
  readonly dryRunOnly: true;
  readonly workerBehaviorIncluded: false;
  readonly claimStorageMutationIncluded: false;
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
  readonly crossTenantAggregation: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowRuntimeActivationRunnerDescriptor {
  readonly version: typeof SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION;
  readonly sourceClaimContractVersion:
    typeof SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION;
  readonly sourceClaimTokenVersion: typeof SHADOW_DISPATCH_CLAIM_TOKEN_VERSION;
  readonly sourceWorkItemContractVersion:
    typeof SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION;
  readonly sourceWorkItemEventType: typeof SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE;
  readonly shadowRuntimePipelineVersion: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly sourceAnchors: readonly ShadowRuntimeActivationRunnerSourceAnchor[];
  readonly calls: 'runShadowRuntimePipelineDryRun';
  readonly executionMode: 'shadow-only';
  readonly claimLeaseRequired: true;
  readonly eventDigestMustMatchClaim: true;
  readonly tenantDigestMustMatchClaim: true;
  readonly runnerInvocationIncluded: true;
  readonly dryRunOnly: true;
  readonly workerBehaviorIncluded: false;
  readonly claimStorageMutationIncluded: false;
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
  readonly crossTenantAggregation: false;
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

function digestValue(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

function normalizeTimestamp(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Shadow runtime activation runner ${fieldName} requires an ISO timestamp.`);
  }
  const normalized = value.trim();
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Shadow runtime activation runner ${fieldName} must be an ISO timestamp.`);
  }
  return normalized;
}

function assertFalse(value: boolean, fieldName: string): void {
  if (value !== false) {
    throw new Error(`Shadow runtime activation runner ${fieldName} must be false.`);
  }
}

function assertClaim(claim: ShadowDispatchClaimContract): void {
  if (claim.version !== SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION) {
    throw new Error(
      `Shadow runtime activation runner claim.version must be ${SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION}.`,
    );
  }
  if (claim.claimTokenVersion !== SHADOW_DISPATCH_CLAIM_TOKEN_VERSION) {
    throw new Error(
      `Shadow runtime activation runner claim.claimTokenVersion must be ${SHADOW_DISPATCH_CLAIM_TOKEN_VERSION}.`,
    );
  }
  if (claim.sourceWorkItemContractVersion !== SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION) {
    throw new Error(
      `Shadow runtime activation runner claim.sourceWorkItemContractVersion must be ${SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION}.`,
    );
  }
  if (claim.sourceWorkItemEventType !== SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE) {
    throw new Error(
      `Shadow runtime activation runner claim.sourceWorkItemEventType must be ${SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE}.`,
    );
  }
  assertFalse(claim.workerBehaviorIncluded, 'claim.workerBehaviorIncluded');
  assertFalse(claim.claimStorageMutationIncluded, 'claim.claimStorageMutationIncluded');
  assertFalse(claim.outboxWriteIncluded, 'claim.outboxWriteIncluded');
  assertFalse(claim.auditPlaneWriteIncluded, 'claim.auditPlaneWriteIncluded');
  assertFalse(claim.packetSigningIncluded, 'claim.packetSigningIncluded');
  assertFalse(claim.leaseReleaseIncluded, 'claim.leaseReleaseIncluded');
  assertFalse(claim.publishIncluded, 'claim.publishIncluded');
  assertFalse(claim.exactlyOnceClaimed, 'claim.exactlyOnceClaimed');
  assertFalse(claim.globalTotalOrderingClaimed, 'claim.globalTotalOrderingClaimed');
  assertFalse(claim.rawIdempotencyKeyStored, 'claim.rawIdempotencyKeyStored');
  assertFalse(claim.rawPayloadRead, 'claim.rawPayloadRead');
  assertFalse(claim.rawPayloadStored, 'claim.rawPayloadStored');
  assertFalse(claim.grantsAuthority, 'claim.grantsAuthority');
  assertFalse(claim.canAdmit, 'claim.canAdmit');
  assertFalse(claim.activatesEnforcement, 'claim.activatesEnforcement');
  assertFalse(claim.autoEnforce, 'claim.autoEnforce');
  assertFalse(claim.learnsFromTraffic, 'claim.learnsFromTraffic');
  assertFalse(claim.productionReady, 'claim.productionReady');
}

function assertEventMatchesClaim(
  event: CanonicalShadowEvent,
  claim: ShadowDispatchClaimContract,
): void {
  if (event.version !== CANONICAL_SHADOW_EVENT_SCHEMA_VERSION) {
    throw new Error(
      `Shadow runtime activation runner event.version must be ${CANONICAL_SHADOW_EVENT_SCHEMA_VERSION}.`,
    );
  }
  if (event.digest !== claim.sourceEventDigest) {
    throw new Error('Shadow runtime activation runner event digest must match claim sourceEventDigest.');
  }
  if (event.tenantRefDigest !== claim.tenantRefDigest) {
    throw new Error('Shadow runtime activation runner event tenantRefDigest must match claim tenantRefDigest.');
  }
  if (event.rawPayloadStored !== false || event.rawMaterialBoundary.rawPayloadStored !== false) {
    throw new Error('Shadow runtime activation runner event must not store raw payload material.');
  }
  if (event.autoEnforce !== false) {
    throw new Error('Shadow runtime activation runner event must be shadow-only.');
  }
}

function assertPipelineMatchesClaim(
  pipeline: ShadowRuntimePipelineResult,
  claim: ShadowDispatchClaimContract,
): void {
  if (pipeline.version !== SHADOW_RUNTIME_PIPELINE_VERSION) {
    throw new Error(
      `Shadow runtime activation runner pipeline.version must be ${SHADOW_RUNTIME_PIPELINE_VERSION}.`,
    );
  }
  if (pipeline.executionMode !== 'shadow-only') {
    throw new Error('Shadow runtime activation runner pipeline must be shadow-only.');
  }
  if (pipeline.projection.sourceEventDigest !== claim.sourceEventDigest) {
    throw new Error('Shadow runtime activation runner pipeline source digest must match claim.');
  }
  if (pipeline.projection.envelope.tenantContext.tenantRefDigest !== claim.tenantRefDigest) {
    throw new Error('Shadow runtime activation runner pipeline tenant digest must match claim.');
  }
  assertFalse(pipeline.grantsAuthority, 'pipeline.grantsAuthority');
  assertFalse(pipeline.canAdmit, 'pipeline.canAdmit');
  assertFalse(pipeline.activatesEnforcement, 'pipeline.activatesEnforcement');
  assertFalse(pipeline.autoEnforce, 'pipeline.autoEnforce');
  assertFalse(pipeline.learnsFromTraffic, 'pipeline.learnsFromTraffic');
  assertFalse(pipeline.crossTenantAggregation, 'pipeline.crossTenantAggregation');
  assertFalse(pipeline.rawPayloadRead, 'pipeline.rawPayloadRead');
  assertFalse(pipeline.rawPayloadStored, 'pipeline.rawPayloadStored');
  assertFalse(pipeline.productionReady, 'pipeline.productionReady');
}

export function runShadowRuntimeActivation(
  input: RunShadowRuntimeActivationInput,
): ShadowRuntimeActivationResult {
  const claim = input.claim;
  assertClaim(claim);
  assertEventMatchesClaim(input.event, claim);

  const generatedAt = normalizeTimestamp(input.generatedAt ?? claim.claimedAt, 'generatedAt');
  if (Date.parse(generatedAt) < Date.parse(claim.claimedAt)) {
    throw new Error('Shadow runtime activation runner generatedAt cannot be before claim.claimedAt.');
  }
  if (Date.parse(generatedAt) > Date.parse(claim.claimExpiresAt)) {
    throw new Error('Shadow runtime activation runner generatedAt cannot be after claim.claimExpiresAt.');
  }

  const pipeline = runShadowRuntimePipelineDryRun({
    event: input.event,
    projectionOptions: input.projectionOptions ?? {},
    generatedAt,
    reviewerCapacityPerHour: input.reviewerCapacityPerHour,
    currentReviewRatePerMinute: input.currentReviewRatePerMinute,
  });
  assertPipelineMatchesClaim(pipeline, claim);

  const runnerInvocationDigest = digestValue('attestor.shadow-runtime-activation-runner.invocation.v1', {
    version: SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
    claimTokenDigest: claim.claimTokenDigest,
    sourceEventDigest: claim.sourceEventDigest,
    tenantRefDigest: claim.tenantRefDigest,
    pipelineDigest: pipeline.digest,
    generatedAt,
  });
  const reasonCodes = Object.freeze([
    'activation:shadow-dry-run-complete',
    'runner:runShadowRuntimePipelineDryRun',
    'execution-mode:shadow-only',
    'lease:checked-not-expired',
    'claim:validated',
    'event:matched-claim',
    'authority:shadow-only-no-admit',
  ]);

  const material = {
    version: SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
    sourceClaimContractVersion: SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION,
    sourceClaimTokenVersion: SHADOW_DISPATCH_CLAIM_TOKEN_VERSION,
    sourceWorkItemContractVersion: SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
    sourceWorkItemEventType: SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    activationStatus: 'shadow-dry-run-complete' as const,
    executionMode: 'shadow-only' as const,
    claimTokenDigest: claim.claimTokenDigest,
    claimLeaseDigest: claim.claimLeaseDigest,
    workerRefDigest: claim.workerRefDigest,
    claimAttempt: claim.claimAttempt,
    claimedAt: claim.claimedAt,
    claimExpiresAt: claim.claimExpiresAt,
    sourceEventDigest: claim.sourceEventDigest,
    tenantRefDigest: claim.tenantRefDigest,
    sourcePartitionDigest: claim.sourcePartitionDigest,
    sourceHistoryRefDigest: claim.sourceHistoryRefDigest,
    activationWorkKeyDigest: claim.activationWorkKeyDigest,
    outboxWorkItemDigest: claim.outboxWorkItemDigest,
    runnerInvocationDigest,
    pipelineDigest: pipeline.digest,
    projectionDigest: pipeline.projection.digest,
    envelopeRefDigest: pipeline.projection.envelopeRefDigest,
    assurancePacketDigest: pipeline.assurancePacket.digest,
    generatedAt,
    pipeline,
    reasonCodes,
    claimLeaseChecked: true as const,
    runnerInvocationIncluded: true as const,
    dryRunOnly: true as const,
    workerBehaviorIncluded: false as const,
    claimStorageMutationIncluded: false as const,
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
    crossTenantAggregation: false as const,
    productionReady: false as const,
  } satisfies Omit<ShadowRuntimeActivationResult, 'canonical' | 'digest'>;
  const { canonical, digest } = canonicalObject(
    material as unknown as CanonicalReleaseJsonValue,
  );

  return Object.freeze({
    ...material,
    canonical,
    digest,
  });
}

export function shadowRuntimeActivationRunnerDescriptor():
  ShadowRuntimeActivationRunnerDescriptor {
  return Object.freeze({
    version: SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
    sourceClaimContractVersion: SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION,
    sourceClaimTokenVersion: SHADOW_DISPATCH_CLAIM_TOKEN_VERSION,
    sourceWorkItemContractVersion: SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
    sourceWorkItemEventType: SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    sourceAnchors: SHADOW_RUNTIME_ACTIVATION_RUNNER_SOURCE_ANCHORS,
    calls: 'runShadowRuntimePipelineDryRun',
    executionMode: 'shadow-only',
    claimLeaseRequired: true,
    eventDigestMustMatchClaim: true,
    tenantDigestMustMatchClaim: true,
    runnerInvocationIncluded: true,
    dryRunOnly: true,
    workerBehaviorIncluded: false,
    claimStorageMutationIncluded: false,
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
    crossTenantAggregation: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-worker-behavior',
      'not-storage-claim-mutation',
      'not-outbox-write-integration',
      'not-audit-plane-write',
      'not-live-enforcement',
      'not-policy-activation',
      'not-lease-release',
      'not-publish',
      'not-packet-signing',
      'not-production-readiness',
    ]),
  });
}
