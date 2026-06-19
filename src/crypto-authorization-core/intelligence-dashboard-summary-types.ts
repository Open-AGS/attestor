import type {
  CryptoIntelligenceRiskSignalAssessment,
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals.js';
import type {
  CryptoPolicyGapNarrowingAssessment,
  CryptoPolicyIntelligenceRoutingProfile,
} from './policy-gap-narrowing.js';
import type { CryptoOperatorRiskInputBundle } from './operator-risk-input-contract.js';
import type { CryptoExecutionAdapterKind } from './types.js';

export const CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION =
  'attestor.crypto-intelligence-dashboard-summary.v1';

export const CRYPTO_INTELLIGENCE_DASHBOARD_POSTURES = [
  'ready-for-review',
  'attention-needed',
  'blocked-for-review',
] as const;
export type CryptoIntelligenceDashboardPosture =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_POSTURES[number];

export const CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS = [
  'risk-posture',
  'adapter-readiness',
  'priority-queue',
  'readiness-heatmap',
  'top-blockers',
  'missing-evidence',
  'policy-gaps',
  'operator-risk-inputs',
  'proof-links',
  'privacy-posture',
] as const;
export type CryptoIntelligenceDashboardWidget =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS[number];

export const CRYPTO_INTELLIGENCE_DASHBOARD_TILE_KINDS = [
  'signals',
  'critical-signals',
  'review-signals',
  'block-signals',
  'policy-gaps',
  'readiness-coverage',
  'operator-risk-inputs',
  'proof-links',
] as const;
export type CryptoIntelligenceDashboardTileKind =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_TILE_KINDS[number];

export const CRYPTO_INTELLIGENCE_DASHBOARD_ATTENTION_KINDS = [
  'risk-signal-blocker',
  'policy-gap-blocker',
  'policy-routing-blocker',
  'adapter-readiness-gap',
  'operator-risk-input-gap',
  'missing-evidence',
  'risk-signal-assessment-missing',
] as const;
export type CryptoIntelligenceDashboardAttentionKind =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_ATTENTION_KINDS[number];

export const CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS = [
  'risk-signal-assessment',
  'policy-gap-narrowing',
  'policy-intelligence-routing',
  'operator-risk-input',
  'adapter-readiness-manifest',
  'negative-conformance-fixtures',
  'privacy-minimization',
] as const;
export type CryptoIntelligenceDashboardProofLinkKind =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS[number];

export const CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES = [
  'ready',
  'needs-evidence',
  'blocked',
  'not-observed',
] as const;
export type CryptoIntelligenceDashboardReadinessStatus =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES[number];

export const CRYPTO_INTELLIGENCE_DASHBOARD_PRIORITY_TIERS = [
  'blocker',
  'needs-evidence',
  'review',
  'ready',
] as const;
export type CryptoIntelligenceDashboardPriorityTier =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_PRIORITY_TIERS[number];

export type CryptoIntelligenceDashboardSourceKind =
  | 'risk-signal'
  | 'policy-gap'
  | 'policy-routing'
  | 'operator-risk-input'
  | 'adapter-readiness'
  | 'dashboard';

export interface CryptoIntelligenceDashboardReadinessInput {
  readonly surface: string;
  readonly adapterKind?: CryptoExecutionAdapterKind | null;
  readonly status: CryptoIntelligenceDashboardReadinessStatus;
  readonly sourceDigest?: string | null;
  readonly reasonCodes?: readonly string[] | null;
  readonly missingEvidenceClasses?: readonly string[] | null;
}

export interface CreateCryptoIntelligenceDashboardProofLinkInput {
  readonly kind: CryptoIntelligenceDashboardProofLinkKind;
  readonly label: string;
  readonly digest: string;
  readonly route?: string | null;
}

export interface CreateCryptoIntelligenceDashboardSummaryInput {
  readonly generatedAt: string;
  readonly summaryId?: string | null;
  readonly scopeRef: string;
  readonly signalAssessments?: readonly CryptoIntelligenceRiskSignalAssessment[] | null;
  readonly policyGapAssessments?: readonly CryptoPolicyGapNarrowingAssessment[] | null;
  readonly policyIntelligenceRoutingProfiles?:
    readonly CryptoPolicyIntelligenceRoutingProfile[] | null;
  readonly operatorRiskInputBundles?: readonly CryptoOperatorRiskInputBundle[] | null;
  readonly readiness?: readonly CryptoIntelligenceDashboardReadinessInput[] | null;
  readonly proofLinks?: readonly CreateCryptoIntelligenceDashboardProofLinkInput[] | null;
  readonly routeBase?: string | null;
}

export interface CryptoIntelligenceDashboardTile {
  readonly kind: CryptoIntelligenceDashboardTileKind;
  readonly label: string;
  readonly value: number;
  readonly status: CryptoIntelligenceDashboardPosture;
}

export interface CryptoIntelligenceDashboardSurfaceRow {
  readonly surface: string;
  readonly sourceKind: CryptoIntelligenceDashboardSourceKind;
  readonly count: number;
  readonly criticalCount: number;
  readonly blockCount: number;
  readonly missingEvidenceClasses: readonly string[];
  readonly sourceDigests: readonly string[];
}

export interface CryptoIntelligenceDashboardFailureReasonRow {
  readonly reasonCode: string;
  readonly sourceKind: CryptoIntelligenceDashboardSourceKind;
  readonly count: number;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly missingEvidenceClasses: readonly string[];
  readonly sourceDigests: readonly string[];
}

export interface CryptoIntelligenceDashboardMissingEvidenceRow {
  readonly evidenceClass: string;
  readonly count: number;
  readonly sourceKinds: readonly CryptoIntelligenceDashboardSourceKind[];
  readonly sourceDigests: readonly string[];
}

export interface CryptoIntelligenceDashboardReadinessEntry {
  readonly surface: string;
  readonly adapterKind: CryptoExecutionAdapterKind | null;
  readonly status: CryptoIntelligenceDashboardReadinessStatus;
  readonly sourceDigest: string | null;
  readonly reasonCodes: readonly string[];
  readonly missingEvidenceClasses: readonly string[];
}

export interface CryptoIntelligenceDashboardReadinessHeatmapRow {
  readonly surface: string;
  readonly adapterKind: CryptoExecutionAdapterKind | null;
  readonly status: CryptoIntelligenceDashboardReadinessStatus;
  readonly priorityTier: CryptoIntelligenceDashboardPriorityTier;
  readonly readinessScore: number;
  readonly reasonCodes: readonly string[];
  readonly missingEvidenceClasses: readonly string[];
  readonly sourceDigest: string | null;
  readonly rawPayloadDrilldownEnabled: false;
}

export interface CryptoIntelligenceDashboardReadinessCoverage {
  readonly totalEntries: number;
  readonly readyCount: number;
  readonly needsEvidenceCount: number;
  readonly blockedCount: number;
  readonly notObservedCount: number;
  readonly readyCoveragePercent: number;
  readonly entries: readonly CryptoIntelligenceDashboardReadinessEntry[];
  readonly heatmapRows: readonly CryptoIntelligenceDashboardReadinessHeatmapRow[];
}

export interface CryptoIntelligenceDashboardAttentionItem {
  readonly kind: CryptoIntelligenceDashboardAttentionKind;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly count: number;
  readonly title: string;
  readonly nextStep: string;
  readonly reasonCodes: readonly string[];
  readonly missingEvidenceClasses: readonly string[];
  readonly sourceDigests: readonly string[];
}

export interface CryptoIntelligenceDashboardTopBlocker {
  readonly rank: number;
  readonly kind: CryptoIntelligenceDashboardAttentionKind;
  readonly priorityTier: CryptoIntelligenceDashboardPriorityTier;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly count: number;
  readonly title: string;
  readonly nextStep: string;
  readonly reasonCodes: readonly string[];
  readonly missingEvidenceClasses: readonly string[];
  readonly sourceDigests: readonly string[];
  readonly rawPayloadDrilldownEnabled: false;
}

export interface CryptoIntelligenceDashboardProofLink {
  readonly kind: CryptoIntelligenceDashboardProofLinkKind;
  readonly label: string;
  readonly digest: string;
  readonly route: string | null;
}

export interface CryptoIntelligenceDashboardOverview {
  readonly signalAssessmentCount: number;
  readonly riskSignalCount: number;
  readonly criticalSignalCount: number;
  readonly reviewSignalCount: number;
  readonly blockSignalCount: number;
  readonly policyGapAssessmentCount: number;
  readonly policyGapCount: number;
  readonly blockedPolicyGapCount: number;
  readonly narrowingCandidateCount: number;
  readonly policyRoutingProfileCount: number;
  readonly blockedPolicyRoutingCount: number;
  readonly reviewPolicyRoutingCount: number;
  readonly operatorRiskInputBundleCount: number;
  readonly operatorRiskInputCount: number;
  readonly acceptedOperatorRiskInputCount: number;
  readonly staleOperatorRiskInputCount: number;
  readonly rejectedOperatorRiskInputCount: number;
  readonly readinessEntryCount: number;
  readonly readyReadinessCount: number;
  readonly blockedReadinessCount: number;
  readonly proofLinkCount: number;
}

export interface CryptoIntelligenceDashboardSummary {
  readonly version: typeof CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION;
  readonly summaryId: string;
  readonly generatedAt: string;
  readonly scopeRef: string;
  readonly posture: CryptoIntelligenceDashboardPosture;
  readonly headline: string;
  readonly overview: CryptoIntelligenceDashboardOverview;
  readonly tiles: readonly CryptoIntelligenceDashboardTile[];
  readonly topSurfaces: readonly CryptoIntelligenceDashboardSurfaceRow[];
  readonly topFailureReasons: readonly CryptoIntelligenceDashboardFailureReasonRow[];
  readonly topBlockers: readonly CryptoIntelligenceDashboardTopBlocker[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceDashboardMissingEvidenceRow[];
  readonly readinessCoverage: CryptoIntelligenceDashboardReadinessCoverage;
  readonly attentionItems: readonly CryptoIntelligenceDashboardAttentionItem[];
  readonly proofLinks: readonly CryptoIntelligenceDashboardProofLink[];
  readonly widgets: typeof CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly complianceClaimed: false;
  readonly financialImpactClaimed: false;
  readonly rawPayloadStored: false;
  readonly rawPayloadDrilldownEnabled: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoIntelligenceDashboardSummaryDescriptor {
  readonly version: typeof CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION;
  readonly postures: typeof CRYPTO_INTELLIGENCE_DASHBOARD_POSTURES;
  readonly widgets: typeof CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS;
  readonly tileKinds: typeof CRYPTO_INTELLIGENCE_DASHBOARD_TILE_KINDS;
  readonly attentionKinds: typeof CRYPTO_INTELLIGENCE_DASHBOARD_ATTENTION_KINDS;
  readonly proofLinkKinds: typeof CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS;
  readonly readinessStatuses: typeof CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES;
  readonly priorityTiers: typeof CRYPTO_INTELLIGENCE_DASHBOARD_PRIORITY_TIERS;
  readonly topBlockersAvailable: true;
  readonly readinessHeatmapAvailable: true;
  readonly proofLinksAreDigestFirst: true;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly complianceClaimed: false;
  readonly financialImpactClaimed: false;
  readonly rawPayloadStored: false;
  readonly rawPayloadDrilldownEnabled: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
}
