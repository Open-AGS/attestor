import { store as policyStore } from '../../release-policy-control-plane/index.js';
import { getReleaseAuthorityComponent, withReleaseAuthorityAdvisoryLock, withReleaseAuthorityAdvisoryLocks } from './release-authority-store.js';
import {
  POLICY_ACTIVATIONS_TABLE,
  POLICY_AUDIT_APPEND_LOCK,
  POLICY_BUNDLES_TABLE,
  POLICY_CONTROL_PLANE_COMPONENT,
  POLICY_METADATA_TABLE,
  POLICY_PACKS_TABLE,
  POLICY_STORE_MUTATION_LOCK,
  type PolicyActivationRecord,
  type PolicyControlPlaneMetadata,
  type PolicyPackMetadata,
  type PolicyStoreSnapshot,
  type SharedPolicyActivationLifecycleMutationInput,
  type SharedPolicyActivationLifecycleMutationResult,
  type SharedPolicyActivationLifecycleResult,
  type SharedPolicyControlPlaneStore,
  type SharedPolicyControlPlaneStoreSummary,
  type StoredPolicyBundleRecord,
  type UpsertStoredPolicyBundleInput,
} from './release-policy-authority-store-types.js';
import {
  compareActivations,
  compareBundles,
  normalizeBundle,
  normalizeMetadata,
  normalizePack,
  rowToActivation,
  rowToBundle,
  rowToMetadata,
  rowToPack,
} from './release-policy-authority-store-mappers.js';
import {
  appendPolicyAuditWithClient,
  ensurePolicyAuthorityTables,
  policyStoreSnapshotFromClient,
  setMetadataWithClient,
  upsertActivationWithClient,
} from './release-policy-authority-store-schema.js';

export async function ensureSharedPolicyControlPlaneStore(): Promise<
  SharedPolicyControlPlaneStoreSummary
> {
  await ensurePolicyAuthorityTables();
  return createSharedPolicyControlPlaneStore().summary();
}

export function createSharedPolicyControlPlaneStore(): SharedPolicyControlPlaneStore {
  return Object.freeze({
    async getMetadata(): Promise<PolicyControlPlaneMetadata | null> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        client.query(
          `SELECT metadata_json
             FROM ${POLICY_METADATA_TABLE}
            WHERE singleton = TRUE
            LIMIT 1`,
        ),
      );
      return result.rows.length === 0 ? null : rowToMetadata(result.rows[0]!);
    },

    async setMetadata(metadata: PolicyControlPlaneMetadata): Promise<PolicyControlPlaneMetadata> {
      await ensurePolicyAuthorityTables();
      await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        setMetadataWithClient(client, metadata),
      );
      return normalizeMetadata(metadata);
    },

    async upsertPack(pack: PolicyPackMetadata): Promise<PolicyPackMetadata> {
      await ensurePolicyAuthorityTables();
      const normalized = normalizePack(pack);
      await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        client.query(
          `INSERT INTO ${POLICY_PACKS_TABLE} (
            pack_id, lifecycle_state, latest_bundle_id, latest_bundle_version, pack_json, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5::jsonb, NOW()
          )
          ON CONFLICT (pack_id) DO UPDATE SET
            lifecycle_state = EXCLUDED.lifecycle_state,
            latest_bundle_id = EXCLUDED.latest_bundle_id,
            latest_bundle_version = EXCLUDED.latest_bundle_version,
            pack_json = EXCLUDED.pack_json,
            updated_at = EXCLUDED.updated_at`,
          [
            normalized.id,
            normalized.lifecycleState,
            normalized.latestBundleRef?.bundleId ?? null,
            normalized.latestBundleRef?.bundleVersion ?? null,
            JSON.stringify(normalized),
          ],
        ),
      );
      return normalized;
    },

    async getPack(packId: string): Promise<PolicyPackMetadata | null> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        client.query(
          `SELECT *
             FROM ${POLICY_PACKS_TABLE}
            WHERE pack_id = $1
            LIMIT 1`,
          [packId],
        ),
      );
      return result.rows.length === 0 ? null : rowToPack(result.rows[0]!);
    },

    async listPacks(): Promise<readonly PolicyPackMetadata[]> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        client.query(
          `SELECT *
             FROM ${POLICY_PACKS_TABLE}
            ORDER BY pack_id ASC`,
        ),
      );
      return Object.freeze(result.rows.map(rowToPack));
    },

    async upsertBundle(input: UpsertStoredPolicyBundleInput): Promise<StoredPolicyBundleRecord> {
      await ensurePolicyAuthorityTables();
      const normalized = normalizeBundle(input);
      await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, async (client) => {
        const existing = await client.query(
          `SELECT *
             FROM ${POLICY_BUNDLES_TABLE}
            WHERE pack_id = $1 AND bundle_id = $2
            LIMIT 1`,
          [normalized.packId, normalized.bundleId],
        );
        if (existing.rows.length > 0) {
          policyStore.assertBundleRecordContentIsImmutable(
            rowToBundle(existing.rows[0]!),
            normalized,
          );
        }
        await client.query(
          `INSERT INTO ${POLICY_BUNDLES_TABLE} (
            pack_id, bundle_id, bundle_version, stored_at, bundle_json, updated_at
          ) VALUES (
            $1, $2, $3, $4::timestamptz, $5::jsonb, NOW()
          )
          ON CONFLICT (pack_id, bundle_id) DO UPDATE SET
            bundle_version = EXCLUDED.bundle_version,
            stored_at = EXCLUDED.stored_at,
            bundle_json = EXCLUDED.bundle_json,
            updated_at = EXCLUDED.updated_at`,
          [
            normalized.packId,
            normalized.bundleId,
            normalized.bundleVersion,
            normalized.storedAt,
            JSON.stringify(normalized),
          ],
        );
      });
      return normalized;
    },

    async getBundle(
      packId: string,
      bundleId: string,
    ): Promise<StoredPolicyBundleRecord | null> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        client.query(
          `SELECT *
             FROM ${POLICY_BUNDLES_TABLE}
            WHERE pack_id = $1 AND bundle_id = $2
            LIMIT 1`,
          [packId, bundleId],
        ),
      );
      return result.rows.length === 0 ? null : rowToBundle(result.rows[0]!);
    },

    async listBundleHistory(packId: string): Promise<readonly StoredPolicyBundleRecord[]> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        client.query(
          `SELECT *
             FROM ${POLICY_BUNDLES_TABLE}
            WHERE pack_id = $1
            ORDER BY stored_at DESC, bundle_version DESC, bundle_id DESC`,
          [packId],
        ),
      );
      return Object.freeze(result.rows.map(rowToBundle).sort(compareBundles));
    },

    async listBundles(): Promise<readonly StoredPolicyBundleRecord[]> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        client.query(
          `SELECT *
             FROM ${POLICY_BUNDLES_TABLE}
            ORDER BY stored_at DESC, bundle_version DESC, bundle_id DESC`,
        ),
      );
      return Object.freeze(result.rows.map(rowToBundle).sort(compareBundles));
    },

    async upsertActivation(record: PolicyActivationRecord): Promise<PolicyActivationRecord> {
      await ensurePolicyAuthorityTables();
      return withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        upsertActivationWithClient(client, record),
      );
    },

    async applyActivationLifecycle<T extends SharedPolicyActivationLifecycleResult>(
      input: SharedPolicyActivationLifecycleMutationInput<T>,
    ): Promise<SharedPolicyActivationLifecycleMutationResult<T>> {
      await ensurePolicyAuthorityTables();
      return withReleaseAuthorityAdvisoryLocks(
        [POLICY_STORE_MUTATION_LOCK, POLICY_AUDIT_APPEND_LOCK],
        async (client) => {
          const localStore = policyStore.createInMemoryPolicyControlPlaneStoreFromSnapshot(
            await policyStoreSnapshotFromClient(client),
          );
          const lifecycle = input.action(localStore);
          await upsertActivationWithClient(client, lifecycle.appliedRecord);
          if (lifecycle.updatedHistoricalRecord) {
            await upsertActivationWithClient(client, lifecycle.updatedHistoricalRecord);
          }

          const metadata = input.createMetadata?.(localStore, lifecycle) ?? null;
          if (metadata) {
            await setMetadataWithClient(client, metadata);
          }

          const auditInput = input.createAudit?.(lifecycle) ?? null;
          const audit =
            auditInput === null
              ? null
              : await appendPolicyAuditWithClient(client, auditInput);
          return Object.freeze({ lifecycle, audit });
        },
      );
    },

    async getActivation(id: string): Promise<PolicyActivationRecord | null> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        client.query(
          `SELECT *
             FROM ${POLICY_ACTIVATIONS_TABLE}
            WHERE activation_id = $1
            LIMIT 1`,
          [id],
        ),
      );
      return result.rows.length === 0 ? null : rowToActivation(result.rows[0]!);
    },

    async listActivations(): Promise<readonly PolicyActivationRecord[]> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        client.query(
          `SELECT *
             FROM ${POLICY_ACTIVATIONS_TABLE}
            ORDER BY activated_at DESC, activation_id DESC`,
        ),
      );
      return Object.freeze(result.rows.map(rowToActivation).sort(compareActivations));
    },

    async exportSnapshot(): Promise<PolicyStoreSnapshot> {
      await ensurePolicyAuthorityTables();
      return withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, (client) =>
        policyStoreSnapshotFromClient(client),
      );
    },

    async summary(): Promise<SharedPolicyControlPlaneStoreSummary> {
      await ensurePolicyAuthorityTables();
      const result = await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, async (client) => {
        const metadata = await client.query(
          `SELECT COUNT(*)::int AS count
             FROM ${POLICY_METADATA_TABLE}`,
        );
        const packs = await client.query(
          `SELECT COUNT(*)::int AS count
             FROM ${POLICY_PACKS_TABLE}`,
        );
        const bundles = await client.query(
          `SELECT COUNT(*)::int AS count
             FROM ${POLICY_BUNDLES_TABLE}`,
        );
        const activations = await client.query(
          `SELECT COUNT(*)::int AS count
             FROM ${POLICY_ACTIVATIONS_TABLE}`,
        );
        return {
          hasMetadata: Number(metadata.rows[0]?.count ?? 0) > 0,
          packCount: Number(packs.rows[0]?.count ?? 0),
          bundleCount: Number(bundles.rows[0]?.count ?? 0),
          activationCount: Number(activations.rows[0]?.count ?? 0),
        };
      });
      const component = await getReleaseAuthorityComponent(POLICY_CONTROL_PLANE_COMPONENT);
      return Object.freeze({
        component: POLICY_CONTROL_PLANE_COMPONENT,
        metadataTable: POLICY_METADATA_TABLE,
        packsTable: POLICY_PACKS_TABLE,
        bundlesTable: POLICY_BUNDLES_TABLE,
        activationsTable: POLICY_ACTIVATIONS_TABLE,
        ...result,
        componentStatus: component?.status ?? 'pending',
      });
    },
  });
}
