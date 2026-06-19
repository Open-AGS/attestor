import {
  SAFE_MODULE_GUARD_ADAPTER_SPEC_VERSION,
  SAFE_MODULE_GUARD_CHECKS,
  SAFE_MODULE_GUARD_HOOK_PHASES,
  SAFE_MODULE_GUARD_OUTCOMES,
  SAFE_MODULE_OPERATION_TYPES,
  type SafeModuleGuardAdapterDescriptor,
} from './safe-module-guard-adapter-types.js';

export function safeModuleGuardAdapterDescriptor():
SafeModuleGuardAdapterDescriptor {
  return Object.freeze({
    version: SAFE_MODULE_GUARD_ADAPTER_SPEC_VERSION,
    hookPhases: SAFE_MODULE_GUARD_HOOK_PHASES,
    operationTypes: SAFE_MODULE_OPERATION_TYPES,
    outcomes: SAFE_MODULE_GUARD_OUTCOMES,
    checks: SAFE_MODULE_GUARD_CHECKS,
    standards: Object.freeze([
      'Safe-Module-Guard',
      'setModuleGuard',
      'execTransactionFromModule',
      'checkModuleTransaction',
      'checkAfterModuleExecution',
      'ERC-4337-module-aware',
      'release-layer',
      'release-policy-control-plane',
      'release-enforcement-plane',
      'attestor-crypto-authorization-simulation',
    ]),
  });
}
