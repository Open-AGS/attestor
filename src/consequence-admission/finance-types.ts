import type { ConsequenceApprovalProvenanceClaim } from './approval-provenance-guard.js';
import type { ConsequenceToolResultClaim, ConsequenceToolResultEvidenceClass } from './tool-result-poisoning-guard.js';
import type { ConsequenceUntrustedContentAuthoritySource } from './untrusted-content-authority-guard.js';
import type {
  GenericAdmissionAgenticSupplyChain,
  GenericAdmissionDecisionContextDrift,
  GenericAdmissionGuardInputKind,
  GenericAdmissionGuardInputProvenanceRecord,
  GenericAdmissionHumanReviewFatigue,
  GenericAdmissionMultiAgentDelegation,
  GenericAdmissionNoGoCondition,
  GenericAdmissionScopeInput,
  GenericAdmissionStaleAuthorityPolicy,
} from './contracts.js';
import type {
  ConsequenceAdmissionConstraint,
  ConsequenceAdmissionEvidenceRef,
  ConsequenceAdmissionProposedConsequence,
  ConsequenceAdmissionRequest,
} from './index.js';

export const FINANCE_PIPELINE_ADMISSION_ROUTE = '/api/v1/pipeline/run';
export const FINANCE_PIPELINE_ADMISSION_ENTRY_POINT_ID = 'finance-pipeline-run';
export const FINANCE_PIPELINE_ADMISSION_SOURCE_REF =
  'src/service/http/routes/pipeline-execution-routes.ts';

export type OperationalPrimitive = string | number | boolean | null;

export interface FinancePipelineAdmissionTrustGuardInput {
  readonly authoritySources?: readonly ConsequenceUntrustedContentAuthoritySource[];
  readonly approvals?: readonly ConsequenceApprovalProvenanceClaim[];
  readonly scopeOwnerPolicyRef?: string | null;
  readonly requestedScope?: GenericAdmissionScopeInput | null;
  readonly approvedScope?: GenericAdmissionScopeInput | null;
  readonly allowedToolResultEvidenceClasses?:
    readonly ConsequenceToolResultEvidenceClass[] | null;
  readonly toolResults?: readonly ConsequenceToolResultClaim[] | null;
  readonly agenticSupplyChain?: GenericAdmissionAgenticSupplyChain | null;
  readonly humanReviewFatigue?: GenericAdmissionHumanReviewFatigue | null;
  readonly multiAgentDelegation?: GenericAdmissionMultiAgentDelegation | null;
  readonly staleAuthorityPolicy?: GenericAdmissionStaleAuthorityPolicy | null;
  readonly decisionContextDrift?: GenericAdmissionDecisionContextDrift | null;
  readonly guardInputProvenance?:
    readonly GenericAdmissionGuardInputProvenanceRecord[];
  readonly requiredGuardInputProvenance?:
    readonly GenericAdmissionGuardInputKind[];
  readonly noGoLedgerRef?: string | null;
  readonly noGoConditions?: readonly GenericAdmissionNoGoCondition[] | null;
  readonly noGoNaturalLanguageBypassAttempted?: boolean | null;
  readonly noGoNaturalLanguageSignals?: readonly string[];
  readonly noGoBypassAttemptRef?: string | null;
}

export interface FinancePipelineAdmissionRequestInput
  extends FinancePipelineAdmissionTrustGuardInput {
  readonly requestedAt: string;
  readonly requestId?: string | null;
  readonly runId?: string | null;
  readonly actor?: string | null;
  readonly action?: string | null;
  readonly downstreamSystem?: string | null;
  readonly consequenceKind?: ConsequenceAdmissionProposedConsequence['consequenceKind'];
  readonly riskClass?: ConsequenceAdmissionProposedConsequence['riskClass'];
  readonly summary?: string | null;
  readonly policyRef?: string | null;
  readonly tenantId?: string | null;
  readonly environment?: string | null;
  readonly dimensions?: Readonly<Record<string, OperationalPrimitive>>;
  readonly actorRef?: string | null;
  readonly reviewerRef?: string | null;
  readonly signerRef?: string | null;
  readonly delegationRef?: string | null;
  readonly authorityMode?: string | null;
  readonly evidence?: readonly ConsequenceAdmissionEvidenceRef[];
  readonly nativeInputRefs?: readonly string[];
}

export interface FinanceFilingReleaseAdmissionSummary {
  readonly targetId?: string | null;
  readonly decisionId?: string | null;
  readonly decisionStatus?: string | null;
  readonly policyVersion?: string | null;
  readonly introspectionRequired?: boolean | null;
  readonly outputHash?: string | null;
  readonly consequenceHash?: string | null;
  readonly tokenId?: string | null;
  readonly token?: string | null;
  readonly expiresAt?: string | null;
  readonly evidencePackId?: string | null;
  readonly evidencePackPath?: string | null;
  readonly evidencePackDigest?: string | null;
  readonly reviewQueueId?: string | null;
  readonly reviewQueuePath?: string | null;
}

export interface FinanceShadowReleaseAdmissionSummary {
  readonly targetId?: string | null;
  readonly decisionId?: string | null;
  readonly decisionStatus?: string | null;
  readonly policyVersion?: string | null;
  readonly policyRolloutMode?: string | null;
  readonly policyEvaluationMode?: string | null;
  readonly wouldBlockIfEnforced?: boolean | null;
  readonly wouldRequireReview?: boolean | null;
  readonly wouldRequireToken?: boolean | null;
  readonly outputHash?: string | null;
  readonly consequenceHash?: string | null;
}

export interface FinancePipelineAdmissionRun {
  readonly runId: string;
  readonly decision: string;
  readonly proofMode?: string | null;
  readonly warrant?: string | null;
  readonly escrow?: string | null;
  readonly receipt?: string | null;
  readonly capsule?: string | null;
  readonly auditChainIntact?: boolean | null;
  readonly certificate?: Record<string, unknown> | null;
  readonly verification?: Record<string, unknown> | null;
  readonly signingMode?: string | null;
  readonly identitySource?: string | null;
  readonly reviewerName?: string | null;
  readonly tenantContext?: {
    readonly tenantId?: string | null;
    readonly source?: string | null;
    readonly planId?: string | null;
  } | null;
  readonly usage?: {
    readonly used?: number | null;
    readonly remaining?: number | null;
    readonly quota?: number | null;
    readonly enforced?: boolean | null;
  } | null;
  readonly rateLimit?: {
    readonly remaining?: number | null;
    readonly resetAt?: string | null;
    readonly enforced?: boolean | null;
  } | null;
  readonly release?: {
    readonly filingExport?: FinanceFilingReleaseAdmissionSummary | null;
    readonly communication?: FinanceShadowReleaseAdmissionSummary | null;
    readonly action?: FinanceShadowReleaseAdmissionSummary | null;
  } | null;
  readonly filingExport?: {
    readonly adapterId?: string | null;
    readonly coveragePercent?: number | null;
    readonly mappedCount?: number | null;
  } | null;
  readonly filingPackage?: {
    readonly adapterId?: string | null;
    readonly coveragePercent?: number | null;
    readonly mappedCount?: number | null;
    readonly issuedPackage?: Record<string, unknown> | null;
  } | null;
}

export interface CreateFinancePipelineAdmissionResponseInput
  extends FinancePipelineAdmissionTrustGuardInput {
  readonly run: FinancePipelineAdmissionRun;
  readonly decidedAt: string;
  readonly request?: ConsequenceAdmissionRequest | null;
  readonly constraints?: readonly ConsequenceAdmissionConstraint[];
  readonly operationalContext?: Readonly<Record<string, OperationalPrimitive>>;
}

export interface FinancePipelineAdmissionDescriptor {
  readonly packFamily: 'finance';
  readonly nativeSurface: 'finance-pipeline';
  readonly route: typeof FINANCE_PIPELINE_ADMISSION_ROUTE;
  readonly entryPointId: typeof FINANCE_PIPELINE_ADMISSION_ENTRY_POINT_ID;
  readonly sourceRef: typeof FINANCE_PIPELINE_ADMISSION_SOURCE_REF;
  readonly nativeDecisionOrder: readonly [
    'release.filingExport.decisionStatus',
    'decision',
  ];
  readonly hostedRouteBehavior: 'unchanged';
}
