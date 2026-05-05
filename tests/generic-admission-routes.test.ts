import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createConsequenceAdmissionAgentLoopAbuseGuard } from '../src/consequence-admission/index.js';
import { registerGenericAdmissionRoutes } from '../src/service/http/routes/generic-admission-routes.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function createApp(): Hono {
  const app = new Hono();
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'community',
      monthlyRunQuota: 100,
    }),
  });
  return app;
}

function createLoopGuardedApp(): { readonly app: Hono; readonly shadowRecords: number } {
  const app = new Hono();
  const guard = createConsequenceAdmissionAgentLoopAbuseGuard({
    policy: {
      maxRetryAttemptsPerPreviousAdmission: 2,
    },
    now: () => '2026-05-01T18:12:00.000Z',
  });
  let shadowRecords = 0;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'community',
      monthlyRunQuota: 100,
    }),
    evaluateAgentLoopAbuse: ({ tenant, envelope, receivedAt }) =>
      guard.evaluate({
        tenantId: tenant.tenantId,
        envelope,
        receivedAt,
      }),
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  return {
    app,
    get shadowRecords() {
      return shadowRecords;
    },
  };
}

async function testPostAdmissionRouteReturnsEnvelope(): Promise<void> {
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
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: '2026-05-01T18:00:00.000Z',
      decidedAt: '2026-05-01T18:00:01.000Z',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:987', 'payment:456'],
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'customer_123',
    }),
  });
  const body = await response.json() as {
    mode: string;
    shadowDecision: string;
    downstreamPosture: string;
    admission: {
      decision: string;
      allowed: boolean;
      feedback: {
        safeForModel: boolean;
        disclosureLevel: string;
      };
      retry: {
        retryAllowed: boolean;
        retryCategory: string;
      };
      request: {
        policyScope: {
          tenantId: string;
          environment: string;
        };
        entryPoint: {
          route: string;
        };
      };
    };
  };

  equal(response.status, 200, 'Generic admission route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Generic admission route: response is no-store');
  equal(body.mode, 'enforce', 'Generic admission route: mode is preserved');
  equal(body.shadowDecision, 'would_admit', 'Generic admission route: complete request shadows admit');
  equal(body.downstreamPosture, 'enforce-decision', 'Generic admission route: enforce posture is returned');
  equal(body.admission.decision, 'admit', 'Generic admission route: complete request admits');
  equal(body.admission.allowed, true, 'Generic admission route: admitted request is allowed');
  equal(body.admission.feedback.safeForModel, true, 'Generic admission route: model-safe feedback is exposed');
  equal(body.admission.feedback.disclosureLevel, 'minimal', 'Generic admission route: admitted feedback is minimal');
  equal(body.admission.retry.retryAllowed, false, 'Generic admission route: admitted request is not retryable');
  equal(body.admission.retry.retryCategory, 'not-needed', 'Generic admission route: retry category is not-needed');
  equal(body.admission.request.entryPoint.route, '/api/v1/admissions', 'Generic admission route: entry point is canonical');
  equal(body.admission.request.policyScope.tenantId, 'tenant_route', 'Generic admission route: tenant context scopes the request');
  equal(body.admission.request.policyScope.environment, 'api_key', 'Generic admission route: tenant source fills environment by default');
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
  ok(body.detail.includes('domain must be one of'), 'Generic admission route: invalid domain detail is specific');
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
        correctionReasonCodes: ['policy-ref-missing', 'evidence-ref-missing'],
        correctionFields: ['policyRef', 'evidenceRefs'],
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

await testPostAdmissionRouteReturnsEnvelope();
await testInvalidJsonReturnsFailClosedProblem();
await testInvalidInputReturnsFailClosedProblem();
await testPostAdmissionRouteCarriesRetryAttemptBinding();
await testLoopGuardThrottlesRetryAttemptBeyondBudget();

console.log(`Generic admission route tests: ${passed} passed, 0 failed`);
