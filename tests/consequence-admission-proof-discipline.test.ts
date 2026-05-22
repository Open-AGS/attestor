import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceAdmissionRetryAttemptLedgerDescriptor,
} from '../src/consequence-admission/retry-attempt-ledger.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function lineFor(content: string, marker: string): string {
  const line = content.split(/\r?\n/u).find((entry) => entry.includes(marker));
  assert.ok(line, `Expected to find ${marker}`);
  return line;
}

function includes(content: string, expected: string, message: string): void {
  ok(content.includes(expected), message);
}

function testObservedFeaturesStayEvidenceOnly(): void {
  const source = readProjectFile('src', 'consequence-admission', 'index.ts');
  includes(
    source,
    'observedFeatures: normalizeGenericObservedFeatures(input.observedFeatures)',
    'Consequence admission proof discipline: observedFeatures are normalized from caller input',
  );
  includes(
    source,
    "return input.observedFeatures?.[key] === true",
    'Consequence admission proof discipline: feature checks are boolean evidence reads',
  );
  includes(
    source,
    "!observedFeatureTrue(input, 'adapterReady')",
    'Consequence admission proof discipline: adapter readiness remains an explicit check input',
  );
  includes(
    source,
    "adapterReady: observedFeatureTrue(input, 'adapterReady')",
    'Consequence admission proof discipline: adapter readiness is exposed as material evidence',
  );

  const quickstart = readProjectFile('docs', '01-overview', 'consequence-admission-quickstart.md');
  includes(
    quickstart,
    '`observedFeatures` are upstream/operator-derived evidence only.',
    'Consequence admission proof discipline: quickstart documents observedFeatures as evidence-only',
  );
  includes(
    quickstart,
    'they cannot grant authority, reduce evidence requirements, bypass review, or',
    'Consequence admission proof discipline: quickstart keeps feature observations from becoming authority',
  );
  includes(
    quickstart,
    'activate downstream execution.',
    'Consequence admission proof discipline: quickstart keeps feature observations from activating execution',
  );

  const hostedApi = readProjectFile('docs', '01-overview', 'hosted-action-authorization-api.md');
  includes(
    hostedApi,
    '`observedFeatures` are upstream/operator-derived evidence, not authority',
    'Consequence admission proof discipline: hosted API boundary documents feature trust origin',
  );
}

function testRetryLedgerSharedStoreStaysLiveProofOnly(): void {
  const descriptor = consequenceAdmissionRetryAttemptLedgerDescriptor();
  equal(
    descriptor.defaultStoreKind,
    'in-memory-reference',
    'Consequence retry ledger proof discipline: default store remains local reference',
  );
  equal(
    descriptor.productionSharedStoreIncluded,
    true,
    'Consequence retry ledger proof discipline: shared store contract exists',
  );
  equal(
    descriptor.productionSharedStoreRuntimeWired,
    false,
    'Consequence retry ledger proof discipline: production shared runtime is not claimed wired',
  );
  equal(
    descriptor.productionSharedStoreContractRef,
    'src/service/consequence-shared-atomic-stores.ts',
    'Consequence retry ledger proof discipline: descriptor points at shared atomic store contract',
  );

  const sharedStore = readProjectFile('src', 'service', 'consequence-shared-atomic-stores.ts');
  includes(
    sharedStore,
    'readonly rlsPolicyInstalled: true;',
    'Consequence retry ledger proof discipline: shared store has an RLS contract marker',
  );
  includes(
    sharedStore,
    'readonly rlsForced: false;',
    'Consequence retry ledger proof discipline: repo keeps FORCE RLS as live deployment proof',
  );
  includes(
    sharedStore,
    'readonly productionSharedRuntimeWired: false;',
    'Consequence retry ledger proof discipline: shared runtime wiring remains a no-claim',
  );
  includes(
    sharedStore,
    'ON CONFLICT DO NOTHING',
    'Consequence retry ledger proof discipline: duplicate attempt recording uses atomic conflict handling',
  );
  includes(
    sharedStore,
    'tenant_scope_digest',
    'Consequence retry ledger proof discipline: shared store schema is tenant-scope keyed',
  );
}

function testAuditIndexesAndLiveProofGateAgree(): void {
  const findingIndex = readProjectFile('docs', 'audit', 'finding-index.md');
  const ops167 = lineFor(findingIndex, 'OPS-167 caller-supplied `observedFeatures` trust origin');
  includes(ops167, '`closed`', 'OPS-167 is closed repo-side');
  includes(
    ops167,
    'Locking test: `tests/consequence-admission-proof-discipline.test.ts`.',
    'OPS-167 cites the proof-discipline locking test',
  );
  includes(
    ops167,
    'Stronger hosted admission claims still require an operator-attested feature-origin marker or route-side restriction.',
    'OPS-167 keeps the stronger hosted admission limitation visible',
  );

  const ops168 = lineFor(findingIndex, 'OPS-168 consequence retry-attempt ledger shared-store proof gap');
  includes(
    ops168,
    '`closed / live-proof-only`',
    'OPS-168 is closed repo-side and remains live-proof-only',
  );
  includes(
    ops168,
    'ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF',
    'OPS-168 names the live proof flag',
  );

  const liveProofRegister = readProjectFile('docs', 'audit', 'live-proof-register.md');
  const proofRow = lineFor(liveProofRegister, 'LP-CONSEQUENCE-RETRY-ATTEMPT-LEDGER-SHARED-STORE');
  includes(proofRow, '`repo-gated`', 'Consequence retry live proof is repo-gated');
  includes(
    proofRow,
    'ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF',
    'Live proof register names the consequence retry proof flag',
  );

  const opsGate = readProjectFile('scripts', 'check-ops-live-shadow-readiness.mjs');
  includes(
    opsGate,
    'ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF',
    'Ops live gate requires consequence retry proof before live-shadow claims',
  );
}

function testBaselineAndControlMapKeepNoClaims(): void {
  const baseline = readProjectFile('docs', 'audit', 'current-posture-baseline.md');
  includes(
    baseline,
    'OPS-167 is repo-side closed by evidence-only trust-origin documentation',
    'Baseline records OPS-167 repo-side closure',
  );
  includes(
    baseline,
    'OPS-168 is repo-side closed / live-proof-only through `ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF`',
    'Baseline records OPS-168 live-proof gate',
  );
  includes(
    baseline,
    'production remains not proven',
    'Baseline keeps production readiness separated from repo evidence',
  );

  const controlMap = readProjectFile('docs', 'audit', 'control-map.md');
  includes(
    controlMap,
    'observedFeatures are documented as upstream/operator-derived evidence only',
    'Control map records observedFeatures authority boundary',
  );
  includes(
    controlMap,
    'ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF',
    'Control map names the consequence retry proof flag',
  );
  includes(
    controlMap,
    'Customer PEP no-bypass remains behind `LP-CUSTOMER-PEP-NO-BYPASS`',
    'Control map keeps customer PEP no-bypass as live proof',
  );
}

testObservedFeaturesStayEvidenceOnly();
testRetryLedgerSharedStoreStaysLiveProofOnly();
testAuditIndexesAndLiveProofGateAgree();
testBaselineAndControlMapKeepNoClaims();

console.log(`Consequence admission proof-discipline tests: ${passed} passed, 0 failed`);
