import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CryptoAuthorizationIntent,
} from './object-model.js';
import type {
  CryptoConsequenceRiskAssessment,
} from './consequence-risk-mapping.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import type {
  CryptoAuthorizationSimulationResult,
  CryptoSimulationPreflightSignal,
} from './authorization-simulation.js';
import type { CryptoAccountKind } from './types.js';

/**
 * ERC-4337 UserOperation adapter for account-abstraction execution.
 *
 * Step 15 keeps UserOperation packing and bundler-specific facts outside the
 * crypto object model. The adapter binds Attestor authorization evidence to the
 * EntryPoint, userOpHash, sender, nonce, decoded call intent, ERC-7562 validation
 * scope, and optional factory/paymaster readiness before a bundler can proceed.
 */

export const ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION =
  'attestor.crypto-erc4337-user-operation-adapter.v1';

export const ERC4337_USER_OPERATION_ENTRYPOINT_VERSIONS = [
  'v0.6',
  'v0.7',
  'v0.8',
] as const;
export type Erc4337EntryPointVersion =
  typeof ERC4337_USER_OPERATION_ENTRYPOINT_VERSIONS[number];

export const ERC4337_USER_OPERATION_OUTCOMES = [
  'allow',
  'review-required',
  'block',
] as const;
export type Erc4337UserOperationOutcome =
  typeof ERC4337_USER_OPERATION_OUTCOMES[number];

export const ERC4337_USER_OPERATION_OBSERVATION_STATUSES = [
  'pass',
  'warn',
  'fail',
] as const;
export type Erc4337UserOperationObservationStatus =
  typeof ERC4337_USER_OPERATION_OBSERVATION_STATUSES[number];

export const ERC4337_USER_OPERATION_VALIDATION_STATUSES = [
  'passed',
  'failed',
  'not-run',
] as const;
export type Erc4337ValidationStatus =
  typeof ERC4337_USER_OPERATION_VALIDATION_STATUSES[number];

export const ERC4337_USER_OPERATION_ENTITY_STATUSES = [
  'not-used',
  'ready',
  'not-ready',
  'failed',
] as const;
export type Erc4337EntityStatus =
  typeof ERC4337_USER_OPERATION_ENTITY_STATUSES[number];

export const ERC4337_USER_OPERATION_SUPPORTED_ACCOUNT_KINDS = [
  'erc-4337-smart-account',
  'erc-7579-modular-account',
  'erc-6900-modular-account',
] as const satisfies readonly CryptoAccountKind[];

export const ERC4337_USER_OPERATION_CHECKS = [
  'erc4337-adapter-kind',
  'erc4337-account-kind-supported',
  'erc4337-sender-matches-intent',
  'erc4337-chain-matches-intent',
  'erc4337-entrypoint-bound',
  'erc4337-userop-hash-bound',
  'erc4337-nonce-matches-intent',
  'erc4337-call-target-bound',
  'erc4337-function-selector-bound',
  'erc4337-calldata-class-bound',
  'erc4337-call-data-present',
  'erc4337-bundler-simulation-passed',
  'erc4337-erc7562-scope-passed',
  'erc4337-account-validation-passed',
  'erc4337-factory-readiness',
  'erc4337-gas-policy-bound',
  'erc4337-prefund-covered',
  'erc4337-paymaster-readiness',
  'erc4337-validation-window-bound',
  'erc4337-release-binding-ready',
  'erc4337-policy-binding-ready',
  'erc4337-enforcement-binding-ready',
] as const;
export type Erc4337UserOperationCheck =
  typeof ERC4337_USER_OPERATION_CHECKS[number];

export interface Erc4337ValidationWindow {
  readonly validAfter?: string | null;
  readonly validUntil?: string | null;
}

export interface Erc4337UserOperation {
  readonly sender: string;
  readonly nonce: string;
  readonly entryPoint: string;
  readonly entryPointVersion: Erc4337EntryPointVersion;
  readonly chainId: string;
  readonly callData: string;
  readonly callTarget?: string | null;
  readonly callValue?: string | null;
  readonly callFunctionSelector?: string | null;
  readonly callDataClass?: string | null;
  readonly callCount?: number | null;
  readonly factory?: string | null;
  readonly factoryData?: string | null;
  readonly callGasLimit: string;
  readonly verificationGasLimit: string;
  readonly preVerificationGas: string;
  readonly maxFeePerGas: string;
  readonly maxPriorityFeePerGas: string;
  readonly paymaster?: string | null;
  readonly paymasterVerificationGasLimit?: string | null;
  readonly paymasterPostOpGasLimit?: string | null;
  readonly paymasterData?: string | null;
  readonly signature: string;
  readonly userOpHash: string;
}

export interface Erc4337BundlerValidation {
  readonly validatedAt: string;
  readonly bundlerId: string;
  readonly entryPointSupported: boolean;
  readonly simulateValidationStatus: Erc4337ValidationStatus;
  readonly erc7562ValidationStatus: Erc4337ValidationStatus;
  readonly accountValidationStatus: Erc4337ValidationStatus;
  readonly signatureValidationStatus: Erc4337ValidationStatus;
  readonly nonceValidationStatus: Erc4337ValidationStatus;
  readonly senderAlreadyDeployed?: boolean | null;
  readonly factoryStatus?: Erc4337EntityStatus | null;
  readonly paymasterStatus?: Erc4337EntityStatus | null;
  readonly paymasterStakeReady?: boolean | null;
  readonly paymasterDepositReady?: boolean | null;
  readonly prefundCovered: boolean;
  readonly gasLimitsWithinPolicy: boolean;
  readonly bannedOpcodeDetected?: boolean | null;
  readonly storageAccessViolation?: boolean | null;
  readonly unstakedEntityAccessDetected?: boolean | null;
  readonly aggregatorAddress?: string | null;
  readonly accountValidation?: Erc4337ValidationWindow | null;
  readonly paymasterValidation?: Erc4337ValidationWindow | null;
}

export interface Erc4337UserOperationObservation {
  readonly check: Erc4337UserOperationCheck;
  readonly status: Erc4337UserOperationObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required: boolean;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CreateErc4337UserOperationPreflightInput {
  readonly intent: CryptoAuthorizationIntent;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly userOperation: Erc4337UserOperation;
  readonly bundlerValidation: Erc4337BundlerValidation;
  readonly preflightId?: string | null;
}

export interface Erc4337UserOperationPreflight {
  readonly version: typeof ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION;
  readonly preflightId: string;
  readonly adapterKind: 'erc-4337-user-operation';
  readonly checkedAt: string;
  readonly bundlerId: string;
  readonly entryPoint: string;
  readonly entryPointVersion: Erc4337EntryPointVersion;
  readonly sender: string;
  readonly userOpHash: string;
  readonly nonce: string;
  readonly chainId: string;
  readonly callTarget: string | null;
  readonly callFunctionSelector: string | null;
  readonly callDataClass: string | null;
  readonly paymaster: string | null;
  readonly factory: string | null;
  readonly outcome: Erc4337UserOperationOutcome;
  readonly signals: readonly CryptoSimulationPreflightSignal[];
  readonly observations: readonly Erc4337UserOperationObservation[];
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface Erc4337UserOperationSimulationResult {
  readonly preflight: Erc4337UserOperationPreflight;
  readonly simulation: CryptoAuthorizationSimulationResult;
}

export interface Erc4337UserOperationAdapterDescriptor {
  readonly version: typeof ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION;
  readonly entryPointVersions: typeof ERC4337_USER_OPERATION_ENTRYPOINT_VERSIONS;
  readonly outcomes: typeof ERC4337_USER_OPERATION_OUTCOMES;
  readonly validationStatuses: typeof ERC4337_USER_OPERATION_VALIDATION_STATUSES;
  readonly entityStatuses: typeof ERC4337_USER_OPERATION_ENTITY_STATUSES;
  readonly supportedAccountKinds: typeof ERC4337_USER_OPERATION_SUPPORTED_ACCOUNT_KINDS;
  readonly checks: typeof ERC4337_USER_OPERATION_CHECKS;
  readonly standards: readonly string[];
}
