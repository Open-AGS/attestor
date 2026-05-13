import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  type ConsequenceFailureControlBinding,
} from './failure-mode-control-bindings.js';

export const CONSEQUENCE_APPROVAL_PROVENANCE_GUARD_VERSION =
  'attestor.consequence-approval-provenance-guard.v1';

export const CONSEQUENCE_APPROVAL_SOURCE_KINDS = [
  'chat-message',
  'customer-email',
  'ticket-comment',
  'user-prompt',
  'external-document',
  'tool-output',
  'llm-summary',
  'approval-workflow',
  'reviewer-queue',
  'manual-review',
  'signed-approval',
  'idp-directory',
  'policy-control-plane',
] as const;
export type ConsequenceApprovalSourceKind =
  typeof CONSEQUENCE_APPROVAL_SOURCE_KINDS[number];

export const CONSEQUENCE_APPROVAL_TRUST_CLASSES = [
  'untrusted-content',
  'model-generated',
  'unverified-tool-output',
  'verified-workflow',
  'verified-reviewer',
  'signed-authority',
  'system-authority',
] as const;
export type ConsequenceApprovalTrustClass =
  typeof CONSEQUENCE_APPROVAL_TRUST_CLASSES[number];

export const CONSEQUENCE_APPROVAL_STATES = [
  'approved',
  'pending',
  'rejected',
  'revoked',
] as const;
export type ConsequenceApprovalState = typeof CONSEQUENCE_APPROVAL_STATES[number];

export const CONSEQUENCE_APPROVAL_GUARD_OUTCOMES = [
  'pass',
  'review',
  'block',
] as const;
export type ConsequenceApprovalGuardOutcome =
  typeof CONSEQUENCE_APPROVAL_GUARD_OUTCOMES[number];

export const CONSEQUENCE_APPROVAL_GUARD_REASON_CODES = [
  'approval-missing',
  'approval-source-missing',
  'approval-source-untrusted',
  'approval-model-generated',
  'approval-tool-output-unverified',
  'approval-state-not-approved',
  'approval-state-rejected-or-revoked',
  'reviewer-identity-missing',
  'reviewer-authority-missing',
  'approval-digest-missing',
  'approval-scope-missing',
  'approval-issued-at-missing',
  'approval-issued-at-invalid',
  'approval-expired',
  'approval-step-up-missing',
  'approval-duplicate-reviewer',
  'approval-count-insufficient',
  'approval-provenance-pass',
  'approval-review',
  'approval-block',
] as const;
export type ConsequenceApprovalGuardReasonCode =
  typeof CONSEQUENCE_APPROVAL_GUARD_REASON_CODES[number];

export interface ConsequenceApprovalProvenanceClaim {
  readonly approvalRef: string;
  readonly sourceKind: ConsequenceApprovalSourceKind;
  readonly state?: ConsequenceApprovalState | null;
  readonly sourceRef?: string | null;
  readonly reviewerRef?: string | null;
  readonly reviewerAuthorityDigest?: string | null;
  readonly approvalDigest?: string | null;
  readonly scopeDigest?: string | null;
  readonly issuedAt?: string | null;
  readonly expiresAt?: string | null;
  readonly trustClass?: ConsequenceApprovalTrustClass | null;
  readonly stepUpVerified?: boolean | null;
}

export interface EvaluateConsequenceApprovalProvenanceInput {
  readonly generatedAt?: string | null;
  readonly actionSurface?: string | null;
  readonly action?: string | null;
  readonly requiredApprovalCount?: number | null;
  readonly requireStepUp?: boolean | null;
  readonly approvals?: readonly ConsequenceApprovalProvenanceClaim[] | null;
}

export interface ConsequenceApprovalObservedClaim {
  readonly approvalRefDigest: string;
  readonly sourceKind: ConsequenceApprovalSourceKind;
  readonly trustClass: ConsequenceApprovalTrustClass;
  readonly state: ConsequenceApprovalState;
  readonly sourceRefDigest?: string;
  readonly reviewerRefDigest?: string;
  readonly reviewerAuthorityDigest?: string;
  readonly approvalDigest?: string;
  readonly scopeDigest?: string;
  readonly issuedAt?: string;
  readonly expiresAt?: string;
  readonly stepUpVerified: boolean;
  readonly outcome: ConsequenceApprovalGuardOutcome;
  readonly reasonCodes: readonly ConsequenceApprovalGuardReasonCode[];
}

export interface ConsequenceApprovalProvenanceDecision {
  readonly version: typeof CONSEQUENCE_APPROVAL_PROVENANCE_GUARD_VERSION;
  readonly generatedAt: string;
  readonly actionSurface?: string;
  readonly action?: string;
  readonly requiredApprovalCount: number;
  readonly requireStepUp: boolean;
  readonly outcome: ConsequenceApprovalGuardOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly ConsequenceApprovalGuardReasonCode[];
  readonly failureModeId: 'fake-approval-laundering';
  readonly invariantIds: readonly [
    'verified-approval-provenance-required',
    'untrusted-content-cannot-authorize-action',
    'human-review-packet-must-highlight-risk',
  ];
  readonly protectedPrinciples: readonly [
    'customer authority',
    'auditability',
    'proof integrity',
  ];
  readonly requiredControls: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly requiredAuthoritySources: readonly string[];
  readonly requiredAuditRecords: readonly string[];
  readonly counts: {
    readonly approvalCount: number;
    readonly validApprovalCount: number;
    readonly distinctReviewerCount: number;
    readonly reviewCount: number;
    readonly blockCount: number;
    readonly untrustedApprovalCount: number;
    readonly modelGeneratedApprovalCount: number;
    readonly missingReviewerCount: number;
    readonly missingApprovalDigestCount: number;
  };
  readonly observedApprovals: readonly ConsequenceApprovalObservedClaim[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceApprovalProvenanceGuardDescriptor {
  readonly version: typeof CONSEQUENCE_APPROVAL_PROVENANCE_GUARD_VERSION;
  readonly failureModeId: 'fake-approval-laundering';
  readonly sourceKinds: typeof CONSEQUENCE_APPROVAL_SOURCE_KINDS;
  readonly trustClasses: typeof CONSEQUENCE_APPROVAL_TRUST_CLASSES;
  readonly states: typeof CONSEQUENCE_APPROVAL_STATES;
  readonly outcomes: typeof CONSEQUENCE_APPROVAL_GUARD_OUTCOMES;
  readonly requiresReviewerIdentity: true;
  readonly requiresReviewerAuthorityDigest: true;
  readonly requiresApprovalDigest: true;
  readonly requiresScopeDigest: true;
  readonly rejectsChatEmailTicketApproval: true;
  readonly allowsModelSelfApproval: false;
  readonly storesRawApprovalText: false;
  readonly digestOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
}

const TRUST_CLASS_BY_SOURCE_KIND = {
  'chat-message': 'untrusted-content',
  'customer-email': 'untrusted-content',
  'ticket-comment': 'untrusted-content',
  'user-prompt': 'untrusted-content',
  'external-document': 'untrusted-content',
  'tool-output': 'unverified-tool-output',
  'llm-summary': 'model-generated',
  'approval-workflow': 'verified-workflow',
  'reviewer-queue': 'verified-reviewer',
  'manual-review': 'verified-reviewer',
  'signed-approval': 'signed-authority',
  'idp-directory': 'system-authority',
  'policy-control-plane': 'system-authority',
} as const satisfies Readonly<Record<ConsequenceApprovalSourceKind, ConsequenceApprovalTrustClass>>;

const TRUSTED_APPROVAL_CLASSES = new Set<ConsequenceApprovalTrustClass>([
  'verified-workflow',
  'verified-reviewer',
  'signed-authority',
  'system-authority',
]);

const UNTRUSTED_APPROVAL_CLASSES = new Set<ConsequenceApprovalTrustClass>([
  'untrusted-content',
  'model-generated',
  'unverified-tool-output',
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
  items: readonly ConsequenceApprovalGuardReasonCode[],
): readonly ConsequenceApprovalGuardReasonCode[] {
  return readonlyCopy([...new Set(items)]);
}

function isSha256Digest(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/iu.test(value);
}

function normalizeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function binding(): ConsequenceFailureControlBinding {
  const found = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find(
    (item) => item.failureModeId === 'fake-approval-laundering',
  );
  if (!found) {
    throw new Error('Missing control binding for fake-approval-laundering.');
  }
  return found;
}

function evaluateClaim(input: {
  readonly claim: ConsequenceApprovalProvenanceClaim;
  readonly generatedAt: string;
  readonly requireStepUp: boolean;
}): ConsequenceApprovalObservedClaim {
  const claim = input.claim;
  const trustClass = claim.trustClass ?? TRUST_CLASS_BY_SOURCE_KIND[claim.sourceKind];
  const state = claim.state ?? 'pending';
  const issuedAt = normalizeTimestamp(claim.issuedAt ?? null);
  const expiresAt = normalizeTimestamp(claim.expiresAt ?? null);
  const hasReviewer = typeof claim.reviewerRef === 'string' && claim.reviewerRef.trim().length > 0;
  const hasSource = typeof claim.sourceRef === 'string' && claim.sourceRef.trim().length > 0;
  const hasReviewerAuthority = isSha256Digest(claim.reviewerAuthorityDigest);
  const hasApprovalDigest = isSha256Digest(claim.approvalDigest);
  const hasScopeDigest = isSha256Digest(claim.scopeDigest);
  const stepUpVerified = claim.stepUpVerified ?? false;
  const reasonCodes: ConsequenceApprovalGuardReasonCode[] = [];

  if (!hasSource) reasonCodes.push('approval-source-missing');
  if (UNTRUSTED_APPROVAL_CLASSES.has(trustClass)) {
    if (trustClass === 'untrusted-content') reasonCodes.push('approval-source-untrusted');
    if (trustClass === 'model-generated') reasonCodes.push('approval-model-generated');
    if (trustClass === 'unverified-tool-output') reasonCodes.push('approval-tool-output-unverified');
  }
  if (state !== 'approved') {
    reasonCodes.push('approval-state-not-approved');
  }
  if (state === 'rejected' || state === 'revoked') {
    reasonCodes.push('approval-state-rejected-or-revoked');
  }
  if (!hasReviewer) reasonCodes.push('reviewer-identity-missing');
  if (!hasReviewerAuthority) reasonCodes.push('reviewer-authority-missing');
  if (!hasApprovalDigest) reasonCodes.push('approval-digest-missing');
  if (!hasScopeDigest) reasonCodes.push('approval-scope-missing');
  if (!claim.issuedAt) reasonCodes.push('approval-issued-at-missing');
  if (claim.issuedAt && !issuedAt) reasonCodes.push('approval-issued-at-invalid');
  if (expiresAt && new Date(expiresAt).getTime() <= new Date(input.generatedAt).getTime()) {
    reasonCodes.push('approval-expired');
  }
  if (input.requireStepUp && !stepUpVerified) {
    reasonCodes.push('approval-step-up-missing');
  }

  let outcome: ConsequenceApprovalGuardOutcome = 'pass';
  if (
    UNTRUSTED_APPROVAL_CLASSES.has(trustClass) ||
    state === 'rejected' ||
    state === 'revoked'
  ) {
    outcome = 'block';
    reasonCodes.push('approval-block');
  } else if (
    reasonCodes.length > 0 ||
    !TRUSTED_APPROVAL_CLASSES.has(trustClass) ||
    !hasSource ||
    !hasReviewer ||
    !hasReviewerAuthority ||
    !hasApprovalDigest ||
    !hasScopeDigest ||
    !issuedAt
  ) {
    outcome = 'review';
    reasonCodes.push('approval-review');
  } else {
    reasonCodes.push('approval-provenance-pass');
  }

  const observed: ConsequenceApprovalObservedClaim = {
    approvalRefDigest: digestRawRef(claim.approvalRef),
    sourceKind: claim.sourceKind,
    trustClass,
    state,
    ...(hasSource && claim.sourceRef ? { sourceRefDigest: digestRawRef(claim.sourceRef) } : {}),
    ...(hasReviewer && claim.reviewerRef ? { reviewerRefDigest: digestRawRef(claim.reviewerRef) } : {}),
    ...(hasReviewerAuthority ? { reviewerAuthorityDigest: claim.reviewerAuthorityDigest as string } : {}),
    ...(hasApprovalDigest ? { approvalDigest: claim.approvalDigest as string } : {}),
    ...(hasScopeDigest ? { scopeDigest: claim.scopeDigest as string } : {}),
    ...(issuedAt ? { issuedAt } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    stepUpVerified,
    outcome,
    reasonCodes: uniqueReasonCodes(reasonCodes),
  };
  return Object.freeze(observed);
}

function aggregateOutcome(input: {
  readonly results: readonly ConsequenceApprovalObservedClaim[];
  readonly requiredApprovalCount: number;
}): {
  readonly outcome: ConsequenceApprovalGuardOutcome;
  readonly reasonCodes: readonly ConsequenceApprovalGuardReasonCode[];
  readonly validApprovals: readonly ConsequenceApprovalObservedClaim[];
  readonly distinctReviewerCount: number;
} {
  const results = input.results;
  if (results.length === 0) {
    return Object.freeze({
      outcome: 'review',
      reasonCodes: uniqueReasonCodes(['approval-missing', 'approval-review']),
      validApprovals: [],
      distinctReviewerCount: 0,
    });
  }
  const validApprovals = results.filter((result) => result.outcome === 'pass');
  const reviewerDigests = validApprovals.flatMap((result) =>
    result.reviewerRefDigest ? [result.reviewerRefDigest] : [],
  );
  const distinctReviewerCount = new Set(reviewerDigests).size;
  const hasDuplicateReviewer =
    validApprovals.length >= input.requiredApprovalCount &&
    distinctReviewerCount < input.requiredApprovalCount;
  const hasBlock = results.some((result) => result.outcome === 'block');
  const hasReview = results.some((result) => result.outcome === 'review');

  if (hasDuplicateReviewer) {
    return Object.freeze({
      outcome: 'block',
      reasonCodes: uniqueReasonCodes(['approval-duplicate-reviewer', 'approval-block']),
      validApprovals,
      distinctReviewerCount,
    });
  }
  if (validApprovals.length < input.requiredApprovalCount) {
    return Object.freeze({
      outcome: hasBlock && validApprovals.length === 0 ? 'block' : 'review',
      reasonCodes: uniqueReasonCodes([
        'approval-count-insufficient',
        hasBlock ? 'approval-block' : 'approval-review',
      ]),
      validApprovals,
      distinctReviewerCount,
    });
  }
  if (hasBlock || hasReview) {
    return Object.freeze({
      outcome: 'review',
      reasonCodes: uniqueReasonCodes(['approval-review']),
      validApprovals,
      distinctReviewerCount,
    });
  }
  return Object.freeze({
    outcome: 'pass',
    reasonCodes: uniqueReasonCodes(['approval-provenance-pass']),
    validApprovals,
    distinctReviewerCount,
  });
}

export function evaluateConsequenceApprovalProvenance(
  input: EvaluateConsequenceApprovalProvenanceInput,
): ConsequenceApprovalProvenanceDecision {
  const generatedAt = input.generatedAt ?? new Date(0).toISOString();
  const requiredApprovalCount = Math.max(1, Math.trunc(input.requiredApprovalCount ?? 1));
  const requireStepUp = input.requireStepUp ?? false;
  const observedApprovals = readonlyCopy(
    (input.approvals ?? []).map((claim) =>
      evaluateClaim({ claim, generatedAt, requireStepUp }),
    ),
  );
  const aggregate = aggregateOutcome({ results: observedApprovals, requiredApprovalCount });
  const reasonCodes = uniqueReasonCodes([
    ...observedApprovals.flatMap((approval) => approval.reasonCodes),
    ...aggregate.reasonCodes,
  ]);
  const controlBinding = binding();
  const payload = {
    version: CONSEQUENCE_APPROVAL_PROVENANCE_GUARD_VERSION,
    generatedAt,
    ...(input.actionSurface ? { actionSurface: input.actionSurface } : {}),
    ...(input.action ? { action: input.action } : {}),
    requiredApprovalCount,
    requireStepUp,
    outcome: aggregate.outcome,
    allowed: aggregate.outcome === 'pass',
    failClosed: aggregate.outcome !== 'pass',
    reasonCodes,
    failureModeId: 'fake-approval-laundering',
    invariantIds: [
      'verified-approval-provenance-required',
      'untrusted-content-cannot-authorize-action',
      'human-review-packet-must-highlight-risk',
    ] as const,
    protectedPrinciples: [
      'customer authority',
      'auditability',
      'proof integrity',
    ] as const,
    requiredControls: controlBinding.controlIds,
    requiredEvidence: controlBinding.requiredEvidence,
    requiredAuthoritySources: controlBinding.requiredAuthority,
    requiredAuditRecords: controlBinding.requiredAuditRecords,
    counts: {
      approvalCount: observedApprovals.length,
      validApprovalCount: aggregate.validApprovals.length,
      distinctReviewerCount: aggregate.distinctReviewerCount,
      reviewCount: observedApprovals.filter((approval) => approval.outcome === 'review').length,
      blockCount: observedApprovals.filter((approval) => approval.outcome === 'block').length,
      untrustedApprovalCount: observedApprovals.filter(
        (approval) => approval.trustClass === 'untrusted-content',
      ).length,
      modelGeneratedApprovalCount: observedApprovals.filter(
        (approval) => approval.trustClass === 'model-generated',
      ).length,
      missingReviewerCount: observedApprovals.filter((approval) =>
        approval.reasonCodes.includes('reviewer-identity-missing'),
      ).length,
      missingApprovalDigestCount: observedApprovals.filter((approval) =>
        approval.reasonCodes.includes('approval-digest-missing'),
      ).length,
    },
    observedApprovals,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    limitation:
      'This guard classifies approval provenance. It does not prove every customer IdP, approval workflow, reviewer queue, or downstream verifier has integrated the guard.',
  } as const;
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}

export function consequenceApprovalProvenanceGuardDescriptor(): ConsequenceApprovalProvenanceGuardDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_APPROVAL_PROVENANCE_GUARD_VERSION,
    failureModeId: 'fake-approval-laundering',
    sourceKinds: CONSEQUENCE_APPROVAL_SOURCE_KINDS,
    trustClasses: CONSEQUENCE_APPROVAL_TRUST_CLASSES,
    states: CONSEQUENCE_APPROVAL_STATES,
    outcomes: CONSEQUENCE_APPROVAL_GUARD_OUTCOMES,
    requiresReviewerIdentity: true,
    requiresReviewerAuthorityDigest: true,
    requiresApprovalDigest: true,
    requiresScopeDigest: true,
    rejectsChatEmailTicketApproval: true,
    allowsModelSelfApproval: false,
    storesRawApprovalText: false,
    digestOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
  });
}
