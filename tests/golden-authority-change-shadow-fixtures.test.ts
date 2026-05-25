import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenAuthorityChangeShadowFixtureSuite,
  goldenAuthorityChangeShadowFixturesDescriptor,
  GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_SCENARIOS,
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
  const suite = createGoldenAuthorityChangeShadowFixtureSuite();

  equal(suite.version, 'attestor.golden-authority-change-shadow-fixtures.v1', 'A01 fixtures: version is explicit');
  equal(suite.name, 'Golden Path: Authority Change', 'A01 fixtures: suite is bound to the authority change golden path');
  equal(suite.step, 'A01', 'A01 fixtures: step is explicit');
  equal(suite.fixtureCount, 8, 'A01 fixtures: exactly eight scenarios are emitted');
  deepEqual(
    suite.scenarios,
    GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURE_SCENARIOS,
    'A01 fixtures: scenarios match the canonical list',
  );
  equal(suite.shadowOnly, true, 'A01 fixtures: suite is shadow-only');
  equal(suite.noTargetSystemCalls, true, 'A01 fixtures: suite performs no target-system calls');
  equal(suite.noRawPayload, true, 'A01 fixtures: suite carries no raw payload');
  equal(suite.noRawIdentityAttributes, true, 'A01 fixtures: suite carries no raw identity attributes');
  equal(suite.noRawCustomerIdentifiers, true, 'A01 fixtures: suite carries no raw customer identifiers');
  equal(suite.autoEnforce, false, 'A01 fixtures: suite cannot auto-enforce');
  equal(suite.productionReady, false, 'A01 fixtures: suite is not production-ready');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.digest), 'A01 fixtures: suite digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.sourceRecipeRefDigest), 'A01 fixtures: source recipe ref is digest-bound');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.actionSurfaceRefDigest), 'A01 fixtures: action surface ref is digest-bound');
}

function testCanonicalEventsAreDigestOnly(): void {
  const suite = createGoldenAuthorityChangeShadowFixtureSuite();
  const serialized = JSON.stringify(suite);

  for (const fixture of suite.fixtures) {
    equal(fixture.fixtureOnly, true, `A01 ${fixture.scenario}: fixture-only flag is true`);
    equal(fixture.synthetic, true, `A01 ${fixture.scenario}: synthetic flag is true`);
    equal(fixture.shadowOnly, true, `A01 ${fixture.scenario}: shadow-only flag is true`);
    equal(fixture.noTargetSystemCall, true, `A01 ${fixture.scenario}: no target-system call flag is true`);
    equal(fixture.noRawPayload, true, `A01 ${fixture.scenario}: no raw payload flag is true`);
    equal(fixture.noRawIdentityAttributes, true, `A01 ${fixture.scenario}: no raw identity attribute flag is true`);
    equal(fixture.noRawCustomerIdentifiers, true, `A01 ${fixture.scenario}: no raw customer identifier flag is true`);
    equal(fixture.autoEnforce, false, `A01 ${fixture.scenario}: cannot auto-enforce`);
    equal(fixture.productionReady, false, `A01 ${fixture.scenario}: is not production-ready`);
    equal(fixture.event.version, 'attestor.canonical-shadow-event.v1', `A01 ${fixture.scenario}: event is canonical`);
    equal(fixture.event.sourceKind, 'admission-shadow', `A01 ${fixture.scenario}: event source is admission shadow`);
    equal(fixture.event.observed.consequenceClass, 'authority-change', `A01 ${fixture.scenario}: consequence class is authority change`);
    equal(fixture.event.rawPayloadStored, false, `A01 ${fixture.scenario}: raw payload storage is false`);
    equal(fixture.event.autoEnforce, false, `A01 ${fixture.scenario}: event cannot auto-enforce`);
    equal(fixture.event.approvalRequiredForPromotion, true, `A01 ${fixture.scenario}: promotion requires approval`);
    equal(fixture.event.rawMaterialBoundary.rawPayloadStored, false, `A01 ${fixture.scenario}: raw payload boundary is false`);
    equal(fixture.event.rawMaterialBoundary.rawCustomerIdentifierStored, false, `A01 ${fixture.scenario}: raw customer identifier boundary is false`);
    ok(fixture.event.observed.authorityDelta !== null, `A01 ${fixture.scenario}: authority delta is explicit`);
    ok(fixture.event.evidenceRefs.length >= 2, `A01 ${fixture.scenario}: evidence refs are present`);
    ok(fixture.event.policyRefs.length === 1, `A01 ${fixture.scenario}: review-only policy ref is present`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.event.digest), `A01 ${fixture.scenario}: event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.digest), `A01 ${fixture.scenario}: fixture digest is canonical`);
  }

  excludes(serialized, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'A01 fixtures: no raw email address is serialized');
  excludes(serialized, /\b(user|employee|account|tenant)[_-]?[0-9]{3,}\b/iu, 'A01 fixtures: no raw user, account, or tenant id is serialized');
  excludes(serialized, /firstName|lastName|displayName|phoneNumber|streetAddress|rawSubject|rawPrincipal/iu, 'A01 fixtures: no raw identity attribute fields are serialized');
  excludes(serialized, /raw payload|system of record|connector implemented/iu, 'A01 fixtures: raw/provider/system claims are not serialized as fixture data');
}

function testScenarioSemantics(): void {
  const suite = createGoldenAuthorityChangeShadowFixtureSuite();
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));

  equal(
    byScenario.get('standard-group-grant-approved')?.expectedDecision,
    'admit',
    'A01 standard group grant: expected decision is admit',
  );
  equal(
    byScenario.get('standard-group-grant-approved')?.event.decision.shadowDecision,
    'would_admit',
    'A01 standard group grant: shadow decision would admit',
  );

  equal(
    byScenario.get('privileged-role-narrowing')?.expectedDecision,
    'narrow',
    'A01 privileged role: expected decision is narrow',
  );
  includes(
    byScenario.get('privileged-role-narrowing')?.reasonCodes.join('\n') ?? '',
    'authority-change:narrow-to-time-bound-role',
    'A01 privileged role: time-bound role narrowing reason is present',
  );

  for (const scenario of ['break-glass-unapproved', 'tenant-scope-mismatch', 'stale-approval'] as const) {
    equal(
      byScenario.get(scenario)?.expectedDecision,
      'block',
      `A01 ${scenario}: expected decision is block`,
    );
    equal(
      byScenario.get(scenario)?.event.decision.effectiveDecision,
      'block',
      `A01 ${scenario}: effective decision is fail-closed block`,
    );
  }

  equal(
    byScenario.get('external-delegation-review')?.expectedDecision,
    'review',
    'A01 external delegation: expected decision is review',
  );
  includes(
    byScenario.get('external-delegation-review')?.expectedSignals.join('\n') ?? '',
    'delegation-review-required',
    'A01 external delegation: delegation review signal is present',
  );

  equal(
    byScenario.get('prompt-injection-in-ticket')?.authorityFacts.instructionLikeEvidence,
    true,
    'A01 prompt injection: instruction-like evidence flag is true',
  );
  includes(
    byScenario.get('prompt-injection-in-ticket')?.reasonCodes.join('\n') ?? '',
    'authority-change:ignore-evidence-as-instruction',
    'A01 prompt injection: ticket text cannot become authority',
  );

  equal(
    byScenario.get('revocation-ready')?.expectedDecision,
    'admit',
    'A01 revocation: expected decision is admit',
  );
  includes(
    byScenario.get('revocation-ready')?.expectedSignals.join('\n') ?? '',
    'least-privilege-restoration',
    'A01 revocation: least-privilege restoration signal is present',
  );
}

function testDescriptorDocsAndScriptsStayAligned(): void {
  const descriptor = goldenAuthorityChangeShadowFixturesDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-authority-change-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-authority-change-shadow-fixtures.v1', 'A01 descriptor: version is explicit');
  equal(descriptor.step, 'A01', 'A01 descriptor: step is explicit');
  equal(descriptor.shadowOnly, true, 'A01 descriptor: shadow-only is explicit');
  equal(descriptor.noTargetSystemCalls, true, 'A01 descriptor: target-system calls are forbidden');
  equal(descriptor.noRawIdentityAttributes, true, 'A01 descriptor: raw identity attributes are forbidden');
  equal(descriptor.noRawCustomerIdentifiers, true, 'A01 descriptor: raw customer identifiers are forbidden');
  equal(descriptor.productionReady, false, 'A01 descriptor: production readiness is denied');
  ok(descriptor.nonClaims.includes('not-native-okta-entra-or-sailpoint-connector'), 'A01 descriptor: native connector is a non-claim');

  for (const expected of [
    'Status: A01 complete once merged.',
    '| A01 | complete once merged | Authority Change shadow fixture contract |',
    'standard-group-grant-approved, privileged-role-narrowing, break-glass-unapproved, external-delegation-review, tenant-scope-mismatch, stale-approval, prompt-injection-in-ticket, and revocation-ready',
    'not a live Okta',
  ]) {
    includes(doc, expected, `A01 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Authority Change Golden Path A01',
    'A01 ledger: records the authority change fixture contract',
  );
  equal(
    packageJson.scripts['test:golden-authority-change-shadow-fixtures'],
    'tsx tests/golden-authority-change-shadow-fixtures.test.ts',
    'A01 package script: targeted test is registered',
  );
}

testSuiteShape();
testCanonicalEventsAreDigestOnly();
testScenarioSemantics();
testDescriptorDocsAndScriptsStayAligned();

console.log(`golden-authority-change-shadow-fixtures: ${passed} assertions passed`);
