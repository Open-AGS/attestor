import type {
  ConsequenceAdmissionAuthority,
  ConsequenceAdmissionCheck,
  ConsequenceAdmissionDecision,
  ConsequenceAdmissionEntryPoint,
  ConsequenceAdmissionEvidenceRef,
  ConsequenceAdmissionNativeDecision,
  ConsequenceAdmissionPackFamily,
  ConsequenceAdmissionPolicyScope,
  ConsequenceAdmissionProofRef,
  ConsequenceAdmissionProposedConsequence,
  ConsequenceAdmissionRequest,
  ConsequenceAdmissionResponse,
  ConsequenceAdmissionRetryAttemptBinding,
  CreateConsequenceAdmissionConstraintInput,
} from './contracts.js';

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
  readonly retryAttempt?:
    | CreateConsequenceAdmissionRetryAttemptBindingInput
    | ConsequenceAdmissionRetryAttemptBinding
    | null;
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
