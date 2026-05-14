import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  type ConsequenceFailureControlBinding,
} from './failure-mode-control-bindings.js';

export const CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_GUARD_VERSION =
  'attestor.consequence-untrusted-content-authority-guard.v1';

export const CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_SOURCE_KINDS = [
  'user-prompt',
  'customer-email',
  'external-document',
  'web-page',
  'chat-message',
  'ticket-comment',
  'tool-output',
  'llm-summary',
  'retrieved-content',
  'verified-approval',
  'approval-workflow',
  'customer-policy',
  'idp-directory',
  'authority-record',
  'manual-review',
  'signed-evidence',
  'provider-record',
  'system-config',
] as const;
export type ConsequenceUntrustedContentAuthoritySourceKind =
  typeof CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_SOURCE_KINDS[number];

export const CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_CLAIM_KINDS = [
  'authorization',
  'approval',
  'policy',
  'evidence',
  'context',
  'instruction',
] as const;
export type ConsequenceUntrustedContentAuthorityClaimKind =
  typeof CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_CLAIM_KINDS[number];

export const CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_TRUST_CLASSES = [
  'untrusted-content',
  'model-generated',
  'trusted-authority',
  'trusted-evidence',
  'trusted-system-context',
] as const;
export type ConsequenceUntrustedContentAuthorityTrustClass =
  typeof CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_TRUST_CLASSES[number];

export const CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_DECISIONS = [
  'pass',
  'review',
  'block',
] as const;
export type ConsequenceUntrustedContentAuthorityDecisionOutcome =
  typeof CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_DECISIONS[number];

export const CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_REASON_CODES = [
  'authority-source-missing',
  'untrusted-content-authority-source',
  'model-generated-authority-source',
  'trusted-authority-source-present',
  'trusted-evidence-not-authority',
  'authority-content-separated',
  'mixed-trusted-and-untrusted-authority-source',
  'trust-class-override-rejected',
  'trusted-authority-evidence-missing',
  'authority-pass',
  'authority-review-required',
  'authority-block',
] as const;
export type ConsequenceUntrustedContentAuthorityReasonCode =
  typeof CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_REASON_CODES[number];

export interface ConsequenceUntrustedContentAuthoritySource {
  readonly sourceKind: ConsequenceUntrustedContentAuthoritySourceKind;
  readonly claimKind: ConsequenceUntrustedContentAuthorityClaimKind;
  readonly sourceRef: string;
  readonly trustClass?: ConsequenceUntrustedContentAuthorityTrustClass | null;
  readonly evidenceDigest?: string | null;
}

export interface EvaluateConsequenceUntrustedContentAuthorityInput {
  readonly generatedAt?: string | null;
  readonly actionSurface?: string | null;
  readonly action?: string | null;
  readonly requiredAuthority?: boolean | null;
  readonly sources?: readonly ConsequenceUntrustedContentAuthoritySource[] | null;
}

export interface ConsequenceUntrustedContentAuthorityObservedSource {
  readonly sourceKind: ConsequenceUntrustedContentAuthoritySourceKind;
  readonly claimKind: ConsequenceUntrustedContentAuthorityClaimKind;
  readonly trustClass: ConsequenceUntrustedContentAuthorityTrustClass;
  readonly sourceRefDigest: string;
  readonly evidenceDigest?: string;
  readonly trustClassOverrideRejected: boolean;
  readonly trustEvidencePresent: boolean;
}

export interface ConsequenceUntrustedContentAuthorityDecision {
  readonly version: typeof CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_GUARD_VERSION;
  readonly generatedAt: string;
  readonly actionSurface?: string;
  readonly action?: string;
  readonly requiredAuthority: boolean;
  readonly outcome: ConsequenceUntrustedContentAuthorityDecisionOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly ConsequenceUntrustedContentAuthorityReasonCode[];
  readonly failureModeId: 'untrusted-content-authorizes-action';
  readonly invariantId: 'untrusted-content-cannot-authorize-action';
  readonly protectedPrinciples: readonly [
    'customer authority',
    'fail-closed boundary',
    'proof integrity',
  ];
  readonly requiredControls: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly requiredAuthoritySources: readonly string[];
  readonly requiredAuditRecords: readonly string[];
  readonly counts: {
    readonly sourceCount: number;
    readonly authorityClaimCount: number;
    readonly untrustedAuthoritySourceCount: number;
    readonly modelGeneratedAuthoritySourceCount: number;
    readonly trustedAuthoritySourceCount: number;
    readonly trustedAuthorityMissingEvidenceCount: number;
    readonly trustClassOverrideRejectedCount: number;
    readonly trustedEvidenceOnlyCount: number;
  };
  readonly observedSources: readonly ConsequenceUntrustedContentAuthorityObservedSource[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceUntrustedContentAuthorityGuardDescriptor {
  readonly version: typeof CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_GUARD_VERSION;
  readonly failureModeId: 'untrusted-content-authorizes-action';
  readonly invariantId: 'untrusted-content-cannot-authorize-action';
  readonly sourceKinds: typeof CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_SOURCE_KINDS;
  readonly claimKinds: typeof CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_CLAIM_KINDS;
  readonly trustClasses: typeof CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_TRUST_CLASSES;
  readonly decisions: typeof CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_DECISIONS;
  readonly blocksUntrustedAuthority: true;
  readonly allowsModelSelfApproval: false;
  readonly storesRawPayload: false;
  readonly digestOnly: true;
  readonly rejectsUntrustedPromotion: true;
  readonly requiresTrustedAuthorityEvidence: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
}

const TRUST_CLASS_BY_SOURCE_KIND = {
  'user-prompt': 'untrusted-content',
  'customer-email': 'untrusted-content',
  'external-document': 'untrusted-content',
  'web-page': 'untrusted-content',
  'chat-message': 'untrusted-content',
  'ticket-comment': 'untrusted-content',
  'tool-output': 'untrusted-content',
  'llm-summary': 'model-generated',
  'retrieved-content': 'untrusted-content',
  'verified-approval': 'trusted-authority',
  'approval-workflow': 'trusted-authority',
  'customer-policy': 'trusted-authority',
  'idp-directory': 'trusted-authority',
  'authority-record': 'trusted-authority',
  'manual-review': 'trusted-authority',
  'signed-evidence': 'trusted-evidence',
  'provider-record': 'trusted-evidence',
  'system-config': 'trusted-system-context',
} as const satisfies Readonly<
  Record<
    ConsequenceUntrustedContentAuthoritySourceKind,
    ConsequenceUntrustedContentAuthorityTrustClass
  >
>;

const AUTHORITY_CLAIM_KINDS = new Set<ConsequenceUntrustedContentAuthorityClaimKind>([
  'authorization',
  'approval',
  'policy',
]);

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function digestRawRef(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function readonlyCopy<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function uniqueReasonCodes(
  items: readonly ConsequenceUntrustedContentAuthorityReasonCode[],
): readonly ConsequenceUntrustedContentAuthorityReasonCode[] {
  return readonlyCopy([...new Set(items)]);
}

const UNTRUSTED_OR_MODEL_CLASSES = new Set<ConsequenceUntrustedContentAuthorityTrustClass>([
  'untrusted-content',
  'model-generated',
]);

const PROMOTION_TARGET_CLASSES = new Set<ConsequenceUntrustedContentAuthorityTrustClass>([
  'trusted-authority',
  'trusted-evidence',
  'trusted-system-context',
]);

function resolveTrustClass(
  sourceKind: ConsequenceUntrustedContentAuthoritySourceKind,
  suppliedTrustClass: ConsequenceUntrustedContentAuthorityTrustClass | null,
): {
  readonly trustClass: ConsequenceUntrustedContentAuthorityTrustClass;
  readonly overrideRejected: boolean;
} {
  const defaultTrustClass = TRUST_CLASS_BY_SOURCE_KIND[sourceKind];
  if (!suppliedTrustClass || suppliedTrustClass === defaultTrustClass) {
    return Object.freeze({ trustClass: defaultTrustClass, overrideRejected: false });
  }

  if (
    UNTRUSTED_OR_MODEL_CLASSES.has(defaultTrustClass) &&
    PROMOTION_TARGET_CLASSES.has(suppliedTrustClass)
  ) {
    return Object.freeze({ trustClass: defaultTrustClass, overrideRejected: true });
  }

  if (
    defaultTrustClass === 'trusted-evidence' &&
    suppliedTrustClass !== 'untrusted-content' &&
    suppliedTrustClass !== 'model-generated'
  ) {
    return Object.freeze({ trustClass: defaultTrustClass, overrideRejected: true });
  }

  if (
    defaultTrustClass === 'trusted-authority' &&
    suppliedTrustClass === 'trusted-system-context'
  ) {
    return Object.freeze({ trustClass: defaultTrustClass, overrideRejected: true });
  }

  return Object.freeze({ trustClass: suppliedTrustClass, overrideRejected: false });
}

function normalizedSource(
  source: ConsequenceUntrustedContentAuthoritySource,
): ConsequenceUntrustedContentAuthorityObservedSource {
  const suppliedTrustClass = source.trustClass ?? null;
  const { trustClass, overrideRejected } = resolveTrustClass(source.sourceKind, suppliedTrustClass);
  const trustEvidencePresent =
    typeof source.evidenceDigest === 'string' && source.evidenceDigest.trim().length > 0;
  const observed: ConsequenceUntrustedContentAuthorityObservedSource = {
    sourceKind: source.sourceKind,
    claimKind: source.claimKind,
    trustClass,
    sourceRefDigest: digestRawRef(source.sourceRef),
    ...(source.evidenceDigest ? { evidenceDigest: source.evidenceDigest } : {}),
    trustClassOverrideRejected: overrideRejected,
    trustEvidencePresent,
  };
  return Object.freeze(observed);
}

function evaluateOutcome(params: {
  readonly requiredAuthority: boolean;
  readonly authorityClaimCount: number;
  readonly untrustedAuthoritySourceCount: number;
  readonly modelGeneratedAuthoritySourceCount: number;
  readonly trustedAuthoritySourceCount: number;
  readonly trustedAuthorityMissingEvidenceCount: number;
  readonly trustClassOverrideRejectedCount: number;
}): ConsequenceUntrustedContentAuthorityDecisionOutcome {
  const unsafeAuthoritySourceCount =
    params.untrustedAuthoritySourceCount + params.modelGeneratedAuthoritySourceCount;
  if (unsafeAuthoritySourceCount > 0 && params.trustedAuthoritySourceCount === 0) {
    return 'block';
  }
  if (params.trustClassOverrideRejectedCount > 0) {
    return 'review';
  }
  if (unsafeAuthoritySourceCount > 0 && params.trustedAuthoritySourceCount > 0) {
    return 'review';
  }
  if (params.trustedAuthorityMissingEvidenceCount > 0) {
    return 'review';
  }
  if (params.requiredAuthority && params.trustedAuthoritySourceCount === 0) {
    return 'review';
  }
  if (params.authorityClaimCount === 0 && params.requiredAuthority) {
    return 'review';
  }
  return 'pass';
}

function decisionReasonCodes(params: {
  readonly outcome: ConsequenceUntrustedContentAuthorityDecisionOutcome;
  readonly authorityClaimCount: number;
  readonly untrustedAuthoritySourceCount: number;
  readonly modelGeneratedAuthoritySourceCount: number;
  readonly trustedAuthoritySourceCount: number;
  readonly trustedAuthorityMissingEvidenceCount: number;
  readonly trustClassOverrideRejectedCount: number;
  readonly trustedEvidenceOnlyCount: number;
}): readonly ConsequenceUntrustedContentAuthorityReasonCode[] {
  const codes: ConsequenceUntrustedContentAuthorityReasonCode[] = [];
  if (params.authorityClaimCount === 0 || params.trustedAuthoritySourceCount === 0) {
    codes.push('authority-source-missing');
  }
  if (params.untrustedAuthoritySourceCount > 0) {
    codes.push('untrusted-content-authority-source');
  }
  if (params.modelGeneratedAuthoritySourceCount > 0) {
    codes.push('model-generated-authority-source');
  }
  if (params.trustedAuthoritySourceCount > 0) {
    codes.push('trusted-authority-source-present');
  }
  if (params.trustClassOverrideRejectedCount > 0) {
    codes.push('trust-class-override-rejected');
  }
  if (params.trustedAuthorityMissingEvidenceCount > 0) {
    codes.push('trusted-authority-evidence-missing');
  }
  if (params.trustedEvidenceOnlyCount > 0 && params.trustedAuthoritySourceCount === 0) {
    codes.push('trusted-evidence-not-authority');
  }
  if (
    (params.untrustedAuthoritySourceCount > 0 || params.modelGeneratedAuthoritySourceCount > 0) &&
    params.trustedAuthoritySourceCount > 0
  ) {
    codes.push('mixed-trusted-and-untrusted-authority-source');
  }
  if (params.outcome === 'block') {
    codes.push('authority-block');
  } else if (params.outcome === 'review') {
    codes.push('authority-review-required');
  } else {
    codes.push('authority-content-separated', 'authority-pass');
  }
  return uniqueReasonCodes(codes);
}

function failureModeBinding(): ConsequenceFailureControlBinding {
  const binding = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find(
    (item) => item.failureModeId === 'untrusted-content-authorizes-action',
  );
  if (!binding) {
    throw new Error('Missing control binding for untrusted-content-authorizes-action.');
  }
  return binding;
}

export function evaluateConsequenceUntrustedContentAuthority(
  input: EvaluateConsequenceUntrustedContentAuthorityInput,
): ConsequenceUntrustedContentAuthorityDecision {
  const requiredAuthority = input.requiredAuthority ?? true;
  const observedSources = readonlyCopy((input.sources ?? []).map((source) => normalizedSource(source)));
  const authorityClaims = observedSources.filter((source) =>
    AUTHORITY_CLAIM_KINDS.has(source.claimKind),
  );
  const untrustedAuthoritySources = authorityClaims.filter(
    (source) => source.trustClass === 'untrusted-content',
  );
  const modelGeneratedAuthoritySources = authorityClaims.filter(
    (source) => source.trustClass === 'model-generated',
  );
  const trustedAuthoritySources = authorityClaims.filter(
    (source) => source.trustClass === 'trusted-authority',
  );
  const trustedAuthorityMissingEvidenceSources = trustedAuthoritySources.filter(
    (source) => !source.trustEvidencePresent,
  );
  const trustClassOverrideRejectedSources = observedSources.filter(
    (source) => source.trustClassOverrideRejected,
  );
  const trustedEvidenceOnlySources = observedSources.filter(
    (source) =>
      source.trustClass === 'trusted-evidence' &&
      !AUTHORITY_CLAIM_KINDS.has(source.claimKind),
  );
  const outcome = evaluateOutcome({
    requiredAuthority,
    authorityClaimCount: authorityClaims.length,
    untrustedAuthoritySourceCount: untrustedAuthoritySources.length,
    modelGeneratedAuthoritySourceCount: modelGeneratedAuthoritySources.length,
    trustedAuthoritySourceCount: trustedAuthoritySources.length,
    trustedAuthorityMissingEvidenceCount: trustedAuthorityMissingEvidenceSources.length,
    trustClassOverrideRejectedCount: trustClassOverrideRejectedSources.length,
  });
  const binding = failureModeBinding();
  const payload = {
    version: CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_GUARD_VERSION,
    generatedAt: input.generatedAt ?? new Date(0).toISOString(),
    ...(input.actionSurface ? { actionSurface: input.actionSurface } : {}),
    ...(input.action ? { action: input.action } : {}),
    requiredAuthority,
    outcome,
    allowed: outcome === 'pass',
    failClosed: outcome !== 'pass',
    reasonCodes: decisionReasonCodes({
      outcome,
      authorityClaimCount: authorityClaims.length,
      untrustedAuthoritySourceCount: untrustedAuthoritySources.length,
      modelGeneratedAuthoritySourceCount: modelGeneratedAuthoritySources.length,
      trustedAuthoritySourceCount: trustedAuthoritySources.length,
      trustedAuthorityMissingEvidenceCount: trustedAuthorityMissingEvidenceSources.length,
      trustClassOverrideRejectedCount: trustClassOverrideRejectedSources.length,
      trustedEvidenceOnlyCount: trustedEvidenceOnlySources.length,
    }),
    failureModeId: 'untrusted-content-authorizes-action',
    invariantId: 'untrusted-content-cannot-authorize-action',
    protectedPrinciples: [
      'customer authority',
      'fail-closed boundary',
      'proof integrity',
    ] as const,
    requiredControls: binding.controlIds,
    requiredEvidence: binding.requiredEvidence,
    requiredAuthoritySources: binding.requiredAuthority,
    requiredAuditRecords: binding.requiredAuditRecords,
    counts: {
      sourceCount: observedSources.length,
      authorityClaimCount: authorityClaims.length,
      untrustedAuthoritySourceCount: untrustedAuthoritySources.length,
      modelGeneratedAuthoritySourceCount: modelGeneratedAuthoritySources.length,
      trustedAuthoritySourceCount: trustedAuthoritySources.length,
      trustedAuthorityMissingEvidenceCount: trustedAuthorityMissingEvidenceSources.length,
      trustClassOverrideRejectedCount: trustClassOverrideRejectedSources.length,
      trustedEvidenceOnlyCount: trustedEvidenceOnlySources.length,
    },
    observedSources,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    limitation:
      'This guard classifies content-as-authority claims and produces digest-only decisions. It does not prove every admission, review, or downstream surface has integrated the guard.',
  } as const;
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}

export function consequenceUntrustedContentAuthorityGuardDescriptor(): ConsequenceUntrustedContentAuthorityGuardDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_GUARD_VERSION,
    failureModeId: 'untrusted-content-authorizes-action',
    invariantId: 'untrusted-content-cannot-authorize-action',
    sourceKinds: CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_SOURCE_KINDS,
    claimKinds: CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_CLAIM_KINDS,
    trustClasses: CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_TRUST_CLASSES,
    decisions: CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_DECISIONS,
    blocksUntrustedAuthority: true,
    allowsModelSelfApproval: false,
    storesRawPayload: false,
    digestOnly: true,
    rejectsUntrustedPromotion: true,
    requiresTrustedAuthorityEvidence: true,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
  });
}
