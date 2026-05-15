import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  createConsequenceAdmissionAgentLoopAbuseGuard,
  issueGenericAdmissionProtectedReleaseToken,
  type GenericAdmissionEnvelope,
} from '../src/consequence-admission/index.js';
import {
  createDpopProof,
  generateDpopKeyPair,
} from '../src/release-enforcement-plane/dpop.js';
import {
  createInMemoryReleaseTokenIntrospectionStore,
} from '../src/release-kernel/release-introspection.js';
import { createReleaseTokenIssuer } from '../src/release-kernel/release-token.js';
import { generateKeyPair } from '../src/signing/keys.js';
import { registerGenericAdmissionRoutes } from '../src/service/http/routes/generic-admission-routes.js';
import {
  resolveHostedGenericAdmissionDpopSenderConfirmation,
} from '../src/service/hosted-generic-admission-sender-confirmation.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function createApp(planId = 'starter'): Hono {
  const app = new Hono();
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId,
      monthlyRunQuota: 100,
    }),
  });
  return app;
}

function createLoopGuardedApp(planId = 'starter'): { readonly app: Hono; readonly shadowRecords: number } {
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
      planId,
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

function validAdmissionPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: 'enforce',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T18:00:00.000Z',
    decidedAt: '2026-05-01T18:00:01.000Z',
    policyRef: 'policy:refunds:v1',
    reviewerRef: 'reviewer:risk-owner',
    evidenceRefs: ['order:987', 'payment:456'],
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    ...overrides,
  };
}

function releaseTokenIssuerFixture() {
  const keyPair = generateKeyPair();
  return createReleaseTokenIssuer({
    issuer: 'attestor.generic-admission.route.test',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
}

async function testEvaluationPlansRejectEnforcingModes(): Promise<void> {
  const scenarios = [
    { planId: 'developer', mode: 'enforce', expectedPlanId: 'developer' },
    { planId: 'trial', mode: 'review', expectedPlanId: 'trial' },
    { planId: 'community', mode: 'enforce', expectedPlanId: 'developer' },
  ] as const;

  for (const scenario of scenarios) {
    const app = createApp(scenario.planId);
    const response = await app.request('/api/v1/admissions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        mode: scenario.mode,
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
      decision: string;
      failClosed: boolean;
      detail: string;
      reasonCodes: readonly string[];
    };

    equal(response.status, 403, `Generic admission route: ${scenario.planId} ${scenario.mode} returns 403`);
    equal(body.decision, 'block', `Generic admission route: ${scenario.planId} ${scenario.mode} blocks`);
    equal(body.failClosed, true, `Generic admission route: ${scenario.planId} ${scenario.mode} fails closed`);
    ok(
      body.detail.includes(`Plan ${scenario.expectedPlanId} only allows observe, warn admission modes`),
      `Generic admission route: ${scenario.planId} ${scenario.mode} explains allowed modes`,
    );
    ok(
      body.reasonCodes.includes('plan-mode-restricted'),
      `Generic admission route: ${scenario.planId} ${scenario.mode} includes plan restriction reason`,
    );
  }
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
  equal(shadowRecords, 0, 'Generic admission route: unavailable loop guard is not shadow recorded');
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

async function testProtectedReleaseTokenIssuerReturnsAuthorizationWithoutRecordingRawToken(): Promise<void> {
  const app = new Hono();
  const issuer = releaseTokenIssuerFixture();
  const introspectionStore = createInMemoryReleaseTokenIntrospectionStore();
  const dpop = await generateDpopKeyPair();
  let recordedEnvelope: GenericAdmissionEnvelope | null = null;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'starter',
      monthlyRunQuota: 100,
    }),
    issueProtectedReleaseToken: ({ envelope }) =>
      issueGenericAdmissionProtectedReleaseToken({
        envelope,
        issuer,
        introspectionStore,
        confirmation: { jkt: dpop.publicKeyThumbprint },
        issuedAt: '2026-05-01T18:00:02.000Z',
      }),
    recordShadowAdmission: ({ envelope }) => {
      recordedEnvelope = envelope;
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
    protectedReleaseToken: {
      tokenId: string;
      tokenDigest: string;
      rawReleaseTokenStored: boolean;
      introspectionAuthorityRegistered: boolean;
    };
    protectedReleaseTokenAuthorization: {
      token: string;
      tokenId: string;
      tokenDigest: string;
      storeRawTokenInAdmissionOrShadow: boolean;
    };
    admission: {
      proof: readonly {
        kind: string;
        id: string;
        digest: string | null;
      }[];
      operationalContext: Record<string, unknown>;
    };
  };

  equal(response.status, 200, 'Generic admission route: protected token issuance returns 200');
  ok(
    typeof body.protectedReleaseTokenAuthorization.token === 'string' &&
      body.protectedReleaseTokenAuthorization.token.length > 50,
    'Generic admission route: protected token authorization returns raw token to caller',
  );
  equal(
    body.protectedReleaseTokenAuthorization.storeRawTokenInAdmissionOrShadow,
    false,
    'Generic admission route: protected token authorization forbids raw-token storage',
  );
  equal(
    body.protectedReleaseToken.tokenId,
    body.protectedReleaseTokenAuthorization.tokenId,
    'Generic admission route: sanitized summary and authorization token id match',
  );
  equal(
    body.protectedReleaseToken.introspectionAuthorityRegistered,
    true,
    'Generic admission route: protected token is registered for online introspection',
  );
  equal(
    introspectionStore.findToken(body.protectedReleaseTokenAuthorization.tokenId)?.status,
    'issued',
    'Generic admission route: route issuer registers the token in the introspection store',
  );
  equal(
    body.admission.proof.some((proof) =>
      proof.kind === 'release-token' &&
      proof.id === body.protectedReleaseTokenAuthorization.tokenId &&
      proof.digest === body.protectedReleaseTokenAuthorization.tokenDigest),
    true,
    'Generic admission route: final admission carries release-token proof ref',
  );
  equal(
    body.admission.operationalContext.protectedReleaseTokenRawStored,
    false,
    'Generic admission route: final admission marks raw token as unstored',
  );
  ok(recordedEnvelope !== null, 'Generic admission route: protected token envelope is recorded');
  equal(
    JSON.stringify(recordedEnvelope).includes(body.protectedReleaseTokenAuthorization.token),
    false,
    'Generic admission route: recorded shadow envelope excludes raw token',
  );
}

async function testProtectedReleaseTokenRequiredFailsClosedWithoutIssuer(): Promise<void> {
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
    requireProtectedReleaseTokenForHighRisk: true,
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

  equal(response.status, 503, 'Generic admission route: missing required protected token issuer returns 503');
  equal(body.decision, 'block', 'Generic admission route: missing required protected token issuer blocks');
  equal(body.failClosed, true, 'Generic admission route: missing required protected token issuer fails closed');
  ok(
    body.reasonCodes.includes('protected-release-token-issuer-missing'),
    'Generic admission route: missing protected token issuer reason is explicit',
  );
  equal(shadowRecords, 0, 'Generic admission route: missing protected token issuer is not shadow recorded');
}

async function testProtectedReleaseTokenIssuerUsesRouteResolvedDpopConfirmation(): Promise<void> {
  const app = new Hono();
  const issuer = releaseTokenIssuerFixture();
  const introspectionStore = createInMemoryReleaseTokenIntrospectionStore();
  const dpop = await generateDpopKeyPair();
  const routeUrl = 'https://attestor.test/api/v1/admissions';
  const proof = await createDpopProof({
    privateJwk: dpop.privateJwk,
    publicJwk: dpop.publicJwk,
    httpMethod: 'POST',
    httpUri: routeUrl,
    proofJti: 'dpop-generic-route-issuer-bridge',
    issuedAt: new Date().toISOString(),
  });
  let resolvedThumbprint: string | null = null;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'starter',
      monthlyRunQuota: 100,
    }),
    resolveProtectedReleaseTokenConfirmation: async ({ context, receivedAt }) => {
      const confirmation =
        await resolveHostedGenericAdmissionDpopSenderConfirmation({
          proofJwt: context.req.header('DPoP') ?? null,
          httpMethod: context.req.method,
          httpUri: context.req.url,
          now: receivedAt,
        });
      resolvedThumbprint = confirmation.confirmation?.jkt ?? null;
      return confirmation.confirmation;
    },
    issueProtectedReleaseToken: ({ envelope, receivedAt, senderConfirmation }) =>
      issueGenericAdmissionProtectedReleaseToken({
        envelope,
        issuer,
        introspectionStore,
        confirmation: senderConfirmation ?? null,
        issuedAt: receivedAt,
      }),
  });
  const response = await app.request(routeUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      DPoP: proof.proofJwt,
    },
    body: JSON.stringify(validAdmissionPayload()),
  });
  const body = await response.json() as {
    protectedReleaseToken: {
      tokenId: string;
      senderConstrained: boolean;
      rawReleaseTokenStored: boolean;
      introspectionAuthorityRegistered: boolean;
    };
    protectedReleaseTokenAuthorization: {
      token: string;
      storeRawTokenInAdmissionOrShadow: boolean;
    };
  };

  equal(response.status, 200, 'Generic admission route: DPoP-confirmed issuer returns 200');
  equal(
    resolvedThumbprint,
    dpop.publicKeyThumbprint,
    'Generic admission route: DPoP proof resolver returns the token cnf jkt',
  );
  equal(
    body.protectedReleaseToken.senderConstrained,
    true,
    'Generic admission route: issued route token is sender-constrained',
  );
  equal(
    body.protectedReleaseToken.introspectionAuthorityRegistered,
    true,
    'Generic admission route: DPoP-confirmed token is registered for online introspection',
  );
  equal(
    introspectionStore.findToken(body.protectedReleaseToken.tokenId)?.status,
    'issued',
    'Generic admission route: DPoP-confirmed token authority state is active',
  );
  equal(
    body.protectedReleaseToken.rawReleaseTokenStored,
    false,
    'Generic admission route: sanitized summary stores no raw token',
  );
  equal(
    JSON.stringify(body).includes(proof.proofJwt),
    false,
    'Generic admission route: response excludes raw DPoP proof JWT',
  );
  equal(
    body.protectedReleaseTokenAuthorization.storeRawTokenInAdmissionOrShadow,
    false,
    'Generic admission route: DPoP-confirmed authorization remains caller-only material',
  );
}

async function testProtectedReleaseTokenIssuerFailsClosedWithoutDpopConfirmation(): Promise<void> {
  const app = new Hono();
  const issuer = releaseTokenIssuerFixture();
  const introspectionStore = createInMemoryReleaseTokenIntrospectionStore();
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
    resolveProtectedReleaseTokenConfirmation: async ({ context, receivedAt }) => {
      const confirmation =
        await resolveHostedGenericAdmissionDpopSenderConfirmation({
          proofJwt: context.req.header('DPoP') ?? null,
          httpMethod: context.req.method,
          httpUri: context.req.url,
          now: receivedAt,
        });
      return confirmation.confirmation;
    },
    issueProtectedReleaseToken: ({ envelope, receivedAt, senderConfirmation }) =>
      issueGenericAdmissionProtectedReleaseToken({
        envelope,
        issuer,
        introspectionStore,
        confirmation: senderConfirmation ?? null,
        issuedAt: receivedAt,
      }),
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  const response = await app.request('https://attestor.test/api/v1/admissions', {
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

  equal(response.status, 503, 'Generic admission route: missing DPoP confirmation returns 503');
  equal(body.decision, 'block', 'Generic admission route: missing DPoP confirmation blocks');
  equal(body.failClosed, true, 'Generic admission route: missing DPoP confirmation fails closed');
  ok(
    body.reasonCodes.includes('protected-release-token-sender-confirmation-required'),
    'Generic admission route: missing DPoP confirmation reason is explicit',
  );
  equal(shadowRecords, 0, 'Generic admission route: missing DPoP confirmation is not shadow recorded');
}

await testEvaluationPlansRejectEnforcingModes();
await testPostAdmissionRouteReturnsEnvelope();
await testTenantMismatchFailsClosedBeforeShadowRecording();
await testLoopGuardUnavailableFailsClosedBeforeShadowRecording();
await testInvalidJsonReturnsFailClosedProblem();
await testInvalidInputReturnsFailClosedProblem();
await testPostAdmissionRouteCarriesRetryAttemptBinding();
await testLoopGuardThrottlesRetryAttemptBeyondBudget();
await testProtectedReleaseTokenIssuerReturnsAuthorizationWithoutRecordingRawToken();
await testProtectedReleaseTokenRequiredFailsClosedWithoutIssuer();
await testProtectedReleaseTokenIssuerUsesRouteResolvedDpopConfirmation();
await testProtectedReleaseTokenIssuerFailsClosedWithoutDpopConfirmation();

console.log(`Generic admission route tests: ${passed} passed, 0 failed`);
