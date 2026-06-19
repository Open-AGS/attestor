import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import {
  MODULAR_ACCOUNT_ADAPTER_PROFILES,
  type ModularAccountAdapterKind,
  type ModularAccountCheck,
  type ModularAccountExecutionContext,
  type ModularAccountHookContext,
  type ModularAccountModuleState,
  type ModularAccountObservation,
  type ModularAccountObservationStatus,
  type ModularAccountPluginManifest,
  type ModularAccountValidationContext,
} from './modular-account-adapters-types.js';
import { normalizeIdentifier } from './modular-account-adapters-normalize.js';
import {
  caip2ChainId,
  executionReady,
  fallbackForwardingReady,
  hooksReady,
  moduleAllowlistEvidenceReady,
  moduleTypeMatchesProfile,
  nonceMatches,
  pluginManifestEvidence,
  pluginManifestReady,
  recoveryReady,
  sameAddress,
  selectorAllowedByManifest,
  validationReady,
} from './modular-account-adapters-readiness.js';

function observation(input: {
  readonly check: ModularAccountCheck;
  readonly status: ModularAccountObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required?: boolean;
  readonly evidence?: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}): ModularAccountObservation {
  return Object.freeze({
    check: input.check,
    status: input.status,
    code: normalizeIdentifier(input.code, 'observation.code'),
    message: normalizeIdentifier(input.message, 'observation.message'),
    required: input.required ?? true,
    evidence: Object.freeze(input.evidence ?? {}),
  });
}

export function buildObservations(input: {
  readonly adapterKind: ModularAccountAdapterKind;
  readonly intent: CryptoAuthorizationIntent;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly moduleState: ModularAccountModuleState;
  readonly validation: ModularAccountValidationContext;
  readonly execution: ModularAccountExecutionContext;
  readonly hooks: ModularAccountHookContext;
  readonly pluginManifest: ModularAccountPluginManifest | null;
}): readonly ModularAccountObservation[] {
  const observations: ModularAccountObservation[] = [];
  const profile = MODULAR_ACCOUNT_ADAPTER_PROFILES[input.adapterKind];
  const chainId = caip2ChainId(input.intent);
  const targetAddress = input.intent.target.address ?? null;
  const requiredSelector = input.intent.target.functionSelector?.toLowerCase() ?? null;
  const requiredCalldataClass = input.intent.target.calldataClass ?? null;
  const moduleTypeReady =
    input.moduleState.accountSupportsModuleType &&
    moduleTypeMatchesProfile({
      adapterKind: input.adapterKind,
      moduleState: input.moduleState,
    });
  const allowlistEvidenceReady = moduleAllowlistEvidenceReady(input.moduleState);
  const validationFunctionReady = validationReady({
    adapterKind: input.adapterKind,
    validation: input.validation,
    execution: input.execution,
    manifest: input.pluginManifest,
  });
  const executionFunctionReady = executionReady({
    adapterKind: input.adapterKind,
    moduleState: input.moduleState,
    execution: input.execution,
    manifest: input.pluginManifest,
  });
  const hookChecksReady = hooksReady({
    moduleState: input.moduleState,
    hooks: input.hooks,
  });
  const delegateCallReady =
    input.execution.executionMode.callType !== 'delegatecall' ||
    input.execution.delegateCallAllowed === true;
  const installReady =
    input.moduleState.installAuthorization.authorized &&
    input.moduleState.installAuthorization.eventObserved;
  const manifestReady = pluginManifestReady({
    adapterKind: input.adapterKind,
    manifest: input.pluginManifest,
    execution: input.execution,
  });
  const fallbackReady = fallbackForwardingReady({
    moduleState: input.moduleState,
    hooks: input.hooks,
  });
  const nativeValueUnexpected =
    input.execution.value !== '0' &&
    input.intent.asset !== null &&
    input.intent.asset.assetKind !== 'native-token';

  observations.push(
    observation({
      check: 'modular-adapter-kind',
      status: input.moduleState.moduleStandard === profile.standard ? 'pass' : 'fail',
      code: input.moduleState.moduleStandard === profile.standard
        ? 'modular-adapter-standard-bound'
        : 'modular-adapter-standard-mismatch',
      message: input.moduleState.moduleStandard === profile.standard
        ? 'Modular account evidence uses the standard required by the execution adapter.'
        : 'Modular account evidence standard does not match the execution adapter.',
      evidence: {
        adapterKind: input.adapterKind,
        moduleStandard: input.moduleState.moduleStandard,
        expectedStandard: profile.standard,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-account-kind-supported',
      status: input.intent.account.accountKind === profile.accountKind ? 'pass' : 'fail',
      code: input.intent.account.accountKind === profile.accountKind
        ? 'modular-account-kind-supported'
        : 'modular-account-kind-unsupported',
      message: input.intent.account.accountKind === profile.accountKind
        ? 'Intent account kind is supported by the modular account adapter profile.'
        : 'Intent account kind is not supported by the modular account adapter profile.',
      evidence: {
        accountKind: input.intent.account.accountKind,
        expectedAccountKind: profile.accountKind,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-account-matches-intent',
      status: sameAddress(input.moduleState.accountAddress, input.intent.account.address)
        ? 'pass'
        : 'fail',
      code: sameAddress(input.moduleState.accountAddress, input.intent.account.address)
        ? 'modular-account-bound'
        : 'modular-account-mismatch',
      message: sameAddress(input.moduleState.accountAddress, input.intent.account.address)
        ? 'Modular account address matches the crypto authorization intent.'
        : 'Modular account address does not match the crypto authorization intent.',
      evidence: {
        accountAddress: input.moduleState.accountAddress,
        intentAccount: input.intent.account.address,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-chain-matches-intent',
      status: input.moduleState.chainId === chainId ? 'pass' : 'fail',
      code: input.moduleState.chainId === chainId
        ? 'modular-chain-bound'
        : 'modular-chain-mismatch',
      message: input.moduleState.chainId === chainId
        ? 'Modular account chain matches the crypto authorization intent.'
        : 'Modular account chain does not match the crypto authorization intent.',
      evidence: {
        moduleChainId: input.moduleState.chainId,
        intentChainId: chainId,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-account-implementation-bound',
      status: 'pass',
      code: 'modular-account-implementation-bound',
      message: 'Account implementation identity is present for modular-account evidence.',
      evidence: {
        accountImplementationId: input.moduleState.accountImplementationId,
        observedAt: input.moduleState.observedAt,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-module-installed',
      status: input.moduleState.moduleInstalled ? 'pass' : 'fail',
      code: input.moduleState.moduleInstalled
        ? 'modular-module-installed'
        : 'modular-module-not-installed',
      message: input.moduleState.moduleInstalled
        ? 'Module or plugin is installed before execution.'
        : 'Module or plugin is not installed and must fail closed.',
      evidence: {
        moduleAddress: input.moduleState.moduleAddress,
        moduleKind: input.moduleState.moduleKind,
        moduleId: input.moduleState.moduleId ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-module-allowlist-evidence',
      status: allowlistEvidenceReady ? 'pass' : 'fail',
      code: allowlistEvidenceReady
        ? 'modular-module-allowlist-evidence-bound'
        : 'modular-module-allowlist-evidence-missing',
      message: allowlistEvidenceReady
        ? 'Module/plugin is allowlisted with digest-bound audit evidence before execution.'
        : 'Module/plugin lacks allowlist or audit evidence and must fail closed.',
      evidence: {
        moduleAddress: input.moduleState.moduleAddress,
        moduleKind: input.moduleState.moduleKind,
        moduleAllowlisted: input.moduleState.moduleAllowlisted ?? false,
        moduleAllowlistDigest: input.moduleState.moduleAllowlistDigest ?? null,
        moduleAuditEvidenceRef: input.moduleState.moduleAuditEvidenceRef ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-module-type-supported',
      status: moduleTypeReady ? 'pass' : 'fail',
      code: !input.moduleState.accountSupportsModuleType
        ? 'modular-account-does-not-support-module-type'
        : moduleTypeReady
          ? 'modular-module-type-supported'
          : 'modular-module-type-mismatch',
      message: moduleTypeReady
        ? 'Account supports the module or plugin type required by the adapter.'
        : 'Account does not support the module/plugin type or the module type evidence mismatches.',
      evidence: {
        moduleKind: input.moduleState.moduleKind,
        moduleTypeId: input.moduleState.moduleTypeId ?? null,
        accountSupportsModuleType: input.moduleState.accountSupportsModuleType,
        moduleTypeMatches: input.moduleState.moduleTypeMatches,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-execution-mode-supported',
      status: input.moduleState.accountSupportsExecutionMode ? 'pass' : 'fail',
      code: input.moduleState.accountSupportsExecutionMode
        ? 'modular-execution-mode-supported'
        : 'modular-execution-mode-unsupported',
      message: input.moduleState.accountSupportsExecutionMode
        ? 'Account supports the encoded modular execution mode.'
        : 'Account does not support the encoded modular execution mode.',
      evidence: {
        encodedMode: input.execution.executionMode.encodedMode,
        callType: input.execution.executionMode.callType,
        executionType: input.execution.executionMode.executionType,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-target-matches-intent',
      status: targetAddress === null
        ? 'warn'
        : sameAddress(input.execution.target, targetAddress)
          ? 'pass'
          : 'fail',
      code: targetAddress === null
        ? 'modular-target-not-required'
        : sameAddress(input.execution.target, targetAddress)
          ? 'modular-target-bound'
          : 'modular-target-mismatch',
      message: targetAddress === null
        ? 'Crypto authorization intent does not require an EVM execution target.'
        : sameAddress(input.execution.target, targetAddress)
          ? 'Modular execution target matches the crypto authorization intent.'
          : 'Modular execution target does not match the crypto authorization intent.',
      evidence: {
        executionTarget: input.execution.target,
        intentTargetAddress: targetAddress,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-function-selector-matches-intent',
      status: requiredSelector === null
        ? 'pass'
        : input.execution.functionSelector === requiredSelector
          ? 'pass'
          : 'fail',
      code: requiredSelector === null
        ? 'modular-function-selector-not-required'
        : input.execution.functionSelector === requiredSelector
          ? 'modular-function-selector-bound'
          : 'modular-function-selector-mismatch',
      message: requiredSelector === null
        ? 'Crypto authorization intent does not require a function selector.'
        : input.execution.functionSelector === requiredSelector
          ? 'Modular execution function selector matches the crypto authorization intent.'
          : 'Modular execution function selector does not match the crypto authorization intent.',
      evidence: {
        executionFunctionSelector: input.execution.functionSelector ?? null,
        intentFunctionSelector: requiredSelector,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-calldata-class-matches-intent',
      status: requiredCalldataClass === null
        ? 'pass'
        : input.execution.calldataClass === requiredCalldataClass
          ? 'pass'
          : 'fail',
      code: requiredCalldataClass === null
        ? 'modular-calldata-class-not-required'
        : input.execution.calldataClass === requiredCalldataClass
          ? 'modular-calldata-class-bound'
          : 'modular-calldata-class-mismatch',
      message: requiredCalldataClass === null
        ? 'Crypto authorization intent does not require a calldata class.'
        : input.execution.calldataClass === requiredCalldataClass
          ? 'Modular execution calldata class matches the crypto authorization intent.'
          : 'Modular execution calldata class does not match the crypto authorization intent.',
      evidence: {
        calldataClass: input.execution.calldataClass ?? null,
        intentCalldataClass: requiredCalldataClass,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-native-value-posture',
      status: nativeValueUnexpected ? 'fail' : 'pass',
      code: nativeValueUnexpected
        ? 'modular-native-value-not-expected'
        : 'modular-native-value-compatible',
      message: nativeValueUnexpected
        ? 'Modular execution carries native value while the intent is scoped to a non-native asset.'
        : 'Modular execution native value posture is compatible with the crypto authorization intent.',
      evidence: {
        value: input.execution.value,
        assetKind: input.intent.asset?.assetKind ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-nonce-matches-intent',
      status: nonceMatches(input.intent.constraints.nonce, input.execution.nonce)
        ? 'pass'
        : 'fail',
      code: nonceMatches(input.intent.constraints.nonce, input.execution.nonce)
        ? 'modular-nonce-bound'
        : 'modular-nonce-mismatch',
      message: nonceMatches(input.intent.constraints.nonce, input.execution.nonce)
        ? 'Modular execution nonce matches the crypto authorization replay constraint.'
        : 'Modular execution nonce does not match the crypto authorization replay constraint.',
      evidence: {
        moduleNonce: input.execution.nonce,
        intentNonce: input.intent.constraints.nonce,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-validation-function-bound',
      status: validationFunctionReady ? 'pass' : 'fail',
      code: !input.validation.validationFunctionAuthorized
        ? 'modular-validation-function-not-authorized'
        : !input.validation.validationDataBound
          ? 'modular-validation-data-not-bound'
          : input.validation.signatureSelectionSanitized === false
            ? 'modular-signature-selection-not-sanitized'
            : input.validation.selectorPermissionBound === false
              ? 'modular-selector-permission-not-bound'
              : input.adapterKind === 'erc-6900-plugin' &&
                  !selectorAllowedByManifest({
                    manifest: input.pluginManifest,
                    selector: input.execution.functionSelector ?? null,
                  })
                ? 'modular-plugin-selector-not-permitted'
                : 'modular-validation-function-bound',
      message: validationFunctionReady
        ? 'Validation function, selector permission, and validation data are bound to the modular execution.'
        : 'Validation function evidence is missing, unauthorized, unsanitized, or selector-unbound.',
      evidence: {
        validationFunction: input.validation.validationFunction,
        validatorAddress: input.validation.validatorAddress ?? null,
        validationFunctionAuthorized: input.validation.validationFunctionAuthorized,
        validationDataBound: input.validation.validationDataBound,
        signatureSelectionSanitized: input.validation.signatureSelectionSanitized ?? null,
        selectorPermissionBound: input.validation.selectorPermissionBound ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-execution-function-bound',
      status: executionFunctionReady ? 'pass' : 'fail',
      code: !input.execution.executionFunctionAuthorized
        ? 'modular-execution-function-not-authorized'
        : executionFunctionReady
          ? 'modular-execution-function-bound'
          : 'modular-execution-function-mismatch',
      message: executionFunctionReady
        ? 'Execution function is authorized and compatible with the modular adapter profile.'
        : 'Execution function is unauthorized or incompatible with the modular adapter profile.',
      evidence: {
        executionFunction: input.execution.executionFunction,
        executorAddress: input.execution.executorAddress ?? null,
        moduleKind: input.moduleState.moduleKind,
      },
    }),
  );

  const runtimeValidationReady =
    input.validation.runtimeValidationPassed &&
    input.validation.userOperationValidationPassed !== false &&
    input.validation.signatureValidationPassed !== false &&
    input.validation.globalValidationAllowed !== false;
  observations.push(
    observation({
      check: 'modular-runtime-validation-passed',
      status: runtimeValidationReady ? 'pass' : 'fail',
      code: !input.validation.runtimeValidationPassed
        ? 'modular-runtime-validation-failed'
        : input.validation.userOperationValidationPassed === false
          ? 'modular-userop-validation-failed'
          : input.validation.signatureValidationPassed === false
            ? 'modular-signature-validation-failed'
            : input.validation.globalValidationAllowed === false
              ? 'modular-global-validation-not-allowed'
              : 'modular-runtime-validation-passed',
      message: runtimeValidationReady
        ? 'Runtime, UserOperation, signature, and global-validation posture is compatible.'
        : 'Runtime, UserOperation, signature, or global-validation posture failed.',
      evidence: {
        runtimeValidationPassed: input.validation.runtimeValidationPassed,
        userOperationValidationPassed: input.validation.userOperationValidationPassed ?? null,
        signatureValidationPassed: input.validation.signatureValidationPassed ?? null,
        globalValidationAllowed: input.validation.globalValidationAllowed ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-hooks-passed',
      status: hookChecksReady ? 'pass' : 'fail',
      code: !input.hooks.hooksRequired && input.moduleState.moduleKind !== 'hook'
        ? 'modular-hooks-not-required'
        : hookChecksReady
          ? 'modular-hooks-passed'
          : 'modular-hooks-failed',
      message: !input.hooks.hooksRequired && input.moduleState.moduleKind !== 'hook'
        ? 'This modular execution does not require hook evidence.'
        : hookChecksReady
          ? 'Required modular hook pre/post checks passed.'
          : 'Required modular hook checks are missing or failed.',
      evidence: {
        hooksRequired: input.hooks.hooksRequired,
        hookAddress: input.hooks.hookAddress ?? null,
        preCheckPassed: input.hooks.preCheckPassed ?? null,
        postCheckPassed: input.hooks.postCheckPassed ?? null,
        hookDataHash: input.hooks.hookDataHash ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-delegatecall-posture',
      status: delegateCallReady ? 'pass' : 'fail',
      code: delegateCallReady
        ? 'modular-delegatecall-posture-compatible'
        : 'modular-delegatecall-blocked',
      message: delegateCallReady
        ? 'Execution call type is compatible with adapter evidence.'
        : 'Delegatecall execution is blocked without explicit adapter evidence.',
      evidence: {
        callType: input.execution.executionMode.callType,
        delegateCallAllowed: input.execution.delegateCallAllowed ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-installation-authorized',
      status: installReady ? 'pass' : 'fail',
      code: installReady
        ? 'modular-installation-authorized'
        : 'modular-installation-not-authorized',
      message: installReady
        ? 'Module/plugin installation authorization and event evidence are present.'
        : 'Module/plugin installation authorization or event evidence is missing.',
      evidence: {
        authorized: input.moduleState.installAuthorization.authorized,
        eventObserved: input.moduleState.installAuthorization.eventObserved,
        installedBy: input.moduleState.installAuthorization.installedBy ?? null,
        initDataHash: input.moduleState.installAuthorization.initDataHash ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-plugin-manifest-bound',
      status: manifestReady ? 'pass' : 'fail',
      code: input.adapterKind === 'erc-7579-module'
        ? 'modular-plugin-manifest-not-required'
        : manifestReady
          ? 'modular-plugin-manifest-bound'
          : 'modular-plugin-manifest-not-bound',
      message: input.adapterKind === 'erc-7579-module'
        ? 'ERC-7579 module path does not require an ERC-6900 plugin manifest.'
        : manifestReady
          ? 'ERC-6900 plugin manifest is approved, dependency-bound, and selector-scoped.'
          : 'ERC-6900 plugin manifest is missing, unapproved, dependency-unbound, or selector-unscoped.',
      evidence: {
        pluginManifest: pluginManifestEvidence(input.pluginManifest),
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-fallback-sender-forwarding',
      status: fallbackReady ? 'pass' : 'fail',
      code: input.moduleState.moduleKind !== 'fallback-handler'
        ? 'modular-fallback-not-applicable'
        : fallbackReady
          ? 'modular-fallback-sender-forwarding-ready'
          : 'modular-fallback-sender-forwarding-missing',
      message: input.moduleState.moduleKind !== 'fallback-handler'
        ? 'Execution is not through a fallback handler.'
        : fallbackReady
          ? 'Fallback handler selector routing and ERC-2771 sender forwarding are ready.'
          : 'Fallback handler lacks selector routing or ERC-2771 sender forwarding evidence.',
      evidence: {
        selectorRoutingPassed: input.hooks.selectorRoutingPassed ?? null,
        fallbackUsesErc2771: input.hooks.fallbackUsesErc2771 ?? null,
      },
    }),
  );

  const releaseReady =
    input.releaseBinding.status === 'bound' &&
    input.releaseBinding.releaseDecision.status === 'accepted';
  observations.push(
    observation({
      check: 'modular-release-binding-ready',
      status: releaseReady ? 'pass' : 'fail',
      code: releaseReady
        ? 'modular-release-binding-ready'
        : 'modular-release-binding-not-executable',
      message: releaseReady
        ? 'Release binding is executable for modular-account dispatch.'
        : 'Release binding is not executable and modular-account dispatch must fail closed.',
      evidence: {
        bindingStatus: input.releaseBinding.status,
        releaseStatus: input.releaseBinding.releaseDecision.status,
        releaseDecisionId: input.releaseBinding.releaseDecisionId,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-policy-binding-ready',
      status: input.policyScopeBinding.activationRecord.state === 'active' ? 'pass' : 'fail',
      code: input.policyScopeBinding.activationRecord.state === 'active'
        ? 'modular-policy-binding-active'
        : 'modular-policy-binding-not-active',
      message: input.policyScopeBinding.activationRecord.state === 'active'
        ? 'Policy-control-plane binding is active for modular-account dispatch.'
        : 'Policy-control-plane binding is not active.',
      evidence: {
        activationId: input.policyScopeBinding.activationId,
        activationState: input.policyScopeBinding.activationRecord.state,
      },
    }),
  );

  const enforcementReady =
    input.enforcementBinding.adapterKind === input.adapterKind &&
    input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind === 'action-dispatch' &&
    input.enforcementBinding.verificationProfile.failClosed;
  observations.push(
    observation({
      check: 'modular-enforcement-binding-ready',
      status: enforcementReady ? 'pass' : 'fail',
      code: enforcementReady
        ? 'modular-enforcement-binding-ready'
        : 'modular-enforcement-binding-not-ready',
      message: enforcementReady
        ? 'Enforcement binding is fail-closed and action-dispatch scoped for modular-account dispatch.'
        : 'Enforcement binding is not modular-account action-dispatch ready.',
      evidence: {
        adapterKind: input.enforcementBinding.adapterKind,
        boundaryKind: input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind,
        profileId: input.enforcementBinding.verificationProfile.id,
      },
    }),
  );

  observations.push(
    observation({
      check: 'modular-operation-hash-bound',
      status: 'pass',
      code: 'modular-operation-hash-bound',
      message: 'Modular operation hash is present and bound into adapter evidence.',
      evidence: {
        operationHash: input.execution.operationHash,
        dataLength: input.execution.data.length,
        batchCallCount: input.execution.batchCallCount ?? null,
      },
    }),
  );

  const recoveryPostureReady = recoveryReady({
    moduleState: input.moduleState,
    hooks: input.hooks,
  });
  observations.push(
    observation({
      check: 'modular-recovery-posture-ready',
      status: recoveryPostureReady ? 'pass' : 'fail',
      code: recoveryPostureReady
        ? 'modular-recovery-posture-ready'
        : 'modular-recovery-posture-missing',
      message: recoveryPostureReady
        ? 'Module/plugin has owner-controlled recovery and emergency execution posture.'
        : 'Module/plugin recovery posture is missing or incomplete.',
      evidence: {
        moduleCanBeUninstalled: input.moduleState.recovery.moduleCanBeUninstalled,
        hookCanBeDisabled: input.moduleState.recovery.hookCanBeDisabled,
        emergencyExecutionPrepared: input.moduleState.recovery.emergencyExecutionPrepared,
        recoveryAuthorityRef: input.moduleState.recovery.recoveryAuthorityRef ?? null,
        recoveryDelaySeconds: input.moduleState.recovery.recoveryDelaySeconds ?? null,
      },
    }),
  );

  const postExecutionSuccess =
    input.execution.postExecutionSuccess === null ||
    input.execution.postExecutionSuccess === true;
  observations.push(
    observation({
      check: 'modular-post-execution-status',
      status: postExecutionSuccess ? 'pass' : 'fail',
      code: postExecutionSuccess
        ? 'modular-post-execution-compatible'
        : 'modular-post-execution-failed',
      message: postExecutionSuccess
        ? 'No failed modular post-execution status was observed.'
        : 'Modular post-execution status failed and must block.',
      evidence: {
        postExecutionSuccess: input.execution.postExecutionSuccess ?? null,
      },
    }),
  );

  return Object.freeze(observations);
}
