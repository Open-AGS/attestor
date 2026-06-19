import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoConsequenceRiskAssessment } from './consequence-risk-mapping.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import type {
  CryptoAuthorizationSimulationResult,
  CryptoSimulationPreflightSignal,
} from './authorization-simulation.js';

export const EIP7702_DELEGATION_ADAPTER_SPEC_VERSION =
  'attestor.crypto-eip7702-delegation-adapter.v1';

export const EIP7702_SET_CODE_TX_TYPE = '0x04';
export const EIP7702_AUTHORIZATION_MAGIC = '0x05';
export const EIP7702_DELEGATION_INDICATOR_PREFIX = '0xef0100';
export const EIP7702_INITCODE_MARKER = '0x7702';
export const EIP7702_PER_EMPTY_ACCOUNT_COST = '25000';
export const EIP7702_PER_AUTH_BASE_COST = '12500';

export const EIP7702_EXECUTION_PATHS = [
  'set-code-transaction',
  'erc-4337-user-operation',
  'wallet-call-api',
] as const;
export type Eip7702ExecutionPath = typeof EIP7702_EXECUTION_PATHS[number];

export const EIP7702_ACCOUNT_CODE_STATES = [
  'empty',
  'delegated',
  'other-code',
] as const;
export type Eip7702AccountCodeState = typeof EIP7702_ACCOUNT_CODE_STATES[number];

export const EIP7702_OUTCOMES = [
  'allow',
  'review-required',
  'block',
] as const;
export type Eip7702Outcome = typeof EIP7702_OUTCOMES[number];

export const EIP7702_OBSERVATION_STATUSES = [
  'pass',
  'warn',
  'fail',
] as const;
export type Eip7702ObservationStatus =
  typeof EIP7702_OBSERVATION_STATUSES[number];

export const EIP7702_CHECKS = [
  'eip7702-adapter-kind',
  'eip7702-account-kind-eoa',
  'eip7702-authority-matches-intent',
  'eip7702-chain-matches-intent',
  'eip7702-authorization-chain-scope',
  'eip7702-authorization-signature',
  'eip7702-authorization-nonce',
  'eip7702-delegation-address-bound',
  'eip7702-delegate-code-posture',
  'eip7702-account-code-state',
  'eip7702-authorization-list',
  'eip7702-execution-path',
  'eip7702-target-matches-intent',
  'eip7702-function-selector-matches-intent',
  'eip7702-calldata-class-matches-intent',
  'eip7702-call-scope-signed',
  'eip7702-initialization-posture',
  'eip7702-erc4337-posture',
  'eip7702-wallet-capability-posture',
  'eip7702-pending-transaction-posture',
  'eip7702-sponsor-posture',
  'eip7702-release-binding-ready',
  'eip7702-policy-binding-ready',
  'eip7702-enforcement-binding-ready',
  'eip7702-revocation-and-recovery',
  'eip7702-post-execution-status',
] as const;
export type Eip7702Check = typeof EIP7702_CHECKS[number];

export interface Eip7702AuthorizationTupleEvidence {
  readonly chainId: string;
  readonly authorityAddress: string;
  readonly delegationAddress: string;
  readonly nonce: string;
  readonly yParity: string;
  readonly r: string;
  readonly s: string;
  readonly tupleHash?: string | null;
  readonly signatureRecoveredAddress?: string | null;
  readonly signatureValid: boolean;
  readonly lowS: boolean;
}

export interface Eip7702AccountStateEvidence {
  readonly observedAt: string;
  readonly chainId: string;
  readonly authorityAddress: string;
  readonly currentNonce: string;
  readonly codeState: Eip7702AccountCodeState;
  readonly currentDelegationAddress?: string | null;
  readonly delegationIndicator?: string | null;
  readonly codeHash?: string | null;
  readonly pendingTransactionCount?: number | null;
  readonly pendingTransactionPolicyCompliant: boolean;
}

export interface Eip7702DelegateCodeEvidence {
  readonly delegationAddress: string;
  readonly delegateCodeHash: string;
  readonly delegateImplementationId: string;
  readonly audited: boolean;
  readonly allowlisted: boolean;
  readonly storageLayoutSafe: boolean;
  readonly supportsReplayProtection: boolean;
  readonly supportsTargetCalldataBinding: boolean;
  readonly supportsValueBinding: boolean;
  readonly supportsGasBinding: boolean;
  readonly supportsExpiryBinding: boolean;
}

export interface Eip7702ExecutionEvidence {
  readonly executionPath: Eip7702ExecutionPath;
  readonly transactionType?: string | null;
  readonly authorizationListLength: number;
  readonly tupleIndex: number;
  readonly tupleIsLastValidForAuthority: boolean;
  readonly authorizationListNonEmpty: boolean;
  readonly destination: string;
  readonly target: string;
  readonly value: string;
  readonly data: string;
  readonly functionSelector?: string | null;
  readonly calldataClass?: string | null;
  readonly batchCallCount?: number | null;
  readonly targetCalldataSigned: boolean;
  readonly valueSigned: boolean;
  readonly gasLimitSigned: boolean;
  readonly nonceSigned: boolean;
  readonly expirySigned: boolean;
  readonly runtimeContextBound: boolean;
  readonly userOperationHash?: string | null;
  readonly entryPoint?: string | null;
  readonly initCodeMarker?: string | null;
  readonly factoryDataHash?: string | null;
  readonly eip7702AuthIncluded?: boolean | null;
  readonly preVerificationGasIncludesAuthorizationCost?: boolean | null;
  readonly walletCapabilityObserved?: boolean | null;
  readonly walletCapabilitySupported?: boolean | null;
  readonly walletCapabilityRequested?: boolean | null;
  readonly atomicRequired?: boolean | null;
  readonly postExecutionSuccess?: boolean | null;
}

export interface Eip7702InitializationEvidence {
  readonly initializationRequired: boolean;
  readonly initializationCalldataHash?: string | null;
  readonly initializationSignedByAuthority?: boolean | null;
  readonly initializationExecutedBeforeValidation?: boolean | null;
  readonly frontRunProtected?: boolean | null;
}

export interface Eip7702SponsorEvidence {
  readonly sponsored: boolean;
  readonly sponsorAddress?: string | null;
  readonly sponsorBondRequired?: boolean | null;
  readonly sponsorBondPresent?: boolean | null;
  readonly reimbursementBound?: boolean | null;
}

export interface Eip7702RecoveryEvidence {
  readonly revocationPathReady: boolean;
  readonly zeroAddressClearSupported: boolean;
  readonly privateKeyStillControlsAccountAcknowledged: boolean;
  readonly emergencyDelegateResetPrepared: boolean;
  readonly recoveryAuthorityRef?: string | null;
}

export interface Eip7702Observation {
  readonly check: Eip7702Check;
  readonly status: Eip7702ObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required: boolean;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CreateEip7702DelegationPreflightInput {
  readonly intent: CryptoAuthorizationIntent;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly accountState: Eip7702AccountStateEvidence;
  readonly delegateCode: Eip7702DelegateCodeEvidence;
  readonly execution: Eip7702ExecutionEvidence;
  readonly initialization: Eip7702InitializationEvidence;
  readonly sponsor: Eip7702SponsorEvidence;
  readonly recovery: Eip7702RecoveryEvidence;
  readonly preflightId?: string | null;
}

export interface Eip7702DelegationPreflight {
  readonly version: typeof EIP7702_DELEGATION_ADAPTER_SPEC_VERSION;
  readonly preflightId: string;
  readonly adapterKind: 'eip-7702-delegation';
  readonly checkedAt: string;
  readonly authorityAddress: string;
  readonly delegationAddress: string;
  readonly chainId: string;
  readonly authorizationNonce: string;
  readonly executionPath: Eip7702ExecutionPath;
  readonly target: string;
  readonly functionSelector: string | null;
  readonly outcome: Eip7702Outcome;
  readonly signal: CryptoSimulationPreflightSignal;
  readonly observations: readonly Eip7702Observation[];
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface Eip7702DelegationSimulationResult {
  readonly preflight: Eip7702DelegationPreflight;
  readonly simulation: CryptoAuthorizationSimulationResult;
}

export interface Eip7702DelegationAdapterDescriptor {
  readonly version: typeof EIP7702_DELEGATION_ADAPTER_SPEC_VERSION;
  readonly adapterKind: 'eip-7702-delegation';
  readonly transactionType: typeof EIP7702_SET_CODE_TX_TYPE;
  readonly authorizationMagic: typeof EIP7702_AUTHORIZATION_MAGIC;
  readonly delegationIndicatorPrefix: typeof EIP7702_DELEGATION_INDICATOR_PREFIX;
  readonly initCodeMarker: typeof EIP7702_INITCODE_MARKER;
  readonly executionPaths: typeof EIP7702_EXECUTION_PATHS;
  readonly accountCodeStates: typeof EIP7702_ACCOUNT_CODE_STATES;
  readonly outcomes: typeof EIP7702_OUTCOMES;
  readonly checks: typeof EIP7702_CHECKS;
  readonly references: readonly string[];
}
