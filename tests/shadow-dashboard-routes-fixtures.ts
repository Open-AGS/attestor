import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import { registerShadowRoutes } from '../src/service/http/routes/shadow-routes.js';

let passed = 0;

export function passedCount(): number {
  return passed;
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function createEvent(input?: {
  readonly mode?: 'observe' | 'warn' | 'review' | 'enforce';
  readonly action?: string;
  readonly domain?: string;
  readonly downstreamSystem?: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly occurredAt?: string;
  readonly blocked?: boolean;
  readonly tenantId?: string | null;
}): ShadowAdmissionEvent {
  const mode = input?.mode ?? 'observe';
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode,
      tenantId: input?.tenantId === undefined ? 'tenant_shadow_dashboard' : input.tenantId,
      environment: 'production',
      actor: 'support-ai-agent',
      action: input?.action ?? 'issue_refund',
      domain: input?.domain ?? 'money-movement',
      downstreamSystem: input?.downstreamSystem ?? 'refund-service',
      requestedAt: '2026-05-03T10:00:00.000Z',
      decidedAt: '2026-05-03T10:00:01.000Z',
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'raw_customer_marker_must_not_escape',
      policyRef: input?.policyRef ?? null,
      evidenceRefs: input?.evidenceRefs ?? ['order:raw_evidence_must_not_escape'],
      observedFeatures: input?.blocked
        ? {
          policyBlocked: true,
          adapterReady: true,
          rawNote: 'raw_note_must_not_escape',
        }
        : {
          rawNote: 'raw_note_must_not_escape',
        },
    }),
    occurredAt: input?.occurredAt ?? '2026-05-03T10:00:02.000Z',
    downstreamOutcome: input?.blocked ? 'blocked' : 'proceeded',
    humanOutcome: input?.blocked ? 'rejected' : 'not-reviewed',
  });
}

export function createApp(events: readonly ShadowAdmissionEvent[]): Hono {
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_shadow_dashboard',
      tenantName: 'Shadow Dashboard Tenant',
      authenticatedAt: '2026-05-03T10:00:00.000Z',
      source: 'api_key',
      planId: 'trial',
      monthlyRunQuota: 100,
    }),
    listShadowEvents: ({ tenant }) =>
      tenant.tenantId === 'tenant_shadow_dashboard' ? events : [],
    listShadowSimulations: () => [],
    now: () => '2026-05-03T10:05:00.000Z',
  });
  return app;
}

async function expectDashboardTenantBoundaryFailure(
  path: string,
  message: string,
  event: ShadowAdmissionEvent = createEvent({ tenantId: 'tenant_foreign_shadow_dashboard' }),
  leakedTenantId: string | null = 'tenant_foreign_shadow_dashboard',
): Promise<void> {
  const app = createApp([event]);
  const response = await app.request(path);
  const text = await response.text();
  const body = JSON.parse(text) as { readonly detail: string };

  equal(response.status, 503, `${message}: foreign tenant event fails closed`);
  ok(
    typeof body.detail === 'string' && body.detail.includes('tenant boundary violation'),
    `${message}: safe tenant-boundary reason is returned`,
  );
  if (leakedTenantId !== null) {
    ok(!text.includes(leakedTenantId), `${message}: foreign tenant id is not disclosed`);
  }
}

export async function testDashboardRoutesRejectForeignTenantEvents(): Promise<void> {
  await expectDashboardTenantBoundaryFailure(
    '/api/v1/shadow/audit-evidence',
    'Shadow audit evidence route',
  );
  await expectDashboardTenantBoundaryFailure(
    '/api/v1/shadow/business-risk-dashboard',
    'Shadow business risk route',
  );
  await expectDashboardTenantBoundaryFailure(
    '/api/v1/shadow/dashboard-summary',
    'Shadow dashboard summary route',
  );
  await expectDashboardTenantBoundaryFailure(
    '/api/v1/shadow/review-surface',
    'Shadow review surface route',
  );
  await expectDashboardTenantBoundaryFailure(
    '/api/v1/shadow/review-surface/view',
    'Shadow review surface HTML route',
  );
  await expectDashboardTenantBoundaryFailure(
    `/api/v1/shadow/review-surface/cases/${encodeURIComponent('sha256:unknown-case')}`,
    'Shadow review case route',
  );
}

export async function testDashboardRoutesRejectMissingTenantEvents(): Promise<void> {
  const event = createEvent({ tenantId: null });
  await expectDashboardTenantBoundaryFailure(
    '/api/v1/shadow/audit-evidence',
    'Shadow audit evidence route',
    event,
    null,
  );
  await expectDashboardTenantBoundaryFailure(
    '/api/v1/shadow/business-risk-dashboard',
    'Shadow business risk route',
    event,
    null,
  );
  await expectDashboardTenantBoundaryFailure(
    '/api/v1/shadow/dashboard-summary',
    'Shadow dashboard summary route',
    event,
    null,
  );
  await expectDashboardTenantBoundaryFailure(
    '/api/v1/shadow/review-surface',
    'Shadow review surface route',
    event,
    null,
  );
  await expectDashboardTenantBoundaryFailure(
    '/api/v1/shadow/review-surface/view',
    'Shadow review surface HTML route',
    event,
    null,
  );
  await expectDashboardTenantBoundaryFailure(
    `/api/v1/shadow/review-surface/cases/${encodeURIComponent('sha256:unknown-case')}`,
    'Shadow review case route',
    event,
    null,
  );
}
