import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import {
  buildHostedOidcAuthorizationRequest,
  hostedOidcDiscoveryCacheTtlSeconds,
} from '../src/service/account-oidc.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve a TCP port.'));
        return;
      }
      const { port } = address;
      server.close((err) => err ? reject(err) : resolve(port));
    });
  });
}

async function listen(server: ReturnType<typeof createServer>, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

async function close(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function main(): Promise<void> {
  const savedEnv = {
    ATTESTOR_HOSTED_OIDC_ISSUER_URL: process.env.ATTESTOR_HOSTED_OIDC_ISSUER_URL,
    ATTESTOR_HOSTED_OIDC_CLIENT_ID: process.env.ATTESTOR_HOSTED_OIDC_CLIENT_ID,
    ATTESTOR_HOSTED_OIDC_CLIENT_SECRET: process.env.ATTESTOR_HOSTED_OIDC_CLIENT_SECRET,
    ATTESTOR_HOSTED_OIDC_REDIRECT_URL: process.env.ATTESTOR_HOSTED_OIDC_REDIRECT_URL,
    ATTESTOR_HOSTED_OIDC_SCOPES: process.env.ATTESTOR_HOSTED_OIDC_SCOPES,
    ATTESTOR_HOSTED_OIDC_STATE_KEY: process.env.ATTESTOR_HOSTED_OIDC_STATE_KEY,
    ATTESTOR_HOSTED_OIDC_DISCOVERY_CACHE_TTL_SECONDS:
      process.env.ATTESTOR_HOSTED_OIDC_DISCOVERY_CACHE_TTL_SECONDS,
    ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP: process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP,
    NODE_ENV: process.env.NODE_ENV,
    ATTESTOR_HA_MODE: process.env.ATTESTOR_HA_MODE,
  };

  const port = await reservePort();
  const issuerUrl = `http://127.0.0.1:${port}`;
  let authorizationPath = '/authorize-v1';
  let discoveryHits = 0;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const requestUrl = new URL(req.url ?? '/', issuerUrl);
    if (requestUrl.pathname === '/.well-known/openid-configuration') {
      discoveryHits += 1;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        issuer: issuerUrl,
        authorization_endpoint: `${issuerUrl}${authorizationPath}`,
        token_endpoint: `${issuerUrl}/token`,
        jwks_uri: `${issuerUrl}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['none'],
        code_challenge_methods_supported: ['S256'],
        scopes_supported: ['openid', 'email', 'profile'],
      }));
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });

  try {
    await listen(server, port);
    process.env.ATTESTOR_HOSTED_OIDC_ISSUER_URL = issuerUrl;
    process.env.ATTESTOR_HOSTED_OIDC_CLIENT_ID = 'attestor-web';
    process.env.ATTESTOR_HOSTED_OIDC_CLIENT_SECRET = '';
    process.env.ATTESTOR_HOSTED_OIDC_REDIRECT_URL = 'http://127.0.0.1:3000/api/v1/auth/oidc/callback';
    process.env.ATTESTOR_HOSTED_OIDC_SCOPES = 'openid email profile';
    process.env.ATTESTOR_HOSTED_OIDC_STATE_KEY = 'oidc-state-secret';
    process.env.ATTESTOR_HOSTED_OIDC_DISCOVERY_CACHE_TTL_SECONDS = '1';
    delete process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP;
    delete process.env.NODE_ENV;
    delete process.env.ATTESTOR_HA_MODE;

    ok(hostedOidcDiscoveryCacheTtlSeconds() === 1, 'OIDC discovery cache: env TTL is honored');

    const first = await buildHostedOidcAuthorizationRequest();
    ok(
      new URL(first.authorizationUrl).pathname === '/authorize-v1',
      'OIDC discovery cache: first authorization request uses discovered metadata',
    );
    ok(discoveryHits === 1, 'OIDC discovery cache: first request fetches provider metadata');

    authorizationPath = '/authorize-v2';
    const staleWithinTtl = await buildHostedOidcAuthorizationRequest();
    ok(
      new URL(staleWithinTtl.authorizationUrl).pathname === '/authorize-v1',
      'OIDC discovery cache: metadata is reused before TTL expiry',
    );
    ok(discoveryHits === 1, 'OIDC discovery cache: no duplicate fetch before TTL expiry');

    await delay(1250);
    const refreshed = await buildHostedOidcAuthorizationRequest();
    ok(
      new URL(refreshed.authorizationUrl).pathname === '/authorize-v2',
      'OIDC discovery cache: stale provider metadata is refreshed after TTL expiry',
    );
    ok(discoveryHits === 2, 'OIDC discovery cache: expired cache triggers exactly one refetch');

    console.log(`Account OIDC discovery cache tests: ${passed} passed, 0 failed`);
  } finally {
    await close(server);
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error('\nAccount OIDC discovery cache tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
