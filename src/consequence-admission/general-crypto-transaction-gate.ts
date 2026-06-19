/**
 * General crypto transaction gate public surface.
 *
 * The implementation is split by contract, normalization helpers, check
 * builders, result construction, and descriptor exports while preserving the
 * public import path used by consequence-admission callers.
 */
export * from './general-crypto-transaction-gate-types.js';
export { createGeneralCryptoTransactionGateResult } from './general-crypto-transaction-gate-core.js';
export { generalCryptoTransactionGateDescriptor } from './general-crypto-transaction-gate-descriptor.js';
