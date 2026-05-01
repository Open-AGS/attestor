import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { withFileLock } from '../src/platform/file-store.js';
import {
  createHostedAccount,
  resetAccountStoreForTests,
} from '../src/service/account-store.js';
import {
  issueAccountInviteToken,
  resetAccountUserActionTokenStoreForTests,
} from '../src/service/account-user-token-store.js';
import {
  issueTenantApiKey,
  resetTenantKeyStoreForTests,
} from '../src/service/tenant-key-store.js';
import {
  recordProcessedStripeWebhook,
  resetStripeWebhookStoreForTests,
} from '../src/service/stripe-webhook-store.js';
import {
  appendAdminAuditRecord,
  resetAdminAuditLogForTests,
} from '../src/service/admin-audit-log.js';
import {
  resetAsyncDeadLetterStoreForTests,
  upsertAsyncDeadLetterRecord,
} from '../src/service/async-dead-letter-store.js';
import {
  resetHostedBillingEntitlementStoreForTests,
  upsertHostedBillingEntitlement,
} from '../src/service/billing-entitlement-store.js';
import {
  recordHostedEmailDispatchEvent,
  resetHostedEmailDeliveryEventStoreForTests,
} from '../src/service/email-delivery-event-store.js';
import {
  consumePipelineRun,
  resetUsageMeter,
} from '../src/service/usage-meter.js';
import {
  recordSchemaAttestationHistory,
  resetSchemaAttestationHistoryForTests,
} from '../src/connectors/schema-attestation-history.js';
import type { SchemaAttestation } from '../src/connectors/schema-attestation.js';

const envKeys = [
  'ATTESTOR_FILE_LOCK_TIMEOUT_MS',
  'ATTESTOR_FILE_LOCK_RETRY_DELAY_MS',
  'ATTESTOR_FILE_LOCK_STALE_MS',
  'ATTESTOR_ACCOUNT_STORE_PATH',
  'ATTESTOR_ACCOUNT_USER_TOKEN_STORE_PATH',
  'ATTESTOR_TENANT_KEY_STORE_PATH',
  'ATTESTOR_STRIPE_WEBHOOK_STORE_PATH',
  'ATTESTOR_ADMIN_AUDIT_LOG_PATH',
  'ATTESTOR_ASYNC_DLQ_STORE_PATH',
  'ATTESTOR_BILLING_ENTITLEMENT_STORE_PATH',
  'ATTESTOR_EMAIL_DELIVERY_EVENTS_PATH',
  'ATTESTOR_USAGE_LEDGER_PATH',
  'ATTESTOR_SCHEMA_ATTESTATION_HISTORY_PATH',
] as const;

const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  typeof envKeys[number],
  string | undefined
>;

const tempDir = join(process.cwd(), '.attestor-test-runs', `file-store-race-${randomUUID()}`);

function restoreEnv(): void {
  for (const key of envKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function lockDirFor(path: string): string {
  return `${path}.lock`;
}

function createFreshLock(path: string): void {
  mkdirSync(lockDirFor(path), { recursive: true });
}

function removeLock(path: string): void {
  rmSync(lockDirFor(path), { recursive: true, force: true });
}

function assertLockTimeout(action: () => unknown, label: string): void {
  assert.throws(
    action,
    /Timed out waiting for file lock/u,
    label,
  );
}

function configureFileStores(): {
  accountPath: string;
  actionTokenPath: string;
  tenantKeyPath: string;
  stripeWebhookPath: string;
  adminAuditPath: string;
  asyncDeadLetterPath: string;
  billingEntitlementPath: string;
  emailDeliveryPath: string;
  usageLedgerPath: string;
  schemaAttestationHistoryPath: string;
} {
  const accountPath = join(tempDir, 'accounts.json');
  const actionTokenPath = join(tempDir, 'account-user-tokens.json');
  const tenantKeyPath = join(tempDir, 'tenant-keys.json');
  const stripeWebhookPath = join(tempDir, 'stripe-webhooks.json');
  const adminAuditPath = join(tempDir, 'admin-audit-log.json');
  const asyncDeadLetterPath = join(tempDir, 'async-dead-letter.json');
  const billingEntitlementPath = join(tempDir, 'billing-entitlements.json');
  const emailDeliveryPath = join(tempDir, 'email-delivery-events.json');
  const usageLedgerPath = join(tempDir, 'usage-ledger.json');
  const schemaAttestationHistoryPath = join(tempDir, 'schema-attestation-history.json');
  process.env.ATTESTOR_FILE_LOCK_TIMEOUT_MS = '30';
  process.env.ATTESTOR_FILE_LOCK_RETRY_DELAY_MS = '5';
  process.env.ATTESTOR_FILE_LOCK_STALE_MS = '600000';
  process.env.ATTESTOR_ACCOUNT_STORE_PATH = accountPath;
  process.env.ATTESTOR_ACCOUNT_USER_TOKEN_STORE_PATH = actionTokenPath;
  process.env.ATTESTOR_TENANT_KEY_STORE_PATH = tenantKeyPath;
  process.env.ATTESTOR_STRIPE_WEBHOOK_STORE_PATH = stripeWebhookPath;
  process.env.ATTESTOR_ADMIN_AUDIT_LOG_PATH = adminAuditPath;
  process.env.ATTESTOR_ASYNC_DLQ_STORE_PATH = asyncDeadLetterPath;
  process.env.ATTESTOR_BILLING_ENTITLEMENT_STORE_PATH = billingEntitlementPath;
  process.env.ATTESTOR_EMAIL_DELIVERY_EVENTS_PATH = emailDeliveryPath;
  process.env.ATTESTOR_USAGE_LEDGER_PATH = usageLedgerPath;
  process.env.ATTESTOR_SCHEMA_ATTESTATION_HISTORY_PATH = schemaAttestationHistoryPath;
  return {
    accountPath,
    actionTokenPath,
    tenantKeyPath,
    stripeWebhookPath,
    adminAuditPath,
    asyncDeadLetterPath,
    billingEntitlementPath,
    emailDeliveryPath,
    usageLedgerPath,
    schemaAttestationHistoryPath,
  };
}

function testStaleLockRecovery(): void {
  const targetPath = join(tempDir, 'stale-store.json');
  const lockPath = lockDirFor(targetPath);
  mkdirSync(lockPath, { recursive: true });
  writeFileSync(
    join(lockPath, 'owner.json'),
    JSON.stringify({
      pid: 999_999_999,
      hostname: 'stale-test-host',
      acquiredAtMs: Date.now() - 60_000,
      acquiredAt: new Date(Date.now() - 60_000).toISOString(),
    }),
  );

  const result = withFileLock(targetPath, () => 'recovered', {
    timeoutMs: 100,
    retryDelayMs: 5,
    staleMs: 1,
  });

  assert.equal(result, 'recovered', 'stale file lock is recovered before the action runs');
}

function testHostedStoreMutationsHonorLocks(): void {
  const {
    accountPath,
    actionTokenPath,
    tenantKeyPath,
    stripeWebhookPath,
  } = configureFileStores();

  createFreshLock(accountPath);
  assertLockTimeout(() => createHostedAccount({
    accountName: 'Acme',
    contactEmail: 'ops@example.com',
    primaryTenantId: 'tenant_acme',
  }), 'hosted account mutation waits on the account store lock');
  removeLock(accountPath);

  const account = createHostedAccount({
    accountName: 'Acme',
    contactEmail: 'ops@example.com',
    primaryTenantId: 'tenant_acme',
  });
  assert.equal(account.record.primaryTenantId, 'tenant_acme');

  createFreshLock(actionTokenPath);
  assertLockTimeout(() => issueAccountInviteToken({
    accountId: account.record.id,
    email: 'new-user@example.com',
    displayName: 'New User',
    role: 'read_only',
    issuedByAccountUserId: 'acctusr_admin',
  }), 'account action-token mutation waits on the token store lock');
  removeLock(actionTokenPath);

  const invite = issueAccountInviteToken({
    accountId: account.record.id,
    email: 'new-user@example.com',
    displayName: 'New User',
    role: 'read_only',
    issuedByAccountUserId: 'acctusr_admin',
  });
  assert.equal(invite.record.email, 'new-user@example.com');

  createFreshLock(tenantKeyPath);
  assertLockTimeout(() => issueTenantApiKey({
    tenantId: 'tenant_keys',
    tenantName: 'Tenant Keys',
  }), 'tenant API key mutation waits on the tenant key store lock');
  removeLock(tenantKeyPath);

  const tenantKey = issueTenantApiKey({
    tenantId: 'tenant_keys',
    tenantName: 'Tenant Keys',
  });
  assert.equal(tenantKey.record.tenantId, 'tenant_keys');

  createFreshLock(stripeWebhookPath);
  assertLockTimeout(() => recordProcessedStripeWebhook({
    eventId: 'evt_lock_test',
    eventType: 'invoice.paid',
    accountId: account.record.id,
    stripeCustomerId: 'cus_lock',
    stripeSubscriptionId: 'sub_lock',
    outcome: 'applied',
    reason: null,
    rawPayload: '{"id":"evt_lock_test"}',
  }), 'Stripe webhook dedupe mutation waits on the webhook store lock');
  removeLock(stripeWebhookPath);

  const webhook = recordProcessedStripeWebhook({
    eventId: 'evt_lock_test',
    eventType: 'invoice.paid',
    accountId: account.record.id,
    stripeCustomerId: 'cus_lock',
    stripeSubscriptionId: 'sub_lock',
    outcome: 'applied',
    reason: null,
    rawPayload: '{"id":"evt_lock_test"}',
  });
  assert.equal(webhook.record.eventId, 'evt_lock_test');
}

function sampleSchemaAttestation(): SchemaAttestation {
  return {
    version: '1.0',
    type: 'attestor.schema_attestation.v1',
    capturedAt: new Date().toISOString(),
    executionContextHash: 'ctx_lock_test',
    txidSnapshot: null,
    schemaName: 'finance',
    tables: ['payments'],
    columns: [],
    constraints: [],
    indexes: [],
    sentinels: [],
    tableContentFingerprints: [],
    columnFingerprint: 'columns_lock_test',
    constraintFingerprint: 'constraints_lock_test',
    indexFingerprint: 'indexes_lock_test',
    schemaFingerprint: 'schema_lock_test',
    sentinelFingerprint: 'sentinels_lock_test',
    contentFingerprint: 'content_lock_test',
    attestationHash: 'attestation_lock_test',
    historyKey: null,
    historicalComparison: null,
  };
}

function testAuditAndLedgerMutationsHonorLocks(): void {
  const {
    adminAuditPath,
    asyncDeadLetterPath,
    billingEntitlementPath,
    emailDeliveryPath,
    usageLedgerPath,
    schemaAttestationHistoryPath,
  } = configureFileStores();

  const account = createHostedAccount({
    accountName: 'Ledger Lock Test',
    contactEmail: 'ledger-lock@example.com',
    primaryTenantId: 'tenant_ledger_lock',
  });

  createFreshLock(adminAuditPath);
  assertLockTimeout(() => appendAdminAuditRecord({
    actorType: 'admin_api_key',
    actorLabel: 'admin-lock-test',
    action: 'tenant_key.issued',
    routeId: 'lock-test',
    accountId: account.record.id,
    tenantId: account.record.primaryTenantId,
    tenantKeyId: 'key_lock_test',
    planId: null,
    monthlyRunQuota: null,
    idempotencyKey: null,
    requestHash: 'request_lock_test',
    metadata: {},
  }), 'admin audit ledger mutation waits on the audit log lock');
  removeLock(adminAuditPath);

  createFreshLock(asyncDeadLetterPath);
  assertLockTimeout(() => upsertAsyncDeadLetterRecord({
    jobId: 'job_lock_test',
    name: 'pipeline',
    backendMode: 'in_process',
    tenantId: account.record.primaryTenantId,
    planId: null,
    state: 'failed',
    failedReason: 'lock test',
    attemptsMade: 1,
    maxAttempts: 1,
    requestedAt: null,
    submittedAt: null,
    processedAt: null,
    failedAt: new Date().toISOString(),
    recordedAt: new Date().toISOString(),
  }), 'async dead-letter mutation waits on the dead-letter store lock');
  removeLock(asyncDeadLetterPath);

  createFreshLock(billingEntitlementPath);
  assertLockTimeout(() => upsertHostedBillingEntitlement({
    account: account.record,
    currentPlanId: 'community',
    currentMonthlyRunQuota: 10,
  }), 'billing entitlement mutation waits on the entitlement store lock');
  removeLock(billingEntitlementPath);

  createFreshLock(emailDeliveryPath);
  assertLockTimeout(() => recordHostedEmailDispatchEvent({
    deliveryId: 'edlv_lock_test',
    accountId: account.record.id,
    accountUserId: null,
    purpose: 'invite',
    provider: 'manual',
    channel: 'api_response',
    recipient: 'invite@example.com',
    messageId: null,
    actionUrl: null,
    tokenReturned: false,
  }), 'email delivery event mutation waits on the delivery event store lock');
  removeLock(emailDeliveryPath);

  createFreshLock(usageLedgerPath);
  assertLockTimeout(() => consumePipelineRun(account.record.primaryTenantId, 'community', 10), 'usage meter mutation waits on the usage ledger lock');
  removeLock(usageLedgerPath);

  createFreshLock(schemaAttestationHistoryPath);
  assertLockTimeout(() => recordSchemaAttestationHistory(sampleSchemaAttestation()), 'schema attestation history mutation waits on the history store lock');
  removeLock(schemaAttestationHistoryPath);
}

try {
  configureFileStores();
  resetAccountStoreForTests();
  resetAccountUserActionTokenStoreForTests();
  resetTenantKeyStoreForTests();
  resetStripeWebhookStoreForTests();
  resetAdminAuditLogForTests();
  resetAsyncDeadLetterStoreForTests();
  resetHostedBillingEntitlementStoreForTests();
  resetHostedEmailDeliveryEventStoreForTests();
  resetUsageMeter();
  resetSchemaAttestationHistoryForTests();

  testStaleLockRecovery();
  testHostedStoreMutationsHonorLocks();
  testAuditAndLedgerMutationsHonorLocks();

  console.log('File store race hardening tests: 3 passed, 0 failed');
} finally {
  resetAccountStoreForTests();
  resetAccountUserActionTokenStoreForTests();
  resetTenantKeyStoreForTests();
  resetStripeWebhookStoreForTests();
  resetAdminAuditLogForTests();
  resetAsyncDeadLetterStoreForTests();
  resetHostedBillingEntitlementStoreForTests();
  resetHostedEmailDeliveryEventStoreForTests();
  resetUsageMeter();
  resetSchemaAttestationHistoryForTests();
  restoreEnv();
  rmSync(tempDir, { recursive: true, force: true });
}
