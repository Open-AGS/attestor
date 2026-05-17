import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGeneralCryptoTransactionGateResult,
  generalCryptoTransactionGateDescriptor,
  GENERAL_CRYPTO_TRANSACTION_ACTIONS,
  type GeneralCryptoTransactionGateInput,
} from '../src/consequence-admission/index.js';

let passed = 0;

function digest(label: string): string {
  return `sha256:${createHash('sha256').update(label).digest('hex')}`;
}

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

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function baseInput(
  overrides: Partial<GeneralCryptoTransactionGateInput> = {},
): GeneralCryptoTransactionGateInput {
  return {
    generatedAt: '2026-05-17T12:00:00.000Z',
    tenantRefDigest: digest('tenant'),
    actorRefDigest: digest('actor'),
    walletAccountRefDigest: digest('wallet-account'),
    actionRequestDigest: digest('action-request'),
    policyCandidateDigest: digest('policy-candidate'),
    approvalRefDigest: digest('approval'),
    executionPlanDigest: digest('crypto-execution-plan'),
    simulationDigest: digest('simulation'),
    receiptRefDigest: digest('receipt-target'),
    assetRefDigest: digest('asset'),
    targetContractRefDigest: digest('token-contract'),
    counterpartyRefDigest: digest('counterparty'),
    amountRefDigest: digest('amount'),
    callDataDigest: digest('calldata'),
    typedDataDigest: digest('typed-data'),
    routeRefDigest: digest('route'),
    chainId: 'eip155:1',
    chainPolicyStatus: 'matched',
    action: 'native.transfer',
    simulationStatus: 'passed',
    allowancePosture: 'not-applicable',
    counterpartyTrust: 'known',
    permitDomainStatus: 'not-applicable',
    routeStatus: 'not-applicable',
    safeStatus: 'not-applicable',
    userOperationStatus: 'not-applicable',
    sessionKeyScope: 'not-applicable',
    delegationPosture: 'not-applicable',
    x402Status: 'not-applicable',
    ...overrides,
  };
}

function reasonCodes(input: GeneralCryptoTransactionGateInput): readonly string[] {
  return createGeneralCryptoTransactionGateResult(input).reasonCodes;
}

function testNativeTransferCanAdmitOnlyWhenBound(): void {
  const result = createGeneralCryptoTransactionGateResult(baseInput());

  equal(
    result.version,
    'attestor.general-crypto-transaction-gate.v1',
    'General crypto gate: version is explicit',
  );
  equal(result.decision, 'admit', 'General crypto gate: fully bound native transfer admits');
  equal(result.allowed, true, 'General crypto gate: admit sets allowed');
  equal(result.failClosed, false, 'General crypto gate: admit does not hold');
  equal(result.customerGateAction, 'proceed', 'General crypto gate: customer gate may proceed');
  equal(result.riskClass, 'R2', 'General crypto gate: native transfer is R2');
  ok(result.digest.startsWith('sha256:'), 'General crypto gate: result digest is generated');
  equal(result.signsTransaction, false, 'General crypto gate: does not sign transactions');
  equal(result.broadcastsTransaction, false, 'General crypto gate: does not broadcast transactions');
  equal(result.custodyWallet, false, 'General crypto gate: does not claim custody');
  equal(result.chainAnalyticsProvider, false, 'General crypto gate: does not claim chain analytics');
  equal(result.rawPayloadStored, false, 'General crypto gate: stores no raw payload');
  equal(result.productionReady, false, 'General crypto gate: does not claim production readiness');
}

function testApproveAndPermitAbuseFailClosed(): void {
  const approval = createGeneralCryptoTransactionGateResult(baseInput({
    action: 'erc20.approve',
    allowancePosture: 'unlimited',
    counterpartyTrust: 'unknown',
  }));

  equal(approval.decision, 'block', 'General crypto gate: unlimited unknown approval blocks');
  equal(approval.allowed, false, 'General crypto gate: blocked approval is not allowed');
  equal(approval.failClosed, true, 'General crypto gate: blocked approval fails closed');
  ok(approval.reasonCodes.includes('unlimited-approval'), 'General crypto gate: unlimited approval reason is explicit');
  ok(approval.reasonCodes.includes('spender-unknown'), 'General crypto gate: unknown spender reason is explicit');

  const permit = createGeneralCryptoTransactionGateResult(baseInput({
    action: 'permit.sign',
    allowancePosture: 'bounded',
    permitDomainStatus: 'mismatch',
  }));

  equal(permit.decision, 'block', 'General crypto gate: permit domain mismatch blocks');
  ok(permit.reasonCodes.includes('permit-domain-mismatch'), 'General crypto gate: permit mismatch is explicit');
  ok(permit.standards.includes('EIP-712'), 'General crypto gate: permit records EIP-712');
  ok(permit.standards.includes('EIP-2612'), 'General crypto gate: permit records EIP-2612');
}

function testRouteSafeUserOpAndSessionSignals(): void {
  const swap = createGeneralCryptoTransactionGateResult(baseInput({
    action: 'swap.execute',
    routeStatus: 'destination-risk-unknown',
  }));

  equal(swap.decision, 'review', 'General crypto gate: uncertain swap destination goes to review');
  ok(
    swap.reasonCodes.includes('destination-risk-unknown'),
    'General crypto gate: destination risk reason is explicit',
  );

  const safe = createGeneralCryptoTransactionGateResult(baseInput({
    action: 'safe.tx.propose',
    safeStatus: 'quorum-missing',
  }));

  equal(safe.decision, 'review', 'General crypto gate: Safe quorum gap goes to review');
  ok(safe.reasonCodes.includes('quorum-missing'), 'General crypto gate: Safe quorum reason is explicit');

  const userOp = createGeneralCryptoTransactionGateResult(baseInput({
    action: 'userop.submit',
    simulationStatus: 'failed',
    userOperationStatus: 'validation-failed',
  }));

  equal(userOp.decision, 'block', 'General crypto gate: failed UserOperation validation blocks');
  ok(userOp.reasonCodes.includes('validation-failed'), 'General crypto gate: UserOperation validation reason is explicit');
  ok(userOp.standards.includes('ERC-4337'), 'General crypto gate: UserOperation records ERC-4337');
  ok(userOp.standards.includes('ERC-7562'), 'General crypto gate: UserOperation records ERC-7562');

  const sessionKey = createGeneralCryptoTransactionGateResult(baseInput({
    action: 'session_key.grant',
    sessionKeyScope: 'overbroad',
  }));

  equal(sessionKey.decision, 'block', 'General crypto gate: overbroad session key blocks');
  ok(sessionKey.reasonCodes.includes('session-key-overbroad'), 'General crypto gate: session key reason is explicit');
  ok(sessionKey.standards.includes('ERC-7715'), 'General crypto gate: session key records ERC-7715');

  const delegation = createGeneralCryptoTransactionGateResult(baseInput({
    action: 'delegation.authorize',
    delegationPosture: 'overbroad',
  }));

  equal(delegation.decision, 'block', 'General crypto gate: overbroad delegation blocks');
  ok(delegation.reasonCodes.includes('delegation-overbroad'), 'General crypto gate: delegation reason is explicit');
  ok(delegation.standards.includes('EIP-7702'), 'General crypto gate: delegation records EIP-7702');
}

function testX402UsesVerifyAndSettleEvidence(): void {
  const result = createGeneralCryptoTransactionGateResult(baseInput({
    action: 'x402.pay',
    simulationStatus: 'not-required',
    simulationDigest: null,
    x402Status: 'verified-and-settled',
    assetRefDigest: null,
    targetContractRefDigest: null,
    counterpartyRefDigest: null,
    amountRefDigest: null,
    callDataDigest: null,
    typedDataDigest: null,
    routeRefDigest: null,
  }));

  equal(result.decision, 'admit', 'General crypto gate: x402 verified and settled payment admits');
  ok(result.standards.includes('x402'), 'General crypto gate: x402 standard is recorded');
  ok(
    result.checks.some((item) => item.reasonCode === 'x402-verified-and-settled'),
    'General crypto gate: x402 verify/settle evidence is explicit',
  );

  const missingSettle = createGeneralCryptoTransactionGateResult(baseInput({
    action: 'x402.pay',
    simulationStatus: 'not-required',
    simulationDigest: null,
    x402Status: 'settle-missing',
    assetRefDigest: null,
    targetContractRefDigest: null,
    counterpartyRefDigest: null,
    amountRefDigest: null,
    callDataDigest: null,
    typedDataDigest: null,
    routeRefDigest: null,
  }));

  equal(missingSettle.decision, 'review', 'General crypto gate: missing x402 settle evidence reviews');
  ok(missingSettle.reasonCodes.includes('settle-missing'), 'General crypto gate: settle-missing reason is explicit');
}

function testDescriptorValidationDocsAndTrackersStayAligned(): void {
  const descriptor = generalCryptoTransactionGateDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'general-crypto-transaction-gate.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const tracker = readProjectFile('docs', '02-architecture', 'attestor-unlock-source-of-truth.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.signsTransaction, false, 'General crypto descriptor: signing is false');
  equal(descriptor.broadcastsTransaction, false, 'General crypto descriptor: broadcasting is false');
  equal(descriptor.custodyWallet, false, 'General crypto descriptor: custody is false');
  equal(descriptor.autoEnforce, false, 'General crypto descriptor: autoEnforce is false');
  equal(descriptor.productionReady, false, 'General crypto descriptor: productionReady is false');
  for (const action of GENERAL_CRYPTO_TRANSACTION_ACTIONS) {
    ok(descriptor.actions.includes(action), `General crypto descriptor: ${action} is included`);
  }

  for (const expected of [
    '# General Crypto Transaction Gate',
    'attestor.general-crypto-transaction-gate.v1',
    '`native.transfer`',
    '`erc20.approve`',
    '`permit.sign`',
    '`swap.execute`',
    '`bridge.transfer`',
    '`safe.tx.propose`',
    '`userop.submit`',
    '`session_key.grant`',
    '`delegation.authorize`',
    '`x402.pay`',
    'unlimited approval',
    'permit-domain-mismatch',
    'wrong-chain',
    'signsTransaction = false',
    'broadcastsTransaction = false',
    'custodyWallet = false',
    'chainAnalyticsProvider = false',
    'productionReady = false',
  ]) {
    includes(doc, expected, `General crypto doc: records ${expected}`);
  }

  for (const expected of [
    '| Complete | 24 |',
    '| Remaining | 2 |',
    '| 24 | complete | General Crypto Transaction Gate |',
    '| 25 | planned | Spend, procurement, data, IAM, health, and insurance recipes |',
    'completion of steps 25-26',
  ]) {
    includes(masterPlan, expected, `General crypto master plan: records ${expected}`);
  }

  includes(
    tracker,
    'records the General Crypto Transaction Gate',
    'General crypto gate: unlock tracker points to Step 24 completion',
  );
  includes(
    systemOverview,
    '[General Crypto Transaction Gate](general-crypto-transaction-gate.md)',
    'General crypto gate: system overview links doc',
  );
  includes(
    readme,
    '[General Crypto Transaction Gate](docs/02-architecture/general-crypto-transaction-gate.md)',
    'General crypto gate: README links doc',
  );
  includes(
    ledger,
    '### 66. General Crypto Transaction Gate',
    'General crypto gate: research ledger entry is present',
  );
  equal(
    packageJson.scripts['test:general-crypto-transaction-gate'],
    'tsx tests/general-crypto-transaction-gate.test.ts',
    'General crypto gate: package script is registered',
  );
  excludes(
    doc,
    /\bprivate key\b|\bseed phrase\b|\braw calldata\b|\btransaction broadcaster\b|\bcustody provider\b/iu,
    'General crypto doc: does not expose wallet material or overclaim execution roles',
  );
}

function testInvalidDigestFailsBeforeDecision(): void {
  assert.throws(
    () => createGeneralCryptoTransactionGateResult(baseInput({
      tenantRefDigest: 'tenant:raw',
    })),
    /tenantRefDigest must be a sha256 digest/u,
    'General crypto gate: invalid tenant digest throws',
  );
  passed += 1;

  ok(
    reasonCodes(baseInput({ chainPolicyStatus: 'mismatch' })).includes('wrong-chain'),
    'General crypto gate: wrong chain reason is explicit',
  );
}

testNativeTransferCanAdmitOnlyWhenBound();
testApproveAndPermitAbuseFailClosed();
testRouteSafeUserOpAndSessionSignals();
testX402UsesVerifyAndSettleEvidence();
testDescriptorValidationDocsAndTrackersStayAligned();
testInvalidDigestFailsBeforeDecision();

console.log(`General crypto transaction gate tests: ${passed} passed, 0 failed`);
