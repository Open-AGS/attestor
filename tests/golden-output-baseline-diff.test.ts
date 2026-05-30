import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenPathsEvaluatorSummary,
  type GoldenPathsEvaluatorSummary,
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

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/gu, '\n');
}

function goldenBaseline(summary: GoldenPathsEvaluatorSummary): unknown {
  return {
    baselineVersion: 'attestor.golden-output-baseline.v1',
    surface: 'golden-paths-evaluator',
    generatedAt: summary.generatedAt,
    digest: summary.digest,
    pathCount: summary.pathCount,
    readyPathCount: summary.readyPathCount,
    totalScenarioCount: summary.totalScenarioCount,
    totalNamedGapCount: summary.totalNamedGapCount,
    noClaims: summary.noClaims,
    paths: summary.paths.map((path) => ({
      key: path.key,
      name: path.name,
      pack: path.pack,
      command: path.command,
      jsonCommand: path.jsonCommand,
      docPath: path.docPath,
      sourceDemoDigest: path.sourceDemoDigest,
      scenarioCount: path.scenarioCount,
      namedGapCount: path.namedGapCount,
      readinessVerdict: path.readinessVerdict,
      evaluatorReadiness: path.evaluatorReadiness,
      shadowOnly: path.shadowOnly,
      fixtureOnly: path.fixtureOnly,
      previewOnly: path.previewOnly,
      noTargetSystemCall: path.noTargetSystemCall,
      canAdmit: path.canAdmit,
      activatesEnforcement: path.activatesEnforcement,
      productionReady: path.productionReady,
      noClaims: path.noClaims,
    })),
  };
}

const actual = stableJson(goldenBaseline(createGoldenPathsEvaluatorSummary()));
const expected = normalizeNewlines(readFileSync(
  join(process.cwd(), 'tests', 'snapshots', 'golden-output-baselines', 'golden-paths-evaluator.json'),
  'utf8',
));

equal(
  actual,
  expected,
  'Golden output baseline diff: evaluator output changed. Review the diff and update the checked-in baseline intentionally if this is expected.',
);

for (const requiredBoundary of [
  'no live customer PEP no-bypass proof',
  'no external KMS/HSM runtime signing proof',
  'no production or enterprise readiness claim',
]) {
  ok(actual.includes(requiredBoundary), `Golden output baseline diff: keeps boundary "${requiredBoundary}"`);
}
ok(!actual.includes('sk_live'), 'Golden output baseline diff: does not include Stripe live secret marker');
ok(!actual.includes('wallet material'), 'Golden output baseline diff: does not include wallet material');

console.log(`golden-output-baseline-diff.test.ts: ${passed} assertions passed`);
