import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
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
  type ShadowMutationAuditInput,
} from '../src/service/http/routes/shadow-routes.js';
import {
  createFileBackedShadowCustomerActivationReceiptStore,
  createFileBackedShadowPolicyCandidateStore,
  createFileBackedShadowPolicySimulationReportStore,
} from '../src/service/shadow-persistence-store.js';
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

function createApp(auditInputs: ShadowMutationAuditInput[]): Hono {
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
    now: () => '2026-05-21T09:10:00.000Z',
  });
  return app;
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

try {
  await testAllShadowRoutesHaveHttpCoverage();
  await testShadowMutationsEmitRedactedTenantAudit();
  await testMissingStoreAndJsonValidationRemainFailClosed();

  console.log(`Service shadow routes HTTP tests: ${passed} passed, 0 failed`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
