import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenProgrammableMoneyPolicyFoundryProjection,
  goldenProgrammableMoneyPolicyFoundryProjectionDescriptor,
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

function testProjectionShape(): void {
  const projection = createGoldenProgrammableMoneyPolicyFoundryProjection();

  equal(projection.version, 'attestor.golden-programmable-money-policy-foundry-projection.v1', 'P02 projection: version is explicit');
  equal(projection.step, 'P02', 'P02 projection: step is explicit');
  equal(projection.sourceFixtureCount, 8, 'P02 projection: consumes eight P01 fixtures');
  equal(projection.actionSurface, 'programmable_money.transaction_intent', 'P02 projection: action surface is programmable-money transaction intent');
  equal(projection.domain, 'programmable-money', 'P02 projection: domain stays programmable-money');
  equal(projection.approvalRequired, true, 'P02 projection: approval remains required');
  equal(projection.autoEnforce, false, 'P02 projection: auto enforcement is false');
  equal(projection.activatesEnforcement, false, 'P02 projection: enforcement activation is false');
  equal(projection.rawPayloadStored, false, 'P02 projection: raw payload storage is false');
  equal(projection.rawTransactionPayloadStored, false, 'P02 projection: raw transaction payload storage is false');
  equal(projection.rawWalletMaterialStored, false, 'P02 projection: raw wallet material storage is false');
  equal(projection.rawCustomerIdentifiersStored, false, 'P02 projection: raw customer identifiers storage is false');
  equal(projection.productionReady, false, 'P02 projection: production readiness is false');
  equal(projection.reviewMaterialOnly, true, 'P02 projection: output is review material only');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.digest), 'P02 projection: digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.sourceFixtureSuiteDigest), 'P02 projection: source fixture suite digest is canonical');
}

function testPolicyTwinSummaryIsReviewOnly(): void {
  const projection = createGoldenProgrammableMoneyPolicyFoundryProjection();
  const summary = projection.policyTwinSummary;

  equal(summary.version, 'attestor.policy-foundry-policy-twin-summary.v1', 'P02 summary: policy twin summary version is retained');
  equal(summary.status, 'review-only', 'P02 summary: programmable-money candidate stays review-only');
  equal(summary.recommendedRolloutStep, 'review-required', 'P02 summary: recommended rollout is review-required');
  equal(summary.eventCount, 8, 'P02 summary: event count is fixture count');
  equal(summary.decisionImpact.admitCount, 1, 'P02 summary: admit count comes from the allowlisted Safe fixture');
  equal(summary.decisionImpact.narrowCount, 1, 'P02 summary: narrow count comes from the allowance fixture');
  equal(summary.decisionImpact.reviewCount, 2, 'P02 summary: review count comes from custody and intent fixtures');
  equal(summary.decisionImpact.blockCount, 4, 'P02 summary: block count comes from paymaster, delegation, x402, and memo fixtures');
  equal(summary.gapCounts.policy, 3, 'P02 summary: policy gaps count overbroad/missing scope');
  equal(summary.gapCounts.evidence, 6, 'P02 summary: evidence gaps count preflight/settlement/pending/instruction posture');
  equal(summary.gapCounts.authority, 4, 'P02 summary: authority gaps count approval/delegation/custody/memo posture');
  equal(summary.gapCounts.adapter, 6, 'P02 summary: adapter gaps count preflight/settlement handoff gaps');
  equal(summary.policyTwinEvidenceOnly, true, 'P02 summary: policy twin output is evidence-only');
  equal(summary.autoEnforce, false, 'P02 summary: auto enforcement is false');
  equal(summary.activatesEnforcement, false, 'P02 summary: enforcement activation is false');
  equal(summary.productionReady, false, 'P02 summary: production readiness is false');
}

function testNamedGapsAndBacktestMaterial(): void {
  const projection = createGoldenProgrammableMoneyPolicyFoundryProjection();
  const gapKinds = projection.namedGaps.map((gap) => gap.kind).join('\n');

  for (const expected of [
    'allowance-scope-overbroad',
    'account-abstraction-preflight-missing',
    'delegated-eoa-authority-stale',
    'x402-settlement-proof-missing',
    'custody-quorum-pending',
    'intent-route-slippage-review',
    'wallet-memo-instruction-review',
  ]) {
    includes(gapKinds, expected, `P02 named gaps: records ${expected}`);
  }

  equal(projection.namedGaps.length, 7, 'P02 named gaps: exactly seven named gaps are emitted');
  ok(
    projection.namedGaps.every((gap) => gap.reviewOnly === true),
    'P02 named gaps: every gap is review-only',
  );
  equal(
    projection.reviewOnlyCandidate.proposedMode,
    'review',
    'P02 review-only candidate: proposed mode is review',
  );
  equal(
    projection.reviewOnlyCandidate.autoEnforce,
    false,
    'P02 review-only candidate: auto enforcement is false',
  );
  equal(
    projection.reviewOnlyCandidate.activatesEnforcement,
    false,
    'P02 review-only candidate: enforcement activation is false',
  );
  equal(
    projection.backtestMaterial.fixtureDigests.length,
    8,
    'P02 backtest material: fixture digests are retained',
  );
  equal(
    projection.backtestMaterial.eventDigests.length,
    8,
    'P02 backtest material: event digests are retained',
  );
  equal(
    projection.backtestMaterial.decisionCounts.block,
    4,
    'P02 backtest material: block count is retained',
  );
}

function testDataMinimization(): void {
  const projection = createGoldenProgrammableMoneyPolicyFoundryProjection();
  const serialized = JSON.stringify(projection);

  excludes(serialized, /AKIA|ASIA|AIza|sk_live|rk_live|whsec|xox[abprs]-|-----BEGIN [A-Z ]*PRIVATE KEY-----/u, 'P02 projection: no provider or secret token material is serialized');
  excludes(serialized, /"(?:privateKey|seedPhrase|mnemonic|signature|signedTransaction|rawTransaction|accessToken|bearerToken)"\s*:/iu, 'P02 projection: no wallet credential or raw transaction fields are serialized');
  excludes(serialized, /\b(customer|tenant|account)[_-]?[0-9]{3,}\b/iu, 'P02 projection: no raw customer, tenant, or account id is serialized');
  excludes(serialized, /wallet_sendCalls|eth_sendUserOperation|eth_sendRawTransaction|broadcastTransaction|signTransaction|settlePayment|createTransaction|executeTransaction|safeTxHash/iu, 'P02 projection: no executable wallet, bundler, custody, or settlement command is serialized');
}

function testDescriptorDocsAndScriptsStayAligned(): void {
  const descriptor = goldenProgrammableMoneyPolicyFoundryProjectionDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-programmable-money-shadow-pilot.md');
  const demoGuide = readProjectFile('docs', '01-overview', 'demo-guide.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-programmable-money-policy-foundry-projection.v1', 'P02 descriptor: version is explicit');
  equal(descriptor.step, 'P02', 'P02 descriptor: step is explicit');
  equal(descriptor.reviewOnly, true, 'P02 descriptor: review-only is explicit');
  equal(descriptor.autoEnforce, false, 'P02 descriptor: auto enforcement is false');
  equal(descriptor.rawTransactionPayloadStored, false, 'P02 descriptor: raw transaction payload storage is false');
  equal(descriptor.rawWalletMaterialStored, false, 'P02 descriptor: raw wallet material storage is false');
  equal(descriptor.productionReady, false, 'P02 descriptor: production readiness is false');

  for (const expected of [
    'Progress after P04 lands: 4/4 complete. 0 steps remain.',
    '| P02 | complete | Policy Foundry programmable-money projection |',
    'review-only candidate for `programmable_money.transaction_intent`',
    'allowance, paymaster, stale delegation, x402 settlement, custody quorum, intent-route, and wallet-memo gaps',
  ]) {
    includes(doc, expected, `P02 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Programmable Money Golden Path P02',
    'P02 ledger: records the projection step',
  );
  includes(
    readme,
    '[Golden Path: Programmable Money](docs/02-architecture/golden-programmable-money-shadow-pilot.md)',
    'P02 README: links the programmable-money golden path',
  );
  includes(
    demoGuide,
    '`npm run demo:golden-programmable-money`',
    'P02 demo guide: names the programmable-money demo command',
  );
  equal(
    packageJson.scripts['test:golden-programmable-money-policy-foundry-projection'],
    'tsx tests/golden-programmable-money-policy-foundry-projection.test.ts',
    'P02 package script: targeted test is registered',
  );
}

testProjectionShape();
testPolicyTwinSummaryIsReviewOnly();
testNamedGapsAndBacktestMaterial();
testDataMinimization();
testDescriptorDocsAndScriptsStayAligned();

console.log(`golden-programmable-money-policy-foundry-projection: ${passed} assertions passed`);
