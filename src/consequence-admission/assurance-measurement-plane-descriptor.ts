import { OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION } from './outcome-incident-feedback-contract.js';
import {
  ASSURANCE_BUDGET_PRESSURE_BANDS,
  ASSURANCE_BUDGET_SCOPE_KINDS,
  ASSURANCE_MEASUREMENT_ALLOWED_METRIC_USES,
  ASSURANCE_MEASUREMENT_DEGRADED_REASONS,
  ASSURANCE_MEASUREMENT_METRIC_IDS,
  ASSURANCE_MEASUREMENT_METRIC_KINDS,
  ASSURANCE_MEASUREMENT_METRIC_STATUSES,
  ASSURANCE_MEASUREMENT_NO_GO_REASONS,
  ASSURANCE_MEASUREMENT_PLANE_VERSION,
  ASSURANCE_MEASUREMENT_SOURCE_CLASSES,
  ASSURANCE_MEASUREMENT_STATUSES,
  type AssuranceMeasurementPlaneDescriptor,
} from './assurance-measurement-plane-types.js';

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
