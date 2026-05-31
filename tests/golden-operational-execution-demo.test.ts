import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenOperationalExecutionDemoSummary,
  renderGoldenOperationalExecutionDemoJson,
  renderGoldenOperationalExecutionDemoMarkdown,
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
  const summary = createGoldenOperationalExecutionDemoSummary();

  equal(summary.version, 'attestor.golden-operational-execution-demo.v1', 'O04 summary: version is explicit');
  equal(summary.step, 'O04', 'O04 summary: step is explicit');
  equal(summary.actionSurface, 'operational_execution.change_request', 'O04 summary: action surface is operational execution');
  equal(summary.domain, 'system-operation', 'O04 summary: domain is system operation');
  equal(summary.scenarioCount, 8, 'O04 summary: scenario count is fixed');
  equal(summary.candidateMode, 'review', 'O04 summary: candidate mode is review');
  equal(summary.namedGaps.length, 6, 'O04 summary: six named gaps are shown');
  equal(summary.readinessVerdict, 'ready-for-shadow-pilot', 'O04 summary: readiness verdict is shadow-pilot ready');
  equal(summary.readinessBlockers.length, 0, 'O04 summary: readiness blockers are empty');
  equal(summary.markdownPrimary, true, 'O04 summary: markdown is primary');
  equal(summary.jsonSecondary, true, 'O04 summary: JSON is secondary');
  equal(summary.shadowOnly, true, 'O04 summary: shadow-only is true');
  equal(summary.fixtureOnly, true, 'O04 summary: fixture-only is true');
  equal(summary.previewOnly, true, 'O04 summary: preview-only is true');
  equal(summary.deterministicReplay, true, 'O04 summary: deterministic replay is true');
  equal(summary.noTargetSystemCall, true, 'O04 summary: no target system call');
  equal(summary.noDeployment, true, 'O04 summary: no deployment');
  equal(summary.noInfrastructureChange, true, 'O04 summary: no infrastructure change');
  equal(summary.noSecretManagerWrite, true, 'O04 summary: no secret-manager write');
  equal(summary.noIncidentAutomationExecution, true, 'O04 summary: no incident automation execution');
  equal(summary.noRunbookExecution, true, 'O04 summary: no runbook execution');
  equal(summary.noPolicyActivation, true, 'O04 summary: no policy activation');
  equal(summary.canAdmit, false, 'O04 summary: cannot admit');
  equal(summary.productionReady, false, 'O04 summary: production readiness is false');
  ok(/^sha256:[a-f0-9]{64}$/u.test(summary.digest), 'O04 summary: digest is canonical');
}

function testMarkdownAndJsonRenderers(): void {
  const summary = createGoldenOperationalExecutionDemoSummary();
  const markdown = renderGoldenOperationalExecutionDemoMarkdown(summary);
  const json = renderGoldenOperationalExecutionDemoJson(summary);
  const parsed = JSON.parse(json) as { readonly version: string; readonly digest: string };

  for (const expected of [
    '# Golden Path: Operational Execution',
    'Verdict: ready-for-shadow-pilot',
    '## What This Shows',
    '## Business Contrast',
    'Without Attestor in this repo path:',
    'With Attestor in this repo path:',
    '0 deployments',
    '0 infrastructure changes',
    '0 secret-manager writes',
    'operational_execution.change_request',
    'rollback-plan-missing',
    'secret-rotation-stale-approval',
    'infrastructure-drift-review',
    'break-glass-secondary-approval',
    'runbook-instruction-review',
    'duplicate-operation-replay',
    'It does not deploy anything',
  ]) {
    includes(markdown, expected, `O04 markdown: records ${expected}`);
  }

  equal(parsed.version, 'attestor.golden-operational-execution-demo.v1', 'O04 JSON: version is explicit');
  equal(parsed.digest, summary.digest, 'O04 JSON: digest matches summary');
  excludes(markdown, /-----BEGIN|api[_-]?key|password|secretValue|kubeconfig|tfstate/iu, 'O04 markdown: no raw operational secrets are rendered');
  excludes(json, /"rawDeploymentManifest"\s*:|"rawTerraformPlan"\s*:|"rawSecretMaterial"\s*:|"rawRunbookText"\s*:/iu, 'O04 JSON: no raw operational material fields are rendered');
  excludes(json, /"kubeconfig"\s*:|"tfvars"\s*:|"secretValue"\s*:|"privateKey"\s*:|"accessToken"\s*:/iu, 'O04 JSON: no credential-like fields are rendered');
}

function testPackageScriptRunsMarkdownAndJson(): void {
  const markdown = spawnSync(
    'npm',
    ['run', 'demo:golden-operational-execution'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  const json = spawnSync(
    'npm',
    ['run', 'demo:golden-operational-execution', '--', '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  equal(markdown.status, 0, 'O04 package script: markdown command exits cleanly');
  equal(json.status, 0, 'O04 package script: JSON command exits cleanly');
  includes(markdown.stdout, '# Golden Path: Operational Execution', 'O04 package script: markdown is default');
  includes(markdown.stdout, 'Verdict: ready-for-shadow-pilot', 'O04 package script: markdown includes verdict');
  includes(json.stdout, '"version": "attestor.golden-operational-execution-demo.v1"', 'O04 package script: JSON flag emits JSON');
  includes(json.stdout, '"readinessVerdict": "ready-for-shadow-pilot"', 'O04 package script: JSON includes verdict');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-operational-execution-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: complete. O01-O04 are repository-side only.',
    'Progress after O04 lands: 4/4 complete. 0 steps remain.',
    '| O04 | complete once merged | Demo CLI and reviewer sandbox |',
    'npm run demo:golden-operational-execution',
    'Markdown-first local demo',
    'JSON as secondary machine output',
  ]) {
    includes(doc, expected, `O04 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Operational Execution Golden Path O04',
    'O04 ledger: records demo CLI and reviewer sandbox',
  );
  includes(
    readme,
    '[Run the demos in order](docs/01-overview/demo-guide.md)',
    'O04 README: links the grouped demo guide',
  );
  equal(
    packageJson.scripts['demo:golden-operational-execution'],
    'tsx scripts/demo/demo-golden-operational-execution.ts',
    'O04 package script: demo command is registered',
  );
  equal(
    packageJson.scripts['test:golden-operational-execution-demo'],
    'tsx tests/golden-operational-execution-demo.test.ts',
    'O04 package script: targeted demo test is registered',
  );
}

testSummaryComposesGoldenPath();
testMarkdownAndJsonRenderers();
testPackageScriptRunsMarkdownAndJson();
testDocsAndScriptsStayAligned();

console.log(`golden-operational-execution-demo: ${passed} assertions passed`);
