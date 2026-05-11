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

export const CRYPTO_ADAPTER_READINESS_STATUSES = [
  'ready',
  'needs-evidence',
  'blocked',
] as const;
export type CryptoAdapterReadinessStatus =
  typeof CRYPTO_ADAPTER_READINESS_STATUSES[number];

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
