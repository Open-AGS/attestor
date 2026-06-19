/**
 * Hosted account and billing control-plane state.
 *
 * Keeps hosted account lifecycle, billing entitlements, Stripe event state, and
 * hosted-account snapshots behind the control-plane-store facade.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import {
  AccountStoreError,
  applyStripeCheckoutCompletion as applyStripeCheckoutCompletionFile,
  applyStripeInvoiceState as applyStripeInvoiceStateFile,
  applyStripeSubscriptionState as applyStripeSubscriptionStateFile,
  attachStripeBillingToAccount as attachStripeBillingToAccountFile,
  createHostedAccount as createHostedAccountFile,
  deriveHostedAccountStatusFromStripeSubscriptionStatus,
  findHostedAccountById as findHostedAccountByIdFile,
  findHostedAccountByTenantId as findHostedAccountByTenantIdFile,
  listHostedAccounts as listHostedAccountsFile,
  setHostedAccountStatus as setHostedAccountStatusFile,
  type AttachStripeBillingInput,
  type CreateHostedAccountInput,
  type HostedAccountRecord,
  type HostedAccountStatus,
  type StripeSubscriptionStatus,
} from '../account/account-store.js';
import {
  findHostedBillingEntitlementByAccountId as findHostedBillingEntitlementByAccountIdFile,
  listHostedBillingEntitlements as listHostedBillingEntitlementsFile,
  projectHostedBillingEntitlement,
  upsertHostedBillingEntitlement as upsertHostedBillingEntitlementFile,
  type HostedBillingEntitlementRecord,

  type ListBillingEntitlementsFilters,
  type ProjectHostedBillingEntitlementInput,
} from '../billing/billing-entitlement-store.js';
import {
  tenantKeyStorePolicy,
  TenantKeyStoreError,
  type IssueTenantKeyInput,
  type TenantKeyRecord,
} from '../tenant-key-store.js';
import { DEFAULT_HOSTED_PLAN_ID, resolvePlanSpec } from '../plan-catalog.js';
import {
  issueTenantApiKeyState,
  upsertTenantKeyPg,
} from './tenant-key-state.js';
import {
  controlPlaneStoreSource,
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
  isSharedControlPlaneConfigured,
} from './pg.js';
import {
  buildTenantKeyRecord,
  defaultBillingState,
  isIncomingProviderEventOlder,
  mapPgErrorToAccountStoreError,
  maybeSealTenantKeyRecord,
  normalizeHostedAccountRecord,
  normalizeStripeInvoiceStatus,
  normalizeStripeSubscriptionStatus,
  resolveStripeAccountMatch,


  rowToWorkflowEntitlement,
  touchRecord,
} from './mappers.js';
import {
  consumeWorkflowEntitlementAdmission as consumeWorkflowEntitlementAdmissionFile,
  findWorkflowEntitlementByStripeSubscriptionItemId as findWorkflowEntitlementByStripeSubscriptionItemIdFile,
  findWorkflowEntitlementByTenantAndWorkflow as findWorkflowEntitlementByTenantAndWorkflowFile,
  listWorkflowEntitlements as listWorkflowEntitlementsFile,
  normalizeWorkflowEntitlementRecord,
  projectPendingWorkflowEntitlement,
  projectStripeWorkflowEntitlement,
  projectWorkflowEntitlementAdmissionUsage,
  upsertPendingWorkflowEntitlement as upsertPendingWorkflowEntitlementFile,
  upsertWorkflowEntitlementFromStripe as upsertWorkflowEntitlementFromStripeFile,
  type ListWorkflowEntitlementsFilters,
  type PendingWorkflowEntitlementInput,
  type StoredWorkflowEntitlementRecord,
  type StripeWorkflowEntitlementInput,

  type WorkflowUsageDecision,
} from '../workflow-entitlement-store.js';
import {
  findHostedAccountByIdPg,
  findHostedAccountByTenantIdPg,
  listHostedAccountsPg,
  upsertHostedAccountPg,
} from './hosted-billing-state-hosted-accounts.js';
import {
  findHostedBillingEntitlementByAccountIdPg,
  listHostedBillingEntitlementsPg,
  upsertHostedBillingEntitlementPg,
} from './hosted-billing-state-billing-entitlements.js';
import {
  findWorkflowEntitlementByStripeSubscriptionItemIdPg,
  findWorkflowEntitlementByTenantAndWorkflowPg,
  listWorkflowEntitlementsPg,
  upsertWorkflowEntitlementPg,
} from './hosted-billing-state-workflow-entitlements.js';
import type {
  BillingEntitlementStoreSnapshot,
  HostedAccountStoreSnapshot,
  WorkflowEntitlementSnapshot,
} from './hosted-billing-state-types.js';
export type {
  BillingEntitlementStoreSnapshot,
  HostedAccountStoreSnapshot,
  WorkflowEntitlementSnapshot,
} from './hosted-billing-state-types.js';
import {
  exportHostedAccountStoreSnapshotImpl,
  exportHostedBillingEntitlementStoreSnapshotImpl,
  exportWorkflowEntitlementStoreSnapshotImpl,
  restoreHostedAccountStoreSnapshotImpl,
  restoreHostedBillingEntitlementStoreSnapshotImpl,
  restoreWorkflowEntitlementStoreSnapshotImpl,
} from './hosted-billing-state-snapshots.js';



export async function listHostedAccountsState(): Promise<{
  records: HostedAccountRecord[];
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return listHostedAccountsFile();
  return {
    records: await listHostedAccountsPg(),
    path: controlPlaneStoreSource(),
  };
}

export async function findHostedAccountByIdState(id: string): Promise<HostedAccountRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findHostedAccountByIdFile(id);
  return findHostedAccountByIdPg(id);
}

export async function findHostedAccountByTenantIdState(primaryTenantId: string): Promise<HostedAccountRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findHostedAccountByTenantIdFile(primaryTenantId);
  return findHostedAccountByTenantIdPg(primaryTenantId);
}

export async function createHostedAccountState(input: CreateHostedAccountInput): Promise<{
  record: HostedAccountRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return createHostedAccountFile(input);

  const now = new Date().toISOString();
  const record = normalizeHostedAccountRecord({
    id: `acct_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    accountName: input.accountName,
    contactEmail: input.contactEmail,
    primaryTenantId: input.primaryTenantId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    suspendedAt: null,
    archivedAt: null,
    billing: defaultBillingState(),
  });
  await upsertHostedAccountPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function provisionHostedAccountState(input: {
  account: CreateHostedAccountInput;
  key: IssueTenantKeyInput;
}): Promise<{
  account: HostedAccountRecord;
  initialKey: TenantKeyRecord;
  apiKey: string;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) {
    const account = createHostedAccountFile(input.account);
    const issued = await issueTenantApiKeyState(input.key);
    return {
      account: account.record,
      initialKey: issued.record,
      apiKey: issued.apiKey,
      path: issued.path ?? account.path,
    };
  }

  const now = new Date().toISOString();
  const apiKey = `atk_${randomBytes(24).toString('hex')}`;
  const resolvedPlan = resolvePlanSpec({
    planId: input.key.planId,
    monthlyRunQuota: input.key.monthlyRunQuota,
    defaultPlanId: DEFAULT_HOSTED_PLAN_ID,
  });
  const accountRecord = normalizeHostedAccountRecord({
    id: `acct_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    accountName: input.account.accountName,
    contactEmail: input.account.contactEmail,
    primaryTenantId: input.account.primaryTenantId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    suspendedAt: null,
    archivedAt: null,
    billing: defaultBillingState(),
  });
  let keyRecord = buildTenantKeyRecord({
    tenantId: input.key.tenantId,
    tenantName: input.key.tenantName,
    planId: resolvedPlan.planId,
    monthlyRunQuota: resolvedPlan.monthlyRunQuota,
    apiKey,
    createdAt: now,
  });
  keyRecord = await maybeSealTenantKeyRecord(keyRecord, apiKey);

  await ensureSchema();
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await upsertHostedAccountPg(accountRecord, client);

    const existing = await client.query(
      `SELECT COUNT(*)::int AS active_count
         FROM attestor_control_plane.tenant_api_keys
        WHERE tenant_id = $1 AND key_status = 'active'`,
      [input.key.tenantId],
    );
    const activeCount = Number(existing.rows[0]?.active_count ?? 0);
    const maxActive = tenantKeyStorePolicy().maxActiveKeysPerTenant;
    if (activeCount >= maxActive) {
      throw new TenantKeyStoreError(
        'LIMIT_EXCEEDED',
        `Tenant '${input.key.tenantId}' already has ${activeCount} active keys. Deactivate or revoke one before issuing another. Max active keys per tenant: ${maxActive}.`,
      );
    }

    await upsertTenantKeyPg(keyRecord, client);
    await client.query('COMMIT');
    return {
      account: accountRecord,
      initialKey: keyRecord,
      apiKey,
      path: controlPlaneStoreSource(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    const mappedAccount = mapPgErrorToAccountStoreError(err);
    if (mappedAccount) throw mappedAccount;
    throw err;
  } finally {
    client.release();
  }
}

export async function attachStripeBillingToAccountState(id: string, billing: AttachStripeBillingInput): Promise<{
  record: HostedAccountRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return attachStripeBillingToAccountFile(id, billing);
  const record = await findHostedAccountByIdPg(id);
  if (!record) {
    throw new AccountStoreError('NOT_FOUND', `Hosted account '${id}' was not found.`);
  }
  record.billing = {
    ...defaultBillingState(),
    ...record.billing,
    provider: billing.stripeCustomerId || billing.stripeSubscriptionId ? 'stripe' : record.billing.provider,
    stripeCustomerId: billing.stripeCustomerId ?? record.billing.stripeCustomerId,
    stripeSubscriptionId: billing.stripeSubscriptionId ?? record.billing.stripeSubscriptionId,
    stripeSubscriptionStatus: normalizeStripeSubscriptionStatus(
      billing.stripeSubscriptionStatus ?? record.billing.stripeSubscriptionStatus,
    ),
    stripePriceId: billing.stripePriceId ?? record.billing.stripePriceId,
    lastWebhookEventId: billing.lastWebhookEventId ?? record.billing.lastWebhookEventId,
    lastWebhookEventType: billing.lastWebhookEventType ?? record.billing.lastWebhookEventType,
    lastWebhookProcessedAt: billing.lastWebhookProcessedAt ?? record.billing.lastWebhookProcessedAt,
  };
  touchRecord(record);
  await upsertHostedAccountPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function setHostedAccountStatusState(id: string, nextStatus: HostedAccountStatus): Promise<{
  record: HostedAccountRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return setHostedAccountStatusFile(id, nextStatus);
  const record = await findHostedAccountByIdPg(id);
  if (!record) {
    throw new AccountStoreError('NOT_FOUND', `Hosted account '${id}' was not found.`);
  }
  if (record.status === 'archived' && nextStatus !== 'archived') {
    throw new AccountStoreError(
      'INVALID_STATE',
      `Hosted account '${id}' is archived and cannot transition back to ${nextStatus}.`,
    );
  }
  if (record.status === nextStatus) {
    return { record, path: controlPlaneStoreSource() };
  }
  record.status = nextStatus;
  if (nextStatus === 'active') {
    record.suspendedAt = null;
  } else if (nextStatus === 'suspended') {
    record.suspendedAt = new Date().toISOString();
  } else if (nextStatus === 'archived') {
    record.archivedAt = new Date().toISOString();
  }
  touchRecord(record);
  await upsertHostedAccountPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function findHostedBillingEntitlementByAccountIdState(accountId: string): Promise<HostedBillingEntitlementRecord | null> {
  if (!isSharedControlPlaneConfigured()) {
    return findHostedBillingEntitlementByAccountIdFile(accountId).record;
  }
  return findHostedBillingEntitlementByAccountIdPg(accountId);
}

export async function listHostedBillingEntitlementsState(
  filters?: ListBillingEntitlementsFilters,
): Promise<{ records: HostedBillingEntitlementRecord[]; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) {
    return listHostedBillingEntitlementsFile(filters);
  }
  return {
    records: await listHostedBillingEntitlementsPg(filters),
    path: controlPlaneStoreSource(),
  };
}

export async function upsertHostedBillingEntitlementState(
  input: ProjectHostedBillingEntitlementInput,
): Promise<{ record: HostedBillingEntitlementRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) {
    const result = upsertHostedBillingEntitlementFile(input);
    return { record: result.record, path: result.path };
  }
  const previous = await findHostedBillingEntitlementByAccountIdPg(input.account.id);
  const record = projectHostedBillingEntitlement(previous, input);
  await upsertHostedBillingEntitlementPg(record);
  return {
    record,
    path: controlPlaneStoreSource(),
  };
}

export async function listWorkflowEntitlementsState(
  filters?: ListWorkflowEntitlementsFilters,
): Promise<{ records: StoredWorkflowEntitlementRecord[]; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return listWorkflowEntitlementsFile(filters);
  return {
    records: await listWorkflowEntitlementsPg(filters),
    path: controlPlaneStoreSource(),
  };
}

export async function findWorkflowEntitlementByTenantAndWorkflowState(
  tenantId: string,
  workflowId: string,
): Promise<StoredWorkflowEntitlementRecord | null> {
  if (!isSharedControlPlaneConfigured()) {
    return findWorkflowEntitlementByTenantAndWorkflowFile(tenantId, workflowId).record;
  }
  return findWorkflowEntitlementByTenantAndWorkflowPg(tenantId, workflowId);
}

export async function findWorkflowEntitlementByStripeSubscriptionItemIdState(
  stripeSubscriptionItemId: string,
): Promise<StoredWorkflowEntitlementRecord | null> {
  if (!isSharedControlPlaneConfigured()) {
    return findWorkflowEntitlementByStripeSubscriptionItemIdFile(stripeSubscriptionItemId).record;
  }
  return findWorkflowEntitlementByStripeSubscriptionItemIdPg(stripeSubscriptionItemId);
}

export async function upsertPendingWorkflowEntitlementState(
  input: PendingWorkflowEntitlementInput,
): Promise<{ record: StoredWorkflowEntitlementRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) {
    const result = upsertPendingWorkflowEntitlementFile(input);
    return { record: result.record, path: result.path };
  }
  const previous = await findWorkflowEntitlementByTenantAndWorkflowPg(
    input.tenantId,
    input.workflowId,
  );
  const record = normalizeWorkflowEntitlementRecord(
    projectPendingWorkflowEntitlement(previous, input),
  );
  await upsertWorkflowEntitlementPg(record);
  return {
    record,
    path: controlPlaneStoreSource(),
  };
}

export async function upsertWorkflowEntitlementFromStripeState(
  input: StripeWorkflowEntitlementInput,
): Promise<{ record: StoredWorkflowEntitlementRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) {
    const result = upsertWorkflowEntitlementFromStripeFile(input);
    return { record: result.record, path: result.path };
  }
  const previous = await findWorkflowEntitlementByTenantAndWorkflowPg(
    input.tenantId,
    input.workflowId,
  );
  const record = projectStripeWorkflowEntitlement(previous, input);
  await upsertWorkflowEntitlementPg(record);
  return {
    record,
    path: controlPlaneStoreSource(),
  };
}

export async function consumeWorkflowEntitlementAdmissionState(
  tenantId: string,
  workflowId: string,
): Promise<{ decision: WorkflowUsageDecision | null; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) {
    const result = consumeWorkflowEntitlementAdmissionFile(tenantId, workflowId);
    return { decision: result.decision, path: result.path };
  }
  await ensureSchema();
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.workflow_entitlements
        WHERE tenant_id = $1 AND workflow_id = $2
        FOR UPDATE`,
      [tenantId, workflowId],
    );
    if (!result.rows[0]) {
      await client.query('COMMIT');
      return { decision: null, path: controlPlaneStoreSource() };
    }
    const record = rowToWorkflowEntitlement(result.rows[0]);
    const decision = projectWorkflowEntitlementAdmissionUsage(record);
    if (decision.allowed) {
      await upsertWorkflowEntitlementPg(decision.entitlement, client);
    }
    await client.query('COMMIT');
    return { decision, path: controlPlaneStoreSource() };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function applyStripeSubscriptionStateState(options: {
  accountId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  stripePriceId?: string | null;
  eventId: string;
  eventType: string;
  eventCreatedAt?: string | null;
}): Promise<{
  record: HostedAccountRecord | null;
  previousStatus: HostedAccountStatus | null;
  nextStatus: HostedAccountStatus | null;
  previousBillingStatus: StripeSubscriptionStatus;
  nextBillingStatus: StripeSubscriptionStatus;
  path: string | null;
  matchReason: 'account_id' | 'subscription_id' | 'customer_id' | 'none';
  stale: boolean;
}> {
  if (!isSharedControlPlaneConfigured()) return applyStripeSubscriptionStateFile(options);
  const normalizedStatus = normalizeStripeSubscriptionStatus(options.stripeSubscriptionStatus ?? null);
  const records = await listHostedAccountsPg();
  const match = resolveStripeAccountMatch(records, options);
  if (!match.record) {
    return {
      record: null,
      previousStatus: null,
      nextStatus: null,
      previousBillingStatus: null,
      nextBillingStatus: normalizedStatus,
      path: null,
      matchReason: 'none',
      stale: false,
    };
  }
  const record = match.record;
  if (isIncomingProviderEventOlder(options.eventCreatedAt, record.billing.lastSubscriptionEventCreatedAt)) {
    return {
      record,
      previousStatus: record.status,
      nextStatus: record.status,
      previousBillingStatus: record.billing.stripeSubscriptionStatus,
      nextBillingStatus: record.billing.stripeSubscriptionStatus,
      path: controlPlaneStoreSource(),
      matchReason: match.matchReason,
      stale: true,
    };
  }

  const previousStatus = record.status;
  const previousBillingStatus = record.billing.stripeSubscriptionStatus;
  record.billing = {
    ...defaultBillingState(),
    ...record.billing,
    provider: 'stripe',
    stripeCustomerId: options.stripeCustomerId ?? record.billing.stripeCustomerId,
    stripeSubscriptionId: options.stripeSubscriptionId ?? record.billing.stripeSubscriptionId,
    stripeSubscriptionStatus: normalizedStatus,
    stripePriceId: options.stripePriceId ?? record.billing.stripePriceId,
    lastSubscriptionEventId: options.eventId,
    lastSubscriptionEventType: options.eventType,
    lastSubscriptionEventCreatedAt: options.eventCreatedAt ?? record.billing.lastSubscriptionEventCreatedAt,
    lastWebhookEventId: options.eventId,
    lastWebhookEventType: options.eventType,
    lastWebhookEventCreatedAt: options.eventCreatedAt ?? record.billing.lastWebhookEventCreatedAt,
    lastWebhookProcessedAt: new Date().toISOString(),
  };
  const derivedStatus = deriveHostedAccountStatusFromStripeSubscriptionStatus(normalizedStatus);
  if (record.status !== 'archived' && derivedStatus && record.status !== derivedStatus) {
    record.status = derivedStatus;
    if (derivedStatus === 'active') {
      record.suspendedAt = null;
    } else if (derivedStatus === 'suspended') {
      record.suspendedAt = new Date().toISOString();
    }
  }
  touchRecord(record);
  await upsertHostedAccountPg(record);
  return {
    record,
    previousStatus,
    nextStatus: record.status,
    previousBillingStatus,
    nextBillingStatus: record.billing.stripeSubscriptionStatus,
    path: controlPlaneStoreSource(),
    matchReason: match.matchReason,
    stale: false,
  };
}

export async function applyStripeCheckoutCompletionState(options: {
  accountId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  planId?: string | null;
  checkoutSessionId: string;
  completedAt?: string | null;
  eventId: string;
  eventType: string;
}): Promise<{
  record: HostedAccountRecord | null;
  previousStatus: HostedAccountStatus | null;
  nextStatus: HostedAccountStatus | null;
  previousBillingStatus: StripeSubscriptionStatus;
  nextBillingStatus: StripeSubscriptionStatus;
  path: string | null;
  matchReason: 'account_id' | 'subscription_id' | 'customer_id' | 'none';
}> {
  if (!isSharedControlPlaneConfigured()) return applyStripeCheckoutCompletionFile(options);
  const records = await listHostedAccountsPg();
  const match = resolveStripeAccountMatch(records, options);
  if (!match.record) {
    return {
      record: null,
      previousStatus: null,
      nextStatus: null,
      previousBillingStatus: null,
      nextBillingStatus: null,
      path: null,
      matchReason: 'none',
    };
  }
  const record = match.record;
  const previousStatus = record.status;
  const previousBillingStatus = record.billing.stripeSubscriptionStatus;
  record.billing = {
    ...defaultBillingState(),
    ...record.billing,
    provider: 'stripe',
    stripeCustomerId: options.stripeCustomerId ?? record.billing.stripeCustomerId,
    stripeSubscriptionId: options.stripeSubscriptionId ?? record.billing.stripeSubscriptionId,
    stripePriceId: options.stripePriceId ?? record.billing.stripePriceId,
    lastCheckoutSessionId: options.checkoutSessionId,
    lastCheckoutCompletedAt: options.completedAt ?? new Date().toISOString(),
    lastCheckoutPlanId: options.planId ?? record.billing.lastCheckoutPlanId,
    lastWebhookEventId: options.eventId,
    lastWebhookEventType: options.eventType,
    lastWebhookProcessedAt: new Date().toISOString(),
  };
  touchRecord(record);
  await upsertHostedAccountPg(record);
  return {
    record,
    previousStatus,
    nextStatus: record.status,
    previousBillingStatus,
    nextBillingStatus: record.billing.stripeSubscriptionStatus,
    path: controlPlaneStoreSource(),
    matchReason: match.matchReason,
  };
}

export async function applyStripeInvoiceStateState(options: {
  accountId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  invoiceId: string;
  invoiceStatus?: string | null;
  currency?: string | null;
  amountPaid?: number | null;
  amountDue?: number | null;
  paidAt?: string | null;
  paymentFailedAt?: string | null;
  eventId: string;
  eventType: string;
  eventCreatedAt?: string | null;
}): Promise<{
  record: HostedAccountRecord | null;
  previousStatus: HostedAccountStatus | null;
  nextStatus: HostedAccountStatus | null;
  previousBillingStatus: StripeSubscriptionStatus;
  nextBillingStatus: StripeSubscriptionStatus;
  path: string | null;
  matchReason: 'account_id' | 'subscription_id' | 'customer_id' | 'none';
  stale: boolean;
}> {
  if (!isSharedControlPlaneConfigured()) return applyStripeInvoiceStateFile(options);
  const normalizedInvoiceStatus = normalizeStripeInvoiceStatus(options.invoiceStatus ?? null);
  const records = await listHostedAccountsPg();
  const match = resolveStripeAccountMatch(records, options);
  if (!match.record) {
    return {
      record: null,
      previousStatus: null,
      nextStatus: null,
      previousBillingStatus: null,
      nextBillingStatus: null,
      path: null,
      matchReason: 'none',
      stale: false,
    };
  }
  const record = match.record;
  if (isIncomingProviderEventOlder(options.eventCreatedAt, record.billing.lastInvoiceEventCreatedAt)) {
    return {
      record,
      previousStatus: record.status,
      nextStatus: record.status,
      previousBillingStatus: record.billing.stripeSubscriptionStatus,
      nextBillingStatus: record.billing.stripeSubscriptionStatus,
      path: controlPlaneStoreSource(),
      matchReason: match.matchReason,
      stale: true,
    };
  }

  const previousStatus = record.status;
  const previousBillingStatus = record.billing.stripeSubscriptionStatus;
  const nextBillingStatus = options.eventType === 'invoice.paid'
    ? (
      record.billing.stripeSubscriptionStatus === 'paused'
      || record.billing.stripeSubscriptionStatus === 'canceled'
        ? record.billing.stripeSubscriptionStatus
        : record.billing.stripeSubscriptionStatus === 'trialing'
          ? 'trialing'
          : 'active'
    )
    : options.eventType === 'invoice.payment_failed'
      ? (
        record.billing.stripeSubscriptionStatus === 'paused'
        || record.billing.stripeSubscriptionStatus === 'canceled'
          ? record.billing.stripeSubscriptionStatus
          : record.billing.stripeSubscriptionStatus === 'unpaid'
            ? 'unpaid'
            : 'past_due'
      )
      : record.billing.stripeSubscriptionStatus;
  const paidAt = options.eventType === 'invoice.paid'
    ? (options.paidAt ?? new Date().toISOString())
    : record.billing.lastInvoicePaidAt;
  const delinquentSince = options.eventType === 'invoice.payment_failed'
    ? (record.billing.delinquentSince ?? options.paymentFailedAt ?? new Date().toISOString())
    : options.eventType === 'invoice.paid'
      ? null
      : record.billing.delinquentSince;
  record.billing = {
    ...defaultBillingState(),
    ...record.billing,
    provider: 'stripe',
    stripeCustomerId: options.stripeCustomerId ?? record.billing.stripeCustomerId,
    stripeSubscriptionId: options.stripeSubscriptionId ?? record.billing.stripeSubscriptionId,
    stripeSubscriptionStatus: nextBillingStatus,
    stripePriceId: options.stripePriceId ?? record.billing.stripePriceId,
    lastInvoiceId: options.invoiceId,
    lastInvoiceStatus: normalizedInvoiceStatus,
    lastInvoiceCurrency: options.currency ?? record.billing.lastInvoiceCurrency,
    lastInvoiceAmountPaid: options.amountPaid ?? record.billing.lastInvoiceAmountPaid,
    lastInvoiceAmountDue: options.amountDue ?? record.billing.lastInvoiceAmountDue,
    lastInvoiceEventId: options.eventId,
    lastInvoiceEventType: options.eventType,
    lastInvoiceEventCreatedAt: options.eventCreatedAt ?? record.billing.lastInvoiceEventCreatedAt,
    lastInvoiceProcessedAt: new Date().toISOString(),
    lastInvoicePaidAt: paidAt,
    delinquentSince,
    lastWebhookEventId: options.eventId,
    lastWebhookEventType: options.eventType,
    lastWebhookEventCreatedAt: options.eventCreatedAt ?? record.billing.lastWebhookEventCreatedAt,
    lastWebhookProcessedAt: new Date().toISOString(),
  };
  const derivedStatus = deriveHostedAccountStatusFromStripeSubscriptionStatus(nextBillingStatus);
  if (record.status !== 'archived' && derivedStatus && record.status !== derivedStatus) {
    record.status = derivedStatus;
    if (derivedStatus === 'active') {
      record.suspendedAt = null;
    } else if (derivedStatus === 'suspended') {
      record.suspendedAt = new Date().toISOString();
    }
  }
  touchRecord(record);
  await upsertHostedAccountPg(record);
  return {
    record,
    previousStatus,
    nextStatus: record.status,
    previousBillingStatus,
    nextBillingStatus: record.billing.stripeSubscriptionStatus,
    path: controlPlaneStoreSource(),
    matchReason: match.matchReason,
    stale: false,
  };
}

export async function exportHostedAccountStoreSnapshot(): Promise<HostedAccountStoreSnapshot> {
  return exportHostedAccountStoreSnapshotImpl();
}

export async function exportHostedBillingEntitlementStoreSnapshot(): Promise<BillingEntitlementStoreSnapshot> {
  return exportHostedBillingEntitlementStoreSnapshotImpl();
}

export async function exportWorkflowEntitlementStoreSnapshot(): Promise<WorkflowEntitlementSnapshot> {
  return exportWorkflowEntitlementStoreSnapshotImpl();
}

export async function restoreHostedAccountStoreSnapshot(
  snapshot: HostedAccountStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  return restoreHostedAccountStoreSnapshotImpl(snapshot, options);
}

export async function restoreWorkflowEntitlementStoreSnapshot(
  snapshot: WorkflowEntitlementSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  return restoreWorkflowEntitlementStoreSnapshotImpl(snapshot, options);
}

export async function restoreHostedBillingEntitlementStoreSnapshot(
  snapshot: BillingEntitlementStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  return restoreHostedBillingEntitlementStoreSnapshotImpl(snapshot, options);
}
