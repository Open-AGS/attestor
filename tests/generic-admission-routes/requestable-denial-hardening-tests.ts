import {
  Hono,
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

type GenericAdmissionRouteDeps = Parameters<typeof registerGenericAdmissionRoutes>[1];

function requesterFixture() {
  return {
    principalRef: 'tenant:api_key:route-test-client',
    source: 'tenant-context',
    role: 'api_key',
  };
}

function approverFixture() {
  return {
    principalRef: 'account-user:route-risk-owner',
    source: 'account-session',
    role: 'account_admin',
  };
}

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
    now: () => '2026-05-01T18:00:01.000Z',
    recordShadowAdmission: () => {},
    currentAccessRequestPrincipal: () => requesterFixture(),
    authorizeAccessRequestDecision: () => approverFixture(),
    createAccessRequestTask: ({ tenant, denial, receivedAt, requester }) => {
      counter += 1;
      const task = createConsequenceAdmissionAccessRequestTask({
        denial,
        taskId: `arq_hardening_${counter}`,
        createdAt: receivedAt,
        requester,
        statusEndpoint: `https://attestor.test/access-requests/arq_hardening_${counter}`,
      });
      tasks.set(taskKey(tenant.tenantId, task.id), task);
      return task;
    },
    completeAccessRequestTask: ({ tenant, taskId, status, decidedAt, decisionAuthority, approval }) => {
      const key = taskKey(tenant.tenantId, taskId);
      const current = tasks.get(key);
      if (!current) return null;
      const completed = completeConsequenceAdmissionAccessRequestTask({
        task: current,
        status,
        decidedAt,
        decisionAuthority,
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

async function createApprovedAccessRequest(input: {
  readonly app: Hono;
  readonly initialOverrides?: Record<string, unknown>;
  readonly approvalId: string;
}): Promise<{
  readonly task: ConsequenceAdmissionAccessRequestTask;
  readonly approvalRefDigest: string | null;
}> {
  const initialResponse = await input.app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      ...input.initialOverrides,
      approvals: undefined,
    })),
  });
  const initialBody = await initialResponse.json() as {
    accessRequestTask?: ConsequenceAdmissionAccessRequestTask;
  };
  const task = initialBody.accessRequestTask;
  ok(task, 'Generic admission route hardening: setup creates an access request task');
  const decisionResponse = await input.app.request(`/api/v1/admissions/access-requests/${task.id}/decision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      status: 'approved',
      decidedAt: '2099-01-01T00:00:00.000Z',
      approval: {
        id: input.approvalId,
        approvedAt: task.createdAt,
        approvedUntil: offsetIso(task.expiresAt, -1_000),
        approvalRef: `approval:${input.approvalId}`,
        authorityKind: 'approval',
        scopeDigest: task.denial.binding.scopeDigest,
        state: 'approved',
      },
    }),
  });
  const decisionBody = await decisionResponse.json() as {
    reevaluation?: {
      approvalRefDigest?: string | null;
    } | null;
  };
  equal(decisionResponse.status, 200, 'Generic admission route hardening: setup approves the task');
  return {
    task,
    approvalRefDigest: decisionBody.reevaluation?.approvalRefDigest ?? null,
  };
}

async function createPendingAccessRequest(app: Hono, label: string): Promise<ConsequenceAdmissionAccessRequestTask> {
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
  ok(task, `Generic admission route hardening: ${label} setup creates an access request task`);
  return task;
}

function approvedDecisionPayload(
  task: ConsequenceAdmissionAccessRequestTask,
  approvalOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    status: 'approved',
    decidedAt: offsetIso(task.createdAt, 1_000),
    approval: {
      id: 'approval_route_hardening',
      approvedAt: task.createdAt,
      approvedUntil: offsetIso(task.expiresAt, -1_000),
      approvalRef: 'approval:route:hardening',
      authorityKind: 'approval',
      scopeDigest: task.denial.binding.scopeDigest,
      state: 'approved',
      ...approvalOverrides,
    },
  };
}

async function testApprovedAccessRequestRejectsMaterialScopeDrift(): Promise<void> {
  const cases: readonly {
    readonly label: string;
    readonly initial?: Record<string, unknown>;
    readonly fresh: Record<string, unknown>;
  }[] = [
    {
      label: 'amount',
      fresh: {
        amount: {
          value: 39000,
          currency: 'HUF',
        },
      },
    },
    {
      label: 'recipient',
      fresh: {
        recipient: 'customer_456',
      },
    },
    {
      label: 'data scope',
      fresh: {
        dataScope: {
          records: 20,
          classification: 'customer-private',
          fields: ['email'],
        },
      },
    },
    {
      label: 'domain',
      fresh: {
        domain: 'data-disclosure',
      },
    },
    {
      label: 'environment',
      fresh: {
        environment: 'production',
      },
    },
    {
      label: 'requested scope',
      fresh: {
        requestedScope: {
          amountMinorUnits: 3900000,
          currency: 'HUF',
          tenantId: 'tenant_route',
          downstreamSystem: 'refund-service',
          operationType: 'refund',
        },
      },
    },
  ];

  for (const testCase of cases) {
    const app = new Hono();
    let tokenIssuerCalls = 0;
    registerGenericAdmissionRoutes(app, createAccessRequestRouteDeps({
      issueProtectedReleaseToken: () => {
        tokenIssuerCalls += 1;
        throw new Error('release token issuer must not run for material scope mismatch');
      },
    }));
    const approved = await createApprovedAccessRequest({
      app,
      initialOverrides: testCase.initial,
      approvalId: `approval_${testCase.label.replace(/\s+/gu, '_')}`,
    });
    const freshResponse = await app.request('/api/v1/admissions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(validAdmissionPayload({
        ...testCase.fresh,
        accessRequest: {
          taskId: approved.task.id,
          bindingDigest: approved.task.denial.binding.digest,
          approvalRefDigest: approved.approvalRefDigest,
        },
      })),
    });
    const freshBody = await freshResponse.json() as {
      reasonCodes: readonly string[];
    };

    equal(freshResponse.status, 403, `Generic admission route hardening: ${testCase.label} drift is rejected`);
    ok(
      freshBody.reasonCodes.includes('access-request-scope-mismatch'),
      `Generic admission route hardening: ${testCase.label} drift reports scope mismatch`,
    );
    equal(
      tokenIssuerCalls,
      0,
      `Generic admission route hardening: ${testCase.label} drift cannot reach token issuance`,
    );
  }
}

async function testAccessRequestDecisionRequiresAuthorizer(): Promise<void> {
  const app = new Hono();
  const deps = createAccessRequestRouteDeps({
    authorizeAccessRequestDecision: undefined,
  });
  registerGenericAdmissionRoutes(app, deps);
  const task = await createPendingAccessRequest(app, 'missing authorizer');
  const decisionResponse = await app.request(`/api/v1/admissions/access-requests/${task.id}/decision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(approvedDecisionPayload(task)),
  });
  const body = await decisionResponse.json() as {
    reasonCodes: readonly string[];
  };
  const stored = await deps.getAccessRequestTask?.({
    context: {} as never,
    tenant: tenantFixture(),
    taskId: task.id,
  });

  equal(decisionResponse.status, 503, 'Generic admission route hardening: missing decision authorizer fails closed');
  ok(
    body.reasonCodes.includes('access-request-decision-authorizer-unavailable'),
    'Generic admission route hardening: missing authorizer reports explicit reason',
  );
  equal(stored?.status, 'pending', 'Generic admission route hardening: missing authorizer leaves task pending');
}

async function testAccessRequestDecisionAuthorizerCanDenyBeforePersist(): Promise<void> {
  const app = new Hono();
  let completeCalls = 0;
  const deps = createAccessRequestRouteDeps({
    authorizeAccessRequestDecision: ({ context }) =>
      context.json({ reasonCodes: ['reviewer-required'] }, 403),
    completeAccessRequestTask: () => {
      completeCalls += 1;
      throw new Error('authorization denial must stop before completion');
    },
  });
  registerGenericAdmissionRoutes(app, deps);
  const task = await createPendingAccessRequest(app, 'authorizer deny');
  const decisionResponse = await app.request(`/api/v1/admissions/access-requests/${task.id}/decision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(approvedDecisionPayload(task)),
  });
  const stored = await deps.getAccessRequestTask?.({
    context: {} as never,
    tenant: tenantFixture(),
    taskId: task.id,
  });

  equal(decisionResponse.status, 403, 'Generic admission route hardening: authorizer denial is returned');
  equal(completeCalls, 0, 'Generic admission route hardening: authorizer denial is not persisted');
  equal(stored?.status, 'pending', 'Generic admission route hardening: denied authorization leaves task pending');
}

async function testAccessRequestDecisionRejectsSelfApproval(): Promise<void> {
  const app = new Hono();
  const deps = createAccessRequestRouteDeps({
    authorizeAccessRequestDecision: () => requesterFixture(),
  });
  registerGenericAdmissionRoutes(app, deps);
  const task = await createPendingAccessRequest(app, 'self approval');
  const decisionResponse = await app.request(`/api/v1/admissions/access-requests/${task.id}/decision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(approvedDecisionPayload(task)),
  });
  const stored = await deps.getAccessRequestTask?.({
    context: {} as never,
    tenant: tenantFixture(),
    taskId: task.id,
  });

  equal(decisionResponse.status, 400, 'Generic admission route hardening: requester cannot approve its own task');
  equal(stored?.status, 'pending', 'Generic admission route hardening: self approval leaves task pending');
}

async function testApprovedDecisionRequiresExplicitScopeDigest(): Promise<void> {
  const app = new Hono();
  const deps = createAccessRequestRouteDeps();
  registerGenericAdmissionRoutes(app, deps);
  const task = await createPendingAccessRequest(app, 'missing approval scope');
  const decisionResponse = await app.request(`/api/v1/admissions/access-requests/${task.id}/decision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(approvedDecisionPayload(task, {
      scopeDigest: undefined,
    })),
  });
  const stored = await deps.getAccessRequestTask?.({
    context: {} as never,
    tenant: tenantFixture(),
    taskId: task.id,
  });

  equal(decisionResponse.status, 400, 'Generic admission route hardening: approved decision requires scope digest');
  equal(stored?.status, 'pending', 'Generic admission route hardening: missing scope leaves task pending');
}

async function testFutureClientDecisionTimeCannotExtendRequestableDenialTtl(): Promise<void> {
  const app = new Hono();
  const deps = createAccessRequestRouteDeps();
  registerGenericAdmissionRoutes(app, deps);
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      approvals: undefined,
      decidedAt: '2099-01-01T00:00:00.000Z',
    })),
  });
  const body = await response.json() as {
    requestableDenial?: {
      evaluatedAt: string;
      expiresAt: string;
    };
  };
  const ttlMs = Date.parse(body.requestableDenial?.expiresAt ?? '') -
    Date.parse(body.requestableDenial?.evaluatedAt ?? '');

  equal(response.status, 200, 'Generic admission route hardening: future client decidedAt still returns denial');
  equal(ttlMs, 10 * 60 * 1000, 'Generic admission route hardening: denial TTL uses server route time');
  equal(deps.taskCount(), 1, 'Generic admission route hardening: future client decidedAt creates a bounded task');
}

async function testClientBackdatedAdmissionTimeCannotMakeExpiredApprovalFresh(): Promise<void> {
  const app = new Hono();
  registerGenericAdmissionRoutes(app, createAccessRequestRouteDeps({
    now: () => '2026-05-01T20:00:00.000Z',
  }));
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      requestedAt: '2026-05-01T18:00:00.000Z',
      decidedAt: '2026-05-01T18:00:01.000Z',
    })),
  });
  const body = await response.json() as {
    admission: {
      allowed: boolean;
      failClosed: boolean;
      reasonCodes: readonly string[];
    };
  };

  equal(response.status, 200, 'Generic admission route hardening: backdated client admission returns evaluated denial');
  equal(body.admission.allowed, false, 'Generic admission route hardening: expired approval is not allowed');
  equal(body.admission.failClosed, true, 'Generic admission route hardening: expired approval remains fail-closed');
  ok(
    body.admission.reasonCodes.includes('approval-expired'),
    'Generic admission route hardening: route server time drives approval freshness',
  );
}

async function testInvalidApprovalDecisionDoesNotPersist(): Promise<void> {
  const app = new Hono();
  let completeCalls = 0;
  const deps = createAccessRequestRouteDeps({
    completeAccessRequestTask: () => {
      completeCalls += 1;
      throw new Error('invalid decision must be rejected before store completion');
    },
  });
  registerGenericAdmissionRoutes(app, deps);
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
  ok(task, 'Generic admission route hardening: invalid decision setup creates a task');
  const decisionResponse = await app.request(`/api/v1/admissions/access-requests/${task.id}/decision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      status: 'approved',
      decidedAt: task.createdAt,
      approval: {
        id: 'approval_invalid_window',
        approvedAt: task.createdAt,
        approvedUntil: task.createdAt,
        authorityKind: 'approval',
        scopeDigest: task.denial.binding.scopeDigest,
      },
    }),
  });
  const stored = await deps.getAccessRequestTask?.({
    context: {} as never,
    tenant: tenantFixture(),
    taskId: task.id,
  });

  equal(decisionResponse.status, 400, 'Generic admission route hardening: invalid approval window is rejected');
  equal(completeCalls, 0, 'Generic admission route hardening: invalid decision is not persisted');
  equal(stored?.status, 'pending', 'Generic admission route hardening: stored task remains pending');
}

export async function runRequestableDenialHardeningRouteTests(): Promise<void> {
  await testApprovedAccessRequestRejectsMaterialScopeDrift();
  await testAccessRequestDecisionRequiresAuthorizer();
  await testAccessRequestDecisionAuthorizerCanDenyBeforePersist();
  await testAccessRequestDecisionRejectsSelfApproval();
  await testApprovedDecisionRequiresExplicitScopeDigest();
  await testFutureClientDecisionTimeCannotExtendRequestableDenialTtl();
  await testClientBackdatedAdmissionTimeCannotMakeExpiredApprovalFresh();
  await testInvalidApprovalDecisionDoesNotPersist();
}
