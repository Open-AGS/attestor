import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  PolicyCandidatePrCandidate,
  PolicyCandidatePrContract,
} from './policy-candidate-pr-contract.js';
import type {
  PolicyTwinBacktestCandidateResult,
  PolicyTwinBacktestResult,
} from './policy-twin-backtest.js';

export const REVIEW_BY_EXCEPTION_INBOX_VERSION =
  'attestor.review-by-exception-inbox.v1';

export const REVIEW_BY_EXCEPTION_INBOX_LANES = [
  'failed-replay',
  'blocked-by-evidence',
  'needs-answer',
  'ready-to-approve',
  'monitoring-only',
] as const;
export type ReviewByExceptionInboxLane =
  typeof REVIEW_BY_EXCEPTION_INBOX_LANES[number];

export const REVIEW_BY_EXCEPTION_REQUIRED_ACTIONS = [
  'fix-replay',
  'provide-evidence',
  'answer-question',
  'approve-candidate',
  'monitor',
] as const;
export type ReviewByExceptionRequiredAction =
  typeof REVIEW_BY_EXCEPTION_REQUIRED_ACTIONS[number];

export const REVIEW_BY_EXCEPTION_INBOX_STATUSES = [
  'empty',
  'blocked',
  'needs-human-input',
  'ready-for-approval',
  'monitoring-only',
] as const;
export type ReviewByExceptionInboxStatus =
  typeof REVIEW_BY_EXCEPTION_INBOX_STATUSES[number];

export interface CreateReviewByExceptionInboxInput {
  readonly policyCandidatePrContract: PolicyCandidatePrContract;
  readonly policyTwinBacktest: PolicyTwinBacktestResult;
  readonly generatedAt?: string | null;
}

export interface ReviewByExceptionInboxItem {
  readonly itemId: string;
  readonly itemDigest: string;
  readonly lane: ReviewByExceptionInboxLane;
  readonly requiredAction: ReviewByExceptionRequiredAction;
  readonly humanActionRequired: boolean;
  readonly defaultVisible: boolean;
  readonly approvalBlocked: boolean;
  readonly candidateId: string;
  readonly surfaceId: string;
  readonly actionSurface: string;
  readonly candidateApprovalState: PolicyCandidatePrCandidate['approvalState'];
  readonly candidateRiskBand: PolicyCandidatePrCandidate['riskBand'];
  readonly candidateRiskScore: number;
  readonly sourcePolicyCandidateDigest: string;
  readonly sourcePolicyTwinCandidateDigest: string;
  readonly sourceEvidenceStateDigest: string;
  readonly sourceEventDigests: readonly string[];
  readonly sourceQuestionDigests: readonly string[];
  readonly fixtureDigests: readonly string[];
  readonly noGoReasons: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly priorityScore: number;
  readonly reviewContextDigest: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface ReviewByExceptionInboxLaneCounts {
  readonly failedReplay: number;
  readonly blockedByEvidence: number;
  readonly needsAnswer: number;
  readonly readyToApprove: number;
  readonly monitoringOnly: number;
}

export interface ReviewByExceptionInboxResult {
  readonly version: typeof REVIEW_BY_EXCEPTION_INBOX_VERSION;
  readonly generatedAt: string;
  readonly policyCandidatePrContractDigest: string;
  readonly policyTwinBacktestDigest: string;
  readonly tenantRefDigest: string;
  readonly graphDigest: string;
  readonly schemaDigest: string;
  readonly sourceBacktestStatus: PolicyTwinBacktestResult['status'];
  readonly status: ReviewByExceptionInboxStatus;
  readonly itemCount: number;
  readonly candidateCount: number;
  readonly humanActionItemCount: number;
  readonly defaultVisibleItemCount: number;
  readonly monitoringOnlyCount: number;
  readonly laneCounts: ReviewByExceptionInboxLaneCounts;
  readonly approvalPacketReady: boolean;
  readonly noisyEventInspectionRequired: false;
  readonly oneItemPerCandidate: true;
  readonly eventLevelItemsCreated: false;
  readonly items: readonly ReviewByExceptionInboxItem[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface ReviewByExceptionInboxDescriptor {
  readonly version: typeof REVIEW_BY_EXCEPTION_INBOX_VERSION;
  readonly lanes: typeof REVIEW_BY_EXCEPTION_INBOX_LANES;
  readonly requiredActions: typeof REVIEW_BY_EXCEPTION_REQUIRED_ACTIONS;
  readonly statuses: typeof REVIEW_BY_EXCEPTION_INBOX_STATUSES;
  readonly tenantBound: true;
  readonly oneItemPerCandidate: true;
  readonly noisyEventInspectionRequired: false;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

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
    throw new Error(`Review-by-exception inbox ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeDigest(value: string, fieldName: string): string {
  if (!SHA256_DIGEST_PATTERN.test(value)) {
    throw new Error(`Review-by-exception inbox ${fieldName} must be a sha256 digest.`);
  }
  return value;
}

function validateSources(input: {
  readonly contract: PolicyCandidatePrContract;
  readonly backtest: PolicyTwinBacktestResult;
}): void {
  if (input.backtest.policyCandidatePrContractDigest !== input.contract.digest) {
    throw new Error(
      'Review-by-exception inbox Policy Twin source digest must match policy candidate PR contract digest.',
    );
  }
  if (input.backtest.tenantRefDigest !== input.contract.tenantRefDigest) {
    throw new Error(
      'Review-by-exception inbox Policy Twin tenant digest must match policy candidate PR contract tenant digest.',
    );
  }
  if (input.backtest.graphDigest !== input.contract.graphDigest) {
    throw new Error(
      'Review-by-exception inbox Policy Twin graph digest must match policy candidate PR contract graph digest.',
    );
  }
  if (input.backtest.schemaDigest !== input.contract.schemaDigest) {
    throw new Error(
      'Review-by-exception inbox Policy Twin schema digest must match policy candidate PR contract schema digest.',
    );
  }
}

function validateCandidateCoverage(input: {
  readonly contract: PolicyCandidatePrContract;
  readonly backtest: PolicyTwinBacktestResult;
}): void {
  const contractIds = new Set(input.contract.candidates.map((candidate) => candidate.candidateId));
  const backtestIds = new Set(input.backtest.candidateResults.map((candidate) => candidate.candidateId));
  for (const candidateId of contractIds) {
    if (!backtestIds.has(candidateId)) {
      throw new Error(
        'Review-by-exception inbox Policy Twin result must include every policy candidate.',
      );
    }
  }
  for (const candidateId of backtestIds) {
    if (!contractIds.has(candidateId)) {
      throw new Error(
        'Review-by-exception inbox Policy Twin result must not include unknown policy candidates.',
      );
    }
  }
}

function candidateDigest(
  candidate: PolicyTwinBacktestCandidateResult,
): string {
  return hashCanonical({
    candidateId: candidate.candidateId,
    status: candidate.status,
    historicalDecision: candidate.historicalDecision,
    fixtureDigests: candidate.fixtureDigests,
    noGoReasons: candidate.noGoReasons,
  });
}

function laneFor(input: {
  readonly candidate: PolicyCandidatePrCandidate;
  readonly backtestCandidate: PolicyTwinBacktestCandidateResult;
}): ReviewByExceptionInboxLane {
  const noGo = new Set(input.backtestCandidate.noGoReasons);
  if (
    input.backtestCandidate.status === 'counterexamples-failed' ||
    input.backtestCandidate.falseAdmitRiskCount > 0 ||
    input.backtestCandidate.fixtureOutcomeMismatchCount > 0 ||
    noGo.has('policy-twin-counterexample-false-admit') ||
    noGo.has('policy-twin-counterexample-outcome-mismatch')
  ) {
    return 'failed-replay';
  }
  if (
    input.candidate.approvalState === 'blocked' ||
    input.backtestCandidate.missedEvidenceCount > 0 ||
    input.backtestCandidate.missingReplayDigest ||
    noGo.has('policy-twin-source-events-missing') ||
    noGo.has('policy-twin-counterexamples-missing') ||
    noGo.has('policy-twin-missed-evidence') ||
    noGo.has('policy-twin-replay-digest-missing') ||
    noGo.has('policy-twin-historical-blocks')
  ) {
    return 'blocked-by-evidence';
  }
  if (
    input.candidate.approvalState === 'draft' ||
    input.candidate.approvalState === 'needs-answer' ||
    input.backtestCandidate.unresolvedQuestionCount > 0 ||
    noGo.has('policy-twin-active-question-open') ||
    noGo.has('policy-twin-historical-review-required')
  ) {
    return 'needs-answer';
  }
  if (
    input.candidate.approvalState === 'approved' &&
    input.backtestCandidate.status === 'backtest-passed'
  ) {
    return 'monitoring-only';
  }
  if (
    input.candidate.approvalState === 'approval-ready' &&
    input.backtestCandidate.status === 'backtest-passed' &&
    input.backtestCandidate.noGoReasons.length === 0
  ) {
    return 'ready-to-approve';
  }
  return 'needs-answer';
}

function requiredActionFor(lane: ReviewByExceptionInboxLane): ReviewByExceptionRequiredAction {
  switch (lane) {
    case 'failed-replay':
      return 'fix-replay';
    case 'blocked-by-evidence':
      return 'provide-evidence';
    case 'needs-answer':
      return 'answer-question';
    case 'ready-to-approve':
      return 'approve-candidate';
    case 'monitoring-only':
      return 'monitor';
  }
}

function reasonCodesFor(input: {
  readonly lane: ReviewByExceptionInboxLane;
  readonly candidate: PolicyCandidatePrCandidate;
  readonly backtestCandidate: PolicyTwinBacktestCandidateResult;
}): readonly string[] {
  const reasons = new Set<string>();
  for (const reason of input.backtestCandidate.noGoReasons) reasons.add(reason);
  switch (input.lane) {
    case 'failed-replay':
      reasons.add('review-inbox-failed-replay');
      break;
    case 'blocked-by-evidence':
      reasons.add('review-inbox-evidence-or-replay-blocker');
      break;
    case 'needs-answer':
      reasons.add('review-inbox-human-answer-required');
      break;
    case 'ready-to-approve':
      reasons.add('review-inbox-approval-ready');
      break;
    case 'monitoring-only':
      reasons.add('review-inbox-monitoring-only');
      break;
  }
  if (input.candidate.approvalState === 'draft') reasons.add('review-inbox-candidate-draft');
  if (input.candidate.approvalState === 'blocked') reasons.add('review-inbox-candidate-blocked');
  if (input.candidate.approvalState === 'approved') reasons.add('review-inbox-candidate-approved');
  return Object.freeze([...reasons].sort());
}

function priorityScore(input: {
  readonly lane: ReviewByExceptionInboxLane;
  readonly candidate: PolicyCandidatePrCandidate;
  readonly backtestCandidate: PolicyTwinBacktestCandidateResult;
}): number {
  const riskWeight = Math.ceil(input.candidate.riskScore / 10);
  switch (input.lane) {
    case 'failed-replay':
      return Math.min(
        100,
        90 + riskWeight + input.backtestCandidate.falseAdmitRiskCount +
          input.backtestCandidate.fixtureOutcomeMismatchCount,
      );
    case 'blocked-by-evidence':
      return Math.min(
        89,
        70 + riskWeight + input.backtestCandidate.missedEvidenceCount +
          (input.backtestCandidate.missingReplayDigest ? 5 : 0),
      );
    case 'needs-answer':
      return Math.min(69, 50 + riskWeight + input.backtestCandidate.unresolvedQuestionCount);
    case 'ready-to-approve':
      return Math.min(49, 30 + riskWeight);
    case 'monitoring-only':
      return Math.min(29, 10 + riskWeight);
  }
}

function makeItem(input: {
  readonly candidate: PolicyCandidatePrCandidate;
  readonly backtestCandidate: PolicyTwinBacktestCandidateResult;
}): ReviewByExceptionInboxItem {
  const lane = laneFor(input);
  const requiredAction = requiredActionFor(lane);
  const humanActionRequired = lane !== 'monitoring-only';
  const defaultVisible = humanActionRequired;
  const approvalBlocked =
    lane === 'failed-replay' || lane === 'blocked-by-evidence' || lane === 'needs-answer';
  const sourcePolicyTwinCandidateDigest = candidateDigest(input.backtestCandidate);
  const reasonCodes = reasonCodesFor({ ...input, lane });
  const reviewContextDigest = hashCanonical({
    candidateId: input.candidate.candidateId,
    lane,
    requiredAction,
    sourcePolicyCandidateDigest: input.candidate.digest,
    sourcePolicyTwinCandidateDigest,
    sourceEvidenceStateDigest: input.candidate.sourceEvidenceStateDigest,
    sourceEventDigests: input.backtestCandidate.sourceEventDigests,
    fixtureDigests: input.backtestCandidate.fixtureDigests,
    sourceQuestionDigests: input.candidate.questionDigests,
    reasonCodes,
  });
  const itemPayload = {
    lane,
    requiredAction,
    candidateId: input.candidate.candidateId,
    surfaceId: input.candidate.surfaceId,
    actionSurface: input.candidate.actionSurface,
    sourcePolicyCandidateDigest: input.candidate.digest,
    sourcePolicyTwinCandidateDigest,
    reviewContextDigest,
  };
  const itemDigest = hashCanonical(itemPayload);
  return Object.freeze({
    itemId: `review-inbox-${itemDigest.slice('sha256:'.length, 'sha256:'.length + 16)}`,
    itemDigest,
    lane,
    requiredAction,
    humanActionRequired,
    defaultVisible,
    approvalBlocked,
    candidateId: input.candidate.candidateId,
    surfaceId: input.candidate.surfaceId,
    actionSurface: input.candidate.actionSurface,
    candidateApprovalState: input.candidate.approvalState,
    candidateRiskBand: input.candidate.riskBand,
    candidateRiskScore: input.candidate.riskScore,
    sourcePolicyCandidateDigest: input.candidate.digest,
    sourcePolicyTwinCandidateDigest,
    sourceEvidenceStateDigest: input.candidate.sourceEvidenceStateDigest,
    sourceEventDigests: input.backtestCandidate.sourceEventDigests,
    sourceQuestionDigests: input.candidate.questionDigests,
    fixtureDigests: input.backtestCandidate.fixtureDigests,
    noGoReasons: input.backtestCandidate.noGoReasons,
    reasonCodes,
    priorityScore: priorityScore({ ...input, lane }),
    reviewContextDigest,
    approvalRequired: true as const,
    autoEnforce: false as const,
    activatesEnforcement: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
  });
}

function laneCounts(items: readonly ReviewByExceptionInboxItem[]): ReviewByExceptionInboxLaneCounts {
  return Object.freeze({
    failedReplay: items.filter((item) => item.lane === 'failed-replay').length,
    blockedByEvidence: items.filter((item) => item.lane === 'blocked-by-evidence').length,
    needsAnswer: items.filter((item) => item.lane === 'needs-answer').length,
    readyToApprove: items.filter((item) => item.lane === 'ready-to-approve').length,
    monitoringOnly: items.filter((item) => item.lane === 'monitoring-only').length,
  });
}

function statusFor(counts: ReviewByExceptionInboxLaneCounts): ReviewByExceptionInboxStatus {
  const total =
    counts.failedReplay + counts.blockedByEvidence + counts.needsAnswer +
    counts.readyToApprove + counts.monitoringOnly;
  if (total === 0) return 'empty';
  if (counts.failedReplay > 0 || counts.blockedByEvidence > 0) return 'blocked';
  if (counts.needsAnswer > 0) return 'needs-human-input';
  if (counts.readyToApprove > 0) return 'ready-for-approval';
  return 'monitoring-only';
}

export function createReviewByExceptionInbox(
  input: CreateReviewByExceptionInboxInput,
): ReviewByExceptionInboxResult {
  validateSources({
    contract: input.policyCandidatePrContract,
    backtest: input.policyTwinBacktest,
  });
  validateCandidateCoverage({
    contract: input.policyCandidatePrContract,
    backtest: input.policyTwinBacktest,
  });
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    input.policyTwinBacktest.generatedAt,
    'generatedAt',
  );
  normalizeDigest(input.policyTwinBacktest.digest, 'policyTwinBacktest.digest');
  const candidatesById = new Map(
    input.policyCandidatePrContract.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const items = Object.freeze(
    input.policyTwinBacktest.candidateResults.map((backtestCandidate) => {
      const candidate = candidatesById.get(backtestCandidate.candidateId);
      if (candidate === undefined) {
        throw new Error(
          'Review-by-exception inbox Policy Twin result must not include unknown policy candidates.',
        );
      }
      return makeItem({ candidate, backtestCandidate });
    }).sort((left, right) =>
      REVIEW_BY_EXCEPTION_INBOX_LANES.indexOf(left.lane) -
        REVIEW_BY_EXCEPTION_INBOX_LANES.indexOf(right.lane) ||
      right.priorityScore - left.priorityScore ||
      left.actionSurface.localeCompare(right.actionSurface) ||
      left.candidateId.localeCompare(right.candidateId)
    ),
  );
  const counts = laneCounts(items);
  const status = statusFor(counts);
  const humanActionItemCount = items.filter((item) => item.humanActionRequired).length;
  const defaultVisibleItemCount = items.filter((item) => item.defaultVisible).length;
  const payload = {
    version: REVIEW_BY_EXCEPTION_INBOX_VERSION as typeof REVIEW_BY_EXCEPTION_INBOX_VERSION,
    generatedAt,
    policyCandidatePrContractDigest: input.policyCandidatePrContract.digest,
    policyTwinBacktestDigest: input.policyTwinBacktest.digest,
    tenantRefDigest: input.policyCandidatePrContract.tenantRefDigest,
    graphDigest: input.policyCandidatePrContract.graphDigest,
    schemaDigest: input.policyCandidatePrContract.schemaDigest,
    sourceBacktestStatus: input.policyTwinBacktest.status,
    status,
    itemCount: items.length,
    candidateCount: input.policyCandidatePrContract.candidateCount,
    humanActionItemCount,
    defaultVisibleItemCount,
    monitoringOnlyCount: counts.monitoringOnly,
    laneCounts: counts,
    approvalPacketReady:
      counts.readyToApprove > 0 &&
      counts.failedReplay === 0 &&
      counts.blockedByEvidence === 0 &&
      counts.needsAnswer === 0,
    noisyEventInspectionRequired: false as const,
    oneItemPerCandidate: true as const,
    eventLevelItemsCreated: false as const,
    items,
    approvalRequired: true as const,
    autoEnforce: false as const,
    activatesEnforcement: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    reviewMaterialOnly: true as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function reviewByExceptionInboxDescriptor(): ReviewByExceptionInboxDescriptor {
  return Object.freeze({
    version: REVIEW_BY_EXCEPTION_INBOX_VERSION,
    lanes: REVIEW_BY_EXCEPTION_INBOX_LANES,
    requiredActions: REVIEW_BY_EXCEPTION_REQUIRED_ACTIONS,
    statuses: REVIEW_BY_EXCEPTION_INBOX_STATUSES,
    tenantBound: true,
    oneItemPerCandidate: true,
    noisyEventInspectionRequired: false,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    productionReady: false,
    reviewMaterialOnly: true,
  });
}
