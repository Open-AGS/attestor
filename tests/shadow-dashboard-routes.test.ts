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

function createEvent(input?: {
  readonly mode?: 'observe' | 'warn' | 'review' | 'enforce';
  readonly action?: string;
  readonly domain?: string;
  readonly downstreamSystem?: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly occurredAt?: string;
  readonly blocked?: boolean;
}): ShadowAdmissionEvent {
  const mode = input?.mode ?? 'observe';
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode,
      tenantId: 'tenant_shadow_dashboard',
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

function createApp(events: readonly ShadowAdmissionEvent[]): Hono {
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_shadow_dashboard',
      tenantName: 'Shadow Dashboard Tenant',
      authenticatedAt: '2026-05-03T10:00:00.000Z',
      source: 'api_key',
      planId: 'community',
      monthlyRunQuota: 100,
    }),
    listShadowEvents: ({ tenant }) =>
      tenant.tenantId === 'tenant_shadow_dashboard' ? events : [],
    listShadowSimulations: () => [],
    now: () => '2026-05-03T10:05:00.000Z',
  });
  return app;
}

async function testAuditEvidenceRouteIsNoStoreAndRedacted(): Promise<void> {
  const app = createApp([
    createEvent(),
    createEvent({
      mode: 'enforce',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:blocked_raw_evidence_must_not_escape'],
      occurredAt: '2026-05-03T10:01:02.000Z',
      blocked: true,
    }),
  ]);
  const response = await app.request('/api/v1/shadow/audit-evidence');
  const text = await response.text();
  const body = JSON.parse(text) as {
    tenant: { tenantId: string };
    productionReady: boolean;
    complianceClaimed: boolean;
    approvalRequired: boolean;
    autoEnforce: boolean;
    rawPayloadStored: boolean;
    source: string;
    auditEvidence: {
      version: string;
      scope: { tenantId: string | null; environment: string | null };
      controlSummary: {
        shadowEventCount: number;
        simulationCount: number;
        policyCandidateCount: number;
        blockedCount: number;
      };
      controlPosture: {
        productionReady: boolean;
        approvalRequired: boolean;
        autoEnforce: boolean;
      };
      findings: readonly { kind: string }[];
      digest: string;
    };
  };

  equal(response.status, 200, 'Shadow audit evidence route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow audit evidence route: response is no-store');
  equal(body.tenant.tenantId, 'tenant_shadow_dashboard', 'Shadow audit evidence route: tenant context is included');
  equal(body.productionReady, false, 'Shadow audit evidence route: production readiness is not claimed');
  equal(body.complianceClaimed, false, 'Shadow audit evidence route: compliance is not claimed');
  equal(body.approvalRequired, true, 'Shadow audit evidence route: approval remains required');
  equal(body.autoEnforce, false, 'Shadow audit evidence route: route never auto-enforces');
  equal(body.rawPayloadStored, false, 'Shadow audit evidence route: raw payload boundary is explicit');
  equal(body.source, 'shadow-summary', 'Shadow audit evidence route: source is explicit');
  equal(
    body.auditEvidence.version,
    'attestor.consequence-audit-evidence-export.v1',
    'Shadow audit evidence route: audit evidence export is returned',
  );
  equal(body.auditEvidence.scope.tenantId, 'tenant_shadow_dashboard', 'Shadow audit evidence route: audit tenant is scoped');
  equal(body.auditEvidence.scope.environment, 'production', 'Shadow audit evidence route: environment is inferred');
  equal(body.auditEvidence.controlSummary.shadowEventCount, 2, 'Shadow audit evidence route: event count is retained');
  equal(body.auditEvidence.controlSummary.simulationCount, 1, 'Shadow audit evidence route: summary simulation is included');
  ok(
    body.auditEvidence.controlSummary.policyCandidateCount > 0,
    'Shadow audit evidence route: policy discovery evidence is attached',
  );
  equal(body.auditEvidence.controlSummary.blockedCount, 1, 'Shadow audit evidence route: blocked count is retained');
  equal(
    body.auditEvidence.controlPosture.productionReady,
    false,
    'Shadow audit evidence route: audit export does not claim production readiness',
  );
  equal(
    body.auditEvidence.controlPosture.approvalRequired,
    true,
    'Shadow audit evidence route: audit export keeps approval required',
  );
  equal(
    body.auditEvidence.controlPosture.autoEnforce,
    false,
    'Shadow audit evidence route: audit export never auto-enforces',
  );
  ok(
    body.auditEvidence.findings.some((finding) => finding.kind === 'redacted-export-ready'),
    'Shadow audit evidence route: redacted export finding is present',
  );
  ok(body.auditEvidence.digest.startsWith('sha256:'), 'Shadow audit evidence route: export digest is returned');
  ok(!text.includes('raw_customer_marker_must_not_escape'), 'Shadow audit evidence route: raw recipient is not returned');
  ok(!text.includes('raw_evidence_must_not_escape'), 'Shadow audit evidence route: raw evidence ids are not returned');
  ok(!text.includes('raw_note_must_not_escape'), 'Shadow audit evidence route: raw observed features are not returned');
}

async function testBusinessRiskDashboardRouteIsDecisionSupportOnly(): Promise<void> {
  const app = createApp([
    createEvent(),
    createEvent({
      action: 'export_customer_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-service',
      policyRef: 'policy:reports:v1',
      evidenceRefs: ['ticket:report_raw_evidence_must_not_escape'],
      occurredAt: '2026-05-03T10:02:02.000Z',
    }),
  ]);
  const response = await app.request('/api/v1/shadow/business-risk-dashboard');
  const text = await response.text();
  const body = JSON.parse(text) as {
    tenant: { tenantId: string };
    productionReady: boolean;
    complianceClaimed: boolean;
    decisionSupportOnly: boolean;
    autoEnforce: boolean;
    rawPayloadStored: boolean;
    rawImpactValueStored: boolean;
    impactMode: string;
    source: string;
    auditEvidenceDigest: string;
    dashboard: {
      version: string;
      sourceAuditExportDigest: string;
      tenantId: string | null;
      environment: string | null;
      impactMode: string;
      decisionSupportOnly: boolean;
      autoEnforce: boolean;
      rawPayloadStored: boolean;
      rawImpactValueStored: boolean;
      complianceClaimed: boolean;
      productionReady: boolean;
      metrics: readonly { metric: string; value: number }[];
      domainRows: readonly { domain: string; actionCount: number }[];
      digest: string;
    };
  };

  equal(response.status, 200, 'Shadow business risk route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow business risk route: response is no-store');
  equal(body.tenant.tenantId, 'tenant_shadow_dashboard', 'Shadow business risk route: tenant context is included');
  equal(body.productionReady, false, 'Shadow business risk route: production readiness is not claimed');
  equal(body.complianceClaimed, false, 'Shadow business risk route: compliance is not claimed');
  equal(body.decisionSupportOnly, true, 'Shadow business risk route: route is decision support only');
  equal(body.autoEnforce, false, 'Shadow business risk route: route never auto-enforces');
  equal(body.rawPayloadStored, false, 'Shadow business risk route: raw payload boundary is explicit');
  equal(body.rawImpactValueStored, false, 'Shadow business risk route: raw impact boundary is explicit');
  equal(body.impactMode, 'not-supplied', 'Shadow business risk route: impact is not inferred');
  equal(body.source, 'audit-evidence', 'Shadow business risk route: source is explicit');
  equal(
    body.dashboard.version,
    'attestor.consequence-business-risk-dashboard.v1',
    'Shadow business risk route: dashboard model is returned',
  );
  equal(body.dashboard.tenantId, 'tenant_shadow_dashboard', 'Shadow business risk route: dashboard tenant is scoped');
  equal(body.dashboard.environment, 'production', 'Shadow business risk route: dashboard environment is inferred');
  equal(
    body.dashboard.sourceAuditExportDigest,
    body.auditEvidenceDigest,
    'Shadow business risk route: dashboard is bound to audit evidence digest',
  );
  equal(body.dashboard.impactMode, 'not-supplied', 'Shadow business risk route: dashboard does not invent impact');
  equal(body.dashboard.decisionSupportOnly, true, 'Shadow business risk route: dashboard is decision support only');
  equal(body.dashboard.autoEnforce, false, 'Shadow business risk route: dashboard never auto-enforces');
  equal(body.dashboard.rawPayloadStored, false, 'Shadow business risk route: dashboard is data-minimized');
  equal(body.dashboard.rawImpactValueStored, false, 'Shadow business risk route: dashboard stores no raw impact');
  equal(body.dashboard.complianceClaimed, false, 'Shadow business risk route: dashboard claims no compliance');
  equal(body.dashboard.productionReady, false, 'Shadow business risk route: dashboard claims no production readiness');
  ok(
    body.dashboard.metrics.some((metric) => metric.metric === 'ai-actions-observed' && metric.value === 2),
    'Shadow business risk route: action volume metric is returned',
  );
  ok(
    body.dashboard.domainRows.some((row) => row.domain === 'money-movement' && row.actionCount === 1),
    'Shadow business risk route: money movement domain row is returned',
  );
  ok(body.dashboard.digest.startsWith('sha256:'), 'Shadow business risk route: dashboard digest is returned');
  ok(!text.includes('raw_customer_marker_must_not_escape'), 'Shadow business risk route: raw recipient is not returned');
  ok(!text.includes('raw_evidence_must_not_escape'), 'Shadow business risk route: raw evidence ids are not returned');
  ok(!text.includes('raw_note_must_not_escape'), 'Shadow business risk route: raw observed features are not returned');
}

async function testDashboardSummaryRouteReturnsCompactBusinessView(): Promise<void> {
  const app = createApp([
    createEvent(),
    createEvent({
      action: 'export_customer_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-service',
      policyRef: 'policy:reports:v1',
      evidenceRefs: ['ticket:dashboard_summary_raw_evidence_must_not_escape'],
      occurredAt: '2026-05-03T10:02:02.000Z',
    }),
    createEvent({
      mode: 'enforce',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:dashboard_summary_blocked_raw_evidence_must_not_escape'],
      occurredAt: '2026-05-03T10:03:02.000Z',
      blocked: true,
    }),
  ]);
  const response = await app.request('/api/v1/shadow/dashboard-summary');
  const text = await response.text();
  const body = JSON.parse(text) as {
    tenant: { tenantId: string };
    productionReady: boolean;
    complianceClaimed: boolean;
    decisionSupportOnly: boolean;
    autoEnforce: boolean;
    rawPayloadStored: boolean;
    rawImpactValueStored: boolean;
    source: string;
    auditEvidenceDigest: string;
    dashboardDigest: string;
    summary: {
      version: string;
      sourceAuditExportDigest: string;
      sourceDashboardDigest: string;
      tenantId: string | null;
      overview: {
        observedActionCount: number;
        policyGapCount: number;
        wouldBlockCount: number;
      };
      tiles: readonly { kind: string; value: number; route: string }[];
      attentionItems: readonly { kind: string; route: string }[];
      apiLinks: readonly { kind: string; route: string }[];
      rawPayloadStored: boolean;
      decisionSupportOnly: boolean;
      autoEnforce: boolean;
      digest: string;
    };
  };

  equal(response.status, 200, 'Shadow dashboard summary route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow dashboard summary route: response is no-store');
  equal(body.tenant.tenantId, 'tenant_shadow_dashboard', 'Shadow dashboard summary route: tenant context is included');
  equal(body.productionReady, false, 'Shadow dashboard summary route: production readiness is not claimed');
  equal(body.complianceClaimed, false, 'Shadow dashboard summary route: compliance is not claimed');
  equal(body.decisionSupportOnly, true, 'Shadow dashboard summary route: route is decision support only');
  equal(body.autoEnforce, false, 'Shadow dashboard summary route: route never auto-enforces');
  equal(body.rawPayloadStored, false, 'Shadow dashboard summary route: raw payload boundary is explicit');
  equal(body.rawImpactValueStored, false, 'Shadow dashboard summary route: raw impact boundary is explicit');
  equal(body.source, 'business-risk-dashboard', 'Shadow dashboard summary route: source is explicit');
  equal(
    body.summary.version,
    'attestor.consequence-dashboard-api-summary.v1',
    'Shadow dashboard summary route: summary model is returned',
  );
  equal(
    body.summary.sourceAuditExportDigest,
    body.auditEvidenceDigest,
    'Shadow dashboard summary route: summary is bound to audit evidence digest',
  );
  equal(
    body.summary.sourceDashboardDigest,
    body.dashboardDigest,
    'Shadow dashboard summary route: summary is bound to dashboard digest',
  );
  equal(body.summary.tenantId, 'tenant_shadow_dashboard', 'Shadow dashboard summary route: summary tenant is scoped');
  equal(body.summary.overview.observedActionCount, 3, 'Shadow dashboard summary route: action count is retained');
  ok(body.summary.overview.policyGapCount > 0, 'Shadow dashboard summary route: policy gaps are retained');
  equal(body.summary.overview.wouldBlockCount, 1, 'Shadow dashboard summary route: blocked count is retained');
  ok(
    body.summary.tiles.some((tile) =>
      tile.kind === 'policy-gaps' &&
      tile.route === '/api/v1/shadow/policy-candidates'
    ),
    'Shadow dashboard summary route: policy gap tile points to policy candidates',
  );
  ok(
    body.summary.attentionItems.some((item) => item.kind === 'define-policy'),
    'Shadow dashboard summary route: define-policy attention item is returned',
  );
  ok(
    body.summary.apiLinks.some((link) =>
      link.kind === 'business-risk-dashboard' &&
      link.route === '/api/v1/shadow/business-risk-dashboard'
    ),
    'Shadow dashboard summary route: full dashboard link is returned',
  );
  equal(body.summary.rawPayloadStored, false, 'Shadow dashboard summary route: summary is data-minimized');
  equal(body.summary.decisionSupportOnly, true, 'Shadow dashboard summary route: summary is decision support only');
  equal(body.summary.autoEnforce, false, 'Shadow dashboard summary route: summary never auto-enforces');
  ok(body.summary.digest.startsWith('sha256:'), 'Shadow dashboard summary route: summary digest is returned');
  ok(!text.includes('raw_customer_marker_must_not_escape'), 'Shadow dashboard summary route: raw recipient is not returned');
  ok(!text.includes('dashboard_summary_raw_evidence_must_not_escape'), 'Shadow dashboard summary route: raw evidence ids are not returned');
  ok(!text.includes('raw_note_must_not_escape'), 'Shadow dashboard summary route: raw observed features are not returned');
}

async function testEmptyDashboardRoutesAreExplicit(): Promise<void> {
  const app = createApp([]);
  const auditResponse = await app.request('/api/v1/shadow/audit-evidence');
  const auditBody = await auditResponse.json() as {
    auditEvidence: {
      controlSummary: { shadowEventCount: number; simulationCount: number };
      findings: readonly { kind: string }[];
    };
  };
  const dashboardResponse = await app.request('/api/v1/shadow/business-risk-dashboard');
  const dashboardBody = await dashboardResponse.json() as {
    dashboard: {
      metrics: readonly { metric: string; value: number }[];
      impactMode: string;
      autoEnforce: boolean;
    };
  };
  const summaryResponse = await app.request('/api/v1/shadow/dashboard-summary');
  const summaryBody = await summaryResponse.json() as {
    summary: {
      overview: { observedActionCount: number };
      attentionItems: readonly { kind: string }[];
      autoEnforce: boolean;
    };
  };

  equal(auditResponse.status, 200, 'Shadow audit evidence route: empty request returns 200');
  equal(auditBody.auditEvidence.controlSummary.shadowEventCount, 0, 'Shadow audit evidence route: empty count is zero');
  equal(auditBody.auditEvidence.controlSummary.simulationCount, 0, 'Shadow audit evidence route: empty route does not invent simulation');
  ok(
    auditBody.auditEvidence.findings.some((finding) => finding.kind === 'no-shadow-events'),
    'Shadow audit evidence route: empty evidence reports missing shadow events',
  );
  equal(dashboardResponse.status, 200, 'Shadow business risk route: empty request returns 200');
  ok(
    dashboardBody.dashboard.metrics.some((metric) => metric.metric === 'ai-actions-observed' && metric.value === 0),
    'Shadow business risk route: empty action metric is zero',
  );
  equal(dashboardBody.dashboard.impactMode, 'not-supplied', 'Shadow business risk route: empty route does not invent impact');
  equal(dashboardBody.dashboard.autoEnforce, false, 'Shadow business risk route: empty route never auto-enforces');
  equal(summaryResponse.status, 200, 'Shadow dashboard summary route: empty request returns 200');
  equal(summaryBody.summary.overview.observedActionCount, 0, 'Shadow dashboard summary route: empty action count is zero');
  ok(
    summaryBody.summary.attentionItems.some((item) => item.kind === 'start-shadow-mode'),
    'Shadow dashboard summary route: empty summary points to shadow mode evidence',
  );
  equal(summaryBody.summary.autoEnforce, false, 'Shadow dashboard summary route: empty summary never auto-enforces');
}

await testAuditEvidenceRouteIsNoStoreAndRedacted();
await testBusinessRiskDashboardRouteIsDecisionSupportOnly();
await testDashboardSummaryRouteReturnsCompactBusinessView();
await testEmptyDashboardRoutesAreExplicit();

console.log(`Shadow dashboard route tests: ${passed} passed, 0 failed`);
