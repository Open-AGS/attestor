import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenProgrammableMoneyDemoSummary,
  renderGoldenProgrammableMoneyDemoJson,
  renderGoldenProgrammableMoneyDemoMarkdown,
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
  const summary = createGoldenProgrammableMoneyDemoSummary();

  equal(summary.version, 'attestor.golden-programmable-money-demo.v1', 'P04 summary: version is explicit');
  equal(summary.step, 'P04', 'P04 summary: step is explicit');
  equal(summary.actionSurface, 'programmable_money.transaction_intent', 'P04 summary: action surface is programmable money');
  equal(summary.domain, 'programmable-money', 'P04 summary: domain is programmable money');
  equal(summary.scenarioCount, 8, 'P04 summary: scenario count is fixed');
  equal(summary.candidateMode, 'review', 'P04 summary: candidate mode is review');
  equal(summary.namedGaps.length, 7, 'P04 summary: seven named gaps are shown');
  equal(summary.readinessVerdict, 'ready-for-shadow-pilot', 'P04 summary: readiness verdict is shadow-pilot ready');
  equal(summary.readinessBlockers.length, 0, 'P04 summary: readiness blockers are empty');
  equal(summary.markdownPrimary, true, 'P04 summary: markdown is primary');
  equal(summary.jsonSecondary, true, 'P04 summary: JSON is secondary');
  equal(summary.shadowOnly, true, 'P04 summary: shadow-only is true');
  equal(summary.fixtureOnly, true, 'P04 summary: fixture-only is true');
  equal(summary.previewOnly, true, 'P04 summary: preview-only is true');
  equal(summary.deterministicReplay, true, 'P04 summary: deterministic replay is true');
  equal(summary.noTargetSystemCall, true, 'P04 summary: no target system call');
  equal(summary.noWalletCall, true, 'P04 summary: no wallet call');
  equal(summary.noSigning, true, 'P04 summary: no signing');
  equal(summary.noBroadcast, true, 'P04 summary: no broadcast');
  equal(summary.noCustodyCallback, true, 'P04 summary: no custody callback');
  equal(summary.noBundlerCall, true, 'P04 summary: no bundler call');
  equal(summary.noFacilitatorCall, true, 'P04 summary: no facilitator call');
  equal(summary.noSolverCall, true, 'P04 summary: no solver call');
  equal(summary.canAdmit, false, 'P04 summary: cannot admit');
  equal(summary.productionReady, false, 'P04 summary: production readiness is false');
  ok(/^sha256:[a-f0-9]{64}$/u.test(summary.digest), 'P04 summary: digest is canonical');
}

function testMarkdownAndJsonRenderers(): void {
  const summary = createGoldenProgrammableMoneyDemoSummary();
  const markdown = renderGoldenProgrammableMoneyDemoMarkdown(summary);
  const json = renderGoldenProgrammableMoneyDemoJson(summary);
  const parsed = JSON.parse(json) as { readonly version: string; readonly digest: string };

  for (const expected of [
    '# Golden Path: Programmable Money',
    'Verdict: ready-for-shadow-pilot',
    '## What This Shows',
    '## Business Contrast',
    'Without Attestor in this repo path:',
    'With Attestor in this repo path:',
    '0 wallet calls',
    '0 signatures',
    '0 broadcasts',
    '0 custody callbacks',
    '0 bundler calls',
    '0 facilitator calls',
    '0 solver calls',
    'safe-transfer-allowlisted-recipient',
    'erc4337-user-operation-paymaster-missing',
    'x402-agent-payment-settlement-missing',
    'custody-withdrawal-quorum-pending',
    'intent-solver-deadline-slippage-review',
    'prompt-injection-in-wallet-memo',
    'It does not call a wallet',
  ]) {
    includes(markdown, expected, `P04 markdown: records ${expected}`);
  }

  equal(parsed.version, 'attestor.golden-programmable-money-demo.v1', 'P04 JSON: version is explicit');
  equal(parsed.digest, summary.digest, 'P04 JSON: digest matches summary');
  excludes(markdown, /-----BEGIN|api[_-]?key|password|secretValue|privateKey|seedPhrase|mnemonic/iu, 'P04 markdown: no wallet or provider secrets are rendered');
  excludes(json, /"rawTransactionPayload"\s*:|"rawWalletMaterial"\s*:|"rawPayload"\s*:/iu, 'P04 JSON: no raw programmable-money material fields are rendered');
  excludes(json, /wallet_sendCalls|eth_sendUserOperation|eth_sendRawTransaction|broadcastTransaction|signTransaction|settlePayment|createTransaction|executeTransaction|safeTxHash/iu, 'P04 JSON: no executable wallet or settlement command is rendered');
}

function testPackageScriptRunsMarkdownAndJson(): void {
  const markdown = spawnSync(
    'npm',
    ['run', 'demo:golden-programmable-money'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  const json = spawnSync(
    'npm',
    ['run', 'demo:golden-programmable-money', '--', '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  equal(markdown.status, 0, 'P04 package script: markdown command exits cleanly');
  equal(json.status, 0, 'P04 package script: JSON command exits cleanly');
  includes(markdown.stdout, '# Golden Path: Programmable Money', 'P04 package script: markdown is default');
  includes(markdown.stdout, 'Verdict: ready-for-shadow-pilot', 'P04 package script: markdown includes verdict');
  includes(json.stdout, '"version": "attestor.golden-programmable-money-demo.v1"', 'P04 package script: JSON flag emits JSON');
  includes(json.stdout, '"readinessVerdict": "ready-for-shadow-pilot"', 'P04 package script: JSON includes verdict');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-programmable-money-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: complete. P01-P04 are repository-side only.',
    'Progress after P04 lands: 4/4 complete. 0 steps remain.',
    '| P04 | complete once merged | Demo CLI and reviewer sandbox |',
    'npm run demo:golden-programmable-money',
    'Markdown-first local demo',
    'JSON as secondary machine output',
  ]) {
    includes(doc, expected, `P04 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Programmable Money Golden Path P04',
    'P04 ledger: records demo CLI and reviewer sandbox',
  );
  includes(
    readme,
    '[Golden Path: Programmable Money](docs/02-architecture/golden-programmable-money-shadow-pilot.md)',
    'P04 README: keeps programmable money golden path link',
  );
  equal(
    packageJson.scripts['demo:golden-programmable-money'],
    'tsx scripts/demo-golden-programmable-money.ts',
    'P04 package script: demo command is registered',
  );
  equal(
    packageJson.scripts['test:golden-programmable-money-demo'],
    'tsx tests/golden-programmable-money-demo.test.ts',
    'P04 package script: targeted demo test is registered',
  );
}

testSummaryComposesGoldenPath();
testMarkdownAndJsonRenderers();
testPackageScriptRunsMarkdownAndJson();
testDocsAndScriptsStayAligned();

console.log(`golden-programmable-money-demo: ${passed} assertions passed`);
