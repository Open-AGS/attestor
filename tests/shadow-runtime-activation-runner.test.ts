import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION,
  SHADOW_DISPATCH_CLAIM_TOKEN_VERSION,
  SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
  SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
  SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
  SHADOW_RUNTIME_PIPELINE_VERSION,
  createCanonicalShadowEvent,
  createShadowActivationProfileContract,
  createShadowDispatchClaimContract,
  createShadowOutboxWorkItemContract,
  runShadowRuntimeActivation,
  shadowRuntimeActivationRunnerDescriptor,
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
const occurredAt = '2026-05-19T10:00:00.000Z';
const requestedAt = '2026-05-19T10:01:00.000Z';
const claimedAt = '2026-05-19T10:02:00.000Z';
const generatedAt = '2026-05-19T10:03:00.000Z';

function fixtureEvent(overrides = {}) {
  return createCanonicalShadowEvent({
    occurredAt,
    sourceKind: 'target-system-shadow',
    producer: 'attestor.shadow-runtime-activation-runner.test',
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
      authorityDelta: {
        authorityKind: 'delegated-service-role',
        principalRefDigest: digestB,
        resourceRefDigest: digestC,
        permissionRefDigest: digestD,
      },
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestA, origin: 'observed' }],
    approvalRefs: [{ kind: 'approval', digest: digestB, origin: 'operator-supplied' }],
    receiptRefs: [{ kind: 'receipt', digest: digestC, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digestD, origin: 'observed' }],
    replayRefDigest: digestE,
    rawMaterialPolicy: 'digest-only',
    ...overrides,
  });
}

function fixtureClaim(event = fixtureEvent(), overrides = {}) {
  const activationProfile = createShadowActivationProfileContract({
    sourceEventDigest: event.digest,
    tenantRefDigest: event.tenantRefDigest,
    sourcePartitionDigest: digestC,
    traceContextDigest: digestD,
    maxAttempts: 6,
    leaseSeconds: 180,
    reconcileWindowSeconds: 720,
  });
  const workItem = createShadowOutboxWorkItemContract({
    activationProfile,
    sourceHistoryRefDigest: digestE,
    requestedAt,
    sourceHistorySequence: 12,
  });

  return createShadowDispatchClaimContract({
    workItem,
    workerRefDigest: digestF,
    claimedAt,
    dispatcherRunDigest: digestD,
    ...overrides,
  });
}

function testDescriptorRecordsShadowOnlyActivationBoundary(): void {
  const descriptor = shadowRuntimeActivationRunnerDescriptor();

  equal(descriptor.version, SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION, 'Shadow runtime activation runner: descriptor version is explicit');
  equal(descriptor.sourceClaimContractVersion, SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION, 'Shadow runtime activation runner: descriptor binds R04 claim contract');
  equal(descriptor.sourceClaimTokenVersion, SHADOW_DISPATCH_CLAIM_TOKEN_VERSION, 'Shadow runtime activation runner: descriptor binds R04 claim token');
  equal(descriptor.sourceWorkItemContractVersion, SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION, 'Shadow runtime activation runner: descriptor binds R03 work item contract');
  equal(descriptor.sourceWorkItemEventType, SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE, 'Shadow runtime activation runner: descriptor binds R03 event type');
  equal(descriptor.shadowRuntimePipelineVersion, SHADOW_RUNTIME_PIPELINE_VERSION, 'Shadow runtime activation runner: descriptor binds W05 pipeline');
  equal(descriptor.calls, 'runShadowRuntimePipelineDryRun', 'Shadow runtime activation runner: descriptor names the only runner call');
  equal(descriptor.executionMode, 'shadow-only', 'Shadow runtime activation runner: descriptor is shadow-only');
  ok(descriptor.sourceAnchors.includes('nasa-runtime-assurance-simplex-monitor'), 'Shadow runtime activation runner: NASA RTA anchor is present');
  ok(descriptor.sourceAnchors.includes('kubernetes-controller-reconcile-loop'), 'Shadow runtime activation runner: Kubernetes reconcile anchor is present');
  ok(descriptor.sourceAnchors.includes('opa-decision-log-redaction-boundary'), 'Shadow runtime activation runner: OPA decision log anchor is present');
  ok(descriptor.sourceAnchors.includes('opentelemetry-log-trace-context'), 'Shadow runtime activation runner: OpenTelemetry anchor is present');
  equal(descriptor.claimLeaseRequired, true, 'Shadow runtime activation runner: claim lease is required');
  equal(descriptor.eventDigestMustMatchClaim, true, 'Shadow runtime activation runner: event digest must match claim');
  equal(descriptor.tenantDigestMustMatchClaim, true, 'Shadow runtime activation runner: tenant digest must match claim');
  equal(descriptor.runnerInvocationIncluded, true, 'Shadow runtime activation runner: descriptor includes runner invocation');
  equal(descriptor.dryRunOnly, true, 'Shadow runtime activation runner: descriptor is dry-run only');
  equal(descriptor.workerBehaviorIncluded, false, 'Shadow runtime activation runner: descriptor excludes worker behavior');
  equal(descriptor.claimStorageMutationIncluded, false, 'Shadow runtime activation runner: descriptor excludes claim storage mutation');
  equal(descriptor.outboxWriteIncluded, false, 'Shadow runtime activation runner: descriptor excludes outbox writes');
  equal(descriptor.auditPlaneWriteIncluded, false, 'Shadow runtime activation runner: descriptor excludes audit writes');
  equal(descriptor.packetSigningIncluded, false, 'Shadow runtime activation runner: descriptor excludes packet signing');
  equal(descriptor.leaseReleaseIncluded, false, 'Shadow runtime activation runner: descriptor excludes lease release');
  equal(descriptor.publishIncluded, false, 'Shadow runtime activation runner: descriptor excludes publish');
  equal(descriptor.canAdmit, false, 'Shadow runtime activation runner: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Shadow runtime activation runner: descriptor cannot enforce');
  equal(descriptor.productionReady, false, 'Shadow runtime activation runner: descriptor is not production ready');
  ok(descriptor.nonClaims.includes('not-live-enforcement'), 'Shadow runtime activation runner: live enforcement is a non-claim');
  ok(descriptor.nonClaims.includes('not-policy-activation'), 'Shadow runtime activation runner: policy activation is a non-claim');
  ok(descriptor.nonClaims.includes('not-production-readiness'), 'Shadow runtime activation runner: production readiness is a non-claim');
}

function testRunnerCallsPipelineFromClaimedWork(): void {
  const event = fixtureEvent();
  const claim = fixtureClaim(event);
  const result = runShadowRuntimeActivation({
    claim,
    event,
    projectionOptions: {
      authorityRefDigest: digestD,
      coverageRefDigest: digestE,
      policyScopeRefDigest: digestD,
      freshnessWindowSeconds: 300,
    },
    generatedAt,
    reviewerCapacityPerHour: 12,
    currentReviewRatePerMinute: 1,
  });

  equal(result.version, SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION, 'Shadow runtime activation runner: result version is explicit');
  equal(result.sourceClaimContractVersion, SHADOW_DISPATCH_CLAIM_CONTRACT_VERSION, 'Shadow runtime activation runner: result binds R04 claim contract');
  equal(result.sourceClaimTokenVersion, SHADOW_DISPATCH_CLAIM_TOKEN_VERSION, 'Shadow runtime activation runner: result binds R04 token');
  equal(result.sourceWorkItemContractVersion, SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION, 'Shadow runtime activation runner: result binds R03 work item contract');
  equal(result.sourceWorkItemEventType, SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE, 'Shadow runtime activation runner: result binds R03 event type');
  equal(result.shadowRuntimePipelineVersion, SHADOW_RUNTIME_PIPELINE_VERSION, 'Shadow runtime activation runner: result binds W05 pipeline');
  equal(result.activationStatus, 'shadow-dry-run-complete', 'Shadow runtime activation runner: activation status is dry-run complete');
  equal(result.executionMode, 'shadow-only', 'Shadow runtime activation runner: result is shadow-only');
  equal(result.claimTokenDigest, claim.claimTokenDigest, 'Shadow runtime activation runner: claim token digest is retained');
  equal(result.claimLeaseDigest, claim.claimLeaseDigest, 'Shadow runtime activation runner: claim lease digest is retained');
  equal(result.workerRefDigest, claim.workerRefDigest, 'Shadow runtime activation runner: worker digest is retained');
  equal(result.claimAttempt, claim.claimAttempt, 'Shadow runtime activation runner: claim attempt is retained');
  equal(result.claimedAt, claim.claimedAt, 'Shadow runtime activation runner: claimedAt is retained');
  equal(result.claimExpiresAt, claim.claimExpiresAt, 'Shadow runtime activation runner: claim expiry is retained');
  equal(result.sourceEventDigest, event.digest, 'Shadow runtime activation runner: source event digest is retained');
  equal(result.tenantRefDigest, event.tenantRefDigest, 'Shadow runtime activation runner: tenant digest is retained');
  equal(result.sourcePartitionDigest, claim.sourcePartitionDigest, 'Shadow runtime activation runner: source partition is retained');
  equal(result.sourceHistoryRefDigest, claim.sourceHistoryRefDigest, 'Shadow runtime activation runner: source history is retained');
  equal(result.activationWorkKeyDigest, claim.activationWorkKeyDigest, 'Shadow runtime activation runner: activation work key is retained');
  equal(result.outboxWorkItemDigest, claim.outboxWorkItemDigest, 'Shadow runtime activation runner: outbox work item digest is retained');
  ok(result.runnerInvocationDigest.startsWith('sha256:'), 'Shadow runtime activation runner: runner invocation digest is generated');
  equal(result.pipelineDigest, result.pipeline.digest, 'Shadow runtime activation runner: pipeline digest is bound');
  equal(result.projectionDigest, result.pipeline.projection.digest, 'Shadow runtime activation runner: projection digest is bound');
  equal(result.envelopeRefDigest, result.pipeline.projection.envelopeRefDigest, 'Shadow runtime activation runner: envelope ref digest is bound');
  equal(result.assurancePacketDigest, result.pipeline.assurancePacket.digest, 'Shadow runtime activation runner: assurance packet digest is bound');
  equal(result.generatedAt, generatedAt, 'Shadow runtime activation runner: generatedAt is retained');
  equal(result.pipeline.version, SHADOW_RUNTIME_PIPELINE_VERSION, 'Shadow runtime activation runner: pipeline ran W05');
  equal(result.pipeline.executionMode, 'shadow-only', 'Shadow runtime activation runner: nested pipeline is shadow-only');
  equal(result.pipeline.canAdmit, false, 'Shadow runtime activation runner: nested pipeline cannot admit');
  equal(result.reasonCodes.includes('runner:runShadowRuntimePipelineDryRun'), true, 'Shadow runtime activation runner: reason codes name the runner');
  equal(result.claimLeaseChecked, true, 'Shadow runtime activation runner: claim lease check flag is true');
  equal(result.runnerInvocationIncluded, true, 'Shadow runtime activation runner: invocation included flag is true');
  equal(result.dryRunOnly, true, 'Shadow runtime activation runner: dry-run-only flag is true');
  equal(result.workerBehaviorIncluded, false, 'Shadow runtime activation runner: worker behavior remains excluded');
  equal(result.claimStorageMutationIncluded, false, 'Shadow runtime activation runner: claim storage mutation remains excluded');
  equal(result.outboxWriteIncluded, false, 'Shadow runtime activation runner: outbox write remains excluded');
  equal(result.auditPlaneWriteIncluded, false, 'Shadow runtime activation runner: audit write remains excluded');
  equal(result.packetSigningIncluded, false, 'Shadow runtime activation runner: packet signing remains excluded');
  equal(result.grantsAuthority, false, 'Shadow runtime activation runner: grants no authority');
  equal(result.canAdmit, false, 'Shadow runtime activation runner: cannot admit');
  equal(result.activatesEnforcement, false, 'Shadow runtime activation runner: cannot enforce');
  equal(result.autoEnforce, false, 'Shadow runtime activation runner: cannot auto-enforce');
  equal(result.learnsFromTraffic, false, 'Shadow runtime activation runner: does not learn');
  equal(result.crossTenantAggregation, false, 'Shadow runtime activation runner: has no cross-tenant aggregation');
  equal(result.productionReady, false, 'Shadow runtime activation runner: is not production ready');
  ok(result.digest.startsWith('sha256:'), 'Shadow runtime activation runner: full digest is generated');
}

function testRunnerIsDeterministicAndDoesNotMutateInputs(): void {
  const event = fixtureEvent();
  const claim = fixtureClaim(event);
  const beforeEvent = JSON.stringify(event);
  const beforeClaim = JSON.stringify(claim);
  const first = runShadowRuntimeActivation({ claim, event, generatedAt });
  const second = runShadowRuntimeActivation({ claim, event, generatedAt });

  equal(JSON.stringify(event), beforeEvent, 'Shadow runtime activation runner: event is not mutated');
  equal(JSON.stringify(claim), beforeClaim, 'Shadow runtime activation runner: claim is not mutated');
  equal(first.runnerInvocationDigest, second.runnerInvocationDigest, 'Shadow runtime activation runner: invocation digest is deterministic');
  equal(first.pipelineDigest, second.pipelineDigest, 'Shadow runtime activation runner: pipeline digest is deterministic');
  equal(first.digest, second.digest, 'Shadow runtime activation runner: full digest is deterministic');
}

function testRunnerFailsClosedForUnsafeInputs(): void {
  const event = fixtureEvent();
  const claim = fixtureClaim(event);

  throws(
    () =>
      runShadowRuntimeActivation({
        claim,
        event: { ...event, digest: digestF } as never,
        generatedAt,
      }),
    /event digest must match claim sourceEventDigest/u,
    'Shadow runtime activation runner: event digest mismatch fails closed',
  );
  throws(
    () =>
      runShadowRuntimeActivation({
        claim,
        event: { ...event, tenantRefDigest: digestF } as never,
        generatedAt,
      }),
    /event tenantRefDigest must match claim tenantRefDigest/u,
    'Shadow runtime activation runner: tenant digest mismatch fails closed',
  );
  throws(
    () =>
      runShadowRuntimeActivation({
        claim,
        event: { ...event, rawPayloadStored: true } as never,
        generatedAt,
      }),
    /event must not store raw payload material/u,
    'Shadow runtime activation runner: raw payload event fails closed',
  );
  throws(
    () =>
      runShadowRuntimeActivation({
        claim,
        event,
        generatedAt: '2026-05-19T10:01:59.000Z',
      }),
    /generatedAt cannot be before claim\.claimedAt/u,
    'Shadow runtime activation runner: pre-claim generatedAt fails closed',
  );
  throws(
    () =>
      runShadowRuntimeActivation({
        claim,
        event,
        generatedAt: '2026-05-19T10:05:01.000Z',
      }),
    /generatedAt cannot be after claim\.claimExpiresAt/u,
    'Shadow runtime activation runner: expired lease generatedAt fails closed',
  );
  throws(
    () =>
      runShadowRuntimeActivation({
        claim: { ...claim, version: 'attestor.other.v1' } as never,
        event,
        generatedAt,
      }),
    /claim\.version must be attestor\.shadow-dispatch-claim-contract\.v1/u,
    'Shadow runtime activation runner: wrong claim version fails closed',
  );
  throws(
    () =>
      runShadowRuntimeActivation({
        claim: { ...claim, canAdmit: true } as never,
        event,
        generatedAt,
      }),
    /claim\.canAdmit must be false/u,
    'Shadow runtime activation runner: authority-upgraded claim fails closed',
  );
}

function testDocsOverviewLedgerAndPackageSurfaceStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'shadow-runtime-activation-runner.md');
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
    '# Shadow Runtime Activation Runner',
    'attestor.shadow-runtime-activation-runner.v1',
    'runShadowRuntimePipelineDryRun',
    'shadow-dry-run-complete',
    'claim lease',
    'event digest',
    'tenant digest',
    'NASA Runtime Assurance',
    'Kubernetes controller',
    'OPA Decision Logs',
    'OpenTelemetry',
    'not worker behavior',
    'not live enforcement',
    'not policy activation',
    'not production readiness',
  ]) {
    includes(doc, expected, `Shadow runtime activation runner doc: records ${expected}`);
  }

  for (const expected of [
    'Progress: 7/8 complete after R07. 1 step remains.',
    '| R05 | complete | Shadow Runtime Activation Runner |',
    '| R06 | complete | Trace / Lineage / Measurement Hooks |',
    '| R07 | complete | Outcome Feedback Hook |',
    'src/consequence-admission/shadow-runtime-activation-runner.ts',
    'src/consequence-admission/shadow-runtime-observability-hooks.ts',
    'src/consequence-admission/shadow-runtime-outcome-feedback-hook.ts',
    'tests/shadow-runtime-activation-runner.test.ts',
    'docs/02-architecture/shadow-runtime-activation-runner.md',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  for (const expected of [
    'Current progress after R07:',
    '7/8 complete, 1 step remains.',
    '| R05 | complete | Shadow Runtime Activation Runner |',
    '| R06 | complete | Trace / Lineage / Measurement Hooks |',
    '| R07 | complete | Outcome Feedback Hook |',
    'The next safe step is R08',
  ]) {
    includes(decisionPacket, expected, `Runtime activation packet: records ${expected}`);
  }

  includes(
    ledger,
    'docs/02-architecture/shadow-runtime-activation-runner.md',
    'Research ledger: indexes shadow runtime activation runner',
  );
  equal(
    packageJson.scripts['test:shadow-runtime-activation-runner'],
    'tsx tests/shadow-runtime-activation-runner.test.ts',
    'Package scripts: exposes shadow runtime activation runner test',
  );
  includes(
    packageProbe,
    'SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION',
    'Package surface probe: covers shadow runtime activation runner export',
  );
}

testDescriptorRecordsShadowOnlyActivationBoundary();
testRunnerCallsPipelineFromClaimedWork();
testRunnerIsDeterministicAndDoesNotMutateInputs();
testRunnerFailsClosedForUnsafeInputs();
testDocsOverviewLedgerAndPackageSurfaceStayAligned();

console.log(`shadow-runtime-activation-runner tests passed (${passed} assertions)`);
