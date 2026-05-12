import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import {
  registerActionSurfaceOnboardingRoutes,
} from '../src/service/http/routes/action-surface-onboarding-routes.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to include: ${expected}`,
  );
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

const tenantA: TenantContext = {
  tenantId: 'tenant_onboarding_a',
  tenantName: 'Onboarding Tenant A',
  authenticatedAt: '2026-05-12T18:00:00.000Z',
  source: 'api_key',
  planId: 'starter',
  monthlyRunQuota: 100,
};

const tenantB: TenantContext = {
  ...tenantA,
  tenantId: 'tenant_onboarding_b',
  tenantName: 'Onboarding Tenant B',
};

function createEvent(tenant: TenantContext): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: '2026-05-12T18:00:00.000Z',
      decidedAt: '2026-05-12T18:00:01.000Z',
      evidenceRefs: ['order:123'],
      policyRef: 'policy:refunds:v1',
    }),
    occurredAt: '2026-05-12T18:00:02.000Z',
  });
}

function createApp(input: {
  readonly routeTenant?: TenantContext;
  readonly events?: readonly ShadowAdmissionEvent[];
} = {}): Hono {
  const app = new Hono();
  const events = input.events ?? [createEvent(tenantA)];
  registerActionSurfaceOnboardingRoutes(app, {
    currentTenant: () => input.routeTenant ?? tenantA,
    listShadowEvents: ({ tenant }) =>
      events.filter((event) => event.tenantId === tenant.tenantId || event.tenantId === null),
    now: () => '2026-05-12T18:01:00.000Z',
  });
  return app;
}

function openApiManifest(): string {
  return JSON.stringify({
    openapi: '3.1.0',
    info: { title: 'Refund API', version: '1.0.0' },
    paths: {
      '/refunds': {
        post: {
          operationId: 'issueRefund',
          description: 'raw_prompt_must_not_escape sk_live_must_not_escape',
          responses: { '200': { description: 'ok' } },
        },
      },
    },
  });
}

async function testHostedRouteRendersStatelessReviewPacket(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/shadow/action-surface/onboarding-packet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      manifests: [
        {
          text: openApiManifest(),
          sourceRef: 'C:/Users/thedi/private/refunds.openapi.json',
          manifestKind: 'openapi',
        },
      ],
      defaultDomain: 'money-movement',
      downstreamSystem: 'refund-service',
      credentialPosture: 'agent-held-static-secret',
    }),
  });
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly storageMode: string;
    readonly rawPayloadStored: boolean;
    readonly productionReady: boolean;
    readonly includedShadowEvents: boolean;
    readonly tenant: { readonly tenantId: string };
    readonly packet: {
      readonly status: string;
      readonly manifestCount: number;
      readonly eventCount: number;
      readonly rawPayloadStored: boolean;
      readonly productionReady: boolean;
      readonly autoEnforce: boolean;
      readonly deploysInfrastructure: boolean;
      readonly activatesEnforcement: boolean;
      readonly surfacePlans: readonly {
        readonly actionSurface: string;
        readonly eventCount: number;
        readonly approvalRequired: boolean;
        readonly productionReady: boolean;
      }[];
    };
  };

  equal(response.status, 200, 'Hosted onboarding route: request succeeds');
  equal(response.headers.get('cache-control'), 'no-store', 'Hosted onboarding route: response is no-store');
  equal(body.tenant.tenantId, tenantA.tenantId, 'Hosted onboarding route: tenant context is returned');
  equal(body.storageMode, 'stateless-review-packet', 'Hosted onboarding route: storage mode is stateless');
  equal(body.rawPayloadStored, false, 'Hosted onboarding route: raw request payload is not stored');
  equal(body.productionReady, false, 'Hosted onboarding route: response does not claim production readiness');
  equal(body.includedShadowEvents, true, 'Hosted onboarding route: tenant shadow events are included by default');
  equal(body.packet.status, 'requires-review', 'Hosted onboarding route: packet requires review');
  equal(body.packet.manifestCount, 1, 'Hosted onboarding route: manifest is consumed');
  equal(body.packet.eventCount, 1, 'Hosted onboarding route: tenant shadow event is consumed');
  equal(body.packet.rawPayloadStored, false, 'Hosted onboarding route: packet raw payload flag is false');
  equal(body.packet.autoEnforce, false, 'Hosted onboarding route: packet cannot auto-enforce');
  equal(body.packet.deploysInfrastructure, false, 'Hosted onboarding route: packet does not deploy infrastructure');
  equal(body.packet.activatesEnforcement, false, 'Hosted onboarding route: packet does not activate enforcement');
  ok(
    body.packet.surfacePlans.some((plan) => plan.actionSurface === 'refund_service.issue_refund'),
    'Hosted onboarding route: manifest-derived surface is present',
  );
  ok(
    body.packet.surfacePlans.some((plan) => plan.eventCount === 1 && plan.approvalRequired),
    'Hosted onboarding route: observed shadow event stays approval-required',
  );
  excludes(text, /raw_prompt_must_not_escape/u, 'Hosted onboarding route: raw OpenAPI descriptions are not emitted');
  excludes(text, /sk_live_must_not_escape/u, 'Hosted onboarding route: secret-like manifest text is not emitted');
  excludes(text, /C:\/Users\/thedi\/private/u, 'Hosted onboarding route: caller source path is not emitted');
}

async function testHostedRouteCanDisableShadowEvents(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/shadow/action-surface/onboarding-packet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      includeShadowEvents: false,
      manifests: [{ text: openApiManifest(), manifestKind: 'openapi' }],
    }),
  });
  const body = await response.json() as {
    readonly includedShadowEvents: boolean;
    readonly packet: { readonly eventCount: number };
  };

  equal(response.status, 200, 'Hosted onboarding route: disabling shadow event inclusion succeeds');
  equal(body.includedShadowEvents, false, 'Hosted onboarding route: shadow event inclusion flag is false');
  equal(body.packet.eventCount, 0, 'Hosted onboarding route: shadow events are omitted when disabled');
}

async function testHostedRouteKeepsTenantScopedShadowEvents(): Promise<void> {
  const app = createApp({
    routeTenant: tenantB,
    events: [createEvent(tenantA), createEvent(tenantB)],
  });
  const response = await app.request('/api/v1/shadow/action-surface/onboarding-packet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ declarations: [] }),
  });
  const body = await response.json() as {
    readonly tenant: { readonly tenantId: string };
    readonly packet: {
      readonly eventCount: number;
      readonly surfacePlans: readonly { readonly actionSurface: string }[];
    };
  };

  equal(response.status, 200, 'Hosted onboarding route: tenant B request succeeds');
  equal(body.tenant.tenantId, tenantB.tenantId, 'Hosted onboarding route: route tenant is tenant B');
  equal(body.packet.eventCount, 1, 'Hosted onboarding route: only tenant B shadow events are included');
  ok(
    body.packet.surfacePlans.length === 1,
    'Hosted onboarding route: cross-tenant shadow events are not present in packet plans',
  );
}

async function testHostedRouteRejectsInvalidInput(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/shadow/action-surface/onboarding-packet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      credentialPosture: 'plaintext-root-secret',
      manifests: [{ text: openApiManifest(), manifestKind: 'openapi' }],
    }),
  });
  const body = await response.json() as {
    readonly decision: string;
    readonly failClosed: boolean;
    readonly reasonCodes: readonly string[];
    readonly detail: string;
  };

  equal(response.status, 400, 'Hosted onboarding route: invalid credential posture returns 400');
  equal(body.decision, 'block', 'Hosted onboarding route: invalid input returns block problem');
  equal(body.failClosed, true, 'Hosted onboarding route: invalid input fails closed');
  ok(
    body.reasonCodes.includes('action-surface-onboarding-render-failed'),
    'Hosted onboarding route: invalid input has stable reason code',
  );
  includes(
    body.detail,
    'credentialPosture',
    'Hosted onboarding route: invalid input explains rejected field',
  );
}

function testDocsAndScriptsExposeHostedRoute(): void {
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  const doc = readProjectFile('docs', '02-architecture', 'action-surface-onboarding-packet.md');
  const readme = readProjectFile('README.md');
  const matrixTest = readProjectFile('tests', 'hosted-api-authorization-matrix.test.ts');

  equal(
    pkg.scripts['test:action-surface-onboarding-packet-route'],
    'tsx tests/action-surface-onboarding-packet-route.test.ts',
    'Hosted onboarding route: package test script is exposed',
  );
  includes(
    doc,
    'POST /api/v1/shadow/action-surface/onboarding-packet',
    'Hosted onboarding route: architecture doc names route',
  );
  includes(
    readme,
    'POST /api/v1/shadow/action-surface/onboarding-packet',
    'Hosted onboarding route: README names route',
  );
  includes(
    matrixTest,
    "['src', 'service', 'http', 'routes', 'action-surface-onboarding-routes.ts']",
    'Hosted onboarding route: authorization matrix inventories route file',
  );
}

try {
  await testHostedRouteRendersStatelessReviewPacket();
  await testHostedRouteCanDisableShadowEvents();
  await testHostedRouteKeepsTenantScopedShadowEvents();
  await testHostedRouteRejectsInvalidInput();
  testDocsAndScriptsExposeHostedRoute();
  console.log(`Action surface onboarding packet route tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface onboarding packet route tests failed:', error);
  process.exitCode = 1;
}
