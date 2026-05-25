import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  ACCOUNT_SESSION_ALLOWED_ORIGINS_ENV,
  ACCOUNT_SESSION_CSRF_HEADER,
  accountSessionAllowedOrigins,
  requireAccountSession,
} from '../src/service/request-context.js';
import {
  ACCOUNT_SESSION_TRANSPORT_HEADER,
  TENANT_CONTEXT_VERIFIED_HEADER,
} from '../src/service/tenant-isolation.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

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

function accountSessionHeaders(
  transport: 'cookie' | 'header',
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    [TENANT_CONTEXT_VERIFIED_HEADER]: 'true',
    'x-attestor-tenant-id': 'tenant_browser_boundary',
    'x-attestor-tenant-source': 'account_session',
    'x-attestor-plan-id': 'developer',
    'x-attestor-account-id': 'acct_browser_boundary',
    'x-attestor-account-user-id': 'ausr_browser_boundary',
    'x-attestor-account-role': 'account_admin',
    'x-attestor-account-session-id': 'sess_browser_boundary',
    [ACCOUNT_SESSION_TRANSPORT_HEADER]: transport,
    ...extra,
  };
}

async function runMutation(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = new Hono();
  app.post('/api/v1/account/mutate', (c) => requireAccountSession(c) ?? c.json({ ok: true }));
  const response = await app.request(url, {
    method: 'POST',
    headers,
  });
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

function reasonCodes(body: Record<string, unknown>): readonly string[] {
  return Array.isArray(body.reasonCodes) ? body.reasonCodes as string[] : [];
}

async function testSameOriginCookieMutationRequiresCsrfAndAllowsWithCsrf(): Promise<void> {
  const withoutCsrf = await runMutation(
    'https://api.attestor.test/api/v1/account/mutate',
    accountSessionHeaders('cookie', {
      Origin: 'https://api.attestor.test',
    }),
  );
  equal(withoutCsrf.status, 403, 'Account browser boundary: same-origin cookie mutation still requires CSRF header');
  ok(
    reasonCodes(withoutCsrf.body).includes('account-session-csrf-required'),
    'Account browser boundary: missing CSRF rejection keeps explicit reason code',
  );

  const withCsrf = await runMutation(
    'https://api.attestor.test/api/v1/account/mutate',
    accountSessionHeaders('cookie', {
      Origin: 'https://api.attestor.test',
      [ACCOUNT_SESSION_CSRF_HEADER]: 'present',
    }),
  );
  equal(withCsrf.status, 200, 'Account browser boundary: same-origin cookie mutation with CSRF header is allowed');
  equal(withCsrf.body.ok, true, 'Account browser boundary: successful same-origin response returns route body');
}

async function testCrossOriginCookieMutationRejectedEvenWithCsrfHeader(): Promise<void> {
  const response = await runMutation(
    'https://api.attestor.test/api/v1/account/mutate',
    accountSessionHeaders('cookie', {
      Origin: 'https://evil.example',
      [ACCOUNT_SESSION_CSRF_HEADER]: 'present',
    }),
  );
  equal(response.status, 403, 'Account browser boundary: cross-origin cookie mutation is rejected');
  ok(
    reasonCodes(response.body).includes('account-session-origin-not-allowed'),
    'Account browser boundary: cross-origin rejection names origin reason code',
  );
}

async function testOpaqueOriginCookieMutationRejected(): Promise<void> {
  const response = await runMutation(
    'https://api.attestor.test/api/v1/account/mutate',
    accountSessionHeaders('cookie', {
      Origin: 'null',
      [ACCOUNT_SESSION_CSRF_HEADER]: 'present',
    }),
  );
  equal(response.status, 403, 'Account browser boundary: opaque Origin is rejected for cookie mutation');
  ok(
    reasonCodes(response.body).includes('account-session-origin-not-allowed'),
    'Account browser boundary: opaque Origin rejection uses origin reason code',
  );
}

async function testFetchMetadataCrossSiteCookieMutationRejected(): Promise<void> {
  const response = await runMutation(
    'https://api.attestor.test/api/v1/account/mutate',
    accountSessionHeaders('cookie', {
      'Sec-Fetch-Site': 'cross-site',
      [ACCOUNT_SESSION_CSRF_HEADER]: 'present',
    }),
  );
  equal(response.status, 403, 'Account browser boundary: cross-site Fetch Metadata cookie mutation is rejected');
  ok(
    reasonCodes(response.body).includes('account-session-cross-site-request'),
    'Account browser boundary: fetch metadata rejection names cross-site reason code',
  );
}

async function testConfiguredTrustedBrowserOriginAllowsSplitUiAndApiOrigin(): Promise<void> {
  const restore = withEnv({
    [ACCOUNT_SESSION_ALLOWED_ORIGINS_ENV]: 'https://app.attestor.test',
  });
  try {
    const response = await runMutation(
      'https://api.attestor.test/api/v1/account/mutate',
      accountSessionHeaders('cookie', {
        Origin: 'https://app.attestor.test',
        [ACCOUNT_SESSION_CSRF_HEADER]: 'present',
      }),
    );
    equal(response.status, 200, 'Account browser boundary: explicit trusted UI origin can call API origin with CSRF header');
  } finally {
    restore();
  }
}

async function testWildcardOriginConfigFailsClosedWithoutLeakingValue(): Promise<void> {
  const restore = withEnv({
    [ACCOUNT_SESSION_ALLOWED_ORIGINS_ENV]: '*',
  });
  try {
    const response = await runMutation(
      'https://api.attestor.test/api/v1/account/mutate',
      accountSessionHeaders('cookie', {
        Origin: 'https://app.attestor.test',
        [ACCOUNT_SESSION_CSRF_HEADER]: 'present',
      }),
    );
    equal(response.status, 500, 'Account browser boundary: wildcard allowed-origin config fails closed');
    ok(
      reasonCodes(response.body).includes('account-session-origin-config-invalid'),
      'Account browser boundary: invalid config rejection names config reason code',
    );
    equal(
      JSON.stringify(response.body).includes('https://app.attestor.test') || JSON.stringify(response.body).includes('*'),
      false,
      'Account browser boundary: invalid config response does not echo origin or wildcard material',
    );
  } finally {
    restore();
  }
}

async function testHeaderTransportIsNotTreatedAsCookieCsrfSurface(): Promise<void> {
  const response = await runMutation(
    'https://api.attestor.test/api/v1/account/mutate',
    accountSessionHeaders('header', {
      Origin: 'https://evil.example',
      'Sec-Fetch-Site': 'cross-site',
    }),
  );
  equal(response.status, 200, 'Account browser boundary: explicit header session transport is not blocked by cookie CSRF guard');
}

function testOriginContractRejectsWildcardAndAcceptsExactOrigins(): void {
  const valid = accountSessionAllowedOrigins('https://api.attestor.test/api/v1/account/mutate', {
    ATTESTOR_PUBLIC_BASE_URL: 'https://api.attestor.test',
    ATTESTOR_PUBLIC_HOSTNAME: 'api.attestor.test',
    [ACCOUNT_SESSION_ALLOWED_ORIGINS_ENV]: 'https://app.attestor.test, http://localhost:3700',
  });
  equal(valid.invalidConfig, false, 'Account browser boundary: exact origins produce a valid deployment contract');
  ok(valid.origins.has('https://api.attestor.test'), 'Account browser boundary: request origin is allowed');
  ok(valid.origins.has('https://app.attestor.test'), 'Account browser boundary: configured UI origin is allowed');
  ok(valid.origins.has('http://localhost:3700'), 'Account browser boundary: explicit local origin is allowed');

  const invalid = accountSessionAllowedOrigins('https://api.attestor.test/api/v1/account/mutate', {
    [ACCOUNT_SESSION_ALLOWED_ORIGINS_ENV]: 'https://*.example.test',
  });
  equal(invalid.invalidConfig, true, 'Account browser boundary: wildcard configured origin is invalid');
}

async function main(): Promise<void> {
  await testSameOriginCookieMutationRequiresCsrfAndAllowsWithCsrf();
  await testCrossOriginCookieMutationRejectedEvenWithCsrfHeader();
  await testOpaqueOriginCookieMutationRejected();
  await testFetchMetadataCrossSiteCookieMutationRejected();
  await testConfiguredTrustedBrowserOriginAllowsSplitUiAndApiOrigin();
  await testWildcardOriginConfigFailsClosedWithoutLeakingValue();
  await testHeaderTransportIsNotTreatedAsCookieCsrfSurface();
  testOriginContractRejectsWildcardAndAcceptsExactOrigins();

  ok(passed > 0, 'Account browser boundary tests executed');
  console.log(`\nAccount session CORS/CSRF boundary tests: ${passed} passed, 0 failed`);
}

main().catch((error: unknown) => {
  console.error('\nAccount session CORS/CSRF boundary tests failed.');
  console.error(error);
  process.exitCode = 1;
});
