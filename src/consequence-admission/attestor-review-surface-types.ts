import type {
  AssuranceMeasurementPlane,
} from './assurance-measurement-plane.js';
import type {
  ConsequenceAuditEvidenceExport,
} from './audit-evidence-export.js';
import type {
  ConsequenceBusinessRiskDashboard,
} from './business-risk-dashboard.js';
import type {
  ConsequenceDashboardApiSummary,
} from './dashboard-api-summary.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  EvidenceStateModel,
} from './evidence-state-model.js';
import type {
  ReviewByExceptionInboxResult,
} from './review-by-exception-inbox.js';

export const ATTESTOR_REVIEW_SURFACE_VERSION =
  'attestor.review-surface.v1';

export const ATTESTOR_REVIEW_SURFACE_AREAS = [
  'overview',
  'review-queue',
  'cases',
  'action-map',
  'evidence-library',
  'policy',
  'assurance',
] as const;
export type AttestorReviewSurfaceArea =
  typeof ATTESTOR_REVIEW_SURFACE_AREAS[number];

export const ATTESTOR_REVIEW_SURFACE_DATA_FORMS = [
  'ui',
  'json-api',
  'csv-export',
  'markdown-html-packet',
  'proof-bundle',
  'digest-ref-link',
] as const;
export type AttestorReviewSurfaceDataForm =
  typeof ATTESTOR_REVIEW_SURFACE_DATA_FORMS[number];

export const ATTESTOR_REVIEW_SURFACE_CONTRACT_SLICES = [
  'ReviewSurfaceOverview',
  'ReviewQueueItem',
  'ReviewCaseDetail',
  'EvidenceArtifactIndex',
  'ActionSurfaceMapView',
  'ShadowPilotIntegrationHandoff',
  'PolicyPromotionPanel',
  'AssuranceHealthPanel',
] as const;
export type AttestorReviewSurfaceContractSlice =
  typeof ATTESTOR_REVIEW_SURFACE_CONTRACT_SLICES[number];

export const ATTESTOR_REVIEW_SURFACE_FRESHNESS_STATES = [
  'fresh',
  'stale',
  'degraded',
  'unknown',
] as const;
export type AttestorReviewSurfaceFreshnessState =
  typeof ATTESTOR_REVIEW_SURFACE_FRESHNESS_STATES[number];

export const ATTESTOR_REVIEW_SURFACE_LIFECYCLE_STATES = [
  'open',
  'needs-review',
  'accepted',
  'dismissed',
  'reopened',
  'superseded',
  'stale',
  'monitoring',
] as const;
export type AttestorReviewSurfaceLifecycleState =
  typeof ATTESTOR_REVIEW_SURFACE_LIFECYCLE_STATES[number];

export const ATTESTOR_REVIEW_SURFACE_STATUS_LABELS = [
  'blocked',
  'needs-review',
  'missing-evidence',
  'ready-to-approve',
  'monitoring',
  'stale',
  'verified',
] as const;
export type AttestorReviewSurfaceStatusLabel =
  typeof ATTESTOR_REVIEW_SURFACE_STATUS_LABELS[number];

export const ATTESTOR_REVIEW_SURFACE_SOURCE_SURFACES = [
  'dashboard-api-summary',
  'business-risk-dashboard',
  'audit-evidence-export',
  'external-review-packet',
  'tamper-evident-history',
  'review-by-exception-inbox',
  'approval-dismiss-feedback-loop',
  'action-surface-graph',
  'evidence-state-model',
  'policy-candidate-pr-contract',
  'assurance-measurement-plane',
  'policy-foundry-hosted-review-surface',
] as const;
export type AttestorReviewSurfaceSourceSurface =
  typeof ATTESTOR_REVIEW_SURFACE_SOURCE_SURFACES[number];

export const ATTESTOR_REVIEW_SURFACE_REQUIRED_FIELDS = [
  'tenantDigest',
  'environment',
  'timeWindow',
  'mode',
  'decisionPosture',
  'reasonCodes',
  'noGoReasons',
  'evidenceState',
  'sourceDigests',
  'freshnessState',
  'nextSafeStep',
] as const;
export type AttestorReviewSurfaceRequiredField =
  typeof ATTESTOR_REVIEW_SURFACE_REQUIRED_FIELDS[number];

export const ATTESTOR_REVIEW_SURFACE_PROHIBITED_RAW_CLASSES = [
  'raw-prompts',
  'raw-payloads',
  'raw-provider-bodies',
  'raw-customer-identifiers',
  'payment-details',
  'wallet-material',
  'credentials',
  'private-thresholds',
  'idempotency-keys',
  'replay-keys',
  'downstream-responses',
  'provider-error-bodies',
] as const;
export type AttestorReviewSurfaceProhibitedRawClass =
  typeof ATTESTOR_REVIEW_SURFACE_PROHIBITED_RAW_CLASSES[number];

export type AttestorReviewSurfaceMode =
  | 'observe'
  | 'warn'
  | 'review'
  | 'enforce'
  | 'mixed'
  | 'unknown';

export type AttestorReviewSurfaceDecisionPosture =
  | 'visibility-only'
  | 'attention-needed'
  | 'blocked-for-review'
  | 'unknown';

export type AttestorReviewSurfaceEvidenceState =
  | 'present'
  | 'missing'
  | 'partial'
  | 'conflicting'
  | 'stale'
  | 'unknown';

export interface AttestorReviewSurfaceTimeWindow {
  readonly start: string | null;
  readonly end: string | null;
}

export interface AttestorReviewSurfaceFreshness {
  readonly sourceDigest: string;
  readonly sourceObservedAt: string | null;
  readonly lastRefreshedAt: string | null;
  readonly freshnessState: AttestorReviewSurfaceFreshnessState;
  readonly sourceGeneration: string | number | null;
}

export interface AttestorReviewSurfaceCommon {
  readonly tenantDigest: string | null;
  readonly environment: string | null;
  readonly timeWindow: AttestorReviewSurfaceTimeWindow;
  readonly mode: AttestorReviewSurfaceMode;
  readonly decisionPosture: AttestorReviewSurfaceDecisionPosture;
  readonly reasonCodes: readonly string[];
  readonly noGoReasons: readonly string[];
  readonly evidenceState: AttestorReviewSurfaceEvidenceState;
  readonly sourceDigests: readonly string[];
  readonly freshnessState: AttestorReviewSurfaceFreshnessState;
  readonly nextSafeStep: string;
  readonly rawPayloadStored: false;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export interface ReviewSurfaceOverview extends AttestorReviewSurfaceCommon {
  readonly area: 'overview';
  readonly attentionCount: number;
  readonly blockedCount: number;
  readonly reviewCount: number;
  readonly staleCount: number;
}

export interface ReviewQueueItem extends AttestorReviewSurfaceCommon {
  readonly area: 'review-queue';
  readonly queueItemId: string;
  readonly caseDigest: string;
  readonly statusLabel: AttestorReviewSurfaceStatusLabel;
  readonly lifecycleState: AttestorReviewSurfaceLifecycleState;
  readonly defaultVisible: boolean;
}

export interface ReviewCaseDetail extends AttestorReviewSurfaceCommon {
  readonly area: 'cases';
  readonly caseDigest: string;
  readonly statusLabel: AttestorReviewSurfaceStatusLabel;
  readonly lifecycleState: AttestorReviewSurfaceLifecycleState;
  readonly queueItemId: string | null;
  readonly admissionDigests: readonly string[];
  readonly eventDigests: readonly string[];
  readonly candidateDigests: readonly string[];
  readonly evidenceDigests: readonly string[];
  readonly timelineDigests: readonly string[];
  readonly proofLinkDigests: readonly string[];
  readonly correlationDigests: readonly string[];
  readonly rawCaseMaterialStored: false;
  readonly canAdmit: false;
  readonly canBlockAction: false;
}

export interface CreateAttestorReviewCaseDetailInput {
  readonly reviewSurface: AttestorReviewSurface;
  readonly caseDigest: string;
  readonly queueItemId?: string | null;
  readonly admissionDigests?: readonly string[] | null;
  readonly eventDigests?: readonly string[] | null;
  readonly candidateDigests?: readonly string[] | null;
  readonly evidenceDigests?: readonly string[] | null;
  readonly proofLinkDigests?: readonly string[] | null;
  readonly timelineDigests?: readonly string[] | null;
}

export interface EvidenceArtifactIndex extends AttestorReviewSurfaceCommon {
  readonly area: 'evidence-library';
  readonly artifactDigests: readonly string[];
  readonly exportDigest: string | null;
  readonly rawMaterialBoundary: string;
}

export interface ActionSurfaceMapView extends AttestorReviewSurfaceCommon {
  readonly area: 'action-map';
  readonly actorDigests: readonly string[];
  readonly downstreamSystemRefs: readonly string[];
  readonly policyRefs: readonly string[];
}

export interface ShadowPilotIntegrationHandoff extends AttestorReviewSurfaceCommon {
  readonly area: 'action-map';
  readonly handoffKind: 'shadow-pilot-to-action-surface-onboarding';
  readonly hostedOnboardingRoute: '/api/v1/shadow/action-surface/onboarding-packet';
  readonly hostedOnboardingMethod: 'POST';
  readonly includeShadowEventsDefault: true;
  readonly localIntegrationKitCommand: 'npm run render:action-surface-integration-kit';
  readonly actionSurfaceRefs: readonly string[];
  readonly actionSurfaceDigests: readonly string[];
  readonly reviewCaseDigests: readonly string[];
  readonly requiredReviewedInputs: readonly string[];
  readonly expectedReviewOutputs: readonly string[];
  readonly rawMetadataUploadRequired: false;
  readonly reviewedMetadataRequired: true;
  readonly customerReviewRequired: true;
  readonly customerOwnedGateRequiredForEnforcement: true;
  readonly approvalRequired: true;
  readonly activatesEnforcement: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly nonBypassableClaimAllowed: false;
  readonly authority: 'handoff-review-only';
}

export interface PolicyPromotionPanel extends AttestorReviewSurfaceCommon {
  readonly area: 'policy';
  readonly candidateDigests: readonly string[];
  readonly promotionBlocked: boolean;
  readonly approvalRequired: boolean;
}

export interface AssuranceHealthPanel extends AttestorReviewSurfaceCommon {
  readonly area: 'assurance';
  readonly degradedSignalCount: number;
  readonly driftSignalCount: number;
  readonly reviewLoadSignalCount: number;
}

export interface AttestorReviewSurfaceAuthorityBoundary {
  readonly canBlockAction: false;
  readonly canGrantAuthority: false;
  readonly canReduceEvidenceRequirements: false;
  readonly canActivateEnforcement: false;
  readonly canMutatePolicyBundle: false;
  readonly reviewMaterialOnly: true;
}

export interface AttestorReviewSurfaceContractDescriptor {
  readonly version: typeof ATTESTOR_REVIEW_SURFACE_VERSION;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'attestor-review-surface';
  readonly areas: typeof ATTESTOR_REVIEW_SURFACE_AREAS;
  readonly dataForms: typeof ATTESTOR_REVIEW_SURFACE_DATA_FORMS;
  readonly contractSlices: typeof ATTESTOR_REVIEW_SURFACE_CONTRACT_SLICES;
  readonly sourceSurfaces: typeof ATTESTOR_REVIEW_SURFACE_SOURCE_SURFACES;
  readonly freshnessStates: typeof ATTESTOR_REVIEW_SURFACE_FRESHNESS_STATES;
  readonly lifecycleStates: typeof ATTESTOR_REVIEW_SURFACE_LIFECYCLE_STATES;
  readonly statusLabels: typeof ATTESTOR_REVIEW_SURFACE_STATUS_LABELS;
  readonly requiredFields: typeof ATTESTOR_REVIEW_SURFACE_REQUIRED_FIELDS;
  readonly prohibitedRawClasses: typeof ATTESTOR_REVIEW_SURFACE_PROHIBITED_RAW_CLASSES;
  readonly authorityBoundary: AttestorReviewSurfaceAuthorityBoundary;
  readonly rawPayloadStored: false;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly mutatesPolicyBundle: false;
  readonly grantsAuthority: false;
  readonly customerPepNoBypassProven: false;
  readonly complianceClaimed: false;
  readonly hostedUiImplemented: false;
  readonly reviewMaterialOnly: true;
  readonly limitations: readonly string[];
}

export interface CreateAttestorReviewSurfaceInput {
  readonly auditEvidence: ConsequenceAuditEvidenceExport;
  readonly businessRiskDashboard: ConsequenceBusinessRiskDashboard;
  readonly dashboardSummary: ConsequenceDashboardApiSummary;
  readonly reviewInbox?: ReviewByExceptionInboxResult | null;
  readonly evidenceState?: EvidenceStateModel | null;
  readonly assurance?: AssuranceMeasurementPlane | null;
  readonly generatedAt?: string | null;
  readonly reviewSurfaceId?: string | null;
}

export interface AttestorReviewSurface {
  readonly version: typeof ATTESTOR_REVIEW_SURFACE_VERSION;
  readonly generatedAt: string;
  readonly reviewSurfaceId: string;
  readonly tenantDigest: string | null;
  readonly environment: string | null;
  readonly timeWindow: AttestorReviewSurfaceTimeWindow;
  readonly mode: AttestorReviewSurfaceMode;
  readonly decisionPosture: AttestorReviewSurfaceDecisionPosture;
  readonly sourceAuditExportDigest: string;
  readonly sourceBusinessRiskDashboardDigest: string;
  readonly sourceDashboardSummaryDigest: string;
  readonly sourceReviewInboxDigest: string | null;
  readonly sourceEvidenceStateDigest: string | null;
  readonly sourceAssuranceDigest: string | null;
  readonly sourceDigests: readonly string[];
  readonly sourceSurfaces: readonly AttestorReviewSurfaceSourceSurface[];
  readonly overview: ReviewSurfaceOverview;
  readonly reviewQueue: readonly ReviewQueueItem[];
  readonly caseDigests: readonly string[];
  readonly evidenceLibrary: EvidenceArtifactIndex;
  readonly actionMap: ActionSurfaceMapView;
  readonly integrationHandoff: ShadowPilotIntegrationHandoff;
  readonly policy: PolicyPromotionPanel;
  readonly assurance: AssuranceHealthPanel;
  readonly rawPayloadStored: false;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly mutatesPolicyBundle: false;
  readonly grantsAuthority: false;
  readonly customerPepNoBypassProven: false;
  readonly complianceClaimed: false;
  readonly hostedUiImplemented: false;
  readonly reviewMaterialOnly: true;
  readonly canonical: string;
  readonly digest: string;
}
