import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenOperationalExecutionPolicyFoundryProjection,
  goldenOperationalExecutionPolicyFoundryProjectionDescriptor,
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
  const projection = createGoldenOperationalExecutionPolicyFoundryProjection();

  equal(projection.version, 'attestor.golden-operational-execution-policy-foundry-projection.v1', 'O02 projection: version is explicit');
  equal(projection.step, 'O02', 'O02 projection: step is explicit');
  equal(projection.sourceFixtureCount, 8, 'O02 projection: consumes eight O01 fixtures');
  equal(projection.actionSurface, 'operational_execution.change_request', 'O02 projection: action surface is operational change request');
  equal(projection.domain, 'system-operation', 'O02 projection: domain stays system-operation');
  equal(projection.approvalRequired, true, 'O02 projection: approval remains required');
  equal(projection.autoEnforce, false, 'O02 projection: auto enforcement is false');
  equal(projection.activatesEnforcement, false, 'O02 projection: enforcement activation is false');
  equal(projection.rawPayloadStored, false, 'O02 projection: raw payload storage is false');
  equal(projection.rawRunbookTextStored, false, 'O02 projection: raw runbook text storage is false');
  equal(projection.rawSecretMaterialStored, false, 'O02 projection: raw secret material storage is false');
  equal(projection.productionReady, false, 'O02 projection: production readiness is false');
  equal(projection.reviewMaterialOnly, true, 'O02 projection: output is review material only');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.digest), 'O02 projection: digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.sourceFixtureSuiteDigest), 'O02 projection: source fixture suite digest is canonical');
}

function testPolicyTwinSummaryIsReviewOnly(): void {
  const projection = createGoldenOperationalExecutionPolicyFoundryProjection();
  const summary = projection.policyTwinSummary;

  equal(summary.version, 'attestor.policy-foundry-policy-twin-summary.v1', 'O02 summary: policy twin summary version is retained');
  equal(summary.status, 'review-only', 'O02 summary: operational candidate stays review-only');
  equal(summary.recommendedRolloutStep, 'review-required', 'O02 summary: recommended rollout is review-required');
  equal(summary.eventCount, 8, 'O02 summary: event count is fixture count');
  equal(summary.decisionImpact.admitCount, 2, 'O02 summary: admit count comes from canary and rollback-ready fixtures');
  equal(summary.decisionImpact.narrowCount, 0, 'O02 summary: no narrow fixtures yet');
  equal(summary.decisionImpact.reviewCount, 4, 'O02 summary: review count comes from rollback, drift, incident, and runbook fixtures');
  equal(summary.decisionImpact.blockCount, 2, 'O02 summary: block count comes from stale secret and duplicate replay fixtures');
  equal(summary.gapCounts.policy, 4, 'O02 summary: rollback/drift/replay policy gaps are counted');
  equal(summary.gapCounts.evidence, 3, 'O02 summary: missing/stale/instruction-like evidence gaps are counted');
  equal(summary.gapCounts.authority, 3, 'O02 summary: authority gaps are counted');
  equal(summary.policyTwinEvidenceOnly, true, 'O02 summary: policy twin output is evidence-only');
  equal(summary.autoEnforce, false, 'O02 summary: auto enforcement is false');
  equal(summary.activatesEnforcement, false, 'O02 summary: enforcement activation is false');
  equal(summary.productionReady, false, 'O02 summary: production readiness is false');
}

function testNamedGapsAndBacktestMaterial(): void {
  const projection = createGoldenOperationalExecutionPolicyFoundryProjection();
  const gapKinds = projection.namedGaps.map((gap) => gap.kind).join('\n');

  for (const expected of [
    'rollback-plan-missing',
    'secret-rotation-stale-approval',
    'infrastructure-drift-review',
    'break-glass-secondary-approval',
    'runbook-instruction-review',
    'duplicate-operation-replay',
  ]) {
    includes(gapKinds, expected, `O02 named gaps: records ${expected}`);
  }

  equal(projection.namedGaps.length, 6, 'O02 named gaps: exactly six named gaps are emitted');
  ok(
    projection.namedGaps.every((gap) => gap.reviewOnly === true),
    'O02 named gaps: every gap is review-only',
  );
  equal(
    projection.reviewOnlyCandidate.proposedMode,
    'review',
    'O02 review-only candidate: proposed mode is review',
  );
  equal(
    projection.reviewOnlyCandidate.autoEnforce,
    false,
    'O02 review-only candidate: auto enforcement is false',
  );
  equal(
    projection.reviewOnlyCandidate.activatesEnforcement,
    false,
    'O02 review-only candidate: enforcement activation is false',
  );
  equal(
    projection.backtestMaterial.fixtureDigests.length,
    8,
    'O02 backtest material: fixture digests are retained',
  );
  equal(
    projection.backtestMaterial.eventDigests.length,
    8,
    'O02 backtest material: event digests are retained',
  );
  equal(
    projection.backtestMaterial.decisionCounts.block,
    2,
    'O02 backtest material: block count is retained',
  );
}

function testDataMinimization(): void {
  const projection = createGoldenOperationalExecutionPolicyFoundryProjection();
  const serialized = JSON.stringify(projection);

  excludes(serialized, /AKIA|ASIA|AIza|sk_live|rk_live|whsec|xox[abprs]-|-----BEGIN [A-Z ]*PRIVATE KEY-----/u, 'O02 projection: no provider or secret token material is serialized');
  excludes(serialized, /"(?:kubeconfig|terraformState|tfvars|privateKey|secretValue|password|accessToken|refreshToken|bearerToken)"\s*:/iu, 'O02 projection: no raw ops credential/config fields are serialized');
  excludes(serialized, /\b(customer|tenant|account)[_-]?[0-9]{3,}\b/iu, 'O02 projection: no raw customer, tenant, or account id is serialized');
  excludes(serialized, /"rawManifest"\s*:|"rawRunbookText"\s*:|"rawTerraformPlan"\s*:|"rawSecret"\s*:|kubectl apply|terraform apply/iu, 'O02 projection: no raw deploy/runbook/plan fields or execution commands are serialized');
}

function testDescriptorDocsAndScriptsStayAligned(): void {
  const descriptor = goldenOperationalExecutionPolicyFoundryProjectionDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-operational-execution-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-operational-execution-policy-foundry-projection.v1', 'O02 descriptor: version is explicit');
  equal(descriptor.step, 'O02', 'O02 descriptor: step is explicit');
  equal(descriptor.reviewOnly, true, 'O02 descriptor: review-only is explicit');
  equal(descriptor.autoEnforce, false, 'O02 descriptor: auto enforcement is false');
  equal(descriptor.rawRunbookTextStored, false, 'O02 descriptor: raw runbook text storage is false');
  equal(descriptor.rawSecretMaterialStored, false, 'O02 descriptor: raw secret material storage is false');
  equal(descriptor.productionReady, false, 'O02 descriptor: production readiness is false');

  for (const expected of [
    'Progress after O04 lands: 4/4 complete. 0 steps remain.',
    '| O02 | complete | Policy Foundry operational projection |',
    'review-only candidate for `operational_execution.change_request`',
    'rollback, dry-run, approval, drift, break-glass, secret, runbook, and replay gaps',
  ]) {
    includes(doc, expected, `O02 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Operational Execution Golden Path O02',
    'O02 ledger: records the projection step',
  );
  equal(
    packageJson.scripts['test:golden-operational-execution-policy-foundry-projection'],
    'tsx tests/golden-operational-execution-policy-foundry-projection.test.ts',
    'O02 package script: targeted test is registered',
  );
}

testProjectionShape();
testPolicyTwinSummaryIsReviewOnly();
testNamedGapsAndBacktestMaterial();
testDataMinimization();
testDescriptorDocsAndScriptsStayAligned();

console.log(`golden-operational-execution-policy-foundry-projection: ${passed} assertions passed`);
