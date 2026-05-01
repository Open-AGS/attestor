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

await testSummaryRouteIsNoStoreAndDataMinimized();
await testRecommendationsRouteReturnsCompactView();
await testEmptyShadowRouteIsExplicit();

console.log(`Shadow summary route tests: ${passed} passed, 0 failed`);
