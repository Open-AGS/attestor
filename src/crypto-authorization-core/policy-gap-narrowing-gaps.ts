import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationPolicyDimension } from './types.js';
import type {
  CryptoIntelligenceEvidenceRef,
  CryptoIntelligenceMissingEvidenceClass,
  CryptoIntelligenceRiskSignal,
  CryptoIntelligenceRiskSignalAssessment,
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals.js';
import {
  CRYPTO_NARROWING_CANDIDATE_KINDS,
  type CryptoNarrowingCandidate,
  type CryptoNarrowingCandidateKind,
  type CryptoNarrowingScopeKind,
  type CryptoPolicyDimensionCoverage,
  type CryptoPolicyDimensionCoverageStatus,
  type CryptoPolicyGap,
  type CryptoPolicyGapClass,
  type CryptoPolicyCoverageProfile,
} from './policy-gap-narrowing-types.js';
import {
  DISPOSITION_RANK,
  SEVERITY_RANK,
  canonicalObject,
  includesValue,
  safeEvidenceRefs,
  safeReasonCodes,
  strongerDisposition,
  strongerSeverity,
  unique,
} from './policy-gap-narrowing-utils.js';

function gapClassForSignal(signal: CryptoIntelligenceRiskSignal): CryptoPolicyGapClass {
  if (signal.missingEvidenceClasses.includes('adapter-preflight')) {
    return 'adapter-readiness-missing';
  }
  if (signal.missingEvidenceClasses.includes('freshness-window')) {
    return 'freshness-window-missing';
  }
  if (
    signal.missingEvidenceClasses.includes('delegation-authorization') ||
    signal.missingEvidenceClasses.includes('delegation-nonce')
  ) {
    return 'delegation-boundary-unsafe';
  }
  if (
    signal.missingEvidenceClasses.includes('custody-policy-decision') ||
    signal.missingEvidenceClasses.includes('custody-quorum')
  ) {
    return 'custody-control-missing';
  }
  if (
    signal.missingEvidenceClasses.includes('x402-payment-requirement') ||
    signal.missingEvidenceClasses.includes('x402-payment-signature') ||
    signal.missingEvidenceClasses.includes('x402-payment-response')
  ) {
    return 'payment-binding-missing';
  }
  if (signal.missingEvidenceClasses.includes('solver-settlement-preflight')) {
    return 'solver-settlement-missing';
  }
  if (signal.missingEvidenceClasses.includes('route-commitment')) {
    return 'route-boundary-unsafe';
  }
  if (signal.missingEvidenceClasses.includes('revocation-path')) {
    return signal.category === 'delegation'
      ? 'delegation-boundary-unsafe'
      : 'allowance-boundary-unsafe';
  }
  if (signal.missingEvidenceClasses.includes('counterparty')) {
    return 'counterparty-boundary-unsafe';
  }
  if (signal.missingEvidenceClasses.includes('amount')) {
    return 'amount-boundary-unsafe';
  }
  if (signal.missingEvidenceClasses.includes('policy-dimension')) {
    return 'policy-dimension-missing';
  }

  if (signal.category === 'amount') return 'amount-boundary-unsafe';
  if (signal.category === 'counterparty') return 'counterparty-boundary-unsafe';
  if (signal.category === 'route') return 'route-boundary-unsafe';
  if (signal.category === 'allowance') return 'allowance-boundary-unsafe';
  if (signal.category === 'delegation') return 'delegation-boundary-unsafe';
  if (signal.category === 'custody') return 'custody-control-missing';
  if (signal.category === 'x402') return 'payment-binding-missing';
  if (signal.category === 'solver') return 'solver-settlement-missing';
  if (signal.category === 'freshness') return 'freshness-window-missing';
  if (signal.category === 'velocity') return 'velocity-boundary-unsafe';
  if (signal.disposition === 'review') return 'authority-review-required';

  return 'evidence-missing';
}

function summaryForGapClass(gapClass: CryptoPolicyGapClass): string {
  switch (gapClass) {
    case 'policy-dimension-missing':
      return 'Policy dimensions are missing; bind the required dimensions before enforcement.';
    case 'policy-explicit-deny':
      return 'Policy explicitly denies this consequence; block until customer-approved policy coverage changes.';
    case 'policy-implicit-deny':
      return 'Policy falls through implicit deny; block until an explicit allow policy matches the scoped consequence.';
    case 'policy-conflict':
      return 'Policy evidence is conflicting; resolve the customer-controlled policy conflict before enforcement.';
    case 'policy-evidence-stale':
      return 'Policy coverage evidence is stale; collect fresh digest-bound policy evidence before enforcement.';
    case 'evidence-missing':
      return 'Required evidence is missing; collect digest-bound evidence before execution.';
    case 'adapter-readiness-missing':
      return 'Adapter readiness is missing; run the required preflight before handoff.';
    case 'freshness-window-missing':
      return 'Freshness evidence is missing or stale; bind a valid freshness window.';
    case 'authority-review-required':
      return 'Review authority is required before this consequence can proceed.';
    case 'amount-boundary-unsafe':
      return 'Amount scope is unsafe or insufficiently bounded; narrow the amount band or hold for review.';
    case 'counterparty-boundary-unsafe':
      return 'Counterparty scope is unsafe or missing; bind an approved counterparty scope.';
    case 'route-boundary-unsafe':
      return 'Route scope is unsafe or missing; bind route, refund, and settlement evidence.';
    case 'allowance-boundary-unsafe':
      return 'Allowance scope is unsafe; bind spender, expiry, and revocation controls.';
    case 'delegation-boundary-unsafe':
      return 'Delegation scope is unsafe; bind authorization, nonce, delegate code, and revocation evidence.';
    case 'custody-control-missing':
      return 'Custody controls are missing; bind policy decision and quorum evidence.';
    case 'payment-binding-missing':
      return 'Payment binding is missing; bind x402 requirement, signature, and response evidence.';
    case 'solver-settlement-missing':
      return 'Solver settlement evidence is missing; bind route and settlement preflight evidence.';
    case 'velocity-boundary-unsafe':
      return 'Velocity scope is unsafe; reduce cadence or route the consequence to review.';
  }
}

function gapIdFor(input: {
  readonly sourceSignalAssessmentDigest: string;
  readonly gapClass: CryptoPolicyGapClass;
  readonly sourceSignalCodes: readonly string[];
  readonly requiredPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
}): string {
  return `crypto-policy-gap:${canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest}`;
}

interface MutableGap {
  gapClass: CryptoPolicyGapClass;
  severity: CryptoIntelligenceSignalSeverity;
  disposition: CryptoIntelligenceSignalDisposition;
  sourceSignalCodes: Set<string>;
  requiredPolicyDimensions: Set<CryptoAuthorizationPolicyDimension>;
  missingEvidenceClasses: Set<CryptoIntelligenceMissingEvidenceClass>;
  evidenceRefs: CryptoIntelligenceEvidenceRef[];
}

function mutableGapFromSignal(signal: CryptoIntelligenceRiskSignal): MutableGap {
  return {
    gapClass: gapClassForSignal(signal),
    severity: signal.severity,
    disposition: signal.disposition,
    sourceSignalCodes: new Set([signal.code]),
    requiredPolicyDimensions: new Set(signal.requiredPolicyDimensions),
    missingEvidenceClasses: new Set(signal.missingEvidenceClasses),
    evidenceRefs: [...safeEvidenceRefs(signal.evidenceRefs)],
  };
}

function gapKey(gap: MutableGap): string {
  return [
    gap.gapClass,
    [...gap.requiredPolicyDimensions].sort().join(','),
    [...gap.missingEvidenceClasses].sort().join(','),
  ].join('|');
}

function addSignalGap(
  gaps: Map<string, MutableGap>,
  signal: CryptoIntelligenceRiskSignal,
): void {
  const next = mutableGapFromSignal(signal);
  const key = gapKey(next);
  const current = gaps.get(key);
  if (!current) {
    gaps.set(key, next);
    return;
  }

  current.severity = strongerSeverity(current.severity, next.severity);
  current.disposition = strongerDisposition(current.disposition, next.disposition);
  current.sourceSignalCodes.add(signal.code);
  for (const dimension of signal.requiredPolicyDimensions) {
    current.requiredPolicyDimensions.add(dimension);
  }
  for (const evidenceClass of signal.missingEvidenceClasses) {
    current.missingEvidenceClasses.add(evidenceClass);
  }
  current.evidenceRefs.push(...safeEvidenceRefs(signal.evidenceRefs));
}

function freezeGap(
  sourceSignalAssessmentDigest: string,
  gap: MutableGap,
): CryptoPolicyGap {
  const sourceSignalCodes = unique([...gap.sourceSignalCodes]);
  const requiredPolicyDimensions = unique([...gap.requiredPolicyDimensions]);
  const missingEvidenceClasses = unique([...gap.missingEvidenceClasses]);
  const frozen = Object.freeze({
    gapId: gapIdFor({
      sourceSignalAssessmentDigest,
      gapClass: gap.gapClass,
      sourceSignalCodes,
      requiredPolicyDimensions,
      missingEvidenceClasses,
    }),
    gapClass: gap.gapClass,
    severity: gap.severity,
    disposition: gap.disposition,
    sourceSignalCodes,
    requiredPolicyDimensions,
    missingEvidenceClasses,
    evidenceRefs: safeEvidenceRefs(gap.evidenceRefs),
    modelSafeSummary: summaryForGapClass(gap.gapClass),
    blocksAdmission: gap.disposition === 'block',
  });

  return frozen;
}

export function gapsFromSignals(
  sourceSignalAssessmentDigest: string,
  signals: readonly CryptoIntelligenceRiskSignal[],
): readonly CryptoPolicyGap[] {
  const gaps = new Map<string, MutableGap>();
  for (const signal of signals) {
    if (
      signal.disposition === 'admit' &&
      signal.missingEvidenceClasses.length === 0 &&
      signal.requiredPolicyDimensions.length === 0
    ) {
      continue;
    }
    addSignalGap(gaps, signal);
  }

  return Object.freeze(
    [...gaps.values()]
      .map((gap) => freezeGap(sourceSignalAssessmentDigest, gap))
      .sort((left, right) => {
        const dispositionDelta =
          DISPOSITION_RANK[right.disposition] - DISPOSITION_RANK[left.disposition];
        if (dispositionDelta !== 0) return dispositionDelta;
        const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
        if (severityDelta !== 0) return severityDelta;
        return left.gapClass.localeCompare(right.gapClass);
      }),
  );
}

function gapClassForCoverageStatus(
  status: CryptoPolicyDimensionCoverageStatus,
): CryptoPolicyGapClass | null {
  switch (status) {
    case 'covered':
      return null;
    case 'missing':
      return 'policy-dimension-missing';
    case 'stale':
      return 'policy-evidence-stale';
    case 'conflicting':
      return 'policy-conflict';
    case 'explicit-deny':
      return 'policy-explicit-deny';
    case 'implicit-deny':
      return 'policy-implicit-deny';
    case 'review-required':
      return 'authority-review-required';
  }
}

function missingEvidenceForCoverageStatus(
  status: CryptoPolicyDimensionCoverageStatus,
): readonly CryptoIntelligenceMissingEvidenceClass[] {
  switch (status) {
    case 'missing':
      return Object.freeze(['policy-dimension'] as const);
    case 'stale':
      return Object.freeze(['freshness-window'] as const);
    case 'covered':
    case 'conflicting':
    case 'explicit-deny':
    case 'implicit-deny':
    case 'review-required':
      return Object.freeze([]);
  }
}

function gapFromCoverageEntry(
  profileDigest: string,
  entry: CryptoPolicyDimensionCoverage,
): CryptoPolicyGap | null {
  const gapClass = gapClassForCoverageStatus(entry.status);
  if (gapClass === null) return null;
  const sourceSignalCodes = safeReasonCodes(entry.reasonCodes);
  const missingEvidenceClasses = missingEvidenceForCoverageStatus(entry.status);
  const evidenceRefs = safeEvidenceRefs([
    ...entry.evidenceRefs,
    {
      kind: 'digest',
      value: profileDigest,
    },
  ]);

  return Object.freeze({
    gapId: gapIdFor({
      sourceSignalAssessmentDigest: profileDigest,
      gapClass,
      sourceSignalCodes,
      requiredPolicyDimensions: [entry.dimension],
      missingEvidenceClasses,
    }),
    gapClass,
    severity: entry.disposition === 'block' ? 'critical' : 'warning',
    disposition: entry.disposition,
    sourceSignalCodes,
    requiredPolicyDimensions: Object.freeze([entry.dimension]),
    missingEvidenceClasses,
    evidenceRefs,
    modelSafeSummary: summaryForGapClass(gapClass),
    blocksAdmission: entry.disposition === 'block',
  });
}

export function gapsFromPolicyCoverageProfile(
  profile: CryptoPolicyCoverageProfile | null,
): readonly CryptoPolicyGap[] {
  if (profile === null) return Object.freeze([]);
  return Object.freeze(
    profile.entries
      .map((entry) => gapFromCoverageEntry(profile.digest, entry))
      .filter((entry): entry is CryptoPolicyGap => entry !== null),
  );
}

export function sortGaps(gaps: readonly CryptoPolicyGap[]): readonly CryptoPolicyGap[] {
  return Object.freeze(
    [...gaps].sort((left, right) => {
      const dispositionDelta =
        DISPOSITION_RANK[right.disposition] - DISPOSITION_RANK[left.disposition];
      if (dispositionDelta !== 0) return dispositionDelta;
      const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
      if (severityDelta !== 0) return severityDelta;
      return left.gapClass.localeCompare(right.gapClass);
    }),
  );
}

function candidateKindForGap(gap: CryptoPolicyGap): CryptoNarrowingCandidateKind {
  switch (gap.gapClass) {
    case 'policy-dimension-missing':
      return 'bind-policy-dimension';
    case 'policy-explicit-deny':
    case 'policy-implicit-deny':
    case 'policy-conflict':
      return 'block-until-policy';
    case 'policy-evidence-stale':
      return 'collect-evidence';
    case 'evidence-missing':
      return 'collect-evidence';
    case 'adapter-readiness-missing':
      return 'run-adapter-preflight';
    case 'freshness-window-missing':
      return 'shorten-validity-window';
    case 'authority-review-required':
      return 'route-to-review';
    case 'amount-boundary-unsafe':
      return 'lower-amount-band';
    case 'counterparty-boundary-unsafe':
      return 'bind-counterparty-scope';
    case 'route-boundary-unsafe':
      return 'bind-route-commitment';
    case 'allowance-boundary-unsafe':
      return gap.missingEvidenceClasses.includes('revocation-path')
        ? 'bind-revocation-path'
        : 'shorten-validity-window';
    case 'delegation-boundary-unsafe':
      return gap.missingEvidenceClasses.includes('revocation-path')
        ? 'bind-revocation-path'
        : 'collect-evidence';
    case 'custody-control-missing':
      return 'bind-custody-quorum';
    case 'payment-binding-missing':
      return 'bind-payment-proof';
    case 'solver-settlement-missing':
      return 'bind-settlement-proof';
    case 'velocity-boundary-unsafe':
      return 'reduce-operation-count';
  }
}

function scopeKindForCandidate(
  candidateKind: CryptoNarrowingCandidateKind,
): CryptoNarrowingScopeKind {
  switch (candidateKind) {
    case 'collect-evidence':
      return 'policy';
    case 'bind-policy-dimension':
      return 'policy';
    case 'lower-amount-band':
      return 'amount';
    case 'shorten-validity-window':
      return 'validity-window';
    case 'reduce-operation-count':
      return 'operation-count';
    case 'bind-counterparty-scope':
      return 'counterparty';
    case 'bind-route-commitment':
      return 'route';
    case 'bind-revocation-path':
      return 'revocation';
    case 'bind-custody-quorum':
      return 'custody';
    case 'bind-payment-proof':
      return 'payment';
    case 'bind-settlement-proof':
      return 'settlement';
    case 'run-adapter-preflight':
      return 'adapter-preflight';
    case 'route-to-review':
      return 'review-only';
    case 'block-until-policy':
      return 'policy';
  }
}

function safeInstructionForCandidate(
  candidateKind: CryptoNarrowingCandidateKind,
): string {
  switch (candidateKind) {
    case 'collect-evidence':
      return 'Collect the named evidence class by digest or scoped reference before retrying.';
    case 'bind-policy-dimension':
      return 'Bind the missing policy dimension through the customer-controlled policy workflow.';
    case 'lower-amount-band':
      return 'Retry only with a lower operator-approved amount band; do not infer the private limit.';
    case 'shorten-validity-window':
      return 'Retry only with a shorter operator-approved validity window and fresh evidence.';
    case 'reduce-operation-count':
      return 'Retry only with fewer operations or lower cadence, then route to review if still uncertain.';
    case 'bind-counterparty-scope':
      return 'Bind the counterparty to an approved scoped reference before retrying.';
    case 'bind-route-commitment':
      return 'Bind route, refund, and settlement commitments by digest before retrying.';
    case 'bind-revocation-path':
      return 'Bind revocation or reset evidence before any allowance or delegation execution.';
    case 'bind-custody-quorum':
      return 'Bind custody policy decision and quorum evidence before retrying.';
    case 'bind-payment-proof':
      return 'Bind payment requirement, signature, response, and idempotency evidence by digest.';
    case 'bind-settlement-proof':
      return 'Bind solver route and settlement preflight evidence by digest.';
    case 'run-adapter-preflight':
      return 'Run the required adapter preflight and attach only digest or reason-code evidence.';
    case 'route-to-review':
      return 'Route this consequence to human review; do not ask the model to search for a passing variant.';
    case 'block-until-policy':
      return 'Block this consequence until customer-approved policy coverage exists.';
  }
}

function operatorActionForCandidate(
  candidateKind: CryptoNarrowingCandidateKind,
): string {
  switch (candidateKind) {
    case 'collect-evidence':
      return 'collect-digest-bound-evidence';
    case 'bind-policy-dimension':
      return 'draft-or-activate-policy-dimension';
    case 'lower-amount-band':
      return 'approve-lower-amount-scope';
    case 'shorten-validity-window':
      return 'approve-shorter-validity-window';
    case 'reduce-operation-count':
      return 'approve-lower-cadence-or-batch-size';
    case 'bind-counterparty-scope':
      return 'approve-counterparty-scope';
    case 'bind-route-commitment':
      return 'approve-route-and-refund-scope';
    case 'bind-revocation-path':
      return 'approve-revocation-or-reset-path';
    case 'bind-custody-quorum':
      return 'approve-custody-policy-and-quorum';
    case 'bind-payment-proof':
      return 'approve-payment-evidence-binding';
    case 'bind-settlement-proof':
      return 'approve-settlement-evidence-binding';
    case 'run-adapter-preflight':
      return 'run-adapter-preflight';
    case 'route-to-review':
      return 'send-to-human-review';
    case 'block-until-policy':
      return 'block-until-policy-approved';
  }
}

function candidateIdFor(input: {
  readonly sourceSignalAssessmentDigest: string;
  readonly kind: CryptoNarrowingCandidateKind;
  readonly scopeKind: CryptoNarrowingScopeKind;
  readonly sourceGapIds: readonly string[];
  readonly sourceSignalCodes: readonly string[];
}): string {
  return `crypto-narrowing-candidate:${canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest}`;
}

function candidateFromGap(gap: CryptoPolicyGap): CryptoNarrowingCandidate {
  const kind = gap.gapClass === 'policy-dimension-missing' &&
    gap.disposition === 'block' &&
    gap.requiredPolicyDimensions.length > 0 &&
    gap.missingEvidenceClasses.length === 0
    ? 'block-until-policy'
    : candidateKindForGap(gap);
  const scopeKind = scopeKindForCandidate(kind);
  const safeInstruction = safeInstructionForCandidate(kind);
  const candidate = Object.freeze({
    candidateId: candidateIdFor({
      sourceSignalAssessmentDigest: gap.evidenceRefs[0]?.value ?? gap.gapId,
      kind,
      scopeKind,
      sourceGapIds: [gap.gapId],
      sourceSignalCodes: gap.sourceSignalCodes,
    }),
    kind,
    scopeKind,
    approvalRequired: true,
    autoApply: false,
    sourceGapIds: Object.freeze([gap.gapId]),
    sourceSignalCodes: gap.sourceSignalCodes,
    requiredPolicyDimensions: gap.requiredPolicyDimensions,
    missingEvidenceClasses: gap.missingEvidenceClasses,
    safeInstruction,
    operatorAction: operatorActionForCandidate(kind),
    modelFeedback: Object.freeze({
      reasonCodes: gap.sourceSignalCodes,
      missingEvidenceClasses: gap.missingEvidenceClasses,
      safeInstruction,
    }),
    evidenceRefs: gap.evidenceRefs,
    rawPolicyThresholdExposed: false,
    rawPayloadRequired: false,
  } satisfies CryptoNarrowingCandidate);

  return candidate;
}

export function allowedCandidateSet(
  allowed: readonly CryptoNarrowingCandidateKind[] | null | undefined,
): Set<CryptoNarrowingCandidateKind> | null {
  if (allowed === undefined || allowed === null) return null;
  const output = new Set<CryptoNarrowingCandidateKind>();
  for (const candidateKind of allowed) {
    if (!includesValue(CRYPTO_NARROWING_CANDIDATE_KINDS, candidateKind)) {
      throw new Error(`Crypto policy gap narrowing does not support candidate kind ${candidateKind}.`);
    }
    output.add(candidateKind);
  }
  return output;
}

export function candidatesFromGaps(
  gaps: readonly CryptoPolicyGap[],
  allowed: Set<CryptoNarrowingCandidateKind> | null,
): readonly CryptoNarrowingCandidate[] {
  const candidates = gaps
    .map(candidateFromGap)
    .filter((candidate) => allowed === null || allowed.has(candidate.kind));

  return Object.freeze(
    candidates.sort((left, right) => {
      const leftBlock = left.kind === 'block-until-policy' ? 1 : 0;
      const rightBlock = right.kind === 'block-until-policy' ? 1 : 0;
      if (leftBlock !== rightBlock) return rightBlock - leftBlock;
      return left.kind.localeCompare(right.kind);
    }),
  );
}

export function overallDisposition(
  signalAssessment: CryptoIntelligenceRiskSignalAssessment,
  gaps: readonly CryptoPolicyGap[],
): CryptoIntelligenceSignalDisposition {
  return gaps.reduce(
    (current, gap) => strongerDisposition(current, gap.disposition),
    signalAssessment.recommendedDisposition,
  );
}
