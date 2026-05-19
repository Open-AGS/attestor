import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenRefundShadowFixtureSuite,
  goldenRefundShadowFixturesDescriptor,
  GOLDEN_REFUND_SHADOW_FIXTURE_SCENARIOS,
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
  const suite = createGoldenRefundShadowFixtureSuite();

  equal(suite.version, 'attestor.golden-refund-shadow-fixtures.v1', 'G03 fixtures: version is explicit');
  equal(suite.name, 'Golden Path: Refund', 'G03 fixtures: suite is bound to the refund golden path');
  equal(suite.step, 'G03', 'G03 fixtures: step is explicit');
  equal(suite.fixtureCount, 8, 'G03 fixtures: exactly eight scenarios are emitted');
  deepEqual(
    suite.scenarios,
    GOLDEN_REFUND_SHADOW_FIXTURE_SCENARIOS,
    'G03 fixtures: scenarios match the canonical list',
  );
  equal(suite.shadowOnly, true, 'G03 fixtures: suite is shadow-only');
  equal(suite.noTargetSystemCalls, true, 'G03 fixtures: suite performs no target-system calls');
  equal(suite.noRawPayload, true, 'G03 fixtures: suite carries no raw payload');
  equal(suite.autoEnforce, false, 'G03 fixtures: suite cannot auto-enforce');
  equal(suite.productionReady, false, 'G03 fixtures: suite is not production-ready');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.digest), 'G03 fixtures: suite digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.sourceManifestRefDigest), 'G03 fixtures: source manifest ref is digest-bound');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.actionSurfaceRefDigest), 'G03 fixtures: action surface ref is digest-bound');
}

function testCanonicalEventsAreDigestOnly(): void {
  const suite = createGoldenRefundShadowFixtureSuite();
  const serialized = JSON.stringify(suite);

  for (const fixture of suite.fixtures) {
    equal(fixture.fixtureOnly, true, `G03 ${fixture.scenario}: fixture-only flag is true`);
    equal(fixture.synthetic, true, `G03 ${fixture.scenario}: synthetic flag is true`);
    equal(fixture.shadowOnly, true, `G03 ${fixture.scenario}: shadow-only flag is true`);
    equal(fixture.noTargetSystemCall, true, `G03 ${fixture.scenario}: no target-system call flag is true`);
    equal(fixture.noRawPayload, true, `G03 ${fixture.scenario}: no raw payload flag is true`);
    equal(fixture.autoEnforce, false, `G03 ${fixture.scenario}: cannot auto-enforce`);
    equal(fixture.productionReady, false, `G03 ${fixture.scenario}: is not production-ready`);
    equal(fixture.event.version, 'attestor.canonical-shadow-event.v1', `G03 ${fixture.scenario}: event is canonical`);
    equal(fixture.event.sourceKind, 'admission-shadow', `G03 ${fixture.scenario}: event source is admission shadow`);
    equal(fixture.event.observed.targetSystem, 'refund-service', `G03 ${fixture.scenario}: target system is refund service`);
    equal(fixture.event.observed.actionName, 'issue_refund', `G03 ${fixture.scenario}: action is issue_refund`);
    equal(fixture.event.observed.actionKind, 'api-operation', `G03 ${fixture.scenario}: action kind is API operation`);
    equal(fixture.event.observed.consequenceClass, 'financial', `G03 ${fixture.scenario}: consequence class is financial`);
    equal(fixture.event.rawPayloadStored, false, `G03 ${fixture.scenario}: raw payload storage is false`);
    equal(fixture.event.autoEnforce, false, `G03 ${fixture.scenario}: event cannot auto-enforce`);
    equal(fixture.event.approvalRequiredForPromotion, true, `G03 ${fixture.scenario}: promotion requires approval`);
    equal(fixture.event.rawMaterialBoundary.rawPayloadStored, false, `G03 ${fixture.scenario}: raw payload boundary is false`);
    ok(fixture.event.evidenceRefs.length >= 3, `G03 ${fixture.scenario}: evidence refs are present`);
    ok(fixture.event.policyRefs.length === 1, `G03 ${fixture.scenario}: review-only policy ref is present`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.event.digest), `G03 ${fixture.scenario}: event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.digest), `G03 ${fixture.scenario}: fixture digest is canonical`);
  }

  excludes(serialized, /\bcus_[a-zA-Z0-9_]+/u, 'G03 fixtures: no Stripe-like raw customer id is serialized');
  excludes(serialized, /\bpi_[a-zA-Z0-9_]+/u, 'G03 fixtures: no Stripe-like raw payment intent id is serialized');
  excludes(serialized, /\bch_[a-zA-Z0-9_]+/u, 'G03 fixtures: no Stripe-like raw charge id is serialized');
  excludes(serialized, /\border_[a-zA-Z0-9_]+/u, 'G03 fixtures: no raw order id is serialized');
  excludes(serialized, /raw payload/iu, 'G03 fixtures: raw payload prose is not serialized as fixture data');
}

function testScenarioSemantics(): void {
  const suite = createGoldenRefundShadowFixtureSuite();
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));

  equal(byScenario.get('normal')?.expectedPosture, 'shadow-ready', 'G03 normal: expected posture is shadow-ready');
  includes(
    byScenario.get('normal')?.reasonCodes.join('\n') ?? '',
    'refund:evidence-complete',
    'G03 normal: evidence-complete reason is present',
  );

  equal(byScenario.get('missing-evidence')?.expectedPosture, 'needs-evidence', 'G03 missing evidence: expected posture is needs-evidence');
  includes(
    byScenario.get('missing-evidence')?.expectedSignals.join('\n') ?? '',
    'payment-evidence-gap',
    'G03 missing evidence: payment evidence gap signal is present',
  );
  equal(
    byScenario.get('missing-evidence')?.event.decision.effectiveDecision,
    'block',
    'G03 missing evidence: fail-closed block is represented in shadow analysis',
  );

  equal(byScenario.get('stale-evidence')?.expectedPosture, 'needs-freshness-review', 'G03 stale evidence: expected posture is freshness review');
  equal(
    byScenario.get('stale-evidence')?.refundFacts.evidenceFreshness,
    'stale',
    'G03 stale evidence: freshness state is stale',
  );

  equal(byScenario.get('repeated-refund')?.expectedPosture, 'needs-relationship-review', 'G03 repeated refund: expected posture is relationship review');
  equal(
    byScenario.get('repeated-refund')?.refundFacts.priorRefundCountClass,
    'multiple',
    'G03 repeated refund: prior refund count class is multiple',
  );
  includes(
    byScenario.get('repeated-refund')?.expectedSignals.join('\n') ?? '',
    'prior-refund-escalates',
    'G03 repeated refund: prior refund escalation signal is present',
  );

  equal(byScenario.get('approval-required')?.expectedPosture, 'needs-human-approval', 'G03 approval required: expected posture is human approval');
  equal(
    byScenario.get('approval-required')?.refundFacts.approvalRequired,
    true,
    'G03 approval required: approval flag is true',
  );
  includes(
    byScenario.get('approval-required')?.expectedSignals.join('\n') ?? '',
    'human-approval-required',
    'G03 approval required: human approval signal is present',
  );

  equal(
    byScenario.get('adversarial-text-in-evidence')?.expectedPosture,
    'needs-instruction-text-review',
    'G03 adversarial evidence: expected posture is instruction-text review',
  );
  equal(
    byScenario.get('adversarial-text-in-evidence')?.refundFacts.instructionLikeEvidence,
    true,
    'G03 adversarial evidence: instruction-like evidence flag is true',
  );
  includes(
    byScenario.get('adversarial-text-in-evidence')?.reasonCodes.join('\n') ?? '',
    'refund:ignore-evidence-as-instruction',
    'G03 adversarial evidence: evidence is not treated as an instruction',
  );

  equal(
    byScenario.get('external-fraud-signal-high')?.expectedPosture,
    'needs-external-risk-review',
    'G03 external risk: expected posture is external risk review',
  );
  equal(
    byScenario.get('external-fraud-signal-high')?.refundFacts.externalFraudSignal,
    'high',
    'G03 external risk: high external fraud signal is modeled as evidence',
  );

  equal(
    byScenario.get('over-policy-amount')?.expectedPosture,
    'needs-policy-limit-review',
    'G03 over policy: expected posture is policy limit review',
  );
  equal(
    byScenario.get('over-policy-amount')?.refundFacts.policyLimitPosture,
    'over-policy',
    'G03 over policy: policy limit posture is over-policy',
  );
  equal(
    byScenario.get('over-policy-amount')?.event.decision.shadowDecision,
    'would_narrow',
    'G03 over policy: shadow decision records narrow pressure',
  );
}

function testDescriptorAndDocsStayAligned(): void {
  const descriptor = goldenRefundShadowFixturesDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-refund-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-refund-shadow-fixtures.v1', 'G03 descriptor: version is explicit');
  equal(descriptor.step, 'G03', 'G03 descriptor: step is explicit');
  equal(descriptor.shadowOnly, true, 'G03 descriptor: shadow-only is explicit');
  equal(descriptor.noTargetSystemCalls, true, 'G03 descriptor: target-system calls are forbidden');
  equal(descriptor.productionReady, false, 'G03 descriptor: production readiness is denied');
  ok(descriptor.nonClaims.includes('not-live-refund-execution'), 'G03 descriptor: live refund execution is a non-claim');

  for (const expected of [
    'Status: complete',
    'Progress after G08 lands: 8/8 complete. 0 steps remain.',
    '| G03 | complete | Refund shadow fixture builder |',
    'normal, missing-evidence, stale-evidence, repeated-refund, approval-required, adversarial-text-in-evidence, external-fraud-signal-high, and over-policy-amount',
  ]) {
    includes(doc, expected, `G03 doc: records ${expected}`);
  }

  includes(
    ledger,
    'G03 refund shadow fixture builder',
    'G03 ledger: records the fixture-builder step',
  );
  equal(
    packageJson.scripts['test:golden-refund-shadow-fixtures'],
    'tsx tests/golden-refund-shadow-fixtures.test.ts',
    'G03 package script: targeted test is registered',
  );
}

testSuiteShape();
testCanonicalEventsAreDigestOnly();
testScenarioSemantics();
testDescriptorAndDocsStayAligned();

console.log(`golden-refund-shadow-fixtures: ${passed} assertions passed`);

