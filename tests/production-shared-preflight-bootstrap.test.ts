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
      security.pkiReady,
      false,
      'Production-shared preflight: shared PKI readiness remains false without explicit shared-path attestation',
    );

    const app = new Hono();
    registerAllRoutes(app, runtime);

    const health = await app.request('/api/v1/health');
    equal(health.status, 200, 'Production-shared preflight: health endpoint is available');
    const healthBody = await health.json() as {
      releaseRuntime: { durability: { ready: boolean } };
      pki: { ready: boolean };
      sharedAuthorityRuntime: { ready: boolean };
      productionStoragePath: { state: string; readyForSelectedProfile: boolean };
    };
    equal(
      healthBody.releaseRuntime.durability.ready,
      false,
      'Production-shared preflight: health exposes release runtime not-ready state',
    );
    equal(
      healthBody.pki.ready,
      false,
      'Production-shared preflight: health exposes shared PKI not-ready state',
    );
    equal(
      healthBody.sharedAuthorityRuntime.ready,
      false,
      'Production-shared preflight: health exposes shared authority not-ready state',
    );
    equal(
      healthBody.productionStoragePath.readyForSelectedProfile,
      false,
      'Production-shared preflight: health exposes production storage path not-ready state',
    );

    const ready = await app.request('/api/v1/ready');
    equal(ready.status, 503, 'Production-shared preflight: readiness fails closed');
    const readyBody = await ready.json() as {
      ready: boolean;
      checks: Record<string, boolean>;
      sharedAuthorityRuntime: { checks: Record<string, boolean> };
      productionStoragePath: { blockers: readonly { code: string }[] };
    };
    equal(readyBody.ready, false, 'Production-shared preflight: ready=false is explicit');
    equal(
      readyBody.checks.pki,
      false,
      'Production-shared preflight: PKI readiness check is false without shared path attestation',
    );
    equal(
      readyBody.checks.releaseRuntime,
      false,
      'Production-shared preflight: release runtime readiness check is false',
    );
    equal(
      readyBody.checks.sharedAuthorityRuntime,
      false,
      'Production-shared preflight: shared authority readiness check is false',
    );
    equal(
      readyBody.checks.productionStoragePath,
      false,
      'Production-shared preflight: production storage path readiness check is false',
    );
    equal(
      readyBody.sharedAuthorityRuntime.checks.requestPathUsesSharedStores,
      false,
      'Production-shared preflight: shared authority readiness carries request-path truth',
    );
    ok(
      readyBody.productionStoragePath.blockers.some(
        (blocker) => blocker.code === 'evaluation-store-not-shared',
      ),
      'Production-shared preflight: production storage path names evaluation store blockers',
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
