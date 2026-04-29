import { strict as assert } from 'node:assert';
import {
  authAbuseGuardPolicy,
  checkAuthAttemptAllowed,
  recordAuthAttemptFailure,
  recordAuthAttemptSuccess,
  resetAuthAbuseGuardForTests,
  resolveAuthAttemptSource,
} from '../src/service/auth-abuse-guard.js';

let passed = 0;

function ok(condition: boolean, msg: string): void {
  assert(condition, msg);
  passed++;
}

const envKeys = [
  'ATTESTOR_AUTH_RATE_LIMIT_WINDOW_SECONDS',
  'ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_EMAIL',
  'ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_SOURCE',
  'ATTESTOR_AUTH_RATE_LIMIT_LOCKOUT_SECONDS',
] as const;

const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  typeof envKeys[number],
  string | undefined
>;

function restoreSavedEnv(): void {
  for (const key of envKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function resetCase(): void {
  restoreSavedEnv();
  for (const key of envKeys) delete process.env[key];
  resetAuthAbuseGuardForTests();
}

function setPolicy(input: {
  windowSeconds?: number;
  maxFailuresPerEmail?: number;
  maxFailuresPerSource?: number;
  lockoutSeconds?: number;
}): void {
  if (input.windowSeconds !== undefined) {
    process.env.ATTESTOR_AUTH_RATE_LIMIT_WINDOW_SECONDS = String(input.windowSeconds);
  }
  if (input.maxFailuresPerEmail !== undefined) {
    process.env.ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_EMAIL = String(input.maxFailuresPerEmail);
  }
  if (input.maxFailuresPerSource !== undefined) {
    process.env.ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_SOURCE = String(input.maxFailuresPerSource);
  }
  if (input.lockoutSeconds !== undefined) {
    process.env.ATTESTOR_AUTH_RATE_LIMIT_LOCKOUT_SECONDS = String(input.lockoutSeconds);
  }
}

function run() {
  console.log('\nAccount Auth Abuse Guard Tests');

  try {
    resetCase();
    {
      const policy = authAbuseGuardPolicy();
      ok(policy.windowSeconds === 300, 'default auth abuse window is five minutes');
      ok(policy.maxFailuresPerEmail === 5, 'default email failure limit is five attempts');
      ok(policy.maxFailuresPerSource === 20, 'default source failure limit is twenty attempts');
      ok(policy.lockoutSeconds === 300, 'default lockout is five minutes');
    }

    resetCase();
    setPolicy({
      windowSeconds: 60,
      maxFailuresPerEmail: 3,
      maxFailuresPerSource: 50,
      lockoutSeconds: 120,
    });
    {
      const subject = { email: 'Alice@Example.com ', source: '198.51.100.1', nowMs: 1_000 };
      ok(checkAuthAttemptAllowed(subject).allowed, 'fresh email attempt is allowed');
      recordAuthAttemptFailure(subject);
      ok(checkAuthAttemptAllowed({ ...subject, nowMs: 2_000 }).allowed, 'email remains allowed below threshold');
      recordAuthAttemptFailure({ ...subject, nowMs: 3_000 });
      ok(checkAuthAttemptAllowed({ ...subject, nowMs: 4_000 }).allowed, 'email remains allowed until threshold');
      recordAuthAttemptFailure({ ...subject, nowMs: 5_000 });
      const locked = checkAuthAttemptAllowed({ ...subject, nowMs: 6_000 });
      ok(!locked.allowed, 'email is locked after configured failure threshold');
      ok(locked.reason === 'email_locked', 'email lock reports email_locked reason');
      ok(locked.retryAfterSeconds > 0, 'email lock reports retry-after seconds');
    }

    resetCase();
    setPolicy({
      windowSeconds: 60,
      maxFailuresPerEmail: 10,
      maxFailuresPerSource: 2,
      lockoutSeconds: 90,
    });
    {
      recordAuthAttemptFailure({ email: 'one@example.com', source: '203.0.113.9', nowMs: 10_000 });
      recordAuthAttemptFailure({ email: 'two@example.com', source: '203.0.113.9', nowMs: 11_000 });
      const locked = checkAuthAttemptAllowed({ email: 'three@example.com', source: '203.0.113.9', nowMs: 12_000 });
      ok(!locked.allowed, 'source bucket locks across different emails');
      ok(locked.reason === 'source_locked', 'source lock reports source_locked reason');
    }

    resetCase();
    setPolicy({
      windowSeconds: 60,
      maxFailuresPerEmail: 2,
      maxFailuresPerSource: 50,
      lockoutSeconds: 30,
    });
    {
      const subject = { email: 'reset@example.com', source: '198.51.100.7', nowMs: 20_000 };
      recordAuthAttemptFailure(subject);
      recordAuthAttemptFailure({ ...subject, nowMs: 21_000 });
      ok(!checkAuthAttemptAllowed({ ...subject, nowMs: 22_000 }).allowed, 'subject locks before reset');
      recordAuthAttemptSuccess({ ...subject, nowMs: 23_000 });
      ok(checkAuthAttemptAllowed({ ...subject, nowMs: 24_000 }).allowed, 'successful login clears failure buckets');
    }

    resetCase();
    setPolicy({
      windowSeconds: 60,
      maxFailuresPerEmail: 2,
      maxFailuresPerSource: 50,
      lockoutSeconds: 30,
    });
    {
      const subject = { email: 'expire@example.com', source: '198.51.100.8', nowMs: 30_000 };
      recordAuthAttemptFailure(subject);
      recordAuthAttemptFailure({ ...subject, nowMs: 31_000 });
      ok(!checkAuthAttemptAllowed({ ...subject, nowMs: 32_000 }).allowed, 'lockout is active before expiry');
      ok(checkAuthAttemptAllowed({ ...subject, nowMs: 62_000 }).allowed, 'lockout expires after configured duration');
    }

    resetCase();
    {
      const headers = new Headers({
        'x-forwarded-for': '192.0.2.10, 192.0.2.11',
        'x-real-ip': '192.0.2.12',
      });
      ok(resolveAuthAttemptSource(headers) === '192.0.2.10', 'source resolver uses first forwarded-for hop');
      ok(resolveAuthAttemptSource(new Headers()) === 'unknown-source', 'source resolver has deterministic fallback');
    }

    console.log(`Account Auth Abuse Guard Tests: ${passed} passed, 0 failed`);
  } finally {
    resetAuthAbuseGuardForTests();
    restoreSavedEnv();
  }
}

run();
