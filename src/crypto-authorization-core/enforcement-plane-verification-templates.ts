import type {
  CryptoExecutionBoundaryTemplate,
  CryptoExecutionBoundaryTemplateKey,
} from './enforcement-plane-verification.js';

export const CRYPTO_EXECUTION_BOUNDARY_TEMPLATES = Object.freeze({
  'adapter-neutral': Object.freeze({
    adapterKind: 'adapter-neutral',
    pointKind: 'application-middleware',
    boundaryKind: 'http-request',
    defaultPresentationModes: Object.freeze([
      'dpop-bound-token',
      'bearer-release-token',
      'http-message-signature',
    ] as const),
    notes:
      'Adapter-neutral crypto authorization defaults to an HTTP request boundary with reusable bearer or sender-constrained presentation.',
  }),
  'safe-guard': Object.freeze({
    adapterKind: 'safe-guard',
    pointKind: 'action-dispatch-gateway',
    boundaryKind: 'action-dispatch',
    defaultPresentationModes: Object.freeze([
      'mtls-bound-token',
      'spiffe-bound-token',
      'dpop-bound-token',
    ] as const),
    notes:
      'Safe transaction guards usually sit before high-consequence execution, so they default to an action-dispatch boundary with sender-constrained presentation.',
  }),
  'safe-module-guard': Object.freeze({
    adapterKind: 'safe-module-guard',
    pointKind: 'action-dispatch-gateway',
    boundaryKind: 'action-dispatch',
    defaultPresentationModes: Object.freeze([
      'mtls-bound-token',
      'spiffe-bound-token',
      'dpop-bound-token',
    ] as const),
    notes:
      'Safe module guards gate module-initiated execution and therefore default to sender-constrained action dispatch.',
  }),
  'erc-4337-user-operation': Object.freeze({
    adapterKind: 'erc-4337-user-operation',
    pointKind: 'action-dispatch-gateway',
    boundaryKind: 'action-dispatch',
    defaultPresentationModes: Object.freeze([
      'dpop-bound-token',
      'mtls-bound-token',
      'spiffe-bound-token',
    ] as const),
    notes:
      'UserOperation execution is an action-dispatch boundary with strongly preferred sender-constrained presentation.',
  }),
  'erc-7579-module': Object.freeze({
    adapterKind: 'erc-7579-module',
    pointKind: 'action-dispatch-gateway',
    boundaryKind: 'action-dispatch',
    defaultPresentationModes: Object.freeze([
      'mtls-bound-token',
      'spiffe-bound-token',
      'dpop-bound-token',
    ] as const),
    notes:
      'Modular account execution should reuse action-dispatch verification with workload or key-bound presentation.',
  }),
  'erc-6900-plugin': Object.freeze({
    adapterKind: 'erc-6900-plugin',
    pointKind: 'action-dispatch-gateway',
    boundaryKind: 'action-dispatch',
    defaultPresentationModes: Object.freeze([
      'mtls-bound-token',
      'spiffe-bound-token',
      'dpop-bound-token',
    ] as const),
    notes:
      'ERC-6900 plugin execution remains a fail-closed dispatch boundary with sender-constrained presentation.',
  }),
  'eip-7702-delegation': Object.freeze({
    adapterKind: 'eip-7702-delegation',
    pointKind: 'action-dispatch-gateway',
    boundaryKind: 'action-dispatch',
    defaultPresentationModes: Object.freeze([
      'dpop-bound-token',
      'mtls-bound-token',
      'spiffe-bound-token',
    ] as const),
    notes:
      'EIP-7702 delegation is an account-control action and should inherit the same high-consequence dispatch posture.',
  }),
  'wallet-call-api': Object.freeze({
    adapterKind: 'wallet-call-api',
    pointKind: 'application-middleware',
    boundaryKind: 'http-request',
    defaultPresentationModes: Object.freeze([
      'dpop-bound-token',
      'bearer-release-token',
      'http-message-signature',
    ] as const),
    notes:
      'Wallet call APIs are naturally HTTP-facing and can start with bearer or sender-constrained presentation before wallet execution.',
  }),
  'x402-payment': Object.freeze({
    adapterKind: 'x402-payment',
    pointKind: 'action-dispatch-gateway',
    boundaryKind: 'action-dispatch',
    defaultPresentationModes: Object.freeze([
      'http-message-signature',
      'dpop-bound-token',
      'bearer-release-token',
    ] as const),
    notes:
      'Programmatic HTTP payment flows move value and therefore use action-dispatch enforcement while preserving signed-request presentation.',
  }),
  'custody-cosigner': Object.freeze({
    adapterKind: 'custody-cosigner',
    pointKind: 'action-dispatch-gateway',
    boundaryKind: 'action-dispatch',
    defaultPresentationModes: Object.freeze([
      'signed-json-envelope',
      'spiffe-bound-token',
      'mtls-bound-token',
    ] as const),
    notes:
      'Custody co-signer requests move value and therefore use action-dispatch enforcement while preserving signed-envelope and workload-bound presentation.',
  }),
  'intent-settlement': Object.freeze({
    adapterKind: 'intent-settlement',
    pointKind: 'async-consumer',
    boundaryKind: 'async-message',
    defaultPresentationModes: Object.freeze([
      'signed-json-envelope',
      'spiffe-bound-token',
      'mtls-bound-token',
    ] as const),
    notes:
      'Intent settlement is usually asynchronous and should inherit the signed-envelope verification path.',
  }),
} satisfies Record<CryptoExecutionBoundaryTemplateKey, CryptoExecutionBoundaryTemplate>);
