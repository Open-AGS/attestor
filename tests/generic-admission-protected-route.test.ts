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

function excludes<T>(values: readonly T[], value: T, message: string): void {
  assert.ok(!values.includes(value), message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function runtimeWith(
  genericAdmissionProtectedRoute?: GenericAdmissionProtectedRouteEvaluation,
  genericAdmissionProtectedIssuer?: unknown,
  genericAdmissionProtectedIntrospectionStore?: unknown,
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
      ...(genericAdmissionProtectedIssuer ? { genericAdmissionProtectedIssuer } : {}),
      ...(genericAdmissionProtectedIntrospectionStore
        ? { genericAdmissionProtectedIntrospectionStore }
        : {}),
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
  includes(
    proof.blockers,
    'production-issuer-boundary-not-external',
    'Generic protected route: production-shared requires an external issuer boundary',
  );
  includes(
    proof.blockers,
    'token-introspection-store-not-configured',
    'Generic protected route: missing introspection store blocker is explicit',
  );
  includes(
    proof.blockers,
    'replay-consumption-store-not-configured',
    'Generic protected route: missing replay consumption store blocker is explicit',
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
    tokenIntrospectionStoreConfigured: true,
    tokenIntrospectionStoreDurability: 'shared',
    replayConsumptionStoreConfigured: true,
    replayConsumptionStoreDurability: 'shared',
    senderConfirmationSource: 'dpop-jkt',
    senderProofReplayStoreConfigured: true,
    senderProofReplayStoreDurability: 'shared',
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

function testConfiguredRuntimeIssuerAndSenderProofClearEvaluationReadiness(): void {
  const proof = evaluateGenericAdmissionProtectedRoute({
    runtimeProfileId: 'single-node-durable',
    requireProtectedReleaseTokenForHighRisk: true,
    issuerConfigured: true,
    issuerBoundary: 'runtime-release-token-issuer',
    tokenIntrospectionStoreConfigured: true,
    tokenIntrospectionStoreDurability: 'local',
    replayConsumptionStoreConfigured: true,
    replayConsumptionStoreDurability: 'local',
    senderConfirmationSource: 'dpop-jkt',
    senderProofReplayStoreConfigured: true,
    senderProofReplayStoreDurability: 'local',
    failClosedOnMissingIssuer: true,
    shadowRecordsRawToken: false,
    admissionOrShadowStoresRawToken: false,
    rawTokenReturnedOnlyToCaller: true,
  });

  equal(
    proof.readyForSelectedProfile,
    true,
    'Generic protected route: runtime issuer plus sender proof source clears non-production route readiness',
  );
  equal(
    proof.state,
    'evaluation-protected-route-guarded',
    'Generic protected route: state records non-production guarded route readiness',
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

function testProductionSharedNeedsExternalIssuerBoundary(): void {
  const runtimeIssuer = evaluateGenericAdmissionProtectedRoute({
    runtimeProfileId: 'production-shared',
    requireProtectedReleaseTokenForHighRisk: true,
    issuerConfigured: true,
    issuerBoundary: 'runtime-release-token-issuer',
    tokenIntrospectionStoreConfigured: true,
    tokenIntrospectionStoreDurability: 'shared',
    replayConsumptionStoreConfigured: true,
    replayConsumptionStoreDurability: 'shared',
    senderConfirmationSource: 'dpop-jkt',
    senderProofReplayStoreConfigured: true,
    senderProofReplayStoreDurability: 'shared',
    failClosedOnMissingIssuer: true,
    shadowRecordsRawToken: false,
    admissionOrShadowStoresRawToken: false,
    rawTokenReturnedOnlyToCaller: true,
  });
  const externalIssuerWithoutProof = evaluateGenericAdmissionProtectedRoute({
    runtimeProfileId: 'production-shared',
    requireProtectedReleaseTokenForHighRisk: true,
    issuerConfigured: true,
    issuerBoundary: 'external-kms-hsm',
    tokenIntrospectionStoreConfigured: true,
    tokenIntrospectionStoreDurability: 'shared',
    replayConsumptionStoreConfigured: true,
    replayConsumptionStoreDurability: 'shared',
    senderConfirmationSource: 'dpop-jkt',
    senderProofReplayStoreConfigured: true,
    senderProofReplayStoreDurability: 'shared',
    failClosedOnMissingIssuer: true,
    shadowRecordsRawToken: false,
    admissionOrShadowStoresRawToken: false,
    rawTokenReturnedOnlyToCaller: true,
  });
  const externalIssuerWithStructuredProof = evaluateGenericAdmissionProtectedRoute({
    runtimeProfileId: 'production-shared',
    requireProtectedReleaseTokenForHighRisk: true,
    issuerConfigured: true,
    issuerBoundary: 'external-kms-hsm',
    issuerBoundaryEvidence: {
      source: 'release-tenant-signer-boundary-descriptor',
      issuerBoundary: 'external-kms-hsm',
      productionReady: true,
      liveProviderVerified: true,
      liveProviderProofState: 'valid',
      proofDigest: 'sha256:provider-live-proof',
      rawProviderResponseStored: false,
    },
    tokenIntrospectionStoreConfigured: true,
    tokenIntrospectionStoreDurability: 'shared',
    replayConsumptionStoreConfigured: true,
    replayConsumptionStoreDurability: 'shared',
    senderConfirmationSource: 'dpop-jkt',
    senderProofReplayStoreConfigured: true,
    senderProofReplayStoreDurability: 'shared',
    failClosedOnMissingIssuer: true,
    shadowRecordsRawToken: false,
    admissionOrShadowStoresRawToken: false,
    rawTokenReturnedOnlyToCaller: true,
  });

  equal(
    runtimeIssuer.readyForSelectedProfile,
    false,
    'Generic protected route: production-shared stays blocked on runtime-local issuer boundary',
  );
  includes(
    runtimeIssuer.blockers,
    'production-issuer-boundary-not-external',
    'Generic protected route: runtime-local issuer blocker is explicit',
  );
  equal(
    externalIssuerWithoutProof.readyForSelectedProfile,
    false,
    'Generic protected route: production-shared route readiness requires structured external issuer proof',
  );
  includes(
    externalIssuerWithoutProof.blockers,
    'external-issuer-boundary-proof-missing',
    'Generic protected route: external issuer label without live proof stays blocked',
  );
  equal(
    externalIssuerWithStructuredProof.readyForSelectedProfile,
    true,
    'Generic protected route: production-shared route readiness accepts structured external issuer proof',
  );
  equal(
    externalIssuerWithStructuredProof.issuerBoundaryEvidenceSource,
    'release-tenant-signer-boundary-descriptor',
    'Generic protected route: production-shared records the structured issuer boundary evidence source',
  );
  equal(
    externalIssuerWithStructuredProof.externalIssuerLiveProviderVerified,
    true,
    'Generic protected route: production-shared records live provider verification evidence',
  );
  equal(
    externalIssuerWithStructuredProof.tokenIntrospectionStoreReady,
    true,
    'Generic protected route: production-shared records shared token introspection readiness',
  );
  equal(
    externalIssuerWithStructuredProof.replayConsumptionStoreReady,
    true,
    'Generic protected route: production-shared records shared replay consumption readiness',
  );
  excludes(
    externalIssuerWithStructuredProof.noGoConditions,
    'durable-introspection-replay-store-not-proven',
    'Generic protected route: shared introspection and replay stores clear durable-store no-go',
  );
}

function testProductionSharedNeedsSharedDpopProofReplayStore(): void {
  const missing = evaluateGenericAdmissionProtectedRoute({
    runtimeProfileId: 'production-shared',
    requireProtectedReleaseTokenForHighRisk: true,
    issuerConfigured: true,
    issuerBoundary: 'external-kms-hsm',
    issuerBoundaryEvidence: {
      source: 'release-tenant-signer-boundary-descriptor',
      issuerBoundary: 'external-kms-hsm',
      productionReady: true,
      liveProviderVerified: true,
      liveProviderProofState: 'valid',
      proofDigest: 'sha256:provider-live-proof',
      rawProviderResponseStored: false,
    },
    tokenIntrospectionStoreConfigured: true,
    tokenIntrospectionStoreDurability: 'shared',
    replayConsumptionStoreConfigured: true,
    replayConsumptionStoreDurability: 'shared',
    senderConfirmationSource: 'dpop-jkt',
    senderProofReplayStoreConfigured: false,
    failClosedOnMissingIssuer: true,
  });
  const local = evaluateGenericAdmissionProtectedRoute({
    runtimeProfileId: 'production-shared',
    requireProtectedReleaseTokenForHighRisk: true,
    issuerConfigured: true,
    issuerBoundary: 'external-kms-hsm',
    issuerBoundaryEvidence: {
      source: 'release-tenant-signer-boundary-descriptor',
      issuerBoundary: 'external-kms-hsm',
      productionReady: true,
      liveProviderVerified: true,
      liveProviderProofState: 'valid',
      proofDigest: 'sha256:provider-live-proof',
      rawProviderResponseStored: false,
    },
    tokenIntrospectionStoreConfigured: true,
    tokenIntrospectionStoreDurability: 'shared',
    replayConsumptionStoreConfigured: true,
    replayConsumptionStoreDurability: 'shared',
    senderConfirmationSource: 'dpop-jkt',
    senderProofReplayStoreConfigured: true,
    senderProofReplayStoreDurability: 'local',
    failClosedOnMissingIssuer: true,
  });

  equal(
    missing.readyForSelectedProfile,
    false,
    'Generic protected route: production-shared blocks missing DPoP proof replay store',
  );
  includes(
    missing.blockers,
    'sender-proof-replay-store-not-configured',
    'Generic protected route: missing DPoP replay store blocker is explicit',
  );
  includes(
    missing.noGoConditions,
    'sender-proof-replay-store-not-proven',
    'Generic protected route: missing DPoP replay store keeps no-go condition',
  );
  equal(
    local.readyForSelectedProfile,
    false,
    'Generic protected route: production-shared blocks local-only DPoP proof replay store',
  );
  includes(
    local.blockers,
    'production-sender-proof-replay-store-not-shared',
    'Generic protected route: local-only DPoP replay store blocker is explicit',
  );
}

function testProductionSharedNeedsSharedIntrospectionAndReplayStores(): void {
  const proof = evaluateGenericAdmissionProtectedRoute({
    runtimeProfileId: 'production-shared',
    requireProtectedReleaseTokenForHighRisk: true,
    issuerConfigured: true,
    issuerBoundary: 'external-kms-hsm',
    issuerBoundaryEvidence: {
      source: 'release-tenant-signer-boundary-descriptor',
      issuerBoundary: 'external-kms-hsm',
      productionReady: true,
      liveProviderVerified: true,
      liveProviderProofState: 'valid',
      proofDigest: 'sha256:provider-live-proof',
      rawProviderResponseStored: false,
    },
    tokenIntrospectionStoreConfigured: true,
    tokenIntrospectionStoreDurability: 'local',
    replayConsumptionStoreConfigured: true,
    replayConsumptionStoreDurability: 'local',
    senderConfirmationSource: 'dpop-jkt',
    senderProofReplayStoreConfigured: true,
    senderProofReplayStoreDurability: 'shared',
    failClosedOnMissingIssuer: true,
    shadowRecordsRawToken: false,
    admissionOrShadowStoresRawToken: false,
    rawTokenReturnedOnlyToCaller: true,
  });

  equal(
    proof.readyForSelectedProfile,
    false,
    'Generic protected route: production-shared blocks local token authority stores',
  );
  includes(
    proof.blockers,
    'production-token-introspection-store-not-shared',
    'Generic protected route: production-shared requires shared token introspection store',
  );
  includes(
    proof.blockers,
    'production-replay-consumption-store-not-shared',
    'Generic protected route: production-shared requires shared replay consumption store',
  );
  includes(
    proof.noGoConditions,
    'durable-introspection-replay-store-not-proven',
    'Generic protected route: local introspection and replay stores keep durable-store no-go',
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

function testHostedBootstrapWiresIssuerBridgeWhenRuntimeProvidesIssuer(): void {
  const introspectionStore = {
    registerIssuedToken: async () => {
      throw new Error('introspection fixture should not be called by wiring test');
    },
    findToken: async () => null,
    revokeToken: async () => null,
    syncLifecycle: async () => [],
    recordTokenUse: async () => ({
      accepted: false,
      inactiveReason: 'unknown',
      record: null,
    }),
  };
  const deps = createGenericAdmissionRouteDeps(runtimeWith(undefined, {
    issue: async () => {
      throw new Error('issuer fixture should not be called by wiring test');
    },
    exportVerificationKey: async () => {
      throw new Error('issuer fixture should not export by wiring test');
    },
  }, introspectionStore));

  equal(
    typeof deps.resolveProtectedReleaseTokenConfirmation,
    'function',
    'Generic protected route: hosted bootstrap wires DPoP sender-confirmation resolver when issuer is present',
  );
  equal(
    typeof deps.issueProtectedReleaseToken,
    'function',
    'Generic protected route: hosted bootstrap wires protected release-token issuer when runtime provides issuer',
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
    /issuerConfigured:\s*true/u.test(apiRouteRuntime),
    'Generic protected route: API runtime records the active hosted issuer bridge',
  );
  ok(
    /senderConfirmationSource:\s*'dpop-jkt'/u.test(apiRouteRuntime),
    'Generic protected route: API runtime records the DPoP sender-confirmation source',
  );
  ok(
    /senderProofReplayStoreConfigured:\s*false/u.test(apiRouteRuntime),
    'Generic protected route: API runtime records missing DPoP proof replay store instead of overclaiming',
  );
  ok(
    /genericAdmissionProtectedIssuer:\s*apiReleaseTokenIssuer/u.test(apiRouteRuntime),
    'Generic protected route: API runtime passes the release-token issuer as a private service',
  );
  ok(
    /genericAdmissionProtectedIntrospectionStore:\s*apiReleaseIntrospectionStore/u.test(apiRouteRuntime),
    'Generic protected route: API runtime passes token introspection store as a private service',
  );
  ok(
    /tokenIntrospectionStoreDurability:/u.test(apiRouteRuntime) &&
      /release-token-introspection/u.test(apiRouteRuntime),
    'Generic protected route: API runtime records token introspection store durability',
  );
  ok(
    /issuerBoundaryEvidence:\s*\{/u.test(apiRouteRuntime) &&
      /runtime-signing-provider-diagnostics/u.test(apiRouteRuntime),
    'Generic protected route: API runtime records issuer boundary evidence instead of a bare boundary label',
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
testConfiguredRuntimeIssuerAndSenderProofClearEvaluationReadiness();
testProductionSharedNeedsExternalIssuerBoundary();
testProductionSharedNeedsSharedDpopProofReplayStore();
testProductionSharedNeedsSharedIntrospectionAndReplayStores();
testHostedBootstrapRequiresProtectedIssuerByDefault();
testHostedBootstrapWiresIssuerBridgeWhenRuntimeProvidesIssuer();
testHostedBootstrapAndReadinessExposeRouteProof();

console.log(`Generic admission protected route tests: ${passed} passed, 0 failed`);
