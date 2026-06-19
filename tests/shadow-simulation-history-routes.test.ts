import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import { registerShadowRoutes } from '../src/service/http/routes/shadow-routes.js';
import {
  createFileBackedShadowPolicySimulationReportStore,
  resetShadowPersistenceStoresForTests,
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

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-simulation-routes-'));
const simulationPath = join(tempDir, 'shadow-simulations.json');

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_simulation',
  tenantName: 'Shadow Simulation Tenant',
  authenticatedAt: '2026-05-02T10:00:00.000Z',
  source: 'api_key',
  planId: 'trial',
  monthlyRunQuota: 100,
};

const tenantB: TenantContext = {
  ...tenant,
  tenantId: 'tenant_shadow_simulation_b',
  tenantName: 'Shadow Simulation Tenant B',
};

function createEvent(): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: '2026-05-02T10:01:00.000Z',
      decidedAt: '2026-05-02T10:01:01.000Z',
      recipient: 'raw_customer_value_must_not_escape',
      evidenceRefs: ['order:987'],
      policyRef: null,
      observedFeatures: {
        rawMarker: 'raw_feature_value_must_not_escape',
      },
    }),
    occurredAt: '2026-05-02T10:01:02.000Z',
    downstreamOutcome: 'proceeded',
    observedFeatures: {
      rawMarker: 'raw_feature_value_must_not_escape',
    },
  });
}

function createApp(
  events: readonly ShadowAdmissionEvent[],
  options?: {
    readonly routeTenant?: TenantContext;
    readonly simulationStore?: ReturnType<typeof createFileBackedShadowPolicySimulationReportStore>;
  },
): Hono {
  const simulationStore =
    options?.simulationStore ?? createFileBackedShadowPolicySimulationReportStore({ path: simulationPath });
  const routeTenant = options?.routeTenant ?? tenant;
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => routeTenant,
    listShadowEvents: ({ tenant: routeTenant }) =>
      routeTenant.tenantId === tenant.tenantId ? events : [],
    listShadowSimulations: ({ tenant: routeTenant }) =>
      simulationStore.list({ tenantId: routeTenant.tenantId }).reports,
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
    now: () => '2026-05-02T10:05:00.000Z',
  });
  return app;
}

async function testSimulationHistoryRoutesPersistAndReplayReports(): Promise<void> {
  const app = createApp([createEvent()]);
  const createResponse = await app.request('/api/v1/shadow/simulations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      proposedMode: 'enforce',
      minimumPromotionEvents: 1,
    }),
  });
  const createText = await createResponse.text();
  const createBody = JSON.parse(createText) as {
    readonly storageMode: string;
    readonly productionReady: boolean;
    readonly rawPayloadStored: boolean;
    readonly report: {
      readonly reportId: string;
      readonly proposedMode: string;
      readonly eventCount: number;
      readonly rawPayloadEventCount: number;
      readonly digest: string;
    };
    readonly persisted: {
      readonly kind: string;
      readonly record: {
        readonly reportId: string;
        readonly reportDigest: string;
        readonly rawPayloadStored: boolean;
      };
      readonly path?: string;
    };
  };
  const reportId = createBody.report.reportId;
  const listResponse = await app.request('/api/v1/shadow/simulations?proposedMode=enforce');
  const listText = await listResponse.text();
  const listBody = JSON.parse(listText) as {
    readonly recordCount: number;
    readonly rawPayloadStored: boolean;
    readonly records: readonly {
      readonly reportId: string;
      readonly proposedMode: string;
      readonly reportDigest: string;
    }[];
  };
  const lookupResponse = await app.request(`/api/v1/shadow/simulations/${encodeURIComponent(reportId)}`);
  const lookupBody = await lookupResponse.json() as {
    readonly record: {
      readonly reportId: string;
      readonly reportDigest: string;
      readonly rawPayloadStored: boolean;
    };
  };
  const summaryResponse = await app.request('/api/v1/shadow/summary');
  const summaryBody = await summaryResponse.json() as {
    readonly latestSimulation: { readonly reportId: string } | null;
  };

  equal(createResponse.status, 200, 'Shadow simulation history route: create returns 200');
  equal(createBody.storageMode, 'file-backed-evaluation', 'Shadow simulation history route: storage mode is explicit');
  equal(createBody.productionReady, false, 'Shadow simulation history route: report store is not production-ready');
  equal(createBody.rawPayloadStored, false, 'Shadow simulation history route: response is data-minimized');
  equal(createBody.report.proposedMode, 'enforce', 'Shadow simulation history route: proposed mode is retained');
  equal(createBody.report.eventCount, 1, 'Shadow simulation history route: event count is retained');
  equal(createBody.report.rawPayloadEventCount, 0, 'Shadow simulation history route: raw payload event count is zero');
  equal(createBody.persisted.kind, 'recorded', 'Shadow simulation history route: report is persisted');
  equal(createBody.persisted.record.reportId, reportId, 'Shadow simulation history route: persisted record carries report id');
  equal(createBody.persisted.record.reportDigest, createBody.report.digest, 'Shadow simulation history route: persisted digest matches report');
  equal(createBody.persisted.record.rawPayloadStored, false, 'Shadow simulation history route: persisted record is data-minimized');
  equal(createBody.persisted.path, undefined, 'Shadow simulation history route: local store path is not exposed');
  ok(!createText.includes('raw_customer_value_must_not_escape'), 'Shadow simulation history route: raw recipient is not returned');
  ok(!createText.includes('raw_feature_value_must_not_escape'), 'Shadow simulation history route: raw feature value is not returned');
  ok(!createText.includes('order:987'), 'Shadow simulation history route: raw evidence id is not returned');

  equal(listResponse.status, 200, 'Shadow simulation history route: list returns 200');
  equal(listBody.recordCount, 1, 'Shadow simulation history route: list filters by proposed mode');
  equal(listBody.rawPayloadStored, false, 'Shadow simulation history route: list is data-minimized');
  equal(listBody.records[0]?.reportId, reportId, 'Shadow simulation history route: list returns report id');
  equal(listBody.records[0]?.proposedMode, 'enforce', 'Shadow simulation history route: list returns proposed mode');
  equal(listBody.records[0]?.reportDigest, createBody.report.digest, 'Shadow simulation history route: list returns report digest');
  ok(!listText.includes('raw_customer_value_must_not_escape'), 'Shadow simulation history route: raw recipient is not listed');

  equal(lookupResponse.status, 200, 'Shadow simulation history route: lookup returns 200');
  equal(lookupBody.record.reportId, reportId, 'Shadow simulation history route: lookup returns report');
  equal(lookupBody.record.rawPayloadStored, false, 'Shadow simulation history route: lookup is data-minimized');
  equal(summaryResponse.status, 200, 'Shadow simulation history route: summary still returns 200');
  equal(summaryBody.latestSimulation?.reportId, reportId, 'Shadow simulation history route: summary uses persisted latest simulation');
}

async function testInvalidSimulationInputsFailClosed(): Promise<void> {
  const app = createApp([createEvent()]);
  const invalidMode = await app.request('/api/v1/shadow/simulations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ proposedMode: 'force' }),
  });
  const invalidMinimum = await app.request('/api/v1/shadow/simulations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      proposedMode: 'review',
      minimumPromotionEvents: 0,
    }),
  });
  const invalidListMode = await app.request('/api/v1/shadow/simulations?proposedMode=force');
  const missing = await app.request('/api/v1/shadow/simulations/shadow-simulation%3Amissing');

  equal(invalidMode.status, 400, 'Shadow simulation history route: invalid mode is rejected');
  equal(invalidMinimum.status, 400, 'Shadow simulation history route: invalid minimumPromotionEvents is rejected');
  equal(invalidListMode.status, 400, 'Shadow simulation history route: invalid list mode is rejected');
  equal(missing.status, 404, 'Shadow simulation history route: missing report returns 404');
}

async function testExplicitModeAndEventLimitFailClosed(): Promise<void> {
  const app = createApp([createEvent()]);
  const noBody = await app.request('/api/v1/shadow/simulations', {
    method: 'POST',
  });
  const missingMode = await app.request('/api/v1/shadow/simulations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const event = createEvent();
  const tooManyEvents = Array.from({ length: 10_001 }, () => event);
  const tooManyApp = createApp(tooManyEvents);
  const tooMany = await tooManyApp.request('/api/v1/shadow/simulations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      proposedMode: 'review',
    }),
  });

  equal(noBody.status, 415, 'Shadow simulation history route: JSON content type is required');
  equal(missingMode.status, 400, 'Shadow simulation history route: proposedMode is required');
  equal(tooMany.status, 400, 'Shadow simulation history route: oversized event windows are rejected');
}

async function testCrossTenantSimulationLookupIsIsolated(): Promise<void> {
  const simulationStore = createFileBackedShadowPolicySimulationReportStore({ path: simulationPath });
  const tenantAApp = createApp([createEvent()], { routeTenant: tenant, simulationStore });
  const createResponse = await tenantAApp.request('/api/v1/shadow/simulations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      proposedMode: 'review',
    }),
  });
  const createBody = await createResponse.json() as {
    readonly report: { readonly reportId: string };
  };
  const tenantBApp = createApp([], { routeTenant: tenantB, simulationStore });
  const crossTenantLookup = await tenantBApp.request(
    `/api/v1/shadow/simulations/${encodeURIComponent(createBody.report.reportId)}`,
  );
  const tenantBList = await tenantBApp.request('/api/v1/shadow/simulations');

  equal(createResponse.status, 200, 'Shadow simulation history route: tenant A creates report');
  equal(crossTenantLookup.status, 404, 'Shadow simulation history route: tenant B cannot lookup tenant A report');
  equal(tenantBList.status, 200, 'Shadow simulation history route: tenant B list returns 200');
  const tenantBListBody = await tenantBList.json() as { readonly recordCount: number };
  equal(tenantBListBody.recordCount, 0, 'Shadow simulation history route: tenant B list is isolated');
}

try {
  resetShadowPersistenceStoresForTests({ policySimulationReportPath: simulationPath });
  await testSimulationHistoryRoutesPersistAndReplayReports();
  resetShadowPersistenceStoresForTests({ policySimulationReportPath: simulationPath });
  await testInvalidSimulationInputsFailClosed();
  resetShadowPersistenceStoresForTests({ policySimulationReportPath: simulationPath });
  await testExplicitModeAndEventLimitFailClosed();
  resetShadowPersistenceStoresForTests({ policySimulationReportPath: simulationPath });
  await testCrossTenantSimulationLookupIsIsolated();

  console.log(`Shadow simulation history route tests: ${passed} passed, 0 failed`);
} finally {
  resetShadowPersistenceStoresForTests({ policySimulationReportPath: simulationPath });
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
