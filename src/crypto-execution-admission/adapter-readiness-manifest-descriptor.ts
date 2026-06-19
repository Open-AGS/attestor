import { CRYPTO_ADAPTER_READINESS_MATRIX } from './adapter-readiness-manifest-matrix.js';
import { unique } from './adapter-readiness-manifest-normalize.js';
import {
  CRYPTO_ADAPTER_READINESS_EVIDENCE_CLASSES,
  CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION,
  CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION,
  CRYPTO_ADAPTER_READINESS_NEXT_ACTIONS,
  CRYPTO_ADAPTER_READINESS_POSTURES,
  CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS,
  CRYPTO_ADAPTER_READINESS_RISK_FACTOR_KINDS,
  CRYPTO_ADAPTER_READINESS_STATUSES,
  type CryptoAdapterReadinessIntelligenceDescriptor,
  type CryptoAdapterReadinessIntelligenceProfile,
  type CryptoAdapterReadinessManifest,
  type CryptoAdapterReadinessManifestDescriptor,
} from './adapter-readiness-manifest-types.js';

export function cryptoAdapterReadinessIntelligenceProfileLabel(
  profile: CryptoAdapterReadinessIntelligenceProfile,
): string {
  return [
    `crypto-adapter-readiness-intelligence:${profile.profileId}`,
    `score:${profile.summary.averageReadinessScore}`,
    `ready:${profile.summary.executionReadyCount}`,
    `evidence-required:${profile.summary.evidenceRequiredCount}`,
    `review-required:${profile.summary.reviewRequiredCount}`,
    `blocked:${profile.summary.blockedCount}`,
  ].join(' / ');
}

export function cryptoAdapterReadinessManifestLabel(
  manifest: CryptoAdapterReadinessManifest,
): string {
  return [
    `crypto-adapter-readiness:${manifest.manifestId}`,
    `ready:${manifest.coverage.readyCount}`,
    `needs-evidence:${manifest.coverage.needsEvidenceCount}`,
    `blocked:${manifest.coverage.blockedCount}`,
  ].join(' / ');
}

export function cryptoAdapterReadinessIntelligenceDescriptor():
CryptoAdapterReadinessIntelligenceDescriptor {
  return Object.freeze({
    version: CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION,
    manifestVersion: CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION,
    postures: CRYPTO_ADAPTER_READINESS_POSTURES,
    riskFactorKinds: CRYPTO_ADAPTER_READINESS_RISK_FACTOR_KINDS,
    nextActions: CRYPTO_ADAPTER_READINESS_NEXT_ACTIONS,
    privacyGuardrails: CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  });
}

export function cryptoAdapterReadinessManifestDescriptor():
CryptoAdapterReadinessManifestDescriptor {
  return Object.freeze({
    version: CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION,
    statuses: CRYPTO_ADAPTER_READINESS_STATUSES,
    evidenceClasses: CRYPTO_ADAPTER_READINESS_EVIDENCE_CLASSES,
    privacyGuardrails: CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS,
    matrixEntryCount: Object.keys(CRYPTO_ADAPTER_READINESS_MATRIX).length,
    surfaces: unique(
      Object.values(CRYPTO_ADAPTER_READINESS_MATRIX).map((entry) => entry.surface),
    ),
    standards: unique(
      Object.values(CRYPTO_ADAPTER_READINESS_MATRIX).flatMap((entry) => entry.standards),
    ),
  });
}
