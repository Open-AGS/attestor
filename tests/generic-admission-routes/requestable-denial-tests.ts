import {
  Hono,
  createApp,
  digest,
  equal,
  ok,
  registerGenericAdmissionRoutes,
  validAdmissionPayload,
} from './helpers.js';
import {
  completeConsequenceAdmissionAccessRequestTask,
  createConsequenceAdmissionAccessRequestTask,
  type ConsequenceAdmissionAccessRequestTask,
} from '../../src/consequence-admission/index.js';

function tenantFixture() {
  return {
    tenantId: 'tenant_route',
    tenantName: 'Route Tenant',
    authenticatedAt: '2026-05-01T18:00:00.000Z',
    source: 'api_key',
    planId: 'custom-route-test-plan',
    monthlyRunQuota: 100,
  } as const;
}

type GenericAdmissionRouteDeps = Parameters<typeof registerGenericAdmissionRoutes>[1];

function offsetIso(timestamp: string, deltaMs: number): string {
  return new Date(new Date(timestamp).getTime() + deltaMs).toISOString();
}

function createAccessRequestRouteDeps(
  overrides: Partial<GenericAdmissionRouteDeps> = {},
): GenericAdmissionRouteDeps & {
  readonly taskCount: () => number;
} {
  const tasks = new Map<string, ConsequenceAdmissionAccessRequestTask>();
  let counter = 0;
  const taskKey = (tenantId: string, taskId: string) => `${tenantId}\u0000${taskId}`;
  return {
    currentTenant: () => tenantFixture(),
    recordShadowAdmission: () => {},
    createAccessRequestTask: ({ tenant, denial, receivedAt }) => {
      counter += 1;
      const task = createConsequenceAdmissionAccessRequestTask({
        denial,
        taskId: `arq_route_${counter}`,
        createdAt: receivedAt,
        statusEndpoint: `https://attestor.test/access-requests/arq_route_${counter}`,
      });
      tasks.set(taskKey(tenant.tenantId, task.id), task);
      return task;
    },
    completeAccessRequestTask: ({ tenant, taskId, status, decidedAt, approval }) => {
      const key = taskKey(tenant.tenantId, taskId);
      const current = tasks.get(key);
      if (!current) return null;
      const completed = completeConsequenceAdmissionAccessRequestTask({
        task: current,
        status,
        decidedAt,
        approval,
      });
      tasks.set(key, completed);
      return completed;
    },
    getAccessRequestTask: ({ tenant, taskId }) =>
      tasks.get(taskKey(tenant.tenantId, taskId)) ?? null,
    listAccessRequestTasks: ({ tenant, limit }) =>
      [...tasks.entries()]
        .filter(([key]) => key.startsWith(`${tenant.tenantId}\u0000`))
        .map(([, task]) => task)
        .slice(0, limit),
    taskCount: () => tasks.size,
    ...overrides,
  };
}

async function testDefaultRouteReportsRequestableDenialWithoutTaskDependency(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({ approvals: undefined })),
  });
  const body = await response.json() as {
    requestableDenial?: {
      approvalDoesNotPermitAccess: boolean;
      releaseTokenMayBeIssued: boolean;
      requiresReevaluation: boolean;
    };
    accessRequestTask?: unknown;
    admission: {
      allowed: boolean;
      failClosed: boolean;
    };
  };

  equal(response.status, 200, 'Generic admission route: default route returns denied admission response');
  equal(body.admission.allowed, false, 'Generic admission route: default requestable denial is not allowed');
  equal(body.admission.failClosed, true, 'Generic admission route: default requestable denial stays fail-closed');
  equal(
    body.requestableDenial?.approvalDoesNotPermitAccess,
    true,
    'Generic admission route: default route marks approval as non-granting',
  );
  equal(
    body.requestableDenial?.releaseTokenMayBeIssued,
    false,
    'Generic admission route: default route forbids token issuance from denial',
  );
  equal(
    body.requestableDenial?.requiresReevaluation,
    true,
    'Generic admission route: default route requires fresh re-evaluation',
  );
  equal(
    body.accessRequestTask,
    undefined,
    'Generic admission route: default route does not invent an unstored access request task',
  );
}

async function testMissingApprovalProducesRequestableDenialWithoutToken(): Promise<void> {
  const app = new Hono();
  let tokenIssuerCalls = 0;
  let taskCreateCalls = 0;
  let shadowRecords = 0;
  const taskStore = new Map<string, ConsequenceAdmissionAccessRequestTask>();
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => tenantFixture(),
    issueProtectedReleaseToken: () => {
      tokenIssuerCalls += 1;
      throw new Error('release token issuer must not run for denied admissions');
    },
    createAccessRequestTask: ({ denial, receivedAt }) => {
      taskCreateCalls += 1;
      const task = createConsequenceAdmissionAccessRequestTask({
        denial,
        taskId: 'arq_route_missing_approval',
        createdAt: receivedAt,
        statusEndpoint: 'https://attestor.test/access-requests/arq_route_missing_approval',
      });
      taskStore.set(task.id, task);
      return task;
    },
    getAccessRequestTask: ({ taskId }) => taskStore.get(taskId) ?? null,
    listAccessRequestTasks: () => [...taskStore.values()],
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({ approvals: undefined })),
  });
  const body = await response.json() as {
    protectedReleaseTokenAuthorization?: unknown;
    admission: {
      allowed: boolean;
      failClosed: boolean;
      reasonCodes: readonly string[];
      proof: readonly { kind: string }[];
    };
    requestableDenial?: {
      approvalDoesNotPermitAccess: boolean;
      releaseTokenMayBeIssued: boolean;
      requiresReevaluation: boolean;
      rawPayloadStored: boolean;
      binding: {
        digest: string;
        originalAdmissionDigest: string;
      };
    };
    accessRequestTask?: {
      id: string;
      status: string;
      accessPermitted: boolean;
      releaseTokenMayBeIssued: boolean;
      result: unknown;
      denial: {
        binding: {
          digest: string;
        };
      };
    };
  };
  const serializedDenial = JSON.stringify(body.requestableDenial);
  const listResponse = await app.request('/api/v1/admissions/access-requests');
  const listBody = await listResponse.json() as {
    count: number;
    tasks: readonly { id: string; accessPermitted: boolean }[];
    rawPayloadStored: boolean;
    productionReady: boolean;
  };
  const statusResponse = await app.request(
    `/api/v1/admissions/access-requests/${body.accessRequestTask?.id ?? 'missing'}`,
  );
  const statusBody = await statusResponse.json() as {
    task: { id: string; releaseTokenMayBeIssued: boolean };
    rawPayloadStored: boolean;
    productionReady: boolean;
  };

  equal(response.status, 200, 'Generic admission route: missing approval still returns a denied admission response');
  equal(body.admission.allowed, false, 'Generic admission route: requestable denial is not allowed');
  equal(body.admission.failClosed, true, 'Generic admission route: requestable denial stays fail-closed');
  ok(
    body.admission.reasonCodes.includes('approval-missing'),
    'Generic admission route: missing approval reason is preserved',
  );
  equal(
    body.protectedReleaseTokenAuthorization,
    undefined,
    'Generic admission route: denied admission does not receive token authorization',
  );
  equal(tokenIssuerCalls, 0, 'Generic admission route: protected token issuer is not called for denial');
  equal(taskCreateCalls, 1, 'Generic admission route: requestable denial creates one task when dependency is configured');
  equal(shadowRecords, 1, 'Generic admission route: denied admission remains shadow-recorded after task creation');
  equal(
    body.requestableDenial?.approvalDoesNotPermitAccess,
    true,
    'Generic admission route: requestable denial says approval is not access',
  );
  equal(
    body.requestableDenial?.releaseTokenMayBeIssued,
    false,
    'Generic admission route: requestable denial cannot issue release token',
  );
  equal(
    body.requestableDenial?.requiresReevaluation,
    true,
    'Generic admission route: requestable denial requires re-evaluation',
  );
  equal(
    body.requestableDenial?.rawPayloadStored,
    false,
    'Generic admission route: requestable denial stores no raw payload',
  );
  equal(
    body.accessRequestTask?.status,
    'pending',
    'Generic admission route: access request task starts pending',
  );
  equal(
    body.accessRequestTask?.accessPermitted,
    false,
    'Generic admission route: access request task does not permit access',
  );
  equal(
    body.accessRequestTask?.releaseTokenMayBeIssued,
    false,
    'Generic admission route: access request task cannot issue release token',
  );
  equal(
    body.accessRequestTask?.result,
    null,
    'Generic admission route: pending access request task has no approval result',
  );
  equal(
    body.accessRequestTask?.denial.binding.digest,
    body.requestableDenial?.binding.digest,
    'Generic admission route: access request task is bound to the requestable denial',
  );
  equal(listResponse.status, 200, 'Generic admission route: access request list returns 200');
  equal(listBody.count, 1, 'Generic admission route: access request list returns the stored task');
  equal(listBody.rawPayloadStored, false, 'Generic admission route: access request list stores no raw payload');
  equal(listBody.productionReady, false, 'Generic admission route: access request list is not production proof');
  equal(
    listBody.tasks[0]?.accessPermitted,
    false,
    'Generic admission route: listed access request task does not permit access',
  );
  equal(statusResponse.status, 200, 'Generic admission route: access request status returns 200');
  equal(
    statusBody.task.id,
    body.accessRequestTask?.id,
    'Generic admission route: access request status returns the stored task',
  );
  equal(
    statusBody.task.releaseTokenMayBeIssued,
    false,
    'Generic admission route: access request status cannot issue release token',
  );
  equal(statusBody.rawPayloadStored, false, 'Generic admission route: status response stores no raw payload');
  equal(statusBody.productionReady, false, 'Generic admission route: status response is not production proof');
  ok(
    !serializedDenial.includes('support-ai-agent') &&
      !serializedDenial.includes('refund-service') &&
      !serializedDenial.includes('policy:refunds:v1'),
    'Generic admission route: requestable denial response is digest-only for raw refs',
  );
}

async function testApprovedAccessRequestRequiresFreshBoundAdmission(): Promise<void> {
  const app = new Hono();
  registerGenericAdmissionRoutes(app, createAccessRequestRouteDeps());
  const initialResponse = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({ approvals: undefined })),
  });
  const initialBody = await initialResponse.json() as {
    accessRequestTask?: ConsequenceAdmissionAccessRequestTask;
  };
  const task = initialBody.accessRequestTask;
  ok(task, 'Generic admission route: missing approval creates a task before approval completion');
  const decidedAt = offsetIso(task.createdAt, 1_000);
  const approvedUntil = offsetIso(task.expiresAt, -1_000);
  const decisionResponse = await app.request(`/api/v1/admissions/access-requests/${task.id}/decision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      status: 'approved',
      decidedAt,
      approval: {
        id: 'approval_route_001',
        approvedAt: task.createdAt,
        approvedUntil,
        approvalRef: 'approval:route:001',
        authorityKind: 'approval',
        state: 'approved',
      },
    }),
  });
  const decisionBody = await decisionResponse.json() as {
    task: ConsequenceAdmissionAccessRequestTask;
    reevaluation: {
      taskId: string;
      bindingDigest: string;
      scopeDigest: string;
      approvalRefDigest: string;
      releaseTokenMayBeIssuedBeforeReevaluation: boolean;
      rawPayloadStored: boolean;
    } | null;
    accessPermitted: boolean;
    releaseTokenMayBeIssued: boolean;
    rawPayloadStored: boolean;
    productionReady: boolean;
  };
  const freshResponse = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      accessRequest: {
        taskId: task.id,
        bindingDigest: task.denial.binding.digest,
        approvalRefDigest: decisionBody.reevaluation?.approvalRefDigest,
      },
    })),
  });
  const freshBody = await freshResponse.json() as {
    admission: {
      allowed: boolean;
      failClosed: boolean;
    };
    accessRequestReevaluation?: {
      taskId: string;
      bindingDigest: string;
      scopeDigest: string;
      releaseTokenMayBeIssuedBeforeReevaluation: boolean;
      rawPayloadStored: boolean;
    };
    requestableDenial?: unknown;
  };

  equal(initialResponse.status, 200, 'Generic admission route: initial requestable denial returns 200');
  equal(decisionResponse.status, 200, 'Generic admission route: access request approval decision returns 200');
  equal(decisionBody.task.status, 'approved', 'Generic admission route: approval endpoint completes the task');
  equal(
    decisionBody.task.result?.mode,
    'reevaluate',
    'Generic admission route: approved task still only authorizes re-evaluation',
  );
  equal(decisionBody.accessPermitted, false, 'Generic admission route: approval endpoint does not permit access');
  equal(
    decisionBody.releaseTokenMayBeIssued,
    false,
    'Generic admission route: approval endpoint cannot issue a release token',
  );
  equal(decisionBody.rawPayloadStored, false, 'Generic admission route: approval endpoint stores no raw payload');
  equal(decisionBody.productionReady, false, 'Generic admission route: approval endpoint is not production proof');
  equal(
    decisionBody.reevaluation?.bindingDigest,
    task.denial.binding.digest,
    'Generic admission route: decision response binds re-evaluation to the original denial',
  );
  equal(
    decisionBody.reevaluation?.scopeDigest,
    task.denial.binding.scopeDigest,
    'Generic admission route: decision response carries the original scope digest',
  );
  equal(
    decisionBody.reevaluation?.releaseTokenMayBeIssuedBeforeReevaluation,
    false,
    'Generic admission route: decision response keeps release token issuance blocked before re-evaluation',
  );
  equal(
    decisionBody.reevaluation?.rawPayloadStored,
    false,
    'Generic admission route: decision response stores no raw approval payload',
  );
  equal(freshResponse.status, 200, 'Generic admission route: fresh admission with approved task returns 200');
  equal(freshBody.admission.allowed, true, 'Generic admission route: fresh admission can pass after real approval');
  equal(
    freshBody.accessRequestReevaluation?.taskId,
    task.id,
    'Generic admission route: fresh admission includes the approved task binding',
  );
  equal(
    freshBody.accessRequestReevaluation?.bindingDigest,
    task.denial.binding.digest,
    'Generic admission route: fresh admission binding digest matches the stored task',
  );
  equal(
    freshBody.accessRequestReevaluation?.scopeDigest,
    task.denial.binding.scopeDigest,
    'Generic admission route: fresh admission scope digest matches the stored task',
  );
  equal(
    freshBody.accessRequestReevaluation?.releaseTokenMayBeIssuedBeforeReevaluation,
    false,
    'Generic admission route: fresh admission records that the approved task did not mint a token',
  );
  equal(
    freshBody.accessRequestReevaluation?.rawPayloadStored,
    false,
    'Generic admission route: fresh admission re-evaluation context is digest-only',
  );
  equal(
    freshBody.requestableDenial,
    undefined,
    'Generic admission route: fresh approved admission is not another requestable denial',
  );
}

async function testApprovedAccessRequestRejectsFreshScopeMismatch(): Promise<void> {
  const app = new Hono();
  let tokenIssuerCalls = 0;
  registerGenericAdmissionRoutes(app, createAccessRequestRouteDeps({
    issueProtectedReleaseToken: () => {
      tokenIssuerCalls += 1;
      throw new Error('release token issuer must not run for access request scope mismatch');
    },
  }));
  const initialResponse = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({ approvals: undefined })),
  });
  const initialBody = await initialResponse.json() as {
    accessRequestTask?: ConsequenceAdmissionAccessRequestTask;
  };
  const task = initialBody.accessRequestTask;
  ok(task, 'Generic admission route: scope mismatch test creates an access request task');
  const decisionResponse = await app.request(`/api/v1/admissions/access-requests/${task.id}/decision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      status: 'approved',
      decidedAt: offsetIso(task.createdAt, 1_000),
      approval: {
        id: 'approval_route_scope_mismatch',
        approvedAt: task.createdAt,
        approvedUntil: offsetIso(task.expiresAt, -1_000),
        authorityKind: 'approval',
      },
    }),
  });
  const freshResponse = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      action: 'issue_store_credit',
      accessRequest: {
        taskId: task.id,
        bindingDigest: task.denial.binding.digest,
      },
    })),
  });
  const freshBody = await freshResponse.json() as {
    reasonCodes: readonly string[];
  };

  equal(decisionResponse.status, 200, 'Generic admission route: scope mismatch test first approves the task');
  equal(freshResponse.status, 403, 'Generic admission route: approved task rejects changed fresh scope');
  ok(
    freshBody.reasonCodes.includes('access-request-scope-mismatch'),
    'Generic admission route: changed fresh scope has explicit access request reason',
  );
  equal(tokenIssuerCalls, 0, 'Generic admission route: token issuer is not called on access request scope mismatch');
}

async function testUntrustedApprovalDoesNotBecomeRequestableDenial(): Promise<void> {
  const app = new Hono();
  let taskCreateCalls = 0;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => tenantFixture(),
    createAccessRequestTask: ({ denial, receivedAt }) => {
      taskCreateCalls += 1;
      return createConsequenceAdmissionAccessRequestTask({
        denial,
        taskId: 'arq_route_untrusted_approval',
        createdAt: receivedAt,
      });
    },
    recordShadowAdmission: () => {},
  });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      authoritySources: [{
        sourceKind: 'customer-email',
        claimKind: 'approval',
        sourceRef: 'email:refund-approval-raw',
      }],
      approvals: [{
        approvalRef: 'email:refund-approval-raw',
        sourceKind: 'customer-email',
        state: 'approved',
        sourceRef: 'email:refund-approval-raw',
        reviewerRef: 'reviewer:risk-owner',
        reviewerAuthorityDigest: digest('b'),
        approvalDigest: digest('c'),
        scopeDigest: digest('d'),
        issuedAt: '2026-05-01T17:00:00.000Z',
        expiresAt: '2026-05-01T19:00:00.000Z',
      }],
    })),
  });
  const body = await response.json() as {
    requestableDenial?: unknown;
    accessRequestTask?: unknown;
    admission: {
      allowed: boolean;
      failClosed: boolean;
      reasonCodes: readonly string[];
    };
  };

  equal(response.status, 200, 'Generic admission route: untrusted approval response is returned');
  equal(body.admission.allowed, false, 'Generic admission route: untrusted approval is not allowed');
  equal(body.admission.failClosed, true, 'Generic admission route: untrusted approval fails closed');
  ok(
    body.admission.reasonCodes.includes('untrusted-content-authority-source') ||
      body.admission.reasonCodes.includes('approval-source-untrusted'),
    'Generic admission route: untrusted approval reason is preserved',
  );
  equal(body.requestableDenial, undefined, 'Generic admission route: untrusted approval is not requestable');
  equal(body.accessRequestTask, undefined, 'Generic admission route: untrusted approval creates no task');
  equal(taskCreateCalls, 0, 'Generic admission route: task dependency is not called for untrusted approval');
}

async function testModelGeneratedApprovalDoesNotBecomeRequestableDenial(): Promise<void> {
  const app = new Hono();
  let taskCreateCalls = 0;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => tenantFixture(),
    createAccessRequestTask: ({ denial, receivedAt }) => {
      taskCreateCalls += 1;
      return createConsequenceAdmissionAccessRequestTask({
        denial,
        taskId: 'arq_route_model_generated_approval',
        createdAt: receivedAt,
      });
    },
    recordShadowAdmission: () => {},
  });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      authoritySources: [{
        sourceKind: 'llm-summary',
        claimKind: 'approval',
        sourceRef: 'model-output:approval-summary',
      }],
      approvals: [{
        approvalRef: 'model-output:approval-summary',
        sourceKind: 'llm-summary',
        state: 'approved',
        sourceRef: 'model-output:approval-summary',
        reviewerRef: 'reviewer:risk-owner',
        reviewerAuthorityDigest: digest('b'),
        approvalDigest: digest('c'),
        scopeDigest: digest('d'),
        issuedAt: '2026-05-01T17:00:00.000Z',
        expiresAt: '2026-05-01T19:00:00.000Z',
      }],
    })),
  });
  const body = await response.json() as {
    requestableDenial?: unknown;
    accessRequestTask?: unknown;
    admission: {
      allowed: boolean;
      failClosed: boolean;
      reasonCodes: readonly string[];
    };
  };

  equal(response.status, 200, 'Generic admission route: model-generated approval response is returned');
  equal(body.admission.allowed, false, 'Generic admission route: model-generated approval is not allowed');
  equal(body.admission.failClosed, true, 'Generic admission route: model-generated approval fails closed');
  ok(
    body.admission.reasonCodes.includes('model-generated-authority-source') ||
      body.admission.reasonCodes.includes('approval-model-generated'),
    'Generic admission route: model-generated approval reason is preserved',
  );
  equal(body.requestableDenial, undefined, 'Generic admission route: model-generated approval is not requestable');
  equal(body.accessRequestTask, undefined, 'Generic admission route: model-generated approval creates no task');
  equal(taskCreateCalls, 0, 'Generic admission route: task dependency is not called for model-generated approval');
}

async function testInvalidAccessRequestTaskFailsClosed(): Promise<void> {
  const app = new Hono();
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => tenantFixture(),
    createAccessRequestTask: ({ denial, receivedAt }) => {
      const task = createConsequenceAdmissionAccessRequestTask({
        denial,
        taskId: 'arq_route_invalid_binding',
        createdAt: receivedAt,
      });
      return {
        ...task,
        denial: {
          ...task.denial,
          binding: {
            ...task.denial.binding,
            digest: `sha256:${'f'.repeat(64)}`,
          },
        },
      } as ConsequenceAdmissionAccessRequestTask;
    },
    recordShadowAdmission: () => {},
  });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({ approvals: undefined })),
  });
  const body = await response.json() as {
    decision: string;
    failClosed: boolean;
    reasonCodes: readonly string[];
  };

  equal(response.status, 503, 'Generic admission route: invalid access request task returns 503');
  equal(body.decision, 'block', 'Generic admission route: invalid access request task blocks');
  equal(body.failClosed, true, 'Generic admission route: invalid access request task fails closed');
  ok(
    body.reasonCodes.includes('access-request-task-invalid'),
    'Generic admission route: invalid access request task reason is explicit',
  );
}

async function testAccessRequestTasksAreTenantScoped(): Promise<void> {
  const app = new Hono();
  registerGenericAdmissionRoutes(app, createAccessRequestRouteDeps({
    currentTenant: (context) => ({
      ...tenantFixture(),
      tenantId: context.req.header('x-tenant-id') ?? 'tenant_a',
    }),
  }));
  const initialResponse = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': 'tenant_a',
    },
    body: JSON.stringify(validAdmissionPayload({ approvals: undefined })),
  });
  const initialBody = await initialResponse.json() as {
    accessRequestTask?: ConsequenceAdmissionAccessRequestTask;
  };
  const task = initialBody.accessRequestTask;
  ok(task, 'Generic admission route: tenant isolation test creates an access request task');
  const otherStatusResponse = await app.request(`/api/v1/admissions/access-requests/${task.id}`, {
    headers: {
      'x-tenant-id': 'tenant_b',
    },
  });
  const otherListResponse = await app.request('/api/v1/admissions/access-requests', {
    headers: {
      'x-tenant-id': 'tenant_b',
    },
  });
  const otherListBody = await otherListResponse.json() as {
    count: number;
  };
  const otherDecisionResponse = await app.request(`/api/v1/admissions/access-requests/${task.id}/decision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': 'tenant_b',
    },
    body: JSON.stringify({
      status: 'approved',
      decidedAt: offsetIso(task.createdAt, 1_000),
      approval: {
        id: 'approval_route_wrong_tenant',
        approvedAt: task.createdAt,
        approvedUntil: offsetIso(task.expiresAt, -1_000),
        authorityKind: 'approval',
      },
    }),
  });
  const ownerListResponse = await app.request('/api/v1/admissions/access-requests', {
    headers: {
      'x-tenant-id': 'tenant_a',
    },
  });
  const ownerListBody = await ownerListResponse.json() as {
    count: number;
  };

  equal(initialResponse.status, 200, 'Generic admission route: tenant isolation setup returns 200');
  equal(otherStatusResponse.status, 404, 'Generic admission route: another tenant cannot read the task');
  equal(otherListResponse.status, 200, 'Generic admission route: another tenant can list its own empty queue');
  equal(otherListBody.count, 0, 'Generic admission route: list is tenant scoped');
  equal(otherDecisionResponse.status, 404, 'Generic admission route: another tenant cannot complete the task');
  equal(ownerListResponse.status, 200, 'Generic admission route: owner tenant list returns 200');
  equal(ownerListBody.count, 1, 'Generic admission route: owner tenant still sees its task');
}

export async function runRequestableDenialRouteTests(): Promise<void> {
  await testDefaultRouteReportsRequestableDenialWithoutTaskDependency();
  await testMissingApprovalProducesRequestableDenialWithoutToken();
  await testApprovedAccessRequestRequiresFreshBoundAdmission();
  await testApprovedAccessRequestRejectsFreshScopeMismatch();
  await testUntrustedApprovalDoesNotBecomeRequestableDenial();
  await testModelGeneratedApprovalDoesNotBecomeRequestableDenial();
  await testInvalidAccessRequestTaskFailsClosed();
  await testAccessRequestTasksAreTenantScoped();
}
