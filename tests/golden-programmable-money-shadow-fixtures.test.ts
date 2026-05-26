import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenProgrammableMoneyShadowFixtureSuite,
  goldenProgrammableMoneyShadowFixturesDescriptor,
  GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_SCENARIOS,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
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

function testSuiteShape(): void {
  const suite = createGoldenProgrammableMoneyShadowFixtureSuite();

  equal(suite.version, 'attestor.golden-programmable-money-shadow-fixtures.v1', 'P01 fixtures: version is explicit');
  equal(suite.name, 'Golden Path: Programmable Money', 'P01 fixtures: suite is bound to the programmable-money golden path');
  equal(suite.step, 'P01', 'P01 fixtures: step is explicit');
  equal(suite.fixtureCount, 8, 'P01 fixtures: exactly eight scenarios are emitted');
  deepEqual(
    suite.scenarios,
    GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_SCENARIOS,
    'P01 fixtures: scenarios match the canonical list',
  );
  equal(suite.shadowOnly, true, 'P01 fixtures: suite is shadow-only');
  equal(suite.noTargetSystemCalls, true, 'P01 fixtures: suite performs no target-system calls');
  equal(suite.noWalletCalls, true, 'P01 fixtures: suite performs no wallet calls');
  equal(suite.noSigning, true, 'P01 fixtures: suite performs no signing');
  equal(suite.noBroadcast, true, 'P01 fixtures: suite performs no broadcast');
  equal(suite.noCustodyCallbacks, true, 'P01 fixtures: suite performs no custody callbacks');
  equal(suite.noBundlerCalls, true, 'P01 fixtures: suite performs no bundler calls');
  equal(suite.noFacilitatorCalls, true, 'P01 fixtures: suite performs no facilitator calls');
  equal(suite.noSolverCalls, true, 'P01 fixtures: suite performs no solver calls');
  equal(suite.noRawPayload, true, 'P01 fixtures: suite carries no raw payload');
  equal(suite.noRawTransactionPayload, true, 'P01 fixtures: suite carries no raw transaction payload');
  equal(suite.noRawWalletMaterial, true, 'P01 fixtures: suite carries no raw wallet material');
  equal(suite.noRawCustomerIdentifiers, true, 'P01 fixtures: suite carries no raw customer identifiers');
  equal(suite.autoEnforce, false, 'P01 fixtures: suite cannot auto-enforce');
  equal(suite.productionReady, false, 'P01 fixtures: suite is not production-ready');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.digest), 'P01 fixtures: suite digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.sourceRecipeRefDigest), 'P01 fixtures: source recipe ref is digest-bound');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.actionSurfaceRefDigest), 'P01 fixtures: action surface ref is digest-bound');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.cryptoAuthorizationCoreRefDigest), 'P01 fixtures: authorization core ref is digest-bound');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.cryptoExecutionAdmissionRefDigest), 'P01 fixtures: execution admission ref is digest-bound');
}

function testCanonicalEventsAreDigestOnly(): void {
  const suite = createGoldenProgrammableMoneyShadowFixtureSuite();
  const serialized = JSON.stringify(suite);

  for (const fixture of suite.fixtures) {
    equal(fixture.fixtureOnly, true, `P01 ${fixture.scenario}: fixture-only flag is true`);
    equal(fixture.synthetic, true, `P01 ${fixture.scenario}: synthetic flag is true`);
    equal(fixture.shadowOnly, true, `P01 ${fixture.scenario}: shadow-only flag is true`);
    equal(fixture.noTargetSystemCall, true, `P01 ${fixture.scenario}: no target-system call flag is true`);
    equal(fixture.noWalletCall, true, `P01 ${fixture.scenario}: no wallet call flag is true`);
    equal(fixture.noSigning, true, `P01 ${fixture.scenario}: no signing flag is true`);
    equal(fixture.noBroadcast, true, `P01 ${fixture.scenario}: no broadcast flag is true`);
    equal(fixture.noCustodyCallback, true, `P01 ${fixture.scenario}: no custody callback flag is true`);
    equal(fixture.noBundlerCall, true, `P01 ${fixture.scenario}: no bundler call flag is true`);
    equal(fixture.noFacilitatorCall, true, `P01 ${fixture.scenario}: no facilitator call flag is true`);
    equal(fixture.noSolverCall, true, `P01 ${fixture.scenario}: no solver call flag is true`);
    equal(fixture.noRawPayload, true, `P01 ${fixture.scenario}: no raw payload flag is true`);
    equal(fixture.noRawTransactionPayload, true, `P01 ${fixture.scenario}: no raw transaction payload flag is true`);
    equal(fixture.noRawWalletMaterial, true, `P01 ${fixture.scenario}: no raw wallet material flag is true`);
    equal(fixture.noRawCustomerIdentifiers, true, `P01 ${fixture.scenario}: no raw customer identifiers flag is true`);
    equal(fixture.autoEnforce, false, `P01 ${fixture.scenario}: cannot auto-enforce`);
    equal(fixture.productionReady, false, `P01 ${fixture.scenario}: is not production-ready`);
    equal(fixture.event.version, 'attestor.canonical-shadow-event.v1', `P01 ${fixture.scenario}: event is canonical`);
    equal(fixture.event.sourceKind, 'crypto-execution-admission', `P01 ${fixture.scenario}: event source is crypto execution admission`);
    equal(fixture.event.observed.consequenceClass, 'programmable-money', `P01 ${fixture.scenario}: consequence class is programmable money`);
    equal(fixture.event.rawPayloadStored, false, `P01 ${fixture.scenario}: raw payload storage is false`);
    equal(fixture.event.rawMaterialBoundary.rawWalletMaterialStored, false, `P01 ${fixture.scenario}: raw wallet material boundary is false`);
    equal(fixture.event.autoEnforce, false, `P01 ${fixture.scenario}: event cannot auto-enforce`);
    equal(fixture.event.approvalRequiredForPromotion, true, `P01 ${fixture.scenario}: promotion requires approval`);
    ok(fixture.event.evidenceRefs.length >= 2, `P01 ${fixture.scenario}: evidence refs are present`);
    ok(fixture.event.simulationRefs.length >= 1, `P01 ${fixture.scenario}: simulation refs are present`);
    ok(fixture.event.policyRefs.length === 1, `P01 ${fixture.scenario}: review-only policy ref is present`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.event.digest), `P01 ${fixture.scenario}: event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.digest), `P01 ${fixture.scenario}: fixture digest is canonical`);
  }

  excludes(serialized, /AKIA|ASIA|AIza|sk_live|rk_live|whsec|xox[abprs]-|-----BEGIN [A-Z ]*PRIVATE KEY-----/u, 'P01 fixtures: no provider or secret token material is serialized');
  excludes(serialized, /"(?:privateKey|seedPhrase|mnemonic|signature|signedTransaction|rawTransaction|accessToken|bearerToken)"\s*:/iu, 'P01 fixtures: no wallet credential or raw transaction fields are serialized');
  excludes(serialized, /\b(customer|tenant|account)[_-]?[0-9]{3,}\b/iu, 'P01 fixtures: no raw customer, tenant, or account id is serialized');
  excludes(serialized, /wallet_sendCalls|eth_sendUserOperation|eth_sendRawTransaction|broadcastTransaction|signTransaction|settlePayment|createTransaction|executeTransaction|safeTxHash/iu, 'P01 fixtures: no executable wallet, bundler, custody, or settlement command is serialized');
}

function testScenarioSemantics(): void {
  const suite = createGoldenProgrammableMoneyShadowFixtureSuite();
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));

  equal(
    byScenario.get('safe-transfer-allowlisted-recipient')?.expectedDecision,
    'admit',
    'P01 Safe transfer: expected decision is admit',
  );
  equal(
    byScenario.get('safe-transfer-allowlisted-recipient')?.event.decision.shadowDecision,
    'would_admit',
    'P01 Safe transfer: shadow decision would admit',
  );

  equal(
    byScenario.get('unlimited-approval-review')?.expectedDecision,
    'narrow',
    'P01 unlimited approval: expected decision is narrow',
  );
  includes(
    byScenario.get('unlimited-approval-review')?.reasonCodes.join('\n') ?? '',
    'programmable-money:narrow-allowance-and-validity-window',
    'P01 unlimited approval: narrowing reason is present',
  );

  for (const scenario of [
    'erc4337-user-operation-paymaster-missing',
    'delegated-eoa-stale-authorization',
    'x402-agent-payment-settlement-missing',
    'prompt-injection-in-wallet-memo',
  ] as const) {
    equal(
      byScenario.get(scenario)?.expectedDecision,
      'block',
      `P01 ${scenario}: expected decision is block`,
    );
    equal(
      byScenario.get(scenario)?.event.decision.effectiveDecision,
      'block',
      `P01 ${scenario}: effective decision is fail-closed block`,
    );
  }

  equal(
    byScenario.get('custody-withdrawal-quorum-pending')?.operationFacts.approvalPosture,
    'quorum-pending',
    'P01 custody withdrawal: approval quorum is pending',
  );
  includes(
    byScenario.get('custody-withdrawal-quorum-pending')?.reasonCodes.join('\n') ?? '',
    'programmable-money:review-before-cosigner-response',
    'P01 custody withdrawal: co-signer review reason is present',
  );

  equal(
    byScenario.get('intent-solver-deadline-slippage-review')?.operationFacts.adapterKind,
    'intent-settlement',
    'P01 intent solver: adapter kind is intent settlement',
  );
  includes(
    byScenario.get('intent-solver-deadline-slippage-review')?.expectedSignals.join('\n') ?? '',
    'solver-liquidity-review',
    'P01 intent solver: liquidity review signal is present',
  );

  equal(
    byScenario.get('prompt-injection-in-wallet-memo')?.operationFacts.instructionLikeEvidence,
    true,
    'P01 prompt injection: instruction-like wallet memo flag is true',
  );
  includes(
    byScenario.get('prompt-injection-in-wallet-memo')?.reasonCodes.join('\n') ?? '',
    'programmable-money:wallet-memo-is-not-authority',
    'P01 prompt injection: wallet memo cannot become authority',
  );
}

function testDescriptorDocsAndScriptsStayAligned(): void {
  const descriptor = goldenProgrammableMoneyShadowFixturesDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-programmable-money-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-programmable-money-shadow-fixtures.v1', 'P01 descriptor: version is explicit');
  equal(descriptor.step, 'P01', 'P01 descriptor: step is explicit');
  equal(descriptor.shadowOnly, true, 'P01 descriptor: shadow-only is explicit');
  equal(descriptor.noTargetSystemCalls, true, 'P01 descriptor: target-system calls are forbidden');
  equal(descriptor.noWalletCalls, true, 'P01 descriptor: wallet calls are forbidden');
  equal(descriptor.noSigning, true, 'P01 descriptor: signing is forbidden');
  equal(descriptor.noBroadcast, true, 'P01 descriptor: broadcast is forbidden');
  equal(descriptor.noRawWalletMaterial, true, 'P01 descriptor: wallet material is forbidden');
  equal(descriptor.productionReady, false, 'P01 descriptor: production readiness is denied');
  ok(descriptor.nonClaims.includes('not-a-wallet-custodian-signer-bundler-or-broadcaster'), 'P01 descriptor: wallet/custody/signer/bundler non-claim is explicit');

  for (const expected of [
    'Status: complete. P01-P04 are repository-side only.',
    'Progress after P04 lands: 4/4 complete. 0 steps remain.',
    '| P01 | complete | Programmable Money shadow fixture contract |',
    'safe-transfer-allowlisted-recipient',
    'unlimited-approval-review',
    'erc4337-user-operation-paymaster-missing',
    'delegated-eoa-stale-authorization',
    'x402-agent-payment-settlement-missing',
    'custody-withdrawal-quorum-pending',
    'intent-solver-deadline-slippage-review',
    'prompt-injection-in-wallet-memo',
    'EIP-712',
    'ERC-4337',
    'Safe guards',
    'x402',
    'Fireblocks API co-signer',
  ]) {
    includes(doc, expected, `P01 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Programmable Money Golden Path P01',
    'P01 ledger: records the programmable-money fixture contract',
  );
  includes(
    readme,
    '[Golden Path: Programmable Money](docs/02-architecture/golden-programmable-money-shadow-pilot.md)',
    'P01 README: includes the programmable-money golden path',
  );
  equal(
    packageJson.scripts['test:golden-programmable-money-shadow-fixtures'],
    'tsx tests/golden-programmable-money-shadow-fixtures.test.ts',
    'P01 package script: targeted test is registered',
  );
}

testSuiteShape();
testCanonicalEventsAreDigestOnly();
testScenarioSemantics();
testDescriptorDocsAndScriptsStayAligned();

console.log(`golden-programmable-money-shadow-fixtures: ${passed} assertions passed`);
