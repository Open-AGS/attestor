import type { Context, Hono } from 'hono';
import {
  createConsequenceAdmissionProblem,
  createActionRiskInventory,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicyBundlePublication,
  createShadowPolicyBundleSigningPayload,
  createShadowPolicyPromotionDraft,
  createShadowPolicyPromotionPacket,
  createShadowPolicyPromotionSimulation,
  createShadowPolicySimulationReport,
  createShadowSummarySurface,
  GENERIC_ADMISSION_MODES,
  SHADOW_POLICY_PROMOTION_SOURCE_STATUSES,
  type GenericAdmissionMode,
  type ShadowPolicyBundlePublicationSignature,
  type ShadowPolicyBundleSigningPayload,
  type ShadowPolicyPromotionSourceStatus,
  type ShadowAdmissionEvent,
  type ShadowPolicySimulationReport,
} from '../../../consequence-admission/index.js';
import {
  SHADOW_POLICY_CANDIDATE_STATUSES,
  type AppendShadowPolicySimulationReportResult,
  type ShadowPolicyCandidateStatus,
  type ShadowPolicyCandidateStoreRecord,
  type ShadowPolicySimulationReportStoreRecord,
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
  recordShadowPolicySimulationReport?(input: {
    readonly tenant: TenantContext;
    readonly report: ShadowPolicySimulationReport;
  }): AppendShadowPolicySimulationReportResult;
  listShadowPolicySimulationReports?(input: {
    readonly tenant: TenantContext;
    readonly proposedMode: GenericAdmissionMode | null;
  }): readonly ShadowPolicySimulationReportStoreRecord[];
  findShadowPolicySimulationReport?(input: {
    readonly tenant: TenantContext;
    readonly reportId: string;
  }): ShadowPolicySimulationReportStoreRecord | null;
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
  signShadowPolicyBundlePublication?(input: {
    readonly tenant: TenantContext;
    readonly payload: ShadowPolicyBundleSigningPayload;
  }): ShadowPolicyBundlePublicationSignature;
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

function parseGenericMode(value: string | null | undefined): GenericAdmissionMode | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return GENERIC_ADMISSION_MODES.includes(normalized as GenericAdmissionMode)
    ? normalized as GenericAdmissionMode
    : null;
}

function parsePromotionSourceStatus(
  value: string | null | undefined,
): ShadowPolicyPromotionSourceStatus | null {
  if (value === undefined || value === null || value.trim() === '') return 'approved';
  const normalized = value.trim();
  return SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.includes(normalized as ShadowPolicyPromotionSourceStatus)
    ? normalized as ShadowPolicyPromotionSourceStatus
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

async function readSimulationRequestBody(c: Context): Promise<{
  readonly proposedMode: GenericAdmissionMode;
  readonly minimumPromotionEvents: number | null;
} | Response> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-json-required',
      title: 'Shadow simulation JSON required',
      status: 400,
      detail: 'The shadow simulation route requires a JSON object body with an explicit proposedMode.',
      reasonCodes: ['shadow-simulation-json-required'],
    });
  }

  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-json-invalid',
      title: 'Invalid shadow simulation JSON',
      status: 400,
      detail: 'The shadow simulation route requires a valid JSON object when a body is provided.',
      reasonCodes: ['invalid-json'],
    });
  }
  if (!isRecord(body)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-input-invalid',
      title: 'Invalid shadow simulation input',
      status: 400,
      detail: 'The shadow simulation route requires an object body when a body is provided.',
      reasonCodes: ['invalid-shadow-simulation-input'],
    });
  }

  const proposedMode = typeof body.proposedMode === 'string'
    ? parseGenericMode(body.proposedMode)
    : null;
  if (body.proposedMode === undefined || body.proposedMode === null) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-mode-required',
      title: 'Shadow simulation mode required',
      status: 400,
      detail: `proposedMode is required and must be one of: ${GENERIC_ADMISSION_MODES.join(', ')}.`,
      reasonCodes: ['shadow-simulation-mode-required'],
    });
  }
  if (!proposedMode) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-mode-invalid',
      title: 'Invalid shadow simulation mode',
      status: 400,
      detail: `proposedMode must be one of: ${GENERIC_ADMISSION_MODES.join(', ')}.`,
      reasonCodes: ['invalid-shadow-simulation-mode'],
    });
  }

  const minimumPromotionEvents = body.minimumPromotionEvents === undefined || body.minimumPromotionEvents === null
    ? null
    : Number(body.minimumPromotionEvents);
  if (
    minimumPromotionEvents !== null &&
    (!Number.isInteger(minimumPromotionEvents) || minimumPromotionEvents <= 0 || minimumPromotionEvents > 10_000)
  ) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-input-invalid',
      title: 'Invalid shadow simulation input',
      status: 400,
      detail: 'minimumPromotionEvents must be a positive integer no larger than 10000.',
      reasonCodes: ['invalid-shadow-simulation-input'],
    });
  }

  return {
    proposedMode,
    minimumPromotionEvents,
  };
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

  app.post('/api/v1/shadow/simulations', async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readSimulationRequestBody(c);
    if (body instanceof Response) return body;
    if (!deps.recordShadowPolicySimulationReport) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-store-unavailable',
        title: 'Shadow simulation store unavailable',
        status: 503,
        detail: 'Shadow simulation persistence is not configured for this runtime.',
        reasonCodes: ['shadow-simulation-store-unavailable'],
      });
    }

    try {
      const tenant = deps.currentTenant(c);
      const events = deps.listShadowEvents({ tenant });
      const report = createShadowPolicySimulationReport({
        events,
        proposedMode: body.proposedMode,
        minimumPromotionEvents: body.minimumPromotionEvents,
        generatedAt: deps.now?.() ?? null,
      });
      const persisted = deps.recordShadowPolicySimulationReport({
        tenant,
        report,
      });
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        rawPayloadStored: false,
        report,
        persisted: {
          kind: persisted.kind,
          record: persisted.record,
        },
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'The shadow simulation report could not be recorded.';
      const status: ShadowProblemStatus = detail.includes('exceeds maximum') ? 400 : 503;
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-record-failed',
        title: 'Shadow simulation record failed',
        status,
        detail,
        reasonCodes: ['shadow-simulation-record-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/simulations', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicySimulationReports) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-store-unavailable',
        title: 'Shadow simulation store unavailable',
        status: 503,
        detail: 'Shadow simulation listing is not configured for this runtime.',
        reasonCodes: ['shadow-simulation-store-unavailable'],
      });
    }
    const modeQuery = c.req.query('proposedMode');
    const proposedMode = parseGenericMode(modeQuery);
    if (modeQuery && !proposedMode) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-mode-invalid',
        title: 'Invalid shadow simulation mode',
        status: 400,
        detail: `proposedMode must be one of: ${GENERIC_ADMISSION_MODES.join(', ')}.`,
        reasonCodes: ['invalid-shadow-simulation-mode'],
      });
    }
    try {
      const tenant = deps.currentTenant(c);
      const records = deps.listShadowPolicySimulationReports({ tenant, proposedMode });
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        recordCount: records.length,
        rawPayloadStored: false,
        productionReady: false,
        records,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'The shadow simulation reports could not be listed.';
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-list-failed',
        title: 'Shadow simulation list failed',
        status: 503,
        detail,
        reasonCodes: ['shadow-simulation-list-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/simulations/:reportId', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.findShadowPolicySimulationReport) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-store-unavailable',
        title: 'Shadow simulation store unavailable',
        status: 503,
        detail: 'Shadow simulation lookup is not configured for this runtime.',
        reasonCodes: ['shadow-simulation-store-unavailable'],
      });
    }
    try {
      const tenant = deps.currentTenant(c);
      const record = deps.findShadowPolicySimulationReport({
        tenant,
        reportId: c.req.param('reportId'),
      });
      if (!record) {
        return problem(c, {
          type: 'https://attestor.dev/problems/shadow-simulation-not-found',
          title: 'Shadow simulation not found',
          status: 404,
          detail: 'No shadow simulation report was found for this tenant and report id.',
          reasonCodes: ['shadow-simulation-not-found'],
        });
      }
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        rawPayloadStored: false,
        productionReady: false,
        record,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'The shadow simulation report could not be loaded.';
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-load-failed',
        title: 'Shadow simulation load failed',
        status: 503,
        detail,
        reasonCodes: ['shadow-simulation-load-failed'],
      });
    }
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

  app.get('/api/v1/shadow/policy-promotion-draft', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy promotion draft generation is not configured for this runtime.',
        reasonCodes: ['policy-candidate-store-unavailable'],
      });
    }
    const statusQuery = c.req.query('status');
    const sourceStatus = parsePromotionSourceStatus(statusQuery);
    if (!sourceStatus) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-source-status-invalid',
        title: 'Invalid policy promotion source status',
        status: 400,
        detail:
          `Policy promotion drafts can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }

    try {
      const tenant = deps.currentTenant(c);
      const records = deps.listShadowPolicyCandidateRecords({
        tenant,
        status: sourceStatus,
      });
      const draft = createShadowPolicyPromotionDraft({
        tenantId: tenant.tenantId,
        records,
        sourceStatus,
        generatedAt: deps.now?.() ?? null,
      });
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        draft,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Policy promotion draft could not be generated.';
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-draft-failed',
        title: 'Policy promotion draft failed',
        status: 503,
        detail,
        reasonCodes: ['policy-promotion-draft-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/policy-promotion-packet', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy promotion packet generation is not configured for this runtime.',
        reasonCodes: ['policy-candidate-store-unavailable'],
      });
    }
    const statusQuery = c.req.query('status');
    const sourceStatus = parsePromotionSourceStatus(statusQuery);
    if (!sourceStatus) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-source-status-invalid',
        title: 'Invalid policy promotion source status',
        status: 400,
        detail:
          `Policy promotion packets can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }

    try {
      const tenant = deps.currentTenant(c);
      const records = deps.listShadowPolicyCandidateRecords({
        tenant,
        status: sourceStatus,
      });
      const draft = createShadowPolicyPromotionDraft({
        tenantId: tenant.tenantId,
        records,
        sourceStatus,
        generatedAt: deps.now?.() ?? null,
      });
      const packet = createShadowPolicyPromotionPacket({
        draft,
        generatedAt: deps.now?.() ?? null,
      });
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        packet,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Policy promotion packet could not be generated.';
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-packet-failed',
        title: 'Policy promotion packet failed',
        status: 503,
        detail,
        reasonCodes: ['policy-promotion-packet-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/policy-promotion-simulation', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy promotion simulation is not configured for this runtime.',
        reasonCodes: ['policy-candidate-store-unavailable'],
      });
    }
    const statusQuery = c.req.query('status');
    const sourceStatus = parsePromotionSourceStatus(statusQuery);
    if (!sourceStatus) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-source-status-invalid',
        title: 'Invalid policy promotion source status',
        status: 400,
        detail:
          `Policy promotion simulations can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }

    try {
      const tenant = deps.currentTenant(c);
      const records = deps.listShadowPolicyCandidateRecords({
        tenant,
        status: sourceStatus,
      });
      const draft = createShadowPolicyPromotionDraft({
        tenantId: tenant.tenantId,
        records,
        sourceStatus,
        generatedAt: deps.now?.() ?? null,
      });
      const packet = createShadowPolicyPromotionPacket({
        draft,
        generatedAt: deps.now?.() ?? null,
      });
      const simulation = createShadowPolicyPromotionSimulation({
        packet,
        events: deps.listShadowEvents({ tenant }),
        generatedAt: deps.now?.() ?? null,
      });
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        simulation,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Policy promotion simulation could not be generated.';
      const status: ShadowProblemStatus = detail.includes('exceeds maximum') ? 400 : 503;
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-simulation-failed',
        title: 'Policy promotion simulation failed',
        status,
        detail,
        reasonCodes: ['policy-promotion-simulation-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/policy-bundle-publication', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy bundle publication is not configured for this runtime.',
        reasonCodes: ['policy-candidate-store-unavailable'],
      });
    }
    const statusQuery = c.req.query('status');
    const sourceStatus = parsePromotionSourceStatus(statusQuery);
    if (!sourceStatus) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-source-status-invalid',
        title: 'Invalid policy promotion source status',
        status: 400,
        detail:
          `Policy bundle publications can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }

    try {
      const tenant = deps.currentTenant(c);
      const records = deps.listShadowPolicyCandidateRecords({
        tenant,
        status: sourceStatus,
      });
      const draft = createShadowPolicyPromotionDraft({
        tenantId: tenant.tenantId,
        records,
        sourceStatus,
        generatedAt: deps.now?.() ?? null,
      });
      const packet = createShadowPolicyPromotionPacket({
        draft,
        generatedAt: deps.now?.() ?? null,
      });
      const simulation = createShadowPolicyPromotionSimulation({
        packet,
        events: deps.listShadowEvents({ tenant }),
        generatedAt: deps.now?.() ?? null,
      });
      const signingPayload = createShadowPolicyBundleSigningPayload(simulation);
      const signature = deps.signShadowPolicyBundlePublication?.({
        tenant,
        payload: signingPayload,
      }) ?? null;
      const publication = createShadowPolicyBundlePublication({
        simulation,
        signature,
        generatedAt: deps.now?.() ?? null,
      });
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        publication,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Policy bundle publication could not be generated.';
      const status: ShadowProblemStatus = detail.includes('exceeds maximum') ? 400 : 503;
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-bundle-publication-failed',
        title: 'Policy bundle publication failed',
        status,
        detail,
        reasonCodes: ['policy-bundle-publication-failed'],
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
