import assert from 'node:assert/strict';
import {
  CRYPTO_INTELLIGENCE_PRIVACY_ALLOWED_UNITS,
  CRYPTO_INTELLIGENCE_PRIVACY_FORBIDDEN_RAW_CLASSES,
  CRYPTO_INTELLIGENCE_PRIVACY_MINIMIZATION_SPEC_VERSION,
  assertCryptoIntelligencePrivacyMinimized,
  cryptoIntelligencePrivacyMinimizationDescriptor,
  evaluateCryptoIntelligencePrivacyMinimizationArtifact,
} from '../src/crypto-authorization-core/intelligence-privacy-minimization.js';
import {
  createCryptoIntelligenceRiskSignalAssessment,
} from '../src/crypto-authorization-core/intelligence-risk-signals.js';
import {
  createCryptoPolicyGapNarrowingAssessment,
} from '../src/crypto-authorization-core/policy-gap-narrowing.js';
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
import {
  CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_FIXTURES,
  createCryptoAdapterReadinessManifest,
} from '../src/crypto-execution-admission/index.js';

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

function fixtureChain() {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId: '1',
  });
}

function fixtureAccount() {
  return createCryptoAccountReference({
    accountKind: 'agent-wallet',
    chain: fixtureChain(),
    address: '0x1111111111111111111111111111111111111111',
  });
}

function fixtureAsset() {
  return createCryptoAssetReference({
    assetKind: 'stablecoin',
    chain: fixtureChain(),
    assetId: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
  });
}

function fixtureCounterparty() {
  return createCryptoCanonicalCounterpartyReference({
    counterpartyKind: 'contract',
    counterpartyId: 'contract:main',
    chain: fixtureChain(),
  });
}

function safeRiskSignalAssessment() {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'agent-payment',
    account: fixtureAccount(),
    asset: fixtureAsset(),
    amount: {
      assetAmount: '12.50',
      normalizedUsd: '12.50',
    },
    counterparty: fixtureCounterparty(),
    context: {
      executionAdapterKind: 'x402-payment',
      hasBudget: true,
      hasExpiry: true,
    },
  });

  return createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
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
}

function testDescriptor(): void {
  const descriptor = cryptoIntelligencePrivacyMinimizationDescriptor();

  equal(
    descriptor.version,
    CRYPTO_INTELLIGENCE_PRIVACY_MINIMIZATION_SPEC_VERSION,
    'crypto privacy minimization: descriptor exposes version',
  );
  ok(
    descriptor.allowedUnits.includes('digests'),
    'crypto privacy minimization: descriptor allows digest-only evidence',
  );
  deepEqual(
    descriptor.allowedUnits,
    CRYPTO_INTELLIGENCE_PRIVACY_ALLOWED_UNITS,
    'crypto privacy minimization: descriptor exposes allowed units',
  );
  ok(
    descriptor.forbiddenRawClasses.includes('raw-custody-callback-body'),
    'crypto privacy minimization: descriptor forbids custody callback bodies',
  );
  deepEqual(
    descriptor.forbiddenRawClasses,
    CRYPTO_INTELLIGENCE_PRIVACY_FORBIDDEN_RAW_CLASSES,
    'crypto privacy minimization: descriptor exposes forbidden raw classes',
  );
  equal(
    descriptor.rawPayloadStored,
    false,
    'crypto privacy minimization: descriptor rejects raw payload storage',
  );
  equal(
    descriptor.customerIdentifiersStored,
    false,
    'crypto privacy minimization: descriptor rejects customer identifiers',
  );
}

function testKnownIntelligenceOutputsStayPrivacySafe(): void {
  const signals = safeRiskSignalAssessment();
  const gaps = createCryptoPolicyGapNarrowingAssessment({
    signalAssessment: signals,
    generatedAt: '2026-05-11T12:00:00.000Z',
    operatorContextRef: 'operator-context:crypto-review',
  });

  const signalEvaluation = evaluateCryptoIntelligencePrivacyMinimizationArtifact({
    surfaceKind: 'risk-signal-assessment',
    artifact: signals,
  });
  const gapEvaluation = evaluateCryptoIntelligencePrivacyMinimizationArtifact({
    surfaceKind: 'policy-gap-narrowing',
    artifact: gaps,
  });

  equal(signalEvaluation.allowed, true, 'crypto privacy minimization: risk signals are safe');
  equal(gapEvaluation.allowed, true, 'crypto privacy minimization: gap narrowing is safe');
  equal(signalEvaluation.rawPayloadStored, false, 'crypto privacy minimization: no raw payload flag');
  ok(signalEvaluation.digest.startsWith('sha256:'), 'crypto privacy minimization: risk signal evaluation is digest-bound');
  ok(
    !signalEvaluation.canonical.includes('0x1111111111111111111111111111111111111111'),
    'crypto privacy minimization: evaluation canonical does not store raw account addresses',
  );
}

function testExecutionProofSurfacesStayPrivacySafe(): void {
  const manifest = createCryptoAdapterReadinessManifest({
    generatedAt: '2026-05-11T12:01:00.000Z',
    scopeRef: 'crypto-intelligence-step-06',
  });
  const manifestEvaluation = evaluateCryptoIntelligencePrivacyMinimizationArtifact({
    surfaceKind: 'adapter-readiness-manifest',
    artifact: manifest,
  });
  const negativeFixtureEvaluation = evaluateCryptoIntelligencePrivacyMinimizationArtifact({
    surfaceKind: 'negative-conformance-fixtures',
    artifact: CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_FIXTURES,
  });

  equal(manifestEvaluation.allowed, true, 'crypto privacy minimization: adapter manifest is safe');
  equal(negativeFixtureEvaluation.allowed, true, 'crypto privacy minimization: negative fixtures are safe');
  equal(
    negativeFixtureEvaluation.reasonCodes.length,
    0,
    'crypto privacy minimization: negative fixtures expose no raw classes',
  );
}

function testRejectsRawCryptoAndCustomerMaterial(): void {
  const unsafeArtifacts = [
    { rawWalletMetadata: { address: '0x1111111111111111111111111111111111111111' } },
    { transactionPayload: '0xf86c_raw_payload_must_not_escape' },
    { custodyCallbackBody: { approved: true, signer: 'operator@example.test' } },
    { providerErrorBody: 'bearer abc.def.ghi' },
    { solverRouteSecret: 'secret=solver-route' },
    { privatePolicyThreshold: '250000' },
    { customerIdentifier: 'cus_live_123' },
    { idempotencyKey: 'idem_raw_123' },
    { rawPayloadStored: true },
  ];

  for (const artifact of unsafeArtifacts) {
    const evaluation = evaluateCryptoIntelligencePrivacyMinimizationArtifact({
      surfaceKind: 'admission-telemetry-event',
      artifact,
    });
    equal(evaluation.allowed, false, 'crypto privacy minimization: raw material is rejected');
    equal(evaluation.failClosed, true, 'crypto privacy minimization: unsafe material fails closed');
    ok(
      evaluation.reasonCodes.length > 0,
      'crypto privacy minimization: unsafe material emits reason codes',
    );
    ok(
      !evaluation.canonical.includes('cus_live_123') &&
        !evaluation.canonical.includes('secret=solver-route'),
      'crypto privacy minimization: evaluation canonical excludes raw sensitive values',
    );
  }
}

function testExplicitRawClassFlagsAndAssert(): void {
  const evaluation = evaluateCryptoIntelligencePrivacyMinimizationArtifact({
    surfaceKind: 'intelligence-proof-packet',
    artifact: {
      reasonCodes: ['route-boundary-unsafe'],
      routeCommitmentDigest: 'sha256:route',
    },
    exposedRawClasses: ['raw-solver-route-secret'],
  });

  equal(evaluation.allowed, false, 'crypto privacy minimization: explicit raw class is rejected');
  ok(
    evaluation.reasonCodes.includes('forbidden-raw-class:raw-solver-route-secret'),
    'crypto privacy minimization: explicit raw class reason is present',
  );

  assert.throws(
    () =>
      assertCryptoIntelligencePrivacyMinimized({
        surfaceKind: 'intelligence-proof-packet',
        artifact: { rawProviderResponseBody: 'provider-secret' },
      }),
    /raw-provider-response-body-field/,
    'crypto privacy minimization: assertion helper rejects unsafe artifacts',
  );
  passed += 1;
}

testDescriptor();
testKnownIntelligenceOutputsStayPrivacySafe();
testExecutionProofSurfacesStayPrivacySafe();
testRejectsRawCryptoAndCustomerMaterial();
testExplicitRawClassFlagsAndAssert();

console.log(`Crypto authorization core intelligence privacy-minimization tests: ${passed} passed, 0 failed`);
