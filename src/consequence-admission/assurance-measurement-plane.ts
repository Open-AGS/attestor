import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
  type OutcomeIncidentFeedbackContract,
} from './outcome-incident-feedback-contract.js';

export const ASSURANCE_MEASUREMENT_PLANE_VERSION =
  'attestor.assurance-measurement-plane.v1';

export const ASSURANCE_MEASUREMENT_METRIC_IDS = [
  'false-review-rate',
  'false-admit-risk-count',
  'abstention-rate',
  'review-load',
  'duplicate-evidence-discount-rate',
  'conflict-trigger-rate',
  'policy-gap-closure-rate',
  'time-to-human-decision',
  'drift-signal-rate',
  'regression-replay-pass-rate',
  'budget-pressure-rate',
  'measurement-degraded-time',
] as const;
export type AssuranceMeasurementMetricId =
  typeof ASSURANCE_MEASUREMENT_METRIC_IDS[number];

export const ASSURANCE_MEASUREMENT_SOURCE_CLASSES = [
  'audit-plane',
  'outcome-feedback',
  'replay-regression',
  'review-queue',
  'budget-ledger',
  'drift-detector',
  'operator-dashboard',
] as const;
export type AssuranceMeasurementSourceClass =
  typeof ASSURANCE_MEASUREMENT_SOURCE_CLASSES[number];

export const ASSURANCE_MEASUREMENT_METRIC_KINDS = [
  'rate',
  'count',
  'duration-seconds',
  'status',
] as const;
export type AssuranceMeasurementMetricKind =
  typeof ASSURANCE_MEASUREMENT_METRIC_KINDS[number];

export const ASSURANCE_MEASUREMENT_METRIC_STATUSES = [
  'ok',
  'watch',
  'degraded',
  'no-data',
] as const;
export type AssuranceMeasurementMetricStatus =
  typeof ASSURANCE_MEASUREMENT_METRIC_STATUSES[number];

export const ASSURANCE_MEASUREMENT_STATUSES = [
  'healthy',
  'watching',
  'budget-pressure',
  'drift-detected',
  'regression-required',
  'incident-review-required',
  'measurement-degraded',
  'no-data',
] as const;
export type AssuranceMeasurementStatus =
  typeof ASSURANCE_MEASUREMENT_STATUSES[number];

export const ASSURANCE_BUDGET_SCOPE_KINDS = [
  'tenant',
  'consequence-class',
  'actor-class',
  'target-system',
  'time-window',
] as const;
export type AssuranceBudgetScopeKind =
  typeof ASSURANCE_BUDGET_SCOPE_KINDS[number];

export const ASSURANCE_BUDGET_PRESSURE_BANDS = [
  'healthy',
  'elevated',
  'exhausted',
  'overflow',
] as const;
export type AssuranceBudgetPressureBand =
  typeof ASSURANCE_BUDGET_PRESSURE_BANDS[number];

export const ASSURANCE_MEASUREMENT_DEGRADED_REASONS = [
  'metric-pipeline-error',
  'audit-source-unavailable',
  'outcome-source-unavailable',
  'replay-source-unavailable',
  'budget-ledger-unavailable',
  'dashboard-stale',
  'clock-skew',
] as const;
export type AssuranceMeasurementDegradedReason =
  typeof ASSURANCE_MEASUREMENT_DEGRADED_REASONS[number];

export const ASSURANCE_MEASUREMENT_METRIC_USES = [
  'operator-dashboard',
  'regression-prioritization',
  'budget-planning',
  'policy-relaxation',
  'score-calibration',
  'model-training',
  'enforcement-activation',
] as const;
export type AssuranceMeasurementMetricUse =
  typeof ASSURANCE_MEASUREMENT_METRIC_USES[number];

export const ASSURANCE_MEASUREMENT_ALLOWED_METRIC_USES = [
  'operator-dashboard',
  'regression-prioritization',
  'budget-planning',
] as const satisfies readonly AssuranceMeasurementMetricUse[];

export const ASSURANCE_MEASUREMENT_NO_GO_REASONS = [
  'no-audit-evidence-ref',
  'no-measurement-window-decisions',
  'outcome-feedback-not-ready',
  'incident-review-required',
  'replay-regression-required',
  'replay-regression-failed',
  'drift-threshold-exceeded',
  'budget-pressure-visible',
  'budget-overflow',
  'measurement-degraded',
  'blocked-metric-use-requested',
] as const;
export type AssuranceMeasurementNoGoReason =
  typeof ASSURANCE_MEASUREMENT_NO_GO_REASONS[number];

export interface AssuranceMeasurementWindowInput {
  readonly windowRefDigest: string;
  readonly windowStartedAt: string;
  readonly windowEndedAt: string;
  readonly decisionCount: number;
  readonly reviewDecisionCount: number;
  readonly falseReviewCount: number;
  readonly falseAdmitRiskCount: number;
  readonly abstentionDecisionCount: number;
  readonly duplicateEvidenceDiscountCount: number;
  readonly conflictTriggerCount: number;
  readonly policyGapOpenedCount: number;
  readonly policyGapClosedCount: number;
  readonly humanDecisionTotalSeconds: number;
  readonly humanDecisionCount: number;
  readonly budgetPressureSignalCount: number;
  readonly measurementDegradedSeconds: number;
}

export interface AssuranceReplayRegressionObservationInput {
  readonly replaySuiteDigest: string;
  readonly generatedAt: string;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
}

export interface AssuranceBudgetScopeInput {
  readonly scopeKind: AssuranceBudgetScopeKind;
  readonly scopeDigest: string;
  readonly windowStartedAt: string;
  readonly windowEndedAt: string;
  readonly reviewBudgetLimit: number;
  readonly reviewBudgetUsed: number;
  readonly safetyBudgetLimit: number;
  readonly safetyBudgetUsed: number;
  readonly overflowActionRefDigest?: string | null;
}

export interface AssuranceDriftWindowInput {
  readonly detectorRefDigest: string;
  readonly sourceDigest: string;
  readonly baselineMean: number;
  readonly slack: number;
  readonly threshold: number;
  readonly samples: readonly number[];
}

export interface AssuranceMeasurementDegradedSignalInput {
  readonly reason: AssuranceMeasurementDegradedReason;
  readonly sourceDigest: string;
  readonly observedAt: string;
  readonly durationSeconds: number;
  readonly visibleToOperator: boolean;
}

export interface CreateAssuranceMeasurementPlaneInput {
  readonly outcomeFeedback: OutcomeIncidentFeedbackContract;
  readonly auditEvidenceRefDigests: readonly string[];
  readonly metricWindow: AssuranceMeasurementWindowInput;
  readonly replayRegressionObservations?: readonly AssuranceReplayRegressionObservationInput[] | null;
  readonly budgetScopes?: readonly AssuranceBudgetScopeInput[] | null;
  readonly driftWindows?: readonly AssuranceDriftWindowInput[] | null;
  readonly degradedSignals?: readonly AssuranceMeasurementDegradedSignalInput[] | null;
  readonly requestedMetricUses?: readonly AssuranceMeasurementMetricUse[] | null;
  readonly generatedAt?: string | null;
}

export interface AssuranceMeasurementMetric {
  readonly metricId: AssuranceMeasurementMetricId;
  readonly kind: AssuranceMeasurementMetricKind;
  readonly value: number | null;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly unit: string;
  readonly status: AssuranceMeasurementMetricStatus;
  readonly sourceClasses: readonly AssuranceMeasurementSourceClass[];
  readonly reasonCodes: readonly string[];
}

export interface AssuranceReplayRegressionObservation {
  readonly replaySuiteDigest: string;
  readonly generatedAt: string;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
  readonly passRate: number | null;
  readonly failed: boolean;
}

export interface AssuranceBudgetScopeResult {
  readonly scopeKind: AssuranceBudgetScopeKind;
  readonly scopeDigest: string;
  readonly windowStartedAt: string;
  readonly windowEndedAt: string;
  readonly reviewBudgetLimit: number;
  readonly reviewBudgetUsed: number;
  readonly reviewBudgetUtilization: number;
  readonly safetyBudgetLimit: number;
  readonly safetyBudgetUsed: number;
  readonly safetyBudgetUtilization: number;
  readonly pressureBand: AssuranceBudgetPressureBand;
  readonly overflowActionRefDigest: string | null;
  readonly fallsOpen: false;
}

export interface AssuranceDriftWindowResult {
  readonly detectorRefDigest: string;
  readonly sourceDigest: string;
  readonly baselineMean: number;
  readonly slack: number;
  readonly threshold: number;
  readonly sampleCount: number;
  readonly positiveCusum: number;
  readonly negativeCusum: number;
  readonly maxAbsDeviation: number;
  readonly driftDetected: boolean;
}

export interface AssuranceMeasurementDegradedSignal {
  readonly reason: AssuranceMeasurementDegradedReason;
  readonly sourceDigest: string;
  readonly observedAt: string;
  readonly durationSeconds: number;
  readonly visibleToOperator: boolean;
}

export interface AssuranceMeasurementDashboardContract {
  readonly widgets: readonly string[];
  readonly alertKinds: readonly string[];
  readonly operatorTaskKinds: readonly string[];
  readonly sourceDigestsOnly: true;
  readonly degradedStateVisible: true;
  readonly rawPayloadStored: false;
  readonly authorityActionAllowed: false;
}

export interface AssuranceMeasurementSummary {
  readonly metricCount: number;
  readonly degradedMetricCount: number;
  readonly watchMetricCount: number;
  readonly noDataMetricCount: number;
  readonly replayFailedCount: number;
  readonly driftDetectedCount: number;
  readonly budgetOverflowCount: number;
  readonly budgetPressureCount: number;
  readonly degradedSignalCount: number;
  readonly blockedMetricUseCount: number;
}

export interface AssuranceMeasurementPlane {
  readonly version: typeof ASSURANCE_MEASUREMENT_PLANE_VERSION;
  readonly generatedAt: string;
  readonly status: AssuranceMeasurementStatus;
  readonly outcomeFeedbackVersion: typeof OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION;
  readonly outcomeFeedbackDigest: string;
  readonly auditEvidenceRefDigests: readonly string[];
  readonly metricWindow: AssuranceMeasurementWindowInput;
  readonly metrics: readonly AssuranceMeasurementMetric[];
  readonly replayRegressionObservations: readonly AssuranceReplayRegressionObservation[];
  readonly budgetScopes: readonly AssuranceBudgetScopeResult[];
  readonly driftWindows: readonly AssuranceDriftWindowResult[];
  readonly degradedSignals: readonly AssuranceMeasurementDegradedSignal[];
  readonly requestedMetricUses: readonly AssuranceMeasurementMetricUse[];
  readonly allowedMetricUses: readonly AssuranceMeasurementMetricUse[];
  readonly blockedMetricUses: readonly AssuranceMeasurementMetricUse[];
  readonly noGoReasons: readonly AssuranceMeasurementNoGoReason[];
  readonly dashboardContract: AssuranceMeasurementDashboardContract;
  readonly summary: AssuranceMeasurementSummary;
  readonly nextSafeStep: string;
  readonly measurementReadOnly: true;
  readonly readsAuditPlane: true;
  readonly writesAuditPlane: false;
  readonly directGradientSourceAllowed: false;
  readonly policyRelaxationAllowed: false;
  readonly automaticPolicyMutationAllowed: false;
  readonly automaticScoreMutationAllowed: false;
  readonly automaticCalibrationMutationAllowed: false;
  readonly llmTrainingAllowed: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface AssuranceMeasurementPlaneDescriptor {
  readonly version: typeof ASSURANCE_MEASUREMENT_PLANE_VERSION;
  readonly outcomeFeedbackVersion: typeof OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION;
  readonly metricIds: readonly AssuranceMeasurementMetricId[];
  readonly sourceClasses: readonly AssuranceMeasurementSourceClass[];
  readonly metricKinds: readonly AssuranceMeasurementMetricKind[];
  readonly metricStatuses: readonly AssuranceMeasurementMetricStatus[];
  readonly statuses: readonly AssuranceMeasurementStatus[];
  readonly budgetScopeKinds: readonly AssuranceBudgetScopeKind[];
  readonly budgetPressureBands: readonly AssuranceBudgetPressureBand[];
  readonly degradedReasons: readonly AssuranceMeasurementDegradedReason[];
  readonly allowedMetricUses: readonly AssuranceMeasurementMetricUse[];
  readonly noGoReasons: readonly AssuranceMeasurementNoGoReason[];
  readonly readOnly: true;
  readonly readsAuditPlane: true;
  readonly writesAuditPlane: false;
  readonly goodhartProtected: true;
  readonly driftDetectionSupported: true;
  readonly regressionReportingSupported: true;
  readonly scopedBudgetAccountingSupported: true;
  readonly degradedStateVisible: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function normalizeDigest(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Assurance measurement ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeDigestSet(values: readonly string[], fieldName: string): readonly string[] {
  return Object.freeze(
    [...new Set(values.map((value) => normalizeDigest(value, fieldName)))].sort(),
  );
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const trimmed = value.trim();
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Assurance measurement ${fieldName} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeGeneratedAt(value: string | null | undefined): string {
  return value ? normalizeIsoTimestamp(value, 'generatedAt') : new Date().toISOString();
}

function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Assurance measurement ${fieldName} must be a non-negative integer.`);
  }
  return value;
}

function normalizeNonNegativeNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Assurance measurement ${fieldName} must be a non-negative number.`);
  }
  return value;
}

function normalizePositiveNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Assurance measurement ${fieldName} must be a positive number.`);
  }
  return value;
}

function normalizeMetricWindow(
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

function normalizeReplayObservation(
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

function normalizeBudgetScope(input: AssuranceBudgetScopeInput): AssuranceBudgetScopeResult {
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

function normalizeDriftWindow(input: AssuranceDriftWindowInput): AssuranceDriftWindowResult {
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

function normalizeDegradedSignal(
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

function normalizeMetricUses(
  input: readonly AssuranceMeasurementMetricUse[] | null | undefined,
): readonly AssuranceMeasurementMetricUse[] {
  const uses = input ?? ['operator-dashboard'];
  return Object.freeze(
    ASSURANCE_MEASUREMENT_METRIC_USES.filter((use) => uses.includes(use)),
  );
}

function isAllowedMetricUse(use: AssuranceMeasurementMetricUse): boolean {
  return (ASSURANCE_MEASUREMENT_ALLOWED_METRIC_USES as readonly string[]).includes(use);
}

function metricsFor(input: {
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

function noGoReasons(input: {
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

function statusFor(input: {
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

function nextSafeStep(status: AssuranceMeasurementStatus): string {
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

function dashboardContract(noGoReasonsInput: readonly AssuranceMeasurementNoGoReason[]):
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

function summary(input: {
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

export function assuranceMeasurementPlaneDescriptor():
AssuranceMeasurementPlaneDescriptor {
  return Object.freeze({
    version: ASSURANCE_MEASUREMENT_PLANE_VERSION,
    outcomeFeedbackVersion: OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
    metricIds: ASSURANCE_MEASUREMENT_METRIC_IDS,
    sourceClasses: ASSURANCE_MEASUREMENT_SOURCE_CLASSES,
    metricKinds: ASSURANCE_MEASUREMENT_METRIC_KINDS,
    metricStatuses: ASSURANCE_MEASUREMENT_METRIC_STATUSES,
    statuses: ASSURANCE_MEASUREMENT_STATUSES,
    budgetScopeKinds: ASSURANCE_BUDGET_SCOPE_KINDS,
    budgetPressureBands: ASSURANCE_BUDGET_PRESSURE_BANDS,
    degradedReasons: ASSURANCE_MEASUREMENT_DEGRADED_REASONS,
    allowedMetricUses: ASSURANCE_MEASUREMENT_ALLOWED_METRIC_USES,
    noGoReasons: ASSURANCE_MEASUREMENT_NO_GO_REASONS,
    readOnly: true,
    readsAuditPlane: true,
    writesAuditPlane: false,
    goodhartProtected: true,
    driftDetectionSupported: true,
    regressionReportingSupported: true,
    scopedBudgetAccountingSupported: true,
    degradedStateVisible: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  });
}

export function createAssuranceMeasurementPlane(
  input: CreateAssuranceMeasurementPlaneInput,
): AssuranceMeasurementPlane {
  if (input.outcomeFeedback.version !== OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION) {
    throw new Error(
      'Assurance measurement outcomeFeedback version must match outcome feedback contract version.',
    );
  }
  if (
    input.outcomeFeedback.canAdmit ||
    input.outcomeFeedback.grantsAuthority ||
    input.outcomeFeedback.activatesEnforcement ||
    input.outcomeFeedback.autoEnforce ||
    input.outcomeFeedback.rawPayloadStored ||
    input.outcomeFeedback.productionReady
  ) {
    throw new Error(
      'Assurance measurement outcomeFeedback must be no-authority and data-minimized.',
    );
  }

  const generatedAt = normalizeGeneratedAt(input.generatedAt);
  const auditEvidenceRefDigests = normalizeDigestSet(
    input.auditEvidenceRefDigests,
    'auditEvidenceRefDigests',
  );
  const metricWindow = normalizeMetricWindow(input.metricWindow);
  const replayRegressionObservations = Object.freeze(
    [...(input.replayRegressionObservations ?? [])]
      .map(normalizeReplayObservation)
      .sort((left, right) =>
        left.generatedAt.localeCompare(right.generatedAt) ||
        left.replaySuiteDigest.localeCompare(right.replaySuiteDigest)
      ),
  );
  const budgetScopes = Object.freeze(
    [...(input.budgetScopes ?? [])]
      .map(normalizeBudgetScope)
      .sort((left, right) =>
        left.scopeKind.localeCompare(right.scopeKind) ||
        left.scopeDigest.localeCompare(right.scopeDigest)
      ),
  );
  const driftWindows = Object.freeze(
    [...(input.driftWindows ?? [])]
      .map(normalizeDriftWindow)
      .sort((left, right) =>
        left.detectorRefDigest.localeCompare(right.detectorRefDigest)
      ),
  );
  const degradedSignals = Object.freeze(
    [...(input.degradedSignals ?? [])]
      .map(normalizeDegradedSignal)
      .sort((left, right) =>
        left.observedAt.localeCompare(right.observedAt) ||
        left.sourceDigest.localeCompare(right.sourceDigest)
      ),
  );
  const requestedMetricUses = normalizeMetricUses(input.requestedMetricUses);
  const allowedMetricUses = Object.freeze(
    ASSURANCE_MEASUREMENT_ALLOWED_METRIC_USES.filter((use) =>
      requestedMetricUses.includes(use),
    ),
  );
  const blockedMetricUses = Object.freeze(
    ASSURANCE_MEASUREMENT_METRIC_USES.filter((use) =>
      requestedMetricUses.includes(use) &&
      !isAllowedMetricUse(use)
    ),
  );
  const metrics = metricsFor({
    window: metricWindow,
    replayObservations: replayRegressionObservations,
    driftWindows,
  });
  const reasons = noGoReasons({
    auditEvidenceRefDigests,
    outcomeFeedback: input.outcomeFeedback,
    window: metricWindow,
    replayObservations: replayRegressionObservations,
    budgetScopes,
    driftWindows,
    degradedSignals,
    blockedMetricUses,
  });
  const status = statusFor({ noGoReasons: reasons, metrics });
  const payload = {
    version: ASSURANCE_MEASUREMENT_PLANE_VERSION,
    generatedAt,
    status,
    outcomeFeedbackVersion: OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
    outcomeFeedbackDigest: normalizeDigest(input.outcomeFeedback.digest, 'outcomeFeedback.digest'),
    auditEvidenceRefDigests,
    metricWindow,
    metrics,
    replayRegressionObservations,
    budgetScopes,
    driftWindows,
    degradedSignals,
    requestedMetricUses,
    allowedMetricUses,
    blockedMetricUses,
    noGoReasons: reasons,
    dashboardContract: dashboardContract(reasons),
    summary: summary({
      metrics,
      replayObservations: replayRegressionObservations,
      driftWindows,
      budgetScopes,
      degradedSignals,
      blockedMetricUses,
    }),
    nextSafeStep: nextSafeStep(status),
    measurementReadOnly: true,
    readsAuditPlane: true,
    writesAuditPlane: false,
    directGradientSourceAllowed: false,
    policyRelaxationAllowed: false,
    automaticPolicyMutationAllowed: false,
    automaticScoreMutationAllowed: false,
    automaticCalibrationMutationAllowed: false,
    llmTrainingAllowed: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
