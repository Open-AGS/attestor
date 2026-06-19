import { createHash } from 'node:crypto';
import type {
  ReleaseDecision,
  ReleaseDecisionLogPhase,
  ReleaseReviewerQueueRecord,
} from '../../../release-layer/index.js';
import type { RequestPathReleaseDecisionLogWriter } from '../../release/release-authority-request-path.js';

export function releaseReviewTenantId(record: ReleaseReviewerQueueRecord): string | null {
  if (record.detail.tenantId) {
    return record.detail.tenantId;
  }
  const requesterId = record.releaseDecision.requester.id.trim();
  const tenantPrefix = 'tenant:';
  if (requesterId.startsWith(tenantPrefix)) {
    const tenantId = requesterId.slice(tenantPrefix.length).trim();
    return tenantId.length > 0 ? tenantId : null;
  }
  return null;
}

export function releaseReviewClosureId(
  prefix: 'rt' | 'ep',
  record: ReleaseReviewerQueueRecord,
): string {
  const digest = createHash('sha256')
    .update(record.detail.id)
    .update('\n')
    .update(record.detail.decisionId)
    .update('\n')
    .update(record.detail.authorityState)
    .digest('hex')
    .slice(0, 40);
  return `${prefix}_${digest}`;
}

export function releaseReviewTerminalOccurredAt(
  record: ReleaseReviewerQueueRecord,
  fallback: string,
): string {
  for (const entry of [...record.detail.timeline].reverse()) {
    if (entry.phase === 'terminal-accept') {
      return entry.occurredAt;
    }
  }
  return fallback;
}

export function releaseReviewClosureNeedsRepair(
  record: ReleaseReviewerQueueRecord,
  authorityState: 'approved' | 'overridden',
): boolean {
  return (
    record.detail.authorityState === authorityState &&
    (
      record.detail.issuedReleaseToken === null ||
      record.detail.evidencePackId === null ||
      record.releaseDecision.releaseTokenId === undefined ||
      record.releaseDecision.evidencePackId === undefined
    )
  );
}

export async function appendReviewerTimelineToDecisionLog(
  writer: RequestPathReleaseDecisionLogWriter,
  decision: ReleaseDecision,
  occurredAt: string,
  requestId: string,
  phase: Extract<
    ReleaseDecisionLogPhase,
    'review' | 'override' | 'evidence-pack' | 'terminal-accept' | 'terminal-deny'
  >,
): Promise<void> {
  await writer.append({
    occurredAt,
    requestId,
    phase,
    matchedPolicyId: decision.policyVersion,
    decision,
    metadata: {
      policyMatched: true,
      pendingChecks: [],
      pendingEvidenceKinds: [],
      requiresReview: decision.status === 'hold' || decision.status === 'review-required',
      deterministicChecksCompleted: true,
      effectivePolicyId: null,
      rolloutMode: null,
      rolloutEvaluationMode: null,
      rolloutReason: null,
      rolloutCanaryBucket: null,
      rolloutFallbackPolicyId: null,
    },
  });
}

export async function appendReviewerTimelineToDecisionLogOnce(
  writer: RequestPathReleaseDecisionLogWriter,
  decision: ReleaseDecision,
  occurredAt: string,
  requestId: string,
  phase: Extract<
    ReleaseDecisionLogPhase,
    'review' | 'override' | 'evidence-pack' | 'terminal-accept' | 'terminal-deny'
  >,
): Promise<void> {
  const entries = await writer.entries();
  if (
    entries.some(
      (entry) =>
        entry.requestId === requestId &&
        entry.phase === phase &&
        entry.decisionId === decision.id,
    )
  ) {
    return;
  }
  await appendReviewerTimelineToDecisionLog(writer, decision, occurredAt, requestId, phase);
}
