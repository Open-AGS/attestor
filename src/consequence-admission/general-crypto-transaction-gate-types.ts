export const GENERAL_CRYPTO_TRANSACTION_GATE_VERSION =
  'attestor.general-crypto-transaction-gate.v1';

export const GENERAL_CRYPTO_TRANSACTION_ACTIONS = [
  'native.transfer',
  'erc20.transfer',
  'erc20.approve',
  'permit.sign',
  'swap.execute',
  'bridge.transfer',
  'safe.tx.propose',
  'userop.submit',
  'session_key.grant',
  'delegation.authorize',
  'x402.pay',
] as const;
export type GeneralCryptoTransactionAction =
  typeof GENERAL_CRYPTO_TRANSACTION_ACTIONS[number];

export const GENERAL_CRYPTO_TRANSACTION_GATE_DECISIONS = [
  'admit',
  'review',
  'block',
] as const;
export type GeneralCryptoTransactionGateDecision =
  typeof GENERAL_CRYPTO_TRANSACTION_GATE_DECISIONS[number];

export const GENERAL_CRYPTO_TRANSACTION_GATE_CHECK_OUTCOMES = [
  'pass',
  'review',
  'fail',
] as const;
export type GeneralCryptoTransactionGateCheckOutcome =
  typeof GENERAL_CRYPTO_TRANSACTION_GATE_CHECK_OUTCOMES[number];

export const GENERAL_CRYPTO_TRANSACTION_GATE_RISK_CLASSES = [
  'R2',
  'R3',
  'R4',
] as const;
export type GeneralCryptoTransactionGateRiskClass =
  typeof GENERAL_CRYPTO_TRANSACTION_GATE_RISK_CLASSES[number];

export const GENERAL_CRYPTO_CHAIN_POLICY_STATUSES = [
  'matched',
  'mismatch',
  'unknown',
] as const;
export type GeneralCryptoChainPolicyStatus =
  typeof GENERAL_CRYPTO_CHAIN_POLICY_STATUSES[number];

export const GENERAL_CRYPTO_SIMULATION_STATUSES = [
  'passed',
  'missing',
  'failed',
  'not-required',
] as const;
export type GeneralCryptoSimulationStatus =
  typeof GENERAL_CRYPTO_SIMULATION_STATUSES[number];

export const GENERAL_CRYPTO_ALLOWANCE_POSTURES = [
  'not-applicable',
  'bounded',
  'increase',
  'temporary',
  'unlimited',
  'unknown',
] as const;
export type GeneralCryptoAllowancePosture =
  typeof GENERAL_CRYPTO_ALLOWANCE_POSTURES[number];

export const GENERAL_CRYPTO_COUNTERPARTY_TRUST = [
  'known',
  'unknown',
  'denied',
] as const;
export type GeneralCryptoCounterpartyTrust =
  typeof GENERAL_CRYPTO_COUNTERPARTY_TRUST[number];

export const GENERAL_CRYPTO_PERMIT_DOMAIN_STATUSES = [
  'not-applicable',
  'matched',
  'missing',
  'mismatch',
] as const;
export type GeneralCryptoPermitDomainStatus =
  typeof GENERAL_CRYPTO_PERMIT_DOMAIN_STATUSES[number];

export const GENERAL_CRYPTO_ROUTE_STATUSES = [
  'not-applicable',
  'route-and-simulation-bound',
  'route-missing',
  'slippage-missing',
  'simulation-missing',
  'destination-risk-unknown',
] as const;
export type GeneralCryptoRouteStatus =
  typeof GENERAL_CRYPTO_ROUTE_STATUSES[number];

export const GENERAL_CRYPTO_SAFE_STATUSES = [
  'not-applicable',
  'quorum-met',
  'quorum-missing',
  'guard-missing',
  'safe-tx-hash-missing',
] as const;
export type GeneralCryptoSafeStatus =
  typeof GENERAL_CRYPTO_SAFE_STATUSES[number];

export const GENERAL_CRYPTO_USER_OPERATION_STATUSES = [
  'not-applicable',
  'validated',
  'simulation-missing',
  'validation-failed',
  'entrypoint-missing',
  'userop-hash-missing',
] as const;
export type GeneralCryptoUserOperationStatus =
  typeof GENERAL_CRYPTO_USER_OPERATION_STATUSES[number];

export const GENERAL_CRYPTO_SESSION_KEY_SCOPES = [
  'not-applicable',
  'bounded',
  'missing',
  'overbroad',
  'unknown',
] as const;
export type GeneralCryptoSessionKeyScope =
  typeof GENERAL_CRYPTO_SESSION_KEY_SCOPES[number];

export const GENERAL_CRYPTO_DELEGATION_POSTURES = [
  'not-applicable',
  'bounded',
  'missing',
  'overbroad',
  'unknown',
] as const;
export type GeneralCryptoDelegationPosture =
  typeof GENERAL_CRYPTO_DELEGATION_POSTURES[number];

export const GENERAL_CRYPTO_X402_STATUSES = [
  'not-applicable',
  'verified-and-settled',
  'payment-required-missing',
  'verify-missing',
  'verify-failed',
  'settle-missing',
  'settle-failed',
] as const;
export type GeneralCryptoX402Status =
  typeof GENERAL_CRYPTO_X402_STATUSES[number];

export interface GeneralCryptoTransactionGateInput {
  readonly generatedAt?: string | null;
  readonly tenantRefDigest: string;
  readonly actorRefDigest: string;
  readonly walletAccountRefDigest: string;
  readonly actionRequestDigest: string;
  readonly policyCandidateDigest: string;
  readonly approvalRefDigest?: string | null;
  readonly executionPlanDigest?: string | null;
  readonly simulationDigest?: string | null;
  readonly receiptRefDigest?: string | null;
  readonly assetRefDigest?: string | null;
  readonly targetContractRefDigest?: string | null;
  readonly counterpartyRefDigest?: string | null;
  readonly amountRefDigest?: string | null;
  readonly callDataDigest?: string | null;
  readonly typedDataDigest?: string | null;
  readonly routeRefDigest?: string | null;
  readonly chainId: string;
  readonly chainPolicyStatus: GeneralCryptoChainPolicyStatus;
  readonly action: GeneralCryptoTransactionAction;
  readonly simulationStatus: GeneralCryptoSimulationStatus;
  readonly allowancePosture?: GeneralCryptoAllowancePosture | null;
  readonly counterpartyTrust?: GeneralCryptoCounterpartyTrust | null;
  readonly permitDomainStatus?: GeneralCryptoPermitDomainStatus | null;
  readonly routeStatus?: GeneralCryptoRouteStatus | null;
  readonly safeStatus?: GeneralCryptoSafeStatus | null;
  readonly userOperationStatus?: GeneralCryptoUserOperationStatus | null;
  readonly sessionKeyScope?: GeneralCryptoSessionKeyScope | null;
  readonly delegationPosture?: GeneralCryptoDelegationPosture | null;
  readonly x402Status?: GeneralCryptoX402Status | null;
}

export interface GeneralCryptoTransactionGateCheck {
  readonly checkId: string;
  readonly outcome: GeneralCryptoTransactionGateCheckOutcome;
  readonly reasonCode: string;
  readonly message: string;
  readonly requiredEvidence: readonly string[];
  readonly standards: readonly string[];
}

export interface GeneralCryptoTransactionGateResult {
  readonly version: typeof GENERAL_CRYPTO_TRANSACTION_GATE_VERSION;
  readonly generatedAt: string;
  readonly tenantRefDigest: string;
  readonly actorRefDigest: string;
  readonly walletAccountRefDigest: string;
  readonly actionRequestDigest: string;
  readonly policyCandidateDigest: string;
  readonly approvalRefDigest: string | null;
  readonly executionPlanDigest: string | null;
  readonly simulationDigest: string | null;
  readonly receiptRefDigest: string | null;
  readonly assetRefDigest: string | null;
  readonly targetContractRefDigest: string | null;
  readonly counterpartyRefDigest: string | null;
  readonly amountRefDigest: string | null;
  readonly callDataDigest: string | null;
  readonly typedDataDigest: string | null;
  readonly routeRefDigest: string | null;
  readonly chainId: string;
  readonly chainPolicyStatus: GeneralCryptoChainPolicyStatus;
  readonly action: GeneralCryptoTransactionAction;
  readonly riskClass: GeneralCryptoTransactionGateRiskClass;
  readonly decision: GeneralCryptoTransactionGateDecision;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly customerGateAction: 'proceed' | 'hold';
  readonly checks: readonly GeneralCryptoTransactionGateCheck[];
  readonly reasonCodes: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly nextActions: readonly string[];
  readonly standards: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly signsTransaction: false;
  readonly broadcastsTransaction: false;
  readonly custodyWallet: false;
  readonly chainAnalyticsProvider: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GeneralCryptoTransactionGateDescriptor {
  readonly version: typeof GENERAL_CRYPTO_TRANSACTION_GATE_VERSION;
  readonly actions: typeof GENERAL_CRYPTO_TRANSACTION_ACTIONS;
  readonly decisions: typeof GENERAL_CRYPTO_TRANSACTION_GATE_DECISIONS;
  readonly checkOutcomes: typeof GENERAL_CRYPTO_TRANSACTION_GATE_CHECK_OUTCOMES;
  readonly riskClasses: typeof GENERAL_CRYPTO_TRANSACTION_GATE_RISK_CLASSES;
  readonly chainPolicyStatuses: typeof GENERAL_CRYPTO_CHAIN_POLICY_STATUSES;
  readonly simulationStatuses: typeof GENERAL_CRYPTO_SIMULATION_STATUSES;
  readonly allowancePostures: typeof GENERAL_CRYPTO_ALLOWANCE_POSTURES;
  readonly counterpartyTrust: typeof GENERAL_CRYPTO_COUNTERPARTY_TRUST;
  readonly permitDomainStatuses: typeof GENERAL_CRYPTO_PERMIT_DOMAIN_STATUSES;
  readonly routeStatuses: typeof GENERAL_CRYPTO_ROUTE_STATUSES;
  readonly safeStatuses: typeof GENERAL_CRYPTO_SAFE_STATUSES;
  readonly userOperationStatuses: typeof GENERAL_CRYPTO_USER_OPERATION_STATUSES;
  readonly sessionKeyScopes: typeof GENERAL_CRYPTO_SESSION_KEY_SCOPES;
  readonly delegationPostures: typeof GENERAL_CRYPTO_DELEGATION_POSTURES;
  readonly x402Statuses: typeof GENERAL_CRYPTO_X402_STATUSES;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly signsTransaction: false;
  readonly broadcastsTransaction: false;
  readonly custodyWallet: false;
  readonly chainAnalyticsProvider: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}
