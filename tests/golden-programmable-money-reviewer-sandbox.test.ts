import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_INPUT_VERSION,
  renderGoldenProgrammableMoneyReviewerSandboxJson,
  renderGoldenProgrammableMoneyReviewerSandboxMarkdown,
  runGoldenProgrammableMoneyReviewerSandbox,
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
  assert.ok(condition);
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

const ACCEPTED_INPUT = Object.freeze({
  version: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_INPUT_VERSION,
  actionSurface: 'programmable_money.transaction_intent',
  adapterKind: 'x402-payment',
  consequenceKind: 'agent-payment',
  accountKind: 'agent-wallet',
  assetKind: 'stablecoin',
  chainNamespace: 'eip155',
  valueRisk: 'medium',
  counterpartyPosture: 'allowlisted',
  approvalPosture: 'fresh',
  policyScopeStatus: 'matched',
  replayFreshness: 'fresh',
  adapterPreflightStatus: 'missing',
  settlementOrReceiptStatus: 'missing',
  instructionLikeEvidence: false,
  externalSideEffect: true,
  duplicateIntentAttempt: false,
});

function testAcceptedInputRunsShadowEngine(): void {
  const result = runGoldenProgrammableMoneyReviewerSandbox(ACCEPTED_INPUT);

  equal(result.version, 'attestor.golden-programmable-money-reviewer-sandbox.v1', 'P04 sandbox result: version is explicit');
  equal(result.step, 'P04', 'P04 sandbox result: step is explicit');
  equal(result.inputStatus, 'accepted', 'P04 sandbox result: accepted input runs');
  equal(result.engineRan, true, 'P04 sandbox result: engine runs for in-scope input');
  equal(result.engineScope, 'programmable_money.transaction_intent', 'P04 sandbox result: scope is programmable money surface');
  equal(result.expectedPosture, 'blocked-missing-settlement-proof', 'P04 sandbox result: x402 missing settlement maps to blocked posture');
  ok(result.inputDigest?.startsWith('sha256:'), 'P04 sandbox result: input digest is canonical');
  ok(result.eventDigest?.startsWith('sha256:'), 'P04 sandbox result: event digest is canonical shadow event digest');
  ok(result.smokeDigest?.startsWith('sha256:'), 'P04 sandbox result: smoke digest is canonical');
  ok(result.decisionSummary?.decisionRelevantDigest.startsWith('sha256:'), 'P04 sandbox result: decision digest is canonical');
  equal(result.safetyBoundary.noTargetSystemCall, true, 'P04 sandbox result: no target system call');
  equal(result.safetyBoundary.noWalletCall, true, 'P04 sandbox result: no wallet call');
  equal(result.safetyBoundary.noSigning, true, 'P04 sandbox result: no signing');
  equal(result.safetyBoundary.noBroadcast, true, 'P04 sandbox result: no broadcast');
  equal(result.safetyBoundary.noCustodyCallback, true, 'P04 sandbox result: no custody callback');
  equal(result.safetyBoundary.noBundlerCall, true, 'P04 sandbox result: no bundler call');
  equal(result.safetyBoundary.noFacilitatorCall, true, 'P04 sandbox result: no facilitator call');
  equal(result.safetyBoundary.noSolverCall, true, 'P04 sandbox result: no solver call');
  equal(result.safetyBoundary.canAdmit, false, 'P04 sandbox result: cannot admit');
  equal(result.safetyBoundary.productionReady, false, 'P04 sandbox result: production readiness is false');
  ok(result.issueCodes.includes('programmable-money:settlement-or-receipt-missing'), 'P04 sandbox result: settlement gap is explicit');
  ok(result.issueCodes.includes('programmable-money:block-before-resource-fulfillment'), 'P04 sandbox result: resource fulfillment block is explicit');
}

function testInvalidAndOutsideScopeInputsAreBounded(): void {
  const invalid = runGoldenProgrammableMoneyReviewerSandbox({
    version: GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_INPUT_VERSION,
    actionSurface: 'programmable_money.transaction_intent',
    adapterKind: 'wallet-call-api',
    rawTransactionPayload: 'raw-transaction-sentinel',
    privateKey: 'raw-private-key-sentinel',
  });
  const outside = runGoldenProgrammableMoneyReviewerSandbox({
    ...ACCEPTED_INPUT,
    actionSurface: 'operational_execution.change_request',
  });

  equal(invalid.inputStatus, 'invalid-schema', 'P04 sandbox invalid: schema invalid is explicit');
  equal(invalid.engineRan, false, 'P04 sandbox invalid: engine does not run');
  ok(invalid.schemaErrors.some((error) => error.includes('unknown field')), 'P04 sandbox invalid: unknown raw-like field is rejected');
  equal(outside.inputStatus, 'outside-scope', 'P04 sandbox outside: outside-scope is explicit');
  equal(outside.engineRan, false, 'P04 sandbox outside: engine does not run');
  ok(outside.issueCodes.includes('reviewer-sandbox:outside-golden-programmable-money-scope'), 'P04 sandbox outside: issue code is explicit');
}

function testAllowanceDelegationAndDuplicateIntentBoundaries(): void {
  const overbroadApproval = runGoldenProgrammableMoneyReviewerSandbox({
    ...ACCEPTED_INPUT,
    adapterKind: 'wallet-call-api',
    consequenceKind: 'approval',
    assetKind: 'fungible-token',
    valueRisk: 'high',
    counterpartyPosture: 'new-counterparty',
    policyScopeStatus: 'overbroad',
    adapterPreflightStatus: 'passed',
    settlementOrReceiptStatus: 'not-applicable',
  });
  const staleDelegation = runGoldenProgrammableMoneyReviewerSandbox({
    ...ACCEPTED_INPUT,
    adapterKind: 'eip-7702-delegation',
    consequenceKind: 'account-delegation',
    accountKind: 'eoa',
    assetKind: 'native-token',
    valueRisk: 'critical',
    approvalPosture: 'stale',
    replayFreshness: 'stale',
    adapterPreflightStatus: 'failed',
    settlementOrReceiptStatus: 'not-applicable',
  });
  const duplicate = runGoldenProgrammableMoneyReviewerSandbox({
    ...ACCEPTED_INPUT,
    adapterKind: 'safe-guard',
    consequenceKind: 'transfer',
    accountKind: 'safe',
    adapterPreflightStatus: 'passed',
    settlementOrReceiptStatus: 'not-applicable',
    duplicateIntentAttempt: true,
  });

  equal(overbroadApproval.expectedPosture, 'needs-allowance-narrowing', 'P04 sandbox approval: overbroad allowance narrows');
  ok(overbroadApproval.issueCodes.includes('programmable-money:narrow-before-wallet-action'), 'P04 sandbox approval: narrow reason is visible');
  equal(staleDelegation.expectedPosture, 'blocked-stale-delegation', 'P04 sandbox delegation: stale authority blocks');
  ok(staleDelegation.issueCodes.includes('programmable-money:approval-stale'), 'P04 sandbox delegation: stale approval is visible');
  equal(duplicate.expectedPosture, 'blocked-missing-paymaster-evidence', 'P04 sandbox duplicate: duplicate intent blocks');
  ok(duplicate.issueCodes.includes('programmable-money:duplicate-intent-replay'), 'P04 sandbox duplicate: replay reason is visible');
}

function testInstructionLikeWalletMemoIsNotAuthority(): void {
  const result = runGoldenProgrammableMoneyReviewerSandbox({
    ...ACCEPTED_INPUT,
    adapterKind: 'wallet-call-api',
    consequenceKind: 'transfer',
    accountKind: 'agent-wallet',
    valueRisk: 'high',
    counterpartyPosture: 'new-counterparty',
    approvalPosture: 'missing',
    policyScopeStatus: 'missing',
    adapterPreflightStatus: 'missing',
    settlementOrReceiptStatus: 'not-applicable',
    instructionLikeEvidence: true,
  });

  equal(result.inputStatus, 'accepted', 'P04 sandbox memo: input is accepted as structured review material');
  equal(result.expectedPosture, 'blocked-instruction-like-memo', 'P04 sandbox memo: instruction-like evidence blocks');
  ok(result.issueCodes.includes('programmable-money:wallet-memo-or-model-text-is-not-authority'), 'P04 sandbox memo: memo text is not authority');
  ok(result.issueCodes.includes('programmable-money:block-instruction-like-evidence'), 'P04 sandbox memo: instruction-like evidence block reason is visible');
}

function testRenderersAndCli(): void {
  const result = runGoldenProgrammableMoneyReviewerSandbox(ACCEPTED_INPUT);
  const markdown = renderGoldenProgrammableMoneyReviewerSandboxMarkdown(result);
  const json = renderGoldenProgrammableMoneyReviewerSandboxJson(result);
  const parsed = JSON.parse(json) as { readonly version: string; readonly inputStatus: string };
  const cli = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-programmable-money',
      '--',
      '--scenario',
      'fixtures/golden-programmable-money-reviewer-sandbox.example.json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  const cliJson = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-programmable-money',
      '--',
      '--scenario=fixtures/golden-programmable-money-reviewer-sandbox.example.json',
      '--json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  for (const expected of [
    '# Golden Path: Programmable Money Reviewer Sandbox',
    'Status: accepted',
    '## Practical Contrast',
    'Without Attestor for this local input:',
    'With Attestor for this local input:',
    'engine ran: true',
    'visible gate stages: 10',
    'settlement-or-receipt-missing',
    'wallet calls: 0',
    'signatures: 0',
    'broadcasts: 0',
    'custody callbacks: 0',
    'production ready: false',
  ]) {
    includes(markdown, expected, `P04 sandbox markdown: records ${expected}`);
  }
  equal(parsed.version, 'attestor.golden-programmable-money-reviewer-sandbox.v1', 'P04 sandbox JSON: version is explicit');
  equal(parsed.inputStatus, 'accepted', 'P04 sandbox JSON: accepted status is explicit');
  equal(cli.status, 0, 'P04 sandbox CLI: scenario markdown exits cleanly');
  includes(cli.stdout, '# Golden Path: Programmable Money Reviewer Sandbox', 'P04 sandbox CLI: scenario markdown is rendered');
  equal(cliJson.status, 0, 'P04 sandbox CLI: scenario JSON exits cleanly');
  includes(cliJson.stdout, '"inputStatus": "accepted"', 'P04 sandbox CLI: scenario JSON is rendered');
  excludes(json, /-----BEGIN|api[_-]?key|password|secretValue|privateKey|seedPhrase|mnemonic/iu, 'P04 sandbox JSON: no wallet or provider secrets are rendered');
  excludes(json, /"rawTransactionPayload"\s*:|"rawWalletMaterial"\s*:|"rawPayload"\s*:/iu, 'P04 sandbox JSON: no raw programmable-money material fields are rendered');
  excludes(json, /wallet_sendCalls|eth_sendUserOperation|eth_sendRawTransaction|broadcastTransaction|signTransaction|settlePayment|createTransaction|executeTransaction|safeTxHash/iu, 'P04 sandbox JSON: no executable wallet or settlement command is rendered');
}

function testDemoCliPathBoundary(): void {
  const outsideScenario = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-programmable-money',
      '--',
      '--scenario',
      'package.json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  equal(outsideScenario.status, 1, 'P04 sandbox CLI boundary: scenario outside fixtures is rejected');
  includes(outsideScenario.stderr, 'outside approved demo roots', 'P04 sandbox CLI boundary: scenario rejection names approved roots');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-programmable-money-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const fixture = readProjectFile('fixtures', 'golden-programmable-money-reviewer-sandbox.example.json');

  for (const expected of [
    'Progress after P04 lands: 4/4 complete. 0 steps remain.',
    '| P04 | complete once merged | Demo CLI and reviewer sandbox |',
    '--scenario fixtures/golden-programmable-money-reviewer-sandbox.example.json',
    'strict JSON allowlist',
    'EIP-712',
    'reviewer sandbox',
  ]) {
    includes(doc, expected, `P04 sandbox doc: records ${expected}`);
  }
  includes(ledger, 'Programmable Money Golden Path P04', 'P04 sandbox ledger: records reviewer sandbox');
  includes(fixture, GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_INPUT_VERSION, 'P04 sandbox fixture: example input version is present');
  equal(
    packageJson.scripts['test:golden-programmable-money-reviewer-sandbox'],
    'tsx tests/golden-programmable-money-reviewer-sandbox.test.ts',
    'P04 sandbox package script: targeted test is registered',
  );
}

testAcceptedInputRunsShadowEngine();
testInvalidAndOutsideScopeInputsAreBounded();
testAllowanceDelegationAndDuplicateIntentBoundaries();
testInstructionLikeWalletMemoIsNotAuthority();
testRenderersAndCli();
testDemoCliPathBoundary();
testDocsAndScriptsStayAligned();

console.log(`golden-programmable-money-reviewer-sandbox: ${passed} assertions passed`);
