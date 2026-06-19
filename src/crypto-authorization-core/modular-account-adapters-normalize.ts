import type {
  CryptoAuthorizationIntent,
} from './object-model.js';
import type {
  CreateModularAccountAdapterPreflightInput,
  ModularAccountAdapterKind,
  ModularAccountExecutionCallType,
  ModularAccountExecutionContext,
  ModularAccountExecutionFunction,
  ModularAccountExecutionMode,
  ModularAccountExecutionType,
  ModularAccountHookContext,
  ModularAccountModuleKind,
  ModularAccountModuleState,
  ModularAccountPluginManifest,
  ModularAccountStandard,
  ModularAccountValidationContext,
  ModularAccountValidationFunction,
} from './modular-account-adapters-types.js';
import {
  MODULAR_ACCOUNT_EXECUTION_CALL_TYPES,
  MODULAR_ACCOUNT_EXECUTION_FUNCTIONS,
  MODULAR_ACCOUNT_EXECUTION_TYPES,
  MODULAR_ACCOUNT_MODULE_KINDS,
  MODULAR_ACCOUNT_STANDARDS,
  MODULAR_ACCOUNT_VALIDATION_FUNCTIONS,
} from './modular-account-adapters-types.js';

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`Modular account adapter ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

export function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeIdentifier(value, fieldName);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Modular account adapter ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeOptionalIsoTimestamp(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeIsoTimestamp(value, fieldName);
}

function normalizeAddress(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
    throw new Error(`Modular account adapter ${fieldName} must be an EVM address.`);
  }
  return normalized.toLowerCase();
}

function normalizeOptionalAddress(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeAddress(value, fieldName);
}

function normalizeHash(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error(`Modular account adapter ${fieldName} must be a 32-byte hex value.`);
  }
  return normalized.toLowerCase();
}

function normalizeOptionalHash(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeHash(value, fieldName);
}

function normalizeSelector(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = normalizeIdentifier(value, fieldName).toLowerCase();
  if (!/^0x[a-f0-9]{8}$/.test(normalized)) {
    throw new Error(`Modular account adapter ${fieldName} must be a 4-byte selector.`);
  }
  return normalized;
}

function normalizeHexData(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^0x(?:[a-fA-F0-9]{2})*$/.test(normalized)) {
    throw new Error(`Modular account adapter ${fieldName} must be hex bytes.`);
  }
  return normalized.toLowerCase();
}

function normalizeOptionalHexData(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeHexData(value, fieldName);
}

function normalizeUintString(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^(?:0|[1-9]\d*)$/.test(normalized)) {
    throw new Error(`Modular account adapter ${fieldName} must be a non-negative integer string.`);
  }
  return normalized;
}

function normalizeOptionalBatchCallCount(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('Modular account adapter execution.batchCallCount must be a positive integer.');
  }
  return value;
}

function normalizeOptionalRecoveryDelay(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Modular account adapter recoveryDelaySeconds must be a non-negative integer.');
  }
  return value;
}

export function adapterKindFromIntent(intent: CryptoAuthorizationIntent): ModularAccountAdapterKind {
  if (
    intent.executionAdapterKind !== 'erc-7579-module' &&
    intent.executionAdapterKind !== 'erc-6900-plugin'
  ) {
    throw new Error('Modular account adapter requires intent execution adapter erc-7579-module or erc-6900-plugin.');
  }
  return intent.executionAdapterKind;
}

function standardFrom(input: ModularAccountStandard): ModularAccountStandard {
  if (!MODULAR_ACCOUNT_STANDARDS.includes(input)) {
    throw new Error(`Modular account adapter does not support module standard ${input}.`);
  }
  return input;
}

function moduleKindFrom(input: ModularAccountModuleKind): ModularAccountModuleKind {
  if (!MODULAR_ACCOUNT_MODULE_KINDS.includes(input)) {
    throw new Error(`Modular account adapter does not support module kind ${input}.`);
  }
  return input;
}

function callTypeFrom(input: ModularAccountExecutionCallType): ModularAccountExecutionCallType {
  if (!MODULAR_ACCOUNT_EXECUTION_CALL_TYPES.includes(input)) {
    throw new Error(`Modular account adapter does not support call type ${input}.`);
  }
  return input;
}

function executionTypeFrom(input: ModularAccountExecutionType): ModularAccountExecutionType {
  if (!MODULAR_ACCOUNT_EXECUTION_TYPES.includes(input)) {
    throw new Error(`Modular account adapter does not support execution type ${input}.`);
  }
  return input;
}

function validationFunctionFrom(
  input: ModularAccountValidationFunction,
): ModularAccountValidationFunction {
  if (!MODULAR_ACCOUNT_VALIDATION_FUNCTIONS.includes(input)) {
    throw new Error(`Modular account adapter does not support validation function ${input}.`);
  }
  return input;
}

function executionFunctionFrom(
  input: ModularAccountExecutionFunction,
): ModularAccountExecutionFunction {
  if (!MODULAR_ACCOUNT_EXECUTION_FUNCTIONS.includes(input)) {
    throw new Error(`Modular account adapter does not support execution function ${input}.`);
  }
  return input;
}

function normalizeExecutionMode(
  input: ModularAccountExecutionMode,
): ModularAccountExecutionMode {
  return Object.freeze({
    encodedMode: normalizeHash(input.encodedMode, 'execution.executionMode.encodedMode'),
    callType: callTypeFrom(input.callType),
    executionType: executionTypeFrom(input.executionType),
    modeSelector: normalizeSelector(input.modeSelector, 'execution.executionMode.modeSelector'),
    modePayload: normalizeOptionalHexData(input.modePayload, 'execution.executionMode.modePayload'),
  });
}

export function normalizedModuleState(input: ModularAccountModuleState): ModularAccountModuleState {
  return Object.freeze({
    moduleStandard: standardFrom(input.moduleStandard),
    observedAt: normalizeIsoTimestamp(input.observedAt, 'moduleState.observedAt'),
    accountAddress: normalizeAddress(input.accountAddress, 'moduleState.accountAddress'),
    chainId: normalizeIdentifier(input.chainId, 'moduleState.chainId'),
    accountImplementationId: normalizeIdentifier(
      input.accountImplementationId,
      'moduleState.accountImplementationId',
    ),
    moduleAddress: normalizeAddress(input.moduleAddress, 'moduleState.moduleAddress'),
    moduleKind: moduleKindFrom(input.moduleKind),
    moduleTypeId: normalizeOptionalIdentifier(input.moduleTypeId, 'moduleState.moduleTypeId'),
    moduleId: normalizeOptionalIdentifier(input.moduleId, 'moduleState.moduleId'),
    moduleVersion: normalizeOptionalIdentifier(input.moduleVersion, 'moduleState.moduleVersion'),
    moduleInstalled: input.moduleInstalled,
    moduleAllowlisted: input.moduleAllowlisted ?? false,
    moduleAllowlistDigest: normalizeOptionalHash(
      input.moduleAllowlistDigest,
      'moduleState.moduleAllowlistDigest',
    ),
    moduleAuditEvidenceRef: normalizeOptionalIdentifier(
      input.moduleAuditEvidenceRef,
      'moduleState.moduleAuditEvidenceRef',
    ),
    accountSupportsExecutionMode: input.accountSupportsExecutionMode,
    accountSupportsModuleType: input.accountSupportsModuleType,
    moduleTypeMatches: input.moduleTypeMatches,
    installAuthorization: Object.freeze({
      authorized: input.installAuthorization.authorized,
      eventObserved: input.installAuthorization.eventObserved,
      installedBy: normalizeOptionalAddress(
        input.installAuthorization.installedBy,
        'moduleState.installAuthorization.installedBy',
      ),
      installedAt: normalizeOptionalIsoTimestamp(
        input.installAuthorization.installedAt,
        'moduleState.installAuthorization.installedAt',
      ),
      initDataHash: normalizeOptionalHash(
        input.installAuthorization.initDataHash,
        'moduleState.installAuthorization.initDataHash',
      ),
    }),
    recovery: Object.freeze({
      moduleCanBeUninstalled: input.recovery.moduleCanBeUninstalled,
      hookCanBeDisabled: input.recovery.hookCanBeDisabled,
      emergencyExecutionPrepared: input.recovery.emergencyExecutionPrepared,
      recoveryAuthorityRef: normalizeOptionalIdentifier(
        input.recovery.recoveryAuthorityRef,
        'moduleState.recovery.recoveryAuthorityRef',
      ),
      recoveryDelaySeconds: normalizeOptionalRecoveryDelay(input.recovery.recoveryDelaySeconds),
    }),
  });
}

export function normalizedValidation(
  input: ModularAccountValidationContext,
): ModularAccountValidationContext {
  return Object.freeze({
    validatorAddress: normalizeOptionalAddress(input.validatorAddress, 'validation.validatorAddress'),
    validationFunction: validationFunctionFrom(input.validationFunction),
    validationFunctionAuthorized: input.validationFunctionAuthorized,
    signatureSelectionSanitized: input.signatureSelectionSanitized ?? null,
    userOperationValidationPassed: input.userOperationValidationPassed ?? null,
    signatureValidationPassed: input.signatureValidationPassed ?? null,
    runtimeValidationPassed: input.runtimeValidationPassed,
    validationDataBound: input.validationDataBound,
    globalValidationAllowed: input.globalValidationAllowed ?? null,
    selectorPermissionBound: input.selectorPermissionBound ?? null,
  });
}

export function normalizedExecution(
  input: ModularAccountExecutionContext,
): ModularAccountExecutionContext {
  return Object.freeze({
    operationHash: normalizeHash(input.operationHash, 'execution.operationHash'),
    nonce: normalizeUintString(input.nonce, 'execution.nonce'),
    target: normalizeAddress(input.target, 'execution.target'),
    value: normalizeUintString(input.value, 'execution.value'),
    data: normalizeHexData(input.data, 'execution.data'),
    functionSelector: normalizeSelector(input.functionSelector, 'execution.functionSelector'),
    calldataClass: normalizeOptionalIdentifier(input.calldataClass, 'execution.calldataClass'),
    batchCallCount: normalizeOptionalBatchCallCount(input.batchCallCount),
    executionMode: normalizeExecutionMode(input.executionMode),
    executorAddress: normalizeOptionalAddress(input.executorAddress, 'execution.executorAddress'),
    executionFunction: executionFunctionFrom(input.executionFunction),
    executionFunctionAuthorized: input.executionFunctionAuthorized,
    delegateCallAllowed: input.delegateCallAllowed ?? null,
    postExecutionSuccess: input.postExecutionSuccess ?? null,
  });
}

export function normalizedHooks(input: ModularAccountHookContext): ModularAccountHookContext {
  return Object.freeze({
    hooksRequired: input.hooksRequired,
    hookAddress: normalizeOptionalAddress(input.hookAddress, 'hooks.hookAddress'),
    preCheckPassed: input.preCheckPassed ?? null,
    postCheckPassed: input.postCheckPassed ?? null,
    hookDataHash: normalizeOptionalHash(input.hookDataHash, 'hooks.hookDataHash'),
    selectorRoutingPassed: input.selectorRoutingPassed ?? null,
    fallbackUsesErc2771: input.fallbackUsesErc2771 ?? null,
  });
}

export function normalizedPluginManifest(
  input: ModularAccountPluginManifest | null | undefined,
): ModularAccountPluginManifest | null {
  if (input === undefined || input === null) {
    return null;
  }
  return Object.freeze({
    manifestHash: normalizeOptionalHash(input.manifestHash, 'pluginManifest.manifestHash'),
    manifestApproved: input.manifestApproved ?? null,
    permittedSelectors: input.permittedSelectors
      ? Object.freeze(input.permittedSelectors.map((selector, index) =>
          normalizeSelector(selector, `pluginManifest.permittedSelectors.${index}`) ?? '0x00000000',
        ))
      : null,
    executionFunctionSelector: normalizeSelector(
      input.executionFunctionSelector,
      'pluginManifest.executionFunctionSelector',
    ),
    validationFunctionSelector: normalizeSelector(
      input.validationFunctionSelector,
      'pluginManifest.validationFunctionSelector',
    ),
    dependenciesApproved: input.dependenciesApproved ?? null,
  });
}

export function assertAdapterConsistency(input: CreateModularAccountAdapterPreflightInput): void {
  const adapterKind = adapterKindFromIntent(input.intent);
  if (input.riskAssessment.consequenceKind !== input.intent.consequenceKind) {
    throw new Error('Modular account adapter risk consequence does not match intent.');
  }
  if (input.releaseBinding.cryptoDecisionId !== input.policyScopeBinding.cryptoDecisionId) {
    throw new Error('Modular account adapter policy binding does not match release binding.');
  }
  if (input.releaseBinding.cryptoDecisionId !== input.enforcementBinding.cryptoDecisionId) {
    throw new Error('Modular account adapter enforcement binding does not match release binding.');
  }
  if (input.enforcementBinding.adapterKind !== adapterKind) {
    throw new Error(`Modular account adapter requires ${adapterKind} enforcement binding.`);
  }
  if (input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind !== 'action-dispatch') {
    throw new Error('Modular account adapter requires action-dispatch enforcement.');
  }
  if (!input.enforcementBinding.verificationProfile.failClosed) {
    throw new Error('Modular account adapter requires fail-closed enforcement verification.');
  }
}
