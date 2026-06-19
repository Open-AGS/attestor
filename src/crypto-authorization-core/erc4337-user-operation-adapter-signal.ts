import type { CryptoSimulationPreflightSignal } from './authorization-simulation.js';
import {
  ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION,
  type Erc4337BundlerValidation,
  type Erc4337UserOperation,
  type Erc4337UserOperationObservation,
  type Erc4337UserOperationOutcome,
} from './erc4337-user-operation-adapter-types.js';

export function outcomeFromObservations(
  observations: readonly Erc4337UserOperationObservation[],
): Erc4337UserOperationOutcome {
  if (observations.some((entry) => entry.status === 'fail')) {
    return 'block';
  }
  if (observations.some((entry) => entry.required && entry.status === 'warn')) {
    return 'review-required';
  }
  return 'allow';
}

function signalStatusFor(
  outcome: Erc4337UserOperationOutcome,
): CryptoSimulationPreflightSignal['status'] {
  switch (outcome) {
    case 'allow':
      return 'pass';
    case 'review-required':
      return 'warn';
    case 'block':
      return 'fail';
  }
}

function failingReasonCodes(
  observations: readonly Erc4337UserOperationObservation[],
): readonly string[] {
  return Object.freeze(
    observations
      .filter((entry) => entry.status !== 'pass')
      .map((entry) => entry.code),
  );
}

function signalCodeFor(
  source: 'erc-4337-validation' | 'erc-7562-validation-scope',
  outcome: Erc4337UserOperationOutcome,
): string {
  const prefix = source === 'erc-4337-validation'
    ? 'erc4337-user-operation'
    : 'erc7562-validation-scope';
  switch (outcome) {
    case 'allow':
      return `${prefix}-preflight-pass`;
    case 'review-required':
      return `${prefix}-preflight-review-required`;
    case 'block':
      return `${prefix}-preflight-block`;
  }
}

function signalMessageFor(
  source: 'erc-4337-validation' | 'erc-7562-validation-scope',
  outcome: Erc4337UserOperationOutcome,
): string {
  const surface = source === 'erc-4337-validation'
    ? 'ERC-4337 UserOperation validation'
    : 'ERC-7562 validation-scope evidence';
  switch (outcome) {
    case 'allow':
      return `${surface} accepted the Attestor-bound UserOperation preflight.`;
    case 'review-required':
      return `${surface} needs additional evidence before UserOperation submission.`;
    case 'block':
      return `${surface} would block the UserOperation fail-closed.`;
  }
}

export function signalsFor(input: {
  readonly outcome: Erc4337UserOperationOutcome;
  readonly preflightId: string;
  readonly userOperation: Erc4337UserOperation;
  readonly bundlerValidation: Erc4337BundlerValidation;
  readonly observations: readonly Erc4337UserOperationObservation[];
}): readonly CryptoSimulationPreflightSignal[] {
  const status = signalStatusFor(input.outcome);
  const baseEvidence = Object.freeze({
    adapterVersion: ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION,
    preflightId: input.preflightId,
    outcome: input.outcome,
    bundlerId: input.bundlerValidation.bundlerId,
    validatedAt: input.bundlerValidation.validatedAt,
    entryPoint: input.userOperation.entryPoint,
    entryPointVersion: input.userOperation.entryPointVersion,
    sender: input.userOperation.sender,
    nonce: input.userOperation.nonce,
    userOpHash: input.userOperation.userOpHash,
    chainId: input.userOperation.chainId,
    callTarget: input.userOperation.callTarget ?? null,
    callFunctionSelector: input.userOperation.callFunctionSelector ?? null,
    paymaster: input.userOperation.paymaster ?? null,
    factory: input.userOperation.factory ?? null,
    reasonCodes: failingReasonCodes(input.observations),
  });

  return Object.freeze([
    Object.freeze({
      source: 'erc-4337-validation',
      status,
      code: signalCodeFor('erc-4337-validation', input.outcome),
      message: signalMessageFor('erc-4337-validation', input.outcome),
      required: true,
      evidence: Object.freeze({
        ...baseEvidence,
        simulateValidationStatus: input.bundlerValidation.simulateValidationStatus,
        accountValidationStatus: input.bundlerValidation.accountValidationStatus,
        signatureValidationStatus: input.bundlerValidation.signatureValidationStatus,
        nonceValidationStatus: input.bundlerValidation.nonceValidationStatus,
        prefundCovered: input.bundlerValidation.prefundCovered,
        gasLimitsWithinPolicy: input.bundlerValidation.gasLimitsWithinPolicy,
        paymasterStatus: input.bundlerValidation.paymasterStatus ?? null,
        factoryStatus: input.bundlerValidation.factoryStatus ?? null,
      }),
    }),
    Object.freeze({
      source: 'erc-7562-validation-scope',
      status,
      code: signalCodeFor('erc-7562-validation-scope', input.outcome),
      message: signalMessageFor('erc-7562-validation-scope', input.outcome),
      required: true,
      evidence: Object.freeze({
        ...baseEvidence,
        erc7562ValidationStatus: input.bundlerValidation.erc7562ValidationStatus,
        bannedOpcodeDetected: input.bundlerValidation.bannedOpcodeDetected ?? false,
        storageAccessViolation: input.bundlerValidation.storageAccessViolation ?? false,
        unstakedEntityAccessDetected: input.bundlerValidation.unstakedEntityAccessDetected ?? false,
        aggregatorAddress: input.bundlerValidation.aggregatorAddress ?? null,
      }),
    }),
  ]);
}
