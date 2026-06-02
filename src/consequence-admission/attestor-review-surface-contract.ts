import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
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

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function hashCanonical(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Attestor review surface ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Attestor review surface ${fieldName} requires a non-empty value.`);
  }
  if (normalized.length > 512 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`Attestor review surface ${fieldName} must be bounded and control-free.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Attestor review surface ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function uniqueSorted(values: readonly (string | null | undefined)[]): readonly string[] {
  return Object.freeze(
    [...new Set(values.filter((value): value is string =>
      typeof value === 'string' && value.trim().length > 0
    ).map((value) => value.trim()))].sort(),
  );
}

function tenantDigest(value: string | null): string | null {
  if (value === null) return null;
  return hashCanonical({ tenantId: value } as unknown as CanonicalReleaseJsonValue);
}

function modeFor(summary: ConsequenceAuditEvidenceExport['summary']):
AttestorReviewSurfaceMode {
  const modes = Object.entries(summary.byMode)
    .filter(([, count]) => count > 0)
    .map(([mode]) => mode);
  if (modes.length === 0) return 'unknown';
  if (modes.length > 1) return 'mixed';
  const [mode] = modes;
  if (
    mode === 'observe' ||
    mode === 'warn' ||
    mode === 'review' ||
    mode === 'enforce'
  ) {
    return mode;
  }
  return 'unknown';
}

function evidenceStateFor(input: {
  readonly auditEvidence: ConsequenceAuditEvidenceExport;
  readonly evidenceState: EvidenceStateModel | null;
}): AttestorReviewSurfaceEvidenceState {
  if (input.evidenceState) {
    if (input.evidenceState.stateCounts.conflicting > 0) return 'conflicting';
    if (input.evidenceState.stateCounts.stale > 0) return 'stale';
    if (
      input.evidenceState.stateCounts.missing > 0 ||
      input.evidenceState.stateCounts.untrusted > 0 ||
      input.evidenceState.stateCounts.inferred > 0
    ) {
      return 'partial';
    }
    return input.evidenceState.surfaceCount > 0 ? 'present' : 'unknown';
  }
  if (input.auditEvidence.artifactRefs.length > 0) return 'present';
  return input.auditEvidence.controlSummary.shadowEventCount > 0 ? 'partial' : 'unknown';
}

function freshnessStateFor(input: {
  readonly evidenceState: EvidenceStateModel | null;
  readonly assurance: AssuranceMeasurementPlane | null;
}): AttestorReviewSurfaceFreshnessState {
  if (
    input.assurance?.status === 'measurement-degraded' ||
    input.assurance?.summary.degradedSignalCount && input.assurance.summary.degradedSignalCount > 0
  ) {
    return 'degraded';
  }
  if (input.evidenceState?.stateCounts.stale && input.evidenceState.stateCounts.stale > 0) {
    return 'stale';
  }
  if (!input.evidenceState) return 'unknown';
  return 'fresh';
}

function reasonCodesFromAudit(
  auditEvidence: ConsequenceAuditEvidenceExport,
): readonly string[] {
  return uniqueSorted(auditEvidence.findings.flatMap((finding) => finding.reasonCodes));
}

function noGoReasonsFromAudit(
  auditEvidence: ConsequenceAuditEvidenceExport,
): readonly string[] {
  return uniqueSorted(
    auditEvidence.findings
      .filter((finding) => finding.severity === 'high' || finding.severity === 'blocker')
      .map((finding) => finding.kind),
  );
}

function common(input: {
  readonly tenantDigestValue: string | null;
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
}): AttestorReviewSurfaceCommon {
  return Object.freeze({
    tenantDigest: input.tenantDigestValue,
    environment: input.environment,
    timeWindow: input.timeWindow,
    mode: input.mode,
    decisionPosture: input.decisionPosture,
    reasonCodes: Object.freeze([...input.reasonCodes].sort()),
    noGoReasons: Object.freeze([...input.noGoReasons].sort()),
    evidenceState: input.evidenceState,
    sourceDigests: Object.freeze([...input.sourceDigests].sort()),
    freshnessState: input.freshnessState,
    nextSafeStep: input.nextSafeStep,
    rawPayloadStored: false,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
  });
}

function nextSafeStepFor(input: {
  readonly auditEvidence: ConsequenceAuditEvidenceExport;
  readonly dashboardSummary: ConsequenceDashboardApiSummary;
  readonly reviewInbox: ReviewByExceptionInboxResult | null;
  readonly assurance: AssuranceMeasurementPlane | null;
}): string {
  if (input.assurance && input.assurance.status !== 'healthy') return input.assurance.nextSafeStep;
  if (input.reviewInbox?.items[0]) {
    const item = input.reviewInbox.items[0];
    if (item.lane === 'failed-replay') return 'Fix replay failures before approval or enforcement planning.';
    if (item.lane === 'blocked-by-evidence') return 'Provide missing evidence before approval or enforcement planning.';
    if (item.lane === 'needs-answer') return 'Answer the reviewer question before promotion.';
    if (item.lane === 'ready-to-approve') return 'Route the candidate through explicit approval; do not auto-activate it.';
  }
  return input.dashboardSummary.attentionItems[0]?.nextStep ??
    (input.auditEvidence.controlPosture.reviewReady
      ? 'Open the review queue and inspect digest-bound evidence before promotion.'
      : 'Collect shadow evidence before drawing review-surface conclusions.');
}

function statusLabelForInboxItem(item: ReviewByExceptionInboxResult['items'][number]):
AttestorReviewSurfaceStatusLabel {
  if (item.lane === 'failed-replay') return 'blocked';
  if (item.lane === 'blocked-by-evidence') return 'missing-evidence';
  if (item.lane === 'needs-answer') return 'needs-review';
  if (item.lane === 'ready-to-approve') return 'ready-to-approve';
  return 'monitoring';
}

function lifecycleForInboxItem(item: ReviewByExceptionInboxResult['items'][number]):
AttestorReviewSurfaceLifecycleState {
  if (item.lane === 'monitoring-only') return 'monitoring';
  if (item.lane === 'ready-to-approve') return 'needs-review';
  return item.approvalBlocked ? 'open' : 'needs-review';
}

function queueFromInbox(input: {
  readonly inbox: ReviewByExceptionInboxResult;
  readonly base: AttestorReviewSurfaceCommon;
}): readonly ReviewQueueItem[] {
  return Object.freeze(
    input.inbox.items.map((item) => Object.freeze({
      ...input.base,
      area: 'review-queue' as const,
      queueItemId: item.itemId,
      caseDigest: item.reviewContextDigest,
      statusLabel: statusLabelForInboxItem(item),
      lifecycleState: lifecycleForInboxItem(item),
      defaultVisible: item.defaultVisible,
      sourceDigests: Object.freeze([
        ...input.base.sourceDigests,
        item.itemDigest,
        item.reviewContextDigest,
        item.sourcePolicyCandidateDigest,
        item.sourcePolicyTwinCandidateDigest,
        item.sourceEvidenceStateDigest,
      ].sort()),
      reasonCodes: Object.freeze([...new Set([
        ...input.base.reasonCodes,
        ...item.reasonCodes,
      ])].sort()),
      noGoReasons: Object.freeze([...new Set([
        ...input.base.noGoReasons,
        ...item.noGoReasons,
      ])].sort()),
      nextSafeStep: item.requiredAction === 'fix-replay'
        ? 'Fix replay evidence before approval.'
        : item.requiredAction === 'provide-evidence'
          ? 'Provide missing evidence before approval.'
          : item.requiredAction === 'answer-question'
            ? 'Answer the reviewer question.'
            : item.requiredAction === 'approve-candidate'
              ? 'Route candidate to explicit approval.'
              : 'Keep monitoring; do not activate enforcement from monitoring state.',
    })),
  );
}

function statusLabelForAttention(kind: string): AttestorReviewSurfaceStatusLabel {
  if (
    kind === 'blocked-action' ||
    kind === 'downstream-proof-missing' ||
    kind === 'promotion-not-ready' ||
    kind === 'raw-payload-risk'
  ) {
    return kind === 'downstream-proof-missing' ? 'missing-evidence' : 'blocked';
  }
  if (kind === 'approve-candidates') return 'ready-to-approve';
  if (kind === 'redacted-evidence-ready') return 'verified';
  return 'needs-review';
}

function queueFromDashboard(input: {
  readonly dashboardSummary: ConsequenceDashboardApiSummary;
  readonly base: AttestorReviewSurfaceCommon;
}): readonly ReviewQueueItem[] {
  return Object.freeze(
    input.dashboardSummary.attentionItems.map((item) => {
      const caseDigest = hashCanonical({
        kind: item.kind,
        route: item.route,
        sourceDigest: input.dashboardSummary.digest,
      } as unknown as CanonicalReleaseJsonValue);
      return Object.freeze({
        ...input.base,
        area: 'review-queue' as const,
        queueItemId: item.itemId,
        caseDigest,
        statusLabel: statusLabelForAttention(item.kind),
        lifecycleState: item.kind === 'redacted-evidence-ready' ? 'monitoring' : 'needs-review',
        defaultVisible: item.kind !== 'redacted-evidence-ready',
        reasonCodes: Object.freeze([...new Set([
          ...input.base.reasonCodes,
          ...item.reasonCodes,
        ])].sort()),
        sourceDigests: Object.freeze([
          ...input.base.sourceDigests,
          input.dashboardSummary.digest,
          caseDigest,
        ].sort()),
        nextSafeStep: item.nextStep,
      });
    }),
  );
}

function validateSources(input: CreateAttestorReviewSurfaceInput): void {
  if (input.businessRiskDashboard.sourceAuditExportDigest !== input.auditEvidence.digest) {
    throw new Error(
      'Attestor review surface businessRiskDashboard must be bound to the auditEvidence digest.',
    );
  }
  if (input.dashboardSummary.sourceAuditExportDigest !== input.auditEvidence.digest) {
    throw new Error(
      'Attestor review surface dashboardSummary must be bound to the auditEvidence digest.',
    );
  }
  if (input.dashboardSummary.sourceDashboardDigest !== input.businessRiskDashboard.digest) {
    throw new Error(
      'Attestor review surface dashboardSummary must be bound to the businessRiskDashboard digest.',
    );
  }
  const unsafeSources: readonly unknown[] = [
    input.auditEvidence.rawPayloadStored,
    input.businessRiskDashboard.rawPayloadStored,
    input.dashboardSummary.rawPayloadStored,
    input.reviewInbox?.rawPayloadStored,
    input.evidenceState?.rawPayloadStored,
    input.assurance?.rawPayloadStored,
  ];
  if (unsafeSources.some((value) => value === true)) {
    throw new Error('Attestor review surface sources must be raw-payload-free.');
  }
  if (
    input.businessRiskDashboard.autoEnforce ||
    input.dashboardSummary.autoEnforce ||
    input.reviewInbox?.autoEnforce ||
    input.evidenceState?.autoEnforce ||
    input.assurance?.autoEnforce
  ) {
    throw new Error('Attestor review surface sources must not auto-enforce.');
  }
}

export function createAttestorReviewSurface(
  input: CreateAttestorReviewSurfaceInput,
): AttestorReviewSurface {
  validateSources(input);
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt ?? input.dashboardSummary.generatedAt,
    'generatedAt',
  );
  const reviewSurfaceId = normalizeOptionalIdentifier(
    input.reviewSurfaceId,
    'reviewSurfaceId',
  ) ?? `attestor-review-surface:${hashCanonical({
    generatedAt,
    auditEvidenceDigest: input.auditEvidence.digest,
    dashboardDigest: input.businessRiskDashboard.digest,
    dashboardSummaryDigest: input.dashboardSummary.digest,
    reviewInboxDigest: input.reviewInbox?.digest ?? null,
    evidenceStateDigest: input.evidenceState?.digest ?? null,
    assuranceDigest: input.assurance?.digest ?? null,
  } as unknown as CanonicalReleaseJsonValue)}`;
  const sourceDigests = uniqueSorted([
    input.auditEvidence.digest,
    input.businessRiskDashboard.digest,
    input.dashboardSummary.digest,
    input.reviewInbox?.digest,
    input.evidenceState?.digest,
    input.assurance?.digest,
    ...input.auditEvidence.artifactRefs.map((artifact) => artifact.digest),
  ]);
  const tenantDigestValue = tenantDigest(input.auditEvidence.scope.tenantId);
  const timeWindow = Object.freeze({
    start: input.auditEvidence.period.start,
    end: input.auditEvidence.period.end,
  });
  const mode = modeFor(input.auditEvidence.summary);
  const decisionPosture = input.businessRiskDashboard.posture;
  const evidenceState = evidenceStateFor({
    auditEvidence: input.auditEvidence,
    evidenceState: input.evidenceState ?? null,
  });
  const freshnessState = freshnessStateFor({
    evidenceState: input.evidenceState ?? null,
    assurance: input.assurance ?? null,
  });
  const nextSafeStep = nextSafeStepFor({
    auditEvidence: input.auditEvidence,
    dashboardSummary: input.dashboardSummary,
    reviewInbox: input.reviewInbox ?? null,
    assurance: input.assurance ?? null,
  });
  const commonBase = common({
    tenantDigestValue,
    environment: input.auditEvidence.scope.environment,
    timeWindow,
    mode,
    decisionPosture,
    reasonCodes: reasonCodesFromAudit(input.auditEvidence),
    noGoReasons: noGoReasonsFromAudit(input.auditEvidence),
    evidenceState,
    sourceDigests,
    freshnessState,
    nextSafeStep,
  });
  const reviewQueue = input.reviewInbox
    ? queueFromInbox({ inbox: input.reviewInbox, base: commonBase })
    : queueFromDashboard({ dashboardSummary: input.dashboardSummary, base: commonBase });
  const caseDigests = uniqueSorted(reviewQueue.map((item) => item.caseDigest));
  const overview: ReviewSurfaceOverview = Object.freeze({
    ...commonBase,
    area: 'overview',
    attentionCount: input.dashboardSummary.attentionItems.length,
    blockedCount: input.auditEvidence.controlSummary.blockedCount,
    reviewCount: input.auditEvidence.controlSummary.reviewLoadCount,
    staleCount: input.evidenceState?.stateCounts.stale ?? 0,
  });
  const evidenceLibrary: EvidenceArtifactIndex = Object.freeze({
    ...commonBase,
    area: 'evidence-library',
    artifactDigests: uniqueSorted(input.auditEvidence.artifactRefs.map((artifact) => artifact.digest)),
    exportDigest: input.auditEvidence.digest,
    rawMaterialBoundary: 'digest-first-review-material-only',
  });
  const actionMap: ActionSurfaceMapView = Object.freeze({
    ...commonBase,
    area: 'action-map',
    actorDigests: Object.freeze([]),
    downstreamSystemRefs: uniqueSorted(
      input.auditEvidence.surfaceSummaries.map((surface) => surface.actionSurface),
    ),
    policyRefs: Object.freeze([]),
  });
  const integrationHandoff: ShadowPilotIntegrationHandoff = Object.freeze({
    ...commonBase,
    area: 'action-map',
    handoffKind: 'shadow-pilot-to-action-surface-onboarding',
    hostedOnboardingRoute: '/api/v1/shadow/action-surface/onboarding-packet',
    hostedOnboardingMethod: 'POST',
    includeShadowEventsDefault: true,
    localIntegrationKitCommand: 'npm run render:action-surface-integration-kit',
    actionSurfaceRefs: actionMap.downstreamSystemRefs,
    actionSurfaceDigests: input.auditEvidence.scope.surfaceDigests,
    reviewCaseDigests: caseDigests,
    requiredReviewedInputs: Object.freeze([
      'reviewed-shadow-events',
      'reviewed-api-tool-workflow-or-gateway-metadata',
      'reviewed-credential-posture',
      'reviewed-downstream-system-labels',
    ]),
    expectedReviewOutputs: Object.freeze([
      'action-surface-onboarding-packet',
      'integration-kit-review-files',
      'customer-gate-wiring-packet',
      'no-bypass-probe-plan',
    ]),
    rawMetadataUploadRequired: false,
    reviewedMetadataRequired: true,
    customerReviewRequired: true,
    customerOwnedGateRequiredForEnforcement: true,
    approvalRequired: true,
    activatesEnforcement: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    nonBypassableClaimAllowed: false,
    authority: 'handoff-review-only',
    nextSafeStep:
      'Use the hosted onboarding route or local integration kit with reviewed metadata; keep shadow evidence review-only until customer gate proof exists.',
  });
  const policy: PolicyPromotionPanel = Object.freeze({
    ...commonBase,
    area: 'policy',
    candidateDigests: input.reviewInbox
      ? uniqueSorted(input.reviewInbox.items.map((item) => item.sourcePolicyCandidateDigest))
      : uniqueSorted(input.auditEvidence.artifactRefs
          .filter((artifact) => artifact.kind === 'policy-discovery-candidates')
          .map((artifact) => artifact.digest)),
    promotionBlocked:
      input.auditEvidence.controlSummary.policyGapCount > 0 ||
      input.reviewInbox?.status === 'blocked' ||
      input.reviewInbox?.approvalPacketReady === false,
    approvalRequired: true,
  });
  const assurance: AssuranceHealthPanel = Object.freeze({
    ...commonBase,
    area: 'assurance',
    degradedSignalCount: input.assurance?.summary.degradedSignalCount ?? 0,
    driftSignalCount: input.assurance?.summary.driftDetectedCount ?? 0,
    reviewLoadSignalCount: input.auditEvidence.controlSummary.reviewLoadCount,
  });
  const sourceSurfaces = uniqueSorted([
    'audit-evidence-export',
    'business-risk-dashboard',
    'dashboard-api-summary',
    input.reviewInbox ? 'review-by-exception-inbox' : null,
    input.evidenceState ? 'evidence-state-model' : null,
    input.assurance ? 'assurance-measurement-plane' : null,
  ]) as readonly AttestorReviewSurfaceSourceSurface[];
  const payload = {
    version: ATTESTOR_REVIEW_SURFACE_VERSION,
    generatedAt,
    reviewSurfaceId,
    tenantDigest: tenantDigestValue,
    environment: input.auditEvidence.scope.environment,
    timeWindow,
    mode,
    decisionPosture,
    sourceAuditExportDigest: input.auditEvidence.digest,
    sourceBusinessRiskDashboardDigest: input.businessRiskDashboard.digest,
    sourceDashboardSummaryDigest: input.dashboardSummary.digest,
    sourceReviewInboxDigest: input.reviewInbox?.digest ?? null,
    sourceEvidenceStateDigest: input.evidenceState?.digest ?? null,
    sourceAssuranceDigest: input.assurance?.digest ?? null,
    sourceDigests,
    sourceSurfaces,
    overview,
    reviewQueue,
    caseDigests,
    evidenceLibrary,
    actionMap,
    integrationHandoff,
    policy,
    assurance,
    rawPayloadStored: false,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    mutatesPolicyBundle: false,
    grantsAuthority: false,
    customerPepNoBypassProven: false,
    complianceClaimed: false,
    hostedUiImplemented: false,
    reviewMaterialOnly: true,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function findCaseQueueItem(input: CreateAttestorReviewCaseDetailInput):
ReviewQueueItem | null {
  const byQueueItem = normalizeOptionalIdentifier(input.queueItemId, 'queueItemId');
  if (byQueueItem) {
    const item = input.reviewSurface.reviewQueue.find((entry) => entry.queueItemId === byQueueItem);
    if (!item) {
      throw new Error('Attestor review surface case detail queueItemId must exist in the review queue.');
    }
    if (item.caseDigest !== input.caseDigest) {
      throw new Error('Attestor review surface case detail queueItemId must match caseDigest.');
    }
    return item;
  }
  return input.reviewSurface.reviewQueue.find((entry) =>
    entry.caseDigest === input.caseDigest
  ) ?? null;
}

function normalizeDigestRefs(
  values: readonly string[] | null | undefined,
  fieldName: string,
): readonly string[] {
  return Object.freeze(
    uniqueSorted(values ?? []).map((value) => normalizeIdentifier(value, fieldName)),
  );
}

export function createAttestorReviewCaseDetail(
  input: CreateAttestorReviewCaseDetailInput,
): ReviewCaseDetail {
  const caseDigest = normalizeIdentifier(input.caseDigest, 'caseDigest');
  if (!input.reviewSurface.caseDigests.includes(caseDigest)) {
    throw new Error('Attestor review surface case detail caseDigest must exist in reviewSurface.');
  }
  const queueItem = findCaseQueueItem(input);
  const admissionDigests = normalizeDigestRefs(input.admissionDigests, 'admissionDigests');
  const eventDigests = normalizeDigestRefs(input.eventDigests, 'eventDigests');
  const candidateDigests = normalizeDigestRefs(
    input.candidateDigests ?? input.reviewSurface.policy.candidateDigests,
    'candidateDigests',
  );
  const evidenceDigests = normalizeDigestRefs(
    input.evidenceDigests ?? input.reviewSurface.evidenceLibrary.artifactDigests,
    'evidenceDigests',
  );
  const proofLinkDigests = normalizeDigestRefs(
    input.proofLinkDigests ?? evidenceDigests,
    'proofLinkDigests',
  );
  const timelineDigests = normalizeDigestRefs(
    input.timelineDigests ?? [
      ...admissionDigests,
      ...eventDigests,
      ...candidateDigests,
      ...evidenceDigests,
      caseDigest,
    ],
    'timelineDigests',
  );
  const correlationDigests = normalizeDigestRefs([
    caseDigest,
    input.reviewSurface.digest,
    ...(queueItem ? [queueItem.caseDigest, ...queueItem.sourceDigests] : []),
    ...input.reviewSurface.sourceDigests,
    ...timelineDigests,
    ...proofLinkDigests,
  ], 'correlationDigests');

  return Object.freeze({
    ...(queueItem ?? input.reviewSurface.overview),
    area: 'cases',
    caseDigest,
    statusLabel: queueItem?.statusLabel ?? 'needs-review',
    lifecycleState: queueItem?.lifecycleState ?? 'open',
    queueItemId: queueItem?.queueItemId ?? null,
    admissionDigests,
    eventDigests,
    candidateDigests,
    evidenceDigests,
    timelineDigests,
    proofLinkDigests,
    correlationDigests,
    sourceDigests: correlationDigests,
    rawPayloadStored: false,
    rawCaseMaterialStored: false,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    canAdmit: false,
    canBlockAction: false,
  });
}

export function attestorReviewSurfaceContractDescriptor():
AttestorReviewSurfaceContractDescriptor {
  return Object.freeze({
    version: ATTESTOR_REVIEW_SURFACE_VERSION,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'attestor-review-surface',
    areas: ATTESTOR_REVIEW_SURFACE_AREAS,
    dataForms: ATTESTOR_REVIEW_SURFACE_DATA_FORMS,
    contractSlices: ATTESTOR_REVIEW_SURFACE_CONTRACT_SLICES,
    sourceSurfaces: ATTESTOR_REVIEW_SURFACE_SOURCE_SURFACES,
    freshnessStates: ATTESTOR_REVIEW_SURFACE_FRESHNESS_STATES,
    lifecycleStates: ATTESTOR_REVIEW_SURFACE_LIFECYCLE_STATES,
    statusLabels: ATTESTOR_REVIEW_SURFACE_STATUS_LABELS,
    requiredFields: ATTESTOR_REVIEW_SURFACE_REQUIRED_FIELDS,
    prohibitedRawClasses: ATTESTOR_REVIEW_SURFACE_PROHIBITED_RAW_CLASSES,
    authorityBoundary: Object.freeze({
      canBlockAction: false,
      canGrantAuthority: false,
      canReduceEvidenceRequirements: false,
      canActivateEnforcement: false,
      canMutatePolicyBundle: false,
      reviewMaterialOnly: true,
    }),
    rawPayloadStored: false,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    mutatesPolicyBundle: false,
    grantsAuthority: false,
    customerPepNoBypassProven: false,
    complianceClaimed: false,
    hostedUiImplemented: false,
    reviewMaterialOnly: true,
    limitations: Object.freeze([
      'This is a typed contract skeleton, not a hosted UI implementation.',
      'It composes review material only; it does not admit, block, enforce, deploy, issue credentials, or mutate policy.',
      'It keeps raw prompts, payloads, provider bodies, customer identifiers, secrets, payment details, wallet material, replay keys, and downstream responses outside review outputs.',
      'Production readiness, compliance, and customer PEP no-bypass remain separate proof obligations.',
    ]),
  });
}
