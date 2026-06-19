import {
  ASSURANCE_MEASUREMENT_ALLOWED_METRIC_USES,
  ASSURANCE_MEASUREMENT_METRIC_USES,
  type AssuranceBudgetPressureBand,
  type AssuranceBudgetScopeInput,
  type AssuranceBudgetScopeResult,
  type AssuranceDriftWindowInput,
  type AssuranceDriftWindowResult,
  type AssuranceMeasurementDegradedSignal,
  type AssuranceMeasurementDegradedSignalInput,
  type AssuranceMeasurementMetric,
  type AssuranceMeasurementMetricId,
  type AssuranceMeasurementMetricKind,
  type AssuranceMeasurementMetricStatus,
  type AssuranceMeasurementMetricUse,
  type AssuranceMeasurementSourceClass,
  type AssuranceMeasurementWindowInput,
  type AssuranceReplayRegressionObservation,
  type AssuranceReplayRegressionObservationInput,
} from './assurance-measurement-plane-types.js';
import {
  normalizeDigest,
  normalizeIsoTimestamp,
  normalizeNonNegativeInteger,
  normalizeNonNegativeNumber,
  normalizePositiveNumber,
} from './assurance-measurement-plane-utils.js';

export function normalizeMetricWindow(
  input: AssuranceMeasurementWindowInput,
): AssuranceMeasurementWindowInput {
  const windowStartedAt = normalizeIsoTimestamp(input.windowStartedAt, 'windowStartedAt');
  const windowEndedAt = normalizeIsoTimestamp(input.windowEndedAt, 'windowEndedAt');
  if (windowEndedAt < windowStartedAt) {
    throw new Error('Assurance measurement windowEndedAt must not be before windowStartedAt.');
  }
  return Object.freeze({
    windowRefDigest: normalizeDigest(input.windowRefDigest, 'metricWindow.windowRefDigest'),
    windowStartedAt,
    windowEndedAt,
    decisionCount: normalizeNonNegativeInteger(input.decisionCount, 'decisionCount'),
    reviewDecisionCount: normalizeNonNegativeInteger(
      input.reviewDecisionCount,
      'reviewDecisionCount',
    ),
    falseReviewCount: normalizeNonNegativeInteger(input.falseReviewCount, 'falseReviewCount'),
    falseAdmitRiskCount: normalizeNonNegativeInteger(
      input.falseAdmitRiskCount,
      'falseAdmitRiskCount',
    ),
    abstentionDecisionCount: normalizeNonNegativeInteger(
      input.abstentionDecisionCount,
      'abstentionDecisionCount',
    ),
    duplicateEvidenceDiscountCount: normalizeNonNegativeInteger(
      input.duplicateEvidenceDiscountCount,
      'duplicateEvidenceDiscountCount',
    ),
    conflictTriggerCount: normalizeNonNegativeInteger(
      input.conflictTriggerCount,
      'conflictTriggerCount',
    ),
    policyGapOpenedCount: normalizeNonNegativeInteger(
      input.policyGapOpenedCount,
      'policyGapOpenedCount',
    ),
    policyGapClosedCount: normalizeNonNegativeInteger(
      input.policyGapClosedCount,
      'policyGapClosedCount',
    ),
    humanDecisionTotalSeconds: normalizeNonNegativeNumber(
      input.humanDecisionTotalSeconds,
      'humanDecisionTotalSeconds',
    ),
    humanDecisionCount: normalizeNonNegativeInteger(
      input.humanDecisionCount,
      'humanDecisionCount',
    ),
    budgetPressureSignalCount: normalizeNonNegativeInteger(
      input.budgetPressureSignalCount,
      'budgetPressureSignalCount',
    ),
    measurementDegradedSeconds: normalizeNonNegativeNumber(
      input.measurementDegradedSeconds,
      'measurementDegradedSeconds',
    ),
  });
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Number((numerator / denominator).toFixed(6));
}

function metricStatus(value: number | null, watchAt: number, degradedAt: number):
AssuranceMeasurementMetricStatus {
  if (value === null) return 'no-data';
  if (value >= degradedAt) return 'degraded';
  if (value >= watchAt) return 'watch';
  return 'ok';
}

function lowerIsWorseStatus(value: number | null, degradedBelow: number):
AssuranceMeasurementMetricStatus {
  if (value === null) return 'no-data';
  return value < degradedBelow ? 'degraded' : 'ok';
}

function metric(input: {
  readonly metricId: AssuranceMeasurementMetricId;
  readonly kind: AssuranceMeasurementMetricKind;
  readonly value: number | null;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly unit: string;
  readonly status: AssuranceMeasurementMetricStatus;
  readonly sourceClasses: readonly AssuranceMeasurementSourceClass[];
  readonly reasonCodes?: readonly string[] | null;
}): AssuranceMeasurementMetric {
  return Object.freeze({
    metricId: input.metricId,
    kind: input.kind,
    value: input.value,
    numerator: input.numerator,
    denominator: input.denominator,
    unit: input.unit,
    status: input.status,
    sourceClasses: Object.freeze([...input.sourceClasses]),
    reasonCodes: Object.freeze([...(input.reasonCodes ?? [])].sort()),
  });
}

export function normalizeReplayObservation(
  input: AssuranceReplayRegressionObservationInput,
): AssuranceReplayRegressionObservation {
  const passedCount = normalizeNonNegativeInteger(input.passedCount, 'passedCount');
  const failedCount = normalizeNonNegativeInteger(input.failedCount, 'failedCount');
  const skippedCount = normalizeNonNegativeInteger(input.skippedCount, 'skippedCount');
  const denominator = passedCount + failedCount;
  return Object.freeze({
    replaySuiteDigest: normalizeDigest(input.replaySuiteDigest, 'replaySuiteDigest'),
    generatedAt: normalizeIsoTimestamp(input.generatedAt, 'replay.generatedAt'),
    passedCount,
    failedCount,
    skippedCount,
    passRate: ratio(passedCount, denominator),
    failed: failedCount > 0,
  });
}

export function normalizeBudgetScope(input: AssuranceBudgetScopeInput): AssuranceBudgetScopeResult {
  const reviewBudgetLimit = normalizePositiveNumber(
    input.reviewBudgetLimit,
    'reviewBudgetLimit',
  );
  const safetyBudgetLimit = normalizePositiveNumber(
    input.safetyBudgetLimit,
    'safetyBudgetLimit',
  );
  const reviewBudgetUsed = normalizeNonNegativeNumber(
    input.reviewBudgetUsed,
    'reviewBudgetUsed',
  );
  const safetyBudgetUsed = normalizeNonNegativeNumber(
    input.safetyBudgetUsed,
    'safetyBudgetUsed',
  );
  const reviewBudgetUtilization = Number((reviewBudgetUsed / reviewBudgetLimit).toFixed(6));
  const safetyBudgetUtilization = Number((safetyBudgetUsed / safetyBudgetLimit).toFixed(6));
  const pressureValue = Math.max(reviewBudgetUtilization, safetyBudgetUtilization);
  const pressureBand: AssuranceBudgetPressureBand =
    pressureValue > 1 ? 'overflow' :
      pressureValue >= 1 ? 'exhausted' :
        pressureValue >= 0.8 ? 'elevated' :
          'healthy';
  const windowStartedAt = normalizeIsoTimestamp(input.windowStartedAt, 'budget.windowStartedAt');
  const windowEndedAt = normalizeIsoTimestamp(input.windowEndedAt, 'budget.windowEndedAt');
  if (windowEndedAt < windowStartedAt) {
    throw new Error('Assurance measurement budget windowEndedAt must not be before windowStartedAt.');
  }
  return Object.freeze({
    scopeKind: input.scopeKind,
    scopeDigest: normalizeDigest(input.scopeDigest, 'budget.scopeDigest'),
    windowStartedAt,
    windowEndedAt,
    reviewBudgetLimit,
    reviewBudgetUsed,
    reviewBudgetUtilization,
    safetyBudgetLimit,
    safetyBudgetUsed,
    safetyBudgetUtilization,
    pressureBand,
    overflowActionRefDigest: input.overflowActionRefDigest
      ? normalizeDigest(input.overflowActionRefDigest, 'budget.overflowActionRefDigest')
      : null,
    fallsOpen: false,
  });
}

export function normalizeDriftWindow(input: AssuranceDriftWindowInput): AssuranceDriftWindowResult {
  const baselineMean = input.baselineMean;
  if (!Number.isFinite(baselineMean)) {
    throw new Error('Assurance measurement drift baselineMean must be finite.');
  }
  const slack = normalizeNonNegativeNumber(input.slack, 'drift.slack');
  const threshold = normalizePositiveNumber(input.threshold, 'drift.threshold');
  let positiveCusum = 0;
  let negativeCusum = 0;
  let maxAbsDeviation = 0;
  for (const sample of input.samples) {
    if (!Number.isFinite(sample)) {
      throw new Error('Assurance measurement drift samples must be finite.');
    }
    positiveCusum = Math.max(0, positiveCusum + sample - baselineMean - slack);
    negativeCusum = Math.max(0, negativeCusum + baselineMean - slack - sample);
    maxAbsDeviation = Math.max(maxAbsDeviation, Math.abs(sample - baselineMean));
  }
  return Object.freeze({
    detectorRefDigest: normalizeDigest(input.detectorRefDigest, 'drift.detectorRefDigest'),
    sourceDigest: normalizeDigest(input.sourceDigest, 'drift.sourceDigest'),
    baselineMean,
    slack,
    threshold,
    sampleCount: input.samples.length,
    positiveCusum: Number(positiveCusum.toFixed(6)),
    negativeCusum: Number(negativeCusum.toFixed(6)),
    maxAbsDeviation: Number(maxAbsDeviation.toFixed(6)),
    driftDetected: positiveCusum > threshold || negativeCusum > threshold,
  });
}

export function normalizeDegradedSignal(
  input: AssuranceMeasurementDegradedSignalInput,
): AssuranceMeasurementDegradedSignal {
  return Object.freeze({
    reason: input.reason,
    sourceDigest: normalizeDigest(input.sourceDigest, 'degraded.sourceDigest'),
    observedAt: normalizeIsoTimestamp(input.observedAt, 'degraded.observedAt'),
    durationSeconds: normalizeNonNegativeNumber(input.durationSeconds, 'degraded.durationSeconds'),
    visibleToOperator: input.visibleToOperator,
  });
}

export function normalizeMetricUses(
  input: readonly AssuranceMeasurementMetricUse[] | null | undefined,
): readonly AssuranceMeasurementMetricUse[] {
  const uses = input ?? ['operator-dashboard'];
  return Object.freeze(
    ASSURANCE_MEASUREMENT_METRIC_USES.filter((use) => uses.includes(use)),
  );
}

export function isAllowedMetricUse(use: AssuranceMeasurementMetricUse): boolean {
  return (ASSURANCE_MEASUREMENT_ALLOWED_METRIC_USES as readonly string[]).includes(use);
}

export function metricsFor(input: {
  readonly window: AssuranceMeasurementWindowInput;
  readonly driftWindows: readonly AssuranceDriftWindowResult[];
  readonly replayObservations: readonly AssuranceReplayRegressionObservation[];
}): readonly AssuranceMeasurementMetric[] {
  const window = input.window;
  const decisionCount = window.decisionCount;
  const replayPassed = input.replayObservations.reduce(
    (sum, observation) => sum + observation.passedCount,
    0,
  );
  const replayFailed = input.replayObservations.reduce(
    (sum, observation) => sum + observation.failedCount,
    0,
  );
  const replayDenominator = replayPassed + replayFailed;
  const driftDetectedCount = input.driftWindows.filter((windowResult) =>
    windowResult.driftDetected
  ).length;

  return Object.freeze([
    metric({
      metricId: 'false-review-rate',
      kind: 'rate',
      value: ratio(window.falseReviewCount, window.reviewDecisionCount),
      numerator: window.falseReviewCount,
      denominator: window.reviewDecisionCount,
      unit: 'ratio',
      status: metricStatus(ratio(window.falseReviewCount, window.reviewDecisionCount), 0.1, 0.25),
      sourceClasses: ['review-queue', 'outcome-feedback'],
    }),
    metric({
      metricId: 'false-admit-risk-count',
      kind: 'count',
      value: window.falseAdmitRiskCount,
      numerator: window.falseAdmitRiskCount,
      denominator: null,
      unit: 'count',
      status: metricStatus(window.falseAdmitRiskCount, 1, 1),
      sourceClasses: ['outcome-feedback', 'audit-plane'],
    }),
    metric({
      metricId: 'abstention-rate',
      kind: 'rate',
      value: ratio(window.abstentionDecisionCount, decisionCount),
      numerator: window.abstentionDecisionCount,
      denominator: decisionCount,
      unit: 'ratio',
      status: metricStatus(ratio(window.abstentionDecisionCount, decisionCount), 0.35, 0.6),
      sourceClasses: ['audit-plane'],
    }),
    metric({
      metricId: 'review-load',
      kind: 'rate',
      value: ratio(window.reviewDecisionCount, decisionCount),
      numerator: window.reviewDecisionCount,
      denominator: decisionCount,
      unit: 'ratio',
      status: metricStatus(ratio(window.reviewDecisionCount, decisionCount), 0.4, 0.7),
      sourceClasses: ['review-queue'],
    }),
    metric({
      metricId: 'duplicate-evidence-discount-rate',
      kind: 'rate',
      value: ratio(window.duplicateEvidenceDiscountCount, decisionCount),
      numerator: window.duplicateEvidenceDiscountCount,
      denominator: decisionCount,
      unit: 'ratio',
      status: metricStatus(ratio(window.duplicateEvidenceDiscountCount, decisionCount), 0.2, 0.5),
      sourceClasses: ['audit-plane'],
    }),
    metric({
      metricId: 'conflict-trigger-rate',
      kind: 'rate',
      value: ratio(window.conflictTriggerCount, decisionCount),
      numerator: window.conflictTriggerCount,
      denominator: decisionCount,
      unit: 'ratio',
      status: metricStatus(ratio(window.conflictTriggerCount, decisionCount), 0.15, 0.4),
      sourceClasses: ['audit-plane'],
    }),
    metric({
      metricId: 'policy-gap-closure-rate',
      kind: 'rate',
      value: ratio(window.policyGapClosedCount, window.policyGapOpenedCount),
      numerator: window.policyGapClosedCount,
      denominator: window.policyGapOpenedCount,
      unit: 'ratio',
      status: lowerIsWorseStatus(
        ratio(window.policyGapClosedCount, window.policyGapOpenedCount),
        0.5,
      ),
      sourceClasses: ['audit-plane', 'operator-dashboard'],
    }),
    metric({
      metricId: 'time-to-human-decision',
      kind: 'duration-seconds',
      value: ratio(window.humanDecisionTotalSeconds, window.humanDecisionCount),
      numerator: window.humanDecisionTotalSeconds,
      denominator: window.humanDecisionCount,
      unit: 'seconds',
      status: metricStatus(
        ratio(window.humanDecisionTotalSeconds, window.humanDecisionCount),
        180,
        600,
      ),
      sourceClasses: ['review-queue'],
    }),
    metric({
      metricId: 'drift-signal-rate',
      kind: 'rate',
      value: ratio(driftDetectedCount, input.driftWindows.length),
      numerator: driftDetectedCount,
      denominator: input.driftWindows.length,
      unit: 'ratio',
      status: metricStatus(ratio(driftDetectedCount, input.driftWindows.length), 0.01, 0.01),
      sourceClasses: ['drift-detector'],
    }),
    metric({
      metricId: 'regression-replay-pass-rate',
      kind: 'rate',
      value: ratio(replayPassed, replayDenominator),
      numerator: replayPassed,
      denominator: replayDenominator,
      unit: 'ratio',
      status: lowerIsWorseStatus(ratio(replayPassed, replayDenominator), 1),
      sourceClasses: ['replay-regression'],
    }),
    metric({
      metricId: 'budget-pressure-rate',
      kind: 'rate',
      value: ratio(window.budgetPressureSignalCount, decisionCount),
      numerator: window.budgetPressureSignalCount,
      denominator: decisionCount,
      unit: 'ratio',
      status: metricStatus(ratio(window.budgetPressureSignalCount, decisionCount), 0.01, 0.05),
      sourceClasses: ['budget-ledger'],
    }),
    metric({
      metricId: 'measurement-degraded-time',
      kind: 'duration-seconds',
      value: window.measurementDegradedSeconds,
      numerator: window.measurementDegradedSeconds,
      denominator: null,
      unit: 'seconds',
      status: metricStatus(window.measurementDegradedSeconds, 1, 1),
      sourceClasses: ['operator-dashboard'],
    }),
  ]);
}
