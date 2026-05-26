import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  goldenExternalCommunicationRuntimeSmokeDescriptor,
  runGoldenExternalCommunicationRuntimeSmoke,
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
  const descriptor = goldenExternalCommunicationRuntimeSmokeDescriptor();

  equal(descriptor.version, 'attestor.golden-external-communication-runtime-smoke.v1', 'E03 runtime descriptor: version is explicit');
  equal(descriptor.step, 'E03', 'E03 runtime descriptor: step is explicit');
  equal(descriptor.scenarioCount, 8, 'E03 runtime descriptor: scenario count is fixed');
  equal(descriptor.runsE01FixturesThroughR02ToR07, true, 'E03 runtime descriptor: runs E01 through R02-R07');
  equal(descriptor.executionMode, 'shadow-only', 'E03 runtime descriptor: execution mode is shadow-only');
  equal(descriptor.fixtureOnly, true, 'E03 runtime descriptor: fixture-only is true');
  equal(descriptor.deterministicReplay, true, 'E03 runtime descriptor: deterministic replay is true');
  equal(descriptor.noTargetSystemCall, true, 'E03 runtime descriptor: target-system calls are forbidden');
  equal(descriptor.noMessageDelivery, true, 'E03 runtime descriptor: message delivery is forbidden');
  equal(descriptor.noProviderCall, true, 'E03 runtime descriptor: provider calls are forbidden');
  equal(descriptor.noCrmOrTicketingCall, true, 'E03 runtime descriptor: CRM/ticketing calls are forbidden');
  equal(descriptor.noAuditWrite, true, 'E03 runtime descriptor: audit writes are forbidden');
  equal(descriptor.noPolicyActivation, true, 'E03 runtime descriptor: policy activation is forbidden');
  equal(descriptor.noLearningActivation, true, 'E03 runtime descriptor: learning activation is forbidden');
  equal(descriptor.canAdmit, false, 'E03 runtime descriptor: cannot admit');
  equal(descriptor.productionReady, false, 'E03 runtime descriptor: production readiness is false');
}

function testRuntimeSmokeRunsAllScenarios(): void {
  const result = runGoldenExternalCommunicationRuntimeSmoke();
  const scenarios = result.scenarioResults.map((item) => item.scenario).sort();

  equal(result.version, 'attestor.golden-external-communication-runtime-smoke.v1', 'E03 runtime result: version is explicit');
  equal(result.step, 'E03', 'E03 runtime result: step is explicit');
  equal(result.scenarioCount, 8, 'E03 runtime result: scenario count is fixed');
  equal(result.smokeResults.length, 8, 'E03 runtime result: eight smoke results are emitted');
  equal(result.phaseDigests.length, 8, 'E03 runtime result: one phase digest per scenario is retained');
  equal(result.allScenariosCompleted, true, 'E03 runtime result: all scenarios completed');
  equal(result.executionMode, 'shadow-only', 'E03 runtime result: execution mode is shadow-only');
  equal(result.fixtureOnly, true, 'E03 runtime result: fixture-only is true');
  equal(result.deterministicReplay, true, 'E03 runtime result: deterministic replay is true');
  equal(result.noTargetSystemCall, true, 'E03 runtime result: target-system calls are forbidden');
  equal(result.noMessageDelivery, true, 'E03 runtime result: message delivery is forbidden');
  equal(result.noProviderCall, true, 'E03 runtime result: provider calls are forbidden');
  equal(result.noCrmOrTicketingCall, true, 'E03 runtime result: CRM/ticketing calls are forbidden');
  equal(result.noAuditWrite, true, 'E03 runtime result: audit writes are forbidden');
  equal(result.noExternalEventBus, true, 'E03 runtime result: external event bus is forbidden');
  equal(result.noExternalTraceExport, true, 'E03 runtime result: external trace export is forbidden');
  equal(result.noExternalLineageExport, true, 'E03 runtime result: external lineage export is forbidden');
  equal(result.noPolicyActivation, true, 'E03 runtime result: policy activation is forbidden');
  equal(result.noLearningActivation, true, 'E03 runtime result: learning activation is forbidden');
  equal(result.noTrainingActivation, true, 'E03 runtime result: training activation is forbidden');
  equal(result.grantsAuthority, false, 'E03 runtime result: grants authority is false');
  equal(result.canAdmit, false, 'E03 runtime result: cannot admit');
  equal(result.activatesEnforcement, false, 'E03 runtime result: cannot activate enforcement');
  equal(result.autoEnforce, false, 'E03 runtime result: auto enforcement is false');
  equal(result.rawPayloadRead, false, 'E03 runtime result: raw payload read is false');
  equal(result.rawPayloadStored, false, 'E03 runtime result: raw payload stored is false');
  equal(result.rawMessageBodyRead, false, 'E03 runtime result: raw message body read is false');
  equal(result.rawMessageBodyStored, false, 'E03 runtime result: raw message body stored is false');
  equal(result.rawRecipientIdentifiersRead, false, 'E03 runtime result: raw recipient identifiers read is false');
  equal(result.rawRecipientIdentifiersStored, false, 'E03 runtime result: raw recipient identifiers stored is false');
  equal(result.rawCustomerIdentifiersRead, false, 'E03 runtime result: raw customer identifiers read is false');
  equal(result.rawCustomerIdentifiersStored, false, 'E03 runtime result: raw customer identifiers stored is false');
  equal(result.productionReady, false, 'E03 runtime result: production readiness is false');
  assert.deepEqual(
    scenarios,
    [
      'commercial-email-control-gap',
      'duplicate-send-replay-blocked',
      'legal-claim-blocked',
      'prompt-injection-in-ticket',
      'public-overclaim-narrowing',
      'refund-promise-review',
      'support-reply-approved',
      'wrong-recipient-blocked',
    ],
    'E03 runtime result: all E01 scenarios are represented',
  );
  passed += 1;
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.digest), 'E03 runtime result: digest is canonical');
}

function testEachScenarioBindsRuntimeArtifacts(): void {
  const result = runGoldenExternalCommunicationRuntimeSmoke();

  for (const scenario of result.scenarioResults) {
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.fixtureDigest), `E03 ${scenario.scenario}: fixture digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.sourceEventDigest), `E03 ${scenario.scenario}: source event digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.smokeDigest), `E03 ${scenario.scenario}: smoke digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.envelopeRefDigest), `E03 ${scenario.scenario}: envelope digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.assurancePacketDigest), `E03 ${scenario.scenario}: assurance packet digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalAssuranceCaseDigest), `E03 ${scenario.scenario}: assurance case digest is canonical`);
    ok(/^sha256:[a-f0-9]{64}$/u.test(scenario.finalLineageGraphDigest), `E03 ${scenario.scenario}: lineage digest is canonical`);
    equal(scenario.noTargetSystemCall, true, `E03 ${scenario.scenario}: no target-system call`);
    equal(scenario.noMessageDelivery, true, `E03 ${scenario.scenario}: no message delivery`);
    equal(scenario.noProviderCall, true, `E03 ${scenario.scenario}: no provider call`);
    equal(scenario.noCrmOrTicketingCall, true, `E03 ${scenario.scenario}: no CRM/ticketing call`);
    equal(scenario.noAuditWrite, true, `E03 ${scenario.scenario}: no audit write`);
    equal(scenario.noPolicyActivation, true, `E03 ${scenario.scenario}: no policy activation`);
    equal(scenario.noLearningActivation, true, `E03 ${scenario.scenario}: no learning activation`);
    equal(scenario.canAdmit, false, `E03 ${scenario.scenario}: cannot admit`);
    equal(scenario.productionReady, false, `E03 ${scenario.scenario}: production readiness is false`);
  }
}

function testDeterminismAndDataMinimization(): void {
  const first = runGoldenExternalCommunicationRuntimeSmoke();
  const second = runGoldenExternalCommunicationRuntimeSmoke();
  const serialized = JSON.stringify(first);

  equal(first.digest, second.digest, 'E03 runtime smoke: full digest is deterministic');
  equal(first.phaseDigests.join('\n'), second.phaseDigests.join('\n'), 'E03 runtime smoke: phase digests are deterministic');
  excludes(serialized, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'E03 runtime smoke: no raw email address is serialized');
  excludes(serialized, /\b(customer|recipient|account|tenant)[_-]?[0-9]{3,}\b/iu, 'E03 runtime smoke: no raw customer, recipient, account, or tenant id is serialized');
  excludes(serialized, /rawEmailBody|rawMessageText|messageText|emailAddress|phoneNumber|recipientEmail|subjectLine/iu, 'E03 runtime smoke: no raw message or recipient fields are serialized');
  excludes(serialized, /"providerBody"\s*:|"mailgunPayload"\s*:|"sendgridPayload"\s*:|"crmPayload"\s*:|"ticketBody"\s*:/iu, 'E03 runtime smoke: no raw provider or ticket material is serialized');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-external-communication-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Progress after E04 lands: 4/4 complete. 0 steps remain.',
    '| E03 | complete | Runtime smoke and pilot readiness |',
    'R02-R07 shadow runtime smoke chain',
    'ready-for-shadow-pilot',
    'no provider call, no CRM/ticketing call, and no message delivery',
  ]) {
    includes(doc, expected, `E03 doc: records ${expected}`);
  }

  includes(
    ledger,
    'External Communication Golden Path E03',
    'E03 ledger: records runtime smoke and pilot readiness',
  );
  equal(
    packageJson.scripts['test:golden-external-communication-runtime-smoke'],
    'tsx tests/golden-external-communication-runtime-smoke.test.ts',
    'E03 runtime package script: targeted test is registered',
  );
}

testDescriptor();
testRuntimeSmokeRunsAllScenarios();
testEachScenarioBindsRuntimeArtifacts();
testDeterminismAndDataMinimization();
testDocsAndScriptsStayAligned();

console.log(`golden-external-communication-runtime-smoke: ${passed} assertions passed`);
