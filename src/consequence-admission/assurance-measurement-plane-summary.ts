import type { OutcomeIncidentFeedbackContract } from './outcome-incident-feedback-contract.js';
import {
  ASSURANCE_MEASUREMENT_NO_GO_REASONS,
  type AssuranceBudgetScopeResult,
  type AssuranceDriftWindowResult,
  type AssuranceMeasurementDashboardContract,
  type AssuranceMeasurementDegradedSignal,
  type AssuranceMeasurementMetric,
  type AssuranceMeasurementMetricUse,
  type AssuranceMeasurementNoGoReason,
  type AssuranceMeasurementStatus,
  type AssuranceMeasurementSummary,
  type AssuranceMeasurementWindowInput,
  type AssuranceReplayRegressionObservation,
} from './assurance-measurement-plane-types.js';

export function noGoReasons(input: {
  readonly auditEvidenceRefDigests: readonly string[];
  readonly outcomeFeedback: OutcomeIncidentFeedbackContract;
  readonly window: AssuranceMeasurementWindowInput;
  readonly replayObservations: readonly AssuranceReplayRegressionObservation[];
  readonly budgetScopes: readonly AssuranceBudgetScopeResult[];
  readonly driftWindows: readonly AssuranceDriftWindowResult[];
  readonly degradedSignals: readonly AssuranceMeasurementDegradedSignal[];
  readonly blockedMetricUses: readonly AssuranceMeasurementMetricUse[];
}): readonly AssuranceMeasurementNoGoReason[] {
  const reasons = new Set<AssuranceMeasurementNoGoReason>();
  if (input.auditEvidenceRefDigests.length === 0) reasons.add('no-audit-evidence-ref');
  if (input.window.decisionCount === 0) reasons.add('no-measurement-window-decisions');
  if (input.outcomeFeedback.status !== 'learning-ready') reasons.add('outcome-feedback-not-ready');
  if (input.outcomeFeedback.incidentReviewRequired) reasons.add('incident-review-required');
  if (input.outcomeFeedback.replayRegressionRequired) reasons.add('replay-regression-required');
  if (input.replayObservations.some((observation) => observation.failed)) {
    reasons.add('replay-regression-failed');
  }
  if (input.driftWindows.some((window) => window.driftDetected)) {
    reasons.add('drift-threshold-exceeded');
  }
  if (
    input.window.budgetPressureSignalCount > 0 ||
    input.budgetScopes.some((budget) =>
      budget.pressureBand === 'elevated' || budget.pressureBand === 'exhausted'
    )
  ) {
    reasons.add('budget-pressure-visible');
  }
  if (input.budgetScopes.some((budget) => budget.pressureBand === 'overflow')) {
    reasons.add('budget-overflow');
  }
  if (
    input.window.measurementDegradedSeconds > 0 ||
    input.degradedSignals.length > 0 ||
    input.degradedSignals.some((signal) => !signal.visibleToOperator)
  ) {
    reasons.add('measurement-degraded');
  }
  if (input.blockedMetricUses.length > 0) reasons.add('blocked-metric-use-requested');
  return Object.freeze(ASSURANCE_MEASUREMENT_NO_GO_REASONS.filter((reason) =>
    reasons.has(reason),
  ));
}

export function statusFor(input: {
  readonly noGoReasons: readonly AssuranceMeasurementNoGoReason[];
  readonly metrics: readonly AssuranceMeasurementMetric[];
}): AssuranceMeasurementStatus {
  if (input.noGoReasons.includes('measurement-degraded')) return 'measurement-degraded';
  if (input.noGoReasons.includes('incident-review-required')) return 'incident-review-required';
  if (
    input.noGoReasons.includes('replay-regression-failed') ||
    input.noGoReasons.includes('replay-regression-required')
  ) {
    return 'regression-required';
  }
  if (input.noGoReasons.includes('drift-threshold-exceeded')) return 'drift-detected';
  if (
    input.noGoReasons.includes('budget-overflow') ||
    input.noGoReasons.includes('budget-pressure-visible')
  ) {
    return 'budget-pressure';
  }
  if (input.noGoReasons.includes('no-measurement-window-decisions')) return 'no-data';
  if (
    input.noGoReasons.length > 0 ||
    input.metrics.some((metricEntry) => metricEntry.status === 'watch')
  ) {
    return 'watching';
  }
  return 'healthy';
}

export function nextSafeStep(status: AssuranceMeasurementStatus): string {
  switch (status) {
    case 'healthy':
      return 'Publish read-only dashboard metrics and keep regression evidence attached; do not tune enforcement from metrics.';
    case 'watching':
      return 'Review watch metrics and close measurement no-go reasons before using the data for planning.';
    case 'budget-pressure':
      return 'Route scoped budget pressure to the responsible operator path; do not fall open on exhaustion.';
    case 'drift-detected':
      return 'Attach drift evidence to regression replay planning before changing fabric, policy, score, or calibration behavior.';
    case 'regression-required':
      return 'Run or attach replay regression evidence before any reviewed learning or rollout planning.';
    case 'incident-review-required':
      return 'Complete incident review and postmortem references before learning or planning changes from this window.';
    case 'measurement-degraded':
      return 'Mark dashboard and review surfaces measurement-degraded until the measurement pipeline is visible and source-backed again.';
    case 'no-data':
      return 'Collect audit evidence refs and measurement-window decisions before publishing quality conclusions.';
  }
}

export function dashboardContract(noGoReasonsInput: readonly AssuranceMeasurementNoGoReason[]):
AssuranceMeasurementDashboardContract {
  const alertKinds = new Set<string>();
  const operatorTaskKinds = new Set<string>();
  for (const reason of noGoReasonsInput) {
    if (reason === 'measurement-degraded') alertKinds.add('measurement-degraded');
    if (reason === 'drift-threshold-exceeded') alertKinds.add('drift-detected');
    if (reason === 'budget-overflow' || reason === 'budget-pressure-visible') {
      alertKinds.add('budget-pressure');
      operatorTaskKinds.add('budget-review');
    }
    if (
      reason === 'replay-regression-required' ||
      reason === 'replay-regression-failed'
    ) {
      operatorTaskKinds.add('regression-review');
    }
    if (reason === 'incident-review-required') {
      operatorTaskKinds.add('incident-review');
    }
  }
  return Object.freeze({
    widgets: Object.freeze([
      'metric-health',
      'drift',
      'regression',
      'budget',
      'degraded-state',
      'incident-review',
    ]),
    alertKinds: Object.freeze([...alertKinds].sort()),
    operatorTaskKinds: Object.freeze([...operatorTaskKinds].sort()),
    sourceDigestsOnly: true,
    degradedStateVisible: true,
    rawPayloadStored: false,
    authorityActionAllowed: false,
  });
}

export function summary(input: {
  readonly metrics: readonly AssuranceMeasurementMetric[];
  readonly replayObservations: readonly AssuranceReplayRegressionObservation[];
  readonly driftWindows: readonly AssuranceDriftWindowResult[];
  readonly budgetScopes: readonly AssuranceBudgetScopeResult[];
  readonly degradedSignals: readonly AssuranceMeasurementDegradedSignal[];
  readonly blockedMetricUses: readonly AssuranceMeasurementMetricUse[];
}): AssuranceMeasurementSummary {
  return Object.freeze({
    metricCount: input.metrics.length,
    degradedMetricCount: input.metrics.filter((metricEntry) =>
      metricEntry.status === 'degraded'
    ).length,
    watchMetricCount: input.metrics.filter((metricEntry) =>
      metricEntry.status === 'watch'
    ).length,
    noDataMetricCount: input.metrics.filter((metricEntry) =>
      metricEntry.status === 'no-data'
    ).length,
    replayFailedCount: input.replayObservations.filter((observation) => observation.failed).length,
    driftDetectedCount: input.driftWindows.filter((window) => window.driftDetected).length,
    budgetOverflowCount: input.budgetScopes.filter((budget) =>
      budget.pressureBand === 'overflow'
    ).length,
    budgetPressureCount: input.budgetScopes.filter((budget) =>
      budget.pressureBand === 'elevated' ||
      budget.pressureBand === 'exhausted' ||
      budget.pressureBand === 'overflow'
    ).length,
    degradedSignalCount: input.degradedSignals.length,
    blockedMetricUseCount: input.blockedMetricUses.length,
  });
}
