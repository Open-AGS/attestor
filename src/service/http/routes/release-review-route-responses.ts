import type { ReleaseReviewerQueueDetail } from '../../../release-layer/index.js';
import type { IssuedReleaseTokenResponse } from './release-review-route-types.js';
import type { IssuedEvidencePackResponse } from './release-review-routes.js';

export function buildReviewActionResponse(
  review: ReleaseReviewerQueueDetail,
  releaseToken: IssuedReleaseTokenResponse | null,
  evidencePack: IssuedEvidencePackResponse | null,
): Record<string, unknown> {
  return {
    review,
    authority: {
      state: review.authorityState,
      approvalsRequired: review.minimumReviewerCount,
      approvalsRecorded: review.approvalsRecorded,
      approvalsRemaining: review.approvalsRemaining,
      finalized: review.authorityState !== 'pending',
    },
    releaseToken,
    evidencePack,
  };
}
