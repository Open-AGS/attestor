/**
 * Shared Control Plane Store — optional PostgreSQL-backed hosted state.
 *
 * BOUNDARY:
 * - Optional shared PostgreSQL first slice for hosted accounts, tenant keys, and usage
 * - File-backed stores remain the fallback for self-host/dev and existing operator flows
 * - Record JSON is preserved so hosted runtime behavior stays aligned with the local stores
 * - This is a control-plane state slice, not full multi-region HA or entitlement service
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
} from './account/account-store.js';
import {
  exportHostedBillingEntitlementStoreSnapshot as exportHostedBillingEntitlementStoreSnapshotFile,
  findHostedBillingEntitlementByAccountId as findHostedBillingEntitlementByAccountIdFile,
  listHostedBillingEntitlements as listHostedBillingEntitlementsFile,
  normalizeHostedBillingEntitlementRecord,
  projectHostedBillingEntitlement,
  restoreHostedBillingEntitlementStoreSnapshot as restoreHostedBillingEntitlementStoreSnapshotFile,
  upsertHostedBillingEntitlement as upsertHostedBillingEntitlementFile,
  type HostedBillingEntitlementRecord,
  type HostedBillingEntitlementStoreSnapshot,
  type ListBillingEntitlementsFilters,
  type ProjectHostedBillingEntitlementInput,
} from './billing/billing-entitlement-store.js';
import {
  tenantKeyStorePolicy,
  TenantKeyStoreError,
  type IssueTenantKeyInput,
  type TenantKeyRecord,
} from './tenant-key-store.js';
import {
  listAdminAuditRecords as listAdminAuditRecordsFile,
  verifyAdminAuditChain,
  type AdminAuditRecord,
} from './admin-audit-log.js';
import {
  readAdminIdempotencySnapshot,
  type AdminIdempotencyRecord,
} from './admin-idempotency-store.js';
export {
  ensurePipelineIdempotencyStateReady,
  lookupPipelineIdempotencyState,
  recordPipelineIdempotencyState,
} from './control-plane-store/pipeline-idempotency-state.js';
import {
  closeControlPlanePgPoolForTests,
  controlPlaneStoreMode,
  controlPlaneStoreSource,
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
  hasControlPlanePgPoolForTests,
  isSharedControlPlaneConfigured,
  type PgClient,
  type PgPool,
} from './control-plane-store/pg.js';
import { releaseAllStripeWebhookClaimLeasesForTests } from './control-plane-store/stripe-webhook-state.js';
import {
  issueTenantApiKeyState,
  upsertTenantKeyPg,
} from './control-plane-store/tenant-key-state.js';
import {
  appendAdminAuditRecordState,
  listAdminAuditRecordsState,
} from './control-plane-store/admin-audit-state.js';
import {
  lookupAdminIdempotencyState,
  recordAdminIdempotencyState,
} from './control-plane-store/admin-idempotency-state.js';
export {
  appendAdminAuditRecordState,
  listAdminAuditRecordsState,
  lookupAdminIdempotencyState,
  recordAdminIdempotencyState,
};
export {
  exportAsyncDeadLetterStoreSnapshot,
  listAsyncDeadLetterRecordsState,
  removeAsyncDeadLetterRecordState,
  restoreAsyncDeadLetterStoreSnapshot,
  upsertAsyncDeadLetterRecordState,
  type AsyncDeadLetterStoreSnapshot,
} from './control-plane-store/async-dead-letter-state.js';
export {
  exportHostedEmailDeliveryEventStoreSnapshot,
  listHostedEmailDeliveriesState,
  recordHostedEmailDispatchEventState,
  recordHostedEmailProviderEventState,
  restoreHostedEmailDeliveryEventStoreSnapshot,
  type EmailDeliveryEventStoreSnapshot,
} from './control-plane-store/email-delivery-state.js';
export {
  claimProcessedStripeWebhookState,
  exportStripeWebhookStoreSnapshot,
  finalizeProcessedStripeWebhookState,
  lookupProcessedStripeWebhookState,
  recordProcessedStripeWebhookState,
  releaseProcessedStripeWebhookClaimState,
  restoreStripeWebhookStoreSnapshot,
  type StripeWebhookClaimState,
  type StripeWebhookStoreSnapshot,
} from './control-plane-store/stripe-webhook-state.js';
export {
  exportTenantKeyStoreSnapshot,
  findActiveTenantKeyState,
  findTenantRecordByTenantIdState,
  hasTenantKeyRecordsState,
  issueTenantApiKeyState,
  listTenantKeyRecordsState,
  recoverTenantApiKeyState,
  restoreTenantKeyStoreSnapshot,
  revokeTenantApiKeyState,
  rotateTenantApiKeyState,
  setTenantApiKeyStatusState,
  syncTenantPlanByTenantIdState,
  type TenantKeyStoreSnapshot,
} from './control-plane-store/tenant-key-state.js';
export {
  canConsumePipelineRunState,
  consumePipelineRunState,
  exportUsageLedgerStoreSnapshot,
  getUsageContextState,
  queryUsageLedgerState,
  restoreUsageLedgerStoreSnapshot,
  type UsageLedgerStoreSnapshot,
} from './control-plane-store/usage-state.js';
export {
  consumeAccountUserActionTokenState,
  countAccountUsersForAccountState,
  createAccountUserState,
  exportAccountSessionStoreSnapshot,
  exportAccountUserActionTokenStoreSnapshot,
  exportAccountUserStoreSnapshot,
  findAccountSessionByTokenState,
  findAccountUserActionTokenByTokenState,
  findAccountUserByEmailState,
  findAccountUserByIdState,
  findAccountUserByOidcIdentityState,
  findAccountUserByPasskeyCredentialIdState,
  findAccountUserBySamlIdentityState,
  issueAccountInviteTokenState,
  issueAccountMfaLoginTokenState,
  issueAccountPasskeyChallengeTokenState,
  issueAccountSessionState,
  issuePasswordResetTokenState,
  listAccountUserActionTokensByAccountIdState,
  listAccountUsersByAccountIdState,
  listAllAccountUsersState,
  listHostedSamlReplaysState,
  recordAccountUserLoginState,
  recordAccountUserTotpVerificationStepState,
  recordHostedSamlReplayState,
  restoreAccountSessionStoreSnapshot,
  restoreAccountUserActionTokenStoreSnapshot,
  restoreAccountUserStoreSnapshot,
  revokeAccountSessionByTokenState,
  revokeAccountSessionsForAccountState,
  revokeAccountSessionsForUserState,
  revokeAccountSessionState,
  revokeAccountUserActionTokensForUserState,
  revokeAccountUserActionTokenState,
  saveAccountUserActionTokenRecordState,
  saveAccountUserRecordState,
  setAccountUserPasswordState,
  setAccountUserStatusState,
  type AccountSessionStoreSnapshot,
  type AccountUserActionTokenStoreSnapshot,
  type AccountUserStoreSnapshot,
} from './control-plane-store/account-auth-state.js';
import {
  adminIdempotencyCutoffIso,
  buildTenantKeyRecord,
  defaultBillingState,
  isIncomingProviderEventOlder,
  mapPgErrorToAccountStoreError,
  maybeSealTenantKeyRecord,
  normalizeHostedAccountRecord,
  normalizeStripeInvoiceStatus,
  normalizeStripeSubscriptionStatus,
  resolveStripeAccountMatch,
  rowToAdminIdempotencyRecord,
  rowToHostedAccount,
  rowToHostedBillingEntitlement,
  touchRecord,
} from './control-plane-store/mappers.js';
import { DEFAULT_HOSTED_PLAN_ID, resolvePlanSpec } from './plan-catalog.js';

export { controlPlaneStoreMode, controlPlaneStoreSource, isSharedControlPlaneConfigured };

export interface HostedAccountStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: HostedAccountRecord[];
}

export interface BillingEntitlementStoreSnapshot extends HostedBillingEntitlementStoreSnapshot {}

export interface AdminAuditLogStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  chainIntact: boolean;
  latestHash: string | null;
  records: AdminAuditRecord[];
}

export interface AdminIdempotencyStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AdminIdempotencyRecord[];
}

async function listHostedAccountsPg(): Promise<HostedAccountRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.hosted_accounts
      ORDER BY updated_at ASC, account_id ASC
  `);
  return result.rows.map(rowToHostedAccount);
}

async function findHostedAccountByIdPg(id: string): Promise<HostedAccountRecord | null> {
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

async function findHostedAccountByTenantIdPg(primaryTenantId: string): Promise<HostedAccountRecord | null> {
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

async function upsertHostedAccountPg(record: HostedAccountRecord, executor?: PgPool | PgClient): Promise<void> {
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

async function listHostedBillingEntitlementsPg(
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

async function listAllHostedBillingEntitlementsPg(): Promise<HostedBillingEntitlementRecord[]> {
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

async function findHostedBillingEntitlementByAccountIdPg(accountId: string): Promise<HostedBillingEntitlementRecord | null> {
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

async function upsertHostedBillingEntitlementPg(
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

export async function exportAdminAuditLogStoreSnapshot(): Promise<AdminAuditLogStoreSnapshot> {
  const result = isSharedControlPlaneConfigured()
    ? await listAdminAuditRecordsState()
    : listAdminAuditRecordsFile();
  const chronological = [...result.records].sort((left, right) => left.occurredAt > right.occurredAt ? 1 : -1);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: chronological.length,
    chainIntact: result.chainIntact,
    latestHash: result.latestHash,
    records: chronological,
  };
}

export async function restoreAdminAuditLogStoreSnapshot(
  snapshot: AdminAuditLogStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for admin audit restore.');
  }
  if (!verifyAdminAuditChain(snapshot.records)) {
    throw new Error('Admin audit snapshot chain is invalid and cannot be restored.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.admin_audit_log');
  }
  for (const record of snapshot.records) {
    await pool.query(
      `INSERT INTO attestor_control_plane.admin_audit_log (
        audit_id, occurred_at, actor_type, action, account_id, tenant_id, previous_hash, event_hash, record_json
      ) VALUES (
        $1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9::jsonb
      )
      ON CONFLICT (audit_id) DO UPDATE SET
        occurred_at = EXCLUDED.occurred_at,
        actor_type = EXCLUDED.actor_type,
        action = EXCLUDED.action,
        account_id = EXCLUDED.account_id,
        tenant_id = EXCLUDED.tenant_id,
        previous_hash = EXCLUDED.previous_hash,
        event_hash = EXCLUDED.event_hash,
        record_json = EXCLUDED.record_json`,
      [
        record.id,
        record.occurredAt,
        record.actorType,
        record.action,
        record.accountId,
        record.tenantId,
        record.previousHash,
        record.eventHash,
        JSON.stringify(record),
      ],
    );
  }
  return { recordCount: snapshot.records.length };
}

export async function exportAdminIdempotencyStoreSnapshot(): Promise<AdminIdempotencyStoreSnapshot> {
  if (!isSharedControlPlaneConfigured()) {
    const { records } = readAdminIdempotencySnapshot();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      records,
    };
  }
  await ensureSchema();
  const pool = await getPool();
  await pool.query(
    `DELETE FROM attestor_control_plane.admin_idempotency
      WHERE created_at < $1::timestamptz`,
    [adminIdempotencyCutoffIso()],
  );
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.admin_idempotency
      ORDER BY created_at ASC, idempotency_id ASC
  `);
  const records = result.rows.map(rowToAdminIdempotencyRecord);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreAdminIdempotencyStoreSnapshot(
  snapshot: AdminIdempotencyStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for admin idempotency restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.admin_idempotency');
  }
  for (const record of snapshot.records) {
    await pool.query(
      `INSERT INTO attestor_control_plane.admin_idempotency (
        idempotency_id, idempotency_key, route_id, request_hash, status_code,
        response_ciphertext, response_iv, response_auth_tag,
        created_at, last_replayed_at, replay_count, record_json
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9::timestamptz, $10::timestamptz, $11, $12::jsonb
      )
      ON CONFLICT (idempotency_id) DO UPDATE SET
        idempotency_key = EXCLUDED.idempotency_key,
        route_id = EXCLUDED.route_id,
        request_hash = EXCLUDED.request_hash,
        status_code = EXCLUDED.status_code,
        response_ciphertext = EXCLUDED.response_ciphertext,
        response_iv = EXCLUDED.response_iv,
        response_auth_tag = EXCLUDED.response_auth_tag,
        created_at = EXCLUDED.created_at,
        last_replayed_at = EXCLUDED.last_replayed_at,
        replay_count = EXCLUDED.replay_count,
        record_json = EXCLUDED.record_json`,
      [
        record.id,
        record.idempotencyKey,
        record.routeId,
        record.requestHash,
        record.statusCode,
        record.responseCiphertext,
        record.responseIv,
        record.responseAuthTag,
        record.createdAt,
        record.lastReplayedAt,
        record.replayCount,
        JSON.stringify(record),
      ],
    );
  }
  return { recordCount: snapshot.records.length };
}

export async function exportHostedAccountStoreSnapshot(): Promise<HostedAccountStoreSnapshot> {
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

export async function exportHostedBillingEntitlementStoreSnapshot(): Promise<BillingEntitlementStoreSnapshot> {
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

export async function restoreHostedAccountStoreSnapshot(
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

export async function restoreHostedBillingEntitlementStoreSnapshot(
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

export async function resetSharedControlPlaneStoreForTests(): Promise<void> {
  await releaseAllStripeWebhookClaimLeasesForTests();
  if (!hasControlPlanePgPoolForTests() && !controlPlaneStoreSource()) return;
  if (!isSharedControlPlaneConfigured()) {
    await closeControlPlanePgPoolForTests();
    return;
  }
  const pool = await getPool();
  await pool.query(`
    DROP TABLE IF EXISTS attestor_control_plane.async_dead_letter_jobs;
    DROP TABLE IF EXISTS attestor_control_plane.email_delivery_events;
    DROP TABLE IF EXISTS attestor_control_plane.stripe_webhook_dedupe;
    DROP TABLE IF EXISTS attestor_control_plane.pipeline_idempotency;
    DROP TABLE IF EXISTS attestor_control_plane.admin_idempotency;
    DROP TABLE IF EXISTS attestor_control_plane.admin_audit_log;
    DROP TABLE IF EXISTS attestor_control_plane.billing_entitlements;
    DROP TABLE IF EXISTS attestor_control_plane.account_saml_replays;
    DROP TABLE IF EXISTS attestor_control_plane.account_user_action_tokens;
    DROP TABLE IF EXISTS attestor_control_plane.account_sessions;
    DROP TABLE IF EXISTS attestor_control_plane.account_users;
    DROP TABLE IF EXISTS attestor_control_plane.usage_ledger;
    DROP TABLE IF EXISTS attestor_control_plane.tenant_api_keys;
    DROP TABLE IF EXISTS attestor_control_plane.hosted_accounts;
  `);
  await closeControlPlanePgPoolForTests();
}
