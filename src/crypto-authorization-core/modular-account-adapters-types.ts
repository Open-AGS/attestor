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
import type {
  CryptoAccountKind,
  CryptoExecutionAdapterKind,
} from './types.js';

/**
 * ERC-7579 and ERC-6900 modular account adapters.
 *
 * Step 16 keeps module/plugin semantics outside the core authorization object
 * model while still making validator, executor, hook, fallback, manifest, and
 * runtime-validation evidence first-class before modular account execution.
 */

export const MODULAR_ACCOUNT_ADAPTER_SPEC_VERSION =
  'attestor.crypto-modular-account-adapters.v1';

export const MODULAR_ACCOUNT_ADAPTER_KINDS = [
  'erc-7579-module',
  'erc-6900-plugin',
] as const satisfies readonly CryptoExecutionAdapterKind[];
export type ModularAccountAdapterKind =
  typeof MODULAR_ACCOUNT_ADAPTER_KINDS[number];

export const MODULAR_ACCOUNT_STANDARDS = [
  'erc-7579',
  'erc-6900',
] as const;
export type ModularAccountStandard =
  typeof MODULAR_ACCOUNT_STANDARDS[number];

export const MODULAR_ACCOUNT_MODULE_KINDS = [
  'validator',
  'executor',
  'hook',
  'fallback-handler',
  'plugin',
] as const;
export type ModularAccountModuleKind =
  typeof MODULAR_ACCOUNT_MODULE_KINDS[number];

export const MODULAR_ACCOUNT_EXECUTION_CALL_TYPES = [
  'single-call',
  'batch-call',
  'staticcall',
  'delegatecall',
] as const;
export type ModularAccountExecutionCallType =
  typeof MODULAR_ACCOUNT_EXECUTION_CALL_TYPES[number];

export const MODULAR_ACCOUNT_EXECUTION_TYPES = [
  'revert-on-failure',
  'try-execute',
] as const;
export type ModularAccountExecutionType =
  typeof MODULAR_ACCOUNT_EXECUTION_TYPES[number];

export const MODULAR_ACCOUNT_VALIDATION_FUNCTIONS = [
  'validateUserOp',
  'isValidSignatureWithSender',
  'runtime-validation',
  'global-validation',
  'plugin-userop-validation',
] as const;
export type ModularAccountValidationFunction =
  typeof MODULAR_ACCOUNT_VALIDATION_FUNCTIONS[number];

export const MODULAR_ACCOUNT_EXECUTION_FUNCTIONS = [
  'execute',
  'executeFromExecutor',
  'executeUserOp',
  'executeWithRuntimeValidation',
  'executeFromPlugin',
] as const;
export type ModularAccountExecutionFunction =
  typeof MODULAR_ACCOUNT_EXECUTION_FUNCTIONS[number];

export const MODULAR_ACCOUNT_OUTCOMES = [
  'allow',
  'review-required',
  'block',
] as const;
export type ModularAccountOutcome =
  typeof MODULAR_ACCOUNT_OUTCOMES[number];

export const MODULAR_ACCOUNT_OBSERVATION_STATUSES = [
  'pass',
  'warn',
  'fail',
] as const;
export type ModularAccountObservationStatus =
  typeof MODULAR_ACCOUNT_OBSERVATION_STATUSES[number];

export const MODULAR_ACCOUNT_CHECKS = [
  'modular-adapter-kind',
  'modular-account-kind-supported',
  'modular-account-matches-intent',
  'modular-chain-matches-intent',
  'modular-account-implementation-bound',
  'modular-module-installed',
  'modular-module-allowlist-evidence',
  'modular-module-type-supported',
  'modular-execution-mode-supported',
  'modular-target-matches-intent',
  'modular-function-selector-matches-intent',
  'modular-calldata-class-matches-intent',
  'modular-native-value-posture',
  'modular-nonce-matches-intent',
  'modular-validation-function-bound',
  'modular-execution-function-bound',
  'modular-runtime-validation-passed',
  'modular-hooks-passed',
  'modular-delegatecall-posture',
  'modular-installation-authorized',
  'modular-plugin-manifest-bound',
  'modular-fallback-sender-forwarding',
  'modular-release-binding-ready',
  'modular-policy-binding-ready',
  'modular-enforcement-binding-ready',
  'modular-operation-hash-bound',
  'modular-recovery-posture-ready',
  'modular-post-execution-status',
] as const;
export type ModularAccountCheck = typeof MODULAR_ACCOUNT_CHECKS[number];

export interface ModularAccountAdapterProfile {
  readonly adapterKind: ModularAccountAdapterKind;
  readonly standard: ModularAccountStandard;
  readonly accountKind: CryptoAccountKind;
  readonly requiredModuleKinds: readonly ModularAccountModuleKind[];
  readonly standards: readonly string[];
  readonly notes: string;
}

export interface ModularAccountExecutionMode {
  readonly encodedMode: string;
  readonly callType: ModularAccountExecutionCallType;
  readonly executionType: ModularAccountExecutionType;
  readonly modeSelector?: string | null;
  readonly modePayload?: string | null;
}

export interface ModularAccountInstallAuthorization {
  readonly authorized: boolean;
  readonly eventObserved: boolean;
  readonly installedBy?: string | null;
  readonly installedAt?: string | null;
  readonly initDataHash?: string | null;
}

export interface ModularAccountRecoveryPosture {
  readonly moduleCanBeUninstalled: boolean;
  readonly hookCanBeDisabled: boolean;
  readonly emergencyExecutionPrepared: boolean;
  readonly recoveryAuthorityRef?: string | null;
  readonly recoveryDelaySeconds?: number | null;
}

export interface ModularAccountModuleState {
  readonly moduleStandard: ModularAccountStandard;
  readonly observedAt: string;
  readonly accountAddress: string;
  readonly chainId: string;
  readonly accountImplementationId: string;
  readonly moduleAddress: string;
  readonly moduleKind: ModularAccountModuleKind;
  readonly moduleTypeId?: string | null;
  readonly moduleId?: string | null;
  readonly moduleVersion?: string | null;
  readonly moduleInstalled: boolean;
  readonly moduleAllowlisted?: boolean | null;
  readonly moduleAllowlistDigest?: string | null;
  readonly moduleAuditEvidenceRef?: string | null;
  readonly accountSupportsExecutionMode: boolean;
  readonly accountSupportsModuleType: boolean;
  readonly moduleTypeMatches: boolean;
  readonly installAuthorization: ModularAccountInstallAuthorization;
  readonly recovery: ModularAccountRecoveryPosture;
}

export interface ModularAccountValidationContext {
  readonly validatorAddress?: string | null;
  readonly validationFunction: ModularAccountValidationFunction;
  readonly validationFunctionAuthorized: boolean;
  readonly signatureSelectionSanitized?: boolean | null;
  readonly userOperationValidationPassed?: boolean | null;
  readonly signatureValidationPassed?: boolean | null;
  readonly runtimeValidationPassed: boolean;
  readonly validationDataBound: boolean;
  readonly globalValidationAllowed?: boolean | null;
  readonly selectorPermissionBound?: boolean | null;
}

export interface ModularAccountExecutionContext {
  readonly operationHash: string;
  readonly nonce: string;
  readonly target: string;
  readonly value: string;
  readonly data: string;
  readonly functionSelector?: string | null;
  readonly calldataClass?: string | null;
  readonly batchCallCount?: number | null;
  readonly executionMode: ModularAccountExecutionMode;
  readonly executorAddress?: string | null;
  readonly executionFunction: ModularAccountExecutionFunction;
  readonly executionFunctionAuthorized: boolean;
  readonly delegateCallAllowed?: boolean | null;
  readonly postExecutionSuccess?: boolean | null;
}

export interface ModularAccountHookContext {
  readonly hooksRequired: boolean;
  readonly hookAddress?: string | null;
  readonly preCheckPassed?: boolean | null;
  readonly postCheckPassed?: boolean | null;
  readonly hookDataHash?: string | null;
  readonly selectorRoutingPassed?: boolean | null;
  readonly fallbackUsesErc2771?: boolean | null;
}

export interface ModularAccountPluginManifest {
  readonly manifestHash?: string | null;
  readonly manifestApproved?: boolean | null;
  readonly permittedSelectors?: readonly string[] | null;
  readonly executionFunctionSelector?: string | null;
  readonly validationFunctionSelector?: string | null;
  readonly dependenciesApproved?: boolean | null;
}

export interface ModularAccountObservation {
  readonly check: ModularAccountCheck;
  readonly status: ModularAccountObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required: boolean;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CreateModularAccountAdapterPreflightInput {
  readonly intent: CryptoAuthorizationIntent;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly moduleState: ModularAccountModuleState;
  readonly validation: ModularAccountValidationContext;
  readonly execution: ModularAccountExecutionContext;
  readonly hooks: ModularAccountHookContext;
  readonly pluginManifest?: ModularAccountPluginManifest | null;
  readonly preflightId?: string | null;
}

export interface ModularAccountAdapterPreflight {
  readonly version: typeof MODULAR_ACCOUNT_ADAPTER_SPEC_VERSION;
  readonly preflightId: string;
  readonly adapterKind: ModularAccountAdapterKind;
  readonly moduleStandard: ModularAccountStandard;
  readonly checkedAt: string;
  readonly accountAddress: string;
  readonly moduleAddress: string;
  readonly moduleKind: ModularAccountModuleKind;
  readonly operationHash: string;
  readonly executionFunction: ModularAccountExecutionFunction;
  readonly validationFunction: ModularAccountValidationFunction;
  readonly chainId: string;
  readonly target: string;
  readonly functionSelector: string | null;
  readonly nonce: string;
  readonly outcome: ModularAccountOutcome;
  readonly signal: CryptoSimulationPreflightSignal;
  readonly observations: readonly ModularAccountObservation[];
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ModularAccountAdapterSimulationResult {
  readonly preflight: ModularAccountAdapterPreflight;
  readonly simulation: CryptoAuthorizationSimulationResult;
}

export interface ModularAccountAdaptersDescriptor {
  readonly version: typeof MODULAR_ACCOUNT_ADAPTER_SPEC_VERSION;
  readonly adapterKinds: typeof MODULAR_ACCOUNT_ADAPTER_KINDS;
  readonly standards: typeof MODULAR_ACCOUNT_STANDARDS;
  readonly moduleKinds: typeof MODULAR_ACCOUNT_MODULE_KINDS;
  readonly callTypes: typeof MODULAR_ACCOUNT_EXECUTION_CALL_TYPES;
  readonly executionTypes: typeof MODULAR_ACCOUNT_EXECUTION_TYPES;
  readonly validationFunctions: typeof MODULAR_ACCOUNT_VALIDATION_FUNCTIONS;
  readonly executionFunctions: typeof MODULAR_ACCOUNT_EXECUTION_FUNCTIONS;
  readonly outcomes: typeof MODULAR_ACCOUNT_OUTCOMES;
  readonly checks: typeof MODULAR_ACCOUNT_CHECKS;
  readonly profiles: Readonly<Record<ModularAccountAdapterKind, ModularAccountAdapterProfile>>;
  readonly references: readonly string[];
}

export const MODULAR_ACCOUNT_ADAPTER_PROFILES: Readonly<
  Record<ModularAccountAdapterKind, ModularAccountAdapterProfile>
> = Object.freeze({
  'erc-7579-module': Object.freeze({
    adapterKind: 'erc-7579-module',
    standard: 'erc-7579',
    accountKind: 'erc-7579-modular-account',
    requiredModuleKinds: Object.freeze([
      'validator',
      'executor',
      'hook',
      'fallback-handler',
    ] as const),
    standards: Object.freeze([
      'ERC-7579',
      'IERC7579Execution',
      'executeFromExecutor',
      'supportsExecutionMode',
      'supportsModule',
      'isModuleInstalled',
      'IERC7579Validator',
      'IERC7579Hook',
      'ERC-1271-forwarding',
    ]),
    notes:
      'ERC-7579 module execution requires installed module evidence, module type support, execution mode support, validator/executor/hook readiness, and sender-forwarding posture for fallback handlers.',
  }),
  'erc-6900-plugin': Object.freeze({
    adapterKind: 'erc-6900-plugin',
    standard: 'erc-6900',
    accountKind: 'erc-6900-modular-account',
    requiredModuleKinds: Object.freeze(['plugin'] as const),
    standards: Object.freeze([
      'ERC-6900',
      'plugin-manifest',
      'runtime-validation',
      'user-operation-validation',
      'execution-functions',
      'validation-hooks',
      'execution-hooks',
      'global-validation',
    ]),
    notes:
      'ERC-6900 plugin execution requires an approved plugin manifest, selector-scoped execution and validation functions, runtime validation, hook readiness, and dependency posture.',
  }),
});
