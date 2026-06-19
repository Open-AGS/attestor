import type { AccountUserRecord } from '../account/account-user-store.js';
import {
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
  type PgClient,
  type PgPool,
} from './pg.js';
import {
  mapPgErrorToAccountUserStoreError,
  rowToAccountUser,
} from './mappers.js';

export async function listAccountUsersByAccountIdPg(accountId: string): Promise<AccountUserRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_users
      WHERE account_id = $1
      ORDER BY updated_at DESC, account_user_id ASC`,
    [accountId],
  );
  return result.rows.map(rowToAccountUser);
}

export async function listAllAccountUsersPg(): Promise<AccountUserRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.account_users
      ORDER BY updated_at DESC, account_user_id ASC
  `);
  return result.rows.map(rowToAccountUser);
}

export async function findAccountUserByIdPg(id: string): Promise<AccountUserRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_users
      WHERE account_user_id = $1
      LIMIT 1`,
    [id],
  );
  return result.rows[0] ? rowToAccountUser(result.rows[0]) : null;
}

export async function findAccountUserByEmailPg(email: string): Promise<AccountUserRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_users
      WHERE email = $1
      LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  return result.rows[0] ? rowToAccountUser(result.rows[0]) : null;
}

export async function countAccountUsersByAccountIdPg(accountId: string): Promise<number> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM attestor_control_plane.account_users
      WHERE account_id = $1`,
    [accountId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function upsertAccountUserPg(record: AccountUserRecord, executor?: PgPool | PgClient): Promise<void> {
  await ensureSchema();
  const target = executor ?? await getPool();
  try {
    await target.query(
      `INSERT INTO attestor_control_plane.account_users (
        account_user_id, account_id, email, role_id, user_status, updated_at, last_login_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::jsonb
      )
      ON CONFLICT (account_user_id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        email = EXCLUDED.email,
        role_id = EXCLUDED.role_id,
        user_status = EXCLUDED.user_status,
        updated_at = EXCLUDED.updated_at,
        last_login_at = EXCLUDED.last_login_at,
        record_json = EXCLUDED.record_json`,
      [
        record.id,
        record.accountId,
        record.email,
        record.role,
        record.status,
        record.updatedAt,
        record.lastLoginAt,
        JSON.stringify(record),
      ],
    );
  } catch (err) {
    const mapped = mapPgErrorToAccountUserStoreError(err);
    if (mapped) throw mapped;
    throw err;
  }
}
