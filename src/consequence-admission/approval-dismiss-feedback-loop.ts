import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ReviewByExceptionInboxItem,
  ReviewByExceptionInboxResult,
} from './review-by-exception-inbox.js';

export const APPROVAL_DISMISS_FEEDBACK_LOOP_VERSION =
  'attestor.approval-dismiss-feedback-loop.v1';

export const APPROVAL_DISMISS_FEEDBACK_ACTIONS = [
  'approve-candidate',
  'dismiss-candidate',
  'request-stricter-version',
  'edit-threshold',
  'request-rollback',
] as const;
export type ApprovalDismissFeedbackAction =
  typeof APPROVAL_DISMISS_FEEDBACK_ACTIONS[number];

export const APPROVAL_DISMISS_FEEDBACK_OUTCOMES = [
  'candidate-approved',
  'candidate-dismissed',
  'new-candidate-required',
  'feedback-blocked',
] as const;
export type ApprovalDismissFeedbackOutcome =
  typeof APPROVAL_DISMISS_FEEDBACK_OUTCOMES[number];

export const APPROVAL_DISMISS_FEEDBACK_STATUSES = [
  'empty',
  'feedback-recorded',
  'new-candidate-required',
  'blocked',
] as const;
export type ApprovalDismissFeedbackStatus =
  typeof APPROVAL_DISMISS_FEEDBACK_STATUSES[number];

export interface ApprovalDismissThresholdEdit {
  readonly thresholdField: string;
  readonly beforeDigest: string;
  readonly afterDigest: string;
  readonly unitDigest?: string | null;
}

export interface ApprovalDismissStricterVersionRequest {
  readonly requestedConstraintDigest: string;
  readonly requestedReasonDigest?: string | null;
}

export interface ApprovalDismissRollbackRequest {
  readonly rollbackPlanDigest: string;
  readonly rollbackScopeDigest?: string | null;
  readonly rollbackReasonDigest?: string | null;
}

export interface ApprovalDismissFeedbackInput {
  readonly itemId: string;
  readonly itemDigest: string;
  readonly reviewContextDigest: string;
  readonly action: ApprovalDismissFeedbackAction;
  readonly reviewerRefDigest: string;
  readonly decidedAt?: string | null;
  readonly reasonDigest: string;
  readonly commentDigest?: string | null;
  readonly thresholdEdit?: ApprovalDismissThresholdEdit | null;
  readonly stricterVersionRequest?: ApprovalDismissStricterVersionRequest | null;
  readonly rollbackRequest?: ApprovalDismissRollbackRequest | null;
}

export interface CreateApprovalDismissFeedbackLoopInput {
  readonly reviewByExceptionInbox: ReviewByExceptionInboxResult;
  readonly feedback: readonly ApprovalDismissFeedbackInput[];
  readonly generatedAt?: string | null;
}

export interface ApprovalDismissFeedbackEvent {
  readonly eventId: string;
  readonly eventDigest: string;
  readonly action: ApprovalDismissFeedbackAction;
  readonly outcome: ApprovalDismissFeedbackOutcome;
  readonly accepted: boolean;
  readonly requiresNewCandidate: boolean;
  readonly candidateMayAdvanceToApproved: boolean;
  readonly sourceItemId: string;
  readonly sourceItemDigest: string;
  readonly sourceReviewContextDigest: string;
  readonly candidateId: string;
  readonly surfaceId: string;
  readonly actionSurface: string;
  readonly sourcePolicyCandidateDigest: string;
  readonly sourcePolicyTwinCandidateDigest: string;
  readonly reviewerRefDigest: string;
  readonly decidedAt: string;
  readonly reasonDigest: string;
  readonly commentDigest: string | null;
  readonly thresholdEdit: ApprovalDismissThresholdEdit | null;
  readonly stricterVersionRequest: ApprovalDismissStricterVersionRequest | null;
  readonly rollbackRequest: ApprovalDismissRollbackRequest | null;
  readonly reasonCodes: readonly string[];
  readonly feedbackContextDigest: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly mutatesPolicyBundle: false;
  readonly updatesPolicyCandidate: false;
  readonly retrainsModel: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface ApprovalDismissFeedbackCounts {
  readonly approved: number;
  readonly dismissed: number;
  readonly stricterVersionRequested: number;
  readonly thresholdEdited: number;
  readonly rollbackRequested: number;
  readonly blocked: number;
  readonly newCandidateRequired: number;
}

export interface ApprovalDismissFeedbackLoopResult {
  readonly version: typeof APPROVAL_DISMISS_FEEDBACK_LOOP_VERSION;
  readonly generatedAt: string;
  readonly reviewByExceptionInboxDigest: string;
  readonly policyCandidatePrContractDigest: string;
  readonly policyTwinBacktestDigest: string;
  readonly tenantRefDigest: string;
  readonly graphDigest: string;
  readonly schemaDigest: string;
  readonly feedbackCount: number;
  readonly acceptedFeedbackCount: number;
  readonly blockedFeedbackCount: number;
  readonly newCandidateRequiredCount: number;
  readonly counts: ApprovalDismissFeedbackCounts;
  readonly status: ApprovalDismissFeedbackStatus;
  readonly events: readonly ApprovalDismissFeedbackEvent[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly mutatesPolicyBundle: false;
  readonly updatesPolicyCandidate: false;
  readonly retrainsModel: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly structuredFeedbackOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface ApprovalDismissFeedbackLoopDescriptor {
  readonly version: typeof APPROVAL_DISMISS_FEEDBACK_LOOP_VERSION;
  readonly actions: typeof APPROVAL_DISMISS_FEEDBACK_ACTIONS;
  readonly outcomes: typeof APPROVAL_DISMISS_FEEDBACK_OUTCOMES;
  readonly statuses: typeof APPROVAL_DISMISS_FEEDBACK_STATUSES;
  readonly tenantBound: true;
  readonly requiresReviewerDigest: true;
  readonly requiresReasonDigest: true;
  readonly requiresReviewContextDigest: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly mutatesPolicyBundle: false;
  readonly updatesPolicyCandidate: false;
  readonly retrainsModel: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly structuredFeedbackOnly: true;
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SAFE_FIELD_PATTERN = /^[a-z0-9][a-z0-9_.:-]{1,78}[a-z0-9]$/u;

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

function hashCanonical(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Approval/dismiss feedback loop ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeDigest(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Approval/dismiss feedback loop ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null || value.trim().length === 0) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeAction(value: ApprovalDismissFeedbackAction): ApprovalDismissFeedbackAction {
  if (!(APPROVAL_DISMISS_FEEDBACK_ACTIONS as readonly string[]).includes(value)) {
    throw new Error('Approval/dismiss feedback loop action is not supported.');
  }
  return value;
}

function normalizeThresholdEdit(
  input: ApprovalDismissThresholdEdit | null | undefined,
  required: boolean,
): ApprovalDismissThresholdEdit | null {
  if (input === undefined || input === null) {
    if (required) {
      throw new Error('Approval/dismiss feedback loop threshold edit is required.');
    }
    return null;
  }
  const thresholdField = input.thresholdField.trim();
  if (!SAFE_FIELD_PATTERN.test(thresholdField)) {
    throw new Error('Approval/dismiss feedback loop threshold field must be a safe field reference.');
  }
  const beforeDigest = normalizeDigest(input.beforeDigest, 'thresholdEdit.beforeDigest');
  const afterDigest = normalizeDigest(input.afterDigest, 'thresholdEdit.afterDigest');
  if (beforeDigest === afterDigest) {
    throw new Error('Approval/dismiss feedback loop threshold edit must change the threshold digest.');
  }
  return Object.freeze({
    thresholdField,
    beforeDigest,
    afterDigest,
    unitDigest: normalizeOptionalDigest(input.unitDigest, 'thresholdEdit.unitDigest'),
  });
}

function normalizeStricterVersionRequest(
  input: ApprovalDismissStricterVersionRequest | null | undefined,
  required: boolean,
): ApprovalDismissStricterVersionRequest | null {
  if (input === undefined || input === null) {
    if (required) {
      throw new Error('Approval/dismiss feedback loop stricter-version request is required.');
    }
    return null;
  }
  return Object.freeze({
    requestedConstraintDigest: normalizeDigest(
      input.requestedConstraintDigest,
      'stricterVersionRequest.requestedConstraintDigest',
    ),
    requestedReasonDigest: normalizeOptionalDigest(
      input.requestedReasonDigest,
      'stricterVersionRequest.requestedReasonDigest',
    ),
  });
}

function normalizeRollbackRequest(
  input: ApprovalDismissRollbackRequest | null | undefined,
  required: boolean,
): ApprovalDismissRollbackRequest | null {
  if (input === undefined || input === null) {
    if (required) {
      throw new Error('Approval/dismiss feedback loop rollback request is required.');
    }
    return null;
  }
  return Object.freeze({
    rollbackPlanDigest: normalizeDigest(input.rollbackPlanDigest, 'rollbackRequest.rollbackPlanDigest'),
    rollbackScopeDigest: normalizeOptionalDigest(
      input.rollbackScopeDigest,
      'rollbackRequest.rollbackScopeDigest',
    ),
    rollbackReasonDigest: normalizeOptionalDigest(
      input.rollbackReasonDigest,
      'rollbackRequest.rollbackReasonDigest',
    ),
  });
}

function validateFeedbackReferences(input: {
  readonly feedback: ApprovalDismissFeedbackInput;
  readonly item: ReviewByExceptionInboxItem;
}): void {
  if (input.feedback.itemDigest !== input.item.itemDigest) {
    throw new Error('Approval/dismiss feedback loop item digest must match the review inbox item.');
  }
  if (input.feedback.reviewContextDigest !== input.item.reviewContextDigest) {
    throw new Error(
      'Approval/dismiss feedback loop review context digest must match the review inbox item.',
    );
  }
}

function actionAllowedForItem(input: {
  readonly action: ApprovalDismissFeedbackAction;
  readonly item: ReviewByExceptionInboxItem;
}): boolean {
  switch (input.action) {
    case 'approve-candidate':
      return input.item.lane === 'ready-to-approve' && !input.item.approvalBlocked;
    case 'dismiss-candidate':
      return input.item.humanActionRequired;
    case 'request-stricter-version':
      return input.item.humanActionRequired;
    case 'edit-threshold':
      return input.item.lane === 'ready-to-approve' || input.item.lane === 'needs-answer';
    case 'request-rollback':
      return input.item.lane === 'monitoring-only' || input.item.lane === 'ready-to-approve';
  }
}

function outcomeFor(input: {
  readonly action: ApprovalDismissFeedbackAction;
  readonly allowed: boolean;
}): ApprovalDismissFeedbackOutcome {
  if (!input.allowed) return 'feedback-blocked';
  switch (input.action) {
    case 'approve-candidate':
      return 'candidate-approved';
    case 'dismiss-candidate':
      return 'candidate-dismissed';
    case 'request-stricter-version':
    case 'edit-threshold':
    case 'request-rollback':
      return 'new-candidate-required';
  }
}

function reasonCodesFor(input: {
  readonly action: ApprovalDismissFeedbackAction;
  readonly allowed: boolean;
  readonly item: ReviewByExceptionInboxItem;
}): readonly string[] {
  const reasons = new Set<string>(input.item.reasonCodes);
  if (!input.allowed) reasons.add('feedback-action-not-allowed-for-lane');
  switch (input.action) {
    case 'approve-candidate':
      reasons.add(input.allowed ? 'feedback-candidate-approved' : 'feedback-approval-blocked');
      break;
    case 'dismiss-candidate':
      reasons.add(input.allowed ? 'feedback-candidate-dismissed' : 'feedback-dismissal-blocked');
      break;
    case 'request-stricter-version':
      reasons.add('feedback-stricter-version-requested');
      reasons.add('feedback-new-candidate-required');
      break;
    case 'edit-threshold':
      reasons.add('feedback-threshold-edit-recorded');
      reasons.add('feedback-new-candidate-required');
      break;
    case 'request-rollback':
      reasons.add('feedback-rollback-request-recorded');
      reasons.add('feedback-new-candidate-required');
      break;
  }
  return Object.freeze([...reasons].sort());
}

function createFeedbackEvent(input: {
  readonly feedback: ApprovalDismissFeedbackInput;
  readonly item: ReviewByExceptionInboxItem;
  readonly generatedAt: string;
}): ApprovalDismissFeedbackEvent {
  validateFeedbackReferences({
    feedback: input.feedback,
    item: input.item,
  });
  const action = normalizeAction(input.feedback.action);
  const reviewerRefDigest = normalizeDigest(input.feedback.reviewerRefDigest, 'reviewerRefDigest');
  const decidedAt = normalizeIsoTimestamp(input.feedback.decidedAt, input.generatedAt, 'decidedAt');
  const reasonDigest = normalizeDigest(input.feedback.reasonDigest, 'reasonDigest');
  const thresholdEdit = normalizeThresholdEdit(
    input.feedback.thresholdEdit,
    action === 'edit-threshold',
  );
  const stricterVersionRequest = normalizeStricterVersionRequest(
    input.feedback.stricterVersionRequest,
    action === 'request-stricter-version',
  );
  const rollbackRequest = normalizeRollbackRequest(
    input.feedback.rollbackRequest,
    action === 'request-rollback',
  );
  const allowed = actionAllowedForItem({ action, item: input.item });
  const outcome = outcomeFor({ action, allowed });
  const reasonCodes = reasonCodesFor({ action, allowed, item: input.item });
  const requiresNewCandidate = outcome === 'new-candidate-required';
  const candidateMayAdvanceToApproved = outcome === 'candidate-approved';
  const feedbackContextDigest = hashCanonical({
    itemId: input.item.itemId,
    itemDigest: input.item.itemDigest,
    reviewContextDigest: input.item.reviewContextDigest,
    action,
    outcome,
    reviewerRefDigest,
    decidedAt,
    reasonDigest,
    thresholdEdit,
    stricterVersionRequest,
    rollbackRequest,
    sourcePolicyCandidateDigest: input.item.sourcePolicyCandidateDigest,
    sourcePolicyTwinCandidateDigest: input.item.sourcePolicyTwinCandidateDigest,
    reasonCodes,
  } as unknown as CanonicalReleaseJsonValue);
  const eventPayload = {
    sourceItemDigest: input.item.itemDigest,
    feedbackContextDigest,
    action,
    outcome,
    reviewerRefDigest,
  };
  const eventDigest = hashCanonical(eventPayload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    eventId: `approval-feedback-${eventDigest.slice('sha256:'.length, 'sha256:'.length + 16)}`,
    eventDigest,
    action,
    outcome,
    accepted: allowed,
    requiresNewCandidate,
    candidateMayAdvanceToApproved,
    sourceItemId: input.item.itemId,
    sourceItemDigest: input.item.itemDigest,
    sourceReviewContextDigest: input.item.reviewContextDigest,
    candidateId: input.item.candidateId,
    surfaceId: input.item.surfaceId,
    actionSurface: input.item.actionSurface,
    sourcePolicyCandidateDigest: input.item.sourcePolicyCandidateDigest,
    sourcePolicyTwinCandidateDigest: input.item.sourcePolicyTwinCandidateDigest,
    reviewerRefDigest,
    decidedAt,
    reasonDigest,
    commentDigest: normalizeOptionalDigest(input.feedback.commentDigest, 'commentDigest'),
    thresholdEdit,
    stricterVersionRequest,
    rollbackRequest,
    reasonCodes,
    feedbackContextDigest,
    approvalRequired: true as const,
    autoEnforce: false as const,
    activatesEnforcement: false as const,
    mutatesPolicyBundle: false as const,
    updatesPolicyCandidate: false as const,
    retrainsModel: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
  });
}

function countsFor(events: readonly ApprovalDismissFeedbackEvent[]): ApprovalDismissFeedbackCounts {
  return Object.freeze({
    approved: events.filter((event) => event.outcome === 'candidate-approved').length,
    dismissed: events.filter((event) => event.outcome === 'candidate-dismissed').length,
    stricterVersionRequested: events.filter((event) =>
      event.action === 'request-stricter-version' && event.accepted
    ).length,
    thresholdEdited: events.filter((event) =>
      event.action === 'edit-threshold' && event.accepted
    ).length,
    rollbackRequested: events.filter((event) =>
      event.action === 'request-rollback' && event.accepted
    ).length,
    blocked: events.filter((event) => event.outcome === 'feedback-blocked').length,
    newCandidateRequired: events.filter((event) => event.requiresNewCandidate).length,
  });
}

function statusFor(counts: ApprovalDismissFeedbackCounts): ApprovalDismissFeedbackStatus {
  const total =
    counts.approved + counts.dismissed + counts.newCandidateRequired + counts.blocked;
  if (total === 0) return 'empty';
  if (counts.blocked > 0) return 'blocked';
  if (counts.newCandidateRequired > 0) return 'new-candidate-required';
  return 'feedback-recorded';
}

export function createApprovalDismissFeedbackLoop(
  input: CreateApprovalDismissFeedbackLoopInput,
): ApprovalDismissFeedbackLoopResult {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    input.reviewByExceptionInbox.generatedAt,
    'generatedAt',
  );
  normalizeDigest(input.reviewByExceptionInbox.digest, 'reviewByExceptionInbox.digest');
  const itemById = new Map(input.reviewByExceptionInbox.items.map((item) => [item.itemId, item]));
  const seenItemIds = new Set<string>();
  const events = Object.freeze(
    input.feedback.map((feedback) => {
      if (seenItemIds.has(feedback.itemId)) {
        throw new Error('Approval/dismiss feedback loop must not contain duplicate item feedback.');
      }
      seenItemIds.add(feedback.itemId);
      const item = itemById.get(feedback.itemId);
      if (item === undefined) {
        throw new Error('Approval/dismiss feedback loop item must exist in the review inbox.');
      }
      return createFeedbackEvent({ feedback, item, generatedAt });
    }).sort((left, right) =>
      left.decidedAt.localeCompare(right.decidedAt) ||
      left.actionSurface.localeCompare(right.actionSurface) ||
      left.eventDigest.localeCompare(right.eventDigest)
    ),
  );
  const counts = countsFor(events);
  const payload = {
    version: APPROVAL_DISMISS_FEEDBACK_LOOP_VERSION as typeof APPROVAL_DISMISS_FEEDBACK_LOOP_VERSION,
    generatedAt,
    reviewByExceptionInboxDigest: input.reviewByExceptionInbox.digest,
    policyCandidatePrContractDigest: input.reviewByExceptionInbox.policyCandidatePrContractDigest,
    policyTwinBacktestDigest: input.reviewByExceptionInbox.policyTwinBacktestDigest,
    tenantRefDigest: input.reviewByExceptionInbox.tenantRefDigest,
    graphDigest: input.reviewByExceptionInbox.graphDigest,
    schemaDigest: input.reviewByExceptionInbox.schemaDigest,
    feedbackCount: events.length,
    acceptedFeedbackCount: events.filter((event) => event.accepted).length,
    blockedFeedbackCount: counts.blocked,
    newCandidateRequiredCount: counts.newCandidateRequired,
    counts,
    status: statusFor(counts),
    events,
    approvalRequired: true as const,
    autoEnforce: false as const,
    activatesEnforcement: false as const,
    mutatesPolicyBundle: false as const,
    updatesPolicyCandidate: false as const,
    retrainsModel: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    structuredFeedbackOnly: true as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function approvalDismissFeedbackLoopDescriptor(): ApprovalDismissFeedbackLoopDescriptor {
  return Object.freeze({
    version: APPROVAL_DISMISS_FEEDBACK_LOOP_VERSION,
    actions: APPROVAL_DISMISS_FEEDBACK_ACTIONS,
    outcomes: APPROVAL_DISMISS_FEEDBACK_OUTCOMES,
    statuses: APPROVAL_DISMISS_FEEDBACK_STATUSES,
    tenantBound: true,
    requiresReviewerDigest: true,
    requiresReasonDigest: true,
    requiresReviewContextDigest: true,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    mutatesPolicyBundle: false,
    updatesPolicyCandidate: false,
    retrainsModel: false,
    rawPayloadStored: false,
    productionReady: false,
    structuredFeedbackOnly: true,
  });
}
