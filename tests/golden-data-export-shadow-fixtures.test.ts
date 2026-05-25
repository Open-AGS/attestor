import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenDataExportShadowFixtureSuite,
  goldenDataExportShadowFixturesDescriptor,
  GOLDEN_DATA_EXPORT_SHADOW_FIXTURE_SCENARIOS,
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
  const suite = createGoldenDataExportShadowFixtureSuite();

  equal(suite.version, 'attestor.golden-data-export-shadow-fixtures.v1', 'D01 fixtures: version is explicit');
  equal(suite.name, 'Golden Path: Controlled Data Export', 'D01 fixtures: suite is bound to the data movement golden path');
  equal(suite.step, 'D01', 'D01 fixtures: step is explicit');
  equal(suite.fixtureCount, 8, 'D01 fixtures: exactly eight scenarios are emitted');
  deepEqual(
    suite.scenarios,
    GOLDEN_DATA_EXPORT_SHADOW_FIXTURE_SCENARIOS,
    'D01 fixtures: scenarios match the canonical list',
  );
  equal(suite.shadowOnly, true, 'D01 fixtures: suite is shadow-only');
  equal(suite.noTargetSystemCalls, true, 'D01 fixtures: suite performs no target-system calls');
  equal(suite.noRawPayload, true, 'D01 fixtures: suite carries no raw payload');
  equal(suite.noRawSql, true, 'D01 fixtures: suite carries no raw SQL');
  equal(suite.noRawRows, true, 'D01 fixtures: suite carries no raw rows');
  equal(suite.noRawCustomerIdentifiers, true, 'D01 fixtures: suite carries no raw customer identifiers');
  equal(suite.autoEnforce, false, 'D01 fixtures: suite cannot auto-enforce');
  equal(suite.productionReady, false, 'D01 fixtures: suite is not production-ready');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.digest), 'D01 fixtures: suite digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.sourceRecipeRefDigest), 'D01 fixtures: source recipe ref is digest-bound');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.actionSurfaceRefDigest), 'D01 fixtures: action surface ref is digest-bound');
}

function testCanonicalEventsAreDigestOnly(): void {
  const suite = createGoldenDataExportShadowFixtureSuite();
  const serialized = JSON.stringify(suite);

  for (const fixture of suite.fixtures) {
    equal(fixture.fixtureOnly, true, `D01 ${fixture.scenario}: fixture-only flag is true`);
    equal(fixture.synthetic, true, `D01 ${fixture.scenario}: synthetic flag is true`);
    equal(fixture.shadowOnly, true, `D01 ${fixture.scenario}: shadow-only flag is true`);
    equal(fixture.noTargetSystemCall, true, `D01 ${fixture.scenario}: no target-system call flag is true`);
    equal(fixture.noRawPayload, true, `D01 ${fixture.scenario}: no raw payload flag is true`);
    equal(fixture.noRawSql, true, `D01 ${fixture.scenario}: no raw SQL flag is true`);
    equal(fixture.noRawRows, true, `D01 ${fixture.scenario}: no raw rows flag is true`);
    equal(fixture.noRawCustomerIdentifiers, true, `D01 ${fixture.scenario}: no raw customer identifier flag is true`);
    equal(fixture.autoEnforce, false, `D01 ${fixture.scenario}: cannot auto-enforce`);
    equal(fixture.productionReady, false, `D01 ${fixture.scenario}: is not production-ready`);
    equal(fixture.event.version, 'attestor.canonical-shadow-event.v1', `D01 ${fixture.scenario}: event is canonical`);
    equal(fixture.event.sourceKind, 'admission-shadow', `D01 ${fixture.scenario}: event source is admission shadow`);
    equal(fixture.event.observed.targetSystem, 'analytics-warehouse', `D01 ${fixture.scenario}: target system is synthetic analytics warehouse`);
    equal(fixture.event.observed.consequenceClass, 'data-movement', `D01 ${fixture.scenario}: consequence class is data movement`);
    equal(fixture.event.rawPayloadStored, false, `D01 ${fixture.scenario}: raw payload storage is false`);
    equal(fixture.event.autoEnforce, false, `D01 ${fixture.scenario}: event cannot auto-enforce`);
    equal(fixture.event.approvalRequiredForPromotion, true, `D01 ${fixture.scenario}: promotion requires approval`);
    equal(fixture.event.rawMaterialBoundary.rawPayloadStored, false, `D01 ${fixture.scenario}: raw payload boundary is false`);
    equal(fixture.event.rawMaterialBoundary.rawCustomerIdentifierStored, false, `D01 ${fixture.scenario}: raw customer identifier boundary is false`);
    ok(fixture.event.evidenceRefs.length >= 2, `D01 ${fixture.scenario}: evidence refs are present`);
    ok(fixture.event.policyRefs.length === 1, `D01 ${fixture.scenario}: review-only policy ref is present`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.event.digest), `D01 ${fixture.scenario}: event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.digest), `D01 ${fixture.scenario}: fixture digest is canonical`);
  }

  excludes(serialized, /\bSELECT\b|\bUPDATE\b|\bDELETE\b|\bINSERT\b|\bCOPY\b/iu, 'D01 fixtures: no raw SQL statement text is serialized');
  excludes(serialized, /\b(customer|tenant|account)[_-]?[0-9]{3,}\b/iu, 'D01 fixtures: no raw customer, tenant, or account id is serialized');
  excludes(serialized, /@example\.com|customerEmail|customerName|ssn|phoneNumber|streetAddress/iu, 'D01 fixtures: no raw personal fields are serialized');
  excludes(serialized, /raw rows|raw SQL|raw payload/iu, 'D01 fixtures: raw material prose is not serialized as fixture data');
}

function testScenarioSemantics(): void {
  const suite = createGoldenDataExportShadowFixtureSuite();
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));

  equal(
    byScenario.get('aggregate-report-release')?.expectedDecision,
    'admit',
    'D01 aggregate report: expected decision is admit',
  );
  equal(
    byScenario.get('aggregate-report-release')?.event.decision.shadowDecision,
    'would_admit',
    'D01 aggregate report: shadow decision would admit',
  );
  includes(
    byScenario.get('aggregate-report-release')?.expectedSignals.join('\n') ?? '',
    'aggregate-only',
    'D01 aggregate report: aggregate-only signal is present',
  );

  equal(
    byScenario.get('customer-export-approved')?.expectedPosture,
    'export-ready-with-approval',
    'D01 approved export: posture records approval-bound export readiness',
  );
  equal(
    byScenario.get('customer-export-approved')?.dataFacts.recipientClass,
    'customer-account-owner',
    'D01 approved export: recipient is customer account owner class',
  );

  equal(
    byScenario.get('pii-column-narrowing')?.expectedDecision,
    'narrow',
    'D01 PII narrowing: expected decision is narrow',
  );
  equal(
    byScenario.get('pii-column-narrowing')?.event.decision.shadowDecision,
    'would_narrow',
    'D01 PII narrowing: shadow decision records narrow pressure',
  );
  includes(
    byScenario.get('pii-column-narrowing')?.reasonCodes.join('\n') ?? '',
    'data-export:narrow-to-approved-fields',
    'D01 PII narrowing: approved-field narrowing reason is present',
  );

  equal(
    byScenario.get('external-recipient-review')?.expectedDecision,
    'review',
    'D01 external recipient: expected decision is review',
  );
  includes(
    byScenario.get('external-recipient-review')?.expectedSignals.join('\n') ?? '',
    'recipient-approval-gap',
    'D01 external recipient: recipient approval gap is present',
  );

  for (const scenario of ['tenant-scope-mismatch', 'stale-approval', 'write-query-blocked'] as const) {
    equal(
      byScenario.get(scenario)?.expectedDecision,
      'block',
      `D01 ${scenario}: expected decision is block`,
    );
    equal(
      byScenario.get(scenario)?.event.decision.effectiveDecision,
      'block',
      `D01 ${scenario}: effective decision is fail-closed block`,
    );
  }

  equal(
    byScenario.get('prompt-injection-in-evidence')?.dataFacts.instructionLikeEvidence,
    true,
    'D01 prompt injection: instruction-like evidence flag is true',
  );
  includes(
    byScenario.get('prompt-injection-in-evidence')?.reasonCodes.join('\n') ?? '',
    'data-export:ignore-evidence-as-instruction',
    'D01 prompt injection: evidence cannot become authority',
  );
}

function testDescriptorDocsAndScriptsStayAligned(): void {
  const descriptor = goldenDataExportShadowFixturesDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-data-export-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-data-export-shadow-fixtures.v1', 'D01 descriptor: version is explicit');
  equal(descriptor.step, 'D01', 'D01 descriptor: step is explicit');
  equal(descriptor.shadowOnly, true, 'D01 descriptor: shadow-only is explicit');
  equal(descriptor.noTargetSystemCalls, true, 'D01 descriptor: target-system calls are forbidden');
  equal(descriptor.noRawSql, true, 'D01 descriptor: raw SQL is forbidden');
  equal(descriptor.noRawRows, true, 'D01 descriptor: raw rows are forbidden');
  equal(descriptor.noRawCustomerIdentifiers, true, 'D01 descriptor: raw customer identifiers are forbidden');
  equal(descriptor.productionReady, false, 'D01 descriptor: production readiness is denied');
  ok(descriptor.nonClaims.includes('not-live-data-export'), 'D01 descriptor: live data export is a non-claim');

  for (const expected of [
    'Status: D03 complete. D01-D03 are repository-side only.',
    'Progress after D03 lands: 3/4 complete. 1 step remains.',
    '| D01 | complete | Controlled data export shadow fixture contract |',
    'aggregate-report-release, customer-export-approved, pii-column-narrowing, external-recipient-review, tenant-scope-mismatch, stale-approval, prompt-injection-in-evidence, and write-query-blocked',
  ]) {
    includes(doc, expected, `D01 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Controlled Data Export Golden Path D01',
    'D01 ledger: records the data export fixture contract',
  );
  equal(
    packageJson.scripts['test:golden-data-export-shadow-fixtures'],
    'tsx tests/golden-data-export-shadow-fixtures.test.ts',
    'D01 package script: targeted test is registered',
  );
}

testSuiteShape();
testCanonicalEventsAreDigestOnly();
testScenarioSemantics();
testDescriptorDocsAndScriptsStayAligned();

console.log(`golden-data-export-shadow-fixtures: ${passed} assertions passed`);
