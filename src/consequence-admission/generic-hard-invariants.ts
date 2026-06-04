import type {
  ConsequenceAdmissionDecision,
  CreateGenericAdmissionInput,
  GenericAdmissionMode,
  GenericAdmissionShadowDecision,
} from './contracts.js';
import {
  GENERIC_ADMISSION_TRUSTED_OBSERVED_FEATURE_ORIGINS,
} from './contracts.js';
import {
  consequenceAdmissionDomainProfile,
} from './taxonomy.js';

function observedFeatureTrue(
  input: CreateGenericAdmissionInput,
  key: string,
): boolean {
  return input.observedFeatures?.[key] === true;
}

function observedFeatureHasTrustedOrigin(
  input: CreateGenericAdmissionInput,
  key: string,
): boolean {
  const origin = input.observedFeatureOrigins?.[key] ?? null;
  return origin !== null && GENERIC_ADMISSION_TRUSTED_OBSERVED_FEATURE_ORIGINS.has(origin);
}

function trustedObservedFeatureTrue(
  input: CreateGenericAdmissionInput,
  key: string,
): boolean {
  return observedFeatureTrue(input, key) && observedFeatureHasTrustedOrigin(input, key);
}

export function genericAdmissionHardInvariantReasonCodes(
  input: CreateGenericAdmissionInput,
): readonly string[] {
  const reasons: string[] = [];
  const profile = consequenceAdmissionDomainProfile(input.domain);

  if (!input.policyRef) reasons.push('policy-ref-missing');
  if ((input.evidenceRefs ?? []).length === 0) reasons.push('evidence-ref-missing');

  if (
    input.domain === 'money-movement' ||
    input.domain === 'programmable-money'
  ) {
    if (!input.amount) reasons.push('amount-scope-missing');
    if (!input.recipient) reasons.push('recipient-scope-missing');
  }

  if (input.domain === 'data-disclosure' && !input.dataScope) {
    reasons.push('data-scope-missing');
  }

  if (input.domain === 'authority-change' && !input.authorityMode) {
    reasons.push('authority-mode-missing');
  }

  if (profile.requiredChecks.includes('adapter-readiness')) {
    if (!observedFeatureTrue(input, 'adapterReady')) {
      reasons.push('adapter-readiness-missing');
    } else if (!trustedObservedFeatureTrue(input, 'adapterReady')) {
      reasons.push('adapter-readiness-origin-untrusted');
    }
  }

  if (input.domain === 'custom') {
    reasons.push('custom-domain-review-required');
  }

  return Object.freeze(reasons);
}

export function genericAdmissionHasHardBlockFeature(
  input: CreateGenericAdmissionInput,
): boolean {
  return observedFeatureTrue(input, 'policyBlocked') ||
    observedFeatureTrue(input, 'blocked') ||
    observedFeatureTrue(input, 'unsafe');
}

export function genericAdmissionHasNarrowFeature(
  input: CreateGenericAdmissionInput,
): boolean {
  return observedFeatureTrue(input, 'narrowRequired');
}

export interface ReduceGenericAdmissionShadowDecisionInput {
  readonly reviewReasons: readonly string[];
  readonly blockingGuardOutcomes: readonly boolean[];
  readonly narrowingGuardOutcomes: readonly boolean[];
}

export function reduceGenericAdmissionShadowDecision(
  input: ReduceGenericAdmissionShadowDecisionInput,
): GenericAdmissionShadowDecision {
  if (input.blockingGuardOutcomes.some(Boolean)) return 'would_block';
  if (input.reviewReasons.length > 0) return 'would_review';
  if (input.narrowingGuardOutcomes.some(Boolean)) return 'would_narrow';
  return 'would_admit';
}

export function effectiveDecisionForGenericAdmissionMode(
  mode: GenericAdmissionMode,
  shadowDecision: GenericAdmissionShadowDecision,
): ConsequenceAdmissionDecision {
  if (mode === 'observe' || mode === 'warn') return 'admit';
  if (mode === 'review') {
    return shadowDecision === 'would_admit' ? 'admit' : 'review';
  }
  if (shadowDecision === 'would_block') return 'block';
  if (shadowDecision === 'would_review') return 'review';
  if (shadowDecision === 'would_narrow') return 'narrow';
  return 'admit';
}
