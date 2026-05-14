import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceFailureModeGuardCoverageMatrix,
  evaluateConsequenceDecisionContextDrift,
  type ConsequenceDecisionContextBindingContext,
} from '../src/consequence-admission/index.js';

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

function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}

function context(overrides?: Partial<ConsequenceDecisionContextBindingContext>):
ConsequenceDecisionContextBindingContext {
  return {
    modelVersion: 'gpt-5.4-mini:2026-05-01',
    toolSchemaDigest: digest('a'),
    toolManifestDigest: digest('b'),
    policyVersion: 'refund-policy:v4',
    policyDigest: digest('c'),
    configDigest: digest('d'),
    promptDigest: digest('e'),
    verifierDigest: digest('f'),
    simulationDigest: digest('1'),
    evaluatedAt: '2026-05-13T10:00:00.000Z',
    expiresAt: '2026-05-14T10:00:00.000Z',
    ...overrides,
  };
}

function testCurrentBindingClosesNoGuardClaimAsStale(): void {
  const coverage = consequenceFailureModeGuardCoverageMatrix().entries.find((entry) =>
    entry.failureModeId === 'model-tool-config-drift'
  );

  ok(Boolean(coverage), 'F2-AG-10: coverage entry exists');
  equal(
    coverage?.coverageKind,
    'deterministic-contract',
    'F2-AG-10: current coverage is deterministic contract, not absent guard',
  );
  equal(
    coverage?.primaryImplementationPath,
    'src/consequence-admission/decision-context-drift-binding.ts',
    'F2-AG-10: primary implementation path is the drift binding',
  );
}

function testMissingRequiredContextBlocks(): void {
  const decision = evaluateConsequenceDecisionContextDrift({
    generatedAt: '2026-05-13T11:00:00.000Z',
    boundContext: context({
      modelVersion: null,
      toolSchemaDigest: null,
      policyVersion: null,
      configDigest: null,
    }),
    currentContext: context(),
  });

  equal(decision.outcome, 'block', 'F2-AG-10: missing bound context fields block');
  ok(decision.reasonCodes.includes('model-version-missing'), 'F2-AG-10: missing model is explicit');
  ok(decision.reasonCodes.includes('tool-schema-digest-missing'), 'F2-AG-10: missing tool schema is explicit');
  ok(decision.reasonCodes.includes('policy-version-missing'), 'F2-AG-10: missing policy version is explicit');
  ok(decision.reasonCodes.includes('config-digest-missing'), 'F2-AG-10: missing config digest is explicit');
}

function testChangedContextRequiresReview(): void {
  const decision = evaluateConsequenceDecisionContextDrift({
    generatedAt: '2026-05-13T11:00:00.000Z',
    boundContext: context(),
    currentContext: context({
      modelVersion: 'gpt-5.5:2026-05-12',
      toolSchemaDigest: digest('2'),
      policyVersion: 'refund-policy:v5',
      configDigest: digest('3'),
      promptDigest: digest('4'),
      verifierDigest: digest('5'),
      simulationDigest: digest('6'),
    }),
    requireSimulationRefresh: true,
  });

  equal(decision.outcome, 'review', 'F2-AG-10: changed context requires review');
  equal(decision.allowed, false, 'F2-AG-10: drift does not allow automatic action');
  ok(decision.reasonCodes.includes('model-version-drift'), 'F2-AG-10: model drift is explicit');
  ok(decision.reasonCodes.includes('tool-schema-digest-drift'), 'F2-AG-10: tool schema drift is explicit');
  ok(decision.reasonCodes.includes('policy-version-drift'), 'F2-AG-10: policy version drift is explicit');
  ok(decision.reasonCodes.includes('config-digest-drift'), 'F2-AG-10: config drift is explicit');
  ok(decision.reasonCodes.includes('simulation-refresh-required'), 'F2-AG-10: simulation refresh is explicit');
}

function testDocsTrackerAndPackageStayAligned(): void {
  const validationDoc = readProjectFile('docs', 'audit', 'f2-model-tool-config-drift-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');

  includes(validationDoc, 'Status: repository-side `partial`.', 'Validation doc: partial status is explicit');
  includes(validationDoc, 'not a model evaluation', 'Validation doc: model-eval boundary is explicit');
  includes(validationDoc, 'not an independent runtime scanner', 'Validation doc: runtime scanner boundary is explicit');
  includes(tracker, 'F2-AG-10 model/tool/config drift | `partial`', 'Tracker: F2-AG-10 is partial');
  includes(tracker, 'test:f2-model-tool-config-drift-validation', 'Tracker: focused test is referenced');
  includes(packageJson, '"test:f2-model-tool-config-drift-validation"', 'Package: focused test script is exposed');
}

try {
  testCurrentBindingClosesNoGuardClaimAsStale();
  testMissingRequiredContextBlocks();
  testChangedContextRequiresReview();
  testDocsTrackerAndPackageStayAligned();
  console.log(`F2 model/tool/config drift validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F2 model/tool/config drift validation tests failed:', error);
  process.exitCode = 1;
}
