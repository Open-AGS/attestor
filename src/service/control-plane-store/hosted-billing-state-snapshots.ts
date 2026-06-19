import {
  listHostedAccounts as listHostedAccountsFile,
} from '../account/account-store.js';
import {
  exportHostedBillingEntitlementStoreSnapshot as exportHostedBillingEntitlementStoreSnapshotFile,
  normalizeHostedBillingEntitlementRecord,
  restoreHostedBillingEntitlementStoreSnapshot as restoreHostedBillingEntitlementStoreSnapshotFile,
} from '../billing/billing-entitlement-store.js';
import {
  exportWorkflowEntitlementStoreSnapshot as exportWorkflowEntitlementStoreSnapshotFile,
  normalizeWorkflowEntitlementRecord,
  restoreWorkflowEntitlementStoreSnapshot as restoreWorkflowEntitlementStoreSnapshotFile,
} from '../workflow-entitlement-store.js';
import {
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
  isSharedControlPlaneConfigured,
} from './pg.js';
import { normalizeHostedAccountRecord } from './mappers.js';
import {
  listHostedAccountsPg,
  upsertHostedAccountPg,
} from './hosted-billing-state-hosted-accounts.js';
import {
  listAllHostedBillingEntitlementsPg,
  upsertHostedBillingEntitlementPg,
} from './hosted-billing-state-billing-entitlements.js';
import {
  listAllWorkflowEntitlementsPg,
  upsertWorkflowEntitlementPg,
} from './hosted-billing-state-workflow-entitlements.js';
import type {
  BillingEntitlementStoreSnapshot,
  HostedAccountStoreSnapshot,
  WorkflowEntitlementSnapshot,
} from './hosted-billing-state-types.js';

export async function exportHostedAccountStoreSnapshotImpl(): Promise<HostedAccountStoreSnapshot> {
  const records = isSharedControlPlaneConfigured()
    ? await listHostedAccountsPg()
    : listHostedAccountsFile().records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function exportHostedBillingEntitlementStoreSnapshotImpl(): Promise<BillingEntitlementStoreSnapshot> {
  const records = isSharedControlPlaneConfigured()
    ? await listAllHostedBillingEntitlementsPg()
    : exportHostedBillingEntitlementStoreSnapshotFile().records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function exportWorkflowEntitlementStoreSnapshotImpl(): Promise<WorkflowEntitlementSnapshot> {
  const records = isSharedControlPlaneConfigured()
    ? await listAllWorkflowEntitlementsPg()
    : exportWorkflowEntitlementStoreSnapshotFile().records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreHostedAccountStoreSnapshotImpl(
  snapshot: HostedAccountStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for hosted account restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.hosted_accounts CASCADE');
  }
  for (const record of snapshot.records) {
    await upsertHostedAccountPg(normalizeHostedAccountRecord(record));
  }
  return { recordCount: snapshot.records.length };
}

export async function restoreWorkflowEntitlementStoreSnapshotImpl(
  snapshot: WorkflowEntitlementSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    const restored = restoreWorkflowEntitlementStoreSnapshotFile(snapshot);
    return { recordCount: restored.recordCount };
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.workflow_entitlements');
  }
  for (const record of snapshot.records) {
    await upsertWorkflowEntitlementPg(normalizeWorkflowEntitlementRecord(record));
  }
  return { recordCount: snapshot.records.length };
}

export async function restoreHostedBillingEntitlementStoreSnapshotImpl(
  snapshot: BillingEntitlementStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    const restored = restoreHostedBillingEntitlementStoreSnapshotFile(snapshot);
    return { recordCount: restored.recordCount };
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.billing_entitlements CASCADE');
  }
  for (const record of snapshot.records) {
    await upsertHostedBillingEntitlementPg(normalizeHostedBillingEntitlementRecord(record));
  }
  return { recordCount: snapshot.records.length };
}
