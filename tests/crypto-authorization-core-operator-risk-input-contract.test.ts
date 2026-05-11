import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  CRYPTO_OPERATOR_RISK_GOVERNANCE_REFS,
  CRYPTO_OPERATOR_RISK_INPUT_CLASSES,
  CRYPTO_OPERATOR_RISK_INPUT_CONTRACT_SPEC_VERSION,
  CRYPTO_OPERATOR_RISK_MISSING_EVIDENCE_CLASSES,
  createCryptoOperatorRiskInputBundle,
  cryptoOperatorRiskInputBundleLabel,
  cryptoOperatorRiskInputContractDescriptor,
} from '../src/crypto-authorization-core/operator-risk-input-contract.js';
import type {
  CryptoOperatorRiskInput,
} from '../src/crypto-authorization-core/operator-risk-input-contract.js';

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

function digestFor(label: string): string {
  return `sha256:${createHash('sha256').update(label).digest('hex')}`;
}

function inputFixture(
  overrides: Partial<CryptoOperatorRiskInput> = {},
): CryptoOperatorRiskInput {
  const inputClass = overrides.inputClass ?? 'sanctions-screening';
  const riskTier = overrides.riskTier ?? 'high';
  return {
    inputId: overrides.inputId ?? `risk-input:${inputClass}:${riskTier}`,
    inputClass,
    riskTier,
    source: overrides.source ?? {
      sourceKind: 'third-party-provider',
      providerRef: 'provider:screening:test',
      datasetRef: 'dataset:screening:list',
      datasetVersionRef: 'dataset-version:2026-05-11',
      methodRef: 'method:screening:v1',
      retrievedAt: '2026-05-11T11:58:00.000Z',
      evidenceDigest: digestFor(`${inputClass}:source:evidence`),
      providerRunDigest: digestFor(`${inputClass}:provider-run`),
    },
    freshness: overrides.freshness ?? {
      observedAt: '2026-05-11T11:57:00.000Z',
      expiresAt: '2026-05-11T12:57:00.000Z',
      maxAgeSeconds: 3600,
    },
    scope: overrides.scope ?? {
      scopeKind: inputClass === 'route-risk' ? 'route' : 'counterparty',
      consequenceKind: inputClass === 'route-risk' ? 'bridge' : 'transfer',
      chainRef: 'eip155:1',
      counterpartyDigest: digestFor(`${inputClass}:counterparty`),
      routeDigest: inputClass === 'route-risk' ? digestFor('route:main') : null,
      policyRef: 'policy:crypto-risk-input',
    },
    evidenceRefs: overrides.evidenceRefs ?? [
      {
        kind: 'digest',
        value: digestFor(`${inputClass}:evidence`),
      },
      {
        kind: 'dataset-version',
        value: 'dataset-version:2026-05-11',
      },
    ],
    claimsAttestorNativeOracle: overrides.claimsAttestorNativeOracle ?? false,
    rawPayloadStored: overrides.rawPayloadStored ?? false,
    rawProviderResponseStored: overrides.rawProviderResponseStored ?? false,
    customerIdentifiersStored: overrides.customerIdentifiersStored ?? false,
    privatePolicyThresholdsStored: overrides.privatePolicyThresholdsStored ?? false,
    solverRouteSecretsStored: overrides.solverRouteSecretsStored ?? false,
  };
}

function testDescriptor(): void {
  const descriptor = cryptoOperatorRiskInputContractDescriptor();

  equal(
    descriptor.version,
    CRYPTO_OPERATOR_RISK_INPUT_CONTRACT_SPEC_VERSION,
    'operator risk input: descriptor exposes version',
  );
  deepEqual(
    descriptor.inputClasses,
    CRYPTO_OPERATOR_RISK_INPUT_CLASSES,
    'operator risk input: descriptor exposes input classes',
  );
  deepEqual(
    descriptor.missingEvidenceClasses,
    CRYPTO_OPERATOR_RISK_MISSING_EVIDENCE_CLASSES,
    'operator risk input: descriptor exposes missing evidence classes',
  );
  ok(
    CRYPTO_OPERATOR_RISK_GOVERNANCE_REFS.includes('w3c-prov-entity-activity-agent'),
    'operator risk input: descriptor names provenance governance',
  );
  equal(
    descriptor.attestorNativeOracleClaim,
    false,
    'operator risk input: descriptor blocks Attestor oracle claims',
  );
  equal(descriptor.autoApply, false, 'operator risk input: descriptor blocks auto apply');
  equal(descriptor.approvalRequired, true, 'operator risk input: descriptor requires approval');
}

function testAcceptedDigestBoundInputsRemainNonOracular(): void {
  const bundle = createCryptoOperatorRiskInputBundle({
    generatedAt: '2026-05-11T12:00:00.000Z',
    scopeRef: 'crypto-intelligence-step-07',
    inputs: [
      inputFixture(),
      inputFixture({
        inputId: 'risk-input:route:low',
        inputClass: 'route-risk',
        riskTier: 'low',
      }),
    ],
  });

  equal(bundle.status, 'accepted', 'operator risk input: valid inputs are accepted');
  equal(bundle.inputCount, 2, 'operator risk input: bundle records input count');
  equal(bundle.acceptedCount, 2, 'operator risk input: accepted count is recorded');
  equal(bundle.highestRiskTier, 'high', 'operator risk input: highest tier is high');
  equal(
    bundle.recommendedDisposition,
    'review',
    'operator risk input: high operator evidence routes to review',
  );
  equal(bundle.attestorNativeOracleClaim, false, 'operator risk input: no oracle claim');
  equal(bundle.rawPayloadStored, false, 'operator risk input: no raw payload storage');
  ok(bundle.digest.startsWith('sha256:'), 'operator risk input: bundle is digest-bound');
  ok(
    !bundle.canonical.includes('0x1111111111111111111111111111111111111111') &&
      !bundle.canonical.includes('cus_'),
    'operator risk input: canonical bundle avoids raw account and customer ids',
  );
  equal(
    cryptoOperatorRiskInputBundleLabel(bundle),
    'crypto-operator-risk-input / status:accepted / inputs:2 / risk:high / disposition:review',
    'operator risk input: label is stable',
  );
}

function testCriticalRiskInputCanRecommendBlockWithoutOracleClaim(): void {
  const bundle = createCryptoOperatorRiskInputBundle({
    generatedAt: '2026-05-11T12:00:00.000Z',
    scopeRef: 'crypto-intelligence-step-07',
    inputs: [
      inputFixture({
        inputId: 'risk-input:counterparty:critical',
        inputClass: 'counterparty-risk',
        riskTier: 'critical',
      }),
    ],
  });

  equal(bundle.status, 'accepted', 'operator risk input: critical evidence can be accepted');
  equal(
    bundle.recommendedDisposition,
    'block',
    'operator risk input: critical operator evidence recommends block',
  );
  equal(
    bundle.modelSafeFeedback.safeInstruction.includes('Attestor-native screening coverage'),
    true,
    'operator risk input: safe instruction preserves non-oracle wording',
  );
}

function testFailClosedCases(): void {
  const stale = createCryptoOperatorRiskInputBundle({
    generatedAt: '2026-05-11T12:00:00.000Z',
    scopeRef: 'crypto-intelligence-step-07',
    inputs: [
      inputFixture({
        freshness: {
          observedAt: '2026-05-10T11:00:00.000Z',
          maxAgeSeconds: 3600,
        },
      }),
    ],
  });
  equal(stale.status, 'stale', 'operator risk input: stale input is fail-closed');
  equal(stale.recommendedDisposition, 'block', 'operator risk input: stale input blocks');
  ok(
    stale.reasonCodes.includes('operator-risk-input-stale'),
    'operator risk input: stale reason is present',
  );

  const missingDigest = createCryptoOperatorRiskInputBundle({
    generatedAt: '2026-05-11T12:00:00.000Z',
    scopeRef: 'crypto-intelligence-step-07',
    inputs: [
      inputFixture({
        evidenceRefs: [
          {
            kind: 'provider-run',
            value: 'provider-run:missing-digest',
          },
        ],
      }),
    ],
  });
  equal(
    missingDigest.status,
    'needs-evidence',
    'operator risk input: missing digest evidence needs evidence',
  );
  ok(
    missingDigest.reasonCodes.includes('operator-risk-input-digest-ref-missing'),
    'operator risk input: missing digest ref reason is present',
  );

  const oracleClaim = createCryptoOperatorRiskInputBundle({
    generatedAt: '2026-05-11T12:00:00.000Z',
    scopeRef: 'crypto-intelligence-step-07',
    inputs: [
      inputFixture({
        claimsAttestorNativeOracle: true,
      }),
    ],
  });
  equal(oracleClaim.status, 'rejected', 'operator risk input: oracle claims are rejected');
  ok(
    oracleClaim.reasonCodes.includes('attestor-native-oracle-claim'),
    'operator risk input: oracle claim reason is present',
  );
}

function testPrivacyAndValidationGuards(): void {
  const unsafe = {
    ...inputFixture(),
    rawTransactionPayload: '0x_raw_payload_must_not_escape',
    customerIdentifier: 'customer_raw_value_must_not_escape',
  } as unknown as CryptoOperatorRiskInput;
  const unsafeBundle = createCryptoOperatorRiskInputBundle({
    generatedAt: '2026-05-11T12:00:00.000Z',
    scopeRef: 'crypto-intelligence-step-07',
    inputs: [unsafe],
  });

  equal(unsafeBundle.status, 'rejected', 'operator risk input: privacy-unsafe input is rejected');
  ok(
    unsafeBundle.reasonCodes.includes('privacy-minimization-failed'),
    'operator risk input: privacy minimization reason is present',
  );
  ok(
    !unsafeBundle.canonical.includes('customer_raw_value_must_not_escape'),
    'operator risk input: rejected bundle canonical excludes raw customer id',
  );

  assert.throws(
    () =>
      createCryptoOperatorRiskInputBundle({
        generatedAt: '2026-05-11T12:00:00.000Z',
        scopeRef: 'crypto-intelligence-step-07',
        inputs: [
          inputFixture({
            source: {
              ...inputFixture().source,
              evidenceDigest: 'sha256:not-a-real-digest',
            },
          }),
        ],
      }),
    /sha256 digest/,
    'operator risk input: malformed digest is rejected',
  );
  passed += 1;
}

function testClassScopeRequirements(): void {
  const routeWithoutRouteDigest = createCryptoOperatorRiskInputBundle({
    generatedAt: '2026-05-11T12:00:00.000Z',
    scopeRef: 'crypto-intelligence-step-07',
    inputs: [
      inputFixture({
        inputClass: 'route-risk',
        riskTier: 'medium',
        scope: {
          scopeKind: 'route',
          consequenceKind: 'bridge',
          chainRef: 'eip155:1',
          counterpartyDigest: digestFor('route:counterparty-only'),
          routeDigest: null,
        },
      }),
    ],
  });

  equal(
    routeWithoutRouteDigest.status,
    'rejected',
    'operator risk input: route input without route digest is rejected',
  );
  ok(
    routeWithoutRouteDigest.reasonCodes.includes('operator-risk-input-scope-missing'),
    'operator risk input: scope missing reason is present',
  );
}

function testEmptyBundleNeedsEvidence(): void {
  const bundle = createCryptoOperatorRiskInputBundle({
    generatedAt: '2026-05-11T12:00:00.000Z',
    scopeRef: 'crypto-intelligence-step-07',
  });

  equal(bundle.status, 'needs-evidence', 'operator risk input: empty bundle needs evidence');
  equal(bundle.inputCount, 0, 'operator risk input: empty bundle has zero inputs');
  ok(
    bundle.reasonCodes.includes('operator-risk-input-missing'),
    'operator risk input: missing input reason is present',
  );
}

testDescriptor();
testAcceptedDigestBoundInputsRemainNonOracular();
testCriticalRiskInputCanRecommendBlockWithoutOracleClaim();
testFailClosedCases();
testPrivacyAndValidationGuards();
testClassScopeRequirements();
testEmptyBundleNeedsEvidence();

console.log(`Crypto authorization core operator risk-input contract tests: ${passed} passed, 0 failed`);
