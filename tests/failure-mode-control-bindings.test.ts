import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION,
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  CONSEQUENCE_FAILURE_CONTROL_INVARIANT_IDS,
  CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES,
  consequenceFailureControlBindingContract,
  consequenceFailureModeRegistry,
  type ConsequenceFailureModeId,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function binding(id: ConsequenceFailureModeId) {
  const found = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find((item) => item.failureModeId === id);
  assert.ok(found, `Missing failure control binding: ${id}`);
  return found;
}

function testContractShapeIsDeterministicAndConservative(): void {
  const registry = consequenceFailureModeRegistry();
  const contract = consequenceFailureControlBindingContract();

  equal(contract.version, CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION, 'Control binding contract: version constant is used');
  equal(contract.version, 'attestor.consequence-failure-control-binding.v1', 'Control binding contract: version literal is stable');
  equal(contract.registryVersion, registry.version, 'Control binding contract: registry version is bound');
  equal(contract.registryDigest, registry.digest, 'Control binding contract: registry digest is bound');
  equal(contract.bindingCount, registry.entryCount, 'Control binding contract: every registry entry is bound');
  equal(contract.invariantCount, CONSEQUENCE_FAILURE_CONTROL_INVARIANT_IDS.length, 'Control binding contract: every invariant is cataloged');
  equal(contract.approvalRequired, true, 'Control binding contract: approval is required');
  equal(contract.autoEnforce, false, 'Control binding contract: auto enforce is false');
  equal(contract.productionReady, false, 'Control binding contract: production readiness is false');
  equal(contract.activatesEnforcement, false, 'Control binding contract: enforcement activation is false');
  equal(contract.rawPayloadStored, false, 'Control binding contract: raw payload storage is false');
  ok(contract.digest.startsWith('sha256:'), 'Control binding contract: digest is generated');
  includes(contract.canonical, '"version":"attestor.consequence-failure-control-binding.v1"', 'Control binding contract: canonical payload includes version');
}

function testEveryRegistryEntryIsBoundWithoutLosingControls(): void {
  const registryEntriesById = new Map(
    CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES.map((entry) => [entry.id, entry]),
  );
  const bindingIds = new Set(CONSEQUENCE_FAILURE_CONTROL_BINDINGS.map((item) => item.failureModeId));

  equal(bindingIds.size, CONSEQUENCE_FAILURE_CONTROL_BINDINGS.length, 'Control binding contract: binding ids are unique');
  for (const registryEntry of CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES) {
    ok(bindingIds.has(registryEntry.id), `Control binding contract: ${registryEntry.id} is bound`);
  }

  for (const item of CONSEQUENCE_FAILURE_CONTROL_BINDINGS) {
    const registryEntry = registryEntriesById.get(item.failureModeId);
    assert.ok(registryEntry, `Control binding contract: ${item.failureModeId} has a registry entry`);
    equal(item.defaultDecision, registryEntry.defaultDecision, `Control binding contract: ${item.failureModeId} default decision matches registry`);
    equal(item.violationDecision, registryEntry.defaultDecision, `Control binding contract: ${item.failureModeId} violation decision matches registry`);
    ok(item.invariantIds.length > 0, `Control binding contract: ${item.failureModeId} has invariants`);
    ok(item.enforcementPhases.length > 0, `Control binding contract: ${item.failureModeId} has enforcement phases`);
    ok(item.requiredEvidence.length > 0, `Control binding contract: ${item.failureModeId} has required evidence`);
    ok(item.requiredAuthority.length > 0, `Control binding contract: ${item.failureModeId} has required authority`);
    ok(item.requiredAuditRecords.length > 0, `Control binding contract: ${item.failureModeId} has audit records`);
    ok(item.replayRequired, `Control binding contract: ${item.failureModeId} requires replay`);
    for (const control of registryEntry.requiredControls) {
      ok(item.controlIds.includes(control), `Control binding contract: ${item.failureModeId} carries registry control ${control}`);
    }
  }
}

function testHighRiskBindingsUseExpectedInvariants(): void {
  const untrusted = binding('untrusted-content-authorizes-action');
  const fakeApproval = binding('fake-approval-laundering');
  const stale = binding('stale-authority-or-policy');
  const replay = binding('duplicate-execution-replay');
  const supplyChain = binding('agentic-supply-chain-compromise');

  ok(
    untrusted.invariantIds.includes('untrusted-content-cannot-authorize-action'),
    'Control binding contract: untrusted content maps to untrusted-content invariant',
  );
  ok(
    untrusted.invariantIds.includes('verified-approval-provenance-required'),
    'Control binding contract: untrusted content maps to approval provenance invariant',
  );
  equal(untrusted.violationDecision, 'block', 'Control binding contract: untrusted content violation blocks');

  ok(
    fakeApproval.invariantIds.includes('verified-approval-provenance-required'),
    'Control binding contract: fake approval maps to approval provenance invariant',
  );
  ok(
    stale.invariantIds.includes('decision-context-version-must-be-bound'),
    'Control binding contract: stale policy maps to decision context version invariant',
  );
  ok(
    replay.invariantIds.includes('replay-and-idempotency-required-before-execution'),
    'Control binding contract: replay maps to replay/idempotency invariant',
  );
  ok(
    supplyChain.invariantIds.includes('least-privilege-tooling-and-supply-chain-review'),
    'Control binding contract: supply chain maps to least privilege review invariant',
  );
}

function testDocsAndPackageScriptStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'failure-mode-control-bindings.md');
  const registryDoc = readProjectFile('docs', '02-architecture', 'failure-mode-registry.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(doc, 'attestor.consequence-failure-control-binding.v1', 'Control binding docs: version is named');
  includes(doc, 'src/consequence-admission/failure-mode-control-bindings.ts', 'Control binding docs: source file is named');
  includes(doc, 'test:failure-mode-control-bindings', 'Control binding docs: test command is named');
  includes(doc, 'untrusted-content-cannot-authorize-action', 'Control binding docs: untrusted-content invariant is named');
  includes(doc, 'review-or-block-cannot-auto-promote', 'Control binding docs: auto-promote invariant is named');
  includes(doc, 'does not activate enforcement', 'Control binding docs: no enforcement claim is present');
  includes(registryDoc, 'give the next Control Binding Contract step stable ids', 'Failure registry docs: control binding step remains connected');
  equal(
    pkg.scripts['test:failure-mode-control-bindings'],
    'tsx tests/failure-mode-control-bindings.test.ts',
    'Package: control binding test is exposed',
  );
}

try {
  testContractShapeIsDeterministicAndConservative();
  testEveryRegistryEntryIsBoundWithoutLosingControls();
  testHighRiskBindingsUseExpectedInvariants();
  testDocsAndPackageScriptStayAligned();
  console.log(`Failure mode control binding tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Failure mode control binding tests failed:', error);
  process.exitCode = 1;
}
