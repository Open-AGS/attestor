import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenAuthorityChangePilotReadinessProbe,
  goldenAuthorityChangePilotReadinessProbeDescriptor,
  runGoldenAuthorityChangeRuntimeSmoke,
  type GoldenAuthorityChangeRuntimeSmokeResult,
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
  const descriptor = goldenAuthorityChangePilotReadinessProbeDescriptor();

  equal(descriptor.version, 'attestor.golden-authority-change-pilot-readiness-probe.v1', 'A03 probe descriptor: version is explicit');
  equal(descriptor.step, 'A03', 'A03 probe descriptor: step is explicit');
  assert.deepEqual(
    descriptor.allowedVerdicts,
    ['ready-for-shadow-pilot', 'not-ready'],
    'A03 probe descriptor: allowed verdicts exclude scoped pilot',
  );
  passed += 1;
  equal(descriptor.scopedPilotVerdictExcluded, true, 'A03 probe descriptor: scoped pilot verdict is excluded');
  equal(descriptor.shadowOnly, true, 'A03 probe descriptor: shadow-only is true');
  equal(descriptor.fixtureOnly, true, 'A03 probe descriptor: fixture-only is true');
  equal(descriptor.previewOnly, true, 'A03 probe descriptor: preview-only is true');
  equal(descriptor.noTargetSystemCall, true, 'A03 probe descriptor: target calls are forbidden');
  equal(descriptor.noIdentityProviderCall, true, 'A03 probe descriptor: identity-provider calls are forbidden');
  equal(descriptor.noAccessChange, true, 'A03 probe descriptor: access changes are forbidden');
  equal(descriptor.noAuditWrite, true, 'A03 probe descriptor: audit writes are forbidden');
  equal(descriptor.noPolicyActivation, true, 'A03 probe descriptor: policy activation is forbidden');
  equal(descriptor.noLearningActivation, true, 'A03 probe descriptor: learning activation is forbidden');
  equal(descriptor.canAdmit, false, 'A03 probe descriptor: cannot admit');
  equal(descriptor.productionReady, false, 'A03 probe descriptor: production readiness is false');
}

function testProbeEmitsOnlyShadowPilotVerdict(): void {
  const result = createGoldenAuthorityChangePilotReadinessProbe();

  equal(result.version, 'attestor.golden-authority-change-pilot-readiness-probe.v1', 'A03 probe result: version is explicit');
  equal(result.step, 'A03', 'A03 probe result: step is explicit');
  equal(result.decision.verdict, 'ready-for-shadow-pilot', 'A03 probe result: default fixture smoke is shadow-pilot ready');
  equal(result.decision.blockers.length, 0, 'A03 probe result: default fixture smoke has no blockers');
  equal(result.pilotReadinessPacket.decision.verdict, 'ready-for-shadow-pilot', 'A03 probe result: packet verdict is shadow-pilot ready');
  equal(result.pilotReadinessPacket.stage, 'shadow-entry', 'A03 probe result: packet stage is shadow-entry');
  equal(result.pilotReadinessPacket.rolloutMode, 'shadow-only', 'A03 probe result: rollout mode is shadow-only');
  equal(result.scopedPilotVerdictExcluded, true, 'A03 probe result: scoped pilot verdict is excluded');
  ok(!result.allowedVerdicts.includes('ready-for-scoped-pilot' as never), 'A03 probe result: allowed verdicts omit ready-for-scoped-pilot');
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.digest), 'A03 probe result: digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.pilotReadinessPacketDigest), 'A03 probe result: packet digest is canonical');
}

function testProbePreservesNoClaimBoundary(): void {
  const result = createGoldenAuthorityChangePilotReadinessProbe();

  equal(result.shadowOnly, true, 'A03 probe result: shadow-only is true');
  equal(result.fixtureOnly, true, 'A03 probe result: fixture-only is true');
  equal(result.previewOnly, true, 'A03 probe result: preview-only is true');
  equal(result.deterministicReplay, true, 'A03 probe result: deterministic replay is true');
  equal(result.noTargetSystemCall, true, 'A03 probe result: target-system call is forbidden');
  equal(result.noIdentityProviderCall, true, 'A03 probe result: identity-provider call is forbidden');
  equal(result.noAccessChange, true, 'A03 probe result: access change is forbidden');
  equal(result.noAuditWrite, true, 'A03 probe result: audit write is forbidden');
  equal(result.noExternalEventBus, true, 'A03 probe result: external event bus is forbidden');
  equal(result.noExternalTraceExport, true, 'A03 probe result: external trace export is forbidden');
  equal(result.noExternalLineageExport, true, 'A03 probe result: external lineage export is forbidden');
  equal(result.noPolicyActivation, true, 'A03 probe result: policy activation is forbidden');
  equal(result.noLearningActivation, true, 'A03 probe result: learning activation is forbidden');
  equal(result.noTrainingActivation, true, 'A03 probe result: training activation is forbidden');
  equal(result.grantsAuthority, false, 'A03 probe result: grants authority is false');
  equal(result.canAdmit, false, 'A03 probe result: cannot admit');
  equal(result.activatesEnforcement, false, 'A03 probe result: cannot activate enforcement');
  equal(result.autoEnforce, false, 'A03 probe result: auto enforcement is false');
  equal(result.rawPayloadRead, false, 'A03 probe result: raw payload read is false');
  equal(result.rawPayloadStored, false, 'A03 probe result: raw payload stored is false');
  equal(result.rawIdentityAttributesRead, false, 'A03 probe result: raw identity attributes read is false');
  equal(result.rawIdentityAttributesStored, false, 'A03 probe result: raw identity attributes stored is false');
  equal(result.productionReady, false, 'A03 probe result: production readiness is false');
  equal(result.pilotReadinessPacket.productionReady, false, 'A03 packet: production readiness is false');
  equal(result.pilotReadinessPacket.customerDeploymentProven, false, 'A03 packet: customer deployment proof is false');
  equal(result.pilotReadinessPacket.nativeConnectorCoverage, false, 'A03 packet: native connector coverage is false');
}

function testProbeFailsClosedOnRuntimeSmokeRisk(): void {
  const smoke = runGoldenAuthorityChangeRuntimeSmoke();
  const tampered = {
    ...smoke,
    allScenariosCompleted: false,
    noTargetSystemCall: false,
    noIdentityProviderCall: false,
    noAccessChange: false,
  } as unknown as GoldenAuthorityChangeRuntimeSmokeResult;
  const result = createGoldenAuthorityChangePilotReadinessProbe(tampered);

  equal(result.decision.verdict, 'not-ready', 'A03 probe result: tampered smoke is not ready');
  ok(
    result.decision.blockers.includes('golden-authority-change-runtime-smoke-incomplete'),
    'A03 probe result: incomplete smoke blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('golden-authority-change-runtime-smoke-target-system-call-risk'),
    'A03 probe result: target call risk blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('golden-authority-change-runtime-smoke-identity-provider-call-risk'),
    'A03 probe result: identity provider call risk blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('non-claim-boundary:pilot-non-claims-not-accepted'),
    'A03 probe result: packet non-claim blocker is recorded when source smoke is unsafe',
  );
}

function testDeterminismAndDataMinimization(): void {
  const first = createGoldenAuthorityChangePilotReadinessProbe();
  const second = createGoldenAuthorityChangePilotReadinessProbe();
  const serialized = JSON.stringify(first);

  equal(first.digest, second.digest, 'A03 probe: full digest is deterministic');
  equal(first.pilotReadinessPacketDigest, second.pilotReadinessPacketDigest, 'A03 probe: packet digest is deterministic');
  excludes(serialized, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'A03 probe: no raw email address is serialized');
  excludes(serialized, /\b(user|employee|account|tenant)[_-]?[0-9]{3,}\b/iu, 'A03 probe: no raw user, account, or tenant id is serialized');
  excludes(serialized, /firstName|lastName|displayName|phoneNumber|streetAddress|rawSubject|rawPrincipal/iu, 'A03 probe: no raw identity attribute fields are serialized');
  excludes(serialized, /"providerBody"\s*:|"identityProviderPayload"\s*:|"systemOfRecordPayload"\s*:/iu, 'A03 probe: no raw identity-provider material is serialized');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-authority-change-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: complete. A01-A04 are repository-side only.',
    'Progress after A04 lands: 4/4 complete. 0 steps remain.',
    '| A03 | complete | Runtime smoke and pilot readiness |',
    'ready-for-shadow-pilot',
    'not-ready',
    'ready-for-scoped-pilot` is outside A03',
  ]) {
    includes(doc, expected, `A03 probe doc: records ${expected}`);
  }

  includes(
    ledger,
    'Authority Change Golden Path A03',
    'A03 ledger: records pilot readiness probe',
  );
  equal(
    packageJson.scripts['test:golden-authority-change-pilot-readiness-probe'],
    'tsx tests/golden-authority-change-pilot-readiness-probe.test.ts',
    'A03 probe package script: targeted test is registered',
  );
}

testDescriptor();
testProbeEmitsOnlyShadowPilotVerdict();
testProbePreservesNoClaimBoundary();
testProbeFailsClosedOnRuntimeSmokeRisk();
testDeterminismAndDataMinimization();
testDocsAndScriptsStayAligned();

console.log(`golden-authority-change-pilot-readiness-probe: ${passed} assertions passed`);
