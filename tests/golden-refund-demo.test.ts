import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenRefundDemoSummary,
  renderGoldenRefundDemoJson,
  renderGoldenRefundDemoMarkdown,
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

function testSummaryComposesGoldenPath(): void {
  const summary = createGoldenRefundDemoSummary();

  equal(summary.version, 'attestor.golden-refund-demo.v1', 'G07 summary: version is explicit');
  equal(summary.step, 'G07', 'G07 summary: step is explicit');
  equal(summary.actionSurface, 'refund_service.issue_refund', 'G07 summary: action surface is refund');
  equal(summary.domain, 'money-movement', 'G07 summary: domain is money movement');
  equal(summary.scenarioCount, 8, 'G07 summary: scenario count is fixed');
  equal(summary.candidateMode, 'review', 'G07 summary: candidate mode is review');
  equal(summary.namedGaps.length, 7, 'G07 summary: seven named gaps are shown');
  equal(summary.engineVisibility.version, 'attestor.golden-refund-engine-visibility.v1', 'G07 summary: engine visibility is attached');
  equal(summary.readinessVerdict, 'ready-for-shadow-pilot', 'G07 summary: readiness verdict is shadow-pilot ready');
  equal(summary.readinessBlockers.length, 0, 'G07 summary: readiness blockers are empty');
  equal(summary.markdownPrimary, true, 'G07 summary: markdown is primary');
  equal(summary.jsonSecondary, true, 'G07 summary: JSON is secondary');
  equal(summary.shadowOnly, true, 'G07 summary: shadow-only is true');
  equal(summary.fixtureOnly, true, 'G07 summary: fixture-only is true');
  equal(summary.previewOnly, true, 'G07 summary: preview-only is true');
  equal(summary.noTargetSystemCall, true, 'G07 summary: no target-system call');
  equal(summary.noAuditWrite, true, 'G07 summary: no audit write');
  equal(summary.noPolicyActivation, true, 'G07 summary: no policy activation');
  equal(summary.noLearningActivation, true, 'G07 summary: no learning activation');
  equal(summary.noTrainingActivation, true, 'G07 summary: no training activation');
  equal(summary.canAdmit, false, 'G07 summary: cannot admit');
  equal(summary.productionReady, false, 'G07 summary: production readiness is false');
  ok(/^sha256:[a-f0-9]{64}$/u.test(summary.digest), 'G07 summary: digest is canonical');
}

function testMarkdownAndJsonRenderers(): void {
  const summary = createGoldenRefundDemoSummary();
  const markdown = renderGoldenRefundDemoMarkdown(summary);
  const json = renderGoldenRefundDemoJson(summary);
  const parsed = JSON.parse(json) as { readonly version: string; readonly digest: string };

  for (const expected of [
    '# Golden Path: Refund',
    'Verdict: ready-for-shadow-pilot',
    '## Business Contrast',
    'Without Attestor in this repo path:',
    'With Attestor in this repo path:',
    '0 target-system calls',
    'refund_service.issue_refund',
    'missing-payment-evidence',
    'stale-payment-evidence',
    'prior-refund-relationship-review',
    'human-approval-required',
    'instruction-like-evidence-review',
    'external-risk-signal-review',
    'policy-limit-review',
    '## Engine Visibility',
    'shuffled-input unique digests: 1',
    'It does not execute refunds automatically.',
  ]) {
    includes(markdown, expected, `G07 markdown: records ${expected}`);
  }

  equal(parsed.version, 'attestor.golden-refund-demo.v1', 'G07 JSON: version is explicit');
  equal(parsed.digest, summary.digest, 'G07 JSON: digest matches summary');
  excludes(markdown, /\bcus_[a-zA-Z0-9_]+/u, 'G07 markdown: no raw customer id is rendered');
  excludes(json, /\bpi_[a-zA-Z0-9_]+/u, 'G07 JSON: no raw payment intent id is rendered');
  excludes(json, /\bch_[a-zA-Z0-9_]+/u, 'G07 JSON: no raw charge id is rendered');
  excludes(json, /cardNumber|customerName|customerEmail|paymentIntentId|stripeChargeId|shopifyOrderId/iu, 'G07 JSON: no raw commerce identifiers are rendered');
}

function testPackageScriptRunsMarkdownAndJson(): void {
  const markdown = spawnSync(
    'npm',
    ['run', 'demo:golden-refund'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  const json = spawnSync(
    'npm',
    ['run', 'demo:golden-refund', '--', '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  equal(markdown.status, 0, 'G07 package script: markdown command exits cleanly');
  equal(json.status, 0, 'G07 package script: JSON command exits cleanly');
  includes(markdown.stdout, '# Golden Path: Refund', 'G07 package script: markdown is default');
  includes(markdown.stdout, 'Verdict: ready-for-shadow-pilot', 'G07 package script: markdown includes verdict');
  includes(json.stdout, '"version": "attestor.golden-refund-demo.v1"', 'G07 package script: JSON flag emits JSON');
  includes(json.stdout, '"readinessVerdict": "ready-for-shadow-pilot"', 'G07 package script: JSON includes verdict');
  includes(json.stdout, '"engineVisibility"', 'G07 package script: JSON includes engine visibility');
}

function testDocsAndScriptsStayAligned(): void {
  const readme = readProjectFile('README.md');
  const tryFirst = readProjectFile('docs', '01-overview', 'try-attestor-first.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const doc = readProjectFile('docs', '02-architecture', 'golden-refund-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: complete',
    'Progress after G09 lands: 9/9 complete. 0 steps remain.',
    '| G07 | complete | Demo CLI |',
    '| G08 | complete | Engine visibility report |',
    '`npm run demo:golden-refund`',
    'Markdown as the primary G07 output',
    'JSON as secondary machine output',
    'determinism check',
  ]) {
    includes(doc, expected, `G07 doc: records ${expected}`);
  }

  includes(
    ledger,
    'G08 engine visibility report',
    'G07 ledger: records demo CLI',
  );
  for (const expected of [
    '## Golden Path: Refund',
    'is the first end-to-end repo path a reviewer should run',
    'refund action surface -> canonical shadow fixtures -> runtime assurance smoke -> Policy Foundry summary -> pilot readiness packet -> Engine Visibility -> optional reviewer sandbox -> demo output',
    'Without Attestor in this repo path: no gate trace, no issue-code/no-claim boundary, no digest-bound shadow readiness evidence.',
    'With Attestor in this repo path:    8 scenarios, 7 visible gate stages, named Foundry gaps, 0 target-system calls, shadow-pilot readiness verdict.',
    '[Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md)',
    'npm ci',
    'npm run demo:golden-refund',
    '--determinism-check',
    'no live Stripe or Shopify refund',
    'no customer deployment',
    'no policy activation',
    'no auto-enforcement',
  ]) {
    includes(readme, expected, `G07 README: records ${expected}`);
  }
  for (const expected of [
    'npm run demo:golden-refund',
    'refund action surface -> canonical shadow events -> runtime assurance smoke -> Policy Foundry summary -> pilot readiness packet',
    'Engine Visibility',
    'It does not execute a refund',
    'Business contrast',
  ]) {
    includes(tryFirst, expected, `G07 try-first doc: records ${expected}`);
  }
  includes(
    systemOverview,
    '[Golden Path: Refund](golden-refund-shadow-pilot.md)',
    'G07 system overview: links the golden refund path',
  );
  equal(
    packageJson.scripts['demo:golden-refund'],
    'tsx scripts/demo-golden-refund.ts',
    'G07 package script: demo command is registered',
  );
  equal(
    packageJson.scripts['test:golden-refund-demo'],
    'tsx tests/golden-refund-demo.test.ts',
    'G07 package script: targeted test is registered',
  );
}

testSummaryComposesGoldenPath();
testMarkdownAndJsonRenderers();
testPackageScriptRunsMarkdownAndJson();
testDocsAndScriptsStayAligned();

console.log(`golden-refund-demo: ${passed} assertions passed`);
