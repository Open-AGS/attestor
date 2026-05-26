import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenExternalCommunicationPilotReadinessProbe,
  goldenExternalCommunicationPilotReadinessProbeDescriptor,
  runGoldenExternalCommunicationRuntimeSmoke,
  type GoldenExternalCommunicationRuntimeSmokeResult,
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
  const descriptor = goldenExternalCommunicationPilotReadinessProbeDescriptor();

  equal(descriptor.version, 'attestor.golden-external-communication-pilot-readiness-probe.v1', 'E03 probe descriptor: version is explicit');
  equal(descriptor.step, 'E03', 'E03 probe descriptor: step is explicit');
  assert.deepEqual(
    descriptor.allowedVerdicts,
    ['ready-for-shadow-pilot', 'not-ready'],
    'E03 probe descriptor: allowed verdicts exclude scoped pilot',
  );
  passed += 1;
  equal(descriptor.scopedPilotVerdictExcluded, true, 'E03 probe descriptor: scoped pilot verdict is excluded');
  equal(descriptor.shadowOnly, true, 'E03 probe descriptor: shadow-only is true');
  equal(descriptor.fixtureOnly, true, 'E03 probe descriptor: fixture-only is true');
  equal(descriptor.previewOnly, true, 'E03 probe descriptor: preview-only is true');
  equal(descriptor.noTargetSystemCall, true, 'E03 probe descriptor: target calls are forbidden');
  equal(descriptor.noMessageDelivery, true, 'E03 probe descriptor: message delivery is forbidden');
  equal(descriptor.noProviderCall, true, 'E03 probe descriptor: provider calls are forbidden');
  equal(descriptor.noCrmOrTicketingCall, true, 'E03 probe descriptor: CRM/ticketing calls are forbidden');
  equal(descriptor.noAuditWrite, true, 'E03 probe descriptor: audit writes are forbidden');
  equal(descriptor.noPolicyActivation, true, 'E03 probe descriptor: policy activation is forbidden');
  equal(descriptor.noLearningActivation, true, 'E03 probe descriptor: learning activation is forbidden');
  equal(descriptor.canAdmit, false, 'E03 probe descriptor: cannot admit');
  equal(descriptor.productionReady, false, 'E03 probe descriptor: production readiness is false');
}

function testProbeEmitsOnlyShadowPilotVerdict(): void {
  const result = createGoldenExternalCommunicationPilotReadinessProbe();

  equal(result.version, 'attestor.golden-external-communication-pilot-readiness-probe.v1', 'E03 probe result: version is explicit');
  equal(result.step, 'E03', 'E03 probe result: step is explicit');
  equal(result.decision.verdict, 'ready-for-shadow-pilot', 'E03 probe result: default fixture smoke is shadow-pilot ready');
  equal(result.decision.blockers.length, 0, 'E03 probe result: default fixture smoke has no blockers');
  equal(result.pilotReadinessPacket.decision.verdict, 'ready-for-shadow-pilot', 'E03 probe result: packet verdict is shadow-pilot ready');
  equal(result.pilotReadinessPacket.stage, 'shadow-entry', 'E03 probe result: packet stage is shadow-entry');
  equal(result.pilotReadinessPacket.rolloutMode, 'shadow-only', 'E03 probe result: rollout mode is shadow-only');
  equal(result.scopedPilotVerdictExcluded, true, 'E03 probe result: scoped pilot verdict is excluded');
  ok(!result.allowedVerdicts.includes('ready-for-scoped-pilot' as never), 'E03 probe result: allowed verdicts omit ready-for-scoped-pilot');
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.digest), 'E03 probe result: digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.pilotReadinessPacketDigest), 'E03 probe result: packet digest is canonical');
}

function testProbePreservesNoClaimBoundary(): void {
  const result = createGoldenExternalCommunicationPilotReadinessProbe();

  equal(result.shadowOnly, true, 'E03 probe result: shadow-only is true');
  equal(result.fixtureOnly, true, 'E03 probe result: fixture-only is true');
  equal(result.previewOnly, true, 'E03 probe result: preview-only is true');
  equal(result.deterministicReplay, true, 'E03 probe result: deterministic replay is true');
  equal(result.noTargetSystemCall, true, 'E03 probe result: target-system call is forbidden');
  equal(result.noMessageDelivery, true, 'E03 probe result: message delivery is forbidden');
  equal(result.noProviderCall, true, 'E03 probe result: provider call is forbidden');
  equal(result.noCrmOrTicketingCall, true, 'E03 probe result: CRM/ticketing call is forbidden');
  equal(result.noAuditWrite, true, 'E03 probe result: audit write is forbidden');
  equal(result.noExternalEventBus, true, 'E03 probe result: external event bus is forbidden');
  equal(result.noExternalTraceExport, true, 'E03 probe result: external trace export is forbidden');
  equal(result.noExternalLineageExport, true, 'E03 probe result: external lineage export is forbidden');
  equal(result.noPolicyActivation, true, 'E03 probe result: policy activation is forbidden');
  equal(result.noLearningActivation, true, 'E03 probe result: learning activation is forbidden');
  equal(result.noTrainingActivation, true, 'E03 probe result: training activation is forbidden');
  equal(result.grantsAuthority, false, 'E03 probe result: grants authority is false');
  equal(result.canAdmit, false, 'E03 probe result: cannot admit');
  equal(result.activatesEnforcement, false, 'E03 probe result: cannot activate enforcement');
  equal(result.autoEnforce, false, 'E03 probe result: auto enforcement is false');
  equal(result.rawPayloadRead, false, 'E03 probe result: raw payload read is false');
  equal(result.rawPayloadStored, false, 'E03 probe result: raw payload stored is false');
  equal(result.rawMessageBodyRead, false, 'E03 probe result: raw message body read is false');
  equal(result.rawMessageBodyStored, false, 'E03 probe result: raw message body stored is false');
  equal(result.rawRecipientIdentifiersRead, false, 'E03 probe result: raw recipient identifiers read is false');
  equal(result.rawRecipientIdentifiersStored, false, 'E03 probe result: raw recipient identifiers stored is false');
  equal(result.rawCustomerIdentifiersRead, false, 'E03 probe result: raw customer identifiers read is false');
  equal(result.rawCustomerIdentifiersStored, false, 'E03 probe result: raw customer identifiers stored is false');
  equal(result.productionReady, false, 'E03 probe result: production readiness is false');
  equal(result.pilotReadinessPacket.productionReady, false, 'E03 packet: production readiness is false');
  equal(result.pilotReadinessPacket.customerDeploymentProven, false, 'E03 packet: customer deployment proof is false');
  equal(result.pilotReadinessPacket.nativeConnectorCoverage, false, 'E03 packet: native connector coverage is false');
}

function testProbeFailsClosedOnRuntimeSmokeRisk(): void {
  const smoke = runGoldenExternalCommunicationRuntimeSmoke();
  const tampered = {
    ...smoke,
    allScenariosCompleted: false,
    noTargetSystemCall: false,
    noMessageDelivery: false,
    noProviderCall: false,
    noCrmOrTicketingCall: false,
  } as unknown as GoldenExternalCommunicationRuntimeSmokeResult;
  const result = createGoldenExternalCommunicationPilotReadinessProbe(tampered);

  equal(result.decision.verdict, 'not-ready', 'E03 probe result: tampered smoke is not ready');
  ok(
    result.decision.blockers.includes('golden-external-communication-runtime-smoke-incomplete'),
    'E03 probe result: incomplete smoke blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('golden-external-communication-runtime-smoke-target-system-call-risk'),
    'E03 probe result: target call risk blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('golden-external-communication-runtime-smoke-message-delivery-risk'),
    'E03 probe result: message delivery risk blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('non-claim-boundary:pilot-non-claims-not-accepted'),
    'E03 probe result: packet non-claim blocker is recorded when source smoke is unsafe',
  );
}

function testDeterminismAndDataMinimization(): void {
  const first = createGoldenExternalCommunicationPilotReadinessProbe();
  const second = createGoldenExternalCommunicationPilotReadinessProbe();
  const serialized = JSON.stringify(first);

  equal(first.digest, second.digest, 'E03 probe: full digest is deterministic');
  equal(first.pilotReadinessPacketDigest, second.pilotReadinessPacketDigest, 'E03 probe: packet digest is deterministic');
  excludes(serialized, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'E03 probe: no raw email address is serialized');
  excludes(serialized, /\b(customer|recipient|account|tenant)[_-]?[0-9]{3,}\b/iu, 'E03 probe: no raw customer, recipient, account, or tenant id is serialized');
  excludes(serialized, /rawEmailBody|rawMessageText|messageText|emailAddress|phoneNumber|recipientEmail|subjectLine/iu, 'E03 probe: no raw message or recipient fields are serialized');
  excludes(serialized, /"providerBody"\s*:|"mailgunPayload"\s*:|"sendgridPayload"\s*:|"crmPayload"\s*:|"ticketBody"\s*:/iu, 'E03 probe: no raw provider or ticket material is serialized');
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
    'ready-for-shadow-pilot',
    'not-ready',
    'ready-for-scoped-pilot` is outside E03',
  ]) {
    includes(doc, expected, `E03 probe doc: records ${expected}`);
  }

  includes(
    ledger,
    'External Communication Golden Path E03',
    'E03 ledger: records pilot readiness probe',
  );
  equal(
    packageJson.scripts['test:golden-external-communication-pilot-readiness-probe'],
    'tsx tests/golden-external-communication-pilot-readiness-probe.test.ts',
    'E03 probe package script: targeted test is registered',
  );
}

testDescriptor();
testProbeEmitsOnlyShadowPilotVerdict();
testProbePreservesNoClaimBoundary();
testProbeFailsClosedOnRuntimeSmokeRisk();
testDeterminismAndDataMinimization();
testDocsAndScriptsStayAligned();

console.log(`golden-external-communication-pilot-readiness-probe: ${passed} assertions passed`);
