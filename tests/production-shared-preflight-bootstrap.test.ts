import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  ATTESTOR_RUNTIME_PROFILE_ENV,
} from '../src/service/bootstrap/runtime-profile.js';
import {
  ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV,
  ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV,
} from '../src/service/bootstrap/release-runtime.js';
import { createApiHttpRouteRuntime } from '../src/service/bootstrap/api-route-runtime.js';
import { createRegistries } from '../src/service/bootstrap/registries.js';
import { registerAllRoutes } from '../src/service/bootstrap/routes.js';
import { shutdownTenantRuntimeBackends } from '../src/service/runtime/tenant-runtime.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

async function run(): Promise<void> {
  const previousProfile = process.env[ATTESTOR_RUNTIME_PROFILE_ENV];
  const previousPkiPath = process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV];
  const previousPkiShared = process.env[ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV];
  process.env[ATTESTOR_RUNTIME_PROFILE_ENV] = 'production-shared';
  delete process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV];
  delete process.env[ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV];

  try {
    const runtime = await createApiHttpRouteRuntime({
      registries: createRegistries(),
      serviceInstanceId: 'production-shared-preflight-test',
      startTime: Date.now(),
    });
    const security = runtime.infra.security as {
      runtimeProfile: string;
      releaseRuntimeDurability: { ready: boolean; summary: string };
      releaseRuntimeRequestPathDiagnostics: {
        usesSharedAuthorityStores: boolean;
        blockers: readonly string[];
      };
      consequenceSharedStoreProfile: {
        readyForSelectedProfile: boolean;
        blockingComponentIds: readonly string[];
      };
      pkiReady: boolean;
    };

    equal(
      security.runtimeProfile,
      'production-shared',
      'Production-shared preflight: API runtime selects production-shared profile',
    );
    equal(
      security.releaseRuntimeDurability.ready,
      false,
      'Production-shared preflight: runtime durability remains false until shared stores are wired',
    );
    equal(
      security.releaseRuntimeRequestPathDiagnostics.usesSharedAuthorityStores,
      false,
      'Production-shared preflight: request path cutover remains false',
    );
    equal(
      security.consequenceSharedStoreProfile.readyForSelectedProfile,
      false,
      'Production-shared preflight: consequence shared-store profile remains false',
    );
    ok(
      security.consequenceSharedStoreProfile.blockingComponentIds.includes('retry-attempt-ledger'),
      'Production-shared preflight: consequence shared-store profile carries ledger blockers',
    );
    equal(
      security.pkiReady,
      false,
      'Production-shared preflight: shared PKI readiness remains false without explicit shared-path attestation',
    );

    const app = new Hono();
    registerAllRoutes(app, runtime);

    const health = await app.request('/api/v1/health');
    equal(health.status, 200, 'Production-shared preflight: health endpoint is available');
    const healthBody = await health.json() as Record<string, unknown>;
    equal(
      healthBody.status,
      'healthy',
      'Production-shared preflight: health reports process liveness only',
    );
    equal(
      healthBody.engine,
      'attestor',
      'Production-shared preflight: health keeps Attestor product identity',
    );
    ok(
      !('releaseRuntime' in healthBody) &&
        !('pki' in healthBody) &&
        !('sharedAuthorityRuntime' in healthBody) &&
        !('productionStoragePath' in healthBody) &&
        !('consequenceSharedStoreProfile' in healthBody),
      'Production-shared preflight: public health keeps internal diagnostics out of the response',
    );

    const ready = await app.request('/api/v1/ready');
    equal(ready.status, 503, 'Production-shared preflight: readiness fails closed');
    const readyBody = await ready.json() as Record<string, unknown>;
    equal(readyBody.ready, false, 'Production-shared preflight: ready=false is explicit');
    equal(
      readyBody.status,
      'not_ready',
      'Production-shared preflight: readiness reports minimal not-ready status label',
    );
    equal(
      readyBody.engine,
      'attestor',
      'Production-shared preflight: readiness keeps Attestor product identity',
    );
    ok(
      !('checks' in readyBody) &&
        !('releaseRuntime' in readyBody) &&
        !('runtimeProfile' in readyBody) &&
        !('sharedAuthorityRuntime' in readyBody) &&
        !('productionStoragePath' in readyBody) &&
        !('consequenceSharedStoreProfile' in readyBody),
      'Production-shared preflight: public readiness keeps internal diagnostics out of the response',
    );

    const blocked = await app.request('/api/v1/domains');
    equal(
      blocked.status,
      503,
      'Production-shared preflight: non-preflight API routes are guarded fail-closed',
    );
    const blockedBody = await blocked.json() as { error: string };
    equal(
      blockedBody.error,
      'production_shared_request_path_not_ready',
      'Production-shared preflight: blocked response names the request-path guard',
    );
    ok(
      security.releaseRuntimeRequestPathDiagnostics.blockers.length > 0,
      'Production-shared preflight: request-path diagnostics include blocker detail',
    );
  } finally {
    await shutdownTenantRuntimeBackends();
    if (previousProfile === undefined) {
      delete process.env[ATTESTOR_RUNTIME_PROFILE_ENV];
    } else {
      process.env[ATTESTOR_RUNTIME_PROFILE_ENV] = previousProfile;
    }
    if (previousPkiPath === undefined) {
      delete process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV];
    } else {
      process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV] = previousPkiPath;
    }
    if (previousPkiShared === undefined) {
      delete process.env[ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV];
    } else {
      process.env[ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV] = previousPkiShared;
    }
  }

  console.log(`Production-shared preflight bootstrap tests: ${passed} passed, 0 failed`);
}

run().catch((error) => {
  console.error('Production-shared preflight bootstrap tests failed:', error);
  process.exit(1);
});
