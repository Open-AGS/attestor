import type { CryptoIntelligenceRiskSignalAssessment } from './intelligence-risk-signals.js';
import type {
  CryptoPolicyGapNarrowingAssessment,
  CryptoPolicyIntelligenceRoutingProfile,
} from './policy-gap-narrowing.js';
import type { CryptoOperatorRiskInputBundle } from './operator-risk-input-contract.js';
import {
  CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS,
  CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES,
  type CreateCryptoIntelligenceDashboardProofLinkInput,
  type CryptoIntelligenceDashboardProofLink,
  type CryptoIntelligenceDashboardReadinessCoverage,
  type CryptoIntelligenceDashboardReadinessEntry,
  type CryptoIntelligenceDashboardReadinessHeatmapRow,
  type CryptoIntelligenceDashboardReadinessInput,
} from './intelligence-dashboard-summary-types.js';
import {
  READINESS_STATUS_RANK,
  includesValue,
  normalizeCompactRef,
  normalizeDigest,
  normalizeLabel,
  normalizeOptionalDigest,
  normalizeProofRoute,
  normalizeReasonCode,
  priorityTierForReadinessStatus,
  readinessScoreForStatus,
  uniqueSorted,
} from './intelligence-dashboard-summary-utils.js';

export function normalizeReadinessEntry(
  entry: CryptoIntelligenceDashboardReadinessInput,
): CryptoIntelligenceDashboardReadinessEntry {
  if (!includesValue(CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES, entry.status)) {
    throw new Error(`Crypto intelligence dashboard summary readiness status is unsupported: ${entry.status}.`);
  }
  return Object.freeze({
    surface: normalizeCompactRef(entry.surface, 'readiness.surface'),
    adapterKind: entry.adapterKind ?? null,
    status: entry.status,
    sourceDigest: normalizeOptionalDigest(entry.sourceDigest, 'readiness.sourceDigest'),
    reasonCodes: uniqueSorted((entry.reasonCodes ?? []).map(normalizeReasonCode)),
    missingEvidenceClasses: uniqueSorted(
      (entry.missingEvidenceClasses ?? []).map((evidenceClass) =>
        normalizeCompactRef(evidenceClass, 'readiness.missingEvidenceClass'),
      ),
    ),
  });
}

export function normalizeProofLink(
  link: CreateCryptoIntelligenceDashboardProofLinkInput,
): CryptoIntelligenceDashboardProofLink {
  if (!includesValue(CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS, link.kind)) {
    throw new Error(`Crypto intelligence dashboard summary proof link kind is unsupported: ${link.kind}.`);
  }
  return Object.freeze({
    kind: link.kind,
    label: normalizeLabel(link.label, 'proofLink.label'),
    digest: normalizeDigest(link.digest, 'proofLink.digest'),
    route: normalizeProofRoute(link.route, 'proofLink.route'),
  });
}

function routeFor(routeBase: string | null, segment: string): string | null {
  return routeBase === null ? null : `${routeBase}/${segment}`;
}

export function derivedProofLinks(input: {
  readonly routeBase: string | null;
  readonly signalAssessments: readonly CryptoIntelligenceRiskSignalAssessment[];
  readonly policyGapAssessments: readonly CryptoPolicyGapNarrowingAssessment[];
  readonly policyIntelligenceRoutingProfiles:
    readonly CryptoPolicyIntelligenceRoutingProfile[];
  readonly operatorRiskInputBundles: readonly CryptoOperatorRiskInputBundle[];
  readonly readinessEntries: readonly CryptoIntelligenceDashboardReadinessEntry[];
}): readonly CryptoIntelligenceDashboardProofLink[] {
  const links: CryptoIntelligenceDashboardProofLink[] = [];
  for (const assessment of input.signalAssessments) {
    links.push(
      normalizeProofLink({
        kind: 'risk-signal-assessment',
        label: `risk signals ${assessment.consequenceKind}`,
        digest: assessment.digest,
        route: routeFor(input.routeBase, 'risk-signals'),
      }),
    );
  }
  for (const assessment of input.policyGapAssessments) {
    links.push(
      normalizeProofLink({
        kind: 'policy-gap-narrowing',
        label: 'policy gap narrowing',
        digest: assessment.digest,
        route: routeFor(input.routeBase, 'policy-gaps'),
      }),
    );
  }
  for (const profile of input.policyIntelligenceRoutingProfiles) {
    links.push(
      normalizeProofLink({
        kind: 'policy-intelligence-routing',
        label: `policy routing ${profile.dominantRouteKind}`,
        digest: profile.digest,
        route: routeFor(input.routeBase, 'policy-routing'),
      }),
    );
  }
  for (const bundle of input.operatorRiskInputBundles) {
    links.push(
      normalizeProofLink({
        kind: 'operator-risk-input',
        label: 'operator risk input',
        digest: bundle.digest,
        route: routeFor(input.routeBase, 'operator-risk-inputs'),
      }),
    );
  }
  for (const entry of input.readinessEntries) {
    if (entry.sourceDigest === null) continue;
    links.push(
      normalizeProofLink({
        kind: 'adapter-readiness-manifest',
        label: `adapter readiness ${entry.surface}`,
        digest: entry.sourceDigest,
        route: routeFor(input.routeBase, 'adapter-readiness'),
      }),
    );
  }

  return Object.freeze(links);
}

export function dedupeProofLinks(
  links: readonly CryptoIntelligenceDashboardProofLink[],
): readonly CryptoIntelligenceDashboardProofLink[] {
  const byKey = new Map<string, CryptoIntelligenceDashboardProofLink>();
  for (const link of links) {
    byKey.set(`${link.kind}:${link.digest}:${link.route ?? ''}:${link.label}`, link);
  }
  return Object.freeze(
    [...byKey.values()].sort((left, right) =>
      `${left.kind}:${left.label}:${left.digest}`.localeCompare(
        `${right.kind}:${right.label}:${right.digest}`,
      ),
    ),
  );
}

export function readinessHeatmapRows(
  entries: readonly CryptoIntelligenceDashboardReadinessEntry[],
): readonly CryptoIntelligenceDashboardReadinessHeatmapRow[] {
  return Object.freeze(
    [...entries]
      .sort((left, right) => {
        const statusDelta =
          READINESS_STATUS_RANK[right.status] - READINESS_STATUS_RANK[left.status];
        if (statusDelta !== 0) return statusDelta;
        return `${left.surface}:${left.adapterKind ?? ''}`.localeCompare(
          `${right.surface}:${right.adapterKind ?? ''}`,
        );
      })
      .map((entry) =>
        Object.freeze({
          surface: entry.surface,
          adapterKind: entry.adapterKind,
          status: entry.status,
          priorityTier: priorityTierForReadinessStatus(entry.status),
          readinessScore: readinessScoreForStatus(entry.status),
          reasonCodes: entry.reasonCodes,
          missingEvidenceClasses: entry.missingEvidenceClasses,
          sourceDigest: entry.sourceDigest,
          rawPayloadDrilldownEnabled: false,
        }),
      ),
  );
}

export function readinessCoverage(
  entries: readonly CryptoIntelligenceDashboardReadinessEntry[],
): CryptoIntelligenceDashboardReadinessCoverage {
  const readyCount = entries.filter((entry) => entry.status === 'ready').length;
  const needsEvidenceCount = entries.filter((entry) => entry.status === 'needs-evidence').length;
  const blockedCount = entries.filter((entry) => entry.status === 'blocked').length;
  const notObservedCount = entries.filter((entry) => entry.status === 'not-observed').length;
  const readyCoveragePercent =
    entries.length === 0 ? 0 : Math.round((readyCount / entries.length) * 100);

  return Object.freeze({
    totalEntries: entries.length,
    readyCount,
    needsEvidenceCount,
    blockedCount,
    notObservedCount,
    readyCoveragePercent,
    entries: Object.freeze(
      [...entries].sort((left, right) =>
        `${left.status}:${left.surface}`.localeCompare(`${right.status}:${right.surface}`),
      ),
    ),
    heatmapRows: readinessHeatmapRows(entries),
  });
}
