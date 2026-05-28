import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { createServer as createTcpServer } from 'node:net';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import {
  registerPolicyFoundryHostedOnboardingRoutes,
} from '../src/service/http/routes/policy-foundry-hosted-onboarding-routes.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';
import {
  runPolicyFoundryProductionSmokeProbe,
} from '../scripts/probe/probe-policy-foundry-production-smoke.ts';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function reservePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createTcpServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to reserve TCP port.'));
        return;
      }
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

const tenant: TenantContext = {
  tenantId: 'tenant_policy_foundry_smoke',
  tenantName: 'Policy Foundry Smoke Tenant',
  authenticatedAt: '2026-05-13T12:00:00.000Z',
  source: 'api_key',
  planId: 'starter',
  monthlyRunQuota: 100,
};

function createEvent(): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: '2026-05-13T12:00:00.000Z',
      decidedAt: '2026-05-13T12:00:01.000Z',
      evidenceRefs: ['order:123'],
      policyRef: 'policy:refunds:v1',
    }),
    occurredAt: '2026-05-13T12:00:02.000Z',
  });
}

function createSmokeApp(apiKey: string): Hono {
  const app = new Hono();
  const events = [createEvent()];

  app.get('/api/v1/health', (c) => {
    c.header('cache-control', 'no-store');
    return c.json({ status: 'ok', productionReady: false });
  });
  app.get('/api/v1/ready', (c) => {
    c.header('cache-control', 'no-store');
    return c.json({ ready: true, productionReady: false });
  });
  app.use('/api/v1/shadow/*', async (c, next) => {
    if (c.req.header('authorization') !== `Bearer ${apiKey}`) {
      return c.text('unauthorized', 401);
    }
    await next();
  });
  registerPolicyFoundryHostedOnboardingRoutes(app, {
    currentTenant: () => tenant,
    listShadowEvents: ({ tenant: routeTenant }) =>
      events.filter((event) => event.tenantId === routeTenant.tenantId),
    now: () => '2026-05-13T12:01:00.000Z',
  });

  return app;
}

async function closeServer(server: ReturnType<typeof serve>): Promise<void> {
  const maybeClosable = server as { close?: (callback?: () => void) => void };
  if (typeof maybeClosable.close !== 'function') return;
  await new Promise<void>((resolveClose) => maybeClosable.close?.(() => resolveClose()));
}

async function testProductionSmokeProbeUsesHostedRoutesSafely(): Promise<void> {
  const apiKey = 'smoke-api-key-secret';
  const port = await reservePort();
  const server = serve({
    fetch: createSmokeApp(apiKey).fetch,
    port,
  });

  try {
    const result = await runPolicyFoundryProductionSmokeProbe({
      baseUrl: `http://127.0.0.1:${port}`,
      apiKey,
    });
    const serialized = JSON.stringify(result);

    equal(result.healthStatus, 200, 'Policy Foundry production smoke: health endpoint passes');
    equal(result.readinessStatus, 200, 'Policy Foundry production smoke: readiness endpoint passes');
    ok(
      result.initialWorkflowDigest.startsWith('sha256:'),
      'Policy Foundry production smoke: initial workflow digest is captured',
    );
    ok(
      result.liveReplayDigest.startsWith('sha256:'),
      'Policy Foundry production smoke: live replay digest is captured',
    );
    equal(result.failedReplayBlocked, true, 'Policy Foundry production smoke: failed live replay blocks rollout');
    equal(result.reviewSurfaceEvidenceBound, true, 'Policy Foundry production smoke: review surface binds live evidence');
    equal(result.hostedViewRendered, true, 'Policy Foundry production smoke: hosted view route renders');
    equal(result.productionReadyClaimed, false, 'Policy Foundry production smoke: result does not claim production readiness');
    equal(result.executesProductionTraffic, false, 'Policy Foundry production smoke: result does not execute production traffic');
    equal(
      serialized.includes(apiKey),
      false,
      'Policy Foundry production smoke: result does not include the API key',
    );
    equal(
      serialized.includes('127.0.0.1'),
      false,
      'Policy Foundry production smoke: result digests the base URL instead of printing it',
    );
    ok(
      typeof result.baseUrlRef === 'string' && /^base-url:[a-f0-9]{24}$/u.test(result.baseUrlRef),
      'Policy Foundry production smoke: base URL digest reference is stable and truncated',
    );
  } finally {
    await closeServer(server);
  }
}

await testProductionSmokeProbeUsesHostedRoutesSafely();

ok(passed > 0, 'Policy Foundry production smoke probe tests executed');
console.log(`Policy Foundry production smoke probe tests: ${passed} passed, 0 failed`);
