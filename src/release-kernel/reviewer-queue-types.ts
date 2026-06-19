import type {
  FinanceFilingReleaseCandidate,
  FinanceFilingReleaseReportLike,
  FinanceFilingRow,
} from './finance-record-release.js';
import type {
  ReleaseDecision,
  ReleaseActorReference,
  ReleaseFinding,
  ReleasePolicyProvenanceSource,
} from './object-model.js';
import type { IssuedReleaseToken } from './release-token.js';
import type { ReleaseDecisionLogEntry } from './release-decision-log.js';
import type { RiskClass } from './types.js';

export const RELEASE_REVIEWER_QUEUE_SPEC_VERSION = 'attestor.release-reviewer-queue.v2';
export const ATTESTOR_RELEASE_REVIEWER_QUEUE_STORE_PATH_ENV =
  'ATTESTOR_RELEASE_REVIEWER_QUEUE_STORE_PATH';


export type ReleaseReviewerQueueItemKind = 'finance.filing-export';
export type ReleaseReviewerQueueStatus = 'pending-review' | 'approved' | 'rejected' | 'overridden';
export type ReleaseReviewerAuthorityState = 'pending' | 'approved' | 'rejected' | 'overridden';
export type ReleaseReviewerDecisionOutcome = 'approved' | 'rejected';

export interface ReleaseReviewerTimelineEntry {
  readonly occurredAt: string;
  readonly phase: ReleaseDecisionLogEntry['phase'];
  readonly decisionStatus: ReleaseDecision['status'];
  readonly requiresReview: boolean;
  readonly deterministicChecksCompleted: boolean;
  readonly reviewerLabel?: string;
}

export interface ReleaseReviewerChecklistItem {
  readonly id: string;
  readonly label: string;
  readonly emphasis: 'primary' | 'supporting';
}

export interface FinanceReviewerCandidatePreview {
  readonly runId: string;
  readonly adapterId: string;
  readonly certificateId: string | null;
  readonly proofMode: string;
  readonly evidenceChainTerminal: string;
  readonly rowCount: number;
  readonly rowKeys: readonly string[];
  readonly previewRows: readonly FinanceFilingRow[];
  readonly financeDecision: string;
  readonly receiptStatus: string | null;
  readonly oversightStatus: string | null;
}

export interface ReleaseReviewerIdentity {
  readonly reviewerId: string;
  readonly reviewerName: string;
  readonly reviewerRole: string;
}

export interface ReleaseReviewerDecisionRecord extends ReleaseReviewerIdentity {
  readonly id: string;
  readonly outcome: ReleaseReviewerDecisionOutcome;
  readonly decidedAt: string;
  readonly note: string | null;
}

export interface ReleaseReviewerIssuedTokenSummary {
  readonly tokenId: string;
  readonly expiresAt: string;
  readonly audience: string;
  readonly policyVersion: string | null;
  readonly policyHash: string;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
}

export interface ReleaseReviewerOverrideSummary {
  readonly reasonCode: string;
  readonly ticketId: string | null;
  readonly requestedById: string;
  readonly requestedByLabel: string;
  readonly requestedByRole: string | null;
}

export interface ReleaseReviewerQueueSummary {
  readonly version: typeof RELEASE_REVIEWER_QUEUE_SPEC_VERSION;
  readonly id: string;
  readonly kind: ReleaseReviewerQueueItemKind;
  readonly tenantId: string | null;
  readonly status: ReleaseReviewerQueueStatus;
  readonly authorityState: ReleaseReviewerAuthorityState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly decisionId: string;
  readonly releaseDecisionStatus: ReleaseDecision['status'];
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
  readonly consequenceType: ReleaseDecision['consequenceType'];
  readonly consequenceLabel: string;
  readonly riskClass: RiskClass;
  readonly riskLabel: string;
  readonly requesterLabel: string;
  readonly targetId: string;
  readonly targetDisplayName: string;
  readonly authorityMode: ReleaseDecision['reviewAuthority']['mode'];
  readonly minimumReviewerCount: number;
  readonly approvalsRecorded: number;
  readonly approvalsRemaining: number;
  readonly headline: string;
  readonly summary: string;
  readonly findingSummary: string;
  readonly checklistSummary: string;
}

export interface ReleaseReviewerQueueDetail extends ReleaseReviewerQueueSummary {
  readonly outputHash: string;
  readonly consequenceHash: string;
  readonly evidencePackId: string | null;
  readonly findings: readonly ReleaseFinding[];
  readonly candidate: FinanceReviewerCandidatePreview;
  readonly checklist: readonly ReleaseReviewerChecklistItem[];
  readonly timeline: readonly ReleaseReviewerTimelineEntry[];
  readonly reviewerDecisions: readonly ReleaseReviewerDecisionRecord[];
  readonly issuedReleaseToken: ReleaseReviewerIssuedTokenSummary | null;
  readonly overrideGrant: ReleaseReviewerOverrideSummary | null;
}

export interface ReleaseReviewerQueueRecord {
  readonly detail: ReleaseReviewerQueueDetail;
  readonly releaseDecision: ReleaseDecision;
}

export interface ReleaseReviewerQueueListOptions {
  readonly riskClass?: RiskClass;
  readonly consequenceType?: ReleaseDecision['consequenceType'];
  readonly limit?: number;
}

export interface ReleaseReviewerQueueListResult {
  readonly generatedAt: string;
  readonly totalPending: number;
  readonly countsByRiskClass: Readonly<Record<RiskClass, number>>;
  readonly items: readonly ReleaseReviewerQueueSummary[];
}

export interface ReleaseReviewerQueueStore {
  upsert(record: ReleaseReviewerQueueRecord): ReleaseReviewerQueueDetail;
  commitPendingTransition(input: CommitPendingReviewerQueueTransitionInput): ReleaseReviewerQueueDetail;
  get(id: string): ReleaseReviewerQueueDetail | null;
  getRecord(id: string): ReleaseReviewerQueueRecord | null;
  listPending(options?: ReleaseReviewerQueueListOptions): ReleaseReviewerQueueListResult;
}

export interface CreateFinanceReviewerQueueItemInput {
  readonly decision: ReleaseDecision;
  readonly candidate: FinanceFilingReleaseCandidate;
  readonly report: FinanceFilingReleaseReportLike;
  readonly logEntries: readonly ReleaseDecisionLogEntry[];
  readonly tenantId?: string | null;
}

export interface ApplyReviewerDecisionInput {
  readonly record: ReleaseReviewerQueueRecord;
  readonly outcome: ReleaseReviewerDecisionOutcome;
  readonly reviewerId: string;
  readonly reviewerName: string;
  readonly reviewerRole: string;
  readonly decidedAt: string;
  readonly note?: string | null;
}

export interface ApplyReviewerDecisionResult {
  readonly record: ReleaseReviewerQueueRecord;
  readonly finalDecisionReached: boolean;
}

export interface CommitPendingReviewerQueueTransitionInput {
  readonly record: ReleaseReviewerQueueRecord;
  readonly expectedAuthorityState: ReleaseReviewerQueueDetail['authorityState'];
  readonly expectedReviewerDecisionCount: number;
}

export interface AttachIssuedTokenInput {
  readonly record: ReleaseReviewerQueueRecord;
  readonly issuedToken: IssuedReleaseToken;
}

export interface ApplyBreakGlassOverrideInput {
  readonly record: ReleaseReviewerQueueRecord;
  readonly reasonCode: string;
  readonly ticketId?: string | null;
  readonly requestedById: string;
  readonly requestedByName: string;
  readonly requestedByRole?: string | null;
  readonly requestedByType?: ReleaseActorReference['type'];
  readonly note?: string | null;
  readonly decidedAt: string;
}

export class ReleaseReviewerQueueError extends Error {
  readonly code:
    | 'missing_reviewer'
    | 'reviewer_not_allowed'
    | 'reviewer_role_not_allowed'
    | 'duplicate_reviewer'
    | 'already_finalized'
    | 'missing_override_reason'
    | 'missing_override_requester';

  constructor(
    code:
      | 'missing_reviewer'
      | 'reviewer_not_allowed'
      | 'reviewer_role_not_allowed'
      | 'duplicate_reviewer'
      | 'already_finalized'
      | 'missing_override_reason'
      | 'missing_override_requester',
    message: string,
  ) {
    super(message);
    this.name = 'ReleaseReviewerQueueError';
    this.code = code;
  }
}

export class ReleaseReviewerQueueStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReleaseReviewerQueueStoreError';
  }
}
