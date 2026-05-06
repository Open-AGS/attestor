/**
 * Hosted auth abuse guard.
 *
 * First slice for interactive login throttling. This is intentionally small and
 * in-process: production deployments should still place a shared edge/WAF or
 * Redis-backed limiter in front of public auth routes. The important invariant
 * here is that hosted password login is no longer unlimited by default.
 */
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

export function recordAuthAttemptUse(input: AuthAttemptSubject): AuthAttemptDecision {
  return recordAuthAttemptFailure(input);
}

export function recordAuthAttemptSuccess(input: AuthAttemptSubject): void {
  emailBuckets.delete(normalizeEmail(input.email));
}

export function resetAuthAbuseGuardForTests(): void {
  emailBuckets.clear();
  sourceBuckets.clear();
}
