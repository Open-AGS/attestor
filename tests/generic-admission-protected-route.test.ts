import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GENERIC_ADMISSION_PROTECTED_ROUTE_SPEC_VERSION,
  evaluateGenericAdmissionProtectedRoute,
  type GenericAdmissionProtectedRouteEvaluation,
} from '../src/service/generic-admission-protected-route.js';
import { createGenericAdmissionRouteDeps } from '../src/service/bootstrap/routes.js';
import type { AppRuntime } from '../src/service/bootstrap/runtime.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes<T>(values: readonly T[], value: T, message: string): void {
  assert.ok(values.includes(value), message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function runtimeWith(
  genericAdmissionProtectedRoute?: GenericAdmissionProtectedRouteEvaluation,
): AppRuntime<unknown> {
  return {
    registries: {},
    infra: {
      service: {
        instanceId: 'generic-admission-protected-route-test',
        startedAtEpochMs: Date.now(),
      },
      security: genericAdmissionProtectedRoute
        ? { genericAdmissionProtectedRoute }
        : {},
    },
    stores: {},
    services: {
      httpRoutes: {
        pipeline: {
          currentTenant: () => ({
            tenantId: 'tenant_route',
            tenantName: 'Route Tenant',
            authenticatedAt: '2026-05-15T09:00:00.000Z',
            source: 'api_key',
            planId: 'starter',
            monthlyRunQuota: 100,
          }),
        },
      },
    },
  } as AppRuntime<unknown>;
}

function testProductionSharedBlocksUntilIssuerAndSenderProofAreConfigured(): void {
  const proof = evaluateGenericAdmissionProtectedRoute({
    runtimeProfileId: 'production-shared',
    requireProtectedReleaseTokenForHighRisk: true,
    issuerConfigured: false,
    senderConfirmationSource: 'none',
    failClosedOnMissingIssuer: true,
    shadowRecordsRawToken: false,
    admissionOrShadowStoresRawToken: false,
    rawTokenReturnedOnlyToCaller: true,
  });

  equal(
    proof.version,
    GENERIC_ADMISSION_PROTECTED_ROUTE_SPEC_VERSION,
    'Generic protected route: spec version is stable',
  );
  equal(
    proof.compatibilityModeAllowed,
    false,
    'Generic protected route: hosted protected profile does not allow compatibility mode',
  );
  equal(
    proof.protectedRouteGuardReady,
    true,
    'Generic protected route: fail-closed route guard is ready even before issuer wiring',
  );
  equal(
    proof.readyForSelectedProfile,
    false,
    'Generic protected route: production-shared readiness stays blocked without issuer and sender proof source',
  );
  equal(
    proof.state,
    'hosted-protected-route-blocked',
    'Generic protected route: production-shared state names the protected route blocker',
  );
  includes(
    proof.blockers,
    'protected-release-token-issuer-not-configured',
    'Generic protected route: missing issuer blocker is explicit',
  );
  includes(
    proof.blockers,
    'sender-confirmation-source-not-configured',
    'Generic protected route: missing sender proof source blocker is explicit',
  );
  equal(
    proof.productionReady,
    false,
    'Generic protected route: route proof does not claim production readiness',
  );
}

function testCompatibilityModeIsAProductionSharedBlocker(): void {
  const proof = evaluateGenericAdmissionProtectedRoute({
    runtimeProfileId: 'production-shared',
    requireProtectedReleaseTokenForHighRisk: false,
    issuerConfigured: true,
    issuerBoundary: 'runtime-release-token-issuer',
    senderConfirmationSource: 'dpop-jkt',
    failClosedOnMissingIssuer: true,
  });

  equal(
    proof.compatibilityModeAllowed,
    true,
    'Generic protected route: disabled protected issuer requirement is compatibility mode',
  );
  equal(
    proof.readyForSelectedProfile,
    false,
    'Generic protected route: production-shared cannot be ready with compatibility mode enabled',
  );
  includes(
    proof.blockers,
    'protected-route-requirement-disabled',
    'Generic protected route: compatibility mode blocker is machine-readable',
  );
}

function testConfiguredIssuerAndSenderProofClearSelectedRouteReadiness(): void {
  const proof = evaluateGenericAdmissionProtectedRoute({
    runtimeProfileId: 'production-shared',
    requireProtectedReleaseTokenForHighRisk: true,
    issuerConfigured: true,
    issuerBoundary: 'runtime-release-token-issuer',
    senderConfirmationSource: 'dpop-jkt',
    failClosedOnMissingIssuer: true,
    shadowRecordsRawToken: false,
    admissionOrShadowStoresRawToken: false,
    rawTokenReturnedOnlyToCaller: true,
  });

  equal(
    proof.readyForSelectedProfile,
    true,
    'Generic protected route: issuer plus sender proof source clears route readiness',
  );
  equal(
    proof.state,
    'hosted-protected-route-ready',
    'Generic protected route: state records hosted protected route readiness',
  );
  equal(
    proof.blockers.length,
    0,
    'Generic protected route: complete route config has no route blockers',
  );
  includes(
    proof.noGoConditions,
    'customer-pep-not-proven',
    'Generic protected route: customer PEP remains an explicit non-claim',
  );
  equal(
    proof.productionReady,
    false,
    'Generic protected route: complete route config still avoids live production readiness claim',
  );
}

function testHostedBootstrapRequiresProtectedIssuerByDefault(): void {
  const deps = createGenericAdmissionRouteDeps(runtimeWith());

  equal(
    deps.requireProtectedReleaseTokenForHighRisk,
    true,
    'Generic protected route: hosted bootstrap requires protected token for high-risk admissions by default',
  );
}

function testHostedBootstrapAndReadinessExposeRouteProof(): void {
  const apiRouteRuntime = readProjectFile('src', 'service', 'bootstrap', 'api-route-runtime.ts');
  const routes = readProjectFile('src', 'service', 'bootstrap', 'routes.ts');
  const coreRoutes = readProjectFile('src', 'service', 'http', 'routes', 'core-routes.ts');

  ok(
    /requireProtectedReleaseTokenForHighRisk:\s*true/u.test(apiRouteRuntime),
    'Generic protected route: API runtime sets the hosted protected-token requirement',
  );
  ok(
    /genericAdmissionProtectedRoute,/u.test(apiRouteRuntime),
    'Generic protected route: API runtime exposes route proof in runtime security/core deps',
  );
  ok(
    /requireProtectedReleaseTokenForHighRisk:\s*genericAdmissionProtectedRoute\.requireProtectedReleaseTokenForHighRisk/u.test(routes),
    'Generic protected route: route deps use the machine-readable route proof',
  );
  ok(
    /checks\.genericAdmissionProtectedRoute/u.test(coreRoutes),
    'Generic protected route: readiness checks include generic admission protected route proof',
  );
}

testProductionSharedBlocksUntilIssuerAndSenderProofAreConfigured();
testCompatibilityModeIsAProductionSharedBlocker();
testConfiguredIssuerAndSenderProofClearSelectedRouteReadiness();
testHostedBootstrapRequiresProtectedIssuerByDefault();
testHostedBootstrapAndReadinessExposeRouteProof();

console.log(`Generic admission protected route tests: ${passed} passed, 0 failed`);
