import assert from 'node:assert/strict';
import {
  EIP7702_ACCOUNT_CODE_STATES,
  EIP7702_AUTHORIZATION_MAGIC,
  EIP7702_CHECKS,
  EIP7702_DELEGATION_ADAPTER_SPEC_VERSION,
  EIP7702_DELEGATION_INDICATOR_PREFIX,
  EIP7702_EXECUTION_PATHS,
  EIP7702_INITCODE_MARKER,
  EIP7702_OUTCOMES,
  EIP7702_SET_CODE_TX_TYPE,
  eip7702DelegationAdapterDescriptor,
  type Eip7702AccountStateEvidence,
  type Eip7702AuthorizationTupleEvidence,
  type Eip7702DelegateCodeEvidence,
  type Eip7702ExecutionEvidence,
  type Eip7702InitializationEvidence,
  type Eip7702RecoveryEvidence,
  type Eip7702SponsorEvidence,
} from '../src/crypto-authorization-core/eip7702-delegation-adapter.js';
import {
  createCryptoAccountReference,
  createCryptoChainReference,
} from '../src/crypto-authorization-core/types.js';

let passed = 0;

export const ACCOUNT_ADDRESS = '0x1111111111111111111111111111111111111111';
export const TARGET_ADDRESS = '0x2222222222222222222222222222222222222222';
export const DELEGATE_ADDRESS = '0x3333333333333333333333333333333333333333';
export const ENTRYPOINT_ADDRESS = '0x4444444444444444444444444444444444444444';
export const SPONSOR_ADDRESS = '0x5555555555555555555555555555555555555555';
export const OTHER_ADDRESS = '0x6666666666666666666666666666666666666666';
export const VERIFYING_CONTRACT = '0x9999999999999999999999999999999999999999';
export const SIGNATURE = `0x${'11'.repeat(65)}`;
export const TUPLE_HASH = `0x${'aa'.repeat(32)}`;
export const DELEGATE_CODE_HASH = `0x${'bb'.repeat(32)}`;
export const USER_OP_HASH = `0x${'cc'.repeat(32)}`;
export const INIT_DATA_HASH = `0x${'dd'.repeat(32)}`;
export const SPIFFE_ID = 'spiffe://attestor.test/ns/crypto/sa/eip7702-delegation';
export const SIMULATED_AT_EPOCH_SECONDS = 1776762120;
export const FRESH_REVOCATION_CHECKED_AT_EPOCH_SECONDS = 1776762110;

export function passedCount(): number {
  return passed;
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

export function throws(fn: () => unknown, expected: RegExp | ErrorConstructor, message?: string): void {
  assert.throws(fn, expected, message);
  passed += 1;
}

export function fixtureChain() {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId: '1',
  });
}

export function fixtureEoaAccount() {
  return createCryptoAccountReference({
    accountKind: 'eoa',
    chain: fixtureChain(),
    address: ACCOUNT_ADDRESS,
    accountLabel: 'Treasury EOA',
  });
}

export function authorization(
  overrides: Partial<Eip7702AuthorizationTupleEvidence> = {},
): Eip7702AuthorizationTupleEvidence {
  return {
    chainId: '1',
    authorityAddress: ACCOUNT_ADDRESS,
    delegationAddress: DELEGATE_ADDRESS,
    nonce: '7',
    yParity: '1',
    r: `0x${'12'.repeat(32)}`,
    s: `0x${'34'.repeat(32)}`,
    tupleHash: TUPLE_HASH,
    signatureRecoveredAddress: ACCOUNT_ADDRESS,
    signatureValid: true,
    lowS: true,
    ...overrides,
  };
}

export function accountState(
  overrides: Partial<Eip7702AccountStateEvidence> = {},
): Eip7702AccountStateEvidence {
  return {
    observedAt: '2026-04-21T09:02:00.000Z',
    chainId: 'eip155:1',
    authorityAddress: ACCOUNT_ADDRESS,
    currentNonce: '7',
    codeState: 'empty',
    currentDelegationAddress: null,
    delegationIndicator: null,
    codeHash: null,
    pendingTransactionCount: 1,
    pendingTransactionPolicyCompliant: true,
    ...overrides,
  };
}

export function delegateCode(
  overrides: Partial<Eip7702DelegateCodeEvidence> = {},
): Eip7702DelegateCodeEvidence {
  return {
    delegationAddress: DELEGATE_ADDRESS,
    delegateCodeHash: DELEGATE_CODE_HASH,
    delegateImplementationId: 'delegate.safe-eip7702.1.0.0',
    audited: true,
    allowlisted: true,
    storageLayoutSafe: true,
    supportsReplayProtection: true,
    supportsTargetCalldataBinding: true,
    supportsValueBinding: true,
    supportsGasBinding: true,
    supportsExpiryBinding: true,
    ...overrides,
  };
}

export function execution(
  overrides: Partial<Eip7702ExecutionEvidence> = {},
): Eip7702ExecutionEvidence {
  return {
    executionPath: 'set-code-transaction',
    transactionType: EIP7702_SET_CODE_TX_TYPE,
    authorizationListLength: 1,
    tupleIndex: 0,
    tupleIsLastValidForAuthority: true,
    authorizationListNonEmpty: true,
    destination: ACCOUNT_ADDRESS,
    target: TARGET_ADDRESS,
    value: '0',
    data: '0x12345678abcdef',
    functionSelector: '0x12345678',
    calldataClass: 'bounded-delegated-call',
    batchCallCount: 1,
    targetCalldataSigned: true,
    valueSigned: true,
    gasLimitSigned: true,
    nonceSigned: true,
    expirySigned: true,
    runtimeContextBound: true,
    userOperationHash: null,
    entryPoint: null,
    initCodeMarker: null,
    factoryDataHash: null,
    eip7702AuthIncluded: null,
    preVerificationGasIncludesAuthorizationCost: null,
    walletCapabilityObserved: null,
    walletCapabilitySupported: null,
    walletCapabilityRequested: null,
    atomicRequired: null,
    postExecutionSuccess: null,
    ...overrides,
  };
}

export function initialization(
  overrides: Partial<Eip7702InitializationEvidence> = {},
): Eip7702InitializationEvidence {
  return {
    initializationRequired: true,
    initializationCalldataHash: INIT_DATA_HASH,
    initializationSignedByAuthority: true,
    initializationExecutedBeforeValidation: true,
    frontRunProtected: true,
    ...overrides,
  };
}

export function sponsor(overrides: Partial<Eip7702SponsorEvidence> = {}): Eip7702SponsorEvidence {
  return {
    sponsored: false,
    sponsorAddress: null,
    sponsorBondRequired: null,
    sponsorBondPresent: null,
    reimbursementBound: null,
    ...overrides,
  };
}

export function recovery(overrides: Partial<Eip7702RecoveryEvidence> = {}): Eip7702RecoveryEvidence {
  return {
    revocationPathReady: true,
    zeroAddressClearSupported: true,
    privateKeyStillControlsAccountAcknowledged: true,
    emergencyDelegateResetPrepared: true,
    recoveryAuthorityRef: 'authority:treasury-eip7702-recovery',
    ...overrides,
  };
}

export function testDescriptor(): void {
  const descriptor = eip7702DelegationAdapterDescriptor();

  equal(
    descriptor.version,
    EIP7702_DELEGATION_ADAPTER_SPEC_VERSION,
    'EIP-7702 delegation adapter: descriptor exposes version',
  );
  equal(
    descriptor.transactionType,
    EIP7702_SET_CODE_TX_TYPE,
    'EIP-7702 delegation adapter: descriptor exposes set-code transaction type',
  );
  equal(
    descriptor.authorizationMagic,
    EIP7702_AUTHORIZATION_MAGIC,
    'EIP-7702 delegation adapter: descriptor exposes authorization magic',
  );
  equal(
    descriptor.delegationIndicatorPrefix,
    EIP7702_DELEGATION_INDICATOR_PREFIX,
    'EIP-7702 delegation adapter: descriptor exposes delegation indicator prefix',
  );
  equal(
    descriptor.initCodeMarker,
    EIP7702_INITCODE_MARKER,
    'EIP-7702 delegation adapter: descriptor exposes initCode marker',
  );
  deepEqual(
    descriptor.executionPaths,
    EIP7702_EXECUTION_PATHS,
    'EIP-7702 delegation adapter: descriptor exposes execution paths',
  );
  deepEqual(
    descriptor.accountCodeStates,
    EIP7702_ACCOUNT_CODE_STATES,
    'EIP-7702 delegation adapter: descriptor exposes account code states',
  );
  deepEqual(
    descriptor.outcomes,
    EIP7702_OUTCOMES,
    'EIP-7702 delegation adapter: descriptor exposes outcomes',
  );
  deepEqual(
    descriptor.checks,
    EIP7702_CHECKS,
    'EIP-7702 delegation adapter: descriptor exposes checks',
  );
  ok(
    descriptor.references.includes('EIP-7702'),
    'EIP-7702 delegation adapter: descriptor names EIP-7702',
  );
  ok(
    descriptor.references.includes('ERC-4337'),
    'EIP-7702 delegation adapter: descriptor names ERC-4337 integration',
  );
  ok(
    descriptor.references.includes('ERC-7902'),
    'EIP-7702 delegation adapter: descriptor names wallet capability integration',
  );
}
