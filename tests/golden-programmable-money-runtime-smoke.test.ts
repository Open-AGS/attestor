import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  goldenProgrammableMoneyRuntimeSmokeDescriptor,
  runGoldenProgrammableMoneyRuntimeSmoke,
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

function testDescriptor(): void {
  const descriptor = goldenProgrammableMoneyRuntimeSmokeDescriptor();

  equal(descriptor.version, 'attestor.golden-programmable-money-runtime-smoke.v1', 'P03 runtime descriptor: version is explicit');
  equal(descriptor.step, 'P03', 'P03 runtime descriptor: step is explicit');
  equal(descriptor.scenarioCount, 8, 'P03 runtime descriptor: scenario count is fixed');
  equal(descriptor.runsP01FixturesThroughR02ToR07, true, 'P03 runtime descriptor: runs P01 through R02-R07');
  equal(descriptor.executionMode, 'shadow-only', 'P03 runtime descriptor: execution mode is shadow-only');
  equal(descriptor.fixtureOnly, true, 'P03 runtime descriptor: fixture-only is true');
  equal(descriptor.noTargetSystemCall, true, 'P03 runtime descriptor: target-system calls are forbidden');
  equal(descriptor.noWalletCall, true, 'P03 runtime descriptor: wallet calls are forbidden');
  equal(descriptor.noSigning, true, 'P03 runtime descriptor: signing is forbidden');
  equal(descriptor.noBroadcast, true, 'P03 runtime descriptor: broadcast is forbidden');
  equal(descriptor.noCustodyCallback, true, 'P03 runtime descriptor: custody callbacks are forbidden');
  equal(descriptor.noBundlerCall, true, 'P03 runtime descriptor: bundler calls are forbidden');
  equal(descriptor.noFacilitatorCall, true, 'P03 runtime descriptor: facilitator calls are forbidden');
  equal(descriptor.noSolverCall, true, 'P03 runtime descriptor: solver calls are forbidden');
  equal(descriptor.noProviderCall, true, 'P03 runtime descriptor: provider calls are forbidden');
  equal(descriptor.noAuditWrite, true, 'P03 runtime descriptor: audit writes are forbidden');
  equal(descriptor.noPolicyActivation, true, 'P03 runtime descriptor: policy activation is forbidden');
  equal(descriptor.canAdmit, false, 'P03 runtime descriptor: cannot admit');
  equal(descriptor.productionReady, false, 'P03 runtime descriptor: production readiness is false');
}

function testRuntimeSmokeRunsAllScenarios(): void {
  const result = runGoldenProgrammableMoneyRuntimeSmoke();
  const scenarios = result.scenarioResults.map((item) => item.scenario).sort();

  equal(result.version, 'attestor.golden-programmable-money-runtime-smoke.v1', 'P03 runtime result: version is explicit');
  equal(result.step, 'P03', 'P03 runtime result: step is explicit');
  equal(result.scenarioCount, 8, 'P03 runtime result: scenario count is fixed');
  equal(result.smokeResults.length, 8, 'P03 runtime result: eight smoke results are emitted');
  equal(result.phaseDigests.length, 8, 'P03 runtime result: one phase digest per scenario is retained');
  equal(result.allScenariosCompleted, true, 'P03 runtime result: all scenarios completed');
  equal(result.executionMode, 'shadow-only', 'P03 runtime result: execution mode is shadow-only');
  equal(result.fixtureOnly, true, 'P03 runtime result: fixture-only is true');
  equal(result.deterministicReplay, true, 'P03 runtime result: deterministic replay is true');
  equal(result.noTargetSystemCall, true, 'P03 runtime result: target-system calls are forbidden');
  equal(result.noWalletCall, true, 'P03 runtime result: wallet calls are forbidden');
  equal(result.noSigning, true, 'P03 runtime result: signing is forbidden');
  equal(result.noBroadcast, true, 'P03 runtime result: broadcast is forbidden');
  equal(result.noCustodyCallback, true, 'P03 runtime result: custody callbacks are forbidden');
  equal(result.noBundlerCall, true, 'P03 runtime result: bundler calls are forbidden');
  equal(result.noFacilitatorCall, true, 'P03 runtime result: facilitator calls are forbidden');
  equal(result.noSolverCall, true, 'P03 runtime result: solver calls are forbidden');
  equal(result.noProviderCall, true, 'P03 runtime result: provider calls are forbidden');
  equal(result.noAuditWrite, true, 'P03 runtime result: audit writes are forbidden');
  equal(result.noExternalEventBus, true, 'P03 runtime result: external event bus is forbidden');
  equal(result.noExternalTraceExport, true, 'P03 runtime result: external trace export is forbidden');
  equal(result.noExternalLineageExport, true, 'P03 runtime result: external lineage export is forbidden');
  equal(result.noPolicyActivation, true, 'P03 runtime result: policy activation is forbidden');
  equal(result.grantsAuthority, false, 'P03 runtime result: grants authority is false');
  equal(result.canAdmit, false, 'P03 runtime result: cannot admit');
  equal(result.activatesEnforcement, false, 'P03 runtime result: cannot activate enforcement');
  equal(result.autoEnforce, false, 'P03 runtime result: auto enforcement is false');
  equal(result.rawPayloadRead, false, 'P03 runtime result: raw payload read is false');
  equal(result.rawPayloadStored, false, 'P03 runtime result: raw payload stored is false');
  equal(result.rawTransactionPayloadRead, false, 'P03 runtime result: raw transaction payload read is false');
  equal(result.rawTransactionPayloadStored, false, 'P03 runtime result: raw transaction payload stored is false');
  equal(result.rawWalletMaterialRead, false, 'P03 runtime result: raw wallet material read is false');
  equal(result.rawWalletMaterialStored, false, 'P03 runtime result: raw wallet material stored is false');
  equal(result.rawCustomerIdentifiersRead, false, 'P03 runtime result: raw customer identifiers read is false');
  equal(result.rawCustomerIdentifiersStored, false, 'P03 runtime result: raw customer identifiers stored is false');
  equal(result.productionReady, false, 'P03 runtime result: production readiness is false');
  assert.deepEqual(
    scenarios,
    [
      'custody-withdrawal-quorum-pending',
      'delegated-eoa-stale-authorization',
      'erc4337-user-operation-paymaster-missing',
      'intent-solver-deadline-slippage-review',
      'prompt-injection-in-wallet-memo',
      'safe-transfer-allowlisted-recipient',
      'unlimited-approval-review',
      'x402-agent-payment-settlement-missing',
    ],
    'P03 runtime result: all P01 scenarios are represented',
  );
  passed += 1;
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.digest), 'P03 runtime result: digest is canonical');
}

function testEachScenarioBindsRuntimeArtifacts(): void {
  const result = runGoldenProgrammableMoneyRuntimeSmoke();

  for (const scenario of result.scenarioResults) {
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.fixtureDigest), `P03 ${scenario.scenario}: fixture digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.sourceEventDigest), `P03 ${scenario.scenario}: source event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.smokeDigest), `P03 ${scenario.scenario}: smoke digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.envelopeRefDigest), `P03 ${scenario.scenario}: envelope digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.assurancePacketDigest), `P03 ${scenario.scenario}: assurance packet digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalAssuranceCaseDigest), `P03 ${scenario.scenario}: assurance case digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalLineageGraphDigest), `P03 ${scenario.scenario}: lineage digest is canonical`);
    equal(scenario.noTargetSystemCall, true, `P03 ${scenario.scenario}: no target-system call`);
    equal(scenario.noWalletCall, true, `P03 ${scenario.scenario}: no wallet call`);
    equal(scenario.noSigning, true, `P03 ${scenario.scenario}: no signing`);
    equal(scenario.noBroadcast, true, `P03 ${scenario.scenario}: no broadcast`);
    equal(scenario.noCustodyCallback, true, `P03 ${scenario.scenario}: no custody callback`);
    equal(scenario.noBundlerCall, true, `P03 ${scenario.scenario}: no bundler call`);
    equal(scenario.noFacilitatorCall, true, `P03 ${scenario.scenario}: no facilitator call`);
    equal(scenario.noSolverCall, true, `P03 ${scenario.scenario}: no solver call`);
    equal(scenario.canAdmit, false, `P03 ${scenario.scenario}: cannot admit`);
    equal(scenario.productionReady, false, `P03 ${scenario.scenario}: production readiness is false`);
  }
}

function testDeterminismAndDataMinimization(): void {
  const first = runGoldenProgrammableMoneyRuntimeSmoke();
  const second = runGoldenProgrammableMoneyRuntimeSmoke();
  const serialized = JSON.stringify(first);

  equal(first.digest, second.digest, 'P03 runtime smoke: full digest is deterministic');
  equal(first.phaseDigests.join('\n'), second.phaseDigests.join('\n'), 'P03 runtime smoke: phase digests are deterministic');
  excludes(serialized, /AKIA|ASIA|AIza|sk_live|rk_live|whsec|xox[abprs]-|-----BEGIN [A-Z ]*PRIVATE KEY-----/u, 'P03 runtime smoke: no provider or secret token material is serialized');
  excludes(serialized, /"(?:privateKey|seedPhrase|mnemonic|signedTransaction|rawTransaction|accessToken|bearerToken)"\s*:/iu, 'P03 runtime smoke: no wallet credential or raw transaction fields are serialized');
  excludes(serialized, /\b(customer|tenant|account)[_-]?[0-9]{3,}\b/iu, 'P03 runtime smoke: no raw customer, tenant, or account id is serialized');
  excludes(serialized, /wallet_sendCalls|eth_sendUserOperation|eth_sendRawTransaction|broadcastTransaction|signTransaction|settlePayment|createTransaction|executeTransaction|safeTxHash/iu, 'P03 runtime smoke: no executable wallet, bundler, custody, facilitator, solver, or settlement command is serialized');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-programmable-money-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Progress after P04 lands: 4/4 complete. 0 steps remain.',
    '| P03 | complete | Runtime smoke and pilot readiness |',
    'R02-R07 shadow runtime smoke chain',
    'ready-for-shadow-pilot',
    'no wallet call, no signing, no broadcast, no custody callback',
    'no bundler call, no facilitator call, no solver call',
  ]) {
    includes(doc, expected, `P03 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Programmable Money Golden Path P03',
    'P03 ledger: records runtime smoke and pilot readiness',
  );
  equal(
    packageJson.scripts['test:golden-programmable-money-runtime-smoke'],
    'tsx tests/golden-programmable-money-runtime-smoke.test.ts',
    'P03 runtime package script: targeted test is registered',
  );
}

testDescriptor();
testRuntimeSmokeRunsAllScenarios();
testEachScenarioBindsRuntimeArtifacts();
testDeterminismAndDataMinimization();
testDocsAndScriptsStayAligned();

console.log(`golden-programmable-money-runtime-smoke: ${passed} assertions passed`);
