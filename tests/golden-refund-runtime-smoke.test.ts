import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  goldenRefundRuntimeSmokeDescriptor,
  runGoldenRefundRuntimeSmoke,
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
  const descriptor = goldenRefundRuntimeSmokeDescriptor();

  equal(descriptor.version, 'attestor.golden-refund-runtime-smoke.v1', 'G05 descriptor: version is explicit');
  equal(descriptor.step, 'G05', 'G05 descriptor: step is explicit');
  equal(descriptor.scenarioCount, 5, 'G05 descriptor: scenario count is fixed');
  equal(descriptor.runsG03FixturesThroughR02ToR07, true, 'G05 descriptor: runs G03 through R02-R07');
  equal(descriptor.executionMode, 'shadow-only', 'G05 descriptor: execution mode is shadow-only');
  equal(descriptor.fixtureOnly, true, 'G05 descriptor: fixture-only is true');
  equal(descriptor.deterministicReplay, true, 'G05 descriptor: deterministic replay is true');
  equal(descriptor.noTargetSystemCall, true, 'G05 descriptor: target-system calls are forbidden');
  equal(descriptor.noAuditWrite, true, 'G05 descriptor: audit writes are forbidden');
  equal(descriptor.noPolicyActivation, true, 'G05 descriptor: policy activation is forbidden');
  equal(descriptor.noLearningActivation, true, 'G05 descriptor: learning activation is forbidden');
  equal(descriptor.canAdmit, false, 'G05 descriptor: cannot admit');
  equal(descriptor.productionReady, false, 'G05 descriptor: production readiness is false');
}

function testRuntimeSmokeRunsAllScenarios(): void {
  const result = runGoldenRefundRuntimeSmoke();
  const scenarios = result.scenarioResults.map((item) => item.scenario).sort();

  equal(result.version, 'attestor.golden-refund-runtime-smoke.v1', 'G05 result: version is explicit');
  equal(result.step, 'G05', 'G05 result: step is explicit');
  equal(result.scenarioCount, 5, 'G05 result: scenario count is fixed');
  equal(result.smokeResults.length, 5, 'G05 result: five smoke results are emitted');
  equal(result.phaseDigests.length, 5, 'G05 result: one phase digest per scenario is retained');
  equal(result.allScenariosCompleted, true, 'G05 result: all scenarios completed');
  equal(result.executionMode, 'shadow-only', 'G05 result: execution mode is shadow-only');
  equal(result.fixtureOnly, true, 'G05 result: fixture-only is true');
  equal(result.deterministicReplay, true, 'G05 result: deterministic replay is true');
  equal(result.noTargetSystemCall, true, 'G05 result: target-system calls are forbidden');
  equal(result.noAuditWrite, true, 'G05 result: audit writes are forbidden');
  equal(result.noExternalEventBus, true, 'G05 result: external event bus is forbidden');
  equal(result.noExternalTraceExport, true, 'G05 result: external trace export is forbidden');
  equal(result.noExternalLineageExport, true, 'G05 result: external lineage export is forbidden');
  equal(result.noPolicyActivation, true, 'G05 result: policy activation is forbidden');
  equal(result.noLearningActivation, true, 'G05 result: learning activation is forbidden');
  equal(result.noTrainingActivation, true, 'G05 result: training activation is forbidden');
  equal(result.grantsAuthority, false, 'G05 result: grants authority is false');
  equal(result.canAdmit, false, 'G05 result: cannot admit');
  equal(result.activatesEnforcement, false, 'G05 result: cannot activate enforcement');
  equal(result.autoEnforce, false, 'G05 result: auto enforcement is false');
  equal(result.rawPayloadRead, false, 'G05 result: raw payload read is false');
  equal(result.rawPayloadStored, false, 'G05 result: raw payload stored is false');
  equal(result.productionReady, false, 'G05 result: production readiness is false');
  assert.deepEqual(
    scenarios,
    ['approval-required', 'missing-evidence', 'normal', 'repeated-refund', 'stale-evidence'],
    'G05 result: all G03 scenarios are represented',
  );
  passed += 1;
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.digest), 'G05 result: digest is canonical');
}

function testEachScenarioBindsRuntimeArtifacts(): void {
  const result = runGoldenRefundRuntimeSmoke();

  for (const scenario of result.scenarioResults) {
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.fixtureDigest), `G05 ${scenario.scenario}: fixture digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.sourceEventDigest), `G05 ${scenario.scenario}: source event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.smokeDigest), `G05 ${scenario.scenario}: smoke digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.envelopeRefDigest), `G05 ${scenario.scenario}: envelope digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.assurancePacketDigest), `G05 ${scenario.scenario}: assurance packet digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalAssuranceCaseDigest), `G05 ${scenario.scenario}: assurance case digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalLineageGraphDigest), `G05 ${scenario.scenario}: lineage digest is canonical`);
    equal(scenario.noTargetSystemCall, true, `G05 ${scenario.scenario}: no target-system call`);
    equal(scenario.noAuditWrite, true, `G05 ${scenario.scenario}: no audit write`);
    equal(scenario.noPolicyActivation, true, `G05 ${scenario.scenario}: no policy activation`);
    equal(scenario.noLearningActivation, true, `G05 ${scenario.scenario}: no learning activation`);
    equal(scenario.canAdmit, false, `G05 ${scenario.scenario}: cannot admit`);
    equal(scenario.productionReady, false, `G05 ${scenario.scenario}: production readiness is false`);
  }
}

function testDeterminismAndDataMinimization(): void {
  const first = runGoldenRefundRuntimeSmoke();
  const second = runGoldenRefundRuntimeSmoke();
  const serialized = JSON.stringify(first);

  equal(first.digest, second.digest, 'G05 smoke: full digest is deterministic');
  equal(first.phaseDigests.join('\n'), second.phaseDigests.join('\n'), 'G05 smoke: phase digests are deterministic');
  excludes(serialized, /\bcus_[a-zA-Z0-9_]+/u, 'G05 smoke: no raw customer id is serialized');
  excludes(serialized, /\bpi_[a-zA-Z0-9_]+/u, 'G05 smoke: no raw payment intent id is serialized');
  excludes(serialized, /\bch_[a-zA-Z0-9_]+/u, 'G05 smoke: no raw charge id is serialized');
  excludes(serialized, /\border_[a-zA-Z0-9_]+/u, 'G05 smoke: no raw order id is serialized');
  excludes(serialized, /cardNumber|customerName|customerEmail|paymentIntentId|stripeChargeId|shopifyOrderId/iu, 'G05 smoke: no raw commerce identifiers are serialized');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-refund-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: G05 runtime smoke',
    'Progress after G05 lands: 5/7 complete. 2 steps remain.',
    '| G05 | complete | Runtime smoke |',
    'R02-R07 shadow runtime smoke chain',
    'without target-system calls',
  ]) {
    includes(doc, expected, `G05 doc: records ${expected}`);
  }

  includes(
    ledger,
    'G05 runtime smoke',
    'G05 ledger: records runtime smoke',
  );
  equal(
    packageJson.scripts['test:golden-refund-runtime-smoke'],
    'tsx tests/golden-refund-runtime-smoke.test.ts',
    'G05 package script: targeted test is registered',
  );
}

testDescriptor();
testRuntimeSmokeRunsAllScenarios();
testEachScenarioBindsRuntimeArtifacts();
testDeterminismAndDataMinimization();
testDocsAndScriptsStayAligned();

console.log(`golden-refund-runtime-smoke: ${passed} assertions passed`);
