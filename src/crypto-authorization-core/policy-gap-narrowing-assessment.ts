import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type { CryptoIntelligenceSignalDisposition } from './intelligence-risk-signals.js';
import {
  CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
  type CreateCryptoPolicyGapNarrowingAssessmentInput,
  type CryptoNarrowingCandidate,
  type CryptoPolicyGap,
  type CryptoPolicyGapNarrowingAssessment,
} from './policy-gap-narrowing-types.js';
import {
  allowedCandidateSet,
  candidatesFromGaps,
  gapsFromPolicyCoverageProfile,
  gapsFromSignals,
  overallDisposition,
  sortGaps,
} from './policy-gap-narrowing-gaps.js';
import {
  canonicalObject,
  normalizeIsoTimestamp,
  normalizeOptionalRef,
} from './policy-gap-narrowing-utils.js';

function assessmentPayload(input: {
  readonly version: typeof CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION;
  readonly generatedAt: string;
  readonly sourceSignalAssessmentDigest: string;
  readonly riskAssessmentDigest: string;
  readonly policyRef: string | null;
  readonly operatorContextRef: string | null;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly policyCoverageProfileDigest: string | null;
  readonly gaps: readonly CryptoPolicyGap[];
  readonly candidates: readonly CryptoNarrowingCandidate[];
}): CanonicalReleaseJsonValue {
  return {
    version: input.version,
    generatedAt: input.generatedAt,
    sourceSignalAssessmentDigest: input.sourceSignalAssessmentDigest,
    riskAssessmentDigest: input.riskAssessmentDigest,
    policyRef: input.policyRef,
    operatorContextRef: input.operatorContextRef,
    recommendedDisposition: input.recommendedDisposition,
    policyCoverageProfileDigest: input.policyCoverageProfileDigest,
    gaps: input.gaps as unknown as CanonicalReleaseJsonValue,
    candidates: input.candidates as unknown as CanonicalReleaseJsonValue,
    approvalRequired: true,
    autoApply: false,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
  };
}

export function createCryptoPolicyGapNarrowingAssessment(
  input: CreateCryptoPolicyGapNarrowingAssessmentInput,
): CryptoPolicyGapNarrowingAssessment {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const policyRef = normalizeOptionalRef(input.policyRef, 'policyRef');
  const operatorContextRef = normalizeOptionalRef(
    input.operatorContextRef,
    'operatorContextRef',
  );
  const policyCoverageProfile = input.policyCoverageProfile ?? null;
  const gaps = sortGaps([
    ...gapsFromSignals(
      input.signalAssessment.digest,
      input.signalAssessment.signals,
    ),
    ...gapsFromPolicyCoverageProfile(policyCoverageProfile),
  ]);
  const candidates = candidatesFromGaps(
    gaps,
    allowedCandidateSet(input.allowedCandidateKinds),
  );
  const recommendedDisposition = overallDisposition(input.signalAssessment, gaps);
  const payload = assessmentPayload({
    version: CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
    generatedAt,
    sourceSignalAssessmentDigest: input.signalAssessment.digest,
    riskAssessmentDigest: input.signalAssessment.riskAssessmentDigest,
    policyRef,
    operatorContextRef,
    recommendedDisposition,
    policyCoverageProfileDigest: policyCoverageProfile?.digest ?? null,
    gaps,
    candidates,
  });
  const canonical = canonicalObject(payload);

  return Object.freeze({
    version: CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
    generatedAt,
    sourceSignalAssessmentDigest: input.signalAssessment.digest,
    riskAssessmentDigest: input.signalAssessment.riskAssessmentDigest,
    policyRef,
    operatorContextRef,
    recommendedDisposition,
    policyCoverageProfileDigest: policyCoverageProfile?.digest ?? null,
    gapCount: gaps.length,
    candidateCount: candidates.length,
    blockedGapCount: gaps.filter((gap) => gap.blocksAdmission).length,
    approvalRequired: true,
    autoApply: false,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
    gaps,
    candidates,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function cryptoPolicyGapNarrowingLabel(
  assessment: CryptoPolicyGapNarrowingAssessment,
): string {
  return [
    'crypto-policy-gap-narrowing',
    `disposition:${assessment.recommendedDisposition}`,
    `gaps:${assessment.gapCount}`,
    `candidates:${assessment.candidateCount}`,
  ].join(' / ');
}
