import { randomUUID } from 'node:crypto';
import {
  appendAdminAuditRecord as appendAdminAuditRecordFile,
  listAdminAuditRecords as listAdminAuditRecordsFile,
  verifyAdminAuditChain,
  type AdminAuditAction,
  type AdminAuditRecord,
} from '../admin-audit-log.js';
import { hashJsonValue } from '../json-stable.js';
import {
  controlPlaneStoreSource,
  ensureControlPlanePgSchema,
  getControlPlanePgPool,
  isSharedControlPlaneConfigured,
  withControlPlanePgTransaction,
} from './pg.js';
import {
  advisoryLockKey,
  rowToAdminAuditRecord,
} from './mappers.js';

export async function appendAdminAuditRecordState(
  input: Omit<AdminAuditRecord, 'id' | 'occurredAt' | 'previousHash' | 'eventHash'>,
): Promise<{
  record: AdminAuditRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return appendAdminAuditRecordFile(input);
  const record = await withControlPlanePgTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [advisoryLockKey('attestor_control_plane:admin_audit')]);
    const latestResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.admin_audit_log
        ORDER BY occurred_at DESC, audit_id DESC
        LIMIT 1`,
    );
    const previous = latestResult.rows[0] ? rowToAdminAuditRecord(latestResult.rows[0]) : null;
    const baseRecord = {
      id: `audit_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      occurredAt: new Date().toISOString(),
      previousHash: previous?.eventHash ?? null,
      ...input,
    };
    const recordToInsert: AdminAuditRecord = {
      ...baseRecord,
      eventHash: hashJsonValue(baseRecord),
    };
    await client.query(
      `INSERT INTO attestor_control_plane.admin_audit_log (
        audit_id, occurred_at, actor_type, action, account_id, tenant_id, previous_hash, event_hash, record_json
      ) VALUES (
        $1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9::jsonb
      )`,
      [
        recordToInsert.id,
        recordToInsert.occurredAt,
        recordToInsert.actorType,
        recordToInsert.action,
        recordToInsert.accountId,
        recordToInsert.tenantId,
        recordToInsert.previousHash,
        recordToInsert.eventHash,
        JSON.stringify(recordToInsert),
      ],
    );
    return recordToInsert;
  });
  return { record, path: controlPlaneStoreSource() };
}

export async function listAdminAuditRecordsState(filters?: {
  action?: AdminAuditAction | null;
  tenantId?: string | null;
  accountId?: string | null;
  limit?: number | null;
}): Promise<{
  records: AdminAuditRecord[];
  chainIntact: boolean;
  latestHash: string | null;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return listAdminAuditRecordsFile(filters);
  await ensureControlPlanePgSchema();
  const pool = await getControlPlanePgPool();
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.admin_audit_log
      ORDER BY occurred_at ASC, audit_id ASC
  `);
  const allRecords = result.rows.map(rowToAdminAuditRecord);
  const chainIntact = verifyAdminAuditChain(allRecords);
  let records = allRecords
    .filter((record) => !filters?.action || record.action === filters.action)
    .filter((record) => !filters?.tenantId || record.tenantId === filters.tenantId)
    .filter((record) => !filters?.accountId || record.accountId === filters.accountId)
    .sort((left, right) => left.occurredAt < right.occurredAt ? 1 : -1);
  if (filters?.limit && filters.limit > 0) {
    records = records.slice(0, filters.limit);
  }
  return {
    records,
    chainIntact,
    latestHash: allRecords.length > 0 ? allRecords[allRecords.length - 1]?.eventHash ?? null : null,
    path: controlPlaneStoreSource(),
  };
}
