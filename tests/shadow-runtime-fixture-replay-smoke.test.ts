import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
  SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION,
  SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
  SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
  SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION,
  SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
  SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION,
  createCanonicalShadowEvent,
  runShadowRuntimeFixtureReplaySmoke,
  shadowRuntimeFixtureReplaySmokeDescriptor,
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

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const digestE = `sha256:${'e'.repeat(64)}`;
const digestF = `sha256:${'f'.repeat(64)}`;

function fixtureEvent() {
  return createCanonicalShadowEvent({
    occurredAt: '2026-05-19T13:00:00.000Z',
    sourceKind: 'target-system-shadow',
    producer: 'attestor.shadow-runtime-fixture-replay-smoke.test',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest: null,
      actionName: 'refund.create',
      actionKind: 'api-operation',
      consequenceClass: 'financial',
      resourceRefDigest: digestC,
      dataClass: 'money-movement',
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: null,
      resourceRefDigest: null,
      dataClass: null,
      amountAssetChain: null,
      authorityDelta: null,
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestA, origin: 'observed' }],
    approvalRefs: [{ kind: 'approval', digest: digestB, origin: 'operator-supplied' }],
    receiptRefs: [{ kind: 'receipt', digest: digestC, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digestD, origin: 'observed' }],
    replayRefDigest: digestE,
    rawMaterialPolicy: 'digest-only',
  });
}

function smokeInput() {
  return {
    fixtureId: 'fixture:r08:refund-create',
    fixtureRefDigest: digestF,
    event: fixtureEvent(),
    sourcePartitionDigest: digestC,
    traceContextDigest: digestD,
    sourceHistoryRefDigest: digestE,
    sourceHistorySequence: 7,
    requestedAt: '2026-05-19T13:01:00.000Z',
    claimedAt: '2026-05-19T13:01:30.000Z',
    generatedAt: '2026-05-19T13:02:00.000Z',
    observedAt: '2026-05-19T13:02:05.000Z',
    outcomeObservedAt: '2026-05-19T13:03:00.000Z',
    feedbackGeneratedAt: '2026-05-19T13:03:30.000Z',
    evaluatedAt: '2026-05-19T13:04:00.000Z',
    workerRefDigest: digestF,
    dispatcherRunDigest: digestD,
    observerRefDigest: digestF,
    evaluatorRefDigest: digestF,
    scopeDigest: digestB,
  } as const;
}

function testDescriptorRecordsR02ThroughR07SmokeBoundary(): void {
  const descriptor = shadowRuntimeFixtureReplaySmokeDescriptor();

  equal(descriptor.version, SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION, 'R08: descriptor version is explicit');
  equal(descriptor.canonicalShadowEventSchemaVersion, CANONICAL_SHADOW_EVENT_SCHEMA_VERSION, 'R08: descriptor binds canonical event schema');
  equal(descriptor.shadowActivationProfileContractVersion, SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION, 'R08: descriptor binds R02');
  equal(descriptor.shadowOutboxWorkItemContractVersion, SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION, 'R08: descriptor binds R03');
  equal(descriptor.shadowDispatchClaimContractVersion, SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION, 'R08: descriptor binds R04');
  equal(descriptor.shadowRuntimeActivationRunnerVersion, SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION, 'R08: descriptor binds R05');
  equal(descriptor.shadowRuntimeObservabilityHooksVersion, SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION, 'R08: descriptor binds R06');
  equal(descriptor.shadowRuntimeOutcomeFeedbackHookVersion, SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION, 'R08: descriptor binds R07');
  ok(descriptor.sourceAnchors.includes('foundationdb-deterministic-simulation-replay'), 'R08: deterministic replay anchor is present');
  ok(descriptor.sourceAnchors.includes('cloudevents-common-event-metadata'), 'R08: CloudEvents anchor is present');
  equal(descriptor.fixtureOnly, true, 'R08: descriptor is fixture-only');
  equal(descriptor.deterministicReplay, true, 'R08: descriptor is deterministic replay');
  equal(descriptor.runsR02ThroughR07, true, 'R08: descriptor runs R02 through R07');
  equal(descriptor.noTargetSystemCall, true, 'R08: descriptor cannot call target systems');
  equal(descriptor.noAuditWrite, true, 'R08: descriptor cannot write audit');
  equal(descriptor.noPolicyActivation, true, 'R08: descriptor cannot activate policy');
  equal(descriptor.canAdmit, false, 'R08: descriptor cannot admit');
  equal(descriptor.productionReady, false, 'R08: descriptor is not production ready');
}

function testSmokeRunsR02ThroughR07(): void {
  const result = runShadowRuntimeFixtureReplaySmoke(smokeInput());

  equal(result.version, SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION, 'R08: result version is explicit');
  equal(result.smokeStatus, 'fixture-replay-smoke-complete', 'R08: smoke status is complete');
  equal(result.executionMode, 'shadow-only', 'R08: execution mode is shadow-only');
  equal(result.sourceEventDigest, result.activationProfile.sourceEventDigest, 'R08: profile binds source event');
  equal(result.activationProfileDigest, result.workItem.activationProfileDigest, 'R08: work item binds activation profile');
  equal(result.workItem.outboxWorkItemDigest, result.dispatchClaim.outboxWorkItemDigest, 'R08: claim binds work item');
  equal(result.dispatchClaim.claimTokenDigest, result.activation.claimTokenDigest, 'R08: activation binds claim token');
  equal(result.activationDigest, result.observability.activationDigest, 'R08: observability binds activation');
  equal(result.observabilityDigest, result.outcomeFeedback.observabilityDigest, 'R08: outcome feedback binds observability');
  equal(result.feedbackDigest, result.outcomeFeedback.feedbackDigest, 'R08: outcome feedback binds feedback');
  equal(result.finalAssuranceCaseDigest, result.outcomeFeedback.feedbackBoundAssuranceCaseDigest, 'R08: final case digest is bound');
  equal(result.finalLineageGraphDigest, result.outcomeFeedback.lineageGraphDigest, 'R08: final lineage digest is bound');
  equal(result.phaseDigests.length, 7, 'R08: seven phase digests are recorded');
  equal(result.fixtureOnly, true, 'R08: result is fixture-only');
  equal(result.deterministicReplay, true, 'R08: deterministic replay flag is true');
  equal(result.noTargetSystemCall, true, 'R08: result cannot call target systems');
  equal(result.noAuditWrite, true, 'R08: result cannot write audit');
  equal(result.noExternalEventBus, true, 'R08: result cannot publish externally');
  equal(result.noPolicyActivation, true, 'R08: result cannot activate policy');
  equal(result.noLearningActivation, true, 'R08: result cannot activate learning');
  equal(result.canAdmit, false, 'R08: result cannot admit');
  equal(result.productionReady, false, 'R08: result is not production ready');
  ok(result.digest.startsWith('sha256:'), 'R08: full result digest is generated');
}

function testSmokeIsDeterministicAndDoesNotMutateEvent(): void {
  const input = smokeInput();
  const before = JSON.stringify(input.event);
  const first = runShadowRuntimeFixtureReplaySmoke(input);
  const second = runShadowRuntimeFixtureReplaySmoke(input);

  equal(JSON.stringify(input.event), before, 'R08: source event is not mutated');
  equal(first.activationProfileDigest, second.activationProfileDigest, 'R08: activation profile digest is deterministic');
  equal(first.workItemDigest, second.workItemDigest, 'R08: work item digest is deterministic');
  equal(first.dispatchClaimDigest, second.dispatchClaimDigest, 'R08: claim digest is deterministic');
  equal(first.activationDigest, second.activationDigest, 'R08: activation digest is deterministic');
  equal(first.observabilityDigest, second.observabilityDigest, 'R08: observability digest is deterministic');
  equal(first.feedbackDigest, second.feedbackDigest, 'R08: feedback digest is deterministic');
  equal(first.outcomeFeedbackHookDigest, second.outcomeFeedbackHookDigest, 'R08: outcome hook digest is deterministic');
  equal(first.digest, second.digest, 'R08: full smoke digest is deterministic');
}

function testSmokeFailsClosedForUnsafeInputs(): void {
  const input = smokeInput();

  throws(
    () => runShadowRuntimeFixtureReplaySmoke({
      ...input,
      fixtureRefDigest: 'raw-fixture-id',
    }),
    /fixtureRefDigest must be a sha256 digest/u,
    'R08: raw fixture ref fails closed',
  );
  throws(
    () => runShadowRuntimeFixtureReplaySmoke({
      ...input,
      event: { ...input.event, version: 'attestor.other.v1' } as never,
    }),
    /event\.version must be attestor\.canonical-shadow-event\.v1/u,
    'R08: wrong event version fails closed',
  );
  throws(
    () => runShadowRuntimeFixtureReplaySmoke({
      ...input,
      sourceHistorySequence: -1,
    }),
    /sourceHistorySequence must be a non-negative integer/u,
    'R08: invalid source sequence fails closed',
  );
  throws(
    () => runShadowRuntimeFixtureReplaySmoke({
      ...input,
      requestedAt: 'not-a-date',
    }),
    /requestedAt must be an ISO timestamp/u,
    'R08: invalid timestamp fails closed',
  );
}

function testDocsOverviewLedgerAndPackageSurfaceStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'shadow-runtime-fixture-replay-smoke.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const decisionPacket = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-activation-decision-packet.md',
  );
  const ledger = readProjectFile(
    'docs',
    'research',
    'attestor-research-provenance-ledger.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile('scripts', 'probe', 'probe-consequence-admission-package-surface.mjs');

  for (const expected of [
    '# Shadow Runtime Fixture Replay Smoke',
    'attestor.shadow-runtime-fixture-replay-smoke.v1',
    'R02 -> R03 -> R04 -> R05 -> R06 -> R07',
    'FoundationDB deterministic simulation',
    'CloudEvents',
    'W3C PROV',
    'not target-system call',
    'not audit-plane write',
    'not production worker',
    'not production readiness',
  ]) {
    includes(doc, expected, `R08 doc: records ${expected}`);
  }

  for (const expected of [
    'Progress: 8/8 complete after R08. 0 steps remain.',
    '| R08 | complete | End-to-End Fixture Replay Smoke |',
    'src/consequence-admission/shadow-runtime-fixture-replay-smoke.ts',
    'tests/shadow-runtime-fixture-replay-smoke.test.ts',
    'docs/02-architecture/shadow-runtime-fixture-replay-smoke.md',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  for (const expected of [
    'Current progress after R08:',
    '8/8 complete, 0 steps remain.',
    '| R08 | complete | End-to-End Fixture Replay Smoke |',
    'The R-series is complete',
  ]) {
    includes(decisionPacket, expected, `Runtime activation packet: records ${expected}`);
  }

  includes(
    ledger,
    'docs/02-architecture/shadow-runtime-fixture-replay-smoke.md',
    'Research ledger: indexes R08 fixture replay smoke',
  );
  equal(
    packageJson.scripts['test:shadow-runtime-fixture-replay-smoke'],
    'tsx tests/shadow-runtime-fixture-replay-smoke.test.ts',
    'Package scripts: exposes R08 test',
  );
  includes(
    packageProbe,
    'SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION',
    'Package surface probe: covers R08 export',
  );
}

testDescriptorRecordsR02ThroughR07SmokeBoundary();
testSmokeRunsR02ThroughR07();
testSmokeIsDeterministicAndDoesNotMutateEvent();
testSmokeFailsClosedForUnsafeInputs();
testDocsOverviewLedgerAndPackageSurfaceStayAligned();

console.log(`shadow-runtime-fixture-replay-smoke tests passed (${passed} assertions)`);
