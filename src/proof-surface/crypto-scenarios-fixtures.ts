import {
  createCryptoEnforcementVerificationBinding,
  type CryptoEnforcementVerificationBinding,
} from '../crypto-authorization-core/enforcement-plane-verification.js';
import {
  createCryptoPolicyControlPlaneScopeBinding,
  type CryptoPolicyControlPlaneScopeBinding,
} from '../crypto-authorization-core/policy-control-plane-scope-binding.js';
import {
  createCryptoReleaseDecisionBinding,
  type CryptoReleaseDecisionBinding,
} from '../crypto-authorization-core/release-decision-binding.js';
import {
  createCryptoEoaSignatureValidationProjection,
} from '../crypto-authorization-core/erc1271-validation-projection.js';
import {
  createCryptoReplayFreshnessRules,
  evaluateCryptoAuthorizationFreshness,
} from '../crypto-authorization-core/replay-freshness-rules.js';
import {
  createCryptoEip712AuthorizationEnvelope,
} from '../crypto-authorization-core/eip712-authorization-envelope.js';
import {
  createCryptoCanonicalAssetReference,
  createCryptoCanonicalReferenceBundle,
} from '../crypto-authorization-core/canonical-references.js';
import {
  createCryptoConsequenceRiskAssessment,
  type CryptoConsequenceRiskAssessment,
} from '../crypto-authorization-core/consequence-risk-mapping.js';
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
} from '../crypto-authorization-core/object-model.js';
import {
  createCryptoAccountReference,
  createCryptoAssetReference,
  createCryptoChainReference,
} from '../crypto-authorization-core/types.js';
import {
  EIP7702_ACCOUNT_ADDRESS,
  EIP7702_SIGNATURE,
  EIP7702_SPIFFE_ID,
  EIP7702_TARGET_ADDRESS,
  EIP7702_VERIFYING_CONTRACT,
  FRESH_REVOCATION_CHECKED_AT_EPOCH_SECONDS,
  POLICY_DIMENSIONS,
  SIMULATED_AT_EPOCH_SECONDS,
  X402_AUTHORIZATION_NONCE,
  X402_PAYER_ADDRESS,
  X402_PAY_TO_ADDRESS,
  X402_RESOURCE_URL,
  X402_SIGNATURE,
  X402_SPIFFE_ID,
  X402_USDC_BASE,
  X402_VERIFYING_CONTRACT,
} from './crypto-scenarios-constants.js';

interface CryptoFixtureSuite {
  readonly intent: CryptoAuthorizationIntent;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
}

function x402Chain() {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId: '8453',
  });
}

function eip7702Chain() {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId: '1',
  });
}

function x402Account() {
  return createCryptoAccountReference({
    accountKind: 'agent-wallet',
    chain: x402Chain(),
    address: X402_PAYER_ADDRESS,
    accountLabel: 'Agent x402 wallet',
  });
}

function eip7702Account() {
  return createCryptoAccountReference({
    accountKind: 'eoa',
    chain: eip7702Chain(),
    address: EIP7702_ACCOUNT_ADDRESS,
    accountLabel: 'Treasury EOA',
  });
}

function x402Asset() {
  return createCryptoAssetReference({
    assetKind: 'stablecoin',
    chain: x402Chain(),
    assetId: X402_USDC_BASE,
    symbol: 'USDC',
    decimals: 6,
  });
}

export function x402FixtureSuite(): CryptoFixtureSuite {
  const chain = x402Chain();
  const account = x402Account();
  const asset = x402Asset();
  const requester = createCryptoAuthorizationActor({
    actorKind: 'agent',
    actorId: 'agent:x402-market-data',
    authorityRef: 'authority:x402-agent-budget-policy',
  });
  const target = createCryptoExecutionTarget({
    targetKind: 'payee',
    chain,
    targetId: X402_RESOURCE_URL,
    address: X402_PAY_TO_ADDRESS,
    counterparty: X402_PAY_TO_ADDRESS,
    protocol: 'x402',
    calldataClass: 'http-get-premium-market-data',
  });
  const policyScope = createCryptoAuthorizationPolicyScope({
    dimensions: POLICY_DIMENSIONS,
    environment: 'prod-crypto',
    tenantId: 'tenant-crypto',
    policyPackRef: 'policy-pack:crypto:x402:v1',
  });
  const constraints = createCryptoAuthorizationConstraints({
    validAfter: '2026-04-21T09:00:00.000Z',
    validUntil: '2026-04-21T09:02:00.000Z',
    nonce: X402_AUTHORIZATION_NONCE,
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
    intentId: 'intent-proof-crypto-x402-payment',
    requestedAt: '2026-04-21T09:00:01.000Z',
    requester,
    account,
    asset,
    consequenceKind: 'agent-payment',
    target,
    policyScope,
    constraints,
    executionAdapterKind: 'x402-payment',
    evidenceRefs: [
      'evidence:proof-crypto-x402-payment:001',
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
      executionAdapterKind: 'x402-payment',
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
    address: X402_PAYER_ADDRESS,
  });
  const cryptoDecision = createCryptoAuthorizationDecision({
    decisionId: 'decision-proof-crypto-x402-payment',
    intent,
    decidedAt: '2026-04-21T09:00:02.000Z',
    status: 'allow',
    riskClass: riskAssessment.riskClass,
    releaseDecisionId: 'release-proof-crypto-x402-payment',
    reasonCodes: ['policy-allow', 'x402-budget-reviewed'],
    signerAuthorities: [signer],
  });
  const envelope = createCryptoEip712AuthorizationEnvelope({
    envelopeId: 'envelope-proof-crypto-x402-payment',
    receiptId: 'receipt-proof-crypto-x402-payment',
    intent,
    decision: cryptoDecision,
    signerAuthority: signer,
    riskAssessment,
    referenceBundle,
    verifyingContract: X402_VERIFYING_CONTRACT,
  });
  const signatureValidation = createCryptoEoaSignatureValidationProjection({
    envelope,
    signature: X402_SIGNATURE,
    expectedSigner: X402_PAYER_ADDRESS,
    adapterKind: 'x402-payment',
  });
  const freshnessRules = createCryptoReplayFreshnessRules({
    intent,
    decision: cryptoDecision,
    envelope,
    idempotencyKey: 'idem-proof-x402-market-data-001',
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
    requestId: 'erq_proof_crypto_x402_payment',
    receivedAt: '2026-04-21T09:00:04.000Z',
    enforcementPoint: {
      enforcementPointId: 'pep.proof.crypto.x402-payment',
      workloadId: X402_SPIFFE_ID,
    },
    traceId: 'trace-proof-crypto-x402-payment-001',
    idempotencyKey: 'idem-proof-x402-market-data-001',
  });

  return {
    intent,
    riskAssessment,
    releaseBinding,
    policyScopeBinding,
    enforcementBinding,
  };
}

export function eip7702FixtureSuite(): CryptoFixtureSuite {
  const chain = eip7702Chain();
  const account = eip7702Account();
  const requester = createCryptoAuthorizationActor({
    actorKind: 'agent',
    actorId: 'agent:treasury-eip7702',
    authorityRef: 'authority:treasury-eip7702-policy',
  });
  const target = createCryptoExecutionTarget({
    targetKind: 'contract',
    chain,
    targetId: 'contract:bounded-delegated-call',
    address: EIP7702_TARGET_ADDRESS,
    counterparty: 'contract:bounded-delegated-call',
    protocol: 'eip7702-delegate-protocol',
    functionSelector: '0x12345678',
    calldataClass: 'bounded-delegated-call',
  });
  const policyScope = createCryptoAuthorizationPolicyScope({
    dimensions: POLICY_DIMENSIONS,
    environment: 'prod-crypto',
    tenantId: 'tenant-crypto',
    policyPackRef: 'policy-pack:crypto:eip7702:v1',
  });
  const constraints = createCryptoAuthorizationConstraints({
    validAfter: '2026-04-21T09:00:00.000Z',
    validUntil: '2026-04-21T09:05:00.000Z',
    nonce: 'authorization-list:nonce:7',
    replayProtectionMode: 'authorization-list-nonce',
    digestMode: 'eip-712-typed-data',
    requiredArtifacts: CRYPTO_AUTHORIZATION_DEFAULT_REQUIRED_ARTIFACTS,
    budgetId: 'budget:eip7702:daily',
  });
  const intent = createCryptoAuthorizationIntent({
    intentId: 'intent-proof-crypto-eip7702-delegation',
    requestedAt: '2026-04-21T09:00:01.000Z',
    requester,
    account,
    consequenceKind: 'account-delegation',
    target,
    policyScope,
    constraints,
    executionAdapterKind: 'eip-7702-delegation',
    evidenceRefs: [
      'evidence:proof-crypto-eip7702-delegation:001',
      'policy:activation:eip7702:001',
    ],
  });
  const referenceBundle = createCryptoCanonicalReferenceBundle({
    chain,
    account,
  });
  const riskAssessment = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'account-delegation',
    account,
    context: {
      executionAdapterKind: 'eip-7702-delegation',
      signals: ['agent-initiated'],
      hasExpiry: true,
      hasBudget: true,
      hasRevocationPath: true,
    },
  });
  const signer = createCryptoSignerAuthority({
    authorityKind: 'eoa-signer',
    authorityId: 'eoa:treasury',
    validationMode: 'eip-712-eoa',
    address: EIP7702_ACCOUNT_ADDRESS,
  });
  const cryptoDecision = createCryptoAuthorizationDecision({
    decisionId: 'decision-proof-crypto-eip7702-delegation',
    intent,
    decidedAt: '2026-04-21T09:00:02.000Z',
    status: 'allow',
    riskClass: riskAssessment.riskClass,
    releaseDecisionId: 'release-proof-crypto-eip7702-delegation',
    reasonCodes: ['policy-allow', 'eip7702-delegation-reviewed'],
    signerAuthorities: [signer],
  });
  const envelope = createCryptoEip712AuthorizationEnvelope({
    envelopeId: 'envelope-proof-crypto-eip7702-delegation',
    receiptId: 'receipt-proof-crypto-eip7702-delegation',
    intent,
    decision: cryptoDecision,
    signerAuthority: signer,
    riskAssessment,
    referenceBundle,
    verifyingContract: EIP7702_VERIFYING_CONTRACT,
  });
  const signatureValidation = createCryptoEoaSignatureValidationProjection({
    envelope,
    signature: EIP7702_SIGNATURE,
    expectedSigner: EIP7702_ACCOUNT_ADDRESS,
    adapterKind: 'eip-7702-delegation',
  });
  const freshnessRules = createCryptoReplayFreshnessRules({
    intent,
    decision: cryptoDecision,
    envelope,
  });
  const freshnessEvaluation = evaluateCryptoAuthorizationFreshness({
    rules: freshnessRules,
    nowEpochSeconds: SIMULATED_AT_EPOCH_SECONDS,
    revocationObservation: {
      revocationKey: freshnessRules.revocation.revocationKey,
      status: 'active',
      checkedAtEpochSeconds: FRESH_REVOCATION_CHECKED_AT_EPOCH_SECONDS,
    },
    adapterNonceObservation: {
      nonce: freshnessRules.adapterNonce.expectedNonce,
      matchesExpected: true,
      checkedAtEpochSeconds: FRESH_REVOCATION_CHECKED_AT_EPOCH_SECONDS,
      sourceKind: 'eip-7702-authority-nonce',
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
    requestId: 'erq_proof_crypto_eip7702_delegation',
    receivedAt: '2026-04-21T09:01:00.000Z',
    enforcementPoint: {
      enforcementPointId: 'pep.proof.crypto.eip7702-delegation',
      workloadId: EIP7702_SPIFFE_ID,
    },
    traceId: 'trace-proof-crypto-eip7702-delegation-001',
    idempotencyKey: 'idem-proof-crypto-eip7702-delegation-001',
  });

  return {
    intent,
    riskAssessment,
    releaseBinding,
    policyScopeBinding,
    enforcementBinding,
  };
}
