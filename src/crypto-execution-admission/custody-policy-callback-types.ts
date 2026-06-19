import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type {
  CustodyAccountEvidence,
  CustodyApprovalEvidence,
  CustodyCosignerResponseAction,
  CustodyCosignerCallbackEvidence,
  CustodyCosignerPolicyPreflight,
  CustodyKeyPostureEvidence,
  CustodyPolicyDecisionEvidence,
  CustodyPolicyProvider,
  CustodyPostExecutionEvidence,
  CustodyScreeningEvidence,
  CustodyTransactionEvidence,
} from '../crypto-authorization-core/custody-cosigner-policy-adapter.js';
import type { CryptoExecutionAdmissionPlan } from './index.js';

export const CUSTODY_POLICY_ADMISSION_CALLBACK_SPEC_VERSION =
  'attestor.crypto-custody-policy-admission-callback.v1';

export const CUSTODY_POLICY_ADMISSION_CALLBACK_OUTCOMES = [
  'allow',
  'needs-review',
  'deny',
] as const;
export type CustodyPolicyAdmissionCallbackOutcome =
  typeof CUSTODY_POLICY_ADMISSION_CALLBACK_OUTCOMES[number];

export const CUSTODY_POLICY_ADMISSION_CALLBACK_ACTIONS = [
  'approve-request',
  'queue-review',
  'reject-request',
] as const;
export type CustodyPolicyAdmissionCallbackAction =
  typeof CUSTODY_POLICY_ADMISSION_CALLBACK_ACTIONS[number];

export const CUSTODY_POLICY_CALLBACK_INTEGRATION_MODES = [
  'sync-callback',
  'approval-queue',
  'policy-consensus',
] as const;
export type CustodyPolicyCallbackIntegrationMode =
  typeof CUSTODY_POLICY_CALLBACK_INTEGRATION_MODES[number];

export const CUSTODY_POLICY_CALLBACK_PROTOCOLS = [
  'jwt-signed-json',
  'tls-pinned-json',
  'sender-constrained-json',
  'hmac-signed-json',
] as const;
export type CustodyPolicyCallbackProtocol =
  typeof CUSTODY_POLICY_CALLBACK_PROTOCOLS[number];

export const CUSTODY_POLICY_ADMISSION_EXPECTATION_KINDS = [
  'plan-surface',
  'adapter-preflight',
  'provider-binding',
  'transaction-binding',
  'policy-decision',
  'approval-quorum',
  'duty-separation',
  'break-glass-control',
  'callback-configuration',
  'callback-authentication',
  'callback-freshness',
  'attestor-token-binding',
  'screening',
  'velocity-limit',
  'key-posture',
  'callback-response',
  'post-execution',
] as const;
export type CustodyPolicyAdmissionExpectationKind =
  typeof CUSTODY_POLICY_ADMISSION_EXPECTATION_KINDS[number];

export const CUSTODY_POLICY_ADMISSION_EXPECTATION_STATUSES = [
  'satisfied',
  'missing',
  'pending',
  'failed',
  'unsupported',
] as const;
export type CustodyPolicyAdmissionExpectationStatus =
  typeof CUSTODY_POLICY_ADMISSION_EXPECTATION_STATUSES[number];

export interface CustodyPolicyCallbackProviderProfile {
  readonly provider: CustodyPolicyProvider | string;
  readonly integrationMode: CustodyPolicyCallbackIntegrationMode;
  readonly responseDeadlineSeconds: number | null;
  readonly standards: readonly string[];
}

export interface CustodyPolicyAdmissionExpectation {
  readonly kind: CustodyPolicyAdmissionExpectationKind;
  readonly status: CustodyPolicyAdmissionExpectationStatus;
  readonly reasonCode: string;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CustodyPolicyAdmissionProviderResponse {
  readonly integrationMode: CustodyPolicyCallbackIntegrationMode;
  readonly protocol: CustodyPolicyCallbackProtocol;
  readonly responseDeadlineSeconds: number | null;
  readonly authenticatedChannelRequired: true;
  readonly signedResponseRequired: boolean;
  readonly failClosed: true;
  readonly observedCallbackAction: CustodyCosignerResponseAction | string;
  readonly normalizedCallbackAction: 'approve' | 'pending-review' | 'reject';
}

export interface CreateCustodyPolicyAdmissionCallbackContractInput {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: CustodyCosignerPolicyPreflight;
  readonly account: CustodyAccountEvidence;
  readonly transaction: CustodyTransactionEvidence;
  readonly policyDecision: CustodyPolicyDecisionEvidence;
  readonly approvals: CustodyApprovalEvidence;
  readonly callback: CustodyCosignerCallbackEvidence;
  readonly screening: CustodyScreeningEvidence;
  readonly keyPosture: CustodyKeyPostureEvidence;
  readonly postExecution: CustodyPostExecutionEvidence;
  readonly createdAt: string;
  readonly contractId?: string | null;
  readonly callbackUrl?: string | null;
  readonly operatorNote?: string | null;
}

export interface CustodyPolicyAdmissionCallbackContract {
  readonly version: typeof CUSTODY_POLICY_ADMISSION_CALLBACK_SPEC_VERSION;
  readonly contractId: string;
  readonly createdAt: string;
  readonly provider: CustodyPolicyProvider | string;
  readonly integrationMode: CustodyPolicyCallbackIntegrationMode;
  readonly protocol: CustodyPolicyCallbackProtocol;
  readonly outcome: CustodyPolicyAdmissionCallbackOutcome;
  readonly action: CustodyPolicyAdmissionCallbackAction;
  readonly planId: string;
  readonly planDigest: string;
  readonly simulationId: string;
  readonly preflightId: string;
  readonly preflightDigest: string;
  readonly organizationId: string;
  readonly accountRef: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly chain: string;
  readonly asset: string;
  readonly amount: string;
  readonly sourceAddress: string | null;
  readonly destinationAddress: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly policyDecisionId: string;
  readonly approvalQuorum: string;
  readonly keyId: string;
  readonly callbackId: string;
  readonly callbackUrl: string | null;
  readonly providerResponse: CustodyPolicyAdmissionProviderResponse;
  readonly attestorSidecar: Readonly<Record<string, CanonicalReleaseJsonValue>>;
  readonly expectations: readonly CustodyPolicyAdmissionExpectation[];
  readonly blockingReasons: readonly string[];
  readonly nextActions: readonly string[];
  readonly operatorNote: string | null;
  readonly canonical: string;
  readonly digest: string;
}

export interface CustodyPolicyAdmissionCallbackDescriptor {
  readonly version: typeof CUSTODY_POLICY_ADMISSION_CALLBACK_SPEC_VERSION;
  readonly outcomes: typeof CUSTODY_POLICY_ADMISSION_CALLBACK_OUTCOMES;
  readonly actions: typeof CUSTODY_POLICY_ADMISSION_CALLBACK_ACTIONS;
  readonly integrationModes: typeof CUSTODY_POLICY_CALLBACK_INTEGRATION_MODES;
  readonly protocols: typeof CUSTODY_POLICY_CALLBACK_PROTOCOLS;
  readonly expectationKinds: typeof CUSTODY_POLICY_ADMISSION_EXPECTATION_KINDS;
  readonly expectationStatuses: typeof CUSTODY_POLICY_ADMISSION_EXPECTATION_STATUSES;
  readonly runtimeChecks: readonly string[];
  readonly standards: readonly string[];
}
