import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type {
  CryptoExecutionAdmissionOutcome,
  CryptoExecutionAdmissionPlan,
} from './index.js';

export const WALLET_RPC_ADMISSION_HANDOFF_SPEC_VERSION =
  'attestor.crypto-wallet-rpc-admission-handoff.v1';

export const WALLET_RPC_ADMISSION_METHODS = [
  'wallet_getCapabilities',
  'wallet_sendCalls',
  'wallet_getCallsStatus',
  'wallet_showCallsStatus',
  'wallet_requestExecutionPermissions',
  'wallet_revokeExecutionPermission',
  'wallet_getSupportedExecutionPermissions',
  'wallet_getGrantedExecutionPermissions',
] as const;
export type WalletRpcAdmissionMethod =
  typeof WALLET_RPC_ADMISSION_METHODS[number];

export const WALLET_RPC_ADMISSION_HANDOFF_OUTCOMES = [
  'ready',
  'needs-wallet-evidence',
  'blocked',
] as const;
export type WalletRpcAdmissionHandoffOutcome =
  typeof WALLET_RPC_ADMISSION_HANDOFF_OUTCOMES[number];

export const WALLET_RPC_ADMISSION_ERC7902_CAPABILITIES = [
  'eip7702Auth',
  'staticPaymasterConfiguration',
  'validityTimeRange',
  'multiDimensionalNonce',
  'accountAbstractionGasParamsOverride',
] as const;
export type WalletRpcAdmissionErc7902Capability =
  typeof WALLET_RPC_ADMISSION_ERC7902_CAPABILITIES[number];

export type WalletRpcCapability = Readonly<Record<string, CanonicalReleaseJsonValue>>;
export type WalletRpcCapabilitiesByChain = Readonly<
  Record<string, Readonly<Record<string, CanonicalReleaseJsonValue>>>
>;

export const WALLET_RPC_CAPABILITY_SUPPORT_STATUSES = [
  'supported',
  'ready',
  'unsupported',
  'missing',
  'unknown',
] as const;
export type WalletRpcCapabilitySupportStatus =
  typeof WALLET_RPC_CAPABILITY_SUPPORT_STATUSES[number];

export interface WalletRpcAdmissionCallInput {
  readonly to?: string | null;
  readonly data?: string | null;
  readonly value?: string | null;
  readonly capabilities?: Readonly<Record<string, WalletRpcCapability>> | null;
}

export interface WalletRpcAdmissionCall {
  readonly to?: string;
  readonly data?: string;
  readonly value?: string;
  readonly capabilities?: Readonly<Record<string, WalletRpcCapability>>;
}

export interface WalletRpcExecutionPermission {
  readonly type: string;
  readonly isAdjustmentAllowed: boolean;
  readonly data: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface WalletRpcExecutionRule {
  readonly type: string;
  readonly data: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface WalletRpcExecutionPermissionRequestInput {
  readonly chainIdHex?: string | null;
  readonly from?: string | null;
  readonly to: string;
  readonly permission: WalletRpcExecutionPermission;
  readonly rules?: readonly WalletRpcExecutionRule[] | null;
}

export interface WalletRpcExecutionPermissionRequest {
  readonly chainId: string;
  readonly from?: string;
  readonly to: string;
  readonly permission: WalletRpcExecutionPermission;
  readonly rules?: readonly WalletRpcExecutionRule[];
}

export type WalletRpcSupportedExecutionPermissions = Readonly<
  Record<
    string,
    {
      readonly chainIds: readonly string[];
      readonly ruleTypes: readonly string[];
    }
  >
>;

export interface WalletRpcSendCallsParams {
  readonly version: '2.0.0';
  readonly id: string;
  readonly from: string;
  readonly chainId: string;
  readonly atomicRequired: boolean;
  readonly calls: readonly WalletRpcAdmissionCall[];
  readonly capabilities?: Readonly<Record<string, WalletRpcCapability>>;
}

export interface WalletRpcJsonRpcRequest<TParams> {
  readonly method: WalletRpcAdmissionMethod;
  readonly params: TParams;
}

export interface WalletRpcCapabilityExpectation {
  readonly capability: string;
  readonly standard: 'EIP-5792' | 'ERC-7902' | 'Attestor';
  readonly required: boolean;
  readonly observedStatus: WalletRpcCapabilitySupportStatus;
  readonly reasonCode: string;
}

export interface WalletRpcPermissionExpectation {
  readonly permissionType: string;
  readonly chainId: string;
  readonly ruleTypes: readonly string[];
  readonly observedStatus: WalletRpcCapabilitySupportStatus;
  readonly reasonCode: string;
}

export interface CreateWalletRpcAdmissionHandoffInput {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly createdAt: string;
  readonly handoffId?: string | null;
  readonly requestId?: string | null;
  readonly dappDomain?: string | null;
  readonly from?: string | null;
  readonly chainIdHex?: string | null;
  readonly calls?: readonly WalletRpcAdmissionCallInput[] | null;
  readonly atomicRequired?: boolean;
  readonly capabilities?: Readonly<Record<string, WalletRpcCapability>> | null;
  readonly walletCapabilities?: WalletRpcCapabilitiesByChain | null;
  readonly requestedPermissions?:
    | readonly WalletRpcExecutionPermissionRequestInput[]
    | null;
  readonly supportedExecutionPermissions?: WalletRpcSupportedExecutionPermissions | null;
}

export interface WalletRpcAdmissionHandoff {
  readonly version: typeof WALLET_RPC_ADMISSION_HANDOFF_SPEC_VERSION;
  readonly handoffId: string;
  readonly createdAt: string;
  readonly outcome: WalletRpcAdmissionHandoffOutcome;
  readonly planOutcome: CryptoExecutionAdmissionOutcome;
  readonly planId: string;
  readonly planDigest: string;
  readonly simulationId: string;
  readonly chainId: string;
  readonly chainIdHex: string;
  readonly from: string;
  readonly dappDomain: string | null;
  readonly methods: readonly WalletRpcAdmissionMethod[];
  readonly capabilityDiscoveryRequest: WalletRpcJsonRpcRequest<
    readonly [string, readonly string[]]
  >;
  readonly sendCallsRequest: WalletRpcJsonRpcRequest<
    readonly [WalletRpcSendCallsParams]
  > | null;
  readonly permissionRequest: WalletRpcJsonRpcRequest<
    readonly [readonly WalletRpcExecutionPermissionRequest[]]
  > | null;
  readonly supportedExecutionPermissionsRequest: WalletRpcJsonRpcRequest<
    readonly []
  > | null;
  readonly attestorSidecar: Readonly<Record<string, CanonicalReleaseJsonValue>>;
  readonly capabilityExpectations: readonly WalletRpcCapabilityExpectation[];
  readonly permissionExpectations: readonly WalletRpcPermissionExpectation[];
  readonly blockingReasons: readonly string[];
  readonly nextActions: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface WalletRpcAdmissionDescriptor {
  readonly version: typeof WALLET_RPC_ADMISSION_HANDOFF_SPEC_VERSION;
  readonly methods: typeof WALLET_RPC_ADMISSION_METHODS;
  readonly outcomes: typeof WALLET_RPC_ADMISSION_HANDOFF_OUTCOMES;
  readonly erc7902Capabilities: typeof WALLET_RPC_ADMISSION_ERC7902_CAPABILITIES;
  readonly standards: readonly string[];
}
