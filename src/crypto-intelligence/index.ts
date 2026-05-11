import {
  CRYPTO_AUTHORIZATION_CORE_PUBLIC_SUBPATH,
} from '../crypto-authorization-core/index.js';
import * as riskSignals from '../crypto-authorization-core/intelligence-risk-signals.js';
import * as policyGapNarrowing from '../crypto-authorization-core/policy-gap-narrowing.js';
import * as privacyMinimization from '../crypto-authorization-core/intelligence-privacy-minimization.js';
import * as operatorRiskInputs from '../crypto-authorization-core/operator-risk-input-contract.js';
import * as dashboardSummary from '../crypto-authorization-core/intelligence-dashboard-summary.js';
import * as performanceBudget from '../crypto-authorization-core/intelligence-performance-budget.js';
import {
  CRYPTO_EXECUTION_ADMISSION_PUBLIC_SUBPATH,
} from '../crypto-execution-admission/index.js';
import * as adapterReadiness from '../crypto-execution-admission/adapter-readiness-manifest.js';
import * as conformanceFixtures from '../crypto-execution-admission/conformance-fixtures.js';

export * from '../crypto-authorization-core/intelligence-risk-signals.js';
export * from '../crypto-authorization-core/policy-gap-narrowing.js';
export * from '../crypto-authorization-core/intelligence-privacy-minimization.js';
export * from '../crypto-authorization-core/operator-risk-input-contract.js';
export * from '../crypto-authorization-core/intelligence-dashboard-summary.js';
export * from '../crypto-authorization-core/intelligence-performance-budget.js';
export * from '../crypto-execution-admission/adapter-readiness-manifest.js';
export * from '../crypto-execution-admission/conformance-fixtures.js';

export {
  riskSignals,
  policyGapNarrowing,
  privacyMinimization,
  operatorRiskInputs,
  dashboardSummary,
  performanceBudget,
  adapterReadiness,
  conformanceFixtures,
};

/**
 * Curated public package surface for Attestor crypto intelligence.
 *
 * This groups the now-stable intelligence layer without reopening the frozen
 * crypto authorization or crypto execution-admission package contracts.
 */

export const CRYPTO_INTELLIGENCE_PLATFORM_SURFACE_SPEC_VERSION =
  'attestor.crypto-intelligence-platform.v1';
export const CRYPTO_INTELLIGENCE_PACKAGE_NAME = 'attestor';
export const CRYPTO_INTELLIGENCE_PUBLIC_SUBPATH = 'attestor/crypto-intelligence';

export const CRYPTO_INTELLIGENCE_NAMESPACE_EXPORTS = Object.freeze([
  'riskSignals',
  'policyGapNarrowing',
  'adapterReadiness',
  'conformanceFixtures',
  'privacyMinimization',
  'operatorRiskInputs',
  'dashboardSummary',
  'performanceBudget',
] as const);
export type CryptoIntelligenceNamespaceExport =
  typeof CRYPTO_INTELLIGENCE_NAMESPACE_EXPORTS[number];

export const CRYPTO_INTELLIGENCE_DECISION_SUPPORT_NAMESPACES = Object.freeze([
  'riskSignals',
  'policyGapNarrowing',
  'operatorRiskInputs',
  'dashboardSummary',
] as const);

export const CRYPTO_INTELLIGENCE_PROOF_AND_SAFETY_NAMESPACES = Object.freeze([
  'adapterReadiness',
  'conformanceFixtures',
  'privacyMinimization',
  'performanceBudget',
] as const);

export const CRYPTO_INTELLIGENCE_SOURCE_SUBPATHS = Object.freeze({
  cryptoAuthorizationCore: CRYPTO_AUTHORIZATION_CORE_PUBLIC_SUBPATH,
  cryptoExecutionAdmission: CRYPTO_EXECUTION_ADMISSION_PUBLIC_SUBPATH,
} as const);

export const CRYPTO_INTELLIGENCE_PRIVACY_GUARDRAILS = Object.freeze([
  'digest-and-scoped-ref-only',
  'no-raw-wallet-metadata',
  'no-raw-transaction-payload',
  'no-customer-identifier',
  'no-custody-callback-body',
  'no-provider-error-body',
  'no-private-policy-threshold',
  'no-solver-route-secret',
  'no-native-screening-oracle-claim',
] as const);

export type CryptoIntelligenceExtractionStatus = 'ready' | 'pending';

export interface CryptoIntelligenceExtractionCriterion {
  readonly id: string;
  readonly status: CryptoIntelligenceExtractionStatus;
  readonly description: string;
}

export interface CryptoIntelligencePublicSurfaceDescriptor {
  readonly version: typeof CRYPTO_INTELLIGENCE_PLATFORM_SURFACE_SPEC_VERSION;
  readonly packageName: typeof CRYPTO_INTELLIGENCE_PACKAGE_NAME;
  readonly subpath: typeof CRYPTO_INTELLIGENCE_PUBLIC_SUBPATH;
  readonly sourceSubpaths: typeof CRYPTO_INTELLIGENCE_SOURCE_SUBPATHS;
  readonly namespaceExports: typeof CRYPTO_INTELLIGENCE_NAMESPACE_EXPORTS;
  readonly decisionSupportNamespaces: typeof CRYPTO_INTELLIGENCE_DECISION_SUPPORT_NAMESPACES;
  readonly proofAndSafetyNamespaces: typeof CRYPTO_INTELLIGENCE_PROOF_AND_SAFETY_NAMESPACES;
  readonly privacyGuardrails: typeof CRYPTO_INTELLIGENCE_PRIVACY_GUARDRAILS;
  readonly policyIntelligenceRoutingVersion:
    typeof policyGapNarrowing.CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION;
  readonly adapterReadinessMatrixEntryCount: number;
  readonly adapterReadinessIntelligenceVersion:
    typeof adapterReadiness.CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION;
  readonly negativeFixtureCount: number;
  readonly hostedRouteClaimed: false;
  readonly attestorNativeOracleClaimed: false;
  readonly extractionCriteria: typeof CRYPTO_INTELLIGENCE_EXTRACTION_CRITERIA;
}

export const CRYPTO_INTELLIGENCE_EXTRACTION_CRITERIA = Object.freeze([
  Object.freeze({
    id: 'stable-risk-readiness-gap-contract',
    status: 'ready',
    description:
      'Risk signals, policy gaps, policy-intelligence routing, safe narrowing candidates, and adapter readiness manifests are stable enough to consume from one package surface.',
  }),
  Object.freeze({
    id: 'privacy-and-model-feedback-boundary-proven',
    status: 'ready',
    description:
      'Crypto intelligence exports only reason codes, scoped references, aggregate counts, and digests; raw wallet, payment, custody, provider, customer, and policy-threshold material remains outside the surface.',
  }),
  Object.freeze({
    id: 'negative-conformance-and-performance-proven',
    status: 'ready',
    description:
      'Malformed, stale, malicious, contradictory, privacy-unsafe, and budget-exceeding intelligence paths have deterministic fail-closed fixtures or aggregate performance checks.',
  }),
  Object.freeze({
    id: 'package-boundary-proven',
    status: 'ready',
    description:
      'The crypto intelligence layer is exported through one stable package subpath with package-boundary probes that reject internal deep imports.',
  }),
  Object.freeze({
    id: 'justify-standalone-crypto-intelligence-service',
    status: 'pending',
    description:
      'A standalone deployable crypto intelligence service should wait until customer-operated latency, custody-isolation, or independent operational-scaling requirements justify a separate runtime boundary.',
  }),
] satisfies readonly CryptoIntelligenceExtractionCriterion[]);

export const cryptoIntelligence = Object.freeze({
  riskSignals,
  policyGapNarrowing,
  adapterReadiness,
  conformanceFixtures,
  privacyMinimization,
  operatorRiskInputs,
  dashboardSummary,
  performanceBudget,
});

export type CryptoIntelligence = typeof cryptoIntelligence;
export type CryptoIntelligenceRiskSignalAssessment =
  riskSignals.CryptoIntelligenceRiskSignalAssessment;
export type CryptoPolicyGapNarrowingAssessment =
  policyGapNarrowing.CryptoPolicyGapNarrowingAssessment;
export type CryptoPolicyIntelligenceRoutingProfile =
  policyGapNarrowing.CryptoPolicyIntelligenceRoutingProfile;
export type CryptoAdapterReadinessManifest =
  adapterReadiness.CryptoAdapterReadinessManifest;
export type CryptoAdapterReadinessIntelligenceProfile =
  adapterReadiness.CryptoAdapterReadinessIntelligenceProfile;
export type CryptoAdmissionConformanceFixtureSuite =
  conformanceFixtures.CryptoAdmissionConformanceFixtureSuite;
export type CryptoIntelligencePrivacyMinimizationEvaluation =
  privacyMinimization.CryptoIntelligencePrivacyMinimizationEvaluation;
export type CryptoOperatorRiskInputBundle =
  operatorRiskInputs.CryptoOperatorRiskInputBundle;
export type CryptoIntelligenceDashboardSummary =
  dashboardSummary.CryptoIntelligenceDashboardSummary;
export type CryptoIntelligencePerformanceBenchmark =
  performanceBudget.CryptoIntelligencePerformanceBenchmark;

export function cryptoIntelligencePublicSurface():
CryptoIntelligencePublicSurfaceDescriptor {
  return Object.freeze({
    version: CRYPTO_INTELLIGENCE_PLATFORM_SURFACE_SPEC_VERSION,
    packageName: CRYPTO_INTELLIGENCE_PACKAGE_NAME,
    subpath: CRYPTO_INTELLIGENCE_PUBLIC_SUBPATH,
    sourceSubpaths: CRYPTO_INTELLIGENCE_SOURCE_SUBPATHS,
    namespaceExports: CRYPTO_INTELLIGENCE_NAMESPACE_EXPORTS,
    decisionSupportNamespaces: CRYPTO_INTELLIGENCE_DECISION_SUPPORT_NAMESPACES,
    proofAndSafetyNamespaces: CRYPTO_INTELLIGENCE_PROOF_AND_SAFETY_NAMESPACES,
    privacyGuardrails: CRYPTO_INTELLIGENCE_PRIVACY_GUARDRAILS,
    policyIntelligenceRoutingVersion:
      policyGapNarrowing.CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    adapterReadinessMatrixEntryCount:
      Object.keys(adapterReadiness.CRYPTO_ADAPTER_READINESS_MATRIX).length,
    adapterReadinessIntelligenceVersion:
      adapterReadiness.CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION,
    negativeFixtureCount:
      conformanceFixtures.CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_FIXTURES.length,
    hostedRouteClaimed: false,
    attestorNativeOracleClaimed: false,
    extractionCriteria: CRYPTO_INTELLIGENCE_EXTRACTION_CRITERIA,
  });
}
