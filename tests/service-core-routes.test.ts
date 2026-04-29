import { strict as assert } from 'node:assert';
import { Hono } from 'hono';
import { generateKeyPair } from '../src/signing/keys.js';
import { createReleaseTokenIssuer } from '../src/release-kernel/release-token.js';
import {
  registerCoreRoutes,
  type CoreRouteDeps,
} from '../src/service/http/routes/core-routes.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

async function testReleaseTokenJwksRouteExposesPublicVerificationKeyOnly(): Promise<void> {
  const keyPair = generateKeyPair();
  const issuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
  const verificationKey = await issuer.exportVerificationKey();
  const app = new Hono();
  const deps: CoreRouteDeps = {
    evaluateApiHighAvailabilityState: () => ({
      enabled: false,
      publicHosted: false,
      ready: true,
    }),
    redisMode: 'none',
    asyncBackendMode: 'in_process',
    isSharedControlPlaneConfigured: () => false,
    serviceInstanceId: 'svc-test',
    serviceVersion: '0.1.2-evaluation',
    startTime: Date.now(),
    domainRegistry: {
      listIds: () => [],
      list: () => [],
    },
    connectorRegistry: {
      listIds: () => [],
      list: () => [],
    },
    filingRegistry: {
      list: () => [],
    },
    pkiReady: true,
    pki: {
      ca: { certificate: { name: 'Test CA', fingerprint: 'ca-fingerprint' } },
      signer: { certificate: { subject: 'API Runtime Signer' } },
      reviewer: { certificate: { subject: 'API Reviewer' } },
    },
    apiReleaseVerificationKeyPromise: Promise.resolve(verificationKey),
    runtimeProfileDiagnostics: {
      version: 'test',
      profile: {
        id: 'single-node-durable',
        label: 'Single node durable',
        purpose: 'test',
        production: false,
      },
      releaseStores: [],
      durability: {
        ready: true,
        summary: 'requirements satisfied',
        violations: [],
      },
    },
    releaseRuntimeRequestPathDiagnostics: {
      version: 'test',
      usesSharedAuthorityStores: false,
      contract: 'synchronous-local-authority-stores',
      storeModes: {},
      sharedComponents: [],
      blockers: [],
    },
    evaluateSharedAuthorityRuntimeReadiness: async () => ({
      version: 'test',
      evaluatedAt: '2026-04-29T00:00:00.000Z',
      runtimeProfileId: 'single-node-durable',
      mode: 'disabled',
      configured: false,
      ready: true,
      checks: {},
      summary: {},
      components: [],
      storeSummaries: {},
      blockers: [],
    }),
    rlsActivationResult: {
      activated: false,
      policiesFound: 0,
      tablesProtected: [],
      error: null,
    },
  };

  registerCoreRoutes(app, deps);

  const response = await app.request('/api/v1/release-token/jwks');
  equal(response.status, 200, 'Core routes: release-token JWKS route is public and available');
  equal(
    response.headers.get('cache-control'),
    'no-store',
    'Core routes: release-token JWKS route avoids stale key discovery during evaluation',
  );

  const body = await response.json() as { keys: Array<Record<string, unknown>> };
  equal(body.keys.length, 1, 'Core routes: release-token JWKS route exposes one active key');
  equal(
    body.keys[0]?.kid,
    verificationKey.keyId,
    'Core routes: release-token JWKS route preserves the verification key kid',
  );
  equal(
    body.keys[0]?.alg,
    verificationKey.algorithm,
    'Core routes: release-token JWKS route preserves the verification algorithm',
  );
  equal(
    body.keys[0]?.use,
    'sig',
    'Core routes: release-token JWKS route marks the key for signature verification',
  );
  equal(
    Array.isArray(body.keys[0]?.key_ops) ? body.keys[0]?.key_ops.join(',') : null,
    'verify',
    'Core routes: release-token JWKS route limits key operations to verification',
  );
  equal(
    'd' in (body.keys[0] ?? {}),
    false,
    'Core routes: release-token JWKS route does not expose private Ed25519 key material',
  );
}

async function main(): Promise<void> {
  await testReleaseTokenJwksRouteExposesPublicVerificationKeyOnly();
  console.log(`Service core route tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('Service core route tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
