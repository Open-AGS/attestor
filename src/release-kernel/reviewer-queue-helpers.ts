import { randomUUID } from 'node:crypto';
import type {
  FinanceFilingReleaseCandidate,
  FinanceFilingReleaseReportLike,
} from './finance-record-release.js';
import type {
  ReleaseDecision,
  ReleaseFinding,
  ReleasePolicyProvenanceSource,
} from './object-model.js';
import type { ReleaseDecisionLogEntry } from './release-decision-log.js';
import type { RiskClass } from './types.js';
import {
  ReleaseReviewerQueueError,
  type ApplyBreakGlassOverrideInput,
  type ApplyReviewerDecisionInput,
  type FinanceReviewerCandidatePreview,
  type ReleaseReviewerChecklistItem,
  type ReleaseReviewerDecisionRecord,
  type ReleaseReviewerOverrideSummary,
  type ReleaseReviewerQueueDetail,
  type ReleaseReviewerQueueRecord,
  type ReleaseReviewerQueueSummary,
  type ReleaseReviewerTimelineEntry,
} from './reviewer-queue-types.js';

function normalizeOptionalRole(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function riskRank(riskClass: RiskClass): number {
  switch (riskClass) {
    case 'R4':
      return 4;
    case 'R3':
      return 3;
    case 'R2':
      return 2;
    case 'R1':
      return 1;
    case 'R0':
      return 0;
  }
}

export function requesterLabel(decision: ReleaseDecision): string {
  if (decision.requester.displayName?.trim()) {
    return decision.requester.displayName.trim();
  }
  return decision.requester.id;
}

export function targetDisplayName(decision: ReleaseDecision): string {
  return decision.target.displayName?.trim() || decision.target.id;
}

export function policyIrHash(decision: ReleaseDecision): string | null {
  return decision.policyProvenance?.compiledPolicyIrHash ?? null;
}

export function policyProvenanceSource(decision: ReleaseDecision): ReleasePolicyProvenanceSource | null {
  return decision.policyProvenance?.source ?? null;
}

export function compiledPolicyIndexVersion(decision: ReleaseDecision): string | null {
  return decision.policyProvenance?.compiledPolicyIndexVersion ?? null;
}

export function compiledPolicyIrVersion(decision: ReleaseDecision): string | null {
  return decision.policyProvenance?.compiledPolicyIrVersion ?? null;
}

export function summarizeFindings(findings: readonly ReleaseFinding[]): string {
  const fails = findings.filter((finding) => finding.result === 'fail');
  if (fails.length > 0) {
    return fails[0]?.message ?? `${fails.length} blocking findings require reviewer attention.`;
  }

  const warns = findings.filter((finding) => finding.result === 'warn');
  if (warns.length > 0) {
    return warns[0]?.message ?? `${warns.length} warning findings require reviewer attention.`;
  }

  return 'Deterministic controls passed, but human authority is still required before consequence.';
}

export function buildChecklist(
  decision: ReleaseDecision,
  candidate: FinanceFilingReleaseCandidate,
): readonly ReleaseReviewerChecklistItem[] {
  const steps: ReleaseReviewerChecklistItem[] = [
    {
      id: 'target-binding',
      label: `Confirm the release target is still '${targetDisplayName(decision)}'.`,
      emphasis: 'primary',
    },
    {
      id: 'row-preview',
      label: `Review the ${candidate.rows.length} structured record row(s) that would cross the consequence boundary.`,
      emphasis: 'primary',
    },
    {
      id: 'finding-review',
      label: 'Read the deterministic findings and verify no blocked control was bypassed.',
      emphasis: 'primary',
    },
    {
      id: 'authority-bridge',
      label: 'Check the finance authority chain state (receipt, oversight, proof mode) before authorizing release.',
      emphasis: 'supporting',
    },
  ];

  if (decision.reviewAuthority.minimumReviewerCount > 1) {
    steps.push({
      id: 'dual-approval-heads-up',
      label: `This risk class is configured for ${decision.reviewAuthority.minimumReviewerCount} reviewers. Coordinate the second approval path before consequence.`,
      emphasis: 'supporting',
    });
  }

  return Object.freeze(steps);
}

export function buildCandidatePreview(
  candidate: FinanceFilingReleaseCandidate,
  report: FinanceFilingReleaseReportLike,
): FinanceReviewerCandidatePreview {
  const rowKeys = Array.from(
    candidate.rows.reduce((keys, row) => {
      for (const key of Object.keys(row)) {
        keys.add(key);
      }
      return keys;
    }, new Set<string>()),
  ).sort();

  return Object.freeze({
    runId: candidate.runId,
    adapterId: candidate.adapterId,
    certificateId: candidate.certificateId,
    proofMode: candidate.proofMode,
    evidenceChainTerminal: candidate.evidenceChainTerminal,
    rowCount: candidate.rows.length,
    rowKeys: Object.freeze(rowKeys),
    previewRows: Object.freeze(candidate.rows.slice(0, 3).map((row) => Object.freeze({ ...row }))),
    financeDecision: report.decision,
    receiptStatus: report.receipt?.receiptStatus ?? null,
    oversightStatus: report.oversight.status,
  });
}

export function buildTimeline(
  decision: ReleaseDecision,
  entries: readonly ReleaseDecisionLogEntry[],
): readonly ReleaseReviewerTimelineEntry[] {
  return Object.freeze(
    entries
      .filter((entry) => entry.decisionId === decision.id)
      .sort((left, right) => left.sequence - right.sequence)
      .map((entry) =>
        Object.freeze({
          occurredAt: entry.occurredAt,
          phase: entry.phase,
          decisionStatus: entry.decisionStatus,
          requiresReview: entry.metadata.requiresReview,
          deterministicChecksCompleted: entry.metadata.deterministicChecksCompleted,
        }),
      ),
  );
}

export function ensureNamedReviewerRequirements(
  decision: ReleaseDecision,
  input: ApplyReviewerDecisionInput,
): void {
  if (!input.reviewerId.trim() || !input.reviewerName.trim() || !input.reviewerRole.trim()) {
    throw new ReleaseReviewerQueueError(
      'missing_reviewer',
      'Named review requires reviewerId, reviewerName, and reviewerRole.',
    );
  }

  if (
    decision.reviewAuthority.requiredReviewerIds.length > 0 &&
    !decision.reviewAuthority.requiredReviewerIds.includes(input.reviewerId.trim())
  ) {
    throw new ReleaseReviewerQueueError(
      'reviewer_not_allowed',
      `Reviewer '${input.reviewerId}' is not authorized for this release decision.`,
    );
  }

  if (
    decision.reviewAuthority.requiredRoles.length > 0 &&
    !decision.reviewAuthority.requiredRoles.includes(input.reviewerRole.trim())
  ) {
    throw new ReleaseReviewerQueueError(
      'reviewer_role_not_allowed',
      `Reviewer role '${input.reviewerRole}' is not allowed for this release decision.`,
    );
  }
}

export function reviewerDecisionRecord(
  input: ApplyReviewerDecisionInput,
): ReleaseReviewerDecisionRecord {
  return Object.freeze({
    id: `rrd_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    reviewerId: input.reviewerId.trim(),
    reviewerName: input.reviewerName.trim(),
    reviewerRole: input.reviewerRole.trim(),
    outcome: input.outcome,
    decidedAt: input.decidedAt,
    note: input.note?.trim() ? input.note.trim() : null,
  });
}

export function overrideSummaryFromDecision(decision: ReleaseDecision): ReleaseReviewerOverrideSummary | null {
  if (!decision.override) {
    return null;
  }

  return Object.freeze({
    reasonCode: decision.override.reasonCode,
    ticketId: decision.override.ticketId ?? null,
    requestedById: decision.override.requestedBy.id,
    requestedByLabel:
      decision.override.requestedBy.displayName?.trim() || decision.override.requestedBy.id,
    requestedByRole: normalizeOptionalRole(decision.override.requestedBy.role),
  });
}

export function updateReviewSummary(
  decision: ReleaseDecision,
  reviewerDecisions: readonly ReleaseReviewerDecisionRecord[],
): Pick<
  ReleaseReviewerQueueSummary,
  | 'status'
  | 'authorityState'
  | 'releaseDecisionStatus'
  | 'approvalsRecorded'
  | 'approvalsRemaining'
  | 'summary'
  | 'findingSummary'
> {
  const approvalsRecorded = reviewerDecisions.filter((entry) => entry.outcome === 'approved').length;
  const rejection = reviewerDecisions.find((entry) => entry.outcome === 'rejected') ?? null;
  const approvalsRemaining = Math.max(
    decision.reviewAuthority.minimumReviewerCount - approvalsRecorded,
    0,
  );

  if (rejection) {
    return {
      status: 'rejected',
      authorityState: 'rejected',
      releaseDecisionStatus: 'denied',
      approvalsRecorded,
      approvalsRemaining,
      summary: `Reviewer authority denied consequence after ${rejection.reviewerName} rejected the release candidate.`,
      findingSummary: `Rejected by ${rejection.reviewerName}; no release token may be issued for this candidate.`,
    };
  }

  if (approvalsRemaining === 0) {
    return {
      status: 'approved',
      authorityState: 'approved',
      releaseDecisionStatus: 'accepted',
      approvalsRecorded,
      approvalsRemaining,
      summary: `Reviewer authority is complete. ${approvalsRecorded} reviewer approval(s) authorized release to ${targetDisplayName(decision)}.`,
      findingSummary: 'Human authority completed the release decision; token issuance may proceed.',
    };
  }

  return {
    status: 'pending-review',
    authorityState: 'pending',
    releaseDecisionStatus: decision.status,
    approvalsRecorded,
    approvalsRemaining,
    summary: `${approvalsRecorded} of ${decision.reviewAuthority.minimumReviewerCount} required reviewer approval(s) recorded before consequence may proceed.`,
    findingSummary: approvalsRecorded > 0
      ? 'Additional named reviewer approval is still required before token issuance.'
      : summarizeFindings(decision.findings),
  };
}

export function buildBreakGlassSummary(
  decision: ReleaseDecision,
): Pick<
  ReleaseReviewerQueueSummary,
  | 'status'
  | 'authorityState'
  | 'releaseDecisionStatus'
  | 'approvalsRecorded'
  | 'approvalsRemaining'
  | 'summary'
  | 'findingSummary'
> {
  const approvalsRecorded = decision.override ? 1 : 0;
  return {
    status: 'overridden',
    authorityState: 'overridden',
    releaseDecisionStatus: 'overridden',
    approvalsRecorded,
    approvalsRemaining: 0,
    summary: `Break-glass release override authorized consequence to ${targetDisplayName(decision)} under explicit emergency controls.`,
    findingSummary: `Emergency override '${decision.override?.reasonCode ?? 'unspecified'}' replaced normal reviewer closure for this candidate.`,
  };
}

function addReviewFinding(
  decision: ReleaseDecision,
  input: ApplyReviewerDecisionInput,
  approvalsRecorded: number,
): ReleaseFinding {
  if (input.outcome === 'rejected') {
    return {
      code: 'release_reviewer_rejected',
      result: 'fail',
      message: `${input.reviewerName.trim()} rejected the release candidate before consequence.`,
      source: 'review',
    };
  }

  return {
    code:
      decision.reviewAuthority.minimumReviewerCount > 1
        ? approvalsRecorded >= decision.reviewAuthority.minimumReviewerCount
          ? 'release_dual_approval_completed'
          : 'release_dual_approval_partial'
        : 'release_named_review_approved',
    result: approvalsRecorded >= decision.reviewAuthority.minimumReviewerCount ? 'pass' : 'info',
    message:
      approvalsRecorded >= decision.reviewAuthority.minimumReviewerCount
        ? `${input.reviewerName.trim()} completed the required reviewer authority for consequence release.`
        : `${input.reviewerName.trim()} recorded approval ${approvalsRecorded} of ${decision.reviewAuthority.minimumReviewerCount}.`,
    source: 'review',
  };
}

export function cloneDecisionWithReviewOutcome(
  decision: ReleaseDecision,
  input: ApplyReviewerDecisionInput,
  reviewerDecisions: readonly ReleaseReviewerDecisionRecord[],
): ReleaseDecision {
  const approvalsRecorded = reviewerDecisions.filter((entry) => entry.outcome === 'approved').length;
  const nextStatus =
    input.outcome === 'rejected'
      ? 'denied'
      : approvalsRecorded >= decision.reviewAuthority.minimumReviewerCount
        ? 'accepted'
        : decision.status;

  return Object.freeze({
    ...decision,
    status: nextStatus,
    findings: Object.freeze([...decision.findings, addReviewFinding(decision, input, approvalsRecorded)]),
  });
}

export function cloneDecisionWithBreakGlassOverride(
  decision: ReleaseDecision,
  input: ApplyBreakGlassOverrideInput,
): ReleaseDecision {
  const reasonCode = input.reasonCode.trim();
  if (!reasonCode) {
    throw new ReleaseReviewerQueueError(
      'missing_override_reason',
      'Break-glass override requires a non-empty reasonCode.',
    );
  }

  const requestedById = input.requestedById.trim();
  const requestedByName = input.requestedByName.trim();
  if (!requestedById || !requestedByName) {
    throw new ReleaseReviewerQueueError(
      'missing_override_requester',
      'Break-glass override requires requestedById and requestedByName.',
    );
  }

  const overrideFinding: ReleaseFinding = {
    code: 'release_break_glass_override',
    result: 'warn',
    message: `${requestedByName} authorized an emergency break-glass release for reason '${reasonCode}'.`,
    source: 'override',
  };

  return Object.freeze({
    ...decision,
    status: 'overridden',
    override: Object.freeze({
      reasonCode,
      ticketId: input.ticketId?.trim() || undefined,
      requestedBy: Object.freeze({
        id: requestedById,
        type: input.requestedByType ?? 'user',
        displayName: requestedByName,
        role: normalizeOptionalRole(input.requestedByRole) ?? undefined,
      }),
    }),
    findings: Object.freeze([
      ...decision.findings,
      overrideFinding,
    ]),
  });
}

export function reviewerTimelineEntry(
  occurredAt: string,
  phase: ReleaseReviewerTimelineEntry['phase'],
  decisionStatus: ReleaseDecision['status'],
  reviewerLabel: string,
): ReleaseReviewerTimelineEntry {
  return Object.freeze({
    occurredAt,
    phase,
    decisionStatus,
    requiresReview: decisionStatus === 'review-required' || decisionStatus === 'hold',
    deterministicChecksCompleted: true,
    reviewerLabel,
  });
}

export function freezeReviewerDecisions(
  decisions: readonly ReleaseReviewerDecisionRecord[],
): readonly ReleaseReviewerDecisionRecord[] {
  return Object.freeze(decisions.map((entry) => Object.freeze({ ...entry })));
}

export function freezeTimeline(
  timeline: readonly ReleaseReviewerTimelineEntry[],
): readonly ReleaseReviewerTimelineEntry[] {
  return Object.freeze(timeline.map((entry) => Object.freeze({ ...entry })));
}

export function freezeDetail(detail: ReleaseReviewerQueueDetail): ReleaseReviewerQueueDetail {
  return Object.freeze({
    ...detail,
    findings: Object.freeze(detail.findings.map((finding) => Object.freeze({ ...finding }))),
    checklist: Object.freeze(detail.checklist.map((entry) => Object.freeze({ ...entry }))),
    timeline: freezeTimeline(detail.timeline),
    reviewerDecisions: freezeReviewerDecisions(detail.reviewerDecisions),
    candidate: Object.freeze({
      ...detail.candidate,
      rowKeys: Object.freeze([...detail.candidate.rowKeys]),
      previewRows: Object.freeze(detail.candidate.previewRows.map((row) => Object.freeze({ ...row }))),
    }),
    issuedReleaseToken: detail.issuedReleaseToken
      ? Object.freeze({ ...detail.issuedReleaseToken })
      : null,
    overrideGrant: detail.overrideGrant
      ? Object.freeze({ ...detail.overrideGrant })
      : null,
  });
}

export function freezeRecord(record: ReleaseReviewerQueueRecord): ReleaseReviewerQueueRecord {
  return Object.freeze({
    detail: freezeDetail(record.detail),
    releaseDecision: Object.freeze({
      ...record.releaseDecision,
      findings: Object.freeze(record.releaseDecision.findings.map((finding) => Object.freeze({ ...finding }))),
      reviewAuthority: Object.freeze({
        ...record.releaseDecision.reviewAuthority,
        requiredRoles: Object.freeze([...record.releaseDecision.reviewAuthority.requiredRoles]),
        requiredReviewerIds: Object.freeze([...record.releaseDecision.reviewAuthority.requiredReviewerIds]),
      }),
      releaseConditions: Object.freeze({
        items: Object.freeze(record.releaseDecision.releaseConditions.items.map((item) => Object.freeze({ ...item }))),
      }),
    }),
  });
}

export function coerceReleaseReviewerQueueRecord(
  record: ReleaseReviewerQueueRecord,
): ReleaseReviewerQueueRecord {
  return freezeRecord(record);
}
