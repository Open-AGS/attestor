import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES,
  createPolicyFoundryFailureGapMap,
  policyFoundryFailureGapMapDescriptor,
  type ConsequenceFailureModeId,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function allControls(): readonly string[] {
  return CONSEQUENCE_FAILURE_CONTROL_BINDINGS.flatMap((binding) => binding.controlIds);
}

function allEvidence(): readonly string[] {
  return CONSEQUENCE_FAILURE_CONTROL_BINDINGS.flatMap((binding) => binding.requiredEvidence);
}

function allAuthority(): readonly string[] {
  return CONSEQUENCE_FAILURE_CONTROL_BINDINGS.flatMap((binding) => binding.requiredAuthority);
}

function allAuditRecords(): readonly string[] {
  return CONSEQUENCE_FAILURE_CONTROL_BINDINGS.flatMap((binding) => binding.requiredAuditRecords);
}

function allFailureModeIds(): readonly ConsequenceFailureModeId[] {
  return CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES.map((entry) => entry.id);
}

function testCompleteCoverageProducesCoveredMap(): void {
  const map = createPolicyFoundryFailureGapMap({
    generatedAt: '2026-05-13T15:00:00.000Z',
    actionSurface: 'refunds.issue_refund_private_marker',
    coveredControls: allControls(),
    presentEvidence: allEvidence(),
    presentAuthority: allAuthority(),
    presentAuditRecords: allAuditRecords(),
    passedReplayFailureModeIds: allFailureModeIds(),
  });
  const serialized = JSON.stringify(map);

  equal(map.version, 'attestor.policy-foundry-failure-gap-map.v1', 'Failure gap map: version is stable');
  equal(map.failureModeCount, CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES.length, 'Failure gap map: every registry entry is mapped');
  equal(map.coveredCount, map.failureModeCount, 'Failure gap map: full evidence covers all failure modes');
  equal(map.partialCount, 0, 'Failure gap map: full evidence has no partial gaps');
  equal(map.missingCount, 0, 'Failure gap map: full evidence has no missing gaps');
  equal(map.blockerGapCount, 0, 'Failure gap map: full evidence has no blocker gaps');
  equal(map.approvalRequired, true, 'Failure gap map: approval remains required');
  equal(map.autoEnforce, false, 'Failure gap map: auto-enforce remains false');
  equal(map.productionReady, false, 'Failure gap map: production readiness is not claimed');
  ok(map.digest.startsWith('sha256:'), 'Failure gap map: digest is generated');
  ok(
    map.entries.every((entry) => entry.reasonCodes.includes('failure-mode-covered')),
    'Failure gap map: covered entries carry covered reason',
  );
  excludes(
    serialized,
    /refunds\.issue_refund_private_marker/u,
    'Failure gap map: raw action surface is not serialized',
  );
}

function testMissingCoverageSurfacesControlEvidenceAuthorityAuditAndReplayGaps(): void {
  const map = createPolicyFoundryFailureGapMap({
    generatedAt: '2026-05-13T15:01:00.000Z',
    coveredControls: [],
    presentEvidence: [],
    presentAuthority: [],
    presentAuditRecords: [],
    passedReplayFailureModeIds: [],
  });
  const entry = map.entries.find((item) => item.failureModeId === 'fake-approval-laundering');

  ok(entry, 'Failure gap map: fake approval entry exists');
  equal(entry?.status, 'missing', 'Failure gap map: empty evidence marks failure mode missing');
  ok(entry?.reasonCodes.includes('control-missing'), 'Failure gap map: missing control is reported');
  ok(entry?.reasonCodes.includes('evidence-missing'), 'Failure gap map: missing evidence is reported');
  ok(entry?.reasonCodes.includes('authority-missing'), 'Failure gap map: missing authority is reported');
  ok(entry?.reasonCodes.includes('audit-record-missing'), 'Failure gap map: missing audit record is reported');
  ok(entry?.reasonCodes.includes('replay-not-passed'), 'Failure gap map: missing replay is reported');
  ok(map.missingCount > 0, 'Failure gap map: missing gaps are counted');
  ok(map.blockerGapCount > 0, 'Failure gap map: blocker gaps are counted');
}

function testPartialCoverageKeepsNextSafeStepActionable(): void {
  const binding = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find((item) =>
    item.failureModeId === 'scope-explosion'
  );
  assert.ok(binding);
  const map = createPolicyFoundryFailureGapMap({
    generatedAt: '2026-05-13T15:02:00.000Z',
    coveredControls: binding.controlIds.slice(0, 1),
    presentEvidence: binding.requiredEvidence,
    presentAuthority: binding.requiredAuthority,
    presentAuditRecords: binding.requiredAuditRecords,
    passedReplayFailureModeIds: ['scope-explosion'],
  });
  const entry = map.entries.find((item) => item.failureModeId === 'scope-explosion');

  equal(entry?.status, 'partial', 'Failure gap map: partial control coverage is partial');
  ok(
    entry?.nextSafeStep.startsWith('Implement or bind control:'),
    'Failure gap map: next safe step points at missing control',
  );
}

function testCoverageAndReadinessInputsBlockRolloutReview(): void {
  const map = createPolicyFoundryFailureGapMap({
    generatedAt: '2026-05-13T15:03:00.000Z',
    coverage: {
      digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      blockedDimensions: ['verifier-or-gateway'],
    } as never,
    readiness: {
      digest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      noGoReasons: ['missing-evidence-coverage'],
    } as never,
    coveredControls: allControls(),
    presentEvidence: allEvidence(),
    presentAuthority: allAuthority(),
    presentAuditRecords: allAuditRecords(),
    passedReplayFailureModeIds: allFailureModeIds(),
  });

  ok(map.entries.some((entry) => entry.reasonCodes.includes('coverage-score-blocked')), 'Failure gap map: coverage blocker is propagated');
  ok(map.entries.some((entry) => entry.reasonCodes.includes('readiness-no-go')), 'Failure gap map: readiness no-go is propagated');
  equal(map.sourceDigests.coverageDigest, 'sha256:1111111111111111111111111111111111111111111111111111111111111111', 'Failure gap map: coverage digest is retained');
  equal(map.sourceDigests.readinessDigest, 'sha256:2222222222222222222222222222222222222222222222222222222222222222', 'Failure gap map: readiness digest is retained');
}

function testDescriptorDocsAndPackageStayAligned(): void {
  const descriptor = policyFoundryFailureGapMapDescriptor();
  const docs = readProjectFile('docs', '02-architecture', 'policy-foundry-failure-gap-map.md');
  const pkg = readProjectFile('package.json');
  const publicSurface = readProjectFile('src', 'consequence-admission', 'public-surface.ts');

  equal(descriptor.version, 'attestor.policy-foundry-failure-gap-map.v1', 'Failure gap map descriptor: version is stable');
  equal(descriptor.mapsFailureModesToControls, true, 'Failure gap map descriptor: failure mode control mapping is explicit');
  equal(descriptor.mapsMissingEvidence, true, 'Failure gap map descriptor: missing evidence mapping is explicit');
  equal(descriptor.mapsMissingReplay, true, 'Failure gap map descriptor: missing replay mapping is explicit');
  equal(descriptor.rawPayloadStored, false, 'Failure gap map descriptor: raw payload storage is false');
  includes(docs, 'failure mode -> control -> evidence -> authority -> audit -> replay', 'Failure gap map docs: purpose is documented');
  includes(docs, 'test:policy-foundry-failure-gap-map', 'Failure gap map docs: test command is documented');
  includes(pkg, '"test:policy-foundry-failure-gap-map"', 'Failure gap map package: script is registered');
  includes(publicSurface, "export * from './policy-foundry-failure-gap-map.js';", 'Failure gap map public surface: module is exported');
}

function run(): void {
  testCompleteCoverageProducesCoveredMap();
  testMissingCoverageSurfacesControlEvidenceAuthorityAuditAndReplayGaps();
  testPartialCoverageKeepsNextSafeStepActionable();
  testCoverageAndReadinessInputsBlockRolloutReview();
  testDescriptorDocsAndPackageStayAligned();
  console.log(`Policy Foundry failure gap map tests: ${passed} passed, 0 failed`);
}

try {
  run();
} catch (error) {
  console.error('Policy Foundry failure gap map tests failed:', error);
  process.exitCode = 1;
}
