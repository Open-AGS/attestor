import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

const validation = readProjectFile('docs', 'audit', 'f6-tenant-blast-radius-validation.md');
const anonymousSentinelValidation = readProjectFile('docs', 'audit', 'f6-anonymous-tenant-sentinel.md');
const bypassRouteValidation = readProjectFile('docs', 'audit', 'f6-bypass-route-tenant-context-invariant.md');
const rlsClaimAlignment = readProjectFile('docs', 'audit', 'f6-rls-claim-alignment.md');
const usageMeterBoundary = readProjectFile('docs', 'audit', 'f6-usage-meter-shared-store-boundary.md');
const recipientRuntimeBoundary = readProjectFile('docs', 'audit', 'f6-recipient-tenant-runtime-boundary.md');
const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
const tenantIsolation = readProjectFile('src', 'service', 'tenant-isolation.ts');
const genericAdmissionRoutes = readProjectFile(
  'src',
  'service',
  'http',
  'routes',
  'generic-admission-routes.ts',
);
const releaseRuntime = readProjectFile('src', 'service', 'bootstrap', 'release-runtime.ts');
const releaseObjectModel = readProjectFile('src', 'release-kernel', 'object-model.ts');
const controlPlaneStore = readProjectFile('src', 'service', 'control-plane-store.ts');
const controlPlaneSchema = readProjectFile('src', 'service', 'control-plane-store', 'schema.ts');
const usageMeter = readProjectFile('src', 'service', 'usage-meter.ts');
const tenantRls = readProjectFile('src', 'service', 'tenant-rls.ts');
const productionStoragePath = readProjectFile(
  'src',
  'service',
  'bootstrap',
  'production-storage-path.ts',
);
const runtimeProfile = readProjectFile('src', 'service', 'bootstrap', 'runtime-profile.ts');
const adminRoutes = readProjectFile('src', 'service', 'http', 'routes', 'admin-routes.ts');
const recipientReplay = readProjectFile(
  'src',
  'consequence-admission',
  'recipient-tenant-boundary-replay.ts',
);
const recipientRuntime = readProjectFile(
  'src',
  'consequence-admission',
  'recipient-tenant-boundary-runtime.ts',
);
const packageJson = readProjectFile('package.json');

includes(validation, '# F6 Tenant Blast Radius Validation', 'F6 validation: title exists');
includes(validation, 'Corrected F6 Queue', 'F6 validation: corrected queue exists');
includes(validation, 'The current queue is eight PR-sized units', 'F6 validation: remaining queue size is explicit');
includes(validation, 'F6-T9 and F6-T10 are fixed by later remediation slices', 'F6 validation: later remediation status is explicit');
includes(validation, 'F6-T1', 'F6 validation: T1 is tracked');
includes(validation, 'F6-T10', 'F6 validation: T10 is tracked');
includes(validation, 'Generic admission tenant spoofing is stale', 'F6 validation: stale tenant spoofing subclaim is named');
includes(validation, '`partial`', 'F6 validation: partial status vocabulary is used');
includes(validation, '`invalid-as-stated`', 'F6 validation: invalid-as-stated status vocabulary is used');
excludes(validation, /\| `open` \|/u, 'F6 validation: no F6 item remains open after anonymous sentinel hardening');
excludes(validation, /certified|SOC 2 evidence packet/iu, 'F6 validation: avoids certification overclaim wording');

includes(tracker, 'F6 Multi-Tenant Blast Radius', 'Tracker: F6 section exists');
includes(tracker, 'F6-T1 shared PKI tenant binding', 'Tracker: F6-T1 is tracked');
includes(tracker, 'F6-T10 `default` tenant sentinel collision', 'Tracker: F6-T10 is tracked');
includes(tracker, 'Remaining F6 queue after recipient/tenant runtime boundary bridge: 0 planned', 'Tracker: F6 remaining count is explicit');
includes(tracker, 'F6 validation and tracker sync', 'Tracker: F6 queue names the current validation slice');
includes(tracker, 'F6-T2 RLS declared but not data-path wired | `accepted-limitation`', 'Tracker: F6-T2 is accepted limitation');
includes(tracker, 'F6-T5 bypass route tenant-header spoofing | `fixed`', 'Tracker: F6-T5 is fixed');
includes(tracker, 'F6-T10 `default` tenant sentinel collision | `fixed`', 'Tracker: F6-T10 is fixed');

includes(tenantIsolation, 'tenantApiKeyLookupHash', 'Repo evidence: env tenant key cache uses hashed lookup material');
includes(tenantIsolation, 'tenantEnvKeyCacheStatus', 'Repo evidence: env tenant key cache exposes non-secret status');
includes(tenantIsolation, "ATTESTOR_RUNTIME_PROFILE?.trim() === 'production-shared'", 'Repo evidence: production-shared profile refuses env tenant keys');
includes(tenantIsolation, "ANONYMOUS_TENANT_ID = '__attestor_anonymous__'", 'Repo evidence: reserved anonymous sentinel exists');
includes(tenantIsolation, "LEGACY_ANONYMOUS_TENANT_ID = 'default'", 'Repo evidence: legacy anonymous default compatibility exists');
includes(tenantIsolation, 'isAnonymousTenantContext', 'Repo evidence: anonymous tenant classification helper exists');
includes(tenantIsolation, 'clearTenantContextHeaders', 'Repo evidence: tenant context headers can be cleared');
includes(tenantIsolation, 'hasVerifiedTenantContext', 'Repo evidence: tenant context verification marker exists');
includes(tenantIsolation, 'c.req.raw.headers.set', 'Repo evidence: tenant middleware overwrites internal headers');
includes(genericAdmissionRoutes, 'Admission tenantId must match the authenticated tenant context', 'Repo evidence: generic admission rejects tenant mismatch');
includes(genericAdmissionRoutes, 'tenantId: tenant.tenantId', 'Repo evidence: generic admission overwrites tenantId');
includes(releaseRuntime, 'generatePkiHierarchy(API_CA_SUBJECT, API_SIGNER_SUBJECT, API_REVIEWER_SUBJECT)', 'Repo evidence: release runtime uses runtime-wide PKI hierarchy');
includes(releaseRuntime, 'createReleaseTokenIssuer', 'Repo evidence: release token issuer is created from runtime signer');
includes(releaseObjectModel, 'readonly tenant_id', 'Repo evidence: release token claims include tenant_id');
includes(controlPlaneStore, 'isSharedControlPlaneConfigured', 'Repo evidence: shared control-plane mode exists');
includes(controlPlaneSchema, 'usage_ledger', 'Repo evidence: PostgreSQL usage ledger exists');
includes(controlPlaneStore, 'consumePipelineRunState', 'Repo evidence: API-facing usage state can use shared store');
includes(usageMeter, 'Local single-node JSON ledger', 'Repo evidence: file usage meter is single-node');
includes(usageMeter, 'usageMeterStorageDescriptor', 'Repo evidence: usage meter storage descriptor exists');
includes(tenantRls, 'withTenantTransaction', 'Repo evidence: RLS helper exists');
includes(tenantRls, "set_config('app.tenant_id'", 'Repo evidence: RLS helper sets tenant context');
includes(tenantRls, 'sample/probe substrate', 'Repo evidence: RLS helper claim is narrowed');
includes(productionStoragePath, 'production-shared-blocked', 'Repo evidence: production-shared storage gate can block evaluation stores');
includes(runtimeProfile, 'ATTESTOR_RUNTIME_PROFILE_ENV', 'Repo evidence: runtime profile env is explicit');
includes(runtimeProfile, 'isProductionLikeRuntimeEnv', 'Repo evidence: production-like runtime requires explicit profile');
includes(adminRoutes, 'currentAdminAuthorized', 'Repo evidence: admin routes use admin auth dependency');
ok(!adminRoutes.includes('currentTenant('), 'Repo evidence: admin routes do not call currentTenant directly');
includes(recipientReplay, 'CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION', 'Repo evidence: recipient tenant boundary module is replay-scoped');
includes(recipientRuntime, 'CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_RUNTIME_VERSION', 'Repo evidence: recipient tenant boundary runtime bridge exists');
includes(recipientRuntime, 'allowed: result.outcome ===', 'Repo evidence: runtime boundary emits allow/deny decision');
includes(packageJson, '"test:f6-tenant-blast-radius-validation"', 'Package: F6 validation test script is exposed');
includes(packageJson, '"test:f6-anonymous-tenant-sentinel"', 'Package: F6 anonymous sentinel test script is exposed');
includes(packageJson, '"test:f6-bypass-route-tenant-context-invariant"', 'Package: F6 bypass route tenant-context test script is exposed');
includes(packageJson, '"test:f6-rls-claim-alignment"', 'Package: F6 RLS claim alignment test script is exposed');
includes(packageJson, '"test:f6-usage-meter-shared-store-boundary"', 'Package: F6 usage-meter shared-store boundary test script is exposed');
includes(packageJson, '"test:f6-recipient-tenant-runtime-boundary"', 'Package: F6 recipient/tenant runtime boundary test script is exposed');

includes(anonymousSentinelValidation, '# F6 Anonymous Tenant Sentinel Validation', 'F6 anonymous sentinel validation: title exists');
includes(anonymousSentinelValidation, '__attestor_anonymous__', 'F6 anonymous sentinel validation: reserved sentinel is documented');
includes(anonymousSentinelValidation, 'an API-key tenant named `default` remains distinct', 'F6 anonymous sentinel validation: real default tenant remains distinct');
includes(bypassRouteValidation, '# F6 Bypass Route Tenant Context Invariant', 'F6 bypass route validation: title exists');
includes(bypassRouteValidation, 'x-attestor-tenant-context-verified', 'F6 bypass route validation: verified marker is documented');
includes(bypassRouteValidation, 'currentTenant` refuses spoofed bypass-route tenant ids', 'F6 bypass route validation: runtime invariant is documented');
includes(rlsClaimAlignment, '# F6 RLS Claim Alignment', 'F6 RLS claim alignment: title exists');
includes(rlsClaimAlignment, 'does not wire PostgreSQL Row-Level Security into Attestor', 'F6 RLS claim alignment: non-goal is documented');
includes(usageMeterBoundary, '# F6 Usage Meter Shared-Store Boundary', 'F6 usage-meter boundary: title exists');
includes(usageMeterBoundary, 'file-backed usage meter is local/single-node only', 'F6 usage-meter boundary: file ledger scope is documented');
includes(recipientRuntimeBoundary, '# F6 Recipient/Tenant Runtime Boundary Bridge', 'F6 recipient runtime boundary: title exists');
includes(recipientRuntimeBoundary, 'central runtime decision surface', 'F6 recipient runtime boundary: central bridge is documented');

console.log(`F6 tenant blast-radius validation tests: ${passed} passed, 0 failed`);
