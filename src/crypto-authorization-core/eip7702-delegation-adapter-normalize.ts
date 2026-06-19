import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import {
  EIP7702_ACCOUNT_CODE_STATES,
  EIP7702_EXECUTION_PATHS,
  type Eip7702AccountCodeState,
  type Eip7702AccountStateEvidence,
  type Eip7702AuthorizationTupleEvidence,
  type Eip7702DelegateCodeEvidence,
  type Eip7702ExecutionEvidence,
  type Eip7702ExecutionPath,
  type Eip7702InitializationEvidence,
  type Eip7702RecoveryEvidence,
  type Eip7702SponsorEvidence,
} from './eip7702-delegation-adapter-types.js';

export const ZERO_EVM_ADDRESS = '0x0000000000000000000000000000000000000000';

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`EIP-7702 delegation adapter ${fieldName} requires a non-empty value.`);
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
    throw new Error(`EIP-7702 delegation adapter ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeAddress(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
    throw new Error(`EIP-7702 delegation adapter ${fieldName} must be an EVM address.`);
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
    throw new Error(`EIP-7702 delegation adapter ${fieldName} must be a 32-byte hex value.`);
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
    throw new Error(`EIP-7702 delegation adapter ${fieldName} must be a 4-byte selector.`);
  }
  return normalized;
}

function normalizeHexBytes(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^0x(?:[a-fA-F0-9]{2})*$/.test(normalized)) {
    throw new Error(`EIP-7702 delegation adapter ${fieldName} must be hex bytes.`);
  }
  return normalized.toLowerCase();
}

function normalizeOptionalHexBytes(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeHexBytes(value, fieldName);
}

function normalizeUintString(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^(?:0|[1-9]\d*)$/.test(normalized)) {
    throw new Error(`EIP-7702 delegation adapter ${fieldName} must be a non-negative integer string.`);
  }
  return normalized;
}

function normalizeTupleChainId(value: string): string {
  const normalized = normalizeUintString(value, 'authorization.chainId');
  const asBigInt = BigInt(normalized);
  if (asBigInt >= 2n ** 256n) {
    throw new Error('EIP-7702 delegation adapter authorization.chainId must fit uint256.');
  }
  return normalized;
}

function normalizeAuthorityNonce(value: string): string {
  const normalized = normalizeUintString(value, 'authorization.nonce');
  const asBigInt = BigInt(normalized);
  if (asBigInt >= 2n ** 64n) {
    throw new Error('EIP-7702 delegation adapter authorization.nonce must fit uint64.');
  }
  return normalized;
}

function normalizeYParity(value: string): string {
  const normalized = normalizeUintString(value, 'authorization.yParity');
  if (normalized !== '0' && normalized !== '1') {
    throw new Error('EIP-7702 delegation adapter authorization.yParity must be 0 or 1.');
  }
  return normalized;
}

function normalizeSignatureComponent(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName).toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`EIP-7702 delegation adapter ${fieldName} must be a 32-byte secp256k1 component.`);
  }
  return normalized;
}

function normalizePositiveInteger(value: number | null | undefined, fieldName: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`EIP-7702 delegation adapter ${fieldName} must be a non-negative integer.`);
  }
  return value;
}

function executionPathFrom(input: Eip7702ExecutionPath): Eip7702ExecutionPath {
  if (!EIP7702_EXECUTION_PATHS.includes(input)) {
    throw new Error(`EIP-7702 delegation adapter does not support execution path ${input}.`);
  }
  return input;
}

function accountCodeStateFrom(input: Eip7702AccountCodeState): Eip7702AccountCodeState {
  if (!EIP7702_ACCOUNT_CODE_STATES.includes(input)) {
    throw new Error(`EIP-7702 delegation adapter does not support account code state ${input}.`);
  }
  return input;
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

export function caip2ChainId(intent: CryptoAuthorizationIntent): string {
  return `${intent.chain.namespace}:${intent.chain.chainId}`;
}

export function eip155ChainId(intent: CryptoAuthorizationIntent): string {
  if (intent.chain.namespace !== 'eip155') {
    throw new Error('EIP-7702 delegation adapter requires an EIP-155 chain.');
  }
  return intent.chain.chainId;
}

export function sameAddress(left: string, right: string | null | undefined): boolean {
  if (!right) {
    return false;
  }
  return left.toLowerCase() === right.toLowerCase();
}

export function nonceMatches(intentNonce: string, authorityNonce: string): boolean {
  return (
    intentNonce === authorityNonce ||
    intentNonce === `authorization-list:nonce:${authorityNonce}` ||
    intentNonce === `eip7702:nonce:${authorityNonce}` ||
    intentNonce === `delegation:nonce:${authorityNonce}` ||
    intentNonce.endsWith(`:${authorityNonce}`)
  );
}

export function normalizeAuthorization(
  input: Eip7702AuthorizationTupleEvidence,
): Eip7702AuthorizationTupleEvidence {
  return Object.freeze({
    chainId: normalizeTupleChainId(input.chainId),
    authorityAddress: normalizeAddress(input.authorityAddress, 'authorization.authorityAddress'),
    delegationAddress: normalizeAddress(input.delegationAddress, 'authorization.delegationAddress'),
    nonce: normalizeAuthorityNonce(input.nonce),
    yParity: normalizeYParity(input.yParity),
    r: normalizeSignatureComponent(input.r, 'authorization.r'),
    s: normalizeSignatureComponent(input.s, 'authorization.s'),
    tupleHash: normalizeOptionalHash(input.tupleHash, 'authorization.tupleHash'),
    signatureRecoveredAddress: normalizeOptionalAddress(
      input.signatureRecoveredAddress,
      'authorization.signatureRecoveredAddress',
    ),
    signatureValid: input.signatureValid,
    lowS: input.lowS,
  });
}

export function normalizeAccountState(input: Eip7702AccountStateEvidence): Eip7702AccountStateEvidence {
  return Object.freeze({
    observedAt: normalizeIsoTimestamp(input.observedAt, 'accountState.observedAt'),
    chainId: normalizeIdentifier(input.chainId, 'accountState.chainId'),
    authorityAddress: normalizeAddress(input.authorityAddress, 'accountState.authorityAddress'),
    currentNonce: normalizeAuthorityNonce(input.currentNonce),
    codeState: accountCodeStateFrom(input.codeState),
    currentDelegationAddress: normalizeOptionalAddress(
      input.currentDelegationAddress,
      'accountState.currentDelegationAddress',
    ),
    delegationIndicator: normalizeOptionalHexBytes(
      input.delegationIndicator,
      'accountState.delegationIndicator',
    ),
    codeHash: normalizeOptionalHash(input.codeHash, 'accountState.codeHash'),
    pendingTransactionCount: normalizePositiveInteger(
      input.pendingTransactionCount,
      'accountState.pendingTransactionCount',
    ),
    pendingTransactionPolicyCompliant: input.pendingTransactionPolicyCompliant,
  });
}

export function normalizeDelegateCode(input: Eip7702DelegateCodeEvidence): Eip7702DelegateCodeEvidence {
  return Object.freeze({
    delegationAddress: normalizeAddress(input.delegationAddress, 'delegateCode.delegationAddress'),
    delegateCodeHash: normalizeHash(input.delegateCodeHash, 'delegateCode.delegateCodeHash'),
    delegateImplementationId: normalizeIdentifier(
      input.delegateImplementationId,
      'delegateCode.delegateImplementationId',
    ),
    audited: input.audited,
    allowlisted: input.allowlisted,
    storageLayoutSafe: input.storageLayoutSafe,
    supportsReplayProtection: input.supportsReplayProtection,
    supportsTargetCalldataBinding: input.supportsTargetCalldataBinding,
    supportsValueBinding: input.supportsValueBinding,
    supportsGasBinding: input.supportsGasBinding,
    supportsExpiryBinding: input.supportsExpiryBinding,
  });
}

function normalizeBatchCallCount(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('EIP-7702 delegation adapter execution.batchCallCount must be a positive integer.');
  }
  return value;
}

export function normalizeExecution(input: Eip7702ExecutionEvidence): Eip7702ExecutionEvidence {
  const authorizationListLength = normalizePositiveInteger(
    input.authorizationListLength,
    'execution.authorizationListLength',
  ) ?? 0;
  const tupleIndex = normalizePositiveInteger(input.tupleIndex, 'execution.tupleIndex') ?? 0;
  return Object.freeze({
    executionPath: executionPathFrom(input.executionPath),
    transactionType: normalizeOptionalIdentifier(input.transactionType, 'execution.transactionType')?.toLowerCase() ?? null,
    authorizationListLength,
    tupleIndex,
    tupleIsLastValidForAuthority: input.tupleIsLastValidForAuthority,
    authorizationListNonEmpty: input.authorizationListNonEmpty,
    destination: normalizeAddress(input.destination, 'execution.destination'),
    target: normalizeAddress(input.target, 'execution.target'),
    value: normalizeUintString(input.value, 'execution.value'),
    data: normalizeHexBytes(input.data, 'execution.data'),
    functionSelector: normalizeSelector(input.functionSelector, 'execution.functionSelector'),
    calldataClass: normalizeOptionalIdentifier(input.calldataClass, 'execution.calldataClass'),
    batchCallCount: normalizeBatchCallCount(input.batchCallCount),
    targetCalldataSigned: input.targetCalldataSigned,
    valueSigned: input.valueSigned,
    gasLimitSigned: input.gasLimitSigned,
    nonceSigned: input.nonceSigned,
    expirySigned: input.expirySigned,
    runtimeContextBound: input.runtimeContextBound,
    userOperationHash: normalizeOptionalHash(input.userOperationHash, 'execution.userOperationHash'),
    entryPoint: normalizeOptionalAddress(input.entryPoint, 'execution.entryPoint'),
    initCodeMarker: normalizeOptionalIdentifier(input.initCodeMarker, 'execution.initCodeMarker')?.toLowerCase() ?? null,
    factoryDataHash: normalizeOptionalHash(input.factoryDataHash, 'execution.factoryDataHash'),
    eip7702AuthIncluded: input.eip7702AuthIncluded ?? null,
    preVerificationGasIncludesAuthorizationCost:
      input.preVerificationGasIncludesAuthorizationCost ?? null,
    walletCapabilityObserved: input.walletCapabilityObserved ?? null,
    walletCapabilitySupported: input.walletCapabilitySupported ?? null,
    walletCapabilityRequested: input.walletCapabilityRequested ?? null,
    atomicRequired: input.atomicRequired ?? null,
    postExecutionSuccess: input.postExecutionSuccess ?? null,
  });
}

export function normalizeInitialization(
  input: Eip7702InitializationEvidence,
): Eip7702InitializationEvidence {
  return Object.freeze({
    initializationRequired: input.initializationRequired,
    initializationCalldataHash: normalizeOptionalHash(
      input.initializationCalldataHash,
      'initialization.initializationCalldataHash',
    ),
    initializationSignedByAuthority: input.initializationSignedByAuthority ?? null,
    initializationExecutedBeforeValidation:
      input.initializationExecutedBeforeValidation ?? null,
    frontRunProtected: input.frontRunProtected ?? null,
  });
}

export function normalizeSponsor(input: Eip7702SponsorEvidence): Eip7702SponsorEvidence {
  return Object.freeze({
    sponsored: input.sponsored,
    sponsorAddress: normalizeOptionalAddress(input.sponsorAddress, 'sponsor.sponsorAddress'),
    sponsorBondRequired: input.sponsorBondRequired ?? null,
    sponsorBondPresent: input.sponsorBondPresent ?? null,
    reimbursementBound: input.reimbursementBound ?? null,
  });
}

export function normalizeRecovery(input: Eip7702RecoveryEvidence): Eip7702RecoveryEvidence {
  return Object.freeze({
    revocationPathReady: input.revocationPathReady,
    zeroAddressClearSupported: input.zeroAddressClearSupported,
    privateKeyStillControlsAccountAcknowledged:
      input.privateKeyStillControlsAccountAcknowledged,
    emergencyDelegateResetPrepared: input.emergencyDelegateResetPrepared,
    recoveryAuthorityRef: normalizeOptionalIdentifier(
      input.recoveryAuthorityRef,
      'recovery.recoveryAuthorityRef',
    ),
  });
}
