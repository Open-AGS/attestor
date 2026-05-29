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
import { trimAndStripTrailingSlashes } from '../platform/string-normalization.js';
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
  AccountUserStoreError,
  buildAccountUserRecord,
  createPasswordHashState,
  createAccountUser as createAccountUserFile,
  findAccountUserByEmail as findAccountUserByEmailFile,
  findAccountUserById as findAccountUserByIdFile,
  findAccountUserByOidcIdentity as findAccountUserByOidcIdentityFile,
  findAccountUserBySamlIdentity as findAccountUserBySamlIdentityFile,
  findAccountUserByPasskeyCredentialId as findAccountUserByPasskeyCredentialIdFile,
  listAccountUsersByAccountId as listAccountUsersByAccountIdFile,
  listAllAccountUsers as listAllAccountUsersFile,
  normalizeAccountUserEmail,
  recordAccountUserLogin as recordAccountUserLoginFile,
  recordAccountUserTotpVerificationStep as recordAccountUserTotpVerificationStepFile,
  saveAccountUserRecord as saveAccountUserRecordFile,
  setAccountUserPassword as setAccountUserPasswordFile,
  setAccountUserStatus as setAccountUserStatusFile,
  countAccountUsersForAccount as countAccountUsersForAccountFile,
  type AccountUserRecord,
  type AccountUserStatus,
  type CreateAccountUserInput,
} from './account/account-user-store.js';
import {
  buildAccountSessionRecord,
  accountSessionTokenHashCandidates,
  findAccountSessionByToken as findAccountSessionByTokenFile,
  isAccountSessionRecordExpired,
  issueAccountSession as issueAccountSessionFile,
  listAccountSessions as listAccountSessionsFile,
  revokeAccountSession as revokeAccountSessionFile,
  revokeAccountSessionByToken as revokeAccountSessionByTokenFile,
  revokeAccountSessionsForAccount as revokeAccountSessionsForAccountFile,
  revokeAccountSessionsForUser as revokeAccountSessionsForUserFile,
  type AccountSessionRecord,
  type IssueAccountSessionInput,
} from './account/account-session-store.js';
import {
  buildAccountMfaLoginTokenRecord,
  buildAccountPasskeyChallengeTokenRecord,
  buildAccountInviteTokenRecord,
  buildPasswordResetTokenRecord,
  consumeAccountUserActionToken as consumeAccountUserActionTokenFile,
  findAccountUserActionTokenByToken as findAccountUserActionTokenByTokenFile,
  hashAccountUserActionToken,
  issueAccountPasskeyChallengeToken as issueAccountPasskeyChallengeTokenFile,
  issueAccountMfaLoginToken as issueAccountMfaLoginTokenFile,
  issueAccountInviteToken as issueAccountInviteTokenFile,
  issuePasswordResetToken as issuePasswordResetTokenFile,
  listAccountUserActionTokensByAccountId as listAccountUserActionTokensByAccountIdFile,
  listAllAccountUserActionTokens as listAllAccountUserActionTokensFile,
  revokeAccountUserActionToken as revokeAccountUserActionTokenFile,
  revokeAccountUserActionTokensForUser as revokeAccountUserActionTokensForUserFile,
  saveAccountUserActionTokenRecord as saveAccountUserActionTokenRecordFile,
  type AccountUserActionTokenPurpose,
  type AccountUserActionTokenRecord,
  type IssueAccountMfaLoginTokenInput,
  type IssueAccountPasskeyChallengeTokenInput,
  type IssueAccountInviteTokenInput,
  type IssuePasswordResetTokenInput,
} from './account/account-user-token-store.js';
import {
  listHostedSamlReplays as listHostedSamlReplaysFile,
  recordHostedSamlReplay as recordHostedSamlReplayFile,
} from './account/account-saml-replay-store.js';
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
  findActiveTenantKey as findActiveTenantKeyFile,
  findTenantKeyRecordById as findTenantKeyRecordByIdFile,
  findTenantRecordByTenantId as findTenantRecordByTenantIdFile,
  hasTenantKeyRecords as hasTenantKeyRecordsFile,
  issueTenantApiKey as issueTenantApiKeyFile,
  listTenantKeyRecords as listTenantKeyRecordsFile,
  revokeTenantApiKey as revokeTenantApiKeyFile,
  rotateTenantApiKey as rotateTenantApiKeyFile,
  setTenantApiKeyStatus as setTenantApiKeyStatusFile,
  syncTenantPlanByTenantId as syncTenantPlanByTenantIdFile,
  tenantKeyStorePolicy,
  TenantKeyStoreError,
  type IssueTenantKeyInput,
  type RotateTenantKeyInput,
  type TenantKeyRecord,
} from './tenant-key-store.js';
import {
  canConsumePipelineRun as canConsumePipelineRunFile,
  consumePipelineRun as consumePipelineRunFile,
  getUsageContext as getUsageContextFile,
  queryUsageLedger as queryUsageLedgerFile,
  readUsageLedgerSnapshot,
  type UsageContext,
  type UsageLedgerRecord,
} from './usage-meter.js';
import {
  appendAdminAuditRecord as appendAdminAuditRecordFile,
  listAdminAuditRecords as listAdminAuditRecordsFile,
  verifyAdminAuditChain,
  type AdminAuditAction,
  type AdminAuditRecord,
} from './admin-audit-log.js';
import {
  buildAdminIdempotencyRequestHash,
  decryptAdminIdempotencyResponse,
  encryptAdminIdempotencyResponse,
  lookupAdminIdempotency as lookupAdminIdempotencyFile,
  recordAdminIdempotency as recordAdminIdempotencyFile,
  readAdminIdempotencySnapshot,
  type AdminIdempotencyLookup,
  type AdminIdempotencyRecord,
} from './admin-idempotency-store.js';
import {
  buildPipelineIdempotencyKeyDigest,
  buildPipelineIdempotencyRequestHash,
  decryptPipelineIdempotencyResponse,
  encryptPipelineIdempotencyResponse,
  ensurePipelineIdempotencyStorageReady,
  lookupPipelineIdempotency as lookupPipelineIdempotencyFile,
  pipelineIdempotencyCutoffIso,
  recordPipelineIdempotency as recordPipelineIdempotencyFile,
  type PipelineIdempotencyLookup,
  type PipelineIdempotencyRecord,
} from './pipeline/pipeline-idempotency-store.js';
import {
  lookupProcessedStripeWebhook as lookupProcessedStripeWebhookFile,
  recordProcessedStripeWebhook as recordProcessedStripeWebhookFile,
  readStripeWebhookStoreSnapshot,
  type StripeWebhookLookup,
  type StripeWebhookRecord,
} from './billing/stripe/stripe-webhook-store.js';
import {
  buildHostedEmailDispatchEventRecord,
  buildHostedEmailProviderEventRecord,
  exportHostedEmailDeliveryEventStoreSnapshot as exportHostedEmailDeliveryEventStoreSnapshotFile,
  filterHostedEmailDeliverySummaries,
  hostedEmailProviderReplayDigest,
  listHostedEmailDeliveries as listHostedEmailDeliveriesFile,
  normalizeStatus as normalizeHostedEmailDeliveryStatus,
  recordHostedEmailDispatchEvent as recordHostedEmailDispatchEventFile,
  recordHostedEmailProviderEvent as recordHostedEmailProviderEventFile,
  restoreHostedEmailDeliveryEventStoreSnapshot as restoreHostedEmailDeliveryEventStoreSnapshotFile,
  summarizeHostedEmailDeliveryEvents,
  type HostedEmailDeliveryEventRecord,
  type HostedEmailDeliveryProvider,
  type HostedEmailDeliveryEventStoreSnapshot,
  type HostedEmailDeliverySummaryRecord,
  type ListHostedEmailDeliveryFilters,
  type RecordHostedEmailDispatchEventInput,
  type RecordHostedEmailProviderEventInput,
} from './async/email-delivery-event-store.js';
import {
  listAsyncDeadLetterRecords as listAsyncDeadLetterRecordsFile,
  normalizeAsyncDeadLetterRecord,
  readAsyncDeadLetterStoreSnapshot,
  removeAsyncDeadLetterRecord as removeAsyncDeadLetterRecordFile,
  upsertAsyncDeadLetterRecord as upsertAsyncDeadLetterRecordFile,
  type AsyncDeadLetterBackendMode,
  type AsyncDeadLetterRecord,
} from './async/async-dead-letter-store.js';
import { hashJsonValue } from './json-stable.js';
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
  withControlPlanePgTransaction as withPgTransaction,
} from './control-plane-store/pg.js';
import {
  activeReplacementExists,
  adminIdempotencyCutoffIso,
  advisoryLockKey,
  buildTenantKeyRecord,
  coerceAccountUserActionTokenRecord,
  coerceAccountUserRecord,
  coerceHostedSamlReplayRecord,
  coerceHostedEmailDeliveryEventRecord,
  compareIso,
  currentPeriod,
  defaultBillingState,
  hashApiKey,
  isIncomingProviderEventOlder,
  mapPgErrorToAccountStoreError,
  mapPgErrorToAccountUserStoreError,
  maybeSealTenantKeyRecord,
  normalizeHostedAccountRecord,
  normalizeStripeInvoiceStatus,
  normalizeStripeSubscriptionStatus,
  normalizeTenantKeyRecord,
  recoverTenantKeyMaterial,
  resolveStripeAccountMatch,
  rowToAccountSession,
  rowToAccountUser,
  rowToAccountUserActionToken,
  rowToAdminAuditRecord,
  rowToAdminIdempotencyRecord,
  rowToAsyncDeadLetterRecord,
  rowToHostedAccount,
  rowToHostedBillingEntitlement,
  rowToHostedEmailDeliveryEventRecord,
  rowToHostedSamlReplay,
  rowToPipelineIdempotencyRecord,
  rowToStripeWebhookRecord,
  rowToTenantKey,
  rowToUsageRecord,
  statusRank,
  touchRecord,
  usageContextFromRecord,
} from './control-plane-store/mappers.js';
import { DEFAULT_HOSTED_PLAN_ID, resolvePlanSpec } from './plan-catalog.js';
import type { HostedSamlReplayRecord } from './account/account-saml.js';

export { controlPlaneStoreMode, controlPlaneStoreSource, isSharedControlPlaneConfigured };

export interface HostedAccountStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: HostedAccountRecord[];
}

export interface TenantKeyStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: TenantKeyRecord[];
}

export interface UsageLedgerStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  monthlyPipelineRuns: UsageLedgerRecord[];
}

export interface AccountUserStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AccountUserRecord[];
}

export interface AccountSessionStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AccountSessionRecord[];
}

export interface AccountUserActionTokenStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AccountUserActionTokenRecord[];
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

export interface StripeWebhookStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: StripeWebhookRecord[];
}

export interface AsyncDeadLetterStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AsyncDeadLetterRecord[];
}

export interface EmailDeliveryEventStoreSnapshot extends HostedEmailDeliveryEventStoreSnapshot {}

type StripeWebhookClaimLease = {
  client: PgClient;
  advisoryLockKey: string;
  eventId: string;
};
const stripeWebhookClaimLeases = new Map<string, StripeWebhookClaimLease>();

export type StripeWebhookClaimState =
  | { kind: 'claimed'; payloadHash: string; record: StripeWebhookRecord; claimId: string }
  | { kind: 'duplicate'; payloadHash: string; record: StripeWebhookRecord }
  | { kind: 'conflict'; payloadHash: string; record: StripeWebhookRecord };

async function releaseStripeWebhookPgClaimLease(claimId: string): Promise<void> {
  const lease = stripeWebhookClaimLeases.get(claimId);
  if (!lease) return;
  stripeWebhookClaimLeases.delete(claimId);
  try {
    await lease.client.query('SELECT pg_advisory_unlock($1::bigint)', [lease.advisoryLockKey]);
  } finally {
    lease.client.release();
  }
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

async function listTenantKeyRecordsPg(): Promise<TenantKeyRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.tenant_api_keys
      ORDER BY created_at ASC, key_id ASC
  `);
  return result.rows.map(rowToTenantKey);
}

async function upsertTenantKeyPg(record: TenantKeyRecord, executor?: PgPool | PgClient): Promise<void> {
  await ensureSchema();
  const target = executor ?? await getPool();
  try {
    await target.query(
      `INSERT INTO attestor_control_plane.tenant_api_keys (
        key_id, tenant_id, tenant_name, plan_id, monthly_run_quota, api_key_hash, api_key_preview, key_status,
        created_at, last_used_at, deactivated_at, revoked_at, rotated_from_key_id, superseded_by_key_id, superseded_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9::timestamptz, $10::timestamptz, $11::timestamptz, $12::timestamptz, $13, $14, $15::timestamptz, $16::jsonb
      )
      ON CONFLICT (key_id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        tenant_name = EXCLUDED.tenant_name,
        plan_id = EXCLUDED.plan_id,
        monthly_run_quota = EXCLUDED.monthly_run_quota,
        api_key_hash = EXCLUDED.api_key_hash,
        api_key_preview = EXCLUDED.api_key_preview,
        key_status = EXCLUDED.key_status,
        created_at = EXCLUDED.created_at,
        last_used_at = EXCLUDED.last_used_at,
        deactivated_at = EXCLUDED.deactivated_at,
        revoked_at = EXCLUDED.revoked_at,
        rotated_from_key_id = EXCLUDED.rotated_from_key_id,
        superseded_by_key_id = EXCLUDED.superseded_by_key_id,
        superseded_at = EXCLUDED.superseded_at,
        record_json = EXCLUDED.record_json`,
      [
        record.id,
        record.tenantId,
        record.tenantName,
        record.planId,
        record.monthlyRunQuota,
        record.apiKeyHash,
        record.apiKeyPreview,
        record.status,
        record.createdAt,
        record.lastUsedAt,
        record.deactivatedAt,
        record.revokedAt,
        record.rotatedFromKeyId,
        record.supersededByKeyId,
        record.supersededAt,
        JSON.stringify(record),
      ],
    );
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === '23505') {
      throw new TenantKeyStoreError('INVALID_STATE', 'Tenant key uniqueness constraint violated.');
    }
    throw err;
  }
}

async function listUsageLedgerPg(filters?: { tenantId?: string | null; period?: string | null }): Promise<UsageLedgerRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const where: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filters?.tenantId) {
    where.push(`tenant_id = $${idx++}`);
    params.push(filters.tenantId);
  }
  if (filters?.period) {
    where.push(`period = $${idx++}`);
    params.push(filters.period);
  }
  const sql = `
    SELECT tenant_id, period, used, updated_at
      FROM attestor_control_plane.usage_ledger
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY period DESC, used DESC, tenant_id ASC
  `;
  const result = await pool.query(sql, params);
  return result.rows.map(rowToUsageRecord);
}

async function readUsageCountPg(tenantId: string, period: string): Promise<number> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT used
       FROM attestor_control_plane.usage_ledger
      WHERE tenant_id = $1 AND period = $2
      LIMIT 1`,
    [tenantId, period],
  );
  return result.rows.length > 0 ? Number(result.rows[0].used) : 0;
}

async function consumeUsagePg(tenantId: string, period: string): Promise<number> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `INSERT INTO attestor_control_plane.usage_ledger (
      tenant_id, period, used, updated_at
    ) VALUES (
      $1, $2, 1, NOW()
    )
    ON CONFLICT (tenant_id, period) DO UPDATE SET
      used = attestor_control_plane.usage_ledger.used + 1,
      updated_at = NOW()
    RETURNING used`,
    [tenantId, period],
  );
  return Number(result.rows[0].used);
}

async function listAccountUsersByAccountIdPg(accountId: string): Promise<AccountUserRecord[]> {
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

async function listAllAccountUsersPg(): Promise<AccountUserRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.account_users
      ORDER BY updated_at DESC, account_user_id ASC
  `);
  return result.rows.map(rowToAccountUser);
}

async function findAccountUserByIdPg(id: string): Promise<AccountUserRecord | null> {
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

async function findAccountUserByEmailPg(email: string): Promise<AccountUserRecord | null> {
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

async function countAccountUsersByAccountIdPg(accountId: string): Promise<number> {
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

async function upsertAccountUserPg(record: AccountUserRecord, executor?: PgPool | PgClient): Promise<void> {
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

async function listAccountSessionsPg(filters?: {
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

async function upsertAccountSessionPg(record: AccountSessionRecord, executor?: PgPool | PgClient): Promise<void> {
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

async function listAccountUserActionTokensPg(filters?: {
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

async function upsertAccountUserActionTokenPg(
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

async function findAccountSessionByTokenPg(token: string, options?: { touch?: boolean }): Promise<AccountSessionRecord | null> {
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

async function findAccountUserActionTokenByTokenPg(token: string): Promise<AccountUserActionTokenRecord | null> {
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

async function listHostedSamlReplaysPg(): Promise<HostedSamlReplayRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  await pool.query(
    `DELETE FROM attestor_control_plane.account_saml_replays
      WHERE expires_at <= $1::timestamptz`,
    [new Date().toISOString()],
  );
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_saml_replays
      ORDER BY consumed_at DESC, request_id ASC`,
  );
  return result.rows.map(rowToHostedSamlReplay);
}

async function recordHostedSamlReplayPg(
  record: HostedSamlReplayRecord,
): Promise<{ duplicate: boolean; record: HostedSamlReplayRecord; existing: HostedSamlReplayRecord | null }> {
  await ensureSchema();
  const pool = await getPool();
  const normalized = coerceHostedSamlReplayRecord(record);
  await pool.query(
    `DELETE FROM attestor_control_plane.account_saml_replays
      WHERE expires_at <= $1::timestamptz`,
    [new Date().toISOString()],
  );
  const insert = await pool.query(
    `INSERT INTO attestor_control_plane.account_saml_replays (
      request_id, response_id, issuer, subject, consumed_at, expires_at, record_json
    ) VALUES (
      $1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::jsonb
    )
    ON CONFLICT (request_id) DO NOTHING
    RETURNING record_json`,
    [
      normalized.requestId,
      normalized.responseId,
      normalized.issuer,
      normalized.subject,
      normalized.consumedAt,
      normalized.expiresAt,
      JSON.stringify(normalized),
    ],
  );
  if (insert.rows[0]) {
    return {
      duplicate: false,
      record: normalized,
      existing: null,
    };
  }
  const existing = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_saml_replays
      WHERE request_id = $1
      LIMIT 1`,
    [normalized.requestId],
  );
  return {
    duplicate: true,
    record: normalized,
    existing: existing.rows[0] ? rowToHostedSamlReplay(existing.rows[0]) : null,
  };
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

export async function listTenantKeyRecordsState(): Promise<{
  records: TenantKeyRecord[];
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return listTenantKeyRecordsFile();
  return {
    records: await listTenantKeyRecordsPg(),
    path: controlPlaneStoreSource(),
  };
}

export async function issueTenantApiKeyState(input: IssueTenantKeyInput): Promise<{
  apiKey: string;
  record: TenantKeyRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return issueTenantApiKeyFile(input);
  const resolvedPlan = resolvePlanSpec({
    planId: input.planId,
    monthlyRunQuota: input.monthlyRunQuota,
    defaultPlanId: DEFAULT_HOSTED_PLAN_ID,
  });
  const records = await listTenantKeyRecordsPg();
  const activeCount = records.filter((entry) => entry.tenantId === input.tenantId && entry.status === 'active').length;
  const maxActive = tenantKeyStorePolicy().maxActiveKeysPerTenant;
  if (activeCount >= maxActive) {
    throw new TenantKeyStoreError(
      'LIMIT_EXCEEDED',
      `Tenant '${input.tenantId}' already has ${activeCount} active keys. Deactivate or revoke one before issuing another. Max active keys per tenant: ${maxActive}.`,
    );
  }
  const apiKey = `atk_${randomBytes(24).toString('hex')}`;
  let record = buildTenantKeyRecord({
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    planId: resolvedPlan.planId,
    monthlyRunQuota: resolvedPlan.monthlyRunQuota,
    apiKey,
    createdAt: new Date().toISOString(),
  });
  record = await maybeSealTenantKeyRecord(record, apiKey);
  await upsertTenantKeyPg(record);
  return { apiKey, record, path: controlPlaneStoreSource() };
}

export async function rotateTenantApiKeyState(id: string, input?: RotateTenantKeyInput): Promise<{
  apiKey: string;
  record: TenantKeyRecord;
  previousRecord: TenantKeyRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return rotateTenantApiKeyFile(id, input);
  const records = await listTenantKeyRecordsPg();
  const sourceRecord = records.find((entry) => entry.id === id);
  if (!sourceRecord) {
    throw new TenantKeyStoreError('NOT_FOUND', `Tenant key record not found: ${id}`);
  }
  if (sourceRecord.status !== 'active') {
    throw new TenantKeyStoreError(
      'INVALID_STATE',
      `Tenant key '${id}' must be active before rotation. Current status: ${sourceRecord.status}.`,
    );
  }
  if (activeReplacementExists(records, sourceRecord)) {
    throw new TenantKeyStoreError(
      'INVALID_STATE',
      `Tenant key '${id}' already has an unreconciled replacement key. Reuse or revoke the replacement before rotating again.`,
    );
  }
  const activeCount = records.filter((entry) => entry.tenantId === sourceRecord.tenantId && entry.status === 'active').length;
  const maxActive = tenantKeyStorePolicy().maxActiveKeysPerTenant;
  if (activeCount >= maxActive) {
    throw new TenantKeyStoreError(
      'LIMIT_EXCEEDED',
      `Tenant '${sourceRecord.tenantId}' already has ${activeCount} active keys. Deactivate or revoke one before issuing another. Max active keys per tenant: ${maxActive}.`,
    );
  }
  const resolvedPlan = resolvePlanSpec({
    planId: input?.planId ?? sourceRecord.planId,
    monthlyRunQuota: input?.monthlyRunQuota ?? sourceRecord.monthlyRunQuota,
    defaultPlanId: DEFAULT_HOSTED_PLAN_ID,
  });
  const apiKey = `atk_${randomBytes(24).toString('hex')}`;
  const createdAt = new Date().toISOString();
  let record = buildTenantKeyRecord({
    tenantId: sourceRecord.tenantId,
    tenantName: sourceRecord.tenantName,
    planId: resolvedPlan.planId,
    monthlyRunQuota: resolvedPlan.monthlyRunQuota,
    apiKey,
    createdAt,
    rotatedFromKeyId: sourceRecord.id,
  });
  record = await maybeSealTenantKeyRecord(record, apiKey);
  sourceRecord.supersededByKeyId = record.id;
  sourceRecord.supersededAt = createdAt;
  await upsertTenantKeyPg(sourceRecord);
  await upsertTenantKeyPg(record);
  return {
    apiKey,
    record,
    previousRecord: sourceRecord,
    path: controlPlaneStoreSource(),
  };
}

export async function setTenantApiKeyStatusState(id: string, nextStatus: 'active' | 'inactive'): Promise<{
  record: TenantKeyRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return setTenantApiKeyStatusFile(id, nextStatus);
  const records = await listTenantKeyRecordsPg();
  const record = records.find((entry) => entry.id === id);
  if (!record) {
    throw new TenantKeyStoreError('NOT_FOUND', `Tenant key record not found: ${id}`);
  }
  if (record.status === 'revoked') {
    throw new TenantKeyStoreError(
      'INVALID_STATE',
      `Tenant key '${id}' is revoked and cannot transition back to ${nextStatus}.`,
    );
  }
  if (nextStatus === 'inactive') {
    if (record.status === 'inactive') return { record, path: controlPlaneStoreSource() };
    record.status = 'inactive';
    record.deactivatedAt = new Date().toISOString();
    await upsertTenantKeyPg(record);
    return { record, path: controlPlaneStoreSource() };
  }
  if (record.status === 'active') return { record, path: controlPlaneStoreSource() };
  const activeCount = records.filter((entry) => entry.tenantId === record.tenantId && entry.status === 'active').length;
  const maxActive = tenantKeyStorePolicy().maxActiveKeysPerTenant;
  if (activeCount >= maxActive) {
    throw new TenantKeyStoreError(
      'LIMIT_EXCEEDED',
      `Tenant '${record.tenantId}' already has ${activeCount} active keys. Deactivate or revoke one before issuing another. Max active keys per tenant: ${maxActive}.`,
    );
  }
  record.status = 'active';
  record.deactivatedAt = null;
  await upsertTenantKeyPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function revokeTenantApiKeyState(id: string): Promise<{
  record: TenantKeyRecord | null;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return revokeTenantApiKeyFile(id);
  const records = await listTenantKeyRecordsPg();
  const record = records.find((entry) => entry.id === id) ?? null;
  if (!record) return { record: null, path: controlPlaneStoreSource() };
  if (record.status === 'revoked') return { record, path: controlPlaneStoreSource() };
  record.status = 'revoked';
  record.revokedAt = new Date().toISOString();
  await upsertTenantKeyPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function findActiveTenantKeyState(
  apiKey: string,
  options?: { markUsed?: boolean },
): Promise<TenantKeyRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findActiveTenantKeyFile(apiKey, options);
  await ensureSchema();
  const pool = await getPool();
  const hashed = hashApiKey(apiKey);
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.tenant_api_keys
      WHERE api_key_hash = $1 AND key_status = 'active'
      LIMIT 1`,
    [hashed],
  );
  const record = result.rows[0] ? rowToTenantKey(result.rows[0]) : null;
  if (!record) return null;
  if (options?.markUsed) {
    record.lastUsedAt = new Date().toISOString();
    await upsertTenantKeyPg(record);
  }
  return record;
}

export async function hasTenantKeyRecordsState(): Promise<boolean> {
  if (!isSharedControlPlaneConfigured()) return hasTenantKeyRecordsFile();
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(`SELECT EXISTS(SELECT 1 FROM attestor_control_plane.tenant_api_keys) AS present`);
  return Boolean(result.rows[0]?.present);
}

export async function findTenantRecordByTenantIdState(tenantId: string): Promise<TenantKeyRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findTenantRecordByTenantIdFile(tenantId);
  const records = await listTenantKeyRecordsPg();
  const candidates = records.filter((entry) => entry.tenantId === tenantId);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const statusDelta = statusRank(a.status) - statusRank(b.status);
    if (statusDelta !== 0) return statusDelta;
    return a.createdAt > b.createdAt ? -1 : 1;
  });
  return candidates[0] ?? null;
}

export async function syncTenantPlanByTenantIdState(tenantId: string, options: {
  planId: string;
  monthlyRunQuota: number | null;
}): Promise<{
  records: TenantKeyRecord[];
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return syncTenantPlanByTenantIdFile(tenantId, options);
  const records = await listTenantKeyRecordsPg();
  const matching = records.filter((entry) => entry.tenantId === tenantId && entry.status !== 'revoked');
  if (matching.length === 0) return { records: [], path: controlPlaneStoreSource() };
  const resolvedPlan = resolvePlanSpec({
    planId: options.planId,
    monthlyRunQuota: options.monthlyRunQuota,
    defaultPlanId: DEFAULT_HOSTED_PLAN_ID,
  });
  for (const record of matching) {
    record.planId = resolvedPlan.planId;
    record.monthlyRunQuota = resolvedPlan.monthlyRunQuota;
    await upsertTenantKeyPg(record);
  }
  return { records: matching, path: controlPlaneStoreSource() };
}

export async function getUsageContextState(
  tenantId: string,
  planId: string | null | undefined,
  quota: number | null | undefined,
): Promise<UsageContext> {
  if (!isSharedControlPlaneConfigured()) return getUsageContextFile(tenantId, planId, quota);
  const period = currentPeriod();
  const used = await readUsageCountPg(tenantId, period);
  return usageContextFromRecord(tenantId, planId, quota, used, period);
}

export async function canConsumePipelineRunState(
  tenantId: string,
  planId: string | null | undefined,
  quota: number | null | undefined,
): Promise<{ allowed: boolean; usage: UsageContext }> {
  if (!isSharedControlPlaneConfigured()) return canConsumePipelineRunFile(tenantId, planId, quota);
  const usage = await getUsageContextState(tenantId, planId, quota);
  if (!usage.enforced) return { allowed: true, usage };
  return { allowed: usage.used < (usage.quota ?? 0), usage };
}

export async function consumePipelineRunState(
  tenantId: string,
  planId: string | null | undefined,
  quota: number | null | undefined,
): Promise<UsageContext> {
  if (!isSharedControlPlaneConfigured()) return consumePipelineRunFile(tenantId, planId, quota);
  const period = currentPeriod();
  const used = await consumeUsagePg(tenantId, period);
  return usageContextFromRecord(tenantId, planId, quota, used, period);
}

export async function queryUsageLedgerState(filters?: {
  tenantId?: string | null;
  period?: string | null;
}): Promise<UsageLedgerRecord[]> {
  if (!isSharedControlPlaneConfigured()) return queryUsageLedgerFile(filters);
  return listUsageLedgerPg(filters);
}

export async function listAccountUsersByAccountIdState(accountId: string): Promise<{
  records: AccountUserRecord[];
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return listAccountUsersByAccountIdFile(accountId);
  return {
    records: await listAccountUsersByAccountIdPg(accountId),
    path: controlPlaneStoreSource(),
  };
}

export async function listAllAccountUsersState(): Promise<{
  records: AccountUserRecord[];
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return listAllAccountUsersFile();
  return {
    records: await listAllAccountUsersPg(),
    path: controlPlaneStoreSource(),
  };
}

export async function countAccountUsersForAccountState(accountId: string): Promise<number> {
  if (!isSharedControlPlaneConfigured()) return countAccountUsersForAccountFile(accountId);
  return countAccountUsersByAccountIdPg(accountId);
}

export async function findAccountUserByIdState(id: string): Promise<AccountUserRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserByIdFile(id);
  return findAccountUserByIdPg(id);
}

export async function findAccountUserByEmailState(email: string): Promise<AccountUserRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserByEmailFile(email);
  return findAccountUserByEmailPg(normalizeAccountUserEmail(email));
}

export async function findAccountUserByOidcIdentityState(
  issuer: string,
  subject: string,
): Promise<AccountUserRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserByOidcIdentityFile(issuer, subject);
  const records = await listAllAccountUsersPg();
  const normalizedIssuer = trimAndStripTrailingSlashes(issuer);
  const normalizedSubject = subject.trim();
  return records.find((record) =>
    record.federation?.oidc?.identities?.some((identity) =>
      trimAndStripTrailingSlashes(identity.issuer) === normalizedIssuer
      && identity.subject.trim() === normalizedSubject)) ?? null;
}

export async function findAccountUserBySamlIdentityState(
  issuer: string,
  subject: string,
): Promise<AccountUserRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserBySamlIdentityFile(issuer, subject);
  const records = await listAllAccountUsersPg();
  const normalizedIssuer = trimAndStripTrailingSlashes(issuer);
  const normalizedSubject = subject.trim();
  return records.find((record) =>
    record.federation?.saml?.identities?.some((identity) =>
      trimAndStripTrailingSlashes(identity.issuer) === normalizedIssuer
      && identity.subject.trim() === normalizedSubject)) ?? null;
}

export async function findAccountUserByPasskeyCredentialIdState(
  credentialId: string,
): Promise<AccountUserRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserByPasskeyCredentialIdFile(credentialId);
  const normalizedCredentialId = credentialId.trim();
  if (!normalizedCredentialId) return null;
  const records = await listAllAccountUsersPg();
  return records.find((record) =>
    record.passkeys?.credentials?.some((credential) => credential.credentialId === normalizedCredentialId)) ?? null;
}

export async function createAccountUserState(input: CreateAccountUserInput): Promise<{
  record: AccountUserRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return createAccountUserFile(input);
  const record = buildAccountUserRecord(input);
  await upsertAccountUserPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function recoverTenantApiKeyState(id: string): Promise<{
  record: TenantKeyRecord;
  apiKey: string;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) {
    const current = findTenantKeyRecordByIdFile(id);
    if (!current.record) {
      throw new TenantKeyStoreError('NOT_FOUND', `Tenant key record not found: ${id}`);
    }
    const apiKey = await recoverTenantKeyMaterial(current.record);
    return {
      record: current.record,
      apiKey,
      path: current.path,
    };
  }

  const records = await listTenantKeyRecordsPg();
  const record = records.find((entry) => entry.id === id);
  if (!record) {
    throw new TenantKeyStoreError('NOT_FOUND', `Tenant key record not found: ${id}`);
  }
  const apiKey = await recoverTenantKeyMaterial(record);
  return {
    record,
    apiKey,
    path: controlPlaneStoreSource(),
  };
}

export async function saveAccountUserRecordState(record: AccountUserRecord): Promise<{
  record: AccountUserRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return saveAccountUserRecordFile(record);
  const normalized = coerceAccountUserRecord(record);
  await upsertAccountUserPg(normalized);
  return { record: normalized, path: controlPlaneStoreSource() };
}

export async function recordAccountUserLoginState(id: string): Promise<{
  record: AccountUserRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return recordAccountUserLoginFile(id);
  const record = await findAccountUserByIdPg(id);
  if (!record) {
    throw new AccountUserStoreError('NOT_FOUND', `Account user '${id}' was not found.`);
  }
  record.lastLoginAt = new Date().toISOString();
  record.updatedAt = record.lastLoginAt;
  await upsertAccountUserPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function recordAccountUserTotpVerificationStepState(
  id: string,
  acceptedStep: string,
  verifiedAt = new Date().toISOString(),
): Promise<{
  record: AccountUserRecord;
  path: string | null;
  accepted: boolean;
}> {
  if (!/^\d+$/.test(acceptedStep)) {
    throw new AccountUserStoreError('INVALID_STATE', 'Accepted TOTP step must be a non-negative integer string.');
  }
  if (!isSharedControlPlaneConfigured()) {
    return recordAccountUserTotpVerificationStepFile(id, acceptedStep, verifiedAt);
  }
  const nextStep = BigInt(acceptedStep);
  return withPgTransaction(async (client) => {
    const result = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.account_users
        WHERE account_user_id = $1
        FOR UPDATE`,
      [id],
    );
    const record = result.rows[0] ? rowToAccountUser(result.rows[0]) : null;
    if (!record) {
      throw new AccountUserStoreError('NOT_FOUND', `Account user '${id}' was not found.`);
    }
    const lastStep = record.mfa.totp.lastAcceptedStep;
    if (lastStep && /^\d+$/.test(lastStep) && nextStep <= BigInt(lastStep)) {
      return { record, path: controlPlaneStoreSource(), accepted: false };
    }
    record.mfa.totp.lastAcceptedStep = acceptedStep;
    record.mfa.totp.lastVerifiedAt = verifiedAt;
    record.mfa.totp.updatedAt = verifiedAt;
    record.updatedAt = verifiedAt;
    await upsertAccountUserPg(record, client);
    return { record, path: controlPlaneStoreSource(), accepted: true };
  });
}

export async function setAccountUserStatusState(
  id: string,
  nextStatus: AccountUserStatus,
): Promise<{
  record: AccountUserRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return setAccountUserStatusFile(id, nextStatus);
  return withPgTransaction(async (client) => {
    const record = await findAccountUserByIdPg(id);
    if (!record) {
      throw new AccountUserStoreError('NOT_FOUND', `Account user '${id}' was not found.`);
    }
    if (record.status === nextStatus) {
      return { record, path: controlPlaneStoreSource() };
    }
    if (nextStatus === 'inactive' && record.role === 'account_admin') {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count
           FROM attestor_control_plane.account_users
          WHERE account_id = $1
            AND role_id = 'account_admin'
            AND user_status = 'active'`,
        [record.accountId],
      );
      const activeAdmins = Number(result.rows[0]?.count ?? 0);
      if (activeAdmins <= 1) {
        throw new AccountUserStoreError(
          'INVALID_STATE',
          `Account '${record.accountId}' must retain at least one active account_admin user.`,
        );
      }
    }
    record.status = nextStatus;
    record.updatedAt = new Date().toISOString();
    record.deactivatedAt = nextStatus === 'inactive' ? record.updatedAt : null;
    await upsertAccountUserPg(record, client);
    return { record, path: controlPlaneStoreSource() };
  });
}

export async function setAccountUserPasswordState(
  id: string,
  nextPassword: string,
): Promise<{
  record: AccountUserRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return setAccountUserPasswordFile(id, nextPassword);
  const record = await findAccountUserByIdPg(id);
  if (!record) {
    throw new AccountUserStoreError('NOT_FOUND', `Account user '${id}' was not found.`);
  }
  const now = new Date().toISOString();
  record.password = createPasswordHashState(nextPassword);
  record.passwordUpdatedAt = now;
  record.updatedAt = now;
  await upsertAccountUserPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function issueAccountSessionState(input: IssueAccountSessionInput): Promise<{
  sessionToken: string;
  record: AccountSessionRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return issueAccountSessionFile(input);
  const issued = buildAccountSessionRecord(input);
  await upsertAccountSessionPg(issued.record);
  return { ...issued, path: controlPlaneStoreSource() };
}

export async function findAccountSessionByTokenState(
  token: string,
  options?: { touch?: boolean },
): Promise<AccountSessionRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountSessionByTokenFile(token, options);
  return findAccountSessionByTokenPg(token, options);
}

export async function revokeAccountSessionState(id: string): Promise<{
  record: AccountSessionRecord | null;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountSessionFile(id);
  const records = await listAccountSessionsPg();
  const record = records.find((entry) => entry.id === id) ?? null;
  if (!record) return { record: null, path: controlPlaneStoreSource() };
  if (!record.revokedAt) {
    record.revokedAt = new Date().toISOString();
    await upsertAccountSessionPg(record);
  }
  return { record, path: controlPlaneStoreSource() };
}

export async function revokeAccountSessionByTokenState(token: string): Promise<{
  record: AccountSessionRecord | null;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountSessionByTokenFile(token);
  const record = await findAccountSessionByTokenPg(token);
  if (!record) return { record: null, path: controlPlaneStoreSource() };
  if (!record.revokedAt) {
    record.revokedAt = new Date().toISOString();
    await upsertAccountSessionPg(record);
  }
  return { record, path: controlPlaneStoreSource() };
}

export async function revokeAccountSessionsForUserState(accountUserId: string): Promise<{
  revokedCount: number;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountSessionsForUserFile(accountUserId);
  const sessions = await listAccountSessionsPg({ accountUserId });
  let revokedCount = 0;
  for (const session of sessions) {
    if (!session.revokedAt) {
      session.revokedAt = new Date().toISOString();
      await upsertAccountSessionPg(session);
      revokedCount += 1;
    }
  }
  return { revokedCount, path: controlPlaneStoreSource() };
}

export async function revokeAccountSessionsForAccountState(accountId: string): Promise<{
  revokedCount: number;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountSessionsForAccountFile(accountId);
  const sessions = await listAccountSessionsPg({ accountId });
  let revokedCount = 0;
  for (const session of sessions) {
    if (!session.revokedAt) {
      session.revokedAt = new Date().toISOString();
      await upsertAccountSessionPg(session);
      revokedCount += 1;
    }
  }
  return { revokedCount, path: controlPlaneStoreSource() };
}

export async function listAccountUserActionTokensByAccountIdState(
  accountId: string,
  options?: { purpose?: AccountUserActionTokenPurpose | null },
): Promise<{
  records: AccountUserActionTokenRecord[];
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return listAccountUserActionTokensByAccountIdFile(accountId, options);
  return {
    records: await listAccountUserActionTokensPg({ accountId, purpose: options?.purpose ?? null }),
    path: controlPlaneStoreSource(),
  };
}

export async function findAccountUserActionTokenByTokenState(
  token: string,
): Promise<AccountUserActionTokenRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserActionTokenByTokenFile(token);
  return findAccountUserActionTokenByTokenPg(token);
}

export async function recordHostedSamlReplayState(
  record: HostedSamlReplayRecord,
): Promise<{
  duplicate: boolean;
  record: HostedSamlReplayRecord;
  existing: HostedSamlReplayRecord | null;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) {
    const result = recordHostedSamlReplayFile(record);
    return {
      ...result,
      path: result.path,
    };
  }
  const result = await recordHostedSamlReplayPg(record);
  return {
    ...result,
    path: controlPlaneStoreSource(),
  };
}

export async function listHostedSamlReplaysState(): Promise<{
  records: HostedSamlReplayRecord[];
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) {
    const result = listHostedSamlReplaysFile();
    return {
      records: result.records,
      path: result.path,
    };
  }
  return {
    records: await listHostedSamlReplaysPg(),
    path: controlPlaneStoreSource(),
  };
}

export async function issueAccountInviteTokenState(
  input: IssueAccountInviteTokenInput,
): Promise<{ token: string; record: AccountUserActionTokenRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return issueAccountInviteTokenFile(input);
  const existing = await listAccountUserActionTokensPg({ accountId: input.accountId, purpose: 'invite' });
  for (const record of existing) {
    if (record.email === normalizeAccountUserEmail(input.email) && !record.revokedAt && !record.consumedAt && Date.parse(record.expiresAt) > Date.now()) {
      record.revokedAt = new Date().toISOString();
      record.updatedAt = record.revokedAt;
      await upsertAccountUserActionTokenPg(record);
    }
  }
  const issued = buildAccountInviteTokenRecord(input);
  await upsertAccountUserActionTokenPg(issued.record);
  return { token: issued.token, record: issued.record, path: controlPlaneStoreSource() };
}

export async function issuePasswordResetTokenState(
  input: IssuePasswordResetTokenInput,
): Promise<{ token: string; record: AccountUserActionTokenRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return issuePasswordResetTokenFile(input);
  const existing = await listAccountUserActionTokensPg({ accountUserId: input.accountUserId, purpose: 'password_reset' });
  for (const record of existing) {
    if (!record.revokedAt && !record.consumedAt && Date.parse(record.expiresAt) > Date.now()) {
      record.revokedAt = new Date().toISOString();
      record.updatedAt = record.revokedAt;
      await upsertAccountUserActionTokenPg(record);
    }
  }
  const issued = buildPasswordResetTokenRecord(input);
  await upsertAccountUserActionTokenPg(issued.record);
  return { token: issued.token, record: issued.record, path: controlPlaneStoreSource() };
}

export async function issueAccountMfaLoginTokenState(
  input: IssueAccountMfaLoginTokenInput,
): Promise<{ token: string; record: AccountUserActionTokenRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return issueAccountMfaLoginTokenFile(input);
  const existing = await listAccountUserActionTokensPg({ accountUserId: input.accountUserId, purpose: 'mfa_login' });
  for (const record of existing) {
    if (!record.revokedAt && !record.consumedAt && Date.parse(record.expiresAt) > Date.now()) {
      record.revokedAt = new Date().toISOString();
      record.updatedAt = record.revokedAt;
      await upsertAccountUserActionTokenPg(record);
    }
  }
  const issued = buildAccountMfaLoginTokenRecord(input);
  await upsertAccountUserActionTokenPg(issued.record);
  return { token: issued.token, record: issued.record, path: controlPlaneStoreSource() };
}

export async function issueAccountPasskeyChallengeTokenState(
  input: IssueAccountPasskeyChallengeTokenInput,
): Promise<{ token: string; record: AccountUserActionTokenRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return issueAccountPasskeyChallengeTokenFile(input);
  const existing = await listAccountUserActionTokensPg({ accountUserId: input.accountUserId, purpose: input.purpose });
  for (const record of existing) {
    if (!record.revokedAt && !record.consumedAt && Date.parse(record.expiresAt) > Date.now()) {
      record.revokedAt = new Date().toISOString();
      record.updatedAt = record.revokedAt;
      await upsertAccountUserActionTokenPg(record);
    }
  }
  const issued = buildAccountPasskeyChallengeTokenRecord(input);
  await upsertAccountUserActionTokenPg(issued.record);
  return { token: issued.token, record: issued.record, path: controlPlaneStoreSource() };
}

export async function consumeAccountUserActionTokenState(
  id: string,
): Promise<{ record: AccountUserActionTokenRecord | null; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return consumeAccountUserActionTokenFile(id);
  const records = await listAccountUserActionTokensPg();
  const record = records.find((entry) => entry.id === id) ?? null;
  if (!record || record.consumedAt || record.revokedAt || Date.parse(record.expiresAt) <= Date.now()) {
    return { record: null, path: controlPlaneStoreSource() };
  }
  record.consumedAt = new Date().toISOString();
  record.updatedAt = record.consumedAt;
  await upsertAccountUserActionTokenPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function revokeAccountUserActionTokenState(
  id: string,
): Promise<{ record: AccountUserActionTokenRecord | null; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountUserActionTokenFile(id);
  const records = await listAccountUserActionTokensPg();
  const record = records.find((entry) => entry.id === id) ?? null;
  if (!record) return { record: null, path: controlPlaneStoreSource() };
  if (!record.revokedAt && !record.consumedAt) {
    record.revokedAt = new Date().toISOString();
    record.updatedAt = record.revokedAt;
    await upsertAccountUserActionTokenPg(record);
  }
  return { record, path: controlPlaneStoreSource() };
}

export async function saveAccountUserActionTokenRecordState(
  record: AccountUserActionTokenRecord,
): Promise<{ record: AccountUserActionTokenRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return saveAccountUserActionTokenRecordFile(record);
  const normalized = coerceAccountUserActionTokenRecord(record);
  await upsertAccountUserActionTokenPg(normalized);
  return { record: normalized, path: controlPlaneStoreSource() };
}

export async function revokeAccountUserActionTokensForUserState(
  accountUserId: string,
  purpose?: AccountUserActionTokenPurpose,
): Promise<{ revokedCount: number; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountUserActionTokensForUserFile(accountUserId, purpose);
  const records = await listAccountUserActionTokensPg({ accountUserId, purpose: purpose ?? null });
  let revokedCount = 0;
  for (const record of records) {
    if (!record.revokedAt && !record.consumedAt && Date.parse(record.expiresAt) > Date.now()) {
      record.revokedAt = new Date().toISOString();
      record.updatedAt = record.revokedAt;
      await upsertAccountUserActionTokenPg(record);
      revokedCount += 1;
    }
  }
  return { revokedCount, path: controlPlaneStoreSource() };
}

export async function appendAdminAuditRecordState(
  input: Omit<AdminAuditRecord, 'id' | 'occurredAt' | 'previousHash' | 'eventHash'>,
): Promise<{
  record: AdminAuditRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return appendAdminAuditRecordFile(input);
  const record = await withPgTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [advisoryLockKey('attestor_control_plane:admin_audit')]);
    const latestResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.admin_audit_log
        ORDER BY occurred_at DESC, audit_id DESC
        LIMIT 1`,
    );
    const previous = latestResult.rows[0] ? rowToAdminAuditRecord(latestResult.rows[0]) : null;
    const baseRecord = {
      id: `audit_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      occurredAt: new Date().toISOString(),
      previousHash: previous?.eventHash ?? null,
      ...input,
    };
    const recordToInsert: AdminAuditRecord = {
      ...baseRecord,
      eventHash: hashJsonValue(baseRecord),
    };
    await client.query(
      `INSERT INTO attestor_control_plane.admin_audit_log (
        audit_id, occurred_at, actor_type, action, account_id, tenant_id, previous_hash, event_hash, record_json
      ) VALUES (
        $1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9::jsonb
      )`,
      [
        recordToInsert.id,
        recordToInsert.occurredAt,
        recordToInsert.actorType,
        recordToInsert.action,
        recordToInsert.accountId,
        recordToInsert.tenantId,
        recordToInsert.previousHash,
        recordToInsert.eventHash,
        JSON.stringify(recordToInsert),
      ],
    );
    return recordToInsert;
  });
  return { record, path: controlPlaneStoreSource() };
}

export async function listAdminAuditRecordsState(filters?: {
  action?: AdminAuditAction | null;
  tenantId?: string | null;
  accountId?: string | null;
  limit?: number | null;
}): Promise<{
  records: AdminAuditRecord[];
  chainIntact: boolean;
  latestHash: string | null;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return listAdminAuditRecordsFile(filters);
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.admin_audit_log
      ORDER BY occurred_at ASC, audit_id ASC
  `);
  const allRecords = result.rows.map(rowToAdminAuditRecord);
  const chainIntact = verifyAdminAuditChain(allRecords);
  let records = allRecords
    .filter((record) => !filters?.action || record.action === filters.action)
    .filter((record) => !filters?.tenantId || record.tenantId === filters.tenantId)
    .filter((record) => !filters?.accountId || record.accountId === filters.accountId)
    .sort((left, right) => left.occurredAt < right.occurredAt ? 1 : -1);
  if (filters?.limit && filters.limit > 0) {
    records = records.slice(0, filters.limit);
  }
  return {
    records,
    chainIntact,
    latestHash: allRecords.length > 0 ? allRecords[allRecords.length - 1]?.eventHash ?? null : null,
    path: controlPlaneStoreSource(),
  };
}

export async function lookupAdminIdempotencyState(options: {
  idempotencyKey: string;
  routeId: string;
  requestPayload: unknown;
}): Promise<AdminIdempotencyLookup> {
  if (!isSharedControlPlaneConfigured()) return lookupAdminIdempotencyFile(options);
  const requestHash = buildAdminIdempotencyRequestHash(options.routeId, options.requestPayload);
  return withPgTransaction(async (client) => {
    await client.query(
      `DELETE FROM attestor_control_plane.admin_idempotency
        WHERE created_at < $1::timestamptz`,
      [adminIdempotencyCutoffIso()],
    );
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      advisoryLockKey(`attestor_control_plane:admin_idempotency:${options.idempotencyKey}`),
    ]);
    const result = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.admin_idempotency
        WHERE idempotency_key = $1
        LIMIT 1`,
      [options.idempotencyKey],
    );
    const existing = result.rows[0] ? rowToAdminIdempotencyRecord(result.rows[0]) : null;
    if (!existing) return { kind: 'miss', requestHash };
    if (existing.routeId !== options.routeId || existing.requestHash !== requestHash) {
      return { kind: 'conflict', requestHash, record: existing };
    }
    const replayedRecord: AdminIdempotencyRecord = {
      ...existing,
      lastReplayedAt: new Date().toISOString(),
      replayCount: existing.replayCount + 1,
    };
    await client.query(
      `UPDATE attestor_control_plane.admin_idempotency
          SET last_replayed_at = $2::timestamptz,
              replay_count = $3,
              record_json = $4::jsonb
        WHERE idempotency_key = $1`,
      [
        options.idempotencyKey,
        replayedRecord.lastReplayedAt,
        replayedRecord.replayCount,
        JSON.stringify(replayedRecord),
      ],
    );
    return {
      kind: 'replay',
      requestHash,
      record: replayedRecord,
      response: decryptAdminIdempotencyResponse(replayedRecord),
    };
  });
}

export async function recordAdminIdempotencyState(options: {
  idempotencyKey: string;
  routeId: string;
  requestPayload: unknown;
  statusCode: number;
  response: unknown;
}): Promise<{ record: AdminIdempotencyRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return recordAdminIdempotencyFile(options);
  const requestHash = buildAdminIdempotencyRequestHash(options.routeId, options.requestPayload);
  const record = await withPgTransaction(async (client) => {
    await client.query(
      `DELETE FROM attestor_control_plane.admin_idempotency
        WHERE created_at < $1::timestamptz`,
      [adminIdempotencyCutoffIso()],
    );
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      advisoryLockKey(`attestor_control_plane:admin_idempotency:${options.idempotencyKey}`),
    ]);
    const existingResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.admin_idempotency
        WHERE idempotency_key = $1
        LIMIT 1`,
      [options.idempotencyKey],
    );
    const existing = existingResult.rows[0] ? rowToAdminIdempotencyRecord(existingResult.rows[0]) : null;
    if (existing) {
      if (existing.routeId !== options.routeId || existing.requestHash !== requestHash) {
        throw new Error(`Idempotency-Key '${options.idempotencyKey}' already exists for a different request`);
      }
      return existing;
    }
    const encrypted = encryptAdminIdempotencyResponse(options.response);
    const recordToInsert: AdminIdempotencyRecord = {
      id: `idem_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      idempotencyKey: options.idempotencyKey,
      routeId: options.routeId,
      requestHash,
      statusCode: options.statusCode,
      responseCiphertext: encrypted.ciphertext,
      responseIv: encrypted.iv,
      responseAuthTag: encrypted.authTag,
      createdAt: new Date().toISOString(),
      lastReplayedAt: null,
      replayCount: 0,
    };
    await client.query(
      `INSERT INTO attestor_control_plane.admin_idempotency (
        idempotency_id, idempotency_key, route_id, request_hash, status_code,
        response_ciphertext, response_iv, response_auth_tag,
        created_at, last_replayed_at, replay_count, record_json
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9::timestamptz, $10::timestamptz, $11, $12::jsonb
      )`,
      [
        recordToInsert.id,
        recordToInsert.idempotencyKey,
        recordToInsert.routeId,
        recordToInsert.requestHash,
        recordToInsert.statusCode,
        recordToInsert.responseCiphertext,
        recordToInsert.responseIv,
        recordToInsert.responseAuthTag,
        recordToInsert.createdAt,
        recordToInsert.lastReplayedAt,
        recordToInsert.replayCount,
        JSON.stringify(recordToInsert),
      ],
    );
    return recordToInsert;
  });
  return { record, path: controlPlaneStoreSource() };
}

export function ensurePipelineIdempotencyStateReady(): void {
  ensurePipelineIdempotencyStorageReady();
}

export async function lookupPipelineIdempotencyState(options: {
  idempotencyKey: string;
  tenantId: string;
  routeId: string;
  requestPayload: unknown;
}): Promise<PipelineIdempotencyLookup> {
  if (!isSharedControlPlaneConfigured()) return lookupPipelineIdempotencyFile(options);
  const idempotencyKeyDigest = buildPipelineIdempotencyKeyDigest(options);
  const requestHash = buildPipelineIdempotencyRequestHash({
    tenantId: options.tenantId,
    routeId: options.routeId,
    payload: options.requestPayload,
  });
  return withPgTransaction(async (client) => {
    await client.query(
      `DELETE FROM attestor_control_plane.pipeline_idempotency
        WHERE created_at < $1::timestamptz`,
      [pipelineIdempotencyCutoffIso()],
    );
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      advisoryLockKey(`attestor_control_plane:pipeline_idempotency:${options.tenantId}:${idempotencyKeyDigest}`),
    ]);
    const result = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.pipeline_idempotency
        WHERE idempotency_key_digest = $1
        LIMIT 1`,
      [idempotencyKeyDigest],
    );
    const existing = result.rows[0] ? rowToPipelineIdempotencyRecord(result.rows[0]) : null;
    if (!existing) return { kind: 'miss', requestHash };
    if (existing.tenantId !== options.tenantId || existing.routeId !== options.routeId || existing.requestHash !== requestHash) {
      return { kind: 'conflict', requestHash, record: existing };
    }
    const replayedRecord: PipelineIdempotencyRecord = {
      ...existing,
      lastReplayedAt: new Date().toISOString(),
      replayCount: existing.replayCount + 1,
    };
    await client.query(
      `UPDATE attestor_control_plane.pipeline_idempotency
          SET last_replayed_at = $2::timestamptz,
              replay_count = $3,
              record_json = $4::jsonb
        WHERE idempotency_key_digest = $1`,
      [
        idempotencyKeyDigest,
        replayedRecord.lastReplayedAt,
        replayedRecord.replayCount,
        JSON.stringify(replayedRecord),
      ],
    );
    return {
      kind: 'replay',
      requestHash,
      record: replayedRecord,
      response: decryptPipelineIdempotencyResponse(replayedRecord),
    };
  });
}

export async function recordPipelineIdempotencyState(options: {
  idempotencyKey: string;
  tenantId: string;
  routeId: string;
  requestPayload: unknown;
  statusCode: number;
  response: unknown;
}): Promise<{ record: PipelineIdempotencyRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return recordPipelineIdempotencyFile(options);
  const idempotencyKeyDigest = buildPipelineIdempotencyKeyDigest(options);
  const requestHash = buildPipelineIdempotencyRequestHash({
    tenantId: options.tenantId,
    routeId: options.routeId,
    payload: options.requestPayload,
  });
  const record = await withPgTransaction(async (client) => {
    await client.query(
      `DELETE FROM attestor_control_plane.pipeline_idempotency
        WHERE created_at < $1::timestamptz`,
      [pipelineIdempotencyCutoffIso()],
    );
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      advisoryLockKey(`attestor_control_plane:pipeline_idempotency:${options.tenantId}:${idempotencyKeyDigest}`),
    ]);
    const existingResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.pipeline_idempotency
        WHERE idempotency_key_digest = $1
        LIMIT 1`,
      [idempotencyKeyDigest],
    );
    const existing = existingResult.rows[0] ? rowToPipelineIdempotencyRecord(existingResult.rows[0]) : null;
    if (existing) {
      if (existing.tenantId !== options.tenantId || existing.routeId !== options.routeId || existing.requestHash !== requestHash) {
        throw new Error('Idempotency-Key already exists for a different pipeline request');
      }
      return existing;
    }
    const encrypted = encryptPipelineIdempotencyResponse(options.response);
    const recordToInsert: PipelineIdempotencyRecord = {
      id: `pipe_idem_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      idempotencyKeyDigest,
      tenantId: options.tenantId,
      routeId: options.routeId,
      requestHash,
      statusCode: options.statusCode,
      responseCiphertext: encrypted.ciphertext,
      responseIv: encrypted.iv,
      responseAuthTag: encrypted.authTag,
      createdAt: new Date().toISOString(),
      lastReplayedAt: null,
      replayCount: 0,
    };
    await client.query(
      `INSERT INTO attestor_control_plane.pipeline_idempotency (
        idempotency_id, idempotency_key_digest, tenant_id, route_id, request_hash, status_code,
        response_ciphertext, response_iv, response_auth_tag,
        created_at, last_replayed_at, replay_count, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10::timestamptz, $11::timestamptz, $12, $13::jsonb
      )`,
      [
        recordToInsert.id,
        recordToInsert.idempotencyKeyDigest,
        recordToInsert.tenantId,
        recordToInsert.routeId,
        recordToInsert.requestHash,
        recordToInsert.statusCode,
        recordToInsert.responseCiphertext,
        recordToInsert.responseIv,
        recordToInsert.responseAuthTag,
        recordToInsert.createdAt,
        recordToInsert.lastReplayedAt,
        recordToInsert.replayCount,
        JSON.stringify(recordToInsert),
      ],
    );
    return recordToInsert;
  });
  return { record, path: controlPlaneStoreSource() };
}

export async function lookupProcessedStripeWebhookState(
  eventId: string,
  rawPayload: string,
): Promise<StripeWebhookLookup> {
  if (!isSharedControlPlaneConfigured()) return lookupProcessedStripeWebhookFile(eventId, rawPayload);
  await ensureSchema();
  const pool = await getPool();
  const requestHash = hashJsonValue({ payload: rawPayload });
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.stripe_webhook_dedupe
      WHERE event_id = $1
      LIMIT 1`,
    [eventId],
  );
  const existing = result.rows[0] ? rowToStripeWebhookRecord(result.rows[0]) : null;
  if (!existing) return { kind: 'miss', payloadHash: requestHash };
  if (existing.payloadHash !== requestHash) {
    return { kind: 'conflict', payloadHash: requestHash, record: existing };
  }
  return { kind: 'duplicate', payloadHash: requestHash, record: existing };
}

export async function claimProcessedStripeWebhookState(input: {
  eventId: string;
  eventType: string;
  rawPayload: string;
}): Promise<StripeWebhookClaimState> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for Stripe webhook claims.');
  }
  await ensureSchema();
  const pool = await getPool();
  const client = await pool.connect();
  const requestHash = hashJsonValue({ payload: input.rawPayload });
  const lockKey = advisoryLockKey(`attestor_control_plane:stripe_webhook:${input.eventId}`);
  let keepLease = false;
  try {
    await client.query('SELECT pg_advisory_lock($1::bigint)', [lockKey]);
    const existingResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.stripe_webhook_dedupe
        WHERE event_id = $1
        LIMIT 1`,
      [input.eventId],
    );
    const existing = existingResult.rows[0] ? rowToStripeWebhookRecord(existingResult.rows[0]) : null;
    if (existing) {
      if (existing.payloadHash !== requestHash) {
        return { kind: 'conflict', payloadHash: requestHash, record: existing };
      }
      if (existing.outcome !== 'pending') {
        return { kind: 'duplicate', payloadHash: requestHash, record: existing };
      }
      await client.query(
        `DELETE FROM attestor_control_plane.stripe_webhook_dedupe
          WHERE event_id = $1 AND outcome = 'pending'`,
        [input.eventId],
      );
    }

    const record: StripeWebhookRecord = {
      id: `stripe_evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      eventId: input.eventId,
      eventType: input.eventType,
      payloadHash: requestHash,
      accountId: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      outcome: 'pending',
      reason: null,
      receivedAt: new Date().toISOString(),
    };
    await client.query(
      `INSERT INTO attestor_control_plane.stripe_webhook_dedupe (
        webhook_record_id, event_id, event_type, payload_hash, account_id, stripe_customer_id,
        stripe_subscription_id, outcome, reason, received_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10::timestamptz, $11::jsonb
      )`,
      [
        record.id,
        record.eventId,
        record.eventType,
        record.payloadHash,
        record.accountId,
        record.stripeCustomerId,
        record.stripeSubscriptionId,
        record.outcome,
        record.reason,
        record.receivedAt,
        JSON.stringify(record),
      ],
    );

    const claimId = `stripe_claim_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    stripeWebhookClaimLeases.set(claimId, {
      client,
      advisoryLockKey: lockKey,
      eventId: input.eventId,
    });
    keepLease = true;
    return { kind: 'claimed', payloadHash: requestHash, record, claimId };
  } finally {
    if (!keepLease) {
      try {
        await client.query('SELECT pg_advisory_unlock($1::bigint)', [lockKey]);
      } catch {
        // best-effort unlock before connection release
      }
      client.release();
    }
  }
}

export async function finalizeProcessedStripeWebhookState(input: {
  claimId: string;
  eventId: string;
  eventType: string;
  accountId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  outcome: Exclude<StripeWebhookRecord['outcome'], 'pending'>;
  reason: string | null;
  rawPayload: string;
}): Promise<{ record: StripeWebhookRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for Stripe webhook finalize.');
  }
  const lease = stripeWebhookClaimLeases.get(input.claimId);
  if (!lease || lease.eventId !== input.eventId) {
    throw new Error(`Stripe webhook claim '${input.claimId}' is missing or does not match event '${input.eventId}'.`);
  }

  const requestHash = hashJsonValue({ payload: input.rawPayload });
  let finalized = false;
  try {
    const existingResult = await lease.client.query(
      `SELECT record_json
         FROM attestor_control_plane.stripe_webhook_dedupe
        WHERE event_id = $1
        LIMIT 1`,
      [input.eventId],
    );
    const existing = existingResult.rows[0] ? rowToStripeWebhookRecord(existingResult.rows[0]) : null;
    if (!existing) {
      throw new Error(`Stripe webhook event '${input.eventId}' was not claimed before finalize.`);
    }
    if (existing.payloadHash !== requestHash) {
      throw new Error(`Stripe event '${input.eventId}' was claimed with a different payload hash.`);
    }

    const record: StripeWebhookRecord = {
      ...existing,
      eventType: input.eventType,
      accountId: input.accountId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      outcome: input.outcome,
      reason: input.reason,
    };
    await lease.client.query(
      `UPDATE attestor_control_plane.stripe_webhook_dedupe
          SET event_type = $2,
              payload_hash = $3,
              account_id = $4,
              stripe_customer_id = $5,
              stripe_subscription_id = $6,
              outcome = $7,
              reason = $8,
              record_json = $9::jsonb
        WHERE event_id = $1`,
      [
        input.eventId,
        record.eventType,
        record.payloadHash,
        record.accountId,
        record.stripeCustomerId,
        record.stripeSubscriptionId,
        record.outcome,
        record.reason,
        JSON.stringify(record),
      ],
    );
    finalized = true;
    return { record, path: controlPlaneStoreSource() };
  } finally {
    if (!finalized) {
      try {
        await lease.client.query(
          `DELETE FROM attestor_control_plane.stripe_webhook_dedupe
            WHERE event_id = $1 AND outcome = 'pending'`,
          [input.eventId],
        );
      } catch {
        // best-effort cleanup before releasing the advisory lock
      }
    }
    await releaseStripeWebhookPgClaimLease(input.claimId);
  }
}

export async function releaseProcessedStripeWebhookClaimState(
  eventId: string,
  claimId: string,
): Promise<void> {
  if (!isSharedControlPlaneConfigured()) return;
  const lease = stripeWebhookClaimLeases.get(claimId);
  if (!lease) return;
  try {
    await lease.client.query(
      `DELETE FROM attestor_control_plane.stripe_webhook_dedupe
        WHERE event_id = $1 AND outcome = 'pending'`,
      [eventId],
    );
  } finally {
    await releaseStripeWebhookPgClaimLease(claimId);
  }
}

export async function recordProcessedStripeWebhookState(
  input: Omit<StripeWebhookRecord, 'id' | 'receivedAt' | 'payloadHash'> & { rawPayload: string },
): Promise<{ record: StripeWebhookRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return recordProcessedStripeWebhookFile(input);
  const requestHash = hashJsonValue({ payload: input.rawPayload });
  const record = await withPgTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      advisoryLockKey(`attestor_control_plane:stripe_webhook:${input.eventId}`),
    ]);
    const existingResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.stripe_webhook_dedupe
        WHERE event_id = $1
        LIMIT 1`,
      [input.eventId],
    );
    const existing = existingResult.rows[0] ? rowToStripeWebhookRecord(existingResult.rows[0]) : null;
    if (existing) {
      if (existing.payloadHash !== requestHash) {
        throw new Error(`Stripe event '${input.eventId}' was already recorded with a different payload hash.`);
      }
      return existing;
    }
    const recordToInsert: StripeWebhookRecord = {
      id: `stripe_evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      eventId: input.eventId,
      eventType: input.eventType,
      payloadHash: requestHash,
      accountId: input.accountId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      outcome: input.outcome,
      reason: input.reason,
      receivedAt: new Date().toISOString(),
    };
    await client.query(
      `INSERT INTO attestor_control_plane.stripe_webhook_dedupe (
        webhook_record_id, event_id, event_type, payload_hash, account_id, stripe_customer_id,
        stripe_subscription_id, outcome, reason, received_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10::timestamptz, $11::jsonb
      )`,
      [
        recordToInsert.id,
        recordToInsert.eventId,
        recordToInsert.eventType,
        recordToInsert.payloadHash,
        recordToInsert.accountId,
        recordToInsert.stripeCustomerId,
        recordToInsert.stripeSubscriptionId,
        recordToInsert.outcome,
        recordToInsert.reason,
        recordToInsert.receivedAt,
        JSON.stringify(recordToInsert),
      ],
    );
    return recordToInsert;
  });
  return { record, path: controlPlaneStoreSource() };
}

async function listAsyncDeadLetterRecordsPg(filters?: {
  tenantId?: string | null;
  backendMode?: AsyncDeadLetterBackendMode | null;
  limit?: number | null;
}): Promise<AsyncDeadLetterRecord[]> {
  await ensureSchema();
  const pool = await getPool();
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
  await ensureSchema();
  const target = executor ?? await getPool();
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
  await ensureSchema();
  const target = executor ?? await getPool();
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

async function listHostedEmailDeliveryEventRecordsPg(filters?: {
  deliveryId?: string | null;
  accountId?: string | null;
  accountUserId?: string | null;
  provider?: HostedEmailDeliveryProvider | null;
  rawLimit?: number | null;
}): Promise<HostedEmailDeliveryEventRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters?.deliveryId) {
    params.push(filters.deliveryId);
    clauses.push(`delivery_id = $${params.length}`);
  }
  if (filters?.accountId) {
    params.push(filters.accountId);
    clauses.push(`account_id = $${params.length}`);
  }
  if (filters?.accountUserId) {
    params.push(filters.accountUserId);
    clauses.push(`account_user_id = $${params.length}`);
  }
  if (filters?.provider) {
    params.push(filters.provider);
    clauses.push(`provider = $${params.length}`);
  }
  const rawLimit = Math.max(100, Math.min(5000, filters?.rawLimit ?? 2000));
  params.push(rawLimit);
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.email_delivery_events
      ${clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY occurred_at DESC, email_event_id DESC
      LIMIT $${params.length}`,
    params,
  );
  return result.rows.map(rowToHostedEmailDeliveryEventRecord);
}

async function insertHostedEmailDeliveryEventPg(
  record: HostedEmailDeliveryEventRecord,
  executor?: PgPool | PgClient,
): Promise<void> {
  await ensureSchema();
  const target = executor ?? await getPool();
  await target.query(
    `INSERT INTO attestor_control_plane.email_delivery_events (
      email_event_id, delivery_id, account_id, account_user_id, purpose, provider, channel,
      recipient, message_id, provider_message_id, provider_event_id, event_type, status_hint,
      occurred_at, recorded_at, payload_hash, record_json
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      $14::timestamptz, $15::timestamptz, $16, $17::jsonb
    )`,
    [
      record.id,
      record.deliveryId,
      record.accountId,
      record.accountUserId,
      record.purpose,
      record.provider,
      record.channel,
      record.recipient,
      record.messageId,
      record.providerMessageId,
      record.providerEventId,
      record.eventType,
      normalizeHostedEmailDeliveryStatus(record.statusHint),
      record.occurredAt,
      record.recordedAt,
      record.payloadHash,
      JSON.stringify(record),
    ],
  );
}

export async function recordHostedEmailDispatchEventState(
  input: RecordHostedEmailDispatchEventInput,
): Promise<{ record: HostedEmailDeliveryEventRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return recordHostedEmailDispatchEventFile(input);
  const fileRecord = buildHostedEmailDispatchEventRecord(input);
  const record = {
    ...fileRecord,
    id: `email_evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
  };
  await insertHostedEmailDeliveryEventPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function recordHostedEmailProviderEventState(
  input: RecordHostedEmailProviderEventInput,
): Promise<{
  kind: 'recorded' | 'duplicate' | 'conflict';
  record: HostedEmailDeliveryEventRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) {
    const result = recordHostedEmailProviderEventFile(input);
    return { ...result, path: result.path };
  }
  const builtRecord = buildHostedEmailProviderEventRecord(input);
  if (!builtRecord.providerEventId) {
    throw new Error('Hosted email provider events require a providerEventId for replay-safe idempotency.');
  }
  const replayDigest = hostedEmailProviderReplayDigest(builtRecord);

  return withPgTransaction(async (client) => {
    const lockKeys = [
      `attestor_control_plane:email_delivery:${builtRecord.provider}:${builtRecord.providerEventId}`,
      replayDigest
        ? `attestor_control_plane:email_delivery_replay:${builtRecord.provider}:${replayDigest}`
        : null,
    ].filter((value): value is string => value !== null).sort();
    for (const lockKey of lockKeys) {
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [advisoryLockKey(lockKey)]);
    }
    const existingResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.email_delivery_events
        WHERE provider = $1
          AND (
            provider_event_id = $2
            OR ($3::text IS NOT NULL AND record_json->'metadata'->>'mailgunSignatureTokenDigest' = $3)
          )
        LIMIT 1`,
      [builtRecord.provider, builtRecord.providerEventId, replayDigest],
    );
    const existing = existingResult.rows[0] ? rowToHostedEmailDeliveryEventRecord(existingResult.rows[0]) : null;
    if (existing) {
      if (existing.payloadHash !== builtRecord.payloadHash) {
        return { kind: 'conflict', record: existing, path: controlPlaneStoreSource() } as const;
      }
      return { kind: 'duplicate', record: existing, path: controlPlaneStoreSource() } as const;
    }
    const record = {
      ...builtRecord,
      id: `email_evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    };
    await insertHostedEmailDeliveryEventPg(record, client);
    return { kind: 'recorded', record, path: controlPlaneStoreSource() } as const;
  });
}

export async function listHostedEmailDeliveriesState(
  filters?: ListHostedEmailDeliveryFilters,
): Promise<{ records: HostedEmailDeliverySummaryRecord[]; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) {
    const result = listHostedEmailDeliveriesFile(filters);
    return { records: result.records, path: result.path };
  }
  const raw = await listHostedEmailDeliveryEventRecordsPg({
    deliveryId: filters?.deliveryId ?? null,
    accountId: filters?.accountId ?? null,
    accountUserId: filters?.accountUserId ?? null,
    provider: filters?.provider ?? null,
    rawLimit: Math.max(500, Math.min(5000, (filters?.limit ?? 100) * 20)),
  });
  return {
    records: filterHostedEmailDeliverySummaries(summarizeHostedEmailDeliveryEvents(raw), filters),
    path: controlPlaneStoreSource(),
  };
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
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.async_dead_letter_jobs');
  }
  for (const record of snapshot.records) {
    await upsertAsyncDeadLetterRecordPg(record);
  }
  return { recordCount: snapshot.records.length };
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

export async function exportStripeWebhookStoreSnapshot(): Promise<StripeWebhookStoreSnapshot> {
  if (!isSharedControlPlaneConfigured()) {
    const { records } = readStripeWebhookStoreSnapshot();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      records,
    };
  }
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.stripe_webhook_dedupe
      ORDER BY received_at ASC, webhook_record_id ASC
  `);
  const records = result.rows.map(rowToStripeWebhookRecord);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreStripeWebhookStoreSnapshot(
  snapshot: StripeWebhookStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for Stripe webhook dedupe restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.stripe_webhook_dedupe');
  }
  for (const record of snapshot.records) {
    await pool.query(
      `INSERT INTO attestor_control_plane.stripe_webhook_dedupe (
        webhook_record_id, event_id, event_type, payload_hash, account_id, stripe_customer_id,
        stripe_subscription_id, outcome, reason, received_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10::timestamptz, $11::jsonb
      )
      ON CONFLICT (webhook_record_id) DO UPDATE SET
        event_id = EXCLUDED.event_id,
        event_type = EXCLUDED.event_type,
        payload_hash = EXCLUDED.payload_hash,
        account_id = EXCLUDED.account_id,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        outcome = EXCLUDED.outcome,
        reason = EXCLUDED.reason,
        received_at = EXCLUDED.received_at,
        record_json = EXCLUDED.record_json`,
      [
        record.id,
        record.eventId,
        record.eventType,
        record.payloadHash,
        record.accountId,
        record.stripeCustomerId,
        record.stripeSubscriptionId,
        record.outcome,
        record.reason,
        record.receivedAt,
        JSON.stringify(record),
      ],
    );
  }
  return { recordCount: snapshot.records.length };
}

export async function exportAccountUserStoreSnapshot(): Promise<AccountUserStoreSnapshot> {
  const records = isSharedControlPlaneConfigured()
    ? await listAllAccountUsersPg()
    : listAllAccountUsersFile().records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreAccountUserStoreSnapshot(
  snapshot: AccountUserStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for account user restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.account_users CASCADE');
  }
  for (const record of snapshot.records) {
    await upsertAccountUserPg(record);
  }
  return { recordCount: snapshot.records.length };
}

export async function exportAccountSessionStoreSnapshot(): Promise<AccountSessionStoreSnapshot> {
  const records = isSharedControlPlaneConfigured()
    ? await listAccountSessionsPg()
    : listAccountSessionsFile().records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreAccountSessionStoreSnapshot(
  snapshot: AccountSessionStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for account session restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.account_sessions');
  }
  for (const record of snapshot.records) {
    await upsertAccountSessionPg(record);
  }
  return { recordCount: snapshot.records.length };
}

export async function exportAccountUserActionTokenStoreSnapshot(): Promise<AccountUserActionTokenStoreSnapshot> {
  const records = isSharedControlPlaneConfigured()
    ? await listAccountUserActionTokensPg()
    : listAllAccountUserActionTokensFile().records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreAccountUserActionTokenStoreSnapshot(
  snapshot: AccountUserActionTokenStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for account user action token restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.account_user_action_tokens');
  }
  for (const record of snapshot.records) {
    await upsertAccountUserActionTokenPg(record);
  }
  return { recordCount: snapshot.records.length };
}

export async function exportHostedEmailDeliveryEventStoreSnapshot(): Promise<EmailDeliveryEventStoreSnapshot> {
  if (!isSharedControlPlaneConfigured()) {
    return exportHostedEmailDeliveryEventStoreSnapshotFile();
  }
  const records = await listHostedEmailDeliveryEventRecordsPg({ rawLimit: 5000 });
  const chronological = [...records].sort((left, right) => {
    const byOccurred = compareIso(left.occurredAt, right.occurredAt);
    if (byOccurred !== 0) return byOccurred;
    return left.id > right.id ? 1 : -1;
  });
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: chronological.length,
    records: chronological,
  };
}

export async function restoreHostedEmailDeliveryEventStoreSnapshot(
  snapshot: EmailDeliveryEventStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    const restored = restoreHostedEmailDeliveryEventStoreSnapshotFile(snapshot);
    return { recordCount: restored.recordCount };
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.email_delivery_events');
  }
  for (const record of snapshot.records) {
    await insertHostedEmailDeliveryEventPg(coerceHostedEmailDeliveryEventRecord(record));
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

export async function exportTenantKeyStoreSnapshot(): Promise<TenantKeyStoreSnapshot> {
  const records = isSharedControlPlaneConfigured()
    ? await listTenantKeyRecordsPg()
    : listTenantKeyRecordsFile().records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreTenantKeyStoreSnapshot(
  snapshot: TenantKeyStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for tenant key restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.tenant_api_keys');
  }
  for (const record of snapshot.records) {
    await upsertTenantKeyPg(normalizeTenantKeyRecord(record));
  }
  return { recordCount: snapshot.records.length };
}

export async function exportUsageLedgerStoreSnapshot(): Promise<UsageLedgerStoreSnapshot> {
  const records = isSharedControlPlaneConfigured()
    ? await listUsageLedgerPg()
    : readUsageLedgerSnapshot().records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    monthlyPipelineRuns: records,
  };
}

export async function restoreUsageLedgerStoreSnapshot(
  snapshot: UsageLedgerStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for usage ledger restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.usage_ledger');
  }
  for (const record of snapshot.monthlyPipelineRuns) {
    await pool.query(
      `INSERT INTO attestor_control_plane.usage_ledger (
        tenant_id, period, used, updated_at
      ) VALUES (
        $1, $2, $3, $4::timestamptz
      )
      ON CONFLICT (tenant_id, period) DO UPDATE SET
        used = EXCLUDED.used,
        updated_at = EXCLUDED.updated_at`,
      [record.tenantId, record.period, record.used, record.updatedAt],
    );
  }
  return { recordCount: snapshot.monthlyPipelineRuns.length };
}

export async function resetSharedControlPlaneStoreForTests(): Promise<void> {
  if (stripeWebhookClaimLeases.size > 0) {
    await Promise.all([...stripeWebhookClaimLeases.keys()].map((claimId) => releaseStripeWebhookPgClaimLease(claimId)));
  }
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
