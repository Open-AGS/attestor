import {
  X402_HTTP_PAYMENT_REQUIRED_STATUS,
  X402_PROTOCOL_VERSION,
  type X402AgentBudgetEvidence,
  type X402ExactAuthorizationEvidence,
  type X402FacilitatorEvidence,
  type X402PaymentPayloadEvidence,
  type X402PaymentRequirementsEvidence,
  type X402PrivacyMetadataEvidence,
  type X402ResourceEvidence,
  type X402ServiceTrustEvidence,
} from '../src/crypto-authorization-core/x402-agentic-payment-adapter.js';
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

const PAYER_ADDRESS = '0x1111111111111111111111111111111111111111';
export const PAY_TO_ADDRESS = '0x2222222222222222222222222222222222222222';
export const OTHER_ADDRESS = '0x3333333333333333333333333333333333333333';
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const VERIFYING_CONTRACT = '0x9999999999999999999999999999999999999999';
const RESOURCE_URL = 'https://api.attestor.example/market-data/premium';
const FACILITATOR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';
const SIGNATURE = `0x${'11'.repeat(65)}`;
const AUTHORIZATION_NONCE = `0x${'aa'.repeat(32)}`;
const PAYLOAD_HASH = `0x${'bb'.repeat(32)}`;
const REQUIREMENTS_HASH = `0x${'cc'.repeat(32)}`;
const SETTLEMENT_TX = `0x${'dd'.repeat(32)}`;
const SPIFFE_ID = 'spiffe://attestor.test/ns/crypto/sa/x402-payment';
const SIMULATED_AT_EPOCH_SECONDS = 1776762060;
const FRESH_REVOCATION_CHECKED_AT_EPOCH_SECONDS = 1776762055;

function fixtureChain() {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId: '8453',
  });
}

function fixtureAgentAccount() {
  return createCryptoAccountReference({
    accountKind: 'agent-wallet',
    chain: fixtureChain(),
    address: PAYER_ADDRESS,
    accountLabel: 'Agent x402 wallet',
  });
}

function fixtureAsset() {
  return createCryptoAssetReference({
    assetKind: 'stablecoin',
    chain: fixtureChain(),
    assetId: USDC_BASE,
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
  executionAdapterKind: CryptoExecutionAdapterKind = 'x402-payment',
): FixtureSuite {
  const chain = fixtureChain();
  const account = fixtureAgentAccount();
  const asset = fixtureAsset();
  const requester = createCryptoAuthorizationActor({
    actorKind: 'agent',
    actorId: 'agent:x402-market-data',
    authorityRef: 'authority:x402-agent-budget-policy',
  });
  const target = createCryptoExecutionTarget({
    targetKind: 'payee',
    chain,
    targetId: RESOURCE_URL,
    address: PAY_TO_ADDRESS,
    counterparty: PAY_TO_ADDRESS,
    protocol: 'x402',
    calldataClass: 'http-get-premium-market-data',
  });
  const policyScope = createCryptoAuthorizationPolicyScope({
    dimensions: [
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
    ],
    environment: 'prod-crypto',
    tenantId: 'tenant-crypto',
    policyPackRef: 'policy-pack:crypto:x402:v1',
  });
  const constraints = createCryptoAuthorizationConstraints({
    validAfter: '2026-04-21T09:00:00.000Z',
    validUntil: '2026-04-21T09:02:00.000Z',
    nonce: AUTHORIZATION_NONCE,
    replayProtectionMode: 'idempotency-key',
    digestMode: 'http-payment-hash',
    requiredArtifacts: [
      ...CRYPTO_AUTHORIZATION_DEFAULT_REQUIRED_ARTIFACTS,
      'http-payment-authorization',
    ],
    maxAmount: '250000',
    budgetId: 'budget:x402:market-data:daily',
    cadence: 'per-minute',
  });
  const intent = createCryptoAuthorizationIntent({
    intentId: `intent-crypto-x402-payment-${executionAdapterKind}`,
    requestedAt: '2026-04-21T09:00:01.000Z',
    requester,
    account,
    asset,
    consequenceKind: 'agent-payment',
    target,
    policyScope,
    constraints,
    executionAdapterKind,
    evidenceRefs: [
      'evidence:crypto-x402-payment:001',
      'policy:activation:x402:001',
    ],
  });
  const referenceBundle = createCryptoCanonicalReferenceBundle({
    chain,
    account,
    asset: createCryptoCanonicalAssetReference({ asset }),
  });
  const riskAssessment = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'agent-payment',
    account,
    asset,
    amount: {
      assetAmount: '120000',
      normalizedUsd: '0.12',
    },
    context: {
      executionAdapterKind,
      signals: ['agent-initiated', 'known-counterparty'],
      hasExpiry: true,
      hasBudget: true,
      hasRevocationPath: true,
      isKnownCounterparty: true,
    },
  });
  const signer = createCryptoSignerAuthority({
    authorityKind: 'eoa-signer',
    authorityId: 'agent-wallet:x402-market-data',
    validationMode: 'eip-712-eoa',
    address: PAYER_ADDRESS,
  });
  const cryptoDecision = createCryptoAuthorizationDecision({
    decisionId: `decision-crypto-x402-payment-${executionAdapterKind}`,
    intent,
    decidedAt: '2026-04-21T09:00:02.000Z',
    status: 'allow',
    riskClass: riskAssessment.riskClass,
    releaseDecisionId: `release-crypto-x402-payment-${executionAdapterKind}`,
    reasonCodes: ['policy-allow', 'x402-budget-reviewed'],
    signerAuthorities: [signer],
  });
  const envelope = createCryptoEip712AuthorizationEnvelope({
    envelopeId: `envelope-crypto-x402-payment-${executionAdapterKind}`,
    receiptId: `receipt-crypto-x402-payment-${executionAdapterKind}`,
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
    expectedSigner: PAYER_ADDRESS,
    adapterKind: executionAdapterKind,
  });
  const freshnessRules = createCryptoReplayFreshnessRules({
    intent,
    decision: cryptoDecision,
    envelope,
    idempotencyKey: 'idem-x402-market-data-001',
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
    requestId: `erq_crypto_x402_payment_${executionAdapterKind.replaceAll('-', '_')}`,
    receivedAt: '2026-04-21T09:00:04.000Z',
    enforcementPoint: {
      enforcementPointId: 'pep.crypto.x402-payment',
      workloadId: SPIFFE_ID,
    },
    traceId: 'trace-crypto-x402-payment-001',
    idempotencyKey: 'idem-x402-market-data-001',
  });

  return {
    intent,
    riskAssessment,
    releaseBinding,
    policyScopeBinding,
    enforcementBinding,
  };
}

export function resource(overrides: Partial<X402ResourceEvidence> = {}): X402ResourceEvidence {
  return {
    transport: 'http',
    observedAt: '2026-04-21T09:01:00.000Z',
    method: 'GET',
    resourceUrl: RESOURCE_URL,
    statusCode: X402_HTTP_PAYMENT_REQUIRED_STATUS,
    paymentRequiredHeaderPresent: true,
    paymentRequiredHeaderDecoded: true,
    responseBodyMatchesHeader: true,
    description: 'Premium market data',
    mimeType: 'application/json',
    routeId: 'GET /market-data/premium',
    ...overrides,
  };
}

export function requirements(
  overrides: Partial<X402PaymentRequirementsEvidence> = {},
): X402PaymentRequirementsEvidence {
  return {
    x402Version: X402_PROTOCOL_VERSION,
    acceptsCount: 1,
    selectedAcceptIndex: 0,
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '120000',
    asset: USDC_BASE,
    payTo: PAY_TO_ADDRESS,
    maxTimeoutSeconds: 60,
    extraName: 'USDC',
    extraVersion: '2',
    requirementsHash: REQUIREMENTS_HASH,
    extensionsAdvertised: ['sign-in-with-x'],
    ...overrides,
  };
}

export function authorization(
  overrides: Partial<X402ExactAuthorizationEvidence> = {},
): X402ExactAuthorizationEvidence {
  return {
    mode: 'eip-3009-transfer-with-authorization',
    from: PAYER_ADDRESS,
    to: PAY_TO_ADDRESS,
    value: '120000',
    validAfterEpochSeconds: '1776762000',
    validBeforeEpochSeconds: '1776762060',
    nonce: AUTHORIZATION_NONCE,
    signature: SIGNATURE,
    signatureValid: true,
    domainName: 'USDC',
    domainVersion: '2',
    domainChainId: '8453',
    verifyingContract: USDC_BASE,
    nonceUnused: true,
    balanceSufficient: true,
    transferSimulationSucceeded: true,
    ...overrides,
  };
}

export function payload(
  overrides: Partial<X402PaymentPayloadEvidence> = {},
): X402PaymentPayloadEvidence {
  const auth = overrides.authorization ?? authorization();
  return {
    x402Version: X402_PROTOCOL_VERSION,
    paymentSignatureHeaderPresent: true,
    payloadHash: PAYLOAD_HASH,
    resourceMatchesRequirements: true,
    acceptedMatchesRequirements: true,
    payer: PAYER_ADDRESS,
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '120000',
    asset: USDC_BASE,
    payTo: PAY_TO_ADDRESS,
    authorization: auth,
    extensionsEchoed: true,
    ...overrides,
    authorization: auth,
  };
}

export function facilitator(
  overrides: Partial<X402FacilitatorEvidence> = {},
): X402FacilitatorEvidence {
  return {
    path: 'facilitator-verify-settle',
    facilitatorUrl: FACILITATOR_URL,
    supportedChecked: true,
    supportedKindAdvertised: true,
    signerTrusted: true,
    verifyRequested: true,
    verifyResponseValid: true,
    verifyInvalidReason: null,
    verifyPayer: PAYER_ADDRESS,
    settleRequested: true,
    settleResponseSuccess: true,
    settlementTransaction: SETTLEMENT_TX,
    settlementNetwork: 'eip155:8453',
    settlementPayer: PAYER_ADDRESS,
    settlementAmount: '120000',
    paymentResponseHeaderPresent: true,
    ...overrides,
  };
}

export function budget(overrides: Partial<X402AgentBudgetEvidence> = {}): X402AgentBudgetEvidence {
  return {
    agentId: 'agent:x402-market-data',
    budgetId: 'budget:x402:market-data:daily',
    spendLimitAtomic: '1000000',
    spendUsedAtomic: '250000',
    proposedSpendAtomic: '120000',
    cadence: 'per-minute',
    requestsUsedInWindow: 2,
    maxRequestsInWindow: 10,
    idempotencyKey: 'idem-x402-market-data-001',
    idempotencyFresh: true,
    duplicatePaymentDetected: false,
    correlationId: 'corr-x402-market-data-001',
    ...overrides,
  };
}

export function serviceTrust(
  overrides: Partial<X402ServiceTrustEvidence> = {},
): X402ServiceTrustEvidence {
  return {
    merchantId: 'merchant:attestor-market-data',
    serviceDiscoveryRef: 'x402-bazaar:market-data:attestor',
    resourceOriginAllowlisted: true,
    payToAllowlisted: true,
    assetAllowlisted: true,
    assetAllowlistEvidenceRef: 'asset-allowlist:base-usdc:sha256:001',
    networkAllowlisted: true,
    priceMatchesCatalog: true,
    ...overrides,
  };
}

export function privacy(
  overrides: Partial<X402PrivacyMetadataEvidence> = {},
): X402PrivacyMetadataEvidence {
  return {
    metadataScanned: true,
    piiDetected: false,
    piiRedacted: false,
    sensitiveQueryDetected: false,
    sensitiveQueryRedacted: false,
    metadataMinimized: true,
    facilitatorDataMinimized: true,
    reasonStringPiiDetected: false,
    ...overrides,
  };
}

export function preflightInput() {
  return {
    ...fixtureSuite(),
    resource: resource(),
    paymentRequirements: requirements(),
    paymentPayload: payload(),
    facilitator: facilitator(),
    budget: budget(),
    serviceTrust: serviceTrust(),
    privacy: privacy(),
  };
}
