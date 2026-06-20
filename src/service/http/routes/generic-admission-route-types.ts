import type { Context } from 'hono';
import type {
  CompleteConsequenceAdmissionAccessRequestTaskInput,
  ConsequenceAdmissionAccessRequestPrincipalInput,
  ConsequenceAdmissionAccessRequestReevaluationContext,
  ConsequenceAdmissionAccessRequestTask,
  ConsequenceAdmissionAgentLoopAbuseGuardDecision,
  ConsequenceAdmissionRequestableDenial,
  GenericAdmissionEnvelope,
  GenericAdmissionProtectedReleaseTokenIssueResult,
} from '../../../consequence-admission/index.js';
import type { ReleaseTokenConfirmationClaim } from '../../../release-layer/index.js';
import type { PipelineIdempotencyService } from '../../application/pipeline-idempotency-service.js';
import type { TenantContext } from '../../tenant-isolation.js';
import type {
  WorkflowEntitlementAccessDecision,
  WorkflowEntitlementRecord,
} from '../../workflow-entitlement.js';
import type { WorkflowUsageDecision } from '../../workflow-entitlement-store.js';

export interface WorkflowAdmissionMeteringResult {
  readonly provider: 'stripe';
  readonly status: 'not_applicable' | 'skipped' | 'mock_recorded' | 'sent' | 'failed';
  readonly reason: string | null;
  readonly eventName: string | null;
  readonly eventIdentifier: string | null;
  readonly value: number;
  readonly mock: boolean;
}

export interface WorkflowAdmissionConsumptionResult {
  readonly decision: WorkflowUsageDecision | null;
  readonly billingMetering: WorkflowAdmissionMeteringResult | null;
}

export type GenericAdmissionRouteResponseEnvelope = GenericAdmissionEnvelope & {
  readonly protectedReleaseTokenAuthorization?: GenericAdmissionProtectedReleaseTokenIssueResult['authorization'];
  readonly requestableDenial?: ConsequenceAdmissionRequestableDenial;
  readonly accessRequestTask?: ConsequenceAdmissionAccessRequestTask;
  readonly accessRequestReevaluation?: ConsequenceAdmissionAccessRequestReevaluationContext;
  readonly workflowEntitlementAccess?: WorkflowEntitlementAccessDecision;
  readonly workflowUsage?: WorkflowUsageDecision['usage'];
  readonly workflowBillingMetering?: WorkflowAdmissionMeteringResult | null;
};

export interface GenericAdmissionRouteDeps {
  currentTenant(context: Context): TenantContext;
  readonly now?: () => string;
  recordShadowAdmission(input: {
    readonly tenant: TenantContext;
    readonly envelope: GenericAdmissionEnvelope;
  }): void;
  evaluateAgentLoopAbuse?(input: {
    readonly tenant: TenantContext;
    readonly envelope: GenericAdmissionEnvelope;
    readonly receivedAt: string;
  }): ConsequenceAdmissionAgentLoopAbuseGuardDecision | Promise<ConsequenceAdmissionAgentLoopAbuseGuardDecision>;
  issueProtectedReleaseToken?(input: {
    readonly context: Context;
    readonly tenant: TenantContext;
    readonly envelope: GenericAdmissionEnvelope;
    readonly receivedAt: string;
    readonly senderConfirmation?: ReleaseTokenConfirmationClaim | null;
  }): GenericAdmissionProtectedReleaseTokenIssueResult | Promise<GenericAdmissionProtectedReleaseTokenIssueResult>;
  resolveProtectedReleaseTokenConfirmation?(input: {
    readonly context: Context;
    readonly tenant: TenantContext;
    readonly envelope: GenericAdmissionEnvelope;
    readonly receivedAt: string;
  }): ReleaseTokenConfirmationClaim | null | Promise<ReleaseTokenConfirmationClaim | null>;
  createAccessRequestTask?(input: {
    readonly context: Context;
    readonly tenant: TenantContext;
    readonly envelope: GenericAdmissionEnvelope;
    readonly denial: ConsequenceAdmissionRequestableDenial;
    readonly receivedAt: string;
    readonly requester: ConsequenceAdmissionAccessRequestPrincipalInput;
  }): ConsequenceAdmissionAccessRequestTask | Promise<ConsequenceAdmissionAccessRequestTask>;
  currentAccessRequestPrincipal?(input: {
    readonly context: Context;
    readonly tenant: TenantContext;
  }): ConsequenceAdmissionAccessRequestPrincipalInput | null | Promise<ConsequenceAdmissionAccessRequestPrincipalInput | null>;
  authorizeAccessRequestDecision?(input: {
    readonly context: Context;
    readonly tenant: TenantContext;
    readonly task: ConsequenceAdmissionAccessRequestTask;
    readonly status: CompleteConsequenceAdmissionAccessRequestTaskInput['status'];
    readonly payload: unknown;
  }): ConsequenceAdmissionAccessRequestPrincipalInput | Response | Promise<ConsequenceAdmissionAccessRequestPrincipalInput | Response>;
  completeAccessRequestTask?(input: {
    readonly context: Context;
    readonly tenant: TenantContext;
    readonly taskId: string;
    readonly status: CompleteConsequenceAdmissionAccessRequestTaskInput['status'];
    readonly decidedAt: string;
    readonly decisionAuthority?: CompleteConsequenceAdmissionAccessRequestTaskInput['decisionAuthority'];
    readonly approval?: CompleteConsequenceAdmissionAccessRequestTaskInput['approval'];
  }): ConsequenceAdmissionAccessRequestTask | null | Promise<ConsequenceAdmissionAccessRequestTask | null>;
  getAccessRequestTask?(input: {
    readonly context: Context;
    readonly tenant: TenantContext;
    readonly taskId: string;
  }): ConsequenceAdmissionAccessRequestTask | null | Promise<ConsequenceAdmissionAccessRequestTask | null>;
  listAccessRequestTasks?(input: {
    readonly context: Context;
    readonly tenant: TenantContext;
    readonly limit: number;
  }): readonly ConsequenceAdmissionAccessRequestTask[] | Promise<readonly ConsequenceAdmissionAccessRequestTask[]>;
  resolveWorkflowEntitlement?(input: {
    readonly tenant: TenantContext;
    readonly workflowId: string;
  }): WorkflowEntitlementRecord | null | Promise<WorkflowEntitlementRecord | null>;
  consumeWorkflowAdmission?(input: {
    readonly tenant: TenantContext;
    readonly workflowId: string;
    readonly entitlement: WorkflowEntitlementRecord;
  }): WorkflowAdmissionConsumptionResult | Promise<WorkflowAdmissionConsumptionResult>;
  readonly admissionIdempotencyService?: PipelineIdempotencyService;
  readonly requireProtectedReleaseTokenForHighRisk?: boolean;
  readonly requireAdmissionIdempotencyKeyForEnforce?: boolean;
}
