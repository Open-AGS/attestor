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

export const SAFE_TRANSACTION_GUARD_ADAPTER_SPEC_VERSION =
  'attestor.crypto-safe-transaction-guard-adapter.v1';

export const SAFE_TRANSACTION_GUARD_HOOK_PHASES = [
  'check-transaction',
  'check-after-execution',
] as const;
export type SafeTransactionGuardHookPhase =
  typeof SAFE_TRANSACTION_GUARD_HOOK_PHASES[number];

export const SAFE_TRANSACTION_OPERATION_TYPES = [
  'call',
  'delegatecall',
] as const;
export type SafeTransactionOperationType =
  typeof SAFE_TRANSACTION_OPERATION_TYPES[number];

export const SAFE_TRANSACTION_GUARD_OUTCOMES = [
  'allow',
  'review-required',
  'block',
] as const;
export type SafeTransactionGuardOutcome =
  typeof SAFE_TRANSACTION_GUARD_OUTCOMES[number];

export const SAFE_TRANSACTION_GUARD_OBSERVATION_STATUSES = [
  'pass',
  'warn',
  'fail',
] as const;
export type SafeTransactionGuardObservationStatus =
  typeof SAFE_TRANSACTION_GUARD_OBSERVATION_STATUSES[number];

export const SAFE_TRANSACTION_GUARD_CHECKS = [
  'safe-adapter-kind-is-ordinary-guard',
  'safe-account-matches-intent',
  'safe-chain-matches-intent',
  'safe-operation-is-call',
  'safe-target-matches-intent',
  'safe-function-selector-matches-intent',
  'safe-native-value-posture',
  'safe-nonce-matches-intent',
  'safe-release-binding-ready',
  'safe-policy-binding-ready',
  'safe-enforcement-binding-ready',
  'safe-transaction-hash-bound',
  'safe-post-execution-status',
] as const;
export type SafeTransactionGuardCheck =
  typeof SAFE_TRANSACTION_GUARD_CHECKS[number];

export interface SafeTransactionGuardHookContext {
  readonly phase: SafeTransactionGuardHookPhase;
  readonly checkedAt: string;
  readonly guardAddress: string;
  readonly safeVersion?: string | null;
  readonly executionSuccess?: boolean | null;
}

export interface SafeTransactionGuardTransaction {
  readonly safeAddress: string;
  readonly chainId: string;
  readonly to: string;
  readonly value: string;
  readonly data: string;
  readonly operation: SafeTransactionOperationType;
  readonly safeTxGas?: string | null;
  readonly baseGas?: string | null;
  readonly gasPrice?: string | null;
  readonly gasToken?: string | null;
  readonly refundReceiver?: string | null;
  readonly signaturesHash?: string | null;
  readonly msgSender?: string | null;
  readonly safeTxHash: string;
  readonly nonce: string;
}

export interface SafeTransactionGuardObservation {
  readonly check: SafeTransactionGuardCheck;
  readonly status: SafeTransactionGuardObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required: boolean;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CreateSafeTransactionGuardPreflightInput {
  readonly intent: CryptoAuthorizationIntent;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly transaction: SafeTransactionGuardTransaction;
  readonly hook: SafeTransactionGuardHookContext;
  readonly preflightId?: string | null;
}

export interface SafeTransactionGuardPreflight {
  readonly version: typeof SAFE_TRANSACTION_GUARD_ADAPTER_SPEC_VERSION;
  readonly preflightId: string;
  readonly adapterKind: 'safe-guard';
  readonly hookPhase: SafeTransactionGuardHookPhase;
  readonly checkedAt: string;
  readonly guardAddress: string;
  readonly safeAddress: string;
  readonly safeTxHash: string;
  readonly operation: SafeTransactionOperationType;
  readonly chainId: string;
  readonly to: string;
  readonly functionSelector: string | null;
  readonly nonce: string;
  readonly outcome: SafeTransactionGuardOutcome;
  readonly signal: CryptoSimulationPreflightSignal;
  readonly observations: readonly SafeTransactionGuardObservation[];
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface SafeTransactionGuardSimulationResult {
  readonly preflight: SafeTransactionGuardPreflight;
  readonly simulation: CryptoAuthorizationSimulationResult;
}

export interface SafeTransactionGuardAdapterDescriptor {
  readonly version: typeof SAFE_TRANSACTION_GUARD_ADAPTER_SPEC_VERSION;
  readonly hookPhases: typeof SAFE_TRANSACTION_GUARD_HOOK_PHASES;
  readonly operationTypes: typeof SAFE_TRANSACTION_OPERATION_TYPES;
  readonly outcomes: typeof SAFE_TRANSACTION_GUARD_OUTCOMES;
  readonly checks: typeof SAFE_TRANSACTION_GUARD_CHECKS;
  readonly standards: readonly string[];
}
