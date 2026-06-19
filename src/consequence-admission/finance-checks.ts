import { createConsequenceAdmissionCheck, type ConsequenceAdmissionCheck, type ConsequenceAdmissionCheckOutcome, type ConsequenceAdmissionConstraint, type ConsequenceAdmissionDecision, type ConsequenceAdmissionNativeDecision, type ConsequenceAdmissionProofRef, type ConsequenceAdmissionRequest } from './index.js';
import type { ConsequenceScopeExplosionDecision } from './scope-explosion-guard.js';
import { FINANCE_PIPELINE_ADMISSION_SOURCE_REF, type FinanceFilingReleaseAdmissionSummary, type FinancePipelineAdmissionRun } from './finance-types.js';
import { hasClosedAuthorityChain, hasValidProofMode, tokenFreshnessOutcome } from './finance-proof.js';
import { evidenceIds, textOrNull } from './finance-utils.js';

export function buildFinanceChecks(input: {
  readonly run: FinancePipelineAdmissionRun;
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly proof: readonly ConsequenceAdmissionProofRef[];
  readonly nativeDecisionSource: 'release.filingExport.decisionStatus' | 'decision';
  readonly filingRelease: FinanceFilingReleaseAdmissionSummary | null;
}): readonly ConsequenceAdmissionCheck[] {
  const { run, request, decidedAt, proof, nativeDecisionSource, filingRelease } = input;
  const proofEvidenceRefs = evidenceIds(request, proof);
  const status = textOrNull(filingRelease?.decisionStatus)?.toLowerCase() ?? run.decision.toLowerCase();
  const hasHardReleaseToken = Boolean(textOrNull(filingRelease?.tokenId));
  const hasReviewQueue = Boolean(textOrNull(filingRelease?.reviewQueueId));
  const hasAuthorityMaterial = hasClosedAuthorityChain(run);
  const hasProofMaterial = proof.length > 0 || run.auditChainIntact === true || hasValidProofMode(run);
  const allowStatuses = ['pass', 'accepted', 'allow', 'allowed', 'narrow', 'constrained', 'scope-reduced', 'limited'];
  const reviewStatuses = ['hold', 'review', 'review-required', 'needs-review', 'pending-review'];
  const denyStatuses = ['denied', 'fail', 'block', 'blocked', 'deny', 'revoked', 'expired'];
  const policyOutcome: ConsequenceAdmissionCheckOutcome =
    denyStatuses.includes(status)
      ? 'fail'
      : reviewStatuses.includes(status)
        ? 'warn'
        : allowStatuses.includes(status)
          ? 'pass'
          : 'fail';
  const authorityOutcome: ConsequenceAdmissionCheckOutcome =
    policyOutcome === 'fail'
      ? 'fail'
      : hasAuthorityMaterial || hasHardReleaseToken
        ? 'pass'
        : policyOutcome === 'pass'
          ? 'fail'
          : 'warn';
  const evidenceOutcome: ConsequenceAdmissionCheckOutcome =
    hasProofMaterial
      ? 'pass'
      : policyOutcome === 'fail' || policyOutcome === 'pass'
        ? 'fail'
        : 'warn';
  const freshnessOutcome = tokenFreshnessOutcome(filingRelease, decidedAt);
  const enforcementOutcome: ConsequenceAdmissionCheckOutcome =
    hasHardReleaseToken
      ? 'pass'
      : hasReviewQueue
        ? 'warn'
        : policyOutcome === 'fail'
          ? 'fail'
          : 'warn';

  return Object.freeze([
    createConsequenceAdmissionCheck({
      kind: 'policy',
      label: 'Finance policy decision',
      outcome: policyOutcome,
      required: true,
      summary:
        nativeDecisionSource === 'release.filingExport.decisionStatus'
          ? 'Finance filing release decision was projected into the canonical admission vocabulary.'
          : 'Finance pipeline decision was projected into the canonical admission vocabulary.',
      reasonCodes: [`finance-policy-${policyOutcome}`, `finance-native-${status}`],
      evidenceRefs: proofEvidenceRefs,
    }),
    createConsequenceAdmissionCheck({
      kind: 'authority',
      label: 'Finance authority closure',
      outcome: authorityOutcome,
      required: true,
      summary: hasAuthorityMaterial
        ? 'Finance warrant, escrow, receipt, and capsule are closed in valid authority states.'
        : hasHardReleaseToken
          ? 'A finance release token is present for downstream authority closure.'
          : 'Finance authority material is missing or not in closed valid states.',
      reasonCodes: [`finance-authority-${authorityOutcome}`],
      evidenceRefs: proofEvidenceRefs,
    }),
    createConsequenceAdmissionCheck({
      kind: 'evidence',
      label: 'Finance proof material',
      outcome: evidenceOutcome,
      required: true,
      summary: hasProofMaterial
        ? 'Finance proof material is present for independent inspection.'
        : 'Finance proof material is missing from the native response.',
      reasonCodes: [`finance-evidence-${evidenceOutcome}`],
      evidenceRefs: proofEvidenceRefs,
    }),
    createConsequenceAdmissionCheck({
      kind: 'freshness',
      label: 'Finance token freshness',
      outcome: freshnessOutcome,
      required: freshnessOutcome !== 'not-applicable',
      summary: textOrNull(filingRelease?.expiresAt)
        ? 'Finance release token expiry was checked against the admission decision time.'
        : 'No finance release token expiry is present on this native response.',
      reasonCodes: [`finance-freshness-${freshnessOutcome}`],
      evidenceRefs: proofEvidenceRefs,
    }),
    createConsequenceAdmissionCheck({
      kind: 'enforcement',
      label: 'Finance downstream enforcement',
      outcome: enforcementOutcome,
      required: true,
      summary: hasHardReleaseToken
        ? 'A finance release token is present for downstream enforcement.'
        : hasReviewQueue
          ? 'A finance review queue item is present, so automatic downstream consequence must hold.'
          : 'No finance release token is present; the customer system must enforce the canonical decision itself.',
      reasonCodes: [`finance-enforcement-${enforcementOutcome}`],
      evidenceRefs: proofEvidenceRefs,
    }),
    createConsequenceAdmissionCheck({
      kind: 'adapter-readiness',
      label: 'Finance hosted route adapter',
      outcome: 'pass',
      required: true,
      summary: 'The existing finance hosted proof route is wrapped without changing route behavior.',
      reasonCodes: ['finance-adapter-ready'],
      evidenceRefs: [FINANCE_PIPELINE_ADMISSION_SOURCE_REF],
    }),
  ]);
}

export function failedRequiredChecks(
  checks: readonly ConsequenceAdmissionCheck[],
): readonly ConsequenceAdmissionCheck[] {
  return Object.freeze(
    checks.filter((check) => check.required && check.outcome === 'fail'),
  );
}

export function effectiveFinanceDecision(
  nativeDecision: ConsequenceAdmissionNativeDecision,
  failedChecks: readonly ConsequenceAdmissionCheck[],
  guardBlockHolds: readonly ConsequenceAdmissionCheck[],
  reviewGuardHolds: readonly ConsequenceAdmissionCheck[],
  scopeNarrowHolds: readonly ConsequenceAdmissionCheck[],
): ConsequenceAdmissionDecision {
  if (
    guardBlockHolds.length > 0 &&
    (nativeDecision.mappedDecision === 'admit' ||
      nativeDecision.mappedDecision === 'narrow' ||
      nativeDecision.mappedDecision === 'review')
  ) {
    return 'block';
  }

  if (
    (failedChecks.length > 0 || reviewGuardHolds.length > 0) &&
    (nativeDecision.mappedDecision === 'admit' || nativeDecision.mappedDecision === 'narrow')
  ) {
    return 'review';
  }

  if (scopeNarrowHolds.length > 0 && nativeDecision.mappedDecision === 'admit') {
    return 'narrow';
  }

  return nativeDecision.mappedDecision;
}

export function nativeDecisionForEffectiveDecision(input: {
  readonly nativeDecision: ConsequenceAdmissionNativeDecision;
  readonly decision: ConsequenceAdmissionDecision;
  readonly holdChecks: readonly ConsequenceAdmissionCheck[];
}): ConsequenceAdmissionNativeDecision {
  const { nativeDecision, decision, holdChecks } = input;
  if (nativeDecision.mappedDecision === decision) {
    return nativeDecision;
  }

  const heldLabels = holdChecks.map((check) => check.label).join(', ');
  const effectiveReason = decision === 'block'
    ? 'blocked by structured guard constraints'
    : decision === 'narrow'
      ? 'narrowed by structured guard constraints'
      : 'held at review because required checks require review';
  return Object.freeze({
    ...nativeDecision,
    mappedDecision: decision,
    mappingReason:
      `${nativeDecision.mappingReason} Effective canonical admission is ${effectiveReason}: ${heldLabels}.`,
  });
}

export function financeTrustGuardHoldChecks(
  checks: readonly ConsequenceAdmissionCheck[],
): readonly ConsequenceAdmissionCheck[] {
  return Object.freeze(
    checks.filter((check) => check.outcome === 'warn' || check.outcome === 'fail'),
  );
}

export function financeScopeNarrowHoldChecks(
  checks: readonly ConsequenceAdmissionCheck[],
): readonly ConsequenceAdmissionCheck[] {
  return Object.freeze(
    checks.filter((check) =>
      check.label === 'Finance scope guard' &&
      check.outcome === 'warn' &&
      check.reasonCodes.includes('scope-narrowing-required')
    ),
  );
}

export function financeReviewGuardHoldChecks(
  checks: readonly ConsequenceAdmissionCheck[],
): readonly ConsequenceAdmissionCheck[] {
  const scopeNarrowChecks = new Set(financeScopeNarrowHoldChecks(checks));
  return Object.freeze(
    financeTrustGuardHoldChecks(checks).filter((check) =>
      check.outcome !== 'fail' && !scopeNarrowChecks.has(check)
    ),
  );
}

export function financeBlockGuardHoldChecks(
  checks: readonly ConsequenceAdmissionCheck[],
): readonly ConsequenceAdmissionCheck[] {
  return Object.freeze(
    checks.filter((check) => check.outcome === 'fail'),
  );
}

export function financeTrustGuardReasonCodes(
  checks: readonly ConsequenceAdmissionCheck[],
): readonly string[] {
  return Object.freeze(
    [...new Set(checks.flatMap((check) => check.reasonCodes))],
  );
}

export function uniqueChecksByLabel(
  checks: readonly ConsequenceAdmissionCheck[],
): readonly ConsequenceAdmissionCheck[] {
  return Object.freeze([...new Map(checks.map((check) => [check.label, check])).values()]);
}

export function defaultNarrowConstraints(): readonly ConsequenceAdmissionConstraint[] {
  return Object.freeze([
    {
      id: 'finance-native-constraint',
      kind: 'customer-approved-scope',
      summary: 'Proceed only under the constraints returned by the finance native surface.',
      enforcedBy: 'customer downstream system',
      parameterDigest: null,
    },
  ]);
}

export function financeScopeConstraints(
  decision: ConsequenceScopeExplosionDecision | null,
): readonly ConsequenceAdmissionConstraint[] {
  if (decision?.outcome !== 'narrow') return Object.freeze([]);
  return Object.freeze(
    decision.constraints.map((constraint) => Object.freeze({
      id: `finance-scope:${constraint.dimension}`,
      kind: 'customer-approved-scope',
      summary: constraint.safeSummary,
      enforcedBy: 'customer finance workflow',
      parameterDigest: constraint.constraintDigest,
    })),
  );
}
