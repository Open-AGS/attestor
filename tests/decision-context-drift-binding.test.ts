import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceDecisionContextDriftBindingDescriptor,
  evaluateConsequenceDecisionContextDrift,
  type ConsequenceDecisionContextBindingContext,
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

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function digest(label: string): string {
  return `sha256:${label.repeat(64).slice(0, 64)}`;
}

function context(overrides?: Partial<ConsequenceDecisionContextBindingContext>):
ConsequenceDecisionContextBindingContext {
  return {
    modelVersion: 'gpt-5.4-mini:2026-05-01',
    toolSchemaDigest: digest('1'),
    toolManifestDigest: digest('2'),
    policyVersion: 'refund-policy:v4',
    policyDigest: digest('3'),
    configDigest: digest('4'),
    promptDigest: digest('5'),
    verifierDigest: digest('6'),
    simulationDigest: digest('7'),
    evaluatedAt: '2026-05-13T10:00:00.000Z',
    expiresAt: '2026-05-14T10:00:00.000Z',
    ...overrides,
  };
}

function testMatchingContextPassesDigestOnly(): void {
  const decision = evaluateConsequenceDecisionContextDrift({
    generatedAt: '2026-05-13T11:00:00.000Z',
    actionSurface: 'refunds.issue_refund',
    action: 'issue_refund',
    boundContext: context(),
    currentContext: context(),
    requireSimulationRefresh: true,
    maxContextAgeHours: 24,
  });
  const serialized = JSON.stringify(decision);

  equal(
    decision.version,
    'attestor.consequence-decision-context-drift-binding.v1',
    'Decision context drift binding: version is stable',
  );
  equal(decision.outcome, 'pass', 'Decision context drift binding: matching context passes');
  equal(decision.allowed, true, 'Decision context drift binding: pass is allowed');
  equal(decision.failClosed, false, 'Decision context drift binding: pass is not fail-closed');
  equal(decision.observed.driftDimensions.length, 0, 'Decision context drift binding: no drift dimensions are recorded');
  equal(decision.observed.contextAgeHours, 1, 'Decision context drift binding: age is computed in hours');
  ok(decision.digest.startsWith('sha256:'), 'Decision context drift binding: digest is generated');
  excludes(
    serialized,
    /gpt-5\.4-mini|refund-policy:v4/u,
    'Decision context drift binding: raw model and policy versions are not serialized',
  );
}

function testModelToolPolicyAndConfigDriftRequiresReview(): void {
  const decision = evaluateConsequenceDecisionContextDrift({
    generatedAt: '2026-05-13T11:00:00.000Z',
    boundContext: context(),
    currentContext: context({
      modelVersion: 'gpt-5.5:2026-05-12',
      toolSchemaDigest: digest('8'),
      toolManifestDigest: digest('9'),
      policyVersion: 'refund-policy:v5',
      policyDigest: digest('a'),
      configDigest: digest('b'),
      promptDigest: digest('c'),
      verifierDigest: digest('d'),
      simulationDigest: digest('e'),
    }),
    requireSimulationRefresh: true,
  });

  equal(decision.outcome, 'review', 'Decision context drift binding: changed context requires review');
  equal(decision.allowed, false, 'Decision context drift binding: review cannot proceed automatically');
  ok(decision.reasonCodes.includes('model-version-drift'), 'Decision context drift binding: model drift is reported');
  ok(decision.reasonCodes.includes('tool-schema-digest-drift'), 'Decision context drift binding: tool schema drift is reported');
  ok(decision.reasonCodes.includes('policy-version-drift'), 'Decision context drift binding: policy version drift is reported');
  ok(decision.reasonCodes.includes('config-digest-drift'), 'Decision context drift binding: config drift is reported');
  ok(decision.reasonCodes.includes('simulation-refresh-required'), 'Decision context drift binding: simulation refresh is required');
  ok(decision.observed.driftDimensions.includes('model'), 'Decision context drift binding: model dimension is recorded');
  ok(decision.observed.driftDimensions.includes('tool-schema'), 'Decision context drift binding: tool schema dimension is recorded');
  ok(decision.observed.driftDimensions.includes('simulation'), 'Decision context drift binding: simulation dimension is recorded');
}

function testMissingRequiredContextBlocks(): void {
  const decision = evaluateConsequenceDecisionContextDrift({
    generatedAt: '2026-05-13T11:00:00.000Z',
    boundContext: {
      modelVersion: null,
      toolSchemaDigest: null,
      policyVersion: null,
      configDigest: null,
    },
    currentContext: null,
  });

  equal(decision.outcome, 'block', 'Decision context drift binding: missing required context blocks');
  ok(decision.reasonCodes.includes('model-version-missing'), 'Decision context drift binding: missing model is reported');
  ok(decision.reasonCodes.includes('tool-schema-digest-missing'), 'Decision context drift binding: missing tool schema is reported');
  ok(decision.reasonCodes.includes('policy-version-missing'), 'Decision context drift binding: missing policy is reported');
  ok(decision.reasonCodes.includes('config-digest-missing'), 'Decision context drift binding: missing config is reported');
  ok(decision.reasonCodes.includes('current-context-missing'), 'Decision context drift binding: missing current context is reported');
  equal(decision.counts.missingDimensionCount, 4, 'Decision context drift binding: missing dimensions are counted');
}

function testStaleOrExpiredContextRequiresReview(): void {
  const decision = evaluateConsequenceDecisionContextDrift({
    generatedAt: '2026-05-13T11:00:00.000Z',
    boundContext: context({
      evaluatedAt: '2026-05-11T00:00:00.000Z',
      expiresAt: '2026-05-12T00:00:00.000Z',
    }),
    currentContext: context(),
    maxContextAgeHours: 24,
  });

  equal(decision.outcome, 'review', 'Decision context drift binding: stale context requires review');
  ok(decision.reasonCodes.includes('decision-context-expired'), 'Decision context drift binding: expired context is reported');
  ok(decision.reasonCodes.includes('decision-context-age-exceeded'), 'Decision context drift binding: age limit is reported');
}

function testDescriptorDocsAndRegistryStayAligned(): void {
  const descriptor = consequenceDecisionContextDriftBindingDescriptor();
  const registry = readProjectFile('src', 'consequence-admission', 'failure-mode-registry.ts');
  const bindings = readProjectFile('src', 'consequence-admission', 'failure-mode-control-bindings.ts');
  const docs = readProjectFile('docs', '02-architecture', 'decision-context-drift-binding.md');
  const pkg = readProjectFile('package.json');
  const publicSurface = readProjectFile('src', 'consequence-admission', 'public-surface.ts');

  equal(
    descriptor.version,
    'attestor.consequence-decision-context-drift-binding.v1',
    'Decision context drift binding descriptor: version is stable',
  );
  equal(descriptor.isModelEvaluation, false, 'Decision context drift binding descriptor: this is not model evaluation');
  equal(descriptor.storesRawContextValues, false, 'Decision context drift binding descriptor: raw context storage is false');
  ok(
    descriptor.reasonCodes.includes('model-version-drift'),
    'Decision context drift binding descriptor: drift reason is declared',
  );
  includes(
    registry,
    "evidence('code', 'src/consequence-admission/decision-context-drift-binding.ts'",
    'Decision context drift binding registry: code evidence is recorded',
  );
  includes(
    registry,
    "evidence('test', 'tests/decision-context-drift-binding.test.ts'",
    'Decision context drift binding registry: test evidence is recorded',
  );
  includes(
    bindings,
    'Decision-context drift binding is implemented',
    'Decision context drift binding bindings: limitation reflects implemented binding',
  );
  includes(
    docs,
    'NIST AI RMF',
    'Decision context drift binding docs: NIST source is documented',
  );
  includes(
    docs,
    'test:decision-context-drift-binding',
    'Decision context drift binding docs: test command is documented',
  );
  includes(
    pkg,
    '"test:decision-context-drift-binding"',
    'Decision context drift binding package: script is registered',
  );
  includes(
    publicSurface,
    "export * from './decision-context-drift-binding.js';",
    'Decision context drift binding public surface: module is exported',
  );
}

function run(): void {
  testMatchingContextPassesDigestOnly();
  testModelToolPolicyAndConfigDriftRequiresReview();
  testMissingRequiredContextBlocks();
  testStaleOrExpiredContextRequiresReview();
  testDescriptorDocsAndRegistryStayAligned();
  console.log(`Decision context drift binding tests: ${passed} passed, 0 failed`);
}

try {
  run();
} catch (error) {
  console.error('Decision context drift binding tests failed:', error);
  process.exitCode = 1;
}
