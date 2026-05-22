import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  registerReleaseReviewRoutes,
  type ReleaseReviewRouteDeps,
} from '../src/service/http/routes/release-review-routes.js';
import { resetReleaseAdminRouteAuthLimiterForTests } from '../src/service/http/release-admin-authorization.js';
import { currentAdminAuthorized } from '../src/service/request-context.js';

function adminHeaders(extra?: Record<string, string>, token = 'admin-secret'): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    ...extra,
  };
}

function createFixture(input: { readonly reviewDetail?: unknown } = {}): Hono {
  resetReleaseAdminRouteAuthLimiterForTests();
  const app = new Hono();
  const deps: ReleaseReviewRouteDeps = {
    currentAdminAuthorized,
    apiReleaseReviewerQueueStore: {
      listPending: async () => ({
        generatedAt: '2026-05-21T00:00:00.000Z',
        totalPending: 0,
        countsByRiskClass: {
          R0: 0,
          R1: 0,
          R2: 0,
          R3: 0,
          R4: 0,
        },
        items: [],
      }),
      get: async () => input.reviewDetail ?? null,
      getRecord: async () => null,
      upsert: async (record: unknown) => record,
    } as never,
    renderReleaseReviewerQueueInboxPage: () => '<html><body>empty</body></html>',
    renderReleaseReviewerQueueDetailPage: () => '<html><body>missing</body></html>',
    financeReleaseDecisionLog: {
      append: async () => undefined,
      entries: async () => [],
      verify: async () => ({ valid: true, latestEntryDigest: null, errors: [] }),
    } as never,
    apiReleaseTokenIssuer: {
      issue: async () => {
        throw new Error('release token issuer should not be reached in auth tests');
      },
    } as never,
    apiReleaseEvidencePackStore: {
      get: async () => null,
      upsert: async () => undefined,
    } as never,
    apiReleaseEvidencePackIssuer: {
      issue: async () => {
        throw new Error('evidence pack issuer should not be reached in auth tests');
      },
    } as never,
    apiReleaseIntrospectionStore: {
      registerIssuedToken: async () => undefined,
    } as never,
    adminMutationRequest: async () => ({
      idempotencyKey: null,
      requestHash: 'test-release-review-auth',
    }),
    finalizeAdminMutation: async (input) => input.responseBody,
  };

  registerReleaseReviewRoutes(app, deps);
  return app;
}

function assertHtmlSecurityHeaders(response: Response, label: string): void {
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${label}: nosniff header is set`);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer', `${label}: referrer policy is set`);
  assert.equal(response.headers.get('x-frame-options'), 'DENY', `${label}: frame denial header is set`);
  assert.match(
    response.headers.get('content-security-policy') ?? '',
    /frame-ancestors 'none'/u,
    `${label}: CSP denies framing`,
  );
}

async function requestJson(
  app: Hono,
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<{ status: number; headers: Headers; body: any }> {
  const response = await app.request(path, {
    method: options?.method ?? 'GET',
    headers: options?.headers ?? adminHeaders(),
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}

async function testReleaseReviewRoleScopedAdminKeys(): Promise<void> {
  const app = createFixture();
  const readList = await requestJson(app, '/api/v1/admin/release-reviews', {
    headers: adminHeaders(undefined, 'admin-read-secret'),
  });
  const readCannotApprove = await requestJson(app, '/api/v1/admin/release-reviews/review_001/approve', {
    method: 'POST',
    headers: adminHeaders({
      'x-attestor-admin-actor-role': 'admin-release-admin',
    }, 'admin-read-secret'),
    body: {
      reviewerId: 'reviewer_001',
      reviewerName: 'Reviewer One',
      reviewerRole: 'release-manager',
    },
  });
  const releaseAdminReachesApprove = await requestJson(
    app,
    '/api/v1/admin/release-reviews/review_001/approve',
    {
      method: 'POST',
      headers: adminHeaders(undefined, 'admin-release-secret'),
      body: {
        reviewerId: 'reviewer_001',
        reviewerName: 'Reviewer One',
        reviewerRole: 'release-manager',
      },
    },
  );
  const releaseAdminCannotOverride = await requestJson(
    app,
    '/api/v1/admin/release-reviews/review_001/override',
    {
      method: 'POST',
      headers: adminHeaders({
        'x-attestor-admin-actor-role': 'policy-break-glass',
      }, 'admin-release-secret'),
      body: {
        reasonCode: 'break-glass-test',
        requestedById: 'release_admin',
        requestedByName: 'Release Admin',
      },
    },
  );
  const breakGlassReachesOverride = await requestJson(
    app,
    '/api/v1/admin/release-reviews/review_001/override',
    {
      method: 'POST',
      headers: adminHeaders({
        'x-attestor-admin-actor-role': 'policy-break-glass',
      }, 'admin-break-glass-secret'),
      body: {
        reasonCode: 'break-glass-test',
        requestedById: 'incident_commander',
        requestedByName: 'Incident Commander',
      },
    },
  );

  assert.equal(readList.status, 200);
  assert.equal(readCannotApprove.status, 403);
  assert.equal(
    readCannotApprove.body.error,
    'Admin actor role does not match the role-scoped admin API key.',
  );
  assert.equal(releaseAdminReachesApprove.status, 404);
  assert.equal(releaseAdminCannotOverride.status, 403);
  assert.equal(
    releaseAdminCannotOverride.body.error,
    "Admin actor role 'admin-release-admin' is not allowed for this route.",
  );
  assert.equal(breakGlassReachesOverride.status, 404);
}

async function testReleaseReviewHtmlRoutesCarrySecurityHeaders(): Promise<void> {
  const app = createFixture({ reviewDetail: { id: 'review_001' } });
  const inbox = await app.request('/api/v1/admin/release-reviews/inbox', {
    headers: adminHeaders(undefined, 'admin-read-secret'),
  });
  const detail = await app.request('/api/v1/admin/release-reviews/review_001/view', {
    headers: adminHeaders(undefined, 'admin-read-secret'),
  });

  assert.equal(inbox.status, 200);
  assert.equal(detail.status, 200);
  assertHtmlSecurityHeaders(inbox, 'Release review inbox HTML');
  assertHtmlSecurityHeaders(detail, 'Release review detail HTML');
}

async function run(): Promise<void> {
  const originalAdminApiKey = process.env.ATTESTOR_ADMIN_API_KEY;
  const originalAdminReadApiKey = process.env.ATTESTOR_ADMIN_READ_API_KEY;
  const originalAdminReleaseApiKey = process.env.ATTESTOR_ADMIN_RELEASE_API_KEY;
  const originalAdminBreakGlassApiKey = process.env.ATTESTOR_ADMIN_BREAK_GLASS_API_KEY;
  const originalAdminRateLimit = process.env.ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE;
  process.env.ATTESTOR_ADMIN_API_KEY = 'admin-secret';
  process.env.ATTESTOR_ADMIN_READ_API_KEY = 'admin-read-secret';
  process.env.ATTESTOR_ADMIN_RELEASE_API_KEY = 'admin-release-secret';
  process.env.ATTESTOR_ADMIN_BREAK_GLASS_API_KEY = 'admin-break-glass-secret';
  process.env.ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE = '10000';

  try {
    await testReleaseReviewRoleScopedAdminKeys();
    await testReleaseReviewHtmlRoutesCarrySecurityHeaders();
    console.log('Release review admin-route tests: 2 passed, 0 failed');
  } finally {
    process.env.ATTESTOR_ADMIN_API_KEY = originalAdminApiKey;
    process.env.ATTESTOR_ADMIN_READ_API_KEY = originalAdminReadApiKey;
    process.env.ATTESTOR_ADMIN_RELEASE_API_KEY = originalAdminReleaseApiKey;
    process.env.ATTESTOR_ADMIN_BREAK_GLASS_API_KEY = originalAdminBreakGlassApiKey;
    process.env.ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE = originalAdminRateLimit;
  }
}

await run();
