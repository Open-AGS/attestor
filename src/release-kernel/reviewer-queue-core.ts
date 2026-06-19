import { consequenceTypeLabel, RISK_CLASS_PROFILES } from './types.js';
import {
  buildBreakGlassSummary,
  buildCandidatePreview,
  buildChecklist,
  buildTimeline,
  cloneDecisionWithBreakGlassOverride,
  cloneDecisionWithReviewOutcome,
  compiledPolicyIndexVersion,
  compiledPolicyIrVersion,
  ensureNamedReviewerRequirements,
  freezeRecord,
  freezeReviewerDecisions,
  freezeTimeline,
  overrideSummaryFromDecision,
  policyIrHash,
  policyProvenanceSource,
  requesterLabel,
  reviewerDecisionRecord,
  reviewerTimelineEntry,
  summarizeFindings,
  targetDisplayName,
  updateReviewSummary,
} from './reviewer-queue-helpers.js';
import {
  RELEASE_REVIEWER_QUEUE_SPEC_VERSION,
  ReleaseReviewerQueueError,
  type ApplyBreakGlassOverrideInput,
  type ApplyReviewerDecisionInput,
  type ApplyReviewerDecisionResult,
  type AttachIssuedTokenInput,
  type CreateFinanceReviewerQueueItemInput,
  type ReleaseReviewerQueueRecord,
} from './reviewer-queue-types.js';

export function createFinanceReviewerQueueItem(
  input: CreateFinanceReviewerQueueItemInput,
): ReleaseReviewerQueueRecord {
  const { decision, candidate, report, logEntries } = input;
  const checklist = buildChecklist(decision, candidate);
  const candidatePreview = buildCandidatePreview(candidate, report);
  const timeline = buildTimeline(decision, logEntries);
  const createdAt = decision.createdAt;
  const riskProfile = RISK_CLASS_PROFILES[decision.riskClass];
  const headline = `${candidate.adapterId} filing export waiting for release review`;
  const summary = `${candidate.runId} is paused before consequence because ${decision.reviewAuthority.minimumReviewerCount === 1 ? 'a reviewer' : `${decision.reviewAuthority.minimumReviewerCount} reviewers`} must authorize release to ${targetDisplayName(decision)}.`;

  return freezeRecord({
    detail: {
      version: RELEASE_REVIEWER_QUEUE_SPEC_VERSION,
      id: `review_${decision.id}`,
      kind: 'finance.filing-export',
      tenantId: input.tenantId ?? null,
      status: 'pending-review',
      authorityState: 'pending',
      createdAt,
      updatedAt: createdAt,
      decisionId: decision.id,
      releaseDecisionStatus: decision.status,
      policyVersion: decision.policyVersion,
      policyHash: decision.policyHash,
      policyIrHash: policyIrHash(decision),
      policyProvenanceSource: policyProvenanceSource(decision),
      compiledPolicyIndexVersion: compiledPolicyIndexVersion(decision),
      compiledPolicyIrVersion: compiledPolicyIrVersion(decision),
      consequenceType: decision.consequenceType,
      consequenceLabel: consequenceTypeLabel(decision.consequenceType),
      riskClass: decision.riskClass,
      riskLabel: riskProfile.label,
      requesterLabel: requesterLabel(decision),
      targetId: decision.target.id,
      targetDisplayName: targetDisplayName(decision),
      authorityMode: decision.reviewAuthority.mode,
      minimumReviewerCount: decision.reviewAuthority.minimumReviewerCount,
      approvalsRecorded: 0,
      approvalsRemaining: decision.reviewAuthority.minimumReviewerCount,
      headline,
      summary,
      findingSummary: summarizeFindings(decision.findings),
      checklistSummary: checklist[0]?.label ?? 'Review required before consequence.',
      outputHash: decision.outputHash,
      consequenceHash: decision.consequenceHash,
      evidencePackId: decision.evidencePackId,
      findings: Object.freeze(decision.findings.map((finding) => Object.freeze({ ...finding }))),
      candidate: candidatePreview,
      checklist,
      timeline,
      reviewerDecisions: Object.freeze([]),
      issuedReleaseToken: null,
      overrideGrant: null,
    },
    releaseDecision: Object.freeze({
      ...decision,
      findings: Object.freeze(decision.findings.map((finding) => Object.freeze({ ...finding }))),
    }),
  });
}

export function applyReviewerDecision(
  input: ApplyReviewerDecisionInput,
): ApplyReviewerDecisionResult {
  const { record } = input;
  if (record.detail.status !== 'pending-review') {
    throw new ReleaseReviewerQueueError(
      'already_finalized',
      `Release review '${record.detail.id}' is already ${record.detail.status}.`,
    );
  }

  ensureNamedReviewerRequirements(record.releaseDecision, input);

  if (
    record.detail.reviewerDecisions.some(
      (entry) => entry.reviewerId === input.reviewerId.trim(),
    )
  ) {
    throw new ReleaseReviewerQueueError(
      'duplicate_reviewer',
      `Reviewer '${input.reviewerId}' has already acted on this release decision.`,
    );
  }

  const reviewEntry = reviewerDecisionRecord(input);
  const reviewerDecisions = freezeReviewerDecisions([
    ...record.detail.reviewerDecisions,
    reviewEntry,
  ]);
  const nextDecision = cloneDecisionWithReviewOutcome(record.releaseDecision, input, reviewerDecisions);
  const summary = updateReviewSummary(nextDecision, reviewerDecisions);
  const timeline = freezeTimeline([
    ...record.detail.timeline,
    reviewerTimelineEntry(
      input.decidedAt,
      'review',
      nextDecision.status,
      reviewEntry.reviewerName,
    ),
    ...(summary.authorityState === 'approved'
      ? [reviewerTimelineEntry(input.decidedAt, 'terminal-accept', 'accepted', reviewEntry.reviewerName)]
      : summary.authorityState === 'rejected'
        ? [reviewerTimelineEntry(input.decidedAt, 'terminal-deny', 'denied', reviewEntry.reviewerName)]
        : []),
  ]);

  return {
    record: freezeRecord({
      detail: {
        ...record.detail,
        status: summary.status,
        authorityState: summary.authorityState,
        updatedAt: input.decidedAt,
        releaseDecisionStatus: summary.releaseDecisionStatus,
        approvalsRecorded: summary.approvalsRecorded,
        approvalsRemaining: summary.approvalsRemaining,
        summary: summary.summary,
        findingSummary: summary.findingSummary,
        findings: Object.freeze(nextDecision.findings.map((finding) => Object.freeze({ ...finding }))),
        timeline,
        reviewerDecisions,
      },
      releaseDecision: nextDecision,
    }),
    finalDecisionReached:
      summary.authorityState === 'approved' || summary.authorityState === 'rejected',
  };
}

export function applyBreakGlassOverride(
  input: ApplyBreakGlassOverrideInput,
): ReleaseReviewerQueueRecord {
  const { record } = input;
  if (record.detail.status !== 'pending-review') {
    throw new ReleaseReviewerQueueError(
      'already_finalized',
      `Release review '${record.detail.id}' is already ${record.detail.status}.`,
    );
  }

  const nextDecision = cloneDecisionWithBreakGlassOverride(record.releaseDecision, input);
  const summary = buildBreakGlassSummary(nextDecision);
  const timeline = freezeTimeline([
    ...record.detail.timeline,
    reviewerTimelineEntry(
      input.decidedAt,
      'override',
      'overridden',
      input.requestedByName.trim(),
    ),
    reviewerTimelineEntry(
      input.decidedAt,
      'terminal-accept',
      'overridden',
      input.requestedByName.trim(),
    ),
  ]);

  return freezeRecord({
    detail: {
      ...record.detail,
      status: summary.status,
      authorityState: summary.authorityState,
      updatedAt: input.decidedAt,
      releaseDecisionStatus: summary.releaseDecisionStatus,
      approvalsRecorded: summary.approvalsRecorded,
      approvalsRemaining: summary.approvalsRemaining,
      summary: summary.summary,
      findingSummary: summary.findingSummary,
      findings: Object.freeze(nextDecision.findings.map((finding) => Object.freeze({ ...finding }))),
      timeline,
      overrideGrant: overrideSummaryFromDecision(nextDecision),
    },
    releaseDecision: nextDecision,
  });
}

export function attachIssuedTokenToReviewerQueueRecord(
  input: AttachIssuedTokenInput,
): ReleaseReviewerQueueRecord {
  return freezeRecord({
    detail: {
      ...input.record.detail,
      updatedAt: input.issuedToken.issuedAt,
      issuedReleaseToken: {
        tokenId: input.issuedToken.tokenId,
        expiresAt: input.issuedToken.expiresAt,
        audience: input.issuedToken.claims.aud,
        policyVersion: input.issuedToken.claims.policy_version ?? null,
        policyHash: input.issuedToken.claims.policy_hash,
        policyIrHash: input.issuedToken.claims.policy_ir_hash ?? null,
        policyProvenanceSource: input.issuedToken.claims.policy_provenance_source ?? null,
        compiledPolicyIndexVersion: input.issuedToken.claims.compiled_policy_index_version ?? null,
        compiledPolicyIrVersion: input.issuedToken.claims.compiled_policy_ir_version ?? null,
      },
    },
    releaseDecision: {
      ...input.record.releaseDecision,
      releaseTokenId: input.issuedToken.tokenId,
    },
  });
}
