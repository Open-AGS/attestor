import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CryptoSimulationPreflightSource,
} from '../crypto-authorization-core/authorization-simulation.js';
import type { CryptoExecutionAdapterKind } from '../crypto-authorization-core/types.js';
import type {
  CryptoExecutionAdmissionPlan,
  CryptoExecutionAdmissionStep,
  CryptoExecutionAdmissionSurface,
} from './index.js';

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

const PRIVATE_DATA_BOUNDARY = Object.freeze({
  rawPayloadStored: false,
  rawProviderResponseStored: false,
  customerIdentifiersStored: false,
  privatePolicyThresholdsStored: false,
  solverRouteSecretsStored: false,
} as const);

export const CRYPTO_ADAPTER_READINESS_MATRIX = Object.freeze({
  'adapter-neutral': Object.freeze({
    matrixEntryId: 'adapter-neutral',
    adapterKind: null,
    surface: 'attestor-core',
    standards: Object.freeze(['attestor-core']),
    requiredPreflightSources: Object.freeze([] as const),
    recommendedPreflightSources: Object.freeze(['wallet-capabilities'] as const),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'policy-scope-binding',
      'enforcement-presentation',
    ] as const),
    terminalEvidenceClasses: Object.freeze(['admission-receipt'] as const),
    privateDataBoundary: PRIVATE_DATA_BOUNDARY,
  }),
  'wallet-call-api': Object.freeze({
    matrixEntryId: 'wallet-call-api',
    adapterKind: 'wallet-call-api',
    surface: 'wallet-rpc',
    standards: Object.freeze(['EIP-5792', 'ERC-7715', 'ERC-7902']),
    requiredPreflightSources: Object.freeze([
      'wallet-capabilities',
      'wallet-call-preparation',
    ] as const),
    recommendedPreflightSources: Object.freeze([] as const),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'wallet-capabilities',
      'prepared-call-bundle',
    ] as const),
    terminalEvidenceClasses: Object.freeze(['admission-receipt'] as const),
    privateDataBoundary: PRIVATE_DATA_BOUNDARY,
  }),
  'safe-guard': Object.freeze({
    matrixEntryId: 'safe-guard',
    adapterKind: 'safe-guard',
    surface: 'smart-account-guard',
    standards: Object.freeze(['Safe Guard', 'ERC-1271']),
    requiredPreflightSources: Object.freeze(['safe-guard'] as const),
    recommendedPreflightSources: Object.freeze(['wallet-call-preparation'] as const),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'safe-transaction-hash',
      'guard-precheck',
    ] as const),
    terminalEvidenceClasses: Object.freeze(['admission-receipt'] as const),
    privateDataBoundary: PRIVATE_DATA_BOUNDARY,
  }),
  'safe-module-guard': Object.freeze({
    matrixEntryId: 'safe-module-guard',
    adapterKind: 'safe-module-guard',
    surface: 'smart-account-guard',
    standards: Object.freeze(['Safe Module Guard', 'Safe Modules', 'ERC-1271']),
    requiredPreflightSources: Object.freeze(['safe-guard', 'module-hook'] as const),
    recommendedPreflightSources: Object.freeze(['wallet-call-preparation'] as const),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'safe-module-transaction-hash',
      'module-hook-precheck',
    ] as const),
    terminalEvidenceClasses: Object.freeze(['admission-receipt'] as const),
    privateDataBoundary: PRIVATE_DATA_BOUNDARY,
  }),
  'erc-4337-user-operation': Object.freeze({
    matrixEntryId: 'erc-4337-user-operation',
    adapterKind: 'erc-4337-user-operation',
    surface: 'account-abstraction-bundler',
    standards: Object.freeze(['ERC-4337', 'ERC-7562', 'ERC-1271']),
    requiredPreflightSources: Object.freeze([
      'erc-4337-validation',
      'erc-7562-validation-scope',
    ] as const),
    recommendedPreflightSources: Object.freeze(['wallet-capabilities'] as const),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'user-operation-hash',
      'simulate-validation-result',
      'erc-7562-validation-scope',
    ] as const),
    terminalEvidenceClasses: Object.freeze(['admission-receipt'] as const),
    privateDataBoundary: PRIVATE_DATA_BOUNDARY,
  }),
  'erc-7579-module': Object.freeze({
    matrixEntryId: 'erc-7579-module',
    adapterKind: 'erc-7579-module',
    surface: 'modular-account-runtime',
    standards: Object.freeze(['ERC-7579', 'ERC-4337']),
    requiredPreflightSources: Object.freeze(['module-hook'] as const),
    recommendedPreflightSources: Object.freeze([
      'erc-4337-validation',
      'erc-7562-validation-scope',
    ] as const),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'module-installation-evidence',
      'module-hook-precheck',
    ] as const),
    terminalEvidenceClasses: Object.freeze(['admission-receipt'] as const),
    privateDataBoundary: PRIVATE_DATA_BOUNDARY,
  }),
  'erc-6900-plugin': Object.freeze({
    matrixEntryId: 'erc-6900-plugin',
    adapterKind: 'erc-6900-plugin',
    surface: 'modular-account-runtime',
    standards: Object.freeze(['ERC-6900', 'ERC-4337']),
    requiredPreflightSources: Object.freeze(['module-hook'] as const),
    recommendedPreflightSources: Object.freeze([
      'erc-4337-validation',
      'erc-7562-validation-scope',
    ] as const),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'plugin-manifest-approval',
      'module-hook-precheck',
    ] as const),
    terminalEvidenceClasses: Object.freeze(['admission-receipt'] as const),
    privateDataBoundary: PRIVATE_DATA_BOUNDARY,
  }),
  'eip-7702-delegation': Object.freeze({
    matrixEntryId: 'eip-7702-delegation',
    adapterKind: 'eip-7702-delegation',
    surface: 'delegated-eoa-runtime',
    standards: Object.freeze(['EIP-7702', 'EIP-5792', 'ERC-7902']),
    requiredPreflightSources: Object.freeze(['eip-7702-authorization'] as const),
    recommendedPreflightSources: Object.freeze(['wallet-call-preparation'] as const),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'authorization-list-tuple',
      'delegate-code-approval',
    ] as const),
    terminalEvidenceClasses: Object.freeze(['admission-receipt'] as const),
    privateDataBoundary: PRIVATE_DATA_BOUNDARY,
  }),
  'x402-payment': Object.freeze({
    matrixEntryId: 'x402-payment',
    adapterKind: 'x402-payment',
    surface: 'agent-payment-http',
    standards: Object.freeze(['x402-v2', 'HTTP 402', 'EIP-3009']),
    requiredPreflightSources: Object.freeze(['x402-payment'] as const),
    recommendedPreflightSources: Object.freeze(['wallet-capabilities'] as const),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'x402-payment-requirement',
      'x402-payment-signature',
      'x402-payment-response',
      'x402-payment-verification',
    ] as const),
    terminalEvidenceClasses: Object.freeze(['admission-receipt'] as const),
    privateDataBoundary: PRIVATE_DATA_BOUNDARY,
  }),
  'custody-cosigner': Object.freeze({
    matrixEntryId: 'custody-cosigner',
    adapterKind: 'custody-cosigner',
    surface: 'custody-policy-engine',
    standards: Object.freeze(['custody-policy-engine', 'co-signer-callback']),
    requiredPreflightSources: Object.freeze(['custody-policy'] as const),
    recommendedPreflightSources: Object.freeze([] as const),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'custody-policy-decision',
      'co-signer-response',
    ] as const),
    terminalEvidenceClasses: Object.freeze(['admission-receipt'] as const),
    privateDataBoundary: PRIVATE_DATA_BOUNDARY,
  }),
  'intent-settlement': Object.freeze({
    matrixEntryId: 'intent-settlement',
    adapterKind: 'intent-settlement',
    surface: 'intent-solver',
    standards: Object.freeze(['intent-settlement', 'ERC-7683', 'solver-preflight']),
    requiredPreflightSources: Object.freeze(['intent-settlement'] as const),
    recommendedPreflightSources: Object.freeze(['wallet-capabilities'] as const),
    requiredHandoffArtifacts: Object.freeze([
      'attestor-release-authorization',
      'solver-route-commitment',
      'settlement-preflight',
    ] as const),
    terminalEvidenceClasses: Object.freeze(['admission-receipt'] as const),
    privateDataBoundary: PRIVATE_DATA_BOUNDARY,
  }),
} satisfies Record<
  CryptoExecutionAdapterKind | 'adapter-neutral',
  CryptoAdapterReadinessMatrixEntry
>);

function normalizeIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    throw new Error(`Crypto adapter readiness ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Crypto adapter readiness ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function matchedPlansFor(
  matrixEntry: CryptoAdapterReadinessMatrixEntry,
  plans: readonly CryptoExecutionAdmissionPlan[],
): readonly CryptoExecutionAdmissionPlan[] {
  return Object.freeze(
    plans.filter((plan) => plan.adapterKind === matrixEntry.adapterKind),
  );
}

function planRef(plan: CryptoExecutionAdmissionPlan): CryptoAdapterReadinessPlanRef {
  return Object.freeze({
    planId: plan.planId,
    planDigest: plan.digest,
    createdAt: plan.createdAt,
    outcome: plan.outcome,
  });
}

function evidenceClassForPreflight(
  source: CryptoSimulationPreflightSource,
): CryptoAdapterReadinessEvidenceClass {
  switch (source) {
    case 'wallet-capabilities':
      return 'wallet-capabilities';
    case 'wallet-call-preparation':
      return 'prepared-call-bundle';
    case 'erc-4337-validation':
      return 'simulate-validation-result';
    case 'erc-7562-validation-scope':
      return 'erc-7562-validation-scope';
    case 'erc-7715-permission':
      return 'wallet-permission-scope';
    case 'eip-7702-authorization':
      return 'authorization-list-tuple';
    case 'safe-guard':
      return 'guard-precheck';
    case 'module-hook':
      return 'module-hook-precheck';
    case 'custody-policy':
      return 'custody-policy-decision';
    case 'intent-settlement':
      return 'settlement-preflight';
    case 'x402-payment':
      return 'x402-payment-verification';
  }
}

function evidenceClassForStep(
  step: CryptoExecutionAdmissionStep,
): CryptoAdapterReadinessEvidenceClass | null {
  if (step.kind === 'collect-release-authorization') {
    return 'attestor-release-authorization';
  }
  if (step.kind === 'activate-policy-scope') {
    return 'policy-scope-binding';
  }
  if (step.kind === 'bind-enforcement-presentation') {
    return 'enforcement-presentation';
  }
  if (step.kind === 'collect-adapter-preflight') {
    return step.source === 'admission-planner'
      ? 'admission-plan'
      : evidenceClassForPreflight(step.source as CryptoSimulationPreflightSource);
  }
  if (step.kind === 'prepare-wallet-call') {
    return step.source === 'eip-7702-authorization'
      ? 'authorization-list-tuple'
      : step.source === 'erc-7715-permission'
        ? 'wallet-permission-scope'
        : 'prepared-call-bundle';
  }
  if (step.kind === 'run-smart-account-guard') {
    return step.source === 'module-hook' ? 'module-hook-precheck' : 'guard-precheck';
  }
  if (step.kind === 'simulate-user-operation') {
    return step.source === 'erc-7562-validation-scope'
      ? 'erc-7562-validation-scope'
      : 'simulate-validation-result';
  }
  if (step.kind === 'verify-http-payment') {
    return 'x402-payment-verification';
  }
  if (step.kind === 'evaluate-custody-policy') {
    return 'custody-policy-decision';
  }
  if (step.kind === 'verify-intent-settlement') {
    return 'settlement-preflight';
  }
  return null;
}

function missingEvidenceClassesFor(
  matrixEntry: CryptoAdapterReadinessMatrixEntry,
  plans: readonly CryptoExecutionAdmissionPlan[],
): readonly CryptoAdapterReadinessEvidenceClass[] {
  if (plans.length === 0) {
    return unique([
      'admission-plan',
      ...matrixEntry.requiredHandoffArtifacts,
      ...matrixEntry.requiredPreflightSources.map(evidenceClassForPreflight),
    ]);
  }

  const missing = plans.flatMap((plan) =>
    plan.steps
      .filter(
        (step) =>
          step.stepId !== 'submit-execution' &&
          step.stepId !== 'record-admission-receipt' &&
          (step.status === 'required' || step.status === 'blocked'),
      )
      .map(evidenceClassForStep)
      .filter((entry): entry is CryptoAdapterReadinessEvidenceClass => entry !== null),
  );

  return unique(missing);
}

function statusForPlans(
  plans: readonly CryptoExecutionAdmissionPlan[],
): CryptoAdapterReadinessStatus {
  if (
    plans.some(
      (plan) =>
        plan.outcome === 'deny' ||
        plan.steps.some((step) => step.status === 'blocked'),
    )
  ) {
    return 'blocked';
  }
  if (
    plans.some((plan) => plan.outcome === 'admit') &&
    !plans.some((plan) => plan.outcome === 'needs-evidence')
  ) {
    return 'ready';
  }
  return 'needs-evidence';
}

function reasonCodesFor(
  plans: readonly CryptoExecutionAdmissionPlan[],
): readonly string[] {
  if (plans.length === 0) {
    return Object.freeze(['admission-plan-missing']);
  }
  return unique(
    plans.flatMap((plan) =>
      plan.steps
        .filter((step) => step.status === 'required' || step.status === 'blocked')
        .map((step) => step.reasonCode),
    ),
  );
}

function blockedReasonsFor(
  plans: readonly CryptoExecutionAdmissionPlan[],
): readonly string[] {
  return unique(plans.flatMap((plan) => plan.blockedReasons));
}

function modelSafeFeedbackFor(input: {
  readonly status: CryptoAdapterReadinessStatus;
  readonly missingEvidenceClasses: readonly CryptoAdapterReadinessEvidenceClass[];
  readonly blockedReasons: readonly string[];
}): readonly string[] {
  if (input.status === 'ready') {
    return Object.freeze(['adapter-readiness-ready']);
  }
  if (input.status === 'blocked') {
    return Object.freeze([
      'adapter-readiness-blocked',
      ...input.blockedReasons.map((reason) => `blocked:${reason}`),
    ]);
  }
  return Object.freeze([
    'adapter-readiness-needs-evidence',
    ...input.missingEvidenceClasses.map((evidenceClass) => `missing:${evidenceClass}`),
  ]);
}

function readinessEntryFor(
  matrixEntry: CryptoAdapterReadinessMatrixEntry,
  plans: readonly CryptoExecutionAdmissionPlan[],
): CryptoAdapterReadinessEntry {
  const matchedPlans = matchedPlansFor(matrixEntry, plans);
  const status = statusForPlans(matchedPlans);
  const blockedReasons = blockedReasonsFor(matchedPlans);
  const missingEvidenceClasses = missingEvidenceClassesFor(matrixEntry, matchedPlans);
  const readyPlanDigest =
    matchedPlans.find((plan) => plan.outcome === 'admit')?.digest ?? null;
  const reasonCodes = reasonCodesFor(matchedPlans);
  const operatorAction = status === 'ready'
    ? 'proceed-with-handoff'
    : status === 'blocked'
      ? 'resolve-blocked-plan'
      : 'collect-adapter-evidence';

  return Object.freeze({
    matrixEntryId: matrixEntry.matrixEntryId,
    adapterKind: matrixEntry.adapterKind,
    surface: matrixEntry.surface,
    standards: matrixEntry.standards,
    requiredPreflightSources: matrixEntry.requiredPreflightSources,
    recommendedPreflightSources: matrixEntry.recommendedPreflightSources,
    requiredHandoffArtifacts: matrixEntry.requiredHandoffArtifacts,
    terminalEvidenceClasses: matrixEntry.terminalEvidenceClasses,
    status,
    reasonCodes,
    missingEvidenceClasses,
    blockedReasons,
    matchedPlans: Object.freeze(matchedPlans.map(planRef)),
    readyPlanDigest,
    operatorAction,
    modelSafeFeedback: modelSafeFeedbackFor({
      status,
      missingEvidenceClasses,
      blockedReasons,
    }),
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    privatePolicyThresholdsStored: false,
  });
}

function coverageFor(
  entries: readonly CryptoAdapterReadinessEntry[],
): CryptoAdapterReadinessCoverage {
  return Object.freeze({
    totalEntries: entries.length,
    readyCount: entries.filter((entry) => entry.status === 'ready').length,
    needsEvidenceCount: entries.filter((entry) => entry.status === 'needs-evidence')
      .length,
    blockedCount: entries.filter((entry) => entry.status === 'blocked').length,
    coveredSurfaceCount: new Set(entries.map((entry) => entry.surface)).size,
    surfaces: unique(entries.map((entry) => entry.surface)),
  });
}

function manifestIdFor(input: {
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly planDigests: readonly string[];
}): string {
  return canonicalObject({
    version: CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION,
    generatedAt: input.generatedAt,
    scopeRef: input.scopeRef,
    planDigests: input.planDigests,
  }).digest;
}

function profileIdFor(input: {
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly manifestDigest: string;
}): string {
  return canonicalObject({
    version: CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION,
    generatedAt: input.generatedAt,
    scopeRef: input.scopeRef,
    manifestDigest: input.manifestDigest,
  }).digest;
}

export function createCryptoAdapterReadinessManifest(
  input: CreateCryptoAdapterReadinessManifestInput,
): CryptoAdapterReadinessManifest {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const scopeRef = normalizeOptionalIdentifier(input.scopeRef, 'scopeRef');
  const plans = Object.freeze([...(input.plans ?? [])]);
  const entries = Object.freeze(
    Object.values(CRYPTO_ADAPTER_READINESS_MATRIX).map((matrixEntry) =>
      readinessEntryFor(matrixEntry, plans),
    ),
  );
  const manifestId =
    normalizeOptionalIdentifier(input.manifestId, 'manifestId') ??
    manifestIdFor({
      generatedAt,
      scopeRef,
      planDigests: plans.map((plan) => plan.digest),
    });
  const canonicalPayload = {
    version: CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION,
    manifestId,
    generatedAt,
    scopeRef,
    entries,
    coverage: coverageFor(entries),
    privacyGuardrails: CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function evidenceClassesForPreflightSources(
  sources: readonly CryptoSimulationPreflightSource[],
): readonly CryptoAdapterReadinessEvidenceClass[] {
  return unique(sources.map(evidenceClassForPreflight));
}

function hasAny<T extends string>(left: readonly T[], right: readonly T[]): boolean {
  return left.some((entry) => right.includes(entry));
}

function riskFactor(input: {
  readonly entry: CryptoAdapterReadinessEntry;
  readonly kind: CryptoAdapterReadinessRiskFactorKind;
  readonly severity: CryptoAdapterReadinessRiskFactorSeverity;
  readonly evidenceClasses?: readonly CryptoAdapterReadinessEvidenceClass[];
  readonly reasonCodes?: readonly string[];
  readonly standards?: readonly string[];
  readonly message: string;
}): CryptoAdapterReadinessRiskFactor {
  const standards = unique(input.standards ?? input.entry.standards);
  const evidenceClasses = unique(input.evidenceClasses ?? []);
  const reasonCodes = unique(input.reasonCodes ?? []);

  return Object.freeze({
    factorId: [
      input.entry.matrixEntryId,
      input.kind,
      input.severity,
      ...evidenceClasses,
      ...reasonCodes,
    ].join(':'),
    kind: input.kind,
    severity: input.severity,
    surface: input.entry.surface,
    standards,
    evidenceClasses,
    reasonCodes,
    message: input.message,
    modelSafeFeedback: Object.freeze([
      `adapter:${input.entry.matrixEntryId}`,
      `risk-factor:${input.kind}`,
      `severity:${input.severity}`,
      ...evidenceClasses.map((evidenceClass) => `missing:${evidenceClass}`),
      ...reasonCodes.map((reasonCode) => `reason:${reasonCode}`),
    ]),
  });
}

function postureForEntry(
  entry: CryptoAdapterReadinessEntry,
): CryptoAdapterReadinessPosture {
  if (entry.status === 'blocked') return 'blocked';
  if (entry.status === 'ready') return 'execution-ready';
  if (entry.matchedPlans.length === 0) return 'evidence-required';
  return 'review-required';
}

function riskFactorsForEntry(
  entry: CryptoAdapterReadinessEntry,
): readonly CryptoAdapterReadinessRiskFactor[] {
  const factors: CryptoAdapterReadinessRiskFactor[] = [];
  const requiredPreflightEvidence = evidenceClassesForPreflightSources(
    entry.requiredPreflightSources,
  );
  const recommendedPreflightEvidence = evidenceClassesForPreflightSources(
    entry.recommendedPreflightSources,
  );
  const missingRequiredPreflight = entry.missingEvidenceClasses.filter((evidenceClass) =>
    requiredPreflightEvidence.includes(evidenceClass),
  );
  const missingRequiredHandoff = entry.missingEvidenceClasses.filter((evidenceClass) =>
    entry.requiredHandoffArtifacts.includes(evidenceClass),
  );
  const notReady = entry.status !== 'ready';
  const blockerSeverity: CryptoAdapterReadinessRiskFactorSeverity =
    entry.status === 'blocked' ? 'block' : 'review';

  if (entry.matchedPlans.length === 0) {
    factors.push(
      riskFactor({
        entry,
        kind: 'admission-plan-missing',
        severity: 'review',
        evidenceClasses: ['admission-plan'],
        reasonCodes: entry.reasonCodes,
        message: 'No digest-bound admission plan is available for this adapter surface.',
      }),
    );
  }

  if (entry.status === 'blocked') {
    factors.push(
      riskFactor({
        entry,
        kind: 'admission-plan-blocked',
        severity: 'block',
        reasonCodes: entry.blockedReasons.length > 0
          ? entry.blockedReasons
          : entry.reasonCodes,
        message: 'A matched admission plan is blocked and must be resolved before handoff.',
      }),
    );
  }

  if (missingRequiredPreflight.length > 0) {
    factors.push(
      riskFactor({
        entry,
        kind: 'required-preflight-missing',
        severity: blockerSeverity,
        evidenceClasses: missingRequiredPreflight,
        reasonCodes: entry.reasonCodes,
        message: 'Required adapter preflight evidence is missing or blocked.',
      }),
    );
  }

  if (missingRequiredHandoff.length > 0) {
    factors.push(
      riskFactor({
        entry,
        kind: 'required-handoff-missing',
        severity: blockerSeverity,
        evidenceClasses: missingRequiredHandoff,
        reasonCodes: entry.reasonCodes,
        message: 'Required handoff artifacts are missing for this adapter surface.',
      }),
    );
  }

  if (notReady && recommendedPreflightEvidence.length > 0) {
    factors.push(
      riskFactor({
        entry,
        kind: 'recommended-preflight-unobserved',
        severity: 'advisory',
        evidenceClasses: recommendedPreflightEvidence,
        message: 'Recommended adapter preflight evidence has not been observed yet.',
      }),
    );
  }

  if (notReady && entry.surface === 'smart-account-guard') {
    factors.push(
      riskFactor({
        entry,
        kind: 'smart-account-guard-review',
        severity: blockerSeverity,
        evidenceClasses: hasAny(entry.missingEvidenceClasses, [
          'guard-precheck',
          'module-hook-precheck',
        ])
          ? entry.missingEvidenceClasses.filter((evidenceClass) =>
              ['guard-precheck', 'module-hook-precheck'].includes(evidenceClass),
            )
          : [],
        standards: entry.standards.filter((standard) => standard.includes('Safe')),
        message: 'Smart-account guard readiness requires guard or module-hook precheck evidence.',
      }),
    );
  }

  if (
    notReady &&
    entry.standards.some((standard) => standard === 'ERC-4337' || standard === 'ERC-7562')
  ) {
    factors.push(
      riskFactor({
        entry,
        kind: 'account-abstraction-validation-review',
        severity: blockerSeverity,
        evidenceClasses: entry.missingEvidenceClasses.filter((evidenceClass) =>
          ['simulate-validation-result', 'erc-7562-validation-scope'].includes(
            evidenceClass,
          ),
        ),
        standards: entry.standards.filter(
          (standard) => standard === 'ERC-4337' || standard === 'ERC-7562',
        ),
        message:
          'Account-abstraction handoff requires validation and validation-scope evidence.',
      }),
    );
  }

  if (notReady && entry.standards.includes('EIP-7702')) {
    factors.push(
      riskFactor({
        entry,
        kind: 'delegated-authority-review',
        severity: blockerSeverity,
        evidenceClasses: entry.missingEvidenceClasses.filter((evidenceClass) =>
          ['authorization-list-tuple', 'delegate-code-approval'].includes(evidenceClass),
        ),
        standards: ['EIP-7702'],
        message: 'Delegated EOA execution requires authorization tuple and delegate-code evidence.',
      }),
    );
  }

  if (notReady && entry.standards.includes('x402-v2')) {
    factors.push(
      riskFactor({
        entry,
        kind: 'http-payment-verification-review',
        severity: blockerSeverity,
        evidenceClasses: entry.missingEvidenceClasses.filter((evidenceClass) =>
          [
            'x402-payment-requirement',
            'x402-payment-signature',
            'x402-payment-response',
            'x402-payment-verification',
          ].includes(evidenceClass),
        ),
        standards: ['x402-v2', 'HTTP 402', 'EIP-3009'],
        message:
          'x402 handoff requires payment requirement, signature, response, and verification evidence.',
      }),
    );
  }

  if (notReady && entry.surface === 'custody-policy-engine') {
    factors.push(
      riskFactor({
        entry,
        kind: 'custody-policy-review',
        severity: blockerSeverity,
        evidenceClasses: entry.missingEvidenceClasses.filter((evidenceClass) =>
          ['custody-policy-decision', 'co-signer-response'].includes(evidenceClass),
        ),
        message: 'Custody handoff requires policy-decision and co-signer response evidence.',
      }),
    );
  }

  if (notReady && entry.surface === 'intent-solver') {
    factors.push(
      riskFactor({
        entry,
        kind: 'solver-settlement-review',
        severity: blockerSeverity,
        evidenceClasses: entry.missingEvidenceClasses.filter((evidenceClass) =>
          ['solver-route-commitment', 'settlement-preflight'].includes(evidenceClass),
        ),
        message: 'Intent-solver handoff requires route commitment and settlement preflight evidence.',
      }),
    );
  }

  return Object.freeze(factors);
}

function readinessScoreFor(
  entry: CryptoAdapterReadinessEntry,
  factors: readonly CryptoAdapterReadinessRiskFactor[],
): number {
  if (entry.status === 'ready') return 100;
  if (entry.status === 'blocked') return 0;

  const base = entry.matchedPlans.length > 0 ? 60 : 35;
  const reviewPenalty = factors.filter((factor) => factor.severity === 'review').length * 4;
  const advisoryPenalty = factors.filter((factor) => factor.severity === 'advisory').length * 2;
  const evidencePenalty = Math.min(25, entry.missingEvidenceClasses.length * 2);
  return Math.max(10, base - reviewPenalty - advisoryPenalty - evidencePenalty);
}

function confidenceForEntry(entry: CryptoAdapterReadinessEntry): 'low' | 'medium' | 'high' {
  if (entry.status === 'ready' || entry.status === 'blocked') return 'high';
  if (entry.matchedPlans.length > 0) return 'medium';
  return 'low';
}

function nextActionForEntry(
  entry: CryptoAdapterReadinessEntry,
): CryptoAdapterReadinessNextAction {
  if (entry.status === 'ready') return 'proceed-with-handoff';
  if (entry.status === 'blocked') return 'resolve-blocked-plan';
  if (entry.matchedPlans.length === 0) return 'create-admission-plan';

  const requiredPreflightEvidence = evidenceClassesForPreflightSources(
    entry.requiredPreflightSources,
  );
  if (hasAny(entry.missingEvidenceClasses, requiredPreflightEvidence)) {
    return 'run-required-preflight';
  }
  if (hasAny(entry.missingEvidenceClasses, entry.requiredHandoffArtifacts)) {
    return 'collect-handoff-evidence';
  }
  return 'review-partial-plan';
}

function intelligenceEntryFor(
  entry: CryptoAdapterReadinessEntry,
): CryptoAdapterReadinessIntelligenceEntry {
  const posture = postureForEntry(entry);
  const riskFactors = riskFactorsForEntry(entry);
  const nextAction = nextActionForEntry(entry);

  return Object.freeze({
    matrixEntryId: entry.matrixEntryId,
    adapterKind: entry.adapterKind,
    surface: entry.surface,
    standards: entry.standards,
    status: entry.status,
    posture,
    readinessScore: readinessScoreFor(entry, riskFactors),
    confidence: confidenceForEntry(entry),
    nextAction,
    missingEvidenceClasses: entry.missingEvidenceClasses,
    reasonCodes: entry.reasonCodes,
    riskFactors,
    readyPlanDigest: entry.readyPlanDigest,
    modelSafeFeedback: Object.freeze([
      `adapter:${entry.matrixEntryId}`,
      `posture:${posture}`,
      `next-action:${nextAction}`,
      ...riskFactors.flatMap((factor) => factor.modelSafeFeedback),
    ]),
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  });
}

function topCounts(values: readonly string[], limit = 5): readonly CryptoAdapterReadinessCountSummary[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Object.freeze(
    [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, limit)
      .map(([value, count]) => Object.freeze({ value, count })),
  );
}

function standardsCoverageFor(
  entries: readonly CryptoAdapterReadinessIntelligenceEntry[],
): readonly CryptoAdapterReadinessStandardCoverage[] {
  const standards = unique(entries.flatMap((entry) => entry.standards));

  return Object.freeze(
    standards.map((standard) => {
      const matchingEntries = entries.filter((entry) => entry.standards.includes(standard));
      return Object.freeze({
        standard,
        totalEntryCount: matchingEntries.length,
        readyCount: matchingEntries.filter((entry) => entry.posture === 'execution-ready')
          .length,
        incompleteCount: matchingEntries.filter((entry) => entry.posture !== 'execution-ready')
          .length,
        blockedCount: matchingEntries.filter((entry) => entry.posture === 'blocked').length,
      });
    }),
  );
}

function operatorAttentionItemsFor(
  entries: readonly CryptoAdapterReadinessIntelligenceEntry[],
): readonly string[] {
  return Object.freeze(
    entries
      .filter((entry) => entry.posture !== 'execution-ready')
      .flatMap((entry) => {
        if (entry.posture === 'blocked') {
          return [`${entry.surface}:blocked:${entry.reasonCodes[0] ?? 'blocked-plan'}`];
        }
        const missing = entry.missingEvidenceClasses[0] ?? 'admission-plan';
        return [`${entry.surface}:missing:${missing}`];
      })
      .slice(0, 8),
  );
}

function intelligenceSummaryFor(
  entries: readonly CryptoAdapterReadinessIntelligenceEntry[],
): CryptoAdapterReadinessIntelligenceSummary {
  const totalScore = entries.reduce((sum, entry) => sum + entry.readinessScore, 0);
  const averageReadinessScore = entries.length === 0
    ? 0
    : Math.round((totalScore / entries.length) * 100) / 100;
  const incompleteSurfaces = new Set(
    entries
      .filter((entry) => entry.posture !== 'execution-ready')
      .map((entry) => entry.surface),
  );
  const blockedSurfaces = new Set(
    entries.filter((entry) => entry.posture === 'blocked').map((entry) => entry.surface),
  );

  return Object.freeze({
    totalEntries: entries.length,
    executionReadyCount: entries.filter((entry) => entry.posture === 'execution-ready')
      .length,
    evidenceRequiredCount: entries.filter((entry) => entry.posture === 'evidence-required')
      .length,
    reviewRequiredCount: entries.filter((entry) => entry.posture === 'review-required')
      .length,
    blockedCount: entries.filter((entry) => entry.posture === 'blocked').length,
    averageReadinessScore,
    blockedSurfaceCount: blockedSurfaces.size,
    incompleteSurfaceCount: incompleteSurfaces.size,
    topRiskFactorKinds: topCounts(
      entries.flatMap((entry) => entry.riskFactors.map((factor) => factor.kind)),
    ),
    topMissingEvidenceClasses: topCounts(
      entries.flatMap((entry) => entry.missingEvidenceClasses),
    ),
    standardsCoverage: standardsCoverageFor(entries),
    operatorAttentionItems: operatorAttentionItemsFor(entries),
    privacyBoundarySafe: true,
  });
}

export function createCryptoAdapterReadinessIntelligenceProfile(
  input: CreateCryptoAdapterReadinessIntelligenceProfileInput,
): CryptoAdapterReadinessIntelligenceProfile {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt ?? input.manifest.generatedAt,
    'generatedAt',
  );
  const scopeRef = normalizeOptionalIdentifier(
    input.scopeRef ?? input.manifest.scopeRef,
    'scopeRef',
  );
  const entries = Object.freeze(input.manifest.entries.map(intelligenceEntryFor));
  const summary = intelligenceSummaryFor(entries);
  const profileId =
    normalizeOptionalIdentifier(input.profileId, 'profileId') ??
    profileIdFor({
      generatedAt,
      scopeRef,
      manifestDigest: input.manifest.digest,
    });
  const canonicalPayload = {
    version: CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION,
    profileId,
    generatedAt,
    scopeRef,
    manifestId: input.manifest.manifestId,
    manifestDigest: input.manifest.digest,
    manifestCoverage: input.manifest.coverage,
    entries,
    summary,
    privacyGuardrails: CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function cryptoAdapterReadinessIntelligenceProfileLabel(
  profile: CryptoAdapterReadinessIntelligenceProfile,
): string {
  return [
    `crypto-adapter-readiness-intelligence:${profile.profileId}`,
    `score:${profile.summary.averageReadinessScore}`,
    `ready:${profile.summary.executionReadyCount}`,
    `evidence-required:${profile.summary.evidenceRequiredCount}`,
    `review-required:${profile.summary.reviewRequiredCount}`,
    `blocked:${profile.summary.blockedCount}`,
  ].join(' / ');
}

export function cryptoAdapterReadinessManifestLabel(
  manifest: CryptoAdapterReadinessManifest,
): string {
  return [
    `crypto-adapter-readiness:${manifest.manifestId}`,
    `ready:${manifest.coverage.readyCount}`,
    `needs-evidence:${manifest.coverage.needsEvidenceCount}`,
    `blocked:${manifest.coverage.blockedCount}`,
  ].join(' / ');
}

export function cryptoAdapterReadinessIntelligenceDescriptor():
CryptoAdapterReadinessIntelligenceDescriptor {
  return Object.freeze({
    version: CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION,
    manifestVersion: CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION,
    postures: CRYPTO_ADAPTER_READINESS_POSTURES,
    riskFactorKinds: CRYPTO_ADAPTER_READINESS_RISK_FACTOR_KINDS,
    nextActions: CRYPTO_ADAPTER_READINESS_NEXT_ACTIONS,
    privacyGuardrails: CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  });
}

export function cryptoAdapterReadinessManifestDescriptor():
CryptoAdapterReadinessManifestDescriptor {
  return Object.freeze({
    version: CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION,
    statuses: CRYPTO_ADAPTER_READINESS_STATUSES,
    evidenceClasses: CRYPTO_ADAPTER_READINESS_EVIDENCE_CLASSES,
    privacyGuardrails: CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS,
    matrixEntryCount: Object.keys(CRYPTO_ADAPTER_READINESS_MATRIX).length,
    surfaces: unique(
      Object.values(CRYPTO_ADAPTER_READINESS_MATRIX).map((entry) => entry.surface),
    ),
    standards: unique(
      Object.values(CRYPTO_ADAPTER_READINESS_MATRIX).flatMap((entry) => entry.standards),
    ),
  });
}
