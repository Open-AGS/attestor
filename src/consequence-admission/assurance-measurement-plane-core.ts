import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import { OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION } from './outcome-incident-feedback-contract.js';
import {
  normalizeBudgetScope,
  normalizeDegradedSignal,
  normalizeDriftWindow,
  normalizeMetricUses,
  normalizeMetricWindow,
  normalizeReplayObservation,
  isAllowedMetricUse,
  metricsFor,
} from './assurance-measurement-plane-metrics.js';
import {
  dashboardContract,
  nextSafeStep,
  noGoReasons,
  statusFor,
  summary,
} from './assurance-measurement-plane-summary.js';
import {
  ASSURANCE_MEASUREMENT_ALLOWED_METRIC_USES,
  ASSURANCE_MEASUREMENT_METRIC_USES,
  ASSURANCE_MEASUREMENT_PLANE_VERSION,
  type AssuranceMeasurementPlane,
  type CreateAssuranceMeasurementPlaneInput,
} from './assurance-measurement-plane-types.js';
import {
  canonicalObject,
  normalizeDigest,
  normalizeDigestSet,
  normalizeGeneratedAt,
} from './assurance-measurement-plane-utils.js';

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
