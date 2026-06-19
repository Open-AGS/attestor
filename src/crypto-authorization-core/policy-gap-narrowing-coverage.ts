import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  CRYPTO_AUTHORIZATION_POLICY_DIMENSIONS,
  type CryptoAuthorizationPolicyDimension,
} from './types.js';
import type { CryptoIntelligenceSignalDisposition } from './intelligence-risk-signals.js';
import {
  CRYPTO_POLICY_COVERAGE_SOURCE_KINDS,
  CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES,
  CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
  type CreateCryptoPolicyCoverageProfileInput,
  type CryptoPolicyCoverageProfile,
  type CryptoPolicyDimensionCoverage,
  type CryptoPolicyDimensionCoverageInput,
  type CryptoPolicyDimensionCoverageStatus,
} from './policy-gap-narrowing-types.js';
import {
  canonicalObject,
  includesValue,
  normalizeIsoTimestamp,
  normalizeOptionalRef,
  normalizePositiveInteger,
  safeEvidenceRefs,
  safeReasonCodes,
  strongerDisposition,
  unique,
} from './policy-gap-narrowing-utils.js';

function dispositionForCoverageStatus(
  status: CryptoPolicyDimensionCoverageStatus,
): CryptoIntelligenceSignalDisposition {
  switch (status) {
    case 'covered':
      return 'admit';
    case 'review-required':
      return 'review';
    case 'missing':
    case 'stale':
    case 'conflicting':
    case 'explicit-deny':
    case 'implicit-deny':
      return 'block';
  }
}

function shouldTreatCoverageAsStale(input: {
  readonly generatedAt: string;
  readonly observedAt: string | null;
  readonly maxAgeSeconds: number | null;
  readonly status: CryptoPolicyDimensionCoverageStatus;
}): boolean {
  if (
    input.observedAt === null ||
    input.maxAgeSeconds === null ||
    input.status === 'explicit-deny' ||
    input.status === 'implicit-deny'
  ) {
    return false;
  }
  const generatedAtMs = Date.parse(input.generatedAt);
  const observedAtMs = Date.parse(input.observedAt);
  if (observedAtMs > generatedAtMs) {
    throw new Error('Crypto policy gap narrowing policy coverage observedAt cannot be after generatedAt.');
  }
  return generatedAtMs - observedAtMs > input.maxAgeSeconds * 1000;
}

function coverageEntry(
  input: CryptoPolicyDimensionCoverageInput,
  generatedAt: string,
): CryptoPolicyDimensionCoverage {
  if (!CRYPTO_AUTHORIZATION_POLICY_DIMENSIONS.includes(input.dimension)) {
    throw new Error(`Crypto policy gap narrowing does not support policy dimension ${input.dimension}.`);
  }
  if (!includesValue(CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES, input.status)) {
    throw new Error(`Crypto policy gap narrowing does not support coverage status ${input.status}.`);
  }
  if (!includesValue(CRYPTO_POLICY_COVERAGE_SOURCE_KINDS, input.sourceKind)) {
    throw new Error(`Crypto policy gap narrowing does not support coverage source kind ${input.sourceKind}.`);
  }

  const observedAt = input.observedAt
    ? normalizeIsoTimestamp(input.observedAt, 'policyCoverage.observedAt')
    : null;
  const maxAgeSeconds = normalizePositiveInteger(
    input.maxAgeSeconds,
    'policyCoverage.maxAgeSeconds',
  );
  const stale = shouldTreatCoverageAsStale({
    generatedAt,
    observedAt,
    maxAgeSeconds,
    status: input.status,
  });
  const status = stale ? 'stale' : input.status;
  const baseReasonCodes = [
    `policy-coverage-${status}`,
    `policy-dimension-${input.dimension}`,
    ...safeReasonCodes(input.reasonCodes),
  ];

  return Object.freeze({
    dimension: input.dimension,
    status,
    sourceKind: input.sourceKind,
    sourceRef: normalizeOptionalRef(input.sourceRef, 'policyCoverage.sourceRef'),
    disposition: dispositionForCoverageStatus(status),
    evidenceRefs: safeEvidenceRefs(input.evidenceRefs ?? []),
    reasonCodes: safeReasonCodes(baseReasonCodes),
    observedAt,
    maxAgeSeconds,
    stale,
    rawPolicyThresholdExposed: false,
  });
}

function coverageProfilePayload(input: {
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly entries: readonly CryptoPolicyDimensionCoverage[];
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly missingPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly blockedPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly reasonCodes: readonly string[];
}): CanonicalReleaseJsonValue {
  return {
    version: CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
    generatedAt: input.generatedAt,
    scopeRef: input.scopeRef,
    entries: input.entries as unknown as CanonicalReleaseJsonValue,
    recommendedDisposition: input.recommendedDisposition,
    missingPolicyDimensions: input.missingPolicyDimensions,
    blockedPolicyDimensions: input.blockedPolicyDimensions,
    reasonCodes: input.reasonCodes,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
  };
}

export function createCryptoPolicyCoverageProfile(
  input: CreateCryptoPolicyCoverageProfileInput,
): CryptoPolicyCoverageProfile {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const scopeRef = normalizeOptionalRef(input.scopeRef, 'scopeRef');
  const entries = Object.freeze(
    input.entries.map((entry) => coverageEntry(entry, generatedAt)),
  );
  const recommendedDisposition = entries.reduce<CryptoIntelligenceSignalDisposition>(
    (current, entry) => strongerDisposition(current, entry.disposition),
    'admit',
  );
  const missingPolicyDimensions = unique(
    entries
      .filter((entry) => entry.status === 'missing')
      .map((entry) => entry.dimension),
  );
  const blockedPolicyDimensions = unique(
    entries
      .filter((entry) => entry.disposition === 'block')
      .map((entry) => entry.dimension),
  );
  const reasonCodes = safeReasonCodes(entries.flatMap((entry) => entry.reasonCodes));
  const payload = coverageProfilePayload({
    generatedAt,
    scopeRef,
    entries,
    recommendedDisposition,
    missingPolicyDimensions,
    blockedPolicyDimensions,
    reasonCodes,
  });
  const canonical = canonicalObject(payload);

  return Object.freeze({
    version: CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
    generatedAt,
    scopeRef,
    entryCount: entries.length,
    coveredCount: entries.filter((entry) => entry.status === 'covered').length,
    reviewCount: entries.filter((entry) => entry.disposition === 'review').length,
    blockCount: entries.filter((entry) => entry.disposition === 'block').length,
    recommendedDisposition,
    missingPolicyDimensions,
    blockedPolicyDimensions,
    reasonCodes,
    entries,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
