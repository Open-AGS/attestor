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
