import {
  auditLog,
  store as policyStore,
} from '../../release-policy-control-plane/index.js';
import {
  ensureReleaseAuthorityStore,
  getReleaseAuthorityComponent,
  recordReleaseAuthorityComponentState,
  resetReleaseAuthorityStoreForTests,
  withReleaseAuthorityAdvisoryLock,
  type ReleaseAuthorityPgClient,
} from './release-authority-store.js';
import {
  POLICY_ACTIVATIONS_TABLE,
  POLICY_ACTIVATION_APPROVALS_TABLE,
  POLICY_ACTIVATION_APPROVAL_COMPONENT,
  POLICY_BUNDLES_TABLE,
  POLICY_CONTROL_PLANE_COMPONENT,
  POLICY_METADATA_TABLE,
  POLICY_MUTATION_AUDIT_COMPONENT,
  POLICY_MUTATION_AUDIT_TABLE,
  POLICY_PACKS_TABLE,
  POLICY_STORE_MUTATION_LOCK,
  SHARED_POLICY_AUTHORITY_STORE_VERSION,
  type PolicyActivationRecord,
  type PolicyControlPlaneMetadata,
  type PolicyMutationAuditAppendInput,
  type PolicyMutationAuditEntry,
  type PolicyStoreSnapshot,
} from './release-policy-authority-store-types.js';
import {
  compareActivations,
  compareBundles,
  freezeClone,
  normalizeActivation,
  normalizeMetadata,
  rowToActivation,
  rowToBundle,
  rowToMetadata,
  rowToPack,
} from './release-policy-authority-store-mappers.js';

let initPromise: Promise<void> | null = null;

export async function latestPolicyAuditDigest(client: ReleaseAuthorityPgClient): Promise<string | null> {
  const result = await client.query(
    `SELECT entry_digest
       FROM ${POLICY_MUTATION_AUDIT_TABLE}
      ORDER BY sequence DESC
      LIMIT 1`,
  );
  return typeof result.rows[0]?.entry_digest === 'string'
    ? result.rows[0]!.entry_digest
    : null;
}

export async function policyStoreSnapshotFromClient(
  client: ReleaseAuthorityPgClient,
): Promise<PolicyStoreSnapshot> {
  const metadata = await client.query(
    `SELECT metadata_json
       FROM ${POLICY_METADATA_TABLE}
      WHERE singleton = TRUE
      LIMIT 1`,
  );
  const packs = await client.query(
    `SELECT *
       FROM ${POLICY_PACKS_TABLE}
      ORDER BY pack_id ASC`,
  );
  const bundles = await client.query(
    `SELECT *
       FROM ${POLICY_BUNDLES_TABLE}
      ORDER BY stored_at DESC, bundle_version DESC, bundle_id DESC`,
  );
  const activations = await client.query(
    `SELECT *
       FROM ${POLICY_ACTIVATIONS_TABLE}
      ORDER BY activated_at DESC, activation_id DESC`,
  );

  return freezeClone({
    version: policyStore.POLICY_STORE_SNAPSHOT_SPEC_VERSION,
    metadata: metadata.rows.length === 0 ? null : rowToMetadata(metadata.rows[0]!),
    packs: packs.rows.map(rowToPack),
    bundles: bundles.rows.map(rowToBundle).sort(compareBundles),
    activations: activations.rows.map(rowToActivation).sort(compareActivations),
  }) as PolicyStoreSnapshot;
}

export async function setMetadataWithClient(
  client: ReleaseAuthorityPgClient,
  metadata: PolicyControlPlaneMetadata,
): Promise<PolicyControlPlaneMetadata> {
  const normalized = normalizeMetadata(metadata);
  await client.query(
    `INSERT INTO ${POLICY_METADATA_TABLE} (
      singleton, metadata_json, updated_at
    ) VALUES (
      TRUE, $1::jsonb, NOW()
    )
    ON CONFLICT (singleton) DO UPDATE SET
      metadata_json = EXCLUDED.metadata_json,
      updated_at = EXCLUDED.updated_at`,
    [JSON.stringify(normalized)],
  );
  return normalized;
}

export async function upsertActivationWithClient(
  client: ReleaseAuthorityPgClient,
  record: PolicyActivationRecord,
): Promise<PolicyActivationRecord> {
  const normalized = normalizeActivation(record);
  await client.query(
    `INSERT INTO ${POLICY_ACTIVATIONS_TABLE} (
      activation_id, activation_state, target_label, pack_id, bundle_id,
      activated_at, activation_json, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6::timestamptz, $7::jsonb, NOW()
    )
    ON CONFLICT (activation_id) DO UPDATE SET
      activation_state = EXCLUDED.activation_state,
      target_label = EXCLUDED.target_label,
      pack_id = EXCLUDED.pack_id,
      bundle_id = EXCLUDED.bundle_id,
      activated_at = EXCLUDED.activated_at,
      activation_json = EXCLUDED.activation_json,
      updated_at = EXCLUDED.updated_at`,
    [
      normalized.id,
      normalized.state,
      normalized.targetLabel,
      normalized.bundle.packId,
      normalized.bundle.bundleId,
      normalized.activatedAt,
      JSON.stringify(normalized),
    ],
  );
  return normalized;
}

export async function appendPolicyAuditWithClient(
  client: ReleaseAuthorityPgClient,
  input: PolicyMutationAuditAppendInput,
): Promise<PolicyMutationAuditEntry> {
  const latest = await client.query(
    `SELECT sequence, entry_digest
       FROM ${POLICY_MUTATION_AUDIT_TABLE}
      ORDER BY sequence DESC
      LIMIT 1`,
  );
  const latestSequence = Number(latest.rows[0]?.sequence ?? 0);
  const previousEntryDigest =
    typeof latest.rows[0]?.entry_digest === 'string'
      ? latest.rows[0]!.entry_digest
      : null;
  const entry = auditLog.createPolicyMutationAuditEntry(
    input,
    latestSequence + 1,
    previousEntryDigest,
  );
  await client.query(
    `INSERT INTO ${POLICY_MUTATION_AUDIT_TABLE} (
      sequence, entry_id, occurred_at, action, pack_id, bundle_id,
      activation_id, target_label, previous_entry_digest, entry_digest,
      entry_json
    ) VALUES (
      $1, $2, $3::timestamptz, $4, $5, $6, $7, $8, $9, $10, $11::jsonb
    )`,
    [
      entry.sequence,
      entry.entryId,
      entry.occurredAt,
      entry.action,
      entry.subject.packId,
      entry.subject.bundleId,
      entry.subject.activationId,
      entry.subject.targetLabel,
      entry.previousEntryDigest,
      entry.entryDigest,
      JSON.stringify(entry),
    ],
  );
  return entry;
}

export async function ensurePolicyAuthorityTables(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureReleaseAuthorityStore();
      await withReleaseAuthorityAdvisoryLock(POLICY_STORE_MUTATION_LOCK, async (client) => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${POLICY_METADATA_TABLE} (
            singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
            metadata_json JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS ${POLICY_PACKS_TABLE} (
            pack_id TEXT PRIMARY KEY,
            lifecycle_state TEXT NOT NULL,
            latest_bundle_id TEXT NULL,
            latest_bundle_version TEXT NULL,
            pack_json JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS ${POLICY_BUNDLES_TABLE} (
            pack_id TEXT NOT NULL,
            bundle_id TEXT NOT NULL,
            bundle_version TEXT NOT NULL,
            stored_at TIMESTAMPTZ NOT NULL,
            bundle_json JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (pack_id, bundle_id)
          );

          CREATE INDEX IF NOT EXISTS policy_bundles_pack_stored_idx
            ON ${POLICY_BUNDLES_TABLE} (pack_id, stored_at DESC, bundle_version DESC);

          CREATE TABLE IF NOT EXISTS ${POLICY_ACTIVATIONS_TABLE} (
            activation_id TEXT PRIMARY KEY,
            activation_state TEXT NOT NULL,
            target_label TEXT NOT NULL,
            pack_id TEXT NOT NULL,
            bundle_id TEXT NOT NULL,
            activated_at TIMESTAMPTZ NOT NULL,
            activation_json JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS policy_activations_target_idx
            ON ${POLICY_ACTIVATIONS_TABLE} (target_label, activated_at DESC);

          CREATE TABLE IF NOT EXISTS ${POLICY_ACTIVATION_APPROVALS_TABLE} (
            request_id TEXT PRIMARY KEY,
            request_state TEXT NOT NULL CHECK (request_state IN ('pending', 'approved', 'rejected')),
            target_label TEXT NOT NULL,
            pack_id TEXT NOT NULL,
            bundle_id TEXT NOT NULL,
            requested_at TIMESTAMPTZ NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            approval_digest TEXT NOT NULL,
            request_json JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS policy_activation_approvals_state_idx
            ON ${POLICY_ACTIVATION_APPROVALS_TABLE} (request_state, requested_at DESC);

          CREATE INDEX IF NOT EXISTS policy_activation_approvals_bundle_idx
            ON ${POLICY_ACTIVATION_APPROVALS_TABLE} (pack_id, bundle_id, requested_at DESC);

          CREATE TABLE IF NOT EXISTS ${POLICY_MUTATION_AUDIT_TABLE} (
            sequence BIGINT PRIMARY KEY CHECK (sequence >= 1),
            entry_id TEXT NOT NULL UNIQUE,
            occurred_at TIMESTAMPTZ NOT NULL,
            action TEXT NOT NULL,
            pack_id TEXT NULL,
            bundle_id TEXT NULL,
            activation_id TEXT NULL,
            target_label TEXT NULL,
            previous_entry_digest TEXT NULL,
            entry_digest TEXT NOT NULL UNIQUE,
            entry_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS policy_mutation_audit_subject_idx
            ON ${POLICY_MUTATION_AUDIT_TABLE} (pack_id, bundle_id, activation_id, sequence ASC);
        `);
      });

      const now = new Date().toISOString();
      await Promise.all([
        markPolicyComponentReady(POLICY_CONTROL_PLANE_COMPONENT, now),
        markPolicyComponentReady(POLICY_ACTIVATION_APPROVAL_COMPONENT, now),
        markPolicyComponentReady(POLICY_MUTATION_AUDIT_COMPONENT, now),
      ]);
    })();
  }
  await initPromise;
}

async function markPolicyComponentReady(
  component:
    | typeof POLICY_CONTROL_PLANE_COMPONENT
    | typeof POLICY_ACTIVATION_APPROVAL_COMPONENT
    | typeof POLICY_MUTATION_AUDIT_COMPONENT,
  defaultMigratedAt: string,
): Promise<void> {
  const currentRecord = await getReleaseAuthorityComponent(component);
  const table =
    component === POLICY_CONTROL_PLANE_COMPONENT
      ? POLICY_BUNDLES_TABLE
      : component === POLICY_ACTIVATION_APPROVAL_COMPONENT
        ? POLICY_ACTIVATION_APPROVALS_TABLE
        : POLICY_MUTATION_AUDIT_TABLE;
  await recordReleaseAuthorityComponentState({
    component,
    status: 'ready',
    migratedAt: currentRecord?.migratedAt ?? defaultMigratedAt,
    metadata: {
      ...(currentRecord?.metadata ?? {}),
      sharedStore: 'postgres',
      storeVersion: SHARED_POLICY_AUTHORITY_STORE_VERSION,
      table,
      bootstrapWired: false,
      trackerStep: '06',
    },
  });
}

export async function resetSharedPolicyAuthorityStoresForTests(): Promise<void> {
  initPromise = null;
  await resetReleaseAuthorityStoreForTests();
}
