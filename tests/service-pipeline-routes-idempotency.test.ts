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
import { resetPipelineIdempotencyStoreForTests } from '../src/service/pipeline/pipeline-idempotency-store.js';
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
    runFinancialPipeline: (input) => {
      counters.run += 1;
      return executionReport(input.runId);
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

async function testAsyncBullmqRetryAfterUsageFailureUsesIdempotentQueueClaim(): Promise<void> {
  const restore = withEnv();
  try {
    const counters = { consume: 0, submit: 0 };
    let consumeAttempts = 0;
    const submittedJobIds: string[] = [];
    const uniqueJobIds = new Set<string>();
    const baseUsageService = usageService(counters);
    const app = new Hono();
    const deps = asyncDeps(counters);
    const tenantSnapshot = {
      tenantId: tenant.tenantId,
      planId: tenant.planId,
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
      scanLimit: 100,
      scanTruncated: false,
      states: {
        waiting: 0,
        active: 0,
        delayed: 0,
        prioritized: 0,
        failed: 0,
      },
    } as const;
    deps.asyncBackendMode = 'bullmq';
    deps.bullmqQueue = {} as never;
    deps.canEnqueueTenantAsyncJob = async () => ({ allowed: true, snapshot: tenantSnapshot }) as never;
    deps.getAsyncQueueSummary = async () => ({
      queueName: 'attestor-pipeline',
      backend: 'bullmq',
      counts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        prioritized: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      },
      retryPolicy: deps.getAsyncRetryPolicy(),
      tenant: tenantSnapshot,
    }) as never;
    deps.pipelineUsageService = {
      check: baseUsageService.check,
      async consume(input) {
        consumeAttempts += 1;
        if (consumeAttempts === 1) {
          throw new Error('usage ledger unavailable after async queue admission');
        }
        return baseUsageService.consume(input);
      },
    };
    deps.submitPipelineJob = async (_queue, _input, _tenant, _sign, options) => {
      const jobId = options?.jobId ?? `job-${submittedJobIds.length + 1}`;
      submittedJobIds.push(jobId);
      uniqueJobIds.add(jobId);
      counters.submit = uniqueJobIds.size;
      return { jobId };
    };
    registerPipelineAsyncRoutes(app, deps);
    const request = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'pipeline-async-usage-failure' },
      body: JSON.stringify({ candidateSql: 'select 1', intent: 'approve test query' }),
    };

    const first = await app.request('/api/v1/pipeline/run-async', request);
    const second = await app.request('/api/v1/pipeline/run-async', request);
    const secondBody = await readJson(second);

    assert.equal(first.status, 500);
    assert.equal(second.status, 202);
    assert.equal(submittedJobIds.length, 2);
    assert.equal(uniqueJobIds.size, 1);
    assert.equal(counters.submit, 1);
    assert.equal(counters.consume, 1);
    assert.equal(secondBody.jobId, submittedJobIds[0]);
    assert.match(String(secondBody.jobId), /^tenant_pipeline_idem__idem_[0-9a-f]{32}$/u);
    assert(!String(secondBody.jobId).includes('pipeline-async-usage-failure'));
  } finally {
    restore();
  }
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
    assert.match(String(firstBody.runId), /^api-[0-9a-f-]{36}$/u);
    assert.equal(counters.run, 1);
    assert.equal(counters.consume, 1);
  } finally {
    restore();
  }
}

async function testPipelineRoutesRejectNonJsonMediaType(): Promise<void> {
  const restore = withEnv();
  try {
    const counters = { consume: 0, run: 0 };
    const app = new Hono();
    registerPipelineExecutionRoutes(app, executionDeps(counters));
    const response = await app.request('/api/v1/pipeline/run', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'not-json',
    });
    const body = await response.json() as { readonly error: string };

    assert.equal(response.status, 415);
    assert.equal(body.error, 'Pipeline route requires Content-Type: application/json.');
    assert.equal(counters.run, 0);
    assert.equal(counters.consume, 0);
  } finally {
    restore();
  }
}

async function testPipelineAsyncRouteRejectsNonJsonMediaType(): Promise<void> {
  const restore = withEnv();
  try {
    const counters = { consume: 0, submit: 0 };
    const app = new Hono();
    registerPipelineAsyncRoutes(app, asyncDeps(counters));
    const response = await app.request('/api/v1/pipeline/run-async', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'not-json',
    });
    const body = await response.json() as { readonly error: string };

    assert.equal(response.status, 415);
    assert.equal(body.error, 'Pipeline async route requires Content-Type: application/json.');
    assert.equal(counters.submit, 0);
    assert.equal(counters.consume, 0);
  } finally {
    restore();
  }
}

async function testAsyncPipelineRequiresIdempotencyKeyBeforeSideEffects(): Promise<void> {
  const restore = withEnv();
  try {
    const counters = { consume: 0, submit: 0 };
    const app = new Hono();
    registerPipelineAsyncRoutes(app, asyncDeps(counters));
    const response = await app.request('/api/v1/pipeline/run-async', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ candidateSql: 'select 1', intent: 'approve test query' }),
    });
    const body = await response.json() as { readonly error: string; readonly detail: string };

    assert.equal(response.status, 428);
    assert.equal(body.error, 'Pipeline async route requires Idempotency-Key before queue admission.');
    assert.match(body.detail, /before quota, rate-limit, or queue work/u);
    assert.equal(counters.submit, 0);
    assert.equal(counters.consume, 0);
  } finally {
    restore();
  }
}

async function testSyncPipelineRequiresIdempotencyKeyBeforeSideEffects(): Promise<void> {
  const restore = withEnv();
  try {
    const counters = { consume: 0, run: 0 };
    const app = new Hono();
    registerPipelineExecutionRoutes(app, executionDeps(counters));
    const response = await app.request('/api/v1/pipeline/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ candidateSql: 'select 1', intent: 'approve test query' }),
    });
    const body = await response.json() as { readonly error: string; readonly detail: string };

    assert.equal(response.status, 428);
    assert.equal(body.error, 'Pipeline route requires Idempotency-Key before execution.');
    assert.match(body.detail, /before quota, rate-limit, connector, signing, or pipeline work/u);
    assert.equal(counters.run, 0);
    assert.equal(counters.consume, 0);
  } finally {
    restore();
  }
}

async function testPipelineConnectorErrorDetailsAreRedacted(): Promise<void> {
  const restore = withEnv();
  try {
    const counters = { consume: 0, run: 0 };
    const app = new Hono();
    const deps = executionDeps(counters);
    deps.connectorRegistry = {
      get: () => ({
        loadConfig: () => ({ configured: true }),
        execute: async () => {
          throw new Error('connector failure at raw-host.example.invalid with raw_secret_must_not_escape');
        },
      }) as never,
      listIds: () => ['redaction-fixture'],
    };
    registerPipelineExecutionRoutes(app, deps);
    const response = await app.request('/api/v1/pipeline/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'pipeline-connector-redaction' },
      body: JSON.stringify({
        candidateSql: 'select 1',
        intent: 'approve test query',
        connector: 'redaction-fixture',
      }),
    });
    const text = await response.text();
    const body = JSON.parse(text) as { readonly detail: string; readonly proofMode: string };

    assert.equal(response.status, 502);
    assert.equal(body.detail, 'Connector execution failed before proof evidence could be collected.');
    assert.equal(body.proofMode, 'unavailable');
    assert.doesNotMatch(text, /raw_secret_must_not_escape|raw-host\.example\.invalid/u);
    assert.equal(counters.run, 0);
    assert.equal(counters.consume, 0);
  } finally {
    restore();
  }
}

async function testBodyReviewerFieldsDoNotCreateApprovalAuthority(): Promise<void> {
  const restore = withEnv();
  try {
    const counters = { consume: 0, run: 0 };
    const app = new Hono();
    const deps = executionDeps(counters);
    let pipelineInput: Record<string, unknown> | null = null;
    deps.createRequestSigners = () => ({
      signer: {
        signingKeyPair: { publicKeyPem: 'pipeline-test-public-key' },
        trustChain: null,
        caPublicKeyPem: null,
      },
      reviewer: {
        signingKeyPair: { publicKeyPem: 'reviewer-test-public-key' },
      },
    }) as never;
    deps.runFinancialPipeline = (input) => {
      pipelineInput = input as unknown as Record<string, unknown>;
      counters.run += 1;
      return executionReport(input.runId);
    };
    registerPipelineExecutionRoutes(app, deps);

    const response = await app.request('/api/v1/pipeline/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'pipeline-body-reviewer' },
      body: JSON.stringify({
        candidateSql: 'select 1',
        intent: 'approve test query',
        sign: true,
        reviewerName: 'Body Reviewer',
        reviewerRole: 'financial_reporting_manager',
      }),
    });
    const body = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(body.reviewerName, null);
    assert.equal((body.reviewerRequest as Record<string, unknown>).authorityBearing, false);
    assert.deepEqual(
      (body.reviewerRequest as Record<string, unknown>).reasonCodes,
      ['reviewer-identity-not-verified'],
    );
    assert.equal(pipelineInput?.approval, undefined);
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
await testPipelineRoutesRejectNonJsonMediaType();
await testPipelineAsyncRouteRejectsNonJsonMediaType();
await testAsyncPipelineRequiresIdempotencyKeyBeforeSideEffects();
await testSyncPipelineRequiresIdempotencyKeyBeforeSideEffects();
await testPipelineConnectorErrorDetailsAreRedacted();
await testBodyReviewerFieldsDoNotCreateApprovalAuthority();
await testPipelineIdempotencyConflictRejectsDifferentPayload();
await testPipelineIdempotencyConfigFailsBeforeSideEffects();
await testAsyncPipelineReplayReturnsSameJobAndConsumesOnce();
await testAsyncBullmqRetryAfterUsageFailureUsesIdempotentQueueClaim();

console.log('Service pipeline routes idempotency tests: 11 passed, 0 failed');
