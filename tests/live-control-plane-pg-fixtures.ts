import { strict as assert } from 'node:assert';
import EmbeddedPostgres from 'embedded-postgres';
import Stripe from 'stripe';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { resetHostedEmailDeliveryEventStoreForTests } from '../src/service/async/email-delivery-event-store.js';
import { resetAdminAuditLogForTests } from '../src/service/admin-audit-log.js';
import { resetAdminIdempotencyStoreForTests } from '../src/service/admin-idempotency-store.js';
import { resetHostedBillingEntitlementStoreForTests } from '../src/service/billing/billing-entitlement-store.js';
import { resetBillingEventLedgerForTests } from '../src/service/billing/billing-event-ledger.js';
import { resetStripeWebhookStoreForTests } from '../src/service/billing/stripe/stripe-webhook-store.js';
import { resetSharedControlPlaneStoreForTests } from '../src/service/control-plane-store.js';
import { resetObservabilityForTests } from '../src/service/observability.js';
import { resetTenantRateLimiterForTests } from '../src/service/rate-limit.js';
import { tenantWorkflowMetadataDigest } from '../src/service/workflow-entitlement-store.js';
import { webauthnOrigin } from './helpers/passkey-fixtures.js';

let passed = 0;

export const stripe = new Stripe('sk_test_live_control_plane');
export const workflowId = 'wf_pg_live_billing_001';
export const workflowTier = 'pro-workflow';
export const workflowConsequencePack = 'money-movement';
export const workflowPriceId = 'price_pro_workflow_monthly';
export const stripeCustomerId = 'cus_pg_live_001';
export const stripeSubscriptionId = 'sub_pg_live_workflow_001';
export const stripeSubscriptionItemId = 'si_pg_live_workflow_001';

export type LiveControlPlanePgPaths = {
  readonly accountStorePath: string;
  readonly tenantKeyStorePath: string;
  readonly usageLedgerPath: string;
  readonly accountUserStorePath: string;
  readonly accountUserTokenStorePath: string;
  readonly accountSessionStorePath: string;
  readonly adminAuditPath: string;
  readonly adminIdempotencyPath: string;
  readonly asyncDlqPath: string;
  readonly stripeWebhookPath: string;
  readonly billingEntitlementPath: string;
  readonly workflowEntitlementPath: string;
};

export type LiveControlPlanePgHarness = {
  readonly tempRoot: string;
  readonly base: string;
  readonly pg: EmbeddedPostgres;
  readonly server: { close(): unknown };
  readonly paths: LiveControlPlanePgPaths;
};

export function ok(condition: boolean, message: string): void {
  assert(condition, message);
  passed += 1;
}

export function passedCount(): number {
  return passed;
}

export function accountMutationHeaders(cookie: string): Record<string, string> {
  return {
    Cookie: cookie,
    'x-attestor-csrf': 'live-control-plane-pg',
  };
}

export function currentTotpStepIndex(nowMs = Date.now()): number {
  return Math.floor(nowMs / 30_000);
}

export async function waitForTotpStepAfter(step: number): Promise<void> {
  while (currentTotpStepIndex() <= step) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve TCP port.'));
        return;
      }
      const { port } = address;
      server.close((err) => err ? reject(err) : resolve(port));
    });
  });
}

export async function waitForJobStatus(
  base: string,
  jobId: string,
  expected: 'completed' | 'failed',
  timeoutMs: number = 6000,
  headers?: Record<string, string>,
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/api/v1/pipeline/status/${jobId}`, { headers });
    const body = await res.json();
    if (body.status === expected) return body;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for async job ${jobId} to reach status '${expected}'.`);
}

export function workflowStripeMetadata(input: {
  accountId: string;
  tenantId: string;
  downstreamSystemRefDigest: string;
  policyGatePathRefDigest: string;
}): Record<string, string> {
  return {
    attestor_account_id: input.accountId,
    attestor_tenant_digest: tenantWorkflowMetadataDigest(input.tenantId),
    attestor_workflow_id: workflowId,
    attestor_workflow_tier: workflowTier,
    attestor_consequence_pack: workflowConsequencePack,
    attestor_downstream_ref_digest: input.downstreamSystemRefDigest,
    attestor_policy_gate_digest: input.policyGatePathRefDigest,
  };
}

async function resetLiveControlPlaneStores(): Promise<void> {
  await resetSharedControlPlaneStoreForTests();
  await resetTenantRateLimiterForTests();
  resetAdminAuditLogForTests();
  resetAdminIdempotencyStoreForTests();
  resetStripeWebhookStoreForTests();
  resetHostedBillingEntitlementStoreForTests();
  resetHostedEmailDeliveryEventStoreForTests();
  resetObservabilityForTests();
  await resetBillingEventLedgerForTests();
}

export async function startLiveControlPlanePgHarness(): Promise<LiveControlPlanePgHarness> {
  mkdirSync('.attestor', { recursive: true });
  const tempRoot = mkdtempSync(join(process.cwd(), '.attestor', 'live-control-plane-pg-'));
  const pgDataDir = join(tempRoot, 'pg');
  const pgPort = await reservePort();
  const apiPort = await reservePort();
  const pg = new EmbeddedPostgres({
    databaseDir: pgDataDir,
    user: 'control_plane_live',
    password: 'control_plane_live',
    port: pgPort,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  const paths: LiveControlPlanePgPaths = {
    accountStorePath: join(tempRoot, 'accounts.json'),
    tenantKeyStorePath: join(tempRoot, 'tenant-keys.json'),
    usageLedgerPath: join(tempRoot, 'usage-ledger.json'),
    accountUserStorePath: join(tempRoot, 'account-users.json'),
    accountUserTokenStorePath: join(tempRoot, 'account-user-tokens.json'),
    accountSessionStorePath: join(tempRoot, 'account-sessions.json'),
    adminAuditPath: join(tempRoot, 'admin-audit.json'),
    adminIdempotencyPath: join(tempRoot, 'admin-idempotency.json'),
    asyncDlqPath: join(tempRoot, 'async-dlq.json'),
    stripeWebhookPath: join(tempRoot, 'stripe-webhooks.json'),
    billingEntitlementPath: join(tempRoot, 'billing-entitlements.json'),
    workflowEntitlementPath: join(tempRoot, 'workflow-entitlements.json'),
  };

  process.env.ATTESTOR_CONTROL_PLANE_PG_URL = `postgres://control_plane_live:control_plane_live@localhost:${pgPort}/attestor_control_plane`;
  process.env.ATTESTOR_BILLING_LEDGER_PG_URL = `postgres://control_plane_live:control_plane_live@localhost:${pgPort}/attestor_billing`;
  process.env.ATTESTOR_ACCOUNT_STORE_PATH = paths.accountStorePath;
  process.env.ATTESTOR_ACCOUNT_USER_STORE_PATH = paths.accountUserStorePath;
  process.env.ATTESTOR_ACCOUNT_USER_TOKEN_STORE_PATH = paths.accountUserTokenStorePath;
  process.env.ATTESTOR_ACCOUNT_SESSION_STORE_PATH = paths.accountSessionStorePath;
  process.env.ATTESTOR_ACCOUNT_MFA_ENCRYPTION_KEY = 'shared-control-plane-mfa-secret';
  process.env.ATTESTOR_TENANT_KEY_STORE_PATH = paths.tenantKeyStorePath;
  process.env.ATTESTOR_USAGE_LEDGER_PATH = paths.usageLedgerPath;
  process.env.ATTESTOR_ADMIN_AUDIT_LOG_PATH = paths.adminAuditPath;
  process.env.ATTESTOR_ADMIN_IDEMPOTENCY_STORE_PATH = paths.adminIdempotencyPath;
  process.env.ATTESTOR_ASYNC_DLQ_STORE_PATH = paths.asyncDlqPath;
  process.env.ATTESTOR_STRIPE_WEBHOOK_STORE_PATH = paths.stripeWebhookPath;
  process.env.ATTESTOR_BILLING_ENTITLEMENT_STORE_PATH = paths.billingEntitlementPath;
  process.env.ATTESTOR_WORKFLOW_ENTITLEMENT_STORE_PATH = paths.workflowEntitlementPath;
  process.env.ATTESTOR_EMAIL_DELIVERY_EVENTS_PATH = join(tempRoot, 'email-delivery-events.json');
  process.env.ATTESTOR_OBSERVABILITY_LOG_PATH = join(tempRoot, 'observability.jsonl');
  process.env.ATTESTOR_ADMIN_API_KEY = 'admin-shared-control-plane';
  process.env.ATTESTOR_RATE_LIMIT_WINDOW_SECONDS = '2';
  process.env.ATTESTOR_RATE_LIMIT_STARTER_REQUESTS = '5';
  process.env.ATTESTOR_RATE_LIMIT_PRO_REQUESTS = '10';
  process.env.ATTESTOR_ASYNC_PENDING_STARTER_JOBS = '1';
  process.env.ATTESTOR_STRIPE_USE_MOCK = 'true';
  process.env.STRIPE_API_KEY = 'sk_test_live_control_plane_mock';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_live_control_plane';
  process.env.ATTESTOR_BILLING_SUCCESS_URL = 'https://attestor.dev/billing/success';
  process.env.ATTESTOR_BILLING_CANCEL_URL = 'https://attestor.dev/billing/cancel';
  process.env.ATTESTOR_BILLING_PORTAL_RETURN_URL = 'https://attestor.dev/settings/billing';
  process.env.ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW = 'price_pilot_workflow_monthly';
  process.env.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_monthly';
  process.env.ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW = 'price_pro_workflow_monthly';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_overage_monthly';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW = 'price_pro_workflow_overage_monthly';
  process.env.ATTESTOR_WEBAUTHN_RP_ID = 'dev.dontneeda.pw';
  process.env.ATTESTOR_WEBAUTHN_ORIGIN = webauthnOrigin;
  process.env.ATTESTOR_WEBAUTHN_RP_NAME = 'Attestor Test';
  process.env.ATTESTOR_WEBAUTHN_REQUIRE_USER_VERIFICATION = 'false';

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('attestor_control_plane');
  await pg.createDatabase('attestor_billing');

  await resetLiveControlPlaneStores();

  const { startServer } = await import('../src/service/api-server.js');
  const base = `http://127.0.0.1:${apiPort}`;
  const server = startServer(apiPort);
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    tempRoot,
    base,
    pg,
    server,
    paths,
  };
}

export async function cleanupLiveControlPlanePgHarness(harness: LiveControlPlanePgHarness): Promise<void> {
  harness.server.close();
  await resetLiveControlPlaneStores();
  try { await harness.pg.stop(); } catch {}
  try { rmSync(harness.tempRoot, { recursive: true, force: true }); } catch {}
  delete process.env.ATTESTOR_CONTROL_PLANE_PG_URL;
  delete process.env.ATTESTOR_BILLING_LEDGER_PG_URL;
  delete process.env.ATTESTOR_WORKFLOW_ENTITLEMENT_STORE_PATH;
}
