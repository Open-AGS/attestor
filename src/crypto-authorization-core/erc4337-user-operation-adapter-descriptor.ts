import {
  ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION,
  ERC4337_USER_OPERATION_CHECKS,
  ERC4337_USER_OPERATION_ENTITY_STATUSES,
  ERC4337_USER_OPERATION_ENTRYPOINT_VERSIONS,
  ERC4337_USER_OPERATION_OUTCOMES,
  ERC4337_USER_OPERATION_SUPPORTED_ACCOUNT_KINDS,
  ERC4337_USER_OPERATION_VALIDATION_STATUSES,
  type Erc4337UserOperationAdapterDescriptor,
} from './erc4337-user-operation-adapter-types.js';

export function erc4337UserOperationAdapterDescriptor():
Erc4337UserOperationAdapterDescriptor {
  return Object.freeze({
    version: ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION,
    entryPointVersions: ERC4337_USER_OPERATION_ENTRYPOINT_VERSIONS,
    outcomes: ERC4337_USER_OPERATION_OUTCOMES,
    validationStatuses: ERC4337_USER_OPERATION_VALIDATION_STATUSES,
    entityStatuses: ERC4337_USER_OPERATION_ENTITY_STATUSES,
    supportedAccountKinds: ERC4337_USER_OPERATION_SUPPORTED_ACCOUNT_KINDS,
    checks: ERC4337_USER_OPERATION_CHECKS,
    standards: Object.freeze([
      'ERC-4337',
      'UserOperation',
      'EntryPoint',
      'simulateValidation',
      'handleOps',
      'ERC-7562',
      'Paymaster',
      'Factory',
      'EIP-7702-aware',
      'release-layer',
      'release-policy-control-plane',
      'release-enforcement-plane',
      'attestor-crypto-authorization-simulation',
    ]),
  });
}
