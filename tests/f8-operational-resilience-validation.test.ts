import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import { generateKeyPair } from '../src/signing/keys.js';
import {
  registerCoreRoutes,
  type CoreRouteDeps,
} from '../src/service/http/routes/core-routes.js';
import { startHttpServer } from '../src/service/bootstrap/server.js';
import { shutdownTenantRuntimeBackends } from '../src/service/runtime/tenant-runtime.js';
import { createDegradedModeGrant } from '../src/release-enforcement-plane/degraded-mode.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function rejects(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function coreDeps(): CoreRouteDeps {
  const caKeyPair = generateKeyPair();
  return {
    evaluateApiHighAvailabilityState: () => ({
      enabled: false,
      publicHosted: false,
      ready: true,
    }),
    redisMode: 'none',
    asyncBackendMode: 'in_process',
    isSharedControlPlaneConfigured: () => false,
    serviceInstanceId: 'f8-test-instance',
    serviceVersion: '0.3.0-evaluation',
    startTime: Date.now(),
    domainRegistry: {
      listIds: () => ['finance'],
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
      ca: {
        keyPair: { publicKeyPem: caKeyPair.publicKeyPem },
        certificate: {
          certificateId: 'f8_ca',
          name: 'F8 Test CA',
          notBefore: '2026-05-14T00:00:00.000Z',
          notAfter: '2027-05-14T00:00:00.000Z',
          publicKey: caKeyPair.publicKeyHex,
          fingerprint: caKeyPair.fingerprint,
          signature: 'f8-signature-placeholder',
        },
      },
      signer: { certificate: { subject: 'F8 Runtime Signer' } },
      reviewer: { certificate: { subject: 'F8 Reviewer' } },
    },
    apiReleaseVerificationKeysPromise: Promise.resolve([]),
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
      pkiPath: '/tmp/f8-release-runtime-pki.json',
      blockers: [],
    },
    evaluateSharedAuthorityRuntimeReadiness: async () => ({
      version: 'test',
      evaluatedAt: '2026-05-14T00:00:00.000Z',
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
      version: 'attestor.production-storage-path.v1',
      evaluatedAt: '2026-05-14T00:00:00.000Z',
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
  };
}

async function testStartupProbeAndHealthRedaction(): Promise<void> {
  const app = new Hono();
  registerCoreRoutes(app, coreDeps());

  const startup = await app.request('/api/v1/startup');
  equal(startup.status, 200, 'F8-R2: startup probe returns 200 after process bootstrap');
  equal(
    startup.headers.get('cache-control'),
    'no-store',
    'F8-R2: startup probe is no-store',
  );
  const startupBody = await startup.json() as {
    status?: string;
    runtimeProfile?: { id?: string };
    instanceId?: string;
    pki?: unknown;
  };
  equal(startupBody.status, 'started', 'F8-R2: startup probe has a distinct started status');
  equal(
    'runtimeProfile' in startupBody,
    false,
    'F8-R2: startup probe does not expose runtime profile diagnostics',
  );
  equal(
    'instanceId' in startupBody,
    false,
    'F8-R2: startup probe does not expose service instance identifiers',
  );
  equal('pki' in startupBody, false, 'F8-R2: startup probe does not expose PKI metadata');

  const health = await app.request('/api/v1/health');
  equal(health.status, 200, 'F8-R1: health route remains available');
  const healthBody = await health.json() as {
    status?: string;
    version?: string;
    engine?: string;
    pki?: Record<string, unknown>;
    runtimeProfile?: unknown;
    releaseRuntime?: unknown;
    productionStoragePath?: unknown;
  };
  equal(healthBody.status, 'healthy', 'F8-R1: health reports minimal liveness status');
  equal(
    healthBody.engine,
    'attestor',
    'F8-R1: health keeps public product identity without diagnostics',
  );
  equal(
    'pki' in healthBody,
    false,
    'F8-R1: health no longer exposes PKI readiness or trust-root metadata',
  );
  equal(
    'runtimeProfile' in healthBody,
    false,
    'F8-R1: health no longer exposes runtime profile diagnostics',
  );
  equal(
    'releaseRuntime' in healthBody,
    false,
    'F8-R1: health no longer exposes release runtime diagnostics',
  );
  equal(
    'productionStoragePath' in healthBody,
    false,
    'F8-R1: health no longer exposes production storage path diagnostics',
  );

  const ca = await app.request('/api/v1/pki/ca');
  equal(ca.status, 200, 'F8-R1: dedicated CA trust-root route remains available');
  const caBody = await ca.json() as { keys?: readonly Record<string, unknown>[] };
  equal(typeof caBody.keys?.[0]?.keyId, 'string', 'F8-R1: CA route carries the public fingerprint key id');
  equal(typeof caBody.keys?.[0]?.publicKeyPem, 'string', 'F8-R1: CA route carries the public key PEM');
}

function testProductionSharedStartupFailFast(): void {
  rejects(
    () => startHttpServer(new Hono(), 0, {
      startupDiagnostics: {
        runtimeProfileDiagnostics: {
          profile: {
            id: 'production-shared',
            label: 'Production shared',
            production: true,
          },
          releaseStores: [],
          durability: {
            ready: false,
            summary: 'blocked',
          },
        },
        productionStoragePath: {
          readyForSelectedProfile: false,
          blockers: [
            {
              code: 'evaluation-store-not-shared',
              component: 'shadow-admission-events',
              message: 'shadow event store is file-backed',
            },
          ],
        },
      },
    }),
    /Production-shared startup storage gate failed: shadow-admission-events:evaluation-store-not-shared/u,
    'F8-R11: production-shared startup fails fast on storage blockers',
  );

  rejects(
    () => startHttpServer(new Hono(), 0, {
      startupDiagnostics: {
        runtimeProfileDiagnostics: {
          profile: {
            id: 'production-shared',
            label: 'Production shared',
            production: true,
          },
          releaseStores: [],
          durability: {
            ready: true,
            summary: 'shared release authority ready',
          },
        },
        productionStoragePath: {
          readyForSelectedProfile: true,
          blockers: [],
        },
        consequenceSharedStoreProfile: {
          readyForSelectedProfile: false,
          blockingComponentIds: ['retry-attempt-ledger'],
          blockers: [
            {
              code: 'in-memory-reference-not-shared',
              component: 'retry-attempt-ledger',
              message: 'retry ledger is not backed by shared storage',
            },
          ],
        },
      },
    }),
    /Production-shared startup consequence storage gate failed: retry-attempt-ledger:in-memory-reference-not-shared/u,
    'F8-R11: production-shared startup fails fast on consequence shared-store blockers',
  );
}

function testReportClaimsThatAreAlreadyClosed(): void {
  rejects(
    () => createDegradedModeGrant({
      state: 'break-glass-open',
      authorizedBy: 'operator:f8',
      reason: 'incident-response',
      scope: { releaseId: 'release_f8' },
      ttlSeconds: 24 * 60 * 60,
      maxTtlSeconds: 30 * 60,
      authorizedAt: '2026-05-14T00:00:00.000Z',
    }),
    /ttl cannot exceed 1800 seconds/u,
    'F8-R4: degraded-mode grants already enforce the max TTL ceiling',
  );

  const worker = readProjectFile('src', 'service', 'async', 'worker.ts');
  ok(
    worker.includes('shuttingDown') && worker.includes("server.listen(options.port, '0.0.0.0'"),
    'F8-R6: worker exposes readiness and gates it while shutting down',
  );

  const controlPlaneStore = readProjectFile('src', 'service', 'control-plane-store.ts');
  const asyncDeadLetterState = readProjectFile('src', 'service', 'control-plane-store', 'async-dead-letter-state.ts');
  ok(
    controlPlaneStore.includes("from './control-plane-store/async-dead-letter-state.js'") &&
      asyncDeadLetterState.includes('listAsyncDeadLetterRecordsPg') &&
      asyncDeadLetterState.includes('upsertAsyncDeadLetterRecordPg') &&
      asyncDeadLetterState.includes('removeAsyncDeadLetterRecordPg'),
    'F8-R5: shared control-plane dead-letter persistence exists for HA mode',
  );
  ok(
    asyncDeadLetterState.includes('if (!isSharedControlPlaneConfigured()) return listAsyncDeadLetterRecordsFile') &&
      asyncDeadLetterState.includes('await listAsyncDeadLetterRecordsPg(filters)'),
    'F8-R5: file-backed DLQ is the local fallback, not the shared-control-plane path',
  );
}

function testDeploymentProbeWiring(): void {
  const k8sApi = readProjectFile('ops', 'kubernetes', 'ha', 'api-deployment.yaml');
  ok(
    k8sApi.includes('startupProbe:') && k8sApi.includes('path: /api/v1/startup'),
    'F8-R2: Kubernetes startup probe uses the dedicated startup route',
  );

  const compose = readProjectFile('docker-compose.ha.yml');
  ok(
    compose.includes('start_period: 60s'),
    'F8-R2: HA docker-compose gives API bootstrap a longer readiness grace period',
  );
}

async function run(): Promise<void> {
  try {
    await testStartupProbeAndHealthRedaction();
    testProductionSharedStartupFailFast();
    testReportClaimsThatAreAlreadyClosed();
    testDeploymentProbeWiring();
    console.log(`F8 operational resilience validation tests: ${passed} passed, 0 failed`);
  } finally {
    await shutdownTenantRuntimeBackends();
  }
}

run().catch((error) => {
  console.error('F8 operational resilience validation tests failed:', error);
  process.exit(1);
});
