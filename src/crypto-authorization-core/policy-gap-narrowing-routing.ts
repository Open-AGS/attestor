import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationPolicyDimension } from './types.js';
import type { CryptoIntelligenceSignalDisposition } from './intelligence-risk-signals.js';
import {
  CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS,
  CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
  type CreateCryptoPolicyIntelligenceRoutingProfileInput,
  type CryptoPolicyDimensionCoverage,
  type CryptoPolicyDimensionCoverageStatus,
  type CryptoPolicyIntelligenceOperatorAction,
  type CryptoPolicyIntelligenceRouteKind,
  type CryptoPolicyIntelligenceRoutingBlocker,
  type CryptoPolicyIntelligenceRoutingEntry,
  type CryptoPolicyIntelligenceRoutingProfile,
} from './policy-gap-narrowing-types.js';
import {
  canonicalObject,
  normalizeIsoTimestamp,
  normalizeOptionalRef,
  strongerDisposition,
  unique,
} from './policy-gap-narrowing-utils.js';

const POLICY_INTELLIGENCE_ROUTE_PRECEDENCE: Readonly<
Record<CryptoPolicyIntelligenceRouteKind, number>
> = Object.freeze({
  'admit-ready': 0,
  'review-required': 10,
  'block-missing-policy': 20,
  'block-stale-policy': 30,
  'block-implicit-deny': 40,
  'block-policy-conflict': 50,
  'block-explicit-deny': 60,
});

function routeKindForCoverageStatus(
  status: CryptoPolicyDimensionCoverageStatus,
): CryptoPolicyIntelligenceRouteKind {
  switch (status) {
    case 'covered':
      return 'admit-ready';
    case 'review-required':
      return 'review-required';
    case 'missing':
      return 'block-missing-policy';
    case 'stale':
      return 'block-stale-policy';
    case 'conflicting':
      return 'block-policy-conflict';
    case 'implicit-deny':
      return 'block-implicit-deny';
    case 'explicit-deny':
      return 'block-explicit-deny';
  }
}

function operatorActionForRoute(
  routeKind: CryptoPolicyIntelligenceRouteKind,
): CryptoPolicyIntelligenceOperatorAction {
  switch (routeKind) {
    case 'admit-ready':
      return 'admit-with-policy-evidence';
    case 'review-required':
      return 'send-to-human-review';
    case 'block-missing-policy':
      return 'bind-policy-dimension';
    case 'block-stale-policy':
      return 'refresh-policy-evidence';
    case 'block-policy-conflict':
      return 'resolve-policy-conflict';
    case 'block-implicit-deny':
      return 'block-implicit-deny';
    case 'block-explicit-deny':
      return 'block-explicit-deny';
  }
}

function modelSafeInstructionForRoute(
  routeKind: CryptoPolicyIntelligenceRouteKind,
): string {
  switch (routeKind) {
    case 'admit-ready':
      return 'Proceed only with the bound policy evidence already represented by digest or scoped reference.';
    case 'review-required':
      return 'Route to human review; do not ask the model to infer a passing policy variant.';
    case 'block-missing-policy':
      return 'Block until a customer-controlled policy dimension is bound; do not infer private policy limits.';
    case 'block-stale-policy':
      return 'Block until policy evidence is refreshed by digest or scoped reference.';
    case 'block-policy-conflict':
      return 'Block until the conflicting policy sources are resolved by an operator-controlled workflow.';
    case 'block-implicit-deny':
      return 'Block because no sufficient allow path is bound; retry only after customer-approved policy coverage exists.';
    case 'block-explicit-deny':
      return 'Respect the explicit deny; do not search for a bypass or alternate passing variant.';
  }
}

function routeCounts(
  entries: readonly CryptoPolicyIntelligenceRoutingEntry[],
): Readonly<Record<CryptoPolicyIntelligenceRouteKind, number>> {
  const counts = Object.fromEntries(
    CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS.map((routeKind) => [routeKind, 0]),
  ) as Record<CryptoPolicyIntelligenceRouteKind, number>;

  for (const entry of entries) {
    counts[entry.routeKind] += 1;
  }

  return Object.freeze(counts);
}

function routingEntryFromCoverage(
  entry: CryptoPolicyDimensionCoverage,
): CryptoPolicyIntelligenceRoutingEntry {
  const routeKind = routeKindForCoverageStatus(entry.status);
  return Object.freeze({
    dimension: entry.dimension,
    coverageStatus: entry.status,
    routeKind,
    disposition: entry.disposition,
    precedence: POLICY_INTELLIGENCE_ROUTE_PRECEDENCE[routeKind],
    sourceKind: entry.sourceKind,
    sourceRef: entry.sourceRef,
    operatorAction: operatorActionForRoute(routeKind),
    modelSafeInstruction: modelSafeInstructionForRoute(routeKind),
    reasonCodes: entry.reasonCodes,
    evidenceRefCount: entry.evidenceRefs.length,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
  } satisfies CryptoPolicyIntelligenceRoutingEntry);
}

function dominantRoutingEntry(
  entries: readonly CryptoPolicyIntelligenceRoutingEntry[],
): CryptoPolicyIntelligenceRoutingEntry | null {
  return [...entries].sort((left, right) => {
    const precedenceDelta = right.precedence - left.precedence;
    if (precedenceDelta !== 0) return precedenceDelta;
    return left.dimension.localeCompare(right.dimension);
  })[0] ?? null;
}

function routingBlockers(
  entries: readonly CryptoPolicyIntelligenceRoutingEntry[],
): readonly CryptoPolicyIntelligenceRoutingBlocker[] {
  return Object.freeze(
    entries
      .filter((entry) => entry.disposition === 'block')
      .sort((left, right) => {
        const precedenceDelta = right.precedence - left.precedence;
        if (precedenceDelta !== 0) return precedenceDelta;
        return left.dimension.localeCompare(right.dimension);
      })
      .slice(0, 5)
      .map((entry) =>
        Object.freeze({
          dimension: entry.dimension,
          routeKind: entry.routeKind,
          operatorAction: entry.operatorAction,
          reasonCodes: entry.reasonCodes,
        }),
      ),
  );
}

function routingModelSafeSummary(input: {
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly dominantRouteKind: CryptoPolicyIntelligenceRouteKind;
  readonly topBlockers: readonly CryptoPolicyIntelligenceRoutingBlocker[];
  readonly reviewDimensions: readonly CryptoAuthorizationPolicyDimension[];
}): string {
  if (input.recommendedDisposition === 'block') {
    const blocker = input.topBlockers[0];
    const dimension = blocker ? ` dimension:${blocker.dimension}` : '';
    return `Policy intelligence blocks via ${input.dominantRouteKind}${dimension}; use ${operatorActionForRoute(input.dominantRouteKind)} before retry.`;
  }
  if (input.recommendedDisposition === 'review') {
    const dimensions = input.reviewDimensions.join(',') || 'policy';
    return `Policy intelligence routes to review for ${dimensions}; model feedback remains safe-only.`;
  }
  return 'Policy intelligence is admit-ready with digest-bound policy coverage.';
}

function routingProfilePayload(input: {
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly coverageProfileDigest: string;
  readonly policyGapAssessmentDigest: string | null;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly dominantRouteKind: CryptoPolicyIntelligenceRouteKind;
  readonly routeCounts: Readonly<Record<CryptoPolicyIntelligenceRouteKind, number>>;
  readonly entries: readonly CryptoPolicyIntelligenceRoutingEntry[];
  readonly topBlockers: readonly CryptoPolicyIntelligenceRoutingBlocker[];
  readonly reviewDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly modelSafeSummary: string;
}): CanonicalReleaseJsonValue {
  return {
    version: CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    generatedAt: input.generatedAt,
    scopeRef: input.scopeRef,
    coverageProfileDigest: input.coverageProfileDigest,
    policyGapAssessmentDigest: input.policyGapAssessmentDigest,
    recommendedDisposition: input.recommendedDisposition,
    dominantRouteKind: input.dominantRouteKind,
    routeCounts: input.routeCounts as unknown as CanonicalReleaseJsonValue,
    entries: input.entries as unknown as CanonicalReleaseJsonValue,
    topBlockers: input.topBlockers as unknown as CanonicalReleaseJsonValue,
    reviewDimensions: input.reviewDimensions,
    modelSafeSummary: input.modelSafeSummary,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    conflictResolutionRequired: true,
    stalePolicyMustRefresh: true,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
  };
}

export function createCryptoPolicyIntelligenceRoutingProfile(
  input: CreateCryptoPolicyIntelligenceRoutingProfileInput,
): CryptoPolicyIntelligenceRoutingProfile {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt ?? input.coverageProfile.generatedAt,
    'routingProfile.generatedAt',
  );
  const scopeRef = normalizeOptionalRef(
    input.scopeRef ?? input.coverageProfile.scopeRef,
    'routingProfile.scopeRef',
  );
  const policyGapAssessment = input.policyGapAssessment ?? null;
  if (
    policyGapAssessment !== null &&
    policyGapAssessment.policyCoverageProfileDigest !== input.coverageProfile.digest
  ) {
    throw new Error(
      'Crypto policy intelligence routing requires the policy gap assessment to bind the same coverage profile digest.',
    );
  }

  const entries = Object.freeze(
    input.coverageProfile.entries.map((entry) => routingEntryFromCoverage(entry)),
  );
  const counts = routeCounts(entries);
  const dominantEntry = dominantRoutingEntry(entries);
  const dominantRouteKind = dominantEntry?.routeKind ?? 'admit-ready';
  const recommendedDisposition = entries.reduce<CryptoIntelligenceSignalDisposition>(
    (current, entry) => strongerDisposition(current, entry.disposition),
    'admit',
  );
  const topBlockers = routingBlockers(entries);
  const reviewDimensions = unique(
    entries
      .filter((entry) => entry.disposition === 'review')
      .map((entry) => entry.dimension),
  );
  const modelSafeSummary = routingModelSafeSummary({
    recommendedDisposition,
    dominantRouteKind,
    topBlockers,
    reviewDimensions,
  });
  const payload = routingProfilePayload({
    generatedAt,
    scopeRef,
    coverageProfileDigest: input.coverageProfile.digest,
    policyGapAssessmentDigest: policyGapAssessment?.digest ?? null,
    recommendedDisposition,
    dominantRouteKind,
    routeCounts: counts,
    entries,
    topBlockers,
    reviewDimensions,
    modelSafeSummary,
  });
  const canonical = canonicalObject(payload);

  return Object.freeze({
    version: CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    generatedAt,
    scopeRef,
    coverageProfileDigest: input.coverageProfile.digest,
    policyGapAssessmentDigest: policyGapAssessment?.digest ?? null,
    recommendedDisposition,
    dominantRouteKind,
    routeCounts: counts,
    admitRouteCount: counts['admit-ready'],
    reviewRouteCount: counts['review-required'],
    blockRouteCount:
      counts['block-missing-policy'] +
      counts['block-stale-policy'] +
      counts['block-policy-conflict'] +
      counts['block-implicit-deny'] +
      counts['block-explicit-deny'],
    entries,
    topBlockers,
    reviewDimensions,
    modelSafeSummary,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    conflictResolutionRequired: true,
    stalePolicyMustRefresh: true,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
