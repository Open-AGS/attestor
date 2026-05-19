import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION,
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
  SHADOW_ACTIVATION_WORK_KEY_VERSION,
  SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
  SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
  SHADOW_RUNTIME_PIPELINE_VERSION,
  createShadowActivationProfileContract,
  createShadowOutboxWorkItemContract,
  shadowOutboxWorkItemContractDescriptor,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function notEqual<T>(actual: T, expected: T, message: string): void {
  assert.notEqual(actual, expected, message);
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
const requestedAt = '2026-05-19T10:00:00.000Z';

function activationProfile(overrides = {}) {
  return createShadowActivationProfileContract({
    sourceEventDigest: digestA,
    tenantRefDigest: digestB,
    sourcePartitionDigest: digestC,
    traceContextDigest: digestD,
    maxAttempts: 6,
    leaseSeconds: 180,
    reconcileWindowSeconds: 720,
    ...overrides,
  });
}

function workItem(overrides = {}) {
  return createShadowOutboxWorkItemContract({
    activationProfile: activationProfile(),
    sourceHistoryRefDigest: digestE,
    requestedAt,
    sourceHistorySequence: 12,
    ...overrides,
  });
}

function testDescriptorRecordsPendingOutboxBoundary(): void {
  const descriptor = shadowOutboxWorkItemContractDescriptor();

  equal(descriptor.version, SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION, 'Shadow outbox work item: descriptor version is explicit');
  equal(descriptor.eventType, SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE, 'Shadow outbox work item: descriptor event type is explicit');
  equal(descriptor.activationProfileContractVersion, SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION, 'Shadow outbox work item: descriptor binds activation profile');
  equal(descriptor.workKeyVersion, SHADOW_ACTIVATION_WORK_KEY_VERSION, 'Shadow outbox work item: descriptor binds activation work key');
  equal(descriptor.sourceEventSchemaVersion, CANONICAL_SHADOW_EVENT_SCHEMA_VERSION, 'Shadow outbox work item: descriptor binds canonical shadow event schema');
  equal(descriptor.cloudEventsSpecVersion, CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION, 'Shadow outbox work item: descriptor binds CloudEvents spec version');
  equal(descriptor.shadowRuntimePipelineVersion, SHADOW_RUNTIME_PIPELINE_VERSION, 'Shadow outbox work item: descriptor binds W05 shadow runtime pipeline');
  ok(descriptor.sourceAnchors.includes('cloudevents-common-event-envelope'), 'Shadow outbox work item: CloudEvents anchor is present');
  ok(descriptor.sourceAnchors.includes('transactional-outbox-pattern'), 'Shadow outbox work item: transactional outbox anchor is present');
  ok(descriptor.sourceAnchors.includes('stripe-idempotency-key'), 'Shadow outbox work item: Stripe idempotency anchor is present');
  ok(descriptor.sourceAnchors.includes('postgres-skip-locked-claim-follows-r03'), 'Shadow outbox work item: Postgres SKIP LOCKED boundary is present');
  ok(descriptor.sourceAnchors.includes('kubernetes-controller-reconcile-loop'), 'Shadow outbox work item: reconcile-loop anchor is present');
  ok(descriptor.sourceAnchors.includes('lamport-happened-before-partial-order'), 'Shadow outbox work item: Lamport partial-order anchor is present');
  equal(descriptor.status, 'pending', 'Shadow outbox work item: descriptor status is pending-only');
  equal(descriptor.deliverySemantics, 'at-least-once', 'Shadow outbox work item: delivery is at-least-once');
  equal(descriptor.duplicateHandling, 'activation-work-key-digest', 'Shadow outbox work item: duplicate handling is activation work-key digest');
  equal(descriptor.orderingScope, 'tenant-source-partition', 'Shadow outbox work item: ordering scope is tenant/source scoped');
  equal(descriptor.clockAuthority, 'timestamps-are-evidence-not-ordering-proof', 'Shadow outbox work item: timestamps are not ordering proof');
  equal(descriptor.claimBehaviorIncluded, false, 'Shadow outbox work item: descriptor is not claim behavior');
  equal(descriptor.workerBehaviorIncluded, false, 'Shadow outbox work item: descriptor is not worker behavior');
  equal(descriptor.outboxWriteIncluded, false, 'Shadow outbox work item: descriptor does not write outbox rows');
  equal(descriptor.auditPlaneWriteIncluded, false, 'Shadow outbox work item: descriptor does not write the audit plane');
  equal(descriptor.canAdmit, false, 'Shadow outbox work item: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Shadow outbox work item: descriptor cannot enforce');
  ok(descriptor.nonClaims.includes('not-claim-behavior'), 'Shadow outbox work item: claim behavior is a non-claim');
  ok(descriptor.nonClaims.includes('not-worker-behavior'), 'Shadow outbox work item: worker behavior is a non-claim');
  ok(descriptor.nonClaims.includes('not-outbox-write-integration'), 'Shadow outbox work item: outbox write is a non-claim');
}

function testWorkItemBuildsDigestOnlyPendingRecord(): void {
  const profile = activationProfile();
  const item = createShadowOutboxWorkItemContract({
    activationProfile: profile,
    sourceHistoryRefDigest: digestE,
    requestedAt,
    sourceHistorySequence: 12,
  });
  const second = createShadowOutboxWorkItemContract({
    activationProfile: profile,
    sourceHistoryRefDigest: digestE,
    requestedAt,
    sourceHistorySequence: 12,
  });

  equal(item.version, SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION, 'Shadow outbox work item: version is explicit');
  equal(item.eventType, SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE, 'Shadow outbox work item: event type is explicit');
  equal(item.status, 'pending', 'Shadow outbox work item: status is pending');
  equal(item.activationProfileContractVersion, SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION, 'Shadow outbox work item: activation profile contract is bound');
  equal(item.workKeyVersion, SHADOW_ACTIVATION_WORK_KEY_VERSION, 'Shadow outbox work item: work key version is bound');
  equal(item.sourceEventSchemaVersion, CANONICAL_SHADOW_EVENT_SCHEMA_VERSION, 'Shadow outbox work item: source event schema is canonical');
  equal(item.cloudEventsSpecVersion, CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION, 'Shadow outbox work item: CloudEvents spec is canonical');
  equal(item.shadowRuntimePipelineVersion, SHADOW_RUNTIME_PIPELINE_VERSION, 'Shadow outbox work item: W05 version is bound');
  equal(item.sourceEventDigest, profile.sourceEventDigest, 'Shadow outbox work item: source event digest comes from profile');
  equal(item.tenantRefDigest, profile.tenantRefDigest, 'Shadow outbox work item: tenant digest comes from profile');
  equal(item.sourcePartitionDigest, profile.sourcePartitionDigest, 'Shadow outbox work item: source partition digest comes from profile');
  equal(item.sourceHistoryRefDigest, digestE, 'Shadow outbox work item: source history digest is retained');
  equal(item.sourceHistorySequence, 12, 'Shadow outbox work item: source history sequence is retained');
  equal(item.activationProfileDigest, profile.digest, 'Shadow outbox work item: profile digest is retained');
  equal(item.activationWorkKeyDigest, profile.activationWorkKeyDigest, 'Shadow outbox work item: work key digest is retained');
  equal(item.partitionKeyDigest, profile.sourcePartitionDigest, 'Shadow outbox work item: partition key follows source partition digest');
  equal(item.dedupeKeyDigest, profile.activationWorkKeyDigest, 'Shadow outbox work item: dedupe key follows activation work key digest');
  equal(item.requestedAt, requestedAt, 'Shadow outbox work item: requested timestamp is retained');
  equal(item.availableAt, requestedAt, 'Shadow outbox work item: default availability is immediate');
  equal(item.attemptCount, 0, 'Shadow outbox work item: attempt count starts at zero');
  equal(item.maxAttempts, profile.maxAttempts, 'Shadow outbox work item: max attempts comes from profile');
  equal(item.leaseSeconds, profile.leaseSeconds, 'Shadow outbox work item: lease seconds comes from profile');
  equal(item.reconcileWindowSeconds, profile.reconcileWindowSeconds, 'Shadow outbox work item: reconcile window comes from profile');
  equal(item.claimTokenDigest, null, 'Shadow outbox work item: claim token is absent in R03');
  equal(item.claimWorkerDigest, null, 'Shadow outbox work item: claim worker is absent in R03');
  ok(item.sourceHistoryBindingDigest.startsWith('sha256:'), 'Shadow outbox work item: source-history binding digest is generated');
  ok(item.idempotencyBindingDigest.startsWith('sha256:'), 'Shadow outbox work item: idempotency binding digest is generated');
  ok(item.outboxPayloadDigest.startsWith('sha256:'), 'Shadow outbox work item: payload digest is generated');
  ok(item.outboxWorkItemDigest.startsWith('sha256:'), 'Shadow outbox work item: work item identity digest is generated');
  ok(item.digest.startsWith('sha256:'), 'Shadow outbox work item: full digest is generated');
  equal(item.outboxWorkItemDigest, second.outboxWorkItemDigest, 'Shadow outbox work item: identity digest is deterministic');
  equal(item.digest, second.digest, 'Shadow outbox work item: full digest is deterministic');
}

function testNoAuthorityAndNoRawMaterialFlagsAreHardFalse(): void {
  const item = workItem();

  equal(item.pendingOnly, true, 'Shadow outbox work item: pending-only flag is true');
  equal(item.atLeastOnceOnly, true, 'Shadow outbox work item: at-least-once-only flag is true');
  equal(item.exactlyOnceClaimed, false, 'Shadow outbox work item: exactly-once is not claimed');
  equal(item.globalTotalOrderingClaimed, false, 'Shadow outbox work item: global ordering is not claimed');
  equal(item.rawIdempotencyKeyStored, false, 'Shadow outbox work item: raw idempotency key is not stored');
  equal(item.rawPayloadRead, false, 'Shadow outbox work item: raw payload is not read');
  equal(item.rawPayloadStored, false, 'Shadow outbox work item: raw payload is not stored');
  equal(item.claimBehaviorIncluded, false, 'Shadow outbox work item: claim behavior is not included');
  equal(item.workerBehaviorIncluded, false, 'Shadow outbox work item: worker behavior is not included');
  equal(item.outboxWriteIncluded, false, 'Shadow outbox work item: outbox write is not included');
  equal(item.auditPlaneWriteIncluded, false, 'Shadow outbox work item: audit write is not included');
  equal(item.packetSigningIncluded, false, 'Shadow outbox work item: packet signing is not included');
  equal(item.grantsAuthority, false, 'Shadow outbox work item: grants no authority');
  equal(item.canAdmit, false, 'Shadow outbox work item: cannot admit');
  equal(item.activatesEnforcement, false, 'Shadow outbox work item: cannot activate enforcement');
  equal(item.autoEnforce, false, 'Shadow outbox work item: cannot auto-enforce');
  equal(item.learnsFromTraffic, false, 'Shadow outbox work item: does not learn from traffic');
  equal(item.productionReady, false, 'Shadow outbox work item: is not production ready');
}

function testIdentityAndPayloadDigestBoundaries(): void {
  const base = workItem();
  const later = workItem({ requestedAt: '2026-05-19T11:00:00.000Z' });
  const differentHistory = workItem({ sourceHistoryRefDigest: digestD });
  const differentProfile = workItem({
    activationProfile: activationProfile({
      activationProfileVersion: 'attestor.shadow-activation-profile.experimental.v1',
    }),
  });

  equal(
    base.outboxWorkItemDigest,
    later.outboxWorkItemDigest,
    'Shadow outbox work item: identity digest ignores scheduling evidence timestamp',
  );
  notEqual(
    base.digest,
    later.digest,
    'Shadow outbox work item: full digest still records scheduling evidence timestamp',
  );
  notEqual(
    base.outboxWorkItemDigest,
    differentHistory.outboxWorkItemDigest,
    'Shadow outbox work item: source history digest changes identity digest',
  );
  notEqual(
    base.outboxPayloadDigest,
    differentHistory.outboxPayloadDigest,
    'Shadow outbox work item: source history digest changes payload digest',
  );
  notEqual(
    base.outboxWorkItemDigest,
    differentProfile.outboxWorkItemDigest,
    'Shadow outbox work item: activation profile version changes identity digest',
  );
}

function testDoesNotMutateActivationProfile(): void {
  const profile = activationProfile();
  const before = JSON.stringify(profile);

  createShadowOutboxWorkItemContract({
    activationProfile: profile,
    sourceHistoryRefDigest: digestE,
    requestedAt,
  });

  equal(JSON.stringify(profile), before, 'Shadow outbox work item: activation profile is not mutated');
}

function testFailsClosedForInvalidInputs(): void {
  throws(
    () => workItem({ sourceHistoryRefDigest: 'history-raw' }),
    /sourceHistoryRefDigest must be a sha256 digest/u,
    'Shadow outbox work item: raw source history id fails closed',
  );
  throws(
    () => workItem({ requestedAt: 'not-a-date' }),
    /requestedAt must be an ISO timestamp/u,
    'Shadow outbox work item: invalid requestedAt fails closed',
  );
  throws(
    () => workItem({
      requestedAt,
      availableAt: '2026-05-19T09:59:59.000Z',
    }),
    /availableAt cannot be before requestedAt/u,
    'Shadow outbox work item: availability before requestedAt fails closed',
  );
  throws(
    () => workItem({ sourceHistorySequence: 0 }),
    /sourceHistorySequence must be a positive bounded integer/u,
    'Shadow outbox work item: zero history sequence fails closed',
  );
  throws(
    () => workItem({
      activationProfile: {
        ...activationProfile(),
        version: 'attestor.other.v1',
      } as never,
    }),
    /activationProfile\.version must be attestor\.shadow-activation-profile-contract\.v1/u,
    'Shadow outbox work item: wrong activation profile version fails closed',
  );
  throws(
    () => workItem({
      activationProfile: {
        ...activationProfile(),
        canAdmit: true,
      } as never,
    }),
    /activationProfile\.canAdmit must be false/u,
    'Shadow outbox work item: authority-upgraded activation profile fails closed',
  );
  throws(
    () => workItem({
      activationProfile: {
        ...activationProfile(),
        outboxWriteIncluded: true,
      } as never,
    }),
    /activationProfile\.outboxWriteIncluded must be false/u,
    'Shadow outbox work item: outbox-writing activation profile fails closed',
  );
}

function testDocsOverviewLedgerAndPackageSurfaceStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'shadow-outbox-work-item-contract.md');
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
  const packageProbe = readProjectFile('scripts', 'probe-consequence-admission-package-surface.mjs');

  for (const expected of [
    '# Shadow Outbox Work Item Contract',
    'attestor.shadow-outbox-work-item-contract.v1',
    'attestor.shadow-runtime.activation.requested.v1',
    'pending',
    'at-least-once',
    'activation-work-key-digest',
    'tenant-source-partition',
    'timestamps are evidence, not ordering proof',
    'CloudEvents',
    'Transactional Outbox',
    'Stripe idempotency',
    'PostgreSQL `SKIP LOCKED`',
    'Kubernetes controller',
    'Lamport',
    'not claim behavior',
    'not worker behavior',
    'not outbox write integration',
    'not live enforcement',
  ]) {
    includes(doc, expected, `Shadow outbox work item doc: records ${expected}`);
  }

  for (const expected of [
    'Progress: 8/8 complete after R08. 0 steps remain.',
    '| R03 | complete | Shadow Outbox Work Item Contract |',
    '| R04 | complete | Dispatcher / Reconcile Claim Contract |',
    '| R05 | complete | Shadow Runtime Activation Runner |',
    '| R06 | complete | Trace / Lineage / Measurement Hooks |',
    '| R07 | complete | Outcome Feedback Hook |',
    '| R08 | complete | End-to-End Fixture Replay Smoke |',
    'src/consequence-admission/shadow-outbox-work-item-contract.ts',
    'src/consequence-admission/shadow-runtime-activation-runner.ts',
    'src/consequence-admission/shadow-runtime-observability-hooks.ts',
    'src/consequence-admission/shadow-runtime-outcome-feedback-hook.ts',
    'src/consequence-admission/shadow-runtime-fixture-replay-smoke.ts',
    'tests/shadow-outbox-work-item-contract.test.ts',
    'docs/02-architecture/shadow-outbox-work-item-contract.md',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  for (const expected of [
    'Current progress after R08:',
    '8/8 complete, 0 steps remain.',
    '| R03 | complete | Shadow Outbox Work Item Contract |',
    '| R04 | complete | Dispatcher / Reconcile Claim Contract |',
    '| R05 | complete | Shadow Runtime Activation Runner |',
    '| R06 | complete | Trace / Lineage / Measurement Hooks |',
    '| R07 | complete | Outcome Feedback Hook |',
    '| R08 | complete | End-to-End Fixture Replay Smoke |',
    'The R-series is complete',
  ]) {
    includes(decisionPacket, expected, `Runtime activation packet: records ${expected}`);
  }

  includes(
    ledger,
    'docs/02-architecture/shadow-outbox-work-item-contract.md',
    'Research ledger: indexes shadow outbox work item contract',
  );
  equal(
    packageJson.scripts['test:shadow-outbox-work-item-contract'],
    'tsx tests/shadow-outbox-work-item-contract.test.ts',
    'Package scripts: exposes shadow outbox work item test',
  );
  includes(
    packageProbe,
    'SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION',
    'Package surface probe: covers shadow outbox work item export',
  );
}

testDescriptorRecordsPendingOutboxBoundary();
testWorkItemBuildsDigestOnlyPendingRecord();
testNoAuthorityAndNoRawMaterialFlagsAreHardFalse();
testIdentityAndPayloadDigestBoundaries();
testDoesNotMutateActivationProfile();
testFailsClosedForInvalidInputs();
testDocsOverviewLedgerAndPackageSurfaceStayAligned();

console.log(`shadow-outbox-work-item-contract tests passed (${passed} assertions)`);
