import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES,
  CONSEQUENCE_FAILURE_REPLAY_FIXTURE_MATRIX_VERSION,
  CONSEQUENCE_FAILURE_REPLAY_FIXTURES,
  consequenceFailureReplayFixtureMatrix,
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

function fixture(id: ConsequenceFailureModeId) {
  const found = CONSEQUENCE_FAILURE_REPLAY_FIXTURES.find((item) => item.failureModeId === id);
  assert.ok(found, `Missing replay fixture: ${id}`);
  return found;
}

function testMatrixShapeIsBoundAndConservative(): void {
  const registry = consequenceFailureModeRegistry();
  const matrix = consequenceFailureReplayFixtureMatrix();
  const ids = matrix.fixtures.map((item) => item.failureModeId);
  const uniqueIds = new Set(ids);

  equal(matrix.version, CONSEQUENCE_FAILURE_REPLAY_FIXTURE_MATRIX_VERSION, 'Replay matrix: version constant is used');
  equal(matrix.version, 'attestor.consequence-failure-replay-fixtures.v1', 'Replay matrix: version literal is stable');
  equal(matrix.registryVersion, registry.version, 'Replay matrix: registry version is bound');
  equal(matrix.registryDigest, registry.digest, 'Replay matrix: registry digest is bound');
  equal(matrix.fixtureCount, registry.entryCount, 'Replay matrix: fixture count matches registry entry count');
  equal(uniqueIds.size, ids.length, 'Replay matrix: fixture ids are unique');
  equal(matrix.approvalRequired, true, 'Replay matrix: approval is required');
  equal(matrix.autoEnforce, false, 'Replay matrix: auto enforce is false');
  equal(matrix.productionReady, false, 'Replay matrix: production readiness is false');
  equal(matrix.activatesEnforcement, false, 'Replay matrix: enforcement activation is false');
  equal(matrix.rawPayloadStored, false, 'Replay matrix: raw payload storage is false');
  equal(matrix.syntheticOnly, true, 'Replay matrix: fixtures are synthetic');
  equal(matrix.reviewMaterialOnly, true, 'Replay matrix: output is review material only');
  ok(matrix.digest.startsWith('sha256:'), 'Replay matrix: digest is generated');
  includes(matrix.canonical, '"version":"attestor.consequence-failure-replay-fixtures.v1"', 'Replay matrix: canonical payload includes version');
}

function testEveryRegistryAndBindingHasReplayFixture(): void {
  const registryIds = new Set(CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES.map((entry) => entry.id));
  const bindingById = new Map(
    CONSEQUENCE_FAILURE_CONTROL_BINDINGS.map((entry) => [entry.failureModeId, entry]),
  );
  const fixtureIds = new Set(CONSEQUENCE_FAILURE_REPLAY_FIXTURES.map((entry) => entry.failureModeId));

  for (const registryId of registryIds) {
    ok(fixtureIds.has(registryId), `Replay matrix: ${registryId} has a fixture`);
  }

  for (const item of CONSEQUENCE_FAILURE_REPLAY_FIXTURES) {
    const binding = bindingById.get(item.failureModeId);
    assert.ok(binding, `Replay matrix: ${item.failureModeId} has a binding`);
    equal(item.expectedDecision, binding.violationDecision, `Replay matrix: ${item.failureModeId} expected decision follows binding`);
    ok(item.digest.startsWith('sha256:'), `Replay matrix: ${item.failureModeId} has digest`);
    ok(item.scenario.length > 0, `Replay matrix: ${item.failureModeId} names scenario`);
    ok(item.riskyInput.length > 0, `Replay matrix: ${item.failureModeId} names risky input`);
    ok(item.intendedAiAction.length > 0, `Replay matrix: ${item.failureModeId} names intended action`);
    ok(item.hiddenRisk.length > 0, `Replay matrix: ${item.failureModeId} names hidden risk`);
    ok(item.missingEvidence.length > 0, `Replay matrix: ${item.failureModeId} names missing evidence`);
    ok(item.requiredNextStep.length > 0, `Replay matrix: ${item.failureModeId} names next step`);
    ok(item.expectedAuditRecords.length > 0, `Replay matrix: ${item.failureModeId} names audit records`);
    ok(item.catchingComponents.length > 0, `Replay matrix: ${item.failureModeId} names catching components`);
    ok(item.invariantIds.length > 0, `Replay matrix: ${item.failureModeId} names invariants`);
    ok(item.controlIds.length > 0, `Replay matrix: ${item.failureModeId} names controls`);
    equal(item.syntheticOnly, true, `Replay matrix: ${item.failureModeId} is synthetic`);
    equal(item.rawPayloadStored, false, `Replay matrix: ${item.failureModeId} stores no raw payload`);
    equal(item.executionAllowed, false, `Replay matrix: ${item.failureModeId} cannot execute`);
    equal(item.productionReady, false, `Replay matrix: ${item.failureModeId} is not production-ready proof`);
  }
}

function testRequiredConcreteEnterpriseCasesExist(): void {
  const fakeApproval = fixture('fake-approval-laundering');
  const indirect = fixture('indirect-prompt-injection');
  const stale = fixture('stale-authority-or-policy');
  const duplicate = fixture('duplicate-execution-replay');
  const crossTenant = fixture('cross-tenant-leakage');
  const wrongRecipient = fixture('wrong-recipient-disclosure');
  const noGo = fixture('no-go-hold-bypass');
  const scope = fixture('scope-explosion');

  includes(fakeApproval.scenario, 'Fake manager approval', 'Replay matrix: fake manager approval case exists');
  includes(indirect.scenario, 'Tool-returned document', 'Replay matrix: tool-result/indirect prompt case exists');
  includes(stale.scenario, 'last week approval', 'Replay matrix: stale approval case exists');
  includes(duplicate.scenario, 'repeats a payment or refund', 'Replay matrix: duplicate payment/refund case exists');
  includes(crossTenant.scenario, 'another tenant record', 'Replay matrix: cross-tenant summary leak case exists');
  includes(wrongRecipient.scenario, 'external customer', 'Replay matrix: wrong-recipient disclosure case exists');
  includes(noGo.scenario, 'fraud review', 'Replay matrix: fraud hold no-go case exists');
  equal(scope.expectedDecision, 'narrow', 'Replay matrix: scope explosion expects narrow decision');
}

function testDocsAndPackageScriptStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'failure-mode-replay-fixtures.md');
  const controlDoc = readProjectFile('docs', '02-architecture', 'failure-mode-control-bindings.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(doc, 'attestor.consequence-failure-replay-fixtures.v1', 'Replay matrix docs: version is named');
  includes(doc, 'src/consequence-admission/failure-mode-replay-fixtures.ts', 'Replay matrix docs: source file is named');
  includes(doc, 'test:failure-mode-replay-fixtures', 'Replay matrix docs: test command is named');
  includes(doc, 'fake-approval-laundering', 'Replay matrix docs: fake approval case is named');
  includes(doc, 'duplicate-execution-replay', 'Replay matrix docs: duplicate replay case is named');
  includes(doc, 'does not execute customer infrastructure', 'Replay matrix docs: no execution claim is present');
  includes(controlDoc, 'Replay Fixture Matrix can use `failureModeId`', 'Control binding docs: replay fixture matrix remains connected');
  equal(
    pkg.scripts['test:failure-mode-replay-fixtures'],
    'tsx tests/failure-mode-replay-fixtures.test.ts',
    'Package: replay fixture matrix test is exposed',
  );
}

try {
  testMatrixShapeIsBoundAndConservative();
  testEveryRegistryAndBindingHasReplayFixture();
  testRequiredConcreteEnterpriseCasesExist();
  testDocsAndPackageScriptStayAligned();
  console.log(`Failure mode replay fixture tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Failure mode replay fixture tests failed:', error);
  process.exitCode = 1;
}
