import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import { registerShadowRoutes } from '../src/service/http/routes/shadow-routes.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function createEvent(): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      tenantId: 'tenant_shadow',
      environment: 'sandbox',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: '2026-05-01T21:10:00.000Z',
      decidedAt: '2026-05-01T21:10:01.000Z',
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'customer_raw_value_must_not_escape',
      evidenceRefs: ['order:987'],
    }),
    occurredAt: '2026-05-01T21:10:02.000Z',
    downstreamOutcome: 'proceeded',
    observedFeatures: {
      amountBucket: '25k-50k',
    },
  });
}

function createApp(events: readonly ShadowAdmissionEvent[]): Hono {
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_shadow',
      tenantName: 'Shadow Tenant',
      authenticatedAt: '2026-05-01T21:10:00.000Z',
      source: 'api_key',
      planId: 'community',
      monthlyRunQuota: 100,
    }),
    listShadowEvents: ({ tenant }) =>
      tenant.tenantId === 'tenant_shadow' ? events : [],
    listShadowSimulations: () => [],
    now: () => '2026-05-01T21:11:00.000Z',
  });
  return app;
}

async function testSummaryRouteIsNoStoreAndDataMinimized(): Promise<void> {
  const app = createApp([createEvent()]);
  const response = await app.request('/api/v1/shadow/summary');
  const text = await response.text();
  const body = JSON.parse(text) as {
    tenant: { tenantId: string; source: string };
    eventCount: number;
    rawPayloadStored: boolean;
    summary: { totalEvents: number; policyGapCount: number; rawPayloadEventCount: number };
    latestSimulation: { eventCount: number; rawPayloadEventCount: number } | null;
    recommendations: readonly { kind: string }[];
  };

  equal(response.status, 200, 'Shadow summary route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow summary route: response is no-store');
  equal(body.tenant.tenantId, 'tenant_shadow', 'Shadow summary route: tenant context is included');
  equal(body.tenant.source, 'api_key', 'Shadow summary route: tenant source is included');
  equal(body.eventCount, 1, 'Shadow summary route: event count is returned');
  equal(body.rawPayloadStored, false, 'Shadow summary route: raw payload boundary is explicit');
  equal(body.summary.totalEvents, 1, 'Shadow summary route: summary is returned');
  equal(body.summary.policyGapCount, 1, 'Shadow summary route: policy gaps are counted');
  equal(body.summary.rawPayloadEventCount, 0, 'Shadow summary route: raw payload event count remains zero');
  equal(body.latestSimulation?.eventCount, 1, 'Shadow summary route: latest simulation is generated');
  equal(body.latestSimulation?.rawPayloadEventCount, 0, 'Shadow summary route: simulation stays data-minimized');
  ok(
    body.recommendations.some((item) => item.kind === 'define-policy'),
    'Shadow summary route: recommendations are exposed',
  );
  ok(!text.includes('customer_raw_value_must_not_escape'), 'Shadow summary route: raw recipient is not returned');
  ok(!text.includes('order:987'), 'Shadow summary route: raw evidence id is not returned');
}

async function testRecommendationsRouteReturnsCompactView(): Promise<void> {
  const app = createApp([createEvent()]);
  const response = await app.request('/api/v1/shadow/recommendations');
  const text = await response.text();
  const body = JSON.parse(text) as {
    eventCount: number;
    recommendationCount: number;
    latestSimulationDigest: string | null;
    source: string;
    recommendations: readonly { kind: string; nextMode: string | null }[];
  };

  equal(response.status, 200, 'Shadow recommendations route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow recommendations route: response is no-store');
  equal(body.eventCount, 1, 'Shadow recommendations route: event count is retained');
  equal(body.source, 'shadow-summary', 'Shadow recommendations route: source is explicit');
  ok(body.recommendationCount > 0, 'Shadow recommendations route: recommendation count is returned');
  ok(
    body.latestSimulationDigest?.startsWith('sha256:'),
    'Shadow recommendations route: latest simulation digest is returned',
  );
  ok(
    body.recommendations.some((item) => item.kind === 'define-policy' && item.nextMode === 'observe'),
    'Shadow recommendations route: conservative next mode is returned',
  );
  ok(!text.includes('customer_raw_value_must_not_escape'), 'Shadow recommendations route: raw recipient is not returned');
  ok(!text.includes('order:987'), 'Shadow recommendations route: raw evidence id is not returned');
}

async function testEmptyShadowRouteIsExplicit(): Promise<void> {
  const app = createApp([]);
  const response = await app.request('/api/v1/shadow/summary');
  const body = await response.json() as {
    eventCount: number;
    latestSimulation: null;
    recommendations: readonly unknown[];
  };

  equal(response.status, 200, 'Shadow summary route: empty request returns 200');
  equal(body.eventCount, 0, 'Shadow summary route: empty event count is zero');
  equal(body.latestSimulation, null, 'Shadow summary route: empty route does not invent simulation');
  equal(body.recommendations.length, 0, 'Shadow summary route: empty route does not invent recommendations');
}

async function testActionRiskInventoryRouteReturnsDataMinimizedSurfaceList(): Promise<void> {
  const app = createApp([createEvent()]);
  const response = await app.request('/api/v1/shadow/action-risk-inventory');
  const text = await response.text();
  const body = JSON.parse(text) as {
    tenant: { tenantId: string };
    eventCount: number;
    surfaceCount: number;
    rawPayloadStored: boolean;
    surfaces: readonly {
      actionSurface: string;
      riskTier: string;
      recommendedNextStep: string;
      gapCounts: { policy: number };
    }[];
  };

  equal(response.status, 200, 'Shadow action risk route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow action risk route: response is no-store');
  equal(body.tenant.tenantId, 'tenant_shadow', 'Shadow action risk route: tenant context is included');
  equal(body.eventCount, 1, 'Shadow action risk route: event count is returned');
  equal(body.surfaceCount, 1, 'Shadow action risk route: surface count is returned');
  equal(body.rawPayloadStored, false, 'Shadow action risk route: raw payload boundary is explicit');
  equal(body.surfaces[0]?.actionSurface, 'refund-service.issue_refund', 'Shadow action risk route: action surface is returned');
  equal(body.surfaces[0]?.riskTier, 'high', 'Shadow action risk route: policy gap is high risk');
  equal(body.surfaces[0]?.recommendedNextStep, 'define-policy', 'Shadow action risk route: next step is explicit');
  equal(body.surfaces[0]?.gapCounts.policy, 1, 'Shadow action risk route: policy gap count is returned');
  ok(!text.includes('customer_raw_value_must_not_escape'), 'Shadow action risk route: raw recipient is not returned');
  ok(!text.includes('order:987'), 'Shadow action risk route: raw evidence id is not returned');
}

async function testPolicyCandidateRouteRequiresApprovalAndRedactsInputs(): Promise<void> {
  const app = createApp([createEvent()]);
  const response = await app.request('/api/v1/shadow/policy-candidates');
  const text = await response.text();
  const body = JSON.parse(text) as {
    tenant: { tenantId: string };
    candidateCount: number;
    approvalRequired: boolean;
    autoEnforce: boolean;
    rawPayloadStored: boolean;
    candidates: readonly {
      actionSurface: string | null;
      action: string;
      proposedMode: string;
      approvalRequired: boolean;
      autoEnforce: boolean;
      requiredControls: readonly string[];
    }[];
  };

  equal(response.status, 200, 'Shadow policy candidates route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow policy candidates route: response is no-store');
  equal(body.tenant.tenantId, 'tenant_shadow', 'Shadow policy candidates route: tenant context is included');
  equal(body.approvalRequired, true, 'Shadow policy candidates route: approval is required');
  equal(body.autoEnforce, false, 'Shadow policy candidates route: route never auto-enforces');
  equal(body.rawPayloadStored, false, 'Shadow policy candidates route: raw payload boundary is explicit');
  ok(body.candidateCount > 0, 'Shadow policy candidates route: candidates are returned');
  ok(
    body.candidates.some((candidate) =>
      candidate.actionSurface === 'refund-service.issue_refund' &&
      candidate.action === 'draft-policy' &&
      candidate.proposedMode === 'observe' &&
      candidate.approvalRequired &&
      !candidate.autoEnforce &&
      candidate.requiredControls.includes('customer-approval')
    ),
    'Shadow policy candidates route: policy gap returns approval-required draft candidate',
  );
  ok(!text.includes('customer_raw_value_must_not_escape'), 'Shadow policy candidates route: raw recipient is not returned');
  ok(!text.includes('order:987'), 'Shadow policy candidates route: raw evidence id is not returned');
}

await testSummaryRouteIsNoStoreAndDataMinimized();
await testRecommendationsRouteReturnsCompactView();
await testEmptyShadowRouteIsExplicit();
await testActionRiskInventoryRouteReturnsDataMinimizedSurfaceList();
await testPolicyCandidateRouteRequiresApprovalAndRedactsInputs();

console.log(`Shadow summary route tests: ${passed} passed, 0 failed`);
