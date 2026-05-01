import type { Context, Hono } from 'hono';
import {
  createConsequenceAdmissionProblem,
  createActionRiskInventory,
  createShadowPolicyDiscoveryCandidates,
  createShadowSummarySurface,
  type ShadowAdmissionEvent,
  type ShadowPolicySimulationReport,
} from '../../../consequence-admission/index.js';
import type { TenantContext } from '../../tenant-isolation.js';

export interface ShadowRouteDeps {
  currentTenant(context: Context): TenantContext;
  listShadowEvents(input: { readonly tenant: TenantContext }): readonly ShadowAdmissionEvent[];
  listShadowSimulations?(
    input: { readonly tenant: TenantContext },
  ): readonly ShadowPolicySimulationReport[];
  now?(): string;
}

function tenantSummary(tenant: TenantContext): {
  readonly tenantId: string;
  readonly source: TenantContext['source'];
  readonly planId: string | null;
} {
  return Object.freeze({
    tenantId: tenant.tenantId,
    source: tenant.source,
    planId: tenant.planId,
  });
}

function safeShadowSummary(c: Context, deps: ShadowRouteDeps) {
  c.header('cache-control', 'no-store');

  try {
    const tenant = deps.currentTenant(c);
    const events = deps.listShadowEvents({ tenant });
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
      surface,
    };
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : 'The shadow summary could not be evaluated.';
    const problem = createConsequenceAdmissionProblem({
      type: 'https://attestor.dev/problems/shadow-summary-unavailable',
      title: 'Shadow summary unavailable',
      status: 503,
      detail,
      instance: c.req.path,
      reasonCodes: ['shadow-summary-unavailable'],
    });
    return c.json(problem, 503);
  }
}

export function registerShadowRoutes(app: Hono, deps: ShadowRouteDeps): void {
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

  app.get('/api/v1/shadow/policy-candidates', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;

    return c.json({
      tenant: tenantSummary(result.tenant),
      ...createShadowPolicyDiscoveryCandidates({
        report: result.surface.latestSimulation,
        generatedAt: deps.now?.() ?? null,
      }),
    });
  });
}
