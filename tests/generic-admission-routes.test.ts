import assert from 'node:assert/strict';
import { Hono } from 'hono';
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

await testPostAdmissionRouteReturnsEnvelope();
await testInvalidJsonReturnsFailClosedProblem();
await testInvalidInputReturnsFailClosedProblem();

console.log(`Generic admission route tests: ${passed} passed, 0 failed`);
