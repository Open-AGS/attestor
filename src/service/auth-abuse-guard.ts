/**
 * Hosted auth abuse guard.
 *
 * Interactive auth throttling. Local/dev can use an in-process fallback;
 * HA runtimes fail closed unless a shared Redis limiter is configured.
 */
import { createHmac } from 'node:crypto';
import IORedis from 'ioredis';
import { envTruthy, isProductionLikeRuntimeEnv } from './deployment-safety.js';
import { deriveServiceKey } from './secret-derivation.js';
import { resolveTrustedClientAddress } from './trusted-proxy.js';

export interface AuthAttemptSubject {
  email: string;
  source: string | null;
  nowMs?: number;
}

export interface AuthAttemptSourceInput {
  directRemoteAddress?: string | null;
  env?: Readonly<Record<string, string | undefined>>;
}

export interface AuthAttemptDecision {
  allowed: boolean;
  reason: 'ok' | 'email_locked' | 'source_locked';
  retryAfterSeconds: number;
  resetAt: string;
}

interface AuthAttemptBucket {
  windowStartedAtMs: number;
  failedAttempts: number;
  lockedUntilMs: number | null;
}

interface AuthAbuseGuardPolicy {
  windowSeconds: number;
  maxFailuresPerEmail: number;
  maxFailuresPerSource: number;
  lockoutSeconds: number;
}

const emailBuckets = new Map<string, AuthAttemptBucket>();
const sourceBuckets = new Map<string, AuthAttemptBucket>();
const REDIS_KEY_PREFIX = 'attestor:auth-abuse';
const REDIS_BUCKET_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local windowMs = tonumber(ARGV[1])
local lockoutMs = tonumber(ARGV[2])
local maxFailures = tonumber(ARGV[3])
local nowMs = tonumber(ARGV[4])
local operation = ARGV[5]

local state
if raw then
  state = cjson.decode(raw)
else
  state = {windowStartedAtMs = nowMs, failedAttempts = 0, lockedUntilMs = 0}
end

if state.lockedUntilMs == nil then
  state.lockedUntilMs = 0
end

if nowMs >= tonumber(state.windowStartedAtMs) + windowMs then
  state = {windowStartedAtMs = nowMs, failedAttempts = 0, lockedUntilMs = 0}
elseif tonumber(state.lockedUntilMs) > 0 and nowMs >= tonumber(state.lockedUntilMs) then
  state = {windowStartedAtMs = nowMs, failedAttempts = 0, lockedUntilMs = 0}
end

if operation == 'failure' then
  state.failedAttempts = tonumber(state.failedAttempts) + 1
  if tonumber(state.failedAttempts) >= maxFailures and tonumber(state.lockedUntilMs) == 0 then
    state.lockedUntilMs = nowMs + lockoutMs
  end
end

local resetMs = tonumber(state.lockedUntilMs)
if resetMs == 0 then
  resetMs = tonumber(state.windowStartedAtMs) + windowMs
end

local ttlMs = math.max(1, resetMs - nowMs)
redis.call('PSETEX', KEYS[1], ttlMs, cjson.encode(state))
local locked = 0
if tonumber(state.lockedUntilMs) > 0 and nowMs < tonumber(state.lockedUntilMs) then
  locked = 1
end
return {locked, tonumber(state.failedAttempts), tonumber(resetMs), tonumber(state.windowStartedAtMs)}
`;

let configuredRedisUrl: string | null = null;
let configuredRedisMode: string | null = null;
let configuredBackend: 'memory' | 'redis' = 'memory';
let redisClient: IORedis | null = null;
let redisConnectPromise: Promise<IORedis | null> | null = null;
let lastRedisConnectionError: string | null = null;

function positiveIntFromEnv(key: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function authAbuseGuardPolicy(): AuthAbuseGuardPolicy {
  return {
    windowSeconds: positiveIntFromEnv('ATTESTOR_AUTH_RATE_LIMIT_WINDOW_SECONDS', 300),
    maxFailuresPerEmail: positiveIntFromEnv('ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_EMAIL', 5),
    maxFailuresPerSource: positiveIntFromEnv('ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_SOURCE', 20),
    lockoutSeconds: positiveIntFromEnv('ATTESTOR_AUTH_RATE_LIMIT_LOCKOUT_SECONDS', 300),
  };
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : 'missing-email';
}

function normalizeSource(source: string | null): string {
  const normalized = source?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized.slice(0, 160) : 'unknown-source';
}

function redisKeyHmacKey(): Buffer {
  const dedicated = process.env.ATTESTOR_AUTH_RATE_LIMIT_HASH_KEY?.trim();
  if (dedicated) return deriveServiceKey(dedicated, 'auth-abuse.redis-key');
  if (isProductionLikeRuntimeEnv() || requiresSharedAuthAbuseGuard()) {
    throw new Error('ATTESTOR_AUTH_RATE_LIMIT_HASH_KEY must be set before using shared production-like auth abuse buckets.');
  }
  const localFallback = process.env.ATTESTOR_ADMIN_API_KEY?.trim();
  return deriveServiceKey(localFallback || 'attestor-local-auth-abuse-redis-key', 'auth-abuse.redis-key');
}

function redisKey(scope: 'email' | 'source', normalized: string): string {
  const digest = createHmac('sha256', redisKeyHmacKey())
    .update(scope)
    .update('\0')
    .update(normalized)
    .digest('hex');
  return `${REDIS_KEY_PREFIX}:${scope}:${digest}`;
}

function nowMs(input?: number): number {
  return Number.isFinite(input) && input !== undefined ? input : Date.now();
}

function currentBucket(
  buckets: Map<string, AuthAttemptBucket>,
  key: string,
  currentNowMs: number,
  policy: AuthAbuseGuardPolicy,
): AuthAttemptBucket {
  const existing = buckets.get(key);
  const windowMs = policy.windowSeconds * 1000;
  if (!existing || currentNowMs >= existing.windowStartedAtMs + windowMs) {
    const fresh = {
      windowStartedAtMs: currentNowMs,
      failedAttempts: 0,
      lockedUntilMs: null,
    };
    buckets.set(key, fresh);
    return fresh;
  }
  if (existing.lockedUntilMs !== null && currentNowMs >= existing.lockedUntilMs) {
    existing.failedAttempts = 0;
    existing.lockedUntilMs = null;
    existing.windowStartedAtMs = currentNowMs;
  }
  return existing;
}

function bucketResetAt(bucket: AuthAttemptBucket, policy: AuthAbuseGuardPolicy): string {
  const resetMs = bucket.lockedUntilMs ?? (bucket.windowStartedAtMs + (policy.windowSeconds * 1000));
  return new Date(resetMs).toISOString();
}

function lockedDecision(
  reason: AuthAttemptDecision['reason'],
  retryAfterSeconds: number,
  resetAt: string,
): AuthAttemptDecision {
  return {
    allowed: false,
    reason,
    retryAfterSeconds,
    resetAt,
  };
}

function requiresSharedAuthAbuseGuard(): boolean {
  return envTruthy(process.env.ATTESTOR_AUTH_RATE_LIMIT_REQUIRE_SHARED)
    || envTruthy(process.env.ATTESTOR_HA_MODE);
}

function configuredAuthAbuseRedisUrl(): string | null {
  const explicit = process.env.ATTESTOR_AUTH_RATE_LIMIT_REDIS_URL?.trim();
  if (explicit) return explicit;
  return configuredRedisUrl ?? process.env.REDIS_URL?.trim() ?? null;
}

async function connectRedisClient(): Promise<IORedis | null> {
  const redisUrl = configuredAuthAbuseRedisUrl();
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
  if (!client && requiresSharedAuthAbuseGuard()) {
    throw new Error(
      `Auth abuse guard requires shared Redis but could not connect: ${lastRedisConnectionError ?? 'redis URL not configured'}`,
    );
  }
  return client;
}

async function readRedisBucket(
  client: IORedis,
  scope: 'email' | 'source',
  normalized: string,
  maxFailures: number,
  currentNowMs: number,
  policy: AuthAbuseGuardPolicy,
  operation: 'check' | 'failure',
): Promise<AuthAttemptBucket> {
  const result = await client.eval(
    REDIS_BUCKET_SCRIPT,
    1,
    redisKey(scope, normalized),
    String(policy.windowSeconds * 1000),
    String(policy.lockoutSeconds * 1000),
    String(maxFailures),
    String(currentNowMs),
    operation,
  ) as [number, number, number, number] | null;

  const locked = Array.isArray(result) && Number(result[0]) === 1;
  const failedAttempts = Array.isArray(result) ? Number(result[1]) : 0;
  const resetMs = Array.isArray(result) ? Number(result[2]) : currentNowMs + (policy.windowSeconds * 1000);
  const windowStartedAtMs = Array.isArray(result) ? Number(result[3]) : currentNowMs;
  return {
    windowStartedAtMs,
    failedAttempts,
    lockedUntilMs: locked ? resetMs : null,
  };
}

export function configureAuthAbuseGuard(options?: {
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

export function getAuthAbuseGuardStatus(): {
  backend: 'memory' | 'redis';
  configuredRedisMode: string | null;
  shared: boolean;
  requiresShared: boolean;
} {
  return {
    backend: configuredBackend,
    configuredRedisMode,
    shared: configuredBackend === 'redis',
    requiresShared: requiresSharedAuthAbuseGuard(),
  };
}

export function resolveAuthAttemptSource(
  headers: Headers,
  input: AuthAttemptSourceInput = {},
): string {
  return resolveTrustedClientAddress({
    headers,
    directRemoteAddress: input.directRemoteAddress ?? null,
    env: input.env,
  }).address ?? 'unknown-source';
}

export function checkAuthAttemptAllowed(input: AuthAttemptSubject): AuthAttemptDecision {
  const policy = authAbuseGuardPolicy();
  const currentNowMs = nowMs(input.nowMs);
  const emailBucket = currentBucket(emailBuckets, normalizeEmail(input.email), currentNowMs, policy);
  const sourceBucket = currentBucket(sourceBuckets, normalizeSource(input.source), currentNowMs, policy);

  if (emailBucket.lockedUntilMs !== null && currentNowMs < emailBucket.lockedUntilMs) {
    return lockedDecision(
      'email_locked',
      Math.max(1, Math.ceil((emailBucket.lockedUntilMs - currentNowMs) / 1000)),
      bucketResetAt(emailBucket, policy),
    );
  }

  if (sourceBucket.lockedUntilMs !== null && currentNowMs < sourceBucket.lockedUntilMs) {
    return lockedDecision(
      'source_locked',
      Math.max(1, Math.ceil((sourceBucket.lockedUntilMs - currentNowMs) / 1000)),
      bucketResetAt(sourceBucket, policy),
    );
  }

  return {
    allowed: true,
    reason: 'ok',
    retryAfterSeconds: 0,
    resetAt: bucketResetAt(emailBucket, policy),
  };
}

export async function checkAuthAttemptAllowedShared(input: AuthAttemptSubject): Promise<AuthAttemptDecision> {
  const client = await redisClientOrFailClosed();
  if (!client) return checkAuthAttemptAllowed(input);

  const policy = authAbuseGuardPolicy();
  const currentNowMs = nowMs(input.nowMs);
  const emailBucket = await readRedisBucket(
    client,
    'email',
    normalizeEmail(input.email),
    policy.maxFailuresPerEmail,
    currentNowMs,
    policy,
    'check',
  );
  const sourceBucket = await readRedisBucket(
    client,
    'source',
    normalizeSource(input.source),
    policy.maxFailuresPerSource,
    currentNowMs,
    policy,
    'check',
  );

  if (emailBucket.lockedUntilMs !== null && currentNowMs < emailBucket.lockedUntilMs) {
    return lockedDecision(
      'email_locked',
      Math.max(1, Math.ceil((emailBucket.lockedUntilMs - currentNowMs) / 1000)),
      bucketResetAt(emailBucket, policy),
    );
  }

  if (sourceBucket.lockedUntilMs !== null && currentNowMs < sourceBucket.lockedUntilMs) {
    return lockedDecision(
      'source_locked',
      Math.max(1, Math.ceil((sourceBucket.lockedUntilMs - currentNowMs) / 1000)),
      bucketResetAt(sourceBucket, policy),
    );
  }

  return {
    allowed: true,
    reason: 'ok',
    retryAfterSeconds: 0,
    resetAt: bucketResetAt(emailBucket, policy),
  };
}

export function recordAuthAttemptFailure(input: AuthAttemptSubject): AuthAttemptDecision {
  const policy = authAbuseGuardPolicy();
  const currentNowMs = nowMs(input.nowMs);
  const emailBucket = currentBucket(emailBuckets, normalizeEmail(input.email), currentNowMs, policy);
  const sourceBucket = currentBucket(sourceBuckets, normalizeSource(input.source), currentNowMs, policy);

  emailBucket.failedAttempts += 1;
  sourceBucket.failedAttempts += 1;

  if (emailBucket.failedAttempts >= policy.maxFailuresPerEmail && emailBucket.lockedUntilMs === null) {
    emailBucket.lockedUntilMs = currentNowMs + (policy.lockoutSeconds * 1000);
  }
  if (sourceBucket.failedAttempts >= policy.maxFailuresPerSource && sourceBucket.lockedUntilMs === null) {
    sourceBucket.lockedUntilMs = currentNowMs + (policy.lockoutSeconds * 1000);
  }

  return checkAuthAttemptAllowed(input);
}

export async function recordAuthAttemptFailureShared(input: AuthAttemptSubject): Promise<AuthAttemptDecision> {
  const client = await redisClientOrFailClosed();
  if (!client) return recordAuthAttemptFailure(input);

  const policy = authAbuseGuardPolicy();
  const currentNowMs = nowMs(input.nowMs);
  await readRedisBucket(
    client,
    'email',
    normalizeEmail(input.email),
    policy.maxFailuresPerEmail,
    currentNowMs,
    policy,
    'failure',
  );
  await readRedisBucket(
    client,
    'source',
    normalizeSource(input.source),
    policy.maxFailuresPerSource,
    currentNowMs,
    policy,
    'failure',
  );
  return checkAuthAttemptAllowedShared(input);
}

export function recordAuthAttemptUse(input: AuthAttemptSubject): AuthAttemptDecision {
  return recordAuthAttemptFailure(input);
}

export async function recordAuthAttemptUseShared(input: AuthAttemptSubject): Promise<AuthAttemptDecision> {
  return recordAuthAttemptFailureShared(input);
}

export function recordAuthAttemptSuccess(input: AuthAttemptSubject): void {
  emailBuckets.delete(normalizeEmail(input.email));
}

export async function recordAuthAttemptSuccessShared(input: AuthAttemptSubject): Promise<void> {
  const client = await redisClientOrFailClosed();
  if (!client) {
    recordAuthAttemptSuccess(input);
    return;
  }
  await client.del(redisKey('email', normalizeEmail(input.email)));
}

export function resetAuthAbuseGuardForTests(): void {
  emailBuckets.clear();
  sourceBuckets.clear();
}

export async function shutdownAuthAbuseGuard(): Promise<void> {
  if (redisClient) {
    try { redisClient.disconnect(); } catch {}
    redisClient = null;
  }
  redisConnectPromise = null;
}

export async function resetSharedAuthAbuseGuardForTests(): Promise<void> {
  emailBuckets.clear();
  sourceBuckets.clear();
  const client = await connectRedisClient();
  if (client) {
    const keys = await client.keys(`${REDIS_KEY_PREFIX}:*`);
    if (keys.length > 0) await client.del(...keys);
  }
  await shutdownAuthAbuseGuard();
  configuredRedisUrl = null;
  configuredRedisMode = null;
  configuredBackend = 'memory';
  lastRedisConnectionError = null;
}
