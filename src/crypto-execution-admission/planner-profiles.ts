import type { CryptoExecutionAdapterKind } from '../crypto-authorization-core/types.js';
import type { CryptoExecutionAdmissionAdapterProfile } from './planner.js';

export const CRYPTO_EXECUTION_ADMISSION_ADAPTER_PROFILES = Object.freeze({
  'adapter-neutral': Object.freeze({
    adapterKind: null,
    surface: 'attestor-core',
    standards: Object.freeze(['attestor-core']),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'policy-scope-binding',
      'enforcement-presentation',
    ]),
    submitStepKind: 'submit-execution',
    transportHeaders: Object.freeze([]),
  }),
  'safe-guard': Object.freeze({
    adapterKind: 'safe-guard',
    surface: 'smart-account-guard',
    standards: Object.freeze(['Safe Guard', 'ERC-1271']),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'safe-transaction-hash',
      'guard-precheck',
    ]),
    submitStepKind: 'run-smart-account-guard',
    transportHeaders: Object.freeze([]),
  }),
  'safe-module-guard': Object.freeze({
    adapterKind: 'safe-module-guard',
    surface: 'smart-account-guard',
    standards: Object.freeze(['Safe Module Guard', 'Safe Modules', 'ERC-1271']),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'safe-module-transaction-hash',
      'module-guard-precheck',
    ]),
    submitStepKind: 'run-smart-account-guard',
    transportHeaders: Object.freeze([]),
  }),
  'erc-4337-user-operation': Object.freeze({
    adapterKind: 'erc-4337-user-operation',
    surface: 'account-abstraction-bundler',
    standards: Object.freeze(['ERC-4337', 'ERC-7562', 'ERC-1271']),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'user-operation-hash',
      'simulate-validation-result',
    ]),
    submitStepKind: 'simulate-user-operation',
    transportHeaders: Object.freeze([]),
  }),
  'erc-7579-module': Object.freeze({
    adapterKind: 'erc-7579-module',
    surface: 'modular-account-runtime',
    standards: Object.freeze(['ERC-7579', 'ERC-4337']),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'module-installation-evidence',
      'module-hook-precheck',
    ]),
    submitStepKind: 'submit-execution',
    transportHeaders: Object.freeze([]),
  }),
  'erc-6900-plugin': Object.freeze({
    adapterKind: 'erc-6900-plugin',
    surface: 'modular-account-runtime',
    standards: Object.freeze(['ERC-6900', 'ERC-4337']),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'plugin-manifest-approval',
      'module-hook-precheck',
    ]),
    submitStepKind: 'submit-execution',
    transportHeaders: Object.freeze([]),
  }),
  'eip-7702-delegation': Object.freeze({
    adapterKind: 'eip-7702-delegation',
    surface: 'delegated-eoa-runtime',
    standards: Object.freeze(['EIP-7702', 'EIP-5792', 'ERC-7902']),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'authorization-list-tuple',
      'delegate-code-approval',
    ]),
    submitStepKind: 'prepare-wallet-call',
    transportHeaders: Object.freeze([]),
  }),
  'wallet-call-api': Object.freeze({
    adapterKind: 'wallet-call-api',
    surface: 'wallet-rpc',
    standards: Object.freeze(['EIP-5792', 'ERC-7715', 'ERC-7902']),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'wallet-capabilities',
      'prepared-call-bundle',
    ]),
    submitStepKind: 'prepare-wallet-call',
    transportHeaders: Object.freeze([]),
  }),
  'x402-payment': Object.freeze({
    adapterKind: 'x402-payment',
    surface: 'agent-payment-http',
    standards: Object.freeze(['x402-v2', 'HTTP 402', 'EIP-3009']),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'PAYMENT-REQUIRED',
      'PAYMENT-SIGNATURE',
      'PAYMENT-RESPONSE',
    ]),
    submitStepKind: 'verify-http-payment',
    transportHeaders: Object.freeze([
      'PAYMENT-REQUIRED',
      'PAYMENT-SIGNATURE',
      'PAYMENT-RESPONSE',
    ]),
  }),
  'custody-cosigner': Object.freeze({
    adapterKind: 'custody-cosigner',
    surface: 'custody-policy-engine',
    standards: Object.freeze(['custody-policy-engine', 'co-signer-callback']),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'custody-policy-decision',
      'co-signer-response',
    ]),
    submitStepKind: 'evaluate-custody-policy',
    transportHeaders: Object.freeze([]),
  }),
  'intent-settlement': Object.freeze({
    adapterKind: 'intent-settlement',
    surface: 'intent-solver',
    standards: Object.freeze(['intent-settlement', 'solver-preflight']),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'solver-route-commitment',
      'settlement-preflight',
    ]),
    submitStepKind: 'verify-intent-settlement',
    transportHeaders: Object.freeze([]),
  }),
} satisfies Record<
  CryptoExecutionAdapterKind | 'adapter-neutral',
  CryptoExecutionAdmissionAdapterProfile
>);
