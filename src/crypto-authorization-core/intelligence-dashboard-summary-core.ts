import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import { assertCryptoIntelligencePrivacyMinimized } from './intelligence-privacy-minimization.js';
import {
  CRYPTO_INTELLIGENCE_DASHBOARD_ATTENTION_KINDS,
  CRYPTO_INTELLIGENCE_DASHBOARD_POSTURES,
  CRYPTO_INTELLIGENCE_DASHBOARD_PRIORITY_TIERS,
  CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS,
  CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES,
  CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION,
  CRYPTO_INTELLIGENCE_DASHBOARD_TILE_KINDS,
  CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS,
  type CreateCryptoIntelligenceDashboardSummaryInput,
  type CryptoIntelligenceDashboardSummary,
  type CryptoIntelligenceDashboardSummaryDescriptor,
} from './intelligence-dashboard-summary-types.js';
import {
  addReason,
  failureReasonRows,
  missingEvidenceRows,
  surfaceRows,
  type CountedEvidence,
  type CountedReason,
  type CountedSource,
} from './intelligence-dashboard-summary-counts.js';
import {
  collectFromOperatorRiskInputs,
  collectFromPolicyGaps,
  collectFromPolicyRouting,
  collectFromReadiness,
  collectFromRiskSignals,
} from './intelligence-dashboard-summary-collectors.js';
import {
  attentionItems,
  dashboardOverview,
  dashboardPosture,
  dashboardTiles,
  headlineForPosture,
  topBlockers,
} from './intelligence-dashboard-summary-overview.js';
import {
  dedupeProofLinks,
  derivedProofLinks,
  normalizeProofLink,
  normalizeReadinessEntry,
  readinessCoverage,
} from './intelligence-dashboard-summary-proof-readiness.js';
import {
  canonicalObject,
  normalizeCompactRef,
  normalizeIsoTimestamp,
  normalizeProofRoute,
} from './intelligence-dashboard-summary-utils.js';

function payloadForSummary(input: Omit<CryptoIntelligenceDashboardSummary, 'canonical' | 'digest'>):
CanonicalReleaseJsonValue {
  return input as unknown as CanonicalReleaseJsonValue;
}

export function cryptoIntelligenceDashboardSummaryDescriptor():
CryptoIntelligenceDashboardSummaryDescriptor {
  return Object.freeze({
    version: CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION,
    postures: CRYPTO_INTELLIGENCE_DASHBOARD_POSTURES,
    widgets: CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS,
    tileKinds: CRYPTO_INTELLIGENCE_DASHBOARD_TILE_KINDS,
    attentionKinds: CRYPTO_INTELLIGENCE_DASHBOARD_ATTENTION_KINDS,
    proofLinkKinds: CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS,
    readinessStatuses: CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES,
    priorityTiers: CRYPTO_INTELLIGENCE_DASHBOARD_PRIORITY_TIERS,
    topBlockersAvailable: true,
    readinessHeatmapAvailable: true,
    proofLinksAreDigestFirst: true,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    complianceClaimed: false,
    financialImpactClaimed: false,
    rawPayloadStored: false,
    rawPayloadDrilldownEnabled: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  });
}

export function createCryptoIntelligenceDashboardSummary(
  input: CreateCryptoIntelligenceDashboardSummaryInput,
): CryptoIntelligenceDashboardSummary {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const scopeRef = normalizeCompactRef(input.scopeRef, 'scopeRef');
  const summaryId = normalizeCompactRef(
    input.summaryId ?? `crypto-intelligence-dashboard:${scopeRef}`,
    'summaryId',
  );
  const signalAssessments = Object.freeze([...(input.signalAssessments ?? [])]);
  const policyGapAssessments = Object.freeze([...(input.policyGapAssessments ?? [])]);
  const policyIntelligenceRoutingProfiles = Object.freeze([
    ...(input.policyIntelligenceRoutingProfiles ?? []),
  ]);
  const operatorRiskInputBundles = Object.freeze([...(input.operatorRiskInputBundles ?? [])]);
  const readinessEntries = Object.freeze(
    (input.readiness ?? []).map((entry) => normalizeReadinessEntry(entry)),
  );
  const routeBase = normalizeProofRoute(input.routeBase, 'routeBase');
  const proofLinks = dedupeProofLinks([
    ...derivedProofLinks({
      routeBase,
      signalAssessments,
      policyGapAssessments,
      policyIntelligenceRoutingProfiles,
      operatorRiskInputBundles,
      readinessEntries,
    }),
    ...(input.proofLinks ?? []).map((link) => normalizeProofLink(link)),
  ]);

  const surfaces = new Map<string, CountedSource>();
  const reasons = new Map<string, CountedReason>();
  const evidence = new Map<string, CountedEvidence>();

  collectFromRiskSignals(signalAssessments, surfaces, reasons, evidence);
  collectFromPolicyGaps(policyGapAssessments, surfaces, reasons, evidence);
  collectFromPolicyRouting(policyIntelligenceRoutingProfiles, surfaces, reasons);
  collectFromOperatorRiskInputs(operatorRiskInputBundles, surfaces, reasons, evidence);
  collectFromReadiness(readinessEntries, surfaces, reasons, evidence);

  if (signalAssessments.length === 0) {
    addReason(reasons, {
      reasonCode: 'risk-signal-assessment-missing',
      sourceKind: 'dashboard',
      severity: 'warning',
      disposition: 'review',
    });
  }

  const readiness = readinessCoverage(readinessEntries);
  const topSurfaces = surfaceRows(surfaces);
  const topFailureReasons = failureReasonRows(reasons);
  const missingEvidenceClasses = missingEvidenceRows(evidence);
  const overview = dashboardOverview({
    signalAssessments,
    policyGapAssessments,
    policyIntelligenceRoutingProfiles,
    operatorRiskInputBundles,
    readiness,
    proofLinks,
  });
  const posture = dashboardPosture({
    overview,
    readiness,
    operatorRiskInputBundles,
    signalAssessments,
  });
  const attention = attentionItems({
    overview,
    readiness,
    topFailureReasons,
    missingEvidence: missingEvidenceClasses,
  });
  const payload = Object.freeze({
    version: CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION,
    summaryId,
    generatedAt,
    scopeRef,
    posture,
    headline: headlineForPosture(posture),
    overview,
    tiles: dashboardTiles({ overview, readiness }),
    topSurfaces,
    topFailureReasons,
    topBlockers: topBlockers(attention),
    missingEvidenceClasses,
    readinessCoverage: readiness,
    attentionItems: attention,
    proofLinks,
    widgets: CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    complianceClaimed: false,
    financialImpactClaimed: false,
    rawPayloadStored: false,
    rawPayloadDrilldownEnabled: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  } satisfies Omit<CryptoIntelligenceDashboardSummary, 'canonical' | 'digest'>);

  assertCryptoIntelligencePrivacyMinimized({
    surfaceKind: 'intelligence-dashboard-summary',
    artifact: payload,
  });
  const canonical = canonicalObject(payloadForSummary(payload));

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function cryptoIntelligenceDashboardSummaryLabel(
  summary: CryptoIntelligenceDashboardSummary,
): string {
  return [
    'crypto-intelligence-dashboard',
    `posture:${summary.posture}`,
    `signals:${summary.overview.riskSignalCount}`,
    `gaps:${summary.overview.policyGapCount}`,
    `readiness:${summary.readinessCoverage.readyCoveragePercent}`,
  ].join(' / ');
}
