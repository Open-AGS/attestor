import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_MEASUREMENT_PLANE_VERSION,
  CONFLICT_ABSTENTION_GATE_VERSION,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
  OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
  assuranceMeasurementPlaneDescriptor,
  createAssuranceMeasurementPlane,
  createOutcomeIncidentFeedbackContract,
  createSignedAssurancePacket,
  createSignedAssurancePacketHistoryBinding,
  createSignedAssurancePacketSigningPayload,
  evaluateHumanComprehensionGate,
  type ConflictAbstentionGateResult,
  type CreateSignedAssurancePacketInput,
  type OutcomeIncidentFeedbackContract,
  type SignedAssurancePacket,
  type SignedAssurancePacketSignature,
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

function rejects(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const digestE = `sha256:${'e'.repeat(64)}`;
const digestF = `sha256:${'f'.repeat(64)}`;
const digest1 = `sha256:${'1'.repeat(64)}`;
const digest2 = `sha256:${'2'.repeat(64)}`;
const digest3 = `sha256:${'3'.repeat(64)}`;
const digest4 = `sha256:${'4'.repeat(64)}`;
const digest5 = `sha256:${'5'.repeat(64)}`;
const digest6 = `sha256:${'6'.repeat(64)}`;
const digest7 = `sha256:${'7'.repeat(64)}`;
const digest8 = `sha256:${'8'.repeat(64)}`;
const digest9 = `sha256:${'9'.repeat(64)}`;

function conflictGate(): ConflictAbstentionGateResult {
  return {
    version: CONFLICT_ABSTENTION_GATE_VERSION,
    relationshipAwareMonotoneFusionVersion:
      'attestor.relationship-aware-monotone-fusion.v1',
    signalRelationshipContractVersion: 'attestor.signal-relationship-contract.v1',
    layerOpinionSchemaVersion: 'attestor.layer-opinion-schema.v1',
    modulatorAuthorityTierVersion: 'attestor.modulator-authority-tier.v1',
    envelopeRefDigest: digestA,
    outcome: 'continue',
    conflictScore: 0,
    abstentionScore: 0,
    uncertaintyScore: 0.1,
    coverageGapScore: 0,
    blockPressure: 0,
    reviewPressure: 0.1,
    maxGateScore: 0.1,
    reasonCodes: ['no-admit-authority'],
    reviewedInputs: {
      opinionCount: 1,
      relationshipCount: 1,
      modulatorCount: 1,
      abstentionCount: 0,
      contradictionCount: 0,
      conflictOpinionCount: 0,
    },
    noLoosening: true,
    failClosedOnUncertainty: true,
    runsAfterRelationshipAwareFusion: true,
    canAdmit: false,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };
}

function compactHumanGate() {
  return evaluateHumanComprehensionGate({
    envelopeRefDigest: digestA,
    conflictGate: conflictGate(),
    reasonLineCandidates: [{
      lineId: 'line-1',
      severity: 'info',
      text: 'Measurement plane fixture is compact.',
      sourceDigest: digestB,
      reasonCodes: ['compact-input'],
      actionHint: null,
    }],
    activeQuestions: [],
    reviewLoad: {
      pendingReviewItemCount: 0,
      humanActionItemCount: 0,
      reviewerCapacityPerHour: 20,
      currentReviewRatePerMinute: 0,
    },
  });
}

function signedPacketInput(): CreateSignedAssurancePacketInput {
  const historyVerification = Object.freeze({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    historyId: 'history:measurement-plane',
    valid: true,
    failClosed: false,
    verifiedEntryCount: 3,
    rootDigest: digestC,
    firstEntryDigest: digestC,
    lastEntryDigest: digestD,
    failureReasons: [],
    reasonCodes: ['tamper-history-verified'],
    rawPayloadStored: false,
  });
  return {
    envelopeRefDigest: digestA,
    decisionBinding: {
      decision: 'block',
      decisionSourceDigest: digestB,
      reasonCodes: ['block-decision'],
    },
    historyBinding: createSignedAssurancePacketHistoryBinding(historyVerification),
    historyVerification,
    humanComprehensionGate: compactHumanGate(),
    policyRefDigests: [digestF],
    evidenceRefDigests: [digest1],
    signalRefDigests: [digest2],
    relationshipRefDigests: [digest3],
    replayRefDigests: [digest4],
    generatedAt: '2026-05-17T17:00:00.000Z',
  };
}

function productionSignature(
  input: CreateSignedAssurancePacketInput,
): SignedAssurancePacketSignature {
  const payload = createSignedAssurancePacketSigningPayload(input);
  return {
    algorithm: 'external-kms',
    signature: `external-kms-signature:${payload.digest}`,
    signerRef: 'kms:prod-assurance-packet-signer',
    publicKeyFingerprint: 'kms-fingerprint:prod-assurance-packet-signer',
    signedAt: '2026-05-17T17:00:01.000Z',
    signingBoundary: 'external-kms-hsm',
    payloadDigest: payload.digest,
    productionReady: true,
  };
}

function readyPacket(): SignedAssurancePacket {
  const input = signedPacketInput();
  return createSignedAssurancePacket({
    ...input,
    signature: productionSignature(input),
  });
}

function learningReadyFeedback(): OutcomeIncidentFeedbackContract {
  return createOutcomeIncidentFeedbackContract({
    assurancePacket: readyPacket(),
    generatedAt: '2026-05-17T17:01:00.000Z',
    feedbackEvents: [{
      eventId: 'receipt-1',
      sourceClass: 'downstream-receipt',
      sourceDigest: digest5,
      observedAt: '2026-05-17T17:00:30.000Z',
      state: 'receipted',
      outcome: 'succeeded',
      consequenceEffect: 'none',
      confidence: 0.95,
      replayRefDigest: digest6,
      reasonCodes: ['downstream-success'],
    }],
  });
}

function incidentFeedback(): OutcomeIncidentFeedbackContract {
  return createOutcomeIncidentFeedbackContract({
    assurancePacket: readyPacket(),
    generatedAt: '2026-05-17T17:02:00.000Z',
    feedbackEvents: [{
      eventId: 'incident-1',
      sourceClass: 'confirmed-incident',
      sourceDigest: digest5,
      observedAt: '2026-05-17T17:01:30.000Z',
      state: 'incident',
      outcome: 'failed',
      consequenceEffect: 'tenant-impact',
      confidence: 1,
      incidentRefDigest: digest6,
      postmortemRefDigest: digest7,
      reasonCodes: ['confirmed-incident'],
    }],
  });
}

function metricWindow(overrides: Partial<Parameters<typeof createAssuranceMeasurementPlane>[0]['metricWindow']> = {}) {
  return {
    windowRefDigest: digest7,
    windowStartedAt: '2026-05-17T16:00:00.000Z',
    windowEndedAt: '2026-05-17T17:00:00.000Z',
    decisionCount: 100,
    reviewDecisionCount: 25,
    falseReviewCount: 1,
    falseAdmitRiskCount: 0,
    abstentionDecisionCount: 5,
    duplicateEvidenceDiscountCount: 3,
    conflictTriggerCount: 4,
    policyGapOpenedCount: 4,
    policyGapClosedCount: 3,
    humanDecisionTotalSeconds: 120,
    humanDecisionCount: 4,
    budgetPressureSignalCount: 0,
    measurementDegradedSeconds: 0,
    ...overrides,
  };
}

function healthyMeasurement() {
  return createAssuranceMeasurementPlane({
    outcomeFeedback: learningReadyFeedback(),
    generatedAt: '2026-05-17T17:03:00.000Z',
    auditEvidenceRefDigests: [digest8],
    metricWindow: metricWindow(),
    replayRegressionObservations: [{
      replaySuiteDigest: digest9,
      generatedAt: '2026-05-17T17:02:00.000Z',
      passedCount: 2,
      failedCount: 0,
      skippedCount: 0,
    }],
    budgetScopes: [{
      scopeKind: 'tenant',
      scopeDigest: digestA,
      windowStartedAt: '2026-05-17T16:00:00.000Z',
      windowEndedAt: '2026-05-17T17:00:00.000Z',
      reviewBudgetLimit: 100,
      reviewBudgetUsed: 20,
      safetyBudgetLimit: 10,
      safetyBudgetUsed: 1,
    }],
    driftWindows: [{
      detectorRefDigest: digestB,
      sourceDigest: digestC,
      baselineMean: 0.1,
      slack: 0.05,
      threshold: 1,
      samples: [0.1, 0.12, 0.08],
    }],
    requestedMetricUses: ['operator-dashboard', 'regression-prioritization'],
  });
}

function testDescriptorRecordsReadOnlyMeasurementBoundary(): void {
  const descriptor = assuranceMeasurementPlaneDescriptor();

  equal(
    descriptor.version,
    ASSURANCE_MEASUREMENT_PLANE_VERSION,
    'Assurance measurement: descriptor exposes version',
  );
  equal(
    descriptor.outcomeFeedbackVersion,
    OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
    'Assurance measurement: descriptor links outcome feedback contract',
  );
  ok(
    descriptor.metricIds.includes('false-admit-risk-count'),
    'Assurance measurement: false admit risk metric is present',
  );
  ok(
    descriptor.metricIds.includes('measurement-degraded-time'),
    'Assurance measurement: degraded-time metric is present',
  );
  ok(
    descriptor.budgetScopeKinds.includes('tenant'),
    'Assurance measurement: tenant budget scope is present',
  );
  ok(
    descriptor.degradedReasons.includes('audit-source-unavailable'),
    'Assurance measurement: audit-source degraded reason is present',
  );
  equal(descriptor.readOnly, true, 'Assurance measurement: descriptor is read-only');
  equal(descriptor.readsAuditPlane, true, 'Assurance measurement: descriptor reads audit plane');
  equal(descriptor.writesAuditPlane, false, 'Assurance measurement: descriptor cannot write audit plane');
  equal(descriptor.goodhartProtected, true, 'Assurance measurement: Goodhart protection is explicit');
  equal(descriptor.driftDetectionSupported, true, 'Assurance measurement: drift reporting is supported');
  equal(descriptor.regressionReportingSupported, true, 'Assurance measurement: regression reporting is supported');
  equal(descriptor.scopedBudgetAccountingSupported, true, 'Assurance measurement: scoped budgets are supported');
  equal(descriptor.degradedStateVisible, true, 'Assurance measurement: degraded state is visible');
  equal(descriptor.canAdmit, false, 'Assurance measurement: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Assurance measurement: descriptor cannot enforce');
  equal(descriptor.rawPayloadStored, false, 'Assurance measurement: raw payload storage is blocked');
  equal(descriptor.productionReady, false, 'Assurance measurement: production readiness is not claimed');
}

function testHealthyMeasurementPublishesReadOnlyDashboardOnly(): void {
  const measurement = healthyMeasurement();

  equal(measurement.status, 'healthy', 'Assurance measurement: healthy fixture is healthy');
  equal(measurement.metrics.length, 12, 'Assurance measurement: all initial metrics are emitted');
  equal(measurement.summary.degradedMetricCount, 0, 'Assurance measurement: healthy fixture has no degraded metrics');
  equal(measurement.summary.watchMetricCount, 0, 'Assurance measurement: healthy fixture has no watch metrics');
  equal(measurement.budgetScopes[0]?.pressureBand, 'healthy', 'Assurance measurement: budget is healthy');
  equal(measurement.budgetScopes[0]?.fallsOpen, false, 'Assurance measurement: budget never falls open');
  equal(measurement.driftWindows[0]?.driftDetected, false, 'Assurance measurement: healthy drift fixture does not trigger');
  equal(measurement.dashboardContract.sourceDigestsOnly, true, 'Assurance measurement: dashboard uses digests only');
  equal(measurement.dashboardContract.authorityActionAllowed, false, 'Assurance measurement: dashboard has no authority action');
  equal(measurement.measurementReadOnly, true, 'Assurance measurement: output is read-only');
  equal(measurement.writesAuditPlane, false, 'Assurance measurement: output cannot write audit plane');
  equal(measurement.directGradientSourceAllowed, false, 'Assurance measurement: metrics are not gradient sources');
  equal(measurement.policyRelaxationAllowed, false, 'Assurance measurement: policy relaxation is blocked');
  equal(measurement.automaticPolicyMutationAllowed, false, 'Assurance measurement: policy mutation is blocked');
  equal(measurement.automaticScoreMutationAllowed, false, 'Assurance measurement: score mutation is blocked');
  equal(measurement.automaticCalibrationMutationAllowed, false, 'Assurance measurement: calibration mutation is blocked');
  equal(measurement.llmTrainingAllowed, false, 'Assurance measurement: model training is blocked');
  equal(measurement.canAdmit, false, 'Assurance measurement: result cannot admit');
  equal(measurement.rawPayloadStored, false, 'Assurance measurement: raw payload is not stored');
  ok(
    measurement.digest.startsWith('sha256:'),
    'Assurance measurement: digest is computed',
  );
}

function testGoodhartBoundaryBlocksMetricMisuse(): void {
  const measurement = createAssuranceMeasurementPlane({
    outcomeFeedback: learningReadyFeedback(),
    generatedAt: '2026-05-17T17:04:00.000Z',
    auditEvidenceRefDigests: [digest8],
    metricWindow: metricWindow(),
    requestedMetricUses: ['operator-dashboard', 'policy-relaxation', 'model-training'],
  });

  equal(measurement.status, 'watching', 'Assurance measurement: blocked metric use creates watch state');
  ok(
    measurement.blockedMetricUses.includes('policy-relaxation'),
    'Assurance measurement: policy relaxation metric use is blocked',
  );
  ok(
    measurement.blockedMetricUses.includes('model-training'),
    'Assurance measurement: model training metric use is blocked',
  );
  ok(
    measurement.noGoReasons.includes('blocked-metric-use-requested'),
    'Assurance measurement: blocked metric use is a no-go reason',
  );
  equal(
    measurement.allowedMetricUses.includes('operator-dashboard'),
    true,
    'Assurance measurement: operator dashboard metric use remains allowed',
  );
}

function testDriftDetectionUsesCusumStyleWindow(): void {
  const measurement = createAssuranceMeasurementPlane({
    outcomeFeedback: learningReadyFeedback(),
    generatedAt: '2026-05-17T17:05:00.000Z',
    auditEvidenceRefDigests: [digest8],
    metricWindow: metricWindow(),
    driftWindows: [{
      detectorRefDigest: digestB,
      sourceDigest: digestC,
      baselineMean: 0.1,
      slack: 0,
      threshold: 0.5,
      samples: [0.4, 0.5, 0.6],
    }],
  });

  equal(measurement.status, 'drift-detected', 'Assurance measurement: drift becomes explicit status');
  equal(measurement.driftWindows[0]?.driftDetected, true, 'Assurance measurement: drift window triggers');
  ok(
    measurement.noGoReasons.includes('drift-threshold-exceeded'),
    'Assurance measurement: drift threshold creates no-go reason',
  );
  equal(measurement.summary.driftDetectedCount, 1, 'Assurance measurement: drift summary counts detection');
}

function testReplayFailureRequiresRegression(): void {
  const measurement = createAssuranceMeasurementPlane({
    outcomeFeedback: learningReadyFeedback(),
    generatedAt: '2026-05-17T17:06:00.000Z',
    auditEvidenceRefDigests: [digest8],
    metricWindow: metricWindow(),
    replayRegressionObservations: [{
      replaySuiteDigest: digest9,
      generatedAt: '2026-05-17T17:05:00.000Z',
      passedCount: 9,
      failedCount: 1,
      skippedCount: 0,
    }],
  });

  equal(measurement.status, 'regression-required', 'Assurance measurement: failed replay requires regression');
  ok(
    measurement.noGoReasons.includes('replay-regression-failed'),
    'Assurance measurement: replay failure creates no-go reason',
  );
  equal(measurement.summary.replayFailedCount, 1, 'Assurance measurement: replay failure is counted');
  equal(
    measurement.dashboardContract.operatorTaskKinds.includes('regression-review'),
    true,
    'Assurance measurement: regression review task is visible',
  );
}

function testBudgetOverflowIsVisibleAndNeverFallsOpen(): void {
  const measurement = createAssuranceMeasurementPlane({
    outcomeFeedback: learningReadyFeedback(),
    generatedAt: '2026-05-17T17:07:00.000Z',
    auditEvidenceRefDigests: [digest8],
    metricWindow: metricWindow({ budgetPressureSignalCount: 2 }),
    budgetScopes: [{
      scopeKind: 'tenant',
      scopeDigest: digestA,
      windowStartedAt: '2026-05-17T16:00:00.000Z',
      windowEndedAt: '2026-05-17T17:00:00.000Z',
      reviewBudgetLimit: 10,
      reviewBudgetUsed: 11,
      safetyBudgetLimit: 5,
      safetyBudgetUsed: 3,
      overflowActionRefDigest: digestB,
    }],
  });

  equal(measurement.status, 'budget-pressure', 'Assurance measurement: budget overflow creates pressure status');
  equal(measurement.budgetScopes[0]?.pressureBand, 'overflow', 'Assurance measurement: budget band records overflow');
  equal(measurement.budgetScopes[0]?.fallsOpen, false, 'Assurance measurement: overflow never falls open');
  ok(
    measurement.noGoReasons.includes('budget-overflow'),
    'Assurance measurement: overflow creates no-go reason',
  );
  equal(
    measurement.dashboardContract.alertKinds.includes('budget-pressure'),
    true,
    'Assurance measurement: budget alert is visible',
  );
}

function testMeasurementDegradedIsFailVisible(): void {
  const measurement = createAssuranceMeasurementPlane({
    outcomeFeedback: learningReadyFeedback(),
    generatedAt: '2026-05-17T17:08:00.000Z',
    auditEvidenceRefDigests: [digest8],
    metricWindow: metricWindow({ measurementDegradedSeconds: 30 }),
    degradedSignals: [{
      reason: 'audit-source-unavailable',
      sourceDigest: digestC,
      observedAt: '2026-05-17T17:07:30.000Z',
      durationSeconds: 30,
      visibleToOperator: true,
    }],
  });

  equal(measurement.status, 'measurement-degraded', 'Assurance measurement: degraded state is fail-visible');
  ok(
    measurement.noGoReasons.includes('measurement-degraded'),
    'Assurance measurement: degraded state creates no-go reason',
  );
  equal(measurement.summary.degradedSignalCount, 1, 'Assurance measurement: degraded signal is counted');
  equal(
    measurement.dashboardContract.alertKinds.includes('measurement-degraded'),
    true,
    'Assurance measurement: degraded alert is visible',
  );
}

function testIncidentFeedbackPreservesIncidentReview(): void {
  const measurement = createAssuranceMeasurementPlane({
    outcomeFeedback: incidentFeedback(),
    generatedAt: '2026-05-17T17:09:00.000Z',
    auditEvidenceRefDigests: [digest8],
    metricWindow: metricWindow(),
  });

  equal(measurement.status, 'incident-review-required', 'Assurance measurement: incident review is preserved');
  ok(
    measurement.noGoReasons.includes('incident-review-required'),
    'Assurance measurement: incident review creates no-go reason',
  );
  equal(
    measurement.dashboardContract.operatorTaskKinds.includes('incident-review'),
    true,
    'Assurance measurement: incident-review task is visible',
  );
}

function testNoDataNeedsMeasurementEvidence(): void {
  const measurement = createAssuranceMeasurementPlane({
    outcomeFeedback: learningReadyFeedback(),
    generatedAt: '2026-05-17T17:10:00.000Z',
    auditEvidenceRefDigests: [],
    metricWindow: metricWindow({
      decisionCount: 0,
      reviewDecisionCount: 0,
      falseReviewCount: 0,
      falseAdmitRiskCount: 0,
      abstentionDecisionCount: 0,
      duplicateEvidenceDiscountCount: 0,
      conflictTriggerCount: 0,
      policyGapOpenedCount: 0,
      policyGapClosedCount: 0,
      humanDecisionTotalSeconds: 0,
      humanDecisionCount: 0,
      budgetPressureSignalCount: 0,
      measurementDegradedSeconds: 0,
    }),
  });

  equal(measurement.status, 'no-data', 'Assurance measurement: empty decision window is no-data');
  ok(
    measurement.noGoReasons.includes('no-audit-evidence-ref'),
    'Assurance measurement: missing audit refs are no-go',
  );
  ok(
    measurement.noGoReasons.includes('no-measurement-window-decisions'),
    'Assurance measurement: empty decision window is no-go',
  );
  ok(
    measurement.metrics.some((metric) => metric.status === 'no-data'),
    'Assurance measurement: no-data metrics are explicit',
  );
}

function testValidationRejectsInvalidInputs(): void {
  rejects(
    () => createAssuranceMeasurementPlane({
      outcomeFeedback: learningReadyFeedback(),
      auditEvidenceRefDigests: ['raw-audit-id'],
      metricWindow: metricWindow(),
    }),
    /must be a sha256 digest/u,
    'Assurance measurement: raw audit refs are rejected',
  );
  rejects(
    () => createAssuranceMeasurementPlane({
      outcomeFeedback: learningReadyFeedback(),
      auditEvidenceRefDigests: [digest8],
      metricWindow: metricWindow(),
      budgetScopes: [{
        scopeKind: 'tenant',
        scopeDigest: digestA,
        windowStartedAt: '2026-05-17T16:00:00.000Z',
        windowEndedAt: '2026-05-17T17:00:00.000Z',
        reviewBudgetLimit: 0,
        reviewBudgetUsed: 0,
        safetyBudgetLimit: 1,
        safetyBudgetUsed: 0,
      }],
    }),
    /must be a positive number/u,
    'Assurance measurement: zero budget limits are rejected',
  );
  rejects(
    () => createAssuranceMeasurementPlane({
      outcomeFeedback: learningReadyFeedback(),
      auditEvidenceRefDigests: [digest8],
      metricWindow: metricWindow(),
      driftWindows: [{
        detectorRefDigest: digestB,
        sourceDigest: digestC,
        baselineMean: 0.1,
        slack: 0,
        threshold: 1,
        samples: [Number.NaN],
      }],
    }),
    /samples must be finite/u,
    'Assurance measurement: non-finite drift samples are rejected',
  );
}

function testDocsAndPackageScriptStayAligned(): void {
  const docs = readProjectFile(
    'docs',
    '02-architecture',
    'assurance-measurement-plane.md',
  );
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '# Assurance Measurement Plane',
    'Is the decision system itself working?',
    'policy-relaxation',
    'score-calibration',
    'model-training',
    'fallsOpen: false',
    'measurement-degraded',
    'NIST AI RMF conformance',
    'not a calibrated statistical',
    'not a production anomaly detection claim',
  ]) {
    includes(docs, expected, `Assurance measurement docs: records ${expected}`);
  }
  includes(
    overview,
    '| 10 | complete | Assurance measurement plane |',
    'Assurance measurement overview: Step 10 is marked complete',
  );
  includes(
    overview,
    'src/consequence-admission/assurance-measurement-plane.ts',
    'Assurance measurement overview: implementation path is recorded',
  );
  assert.equal(
    packageJson.scripts['test:assurance-measurement-plane'],
    'tsx tests/assurance-measurement-plane.test.ts',
    'Assurance measurement: package script is registered',
  );
  passed += 1;
}

testDescriptorRecordsReadOnlyMeasurementBoundary();
testHealthyMeasurementPublishesReadOnlyDashboardOnly();
testGoodhartBoundaryBlocksMetricMisuse();
testDriftDetectionUsesCusumStyleWindow();
testReplayFailureRequiresRegression();
testBudgetOverflowIsVisibleAndNeverFallsOpen();
testMeasurementDegradedIsFailVisible();
testIncidentFeedbackPreservesIncidentReview();
testNoDataNeedsMeasurementEvidence();
testValidationRejectsInvalidInputs();
testDocsAndPackageScriptStayAligned();

console.log(`Assurance measurement plane tests: ${passed} passed, 0 failed`);
