import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { RedisMemoryServer } from 'redis-memory-server';
import {
  rehearseProductionAsyncRecovery,
  type ProductionAsyncRecoverySummary,
} from '../scripts/rehearse/rehearse-production-async-recovery.ts';

let passed = 0;

type Env = Record<string, string | undefined>;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(resolve(process.cwd(), ...segments), 'utf8');
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readProjectFile(...segments)) as T;
}

function baseEnv(redisUrl: string): Env {
  return {
    ATTESTOR_RUNTIME_PROFILE: 'production-shared',
    REDIS_URL: redisUrl,
    ATTESTOR_PUBLIC_HOSTNAME: 'attestor.example.invalid',
  };
}

function passedSubstrateSummary() {
  return {
    profileId: 'gke-production-rehearsal',
    readiness: {
      passed: true,
      state: 'ready-for-rehearsal',
      issues: [],
    },
    target: {
      provider: 'gke',
      namespace: 'attestor',
      publicHostname: 'attestor.example.invalid',
    },
  };
}

function failedSubstrateSummary() {
  return {
    ...passedSubstrateSummary(),
    readiness: {
      passed: false,
      state: 'blocked-on-substrates',
      issues: ['queue-redis: Redis readiness failed'],
    },
  };
}

function passedConsequenceSummary() {
  return {
    profileId: 'gke-production-rehearsal',
    readiness: {
      passed: true,
      state: 'passed-core-consequence-rehearsal',
      issues: [],
    },
  };
}

function failedConsequenceSummary() {
  return {
    ...passedConsequenceSummary(),
    readiness: {
      passed: false,
      state: 'failed-core-consequence-rehearsal',
      issues: ['core-consequence-rehearsal: token introspection unavailable'],
    },
  };
}

async function withRedis<T>(run: (redisUrl: string) => Promise<T>): Promise<T> {
  const redis = new RedisMemoryServer();
  const host = await redis.getHost();
  const port = await redis.getPort();
  try {
    return await run(`redis://${host}:${port}`);
  } finally {
    try { await redis.stop(); } catch {}
  }
}

async function runWithTemp(options: Parameters<typeof rehearseProductionAsyncRecovery>[0]): Promise<ProductionAsyncRecoverySummary> {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-async-recovery-'));
  try {
    return await rehearseProductionAsyncRecovery({
      substrateSummary: passedSubstrateSummary(),
      consequenceSummary: passedConsequenceSummary(),
      outputDir,
      ...options,
    });
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function testAsyncRecoveryPassesAndWritesArtifacts(): Promise<void> {
  await withRedis(async (redisUrl) => {
    const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-async-recovery-output-'));
    try {
      const summary = await rehearseProductionAsyncRecovery({
        env: baseEnv(redisUrl),
        substrateSummary: passedSubstrateSummary(),
        consequenceSummary: passedConsequenceSummary(),
        outputDir,
      });

      equal(summary.readiness.passed, true, 'Production async recovery: full rehearsal passes');
      equal(summary.readiness.state, 'passed-async-recovery-rehearsal', 'Production async recovery: pass state is explicit');
      ok(summary.checks.every((check) => check.status === 'pass'), 'Production async recovery: every check passes');
      equal(summary.behavior?.redis.maxmemoryPolicy, 'noeviction', 'Production async recovery: Redis noeviction posture is recorded');
      equal(summary.behavior?.drainRestart.drainedStatus, 'completed', 'Production async recovery: drained job completed');
      equal(summary.behavior?.drainRestart.restartedStatus, 'completed', 'Production async recovery: restarted worker completed a job');
      equal(summary.behavior?.retry.attemptsObserved, 2, 'Production async recovery: retry path observes two attempts');
      equal(summary.behavior?.retry.finalStatus, 'completed', 'Production async recovery: retry path completes');
      equal(summary.behavior?.deadLetter.finalStatus, 'failed', 'Production async recovery: terminal failure is failed');
      ok((summary.behavior?.deadLetter.failedJobsVisible ?? 0) >= 1, 'Production async recovery: failed job is visible through BullMQ');
      ok((summary.behavior?.deadLetter.persistedRecordsVisible ?? 0) >= 1, 'Production async recovery: failed job is visible through persistent DLQ');
      equal(summary.behavior?.failQuick.rejected, true, 'Production async recovery: unavailable Redis submission rejects');
      ok((summary.behavior?.failQuick.elapsedMs ?? 9999) < 2000, 'Production async recovery: unavailable Redis submission rejects quickly');
      ok(existsSync(resolve(outputDir, 'summary.json')), 'Production async recovery: summary artifact is written');
      ok(existsSync(resolve(outputDir, 'README.md')), 'Production async recovery: README artifact is written');
      includes(readFileSync(resolve(outputDir, 'README.md'), 'utf8'), 'passed-async-recovery-rehearsal', 'Production async recovery: README records pass state');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
}

async function testMissingRedisUrlBlocksBeforeCoreBehavior(): Promise<void> {
  const summary = await runWithTemp({
    env: baseEnv(''),
  });

  equal(summary.readiness.passed, false, 'Production async recovery: missing REDIS_URL blocks readiness');
  equal(summary.readiness.state, 'blocked-on-target-prerequisites', 'Production async recovery: missing REDIS_URL blocks before behavior');
  ok(summary.readiness.issues.some((issue) => issue.includes('REDIS_URL')), 'Production async recovery: missing REDIS_URL is surfaced');
  equal(summary.behavior, null, 'Production async recovery: behavior is not exercised when REDIS_URL is missing');
  ok(summary.checks.some((check) => check.id === 'async-recovery-rehearsal' && check.status === 'skip'), 'Production async recovery: core behavior is explicitly skipped');
}

async function testFailedSubstrateSummaryBlocksBeforeCoreBehavior(): Promise<void> {
  await withRedis(async (redisUrl) => {
    const summary = await runWithTemp({
      env: baseEnv(redisUrl),
      substrateSummary: failedSubstrateSummary(),
    });

    equal(summary.readiness.passed, false, 'Production async recovery: failed substrate summary blocks readiness');
    ok(summary.readiness.issues.some((issue) => issue.includes('blocked-on-substrates')), 'Production async recovery: failed substrate state is surfaced');
    equal(summary.behavior, null, 'Production async recovery: behavior is not exercised when substrate readiness failed');
  });
}

async function testFailedConsequenceSummaryBlocksBeforeCoreBehavior(): Promise<void> {
  await withRedis(async (redisUrl) => {
    const summary = await runWithTemp({
      env: baseEnv(redisUrl),
      consequenceSummary: failedConsequenceSummary(),
    });

    equal(summary.readiness.passed, false, 'Production async recovery: failed consequence summary blocks readiness');
    ok(summary.readiness.issues.some((issue) => issue.includes('failed-core-consequence-rehearsal')), 'Production async recovery: failed consequence state is surfaced');
    equal(summary.behavior, null, 'Production async recovery: behavior is not exercised when Step 06 failed');
  });
}

async function testUnavailableRedisFailsWithoutHanging(): Promise<void> {
  const summary = await runWithTemp({
    env: baseEnv('redis://127.0.0.1:1'),
  });

  equal(summary.readiness.passed, false, 'Production async recovery: unreachable Redis fails readiness');
  equal(summary.readiness.state, 'failed-async-recovery-rehearsal', 'Production async recovery: unreachable Redis is a core rehearsal failure');
  ok(summary.readiness.issues.some((issue) => issue.includes('redis-production-posture') || issue.includes('async-recovery-rehearsal')), 'Production async recovery: Redis failure is surfaced');
}

function testDocsAndPackageWireTheRehearsal(): void {
  const packageJson = readJson<{ scripts: Record<string, string> }>('package.json');
  const tracker = readProjectFile('docs', '02-architecture', 'production-rehearsal-buildout.md');
  const manifest = readProjectFile('docs', '08-deployment', 'production-rehearsal-manifest.example.json');

  equal(packageJson.scripts['rehearse:production-async-recovery'], 'tsx scripts/rehearse/rehearse-production-async-recovery.ts', 'Production async recovery: package exposes the rehearsal command');
  equal(packageJson.scripts['test:production-rehearsal-async-recovery'], 'tsx tests/production-rehearsal-async-recovery.test.ts', 'Production async recovery: package exposes the rehearsal test');
  includes(tracker, '| Completed | 10 |', 'Production async recovery: tracker now reflects Step 10 completion');
  includes(tracker, '| Not started | 0 |', 'Production async recovery: tracker leaves no frozen steps pending');
  includes(tracker, '| 07 | complete | Rehearse queue, worker, and async recovery |', 'Production async recovery: Step 07 is complete without renumbering');
  includes(tracker, 'The production rehearsal buildout is complete at the repository level.', 'Production async recovery: immediate next step now advances beyond Step 10');
  includes(manifest, 'npm run rehearse:production-async-recovery', 'Production async recovery: manifest command plan includes the rehearsal command');
  includes(manifest, 'production-rehearsal-async-recovery', 'Production async recovery: manifest evidence includes the async recovery summary');
}

await testAsyncRecoveryPassesAndWritesArtifacts();
await testMissingRedisUrlBlocksBeforeCoreBehavior();
await testFailedSubstrateSummaryBlocksBeforeCoreBehavior();
await testFailedConsequenceSummaryBlocksBeforeCoreBehavior();
await testUnavailableRedisFailsWithoutHanging();
testDocsAndPackageWireTheRehearsal();

console.log(`production-rehearsal-async-recovery.test.ts: ${passed} assertions passed`);
