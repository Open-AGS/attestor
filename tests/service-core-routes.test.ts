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

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

async function testReleaseTokenJwksRouteExposesPublicVerificationKeyOnly(): Promise<void> {
  const keyPair = generateKeyPair();
  const caKeyPair = generateKeyPair();
  let connectorLoadConfigCalls = 0;
  let connectorAvailabilityCalls = 0;
  const issuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
  const verificationKey = await issuer.exportVerificationKey();
  const retiredKeyPair = generateKeyPair();
  const retiredIssuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: retiredKeyPair.privateKeyPem,
    publicKeyPem: retiredKeyPair.publicKeyPem,
  });
  const retiredVerificationKey = await retiredIssuer.exportVerificationKey();
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
    serviceVersion: '0.2.0-evaluation',
    startTime: Date.now(),
    domainRegistry: {
      listIds: () => [],
      list: () => [],
    },
    connectorRegistry: {
      listIds: () => ['snowflake'],
      list: () => [{
        id: 'snowflake',
        displayName: 'Snowflake Data Cloud',
        loadConfig: () => {
          connectorLoadConfigCalls += 1;
          return { provider: 'snowflake' };
        },
        isAvailable: async () => {
          connectorAvailabilityCalls += 1;
          return true;
        },
      }],
    },
    filingRegistry: {
      list: () => [],
    },
    pkiReady: true,
    pki: {
      ca: {
        keyPair: { publicKeyPem: caKeyPair.publicKeyPem },
        certificate: {
          certificateId: 'ca_service_core_routes',
          name: 'Test CA',
          notBefore: '2026-04-29T00:00:00.000Z',
          notAfter: '2027-04-29T00:00:00.000Z',
          publicKey: caKeyPair.publicKeyHex,
          fingerprint: caKeyPair.fingerprint,
          signature: 'ca-signature-placeholder',
        },
      },
      signer: { certificate: { subject: 'API Runtime Signer' } },
      reviewer: { certificate: { subject: 'API Reviewer' } },
    },
    apiReleaseVerificationKeysPromise: Promise.resolve([verificationKey, retiredVerificationKey]),
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
    releaseSigningProvider: {
      version: 'test',
      kind: 'file-pem',
      configuredProvider: null,
      derivedProvider: 'file-pem',
      productionProviderRequired: false,
      productionReady: false,
      privateKeyExportable: true,
      signingBoundary: 'runtime-file-pem',
      rotationManagedBy: 'runtime-file-store',
      publicVerificationKeysServedBy: 'runtime-jwks',
      pkiPath: '/tmp/attestor-release-runtime-pki.json',
      blockers: [
        'release signer private key is exportable file-backed PEM; use an external KMS/HSM provider before production promotion',
      ],
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
    evaluateProductionStoragePath: () => ({
      version: 'test',
      evaluatedAt: '2026-04-29T00:00:00.000Z',
      runtimeProfileId: 'single-node-durable',
      state: 'evaluation-storage-accepted',
      readyForSelectedProfile: true,
      productionReady: false,
      rawPayloadStored: false,
      exposesConnectionStrings: false,
      components: [],
      blockers: [],
      requiredProofs: [],
    }),
    rlsActivationResult: {
      activated: false,
      policiesFound: 0,
      tablesProtected: [],
      error: null,
    },
    accountAuthKeySources: {
      mfa: 'dedicated',
      oidc: 'local-admin-fallback',
      saml: 'not-configured',
    },
  };

  registerCoreRoutes(app, deps);

  const startupResponse = await app.request('/api/v1/startup');
  equal(startupResponse.status, 200, 'Core routes: startup route stays available');
  equal(
    startupResponse.headers.get('cache-control'),
    'no-store',
    'Core routes: startup route is explicitly no-store',
  );
  const startupBody = await startupResponse.json() as Record<string, unknown>;
  equal(startupBody.status, 'started', 'Core routes: startup route reports a bounded status');
  equal(startupBody.engine, 'attestor', 'Core routes: startup route keeps product identity visible');
  equal(
    'instanceId' in startupBody,
    false,
    'Core routes: public startup route does not expose service instance identifiers',
  );
  equal(
    'runtimeProfile' in startupBody,
    false,
    'Core routes: public startup route does not expose runtime profile diagnostics',
  );

  const healthResponse = await app.request('/api/v1/health');
  equal(healthResponse.status, 200, 'Core routes: health route stays available');
  equal(
    healthResponse.headers.get('cache-control'),
    'no-store',
    'Core routes: health route is explicitly no-store',
  );
  const healthBody = await healthResponse.json() as Record<string, unknown>;
  equal(
    healthBody.status,
    'healthy',
    'Core routes: public health route reports only liveness status',
  );
  equal(
    healthBody.engine,
    'attestor',
    'Core routes: public health route keeps the product identity visible',
  );
  equal(
    healthBody.version,
    '0.2.0-evaluation',
    'Core routes: public health route reports service version',
  );
  equal(
    'releaseRuntime' in healthBody,
    false,
    'Core routes: public health route does not expose release runtime diagnostics',
  );
  equal(
    'runtimeProfile' in healthBody,
    false,
    'Core routes: public health route does not expose runtime profile diagnostics',
  );
  equal(
    'connectors' in healthBody,
    false,
    'Core routes: public health route does not expose connector inventory',
  );
  equal(
    'accountAuth' in healthBody,
    false,
    'Core routes: public health route does not expose account auth key-source labels',
  );
  equal(
    'productionStoragePath' in healthBody,
    false,
    'Core routes: public health route does not expose production storage path diagnostics',
  );

  const readyResponse = await app.request('/api/v1/ready');
  equal(
    readyResponse.headers.get('cache-control'),
    'no-store',
    'Core routes: readiness route is explicitly no-store',
  );
  const readyBody = await readyResponse.json() as Record<string, unknown>;
  ok(
    readyResponse.status === 200 || readyResponse.status === 503,
    'Core routes: readiness route preserves bounded readiness status codes',
  );
  equal(
    typeof readyBody.ready,
    'boolean',
    'Core routes: readiness route reports public readiness boolean',
  );
  equal(
    readyBody.status,
    readyBody.ready === true ? 'ready' : 'not_ready',
    'Core routes: readiness route reports minimal readiness status label',
  );
  ok(
    !('checks' in readyBody) &&
      !('releaseRuntime' in readyBody) &&
      !('runtimeProfile' in readyBody) &&
      !('sharedAuthorityRuntime' in readyBody) &&
      !('productionStoragePath' in readyBody),
    'Core routes: public readiness route does not expose internal diagnostic details',
  );

  const connectorsResponse = await app.request('/api/v1/connectors');
  equal(connectorsResponse.status, 200, 'Core routes: public connector catalog route stays available');
  equal(
    connectorsResponse.headers.get('cache-control'),
    'no-store',
    'Core routes: public connector catalog is explicitly no-store',
  );
  const connectorsBody = await connectorsResponse.json() as {
    connectors?: Array<Record<string, unknown>>;
  };
  equal(
    connectorsBody.connectors?.[0]?.id,
    'snowflake',
    'Core routes: public connector catalog keeps the connector id',
  );
  equal(
    connectorsBody.connectors?.[0]?.displayName,
    'Snowflake Data Cloud',
    'Core routes: public connector catalog keeps the display name',
  );
  equal(
    'configured' in (connectorsBody.connectors?.[0] ?? {}),
    false,
    'Core routes: public connector catalog does not expose configured state',
  );
  equal(
    'available' in (connectorsBody.connectors?.[0] ?? {}),
    false,
    'Core routes: public connector catalog does not expose availability state',
  );
  equal(
    connectorLoadConfigCalls,
    0,
    'Core routes: public connector catalog does not inspect connector configuration',
  );
  equal(
    connectorAvailabilityCalls,
    0,
    'Core routes: public connector catalog does not probe connector availability',
  );

  const response = await app.request('/api/v1/release-token/jwks');
  equal(response.status, 200, 'Core routes: release-token JWKS route is public and available');
  equal(
    response.headers.get('cache-control'),
    'no-store',
    'Core routes: release-token JWKS route avoids stale key discovery during evaluation',
  );

  const body = await response.json() as { keys: Array<Record<string, unknown>> };
  equal(body.keys.length, 2, 'Core routes: release-token JWKS route exposes active and rollover keys');
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
  equal(
    body.keys[1]?.kid,
    retiredVerificationKey.keyId,
    'Core routes: release-token JWKS route keeps rollover verification keys addressable by kid',
  );
  equal(
    'd' in (body.keys[1] ?? {}),
    false,
    'Core routes: release-token JWKS route does not expose retired private key material',
  );

  const caResponse = await app.request('/api/v1/pki/ca');
  equal(caResponse.status, 200, 'Core routes: CA trust-root route is public and available');
  equal(
    caResponse.headers.get('cache-control'),
    'no-store',
    'Core routes: CA trust-root route avoids stale trust-root discovery during evaluation',
  );
  const caBody = await caResponse.json() as { keys: Array<Record<string, unknown>> };
  equal(caBody.keys.length, 1, 'Core routes: CA trust-root route exposes the active CA public key');
  equal(
    caBody.keys[0]?.keyId,
    caKeyPair.fingerprint,
    'Core routes: CA trust-root route uses the CA fingerprint as the public key id',
  );
  equal(
    caBody.keys[0]?.publicKeyPem,
    caKeyPair.publicKeyPem,
    'Core routes: CA trust-root route exposes the CA public key PEM',
  );
  equal(
    'privateKeyPem' in (caBody.keys[0] ?? {}),
    false,
    'Core routes: CA trust-root route does not expose CA private key material',
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
