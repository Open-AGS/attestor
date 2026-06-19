import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  GENERAL_CRYPTO_ALLOWANCE_POSTURES,
  GENERAL_CRYPTO_CHAIN_POLICY_STATUSES,
  GENERAL_CRYPTO_COUNTERPARTY_TRUST,
  GENERAL_CRYPTO_DELEGATION_POSTURES,
  GENERAL_CRYPTO_PERMIT_DOMAIN_STATUSES,
  GENERAL_CRYPTO_ROUTE_STATUSES,
  GENERAL_CRYPTO_SAFE_STATUSES,
  GENERAL_CRYPTO_SESSION_KEY_SCOPES,
  GENERAL_CRYPTO_SIMULATION_STATUSES,
  GENERAL_CRYPTO_TRANSACTION_ACTIONS,
  GENERAL_CRYPTO_TRANSACTION_GATE_VERSION,
  GENERAL_CRYPTO_USER_OPERATION_STATUSES,
  GENERAL_CRYPTO_X402_STATUSES,
  type GeneralCryptoAllowancePosture,
  type GeneralCryptoChainPolicyStatus,
  type GeneralCryptoCounterpartyTrust,
  type GeneralCryptoDelegationPosture,
  type GeneralCryptoPermitDomainStatus,
  type GeneralCryptoRouteStatus,
  type GeneralCryptoSafeStatus,
  type GeneralCryptoSessionKeyScope,
  type GeneralCryptoSimulationStatus,
  type GeneralCryptoTransactionAction,
  type GeneralCryptoTransactionGateCheck,
  type GeneralCryptoTransactionGateDecision,
  type GeneralCryptoTransactionGateInput,
  type GeneralCryptoTransactionGateResult,
  type GeneralCryptoUserOperationStatus,
  type GeneralCryptoX402Status,
} from './general-crypto-transaction-gate-types.js';
import {
  canonicalObject,
  check,
  digestPresenceCheck,
  normalizeChainId,
  normalizeDigest,
  normalizeEnum,
  normalizeIsoTimestamp,
  normalizeOptionalDigest,
  optionalEnum,
  riskClassFor,
  standardsFor,
} from './general-crypto-transaction-gate-utils.js';
import {
  allowanceCheck,
  counterpartyTrustCheck,
  delegationCheck,
  permitDomainCheck,
  requiredDigestChecks,
  routeCheck,
  safeCheck,
  sessionKeyCheck,
  simulationCheck,
  userOperationCheck,
  x402Check,
} from './general-crypto-transaction-gate-checks.js';

export function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

export function decisionFromChecks(
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
