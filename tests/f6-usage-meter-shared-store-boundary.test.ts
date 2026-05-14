import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { usageMeterStorageDescriptor } from '../src/service/usage-meter.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

const descriptor = usageMeterStorageDescriptor();
const usageMeter = readProjectFile('src', 'service', 'usage-meter.ts');
const controlPlaneStore = readProjectFile('src', 'service', 'control-plane-store.ts');
const deployment = readProjectFile('docs', '08-deployment', 'deployment.md');
const validation = readProjectFile('docs', 'audit', 'f6-tenant-blast-radius-validation.md');
const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
const boundaryDoc = readProjectFile('docs', 'audit', 'f6-usage-meter-shared-store-boundary.md');
const packageJson = readProjectFile('package.json');

equal(descriptor.backend, 'file-json-ledger', 'Usage meter descriptor: file backend is explicit');
equal(descriptor.profileScope, 'local-or-single-node', 'Usage meter descriptor: profile scope is local/single-node');
equal(descriptor.multiNodeSafe, false, 'Usage meter descriptor: file ledger is not multi-node safe');
equal(descriptor.sharedStorePath, 'control-plane-store', 'Usage meter descriptor: shared store path is named');
equal(descriptor.sharedStoreEnv, 'ATTESTOR_CONTROL_PLANE_PG_URL', 'Usage meter descriptor: shared store env is named');

includes(usageMeter, 'Local single-node JSON ledger', 'Usage meter source: single-node file ledger boundary remains explicit');
includes(usageMeter, 'Production-shared API paths must use control-plane-store usage state', 'Usage meter source: production-shared path is directed to control-plane store');
includes(usageMeter, 'no shared multi-node billing datastore', 'Usage meter source: file ledger does not claim shared multi-node safety');

includes(controlPlaneStore, 'consumePipelineRunState', 'Control-plane store: API-facing usage consume state exists');
includes(controlPlaneStore, 'isSharedControlPlaneConfigured', 'Control-plane store: shared mode switch exists');
includes(controlPlaneStore, 'attestor_control_plane.usage_ledger', 'Control-plane store: shared PostgreSQL usage ledger exists');
includes(controlPlaneStore, 'ON CONFLICT (tenant_id, period) DO UPDATE SET', 'Control-plane store: shared usage increment is atomic at row level');

includes(deployment, 'File-backed single-node usage ledger for hosted quota enforcement when `ATTESTOR_CONTROL_PLANE_PG_URL` is not configured', 'Deployment docs: file ledger is scoped to no shared control-plane PG');
includes(validation, 'F6-T4 | Usage-meter quota enforcement is single-node/per-pod. | `partial`', 'F6 validation: T4 remains partial');
includes(validation, 'claim boundary now distinguishes the single-node file ledger from the shared PostgreSQL control-plane usage ledger', 'F6 validation: T4 claim boundary is documented');
includes(tracker, 'F6-T4 usage-meter single-node quota | `partial`', 'Tracker: F6-T4 remains partial');
includes(tracker, 'Remaining F6 queue after usage-meter shared-store boundary slice: 1 planned', 'Tracker: remaining queue count is updated');
includes(boundaryDoc, '# F6 Usage Meter Shared-Store Boundary', 'Boundary doc: title exists');
includes(boundaryDoc, 'file-backed usage meter is local/single-node only', 'Boundary doc: file ledger limitation is explicit');
includes(boundaryDoc, 'ATTESTOR_CONTROL_PLANE_PG_URL', 'Boundary doc: shared control-plane env is documented');
includes(packageJson, '"test:f6-usage-meter-shared-store-boundary"', 'Package: F6 usage-meter boundary test script is exposed');

console.log(`F6 usage-meter shared-store boundary tests: ${passed} passed, 0 failed`);
