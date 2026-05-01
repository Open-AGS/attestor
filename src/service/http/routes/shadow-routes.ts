import type { Context, Hono } from 'hono';
import {
  createConsequenceAdmissionProblem,
  createActionRiskInventory,
  createShadowPolicyDiscoveryCandidates,
  createShadowSummarySurface,
  type ShadowAdmissionEvent,
  type ShadowPolicySimulationReport,
} from '../../../consequence-admission/index.js';
import {
  SHADOW_POLICY_CANDIDATE_STATUSES,
  type ShadowPolicyCandidateStatus,
  type ShadowPolicyCandidateStoreRecord,
  type UpsertShadowPolicyCandidateBundleResult,
} from '../../shadow-persistence-store.js';
import type { TenantContext } from '../../tenant-isolation.js';

type ShadowProblemStatus = 400 | 404 | 409 | 503;

export interface ShadowRouteDeps {
  currentTenant(context: Context): TenantContext;
  listShadowEvents(input: { readonly tenant: TenantContext }): readonly ShadowAdmissionEvent[];
  listShadowSimulations?(
    input: { readonly tenant: TenantContext },
  ): readonly ShadowPolicySimulationReport[];
  materializeShadowPolicyCandidates?(input: {
    readonly tenant: TenantContext;
    readonly bundle: ReturnType<typeof createShadowPolicyDiscoveryCandidates>;
  }): UpsertShadowPolicyCandidateBundleResult;
  listShadowPolicyCandidateRecords?(input: {
    readonly tenant: TenantContext;
    readonly status: ShadowPolicyCandidateStatus | null;
  }): readonly ShadowPolicyCandidateStoreRecord[];
  transitionShadowPolicyCandidateStatus?(input: {
    readonly tenant: TenantContext;
    readonly candidateId: string;
    readonly status: ShadowPolicyCandidateStatus;
    readonly actorRef: string;
    readonly reason: string;
  }): ShadowPolicyCandidateStoreRecord;
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCandidateStatus(value: string | null | undefined): ShadowPolicyCandidateStatus | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_POLICY_CANDIDATE_STATUSES.includes(normalized as ShadowPolicyCandidateStatus)
    ? normalized as ShadowPolicyCandidateStatus
    : null;
}

function problem(c: Context, input: {
  readonly type: string;
  readonly title: string;
  readonly status: ShadowProblemStatus;
  readonly detail: string;
  readonly reasonCodes: readonly string[];
}) {
  return c.json(createConsequenceAdmissionProblem({
    ...input,
    instance: c.req.path,
  }), input.status);
}

async function readStatusTransitionBody(c: Context): Promise<{
  readonly status: ShadowPolicyCandidateStatus;
  readonly actorRef: string;
  readonly reason: string;
} | Response> {
  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return problem(c, {
      type: 'https://attestor.dev/problems/policy-candidate-status-json-invalid',
      title: 'Invalid policy candidate status JSON',
      status: 400,
      detail: 'The policy candidate status route requires a valid JSON object.',
      reasonCodes: ['invalid-json'],
    });
  }
  if (!isRecord(body)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/policy-candidate-status-input-invalid',
      title: 'Invalid policy candidate status input',
      status: 400,
      detail: 'The policy candidate status route requires an object body.',
      reasonCodes: ['invalid-policy-candidate-status-input'],
    });
  }
  const status = typeof body.status === 'string' ? parseCandidateStatus(body.status) : null;
  const actorRef = typeof body.actorRef === 'string' ? body.actorRef.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!status || !actorRef || !reason) {
    return problem(c, {
      type: 'https://attestor.dev/problems/policy-candidate-status-input-invalid',
      title: 'Invalid policy candidate status input',
      status: 400,
      detail:
        'The policy candidate status route requires status, actorRef, and reason. Status must be one of the supported candidate states.',
      reasonCodes: ['invalid-policy-candidate-status-input'],
    });
  }
  return { status, actorRef, reason };
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

  app.post('/api/v1/shadow/policy-candidates/materialize', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;
    if (!deps.materializeShadowPolicyCandidates) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy candidate materialization is not configured for this runtime.',
        reasonCodes: ['policy-candidate-store-unavailable'],
      });
    }

    const bundle = createShadowPolicyDiscoveryCandidates({
      report: result.surface.latestSimulation,
      generatedAt: deps.now?.() ?? null,
    });
    try {
      const persisted = deps.materializeShadowPolicyCandidates({
        tenant: result.tenant,
        bundle,
      });
      return c.json({
        tenant: tenantSummary(result.tenant),
        version: bundle.version,
        generatedAt: bundle.generatedAt,
        candidateCount: bundle.candidateCount,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        persisted: {
          records: persisted.records,
          createdCount: persisted.createdCount,
          updatedCount: persisted.updatedCount,
          unchangedCount: persisted.unchangedCount,
        },
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Policy candidates could not be materialized.';
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-materialize-failed',
        title: 'Policy candidate materialization failed',
        status: 503,
        detail,
        reasonCodes: ['policy-candidate-materialize-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/policy-candidate-records', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy candidate record listing is not configured for this runtime.',
        reasonCodes: ['policy-candidate-store-unavailable'],
      });
    }
    const statusQuery = c.req.query('status');
    const status = parseCandidateStatus(statusQuery);
    if (statusQuery && !status) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-status-invalid',
        title: 'Invalid policy candidate status',
        status: 400,
        detail: `Policy candidate status must be one of: ${SHADOW_POLICY_CANDIDATE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-candidate-status'],
      });
    }
    try {
      const tenant = deps.currentTenant(c);
      const records = deps.listShadowPolicyCandidateRecords({ tenant, status });
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        recordCount: records.length,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        productionReady: false,
        records,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Policy candidate records could not be listed.';
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-records-unavailable',
        title: 'Policy candidate records unavailable',
        status: 503,
        detail,
        reasonCodes: ['policy-candidate-records-unavailable'],
      });
    }
  });

  app.patch('/api/v1/shadow/policy-candidates/:candidateId/status', async (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.transitionShadowPolicyCandidateStatus) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy candidate status transitions are not configured for this runtime.',
        reasonCodes: ['policy-candidate-store-unavailable'],
      });
    }
    const body = await readStatusTransitionBody(c);
    if (body instanceof Response) return body;

    try {
      const tenant = deps.currentTenant(c);
      const record = deps.transitionShadowPolicyCandidateStatus({
        tenant,
        candidateId: c.req.param('candidateId'),
        status: body.status,
        actorRef: body.actorRef,
        reason: body.reason,
      });
      return c.json({
        tenant: tenantSummary(tenant),
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        record,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Policy candidate status could not be transitioned.';
      const status: ShadowProblemStatus = detail.includes('was not found')
        ? 404
        : detail.includes('cannot transition')
          ? 409
          : 503;
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-status-transition-failed',
        title: 'Policy candidate status transition failed',
        status,
        detail,
        reasonCodes: ['policy-candidate-status-transition-failed'],
      });
    }
  });
}
