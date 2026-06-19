import {
  type HostedAccountRecord,
} from '../account/account-store.js';
import {
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
  type PgClient,
  type PgPool,
} from './pg.js';
import {
  mapPgErrorToAccountStoreError,
  rowToHostedAccount,
} from './mappers.js';

export async function listHostedAccountsPg(): Promise<HostedAccountRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.hosted_accounts
      ORDER BY updated_at ASC, account_id ASC
  `);
  return result.rows.map(rowToHostedAccount);
}

export async function findHostedAccountByIdPg(id: string): Promise<HostedAccountRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.hosted_accounts
      WHERE account_id = $1
      LIMIT 1`,
    [id],
  );
  return result.rows[0] ? rowToHostedAccount(result.rows[0]) : null;
}

export async function findHostedAccountByTenantIdPg(primaryTenantId: string): Promise<HostedAccountRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.hosted_accounts
      WHERE primary_tenant_id = $1
      LIMIT 1`,
    [primaryTenantId],
  );
  return result.rows[0] ? rowToHostedAccount(result.rows[0]) : null;
}

export async function upsertHostedAccountPg(record: HostedAccountRecord, executor?: PgPool | PgClient): Promise<void> {
  await ensureSchema();
  const target = executor ?? await getPool();
  try {
    await target.query(
      `INSERT INTO attestor_control_plane.hosted_accounts (
        account_id, primary_tenant_id, account_status, stripe_customer_id, stripe_subscription_id, updated_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6::timestamptz, $7::jsonb
      )
      ON CONFLICT (account_id) DO UPDATE SET
        primary_tenant_id = EXCLUDED.primary_tenant_id,
        account_status = EXCLUDED.account_status,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        updated_at = EXCLUDED.updated_at,
        record_json = EXCLUDED.record_json`,
      [
        record.id,
        record.primaryTenantId,
        record.status,
        record.billing.stripeCustomerId,
        record.billing.stripeSubscriptionId,
        record.updatedAt,
        JSON.stringify(record),
      ],
    );
  } catch (err) {
    const mapped = mapPgErrorToAccountStoreError(err);
    if (mapped) throw mapped;
    throw err;
  }
}
