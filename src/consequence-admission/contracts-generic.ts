import type { ConsequenceAdmissionDomain } from './taxonomy.js';
import type {
  ConsequenceApprovalProvenanceClaim,
  ConsequenceApprovalProvenanceDecision,
} from './approval-provenance-guard.js';
import type {
  ConsequenceUntrustedContentAuthorityDecision,
  ConsequenceUntrustedContentAuthoritySource,
} from './untrusted-content-authority-guard.js';
import type {
  ConsequenceNoGoConditionLedgerDecision,
  ConsequenceNoGoConditionRecord,
} from './no-go-condition-ledger.js';
import type {
  ConsequenceScopeExplosionDecision,
  ConsequenceScopeExplosionScopeInput,
} from './scope-explosion-guard.js';
import type {
  ConsequenceToolResultClaim,
  ConsequenceToolResultEvidenceClass,
  ConsequenceToolResultPoisoningDecision,
} from './tool-result-poisoning-guard.js';
import type {
  ConsequenceStaleAuthorityPolicyDecision,
  EvaluateConsequenceStaleAuthorityPolicyInput,
} from './stale-authority-policy-guard.js';
import type {
  ConsequenceDecisionContextBindingContext,
  ConsequenceDecisionContextDriftDecision,
  EvaluateConsequenceDecisionContextDriftInput,
} from './decision-context-drift-binding.js';
import type {
  ConsequenceAgenticSupplyChainComponent,
  ConsequenceAgenticSupplyChainDecision,
} from './agentic-supply-chain-guard.js';
import type {
  ConsequenceHumanReviewFatigueDecision,
  EvaluateConsequenceHumanReviewFatigueInput,
} from './human-review-fatigue-guard.js';
import type {
  ConsequenceMultiAgentDelegationDecision,
  ConsequenceMultiAgentDelegationPrincipal,
  EvaluateConsequenceMultiAgentDelegationInput,
} from './multi-agent-delegation-guard.js';
import type { AuthorityCreepGuardRecord } from './authority-creep-guard.js';
import type {
  GenericAdmissionGuardOutcomeTraceEntry,
} from './generic-guard-outcome-trace.js';
import type { DecisionLineageGraphRecord } from './decision-lineage-graph.js';
import type { AssuranceMeasurementPlane } from './assurance-measurement-plane.js';
import type {
  ConsequenceAdmissionDecision,
  ConsequenceAdmissionResponse,
  ConsequenceAdmissionRetryAttemptBinding,
  GenericAdmissionDownstreamPosture,
  GenericAdmissionGuardInputAssertionKind,
  GenericAdmissionGuardInputKind,
  GenericAdmissionGuardInputProvenanceOutcome,
  GenericAdmissionGuardInputProvenanceReasonCode,
  GenericAdmissionGuardInputSourceClass,
  GenericAdmissionMode,
  GenericAdmissionObservedFeatureOrigin,
  GenericAdmissionShadowDecision,
  GENERIC_ADMISSION_GUARD_INPUT_PROVENANCE_VERSION,
} from './contracts.js';

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

export interface GenericAdmissionGuardInputProvenanceRecord {
  readonly guardKind: GenericAdmissionGuardInputKind;
  readonly sourceClass: GenericAdmissionGuardInputSourceClass;
  readonly assertionKinds: readonly GenericAdmissionGuardInputAssertionKind[];
  readonly sourceRef?: string | null;
  readonly sourceDigest?: string | null;
  readonly evidenceDigest?: string | null;
  readonly tenantId?: string | null;
  readonly recordedAt?: string | null;
  readonly trustedBoundary?: boolean | null;
}

export interface GenericAdmissionGuardInputProvenanceObservedRecord {
  readonly guardKind: GenericAdmissionGuardInputKind;
  readonly sourceClass: GenericAdmissionGuardInputSourceClass;
  readonly assertionKinds: readonly GenericAdmissionGuardInputAssertionKind[];
  readonly sourceRefDigest?: string;
  readonly sourceDigest?: string;
  readonly evidenceDigest?: string;
  readonly tenantIdDigest?: string;
  readonly recordedAt?: string;
  readonly trustedBoundary: boolean;
  readonly outcome: GenericAdmissionGuardInputProvenanceOutcome;
  readonly reasonCodes: readonly GenericAdmissionGuardInputProvenanceReasonCode[];
}

export interface GenericAdmissionGuardInputProvenanceDecision {
  readonly version: typeof GENERIC_ADMISSION_GUARD_INPUT_PROVENANCE_VERSION;
  readonly generatedAt: string;
  readonly actionSurface?: string;
  readonly action?: string;
  readonly outcome: GenericAdmissionGuardInputProvenanceOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly GenericAdmissionGuardInputProvenanceReasonCode[];
  readonly failureModeId: 'guard-input-provenance';
  readonly protectedPrinciples: readonly [
    'proof integrity',
    'customer authority',
    'auditability',
  ];
  readonly counts: {
    readonly recordCount: number;
    readonly requiredKindCount: number;
    readonly missingRequiredKindCount: number;
    readonly trustedSourceCount: number;
    readonly untrustedSourceCount: number;
    readonly missingDigestCount: number;
    readonly missingTimestampCount: number;
    readonly missingTenantCount: number;
  };
  readonly missingRequiredGuardKinds: readonly GenericAdmissionGuardInputKind[];
  readonly observedRecords: readonly GenericAdmissionGuardInputProvenanceObservedRecord[];
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

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
  readonly guardInputProvenance?:
    readonly GenericAdmissionGuardInputProvenanceRecord[];
  readonly requiredGuardInputProvenance?:
    readonly GenericAdmissionGuardInputKind[];
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
  readonly guardInputProvenanceDecision:
    GenericAdmissionGuardInputProvenanceDecision | null;
}

export interface GenericAdmissionEnvelope {
  readonly mode: GenericAdmissionMode;
  readonly shadowDecision: GenericAdmissionShadowDecision;
  readonly downstreamPosture: GenericAdmissionDownstreamPosture;
  readonly enforcementActive: boolean;
  readonly guardOutcomes: readonly GenericAdmissionGuardOutcomeTraceEntry[];
  readonly admission: ConsequenceAdmissionResponse;
}
