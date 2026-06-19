import { keccak_256 } from '@noble/hashes/sha3.js';
import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoAccountKind } from './types.js';
import type {
  CreateErc4337UserOperationPreflightInput,
  Erc4337BundlerValidation,
  Erc4337EntityStatus,
  Erc4337EntryPointVersion,
  Erc4337UserOperation,
  Erc4337UserOperationObservationStatus,
  Erc4337ValidationStatus,
  Erc4337ValidationWindow,
} from './erc4337-user-operation-adapter-types.js';
import {
  ERC4337_USER_OPERATION_ENTITY_STATUSES,
  ERC4337_USER_OPERATION_ENTRYPOINT_VERSIONS,
  ERC4337_USER_OPERATION_SUPPORTED_ACCOUNT_KINDS,
  ERC4337_USER_OPERATION_VALIDATION_STATUSES,
} from './erc4337-user-operation-adapter-types.js';

export const ZERO_EVM_ADDRESS = '0x0000000000000000000000000000000000000000';
const EIP_7702_FACTORY_MARKER = '0x7702';
const ERC4337_PACKED_USEROP_TYPE =
  'PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)';
const ERC4337_EIP712_DOMAIN_TYPE =
  'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
const ERC4337_DOMAIN_NAME = 'ERC4337';
const ERC4337_DOMAIN_VERSION = '1';
const UINT_128_MAX = (1n << 128n) - 1n;
const UINT_256_MAX = (1n << 256n) - 1n;

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`ERC-4337 UserOperation adapter ${fieldName} requires a non-empty value.`);
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
    throw new Error(`ERC-4337 UserOperation adapter ${fieldName} must be an ISO timestamp.`);
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
    throw new Error(`ERC-4337 UserOperation adapter ${fieldName} must be an EVM address.`);
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

function normalizeFactory(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = normalizeIdentifier(value, 'userOperation.factory').toLowerCase();
  if (normalized === EIP_7702_FACTORY_MARKER) {
    return normalized;
  }
  return normalizeAddress(normalized, 'userOperation.factory');
}

function normalizeHash(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error(`ERC-4337 UserOperation adapter ${fieldName} must be a 32-byte hex value.`);
  }
  return normalized.toLowerCase();
}

function normalizeHexData(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^0x(?:[a-fA-F0-9]{2})*$/.test(normalized)) {
    throw new Error(`ERC-4337 UserOperation adapter ${fieldName} must be hex bytes.`);
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
    throw new Error(`ERC-4337 UserOperation adapter ${fieldName} must be a non-negative integer string.`);
  }
  return normalized;
}

function normalizeOptionalUintString(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeUintString(value, fieldName);
}

function normalizePositiveUintString(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeUintString(value, fieldName);
  if (BigInt(normalized) <= 0n) {
    throw new Error(`ERC-4337 UserOperation adapter ${fieldName} must be a positive integer string.`);
  }
  return normalized;
}

function stripHexPrefix(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function utf8Hex(value: string): string {
  return Buffer.from(value, 'utf8').toString('hex');
}

function keccakHex(value: string): string {
  return `0x${Buffer.from(keccak_256(Buffer.from(stripHexPrefix(value), 'hex'))).toString('hex')}`;
}

function keccakUtf8(value: string): string {
  return keccakHex(`0x${utf8Hex(value)}`);
}

function encodeUintWord(value: string | bigint, fieldName: string): string {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (parsed < 0n || parsed > UINT_256_MAX) {
    throw new Error(`ERC-4337 UserOperation adapter ${fieldName} exceeds uint256.`);
  }
  return parsed.toString(16).padStart(64, '0');
}

function encodeUint128Half(value: string | bigint, fieldName: string): string {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (parsed < 0n || parsed > UINT_128_MAX) {
    throw new Error(`ERC-4337 UserOperation adapter ${fieldName} exceeds uint128.`);
  }
  return parsed.toString(16).padStart(32, '0');
}

function encodeAddressWord(value: string): string {
  return stripHexPrefix(value).padStart(64, '0');
}

function encodeBytes32Word(value: string): string {
  const stripped = stripHexPrefix(value);
  if (stripped.length !== 64) {
    throw new Error('ERC-4337 UserOperation adapter expected a bytes32 word.');
  }
  return stripped;
}

function abiEncodeWords(words: readonly string[]): string {
  return `0x${words.join('')}`;
}

function packUint128Pair(input: {
  readonly high: string;
  readonly low: string;
  readonly highFieldName: string;
  readonly lowFieldName: string;
}): string {
  return `0x${encodeUint128Half(input.high, input.highFieldName)}${encodeUint128Half(
    input.low,
    input.lowFieldName,
  )}`;
}

export function caip2ChainIdAsUint(input: string): string {
  const match = /^eip155:(0|[1-9]\d*)$/.exec(input);
  if (match === null) {
    throw new Error('ERC-4337 UserOperation adapter userOperation.chainId must be an eip155 CAIP-2 chain id.');
  }
  return match[1] ?? '0';
}

function initCodeForUserOperation(userOperation: Erc4337UserOperation): string {
  if (userOperation.factory === null || userOperation.factory === undefined) {
    return '0x';
  }
  if (userOperation.factory === EIP_7702_FACTORY_MARKER) {
    throw new Error('EIP-7702 UserOperation hash recomputation requires on-chain delegate-code evidence.');
  }
  return `0x${stripHexPrefix(userOperation.factory)}${stripHexPrefix(userOperation.factoryData ?? '0x')}`;
}

function paymasterAndDataForUserOperation(userOperation: Erc4337UserOperation): string {
  if (userOperation.paymaster === null || userOperation.paymaster === undefined) {
    return '0x';
  }
  if (userOperation.entryPointVersion === 'v0.6') {
    return `0x${stripHexPrefix(userOperation.paymaster)}${stripHexPrefix(userOperation.paymasterData ?? '0x')}`;
  }
  if (
    userOperation.paymasterVerificationGasLimit === null ||
    userOperation.paymasterVerificationGasLimit === undefined ||
    userOperation.paymasterPostOpGasLimit === null ||
    userOperation.paymasterPostOpGasLimit === undefined
  ) {
    throw new Error('ERC-4337 UserOperation adapter paymaster gas limits are required for packed EntryPoint versions.');
  }
  return `0x${stripHexPrefix(userOperation.paymaster)}${encodeUint128Half(
    userOperation.paymasterVerificationGasLimit,
    'userOperation.paymasterVerificationGasLimit',
  )}${encodeUint128Half(
    userOperation.paymasterPostOpGasLimit,
    'userOperation.paymasterPostOpGasLimit',
  )}${stripHexPrefix(userOperation.paymasterData ?? '0x')}`;
}

function v06UserOperationStructHash(userOperation: Erc4337UserOperation): string {
  const initCodeHash = keccakHex(initCodeForUserOperation(userOperation));
  const callDataHash = keccakHex(userOperation.callData);
  const paymasterAndDataHash = keccakHex(paymasterAndDataForUserOperation(userOperation));
  return keccakHex(
    abiEncodeWords([
      encodeAddressWord(userOperation.sender),
      encodeUintWord(userOperation.nonce, 'userOperation.nonce'),
      encodeBytes32Word(initCodeHash),
      encodeBytes32Word(callDataHash),
      encodeUintWord(userOperation.callGasLimit, 'userOperation.callGasLimit'),
      encodeUintWord(userOperation.verificationGasLimit, 'userOperation.verificationGasLimit'),
      encodeUintWord(userOperation.preVerificationGas, 'userOperation.preVerificationGas'),
      encodeUintWord(userOperation.maxFeePerGas, 'userOperation.maxFeePerGas'),
      encodeUintWord(userOperation.maxPriorityFeePerGas, 'userOperation.maxPriorityFeePerGas'),
      encodeBytes32Word(paymasterAndDataHash),
    ]),
  );
}

function packedUserOperationStructHash(userOperation: Erc4337UserOperation): string {
  const accountGasLimits = packUint128Pair({
    high: userOperation.verificationGasLimit,
    low: userOperation.callGasLimit,
    highFieldName: 'userOperation.verificationGasLimit',
    lowFieldName: 'userOperation.callGasLimit',
  });
  const gasFees = packUint128Pair({
    high: userOperation.maxPriorityFeePerGas,
    low: userOperation.maxFeePerGas,
    highFieldName: 'userOperation.maxPriorityFeePerGas',
    lowFieldName: 'userOperation.maxFeePerGas',
  });
  const fields = [
    encodeAddressWord(userOperation.sender),
    encodeUintWord(userOperation.nonce, 'userOperation.nonce'),
    encodeBytes32Word(keccakHex(initCodeForUserOperation(userOperation))),
    encodeBytes32Word(keccakHex(userOperation.callData)),
    encodeBytes32Word(accountGasLimits),
    encodeUintWord(userOperation.preVerificationGas, 'userOperation.preVerificationGas'),
    encodeBytes32Word(gasFees),
    encodeBytes32Word(keccakHex(paymasterAndDataForUserOperation(userOperation))),
  ];
  if (userOperation.entryPointVersion === 'v0.8') {
    return keccakHex(
      abiEncodeWords([
        encodeBytes32Word(keccakUtf8(ERC4337_PACKED_USEROP_TYPE)),
        ...fields,
      ]),
    );
  }
  return keccakHex(abiEncodeWords(fields));
}

function eip712DomainSeparator(input: {
  readonly chainId: string;
  readonly verifyingContract: string;
}): string {
  return keccakHex(
    abiEncodeWords([
      encodeBytes32Word(keccakUtf8(ERC4337_EIP712_DOMAIN_TYPE)),
      encodeBytes32Word(keccakUtf8(ERC4337_DOMAIN_NAME)),
      encodeBytes32Word(keccakUtf8(ERC4337_DOMAIN_VERSION)),
      encodeUintWord(input.chainId, 'userOperation.chainId'),
      encodeAddressWord(input.verifyingContract),
    ]),
  );
}

function computeNormalizedErc4337UserOperationHash(
  userOperation: Erc4337UserOperation,
): string {
  const chainId = caip2ChainIdAsUint(userOperation.chainId);
  if (userOperation.entryPointVersion === 'v0.6') {
    return keccakHex(
      abiEncodeWords([
        encodeBytes32Word(v06UserOperationStructHash(userOperation)),
        encodeAddressWord(userOperation.entryPoint),
        encodeUintWord(chainId, 'userOperation.chainId'),
      ]),
    );
  }
  const structHash = packedUserOperationStructHash(userOperation);
  if (userOperation.entryPointVersion === 'v0.8') {
    return keccakHex(
      `0x1901${stripHexPrefix(eip712DomainSeparator({
        chainId,
        verifyingContract: userOperation.entryPoint,
      }))}${stripHexPrefix(structHash)}`,
    );
  }
  return keccakHex(
    abiEncodeWords([
      encodeBytes32Word(structHash),
      encodeAddressWord(userOperation.entryPoint),
      encodeUintWord(chainId, 'userOperation.chainId'),
    ]),
  );
}

export function userOperationHashBinding(userOperation: Erc4337UserOperation): {
  readonly status: Erc4337UserOperationObservationStatus;
  readonly code: string;
  readonly computedUserOpHash: string | null;
  readonly error: string | null;
} {
  try {
    const computedUserOpHash = computeNormalizedErc4337UserOperationHash(userOperation);
    if (computedUserOpHash !== userOperation.userOpHash) {
      return Object.freeze({
        status: 'fail',
        code: 'erc4337-userop-hash-mismatch',
        computedUserOpHash,
        error: null,
      });
    }
    return Object.freeze({
      status: 'pass',
      code: 'erc4337-userop-hash-verified',
      computedUserOpHash,
      error: null,
    });
  } catch (error) {
    return Object.freeze({
      status: 'fail',
      code: 'erc4337-userop-hash-unverified',
      computedUserOpHash: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function computeErc4337UserOperationHash(
  input: Erc4337UserOperation,
): string {
  return computeNormalizedErc4337UserOperationHash(normalizedUserOperation(input));
}

function normalizeOptionalCallCount(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('ERC-4337 UserOperation adapter userOperation.callCount must be a positive integer.');
  }
  return value;
}

export function caip2ChainId(intent: CryptoAuthorizationIntent): string {
  return `${intent.chain.namespace}:${intent.chain.chainId}`;
}

export function sameAddress(left: string, right: string | null | undefined): boolean {
  if (!right) {
    return false;
  }
  return left.toLowerCase() === right.toLowerCase();
}

function statusFrom(input: Erc4337ValidationStatus): Erc4337ValidationStatus {
  if (!ERC4337_USER_OPERATION_VALIDATION_STATUSES.includes(input)) {
    throw new Error(`ERC-4337 UserOperation adapter does not support validation status ${input}.`);
  }
  return input;
}

function entityStatusFrom(
  input: Erc4337EntityStatus | null | undefined,
  fallback: Erc4337EntityStatus,
): Erc4337EntityStatus {
  if (input === undefined || input === null) {
    return fallback;
  }
  if (!ERC4337_USER_OPERATION_ENTITY_STATUSES.includes(input)) {
    throw new Error(`ERC-4337 UserOperation adapter does not support entity status ${input}.`);
  }
  return input;
}

function entryPointVersionFrom(input: Erc4337EntryPointVersion): Erc4337EntryPointVersion {
  if (!ERC4337_USER_OPERATION_ENTRYPOINT_VERSIONS.includes(input)) {
    throw new Error(`ERC-4337 UserOperation adapter does not support EntryPoint version ${input}.`);
  }
  return input;
}

export function nonceMatches(intentNonce: string, userOperationNonce: string): boolean {
  return (
    intentNonce === userOperationNonce ||
    intentNonce === `userop:${userOperationNonce}` ||
    intentNonce === `user-operation:${userOperationNonce}` ||
    intentNonce === `entrypoint:nonce:${userOperationNonce}` ||
    intentNonce.endsWith(`:${userOperationNonce}`)
  );
}

export function compareUintStrings(left: string, right: string): number {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  if (leftValue === rightValue) return 0;
  return leftValue > rightValue ? 1 : -1;
}

function normalizeValidationWindow(
  value: Erc4337ValidationWindow | null | undefined,
  fieldName: string,
): Erc4337ValidationWindow | null {
  if (value === undefined || value === null) {
    return null;
  }
  return Object.freeze({
    validAfter: normalizeOptionalIsoTimestamp(value.validAfter, `${fieldName}.validAfter`),
    validUntil: normalizeOptionalIsoTimestamp(value.validUntil, `${fieldName}.validUntil`),
  });
}

function timestampMillis(value: string): number {
  return new Date(value).getTime();
}

export function validationWindowInsideIntent(input: {
  readonly window: Erc4337ValidationWindow | null;
  readonly intent: CryptoAuthorizationIntent;
}): boolean {
  const validAfter = input.window?.validAfter ?? null;
  const validUntil = input.window?.validUntil ?? null;
  if (validAfter === null || validUntil === null) {
    return false;
  }
  return (
    timestampMillis(validAfter) >= timestampMillis(input.intent.constraints.validAfter) &&
    timestampMillis(validUntil) <= timestampMillis(input.intent.constraints.validUntil)
  );
}

export function validationWindowEvidence(
  window: Erc4337ValidationWindow | null | undefined,
): CanonicalReleaseJsonValue {
  if (window === undefined || window === null) {
    return null;
  }
  return Object.freeze({
    validAfter: window.validAfter ?? null,
    validUntil: window.validUntil ?? null,
  });
}

export function isSupportedErc4337AccountKind(accountKind: CryptoAccountKind): boolean {
  return (ERC4337_USER_OPERATION_SUPPORTED_ACCOUNT_KINDS as readonly CryptoAccountKind[]).includes(
    accountKind,
  );
}

export function normalizedUserOperation(input: Erc4337UserOperation): Erc4337UserOperation {
  return Object.freeze({
    sender: normalizeAddress(input.sender, 'userOperation.sender'),
    nonce: normalizeUintString(input.nonce, 'userOperation.nonce'),
    entryPoint: normalizeAddress(input.entryPoint, 'userOperation.entryPoint'),
    entryPointVersion: entryPointVersionFrom(input.entryPointVersion),
    chainId: normalizeIdentifier(input.chainId, 'userOperation.chainId'),
    callData: normalizeHexData(input.callData, 'userOperation.callData'),
    callTarget: normalizeOptionalAddress(input.callTarget, 'userOperation.callTarget'),
    callValue: normalizeOptionalUintString(input.callValue, 'userOperation.callValue'),
    callFunctionSelector: normalizeOptionalIdentifier(
      input.callFunctionSelector?.toLowerCase(),
      'userOperation.callFunctionSelector',
    ),
    callDataClass: normalizeOptionalIdentifier(input.callDataClass, 'userOperation.callDataClass'),
    callCount: normalizeOptionalCallCount(input.callCount),
    factory: normalizeFactory(input.factory),
    factoryData: normalizeOptionalHexData(input.factoryData, 'userOperation.factoryData'),
    callGasLimit: normalizePositiveUintString(input.callGasLimit, 'userOperation.callGasLimit'),
    verificationGasLimit: normalizePositiveUintString(
      input.verificationGasLimit,
      'userOperation.verificationGasLimit',
    ),
    preVerificationGas: normalizePositiveUintString(
      input.preVerificationGas,
      'userOperation.preVerificationGas',
    ),
    maxFeePerGas: normalizePositiveUintString(input.maxFeePerGas, 'userOperation.maxFeePerGas'),
    maxPriorityFeePerGas: normalizeUintString(
      input.maxPriorityFeePerGas,
      'userOperation.maxPriorityFeePerGas',
    ),
    paymaster: normalizeOptionalAddress(input.paymaster, 'userOperation.paymaster'),
    paymasterVerificationGasLimit: normalizeOptionalUintString(
      input.paymasterVerificationGasLimit,
      'userOperation.paymasterVerificationGasLimit',
    ),
    paymasterPostOpGasLimit: normalizeOptionalUintString(
      input.paymasterPostOpGasLimit,
      'userOperation.paymasterPostOpGasLimit',
    ),
    paymasterData: normalizeOptionalHexData(input.paymasterData, 'userOperation.paymasterData'),
    signature: normalizeHexData(input.signature, 'userOperation.signature'),
    userOpHash: normalizeHash(input.userOpHash, 'userOperation.userOpHash'),
  });
}

export function normalizedBundlerValidation(
  input: Erc4337BundlerValidation,
  userOperation: Erc4337UserOperation,
): Erc4337BundlerValidation {
  const paymasterUsed = userOperation.paymaster !== null;
  const factoryUsed =
    userOperation.factory !== null || input.senderAlreadyDeployed === false;
  return Object.freeze({
    validatedAt: normalizeIsoTimestamp(input.validatedAt, 'bundlerValidation.validatedAt'),
    bundlerId: normalizeIdentifier(input.bundlerId, 'bundlerValidation.bundlerId'),
    entryPointSupported: input.entryPointSupported,
    simulateValidationStatus: statusFrom(input.simulateValidationStatus),
    erc7562ValidationStatus: statusFrom(input.erc7562ValidationStatus),
    accountValidationStatus: statusFrom(input.accountValidationStatus),
    signatureValidationStatus: statusFrom(input.signatureValidationStatus),
    nonceValidationStatus: statusFrom(input.nonceValidationStatus),
    senderAlreadyDeployed: input.senderAlreadyDeployed ?? null,
    factoryStatus: entityStatusFrom(
      input.factoryStatus,
      factoryUsed ? 'not-ready' : 'not-used',
    ),
    paymasterStatus: entityStatusFrom(
      input.paymasterStatus,
      paymasterUsed ? 'not-ready' : 'not-used',
    ),
    paymasterStakeReady: input.paymasterStakeReady ?? null,
    paymasterDepositReady: input.paymasterDepositReady ?? null,
    prefundCovered: input.prefundCovered,
    gasLimitsWithinPolicy: input.gasLimitsWithinPolicy,
    bannedOpcodeDetected: input.bannedOpcodeDetected ?? false,
    storageAccessViolation: input.storageAccessViolation ?? false,
    unstakedEntityAccessDetected: input.unstakedEntityAccessDetected ?? false,
    aggregatorAddress: normalizeOptionalAddress(
      input.aggregatorAddress,
      'bundlerValidation.aggregatorAddress',
    ),
    accountValidation: normalizeValidationWindow(
      input.accountValidation,
      'bundlerValidation.accountValidation',
    ),
    paymasterValidation: normalizeValidationWindow(
      input.paymasterValidation,
      'bundlerValidation.paymasterValidation',
    ),
  });
}

export function assertAdapterConsistency(input: CreateErc4337UserOperationPreflightInput): void {
  if (input.intent.executionAdapterKind !== 'erc-4337-user-operation') {
    throw new Error('ERC-4337 UserOperation adapter requires intent.executionAdapterKind erc-4337-user-operation.');
  }
  if (input.riskAssessment.consequenceKind !== input.intent.consequenceKind) {
    throw new Error('ERC-4337 UserOperation adapter risk consequence does not match intent.');
  }
  if (input.releaseBinding.cryptoDecisionId !== input.policyScopeBinding.cryptoDecisionId) {
    throw new Error('ERC-4337 UserOperation adapter policy binding does not match release binding.');
  }
  if (input.releaseBinding.cryptoDecisionId !== input.enforcementBinding.cryptoDecisionId) {
    throw new Error('ERC-4337 UserOperation adapter enforcement binding does not match release binding.');
  }
  if (input.enforcementBinding.adapterKind !== 'erc-4337-user-operation') {
    throw new Error('ERC-4337 UserOperation adapter requires erc-4337-user-operation enforcement binding.');
  }
  if (input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind !== 'action-dispatch') {
    throw new Error('ERC-4337 UserOperation adapter requires action-dispatch enforcement.');
  }
  if (!input.enforcementBinding.verificationProfile.failClosed) {
    throw new Error('ERC-4337 UserOperation adapter requires fail-closed enforcement verification.');
  }
}
