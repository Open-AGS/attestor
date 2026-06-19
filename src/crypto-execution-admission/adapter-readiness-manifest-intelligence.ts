import type { CryptoSimulationPreflightSource } from '../crypto-authorization-core/authorization-simulation.js';
import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import { evidenceClassForPreflight, profileIdFor } from './adapter-readiness-manifest-core.js';
import { canonicalObject, normalizeIsoTimestamp, normalizeOptionalIdentifier, unique } from './adapter-readiness-manifest-normalize.js';
import {
  CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION,
  CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS,
  type CreateCryptoAdapterReadinessIntelligenceProfileInput,
  type CryptoAdapterReadinessCountSummary,
  type CryptoAdapterReadinessEntry,
  type CryptoAdapterReadinessEvidenceClass,
  type CryptoAdapterReadinessIntelligenceEntry,
  type CryptoAdapterReadinessIntelligenceProfile,
  type CryptoAdapterReadinessIntelligenceSummary,
  type CryptoAdapterReadinessNextAction,
  type CryptoAdapterReadinessPosture,
  type CryptoAdapterReadinessRiskFactor,
  type CryptoAdapterReadinessRiskFactorKind,
  type CryptoAdapterReadinessRiskFactorSeverity,
  type CryptoAdapterReadinessStandardCoverage,
} from './adapter-readiness-manifest-types.js';

export function evidenceClassesForPreflightSources(
  sources: readonly CryptoSimulationPreflightSource[],
): readonly CryptoAdapterReadinessEvidenceClass[] {
  return unique(sources.map(evidenceClassForPreflight));
}

function hasAny<T extends string>(left: readonly T[], right: readonly T[]): boolean {
  return left.some((entry) => right.includes(entry));
}

export function riskFactor(input: {
  readonly entry: CryptoAdapterReadinessEntry;
  readonly kind: CryptoAdapterReadinessRiskFactorKind;
  readonly severity: CryptoAdapterReadinessRiskFactorSeverity;
  readonly evidenceClasses?: readonly CryptoAdapterReadinessEvidenceClass[];
  readonly reasonCodes?: readonly string[];
  readonly standards?: readonly string[];
  readonly message: string;
}): CryptoAdapterReadinessRiskFactor {
  const standards = unique(input.standards ?? input.entry.standards);
  const evidenceClasses = unique(input.evidenceClasses ?? []);
  const reasonCodes = unique(input.reasonCodes ?? []);

  return Object.freeze({
    factorId: [
      input.entry.matrixEntryId,
      input.kind,
      input.severity,
      ...evidenceClasses,
      ...reasonCodes,
    ].join(':'),
    kind: input.kind,
    severity: input.severity,
    surface: input.entry.surface,
    standards,
    evidenceClasses,
    reasonCodes,
    message: input.message,
    modelSafeFeedback: Object.freeze([
      `adapter:${input.entry.matrixEntryId}`,
      `risk-factor:${input.kind}`,
      `severity:${input.severity}`,
      ...evidenceClasses.map((evidenceClass) => `missing:${evidenceClass}`),
      ...reasonCodes.map((reasonCode) => `reason:${reasonCode}`),
    ]),
  });
}

export function postureForEntry(
  entry: CryptoAdapterReadinessEntry,
): CryptoAdapterReadinessPosture {
  if (entry.status === 'blocked') return 'blocked';
  if (entry.status === 'ready') return 'execution-ready';
  if (entry.matchedPlans.length === 0) return 'evidence-required';
  return 'review-required';
}

export function riskFactorsForEntry(
  entry: CryptoAdapterReadinessEntry,
): readonly CryptoAdapterReadinessRiskFactor[] {
  const factors: CryptoAdapterReadinessRiskFactor[] = [];
  const requiredPreflightEvidence = evidenceClassesForPreflightSources(
    entry.requiredPreflightSources,
  );
  const recommendedPreflightEvidence = evidenceClassesForPreflightSources(
    entry.recommendedPreflightSources,
  );
  const missingRequiredPreflight = entry.missingEvidenceClasses.filter((evidenceClass) =>
    requiredPreflightEvidence.includes(evidenceClass),
  );
  const missingRequiredHandoff = entry.missingEvidenceClasses.filter((evidenceClass) =>
    entry.requiredHandoffArtifacts.includes(evidenceClass),
  );
  const notReady = entry.status !== 'ready';
  const blockerSeverity: CryptoAdapterReadinessRiskFactorSeverity =
    entry.status === 'blocked' ? 'block' : 'review';

  if (entry.matchedPlans.length === 0) {
    factors.push(
      riskFactor({
        entry,
        kind: 'admission-plan-missing',
        severity: 'review',
        evidenceClasses: ['admission-plan'],
        reasonCodes: entry.reasonCodes,
        message: 'No digest-bound admission plan is available for this adapter surface.',
      }),
    );
  }

  if (entry.status === 'blocked') {
    factors.push(
      riskFactor({
        entry,
        kind: 'admission-plan-blocked',
        severity: 'block',
        reasonCodes: entry.blockedReasons.length > 0
          ? entry.blockedReasons
          : entry.reasonCodes,
        message: 'A matched admission plan is blocked and must be resolved before handoff.',
      }),
    );
  }

  if (missingRequiredPreflight.length > 0) {
    factors.push(
      riskFactor({
        entry,
        kind: 'required-preflight-missing',
        severity: blockerSeverity,
        evidenceClasses: missingRequiredPreflight,
        reasonCodes: entry.reasonCodes,
        message: 'Required adapter preflight evidence is missing or blocked.',
      }),
    );
  }

  if (missingRequiredHandoff.length > 0) {
    factors.push(
      riskFactor({
        entry,
        kind: 'required-handoff-missing',
        severity: blockerSeverity,
        evidenceClasses: missingRequiredHandoff,
        reasonCodes: entry.reasonCodes,
        message: 'Required handoff artifacts are missing for this adapter surface.',
      }),
    );
  }

  if (notReady && recommendedPreflightEvidence.length > 0) {
    factors.push(
      riskFactor({
        entry,
        kind: 'recommended-preflight-unobserved',
        severity: 'advisory',
        evidenceClasses: recommendedPreflightEvidence,
        message: 'Recommended adapter preflight evidence has not been observed yet.',
      }),
    );
  }

  if (notReady && entry.surface === 'smart-account-guard') {
    factors.push(
      riskFactor({
        entry,
        kind: 'smart-account-guard-review',
        severity: blockerSeverity,
        evidenceClasses: hasAny(entry.missingEvidenceClasses, [
          'guard-precheck',
          'module-hook-precheck',
        ])
          ? entry.missingEvidenceClasses.filter((evidenceClass) =>
              ['guard-precheck', 'module-hook-precheck'].includes(evidenceClass),
            )
          : [],
        standards: entry.standards.filter((standard) => standard.includes('Safe')),
        message: 'Smart-account guard readiness requires guard or module-hook precheck evidence.',
      }),
    );
  }

  if (
    notReady &&
    entry.standards.some((standard) => standard === 'ERC-4337' || standard === 'ERC-7562')
  ) {
    factors.push(
      riskFactor({
        entry,
        kind: 'account-abstraction-validation-review',
        severity: blockerSeverity,
        evidenceClasses: entry.missingEvidenceClasses.filter((evidenceClass) =>
          ['simulate-validation-result', 'erc-7562-validation-scope'].includes(
            evidenceClass,
          ),
        ),
        standards: entry.standards.filter(
          (standard) => standard === 'ERC-4337' || standard === 'ERC-7562',
        ),
        message:
          'Account-abstraction handoff requires validation and validation-scope evidence.',
      }),
    );
  }

  if (notReady && entry.standards.includes('EIP-7702')) {
    factors.push(
      riskFactor({
        entry,
        kind: 'delegated-authority-review',
        severity: blockerSeverity,
        evidenceClasses: entry.missingEvidenceClasses.filter((evidenceClass) =>
          ['authorization-list-tuple', 'delegate-code-approval'].includes(evidenceClass),
        ),
        standards: ['EIP-7702'],
        message: 'Delegated EOA execution requires authorization tuple and delegate-code evidence.',
      }),
    );
  }

  if (notReady && entry.standards.includes('x402-v2')) {
    factors.push(
      riskFactor({
        entry,
        kind: 'http-payment-verification-review',
        severity: blockerSeverity,
        evidenceClasses: entry.missingEvidenceClasses.filter((evidenceClass) =>
          [
            'x402-payment-requirement',
            'x402-payment-signature',
            'x402-payment-response',
            'x402-payment-verification',
          ].includes(evidenceClass),
        ),
        standards: ['x402-v2', 'HTTP 402', 'EIP-3009'],
        message:
          'x402 handoff requires payment requirement, signature, response, and verification evidence.',
      }),
    );
  }

  if (notReady && entry.surface === 'custody-policy-engine') {
    factors.push(
      riskFactor({
        entry,
        kind: 'custody-policy-review',
        severity: blockerSeverity,
        evidenceClasses: entry.missingEvidenceClasses.filter((evidenceClass) =>
          ['custody-policy-decision', 'co-signer-response'].includes(evidenceClass),
        ),
        message: 'Custody handoff requires policy-decision and co-signer response evidence.',
      }),
    );
  }

  if (notReady && entry.surface === 'intent-solver') {
    factors.push(
      riskFactor({
        entry,
        kind: 'solver-settlement-review',
        severity: blockerSeverity,
        evidenceClasses: entry.missingEvidenceClasses.filter((evidenceClass) =>
          ['solver-route-commitment', 'settlement-preflight'].includes(evidenceClass),
        ),
        message: 'Intent-solver handoff requires route commitment and settlement preflight evidence.',
      }),
    );
  }

  return Object.freeze(factors);
}

export function readinessScoreFor(
  entry: CryptoAdapterReadinessEntry,
  factors: readonly CryptoAdapterReadinessRiskFactor[],
): number {
  if (entry.status === 'ready') return 100;
  if (entry.status === 'blocked') return 0;

  const base = entry.matchedPlans.length > 0 ? 60 : 35;
  const reviewPenalty = factors.filter((factor) => factor.severity === 'review').length * 4;
  const advisoryPenalty = factors.filter((factor) => factor.severity === 'advisory').length * 2;
  const evidencePenalty = Math.min(25, entry.missingEvidenceClasses.length * 2);
  return Math.max(10, base - reviewPenalty - advisoryPenalty - evidencePenalty);
}

export function confidenceForEntry(entry: CryptoAdapterReadinessEntry): 'low' | 'medium' | 'high' {
  if (entry.status === 'ready' || entry.status === 'blocked') return 'high';
  if (entry.matchedPlans.length > 0) return 'medium';
  return 'low';
}

export function nextActionForEntry(
  entry: CryptoAdapterReadinessEntry,
): CryptoAdapterReadinessNextAction {
  if (entry.status === 'ready') return 'proceed-with-handoff';
  if (entry.status === 'blocked') return 'resolve-blocked-plan';
  if (entry.matchedPlans.length === 0) return 'create-admission-plan';

  const requiredPreflightEvidence = evidenceClassesForPreflightSources(
    entry.requiredPreflightSources,
  );
  if (hasAny(entry.missingEvidenceClasses, requiredPreflightEvidence)) {
    return 'run-required-preflight';
  }
  if (hasAny(entry.missingEvidenceClasses, entry.requiredHandoffArtifacts)) {
    return 'collect-handoff-evidence';
  }
  return 'review-partial-plan';
}

export function intelligenceEntryFor(
  entry: CryptoAdapterReadinessEntry,
): CryptoAdapterReadinessIntelligenceEntry {
  const posture = postureForEntry(entry);
  const riskFactors = riskFactorsForEntry(entry);
  const nextAction = nextActionForEntry(entry);

  return Object.freeze({
    matrixEntryId: entry.matrixEntryId,
    adapterKind: entry.adapterKind,
    surface: entry.surface,
    standards: entry.standards,
    status: entry.status,
    posture,
    readinessScore: readinessScoreFor(entry, riskFactors),
    confidence: confidenceForEntry(entry),
    nextAction,
    missingEvidenceClasses: entry.missingEvidenceClasses,
    reasonCodes: entry.reasonCodes,
    riskFactors,
    readyPlanDigest: entry.readyPlanDigest,
    modelSafeFeedback: Object.freeze([
      `adapter:${entry.matrixEntryId}`,
      `posture:${posture}`,
      `next-action:${nextAction}`,
      ...riskFactors.flatMap((factor) => factor.modelSafeFeedback),
    ]),
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  });
}

export function topCounts(values: readonly string[], limit = 5): readonly CryptoAdapterReadinessCountSummary[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Object.freeze(
    [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, limit)
      .map(([value, count]) => Object.freeze({ value, count })),
  );
}

export function standardsCoverageFor(
  entries: readonly CryptoAdapterReadinessIntelligenceEntry[],
): readonly CryptoAdapterReadinessStandardCoverage[] {
  const standards = unique(entries.flatMap((entry) => entry.standards));

  return Object.freeze(
    standards.map((standard) => {
      const matchingEntries = entries.filter((entry) => entry.standards.includes(standard));
      return Object.freeze({
        standard,
        totalEntryCount: matchingEntries.length,
        readyCount: matchingEntries.filter((entry) => entry.posture === 'execution-ready')
          .length,
        incompleteCount: matchingEntries.filter((entry) => entry.posture !== 'execution-ready')
          .length,
        blockedCount: matchingEntries.filter((entry) => entry.posture === 'blocked').length,
      });
    }),
  );
}

export function operatorAttentionItemsFor(
  entries: readonly CryptoAdapterReadinessIntelligenceEntry[],
): readonly string[] {
  return Object.freeze(
    entries
      .filter((entry) => entry.posture !== 'execution-ready')
      .flatMap((entry) => {
        if (entry.posture === 'blocked') {
          return [`${entry.surface}:blocked:${entry.reasonCodes[0] ?? 'blocked-plan'}`];
        }
        const missing = entry.missingEvidenceClasses[0] ?? 'admission-plan';
        return [`${entry.surface}:missing:${missing}`];
      })
      .slice(0, 8),
  );
}

export function intelligenceSummaryFor(
  entries: readonly CryptoAdapterReadinessIntelligenceEntry[],
): CryptoAdapterReadinessIntelligenceSummary {
  const totalScore = entries.reduce((sum, entry) => sum + entry.readinessScore, 0);
  const averageReadinessScore = entries.length === 0
    ? 0
    : Math.round((totalScore / entries.length) * 100) / 100;
  const incompleteSurfaces = new Set(
    entries
      .filter((entry) => entry.posture !== 'execution-ready')
      .map((entry) => entry.surface),
  );
  const blockedSurfaces = new Set(
    entries.filter((entry) => entry.posture === 'blocked').map((entry) => entry.surface),
  );

  return Object.freeze({
    totalEntries: entries.length,
    executionReadyCount: entries.filter((entry) => entry.posture === 'execution-ready')
      .length,
    evidenceRequiredCount: entries.filter((entry) => entry.posture === 'evidence-required')
      .length,
    reviewRequiredCount: entries.filter((entry) => entry.posture === 'review-required')
      .length,
    blockedCount: entries.filter((entry) => entry.posture === 'blocked').length,
    averageReadinessScore,
    blockedSurfaceCount: blockedSurfaces.size,
    incompleteSurfaceCount: incompleteSurfaces.size,
    topRiskFactorKinds: topCounts(
      entries.flatMap((entry) => entry.riskFactors.map((factor) => factor.kind)),
    ),
    topMissingEvidenceClasses: topCounts(
      entries.flatMap((entry) => entry.missingEvidenceClasses),
    ),
    standardsCoverage: standardsCoverageFor(entries),
    operatorAttentionItems: operatorAttentionItemsFor(entries),
    privacyBoundarySafe: true,
  });
}

export function createCryptoAdapterReadinessIntelligenceProfile(
  input: CreateCryptoAdapterReadinessIntelligenceProfileInput,
): CryptoAdapterReadinessIntelligenceProfile {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt ?? input.manifest.generatedAt,
    'generatedAt',
  );
  const scopeRef = normalizeOptionalIdentifier(
    input.scopeRef ?? input.manifest.scopeRef,
    'scopeRef',
  );
  const entries = Object.freeze(input.manifest.entries.map(intelligenceEntryFor));
  const summary = intelligenceSummaryFor(entries);
  const profileId =
    normalizeOptionalIdentifier(input.profileId, 'profileId') ??
    profileIdFor({
      generatedAt,
      scopeRef,
      manifestDigest: input.manifest.digest,
    });
  const canonicalPayload = {
    version: CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION,
    profileId,
    generatedAt,
    scopeRef,
    manifestId: input.manifest.manifestId,
    manifestDigest: input.manifest.digest,
    manifestCoverage: input.manifest.coverage,
    entries,
    summary,
    privacyGuardrails: CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
