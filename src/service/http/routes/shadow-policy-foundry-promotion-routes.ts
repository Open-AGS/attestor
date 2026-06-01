import type { Context, Hono } from 'hono';
import {
  createPolicyFoundryActiveQuestionPacket,
  createShadowPolicyBundlePublication,
  createShadowPolicyBundleSigningPayload,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicyPromotionDraft,
  createShadowPolicyPromotionPacket,
  createShadowPolicyPromotionSimulation,
  evaluatePolicyFoundryReadiness,
  evaluatePolicyFoundryRedTeamReplay,
  SHADOW_POLICY_PROMOTION_SOURCE_STATUSES,
  type ShadowPolicyDiscoveryCandidate,
  type ShadowPolicyPromotionSourceStatus,
} from '../../../consequence-admission/index.js';
import {
  SHADOW_POLICY_CANDIDATE_STATUSES,
  type ShadowPolicyCandidateStoreRecord,
  type ShadowPolicyCandidateStatus,
} from '../../shadow/shadow-persistence-store.js';
import { hashJsonValue } from '../../json-stable.js';
import { acceptsJsonRequestBody } from '../route-response-helpers.js';
import {
  beginShadowMutationIdempotency,
  finalizeShadowMutationIdempotency,
  recordShadowMutationAudit,
} from './shadow-mutation-route-helpers.js';
import type { ShadowRouteDeps } from './shadow-routes.js';
import {
  safeShadowSummary,
} from './shadow-summary-dashboard-routes.js';
import {
  assertTenantBoundRecord,
  assertTenantBoundRecords,
  boundedErrorDetail,
  caughtErrorStatus,
  isRecord,
  problem,
  shadowListPage,
  tenantSummary,
} from './shadow-route-helpers.js';

function parseBooleanQuery(value: string | null | undefined): boolean | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

function parseCandidateStatus(value: string | null | undefined): ShadowPolicyCandidateStatus | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_POLICY_CANDIDATE_STATUSES.includes(normalized as ShadowPolicyCandidateStatus)
    ? normalized as ShadowPolicyCandidateStatus
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

function selectPolicyFoundryCandidate(input: {
  readonly candidates: readonly ShadowPolicyDiscoveryCandidate[];
  readonly candidateId: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
}): ShadowPolicyDiscoveryCandidate | null {
  return input.candidates.find((candidate) => {
    if (input.candidateId && candidate.candidateId !== input.candidateId) return false;
    if (input.actionSurface && candidate.actionSurface !== input.actionSurface) return false;
    if (input.domain && candidate.domain !== input.domain) return false;
    return true;
  }) ?? null;
}

async function readStatusTransitionBody(c: Context): Promise<{
  readonly status: ShadowPolicyCandidateStatus;
  readonly assertedActorRef: string | null;
  readonly reason: string;
} | Response> {
  if (!acceptsJsonRequestBody(c)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/policy-candidate-status-json-required',
      title: 'Policy candidate status JSON required',
      status: 415,
      detail: 'The policy candidate status route requires Content-Type: application/json.',
      reasonCodes: ['policy-candidate-status-json-required'],
    });
  }
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
  const assertedActorRef = typeof body.actorRef === 'string' && body.actorRef.trim().length > 0
    ? body.actorRef.trim()
    : null;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!status || !reason) {
    return problem(c, {
      type: 'https://attestor.dev/problems/policy-candidate-status-input-invalid',
      title: 'Invalid policy candidate status input',
      status: 400,
      detail:
        'The policy candidate status route requires status and reason. Status must be one of the supported candidate states.',
      reasonCodes: ['invalid-policy-candidate-status-input'],
    });
  }
  return { status, assertedActorRef, reason };
}

function shadowMutationActorRef(
  c: Context,
  deps: ShadowRouteDeps,
  tenant: ReturnType<ShadowRouteDeps['currentTenant']>,
): string {
  const resolved = deps.currentShadowMutationActorRef?.({ context: c, tenant })?.trim();
  if (resolved) return resolved;
  return `tenant-auth:${tenant.source}:${tenant.tenantId}`;
}

function candidateDigest(candidate: ShadowPolicyDiscoveryCandidate): string {
  return `sha256:${hashJsonValue(candidate)}`;
}

function verifiedReadinessProofInputs(input: {
  readonly deps: ShadowRouteDeps;
  readonly tenant: ReturnType<ShadowRouteDeps['currentTenant']>;
  readonly candidate: ShadowPolicyDiscoveryCandidate | null;
}): {
  readonly customerApproved: boolean;
  readonly tenantBoundaryProven: boolean;
  readonly proofSource: {
    readonly customerApproval:
      | 'stored-current-candidate-status'
      | 'stored-candidate-not-approved'
      | 'candidate-store-unavailable'
      | 'candidate-missing';
    readonly tenantBoundary: 'shadow-route-tenant-assertions';
  };
} {
  if (input.candidate === null) {
    return {
      customerApproved: false,
      tenantBoundaryProven: true,
      proofSource: {
        customerApproval: 'candidate-missing',
        tenantBoundary: 'shadow-route-tenant-assertions',
      },
    };
  }

  const expectedDigest = candidateDigest(input.candidate);
  const candidateId = input.candidate.candidateId;
  let matchingRecord: ShadowPolicyCandidateStoreRecord | null = null;
  if (input.deps.listShadowPolicyCandidateRecords) {
    const records = assertTenantBoundRecords(
      input.tenant,
      input.deps.listShadowPolicyCandidateRecords({
        tenant: input.tenant,
        status: null,
      }),
      'shadow policy candidate',
    );
    matchingRecord = records.find((record) =>
      record.candidateId === candidateId && record.candidateDigest === expectedDigest
    ) ?? null;
  }

  const customerApproved = matchingRecord?.status === 'approved' || matchingRecord?.status === 'activated';
  const customerApprovalSource = matchingRecord === null
    ? input.deps.listShadowPolicyCandidateRecords
      ? 'stored-candidate-not-approved'
      : 'candidate-store-unavailable'
    : customerApproved
      ? 'stored-current-candidate-status'
      : 'stored-candidate-not-approved';
  return {
    customerApproved,
    tenantBoundaryProven: true,
    proofSource: {
      customerApproval: customerApprovalSource,
      tenantBoundary: 'shadow-route-tenant-assertions',
    },
  };
}

function rejectCallerSuppliedReadinessProof(c: Context, surface: 'readiness' | 'active-questions'): Response | null {
  const forbidden = ['customerApproved', 'tenantBoundaryProven']
    .filter((name) => c.req.query(name) !== undefined);
  if (forbidden.length === 0) return null;
  return problem(c, {
    type: `https://attestor.dev/problems/policy-foundry-${surface}-proof-computed`,
    title: `Policy Foundry ${surface} proof is computed`,
    status: 400,
    detail:
      `${forbidden.join(', ')} can only come from route-verified tenant/candidate proof state, not query input.`,
    reasonCodes: [`policy-foundry-${surface}-proof-computed`],
  });
}

export function registerShadowPolicyFoundryPromotionRoutes(app: Hono, deps: ShadowRouteDeps): void {
  app.get('/api/v1/shadow/policy-candidates', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;
    const bundle = createShadowPolicyDiscoveryCandidates({
      report: result.surface.latestSimulation,
      generatedAt: deps.now?.() ?? null,
    });
    const page = shadowListPage(c, bundle.candidates, 'Shadow policy candidate');
    if (page instanceof Response) return page;

    return c.json({
      tenant: tenantSummary(result.tenant),
      ...bundle,
      candidates: page.records,
      returnedCandidateCount: page.records.length,
      pageInfo: page.pageInfo,
    });
  });

  app.get('/api/v1/shadow/policy-foundry/readiness', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;

    if (c.req.query('redTeamReplayStatus') !== undefined) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-red-team-status-computed',
        title: 'Policy Foundry red-team replay status is computed',
        status: 400,
        detail:
          'redTeamReplayStatus is computed from the candidate-specific red-team replay contract and cannot be supplied by clients.',
        reasonCodes: ['policy-foundry-red-team-status-computed'],
      });
    }

    const callerSuppliedProof = rejectCallerSuppliedReadinessProof(c, 'readiness');
    if (callerSuppliedProof) return callerSuppliedProof;

    const llmAuthoritySourceQuery = c.req.query('llmAuthoritySource');
    const llmAuthoritySource = parseBooleanQuery(llmAuthoritySourceQuery);
    if (llmAuthoritySourceQuery && llmAuthoritySource === null) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-readiness-query-invalid',
        title: 'Invalid Policy Foundry readiness query',
        status: 400,
        detail: 'llmAuthoritySource must be true or false when provided.',
        reasonCodes: ['invalid-policy-foundry-readiness-query'],
      });
    }

    const candidateId = c.req.query('candidateId')?.trim() || null;
    const actionSurface = c.req.query('actionSurface')?.trim() || null;
    const domain = c.req.query('domain')?.trim() || null;
    const bundle = createShadowPolicyDiscoveryCandidates({
      report: result.surface.latestSimulation,
      generatedAt: deps.now?.() ?? null,
    });
    const candidate = selectPolicyFoundryCandidate({
      candidates: bundle.candidates,
      candidateId,
      actionSurface,
      domain,
    });
    const replay = evaluatePolicyFoundryRedTeamReplay({
      candidate,
      report: result.surface.latestSimulation,
      events: result.events,
      tenantId: result.tenant.tenantId,
      generatedAt: deps.now?.() ?? null,
    });
    const proofInputs = verifiedReadinessProofInputs({
      deps,
      tenant: result.tenant,
      candidate,
    });
    const readiness = evaluatePolicyFoundryReadiness({
      candidate,
      report: result.surface.latestSimulation,
      events: result.events,
      generatedAt: deps.now?.() ?? null,
      customerApproved: proofInputs.customerApproved,
      tenantBoundaryProven: proofInputs.tenantBoundaryProven,
      llmAuthoritySource,
      redTeamReplayStatus: replay.status,
    });

    return c.json({
      tenant: tenantSummary(result.tenant),
      storageMode: result.surface.storageMode,
      productionReady: false,
      approvalRequired: true,
      autoEnforce: false,
      rawPayloadStored: false,
      decisionSupportOnly: true,
      source: 'shadow-policy-foundry-readiness',
      candidateSelection: {
        candidateId,
        actionSurface,
        domain,
        matched: candidate !== null,
        candidateCount: bundle.candidateCount,
      },
      readinessProof: proofInputs.proofSource,
      redTeamReplay: {
        status: replay.status,
        digest: replay.digest,
        caseCount: replay.caseCount,
        failedCaseCount: replay.failedCaseCount,
      },
      readiness,
    });
  });

  app.get('/api/v1/shadow/policy-foundry/active-questions', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;

    if (c.req.query('redTeamReplayStatus') !== undefined) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-red-team-status-computed',
        title: 'Policy Foundry red-team replay status is computed',
        status: 400,
        detail:
          'redTeamReplayStatus is computed from the candidate-specific red-team replay contract and cannot be supplied by clients.',
        reasonCodes: ['policy-foundry-red-team-status-computed'],
      });
    }

    const callerSuppliedProof = rejectCallerSuppliedReadinessProof(c, 'active-questions');
    if (callerSuppliedProof) return callerSuppliedProof;

    const llmAuthoritySourceQuery = c.req.query('llmAuthoritySource');
    const llmAuthoritySource = parseBooleanQuery(llmAuthoritySourceQuery);
    if (llmAuthoritySourceQuery && llmAuthoritySource === null) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-active-questions-query-invalid',
        title: 'Invalid Policy Foundry active questions query',
        status: 400,
        detail: 'llmAuthoritySource must be true or false when provided.',
        reasonCodes: ['invalid-policy-foundry-active-questions-query'],
      });
    }

    const candidateId = c.req.query('candidateId')?.trim() || null;
    const actionSurface = c.req.query('actionSurface')?.trim() || null;
    const domain = c.req.query('domain')?.trim() || null;
    const bundle = createShadowPolicyDiscoveryCandidates({
      report: result.surface.latestSimulation,
      generatedAt: deps.now?.() ?? null,
    });
    const candidate = selectPolicyFoundryCandidate({
      candidates: bundle.candidates,
      candidateId,
      actionSurface,
      domain,
    });
    const replay = evaluatePolicyFoundryRedTeamReplay({
      candidate,
      report: result.surface.latestSimulation,
      events: result.events,
      tenantId: result.tenant.tenantId,
      generatedAt: deps.now?.() ?? null,
    });
    const proofInputs = verifiedReadinessProofInputs({
      deps,
      tenant: result.tenant,
      candidate,
    });
    const readiness = evaluatePolicyFoundryReadiness({
      candidate,
      report: result.surface.latestSimulation,
      events: result.events,
      generatedAt: deps.now?.() ?? null,
      customerApproved: proofInputs.customerApproved,
      tenantBoundaryProven: proofInputs.tenantBoundaryProven,
      llmAuthoritySource,
      redTeamReplayStatus: replay.status,
    });
    const activeQuestionPacket = createPolicyFoundryActiveQuestionPacket({
      readiness,
      generatedAt: deps.now?.() ?? null,
    });

    return c.json({
      tenant: tenantSummary(result.tenant),
      storageMode: result.surface.storageMode,
      productionReady: false,
      approvalRequired: true,
      autoEnforce: false,
      rawPayloadStored: false,
      decisionSupportOnly: true,
      source: 'shadow-policy-foundry-active-questions',
      candidateSelection: {
        candidateId,
        actionSurface,
        domain,
        matched: candidate !== null,
        candidateCount: bundle.candidateCount,
      },
      readinessProof: proofInputs.proofSource,
      redTeamReplay: {
        status: replay.status,
        digest: replay.digest,
        caseCount: replay.caseCount,
        failedCaseCount: replay.failedCaseCount,
      },
      readiness: {
        status: readiness.status,
        digest: readiness.digest,
        recommendedRolloutStep: readiness.recommendedRolloutStep,
      },
      activeQuestionPacket,
    });
  });

  app.get('/api/v1/shadow/policy-foundry/red-team-replay', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;

    const candidateId = c.req.query('candidateId')?.trim() || null;
    const actionSurface = c.req.query('actionSurface')?.trim() || null;
    const domain = c.req.query('domain')?.trim() || null;
    const bundle = createShadowPolicyDiscoveryCandidates({
      report: result.surface.latestSimulation,
      generatedAt: deps.now?.() ?? null,
    });
    const candidate = selectPolicyFoundryCandidate({
      candidates: bundle.candidates,
      candidateId,
      actionSurface,
      domain,
    });
    const replay = evaluatePolicyFoundryRedTeamReplay({
      candidate,
      report: result.surface.latestSimulation,
      events: result.events,
      tenantId: result.tenant.tenantId,
      generatedAt: deps.now?.() ?? null,
    });

    return c.json({
      tenant: tenantSummary(result.tenant),
      storageMode: result.surface.storageMode,
      productionReady: false,
      approvalRequired: true,
      autoEnforce: false,
      rawPayloadStored: false,
      decisionSupportOnly: true,
      source: 'shadow-policy-foundry-red-team-replay',
      candidateSelection: {
        candidateId,
        actionSurface,
        domain,
        matched: candidate !== null,
        candidateCount: bundle.candidateCount,
      },
      replay,
    });
  });

  app.post('/api/v1/shadow/policy-candidates/materialize', async (c) => {
    if (!deps.materializeShadowPolicyCandidates) {
      c.header('cache-control', 'no-store');
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy candidate materialization is not configured for this runtime.',
        reasonCodes: ['policy-candidate-store-unavailable'],
      });
    }
    const routeId = 'shadow.policy_candidates.materialize';
    const requestPayload = { source: 'latestSimulation' };
    const idempotency = await beginShadowMutationIdempotency(c, deps, routeId, requestPayload);
    if (idempotency.kind === 'response') return idempotency.response;
    const { tenant } = idempotency;
    const result = safeShadowSummary(c, deps, tenant);
    if (result instanceof Response) return result;

    const bundle = createShadowPolicyDiscoveryCandidates({
      report: result.surface.latestSimulation,
      generatedAt: deps.now?.() ?? null,
    });
    try {
      const persisted = deps.materializeShadowPolicyCandidates({
        tenant: result.tenant,
        bundle,
      });
      const records = assertTenantBoundRecords(
        result.tenant,
        persisted.records,
        'shadow policy candidate',
      );
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.policy_candidate.materialized',
        tenant: result.tenant,
        requestPayload: {
          source: 'latestSimulation',
          candidateCount: bundle.candidateCount,
        },
        statusCode: 200,
        metadata: {
          candidateCount: bundle.candidateCount,
          createdCount: persisted.createdCount,
          updatedCount: persisted.updatedCount,
          unchangedCount: persisted.unchangedCount,
          candidateIds: records.map((record) => record.candidateId),
        },
      });
      const responseBody = await finalizeShadowMutationIdempotency(
        deps,
        result.tenant,
        routeId,
        requestPayload,
        idempotency.ready,
        200,
        {
          tenant: tenantSummary(result.tenant),
          version: bundle.version,
          generatedAt: bundle.generatedAt,
          candidateCount: bundle.candidateCount,
          approvalRequired: true,
          autoEnforce: false,
          rawPayloadStored: false,
          persisted: {
            records,
            createdCount: persisted.createdCount,
            updatedCount: persisted.updatedCount,
            unchangedCount: persisted.unchangedCount,
          },
        },
      );
      return c.json(responseBody);
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-materialize-failed',
        title: 'Policy candidate materialization failed',
        status: 503,
        detail: boundedErrorDetail(error, 'Policy candidates could not be materialized.'),
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
      const records = assertTenantBoundRecords(
        tenant,
        deps.listShadowPolicyCandidateRecords({ tenant, status }),
        'shadow policy candidate',
      );
      const page = shadowListPage(c, records, 'Shadow policy candidate record');
      if (page instanceof Response) return page;
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        recordCount: page.records.length,
        pageInfo: page.pageInfo,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        productionReady: false,
        records: page.records,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-records-unavailable',
        title: 'Policy candidate records unavailable',
        status: 503,
        detail: boundedErrorDetail(error, 'Policy candidate records could not be listed.'),
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
      const records = assertTenantBoundRecords(
        tenant,
        deps.listShadowPolicyCandidateRecords({
          tenant,
          status: sourceStatus,
        }),
        'shadow policy candidate',
      );
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
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-draft-failed',
        title: 'Policy promotion draft failed',
        status: 503,
        detail: boundedErrorDetail(error, 'Policy promotion draft could not be generated.'),
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
      const records = assertTenantBoundRecords(
        tenant,
        deps.listShadowPolicyCandidateRecords({
          tenant,
          status: sourceStatus,
        }),
        'shadow policy candidate',
      );
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
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-packet-failed',
        title: 'Policy promotion packet failed',
        status: 503,
        detail: boundedErrorDetail(error, 'Policy promotion packet could not be generated.'),
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
      const records = assertTenantBoundRecords(
        tenant,
        deps.listShadowPolicyCandidateRecords({
          tenant,
          status: sourceStatus,
        }),
        'shadow policy candidate',
      );
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
        events: assertTenantBoundRecords(
          tenant,
          deps.listShadowEvents({ tenant }),
          'shadow admission event',
          { allowNullTenantId: true },
        ),
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
      const status = caughtErrorStatus(error, {
        statusMarkers: [{ marker: 'exceeds maximum', status: 400 }],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-simulation-failed',
        title: 'Policy promotion simulation failed',
        status,
        detail: boundedErrorDetail(error, 'Policy promotion simulation could not be generated.', {
          safeMarkers: ['exceeds maximum'],
          safeDetail: 'The policy promotion simulation exceeds the supported event bound.',
        }),
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
      const records = assertTenantBoundRecords(
        tenant,
        deps.listShadowPolicyCandidateRecords({
          tenant,
          status: sourceStatus,
        }),
        'shadow policy candidate',
      );
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
        events: assertTenantBoundRecords(
          tenant,
          deps.listShadowEvents({ tenant }),
          'shadow admission event',
          { allowNullTenantId: true },
        ),
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
      const status = caughtErrorStatus(error, {
        statusMarkers: [{ marker: 'exceeds maximum', status: 400 }],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-bundle-publication-failed',
        title: 'Policy bundle publication failed',
        status,
        detail: boundedErrorDetail(error, 'Policy bundle publication could not be generated.', {
          safeMarkers: ['exceeds maximum'],
          safeDetail: 'The policy bundle publication exceeds the supported event bound.',
        }),
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
      const routeId = 'shadow.policy_candidates.status.update';
      const candidateId = c.req.param('candidateId');
      const preflightTenant = deps.currentTenant(c);
      const actorRef = shadowMutationActorRef(c, deps, preflightTenant);
      const requestPayload = {
        candidateId,
        status: body.status,
        actorRef,
        reason: body.reason,
      };
      const idempotency = await beginShadowMutationIdempotency(c, deps, routeId, requestPayload);
      if (idempotency.kind === 'response') return idempotency.response;
      const { tenant } = idempotency;
      const record = assertTenantBoundRecord(
        tenant,
        deps.transitionShadowPolicyCandidateStatus({
          tenant,
          candidateId,
          status: body.status,
          actorRef,
          reason: body.reason,
        }),
        'shadow policy candidate',
      );
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.policy_candidate.status_transitioned',
        tenant,
        requestPayload: {
          candidateId,
          status: body.status,
          assertedActorRefPresent: body.assertedActorRef !== null,
          assertedActorRefLength: body.assertedActorRef?.length ?? 0,
          reasonLength: body.reason.length,
        },
        statusCode: 200,
        metadata: {
          candidateId: record.candidateId,
          candidateDigest: record.candidateDigest,
          status: record.status,
          actorRef,
          statusHistoryLength: record.statusHistory.length,
        },
      });
      const responseBody = await finalizeShadowMutationIdempotency(
        deps,
        tenant,
        routeId,
        requestPayload,
        idempotency.ready,
        200,
        {
          tenant: tenantSummary(tenant),
          approvalRequired: true,
          autoEnforce: false,
          rawPayloadStored: false,
          record,
        },
      );
      return c.json(responseBody);
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [
          { marker: 'was not found', status: 404 },
          { marker: 'cannot transition', status: 409 },
        ],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-status-transition-failed',
        title: 'Policy candidate status transition failed',
        status,
        detail: boundedErrorDetail(error, 'Policy candidate status could not be transitioned.', {
          safeMarkers: ['was not found', 'cannot transition'],
          safeDetail: status === 404
            ? 'No policy candidate was found for this tenant and candidate id.'
            : status === 409
              ? 'The requested policy candidate status transition is not allowed.'
              : 'Policy candidate status could not be transitioned.',
        }),
        reasonCodes: ['policy-candidate-status-transition-failed'],
      });
    }
  });
}
