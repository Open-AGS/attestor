import {
  BASE,
  cookieHeaderFromResponse,
  csrfHeaders,
  ok,
  stripe,
} from './helpers.js';
import type { LiveApiHostedContext } from './helpers.js';
import { tenantWorkflowMetadataDigest } from '../../src/service/workflow-entitlement-store.js';

const workflowId = 'wf_live_api_billing_001';
const workflowTier = 'pro-workflow';
const consequencePack = 'money-movement';
const stripeCustomerId = 'cus_account_001';
const stripeSubscriptionId = 'sub_workflow_account_001';
const stripePriceId = 'price_pro_workflow_monthly';

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function workflowMetadata(input: {
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
    attestor_consequence_pack: consequencePack,
    attestor_downstream_ref_digest: input.downstreamSystemRefDigest,
    attestor_policy_gate_digest: input.policyGatePathRefDigest,
  };
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

async function postStripeWebhook(payload: string): Promise<Response> {
  return fetch(`${BASE}/api/v1/billing/stripe/webhook`, {
    method: 'POST',
    headers: signedStripeHeaders(payload),
    body: payload,
  });
}

function checkoutCompletedPayload(input: {
  eventId: string;
  accountId: string;
  tenantId: string;
  checkoutSessionId: string;
  downstreamSystemRefDigest: string;
  policyGatePathRefDigest: string;
}): string {
  return JSON.stringify({
    id: input.eventId,
    object: 'event',
    type: 'checkout.session.completed',
    created: nowSeconds(),
    data: {
      object: {
        id: input.checkoutSessionId,
        object: 'checkout.session',
        mode: 'subscription',
        customer: stripeCustomerId,
        subscription: stripeSubscriptionId,
        created: nowSeconds(),
        metadata: workflowMetadata(input),
      },
    },
  });
}

function subscriptionUpdatedPayload(input: {
  eventId: string;
  status: 'active' | 'past_due';
  accountId: string;
  tenantId: string;
  downstreamSystemRefDigest: string;
  policyGatePathRefDigest: string;
}): string {
  return JSON.stringify({
    id: input.eventId,
    object: 'event',
    type: 'customer.subscription.updated',
    created: nowSeconds(),
    data: {
      object: {
        id: stripeSubscriptionId,
        object: 'subscription',
        customer: stripeCustomerId,
        status: input.status,
        metadata: workflowMetadata(input),
        items: {
          object: 'list',
          data: [{
            id: 'si_workflow_account_001',
            price: { id: stripePriceId },
          }],
        },
      },
    },
  });
}

function invoicePayload(input: {
  eventId: string;
  eventType: 'invoice.payment_failed' | 'invoice.paid';
  invoiceId: string;
  invoiceStatus: 'open' | 'paid';
  amountPaid: number;
  amountDue: number;
  accountId: string;
  tenantId: string;
  downstreamSystemRefDigest: string;
  policyGatePathRefDigest: string;
}): string {
  return JSON.stringify({
    id: input.eventId,
    object: 'event',
    type: input.eventType,
    created: nowSeconds(),
    data: {
      object: {
        id: input.invoiceId,
        object: 'invoice',
        customer: stripeCustomerId,
        subscription: stripeSubscriptionId,
        status: input.invoiceStatus,
        currency: 'usd',
        amount_paid: input.amountPaid,
        amount_due: input.amountDue,
        billing_reason: 'subscription_cycle',
        metadata: workflowMetadata(input),
        subscription_details: {
          metadata: workflowMetadata(input),
        },
        status_transitions: {
          paid_at: input.invoiceStatus === 'paid' ? nowSeconds() : null,
        },
        lines: {
          object: 'list',
          data: [{
            id: `${input.invoiceId}_line_1`,
            amount: input.amountDue,
            currency: 'usd',
            price: { id: stripePriceId },
            parent: {
              subscription_item_details: {
                subscription_item: 'si_workflow_account_001',
              },
            },
          }],
        },
      },
    },
  });
}

export async function runHostedBillingObservabilityFlow(ctx: LiveApiHostedContext): Promise<void> {
  const createAccountBody = ctx.createAccountBody;
  const listedAccount = ctx.listedAccount;
  let accountAdminCookie = ctx.accountAdminCookie;
  let billingAdminCookie = ctx.billingAdminCookie;
  const readOnlyCookie = ctx.readOnlyCookie;
  const accountId = createAccountBody.account.id as string;
  const tenantId = createAccountBody.account.primaryTenantId as string;

  const retiredCheckoutRes = await fetch(`${BASE}/api/v1/account/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeaders(accountAdminCookie!),
    },
    body: JSON.stringify({ planId: 'trial' }),
  });
  ok(retiredCheckoutRes.status === 410, 'Account Billing: legacy account-plan checkout is retired');
  const retiredCheckoutBody = await retiredCheckoutRes.json() as any;
  ok(retiredCheckoutBody.replacementRoute === '/api/v1/account/billing/workflows/checkout', 'Account Billing: retired checkout points to workflow checkout');

  const entitlementAfterRetiredCheckoutRes = await fetch(`${BASE}/api/v1/account/entitlement`, {
    headers: csrfHeaders(accountAdminCookie!),
  });
  ok(entitlementAfterRetiredCheckoutRes.status === 200, 'Account Entitlement: readable after retired checkout attempt');
  const entitlementAfterRetiredCheckoutBody = await entitlementAfterRetiredCheckoutRes.json() as any;
  ok(entitlementAfterRetiredCheckoutBody.entitlement.status === 'provisioned', 'Account Entitlement: retired checkout does not activate paid entitlement');
  ok(entitlementAfterRetiredCheckoutBody.entitlement.effectivePlanId === 'trial', 'Account Entitlement: trial remains the account-level evaluation plan');

  const portalMissingCustomerRes = await fetch(`${BASE}/api/v1/account/billing/portal`, {
    method: 'POST',
    headers: csrfHeaders(billingAdminCookie!),
  });
  ok(portalMissingCustomerRes.status === 409, 'Account Billing: portal requires Stripe customer');

  const readOnlyCheckoutRes = await fetch(`${BASE}/api/v1/account/billing/workflows/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeaders(readOnlyCookie!),
      'Idempotency-Key': 'workflow-checkout-read-only-1',
    },
    body: JSON.stringify({
      workflowAction: 'create',
      workflowId,
      tier: workflowTier,
      consequencePack,
      downstreamSystemRef: 'customer_reporting_store.write',
      policyGatePathRef: 'customer_gate:finance-reporting',
    }),
  });
  ok(readOnlyCheckoutRes.status === 403, 'RBAC: read_only user blocked from workflow billing checkout');

  ok(listedAccount.status === 'active', 'Admin Accounts: new account starts active');
  ok(listedAccount.billing.provider === null, 'Admin Accounts: billing starts empty');

  const workflowCheckoutRes = await fetch(`${BASE}/api/v1/account/billing/workflows/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeaders(accountAdminCookie!),
      'Idempotency-Key': 'workflow-checkout-live-api-1',
    },
    body: JSON.stringify({
      workflowAction: 'create',
      workflowId,
      tier: workflowTier,
      consequencePack,
      downstreamSystemRef: 'customer_reporting_store.write',
      policyGatePathRef: 'customer_gate:finance-reporting',
    }),
  });
  ok(workflowCheckoutRes.status === 200, 'Account Workflow Billing: checkout session created');
  const workflowCheckoutBody = await workflowCheckoutRes.json() as any;
  ok(workflowCheckoutBody.workflowId === workflowId, 'Account Workflow Billing: workflow id echoed');
  ok(workflowCheckoutBody.tier === workflowTier, 'Account Workflow Billing: tier echoed');
  ok(workflowCheckoutBody.mock === true, 'Account Workflow Billing: mock checkout surfaced');
  ok(workflowCheckoutBody.stripePriceId === stripePriceId, 'Account Workflow Billing: workflow Stripe price used');
  const downstreamSystemRefDigest = workflowCheckoutBody.entitlement.downstreamSystemRefDigest as string;
  const policyGatePathRefDigest = workflowCheckoutBody.entitlement.policyGatePathRefDigest as string;
  ok(downstreamSystemRefDigest.startsWith('sha256:'), 'Account Workflow Billing: downstream ref is digest-only');
  ok(policyGatePathRefDigest.startsWith('sha256:'), 'Account Workflow Billing: policy gate ref is digest-only');

  const workflowsAfterCheckoutRes = await fetch(`${BASE}/api/v1/account/billing/workflows`, {
    headers: csrfHeaders(accountAdminCookie!),
  });
  ok(workflowsAfterCheckoutRes.status === 200, 'Account Workflow Billing: workflow list readable');
  const workflowsAfterCheckoutBody = await workflowsAfterCheckoutRes.json() as any;
  const pendingWorkflow = workflowsAfterCheckoutBody.workflows.find((entry: any) => entry.workflowId === workflowId);
  ok(Boolean(pendingWorkflow), 'Account Workflow Billing: pending workflow entitlement is visible');
  ok(pendingWorkflow.status === 'incomplete', 'Account Workflow Billing: checkout creates incomplete workflow entitlement');

  const attachBillingRes = await fetch(`${BASE}/api/v1/admin/accounts/${accountId}/billing/stripe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-secret',
      'Idempotency-Key': 'idem-account-billing-customer-attach-1',
    },
    body: JSON.stringify({
      stripeCustomerId,
    }),
  });
  ok(attachBillingRes.status === 200, 'Admin Accounts: attach Stripe customer status 200');
  const attachBillingBody = await attachBillingRes.json() as any;
  ok(attachBillingBody.account.billing.provider === 'stripe', 'Admin Accounts: stripe provider persisted');
  ok(attachBillingBody.account.billing.stripeCustomerId === stripeCustomerId, 'Admin Accounts: stripe customer persisted');
  ok(attachBillingBody.account.billing.stripeSubscriptionId === null, 'Admin Accounts: account-plan subscription remains unset');

  const attachBillingReplayRes = await fetch(`${BASE}/api/v1/admin/accounts/${accountId}/billing/stripe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-secret',
      'Idempotency-Key': 'idem-account-billing-customer-attach-1',
    },
    body: JSON.stringify({
      stripeCustomerId,
    }),
  });
  ok(attachBillingReplayRes.status === 200, 'Admin Accounts: attach stripe replay preserves status');
  ok(attachBillingReplayRes.headers.get('x-attestor-idempotent-replay') === 'true', 'Admin Accounts: attach stripe replay header set');

  const checkoutPayload = checkoutCompletedPayload({
    eventId: 'evt_workflow_checkout_account_001_completed',
    accountId,
    tenantId,
    checkoutSessionId: workflowCheckoutBody.checkoutSessionId,
    downstreamSystemRefDigest,
    policyGatePathRefDigest,
  });
  const invalidSignatureRes = await fetch(`${BASE}/api/v1/billing/stripe/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': 'bad-signature',
    },
    body: checkoutPayload,
  });
  ok(invalidSignatureRes.status === 400, 'Stripe Webhook: invalid signature fails closed');

  const missingSignatureRes = await fetch(`${BASE}/api/v1/billing/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: checkoutPayload,
  });
  ok(missingSignatureRes.status === 400, 'Stripe Webhook: missing signature fails closed');

  const checkoutCompletedRes = await postStripeWebhook(checkoutPayload);
  ok(checkoutCompletedRes.status === 200, 'Stripe Webhook: workflow checkout.session.completed accepted');
  const checkoutCompletedBody = await checkoutCompletedRes.json() as any;
  ok(checkoutCompletedBody.accountId === accountId, 'Stripe Webhook: workflow checkout maps account');
  ok(checkoutCompletedBody.workflowId === workflowId, 'Stripe Webhook: workflow checkout maps workflow id');
  ok(checkoutCompletedBody.workflowTier === workflowTier, 'Stripe Webhook: workflow checkout maps workflow tier');
  ok(checkoutCompletedBody.workflowEntitlementStatus === 'incomplete', 'Stripe Webhook: workflow checkout remains incomplete until subscription convergence');

  const checkoutReplayRes = await postStripeWebhook(checkoutPayload);
  ok(checkoutReplayRes.status === 200, 'Stripe Webhook: duplicate checkout preserves 200');
  ok(checkoutReplayRes.headers.get('x-attestor-stripe-replay') === 'true', 'Stripe Webhook: duplicate checkout replay header set');
  const checkoutReplayBody = await checkoutReplayRes.json() as any;
  ok(checkoutReplayBody.duplicate === true, 'Stripe Webhook: duplicate checkout replay flagged');

  const pastDuePayload = subscriptionUpdatedPayload({
    eventId: 'evt_workflow_sub_account_001_past_due',
    status: 'past_due',
    accountId,
    tenantId,
    downstreamSystemRefDigest,
    policyGatePathRefDigest,
  });
  const pastDueWebhookRes = await postStripeWebhook(pastDuePayload);
  ok(pastDueWebhookRes.status === 200, 'Stripe Webhook: workflow past_due event accepted');
  const pastDueWebhookBody = await pastDueWebhookRes.json() as any;
  ok(pastDueWebhookBody.accountStatus === 'active', 'Stripe Webhook: workflow past_due does not suspend the account plane');
  ok(pastDueWebhookBody.workflowEntitlementStatus === 'past_due', 'Stripe Webhook: workflow entitlement marked past_due');

  const allowedAfterWorkflowPastDueRes = await fetch(`${BASE}/api/v1/account/usage`, {
    headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
  });
  ok(allowedAfterWorkflowPastDueRes.status === 200, 'Account Usage: trial account usage remains readable after workflow past_due');

  const portalRes = await fetch(`${BASE}/api/v1/account/billing/portal`, {
    method: 'POST',
    headers: csrfHeaders(billingAdminCookie!),
  });
  ok(portalRes.status === 200, 'Account Billing: account with Stripe customer can open billing portal');
  const portalBody = await portalRes.json() as any;
  ok(String(portalBody.portalUrl).includes('/portal/'), 'Account Billing: portal URL returned');
  ok(portalBody.mock === true, 'Account Billing: mock portal surfaced');

  const pastDueReplayRes = await postStripeWebhook(pastDuePayload);
  ok(pastDueReplayRes.status === 200, 'Stripe Webhook: duplicate past_due event preserves 200');
  ok(pastDueReplayRes.headers.get('x-attestor-stripe-replay') === 'true', 'Stripe Webhook: duplicate past_due replay header set');

  const activePayload = subscriptionUpdatedPayload({
    eventId: 'evt_workflow_sub_account_001_active',
    status: 'active',
    accountId,
    tenantId,
    downstreamSystemRefDigest,
    policyGatePathRefDigest,
  });
  const activeWebhookRes = await postStripeWebhook(activePayload);
  ok(activeWebhookRes.status === 200, 'Stripe Webhook: workflow active event accepted');
  const activeWebhookBody = await activeWebhookRes.json() as any;
  ok(activeWebhookBody.accountStatus === 'active', 'Stripe Webhook: workflow active leaves account active');
  ok(activeWebhookBody.workflowEntitlementStatus === 'active', 'Stripe Webhook: workflow entitlement restored active');

  const usageAfterActiveWorkflowRes = await fetch(`${BASE}/api/v1/account/usage`, {
    headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
  });
  ok(usageAfterActiveWorkflowRes.status === 200, 'Account Usage: active account key works after workflow convergence');
  const usageAfterActiveWorkflowBody = await usageAfterActiveWorkflowRes.json() as any;
  ok(usageAfterActiveWorkflowBody.tenantContext.planId === 'trial', 'Account Usage: account plan remains trial after workflow convergence');
  ok(usageAfterActiveWorkflowBody.usage.quota === 10000, 'Account Usage: trial account quota remains the account-level quota');

  const workflowsAfterActiveRes = await fetch(`${BASE}/api/v1/account/billing/workflows`, {
    headers: csrfHeaders(accountAdminCookie!),
  });
  ok(workflowsAfterActiveRes.status === 200, 'Account Workflow Billing: workflow list readable after subscription convergence');
  const workflowsAfterActiveBody = await workflowsAfterActiveRes.json() as any;
  const activeWorkflow = workflowsAfterActiveBody.workflows.find((entry: any) => entry.workflowId === workflowId);
  ok(activeWorkflow.status === 'active', 'Account Workflow Billing: workflow entitlement is active');
  ok(activeWorkflow.tier === workflowTier, 'Account Workflow Billing: workflow tier remains pro-workflow');
  ok(activeWorkflow.stripePriceId === stripePriceId, 'Account Workflow Billing: workflow price remains workflow-specific');

  const invoiceFailedRes = await postStripeWebhook(invoicePayload({
    eventId: 'evt_workflow_invoice_account_001_failed',
    eventType: 'invoice.payment_failed',
    invoiceId: 'in_workflow_account_001_failed',
    invoiceStatus: 'open',
    amountPaid: 0,
    amountDue: 99900,
    accountId,
    tenantId,
    downstreamSystemRefDigest,
    policyGatePathRefDigest,
  }));
  ok(invoiceFailedRes.status === 200, 'Stripe Webhook: workflow invoice.payment_failed accepted');
  const invoiceFailedBody = await invoiceFailedRes.json() as any;
  ok(invoiceFailedBody.workflowId === workflowId, 'Stripe Webhook: failed invoice maps workflow');
  ok(invoiceFailedBody.workflowEntitlementStatus === 'past_due', 'Stripe Webhook: failed invoice marks workflow past_due');

  const invoicePaidRes = await postStripeWebhook(invoicePayload({
    eventId: 'evt_workflow_invoice_account_001_paid',
    eventType: 'invoice.paid',
    invoiceId: 'in_workflow_account_001_paid',
    invoiceStatus: 'paid',
    amountPaid: 99900,
    amountDue: 99900,
    accountId,
    tenantId,
    downstreamSystemRefDigest,
    policyGatePathRefDigest,
  }));
  ok(invoicePaidRes.status === 200, 'Stripe Webhook: workflow invoice.paid accepted');
  const invoicePaidBody = await invoicePaidRes.json() as any;
  ok(invoicePaidBody.workflowId === workflowId, 'Stripe Webhook: paid invoice maps workflow');
  ok(invoicePaidBody.workflowEntitlementStatus === 'active', 'Stripe Webhook: paid invoice restores workflow active');

  const billingSettingsPageRes = await fetch(`${BASE}/settings/billing`, {
    headers: csrfHeaders(billingAdminCookie!),
  });
  ok(billingSettingsPageRes.status === 200, 'Billing pages: billing settings return surface responds');
  const billingSettingsPage = await billingSettingsPageRes.text();
  ok(billingSettingsPage.includes('Billing settings'), 'Billing pages: billing settings return surface explains next steps');

  const accountSummaryAfterWorkflowRes = await fetch(`${BASE}/api/v1/account`, {
    headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
  });
  ok(accountSummaryAfterWorkflowRes.status === 200, 'Account API: summary still available after workflow billing lifecycle');
  const accountSummaryAfterWorkflowBody = await accountSummaryAfterWorkflowRes.json() as any;
  ok(accountSummaryAfterWorkflowBody.account.billing.stripeCustomerId === stripeCustomerId, 'Account API: summary shows Stripe customer');
  ok(accountSummaryAfterWorkflowBody.account.billing.stripeSubscriptionId === null, 'Account API: summary does not project workflow subscription as account plan');
  ok(accountSummaryAfterWorkflowBody.tenantContext.planId === 'trial', 'Account API: account plan remains trial after workflow billing');
  ok(accountSummaryAfterWorkflowBody.entitlement.effectivePlanId === 'trial', 'Account API: account entitlement remains trial after workflow billing');

  const accountEntitlementAfterWorkflowRes = await fetch(`${BASE}/api/v1/account/entitlement`, {
    headers: csrfHeaders(billingAdminCookie!),
  });
  ok(accountEntitlementAfterWorkflowRes.status === 200, 'Account Entitlement: status 200 after workflow lifecycle');
  const accountEntitlementAfterWorkflowBody = await accountEntitlementAfterWorkflowRes.json() as any;
  ok(accountEntitlementAfterWorkflowBody.entitlement.effectivePlanId === 'trial', 'Account Entitlement: account-level entitlement stays trial');
  ok(accountEntitlementAfterWorkflowBody.entitlement.accessEnabled === true, 'Account Entitlement: account-level access remains enabled');

  const accountBillingExportRes = await fetch(`${BASE}/api/v1/account/billing/export?limit=5`, {
    headers: csrfHeaders(billingAdminCookie!),
  });
  ok(accountBillingExportRes.status === 200, 'Account Billing Export: json status 200');
  const accountBillingExportBody = await accountBillingExportRes.json() as any;
  ok(accountBillingExportBody.accountId === accountId, 'Account Billing Export: account id matches');
  ok(accountBillingExportBody.entitlement.effectivePlanId === 'trial', 'Account Billing Export: account entitlement remains trial');

  const accountBillingExportCsvRes = await fetch(`${BASE}/api/v1/account/billing/export?format=csv&limit=5`, {
    headers: csrfHeaders(billingAdminCookie!),
  });
  ok(accountBillingExportCsvRes.status === 200, 'Account Billing Export: csv status 200');
  ok((accountBillingExportCsvRes.headers.get('content-type') ?? '').includes('text/csv'), 'Account Billing Export: csv content-type');

  const accountBillingReconciliationRes = await fetch(`${BASE}/api/v1/account/billing/reconciliation?limit=5`, {
    headers: csrfHeaders(billingAdminCookie!),
  });
  ok(accountBillingReconciliationRes.status === 200, 'Account Billing Reconciliation: status 200');

  const adminBillingExportNoAuth = await fetch(`${BASE}/api/v1/admin/accounts/${accountId}/billing/export`);
  ok(adminBillingExportNoAuth.status === 401, 'Admin Account Billing Export: auth required');

  const adminBillingExportRes = await fetch(`${BASE}/api/v1/admin/accounts/${accountId}/billing/export?limit=5`, {
    headers: { Authorization: 'Bearer admin-secret' },
  });
  ok(adminBillingExportRes.status === 200, 'Admin Account Billing Export: json status 200');

  const adminBillingReconciliationRes = await fetch(`${BASE}/api/v1/admin/accounts/${accountId}/billing/reconciliation?limit=5`, {
    headers: { Authorization: 'Bearer admin-secret' },
  });
  ok(adminBillingReconciliationRes.status === 200, 'Admin Account Billing Reconciliation: status 200');

  const adminBillingExportCsvRes = await fetch(`${BASE}/api/v1/admin/accounts/${accountId}/billing/export?format=csv&limit=5`, {
    headers: { Authorization: 'Bearer admin-secret' },
  });
  ok(adminBillingExportCsvRes.status === 200, 'Admin Account Billing Export: csv status 200');
  ok((adminBillingExportCsvRes.headers.get('content-disposition') ?? '').includes(`${accountId}-billing-export.csv`), 'Admin Account Billing Export: csv attachment filename');

  const billingAdminReLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'billing@account.example',
      password: 'T8!nR3yM6qW1cZ5',
    }),
  });
  ok(billingAdminReLoginRes.status === 200, 'Auth: billing_admin can re-login after workflow billing lifecycle');
  billingAdminCookie = cookieHeaderFromResponse(billingAdminReLoginRes);
  ok(Boolean(billingAdminCookie), 'Auth: billing_admin workflow lifecycle re-login sets session cookie');

  const accountAdminReLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner@account.example',
      password: 'BootstrapPass123!',
    }),
  });
  ok(accountAdminReLoginRes.status === 200, 'Auth: account_admin can re-login after workflow billing lifecycle');
  accountAdminCookie = cookieHeaderFromResponse(accountAdminReLoginRes);
  ok(Boolean(accountAdminCookie), 'Auth: account_admin workflow lifecycle re-login sets session cookie');

  ctx.accountAdminCookie = accountAdminCookie;
  ctx.billingAdminCookie = billingAdminCookie;
}
