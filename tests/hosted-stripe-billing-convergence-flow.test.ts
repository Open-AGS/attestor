import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Stripe from 'stripe';
import { startServer } from '../src/service/api-server.js';
import { resetAccountSessionStoreForTests } from '../src/service/account/account-session-store.js';
import { resetAccountStoreForTests } from '../src/service/account/account-store.js';
import { resetAccountUserStoreForTests } from '../src/service/account/account-user-store.js';
import { resetAccountUserActionTokenStoreForTests } from '../src/service/account/account-user-token-store.js';
import { resetAdminAuditLogForTests } from '../src/service/admin-audit-log.js';
import { resetAdminIdempotencyStoreForTests } from '../src/service/admin-idempotency-store.js';
import { resetAsyncDeadLetterStoreForTests } from '../src/service/async/async-dead-letter-store.js';
import { resetBillingEventLedgerForTests } from '../src/service/billing/billing-event-ledger.js';
import { resetHostedBillingEntitlementStoreForTests } from '../src/service/billing/billing-entitlement-store.js';
import { resetHostedEmailDeliveryEventStoreForTests } from '../src/service/async/email-delivery-event-store.js';
import { resetObservabilityForTests } from '../src/service/observability.js';
import { resetTenantRateLimiterForTests } from '../src/service/rate-limit.js';
import { shutdownTenantRuntimeBackends } from '../src/service/runtime/tenant-runtime.js';
import { resetStripeWebhookStoreForTests } from '../src/service/billing/stripe/stripe-webhook-store.js';
import { resetTenantKeyStoreForTests } from '../src/service/tenant-key-store.js';
import { resetUsageMeter } from '../src/service/usage-meter.js';
import { tenantWorkflowMetadataDigest } from '../src/service/workflow-entitlement-store.js';

let passed = 0;

interface TestServerHandle {
  close(): void;
}

const stripe = new Stripe('sk_test_hosted_billing_convergence');

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve a TCP port.'));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function cookieHeaderFromResponse(res: Response): string | null {
  const raw = res.headers.get('set-cookie');
  if (!raw) return null;
  const [cookiePair] = raw.split(';', 1);
  return cookiePair?.trim() || null;
}

async function readJson(res: Response): Promise<any> {
  return res.json() as Promise<any>;
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function signedStripeHeaders(payload: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Stripe-Signature': stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    }),
  };
}

async function postStripeWebhook(baseUrl: string, payload: string): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/billing/stripe/webhook`, {
    method: 'POST',
    headers: signedStripeHeaders(payload),
    body: payload,
  });
}

function configureIsolatedStores(root: string): void {
  delete process.env.ATTESTOR_TENANT_KEYS;
  delete process.env.ATTESTOR_BILLING_LEDGER_PG_URL;
  delete process.env.ATTESTOR_RATE_LIMIT_DEVELOPER_REQUESTS;
  delete process.env.ATTESTOR_RATE_LIMIT_STARTER_REQUESTS;
  delete process.env.ATTESTOR_RATE_LIMIT_PRO_REQUESTS;
  delete process.env.ATTESTOR_RATE_LIMIT_ENTERPRISE_REQUESTS;
  delete process.env.ATTESTOR_ASYNC_QUEUE_REDIS_URL;
  delete process.env.ATTESTOR_ASYNC_DISPATCH_REDIS_URL;

  process.env.ATTESTOR_TENANT_KEY_STORE_PATH = join(root, 'tenant-keys.json');
  process.env.ATTESTOR_USAGE_LEDGER_PATH = join(root, 'usage-ledger.json');
  process.env.ATTESTOR_ACCOUNT_STORE_PATH = join(root, 'accounts.json');
  process.env.ATTESTOR_ACCOUNT_USER_STORE_PATH = join(root, 'account-users.json');
  process.env.ATTESTOR_ACCOUNT_USER_TOKEN_STORE_PATH = join(root, 'account-user-tokens.json');
  process.env.ATTESTOR_ACCOUNT_SESSION_STORE_PATH = join(root, 'account-sessions.json');
  process.env.ATTESTOR_ACCOUNT_MFA_ENCRYPTION_KEY = 'hosted-stripe-billing-mfa-secret';
  process.env.ATTESTOR_ADMIN_AUDIT_LOG_PATH = join(root, 'admin-audit.json');
  process.env.ATTESTOR_ADMIN_IDEMPOTENCY_STORE_PATH = join(root, 'admin-idempotency.json');
  process.env.ATTESTOR_ASYNC_DLQ_STORE_PATH = join(root, 'async-dlq.json');
  process.env.ATTESTOR_STRIPE_WEBHOOK_STORE_PATH = join(root, 'stripe-webhooks.json');
  process.env.ATTESTOR_BILLING_ENTITLEMENT_STORE_PATH = join(root, 'billing-entitlements.json');
  process.env.ATTESTOR_EMAIL_DELIVERY_EVENTS_PATH = join(root, 'email-delivery-events.json');
  process.env.ATTESTOR_OBSERVABILITY_LOG_PATH = join(root, 'observability.jsonl');
  process.env.ATTESTOR_SESSION_COOKIE_SECURE = 'false';
  process.env.ATTESTOR_ADMIN_API_KEY = 'hosted-stripe-billing-admin';
  process.env.ATTESTOR_METRICS_API_KEY = 'hosted-stripe-billing-metrics';
  process.env.ATTESTOR_TENANT_KEY_MAX_ACTIVE_PER_TENANT = '2';
  process.env.ATTESTOR_STRIPE_USE_MOCK = 'true';
  process.env.STRIPE_API_KEY = 'sk_test_hosted_stripe_billing';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_hosted_stripe_billing';
  process.env.ATTESTOR_BILLING_SUCCESS_URL = 'https://attestor.dev/billing/success';
  process.env.ATTESTOR_BILLING_CANCEL_URL = 'https://attestor.dev/billing/cancel';
  process.env.ATTESTOR_BILLING_PORTAL_RETURN_URL = 'https://attestor.dev/settings/billing';
  process.env.ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW = 'price_pilot_workflow_monthly';
  process.env.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_monthly';
  process.env.ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW = 'price_pro_workflow_monthly';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_overage_monthly';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW = 'price_pro_workflow_overage_monthly';
}

async function resetStores(): Promise<void> {
  resetTenantKeyStoreForTests();
  resetUsageMeter();
  await resetTenantRateLimiterForTests();
  resetAccountStoreForTests();
  resetAccountUserStoreForTests();
  resetAccountUserActionTokenStoreForTests();
  resetAccountSessionStoreForTests();
  resetAdminAuditLogForTests();
  resetAdminIdempotencyStoreForTests();
  resetAsyncDeadLetterStoreForTests();
  resetStripeWebhookStoreForTests();
  await resetBillingEventLedgerForTests();
  resetHostedBillingEntitlementStoreForTests();
  resetHostedEmailDeliveryEventStoreForTests();
  resetObservabilityForTests();
}

function checkoutCompletedPayload(input: {
  eventId: string;
  accountId: string;
  tenantId: string;
  checkoutSessionId: string;
  customerId: string;
  subscriptionId: string;
  workflowId: string;
  workflowTier: string;
  consequencePack: string;
  downstreamSystemRefDigest: string;
  policyGatePathRefDigest: string;
}): string {
  return JSON.stringify({
    id: input.eventId,
    object: 'event',
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: input.checkoutSessionId,
        object: 'checkout.session',
        mode: 'subscription',
        customer: input.customerId,
        subscription: input.subscriptionId,
        created: Math.floor(Date.now() / 1000),
        metadata: {
          attestor_account_id: input.accountId,
          attestor_tenant_digest: tenantWorkflowMetadataDigest(input.tenantId),
          attestor_workflow_id: input.workflowId,
          attestor_workflow_tier: input.workflowTier,
          attestor_consequence_pack: input.consequencePack,
          attestor_downstream_ref_digest: input.downstreamSystemRefDigest,
          attestor_policy_gate_digest: input.policyGatePathRefDigest,
        },
      },
    },
  });
}

function subscriptionUpdatedPayload(input: {
  eventId: string;
  accountId: string;
  tenantId: string;
  customerId: string;
  subscriptionId: string;
  status: string;
  priceId: string;
  workflowId: string;
  workflowTier: string;
  consequencePack: string;
  downstreamSystemRefDigest: string;
  policyGatePathRefDigest: string;
}): string {
  return JSON.stringify({
    id: input.eventId,
    object: 'event',
    type: 'customer.subscription.updated',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: input.subscriptionId,
        object: 'subscription',
        customer: input.customerId,
        status: input.status,
        metadata: {
          attestor_account_id: input.accountId,
          attestor_tenant_digest: tenantWorkflowMetadataDigest(input.tenantId),
          attestor_workflow_id: input.workflowId,
          attestor_workflow_tier: input.workflowTier,
          attestor_consequence_pack: input.consequencePack,
          attestor_downstream_ref_digest: input.downstreamSystemRefDigest,
          attestor_policy_gate_digest: input.policyGatePathRefDigest,
        },
        items: {
          object: 'list',
          data: [{ id: 'si_hosted_billing_001', price: { id: input.priceId } }],
        },
      },
    },
  });
}

function invoicePayload(input: {
  eventId: string;
  eventType: 'invoice.payment_failed' | 'invoice.paid';
  accountId: string;
  tenantId: string;
  customerId: string;
  subscriptionId: string;
  invoiceId: string;
  status: 'open' | 'paid';
  amountPaid: number;
  amountDue: number;
  priceId: string;
  workflowId: string;
  workflowTier: string;
  consequencePack: string;
  downstreamSystemRefDigest: string;
  policyGatePathRefDigest: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const workflowMetadata = {
    attestor_account_id: input.accountId,
    attestor_tenant_digest: tenantWorkflowMetadataDigest(input.tenantId),
    attestor_workflow_id: input.workflowId,
    attestor_workflow_tier: input.workflowTier,
    attestor_consequence_pack: input.consequencePack,
    attestor_downstream_ref_digest: input.downstreamSystemRefDigest,
    attestor_policy_gate_digest: input.policyGatePathRefDigest,
  };
  return JSON.stringify({
    id: input.eventId,
    object: 'event',
    type: input.eventType,
    created: now,
    data: {
      object: {
        id: input.invoiceId,
        object: 'invoice',
        customer: input.customerId,
        subscription: input.subscriptionId,
        status: input.status,
        currency: 'usd',
        amount_paid: input.amountPaid,
        amount_due: input.amountDue,
        billing_reason: 'subscription_cycle',
        metadata: workflowMetadata,
        subscription_details: {
          metadata: workflowMetadata,
        },
        status_transitions: {
          paid_at: input.status === 'paid' ? now : null,
        },
        lines: {
          object: 'list',
          has_more: false,
          data: [{
            id: `${input.invoiceId}_line_1`,
            object: 'line_item',
            invoice: input.invoiceId,
            amount: input.amountDue,
            subtotal: input.amountDue,
            currency: 'usd',
            description: 'Attestor Pro Workflow monthly',
            quantity: 1,
            subscription: input.subscriptionId,
            pricing: {
              type: 'price_details',
              price_details: {
                price: input.priceId,
              },
              unit_amount_decimal: String(input.amountDue),
            },
            period: {
              start: now - 3600,
              end: now,
            },
            parent: {
              type: 'subscription_item_details',
              invoice_item_details: null,
              subscription_item_details: {
                invoice_item: null,
                proration: false,
                proration_details: null,
                subscription: input.subscriptionId,
                subscription_item: 'si_hosted_billing_001',
              },
            },
            metadata: {},
          }],
        },
      },
    },
  });
}

async function main(): Promise<void> {
  const tempRoot = mkdtempSync(join(tmpdir(), 'attestor-hosted-stripe-'));
  let serverHandle: TestServerHandle | null = null;

  try {
    configureIsolatedStores(tempRoot);
    await resetStores();

    const port = await reservePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    serverHandle = startServer(port);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const signupRes = await postJson(`${baseUrl}/api/v1/auth/signup`, {
      accountName: `Hosted Billing ${suffix}`,
      email: `billing-owner-${suffix}@example.test`,
      displayName: 'Hosted Billing Owner',
      password: 'RidgeViolet9742!',
    });
    equal(signupRes.status, 201, 'Hosted billing: signup creates account');
    const accountAdminCookie = cookieHeaderFromResponse(signupRes);
    ok(Boolean(accountAdminCookie), 'Hosted billing: account admin session cookie issued');
    const accountMutationHeaders = {
      Cookie: accountAdminCookie!,
      'x-attestor-csrf': 'hosted-stripe-billing-convergence',
    } as const;
    const signupBody = await readJson(signupRes);
    const accountId = signupBody.account.id as string;
    const tenantId = signupBody.account.primaryTenantId as string;
    const initialApiKey = signupBody.initialKey.apiKey as string;

    const retiredCheckoutRes = await postJson(
      `${baseUrl}/api/v1/account/billing/checkout`,
      { planId: 'trial' },
      accountMutationHeaders,
    );
    equal(retiredCheckoutRes.status, 410, 'Hosted checkout: legacy account-plan checkout is retired');
    const retiredCheckoutBody = await readJson(retiredCheckoutRes);
    equal(retiredCheckoutBody.replacementRoute, '/api/v1/account/billing/workflows/checkout', 'Hosted checkout: retired route names workflow checkout replacement');

    const entitlementAfterCheckoutRes = await fetch(`${baseUrl}/api/v1/account/entitlement`, {
      headers: { Cookie: accountAdminCookie! },
    });
    equal(entitlementAfterCheckoutRes.status, 200, 'Hosted entitlement: readable after checkout start');
    const entitlementAfterCheckoutBody = await readJson(entitlementAfterCheckoutRes);
    equal(entitlementAfterCheckoutBody.entitlement.status, 'provisioned', 'Hosted entitlement: checkout start alone does not activate paid access');
    equal(entitlementAfterCheckoutBody.entitlement.effectivePlanId, 'trial', 'Hosted entitlement: trial account access remains active until workflow entitlement is used');

    const portalBeforeCustomerRes = await fetch(`${baseUrl}/api/v1/account/billing/portal`, {
      method: 'POST',
      headers: accountMutationHeaders,
    });
    equal(portalBeforeCustomerRes.status, 409, 'Hosted portal: Stripe customer is required before portal creation');

    const workflowId = `wf_hosted_${suffix.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`;
    const workflowTier = 'pro-workflow';
    const consequencePack = 'money-movement';
    const workflowCheckoutRes = await postJson(
      `${baseUrl}/api/v1/account/billing/workflows/checkout`,
      {
        workflowAction: 'create',
        workflowId,
        tier: workflowTier,
        consequencePack,
        downstreamSystemRef: 'customer_reporting_store.write',
        policyGatePathRef: 'customer_gate:finance-reporting',
      },
      {
        ...accountMutationHeaders,
        'Idempotency-Key': 'hosted-stripe-workflow-checkout-1',
      },
    );
    equal(workflowCheckoutRes.status, 200, 'Hosted workflow checkout: checkout session is created');
    const checkoutBody = await readJson(workflowCheckoutRes);
    equal(checkoutBody.workflowId, workflowId, 'Hosted workflow checkout: workflow id is echoed');
    equal(checkoutBody.tier, workflowTier, 'Hosted workflow checkout: tier is echoed');
    equal(checkoutBody.mock, true, 'Hosted workflow checkout: mock mode is visible');
    equal(checkoutBody.stripePriceId, 'price_pro_workflow_monthly', 'Hosted workflow checkout: workflow price is used');
    const downstreamSystemRefDigest = checkoutBody.entitlement.downstreamSystemRefDigest as string;
    const policyGatePathRefDigest = checkoutBody.entitlement.policyGatePathRefDigest as string;
    ok(downstreamSystemRefDigest.startsWith('sha256:'), 'Hosted workflow checkout: downstream ref is digested');
    ok(policyGatePathRefDigest.startsWith('sha256:'), 'Hosted workflow checkout: policy gate ref is digested');

    const workflowsAfterCheckoutRes = await fetch(`${baseUrl}/api/v1/account/billing/workflows`, {
      headers: { Cookie: accountAdminCookie! },
    });
    equal(workflowsAfterCheckoutRes.status, 200, 'Hosted workflow list: readable after checkout start');
    const workflowsAfterCheckoutBody = await readJson(workflowsAfterCheckoutRes);
    const pendingWorkflow = workflowsAfterCheckoutBody.workflows.find((entry: any) => entry.workflowId === workflowId);
    ok(Boolean(pendingWorkflow), 'Hosted workflow list: pending workflow is visible');
    equal(pendingWorkflow.status, 'incomplete', 'Hosted workflow list: checkout starts incomplete workflow entitlement');

    const customerId = `cus_hosted_${suffix.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`;
    const subscriptionId = `sub_hosted_${suffix.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`;
    const attachCustomerRes = await postJson(
      `${baseUrl}/api/v1/admin/accounts/${accountId}/billing/stripe`,
      { stripeCustomerId: customerId },
      {
        Authorization: 'Bearer hosted-stripe-billing-admin',
        'Idempotency-Key': 'hosted-stripe-customer-bind-1',
      },
    );
    equal(attachCustomerRes.status, 200, 'Hosted portal setup: Stripe customer can be bound without an account plan');

    const checkoutPayload = checkoutCompletedPayload({
      eventId: 'evt_hosted_checkout_completed',
      accountId,
      tenantId,
      checkoutSessionId: checkoutBody.checkoutSessionId,
      customerId,
      subscriptionId,
      workflowId,
      workflowTier,
      consequencePack,
      downstreamSystemRefDigest,
      policyGatePathRefDigest,
    });

    const invalidSignatureRes = await fetch(`${baseUrl}/api/v1/billing/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'bad-signature',
      },
      body: checkoutPayload,
    });
    equal(invalidSignatureRes.status, 400, 'Stripe webhook: invalid signature fails closed');

    const missingSignatureRes = await fetch(`${baseUrl}/api/v1/billing/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: checkoutPayload,
    });
    equal(missingSignatureRes.status, 400, 'Stripe webhook: missing signature fails closed');

    const checkoutWebhookRes = await postStripeWebhook(baseUrl, checkoutPayload);
    equal(checkoutWebhookRes.status, 200, 'Stripe webhook: checkout.session.completed is accepted');
    const checkoutWebhookBody = await readJson(checkoutWebhookRes);
    equal(checkoutWebhookBody.accountId, accountId, 'Stripe webhook: checkout completion maps account');
    equal(checkoutWebhookBody.workflowId, workflowId, 'Stripe webhook: checkout completion maps workflow');
    equal(checkoutWebhookBody.workflowTier, workflowTier, 'Stripe webhook: checkout completion maps workflow tier');
    equal(checkoutWebhookBody.workflowEntitlementStatus, 'incomplete', 'Stripe webhook: checkout completion leaves workflow incomplete until subscription lifecycle converges');

    const checkoutDuplicateRes = await postStripeWebhook(baseUrl, checkoutPayload);
    equal(checkoutDuplicateRes.status, 200, 'Stripe webhook: duplicate checkout event preserves 200');
    equal(checkoutDuplicateRes.headers.get('x-attestor-stripe-replay'), 'true', 'Stripe webhook: duplicate replay header is set');
    const checkoutDuplicateBody = await readJson(checkoutDuplicateRes);
    equal(checkoutDuplicateBody.duplicate, true, 'Stripe webhook: duplicate replay is explicit');

    const checkoutConflictPayload = checkoutCompletedPayload({
      eventId: 'evt_hosted_checkout_completed',
      accountId,
      tenantId,
      checkoutSessionId: checkoutBody.checkoutSessionId,
      customerId,
      subscriptionId,
      workflowId,
      workflowTier: 'starter-workflow',
      consequencePack,
      downstreamSystemRefDigest,
      policyGatePathRefDigest,
    });
    const checkoutConflictRes = await postStripeWebhook(baseUrl, checkoutConflictPayload);
    equal(checkoutConflictRes.status, 409, 'Stripe webhook: same event id with different payload is rejected');

    const summaryAfterCheckoutRes = await fetch(`${baseUrl}/api/v1/account`, {
      headers: { Authorization: `Bearer ${initialApiKey}` },
    });
    equal(summaryAfterCheckoutRes.status, 200, 'Hosted account: summary is readable after checkout convergence');
    const summaryAfterCheckoutBody = await readJson(summaryAfterCheckoutRes);
    equal(summaryAfterCheckoutBody.tenantContext.planId, 'trial', 'Hosted account: account plan remains trial after workflow checkout');
    equal(summaryAfterCheckoutBody.entitlement.effectivePlanId, 'trial', 'Hosted account: account entitlement remains trial after workflow checkout');

    const pastDuePayload = subscriptionUpdatedPayload({
      eventId: 'evt_hosted_subscription_past_due',
      accountId,
      tenantId,
      customerId,
      subscriptionId,
      status: 'past_due',
      priceId: 'price_pro_workflow_monthly',
      workflowId,
      workflowTier,
      consequencePack,
      downstreamSystemRefDigest,
      policyGatePathRefDigest,
    });
    const pastDueRes = await postStripeWebhook(baseUrl, pastDuePayload);
    equal(pastDueRes.status, 200, 'Stripe webhook: past_due subscription update is accepted');
    const pastDueBody = await readJson(pastDueRes);
    equal(pastDueBody.accountStatus, 'active', 'Stripe webhook: workflow past_due does not suspend the account plane');
    equal(pastDueBody.workflowEntitlementStatus, 'past_due', 'Stripe webhook: workflow entitlement becomes past_due');

    const accountUsageAfterWorkflowPastDueRes = await fetch(`${baseUrl}/api/v1/account/usage`, {
      headers: { Authorization: `Bearer ${initialApiKey}` },
    });
    equal(accountUsageAfterWorkflowPastDueRes.status, 200, 'Hosted enforcement: account trial usage remains readable after workflow past_due');

    const portalLoginRes = await postJson(`${baseUrl}/api/v1/auth/login`, {
      email: `billing-owner-${suffix}@example.test`,
      password: 'RidgeViolet9742!',
    });
    equal(portalLoginRes.status, 200, 'Hosted billing: account can re-login for billing self-service');
    const portalCookie = cookieHeaderFromResponse(portalLoginRes);
    ok(Boolean(portalCookie), 'Hosted billing: re-login issues session cookie');

    const portalRes = await fetch(`${baseUrl}/api/v1/account/billing/portal`, {
      method: 'POST',
      headers: {
        Cookie: portalCookie!,
        'x-attestor-csrf': 'hosted-stripe-billing-portal',
      },
    });
    equal(portalRes.status, 200, 'Hosted portal: account with Stripe customer can open billing portal');
    const portalBody = await readJson(portalRes);
    ok(String(portalBody.portalUrl).includes('/portal/'), 'Hosted portal: portal URL is returned');
    equal(portalBody.mock, true, 'Hosted portal: mock mode is visible');

    const pastDueReplayRes = await postStripeWebhook(baseUrl, pastDuePayload);
    equal(pastDueReplayRes.status, 200, 'Stripe webhook: duplicate past_due event preserves 200');
    equal(pastDueReplayRes.headers.get('x-attestor-stripe-replay'), 'true', 'Stripe webhook: duplicate past_due header is set');

    const activePayload = subscriptionUpdatedPayload({
      eventId: 'evt_hosted_subscription_active',
      accountId,
      tenantId,
      customerId,
      subscriptionId,
      status: 'active',
      priceId: 'price_pro_workflow_monthly',
      workflowId,
      workflowTier,
      consequencePack,
      downstreamSystemRefDigest,
      policyGatePathRefDigest,
    });
    const activeRes = await postStripeWebhook(baseUrl, activePayload);
    equal(activeRes.status, 200, 'Stripe webhook: active subscription update is accepted');
    const activeBody = await readJson(activeRes);
    equal(activeBody.accountStatus, 'active', 'Stripe webhook: active subscription restores account');
    equal(activeBody.workflowEntitlementStatus, 'active', 'Stripe webhook: workflow entitlement is active');

    const unblockedUsageRes = await fetch(`${baseUrl}/api/v1/account/usage`, {
      headers: { Authorization: `Bearer ${initialApiKey}` },
    });
    equal(unblockedUsageRes.status, 200, 'Hosted enforcement: active account can use tenant APIs');
    const unblockedUsageBody = await readJson(unblockedUsageRes);
    equal(unblockedUsageBody.tenantContext.planId, 'trial', 'Hosted enforcement: tenant API still sees trial account plan');
    equal(unblockedUsageBody.usage.quota, 10000, 'Hosted enforcement: trial account quota remains visible after workflow convergence');

    const workflowsAfterActiveRes = await fetch(`${baseUrl}/api/v1/account/billing/workflows`, {
      headers: { Cookie: accountAdminCookie! },
    });
    equal(workflowsAfterActiveRes.status, 200, 'Hosted workflow list: readable after subscription convergence');
    const workflowsAfterActiveBody = await readJson(workflowsAfterActiveRes);
    const activeWorkflow = workflowsAfterActiveBody.workflows.find((entry: any) => entry.workflowId === workflowId);
    equal(activeWorkflow.status, 'active', 'Hosted workflow list: workflow entitlement is active');
    equal(activeWorkflow.tier, workflowTier, 'Hosted workflow list: workflow tier remains pro-workflow');

    const invoiceFailedRes = await postStripeWebhook(baseUrl, invoicePayload({
      eventId: 'evt_hosted_invoice_failed',
      eventType: 'invoice.payment_failed',
      accountId,
      tenantId,
      customerId,
      subscriptionId,
      invoiceId: 'in_hosted_failed',
      status: 'open',
      amountPaid: 0,
      amountDue: 5000,
      priceId: 'price_pro_workflow_monthly',
      workflowId,
      workflowTier,
      consequencePack,
      downstreamSystemRefDigest,
      policyGatePathRefDigest,
    }));
    equal(invoiceFailedRes.status, 200, 'Stripe webhook: invoice.payment_failed is accepted');
    const invoiceFailedBody = await readJson(invoiceFailedRes);
    equal(invoiceFailedBody.workflowId, workflowId, 'Stripe webhook: failed invoice maps workflow');
    equal(invoiceFailedBody.workflowEntitlementStatus, 'past_due', 'Stripe webhook: failed invoice marks workflow past_due');

    const invoicePaidRes = await postStripeWebhook(baseUrl, invoicePayload({
      eventId: 'evt_hosted_invoice_paid',
      eventType: 'invoice.paid',
      accountId,
      tenantId,
      customerId,
      subscriptionId,
      invoiceId: 'in_hosted_paid',
      status: 'paid',
      amountPaid: 5000,
      amountDue: 5000,
      priceId: 'price_pro_workflow_monthly',
      workflowId,
      workflowTier,
      consequencePack,
      downstreamSystemRefDigest,
      policyGatePathRefDigest,
    }));
    equal(invoicePaidRes.status, 200, 'Stripe webhook: invoice.paid is accepted');
    const invoicePaidBody = await readJson(invoicePaidRes);
    equal(invoicePaidBody.workflowId, workflowId, 'Stripe webhook: paid invoice maps workflow');
    equal(invoicePaidBody.workflowEntitlementStatus, 'active', 'Stripe webhook: paid invoice restores workflow active');

    ok(passed > 0, 'Hosted Stripe billing convergence flow: tests executed');
    console.log(`\nHosted Stripe billing convergence flow tests: ${passed} passed, 0 failed`);
  } finally {
    serverHandle?.close();
    await shutdownTenantRuntimeBackends();
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('\nHosted Stripe billing convergence flow tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
