import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
  type ShadowAdmissionEvent,
  type ShadowCustomerActivationHandoff,
} from '../src/consequence-admission/index.js';
import {
  registerShadowRoutes,
  resetShadowMutationRateLimiterForTests,
  type ShadowMutationAuditInput,
} from '../src/service/http/routes/shadow-routes.js';
import {
  createFileBackedShadowCustomerActivationReceiptStore,
  createFileBackedShadowPolicyCandidateStore,
  createFileBackedShadowPolicySimulationReportStore,
} from '../src/service/shadow/shadow-persistence-store.js';
import { createPipelineIdempotencyService } from '../src/service/application/pipeline-idempotency-service.js';
import type { PipelineIdempotencyService } from '../src/service/application/pipeline-idempotency-service.js';
import {
  ensurePipelineIdempotencyStateReady,
  lookupPipelineIdempotencyState,
  recordPipelineIdempotencyState,
} from '../src/service/control-plane-store.js';
import { hashJsonValue } from '../src/service/json-stable.js';
import { resetPipelineIdempotencyStoreForTests } from '../src/service/pipeline/pipeline-idempotency-store.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_http',
  tenantName: 'Shadow HTTP Tenant',
  authenticatedAt: '2026-05-21T09:00:00.000Z',
  source: 'api_key',
  planId: 'community',
  monthlyRunQuota: 100,
};

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-service-shadow-routes-http-'));
const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;

function createEvent(index: number): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: `2026-05-21T09:0${index}:00.000Z`,
      decidedAt: `2026-05-21T09:0${index}:01.000Z`,
      recipient: 'raw_customer_marker_must_not_enter_audit',
      evidenceRefs: [`order:${index}`],
      policyRef: 'policy:refunds:v1',
      observedFeatures: {
        rawMarker: 'raw_feature_marker_must_not_enter_audit',
      },
    }),
    occurredAt: `2026-05-21T09:0${index}:02.000Z`,
    downstreamOutcome: 'proceeded',
    observedFeatures: {
      rawMarker: 'raw_feature_marker_must_not_enter_audit',
    },
  });
}

function createApp(
  auditInputs: ShadowMutationAuditInput[],
  options?: {
    readonly now?: () => string;
    readonly pipelineIdempotencyService?: PipelineIdempotencyService;
  },
): Hono {
  const simulationStore = createFileBackedShadowPolicySimulationReportStore({
    path: join(tempDir, `simulations-${auditInputs.length}-${Date.now()}.json`),
  });
  const candidateStore = createFileBackedShadowPolicyCandidateStore({
    path: join(tempDir, `candidates-${auditInputs.length}-${Date.now()}.json`),
  });
  const receiptStore = createFileBackedShadowCustomerActivationReceiptStore({
    path: join(tempDir, `receipts-${auditInputs.length}-${Date.now()}.json`),
  });
  const events = Array.from({ length: 5 }, (_, index) => createEvent(index + 1));
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => tenant,
    listShadowEvents: ({ tenant: routeTenant }) =>
      routeTenant.tenantId === tenant.tenantId ? events : [],
    listShadowSimulations: ({ tenant: routeTenant }) =>
      simulationStore.list({ tenantId: routeTenant.tenantId }).reports,
    recordShadowMutationAudit: async (input) => {
      auditInputs.push(input);
    },
    pipelineIdempotencyService: options?.pipelineIdempotencyService,
    recordShadowPolicySimulationReport: ({ tenant: routeTenant, report }) =>
      simulationStore.append({
        tenantId: routeTenant.tenantId,
        report,
      }),
    listShadowPolicySimulationReports: ({ tenant: routeTenant, proposedMode }) =>
      simulationStore.list({
        tenantId: routeTenant.tenantId,
        proposedMode,
      }).records,
    findShadowPolicySimulationReport: ({ tenant: routeTenant, reportId }) =>
      simulationStore.find({
        tenantId: routeTenant.tenantId,
        reportId,
      }).record,
    materializeShadowPolicyCandidates: ({ tenant: routeTenant, bundle }) =>
      candidateStore.upsertBundle({
        tenantId: routeTenant.tenantId,
        bundle,
      }),
    listShadowPolicyCandidateRecords: ({ tenant: routeTenant, status }) =>
      candidateStore.list({
        tenantId: routeTenant.tenantId,
        status,
      }).records,
    transitionShadowPolicyCandidateStatus: ({ tenant: routeTenant, candidateId, status, actorRef, reason }) =>
      candidateStore.transitionStatus({
        tenantId: routeTenant.tenantId,
        candidateId,
        status,
        actorRef,
        reason,
      }).record,
    recordShadowCustomerActivationReceipt: ({ tenant: routeTenant, receipt }) =>
      receiptStore.append({
        tenantId: routeTenant.tenantId,
        receipt,
      }),
    listShadowCustomerActivationReceiptRecords: ({ tenant: routeTenant, activationStatus, receiptReady, sourceHandoffDigest }) =>
      receiptStore.list({
        tenantId: routeTenant.tenantId,
        activationStatus,
        receiptReady,
        sourceHandoffDigest,
      }).records,
    findShadowCustomerActivationReceipt: ({ tenant: routeTenant, receiptId }) =>
      receiptStore.find({
        tenantId: routeTenant.tenantId,
        receiptId,
      }).record,
    now: options?.now ?? (() => '2026-05-21T09:10:00.000Z'),
  });
  return app;
}

function withPipelineIdempotencyEnv(): () => void {
  const previous = new Map<string, string | undefined>();
  const overrides: Record<string, string | undefined> = {
    ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY: 'shadow-mutation-idempotency-test-key',
    ATTESTOR_PIPELINE_IDEMPOTENCY_STORE_PATH: join(
      tmpdir(),
      `attestor-shadow-mutation-idempotency-${randomUUID()}.json`,
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
  resetPipelineIdempotencyStoreForTests();
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

function pipelineIdempotencyService(): PipelineIdempotencyService {
  return createPipelineIdempotencyService({
    hashJsonValue,
    ensurePipelineIdempotencyStateReady,
    lookupPipelineIdempotencyState,
    recordPipelineIdempotencyState,
  });
}

async function postJson(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function patchJson(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function proofBody() {
  return {
    enforcementPointId: 'refund-service/ext-authz',
    boundaryKind: 'http-handler',
    verifierRef: 'verifier:refund-service-ci',
    evidenceRefs: [
      {
        id: 'ci:run:shadow-http',
        kind: 'adapter-test',
        digest: digestA,
        uri: 'https://example.invalid/attestor/evidence/shadow-http',
      },
    ],
    observedVerificationChecks: SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
  };
}

function handoffBody() {
  return {
    ...proofBody(),
    activationRef: 'change:shadow-http',
    operatorRef: 'operator:shadow-http',
    rolloutStrategy: 'canary',
    rollbackRef: {
      id: 'runbook:rollback-shadow-http',
      kind: 'deployment-rollback',
      digest: digestB,
      uri: 'https://example.invalid/attestor/runbooks/rollback-shadow-http',
    },
    killSwitchRef: {
      id: 'flag:disable-shadow-http',
      kind: 'feature-flag-disable',
      digest: digestC,
      uri: 'https://example.invalid/attestor/flags/disable-shadow-http',
    },
    monitoringRef: {
      id: 'slo:shadow-http',
      kind: 'slo-alarm',
      digest: digestA,
      uri: 'https://example.invalid/attestor/alerts/shadow-http',
    },
    expiresAt: '2026-05-21T12:10:00.000Z',
  };
}

async function seedShadowState(app: Hono): Promise<{
  readonly reportId: string;
  readonly candidateId: string;
  readonly handoff: ShadowCustomerActivationHandoff;
  readonly receiptId: string;
}> {
  const simulationResponse = await postJson(app, '/api/v1/shadow/simulations', {
    proposedMode: 'review',
  });
  const simulation = await simulationResponse.json() as {
    readonly persisted: { readonly record: { readonly reportId: string } };
  };

  const materializeResponse = await app.request('/api/v1/shadow/policy-candidates/materialize', {
    method: 'POST',
  });
  const materialize = await materializeResponse.json() as {
    readonly persisted: { readonly records: readonly { readonly candidateId: string }[] };
  };
  const candidateId = materialize.persisted.records[0]?.candidateId ?? '';

  await patchJson(app, `/api/v1/shadow/policy-candidates/${encodeURIComponent(candidateId)}/status`, {
    status: 'proposed',
    actorRef: 'operator:shadow-http',
    reason: 'Move candidate to proposed for route coverage.',
  });
  await patchJson(app, `/api/v1/shadow/policy-candidates/${encodeURIComponent(candidateId)}/status`, {
    status: 'approved',
    actorRef: 'operator:shadow-http',
    reason: 'Move candidate to approved for route coverage.',
  });

  const handoffResponse = await postJson(
    app,
    '/api/v1/shadow/customer-activation-handoff?status=approved',
    handoffBody(),
  );
  const handoff = await handoffResponse.json() as {
    readonly handoff: ShadowCustomerActivationHandoff;
  };

  const receiptResponse = await postJson(app, '/api/v1/shadow/customer-activation-receipt', {
    handoff: handoff.handoff,
    activationStatus: 'activated',
    attemptedAt: '2026-05-21T09:11:00.000Z',
    observedAt: '2026-05-21T09:12:00.000Z',
    completedAt: '2026-05-21T09:13:00.000Z',
    activationDigest: digestB,
    externalReceiptDigest: digestC,
    rollbackStatus: 'not-triggered',
    killSwitchStatus: 'verified',
    monitoringStatus: 'healthy',
  });
  const receipt = await receiptResponse.json() as {
    readonly receipt: { readonly receiptId: string };
  };

  return {
    reportId: simulation.persisted.record.reportId,
    candidateId,
    handoff: handoff.handoff,
    receiptId: receipt.receipt.receiptId,
  };
}

async function testAllShadowRoutesHaveHttpCoverage(): Promise<void> {
  const auditInputs: ShadowMutationAuditInput[] = [];
  const app = createApp(auditInputs);
  const seeded = await seedShadowState(app);

  const requests: readonly [string, Promise<Response>][] = [
    ['GET /summary', app.request('/api/v1/shadow/summary')],
    ['GET /recommendations', app.request('/api/v1/shadow/recommendations')],
    ['GET /action-risk-inventory', app.request('/api/v1/shadow/action-risk-inventory')],
    ['GET /audit-evidence', app.request('/api/v1/shadow/audit-evidence')],
    ['GET /business-risk-dashboard', app.request('/api/v1/shadow/business-risk-dashboard')],
    ['GET /dashboard-summary', app.request('/api/v1/shadow/dashboard-summary')],
    ['POST /simulations', postJson(app, '/api/v1/shadow/simulations', { proposedMode: 'review' })],
    ['GET /simulations', app.request('/api/v1/shadow/simulations')],
    ['GET /simulations/:reportId', app.request(`/api/v1/shadow/simulations/${encodeURIComponent(seeded.reportId)}`)],
    ['GET /policy-candidates', app.request('/api/v1/shadow/policy-candidates')],
    ['GET /policy-foundry/readiness', app.request('/api/v1/shadow/policy-foundry/readiness')],
    ['GET /policy-foundry/active-questions', app.request('/api/v1/shadow/policy-foundry/active-questions')],
    ['GET /policy-foundry/red-team-replay', app.request('/api/v1/shadow/policy-foundry/red-team-replay')],
    ['POST /policy-candidates/materialize', app.request('/api/v1/shadow/policy-candidates/materialize', { method: 'POST' })],
    ['GET /policy-candidate-records', app.request('/api/v1/shadow/policy-candidate-records')],
    ['GET /policy-promotion-draft', app.request('/api/v1/shadow/policy-promotion-draft')],
    ['GET /policy-promotion-packet', app.request('/api/v1/shadow/policy-promotion-packet')],
    ['GET /policy-promotion-simulation', app.request('/api/v1/shadow/policy-promotion-simulation')],
    ['GET /policy-bundle-publication', app.request('/api/v1/shadow/policy-bundle-publication')],
    ['GET /downstream-verification-binding', app.request('/api/v1/shadow/downstream-verification-binding')],
    ['POST /downstream-integration-proof', postJson(app, '/api/v1/shadow/downstream-integration-proof', proofBody())],
    ['POST /activation-readiness', postJson(app, '/api/v1/shadow/activation-readiness', proofBody())],
    ['POST /customer-activation-handoff', postJson(app, '/api/v1/shadow/customer-activation-handoff?status=approved', handoffBody())],
    ['POST /customer-activation-receipt', postJson(app, '/api/v1/shadow/customer-activation-receipt', {
      handoff: seeded.handoff,
      activationStatus: 'activated',
      attemptedAt: '2026-05-21T09:21:00.000Z',
      observedAt: '2026-05-21T09:22:00.000Z',
      completedAt: '2026-05-21T09:23:00.000Z',
      activationDigest: digestB,
      externalReceiptDigest: digestC,
      rollbackStatus: 'not-triggered',
      killSwitchStatus: 'verified',
      monitoringStatus: 'healthy',
    })],
    ['GET /customer-activation-receipts', app.request('/api/v1/shadow/customer-activation-receipts')],
    [
      'GET /customer-activation-receipts/:receiptId',
      app.request(`/api/v1/shadow/customer-activation-receipts/${encodeURIComponent(seeded.receiptId)}`),
    ],
    [
      'PATCH /policy-candidates/:candidateId/status',
      patchJson(app, `/api/v1/shadow/policy-candidates/${encodeURIComponent(seeded.candidateId)}/status`, {
        status: 'activated',
        actorRef: 'operator:shadow-http',
        reason: 'Move candidate to activated for route coverage.',
      }),
    ],
  ];

  equal(requests.length, 27, 'Shadow routes HTTP coverage: all 27 routes are exercised');
  for (const [name, request] of requests) {
    const response = await request;
    ok(response.status !== 404, `Shadow routes HTTP coverage: ${name} is registered`);
    equal(response.headers.get('cache-control'), 'no-store', `Shadow routes HTTP coverage: ${name} is no-store`);
  }
}

async function testShadowMutationsEmitRedactedTenantAudit(): Promise<void> {
  const auditInputs: ShadowMutationAuditInput[] = [];
  const app = createApp(auditInputs);
  await seedShadowState(app);
  await postJson(app, '/api/v1/shadow/downstream-integration-proof', proofBody());
  await postJson(app, '/api/v1/shadow/activation-readiness', proofBody());

  const routeIds = auditInputs.map((input) => input.routeId);
  for (const routeId of [
    'shadow.simulations.create',
    'shadow.policy_candidates.materialize',
    'shadow.policy_candidates.status.update',
    'shadow.downstream_integration_proof.create',
    'shadow.activation_readiness.create',
    'shadow.customer_activation_handoff.create',
    'shadow.customer_activation_receipt.create',
  ]) {
    ok(routeIds.includes(routeId), `Shadow mutation audit: ${routeId} emits audit`);
  }

  for (const input of auditInputs) {
    equal(input.tenant.tenantId, tenant.tenantId, `Shadow mutation audit: ${input.routeId} is tenant-bound`);
    equal(input.statusCode, 200, `Shadow mutation audit: ${input.routeId} records successful status`);
  }
  const auditJson = JSON.stringify(auditInputs);
  ok(!auditJson.includes('raw_customer_marker_must_not_enter_audit'), 'Shadow mutation audit: raw customer marker is not audited');
  ok(!auditJson.includes('raw_feature_marker_must_not_enter_audit'), 'Shadow mutation audit: raw feature marker is not audited');
}

async function testMissingStoreAndJsonValidationRemainFailClosed(): Promise<void> {
  const auditInputs: ShadowMutationAuditInput[] = [];
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => tenant,
    listShadowEvents: () => [],
    recordShadowMutationAudit: async (input) => {
      auditInputs.push(input);
    },
    now: () => '2026-05-21T09:10:00.000Z',
  });

  const missingStore = await postJson(app, '/api/v1/shadow/simulations', { proposedMode: 'review' });
  const badContentType = await app.request('/api/v1/shadow/simulations', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'not-json',
  });
  const badBody = await app.request('/api/v1/shadow/simulations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not-json',
  });

  equal(missingStore.status, 503, 'Shadow routes HTTP coverage: missing simulation store fails closed');
  equal(badContentType.status, 415, 'Shadow routes HTTP coverage: non-JSON body returns unsupported media type');
  equal(badBody.status, 400, 'Shadow routes HTTP coverage: malformed JSON body is rejected');
  equal(auditInputs.length, 0, 'Shadow routes HTTP coverage: failed mutations do not write success audit');
}

async function testShadowMutationRateLimitIsTenantRouteScoped(): Promise<void> {
  const previousLimit = process.env.ATTESTOR_SHADOW_MUTATION_RATE_LIMIT_PER_MINUTE;
  process.env.ATTESTOR_SHADOW_MUTATION_RATE_LIMIT_PER_MINUTE = '1';
  resetShadowMutationRateLimiterForTests();
  try {
    const auditInputs: ShadowMutationAuditInput[] = [];
    const app = createApp(auditInputs);
    const firstSimulation = await postJson(app, '/api/v1/shadow/simulations', { proposedMode: 'review' });
    const secondSimulation = await postJson(app, '/api/v1/shadow/simulations', { proposedMode: 'review' });
    const materialize = await app.request('/api/v1/shadow/policy-candidates/materialize', {
      method: 'POST',
    });
    const problem = await secondSimulation.json() as { readonly detail: string; readonly reasonCodes: readonly string[] };

    equal(firstSimulation.status, 200, 'Shadow mutation rate limit: first same-route mutation is allowed');
    equal(secondSimulation.status, 429, 'Shadow mutation rate limit: second same-route mutation is rejected');
    equal(materialize.status, 200, 'Shadow mutation rate limit: separate route scope remains available');
    equal(secondSimulation.headers.get('retry-after') !== null, true, 'Shadow mutation rate limit: 429 includes Retry-After');
    equal(problem.reasonCodes.includes('shadow-mutation-rate-limit-exceeded'), true, 'Shadow mutation rate limit: bounded reason code is returned');
    equal(
      auditInputs.filter((input) => input.routeId === 'shadow.simulations.create').length,
      1,
      'Shadow mutation rate limit: rejected retry does not write success audit',
    );
    const routeSource = [
      readFileSync('src/service/http/routes/shadow-routes.ts', 'utf8'),
      readFileSync('src/service/http/routes/shadow-simulation-history-routes.ts', 'utf8'),
      readFileSync('src/service/http/routes/shadow-policy-foundry-promotion-routes.ts', 'utf8'),
    ].join('\n');
    for (const routeId of [
      'shadow.simulations.create',
      'shadow.policy_candidates.materialize',
      'shadow.policy_candidates.status.update',
      'shadow.downstream_integration_proof.create',
      'shadow.activation_readiness.create',
      'shadow.customer_activation_handoff.create',
      'shadow.customer_activation_receipt.create',
    ]) {
      ok(
        routeSource.includes(`beginShadowMutationIdempotency(c, deps, routeId, requestPayload);`) &&
          routeSource.includes(`const routeId = '${routeId}';`),
        `Shadow mutation idempotency/rate limit: ${routeId} is wired through the route-scoped guard`,
      );
    }
  } finally {
    if (previousLimit === undefined) {
      delete process.env.ATTESTOR_SHADOW_MUTATION_RATE_LIMIT_PER_MINUTE;
    } else {
      process.env.ATTESTOR_SHADOW_MUTATION_RATE_LIMIT_PER_MINUTE = previousLimit;
    }
    resetShadowMutationRateLimiterForTests();
  }
}

async function testShadowSimulationReplaysWithIdempotencyKey(): Promise<void> {
  const restoreEnv = withPipelineIdempotencyEnv();
  const previousLimit = process.env.ATTESTOR_SHADOW_MUTATION_RATE_LIMIT_PER_MINUTE;
  process.env.ATTESTOR_SHADOW_MUTATION_RATE_LIMIT_PER_MINUTE = '1';
  resetShadowMutationRateLimiterForTests();
  try {
    const auditInputs: ShadowMutationAuditInput[] = [];
    const app = createApp(auditInputs, {
      pipelineIdempotencyService: pipelineIdempotencyService(),
    });
    const body = { proposedMode: 'review' };
    const headers = {
      'content-type': 'application/json',
      'Idempotency-Key': 'shadow-simulation-idempotent-replay',
    };

    const first = await app.request('/api/v1/shadow/simulations', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const replay = await app.request('/api/v1/shadow/simulations', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const firstBody = await first.json();
    const replayBody = await replay.json();
    const list = await app.request('/api/v1/shadow/simulations');
    const listed = await list.json() as { readonly recordCount: number };

    equal(first.status, 200, 'Shadow mutation idempotency: first simulation mutation succeeds');
    equal(replay.status, 200, 'Shadow mutation idempotency: same-key retry replays');
    deepEqual(replayBody, firstBody, 'Shadow mutation idempotency: replay response body is stored response');
    equal(replay.headers.get('x-attestor-idempotent-replay'), 'true', 'Shadow mutation idempotency: replay header is set');
    equal(replay.headers.get('x-attestor-idempotency-key'), null, 'Shadow mutation idempotency: replay does not echo raw key');
    equal(listed.recordCount, 1, 'Shadow mutation idempotency: replay does not duplicate persistence');
    equal(
      auditInputs.filter((input) => input.routeId === 'shadow.simulations.create').length,
      1,
      'Shadow mutation idempotency: replay does not duplicate audit',
    );
  } finally {
    if (previousLimit === undefined) {
      delete process.env.ATTESTOR_SHADOW_MUTATION_RATE_LIMIT_PER_MINUTE;
    } else {
      process.env.ATTESTOR_SHADOW_MUTATION_RATE_LIMIT_PER_MINUTE = previousLimit;
    }
    resetShadowMutationRateLimiterForTests();
    restoreEnv();
  }
}

async function testShadowSimulationRejectsIdempotencyConflicts(): Promise<void> {
  const restoreEnv = withPipelineIdempotencyEnv();
  try {
    const auditInputs: ShadowMutationAuditInput[] = [];
    const app = createApp(auditInputs, {
      pipelineIdempotencyService: pipelineIdempotencyService(),
    });
    const key = 'shadow-simulation-idempotent-conflict';
    const headers = {
      'content-type': 'application/json',
      'Idempotency-Key': key,
    };
    const first = await app.request('/api/v1/shadow/simulations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ proposedMode: 'review' }),
    });
    const conflict = await app.request('/api/v1/shadow/simulations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ proposedMode: 'warn' }),
    });
    const conflictBody = await conflict.json() as { readonly reasonCodes: readonly string[] };
    const conflictText = JSON.stringify(conflictBody);

    equal(first.status, 200, 'Shadow mutation idempotency conflict: first request succeeds');
    equal(conflict.status, 409, 'Shadow mutation idempotency conflict: same-key different-body request is rejected');
    equal(
      conflictBody.reasonCodes.includes('shadow-mutation-idempotency-conflict'),
      true,
      'Shadow mutation idempotency conflict: bounded conflict reason is returned',
    );
    equal(conflict.headers.get('x-attestor-idempotency-key'), null, 'Shadow mutation idempotency conflict: raw key is not echoed in headers');
    ok(!conflictText.includes(key), 'Shadow mutation idempotency conflict: raw key is not echoed in body');
    equal(
      auditInputs.filter((input) => input.routeId === 'shadow.simulations.create').length,
      1,
      'Shadow mutation idempotency conflict: rejected conflict does not duplicate audit',
    );
  } finally {
    restoreEnv();
  }
}

async function testShadowListRoutesApplyPaginationBounds(): Promise<void> {
  const auditInputs: ShadowMutationAuditInput[] = [];
  let tick = 0;
  const app = createApp(auditInputs, {
    now: () => `2026-05-21T09:${String(10 + tick++).padStart(2, '0')}:00.000Z`,
  });
  const seeded = await seedShadowState(app);
  await postJson(app, '/api/v1/shadow/simulations', { proposedMode: 'review', minimumPromotionEvents: 6 });
  await postJson(app, '/api/v1/shadow/simulations', { proposedMode: 'review', minimumPromotionEvents: 7 });
  await postJson(app, '/api/v1/shadow/customer-activation-receipt', {
    handoff: seeded.handoff,
    activationStatus: 'activated',
    attemptedAt: '2026-05-21T09:31:00.000Z',
    observedAt: '2026-05-21T09:32:00.000Z',
    completedAt: '2026-05-21T09:33:00.000Z',
    activationDigest: digestB,
    externalReceiptDigest: digestC,
    rollbackStatus: 'not-triggered',
    killSwitchStatus: 'verified',
    monitoringStatus: 'healthy',
  });

  const simulationResponse = await app.request('/api/v1/shadow/simulations?limit=2');
  const simulationPage = await simulationResponse.json() as {
    readonly recordCount: number;
    readonly records: readonly unknown[];
    readonly pageInfo: { readonly limit: number; readonly hasMore: boolean; readonly nextCursor: string | null; readonly totalRecordCount: number };
  };
  const simulationNextResponse = await app.request(`/api/v1/shadow/simulations?limit=2&cursor=${simulationPage.pageInfo.nextCursor ?? ''}`);
  const simulationNextPage = await simulationNextResponse.json() as {
    readonly recordCount: number;
    readonly pageInfo: { readonly cursor: string | null; readonly hasMore: boolean };
  };
  const policyCandidatesResponse = await app.request('/api/v1/shadow/policy-candidates?limit=1');
  const policyCandidates = await policyCandidatesResponse.json() as {
    readonly candidateCount: number;
    readonly returnedCandidateCount: number;
    readonly candidates: readonly unknown[];
    readonly pageInfo: { readonly limit: number; readonly hasMore: boolean; readonly totalRecordCount: number };
  };
  const candidateRecordsResponse = await app.request('/api/v1/shadow/policy-candidate-records?limit=1');
  const candidateRecords = await candidateRecordsResponse.json() as {
    readonly recordCount: number;
    readonly pageInfo: { readonly limit: number; readonly totalRecordCount: number };
  };
  const receiptsResponse = await app.request('/api/v1/shadow/customer-activation-receipts?limit=1');
  const receipts = await receiptsResponse.json() as {
    readonly recordCount: number;
    readonly pageInfo: { readonly limit: number; readonly hasMore: boolean; readonly totalRecordCount: number };
  };
  const invalidLimit = await app.request('/api/v1/shadow/simulations?limit=1000');

  equal(simulationResponse.status, 200, 'Shadow list pagination: simulations accept bounded limit');
  equal(simulationPage.recordCount, 2, 'Shadow list pagination: simulations return the requested page size');
  equal(simulationPage.records.length, 2, 'Shadow list pagination: simulations records are sliced');
  equal(simulationPage.pageInfo.limit, 2, 'Shadow list pagination: simulations report limit');
  equal(simulationPage.pageInfo.hasMore, true, 'Shadow list pagination: simulations report more pages');
  equal(simulationPage.pageInfo.totalRecordCount >= 3, true, 'Shadow list pagination: simulations report total count');
  equal(simulationNextPage.pageInfo.cursor, '2', 'Shadow list pagination: cursor advances by offset');
  equal(simulationNextPage.recordCount >= 1, true, 'Shadow list pagination: cursor returns remaining simulations');
  equal(policyCandidatesResponse.status, 200, 'Shadow list pagination: policy candidates accept bounded limit');
  equal(policyCandidates.returnedCandidateCount, 1, 'Shadow list pagination: policy candidates are sliced');
  equal(policyCandidates.candidates.length, 1, 'Shadow list pagination: candidate list length matches returned count');
  equal(policyCandidates.pageInfo.totalRecordCount, policyCandidates.candidateCount, 'Shadow list pagination: candidate total count is preserved');
  equal(candidateRecordsResponse.status, 200, 'Shadow list pagination: candidate records accept bounded limit');
  equal(candidateRecords.recordCount, 1, 'Shadow list pagination: candidate records are sliced');
  equal(candidateRecords.pageInfo.limit, 1, 'Shadow list pagination: candidate records report limit');
  equal(receiptsResponse.status, 200, 'Shadow list pagination: activation receipts accept bounded limit');
  equal(receipts.recordCount, 1, 'Shadow list pagination: activation receipts are sliced');
  equal(receipts.pageInfo.hasMore, true, 'Shadow list pagination: activation receipts report more pages');
  equal(receipts.pageInfo.totalRecordCount >= 2, true, 'Shadow list pagination: activation receipts report total count');
  equal(invalidLimit.status, 400, 'Shadow list pagination: oversized limit is rejected');
}

async function testShadowProblemDetailsAreBounded(): Promise<void> {
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => tenant,
    listShadowEvents: () => {
      throw new Error('raw downstream store failure sk_live_shadow_secret_marker');
    },
    listShadowPolicySimulationReports: () => {
      throw new Error('database url postgres://shadow:secret@example.invalid/db');
    },
    now: () => '2026-05-21T09:10:00.000Z',
  });

  const summary = await app.request('/api/v1/shadow/summary');
  const summaryProblem = await summary.json() as { readonly detail: string };
  const simulations = await app.request('/api/v1/shadow/simulations');
  const simulationsProblem = await simulations.json() as { readonly detail: string };
  const combined = JSON.stringify([summaryProblem, simulationsProblem]);

  equal(summary.status, 503, 'Shadow problem detail redaction: summary failures remain fail-closed');
  equal(simulations.status, 503, 'Shadow problem detail redaction: listing failures remain fail-closed');
  ok(!combined.includes('sk_live_shadow_secret_marker'), 'Shadow problem detail redaction: raw secret-shaped message is not echoed');
  ok(!combined.includes('postgres://shadow:secret@example.invalid/db'), 'Shadow problem detail redaction: raw store URL is not echoed');
  equal(summaryProblem.detail, 'The shadow summary could not be evaluated.', 'Shadow problem detail redaction: summary detail is bounded');
  equal(simulationsProblem.detail, 'The shadow simulation reports could not be listed.', 'Shadow problem detail redaction: list detail is bounded');
}

try {
  await testAllShadowRoutesHaveHttpCoverage();
  await testShadowMutationsEmitRedactedTenantAudit();
  await testMissingStoreAndJsonValidationRemainFailClosed();
  await testShadowMutationRateLimitIsTenantRouteScoped();
  await testShadowSimulationReplaysWithIdempotencyKey();
  await testShadowSimulationRejectsIdempotencyConflicts();
  await testShadowListRoutesApplyPaginationBounds();
  await testShadowProblemDetailsAreBounded();

  console.log(`Service shadow routes HTTP tests: ${passed} passed, 0 failed`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
