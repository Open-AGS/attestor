import { createHash, randomUUID } from 'node:crypto';
import {
  AccountStoreError,
  type HostedAccountBillingState,
  type HostedAccountRecord,
  type StripeInvoiceStatus,
  type StripeSubscriptionStatus,
} from '../account/account-store.js';
import {
  AccountUserStoreError,
  type AccountUserRecord,
} from '../account/account-user-store.js';
import type { AccountSessionRecord } from '../account/account-session-store.js';
import type {
  AccountUserActionTokenRecord,
} from '../account/account-user-token-store.js';
import {
  normalizeHostedBillingEntitlementRecord,
  type HostedBillingEntitlementRecord,
} from '../billing/billing-entitlement-store.js';
import {
  TenantKeyStoreError,
  type TenantKeyRecord,
  type TenantKeyStatus,
} from '../tenant-key-store.js';
import type { UsageContext, UsageLedgerRecord } from '../usage-meter.js';
import type { AdminAuditRecord } from '../admin-audit-log.js';
import type { AdminIdempotencyRecord } from '../admin-idempotency-store.js';
import type { PipelineIdempotencyRecord } from '../pipeline/pipeline-idempotency-store.js';
import type { StripeWebhookRecord } from '../billing/stripe/stripe-webhook-store.js';
import type { HostedEmailDeliveryEventRecord } from '../async/email-delivery-event-store.js';
import {
  normalizeAsyncDeadLetterRecord,
  type AsyncDeadLetterRecord,
} from '../async/async-dead-letter-store.js';
import {
  assertTenantKeyRecoveryEnabled,
  normalizeSecretEnvelopeRecord,
  recoverSecretEnvelope,
  sealSecretEnvelope,
} from '../secret-envelope.js';
import { resolvePlanQuotaPolicy } from '../plan-catalog.js';
import { hashSecretForLookup } from '../secret-derivation.js';
import type { HostedSamlReplayRecord } from '../account/account-saml.js';
import type { PgQueryResultRow } from './pg.js';

export function hashApiKey(apiKey: string): string {
  return hashSecretForLookup(apiKey, 'tenant.api-key');
}

export function previewApiKey(apiKey: string): string {
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

export function compareIso(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function normalizeStripeSubscriptionStatus(raw: string | null | undefined): StripeSubscriptionStatus {
  if (!raw) return null;
  switch (raw) {
    case 'trialing':
    case 'active':
    case 'incomplete':
    case 'incomplete_expired':
    case 'past_due':
    case 'canceled':
    case 'unpaid':
    case 'paused':
      return raw;
    default:
      return null;
  }
}

export function normalizeStripeInvoiceStatus(raw: string | null | undefined): StripeInvoiceStatus {
  if (!raw) return null;
  switch (raw) {
    case 'draft':
    case 'open':
    case 'paid':
    case 'uncollectible':
    case 'void':
      return raw;
    default:
      return null;
  }
}

export function defaultBillingState(): HostedAccountBillingState {
  return {
    provider: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
    stripePriceId: null,
    lastCheckoutSessionId: null,
    lastCheckoutCompletedAt: null,
    lastCheckoutPlanId: null,
    lastSubscriptionEventId: null,
    lastSubscriptionEventType: null,
    lastSubscriptionEventCreatedAt: null,
    lastInvoiceId: null,
    lastInvoiceStatus: null,
    lastInvoiceCurrency: null,
    lastInvoiceAmountPaid: null,
    lastInvoiceAmountDue: null,
    lastInvoiceEventId: null,
    lastInvoiceEventType: null,
    lastInvoiceEventCreatedAt: null,
    lastInvoiceProcessedAt: null,
    lastInvoicePaidAt: null,
    delinquentSince: null,
    lastWebhookEventId: null,
    lastWebhookEventType: null,
    lastWebhookEventCreatedAt: null,
    lastWebhookProcessedAt: null,
  };
}

export function normalizeHostedAccountRecord(record: HostedAccountRecord): HostedAccountRecord {
  return {
    ...record,
    updatedAt: record.updatedAt ?? record.archivedAt ?? record.suspendedAt ?? record.createdAt,
    suspendedAt: record.suspendedAt ?? null,
    archivedAt: record.archivedAt ?? null,
    billing: {
      ...defaultBillingState(),
      ...(record.billing ?? {}),
      provider: record.billing?.provider === 'stripe' ? 'stripe' : null,
      stripeSubscriptionStatus: normalizeStripeSubscriptionStatus(record.billing?.stripeSubscriptionStatus ?? null),
      lastInvoiceStatus: normalizeStripeInvoiceStatus(record.billing?.lastInvoiceStatus ?? null),
    },
  };
}

export function normalizeTenantKeyRecord(record: TenantKeyRecord): TenantKeyRecord {
  return {
    ...record,
    planId: record.planId ?? null,
    monthlyRunQuota: typeof record.monthlyRunQuota === 'number' ? record.monthlyRunQuota : null,
    lastUsedAt: record.lastUsedAt ?? null,
    deactivatedAt: record.deactivatedAt ?? null,
    revokedAt: record.revokedAt ?? null,
    rotatedFromKeyId: record.rotatedFromKeyId ?? null,
    supersededByKeyId: record.supersededByKeyId ?? null,
    supersededAt: record.supersededAt ?? null,
    recoveryEnvelope: record.recoveryEnvelope ? normalizeSecretEnvelopeRecord(record.recoveryEnvelope) : null,
  };
}

export function coerceHostedAccountRecord(value: unknown): HostedAccountRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid hosted account record in shared control-plane store.');
  }
  return normalizeHostedAccountRecord(value as HostedAccountRecord);
}

export function coerceHostedBillingEntitlementRecord(value: unknown): HostedBillingEntitlementRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid hosted billing entitlement record in shared control-plane store.');
  }
  return normalizeHostedBillingEntitlementRecord(value as HostedBillingEntitlementRecord);
}

export function coerceTenantKeyRecord(value: unknown): TenantKeyRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid tenant key record in shared control-plane store.');
  }
  return normalizeTenantKeyRecord(value as TenantKeyRecord);
}

export function coerceAccountUserRecord(value: unknown): AccountUserRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid account user record in shared control-plane store.');
  }
  const record = value as AccountUserRecord;
  return {
    ...record,
    passwordUpdatedAt: record.passwordUpdatedAt ?? record.updatedAt ?? record.createdAt,
  };
}

export function coerceAccountSessionRecord(value: unknown): AccountSessionRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid account session record in shared control-plane store.');
  }
  return value as AccountSessionRecord;
}

export function coerceAccountUserActionTokenRecord(value: unknown): AccountUserActionTokenRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid account user action token record in shared control-plane store.');
  }
  return value as AccountUserActionTokenRecord;
}

export function coerceHostedSamlReplayRecord(value: unknown): HostedSamlReplayRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid hosted SAML replay record in shared control-plane store.');
  }
  const record = value as HostedSamlReplayRecord;
  return {
    requestId: String(record.requestId ?? '').trim(),
    responseId: typeof record.responseId === 'string' && record.responseId.trim() ? record.responseId.trim() : null,
    issuer: String(record.issuer ?? '').trim(),
    subject: String(record.subject ?? '').trim(),
    consumedAt: String(record.consumedAt ?? ''),
    expiresAt: String(record.expiresAt ?? ''),
  };
}

export function coerceAsyncDeadLetterRecord(value: unknown): AsyncDeadLetterRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid async dead-letter record in shared control-plane store.');
  }
  return normalizeAsyncDeadLetterRecord(value as AsyncDeadLetterRecord);
}

export function coerceHostedEmailDeliveryEventRecord(value: unknown): HostedEmailDeliveryEventRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid hosted email delivery event record in shared control-plane store.');
  }
  return value as HostedEmailDeliveryEventRecord;
}

export function rowToHostedAccount(row: PgQueryResultRow): HostedAccountRecord {
  return coerceHostedAccountRecord(row.record_json);
}

export function rowToHostedBillingEntitlement(row: PgQueryResultRow): HostedBillingEntitlementRecord {
  return coerceHostedBillingEntitlementRecord(row.record_json);
}

export function rowToTenantKey(row: PgQueryResultRow): TenantKeyRecord {
  return coerceTenantKeyRecord(row.record_json);
}

export function rowToUsageRecord(row: PgQueryResultRow): UsageLedgerRecord {
  return {
    tenantId: String(row.tenant_id),
    period: String(row.period),
    used: Number(row.used),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export function rowToAccountUser(row: PgQueryResultRow): AccountUserRecord {
  return coerceAccountUserRecord(row.record_json);
}

export function rowToAccountSession(row: PgQueryResultRow): AccountSessionRecord {
  return coerceAccountSessionRecord(row.record_json);
}

export function rowToAccountUserActionToken(row: PgQueryResultRow): AccountUserActionTokenRecord {
  return coerceAccountUserActionTokenRecord(row.record_json);
}

export function rowToHostedSamlReplay(row: PgQueryResultRow): HostedSamlReplayRecord {
  return coerceHostedSamlReplayRecord(row.record_json);
}

export function touchRecord(record: HostedAccountRecord): void {
  record.updatedAt = new Date().toISOString();
}

export function isIncomingProviderEventOlder(
  incomingEventCreatedAt: string | null | undefined,
  latestEventCreatedAt: string | null | undefined,
): boolean {
  if (!incomingEventCreatedAt || !latestEventCreatedAt) return false;
  const incomingTime = Date.parse(incomingEventCreatedAt);
  const latestTime = Date.parse(latestEventCreatedAt);
  if (!Number.isFinite(incomingTime) || !Number.isFinite(latestTime)) return false;
  return incomingTime < latestTime;
}

export function resolveStripeAccountMatch(
  records: HostedAccountRecord[],
  options: {
    accountId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
  },
): {
  record: HostedAccountRecord | null;
  matchReason: 'account_id' | 'subscription_id' | 'customer_id' | 'none';
} {
  if (options.accountId) {
    const record = records.find((entry) => entry.id === options.accountId) ?? null;
    if (record) return { record, matchReason: 'account_id' };
  }
  if (options.stripeSubscriptionId) {
    const record = records.find((entry) => entry.billing.stripeSubscriptionId === options.stripeSubscriptionId) ?? null;
    if (record) return { record, matchReason: 'subscription_id' };
  }
  if (options.stripeCustomerId) {
    const record = records.find((entry) => entry.billing.stripeCustomerId === options.stripeCustomerId) ?? null;
    if (record) return { record, matchReason: 'customer_id' };
  }
  return { record: null, matchReason: 'none' };
}

export function activeReplacementExists(records: TenantKeyRecord[], record: TenantKeyRecord): boolean {
  if (!record.supersededByKeyId) return false;
  const replacement = records.find((entry) => entry.id === record.supersededByKeyId);
  return Boolean(replacement && replacement.status !== 'revoked');
}

export function statusRank(status: TenantKeyStatus): number {
  if (status === 'active') return 0;
  if (status === 'inactive') return 1;
  return 2;
}

export function buildTenantKeyRecord(options: {
  tenantId: string;
  tenantName: string;
  planId: string | null;
  monthlyRunQuota: number | null;
  apiKey: string;
  createdAt: string;
  rotatedFromKeyId?: string | null;
}): TenantKeyRecord {
  return {
    id: `tkey_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    tenantId: options.tenantId,
    tenantName: options.tenantName,
    planId: options.planId,
    monthlyRunQuota: options.monthlyRunQuota,
    apiKeyHash: hashApiKey(options.apiKey),
    apiKeyPreview: previewApiKey(options.apiKey),
    status: 'active',
    createdAt: options.createdAt,
    lastUsedAt: null,
    deactivatedAt: null,
    revokedAt: null,
    rotatedFromKeyId: options.rotatedFromKeyId ?? null,
    supersededByKeyId: null,
    supersededAt: null,
    recoveryEnvelope: null,
  };
}

export async function maybeSealTenantKeyRecord(record: TenantKeyRecord, apiKey: string): Promise<TenantKeyRecord> {
  const recoveryEnvelope = await sealSecretEnvelope(apiKey, {
    scope: 'tenant_api_key',
    tenantKeyId: record.id,
    tenantId: record.tenantId,
    tenantName: record.tenantName,
    planId: record.planId ?? 'developer',
    createdAt: record.createdAt,
  });
  if (!recoveryEnvelope) return record;
  return {
    ...record,
    recoveryEnvelope,
  };
}

export async function recoverTenantKeyMaterial(record: TenantKeyRecord): Promise<string> {
  if (record.status === 'revoked') {
    throw new TenantKeyStoreError(
      'INVALID_STATE',
      `Tenant key '${record.id}' is revoked and cannot be recovered.`,
    );
  }
  if (!record.recoveryEnvelope) {
    throw new TenantKeyStoreError(
      'INVALID_STATE',
      `Tenant key '${record.id}' is not stored in recoverable sealed form.`,
    );
  }
  assertTenantKeyRecoveryEnabled();
  return recoverSecretEnvelope(record.recoveryEnvelope);
}

export function usageContextFromRecord(
  tenantId: string,
  planId: string | null | undefined,
  quota: number | null | undefined,
  used: number,
  period: string,
): UsageContext {
  const resolvedQuota = typeof quota === 'number' && quota >= 0 ? quota : null;
  const quotaPolicy = resolvePlanQuotaPolicy(planId);
  const overageUnits = resolvedQuota === null ? 0 : Math.max(0, used - resolvedQuota);
  const hardLimit = resolvedQuota !== null && quotaPolicy.hardLimit;
  return {
    tenantId,
    planId: quotaPolicy.planId,
    meter: 'monthly_admission_runs',
    period,
    used,
    quota: resolvedQuota,
    remaining: resolvedQuota === null ? null : Math.max(0, resolvedQuota - used),
    enforced: hardLimit,
    hardLimit,
    overage: overageUnits > 0,
    overageUnits,
  };
}

export function advisoryLockKey(namespace: string): string {
  const digest = createHash('sha256').update(namespace).digest();
  let value = 0n;
  for (let i = 0; i < 8; i += 1) {
    value = (value << 8n) + BigInt(digest[i] ?? 0);
  }
  if (value > 0x7fff_ffff_ffff_ffffn) {
    value -= 0x1_0000_0000_0000_0000n;
  }
  return value.toString();
}

export function adminIdempotencyCutoffIso(now = Date.now()): string {
  const raw = process.env.ATTESTOR_ADMIN_IDEMPOTENCY_TTL_HOURS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 24;
  const ttlHours = Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
  return new Date(now - ttlHours * 60 * 60 * 1000).toISOString();
}

export function rowToAdminAuditRecord(row: PgQueryResultRow): AdminAuditRecord {
  return row.record_json as AdminAuditRecord;
}

export function rowToAdminIdempotencyRecord(row: PgQueryResultRow): AdminIdempotencyRecord {
  return row.record_json as AdminIdempotencyRecord;
}

export function rowToPipelineIdempotencyRecord(row: PgQueryResultRow): PipelineIdempotencyRecord {
  return row.record_json as PipelineIdempotencyRecord;
}

export function rowToStripeWebhookRecord(row: PgQueryResultRow): StripeWebhookRecord {
  return row.record_json as StripeWebhookRecord;
}

export function rowToHostedEmailDeliveryEventRecord(row: PgQueryResultRow): HostedEmailDeliveryEventRecord {
  return coerceHostedEmailDeliveryEventRecord(row.record_json);
}

export function rowToAsyncDeadLetterRecord(row: PgQueryResultRow): AsyncDeadLetterRecord {
  return coerceAsyncDeadLetterRecord(row.record_json);
}

export function mapPgErrorToAccountUserStoreError(err: unknown): AccountUserStoreError | null {
  const pgErr = err as { code?: string; constraint?: string };
  if (pgErr?.code !== '23505') return null;
  switch (pgErr.constraint) {
    case 'account_users_email_uidx':
      return new AccountUserStoreError('CONFLICT', 'Account user email is already assigned to another hosted account.');
    default:
      return new AccountUserStoreError('CONFLICT', 'Hosted account user uniqueness constraint violated.');
  }
}

export function mapPgErrorToAccountStoreError(err: unknown): AccountStoreError | null {
  const pgErr = err as { code?: string; constraint?: string };
  if (pgErr?.code !== '23505') return null;
  switch (pgErr.constraint) {
    case 'hosted_accounts_primary_tenant_id_key':
      return new AccountStoreError('CONFLICT', 'Primary tenant is already assigned to another hosted account.');
    case 'hosted_accounts_stripe_customer_uidx':
      return new AccountStoreError('CONFLICT', 'Stripe customer is already linked to another hosted account.');
    case 'hosted_accounts_stripe_subscription_uidx':
      return new AccountStoreError('CONFLICT', 'Stripe subscription is already linked to another hosted account.');
    default:
      return new AccountStoreError('CONFLICT', 'Hosted account uniqueness constraint violated.');
  }
}
