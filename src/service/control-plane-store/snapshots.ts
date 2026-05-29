import {
  listAdminAuditRecords as listAdminAuditRecordsFile,
  verifyAdminAuditChain,
  type AdminAuditRecord,
} from '../admin-audit-log.js';
import {
  readAdminIdempotencySnapshot,
  type AdminIdempotencyRecord,
} from '../admin-idempotency-store.js';
import {
  listAdminAuditRecordsState,
} from './admin-audit-state.js';
import {
  adminIdempotencyCutoffIso,
  rowToAdminIdempotencyRecord,
} from './mappers.js';
import {
  closeControlPlanePgPoolForTests,
  controlPlaneStoreSource,
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
  hasControlPlanePgPoolForTests,
  isSharedControlPlaneConfigured,
} from './pg.js';
import { releaseAllStripeWebhookClaimLeasesForTests } from './stripe-webhook-state.js';

export interface AdminAuditLogStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  chainIntact: boolean;
  latestHash: string | null;
  records: AdminAuditRecord[];
}

export interface AdminIdempotencyStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AdminIdempotencyRecord[];
}

export async function exportAdminAuditLogStoreSnapshot(): Promise<AdminAuditLogStoreSnapshot> {
  const result = isSharedControlPlaneConfigured()
    ? await listAdminAuditRecordsState()
    : listAdminAuditRecordsFile();
  const chronological = [...result.records].sort((left, right) => left.occurredAt > right.occurredAt ? 1 : -1);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: chronological.length,
    chainIntact: result.chainIntact,
    latestHash: result.latestHash,
    records: chronological,
  };
}

export async function restoreAdminAuditLogStoreSnapshot(
  snapshot: AdminAuditLogStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for admin audit restore.');
  }
  if (!verifyAdminAuditChain(snapshot.records)) {
    throw new Error('Admin audit snapshot chain is invalid and cannot be restored.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.admin_audit_log');
  }
  for (const record of snapshot.records) {
    await pool.query(
      `INSERT INTO attestor_control_plane.admin_audit_log (
        audit_id, occurred_at, actor_type, action, account_id, tenant_id, previous_hash, event_hash, record_json
      ) VALUES (
        $1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9::jsonb
      )
      ON CONFLICT (audit_id) DO UPDATE SET
        occurred_at = EXCLUDED.occurred_at,
        actor_type = EXCLUDED.actor_type,
        action = EXCLUDED.action,
        account_id = EXCLUDED.account_id,
        tenant_id = EXCLUDED.tenant_id,
        previous_hash = EXCLUDED.previous_hash,
        event_hash = EXCLUDED.event_hash,
        record_json = EXCLUDED.record_json`,
      [
        record.id,
        record.occurredAt,
        record.actorType,
        record.action,
        record.accountId,
        record.tenantId,
        record.previousHash,
        record.eventHash,
        JSON.stringify(record),
      ],
    );
  }
  return { recordCount: snapshot.records.length };
}

export async function exportAdminIdempotencyStoreSnapshot(): Promise<AdminIdempotencyStoreSnapshot> {
  if (!isSharedControlPlaneConfigured()) {
    const { records } = readAdminIdempotencySnapshot();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      records,
    };
  }
  await ensureSchema();
  const pool = await getPool();
  await pool.query(
    `DELETE FROM attestor_control_plane.admin_idempotency
      WHERE created_at < $1::timestamptz`,
    [adminIdempotencyCutoffIso()],
  );
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.admin_idempotency
      ORDER BY created_at ASC, idempotency_id ASC
  `);
  const records = result.rows.map(rowToAdminIdempotencyRecord);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreAdminIdempotencyStoreSnapshot(
  snapshot: AdminIdempotencyStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for admin idempotency restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.admin_idempotency');
  }
  for (const record of snapshot.records) {
    await pool.query(
      `INSERT INTO attestor_control_plane.admin_idempotency (
        idempotency_id, idempotency_key, route_id, request_hash, status_code,
        response_ciphertext, response_iv, response_auth_tag,
        created_at, last_replayed_at, replay_count, record_json
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9::timestamptz, $10::timestamptz, $11, $12::jsonb
      )
      ON CONFLICT (idempotency_id) DO UPDATE SET
        idempotency_key = EXCLUDED.idempotency_key,
        route_id = EXCLUDED.route_id,
        request_hash = EXCLUDED.request_hash,
        status_code = EXCLUDED.status_code,
        response_ciphertext = EXCLUDED.response_ciphertext,
        response_iv = EXCLUDED.response_iv,
        response_auth_tag = EXCLUDED.response_auth_tag,
        created_at = EXCLUDED.created_at,
        last_replayed_at = EXCLUDED.last_replayed_at,
        replay_count = EXCLUDED.replay_count,
        record_json = EXCLUDED.record_json`,
      [
        record.id,
        record.idempotencyKey,
        record.routeId,
        record.requestHash,
        record.statusCode,
        record.responseCiphertext,
        record.responseIv,
        record.responseAuthTag,
        record.createdAt,
        record.lastReplayedAt,
        record.replayCount,
        JSON.stringify(record),
      ],
    );
  }
  return { recordCount: snapshot.records.length };
}

export async function resetSharedControlPlaneStoreForTests(): Promise<void> {
  await releaseAllStripeWebhookClaimLeasesForTests();
  if (!hasControlPlanePgPoolForTests() && !controlPlaneStoreSource()) return;
  if (!isSharedControlPlaneConfigured()) {
    await closeControlPlanePgPoolForTests();
    return;
  }
  const pool = await getPool();
  await pool.query(`
    DROP TABLE IF EXISTS attestor_control_plane.async_dead_letter_jobs;
    DROP TABLE IF EXISTS attestor_control_plane.email_delivery_events;
    DROP TABLE IF EXISTS attestor_control_plane.stripe_webhook_dedupe;
    DROP TABLE IF EXISTS attestor_control_plane.pipeline_idempotency;
    DROP TABLE IF EXISTS attestor_control_plane.admin_idempotency;
    DROP TABLE IF EXISTS attestor_control_plane.admin_audit_log;
    DROP TABLE IF EXISTS attestor_control_plane.billing_entitlements;
    DROP TABLE IF EXISTS attestor_control_plane.account_saml_replays;
    DROP TABLE IF EXISTS attestor_control_plane.account_user_action_tokens;
    DROP TABLE IF EXISTS attestor_control_plane.account_sessions;
    DROP TABLE IF EXISTS attestor_control_plane.account_users;
    DROP TABLE IF EXISTS attestor_control_plane.usage_ledger;
    DROP TABLE IF EXISTS attestor_control_plane.tenant_api_keys;
    DROP TABLE IF EXISTS attestor_control_plane.hosted_accounts;
  `);
  await closeControlPlanePgPoolForTests();
}
