import {
  type CustodyAccountEvidence,
  type CustodyApprovalEvidence,
  type CustodyCosignerCallbackEvidence,
  type CustodyKeyPostureEvidence,
  type CustodyPolicyConditionsEvidence,
  type CustodyPolicyDecisionEvidence,
  type CustodyPostExecutionEvidence,
  type CustodyScreeningEvidence,
  type CustodyTransactionEvidence,
} from '../src/crypto-authorization-core/custody-cosigner-policy-adapter.js';
import {
  createCryptoEnforcementVerificationBinding,
  type CryptoEnforcementVerificationBinding,
} from '../src/crypto-authorization-core/enforcement-plane-verification.js';
import {
  createCryptoPolicyControlPlaneScopeBinding,
  type CryptoPolicyControlPlaneScopeBinding,
} from '../src/crypto-authorization-core/policy-control-plane-scope-binding.js';
import {
  createCryptoReleaseDecisionBinding,
  type CryptoReleaseDecisionBinding,
} from '../src/crypto-authorization-core/release-decision-binding.js';
import {
  createCryptoEoaSignatureValidationProjection,
} from '../src/crypto-authorization-core/erc1271-validation-projection.js';
import {
  createCryptoReplayFreshnessRules,
  evaluateCryptoAuthorizationFreshness,
} from '../src/crypto-authorization-core/replay-freshness-rules.js';
import {
  createCryptoEip712AuthorizationEnvelope,
} from '../src/crypto-authorization-core/eip712-authorization-envelope.js';
import {
  createCryptoCanonicalAssetReference,
  createCryptoCanonicalCounterpartyReference,
  createCryptoCanonicalReferenceBundle,
} from '../src/crypto-authorization-core/canonical-references.js';
import {
  createCryptoConsequenceRiskAssessment,
  type CryptoConsequenceRiskAssessment,
} from '../src/crypto-authorization-core/consequence-risk-mapping.js';
import {
  CRYPTO_AUTHORIZATION_DEFAULT_REQUIRED_ARTIFACTS,
  createCryptoAuthorizationActor,
  createCryptoAuthorizationConstraints,
  createCryptoAuthorizationDecision,
  createCryptoAuthorizationIntent,
  createCryptoAuthorizationPolicyScope,
  createCryptoExecutionTarget,
  createCryptoSignerAuthority,
  type CryptoAuthorizationIntent,
} from '../src/crypto-authorization-core/object-model.js';
import {
  createCryptoAccountReference,
  createCryptoAssetReference,
  createCryptoChainReference,
  type CryptoExecutionAdapterKind,
} from '../src/crypto-authorization-core/types.js';

const CUSTODY_ACCOUNT_ADDRESS = '0x1111111111111111111111111111111111111111';
export const DESTINATION_ADDRESS = '0x2222222222222222222222222222222222222222';
export const OTHER_ADDRESS = '0x3333333333333333333333333333333333333333';
export const USDC_MAINNET = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const VERIFYING_CONTRACT = '0x9999999999999999999999999999999999999999';
const SIGNATURE = `0x${'11'.repeat(65)}`;
const CUSTODY_REQUEST_HASH = `0x${'aa'.repeat(32)}`;
const CALLBACK_BODY_HASH = `sha256:${'bb'.repeat(32)}`;
const ACTIVITY_ID = 'fb-tx-activity-001';
const SPIFFE_ID = 'spiffe://attestor.test/ns/crypto/sa/custody-cosigner';
const SIMULATED_AT_EPOCH_SECONDS = 1776762120;
const FRESH_REVOCATION_CHECKED_AT_EPOCH_SECONDS = 1776762110;

function fixtureChain() {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId: '1',
  });
}

function fixtureCustodyAccount() {
  return createCryptoAccountReference({
    accountKind: 'custody-account',
    chain: fixtureChain(),
    address: CUSTODY_ACCOUNT_ADDRESS,
    accountLabel: 'Fireblocks treasury vault',
  });
}

function fixtureDestinationAccount() {
  return createCryptoAccountReference({
    accountKind: 'eoa',
    chain: fixtureChain(),
    address: DESTINATION_ADDRESS,
    accountLabel: 'Approved RWA settlement destination',
  });
}

function fixtureAsset() {
  return createCryptoAssetReference({
    assetKind: 'stablecoin',
    chain: fixtureChain(),
    assetId: USDC_MAINNET,
    symbol: 'USDC',
    decimals: 6,
  });
}

interface FixtureSuite {
  readonly intent: CryptoAuthorizationIntent;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
}

export function fixtureSuite(
  executionAdapterKind: CryptoExecutionAdapterKind = 'custody-cosigner',
): FixtureSuite {
  const chain = fixtureChain();
  const account = fixtureCustodyAccount();
  const asset = fixtureAsset();
  const destinationAccount = fixtureDestinationAccount();
  const requester = createCryptoAuthorizationActor({
    actorKind: 'service',
    actorId: 'treasury-service:rwa-settlement',
    authorityRef: 'authority:treasury-ops',
  });
  const target = createCryptoExecutionTarget({
    targetKind: 'custody-destination',
    chain,
    targetId: 'custody-destination:rwa-settlement-001',
    address: DESTINATION_ADDRESS,
    counterparty: DESTINATION_ADDRESS,
    protocol: 'custody-withdrawal',
    calldataClass: 'stablecoin-settlement-transfer',
  });
  const policyScope = createCryptoAuthorizationPolicyScope({
    dimensions: [
      'chain',
      'account',
      'actor',
      'asset',
      'counterparty',
      'amount',
      'budget',
      'cadence',
      'risk-tier',
      'approval-quorum',
      'runtime-context',
    ],
    environment: 'prod-crypto',
    tenantId: 'tenant-crypto',
    accountId: 'fireblocks:vault:treasury-hot',
    policyPackRef: 'policy-pack:crypto:custody:v1',
  });
  const constraints = createCryptoAuthorizationConstraints({
    validAfter: '2026-04-21T09:00:00.000Z',
    validUntil: '2026-04-21T09:05:00.000Z',
    nonce: 'custody-request-nonce-001',
    replayProtectionMode: 'idempotency-key',
    digestMode: 'custody-policy-hash',
    requiredArtifacts: [
      ...CRYPTO_AUTHORIZATION_DEFAULT_REQUIRED_ARTIFACTS,
      'custody-policy-decision',
    ],
    maxAmount: '5000000000',
    budgetId: 'budget:treasury:rwa-settlement:daily',
    cadence: 'per-request',
  });
  const intent = createCryptoAuthorizationIntent({
    intentId: `intent-crypto-custody-withdrawal-${executionAdapterKind}`,
    requestedAt: '2026-04-21T09:00:01.000Z',
    requester,
    account,
    asset,
    consequenceKind: 'custody-withdrawal',
    target,
    policyScope,
    constraints,
    executionAdapterKind,
    evidenceRefs: [
      'evidence:crypto-custody-policy:001',
      'policy:activation:custody:001',
    ],
  });
  const referenceBundle = createCryptoCanonicalReferenceBundle({
    chain,
    account,
    asset: createCryptoCanonicalAssetReference({ asset }),
    counterparty: createCryptoCanonicalCounterpartyReference({
      counterpartyKind: 'custody-destination',
      counterpartyId: 'custody-destination:rwa-settlement-001',
      account: destinationAccount,
      display: 'Approved RWA settlement destination',
    }),
  });
  const riskAssessment = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'custody-withdrawal',
    account,
    asset,
    amount: {
      assetAmount: '2500000000',
      normalizedUsd: '2500',
    },
    counterparty: referenceBundle.counterparty,
    context: {
      executionAdapterKind,
      signals: ['user-initiated', 'custody-policy-present'],
      hasExpiry: true,
      hasBudget: true,
      hasRevocationPath: true,
      isKnownCounterparty: true,
      requiresCustodyPolicy: true,
      hasCustodyPolicy: true,
    },
  });
  const signer = createCryptoSignerAuthority({
    authorityKind: 'eoa-signer',
    authorityId: 'treasury-custody-policy-signer',
    validationMode: 'eip-712-eoa',
    address: CUSTODY_ACCOUNT_ADDRESS,
  });
  const cryptoDecision = createCryptoAuthorizationDecision({
    decisionId: `decision-crypto-custody-withdrawal-${executionAdapterKind}`,
    intent,
    decidedAt: '2026-04-21T09:00:02.000Z',
    status: 'allow',
    riskClass: riskAssessment.riskClass,
    releaseDecisionId: `release-crypto-custody-withdrawal-${executionAdapterKind}`,
    reasonCodes: ['policy-allow', 'custody-quorum-reviewed'],
    signerAuthorities: [signer],
  });
  const envelope = createCryptoEip712AuthorizationEnvelope({
    envelopeId: `envelope-crypto-custody-withdrawal-${executionAdapterKind}`,
    receiptId: `receipt-crypto-custody-withdrawal-${executionAdapterKind}`,
    intent,
    decision: cryptoDecision,
    signerAuthority: signer,
    riskAssessment,
    referenceBundle,
    verifyingContract: VERIFYING_CONTRACT,
  });
  const signatureValidation = createCryptoEoaSignatureValidationProjection({
    envelope,
    signature: SIGNATURE,
    expectedSigner: CUSTODY_ACCOUNT_ADDRESS,
    adapterKind: executionAdapterKind,
  });
  const freshnessRules = createCryptoReplayFreshnessRules({
    intent,
    decision: cryptoDecision,
    envelope,
    idempotencyKey: 'idem-custody-withdrawal-001',
  });
  const freshnessEvaluation = evaluateCryptoAuthorizationFreshness({
    rules: freshnessRules,
    nowEpochSeconds: SIMULATED_AT_EPOCH_SECONDS,
    replayLedgerAvailable: true,
    replayLedgerEntry: null,
    revocationObservation: {
      revocationKey: freshnessRules.revocation.revocationKey,
      status: 'active',
      checkedAtEpochSeconds: FRESH_REVOCATION_CHECKED_AT_EPOCH_SECONDS,
    },
  });
  const releaseBinding = createCryptoReleaseDecisionBinding({
    intent,
    cryptoDecision,
    riskAssessment,
    envelope,
    signatureValidation,
    freshnessRules,
    freshnessEvaluation,
  });
  const policyScopeBinding = createCryptoPolicyControlPlaneScopeBinding({
    intent,
    cryptoDecision,
    riskAssessment,
    releaseBinding,
    generatedAt: '2026-04-21T09:00:03.000Z',
    planId: 'trial',
  });
  const enforcementBinding = createCryptoEnforcementVerificationBinding({
    releaseBinding,
    policyScopeBinding,
    requestId: `erq_crypto_custody_${executionAdapterKind.replaceAll('-', '_')}`,
    receivedAt: '2026-04-21T09:00:04.000Z',
    enforcementPoint: {
      enforcementPointId: 'pep.crypto.custody-cosigner',
      workloadId: SPIFFE_ID,
    },
    traceId: 'trace-crypto-custody-withdrawal-001',
    idempotencyKey: 'idem-custody-withdrawal-001',
  });

  return {
    intent,
    riskAssessment,
    releaseBinding,
    policyScopeBinding,
    enforcementBinding,
  };
}

function custodyAccount(overrides: Partial<CustodyAccountEvidence> = {}): CustodyAccountEvidence {
  return {
    provider: 'fireblocks',
    organizationId: 'org-fireblocks-attestor',
    workspaceId: 'workspace-treasury',
    vaultId: 'vault-treasury-hot',
    walletId: 'wallet-eth-mainnet',
    accountId: 'account-usdc-mainnet',
    accountRef: 'fireblocks:vault:treasury-hot:usdc-mainnet',
    chain: 'eip155:1',
    asset: USDC_MAINNET,
    sourceAddress: CUSTODY_ACCOUNT_ADDRESS,
    policyEngineEnabled: true,
    custodyAccountKind: 'vault-account',
    ...overrides,
  };
}

export function transaction(
  overrides: Partial<CustodyTransactionEvidence> = {},
): CustodyTransactionEvidence {
  return {
    requestId: 'fb-transfer-request-001',
    idempotencyKey: 'idem-custody-withdrawal-001',
    idempotencyFresh: true,
    duplicateRequestDetected: false,
    requestHash: CUSTODY_REQUEST_HASH,
    operation: 'transfer',
    chain: 'eip155:1',
    asset: USDC_MAINNET,
    amount: '2500000000',
    sourceAccountRef: 'fireblocks:vault:treasury-hot:usdc-mainnet',
    sourceAddress: CUSTODY_ACCOUNT_ADDRESS,
    destinationAddress: DESTINATION_ADDRESS,
    destinationRef: 'custody-destination:rwa-settlement-001',
    destinationMemo: 'rwa-settlement-2026-04-21',
    targetId: 'custody-destination:rwa-settlement-001',
    requestedAt: '2026-04-21T09:01:00.000Z',
    simulationPassed: true,
    ...overrides,
  };
}

function policyConditions(
  overrides: Partial<CustodyPolicyConditionsEvidence> = {},
): CustodyPolicyConditionsEvidence {
  return {
    chainBound: true,
    accountBound: true,
    assetBound: true,
    destinationBound: true,
    amountBound: true,
    operationBound: true,
    budgetBound: true,
    velocityBound: true,
    attestorReceiptRequired: true,
    attestorReceiptMatched: true,
    ...overrides,
  };
}

export function policyDecision(
  overrides: Partial<CustodyPolicyDecisionEvidence> = {},
): CustodyPolicyDecisionEvidence {
  return {
    provider: 'fireblocks',
    decisionId: 'custody-policy-decision-001',
    policyId: 'custody-policy-rwa-settlement',
    policyVersion: '2026-04-21.1',
    policyHash: 'sha256:policyhash001',
    activePolicyHash: 'sha256:policyhash001',
    ruleId: 'rule-approved-rwa-settlement',
    effect: 'allow',
    status: 'approved',
    matched: true,
    explicitDeny: false,
    implicitDeny: false,
    evaluatedAt: '2026-04-21T09:01:05.000Z',
    environment: 'prod-crypto',
    tenantId: 'tenant-crypto',
    policyActivated: true,
    conditions: policyConditions(),
    ...overrides,
  };
}

export function approvals(
  overrides: Partial<CustodyApprovalEvidence> = {},
): CustodyApprovalEvidence {
  return {
    requiredApprovals: 2,
    collectedApprovals: 2,
    quorumSatisfied: true,
    approverIds: ['ops-approver-a', 'risk-approver-b'],
    requiredRoles: ['treasury-ops', 'risk'],
    collectedRoles: ['treasury-ops', 'risk'],
    requesterId: 'treasury-service:rwa-settlement',
    requesterApproved: false,
    dutySeparationSatisfied: true,
    policyAdminApprovedOwnChange: false,
    breakGlassUsed: false,
    breakGlassAuthorized: false,
    ...overrides,
  };
}

export function callback(
  overrides: Partial<CustodyCosignerCallbackEvidence> = {},
): CustodyCosignerCallbackEvidence {
  return {
    callbackId: 'cosigner-callback-001',
    configured: true,
    authenticated: true,
    authMethod: 'jwt-public-key',
    signatureValid: true,
    tlsPinned: true,
    senderConstrained: true,
    sourceIpAllowlisted: true,
    timestamp: '2026-04-21T09:01:06.000Z',
    nonce: 'callback-nonce-001',
    nonceFresh: true,
    bodyHash: CALLBACK_BODY_HASH,
    bodyHashMatches: true,
    responseAction: 'approve',
    responseSigned: true,
    responseWithinSeconds: 5,
    attestorReleaseTokenVerified: true,
    ...overrides,
  };
}

export function screening(
  overrides: Partial<CustodyScreeningEvidence> = {},
): CustodyScreeningEvidence {
  return {
    destinationAllowlisted: true,
    counterpartyKnown: true,
    sanctionsScreened: true,
    sanctionsHit: false,
    riskScore: 12,
    riskScoreMax: 50,
    riskTierAllowed: true,
    travelRuleRequired: true,
    travelRuleCompleted: true,
    velocityLimitChecked: true,
    velocityLimitRemainingAtomic: '10000000000',
    maxAmountAtomic: '5000000000',
    ...overrides,
  };
}

export function keyPosture(
  overrides: Partial<CustodyKeyPostureEvidence> = {},
): CustodyKeyPostureEvidence {
  return {
    keyId: 'mpc-key-mainnet-usdc-001',
    keyType: 'mpc',
    cosignerId: 'cosigner-attestor-prod-001',
    cosignerPaired: true,
    cosignerHealthy: true,
    enclaveBacked: true,
    keyShareHealthy: true,
    signingPolicyBound: true,
    keyExportable: false,
    signerRoleBound: true,
    haSignerAvailable: true,
    recoveryReady: true,
    ...overrides,
  };
}

export function postExecution(
  overrides: Partial<CustodyPostExecutionEvidence> = {},
): CustodyPostExecutionEvidence {
  return {
    activityId: ACTIVITY_ID,
    status: 'signed',
    signatureHash: `sha256:${'cc'.repeat(32)}`,
    transactionHash: null,
    providerStatus: 'SIGNED',
    failureReason: null,
    ...overrides,
  };
}

export function preflightInput() {
  return {
    ...fixtureSuite(),
    account: custodyAccount(),
    transaction: transaction(),
    policyDecision: policyDecision(),
    approvals: approvals(),
    callback: callback(),
    screening: screening(),
    keyPosture: keyPosture(),
    postExecution: postExecution(),
  };
}
