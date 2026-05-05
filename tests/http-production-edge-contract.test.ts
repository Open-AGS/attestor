import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  DEFAULT_API_BODY_LIMIT_BYTES,
  installHttpProductionEdgeContract,
  resolveApiBodyLimitBytes,
} from '../src/service/http-production-edge-contract.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function match(actual: string | null, expected: RegExp, message: string): void {
  assert.match(actual ?? '', expected, message);
  passed += 1;
}

function ok(value: unknown, message: string): void {
  assert.ok(value, message);
  passed += 1;
}

function createEdgeContractApp(input: {
  apiBodyLimitBytes?: number;
  env?: Readonly<Record<string, string | undefined>>;
  logMessages?: string[];
} = {}): Hono {
  const app = new Hono();
  installHttpProductionEdgeContract(app, {
    apiBodyLimitBytes: input.apiBodyLimitBytes,
    env: input.env,
    logger: {
      error: (message?: unknown) => {
        input.logMessages?.push(String(message ?? ''));
      },
    },
  });
  app.get('/', (c) => c.text('ok'));
  app.get('/api/v1/ok', (c) => c.json({ ok: true }));
  app.post('/api/v1/echo', async (c) => c.json({ body: await c.req.text() }));
  app.get('/api/v1/fail', () => {
    throw new Error('internal database password=secret should not be sent to clients');
  });
  return app;
}

async function testSecurityHeadersApplyToApiAndPublicResponses(): Promise<void> {
  const app = createEdgeContractApp();

  const apiResponse = await app.request('/api/v1/ok');
  equal(apiResponse.status, 200, 'HTTP edge contract: API route remains reachable');
  equal(apiResponse.headers.get('x-content-type-options'), 'nosniff', 'HTTP edge contract: API response disables MIME sniffing');
  equal(apiResponse.headers.get('x-frame-options'), 'DENY', 'HTTP edge contract: API response denies framing');
  equal(apiResponse.headers.get('referrer-policy'), 'no-referrer', 'HTTP edge contract: API response sets a conservative referrer policy');
  equal(apiResponse.headers.get('cross-origin-opener-policy'), 'same-origin', 'HTTP edge contract: API response pins COOP');
  equal(apiResponse.headers.get('cross-origin-resource-policy'), 'same-origin', 'HTTP edge contract: API response pins CORP');
  equal(
    apiResponse.headers.get('strict-transport-security'),
    'max-age=63072000; includeSubDomains; preload',
    'HTTP edge contract: API response pins HSTS',
  );
  equal(apiResponse.headers.get('cache-control'), 'no-store', 'HTTP edge contract: API response is not cached by default');
  match(
    apiResponse.headers.get('content-security-policy'),
    /frame-ancestors 'none'/u,
    'HTTP edge contract: API response cannot be framed through CSP',
  );
  match(
    apiResponse.headers.get('permissions-policy'),
    /camera=\(\)/u,
    'HTTP edge contract: API response disables browser camera permission by default',
  );

  const publicResponse = await app.request('/');
  equal(publicResponse.status, 200, 'HTTP edge contract: public route remains reachable');
  equal(publicResponse.headers.get('x-frame-options'), 'DENY', 'HTTP edge contract: public route gets security headers');
}

async function testProductionHostValidationUsesConfiguredAllowlist(): Promise<void> {
  const app = createEdgeContractApp({
    env: {
      NODE_ENV: 'production',
      ATTESTOR_PUBLIC_HOSTNAME: 'api.attestor.example',
    },
  });

  const allowedResponse = await app.request('/api/v1/ok', {
    headers: { host: 'api.attestor.example' },
  });
  equal(allowedResponse.status, 200, 'HTTP edge contract: configured production host is accepted');

  const rejectedResponse = await app.request('/api/v1/ok', {
    headers: { host: 'attacker.example' },
  });
  equal(rejectedResponse.status, 421, 'HTTP edge contract: unlisted production host is rejected');
  equal(rejectedResponse.headers.get('cache-control'), 'no-store', 'HTTP edge contract: rejected host response is no-store');
  const rejectedBody = await rejectedResponse.json() as { error: string };
  equal(rejectedBody.error, 'host_not_allowed', 'HTTP edge contract: rejected host returns stable error code');
}

async function testLocalHostValidationStaysOpenWithoutConfiguredHost(): Promise<void> {
  const app = createEdgeContractApp();
  const response = await app.request('/api/v1/ok', {
    headers: { host: 'local.test' },
  });
  equal(response.status, 200, 'HTTP edge contract: local runs do not require a host allowlist');
}

async function testApiBodyLimitFailsClosedWithoutConsumingValidRawBody(): Promise<void> {
  const app = createEdgeContractApp({ apiBodyLimitBytes: 16 });

  const acceptedResponse = await app.request('/api/v1/echo', {
    method: 'POST',
    body: 'bounded-payload',
  });
  equal(acceptedResponse.status, 200, 'HTTP edge contract: body limit allows bounded API payloads');
  const acceptedBody = await acceptedResponse.json() as { body: string };
  equal(acceptedBody.body, 'bounded-payload', 'HTTP edge contract: body limit preserves raw body for downstream handlers');

  const rejectedResponse = await app.request('/api/v1/echo', {
    method: 'POST',
    body: 'this-payload-is-too-large',
  });
  equal(rejectedResponse.status, 413, 'HTTP edge contract: oversized API payload fails closed with 413');
  equal(rejectedResponse.headers.get('cache-control'), 'no-store', 'HTTP edge contract: oversized API response is not cached');
  const rejectedBody = await rejectedResponse.json() as {
    error: string;
    maxSizeBytes: number;
  };
  equal(rejectedBody.error, 'payload_too_large', 'HTTP edge contract: oversized API payload returns stable error code');
  equal(rejectedBody.maxSizeBytes, 16, 'HTTP edge contract: oversized API response reports configured limit');
}

async function testNotFoundAndInternalErrorsAreGeneric(): Promise<void> {
  const logMessages: string[] = [];
  const app = createEdgeContractApp({ logMessages });

  const notFoundResponse = await app.request('/api/v1/missing');
  equal(notFoundResponse.status, 404, 'HTTP edge contract: unknown API route returns 404');
  equal(notFoundResponse.headers.get('cache-control'), 'no-store', 'HTTP edge contract: API 404 response is not cached');
  const notFoundBody = await notFoundResponse.json() as { error: string };
  equal(notFoundBody.error, 'not_found', 'HTTP edge contract: unknown API route returns stable JSON error code');

  const errorResponse = await app.request('/api/v1/fail');
  equal(errorResponse.status, 500, 'HTTP edge contract: unhandled API error returns 500');
  const errorText = await errorResponse.text();
  ok(!errorText.includes('password=secret'), 'HTTP edge contract: unhandled error response does not leak internal error detail');
  match(errorText, /internal_error/u, 'HTTP edge contract: unhandled error response returns stable JSON error code');
  equal(logMessages.length, 1, 'HTTP edge contract: unhandled error is logged once for operators');
  ok(!logMessages[0]?.includes('password=secret'), 'HTTP edge contract: unhandled error log omits exception message contents');
}

function testBodyLimitEnvironmentParsing(): void {
  equal(
    resolveApiBodyLimitBytes(undefined),
    DEFAULT_API_BODY_LIMIT_BYTES,
    'HTTP edge contract: unset body limit uses conservative default',
  );
  equal(resolveApiBodyLimitBytes('4096'), 4096, 'HTTP edge contract: explicit body limit parses as byte count');
  assert.throws(
    () => resolveApiBodyLimitBytes('0'),
    /positive integer/u,
    'HTTP edge contract: zero body limit is rejected at startup',
  );
  passed += 1;
  assert.throws(
    () => resolveApiBodyLimitBytes('1mb'),
    /positive integer/u,
    'HTTP edge contract: non-integer body limit is rejected at startup',
  );
  passed += 1;
}

async function main(): Promise<void> {
  await testSecurityHeadersApplyToApiAndPublicResponses();
  await testProductionHostValidationUsesConfiguredAllowlist();
  await testLocalHostValidationStaysOpenWithoutConfiguredHost();
  await testApiBodyLimitFailsClosedWithoutConsumingValidRawBody();
  await testNotFoundAndInternalErrorsAreGeneric();
  testBodyLimitEnvironmentParsing();
  console.log(`HTTP production edge contract tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('HTTP production edge contract tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
