/**
 * Shared service wrapper for the consequence-admission agent-loop guard.
 *
 * Local/dev can use the in-memory reference guard. HA and production-shared
 * runtimes fail closed unless a shared Redis guard is configured.
 */
import { createHmac, createHash } from 'node:crypto';
import IORedis from 'ioredis';
import {
  CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
  CONSEQUENCE_ADMISSION_AGENT_LOOP_NON_RETRYABLE_REASON_CODES,
  createConsequenceAdmissionAgentLoopAbuseGuard,
  type ConsequenceAdmissionAgentLoopAbuseGuard,
  type ConsequenceAdmissionAgentLoopAbuseGuardDecision,
  type ConsequenceAdmissionAgentLoopAbuseGuardOutcome,
  type ConsequenceAdmissionAgentLoopAbuseGuardPolicy,
  type ConsequenceAdmissionAgentLoopAbuseGuardReasonCode,
  type ConsequenceAdmissionAgentLoopAbuseGuardRecord,
  type EvaluateConsequenceAdmissionAgentLoopAbuseInput,
} from '../consequence-admission/index.js';
import { envTruthy } from './deployment-safety.js';
import { deriveServiceKey } from './secret-derivation.js';

type CanonicalServiceJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalServiceJsonValue[]
  | { readonly [key: string]: CanonicalServiceJsonValue };

const REDIS_KEY_PREFIX = 'attestor:agent-loop-abuse';
const DEFAULT_POLICY: ConsequenceAdmissionAgentLoopAbuseGuardPolicy = Object.freeze({
  windowSeconds: 300,
  maxRetryAttemptsPerPreviousAdmission: 2,
  maxAdmissionsPerActorWindow: 120,
  maxDistinctCorrectionSignaturesPerPreviousAdmission: 2,
  maxRecords: 1000,
});

const REDIS_GUARD_SCRIPT = `
local actorCount = tonumber(redis.call('GET', KEYS[1]) or '0')
local actorLimit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local operation = ARGV[3]
local retryAttemptNumber = tonumber(ARGV[4])
local retryLimit = tonumber(ARGV[5])
local maxSignatures = tonumber(ARGV[6])
local maxRecords = tonumber(ARGV[7])
local correctionSignature = ARGV[8]
local recordId = ARGV[9]
local nonRetryable = ARGV[10]
local nowMs = tonumber(ARGV[11])

if actorCount >= actorLimit then
  return {1, actorCount, 0, 0, 0}
end

if operation == 'admission' then
  local actorNext = redis.call('INCR', KEYS[1])
  if actorNext == 1 then
    redis.call('PEXPIRE', KEYS[1], windowMs)
  end
  return {0, actorNext, 0, 0, 0}
end

if retryAttemptNumber > retryLimit then
  return {2, actorCount, 0, 0, 0}
end

local retryCount = tonumber(redis.call('GET', KEYS[2]) or '0')
if retryCount >= retryLimit then
  return {3, actorCount, retryCount, 0, 0}
end

if nonRetryable == '1' then
  return {4, actorCount, retryCount, 0, 0}
end

local signatureExists = redis.call('SISMEMBER', KEYS[3], correctionSignature)
local signatureCount = tonumber(redis.call('SCARD', KEYS[3]) or '0')
if signatureExists == 0 and signatureCount >= maxSignatures then
  return {5, actorCount, retryCount, signatureCount, 0}
end

redis.call('ZREMRANGEBYSCORE', KEYS[4], 0, nowMs - windowMs)
local recordCount = tonumber(redis.call('ZCARD', KEYS[4]) or '0')
if recordCount >= maxRecords then
  return {6, actorCount, retryCount, signatureCount, recordCount}
end

local actorNext = redis.call('INCR', KEYS[1])
if actorNext == 1 then
  redis.call('PEXPIRE', KEYS[1], windowMs)
end
local retryNext = redis.call('INCR', KEYS[2])
if retryNext == 1 then
  redis.call('PEXPIRE', KEYS[2], windowMs)
end
redis.call('SADD', KEYS[3], correctionSignature)
redis.call('PEXPIRE', KEYS[3], windowMs)
redis.call('ZADD', KEYS[4], nowMs, recordId)
redis.call('PEXPIRE', KEYS[4], windowMs)
return {0, actorNext, retryNext, signatureCount + 1, recordCount + 1}
`;

let configuredRedisUrl: string | null = null;
let configuredRedisMode: string | null = null;
let configuredBackend: 'memory' | 'redis' = 'memory';
let redisClient: IORedis | null = null;
let redisConnectPromise: Promise<IORedis | null> | null = null;
let lastRedisConnectionError: string | null = null;

export interface ServiceAgentLoopAbuseGuard {
  readonly version: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION;
  readonly guardId: string;
  readonly evaluate: (
    input: EvaluateConsequenceAdmissionAgentLoopAbuseInput,
  ) => Promise<ConsequenceAdmissionAgentLoopAbuseGuardDecision>;
}

function policyWithDefaults(
  policy: Partial<ConsequenceAdmissionAgentLoopAbuseGuardPolicy> | null | undefined,
): ConsequenceAdmissionAgentLoopAbuseGuardPolicy {
  return Object.freeze({
    windowSeconds: policy?.windowSeconds ?? DEFAULT_POLICY.windowSeconds,
    maxRetryAttemptsPerPreviousAdmission:
      policy?.maxRetryAttemptsPerPreviousAdmission ??
      DEFAULT_POLICY.maxRetryAttemptsPerPreviousAdmission,
    maxAdmissionsPerActorWindow:
      policy?.maxAdmissionsPerActorWindow ?? DEFAULT_POLICY.maxAdmissionsPerActorWindow,
    maxDistinctCorrectionSignaturesPerPreviousAdmission:
      policy?.maxDistinctCorrectionSignaturesPerPreviousAdmission ??
      DEFAULT_POLICY.maxDistinctCorrectionSignaturesPerPreviousAdmission,
    maxRecords: policy?.maxRecords ?? DEFAULT_POLICY.maxRecords,
  });
}

function defaultNow(): string {
  return new Date().toISOString();
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Agent loop shared guard ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Agent loop shared guard ${fieldName} requires a non-empty value.`);
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

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Agent loop shared guard ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function canonicalizeServiceJson(value: CanonicalServiceJsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Agent loop shared guard cannot canonicalize non-finite numbers.');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeServiceJson(item)).join(',')}]`;
  }
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalizeServiceJson(entryValue)}`)
    .join(',')}}`;
}

function digestValue(value: CanonicalServiceJsonValue): string {
  return `sha256:${createHash('sha256').update(canonicalizeServiceJson(value)).digest('hex')}`;
}

function keyHmacKey(): Buffer {
  const dedicated = process.env.ATTESTOR_AGENT_LOOP_GUARD_HASH_KEY?.trim();
  if (dedicated) return deriveServiceKey(dedicated, 'agent-loop-guard.redis-key');
  if (requiresSharedAgentLoopAbuseGuard()) {
    throw new Error(
      'ATTESTOR_AGENT_LOOP_GUARD_HASH_KEY must be set before using shared production-like agent-loop guard buckets.',
    );
  }
  const localFallback = process.env.ATTESTOR_ADMIN_API_KEY?.trim();
  return deriveServiceKey(localFallback || 'attestor-local-agent-loop-guard-key', 'agent-loop-guard.redis-key');
}

function digestKey(scope: string, value: string): string {
  return createHmac('sha256', keyHmacKey())
    .update(scope)
    .update('\0')
    .update(value)
    .digest('hex');
}

function windowStartMs(currentMs: number, windowSeconds: number): number {
  const windowMs = windowSeconds * 1000;
  return Math.floor(currentMs / windowMs) * windowMs;
}

function resetAtFor(currentMs: number, policy: ConsequenceAdmissionAgentLoopAbuseGuardPolicy): string {
  return new Date(windowStartMs(currentMs, policy.windowSeconds) + policy.windowSeconds * 1000).toISOString();
}

function retryAfterSecondsFor(
  currentMs: number,
  policy: ConsequenceAdmissionAgentLoopAbuseGuardPolicy,
): number {
  return Math.max(1, Math.ceil(
    (windowStartMs(currentMs, policy.windowSeconds) + policy.windowSeconds * 1000 - currentMs) / 1000,
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
  return ['retry-window', input.tenantId ?? 'tenant:null', input.previousAdmissionId].join('|');
}

function correctionSignatureDigest(input: {
  readonly correctionReasonCodes: readonly string[];
  readonly correctionFields: readonly string[];
}): string {
  return digestValue({
    correctionReasonCodes: [...input.correctionReasonCodes].sort(),
    correctionFields: [...input.correctionFields].sort(),
  });
}

function containsNonRetryableCorrection(reasonCodes: readonly string[]): boolean {
  const nonRetryable = new Set<string>(CONSEQUENCE_ADMISSION_AGENT_LOOP_NON_RETRYABLE_REASON_CODES);
  return reasonCodes.some((reason) => nonRetryable.has(reason));
}

function reasonFor(
  outcome: ConsequenceAdmissionAgentLoopAbuseGuardOutcome,
  reasonCodes: readonly ConsequenceAdmissionAgentLoopAbuseGuardReasonCode[],
): string {
  if (outcome === 'allow' && reasonCodes.includes('agent-loop-not-retry')) {
    return 'Agent loop abuse guard did not classify the admission as an automatic retry.';
  }
  if (outcome === 'allow') {
    return 'Agent loop abuse guard recorded a bounded retry attempt inside the shared configured window.';
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
    return 'Agent loop abuse guard held the retry because the shared guard reached its configured record capacity.';
  }
  return 'Agent loop abuse guard throttled the admission because the shared window budget is exhausted.';
}

function instructionFor(outcome: ConsequenceAdmissionAgentLoopAbuseGuardOutcome): string {
  if (outcome === 'allow') {
    return 'Continue only through the normal admission decision. This guard does not authorize downstream execution.';
  }
  return 'Stop automatic retry. Route the attempt to customer review or operator control.';
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
  });
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

function recordDigest(
  record: Omit<ConsequenceAdmissionAgentLoopAbuseGuardRecord, 'recordDigest'>,
): string {
  return digestValue(record as unknown as CanonicalServiceJsonValue);
}

function requiresSharedAgentLoopAbuseGuard(): boolean {
  return envTruthy(process.env.ATTESTOR_AGENT_LOOP_GUARD_REQUIRE_SHARED)
    || envTruthy(process.env.ATTESTOR_HA_MODE)
    || process.env.ATTESTOR_RUNTIME_PROFILE?.trim() === 'production-shared';
}

function configuredAgentLoopRedisUrl(): string | null {
  const explicit = process.env.ATTESTOR_AGENT_LOOP_GUARD_REDIS_URL?.trim();
  if (explicit) return explicit;
  return configuredRedisUrl ?? process.env.REDIS_URL?.trim() ?? null;
}

async function connectRedisClient(): Promise<IORedis | null> {
  const redisUrl = configuredAgentLoopRedisUrl();
  if (!redisUrl) return null;
  if (redisClient) return redisClient;
  if (redisConnectPromise) return redisConnectPromise;

  redisConnectPromise = (async () => {
    let nextClient: IORedis | null = null;
    try {
      nextClient = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 1500,
        retryStrategy: () => null,
        enableOfflineQueue: false,
      });
      nextClient.on('error', () => {});
      await nextClient.connect();
      await nextClient.ping();
      redisClient = nextClient;
      configuredBackend = 'redis';
      lastRedisConnectionError = null;
      return nextClient;
    } catch (error) {
      try { nextClient?.disconnect(); } catch {}
      redisClient = null;
      configuredBackend = 'memory';
      lastRedisConnectionError = error instanceof Error ? error.message : String(error);
      return null;
    } finally {
      redisConnectPromise = null;
    }
  })();

  return redisConnectPromise;
}

async function redisClientOrFailClosed(): Promise<IORedis | null> {
  const client = await connectRedisClient();
  if (!client && requiresSharedAgentLoopAbuseGuard()) {
    throw new Error(
      `Agent loop abuse guard requires shared Redis but could not connect: ${lastRedisConnectionError ?? 'redis URL not configured'}`,
    );
  }
  return client;
}

export function configureAgentLoopAbuseGuard(options?: {
  redisUrl?: string | null;
  redisMode?: string | null;
}): void {
  const nextRedisUrl = options?.redisUrl?.trim() || null;
  const nextRedisMode = options?.redisMode?.trim() || null;
  const changed = nextRedisUrl !== configuredRedisUrl || nextRedisMode !== configuredRedisMode;
  configuredRedisUrl = nextRedisUrl;
  configuredRedisMode = nextRedisMode;
  configuredBackend = nextRedisUrl ? 'redis' : 'memory';
  if (changed && redisClient) {
    try { redisClient.disconnect(); } catch {}
    redisClient = null;
  }
}

export function getAgentLoopAbuseGuardStatus(): {
  readonly backend: 'memory' | 'redis';
  readonly configuredRedisMode: string | null;
  readonly shared: boolean;
  readonly requiresShared: boolean;
} {
  return {
    backend: configuredBackend,
    configuredRedisMode,
    shared: configuredBackend === 'redis',
    requiresShared: requiresSharedAgentLoopAbuseGuard(),
  };
}

export function agentLoopAbuseGuardStorageMode(): 'in-memory-reference' | 'shared-durable' {
  return getAgentLoopAbuseGuardStatus().shared ? 'shared-durable' : 'in-memory-reference';
}

async function evaluateRedisGuard(input: {
  readonly client: IORedis;
  readonly guardId: string;
  readonly policy: ConsequenceAdmissionAgentLoopAbuseGuardPolicy;
  readonly evaluateInput: EvaluateConsequenceAdmissionAgentLoopAbuseInput;
  readonly now: () => string;
}): Promise<ConsequenceAdmissionAgentLoopAbuseGuardDecision> {
  const envelope = input.evaluateInput.envelope;
  const admission = envelope.admission;
  const request = admission.request;
  const receivedAt = normalizeIsoTimestamp(
    input.evaluateInput.receivedAt ?? input.now(),
    'receivedAt',
  );
  const receivedAtMs = new Date(receivedAt).getTime();
  const tenantId = normalizeOptionalIdentifier(
    input.evaluateInput.tenantId ?? request.policyScope.tenantId,
    'tenantId',
  );
  const actorKeyRaw = actorScopeKey({
    tenantId,
    actor: request.proposedConsequence.actor,
    action: request.proposedConsequence.action,
    downstreamSystem: request.proposedConsequence.downstreamSystem,
  });
  const actorDigest = digestKey('actor', actorKeyRaw);
  const windowStart = windowStartMs(receivedAtMs, input.policy.windowSeconds);
  const actorKey = `${REDIS_KEY_PREFIX}:actor:${actorDigest}:${windowStart}`;
  const recordSetKey = `${REDIS_KEY_PREFIX}:records:${digestKey('guard', input.guardId)}`;
  const retryAttempt = request.retryAttempt;
  const resetAt = resetAtFor(receivedAtMs, input.policy);
  const retryAfterSeconds = retryAfterSecondsFor(receivedAtMs, input.policy);
  const correctionSignature = retryAttempt
    ? correctionSignatureDigest({
      correctionReasonCodes: retryAttempt.correctionReasonCodes,
      correctionFields: retryAttempt.correctionFields,
    })
    : 'none';
  const recordId = retryAttempt
    ? `agent-loop-abuse-guard:${digestValue({
      version: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
      guardId: input.guardId,
      admissionId: admission.admissionId,
      admissionDigest: admission.digest,
      retryAttemptId: retryAttempt.attemptId,
      receivedAt,
    })}`
    : 'none';
  const retryKeyRaw = retryAttempt
    ? retryScopeKey({ tenantId, previousAdmissionId: retryAttempt.previousAdmissionId })
    : 'none';
  const retryDigest = digestKey('retry', retryKeyRaw);
  const retryKey = `${REDIS_KEY_PREFIX}:retry:${retryDigest}:${windowStart}`;
  const signatureKey = `${REDIS_KEY_PREFIX}:retry-signatures:${retryDigest}:${windowStart}`;
  const operation = retryAttempt === null ? 'admission' : 'retry';

  const scriptResult = await input.client.eval(
    REDIS_GUARD_SCRIPT,
    4,
    actorKey,
    retryKey,
    signatureKey,
    recordSetKey,
    String(input.policy.maxAdmissionsPerActorWindow),
    String(input.policy.windowSeconds * 1000),
    operation,
    String(retryAttempt?.attemptNumber ?? 0),
    String(input.policy.maxRetryAttemptsPerPreviousAdmission),
    String(input.policy.maxDistinctCorrectionSignaturesPerPreviousAdmission),
    String(input.policy.maxRecords),
    correctionSignature,
    recordId,
    retryAttempt && containsNonRetryableCorrection(retryAttempt.correctionReasonCodes) ? '1' : '0',
    String(receivedAtMs),
  ) as [number, number, number, number, number] | null;

  const code = Array.isArray(scriptResult) ? Number(scriptResult[0]) : 6;
  if (code === 1) {
    return decision({
      outcome: 'throttle',
      allowed: false,
      guardId: input.guardId,
      retryAfterSeconds,
      resetAt,
      record: null,
      reasonCodes: ['agent-loop-window-exhausted'],
    });
  }
  if (code === 2) {
    return decision({
      outcome: 'throttle',
      allowed: false,
      guardId: input.guardId,
      retryAfterSeconds,
      resetAt,
      record: null,
      reasonCodes: ['agent-loop-attempt-budget-exhausted'],
    });
  }
  if (code === 3) {
    return decision({
      outcome: 'throttle',
      allowed: false,
      guardId: input.guardId,
      retryAfterSeconds,
      resetAt,
      record: null,
      reasonCodes: ['agent-loop-window-exhausted'],
    });
  }
  if (code === 4) {
    return decision({
      outcome: 'hold',
      allowed: false,
      guardId: input.guardId,
      retryAfterSeconds,
      resetAt,
      record: null,
      reasonCodes: ['agent-loop-non-retryable-correction'],
    });
  }
  if (code === 5) {
    return decision({
      outcome: 'hold',
      allowed: false,
      guardId: input.guardId,
      retryAfterSeconds,
      resetAt,
      record: null,
      reasonCodes: ['agent-loop-policy-probing-risk'],
    });
  }
  if (code === 6) {
    return decision({
      outcome: 'hold',
      allowed: false,
      guardId: input.guardId,
      retryAfterSeconds,
      resetAt,
      record: null,
      reasonCodes: ['agent-loop-guard-record-capacity-exhausted'],
    });
  }

  if (retryAttempt === null) {
    return decision({
      outcome: 'allow',
      allowed: true,
      guardId: input.guardId,
      retryAfterSeconds: 0,
      resetAt,
      record: null,
      reasonCodes: ['agent-loop-not-retry'],
    });
  }

  const recordBase = Object.freeze({
    version: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
    guardId: input.guardId,
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

  return decision({
    outcome: 'allow',
    allowed: true,
    guardId: input.guardId,
    retryAfterSeconds: 0,
    resetAt,
    record,
    reasonCodes: ['agent-loop-retry-recorded'],
  });
}

export function createServiceAgentLoopAbuseGuard(input: {
  readonly guardId?: string | null;
  readonly policy?: Partial<ConsequenceAdmissionAgentLoopAbuseGuardPolicy> | null;
  readonly now?: (() => string) | null;
} = {}): ServiceAgentLoopAbuseGuard {
  const memoryGuard: ConsequenceAdmissionAgentLoopAbuseGuard =
    createConsequenceAdmissionAgentLoopAbuseGuard(input);
  const guardId = memoryGuard.guardId;
  const policy = policyWithDefaults(input.policy);
  const now = input.now ?? defaultNow;

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
    guardId,
    evaluate: async (evaluateInput: EvaluateConsequenceAdmissionAgentLoopAbuseInput) => {
      const client = await redisClientOrFailClosed();
      if (!client) return memoryGuard.evaluate(evaluateInput);
      return evaluateRedisGuard({
        client,
        guardId,
        policy,
        evaluateInput,
        now,
      });
    },
  });
}

export async function shutdownAgentLoopAbuseGuard(): Promise<void> {
  if (redisClient) {
    try { redisClient.disconnect(); } catch {}
    redisClient = null;
  }
  redisConnectPromise = null;
}

export async function resetSharedAgentLoopAbuseGuardForTests(): Promise<void> {
  const client = await connectRedisClient();
  if (client) {
    const keys = await client.keys(`${REDIS_KEY_PREFIX}:*`);
    if (keys.length > 0) await client.del(...keys);
  }
  await shutdownAgentLoopAbuseGuard();
  configuredRedisUrl = null;
  configuredRedisMode = null;
  configuredBackend = 'memory';
  lastRedisConnectionError = null;
}
