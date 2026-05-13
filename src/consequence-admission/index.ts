import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  RISK_CLASSES,
  RiskClass,
} from '../release-kernel/types.js';
import type {
  CryptoExecutionAdmissionOutcome,
} from '../crypto-execution-admission/index.js';
import {
  CONSEQUENCE_ADMISSION_CONTROL_REQUIREMENTS,
  CONSEQUENCE_ADMISSION_DOMAINS,
  CONSEQUENCE_ADMISSION_KNOWN_CONSEQUENCE_KINDS,
  CONSEQUENCE_ADMISSION_TAXONOMY,
  consequenceAdmissionDomainProfile,
  type ConsequenceAdmissionDomain,
  type ConsequenceAdmissionKnownConsequenceKind,
} from './taxonomy.js';
import {
  CONSEQUENCE_ADMISSION_POLICY_LIMIT_BREACH_ACTIONS,
  CONSEQUENCE_ADMISSION_POLICY_LIMIT_KINDS,
} from './policy-limits.js';
import {
  CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_FIELDS,
} from './presentation-binding.js';
import {
  CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_FAILURE_REASONS,
} from './presentation-replay-ledger.js';
import {
  CONSEQUENCE_ADMISSION_DOWNSTREAM_EXECUTION_STATUSES,
} from './downstream-execution-receipt.js';
import {
  CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_FAILURE_REASONS,
  CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_OUTCOMES,
  CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
} from './retry-attempt-ledger.js';
import {
  CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_OUTCOMES,
  CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_REASON_CODES,
  CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
} from './agent-loop-abuse-guard.js';
import {
  CONSEQUENCE_ADMISSION_ADAPTER_KINDS,
  CONSEQUENCE_ADMISSION_ADAPTER_OUTCOMES,
} from './adapter-framework.js';
import {
  CONSEQUENCE_AUDIT_EVIDENCE_ARTIFACT_KINDS,
  CONSEQUENCE_AUDIT_EVIDENCE_FINDING_KINDS,
} from './audit-evidence-export.js';
import {
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_ENTRY_KINDS,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERIFICATION_FAILURE_REASONS,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
} from './tamper-evident-history.js';
import {
  CONSEQUENCE_BUSINESS_RISK_DASHBOARD_WIDGETS,
  CONSEQUENCE_BUSINESS_RISK_SIGNALS,
} from './business-risk-dashboard.js';
import {
  CONSEQUENCE_DASHBOARD_API_SUMMARY_ATTENTION_KINDS,
  CONSEQUENCE_DASHBOARD_API_SUMMARY_LINK_KINDS,
  CONSEQUENCE_DASHBOARD_API_SUMMARY_TILE_KINDS,
} from './dashboard-api-summary.js';
import {
  CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_KINDS,
  CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_STATUSES,
  CONSEQUENCE_EXTERNAL_REVIEW_FINDING_KINDS,
  CONSEQUENCE_EXTERNAL_REVIEW_FOCUS_AREAS,
} from './external-review-packet.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES,
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
  CONSEQUENCE_DATA_MINIMIZATION_SURFACE_KINDS,
} from './data-minimization-redaction-policy.js';
import {
  CONSEQUENCE_ADMISSION_PACK_DECISION_POSTURES,
  CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION,
  CONSEQUENCE_ADMISSION_PACK_DECISION_RECOMMENDED_ACTIONS,
  CONSEQUENCE_ADMISSION_PACK_DECISION_SIGNAL_KINDS,
} from './pack-decision-profile.js';

export const CONSEQUENCE_ADMISSION_CONTRACT_VERSION =
  'attestor.consequence-admission.v1';

export const CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_VERSION =
  'attestor.consequence-admission-retry-attempt.v1';

export const CONSEQUENCE_ADMISSION_RETRY_RULE_VERSION =
  'attestor.consequence-admission-retry-rules.v1';

export const CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_VERSION =
  'attestor.consequence-admission-correction-catalog.v1';

export const CONSEQUENCE_ADMISSION_RETRY_DEFAULT_MAX_ATTEMPTS = 2;
export const CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS = 300;

export const CONSEQUENCE_ADMISSION_DECISIONS = [
  'admit',
  'narrow',
  'review',
  'block',
] as const;
export type ConsequenceAdmissionDecision =
  typeof CONSEQUENCE_ADMISSION_DECISIONS[number];

export const GENERIC_ADMISSION_MODES = [
  'observe',
  'warn',
  'review',
  'enforce',
] as const;
export type GenericAdmissionMode =
  typeof GENERIC_ADMISSION_MODES[number];

export const GENERIC_ADMISSION_SHADOW_DECISIONS = [
  'would_admit',
  'would_narrow',
  'would_review',
  'would_block',
] as const;
export type GenericAdmissionShadowDecision =
  typeof GENERIC_ADMISSION_SHADOW_DECISIONS[number];

export const GENERIC_ADMISSION_DOWNSTREAM_POSTURES = [
  'observe-only',
  'warn-only',
  'hold-for-review',
  'enforce-decision',
] as const;
export type GenericAdmissionDownstreamPosture =
  typeof GENERIC_ADMISSION_DOWNSTREAM_POSTURES[number];

export const CONSEQUENCE_ADMISSION_FEEDBACK_DISCLOSURE_LEVELS = [
  'minimal',
  'actionable',
  'diagnostic',
] as const;
export type ConsequenceAdmissionFeedbackDisclosureLevel =
  typeof CONSEQUENCE_ADMISSION_FEEDBACK_DISCLOSURE_LEVELS[number];

export const CONSEQUENCE_ADMISSION_CORRECTION_AUDIENCES = [
  'model',
  'customer-review',
  'operator-control',
] as const;
export type ConsequenceAdmissionCorrectionAudience =
  typeof CONSEQUENCE_ADMISSION_CORRECTION_AUDIENCES[number];

export const CONSEQUENCE_ADMISSION_RETRY_BINDING_FIELDS = [
  'previousAdmissionId',
  'previousAdmissionDigest',
  'previousRequestId',
  'attemptNumber',
  'correctionReasonCodes',
] as const;
export type ConsequenceAdmissionRetryBindingField =
  typeof CONSEQUENCE_ADMISSION_RETRY_BINDING_FIELDS[number];

export const CONSEQUENCE_ADMISSION_RETRY_BUDGET_OUTCOMES = [
  'allow-retry',
  'hold-for-review',
] as const;
export type ConsequenceAdmissionRetryBudgetOutcome =
  typeof CONSEQUENCE_ADMISSION_RETRY_BUDGET_OUTCOMES[number];

export const CONSEQUENCE_ADMISSION_PACK_FAMILIES = [
  'finance',
  'crypto',
  'general',
  'future',
] as const;
export type ConsequenceAdmissionPackFamily =
  typeof CONSEQUENCE_ADMISSION_PACK_FAMILIES[number];

export const CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS = [
  'hosted-route',
  'package-boundary',
  'local-command',
  'internal-service',
] as const;
export type ConsequenceAdmissionEntryPointKind =
  typeof CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS[number];

export const CONSEQUENCE_ADMISSION_CHECK_KINDS = [
  'policy',
  'authority',
  'evidence',
  'freshness',
  'enforcement',
  'adapter-readiness',
] as const;
export type ConsequenceAdmissionCheckKind =
  typeof CONSEQUENCE_ADMISSION_CHECK_KINDS[number];

export const CONSEQUENCE_ADMISSION_CHECK_OUTCOMES = [
  'pass',
  'warn',
  'fail',
  'not-applicable',
] as const;
export type ConsequenceAdmissionCheckOutcome =
  typeof CONSEQUENCE_ADMISSION_CHECK_OUTCOMES[number];

export const CONSEQUENCE_ADMISSION_NATIVE_SURFACES = [
  'finance-pipeline',
  'crypto-execution-admission',
  'proof-surface',
  'release-layer',
  'custom',
] as const;
export type ConsequenceAdmissionNativeSurface =
  typeof CONSEQUENCE_ADMISSION_NATIVE_SURFACES[number];

export const CONSEQUENCE_ADMISSION_PROOF_KINDS = [
  'release-token',
  'release-evidence-pack',
  'certificate',
  'verification-kit',
  'admission-plan',
  'admission-receipt',
  'conformance-fixture',
  'local-artifact',
  'source-module',
  'external-reference',
] as const;
export type ConsequenceAdmissionProofKind =
  typeof CONSEQUENCE_ADMISSION_PROOF_KINDS[number];

export type ConsequenceAdmissionConsequenceKind =
  ConsequenceAdmissionKnownConsequenceKind;

export const CONSEQUENCE_ADMISSION_CONSEQUENCE_KINDS =
  CONSEQUENCE_ADMISSION_KNOWN_CONSEQUENCE_KINDS;

const CONSEQUENCE_ADMISSION_RISK_CLASSES = Object.freeze([
  ...RISK_CLASSES,
  'custom',
] as const);

export interface ConsequenceAdmissionEntryPoint {
  readonly kind: ConsequenceAdmissionEntryPointKind;
  readonly id: string;
  readonly route: string | null;
  readonly packageSubpath: string | null;
  readonly sourceRef: string | null;
}

export interface ConsequenceAdmissionProposedConsequence {
  readonly actor: string;
  readonly action: string;
  readonly downstreamSystem: string;
  readonly consequenceKind: ConsequenceAdmissionConsequenceKind;
  readonly riskClass: RiskClass | 'custom';
  readonly summary: string;
}

export interface ConsequenceAdmissionPolicyScope {
  readonly policyRef: string | null;
  readonly tenantId: string | null;
  readonly environment: string | null;
  readonly dimensions: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ConsequenceAdmissionAuthority {
  readonly actorRef: string | null;
  readonly reviewerRef: string | null;
  readonly signerRef: string | null;
  readonly delegationRef: string | null;
  readonly authorityMode: string | null;
}

export interface ConsequenceAdmissionEvidenceRef {
  readonly id: string;
  readonly kind: string;
  readonly digest: string | null;
  readonly uri: string | null;
}

export interface ConsequenceAdmissionRetryAttemptBinding {
  readonly version: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_VERSION;
  readonly attemptId: string;
  readonly previousAdmissionId: string;
  readonly previousAdmissionDigest: string;
  readonly previousRequestId: string;
  readonly attemptNumber: number;
  readonly attemptedAt: string;
  readonly correctionReasonCodes: readonly string[];
  readonly correctionFields: readonly string[];
  readonly idempotencyKey: string | null;
}

export interface ConsequenceAdmissionRequest {
  readonly version: typeof CONSEQUENCE_ADMISSION_CONTRACT_VERSION;
  readonly requestId: string;
  readonly requestedAt: string;
  readonly packFamily: ConsequenceAdmissionPackFamily;
  readonly entryPoint: ConsequenceAdmissionEntryPoint;
  readonly proposedConsequence: ConsequenceAdmissionProposedConsequence;
  readonly policyScope: ConsequenceAdmissionPolicyScope;
  readonly authority: ConsequenceAdmissionAuthority;
  readonly evidence: readonly ConsequenceAdmissionEvidenceRef[];
  readonly nativeInputRefs: readonly string[];
  readonly retryAttempt: ConsequenceAdmissionRetryAttemptBinding | null;
}

export interface ConsequenceAdmissionCheck {
  readonly kind: ConsequenceAdmissionCheckKind;
  readonly label: string;
  readonly outcome: ConsequenceAdmissionCheckOutcome;
  readonly required: boolean;
  readonly summary: string;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface ConsequenceAdmissionNativeDecision {
  readonly surface: ConsequenceAdmissionNativeSurface;
  readonly value: string;
  readonly mappedDecision: ConsequenceAdmissionDecision;
  readonly mappingReason: string;
}

export interface ConsequenceAdmissionConstraint {
  readonly id: string;
  readonly summary: string;
  readonly enforcedBy: string;
}

export interface ConsequenceAdmissionProofRef {
  readonly kind: ConsequenceAdmissionProofKind;
  readonly id: string;
  readonly digest: string | null;
  readonly uri: string | null;
  readonly verifyHint: string;
}

export interface ConsequenceAdmissionFeedback {
  readonly disclosureLevel: ConsequenceAdmissionFeedbackDisclosureLevel;
  readonly safeForModel: true;
  readonly reasonCodes: readonly string[];
  readonly missingFields: readonly string[];
  readonly requiredEvidenceKinds: readonly string[];
  readonly operatorOnlyReasonCodes: readonly string[];
  readonly safeInstruction: string;
}

export interface ConsequenceAdmissionCorrectionCatalogEntry {
  readonly reasonCode: string;
  readonly audience: ConsequenceAdmissionCorrectionAudience;
  readonly disclosureLevel: ConsequenceAdmissionFeedbackDisclosureLevel;
  readonly missingFields: readonly string[];
  readonly requiredEvidenceKinds: readonly string[];
  readonly retryableByModel: boolean;
  readonly operatorOnly: boolean;
  readonly safeSummary: string;
}

export interface ConsequenceAdmissionCorrectionCatalog {
  readonly version: typeof CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_VERSION;
  readonly entries: readonly ConsequenceAdmissionCorrectionCatalogEntry[];
  readonly reasonCodes: readonly string[];
  readonly modelRetryableReasonCodes: readonly string[];
  readonly operatorOnlyReasonCodes: readonly string[];
}

export interface ConsequenceAdmissionRetryGuidance {
  readonly retryAllowed: boolean;
  readonly retryCategory:
    | 'not-needed'
    | 'safe-correction'
    | 'human-review-required'
    | 'not-retryable';
  readonly maxAttempts: number;
  readonly retryWindowSeconds: number | null;
  readonly nextAllowedMode: GenericAdmissionMode | null;
  readonly requiresChangedRequest: boolean;
  readonly sameRequestReplayAllowed: false;
  readonly retryBindingRequired: boolean;
  readonly retryBindingFields: readonly ConsequenceAdmissionRetryBindingField[];
  readonly nonRetryableReasonCodes: readonly string[];
}

export interface ConsequenceAdmissionRetryBudgetEvaluation {
  readonly version: typeof CONSEQUENCE_ADMISSION_RETRY_RULE_VERSION;
  readonly outcome: ConsequenceAdmissionRetryBudgetOutcome;
  readonly retryAllowed: boolean;
  readonly failClosed: boolean;
  readonly previousAdmissionId: string;
  readonly previousAdmissionDigest: string;
  readonly retryAttemptId: string;
  readonly attemptNumber: number;
  readonly maxAttempts: number;
  readonly attemptsRemaining: number;
  readonly retryWindowSeconds: number;
  readonly windowStartedAt: string;
  readonly windowExpiresAt: string;
  readonly evaluatedAt: string;
  readonly reasonCodes: readonly string[];
  readonly safeInstruction: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceAdmissionResponse {
  readonly version: typeof CONSEQUENCE_ADMISSION_CONTRACT_VERSION;
  readonly admissionId: string;
  readonly decidedAt: string;
  readonly request: ConsequenceAdmissionRequest;
  readonly decision: ConsequenceAdmissionDecision;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly reason: string;
  readonly reasonCodes: readonly string[];
  readonly checks: readonly ConsequenceAdmissionCheck[];
  readonly constraints: readonly ConsequenceAdmissionConstraint[];
  readonly nativeDecision: ConsequenceAdmissionNativeDecision | null;
  readonly proof: readonly ConsequenceAdmissionProofRef[];
  readonly feedback: ConsequenceAdmissionFeedback;
  readonly retry: ConsequenceAdmissionRetryGuidance;
  readonly operationalContext: Readonly<Record<string, string | number | boolean | null>>;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceAdmissionProblem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string | null;
  readonly decision: 'block';
  readonly failClosed: true;
  readonly reasonCodes: readonly string[];
}

export interface ConsequenceAdmissionDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_CONTRACT_VERSION;
  readonly retryAttemptVersion: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_VERSION;
  readonly retryRuleVersion: typeof CONSEQUENCE_ADMISSION_RETRY_RULE_VERSION;
  readonly retryAttemptLedgerVersion: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION;
  readonly agentLoopAbuseGuardVersion: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION;
  readonly correctionCatalogVersion: typeof CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_VERSION;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly packDecisionProfileVersion: typeof CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION;
  readonly retryDefaultMaxAttempts: typeof CONSEQUENCE_ADMISSION_RETRY_DEFAULT_MAX_ATTEMPTS;
  readonly retryDefaultWindowSeconds: typeof CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS;
  readonly decisions: typeof CONSEQUENCE_ADMISSION_DECISIONS;
  readonly genericAdmissionModes: typeof GENERIC_ADMISSION_MODES;
  readonly genericAdmissionShadowDecisions: typeof GENERIC_ADMISSION_SHADOW_DECISIONS;
  readonly genericAdmissionDownstreamPostures: typeof GENERIC_ADMISSION_DOWNSTREAM_POSTURES;
  readonly packFamilies: typeof CONSEQUENCE_ADMISSION_PACK_FAMILIES;
  readonly consequenceKinds: typeof CONSEQUENCE_ADMISSION_CONSEQUENCE_KINDS;
  readonly riskClasses: typeof CONSEQUENCE_ADMISSION_RISK_CLASSES;
  readonly entryPointKinds: typeof CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS;
  readonly checkKinds: typeof CONSEQUENCE_ADMISSION_CHECK_KINDS;
  readonly checkOutcomes: typeof CONSEQUENCE_ADMISSION_CHECK_OUTCOMES;
  readonly feedbackDisclosureLevels: typeof CONSEQUENCE_ADMISSION_FEEDBACK_DISCLOSURE_LEVELS;
  readonly correctionAudiences: typeof CONSEQUENCE_ADMISSION_CORRECTION_AUDIENCES;
  readonly correctionReasonCodes: readonly string[];
  readonly dataMinimizationSurfaceKinds: typeof CONSEQUENCE_DATA_MINIMIZATION_SURFACE_KINDS;
  readonly dataMinimizationForbiddenRawClasses: typeof CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES;
  readonly packDecisionPostures: typeof CONSEQUENCE_ADMISSION_PACK_DECISION_POSTURES;
  readonly packDecisionRecommendedActions: typeof CONSEQUENCE_ADMISSION_PACK_DECISION_RECOMMENDED_ACTIONS;
  readonly packDecisionSignalKinds: typeof CONSEQUENCE_ADMISSION_PACK_DECISION_SIGNAL_KINDS;
  readonly retryBindingFields: typeof CONSEQUENCE_ADMISSION_RETRY_BINDING_FIELDS;
  readonly retryBudgetOutcomes: typeof CONSEQUENCE_ADMISSION_RETRY_BUDGET_OUTCOMES;
  readonly retryAttemptLedgerOutcomes: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_OUTCOMES;
  readonly retryAttemptLedgerFailureReasons: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_FAILURE_REASONS;
  readonly agentLoopAbuseGuardOutcomes: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_OUTCOMES;
  readonly agentLoopAbuseGuardReasonCodes: typeof CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_REASON_CODES;
  readonly adapterKinds: typeof CONSEQUENCE_ADMISSION_ADAPTER_KINDS;
  readonly adapterOutcomes: typeof CONSEQUENCE_ADMISSION_ADAPTER_OUTCOMES;
  readonly auditEvidenceArtifactKinds: typeof CONSEQUENCE_AUDIT_EVIDENCE_ARTIFACT_KINDS;
  readonly auditEvidenceFindingKinds: typeof CONSEQUENCE_AUDIT_EVIDENCE_FINDING_KINDS;
  readonly tamperEvidentHistoryVersion: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION;
  readonly tamperEvidentHistoryEntryKinds:
    typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_ENTRY_KINDS;
  readonly tamperEvidentHistoryVerificationFailureReasons:
    typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERIFICATION_FAILURE_REASONS;
  readonly businessRiskDashboardWidgets: typeof CONSEQUENCE_BUSINESS_RISK_DASHBOARD_WIDGETS;
  readonly businessRiskSignals: typeof CONSEQUENCE_BUSINESS_RISK_SIGNALS;
  readonly dashboardApiSummaryTileKinds: typeof CONSEQUENCE_DASHBOARD_API_SUMMARY_TILE_KINDS;
  readonly dashboardApiSummaryAttentionKinds: typeof CONSEQUENCE_DASHBOARD_API_SUMMARY_ATTENTION_KINDS;
  readonly dashboardApiSummaryLinkKinds: typeof CONSEQUENCE_DASHBOARD_API_SUMMARY_LINK_KINDS;
  readonly externalReviewFocusAreas: typeof CONSEQUENCE_EXTERNAL_REVIEW_FOCUS_AREAS;
  readonly externalReviewEvidenceKinds: typeof CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_KINDS;
  readonly externalReviewEvidenceStatuses: typeof CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_STATUSES;
  readonly externalReviewFindingKinds: typeof CONSEQUENCE_EXTERNAL_REVIEW_FINDING_KINDS;
  readonly proofKinds: typeof CONSEQUENCE_ADMISSION_PROOF_KINDS;
  readonly nativeSurfaces: typeof CONSEQUENCE_ADMISSION_NATIVE_SURFACES;
  readonly consequenceDomains: typeof CONSEQUENCE_ADMISSION_DOMAINS;
  readonly controlRequirements: typeof CONSEQUENCE_ADMISSION_CONTROL_REQUIREMENTS;
  readonly taxonomy: typeof CONSEQUENCE_ADMISSION_TAXONOMY;
  readonly policyLimitKinds: typeof CONSEQUENCE_ADMISSION_POLICY_LIMIT_KINDS;
  readonly policyLimitBreachActions: typeof CONSEQUENCE_ADMISSION_POLICY_LIMIT_BREACH_ACTIONS;
  readonly presentationBindingFields: typeof CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_FIELDS;
  readonly presentationReplayLedgerFailureReasons: typeof CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_FAILURE_REASONS;
  readonly downstreamExecutionStatuses: typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_EXECUTION_STATUSES;
}

export interface EvaluateConsequenceAdmissionRetryBudgetInput {
  readonly previousAdmission: ConsequenceAdmissionResponse;
  readonly retryAttempt: ConsequenceAdmissionRetryAttemptBinding;
  readonly evaluatedAt?: string | null;
  readonly maxAttempts?: number | null;
  readonly retryWindowSeconds?: number | null;
}

export interface CreateConsequenceAdmissionRetryAttemptBindingInput {
  readonly attemptId?: string | null;
  readonly previousAdmissionId: string;
  readonly previousAdmissionDigest: string;
  readonly previousRequestId: string;
  readonly attemptNumber: number;
  readonly attemptedAt: string;
  readonly correctionReasonCodes?: readonly string[];
  readonly correctionFields?: readonly string[];
  readonly idempotencyKey?: string | null;
}

export interface CreateConsequenceAdmissionRequestInput {
  readonly requestedAt: string;
  readonly requestId?: string | null;
  readonly packFamily: ConsequenceAdmissionPackFamily;
  readonly entryPoint: ConsequenceAdmissionEntryPoint;
  readonly proposedConsequence: ConsequenceAdmissionProposedConsequence;
  readonly policyScope?: Partial<ConsequenceAdmissionPolicyScope> | null;
  readonly authority?: Partial<ConsequenceAdmissionAuthority> | null;
  readonly evidence?: readonly ConsequenceAdmissionEvidenceRef[];
  readonly nativeInputRefs?: readonly string[];
  readonly retryAttempt?: CreateConsequenceAdmissionRetryAttemptBindingInput | ConsequenceAdmissionRetryAttemptBinding | null;
}

export interface CreateConsequenceAdmissionResponseInput {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly decision: ConsequenceAdmissionDecision;
  readonly reason: string;
  readonly reasonCodes?: readonly string[];
  readonly checks?: readonly ConsequenceAdmissionCheck[];
  readonly constraints?: readonly ConsequenceAdmissionConstraint[];
  readonly nativeDecision?: ConsequenceAdmissionNativeDecision | null;
  readonly proof?: readonly ConsequenceAdmissionProofRef[];
  readonly operationalContext?: Readonly<Record<string, string | number | boolean | null>>;
  readonly failClosed?: boolean | null;
}

export type GenericAdmissionFeatureValue = string | number | boolean | null;

export interface GenericAdmissionAmount {
  readonly value: string | number;
  readonly currency: string | null;
  readonly asset: string | null;
  readonly chain: string | null;
}

export interface GenericAdmissionDataScope {
  readonly records: number | null;
  readonly classification: string | null;
  readonly fields: readonly string[];
}

export interface CreateGenericAdmissionInput {
  readonly mode: GenericAdmissionMode;
  readonly actor: string;
  readonly action: string;
  readonly domain: ConsequenceAdmissionDomain;
  readonly downstreamSystem: string;
  readonly requestedAt?: string | null;
  readonly decidedAt?: string | null;
  readonly requestId?: string | null;
  readonly tenantId?: string | null;
  readonly environment?: string | null;
  readonly policyRef?: string | null;
  readonly actorRef?: string | null;
  readonly reviewerRef?: string | null;
  readonly signerRef?: string | null;
  readonly delegationRef?: string | null;
  readonly authorityMode?: string | null;
  readonly amount?: GenericAdmissionAmount | null;
  readonly recipient?: string | null;
  readonly dataScope?: GenericAdmissionDataScope | null;
  readonly evidenceRefs?: readonly string[];
  readonly nativeInputRefs?: readonly string[];
  readonly observedFeatures?: Readonly<Record<string, GenericAdmissionFeatureValue>>;
  readonly retryAttempt?: ConsequenceAdmissionRetryAttemptBinding | null;
  readonly summary?: string | null;
}

export interface GenericAdmissionModeEvaluation {
  readonly mode: GenericAdmissionMode;
  readonly shadowDecision: GenericAdmissionShadowDecision;
  readonly effectiveDecision: ConsequenceAdmissionDecision;
  readonly downstreamPosture: GenericAdmissionDownstreamPosture;
  readonly enforcementActive: boolean;
  readonly reasonCodes: readonly string[];
}

export interface GenericAdmissionEnvelope {
  readonly mode: GenericAdmissionMode;
  readonly shadowDecision: GenericAdmissionShadowDecision;
  readonly downstreamPosture: GenericAdmissionDownstreamPosture;
  readonly enforcementActive: boolean;
  readonly admission: ConsequenceAdmissionResponse;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission ${fieldName} requires a non-empty string value.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Consequence admission ${fieldName} requires a non-empty value.`);
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

function normalizeEnumValue<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName: string,
): T {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!allowedValues.includes(normalized as T)) {
    throw new Error(
      `Consequence admission ${fieldName} must be one of: ${allowedValues.join(', ')}.`,
    );
  }
  return normalized as T;
}

function normalizeEvidenceRef(
  input: ConsequenceAdmissionEvidenceRef,
): ConsequenceAdmissionEvidenceRef {
  return Object.freeze({
    id: normalizeIdentifier(input.id, 'evidence.id'),
    kind: normalizeIdentifier(input.kind, 'evidence.kind'),
    digest: normalizeOptionalIdentifier(input.digest, 'evidence.digest'),
    uri: normalizeOptionalIdentifier(input.uri, 'evidence.uri'),
  });
}

function normalizeProofRef(input: ConsequenceAdmissionProofRef): ConsequenceAdmissionProofRef {
  return Object.freeze({
    kind: normalizeEnumValue(input.kind, CONSEQUENCE_ADMISSION_PROOF_KINDS, 'proof.kind'),
    id: normalizeIdentifier(input.id, 'proof.id'),
    digest: normalizeOptionalIdentifier(input.digest, 'proof.digest'),
    uri: normalizeOptionalIdentifier(input.uri, 'proof.uri'),
    verifyHint: normalizeIdentifier(input.verifyHint, 'proof.verifyHint'),
  });
}

function normalizeNativeDecision(
  input: ConsequenceAdmissionNativeDecision | null | undefined,
): ConsequenceAdmissionNativeDecision | null {
  if (!input) return null;
  return Object.freeze({
    surface: normalizeEnumValue(
      input.surface,
      CONSEQUENCE_ADMISSION_NATIVE_SURFACES,
      'nativeDecision.surface',
    ),
    value: normalizeIdentifier(input.value, 'nativeDecision.value'),
    mappedDecision: normalizeEnumValue(
      input.mappedDecision,
      CONSEQUENCE_ADMISSION_DECISIONS,
      'nativeDecision.mappedDecision',
    ),
    mappingReason: normalizeIdentifier(input.mappingReason, 'nativeDecision.mappingReason'),
  });
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Consequence admission ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function requestIdFor(input: Omit<ConsequenceAdmissionRequest, 'requestId'>): string {
  return canonicalObject({
    version: input.version,
    requestedAt: input.requestedAt,
    packFamily: input.packFamily,
    entryPoint: input.entryPoint,
    proposedConsequence: input.proposedConsequence,
    policyScope: input.policyScope,
    authority: input.authority,
    evidence: input.evidence,
    nativeInputRefs: input.nativeInputRefs,
  } as unknown as CanonicalReleaseJsonValue).digest;
}

function admissionIdFor(input: {
  readonly decidedAt: string;
  readonly requestId: string;
  readonly decision: ConsequenceAdmissionDecision;
  readonly reasonCodes: readonly string[];
  readonly proofDigests: readonly string[];
}): string {
  return canonicalObject({
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    decidedAt: input.decidedAt,
    requestId: input.requestId,
    decision: input.decision,
    reasonCodes: input.reasonCodes,
    proofDigests: input.proofDigests,
  }).digest;
}

function readonlyCopy<T>(items: readonly T[] | null | undefined): readonly T[] {
  return Object.freeze([...(items ?? [])]);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(
  record: Readonly<Record<string, unknown>>,
  fieldName: string,
): string {
  const value = record[fieldName];
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission ${fieldName} requires a non-empty string value.`);
  }
  return normalizeIdentifier(value, fieldName);
}

function readOptionalString(
  record: Readonly<Record<string, unknown>>,
  fieldName: string,
): string | null {
  const value = record[fieldName];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission ${fieldName} must be a string when provided.`);
  }
  return normalizeOptionalIdentifier(value, fieldName);
}

function readOptionalTimestamp(
  record: Readonly<Record<string, unknown>>,
  fieldName: string,
): string | null {
  const value = readOptionalString(record, fieldName);
  return value === null ? null : normalizeIsoTimestamp(value, fieldName);
}

function normalizePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`Consequence admission ${fieldName} must be a positive integer.`);
  }
  return value;
}

function normalizeStringArray(value: unknown, fieldName: string): readonly string[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error(`Consequence admission ${fieldName} must be an array when provided.`);
  }
  return Object.freeze(
    value.map((entry, index) => {
      if (typeof entry !== 'string') {
        throw new Error(
          `Consequence admission ${fieldName}[${index}] must be a string.`,
        );
      }
      return normalizeIdentifier(entry, `${fieldName}[${index}]`);
    }),
  );
}

function normalizeGenericAmount(value: unknown): GenericAdmissionAmount | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error('Consequence admission amount must be an object when provided.');
  }
  const rawAmount = value.value;
  if (typeof rawAmount !== 'string' && typeof rawAmount !== 'number') {
    throw new Error('Consequence admission amount.value must be a string or number.');
  }
  if (typeof rawAmount === 'number' && !Number.isFinite(rawAmount)) {
    throw new Error('Consequence admission amount.value must be finite.');
  }
  const amountValue =
    typeof rawAmount === 'string'
      ? normalizeIdentifier(rawAmount, 'amount.value')
      : rawAmount;

  return Object.freeze({
    value: amountValue,
    currency: readOptionalString(value, 'currency'),
    asset: readOptionalString(value, 'asset'),
    chain: readOptionalString(value, 'chain'),
  });
}

function normalizeGenericDataScope(value: unknown): GenericAdmissionDataScope | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error('Consequence admission dataScope must be an object when provided.');
  }
  const rawRecords = value.records;
  if (
    rawRecords !== undefined &&
    rawRecords !== null &&
    (typeof rawRecords !== 'number' || !Number.isFinite(rawRecords) || rawRecords < 0)
  ) {
    throw new Error('Consequence admission dataScope.records must be a non-negative number.');
  }
  return Object.freeze({
    records: typeof rawRecords === 'number' ? rawRecords : null,
    classification: readOptionalString(value, 'classification'),
    fields: normalizeStringArray(value.fields, 'dataScope.fields'),
  });
}

function normalizeGenericObservedFeatures(
  value: unknown,
): Readonly<Record<string, GenericAdmissionFeatureValue>> {
  if (value === undefined || value === null) return Object.freeze({});
  if (!isRecord(value)) {
    throw new Error('Consequence admission observedFeatures must be an object when provided.');
  }
  const normalized: Record<string, GenericAdmissionFeatureValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = normalizeIdentifier(key, 'observedFeatures key');
    if (
      entry !== null &&
      typeof entry !== 'string' &&
      typeof entry !== 'number' &&
      typeof entry !== 'boolean'
    ) {
      throw new Error(
        `Consequence admission observedFeatures.${normalizedKey} must be scalar or null.`,
      );
    }
    if (typeof entry === 'number' && !Number.isFinite(entry)) {
      throw new Error(
        `Consequence admission observedFeatures.${normalizedKey} must be finite.`,
      );
    }
    normalized[normalizedKey] = entry;
  }
  return Object.freeze(normalized);
}

function retryAttemptIdFor(
  input: Omit<ConsequenceAdmissionRetryAttemptBinding, 'attemptId'>,
): string {
  return `retry-attempt:${canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest}`;
}

function normalizeRetryAttemptBinding(
  value: unknown,
): ConsequenceAdmissionRetryAttemptBinding | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error('Consequence admission retryAttempt must be an object when provided.');
  }

  const base = Object.freeze({
    version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_VERSION,
    previousAdmissionId: normalizeIdentifier(
      value.previousAdmissionId as string | null | undefined,
      'retryAttempt.previousAdmissionId',
    ),
    previousAdmissionDigest: normalizeIdentifier(
      value.previousAdmissionDigest as string | null | undefined,
      'retryAttempt.previousAdmissionDigest',
    ),
    previousRequestId: normalizeIdentifier(
      value.previousRequestId as string | null | undefined,
      'retryAttempt.previousRequestId',
    ),
    attemptNumber: normalizePositiveInteger(value.attemptNumber, 'retryAttempt.attemptNumber'),
    attemptedAt: normalizeIsoTimestamp(
      normalizeIdentifier(value.attemptedAt as string | null | undefined, 'retryAttempt.attemptedAt'),
      'retryAttempt.attemptedAt',
    ),
    correctionReasonCodes: uniqueSortedStrings(
      normalizeStringArray(value.correctionReasonCodes, 'retryAttempt.correctionReasonCodes'),
    ),
    correctionFields: uniqueSortedStrings(
      normalizeStringArray(value.correctionFields, 'retryAttempt.correctionFields'),
    ),
    idempotencyKey: normalizeOptionalIdentifier(
      value.idempotencyKey as string | null | undefined,
      'retryAttempt.idempotencyKey',
    ),
  } satisfies Omit<ConsequenceAdmissionRetryAttemptBinding, 'attemptId'>);
  const expectedAttemptId = retryAttemptIdFor(base);
  const suppliedAttemptId = normalizeOptionalIdentifier(
    value.attemptId as string | null | undefined,
    'retryAttempt.attemptId',
  );

  if (suppliedAttemptId !== null && suppliedAttemptId !== expectedAttemptId) {
    throw new Error('Consequence admission retryAttempt.attemptId does not match the binding.');
  }

  return Object.freeze({
    ...base,
    attemptId: expectedAttemptId,
  });
}

export function createConsequenceAdmissionRetryAttemptBinding(
  input: CreateConsequenceAdmissionRetryAttemptBindingInput | ConsequenceAdmissionRetryAttemptBinding,
): ConsequenceAdmissionRetryAttemptBinding {
  const binding = normalizeRetryAttemptBinding(input);
  if (binding === null) {
    throw new Error('Consequence admission retry attempt binding requires an input object.');
  }
  return binding;
}

function normalizeCreateGenericAdmissionInput(input: unknown): CreateGenericAdmissionInput {
  if (!isRecord(input)) {
    throw new Error('Consequence admission input must be a JSON object.');
  }
  const mode = normalizeEnumValue(
    readRequiredString(input, 'mode'),
    GENERIC_ADMISSION_MODES,
    'mode',
  );
  const domain = normalizeEnumValue(
    readRequiredString(input, 'domain'),
    CONSEQUENCE_ADMISSION_DOMAINS,
    'domain',
  );

  return Object.freeze({
    mode,
    actor: readRequiredString(input, 'actor'),
    action: readRequiredString(input, 'action'),
    domain,
    downstreamSystem: readRequiredString(input, 'downstreamSystem'),
    requestedAt: readOptionalTimestamp(input, 'requestedAt'),
    decidedAt: readOptionalTimestamp(input, 'decidedAt'),
    requestId: readOptionalString(input, 'requestId'),
    tenantId: readOptionalString(input, 'tenantId'),
    environment: readOptionalString(input, 'environment'),
    policyRef: readOptionalString(input, 'policyRef'),
    actorRef: readOptionalString(input, 'actorRef'),
    reviewerRef: readOptionalString(input, 'reviewerRef'),
    signerRef: readOptionalString(input, 'signerRef'),
    delegationRef: readOptionalString(input, 'delegationRef'),
    authorityMode: readOptionalString(input, 'authorityMode'),
    amount: normalizeGenericAmount(input.amount),
    recipient: readOptionalString(input, 'recipient'),
    dataScope: normalizeGenericDataScope(input.dataScope),
    evidenceRefs: normalizeStringArray(input.evidenceRefs, 'evidenceRefs'),
    nativeInputRefs: normalizeStringArray(input.nativeInputRefs, 'nativeInputRefs'),
    observedFeatures: normalizeGenericObservedFeatures(input.observedFeatures),
    retryAttempt: normalizeRetryAttemptBinding(input.retryAttempt),
    summary: readOptionalString(input, 'summary'),
  });
}

function observedFeatureTrue(
  input: CreateGenericAdmissionInput,
  key: string,
): boolean {
  return input.observedFeatures?.[key] === true;
}

function genericAdmissionReviewReasons(
  input: CreateGenericAdmissionInput,
): readonly string[] {
  const reasons: string[] = [];
  const profile = consequenceAdmissionDomainProfile(input.domain);

  if (!input.policyRef) reasons.push('policy-ref-missing');
  if ((input.evidenceRefs ?? []).length === 0) reasons.push('evidence-ref-missing');

  if (
    input.domain === 'money-movement' ||
    input.domain === 'programmable-money'
  ) {
    if (!input.amount) reasons.push('amount-scope-missing');
    if (!input.recipient) reasons.push('recipient-scope-missing');
  }

  if (input.domain === 'data-disclosure' && !input.dataScope) {
    reasons.push('data-scope-missing');
  }

  if (input.domain === 'authority-change' && !input.authorityMode) {
    reasons.push('authority-mode-missing');
  }

  if (
    profile.requiredChecks.includes('adapter-readiness') &&
    !observedFeatureTrue(input, 'adapterReady')
  ) {
    reasons.push('adapter-readiness-missing');
  }

  if (input.domain === 'custom') {
    reasons.push('custom-domain-review-required');
  }

  return Object.freeze(reasons);
}

function genericAdmissionShadowDecisionFor(
  input: CreateGenericAdmissionInput,
  reviewReasons: readonly string[],
): GenericAdmissionShadowDecision {
  if (
    observedFeatureTrue(input, 'policyBlocked') ||
    observedFeatureTrue(input, 'blocked') ||
    observedFeatureTrue(input, 'unsafe')
  ) {
    return 'would_block';
  }
  if (reviewReasons.length > 0) return 'would_review';
  if (observedFeatureTrue(input, 'narrowRequired')) return 'would_narrow';
  return 'would_admit';
}

function effectiveDecisionForGenericMode(
  mode: GenericAdmissionMode,
  shadowDecision: GenericAdmissionShadowDecision,
): ConsequenceAdmissionDecision {
  if (mode === 'observe' || mode === 'warn') return 'admit';
  if (mode === 'review') {
    return shadowDecision === 'would_admit' ? 'admit' : 'review';
  }
  if (shadowDecision === 'would_block') return 'block';
  if (shadowDecision === 'would_review') return 'review';
  if (shadowDecision === 'would_narrow') return 'narrow';
  return 'admit';
}

function downstreamPostureForGenericMode(
  mode: GenericAdmissionMode,
  effectiveDecision: ConsequenceAdmissionDecision,
): GenericAdmissionDownstreamPosture {
  if (mode === 'observe') return 'observe-only';
  if (mode === 'warn') return 'warn-only';
  if (effectiveDecision === 'review') return 'hold-for-review';
  return 'enforce-decision';
}

function genericReasonCodes(
  input: CreateGenericAdmissionInput,
  shadowDecision: GenericAdmissionShadowDecision,
  reviewReasons: readonly string[],
): readonly string[] {
  const reasons = [
    `mode-${input.mode}`,
    `shadow-${shadowDecision}`,
    ...reviewReasons,
  ];
  if (input.mode === 'observe' || input.mode === 'warn') {
    reasons.push('non-enforcing-mode');
  }
  if (observedFeatureTrue(input, 'policyBlocked')) reasons.push('policy-blocked');
  if (observedFeatureTrue(input, 'blocked')) reasons.push('feature-blocked');
  if (observedFeatureTrue(input, 'unsafe')) reasons.push('feature-unsafe');
  if (observedFeatureTrue(input, 'narrowRequired')) reasons.push('narrow-required');
  if (input.retryAttempt !== null && input.retryAttempt !== undefined) {
    reasons.push('retry-attempt-bound');
  }
  return Object.freeze([...new Set(reasons)]);
}

function createGenericAdmissionEvaluation(
  input: CreateGenericAdmissionInput,
): GenericAdmissionModeEvaluation {
  const reviewReasons = genericAdmissionReviewReasons(input);
  const shadowDecision = genericAdmissionShadowDecisionFor(input, reviewReasons);
  const effectiveDecision = effectiveDecisionForGenericMode(input.mode, shadowDecision);
  const downstreamPosture = downstreamPostureForGenericMode(input.mode, effectiveDecision);

  return Object.freeze({
    mode: input.mode,
    shadowDecision,
    effectiveDecision,
    downstreamPosture,
    enforcementActive: input.mode === 'review' || input.mode === 'enforce',
    reasonCodes: genericReasonCodes(input, shadowDecision, reviewReasons),
  });
}

function reasonCodesForCheck(
  kind: ConsequenceAdmissionCheckKind,
  reasonCodes: readonly string[],
): readonly string[] {
  const matches = reasonCodes.filter((reason) => {
    if (kind === 'policy') return reason.startsWith('policy-');
    if (kind === 'authority') return reason.startsWith('authority-');
    if (kind === 'evidence') return reason.startsWith('evidence-');
    if (kind === 'enforcement') return reason === 'non-enforcing-mode';
    if (kind === 'adapter-readiness') return reason.startsWith('adapter-');
    if (kind === 'freshness') return reason.startsWith('freshness-');
    return false;
  });
  return Object.freeze(matches);
}

function checkOutcomeForGenericMode(
  mode: GenericAdmissionMode,
  checkReasons: readonly string[],
): ConsequenceAdmissionCheckOutcome {
  if (checkReasons.length === 0) return 'pass';
  return mode === 'observe' || mode === 'warn' ? 'warn' : 'fail';
}

function createGenericAdmissionChecks(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionCheck[] {
  const profile = consequenceAdmissionDomainProfile(input.domain);
  return Object.freeze(
    profile.requiredChecks.map((kind) => {
      const checkReasons = reasonCodesForCheck(kind, evaluation.reasonCodes);
      const outcome = checkOutcomeForGenericMode(input.mode, checkReasons);
      return createConsequenceAdmissionCheck({
        kind,
        label: `${kind} check`,
        outcome,
        required: input.mode === 'review' || input.mode === 'enforce',
        summary:
          outcome === 'pass'
            ? `${kind} closure is present for the proposed consequence.`
            : `${kind} closure is incomplete for the proposed consequence.`,
        reasonCodes: checkReasons,
        evidenceRefs: [...(input.evidenceRefs ?? [])],
      });
    }),
  );
}

function genericAdmissionReason(
  evaluation: GenericAdmissionModeEvaluation,
): string {
  if (evaluation.mode === 'observe') {
    return 'Observe mode recorded the shadow admission decision without blocking downstream execution.';
  }
  if (evaluation.mode === 'warn') {
    return 'Warn mode allowed the request while returning the shadow admission decision and warning checks.';
  }
  if (evaluation.effectiveDecision === 'review') {
    return 'The proposed consequence is held for review before downstream execution.';
  }
  if (evaluation.effectiveDecision === 'block') {
    return 'The proposed consequence is blocked before downstream execution.';
  }
  if (evaluation.effectiveDecision === 'narrow') {
    return 'The proposed consequence may proceed only through the returned constraints.';
  }
  return 'The proposed consequence passed the generic admission mode ladder.';
}

function genericAdmissionConstraints(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionConstraint[] {
  if (evaluation.effectiveDecision !== 'narrow') return Object.freeze([]);
  return Object.freeze([
    {
      id: `constraint:${input.domain}:generic-narrow`,
      summary: 'Proceed only with the customer-approved narrowed scope.',
      enforcedBy: input.downstreamSystem,
    },
  ]);
}

function genericAdmissionProof(
  request: ConsequenceAdmissionRequest,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionProofRef[] {
  if (evaluation.effectiveDecision !== 'admit' && evaluation.effectiveDecision !== 'narrow') {
    return Object.freeze([]);
  }
  return Object.freeze([
    {
      kind: 'admission-receipt',
      id: `generic-admission:${request.requestId}`,
      digest: request.requestId,
      uri: null,
      verifyHint:
        evaluation.mode === 'observe' || evaluation.mode === 'warn'
          ? 'Observe and warn modes are adoption modes; inspect shadowDecision before promoting to review or enforce.'
          : 'Verify the admission digest and downstream enforcement contract before execution.',
    },
  ]);
}

function genericAdmissionSummary(input: CreateGenericAdmissionInput): string {
  return input.summary ?? `${input.actor} proposes ${input.action} on ${input.downstreamSystem}.`;
}

function genericAdmissionDimensions(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): Readonly<Record<string, string | number | boolean | null>> {
  return Object.freeze({
    domain: input.domain,
    mode: input.mode,
    shadowDecision: evaluation.shadowDecision,
    downstreamPosture: evaluation.downstreamPosture,
    hasAmount: input.amount !== null && input.amount !== undefined,
    hasRecipient: input.recipient !== null && input.recipient !== undefined,
    hasDataScope: input.dataScope !== null && input.dataScope !== undefined,
    adapterReady: observedFeatureTrue(input, 'adapterReady'),
  });
}

export function isConsequenceAdmissionDecision(
  value: string,
): value is ConsequenceAdmissionDecision {
  return CONSEQUENCE_ADMISSION_DECISIONS.includes(
    value as ConsequenceAdmissionDecision,
  );
}

export function consequenceAdmissionAllowsConsequence(
  decision: ConsequenceAdmissionDecision,
): boolean {
  return decision === 'admit' || decision === 'narrow';
}

export function mapFinancePipelineDecisionToAdmission(
  value: string,
): ConsequenceAdmissionNativeDecision {
  const normalized = value.trim().toLowerCase();
  let mappedDecision: ConsequenceAdmissionDecision = 'block';
  let mappingReason = 'Unknown finance decision values fail closed.';

  if (['pass', 'accepted', 'allow', 'allowed'].includes(normalized)) {
    mappedDecision = 'admit';
    mappingReason = 'Finance allow branch maps to canonical admit.';
  } else if (
    ['narrow', 'constrained', 'scope-reduced', 'limited'].includes(normalized)
  ) {
    mappedDecision = 'narrow';
    mappingReason = 'Finance constrained allow branch maps to canonical narrow.';
  } else if (
    ['hold', 'review', 'review-required', 'needs-review', 'pending-review'].includes(normalized)
  ) {
    mappedDecision = 'review';
    mappingReason = 'Finance hold/review branch maps to canonical review.';
  } else if (
    ['fail', 'block', 'blocked', 'deny', 'denied', 'expired', 'revoked'].includes(normalized)
  ) {
    mappedDecision = 'block';
    mappingReason = 'Finance denial or invalid release state maps to canonical block.';
  }

  return Object.freeze({
    surface: 'finance-pipeline',
    value,
    mappedDecision,
    mappingReason,
  });
}

export function mapCryptoAdmissionOutcomeToAdmission(
  value: CryptoExecutionAdmissionOutcome | string,
): ConsequenceAdmissionNativeDecision {
  const normalized = value.trim().toLowerCase();
  let mappedDecision: ConsequenceAdmissionDecision = 'block';
  let mappingReason = 'Unknown crypto admission outcomes fail closed.';

  if (normalized === 'admit') {
    mappedDecision = 'admit';
    mappingReason = 'Crypto execution-admission admit maps to canonical admit.';
  } else if (normalized === 'needs-evidence') {
    mappedDecision = 'review';
    mappingReason = 'Crypto needs-evidence maps to canonical review.';
  } else if (normalized === 'deny') {
    mappedDecision = 'block';
    mappingReason = 'Crypto deny maps to canonical block.';
  }

  return Object.freeze({
    surface: 'crypto-execution-admission',
    value,
    mappedDecision,
    mappingReason,
  });
}

export function createConsequenceAdmissionCheck(
  input: ConsequenceAdmissionCheck,
): ConsequenceAdmissionCheck {
  return Object.freeze({
    kind: normalizeEnumValue(input.kind, CONSEQUENCE_ADMISSION_CHECK_KINDS, 'check.kind'),
    label: normalizeIdentifier(input.label, 'check.label'),
    outcome: normalizeEnumValue(
      input.outcome,
      CONSEQUENCE_ADMISSION_CHECK_OUTCOMES,
      'check.outcome',
    ),
    required: input.required,
    summary: normalizeIdentifier(input.summary, 'check.summary'),
    reasonCodes: readonlyCopy(input.reasonCodes),
    evidenceRefs: readonlyCopy(input.evidenceRefs),
  });
}

export const CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_ENTRIES:
readonly ConsequenceAdmissionCorrectionCatalogEntry[] = Object.freeze([
  {
    reasonCode: 'policy-ref-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['policyRef'],
    requiredEvidenceKinds: ['policy_ref'],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Attach a bounded policy reference accepted by the customer environment.',
  },
  {
    reasonCode: 'evidence-ref-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['evidenceRefs'],
    requiredEvidenceKinds: ['evidence_ref'],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Attach evidence references instead of raw customer or private data.',
  },
  {
    reasonCode: 'amount-scope-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['amount'],
    requiredEvidenceKinds: [],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Provide the proposed amount scope as structured metadata.',
  },
  {
    reasonCode: 'recipient-scope-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['recipient'],
    requiredEvidenceKinds: [],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Provide a bounded recipient reference for the proposed consequence.',
  },
  {
    reasonCode: 'data-scope-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['dataScope'],
    requiredEvidenceKinds: ['data_scope_ref'],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Provide data scope metadata such as classification, fields, or record bounds.',
  },
  {
    reasonCode: 'authority-mode-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['authorityMode'],
    requiredEvidenceKinds: ['authority_ref'],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Provide the customer-approved authority mode or authority reference.',
  },
  {
    reasonCode: 'narrow-required',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: [],
    requiredEvidenceKinds: ['narrowing_ref'],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Retry only with a narrower customer-approved consequence scope.',
  },
  {
    reasonCode: 'adapter-readiness-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['observedFeatures.adapterReady'],
    requiredEvidenceKinds: ['adapter_readiness_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Adapter readiness is an operator or customer integration control.',
  },
  {
    reasonCode: 'custom-domain-review-required',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: ['customer_policy_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Custom consequence domains require customer policy review before automation.',
  },
  {
    reasonCode: 'policy-blocked',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: [],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'The customer policy blocked the proposed consequence.',
  },
  {
    reasonCode: 'feature-blocked',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: [],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'A customer or operator supplied blocked signal prevented automatic retry.',
  },
  {
    reasonCode: 'feature-unsafe',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: [],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'A customer or operator supplied unsafe signal prevented automatic retry.',
  },
]);

const ADMISSION_CORRECTION_HINTS:
Readonly<Record<string, ConsequenceAdmissionCorrectionCatalogEntry>> = Object.freeze(
  Object.fromEntries(
    CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_ENTRIES.map((entry) => [
      entry.reasonCode,
      entry,
    ]),
  ) as Record<string, ConsequenceAdmissionCorrectionCatalogEntry>,
);

function uniqueSortedStrings(items: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(items)].sort());
}

function admissionCorrectionHints(
  reasonCodes: readonly string[],
): readonly ConsequenceAdmissionCorrectionCatalogEntry[] {
  return Object.freeze(
    reasonCodes
      .map((code) => ADMISSION_CORRECTION_HINTS[code])
      .filter((hint): hint is ConsequenceAdmissionCorrectionCatalogEntry => hint !== undefined),
  );
}

export function consequenceAdmissionCorrectionCatalog():
ConsequenceAdmissionCorrectionCatalog {
  const entries = CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_ENTRIES;
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_VERSION,
    entries,
    reasonCodes: uniqueSortedStrings(entries.map((entry) => entry.reasonCode)),
    modelRetryableReasonCodes: uniqueSortedStrings(
      entries
        .filter((entry) => entry.retryableByModel && !entry.operatorOnly)
        .map((entry) => entry.reasonCode),
    ),
    operatorOnlyReasonCodes: uniqueSortedStrings(
      entries.filter((entry) => entry.operatorOnly).map((entry) => entry.reasonCode),
    ),
  });
}

export function consequenceAdmissionCorrectionForReason(
  reasonCode: string,
): ConsequenceAdmissionCorrectionCatalogEntry | null {
  const normalized = normalizeIdentifier(reasonCode, 'correction reasonCode');
  return ADMISSION_CORRECTION_HINTS[normalized] ?? null;
}

function admissionFeedbackInstruction(input: {
  readonly allowed: boolean;
  readonly retryAllowed: boolean;
  readonly operatorOnlyReasonCodes: readonly string[];
  readonly reasonCodes: readonly string[];
}): string {
  if (input.allowed && input.reasonCodes.length === 0) {
    return 'No correction is required. Do not retry solely to seek a different decision.';
  }
  if (input.retryAllowed) {
    return [
      'Retry only with bounded references for the missing fields.',
      'Do not include raw customer, bank, wallet, credential, secret, or private policy data.',
    ].join(' ');
  }
  if (input.operatorOnlyReasonCodes.length > 0) {
    return 'Do not retry automatically. Route the action to the customer review or operator boundary.';
  }
  if (input.allowed) {
    return 'Use the reason codes as shadow feedback. Do not include raw sensitive data in a retry.';
  }
  return 'Do not retry automatically without customer-controlled review.';
}

function createAdmissionFeedback(input: {
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly retryAllowed: boolean;
}): ConsequenceAdmissionFeedback {
  const hints = admissionCorrectionHints(input.reasonCodes);
  const missingFields = uniqueSortedStrings(hints.flatMap((hint) => [...hint.missingFields]));
  const requiredEvidenceKinds = uniqueSortedStrings(
    hints.flatMap((hint) => [...hint.requiredEvidenceKinds]),
  );
  const operatorOnlyReasonCodes = uniqueSortedStrings(
    input.reasonCodes.filter((code) => ADMISSION_CORRECTION_HINTS[code]?.operatorOnly === true),
  );
  const disclosureLevel: ConsequenceAdmissionFeedbackDisclosureLevel =
    missingFields.length > 0 || requiredEvidenceKinds.length > 0
      ? 'actionable'
      : 'minimal';

  return Object.freeze({
    disclosureLevel,
    safeForModel: true,
    reasonCodes: readonlyCopy(input.reasonCodes),
    missingFields,
    requiredEvidenceKinds,
    operatorOnlyReasonCodes,
    safeInstruction: admissionFeedbackInstruction({
      allowed: input.allowed,
      retryAllowed: input.retryAllowed,
      operatorOnlyReasonCodes,
      reasonCodes: input.reasonCodes,
    }),
  });
}

function genericModeFromOperationalContext(
  operationalContext: Readonly<Record<string, string | number | boolean | null>>,
): GenericAdmissionMode | null {
  const mode = operationalContext.mode;
  return typeof mode === 'string' && GENERIC_ADMISSION_MODES.includes(mode as GenericAdmissionMode)
    ? mode as GenericAdmissionMode
    : null;
}

function retryAllowedByReasonCodes(reasonCodes: readonly string[]): boolean {
  const hints = admissionCorrectionHints(reasonCodes);
  return hints.some((hint) => hint.retryableByModel) &&
    !hints.some((hint) => hint.operatorOnly);
}

function nonRetryableReasonCodes(reasonCodes: readonly string[]): readonly string[] {
  return uniqueSortedStrings(
    reasonCodes.filter((code) => ADMISSION_CORRECTION_HINTS[code]?.operatorOnly === true),
  );
}

function createAdmissionRetryGuidance(input: {
  readonly decision: ConsequenceAdmissionDecision;
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly operationalContext: Readonly<Record<string, string | number | boolean | null>>;
}): ConsequenceAdmissionRetryGuidance {
  const nonRetryable = nonRetryableReasonCodes(input.reasonCodes);
  const retryAllowed =
    input.decision === 'review' &&
    !input.allowed &&
    nonRetryable.length === 0 &&
    retryAllowedByReasonCodes(input.reasonCodes);
  const retryCategory: ConsequenceAdmissionRetryGuidance['retryCategory'] =
    input.allowed
      ? 'not-needed'
      : retryAllowed
        ? 'safe-correction'
        : input.decision === 'review'
          ? 'human-review-required'
          : 'not-retryable';

  return Object.freeze({
    retryAllowed,
    retryCategory,
    maxAttempts: retryAllowed ? CONSEQUENCE_ADMISSION_RETRY_DEFAULT_MAX_ATTEMPTS : 0,
    retryWindowSeconds: retryAllowed
      ? CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS
      : null,
    nextAllowedMode: retryAllowed
      ? genericModeFromOperationalContext(input.operationalContext)
      : null,
    requiresChangedRequest: retryAllowed,
    sameRequestReplayAllowed: false,
    retryBindingRequired: retryAllowed,
    retryBindingFields: retryAllowed
      ? CONSEQUENCE_ADMISSION_RETRY_BINDING_FIELDS
      : Object.freeze([]),
    nonRetryableReasonCodes: nonRetryable,
  });
}

function retryBudgetNumber(
  value: number | null | undefined,
  fallback: number,
  fieldName: string,
): number {
  if (value === undefined || value === null) return fallback;
  return normalizePositiveInteger(value, fieldName);
}

function addSeconds(timestamp: string, seconds: number): string {
  return new Date(new Date(timestamp).getTime() + seconds * 1000).toISOString();
}

function retryBudgetInstruction(retryAllowed: boolean): string {
  if (retryAllowed) {
    return [
      'Bound retry may proceed as a correction attempt.',
      'The downstream system must still honor the new admission decision before execution.',
    ].join(' ');
  }
  return 'Do not retry automatically. Route the action to customer review or operator control.';
}

export function evaluateConsequenceAdmissionRetryBudget(
  input: EvaluateConsequenceAdmissionRetryBudgetInput,
): ConsequenceAdmissionRetryBudgetEvaluation {
  const previous = input.previousAdmission;
  const attempt = input.retryAttempt;
  const maxAttempts = retryBudgetNumber(
    input.maxAttempts,
    previous.retry.maxAttempts,
    'retryBudget.maxAttempts',
  );
  const retryWindowSeconds = retryBudgetNumber(
    input.retryWindowSeconds,
    previous.retry.retryWindowSeconds ?? CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS,
    'retryBudget.retryWindowSeconds',
  );
  const evaluatedAt = normalizeIsoTimestamp(
    input.evaluatedAt ?? attempt.attemptedAt,
    'retryBudget.evaluatedAt',
  );
  const windowStartedAt = previous.decidedAt;
  const windowExpiresAt = addSeconds(windowStartedAt, retryWindowSeconds);
  const reasonCodes: string[] = [];

  if (!previous.retry.retryAllowed) {
    reasonCodes.push('previous-retry-not-allowed');
  }
  if (attempt.previousAdmissionId !== previous.admissionId) {
    reasonCodes.push('retry-previous-admission-id-mismatch');
  }
  if (attempt.previousAdmissionDigest !== previous.digest) {
    reasonCodes.push('retry-previous-admission-digest-mismatch');
  }
  if (attempt.previousRequestId !== previous.request.requestId) {
    reasonCodes.push('retry-previous-request-id-mismatch');
  }
  if (attempt.attemptNumber > maxAttempts) {
    reasonCodes.push('retry-budget-exhausted');
  }
  if (new Date(attempt.attemptedAt).getTime() < new Date(windowStartedAt).getTime()) {
    reasonCodes.push('retry-before-previous-decision');
  }
  if (new Date(attempt.attemptedAt).getTime() > new Date(windowExpiresAt).getTime()) {
    reasonCodes.push('retry-window-expired');
  }
  if (attempt.correctionReasonCodes.length === 0) {
    reasonCodes.push('retry-correction-reason-missing');
  }

  const previousFeedbackReasons = new Set(previous.feedback.reasonCodes);
  const unboundCorrectionReasons = attempt.correctionReasonCodes.filter(
    (reason) => !previousFeedbackReasons.has(reason),
  );
  if (unboundCorrectionReasons.length > 0) {
    reasonCodes.push('retry-correction-reason-unbound');
  }

  const previousOperatorOnlyReasons = new Set(previous.feedback.operatorOnlyReasonCodes);
  const operatorOnlyCorrectionReasons = attempt.correctionReasonCodes.filter((reason) =>
    previousOperatorOnlyReasons.has(reason),
  );
  if (operatorOnlyCorrectionReasons.length > 0) {
    reasonCodes.push('retry-operator-only-reason');
  }

  const retryAllowed = reasonCodes.length === 0;
  const payload = {
    version: CONSEQUENCE_ADMISSION_RETRY_RULE_VERSION,
    outcome: retryAllowed ? 'allow-retry' : 'hold-for-review',
    retryAllowed,
    failClosed: !retryAllowed,
    previousAdmissionId: previous.admissionId,
    previousAdmissionDigest: previous.digest,
    retryAttemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    maxAttempts,
    attemptsRemaining: Math.max(maxAttempts - attempt.attemptNumber, 0),
    retryWindowSeconds,
    windowStartedAt,
    windowExpiresAt,
    evaluatedAt,
    reasonCodes: uniqueSortedStrings(reasonCodes),
    safeInstruction: retryBudgetInstruction(retryAllowed),
  } satisfies Omit<ConsequenceAdmissionRetryBudgetEvaluation, 'canonical' | 'digest'>;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createConsequenceAdmissionRequest(
  input: CreateConsequenceAdmissionRequestInput,
): ConsequenceAdmissionRequest {
  const requestedAt = normalizeIsoTimestamp(input.requestedAt, 'requestedAt');
  const base = Object.freeze({
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    requestedAt,
    packFamily: normalizeEnumValue(
      input.packFamily,
      CONSEQUENCE_ADMISSION_PACK_FAMILIES,
      'packFamily',
    ),
    entryPoint: Object.freeze({
      kind: normalizeEnumValue(
        input.entryPoint.kind,
        CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS,
        'entryPoint.kind',
      ),
      id: normalizeIdentifier(input.entryPoint.id, 'entryPoint.id'),
      route: normalizeOptionalIdentifier(input.entryPoint.route, 'entryPoint.route'),
      packageSubpath: normalizeOptionalIdentifier(
        input.entryPoint.packageSubpath,
        'entryPoint.packageSubpath',
      ),
      sourceRef: normalizeOptionalIdentifier(input.entryPoint.sourceRef, 'entryPoint.sourceRef'),
    }),
    proposedConsequence: Object.freeze({
      actor: normalizeIdentifier(input.proposedConsequence.actor, 'proposedConsequence.actor'),
      action: normalizeIdentifier(input.proposedConsequence.action, 'proposedConsequence.action'),
      downstreamSystem: normalizeIdentifier(
        input.proposedConsequence.downstreamSystem,
        'proposedConsequence.downstreamSystem',
      ),
      consequenceKind: normalizeEnumValue(
        input.proposedConsequence.consequenceKind,
        CONSEQUENCE_ADMISSION_CONSEQUENCE_KINDS,
        'proposedConsequence.consequenceKind',
      ),
      riskClass: normalizeEnumValue(
        input.proposedConsequence.riskClass,
        CONSEQUENCE_ADMISSION_RISK_CLASSES,
        'proposedConsequence.riskClass',
      ),
      summary: normalizeIdentifier(
        input.proposedConsequence.summary,
        'proposedConsequence.summary',
      ),
    }),
    policyScope: Object.freeze({
      policyRef: input.policyScope?.policyRef ?? null,
      tenantId: input.policyScope?.tenantId ?? null,
      environment: input.policyScope?.environment ?? null,
      dimensions: Object.freeze(input.policyScope?.dimensions ?? {}),
    }),
    authority: Object.freeze({
      actorRef: input.authority?.actorRef ?? null,
      reviewerRef: input.authority?.reviewerRef ?? null,
      signerRef: input.authority?.signerRef ?? null,
      delegationRef: input.authority?.delegationRef ?? null,
      authorityMode: input.authority?.authorityMode ?? null,
    }),
    evidence: Object.freeze((input.evidence ?? []).map(normalizeEvidenceRef)),
    nativeInputRefs: Object.freeze(
      (input.nativeInputRefs ?? []).map((entry) =>
        normalizeIdentifier(entry, 'nativeInputRefs[]'),
      ),
    ),
    retryAttempt: normalizeRetryAttemptBinding(input.retryAttempt),
  } satisfies Omit<ConsequenceAdmissionRequest, 'requestId'>);
  const requestId = normalizeOptionalIdentifier(input.requestId, 'requestId');

  if (base.retryAttempt !== null && requestId === base.retryAttempt.previousRequestId) {
    throw new Error(
      'Consequence admission retry attempts must not reuse the previous requestId.',
    );
  }

  return Object.freeze({
    ...base,
    requestId: requestId ?? requestIdFor(base),
  });
}

export function createConsequenceAdmissionResponse(
  input: CreateConsequenceAdmissionResponseInput,
): ConsequenceAdmissionResponse {
  const decidedAt = normalizeIsoTimestamp(input.decidedAt, 'decidedAt');
  const decision = normalizeEnumValue(input.decision, CONSEQUENCE_ADMISSION_DECISIONS, 'decision');
  const reason = normalizeIdentifier(input.reason, 'reason');
  const reasonCodes = readonlyCopy(input.reasonCodes);
  const constraints = readonlyCopy(input.constraints);

  if (decision === 'narrow' && constraints.length === 0) {
    throw new Error(
      'Consequence admission narrow decisions require at least one explicit constraint.',
    );
  }

  const nativeDecision = normalizeNativeDecision(input.nativeDecision);
  if (nativeDecision && nativeDecision.mappedDecision !== decision) {
    throw new Error(
      'Consequence admission native decision mapping must match the canonical decision.',
    );
  }

  const checks = Object.freeze((input.checks ?? []).map(createConsequenceAdmissionCheck));
  const proof = Object.freeze((input.proof ?? []).map(normalizeProofRef));
  const decisionAllows = consequenceAdmissionAllowsConsequence(decision);
  const requiredChecksSatisfied = !checks.some(
    (check) => check.required && check.outcome === 'fail',
  );
  const proofSatisfied = !decisionAllows || proof.length > 0;
  const decisionFailClosed = decision === 'review' || decision === 'block';
  const requestedFailClosed = input.failClosed ?? false;
  const allowed =
    decisionAllows &&
    proofSatisfied &&
    requiredChecksSatisfied &&
    !requestedFailClosed &&
    !decisionFailClosed;
  const failClosed = decisionFailClosed || requestedFailClosed || (decisionAllows && !allowed);
  const operationalContext = Object.freeze(input.operationalContext ?? {});
  const retry = createAdmissionRetryGuidance({
    decision,
    allowed,
    reasonCodes,
    operationalContext,
  });
  const feedback = createAdmissionFeedback({
    allowed,
    reasonCodes,
    retryAllowed: retry.retryAllowed,
  });
  const admissionId = admissionIdFor({
    decidedAt,
    requestId: input.request.requestId,
    decision,
    reasonCodes,
    proofDigests: proof.map((entry) => entry.digest ?? entry.id),
  });
  const canonicalPayload = {
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    admissionId,
    decidedAt,
    request: input.request,
    decision,
    allowed,
    failClosed,
    reason,
    reasonCodes,
    checks,
    constraints,
    nativeDecision,
    proof,
    feedback,
    retry,
    operationalContext,
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createConsequenceAdmissionProblem(input: {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance?: string | null;
  readonly reasonCodes?: readonly string[];
}): ConsequenceAdmissionProblem {
  return Object.freeze({
    type: normalizeIdentifier(input.type, 'problem.type'),
    title: normalizeIdentifier(input.title, 'problem.title'),
    status: input.status,
    detail: normalizeIdentifier(input.detail, 'problem.detail'),
    instance: input.instance ?? null,
    decision: 'block',
    failClosed: true,
    reasonCodes: readonlyCopy(input.reasonCodes),
  });
}

export function createGenericAdmissionEnvelope(input: unknown): GenericAdmissionEnvelope {
  const normalized = normalizeCreateGenericAdmissionInput(input);
  const evaluation = createGenericAdmissionEvaluation(normalized);
  const profile = consequenceAdmissionDomainProfile(normalized.domain);
  const requestedAt = normalized.requestedAt ?? new Date().toISOString();
  const decidedAt = normalized.decidedAt ?? requestedAt;
  const request = createConsequenceAdmissionRequest({
    requestedAt,
    requestId: normalized.requestId,
    packFamily: 'general',
    entryPoint: {
      kind: 'hosted-route',
      id: 'generic-admission-api',
      route: '/api/v1/admissions',
      packageSubpath: null,
      sourceRef: 'src/service/http/routes/generic-admission-routes.ts',
    },
    proposedConsequence: {
      actor: normalized.actor,
      action: normalized.action,
      downstreamSystem: normalized.downstreamSystem,
      consequenceKind: profile.defaultConsequenceKinds[0] ?? 'custom',
      riskClass: profile.minimumRiskClass,
      summary: genericAdmissionSummary(normalized),
    },
    policyScope: {
      policyRef: normalized.policyRef,
      tenantId: normalized.tenantId,
      environment: normalized.environment,
      dimensions: genericAdmissionDimensions(normalized, evaluation),
    },
    authority: {
      actorRef: normalized.actorRef ?? normalized.actor,
      reviewerRef: normalized.reviewerRef,
      signerRef: normalized.signerRef,
      delegationRef: normalized.delegationRef,
      authorityMode: normalized.authorityMode,
    },
    evidence: (normalized.evidenceRefs ?? []).map((ref) => ({
      id: ref,
      kind: 'reference',
      digest: null,
      uri: null,
    })),
    nativeInputRefs: normalized.nativeInputRefs,
    retryAttempt: normalized.retryAttempt,
  });
  const response = createConsequenceAdmissionResponse({
    request,
    decidedAt,
    decision: evaluation.effectiveDecision,
    reason: genericAdmissionReason(evaluation),
    reasonCodes: evaluation.reasonCodes,
    checks: createGenericAdmissionChecks(normalized, evaluation),
    constraints: genericAdmissionConstraints(normalized, evaluation),
    proof: genericAdmissionProof(request, evaluation),
    operationalContext: {
      mode: evaluation.mode,
      shadowDecision: evaluation.shadowDecision,
      downstreamPosture: evaluation.downstreamPosture,
      enforcementActive: evaluation.enforcementActive,
      modeBlocksDownstream:
        evaluation.downstreamPosture === 'hold-for-review' ||
        evaluation.effectiveDecision === 'block',
      consequenceDomain: normalized.domain,
      taxonomyRiskClass: profile.minimumRiskClass,
      nonEnforcingMode: normalized.mode === 'observe' || normalized.mode === 'warn',
    },
  });

  return Object.freeze({
    mode: evaluation.mode,
    shadowDecision: evaluation.shadowDecision,
    downstreamPosture: evaluation.downstreamPosture,
    enforcementActive: evaluation.enforcementActive,
    admission: response,
  });
}

export function consequenceAdmissionDescriptor():
ConsequenceAdmissionDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    retryAttemptVersion: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_VERSION,
    retryRuleVersion: CONSEQUENCE_ADMISSION_RETRY_RULE_VERSION,
    retryAttemptLedgerVersion: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
    agentLoopAbuseGuardVersion: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
    correctionCatalogVersion: CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_VERSION,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    packDecisionProfileVersion: CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION,
    retryDefaultMaxAttempts: CONSEQUENCE_ADMISSION_RETRY_DEFAULT_MAX_ATTEMPTS,
    retryDefaultWindowSeconds: CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS,
    decisions: CONSEQUENCE_ADMISSION_DECISIONS,
    genericAdmissionModes: GENERIC_ADMISSION_MODES,
    genericAdmissionShadowDecisions: GENERIC_ADMISSION_SHADOW_DECISIONS,
    genericAdmissionDownstreamPostures: GENERIC_ADMISSION_DOWNSTREAM_POSTURES,
    packFamilies: CONSEQUENCE_ADMISSION_PACK_FAMILIES,
    consequenceKinds: CONSEQUENCE_ADMISSION_CONSEQUENCE_KINDS,
    riskClasses: CONSEQUENCE_ADMISSION_RISK_CLASSES,
    entryPointKinds: CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS,
    checkKinds: CONSEQUENCE_ADMISSION_CHECK_KINDS,
    checkOutcomes: CONSEQUENCE_ADMISSION_CHECK_OUTCOMES,
    feedbackDisclosureLevels: CONSEQUENCE_ADMISSION_FEEDBACK_DISCLOSURE_LEVELS,
    correctionAudiences: CONSEQUENCE_ADMISSION_CORRECTION_AUDIENCES,
    correctionReasonCodes: consequenceAdmissionCorrectionCatalog().reasonCodes,
    dataMinimizationSurfaceKinds: CONSEQUENCE_DATA_MINIMIZATION_SURFACE_KINDS,
    dataMinimizationForbiddenRawClasses: CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES,
    packDecisionPostures: CONSEQUENCE_ADMISSION_PACK_DECISION_POSTURES,
    packDecisionRecommendedActions: CONSEQUENCE_ADMISSION_PACK_DECISION_RECOMMENDED_ACTIONS,
    packDecisionSignalKinds: CONSEQUENCE_ADMISSION_PACK_DECISION_SIGNAL_KINDS,
    retryBindingFields: CONSEQUENCE_ADMISSION_RETRY_BINDING_FIELDS,
    retryBudgetOutcomes: CONSEQUENCE_ADMISSION_RETRY_BUDGET_OUTCOMES,
    retryAttemptLedgerOutcomes: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_OUTCOMES,
    retryAttemptLedgerFailureReasons: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_FAILURE_REASONS,
    agentLoopAbuseGuardOutcomes: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_OUTCOMES,
    agentLoopAbuseGuardReasonCodes: CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_REASON_CODES,
    adapterKinds: CONSEQUENCE_ADMISSION_ADAPTER_KINDS,
    adapterOutcomes: CONSEQUENCE_ADMISSION_ADAPTER_OUTCOMES,
    auditEvidenceArtifactKinds: CONSEQUENCE_AUDIT_EVIDENCE_ARTIFACT_KINDS,
    auditEvidenceFindingKinds: CONSEQUENCE_AUDIT_EVIDENCE_FINDING_KINDS,
    tamperEvidentHistoryVersion: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    tamperEvidentHistoryEntryKinds: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_ENTRY_KINDS,
    tamperEvidentHistoryVerificationFailureReasons:
      CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERIFICATION_FAILURE_REASONS,
    businessRiskDashboardWidgets: CONSEQUENCE_BUSINESS_RISK_DASHBOARD_WIDGETS,
    businessRiskSignals: CONSEQUENCE_BUSINESS_RISK_SIGNALS,
    dashboardApiSummaryTileKinds: CONSEQUENCE_DASHBOARD_API_SUMMARY_TILE_KINDS,
    dashboardApiSummaryAttentionKinds: CONSEQUENCE_DASHBOARD_API_SUMMARY_ATTENTION_KINDS,
    dashboardApiSummaryLinkKinds: CONSEQUENCE_DASHBOARD_API_SUMMARY_LINK_KINDS,
    externalReviewFocusAreas: CONSEQUENCE_EXTERNAL_REVIEW_FOCUS_AREAS,
    externalReviewEvidenceKinds: CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_KINDS,
    externalReviewEvidenceStatuses: CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_STATUSES,
    externalReviewFindingKinds: CONSEQUENCE_EXTERNAL_REVIEW_FINDING_KINDS,
    proofKinds: CONSEQUENCE_ADMISSION_PROOF_KINDS,
    nativeSurfaces: CONSEQUENCE_ADMISSION_NATIVE_SURFACES,
    consequenceDomains: CONSEQUENCE_ADMISSION_DOMAINS,
    controlRequirements: CONSEQUENCE_ADMISSION_CONTROL_REQUIREMENTS,
    taxonomy: CONSEQUENCE_ADMISSION_TAXONOMY,
    policyLimitKinds: CONSEQUENCE_ADMISSION_POLICY_LIMIT_KINDS,
    policyLimitBreachActions: CONSEQUENCE_ADMISSION_POLICY_LIMIT_BREACH_ACTIONS,
    presentationBindingFields: CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_FIELDS,
    presentationReplayLedgerFailureReasons: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_FAILURE_REASONS,
    downstreamExecutionStatuses: CONSEQUENCE_ADMISSION_DOWNSTREAM_EXECUTION_STATUSES,
  });
}

export * from './taxonomy.js';
export * from './policy-limits.js';
export * from './presentation-binding.js';
export * from './presentation-replay-ledger.js';
export * from './downstream-execution-receipt.js';
export * from './retry-attempt-ledger.js';
export * from './agent-loop-abuse-guard.js';
export * from './adapter-framework.js';
export * from './audit-evidence-export.js';
export * from './tamper-evident-history.js';
export * from './business-risk-dashboard.js';
export * from './dashboard-api-summary.js';
export * from './external-review-packet.js';
export * from './data-minimization-redaction-policy.js';
export * from './pack-decision-profile.js';
export * from './downstream-enforcement-contract.js';
export * from './verifier-helper.js';
export * from './shadow-events.js';
export * from './shadow-simulation.js';
export * from './money-movement-shadow.js';
export * from './shadow-summary.js';
export * from './action-risk-inventory.js';
export * from './action-surface-profiler.js';
export * from './action-surface-declaration-ingestors.js';
export * from './action-surface-manifest-intake.js';
export * from './action-surface-integration-artifacts.js';
export * from './action-surface-onboarding-packet.js';
export * from './action-surface-onboarding-review-handoff.js';
export * from './action-surface-onboarding-red-team-fixtures.js';
export * from './policy-discovery-candidates.js';
export * from './policy-foundry-readiness.js';
export * from './policy-foundry-red-team-replay.js';
export * from './policy-foundry-active-questions.js';
export * from './policy-foundry-onboarding-session.js';
export * from './policy-foundry-coverage-score.js';
export * from './policy-foundry-gate-planner.js';
export * from './policy-foundry-candidate-registry.js';
export * from './failure-mode-registry.js';
export * from './failure-mode-control-bindings.js';
export * from './failure-mode-replay-fixtures.js';
export * from './untrusted-content-authority-guard.js';
export * from './tool-result-poisoning-guard.js';
export * from './approval-provenance-guard.js';
export * from './stale-authority-policy-guard.js';
export * from './policy-foundry-counterexample-ledger.js';
export * from './policy-foundry-policy-twin-summary.js';
export * from './policy-foundry-authority-relationship-context.js';
export * from './policy-foundry-review-only-patch-pack.js';
export * from './policy-foundry-self-onboarding-cli.js';
export * from './policy-foundry-outcome-feedback-loop.js';
export * from './policy-foundry-drift-policy-debt-detector.js';
export * from './policy-foundry-commercial-boundary.js';
export * from './policy-foundry-adversarial-replay-executor.js';
export * from './policy-foundry-live-downstream-replay.js';
export * from './policy-foundry-hosted-onboarding-workflow.js';
export * from './policy-foundry-hosted-review-surface.js';
export * from './integration-mode-readiness.js';
export * from './shadow-policy-promotion-draft.js';
export * from './shadow-policy-promotion-packet.js';
export * from './shadow-policy-promotion-simulation.js';
export * from './shadow-policy-bundle-publication.js';
export * from './shadow-downstream-verification-binding.js';
export * from './shadow-downstream-integration-proof.js';
export * from './shadow-activation-readiness-gate.js';
export * from './shadow-customer-activation-handoff.js';
export * from './shadow-customer-activation-receipt.js';
export * from './finance.js';
export * from './crypto.js';
export * from './facade.js';
export * from './customer-gate.js';
