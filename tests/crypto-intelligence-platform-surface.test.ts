import assert from 'node:assert/strict';
import {
  CRYPTO_INTELLIGENCE_EXTRACTION_CRITERIA,
  CRYPTO_INTELLIGENCE_NAMESPACE_EXPORTS,
  CRYPTO_INTELLIGENCE_PLATFORM_SURFACE_SPEC_VERSION,
  CRYPTO_INTELLIGENCE_PUBLIC_SUBPATH,
  CRYPTO_INTELLIGENCE_SOURCE_SUBPATHS,
  cryptoIntelligence,
  cryptoIntelligencePublicSurface,
} from '../src/crypto-intelligence/index.js';

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

function testCryptoIntelligencePublicSurfaceDescriptor(): void {
  const descriptor = cryptoIntelligencePublicSurface();

  equal(
    descriptor.version,
    CRYPTO_INTELLIGENCE_PLATFORM_SURFACE_SPEC_VERSION,
    'crypto intelligence platform surface: descriptor exposes version',
  );
  equal(
    descriptor.packageName,
    'attestor',
    'crypto intelligence platform surface: descriptor exposes package name',
  );
  equal(
    descriptor.subpath,
    CRYPTO_INTELLIGENCE_PUBLIC_SUBPATH,
    'crypto intelligence platform surface: descriptor exposes package subpath',
  );
  deepEqual(
    descriptor.sourceSubpaths,
    CRYPTO_INTELLIGENCE_SOURCE_SUBPATHS,
    'crypto intelligence platform surface: descriptor exposes source subpaths',
  );
  deepEqual(
    descriptor.namespaceExports,
    CRYPTO_INTELLIGENCE_NAMESPACE_EXPORTS,
    'crypto intelligence platform surface: descriptor exposes curated namespace list',
  );
  deepEqual(
    descriptor.decisionSupportNamespaces,
    [
      'riskSignals',
      'policyGapNarrowing',
      'operatorRiskInputs',
      'dashboardSummary',
    ],
    'crypto intelligence platform surface: descriptor groups decision-support namespaces',
  );
  deepEqual(
    descriptor.proofAndSafetyNamespaces,
    [
      'adapterReadiness',
      'conformanceFixtures',
      'privacyMinimization',
      'performanceBudget',
    ],
    'crypto intelligence platform surface: descriptor groups proof and safety namespaces',
  );
  equal(
    descriptor.hostedRouteClaimed,
    false,
    'crypto intelligence platform surface: no hosted route is claimed',
  );
  equal(
    descriptor.attestorNativeOracleClaimed,
    false,
    'crypto intelligence platform surface: no native oracle role is claimed',
  );
  equal(
    descriptor.adapterReadinessMatrixEntryCount,
    11,
    'crypto intelligence platform surface: adapter readiness matrix is packaged',
  );
  equal(
    descriptor.adapterReadinessIntelligenceVersion,
    'attestor.crypto-adapter-readiness-intelligence.v1',
    'crypto intelligence platform surface: adapter readiness intelligence profile is packaged',
  );
  equal(
    descriptor.policyIntelligenceRoutingVersion,
    'attestor.crypto-policy-intelligence-routing.v1',
    'crypto intelligence platform surface: policy intelligence routing profile is packaged',
  );
  equal(
    descriptor.negativeFixtureCount,
    40,
    'crypto intelligence platform surface: negative conformance fixtures are packaged',
  );
  equal(
    CRYPTO_INTELLIGENCE_EXTRACTION_CRITERIA.length,
    5,
    'crypto intelligence platform surface: extraction criteria are enumerated',
  );
  equal(
    CRYPTO_INTELLIGENCE_EXTRACTION_CRITERIA.filter(
      (criterion) => criterion.status === 'ready',
    ).length,
    4,
    'crypto intelligence platform surface: four extraction criteria are ready',
  );
  ok(
    descriptor.extractionCriteria.some((criterion) => criterion.status === 'pending'),
    'crypto intelligence platform surface: standalone service extraction remains pending',
  );
}

function testCryptoIntelligenceNamespaceBindings(): void {
  equal(
    cryptoIntelligence.riskSignals.cryptoIntelligenceRiskSignalsDescriptor().version,
    'attestor.crypto-intelligence-risk-signals.v1',
    'crypto intelligence platform surface: risk signal namespace is bound',
  );
  ok(
    cryptoIntelligence.riskSignals
      .cryptoIntelligenceRiskSignalsDescriptor()
      .categories.includes('delegation'),
    'crypto intelligence platform surface: risk signals include delegated execution',
  );
  equal(
    cryptoIntelligence.policyGapNarrowing.cryptoPolicyGapNarrowingDescriptor().version,
    'attestor.crypto-policy-gap-narrowing.v1',
    'crypto intelligence platform surface: policy gap namespace is bound',
  );
  ok(
    cryptoIntelligence.policyGapNarrowing
      .cryptoPolicyGapNarrowingDescriptor()
      .candidateKinds.includes('bind-route-commitment'),
    'crypto intelligence platform surface: policy gap narrowing exposes route narrowing',
  );
  ok(
    cryptoIntelligence.policyGapNarrowing
      .cryptoPolicyGapNarrowingDescriptor()
      .policyCoverageStatuses.includes('explicit-deny'),
    'crypto intelligence platform surface: policy gap narrowing exposes explicit deny coverage',
  );
  ok(
    cryptoIntelligence.policyGapNarrowing
      .cryptoPolicyGapNarrowingDescriptor()
      .policyIntelligenceRouteKinds.includes('block-policy-conflict'),
    'crypto intelligence platform surface: policy gap narrowing exposes policy intelligence routes',
  );
  equal(
    cryptoIntelligence.policyGapNarrowing
      .cryptoPolicyIntelligenceRoutingDescriptor()
      .version,
    'attestor.crypto-policy-intelligence-routing.v1',
    'crypto intelligence platform surface: policy intelligence routing descriptor is bound',
  );
  equal(
    cryptoIntelligence.adapterReadiness.cryptoAdapterReadinessManifestDescriptor().version,
    'attestor.crypto-adapter-readiness-manifest.v1',
    'crypto intelligence platform surface: adapter readiness namespace is bound',
  );
  ok(
    cryptoIntelligence.adapterReadiness
      .cryptoAdapterReadinessIntelligenceDescriptor()
      .postures.includes('review-required'),
    'crypto intelligence platform surface: adapter readiness intelligence descriptor is bound',
  );
  equal(
    cryptoIntelligence.conformanceFixtures
      .validateCryptoAdmissionNegativeConformanceFixtures()
      .status,
    'valid',
    'crypto intelligence platform surface: negative conformance fixtures validate',
  );
}

function testCryptoIntelligenceSafetyNamespaces(): void {
  equal(
    cryptoIntelligence.privacyMinimization
      .cryptoIntelligencePrivacyMinimizationDescriptor()
      .rawPayloadStored,
    false,
    'crypto intelligence platform surface: privacy minimization remains digest-first',
  );
  ok(
    cryptoIntelligence.privacyMinimization
      .cryptoIntelligencePrivacyMinimizationDescriptor()
      .surfaceKinds.includes('intelligence-performance-benchmark'),
    'crypto intelligence platform surface: privacy gate covers performance benchmarks',
  );
  ok(
    cryptoIntelligence.privacyMinimization
      .cryptoIntelligencePrivacyMinimizationDescriptor()
      .surfaceKinds.includes('policy-intelligence-routing-profile'),
    'crypto intelligence platform surface: privacy gate covers policy intelligence routing',
  );
  equal(
    cryptoIntelligence.operatorRiskInputs
      .cryptoOperatorRiskInputContractDescriptor()
      .attestorNativeOracleClaim,
    false,
    'crypto intelligence platform surface: operator risk inputs stay non-oracular',
  );
  equal(
    cryptoIntelligence.dashboardSummary
      .cryptoIntelligenceDashboardSummaryDescriptor()
      .rawPayloadDrilldownEnabled,
    false,
    'crypto intelligence platform surface: dashboard summary blocks raw payload drilldown',
  );
  equal(
    cryptoIntelligence.dashboardSummary
      .cryptoIntelligenceDashboardSummaryDescriptor()
      .topBlockersAvailable,
    true,
    'crypto intelligence platform surface: dashboard summary exposes top blockers',
  );
  ok(
    cryptoIntelligence.dashboardSummary
      .cryptoIntelligenceDashboardSummaryDescriptor()
      .proofLinkKinds.includes('policy-intelligence-routing'),
    'crypto intelligence platform surface: dashboard summary links policy routing proofs',
  );
  equal(
    cryptoIntelligence.performanceBudget
      .cryptoIntelligencePerformanceBudgetDescriptor()
      .failClosedOnBudgetExceeded,
    true,
    'crypto intelligence platform surface: performance budget fails closed',
  );
}

testCryptoIntelligencePublicSurfaceDescriptor();
testCryptoIntelligenceNamespaceBindings();
testCryptoIntelligenceSafetyNamespaces();

console.log(`Crypto intelligence platform surface tests: ${passed} passed, 0 failed`);
