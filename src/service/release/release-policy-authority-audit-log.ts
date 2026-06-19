import { auditLog } from '../../release-policy-control-plane/index.js';
import { getReleaseAuthorityComponent, withReleaseAuthorityAdvisoryLock } from './release-authority-store.js';
import {
  POLICY_AUDIT_APPEND_LOCK,
  POLICY_MUTATION_AUDIT_COMPONENT,
  POLICY_MUTATION_AUDIT_TABLE,
  SharedPolicyAuthorityStoreError,
  type PolicyMutationAuditAppendInput,
  type PolicyMutationAuditEntry,
  type PolicyMutationAuditSnapshot,
  type PolicyMutationAuditVerificationResult,
  type SharedPolicyMutationAuditLogSummary,
  type SharedPolicyMutationAuditLogWriter,
} from './release-policy-authority-store-types.js';
import { freezeClone, rowToAuditEntry } from './release-policy-authority-store-mappers.js';
import {
  appendPolicyAuditWithClient,
  ensurePolicyAuthorityTables,
  latestPolicyAuditDigest,
} from './release-policy-authority-store-schema.js';

export async function ensureSharedPolicyMutationAuditLog(): Promise<
  SharedPolicyMutationAuditLogSummary
> {
  await ensurePolicyAuthorityTables();
  return createSharedPolicyMutationAuditLogWriter().summary();
}

export function createSharedPolicyMutationAuditLogWriter(): SharedPolicyMutationAuditLogWriter {
  async function entriesFromRows(): Promise<readonly PolicyMutationAuditEntry[]> {
    const result = await withReleaseAuthorityAdvisoryLock(POLICY_AUDIT_APPEND_LOCK, (client) =>
      client.query(
        `SELECT *
           FROM ${POLICY_MUTATION_AUDIT_TABLE}
          ORDER BY sequence ASC`,
      ),
    );
    const entries = result.rows.map(rowToAuditEntry);
    const verification = auditLog.verifyPolicyMutationAuditLogChain(entries);
    if (!verification.valid) {
      throw new SharedPolicyAuthorityStoreError(
        `Shared policy mutation audit log is invalid at entry ${verification.brokenEntryId ?? 'unknown'}.`,
      );
    }
    return Object.freeze(entries);
  }

  return Object.freeze({
    async append(input: PolicyMutationAuditAppendInput): Promise<PolicyMutationAuditEntry> {
      await ensurePolicyAuthorityTables();
      return withReleaseAuthorityAdvisoryLock(POLICY_AUDIT_APPEND_LOCK, async (client) => {
        return appendPolicyAuditWithClient(client, input);
      });
    },

    async entries(): Promise<readonly PolicyMutationAuditEntry[]> {
      await ensurePolicyAuthorityTables();
      return entriesFromRows();
    },

    async latestEntryDigest(): Promise<string | null> {
      await ensurePolicyAuthorityTables();
      return withReleaseAuthorityAdvisoryLock(POLICY_AUDIT_APPEND_LOCK, latestPolicyAuditDigest);
    },

    async verify(): Promise<PolicyMutationAuditVerificationResult> {
      const entries = await this.entries();
      return auditLog.verifyPolicyMutationAuditLogChain(entries);
    },

    async exportSnapshot(): Promise<PolicyMutationAuditSnapshot> {
      const entries = await this.entries();
      return freezeClone({
        version: auditLog.POLICY_MUTATION_AUDIT_FILE_SPEC_VERSION,
        entries,
      }) as PolicyMutationAuditSnapshot;
    },

    async summary(): Promise<SharedPolicyMutationAuditLogSummary> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_AUDIT_APPEND_LOCK, async (client) => {
        const count = await client.query(
          `SELECT COUNT(*)::int AS entry_count,
                  COALESCE(MAX(sequence), 0)::int AS latest_sequence
             FROM ${POLICY_MUTATION_AUDIT_TABLE}`,
        );
        const latestDigest = await latestPolicyAuditDigest(client);
        return {
          entryCount: Number(count.rows[0]?.entry_count ?? 0),
          latestSequence: Number(count.rows[0]?.latest_sequence ?? 0),
          latestEntryDigest: latestDigest,
        };
      });
      const component = await getReleaseAuthorityComponent(POLICY_MUTATION_AUDIT_COMPONENT);
      return Object.freeze({
        component: POLICY_MUTATION_AUDIT_COMPONENT,
        table: POLICY_MUTATION_AUDIT_TABLE,
        ...result,
        componentStatus: component?.status ?? 'pending',
      });
    },
  });
}
