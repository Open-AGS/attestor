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
  readonly tenantId?: string;
}): ShadowAdmissionEvent {
  const mode = input?.mode ?? 'observe';
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode,
      tenantId: input?.tenantId ?? 'tenant_shadow_dashboard',
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

async function testReviewSurfaceRouteReturnsDigestOnlyWorkspace(): Promise<void> {
  const app = createApp([
    createEvent(),
    createEvent({
      action: 'export_customer_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-service',
      policyRef: 'policy:reports:v1',
      evidenceRefs: ['ticket:review_surface_raw_evidence_must_not_escape'],
      occurredAt: '2026-05-03T10:02:02.000Z',
    }),
    createEvent({
      mode: 'enforce',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:review_surface_blocked_raw_evidence_must_not_escape'],
      occurredAt: '2026-05-03T10:03:02.000Z',
      blocked: true,
    }),
  ]);
  const response = await app.request('/api/v1/shadow/review-surface');
  const text = await response.text();
  const body = JSON.parse(text) as {
    tenant: { tenantId: string };
    productionReady: boolean;
    complianceClaimed: boolean;
    decisionSupportOnly: boolean;
    autoEnforce: boolean;
    rawPayloadStored: boolean;
    source: string;
    auditEvidenceDigest: string;
    dashboardDigest: string;
    dashboardSummaryDigest: string;
    reviewSurfaceDigest: string;
    reviewSurface: {
      version: string;
      sourceAuditExportDigest: string;
      sourceBusinessRiskDashboardDigest: string;
      sourceDashboardSummaryDigest: string;
      tenantDigest: string | null;
      reviewQueue: readonly { caseDigest: string; defaultVisible: boolean }[];
      caseDigests: readonly string[];
      decisionSupportOnly: boolean;
      autoEnforce: boolean;
      rawPayloadStored: boolean;
      hostedUiImplemented: boolean;
      reviewMaterialOnly: boolean;
      digest: string;
    };
  };
  const serializedSurface = JSON.stringify(body.reviewSurface);

  equal(response.status, 200, 'Shadow review surface route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow review surface route: response is no-store');
  equal(body.tenant.tenantId, 'tenant_shadow_dashboard', 'Shadow review surface route: tenant context is included');
  equal(body.productionReady, false, 'Shadow review surface route: production readiness is not claimed');
  equal(body.complianceClaimed, false, 'Shadow review surface route: compliance is not claimed');
  equal(body.decisionSupportOnly, true, 'Shadow review surface route: route is decision support only');
  equal(body.autoEnforce, false, 'Shadow review surface route: route never auto-enforces');
  equal(body.rawPayloadStored, false, 'Shadow review surface route: raw payload boundary is explicit');
  equal(body.source, 'dashboard-summary', 'Shadow review surface route: source is explicit');
  equal(
    body.reviewSurface.version,
    'attestor.review-surface.v1',
    'Shadow review surface route: review surface model is returned',
  );
  equal(
    body.reviewSurface.sourceAuditExportDigest,
    body.auditEvidenceDigest,
    'Shadow review surface route: review surface binds audit evidence digest',
  );
  equal(
    body.reviewSurface.sourceBusinessRiskDashboardDigest,
    body.dashboardDigest,
    'Shadow review surface route: review surface binds dashboard digest',
  );
  equal(
    body.reviewSurface.sourceDashboardSummaryDigest,
    body.dashboardSummaryDigest,
    'Shadow review surface route: review surface binds dashboard summary digest',
  );
  equal(
    body.reviewSurface.digest,
    body.reviewSurfaceDigest,
    'Shadow review surface route: top-level digest matches model digest',
  );
  ok(
    body.reviewSurface.tenantDigest?.startsWith('sha256:'),
    'Shadow review surface route: tenant is digest-bound',
  );
  ok(body.reviewSurface.reviewQueue.length > 0, 'Shadow review surface route: review queue is populated');
  ok(body.reviewSurface.caseDigests.length > 0, 'Shadow review surface route: case digests are populated');
  equal(
    body.reviewSurface.decisionSupportOnly,
    true,
    'Shadow review surface route: surface remains decision support only',
  );
  equal(body.reviewSurface.autoEnforce, false, 'Shadow review surface route: surface never auto-enforces');
  equal(body.reviewSurface.rawPayloadStored, false, 'Shadow review surface route: surface is data-minimized');
  equal(body.reviewSurface.hostedUiImplemented, false, 'Shadow review surface route: hosted UI is not claimed');
  equal(body.reviewSurface.reviewMaterialOnly, true, 'Shadow review surface route: surface is review material only');
  ok(
    !serializedSurface.includes('tenant_shadow_dashboard'),
    'Shadow review surface route: raw tenant id stays outside the surface payload',
  );
  ok(!text.includes('raw_customer_marker_must_not_escape'), 'Shadow review surface route: raw recipient is not returned');
  ok(!text.includes('review_surface_raw_evidence_must_not_escape'), 'Shadow review surface route: raw evidence ids are not returned');
  ok(!text.includes('raw_note_must_not_escape'), 'Shadow review surface route: raw observed features are not returned');
}

async function testReviewSurfaceHtmlPreviewRouteRendersReviewMaterial(): Promise<void> {
  const app = createApp([
    createEvent(),
    createEvent({
      mode: 'enforce',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:html_preview_route_raw_evidence_must_not_escape'],
      occurredAt: '2026-05-03T10:03:02.000Z',
      blocked: true,
    }),
  ]);
  const response = await app.request('/api/v1/shadow/review-surface/view');
  const html = await response.text();

  equal(response.status, 200, 'Shadow review surface HTML route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow review surface HTML route: response is no-store');
  ok(
    response.headers.get('content-type')?.includes('text/html'),
    'Shadow review surface HTML route: content type is HTML',
  );
  equal(
    response.headers.get('x-content-type-options'),
    'nosniff',
    'Shadow review surface HTML route: nosniff header is set',
  );
  equal(
    response.headers.get('referrer-policy'),
    'no-referrer',
    'Shadow review surface HTML route: referrer policy is no-referrer',
  );
  equal(response.headers.get('x-frame-options'), 'DENY', 'Shadow review surface HTML route: frame denial header is set');
  ok(
    response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"),
    'Shadow review surface HTML route: CSP denies framing',
  );
  ok(html.includes('Attestor review surface'), 'Shadow review surface HTML route: page identity renders');
  ok(html.includes('Review queue'), 'Shadow review surface HTML route: review queue renders');
  ok(html.includes('/api/v1/shadow/review-surface/cases/'), 'Shadow review surface HTML route: case detail route renders');
  ok(html.includes('Review material only'), 'Shadow review surface HTML route: boundary renders');
  ok(!html.includes('raw_customer_marker_must_not_escape'), 'Shadow review surface HTML route: raw recipient is not returned');
  ok(!html.includes('html_preview_route_raw_evidence_must_not_escape'), 'Shadow review surface HTML route: raw evidence ids are not returned');
  ok(!html.includes('raw_note_must_not_escape'), 'Shadow review surface HTML route: raw observed features are not returned');
}

async function testReviewSurfaceExportRouteReturnsDownloadArtifact(): Promise<void> {
  const app = createApp([
    createEvent(),
    createEvent({
      mode: 'enforce',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:export_route_raw_evidence_must_not_escape'],
      occurredAt: '2026-05-03T10:03:02.000Z',
      blocked: true,
    }),
  ]);
  const response = await app.request('/api/v1/shadow/review-surface/export');
  const text = await response.text();
  const body = JSON.parse(text) as {
    version: string;
    exportKind: string;
    mediaType: string;
    sourceReviewSurfaceDigest: string;
    reviewSurface: { digest: string; rawPayloadStored: boolean; decisionSupportOnly: boolean };
    caseDetails: readonly {
      caseDigest: string;
      rawCaseMaterialStored: boolean;
      decisionSupportOnly: boolean;
      canAdmit: boolean;
      canBlockAction: boolean;
    }[];
    boundary: {
      rawPayloadStored: boolean;
      rawCaseMaterialStored: boolean;
      autoEnforce: boolean;
      productionReady: boolean;
      complianceClaimed: boolean;
      customerPepNoBypassProven: boolean;
    };
    digest: string;
  };

  equal(response.status, 200, 'Shadow review surface export route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow review surface export route: response is no-store');
  ok(
    response.headers.get('content-type')?.includes('application/json'),
    'Shadow review surface export route: content type is JSON',
  );
  equal(
    response.headers.get('content-disposition'),
    'attachment; filename="attestor-review-surface-export.json"',
    'Shadow review surface export route: content disposition is attachment',
  );
  equal(
    response.headers.get('x-content-type-options'),
    'nosniff',
    'Shadow review surface export route: nosniff header is set',
  );
  equal(body.version, 'attestor.review-surface-export.v1', 'Shadow review surface export route: export version is returned');
  equal(body.exportKind, 'attestor-review-surface-json', 'Shadow review surface export route: export kind is stable');
  equal(body.mediaType, 'application/json', 'Shadow review surface export route: export media type is JSON');
  equal(
    body.sourceReviewSurfaceDigest,
    body.reviewSurface.digest,
    'Shadow review surface export route: export binds the review surface digest',
  );
  ok(body.caseDetails.length > 0, 'Shadow review surface export route: case details are included');
  equal(body.reviewSurface.rawPayloadStored, false, 'Shadow review surface export route: review surface is data-minimized');
  equal(body.reviewSurface.decisionSupportOnly, true, 'Shadow review surface export route: review surface is decision support only');
  equal(body.caseDetails[0]?.rawCaseMaterialStored, false, 'Shadow review surface export route: case material stays out');
  equal(body.caseDetails[0]?.decisionSupportOnly, true, 'Shadow review surface export route: case details remain decision support only');
  equal(body.caseDetails[0]?.canAdmit, false, 'Shadow review surface export route: case detail cannot admit');
  equal(body.caseDetails[0]?.canBlockAction, false, 'Shadow review surface export route: case detail cannot block by itself');
  equal(body.boundary.rawPayloadStored, false, 'Shadow review surface export route: boundary stores no raw payload');
  equal(body.boundary.rawCaseMaterialStored, false, 'Shadow review surface export route: boundary stores no raw case material');
  equal(body.boundary.autoEnforce, false, 'Shadow review surface export route: export never auto-enforces');
  equal(body.boundary.productionReady, false, 'Shadow review surface export route: production readiness is not claimed');
  equal(body.boundary.complianceClaimed, false, 'Shadow review surface export route: compliance is not claimed');
  equal(
    body.boundary.customerPepNoBypassProven,
    false,
    'Shadow review surface export route: customer PEP no-bypass proof is not claimed',
  );
  ok(body.digest.startsWith('sha256:'), 'Shadow review surface export route: export digest is returned');
  ok(!text.includes('raw_customer_marker_must_not_escape'), 'Shadow review surface export route: raw recipient is not returned');
  ok(!text.includes('export_route_raw_evidence_must_not_escape'), 'Shadow review surface export route: raw evidence ids are not returned');
  ok(!text.includes('raw_note_must_not_escape'), 'Shadow review surface export route: raw observed features are not returned');
}

async function testReviewSurfaceCaseRouteReturnsDigestOnlyDetail(): Promise<void> {
  const app = createApp([
    createEvent(),
    createEvent({
      mode: 'enforce',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:case_detail_raw_evidence_must_not_escape'],
      occurredAt: '2026-05-03T10:03:02.000Z',
      blocked: true,
    }),
  ]);
  const surfaceResponse = await app.request('/api/v1/shadow/review-surface');
  const surfaceBody = await surfaceResponse.json() as {
    reviewSurface: { caseDigests: readonly string[] };
  };
  const caseDigest = surfaceBody.reviewSurface.caseDigests[0] ?? '';
  const response = await app.request(
    `/api/v1/shadow/review-surface/cases/${encodeURIComponent(caseDigest)}`,
  );
  const text = await response.text();
  const body = JSON.parse(text) as {
    tenant: { tenantId: string };
    productionReady: boolean;
    complianceClaimed: boolean;
    decisionSupportOnly: boolean;
    autoEnforce: boolean;
    rawPayloadStored: boolean;
    source: string;
    reviewSurfaceDigest: string;
    caseDetail: {
      area: string;
      caseDigest: string;
      queueItemId: string | null;
      eventDigests: readonly string[];
      evidenceDigests: readonly string[];
      proofLinkDigests: readonly string[];
      correlationDigests: readonly string[];
      rawPayloadStored: boolean;
      rawCaseMaterialStored: boolean;
      decisionSupportOnly: boolean;
      autoEnforce: boolean;
      productionReady: boolean;
      canAdmit: boolean;
      canBlockAction: boolean;
    };
  };

  equal(response.status, 200, 'Shadow review case route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow review case route: response is no-store');
  equal(body.tenant.tenantId, 'tenant_shadow_dashboard', 'Shadow review case route: tenant context is included');
  equal(body.productionReady, false, 'Shadow review case route: production readiness is not claimed');
  equal(body.complianceClaimed, false, 'Shadow review case route: compliance is not claimed');
  equal(body.decisionSupportOnly, true, 'Shadow review case route: route is decision support only');
  equal(body.autoEnforce, false, 'Shadow review case route: route never auto-enforces');
  equal(body.rawPayloadStored, false, 'Shadow review case route: raw payload boundary is explicit');
  equal(body.source, 'attestor-review-surface', 'Shadow review case route: source is explicit');
  equal(body.caseDetail.area, 'cases', 'Shadow review case route: case detail area is cases');
  equal(body.caseDetail.caseDigest, caseDigest, 'Shadow review case route: requested case digest is retained');
  ok(body.caseDetail.eventDigests.length > 0, 'Shadow review case route: event digests are attached');
  ok(body.caseDetail.evidenceDigests.length > 0, 'Shadow review case route: evidence digests are attached');
  ok(body.caseDetail.proofLinkDigests.length > 0, 'Shadow review case route: proof link digests are attached');
  ok(
    body.caseDetail.correlationDigests.includes(body.reviewSurfaceDigest),
    'Shadow review case route: case detail binds the review surface digest',
  );
  equal(body.caseDetail.rawPayloadStored, false, 'Shadow review case route: detail stores no raw payload');
  equal(body.caseDetail.rawCaseMaterialStored, false, 'Shadow review case route: detail stores no raw case material');
  equal(body.caseDetail.decisionSupportOnly, true, 'Shadow review case route: detail is decision support only');
  equal(body.caseDetail.autoEnforce, false, 'Shadow review case route: detail never auto-enforces');
  equal(body.caseDetail.productionReady, false, 'Shadow review case route: detail claims no production readiness');
  equal(body.caseDetail.canAdmit, false, 'Shadow review case route: detail cannot admit');
  equal(body.caseDetail.canBlockAction, false, 'Shadow review case route: detail cannot block by itself');
  ok(!text.includes('raw_customer_marker_must_not_escape'), 'Shadow review case route: raw recipient is not returned');
  ok(!text.includes('case_detail_raw_evidence_must_not_escape'), 'Shadow review case route: raw evidence ids are not returned');
  ok(!text.includes('raw_note_must_not_escape'), 'Shadow review case route: raw observed features are not returned');
}

async function testReviewSurfaceCaseRouteRejectsUnknownCase(): Promise<void> {
  const app = createApp([createEvent()]);
  const response = await app.request(
    `/api/v1/shadow/review-surface/cases/${encodeURIComponent('sha256:unknown-case')}`,
  );
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly detail: string;
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 404, 'Shadow review case route: unknown case returns 404');
  equal(response.headers.get('cache-control'), 'no-store', 'Shadow review case route: unknown case is no-store');
  equal(
    body.detail,
    'The requested review case is not available for the current tenant.',
    'Shadow review case route: unknown case detail is bounded',
  );
  ok(
    body.reasonCodes.includes('attestor-review-case-unavailable'),
    'Shadow review case route: unknown case reason is stable',
  );
  ok(!text.includes('raw_customer_marker_must_not_escape'), 'Shadow review case route: unknown case does not leak raw recipient');
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

async function expectDashboardTenantBoundaryFailure(
  route: string,
  message: string,
): Promise<void> {
  const foreignTenantId = 'tenant_shadow_dashboard_foreign';
  const app = createApp([
    createEvent({ tenantId: foreignTenantId }),
  ]);
  const response = await app.request(route);
  const text = await response.text();
  const body = JSON.parse(text) as { readonly detail?: string };

  equal(response.status, 503, `${message}: foreign tenant event fails closed`);
  ok(
    typeof body.detail === 'string' && body.detail.includes('tenant boundary violation'),
    `${message}: safe tenant-boundary reason is returned`,
  );
  ok(!text.includes(foreignTenantId), `${message}: foreign tenant id is not disclosed`);
}

async function testDashboardRoutesRejectForeignTenantEvents(): Promise<void> {
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

await testAuditEvidenceRouteIsNoStoreAndRedacted();
await testBusinessRiskDashboardRouteIsDecisionSupportOnly();
await testDashboardSummaryRouteReturnsCompactBusinessView();
await testReviewSurfaceRouteReturnsDigestOnlyWorkspace();
await testReviewSurfaceHtmlPreviewRouteRendersReviewMaterial();
await testReviewSurfaceExportRouteReturnsDownloadArtifact();
await testReviewSurfaceCaseRouteReturnsDigestOnlyDetail();
await testReviewSurfaceCaseRouteRejectsUnknownCase();
await testEmptyDashboardRoutesAreExplicit();
await testDashboardRoutesRejectForeignTenantEvents();

console.log(`Shadow dashboard route tests: ${passed} passed, 0 failed`);
