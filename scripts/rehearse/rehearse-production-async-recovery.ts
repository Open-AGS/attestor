import IORedis from 'ioredis';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createPipelineQueue,
  createPipelineWorker,
  getAsyncQueueSummary,
  getAsyncRetryPolicy,
  getJobStatus,
  listFailedPipelineJobs,
  submitPipelineJob,
  type PipelineJobResult,
} from '../../src/service/async/async-pipeline.js';
import {
  listAsyncDeadLetterRecords,
  resetAsyncDeadLetterStoreForTests,
} from '../../src/service/async/async-dead-letter-store.js';
import {
  configureTenantAsyncExecutionCoordinator,
  resetTenantAsyncExecutionCoordinatorForTests,
  shutdownTenantAsyncExecutionCoordinator,
} from '../../src/service/async/async-tenant-execution.js';
import {
  configureTenantAsyncWeightedDispatchCoordinator,
  resetTenantAsyncWeightedDispatchCoordinatorForTests,
  shutdownTenantAsyncWeightedDispatchCoordinator,
} from '../../src/service/async/async-weighted-dispatch.js';
import {
  fail,
  pass,
  skip,
  type ProductionAsyncRecoveryCheck,
} from './async-recovery-checks.ts';

type Environment = Readonly<Record<string, string | undefined>>;

interface TargetProfile {
  readonly profileId: string;
  readonly targetEnvironment: {
    readonly provider: string;
    readonly namespace: string;
  };
  readonly runtime: {
    readonly profile: string;
    readonly requireSharedAuthority: boolean;
    readonly noLocalFallback: boolean;
    readonly sharedAuthorityContract: string;
  };
  readonly substrates: readonly Array<{
    readonly id: string;
    readonly kind: string;
    readonly requiredEnv: readonly string[];
  }>;
}

interface PriorStepSummary {
  readonly profileId?: string;
  readonly readiness: {
    readonly passed: boolean;
    readonly state: string;
    readonly issues?: readonly string[];
  };
  readonly target?: {
    readonly provider?: string;
    readonly namespace?: string;
    readonly publicHostname?: string | null;
  };
}

export type { ProductionAsyncRecoveryCheck } from './async-recovery-checks.ts';

interface AsyncRecoveryBehavior {
  readonly redis: {
    readonly ping: string;
    readonly maxmemoryPolicy: string;
    readonly queueName: string;
  };
  readonly retryPolicy: {
    readonly attempts: number;
    readonly backoffMs: number;
    readonly maxStalledCount: number;
    readonly workerConcurrency: number;
  };
  readonly drainRestart: {
    readonly drainedJobId: string;
    readonly drainedStatus: string;
    readonly restartedJobId: string;
    readonly restartedStatus: string;
    readonly workerCloseWaitMs: number;
  };
  readonly retry: {
    readonly jobId: string;
    readonly attemptsObserved: number;
    readonly finalStatus: string;
  };
  readonly deadLetter: {
    readonly jobId: string;
    readonly finalStatus: string;
    readonly failedJobsVisible: number;
    readonly persistedRecordsVisible: number;
  };
  readonly failQuick: {
    readonly rejected: boolean;
    readonly elapsedMs: number;
    readonly message: string;
  };
  readonly finalQueueCounts: {
    readonly waiting: number;
    readonly active: number;
    readonly delayed: number;
    readonly prioritized: number;
    readonly completed: number;
    readonly failed: number;
    readonly paused: number;
  };
}

export interface ProductionAsyncRecoverySummary {
  readonly generatedAt: string;
  readonly profileId: string;
  readonly readiness: {
    readonly state:
      | 'passed-async-recovery-rehearsal'
      | 'blocked-on-target-prerequisites'
      | 'failed-async-recovery-rehearsal';
    readonly passed: boolean;
    readonly issues: readonly string[];
  };
  readonly target: {
    readonly provider: string;
    readonly namespace: string;
    readonly publicHostname: string | null;
  };
  readonly artifacts: {
    readonly outputDir: string;
    readonly summaryPath: string;
    readonly readmePath: string;
    readonly deadLetterStorePath: string;
  };
  readonly checks: readonly ProductionAsyncRecoveryCheck[];
  readonly behavior: AsyncRecoveryBehavior | null;
  readonly nonClaims: readonly string[];
}

function arg(name: string, fallback?: string): string | undefined {
  const prefixed = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefixed));
  if (found) return found.slice(prefixed.length);
  return fallback;
}

function envValue(env: Environment, name: string): string | null {
  const value = env[name];
  return value && value.trim() ? value.trim() : null;
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as T;
}

function tryReadSummary(path: string): PriorStepSummary | null {
  try {
    return readJsonFile<PriorStepSummary>(path);
  } catch {
    return null;
  }
}

function requiredRedisSubstrate(profile: TargetProfile): boolean {
  return profile.substrates.some((substrate) =>
    substrate.id === 'queue-redis' &&
    substrate.kind === 'redis' &&
    substrate.requiredEnv.includes('REDIS_URL'));
}

function targetPrerequisiteChecks(input: {
  readonly env: Environment;
  readonly profile: TargetProfile;
  readonly substrateSummary: PriorStepSummary | null;
  readonly consequenceSummary: PriorStepSummary | null;
}): ProductionAsyncRecoveryCheck[] {
  const checks: ProductionAsyncRecoveryCheck[] = [];
  const profileIssues: string[] = [];
  if (input.profile.profileId !== 'gke-production-rehearsal') {
    profileIssues.push(`unexpected profile id: ${input.profile.profileId}`);
  }
  if (input.profile.runtime.profile !== 'production-shared') {
    profileIssues.push('target profile must use production-shared');
  }
  if (!input.profile.runtime.requireSharedAuthority) {
    profileIssues.push('target profile must require shared authority');
  }
  if (!input.profile.runtime.noLocalFallback) {
    profileIssues.push('target profile must disable local fallback');
  }
  if (input.profile.runtime.sharedAuthorityContract !== 'async-shared-authority-stores') {
    profileIssues.push('target profile must use async-shared-authority-stores');
  }
  if (!requiredRedisSubstrate(input.profile)) {
    profileIssues.push('target profile must require the queue-redis REDIS_URL substrate');
  }
  checks.push(
    profileIssues.length === 0
      ? pass('target-profile-async-contract', 'Target profile pins production-shared async queue substrates')
      : fail('target-profile-async-contract', profileIssues.join(' ')),
  );

  const envIssues: string[] = [];
  if (envValue(input.env, 'ATTESTOR_RUNTIME_PROFILE') !== 'production-shared') {
    envIssues.push('ATTESTOR_RUNTIME_PROFILE must be production-shared');
  }
  if (!envValue(input.env, 'REDIS_URL')) {
    envIssues.push('REDIS_URL is required for Redis/BullMQ production rehearsal');
  }
  checks.push(
    envIssues.length === 0
      ? pass('shared-redis-env', 'Runtime env selects production-shared Redis/BullMQ coordination')
      : fail('shared-redis-env', envIssues.join(' ')),
  );

  if (!input.substrateSummary) {
    checks.push(fail('substrate-readiness-prerequisite', 'Step 05 substrate readiness summary is missing'));
  } else if (!input.substrateSummary.readiness.passed) {
    checks.push(
      fail(
        'substrate-readiness-prerequisite',
        `Step 05 substrate readiness is ${input.substrateSummary.readiness.state}`,
        { issues: input.substrateSummary.readiness.issues ?? [] },
      ),
    );
  } else {
    checks.push(
      pass('substrate-readiness-prerequisite', 'Step 05 substrate readiness passed for the named target', {
        state: input.substrateSummary.readiness.state,
      }),
    );
  }

  if (!input.consequenceSummary) {
    checks.push(fail('consequence-rehearsal-prerequisite', 'Step 06 consequence behavior summary is missing'));
  } else if (!input.consequenceSummary.readiness.passed) {
    checks.push(
      fail(
        'consequence-rehearsal-prerequisite',
        `Step 06 consequence rehearsal is ${input.consequenceSummary.readiness.state}`,
        { issues: input.consequenceSummary.readiness.issues ?? [] },
      ),
    );
  } else {
    checks.push(
      pass('consequence-rehearsal-prerequisite', 'Step 06 consequence behavior passed before async recovery rehearsal', {
        state: input.consequenceSummary.readiness.state,
      }),
    );
  }

  return checks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeInput(runId: string) {
  return {
    runId,
    candidateSql: 'select 1 as approved_amount',
    intent: {
      operation: 'production-rehearsal-async-recovery',
      runId,
    },
  };
}

function makeResult(jobId: string | undefined, decision = 'approve'): PipelineJobResult {
  return {
    runId: `async-rehearsal-${jobId ?? 'job'}`,
    decision,
    proofMode: 'live',
    certificateId: null,
    completedAt: new Date().toISOString(),
    durationMs: 1,
  };
}

async function waitForStatus(
  queue: ReturnType<typeof createPipelineQueue>,
  jobId: string,
  terminal: readonly string[],
  timeoutMs = 10_000,
): Promise<Awaited<ReturnType<typeof getJobStatus>>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getJobStatus(queue, jobId);
    if (terminal.includes(status.status)) return status;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for async job '${jobId}' to reach ${terminal.join(' or ')}.`);
}

async function waitForCondition(
  predicate: () => Promise<boolean>,
  timeoutMs = 5_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(50);
  }
  return false;
}

function setTemporaryEnv(values: Readonly<Record<string, string>>): { restore(): void } {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  return {
    restore() {
      for (const [key, value] of previous.entries()) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    },
  };
}

async function redisPosture(redisUrl: string): Promise<{
  readonly check: ProductionAsyncRecoveryCheck;
  readonly ping: string;
  readonly maxmemoryPolicy: string;
}> {
  let client: IORedis | null = null;
  try {
    client = new IORedis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      retryStrategy: () => null,
    });
    client.on('error', () => {});
    await client.connect();
    const ping = await client.ping();
    const maxmemoryPolicyResult = await client.config('GET', 'maxmemory-policy') as string[];
    const maxmemoryPolicy = maxmemoryPolicyResult[1] ?? 'unknown';
    return {
      check: ping === 'PONG' && maxmemoryPolicy === 'noeviction'
        ? pass('redis-production-posture', 'Redis is reachable and maxmemory-policy is noeviction', {
            ping,
            maxmemoryPolicy,
          })
        : fail('redis-production-posture', `Redis posture failed: ping=${ping}, maxmemory-policy=${maxmemoryPolicy}`),
      ping,
      maxmemoryPolicy,
    };
  } catch (error) {
    return {
      check: fail('redis-production-posture', error instanceof Error ? error.message : String(error)),
      ping: 'failed',
      maxmemoryPolicy: 'unknown',
    };
  } finally {
    if (client) {
      try { await client.quit(); } catch { client.disconnect(); }
    }
  }
}

async function submitFailsQuickly(): Promise<AsyncRecoveryBehavior['failQuick']> {
  const unavailableQueue = createPipelineQueue({
    redisUrl: process.env.ATTESTOR_REHEARSAL_UNAVAILABLE_REDIS_URL ?? 'redis://127.0.0.1:1',
    queueName: `attestor-rehearsal-unavailable-${Date.now().toString(36)}`,
  });
  unavailableQueue.on('error', () => {});
  const started = Date.now();
  try {
    await Promise.race([
      submitPipelineJob(
        unavailableQueue,
        makeInput('fail-quick'),
        { tenantId: 'tenant-production-rehearsal', planId: 'trial', source: 'production-rehearsal' },
      ),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('submit did not fail within 2000ms')), 2000)),
    ]);
    return {
      rejected: false,
      elapsedMs: Date.now() - started,
      message: 'submission unexpectedly succeeded against unavailable Redis',
    };
  } catch (error) {
    return {
      rejected: true,
      elapsedMs: Date.now() - started,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try { await unavailableQueue.close(); } catch { await unavailableQueue.disconnect(); }
  }
}

async function runCoreAsyncRecovery(input: {
  readonly redisUrl: string;
  readonly outputDir: string;
}): Promise<{
  readonly checks: readonly ProductionAsyncRecoveryCheck[];
  readonly behavior: AsyncRecoveryBehavior;
}> {
  const checks: ProductionAsyncRecoveryCheck[] = [];
  const queueName = `attestor-production-rehearsal-${Date.now().toString(36)}`;
  const deadLetterStorePath = resolve(input.outputDir, 'async-dead-letter.json');
  const envRestore = setTemporaryEnv({
    ATTESTOR_ASYNC_ATTEMPTS: '2',
    ATTESTOR_ASYNC_BACKOFF_MS: '50',
    ATTESTOR_ASYNC_MAX_STALLED_COUNT: '1',
    ATTESTOR_ASYNC_WORKER_CONCURRENCY: '1',
    ATTESTOR_ASYNC_ACTIVE_REDIS_URL: input.redisUrl,
    ATTESTOR_ASYNC_DISPATCH_REDIS_URL: input.redisUrl,
    ATTESTOR_ASYNC_REQUIRE_SHARED_COORDINATION: 'true',
    ATTESTOR_ASYNC_ACTIVE_STARTER_JOBS: '10',
    ATTESTOR_ASYNC_ACTIVE_ENTERPRISE_JOBS: '10',
    ATTESTOR_ASYNC_DISPATCH_BASE_INTERVAL_MS: '1',
    ATTESTOR_ASYNC_QUEUE_CONNECT_TIMEOUT_MS: '500',
    ATTESTOR_ASYNC_DLQ_STORE_PATH: deadLetterStorePath,
  });

  const queue = createPipelineQueue({
    redisUrl: input.redisUrl,
    queueName,
    jobTtlSeconds: 300,
  });
  queue.on('error', () => {});
  const workers: Array<ReturnType<typeof createPipelineWorker>> = [];

  try {
    configureTenantAsyncExecutionCoordinator({ redisUrl: input.redisUrl, redisMode: 'production-rehearsal' });
    configureTenantAsyncWeightedDispatchCoordinator({ redisUrl: input.redisUrl, redisMode: 'production-rehearsal' });
    await resetTenantAsyncExecutionCoordinatorForTests();
    await resetTenantAsyncWeightedDispatchCoordinatorForTests();
    resetAsyncDeadLetterStoreForTests();

    await queue.obliterate({ force: true }).catch(() => {});

    const redis = await redisPosture(input.redisUrl);
    checks.push(redis.check);

    const policy = getAsyncRetryPolicy({ jobTtlSeconds: 300 });
    checks.push(
      policy.attempts >= 2 &&
        policy.backoffMs > 0 &&
        policy.maxStalledCount >= 1 &&
        policy.workerConcurrency >= 1
        ? pass('bullmq-retry-stalled-policy', 'BullMQ retry/backoff and stalled-job guardrails are configured', policy)
        : fail('bullmq-retry-stalled-policy', 'BullMQ retry/backoff or stalled-job guardrails are not configured', policy),
    );

    let drainStarted = false;
    const drainWorker = createPipelineWorker({
      redisUrl: input.redisUrl,
      queueName,
      processJob: async (job) => {
        drainStarted = true;
        await sleep(200);
        return makeResult(job.id, 'approve');
      },
    });
    workers.push(drainWorker);
    const drainedJob = await submitPipelineJob(
      queue,
      makeInput('drain'),
      { tenantId: 'tenant-production-rehearsal', planId: 'trial', source: 'production-rehearsal' },
    );
    await waitForCondition(async () => drainStarted, 5_000);
    const closeStarted = Date.now();
    await drainWorker.close();
    workers.pop();
    const workerCloseWaitMs = Date.now() - closeStarted;
    const drainedStatus = await waitForStatus(queue, drainedJob.jobId, ['completed']);

    const restartWorker = createPipelineWorker({
      redisUrl: input.redisUrl,
      queueName,
      processJob: async (job) => makeResult(job.id, 'approve'),
    });
    workers.push(restartWorker);
    const restartedJob = await submitPipelineJob(
      queue,
      makeInput('restart'),
      { tenantId: 'tenant-production-rehearsal', planId: 'trial', source: 'production-rehearsal' },
    );
    const restartedStatus = await waitForStatus(queue, restartedJob.jobId, ['completed']);
    await restartWorker.close();
    workers.pop();
    checks.push(
      drainedStatus.status === 'completed' &&
        restartedStatus.status === 'completed' &&
        workerCloseWaitMs >= 100
        ? pass('worker-drain-restart', 'Worker drained in-flight work, closed, restarted, and processed the next job', {
            drainedJobId: drainedJob.jobId,
            restartedJobId: restartedJob.jobId,
            workerCloseWaitMs,
          })
        : fail('worker-drain-restart', 'Worker drain or restart did not complete cleanly'),
    );

    let retryAttempts = 0;
    const retryWorker = createPipelineWorker({
      redisUrl: input.redisUrl,
      queueName,
      processJob: async (job) => {
        retryAttempts += 1;
        if (retryAttempts === 1) throw new Error('transient production rehearsal failure');
        return makeResult(job.id, 'approve-after-retry');
      },
    });
    workers.push(retryWorker);
    const retryJob = await submitPipelineJob(
      queue,
      makeInput('retry'),
      { tenantId: 'tenant-production-rehearsal', planId: 'trial', source: 'production-rehearsal' },
    );
    const retryStatus = await waitForStatus(queue, retryJob.jobId, ['completed']);
    await retryWorker.close();
    workers.pop();
    checks.push(
      retryStatus.status === 'completed' && retryAttempts === 2
        ? pass('worker-retry-recovery', 'Transient worker failure retried and completed through BullMQ', {
            jobId: retryJob.jobId,
            attemptsObserved: retryAttempts,
          })
        : fail('worker-retry-recovery', 'Transient worker failure did not retry to completion'),
    );

    const dlqWorker = createPipelineWorker({
      redisUrl: input.redisUrl,
      queueName,
      processJob: async () => {
        throw new Error('terminal production rehearsal failure');
      },
    });
    workers.push(dlqWorker);
    const failedJob = await submitPipelineJob(
      queue,
      makeInput('dead-letter'),
      { tenantId: 'tenant-production-rehearsal', planId: 'trial', source: 'production-rehearsal' },
    );
    const failedStatus = await waitForStatus(queue, failedJob.jobId, ['failed']);
    const dlqVisible = await waitForCondition(async () => {
      const records = listAsyncDeadLetterRecords({ tenantId: 'tenant-production-rehearsal', backendMode: 'bullmq' });
      return records.records.some((record) => record.jobId === failedJob.jobId);
    }, 5_000);
    const failedJobs = await listFailedPipelineJobs(queue, { tenantId: 'tenant-production-rehearsal', limit: 10 });
    const persistedDlq = listAsyncDeadLetterRecords({ tenantId: 'tenant-production-rehearsal', backendMode: 'bullmq' });
    await dlqWorker.close();
    workers.pop();
    checks.push(
      failedStatus.status === 'failed' &&
        failedJobs.some((record) => record.jobId === failedJob.jobId) &&
        dlqVisible &&
        persistedDlq.records.some((record) => record.jobId === failedJob.jobId)
        ? pass('dead-letter-visibility', 'Terminal worker failure is visible in BullMQ failed jobs and the persistent DLQ store', {
            jobId: failedJob.jobId,
            failedJobsVisible: failedJobs.length,
            persistedRecordsVisible: persistedDlq.records.length,
          })
        : fail('dead-letter-visibility', 'Terminal worker failure was not visible in failed jobs or persistent DLQ store'),
    );

    const failQuick = await submitFailsQuickly();
    checks.push(
      failQuick.rejected && failQuick.elapsedMs < 2_000
        ? pass('fail-quick-submission', 'Queue submission rejects quickly when Redis coordination is unavailable', failQuick)
        : fail('fail-quick-submission', 'Queue submission did not reject quickly when Redis coordination was unavailable', failQuick),
    );

    const queueSummary = await getAsyncQueueSummary(queue, 'tenant-production-rehearsal', 'enterprise');
    checks.push(
      queueSummary.backend === 'bullmq' &&
        queueSummary.tenant?.activeExecutionBackend === 'redis' &&
        queueSummary.tenant?.weightedDispatchBackend === 'redis' &&
        queueSummary.counts.failed >= 1 &&
        queueSummary.counts.completed >= 3
        ? pass('queue-summary-shared-backends', 'Queue summary reports BullMQ with Redis-backed tenant coordination and visible terminal states', queueSummary)
        : fail('queue-summary-shared-backends', 'Queue summary did not report BullMQ/Redis coordination and terminal states', queueSummary),
    );

    return {
      checks,
      behavior: {
        redis: {
          ping: redis.ping,
          maxmemoryPolicy: redis.maxmemoryPolicy,
          queueName,
        },
        retryPolicy: {
          attempts: policy.attempts,
          backoffMs: policy.backoffMs,
          maxStalledCount: policy.maxStalledCount,
          workerConcurrency: policy.workerConcurrency,
        },
        drainRestart: {
          drainedJobId: drainedJob.jobId,
          drainedStatus: drainedStatus.status,
          restartedJobId: restartedJob.jobId,
          restartedStatus: restartedStatus.status,
          workerCloseWaitMs,
        },
        retry: {
          jobId: retryJob.jobId,
          attemptsObserved: retryAttempts,
          finalStatus: retryStatus.status,
        },
        deadLetter: {
          jobId: failedJob.jobId,
          finalStatus: failedStatus.status,
          failedJobsVisible: failedJobs.length,
          persistedRecordsVisible: persistedDlq.records.length,
        },
        failQuick,
        finalQueueCounts: queueSummary.counts,
      },
    };
  } finally {
    for (const worker of workers.reverse()) {
      try { await worker.close(); } catch { await worker.disconnect(); }
    }
    try { await queue.obliterate({ force: true }); } catch {}
    try { await queue.close(); } catch { await queue.disconnect(); }
    await shutdownTenantAsyncExecutionCoordinator().catch(() => {});
    await shutdownTenantAsyncWeightedDispatchCoordinator().catch(() => {});
    envRestore.restore();
  }
}

function renderReadme(summary: ProductionAsyncRecoverySummary): string {
  const checkLines = summary.checks
    .map((check) => `- ${check.status.toUpperCase()} ${check.id}: ${check.detail}`)
    .join('\n');
  const issueLines = summary.readiness.issues.length
    ? summary.readiness.issues.map((issue) => `- ${issue}`).join('\n')
    : '- none';
  return `# Production rehearsal async recovery

Generated at:

- ${summary.generatedAt}

Profile:

- ${summary.profileId}
- provider: ${summary.target.provider}
- namespace: ${summary.target.namespace}
- public hostname: ${summary.target.publicHostname ?? 'not configured'}

Readiness:

- state: ${summary.readiness.state}
- passed: ${summary.readiness.passed}

Checks:

${checkLines}

Issues:

${issueLines}

Non-claims:

${summary.nonClaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export async function rehearseProductionAsyncRecovery(options?: {
  readonly profilePath?: string;
  readonly substrateSummaryPath?: string;
  readonly substrateSummary?: PriorStepSummary | null;
  readonly consequenceSummaryPath?: string;
  readonly consequenceSummary?: PriorStepSummary | null;
  readonly outputDir?: string;
  readonly env?: Environment;
}): Promise<ProductionAsyncRecoverySummary> {
  const env = options?.env ?? process.env;
  const profilePath = resolve(options?.profilePath ?? arg(
    'profile',
    'docs/08-deployment/production-rehearsal-targets/gke-production-rehearsal.json',
  )!);
  const substrateSummaryPath = resolve(options?.substrateSummaryPath ?? arg(
    'substrate-summary',
    '.attestor/rehearsal/gke-production-rehearsal/substrate-readiness/summary.json',
  )!);
  const consequenceSummaryPath = resolve(options?.consequenceSummaryPath ?? arg(
    'consequence-summary',
    '.attestor/rehearsal/gke-production-rehearsal/consequence-behavior/summary.json',
  )!);
  const outputDir = resolve(options?.outputDir ?? arg(
    'output-dir',
    '.attestor/rehearsal/gke-production-rehearsal/async-recovery',
  )!);

  const profile = readJsonFile<TargetProfile>(profilePath);
  const substrateSummary =
    options?.substrateSummary !== undefined
      ? options.substrateSummary
      : tryReadSummary(substrateSummaryPath);
  const consequenceSummary =
    options?.consequenceSummary !== undefined
      ? options.consequenceSummary
      : tryReadSummary(consequenceSummaryPath);
  const target = substrateSummary?.target ?? {
    provider: profile.targetEnvironment.provider,
    namespace: profile.targetEnvironment.namespace,
    publicHostname: envValue(env, 'ATTESTOR_PUBLIC_HOSTNAME'),
  };
  const checks = targetPrerequisiteChecks({
    env,
    profile,
    substrateSummary,
    consequenceSummary,
  });
  let behavior: AsyncRecoveryBehavior | null = null;

  const prerequisitesPassed = checks.every((check) => check.status === 'pass');
  if (!prerequisitesPassed) {
    checks.push(skip('async-recovery-rehearsal', 'Async recovery behavior was not exercised because target prerequisites failed'));
  } else {
    try {
      const redisUrl = envValue(env, 'REDIS_URL');
      if (!redisUrl) throw new Error('REDIS_URL is required for async recovery rehearsal.');
      const result = await runCoreAsyncRecovery({ redisUrl, outputDir });
      checks.push(...result.checks);
      behavior = result.behavior;
    } catch (error) {
      checks.push(
        fail(
          'async-recovery-rehearsal',
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  const issues = checks
    .filter((check) => check.status === 'fail')
    .map((check) => `${check.id}: ${check.detail}`);
  const summary: ProductionAsyncRecoverySummary = {
    generatedAt: new Date().toISOString(),
    profileId: profile.profileId,
    readiness: {
      state: !prerequisitesPassed
        ? 'blocked-on-target-prerequisites'
        : issues.length === 0
          ? 'passed-async-recovery-rehearsal'
          : 'failed-async-recovery-rehearsal',
      passed: prerequisitesPassed && issues.length === 0,
      issues,
    },
    target: {
      provider: target.provider ?? profile.targetEnvironment.provider,
      namespace: target.namespace ?? profile.targetEnvironment.namespace,
      publicHostname: target.publicHostname ?? envValue(env, 'ATTESTOR_PUBLIC_HOSTNAME'),
    },
    artifacts: {
      outputDir,
      summaryPath: resolve(outputDir, 'summary.json'),
      readmePath: resolve(outputDir, 'README.md'),
      deadLetterStorePath: resolve(outputDir, 'async-dead-letter.json'),
    },
    checks,
    behavior,
    nonClaims: [
      'This async recovery rehearsal is not market validation.',
      'This async recovery rehearsal is not a hosted public SaaS launch.',
      'This async recovery rehearsal is not a blanket production guarantee for other environments.',
      'This async recovery rehearsal does not prove backup, restore, or DR; Step 08 owns that scope.',
      'This async recovery rehearsal does not replace independent security review or operator approval.',
    ],
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(summary.artifacts.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(summary.artifacts.readmePath, renderReadme(summary), 'utf8');
  return summary;
}

async function main(): Promise<void> {
  const summary = await rehearseProductionAsyncRecovery();
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.readiness.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });
}
