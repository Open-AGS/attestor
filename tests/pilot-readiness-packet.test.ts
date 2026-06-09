import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPilotReadinessPacket,
  pilotReadinessPacketDescriptor,
  PILOT_READINESS_GATE_IDS,
  type CreatePilotReadinessPacketInput,
  type PilotReadinessGate,
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

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function digest(label: string): string {
  return `sha256:${createHash('sha256').update(label).digest('hex')}`;
}

function baseInput(
  overrides: Partial<CreatePilotReadinessPacketInput> = {},
): CreatePilotReadinessPacketInput {
  return {
    generatedAt: '2026-05-17T15:00:00.000Z',
    pilotRefDigest: digest('pilot'),
    tenantRefDigest: digest('tenant'),
    requesterRefDigest: digest('requester'),
    targetSystemRefDigest: digest('target-system'),
    integrationOwnerRefDigest: digest('integration-owner'),
    systemOfRecordOwnerRefDigest: digest('system-of-record-owner'),
    targetRecipeRefs: ['domain-recipe:coupa-approvals'],
    stage: 'shadow-entry',
    rolloutMode: 'shadow-only',
    approvalPathDigest: digest('approval-path'),
    reviewerQueueDigest: digest('reviewer-queue'),
    rollbackPlanDigest: digest('rollback-plan'),
    decisionLogDigest: digest('decision-log'),
    runbookDigest: digest('runbook'),
    nonClaimsAccepted: true,
    ...overrides,
  };
}

function gateById(
  gates: readonly PilotReadinessGate[],
  id: PilotReadinessGate['id'],
): PilotReadinessGate {
  const found = gates.find((gate) => gate.id === id);
  assert.ok(found, `Expected pilot readiness gate ${id}`);
  return found;
}

function validScopedInput(
  overrides: Partial<CreatePilotReadinessPacketInput> = {},
): CreatePilotReadinessPacketInput {
  return baseInput({
    stage: 'scoped-enforcement-entry',
    rolloutMode: 'review-required',
    shadowObservationDays: 21,
    shadowEventCount: 500,
    eventSchemaCoveragePercent: 98,
    eventTenantBindingPercent: 100,
    eventReceiptBindingPercent: 90,
    evidenceCoveragePercent: 85,
    downstreamReceiptCoveragePercent: 80,
    activeQuestionCount: 5,
    unresolvedCriticalQuestionCount: 0,
    unresolvedHighQuestionCount: 1,
    ...overrides,
  });
}

function testShadowEntryStartsWithoutHistoricalTraffic(): void {
  const packet = createPilotReadinessPacket(baseInput());

  equal(packet.version, 'attestor.pilot-readiness-packet.v1', 'Pilot packet: version is explicit');
  equal(packet.generatedAt, '2026-05-17T15:00:00.000Z', 'Pilot packet: generatedAt is stable');
  equal(packet.decision.verdict, 'ready-for-shadow-pilot', 'Pilot packet: shadow entry can start');
  equal(packet.rolloutMode, 'shadow-only', 'Pilot packet: shadow entry stays shadow-only');
  equal(gateById(packet.gates, 'shadow-observation-window').status, 'not-applicable', 'Pilot packet: historical traffic is not required before shadow');
  equal(gateById(packet.gates, 'event-quality').status, 'not-applicable', 'Pilot packet: event quality is measured during shadow');
  equal(gateById(packet.gates, 'evidence-coverage').status, 'not-applicable', 'Pilot packet: evidence coverage is measured during shadow');
  equal(gateById(packet.gates, 'active-question-resolution').status, 'not-applicable', 'Pilot packet: active questions are measured during shadow');
  equal(packet.approvalRequired, true, 'Pilot packet: approval remains required');
  equal(packet.autoEnforce, false, 'Pilot packet: auto enforcement is false');
  equal(packet.rawPayloadStored, false, 'Pilot packet: raw payload storage is false');
  equal(packet.customerDeploymentProven, false, 'Pilot packet: no customer deployment proof');
  equal(packet.nativeConnectorCoverage, false, 'Pilot packet: no native connector coverage');
  equal(packet.productionReady, false, 'Pilot packet: no production readiness claim');
  ok(packet.digest.startsWith('sha256:'), 'Pilot packet: digest is generated');
}

function testScopedPilotRequiresObservationAndEvidence(): void {
  const failing = createPilotReadinessPacket(
    validScopedInput({
      shadowObservationDays: 3,
      shadowEventCount: 12,
      eventSchemaCoveragePercent: 70,
      eventTenantBindingPercent: 99,
      eventReceiptBindingPercent: 20,
      evidenceCoveragePercent: 40,
      downstreamReceiptCoveragePercent: 20,
      unresolvedCriticalQuestionCount: 1,
      unresolvedHighQuestionCount: 4,
    }),
  );

  equal(failing.decision.verdict, 'not-ready', 'Pilot packet: weak scoped evidence is not ready');
  for (const expected of [
    'shadow-observation-window:shadow-observation-window-too-short',
    'shadow-observation-window:shadow-event-count-too-low',
    'event-quality:event-schema-coverage-too-low',
    'event-quality:tenant-binding-coverage-too-low',
    'event-quality:receipt-binding-coverage-too-low',
    'evidence-coverage:evidence-coverage-too-low',
    'evidence-coverage:downstream-receipt-coverage-too-low',
    'active-question-resolution:unresolved-critical-questions',
    'active-question-resolution:too-many-unresolved-high-questions',
  ]) {
    ok(failing.decision.blockers.includes(expected), `Pilot packet: blocker ${expected} is recorded`);
  }

  const ready = createPilotReadinessPacket(validScopedInput());

  equal(ready.decision.verdict, 'ready-for-scoped-pilot', 'Pilot packet: scoped evidence can be ready');
  equal(gateById(ready.gates, 'shadow-observation-window').status, 'pass', 'Pilot packet: shadow threshold passes');
  equal(gateById(ready.gates, 'event-quality').status, 'pass', 'Pilot packet: event quality passes');
  equal(gateById(ready.gates, 'evidence-coverage').status, 'pass', 'Pilot packet: evidence coverage passes');
  equal(gateById(ready.gates, 'active-question-resolution').status, 'pass', 'Pilot packet: active question threshold passes');
}

function testCanaryRequiresCustomerPepProof(): void {
  const missingPep = createPilotReadinessPacket(
    validScopedInput({
      rolloutMode: 'canary-enforce',
      customerPepProofDigest: null,
    }),
  );

  equal(missingPep.decision.verdict, 'not-ready', 'Pilot packet: canary without customer PEP is not ready');
  ok(
    missingPep.decision.blockers.includes(
      'rollout-mode:canary-enforce-requires-customer-pep-proof',
    ),
    'Pilot packet: canary PEP blocker is recorded',
  );

  const readyCanary = createPilotReadinessPacket(
    validScopedInput({
      rolloutMode: 'canary-enforce',
      customerPepProofDigest: digest('customer-pep-proof'),
    }),
  );

  equal(readyCanary.decision.verdict, 'ready-for-scoped-pilot', 'Pilot packet: canary can be ready with customer PEP proof');
  includes(readyCanary.canonical, digest('customer-pep-proof'), 'Pilot packet: customer PEP proof enters canonical evidence');
}

function testInvalidInputFailsClosed(): void {
  assert.throws(
    () => createPilotReadinessPacket(baseInput({ tenantRefDigest: 'tenant-raw-id' })),
    /tenantRefDigest must be a sha256 digest/u,
    'Pilot packet: raw tenant refs are rejected',
  );
  passed += 1;

  assert.throws(
    () => createPilotReadinessPacket(validScopedInput({ eventSchemaCoveragePercent: 101 })),
    /eventSchemaCoveragePercent must be between 0 and 100/u,
    'Pilot packet: impossible percentages are rejected',
  );
  passed += 1;
}

function testDescriptorDocsAndTrackersStayAligned(): void {
  const descriptor = pilotReadinessPacketDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'pilot-readiness-packet.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const tracker = readProjectFile('docs', '02-architecture', 'attestor-unlock-source-of-truth.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.sourceBacked, true, 'Pilot descriptor: source-backed flag is true');
  equal(descriptor.reviewByException, true, 'Pilot descriptor: review-by-exception flag is true');
  equal(descriptor.customerOwnsSystemOfRecord, true, 'Pilot descriptor: customer system-of-record ownership is explicit');
  equal(descriptor.customerDeploymentRequired, true, 'Pilot descriptor: customer deployment remains required');
  equal(descriptor.approvalRequired, true, 'Pilot descriptor: approval required is true');
  equal(descriptor.autoEnforce, false, 'Pilot descriptor: autoEnforce is false');
  equal(descriptor.rawPayloadStored, false, 'Pilot descriptor: raw payload storage is false');
  equal(descriptor.nativeConnectorCoverage, false, 'Pilot descriptor: native connector coverage is false');
  equal(descriptor.customerDeploymentProven, false, 'Pilot descriptor: customer deployment proof is false');
  equal(descriptor.recordsSystem, false, 'Pilot descriptor: records system is false');
  equal(descriptor.workflowWorkspace, false, 'Pilot descriptor: workflow workspace is false');
  equal(descriptor.complianceCertification, false, 'Pilot descriptor: compliance certification is false');
  equal(descriptor.productionReady, false, 'Pilot descriptor: productionReady is false');

  for (const expected of [
    '# Pilot Readiness Packet',
    'attestor.pilot-readiness-packet.v1',
    '`shadow-entry`',
    '`scoped-enforcement-entry`',
    '`shadow-only`',
    '`review-required`',
    '`canary-enforce`',
    'ready-for-shadow-pilot',
    'ready-for-scoped-pilot',
    'not-ready',
    'Minimum shadow observation days',
    'The packet does not execute a pilot.',
    'production readiness',
    'native connector or live',
  ]) {
    includes(doc, expected, `Pilot packet doc: records ${expected}`);
  }

  for (const gateId of PILOT_READINESS_GATE_IDS) {
    includes(doc, `\`${gateId}\``, `Pilot packet doc: records gate ${gateId}`);
  }

  for (const expected of [
    '| Complete | 26 |',
    '| Remaining | 0 |',
    '| 25 | complete | Spend, procurement, data, IAM, health, and insurance recipes |',
    '| 26 | complete | Pilot readiness packet |',
    'attestor.pilot-readiness-packet.v1',
    'live customer pilot execution',
    'GitHub deployment environments',
    'Microsoft HAX Toolkit',
    'Google People + AI Guidebook',
  ]) {
    includes(masterPlan, expected, `Pilot packet: master plan records ${expected}`);
  }

  includes(
    tracker,
    'Step 26 records the Pilot readiness packet',
    'Pilot packet: unlock tracker records Step 26 completion',
  );
  includes(
    tracker,
    '26-step master plan is complete repository-side',
    'Pilot packet: unlock tracker closes the master plan',
  );
  includes(
    systemOverview,
    '[Pilot readiness packet](pilot-readiness-packet.md)',
    'Pilot packet: system overview links doc',
  );
  includes(
    readme,
    'href="docs/01-overview/how-attestor-connects-to-existing-systems.md"',
    'Pilot packet: README links the integration overview',
  );
  includes(
    ledger,
    '### 68. Pilot Readiness Packet',
    'Pilot packet: research ledger entry is present',
  );
  equal(
    packageJson.scripts['test:pilot-readiness-packet'],
    'tsx tests/pilot-readiness-packet.test.ts',
    'Pilot packet: package script is registered',
  );

  excludes(
    doc,
    /production-ready because of pilot|customer pilot is complete|native connector is implemented/iu,
    'Pilot packet doc: avoids overclaims',
  );
  excludes(
    masterPlan,
    /completion of Step 26 Pilot readiness packet/u,
    'Pilot packet: master plan no longer lists Step 26 completion as a non-claim',
  );
}

testShadowEntryStartsWithoutHistoricalTraffic();
testScopedPilotRequiresObservationAndEvidence();
testCanaryRequiresCustomerPepProof();
testInvalidInputFailsClosed();
testDescriptorDocsAndTrackersStayAligned();

console.log(`Pilot readiness packet tests: ${passed} passed, 0 failed`);
