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
      authoritySources: trustedAuthoritySources(),
      approvals: trustedApprovals(),
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

export async function runPlanEnvelopeTests(): Promise<void> {
  await testEvaluationPlansRejectEnforcingModes();
  await testPostAdmissionRouteReturnsEnvelope();
}
