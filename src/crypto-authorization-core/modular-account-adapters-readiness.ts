import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import {
  MODULAR_ACCOUNT_ADAPTER_PROFILES,
  type ModularAccountAdapterKind,
  type ModularAccountExecutionContext,
  type ModularAccountHookContext,
  type ModularAccountModuleKind,
  type ModularAccountModuleState,
  type ModularAccountPluginManifest,
  type ModularAccountValidationContext,
} from './modular-account-adapters-types.js';

const ZERO_EVM_ADDRESS = '0x0000000000000000000000000000000000000000';

const ERC7579_MODULE_TYPE_IDS: Readonly<Record<ModularAccountModuleKind, string | null>> =
  Object.freeze({
    validator: '1',
    executor: '2',
    'fallback-handler': '3',
    hook: '4',
    plugin: null,
  });

export function caip2ChainId(intent: CryptoAuthorizationIntent): string {
  return `${intent.chain.namespace}:${intent.chain.chainId}`;
}

export function sameAddress(left: string, right: string | null | undefined): boolean {
  if (!right) {
    return false;
  }
  return left.toLowerCase() === right.toLowerCase();
}

export function nonceMatches(intentNonce: string, moduleNonce: string): boolean {
  return (
    intentNonce === moduleNonce ||
    intentNonce === `module:nonce:${moduleNonce}` ||
    intentNonce === `plugin:nonce:${moduleNonce}` ||
    intentNonce === `modular:nonce:${moduleNonce}` ||
    intentNonce.endsWith(`:${moduleNonce}`)
  );
}

export function selectorAllowedByManifest(input: {
  readonly manifest: ModularAccountPluginManifest | null;
  readonly selector: string | null;
}): boolean {
  if (input.manifest === null) {
    return false;
  }
  const selectors = input.manifest.permittedSelectors ?? [];
  return input.selector !== null && selectors.includes(input.selector);
}

export function moduleTypeMatchesProfile(input: {
  readonly adapterKind: ModularAccountAdapterKind;
  readonly moduleState: ModularAccountModuleState;
}): boolean {
  const profile = MODULAR_ACCOUNT_ADAPTER_PROFILES[input.adapterKind];
  if (!profile.requiredModuleKinds.includes(input.moduleState.moduleKind)) {
    return false;
  }
  if (profile.standard === 'erc-6900') {
    return input.moduleState.moduleKind === 'plugin' && input.moduleState.moduleTypeMatches;
  }
  const expectedTypeId = ERC7579_MODULE_TYPE_IDS[input.moduleState.moduleKind];
  return (
    expectedTypeId !== null &&
    input.moduleState.moduleTypeId === expectedTypeId &&
    input.moduleState.moduleTypeMatches
  );
}

export function moduleAllowlistEvidenceReady(moduleState: ModularAccountModuleState): boolean {
  return (
    moduleState.moduleAllowlisted === true &&
    moduleState.moduleAllowlistDigest !== null &&
    moduleState.moduleAllowlistDigest !== undefined &&
    moduleState.moduleAuditEvidenceRef !== null &&
    moduleState.moduleAuditEvidenceRef !== undefined
  );
}

export function validationReady(input: {
  readonly adapterKind: ModularAccountAdapterKind;
  readonly validation: ModularAccountValidationContext;
  readonly execution: ModularAccountExecutionContext;
  readonly manifest: ModularAccountPluginManifest | null;
}): boolean {
  const commonReady =
    input.validation.validationFunctionAuthorized &&
    input.validation.validationDataBound &&
    input.validation.signatureSelectionSanitized !== false &&
    input.validation.userOperationValidationPassed !== false &&
    input.validation.signatureValidationPassed !== false &&
    input.validation.selectorPermissionBound !== false;
  if (!commonReady) {
    return false;
  }
  if (input.adapterKind === 'erc-6900-plugin') {
    return (
      input.validation.runtimeValidationPassed &&
      input.validation.globalValidationAllowed !== false &&
      selectorAllowedByManifest({
        manifest: input.manifest,
        selector: input.execution.functionSelector ?? null,
      })
    );
  }
  return input.validation.runtimeValidationPassed;
}

export function executionReady(input: {
  readonly adapterKind: ModularAccountAdapterKind;
  readonly moduleState: ModularAccountModuleState;
  readonly execution: ModularAccountExecutionContext;
  readonly manifest: ModularAccountPluginManifest | null;
}): boolean {
  if (!input.execution.executionFunctionAuthorized) {
    return false;
  }
  if (input.adapterKind === 'erc-7579-module') {
    if (input.moduleState.moduleKind === 'executor') {
      return input.execution.executionFunction === 'executeFromExecutor';
    }
    if (input.moduleState.moduleKind === 'validator') {
      return input.execution.executionFunction === 'execute' ||
        input.execution.executionFunction === 'executeUserOp';
    }
    return true;
  }
  return (
    (input.execution.executionFunction === 'executeFromPlugin' ||
      input.execution.executionFunction === 'executeWithRuntimeValidation') &&
    selectorAllowedByManifest({
      manifest: input.manifest,
      selector: input.execution.functionSelector ?? null,
    })
  );
}

export function hooksReady(input: {
  readonly moduleState: ModularAccountModuleState;
  readonly hooks: ModularAccountHookContext;
}): boolean {
  if (!input.hooks.hooksRequired && input.moduleState.moduleKind !== 'hook') {
    return true;
  }
  return (
    input.hooks.hookAddress !== null &&
    input.hooks.hookAddress !== ZERO_EVM_ADDRESS &&
    input.hooks.preCheckPassed === true &&
    input.hooks.postCheckPassed !== false
  );
}

export function pluginManifestReady(input: {
  readonly adapterKind: ModularAccountAdapterKind;
  readonly manifest: ModularAccountPluginManifest | null;
  readonly execution: ModularAccountExecutionContext;
}): boolean {
  if (input.adapterKind === 'erc-7579-module') {
    return true;
  }
  return (
    input.manifest !== null &&
    input.manifest.manifestHash !== null &&
    input.manifest.manifestApproved === true &&
    input.manifest.dependenciesApproved === true &&
    selectorAllowedByManifest({
      manifest: input.manifest,
      selector: input.execution.functionSelector ?? null,
    })
  );
}

export function fallbackForwardingReady(input: {
  readonly moduleState: ModularAccountModuleState;
  readonly hooks: ModularAccountHookContext;
}): boolean {
  if (input.moduleState.moduleKind !== 'fallback-handler') {
    return true;
  }
  return input.hooks.selectorRoutingPassed === true && input.hooks.fallbackUsesErc2771 === true;
}

export function recoveryReady(input: {
  readonly moduleState: ModularAccountModuleState;
  readonly hooks: ModularAccountHookContext;
}): boolean {
  const hookReady =
    !input.hooks.hooksRequired &&
    input.moduleState.moduleKind !== 'hook'
      ? true
      : input.moduleState.recovery.hookCanBeDisabled;
  return (
    input.moduleState.recovery.moduleCanBeUninstalled &&
    hookReady &&
    input.moduleState.recovery.emergencyExecutionPrepared
  );
}

export function pluginManifestEvidence(
  manifest: ModularAccountPluginManifest | null,
): CanonicalReleaseJsonValue {
  if (manifest === null) {
    return null;
  }
  return Object.freeze({
    manifestHash: manifest.manifestHash ?? null,
    manifestApproved: manifest.manifestApproved ?? null,
    permittedSelectors: Object.freeze([...(manifest.permittedSelectors ?? [])]),
    executionFunctionSelector: manifest.executionFunctionSelector ?? null,
    validationFunctionSelector: manifest.validationFunctionSelector ?? null,
    dependenciesApproved: manifest.dependenciesApproved ?? null,
  });
}
