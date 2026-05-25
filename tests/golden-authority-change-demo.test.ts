import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenAuthorityChangeDemoSummary,
  renderGoldenAuthorityChangeDemoJson,
  renderGoldenAuthorityChangeDemoMarkdown,
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
  const summary = createGoldenAuthorityChangeDemoSummary();

  equal(summary.version, 'attestor.golden-authority-change-demo.v1', 'A04 summary: version is explicit');
  equal(summary.step, 'A04', 'A04 summary: step is explicit');
  equal(summary.actionSurface, 'authority_change.identity_workflow', 'A04 summary: action surface is authority change');
  equal(summary.domain, 'authority-change', 'A04 summary: domain is authority change');
  equal(summary.scenarioCount, 8, 'A04 summary: scenario count is fixed');
  equal(summary.candidateMode, 'review', 'A04 summary: candidate mode is review');
  equal(summary.namedGaps.length, 7, 'A04 summary: seven named gaps are shown');
  equal(summary.readinessVerdict, 'ready-for-shadow-pilot', 'A04 summary: readiness verdict is shadow-pilot ready');
  equal(summary.readinessBlockers.length, 0, 'A04 summary: readiness blockers are empty');
  equal(summary.markdownPrimary, true, 'A04 summary: markdown is primary');
  equal(summary.jsonSecondary, true, 'A04 summary: JSON is secondary');
  equal(summary.shadowOnly, true, 'A04 summary: shadow-only is true');
  equal(summary.fixtureOnly, true, 'A04 summary: fixture-only is true');
  equal(summary.previewOnly, true, 'A04 summary: preview-only is true');
  equal(summary.noTargetSystemCall, true, 'A04 summary: no target-system call');
  equal(summary.noIdentityProviderCall, true, 'A04 summary: no identity-provider call');
  equal(summary.noAccessChange, true, 'A04 summary: no access change');
  equal(summary.noAuditWrite, true, 'A04 summary: no audit write');
  equal(summary.noPolicyActivation, true, 'A04 summary: no policy activation');
  equal(summary.noLearningActivation, true, 'A04 summary: no learning activation');
  equal(summary.noTrainingActivation, true, 'A04 summary: no training activation');
  equal(summary.canAdmit, false, 'A04 summary: cannot admit');
  equal(summary.productionReady, false, 'A04 summary: production readiness is false');
  ok(/^sha256:[a-f0-9]{64}$/u.test(summary.digest), 'A04 summary: digest is canonical');
}

function testMarkdownAndJsonRenderers(): void {
  const summary = createGoldenAuthorityChangeDemoSummary();
  const markdown = renderGoldenAuthorityChangeDemoMarkdown(summary);
  const json = renderGoldenAuthorityChangeDemoJson(summary);
  const parsed = JSON.parse(json) as { readonly version: string; readonly digest: string };

  for (const expected of [
    '# Golden Path: Authority Change',
    'Verdict: ready-for-shadow-pilot',
    '## Business Contrast',
    'Without Attestor in this repo path:',
    'With Attestor in this repo path:',
    '0 identity-provider calls',
    '0 access changes',
    'authority_change.identity_workflow',
    'overbroad-privilege',
    'break-glass-approval-missing',
    'external-delegation-unapproved',
    'tenant-scope-mismatch',
    'stale-approval',
    'instruction-like-ticket-review',
    'separation-of-duties-conflict',
    'It does not call Okta',
  ]) {
    includes(markdown, expected, `A04 markdown: records ${expected}`);
  }

  equal(parsed.version, 'attestor.golden-authority-change-demo.v1', 'A04 JSON: version is explicit');
  equal(parsed.digest, summary.digest, 'A04 JSON: digest matches summary');
  excludes(markdown, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'A04 markdown: no raw email address is rendered');
  excludes(json, /"providerBody"\s*:|"identityProviderPayload"\s*:|"systemOfRecordPayload"\s*:/iu, 'A04 JSON: no raw identity-provider material fields are rendered');
  excludes(json, /firstName|lastName|displayName|phoneNumber|streetAddress|rawSubject|rawPrincipal/iu, 'A04 JSON: no raw identity fields are rendered');
}

function testPackageScriptRunsMarkdownAndJson(): void {
  const markdown = spawnSync(
    'npm',
    ['run', 'demo:golden-authority-change'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  const json = spawnSync(
    'npm',
    ['run', 'demo:golden-authority-change', '--', '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  equal(markdown.status, 0, 'A04 package script: markdown command exits cleanly');
  equal(json.status, 0, 'A04 package script: JSON command exits cleanly');
  includes(markdown.stdout, '# Golden Path: Authority Change', 'A04 package script: markdown is default');
  includes(markdown.stdout, 'Verdict: ready-for-shadow-pilot', 'A04 package script: markdown includes verdict');
  includes(json.stdout, '"version": "attestor.golden-authority-change-demo.v1"', 'A04 package script: JSON flag emits JSON');
  includes(json.stdout, '"readinessVerdict": "ready-for-shadow-pilot"', 'A04 package script: JSON includes verdict');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-authority-change-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: complete. A01-A04 are repository-side only.',
    'Progress after A04 lands: 4/4 complete. 0 steps remain.',
    '| A04 | complete once merged | Demo CLI and reviewer sandbox |',
    'npm run demo:golden-authority-change',
    'Markdown-first local demo',
    'JSON as secondary machine output',
  ]) {
    includes(doc, expected, `A04 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Authority Change Golden Path A04',
    'A04 ledger: records demo CLI and reviewer sandbox',
  );
  equal(
    packageJson.scripts['demo:golden-authority-change'],
    'tsx scripts/demo-golden-authority-change.ts',
    'A04 package script: demo command is registered',
  );
  equal(
    packageJson.scripts['test:golden-authority-change-demo'],
    'tsx tests/golden-authority-change-demo.test.ts',
    'A04 package script: targeted demo test is registered',
  );
}

testSummaryComposesGoldenPath();
testMarkdownAndJsonRenderers();
testPackageScriptRunsMarkdownAndJson();
testDocsAndScriptsStayAligned();

console.log(`golden-authority-change-demo: ${passed} assertions passed`);
