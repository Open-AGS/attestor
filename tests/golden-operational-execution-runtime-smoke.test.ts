import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  goldenOperationalExecutionRuntimeSmokeDescriptor,
  runGoldenOperationalExecutionRuntimeSmoke,
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
  const descriptor = goldenOperationalExecutionRuntimeSmokeDescriptor();

  equal(descriptor.version, 'attestor.golden-operational-execution-runtime-smoke.v1', 'O03 runtime descriptor: version is explicit');
  equal(descriptor.step, 'O03', 'O03 runtime descriptor: step is explicit');
  equal(descriptor.scenarioCount, 8, 'O03 runtime descriptor: scenario count is fixed');
  equal(descriptor.runsO01FixturesThroughR02ToR07, true, 'O03 runtime descriptor: runs O01 through R02-R07');
  equal(descriptor.executionMode, 'shadow-only', 'O03 runtime descriptor: execution mode is shadow-only');
  equal(descriptor.fixtureOnly, true, 'O03 runtime descriptor: fixture-only is true');
  equal(descriptor.noTargetSystemCall, true, 'O03 runtime descriptor: target-system calls are forbidden');
  equal(descriptor.noDeployment, true, 'O03 runtime descriptor: deployments are forbidden');
  equal(descriptor.noInfrastructureChange, true, 'O03 runtime descriptor: infrastructure changes are forbidden');
  equal(descriptor.noSecretManagerWrite, true, 'O03 runtime descriptor: secret-manager writes are forbidden');
  equal(descriptor.noIncidentAutomationExecution, true, 'O03 runtime descriptor: incident automation is forbidden');
  equal(descriptor.noRunbookExecution, true, 'O03 runtime descriptor: runbook execution is forbidden');
  equal(descriptor.noProviderCall, true, 'O03 runtime descriptor: provider calls are forbidden');
  equal(descriptor.noAuditWrite, true, 'O03 runtime descriptor: audit writes are forbidden');
  equal(descriptor.noPolicyActivation, true, 'O03 runtime descriptor: policy activation is forbidden');
  equal(descriptor.canAdmit, false, 'O03 runtime descriptor: cannot admit');
  equal(descriptor.productionReady, false, 'O03 runtime descriptor: production readiness is false');
}

function testRuntimeSmokeRunsAllScenarios(): void {
  const result = runGoldenOperationalExecutionRuntimeSmoke();
  const scenarios = result.scenarioResults.map((item) => item.scenario).sort();

  equal(result.version, 'attestor.golden-operational-execution-runtime-smoke.v1', 'O03 runtime result: version is explicit');
  equal(result.step, 'O03', 'O03 runtime result: step is explicit');
  equal(result.scenarioCount, 8, 'O03 runtime result: scenario count is fixed');
  equal(result.smokeResults.length, 8, 'O03 runtime result: eight smoke results are emitted');
  equal(result.phaseDigests.length, 8, 'O03 runtime result: one phase digest per scenario is retained');
  equal(result.allScenariosCompleted, true, 'O03 runtime result: all scenarios completed');
  equal(result.executionMode, 'shadow-only', 'O03 runtime result: execution mode is shadow-only');
  equal(result.fixtureOnly, true, 'O03 runtime result: fixture-only is true');
  equal(result.deterministicReplay, true, 'O03 runtime result: deterministic replay is true');
  equal(result.noTargetSystemCall, true, 'O03 runtime result: target-system calls are forbidden');
  equal(result.noDeployment, true, 'O03 runtime result: deployments are forbidden');
  equal(result.noInfrastructureChange, true, 'O03 runtime result: infrastructure changes are forbidden');
  equal(result.noSecretManagerWrite, true, 'O03 runtime result: secret-manager writes are forbidden');
  equal(result.noIncidentAutomationExecution, true, 'O03 runtime result: incident automation is forbidden');
  equal(result.noRunbookExecution, true, 'O03 runtime result: runbook execution is forbidden');
  equal(result.noProviderCall, true, 'O03 runtime result: provider calls are forbidden');
  equal(result.noAuditWrite, true, 'O03 runtime result: audit writes are forbidden');
  equal(result.noExternalEventBus, true, 'O03 runtime result: external event bus is forbidden');
  equal(result.noExternalTraceExport, true, 'O03 runtime result: external trace export is forbidden');
  equal(result.noExternalLineageExport, true, 'O03 runtime result: external lineage export is forbidden');
  equal(result.noPolicyActivation, true, 'O03 runtime result: policy activation is forbidden');
  equal(result.grantsAuthority, false, 'O03 runtime result: grants authority is false');
  equal(result.canAdmit, false, 'O03 runtime result: cannot admit');
  equal(result.activatesEnforcement, false, 'O03 runtime result: cannot activate enforcement');
  equal(result.autoEnforce, false, 'O03 runtime result: auto enforcement is false');
  equal(result.rawPayloadRead, false, 'O03 runtime result: raw payload read is false');
  equal(result.rawPayloadStored, false, 'O03 runtime result: raw payload stored is false');
  equal(result.rawDeploymentManifestRead, false, 'O03 runtime result: raw deployment manifest read is false');
  equal(result.rawDeploymentManifestStored, false, 'O03 runtime result: raw deployment manifest stored is false');
  equal(result.rawTerraformPlanRead, false, 'O03 runtime result: raw Terraform plan read is false');
  equal(result.rawTerraformPlanStored, false, 'O03 runtime result: raw Terraform plan stored is false');
  equal(result.rawSecretMaterialRead, false, 'O03 runtime result: raw secret material read is false');
  equal(result.rawSecretMaterialStored, false, 'O03 runtime result: raw secret material stored is false');
  equal(result.rawRunbookTextRead, false, 'O03 runtime result: raw runbook text read is false');
  equal(result.rawRunbookTextStored, false, 'O03 runtime result: raw runbook text stored is false');
  equal(result.rawCustomerIdentifiersRead, false, 'O03 runtime result: raw customer identifiers read is false');
  equal(result.rawCustomerIdentifiersStored, false, 'O03 runtime result: raw customer identifiers stored is false');
  equal(result.productionReady, false, 'O03 runtime result: production readiness is false');
  assert.deepEqual(
    scenarios,
    [
      'canary-deploy-approved',
      'duplicate-operation-replay-blocked',
      'incident-restart-break-glass',
      'infrastructure-change-drift-review',
      'production-deploy-missing-rollback',
      'prompt-injection-in-runbook',
      'rollback-ready-approved',
      'secret-rotation-stale-approval',
    ],
    'O03 runtime result: all O01 scenarios are represented',
  );
  passed += 1;
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.digest), 'O03 runtime result: digest is canonical');
}

function testEachScenarioBindsRuntimeArtifacts(): void {
  const result = runGoldenOperationalExecutionRuntimeSmoke();

  for (const scenario of result.scenarioResults) {
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.fixtureDigest), `O03 ${scenario.scenario}: fixture digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.sourceEventDigest), `O03 ${scenario.scenario}: source event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.smokeDigest), `O03 ${scenario.scenario}: smoke digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.envelopeRefDigest), `O03 ${scenario.scenario}: envelope digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.assurancePacketDigest), `O03 ${scenario.scenario}: assurance packet digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalAssuranceCaseDigest), `O03 ${scenario.scenario}: assurance case digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalLineageGraphDigest), `O03 ${scenario.scenario}: lineage digest is canonical`);
    equal(scenario.noTargetSystemCall, true, `O03 ${scenario.scenario}: no target-system call`);
    equal(scenario.noDeployment, true, `O03 ${scenario.scenario}: no deployment`);
    equal(scenario.noInfrastructureChange, true, `O03 ${scenario.scenario}: no infrastructure change`);
    equal(scenario.noSecretManagerWrite, true, `O03 ${scenario.scenario}: no secret-manager write`);
    equal(scenario.noIncidentAutomationExecution, true, `O03 ${scenario.scenario}: no incident automation`);
    equal(scenario.noRunbookExecution, true, `O03 ${scenario.scenario}: no runbook execution`);
    equal(scenario.canAdmit, false, `O03 ${scenario.scenario}: cannot admit`);
    equal(scenario.productionReady, false, `O03 ${scenario.scenario}: production readiness is false`);
  }
}

function testDeterminismAndDataMinimization(): void {
  const first = runGoldenOperationalExecutionRuntimeSmoke();
  const second = runGoldenOperationalExecutionRuntimeSmoke();
  const serialized = JSON.stringify(first);

  equal(first.digest, second.digest, 'O03 runtime smoke: full digest is deterministic');
  equal(first.phaseDigests.join('\n'), second.phaseDigests.join('\n'), 'O03 runtime smoke: phase digests are deterministic');
  excludes(serialized, /AKIA|ASIA|AIza|sk_live|rk_live|whsec|xox[abprs]-|-----BEGIN [A-Z ]*PRIVATE KEY-----/u, 'O03 runtime smoke: no provider or secret token material is serialized');
  excludes(serialized, /"(?:kubeconfig|terraformState|tfvars|privateKey|secretValue|password|accessToken|refreshToken|bearerToken)"\s*:/iu, 'O03 runtime smoke: no raw ops credential/config fields are serialized');
  excludes(serialized, /\b(customer|tenant|account)[_-]?[0-9]{3,}\b/iu, 'O03 runtime smoke: no raw customer, tenant, or account id is serialized');
  excludes(serialized, /"rawManifest"\s*:|"rawRunbookText"\s*:|"rawTerraformPlan"\s*:|"rawSecret"\s*:|kubectl apply|terraform apply/iu, 'O03 runtime smoke: no raw deploy/runbook/plan fields or execution commands are serialized');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-operational-execution-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Progress after O04 lands: 4/4 complete. 0 steps remain.',
    '| O03 | complete | Runtime smoke and pilot readiness |',
    'R02-R07 shadow runtime smoke chain',
    'ready-for-shadow-pilot',
    'no deployment, no infrastructure change, no',
    'secret-manager write, no incident automation execution, and no runbook',
  ]) {
    includes(doc, expected, `O03 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Operational Execution Golden Path O03',
    'O03 ledger: records runtime smoke and pilot readiness',
  );
  equal(
    packageJson.scripts['test:golden-operational-execution-runtime-smoke'],
    'tsx tests/golden-operational-execution-runtime-smoke.test.ts',
    'O03 runtime package script: targeted test is registered',
  );
}

testDescriptor();
testRuntimeSmokeRunsAllScenarios();
testEachScenarioBindsRuntimeArtifacts();
testDeterminismAndDataMinimization();
testDocsAndScriptsStayAligned();

console.log(`golden-operational-execution-runtime-smoke: ${passed} assertions passed`);
