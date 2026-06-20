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

export async function runRequestableDenialRouteTests(): Promise<void> {
  await testDefaultRouteReportsRequestableDenialWithoutTaskDependency();
  await testMissingApprovalProducesRequestableDenialWithoutToken();
  await testUntrustedApprovalDoesNotBecomeRequestableDenial();
  await testInvalidAccessRequestTaskFailsClosed();
}
