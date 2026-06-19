/**
 * LIVE API Integration Tests
 *
 * These are NOT mocks. This test starts a real local Hono server and runs
 * the live route families through responsibility-named flow modules.
 *
 * Run: npx tsx tests/live-api.test.ts
 */

import { runAdminTenantKeyFlow } from './live-api/admin-tenant-key-flow.js';
import { getPassedCount } from './live-api/helpers.js';
import { runHostedAccountIdentityFlow } from './live-api/hosted-account-identity-flow.js';
import { runHostedBillingObservabilityFlow } from './live-api/hosted-billing-observability-flow.js';
import { runHostedPlanUsageFlow } from './live-api/hosted-plan-usage-flow.js';
import { runHostedUserSignupApiKeyFlow } from './live-api/hosted-user-signup-api-key-flow.js';
import { runRuntimePipelineFlow } from './live-api/runtime-pipeline-flow.js';
import { resetPipelineIdempotencyStoreForTests } from '../src/service/pipeline/pipeline-idempotency-store.js';
import {
  join,
  mkdirSync,
  resetAccountSessionStoreForTests,
  resetAccountStoreForTests,
  resetAccountUserActionTokenStoreForTests,
  resetAccountUserStoreForTests,
  resetAdminAuditLogForTests,
  resetAdminIdempotencyStoreForTests,
  resetAsyncDeadLetterStoreForTests,
  resetBillingEventLedgerForTests,
  resetHostedBillingEntitlementStoreForTests,
  resetHostedEmailDeliveryEventStoreForTests,
  resetObservabilityForTests,
  resetStripeWebhookStoreForTests,
  resetTenantKeyStoreForTests,
  resetTenantRateLimiterForTests,
  resetUsageMeter,
  resetWorkflowEntitlementStoreForTests,
  rmSync,
  startServer,
} from './live-api/helpers.js';
import type { LiveApiHostedContext } from './live-api/helpers.js';

let serverHandle: { close: () => void };

async function run() {

  mkdirSync('.attestor', { recursive: true });

  // Billing control-plane uses file-backed mode for this test suite.
  // PostgreSQL-backed billing is tested separately in control-plane-backup-pg.test.ts.
  delete process.env.ATTESTOR_BILLING_LEDGER_PG_URL;

  process.env.ATTESTOR_TENANT_KEY_STORE_PATH = join(process.cwd(), '.attestor', 'live-api-tenant-keys.json');
  process.env.ATTESTOR_USAGE_LEDGER_PATH = join(process.cwd(), '.attestor', 'live-api-usage-ledger.json');
  process.env.ATTESTOR_ACCOUNT_STORE_PATH = join(process.cwd(), '.attestor', 'live-api-accounts.json');
  process.env.ATTESTOR_ACCOUNT_USER_STORE_PATH = join(process.cwd(), '.attestor', 'live-api-account-users.json');
  process.env.ATTESTOR_ACCOUNT_USER_TOKEN_STORE_PATH = join(process.cwd(), '.attestor', 'live-api-account-user-tokens.json');
  process.env.ATTESTOR_ACCOUNT_SESSION_STORE_PATH = join(process.cwd(), '.attestor', 'live-api-account-sessions.json');
  process.env.ATTESTOR_ACCOUNT_MFA_ENCRYPTION_KEY = 'live-api-mfa-secret';
  process.env.ATTESTOR_ADMIN_AUDIT_LOG_PATH = join(process.cwd(), '.attestor', 'live-api-admin-audit.json');
  process.env.ATTESTOR_ADMIN_IDEMPOTENCY_STORE_PATH = join(process.cwd(), '.attestor', 'live-api-admin-idempotency.json');
  process.env.ATTESTOR_ASYNC_DLQ_STORE_PATH = join(process.cwd(), '.attestor', 'live-api-async-dlq.json');
  process.env.ATTESTOR_PIPELINE_IDEMPOTENCY_STORE_PATH = join(process.cwd(), '.attestor', 'live-api-pipeline-idempotency.json');
  process.env.ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY = 'live-api-pipeline-idempotency-secret';
  process.env.ATTESTOR_STRIPE_WEBHOOK_STORE_PATH = join(process.cwd(), '.attestor', 'live-api-stripe-webhooks.json');
  process.env.ATTESTOR_BILLING_ENTITLEMENT_STORE_PATH = join(process.cwd(), '.attestor', 'live-api-billing-entitlements.json');
  process.env.ATTESTOR_WORKFLOW_ENTITLEMENT_STORE_PATH = join(process.cwd(), '.attestor', 'live-api-workflow-entitlements.json');
  process.env.ATTESTOR_EMAIL_DELIVERY_EVENTS_PATH = join(process.cwd(), '.attestor', 'live-api-email-delivery-events.json');
  process.env.ATTESTOR_OBSERVABILITY_LOG_PATH = join(process.cwd(), '.attestor', 'live-api-observability.jsonl');
  process.env.ATTESTOR_SESSION_COOKIE_SECURE = 'false';
  process.env.ATTESTOR_ADMIN_API_KEY = 'admin-secret';
  process.env.ATTESTOR_ADMIN_RELEASE_API_KEY = 'admin-release-secret';
  process.env.ATTESTOR_ADMIN_BREAK_GLASS_API_KEY = 'admin-break-glass-secret';
  process.env.ATTESTOR_METRICS_API_KEY = 'metrics-secret';
  process.env.ATTESTOR_RATE_LIMIT_WINDOW_SECONDS = '5';
  process.env.ATTESTOR_RATE_LIMIT_TRIAL_REQUESTS = '3';
  process.env.ATTESTOR_RATE_LIMIT_STARTER_REQUESTS = '3';
  process.env.ATTESTOR_RATE_LIMIT_PRO_REQUESTS = '20';
  process.env.ATTESTOR_ASYNC_PENDING_TRIAL_JOBS = '1';
  process.env.ATTESTOR_ASYNC_ACTIVE_TRIAL_JOBS = '1';
  process.env.ATTESTOR_ASYNC_DISPATCH_TRIAL_WEIGHT = '1';
  process.env.ATTESTOR_ASYNC_PENDING_STARTER_JOBS = '1';
  process.env.ATTESTOR_ASYNC_ACTIVE_STARTER_JOBS = '1';
  process.env.ATTESTOR_ASYNC_DISPATCH_STARTER_WEIGHT = '1';
  process.env.ATTESTOR_ASYNC_DISPATCH_BASE_INTERVAL_MS = '400';
  process.env.ATTESTOR_STRIPE_USE_MOCK = 'true';
  process.env.STRIPE_API_KEY = 'sk_test_live_api_mock';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_live_api_test';
  process.env.ATTESTOR_BILLING_SUCCESS_URL = 'https://attestor.dev/billing/success';
  process.env.ATTESTOR_BILLING_CANCEL_URL = 'https://attestor.dev/billing/cancel';
  process.env.ATTESTOR_BILLING_PORTAL_RETURN_URL = 'https://attestor.dev/settings/billing';
  process.env.ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW = 'price_pilot_workflow_monthly';
  process.env.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_monthly';
  process.env.ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW = 'price_pro_workflow_monthly';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_overage_monthly';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW = 'price_pro_workflow_overage_monthly';
  resetTenantKeyStoreForTests();
  resetUsageMeter();
  await resetTenantRateLimiterForTests();
  resetAccountStoreForTests();
  resetAccountUserStoreForTests();
  resetAccountSessionStoreForTests();
  resetAdminAuditLogForTests();
  resetAdminIdempotencyStoreForTests();
  resetAsyncDeadLetterStoreForTests();
  resetPipelineIdempotencyStoreForTests();
  resetStripeWebhookStoreForTests();
  resetHostedBillingEntitlementStoreForTests();
  resetWorkflowEntitlementStoreForTests();
  resetHostedEmailDeliveryEventStoreForTests();
  await resetBillingEventLedgerForTests();
  resetObservabilityForTests();

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  LIVE API INTEGRATION TESTS — Real HTTP, Real Server');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── Start real server ──
  console.log('  Starting Hono API server on port 3700...');
  serverHandle = startServer(3700);
  // Give server a moment to bind
  await new Promise(r => setTimeout(r, 500));
  console.log('  ✓ Server running\n');
  try {
    await runRuntimePipelineFlow();
    await runHostedPlanUsageFlow();

    const hostedContext: LiveApiHostedContext = {};
    await runHostedAccountIdentityFlow(hostedContext);
    await runHostedBillingObservabilityFlow(hostedContext);
    await runHostedUserSignupApiKeyFlow(hostedContext);
    await runAdminTenantKeyFlow(hostedContext);

    console.log(`\n  Live API Tests: ${getPassedCount()} passed, 0 failed\n`);
  } finally {
    resetAccountStoreForTests();
    resetAccountUserStoreForTests();
    resetAccountUserActionTokenStoreForTests();
    resetAccountSessionStoreForTests();
    resetTenantKeyStoreForTests();
    resetUsageMeter();
    await resetTenantRateLimiterForTests();
    resetAdminAuditLogForTests();
    resetAdminIdempotencyStoreForTests();
    resetPipelineIdempotencyStoreForTests();
    resetStripeWebhookStoreForTests();
    resetHostedBillingEntitlementStoreForTests();
    resetWorkflowEntitlementStoreForTests();
    resetHostedEmailDeliveryEventStoreForTests();
    await resetBillingEventLedgerForTests();
    resetObservabilityForTests();
    serverHandle.close();
    console.log('  Server stopped.\n');
  }
}

run()
  .then(() => {
    // Force exit after assertions completed and cleanup finished.
    process.exit(0);
  })
  .catch(err => {
    console.error('  LIVE TEST CRASHED:', err);
    try { serverHandle?.close(); } catch {}
    process.exit(1);
  });
