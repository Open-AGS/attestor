import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  authAbuseGuardPolicy,
  checkAuthAttemptAllowed,
  recordAuthAttemptFailure,
  recordAuthAttemptSuccess,
  recordAuthAttemptUse,
  resetAuthAbuseGuardForTests,
  resolveAuthAttemptSource,
} from '../src/service/account/auth-abuse-guard.js';

let passed = 0;

function ok(condition: boolean, msg: string): void {
  assert(condition, msg);
  passed++;
}

function readAccountRouteSources(): string {
  const routeDir = join(process.cwd(), 'src', 'service', 'http', 'routes');
  return readdirSync(routeDir)
    .filter((file) => /^account.*\.ts$/u.test(file))
    .map((file) => readFileSync(join(routeDir, file), 'utf8'))
    .join('\n');
}

const envKeys = [
  'ATTESTOR_AUTH_RATE_LIMIT_WINDOW_SECONDS',
  'ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_EMAIL',
  'ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_SOURCE',
  'ATTESTOR_AUTH_RATE_LIMIT_LOCKOUT_SECONDS',
  'ATTESTOR_TRUST_PROXY_HEADERS',
  'ATTESTOR_TRUSTED_PROXY_HEADERS',
  'ATTESTOR_TRUSTED_PROXY_PEER_IPS',
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
      ok(checkAuthAttemptAllowed({ ...subject, nowMs: 24_000 }).allowed, 'successful login clears the matching email bucket');
    }

    resetCase();
    setPolicy({
      windowSeconds: 60,
      maxFailuresPerEmail: 10,
      maxFailuresPerSource: 2,
      lockoutSeconds: 30,
    });
    {
      const source = '198.51.100.27';
      recordAuthAttemptFailure({ email: 'first@example.com', source, nowMs: 23_000 });
      recordAuthAttemptSuccess({ email: 'valid@example.com', source, nowMs: 24_000 });
      recordAuthAttemptFailure({ email: 'second@example.com', source, nowMs: 25_000 });
      const locked = checkAuthAttemptAllowed({ email: 'third@example.com', source, nowMs: 26_000 });
      ok(!locked.allowed && locked.reason === 'source_locked', 'successful login does not clear source abuse budget');
    }

    resetCase();
    setPolicy({
      windowSeconds: 60,
      maxFailuresPerEmail: 2,
      maxFailuresPerSource: 50,
      lockoutSeconds: 30,
    });
    {
      const subject = { email: 'password-reset-issue:acct:user', source: '198.51.100.17', nowMs: 25_000 };
      recordAuthAttemptUse(subject);
      ok(checkAuthAttemptAllowed({ ...subject, nowMs: 26_000 }).allowed, 'sensitive action use remains allowed below threshold');
      recordAuthAttemptUse({ ...subject, nowMs: 27_000 });
      ok(
        !checkAuthAttemptAllowed({ ...subject, nowMs: 28_000 }).allowed,
        'sensitive action use locks after the configured threshold',
      );
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
      ok(
        resolveAuthAttemptSource(headers, { directRemoteAddress: '198.51.100.10' }) === '198.51.100.10',
        'source resolver ignores forwarded headers unless proxy trust is explicit',
      );
      ok(resolveAuthAttemptSource(new Headers()) === 'unknown-source', 'source resolver has deterministic fallback');
    }

    resetCase();
    {
      process.env.ATTESTOR_TRUST_PROXY_HEADERS = 'true';
      process.env.ATTESTOR_TRUSTED_PROXY_PEER_IPS = '10.0.0.1';
      const headers = new Headers({
        'x-forwarded-for': '192.0.2.10, 192.0.2.11',
      });
      ok(
        resolveAuthAttemptSource(headers, { directRemoteAddress: '10.0.0.1' }) === '192.0.2.11',
        'source resolver accepts the selected forwarded header from a configured trusted proxy peer',
      );
      ok(
        resolveAuthAttemptSource(headers, { directRemoteAddress: '10.0.0.2' }) === '10.0.0.2',
        'source resolver falls back to the direct peer when the proxy peer is not trusted',
      );
    }

    {
      const routeSource = readAccountRouteSources();
      const routeHelperSource = readFileSync(
        join(process.cwd(), 'src', 'service', 'http', 'routes', 'account-route-helpers.ts'),
        'utf8',
      );
      ok(
        routeSource.includes("app.post('/api/v1/auth/signup'") &&
          routeSource.includes('const signupRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);'),
        'hosted signup route is wired through the auth abuse guard',
      );
      ok(
        routeSource.includes("app.post('/api/v1/auth/login'") &&
          routeSource.includes('const loginRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);'),
        'hosted login route remains wired through the auth abuse guard',
      );
      ok(
        routeSource.includes("app.post('/api/v1/auth/passkeys/options'") &&
          routeSource.includes('const passkeyOptionsRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);'),
        'hosted passkey-options route is wired through the auth abuse guard',
      );
      ok(
        routeSource.includes("app.post('/api/v1/auth/password/reset'") &&
          routeSource.includes('const authAttempt = authAttemptForPasswordReset(c, resetToken);') &&
          routeSource.includes('const resetRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);'),
        'hosted password-reset apply route is wired through the auth abuse guard',
      );
      ok(
        routeSource.includes("app.post('/api/v1/account/users/invites/accept'") &&
          routeSource.includes('const authAttempt = authAttemptForActionToken(c, AUTH_ATTEMPT_KIND.invite, inviteToken);') &&
          routeSource.includes('const inviteAcceptRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);') &&
          routeSource.includes('await recordAuthAttemptFailure(authAttempt);'),
        'hosted invite accept route is wired through action-token abuse throttling',
      );
      ok(
        routeSource.includes("app.post('/api/v1/account/users/:id/password-reset'") &&
          routeSource.includes("const targetUserId = c.req.param('id');") &&
          routeSource.includes('AUTH_ATTEMPT_KIND.passwordResetIssue') &&
          routeSource.includes('const resetIssueRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);') &&
          routeSource.includes('await recordAuthAttemptUse(authAttempt);'),
        'hosted password reset issue route throttles successful request flooding',
      );
      ok(
        routeHelperSource.includes('function authAttemptForCurrentPassword') &&
          (routeSource.match(/await maybeRateLimitCurrentPasswordAttempt\(c, access\)/g) ?? []).length >= 5 &&
          (routeSource.match(/await recordAuthAttemptFailure\(currentPasswordAttempt\.subject\)/g) ?? []).length >= 5,
        'hosted current-password sensitive routes share an auth abuse budget',
      );
      ok(
        routeSource.includes('async function recordPasskeyAuthenticationFailure') &&
          (routeSource.match(/await recordPasskeyAuthenticationFailure\(challengeRecord\)/g) ?? []).length >= 5,
        'hosted passkey verification failure paths consume the one-attempt challenge',
      );
    }

    console.log(`Account Auth Abuse Guard Tests: ${passed} passed, 0 failed`);
  } finally {
    resetAuthAbuseGuardForTests();
    restoreSavedEnv();
  }
}

run();
