import assert from 'node:assert/strict';
import {
  CRYPTO_INTELLIGENCE_MISSING_EVIDENCE_CLASSES,
  CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
  CRYPTO_INTELLIGENCE_SIGNAL_CATEGORIES,
  CRYPTO_INTELLIGENCE_SIGNAL_DISPOSITIONS,
  CRYPTO_INTELLIGENCE_SIGNAL_SEVERITIES,
  createCryptoIntelligenceRiskSignalAssessment,
  cryptoIntelligenceRiskSignalLabel,
  cryptoIntelligenceRiskSignalsDescriptor,
} from '../src/crypto-authorization-core/intelligence-risk-signals.js';
import {
  createCryptoConsequenceRiskAssessment,
} from '../src/crypto-authorization-core/consequence-risk-mapping.js';
import {
  createCryptoCanonicalCounterpartyReference,
} from '../src/crypto-authorization-core/canonical-references.js';
import {
  createCryptoAccountReference,
  createCryptoAssetReference,
  createCryptoChainReference,
} from '../src/crypto-authorization-core/types.js';
import type {
  CryptoSimulationObservation,
} from '../src/crypto-authorization-core/authorization-simulation.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function fixtureChain(chainId = '1') {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId,
  });
}

function fixtureOtherChain() {
  return createCryptoChainReference({
    namespace: 'other',
    chainId: 'customer-chain',
  });
}

function fixtureAccount(accountKind: Parameters<typeof createCryptoAccountReference>[0]['accountKind'] = 'eoa') {
  return createCryptoAccountReference({
    accountKind,
    chain: fixtureChain(),
    address: '0x1111111111111111111111111111111111111111',
  });
}

function fixtureAsset(assetKind: Parameters<typeof createCryptoAssetReference>[0]['assetKind'] = 'stablecoin') {
  return createCryptoAssetReference({
    assetKind,
    chain: fixtureChain(),
    assetId: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
  });
}

function fixtureCounterparty(counterpartyKind: Parameters<typeof createCryptoCanonicalCounterpartyReference>[0]['counterpartyKind'] = 'account') {
  return createCryptoCanonicalCounterpartyReference({
    counterpartyKind,
    counterpartyId: `${counterpartyKind}:main`,
    chain: fixtureChain(),
  });
}

function signalCodes(
  assessment: ReturnType<typeof createCryptoIntelligenceRiskSignalAssessment>,
): readonly string[] {
  return assessment.signals.map((signal) => signal.code);
}

function signalByCode(
  assessment: ReturnType<typeof createCryptoIntelligenceRiskSignalAssessment>,
  code: string,
) {
  const found = assessment.signals.find((signal) => signal.code === code);
  assert.ok(found, `Expected signal ${code}`);
  return found;
}

function warningObservation(code: string): CryptoSimulationObservation {
  return {
    check: 'adapter-preflight-readiness',
    source: 'erc-4337-validation',
    status: 'not-run',
    severity: 'warning',
    code,
    message: 'Adapter preflight was not run.',
    required: true,
    evidence: {
      reasonCode: code,
    },
  };
}

function testDescriptorVocabulary(): void {
  const descriptor = cryptoIntelligenceRiskSignalsDescriptor();

  equal(
    descriptor.version,
    CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
    'crypto intelligence risk signals: descriptor exposes version',
  );
  deepEqual(
    descriptor.categories,
    CRYPTO_INTELLIGENCE_SIGNAL_CATEGORIES,
    'crypto intelligence risk signals: descriptor exposes categories',
  );
  deepEqual(
    descriptor.severities,
    CRYPTO_INTELLIGENCE_SIGNAL_SEVERITIES,
    'crypto intelligence risk signals: descriptor exposes severities',
  );
  deepEqual(
    descriptor.dispositions,
    CRYPTO_INTELLIGENCE_SIGNAL_DISPOSITIONS,
    'crypto intelligence risk signals: descriptor exposes dispositions',
  );
  ok(
    CRYPTO_INTELLIGENCE_MISSING_EVIDENCE_CLASSES.includes('delegation-authorization'),
    'crypto intelligence risk signals: missing evidence vocabulary includes delegation evidence',
  );
}

function testRiskMapperFindingsBecomeModelSafeSignals(): void {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'approval',
    account: fixtureAccount(),
    asset: fixtureAsset(),
    amount: {
      isUnlimitedApproval: true,
    },
    counterparty: fixtureCounterparty('contract'),
    context: {
      hasRevocationPath: false,
      hasExpiry: false,
    },
  });
  const assessment = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
    context: {
      allowance: {
        isUnlimitedApproval: true,
        hasRevocationPath: false,
        hasExpiry: false,
        spenderKnown: true,
      },
    },
  });

  equal(assessment.version, CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION, 'crypto intelligence risk signals: version is stable');
  equal(assessment.overallSeverity, 'critical', 'crypto intelligence risk signals: unlimited approval is critical');
  equal(assessment.recommendedDisposition, 'block', 'crypto intelligence risk signals: missing revocation blocks');
  ok(signalCodes(assessment).includes('unlimited-approval'), 'crypto intelligence risk signals: risk mapper finding is translated');
  ok(signalCodes(assessment).includes('allowance-revocation-missing'), 'crypto intelligence risk signals: allowance context adds revocation blocker');
  ok(
    signalByCode(assessment, 'missing-revocation').missingEvidenceClasses.includes('revocation-path'),
    'crypto intelligence risk signals: missing revocation exposes model-safe evidence class',
  );
  ok(
    assessment.digest.startsWith('sha256:'),
    'crypto intelligence risk signals: assessment digest is canonical',
  );
}

function testDelegatedEoaFailsClosedWithoutTupleNonceAndRevocation(): void {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'account-delegation',
    account: fixtureAccount(),
    context: {
      executionAdapterKind: 'eip-7702-delegation',
    },
  });
  const assessment = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
    readiness: {
      releaseBinding: 'ready',
      policyBinding: 'ready',
      enforcementBinding: 'ready',
      adapterPreflight: 'blocked',
    },
    context: {
      executionAdapterKind: 'eip-7702-delegation',
      delegation: {
        nonceFresh: false,
        delegateRevocationPath: false,
      },
      freshness: {
        evaluatedAt: '2026-05-11T10:00:00.000Z',
        evidenceCreatedAt: '2026-05-11T09:00:00.000Z',
        maxAgeSeconds: 60,
      },
    },
  });

  equal(assessment.recommendedDisposition, 'block', 'crypto intelligence risk signals: delegated EOA unsafe posture blocks');
  ok(signalCodes(assessment).includes('delegation-authorization-missing'), 'crypto intelligence risk signals: missing authorization tuple is signaled');
  ok(signalCodes(assessment).includes('delegation-nonce-not-fresh'), 'crypto intelligence risk signals: stale nonce is signaled');
  ok(signalCodes(assessment).includes('delegation-revocation-missing'), 'crypto intelligence risk signals: missing delegation revocation is signaled');
  ok(signalCodes(assessment).includes('freshness-window-stale'), 'crypto intelligence risk signals: stale evidence is signaled');
  ok(assessment.missingEvidenceClasses.includes('delegation-authorization'), 'crypto intelligence risk signals: missing classes include delegation authorization');
  ok(assessment.missingEvidenceClasses.includes('freshness-window'), 'crypto intelligence risk signals: missing classes include freshness window');
}

function testX402AndSolverInputsStayDigestFirst(): void {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'agent-payment',
    account: fixtureAccount('agent-wallet'),
    asset: fixtureAsset(),
    amount: {
      assetAmount: '12.50',
      normalizedUsd: '12.50',
    },
    context: {
      executionAdapterKind: 'x402-payment',
      hasBudget: true,
      hasExpiry: true,
    },
  });
  const assessment = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
    observations: [warningObservation('erc-4337-validation-not-run')],
    context: {
      x402: {
        paymentRequirementDigest: 'sha256:payment-requirement',
        paymentSignatureDigest: null,
        paymentResponseDigest: null,
        idempotencyKeyDigest: null,
      },
      solver: {
        routeCommitmentDigest: null,
        settlementPreflightDigest: null,
        refundPathBound: false,
      },
      route: {
        isCrossChain: true,
        usesBridge: true,
        routeCommitmentDigest: null,
        refundPathBound: false,
      },
    },
  });

  equal(assessment.recommendedDisposition, 'block', 'crypto intelligence risk signals: missing payment and solver evidence blocks');
  ok(signalCodes(assessment).includes('x402-payment-signature-missing'), 'crypto intelligence risk signals: missing x402 signature is signaled');
  ok(signalCodes(assessment).includes('solver-settlement-preflight-missing'), 'crypto intelligence risk signals: missing settlement preflight is signaled');
  ok(signalCodes(assessment).includes('cross-chain-route'), 'crypto intelligence risk signals: route risk is signaled');
  ok(
    !assessment.canonical.includes('0x1111111111111111111111111111111111111111'),
    'crypto intelligence risk signals: canonical output does not leak raw wallet address',
  );
  ok(
    !assessment.canonical.includes('PAYMENT-SIGNATURE'),
    'crypto intelligence risk signals: canonical output does not require raw payment header contents',
  );
}

function testCustodyVelocityAndNonStandardChainPosture(): void {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'custody-withdrawal',
    account: fixtureAccount('custody-account'),
    asset: fixtureAsset(),
    amount: {
      assetAmount: '100',
      normalizedUsd: '100',
    },
    counterparty: fixtureCounterparty('custody-destination'),
    context: {
      executionAdapterKind: 'custody-cosigner',
      requiresCustodyPolicy: true,
      hasCustodyPolicy: false,
    },
  });
  const assessment = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
    context: {
      chain: fixtureOtherChain(),
      custody: {
        requiresPolicy: true,
        policyDecisionDigest: null,
        quorumMet: false,
        providerTerminalStatus: 'hold',
      },
      velocity: {
        windowSeconds: 3600,
        operationCount: 20,
        normalizedUsd: '250000',
        distinctCounterparties: 10,
      },
    },
  });

  equal(assessment.overallSeverity, 'critical', 'crypto intelligence risk signals: custody velocity is critical');
  equal(assessment.blockSignalCount > 0, true, 'crypto intelligence risk signals: custody velocity has blockers');
  ok(signalCodes(assessment).includes('non-standard-chain-runtime'), 'crypto intelligence risk signals: non-standard chain is review-grade');
  ok(signalCodes(assessment).includes('custody-policy-decision-missing'), 'crypto intelligence risk signals: custody policy decision is required');
  ok(signalCodes(assessment).includes('custody-quorum-missing'), 'crypto intelligence risk signals: custody quorum is required');
  ok(signalCodes(assessment).includes('velocity-operation-critical'), 'crypto intelligence risk signals: critical operation velocity is signaled');
  ok(signalCodes(assessment).includes('velocity-amount-critical'), 'crypto intelligence risk signals: critical value velocity is signaled');
  ok(signalCodes(assessment).includes('velocity-counterparty-critical'), 'crypto intelligence risk signals: critical counterparty velocity is signaled');
}

function testDeterminismAndValidation(): void {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'agent-payment',
    account: fixtureAccount(),
    asset: fixtureAsset(),
    amount: {
      assetAmount: '10',
      normalizedUsd: '10',
    },
  });
  const left = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
    context: {
      freshness: {
        evaluatedAt: '2026-05-11T10:00:00.000Z',
        evidenceCreatedAt: '2026-05-11T09:59:00.000Z',
        maxAgeSeconds: 120,
      },
    },
  });
  const right = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
    context: {
      freshness: {
        evidenceCreatedAt: '2026-05-11T09:59:00.000Z',
        maxAgeSeconds: 120,
        evaluatedAt: '2026-05-11T10:00:00.000Z',
      },
    },
  });

  equal(left.digest, right.digest, 'crypto intelligence risk signals: digest is deterministic across object key order');
  equal(
    cryptoIntelligenceRiskSignalLabel(left),
    `crypto-intelligence:agent-payment / risk:${left.riskClass} / severity:${left.overallSeverity} / disposition:${left.recommendedDisposition} / signals:${left.signalCount}`,
    'crypto intelligence risk signals: label is stable',
  );

  assert.throws(
    () =>
      createCryptoIntelligenceRiskSignalAssessment({
        riskAssessment: risk,
        context: {
          velocity: {
            normalizedUsd: '-1',
          },
        },
      }),
    /non-negative decimal/i,
  );
  passed += 1;

  assert.throws(
    () =>
      createCryptoIntelligenceRiskSignalAssessment({
        riskAssessment: risk,
        context: {
          freshness: {
            evaluatedAt: 'not-a-date',
          },
        },
      }),
    /ISO timestamp/i,
  );
  passed += 1;
}

testDescriptorVocabulary();
testRiskMapperFindingsBecomeModelSafeSignals();
testDelegatedEoaFailsClosedWithoutTupleNonceAndRevocation();
testX402AndSolverInputsStayDigestFirst();
testCustodyVelocityAndNonStandardChainPosture();
testDeterminismAndValidation();

console.log(`Crypto authorization core intelligence risk-signal tests: ${passed} passed, 0 failed`);
