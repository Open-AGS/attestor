import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CRYPTO_AUTHORIZATION_CORE_PLATFORM_SURFACE_SPEC_VERSION,
  CRYPTO_AUTHORIZATION_CORE_PUBLIC_SUBPATH,
  cryptoAuthorizationCorePublicSurface,
} from '../crypto-authorization-core/index.js';
import * as riskSignals from '../crypto-authorization-core/intelligence-risk-signals.js';
import * as policyGapNarrowing from '../crypto-authorization-core/policy-gap-narrowing.js';
import * as privacyMinimization from '../crypto-authorization-core/intelligence-privacy-minimization.js';
import * as operatorRiskInputs from '../crypto-authorization-core/operator-risk-input-contract.js';
import * as dashboardSummary from '../crypto-authorization-core/intelligence-dashboard-summary.js';
import * as performanceBudget from '../crypto-authorization-core/intelligence-performance-budget.js';
import {
  CRYPTO_EXECUTION_ADMISSION_PLATFORM_SURFACE_SPEC_VERSION,
  CRYPTO_EXECUTION_ADMISSION_PUBLIC_SUBPATH,
  cryptoExecutionAdmissionPublicSurface,
} from '../crypto-execution-admission/index.js';
import * as adapterReadiness from '../crypto-execution-admission/adapter-readiness-manifest.js';
import * as conformanceFixtures from '../crypto-execution-admission/conformance-fixtures.js';
import {
  CONSEQUENCE_ADMISSION_FACADE_SPEC_VERSION,
  CONSEQUENCE_ADMISSION_PUBLIC_SUBPATH,
  consequenceAdmissionFacadeDescriptor,
} from '../consequence-admission/facade.js';

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
  'packageSurfaceConsistency',
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
  'packageSurfaceConsistency',
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

export const CRYPTO_PACKAGE_SURFACE_CONSISTENCY_SPEC_VERSION =
  'attestor.crypto-package-surface-consistency.v1';

export type CryptoPackageSurfaceConsistencySurfaceId =
  | 'consequence-admission'
  | 'crypto-authorization-core'
  | 'crypto-execution-admission'
  | 'crypto-intelligence';

export const CRYPTO_PACKAGE_SURFACE_CONSISTENCY_REASON_CODES = Object.freeze([
  'package-surface-consistency-pass',
  'private-package-boundary-required',
  'package-export-map-entry-missing',
  'package-export-target-mismatch',
  'surface-descriptor-subpath-mismatch',
  'surface-descriptor-version-mismatch',
  'deep-import-probe-unblocked',
] as const);
export type CryptoPackageSurfaceConsistencyReasonCode =
  typeof CRYPTO_PACKAGE_SURFACE_CONSISTENCY_REASON_CODES[number];

export const CRYPTO_PACKAGE_SURFACE_CONSISTENCY_EXPECTED_EXPORTS =
  Object.freeze([
    Object.freeze({
      surfaceId: 'consequence-admission',
      publicSubpath: CONSEQUENCE_ADMISSION_PUBLIC_SUBPATH,
      packageExport: './consequence-admission',
      types: './dist/consequence-admission/index.d.ts',
      default: './dist/consequence-admission/index.js',
      descriptorVersion: CONSEQUENCE_ADMISSION_FACADE_SPEC_VERSION,
    }),
    Object.freeze({
      surfaceId: 'crypto-authorization-core',
      publicSubpath: CRYPTO_AUTHORIZATION_CORE_PUBLIC_SUBPATH,
      packageExport: './crypto-authorization-core',
      types: './dist/crypto-authorization-core/index.d.ts',
      default: './dist/crypto-authorization-core/index.js',
      descriptorVersion: CRYPTO_AUTHORIZATION_CORE_PLATFORM_SURFACE_SPEC_VERSION,
    }),
    Object.freeze({
      surfaceId: 'crypto-execution-admission',
      publicSubpath: CRYPTO_EXECUTION_ADMISSION_PUBLIC_SUBPATH,
      packageExport: './crypto-execution-admission',
      types: './dist/crypto-execution-admission/index.d.ts',
      default: './dist/crypto-execution-admission/index.js',
      descriptorVersion: CRYPTO_EXECUTION_ADMISSION_PLATFORM_SURFACE_SPEC_VERSION,
    }),
    Object.freeze({
      surfaceId: 'crypto-intelligence',
      publicSubpath: CRYPTO_INTELLIGENCE_PUBLIC_SUBPATH,
      packageExport: './crypto-intelligence',
      types: './dist/crypto-intelligence/index.d.ts',
      default: './dist/crypto-intelligence/index.js',
      descriptorVersion: CRYPTO_INTELLIGENCE_PLATFORM_SURFACE_SPEC_VERSION,
    }),
  ] as const);

export const CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES =
  Object.freeze([
    Object.freeze({
      surfaceId: 'consequence-admission',
      specifier: 'attestor/consequence-admission/facade.js',
    }),
    Object.freeze({
      surfaceId: 'crypto-authorization-core',
      specifier: 'attestor/crypto-authorization-core/types.js',
    }),
    Object.freeze({
      surfaceId: 'crypto-execution-admission',
      specifier: 'attestor/crypto-execution-admission/index.js',
    }),
    Object.freeze({
      surfaceId: 'crypto-intelligence',
      specifier: 'attestor/crypto-intelligence/index.js',
    }),
  ] as const);

export type CryptoPackageSurfaceConsistencyStatus = 'pass' | 'fail';
export type CryptoPackageSurfaceConsistencyCheckStatus =
  | 'matched'
  | 'missing'
  | 'mismatch'
  | 'blocked'
  | 'unblocked';

export interface CryptoPackageSurfaceObservedExportMapEntry {
  readonly types?: string;
  readonly default?: string;
}

export interface CryptoPackageSurfaceConsistencyDescriptor {
  readonly version: typeof CRYPTO_PACKAGE_SURFACE_CONSISTENCY_SPEC_VERSION;
  readonly packageName: typeof CRYPTO_INTELLIGENCE_PACKAGE_NAME;
  readonly privatePackageRequired: true;
  readonly publicNpmPublicationClaimed: false;
  readonly failClosedOnDrift: true;
  readonly expectedExports: typeof CRYPTO_PACKAGE_SURFACE_CONSISTENCY_EXPECTED_EXPORTS;
  readonly deepImportProbes: typeof CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES;
  readonly reasonCodes: typeof CRYPTO_PACKAGE_SURFACE_CONSISTENCY_REASON_CODES;
}

export interface CryptoPackageSurfaceConsistencyEntry {
  readonly surfaceId: CryptoPackageSurfaceConsistencySurfaceId;
  readonly publicSubpath: string;
  readonly packageExport: string;
  readonly expectedTypes: string;
  readonly expectedDefault: string;
  readonly observedTypes: string | null;
  readonly observedDefault: string | null;
  readonly expectedDescriptorVersion: string;
  readonly observedDescriptorVersion: string;
  readonly observedDescriptorSubpath: string;
  readonly deepImportProbe: string;
  readonly exportMapStatus: CryptoPackageSurfaceConsistencyCheckStatus;
  readonly descriptorStatus: CryptoPackageSurfaceConsistencyCheckStatus;
  readonly deepImportStatus: CryptoPackageSurfaceConsistencyCheckStatus;
  readonly reasonCodes: readonly CryptoPackageSurfaceConsistencyReasonCode[];
}

export interface CryptoPackageSurfaceConsistencyProfile {
  readonly version: typeof CRYPTO_PACKAGE_SURFACE_CONSISTENCY_SPEC_VERSION;
  readonly generatedAt: string;
  readonly packageName: typeof CRYPTO_INTELLIGENCE_PACKAGE_NAME;
  readonly status: CryptoPackageSurfaceConsistencyStatus;
  readonly failClosedOnDrift: true;
  readonly privatePackageRequired: true;
  readonly packagePrivate: boolean;
  readonly publicNpmPublicationClaimed: false;
  readonly entries: readonly CryptoPackageSurfaceConsistencyEntry[];
  readonly summary: {
    readonly surfaceCount: number;
    readonly matchedExportCount: number;
    readonly matchedDescriptorCount: number;
    readonly blockedDeepImportCount: number;
  };
  readonly reasonCodes: readonly CryptoPackageSurfaceConsistencyReasonCode[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateCryptoPackageSurfaceConsistencyProfileInput {
  readonly generatedAt?: string | null;
  readonly packagePrivate: boolean;
  readonly exportMap:
    Readonly<Record<string, CryptoPackageSurfaceObservedExportMapEntry>>;
  readonly blockedDeepImportProbes: readonly string[];
}

function canonicalPackageSurfaceObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);

  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function uniqueSortedReasonCodes(
  reasonCodes: readonly CryptoPackageSurfaceConsistencyReasonCode[],
): readonly CryptoPackageSurfaceConsistencyReasonCode[] {
  return Object.freeze([...new Set(reasonCodes)].sort());
}

function descriptorSnapshotFor(
  surfaceId: CryptoPackageSurfaceConsistencySurfaceId,
): {
  readonly version: string;
  readonly subpath: string;
} {
  if (surfaceId === 'consequence-admission') {
    const descriptor = consequenceAdmissionFacadeDescriptor();

    return Object.freeze({
      version: descriptor.version,
      subpath: descriptor.publicSubpath,
    });
  }

  if (surfaceId === 'crypto-authorization-core') {
    const descriptor = cryptoAuthorizationCorePublicSurface();

    return Object.freeze({
      version: descriptor.version,
      subpath: descriptor.subpath,
    });
  }

  if (surfaceId === 'crypto-execution-admission') {
    const descriptor = cryptoExecutionAdmissionPublicSurface();

    return Object.freeze({
      version: descriptor.version,
      subpath: descriptor.subpath,
    });
  }

  const descriptor = cryptoIntelligencePublicSurface();

  return Object.freeze({
    version: descriptor.version,
    subpath: descriptor.subpath,
  });
}

function deepImportProbeFor(
  surfaceId: CryptoPackageSurfaceConsistencySurfaceId,
): string {
  return CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES.find(
    (probe) => probe.surfaceId === surfaceId,
  )!.specifier;
}

function packageSurfaceConsistencyEntry(input: {
  readonly expected:
    typeof CRYPTO_PACKAGE_SURFACE_CONSISTENCY_EXPECTED_EXPORTS[number];
  readonly exportMap:
    Readonly<Record<string, CryptoPackageSurfaceObservedExportMapEntry>>;
  readonly blockedDeepImportProbes: readonly string[];
}): CryptoPackageSurfaceConsistencyEntry {
  const observed = input.exportMap[input.expected.packageExport] ?? null;
  const descriptor = descriptorSnapshotFor(input.expected.surfaceId);
  const deepImportProbe = deepImportProbeFor(input.expected.surfaceId);
  const reasonCodes: CryptoPackageSurfaceConsistencyReasonCode[] = [];

  const exportMapStatus = observed === null
    ? 'missing'
    : observed.types === input.expected.types &&
        observed.default === input.expected.default
      ? 'matched'
      : 'mismatch';
  const descriptorStatus =
    descriptor.subpath === input.expected.publicSubpath &&
    descriptor.version === input.expected.descriptorVersion
      ? 'matched'
      : 'mismatch';
  const deepImportStatus = input.blockedDeepImportProbes.includes(deepImportProbe)
    ? 'blocked'
    : 'unblocked';

  if (exportMapStatus === 'missing') {
    reasonCodes.push('package-export-map-entry-missing');
  }
  if (exportMapStatus === 'mismatch') {
    reasonCodes.push('package-export-target-mismatch');
  }
  if (descriptor.subpath !== input.expected.publicSubpath) {
    reasonCodes.push('surface-descriptor-subpath-mismatch');
  }
  if (descriptor.version !== input.expected.descriptorVersion) {
    reasonCodes.push('surface-descriptor-version-mismatch');
  }
  if (deepImportStatus === 'unblocked') {
    reasonCodes.push('deep-import-probe-unblocked');
  }

  return Object.freeze({
    surfaceId: input.expected.surfaceId,
    publicSubpath: input.expected.publicSubpath,
    packageExport: input.expected.packageExport,
    expectedTypes: input.expected.types,
    expectedDefault: input.expected.default,
    observedTypes: observed?.types ?? null,
    observedDefault: observed?.default ?? null,
    expectedDescriptorVersion: input.expected.descriptorVersion,
    observedDescriptorVersion: descriptor.version,
    observedDescriptorSubpath: descriptor.subpath,
    deepImportProbe,
    exportMapStatus,
    descriptorStatus,
    deepImportStatus,
    reasonCodes: uniqueSortedReasonCodes(reasonCodes),
  });
}

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
  readonly packageSurfaceConsistencyVersion:
    typeof CRYPTO_PACKAGE_SURFACE_CONSISTENCY_SPEC_VERSION;
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
  packageSurfaceConsistency: Object.freeze({
    CRYPTO_PACKAGE_SURFACE_CONSISTENCY_SPEC_VERSION,
    CRYPTO_PACKAGE_SURFACE_CONSISTENCY_REASON_CODES,
    CRYPTO_PACKAGE_SURFACE_CONSISTENCY_EXPECTED_EXPORTS,
    CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES,
    cryptoPackageSurfaceConsistencyDescriptor,
    createCryptoPackageSurfaceConsistencyProfile,
  }),
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
export type CryptoIntelligencePerformanceEfficiencyProfile =
  performanceBudget.CryptoIntelligencePerformanceEfficiencyProfile;

export function cryptoPackageSurfaceConsistencyDescriptor():
CryptoPackageSurfaceConsistencyDescriptor {
  return Object.freeze({
    version: CRYPTO_PACKAGE_SURFACE_CONSISTENCY_SPEC_VERSION,
    packageName: CRYPTO_INTELLIGENCE_PACKAGE_NAME,
    privatePackageRequired: true,
    publicNpmPublicationClaimed: false,
    failClosedOnDrift: true,
    expectedExports: CRYPTO_PACKAGE_SURFACE_CONSISTENCY_EXPECTED_EXPORTS,
    deepImportProbes: CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES,
    reasonCodes: CRYPTO_PACKAGE_SURFACE_CONSISTENCY_REASON_CODES,
  });
}

export function createCryptoPackageSurfaceConsistencyProfile(
  input: CreateCryptoPackageSurfaceConsistencyProfileInput,
): CryptoPackageSurfaceConsistencyProfile {
  const entries = Object.freeze(
    CRYPTO_PACKAGE_SURFACE_CONSISTENCY_EXPECTED_EXPORTS.map((expected) =>
      packageSurfaceConsistencyEntry({
        expected,
        exportMap: input.exportMap,
        blockedDeepImportProbes: input.blockedDeepImportProbes,
      }),
    ),
  );
  const reasonCodes = uniqueSortedReasonCodes([
    ...(input.packagePrivate ? [] : ['private-package-boundary-required'] as const),
    ...entries.flatMap((entry) => entry.reasonCodes),
  ]);
  const status = reasonCodes.length === 0 ? 'pass' : 'fail';
  const finalReasonCodes = status === 'pass'
    ? Object.freeze(['package-surface-consistency-pass'] as const)
    : reasonCodes;
  const summary = Object.freeze({
    surfaceCount: entries.length,
    matchedExportCount: entries.filter((entry) => entry.exportMapStatus === 'matched').length,
    matchedDescriptorCount:
      entries.filter((entry) => entry.descriptorStatus === 'matched').length,
    blockedDeepImportCount:
      entries.filter((entry) => entry.deepImportStatus === 'blocked').length,
  });
  const payload = {
    version: CRYPTO_PACKAGE_SURFACE_CONSISTENCY_SPEC_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    packageName: CRYPTO_INTELLIGENCE_PACKAGE_NAME,
    status,
    failClosedOnDrift: true,
    privatePackageRequired: true,
    packagePrivate: input.packagePrivate,
    publicNpmPublicationClaimed: false,
    entries,
    summary,
    reasonCodes: finalReasonCodes,
  } as const;
  const canonical = canonicalPackageSurfaceObject(
    payload as unknown as CanonicalReleaseJsonValue,
  );

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

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
    packageSurfaceConsistencyVersion:
      CRYPTO_PACKAGE_SURFACE_CONSISTENCY_SPEC_VERSION,
    hostedRouteClaimed: false,
    attestorNativeOracleClaimed: false,
    extractionCriteria: CRYPTO_INTELLIGENCE_EXTRACTION_CRITERIA,
  });
}
