import type { Context, Hono } from 'hono';
import {
  CONSEQUENCE_ADMISSION_ACCESS_REQUEST_TASK_STATUSES,
  completeConsequenceAdmissionAccessRequestTask,
  createConsequenceAdmissionAccessRequestReevaluationContext,
  createConsequenceAdmissionProblem,
  scopeDigestForConsequenceAdmissionResponse,
  type CompleteConsequenceAdmissionAccessRequestTaskInput,
  type ConsequenceAdmissionAccessRequestReevaluationContext,
  type ConsequenceAdmissionAccessRequestTask,
  type GenericAdmissionEnvelope,
} from '../../../consequence-admission/index.js';
import type { TenantContext } from '../../tenant-isolation.js';
import { acceptsJsonRequestBody } from '../route-response-helpers.js';
import type { GenericAdmissionRouteDeps } from './generic-admission-route-types.js';

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

function parseAccessRequestLimit(value: string | undefined): number {
  if (!value) return 100;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(Math.trunc(parsed), 500);
}

function accessRequestTaskUnavailableProblem() {
  return createConsequenceAdmissionProblem({
    type: 'https://attestor.dev/problems/access-request-task-store-unavailable',
    title: 'Access request task store unavailable',
    status: 503,
    detail: 'The access request task store is not configured for this runtime.',
    instance: '/api/v1/admissions/access-requests',
    reasonCodes: ['access-request-task-store-unavailable'],
  });
}

function invalidAccessRequestProblem(input: {
  readonly title: string;
  readonly detail: string;
  readonly status?: 400 | 403 | 404 | 503;
  readonly reasonCodes: readonly string[];
}) {
  const status = input.status ?? 403;
  return createConsequenceAdmissionProblem({
    type: 'https://attestor.dev/problems/access-request-context-invalid',
    title: input.title,
    status,
    detail: input.detail,
    instance: '/api/v1/admissions',
    reasonCodes: input.reasonCodes,
  });
}

function accessRequestContextFromPayload(payload: unknown): {
  readonly taskId: string;
  readonly bindingDigest: string | null;
  readonly approvalRefDigest: string | null;
} | null {
  const record = isRecord(payload) ? payload : null;
  const nested = record ? nestedRecordField(record, 'accessRequest') : null;
  const taskId =
    optionalStringField(nested, ['taskId', 'id']) ??
    optionalStringField(record, ['accessRequestTaskId']);
  if (!taskId) return null;
  return {
    taskId,
    bindingDigest:
      optionalStringField(nested, ['bindingDigest']) ??
      optionalStringField(record, ['accessRequestBindingDigest']),
    approvalRefDigest:
      optionalStringField(nested, ['approvalRefDigest']) ??
      optionalStringField(record, ['accessRequestApprovalRefDigest']),
  };
}

function statusFromPayload(
  payload: unknown,
): CompleteConsequenceAdmissionAccessRequestTaskInput['status'] | null {
  const status = optionalStringField(payload, ['status', 'decision']);
  if (!status || status === 'pending') return null;
  return CONSEQUENCE_ADMISSION_ACCESS_REQUEST_TASK_STATUSES.includes(
    status as CompleteConsequenceAdmissionAccessRequestTaskInput['status'],
  )
    ? status as CompleteConsequenceAdmissionAccessRequestTaskInput['status']
    : null;
}

function approvalFromPayload(
  payload: unknown,
): CompleteConsequenceAdmissionAccessRequestTaskInput['approval'] {
  const approval = nestedRecordField(payload, 'approval');
  if (!approval) return null;
  const id = optionalStringField(approval, ['id', 'approvalId']);
  const approvedUntil = optionalStringField(approval, ['approvedUntil', 'expiresAt']);
  const authorityKind = optionalStringField(approval, ['authorityKind']);
  if (!id || !approvedUntil || !authorityKind) return null;
  return {
    id,
    approvedAt: optionalStringField(approval, ['approvedAt', 'issuedAt']),
    approvedUntil,
    authorityKind: authorityKind as NonNullable<
      CompleteConsequenceAdmissionAccessRequestTaskInput['approval']
    >['authorityKind'],
    approvalRef: optionalStringField(approval, ['approvalRef', 'ref']),
    scopeDigest: optionalStringField(approval, ['scopeDigest']),
    approvalState: optionalStringField(approval, ['approvalState', 'stateDigest', 'state']),
  };
}

export async function resolveAccessRequestReevaluation(input: {
  readonly context: Context;
  readonly deps: GenericAdmissionRouteDeps;
  readonly tenant: TenantContext;
  readonly payload: unknown;
  readonly envelope: GenericAdmissionEnvelope;
  readonly reevaluateAt: string;
}): Promise<
  | { readonly kind: 'none' }
  | {
      readonly kind: 'ready';
      readonly task: ConsequenceAdmissionAccessRequestTask;
      readonly reevaluation: ConsequenceAdmissionAccessRequestReevaluationContext;
    }
  | { readonly kind: 'response'; readonly response: Response }
> {
  const accessRequest = accessRequestContextFromPayload(input.payload);
  if (!accessRequest) return { kind: 'none' };
  if (!input.deps.getAccessRequestTask) {
    return {
      kind: 'response',
      response: input.context.json(accessRequestTaskUnavailableProblem(), 503),
    };
  }
  const task = await input.deps.getAccessRequestTask({
    context: input.context,
    tenant: input.tenant,
    taskId: accessRequest.taskId,
  });
  if (!task) {
    return {
      kind: 'response',
      response: input.context.json(invalidAccessRequestProblem({
        title: 'Access request task not found',
        detail: 'The approved access request task was not found for this tenant.',
        status: 404,
        reasonCodes: ['access-request-task-not-found'],
      }), 404),
    };
  }
  if (accessRequest.bindingDigest && accessRequest.bindingDigest !== task.denial.binding.digest) {
    return {
      kind: 'response',
      response: input.context.json(invalidAccessRequestProblem({
        title: 'Access request binding mismatch',
        detail: 'The access request binding digest does not match the stored task.',
        reasonCodes: ['access-request-binding-mismatch'],
      }), 403),
    };
  }
  if (task.status !== 'approved' || !task.result) {
    return {
      kind: 'response',
      response: input.context.json(invalidAccessRequestProblem({
        title: 'Access request is not approved',
        detail: 'The access request task must be approved before it can support fresh admission re-evaluation.',
        reasonCodes: ['access-request-not-approved'],
      }), 403),
    };
  }
  if (
    accessRequest.approvalRefDigest &&
    accessRequest.approvalRefDigest !== task.result.approval.approvalRefDigest
  ) {
    return {
      kind: 'response',
      response: input.context.json(invalidAccessRequestProblem({
        title: 'Access request approval mismatch',
        detail: 'The approval digest does not match the stored access request task.',
        reasonCodes: ['access-request-approval-mismatch'],
      }), 403),
    };
  }
  if (scopeDigestForConsequenceAdmissionResponse(input.envelope.admission) !== task.denial.binding.scopeDigest) {
    return {
      kind: 'response',
      response: input.context.json(invalidAccessRequestProblem({
        title: 'Access request scope mismatch',
        detail: 'The fresh admission scope does not match the approved access request task.',
        reasonCodes: ['access-request-scope-mismatch'],
      }), 403),
    };
  }
  try {
    return {
      kind: 'ready',
      task,
      reevaluation: createConsequenceAdmissionAccessRequestReevaluationContext({
        task,
        reevaluateAt: input.reevaluateAt,
        reevaluatedAdmission: input.envelope.admission,
      }),
    };
  } catch {
    return {
      kind: 'response',
      response: input.context.json(invalidAccessRequestProblem({
        title: 'Access request re-evaluation invalid',
        detail: 'The access request approval is expired or no longer valid for this admission.',
        reasonCodes: ['access-request-reevaluation-invalid'],
      }), 403),
    };
  }
}

export function registerGenericAdmissionAccessRequestRoutes(
  app: Hono,
  deps: GenericAdmissionRouteDeps,
): void {
  app.get('/api/v1/admissions/access-requests', async (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listAccessRequestTasks) {
      return c.json(accessRequestTaskUnavailableProblem(), 503);
    }
    const tenant = deps.currentTenant(c);
    const limit = parseAccessRequestLimit(c.req.query('limit'));
    const tasks = await deps.listAccessRequestTasks({
      context: c,
      tenant,
      limit,
    });
    return c.json({
      version: 'attestor.generic-admission-access-request-list.v1',
      tenantId: tenant.tenantId,
      count: tasks.length,
      limit,
      tasks,
      rawPayloadStored: false,
      productionReady: false,
    });
  });

  app.post('/api/v1/admissions/access-requests/:id/decision', async (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.completeAccessRequestTask) {
      return c.json(accessRequestTaskUnavailableProblem(), 503);
    }
    if (!deps.getAccessRequestTask) {
      return c.json(accessRequestTaskUnavailableProblem(), 503);
    }
    if (!acceptsJsonRequestBody(c)) {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/access-request-decision-json-required',
        title: 'Access request decision JSON required',
        status: 415,
        detail: 'The access request decision route requires Content-Type: application/json.',
        instance: '/api/v1/admissions/access-requests',
        reasonCodes: ['json-required'],
      });
      return c.json(problem, 415);
    }
    let payload: unknown;
    try {
      payload = await c.req.json<unknown>();
    } catch {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/access-request-decision-json-invalid',
        title: 'Invalid access request decision JSON',
        status: 400,
        detail: 'The access request decision route requires a valid JSON object.',
        instance: '/api/v1/admissions/access-requests',
        reasonCodes: ['invalid-json'],
      });
      return c.json(problem, 400);
    }
    const status = statusFromPayload(payload);
    if (!status) {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/access-request-decision-status-invalid',
        title: 'Access request decision status invalid',
        status: 400,
        detail: 'The access request decision status must be approved, denied, expired, or canceled.',
        instance: '/api/v1/admissions/access-requests',
        reasonCodes: ['access-request-decision-status-invalid'],
      });
      return c.json(problem, 400);
    }
    const approval = approvalFromPayload(payload);
    if (status === 'approved' && !approval) {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/access-request-approval-required',
        title: 'Access request approval required',
        status: 400,
        detail: 'Approved access request decisions require approval id, approvedUntil, and authorityKind.',
        instance: '/api/v1/admissions/access-requests',
        reasonCodes: ['access-request-approval-required'],
      });
      return c.json(problem, 400);
    }
    const tenant = deps.currentTenant(c);
    const taskId = c.req.param('id');
    const decidedAt = new Date().toISOString();
    const currentTask = await deps.getAccessRequestTask({
      context: c,
      tenant,
      taskId,
    });
    if (!currentTask) {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/access-request-task-not-found',
        title: 'Access request task not found',
        status: 404,
        detail: 'The access request task was not found for this tenant.',
        instance: '/api/v1/admissions/access-requests',
        reasonCodes: ['access-request-task-not-found'],
      });
      return c.json(problem, 404);
    }
    let previewTask: ConsequenceAdmissionAccessRequestTask;
    try {
      previewTask = completeConsequenceAdmissionAccessRequestTask({
        task: currentTask,
        status,
        decidedAt,
        approval,
      });
      if (previewTask.status === 'approved') {
        createConsequenceAdmissionAccessRequestReevaluationContext({
          task: previewTask,
          reevaluateAt: decidedAt,
        });
      }
    } catch {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/access-request-decision-invalid',
        title: 'Access request decision invalid',
        status: 400,
        detail: 'The access request decision failed lifecycle, authority, freshness, or scope validation.',
        instance: '/api/v1/admissions/access-requests',
        reasonCodes: ['access-request-decision-invalid'],
      });
      return c.json(problem, 400);
    }
    let task: ConsequenceAdmissionAccessRequestTask | null;
    try {
      task = await deps.completeAccessRequestTask({
        context: c,
        tenant,
        taskId,
        status,
        decidedAt,
        approval,
      });
    } catch {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/access-request-decision-invalid',
        title: 'Access request decision invalid',
        status: 400,
        detail: 'The access request decision failed lifecycle, authority, freshness, or scope validation.',
        instance: '/api/v1/admissions/access-requests',
        reasonCodes: ['access-request-decision-invalid'],
      });
      return c.json(problem, 400);
    }
    if (!task) {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/access-request-task-not-found',
        title: 'Access request task not found',
        status: 404,
        detail: 'The access request task was not found for this tenant.',
        instance: '/api/v1/admissions/access-requests',
        reasonCodes: ['access-request-task-not-found'],
      });
      return c.json(problem, 404);
    }
    let reevaluation: ConsequenceAdmissionAccessRequestReevaluationContext | null = null;
    try {
      reevaluation = task.status === 'approved'
        ? createConsequenceAdmissionAccessRequestReevaluationContext({
            task,
            reevaluateAt: decidedAt,
          })
        : null;
    } catch {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/access-request-decision-invalid',
        title: 'Access request decision invalid',
        status: 400,
        detail: 'The persisted access request decision failed fresh re-evaluation context validation.',
        instance: '/api/v1/admissions/access-requests',
        reasonCodes: ['access-request-decision-invalid'],
      });
      return c.json(problem, 400);
    }
    return c.json({
      version: 'attestor.generic-admission-access-request-decision.v1',
      tenantId: tenant.tenantId,
      task,
      reevaluation,
      accessPermitted: false,
      releaseTokenMayBeIssued: false,
      rawPayloadStored: false,
      productionReady: false,
    });
  });

  app.get('/api/v1/admissions/access-requests/:id', async (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.getAccessRequestTask) {
      return c.json(accessRequestTaskUnavailableProblem(), 503);
    }
    const tenant = deps.currentTenant(c);
    const task = await deps.getAccessRequestTask({
      context: c,
      tenant,
      taskId: c.req.param('id'),
    });
    if (!task) {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/access-request-task-not-found',
        title: 'Access request task not found',
        status: 404,
        detail: 'The access request task was not found for this tenant.',
        instance: '/api/v1/admissions/access-requests',
        reasonCodes: ['access-request-task-not-found'],
      });
      return c.json(problem, 404);
    }
    return c.json({
      version: 'attestor.generic-admission-access-request-status.v1',
      tenantId: tenant.tenantId,
      task,
      rawPayloadStored: false,
      productionReady: false,
    });
  });
}
