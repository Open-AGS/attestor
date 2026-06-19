import type { CryptoSimulationPreflightSource } from '../crypto-authorization-core/authorization-simulation.js';
import type { CryptoExecutionAdmissionPlan, CryptoExecutionAdmissionStep } from './index.js';
import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import { CRYPTO_ADAPTER_READINESS_MATRIX } from './adapter-readiness-manifest-matrix.js';
import { canonicalObject, normalizeIsoTimestamp, normalizeOptionalIdentifier, unique } from './adapter-readiness-manifest-normalize.js';
import {
  CRYPTO_ADAPTER_READINESS_INTELLIGENCE_SPEC_VERSION,
  CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION,
  CRYPTO_ADAPTER_READINESS_PRIVACY_GUARDRAILS,
  type CreateCryptoAdapterReadinessManifestInput,
  type CryptoAdapterReadinessCoverage,
  type CryptoAdapterReadinessEntry,
  type CryptoAdapterReadinessEvidenceClass,
  type CryptoAdapterReadinessManifest,
  type CryptoAdapterReadinessMatrixEntry,
  type CryptoAdapterReadinessPlanRef,
  type CryptoAdapterReadinessStatus,
} from './adapter-readiness-manifest-types.js';

export function matchedPlansFor(
  matrixEntry: CryptoAdapterReadinessMatrixEntry,
  plans: readonly CryptoExecutionAdmissionPlan[],
): readonly CryptoExecutionAdmissionPlan[] {
  return Object.freeze(
    plans.filter((plan) => plan.adapterKind === matrixEntry.adapterKind),
  );
}

export function planRef(plan: CryptoExecutionAdmissionPlan): CryptoAdapterReadinessPlanRef {
  return Object.freeze({
    planId: plan.planId,
    planDigest: plan.digest,
    createdAt: plan.createdAt,
    outcome: plan.outcome,
  });
}

export function evidenceClassForPreflight(
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

export function evidenceClassForStep(
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

export function missingEvidenceClassesFor(
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

export function statusForPlans(
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

export function reasonCodesFor(
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

export function blockedReasonsFor(
  plans: readonly CryptoExecutionAdmissionPlan[],
): readonly string[] {
  return unique(plans.flatMap((plan) => plan.blockedReasons));
}

export function modelSafeFeedbackFor(input: {
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

export function readinessEntryFor(
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

export function coverageFor(
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

export function manifestIdFor(input: {
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

export function profileIdFor(input: {
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
