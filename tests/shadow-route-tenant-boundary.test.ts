import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import { registerShadowRoutes, type ShadowRouteDeps } from '../src/service/http/routes/shadow-routes.js';
import type {
  AppendShadowCustomerActivationReceiptResult,
  AppendShadowPolicySimulationReportResult,
  ShadowCustomerActivationReceiptStoreRecord,
  ShadowPolicyCandidateStoreRecord,
  ShadowPolicySimulationReportStoreRecord,
  UpsertShadowPolicyCandidateBundleResult,
} from '../src/service/shadow/shadow-persistence-store.js';
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

const tenantA: TenantContext = {
  tenantId: 'tenant_route_a',
  tenantName: 'Route Tenant A',
  authenticatedAt: '2026-05-05T08:00:00.000Z',
  source: 'api_key',
  planId: 'community',
  monthlyRunQuota: 100,
};

const tenantB: TenantContext = {
  ...tenantA,
  tenantId: 'tenant_route_b',
  tenantName: 'Route Tenant B',
};

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const digestE = `sha256:${'e'.repeat(64)}`;
const digestF = `sha256:${'f'.repeat(64)}`;

function createEvent(tenantId: string): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId,
      requestedAt: '2026-05-05T08:01:00.000Z',
      decidedAt: '2026-05-05T08:01:01.000Z',
    }),
    occurredAt: '2026-05-05T08:01:02.000Z',
  });
}

function createApp(overrides: Partial<ShadowRouteDeps>): Hono {
  const app = new Hono();
  const deps: ShadowRouteDeps = {
    currentTenant: () => tenantA,
    listShadowEvents: () => [],
    now: () => '2026-05-05T08:02:00.000Z',
    ...overrides,
  };
  registerShadowRoutes(app, deps);
  return app;
}

function foreignSimulationRecord(): ShadowPolicySimulationReportStoreRecord {
  return { tenantId: tenantB.tenantId } as unknown as ShadowPolicySimulationReportStoreRecord;
}

function foreignCandidateRecord(): ShadowPolicyCandidateStoreRecord {
  return { tenantId: tenantB.tenantId } as unknown as ShadowPolicyCandidateStoreRecord;
}

function foreignReceiptRecord(): ShadowCustomerActivationReceiptStoreRecord {
  return { tenantId: tenantB.tenantId } as unknown as ShadowCustomerActivationReceiptStoreRecord;
}

async function expectTenantBoundaryFailure(
  response: Response,
  message: string,
): Promise<void> {
  const text = await response.text();
  const body = JSON.parse(text) as { readonly detail?: unknown };
  equal(response.status, 503, `${message}: fails closed`);
  ok(
    typeof body.detail === 'string' && body.detail.includes('tenant boundary violation'),
    `${message}: explains tenant boundary violation`,
  );
  ok(!text.includes(tenantB.tenantId), `${message}: does not disclose the foreign tenant id`);
}

async function testSummaryRejectsForeignAdmissionEvents(): Promise<void> {
  const app = createApp({
    listShadowEvents: () => [createEvent(tenantB.tenantId)],
  });

  await expectTenantBoundaryFailure(
    await app.request('/api/v1/shadow/summary'),
    'Shadow tenant boundary route guard: summary rejects foreign admission events',
  );
}

async function testSimulationHistoryRejectsForeignRecords(): Promise<void> {
  const app = createApp({
    listShadowPolicySimulationReports: () => [foreignSimulationRecord()],
  });

  await expectTenantBoundaryFailure(
    await app.request('/api/v1/shadow/simulations'),
    'Shadow tenant boundary route guard: simulation list rejects foreign records',
  );
}

async function testSimulationLookupRejectsForeignRecord(): Promise<void> {
  const app = createApp({
    findShadowPolicySimulationReport: () => foreignSimulationRecord(),
  });

  await expectTenantBoundaryFailure(
    await app.request('/api/v1/shadow/simulations/report_foreign'),
    'Shadow tenant boundary route guard: simulation lookup rejects foreign records',
  );
}

async function testPolicyCandidateMaterializeRejectsForeignRecords(): Promise<void> {
  const app = createApp({
    materializeShadowPolicyCandidates: () => ({
      records: [foreignCandidateRecord()],
      createdCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
      path: null,
    }) as unknown as UpsertShadowPolicyCandidateBundleResult,
  });

  await expectTenantBoundaryFailure(
    await app.request('/api/v1/shadow/policy-candidates/materialize', { method: 'POST' }),
    'Shadow tenant boundary route guard: candidate materialization rejects foreign records',
  );
}

async function testPolicyCandidateListRejectsForeignRecords(): Promise<void> {
  const app = createApp({
    listShadowPolicyCandidateRecords: () => [foreignCandidateRecord()],
  });

  await expectTenantBoundaryFailure(
    await app.request('/api/v1/shadow/policy-candidate-records'),
    'Shadow tenant boundary route guard: candidate list rejects foreign records',
  );
}

async function testPolicyCandidateTransitionRejectsForeignRecord(): Promise<void> {
  const app = createApp({
    transitionShadowPolicyCandidateStatus: () => foreignCandidateRecord(),
  });

  await expectTenantBoundaryFailure(
    await app.request('/api/v1/shadow/policy-candidates/candidate_foreign/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'proposed',
        actorRef: 'risk-owner:1',
        reason: 'Route guard test.',
      }),
    }),
    'Shadow tenant boundary route guard: candidate transition rejects foreign records',
  );
}

async function testCustomerActivationReceiptCreateRejectsForeignPersistedRecord(): Promise<void> {
  const app = createApp({
    recordShadowCustomerActivationReceipt: () => ({
      kind: 'recorded',
      record: foreignReceiptRecord(),
      path: null,
    }) as unknown as AppendShadowCustomerActivationReceiptResult,
  });

  await expectTenantBoundaryFailure(
    await app.request('/api/v1/shadow/customer-activation-receipt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        handoff: {
          version: 'attestor.shadow-customer-activation-handoff.v1',
          tenantId: tenantA.tenantId,
          handoffId: 'handoff_tenant_route',
          digest: digestA,
          sourceActivationReadinessDigest: digestB,
          sourceIntegrationProofDigest: digestC,
          sourcePublicationDigest: digestD,
          sourceBindingDigest: digestE,
          sourceSimulationDigest: digestF,
          activationRef: 'activation:route',
          operatorRef: 'operator:route',
          rolloutStrategy: 'manual',
          expiresAt: null,
          controlRefs: [],
          controlDigest: digestA,
          customerControlsReady: true,
          activationReadinessReady: true,
          handoffReady: true,
          handoffInstruction: 'Customer controls are ready for manual activation.',
          remainingActivationBlockers: [],
          approvalRequired: true,
          autoEnforce: false,
          productionReady: false,
          generatedAt: '2026-05-05T08:02:00.000Z',
          rawPayloadStored: false,
          canonical: '{}',
        },
        activationStatus: 'activated',
        attemptedAt: '2026-05-05T08:03:00.000Z',
        observedAt: '2026-05-05T08:03:01.000Z',
        completedAt: '2026-05-05T08:03:02.000Z',
        activationDigest: digestB,
        externalReceiptDigest: digestC,
        rollbackStatus: 'not-triggered',
        killSwitchStatus: 'verified',
        monitoringStatus: 'healthy',
      }),
    }),
    'Shadow tenant boundary route guard: receipt create rejects foreign persisted records',
  );
}

async function testCustomerActivationReceiptListRejectsForeignRecords(): Promise<void> {
  const app = createApp({
    listShadowCustomerActivationReceiptRecords: () => [foreignReceiptRecord()],
  });

  await expectTenantBoundaryFailure(
    await app.request('/api/v1/shadow/customer-activation-receipts'),
    'Shadow tenant boundary route guard: receipt list rejects foreign records',
  );
}

async function testCustomerActivationReceiptLookupRejectsForeignRecord(): Promise<void> {
  const app = createApp({
    findShadowCustomerActivationReceipt: () => foreignReceiptRecord(),
  });

  await expectTenantBoundaryFailure(
    await app.request('/api/v1/shadow/customer-activation-receipts/receipt_foreign'),
    'Shadow tenant boundary route guard: receipt lookup rejects foreign records',
  );
}

async function testSimulationCreateRejectsForeignPersistedRecord(): Promise<void> {
  const app = createApp({
    recordShadowPolicySimulationReport: () => ({
      kind: 'recorded',
      record: foreignSimulationRecord(),
      path: null,
    }) as unknown as AppendShadowPolicySimulationReportResult,
  });

  await expectTenantBoundaryFailure(
    await app.request('/api/v1/shadow/simulations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ proposedMode: 'review' }),
    }),
    'Shadow tenant boundary route guard: simulation create rejects foreign persisted records',
  );
}

await testSummaryRejectsForeignAdmissionEvents();
await testSimulationCreateRejectsForeignPersistedRecord();
await testSimulationHistoryRejectsForeignRecords();
await testSimulationLookupRejectsForeignRecord();
await testPolicyCandidateMaterializeRejectsForeignRecords();
await testPolicyCandidateListRejectsForeignRecords();
await testPolicyCandidateTransitionRejectsForeignRecord();
await testCustomerActivationReceiptCreateRejectsForeignPersistedRecord();
await testCustomerActivationReceiptListRejectsForeignRecords();
await testCustomerActivationReceiptLookupRejectsForeignRecord();

console.log(`Shadow route tenant boundary tests: ${passed} passed, 0 failed`);
