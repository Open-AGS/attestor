/**
 * Shared Control Plane Store — optional PostgreSQL-backed hosted state.
 *
 * BOUNDARY:
 * - Optional shared PostgreSQL first slice for hosted accounts, tenant keys, and usage
 * - File-backed stores remain the fallback for self-host/dev and existing operator flows
 * - Record JSON is preserved so hosted runtime behavior stays aligned with the local stores
 * - This is a control-plane state slice, not full multi-region HA or entitlement service
 */

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
} from './control-plane-store/pg.js';
import { releaseAllStripeWebhookClaimLeasesForTests } from './control-plane-store/stripe-webhook-state.js';
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
export {
  applyStripeCheckoutCompletionState,
  applyStripeInvoiceStateState,
  applyStripeSubscriptionStateState,
  attachStripeBillingToAccountState,
  createHostedAccountState,
  exportHostedAccountStoreSnapshot,
  exportHostedBillingEntitlementStoreSnapshot,
  findHostedAccountByIdState,
  findHostedAccountByTenantIdState,
  findHostedBillingEntitlementByAccountIdState,
  listHostedAccountsState,
  listHostedBillingEntitlementsState,
  provisionHostedAccountState,
  restoreHostedAccountStoreSnapshot,
  restoreHostedBillingEntitlementStoreSnapshot,
  setHostedAccountStatusState,
  upsertHostedBillingEntitlementState,
  type BillingEntitlementStoreSnapshot,
  type HostedAccountStoreSnapshot,
} from './control-plane-store/hosted-billing-state.js';
import {
  adminIdempotencyCutoffIso,
  rowToAdminIdempotencyRecord,
} from './control-plane-store/mappers.js';

export { controlPlaneStoreMode, controlPlaneStoreSource, isSharedControlPlaneConfigured };

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
