import type { CryptoSimulationPreflightSource } from '../crypto-authorization-core/authorization-simulation.js';
import type { CryptoExecutionAdapterKind } from '../crypto-authorization-core/types.js';
import type { CryptoExecutionAdmissionPlan, CryptoExecutionAdmissionSurface } from './index.js';

export const CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION =
  'attestor.crypto-adapter-readiness-manifest.v1';

export const CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION =
  'attestor.crypto-adapter-readiness-intelligence.v1';

export const CRYPTO_ADAPTER_READINESS_STATUSES = [
  'ready',
  'needs-evidence',
  'blocked',
] as const;
export type CryptoAdapterReadinessStatus =
  typeof CRYPTO_ADAPTER_READINESS_STATUSES[number];

export const CRYPTO_ADAPTER_READINESS_POSTURES = [
  'execution-ready',
  'evidence-required',
  'review-required',
  'blocked',
] as const;
export type CryptoAdapterReadinessPosture =
  typeof CRYPTO_ADAPTER_READINESS_POSTURES[number];

export const CRYPTO_ADAPTER_READINESS_RISK_FACTOR_SEVERITIES = [
  'advisory',
  'review',
  'block',
] as const;
export type CryptoAdapterReadinessRiskFactorSeverity =
  typeof CRYPTO_ADAPTER_READINESS_RISK_FACTOR_SEVERITIES[number];

export const CRYPTO_ADAPTER_READINESS_RISK_FACTOR_KINDS = [
  'admission-plan-missing',
  'admission-plan-blocked',
  'required-preflight-missing',
  'required-handoff-missing',
  'recommended-preflight-unobserved',
  'smart-account-guard-review',
  'account-abstraction-validation-review',
  'delegated-authority-review',
  'http-payment-verification-review',
  'custody-policy-review',
  'solver-settlement-review',
] as const;
export type CryptoAdapterReadinessRiskFactorKind =
  typeof CRYPTO_ADAPTER_READINESS_RISK_FACTOR_KINDS[number];

export const CRYPTO_ADAPTER_READINESS_NEXT_ACTIONS = [
  'proceed-with-handoff',
  'create-admission-plan',
  'run-required-preflight',
  'collect-handoff-evidence',
  'review-partial-plan',
  'resolve-blocked-plan',
] as const;
export type CryptoAdapterReadinessNextAction =
  typeof CRYPTO_ADAPTER_READINESS_NEXT_ACTIONS[number];

export const CRYPTO_ADAPTER_READINESS_EVIDENCE_CLASSES = [
  'attestor-release-authorization',
  'policy-scope-binding',
  'enforcement-presentation',
  'admission-plan',
  'admission-receipt',
  'wallet-capabilities',
  'prepared-call-bundle',
  'wallet-permission-scope',
  'safe-transaction-hash',
  'safe-module-transaction-hash',
  'guard-precheck',
  'module-installation-evidence',
  'module-hook-precheck',
  'plugin-manifest-approval',
  'user-operation-hash',
  'simulate-validation-result',
  'erc-7562-validation-scope',
  'authorization-list-tuple',
  'delegate-code-approval',
  'x402-payment-requirement',
  'x402-payment-signature',
  'x402-payment-response',
  'x402-payment-verification',
  'custody-policy-decision',
  'co-signer-response',
  'solver-route-commitment',
  'settlement-preflight',
] as const;
export type CryptoAdapterReadinessEvidenceClass =
  typeof CRYPTO_ADAPTER_READINESS_EVIDENCE_CLASSES[number];

export const CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS = [
  'no-raw-wallet-metadata',
  'no-raw-transaction-payload',
  'no-customer-identifier',
  'no-custody-callback-body',
  'no-provider-error-body',
  'no-private-policy-threshold',
  'no-solver-route-secret',
  'digest-and-scoped-ref-only',
] as const;

export interface CryptoAdapterReadinessMatrixEntry {
  readonly matrixEntryId: CryptoExecutionAdapterKind | 'adapter-neutral';
  readonly adapterKind: CryptoExecutionAdapterKind | null;
  readonly surface: CryptoExecutionAdmissionSurface;
  readonly standards: readonly string[];
  readonly requiredPreflightSources: readonly CryptoSimulationPreflightSource[];
  readonly recommendedPreflightSources: readonly CryptoSimulationPreflightSource[];
  readonly requiredHandoffArtifacts: readonly CryptoAdapterReadinessEvidenceClass[];
  readonly terminalEvidenceClasses: readonly CryptoAdapterReadinessEvidenceClass[];
  readonly privateDataBoundary: {
    readonly rawPayloadStored: false;
    readonly rawProviderResponseStored: false;
    readonly customerIdentifiersStored: false;
    readonly privatePolicyThresholdsStored: false;
    readonly solverRouteSecretsStored: false;
  };
}

export interface CryptoAdapterReadinessPlanRef {
  readonly planId: string;
  readonly planDigest: string;
  readonly createdAt: string;
  readonly outcome: CryptoExecutionAdmissionPlan['outcome'];
}

export interface CryptoAdapterReadinessEntry {
  readonly matrixEntryId: CryptoExecutionAdapterKind | 'adapter-neutral';
  readonly adapterKind: CryptoExecutionAdapterKind | null;
  readonly surface: CryptoExecutionAdmissionSurface;
  readonly standards: readonly string[];
  readonly requiredPreflightSources: readonly CryptoSimulationPreflightSource[];
  readonly recommendedPreflightSources: readonly CryptoSimulationPreflightSource[];
  readonly requiredHandoffArtifacts: readonly CryptoAdapterReadinessEvidenceClass[];
  readonly terminalEvidenceClasses: readonly CryptoAdapterReadinessEvidenceClass[];
  readonly status: CryptoAdapterReadinessStatus;
  readonly reasonCodes: readonly string[];
  readonly missingEvidenceClasses: readonly CryptoAdapterReadinessEvidenceClass[];
  readonly blockedReasons: readonly string[];
  readonly matchedPlans: readonly CryptoAdapterReadinessPlanRef[];
  readonly readyPlanDigest: string | null;
  readonly operatorAction:
    | 'collect-adapter-evidence'
    | 'resolve-blocked-plan'
    | 'proceed-with-handoff';
  readonly modelSafeFeedback: readonly string[];
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
  readonly privatePolicyThresholdsStored: false;
}

export interface CryptoAdapterReadinessCoverage {
  readonly totalEntries: number;
  readonly readyCount: number;
  readonly needsEvidenceCount: number;
  readonly blockedCount: number;
  readonly coveredSurfaceCount: number;
  readonly surfaces: readonly CryptoExecutionAdmissionSurface[];
}

export interface CryptoAdapterReadinessManifest {
  readonly version: typeof CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION;
  readonly manifestId: string;
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly entries: readonly CryptoAdapterReadinessEntry[];
  readonly coverage: CryptoAdapterReadinessCoverage;
  readonly privacyGuardrails: typeof CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS;
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateCryptoAdapterReadinessManifestInput {
  readonly generatedAt: string;
  readonly scopeRef?: string | null;
  readonly manifestId?: string | null;
  readonly plans?: readonly CryptoExecutionAdmissionPlan[] | null;
}

export interface CryptoAdapterReadinessManifestDescriptor {
  readonly version: typeof CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION;
  readonly statuses: typeof CRYPTO_ADAPTER_READINESS_STATUSES;
  readonly evidenceClasses: typeof CRYPTO_ADAPTER_READINESS_EVIDENCE_CLASSES;
  readonly privacyGuardrails: typeof CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS;
  readonly matrixEntryCount: number;
  readonly surfaces: readonly CryptoExecutionAdmissionSurface[];
  readonly standards: readonly string[];
}

export interface CryptoAdapterReadinessRiskFactor {
  readonly factorId: string;
  readonly kind: CryptoAdapterReadinessRiskFactorKind;
  readonly severity: CryptoAdapterReadinessRiskFactorSeverity;
  readonly surface: CryptoExecutionAdmissionSurface;
  readonly standards: readonly string[];
  readonly evidenceClasses: readonly CryptoAdapterReadinessEvidenceClass[];
  readonly reasonCodes: readonly string[];
  readonly message: string;
  readonly modelSafeFeedback: readonly string[];
}

export interface CryptoAdapterReadinessIntelligenceEntry {
  readonly matrixEntryId: CryptoExecutionAdapterKind | 'adapter-neutral';
  readonly adapterKind: CryptoExecutionAdapterKind | null;
  readonly surface: CryptoExecutionAdmissionSurface;
  readonly standards: readonly string[];
  readonly status: CryptoAdapterReadinessStatus;
  readonly posture: CryptoAdapterReadinessPosture;
  readonly readinessScore: number;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly nextAction: CryptoAdapterReadinessNextAction;
  readonly missingEvidenceClasses: readonly CryptoAdapterReadinessEvidenceClass[];
  readonly reasonCodes: readonly string[];
  readonly riskFactors: readonly CryptoAdapterReadinessRiskFactor[];
  readonly readyPlanDigest: string | null;
  readonly modelSafeFeedback: readonly string[];
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
}

export interface CryptoAdapterReadinessCountSummary {
  readonly value: string;
  readonly count: number;
}

export interface CryptoAdapterReadinessStandardCoverage {
  readonly standard: string;
  readonly totalEntryCount: number;
  readonly readyCount: number;
  readonly incompleteCount: number;
  readonly blockedCount: number;
}

export interface CryptoAdapterReadinessIntelligenceSummary {
  readonly totalEntries: number;
  readonly executionReadyCount: number;
  readonly evidenceRequiredCount: number;
  readonly reviewRequiredCount: number;
  readonly blockedCount: number;
  readonly averageReadinessScore: number;
  readonly blockedSurfaceCount: number;
  readonly incompleteSurfaceCount: number;
  readonly topRiskFactorKinds: readonly CryptoAdapterReadinessCountSummary[];
  readonly topMissingEvidenceClasses: readonly CryptoAdapterReadinessCountSummary[];
  readonly standardsCoverage: readonly CryptoAdapterReadinessStandardCoverage[];
  readonly operatorAttentionItems: readonly string[];
  readonly privacyBoundarySafe: true;
}

export interface CryptoAdapterReadinessIntelligenceProfile {
  readonly version: typeof CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION;
  readonly profileId: string;
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly manifestId: string;
  readonly manifestDigest: string;
  readonly manifestCoverage: CryptoAdapterReadinessCoverage;
  readonly entries: readonly CryptoAdapterReadinessIntelligenceEntry[];
  readonly summary: CryptoAdapterReadinessIntelligenceSummary;
  readonly privacyGuardrails: typeof CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS;
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateCryptoAdapterReadinessIntelligenceProfileInput {
  readonly manifest: CryptoAdapterReadinessManifest;
  readonly generatedAt?: string | null;
  readonly scopeRef?: string | null;
  readonly profileId?: string | null;
}

export interface CryptoAdapterReadinessIntelligenceDescriptor {
  readonly version: typeof CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION;
  readonly manifestVersion: typeof CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION;
  readonly postures: typeof CRYPTO_ADAPTER_READINESS_POSTURES;
  readonly riskFactorKinds: typeof CRYPTO_ADAPTER_READINESS_RISK_FACTOR_KINDS;
  readonly nextActions: typeof CRYPTO_ADAPTER_READINESS_NEXT_ACTIONS;
  readonly privacyGuardrails: typeof CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS;
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
}
