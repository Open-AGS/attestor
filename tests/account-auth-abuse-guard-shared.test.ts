import assert from 'node:assert/strict';
import {
  checkAuthAttemptAllowedShared,
  configureAuthAbuseGuard,
  getAuthAbuseGuardStatus,
  recordAuthAttemptFailureShared,
  recordAuthAttemptSuccessShared,
  resetSharedAuthAbuseGuardForTests,
} from '../src/service/account/auth-abuse-guard.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

const envKeys = [
  'ATTESTOR_AUTH_RATE_LIMIT_WINDOW_SECONDS',
  'ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_EMAIL',
  'ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_SOURCE',
  'ATTESTOR_AUTH_RATE_LIMIT_LOCKOUT_SECONDS',
  'ATTESTOR_AUTH_RATE_LIMIT_HASH_KEY',
  'ATTESTOR_AUTH_RATE_LIMIT_REDIS_URL',
  'ATTESTOR_AUTH_RATE_LIMIT_REQUIRE_SHARED',
  'ATTESTOR_HA_MODE',
  'REDIS_URL',
] as const;

const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  typeof envKeys[number],
  string | undefined
>;

function restoreEnv(): void {
  for (const key of envKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearEnv(): void {
  for (const key of envKeys) delete process.env[key];
}

async function startRedis(): Promise<{ url: string; stop(): Promise<void> }> {
  const redisModule = await import('redis-memory-server');
  const RedisMemoryServer = redisModule.RedisMemoryServer ?? (redisModule as any).default?.RedisMemoryServer;
  const server = new RedisMemoryServer();
  const host = await server.getHost();
  const port = await server.getPort();
  return {
    url: `redis://${host}:${port}`,
    stop: async () => {
      await server.stop();
    },
  };
}

async function main(): Promise<void> {
  let redis: { url: string; stop(): Promise<void> } | null = null;

  try {
    clearEnv();
    process.env.ATTESTOR_HA_MODE = 'true';
    await assert.rejects(
      () => checkAuthAttemptAllowedShared({ email: 'ha@example.test', source: '198.51.100.1' }),
      /requires shared Redis/u,
      'Shared auth abuse guard: HA mode fails closed when Redis is unavailable',
    );

    await resetSharedAuthAbuseGuardForTests();
    clearEnv();
    redis = await startRedis();
    process.env.ATTESTOR_HA_MODE = 'true';
    configureAuthAbuseGuard({ redisUrl: redis.url, redisMode: 'test' });
    await assert.rejects(
      () => checkAuthAttemptAllowedShared({ email: 'missing-key@example.test', source: '203.0.113.9' }),
      /ATTESTOR_AUTH_RATE_LIMIT_HASH_KEY/u,
      'Shared auth abuse guard: HA Redis buckets require a dedicated hash key',
    );

    await resetSharedAuthAbuseGuardForTests();
    clearEnv();
    process.env.ATTESTOR_AUTH_RATE_LIMIT_HASH_KEY = 'shared-auth-abuse-test-key';
    process.env.ATTESTOR_AUTH_RATE_LIMIT_WINDOW_SECONDS = '60';
    process.env.ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_EMAIL = '10';
    process.env.ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_SOURCE = '2';
    process.env.ATTESTOR_AUTH_RATE_LIMIT_LOCKOUT_SECONDS = '30';
    configureAuthAbuseGuard({ redisUrl: redis.url, redisMode: 'test' });

    ok(getAuthAbuseGuardStatus().backend === 'redis', 'Shared auth abuse guard: Redis backend is configured');
    await recordAuthAttemptFailureShared({ email: 'one@example.test', source: '203.0.113.10', nowMs: 10_000 });
    await recordAuthAttemptSuccessShared({ email: 'valid@example.test', source: '203.0.113.10', nowMs: 10_500 });
    await recordAuthAttemptFailureShared({ email: 'two@example.test', source: '203.0.113.10', nowMs: 11_000 });
    const locked = await checkAuthAttemptAllowedShared({
      email: 'three@example.test',
      source: '203.0.113.10',
      nowMs: 12_000,
    });
    ok(!locked.allowed && locked.reason === 'source_locked', 'Shared auth abuse guard: source budget survives success across Redis');

    console.log(`Account auth shared abuse guard tests: ${passed} passed, 0 failed`);
  } finally {
    await resetSharedAuthAbuseGuardForTests();
    await redis?.stop();
    restoreEnv();
  }
}

main().catch((error) => {
  console.error('\nAccount auth shared abuse guard tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
