import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Hono } from 'hono';
import { createPipelineIdempotencyService } from '../src/service/application/pipeline-idempotency-service.js';
import {
  ensurePipelineIdempotencyStateReady,
  lookupPipelineIdempotencyState,
  recordPipelineIdempotencyState,
} from '../src/service/control-plane-store.js';
import {
  registerPipelineAsyncRoutes,
  type PipelineAsyncRoutesDeps,
} from '../src/service/http/routes/pipeline-async-routes.js';
import {
  registerPipelineExecutionRoutes,
  type PipelineExecutionRoutesDeps,
} from '../src/service/http/routes/pipeline-execution-routes.js';
import { hashJsonValue } from '../src/service/json-stable.js';
import { resetPipelineIdempotencyStoreForTests } from '../src/service/pipeline-idempotency-store.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';

const tenant: TenantContext = {
  tenantId: 'tenant_pipeline_idem',
  source: 'api_key',
  planId: 'pro',
  accountId: 'acct_pipeline_idem',
  tenantName: 'Pipeline Idempotency',
  monthlyRunQuota: 100,
};

function withEnv(): () => void {
  const previous = new Map<string, string | undefined>();
  const overrides: Record<string, string | undefined> = {
    ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY: 'pipeline-idempotency-test-key',
    ATTESTOR_PIPELINE_IDEMPOTENCY_STORE_PATH: join(
      tmpdir(),
      `attestor-pipeline-idempotency-${randomUUID()}.json`,
    ),
    ATTESTOR_CONTROL_PLANE_PG_URL: undefined,
  };
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    resetPipelineIdempotencyStoreForTests();
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function withMissingIdempotencyEncryptionEnv(): () => void {
  const previous = new Map<string, string | undefined>();
  const overrides: Record<string, string | undefined> = {
    ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY: undefined,
    ATTESTOR_ADMIN_API_KEY: undefined,
    ATTESTOR_CONTROL_PLANE_PG_URL: undefined,
    ATTESTOR_HA_MODE: 'true',
  };
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function pipelineIdempotencyService() {
  return createPipelineIdempotencyService({
    hashJsonValue,
    ensurePipelineIdempotencyStateReady,
    lookupPipelineIdempotencyState,
    recordPipelineIdempotencyState,
  });
}

function usageService(counters: { consume: number }) {
  return {
    async check() {
      return {
        allowed: true,
        usage: {
          tenantId: tenant.tenantId,
          planId: tenant.planId,
          monthlyRunQuota: tenant.monthlyRunQuota,
          runsThisMonth: counters.consume,
          overage: false,
          overageUnits: 0,
        },
      };
    },
    async consume() {
      counters.consume += 1;
      return {
        usage: {
          tenantId: tenant.tenantId,
          planId: tenant.planId,
          monthlyRunQuota: tenant.monthlyRunQuota,
          runsThisMonth: counters.consume,
          overage: false,
          overageUnits: 0,
        },
        billingMetering: null,
      };
    },
  };
}

function executionReport(runId: string) {
  return {
    runId,
    timestamp: '2026-05-21T00:00:00.000Z',
    intent: 'approve test query',
    candidateSql: 'select 1',
    decision: 'approve',
    scoring: {
      scorersRun: 1,
      decision: 'approve',
    },
    warrant: { status: 'issued' },
    escrow: { state: 'released' },
    receipt: null,
    capsule: null,
    liveProof: { mode: 'fixture' },
    audit: {
      entries: [],
      chainIntact: true,
    },
    certificate: null,
    evidenceChain: null,
    execution: { rows: [] },
  } as never;
}

function executionDeps(counters: { consume: number; run: number }): PipelineExecutionRoutesDeps {
  return {
    currentTenant: () => tenant,
    pipelineUsageService: usageService(counters),
    pipelineIdempotencyService: pipelineIdempotencyService(),
    reserveTenantPipelineRequest: async () => ({
      allowed: true,
      rateLimit: {
        tenantId: tenant.tenantId,
        planId: tenant.planId,
        limit: 10,
        remaining: 9,
        resetAt: '2026-05-21T00:01:00.000Z',
        retryAfterSeconds: null,
      },
    }) as never,
    applyRateLimitHeaders: () => {},
    connectorRegistry: { get: () => null, listIds: () => [] },
    verifyOidcToken: async () => ({ verified: false, identity: null, error: 'unused' }) as never,
    classifyIdentitySource: () => 'ephemeral' as never,
    createRequestSigners: () => ({}) as never,
    runFinancialPipeline: () => {
      counters.run += 1;
      return executionReport(`run-${counters.run}`);
    },
    buildVerificationKit: () => null,
    createFinanceCommunicationReleaseCandidateFromReport: () => null,
    buildFinanceCommunicationReleaseMaterial: () => ({} as never),
    buildFinanceCommunicationReleaseObservation: () => ({} as never),
    financeCommunicationReleaseShadowEvaluator: { evaluate: async () => ({}) as never },
    createFinanceActionReleaseCandidateFromReport: () => null,
    buildFinanceActionReleaseMaterial: () => ({} as never),
    buildFinanceActionReleaseObservation: () => ({} as never),
    financeActionReleaseShadowEvaluator: { evaluate: async () => ({}) as never },
    createFinanceFilingReleaseCandidateFromReport: () => null,
    FINANCE_FILING_ADAPTER_ID: 'xbrl-us-gaap-2024',
    buildFinanceFilingReleaseMaterial: () => ({} as never),
    financeReleaseDecisionEngine: {} as never,
    financeReleaseDecisionLog: { entries: async () => [], verify: async () => ({ valid: true }) } as never,
    buildFinanceFilingReleaseObservation: () => ({} as never),
    currentReleaseRequester: () => ({}) as never,
    currentReleaseEvaluationContext: () => ({}) as never,
    finalizeFinanceFilingReleaseDecision: (decision) => decision,
    createFinanceReviewerQueueItem: () => ({} as never),
    apiReleaseReviewerQueueStore: {} as never,
    apiReleaseTokenIssuer: {} as never,
    apiReleaseEvidencePackStore: {} as never,
    apiReleaseEvidencePackIssuer: {} as never,
    apiReleaseIntrospectionStore: {} as never,
    schemaAttestationSummaryFromFull: () => null,
    schemaAttestationSummaryFromConnector: () => null,
    filingRegistry: { get: () => null },
    buildCounterpartyEnvelope: () => ({} as never),
  };
}

function asyncDeps(counters: { consume: number; submit: number }): PipelineAsyncRoutesDeps {
  return {
    currentTenant: () => tenant,
    pipelineUsageService: usageService(counters),
    pipelineIdempotencyService: pipelineIdempotencyService(),
    reserveTenantPipelineRequest: async () => ({
      allowed: true,
      rateLimit: {
        tenantId: tenant.tenantId,
        planId: tenant.planId,
        limit: 10,
        remaining: 9,
        resetAt: '2026-05-21T00:01:00.000Z',
        retryAfterSeconds: null,
      },
    }) as never,
    applyRateLimitHeaders: () => {},
    createRequestSigners: () => ({}) as never,
    runFinancialPipeline: () => executionReport('async-run'),
    buildVerificationKit: () => null,
    asyncBackendMode: 'in_process',
    bullmqQueue: null,
    canEnqueueTenantAsyncJob: async () => ({}) as never,
    currentAsyncSubmissionReservations: () => 0,
    reserveAsyncSubmission: () => {},
    releaseAsyncSubmission: () => {},
    getAsyncRetryPolicy: () => ({ attempts: 1, backoffMs: 0, maxStalledCount: 0, workerConcurrency: 1, completedTtlSeconds: 0, failedTtlSeconds: 0 }),
    getAsyncQueueSummary: async () => ({}) as never,
    submitPipelineJob: async () => {
      counters.submit += 1;
      return { jobId: `job-${counters.submit}` };
    },
    getTenantPipelineRateLimit: async () => ({
      tenantId: tenant.tenantId,
      planId: tenant.planId,
      limit: 10,
      remaining: 9,
      resetAt: '2026-05-21T00:01:00.000Z',
      retryAfterSeconds: null,
    }) as never,
    inProcessTenantQueueSnapshot: () => ({
      pendingJobs: 0,
      pendingLimit: 10,
      enforced: true,
      activeExecutions: 0,
      activeExecutionLimit: 1,
      activeExecutionEnforced: true,
      activeExecutionBackend: 'memory',
      weightedDispatchEnforced: false,
      weightedDispatchBackend: 'memory',
      weightedDispatchWeight: null,
      weightedDispatchWindowMs: null,
      weightedDispatchNextEligibleAt: null,
      weightedDispatchWaitMs: 0,
    }),
    inProcessJobs: new Map(),
    pki: { signer: { keyPair: {} as never } },
    pipelineDeadLetterService: { record: async () => ({}) } as never,
    getJobStatus: async () => ({ status: 'not_found', result: null, error: null, submittedAt: null, attemptsMade: 0, maxAttempts: 1, tenant: null, failedAt: null }),
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

async function testSyncPipelineReplayReturnsSameRunAndConsumesOnce(): Promise<void> {
  const restore = withEnv();
  try {
    const counters = { consume: 0, run: 0 };
    const app = new Hono();
    registerPipelineExecutionRoutes(app, executionDeps(counters));
    const request = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'pipeline-sync-1' },
      body: JSON.stringify({ candidateSql: 'select 1', intent: 'approve test query' }),
    };

    const first = await app.request('/api/v1/pipeline/run', request);
    const second = await app.request('/api/v1/pipeline/run', request);
    const firstBody = await readJson(first);
    const secondBody = await readJson(second);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get('x-attestor-idempotent-replay'), 'true');
    assert.equal(secondBody.runId, firstBody.runId);
    assert.equal(counters.run, 1);
    assert.equal(counters.consume, 1);
  } finally {
    restore();
  }
}

async function testPipelineIdempotencyConflictRejectsDifferentPayload(): Promise<void> {
  const restore = withEnv();
  try {
    const counters = { consume: 0, run: 0 };
    const app = new Hono();
    registerPipelineExecutionRoutes(app, executionDeps(counters));

    const first = await app.request('/api/v1/pipeline/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'pipeline-conflict-1' },
      body: JSON.stringify({ candidateSql: 'select 1', intent: 'approve test query' }),
    });
    const second = await app.request('/api/v1/pipeline/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'pipeline-conflict-1' },
      body: JSON.stringify({ candidateSql: 'select 2', intent: 'approve test query' }),
    });

    assert.equal(first.status, 200);
    assert.equal(second.status, 409);
    assert.equal(counters.run, 1);
    assert.equal(counters.consume, 1);
  } finally {
    restore();
  }
}

async function testPipelineIdempotencyConfigFailsBeforeSideEffects(): Promise<void> {
  const restore = withMissingIdempotencyEncryptionEnv();
  try {
    const counters = { consume: 0, run: 0 };
    const app = new Hono();
    registerPipelineExecutionRoutes(app, executionDeps(counters));

    const response = await app.request('/api/v1/pipeline/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'pipeline-missing-key' },
      body: JSON.stringify({ candidateSql: 'select 1', intent: 'approve test query' }),
    });
    const body = await readJson(response);

    assert.equal(response.status, 503);
    assert.equal(body.error, 'Pipeline idempotency store is not configured.');
    assert.equal(counters.run, 0);
    assert.equal(counters.consume, 0);
  } finally {
    restore();
  }
}

async function testAsyncPipelineReplayReturnsSameJobAndConsumesOnce(): Promise<void> {
  const restore = withEnv();
  try {
    const counters = { consume: 0, submit: 0 };
    const app = new Hono();
    registerPipelineAsyncRoutes(app, asyncDeps(counters));
    const request = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'pipeline-async-1' },
      body: JSON.stringify({ candidateSql: 'select 1', intent: 'approve test query' }),
    };

    const first = await app.request('/api/v1/pipeline/run-async', request);
    const second = await app.request('/api/v1/pipeline/run-async', request);
    const firstBody = await readJson(first);
    const secondBody = await readJson(second);

    assert.equal(first.status, 202);
    assert.equal(second.status, 202);
    assert.equal(second.headers.get('x-attestor-idempotent-replay'), 'true');
    assert.equal(secondBody.jobId, firstBody.jobId);
    assert.equal(counters.consume, 1);
  } finally {
    restore();
  }
}

await testSyncPipelineReplayReturnsSameRunAndConsumesOnce();
await testPipelineIdempotencyConflictRejectsDifferentPayload();
await testPipelineIdempotencyConfigFailsBeforeSideEffects();
await testAsyncPipelineReplayReturnsSameJobAndConsumesOnce();

console.log('Service pipeline routes idempotency tests: 4 passed, 0 failed');
