import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import {
  ERC4337_USER_OPERATION_SUPPORTED_ACCOUNT_KINDS,
  type Erc4337BundlerValidation,
  type Erc4337UserOperation,
  type Erc4337UserOperationCheck,
  type Erc4337UserOperationObservation,
  type Erc4337UserOperationObservationStatus,
} from './erc4337-user-operation-adapter-types.js';
import {
  ZERO_EVM_ADDRESS,
  caip2ChainId,
  compareUintStrings,
  isSupportedErc4337AccountKind,
  nonceMatches,
  normalizeIdentifier,
  sameAddress,
  userOperationHashBinding,
  validationWindowEvidence,
  validationWindowInsideIntent,
} from './erc4337-user-operation-adapter-normalize.js';

function observation(input: {
  readonly check: Erc4337UserOperationCheck;
  readonly status: Erc4337UserOperationObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required?: boolean;
  readonly evidence?: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}): Erc4337UserOperationObservation {
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
  readonly intent: CryptoAuthorizationIntent;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly userOperation: Erc4337UserOperation;
  readonly bundlerValidation: Erc4337BundlerValidation;
}): readonly Erc4337UserOperationObservation[] {
  const observations: Erc4337UserOperationObservation[] = [];
  const chainId = caip2ChainId(input.intent);
  const targetAddress = input.intent.target.address ?? null;
  const requiredSelector = input.intent.target.functionSelector?.toLowerCase() ?? null;
  const requiredCalldataClass = input.intent.target.calldataClass ?? null;
  const userOperation = input.userOperation;
  const validation = input.bundlerValidation;
  const accountValidationWindowReady = validationWindowInsideIntent({
    window: validation.accountValidation ?? null,
    intent: input.intent,
  });
  const paymasterUsed = userOperation.paymaster !== null;
  const paymasterValidationWindowReady = !paymasterUsed || validationWindowInsideIntent({
    window: validation.paymasterValidation ?? null,
    intent: input.intent,
  });
  const factoryUsed =
    userOperation.factory !== null || validation.senderAlreadyDeployed === false;
  const paymasterVerificationGasLimit = userOperation.paymasterVerificationGasLimit ?? null;
  const paymasterPostOpGasLimit = userOperation.paymasterPostOpGasLimit ?? null;
  const factoryReady =
    !factoryUsed ||
    (userOperation.factory !== null &&
      userOperation.factoryData !== null &&
      userOperation.factoryData !== '0x' &&
      validation.factoryStatus === 'ready');
  const paymasterGasReady =
    !paymasterUsed ||
    (paymasterVerificationGasLimit !== null &&
      paymasterPostOpGasLimit !== null &&
      BigInt(paymasterVerificationGasLimit) > 0n &&
      BigInt(paymasterPostOpGasLimit) > 0n);
  const paymasterReady =
    !paymasterUsed ||
    (validation.paymasterStatus === 'ready' &&
      validation.paymasterStakeReady === true &&
      validation.paymasterDepositReady === true &&
      paymasterGasReady &&
      paymasterValidationWindowReady);
  const gasPolicyReady =
    validation.gasLimitsWithinPolicy &&
    compareUintStrings(userOperation.maxPriorityFeePerGas, userOperation.maxFeePerGas) <= 0;
  const erc7562Ready =
    validation.erc7562ValidationStatus === 'passed' &&
    validation.bannedOpcodeDetected !== true &&
    validation.storageAccessViolation !== true &&
    validation.unstakedEntityAccessDetected !== true;

  observations.push(
    observation({
      check: 'erc4337-adapter-kind',
      status: 'pass',
      code: 'erc4337-user-operation-adapter',
      message: 'Intent, release binding, and enforcement binding use the ERC-4337 UserOperation adapter.',
      evidence: {
        adapterKind: input.intent.executionAdapterKind,
        boundaryKind: input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-account-kind-supported',
      status: isSupportedErc4337AccountKind(input.intent.account.accountKind)
        ? 'pass'
        : 'fail',
      code: isSupportedErc4337AccountKind(input.intent.account.accountKind)
        ? 'erc4337-account-kind-supported'
        : 'erc4337-account-kind-unsupported',
      message: isSupportedErc4337AccountKind(input.intent.account.accountKind)
        ? 'Smart-account kind is supported for ERC-4337 UserOperation execution.'
        : 'Account kind is not supported by the ERC-4337 UserOperation adapter.',
      evidence: {
        accountKind: input.intent.account.accountKind,
        supportedKinds: [...ERC4337_USER_OPERATION_SUPPORTED_ACCOUNT_KINDS],
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-sender-matches-intent',
      status: sameAddress(userOperation.sender, input.intent.account.address) ? 'pass' : 'fail',
      code: sameAddress(userOperation.sender, input.intent.account.address)
        ? 'erc4337-sender-bound'
        : 'erc4337-sender-mismatch',
      message: sameAddress(userOperation.sender, input.intent.account.address)
        ? 'UserOperation sender matches the crypto authorization account.'
        : 'UserOperation sender does not match the crypto authorization account.',
      evidence: {
        sender: userOperation.sender,
        intentAccount: input.intent.account.address,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-chain-matches-intent',
      status: userOperation.chainId === chainId ? 'pass' : 'fail',
      code: userOperation.chainId === chainId
        ? 'erc4337-chain-bound'
        : 'erc4337-chain-mismatch',
      message: userOperation.chainId === chainId
        ? 'UserOperation chain matches the crypto authorization intent.'
        : 'UserOperation chain does not match the crypto authorization intent.',
      evidence: {
        userOperationChainId: userOperation.chainId,
        intentChainId: chainId,
      },
    }),
  );

  const entryPointReady =
    userOperation.entryPoint !== ZERO_EVM_ADDRESS && validation.entryPointSupported;
  observations.push(
    observation({
      check: 'erc4337-entrypoint-bound',
      status: entryPointReady ? 'pass' : 'fail',
      code: entryPointReady
        ? 'erc4337-entrypoint-supported'
        : 'erc4337-entrypoint-not-supported',
      message: entryPointReady
        ? 'EntryPoint address and version are supported by bundler validation.'
        : 'EntryPoint is missing, zero, or not supported by bundler validation.',
      evidence: {
        entryPoint: userOperation.entryPoint,
        entryPointVersion: userOperation.entryPointVersion,
        entryPointSupported: validation.entryPointSupported,
      },
    }),
  );

  const hashBinding = userOperationHashBinding(userOperation);
  observations.push(
    observation({
      check: 'erc4337-userop-hash-bound',
      status: hashBinding.status,
      code: hashBinding.code,
      message: hashBinding.status === 'pass'
        ? 'UserOperation hash was recomputed from normalized EntryPoint fields before binding.'
        : 'UserOperation hash could not be recomputed to match the supplied bundler evidence.',
      evidence: {
        suppliedUserOpHash: userOperation.userOpHash,
        computedUserOpHash: hashBinding.computedUserOpHash,
        recomputationError: hashBinding.error,
        hashSource: 'attestor-recomputed',
        entryPoint: userOperation.entryPoint,
        entryPointVersion: userOperation.entryPointVersion,
        chainId: userOperation.chainId,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-nonce-matches-intent',
      status: nonceMatches(input.intent.constraints.nonce, userOperation.nonce)
        ? 'pass'
        : 'fail',
      code: nonceMatches(input.intent.constraints.nonce, userOperation.nonce)
        ? 'erc4337-nonce-bound'
        : 'erc4337-nonce-mismatch',
      message: nonceMatches(input.intent.constraints.nonce, userOperation.nonce)
        ? 'UserOperation nonce matches the crypto authorization replay constraint.'
        : 'UserOperation nonce does not match the crypto authorization replay constraint.',
      evidence: {
        userOperationNonce: userOperation.nonce,
        intentNonce: input.intent.constraints.nonce,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-call-target-bound',
      status: targetAddress === null
        ? 'warn'
        : sameAddress(userOperation.callTarget ?? '', targetAddress)
          ? 'pass'
          : 'fail',
      code: targetAddress === null
        ? 'erc4337-call-target-not-required'
        : sameAddress(userOperation.callTarget ?? '', targetAddress)
          ? 'erc4337-call-target-bound'
          : 'erc4337-call-target-mismatch',
      message: targetAddress === null
        ? 'Crypto authorization intent does not require a decoded UserOperation call target.'
        : sameAddress(userOperation.callTarget ?? '', targetAddress)
          ? 'Decoded UserOperation call target matches the crypto authorization intent.'
          : 'Decoded UserOperation call target does not match the crypto authorization intent.',
      evidence: {
        callTarget: userOperation.callTarget ?? null,
        intentTargetAddress: targetAddress,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-function-selector-bound',
      status: requiredSelector === null
        ? 'pass'
        : userOperation.callFunctionSelector === requiredSelector
          ? 'pass'
          : 'fail',
      code: requiredSelector === null
        ? 'erc4337-function-selector-not-required'
        : userOperation.callFunctionSelector === requiredSelector
          ? 'erc4337-function-selector-bound'
          : 'erc4337-function-selector-mismatch',
      message: requiredSelector === null
        ? 'Crypto authorization intent does not require a decoded function selector.'
        : userOperation.callFunctionSelector === requiredSelector
          ? 'Decoded UserOperation function selector matches the crypto authorization intent.'
          : 'Decoded UserOperation function selector does not match the crypto authorization intent.',
      evidence: {
        callFunctionSelector: userOperation.callFunctionSelector ?? null,
        intentFunctionSelector: requiredSelector,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-calldata-class-bound',
      status: requiredCalldataClass === null
        ? 'pass'
        : userOperation.callDataClass === requiredCalldataClass
          ? 'pass'
          : 'fail',
      code: requiredCalldataClass === null
        ? 'erc4337-calldata-class-not-required'
        : userOperation.callDataClass === requiredCalldataClass
          ? 'erc4337-calldata-class-bound'
          : 'erc4337-calldata-class-mismatch',
      message: requiredCalldataClass === null
        ? 'Crypto authorization intent does not require a calldata class.'
        : userOperation.callDataClass === requiredCalldataClass
          ? 'Decoded UserOperation calldata class matches the crypto authorization intent.'
          : 'Decoded UserOperation calldata class does not match the crypto authorization intent.',
      evidence: {
        callDataClass: userOperation.callDataClass ?? null,
        intentCalldataClass: requiredCalldataClass,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-call-data-present',
      status: userOperation.callData === '0x' || userOperation.signature === '0x'
        ? 'fail'
        : 'pass',
      code: userOperation.callData === '0x'
        ? 'erc4337-call-data-empty'
        : userOperation.signature === '0x'
          ? 'erc4337-signature-empty'
          : 'erc4337-call-data-and-signature-present',
      message: userOperation.callData === '0x' || userOperation.signature === '0x'
        ? 'UserOperation calldata and signature must be non-empty before bundler submission.'
        : 'UserOperation calldata and signature are present.',
      evidence: {
        callDataLength: userOperation.callData.length,
        signatureLength: userOperation.signature.length,
        callCount: userOperation.callCount ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-bundler-simulation-passed',
      status: validation.simulateValidationStatus === 'passed' ? 'pass' : 'fail',
      code: validation.simulateValidationStatus === 'passed'
        ? 'erc4337-simulate-validation-passed'
        : 'erc4337-simulate-validation-failed',
      message: validation.simulateValidationStatus === 'passed'
        ? 'Bundler simulateValidation accepted the UserOperation.'
        : 'Bundler simulateValidation did not pass and the UserOperation must fail closed.',
      evidence: {
        bundlerId: validation.bundlerId,
        validationEvidenceSource: 'customer-bundler-validation',
        simulateValidationStatus: validation.simulateValidationStatus,
        validatedAt: validation.validatedAt,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-erc7562-scope-passed',
      status: erc7562Ready ? 'pass' : 'fail',
      code: validation.erc7562ValidationStatus !== 'passed'
        ? 'erc4337-erc7562-validation-failed'
        : validation.bannedOpcodeDetected === true
          ? 'erc4337-erc7562-banned-opcode'
          : validation.storageAccessViolation === true
            ? 'erc4337-erc7562-storage-access-violation'
            : validation.unstakedEntityAccessDetected === true
              ? 'erc4337-erc7562-unstaked-entity-access'
              : 'erc4337-erc7562-validation-passed',
      message: erc7562Ready
        ? 'ERC-7562 validation-scope evidence passed without forbidden validation behavior.'
        : 'ERC-7562 validation-scope evidence failed or detected forbidden validation behavior.',
      evidence: {
        validationEvidenceSource: 'customer-bundler-validation',
        erc7562ValidationStatus: validation.erc7562ValidationStatus,
        bannedOpcodeDetected: validation.bannedOpcodeDetected ?? false,
        storageAccessViolation: validation.storageAccessViolation ?? false,
        unstakedEntityAccessDetected: validation.unstakedEntityAccessDetected ?? false,
      },
    }),
  );

  const accountValidationReady =
    validation.accountValidationStatus === 'passed' &&
    validation.signatureValidationStatus === 'passed' &&
    validation.nonceValidationStatus === 'passed';
  observations.push(
    observation({
      check: 'erc4337-account-validation-passed',
      status: accountValidationReady ? 'pass' : 'fail',
      code: validation.accountValidationStatus !== 'passed'
        ? 'erc4337-account-validation-failed'
        : validation.signatureValidationStatus !== 'passed'
          ? 'erc4337-signature-validation-failed'
          : validation.nonceValidationStatus !== 'passed'
            ? 'erc4337-nonce-validation-failed'
            : 'erc4337-account-validation-passed',
      message: accountValidationReady
        ? 'Account, signature, and EntryPoint nonce validation passed.'
        : 'Account, signature, or EntryPoint nonce validation did not pass.',
      evidence: {
        accountValidationStatus: validation.accountValidationStatus,
        signatureValidationStatus: validation.signatureValidationStatus,
        nonceValidationStatus: validation.nonceValidationStatus,
        aggregatorAddress: validation.aggregatorAddress ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-factory-readiness',
      status: factoryReady ? 'pass' : 'fail',
      code: !factoryUsed
        ? 'erc4337-factory-not-used'
        : factoryReady
          ? 'erc4337-factory-ready'
          : 'erc4337-factory-not-ready',
      message: !factoryUsed
        ? 'Sender account is already deployed and no factory path is required.'
        : factoryReady
          ? 'Factory deployment path is present and bundler validation marked it ready.'
          : 'Undeployed sender or factory path is missing factory readiness evidence.',
      evidence: {
        senderAlreadyDeployed: validation.senderAlreadyDeployed ?? null,
        factory: userOperation.factory ?? null,
        factoryDataLength: userOperation.factoryData?.length ?? null,
        factoryStatus: validation.factoryStatus ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-gas-policy-bound',
      status: gasPolicyReady ? 'pass' : 'fail',
      code: !validation.gasLimitsWithinPolicy
        ? 'erc4337-gas-limits-outside-policy'
        : compareUintStrings(userOperation.maxPriorityFeePerGas, userOperation.maxFeePerGas) > 0
          ? 'erc4337-priority-fee-exceeds-max-fee'
          : 'erc4337-gas-policy-bound',
      message: gasPolicyReady
        ? 'UserOperation gas limits and EIP-1559 fee caps are inside policy.'
        : 'UserOperation gas limits or fee caps are outside policy.',
      evidence: {
        callGasLimit: userOperation.callGasLimit,
        verificationGasLimit: userOperation.verificationGasLimit,
        preVerificationGas: userOperation.preVerificationGas,
        maxFeePerGas: userOperation.maxFeePerGas,
        maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas,
        gasLimitsWithinPolicy: validation.gasLimitsWithinPolicy,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-prefund-covered',
      status: validation.prefundCovered ? 'pass' : 'fail',
      code: validation.prefundCovered ? 'erc4337-prefund-covered' : 'erc4337-prefund-missing',
      message: validation.prefundCovered
        ? 'Account or paymaster prefund covers maximum validation and execution cost.'
        : 'Account or paymaster prefund does not cover the UserOperation cost envelope.',
      evidence: {
        prefundCovered: validation.prefundCovered,
        paymaster: userOperation.paymaster ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-paymaster-readiness',
      status: paymasterReady ? 'pass' : 'fail',
      code: !paymasterUsed
        ? 'erc4337-paymaster-not-used'
        : validation.paymasterStatus !== 'ready'
          ? 'erc4337-paymaster-not-ready'
          : validation.paymasterStakeReady !== true
            ? 'erc4337-paymaster-stake-not-ready'
            : validation.paymasterDepositReady !== true
              ? 'erc4337-paymaster-deposit-not-ready'
              : !paymasterGasReady
                ? 'erc4337-paymaster-gas-missing'
                : !paymasterValidationWindowReady
                  ? 'erc4337-paymaster-validation-window-outside-intent'
                  : 'erc4337-paymaster-ready',
      message: !paymasterUsed
        ? 'UserOperation does not use a paymaster.'
        : paymasterReady
          ? 'Paymaster stake, deposit, validation window, and postOp gas evidence are ready.'
          : 'Paymaster readiness evidence is missing or failed.',
      evidence: {
        paymaster: userOperation.paymaster ?? null,
        paymasterStatus: validation.paymasterStatus ?? null,
        paymasterStakeReady: validation.paymasterStakeReady ?? null,
        paymasterDepositReady: validation.paymasterDepositReady ?? null,
        paymasterVerificationGasLimit: userOperation.paymasterVerificationGasLimit ?? null,
        paymasterPostOpGasLimit: userOperation.paymasterPostOpGasLimit ?? null,
      },
    }),
  );

  const validationWindowReady = accountValidationWindowReady && paymasterValidationWindowReady;
  observations.push(
    observation({
      check: 'erc4337-validation-window-bound',
      status: validationWindowReady ? 'pass' : 'fail',
      code: !accountValidationWindowReady
        ? 'erc4337-account-validation-window-outside-intent'
        : !paymasterValidationWindowReady
          ? 'erc4337-paymaster-validation-window-outside-intent'
          : 'erc4337-validation-window-bound',
      message: validationWindowReady
        ? 'Account and paymaster validation windows are inside the Attestor authorization window.'
        : 'Validation window evidence is missing or wider than the Attestor authorization window.',
      evidence: {
        intentValidAfter: input.intent.constraints.validAfter,
        intentValidUntil: input.intent.constraints.validUntil,
        accountValidation: validationWindowEvidence(validation.accountValidation),
        paymasterValidation: validationWindowEvidence(validation.paymasterValidation),
      },
    }),
  );

  const releaseReady =
    input.releaseBinding.status === 'bound' &&
    input.releaseBinding.releaseDecision.status === 'accepted';
  observations.push(
    observation({
      check: 'erc4337-release-binding-ready',
      status: releaseReady ? 'pass' : 'fail',
      code: releaseReady
        ? 'erc4337-release-binding-ready'
        : 'erc4337-release-binding-not-executable',
      message: releaseReady
        ? 'Release binding is executable for UserOperation dispatch.'
        : 'Release binding is not executable and UserOperation dispatch must fail closed.',
      evidence: {
        bindingStatus: input.releaseBinding.status,
        releaseStatus: input.releaseBinding.releaseDecision.status,
        releaseDecisionId: input.releaseBinding.releaseDecisionId,
      },
    }),
  );

  observations.push(
    observation({
      check: 'erc4337-policy-binding-ready',
      status: input.policyScopeBinding.activationRecord.state === 'active' ? 'pass' : 'fail',
      code: input.policyScopeBinding.activationRecord.state === 'active'
        ? 'erc4337-policy-binding-active'
        : 'erc4337-policy-binding-not-active',
      message: input.policyScopeBinding.activationRecord.state === 'active'
        ? 'Policy-control-plane binding is active for UserOperation dispatch.'
        : 'Policy-control-plane binding is not active.',
      evidence: {
        activationId: input.policyScopeBinding.activationId,
        activationState: input.policyScopeBinding.activationRecord.state,
      },
    }),
  );

  const enforcementReady =
    input.enforcementBinding.adapterKind === 'erc-4337-user-operation' &&
    input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind === 'action-dispatch' &&
    input.enforcementBinding.verificationProfile.failClosed;
  observations.push(
    observation({
      check: 'erc4337-enforcement-binding-ready',
      status: enforcementReady ? 'pass' : 'fail',
      code: enforcementReady
        ? 'erc4337-enforcement-binding-ready'
        : 'erc4337-enforcement-binding-not-ready',
      message: enforcementReady
        ? 'Enforcement binding is fail-closed and action-dispatch scoped for UserOperation dispatch.'
        : 'Enforcement binding is not ERC-4337 action-dispatch ready.',
      evidence: {
        adapterKind: input.enforcementBinding.adapterKind,
        boundaryKind: input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind,
        profileId: input.enforcementBinding.verificationProfile.id,
      },
    }),
  );

  return Object.freeze(observations);
}
