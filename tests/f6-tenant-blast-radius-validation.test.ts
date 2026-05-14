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
const packageJson = readProjectFile('package.json');

includes(validation, '# F6 Tenant Blast Radius Validation', 'F6 validation: title exists');
includes(validation, 'Corrected F6 Queue', 'F6 validation: corrected queue exists');
includes(validation, 'The current queue is eight PR-sized units', 'F6 validation: remaining queue size is explicit');
includes(validation, 'F6-T9 is fixed by a later remediation slice', 'F6 validation: later remediation status is explicit');
includes(validation, 'F6-T1', 'F6 validation: T1 is tracked');
includes(validation, 'F6-T10', 'F6 validation: T10 is tracked');
includes(validation, 'Generic admission tenant spoofing is stale', 'F6 validation: stale tenant spoofing subclaim is named');
includes(validation, '`partial`', 'F6 validation: partial status vocabulary is used');
includes(validation, '`invalid-as-stated`', 'F6 validation: invalid-as-stated status vocabulary is used');
includes(validation, '`open`', 'F6 validation: open status vocabulary is used');
excludes(validation, /certified|SOC 2 evidence packet/iu, 'F6 validation: avoids certification overclaim wording');

includes(tracker, 'F6 Multi-Tenant Blast Radius', 'Tracker: F6 section exists');
includes(tracker, 'F6-T1 shared PKI tenant binding', 'Tracker: F6-T1 is tracked');
includes(tracker, 'F6-T10 `default` tenant sentinel collision', 'Tracker: F6-T10 is tracked');
includes(tracker, 'Remaining F6 queue after tenant-key cache hardening slice: 5 planned', 'Tracker: F6 remaining count is explicit');
includes(tracker, 'F6 validation and tracker sync', 'Tracker: F6 queue names the current validation slice');

includes(tenantIsolation, 'tenantApiKeyLookupHash', 'Repo evidence: env tenant key cache uses hashed lookup material');
includes(tenantIsolation, 'tenantEnvKeyCacheStatus', 'Repo evidence: env tenant key cache exposes non-secret status');
includes(tenantIsolation, "ATTESTOR_RUNTIME_PROFILE?.trim() === 'production-shared'", 'Repo evidence: production-shared profile refuses env tenant keys');
includes(tenantIsolation, "tenantId: 'default'", 'Repo evidence: default anonymous sentinel exists');
includes(tenantIsolation, 'c.req.raw.headers.set', 'Repo evidence: tenant middleware overwrites internal headers');
includes(genericAdmissionRoutes, 'Admission tenantId must match the authenticated tenant context', 'Repo evidence: generic admission rejects tenant mismatch');
includes(genericAdmissionRoutes, 'tenantId: tenant.tenantId', 'Repo evidence: generic admission overwrites tenantId');
includes(releaseRuntime, 'generatePkiHierarchy(API_CA_SUBJECT, API_SIGNER_SUBJECT, API_REVIEWER_SUBJECT)', 'Repo evidence: release runtime uses runtime-wide PKI hierarchy');
includes(releaseRuntime, 'createReleaseTokenIssuer', 'Repo evidence: release token issuer is created from runtime signer');
includes(releaseObjectModel, 'readonly tenant_id', 'Repo evidence: release token claims include tenant_id');
includes(controlPlaneStore, 'isSharedControlPlaneConfigured', 'Repo evidence: shared control-plane mode exists');
includes(controlPlaneStore, 'usage_ledger', 'Repo evidence: PostgreSQL usage ledger exists');
includes(controlPlaneStore, 'consumePipelineRunState', 'Repo evidence: API-facing usage state can use shared store');
includes(usageMeter, 'Local single-node JSON ledger', 'Repo evidence: file usage meter is single-node');
includes(tenantRls, 'withTenantTransaction', 'Repo evidence: RLS helper exists');
includes(tenantRls, "set_config('app.tenant_id'", 'Repo evidence: RLS helper sets tenant context');
includes(productionStoragePath, 'production-shared-blocked', 'Repo evidence: production-shared storage gate can block evaluation stores');
includes(runtimeProfile, 'ATTESTOR_RUNTIME_PROFILE_ENV', 'Repo evidence: runtime profile env is explicit');
includes(runtimeProfile, 'isProductionLikeRuntimeEnv', 'Repo evidence: production-like runtime requires explicit profile');
includes(adminRoutes, 'currentAdminAuthorized', 'Repo evidence: admin routes use admin auth dependency');
ok(!adminRoutes.includes('currentTenant('), 'Repo evidence: admin routes do not call currentTenant directly');
includes(recipientReplay, 'CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION', 'Repo evidence: recipient tenant boundary module is replay-scoped');
includes(packageJson, '"test:f6-tenant-blast-radius-validation"', 'Package: F6 validation test script is exposed');

console.log(`F6 tenant blast-radius validation tests: ${passed} passed, 0 failed`);
