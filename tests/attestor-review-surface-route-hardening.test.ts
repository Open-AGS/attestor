import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import { registerShadowRoutes } from '../src/service/http/routes/shadow-routes.js';
import {
  ATTESTOR_REVIEW_SURFACE_HOSTED_ROUTES,
  ATTESTOR_REVIEW_SURFACE_ROUTE_HARDENING_VERSION,
  attestorReviewSurfaceRouteHardeningDescriptor,
} from '../src/service/shadow/attestor-review-surface-route-hardening.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function createEvent(input?: {
  readonly mode?: 'observe' | 'warn' | 'review' | 'enforce';
  readonly blocked?: boolean;
  readonly occurredAt?: string;
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: input?.mode ?? 'observe',
      tenantId: 'tenant_review_surface_hardening',
      environment: 'sandbox',
      actor: 'support-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: '2026-05-31T14:00:00.000Z',
      decidedAt: '2026-05-31T14:00:01.000Z',
      recipient: 'raw_hardening_recipient_must_not_escape',
      policyRef: input?.blocked ? 'policy:refunds:v1' : null,
      evidenceRefs: ['evidence:hardening_raw_must_not_escape'],
      observedFeatures: {
        rawMarker: 'raw_hardening_feature_must_not_escape',
      },
    }),
    occurredAt: input?.occurredAt ?? '2026-05-31T14:01:00.000Z',
    downstreamOutcome: input?.blocked ? 'blocked' : 'proceeded',
    humanOutcome: input?.blocked ? 'rejected' : 'not-reviewed',
  });
}

function createApp(): Hono {
  const events = [
    createEvent(),
    createEvent({
      mode: 'enforce',
      blocked: true,
      occurredAt: '2026-05-31T14:02:00.000Z',
    }),
  ];
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_review_surface_hardening',
      tenantName: 'Review Surface Hardening Tenant',
      authenticatedAt: '2026-05-31T14:00:00.000Z',
      source: 'api_key',
      planId: 'trial',
      monthlyRunQuota: 100,
    }),
    listShadowEvents: ({ tenant }) =>
      tenant.tenantId === 'tenant_review_surface_hardening' ? events : [],
    listShadowSimulations: () => [],
    now: () => '2026-05-31T14:05:00.000Z',
  });
  return app;
}

function testDescriptorPinsHostedRouteBoundaries(): void {
  const descriptor = attestorReviewSurfaceRouteHardeningDescriptor();
  const routePaths = descriptor.routes.map((route) => route.path);

  equal(
    descriptor.version,
    ATTESTOR_REVIEW_SURFACE_ROUTE_HARDENING_VERSION,
    'Review surface route hardening: version is stable',
  );
  equal(descriptor.routeCount, 4, 'Review surface route hardening: four hosted review routes are tracked');
  deepEqual(
    routePaths,
    [
      '/api/v1/shadow/review-surface',
      '/api/v1/shadow/review-surface/view',
      '/api/v1/shadow/review-surface/export',
      '/api/v1/shadow/review-surface/cases/:caseDigest',
    ],
    'Review surface route hardening: route inventory is stable',
  );
  for (const route of descriptor.routes) {
    equal(route.method, 'GET', `Review surface route hardening: ${route.path} is read-only`);
    equal(route.cacheControl, 'no-store', `Review surface route hardening: ${route.path} is no-store`);
    equal(route.sourceSurfaceOnly, true, `Review surface route hardening: ${route.path} reads review material only`);
    equal(route.rawPayloadStored, false, `Review surface route hardening: ${route.path} stores no raw payload`);
    equal(route.decisionSupportOnly, true, `Review surface route hardening: ${route.path} is decision support only`);
    equal(route.autoEnforce, false, `Review surface route hardening: ${route.path} never auto-enforces`);
    equal(route.productionReady, false, `Review surface route hardening: ${route.path} claims no production readiness`);
    equal(route.complianceClaimed, false, `Review surface route hardening: ${route.path} claims no compliance`);
  }
  ok(
    descriptor.prohibitedRawClasses.includes('raw-provider-bodies'),
    'Review surface route hardening: provider bodies remain prohibited',
  );
  ok(
    descriptor.sourceAnchors.includes('RFC 9111 Cache-Control no-store'),
    'Review surface route hardening: no-store source anchor is recorded',
  );
  equal(descriptor.authorityBoundary.canAdmit, false, 'Review surface route hardening: cannot admit');
  equal(descriptor.authorityBoundary.canBlockAction, false, 'Review surface route hardening: cannot block by itself');
  equal(descriptor.authorityBoundary.canGrantAuthority, false, 'Review surface route hardening: cannot grant authority');
  equal(descriptor.authorityBoundary.canReduceEvidenceRequirements, false, 'Review surface route hardening: cannot reduce evidence');
  equal(descriptor.authorityBoundary.canActivateEnforcement, false, 'Review surface route hardening: cannot activate enforcement');
  equal(descriptor.rawCaseMaterialStored, false, 'Review surface route hardening: raw case material storage is false');
  equal(descriptor.customerPepNoBypassProven, false, 'Review surface route hardening: customer PEP proof is not claimed');
  equal(descriptor.hostedUiProductReady, false, 'Review surface route hardening: hosted UI product readiness is not claimed');
}

async function testDescriptorMatchesHostedRuntimeHeaders(): Promise<void> {
  const app = createApp();
  const surfaceResponse = await app.request('/api/v1/shadow/review-surface');
  const surfaceBody = await surfaceResponse.json() as {
    readonly reviewSurface: { readonly caseDigests: readonly string[] };
  };
  const caseDigest = surfaceBody.reviewSurface.caseDigests[0] ?? '';
  const routePaths = {
    '/api/v1/shadow/review-surface': '/api/v1/shadow/review-surface',
    '/api/v1/shadow/review-surface/view': '/api/v1/shadow/review-surface/view',
    '/api/v1/shadow/review-surface/export': '/api/v1/shadow/review-surface/export',
    '/api/v1/shadow/review-surface/cases/:caseDigest':
      `/api/v1/shadow/review-surface/cases/${encodeURIComponent(caseDigest)}`,
  } as const;

  for (const route of ATTESTOR_REVIEW_SURFACE_HOSTED_ROUTES) {
    const response = await app.request(routePaths[route.path]);
    const text = await response.text();

    equal(response.status, 200, `Review surface route hardening: ${route.path} returns 200`);
    equal(response.headers.get('cache-control'), 'no-store', `Review surface route hardening: ${route.path} is no-store`);
    for (const header of route.requiredHeaders) {
      ok(response.headers.has(header), `Review surface route hardening: ${route.path} emits ${header}`);
    }
    ok(!text.includes('raw_hardening_recipient_must_not_escape'), `Review surface route hardening: ${route.path} hides raw recipient`);
    ok(!text.includes('raw_hardening_feature_must_not_escape'), `Review surface route hardening: ${route.path} hides raw feature`);
    ok(!text.includes('hardening_raw_must_not_escape'), `Review surface route hardening: ${route.path} hides raw evidence refs`);

    if (route.kind === 'json-review-surface') {
      const body = JSON.parse(text) as {
        readonly reviewSurface: unknown;
      };
      ok(
        !JSON.stringify(body.reviewSurface).includes('tenant_review_surface_hardening'),
        'Review surface route hardening: review surface payload hides raw tenant id',
      );
    }
    if (route.kind === 'html-preview') {
      ok(
        response.headers.get('content-type')?.includes('text/html'),
        'Review surface route hardening: HTML preview content type is HTML',
      );
      ok(
        response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"),
        'Review surface route hardening: HTML preview denies framing',
      );
    }
    if (route.kind === 'json-export') {
      ok(
        response.headers.get('content-type')?.includes('application/json'),
        'Review surface route hardening: export content type is JSON',
      );
      equal(
        response.headers.get('content-disposition'),
        'attachment; filename="attestor-review-surface-export.json"',
        'Review surface route hardening: export is an attachment',
      );
    }
  }
}

function testDocsAndScriptsNameHardeningGuard(): void {
  const docs = readProjectFile('docs', '02-architecture', 'attestor-review-surface-contract.md');
  const shadowRoutesDoc = readProjectFile('docs', '02-architecture', 'shadow-summary-routes.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    docs,
    'attestor.review-surface-route-hardening.v1',
    'Review surface route hardening docs: descriptor version is named',
  );
  includes(
    docs,
    'src/service/shadow/attestor-review-surface-route-hardening.ts',
    'Review surface route hardening docs: source file is named',
  );
  includes(
    shadowRoutesDoc,
    'route-hardening descriptor',
    'Shadow summary docs: route hardening guard is named',
  );
  equal(
    pkg.scripts['test:attestor-review-surface-route-hardening'],
    'tsx tests/attestor-review-surface-route-hardening.test.ts',
    'Package: route hardening test is exposed',
  );
}

testDescriptorPinsHostedRouteBoundaries();
await testDescriptorMatchesHostedRuntimeHeaders();
testDocsAndScriptsNameHardeningGuard();

ok(passed > 0, 'Attestor review surface route hardening tests executed');
console.log(`Attestor review surface route hardening tests: ${passed} passed, 0 failed`);
