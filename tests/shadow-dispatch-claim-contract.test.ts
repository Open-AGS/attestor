import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
  SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION,
  SHADOW_DISPATCH_CLAIM_TOKEN_VERSION,
  SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
  SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
  createShadowActivationProfileContract,
  createShadowDispatchClaimContract,
  createShadowOutboxWorkItemContract,
  shadowDispatchClaimContractDescriptor,
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
const digestF = `sha256:${'f'.repeat(64)}`;
const requestedAt = '2026-05-19T10:00:00.000Z';
const claimedAt = '2026-05-19T10:05:00.000Z';

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

function claim(overrides = {}) {
  return createShadowDispatchClaimContract({
    workItem: workItem(),
    workerRefDigest: digestF,
    claimedAt,
    ...overrides,
  });
}

function testDescriptorRecordsClaimBoundary(): void {
  const descriptor = shadowDispatchClaimContractDescriptor();

  equal(descriptor.version, SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION, 'Shadow dispatch claim: descriptor version is explicit');
  equal(descriptor.claimTokenVersion, SHADOW_DISPATCH_CLAIM_TOKEN_VERSION, 'Shadow dispatch claim: token version is explicit');
  equal(descriptor.sourceWorkItemContractVersion, SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION, 'Shadow dispatch claim: descriptor binds R03 work item');
  equal(descriptor.sourceWorkItemEventType, SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE, 'Shadow dispatch claim: descriptor binds R03 event type');
  ok(descriptor.sourceAnchors.includes('postgres-for-update-skip-locked-queue-claim'), 'Shadow dispatch claim: Postgres SKIP LOCKED anchor is present');
  ok(descriptor.sourceAnchors.includes('postgres-transaction-advisory-lock-tenant-scope'), 'Shadow dispatch claim: advisory lock anchor is present');
  ok(descriptor.sourceAnchors.includes('kubernetes-controller-reconcile-loop'), 'Shadow dispatch claim: reconcile anchor is present');
  ok(descriptor.sourceAnchors.includes('transactional-outbox-pattern'), 'Shadow dispatch claim: outbox anchor is present');
  ok(descriptor.sourceAnchors.includes('stripe-idempotency-key'), 'Shadow dispatch claim: idempotency anchor is present');
  ok(descriptor.sourceAnchors.includes('lamport-happened-before-partial-order'), 'Shadow dispatch claim: Lamport anchor is present');
  ok(descriptor.claimModes.includes('event-driven'), 'Shadow dispatch claim: event-driven claim mode is present');
  ok(descriptor.claimModes.includes('reconcile-loop'), 'Shadow dispatch claim: reconcile-loop claim mode is present');
  ok(descriptor.claimModes.includes('reconcile-expired-lease'), 'Shadow dispatch claim: expired-lease claim mode is present');
  equal(descriptor.claimStatus, 'claimed', 'Shadow dispatch claim: status is claimed');
  equal(descriptor.claimLeaseSemantics, 'time-bounded-lease', 'Shadow dispatch claim: lease is time bounded');
  equal(descriptor.rowLockSemantics, 'for-update-skip-locked', 'Shadow dispatch claim: row lock semantics are explicit');
  equal(descriptor.advisoryLockScope, 'tenant-source-partition', 'Shadow dispatch claim: advisory lock scope is partition scoped');
  equal(descriptor.retrySemantics, 'bounded-attempt-increment', 'Shadow dispatch claim: retry semantics are bounded');
  equal(descriptor.claimContractIncluded, true, 'Shadow dispatch claim: descriptor is a claim contract');
  equal(descriptor.claimStorageMutationIncluded, false, 'Shadow dispatch claim: descriptor is not storage mutation');
  equal(descriptor.workerBehaviorIncluded, false, 'Shadow dispatch claim: descriptor is not worker behavior');
  equal(descriptor.runnerInvocationIncluded, false, 'Shadow dispatch claim: descriptor does not invoke runner');
  equal(descriptor.outboxWriteIncluded, false, 'Shadow dispatch claim: descriptor does not write outbox rows');
  equal(descriptor.canAdmit, false, 'Shadow dispatch claim: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Shadow dispatch claim: descriptor cannot enforce');
  ok(descriptor.nonClaims.includes('not-storage-claim-mutation'), 'Shadow dispatch claim: storage mutation is a non-claim');
  ok(descriptor.nonClaims.includes('not-runner-invocation'), 'Shadow dispatch claim: runner invocation is a non-claim');
}

function testClaimBuildsDigestOnlyLeaseRecord(): void {
  const source = workItem();
  const record = createShadowDispatchClaimContract({
    workItem: source,
    workerRefDigest: digestF,
    claimedAt,
    dispatcherRunDigest: digestD,
  });
  const second = createShadowDispatchClaimContract({
    workItem: source,
    workerRefDigest: digestF,
    claimedAt,
    dispatcherRunDigest: digestD,
  });

  equal(record.version, SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION, 'Shadow dispatch claim: version is explicit');
  equal(record.claimTokenVersion, SHADOW_DISPATCH_CLAIM_TOKEN_VERSION, 'Shadow dispatch claim: token version is explicit');
  equal(record.sourceWorkItemContractVersion, SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION, 'Shadow dispatch claim: R03 work item contract is bound');
  equal(record.sourceWorkItemEventType, SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE, 'Shadow dispatch claim: R03 event type is bound');
  equal(record.claimMode, 'event-driven', 'Shadow dispatch claim: default claim mode is event-driven');
  equal(record.claimStatus, 'claimed', 'Shadow dispatch claim: claim status is claimed');
  equal(record.sourceEventDigest, source.sourceEventDigest, 'Shadow dispatch claim: source event digest is retained');
  equal(record.tenantRefDigest, source.tenantRefDigest, 'Shadow dispatch claim: tenant digest is retained');
  equal(record.sourcePartitionDigest, source.sourcePartitionDigest, 'Shadow dispatch claim: source partition digest is retained');
  equal(record.sourceHistoryRefDigest, source.sourceHistoryRefDigest, 'Shadow dispatch claim: source history digest is retained');
  equal(record.activationWorkKeyDigest, source.activationWorkKeyDigest, 'Shadow dispatch claim: activation work key is retained');
  equal(record.outboxWorkItemDigest, source.outboxWorkItemDigest, 'Shadow dispatch claim: work item identity is retained');
  equal(record.outboxPayloadDigest, source.outboxPayloadDigest, 'Shadow dispatch claim: payload digest is retained');
  equal(record.dedupeKeyDigest, source.dedupeKeyDigest, 'Shadow dispatch claim: dedupe key is retained');
  equal(record.workerRefDigest, digestF, 'Shadow dispatch claim: worker digest is retained');
  equal(record.dispatcherRunDigest, digestD, 'Shadow dispatch claim: dispatcher run digest is retained');
  equal(record.claimAttempt, 1, 'Shadow dispatch claim: claim attempt increments from R03 pending work item');
  equal(record.maxAttempts, source.maxAttempts, 'Shadow dispatch claim: max attempts comes from work item');
  equal(record.leaseSeconds, source.leaseSeconds, 'Shadow dispatch claim: lease seconds comes from work item');
  equal(record.claimedAt, claimedAt, 'Shadow dispatch claim: claimedAt is retained');
  equal(record.claimExpiresAt, '2026-05-19T10:08:00.000Z', 'Shadow dispatch claim: claim expiry is computed from lease seconds');
  ok(record.claimTokenDigest.startsWith('sha256:'), 'Shadow dispatch claim: claim token digest is generated');
  ok(record.claimLeaseDigest.startsWith('sha256:'), 'Shadow dispatch claim: claim lease digest is generated');
  ok(record.workerBindingDigest.startsWith('sha256:'), 'Shadow dispatch claim: worker binding digest is generated');
  ok(record.partitionClaimDigest.startsWith('sha256:'), 'Shadow dispatch claim: partition claim digest is generated');
  ok(record.digest.startsWith('sha256:'), 'Shadow dispatch claim: full digest is generated');
  equal(record.claimTokenDigest, second.claimTokenDigest, 'Shadow dispatch claim: token digest is deterministic');
  equal(record.digest, second.digest, 'Shadow dispatch claim: full digest is deterministic');
}

function testNoAuthorityAndNoRuntimeFlagsAreHardFalse(): void {
  const record = claim();

  equal(record.claimContractIncluded, true, 'Shadow dispatch claim: claim contract flag is true');
  equal(record.claimStorageMutationIncluded, false, 'Shadow dispatch claim: storage mutation is not included');
  equal(record.workerBehaviorIncluded, false, 'Shadow dispatch claim: worker behavior is not included');
  equal(record.runnerInvocationIncluded, false, 'Shadow dispatch claim: runner invocation is not included');
  equal(record.outboxWriteIncluded, false, 'Shadow dispatch claim: outbox write is not included');
  equal(record.auditPlaneWriteIncluded, false, 'Shadow dispatch claim: audit write is not included');
  equal(record.packetSigningIncluded, false, 'Shadow dispatch claim: packet signing is not included');
  equal(record.leaseReleaseIncluded, false, 'Shadow dispatch claim: lease release is not included');
  equal(record.publishIncluded, false, 'Shadow dispatch claim: publish is not included');
  equal(record.atLeastOnceOnly, true, 'Shadow dispatch claim: at-least-once-only flag is true');
  equal(record.exactlyOnceClaimed, false, 'Shadow dispatch claim: exactly-once is not claimed');
  equal(record.globalTotalOrderingClaimed, false, 'Shadow dispatch claim: global ordering is not claimed');
  equal(record.rawIdempotencyKeyStored, false, 'Shadow dispatch claim: raw idempotency key is not stored');
  equal(record.rawPayloadRead, false, 'Shadow dispatch claim: raw payload is not read');
  equal(record.rawPayloadStored, false, 'Shadow dispatch claim: raw payload is not stored');
  equal(record.grantsAuthority, false, 'Shadow dispatch claim: grants no authority');
  equal(record.canAdmit, false, 'Shadow dispatch claim: cannot admit');
  equal(record.activatesEnforcement, false, 'Shadow dispatch claim: cannot enforce');
  equal(record.autoEnforce, false, 'Shadow dispatch claim: cannot auto-enforce');
  equal(record.learnsFromTraffic, false, 'Shadow dispatch claim: does not learn from traffic');
  equal(record.productionReady, false, 'Shadow dispatch claim: is not production ready');
}

function testClaimDigestBoundaries(): void {
  const base = claim();
  const sameWorkLater = claim({ claimedAt: '2026-05-19T10:06:00.000Z' });
  const differentWorker = claim({ workerRefDigest: digestD });
  const reconcile = claim({ claimMode: 'reconcile-loop' });

  notEqual(base.claimTokenDigest, sameWorkLater.claimTokenDigest, 'Shadow dispatch claim: claimedAt changes claim token digest');
  notEqual(base.claimLeaseDigest, sameWorkLater.claimLeaseDigest, 'Shadow dispatch claim: claimedAt changes lease digest');
  notEqual(base.workerBindingDigest, differentWorker.workerBindingDigest, 'Shadow dispatch claim: worker digest changes worker binding');
  notEqual(base.claimTokenDigest, reconcile.claimTokenDigest, 'Shadow dispatch claim: claim mode changes claim token digest');
}

function testDoesNotMutateWorkItem(): void {
  const source = workItem();
  const before = JSON.stringify(source);

  createShadowDispatchClaimContract({
    workItem: source,
    workerRefDigest: digestF,
    claimedAt,
  });

  equal(JSON.stringify(source), before, 'Shadow dispatch claim: work item is not mutated');
}

function testFailsClosedForInvalidInputs(): void {
  throws(
    () => claim({ workerRefDigest: 'worker-raw' }),
    /workerRefDigest must be a sha256 digest/u,
    'Shadow dispatch claim: raw worker id fails closed',
  );
  throws(
    () => claim({ claimedAt: 'not-a-date' }),
    /claimedAt must be an ISO timestamp/u,
    'Shadow dispatch claim: invalid claimedAt fails closed',
  );
  throws(
    () => claim({ claimedAt: '2026-05-19T09:59:59.000Z' }),
    /claimedAt cannot be before workItem\.availableAt/u,
    'Shadow dispatch claim: claim before availability fails closed',
  );
  throws(
    () => claim({ claimMode: 'side-channel' as never }),
    /claimMode is not supported/u,
    'Shadow dispatch claim: unsupported mode fails closed',
  );
  throws(
    () => claim({
      workItem: {
        ...workItem(),
        version: 'attestor.other.v1',
      } as never,
    }),
    /workItem\.version must be attestor\.shadow-outbox-work-item-contract\.v1/u,
    'Shadow dispatch claim: wrong work item version fails closed',
  );
  throws(
    () => claim({
      workItem: {
        ...workItem(),
        status: 'claimed',
      } as never,
    }),
    /workItem\.status must be pending/u,
    'Shadow dispatch claim: already claimed status fails closed',
  );
  throws(
    () => claim({
      workItem: {
        ...workItem(),
        attemptCount: 6,
      } as never,
    }),
    /attempts are exhausted/u,
    'Shadow dispatch claim: exhausted attempts fail closed',
  );
  throws(
    () => claim({
      workItem: {
        ...workItem(),
        canAdmit: true,
      } as never,
    }),
    /workItem\.canAdmit must be false/u,
    'Shadow dispatch claim: authority-upgraded work item fails closed',
  );
}

function testDocsOverviewLedgerAndPackageSurfaceStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'shadow-dispatch-claim-contract.md');
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
    '# Shadow Dispatch Claim Contract',
    'attestor.shadow-dispatch-claim-contract.v1',
    'attestor.shadow-dispatch-claim-token.v1',
    'claimed',
    'time-bounded-lease',
    'for-update-skip-locked',
    'tenant-source-partition',
    'bounded-attempt-increment',
    'PostgreSQL `SKIP LOCKED`',
    'PostgreSQL advisory lock',
    'Kubernetes controller',
    'Transactional Outbox',
    'Stripe idempotency',
    'Lamport',
    'not storage claim mutation',
    'not worker behavior',
    'not runner invocation',
    'not live enforcement',
  ]) {
    includes(doc, expected, `Shadow dispatch claim doc: records ${expected}`);
  }

  for (const expected of [
    'Progress: 4/8 complete after R04. 4 steps remain.',
    '| R04 | complete | Dispatcher / Reconcile Claim Contract |',
    'src/consequence-admission/shadow-dispatch-claim-contract.ts',
    'tests/shadow-dispatch-claim-contract.test.ts',
    'docs/02-architecture/shadow-dispatch-claim-contract.md',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  for (const expected of [
    'Current progress after R04:',
    '4/8 complete, 4 steps remain.',
    '| R04 | complete | Dispatcher / Reconcile Claim Contract |',
    'The next safe step is R05',
  ]) {
    includes(decisionPacket, expected, `Runtime activation packet: records ${expected}`);
  }

  includes(
    ledger,
    'docs/02-architecture/shadow-dispatch-claim-contract.md',
    'Research ledger: indexes shadow dispatch claim contract',
  );
  equal(
    packageJson.scripts['test:shadow-dispatch-claim-contract'],
    'tsx tests/shadow-dispatch-claim-contract.test.ts',
    'Package scripts: exposes shadow dispatch claim test',
  );
  includes(
    packageProbe,
    'SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION',
    'Package surface probe: covers shadow dispatch claim export',
  );
}

testDescriptorRecordsClaimBoundary();
testClaimBuildsDigestOnlyLeaseRecord();
testNoAuthorityAndNoRuntimeFlagsAreHardFalse();
testClaimDigestBoundaries();
testDoesNotMutateWorkItem();
testFailsClosedForInvalidInputs();
testDocsOverviewLedgerAndPackageSurfaceStayAligned();

console.log(`shadow-dispatch-claim-contract tests passed (${passed} assertions)`);
