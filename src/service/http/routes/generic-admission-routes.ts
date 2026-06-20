import type { Context, Hono } from 'hono';
import {
  createConsequenceAdmissionRequestableDenial,
  createConsequenceAdmissionProblem,
  createGenericAdmissionEnvelope,
  evaluateGenericAdmissionProtectedReleaseTokenRequirement,
  GenericAdmissionProtectedReleaseTokenIssuanceError,
  type ConsequenceAdmissionAccessRequestPrincipalInput,
  type ConsequenceAdmissionAccessRequestTask,
  type ConsequenceAdmissionAgentLoopAbuseGuardDecision,
  type ConsequenceAdmissionRequestableDenial,
  type ConsequenceAdmissionRequestableDenialReason,
  type GenericAdmissionEnvelope,
} from '../../../consequence-admission/index.js';
import { resolvePlanGenericAdmissionMode } from '../../plan-catalog.js';
import type { TenantContext } from '../../tenant-isolation.js';
import {
  evaluateWorkflowEntitlementAccess,
  type WorkflowEntitlementAccessDecision,
  type WorkflowEntitlementRecord,
} from '../../workflow-entitlement.js';
import type {
  PipelineIdempotencyReadyResult,
} from '../../application/pipeline-idempotency-service.js';
import { acceptsJsonRequestBody } from '../route-response-helpers.js';
import {
  registerGenericAdmissionAccessRequestRoutes,
  resolveAccessRequestReevaluation,
} from './generic-admission-access-request-routes.js';
import type {
  GenericAdmissionRouteDeps,
  GenericAdmissionRouteResponseEnvelope,
  WorkflowAdmissionConsumptionResult,
} from './generic-admission-route-types.js';

export type {
  GenericAdmissionRouteDeps,
  GenericAdmissionRouteResponseEnvelope,
  WorkflowAdmissionConsumptionResult,
  WorkflowAdmissionMeteringResult,
} from './generic-admission-route-types.js';

type GenericAdmissionIdempotencyBegin =
  | {
      readonly kind: 'ready';
      readonly ready: PipelineIdempotencyReadyResult | null;
    }
  | {
      readonly kind: 'response';
      readonly response: Response;
    };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalStringField(
  payload: unknown,
  keys: readonly string[],
): string | null {
  if (!isRecord(payload)) return null;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

function nestedRecordField(payload: unknown, key: string): Readonly<Record<string, unknown>> | null {
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return isRecord(value) ? value : null;
}

function workflowIdFromAdmissionPayload(payload: unknown): string | null {
  return optionalStringField(payload, ['workflowId', 'workflowRef'])
    ?? optionalStringField(nestedRecordField(payload, 'workflow'), ['workflowId', 'id'])
    ?? optionalStringField(nestedRecordField(payload, 'billingWorkflow'), ['workflowId', 'id']);
}

function workflowRequestedCapability(payload: unknown): string | null {
  return optionalStringField(payload, ['requestedCapability', 'workflowCapability', 'capability'])
    ?? optionalStringField(nestedRecordField(payload, 'workflow'), ['requestedCapability', 'capability']);
}

function workflowRequestedPack(payload: unknown): string | null {
  return optionalStringField(payload, ['requestedConsequencePack', 'consequencePack', 'pack'])
    ?? optionalStringField(nestedRecordField(payload, 'workflow'), ['requestedConsequencePack', 'consequencePack', 'pack']);
}

function workflowCustomerGateProofPresent(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  if (
    payload.customerGateProofPresent === true ||
    payload.policyGateProofPresent === true ||
    payload.customerGateProof === true
  ) {
    return true;
  }
  const workflow = nestedRecordField(payload, 'workflow');
  return workflow?.customerGateProofPresent === true
    || workflow?.policyGateProofPresent === true
    || workflow?.customerGateProof === true;
}

const NON_REQUESTABLE_DENIAL_REASON_CODES = [
  'untrusted-content-authority-source',
  'model-generated-authority-source',
  'trust-class-override-rejected',
  'authority-block',
  'approval-source-untrusted',
  'approval-model-generated',
  'approval-tool-output-unverified',
  'approval-state-rejected-or-revoked',
  'approval-trust-class-source-mismatch',
  'approval-duplicate-reviewer',
  'approval-block',
  'policy-version-mismatch',
  'policy-superseded',
  'policy-updated-after-approval',
  'drift-state-block',
  'no-go-reason-present',
] as const;

const STEP_UP_REQUESTABLE_REASON_CODES = [
  'approval-step-up-missing',
] as const;

const FRESHNESS_REQUESTABLE_REASON_CODES = [
  'approval-expired',
  'authority-freshness-missing',
  'authority-freshness-too-old',
  'authority-expired',
] as const;

const APPROVAL_REQUESTABLE_REASON_CODES = [
  'approval-missing',
  'approval-source-missing',
  'approval-state-not-approved',
  'reviewer-identity-missing',
  'reviewer-authority-missing',
  'approval-digest-missing',
  'approval-scope-missing',
  'approval-issued-at-missing',
  'approval-count-insufficient',
] as const;

function hasAnyReasonCode(
  reasonCodes: ReadonlySet<string>,
  candidates: readonly string[],
): boolean {
  return candidates.some((code) => reasonCodes.has(code));
}

function requestableDenialReasonFor(
  envelope: GenericAdmissionEnvelope,
): ConsequenceAdmissionRequestableDenialReason | null {
  const admission = envelope.admission;
  if (!envelope.enforcementActive || admission.allowed || !admission.failClosed) {
    return null;
  }
  const reasonCodes = new Set(admission.reasonCodes);
  if (hasAnyReasonCode(reasonCodes, NON_REQUESTABLE_DENIAL_REASON_CODES)) {
    return null;
  }
  if (hasAnyReasonCode(reasonCodes, STEP_UP_REQUESTABLE_REASON_CODES)) {
    return 'step-up-required';
  }
  if (hasAnyReasonCode(reasonCodes, FRESHNESS_REQUESTABLE_REASON_CODES)) {
    return 'authority-freshness-required';
  }
  if (hasAnyReasonCode(reasonCodes, APPROVAL_REQUESTABLE_REASON_CODES)) {
    return 'approval-required';
  }
  return null;
}

function requestableDenialExpiresAt(input: {
  readonly envelope: GenericAdmissionEnvelope;
  readonly receivedAt: string;
}): string {
  const receivedAtMs = new Date(input.receivedAt).getTime();
  const baseMs = Number.isNaN(receivedAtMs) ? Date.now() : receivedAtMs;
  return new Date(baseMs + 10 * 60 * 1000).toISOString();
}

function createRouteRequestableDenial(input: {
  readonly envelope: GenericAdmissionEnvelope;
  readonly receivedAt: string;
}): ConsequenceAdmissionRequestableDenial | null {
  const reason = requestableDenialReasonFor(input.envelope);
  if (reason === null) return null;
  return createConsequenceAdmissionRequestableDenial({
    admission: input.envelope.admission,
    reason,
    template: `generic-admission:${reason}`,
    evaluatedAt: input.receivedAt,
    expiresAt: requestableDenialExpiresAt(input),
    catalogRefs: ['authzen:access-request:requestable-denial'],
  });
}

function accessRequestTaskMatchesDenial(input: {
  readonly denial: ConsequenceAdmissionRequestableDenial;
  readonly task: ConsequenceAdmissionAccessRequestTask;
}): boolean {
  return input.task.denial.binding.digest === input.denial.binding.digest &&
    input.task.denial.binding.scopeDigest === input.denial.binding.scopeDigest &&
    input.task.version === input.denial.version &&
    input.task.status === 'pending' &&
    input.task.requester !== null &&
    input.task.result === null &&
    input.task.accessPermitted === false &&
    input.task.releaseTokenMayBeIssued === false &&
    input.task.rawPayloadStored === false &&
    input.task.denial.rawPayloadStored === false &&
    input.task.denial.releaseTokenMayBeIssued === false;
}

function tenantAccessRequestPrincipal(tenant: TenantContext): ConsequenceAdmissionAccessRequestPrincipalInput {
  return {
    principalRef: `tenant:${tenant.source}:${tenant.tenantId}`,
    source: 'tenant-context',
    role: tenant.source,
  };
}

async function currentAccessRequestPrincipal(input: {
  readonly context: Context;
  readonly deps: GenericAdmissionRouteDeps;
  readonly tenant: TenantContext;
}): Promise<ConsequenceAdmissionAccessRequestPrincipalInput> {
  return await input.deps.currentAccessRequestPrincipal?.({
    context: input.context,
    tenant: input.tenant,
  }) ?? tenantAccessRequestPrincipal(input.tenant);
}

function admissionIdempotencyKeyFor(context: Context): string | null {
  const value = context.req.header('Idempotency-Key')?.trim();
  return value ? value : null;
}

function genericAdmissionReplayResponse(input: {
  readonly statusCode: number;
  readonly responseBody: unknown;
}): Response {
  return new Response(JSON.stringify(input.responseBody), {
    status: input.statusCode,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      'x-attestor-idempotent-replay': 'true',
    },
  });
}

async function beginGenericAdmissionIdempotency(
  context: Context,
  deps: GenericAdmissionRouteDeps,
  tenant: TenantContext,
  routeId: string,
  requestPayload: unknown,
  mode: GenericAdmissionEnvelope['mode'],
): Promise<GenericAdmissionIdempotencyBegin> {
  const idempotencyKey = admissionIdempotencyKeyFor(context);
  const keyRequired =
    deps.requireAdmissionIdempotencyKeyForEnforce === true && mode === 'enforce';

  if (!idempotencyKey && keyRequired) {
    const problem = createConsequenceAdmissionProblem({
      type: 'https://attestor.dev/problems/admission-idempotency-key-required',
      title: 'Admission idempotency key required',
      status: 428,
      detail: 'Enforce-mode generic admissions require an Idempotency-Key before the route can produce an execution-facing response.',
      instance: '/api/v1/admissions',
      reasonCodes: ['admission-idempotency-key-required'],
    });
    return { kind: 'response', response: context.json(problem, 428) };
  }

  if (!idempotencyKey) {
    return { kind: 'ready', ready: null };
  }

  if (!deps.admissionIdempotencyService) {
    const problem = createConsequenceAdmissionProblem({
      type: 'https://attestor.dev/problems/admission-idempotency-unavailable',
      title: 'Admission idempotency unavailable',
      status: 503,
      detail: 'The generic admission route cannot persist idempotent admission responses in this runtime.',
      instance: '/api/v1/admissions',
      reasonCodes: ['admission-idempotency-unavailable'],
    });
    return { kind: 'response', response: context.json(problem, 503) };
  }

  const begin = await deps.admissionIdempotencyService.begin({
    idempotencyKey,
    tenantId: tenant.tenantId,
    routeId,
    requestPayload,
  });

  if (begin.kind === 'replay') {
    return {
      kind: 'response',
      response: genericAdmissionReplayResponse({
        statusCode: begin.statusCode,
        responseBody: begin.responseBody,
      }),
    };
  }

  if (begin.kind === 'conflict') {
    const problem = createConsequenceAdmissionProblem({
      type: 'https://attestor.dev/problems/admission-idempotency-conflict',
      title: 'Admission idempotency conflict',
      status: 409,
      detail: 'The Idempotency-Key was already used for a different generic admission request.',
      instance: '/api/v1/admissions',
      reasonCodes: ['admission-idempotency-conflict'],
    });
    return { kind: 'response', response: context.json(problem, 409) };
  }

  if (begin.kind === 'unavailable') {
    const problem = createConsequenceAdmissionProblem({
      type: 'https://attestor.dev/problems/admission-idempotency-unavailable',
      title: 'Admission idempotency unavailable',
      status: 503,
      detail: 'The generic admission route cannot persist idempotent admission responses in this runtime.',
      instance: '/api/v1/admissions',
      reasonCodes: ['admission-idempotency-unavailable'],
    });
    return { kind: 'response', response: context.json(problem, 503) };
  }

  return { kind: 'ready', ready: begin };
}

async function finalizeGenericAdmissionIdempotency(
  deps: GenericAdmissionRouteDeps,
  tenant: TenantContext,
  routeId: string,
  requestPayload: unknown,
  idempotency: PipelineIdempotencyReadyResult | null,
  statusCode: number,
  responseBody: GenericAdmissionRouteResponseEnvelope,
): Promise<GenericAdmissionRouteResponseEnvelope> {
  if (!idempotency?.idempotencyKey || !deps.admissionIdempotencyService) {
    return responseBody;
  }
  const finalized = await deps.admissionIdempotencyService.finalize({
    idempotencyKey: idempotency.idempotencyKey,
    tenantId: tenant.tenantId,
    routeId,
    requestPayload,
    statusCode,
    responseBody: responseBody as unknown as Record<string, unknown>,
  });
  return finalized as unknown as GenericAdmissionRouteResponseEnvelope;
}

function nestedTenantId(value: unknown): string | null {
  if (!isRecord(value) || typeof value.tenantId !== 'string') return null;
  const normalized = value.tenantId.trim();
  return normalized.length > 0 ? normalized : null;
}

function assertNestedScopeTenantMatches(
  payload: Readonly<Record<string, unknown>>,
  fieldName: 'requestedScope' | 'approvedScope',
  tenant: TenantContext,
): void {
  const requestedTenantId = nestedTenantId(payload[fieldName]);
  if (requestedTenantId && requestedTenantId !== tenant.tenantId) {
    throw new GenericAdmissionTenantScopeMismatchError(`${fieldName}.tenantId`);
  }
}

function admissionPayloadWithTenant(payload: unknown, tenant: TenantContext): unknown {
  if (!isRecord(payload)) return payload;
  if (typeof payload.tenantId === 'string') {
    const requestedTenantId = payload.tenantId.trim();
    if (requestedTenantId && requestedTenantId !== tenant.tenantId) {
      throw new GenericAdmissionTenantScopeMismatchError();
    }
  }
  assertNestedScopeTenantMatches(payload, 'requestedScope', tenant);
  assertNestedScopeTenantMatches(payload, 'approvedScope', tenant);
  return {
    ...payload,
    tenantId: tenant.tenantId,
    environment:
      typeof payload.environment === 'string' ? payload.environment : tenant.source,
  };
}

class GenericAdmissionTenantScopeMismatchError extends Error {
  constructor(fieldName = 'tenantId') {
    super(fieldName === 'tenantId'
      ? 'Admission tenantId must match the authenticated tenant context.'
      : `Admission ${fieldName} must match the authenticated tenant context.`);
    this.name = 'GenericAdmissionTenantScopeMismatchError';
  }
}

export function registerGenericAdmissionRoutes(
  app: Hono,
  deps: GenericAdmissionRouteDeps,
): void {
  registerGenericAdmissionAccessRequestRoutes(app, deps);

  app.post('/api/v1/admissions', async (c) => {
    c.header('cache-control', 'no-store');

    let payload: unknown;
    if (!acceptsJsonRequestBody(c)) {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/admission-json-required',
        title: 'Admission JSON required',
        status: 415,
        detail: 'The generic admission route requires Content-Type: application/json.',
        instance: '/api/v1/admissions',
        reasonCodes: ['json-required'],
      });
      return c.json(problem, 415);
    }
    try {
      payload = await c.req.json<unknown>();
    } catch {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/admission-json-invalid',
        title: 'Invalid admission JSON',
        status: 400,
        detail: 'The generic admission route requires a valid JSON object.',
        instance: '/api/v1/admissions',
        reasonCodes: ['invalid-json'],
      });
      return c.json(problem, 400);
    }

    try {
      const tenant = deps.currentTenant(c);
      const routeId = 'POST /api/v1/admissions';
      const receivedAt = deps.now?.() ?? new Date().toISOString();
      let tenantBoundPayload: unknown;
      let envelope: GenericAdmissionEnvelope;
      try {
        tenantBoundPayload = admissionPayloadWithTenant(payload, tenant);
        envelope = createGenericAdmissionEnvelope(tenantBoundPayload, {
          evaluatedAt: receivedAt,
        });
      } catch (error) {
        if (error instanceof GenericAdmissionTenantScopeMismatchError) {
          const problem = createConsequenceAdmissionProblem({
            type: 'https://attestor.dev/problems/admission-tenant-scope-mismatch',
            title: 'Admission tenant scope mismatch',
            status: 403,
            detail: error.message,
            instance: '/api/v1/admissions',
            reasonCodes: ['tenant-scope-mismatch'],
          });
          return c.json(problem, 403);
        }
        throw error;
      }
      const workflowId = workflowIdFromAdmissionPayload(payload);
      const modePolicy = resolvePlanGenericAdmissionMode(tenant.planId, envelope.mode);
      if (!modePolicy.allowed && !workflowId) {
        const problem = createConsequenceAdmissionProblem({
          type: 'https://attestor.dev/problems/admission-plan-mode-restricted',
          title: 'Admission mode not available on plan',
          status: 403,
          detail: `Plan ${modePolicy.planId} only allows ${modePolicy.allowedModes.join(', ')} admission modes; requested ${modePolicy.mode}.`,
          instance: '/api/v1/admissions',
          reasonCodes: modePolicy.reasonCodes,
        });
        return c.json(problem, 403);
      }
      const idempotency = await beginGenericAdmissionIdempotency(
        c,
        deps,
        tenant,
        routeId,
        tenantBoundPayload,
        envelope.mode,
      );
      if (idempotency.kind === 'response') {
        return idempotency.response;
      }
      let workflowEntitlement: WorkflowEntitlementRecord | null = null;
      let workflowAccess: WorkflowEntitlementAccessDecision | null = null;
      if (workflowId) {
        if (!deps.resolveWorkflowEntitlement) {
          const problem = createConsequenceAdmissionProblem({
            type: 'https://attestor.dev/problems/workflow-entitlement-resolver-unavailable',
            title: 'Workflow entitlement resolver unavailable',
            status: 503,
            detail: 'The workflow entitlement resolver is not configured for workflow-bound admissions.',
            instance: '/api/v1/admissions',
            reasonCodes: ['workflow-entitlement-resolver-unavailable'],
          });
          return c.json(problem, 503);
        }
        workflowEntitlement = await deps.resolveWorkflowEntitlement({
          tenant,
          workflowId,
        });
        workflowAccess = evaluateWorkflowEntitlementAccess({
          workflowId,
          entitlement: workflowEntitlement,
          requestedMode: envelope.mode,
          requestedCapability: workflowRequestedCapability(payload),
          requestedConsequencePack: workflowRequestedPack(payload),
          customerGateProofPresent: workflowCustomerGateProofPresent(payload),
          pastDueGraceActive: true,
        });
        if (!workflowAccess.allowed) {
          const problem = createConsequenceAdmissionProblem({
            type: 'https://attestor.dev/problems/workflow-entitlement-restricted',
            title: 'Workflow entitlement restricted',
            status: 403,
            detail: 'The workflow entitlement does not allow this admission mode, capability, pack, status, or customer-gate posture.',
            instance: '/api/v1/admissions',
            reasonCodes: workflowAccess.reasonCodes,
          });
          return c.json(problem, 403);
        }
      }
      let loopGuard: ConsequenceAdmissionAgentLoopAbuseGuardDecision | undefined;
      try {
        loopGuard = await deps.evaluateAgentLoopAbuse?.({
          tenant,
          envelope,
          receivedAt,
        });
      } catch {
        const problem = createConsequenceAdmissionProblem({
          type: 'https://attestor.dev/problems/agent-loop-abuse-guard-unavailable',
          title: 'Agent loop abuse guard unavailable',
          status: 503,
          detail: 'The agent loop abuse guard could not evaluate the admission.',
          instance: '/api/v1/admissions',
          reasonCodes: ['agent-loop-abuse-guard-unavailable'],
        });
        return c.json(problem, 503);
      }
      if (loopGuard && !loopGuard.allowed) {
        if (loopGuard.retryAfterSeconds > 0) {
          c.header('retry-after', String(loopGuard.retryAfterSeconds));
        }
        const status = loopGuard.outcome === 'throttle' ? 429 : 409;
        const problem = createConsequenceAdmissionProblem({
          type: 'https://attestor.dev/problems/agent-loop-abuse-guard',
          title: 'Agent loop held',
          status,
          detail: loopGuard.reason,
          instance: '/api/v1/admissions',
          reasonCodes: [
            'agent-loop-abuse-guard',
            ...loopGuard.reasonCodes,
          ],
        });
        return c.json(problem, status);
      }
      const accessRequestResolution = await resolveAccessRequestReevaluation({
        context: c,
        deps,
        tenant,
        payload,
        envelope,
        reevaluateAt: receivedAt,
      });
      if (accessRequestResolution.kind === 'response') {
        return accessRequestResolution.response;
      }
      const accessRequestReevaluation = accessRequestResolution.kind === 'ready'
        ? accessRequestResolution.reevaluation
        : null;
      if (typeof deps.recordShadowAdmission !== 'function') {
        const problem = createConsequenceAdmissionProblem({
          type: 'https://attestor.dev/problems/shadow-recording-unavailable',
          title: 'Shadow recording unavailable',
          status: 503,
          detail: 'The shadow admission event recorder is not configured.',
          instance: '/api/v1/admissions',
          reasonCodes: ['shadow-recording-unavailable'],
        });
        return c.json(problem, 503);
      }
      const protectedReleaseTokenRequirement =
        evaluateGenericAdmissionProtectedReleaseTokenRequirement({ envelope });
      let envelopeForShadow: GenericAdmissionEnvelope = envelope;
      let responseEnvelope: GenericAdmissionRouteResponseEnvelope = accessRequestReevaluation
        ? {
            ...envelope,
            accessRequestReevaluation,
          }
        : envelope;
      if (protectedReleaseTokenRequirement.required && deps.issueProtectedReleaseToken) {
        try {
          const senderConfirmation =
            await deps.resolveProtectedReleaseTokenConfirmation?.({
              context: c,
              tenant,
              envelope,
              receivedAt,
            }) ?? null;
          const issued = await deps.issueProtectedReleaseToken({
            context: c,
            tenant,
            envelope,
            receivedAt,
            senderConfirmation,
          });
          envelopeForShadow = issued.envelope;
          responseEnvelope = {
            ...issued.envelope,
            protectedReleaseTokenAuthorization: issued.authorization,
            ...(accessRequestReevaluation ? { accessRequestReevaluation } : {}),
          };
        } catch (error) {
          const reasonCodes = error instanceof GenericAdmissionProtectedReleaseTokenIssuanceError
            ? [
                'protected-release-token-issuance-unavailable',
                ...error.reasonCodes,
              ]
            : ['protected-release-token-issuance-unavailable'];
          const problem = createConsequenceAdmissionProblem({
            type: 'https://attestor.dev/problems/protected-release-token-issuance-unavailable',
            title: 'Protected release-token issuance unavailable',
            status: 503,
            detail: 'The protected release-token issuer could not issue a token.',
            instance: '/api/v1/admissions',
            reasonCodes,
          });
          return c.json(problem, 503);
        }
      } else if (
        protectedReleaseTokenRequirement.required &&
        deps.requireProtectedReleaseTokenForHighRisk
      ) {
        const problem = createConsequenceAdmissionProblem({
          type: 'https://attestor.dev/problems/protected-release-token-issuer-missing',
          title: 'Protected release-token issuer missing',
          status: 503,
          detail:
            'This admission requires a protected sender-constrained release token, but no issuer was configured for the generic admission route.',
          instance: '/api/v1/admissions',
          reasonCodes: [
            'protected-release-token-required',
            'protected-release-token-issuer-missing',
          ],
        });
        return c.json(problem, 503);
      }
      const requestableDenial = createRouteRequestableDenial({
        envelope: responseEnvelope,
        receivedAt,
      });
      if (requestableDenial) {
        let accessRequestTask: ConsequenceAdmissionAccessRequestTask | undefined;
        if (deps.createAccessRequestTask) {
          try {
            const requester = await currentAccessRequestPrincipal({
              context: c,
              deps,
              tenant,
            });
            accessRequestTask = await deps.createAccessRequestTask({
              context: c,
              tenant,
              envelope: responseEnvelope,
              denial: requestableDenial,
              receivedAt,
              requester,
            });
          } catch {
            const problem = createConsequenceAdmissionProblem({
              type: 'https://attestor.dev/problems/access-request-task-unavailable',
              title: 'Access request task unavailable',
              status: 503,
              detail: 'The access request task dependency could not create a requestable-denial task.',
              instance: '/api/v1/admissions',
              reasonCodes: ['access-request-task-unavailable'],
            });
            return c.json(problem, 503);
          }
          if (!accessRequestTaskMatchesDenial({ denial: requestableDenial, task: accessRequestTask })) {
            const problem = createConsequenceAdmissionProblem({
              type: 'https://attestor.dev/problems/access-request-task-invalid',
              title: 'Access request task invalid',
              status: 503,
              detail: 'The access request task dependency returned a task that does not match the requestable denial.',
              instance: '/api/v1/admissions',
              reasonCodes: ['access-request-task-invalid'],
            });
            return c.json(problem, 503);
          }
        }
        responseEnvelope = {
          ...responseEnvelope,
          requestableDenial,
          ...(accessRequestTask ? { accessRequestTask } : {}),
        };
      }
      let workflowConsumption: WorkflowAdmissionConsumptionResult | null = null;
      if (workflowId && workflowAccess && workflowEntitlement) {
        if (!deps.consumeWorkflowAdmission) {
          const problem = createConsequenceAdmissionProblem({
            type: 'https://attestor.dev/problems/workflow-usage-consumer-unavailable',
            title: 'Workflow usage consumer unavailable',
            status: 503,
            detail: 'The workflow usage consumer is not configured for workflow-bound admissions.',
            instance: '/api/v1/admissions',
            reasonCodes: ['workflow-usage-consumer-unavailable'],
          });
          return c.json(problem, 503);
        }
        workflowConsumption = await deps.consumeWorkflowAdmission({
          tenant,
          workflowId,
          entitlement: workflowEntitlement,
        });
        if (!workflowConsumption.decision?.allowed) {
          const problem = createConsequenceAdmissionProblem({
            type: 'https://attestor.dev/problems/workflow-admission-quota-exhausted',
            title: 'Workflow admission quota exhausted',
            status: 429,
            detail: 'The workflow has exhausted its included admission quota and its tier does not allow soft overage.',
            instance: '/api/v1/admissions',
            reasonCodes: ['workflow-admission-quota-exhausted'],
          });
          return c.json(problem, 429);
        }
        responseEnvelope = {
          ...responseEnvelope,
          workflowEntitlementAccess: workflowAccess,
          workflowUsage: workflowConsumption.decision.usage,
          workflowBillingMetering: workflowConsumption.billingMetering,
        };
      }
      try {
        deps.recordShadowAdmission({ tenant, envelope: envelopeForShadow });
      } catch {
        const problem = createConsequenceAdmissionProblem({
          type: 'https://attestor.dev/problems/shadow-recording-unavailable',
          title: 'Shadow recording unavailable',
          status: 503,
          detail: 'The shadow admission event could not be recorded.',
          instance: '/api/v1/admissions',
          reasonCodes: ['shadow-recording-unavailable'],
        });
        return c.json(problem, 503);
      }
      const finalized = await finalizeGenericAdmissionIdempotency(
        deps,
        tenant,
        routeId,
        tenantBoundPayload,
        idempotency.ready,
        200,
        responseEnvelope,
      );
      return c.json(finalized);
    } catch {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/admission-input-invalid',
        title: 'Invalid admission input',
        status: 400,
        detail: 'The generic admission request could not be evaluated.',
        instance: '/api/v1/admissions',
        reasonCodes: ['invalid-admission-input'],
      });
      return c.json(problem, 400);
    }
  });
}
