import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenExternalCommunicationShadowFixtureSuite,
  goldenExternalCommunicationShadowFixturesDescriptor,
  GOLDEN_EXTERNAL_COMMUNICATION_SHADOW_FIXTURE_SCENARIOS,
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
  const suite = createGoldenExternalCommunicationShadowFixtureSuite();

  equal(suite.version, 'attestor.golden-external-communication-shadow-fixtures.v1', 'E01 fixtures: version is explicit');
  equal(suite.name, 'Golden Path: External Communication', 'E01 fixtures: suite is bound to the external communication golden path');
  equal(suite.step, 'E01', 'E01 fixtures: step is explicit');
  equal(suite.fixtureCount, 8, 'E01 fixtures: exactly eight scenarios are emitted');
  deepEqual(
    suite.scenarios,
    GOLDEN_EXTERNAL_COMMUNICATION_SHADOW_FIXTURE_SCENARIOS,
    'E01 fixtures: scenarios match the canonical list',
  );
  equal(suite.shadowOnly, true, 'E01 fixtures: suite is shadow-only');
  equal(suite.noTargetSystemCalls, true, 'E01 fixtures: suite performs no target-system calls');
  equal(suite.noRawPayload, true, 'E01 fixtures: suite carries no raw payload');
  equal(suite.noRawMessageBody, true, 'E01 fixtures: suite carries no raw message body');
  equal(suite.noRawRecipientIdentifiers, true, 'E01 fixtures: suite carries no raw recipient identifiers');
  equal(suite.noRawCustomerIdentifiers, true, 'E01 fixtures: suite carries no raw customer identifiers');
  equal(suite.autoEnforce, false, 'E01 fixtures: suite cannot auto-enforce');
  equal(suite.productionReady, false, 'E01 fixtures: suite is not production-ready');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.digest), 'E01 fixtures: suite digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.sourceRecipeRefDigest), 'E01 fixtures: source recipe ref is digest-bound');
  ok(/^sha256:[a-f0-9]{64}$/u.test(suite.actionSurfaceRefDigest), 'E01 fixtures: action surface ref is digest-bound');
}

function testCanonicalEventsAreDigestOnly(): void {
  const suite = createGoldenExternalCommunicationShadowFixtureSuite();
  const serialized = JSON.stringify(suite);

  for (const fixture of suite.fixtures) {
    equal(fixture.fixtureOnly, true, `E01 ${fixture.scenario}: fixture-only flag is true`);
    equal(fixture.synthetic, true, `E01 ${fixture.scenario}: synthetic flag is true`);
    equal(fixture.shadowOnly, true, `E01 ${fixture.scenario}: shadow-only flag is true`);
    equal(fixture.noTargetSystemCall, true, `E01 ${fixture.scenario}: no target-system call flag is true`);
    equal(fixture.noRawPayload, true, `E01 ${fixture.scenario}: no raw payload flag is true`);
    equal(fixture.noRawMessageBody, true, `E01 ${fixture.scenario}: no raw message body flag is true`);
    equal(fixture.noRawRecipientIdentifiers, true, `E01 ${fixture.scenario}: no raw recipient identifier flag is true`);
    equal(fixture.noRawCustomerIdentifiers, true, `E01 ${fixture.scenario}: no raw customer identifier flag is true`);
    equal(fixture.autoEnforce, false, `E01 ${fixture.scenario}: cannot auto-enforce`);
    equal(fixture.productionReady, false, `E01 ${fixture.scenario}: is not production-ready`);
    equal(fixture.event.version, 'attestor.canonical-shadow-event.v1', `E01 ${fixture.scenario}: event is canonical`);
    equal(fixture.event.sourceKind, 'admission-shadow', `E01 ${fixture.scenario}: event source is admission shadow`);
    equal(fixture.event.observed.consequenceClass, 'external-communication', `E01 ${fixture.scenario}: consequence class is external communication`);
    equal(fixture.event.rawPayloadStored, false, `E01 ${fixture.scenario}: raw payload storage is false`);
    equal(fixture.event.autoEnforce, false, `E01 ${fixture.scenario}: event cannot auto-enforce`);
    equal(fixture.event.approvalRequiredForPromotion, true, `E01 ${fixture.scenario}: promotion requires approval`);
    equal(fixture.event.rawMaterialBoundary.rawPayloadStored, false, `E01 ${fixture.scenario}: raw payload boundary is false`);
    equal(fixture.event.rawMaterialBoundary.rawCustomerIdentifierStored, false, `E01 ${fixture.scenario}: raw customer identifier boundary is false`);
    ok(fixture.event.evidenceRefs.length >= 2, `E01 ${fixture.scenario}: evidence refs are present`);
    ok(fixture.event.policyRefs.length === 1, `E01 ${fixture.scenario}: review-only policy ref is present`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.event.digest), `E01 ${fixture.scenario}: event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(fixture.digest), `E01 ${fixture.scenario}: fixture digest is canonical`);
  }

  excludes(serialized, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'E01 fixtures: no raw email address is serialized');
  excludes(serialized, /\b(customer|recipient|account|tenant)[_-]?[0-9]{3,}\b/iu, 'E01 fixtures: no raw customer, recipient, account, or tenant id is serialized');
  excludes(serialized, /rawEmailBody|rawMessageText|messageText|emailAddress|phoneNumber|recipientEmail|subjectLine/iu, 'E01 fixtures: no raw message or recipient fields are serialized');
  excludes(serialized, /system of record|connector implemented|mailbox access|provider payload/iu, 'E01 fixtures: provider/system claims are not serialized as fixture data');
}

function testScenarioSemantics(): void {
  const suite = createGoldenExternalCommunicationShadowFixtureSuite();
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));

  equal(
    byScenario.get('support-reply-approved')?.expectedDecision,
    'admit',
    'E01 support reply: expected decision is admit',
  );
  equal(
    byScenario.get('support-reply-approved')?.event.decision.shadowDecision,
    'would_admit',
    'E01 support reply: shadow decision would admit',
  );

  equal(
    byScenario.get('refund-promise-review')?.expectedDecision,
    'review',
    'E01 refund promise: expected decision is review',
  );
  includes(
    byScenario.get('refund-promise-review')?.reasonCodes.join('\n') ?? '',
    'external-communication:refund-promise-needs-authority',
    'E01 refund promise: authority reason is present',
  );

  for (const scenario of ['legal-claim-blocked', 'wrong-recipient-blocked', 'duplicate-send-replay-blocked'] as const) {
    equal(
      byScenario.get(scenario)?.expectedDecision,
      'block',
      `E01 ${scenario}: expected decision is block`,
    );
    equal(
      byScenario.get(scenario)?.event.decision.effectiveDecision,
      'block',
      `E01 ${scenario}: effective decision is fail-closed block`,
    );
  }

  equal(
    byScenario.get('public-overclaim-narrowing')?.expectedDecision,
    'narrow',
    'E01 public overclaim: expected decision is narrow',
  );
  includes(
    byScenario.get('public-overclaim-narrowing')?.expectedSignals.join('\n') ?? '',
    'narrow-to-repo-evidence',
    'E01 public overclaim: repo-evidence narrowing signal is present',
  );

  equal(
    byScenario.get('commercial-email-control-gap')?.messageFacts.commercialEmailPosture,
    'missing-unsubscribe-or-sender-controls',
    'E01 commercial email: control gap posture is explicit',
  );
  includes(
    byScenario.get('commercial-email-control-gap')?.reasonCodes.join('\n') ?? '',
    'external-communication:commercial-email-control-gap',
    'E01 commercial email: control gap reason is present',
  );

  equal(
    byScenario.get('prompt-injection-in-ticket')?.messageFacts.instructionLikeEvidence,
    true,
    'E01 prompt injection: instruction-like evidence flag is true',
  );
  includes(
    byScenario.get('prompt-injection-in-ticket')?.reasonCodes.join('\n') ?? '',
    'external-communication:ignore-evidence-as-instruction',
    'E01 prompt injection: ticket text cannot become authority',
  );
}

function testDescriptorDocsAndScriptsStayAligned(): void {
  const descriptor = goldenExternalCommunicationShadowFixturesDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-external-communication-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-external-communication-shadow-fixtures.v1', 'E01 descriptor: version is explicit');
  equal(descriptor.step, 'E01', 'E01 descriptor: step is explicit');
  equal(descriptor.shadowOnly, true, 'E01 descriptor: shadow-only is explicit');
  equal(descriptor.noTargetSystemCalls, true, 'E01 descriptor: target-system calls are forbidden');
  equal(descriptor.noRawMessageBody, true, 'E01 descriptor: raw message bodies are forbidden');
  equal(descriptor.noRawRecipientIdentifiers, true, 'E01 descriptor: raw recipient identifiers are forbidden');
  equal(descriptor.noRawCustomerIdentifiers, true, 'E01 descriptor: raw customer identifiers are forbidden');
  equal(descriptor.productionReady, false, 'E01 descriptor: production readiness is denied');
  ok(descriptor.nonClaims.includes('not-native-sendgrid-mailgun-or-crm-connector'), 'E01 descriptor: native connector is a non-claim');

  for (const expected of [
    'Status: in progress. E01 is repository-side only and E02 is repository-side',
    '| E01 | complete | External Communication shadow fixture contract |',
    'support-reply-approved, refund-promise-review, legal-claim-blocked, wrong-recipient-blocked, public-overclaim-narrowing, commercial-email-control-gap, prompt-injection-in-ticket, and duplicate-send-replay-blocked',
    'SendGrid',
    'Mailgun',
    'FTC',
  ]) {
    includes(doc, expected, `E01 doc: records ${expected}`);
  }

  includes(
    ledger,
    'External Communication Golden Path E01',
    'E01 ledger: records the external communication fixture contract',
  );
  equal(
    packageJson.scripts['test:golden-external-communication-shadow-fixtures'],
    'tsx tests/golden-external-communication-shadow-fixtures.test.ts',
    'E01 package script: targeted test is registered',
  );
}

testSuiteShape();
testCanonicalEventsAreDigestOnly();
testScenarioSemantics();
testDescriptorDocsAndScriptsStayAligned();

console.log(`golden-external-communication-shadow-fixtures: ${passed} assertions passed`);
