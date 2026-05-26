import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenOperationalExecutionShadowFixtureSuite,
  goldenOperationalExecutionShadowFixturesDescriptor,
  GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_SCENARIOS,
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
  const suite = createGoldenOperationalExecutionShadowFixtureSuite();

  equal(suite.version, 'attestor.golden-operational-execution-shadow-fixtures.v1', 'O01 fixtures: version is explicit');
  equal(suite.name, 'Golden Path: Operational Execution', 'O01 fixtures: suite is bound to the operational execution golden path');
  equal(suite.step, 'O01', 'O01 fixtures: step is explicit');
  equal(suite.fixtureCount, 8, 'O01 fixtures: exactly eight scenarios are emitted');
  deepEqual(
    suite.scenarios,
    GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_SCENARIOS,
    'O01 fixtures: scenarios match the canonical list',
  );
  equal(suite.shadowOnly, true, 'O01 fixtures: suite is shadow-only');
  equal(suite.noTargetSystemCalls, true, 'O01 fixtures: suite performs no target-system calls');
  equal(suite.noDeployment, true, 'O01 fixtures: suite performs no deployment');
  equal(suite.noInfrastructureChange, true, 'O01 fixtures: suite performs no infrastructure change');
  equal(suite.noSecretMaterial, true, 'O01 fixtures: suite carries no secret material');
  equal(suite.noRawPayload, true, 'O01 fixtures: suite carries no raw payload');
  equal(suite.noRawRunbookText, true, 'O01 fixtures: suite carries no raw runbook text');
  equal(suite.noRawCustomerIdentifiers, true, 'O01 fixtures: suite carries no raw customer identifiers');
  equal(suite.autoEnforce, false, 'O01 fixtures: suite cannot auto-enforce');
  equal(suite.productionReady, false, 'O01 fixtures: suite is not production-ready');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.digest), 'O01 fixtures: suite digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.sourceRecipeRefDigest), 'O01 fixtures: source recipe ref is digest-bound');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.actionSurfaceRefDigest), 'O01 fixtures: action surface ref is digest-bound');
}

function testCanonicalEventsAreDigestOnly(): void {
  const suite = createGoldenOperationalExecutionShadowFixtureSuite();
  const serialized = JSON.stringify(suite);

  for (const fixture of suite.fixtures) {
    equal(fixture.fixtureOnly, true, `O01 ${fixture.scenario}: fixture-only flag is true`);
    equal(fixture.synthetic, true, `O01 ${fixture.scenario}: synthetic flag is true`);
    equal(fixture.shadowOnly, true, `O01 ${fixture.scenario}: shadow-only flag is true`);
    equal(fixture.noTargetSystemCall, true, `O01 ${fixture.scenario}: no target-system call flag is true`);
    equal(fixture.noDeployment, true, `O01 ${fixture.scenario}: no deployment flag is true`);
    equal(fixture.noInfrastructureChange, true, `O01 ${fixture.scenario}: no infrastructure-change flag is true`);
    equal(fixture.noSecretMaterial, true, `O01 ${fixture.scenario}: no secret material flag is true`);
    equal(fixture.noRawPayload, true, `O01 ${fixture.scenario}: no raw payload flag is true`);
    equal(fixture.noRawRunbookText, true, `O01 ${fixture.scenario}: no raw runbook text flag is true`);
    equal(fixture.noRawCustomerIdentifiers, true, `O01 ${fixture.scenario}: no raw customer identifier flag is true`);
    equal(fixture.autoEnforce, false, `O01 ${fixture.scenario}: cannot auto-enforce`);
    equal(fixture.productionReady, false, `O01 ${fixture.scenario}: is not production-ready`);
    equal(fixture.event.version, 'attestor.canonical-shadow-event.v1', `O01 ${fixture.scenario}: event is canonical`);
    equal(fixture.event.sourceKind, 'admission-shadow', `O01 ${fixture.scenario}: event source is admission shadow`);
    equal(fixture.event.observed.consequenceClass, 'operational-execution', `O01 ${fixture.scenario}: consequence class is operational execution`);
    equal(fixture.event.rawPayloadStored, false, `O01 ${fixture.scenario}: raw payload storage is false`);
    equal(fixture.event.autoEnforce, false, `O01 ${fixture.scenario}: event cannot auto-enforce`);
    equal(fixture.event.approvalRequiredForPromotion, true, `O01 ${fixture.scenario}: promotion requires approval`);
    equal(fixture.event.rawMaterialBoundary.rawPayloadStored, false, `O01 ${fixture.scenario}: raw payload boundary is false`);
    equal(fixture.event.rawMaterialBoundary.rawCustomerIdentifierStored, false, `O01 ${fixture.scenario}: raw customer identifier boundary is false`);
    ok(fixture.event.evidenceRefs.length >= 2, `O01 ${fixture.scenario}: evidence refs are present`);
    ok(fixture.event.simulationRefs.length >= 1, `O01 ${fixture.scenario}: simulation refs are present`);
    ok(fixture.event.policyRefs.length === 1, `O01 ${fixture.scenario}: review-only policy ref is present`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.event.digest), `O01 ${fixture.scenario}: event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.digest), `O01 ${fixture.scenario}: fixture digest is canonical`);
  }

  excludes(serialized, /AKIA|ASIA|AIza|sk_live|rk_live|whsec|xox[abprs]-|-----BEGIN [A-Z ]*PRIVATE KEY-----/u, 'O01 fixtures: no provider or secret token material is serialized');
  excludes(serialized, /\b(kubeconfig|terraform\.tfstate|tfvars|private[_-]?key|secretValue|password|token)\b/iu, 'O01 fixtures: no raw ops credential/config fields are serialized');
  excludes(serialized, /\b(customer|tenant|account)[_-]?[0-9]{3,}\b/iu, 'O01 fixtures: no raw customer, tenant, or account id is serialized');
  excludes(serialized, /"rawManifest"\s*:|"rawRunbookText"\s*:|"rawTerraformPlan"\s*:|"rawSecret"\s*:|kubectl apply|terraform apply/iu, 'O01 fixtures: no raw deploy/runbook/plan fields or execution commands are serialized');
}

function testScenarioSemantics(): void {
  const suite = createGoldenOperationalExecutionShadowFixtureSuite();
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));

  equal(
    byScenario.get('canary-deploy-approved')?.expectedDecision,
    'admit',
    'O01 canary deploy: expected decision is admit',
  );
  equal(
    byScenario.get('canary-deploy-approved')?.event.decision.shadowDecision,
    'would_admit',
    'O01 canary deploy: shadow decision would admit',
  );

  equal(
    byScenario.get('production-deploy-missing-rollback')?.expectedDecision,
    'review',
    'O01 production deploy: missing rollback requires review',
  );
  includes(
    byScenario.get('production-deploy-missing-rollback')?.reasonCodes.join('\n') ?? '',
    'operational-execution:rollback-plan-missing',
    'O01 production deploy: rollback reason is present',
  );

  for (const scenario of ['secret-rotation-stale-approval', 'duplicate-operation-replay-blocked'] as const) {
    equal(
      byScenario.get(scenario)?.expectedDecision,
      'block',
      `O01 ${scenario}: expected decision is block`,
    );
    equal(
      byScenario.get(scenario)?.event.decision.effectiveDecision,
      'block',
      `O01 ${scenario}: effective decision is fail-closed block`,
    );
  }

  equal(
    byScenario.get('infrastructure-change-drift-review')?.operationFacts.dryRunStatus,
    'drift-detected',
    'O01 infrastructure drift: dry-run/plan status records drift',
  );
  includes(
    byScenario.get('infrastructure-change-drift-review')?.expectedSignals.join('\n') ?? '',
    'terraform-plan-before-apply',
    'O01 infrastructure drift: plan-before-apply signal is present',
  );

  equal(
    byScenario.get('incident-restart-break-glass')?.operationFacts.incidentState,
    'active',
    'O01 incident restart: active incident state is explicit',
  );
  includes(
    byScenario.get('incident-restart-break-glass')?.reasonCodes.join('\n') ?? '',
    'operational-execution:break-glass-review-required',
    'O01 incident restart: break-glass reason is present',
  );

  equal(
    byScenario.get('prompt-injection-in-runbook')?.operationFacts.instructionLikeEvidence,
    true,
    'O01 prompt injection: instruction-like runbook evidence flag is true',
  );
  includes(
    byScenario.get('prompt-injection-in-runbook')?.reasonCodes.join('\n') ?? '',
    'operational-execution:ignore-runbook-text-as-instruction',
    'O01 prompt injection: runbook text cannot become authority',
  );
}

function testDescriptorDocsAndScriptsStayAligned(): void {
  const descriptor = goldenOperationalExecutionShadowFixturesDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-operational-execution-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-operational-execution-shadow-fixtures.v1', 'O01 descriptor: version is explicit');
  equal(descriptor.step, 'O01', 'O01 descriptor: step is explicit');
  equal(descriptor.shadowOnly, true, 'O01 descriptor: shadow-only is explicit');
  equal(descriptor.noTargetSystemCalls, true, 'O01 descriptor: target-system calls are forbidden');
  equal(descriptor.noDeployment, true, 'O01 descriptor: live deployment is forbidden');
  equal(descriptor.noInfrastructureChange, true, 'O01 descriptor: infrastructure changes are forbidden');
  equal(descriptor.noSecretMaterial, true, 'O01 descriptor: secret material is forbidden');
  equal(descriptor.noRawRunbookText, true, 'O01 descriptor: raw runbook text is forbidden');
  equal(descriptor.productionReady, false, 'O01 descriptor: production readiness is denied');
  ok(descriptor.nonClaims.includes('not-live-kubernetes-terraform-or-github-deployment'), 'O01 descriptor: live deployment is a non-claim');

  for (const expected of [
    'Status: in progress. O01 is repository-side only.',
    'Progress after O01 lands: 1/4 complete. 3 steps remain.',
    '| O01 | complete once merged | Operational Execution shadow fixture contract |',
    'canary-deploy-approved',
    'production-deploy-missing-rollback',
    'secret-rotation-stale-approval',
    'infrastructure-change-drift-review',
    'incident-restart-break-glass',
    'rollback-ready-approved',
    'prompt-injection-in-runbook',
    'duplicate-operation-replay-blocked',
    'Kubernetes server-side dry-run',
    'Terraform plan',
    'GitHub deployment environments',
    'NIST SP 800-61',
  ]) {
    includes(doc, expected, `O01 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Operational Execution Golden Path O01',
    'O01 ledger: records the operational execution fixture contract',
  );
  equal(
    packageJson.scripts['test:golden-operational-execution-shadow-fixtures'],
    'tsx tests/golden-operational-execution-shadow-fixtures.test.ts',
    'O01 package script: targeted test is registered',
  );
}

testSuiteShape();
testCanonicalEventsAreDigestOnly();
testScenarioSemantics();
testDescriptorDocsAndScriptsStayAligned();

console.log(`golden-operational-execution-shadow-fixtures: ${passed} assertions passed`);
