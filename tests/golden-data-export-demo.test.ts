import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenDataExportDemoSummary,
  renderGoldenDataExportDemoJson,
  renderGoldenDataExportDemoMarkdown,
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
  const summary = createGoldenDataExportDemoSummary();

  equal(summary.version, 'attestor.golden-data-export-demo.v1', 'D04 summary: version is explicit');
  equal(summary.step, 'D04', 'D04 summary: step is explicit');
  equal(summary.actionSurface, 'data_movement.controlled_export', 'D04 summary: action surface is data export');
  equal(summary.domain, 'data-movement', 'D04 summary: domain is data movement');
  equal(summary.scenarioCount, 8, 'D04 summary: scenario count is fixed');
  equal(summary.candidateMode, 'review', 'D04 summary: candidate mode is review');
  equal(summary.namedGaps.length, 7, 'D04 summary: seven named gaps are shown');
  equal(summary.readinessVerdict, 'ready-for-shadow-pilot', 'D04 summary: readiness verdict is shadow-pilot ready');
  equal(summary.readinessBlockers.length, 0, 'D04 summary: readiness blockers are empty');
  equal(summary.markdownPrimary, true, 'D04 summary: markdown is primary');
  equal(summary.jsonSecondary, true, 'D04 summary: JSON is secondary');
  equal(summary.shadowOnly, true, 'D04 summary: shadow-only is true');
  equal(summary.fixtureOnly, true, 'D04 summary: fixture-only is true');
  equal(summary.previewOnly, true, 'D04 summary: preview-only is true');
  equal(summary.noTargetSystemCall, true, 'D04 summary: no target-system call');
  equal(summary.noAuditWrite, true, 'D04 summary: no audit write');
  equal(summary.noPolicyActivation, true, 'D04 summary: no policy activation');
  equal(summary.noLearningActivation, true, 'D04 summary: no learning activation');
  equal(summary.noTrainingActivation, true, 'D04 summary: no training activation');
  equal(summary.canAdmit, false, 'D04 summary: cannot admit');
  equal(summary.productionReady, false, 'D04 summary: production readiness is false');
  ok(/^sha256:[a-f0-9]{64}$/u.test(summary.digest), 'D04 summary: digest is canonical');
}

function testMarkdownAndJsonRenderers(): void {
  const summary = createGoldenDataExportDemoSummary();
  const markdown = renderGoldenDataExportDemoMarkdown(summary);
  const json = renderGoldenDataExportDemoJson(summary);
  const parsed = JSON.parse(json) as { readonly version: string; readonly digest: string };

  for (const expected of [
    '# Golden Path: Controlled Data Export',
    'Verdict: ready-for-shadow-pilot',
    '## Business Contrast',
    'Without Attestor in this repo path:',
    'With Attestor in this repo path:',
    '0 target-system calls',
    'data_movement.controlled_export',
    'overbroad-personal-data',
    'external-recipient-unapproved',
    'tenant-scope-mismatch',
    'stale-approval',
    'instruction-like-evidence-review',
    'write-side-effect',
    'purpose-binding-missing',
    'It does not execute warehouse queries',
  ]) {
    includes(markdown, expected, `D04 markdown: records ${expected}`);
  }

  equal(parsed.version, 'attestor.golden-data-export-demo.v1', 'D04 JSON: version is explicit');
  equal(parsed.digest, summary.digest, 'D04 JSON: digest matches summary');
  excludes(markdown, /\bSELECT\s+.+\bFROM\b|\bUPDATE\s+\S+\s+SET\b|\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|\bMERGE\s+INTO\b/iu, 'D04 markdown: no raw SQL statement is rendered');
  excludes(json, /"rowPayload"\s*:|"rawRows"\s*:|"providerBody"\s*:|"warehouseStatement"\s*:/iu, 'D04 JSON: no raw data export material fields are rendered');
  excludes(json, /\b(email|customerEmail|customerName|accountNumber|ssn|phoneNumber)\b/iu, 'D04 JSON: no raw customer fields are rendered');
}

function testPackageScriptRunsMarkdownAndJson(): void {
  const markdown = spawnSync(
    'npm',
    ['run', 'demo:golden-data-export'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  const json = spawnSync(
    'npm',
    ['run', 'demo:golden-data-export', '--', '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  equal(markdown.status, 0, 'D04 package script: markdown command exits cleanly');
  equal(json.status, 0, 'D04 package script: JSON command exits cleanly');
  includes(markdown.stdout, '# Golden Path: Controlled Data Export', 'D04 package script: markdown is default');
  includes(markdown.stdout, 'Verdict: ready-for-shadow-pilot', 'D04 package script: markdown includes verdict');
  includes(json.stdout, '"version": "attestor.golden-data-export-demo.v1"', 'D04 package script: JSON flag emits JSON');
  includes(json.stdout, '"readinessVerdict": "ready-for-shadow-pilot"', 'D04 package script: JSON includes verdict');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-data-export-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: complete. D01-D04 are repository-side only.',
    'Progress after D04 lands: 4/4 complete. 0 steps remain.',
    '| D04 | complete | Demo CLI and reviewer sandbox |',
    'npm run demo:golden-data-export',
    'Markdown-first local demo',
    'JSON as secondary machine output',
  ]) {
    includes(doc, expected, `D04 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Controlled Data Export Golden Path D04',
    'D04 ledger: records demo CLI and reviewer sandbox',
  );
  equal(
    packageJson.scripts['demo:golden-data-export'],
    'tsx scripts/demo-golden-data-export.ts',
    'D04 package script: demo command is registered',
  );
  equal(
    packageJson.scripts['test:golden-data-export-demo'],
    'tsx tests/golden-data-export-demo.test.ts',
    'D04 package script: targeted demo test is registered',
  );
}

testSummaryComposesGoldenPath();
testMarkdownAndJsonRenderers();
testPackageScriptRunsMarkdownAndJson();
testDocsAndScriptsStayAligned();

console.log(`golden-data-export-demo: ${passed} assertions passed`);
