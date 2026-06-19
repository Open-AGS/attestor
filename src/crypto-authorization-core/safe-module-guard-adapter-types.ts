import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CryptoAuthorizationSimulationResult,
  CryptoSimulationPreflightSignal,
} from './authorization-simulation.js';
import type {
  CryptoConsequenceRiskAssessment,
} from './consequence-risk-mapping.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import type {
  CryptoAuthorizationIntent,
} from './object-model.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';

/**
 * Shared contract surface for the Safe module guard adapter.
 *
 * The runtime adapter keeps behavior in safe-module-guard-adapter.ts while
 * this file carries public constants and data-shape types used by tests and
 * downstream crypto execution admission wiring.
 */

export const SAFE_MODULE_GUARD_ADAPTER_SPEC_VERSION =
  'attestor.crypto-safe-module-guard-adapter.v1';

export const SAFE_MODULE_GUARD_HOOK_PHASES = [
  'check-module-transaction',
  'check-after-module-execution',
] as const;
export type SafeModuleGuardHookPhase =
  typeof SAFE_MODULE_GUARD_HOOK_PHASES[number];

export const SAFE_MODULE_OPERATION_TYPES = [
  'call',
  'delegatecall',
] as const;
export type SafeModuleOperationType = typeof SAFE_MODULE_OPERATION_TYPES[number];

export const SAFE_MODULE_GUARD_OUTCOMES = [
  'allow',
  'review-required',
  'block',
] as const;
export type SafeModuleGuardOutcome =
  typeof SAFE_MODULE_GUARD_OUTCOMES[number];

export const SAFE_MODULE_GUARD_OBSERVATION_STATUSES = [
  'pass',
  'warn',
  'fail',
] as const;
export type SafeModuleGuardObservationStatus =
  typeof SAFE_MODULE_GUARD_OBSERVATION_STATUSES[number];

export const SAFE_MODULE_GUARD_CHECKS = [
  'safe-module-adapter-kind-is-module-guard',
  'safe-module-account-matches-intent',
  'safe-module-chain-matches-intent',
  'safe-module-is-enabled',
  'safe-module-guard-is-installed',
  'safe-module-operation-is-call',
  'safe-module-target-matches-intent',
  'safe-module-function-selector-matches-intent',
  'safe-module-native-value-posture',
  'safe-module-nonce-matches-intent',
  'safe-module-release-binding-ready',
  'safe-module-policy-binding-ready',
  'safe-module-enforcement-binding-ready',
  'safe-module-transaction-hash-bound',
  'safe-module-recovery-posture-ready',
  'safe-module-post-execution-status',
] as const;
export type SafeModuleGuardCheck = typeof SAFE_MODULE_GUARD_CHECKS[number];

export interface SafeModuleGuardHookContext {
  readonly phase: SafeModuleGuardHookPhase;
  readonly checkedAt: string;
  readonly moduleGuardAddress: string;
  readonly safeVersion?: string | null;
  readonly executionSuccess?: boolean | null;
}

export interface SafeModuleGuardRecoveryPosture {
  readonly moduleCanBeDisabledByOwners: boolean;
  readonly guardCanBeRemovedByOwners: boolean;
  readonly emergencySafeTxPrepared: boolean;
  readonly recoveryAuthorityRef?: string | null;
  readonly recoveryDelaySeconds?: number | null;
}

export interface SafeModuleGuardTransaction {
  readonly safeAddress: string;
  readonly chainId: string;
  readonly moduleAddress: string;
  readonly moduleEnabled: boolean;
  readonly moduleGuardInstalled: boolean;
  readonly moduleKind?: string | null;
  readonly modulePolicyRef?: string | null;
  readonly to: string;
  readonly value: string;
  readonly data: string;
  readonly operation: SafeModuleOperationType;
  readonly delegateCallAllowed?: boolean;
  readonly moduleTxHash: string;
  readonly moduleNonce: string;
  readonly executor?: string | null;
  readonly returnDataHash?: string | null;
}

export interface SafeModuleGuardObservation {
  readonly check: SafeModuleGuardCheck;
  readonly status: SafeModuleGuardObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required: boolean;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CreateSafeModuleGuardPreflightInput {
  readonly intent: CryptoAuthorizationIntent;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly transaction: SafeModuleGuardTransaction;
  readonly hook: SafeModuleGuardHookContext;
  readonly recovery: SafeModuleGuardRecoveryPosture;
  readonly preflightId?: string | null;
}

export interface SafeModuleGuardPreflight {
  readonly version: typeof SAFE_MODULE_GUARD_ADAPTER_SPEC_VERSION;
  readonly preflightId: string;
  readonly adapterKind: 'safe-module-guard';
  readonly hookPhase: SafeModuleGuardHookPhase;
  readonly checkedAt: string;
  readonly moduleGuardAddress: string;
  readonly safeAddress: string;
  readonly moduleAddress: string;
  readonly moduleTxHash: string;
  readonly operation: SafeModuleOperationType;
  readonly chainId: string;
  readonly to: string;
  readonly functionSelector: string | null;
  readonly moduleNonce: string;
  readonly outcome: SafeModuleGuardOutcome;
  readonly signals: readonly CryptoSimulationPreflightSignal[];
  readonly observations: readonly SafeModuleGuardObservation[];
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface SafeModuleGuardSimulationResult {
  readonly preflight: SafeModuleGuardPreflight;
  readonly simulation: CryptoAuthorizationSimulationResult;
}

export interface SafeModuleGuardAdapterDescriptor {
  readonly version: typeof SAFE_MODULE_GUARD_ADAPTER_SPEC_VERSION;
  readonly hookPhases: typeof SAFE_MODULE_GUARD_HOOK_PHASES;
  readonly operationTypes: typeof SAFE_MODULE_OPERATION_TYPES;
  readonly outcomes: typeof SAFE_MODULE_GUARD_OUTCOMES;
  readonly checks: typeof SAFE_MODULE_GUARD_CHECKS;
  readonly standards: readonly string[];
}
