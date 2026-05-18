import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  ASSURANCE_MEASUREMENT_PLANE_VERSION,
  DECISION_TRACE_LOGGER_VERSION,
  RUNTIME_MONITOR_SKELETON_VERSION,
  SHADOW_RUNTIME_PIPELINE_VERSION,
  createAssuranceMeasurementPlane,
  createCanonicalShadowEvent,
  createDecisionTraceLogger,
  createOutcomeIncidentFeedbackContract,
  createRuntimeMonitorSkeleton,
  runtimeMonitorSkeletonDescriptor,
  runShadowRuntimePipelineDryRun,
  type CreateRuntimeMonitorSkeletonInput,
  type DecisionTraceSnapshot,
  type RuntimeMonitorFinding,
  type ShadowRuntimePipelineResult,
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
const digest0 = `sha256:${'0'.repeat(64)}`;
const digest1 = `sha256:${'1'.repeat(64)}`;
const digest2 = `sha256:${'2'.repeat(64)}`;
const digest3 = `sha256:${'3'.repeat(64)}`;
const digest4 = `sha256:${'4'.repeat(64)}`;
const digest5 = `sha256:${'5'.repeat(64)}`;
const digest6 = `sha256:${'6'.repeat(64)}`;
const digest7 = `sha256:${'7'.repeat(64)}`;
const digest8 = `sha256:${'8'.repeat(64)}`;
const digest9 = `sha256:${'9'.repeat(64)}`;

function fixturePipeline(): ShadowRuntimePipelineResult {
  const event = createCanonicalShadowEvent({
    occurredAt: '2026-05-18T17:00:00.000Z',
    sourceKind: 'target-system-shadow',
    producer: 'attestor.runtime-monitor-skeleton.test',
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
  return runShadowRuntimePipelineDryRun({
    event,
    projectionOptions: {
      authorityRefDigest: digestD,
      coverageRefDigest: digestE,
      policyScopeRefDigest: digestF,
      freshnessWindowSeconds: 300,
    },
    generatedAt: '2026-05-18T17:00:01.000Z',
  });
}

function fixtureTrace(pipeline: ShadowRuntimePipelineResult): DecisionTraceSnapshot {
  const logger = createDecisionTraceLogger({
    traceId: 'trace:i10:runtime-monitor',
    ttlSeconds: 3600,
    now: () => '2026-05-18T17:00:00.000Z',
  });
  logger.recordPipeline(pipeline, '2026-05-18T17:00:02.000Z');
  return logger.snapshot('2026-05-18T17:30:00.000Z');
}

function input(
  overrides?: Partial<CreateRuntimeMonitorSkeletonInput>,
): CreateRuntimeMonitorSkeletonInput {
  const pipeline = overrides?.pipeline ?? fixturePipeline();
  const traceSnapshot = overrides?.traceSnapshot ?? fixtureTrace(pipeline);
  return {
    pipeline,
    traceSnapshot,
    monitorId: 'runtime-monitor:i10:refund-authority',
    observedAt: '2026-05-18T17:05:00.000Z',
    observerRefDigest: digest0,
    tenantRefDigest: digestA,
    scopeDigest: digestB,
    targetClaimNodeId: 'claim:refund-runtime-monitor',
    ...overrides,
  };
}

function degradedMeasurement(pipeline: ShadowRuntimePipelineResult) {
  const feedback = createOutcomeIncidentFeedbackContract({
    assurancePacket: pipeline.assurancePacket,
    generatedAt: '2026-05-18T17:01:00.000Z',
    feedbackEvents: [{
      eventId: 'operator-annotation-1',
      sourceClass: 'operator-annotation',
      sourceDigest: digest5,
      observedAt: '2026-05-18T17:00:30.000Z',
      state: 'receipted',
      outcome: 'unknown',
      consequenceEffect: 'none',
      confidence: 0.9,
      operatorRefDigest: digest6,
      reasonCodes: ['monitor-fixture'],
    }],
  });
  return createAssuranceMeasurementPlane({
    outcomeFeedback: feedback,
    generatedAt: '2026-05-18T17:02:00.000Z',
    auditEvidenceRefDigests: [digest8],
    metricWindow: {
      windowRefDigest: digest7,
      windowStartedAt: '2026-05-18T16:00:00.000Z',
      windowEndedAt: '2026-05-18T17:00:00.000Z',
      decisionCount: 10,
      reviewDecisionCount: 4,
      falseReviewCount: 0,
      falseAdmitRiskCount: 0,
      abstentionDecisionCount: 1,
      duplicateEvidenceDiscountCount: 1,
      conflictTriggerCount: 1,
      policyGapOpenedCount: 1,
      policyGapClosedCount: 1,
      humanDecisionTotalSeconds: 30,
      humanDecisionCount: 1,
      budgetPressureSignalCount: 0,
      measurementDegradedSeconds: 60,
    },
    degradedSignals: [{
      reason: 'audit-source-unavailable',
      sourceDigest: digest9,
      observedAt: '2026-05-18T17:00:00.000Z',
      durationSeconds: 60,
      visibleToOperator: true,
    }],
    requestedMetricUses: ['operator-dashboard'],
  });
}

function testDescriptorRecordsReadOnlyMonitorBoundary(): void {
  const descriptor = runtimeMonitorSkeletonDescriptor();

  equal(descriptor.version, RUNTIME_MONITOR_SKELETON_VERSION, 'Runtime monitor: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Runtime monitor: binds assurance case');
  equal(descriptor.shadowRuntimePipelineVersion, SHADOW_RUNTIME_PIPELINE_VERSION, 'Runtime monitor: binds shadow pipeline');
  equal(descriptor.decisionTraceLoggerVersion, DECISION_TRACE_LOGGER_VERSION, 'Runtime monitor: binds decision trace logger');
  equal(descriptor.assuranceMeasurementPlaneVersion, ASSURANCE_MEASUREMENT_PLANE_VERSION, 'Runtime monitor: binds measurement plane');
  ok(descriptor.sourceAnchors.includes('nasa-rta-monitor-observes-input-output-computation'), 'Runtime monitor: NASA RTA anchor is present');
  ok(descriptor.sourceAnchors.includes('entrust-dynamic-assurance-cases'), 'Runtime monitor: ENTRUST anchor is present');
  ok(descriptor.sourceAnchors.includes('opentelemetry-log-event-observedtimestamp-trace-context'), 'Runtime monitor: OpenTelemetry anchor is present');
  equal(descriptor.createsEvidenceNodeWhenHealthy, true, 'Runtime monitor: healthy observation creates evidence');
  equal(descriptor.opensUnderminingDefeaterOnInvalidEvidence, true, 'Runtime monitor: invalid evidence opens undermining defeat');
  equal(descriptor.opensUndercuttingDefeaterOnMonitorDegradation, true, 'Runtime monitor: degraded monitor opens undercutting defeat');
  equal(descriptor.requiresVerifiedDecisionTrace, true, 'Runtime monitor: verified trace is required');
  equal(descriptor.requiresPipelineTraceBinding, true, 'Runtime monitor: pipeline trace binding is required');
  equal(descriptor.noAuditWrite, true, 'Runtime monitor: no audit write is allowed');
  equal(descriptor.notRuntimeOracle, true, 'Runtime monitor: descriptor is not a runtime oracle');
  equal(descriptor.canAdmit, false, 'Runtime monitor: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Runtime monitor: descriptor cannot enforce');
  ok(descriptor.nonClaims.includes('not-production-monitoring-readiness'), 'Runtime monitor: production monitoring readiness is a non-claim');
  ok(descriptor.nonClaims.includes('not-siem-or-otel-conformance'), 'Runtime monitor: SIEM/OTel conformance is a non-claim');
}

function testHealthyObservationCreatesEvidenceOnly(): void {
  const record = createRuntimeMonitorSkeleton(input());

  equal(record.version, RUNTIME_MONITOR_SKELETON_VERSION, 'Runtime monitor: record version is explicit');
  equal(record.outcome, 'runtime-monitor-evidence-ready', 'Runtime monitor: healthy observation is evidence-ready');
  equal(record.runtimeEvidenceReady, true, 'Runtime monitor: evidence readiness is true');
  equal(record.evidenceNode?.kind, 'evidence', 'Runtime monitor: evidence node is created');
  equal(record.evidenceTransition?.transitionKind, 'create-node', 'Runtime monitor: evidence transition is create-node');
  equal(record.openDefeater, null, 'Runtime monitor: healthy observation opens no defeater');
  equal(record.findings.length, 0, 'Runtime monitor: healthy observation has no findings');
  equal(record.readOnly, true, 'Runtime monitor: record is read-only');
  equal(record.noRawPayload, true, 'Runtime monitor: raw payload is blocked');
  equal(record.noAuditWrite, true, 'Runtime monitor: audit write is blocked');
  equal(record.notRuntimeOracle, true, 'Runtime monitor: record is not runtime oracle');
  equal(record.grantsAuthority, false, 'Runtime monitor: record grants no authority');
  equal(record.canAdmit, false, 'Runtime monitor: record cannot admit');
  ok(record.digest.startsWith('sha256:'), 'Runtime monitor: record has digest');
}

function testTraceBindingProblemsOpenUnderminingDefeater(): void {
  const pipeline = fixturePipeline();
  const snapshot = fixtureTrace(pipeline);
  const mismatched = createRuntimeMonitorSkeleton(input({
    pipeline,
    traceSnapshot: {
      ...snapshot,
      entries: snapshot.entries.map((entry) => ({
        ...entry,
        pipelineDigest: digest1,
      })),
    },
  }));
  const invalidTrace = createRuntimeMonitorSkeleton(input({
    pipeline,
    traceSnapshot: {
      ...snapshot,
      verification: {
        ...snapshot.verification,
        valid: false,
        failClosed: true,
        failureReasons: ['entry-payload-digest-mismatch'],
      },
    },
  }));

  equal(mismatched.outcome, 'runtime-monitor-open-undermining-defeater', 'Runtime monitor: digest mismatch opens undermining defeater');
  equal(mismatched.openDefeater?.kind, 'undermining', 'Runtime monitor: mismatch defeater is undermining');
  ok(mismatched.findings.includes('trace-pipeline-digest-mismatch'), 'Runtime monitor: mismatch finding is present');
  equal(invalidTrace.outcome, 'runtime-monitor-open-undermining-defeater', 'Runtime monitor: invalid trace opens undermining defeater');
  ok(invalidTrace.findings.includes('trace-verification-failed'), 'Runtime monitor: trace verification finding is present');
}

function testMeasurementDegradationOpensUndercuttingDefeater(): void {
  const pipeline = fixturePipeline();
  const record = createRuntimeMonitorSkeleton(input({
    pipeline,
    traceSnapshot: fixtureTrace(pipeline),
    measurementPlane: degradedMeasurement(pipeline),
  }));

  equal(record.outcome, 'runtime-monitor-open-undercutting-defeater', 'Runtime monitor: measurement degradation opens undercutting defeater');
  equal(record.opensUndercuttingDefeater, true, 'Runtime monitor: undercutting flag is true');
  equal(record.openDefeater?.kind, 'undercutting', 'Runtime monitor: degraded measurement defeater is undercutting');
  ok(record.findings.includes('measurement-plane-degraded'), 'Runtime monitor: measurement degraded finding is present');
  ok(record.observationKinds.includes('monitor-degraded-observed'), 'Runtime monitor: degraded observation kind is present');
}

function testStaleAndClockSkewFindingsAreFailVisible(): void {
  const stale = createRuntimeMonitorSkeleton(input({
    observedAt: '2026-05-18T19:00:00.000Z',
    maxObservationAgeSeconds: 60,
  }));
  const skewed = createRuntimeMonitorSkeleton(input({
    observedAt: '2026-05-18T16:59:00.000Z',
  }));

  equal(stale.outcome, 'runtime-monitor-open-undermining-defeater', 'Runtime monitor: stale observation opens undermining defeater');
  ok(stale.findings.includes('stale-observation'), 'Runtime monitor: stale finding is present');
  equal(skewed.outcome, 'runtime-monitor-open-undercutting-defeater', 'Runtime monitor: clock skew opens undercutting defeater');
  ok(skewed.findings.includes('clock-skew'), 'Runtime monitor: clock skew finding is present');
}

function testBoundaryRequestsReject(): void {
  const cases: readonly [
    Partial<CreateRuntimeMonitorSkeletonInput>,
    RuntimeMonitorFinding,
  ][] = [
    [{ rawPayloadRequested: true }, 'raw-payload-requested'],
    [{ rawTraceRequested: true }, 'raw-trace-requested'],
    [{ auditWriteRequested: true }, 'audit-write-requested'],
    [{ policyActivationRequested: true }, 'policy-activation-requested'],
    [{ liveEnforcementRequested: true }, 'live-enforcement-requested'],
    [{ authorityActionRequested: true }, 'authority-action-requested'],
  ];

  for (const [overrides, finding] of cases) {
    const record = createRuntimeMonitorSkeleton(input(overrides));
    equal(record.outcome, 'runtime-monitor-rejected-boundary', `Runtime monitor: ${finding} rejects boundary`);
    ok(record.findings.includes(finding), `Runtime monitor: ${finding} finding is present`);
    equal(record.evidenceNode, null, `Runtime monitor: ${finding} creates no evidence`);
    equal(record.openDefeater, null, `Runtime monitor: ${finding} opens no defeater`);
  }
}

function testValidationDeterminismAndNoMutation(): void {
  throws(
    () => createRuntimeMonitorSkeleton(input({
      observerRefDigest: 'not-a-digest',
    })),
    /observerRefDigest must be a sha256 digest/u,
    'Runtime monitor: bad observer digest fails closed',
  );
  throws(
    () => createRuntimeMonitorSkeleton(input({
      maxObservationAgeSeconds: 0,
    })),
    /maxObservationAgeSeconds must be a positive integer/u,
    'Runtime monitor: non-positive freshness window fails closed',
  );

  const source = input();
  const before = JSON.stringify(source);
  const first = createRuntimeMonitorSkeleton(source);
  const second = createRuntimeMonitorSkeleton(source);

  equal(first.digest, second.digest, 'Runtime monitor: identical input yields identical digest');
  equal(JSON.stringify(source), before, 'Runtime monitor: input is not mutated');
  ok(Object.isFrozen(first), 'Runtime monitor: output is frozen');
}

function testDocsAndPackageSurface(): void {
  const docs = readProjectFile('docs', '02-architecture', 'runtime-monitor-skeleton.md');
  const overview = readProjectFile('docs', '02-architecture', 'consequence-runtime-assurance-overview.md');
  const annex = readProjectFile('docs', 'research', 'cross-domain-pattern-sources.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageProbe = readProjectFile('scripts', 'probe-consequence-admission-package-surface.mjs');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(docs, '# Runtime Monitor Skeleton', 'Runtime monitor docs: title is present');
  includes(docs, 'attestor.runtime-monitor-skeleton.v1', 'Runtime monitor docs: version is present');
  includes(docs, 'not-runtime-enforcement-monitor', 'Runtime monitor docs: enforcement non-claim is present');
  includes(docs, 'not-siem-or-otel-conformance', 'Runtime monitor docs: OTel conformance non-claim is present');
  includes(overview, 'Progress: 12/14 complete after I11. 2 steps remain.', 'Overview: I10 progress is updated');
  includes(overview, '| I10 | complete | Runtime Monitor Skeleton |', 'Overview: I10 is complete');
  includes(overview, 'src/consequence-admission/runtime-monitor-skeleton.ts', 'Overview: I10 source file is tracked');
  includes(overview, 'I10 turns W05/W06 runtime observations', 'Overview: I10 explanation is present');
  includes(annex, 'Runtime monitor skeleton', 'Research annex: I10 anchor is present');
  includes(ledger, 'docs/02-architecture/runtime-monitor-skeleton.md', 'Research ledger: I10 doc is indexed');
  includes(packageProbe, 'RUNTIME_MONITOR_SKELETON_VERSION', 'Package probe: I10 version is checked');
  includes(packageProbe, 'createRuntimeMonitorSkeleton', 'Package probe: I10 builder is checked');
  equal(
    packageJson.scripts['test:runtime-monitor-skeleton'],
    'tsx tests/runtime-monitor-skeleton.test.ts',
    'Runtime monitor: package script is registered',
  );
}

testDescriptorRecordsReadOnlyMonitorBoundary();
testHealthyObservationCreatesEvidenceOnly();
testTraceBindingProblemsOpenUnderminingDefeater();
testMeasurementDegradationOpensUndercuttingDefeater();
testStaleAndClockSkewFindingsAreFailVisible();
testBoundaryRequestsReject();
testValidationDeterminismAndNoMutation();
testDocsAndPackageSurface();

console.log(`Runtime monitor skeleton tests: ${passed} passed, 0 failed`);
