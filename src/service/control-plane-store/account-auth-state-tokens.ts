import {
  hashAccountUserActionToken,
  type AccountUserActionTokenPurpose,
  type AccountUserActionTokenRecord,
} from '../account/account-user-token-store.js';
import {
  accountSessionTokenHashCandidates,
  isAccountSessionRecordExpired,
  type AccountSessionRecord,
} from '../account/account-session-store.js';
import {
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
  type PgClient,
  type PgPool,
} from './pg.js';
import { upsertAccountSessionPg } from './account-auth-state-sessions.js';
import {
  rowToAccountSession,
  rowToAccountUserActionToken,
} from './mappers.js';

export async function listAccountUserActionTokensPg(filters?: {
  accountId?: string | null;
  accountUserId?: string | null;
  purpose?: AccountUserActionTokenPurpose | null;
}): Promise<AccountUserActionTokenRecord[]> {
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
  if (filters?.purpose) {
    where.push(`purpose = $${idx++}`);
    params.push(filters.purpose);
  }
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_user_action_tokens
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at DESC, token_id ASC`,
    params,
  );
  return result.rows.map(rowToAccountUserActionToken);
}

export async function upsertAccountUserActionTokenPg(
  record: AccountUserActionTokenRecord,
  executor?: PgPool | PgClient,
): Promise<void> {
  await ensureSchema();
  const target = executor ?? await getPool();
  await target.query(
    `INSERT INTO attestor_control_plane.account_user_action_tokens (
      token_id, purpose, account_id, account_user_id, email, role_id, token_hash,
      updated_at, expires_at, consumed_at, revoked_at, record_json
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8::timestamptz, $9::timestamptz, $10::timestamptz, $11::timestamptz, $12::jsonb
    )
    ON CONFLICT (token_id) DO UPDATE SET
      purpose = EXCLUDED.purpose,
      account_id = EXCLUDED.account_id,
      account_user_id = EXCLUDED.account_user_id,
      email = EXCLUDED.email,
      role_id = EXCLUDED.role_id,
      token_hash = EXCLUDED.token_hash,
      updated_at = EXCLUDED.updated_at,
      expires_at = EXCLUDED.expires_at,
      consumed_at = EXCLUDED.consumed_at,
      revoked_at = EXCLUDED.revoked_at,
      record_json = EXCLUDED.record_json`,
    [
      record.id,
      record.purpose,
      record.accountId,
      record.accountUserId,
      record.email,
      record.role,
      record.tokenHash,
      record.updatedAt,
      record.expiresAt,
      record.consumedAt,
      record.revokedAt,
      JSON.stringify(record),
    ],
  );
}

export async function findAccountSessionByTokenPg(token: string, options?: { touch?: boolean }): Promise<AccountSessionRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const tokenHashes = accountSessionTokenHashCandidates(token);
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_sessions
      WHERE token_hash = ANY($1::text[])
      LIMIT 1`,
    [tokenHashes],
  );
  if (!result.rows[0]) return null;
  const record = rowToAccountSession(result.rows[0]);
  const now = new Date();
  if (record.revokedAt || isAccountSessionRecordExpired(record, now.getTime())) {
    return null;
  }
  if (options?.touch) {
    record.lastSeenAt = now.toISOString();
    await upsertAccountSessionPg(record);
  }
  return record;
}

export async function findAccountUserActionTokenByTokenPg(token: string): Promise<AccountUserActionTokenRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_user_action_tokens
      WHERE token_hash = $1
      LIMIT 1`,
    [hashAccountUserActionToken(token)],
  );
  if (!result.rows[0]) return null;
  const record = rowToAccountUserActionToken(result.rows[0]);
  if (record.revokedAt || record.consumedAt || Date.parse(record.expiresAt) <= Date.now()) {
    return null;
  }
  if (record.maxAttempts !== null && record.attemptCount >= record.maxAttempts) {
    return null;
  }
  return record;
}
