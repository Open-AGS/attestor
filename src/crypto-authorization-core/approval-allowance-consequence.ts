/**
 * Approval and allowance consequence public surface.
 *
 * The implementation is split by contract, normalization helpers,
 * observation building, consequence construction, and descriptor exports while
 * preserving the original import path used by callers.
 */
export * from './approval-allowance-consequence-types.js';
export { CRYPTO_APPROVAL_MAX_UINT256 } from './approval-allowance-consequence-utils.js';
export { createCryptoApprovalAllowanceConsequence } from './approval-allowance-consequence-core.js';
export {
  cryptoApprovalAllowanceConsequenceDescriptor,
  cryptoApprovalAllowanceConsequenceLabel,
} from './approval-allowance-consequence-descriptor.js';
