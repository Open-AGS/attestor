import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  goldenDataExportRuntimeSmokeDescriptor,
  runGoldenDataExportRuntimeSmoke,
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
  const descriptor = goldenDataExportRuntimeSmokeDescriptor();

  equal(descriptor.version, 'attestor.golden-data-export-runtime-smoke.v1', 'D03 runtime descriptor: version is explicit');
  equal(descriptor.step, 'D03', 'D03 runtime descriptor: step is explicit');
  equal(descriptor.scenarioCount, 8, 'D03 runtime descriptor: scenario count is fixed');
  equal(descriptor.runsD01FixturesThroughR02ToR07, true, 'D03 runtime descriptor: runs D01 through R02-R07');
  equal(descriptor.executionMode, 'shadow-only', 'D03 runtime descriptor: execution mode is shadow-only');
  equal(descriptor.fixtureOnly, true, 'D03 runtime descriptor: fixture-only is true');
  equal(descriptor.deterministicReplay, true, 'D03 runtime descriptor: deterministic replay is true');
  equal(descriptor.noTargetSystemCall, true, 'D03 runtime descriptor: target-system calls are forbidden');
  equal(descriptor.noAuditWrite, true, 'D03 runtime descriptor: audit writes are forbidden');
  equal(descriptor.noPolicyActivation, true, 'D03 runtime descriptor: policy activation is forbidden');
  equal(descriptor.noLearningActivation, true, 'D03 runtime descriptor: learning activation is forbidden');
  equal(descriptor.canAdmit, false, 'D03 runtime descriptor: cannot admit');
  equal(descriptor.productionReady, false, 'D03 runtime descriptor: production readiness is false');
}

function testRuntimeSmokeRunsAllScenarios(): void {
  const result = runGoldenDataExportRuntimeSmoke();
  const scenarios = result.scenarioResults.map((item) => item.scenario).sort();

  equal(result.version, 'attestor.golden-data-export-runtime-smoke.v1', 'D03 runtime result: version is explicit');
  equal(result.step, 'D03', 'D03 runtime result: step is explicit');
  equal(result.scenarioCount, 8, 'D03 runtime result: scenario count is fixed');
  equal(result.smokeResults.length, 8, 'D03 runtime result: eight smoke results are emitted');
  equal(result.phaseDigests.length, 8, 'D03 runtime result: one phase digest per scenario is retained');
  equal(result.allScenariosCompleted, true, 'D03 runtime result: all scenarios completed');
  equal(result.executionMode, 'shadow-only', 'D03 runtime result: execution mode is shadow-only');
  equal(result.fixtureOnly, true, 'D03 runtime result: fixture-only is true');
  equal(result.deterministicReplay, true, 'D03 runtime result: deterministic replay is true');
  equal(result.noTargetSystemCall, true, 'D03 runtime result: target-system calls are forbidden');
  equal(result.noAuditWrite, true, 'D03 runtime result: audit writes are forbidden');
  equal(result.noExternalEventBus, true, 'D03 runtime result: external event bus is forbidden');
  equal(result.noExternalTraceExport, true, 'D03 runtime result: external trace export is forbidden');
  equal(result.noExternalLineageExport, true, 'D03 runtime result: external lineage export is forbidden');
  equal(result.noPolicyActivation, true, 'D03 runtime result: policy activation is forbidden');
  equal(result.noLearningActivation, true, 'D03 runtime result: learning activation is forbidden');
  equal(result.noTrainingActivation, true, 'D03 runtime result: training activation is forbidden');
  equal(result.grantsAuthority, false, 'D03 runtime result: grants authority is false');
  equal(result.canAdmit, false, 'D03 runtime result: cannot admit');
  equal(result.activatesEnforcement, false, 'D03 runtime result: cannot activate enforcement');
  equal(result.autoEnforce, false, 'D03 runtime result: auto enforcement is false');
  equal(result.rawPayloadRead, false, 'D03 runtime result: raw payload read is false');
  equal(result.rawPayloadStored, false, 'D03 runtime result: raw payload stored is false');
  equal(result.productionReady, false, 'D03 runtime result: production readiness is false');
  assert.deepEqual(
    scenarios,
    [
      'aggregate-report-release',
      'customer-export-approved',
      'external-recipient-review',
      'pii-column-narrowing',
      'prompt-injection-in-evidence',
      'stale-approval',
      'tenant-scope-mismatch',
      'write-query-blocked',
    ],
    'D03 runtime result: all D01 scenarios are represented',
  );
  passed += 1;
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.digest), 'D03 runtime result: digest is canonical');
}

function testEachScenarioBindsRuntimeArtifacts(): void {
  const result = runGoldenDataExportRuntimeSmoke();

  for (const scenario of result.scenarioResults) {
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.fixtureDigest), `D03 ${scenario.scenario}: fixture digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.sourceEventDigest), `D03 ${scenario.scenario}: source event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.smokeDigest), `D03 ${scenario.scenario}: smoke digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.envelopeRefDigest), `D03 ${scenario.scenario}: envelope digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.assurancePacketDigest), `D03 ${scenario.scenario}: assurance packet digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalAssuranceCaseDigest), `D03 ${scenario.scenario}: assurance case digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalLineageGraphDigest), `D03 ${scenario.scenario}: lineage digest is canonical`);
    equal(scenario.noTargetSystemCall, true, `D03 ${scenario.scenario}: no target-system call`);
    equal(scenario.noAuditWrite, true, `D03 ${scenario.scenario}: no audit write`);
    equal(scenario.noPolicyActivation, true, `D03 ${scenario.scenario}: no policy activation`);
    equal(scenario.noLearningActivation, true, `D03 ${scenario.scenario}: no learning activation`);
    equal(scenario.canAdmit, false, `D03 ${scenario.scenario}: cannot admit`);
    equal(scenario.productionReady, false, `D03 ${scenario.scenario}: production readiness is false`);
  }
}

function testDeterminismAndDataMinimization(): void {
  const first = runGoldenDataExportRuntimeSmoke();
  const second = runGoldenDataExportRuntimeSmoke();
  const serialized = JSON.stringify(first);

  equal(first.digest, second.digest, 'D03 runtime smoke: full digest is deterministic');
  equal(first.phaseDigests.join('\n'), second.phaseDigests.join('\n'), 'D03 runtime smoke: phase digests are deterministic');
  excludes(serialized, /\bSELECT\s+.+\bFROM\b|\bUPDATE\s+\S+\s+SET\b|\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|\bMERGE\s+INTO\b/iu, 'D03 runtime smoke: no raw SQL statement is serialized');
  excludes(serialized, /\b(email|customerEmail|customerName|accountNumber|ssn|phoneNumber)\b/iu, 'D03 runtime smoke: no raw customer fields are serialized');
  excludes(serialized, /\bcus_[a-zA-Z0-9_]+|\btenant_[a-zA-Z0-9_]+|\buser_[a-zA-Z0-9_]+/u, 'D03 runtime smoke: no raw customer, tenant, or user identifiers are serialized');
  excludes(serialized, /"rowPayload"\s*:|"rawRows"\s*:|"providerBody"\s*:|"warehouseStatement"\s*:/iu, 'D03 runtime smoke: no raw data export material fields are serialized');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-data-export-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: D03 complete. D01-D03 are repository-side only.',
    'Progress after D03 lands: 3/4 complete. 1 step remains.',
    '| D03 | complete | Runtime smoke and pilot readiness |',
    'R02-R07 shadow runtime smoke chain',
    'ready-for-shadow-pilot',
  ]) {
    includes(doc, expected, `D03 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Controlled Data Export Golden Path D03',
    'D03 ledger: records runtime smoke and pilot readiness',
  );
  equal(
    packageJson.scripts['test:golden-data-export-runtime-smoke'],
    'tsx tests/golden-data-export-runtime-smoke.test.ts',
    'D03 runtime package script: targeted test is registered',
  );
}

testDescriptor();
testRuntimeSmokeRunsAllScenarios();
testEachScenarioBindsRuntimeArtifacts();
testDeterminismAndDataMinimization();
testDocsAndScriptsStayAligned();

console.log(`golden-data-export-runtime-smoke: ${passed} assertions passed`);
