import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono, type Context } from 'hono';
import {
  registerAccountRoutes,
  type AccountMutationAuditInput,
  type AccountRouteDeps,
} from '../src/service/http/routes/account-routes.js';
import { createPipelineIdempotencyService } from '../src/service/application/pipeline-idempotency-service.js';
import type { PipelineIdempotencyService } from '../src/service/application/pipeline-idempotency-service.js';
import { resetAuthAbuseGuardForTests } from '../src/service/account/auth-abuse-guard.js';
import {
  ensurePipelineIdempotencyStateReady,
  lookupPipelineIdempotencyState,
  recordPipelineIdempotencyState,
} from '../src/service/control-plane-store.js';
import { hashJsonValue } from '../src/service/json-stable.js';
import { resetPipelineIdempotencyStoreForTests } from '../src/service/pipeline/pipeline-idempotency-store.js';
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
  readonly accountMutationIdempotencyService?: PipelineIdempotencyService;
  readonly issueApiKeyCalls?: { count: number };
  readonly createUserCalls?: { count: number };
  readonly completeOidcCalls?: { count: number };
  readonly completeSamlCalls?: { count: number };
} = {}): AccountRouteDeps {
  return {
    requireAccountSession: () => null,
    currentAccountAccess: () => accountAccess,
    apiKeyService: {
      async issue() {
        if (options.issueApiKeyCalls) options.issueApiKeyCalls.count += 1;
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
    userManagementService: {
      async createUser(input: { readonly email: string; readonly displayName: string; readonly role: string }) {
        if (options.createUserCalls) options.createUserCalls.count += 1;
        return {
          id: `ausr_${options.createUserCalls?.count ?? 1}`,
          accountId: accountAccess.accountId,
          email: input.email,
          displayName: input.displayName,
          role: input.role,
          status: 'active',
        };
      },
    },
    accountMutationIdempotencyService: options.accountMutationIdempotencyService,
    accountUserView: (record: Record<string, unknown>) => ({
      id: record.id,
      email: record.email,
      displayName: record.displayName,
      role: record.role,
      status: record.status,
    }),
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

function withPipelineIdempotencyEnv(): () => void {
  const restore = withEnv({
    ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY: 'account-mutation-idempotency-test-key',
    ATTESTOR_PIPELINE_IDEMPOTENCY_STORE_PATH: join(
      tmpdir(),
      `attestor-account-mutation-idempotency-${randomUUID()}.json`,
    ),
    ATTESTOR_CONTROL_PLANE_DATABASE_URL: undefined,
  });
  resetPipelineIdempotencyStoreForTests();
  return () => {
    restore();
    resetPipelineIdempotencyStoreForTests();
  };
}

function pipelineIdempotencyService(): PipelineIdempotencyService {
  return createPipelineIdempotencyService({
    hashJsonValue,
    ensurePipelineIdempotencyStateReady,
    lookupPipelineIdempotencyState,
    recordPipelineIdempotencyState,
  });
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

async function testAccountJsonRoutesRejectNonJsonMediaType(): Promise<void> {
  const app = new Hono();
  registerAccountRoutes(app, testDeps());

  const response = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'text/plain',
    },
    body: 'email=ops@example.com&password=secret',
  });
  const body = await json(response);

  assert.equal(response.status, 415);
  assert.equal(body.error, 'Content-Type must be application/json.');
}

async function testAccountJsonRoutesRejectMalformedJson(): Promise<void> {
  const app = new Hono();
  registerAccountRoutes(app, testDeps());

  const response = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: '{',
  });
  const body = await json(response);

  assert.equal(response.status, 400);
  assert.equal(body.error, 'Request body must be valid JSON.');
}

async function testAccountRouteJsonAndAuthAttemptVocabularyIsLocked(): Promise<void> {
  const routeFiles = [
    '../src/service/http/routes/account-routes.ts',
    '../src/service/http/routes/account-admin-user-routes.ts',
    '../src/service/http/routes/account-billing-routes.ts',
    '../src/service/http/routes/account-federated-auth-routes.ts',
    '../src/service/http/routes/account-mfa-passkey-routes.ts',
    '../src/service/http/routes/account-public-auth-routes.ts',
  ];
  const source = routeFiles
    .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
    .join('\n');
  const mfaPasskeySource = readFileSync(
    new URL('../src/service/http/routes/account-mfa-passkey-routes.ts', import.meta.url),
    'utf8',
  );
  const helper = readFileSync(new URL('../src/service/http/routes/account-route-helpers.ts', import.meta.url), 'utf8');

  assert.equal(source.includes('.json().catch(() => ({}))'), false);
  assert.equal(source.includes("from './account-route-helpers.js';"), true);
  assert.equal(helper.includes('export type AuthAttemptKind ='), true);
  assert.equal(helper.includes('AUTH_ATTEMPT_KIND'), true);
  assert.equal(helper.includes('acceptsJsonRequestBody'), true);
  assert.equal(
    mfaPasskeySource.includes("return c.json({ error: 'Passkey authentication challenge has already been used.' }, 409);"),
    true,
  );
  assert.equal(
    mfaPasskeySource.includes("return c.json({ error: 'MFA challenge has already been used.' }, 409);"),
    true,
  );
  assert.equal(
    mfaPasskeySource.includes("return c.json({ error: 'Passkey registration challenge has already been used.' }, 409);"),
    true,
  );
}

async function testAccountApiKeyIssueReplaysWithIdempotencyKey(): Promise<void> {
  const restore = withPipelineIdempotencyEnv();
  try {
    const auditInputs: AccountMutationAuditInput[] = [];
    const issueApiKeyCalls = { count: 0 };
    const app = new Hono();
    registerAccountRoutes(app, testDeps({
      auditInputs,
      issueApiKeyCalls,
      accountMutationIdempotencyService: pipelineIdempotencyService(),
    }));

    const first = await app.request('/api/v1/account/api-keys', {
      method: 'POST',
      headers: {
        'x-attestor-account-session': 'session-token',
        'Idempotency-Key': 'account-api-key-issue-1',
      },
    });
    const replay = await app.request('/api/v1/account/api-keys', {
      method: 'POST',
      headers: {
        'x-attestor-account-session': 'session-token',
        'Idempotency-Key': 'account-api-key-issue-1',
      },
    });
    const firstBody = await json(first);
    const replayBody = await json(replay);

    assert.equal(first.status, 201);
    assert.equal(replay.status, 201);
    assert.deepEqual(replayBody, firstBody);
    assert.equal(replay.headers.get('x-attestor-idempotent-replay'), 'true');
    assert.equal(replay.headers.get('x-attestor-idempotency-key'), null);
    assert.equal(issueApiKeyCalls.count, 1);
    assert.equal(auditInputs.length, 1);
    assert.equal(auditInputs[0]?.idempotencyKey, 'account-api-key-issue-1');
  } finally {
    restore();
  }
}

async function testAccountUserCreateRejectsIdempotencyKeyConflicts(): Promise<void> {
  const restore = withPipelineIdempotencyEnv();
  try {
    const createUserCalls = { count: 0 };
    const app = new Hono();
    registerAccountRoutes(app, testDeps({
      createUserCalls,
      accountMutationIdempotencyService: pipelineIdempotencyService(),
    }));

    const firstBody = {
      email: 'ops-one@example.com',
      displayName: 'Ops One',
      password: 'very-strong-route-password-1',
      role: 'account_admin',
    };
    const conflictBody = {
      ...firstBody,
      email: 'ops-two@example.com',
    };
    const first = await app.request('/api/v1/account/users', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-attestor-account-session': 'session-token',
        'Idempotency-Key': 'account-user-create-conflict-1',
      },
      body: JSON.stringify(firstBody),
    });
    const conflict = await app.request('/api/v1/account/users', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-attestor-account-session': 'session-token',
        'Idempotency-Key': 'account-user-create-conflict-1',
      },
      body: JSON.stringify(conflictBody),
    });
    const conflictResponse = await json(conflict);

    assert.equal(first.status, 201);
    assert.equal(conflict.status, 409);
    assert.equal(conflictResponse.error, 'Idempotency-Key was already used for a different account mutation request.');
    assert.equal(conflict.headers.get('x-attestor-idempotency-key'), null);
    assert.equal(createUserCalls.count, 1);
  } finally {
    restore();
  }
}

await testAccountApiKeyIssueWritesAccountSessionAudit();
await testOidcCallbackRateLimitRunsBeforeCrypto();
await testSamlCallbackRateLimitRunsBeforeCrypto();
await testAccountJsonRoutesRejectNonJsonMediaType();
await testAccountJsonRoutesRejectMalformedJson();
await testAccountRouteJsonAndAuthAttemptVocabularyIsLocked();
await testAccountApiKeyIssueReplaysWithIdempotencyKey();
await testAccountUserCreateRejectsIdempotencyKeyConflicts();

console.log('Service account routes authorization tests: 8 passed, 0 failed');
