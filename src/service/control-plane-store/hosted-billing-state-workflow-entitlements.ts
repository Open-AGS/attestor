import {
  type ListWorkflowEntitlementsFilters,
  type StoredWorkflowEntitlementRecord,
} from '../workflow-entitlement-store.js';
import {
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
  type PgClient,
  type PgPool,
} from './pg.js';
import { rowToWorkflowEntitlement } from './mappers.js';

export async function listWorkflowEntitlementsPg(
  filters?: ListWorkflowEntitlementsFilters,
): Promise<StoredWorkflowEntitlementRecord[]> {
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
       FROM attestor_control_plane.workflow_entitlements
       ${whereClause}
      ORDER BY updated_at DESC, workflow_id ASC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}`,
    params,
  );
  return result.rows.map(rowToWorkflowEntitlement);
}

export async function listAllWorkflowEntitlementsPg(): Promise<StoredWorkflowEntitlementRecord[]> {
  const pageSize = 1000;
  const records: StoredWorkflowEntitlementRecord[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await listWorkflowEntitlementsPg({
      limit: pageSize,
      offset,
    });
    records.push(...page);
    if (page.length < pageSize) break;
  }
  return records;
}

export async function findWorkflowEntitlementByTenantAndWorkflowPg(
  tenantId: string,
  workflowId: string,
): Promise<StoredWorkflowEntitlementRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.workflow_entitlements
      WHERE tenant_id = $1 AND workflow_id = $2
      LIMIT 1`,
    [tenantId, workflowId],
  );
  return result.rows[0] ? rowToWorkflowEntitlement(result.rows[0]) : null;
}

export async function findWorkflowEntitlementByStripeSubscriptionItemIdPg(
  stripeSubscriptionItemId: string,
): Promise<StoredWorkflowEntitlementRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.workflow_entitlements
      WHERE stripe_subscription_item_id = $1
      LIMIT 1`,
    [stripeSubscriptionItemId],
  );
  return result.rows[0] ? rowToWorkflowEntitlement(result.rows[0]) : null;
}

export async function upsertWorkflowEntitlementPg(
  record: StoredWorkflowEntitlementRecord,
  executor?: PgPool | PgClient,
): Promise<void> {
  await ensureSchema();
  const target = executor ?? await getPool();
  await target.query(
    `INSERT INTO attestor_control_plane.workflow_entitlements (
      workflow_id, account_id, tenant_id, tier_id, entitlement_status,
      stripe_subscription_id, stripe_subscription_item_id, updated_at, record_json
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8::timestamptz, $9::jsonb
    )
    ON CONFLICT (workflow_id) DO UPDATE SET
      account_id = EXCLUDED.account_id,
      tenant_id = EXCLUDED.tenant_id,
      tier_id = EXCLUDED.tier_id,
      entitlement_status = EXCLUDED.entitlement_status,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      stripe_subscription_item_id = EXCLUDED.stripe_subscription_item_id,
      updated_at = EXCLUDED.updated_at,
      record_json = EXCLUDED.record_json`,
    [
      record.workflowId,
      record.accountId,
      record.tenantId,
      record.tier,
      record.status,
      record.stripeSubscriptionId,
      record.stripeSubscriptionItemId,
      record.updatedAt,
      JSON.stringify(record),
    ],
  );
}
