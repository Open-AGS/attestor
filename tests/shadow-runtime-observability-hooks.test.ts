import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  ASSURANCE_MEASUREMENT_PLANE_VERSION,
  DECISION_LINEAGE_GRAPH_VERSION,
  DECISION_TRACE_LOGGER_VERSION,
  RUNTIME_MONITOR_SKELETON_VERSION,
  SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
  SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
  SHADOW_RUNTIME_PIPELINE_VERSION,
  createCanonicalShadowEvent,
  createShadowActivationProfileContract,
  createShadowDispatchClaimContract,
  createShadowOutboxWorkItemContract,
  runShadowRuntimeActivation,
  runShadowRuntimeObservabilityHooks,
  shadowRuntimeObservabilityHooksDescriptor,
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
const occurredAt = '2026-05-19T11:00:00.000Z';
const requestedAt = '2026-05-19T11:01:00.000Z';
const claimedAt = '2026-05-19T11:02:00.000Z';
const generatedAt = '2026-05-19T11:03:00.000Z';
const observedAt = '2026-05-19T11:03:05.000Z';

function fixtureEvent() {
  return createCanonicalShadowEvent({
    occurredAt,
    sourceKind: 'target-system-shadow',
    producer: 'attestor.shadow-runtime-observability-hooks.test',
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
  });
}

function fixtureActivation() {
  const event = fixtureEvent();
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
  const claim = createShadowDispatchClaimContract({
    workItem,
    workerRefDigest: digestF,
    claimedAt,
    dispatcherRunDigest: digestD,
  });
  return runShadowRuntimeActivation({
    claim,
    event,
    generatedAt,
    projectionOptions: {
      authorityRefDigest: digestD,
      coverageRefDigest: digestE,
      policyScopeRefDigest: digestD,
      freshnessWindowSeconds: 300,
    },
  });
}

function testDescriptorRecordsHookBoundary(): void {
  const descriptor = shadowRuntimeObservabilityHooksDescriptor();

  equal(descriptor.version, SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION, 'Shadow runtime observability hooks: descriptor version is explicit');
  equal(descriptor.shadowRuntimeActivationRunnerVersion, SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION, 'Shadow runtime observability hooks: descriptor binds R05 activation');
  equal(descriptor.shadowRuntimePipelineVersion, SHADOW_RUNTIME_PIPELINE_VERSION, 'Shadow runtime observability hooks: descriptor binds W05 pipeline');
  equal(descriptor.decisionTraceLoggerVersion, DECISION_TRACE_LOGGER_VERSION, 'Shadow runtime observability hooks: descriptor binds W06 trace logger');
  equal(descriptor.runtimeMonitorSkeletonVersion, RUNTIME_MONITOR_SKELETON_VERSION, 'Shadow runtime observability hooks: descriptor binds runtime monitor skeleton');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Shadow runtime observability hooks: descriptor binds assurance case');
  equal(descriptor.decisionLineageGraphVersion, DECISION_LINEAGE_GRAPH_VERSION, 'Shadow runtime observability hooks: descriptor binds lineage graph');
  equal(descriptor.assuranceMeasurementPlaneVersion, ASSURANCE_MEASUREMENT_PLANE_VERSION, 'Shadow runtime observability hooks: descriptor binds measurement plane');
  ok(descriptor.sourceAnchors.includes('opentelemetry-log-trace-context-correlation'), 'Shadow runtime observability hooks: OpenTelemetry anchor is present');
  ok(descriptor.sourceAnchors.includes('w3c-trace-context-correlation-not-authority'), 'Shadow runtime observability hooks: W3C Trace Context anchor is present');
  ok(descriptor.sourceAnchors.includes('opa-decision-logs-input-output-boundary'), 'Shadow runtime observability hooks: OPA decision log anchor is present');
  ok(descriptor.sourceAnchors.includes('nasa-runtime-assurance-monitor-not-controller'), 'Shadow runtime observability hooks: NASA RTA anchor is present');
  equal(descriptor.traceHooked, true, 'Shadow runtime observability hooks: trace hook is explicit');
  equal(descriptor.lineageHooked, true, 'Shadow runtime observability hooks: lineage hook is explicit');
  equal(descriptor.measurementHookOptional, true, 'Shadow runtime observability hooks: measurement hook is optional');
  equal(descriptor.requiresR05Activation, true, 'Shadow runtime observability hooks: R05 activation is required');
  equal(descriptor.requiresVerifiedTraceSnapshot, true, 'Shadow runtime observability hooks: verified trace snapshot is required');
  equal(descriptor.writesAuditPlane, false, 'Shadow runtime observability hooks: descriptor cannot write audit plane');
  equal(descriptor.writesExternalTraceBackend, false, 'Shadow runtime observability hooks: descriptor cannot export traces');
  equal(descriptor.externalLineageExportIncluded, false, 'Shadow runtime observability hooks: descriptor cannot export lineage');
  equal(descriptor.measurementAuthorityIncluded, false, 'Shadow runtime observability hooks: descriptor gives measurement no authority');
  equal(descriptor.canAdmit, false, 'Shadow runtime observability hooks: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Shadow runtime observability hooks: descriptor cannot enforce');
  equal(descriptor.productionReady, false, 'Shadow runtime observability hooks: descriptor is not production ready');
  ok(descriptor.nonClaims.includes('not-audit-plane-write'), 'Shadow runtime observability hooks: audit write is a non-claim');
  ok(descriptor.nonClaims.includes('not-outcome-feedback-hook'), 'Shadow runtime observability hooks: outcome feedback is a non-claim');
}

function testHooksBindTraceMonitorCaseAndLineage(): void {
  const activation = fixtureActivation();
  const result = runShadowRuntimeObservabilityHooks({
    activation,
    observedAt,
    observerRefDigest: digestF,
    scopeDigest: digestB,
  });

  equal(result.version, SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION, 'Shadow runtime observability hooks: result version is explicit');
  equal(result.hookStatus, 'trace-lineage-measurement-bound', 'Shadow runtime observability hooks: status is bound');
  equal(result.executionMode, 'shadow-only', 'Shadow runtime observability hooks: execution mode is shadow-only');
  equal(result.activationDigest, activation.digest, 'Shadow runtime observability hooks: activation digest is bound');
  equal(result.runnerInvocationDigest, activation.runnerInvocationDigest, 'Shadow runtime observability hooks: invocation digest is bound');
  equal(result.pipelineDigest, activation.pipelineDigest, 'Shadow runtime observability hooks: pipeline digest is bound');
  equal(result.envelopeRefDigest, activation.envelopeRefDigest, 'Shadow runtime observability hooks: envelope digest is bound');
  equal(result.tenantRefDigest, activation.tenantRefDigest, 'Shadow runtime observability hooks: tenant digest is bound');
  equal(result.traceSnapshotDigest, result.traceSnapshot.digest, 'Shadow runtime observability hooks: trace snapshot digest is bound');
  equal(result.traceSnapshot.verification.valid, true, 'Shadow runtime observability hooks: trace snapshot verifies');
  equal(result.runtimeMonitorDigest, result.runtimeMonitor.digest, 'Shadow runtime observability hooks: monitor digest is bound');
  equal(result.runtimeMonitor.pipelineDigest, activation.pipelineDigest, 'Shadow runtime observability hooks: monitor observes pipeline');
  equal(result.runtimeMonitor.traceSnapshotDigest, result.traceSnapshot.digest, 'Shadow runtime observability hooks: monitor observes trace');
  equal(result.assuranceCaseDigest, result.assuranceCase.digest, 'Shadow runtime observability hooks: assurance case digest is bound');
  equal(result.assuranceCase.rootClaimId, result.runtimeMonitor.targetClaimNodeId, 'Shadow runtime observability hooks: assurance case root is monitor target claim');
  equal(result.lineageGraphDigest, result.lineageGraph.digest, 'Shadow runtime observability hooks: lineage digest is bound');
  equal(result.lineageGraph.caseDigest, result.assuranceCase.digest, 'Shadow runtime observability hooks: lineage is built from assurance case');
  equal(result.measurementPlaneDigest, null, 'Shadow runtime observability hooks: measurement is optional and absent');
  equal(result.traceHooked, true, 'Shadow runtime observability hooks: trace hook flag is true');
  equal(result.lineageHooked, true, 'Shadow runtime observability hooks: lineage hook flag is true');
  equal(result.measurementHooked, false, 'Shadow runtime observability hooks: measurement hook flag is false when absent');
  equal(result.writesAuditPlane, false, 'Shadow runtime observability hooks: result cannot write audit plane');
  equal(result.writesExternalTraceBackend, false, 'Shadow runtime observability hooks: result cannot export trace');
  equal(result.externalLineageExportIncluded, false, 'Shadow runtime observability hooks: result cannot export lineage');
  equal(result.measurementAuthorityIncluded, false, 'Shadow runtime observability hooks: result gives measurement no authority');
  equal(result.canAdmit, false, 'Shadow runtime observability hooks: result cannot admit');
  equal(result.grantsAuthority, false, 'Shadow runtime observability hooks: result grants no authority');
  equal(result.activatesEnforcement, false, 'Shadow runtime observability hooks: result cannot enforce');
  equal(result.rawPayloadRead, false, 'Shadow runtime observability hooks: result reads no raw payload');
  equal(result.productionReady, false, 'Shadow runtime observability hooks: result is not production ready');
  ok(result.digest.startsWith('sha256:'), 'Shadow runtime observability hooks: full digest is generated');
}

function testHooksAreDeterministicAndDoNotMutateInput(): void {
  const activation = fixtureActivation();
  const before = JSON.stringify(activation);
  const first = runShadowRuntimeObservabilityHooks({
    activation,
    observedAt,
    observerRefDigest: digestF,
    scopeDigest: digestB,
  });
  const second = runShadowRuntimeObservabilityHooks({
    activation,
    observedAt,
    observerRefDigest: digestF,
    scopeDigest: digestB,
  });

  equal(JSON.stringify(activation), before, 'Shadow runtime observability hooks: activation is not mutated');
  equal(first.traceSnapshotDigest, second.traceSnapshotDigest, 'Shadow runtime observability hooks: trace snapshot digest is deterministic');
  equal(first.runtimeMonitorDigest, second.runtimeMonitorDigest, 'Shadow runtime observability hooks: runtime monitor digest is deterministic');
  equal(first.assuranceCaseDigest, second.assuranceCaseDigest, 'Shadow runtime observability hooks: assurance case digest is deterministic');
  equal(first.lineageGraphDigest, second.lineageGraphDigest, 'Shadow runtime observability hooks: lineage graph digest is deterministic');
  equal(first.digest, second.digest, 'Shadow runtime observability hooks: full digest is deterministic');
}

function testHooksFailClosedForUnsafeInputs(): void {
  const activation = fixtureActivation();

  throws(
    () => runShadowRuntimeObservabilityHooks({
      activation: { ...activation, version: 'attestor.other.v1' } as never,
      observedAt,
      observerRefDigest: digestF,
      scopeDigest: digestB,
    }),
    /activation\.version must be attestor\.shadow-runtime-activation-runner\.v1/u,
    'Shadow runtime observability hooks: wrong activation version fails closed',
  );
  throws(
    () => runShadowRuntimeObservabilityHooks({
      activation: { ...activation, pipelineDigest: digestF } as never,
      observedAt,
      observerRefDigest: digestF,
      scopeDigest: digestB,
    }),
    /activation pipeline digest mismatch/u,
    'Shadow runtime observability hooks: pipeline digest mismatch fails closed',
  );
  throws(
    () => runShadowRuntimeObservabilityHooks({
      activation: { ...activation, canAdmit: true } as never,
      observedAt,
      observerRefDigest: digestF,
      scopeDigest: digestB,
    }),
    /activation\.canAdmit must be false/u,
    'Shadow runtime observability hooks: authority-upgraded activation fails closed',
  );
  throws(
    () => runShadowRuntimeObservabilityHooks({
      activation,
      observedAt: 'not-a-date',
      observerRefDigest: digestF,
      scopeDigest: digestB,
    }),
    /observedAt must be an ISO timestamp/u,
    'Shadow runtime observability hooks: invalid observedAt fails closed',
  );
  throws(
    () => runShadowRuntimeObservabilityHooks({
      activation,
      observedAt,
      observerRefDigest: 'raw-observer',
      scopeDigest: digestB,
    }),
    /observerRefDigest must be a sha256 digest/u,
    'Shadow runtime observability hooks: raw observer id fails closed',
  );
}

function testDocsOverviewLedgerAndPackageSurfaceStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'shadow-runtime-observability-hooks.md');
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
    '# Shadow Runtime Observability Hooks',
    'attestor.shadow-runtime-observability-hooks.v1',
    'attestor.decision-trace-logger.v1',
    'attestor.runtime-monitor-skeleton.v1',
    'attestor.assurance-case.v1',
    'attestor.decision-lineage-graph.v1',
    'attestor.assurance-measurement-plane.v1',
    'OpenTelemetry',
    'W3C Trace Context',
    'OPA Decision Logs',
    'NASA Runtime Assurance',
    'not audit-plane write',
    'not external OTel export',
    'not outcome feedback hook',
    'not production readiness',
  ]) {
    includes(doc, expected, `Shadow runtime observability hooks doc: records ${expected}`);
  }

  for (const expected of [
    'Progress: 8/8 complete after R08. 0 steps remain.',
    '| R06 | complete | Trace / Lineage / Measurement Hooks |',
    '| R07 | complete | Outcome Feedback Hook |',
    '| R08 | complete | End-to-End Fixture Replay Smoke |',
    'src/consequence-admission/shadow-runtime-observability-hooks.ts',
    'src/consequence-admission/shadow-runtime-outcome-feedback-hook.ts',
    'src/consequence-admission/shadow-runtime-fixture-replay-smoke.ts',
    'tests/shadow-runtime-observability-hooks.test.ts',
    'docs/02-architecture/shadow-runtime-observability-hooks.md',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  for (const expected of [
    'Current progress after R08:',
    '8/8 complete, 0 steps remain.',
    '| R06 | complete | Trace / Lineage / Measurement Hooks |',
    '| R07 | complete | Outcome Feedback Hook |',
    '| R08 | complete | End-to-End Fixture Replay Smoke |',
    'The R-series is complete',
  ]) {
    includes(decisionPacket, expected, `Runtime activation packet: records ${expected}`);
  }

  includes(
    ledger,
    'docs/02-architecture/shadow-runtime-observability-hooks.md',
    'Research ledger: indexes shadow runtime observability hooks',
  );
  equal(
    packageJson.scripts['test:shadow-runtime-observability-hooks'],
    'tsx tests/shadow-runtime-observability-hooks.test.ts',
    'Package scripts: exposes shadow runtime observability hooks test',
  );
  includes(
    packageProbe,
    'SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION',
    'Package surface probe: covers shadow runtime observability hooks export',
  );
}

testDescriptorRecordsHookBoundary();
testHooksBindTraceMonitorCaseAndLineage();
testHooksAreDeterministicAndDoNotMutateInput();
testHooksFailClosedForUnsafeInputs();
testDocsOverviewLedgerAndPackageSurfaceStayAligned();

console.log(`shadow-runtime-observability-hooks tests passed (${passed} assertions)`);
