import {
  listAsyncDeadLetterRecords as listAsyncDeadLetterRecordsFile,
  normalizeAsyncDeadLetterRecord,
  readAsyncDeadLetterStoreSnapshot,
  removeAsyncDeadLetterRecord as removeAsyncDeadLetterRecordFile,
  upsertAsyncDeadLetterRecord as upsertAsyncDeadLetterRecordFile,
  type AsyncDeadLetterBackendMode,
  type AsyncDeadLetterRecord,
} from '../async/async-dead-letter-store.js';
import {
  controlPlaneStoreSource,
  ensureControlPlanePgSchema,
  getControlPlanePgPool,
  isSharedControlPlaneConfigured,
  type PgClient,
  type PgPool,
} from './pg.js';
import { rowToAsyncDeadLetterRecord } from './mappers.js';

export interface AsyncDeadLetterStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AsyncDeadLetterRecord[];
}

async function listAsyncDeadLetterRecordsPg(filters?: {
  tenantId?: string | null;
  backendMode?: AsyncDeadLetterBackendMode | null;
  limit?: number | null;
}): Promise<AsyncDeadLetterRecord[]> {
  await ensureControlPlanePgSchema();
  const pool = await getControlPlanePgPool();
  const where: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filters?.tenantId) {
    where.push(`tenant_id = $${idx++}`);
    params.push(filters.tenantId);
  }
  if (filters?.backendMode) {
    where.push(`backend_mode = $${idx++}`);
    params.push(filters.backendMode);
  }
  let sql = `
    SELECT record_json
      FROM attestor_control_plane.async_dead_letter_jobs
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY failed_at DESC NULLS LAST, recorded_at DESC, job_id ASC
  `;
  if (filters?.limit && filters.limit > 0) {
    sql += ` LIMIT $${idx++}`;
    params.push(filters.limit);
  }
  const result = await pool.query(sql, params);
  return result.rows.map(rowToAsyncDeadLetterRecord);
}

async function upsertAsyncDeadLetterRecordPg(
  record: AsyncDeadLetterRecord,
  executor?: PgPool | PgClient,
): Promise<void> {
  await ensureControlPlanePgSchema();
  const target = executor ?? await getControlPlanePgPool();
  const normalized = normalizeAsyncDeadLetterRecord(record);
  await target.query(
    `INSERT INTO attestor_control_plane.async_dead_letter_jobs (
      job_id, backend_mode, tenant_id, plan_id, state, failed_reason, attempts_made, max_attempts,
      requested_at, submitted_at, processed_at, failed_at, recorded_at, record_json
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9::timestamptz, $10::timestamptz, $11::timestamptz, $12::timestamptz, $13::timestamptz, $14::jsonb
    )
    ON CONFLICT (job_id) DO UPDATE SET
      backend_mode = EXCLUDED.backend_mode,
      tenant_id = EXCLUDED.tenant_id,
      plan_id = EXCLUDED.plan_id,
      state = EXCLUDED.state,
      failed_reason = EXCLUDED.failed_reason,
      attempts_made = EXCLUDED.attempts_made,
      max_attempts = EXCLUDED.max_attempts,
      requested_at = EXCLUDED.requested_at,
      submitted_at = EXCLUDED.submitted_at,
      processed_at = EXCLUDED.processed_at,
      failed_at = EXCLUDED.failed_at,
      recorded_at = EXCLUDED.recorded_at,
      record_json = EXCLUDED.record_json`,
    [
      normalized.jobId,
      normalized.backendMode,
      normalized.tenantId,
      normalized.planId,
      normalized.state,
      normalized.failedReason,
      normalized.attemptsMade,
      normalized.maxAttempts,
      normalized.requestedAt,
      normalized.submittedAt,
      normalized.processedAt,
      normalized.failedAt,
      normalized.recordedAt,
      JSON.stringify(normalized),
    ],
  );
}

async function removeAsyncDeadLetterRecordPg(
  jobId: string,
  executor?: PgPool | PgClient,
): Promise<{ removed: boolean; record: AsyncDeadLetterRecord | null }> {
  await ensureControlPlanePgSchema();
  const target = executor ?? await getControlPlanePgPool();
  const existing = await target.query(
    `SELECT record_json
       FROM attestor_control_plane.async_dead_letter_jobs
      WHERE job_id = $1
      LIMIT 1`,
    [jobId],
  );
  const record = existing.rows[0] ? rowToAsyncDeadLetterRecord(existing.rows[0]) : null;
  if (!record) return { removed: false, record: null };
  await target.query(
    `DELETE FROM attestor_control_plane.async_dead_letter_jobs
      WHERE job_id = $1`,
    [jobId],
  );
  return { removed: true, record };
}

export async function listAsyncDeadLetterRecordsState(filters?: {
  tenantId?: string | null;
  backendMode?: AsyncDeadLetterBackendMode | null;
  limit?: number | null;
}): Promise<{ records: AsyncDeadLetterRecord[]; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return listAsyncDeadLetterRecordsFile(filters);
  return {
    records: await listAsyncDeadLetterRecordsPg(filters),
    path: controlPlaneStoreSource(),
  };
}

export async function upsertAsyncDeadLetterRecordState(
  record: AsyncDeadLetterRecord,
): Promise<{ record: AsyncDeadLetterRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return upsertAsyncDeadLetterRecordFile(record);
  const normalized = normalizeAsyncDeadLetterRecord(record);
  await upsertAsyncDeadLetterRecordPg(normalized);
  return { record: normalized, path: controlPlaneStoreSource() };
}

export async function removeAsyncDeadLetterRecordState(
  jobId: string,
): Promise<{ removed: boolean; record: AsyncDeadLetterRecord | null; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return removeAsyncDeadLetterRecordFile(jobId);
  const removed = await removeAsyncDeadLetterRecordPg(jobId);
  return { ...removed, path: controlPlaneStoreSource() };
}

export async function exportAsyncDeadLetterStoreSnapshot(): Promise<AsyncDeadLetterStoreSnapshot> {
  const result = isSharedControlPlaneConfigured()
    ? await listAsyncDeadLetterRecordsState()
    : readAsyncDeadLetterStoreSnapshot();
  const chronological = [...result.records].sort((left, right) => {
    const leftKey = left.failedAt ?? left.recordedAt;
    const rightKey = right.failedAt ?? right.recordedAt;
    if (leftKey === rightKey) return left.jobId > right.jobId ? 1 : -1;
    return leftKey > rightKey ? 1 : -1;
  });
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: chronological.length,
    records: chronological,
  };
}

export async function restoreAsyncDeadLetterStoreSnapshot(
  snapshot: AsyncDeadLetterStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    if (options?.replaceExisting) {
      const existing = listAsyncDeadLetterRecordsFile().records;
      for (const record of existing) {
        removeAsyncDeadLetterRecordFile(record.jobId);
      }
    }
    for (const record of snapshot.records) {
      upsertAsyncDeadLetterRecordFile(record);
    }
    return { recordCount: snapshot.records.length };
  }
  await ensureControlPlanePgSchema();
  const pool = await getControlPlanePgPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.async_dead_letter_jobs');
  }
  for (const record of snapshot.records) {
    await upsertAsyncDeadLetterRecordPg(record);
  }
  return { recordCount: snapshot.records.length };
}
