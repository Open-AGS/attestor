import type { Context, Hono } from 'hono';
import {
  createAttestorReviewCaseDetail,
  createAttestorReviewSurface,
  createActionRiskInventory,
  createConsequenceAuditEvidenceExport,
  createConsequenceBusinessRiskDashboard,
  createConsequenceDashboardApiSummary,
  createShadowPolicyDiscoveryCandidates,
  createShadowSummarySurface,
  type ShadowAdmissionEvent,
  type ShadowPolicySimulationReport,
} from '../../../consequence-admission/index.js';
import type { TenantContext } from '../../tenant-isolation.js';
import { secureHtmlResponseHeaders } from '../route-response-helpers.js';
import { renderAttestorReviewSurfaceHtmlPreview } from '../../shadow/attestor-review-surface-html-preview.js';
import type { ShadowRouteDeps } from './shadow-routes.js';
import {
  assertTenantBoundRecords,
  boundedErrorDetail,
  caughtErrorStatus,
  problem,
  tenantSummary,
} from './shadow-route-helpers.js';

export type SafeShadowSummaryResult = {
  readonly tenant: TenantContext;
  readonly events: readonly ShadowAdmissionEvent[];
  readonly simulations: readonly ShadowPolicySimulationReport[];
  readonly surface: ReturnType<typeof createShadowSummarySurface>;
};

type ShadowDashboardReadModels = {
  readonly auditEvidence: ReturnType<typeof createConsequenceAuditEvidenceExport>;
  readonly dashboard: ReturnType<typeof createConsequenceBusinessRiskDashboard>;
  readonly summary: ReturnType<typeof createConsequenceDashboardApiSummary>;
};

type ShadowReviewSurfaceReadModels = ShadowDashboardReadModels & {
  readonly reviewSurface: ReturnType<typeof createAttestorReviewSurface>;
};

export type SafeShadowReviewSurfaceResult =
  SafeShadowSummaryResult & ShadowReviewSurfaceReadModels;

export function safeShadowSummary(
  c: Context,
  deps: ShadowRouteDeps,
  tenantInput?: TenantContext,
): SafeShadowSummaryResult | Response {
  c.header('cache-control', 'no-store');

  try {
    const tenant = tenantInput ?? deps.currentTenant(c);
    const events = assertTenantBoundRecords(
      tenant,
      deps.listShadowEvents({ tenant }),
      'shadow admission event',
      { allowNullTenantId: true },
    );
    const simulations = deps.listShadowSimulations?.({ tenant }) ?? [];
    const surface = createShadowSummarySurface({
      events,
      simulations,
      generatedAt: deps.now?.() ?? null,
      proposedMode: 'review',
    });

    return {
      tenant,
      events,
      simulations,
      surface,
    };
  } catch (error) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-summary-unavailable',
      title: 'Shadow summary unavailable',
      status: 503,
      detail: boundedErrorDetail(error, 'The shadow summary could not be evaluated.', {
        tenantBoundarySafeDetail: 'The shadow summary rejected a tenant boundary violation.',
      }),
      reasonCodes: ['shadow-summary-unavailable'],
    });
  }
}

function simulationsForAuditEvidence(input: {
  readonly simulations: readonly ShadowPolicySimulationReport[];
  readonly latestSimulation: ShadowPolicySimulationReport | null;
}): readonly ShadowPolicySimulationReport[] {
  if (input.simulations.length > 0) return input.simulations;
  return input.latestSimulation ? Object.freeze([input.latestSimulation]) : Object.freeze([]);
}

function createShadowAuditEvidence(
  result: SafeShadowSummaryResult,
): ReturnType<typeof createConsequenceAuditEvidenceExport> {
  const policyDiscovery = createShadowPolicyDiscoveryCandidates({
    report: result.surface.latestSimulation,
    generatedAt: result.surface.generatedAt,
  });
  return createConsequenceAuditEvidenceExport({
    events: result.events,
    summarySurface: result.surface,
    simulations: simulationsForAuditEvidence({
      simulations: result.simulations,
      latestSimulation: result.surface.latestSimulation,
    }),
    policyDiscovery,
    generatedAt: result.surface.generatedAt,
    tenantId: result.tenant.tenantId,
  });
}

function createShadowDashboardReadModels(
  result: SafeShadowSummaryResult,
): ShadowDashboardReadModels {
  const auditEvidence = createShadowAuditEvidence(result);
  const dashboard = createConsequenceBusinessRiskDashboard({
    auditExport: auditEvidence,
    generatedAt: result.surface.generatedAt,
  });
  const summary = createConsequenceDashboardApiSummary({
    auditEvidence,
    dashboard,
    generatedAt: result.surface.generatedAt,
  });

  return { auditEvidence, dashboard, summary };
}

function createShadowReviewSurfaceReadModels(
  result: SafeShadowSummaryResult,
): ShadowReviewSurfaceReadModels {
  const models = createShadowDashboardReadModels(result);
  return {
    ...models,
    reviewSurface: createAttestorReviewSurface({
      auditEvidence: models.auditEvidence,
      businessRiskDashboard: models.dashboard,
      dashboardSummary: models.summary,
      generatedAt: result.surface.generatedAt,
    }),
  };
}

export function safeShadowReviewSurface(
  c: Context,
  deps: ShadowRouteDeps,
): SafeShadowReviewSurfaceResult | Response {
  const result = safeShadowSummary(c, deps);
  if (result instanceof Response) return result;

  try {
    return {
      ...result,
      ...createShadowReviewSurfaceReadModels(result),
    };
  } catch (error) {
    return problem(c, {
      type: 'https://attestor.dev/problems/attestor-review-surface-unavailable',
      title: 'Attestor review surface unavailable',
      status: 503,
      detail: boundedErrorDetail(
        error,
        'The Attestor review surface could not be evaluated.',
        {
          tenantBoundarySafeDetail:
            'The Attestor review surface rejected a tenant boundary violation.',
        },
      ),
      reasonCodes: ['attestor-review-surface-unavailable'],
    });
  }
}

export function registerShadowSummaryDashboardRoutes(app: Hono, deps: ShadowRouteDeps): void {
  app.get('/api/v1/shadow/summary', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;

    return c.json({
      tenant: tenantSummary(result.tenant),
      ...result.surface,
    });
  });

  app.get('/api/v1/shadow/recommendations', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;

    return c.json({
      tenant: tenantSummary(result.tenant),
      version: result.surface.version,
      generatedAt: result.surface.generatedAt,
      storageMode: result.surface.storageMode,
      productionReady: result.surface.productionReady,
      rawPayloadStored: result.surface.rawPayloadStored,
      eventCount: result.surface.eventCount,
      recommendationCount: result.surface.recommendations.length,
      recommendations: result.surface.recommendations,
      latestSimulationDigest: result.surface.latestSimulation?.digest ?? null,
      source: 'shadow-summary',
    });
  });

  app.get('/api/v1/shadow/action-risk-inventory', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;

    return c.json({
      tenant: tenantSummary(result.tenant),
      ...createActionRiskInventory({
        events: result.events,
        generatedAt: deps.now?.() ?? null,
      }),
    });
  });

  app.get('/api/v1/shadow/audit-evidence', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;
    const auditEvidence = createShadowAuditEvidence(result);

    return c.json({
      tenant: tenantSummary(result.tenant),
      storageMode: result.surface.storageMode,
      productionReady: false,
      complianceClaimed: false,
      approvalRequired: true,
      autoEnforce: false,
      rawPayloadStored: false,
      source: 'shadow-summary',
      auditEvidence,
    });
  });

  app.get('/api/v1/shadow/business-risk-dashboard', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;
    const { auditEvidence, dashboard } = createShadowDashboardReadModels(result);

    return c.json({
      tenant: tenantSummary(result.tenant),
      storageMode: result.surface.storageMode,
      productionReady: false,
      complianceClaimed: false,
      decisionSupportOnly: true,
      autoEnforce: false,
      rawPayloadStored: false,
      rawImpactValueStored: false,
      impactMode: dashboard.impactMode,
      source: 'audit-evidence',
      auditEvidenceDigest: auditEvidence.digest,
      dashboard,
    });
  });

  app.get('/api/v1/shadow/dashboard-summary', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;
    const { auditEvidence, dashboard, summary } = createShadowDashboardReadModels(result);

    return c.json({
      tenant: tenantSummary(result.tenant),
      storageMode: result.surface.storageMode,
      productionReady: false,
      complianceClaimed: false,
      decisionSupportOnly: true,
      autoEnforce: false,
      rawPayloadStored: false,
      rawImpactValueStored: false,
      source: 'business-risk-dashboard',
      auditEvidenceDigest: auditEvidence.digest,
      dashboardDigest: dashboard.digest,
      summary,
    });
  });

  app.get('/api/v1/shadow/review-surface', (c) => {
    const result = safeShadowReviewSurface(c, deps);
    if (result instanceof Response) return result;

    return c.json({
      tenant: tenantSummary(result.tenant),
      storageMode: result.surface.storageMode,
      productionReady: false,
      complianceClaimed: false,
      decisionSupportOnly: true,
      autoEnforce: false,
      rawPayloadStored: false,
      source: 'dashboard-summary',
      auditEvidenceDigest: result.auditEvidence.digest,
      dashboardDigest: result.dashboard.digest,
      dashboardSummaryDigest: result.summary.digest,
      reviewSurfaceDigest: result.reviewSurface.digest,
      reviewSurface: result.reviewSurface,
    });
  });

  app.get('/api/v1/shadow/review-surface/view', (c) => {
    const result = safeShadowReviewSurface(c, deps);
    if (result instanceof Response) return result;

    return c.body(
      renderAttestorReviewSurfaceHtmlPreview(result.reviewSurface),
      200,
      secureHtmlResponseHeaders(),
    );
  });

  app.get('/api/v1/shadow/review-surface/cases/:caseDigest', (c) => {
    const result = safeShadowReviewSurface(c, deps);
    if (result instanceof Response) return result;

    try {
      const caseDetail = createAttestorReviewCaseDetail({
        reviewSurface: result.reviewSurface,
        caseDigest: c.req.param('caseDigest'),
        eventDigests: result.auditEvidence.sampleEventDigests,
        evidenceDigests: result.auditEvidence.artifactRefs.map((artifact) => artifact.digest),
        proofLinkDigests: [
          result.auditEvidence.digest,
          result.dashboard.digest,
          result.summary.digest,
        ],
      });

      return c.json({
        tenant: tenantSummary(result.tenant),
        storageMode: result.surface.storageMode,
        productionReady: false,
        complianceClaimed: false,
        decisionSupportOnly: true,
        autoEnforce: false,
        rawPayloadStored: false,
        source: 'attestor-review-surface',
        auditEvidenceDigest: result.auditEvidence.digest,
        dashboardDigest: result.dashboard.digest,
        dashboardSummaryDigest: result.summary.digest,
        reviewSurfaceDigest: result.reviewSurface.digest,
        caseDetail,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/attestor-review-case-unavailable',
        title: 'Attestor review case unavailable',
        status: caughtErrorStatus(error, {
          statusMarkers: [
            { marker: 'caseDigest must exist', status: 404 },
            { marker: 'queueItemId must exist', status: 404 },
            { marker: 'queueItemId must match', status: 404 },
          ],
          defaultStatus: 400,
        }),
        detail: boundedErrorDetail(
          error,
          'The Attestor review case could not be evaluated.',
          {
            safeMarkers: ['Attestor review surface case detail'],
            safeDetail: 'The requested review case is not available for the current tenant.',
          },
        ),
        reasonCodes: ['attestor-review-case-unavailable'],
      });
    }
  });
}
