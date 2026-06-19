import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type { CryptoConsequenceRiskAssessment } from './consequence-risk-mapping.js';
import {
  CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
  type CreateCryptoIntelligenceRiskSignalAssessmentInput,
  type CryptoIntelligenceMissingEvidenceClass,
  type CryptoIntelligenceRiskSignal,
  type CryptoIntelligenceRiskSignalAssessment,
  type CryptoIntelligenceSignalDisposition,
  type CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals-types.js';
import {
  canonicalObject,
  maxDisposition,
  maxSeverity,
  riskClassSeverity,
  unique,
} from './intelligence-risk-signals-utils.js';
import { findingSignals } from './intelligence-risk-signals-findings.js';
import {
  contextSignals,
  observationSignals,
  readinessSignals,
} from './intelligence-risk-signals-context.js';

function assessmentCanonicalPayload(input: {
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly signals: readonly CryptoIntelligenceRiskSignal[];
  readonly overallSeverity: CryptoIntelligenceSignalSeverity;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
}): CanonicalReleaseJsonValue {
  return {
    version: CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
    riskAssessmentDigest: input.riskAssessment.digest,
    consequenceKind: input.riskAssessment.consequenceKind,
    riskClass: input.riskAssessment.riskClass,
    overallSeverity: input.overallSeverity,
    recommendedDisposition: input.recommendedDisposition,
    signals: input.signals as unknown as CanonicalReleaseJsonValue,
    missingEvidenceClasses: input.missingEvidenceClasses,
  };
}

export function createCryptoIntelligenceRiskSignalAssessment(
  input: CreateCryptoIntelligenceRiskSignalAssessmentInput,
): CryptoIntelligenceRiskSignalAssessment {
  const signals = Object.freeze([
    ...findingSignals(input.riskAssessment),
    ...readinessSignals(input.readiness),
    ...observationSignals(input.observations),
    ...contextSignals(input.context),
  ]);
  const overallSeverity = signals.reduce(
    (current, entry) => maxSeverity(current, entry.severity),
    riskClassSeverity(input.riskAssessment.riskClass),
  );
  const initialDisposition: CryptoIntelligenceSignalDisposition =
    input.riskAssessment.riskClass === 'R0' || input.riskAssessment.riskClass === 'R1'
      ? 'admit'
      : 'review';
  const recommendedDisposition = signals.reduce<CryptoIntelligenceSignalDisposition>(
    (current, entry) => maxDisposition(current, entry.disposition),
    initialDisposition,
  );
  const missingEvidenceClasses = unique(
    signals.flatMap((entry) => entry.missingEvidenceClasses),
  );
  const criticalSignalCount = signals.filter((entry) => entry.severity === 'critical').length;
  const reviewSignalCount = signals.filter((entry) => entry.disposition === 'review').length;
  const blockSignalCount = signals.filter((entry) => entry.disposition === 'block').length;
  const canonical = canonicalObject(assessmentCanonicalPayload({
    riskAssessment: input.riskAssessment,
    signals,
    overallSeverity,
    recommendedDisposition,
    missingEvidenceClasses,
  }));

  return Object.freeze({
    version: CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
    riskAssessmentDigest: input.riskAssessment.digest,
    consequenceKind: input.riskAssessment.consequenceKind,
    riskClass: input.riskAssessment.riskClass,
    overallSeverity,
    recommendedDisposition,
    signalCount: signals.length,
    criticalSignalCount,
    reviewSignalCount,
    blockSignalCount,
    signals,
    missingEvidenceClasses,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
