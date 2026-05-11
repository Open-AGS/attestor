import assert from 'node:assert/strict';

const cryptoIntelligence = await import('attestor/crypto-intelligence');

assert.equal(
  cryptoIntelligence.CRYPTO_INTELLIGENCE_PLATFORM_SURFACE_SPEC_VERSION,
  'attestor.crypto-intelligence-platform.v1',
);
assert.equal(
  cryptoIntelligence.CRYPTO_INTELLIGENCE_PUBLIC_SUBPATH,
  'attestor/crypto-intelligence',
);
assert.equal(
  cryptoIntelligence.cryptoIntelligencePublicSurface().subpath,
  'attestor/crypto-intelligence',
);
assert.equal(
  cryptoIntelligence.cryptoIntelligencePublicSurface().hostedRouteClaimed,
  false,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligencePublicSurface().attestorNativeOracleClaimed,
  false,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.riskSignals
    .cryptoIntelligenceRiskSignalsDescriptor()
    .version,
  'attestor.crypto-intelligence-risk-signals.v1',
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.policyGapNarrowing
    .cryptoPolicyGapNarrowingDescriptor()
    .candidateKinds.includes('run-adapter-preflight'),
  true,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.policyGapNarrowing
    .cryptoPolicyGapNarrowingDescriptor()
    .policyCoverageStatuses.includes('explicit-deny'),
  true,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.policyGapNarrowing
    .cryptoPolicyIntelligenceRoutingDescriptor()
    .version,
  'attestor.crypto-policy-intelligence-routing.v1',
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.policyGapNarrowing
    .createCryptoPolicyCoverageProfile({
      generatedAt: '2026-05-11T12:00:00.000Z',
      entries: [
        {
          dimension: 'counterparty',
          status: 'explicit-deny',
          sourceKind: 'policy-rule',
          sourceRef: 'policy-rule:package-probe',
        },
      ],
    })
    .recommendedDisposition,
  'block',
);
const coverageProfile =
  cryptoIntelligence.cryptoIntelligence.policyGapNarrowing
    .createCryptoPolicyCoverageProfile({
      generatedAt: '2026-05-11T12:00:00.000Z',
      entries: [
        {
          dimension: 'protocol',
          status: 'explicit-deny',
          sourceKind: 'policy-rule',
          sourceRef: 'policy-rule:package-routing',
        },
      ],
    });
assert.equal(
  cryptoIntelligence.cryptoIntelligence.policyGapNarrowing
    .createCryptoPolicyIntelligenceRoutingProfile({
      coverageProfile,
    })
    .dominantRouteKind,
  'block-explicit-deny',
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.adapterReadiness
    .cryptoAdapterReadinessManifestDescriptor()
    .matrixEntryCount,
  11,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.adapterReadiness
    .cryptoAdapterReadinessIntelligenceDescriptor()
    .version,
  'attestor.crypto-adapter-readiness-intelligence.v1',
);
const readinessManifest =
  cryptoIntelligence.cryptoIntelligence.adapterReadiness
    .createCryptoAdapterReadinessManifest({
      generatedAt: '2026-05-11T12:00:00.000Z',
      scopeRef: 'package-surface:adapter-readiness-intelligence',
    });
assert.equal(
  cryptoIntelligence.cryptoIntelligence.adapterReadiness
    .createCryptoAdapterReadinessIntelligenceProfile({
      manifest: readinessManifest,
    })
    .summary.evidenceRequiredCount,
  11,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.conformanceFixtures
    .validateCryptoAdmissionNegativeConformanceFixtures()
    .status,
  'valid',
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.privacyMinimization
    .cryptoIntelligencePrivacyMinimizationDescriptor()
    .rawPayloadStored,
  false,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.operatorRiskInputs
    .cryptoOperatorRiskInputContractDescriptor()
    .attestorNativeOracleClaim,
  false,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.dashboardSummary
    .cryptoIntelligenceDashboardSummaryDescriptor()
    .decisionSupportOnly,
  true,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.dashboardSummary
    .cryptoIntelligenceDashboardSummaryDescriptor()
    .topBlockersAvailable,
  true,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.dashboardSummary
    .cryptoIntelligenceDashboardSummaryDescriptor()
    .proofLinkKinds.includes('policy-intelligence-routing'),
  true,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.performanceBudget
    .cryptoIntelligencePerformanceBudgetDescriptor()
    .failClosedOnBudgetExceeded,
  true,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.performanceBudget
    .cryptoIntelligencePerformanceBudgetDescriptor()
    .failClosedOnRegression,
  true,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.performanceBudget
    .cryptoIntelligencePerformanceBudgetDescriptor()
    .rawPayloadCacheAllowed,
  false,
);

let blockedInternalPath = false;
try {
  await import('attestor/crypto-intelligence/index.js');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  blockedInternalPath =
    message.includes('Package subpath') ||
    message.includes('ERR_PACKAGE_PATH_NOT_EXPORTED');
}

assert.equal(
  blockedInternalPath,
  true,
  'internal crypto intelligence module paths should stay outside the public package surface',
);

console.log('crypto-intelligence package surface probe passed');
