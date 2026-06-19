import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  EIP7702_DELEGATION_INDICATOR_PREFIX,
  type Eip7702AccountStateEvidence,
  type Eip7702AuthorizationTupleEvidence,
  type Eip7702DelegateCodeEvidence,
  type Eip7702ExecutionEvidence,
  type Eip7702InitializationEvidence,
  type Eip7702RecoveryEvidence,
  type Eip7702SponsorEvidence,
} from '../crypto-authorization-core/eip7702-delegation-adapter.js';
import type { DelegatedEoaRuntimeObservation } from './delegated-eoa-types.js';

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    throw new Error(`Delegated EOA admission ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

export function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

export function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Delegated EOA admission ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

export function normalizeAddress(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/u.test(normalized)) {
    throw new Error(`Delegated EOA admission ${fieldName} must be an EVM address.`);
  }
  return normalized;
}

export function normalizeOptionalAddress(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeAddress(value, fieldName);
}

export function normalizeHash(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName).toLowerCase();
  if (!/^0x[0-9a-f]{64}$/u.test(normalized)) {
    throw new Error(`Delegated EOA admission ${fieldName} must be a 32-byte hex value.`);
  }
  return normalized;
}

export function normalizeOptionalHash(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeHash(value, fieldName);
}

export function normalizeHexBytes(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName).toLowerCase();
  if (!/^0x[0-9a-f]*$/u.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error(`Delegated EOA admission ${fieldName} must be 0x-prefixed hex bytes.`);
  }
  return normalized;
}

export function normalizeSelector(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  const normalized = normalizeIdentifier(value, fieldName).toLowerCase();
  if (!/^0x[0-9a-f]{8}$/u.test(normalized)) {
    throw new Error(`Delegated EOA admission ${fieldName} must be a 4-byte selector.`);
  }
  return normalized;
}

export function normalizeDecimalInteger(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^(?:0|[1-9]\d*)$/u.test(normalized)) {
    throw new Error(`Delegated EOA admission ${fieldName} must be a decimal integer.`);
  }
  return normalized;
}

export function normalizeOptionalDecimalInteger(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeDecimalInteger(value, fieldName);
}

export function normalizeQuantity(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName).toLowerCase();
  if (/^0x(?:0|[1-9a-f][0-9a-f]*)$/u.test(normalized)) return normalized;
  if (!/^(?:0|[1-9]\d*)$/u.test(normalized)) {
    throw new Error(
      `Delegated EOA admission ${fieldName} must be a decimal integer or 0x quantity.`,
    );
  }
  return normalized;
}

export function normalizeCaip2ChainId(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName).toLowerCase();
  if (!/^eip155:(?:0|[1-9]\d*)$/u.test(normalized)) {
    throw new Error(
      `Delegated EOA admission ${fieldName} must be an EIP-155 CAIP-2 chain id.`,
    );
  }
  return normalized;
}

export function normalizeYParity(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName).toLowerCase();
  if (normalized === '0' || normalized === '0x0') return '0';
  if (normalized === '1' || normalized === '0x1') return '1';
  throw new Error(`Delegated EOA admission ${fieldName} must be 0 or 1.`);
}

export function normalizeTransactionType(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName).toLowerCase();
  if (normalized === '0x4' || normalized === '0x04') return '0x04';
  throw new Error(`Delegated EOA admission ${fieldName} must be the EIP-7702 type 0x04.`);
}

export function normalizeDelegationIndicator(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  const normalized = normalizeIdentifier(value, fieldName).toLowerCase();
  if (!/^0xef0100[0-9a-f]{40}$/u.test(normalized)) {
    throw new Error(
      `Delegated EOA admission ${fieldName} must be a valid EIP-7702 delegation indicator.`,
    );
  }
  return normalized;
}

export function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

export function chainIdNumberFromCaip2(chainId: string): string {
  const [namespace, id] = chainId.split(':');
  if (namespace !== 'eip155' || !id) {
    throw new Error(
      'Delegated EOA admission requires an EIP-155 CAIP-2 chain id such as eip155:1.',
    );
  }
  return id;
}

export function chainIdHexFromCaip2(chainId: string): string {
  return `0x${BigInt(chainIdNumberFromCaip2(chainId)).toString(16)}`;
}

export function delegationIndicatorFor(address: string): string {
  return `${EIP7702_DELEGATION_INDICATOR_PREFIX}${address.slice(2)}`;
}

export function normalizeAuthorization(
  value: Eip7702AuthorizationTupleEvidence,
): Eip7702AuthorizationTupleEvidence {
  return Object.freeze({
    chainId: normalizeDecimalInteger(value.chainId, 'authorization.chainId'),
    authorityAddress: normalizeAddress(value.authorityAddress, 'authorization.authorityAddress'),
    delegationAddress: normalizeAddress(
      value.delegationAddress,
      'authorization.delegationAddress',
    ),
    nonce: normalizeDecimalInteger(value.nonce, 'authorization.nonce'),
    yParity: normalizeYParity(value.yParity, 'authorization.yParity'),
    r: normalizeHash(value.r, 'authorization.r'),
    s: normalizeHash(value.s, 'authorization.s'),
    tupleHash: normalizeOptionalHash(value.tupleHash, 'authorization.tupleHash'),
    signatureRecoveredAddress: normalizeOptionalAddress(
      value.signatureRecoveredAddress,
      'authorization.signatureRecoveredAddress',
    ),
    signatureValid: value.signatureValid,
    lowS: value.lowS,
  });
}

export function normalizeAccountState(
  value: Eip7702AccountStateEvidence,
): Eip7702AccountStateEvidence {
  const codeState = value.codeState;
  if (codeState !== 'empty' && codeState !== 'delegated' && codeState !== 'other-code') {
    throw new Error('Delegated EOA admission accountState.codeState is invalid.');
  }
  const pendingTransactionCount = value.pendingTransactionCount;
  if (
    pendingTransactionCount !== undefined &&
    pendingTransactionCount !== null &&
    (!Number.isInteger(pendingTransactionCount) || pendingTransactionCount < 0)
  ) {
    throw new Error(
      'Delegated EOA admission accountState.pendingTransactionCount must be a non-negative integer.',
    );
  }
  return Object.freeze({
    observedAt: normalizeIsoTimestamp(value.observedAt, 'accountState.observedAt'),
    chainId: normalizeCaip2ChainId(value.chainId, 'accountState.chainId'),
    authorityAddress: normalizeAddress(value.authorityAddress, 'accountState.authorityAddress'),
    currentNonce: normalizeDecimalInteger(value.currentNonce, 'accountState.currentNonce'),
    codeState,
    currentDelegationAddress: normalizeOptionalAddress(
      value.currentDelegationAddress,
      'accountState.currentDelegationAddress',
    ),
    delegationIndicator: normalizeDelegationIndicator(
      value.delegationIndicator,
      'accountState.delegationIndicator',
    ),
    codeHash: normalizeOptionalHash(value.codeHash, 'accountState.codeHash'),
    pendingTransactionCount:
      pendingTransactionCount === undefined ? null : pendingTransactionCount,
    pendingTransactionPolicyCompliant: value.pendingTransactionPolicyCompliant,
  });
}

export function normalizeDelegateCode(
  value: Eip7702DelegateCodeEvidence,
): Eip7702DelegateCodeEvidence {
  return Object.freeze({
    delegationAddress: normalizeAddress(value.delegationAddress, 'delegateCode.delegationAddress'),
    delegateCodeHash: normalizeHash(value.delegateCodeHash, 'delegateCode.delegateCodeHash'),
    delegateImplementationId: normalizeIdentifier(
      value.delegateImplementationId,
      'delegateCode.delegateImplementationId',
    ),
    audited: value.audited,
    allowlisted: value.allowlisted,
    storageLayoutSafe: value.storageLayoutSafe,
    supportsReplayProtection: value.supportsReplayProtection,
    supportsTargetCalldataBinding: value.supportsTargetCalldataBinding,
    supportsValueBinding: value.supportsValueBinding,
    supportsGasBinding: value.supportsGasBinding,
    supportsExpiryBinding: value.supportsExpiryBinding,
  });
}

export function normalizeExecution(value: Eip7702ExecutionEvidence): Eip7702ExecutionEvidence {
  const executionPath = value.executionPath;
  if (
    executionPath !== 'set-code-transaction' &&
    executionPath !== 'erc-4337-user-operation' &&
    executionPath !== 'wallet-call-api'
  ) {
    throw new Error('Delegated EOA admission execution.executionPath is invalid.');
  }
  const batchCallCount = value.batchCallCount;
  if (
    batchCallCount !== undefined &&
    batchCallCount !== null &&
    (!Number.isInteger(batchCallCount) || batchCallCount < 0)
  ) {
    throw new Error(
      'Delegated EOA admission execution.batchCallCount must be a non-negative integer.',
    );
  }
  return Object.freeze({
    executionPath,
    transactionType:
      value.transactionType === undefined || value.transactionType === null
        ? null
        : normalizeTransactionType(value.transactionType, 'execution.transactionType'),
    authorizationListLength: value.authorizationListLength,
    tupleIndex: value.tupleIndex,
    tupleIsLastValidForAuthority: value.tupleIsLastValidForAuthority,
    authorizationListNonEmpty: value.authorizationListNonEmpty,
    destination: normalizeAddress(value.destination, 'execution.destination'),
    target: normalizeAddress(value.target, 'execution.target'),
    value: normalizeQuantity(value.value, 'execution.value'),
    data: normalizeHexBytes(value.data, 'execution.data'),
    functionSelector: normalizeSelector(value.functionSelector, 'execution.functionSelector'),
    calldataClass: normalizeOptionalIdentifier(
      value.calldataClass,
      'execution.calldataClass',
    ),
    batchCallCount: batchCallCount === undefined ? null : batchCallCount,
    targetCalldataSigned: value.targetCalldataSigned,
    valueSigned: value.valueSigned,
    gasLimitSigned: value.gasLimitSigned,
    nonceSigned: value.nonceSigned,
    expirySigned: value.expirySigned,
    runtimeContextBound: value.runtimeContextBound,
    userOperationHash: normalizeOptionalHash(
      value.userOperationHash,
      'execution.userOperationHash',
    ),
    entryPoint: normalizeOptionalAddress(value.entryPoint, 'execution.entryPoint'),
    initCodeMarker: normalizeOptionalIdentifier(value.initCodeMarker, 'execution.initCodeMarker'),
    factoryDataHash: normalizeOptionalHash(value.factoryDataHash, 'execution.factoryDataHash'),
    eip7702AuthIncluded:
      value.eip7702AuthIncluded === undefined ? null : value.eip7702AuthIncluded,
    preVerificationGasIncludesAuthorizationCost:
      value.preVerificationGasIncludesAuthorizationCost === undefined
        ? null
        : value.preVerificationGasIncludesAuthorizationCost,
    walletCapabilityObserved:
      value.walletCapabilityObserved === undefined ? null : value.walletCapabilityObserved,
    walletCapabilitySupported:
      value.walletCapabilitySupported === undefined ? null : value.walletCapabilitySupported,
    walletCapabilityRequested:
      value.walletCapabilityRequested === undefined ? null : value.walletCapabilityRequested,
    atomicRequired: value.atomicRequired === undefined ? null : value.atomicRequired,
    postExecutionSuccess:
      value.postExecutionSuccess === undefined ? null : value.postExecutionSuccess,
  });
}

export function normalizeInitialization(
  value: Eip7702InitializationEvidence,
): Eip7702InitializationEvidence {
  return Object.freeze({
    initializationRequired: value.initializationRequired,
    initializationCalldataHash: normalizeOptionalHash(
      value.initializationCalldataHash,
      'initialization.initializationCalldataHash',
    ),
    initializationSignedByAuthority:
      value.initializationSignedByAuthority === undefined
        ? null
        : value.initializationSignedByAuthority,
    initializationExecutedBeforeValidation:
      value.initializationExecutedBeforeValidation === undefined
        ? null
        : value.initializationExecutedBeforeValidation,
    frontRunProtected:
      value.frontRunProtected === undefined ? null : value.frontRunProtected,
  });
}

export function normalizeSponsor(value: Eip7702SponsorEvidence): Eip7702SponsorEvidence {
  return Object.freeze({
    sponsored: value.sponsored,
    sponsorAddress: normalizeOptionalAddress(value.sponsorAddress, 'sponsor.sponsorAddress'),
    sponsorBondRequired:
      value.sponsorBondRequired === undefined ? null : value.sponsorBondRequired,
    sponsorBondPresent:
      value.sponsorBondPresent === undefined ? null : value.sponsorBondPresent,
    reimbursementBound:
      value.reimbursementBound === undefined ? null : value.reimbursementBound,
  });
}

export function normalizeRecovery(value: Eip7702RecoveryEvidence): Eip7702RecoveryEvidence {
  return Object.freeze({
    revocationPathReady: value.revocationPathReady,
    zeroAddressClearSupported: value.zeroAddressClearSupported,
    privateKeyStillControlsAccountAcknowledged:
      value.privateKeyStillControlsAccountAcknowledged,
    emergencyDelegateResetPrepared: value.emergencyDelegateResetPrepared,
    recoveryAuthorityRef: normalizeOptionalIdentifier(
      value.recoveryAuthorityRef,
      'recovery.recoveryAuthorityRef',
    ),
  });
}

export function normalizeRuntimeObservation(
  value: DelegatedEoaRuntimeObservation | null | undefined,
): DelegatedEoaRuntimeObservation | null {
  if (value === undefined || value === null) return null;
  const codeState = value.codeState ?? null;
  if (
    codeState !== null &&
    codeState !== 'empty' &&
    codeState !== 'delegated' &&
    codeState !== 'other-code'
  ) {
    throw new Error('Delegated EOA admission runtimeObservation.codeState is invalid.');
  }
  return Object.freeze({
    observedAt: normalizeIsoTimestamp(value.observedAt, 'runtimeObservation.observedAt'),
    txHash: normalizeOptionalHash(value.txHash, 'runtimeObservation.txHash'),
    success: value.success,
    receiptStatus: normalizeOptionalIdentifier(
      value.receiptStatus,
      'runtimeObservation.receiptStatus',
    ),
    codeState,
    delegationAddress: normalizeOptionalAddress(
      value.delegationAddress,
      'runtimeObservation.delegationAddress',
    ),
    nonce: normalizeOptionalDecimalInteger(value.nonce, 'runtimeObservation.nonce'),
  });
}
