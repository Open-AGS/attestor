import {
  CRYPTO_ALLOWANCE_AMOUNT_POSTURES,
  CRYPTO_ALLOWANCE_DURATION_POSTURES,
  CRYPTO_APPROVAL_ALLOWANCE_CHECKS,
  CRYPTO_APPROVAL_ALLOWANCE_CONSEQUENCE_SPEC_VERSION,
  CRYPTO_APPROVAL_ALLOWANCE_MECHANISMS,
  CRYPTO_APPROVAL_ALLOWANCE_OUTCOMES,
  CRYPTO_APPROVAL_ALLOWANCE_REVOCATION_METHODS,
  type CryptoApprovalAllowanceConsequence,
  type CryptoApprovalAllowanceConsequenceDescriptor,
} from './approval-allowance-consequence-types.js';

export function cryptoApprovalAllowanceConsequenceLabel(
  consequence: CryptoApprovalAllowanceConsequence,
): string {
  return [
    `approval:${consequence.intentId}`,
    `outcome:${consequence.outcome}`,
    `mechanism:${consequence.mechanism}`,
    `spender:${consequence.spenderAddress}`,
    `amount:${consequence.amountPosture}`,
    `duration:${consequence.durationPosture}`,
  ].join(' / ');
}

export function cryptoApprovalAllowanceConsequenceDescriptor():
CryptoApprovalAllowanceConsequenceDescriptor {
  return Object.freeze({
    version: CRYPTO_APPROVAL_ALLOWANCE_CONSEQUENCE_SPEC_VERSION,
    mechanisms: CRYPTO_APPROVAL_ALLOWANCE_MECHANISMS,
    amountPostures: CRYPTO_ALLOWANCE_AMOUNT_POSTURES,
    durationPostures: CRYPTO_ALLOWANCE_DURATION_POSTURES,
    outcomes: CRYPTO_APPROVAL_ALLOWANCE_OUTCOMES,
    revocationMethods: CRYPTO_APPROVAL_ALLOWANCE_REVOCATION_METHODS,
    checks: CRYPTO_APPROVAL_ALLOWANCE_CHECKS,
    standards: Object.freeze([
      'EIP-20',
      'ERC-20-approve',
      'EIP-2612',
      'Permit2',
      'ERC-7674',
      'ERC-7715-permission-ready',
      'EIP-712',
      'release-layer',
      'release-policy-control-plane',
      'release-enforcement-plane',
      'attestor-crypto-authorization-simulation',
    ]),
  });
}
