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
  OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
  createOutcomeIncidentFeedbackContract,
  type OutcomeIncidentFeedbackContract,
  type OutcomeIncidentFeedbackEventInput,
} from './outcome-incident-feedback-contract.js';
import {
  SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
  createShadowActivationProfileContract,
  type ShadowActivationProfileContract,
} from './shadow-activation-profile-contract.js';
import {
  SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION,
  createShadowDispatchClaimContract,
  type ShadowDispatchClaimContract,
} from './shadow-dispatch-claim-contract.js';
import {
  SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
  createShadowOutboxWorkItemContract,
  type ShadowOutboxWorkItemContract,
} from './shadow-outbox-work-item-contract.js';
import {
  SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
  runShadowRuntimeActivation,
  type ShadowRuntimeActivationResult,
} from './shadow-runtime-activation-runner.js';
import {
  SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
  runShadowRuntimeObservabilityHooks,
  type ShadowRuntimeObservabilityHooksResult,
} from './shadow-runtime-observability-hooks.js';
import {
  SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION,
  runShadowRuntimeOutcomeFeedbackHook,
  type ShadowRuntimeOutcomeFeedbackHookResult,
} from './shadow-runtime-outcome-feedback-hook.js';
import {
  SHADOW_RUNTIME_PIPELINE_VERSION,
} from './shadow-runtime-pipeline.js';

export const SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION =
  'attestor.shadow-runtime-fixture-replay-smoke.v1';

export const SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_SOURCE_ANCHORS = [
  'foundationdb-deterministic-simulation-replay',
  'cloudevents-common-event-metadata',
  'opentelemetry-trace-log-correlation',
  'w3c-prov-digest-bound-lineage',
  'stripe-idempotency-replay-key',
] as const;
export type ShadowRuntimeFixtureReplaySmokeSourceAnchor =
  typeof SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_SOURCE_ANCHORS[number];

export interface RunShadowRuntimeFixtureReplaySmokeInput {
  readonly fixtureId: string;
  readonly fixtureRefDigest: string;
  readonly event: CanonicalShadowEvent;
  readonly sourcePartitionDigest: string;
  readonly traceContextDigest: string;
  readonly sourceHistoryRefDigest: string;
  readonly sourceHistorySequence: number;
  readonly requestedAt: string;
  readonly claimedAt: string;
  readonly generatedAt: string;
  readonly observedAt: string;
  readonly outcomeObservedAt: string;
  readonly feedbackGeneratedAt: string;
  readonly evaluatedAt: string;
  readonly workerRefDigest: string;
  readonly dispatcherRunDigest: string;
  readonly observerRefDigest: string;
  readonly evaluatorRefDigest: string;
  readonly scopeDigest: string;
  readonly outcomeFeedbackEvents?: readonly OutcomeIncidentFeedbackEventInput[] | null;
}

export interface ShadowRuntimeFixtureReplaySmokeResult {
  readonly version: typeof SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION;
  readonly canonicalShadowEventSchemaVersion:
    typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly shadowActivationProfileContractVersion:
    typeof SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION;
  readonly shadowOutboxWorkItemContractVersion:
    typeof SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION;
  readonly shadowDispatchClaimContractVersion:
    typeof SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION;
  readonly shadowRuntimeActivationRunnerVersion:
    typeof SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION;
  readonly shadowRuntimePipelineVersion: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly shadowRuntimeObservabilityHooksVersion:
    typeof SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION;
  readonly outcomeIncidentFeedbackContractVersion:
    typeof OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION;
  readonly shadowRuntimeOutcomeFeedbackHookVersion:
    typeof SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION;
  readonly smokeStatus: 'fixture-replay-smoke-complete';
  readonly executionMode: 'shadow-only';
  readonly fixtureId: string;
  readonly fixtureRefDigest: string;
  readonly sourceEventDigest: string;
  readonly tenantRefDigest: string;
  readonly activationProfileDigest: string;
  readonly workItemDigest: string;
  readonly dispatchClaimDigest: string;
  readonly activationDigest: string;
  readonly pipelineDigest: string;
  readonly envelopeRefDigest: string;
  readonly observabilityDigest: string;
  readonly feedbackDigest: string;
  readonly outcomeFeedbackHookDigest: string;
  readonly finalAssuranceCaseDigest: string;
  readonly finalLineageGraphDigest: string;
  readonly outcome: ShadowRuntimeOutcomeFeedbackHookResult['outcome'];
  readonly feedbackStatus: OutcomeIncidentFeedbackContract['status'];
  readonly phaseDigests: readonly string[];
  readonly activationProfile: ShadowActivationProfileContract;
  readonly workItem: ShadowOutboxWorkItemContract;
  readonly dispatchClaim: ShadowDispatchClaimContract;
  readonly activation: ShadowRuntimeActivationResult;
  readonly observability: ShadowRuntimeObservabilityHooksResult;
  readonly feedback: OutcomeIncidentFeedbackContract;
  readonly outcomeFeedback: ShadowRuntimeOutcomeFeedbackHookResult;
  readonly reasonCodes: readonly string[];
  readonly fixtureOnly: true;
  readonly deterministicReplay: true;
  readonly noTargetSystemCall: true;
  readonly noAuditWrite: true;
  readonly noExternalEventBus: true;
  readonly noExternalTraceExport: true;
  readonly noExternalLineageExport: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly noTrainingActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowRuntimeFixtureReplaySmokeDescriptor {
  readonly version: typeof SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION;
  readonly canonicalShadowEventSchemaVersion:
    typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly shadowActivationProfileContractVersion:
    typeof SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION;
  readonly shadowOutboxWorkItemContractVersion:
    typeof SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION;
  readonly shadowDispatchClaimContractVersion:
    typeof SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION;
  readonly shadowRuntimeActivationRunnerVersion:
    typeof SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION;
  readonly shadowRuntimeObservabilityHooksVersion:
    typeof SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION;
  readonly shadowRuntimeOutcomeFeedbackHookVersion:
    typeof SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION;
  readonly sourceAnchors: readonly ShadowRuntimeFixtureReplaySmokeSourceAnchor[];
  readonly fixtureOnly: true;
  readonly deterministicReplay: true;
  readonly runsR02ThroughR07: true;
  readonly noTargetSystemCall: true;
  readonly noAuditWrite: true;
  readonly noExternalEventBus: true;
  readonly noExternalTraceExport: true;
  readonly noExternalLineageExport: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly noTrainingActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
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

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Shadow runtime fixture replay smoke ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 512 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Shadow runtime fixture replay smoke ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Shadow runtime fixture replay smoke ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeTimestamp(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Shadow runtime fixture replay smoke ${fieldName} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeSequence(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Shadow runtime fixture replay smoke sourceHistorySequence must be a non-negative integer.');
  }
  return value;
}

function assertEvent(event: CanonicalShadowEvent): void {
  if (event.version !== CANONICAL_SHADOW_EVENT_SCHEMA_VERSION) {
    throw new Error(
      `Shadow runtime fixture replay smoke event.version must be ${CANONICAL_SHADOW_EVENT_SCHEMA_VERSION}.`,
    );
  }
  if (event.rawPayloadStored || event.rawMaterialBoundary.rawPayloadStored) {
    throw new Error('Shadow runtime fixture replay smoke event must not store raw payload.');
  }
  if (event.autoEnforce) {
    throw new Error('Shadow runtime fixture replay smoke event must be shadow-only.');
  }
}

function defaultFeedbackEvents(input: {
  readonly fixtureId: string;
  readonly fixtureRefDigest: string;
  readonly outcomeObservedAt: string;
}): readonly OutcomeIncidentFeedbackEventInput[] {
  return Object.freeze([{
    eventId: `fixture-outcome:${input.fixtureId}`,
    sourceClass: 'downstream-receipt',
    sourceDigest: input.fixtureRefDigest,
    observedAt: input.outcomeObservedAt,
    state: 'receipted',
    outcome: 'succeeded',
    consequenceEffect: 'bounded',
    confidence: 0.99,
    replayRefDigest: input.fixtureRefDigest,
    reasonCodes: ['fixture:synthetic-success'],
  }]);
}

export function runShadowRuntimeFixtureReplaySmoke(
  input: RunShadowRuntimeFixtureReplaySmokeInput,
): ShadowRuntimeFixtureReplaySmokeResult {
  assertEvent(input.event);
  const fixtureId = normalizeIdentifier(input.fixtureId, 'fixtureId');
  const fixtureRefDigest = normalizeDigest(input.fixtureRefDigest, 'fixtureRefDigest');
  const sourcePartitionDigest = normalizeDigest(
    input.sourcePartitionDigest,
    'sourcePartitionDigest',
  );
  const traceContextDigest = normalizeDigest(input.traceContextDigest, 'traceContextDigest');
  const sourceHistoryRefDigest = normalizeDigest(
    input.sourceHistoryRefDigest,
    'sourceHistoryRefDigest',
  );
  const workerRefDigest = normalizeDigest(input.workerRefDigest, 'workerRefDigest');
  const dispatcherRunDigest = normalizeDigest(input.dispatcherRunDigest, 'dispatcherRunDigest');
  const observerRefDigest = normalizeDigest(input.observerRefDigest, 'observerRefDigest');
  const evaluatorRefDigest = normalizeDigest(input.evaluatorRefDigest, 'evaluatorRefDigest');
  const scopeDigest = normalizeDigest(input.scopeDigest, 'scopeDigest');
  const requestedAt = normalizeTimestamp(input.requestedAt, 'requestedAt');
  const claimedAt = normalizeTimestamp(input.claimedAt, 'claimedAt');
  const generatedAt = normalizeTimestamp(input.generatedAt, 'generatedAt');
  const observedAt = normalizeTimestamp(input.observedAt, 'observedAt');
  const outcomeObservedAt = normalizeTimestamp(input.outcomeObservedAt, 'outcomeObservedAt');
  const feedbackGeneratedAt = normalizeTimestamp(
    input.feedbackGeneratedAt,
    'feedbackGeneratedAt',
  );
  const evaluatedAt = normalizeTimestamp(input.evaluatedAt, 'evaluatedAt');
  const sourceHistorySequence = normalizeSequence(input.sourceHistorySequence);

  const activationProfile = createShadowActivationProfileContract({
    sourceEventDigest: input.event.digest,
    tenantRefDigest: input.event.tenantRefDigest,
    sourcePartitionDigest,
    traceContextDigest,
  });
  const workItem = createShadowOutboxWorkItemContract({
    activationProfile,
    sourceHistoryRefDigest,
    requestedAt,
    sourceHistorySequence,
  });
  const dispatchClaim = createShadowDispatchClaimContract({
    workItem,
    workerRefDigest,
    claimedAt,
    dispatcherRunDigest,
  });
  const activation = runShadowRuntimeActivation({
    claim: dispatchClaim,
    event: input.event,
    generatedAt,
  });
  const observability = runShadowRuntimeObservabilityHooks({
    activation,
    observedAt,
    observerRefDigest,
    scopeDigest,
  });
  const feedbackEvents = input.outcomeFeedbackEvents?.length
    ? Object.freeze([...input.outcomeFeedbackEvents])
    : defaultFeedbackEvents({ fixtureId, fixtureRefDigest, outcomeObservedAt });
  const feedback = createOutcomeIncidentFeedbackContract({
    assurancePacket: activation.pipeline.assurancePacket,
    feedbackEvents,
    generatedAt: feedbackGeneratedAt,
  });
  const outcomeFeedback = runShadowRuntimeOutcomeFeedbackHook({
    observability,
    feedback,
    evaluatedAt,
    evaluatorRefDigest,
    builderRefDigest: evaluatorRefDigest,
  });
  const phaseDigests = Object.freeze([
    activationProfile.digest,
    workItem.digest,
    dispatchClaim.digest,
    activation.digest,
    observability.digest,
    feedback.digest,
    outcomeFeedback.digest,
  ]);
  const reasonCodes = Object.freeze([
    'fixture-replay-smoke:r02-r07-complete',
    `activation:${activation.activationStatus}`,
    `pipeline:${activation.pipeline.fusion.posture}`,
    `observability:${observability.hookStatus}`,
    `feedback:${feedback.status}`,
    `outcome-feedback:${outcomeFeedback.outcome}`,
    'authority:fixture-smoke-no-admit',
  ]);
  const material = {
    version: SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION,
    canonicalShadowEventSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    shadowActivationProfileContractVersion: SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
    shadowOutboxWorkItemContractVersion: SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
    shadowDispatchClaimContractVersion: SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION,
    shadowRuntimeActivationRunnerVersion: SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    shadowRuntimeObservabilityHooksVersion: SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
    outcomeIncidentFeedbackContractVersion: OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
    shadowRuntimeOutcomeFeedbackHookVersion: SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION,
    smokeStatus: 'fixture-replay-smoke-complete' as const,
    executionMode: 'shadow-only' as const,
    fixtureId,
    fixtureRefDigest,
    sourceEventDigest: input.event.digest,
    tenantRefDigest: input.event.tenantRefDigest,
    activationProfileDigest: activationProfile.digest,
    workItemDigest: workItem.digest,
    dispatchClaimDigest: dispatchClaim.digest,
    activationDigest: activation.digest,
    pipelineDigest: activation.pipelineDigest,
    envelopeRefDigest: activation.envelopeRefDigest,
    observabilityDigest: observability.digest,
    feedbackDigest: feedback.digest,
    outcomeFeedbackHookDigest: outcomeFeedback.digest,
    finalAssuranceCaseDigest: outcomeFeedback.feedbackBoundAssuranceCaseDigest,
    finalLineageGraphDigest: outcomeFeedback.lineageGraphDigest,
    outcome: outcomeFeedback.outcome,
    feedbackStatus: feedback.status,
    phaseDigests,
    activationProfile,
    workItem,
    dispatchClaim,
    activation,
    observability,
    feedback,
    outcomeFeedback,
    reasonCodes,
    fixtureOnly: true as const,
    deterministicReplay: true as const,
    noTargetSystemCall: true as const,
    noAuditWrite: true as const,
    noExternalEventBus: true as const,
    noExternalTraceExport: true as const,
    noExternalLineageExport: true as const,
    noPolicyActivation: true as const,
    noLearningActivation: true as const,
    noTrainingActivation: true as const,
    grantsAuthority: false as const,
    canAdmit: false as const,
    activatesEnforcement: false as const,
    autoEnforce: false as const,
    rawPayloadRead: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
  } satisfies Omit<ShadowRuntimeFixtureReplaySmokeResult, 'canonical' | 'digest'>;
  const { canonical, digest } = canonicalObject(
    material as unknown as CanonicalReleaseJsonValue,
  );
  return Object.freeze({
    ...material,
    canonical,
    digest,
  });
}

export function shadowRuntimeFixtureReplaySmokeDescriptor():
ShadowRuntimeFixtureReplaySmokeDescriptor {
  return Object.freeze({
    version: SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION,
    canonicalShadowEventSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    shadowActivationProfileContractVersion: SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
    shadowOutboxWorkItemContractVersion: SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
    shadowDispatchClaimContractVersion: SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION,
    shadowRuntimeActivationRunnerVersion: SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
    shadowRuntimeObservabilityHooksVersion: SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
    shadowRuntimeOutcomeFeedbackHookVersion: SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION,
    sourceAnchors: SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_SOURCE_ANCHORS,
    fixtureOnly: true,
    deterministicReplay: true,
    runsR02ThroughR07: true,
    noTargetSystemCall: true,
    noAuditWrite: true,
    noExternalEventBus: true,
    noExternalTraceExport: true,
    noExternalLineageExport: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    noTrainingActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-production-worker',
      'not-target-system-call',
      'not-audit-plane-write',
      'not-external-event-bus-delivery',
      'not-external-trace-export',
      'not-external-lineage-export',
      'not-policy-activation',
      'not-learning-activation',
      'not-training-activation',
      'not-live-enforcement',
      'not-production-readiness',
    ]),
  });
}
