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

const tenantRls = readProjectFile('src', 'service', 'tenant-rls.ts');
const rlsRuntime = readProjectFile('src', 'service', 'runtime', 'rls-runtime.ts');
const controlPlaneStore = readProjectFile('src', 'service', 'control-plane-store.ts');
const deployment = readProjectFile('docs', '08-deployment', 'deployment.md');
const validation = readProjectFile('docs', 'audit', 'f6-tenant-blast-radius-validation.md');
const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
const claimAlignment = readProjectFile('docs', 'audit', 'f6-rls-claim-alignment.md');
const packageJson = readProjectFile('package.json');

includes(tenantRls, 'sample/probe substrate', 'RLS helper: sample/probe boundary is explicit');
includes(tenantRls, "does not protect Attestor's main", 'RLS helper: main control-plane non-claim is explicit');
includes(tenantRls, 'withTenantTransaction', 'RLS helper: transaction helper remains present');
includes(tenantRls, "set_config('app.tenant_id'", 'RLS helper: tenant context remains transaction-local');
includes(tenantRls, 'Sample/probe tables only', 'RLS helper: boundary list names sample/probe tables');

includes(rlsRuntime, 'sample/probe tables', 'RLS runtime: auto-activation scope is narrowed');
includes(rlsRuntime, 'not evidence that the main control-plane stores use RLS', 'RLS runtime: main store non-claim is explicit');

ok(!controlPlaneStore.includes('withTenantTransaction('), 'Control-plane store: still not wired through tenant RLS helper');
ok(!controlPlaneStore.includes("set_config('app.tenant_id'"), 'Control-plane store: does not set app.tenant_id directly');

includes(deployment, 'RLS sample/probe substrate', 'Deployment docs: ATTESTOR_PG_URL is scoped to sample/probe RLS');
includes(deployment, 'does not by itself move main control-plane stores onto database-enforced RLS', 'Deployment docs: no automatic main-store RLS claim');
excludes(deployment, /PostgreSQL RLS tenant isolation\b/u, 'Deployment docs: old broad RLS tenant-isolation claim is removed');

includes(validation, 'F6-T2 | RLS infrastructure is declared but not wired into data paths. | `accepted-limitation`', 'F6 validation: T2 status is accepted-limitation');
includes(validation, 'Deployment docs now avoid claiming that `ATTESTOR_PG_URL` moves main stores onto RLS', 'F6 validation: claim alignment evidence is explicit');
includes(tracker, 'F6-T2 RLS declared but not data-path wired | `accepted-limitation`', 'Tracker: F6-T2 status is accepted-limitation');
includes(tracker, 'Remaining F6 queue after RLS claim-alignment slice: 2 planned', 'Tracker: remaining F6 queue count is updated');

includes(claimAlignment, '# F6 RLS Claim Alignment', 'Claim alignment doc: title exists');
includes(claimAlignment, "does not wire PostgreSQL Row-Level Security into Attestor's main", 'Claim alignment doc: non-goal is explicit');
includes(claimAlignment, 'future PR must either wire concrete stores through', 'Claim alignment doc: future fixed condition is explicit');
includes(packageJson, '"test:f6-rls-claim-alignment"', 'Package: F6 RLS claim alignment test script is exposed');

console.log(`F6 RLS claim alignment tests: ${passed} passed, 0 failed`);
