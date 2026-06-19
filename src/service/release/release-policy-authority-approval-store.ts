import { activationApprovals } from '../../release-policy-control-plane/index.js';
import { getReleaseAuthorityComponent, withReleaseAuthorityAdvisoryLock } from './release-authority-store.js';
import {
  POLICY_ACTIVATION_APPROVALS_TABLE,
  POLICY_ACTIVATION_APPROVAL_COMPONENT,
  POLICY_APPROVAL_MUTATION_LOCK,
  type PolicyActivationApprovalRequest,
  type PolicyActivationApprovalStoreSnapshot,
  type SharedPolicyActivationApprovalListFilters,
  type SharedPolicyActivationApprovalStore,
  type SharedPolicyActivationApprovalStoreSummary,
} from './release-policy-authority-store-types.js';
import {
  compareApprovals,
  freezeClone,
  normalizeApproval,
  rowToApproval,
} from './release-policy-authority-store-mappers.js';
import { ensurePolicyAuthorityTables } from './release-policy-authority-store-schema.js';

export async function ensureSharedPolicyActivationApprovalStore(): Promise<
  SharedPolicyActivationApprovalStoreSummary
> {
  await ensurePolicyAuthorityTables();
  return createSharedPolicyActivationApprovalStore().summary();
}

export function createSharedPolicyActivationApprovalStore(): SharedPolicyActivationApprovalStore {
  return Object.freeze({
    async upsert(
      request: PolicyActivationApprovalRequest,
    ): Promise<PolicyActivationApprovalRequest> {
      await ensurePolicyAuthorityTables();
      const normalized = normalizeApproval(request);
      await withReleaseAuthorityAdvisoryLock(POLICY_APPROVAL_MUTATION_LOCK, (client) =>
        client.query(
          `INSERT INTO ${POLICY_ACTIVATION_APPROVALS_TABLE} (
            request_id, request_state, target_label, pack_id, bundle_id,
            requested_at, expires_at, approval_digest, request_json, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9::jsonb, NOW()
          )
          ON CONFLICT (request_id) DO UPDATE SET
            request_state = EXCLUDED.request_state,
            target_label = EXCLUDED.target_label,
            pack_id = EXCLUDED.pack_id,
            bundle_id = EXCLUDED.bundle_id,
            requested_at = EXCLUDED.requested_at,
            expires_at = EXCLUDED.expires_at,
            approval_digest = EXCLUDED.approval_digest,
            request_json = EXCLUDED.request_json,
            updated_at = EXCLUDED.updated_at`,
          [
            normalized.id,
            normalized.state,
            normalized.targetLabel,
            normalized.bundle.packId,
            normalized.bundle.bundleId,
            normalized.requestedAt,
            normalized.expiresAt,
            normalized.approvalDigest,
            JSON.stringify(normalized),
          ],
        ),
      );
      return normalized;
    },

    async get(id: string): Promise<PolicyActivationApprovalRequest | null> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_APPROVAL_MUTATION_LOCK, (client) =>
        client.query(
          `SELECT *
             FROM ${POLICY_ACTIVATION_APPROVALS_TABLE}
            WHERE request_id = $1
            LIMIT 1`,
          [id],
        ),
      );
      return result.rows.length === 0 ? null : rowToApproval(result.rows[0]!);
    },

    async list(
      filters: SharedPolicyActivationApprovalListFilters = {},
    ): Promise<readonly PolicyActivationApprovalRequest[]> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_APPROVAL_MUTATION_LOCK, (client) =>
        client.query(
          `SELECT *
             FROM ${POLICY_ACTIVATION_APPROVALS_TABLE}
            ORDER BY requested_at DESC, request_id DESC`,
        ),
      );
      return Object.freeze(
        result.rows
          .map(rowToApproval)
          .filter((request) => !filters.state || request.state === filters.state)
          .filter((request) => !filters.targetLabel || request.targetLabel === filters.targetLabel)
          .filter((request) => !filters.bundleId || request.bundle.bundleId === filters.bundleId)
          .filter((request) => !filters.packId || request.bundle.packId === filters.packId)
          .sort(compareApprovals),
      );
    },

    async exportSnapshot(): Promise<PolicyActivationApprovalStoreSnapshot> {
      const requests = await this.list();
      return freezeClone({
        version: activationApprovals.POLICY_ACTIVATION_APPROVAL_STORE_SPEC_VERSION,
        requests,
      }) as PolicyActivationApprovalStoreSnapshot;
    },

    async summary(): Promise<SharedPolicyActivationApprovalStoreSummary> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_APPROVAL_MUTATION_LOCK, (client) =>
        client.query(
          `SELECT COUNT(*)::int AS request_count,
                  COUNT(*) FILTER (WHERE request_state = 'pending')::int AS pending_count,
                  COUNT(*) FILTER (WHERE request_state = 'approved')::int AS approved_count,
                  COUNT(*) FILTER (WHERE request_state = 'rejected')::int AS rejected_count
             FROM ${POLICY_ACTIVATION_APPROVALS_TABLE}`,
        ),
      );
      const component = await getReleaseAuthorityComponent(POLICY_ACTIVATION_APPROVAL_COMPONENT);
      const row = result.rows[0] ?? {};
      return Object.freeze({
        component: POLICY_ACTIVATION_APPROVAL_COMPONENT,
        table: POLICY_ACTIVATION_APPROVALS_TABLE,
        requestCount: Number(row.request_count ?? 0),
        pendingCount: Number(row.pending_count ?? 0),
        approvedCount: Number(row.approved_count ?? 0),
        rejectedCount: Number(row.rejected_count ?? 0),
        componentStatus: component?.status ?? 'pending',
      });
    },
  });
}
