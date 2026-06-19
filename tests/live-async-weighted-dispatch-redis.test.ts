import { strict as assert } from 'node:assert';
import { RedisMemoryServer } from 'redis-memory-server';
import {
  createPipelineQueue,
  createPipelineWorker,
  getJobStatus,
  getTenantAsyncQueueSnapshot,
  submitPipelineJob,
  type PipelineJobResult,
} from '../src/service/async/async-pipeline.js';
import {
  configureTenantAsyncExecutionCoordinator,
  resetTenantAsyncExecutionCoordinatorForTests,
  shutdownTenantAsyncExecutionCoordinator,
} from '../src/service/async/async-tenant-execution.js';
import {
  configureTenantAsyncWeightedDispatchCoordinator,
  getTenantAsyncWeightedDispatchCoordinatorStatus,
  resetTenantAsyncWeightedDispatchCoordinatorForTests,
  shutdownTenantAsyncWeightedDispatchCoordinator,
} from '../src/service/async/async-weighted-dispatch.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCompletion(
  queue: ReturnType<typeof createPipelineQueue>,
  jobId: string,
  timeoutMs: number = 8_000,
): Promise<PipelineJobResult> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getJobStatus(queue, jobId);
    if (status.status === 'completed') return status.result!;
    if (status.status === 'failed') {
      throw new Error(`Async job ${jobId} failed unexpectedly: ${status.error}`);
    }
    await sleep(50);
  }
  throw new Error(`Timed out waiting for async job ${jobId} to complete.`);
}

async function main(): Promise<void> {
  const previousEnv = {
    ATTESTOR_ASYNC_DISPATCH_BASE_INTERVAL_MS: process.env.ATTESTOR_ASYNC_DISPATCH_BASE_INTERVAL_MS,
    ATTESTOR_ASYNC_DISPATCH_REDIS_URL: process.env.ATTESTOR_ASYNC_DISPATCH_REDIS_URL,
    ATTESTOR_ASYNC_ACTIVE_REDIS_URL: process.env.ATTESTOR_ASYNC_ACTIVE_REDIS_URL,
    ATTESTOR_ASYNC_ACTIVE_TRIAL_JOBS: process.env.ATTESTOR_ASYNC_ACTIVE_TRIAL_JOBS,
    ATTESTOR_ASYNC_DISPATCH_TRIAL_WEIGHT: process.env.ATTESTOR_ASYNC_DISPATCH_TRIAL_WEIGHT,
    ATTESTOR_ASYNC_WORKER_CONCURRENCY: process.env.ATTESTOR_ASYNC_WORKER_CONCURRENCY,
  };

  const redis = new RedisMemoryServer();
  const host = await redis.getHost();
  const port = await redis.getPort();
  const redisUrl = `redis://${host}:${port}`;
  const queueName = `attestor-weighted-dispatch-${Date.now().toString(36)}`;

  process.env.ATTESTOR_ASYNC_DISPATCH_BASE_INTERVAL_MS = '400';
  process.env.ATTESTOR_ASYNC_DISPATCH_REDIS_URL = redisUrl;
  process.env.ATTESTOR_ASYNC_ACTIVE_REDIS_URL = redisUrl;
  process.env.ATTESTOR_ASYNC_ACTIVE_TRIAL_JOBS = '4';
  process.env.ATTESTOR_ASYNC_DISPATCH_TRIAL_WEIGHT = '1';
  process.env.ATTESTOR_ASYNC_WORKER_CONCURRENCY = '4';

  const planStarts = new Map<string, number[]>();

  const queue = createPipelineQueue({ redisUrl, queueName });
  const worker = createPipelineWorker({
    redisUrl,
    queueName,
    processJob: async (job) => {
      const planId = job.data.tenant.planId ?? 'trial';
      const planEntries = planStarts.get(planId) ?? [];
      planEntries.push(Date.now());
      planStarts.set(planId, planEntries);
      await sleep(80);
      return {
        runId: `weighted-${job.id}`,
        decision: 'approve',
        proofMode: 'live',
        certificateId: null,
        completedAt: new Date().toISOString(),
        durationMs: 80,
      };
    },
  });

  try {
    console.log('\n[Live Async Weighted Dispatch Redis]');

    configureTenantAsyncExecutionCoordinator({ redisUrl, redisMode: 'embedded-test' });
    configureTenantAsyncWeightedDispatchCoordinator({ redisUrl, redisMode: 'embedded-test' });
    await resetTenantAsyncExecutionCoordinatorForTests();
    await resetTenantAsyncWeightedDispatchCoordinatorForTests();

    const coordinator = getTenantAsyncWeightedDispatchCoordinatorStatus();
    ok(coordinator.backend === 'redis', 'Weighted dispatch: backend reports redis');
    ok(coordinator.shared === true, 'Weighted dispatch: shared mode reports true');

    const trialA = await submitPipelineJob(queue, {
      runId: 'trial-a',
      candidateSql: 'select 1 as n',
      intent: { label: 'trial-a' },
    }, {
      tenantId: 'trial-a',
      planId: 'trial',
      source: 'live-test',
    });
    const trialB = await submitPipelineJob(queue, {
      runId: 'trial-b',
      candidateSql: 'select 2 as n',
      intent: { label: 'trial-b' },
    }, {
      tenantId: 'trial-b',
      planId: 'trial',
      source: 'live-test',
    });

    await sleep(150);

    const trialSnapshot = await getTenantAsyncQueueSnapshot(queue, 'trial-a', 'trial');
    ok(trialSnapshot.weightedDispatchEnforced === true, 'Weighted dispatch: trial snapshot reports enforcement');
    ok(trialSnapshot.weightedDispatchBackend === 'redis', 'Weighted dispatch: trial snapshot reports redis backend');
    ok(trialSnapshot.weightedDispatchWeight === 1, 'Weighted dispatch: trial weight = 1');
    ok(trialSnapshot.weightedDispatchWindowMs === 400, 'Weighted dispatch: trial dispatch window = 400ms');

    await waitForCompletion(queue, trialA.jobId);
    await waitForCompletion(queue, trialB.jobId);

    const trialStarts = (planStarts.get('trial') ?? []).sort((a, b) => a - b);
    ok(trialStarts.length === 2, 'Weighted dispatch: both trial jobs ran');

    const trialDelta = trialStarts[1] - trialStarts[0];
    ok(trialDelta >= 300, 'Weighted dispatch: trial jobs are spaced by the dispatch window');

    console.log(`  Live async weighted dispatch tests: ${passed} passed, 0 failed`);
  } finally {
    try { await worker.close(); } catch {}
    try { await queue.close(); } catch {}
    await shutdownTenantAsyncExecutionCoordinator().catch(() => {});
    await shutdownTenantAsyncWeightedDispatchCoordinator().catch(() => {});
    try { await redis.stop(); } catch {}

    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error('\nLive async weighted dispatch tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
