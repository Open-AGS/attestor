import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cryptoIntelligence = await import('attestor/crypto-intelligence');
const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

async function importIsBlocked(specifier) {
  try {
    await import(specifier);
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('Package subpath') ||
      message.includes('ERR_PACKAGE_PATH_NOT_EXPORTED')
    );
  }
}

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
  cryptoIntelligence.cryptoIntelligence.privacyMinimization
    .cryptoIntelligencePrivacyMinimizationDescriptor()
    .forbiddenRawClasses.includes('raw-route-details'),
  true,
);
assert.equal(
  cryptoIntelligence.cryptoIntelligence.privacyMinimization
    .evaluateCryptoIntelligencePrivacyMinimizationArtifact({
      surfaceKind: 'intelligence-proof-packet',
      artifact: {
        prompt: 'raw model prompt must not cross the crypto intelligence boundary',
      },
    })
    .reasonCodes.includes('raw-model-prompt-field'),
  true,
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

assert.equal(
  cryptoIntelligence.cryptoIntelligence.packageSurfaceConsistency
    .cryptoPackageSurfaceConsistencyDescriptor()
    .failClosedOnDrift,
  true,
);

const blockedDeepImportProbes = [];
for (const probe of cryptoIntelligence
  .CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES) {
  if (await importIsBlocked(probe.specifier)) {
    blockedDeepImportProbes.push(probe.specifier);
  }
}

const consistencyProfile =
  cryptoIntelligence.createCryptoPackageSurfaceConsistencyProfile({
    generatedAt: '2026-05-11T12:00:00.000Z',
    packagePrivate: packageJson.private,
    exportMap: packageJson.exports,
    blockedDeepImportProbes,
  });
assert.equal(
  consistencyProfile.status,
  'pass',
  'crypto package surfaces should match package exports, descriptors, and deep-import probes',
);
assert.equal(consistencyProfile.summary.surfaceCount, 4);
assert.equal(consistencyProfile.summary.matchedExportCount, 4);
assert.equal(consistencyProfile.summary.matchedDescriptorCount, 4);
assert.equal(consistencyProfile.summary.blockedDeepImportCount, 4);
assert.deepEqual(
  consistencyProfile.reasonCodes,
  ['package-surface-consistency-pass'],
);

console.log('crypto-intelligence package surface probe passed');
