export const X402_PAYER_ADDRESS = '0x1111111111111111111111111111111111111111';
export const X402_PAY_TO_ADDRESS = '0x2222222222222222222222222222222222222222';
export const X402_USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
export const X402_VERIFYING_CONTRACT = '0x9999999999999999999999999999999999999999';
export const X402_RESOURCE_URL = 'https://api.attestor.example/market-data/premium';
export const X402_FACILITATOR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';
export const X402_SIGNATURE = `0x${'11'.repeat(65)}`;
export const X402_AUTHORIZATION_NONCE = `0x${'aa'.repeat(32)}`;
export const X402_PAYLOAD_HASH = `0x${'bb'.repeat(32)}`;
export const X402_REQUIREMENTS_HASH = `0x${'cc'.repeat(32)}`;
export const X402_SETTLEMENT_TX = `0x${'dd'.repeat(32)}`;
export const X402_SPIFFE_ID = 'spiffe://attestor.test/ns/proof-surface/sa/x402-payment';

export const EIP7702_ACCOUNT_ADDRESS = '0x1111111111111111111111111111111111111111';
export const EIP7702_TARGET_ADDRESS = '0x2222222222222222222222222222222222222222';
export const EIP7702_DELEGATE_ADDRESS = '0x3333333333333333333333333333333333333333';
export const EIP7702_OTHER_ADDRESS = '0x6666666666666666666666666666666666666666';
export const EIP7702_VERIFYING_CONTRACT = '0x9999999999999999999999999999999999999999';
export const EIP7702_SIGNATURE = `0x${'11'.repeat(65)}`;
export const EIP7702_TUPLE_HASH = `0x${'aa'.repeat(32)}`;
export const EIP7702_DELEGATE_CODE_HASH = `0x${'bb'.repeat(32)}`;
export const EIP7702_INIT_DATA_HASH = `0x${'dd'.repeat(32)}`;
export const EIP7702_SPIFFE_ID =
  'spiffe://attestor.test/ns/proof-surface/sa/eip7702-delegation';

export const SIMULATED_AT_EPOCH_SECONDS = 1776762120;
export const FRESH_REVOCATION_CHECKED_AT_EPOCH_SECONDS = 1776762110;

export const PROOF_RECEIPT_SIGNER = Object.freeze({
  keyId: 'proof-surface-crypto-admission-receipt-key-001',
  secret: 'local-proof-surface-crypto-receipt-secret',
});

export const POLICY_DIMENSIONS = [
  'chain',
  'account',
  'actor',
  'asset',
  'counterparty',
  'spender',
  'protocol',
  'function-selector',
  'calldata-class',
  'amount',
  'budget',
  'validity-window',
  'cadence',
  'risk-tier',
  'approval-quorum',
  'runtime-context',
] as const;
