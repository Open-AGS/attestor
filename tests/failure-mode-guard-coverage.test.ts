import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_ENTRIES,
  CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_VERSION,
  CONSEQUENCE_FAILURE_MODE_IDS,
  consequenceAdmissionDescriptor,
  consequenceFailureControlBindingContract,
  consequenceFailureModeGuardCoverageMatrix,
  consequenceFailureReplayFixtureMatrix,
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

function coverage(id: ConsequenceFailureModeId) {
  const found = CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_ENTRIES.find((item) =>
    item.failureModeId === id
  );
  assert.ok(found, `Missing failure mode guard coverage entry: ${id}`);
  return found;
}

function assertProjectPathExists(path: string, label: string): void {
  ok(existsSync(join(process.cwd(), path)), `${label}: ${path} exists`);
}

function testCoverageMatrixShapeIsConservative(): void {
  const matrix = consequenceFailureModeGuardCoverageMatrix();
  const binding = consequenceFailureControlBindingContract();
  const replay = consequenceFailureReplayFixtureMatrix();
  const ids = matrix.entries.map((entry) => entry.failureModeId);
  const uniqueIds = new Set(ids);

  equal(matrix.version, CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_VERSION, 'Guard coverage: version constant is used');
  equal(matrix.version, 'attestor.consequence-failure-mode-guard-coverage.v1', 'Guard coverage: version literal is stable');
  equal(matrix.entryCount, CONSEQUENCE_FAILURE_MODE_IDS.length, 'Guard coverage: every failure mode has coverage entry');
  equal(uniqueIds.size, ids.length, 'Guard coverage: ids are unique');
  equal(matrix.controlBindingVersion, binding.version, 'Guard coverage: control binding version is bound');
  equal(matrix.replayFixtureMatrixVersion, replay.version, 'Guard coverage: replay fixture version is bound');
  equal(matrix.approvalRequired, true, 'Guard coverage: approval remains required');
  equal(matrix.autoEnforce, false, 'Guard coverage: auto enforce is false');
  equal(matrix.productionReady, false, 'Guard coverage: production readiness is false');
  equal(matrix.activatesEnforcement, false, 'Guard coverage: activation is false');
  equal(matrix.rawPayloadStored, false, 'Guard coverage: raw payload storage is false');
  ok(matrix.digest.startsWith('sha256:'), 'Guard coverage: digest is generated');
  includes(matrix.canonical, '"version":"attestor.consequence-failure-mode-guard-coverage.v1"', 'Guard coverage: canonical payload includes version');
}

function testCoverageEntriesHaveConcreteEvidence(): void {
  for (const item of CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_ENTRIES) {
    ok(item.controlBindingPresent, `Guard coverage: ${item.failureModeId} has control binding`);
    ok(item.replayFixturePresent, `Guard coverage: ${item.failureModeId} has replay fixture`);
    ok(item.codeEvidencePaths.length > 0, `Guard coverage: ${item.failureModeId} has code evidence`);
    ok(item.testEvidencePaths.length > 0, `Guard coverage: ${item.failureModeId} has test evidence`);
    ok(item.docEvidencePaths.length > 0, `Guard coverage: ${item.failureModeId} has doc evidence`);
    ok(item.notProven.length > 0, `Guard coverage: ${item.failureModeId} states what is not proven`);
    ok(item.limitation.trim().length > 0, `Guard coverage: ${item.failureModeId} has limitation language`);
    assertProjectPathExists(item.primaryImplementationPath, `Guard coverage ${item.failureModeId}`);
    for (const path of [...item.codeEvidencePaths, ...item.testEvidencePaths, ...item.docEvidencePaths]) {
      assertProjectPathExists(path, `Guard coverage ${item.failureModeId}`);
    }
    if (item.dedicatedGuardPresent) {
      ok(item.primaryImplementationPath.endsWith('-guard.ts'), `Guard coverage: ${item.failureModeId} dedicated guard points at guard module`);
      equal(item.coverageKind, 'dedicated-guard', `Guard coverage: ${item.failureModeId} dedicated guard uses dedicated kind`);
      equal(item.activationReadinessRequired, true, `Guard coverage: ${item.failureModeId} dedicated guard requires activation readiness`);
    }
  }
}

function testKnownGapsAreExplicitlyNotOverclaimed(): void {
  const directPrompt = coverage('direct-prompt-injection');
  const indirectPrompt = coverage('indirect-prompt-injection');
  const modelDrift = coverage('model-tool-config-drift');
  const multiAgent = coverage('multi-agent-delegation-confusion');
  const supplyChain = coverage('agentic-supply-chain-compromise');
  const untrusted = coverage('untrusted-content-authorizes-action');
  const toolResult = coverage('tool-result-poisoning');
  const approval = coverage('fake-approval-laundering');

  equal(directPrompt.coverageKind, 'replay-contract', 'Guard coverage: direct prompt injection is replay-backed, not overclaimed');
  equal(indirectPrompt.coverageKind, 'integration-required', 'Guard coverage: indirect prompt injection remains integration-required');
  equal(modelDrift.coverageKind, 'deterministic-contract', 'Guard coverage: model/tool/config drift has deterministic contract coverage');
  equal(modelDrift.primaryImplementationPath, 'src/consequence-admission/decision-context-drift-binding.ts', 'Guard coverage: model/tool/config drift points to actual binding module');
  equal(multiAgent.coverageKind, 'dedicated-guard', 'Guard coverage: multi-agent delegation has dedicated guard coverage');
  equal(multiAgent.dedicatedGuardPresent, true, 'Guard coverage: multi-agent delegation is marked as dedicated guard');
  equal(supplyChain.coverageKind, 'dedicated-guard', 'Guard coverage: supply-chain compromise has dedicated guard coverage');
  equal(supplyChain.dedicatedGuardPresent, true, 'Guard coverage: supply-chain compromise is marked as dedicated guard');
  equal(untrusted.dedicatedGuardPresent, true, 'Guard coverage: untrusted content has dedicated guard');
  equal(toolResult.dedicatedGuardPresent, true, 'Guard coverage: tool result poisoning has dedicated guard');
  equal(approval.dedicatedGuardPresent, true, 'Guard coverage: fake approval laundering has dedicated guard');
}

function testDocsPackageAndPublicSurfaceStayAligned(): void {
  const docs = readProjectFile('docs', '02-architecture', 'failure-mode-guard-coverage.md');
  const registryDocs = readProjectFile('docs', '02-architecture', 'failure-mode-registry.md');
  const packageJson = readProjectFile('package.json');
  const publicSurface = readProjectFile('src', 'consequence-admission', 'public-surface.ts');
  const probe = readProjectFile('scripts', 'probe-consequence-admission-package-surface.mjs');
  const descriptor = consequenceAdmissionDescriptor();

  includes(docs, 'attestor.consequence-failure-mode-guard-coverage.v1', 'Guard coverage docs: version is named');
  includes(docs, 'test:failure-mode-guard-coverage', 'Guard coverage docs: test command is named');
  includes(docs, 'not a certification', 'Guard coverage docs: no-certification disclaimer is present');
  includes(registryDocs, 'guard coverage matrix', 'Failure registry docs: guard coverage step is referenced');
  includes(packageJson, '"test:failure-mode-guard-coverage"', 'Package: guard coverage script is exposed');
  includes(publicSurface, "export * from './failure-mode-guard-coverage.js';", 'Consequence admission public surface: guard coverage module is exported');
  includes(probe, 'consequenceFailureModeGuardCoverageMatrix', 'Package probe: guard coverage public surface is checked');
  equal(
    descriptor.failureModeGuardCoverageVersion,
    CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_VERSION,
    'Admission descriptor: guard coverage version is exposed',
  );
  equal(
    descriptor.failureModeGuardCoverage.entryCount,
    CONSEQUENCE_FAILURE_MODE_IDS.length,
    'Admission descriptor: guard coverage matrix is exposed',
  );
}

try {
  testCoverageMatrixShapeIsConservative();
  testCoverageEntriesHaveConcreteEvidence();
  testKnownGapsAreExplicitlyNotOverclaimed();
  testDocsPackageAndPublicSurfaceStayAligned();
  console.log(`Failure mode guard coverage tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Failure mode guard coverage tests failed:', error);
  process.exitCode = 1;
}
