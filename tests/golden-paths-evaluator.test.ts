import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenPathsEvaluatorSummary,
  renderGoldenPathsEvaluatorJson,
  renderGoldenPathsEvaluatorMarkdown,
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

function testEvaluatorComposesAllSixPaths(): void {
  const summary = createGoldenPathsEvaluatorSummary();

  equal(summary.version, 'attestor.golden-paths-evaluator.v1', 'Golden paths evaluator: version is explicit');
  equal(summary.pathCount, 6, 'Golden paths evaluator: six golden paths are indexed');
  equal(summary.readyPathCount, 6, 'Golden paths evaluator: six paths are local-review-ready');
  equal(summary.totalScenarioCount, 48, 'Golden paths evaluator: six eight-scenario paths are counted');
  equal(summary.paths.length, 6, 'Golden paths evaluator: path list has six entries');
  equal(summary.totalNamedGapCount, 41, 'Golden paths evaluator: named gaps across six paths are counted');
  equal(summary.localOnly, true, 'Golden paths evaluator: local-only boundary is explicit');
  equal(summary.repoSideOnly, true, 'Golden paths evaluator: repo-side-only boundary is explicit');
  equal(summary.shadowOnly, true, 'Golden paths evaluator: shadow-only boundary is explicit');
  equal(summary.fixtureOnly, true, 'Golden paths evaluator: fixture-only boundary is explicit');
  equal(summary.noTargetSystemCalls, true, 'Golden paths evaluator: target-system calls are excluded');
  equal(summary.noCustomerPepProof, true, 'Golden paths evaluator: customer PEP live proof is excluded');
  equal(summary.noExternalKmsProof, true, 'Golden paths evaluator: external KMS proof is excluded');
  equal(summary.noLiveSharedStoreProof, true, 'Golden paths evaluator: live shared-store proof is excluded');
  equal(summary.noProviderDashboardProof, true, 'Golden paths evaluator: provider dashboard proof is excluded');
  equal(summary.noDownstreamExecution, true, 'Golden paths evaluator: downstream execution is excluded');
  equal(summary.noPolicyActivation, true, 'Golden paths evaluator: policy activation is excluded');
  equal(summary.noAuthorityGrant, true, 'Golden paths evaluator: authority grant is excluded');
  equal(summary.productionReady, false, 'Golden paths evaluator: production readiness stays false');
  equal(summary.enterpriseReady, false, 'Golden paths evaluator: enterprise readiness stays false');
  ok(/^sha256:[a-f0-9]{64}$/u.test(summary.digest), 'Golden paths evaluator: digest is canonical');

  const expectedKeys = [
    'money-movement-refund',
    'data-movement-controlled-export',
    'authority-change-access',
    'external-communication-message',
    'operational-execution-change',
    'programmable-money-transaction-intent',
  ];
  equal(
    summary.paths.map((path) => path.key).join(','),
    expectedKeys.join(','),
    'Golden paths evaluator: path order is stable',
  );

  for (const path of summary.paths) {
    equal(path.evaluatorReadiness, 'local-review-ready', `${path.key}: local evaluator status is ready`);
    equal(path.shadowOnly, true, `${path.key}: shadow-only`);
    equal(path.fixtureOnly, true, `${path.key}: fixture-only`);
    equal(path.previewOnly, true, `${path.key}: preview-only`);
    equal(path.noTargetSystemCall, true, `${path.key}: no target-system call`);
    equal(path.canAdmit, false, `${path.key}: cannot admit`);
    equal(path.activatesEnforcement, false, `${path.key}: does not activate enforcement`);
    equal(path.productionReady, false, `${path.key}: production readiness remains false`);
    equal(path.scenarioCount, 8, `${path.key}: scenario count is fixed`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(path.sourceDemoDigest), `${path.key}: source digest is canonical`);
  }
}

function testMarkdownAndJsonOutputStayCompactAndHonest(): void {
  const summary = createGoldenPathsEvaluatorSummary();
  const markdown = renderGoldenPathsEvaluatorMarkdown(summary);
  const json = renderGoldenPathsEvaluatorJson(summary);
  const parsed = JSON.parse(json) as {
    readonly version: string;
    readonly pathCount: number;
    readonly productionReady: boolean;
    readonly paths: readonly { readonly command: string }[];
  };

  for (const expected of [
    '# Attestor Golden Paths Evaluator',
    'paths: 6/6 local-review-ready',
    'scenarios: 48',
    'named gaps: 41',
    'not a second decision engine',
    'no live customer PEP no-bypass proof',
    'no external KMS/HSM runtime signing proof',
    '| Money Movement | Refund | `npm run demo:golden-refund` |',
    '| Programmable Money | Programmable Money | `npm run demo:golden-programmable-money` |',
    'Digest: sha256:',
  ]) {
    includes(markdown, expected, `Golden paths evaluator markdown: records ${expected}`);
  }

  equal(parsed.version, 'attestor.golden-paths-evaluator.v1', 'Golden paths evaluator JSON: version is explicit');
  equal(parsed.pathCount, 6, 'Golden paths evaluator JSON: path count is six');
  equal(parsed.productionReady, false, 'Golden paths evaluator JSON: production readiness is false');
  equal(parsed.paths[0]?.command, 'npm run demo:golden-refund', 'Golden paths evaluator JSON: first command is refund');
  excludes(markdown, /\bproduction ready\b|\benterprise ready\b/iu, 'Golden paths evaluator markdown: does not use ready overclaim wording');
  excludes(json, /"rawPayload"\s*:|"providerBody"\s*:|"walletMaterial"\s*:|"customerEmail"\s*:/iu, 'Golden paths evaluator JSON: no raw sensitive material fields');
}

function testPackageScriptRunsMarkdownAndJson(): void {
  const markdown = spawnSync(
    'npm',
    ['run', 'demo:golden-paths'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  const json = spawnSync(
    'npm',
    ['run', 'demo:golden-paths', '--', '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  equal(markdown.status, 0, 'Golden paths evaluator package script: markdown command exits cleanly');
  equal(json.status, 0, 'Golden paths evaluator package script: JSON command exits cleanly');
  includes(markdown.stdout, '# Attestor Golden Paths Evaluator', 'Golden paths evaluator package script: markdown is default');
  includes(markdown.stdout, 'paths: 6/6 local-review-ready', 'Golden paths evaluator package script: markdown includes aggregate status');
  includes(json.stdout, '"version": "attestor.golden-paths-evaluator.v1"', 'Golden paths evaluator package script: JSON flag emits JSON');
  includes(json.stdout, '"reviewerCommand": "npm run demo:golden-paths"', 'Golden paths evaluator package script: JSON includes reviewer command');
}

function testDocsAndScriptsStayAligned(): void {
  const readme = readProjectFile('README.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(readme, 'npm run demo:golden-paths', 'Golden paths evaluator README: documents aggregate command');
  includes(readme, 'Start review with:', 'Golden paths evaluator README: keeps baseline review marker');
  includes(readme, 'Start with the all-pack evaluator:', 'Golden paths evaluator README: gives evaluator first-run placement');
  includes(
    ledger,
    'All Golden Paths Evaluator',
    'Golden paths evaluator ledger: records source-backed evaluator step',
  );
  equal(
    packageJson.scripts['demo:golden-paths'],
    'tsx scripts/demo-golden-paths.ts',
    'Golden paths evaluator package script: demo command is registered',
  );
  equal(
    packageJson.scripts['test:golden-paths-evaluator'],
    'tsx tests/golden-paths-evaluator.test.ts',
    'Golden paths evaluator package script: targeted test is registered',
  );
}

testEvaluatorComposesAllSixPaths();
testMarkdownAndJsonOutputStayCompactAndHonest();
testPackageScriptRunsMarkdownAndJson();
testDocsAndScriptsStayAligned();

console.log(`golden-paths-evaluator: ${passed} assertions passed`);
