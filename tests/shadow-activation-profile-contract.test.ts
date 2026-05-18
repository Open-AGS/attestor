import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION,
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  DEFAULT_SHADOW_ACTIVATION_PROFILE_VERSION,
  SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
  SHADOW_ACTIVATION_WORK_KEY_VERSION,
  SHADOW_RUNTIME_PIPELINE_VERSION,
  createShadowActivationProfileContract,
  shadowActivationProfileContractDescriptor,
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

function input(overrides = {}) {
  return {
    sourceEventDigest: digestA,
    tenantRefDigest: digestB,
    sourcePartitionDigest: digestC,
    traceContextDigest: digestD,
    ...overrides,
  };
}

function testDescriptorRecordsActivationBoundary(): void {
  const descriptor = shadowActivationProfileContractDescriptor();

  equal(descriptor.version, SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION, 'Shadow activation profile: descriptor version is explicit');
  equal(descriptor.workKeyVersion, SHADOW_ACTIVATION_WORK_KEY_VERSION, 'Shadow activation profile: work key version is explicit');
  equal(descriptor.defaultActivationProfileVersion, DEFAULT_SHADOW_ACTIVATION_PROFILE_VERSION, 'Shadow activation profile: default profile version is explicit');
  equal(descriptor.sourceEventSchemaVersion, CANONICAL_SHADOW_EVENT_SCHEMA_VERSION, 'Shadow activation profile: binds canonical shadow event schema');
  equal(descriptor.cloudEventsSpecVersion, CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION, 'Shadow activation profile: binds CloudEvents spec version');
  equal(descriptor.shadowRuntimePipelineVersion, SHADOW_RUNTIME_PIPELINE_VERSION, 'Shadow activation profile: binds W05 shadow runtime pipeline');
  ok(descriptor.sourceAnchors.includes('cloudevents-common-event-envelope'), 'Shadow activation profile: CloudEvents anchor is present');
  ok(descriptor.sourceAnchors.includes('kubernetes-controller-reconcile-loop'), 'Shadow activation profile: controller/reconcile anchor is present');
  ok(descriptor.sourceAnchors.includes('stripe-idempotency-key'), 'Shadow activation profile: Stripe idempotency anchor is present');
  ok(descriptor.sourceAnchors.includes('lamport-happened-before-partial-order'), 'Shadow activation profile: Lamport partial-order anchor is present');
  equal(descriptor.deliverySemantics, 'at-least-once', 'Shadow activation profile: delivery is at-least-once');
  equal(descriptor.duplicateHandling, 'activation-work-key-digest', 'Shadow activation profile: duplicate handling is digest-bound');
  equal(descriptor.orderingScope, 'tenant-source-partition', 'Shadow activation profile: ordering scope is partition scoped');
  equal(descriptor.clockAuthority, 'timestamps-are-evidence-not-ordering-proof', 'Shadow activation profile: timestamps are not ordering proof');
  equal(descriptor.rawIdempotencyKeyStored, false, 'Shadow activation profile: raw idempotency key is not stored');
  equal(descriptor.workerBehaviorIncluded, false, 'Shadow activation profile: descriptor is not worker behavior');
  equal(descriptor.outboxWriteIncluded, false, 'Shadow activation profile: descriptor does not write outbox');
  equal(descriptor.auditPlaneWriteIncluded, false, 'Shadow activation profile: descriptor does not write audit plane');
  equal(descriptor.packetSigningIncluded, false, 'Shadow activation profile: descriptor does not sign packets');
  equal(descriptor.canAdmit, false, 'Shadow activation profile: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Shadow activation profile: descriptor cannot enforce');
  ok(descriptor.nonClaims.includes('not-exactly-once-delivery'), 'Shadow activation profile: exactly-once is a non-claim');
  ok(descriptor.nonClaims.includes('not-global-total-ordering'), 'Shadow activation profile: global ordering is a non-claim');
}

function testProfileBuildsDeterministicHybridActivationContract(): void {
  const profile = createShadowActivationProfileContract(input({
    profileId: 'shadow-runtime:tenant-source-default',
    maxAttempts: 7,
    leaseSeconds: 120,
    reconcileWindowSeconds: 600,
  }));
  const second = createShadowActivationProfileContract(input({
    profileId: 'shadow-runtime:tenant-source-default',
    maxAttempts: 7,
    leaseSeconds: 120,
    reconcileWindowSeconds: 600,
  }));

  equal(profile.version, SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION, 'Shadow activation profile: version is explicit');
  equal(profile.workKeyVersion, SHADOW_ACTIVATION_WORK_KEY_VERSION, 'Shadow activation profile: work key version is explicit');
  equal(profile.sourceEventSchemaVersion, CANONICAL_SHADOW_EVENT_SCHEMA_VERSION, 'Shadow activation profile: source schema is canonical');
  equal(profile.cloudEventsSpecVersion, CANONICAL_SHADOW_EVENT_CLOUDEVENTS_SPECVERSION, 'Shadow activation profile: CloudEvents spec version is canonical');
  equal(profile.shadowRuntimePipelineVersion, SHADOW_RUNTIME_PIPELINE_VERSION, 'Shadow activation profile: W05 pipeline version is bound');
  equal(profile.activationProfileVersion, DEFAULT_SHADOW_ACTIVATION_PROFILE_VERSION, 'Shadow activation profile: default activation profile version is used');
  equal(profile.triggerMode, 'hybrid-event-reconcile', 'Shadow activation profile: default trigger is hybrid');
  equal(profile.deliverySemantics, 'at-least-once', 'Shadow activation profile: delivery stays at-least-once');
  equal(profile.duplicateHandling, 'activation-work-key-digest', 'Shadow activation profile: duplicate handling is work-key digest');
  equal(profile.orderingScope, 'tenant-source-partition', 'Shadow activation profile: ordering is tenant/source scoped');
  equal(profile.clockAuthority, 'timestamps-are-evidence-not-ordering-proof', 'Shadow activation profile: clocks are evidence only');
  equal(profile.eventDrivenTriggerAllowed, true, 'Shadow activation profile: hybrid allows event-driven trigger');
  equal(profile.reconcileLoopAllowed, true, 'Shadow activation profile: hybrid allows reconcile loop');
  equal(profile.hybridTriggerRequired, true, 'Shadow activation profile: hybrid flag is explicit');
  equal(profile.maxAttempts, 7, 'Shadow activation profile: bounded attempts are retained');
  equal(profile.leaseSeconds, 120, 'Shadow activation profile: lease seconds are retained');
  equal(profile.reconcileWindowSeconds, 600, 'Shadow activation profile: reconcile window is retained');
  ok(profile.activationWorkKeyDigest.startsWith('sha256:'), 'Shadow activation profile: activation work key digest is generated');
  ok(profile.partitionBindingDigest.startsWith('sha256:'), 'Shadow activation profile: partition binding digest is generated');
  ok(profile.idempotencyBindingDigest.startsWith('sha256:'), 'Shadow activation profile: idempotency binding digest is generated');
  ok(profile.digest.startsWith('sha256:'), 'Shadow activation profile: profile digest is generated');
  equal(profile.activationWorkKeyDigest, second.activationWorkKeyDigest, 'Shadow activation profile: work key is deterministic');
  equal(profile.digest, second.digest, 'Shadow activation profile: contract digest is deterministic');
}

function testWorkKeyChangesOnlyForWorkKeyFormulaInputs(): void {
  const base = createShadowActivationProfileContract(input());
  const sameWorkDifferentPartition = createShadowActivationProfileContract(input({
    sourcePartitionDigest: digestD,
  }));
  const differentEvent = createShadowActivationProfileContract(input({
    sourceEventDigest: digestD,
  }));
  const differentProfile = createShadowActivationProfileContract(input({
    activationProfileVersion: 'attestor.shadow-activation-profile.experimental.v1',
  }));

  equal(
    base.activationWorkKeyDigest,
    sameWorkDifferentPartition.activationWorkKeyDigest,
    'Shadow activation profile: work key follows the R01 formula and does not include partition digest',
  );
  notEqual(
    base.partitionBindingDigest,
    sameWorkDifferentPartition.partitionBindingDigest,
    'Shadow activation profile: partition binding still changes when source partition changes',
  );
  notEqual(
    base.activationWorkKeyDigest,
    differentEvent.activationWorkKeyDigest,
    'Shadow activation profile: source event digest changes work key',
  );
  notEqual(
    base.activationWorkKeyDigest,
    differentProfile.activationWorkKeyDigest,
    'Shadow activation profile: activation profile version changes work key',
  );
}

function testNoAuthorityAndNoRawMaterialFlagsAreHardFalse(): void {
  const profile = createShadowActivationProfileContract(input({
    triggerMode: 'event-driven',
  }));

  equal(profile.eventDrivenTriggerAllowed, true, 'Shadow activation profile: event-driven trigger is allowed');
  equal(profile.reconcileLoopAllowed, false, 'Shadow activation profile: event-driven trigger does not imply reconcile');
  equal(profile.hybridTriggerRequired, false, 'Shadow activation profile: event-driven trigger is not hybrid');
  equal(profile.atLeastOnceOnly, true, 'Shadow activation profile: at-least-once-only flag is true');
  equal(profile.exactlyOnceClaimed, false, 'Shadow activation profile: exactly-once is not claimed');
  equal(profile.globalTotalOrderingClaimed, false, 'Shadow activation profile: global ordering is not claimed');
  equal(profile.rawIdempotencyKeyStored, false, 'Shadow activation profile: raw idempotency key is not stored');
  equal(profile.rawPayloadRead, false, 'Shadow activation profile: raw payload is not read');
  equal(profile.rawPayloadStored, false, 'Shadow activation profile: raw payload is not stored');
  equal(profile.workerBehaviorIncluded, false, 'Shadow activation profile: worker behavior is not included');
  equal(profile.outboxWriteIncluded, false, 'Shadow activation profile: outbox write is not included');
  equal(profile.auditPlaneWriteIncluded, false, 'Shadow activation profile: audit-plane write is not included');
  equal(profile.packetSigningIncluded, false, 'Shadow activation profile: packet signing is not included');
  equal(profile.grantsAuthority, false, 'Shadow activation profile: grants no authority');
  equal(profile.canAdmit, false, 'Shadow activation profile: cannot admit');
  equal(profile.activatesEnforcement, false, 'Shadow activation profile: cannot activate enforcement');
  equal(profile.autoEnforce, false, 'Shadow activation profile: cannot auto-enforce');
  equal(profile.learnsFromTraffic, false, 'Shadow activation profile: does not learn from traffic');
  equal(profile.productionReady, false, 'Shadow activation profile: is not production ready');
}

function testFailsClosedForInvalidInputs(): void {
  throws(
    () => createShadowActivationProfileContract(input({ sourceEventDigest: 'event-raw' })),
    /sourceEventDigest must be a sha256 digest/u,
    'Shadow activation profile: raw event digest fails closed',
  );
  throws(
    () => createShadowActivationProfileContract(input({ tenantRefDigest: 'tenant-raw' })),
    /tenantRefDigest must be a sha256 digest/u,
    'Shadow activation profile: raw tenant digest fails closed',
  );
  throws(
    () => createShadowActivationProfileContract(input({ sourceEventSchemaVersion: 'attestor.other.v1' })),
    /sourceEventSchemaVersion must be attestor\.canonical-shadow-event\.v1/u,
    'Shadow activation profile: wrong source schema fails closed',
  );
  throws(
    () => createShadowActivationProfileContract(input({ cloudEventsSpecVersion: '0.3' })),
    /cloudEventsSpecVersion must be 1\.0/u,
    'Shadow activation profile: wrong CloudEvents spec fails closed',
  );
  throws(
    () => createShadowActivationProfileContract(input({ shadowRuntimePipelineVersion: 'attestor.other.v1' })),
    /shadowRuntimePipelineVersion must be attestor\.shadow-runtime-pipeline\.v1/u,
    'Shadow activation profile: wrong pipeline version fails closed',
  );
  throws(
    () => createShadowActivationProfileContract(input({ triggerMode: 'exactly-once' as never })),
    /triggerMode is not supported/u,
    'Shadow activation profile: unsupported trigger mode fails closed',
  );
  throws(
    () => createShadowActivationProfileContract(input({ maxAttempts: 0 })),
    /maxAttempts must be a positive bounded integer/u,
    'Shadow activation profile: invalid attempts fail closed',
  );
}

function testDocsOverviewLedgerAndPackageSurfaceStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'shadow-activation-profile-contract.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
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
    '# Shadow Activation Profile Contract',
    'attestor.shadow-activation-profile-contract.v1',
    'attestor.runtime-activation-work-key.v1',
    'hybrid-event-reconcile',
    'at-least-once',
    'activation-work-key-digest',
    'tenant-source-partition',
    'timestamps are evidence, not ordering proof',
    'CloudEvents',
    'Kubernetes controller',
    'Transactional Outbox',
    'Stripe idempotency',
    'PostgreSQL `SKIP LOCKED`',
    'Lamport',
    'not worker behavior',
    'not exactly-once delivery',
    'not global total ordering',
    'not live enforcement',
  ]) {
    includes(doc, expected, `Shadow activation profile doc: records ${expected}`);
  }

  for (const expected of [
    'Progress: 5/8 complete after R05. 3 steps remain.',
    '| R02 | complete | Shadow Activation Profile Contract |',
    '| R03 | complete | Shadow Outbox Work Item Contract |',
    '| R04 | complete | Dispatcher / Reconcile Claim Contract |',
    '| R05 | complete | Shadow Runtime Activation Runner |',
    'src/consequence-admission/shadow-activation-profile-contract.ts',
    'src/consequence-admission/shadow-runtime-activation-runner.ts',
    'tests/shadow-activation-profile-contract.test.ts',
    'docs/02-architecture/shadow-activation-profile-contract.md',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  includes(
    ledger,
    'docs/02-architecture/shadow-activation-profile-contract.md',
    'Research ledger: indexes shadow activation profile contract',
  );
  equal(
    packageJson.scripts['test:shadow-activation-profile-contract'],
    'tsx tests/shadow-activation-profile-contract.test.ts',
    'Package scripts: exposes shadow activation profile contract test',
  );
  includes(
    packageProbe,
    'SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION',
    'Package surface probe: covers shadow activation profile export',
  );
}

testDescriptorRecordsActivationBoundary();
testProfileBuildsDeterministicHybridActivationContract();
testWorkKeyChangesOnlyForWorkKeyFormulaInputs();
testNoAuthorityAndNoRawMaterialFlagsAreHardFalse();
testFailsClosedForInvalidInputs();
testDocsOverviewLedgerAndPackageSurfaceStayAligned();

console.log(`shadow-activation-profile-contract tests passed (${passed} assertions)`);
