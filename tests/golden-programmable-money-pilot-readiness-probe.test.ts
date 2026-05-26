import assert from 'node:assert/strict';
import {
  createGoldenProgrammableMoneyPilotReadinessProbe,
  goldenProgrammableMoneyPilotReadinessProbeDescriptor,
  runGoldenProgrammableMoneyRuntimeSmoke,
  type GoldenProgrammableMoneyRuntimeSmokeResult,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testDescriptor(): void {
  const descriptor = goldenProgrammableMoneyPilotReadinessProbeDescriptor();

  equal(descriptor.version, 'attestor.golden-programmable-money-pilot-readiness-probe.v1', 'P03 probe descriptor: version is explicit');
  equal(descriptor.step, 'P03', 'P03 probe descriptor: step is explicit');
  assert.deepEqual(
    descriptor.allowedVerdicts,
    ['ready-for-shadow-pilot', 'not-ready'],
    'P03 probe descriptor: allowed verdicts exclude scoped pilot',
  );
  passed += 1;
  equal(descriptor.scopedPilotVerdictExcluded, true, 'P03 probe descriptor: scoped pilot verdict is excluded');
  equal(descriptor.shadowOnly, true, 'P03 probe descriptor: shadow-only is true');
  equal(descriptor.fixtureOnly, true, 'P03 probe descriptor: fixture-only is true');
  equal(descriptor.previewOnly, true, 'P03 probe descriptor: preview-only is true');
  equal(descriptor.noTargetSystemCall, true, 'P03 probe descriptor: target calls are forbidden');
  equal(descriptor.noWalletCall, true, 'P03 probe descriptor: wallet calls are forbidden');
  equal(descriptor.noSigning, true, 'P03 probe descriptor: signing is forbidden');
  equal(descriptor.noBroadcast, true, 'P03 probe descriptor: broadcast is forbidden');
  equal(descriptor.noCustodyCallback, true, 'P03 probe descriptor: custody callbacks are forbidden');
  equal(descriptor.noBundlerCall, true, 'P03 probe descriptor: bundler calls are forbidden');
  equal(descriptor.noFacilitatorCall, true, 'P03 probe descriptor: facilitator calls are forbidden');
  equal(descriptor.noSolverCall, true, 'P03 probe descriptor: solver calls are forbidden');
  equal(descriptor.noPolicyActivation, true, 'P03 probe descriptor: policy activation is forbidden');
  equal(descriptor.canAdmit, false, 'P03 probe descriptor: cannot admit');
  equal(descriptor.rawCustomerIdentifiersStored, false, 'P03 probe descriptor: raw customer identifiers are not stored');
  equal(descriptor.productionReady, false, 'P03 probe descriptor: production readiness is false');
}

function testProbeEmitsOnlyShadowPilotVerdict(): void {
  const result = createGoldenProgrammableMoneyPilotReadinessProbe();

  equal(result.version, 'attestor.golden-programmable-money-pilot-readiness-probe.v1', 'P03 probe result: version is explicit');
  equal(result.step, 'P03', 'P03 probe result: step is explicit');
  equal(result.decision.verdict, 'ready-for-shadow-pilot', 'P03 probe result: default fixture smoke is shadow-pilot ready');
  equal(result.decision.blockers.length, 0, 'P03 probe result: default fixture smoke has no blockers');
  equal(result.pilotReadinessPacket.decision.verdict, 'ready-for-shadow-pilot', 'P03 probe result: packet verdict is shadow-pilot ready');
  equal(result.pilotReadinessPacket.stage, 'shadow-entry', 'P03 probe result: packet stage is shadow-entry');
  equal(result.pilotReadinessPacket.rolloutMode, 'shadow-only', 'P03 probe result: rollout mode is shadow-only');
  equal(result.scopedPilotVerdictExcluded, true, 'P03 probe result: scoped pilot verdict is excluded');
  ok(!result.allowedVerdicts.includes('ready-for-scoped-pilot' as never), 'P03 probe result: allowed verdicts omit ready-for-scoped-pilot');
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.digest), 'P03 probe result: digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.pilotReadinessPacketDigest), 'P03 probe result: packet digest is canonical');
}

function testProbePreservesNoClaimBoundary(): void {
  const result = createGoldenProgrammableMoneyPilotReadinessProbe();

  equal(result.shadowOnly, true, 'P03 probe result: shadow-only is true');
  equal(result.fixtureOnly, true, 'P03 probe result: fixture-only is true');
  equal(result.previewOnly, true, 'P03 probe result: preview-only is true');
  equal(result.deterministicReplay, true, 'P03 probe result: deterministic replay is true');
  equal(result.noTargetSystemCall, true, 'P03 probe result: target-system call is forbidden');
  equal(result.noWalletCall, true, 'P03 probe result: wallet call is forbidden');
  equal(result.noSigning, true, 'P03 probe result: signing is forbidden');
  equal(result.noBroadcast, true, 'P03 probe result: broadcast is forbidden');
  equal(result.noCustodyCallback, true, 'P03 probe result: custody callback is forbidden');
  equal(result.noBundlerCall, true, 'P03 probe result: bundler call is forbidden');
  equal(result.noFacilitatorCall, true, 'P03 probe result: facilitator call is forbidden');
  equal(result.noSolverCall, true, 'P03 probe result: solver call is forbidden');
  equal(result.noProviderCall, true, 'P03 probe result: provider call is forbidden');
  equal(result.noAuditWrite, true, 'P03 probe result: audit write is forbidden');
  equal(result.noPolicyActivation, true, 'P03 probe result: policy activation is forbidden');
  equal(result.noLearningActivation, true, 'P03 probe result: learning activation is forbidden');
  equal(result.noTrainingActivation, true, 'P03 probe result: training activation is forbidden');
  equal(result.grantsAuthority, false, 'P03 probe result: grants authority is false');
  equal(result.canAdmit, false, 'P03 probe result: cannot admit');
  equal(result.activatesEnforcement, false, 'P03 probe result: cannot activate enforcement');
  equal(result.autoEnforce, false, 'P03 probe result: auto enforcement is false');
  equal(result.rawPayloadRead, false, 'P03 probe result: raw payload read is false');
  equal(result.rawPayloadStored, false, 'P03 probe result: raw payload stored is false');
  equal(result.rawTransactionPayloadRead, false, 'P03 probe result: raw transaction payload read is false');
  equal(result.rawTransactionPayloadStored, false, 'P03 probe result: raw transaction payload stored is false');
  equal(result.rawWalletMaterialRead, false, 'P03 probe result: raw wallet material read is false');
  equal(result.rawWalletMaterialStored, false, 'P03 probe result: raw wallet material stored is false');
  equal(result.rawCustomerIdentifiersRead, false, 'P03 probe result: raw customer identifiers read is false');
  equal(result.rawCustomerIdentifiersStored, false, 'P03 probe result: raw customer identifiers stored is false');
  equal(result.productionReady, false, 'P03 probe result: production readiness is false');
  equal(result.pilotReadinessPacket.productionReady, false, 'P03 packet: production readiness is false');
  equal(result.pilotReadinessPacket.customerDeploymentProven, false, 'P03 packet: customer deployment proof is false');
  equal(result.pilotReadinessPacket.nativeConnectorCoverage, false, 'P03 packet: native connector coverage is false');
}

function testProbeFailsClosedOnRuntimeSmokeRisk(): void {
  const smoke = runGoldenProgrammableMoneyRuntimeSmoke();
  const tampered = {
    ...smoke,
    allScenariosCompleted: false,
    noTargetSystemCall: false,
    noWalletCall: false,
    noSigning: false,
    noBroadcast: false,
    noCustodyCallback: false,
    noBundlerCall: false,
    noFacilitatorCall: false,
    noSolverCall: false,
  } as unknown as GoldenProgrammableMoneyRuntimeSmokeResult;
  const result = createGoldenProgrammableMoneyPilotReadinessProbe(tampered);

  equal(result.decision.verdict, 'not-ready', 'P03 probe result: tampered smoke is not ready');
  ok(
    result.decision.blockers.includes('golden-programmable-money-runtime-smoke-incomplete'),
    'P03 probe result: incomplete smoke blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('golden-programmable-money-runtime-smoke-target-system-call-risk'),
    'P03 probe result: target call risk blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('golden-programmable-money-runtime-smoke-adapter-side-effect-risk'),
    'P03 probe result: adapter side-effect blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('non-claim-boundary:pilot-non-claims-not-accepted'),
    'P03 probe result: packet non-claim blocker is recorded when source smoke is unsafe',
  );
}

function testDeterminismAndDataMinimization(): void {
  const first = createGoldenProgrammableMoneyPilotReadinessProbe();
  const second = createGoldenProgrammableMoneyPilotReadinessProbe();
  const serialized = JSON.stringify(first);

  equal(first.digest, second.digest, 'P03 probe: full digest is deterministic');
  equal(first.pilotReadinessPacketDigest, second.pilotReadinessPacketDigest, 'P03 probe: packet digest is deterministic');
  excludes(serialized, /AKIA|ASIA|AIza|sk_live|rk_live|whsec|xox[abprs]-|-----BEGIN [A-Z ]*PRIVATE KEY-----/u, 'P03 probe: no provider or secret token material is serialized');
  excludes(serialized, /"(?:privateKey|seedPhrase|mnemonic|signedTransaction|rawTransaction|accessToken|bearerToken)"\s*:/iu, 'P03 probe: no wallet credential or raw transaction fields are serialized');
  excludes(serialized, /\b(customer|tenant|account)[_-]?[0-9]{3,}\b/iu, 'P03 probe: no raw customer, tenant, or account id is serialized');
  excludes(serialized, /wallet_sendCalls|eth_sendUserOperation|eth_sendRawTransaction|broadcastTransaction|signTransaction|settlePayment|createTransaction|executeTransaction|safeTxHash/iu, 'P03 probe: no executable wallet, bundler, custody, facilitator, solver, or settlement command is serialized');
}

testDescriptor();
testProbeEmitsOnlyShadowPilotVerdict();
testProbePreservesNoClaimBoundary();
testProbeFailsClosedOnRuntimeSmokeRisk();
testDeterminismAndDataMinimization();

console.log(`golden-programmable-money-pilot-readiness-probe: ${passed} assertions passed`);
