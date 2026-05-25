import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  goldenAuthorityChangeRuntimeSmokeDescriptor,
  runGoldenAuthorityChangeRuntimeSmoke,
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
  const descriptor = goldenAuthorityChangeRuntimeSmokeDescriptor();

  equal(descriptor.version, 'attestor.golden-authority-change-runtime-smoke.v1', 'A03 runtime descriptor: version is explicit');
  equal(descriptor.step, 'A03', 'A03 runtime descriptor: step is explicit');
  equal(descriptor.scenarioCount, 8, 'A03 runtime descriptor: scenario count is fixed');
  equal(descriptor.runsA01FixturesThroughR02ToR07, true, 'A03 runtime descriptor: runs A01 through R02-R07');
  equal(descriptor.executionMode, 'shadow-only', 'A03 runtime descriptor: execution mode is shadow-only');
  equal(descriptor.fixtureOnly, true, 'A03 runtime descriptor: fixture-only is true');
  equal(descriptor.deterministicReplay, true, 'A03 runtime descriptor: deterministic replay is true');
  equal(descriptor.noTargetSystemCall, true, 'A03 runtime descriptor: target-system calls are forbidden');
  equal(descriptor.noIdentityProviderCall, true, 'A03 runtime descriptor: identity-provider calls are forbidden');
  equal(descriptor.noAccessChange, true, 'A03 runtime descriptor: access changes are forbidden');
  equal(descriptor.noAuditWrite, true, 'A03 runtime descriptor: audit writes are forbidden');
  equal(descriptor.noPolicyActivation, true, 'A03 runtime descriptor: policy activation is forbidden');
  equal(descriptor.noLearningActivation, true, 'A03 runtime descriptor: learning activation is forbidden');
  equal(descriptor.canAdmit, false, 'A03 runtime descriptor: cannot admit');
  equal(descriptor.productionReady, false, 'A03 runtime descriptor: production readiness is false');
}

function testRuntimeSmokeRunsAllScenarios(): void {
  const result = runGoldenAuthorityChangeRuntimeSmoke();
  const scenarios = result.scenarioResults.map((item) => item.scenario).sort();

  equal(result.version, 'attestor.golden-authority-change-runtime-smoke.v1', 'A03 runtime result: version is explicit');
  equal(result.step, 'A03', 'A03 runtime result: step is explicit');
  equal(result.scenarioCount, 8, 'A03 runtime result: scenario count is fixed');
  equal(result.smokeResults.length, 8, 'A03 runtime result: eight smoke results are emitted');
  equal(result.phaseDigests.length, 8, 'A03 runtime result: one phase digest per scenario is retained');
  equal(result.allScenariosCompleted, true, 'A03 runtime result: all scenarios completed');
  equal(result.executionMode, 'shadow-only', 'A03 runtime result: execution mode is shadow-only');
  equal(result.fixtureOnly, true, 'A03 runtime result: fixture-only is true');
  equal(result.deterministicReplay, true, 'A03 runtime result: deterministic replay is true');
  equal(result.noTargetSystemCall, true, 'A03 runtime result: target-system calls are forbidden');
  equal(result.noIdentityProviderCall, true, 'A03 runtime result: identity-provider calls are forbidden');
  equal(result.noAccessChange, true, 'A03 runtime result: access changes are forbidden');
  equal(result.noAuditWrite, true, 'A03 runtime result: audit writes are forbidden');
  equal(result.noExternalEventBus, true, 'A03 runtime result: external event bus is forbidden');
  equal(result.noExternalTraceExport, true, 'A03 runtime result: external trace export is forbidden');
  equal(result.noExternalLineageExport, true, 'A03 runtime result: external lineage export is forbidden');
  equal(result.noPolicyActivation, true, 'A03 runtime result: policy activation is forbidden');
  equal(result.noLearningActivation, true, 'A03 runtime result: learning activation is forbidden');
  equal(result.noTrainingActivation, true, 'A03 runtime result: training activation is forbidden');
  equal(result.grantsAuthority, false, 'A03 runtime result: grants authority is false');
  equal(result.canAdmit, false, 'A03 runtime result: cannot admit');
  equal(result.activatesEnforcement, false, 'A03 runtime result: cannot activate enforcement');
  equal(result.autoEnforce, false, 'A03 runtime result: auto enforcement is false');
  equal(result.rawPayloadRead, false, 'A03 runtime result: raw payload read is false');
  equal(result.rawPayloadStored, false, 'A03 runtime result: raw payload stored is false');
  equal(result.rawIdentityAttributesRead, false, 'A03 runtime result: raw identity attributes read is false');
  equal(result.rawIdentityAttributesStored, false, 'A03 runtime result: raw identity attributes stored is false');
  equal(result.productionReady, false, 'A03 runtime result: production readiness is false');
  assert.deepEqual(
    scenarios,
    [
      'break-glass-unapproved',
      'external-delegation-review',
      'privileged-role-narrowing',
      'prompt-injection-in-ticket',
      'revocation-ready',
      'stale-approval',
      'standard-group-grant-approved',
      'tenant-scope-mismatch',
    ],
    'A03 runtime result: all A01 scenarios are represented',
  );
  passed += 1;
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.digest), 'A03 runtime result: digest is canonical');
}

function testEachScenarioBindsRuntimeArtifacts(): void {
  const result = runGoldenAuthorityChangeRuntimeSmoke();

  for (const scenario of result.scenarioResults) {
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.fixtureDigest), `A03 ${scenario.scenario}: fixture digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.sourceEventDigest), `A03 ${scenario.scenario}: source event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.smokeDigest), `A03 ${scenario.scenario}: smoke digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.envelopeRefDigest), `A03 ${scenario.scenario}: envelope digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.assurancePacketDigest), `A03 ${scenario.scenario}: assurance packet digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalAssuranceCaseDigest), `A03 ${scenario.scenario}: assurance case digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalLineageGraphDigest), `A03 ${scenario.scenario}: lineage digest is canonical`);
    equal(scenario.noTargetSystemCall, true, `A03 ${scenario.scenario}: no target-system call`);
    equal(scenario.noIdentityProviderCall, true, `A03 ${scenario.scenario}: no identity-provider call`);
    equal(scenario.noAccessChange, true, `A03 ${scenario.scenario}: no access change`);
    equal(scenario.noAuditWrite, true, `A03 ${scenario.scenario}: no audit write`);
    equal(scenario.noPolicyActivation, true, `A03 ${scenario.scenario}: no policy activation`);
    equal(scenario.noLearningActivation, true, `A03 ${scenario.scenario}: no learning activation`);
    equal(scenario.canAdmit, false, `A03 ${scenario.scenario}: cannot admit`);
    equal(scenario.productionReady, false, `A03 ${scenario.scenario}: production readiness is false`);
  }
}

function testDeterminismAndDataMinimization(): void {
  const first = runGoldenAuthorityChangeRuntimeSmoke();
  const second = runGoldenAuthorityChangeRuntimeSmoke();
  const serialized = JSON.stringify(first);

  equal(first.digest, second.digest, 'A03 runtime smoke: full digest is deterministic');
  equal(first.phaseDigests.join('\n'), second.phaseDigests.join('\n'), 'A03 runtime smoke: phase digests are deterministic');
  excludes(serialized, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'A03 runtime smoke: no raw email address is serialized');
  excludes(serialized, /\b(user|employee|account|tenant)[_-]?[0-9]{3,}\b/iu, 'A03 runtime smoke: no raw user, account, or tenant id is serialized');
  excludes(serialized, /firstName|lastName|displayName|phoneNumber|streetAddress|rawSubject|rawPrincipal/iu, 'A03 runtime smoke: no raw identity attribute fields are serialized');
  excludes(serialized, /"providerBody"\s*:|"identityProviderPayload"\s*:|"systemOfRecordPayload"\s*:/iu, 'A03 runtime smoke: no raw identity-provider material is serialized');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-authority-change-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: A01-A03 complete once merged.',
    'Progress after A03 lands: 3/4 complete. 1 step remains.',
    '| A03 | complete once merged | Runtime smoke and pilot readiness |',
    'R02-R07 shadow runtime smoke chain',
    'ready-for-shadow-pilot',
  ]) {
    includes(doc, expected, `A03 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Authority Change Golden Path A03',
    'A03 ledger: records runtime smoke and pilot readiness',
  );
  equal(
    packageJson.scripts['test:golden-authority-change-runtime-smoke'],
    'tsx tests/golden-authority-change-runtime-smoke.test.ts',
    'A03 runtime package script: targeted test is registered',
  );
}

testDescriptor();
testRuntimeSmokeRunsAllScenarios();
testEachScenarioBindsRuntimeArtifacts();
testDeterminismAndDataMinimization();
testDocsAndScriptsStayAligned();

console.log(`golden-authority-change-runtime-smoke: ${passed} assertions passed`);
