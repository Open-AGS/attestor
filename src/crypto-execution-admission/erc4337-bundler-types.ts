import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type {
  Erc4337UserOperation,
  Erc4337UserOperationPreflight,
} from '../crypto-authorization-core/erc4337-user-operation-adapter.js';
import type { CryptoExecutionAdmissionPlan } from './index.js';

export const ERC4337_BUNDLER_ADMISSION_HANDOFF_SPEC_VERSION =
  'attestor.crypto-erc4337-bundler-admission-handoff.v1';

export const ERC4337_BUNDLER_ADMISSION_METHODS = [
  'eth_chainId',
  'eth_supportedEntryPoints',
  'eth_estimateUserOperationGas',
  'eth_sendUserOperation',
  'eth_getUserOperationByHash',
  'eth_getUserOperationReceipt',
] as const;
export type Erc4337BundlerAdmissionMethod =
  typeof ERC4337_BUNDLER_ADMISSION_METHODS[number];

export const ERC4337_BUNDLER_ADMISSION_OUTCOMES = [
  'ready',
  'needs-bundler-evidence',
  'blocked',
] as const;
export type Erc4337BundlerAdmissionOutcome =
  typeof ERC4337_BUNDLER_ADMISSION_OUTCOMES[number];

export const ERC4337_BUNDLER_EXPECTATION_KINDS = [
  'chain-id',
  'entrypoint-support',
  'simulation',
  'erc7562-validation-scope',
  'gas-estimate',
  'paymaster-posture',
] as const;
export type Erc4337BundlerExpectationKind =
  typeof ERC4337_BUNDLER_EXPECTATION_KINDS[number];

export const ERC4337_BUNDLER_EXPECTATION_STATUSES = [
  'satisfied',
  'missing',
  'unsupported',
  'failed',
] as const;
export type Erc4337BundlerExpectationStatus =
  typeof ERC4337_BUNDLER_EXPECTATION_STATUSES[number];

export interface Erc4337BundlerJsonRpcRequest<TParams> {
  readonly method: Erc4337BundlerAdmissionMethod;
  readonly params: TParams;
}

export interface Erc4337BundlerRpcUserOperation {
  readonly sender: string;
  readonly nonce: string;
  readonly factory?: string;
  readonly factoryData?: string;
  readonly callData: string;
  readonly callGasLimit: string;
  readonly verificationGasLimit: string;
  readonly preVerificationGas: string;
  readonly maxFeePerGas: string;
  readonly maxPriorityFeePerGas: string;
  readonly paymaster?: string;
  readonly paymasterVerificationGasLimit?: string;
  readonly paymasterPostOpGasLimit?: string;
  readonly paymasterData?: string;
  readonly signature: string;
  readonly eip7702Auth?: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface Erc4337BundlerGasEstimate {
  readonly preVerificationGas: string;
  readonly verificationGasLimit: string;
  readonly callGasLimit: string;
  readonly paymasterVerificationGasLimit?: string | null;
  readonly paymasterPostOpGasLimit?: string | null;
}

export interface Erc4337BundlerAdmissionExpectation {
  readonly kind: Erc4337BundlerExpectationKind;
  readonly status: Erc4337BundlerExpectationStatus;
  readonly reasonCode: string;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CreateErc4337BundlerAdmissionHandoffInput {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: Erc4337UserOperationPreflight;
  readonly userOperation: Erc4337UserOperation;
  readonly createdAt: string;
  readonly handoffId?: string | null;
  readonly bundlerId?: string | null;
  readonly bundlerUrl?: string | null;
  readonly bundlerChainIdHex?: string | null;
  readonly supportedEntryPoints?: readonly string[] | null;
  readonly gasEstimate?: Erc4337BundlerGasEstimate | null;
  readonly eip7702Auth?: Readonly<Record<string, CanonicalReleaseJsonValue>> | null;
  readonly operatorNote?: string | null;
}

export interface Erc4337BundlerAdmissionHandoff {
  readonly version: typeof ERC4337_BUNDLER_ADMISSION_HANDOFF_SPEC_VERSION;
  readonly handoffId: string;
  readonly createdAt: string;
  readonly outcome: Erc4337BundlerAdmissionOutcome;
  readonly planId: string;
  readonly planDigest: string;
  readonly simulationId: string;
  readonly preflightId: string;
  readonly preflightDigest: string;
  readonly userOpHash: string;
  readonly sender: string;
  readonly chainId: string;
  readonly chainIdHex: string;
  readonly entryPoint: string;
  readonly entryPointVersion: Erc4337UserOperationPreflight['entryPointVersion'];
  readonly paymaster: string | null;
  readonly factory: string | null;
  readonly bundlerId: string | null;
  readonly bundlerUrl: string | null;
  readonly methods: readonly Erc4337BundlerAdmissionMethod[];
  readonly chainIdRequest: Erc4337BundlerJsonRpcRequest<readonly []>;
  readonly supportedEntryPointsRequest: Erc4337BundlerJsonRpcRequest<readonly []>;
  readonly estimateGasRequest: Erc4337BundlerJsonRpcRequest<
    readonly [Erc4337BundlerRpcUserOperation, string]
  >;
  readonly sendUserOperationRequest: Erc4337BundlerJsonRpcRequest<
    readonly [Erc4337BundlerRpcUserOperation, string]
  >;
  readonly getUserOperationByHashRequest: Erc4337BundlerJsonRpcRequest<
    readonly [string]
  >;
  readonly getUserOperationReceiptRequest: Erc4337BundlerJsonRpcRequest<
    readonly [string]
  >;
  readonly attestorSidecar: Readonly<Record<string, CanonicalReleaseJsonValue>>;
  readonly expectations: readonly Erc4337BundlerAdmissionExpectation[];
  readonly blockingReasons: readonly string[];
  readonly nextActions: readonly string[];
  readonly operatorNote: string | null;
  readonly canonical: string;
  readonly digest: string;
}

export interface Erc4337BundlerAdmissionDescriptor {
  readonly version: typeof ERC4337_BUNDLER_ADMISSION_HANDOFF_SPEC_VERSION;
  readonly methods: typeof ERC4337_BUNDLER_ADMISSION_METHODS;
  readonly outcomes: typeof ERC4337_BUNDLER_ADMISSION_OUTCOMES;
  readonly expectationKinds: typeof ERC4337_BUNDLER_EXPECTATION_KINDS;
  readonly standards: readonly string[];
}
