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
  type Eip7702DelegationAdapterDescriptor,
} from './eip7702-delegation-adapter-types.js';

export function eip7702DelegationAdapterDescriptor(): Eip7702DelegationAdapterDescriptor {
  return Object.freeze({
    version: EIP7702_DELEGATION_ADAPTER_SPEC_VERSION,
    adapterKind: 'eip-7702-delegation',
    transactionType: EIP7702_SET_CODE_TX_TYPE,
    authorizationMagic: EIP7702_AUTHORIZATION_MAGIC,
    delegationIndicatorPrefix: EIP7702_DELEGATION_INDICATOR_PREFIX,
    initCodeMarker: EIP7702_INITCODE_MARKER,
    executionPaths: EIP7702_EXECUTION_PATHS,
    accountCodeStates: EIP7702_ACCOUNT_CODE_STATES,
    outcomes: EIP7702_OUTCOMES,
    checks: EIP7702_CHECKS,
    references: Object.freeze([
      'EIP-7702',
      'EIP-2718',
      'EIP-155',
      'ERC-4337',
      'ERC-7769',
      'EIP-5792',
      'ERC-7902',
      'authorization-list',
      'delegation-indicator',
      'release-layer',
      'release-policy-control-plane',
      'release-enforcement-plane',
      'attestor-crypto-authorization-simulation',
    ]),
  });
}
