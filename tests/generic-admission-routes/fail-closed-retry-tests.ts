import {
  Hono,
  createApp,
  createDpopProof,
  createInMemoryReleaseTokenIntrospectionStore,
  createLoopGuardedApp,
  digest,
  equal,
  generateDpopKeyPair,
  issueGenericAdmissionProtectedReleaseToken,
  ok,
  registerGenericAdmissionRoutes,
  releaseTokenIssuerFixture,
  resolveHostedGenericAdmissionDpopSenderConfirmation,
  trustedApprovals,
  trustedAuthoritySources,
  validAdmissionPayload,
} from './helpers.js';

async function testTenantMismatchFailsClosedBeforeShadowRecording(): Promise<void> {
  const app = new Hono();
  let shadowRecords = 0;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_auth',
      tenantName: 'Authenticated Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'starter',
      monthlyRunQuota: 100,
    }),
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      tenantId: 'tenant_other',
    })),
  });
  const body = await response.json() as {
    decision: string;
    failClosed: boolean;
    detail: string;
    reasonCodes: readonly string[];
  };

  equal(response.status, 403, 'Generic admission route: mismatched tenant returns 403');
  equal(body.decision, 'block', 'Generic admission route: mismatched tenant blocks');
  equal(body.failClosed, true, 'Generic admission route: mismatched tenant fails closed');
  ok(
    body.reasonCodes.includes('tenant-scope-mismatch'),
    'Generic admission route: mismatched tenant reason is explicit',
  );
  equal(shadowRecords, 0, 'Generic admission route: mismatched tenant is not shadow recorded');
}

async function testNestedScopeTenantMismatchFailsClosedBeforeShadowRecording(): Promise<void> {
  const app = new Hono();
  let shadowRecords = 0;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'starter',
      monthlyRunQuota: 100,
    }),
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      scopeOwnerPolicyRef: 'policy:tenant-scope',
      requestedScope: {
        tenantId: 'tenant_other',
        operationType: 'refund',
      },
      approvedScope: {
        tenantId: 'tenant_other',
        operationTypes: ['refund'],
      },
    })),
  });
  const body = await response.json() as {
    decision: string;
    failClosed: boolean;
    detail: string;
    reasonCodes: readonly string[];
  };

  equal(response.status, 403, 'Generic admission route: nested scope tenant mismatch returns 403');
  equal(body.decision, 'block', 'Generic admission route: nested scope tenant mismatch blocks');
  equal(body.failClosed, true, 'Generic admission route: nested scope tenant mismatch fails closed');
  ok(
    body.reasonCodes.includes('tenant-scope-mismatch'),
    'Generic admission route: nested scope tenant mismatch reason is explicit',
  );
  equal(
    body.detail,
    'Admission requestedScope.tenantId must match the authenticated tenant context.',
    'Generic admission route: nested scope tenant mismatch identifies the scoped field',
  );
  equal(shadowRecords, 0, 'Generic admission route: nested scope tenant mismatch is not shadow recorded');
}

async function testLoopGuardUnavailableFailsClosedBeforeShadowRecording(): Promise<void> {
  const app = new Hono();
  let shadowRecords = 0;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'starter',
      monthlyRunQuota: 100,
    }),
    evaluateAgentLoopAbuse: async () => {
      throw new Error('shared guard unavailable');
    },
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload()),
  });
  const body = await response.json() as {
    decision: string;
    failClosed: boolean;
    reasonCodes: readonly string[];
  };

  equal(response.status, 503, 'Generic admission route: unavailable loop guard returns 503');
  equal(body.decision, 'block', 'Generic admission route: unavailable loop guard blocks');
  equal(body.failClosed, true, 'Generic admission route: unavailable loop guard fails closed');
  ok(
    body.reasonCodes.includes('agent-loop-abuse-guard-unavailable'),
    'Generic admission route: unavailable loop guard reason is explicit',
  );
  equal(
    body.detail,
    'The agent loop abuse guard could not evaluate the admission.',
    'Generic admission route: unavailable loop guard detail is redacted',
  );
  equal(shadowRecords, 0, 'Generic admission route: unavailable loop guard is not shadow recorded');
}

async function testMissingShadowRecorderFailsClosed(): Promise<void> {
  const app = new Hono();
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'starter',
      monthlyRunQuota: 100,
    }),
  } as unknown as Parameters<typeof registerGenericAdmissionRoutes>[1]);
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload()),
  });
  const body = await response.json() as {
    decision: string;
    failClosed: boolean;
    detail: string;
    reasonCodes: readonly string[];
  };

  equal(response.status, 503, 'Generic admission route: missing shadow recorder returns 503');
  equal(body.decision, 'block', 'Generic admission route: missing shadow recorder blocks');
  equal(body.failClosed, true, 'Generic admission route: missing shadow recorder fails closed');
  equal(
    body.detail,
    'The shadow admission event recorder is not configured.',
    'Generic admission route: missing shadow recorder detail is explicit and redacted',
  );
  ok(
    body.reasonCodes.includes('shadow-recording-unavailable'),
    'Generic admission route: missing shadow recorder reason is explicit',
  );
}

async function testNonJsonMediaTypeReturnsFailClosedProblem(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'text/plain',
    },
    body: 'not-json',
  });
  const body = await response.json() as {
    decision: string;
    failClosed: boolean;
    reasonCodes: readonly string[];
  };

  equal(response.status, 415, 'Generic admission route: non-JSON media type returns 415');
  equal(body.decision, 'block', 'Generic admission route: non-JSON media type problem blocks');
  equal(body.failClosed, true, 'Generic admission route: non-JSON media type problem fails closed');
  ok(body.reasonCodes.includes('json-required'), 'Generic admission route: non-JSON media type reason is explicit');
}

async function testInvalidJsonReturnsFailClosedProblem(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: '{bad json',
  });
  const body = await response.json() as {
    decision: string;
    failClosed: boolean;
    reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Generic admission route: invalid JSON returns 400');
  equal(response.headers.get('cache-control'), 'no-store', 'Generic admission route: invalid JSON response is no-store');
  equal(body.decision, 'block', 'Generic admission route: invalid JSON problem blocks');
  equal(body.failClosed, true, 'Generic admission route: invalid JSON problem fails closed');
  ok(body.reasonCodes.includes('invalid-json'), 'Generic admission route: invalid JSON reason is explicit');
}

async function testInvalidInputReturnsFailClosedProblem(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'enforce',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-but-magic',
      downstreamSystem: 'refund-service',
    }),
  });
  const body = await response.json() as {
    decision: string;
    failClosed: boolean;
    detail: string;
    reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Generic admission route: invalid input returns 400');
  equal(body.decision, 'block', 'Generic admission route: invalid input problem blocks');
  equal(body.failClosed, true, 'Generic admission route: invalid input problem fails closed');
  equal(
    body.detail,
    'The generic admission request could not be evaluated.',
    'Generic admission route: invalid input detail is redacted',
  );
  ok(body.reasonCodes.includes('invalid-admission-input'), 'Generic admission route: invalid input reason is explicit');
}

async function testPostAdmissionRouteCarriesRetryAttemptBinding(): Promise<void> {
  const app = createApp();
  const heldResponse = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'review',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: '2026-05-01T18:10:00.000Z',
      decidedAt: '2026-05-01T18:10:01.000Z',
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'customer_123',
    }),
  });
  const held = await heldResponse.json() as {
    admission: {
      admissionId: string;
      digest: string;
      request: {
        requestId: string;
      };
    };
  };
  const retryResponse = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'review',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: '2026-05-01T18:11:00.000Z',
      decidedAt: '2026-05-01T18:11:01.000Z',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:987', 'payment:456'],
      authoritySources: trustedAuthoritySources(),
      approvals: trustedApprovals(),
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'customer_123',
      retryAttempt: {
        previousAdmissionId: held.admission.admissionId,
        previousAdmissionDigest: held.admission.digest,
        previousRequestId: held.admission.request.requestId,
        attemptNumber: 1,
        attemptedAt: '2026-05-01T18:11:00.000Z',
        correctionReasonCodes: ['policy-ref-missing', 'evidence-ref-missing', 'authority-source-missing'],
        correctionFields: ['policyRef', 'evidenceRefs', 'authoritySources'],
        idempotencyKey: 'retry:route:1',
      },
    }),
  });
  const retry = await retryResponse.json() as {
    admission: {
      decision: string;
      reasonCodes: readonly string[];
      request: {
        requestId: string;
        retryAttempt: {
          attemptId: string;
          previousAdmissionDigest: string;
          attemptNumber: number;
        };
      };
    };
  };

  equal(retryResponse.status, 200, 'Generic admission route: bound retry returns 200');
  equal(retry.admission.decision, 'admit', 'Generic admission route: corrected bound retry admits');
  equal(
    retry.admission.request.retryAttempt.previousAdmissionDigest,
    held.admission.digest,
    'Generic admission route: retry attempt binds to previous admission digest',
  );
  equal(
    retry.admission.request.retryAttempt.attemptNumber,
    1,
    'Generic admission route: retry attempt number is preserved',
  );
  ok(
    retry.admission.request.retryAttempt.attemptId.startsWith('retry-attempt:sha256:'),
    'Generic admission route: retry attempt id is canonical digest-shaped',
  );
  ok(
    retry.admission.reasonCodes.includes('retry-attempt-bound'),
    'Generic admission route: retry attempt is visible as a reason code',
  );
  ok(
    retry.admission.request.requestId !== held.admission.request.requestId,
    'Generic admission route: retry attempt has a new request id',
  );
}

async function testLoopGuardThrottlesRetryAttemptBeyondBudget(): Promise<void> {
  const guarded = createLoopGuardedApp();
  const response = await guarded.app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'review',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: '2026-05-01T18:12:00.000Z',
      decidedAt: '2026-05-01T18:12:01.000Z',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:987', 'payment:456'],
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'customer_123',
      retryAttempt: {
        previousAdmissionId: 'admission:previous',
        previousAdmissionDigest: 'sha256:previous-admission',
        previousRequestId: 'request:previous',
        attemptNumber: 3,
        attemptedAt: '2026-05-01T18:12:00.000Z',
        correctionReasonCodes: ['policy-ref-missing'],
        correctionFields: ['policyRef'],
        idempotencyKey: 'retry:route:over-budget',
      },
    }),
  });
  const body = await response.json() as {
    decision: string;
    failClosed: boolean;
    reasonCodes: readonly string[];
  };

  equal(response.status, 429, 'Generic admission route: over-budget retry returns 429');
  equal(response.headers.get('cache-control'), 'no-store', 'Generic admission route: retry throttle is no-store');
  ok(response.headers.get('retry-after') !== null, 'Generic admission route: retry throttle includes Retry-After');
  equal(body.decision, 'block', 'Generic admission route: retry throttle problem blocks');
  equal(body.failClosed, true, 'Generic admission route: retry throttle fails closed');
  ok(
    body.reasonCodes.includes('agent-loop-attempt-budget-exhausted'),
    'Generic admission route: retry throttle reason is explicit',
  );
  equal(
    guarded.shadowRecords,
    0,
    'Generic admission route: throttled retry is not recorded as an accepted shadow admission',
  );
}

export async function runFailClosedRetryTests(): Promise<void> {
  await testTenantMismatchFailsClosedBeforeShadowRecording();
  await testNestedScopeTenantMismatchFailsClosedBeforeShadowRecording();
  await testLoopGuardUnavailableFailsClosedBeforeShadowRecording();
  await testMissingShadowRecorderFailsClosed();
  await testNonJsonMediaTypeReturnsFailClosedProblem();
  await testInvalidJsonReturnsFailClosedProblem();
  await testInvalidInputReturnsFailClosedProblem();
  await testPostAdmissionRouteCarriesRetryAttemptBinding();
  await testLoopGuardThrottlesRetryAttemptBeyondBudget();
}
