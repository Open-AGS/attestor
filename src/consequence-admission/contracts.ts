import {
  RISK_CLASSES,
  RiskClass,
} from '../release-kernel/types.js';
import {
  CONSEQUENCE_ADMISSION_CONTROL_REQUIREMENTS,
  CONSEQUENCE_ADMISSION_DOMAINS,
  CONSEQUENCE_ADMISSION_KNOWN_CONSEQUENCE_KINDS,
  CONSEQUENCE_ADMISSION_TAXONOMY,
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
  CONSEQUENCE_ADMISSION_CONSTRAINT_KINDS,
  type ConsequenceAdmissionConstraintKind,
} from './constraint-kinds.js';
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
import {
  CONSEQUENCE_DOMAIN_PACK_BOUNDARY_VERSION,
  type ConsequenceDomainPackBoundaryDescriptor,
} from './domain-pack-boundary.js';
import {
  ATTESTOR_CONTROL_PLANE_ROLES,
  ATTESTOR_CONTROL_PLANE_ROLE_VERSION,
  ATTESTOR_CONTROL_PLANE_ROLE_DESCRIPTORS,
} from './control-plane-roles.js';
import {
  CONSEQUENCE_FAILURE_MODE_REGISTRY_PLACEMENT_VERSION,
  type ConsequenceFailureModeRegistryPlacementDescriptor,
} from './failure-mode-registry.js';
import {
  CONSEQUENCE_REPLAY_LAYER_PLACEMENT_VERSION,
  type ConsequenceReplayLayerPlacementDescriptor,
} from './replay-layer-placement.js';
import {
  CONSEQUENCE_GUARD_ACTIVATION_READINESS_VERSION,
  type ConsequenceGuardActivationReadinessDescriptor,
} from './guard-activation-readiness.js';
import {
  CONSEQUENCE_SHADOW_READINESS_CLAIM_ALIGNMENT_VERSION,
  type ConsequenceShadowReadinessClaimAlignmentDescriptor,
} from './shadow-readiness-claim-alignment.js';
import {
  CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_VERSION,
  type ConsequenceFailureModeGuardCoverageMatrix,
} from './failure-mode-guard-coverage.js';
import {
  CONSEQUENCE_HUMAN_REVIEW_FATIGUE_OUTCOMES,
  CONSEQUENCE_HUMAN_REVIEW_FATIGUE_REASON_CODES,
  CONSEQUENCE_HUMAN_REVIEW_FATIGUE_GUARD_VERSION,
  type ConsequenceHumanReviewFatigueDecision,
  type EvaluateConsequenceHumanReviewFatigueInput,
} from './human-review-fatigue-guard.js';
import {
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_OUTCOMES,
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_VERSION,
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_REASON_CODES,
  type ConsequenceAgenticSupplyChainComponent,
  type ConsequenceAgenticSupplyChainDecision,
} from './agentic-supply-chain-guard.js';
import {
  CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_OUTCOMES,
  CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_VERSION,
  CONSEQUENCE_MULTI_AGENT_DELEGATION_REASON_CODES,
  type ConsequenceMultiAgentDelegationDecision,
  type ConsequenceMultiAgentDelegationPrincipal,
  type EvaluateConsequenceMultiAgentDelegationInput,
} from './multi-agent-delegation-guard.js';
import {
  CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_OUTCOMES,
  CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_REASON_CODES,
  CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_VERSION,
} from './failure-mode-runtime-extensions.js';
import {
  CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION,
  type CustomerPepRuntimeAdoptionDescriptor,
} from './customer-pep-runtime-adoption.js';
import {
  CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION,
  type CustomerPepAdoptionPackageDescriptor,
} from './customer-pep-adoption-package.js';
import {
  CONSEQUENCE_APPROVAL_GUARD_REASON_CODES,
  type ConsequenceApprovalProvenanceClaim,
  type ConsequenceApprovalProvenanceDecision,
} from './approval-provenance-guard.js';
import {
  CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_REASON_CODES,
  type ConsequenceUntrustedContentAuthorityDecision,
  type ConsequenceUntrustedContentAuthoritySource,
} from './untrusted-content-authority-guard.js';
import {
  CONSEQUENCE_NO_GO_CONDITION_REASON_CODES,
  type ConsequenceNoGoConditionLedgerDecision,
  type ConsequenceNoGoConditionRecord,
} from './no-go-condition-ledger.js';
import {
  CONSEQUENCE_SCOPE_EXPLOSION_REASON_CODES,
  type ConsequenceScopeExplosionDecision,
  type ConsequenceScopeExplosionScopeInput,
} from './scope-explosion-guard.js';
import {
  CONSEQUENCE_TOOL_RESULT_GUARD_REASON_CODES,
  type ConsequenceToolResultClaim,
  type ConsequenceToolResultEvidenceClass,
  type ConsequenceToolResultPoisoningDecision,
} from './tool-result-poisoning-guard.js';
import {
  type ConsequenceStaleAuthorityPolicyDecision,
  type EvaluateConsequenceStaleAuthorityPolicyInput,
} from './stale-authority-policy-guard.js';
import {
  CONSEQUENCE_DECISION_CONTEXT_DRIFT_BINDING_VERSION,
  CONSEQUENCE_DECISION_CONTEXT_DRIFT_OUTCOMES,
  CONSEQUENCE_DECISION_CONTEXT_DRIFT_REASON_CODES,
  type ConsequenceDecisionContextBindingContext,
  type ConsequenceDecisionContextDriftDecision,
  type EvaluateConsequenceDecisionContextDriftInput,
} from './decision-context-drift-binding.js';
import {
  AUTHORITY_CREEP_FINDINGS,
  AUTHORITY_CREEP_GUARD_VERSION,
  AUTHORITY_CREEP_OUTCOMES,
  type AuthorityCreepGuardRecord,
} from './authority-creep-guard.js';
import type {
  DecisionLineageGraphRecord,
} from './decision-lineage-graph.js';
import type {
  AssuranceMeasurementPlane,
} from './assurance-measurement-plane.js';
import {
  PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION,
  type ProtectedAdmissionE2eProofPlanDescriptor,
} from './protected-admission-e2e-proof-plan.js';

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

export const GENERIC_ADMISSION_OBSERVED_FEATURE_ORIGINS = [
  'caller-supplied',
  'operator-attested',
  'customer-gateway',
  'attestor-runtime',
  'trusted-adapter',
] as const;
export type GenericAdmissionObservedFeatureOrigin =
  typeof GENERIC_ADMISSION_OBSERVED_FEATURE_ORIGINS[number];

export const GENERIC_ADMISSION_TRUSTED_OBSERVED_FEATURE_ORIGINS:
ReadonlySet<GenericAdmissionObservedFeatureOrigin> = new Set([
  'operator-attested',
  'customer-gateway',
  'attestor-runtime',
  'trusted-adapter',
]);

export const GENERIC_ADMISSION_AUTHORITY_GUARD_REASON_CODES:
ReadonlySet<string> = new Set(CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_REASON_CODES);

export const GENERIC_ADMISSION_APPROVAL_GUARD_REASON_CODES:
ReadonlySet<string> = new Set(CONSEQUENCE_APPROVAL_GUARD_REASON_CODES);

export const GENERIC_ADMISSION_SCOPE_EXPLOSION_REASON_CODES:
ReadonlySet<string> = new Set(CONSEQUENCE_SCOPE_EXPLOSION_REASON_CODES);

export const GENERIC_ADMISSION_NO_GO_REASON_CODES:
ReadonlySet<string> = new Set(CONSEQUENCE_NO_GO_CONDITION_REASON_CODES);

export const GENERIC_ADMISSION_TOOL_RESULT_REASON_CODES:
ReadonlySet<string> = new Set(CONSEQUENCE_TOOL_RESULT_GUARD_REASON_CODES);

export const GENERIC_ADMISSION_AGENTIC_SUPPLY_CHAIN_REASON_CODES:
ReadonlySet<string> = new Set(CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_REASON_CODES);

export const GENERIC_ADMISSION_DECISION_CONTEXT_DRIFT_REASON_CODES:
ReadonlySet<string> = new Set(CONSEQUENCE_DECISION_CONTEXT_DRIFT_REASON_CODES);

export const GENERIC_ADMISSION_HUMAN_REVIEW_FATIGUE_REASON_CODES:
ReadonlySet<string> = new Set(CONSEQUENCE_HUMAN_REVIEW_FATIGUE_REASON_CODES);

export const GENERIC_ADMISSION_MULTI_AGENT_DELEGATION_REASON_CODES:
ReadonlySet<string> = new Set(CONSEQUENCE_MULTI_AGENT_DELEGATION_REASON_CODES);

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

export const CONSEQUENCE_ADMISSION_RISK_CLASSES = Object.freeze([
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
  readonly kind: ConsequenceAdmissionConstraintKind;
  readonly summary: string;
  readonly enforcedBy: string;
  readonly parameterDigest: string | null;
}

export interface CreateConsequenceAdmissionConstraintInput {
  readonly id: string;
  readonly kind?: ConsequenceAdmissionConstraintKind | null;
  readonly summary: string;
  readonly enforcedBy: string;
  readonly parameterDigest?: string | null;
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
  readonly domainPackBoundaryVersion: typeof CONSEQUENCE_DOMAIN_PACK_BOUNDARY_VERSION;
  readonly controlPlaneRoleVersion: typeof ATTESTOR_CONTROL_PLANE_ROLE_VERSION;
  readonly failureModeRegistryPlacementVersion: typeof CONSEQUENCE_FAILURE_MODE_REGISTRY_PLACEMENT_VERSION;
  readonly replayLayerPlacementVersion: typeof CONSEQUENCE_REPLAY_LAYER_PLACEMENT_VERSION;
  readonly guardActivationReadinessVersion: typeof CONSEQUENCE_GUARD_ACTIVATION_READINESS_VERSION;
  readonly shadowReadinessClaimAlignmentVersion:
    typeof CONSEQUENCE_SHADOW_READINESS_CLAIM_ALIGNMENT_VERSION;
  readonly failureModeGuardCoverageVersion: typeof CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_VERSION;
  readonly failureModeRuntimeExtensionVersion: typeof CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_VERSION;
  readonly customerPepRuntimeAdoptionVersion: typeof CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION;
  readonly customerPepAdoptionPackageVersion: typeof CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION;
  readonly protectedAdmissionE2eProofPlanVersion:
    typeof PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION;
  readonly agenticSupplyChainGuardVersion: typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_VERSION;
  readonly humanReviewFatigueGuardVersion:
    typeof CONSEQUENCE_HUMAN_REVIEW_FATIGUE_GUARD_VERSION;
  readonly decisionContextDriftBindingVersion:
    typeof CONSEQUENCE_DECISION_CONTEXT_DRIFT_BINDING_VERSION;
  readonly multiAgentDelegationGuardVersion: typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_VERSION;
  readonly authorityCreepGuardVersion: typeof AUTHORITY_CREEP_GUARD_VERSION;
  readonly retryDefaultMaxAttempts: typeof CONSEQUENCE_ADMISSION_RETRY_DEFAULT_MAX_ATTEMPTS;
  readonly retryDefaultWindowSeconds: typeof CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS;
  readonly decisions: typeof CONSEQUENCE_ADMISSION_DECISIONS;
  readonly genericAdmissionModes: typeof GENERIC_ADMISSION_MODES;
  readonly genericAdmissionObservedFeatureOrigins:
    typeof GENERIC_ADMISSION_OBSERVED_FEATURE_ORIGINS;
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
  readonly controlPlaneRoles: typeof ATTESTOR_CONTROL_PLANE_ROLES;
  readonly controlPlaneRoleDescriptors: typeof ATTESTOR_CONTROL_PLANE_ROLE_DESCRIPTORS;
  readonly domainPackBoundary: ConsequenceDomainPackBoundaryDescriptor;
  readonly failureModeRegistryPlacement: ConsequenceFailureModeRegistryPlacementDescriptor;
  readonly replayLayerPlacement: ConsequenceReplayLayerPlacementDescriptor;
  readonly guardActivationReadiness: ConsequenceGuardActivationReadinessDescriptor;
  readonly shadowReadinessClaimAlignment: ConsequenceShadowReadinessClaimAlignmentDescriptor;
  readonly failureModeGuardCoverage: ConsequenceFailureModeGuardCoverageMatrix;
  readonly customerPepRuntimeAdoption: CustomerPepRuntimeAdoptionDescriptor;
  readonly customerPepAdoptionPackage: CustomerPepAdoptionPackageDescriptor;
  readonly protectedAdmissionE2eProofPlan: ProtectedAdmissionE2eProofPlanDescriptor;
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
  readonly agenticSupplyChainGuardOutcomes: typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_OUTCOMES;
  readonly agenticSupplyChainGuardReasonCodes: typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_REASON_CODES;
  readonly humanReviewFatigueGuardOutcomes: typeof CONSEQUENCE_HUMAN_REVIEW_FATIGUE_OUTCOMES;
  readonly humanReviewFatigueGuardReasonCodes: typeof CONSEQUENCE_HUMAN_REVIEW_FATIGUE_REASON_CODES;
  readonly decisionContextDriftOutcomes: typeof CONSEQUENCE_DECISION_CONTEXT_DRIFT_OUTCOMES;
  readonly decisionContextDriftReasonCodes:
    typeof CONSEQUENCE_DECISION_CONTEXT_DRIFT_REASON_CODES;
  readonly multiAgentDelegationGuardOutcomes: typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_OUTCOMES;
  readonly multiAgentDelegationGuardReasonCodes: typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_REASON_CODES;
  readonly authorityCreepGuardOutcomes: typeof AUTHORITY_CREEP_OUTCOMES;
  readonly authorityCreepGuardFindings: typeof AUTHORITY_CREEP_FINDINGS;
  readonly failureModeRuntimeExtensionOutcomes: typeof CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_OUTCOMES;
  readonly failureModeRuntimeExtensionReasonCodes: typeof CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_REASON_CODES;
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
  readonly constraintKinds: typeof CONSEQUENCE_ADMISSION_CONSTRAINT_KINDS;
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
  readonly constraints?: readonly CreateConsequenceAdmissionConstraintInput[];
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

export type GenericAdmissionAuthoritySource =
  ConsequenceUntrustedContentAuthoritySource;

export type GenericAdmissionApproval =
  ConsequenceApprovalProvenanceClaim;

export type GenericAdmissionNoGoCondition =
  ConsequenceNoGoConditionRecord;

export type GenericAdmissionScopeInput =
  ConsequenceScopeExplosionScopeInput;

export type GenericAdmissionToolResult =
  ConsequenceToolResultClaim;

export type GenericAdmissionStaleAuthorityPolicy =
  Omit<EvaluateConsequenceStaleAuthorityPolicyInput, 'generatedAt' | 'actionSurface' | 'action'>;

export type GenericAdmissionDecisionContextBindingContext =
  ConsequenceDecisionContextBindingContext;

export type GenericAdmissionDecisionContextDrift =
  Omit<EvaluateConsequenceDecisionContextDriftInput, 'generatedAt' | 'actionSurface' | 'action'>;

export type GenericAdmissionAgenticSupplyChainComponent =
  ConsequenceAgenticSupplyChainComponent;

export interface GenericAdmissionAgenticSupplyChain {
  readonly components: readonly GenericAdmissionAgenticSupplyChainComponent[];
}

export type GenericAdmissionHumanReviewFatigue =
  Omit<EvaluateConsequenceHumanReviewFatigueInput, 'generatedAt' | 'actionSurface' | 'action'>;

export type GenericAdmissionMultiAgentDelegationPrincipal =
  ConsequenceMultiAgentDelegationPrincipal;

export type GenericAdmissionMultiAgentDelegation =
  Omit<EvaluateConsequenceMultiAgentDelegationInput, 'generatedAt' | 'actionSurface' | 'action'>;

export interface GenericAdmissionAuthorityCreep {
  readonly lineageGraph: DecisionLineageGraphRecord;
  readonly evaluatorRefDigest: string;
  readonly guardId?: string | null;
  readonly targetClaimNodeId?: string | null;
  readonly measurementPlane?: AssuranceMeasurementPlane | null;
  readonly evidenceNodeId?: string | null;
  readonly defeaterId?: string | null;
  readonly rawPayloadRequested?: boolean | null;
  readonly rawEvidenceRequested?: boolean | null;
  readonly auditWriteRequested?: boolean | null;
  readonly policyActivationRequested?: boolean | null;
  readonly liveEnforcementRequested?: boolean | null;
  readonly authorityActionRequested?: boolean | null;
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
  readonly authoritySources?: readonly GenericAdmissionAuthoritySource[];
  readonly approvals?: readonly GenericAdmissionApproval[];
  readonly scopeOwnerPolicyRef?: string | null;
  readonly requestedScope?: GenericAdmissionScopeInput | null;
  readonly approvedScope?: GenericAdmissionScopeInput | null;
  readonly allowedToolResultEvidenceClasses?:
    readonly ConsequenceToolResultEvidenceClass[] | null;
  readonly toolResults?: readonly GenericAdmissionToolResult[] | null;
  readonly agenticSupplyChain?: GenericAdmissionAgenticSupplyChain | null;
  readonly humanReviewFatigue?: GenericAdmissionHumanReviewFatigue | null;
  readonly multiAgentDelegation?: GenericAdmissionMultiAgentDelegation | null;
  readonly staleAuthorityPolicy?: GenericAdmissionStaleAuthorityPolicy | null;
  readonly decisionContextDrift?: GenericAdmissionDecisionContextDrift | null;
  readonly authorityCreep?: GenericAdmissionAuthorityCreep | null;
  readonly noGoLedgerRef?: string | null;
  readonly noGoConditions?: readonly GenericAdmissionNoGoCondition[] | null;
  readonly noGoNaturalLanguageBypassAttempted?: boolean | null;
  readonly noGoNaturalLanguageSignals?: readonly string[];
  readonly noGoBypassAttemptRef?: string | null;
  readonly nativeInputRefs?: readonly string[];
  readonly observedFeatures?: Readonly<Record<string, GenericAdmissionFeatureValue>>;
  readonly observedFeatureOrigins?:
    Readonly<Record<string, GenericAdmissionObservedFeatureOrigin>>;
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
  readonly authorityGuardDecision: ConsequenceUntrustedContentAuthorityDecision | null;
  readonly approvalGuardDecision: ConsequenceApprovalProvenanceDecision | null;
  readonly scopeExplosionGuardDecision: ConsequenceScopeExplosionDecision | null;
  readonly toolResultGuardDecision: ConsequenceToolResultPoisoningDecision | null;
  readonly agenticSupplyChainGuardDecision: ConsequenceAgenticSupplyChainDecision | null;
  readonly humanReviewFatigueGuardDecision: ConsequenceHumanReviewFatigueDecision | null;
  readonly multiAgentDelegationGuardDecision: ConsequenceMultiAgentDelegationDecision | null;
  readonly staleAuthorityPolicyGuardDecision: ConsequenceStaleAuthorityPolicyDecision | null;
  readonly decisionContextDriftDecision: ConsequenceDecisionContextDriftDecision | null;
  readonly authorityCreepGuardDecision: AuthorityCreepGuardRecord | null;
  readonly noGoConditionLedgerDecision: ConsequenceNoGoConditionLedgerDecision | null;
}

export interface GenericAdmissionEnvelope {
  readonly mode: GenericAdmissionMode;
  readonly shadowDecision: GenericAdmissionShadowDecision;
  readonly downstreamPosture: GenericAdmissionDownstreamPosture;
  readonly enforcementActive: boolean;
  readonly admission: ConsequenceAdmissionResponse;
}
