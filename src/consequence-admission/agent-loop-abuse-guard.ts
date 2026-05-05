import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { GenericAdmissionEnvelope } from './index.js';

export const CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION =
  'attestor.consequence-admission-agent-loop-abuse-guard.v1';

export const CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_OUTCOMES = [
  'allow',
  'throttle',
  'hold',
] as const;
export type ConsequenceAdmissionAgentLoopAbuseGuardOutcome =
  typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_OUTCOMES[number];

export const CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_REASON_CODES = [
  'agent-loop-not-retry',
  'agent-loop-retry-recorded',
  'agent-loop-window-exhausted',
  'agent-loop-attempt-budget-exhausted',
  'agent-loop-non-retryable-correction',
  'agent-loop-policy-probing-risk',
  'agent-loop-guard-record-capacity-exhausted',
] as const;
export type ConsequenceAdmissionAgentLoopAbuseGuardReasonCode =
  typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_REASON_CODES[number];

export const CONSEQUENCE_ADMISSION_AGENT_LOOP_NON_RETRYABLE_REASON_CODES = [
  'policy-blocked',
  'feature-blocked',
  'feature-unsafe',
  'custom-domain-review-required',
  'adapter-readiness-missing',
] as const;

export interface ConsequenceAdmissionAgentLoopAbuseGuardPolicy {
  readonly windowSeconds: number;
  readonly maxRetryAttemptsPerPreviousAdmission: number;
  readonly maxAdmissionsPerActorWindow: number;
  readonly maxDistinctCorrectionSignaturesPerPreviousAdmission: number;
  readonly maxRecords: number;
}

export interface ConsequenceAdmissionAgentLoopAbuseGuardRecord {
  readonly version: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION;
  readonly guardId: string;
  readonly recordId: string;
  readonly recordedAt: string;
  readonly tenantId: string | null;
  readonly actor: string;
  readonly action: string;
  readonly downstreamSystem: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly previousAdmissionId: string | null;
  readonly retryAttemptId: string | null;
  readonly attemptNumber: number | null;
  readonly correctionSignatureDigest: string | null;
  readonly decision: string;
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly rawPayloadStored: false;
  readonly recordDigest: string;
}

export interface ConsequenceAdmissionAgentLoopAbuseGuardDecision {
  readonly version: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION;
  readonly outcome: ConsequenceAdmissionAgentLoopAbuseGuardOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly guardId: string;
  readonly retryAfterSeconds: number;
  readonly resetAt: string;
  readonly record: ConsequenceAdmissionAgentLoopAbuseGuardRecord | null;
  readonly reasonCodes: readonly ConsequenceAdmissionAgentLoopAbuseGuardReasonCode[];
  readonly reason: string;
  readonly safeInstruction: string;
  readonly rawPayloadStored: false;
  readonly decisionDigest: string;
}

export interface ConsequenceAdmissionAgentLoopAbuseGuardSnapshot {
  readonly version: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION;
  readonly guardId: string;
  readonly recordCount: number;
  readonly records: readonly ConsequenceAdmissionAgentLoopAbuseGuardRecord[];
}

export interface ConsequenceAdmissionAgentLoopAbuseGuardSummary {
  readonly version: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION;
  readonly guardId: string;
  readonly recordCount: number;
  readonly retryRecordCount: number;
  readonly rawPayloadStored: false;
  readonly inMemoryReferenceImplementation: true;
  readonly productionSharedStoreIncluded: false;
}

export interface ConsequenceAdmissionAgentLoopAbuseGuardDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION;
  readonly outcomes: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_OUTCOMES;
  readonly reasonCodes: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_REASON_CODES;
  readonly nonRetryableReasonCodes:
    typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_NON_RETRYABLE_REASON_CODES;
  readonly storesRawPayloadsExternally: false;
  readonly inMemoryReferenceImplementation: true;
  readonly productionSharedStoreIncluded: false;
  readonly failClosed: true;
}

export interface EvaluateConsequenceAdmissionAgentLoopAbuseInput {
  readonly tenantId?: string | null;
  readonly envelope: GenericAdmissionEnvelope;
  readonly receivedAt?: string | null;
}

export interface ConsequenceAdmissionAgentLoopAbuseGuard {
  readonly version: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION;
  readonly guardId: string;
  readonly evaluate: (
    input: EvaluateConsequenceAdmissionAgentLoopAbuseInput,
  ) => ConsequenceAdmissionAgentLoopAbuseGuardDecision;
  readonly snapshot: () => ConsequenceAdmissionAgentLoopAbuseGuardSnapshot;
  readonly summary: () => ConsequenceAdmissionAgentLoopAbuseGuardSummary;
}

export interface CreateConsequenceAdmissionAgentLoopAbuseGuardInput {
  readonly guardId?: string | null;
  readonly policy?: Partial<ConsequenceAdmissionAgentLoopAbuseGuardPolicy> | null;
  readonly now?: (() => string) | null;
}

interface WindowBucket {
  windowStartedAtMs: number;
  count: number;
  correctionSignatures: Set<string>;
}

const DEFAULT_POLICY: ConsequenceAdmissionAgentLoopAbuseGuardPolicy = Object.freeze({
  windowSeconds: 300,
  maxRetryAttemptsPerPreviousAdmission: 2,
  maxAdmissionsPerActorWindow: 120,
  maxDistinctCorrectionSignaturesPerPreviousAdmission: 2,
  maxRecords: 1000,
});

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission agent loop abuse guard ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      `Consequence admission agent loop abuse guard ${fieldName} requires a non-empty value.`,
    );
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

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
  fallback: number,
): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Consequence admission agent loop abuse guard ${fieldName} must be a positive integer.`,
    );
  }
  return value;
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(
      `Consequence admission agent loop abuse guard ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
}

function defaultNow(): string {
  return new Date().toISOString();
}

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function digestValue(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function policyWithDefaults(
  policy: Partial<ConsequenceAdmissionAgentLoopAbuseGuardPolicy> | null | undefined,
): ConsequenceAdmissionAgentLoopAbuseGuardPolicy {
  return Object.freeze({
    windowSeconds: normalizePositiveInteger(
      policy?.windowSeconds,
      'policy.windowSeconds',
      DEFAULT_POLICY.windowSeconds,
    ),
    maxRetryAttemptsPerPreviousAdmission: normalizePositiveInteger(
      policy?.maxRetryAttemptsPerPreviousAdmission,
      'policy.maxRetryAttemptsPerPreviousAdmission',
      DEFAULT_POLICY.maxRetryAttemptsPerPreviousAdmission,
    ),
    maxAdmissionsPerActorWindow: normalizePositiveInteger(
      policy?.maxAdmissionsPerActorWindow,
      'policy.maxAdmissionsPerActorWindow',
      DEFAULT_POLICY.maxAdmissionsPerActorWindow,
    ),
    maxDistinctCorrectionSignaturesPerPreviousAdmission: normalizePositiveInteger(
      policy?.maxDistinctCorrectionSignaturesPerPreviousAdmission,
      'policy.maxDistinctCorrectionSignaturesPerPreviousAdmission',
      DEFAULT_POLICY.maxDistinctCorrectionSignaturesPerPreviousAdmission,
    ),
    maxRecords: normalizePositiveInteger(
      policy?.maxRecords,
      'policy.maxRecords',
      DEFAULT_POLICY.maxRecords,
    ),
  });
}

function bucketResetAt(bucket: WindowBucket, policy: ConsequenceAdmissionAgentLoopAbuseGuardPolicy):
string {
  return new Date(bucket.windowStartedAtMs + policy.windowSeconds * 1000).toISOString();
}

function retryAfterSeconds(
  bucket: WindowBucket,
  policy: ConsequenceAdmissionAgentLoopAbuseGuardPolicy,
  currentMs: number,
): number {
  return Math.max(1, Math.ceil(
    (bucket.windowStartedAtMs + policy.windowSeconds * 1000 - currentMs) / 1000,
  ));
}

function actorScopeKey(input: {
  readonly tenantId: string | null;
  readonly actor: string;
  readonly action: string;
  readonly downstreamSystem: string;
}): string {
  return [
    'actor-window',
    input.tenantId ?? 'tenant:null',
    input.actor,
    input.action,
    input.downstreamSystem,
  ].join('|');
}

function retryScopeKey(input: {
  readonly tenantId: string | null;
  readonly previousAdmissionId: string;
}): string {
  return [
    'retry-window',
    input.tenantId ?? 'tenant:null',
    input.previousAdmissionId,
  ].join('|');
}

function correctionSignatureDigest(input: {
  readonly correctionReasonCodes: readonly string[];
  readonly correctionFields: readonly string[];
}): string {
  return digestValue({
    correctionReasonCodes: [...input.correctionReasonCodes].sort(),
    correctionFields: [...input.correctionFields].sort(),
  } as CanonicalReleaseJsonValue);
}

function currentBucket(
  buckets: Map<string, WindowBucket>,
  key: string,
  currentMs: number,
  policy: ConsequenceAdmissionAgentLoopAbuseGuardPolicy,
): WindowBucket {
  const existing = buckets.get(key);
  if (!existing || currentMs >= existing.windowStartedAtMs + policy.windowSeconds * 1000) {
    const fresh = {
      windowStartedAtMs: currentMs,
      count: 0,
      correctionSignatures: new Set<string>(),
    };
    buckets.set(key, fresh);
    return fresh;
  }
  return existing;
}

function containsNonRetryableCorrection(reasonCodes: readonly string[]): boolean {
  const nonRetryable = new Set<string>(CONSEQUENCE_ADMISSION_AGENT_LOOP_NON_RETRYABLE_REASON_CODES);
  return reasonCodes.some((reason) => nonRetryable.has(reason));
}

function sortedRecords(
  records: Iterable<ConsequenceAdmissionAgentLoopAbuseGuardRecord>,
): readonly ConsequenceAdmissionAgentLoopAbuseGuardRecord[] {
  return Object.freeze(
    [...records].sort((a, b) =>
      a.recordedAt.localeCompare(b.recordedAt) || a.recordId.localeCompare(b.recordId),
    ),
  );
}

function recordDigest(
  record: Omit<ConsequenceAdmissionAgentLoopAbuseGuardRecord, 'recordDigest'>,
): string {
  return digestValue(record as unknown as CanonicalReleaseJsonValue);
}

function decisionDigest(input: {
  readonly outcome: ConsequenceAdmissionAgentLoopAbuseGuardOutcome;
  readonly allowed: boolean;
  readonly guardId: string;
  readonly retryAfterSeconds: number;
  readonly resetAt: string;
  readonly recordDigest: string | null;
  readonly reasonCodes: readonly ConsequenceAdmissionAgentLoopAbuseGuardReasonCode[];
}): string {
  return digestValue({
    version: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
    outcome: input.outcome,
    allowed: input.allowed,
    guardId: input.guardId,
    retryAfterSeconds: input.retryAfterSeconds,
    resetAt: input.resetAt,
    recordDigest: input.recordDigest,
    reasonCodes: input.reasonCodes,
  } as CanonicalReleaseJsonValue);
}

function reasonFor(
  outcome: ConsequenceAdmissionAgentLoopAbuseGuardOutcome,
  reasonCodes: readonly ConsequenceAdmissionAgentLoopAbuseGuardReasonCode[],
): string {
  if (outcome === 'allow' && reasonCodes.includes('agent-loop-not-retry')) {
    return 'Agent loop abuse guard did not classify the admission as an automatic retry.';
  }
  if (outcome === 'allow') {
    return 'Agent loop abuse guard recorded a bounded retry attempt inside the configured window.';
  }
  if (reasonCodes.includes('agent-loop-policy-probing-risk')) {
    return 'Agent loop abuse guard held the retry because correction signatures varied too much for one held admission.';
  }
  if (reasonCodes.includes('agent-loop-non-retryable-correction')) {
    return 'Agent loop abuse guard held the retry because it used a non-model-retryable correction reason.';
  }
  if (reasonCodes.includes('agent-loop-attempt-budget-exhausted')) {
    return 'Agent loop abuse guard throttled the retry because the attempt number exceeds the configured retry budget.';
  }
  if (reasonCodes.includes('agent-loop-guard-record-capacity-exhausted')) {
    return 'Agent loop abuse guard held the retry because the reference guard reached its configured record capacity.';
  }
  return 'Agent loop abuse guard throttled the admission because the window budget is exhausted.';
}

function instructionFor(outcome: ConsequenceAdmissionAgentLoopAbuseGuardOutcome): string {
  if (outcome === 'allow') {
    return 'Continue only through the normal admission decision. This guard does not authorize downstream execution.';
  }
  return 'Stop automatic retry. Route the attempt to customer review or operator control.';
}

function decision(input: {
  readonly outcome: ConsequenceAdmissionAgentLoopAbuseGuardOutcome;
  readonly allowed: boolean;
  readonly guardId: string;
  readonly retryAfterSeconds: number;
  readonly resetAt: string;
  readonly record: ConsequenceAdmissionAgentLoopAbuseGuardRecord | null;
  readonly reasonCodes: readonly ConsequenceAdmissionAgentLoopAbuseGuardReasonCode[];
}): ConsequenceAdmissionAgentLoopAbuseGuardDecision {
  const reasonCodes = Object.freeze([...input.reasonCodes]);
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
    outcome: input.outcome,
    allowed: input.allowed,
    failClosed: !input.allowed,
    guardId: input.guardId,
    retryAfterSeconds: input.retryAfterSeconds,
    resetAt: input.resetAt,
    record: input.record,
    reasonCodes,
    reason: reasonFor(input.outcome, reasonCodes),
    safeInstruction: instructionFor(input.outcome),
    rawPayloadStored: false,
    decisionDigest: decisionDigest({
      outcome: input.outcome,
      allowed: input.allowed,
      guardId: input.guardId,
      retryAfterSeconds: input.retryAfterSeconds,
      resetAt: input.resetAt,
      recordDigest: input.record?.recordDigest ?? null,
      reasonCodes,
    }),
  });
}

export function createConsequenceAdmissionAgentLoopAbuseGuard(
  input: CreateConsequenceAdmissionAgentLoopAbuseGuardInput = {},
): ConsequenceAdmissionAgentLoopAbuseGuard {
  const guardId = normalizeOptionalIdentifier(input.guardId, 'guardId') ??
    'consequence-admission-agent-loop-abuse-guard:memory';
  const policy = policyWithDefaults(input.policy);
  const now = input.now ?? defaultNow;
  const actorBuckets = new Map<string, WindowBucket>();
  const retryBuckets = new Map<string, WindowBucket>();
  const recordsById = new Map<string, ConsequenceAdmissionAgentLoopAbuseGuardRecord>();

  function snapshot(): ConsequenceAdmissionAgentLoopAbuseGuardSnapshot {
    const records = sortedRecords(recordsById.values());
    return Object.freeze({
      version: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
      guardId,
      recordCount: records.length,
      records,
    });
  }

  function summary(): ConsequenceAdmissionAgentLoopAbuseGuardSummary {
    const records = [...recordsById.values()];
    return Object.freeze({
      version: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
      guardId,
      recordCount: records.length,
      retryRecordCount: records.filter((record) => record.retryAttemptId !== null).length,
      rawPayloadStored: false,
      inMemoryReferenceImplementation: true,
      productionSharedStoreIncluded: false,
    });
  }

  function evaluate(
    evaluateInput: EvaluateConsequenceAdmissionAgentLoopAbuseInput,
  ): ConsequenceAdmissionAgentLoopAbuseGuardDecision {
    const envelope = evaluateInput.envelope;
    const admission = envelope.admission;
    const request = admission.request;
    const receivedAt = normalizeIsoTimestamp(evaluateInput.receivedAt ?? now(), 'receivedAt');
    const receivedAtMs = new Date(receivedAt).getTime();
    const tenantId = normalizeOptionalIdentifier(
      evaluateInput.tenantId ?? request.policyScope.tenantId,
      'tenantId',
    );
    const actorKey = actorScopeKey({
      tenantId,
      actor: request.proposedConsequence.actor,
      action: request.proposedConsequence.action,
      downstreamSystem: request.proposedConsequence.downstreamSystem,
    });
    const actorBucket = currentBucket(actorBuckets, actorKey, receivedAtMs, policy);
    if (actorBucket.count >= policy.maxAdmissionsPerActorWindow) {
      return decision({
        outcome: 'throttle',
        allowed: false,
        guardId,
        retryAfterSeconds: retryAfterSeconds(actorBucket, policy, receivedAtMs),
        resetAt: bucketResetAt(actorBucket, policy),
        record: null,
        reasonCodes: ['agent-loop-window-exhausted'],
      });
    }

    const retryAttempt = request.retryAttempt;
    if (retryAttempt === null) {
      actorBucket.count += 1;
      return decision({
        outcome: 'allow',
        allowed: true,
        guardId,
        retryAfterSeconds: 0,
        resetAt: bucketResetAt(actorBucket, policy),
        record: null,
        reasonCodes: ['agent-loop-not-retry'],
      });
    }

    const retryKey = retryScopeKey({
      tenantId,
      previousAdmissionId: retryAttempt.previousAdmissionId,
    });
    const retryBucket = currentBucket(retryBuckets, retryKey, receivedAtMs, policy);
    const resetAt = bucketResetAt(retryBucket, policy);

    if (retryAttempt.attemptNumber > policy.maxRetryAttemptsPerPreviousAdmission) {
      return decision({
        outcome: 'throttle',
        allowed: false,
        guardId,
        retryAfterSeconds: retryAfterSeconds(retryBucket, policy, receivedAtMs),
        resetAt,
        record: null,
        reasonCodes: ['agent-loop-attempt-budget-exhausted'],
      });
    }

    if (retryBucket.count >= policy.maxRetryAttemptsPerPreviousAdmission) {
      return decision({
        outcome: 'throttle',
        allowed: false,
        guardId,
        retryAfterSeconds: retryAfterSeconds(retryBucket, policy, receivedAtMs),
        resetAt,
        record: null,
        reasonCodes: ['agent-loop-window-exhausted'],
      });
    }

    if (containsNonRetryableCorrection(retryAttempt.correctionReasonCodes)) {
      return decision({
        outcome: 'hold',
        allowed: false,
        guardId,
        retryAfterSeconds: retryAfterSeconds(retryBucket, policy, receivedAtMs),
        resetAt,
        record: null,
        reasonCodes: ['agent-loop-non-retryable-correction'],
      });
    }

    const correctionSignature = correctionSignatureDigest({
      correctionReasonCodes: retryAttempt.correctionReasonCodes,
      correctionFields: retryAttempt.correctionFields,
    });
    if (
      !retryBucket.correctionSignatures.has(correctionSignature) &&
      retryBucket.correctionSignatures.size >=
        policy.maxDistinctCorrectionSignaturesPerPreviousAdmission
    ) {
      return decision({
        outcome: 'hold',
        allowed: false,
        guardId,
        retryAfterSeconds: retryAfterSeconds(retryBucket, policy, receivedAtMs),
        resetAt,
        record: null,
        reasonCodes: ['agent-loop-policy-probing-risk'],
      });
    }

    if (recordsById.size >= policy.maxRecords) {
      return decision({
        outcome: 'hold',
        allowed: false,
        guardId,
        retryAfterSeconds: retryAfterSeconds(retryBucket, policy, receivedAtMs),
        resetAt,
        record: null,
        reasonCodes: ['agent-loop-guard-record-capacity-exhausted'],
      });
    }

    actorBucket.count += 1;
    retryBucket.count += 1;
    retryBucket.correctionSignatures.add(correctionSignature);

    const recordId = `agent-loop-abuse-guard:${digestValue({
      version: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
      guardId,
      admissionId: admission.admissionId,
      admissionDigest: admission.digest,
      retryAttemptId: retryAttempt.attemptId,
      receivedAt,
    } as CanonicalReleaseJsonValue)}`;
    const recordBase = Object.freeze({
      version: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
      guardId,
      recordId,
      recordedAt: receivedAt,
      tenantId,
      actor: request.proposedConsequence.actor,
      action: request.proposedConsequence.action,
      downstreamSystem: request.proposedConsequence.downstreamSystem,
      admissionId: admission.admissionId,
      admissionDigest: admission.digest,
      previousAdmissionId: retryAttempt.previousAdmissionId,
      retryAttemptId: retryAttempt.attemptId,
      attemptNumber: retryAttempt.attemptNumber,
      correctionSignatureDigest: correctionSignature,
      decision: admission.decision,
      allowed: admission.allowed,
      reasonCodes: Object.freeze([...admission.reasonCodes]),
      rawPayloadStored: false,
    } satisfies Omit<ConsequenceAdmissionAgentLoopAbuseGuardRecord, 'recordDigest'>);
    const record = Object.freeze({
      ...recordBase,
      recordDigest: recordDigest(recordBase),
    });
    recordsById.set(record.recordId, record);

    return decision({
      outcome: 'allow',
      allowed: true,
      guardId,
      retryAfterSeconds: 0,
      resetAt,
      record,
      reasonCodes: ['agent-loop-retry-recorded'],
    });
  }

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
    guardId,
    evaluate,
    snapshot,
    summary,
  });
}

export function consequenceAdmissionAgentLoopAbuseGuardDescriptor():
ConsequenceAdmissionAgentLoopAbuseGuardDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
    outcomes: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_OUTCOMES,
    reasonCodes: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_REASON_CODES,
    nonRetryableReasonCodes: CONSEQUENCE_ADMISSION_AGENT_LOOP_NON_RETRYABLE_REASON_CODES,
    storesRawPayloadsExternally: false,
    inMemoryReferenceImplementation: true,
    productionSharedStoreIncluded: false,
    failClosed: true,
  });
}
