import type {
  ReleaseEvidenceTokenPolicyContext,
  ReleaseReviewerQueueDetail,
} from '../../../release-layer/index.js';
import type { AdminAuditAction } from '../../admin-audit-log.js';

export type AdminMutationRequestResult = {
  idempotencyKey: string | null;
  requestHash: string;
};

export interface AdminMutationFinalizationInput {
  idempotencyKey: string | null;
  routeId: string;
  requestPayload: unknown;
  statusCode: number;
  responseBody: Record<string, unknown>;
  audit: {
    action: AdminAuditAction;
    accountId?: string | null;
    tenantId?: string | null;
    tenantKeyId?: string | null;
    planId?: string | null;
    monthlyRunQuota?: number | null;
    requestHash?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface IssuedReleaseTokenResponse extends Record<string, unknown> {
  tokenId: string;
  token: string;
  expiresAt: string;
  targetId: string;
  decisionId: string;
  ttlSeconds: number;
  override: boolean;
  tenantId: string | null;
  senderConstrained: boolean;
  presentationRequired: 'sender-constrained';
  policyVersion: string | null;
  policyHash: string;
  policyIrHash: string | null;
  policyProvenanceSource: ReleaseReviewerQueueDetail['policyProvenanceSource'];
  compiledPolicyIndexVersion: string | null;
  compiledPolicyIrVersion: string | null;
  policyContext: ReleaseEvidenceTokenPolicyContext;
}
