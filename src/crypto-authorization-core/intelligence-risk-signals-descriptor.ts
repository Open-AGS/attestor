import {
  CRYPTO_INTELLIGENCE_MISSING_EVIDENCE_CLASSES,
  CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
  CRYPTO_INTELLIGENCE_SIGNAL_CATEGORIES,
  CRYPTO_INTELLIGENCE_SIGNAL_DISPOSITIONS,
  CRYPTO_INTELLIGENCE_SIGNAL_SEVERITIES,
  CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS,
  type CryptoIntelligenceRiskSignalAssessment,
  type CryptoIntelligenceRiskSignalsDescriptor,
} from './intelligence-risk-signals-types.js';

export function cryptoIntelligenceRiskSignalsDescriptor():
CryptoIntelligenceRiskSignalsDescriptor {
  return Object.freeze({
    version: CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
    categories: CRYPTO_INTELLIGENCE_SIGNAL_CATEGORIES,
    severities: CRYPTO_INTELLIGENCE_SIGNAL_SEVERITIES,
    dispositions: CRYPTO_INTELLIGENCE_SIGNAL_DISPOSITIONS,
    missingEvidenceClasses: CRYPTO_INTELLIGENCE_MISSING_EVIDENCE_CLASSES,
    velocityThresholds: CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS,
  });
}

export function cryptoIntelligenceRiskSignalLabel(
  assessment: CryptoIntelligenceRiskSignalAssessment,
): string {
  return [
    `crypto-intelligence:${assessment.consequenceKind}`,
    `risk:${assessment.riskClass}`,
    `severity:${assessment.overallSeverity}`,
    `disposition:${assessment.recommendedDisposition}`,
    `signals:${assessment.signalCount}`,
  ].join(' / ');
}
