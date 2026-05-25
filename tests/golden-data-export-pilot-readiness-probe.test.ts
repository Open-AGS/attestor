import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenDataExportPilotReadinessProbe,
  goldenDataExportPilotReadinessProbeDescriptor,
  runGoldenDataExportRuntimeSmoke,
  type GoldenDataExportRuntimeSmokeResult,
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
  const descriptor = goldenDataExportPilotReadinessProbeDescriptor();

  equal(descriptor.version, 'attestor.golden-data-export-pilot-readiness-probe.v1', 'D03 probe descriptor: version is explicit');
  equal(descriptor.step, 'D03', 'D03 probe descriptor: step is explicit');
  assert.deepEqual(
    descriptor.allowedVerdicts,
    ['ready-for-shadow-pilot', 'not-ready'],
    'D03 probe descriptor: allowed verdicts exclude scoped pilot',
  );
  passed += 1;
  equal(descriptor.scopedPilotVerdictExcluded, true, 'D03 probe descriptor: scoped pilot verdict is excluded');
  equal(descriptor.shadowOnly, true, 'D03 probe descriptor: shadow-only is true');
  equal(descriptor.fixtureOnly, true, 'D03 probe descriptor: fixture-only is true');
  equal(descriptor.previewOnly, true, 'D03 probe descriptor: preview-only is true');
  equal(descriptor.noTargetSystemCall, true, 'D03 probe descriptor: target calls are forbidden');
  equal(descriptor.noAuditWrite, true, 'D03 probe descriptor: audit writes are forbidden');
  equal(descriptor.noPolicyActivation, true, 'D03 probe descriptor: policy activation is forbidden');
  equal(descriptor.noLearningActivation, true, 'D03 probe descriptor: learning activation is forbidden');
  equal(descriptor.canAdmit, false, 'D03 probe descriptor: cannot admit');
  equal(descriptor.productionReady, false, 'D03 probe descriptor: production readiness is false');
}

function testProbeEmitsOnlyShadowPilotVerdict(): void {
  const result = createGoldenDataExportPilotReadinessProbe();

  equal(result.version, 'attestor.golden-data-export-pilot-readiness-probe.v1', 'D03 probe result: version is explicit');
  equal(result.step, 'D03', 'D03 probe result: step is explicit');
  equal(result.decision.verdict, 'ready-for-shadow-pilot', 'D03 probe result: default fixture smoke is shadow-pilot ready');
  equal(result.decision.blockers.length, 0, 'D03 probe result: default fixture smoke has no blockers');
  equal(result.pilotReadinessPacket.decision.verdict, 'ready-for-shadow-pilot', 'D03 probe result: packet verdict is shadow-pilot ready');
  equal(result.pilotReadinessPacket.stage, 'shadow-entry', 'D03 probe result: packet stage is shadow-entry');
  equal(result.pilotReadinessPacket.rolloutMode, 'shadow-only', 'D03 probe result: rollout mode is shadow-only');
  equal(result.scopedPilotVerdictExcluded, true, 'D03 probe result: scoped pilot verdict is excluded');
  ok(!result.allowedVerdicts.includes('ready-for-scoped-pilot' as never), 'D03 probe result: allowed verdicts omit ready-for-scoped-pilot');
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.digest), 'D03 probe result: digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.pilotReadinessPacketDigest), 'D03 probe result: packet digest is canonical');
}

function testProbePreservesNoClaimBoundary(): void {
  const result = createGoldenDataExportPilotReadinessProbe();

  equal(result.shadowOnly, true, 'D03 probe result: shadow-only is true');
  equal(result.fixtureOnly, true, 'D03 probe result: fixture-only is true');
  equal(result.previewOnly, true, 'D03 probe result: preview-only is true');
  equal(result.deterministicReplay, true, 'D03 probe result: deterministic replay is true');
  equal(result.noTargetSystemCall, true, 'D03 probe result: target-system call is forbidden');
  equal(result.noAuditWrite, true, 'D03 probe result: audit write is forbidden');
  equal(result.noExternalEventBus, true, 'D03 probe result: external event bus is forbidden');
  equal(result.noExternalTraceExport, true, 'D03 probe result: external trace export is forbidden');
  equal(result.noExternalLineageExport, true, 'D03 probe result: external lineage export is forbidden');
  equal(result.noPolicyActivation, true, 'D03 probe result: policy activation is forbidden');
  equal(result.noLearningActivation, true, 'D03 probe result: learning activation is forbidden');
  equal(result.noTrainingActivation, true, 'D03 probe result: training activation is forbidden');
  equal(result.grantsAuthority, false, 'D03 probe result: grants authority is false');
  equal(result.canAdmit, false, 'D03 probe result: cannot admit');
  equal(result.activatesEnforcement, false, 'D03 probe result: cannot activate enforcement');
  equal(result.autoEnforce, false, 'D03 probe result: auto enforcement is false');
  equal(result.rawPayloadRead, false, 'D03 probe result: raw payload read is false');
  equal(result.rawPayloadStored, false, 'D03 probe result: raw payload stored is false');
  equal(result.productionReady, false, 'D03 probe result: production readiness is false');
  equal(result.pilotReadinessPacket.productionReady, false, 'D03 packet: production readiness is false');
  equal(result.pilotReadinessPacket.customerDeploymentProven, false, 'D03 packet: customer deployment proof is false');
  equal(result.pilotReadinessPacket.nativeConnectorCoverage, false, 'D03 packet: native connector coverage is false');
}

function testProbeFailsClosedOnRuntimeSmokeRisk(): void {
  const smoke = runGoldenDataExportRuntimeSmoke();
  const tampered = {
    ...smoke,
    allScenariosCompleted: false,
    noTargetSystemCall: false,
  } as unknown as GoldenDataExportRuntimeSmokeResult;
  const result = createGoldenDataExportPilotReadinessProbe(tampered);

  equal(result.decision.verdict, 'not-ready', 'D03 probe result: tampered smoke is not ready');
  ok(
    result.decision.blockers.includes('golden-data-export-runtime-smoke-incomplete'),
    'D03 probe result: incomplete smoke blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('golden-data-export-runtime-smoke-target-system-call-risk'),
    'D03 probe result: target call risk blocker is recorded',
  );
  ok(
    result.decision.blockers.includes('non-claim-boundary:pilot-non-claims-not-accepted'),
    'D03 probe result: packet non-claim blocker is recorded when source smoke is unsafe',
  );
}

function testDeterminismAndDataMinimization(): void {
  const first = createGoldenDataExportPilotReadinessProbe();
  const second = createGoldenDataExportPilotReadinessProbe();
  const serialized = JSON.stringify(first);

  equal(first.digest, second.digest, 'D03 probe: full digest is deterministic');
  equal(first.pilotReadinessPacketDigest, second.pilotReadinessPacketDigest, 'D03 probe: packet digest is deterministic');
  excludes(serialized, /\bSELECT\s+.+\bFROM\b|\bUPDATE\s+\S+\s+SET\b|\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|\bMERGE\s+INTO\b/iu, 'D03 probe: no raw SQL statement is serialized');
  excludes(serialized, /\b(email|customerEmail|customerName|accountNumber|ssn|phoneNumber)\b/iu, 'D03 probe: no raw customer fields are serialized');
  excludes(serialized, /\bcus_[a-zA-Z0-9_]+|\btenant_[a-zA-Z0-9_]+|\buser_[a-zA-Z0-9_]+/u, 'D03 probe: no raw customer, tenant, or user identifiers are serialized');
  excludes(serialized, /"rowPayload"\s*:|"rawRows"\s*:|"providerBody"\s*:|"warehouseStatement"\s*:/iu, 'D03 probe: no raw data export material fields are serialized');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-data-export-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: D03 complete. D01-D03 are repository-side only.',
    'Progress after D03 lands: 3/4 complete. 1 step remains.',
    '| D03 | complete | Runtime smoke and pilot readiness |',
    'ready-for-shadow-pilot',
    'not-ready',
    'ready-for-scoped-pilot` is outside D03',
  ]) {
    includes(doc, expected, `D03 probe doc: records ${expected}`);
  }

  includes(
    ledger,
    'Controlled Data Export Golden Path D03',
    'D03 ledger: records pilot readiness probe',
  );
  equal(
    packageJson.scripts['test:golden-data-export-pilot-readiness-probe'],
    'tsx tests/golden-data-export-pilot-readiness-probe.test.ts',
    'D03 probe package script: targeted test is registered',
  );
}

testDescriptor();
testProbeEmitsOnlyShadowPilotVerdict();
testProbePreservesNoClaimBoundary();
testProbeFailsClosedOnRuntimeSmokeRisk();
testDeterminismAndDataMinimization();
testDocsAndScriptsStayAligned();

console.log(`golden-data-export-pilot-readiness-probe: ${passed} assertions passed`);
