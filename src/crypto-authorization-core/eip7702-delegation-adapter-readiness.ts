import type { CryptoAuthorizationIntent } from './object-model.js';
import {
  EIP7702_INITCODE_MARKER,
  EIP7702_SET_CODE_TX_TYPE,
  type Eip7702AccountStateEvidence,
  type Eip7702AuthorizationTupleEvidence,
  type Eip7702DelegateCodeEvidence,
  type Eip7702ExecutionEvidence,
  type Eip7702InitializationEvidence,
  type Eip7702RecoveryEvidence,
  type Eip7702SponsorEvidence,
} from './eip7702-delegation-adapter-types.js';
import {
  ZERO_EVM_ADDRESS,
  eip155ChainId,
  sameAddress,
} from './eip7702-delegation-adapter-normalize.js';

export function authorizationChainReady(input: {
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly intent: CryptoAuthorizationIntent;
}): boolean {
  const chainId = eip155ChainId(input.intent);
  return (
    input.authorization.chainId === chainId ||
    (
      input.authorization.chainId === '0' &&
      input.intent.constraints.allowUniversalChainAuthorization === true
    )
  );
}

export function delegateCodeReady(delegateCode: Eip7702DelegateCodeEvidence): boolean {
  return (
    delegateCode.audited &&
    delegateCode.allowlisted &&
    delegateCode.storageLayoutSafe &&
    delegateCode.supportsReplayProtection &&
    delegateCode.supportsTargetCalldataBinding &&
    delegateCode.supportsValueBinding &&
    delegateCode.supportsGasBinding &&
    delegateCode.supportsExpiryBinding
  );
}

export function accountCodeReady(input: {
  readonly accountState: Eip7702AccountStateEvidence;
  readonly authorization: Eip7702AuthorizationTupleEvidence;
}): boolean {
  if (input.accountState.codeState === 'empty') {
    return true;
  }
  if (input.accountState.codeState !== 'delegated') {
    return false;
  }
  return sameAddress(
    input.authorization.delegationAddress,
    input.accountState.currentDelegationAddress,
  );
}

export function authorizationListReady(execution: Eip7702ExecutionEvidence): boolean {
  return (
    execution.authorizationListNonEmpty &&
    execution.authorizationListLength > 0 &&
    execution.tupleIndex >= 0 &&
    execution.tupleIndex < execution.authorizationListLength &&
    execution.tupleIsLastValidForAuthority
  );
}

export function executionPathReady(input: {
  readonly accountState: Eip7702AccountStateEvidence;
  readonly execution: Eip7702ExecutionEvidence;
}): boolean {
  const { accountState, execution } = input;
  switch (execution.executionPath) {
    case 'set-code-transaction':
      return (
        execution.transactionType === EIP7702_SET_CODE_TX_TYPE &&
        execution.authorizationListNonEmpty &&
        execution.destination !== ZERO_EVM_ADDRESS
      );
    case 'erc-4337-user-operation': {
      const authIncluded = execution.eip7702AuthIncluded === true;
      const alreadyDelegated = accountState.codeState === 'delegated';
      return (
        execution.userOperationHash !== null &&
        execution.entryPoint !== null &&
        execution.initCodeMarker === EIP7702_INITCODE_MARKER &&
        (authIncluded || alreadyDelegated) &&
        (!authIncluded || execution.preVerificationGasIncludesAuthorizationCost === true)
      );
    }
    case 'wallet-call-api':
      return (
        execution.walletCapabilityRequested === true &&
        execution.walletCapabilityObserved === true &&
        execution.walletCapabilitySupported === true
      );
  }
}

export function callScopeSigned(execution: Eip7702ExecutionEvidence): boolean {
  return (
    execution.targetCalldataSigned &&
    execution.valueSigned &&
    execution.gasLimitSigned &&
    execution.nonceSigned &&
    execution.expirySigned &&
    execution.runtimeContextBound
  );
}

export function initializationReady(initialization: Eip7702InitializationEvidence): boolean {
  if (!initialization.initializationRequired) {
    return true;
  }
  return (
    initialization.initializationCalldataHash !== null &&
    initialization.initializationSignedByAuthority === true &&
    initialization.initializationExecutedBeforeValidation === true &&
    initialization.frontRunProtected === true
  );
}

export function erc4337Ready(input: {
  readonly accountState: Eip7702AccountStateEvidence;
  readonly execution: Eip7702ExecutionEvidence;
}): boolean {
  if (input.execution.executionPath !== 'erc-4337-user-operation') {
    return true;
  }
  return executionPathReady(input);
}

export function walletCapabilityReady(execution: Eip7702ExecutionEvidence): boolean {
  if (execution.executionPath !== 'wallet-call-api') {
    return true;
  }
  return (
    execution.walletCapabilityRequested === true &&
    execution.walletCapabilityObserved === true &&
    execution.walletCapabilitySupported === true
  );
}

export function sponsorReady(sponsor: Eip7702SponsorEvidence): boolean {
  if (!sponsor.sponsored) {
    return true;
  }
  return (
    sponsor.sponsorAddress !== null &&
    sponsor.sponsorBondRequired === true &&
    sponsor.sponsorBondPresent === true &&
    sponsor.reimbursementBound === true
  );
}

export function recoveryReady(recovery: Eip7702RecoveryEvidence): boolean {
  return (
    recovery.revocationPathReady &&
    recovery.zeroAddressClearSupported &&
    recovery.privateKeyStillControlsAccountAcknowledged &&
    recovery.emergencyDelegateResetPrepared
  );
}
