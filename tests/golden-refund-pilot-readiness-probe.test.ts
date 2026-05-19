import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenRefundPilotReadinessProbe,
  goldenRefundPilotReadinessProbeDescriptor,
  runGoldenRefundRuntimeSmoke,
  type GoldenRefundRuntimeSmokeResult,
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
  const descriptor = goldenRefundPilotReadinessProbeDescriptor();

  equal(descriptor.version, 'attestor.golden-refund-pilot-readiness-probe.v1', 'G06 descriptor: version is explicit');
  equal(descriptor.step, 'G06', 'G06 descriptor: step is explicit');
  assert.deepEqual(
    descriptor.allowedVerdicts,
    ['ready-for-shadow-pilot', 'not-ready'],
    'G06 descriptor: allowed verdicts exclude scoped pilot',
  );
  passed += 1;
  equal(descriptor.scopedPilotVerdictExcluded, true, 'G06 descriptor: scoped pilot verdict is excluded');
  equal(descriptor.shadowOnly, true, 'G06 descriptor: shadow-only is true');
  equal(descriptor.fixtureOnly, true, 'G06 descriptor: fixture-only is true');
  equal(descriptor.previewOnly, true, 'G06 descriptor: preview-only is true');
  equal(descriptor.noTargetSystemCall, true, 'G06 descriptor: target calls are forbidden');
  equal(descriptor.noAuditWrite, true, 'G06 descriptor: audit writes are forbidden');
  equal(descriptor.noPolicyActivation, true, 'G06 descriptor: policy activation is forbidden');
  equal(descriptor.noLearningActivation, true, 'G06 descriptor: learning activation is forbidden');
  equal(descriptor.canAdmit, false, 'G06 descriptor: cannot admit');
  equal(descriptor.productionReady, false, 'G06 descriptor: production readiness is false');
}

function testProbeEmitsOnlyShadowPilotVerdict(): void {
  const result = createGoldenRefundPilotReadinessProbe();

  equal(result.version, 'attestor.golden-refund-pilot-readiness-probe.v1', 'G06 result: version is explicit');
  equal(result.step, 'G06', 'G06 result: step is explicit');
  equal(result.decision.verdict, 'ready-for-shadow-pilot', 'G06 result: default fixture smoke is shadow-pilot ready');
  equal(result.decision.blockers.length, 0, 'G06 result: default fixture smoke has no blockers');
  equal(result.pilotReadinessPacket.decision.verdict, 'ready-for-shadow-pilot', 'G06 result: packet verdict is shadow-pilot ready');
  equal(result.pilotReadinessPacket.stage, 'shadow-entry', 'G06 result: packet stage is shadow-entry');
  equal(result.pilotReadinessPacket.rolloutMode, 'shadow-only', 'G06 result: rollout mode is shadow-only');
  equal(result.scopedPilotVerdictExcluded, true, 'G06 result: scoped pilot verdict is excluded');
  ok(!result.allowedVerdicts.includes('ready-for-scoped-pilot' as never), 'G06 result: allowed verdicts omit ready-for-scoped-pilot');
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.digest), 'G06 result: digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.pilotReadinessPacketDigest), 'G06 result: packet digest is canonical');
}

function testProbePreservesNoClaimBoundary(): void {
  const result = createGoldenRefundPilotReadinessProbe();

  equal(result.shadowOnly, true, 'G06 result: shadow-only is true');
  equal(result.fixtureOnly, true, 'G06 result: fixture-only is true');
  equal(result.previewOnly, true, 'G06 result: preview-only is true');
  equal(result.deterministicReplay, true, 'G06 result: deterministic replay is true');
  equal(result.noTargetSystemCall, true, 'G06 result: target-system call is forbidden');
  equal(result.noAuditWrite, true, 'G06 result: audit write is forbidden');
  equal(result.noExternalEventBus, true, 'G06 result: external event bus is forbidden');
  equal(result.noExternalTraceExport, true, 'G06 result: external trace export is forbidden');
  equal(result.noExternalLineageExport, true, 'G06 result: external lineage export is forbidden');
  equal(result.noPolicyActivation, true, 'G06 result: policy activation is forbidden');
  equal(result.noLearningActivation, true, 'G06 result: learning activation is forbidden');
  equal(result.noTrainingActivation, true, 'G06 result: training activation is forbidden');
  equal(result.grantsAuthority, false, 'G06 result: grants authority is false');
  equal(result.canAdmit, false, 'G06 result: cannot admit');
  equal(result.activatesEnforcement, false, 'G06 result: cannot activate enforcement');
  equal(result.autoEnforce, false, 'G06 result: auto enforcement is false');
  equal(result.rawPayloadRead, false, 'G06 result: raw payload read is false');
  equal(result.rawPayloadStored, false, 'G06 result: raw payload stored is false');
  equal(result.productionReady, false, 'G06 result: production readiness is false');
  equal(result.pilotReadinessPacket.productionReady, false, 'G06 packet: production readiness is false');
  equal(result.pilotReadinessPacket.customerDeploymentProven, false, 'G06 packet: customer deployment proof is false');
  equal(result.pilotReadinessPacket.nativeConnectorCoverage, false, 'G06 packet: native connector coverage is false');
}

function testProbeFailsClosedOnRuntimeSmokeRisk(): void {
  const smoke = runGoldenRefundRuntimeSmoke();
  const tampered = {
    ...smoke,
    allScenariosCompleted: false,
    noTargetSystemCall: false,
  } as unknown as GoldenRefundRuntimeSmokeResult;
  const result = createGoldenRefundPilotReadinessProbe(tampered);

  equal(result.decision.verdict, 'not-ready', 'G06 result: tampered smoke is not ready');
  ok(
    result.decision.blockers.includes('golden-refund-runtime-smoke-incomplete'),
    'G06 result: incomplete smoke blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('golden-refund-runtime-smoke-target-system-call-risk'),
    'G06 result: target call risk blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('non-claim-boundary:pilot-non-claims-not-accepted'),
    'G06 result: packet non-claim blocker is recorded when source smoke is unsafe',
  );
}

function testDeterminismAndDataMinimization(): void {
  const first = createGoldenRefundPilotReadinessProbe();
  const second = createGoldenRefundPilotReadinessProbe();
  const serialized = JSON.stringify(first);

  equal(first.digest, second.digest, 'G06 probe: full digest is deterministic');
  equal(first.pilotReadinessPacketDigest, second.pilotReadinessPacketDigest, 'G06 probe: packet digest is deterministic');
  excludes(serialized, /\bcus_[a-zA-Z0-9_]+/u, 'G06 probe: no raw customer id is serialized');
  excludes(serialized, /\bpi_[a-zA-Z0-9_]+/u, 'G06 probe: no raw payment intent id is serialized');
  excludes(serialized, /\bch_[a-zA-Z0-9_]+/u, 'G06 probe: no raw charge id is serialized');
  excludes(serialized, /\border_[a-zA-Z0-9_]+/u, 'G06 probe: no raw order id is serialized');
  excludes(serialized, /cardNumber|customerName|customerEmail|paymentIntentId|stripeChargeId|shopifyOrderId/iu, 'G06 probe: no raw commerce identifiers are serialized');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-refund-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: G06 pilot readiness probe',
    'Progress after G06 lands: 6/7 complete. 1 step remains.',
    '| G06 | complete | Pilot readiness probe |',
    'ready-for-shadow-pilot',
    'not-ready',
    'ready-for-scoped-pilot` is outside the G-series',
  ]) {
    includes(doc, expected, `G06 doc: records ${expected}`);
  }

  includes(
    ledger,
    'G06 pilot readiness probe',
    'G06 ledger: records pilot readiness probe',
  );
  equal(
    packageJson.scripts['test:golden-refund-pilot-readiness-probe'],
    'tsx tests/golden-refund-pilot-readiness-probe.test.ts',
    'G06 package script: targeted test is registered',
  );
}

testDescriptor();
testProbeEmitsOnlyShadowPilotVerdict();
testProbePreservesNoClaimBoundary();
testProbeFailsClosedOnRuntimeSmokeRisk();
testDeterminismAndDataMinimization();
testDocsAndScriptsStayAligned();

console.log(`golden-refund-pilot-readiness-probe: ${passed} assertions passed`);
