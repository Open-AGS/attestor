import assert from 'node:assert/strict';
import { Hono, type Context } from 'hono';
import {
  registerAdminRoutes,
  resetAdminRouteAuthLimiterForTests,
  type AdminRouteDeps,
} from '../src/service/http/routes/admin-routes.js';

type CapturedAudit = {
  actor?: {
    actorType: string;
    actorLabel: string;
    actorRole?: string | null;
  };
};

function bearerToken(c: Context): string {
  return (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
}

function testDeps(options: {
  readonly authChecks?: { count: number };
  readonly capturedAudit?: CapturedAudit;
  readonly hostedAccounts?: readonly Record<string, unknown>[];
} = {}): AdminRouteDeps {
  const configuredKeys = () => new Set([
    process.env.ATTESTOR_ADMIN_API_KEY?.trim(),
    process.env.ATTESTOR_ADMIN_READ_API_KEY?.trim(),
    process.env.ATTESTOR_ADMIN_ACCOUNT_API_KEY?.trim(),
    process.env.ATTESTOR_ADMIN_TENANT_KEY_API_KEY?.trim(),
  ].filter((value): value is string => Boolean(value)));

  return {
    currentAdminAuthorized(c: Context): Response | null {
      if (options.authChecks) options.authChecks.count += 1;
      return configuredKeys().has(bearerToken(c))
        ? null
        : c.json({ error: 'Valid admin API key required in Authorization header.' }, 401);
    },
    adminMutationService: {
      async begin() {
        return {
          kind: 'ready',
          idempotencyKey: null,
          requestHash: 'hash-admin-route-http-test',
        };
      },
      async finalize(input) {
        if (options.capturedAudit) {
          options.capturedAudit.actor = input.actor;
        }
        return input.responseBody;
      },
    },
    adminControlService: {
      async provisionHostedAccount(input) {
        return {
          account: {
            id: 'acct_route_http',
            accountName: input.accountName,
            contactEmail: input.contactEmail,
            primaryTenantId: input.tenantId,
          },
          initialKey: {
            id: 'key_route_http',
            tenantId: input.tenantId,
            tenantName: input.tenantName,
            planId: input.planId,
            monthlyRunQuota: input.monthlyRunQuota,
          },
          apiKey: 'redacted-test-api-key',
          entitlement: {},
        };
      },
    },
    adminQueryService: {
      async listHostedAccounts() {
        return { records: options.hostedAccounts ?? [], path: null };
      },
    },
    adminAccountView(record: Record<string, unknown>) {
      return { id: record.id, accountName: record.accountName };
    },
    adminTenantKeyView(record: Record<string, unknown>) {
      return { id: record.id, tenantId: record.tenantId };
    },
    DEFAULT_HOSTED_PLAN_ID: 'trial',
  } as unknown as AdminRouteDeps;
}

function setEnv(overrides: Record<string, string | undefined>): () => void {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(overrides)) {
    previous.set(key, process.env[key]);
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

async function requestJson(app: Hono, path: string, options: RequestInit): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const response = await app.request(path, options);
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

async function testRoleScopedAccountKeyCanCreateAccountAndAuditsActor(): Promise<void> {
  resetAdminRouteAuthLimiterForTests();
  const restore = setEnv({
    ATTESTOR_ADMIN_API_KEY: undefined,
    ATTESTOR_ADMIN_ACCOUNT_API_KEY: 'account-admin-key',
    ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE: '20',
  });
  try {
    const capturedAudit: CapturedAudit = {};
    const app = new Hono();
    registerAdminRoutes(app, testDeps({ capturedAudit }));

    const result = await requestJson(app, '/api/v1/admin/accounts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer account-admin-key',
        'content-type': 'application/json',
        'x-attestor-admin-actor-id': 'operator:account-admin',
        'x-attestor-admin-actor-name': 'Account Admin',
      },
      body: JSON.stringify({
        accountName: 'Acme',
        contactEmail: 'ops@example.test',
        tenantId: 'tenant-acme',
        tenantName: 'Acme Tenant',
      }),
    });

    assert.equal(result.status, 201);
    assert.equal(capturedAudit.actor?.actorType, 'admin_operator');
    assert.equal(capturedAudit.actor?.actorLabel, 'admin-credential:admin-account-admin');
    assert.equal(capturedAudit.actor?.actorRole, 'admin-account-admin');
  } finally {
    restore();
    resetAdminRouteAuthLimiterForTests();
  }
}

async function testReadKeyCannotMutateTenantKeys(): Promise<void> {
  resetAdminRouteAuthLimiterForTests();
  const restore = setEnv({
    ATTESTOR_ADMIN_API_KEY: undefined,
    ATTESTOR_ADMIN_READ_API_KEY: 'read-key',
    ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE: '20',
  });
  try {
    const app = new Hono();
    registerAdminRoutes(app, testDeps());

    const result = await requestJson(app, '/api/v1/admin/tenant-keys/key_123/rotate', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer read-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    assert.equal(result.status, 403);
    assert.match(String(result.body.error), /not allowed/u);
  } finally {
    restore();
    resetAdminRouteAuthLimiterForTests();
  }
}

async function testAdminRateLimitRunsBeforeAuthCheck(): Promise<void> {
  resetAdminRouteAuthLimiterForTests();
  const authChecks = { count: 0 };
  const restore = setEnv({
    ATTESTOR_ADMIN_API_KEY: 'admin-key',
    ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE: '2',
  });
  try {
    const app = new Hono();
    registerAdminRoutes(app, testDeps({ authChecks }));

    const request = () => app.request('/api/v1/admin/accounts', {
      headers: { Authorization: 'Bearer wrong-key' },
    });
    const first = await request();
    const second = await request();
    const third = await request();

    assert.equal(first.status, 401);
    assert.equal(second.status, 401);
    assert.equal(third.status, 429);
    assert.equal(authChecks.count, 2);
  } finally {
    restore();
    resetAdminRouteAuthLimiterForTests();
  }
}

async function testAdminPostRequiresJsonContentType(): Promise<void> {
  resetAdminRouteAuthLimiterForTests();
  const restore = setEnv({
    ATTESTOR_ADMIN_API_KEY: 'admin-key',
    ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE: '20',
  });
  try {
    const app = new Hono();
    registerAdminRoutes(app, testDeps());

    const result = await requestJson(app, '/api/v1/admin/accounts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-key',
      },
      body: JSON.stringify({}),
    });

    assert.equal(result.status, 415);
    assert.match(String(result.body.error), /Content-Type: application\/json/u);
  } finally {
    restore();
    resetAdminRouteAuthLimiterForTests();
  }
}

async function testAdminListRoutesApplyDefaultLimit(): Promise<void> {
  resetAdminRouteAuthLimiterForTests();
  const restore = setEnv({
    ATTESTOR_ADMIN_API_KEY: 'admin-key',
    ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE: '20',
  });
  try {
    const app = new Hono();
    const hostedAccounts = Array.from({ length: 105 }, (_, index) => ({
      id: `acct_${index}`,
      accountName: `Account ${index}`,
    }));
    registerAdminRoutes(app, testDeps({ hostedAccounts }));

    const result = await requestJson(app, '/api/v1/admin/accounts', {
      headers: {
        Authorization: 'Bearer admin-key',
      },
    });

    assert.equal(result.status, 200);
    assert.equal((result.body.accounts as unknown[]).length, 100);
    assert.deepEqual(result.body.pagination, {
      limit: 100,
      returned: 100,
      truncated: true,
    });
  } finally {
    restore();
    resetAdminRouteAuthLimiterForTests();
  }
}

await testRoleScopedAccountKeyCanCreateAccountAndAuditsActor();
await testReadKeyCannotMutateTenantKeys();
await testAdminRateLimitRunsBeforeAuthCheck();
await testAdminPostRequiresJsonContentType();
await testAdminListRoutesApplyDefaultLimit();

console.log('Service admin routes HTTP tests: 5 passed, 0 failed');
