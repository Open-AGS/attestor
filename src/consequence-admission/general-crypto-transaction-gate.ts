import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';

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

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CHAIN_ID_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,62}$/u;

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`General crypto transaction gate ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeDigest(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`General crypto transaction gate ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null || value.trim().length === 0) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeEnum<T extends readonly string[]>(
  value: T[number],
  allowed: T,
  fieldName: string,
): T[number] {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`General crypto transaction gate ${fieldName} is not supported.`);
  }
  return value;
}

function optionalEnum<T extends readonly string[]>(
  value: T[number] | null | undefined,
  allowed: T,
  fallback: T[number],
  fieldName: string,
): T[number] {
  if (value === undefined || value === null) return fallback;
  return normalizeEnum(value, allowed, fieldName);
}

function normalizeChainId(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!CHAIN_ID_PATTERN.test(normalized)) {
    throw new Error('General crypto transaction gate chainId must be a safe chain identifier.');
  }
  return normalized;
}

function check(
  checkId: string,
  outcome: GeneralCryptoTransactionGateCheckOutcome,
  reasonCode: string,
  message: string,
  requiredEvidence: readonly string[],
  standards: readonly string[],
): GeneralCryptoTransactionGateCheck {
  return Object.freeze({
    checkId,
    outcome,
    reasonCode,
    message,
    requiredEvidence: Object.freeze([...requiredEvidence]),
    standards: Object.freeze([...standards]),
  });
}

function digestPresenceCheck(
  checkId: string,
  digest: string | null,
  reasonCode: string,
  label: string,
  standards: readonly string[],
  reviewOnly = false,
): GeneralCryptoTransactionGateCheck {
  if (digest !== null) {
    return check(
      checkId,
      'pass',
      `${reasonCode}-bound`,
      `${label} digest is bound.`,
      [label],
      standards,
    );
  }
  return check(
    checkId,
    reviewOnly ? 'review' : 'fail',
    `${reasonCode}-missing`,
    `${label} digest is missing.`,
    [label],
    standards,
  );
}

function riskClassFor(action: GeneralCryptoTransactionAction): GeneralCryptoTransactionGateRiskClass {
  if (
    action === 'bridge.transfer' ||
    action === 'session_key.grant' ||
    action === 'delegation.authorize'
  ) {
    return 'R4';
  }
  if (
    action === 'erc20.approve' ||
    action === 'permit.sign' ||
    action === 'swap.execute' ||
    action === 'safe.tx.propose' ||
    action === 'userop.submit'
  ) {
    return 'R3';
  }
  return 'R2';
}

function standardsFor(action: GeneralCryptoTransactionAction): readonly string[] {
  switch (action) {
    case 'native.transfer':
      return Object.freeze(['EVM transaction']);
    case 'erc20.transfer':
      return Object.freeze(['ERC-20']);
    case 'erc20.approve':
      return Object.freeze(['ERC-20']);
    case 'permit.sign':
      return Object.freeze(['EIP-712', 'EIP-2612']);
    case 'swap.execute':
      return Object.freeze(['EIP-5792', 'simulation']);
    case 'bridge.transfer':
      return Object.freeze(['ERC-7683', 'simulation']);
    case 'safe.tx.propose':
      return Object.freeze(['Safe Transaction Service', 'Safe Guard']);
    case 'userop.submit':
      return Object.freeze(['ERC-4337', 'ERC-7562']);
    case 'session_key.grant':
      return Object.freeze(['ERC-7715']);
    case 'delegation.authorize':
      return Object.freeze(['EIP-7702']);
    case 'x402.pay':
      return Object.freeze(['x402']);
  }
}

function simulationCheck(
  status: GeneralCryptoSimulationStatus,
  simulationDigest: string | null,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action === 'x402.pay' && status === 'not-required') {
    return check(
      'simulation-binding',
      'pass',
      'simulation-not-required-for-x402',
      'x402 payment admission is bound through verify and settle evidence instead of transaction simulation.',
      ['x402 verify result', 'x402 settle result'],
      standards,
    );
  }
  if (status === 'passed' && simulationDigest !== null) {
    return check(
      'simulation-binding',
      'pass',
      'simulation-bound',
      'Simulation digest is present and marked passed.',
      ['simulation digest'],
      standards,
    );
  }
  if (status === 'failed') {
    return check(
      'simulation-binding',
      'fail',
      'simulation-failed',
      'Simulation failed for the proposed crypto action.',
      ['passing simulation digest'],
      standards,
    );
  }
  return check(
    'simulation-binding',
    'review',
    'simulation-missing',
    'Simulation evidence is missing or incomplete.',
    ['simulation digest'],
    standards,
  );
}

function allowanceCheck(
  posture: GeneralCryptoAllowancePosture,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'erc20.approve' && action !== 'permit.sign') {
    return check(
      'allowance-boundary',
      'pass',
      'allowance-not-applicable',
      'Allowance boundary is not applicable to this action.',
      [],
      standards,
    );
  }
  if (posture === 'unlimited') {
    return check(
      'allowance-boundary',
      'fail',
      'unlimited-approval',
      'Unlimited allowance is not admitted by the general gate.',
      ['bounded allowance ref'],
      standards,
    );
  }
  if (posture === 'unknown' || posture === 'not-applicable') {
    return check(
      'allowance-boundary',
      'review',
      'allowance-posture-missing',
      'Allowance posture is missing or not classified.',
      ['allowance posture ref'],
      standards,
    );
  }
  return check(
    'allowance-boundary',
    'pass',
    'allowance-bounded',
    'Allowance is classified as bounded, increased, or temporary.',
    ['bounded allowance ref'],
    standards,
  );
}

function counterpartyTrustCheck(
  trust: GeneralCryptoCounterpartyTrust,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (
    action !== 'erc20.approve' &&
    action !== 'permit.sign' &&
    action !== 'session_key.grant' &&
    action !== 'delegation.authorize'
  ) {
    return check(
      'counterparty-trust',
      'pass',
      'counterparty-trust-not-applicable',
      'Counterparty trust classification is not applicable to this action.',
      [],
      standards,
    );
  }
  if (trust === 'known') {
    return check(
      'counterparty-trust',
      'pass',
      'counterparty-known',
      'Counterparty is classified as known for this action.',
      ['trusted counterparty ref'],
      standards,
    );
  }
  return check(
    'counterparty-trust',
    'fail',
    trust === 'denied' ? 'spender-denied' : 'spender-unknown',
    trust === 'denied'
      ? 'The spender/counterparty is explicitly denied.'
      : 'The spender/counterparty trust status is unknown.',
    ['trusted counterparty ref'],
    standards,
  );
}

function permitDomainCheck(
  status: GeneralCryptoPermitDomainStatus,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'permit.sign') {
    return check(
      'permit-domain',
      'pass',
      'permit-domain-not-applicable',
      'Permit domain binding is not applicable to this action.',
      [],
      standards,
    );
  }
  if (status === 'matched') {
    return check(
      'permit-domain',
      'pass',
      'permit-domain-matched',
      'Permit typed-data domain is bound to the expected chain and verifying contract.',
      ['typed data digest', 'domain separator evidence'],
      standards,
    );
  }
  return check(
    'permit-domain',
    status === 'mismatch' ? 'fail' : 'review',
    status === 'mismatch' ? 'permit-domain-mismatch' : 'permit-domain-missing',
    status === 'mismatch'
      ? 'Permit typed-data domain does not match the expected chain or verifying contract.'
      : 'Permit typed-data domain evidence is missing.',
    ['typed data digest', 'domain separator evidence'],
    standards,
  );
}

function routeCheck(
  status: GeneralCryptoRouteStatus,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'swap.execute' && action !== 'bridge.transfer') {
    return check(
      'route-and-slippage',
      'pass',
      'route-not-applicable',
      'Route and slippage binding is not applicable to this action.',
      [],
      standards,
    );
  }
  if (status === 'route-and-simulation-bound') {
    return check(
      'route-and-slippage',
      'pass',
      'route-and-simulation-bound',
      'Route, slippage, destination, and simulation evidence are bound.',
      ['route ref', 'simulation digest', 'slippage or destination risk ref'],
      standards,
    );
  }
  return check(
    'route-and-slippage',
    'review',
    status,
    'Route, slippage, destination, or simulation evidence is incomplete.',
    ['route ref', 'simulation digest', 'slippage or destination risk ref'],
    standards,
  );
}

function safeCheck(
  status: GeneralCryptoSafeStatus,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'safe.tx.propose') {
    return check(
      'safe-transaction',
      'pass',
      'safe-not-applicable',
      'Safe transaction evidence is not applicable to this action.',
      [],
      standards,
    );
  }
  if (status === 'quorum-met') {
    return check(
      'safe-transaction',
      'pass',
      'safe-quorum-met',
      'Safe transaction hash and quorum evidence are bound.',
      ['safe transaction hash', 'quorum or guard evidence'],
      standards,
    );
  }
  return check(
    'safe-transaction',
    status === 'safe-tx-hash-missing' ? 'fail' : 'review',
    status,
    'Safe transaction hash, quorum, or guard evidence is incomplete.',
    ['safe transaction hash', 'quorum or guard evidence'],
    standards,
  );
}

function userOperationCheck(
  status: GeneralCryptoUserOperationStatus,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'userop.submit') {
    return check(
      'user-operation',
      'pass',
      'userop-not-applicable',
      'UserOperation evidence is not applicable to this action.',
      [],
      standards,
    );
  }
  if (status === 'validated') {
    return check(
      'user-operation',
      'pass',
      'userop-validated',
      'UserOperation hash, EntryPoint, and validation simulation are bound.',
      ['user operation hash', 'entrypoint ref', 'simulateValidation result'],
      standards,
    );
  }
  return check(
    'user-operation',
    status === 'validation-failed' ? 'fail' : 'review',
    status,
    'UserOperation EntryPoint, hash, or validation evidence is incomplete.',
    ['user operation hash', 'entrypoint ref', 'simulateValidation result'],
    standards,
  );
}

function sessionKeyCheck(
  scope: GeneralCryptoSessionKeyScope,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'session_key.grant') {
    return check(
      'session-key-scope',
      'pass',
      'session-key-not-applicable',
      'Session-key scope is not applicable to this action.',
      [],
      standards,
    );
  }
  if (scope === 'bounded') {
    return check(
      'session-key-scope',
      'pass',
      'session-key-bounded',
      'Session-key permission scope is bounded.',
      ['bounded session scope'],
      standards,
    );
  }
  return check(
    'session-key-scope',
    scope === 'overbroad' ? 'fail' : 'review',
    scope === 'overbroad' ? 'session-key-overbroad' : 'session-key-scope-missing',
    'Session-key permission scope is missing, unknown, or overbroad.',
    ['bounded session scope'],
    standards,
  );
}

function delegationCheck(
  posture: GeneralCryptoDelegationPosture,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'delegation.authorize') {
    return check(
      'delegation-scope',
      'pass',
      'delegation-not-applicable',
      'Delegation scope is not applicable to this action.',
      [],
      standards,
    );
  }
  if (posture === 'bounded') {
    return check(
      'delegation-scope',
      'pass',
      'delegation-bounded',
      'Delegation authorization scope is bounded.',
      ['bounded delegation scope'],
      standards,
    );
  }
  return check(
    'delegation-scope',
    posture === 'overbroad' ? 'fail' : 'review',
    posture === 'overbroad' ? 'delegation-overbroad' : 'delegation-scope-missing',
    'Delegation authorization scope is missing, unknown, or overbroad.',
    ['bounded delegation scope'],
    standards,
  );
}

function x402Check(
  status: GeneralCryptoX402Status,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'x402.pay') {
    return check(
      'x402-payment',
      'pass',
      'x402-not-applicable',
      'x402 payment verification is not applicable to this action.',
      [],
      standards,
    );
  }
  if (status === 'verified-and-settled') {
    return check(
      'x402-payment',
      'pass',
      'x402-verified-and-settled',
      'x402 verify and settle evidence are bound.',
      ['payment-required challenge', 'facilitator verify result', 'facilitator settle result'],
      standards,
    );
  }
  return check(
    'x402-payment',
    status === 'verify-failed' || status === 'settle-failed' ? 'fail' : 'review',
    status,
    'x402 challenge, verify, settle, or response evidence is incomplete.',
    ['payment-required challenge', 'facilitator verify result', 'facilitator settle result'],
    standards,
  );
}

function requiredDigestChecks(
  input: {
    readonly action: GeneralCryptoTransactionAction;
    readonly assetRefDigest: string | null;
    readonly targetContractRefDigest: string | null;
    readonly counterpartyRefDigest: string | null;
    readonly amountRefDigest: string | null;
    readonly callDataDigest: string | null;
    readonly typedDataDigest: string | null;
    readonly routeRefDigest: string | null;
  },
): readonly GeneralCryptoTransactionGateCheck[] {
  const standards = standardsFor(input.action);
  const checks: GeneralCryptoTransactionGateCheck[] = [];
  if (
    input.action === 'native.transfer' ||
    input.action === 'erc20.transfer' ||
    input.action === 'erc20.approve' ||
    input.action === 'permit.sign' ||
    input.action === 'swap.execute' ||
    input.action === 'bridge.transfer'
  ) {
    checks.push(digestPresenceCheck('asset-binding', input.assetRefDigest, 'asset-ref', 'asset ref', standards));
  }
  if (
    input.action === 'erc20.transfer' ||
    input.action === 'erc20.approve'
  ) {
    checks.push(
      digestPresenceCheck(
        'contract-binding',
        input.targetContractRefDigest,
        'target-contract-ref',
        'target contract ref',
        standards,
      ),
    );
  }
  if (
    input.action !== 'x402.pay' &&
    input.action !== 'userop.submit' &&
    input.action !== 'safe.tx.propose'
  ) {
    checks.push(
      digestPresenceCheck(
        'counterparty-binding',
        input.counterpartyRefDigest,
        'counterparty-ref',
        'counterparty ref',
        standards,
      ),
    );
  }
  if (
    input.action === 'native.transfer' ||
    input.action === 'erc20.transfer' ||
    input.action === 'erc20.approve' ||
    input.action === 'permit.sign' ||
    input.action === 'swap.execute' ||
    input.action === 'bridge.transfer'
  ) {
    checks.push(digestPresenceCheck('amount-binding', input.amountRefDigest, 'amount-ref', 'amount ref', standards));
  }
  if (input.action === 'safe.tx.propose') {
    checks.push(
      digestPresenceCheck('calldata-binding', input.callDataDigest, 'calldata-ref', 'call data digest', standards),
    );
  }
  if (
    input.action === 'permit.sign' ||
    input.action === 'session_key.grant' ||
    input.action === 'delegation.authorize'
  ) {
    checks.push(
      digestPresenceCheck('typed-data-binding', input.typedDataDigest, 'typed-data-ref', 'typed data digest', standards),
    );
  }
  if (input.action === 'swap.execute' || input.action === 'bridge.transfer') {
    checks.push(digestPresenceCheck('route-binding', input.routeRefDigest, 'route-ref', 'route ref', standards));
  }
  return Object.freeze(checks);
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function decisionFromChecks(
  checks: readonly GeneralCryptoTransactionGateCheck[],
): GeneralCryptoTransactionGateDecision {
  if (checks.some((item) => item.outcome === 'fail')) return 'block';
  if (checks.some((item) => item.outcome === 'review')) return 'review';
  return 'admit';
}

export function createGeneralCryptoTransactionGateResult(
  input: GeneralCryptoTransactionGateInput,
): GeneralCryptoTransactionGateResult {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const action = normalizeEnum(
    input.action,
    GENERAL_CRYPTO_TRANSACTION_ACTIONS,
    'action',
  ) as GeneralCryptoTransactionAction;
  const chainPolicyStatus = normalizeEnum(
    input.chainPolicyStatus,
    GENERAL_CRYPTO_CHAIN_POLICY_STATUSES,
    'chainPolicyStatus',
  ) as GeneralCryptoChainPolicyStatus;
  const simulationStatus = normalizeEnum(
    input.simulationStatus,
    GENERAL_CRYPTO_SIMULATION_STATUSES,
    'simulationStatus',
  ) as GeneralCryptoSimulationStatus;
  const allowancePosture = optionalEnum(
    input.allowancePosture,
    GENERAL_CRYPTO_ALLOWANCE_POSTURES,
    'not-applicable',
    'allowancePosture',
  ) as GeneralCryptoAllowancePosture;
  const counterpartyTrust = optionalEnum(
    input.counterpartyTrust,
    GENERAL_CRYPTO_COUNTERPARTY_TRUST,
    'known',
    'counterpartyTrust',
  ) as GeneralCryptoCounterpartyTrust;
  const permitDomainStatus = optionalEnum(
    input.permitDomainStatus,
    GENERAL_CRYPTO_PERMIT_DOMAIN_STATUSES,
    'not-applicable',
    'permitDomainStatus',
  ) as GeneralCryptoPermitDomainStatus;
  const routeStatus = optionalEnum(
    input.routeStatus,
    GENERAL_CRYPTO_ROUTE_STATUSES,
    'not-applicable',
    'routeStatus',
  ) as GeneralCryptoRouteStatus;
  const safeStatus = optionalEnum(
    input.safeStatus,
    GENERAL_CRYPTO_SAFE_STATUSES,
    'not-applicable',
    'safeStatus',
  ) as GeneralCryptoSafeStatus;
  const userOperationStatus = optionalEnum(
    input.userOperationStatus,
    GENERAL_CRYPTO_USER_OPERATION_STATUSES,
    'not-applicable',
    'userOperationStatus',
  ) as GeneralCryptoUserOperationStatus;
  const sessionKeyScope = optionalEnum(
    input.sessionKeyScope,
    GENERAL_CRYPTO_SESSION_KEY_SCOPES,
    'not-applicable',
    'sessionKeyScope',
  ) as GeneralCryptoSessionKeyScope;
  const delegationPosture = optionalEnum(
    input.delegationPosture,
    GENERAL_CRYPTO_DELEGATION_POSTURES,
    'not-applicable',
    'delegationPosture',
  ) as GeneralCryptoDelegationPosture;
  const x402Status = optionalEnum(
    input.x402Status,
    GENERAL_CRYPTO_X402_STATUSES,
    'not-applicable',
    'x402Status',
  ) as GeneralCryptoX402Status;

  const normalized = {
    generatedAt,
    tenantRefDigest: normalizeDigest(input.tenantRefDigest, 'tenantRefDigest'),
    actorRefDigest: normalizeDigest(input.actorRefDigest, 'actorRefDigest'),
    walletAccountRefDigest: normalizeDigest(input.walletAccountRefDigest, 'walletAccountRefDigest'),
    actionRequestDigest: normalizeDigest(input.actionRequestDigest, 'actionRequestDigest'),
    policyCandidateDigest: normalizeDigest(input.policyCandidateDigest, 'policyCandidateDigest'),
    approvalRefDigest: normalizeOptionalDigest(input.approvalRefDigest, 'approvalRefDigest'),
    executionPlanDigest: normalizeOptionalDigest(input.executionPlanDigest, 'executionPlanDigest'),
    simulationDigest: normalizeOptionalDigest(input.simulationDigest, 'simulationDigest'),
    receiptRefDigest: normalizeOptionalDigest(input.receiptRefDigest, 'receiptRefDigest'),
    assetRefDigest: normalizeOptionalDigest(input.assetRefDigest, 'assetRefDigest'),
    targetContractRefDigest: normalizeOptionalDigest(input.targetContractRefDigest, 'targetContractRefDigest'),
    counterpartyRefDigest: normalizeOptionalDigest(input.counterpartyRefDigest, 'counterpartyRefDigest'),
    amountRefDigest: normalizeOptionalDigest(input.amountRefDigest, 'amountRefDigest'),
    callDataDigest: normalizeOptionalDigest(input.callDataDigest, 'callDataDigest'),
    typedDataDigest: normalizeOptionalDigest(input.typedDataDigest, 'typedDataDigest'),
    routeRefDigest: normalizeOptionalDigest(input.routeRefDigest, 'routeRefDigest'),
    chainId: normalizeChainId(input.chainId),
    chainPolicyStatus,
    action,
    simulationStatus,
    allowancePosture,
    counterpartyTrust,
    permitDomainStatus,
    routeStatus,
    safeStatus,
    userOperationStatus,
    sessionKeyScope,
    delegationPosture,
    x402Status,
  } as const;

  const standards = standardsFor(action);
  const checks: GeneralCryptoTransactionGateCheck[] = [
    check(
      'tenant-binding',
      'pass',
      'tenant-bound',
      'Tenant digest is bound to the proposed crypto action.',
      ['tenant ref digest'],
      ['attestor tenant boundary'],
    ),
    check(
      'wallet-account-binding',
      'pass',
      'wallet-account-bound',
      'Wallet/account digest is bound; raw wallet material is not stored.',
      ['wallet account ref digest'],
      standards,
    ),
    check(
      'chain-policy',
      chainPolicyStatus === 'matched'
        ? 'pass'
        : chainPolicyStatus === 'mismatch'
          ? 'fail'
          : 'review',
      chainPolicyStatus === 'matched'
        ? 'chain-policy-matched'
        : chainPolicyStatus === 'mismatch'
          ? 'wrong-chain'
          : 'chain-policy-unknown',
      chainPolicyStatus === 'matched'
        ? 'Requested chain matches the policy-bound chain.'
        : 'Requested chain is missing, unknown, or mismatched against policy.',
      ['chain policy ref'],
      standards,
    ),
    digestPresenceCheck(
      'approval-binding',
      normalized.approvalRefDigest,
      'approval-ref',
      'approval ref',
      ['attestor approval/dismiss feedback loop'],
      true,
    ),
    digestPresenceCheck(
      'execution-plan-binding',
      normalized.executionPlanDigest,
      'execution-plan',
      'crypto execution admission plan',
      ['attestor/crypto-execution-admission'],
      true,
    ),
    simulationCheck(simulationStatus, normalized.simulationDigest, action),
    counterpartyTrustCheck(counterpartyTrust, action),
    allowanceCheck(allowancePosture, action),
    permitDomainCheck(permitDomainStatus, action),
    routeCheck(routeStatus, action),
    safeCheck(safeStatus, action),
    userOperationCheck(userOperationStatus, action),
    sessionKeyCheck(sessionKeyScope, action),
    delegationCheck(delegationPosture, action),
    x402Check(x402Status, action),
    ...requiredDigestChecks(normalized),
  ];

  const decision = decisionFromChecks(checks);
  const requiredEvidence = unique(
    checks.flatMap((item) => item.outcome === 'pass' ? [] : item.requiredEvidence),
  );
  const reasonCodes = unique(
    checks
      .filter((item) => item.outcome !== 'pass')
      .map((item) => item.reasonCode),
  );
  const nextActions = decision === 'admit'
    ? Object.freeze(['customer gate may proceed with the bound execution plan'])
    : Object.freeze(requiredEvidence.map((item) => `provide ${item}`));
  const canonical = canonicalObject({
    version: GENERAL_CRYPTO_TRANSACTION_GATE_VERSION,
    generatedAt,
    tenantRefDigest: normalized.tenantRefDigest,
    actorRefDigest: normalized.actorRefDigest,
    walletAccountRefDigest: normalized.walletAccountRefDigest,
    actionRequestDigest: normalized.actionRequestDigest,
    policyCandidateDigest: normalized.policyCandidateDigest,
    approvalRefDigest: normalized.approvalRefDigest,
    executionPlanDigest: normalized.executionPlanDigest,
    simulationDigest: normalized.simulationDigest,
    receiptRefDigest: normalized.receiptRefDigest,
    assetRefDigest: normalized.assetRefDigest,
    targetContractRefDigest: normalized.targetContractRefDigest,
    counterpartyRefDigest: normalized.counterpartyRefDigest,
    amountRefDigest: normalized.amountRefDigest,
    callDataDigest: normalized.callDataDigest,
    typedDataDigest: normalized.typedDataDigest,
    routeRefDigest: normalized.routeRefDigest,
    chainId: normalized.chainId,
    chainPolicyStatus,
    action,
    riskClass: riskClassFor(action),
    decision,
    checks,
    reasonCodes,
    requiredEvidence,
    standards,
    approvalRequired: true,
    autoEnforce: false,
    signsTransaction: false,
    broadcastsTransaction: false,
    custodyWallet: false,
    chainAnalyticsProvider: false,
    rawPayloadStored: false,
    productionReady: false,
  } as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    version: GENERAL_CRYPTO_TRANSACTION_GATE_VERSION,
    generatedAt,
    tenantRefDigest: normalized.tenantRefDigest,
    actorRefDigest: normalized.actorRefDigest,
    walletAccountRefDigest: normalized.walletAccountRefDigest,
    actionRequestDigest: normalized.actionRequestDigest,
    policyCandidateDigest: normalized.policyCandidateDigest,
    approvalRefDigest: normalized.approvalRefDigest,
    executionPlanDigest: normalized.executionPlanDigest,
    simulationDigest: normalized.simulationDigest,
    receiptRefDigest: normalized.receiptRefDigest,
    assetRefDigest: normalized.assetRefDigest,
    targetContractRefDigest: normalized.targetContractRefDigest,
    counterpartyRefDigest: normalized.counterpartyRefDigest,
    amountRefDigest: normalized.amountRefDigest,
    callDataDigest: normalized.callDataDigest,
    typedDataDigest: normalized.typedDataDigest,
    routeRefDigest: normalized.routeRefDigest,
    chainId: normalized.chainId,
    chainPolicyStatus,
    action,
    riskClass: riskClassFor(action),
    decision,
    allowed: decision === 'admit',
    failClosed: decision !== 'admit',
    customerGateAction: decision === 'admit' ? 'proceed' : 'hold',
    checks: Object.freeze([...checks]),
    reasonCodes,
    requiredEvidence,
    nextActions,
    standards,
    approvalRequired: true,
    autoEnforce: false,
    signsTransaction: false,
    broadcastsTransaction: false,
    custodyWallet: false,
    chainAnalyticsProvider: false,
    rawPayloadStored: false,
    productionReady: false,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function generalCryptoTransactionGateDescriptor():
GeneralCryptoTransactionGateDescriptor {
  return Object.freeze({
    version: GENERAL_CRYPTO_TRANSACTION_GATE_VERSION,
    actions: GENERAL_CRYPTO_TRANSACTION_ACTIONS,
    decisions: GENERAL_CRYPTO_TRANSACTION_GATE_DECISIONS,
    checkOutcomes: GENERAL_CRYPTO_TRANSACTION_GATE_CHECK_OUTCOMES,
    riskClasses: GENERAL_CRYPTO_TRANSACTION_GATE_RISK_CLASSES,
    chainPolicyStatuses: GENERAL_CRYPTO_CHAIN_POLICY_STATUSES,
    simulationStatuses: GENERAL_CRYPTO_SIMULATION_STATUSES,
    allowancePostures: GENERAL_CRYPTO_ALLOWANCE_POSTURES,
    counterpartyTrust: GENERAL_CRYPTO_COUNTERPARTY_TRUST,
    permitDomainStatuses: GENERAL_CRYPTO_PERMIT_DOMAIN_STATUSES,
    routeStatuses: GENERAL_CRYPTO_ROUTE_STATUSES,
    safeStatuses: GENERAL_CRYPTO_SAFE_STATUSES,
    userOperationStatuses: GENERAL_CRYPTO_USER_OPERATION_STATUSES,
    sessionKeyScopes: GENERAL_CRYPTO_SESSION_KEY_SCOPES,
    delegationPostures: GENERAL_CRYPTO_DELEGATION_POSTURES,
    x402Statuses: GENERAL_CRYPTO_X402_STATUSES,
    approvalRequired: true,
    autoEnforce: false,
    signsTransaction: false,
    broadcastsTransaction: false,
    custodyWallet: false,
    chainAnalyticsProvider: false,
    rawPayloadStored: false,
    productionReady: false,
  });
}
