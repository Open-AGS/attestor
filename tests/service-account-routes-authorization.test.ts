import assert from 'node:assert/strict';
import { Hono, type Context } from 'hono';
import {
  registerAccountRoutes,
  type AccountMutationAuditInput,
  type AccountRouteDeps,
} from '../src/service/http/routes/account-routes.js';
import { resetAuthAbuseGuardForTests } from '../src/service/auth-abuse-guard.js';
import type { AccountAccessContext } from '../src/service/tenant-isolation.js';

const accountAccess: AccountAccessContext = {
  accountId: 'acct_route_authz',
  accountUserId: 'ausr_route_authz',
  role: 'account_admin',
  sessionId: 'sess_route_authz',
  sessionTransport: 'header',
  source: 'account_session',
};

function withEnv(overrides: Record<string, string | undefined>): () => void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
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

function testDeps(options: {
  readonly auditInputs?: AccountMutationAuditInput[];
  readonly completeOidcCalls?: { count: number };
  readonly completeSamlCalls?: { count: number };
} = {}): AccountRouteDeps {
  return {
    requireAccountSession: () => null,
    currentAccountAccess: () => accountAccess,
    apiKeyService: {
      async issue() {
        return {
          record: {
            id: 'tkey_route_authz',
            tenantId: 'tenant_route_authz',
            tenantName: 'Route Authz',
            planId: 'pro',
            monthlyRunQuota: 500,
            status: 'active',
          },
          apiKey: 'atk_redacted_for_test',
          entitlement: null,
        };
      },
    },
    accountApiKeyView: (record: Record<string, unknown>) => ({
      id: record.id,
      tenantId: record.tenantId,
      planId: record.planId,
      status: record.status,
    }),
    async recordAccountMutationAudit(input) {
      options.auditInputs?.push(input);
    },
    async completeHostedOidcAuthorization() {
      if (options.completeOidcCalls) options.completeOidcCalls.count += 1;
      throw new Error('OIDC callback rejected for test');
    },
    async completeHostedSamlAuthorization() {
      if (options.completeSamlCalls) options.completeSamlCalls.count += 1;
      throw new Error('SAML callback rejected for test');
    },
  } as unknown as AccountRouteDeps;
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

async function testAccountApiKeyIssueWritesAccountSessionAudit(): Promise<void> {
  const auditInputs: AccountMutationAuditInput[] = [];
  const app = new Hono();
  registerAccountRoutes(app, testDeps({ auditInputs }));

  const response = await app.request('/api/v1/account/api-keys', {
    method: 'POST',
    headers: {
      'x-attestor-account-session': 'session-token',
    },
  });
  const body = await json(response);

  assert.equal(response.status, 201);
  assert.equal((body.key as Record<string, unknown>).id, 'tkey_route_authz');
  assert.equal(auditInputs.length, 1);
  assert.equal(auditInputs[0]?.routeId, 'account.api_keys.issue');
  assert.equal(auditInputs[0]?.action, 'account.api_key.issued');
  assert.equal(auditInputs[0]?.access.accountUserId, 'ausr_route_authz');
  assert.equal(auditInputs[0]?.tenantKeyId, 'tkey_route_authz');
}

async function testOidcCallbackRateLimitRunsBeforeCrypto(): Promise<void> {
  resetAuthAbuseGuardForTests();
  const restore = withEnv({
    ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_EMAIL: '1',
    ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_SOURCE: '1',
    ATTESTOR_AUTH_RATE_LIMIT_WINDOW_SECONDS: '60',
    ATTESTOR_AUTH_RATE_LIMIT_LOCKOUT_SECONDS: '60',
    ATTESTOR_HA_MODE: undefined,
    ATTESTOR_AUTH_RATE_LIMIT_REQUIRE_SHARED: undefined,
  });
  try {
    const completeOidcCalls = { count: 0 };
    const app = new Hono();
    registerAccountRoutes(app, testDeps({ completeOidcCalls }));

    const first = await app.request('/api/v1/auth/oidc/callback?code=bad&state=bad');
    const second = await app.request('/api/v1/auth/oidc/callback?code=bad&state=bad');

    assert.equal(first.status, 400);
    assert.equal(second.status, 429);
    assert.equal(completeOidcCalls.count, 1);
  } finally {
    restore();
    resetAuthAbuseGuardForTests();
  }
}

async function testSamlCallbackRateLimitRunsBeforeCrypto(): Promise<void> {
  resetAuthAbuseGuardForTests();
  const restore = withEnv({
    ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_EMAIL: '1',
    ATTESTOR_AUTH_RATE_LIMIT_MAX_FAILURES_PER_SOURCE: '1',
    ATTESTOR_AUTH_RATE_LIMIT_WINDOW_SECONDS: '60',
    ATTESTOR_AUTH_RATE_LIMIT_LOCKOUT_SECONDS: '60',
    ATTESTOR_HA_MODE: undefined,
    ATTESTOR_AUTH_RATE_LIMIT_REQUIRE_SHARED: undefined,
  });
  try {
    const completeSamlCalls = { count: 0 };
    const app = new Hono();
    registerAccountRoutes(app, testDeps({ completeSamlCalls }));
    const body = new URLSearchParams({
      SAMLResponse: 'bad-response',
      RelayState: 'bad-state',
    });

    const first = await app.request('/api/v1/auth/saml/acs', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const second = await app.request('/api/v1/auth/saml/acs', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    assert.equal(first.status, 400);
    assert.equal(second.status, 429);
    assert.equal(completeSamlCalls.count, 1);
  } finally {
    restore();
    resetAuthAbuseGuardForTests();
  }
}

await testAccountApiKeyIssueWritesAccountSessionAudit();
await testOidcCallbackRateLimitRunsBeforeCrypto();
await testSamlCallbackRateLimitRunsBeforeCrypto();

console.log('Service account routes authorization tests: 3 passed, 0 failed');
