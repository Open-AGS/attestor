import type { Context, Hono } from 'hono';
import type { AdminAuditAction } from '../../admin-audit-log.js';
import {
  createActionRiskInventory,
  createConsequenceAuditEvidenceExport,
  createConsequenceBusinessRiskDashboard,
  createConsequenceDashboardApiSummary,
  createShadowActivationReadinessGate,
  createShadowCustomerActivationHandoff,
  createShadowCustomerActivationReceipt,
  createShadowPolicyDiscoveryCandidates,
  createShadowDownstreamIntegrationProof,
  createShadowDownstreamVerificationBinding,
  createShadowPolicyBundlePublication,
  createShadowPolicyBundleSigningPayload,
  createShadowPolicyPromotionDraft,
  createShadowPolicyPromotionPacket,
  createShadowPolicyPromotionSimulation,
  createShadowPolicySimulationReport,
  createShadowSummarySurface,
  createPolicyFoundryActiveQuestionPacket,
  evaluatePolicyFoundryRedTeamReplay,
  evaluatePolicyFoundryReadiness,
  CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS,
  GENERIC_ADMISSION_MODES,
  SHADOW_DOWNSTREAM_INTEGRATION_EVIDENCE_KINDS,
  SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
  SHADOW_CUSTOMER_ACTIVATION_REF_KINDS,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_KILL_SWITCH_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_MONITORING_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_ROLLBACK_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_ROLLOUT_STRATEGIES,
  SHADOW_POLICY_PROMOTION_SOURCE_STATUSES,
  type ConsequenceAdmissionDownstreamBoundaryKind,
  type GenericAdmissionMode,
  type ShadowCustomerActivationControlRef,
  type ShadowCustomerActivationHandoff,
  type ShadowCustomerActivationReceiptKillSwitchStatus,
  type ShadowCustomerActivationReceiptMonitoringStatus,
  type ShadowCustomerActivationReceiptRollbackStatus,
  type ShadowCustomerActivationReceiptStatus,
  type ShadowCustomerActivationRefKind,
  type ShadowCustomerActivationRolloutStrategy,
  type ShadowDownstreamIntegrationEvidenceKind,
  type ShadowDownstreamVerificationCheckKind,
  type ShadowPolicyDiscoveryCandidate,
  type ShadowPolicyBundlePublicationSignature,
  type ShadowPolicyBundleSigningPayload,
  type ShadowPolicyPromotionSourceStatus,
  type ShadowAdmissionEvent,
  type ShadowPolicySimulationReport,
} from '../../../consequence-admission/index.js';
import {
  SHADOW_POLICY_CANDIDATE_STATUSES,
  type AppendShadowCustomerActivationReceiptResult,
  type AppendShadowPolicySimulationReportResult,
  type ShadowCustomerActivationReceiptStoreRecord,
  type ShadowPolicyCandidateStatus,
  type ShadowPolicyCandidateStoreRecord,
  type ShadowPolicySimulationReportStoreRecord,
  type UpsertShadowPolicyCandidateBundleResult,
} from '../../shadow/shadow-persistence-store.js';
import type {
  PipelineIdempotencyReadyResult,
  PipelineIdempotencyService,
} from '../../application/pipeline-idempotency-service.js';
import type { TenantContext } from '../../tenant-isolation.js';
import { acceptsJsonRequestBody } from '../route-response-helpers.js';
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

const SHADOW_MUTATION_RATE_LIMIT_DEFAULT = 60;
const SHADOW_MUTATION_RATE_LIMIT_MAX = 600;
const SHADOW_MUTATION_RATE_LIMIT_WINDOW_MS = 60_000;

const shadowMutationAttempts = new Map<string, {
  count: number;
  resetAtMs: number;
}>();

export interface ShadowMutationAuditInput {
  readonly routeId: string;
  readonly action: AdminAuditAction;
  readonly tenant: TenantContext;
  readonly requestPayload: unknown;
  readonly statusCode: number;
  readonly metadata?: Record<string, unknown>;
}

type DownstreamIntegrationProofRouteBody = {
  readonly enforcementPointId: string;
  readonly boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly verifierRef: string;
  readonly evidenceRefs: readonly {
    readonly id: string;
    readonly kind: ShadowDownstreamIntegrationEvidenceKind;
    readonly digest: string;
    readonly uri: string | null;
  }[];
  readonly observedVerificationChecks: readonly ShadowDownstreamVerificationCheckKind[];
};

export interface ShadowRouteDeps {
  currentTenant(context: Context): TenantContext;
  listShadowEvents(input: { readonly tenant: TenantContext }): readonly ShadowAdmissionEvent[];
  recordShadowMutationAudit?(input: ShadowMutationAuditInput): Promise<void>;
  pipelineIdempotencyService?: PipelineIdempotencyService;
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
  recordShadowCustomerActivationReceipt?(input: {
    readonly tenant: TenantContext;
    readonly receipt: ReturnType<typeof createShadowCustomerActivationReceipt>;
  }): AppendShadowCustomerActivationReceiptResult;
  listShadowCustomerActivationReceiptRecords?(input: {
    readonly tenant: TenantContext;
    readonly activationStatus: ShadowCustomerActivationReceiptStatus | null;
    readonly receiptReady: boolean | null;
    readonly sourceHandoffDigest: string | null;
  }): readonly ShadowCustomerActivationReceiptStoreRecord[];
  findShadowCustomerActivationReceipt?(input: {
    readonly tenant: TenantContext;
    readonly receiptId: string;
  }): ShadowCustomerActivationReceiptStoreRecord | null;
  signShadowPolicyBundlePublication?(input: {
    readonly tenant: TenantContext;
    readonly payload: ShadowPolicyBundleSigningPayload;
  }): ShadowPolicyBundlePublicationSignature;
  now?(): string;
}

function configuredShadowMutationRateLimit(): number {
  const raw = process.env.ATTESTOR_SHADOW_MUTATION_RATE_LIMIT_PER_MINUTE?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : SHADOW_MUTATION_RATE_LIMIT_DEFAULT;
  if (!Number.isFinite(parsed) || parsed <= 0) return SHADOW_MUTATION_RATE_LIMIT_DEFAULT;
  return Math.min(parsed, SHADOW_MUTATION_RATE_LIMIT_MAX);
}

function shadowMutationRateLimitResponse(
  c: Context,
  tenant: TenantContext,
  routeId: string,
): Response | null {
  const limit = configuredShadowMutationRateLimit();
  const now = Date.now();
  for (const [key, attempt] of shadowMutationAttempts.entries()) {
    if (attempt.resetAtMs <= now) shadowMutationAttempts.delete(key);
  }

  const key = `${tenant.tenantId}:${routeId}`;
  const current = shadowMutationAttempts.get(key);
  const attempt = current && current.resetAtMs > now
    ? current
    : { count: 0, resetAtMs: now + SHADOW_MUTATION_RATE_LIMIT_WINDOW_MS };
  attempt.count += 1;
  shadowMutationAttempts.set(key, attempt);

  const remaining = Math.max(0, limit - attempt.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((attempt.resetAtMs - now) / 1000));
  c.header('cache-control', 'no-store');
  c.header('x-attestor-rate-limit-limit', String(limit));
  c.header('x-attestor-rate-limit-remaining', String(remaining));
  c.header('x-attestor-rate-limit-reset', new Date(attempt.resetAtMs).toISOString());
  if (attempt.count <= limit) return null;

  c.header('retry-after', String(retryAfterSeconds));
  return problem(c, {
    type: 'https://attestor.dev/problems/shadow-mutation-rate-limit-exceeded',
    title: 'Shadow mutation rate limit exceeded',
    status: 429,
    detail: 'Shadow mutation writes are rate limited per tenant and route.',
    reasonCodes: ['shadow-mutation-rate-limit-exceeded'],
  });
}

type ShadowMutationIdempotencyBegin =
  | {
      readonly kind: 'ready';
      readonly tenant: TenantContext;
      readonly ready: PipelineIdempotencyReadyResult | null;
    }
  | { readonly kind: 'response'; readonly response: Response };

function shadowIdempotencyKeyFor(c: Context): string | null {
  const normalized = c.req.header('Idempotency-Key')?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function shadowReplayResponse(input: {
  readonly statusCode: number;
  readonly responseBody: unknown;
  readonly replay: boolean;
}): Response {
  return new Response(JSON.stringify(input.responseBody), {
    status: input.statusCode,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      ...(input.replay ? { 'x-attestor-idempotent-replay': 'true' } : {}),
    },
  });
}

async function beginShadowMutationIdempotency(
  c: Context,
  deps: ShadowRouteDeps,
  routeId: string,
  requestPayload: unknown,
): Promise<ShadowMutationIdempotencyBegin> {
  const tenant = deps.currentTenant(c);
  const idempotencyKey = shadowIdempotencyKeyFor(c);

  if (idempotencyKey) {
    if (!deps.pipelineIdempotencyService) {
      return {
        kind: 'response',
        response: problem(c, {
          type: 'https://attestor.dev/problems/shadow-mutation-idempotency-unavailable',
          title: 'Shadow mutation idempotency unavailable',
          status: 503,
          detail: 'The shadow mutation route cannot persist idempotent mutation responses in this runtime.',
          reasonCodes: ['shadow-mutation-idempotency-unavailable'],
        }),
      };
    }

    const begin = await deps.pipelineIdempotencyService.begin({
      idempotencyKey,
      tenantId: tenant.tenantId,
      routeId,
      requestPayload,
    });

    if (begin.kind === 'replay') {
      return {
        kind: 'response',
        response: shadowReplayResponse({
          statusCode: begin.statusCode,
          responseBody: begin.responseBody,
          replay: true,
        }),
      };
    }

    if (begin.kind === 'conflict') {
      return {
        kind: 'response',
        response: problem(c, {
          type: 'https://attestor.dev/problems/shadow-mutation-idempotency-conflict',
          title: 'Shadow mutation idempotency conflict',
          status: 409,
          detail: 'The Idempotency-Key was already used for a different shadow mutation request.',
          reasonCodes: ['shadow-mutation-idempotency-conflict'],
        }),
      };
    }

    if (begin.kind === 'unavailable') {
      return {
        kind: 'response',
        response: problem(c, {
          type: 'https://attestor.dev/problems/shadow-mutation-idempotency-unavailable',
          title: 'Shadow mutation idempotency unavailable',
          status: 503,
          detail: 'The shadow mutation route cannot persist idempotent mutation responses in this runtime.',
          reasonCodes: ['shadow-mutation-idempotency-unavailable'],
        }),
      };
    }

    const rateLimited = shadowMutationRateLimitResponse(c, tenant, routeId);
    if (rateLimited) return { kind: 'response', response: rateLimited };
    return { kind: 'ready', tenant, ready: begin };
  }

  const rateLimited = shadowMutationRateLimitResponse(c, tenant, routeId);
  if (rateLimited) return { kind: 'response', response: rateLimited };
  return { kind: 'ready', tenant, ready: null };
}

async function finalizeShadowMutationIdempotency(
  deps: ShadowRouteDeps,
  tenant: TenantContext,
  routeId: string,
  requestPayload: unknown,
  idempotency: PipelineIdempotencyReadyResult | null,
  statusCode: number,
  responseBody: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!idempotency?.idempotencyKey || !deps.pipelineIdempotencyService) {
    return responseBody;
  }
  return deps.pipelineIdempotencyService.finalize({
    idempotencyKey: idempotency.idempotencyKey,
    tenantId: tenant.tenantId,
    routeId,
    requestPayload,
    statusCode,
    responseBody,
  });
}

export function resetShadowMutationRateLimiterForTests(): void {
  shadowMutationAttempts.clear();
}

function safeShadowSummary(c: Context, deps: ShadowRouteDeps, tenantInput?: TenantContext) {
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

async function recordShadowMutationAudit(
  deps: ShadowRouteDeps,
  input: ShadowMutationAuditInput,
): Promise<void> {
  await deps.recordShadowMutationAudit?.(input);
}

function simulationsForAuditEvidence(input: {
  readonly simulations: readonly ShadowPolicySimulationReport[];
  readonly latestSimulation: ShadowPolicySimulationReport | null;
}): readonly ShadowPolicySimulationReport[] {
  if (input.simulations.length > 0) return input.simulations;
  return input.latestSimulation ? Object.freeze([input.latestSimulation]) : Object.freeze([]);
}

async function readStatusTransitionBody(c: Context): Promise<{
  readonly status: ShadowPolicyCandidateStatus;
  readonly actorRef: string;
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
  if (!acceptsJsonRequestBody(c)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-json-required',
      title: 'Shadow simulation JSON required',
      status: 415,
      detail: 'The shadow simulation route requires Content-Type: application/json.',
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

function parseDownstreamBoundaryKind(
  value: string | null | undefined,
): ConsequenceAdmissionDownstreamBoundaryKind | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS.includes(
    normalized as ConsequenceAdmissionDownstreamBoundaryKind,
  )
    ? normalized as ConsequenceAdmissionDownstreamBoundaryKind
    : null;
}

function parseIntegrationEvidenceKind(
  value: string | null | undefined,
): ShadowDownstreamIntegrationEvidenceKind | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_DOWNSTREAM_INTEGRATION_EVIDENCE_KINDS.includes(
    normalized as ShadowDownstreamIntegrationEvidenceKind,
  )
    ? normalized as ShadowDownstreamIntegrationEvidenceKind
    : null;
}

function parseDownstreamVerificationCheck(
  value: string | null | undefined,
): ShadowDownstreamVerificationCheckKind | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_DOWNSTREAM_VERIFICATION_CHECKS.includes(
    normalized as ShadowDownstreamVerificationCheckKind,
  )
    ? normalized as ShadowDownstreamVerificationCheckKind
    : null;
}

async function readDownstreamIntegrationProofBody(c: Context): Promise<DownstreamIntegrationProofRouteBody | Response> {
  if (!acceptsJsonRequestBody(c)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-json-required',
      title: 'Downstream integration proof JSON required',
      status: 415,
      detail: 'The downstream integration proof route requires Content-Type: application/json.',
      reasonCodes: ['downstream-integration-proof-json-required'],
    });
  }

  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-json-invalid',
      title: 'Invalid downstream integration proof JSON',
      status: 400,
      detail: 'The downstream integration proof route requires a valid JSON object body.',
      reasonCodes: ['invalid-json'],
    });
  }
  if (!isRecord(body)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-input-invalid',
      title: 'Invalid downstream integration proof input',
      status: 400,
      detail: 'The downstream integration proof route requires an object body.',
      reasonCodes: ['invalid-downstream-integration-proof-input'],
    });
  }

  const enforcementPointId = typeof body.enforcementPointId === 'string'
    ? body.enforcementPointId.trim()
    : '';
  const boundaryKind = typeof body.boundaryKind === 'string'
    ? parseDownstreamBoundaryKind(body.boundaryKind)
    : null;
  const verifierRef = typeof body.verifierRef === 'string'
    ? body.verifierRef.trim()
    : '';
  if (!enforcementPointId || !boundaryKind || !verifierRef) {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-input-invalid',
      title: 'Invalid downstream integration proof input',
      status: 400,
      detail:
        `The downstream integration proof route requires enforcementPointId, verifierRef, and boundaryKind. Boundary kind must be one of: ${CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS.join(', ')}.`,
      reasonCodes: ['invalid-downstream-integration-proof-input'],
    });
  }

  const evidenceInput = body.evidenceRefs ?? [];
  if (!Array.isArray(evidenceInput)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-evidence-invalid',
      title: 'Invalid downstream integration proof evidence',
      status: 400,
      detail: 'evidenceRefs must be an array when provided.',
      reasonCodes: ['invalid-downstream-integration-proof-evidence'],
    });
  }
  const evidenceRefs: {
    readonly id: string;
    readonly kind: ShadowDownstreamIntegrationEvidenceKind;
    readonly digest: string;
    readonly uri: string | null;
  }[] = [];
  for (const entry of evidenceInput) {
    if (!isRecord(entry)) {
      return problem(c, {
        type: 'https://attestor.dev/problems/downstream-integration-proof-evidence-invalid',
        title: 'Invalid downstream integration proof evidence',
        status: 400,
        detail: 'Every evidenceRef must be an object with id, kind, digest, and optional uri.',
        reasonCodes: ['invalid-downstream-integration-proof-evidence'],
      });
    }
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const kind = typeof entry.kind === 'string'
      ? parseIntegrationEvidenceKind(entry.kind)
      : null;
    const digest = typeof entry.digest === 'string' ? entry.digest.trim() : '';
    const uri = entry.uri === undefined || entry.uri === null
      ? null
      : typeof entry.uri === 'string'
        ? entry.uri.trim()
        : '';
    if (!id || !kind || !digest || uri === '') {
      return problem(c, {
        type: 'https://attestor.dev/problems/downstream-integration-proof-evidence-invalid',
        title: 'Invalid downstream integration proof evidence',
        status: 400,
        detail:
          `Every evidenceRef requires id, kind, and digest. Evidence kind must be one of: ${SHADOW_DOWNSTREAM_INTEGRATION_EVIDENCE_KINDS.join(', ')}.`,
        reasonCodes: ['invalid-downstream-integration-proof-evidence'],
      });
    }
    evidenceRefs.push(Object.freeze({
      id,
      kind,
      digest,
      uri,
    }));
  }

  const checkInput = body.observedVerificationChecks ?? body.observedChecks ?? [];
  if (!Array.isArray(checkInput)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-checks-invalid',
      title: 'Invalid downstream integration proof checks',
      status: 400,
      detail: 'observedVerificationChecks must be an array when provided.',
      reasonCodes: ['invalid-downstream-integration-proof-checks'],
    });
  }
  const observedVerificationChecks: ShadowDownstreamVerificationCheckKind[] = [];
  for (const entry of checkInput) {
    const check = typeof entry === 'string'
      ? parseDownstreamVerificationCheck(entry)
      : null;
    if (!check) {
      return problem(c, {
        type: 'https://attestor.dev/problems/downstream-integration-proof-checks-invalid',
        title: 'Invalid downstream integration proof checks',
        status: 400,
        detail:
          `observedVerificationChecks entries must be one of: ${SHADOW_DOWNSTREAM_VERIFICATION_CHECKS.join(', ')}.`,
        reasonCodes: ['invalid-downstream-integration-proof-checks'],
      });
    }
    observedVerificationChecks.push(check);
  }

  return {
    enforcementPointId,
    boundaryKind,
    verifierRef,
    evidenceRefs: Object.freeze(evidenceRefs),
    observedVerificationChecks: Object.freeze(observedVerificationChecks),
  };
}

function parseCustomerActivationRefKind(
  value: string | null | undefined,
): ShadowCustomerActivationRefKind | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_REF_KINDS.includes(
    normalized as ShadowCustomerActivationRefKind,
  )
    ? normalized as ShadowCustomerActivationRefKind
    : null;
}

function parseCustomerActivationRolloutStrategy(
  value: string | null | undefined,
): ShadowCustomerActivationRolloutStrategy | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_ROLLOUT_STRATEGIES.includes(
    normalized as ShadowCustomerActivationRolloutStrategy,
  )
    ? normalized as ShadowCustomerActivationRolloutStrategy
    : null;
}

async function readCustomerActivationHandoffBody(c: Context): Promise<{
  readonly integration: DownstreamIntegrationProofRouteBody;
  readonly activationRef: string;
  readonly operatorRef: string;
  readonly secondaryApproverRef: string | null;
  readonly rolloutStrategy: ShadowCustomerActivationRolloutStrategy;
  readonly rollbackRef: ShadowCustomerActivationControlRef | null;
  readonly killSwitchRef: ShadowCustomerActivationControlRef | null;
  readonly monitoringRef: ShadowCustomerActivationControlRef | null;
  readonly breakGlassJustificationRef: ShadowCustomerActivationControlRef | null;
  readonly breakGlassReconciliationRef: ShadowCustomerActivationControlRef | null;
  readonly expiresAt: string | null;
} | Response> {
  if (!acceptsJsonRequestBody(c)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-json-required',
      title: 'Customer activation handoff JSON required',
      status: 415,
      detail: 'The customer activation handoff route requires Content-Type: application/json.',
      reasonCodes: ['customer-activation-handoff-json-required'],
    });
  }

  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-json-invalid',
      title: 'Invalid customer activation handoff JSON',
      status: 400,
      detail: 'The customer activation handoff route requires a valid JSON object body.',
      reasonCodes: ['invalid-json'],
    });
  }
  if (!isRecord(body)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-input-invalid',
      title: 'Invalid customer activation handoff input',
      status: 400,
      detail: 'The customer activation handoff route requires an object body.',
      reasonCodes: ['invalid-customer-activation-handoff-input'],
    });
  }
  const bodyRecord = body;

  const enforcementPointId = typeof bodyRecord.enforcementPointId === 'string'
    ? bodyRecord.enforcementPointId.trim()
    : '';
  const boundaryKind = typeof bodyRecord.boundaryKind === 'string'
    ? parseDownstreamBoundaryKind(bodyRecord.boundaryKind)
    : null;
  const verifierRef = typeof bodyRecord.verifierRef === 'string'
    ? bodyRecord.verifierRef.trim()
    : '';
  const activationRef = typeof bodyRecord.activationRef === 'string' ? bodyRecord.activationRef.trim() : '';
  const operatorRef = typeof bodyRecord.operatorRef === 'string' ? bodyRecord.operatorRef.trim() : '';
  const secondaryApproverRef = bodyRecord.secondaryApproverRef === undefined || bodyRecord.secondaryApproverRef === null
    ? null
    : typeof bodyRecord.secondaryApproverRef === 'string'
      ? bodyRecord.secondaryApproverRef.trim()
      : '';
  const rolloutStrategy = typeof bodyRecord.rolloutStrategy === 'string'
    ? parseCustomerActivationRolloutStrategy(bodyRecord.rolloutStrategy)
    : null;
  const expiresAt = bodyRecord.expiresAt === undefined || bodyRecord.expiresAt === null
    ? null
    : typeof bodyRecord.expiresAt === 'string'
      ? bodyRecord.expiresAt.trim()
      : '';
  if (!enforcementPointId || !boundaryKind || !verifierRef || !activationRef || !operatorRef || secondaryApproverRef === '' || !rolloutStrategy || expiresAt === '') {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-input-invalid',
      title: 'Invalid customer activation handoff input',
      status: 400,
      detail:
        `The customer activation handoff route requires enforcementPointId, verifierRef, boundaryKind, activationRef, operatorRef, and rolloutStrategy. Rollout strategy must be one of: ${SHADOW_CUSTOMER_ACTIVATION_ROLLOUT_STRATEGIES.join(', ')}.`,
      reasonCodes: ['invalid-customer-activation-handoff-input'],
    });
  }

  const evidenceInput = bodyRecord.evidenceRefs ?? [];
  if (!Array.isArray(evidenceInput)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-evidence-invalid',
      title: 'Invalid customer activation handoff evidence',
      status: 400,
      detail: 'evidenceRefs must be an array when provided.',
      reasonCodes: ['invalid-customer-activation-handoff-evidence'],
    });
  }
  const evidenceRefs: {
    readonly id: string;
    readonly kind: ShadowDownstreamIntegrationEvidenceKind;
    readonly digest: string;
    readonly uri: string | null;
  }[] = [];
  for (const entry of evidenceInput) {
    if (!isRecord(entry)) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-handoff-evidence-invalid',
        title: 'Invalid customer activation handoff evidence',
        status: 400,
        detail: 'Every evidenceRef must be an object with id, kind, digest, and optional uri.',
        reasonCodes: ['invalid-customer-activation-handoff-evidence'],
      });
    }
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const kind = typeof entry.kind === 'string'
      ? parseIntegrationEvidenceKind(entry.kind)
      : null;
    const digest = typeof entry.digest === 'string' ? entry.digest.trim() : '';
    const uri = entry.uri === undefined || entry.uri === null
      ? null
      : typeof entry.uri === 'string'
        ? entry.uri.trim()
        : '';
    if (!id || !kind || !digest || uri === '') {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-handoff-evidence-invalid',
        title: 'Invalid customer activation handoff evidence',
        status: 400,
        detail:
          `Every evidenceRef requires id, kind, and digest. Evidence kind must be one of: ${SHADOW_DOWNSTREAM_INTEGRATION_EVIDENCE_KINDS.join(', ')}.`,
        reasonCodes: ['invalid-customer-activation-handoff-evidence'],
      });
    }
    evidenceRefs.push(Object.freeze({ id, kind, digest, uri }));
  }

  const checkInput = bodyRecord.observedVerificationChecks ?? bodyRecord.observedChecks ?? [];
  if (!Array.isArray(checkInput)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-checks-invalid',
      title: 'Invalid customer activation handoff checks',
      status: 400,
      detail: 'observedVerificationChecks must be an array when provided.',
      reasonCodes: ['invalid-customer-activation-handoff-checks'],
    });
  }
  const observedVerificationChecks: ShadowDownstreamVerificationCheckKind[] = [];
  for (const entry of checkInput) {
    const check = typeof entry === 'string'
      ? parseDownstreamVerificationCheck(entry)
      : null;
    if (!check) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-handoff-checks-invalid',
        title: 'Invalid customer activation handoff checks',
        status: 400,
        detail:
          `observedVerificationChecks entries must be one of: ${SHADOW_DOWNSTREAM_VERIFICATION_CHECKS.join(', ')}.`,
        reasonCodes: ['invalid-customer-activation-handoff-checks'],
      });
    }
    observedVerificationChecks.push(check);
  }

  function readControlRef(fieldName: string): ShadowCustomerActivationControlRef | Response | null {
    const value = bodyRecord[fieldName];
    if (value === undefined || value === null) return null;
    if (!isRecord(value)) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-handoff-control-invalid',
        title: 'Invalid customer activation handoff control',
        status: 400,
        detail: `${fieldName} must be an object with id, kind, digest, and optional uri when provided.`,
        reasonCodes: ['invalid-customer-activation-handoff-control'],
      });
    }
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    const kind = typeof value.kind === 'string'
      ? parseCustomerActivationRefKind(value.kind)
      : null;
    const digest = typeof value.digest === 'string' ? value.digest.trim() : '';
    const uri = value.uri === undefined || value.uri === null
      ? null
      : typeof value.uri === 'string'
        ? value.uri.trim()
        : '';
    if (!id || !kind || !digest || uri === '') {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-handoff-control-invalid',
        title: 'Invalid customer activation handoff control',
        status: 400,
        detail:
          `${fieldName} requires id, kind, and digest. Control ref kind must be one of: ${SHADOW_CUSTOMER_ACTIVATION_REF_KINDS.join(', ')}.`,
        reasonCodes: ['invalid-customer-activation-handoff-control'],
      });
    }
    return Object.freeze({ id, kind, digest, uri });
  }

  const rollbackRef = readControlRef('rollbackRef');
  if (rollbackRef instanceof Response) return rollbackRef;
  const killSwitchRef = readControlRef('killSwitchRef');
  if (killSwitchRef instanceof Response) return killSwitchRef;
  const monitoringRef = readControlRef('monitoringRef');
  if (monitoringRef instanceof Response) return monitoringRef;
  const breakGlassJustificationRef = readControlRef('breakGlassJustificationRef');
  if (breakGlassJustificationRef instanceof Response) return breakGlassJustificationRef;
  const breakGlassReconciliationRef = readControlRef('breakGlassReconciliationRef');
  if (breakGlassReconciliationRef instanceof Response) return breakGlassReconciliationRef;

  return {
    integration: {
      enforcementPointId,
      boundaryKind,
      verifierRef,
      evidenceRefs: Object.freeze(evidenceRefs),
      observedVerificationChecks: Object.freeze(observedVerificationChecks),
    },
    activationRef,
    operatorRef,
    secondaryApproverRef,
    rolloutStrategy,
    rollbackRef,
    killSwitchRef,
    monitoringRef,
    breakGlassJustificationRef,
    breakGlassReconciliationRef,
    expiresAt,
  };
}

function parseCustomerActivationReceiptStatus(
  value: string | null | undefined,
): ShadowCustomerActivationReceiptStatus | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES.includes(
    normalized as ShadowCustomerActivationReceiptStatus,
  )
    ? normalized as ShadowCustomerActivationReceiptStatus
    : null;
}

function parseBooleanQuery(value: string | null | undefined): boolean | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

function parseCustomerActivationReceiptRollbackStatus(
  value: string | null | undefined,
): ShadowCustomerActivationReceiptRollbackStatus | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_RECEIPT_ROLLBACK_STATUSES.includes(
    normalized as ShadowCustomerActivationReceiptRollbackStatus,
  )
    ? normalized as ShadowCustomerActivationReceiptRollbackStatus
    : null;
}

function parseCustomerActivationReceiptKillSwitchStatus(
  value: string | null | undefined,
): ShadowCustomerActivationReceiptKillSwitchStatus | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_RECEIPT_KILL_SWITCH_STATUSES.includes(
    normalized as ShadowCustomerActivationReceiptKillSwitchStatus,
  )
    ? normalized as ShadowCustomerActivationReceiptKillSwitchStatus
    : null;
}

function parseCustomerActivationReceiptMonitoringStatus(
  value: string | null | undefined,
): ShadowCustomerActivationReceiptMonitoringStatus | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_RECEIPT_MONITORING_STATUSES.includes(
    normalized as ShadowCustomerActivationReceiptMonitoringStatus,
  )
    ? normalized as ShadowCustomerActivationReceiptMonitoringStatus
    : null;
}

async function readCustomerActivationReceiptBody(c: Context): Promise<{
  readonly handoff: ShadowCustomerActivationHandoff;
  readonly activationStatus: ShadowCustomerActivationReceiptStatus;
  readonly attemptedAt: string;
  readonly observedAt: string;
  readonly completedAt: string | null;
  readonly activationDigest: string | null;
  readonly externalReceiptDigest: string | null;
  readonly rollbackStatus: ShadowCustomerActivationReceiptRollbackStatus | null;
  readonly rollbackDigest: string | null;
  readonly killSwitchStatus: ShadowCustomerActivationReceiptKillSwitchStatus | null;
  readonly monitoringStatus: ShadowCustomerActivationReceiptMonitoringStatus | null;
  readonly errorDigest: string | null;
  readonly skipReasonCode: string | null;
} | Response> {
  if (!acceptsJsonRequestBody(c)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-json-required',
      title: 'Customer activation receipt JSON required',
      status: 415,
      detail: 'The customer activation receipt route requires Content-Type: application/json.',
      reasonCodes: ['customer-activation-receipt-json-required'],
    });
  }

  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-json-invalid',
      title: 'Invalid customer activation receipt JSON',
      status: 400,
      detail: 'The customer activation receipt route requires a valid JSON object body.',
      reasonCodes: ['invalid-json'],
    });
  }
  if (!isRecord(body)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-input-invalid',
      title: 'Invalid customer activation receipt input',
      status: 400,
      detail: 'The customer activation receipt route requires an object body.',
      reasonCodes: ['invalid-customer-activation-receipt-input'],
    });
  }
  const bodyRecord = body;
  const handoff = bodyRecord.handoff;
  const activationStatus = typeof bodyRecord.activationStatus === 'string'
    ? parseCustomerActivationReceiptStatus(bodyRecord.activationStatus)
    : null;
  const attemptedAt = typeof bodyRecord.attemptedAt === 'string' ? bodyRecord.attemptedAt.trim() : '';
  const observedAt = typeof bodyRecord.observedAt === 'string' ? bodyRecord.observedAt.trim() : '';
  const completedAt = bodyRecord.completedAt === undefined || bodyRecord.completedAt === null
    ? null
    : typeof bodyRecord.completedAt === 'string'
      ? bodyRecord.completedAt.trim()
      : '';
  if (!isRecord(handoff) || !activationStatus || !attemptedAt || !observedAt || completedAt === '') {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-input-invalid',
      title: 'Invalid customer activation receipt input',
      status: 400,
      detail:
        `The customer activation receipt route requires handoff, activationStatus, attemptedAt, and observedAt. Activation status must be one of: ${SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES.join(', ')}.`,
      reasonCodes: ['invalid-customer-activation-receipt-input'],
    });
  }

  const rollbackStatus = bodyRecord.rollbackStatus === undefined || bodyRecord.rollbackStatus === null
    ? null
    : typeof bodyRecord.rollbackStatus === 'string'
      ? parseCustomerActivationReceiptRollbackStatus(bodyRecord.rollbackStatus)
      : null;
  const killSwitchStatus = bodyRecord.killSwitchStatus === undefined || bodyRecord.killSwitchStatus === null
    ? null
    : typeof bodyRecord.killSwitchStatus === 'string'
      ? parseCustomerActivationReceiptKillSwitchStatus(bodyRecord.killSwitchStatus)
      : null;
  const monitoringStatus = bodyRecord.monitoringStatus === undefined || bodyRecord.monitoringStatus === null
    ? null
    : typeof bodyRecord.monitoringStatus === 'string'
      ? parseCustomerActivationReceiptMonitoringStatus(bodyRecord.monitoringStatus)
      : null;
  if (
    (bodyRecord.rollbackStatus !== undefined && bodyRecord.rollbackStatus !== null && !rollbackStatus) ||
    (bodyRecord.killSwitchStatus !== undefined && bodyRecord.killSwitchStatus !== null && !killSwitchStatus) ||
    (bodyRecord.monitoringStatus !== undefined && bodyRecord.monitoringStatus !== null && !monitoringStatus)
  ) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-status-invalid',
      title: 'Invalid customer activation receipt status',
      status: 400,
      detail:
        'rollbackStatus, killSwitchStatus, or monitoringStatus is outside the supported receipt vocabulary.',
      reasonCodes: ['invalid-customer-activation-receipt-status'],
    });
  }

  function optionalString(fieldName: string): string | null {
    const value = bodyRecord[fieldName];
    if (value === undefined || value === null) return null;
    return typeof value === 'string' ? value.trim() : '';
  }

  const activationDigest = optionalString('activationDigest');
  const externalReceiptDigest = optionalString('externalReceiptDigest');
  const rollbackDigest = optionalString('rollbackDigest');
  const errorDigest = optionalString('errorDigest');
  const skipReasonCode = optionalString('skipReasonCode');
  if (
    activationDigest === '' ||
    externalReceiptDigest === '' ||
    rollbackDigest === '' ||
    errorDigest === '' ||
    skipReasonCode === ''
  ) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-input-invalid',
      title: 'Invalid customer activation receipt input',
      status: 400,
      detail: 'Optional customer activation receipt digest and reason fields must be strings when provided.',
      reasonCodes: ['invalid-customer-activation-receipt-input'],
    });
  }

  return {
    handoff: handoff as unknown as ShadowCustomerActivationHandoff,
    activationStatus,
    attemptedAt,
    observedAt,
    completedAt,
    activationDigest,
    externalReceiptDigest,
    rollbackStatus,
    rollbackDigest,
    killSwitchStatus,
    monitoringStatus,
    errorDigest,
    skipReasonCode,
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

  app.get('/api/v1/shadow/audit-evidence', (c) => {
    const result = safeShadowSummary(c, deps);
    if (result instanceof Response) return result;
    const policyDiscovery = createShadowPolicyDiscoveryCandidates({
      report: result.surface.latestSimulation,
      generatedAt: result.surface.generatedAt,
    });
    const auditEvidence = createConsequenceAuditEvidenceExport({
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
    const policyDiscovery = createShadowPolicyDiscoveryCandidates({
      report: result.surface.latestSimulation,
      generatedAt: result.surface.generatedAt,
    });
    const auditEvidence = createConsequenceAuditEvidenceExport({
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
    const dashboard = createConsequenceBusinessRiskDashboard({
      auditExport: auditEvidence,
      generatedAt: result.surface.generatedAt,
    });

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
    const policyDiscovery = createShadowPolicyDiscoveryCandidates({
      report: result.surface.latestSimulation,
      generatedAt: result.surface.generatedAt,
    });
    const auditEvidence = createConsequenceAuditEvidenceExport({
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
    const dashboard = createConsequenceBusinessRiskDashboard({
      auditExport: auditEvidence,
      generatedAt: result.surface.generatedAt,
    });
    const summary = createConsequenceDashboardApiSummary({
      auditEvidence,
      dashboard,
      generatedAt: result.surface.generatedAt,
    });

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
      const routeId = 'shadow.simulations.create';
      const requestPayload = {
        proposedMode: body.proposedMode,
        minimumPromotionEvents: body.minimumPromotionEvents,
      };
      const idempotency = await beginShadowMutationIdempotency(c, deps, routeId, requestPayload);
      if (idempotency.kind === 'response') return idempotency.response;
      const { tenant } = idempotency;
      const events = assertTenantBoundRecords(
        tenant,
        deps.listShadowEvents({ tenant }),
        'shadow admission event',
        { allowNullTenantId: true },
      );
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
      const persistedRecord = assertTenantBoundRecord(
        tenant,
        persisted.record,
        'shadow simulation',
      );
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.simulation.recorded',
        tenant,
        requestPayload,
        statusCode: 200,
        metadata: {
          persistenceKind: persisted.kind,
          reportId: persistedRecord.reportId,
          reportDigest: persistedRecord.reportDigest,
          eventCount: persistedRecord.eventCount,
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
          storageMode: 'file-backed-evaluation',
          productionReady: false,
          rawPayloadStored: false,
          report,
          persisted: {
            kind: persisted.kind,
            record: persistedRecord,
          },
        },
      );
      return c.json(responseBody);
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [{ marker: 'exceeds maximum', status: 400 }],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-record-failed',
        title: 'Shadow simulation record failed',
        status,
        detail: boundedErrorDetail(error, 'The shadow simulation report could not be recorded.', {
          safeMarkers: ['exceeds maximum'],
          safeDetail: 'The shadow simulation request exceeds the supported event bound.',
        }),
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
      const records = assertTenantBoundRecords(
        tenant,
        deps.listShadowPolicySimulationReports({ tenant, proposedMode }),
        'shadow simulation',
      );
      const page = shadowListPage(c, records, 'Shadow simulation');
      if (page instanceof Response) return page;
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        recordCount: page.records.length,
        pageInfo: page.pageInfo,
        rawPayloadStored: false,
        productionReady: false,
        records: page.records,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-list-failed',
        title: 'Shadow simulation list failed',
        status: 503,
        detail: boundedErrorDetail(error, 'The shadow simulation reports could not be listed.'),
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
      const tenantRecord = assertTenantBoundRecord(tenant, record, 'shadow simulation');
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        rawPayloadStored: false,
        productionReady: false,
        record: tenantRecord,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-load-failed',
        title: 'Shadow simulation load failed',
        status: 503,
        detail: boundedErrorDetail(error, 'The shadow simulation report could not be loaded.'),
        reasonCodes: ['shadow-simulation-load-failed'],
      });
    }
  });

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

    const customerApprovedQuery = c.req.query('customerApproved');
    const customerApproved = parseBooleanQuery(customerApprovedQuery);
    if (customerApprovedQuery && customerApproved === null) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-readiness-query-invalid',
        title: 'Invalid Policy Foundry readiness query',
        status: 400,
        detail: 'customerApproved must be true or false when provided.',
        reasonCodes: ['invalid-policy-foundry-readiness-query'],
      });
    }

    const tenantBoundaryProvenQuery = c.req.query('tenantBoundaryProven');
    const tenantBoundaryProven = parseBooleanQuery(tenantBoundaryProvenQuery);
    if (tenantBoundaryProvenQuery && tenantBoundaryProven === null) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-readiness-query-invalid',
        title: 'Invalid Policy Foundry readiness query',
        status: 400,
        detail: 'tenantBoundaryProven must be true or false when provided.',
        reasonCodes: ['invalid-policy-foundry-readiness-query'],
      });
    }

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
    const readiness = evaluatePolicyFoundryReadiness({
      candidate,
      report: result.surface.latestSimulation,
      events: result.events,
      generatedAt: deps.now?.() ?? null,
      customerApproved,
      tenantBoundaryProven,
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

    const customerApprovedQuery = c.req.query('customerApproved');
    const customerApproved = parseBooleanQuery(customerApprovedQuery);
    if (customerApprovedQuery && customerApproved === null) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-active-questions-query-invalid',
        title: 'Invalid Policy Foundry active questions query',
        status: 400,
        detail: 'customerApproved must be true or false when provided.',
        reasonCodes: ['invalid-policy-foundry-active-questions-query'],
      });
    }

    const tenantBoundaryProvenQuery = c.req.query('tenantBoundaryProven');
    const tenantBoundaryProven = parseBooleanQuery(tenantBoundaryProvenQuery);
    if (tenantBoundaryProvenQuery && tenantBoundaryProven === null) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-active-questions-query-invalid',
        title: 'Invalid Policy Foundry active questions query',
        status: 400,
        detail: 'tenantBoundaryProven must be true or false when provided.',
        reasonCodes: ['invalid-policy-foundry-active-questions-query'],
      });
    }

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
    const readiness = evaluatePolicyFoundryReadiness({
      candidate,
      report: result.surface.latestSimulation,
      events: result.events,
      generatedAt: deps.now?.() ?? null,
      customerApproved,
      tenantBoundaryProven,
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

  app.get('/api/v1/shadow/downstream-verification-binding', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Downstream verification binding generation is not configured for this runtime.',
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
          `Downstream verification bindings can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
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
      const binding = createShadowDownstreamVerificationBinding({
        simulation,
        generatedAt: deps.now?.() ?? null,
      });
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        binding,
      });
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [{ marker: 'exceeds maximum', status: 400 }],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/downstream-verification-binding-failed',
        title: 'Downstream verification binding failed',
        status,
        detail: boundedErrorDetail(error, 'Downstream verification binding could not be generated.', {
          safeMarkers: ['exceeds maximum'],
          safeDetail: 'The downstream verification binding exceeds the supported event bound.',
        }),
        reasonCodes: ['downstream-verification-binding-failed'],
      });
    }
  });

  app.post('/api/v1/shadow/downstream-integration-proof', async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readDownstreamIntegrationProofBody(c);
    if (body instanceof Response) return body;
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Downstream integration proof generation is not configured for this runtime.',
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
          `Downstream integration proofs can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }
    const routeId = 'shadow.downstream_integration_proof.create';
    const requestPayload = {
      sourceStatus,
      enforcementPointId: body.enforcementPointId,
      boundaryKind: body.boundaryKind,
      verifierRef: body.verifierRef,
      evidenceRefs: body.evidenceRefs,
      observedVerificationChecks: body.observedVerificationChecks,
    };

    try {
      const idempotency = await beginShadowMutationIdempotency(c, deps, routeId, requestPayload);
      if (idempotency.kind === 'response') return idempotency.response;
      const { tenant } = idempotency;
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
      const binding = createShadowDownstreamVerificationBinding({
        simulation,
        generatedAt: deps.now?.() ?? null,
      });
      const proof = createShadowDownstreamIntegrationProof({
        publication,
        binding,
        enforcementPointId: body.enforcementPointId,
        boundaryKind: body.boundaryKind,
        verifierRef: body.verifierRef,
        evidenceRefs: body.evidenceRefs,
        observedVerificationChecks: body.observedVerificationChecks,
        generatedAt: deps.now?.() ?? null,
      });
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.downstream_integration_proof.generated',
        tenant,
        requestPayload: {
          ...requestPayload,
          evidenceRefCount: body.evidenceRefs.length,
        },
        statusCode: 200,
        metadata: {
          integrationProofDigest: proof.digest,
          integrationProofReady: proof.integrationProofReady,
          activationReady: proof.activationReady,
          observedCheckCount: proof.observedCheckCount,
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
          storageMode: 'file-backed-evaluation',
          productionReady: false,
          approvalRequired: true,
          autoEnforce: false,
          rawPayloadStored: false,
          proof,
        },
      );
      return c.json(responseBody);
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [
          { marker: 'Shadow downstream integration proof', status: 400 },
          { marker: 'exceeds maximum', status: 400 },
        ],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/downstream-integration-proof-failed',
        title: 'Downstream integration proof failed',
        status,
        detail: boundedErrorDetail(error, 'Downstream integration proof could not be generated.', {
          safeMarkers: ['Shadow downstream integration proof', 'exceeds maximum'],
          safeDetail: 'The downstream integration proof input did not satisfy the shadow proof contract.',
        }),
        reasonCodes: ['downstream-integration-proof-failed'],
      });
    }
  });

  app.post('/api/v1/shadow/activation-readiness', async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readDownstreamIntegrationProofBody(c);
    if (body instanceof Response) return body;
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Activation readiness evaluation is not configured for this runtime.',
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
          `Activation readiness can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }
    const routeId = 'shadow.activation_readiness.create';
    const requestPayload = {
      sourceStatus,
      enforcementPointId: body.enforcementPointId,
      boundaryKind: body.boundaryKind,
      verifierRef: body.verifierRef,
      evidenceRefs: body.evidenceRefs,
      observedVerificationChecks: body.observedVerificationChecks,
    };

    try {
      const idempotency = await beginShadowMutationIdempotency(c, deps, routeId, requestPayload);
      if (idempotency.kind === 'response') return idempotency.response;
      const { tenant } = idempotency;
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
      const binding = createShadowDownstreamVerificationBinding({
        simulation,
        generatedAt: deps.now?.() ?? null,
      });
      const integrationProof = createShadowDownstreamIntegrationProof({
        publication,
        binding,
        enforcementPointId: body.enforcementPointId,
        boundaryKind: body.boundaryKind,
        verifierRef: body.verifierRef,
        evidenceRefs: body.evidenceRefs,
        observedVerificationChecks: body.observedVerificationChecks,
        generatedAt: deps.now?.() ?? null,
      });
      const activationReadiness = createShadowActivationReadinessGate({
        sourceStatus,
        publication,
        binding,
        integrationProof,
        generatedAt: deps.now?.() ?? null,
      });
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.activation_readiness.generated',
        tenant,
        requestPayload: {
          ...requestPayload,
          evidenceRefCount: body.evidenceRefs.length,
        },
        statusCode: 200,
        metadata: {
          readinessDigest: activationReadiness.digest,
          activationReady: activationReadiness.activationReady,
          remainingBlockerCount: activationReadiness.remainingActivationBlockers.length,
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
          storageMode: 'file-backed-evaluation',
          productionReady: false,
          approvalRequired: true,
          autoEnforce: false,
          rawPayloadStored: false,
          activationReadiness,
        },
      );
      return c.json(responseBody);
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [
          { marker: 'Shadow downstream integration proof', status: 400 },
          { marker: 'Shadow activation readiness gate', status: 400 },
          { marker: 'exceeds maximum', status: 400 },
        ],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/activation-readiness-failed',
        title: 'Activation readiness failed',
        status,
        detail: boundedErrorDetail(error, 'Activation readiness could not be generated.', {
          safeMarkers: [
            'Shadow downstream integration proof',
            'Shadow activation readiness gate',
            'exceeds maximum',
          ],
          safeDetail: 'The activation readiness input did not satisfy the shadow activation contract.',
        }),
        reasonCodes: ['activation-readiness-failed'],
      });
    }
  });

  app.post('/api/v1/shadow/customer-activation-handoff', async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readCustomerActivationHandoffBody(c);
    if (body instanceof Response) return body;
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Customer activation handoff generation is not configured for this runtime.',
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
          `Customer activation handoffs can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }
    const routeId = 'shadow.customer_activation_handoff.create';
    const requestPayload = {
      sourceStatus,
      integration: body.integration,
      activationRef: body.activationRef,
      operatorRef: body.operatorRef,
      secondaryApproverRef: body.secondaryApproverRef,
      rolloutStrategy: body.rolloutStrategy,
      rollbackRef: body.rollbackRef,
      killSwitchRef: body.killSwitchRef,
      monitoringRef: body.monitoringRef,
      breakGlassJustificationRef: body.breakGlassJustificationRef,
      breakGlassReconciliationRef: body.breakGlassReconciliationRef,
      expiresAt: body.expiresAt,
    };

    try {
      const idempotency = await beginShadowMutationIdempotency(c, deps, routeId, requestPayload);
      if (idempotency.kind === 'response') return idempotency.response;
      const { tenant } = idempotency;
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
      const binding = createShadowDownstreamVerificationBinding({
        simulation,
        generatedAt: deps.now?.() ?? null,
      });
      const integrationProof = createShadowDownstreamIntegrationProof({
        publication,
        binding,
        enforcementPointId: body.integration.enforcementPointId,
        boundaryKind: body.integration.boundaryKind,
        verifierRef: body.integration.verifierRef,
        evidenceRefs: body.integration.evidenceRefs,
        observedVerificationChecks: body.integration.observedVerificationChecks,
        generatedAt: deps.now?.() ?? null,
      });
      const activationReadiness = createShadowActivationReadinessGate({
        sourceStatus,
        publication,
        binding,
        integrationProof,
        generatedAt: deps.now?.() ?? null,
      });
      const handoff = createShadowCustomerActivationHandoff({
        activationReadiness,
        activationRef: body.activationRef,
        operatorRef: body.operatorRef,
        secondaryApproverRef: body.secondaryApproverRef,
        activationBoundaryKind: body.integration.boundaryKind,
        rolloutStrategy: body.rolloutStrategy,
        rollbackRef: body.rollbackRef,
        killSwitchRef: body.killSwitchRef,
        monitoringRef: body.monitoringRef,
        breakGlassJustificationRef: body.breakGlassJustificationRef,
        breakGlassReconciliationRef: body.breakGlassReconciliationRef,
        expiresAt: body.expiresAt,
        generatedAt: deps.now?.() ?? null,
      });
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.customer_activation_handoff.generated',
        tenant,
        requestPayload: {
          sourceStatus,
          enforcementPointId: body.integration.enforcementPointId,
          boundaryKind: body.integration.boundaryKind,
          verifierRef: body.integration.verifierRef,
          evidenceRefCount: body.integration.evidenceRefs.length,
          observedVerificationChecks: body.integration.observedVerificationChecks,
          rolloutStrategy: body.rolloutStrategy,
          hasSecondaryApprover: body.secondaryApproverRef !== null,
        },
        statusCode: 200,
        metadata: {
          handoffId: handoff.handoffId,
          handoffDigest: handoff.digest,
          sourceActivationReadinessDigest: handoff.sourceActivationReadinessDigest,
          handoffReady: handoff.handoffReady,
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
          storageMode: 'file-backed-evaluation',
          productionReady: false,
          approvalRequired: true,
          autoEnforce: false,
          rawPayloadStored: false,
          handoff,
        },
      );
      return c.json(responseBody);
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [
          { marker: 'Shadow downstream integration proof', status: 400 },
          { marker: 'Shadow activation readiness gate', status: 400 },
          { marker: 'Shadow customer activation handoff', status: 400 },
          { marker: 'exceeds maximum', status: 400 },
        ],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-handoff-failed',
        title: 'Customer activation handoff failed',
        status,
        detail: boundedErrorDetail(error, 'Customer activation handoff could not be generated.', {
          safeMarkers: [
            'Shadow downstream integration proof',
            'Shadow activation readiness gate',
            'Shadow customer activation handoff',
            'exceeds maximum',
          ],
          safeDetail: 'The customer activation handoff input did not satisfy the shadow activation contract.',
        }),
        reasonCodes: ['customer-activation-handoff-failed'],
      });
    }
  });

  app.post('/api/v1/shadow/customer-activation-receipt', async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readCustomerActivationReceiptBody(c);
    if (body instanceof Response) return body;

    try {
      const routeId = 'shadow.customer_activation_receipt.create';
      const requestPayload = {
        sourceHandoffId: body.handoff.handoffId,
        sourceHandoffDigest: body.handoff.digest,
        activationStatus: body.activationStatus,
        attemptedAt: body.attemptedAt,
        observedAt: body.observedAt,
        completedAt: body.completedAt,
        activationDigest: body.activationDigest,
        externalReceiptDigest: body.externalReceiptDigest,
        rollbackStatus: body.rollbackStatus,
        rollbackDigest: body.rollbackDigest,
        killSwitchStatus: body.killSwitchStatus,
        monitoringStatus: body.monitoringStatus,
        errorDigest: body.errorDigest,
        skipReasonCode: body.skipReasonCode,
      };
      const idempotency = await beginShadowMutationIdempotency(c, deps, routeId, requestPayload);
      if (idempotency.kind === 'response') return idempotency.response;
      const { tenant } = idempotency;
      const receipt = createShadowCustomerActivationReceipt({
        handoff: body.handoff,
        activationStatus: body.activationStatus,
        attemptedAt: body.attemptedAt,
        observedAt: body.observedAt,
        completedAt: body.completedAt,
        activationDigest: body.activationDigest,
        externalReceiptDigest: body.externalReceiptDigest,
        rollbackStatus: body.rollbackStatus,
        rollbackDigest: body.rollbackDigest,
        killSwitchStatus: body.killSwitchStatus,
        monitoringStatus: body.monitoringStatus,
        errorDigest: body.errorDigest,
        skipReasonCode: body.skipReasonCode,
        generatedAt: deps.now?.() ?? null,
      });
      if (receipt.tenantId !== tenant.tenantId) {
        return problem(c, {
          type: 'https://attestor.dev/problems/customer-activation-receipt-tenant-mismatch',
          title: 'Customer activation receipt tenant mismatch',
          status: 400,
          detail: 'The handoff tenant does not match the authenticated tenant.',
          reasonCodes: ['customer-activation-receipt-tenant-mismatch'],
        });
      }
      const persisted = deps.recordShadowCustomerActivationReceipt?.({
        tenant,
        receipt,
      }) ?? null;
      const persistedRecord = persisted
        ? assertTenantBoundRecord(tenant, persisted.record, 'shadow customer activation receipt')
        : null;
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.customer_activation_receipt.recorded',
        tenant,
        requestPayload: {
          sourceHandoffId: receipt.sourceHandoffId,
          sourceHandoffDigest: receipt.sourceHandoffDigest,
          activationStatus: body.activationStatus,
          rollbackStatus: body.rollbackStatus,
          killSwitchStatus: body.killSwitchStatus,
          monitoringStatus: body.monitoringStatus,
          persisted: persisted !== null,
        },
        statusCode: 200,
        metadata: {
          storageMode: persisted ? 'file-backed-evaluation' : 'stateless-receipt',
          receiptId: receipt.receiptId,
          receiptDigest: receipt.digest,
          persistenceKind: persisted?.kind ?? null,
          persistedReceiptId: persistedRecord?.receiptId ?? null,
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
          storageMode: persisted ? 'file-backed-evaluation' : 'stateless-receipt',
          productionReady: false,
          approvalRequired: true,
          autoEnforce: false,
          rawPayloadStored: false,
          receipt,
          persisted: persisted
            ? {
              kind: persisted.kind,
              record: persistedRecord,
            }
            : null,
        },
      );
      return c.json(responseBody);
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [{ marker: 'Shadow customer activation receipt', status: 400 }],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-failed',
        title: 'Customer activation receipt failed',
        status,
        detail: boundedErrorDetail(error, 'Customer activation receipt could not be generated.', {
          safeMarkers: ['Shadow customer activation receipt'],
          safeDetail: 'The customer activation receipt input did not satisfy the shadow receipt contract.',
        }),
        reasonCodes: ['customer-activation-receipt-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/customer-activation-receipts', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowCustomerActivationReceiptRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-store-unavailable',
        title: 'Customer activation receipt store unavailable',
        status: 503,
        detail: 'Customer activation receipt history is not configured for this runtime.',
        reasonCodes: ['customer-activation-receipt-store-unavailable'],
      });
    }
    const statusQuery = c.req.query('activationStatus');
    const activationStatus = statusQuery
      ? parseCustomerActivationReceiptStatus(statusQuery)
      : null;
    if (statusQuery && !activationStatus) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-status-invalid',
        title: 'Invalid customer activation receipt status',
        status: 400,
        detail:
          `activationStatus must be one of: ${SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-customer-activation-receipt-status'],
      });
    }
    const receiptReadyQuery = c.req.query('receiptReady');
    const receiptReady = parseBooleanQuery(receiptReadyQuery);
    if (receiptReadyQuery && receiptReady === null) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-ready-invalid',
        title: 'Invalid customer activation receipt ready filter',
        status: 400,
        detail: 'receiptReady must be true or false when provided.',
        reasonCodes: ['invalid-customer-activation-receipt-ready'],
      });
    }
    const sourceHandoffDigest = c.req.query('sourceHandoffDigest')?.trim() || null;

    try {
      const tenant = deps.currentTenant(c);
      const records = assertTenantBoundRecords(
        tenant,
        deps.listShadowCustomerActivationReceiptRecords({
          tenant,
          activationStatus,
          receiptReady,
          sourceHandoffDigest,
        }),
        'shadow customer activation receipt',
      );
      const page = shadowListPage(c, records, 'Shadow customer activation receipt');
      if (page instanceof Response) return page;
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        rawPayloadStored: false,
        recordCount: page.records.length,
        pageInfo: page.pageInfo,
        records: page.records,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-list-failed',
        title: 'Customer activation receipt list failed',
        status: 503,
        detail: boundedErrorDetail(error, 'Customer activation receipt history could not be listed.'),
        reasonCodes: ['customer-activation-receipt-list-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/customer-activation-receipts/:receiptId', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.findShadowCustomerActivationReceipt) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-store-unavailable',
        title: 'Customer activation receipt store unavailable',
        status: 503,
        detail: 'Customer activation receipt lookup is not configured for this runtime.',
        reasonCodes: ['customer-activation-receipt-store-unavailable'],
      });
    }

    try {
      const tenant = deps.currentTenant(c);
      const record = deps.findShadowCustomerActivationReceipt({
        tenant,
        receiptId: c.req.param('receiptId'),
      });
      if (!record) {
        return problem(c, {
          type: 'https://attestor.dev/problems/customer-activation-receipt-not-found',
          title: 'Customer activation receipt not found',
          status: 404,
          detail: 'No customer activation receipt was found for this tenant and receipt id.',
          reasonCodes: ['customer-activation-receipt-not-found'],
        });
      }
      const tenantRecord = assertTenantBoundRecord(
        tenant,
        record,
        'shadow customer activation receipt',
      );
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        rawPayloadStored: false,
        record: tenantRecord,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-lookup-failed',
        title: 'Customer activation receipt lookup failed',
        status: 503,
        detail: boundedErrorDetail(error, 'Customer activation receipt lookup failed.'),
        reasonCodes: ['customer-activation-receipt-lookup-failed'],
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
      const requestPayload = {
        candidateId,
        status: body.status,
        actorRef: body.actorRef,
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
          actorRef: body.actorRef,
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
          actorRef: body.actorRef,
          reasonLength: body.reason.length,
        },
        statusCode: 200,
        metadata: {
          candidateId: record.candidateId,
          candidateDigest: record.candidateDigest,
          status: record.status,
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
