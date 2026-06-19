import type { AccountSessionRecord } from '../account/account-session-store.js';
import {
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
  type PgClient,
  type PgPool,
} from './pg.js';
import { rowToAccountSession } from './mappers.js';

export async function listAccountSessionsPg(filters?: {
  accountId?: string | null;
  accountUserId?: string | null;
}): Promise<AccountSessionRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const where: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filters?.accountId) {
    where.push(`account_id = $${idx++}`);
    params.push(filters.accountId);
  }
  if (filters?.accountUserId) {
    where.push(`account_user_id = $${idx++}`);
    params.push(filters.accountUserId);
  }
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_sessions
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY last_seen_at DESC, session_id ASC`,
    params,
  );
  return result.rows.map(rowToAccountSession);
}

export async function upsertAccountSessionPg(record: AccountSessionRecord, executor?: PgPool | PgClient): Promise<void> {
  await ensureSchema();
  const target = executor ?? await getPool();
  await target.query(
    `INSERT INTO attestor_control_plane.account_sessions (
      session_id, account_id, account_user_id, role_id, token_hash, created_at, last_seen_at, expires_at, revoked_at, record_json
    ) VALUES (
      $1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::timestamptz, $9::timestamptz, $10::jsonb
    )
    ON CONFLICT (session_id) DO UPDATE SET
      account_id = EXCLUDED.account_id,
      account_user_id = EXCLUDED.account_user_id,
      role_id = EXCLUDED.role_id,
      token_hash = EXCLUDED.token_hash,
      created_at = EXCLUDED.created_at,
      last_seen_at = EXCLUDED.last_seen_at,
      expires_at = EXCLUDED.expires_at,
      revoked_at = EXCLUDED.revoked_at,
      record_json = EXCLUDED.record_json`,
    [
      record.id,
      record.accountId,
      record.accountUserId,
      record.role,
      record.tokenHash,
      record.createdAt,
      record.lastSeenAt,
      record.expiresAt,
      record.revokedAt,
      JSON.stringify(record),
    ],
  );
}
