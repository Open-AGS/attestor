import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoConsequenceRiskAssessment } from './consequence-risk-mapping.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import type {
  CryptoAuthorizationSimulationResult,
  CryptoSimulationPreflightSignal,
} from './authorization-simulation.js';

/**
 * Custody co-signer and policy-engine adapter.
 *
 * Step 19 keeps custody-provider policy and key management outside Attestor
 * while making the pre-signing authorization evidence explicit: custody
 * account binding, policy decision, approval quorum, co-signer callback
 * authentication, screening, key posture, replay/idempotency, and Attestor
 * release/policy/enforcement readiness.
 */

export const CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION =
  'attestor.crypto-custody-cosigner-policy-adapter.v1';

export const CUSTODY_POLICY_PROVIDERS = [
  'fireblocks',
  'turnkey',
  'anchorage-digital',
  'coinbase-prime',
  'other',
] as const;
export type CustodyPolicyProvider = typeof CUSTODY_POLICY_PROVIDERS[number];

export const CUSTODY_POLICY_EFFECTS = [
  'allow',
  'deny',
  'review-required',
] as const;
export type CustodyPolicyEffect = typeof CUSTODY_POLICY_EFFECTS[number];

export const CUSTODY_POLICY_DECISION_STATUSES = [
  'approved',
  'denied',
  'pending',
  'failed',
  'timed-out',
] as const;
export type CustodyPolicyDecisionStatus =
  typeof CUSTODY_POLICY_DECISION_STATUSES[number];

export const CUSTODY_COSIGNER_AUTH_METHODS = [
  'jwt-public-key',
  'tls-certificate-pinning',
  'mtls',
  'spiffe',
  'hmac',
  'jws',
] as const;
export type CustodyCosignerAuthMethod =
  typeof CUSTODY_COSIGNER_AUTH_METHODS[number];

export const CUSTODY_COSIGNER_RESPONSE_ACTIONS = [
  'approve',
  'reject',
  'pending-review',
  'retry',
] as const;
export type CustodyCosignerResponseAction =
  typeof CUSTODY_COSIGNER_RESPONSE_ACTIONS[number];

export const CUSTODY_KEY_TYPES = ['mpc', 'hsm', 'tee-mpc', 'other'] as const;
export type CustodyKeyType = typeof CUSTODY_KEY_TYPES[number];

export const CUSTODY_POST_EXECUTION_STATUSES = [
  'not-submitted',
  'submitted',
  'signed',
  'broadcast',
  'confirmed',
  'failed',
  'cancelled',
] as const;
export type CustodyPostExecutionStatus =
  typeof CUSTODY_POST_EXECUTION_STATUSES[number];

export const CUSTODY_COSIGNER_OUTCOMES = [
  'allow',
  'review-required',
  'block',
] as const;
export type CustodyCosignerOutcome =
  typeof CUSTODY_COSIGNER_OUTCOMES[number];

export const CUSTODY_OBSERVATION_STATUSES = [
  'pass',
  'warn',
  'fail',
] as const;
export type CustodyObservationStatus =
  typeof CUSTODY_OBSERVATION_STATUSES[number];

export const CUSTODY_COSIGNER_CHECKS = [
  'custody-adapter-kind',
  'custody-withdrawal-intent',
  'custody-account-bound',
  'custody-transaction-request-bound',
  'custody-chain-asset-amount-bound',
  'custody-destination-bound',
  'custody-idempotency-replay',
  'custody-policy-engine-enabled',
  'custody-policy-explicit-decision',
  'custody-policy-implicit-deny',
  'custody-policy-scope-bound',
  'custody-policy-version-active',
  'custody-approval-quorum',
  'custody-duty-separation',
  'custody-break-glass-control',
  'custody-cosigner-callback-configured',
  'custody-cosigner-callback-authenticated',
  'custody-cosigner-callback-fresh',
  'custody-cosigner-response-bound',
  'custody-screening-risk',
  'custody-velocity-and-limit',
  'custody-key-posture',
  'custody-release-binding-ready',
  'custody-policy-binding-ready',
  'custody-enforcement-binding-ready',
  'custody-post-execution-status',
] as const;
export type CustodyCosignerCheck = typeof CUSTODY_COSIGNER_CHECKS[number];

export interface CustodyAccountEvidence {
  readonly provider: CustodyPolicyProvider | string;
  readonly organizationId: string;
  readonly workspaceId?: string | null;
  readonly vaultId?: string | null;
  readonly walletId?: string | null;
  readonly accountId: string;
  readonly accountRef: string;
  readonly chain: string;
  readonly asset: string;
  readonly sourceAddress?: string | null;
  readonly policyEngineEnabled: boolean;
  readonly custodyAccountKind?: string | null;
}

export interface CustodyTransactionEvidence {
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly idempotencyFresh: boolean;
  readonly duplicateRequestDetected: boolean;
  readonly requestHash?: string | null;
  readonly operation: string;
  readonly chain: string;
  readonly asset: string;
  readonly amount: string;
  readonly sourceAccountRef: string;
  readonly sourceAddress?: string | null;
  readonly destinationAddress: string;
  readonly destinationRef?: string | null;
  readonly destinationMemo?: string | null;
  readonly targetId?: string | null;
  readonly requestedAt: string;
  readonly simulationPassed: boolean;
}

export interface CustodyPolicyConditionsEvidence {
  readonly chainBound: boolean;
  readonly accountBound: boolean;
  readonly assetBound: boolean;
  readonly destinationBound: boolean;
  readonly amountBound: boolean;
  readonly operationBound: boolean;
  readonly budgetBound: boolean;
  readonly velocityBound: boolean;
  readonly attestorReceiptRequired: boolean;
  readonly attestorReceiptMatched: boolean;
}

export interface CustodyPolicyDecisionEvidence {
  readonly provider: CustodyPolicyProvider | string;
  readonly decisionId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly activePolicyHash?: string | null;
  readonly ruleId?: string | null;
  readonly effect: CustodyPolicyEffect | string;
  readonly status: CustodyPolicyDecisionStatus | string;
  readonly matched: boolean;
  readonly explicitDeny: boolean;
  readonly implicitDeny: boolean;
  readonly evaluatedAt: string;
  readonly environment: string;
  readonly tenantId: string;
  readonly policyActivated: boolean;
  readonly conditions: CustodyPolicyConditionsEvidence;
}

export interface CustodyApprovalEvidence {
  readonly requiredApprovals: number;
  readonly collectedApprovals: number;
  readonly quorumSatisfied: boolean;
  readonly approverIds: readonly string[];
  readonly requiredRoles: readonly string[];
  readonly collectedRoles: readonly string[];
  readonly requesterId: string;
  readonly requesterApproved: boolean;
  readonly dutySeparationSatisfied: boolean;
  readonly policyAdminApprovedOwnChange: boolean;
  readonly breakGlassUsed: boolean;
  readonly breakGlassAuthorized: boolean;
}

export interface CustodyCosignerCallbackEvidence {
  readonly callbackId: string;
  readonly configured: boolean;
  readonly authenticated: boolean;
  readonly authMethod: CustodyCosignerAuthMethod | string;
  readonly signatureValid: boolean;
  readonly tlsPinned: boolean;
  readonly senderConstrained: boolean;
  readonly sourceIpAllowlisted: boolean;
  readonly timestamp: string;
  readonly nonce: string;
  readonly nonceFresh: boolean;
  readonly bodyHash?: string | null;
  readonly bodyHashMatches: boolean;
  readonly responseAction: CustodyCosignerResponseAction | string;
  readonly responseSigned: boolean;
  readonly responseWithinSeconds: number;
  readonly attestorReleaseTokenVerified: boolean;
}

export interface CustodyScreeningEvidence {
  readonly destinationAllowlisted: boolean;
  readonly counterpartyKnown: boolean;
  readonly sanctionsScreened: boolean;
  readonly sanctionsHit: boolean;
  readonly riskScore: number;
  readonly riskScoreMax: number;
  readonly riskTierAllowed: boolean;
  readonly travelRuleRequired: boolean;
  readonly travelRuleCompleted: boolean;
  readonly velocityLimitChecked: boolean;
  readonly velocityLimitRemainingAtomic: string;
  readonly maxAmountAtomic: string;
}

export interface CustodyKeyPostureEvidence {
  readonly keyId: string;
  readonly keyType: CustodyKeyType | string;
  readonly cosignerId: string;
  readonly cosignerPaired: boolean;
  readonly cosignerHealthy: boolean;
  readonly enclaveBacked: boolean;
  readonly keyShareHealthy: boolean;
  readonly signingPolicyBound: boolean;
  readonly keyExportable: boolean;
  readonly signerRoleBound: boolean;
  readonly haSignerAvailable: boolean;
  readonly recoveryReady: boolean;
}

export interface CustodyPostExecutionEvidence {
  readonly activityId?: string | null;
  readonly status: CustodyPostExecutionStatus | string;
  readonly signatureHash?: string | null;
  readonly transactionHash?: string | null;
  readonly providerStatus?: string | null;
  readonly failureReason?: string | null;
}

export interface CustodyCosignerObservation {
  readonly check: CustodyCosignerCheck;
  readonly status: CustodyObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required: boolean;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CreateCustodyCosignerPolicyPreflightInput {
  readonly intent: CryptoAuthorizationIntent;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly account: CustodyAccountEvidence;
  readonly transaction: CustodyTransactionEvidence;
  readonly policyDecision: CustodyPolicyDecisionEvidence;
  readonly approvals: CustodyApprovalEvidence;
  readonly callback: CustodyCosignerCallbackEvidence;
  readonly screening: CustodyScreeningEvidence;
  readonly keyPosture: CustodyKeyPostureEvidence;
  readonly postExecution: CustodyPostExecutionEvidence;
  readonly preflightId?: string | null;
}

export interface CustodyCosignerPolicyPreflight {
  readonly version: typeof CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION;
  readonly preflightId: string;
  readonly adapterKind: 'custody-cosigner';
  readonly checkedAt: string;
  readonly provider: CustodyPolicyProvider | string;
  readonly organizationId: string;
  readonly accountRef: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly chain: string;
  readonly asset: string;
  readonly amount: string;
  readonly destinationAddress: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly policyDecisionId: string;
  readonly approvalQuorum: string;
  readonly keyId: string;
  readonly callbackId: string;
  readonly outcome: CustodyCosignerOutcome;
  readonly signal: CryptoSimulationPreflightSignal;
  readonly observations: readonly CustodyCosignerObservation[];
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface CustodyCosignerPolicySimulationResult {
  readonly preflight: CustodyCosignerPolicyPreflight;
  readonly simulation: CryptoAuthorizationSimulationResult;
}

export interface CustodyCosignerPolicyAdapterDescriptor {
  readonly version: typeof CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION;
  readonly adapterKind: 'custody-cosigner';
  readonly providers: typeof CUSTODY_POLICY_PROVIDERS;
  readonly policyEffects: typeof CUSTODY_POLICY_EFFECTS;
  readonly decisionStatuses: typeof CUSTODY_POLICY_DECISION_STATUSES;
  readonly authMethods: typeof CUSTODY_COSIGNER_AUTH_METHODS;
  readonly responseActions: typeof CUSTODY_COSIGNER_RESPONSE_ACTIONS;
  readonly keyTypes: typeof CUSTODY_KEY_TYPES;
  readonly postExecutionStatuses: typeof CUSTODY_POST_EXECUTION_STATUSES;
  readonly outcomes: typeof CUSTODY_COSIGNER_OUTCOMES;
  readonly checks: typeof CUSTODY_COSIGNER_CHECKS;
  readonly references: readonly string[];
}
