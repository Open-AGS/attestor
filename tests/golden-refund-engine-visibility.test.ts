import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenRefundEngineVisibilityReport,
  renderGoldenRefundEngineVisibilityJson,
  renderGoldenRefundEngineVisibilityMarkdown,
  runGoldenRefundEngineVisibilityDeterminismCheck,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testVisibilityReportShape(): void {
  const report = createGoldenRefundEngineVisibilityReport({ determinismIterations: 12 });

  equal(report.version, 'attestor.golden-refund-engine-visibility.v1', 'G08 report: version is explicit');
  equal(report.step, 'G08', 'G08 report: step is explicit');
  equal(report.scenarioCount, 8, 'G08 report: scenario count is fixed');
  equal(report.scenarios.length, 8, 'G08 report: one row per refund scenario');
  equal(report.markdownFirst, true, 'G08 report: markdown remains primary');
  equal(report.jsonSecondary, true, 'G08 report: JSON remains secondary');
  equal(report.shadowOnly, true, 'G08 report: shadow-only is true');
  equal(report.fixtureOnly, true, 'G08 report: fixture-only is true');
  equal(report.noTargetSystemCall, true, 'G08 report: no target-system call');
  equal(report.noAuditWrite, true, 'G08 report: no audit write');
  equal(report.noPolicyActivation, true, 'G08 report: no policy activation');
  equal(report.noLearningActivation, true, 'G08 report: no learning activation');
  equal(report.canAdmit, false, 'G08 report: cannot admit');
  equal(report.productionReady, false, 'G08 report: production readiness is false');
  ok(/^sha256:[a-f0-9]{64}$/u.test(report.digest), 'G08 report: digest is canonical');
}

function testScenarioRowsExposeEnginePath(): void {
  const report = createGoldenRefundEngineVisibilityReport({ determinismIterations: 8 });
  const scenarios = report.scenarios.map((row) => row.scenario).sort();

  assert.deepEqual(
    scenarios,
    [
      'adversarial-text-in-evidence',
      'approval-required',
      'external-fraud-signal-high',
      'missing-evidence',
      'normal',
      'over-policy-amount',
      'repeated-refund',
      'stale-evidence',
    ],
    'G08 report: all eight refund scenarios are visible',
  );
  passed += 1;

  for (const row of report.scenarios) {
    equal(row.gateOrder[0], 'shadow-envelope-projector', `G08 ${row.scenario}: first gate is projector`);
    equal(row.gateOrder.at(-1), 'signed-assurance-packet', `G08 ${row.scenario}: last gate is packet`);
    ok(row.metrics.signalCount > 0, `G08 ${row.scenario}: signal count is visible`);
    ok(row.metrics.relationshipCount >= 0, `G08 ${row.scenario}: relationship count is visible`);
    ok(row.metrics.reasonLineCount <= 7, `G08 ${row.scenario}: human reason lines stay bounded`);
    ok(row.metrics.evidenceCompletenessPercent >= 0, `G08 ${row.scenario}: evidence completeness lower bound is visible`);
    ok(row.metrics.evidenceCompletenessPercent <= 100, `G08 ${row.scenario}: evidence completeness upper bound is visible`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(row.decisionRelevantDigest), `G08 ${row.scenario}: decision digest is canonical`);
    equal(row.safetyBoundary.noTargetSystemCall, true, `G08 ${row.scenario}: no target-system call`);
    equal(row.safetyBoundary.canAdmit, false, `G08 ${row.scenario}: cannot admit`);
  }
}

function testDeterminismCheckSeparatesDigestScope(): void {
  const check = runGoldenRefundEngineVisibilityDeterminismCheck(20);

  equal(check.iterations, 20, 'G08 determinism: requested iteration count is retained');
  equal(check.identicalInputUniqueDigests, 1, 'G08 determinism: identical input is stable');
  equal(check.shuffledInputUniqueDigests, 1, 'G08 determinism: shuffled ordering is stable');
  equal(check.stable, true, 'G08 determinism: stability summary is true');
  ok(check.digestCovers.includes('fusion-posture-and-scores'), 'G08 determinism: digest covers fusion scores');
  ok(check.digestExcludes.includes('timestamps'), 'G08 determinism: digest excludes timestamps');
  ok(/^sha256:[a-f0-9]{64}$/u.test(check.digest), 'G08 determinism: digest is canonical');
}

function testRenderersAndCli(): void {
  const report = createGoldenRefundEngineVisibilityReport({ determinismIterations: 8 });
  const markdown = renderGoldenRefundEngineVisibilityMarkdown(report);
  const json = renderGoldenRefundEngineVisibilityJson(report);
  const parsed = JSON.parse(json) as { readonly version: string; readonly digest: string };
  const cli = spawnSync(
    'npm',
    ['run', 'demo:golden-refund', '--', '--determinism-check', '--runs=5'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  for (const expected of [
    '## Engine Visibility',
    '| Scenario | Expected posture | Fusion | Conflict gate | Human gate | Evidence | Packet |',
    'adversarial-text-in-evidence',
    'external-fraud-signal-high',
    'over-policy-amount',
    'digest covers:',
    'target-system calls: 0',
  ]) {
    includes(markdown, expected, `G08 markdown: records ${expected}`);
  }
  equal(parsed.version, 'attestor.golden-refund-engine-visibility.v1', 'G08 JSON: version is explicit');
  equal(parsed.digest, report.digest, 'G08 JSON: digest matches report');
  equal(cli.status, 0, 'G08 CLI: determinism command exits cleanly');
  includes(cli.stdout, '# Golden Path: Refund Determinism Check', 'G08 CLI: determinism markdown header is present');
  includes(cli.stdout, 'shuffled-input unique digests: 1', 'G08 CLI: shuffled determinism is visible');
  excludes(json, /\bcus_[a-zA-Z0-9_]+/u, 'G08 JSON: no raw customer id is rendered');
  excludes(json, /\bpi_[a-zA-Z0-9_]+/u, 'G08 JSON: no raw payment intent id is rendered');
  excludes(json, /\bch_[a-zA-Z0-9_]+/u, 'G08 JSON: no raw charge id is rendered');
  excludes(json, /cardNumber|customerName|customerEmail|paymentIntentId|stripeChargeId|shopifyOrderId/iu, 'G08 JSON: no raw commerce identifiers are rendered');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-refund-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const readme = readProjectFile('README.md');
  const tryFirst = readProjectFile('docs', '01-overview', 'try-attestor-first.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Progress after G08 lands: 8/8 complete. 0 steps remain.',
    '| G08 | complete | Engine visibility report |',
    'Engine Visibility',
    '8 synthetic scenarios',
    'determinism check',
  ]) {
    includes(doc, expected, `G08 doc: records ${expected}`);
  }
  includes(ledger, 'G08 engine visibility report', 'G08 ledger: records engine visibility');
  includes(readme, 'Engine Visibility', 'G08 README: mentions engine visibility');
  includes(tryFirst, '--determinism-check', 'G08 try-first doc: shows determinism command');
  equal(
    packageJson.scripts['test:golden-refund-engine-visibility'],
    'tsx tests/golden-refund-engine-visibility.test.ts',
    'G08 package script: targeted test is registered',
  );
}

testVisibilityReportShape();
testScenarioRowsExposeEnginePath();
testDeterminismCheckSeparatesDigestScope();
testRenderersAndCli();
testDocsAndScriptsStayAligned();

console.log(`golden-refund-engine-visibility: ${passed} assertions passed`);
