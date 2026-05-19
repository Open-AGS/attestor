import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenRefundPolicyFoundryProjection,
  goldenRefundPolicyFoundryProjectionDescriptor,
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
  const projection = createGoldenRefundPolicyFoundryProjection();

  equal(projection.version, 'attestor.golden-refund-policy-foundry-projection.v1', 'G04 projection: version is explicit');
  equal(projection.step, 'G04', 'G04 projection: step is explicit');
  equal(projection.sourceFixtureCount, 5, 'G04 projection: consumes five G03 fixtures');
  equal(projection.actionSurface, 'refund_service.issue_refund', 'G04 projection: action surface is refund issue');
  equal(projection.domain, 'money-movement', 'G04 projection: domain is money movement');
  equal(projection.approvalRequired, true, 'G04 projection: approval remains required');
  equal(projection.autoEnforce, false, 'G04 projection: auto enforcement is false');
  equal(projection.activatesEnforcement, false, 'G04 projection: enforcement activation is false');
  equal(projection.rawPayloadStored, false, 'G04 projection: raw payload storage is false');
  equal(projection.productionReady, false, 'G04 projection: production readiness is false');
  equal(projection.reviewMaterialOnly, true, 'G04 projection: output is review material only');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.digest), 'G04 projection: digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.sourceFixtureSuiteDigest), 'G04 projection: source fixture suite digest is canonical');
}

function testPolicyTwinSummaryIsReviewOnly(): void {
  const projection = createGoldenRefundPolicyFoundryProjection();
  const summary = projection.policyTwinSummary;

  equal(summary.version, 'attestor.policy-foundry-policy-twin-summary.v1', 'G04 summary: policy twin summary version is retained');
  equal(summary.status, 'review-only', 'G04 summary: refund candidate stays review-only');
  equal(summary.recommendedRolloutStep, 'review-required', 'G04 summary: recommended rollout is review-required');
  equal(summary.eventCount, 5, 'G04 summary: event count is fixture count');
  equal(summary.decisionImpact.admitCount, 1, 'G04 summary: admit count comes from normal fixture');
  equal(summary.decisionImpact.reviewCount, 3, 'G04 summary: review count comes from stale/repeated/approval fixtures');
  equal(summary.decisionImpact.blockCount, 1, 'G04 summary: block count comes from missing-evidence fixture');
  equal(summary.gapCounts.evidence, 2, 'G04 summary: missing/stale evidence gaps are counted');
  equal(summary.gapCounts.authority, 3, 'G04 summary: approval-required fixtures are counted as authority gaps');
  equal(summary.policyTwinEvidenceOnly, true, 'G04 summary: policy twin output is evidence-only');
  equal(summary.autoEnforce, false, 'G04 summary: auto enforcement is false');
  equal(summary.activatesEnforcement, false, 'G04 summary: enforcement activation is false');
  equal(summary.productionReady, false, 'G04 summary: production readiness is false');
}

function testNamedGapsAndBacktestMaterial(): void {
  const projection = createGoldenRefundPolicyFoundryProjection();
  const gapKinds = projection.namedGaps.map((gap) => gap.kind).join('\n');

  for (const expected of [
    'missing-payment-evidence',
    'stale-payment-evidence',
    'prior-refund-relationship-review',
    'human-approval-required',
  ]) {
    includes(gapKinds, expected, `G04 named gaps: records ${expected}`);
  }

  equal(projection.namedGaps.length, 4, 'G04 named gaps: exactly four named gaps are emitted');
  ok(
    projection.namedGaps.every((gap) => gap.reviewOnly === true),
    'G04 named gaps: every gap is review-only',
  );
  equal(
    projection.reviewOnlyCandidate.proposedMode,
    'review',
    'G04 review-only candidate: proposed mode is review',
  );
  equal(
    projection.reviewOnlyCandidate.autoEnforce,
    false,
    'G04 review-only candidate: auto enforcement is false',
  );
  equal(
    projection.reviewOnlyCandidate.activatesEnforcement,
    false,
    'G04 review-only candidate: enforcement activation is false',
  );
  equal(
    projection.backtestMaterial.fixtureDigests.length,
    5,
    'G04 backtest material: fixture digests are retained',
  );
  equal(
    projection.backtestMaterial.eventDigests.length,
    5,
    'G04 backtest material: event digests are retained',
  );
  equal(
    projection.backtestMaterial.decisionCounts.block,
    1,
    'G04 backtest material: block count is retained',
  );
}

function testDataMinimization(): void {
  const projection = createGoldenRefundPolicyFoundryProjection();
  const serialized = JSON.stringify(projection);

  excludes(serialized, /\bcus_[a-zA-Z0-9_]+/u, 'G04 projection: no raw customer id is serialized');
  excludes(serialized, /\bpi_[a-zA-Z0-9_]+/u, 'G04 projection: no raw payment intent id is serialized');
  excludes(serialized, /\bch_[a-zA-Z0-9_]+/u, 'G04 projection: no raw charge id is serialized');
  excludes(serialized, /\border_[a-zA-Z0-9_]+/u, 'G04 projection: no raw order id is serialized');
  excludes(serialized, /cardNumber|customerName|customerEmail|paymentIntentId|stripeChargeId|shopifyOrderId/iu, 'G04 projection: no raw commerce identifiers are serialized');
}

function testDescriptorDocsAndScriptsStayAligned(): void {
  const descriptor = goldenRefundPolicyFoundryProjectionDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-refund-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-refund-policy-foundry-projection.v1', 'G04 descriptor: version is explicit');
  equal(descriptor.step, 'G04', 'G04 descriptor: step is explicit');
  equal(descriptor.reviewOnly, true, 'G04 descriptor: review-only is explicit');
  equal(descriptor.autoEnforce, false, 'G04 descriptor: auto enforcement is false');
  equal(descriptor.productionReady, false, 'G04 descriptor: production readiness is false');

  for (const expected of [
    'Status: G06 pilot readiness probe',
    'Progress after G06 lands: 6/7 complete. 1 step remains.',
    '| G04 | complete | Policy Foundry refund projection |',
    'review-only candidate',
    'named evidence/authority/relationship gaps',
  ]) {
    includes(doc, expected, `G04 doc: records ${expected}`);
  }

  includes(
    ledger,
    'G04 Policy Foundry refund projection',
    'G04 ledger: records the projection step',
  );
  equal(
    packageJson.scripts['test:golden-refund-policy-foundry-projection'],
    'tsx tests/golden-refund-policy-foundry-projection.test.ts',
    'G04 package script: targeted test is registered',
  );
}

testProjectionShape();
testPolicyTwinSummaryIsReviewOnly();
testNamedGapsAndBacktestMaterial();
testDataMinimization();
testDescriptorDocsAndScriptsStayAligned();

console.log(`golden-refund-policy-foundry-projection: ${passed} assertions passed`);
