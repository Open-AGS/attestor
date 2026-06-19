import {
  type HostedBillingEntitlementRecord,
  type ListBillingEntitlementsFilters,
} from '../billing/billing-entitlement-store.js';
import {
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
  type PgClient,
  type PgPool,
} from './pg.js';
import { rowToHostedBillingEntitlement } from './mappers.js';

export async function listHostedBillingEntitlementsPg(
  filters?: ListBillingEntitlementsFilters,
): Promise<HostedBillingEntitlementRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters?.accountId) {
    params.push(filters.accountId);
    clauses.push(`account_id = $${params.length}`);
  }
  if (filters?.tenantId) {
    params.push(filters.tenantId);
    clauses.push(`tenant_id = $${params.length}`);
  }
  if (filters?.status) {
    params.push(filters.status);
    clauses.push(`entitlement_status = $${params.length}`);
  }
  const limit = Math.max(1, Math.min(1000, filters?.limit ?? 100));
  const offset = Math.max(0, filters?.offset ?? 0);
  params.push(limit);
  params.push(offset);
  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.billing_entitlements
       ${whereClause}
      ORDER BY updated_at DESC, account_id ASC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}`,
    params,
  );
  return result.rows.map(rowToHostedBillingEntitlement);
}

export async function listAllHostedBillingEntitlementsPg(): Promise<HostedBillingEntitlementRecord[]> {
  const pageSize = 1000;
  const records: HostedBillingEntitlementRecord[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await listHostedBillingEntitlementsPg({
      limit: pageSize,
      offset,
    });
    records.push(...page);
    if (page.length < pageSize) break;
  }
  return records;
}

export async function findHostedBillingEntitlementByAccountIdPg(accountId: string): Promise<HostedBillingEntitlementRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.billing_entitlements
      WHERE account_id = $1
      LIMIT 1`,
    [accountId],
  );
  return result.rows[0] ? rowToHostedBillingEntitlement(result.rows[0]) : null;
}

export async function upsertHostedBillingEntitlementPg(
  record: HostedBillingEntitlementRecord,
  executor?: PgPool | PgClient,
): Promise<void> {
  await ensureSchema();
  const target = executor ?? await getPool();
  await target.query(
    `INSERT INTO attestor_control_plane.billing_entitlements (
      account_id, tenant_id, provider, entitlement_status, access_enabled, effective_plan_id, last_event_id, updated_at, record_json
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::jsonb
    )
    ON CONFLICT (account_id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      provider = EXCLUDED.provider,
      entitlement_status = EXCLUDED.entitlement_status,
      access_enabled = EXCLUDED.access_enabled,
      effective_plan_id = EXCLUDED.effective_plan_id,
      last_event_id = EXCLUDED.last_event_id,
      updated_at = EXCLUDED.updated_at,
      record_json = EXCLUDED.record_json`,
    [
      record.accountId,
      record.tenantId,
      record.provider,
      record.status,
      record.accessEnabled,
      record.effectivePlanId,
      record.lastEventId,
      record.updatedAt,
      JSON.stringify(record),
    ],
  );
}
