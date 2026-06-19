import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  EIP7702_AUTHORIZATION_MAGIC,
  EIP7702_DELEGATION_INDICATOR_PREFIX,
  EIP7702_SET_CODE_TX_TYPE,
  type Eip7702AccountCodeState,
  type Eip7702AccountStateEvidence,
  type Eip7702AuthorizationTupleEvidence,
  type Eip7702DelegateCodeEvidence,
  type Eip7702DelegationPreflight,
  type Eip7702ExecutionEvidence,
  type Eip7702ExecutionPath,
  type Eip7702InitializationEvidence,
  type Eip7702RecoveryEvidence,
  type Eip7702SponsorEvidence,
} from '../crypto-authorization-core/eip7702-delegation-adapter.js';
import type { CryptoExecutionAdmissionPlan } from './index.js';

/**
 * Delegated EOA admission handoffs bind EIP-7702 authorization-tuple evidence,
 * delegate-code posture, nonce posture, and path-specific wallet/runtime checks
 * into a deterministic object that a delegated-EOA integration can honor before
 * any value-moving execution is submitted.
 */

export const DELEGATED_EOA_ADMISSION_HANDOFF_SPEC_VERSION =
  'attestor.crypto-delegated-eoa-admission-handoff.v1';

export const DELEGATED_EOA_ADMISSION_OUTCOMES = [
  'ready',
  'needs-runtime-evidence',
  'blocked',
] as const;
export type DelegatedEoaAdmissionOutcome =
  typeof DELEGATED_EOA_ADMISSION_OUTCOMES[number];

export const DELEGATED_EOA_ADMISSION_EXPECTATION_KINDS = [
  'plan-surface',
  'adapter-preflight',
  'authorization-tuple',
  'authority-nonce',
  'delegate-code',
  'account-code-state',
  'execution-path',
  'wallet-capability',
  'initialization',
  'sponsorship',
  'recovery',
  'post-execution',
] as const;
export type DelegatedEoaAdmissionExpectationKind =
  typeof DELEGATED_EOA_ADMISSION_EXPECTATION_KINDS[number];

export const DELEGATED_EOA_ADMISSION_EXPECTATION_STATUSES = [
  'satisfied',
  'missing',
  'unsupported',
  'failed',
] as const;
export type DelegatedEoaAdmissionExpectationStatus =
  typeof DELEGATED_EOA_ADMISSION_EXPECTATION_STATUSES[number];

export interface DelegatedEoaRuntimeObservation {
  readonly observedAt: string;
  readonly txHash?: string | null;
  readonly success: boolean;
  readonly receiptStatus?: string | null;
  readonly codeState?: Eip7702AccountCodeState | null;
  readonly delegationAddress?: string | null;
  readonly nonce?: string | null;
}

export interface DelegatedEoaWalletCapabilityStatus {
  readonly required: boolean;
  readonly observed: boolean | null;
  readonly supported: boolean | null;
  readonly requested: boolean | null;
  readonly atomicRequired: boolean | null;
}

export interface DelegatedEoaRuntimeCheck {
  readonly standard:
    | 'EIP-7702'
    | 'EIP-5792'
    | 'ERC-7902'
    | 'ERC-4337'
    | 'ERC-7769'
    | 'Attestor';
  readonly check: string;
  readonly reason: string;
}

export interface DelegatedEoaAdmissionExpectation {
  readonly kind: DelegatedEoaAdmissionExpectationKind;
  readonly status: DelegatedEoaAdmissionExpectationStatus;
  readonly reasonCode: string;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CreateDelegatedEoaAdmissionHandoffInput {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: Eip7702DelegationPreflight;
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly accountState: Eip7702AccountStateEvidence;
  readonly delegateCode: Eip7702DelegateCodeEvidence;
  readonly execution: Eip7702ExecutionEvidence;
  readonly initialization: Eip7702InitializationEvidence;
  readonly sponsor: Eip7702SponsorEvidence;
  readonly recovery: Eip7702RecoveryEvidence;
  readonly createdAt: string;
  readonly handoffId?: string | null;
  readonly runtimeId?: string | null;
  readonly walletProviderId?: string | null;
  readonly runtimeObservation?: DelegatedEoaRuntimeObservation | null;
  readonly operatorNote?: string | null;
}

export interface DelegatedEoaAdmissionHandoff {
  readonly version: typeof DELEGATED_EOA_ADMISSION_HANDOFF_SPEC_VERSION;
  readonly handoffId: string;
  readonly createdAt: string;
  readonly outcome: DelegatedEoaAdmissionOutcome;
  readonly planId: string;
  readonly planDigest: string;
  readonly simulationId: string;
  readonly preflightId: string;
  readonly preflightDigest: string;
  readonly authorityAddress: string;
  readonly delegationAddress: string;
  readonly chainId: string;
  readonly chainIdHex: string;
  readonly authorizationNonce: string;
  readonly executionPath: Eip7702ExecutionPath;
  readonly target: string;
  readonly functionSelector: string | null;
  readonly setCodeTransactionType: typeof EIP7702_SET_CODE_TX_TYPE;
  readonly authorizationMagic: typeof EIP7702_AUTHORIZATION_MAGIC;
  readonly delegationIndicatorPrefix: typeof EIP7702_DELEGATION_INDICATOR_PREFIX;
  readonly runtimeId: string | null;
  readonly walletProviderId: string | null;
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly accountState: Eip7702AccountStateEvidence;
  readonly delegateCode: Eip7702DelegateCodeEvidence;
  readonly execution: Eip7702ExecutionEvidence;
  readonly walletCapability: DelegatedEoaWalletCapabilityStatus | null;
  readonly initialization: Eip7702InitializationEvidence;
  readonly sponsor: Eip7702SponsorEvidence;
  readonly recovery: Eip7702RecoveryEvidence;
  readonly runtimeChecks: readonly DelegatedEoaRuntimeCheck[];
  readonly runtimeObservation: DelegatedEoaRuntimeObservation | null;
  readonly attestorSidecar: Readonly<Record<string, CanonicalReleaseJsonValue>>;
  readonly expectations: readonly DelegatedEoaAdmissionExpectation[];
  readonly blockingReasons: readonly string[];
  readonly nextActions: readonly string[];
  readonly operatorNote: string | null;
  readonly canonical: string;
  readonly digest: string;
}

export interface DelegatedEoaAdmissionDescriptor {
  readonly version: typeof DELEGATED_EOA_ADMISSION_HANDOFF_SPEC_VERSION;
  readonly outcomes: typeof DELEGATED_EOA_ADMISSION_OUTCOMES;
  readonly expectationKinds: typeof DELEGATED_EOA_ADMISSION_EXPECTATION_KINDS;
  readonly expectationStatuses: typeof DELEGATED_EOA_ADMISSION_EXPECTATION_STATUSES;
  readonly standards: readonly string[];
  readonly runtimeChecks: readonly string[];
}
