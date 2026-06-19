import { CRYPTO_ADMISSION_RECEIPT_CLASSIFICATIONS, type CryptoAdmissionReceipt, type CryptoAdmissionReceiptClassification, type CryptoAdmissionReceiptSigner, type CryptoAdmissionTelemetryEvent, type CryptoAdmissionTelemetrySignal, type CryptoAdmissionTelemetrySubject } from './telemetry-receipts.js';
import type { CryptoExecutionAdmissionOutcome, CryptoExecutionAdmissionPlan, CryptoExecutionAdmissionSurface } from './index.js';
import type { CryptoExecutionAdapterKind } from '../crypto-authorization-core/types.js';

/**
 * Adapter-neutral conformance fixtures for integrators that need to prove their
 * wallet, guard, bundler, payment, custody, or solver handoff honors the same
 * Attestor admission contract.
 */

export const CRYPTO_ADMISSION_CONFORMANCE_FIXTURES_SPEC_VERSION =
  'attestor.crypto-execution-admission-conformance-fixtures.v1';

export const CRYPTO_ADMISSION_CONFORMANCE_SCHEMA_DIALECT =
  'https://json-schema.org/draft/2020-12/schema';

export const CRYPTO_ADMISSION_CONFORMANCE_FIXTURE_PATH =
  'fixtures/crypto-execution-admission/conformance-fixtures.v1.json';

export const CRYPTO_ADMISSION_CONFORMANCE_SCHEMA_PATH =
  'fixtures/crypto-execution-admission/conformance-fixtures.schema.json';

export const CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES = [
  'wallet-rpc',
  'smart-account-guard',
  'account-abstraction-bundler',
  'modular-account-runtime',
  'delegated-eoa-runtime',
  'agent-payment-http',
  'custody-policy-engine',
  'intent-solver',
] as const satisfies readonly CryptoExecutionAdmissionSurface[];
export type CryptoAdmissionConformanceSurface =
  typeof CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES[number];

export const CRYPTO_ADMISSION_CONFORMANCE_RUNTIME_CHECKS = [
  'json-schema-2020-12-shape',
  'surface-coverage',
  'plan-subject-binding',
  'cloudevents-telemetry-shape',
  'signed-receipt-verification',
  'fail-closed-integrator-assertions',
  'negative-fixture-coverage',
  'negative-fixture-privacy-safety',
] as const;
export type CryptoAdmissionConformanceRuntimeCheck =
  typeof CRYPTO_ADMISSION_CONFORMANCE_RUNTIME_CHECKS[number];

export const CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_CLASSES = [
  'malformed',
  'stale',
  'malicious',
  'contradictory',
  'privacy-unsafe',
] as const;
export type CryptoAdmissionNegativeConformanceClass =
  typeof CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_CLASSES[number];

export const CRYPTO_ADMISSION_CONFORMANCE_TELEMETRY_SIGNALS = [
  'admitted',
  'blocked',
  'missing-evidence',
] as const satisfies readonly Exclude<CryptoAdmissionTelemetrySignal, 'receipt-issued'>[];

export interface CryptoAdmissionConformanceFixtureSigner
  extends CryptoAdmissionReceiptSigner {
  readonly purpose: 'fixture-only';
}

export interface CryptoAdmissionConformanceFixture {
  readonly fixtureId: string;
  readonly surface: CryptoAdmissionConformanceSurface;
  readonly adapterKind: CryptoExecutionAdapterKind;
  readonly standards: readonly string[];
  readonly scenario: string;
  readonly expectedSignal: Exclude<CryptoAdmissionTelemetrySignal, 'receipt-issued'>;
  readonly expectedReceiptClassification: CryptoAdmissionReceiptClassification;
  readonly expectedPlanOutcome: CryptoExecutionAdmissionOutcome;
  readonly expectedDownstreamAction: string;
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly subject: CryptoAdmissionTelemetrySubject;
  readonly telemetryEvent: CryptoAdmissionTelemetryEvent;
  readonly receipt: CryptoAdmissionReceipt;
  readonly externalIntegratorAssertions: readonly string[];
}

export interface CryptoAdmissionNegativeConformanceFixture {
  readonly fixtureId: string;
  readonly surface: CryptoAdmissionConformanceSurface;
  readonly adapterKind: CryptoExecutionAdapterKind;
  readonly negativeClass: CryptoAdmissionNegativeConformanceClass;
  readonly standards: readonly string[];
  readonly scenario: string;
  readonly evidenceClass: string;
  readonly expectedFindingCode: string;
  readonly expectedPlanOutcome: Exclude<CryptoExecutionAdmissionOutcome, 'admit'>;
  readonly expectedSignal: Exclude<
    CryptoAdmissionTelemetrySignal,
    'admitted' | 'receipt-issued'
  >;
  readonly expectedDownstreamAction:
    | 'block-execution'
    | 'collect-evidence'
    | 'hold-for-review'
    | 'reject-fixture';
  readonly modelSafeFeedback: readonly string[];
  readonly shouldFailClosed: true;
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
}

export interface CryptoAdmissionConformanceFixtureSuite {
  readonly version: typeof CRYPTO_ADMISSION_CONFORMANCE_FIXTURES_SPEC_VERSION;
  readonly schemaDialect: typeof CRYPTO_ADMISSION_CONFORMANCE_SCHEMA_DIALECT;
  readonly generatedAt: string;
  readonly fixtureSigner: CryptoAdmissionConformanceFixtureSigner;
  readonly requiredSurfaces: readonly CryptoAdmissionConformanceSurface[];
  readonly fixtures: readonly CryptoAdmissionConformanceFixture[];
}

export interface CryptoAdmissionConformanceDescriptor {
  readonly fixtureVersion: typeof CRYPTO_ADMISSION_CONFORMANCE_FIXTURES_SPEC_VERSION;
  readonly schemaDialect: typeof CRYPTO_ADMISSION_CONFORMANCE_SCHEMA_DIALECT;
  readonly fixturePath: typeof CRYPTO_ADMISSION_CONFORMANCE_FIXTURE_PATH;
  readonly schemaPath: typeof CRYPTO_ADMISSION_CONFORMANCE_SCHEMA_PATH;
  readonly requiredSurfaces: typeof CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES;
  readonly runtimeChecks: typeof CRYPTO_ADMISSION_CONFORMANCE_RUNTIME_CHECKS;
  readonly telemetrySignals: typeof CRYPTO_ADMISSION_CONFORMANCE_TELEMETRY_SIGNALS;
  readonly receiptClassifications: typeof CRYPTO_ADMISSION_RECEIPT_CLASSIFICATIONS;
  readonly negativeFixtureClasses: typeof CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_CLASSES;
  readonly negativeFixtureCount: number;
}

export type CryptoAdmissionConformanceFindingSeverity = 'error' | 'warning';

export interface CryptoAdmissionConformanceValidationFinding {
  readonly severity: CryptoAdmissionConformanceFindingSeverity;
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface CryptoAdmissionConformanceValidationResult {
  readonly status: 'valid' | 'invalid';
  readonly fixtureCount: number;
  readonly coveredSurfaces: readonly CryptoAdmissionConformanceSurface[];
  readonly missingSurfaces: readonly CryptoAdmissionConformanceSurface[];
  readonly findings: readonly CryptoAdmissionConformanceValidationFinding[];
}

export interface CryptoAdmissionNegativeConformanceValidationResult {
  readonly status: 'valid' | 'invalid';
  readonly fixtureCount: number;
  readonly missingCoverage: readonly string[];
  readonly findings: readonly CryptoAdmissionConformanceValidationFinding[];
}
