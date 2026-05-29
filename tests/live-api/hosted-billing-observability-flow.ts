import {
  ATTESTOR_SERVICE_VERSION,
  BASE,
  COUNTERPARTY_FIXTURE,
  COUNTERPARTY_INTENT,
  COUNTERPARTY_REPORT,
  COUNTERPARTY_REPORT_CONTRACT,
  COUNTERPARTY_SQL,
  JSZip,
  cookieHeaderFromResponse,
  csrfHeaders,
  currentTotpStepIndex,
  generateCurrentTotpCode,
  issueTenantApiKey,
  metricSamples,
  ok,
  readAsyncDeadLetterStoreSnapshot,
  readFileSync,
  readUsageLedgerSnapshot,
  revokeTenantApiKey,
  stripe,
  unsignedBearerToken,
  waitForJobStatus,
  waitForRateLimitWindowHead,
  waitForTotpStepAfter,
} from './helpers.js';
import type { LiveApiHostedContext } from './helpers.js';

export async function runHostedBillingObservabilityFlow(ctx: LiveApiHostedContext): Promise<void> {
      const createAccountBody = ctx.createAccountBody;
      const listedAccount = ctx.listedAccount;
      let accountAdminCookie = ctx.accountAdminCookie;
      let billingAdminCookie = ctx.billingAdminCookie;
      const readOnlyCookie = ctx.readOnlyCookie;
      const checkoutMissingKeyRes = await fetch(`${BASE}/api/v1/account/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(accountAdminCookie!),
        },
        body: JSON.stringify({ planId: 'pro' }),
      });
      ok(checkoutMissingKeyRes.status === 400, 'Account Billing: checkout requires Idempotency-Key');

      const checkoutNoPlanRes = await fetch(`${BASE}/api/v1/account/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(accountAdminCookie!),
          'Idempotency-Key': 'checkout-no-plan-1',
        },
        body: JSON.stringify({}),
      });
      ok(checkoutNoPlanRes.status === 400, 'Account Billing: checkout requires planId');

      const checkoutRes = await fetch(`${BASE}/api/v1/account/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(accountAdminCookie!),
          'Idempotency-Key': 'checkout-account-1',
        },
        body: JSON.stringify({ planId: 'pro' }),
      });
      ok(checkoutRes.status === 200, 'Account Billing: checkout status 200');
      const checkoutBody = await checkoutRes.json() as any;
      ok(checkoutBody.planId === 'pro', 'Account Billing: checkout plan echoed');
      ok(checkoutBody.stripePriceId === 'price_pro_monthly', 'Account Billing: checkout uses mapped Stripe price');
      ok(String(checkoutBody.checkoutUrl).includes('/checkout/'), 'Account Billing: checkout URL returned');
      ok(checkoutBody.mock === true, 'Account Billing: checkout mock mode surfaced');
      ok(checkoutRes.headers.get('x-attestor-idempotency-key') === 'checkout-account-1', 'Account Billing: checkout echoes idempotency key');

      const entitlementAfterCheckoutRes = await fetch(`${BASE}/api/v1/account/entitlement`, {
        headers: csrfHeaders(accountAdminCookie!),
      });
      ok(entitlementAfterCheckoutRes.status === 200, 'Account Entitlement: readable after checkout');
      const entitlementAfterCheckoutBody = await entitlementAfterCheckoutRes.json() as any;
      ok(entitlementAfterCheckoutBody.entitlement.status === 'provisioned', 'Account Entitlement: checkout creation alone does not activate entitlement');

      const checkoutReplayRes = await fetch(`${BASE}/api/v1/account/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(accountAdminCookie!),
          'Idempotency-Key': 'checkout-account-1',
        },
        body: JSON.stringify({ planId: 'pro' }),
      });
      ok(checkoutReplayRes.status === 200, 'Account Billing: checkout replay preserves status 200');
      const checkoutReplayBody = await checkoutReplayRes.json() as any;
      ok(checkoutReplayBody.checkoutSessionId === checkoutBody.checkoutSessionId, 'Account Billing: checkout replay returns same session id');
      ok(checkoutReplayBody.checkoutUrl === checkoutBody.checkoutUrl, 'Account Billing: checkout replay returns same URL');

      const portalMissingCustomerRes = await fetch(`${BASE}/api/v1/account/billing/portal`, {
        method: 'POST',
        headers: csrfHeaders(billingAdminCookie!),
      });
      ok(portalMissingCustomerRes.status === 409, 'Account Billing: portal requires Stripe customer');

      const readOnlyCheckoutRes = await fetch(`${BASE}/api/v1/account/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(readOnlyCookie!),
          'Idempotency-Key': 'checkout-read-only-1',
        },
        body: JSON.stringify({ planId: 'pro' }),
      });
      ok(readOnlyCheckoutRes.status === 403, 'RBAC: read_only user blocked from billing checkout');

      ok(listedAccount.status === 'active', 'Admin Accounts: new account starts active');
      ok(listedAccount.billing.provider === null, 'Admin Accounts: billing starts empty');

      const attachBillingRes = await fetch(`${BASE}/api/v1/admin/accounts/${createAccountBody.account.id}/billing/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-account-billing-attach-1',
        },
        body: JSON.stringify({
          stripeCustomerId: 'cus_account_001',
          stripeSubscriptionId: 'sub_account_001',
          stripeSubscriptionStatus: 'active',
          stripePriceId: 'price_pro_monthly',
        }),
      });
      ok(attachBillingRes.status === 200, 'Admin Accounts: attach stripe billing status 200');
      const attachBillingBody = await attachBillingRes.json() as any;
      ok(attachBillingBody.account.billing.provider === 'stripe', 'Admin Accounts: stripe provider persisted');
      ok(attachBillingBody.account.billing.stripeCustomerId === 'cus_account_001', 'Admin Accounts: stripe customer persisted');
      ok(attachBillingBody.account.billing.stripeSubscriptionId === 'sub_account_001', 'Admin Accounts: stripe subscription persisted');
      ok(attachBillingBody.account.billing.stripeSubscriptionStatus === 'active', 'Admin Accounts: stripe status persisted');

      const attachBillingReplayRes = await fetch(`${BASE}/api/v1/admin/accounts/${createAccountBody.account.id}/billing/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-account-billing-attach-1',
        },
        body: JSON.stringify({
          stripeCustomerId: 'cus_account_001',
          stripeSubscriptionId: 'sub_account_001',
          stripeSubscriptionStatus: 'active',
          stripePriceId: 'price_pro_monthly',
        }),
      });
      ok(attachBillingReplayRes.status === 200, 'Admin Accounts: attach stripe replay preserves status');
      ok(attachBillingReplayRes.headers.get('x-attestor-idempotent-replay') === 'true', 'Admin Accounts: attach stripe replay header set');

      const checkoutCompletedPayload = JSON.stringify({
        id: 'evt_checkout_account_001_completed',
        object: 'event',
        type: 'checkout.session.completed',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: checkoutBody.checkoutSessionId,
            object: 'checkout.session',
            mode: 'subscription',
            customer: 'cus_account_001',
            subscription: 'sub_account_001',
            created: Math.floor(Date.now() / 1000),
            metadata: {
              attestorAccountId: createAccountBody.account.id,
              attestorTenantId: createAccountBody.account.primaryTenantId,
              attestorPlanId: 'pro',
            },
          },
        },
      });
      const checkoutCompletedSignature = stripe.webhooks.generateTestHeaderString({
        payload: checkoutCompletedPayload,
        secret: process.env.STRIPE_WEBHOOK_SECRET!,
      });
      const checkoutCompletedRes = await fetch(`${BASE}/api/v1/billing/stripe/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': checkoutCompletedSignature,
        },
        body: checkoutCompletedPayload,
      });
      ok(checkoutCompletedRes.status === 200, 'Stripe Webhook: checkout.session.completed accepted');
      const checkoutCompletedBody = await checkoutCompletedRes.json() as any;
      ok(checkoutCompletedBody.billing.lastCheckoutSessionId === checkoutBody.checkoutSessionId, 'Stripe Webhook: checkout completion stores session id');
      ok(checkoutCompletedBody.billing.lastCheckoutPlanId === 'pro', 'Stripe Webhook: checkout completion stores target plan');
      ok(typeof checkoutCompletedBody.billing.lastCheckoutCompletedAt === 'string', 'Stripe Webhook: checkout completion stores completed timestamp');
      ok(checkoutCompletedBody.mappedPlanId === 'pro', 'Stripe Webhook: checkout completion maps hosted plan');

      const suspendAccountRes = await fetch(`${BASE}/api/v1/admin/accounts/${createAccountBody.account.id}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-account-suspend-1',
        },
        body: JSON.stringify({ reason: 'manual hold' }),
      });
      ok(suspendAccountRes.status === 200, 'Admin Accounts: suspend status 200');
      const suspendAccountBody = await suspendAccountRes.json() as any;
      ok(suspendAccountBody.account.status === 'suspended', 'Admin Accounts: suspend marks account suspended');
      ok(typeof suspendAccountBody.account.suspendedAt === 'string', 'Admin Accounts: suspend captures suspendedAt');

      const suspendedAccountUsageRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
      });
      ok(suspendedAccountUsageRes.status === 403, 'Admin Accounts: suspended account key blocked');
      const suspendedAccountUsageBody = await suspendedAccountUsageRes.json() as any;
      ok(suspendedAccountUsageBody.accountStatus === 'suspended', 'Admin Accounts: suspended account status surfaced');

      const suspendedEntitlementRes = await fetch(`${BASE}/api/v1/admin/billing/entitlements?accountId=${createAccountBody.account.id}`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(suspendedEntitlementRes.status === 200, 'Admin Billing Entitlements: readable after manual suspend');
      const suspendedEntitlementBody = await suspendedEntitlementRes.json() as any;
      ok(suspendedEntitlementBody.records[0].status === 'suspended', 'Admin Billing Entitlements: manual suspend overrides active subscription in entitlement view');
      ok(suspendedEntitlementBody.records[0].accessEnabled === false, 'Admin Billing Entitlements: manual suspend disables entitlement access');

      const suspendedSessionMeRes = await fetch(`${BASE}/api/v1/auth/me`, {
        headers: csrfHeaders(accountAdminCookie!),
      });
      ok(suspendedSessionMeRes.status === 401, 'Admin Accounts: manual suspend invalidates existing account session');

      const suspendedBillingSessionRes = await fetch(`${BASE}/api/v1/account/billing/portal`, {
        method: 'POST',
        headers: csrfHeaders(billingAdminCookie!),
      });
      ok(suspendedBillingSessionRes.status === 401, 'Admin Accounts: manual suspend invalidates existing billing session');

      const reactivateAccountRes = await fetch(`${BASE}/api/v1/admin/accounts/${createAccountBody.account.id}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-account-reactivate-1',
        },
        body: JSON.stringify({ reason: 'billing fixed' }),
      });
      ok(reactivateAccountRes.status === 200, 'Admin Accounts: reactivate status 200');
      const reactivateAccountBody = await reactivateAccountRes.json() as any;
      ok(reactivateAccountBody.account.status === 'active', 'Admin Accounts: reactivate restores active status');
      ok(reactivateAccountBody.account.suspendedAt === null, 'Admin Accounts: reactivate clears suspendedAt');

      const reactivatedAccountUsageRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
      });
      ok(reactivatedAccountUsageRes.status === 200, 'Admin Accounts: reactivated account key works again');

      const reactivatedEntitlementRes = await fetch(`${BASE}/api/v1/admin/billing/entitlements?accountId=${createAccountBody.account.id}`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(reactivatedEntitlementRes.status === 200, 'Admin Billing Entitlements: readable after reactivate');
      const reactivatedEntitlementBody = await reactivatedEntitlementRes.json() as any;
      ok(reactivatedEntitlementBody.records[0].status === 'active', 'Admin Billing Entitlements: reactivate restores active entitlement view');

      const accountAdminReLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'owner@account.example',
          password: 'BootstrapPass123!',
        }),
      });
      ok(accountAdminReLoginRes.status === 200, 'Auth: account_admin can log back in after manual reactivate');
      accountAdminCookie = cookieHeaderFromResponse(accountAdminReLoginRes);
      ok(Boolean(accountAdminCookie), 'Auth: account_admin re-login refreshes session cookie');

      const billingAdminReLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'billing@account.example',
          password: 'T8!nR3yM6qW1cZ5',
        }),
      });
      ok(billingAdminReLoginRes.status === 200, 'Auth: billing_admin can log back in after manual reactivate');
      billingAdminCookie = cookieHeaderFromResponse(billingAdminReLoginRes);
      ok(Boolean(billingAdminCookie), 'Auth: billing_admin re-login refreshes session cookie');

      const pastDuePayload = JSON.stringify({
        id: 'evt_sub_account_001_past_due',
        object: 'event',
        type: 'customer.subscription.updated',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'sub_account_001',
            object: 'subscription',
            customer: 'cus_account_001',
            status: 'past_due',
            metadata: {},
            items: {
              object: 'list',
              data: [{ price: { id: 'price_pro_monthly' } }],
            },
          },
        },
      });
      const pastDueSignature = stripe.webhooks.generateTestHeaderString({
        payload: pastDuePayload,
        secret: process.env.STRIPE_WEBHOOK_SECRET!,
      });
      const pastDueWebhookRes = await fetch(`${BASE}/api/v1/billing/stripe/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': pastDueSignature,
        },
        body: pastDuePayload,
      });
      ok(pastDueWebhookRes.status === 200, 'Stripe Webhook: past_due event accepted');
      const pastDueWebhookBody = await pastDueWebhookRes.json() as any;
      ok(pastDueWebhookBody.accountStatus === 'suspended', 'Stripe Webhook: past_due suspends account');
      ok(pastDueWebhookBody.billing.stripeSubscriptionStatus === 'past_due', 'Stripe Webhook: billing status updated to past_due');

      const blockedAfterWebhookRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
      });
      ok(blockedAfterWebhookRes.status === 403, 'Stripe Webhook: suspended account blocked after webhook');

      const suspendedPortalOldSessionRes = await fetch(`${BASE}/api/v1/account/billing/portal`, {
        method: 'POST',
        headers: csrfHeaders(billingAdminCookie!),
      });
      ok(suspendedPortalOldSessionRes.status === 401, 'Stripe Webhook: suspension invalidates pre-existing billing session');

      const suspendedBillingLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'billing@account.example',
          password: 'T8!nR3yM6qW1cZ5',
        }),
      });
      ok(suspendedBillingLoginRes.status === 200, 'Auth: suspended billing_admin can re-login for billing self-service');
      billingAdminCookie = cookieHeaderFromResponse(suspendedBillingLoginRes);
      ok(Boolean(billingAdminCookie), 'Auth: suspended billing_admin login sets fresh session cookie');

      const suspendedPortalRes = await fetch(`${BASE}/api/v1/account/billing/portal`, {
        method: 'POST',
        headers: csrfHeaders(billingAdminCookie!),
      });
      ok(suspendedPortalRes.status === 200, 'Stripe Webhook: suspended account may still open billing portal after re-login');

      const pastDueWebhookReplayRes = await fetch(`${BASE}/api/v1/billing/stripe/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': pastDueSignature,
        },
        body: pastDuePayload,
      });
      ok(pastDueWebhookReplayRes.status === 200, 'Stripe Webhook: duplicate event preserves 200');
      ok(pastDueWebhookReplayRes.headers.get('x-attestor-stripe-replay') === 'true', 'Stripe Webhook: duplicate header set');
      const pastDueWebhookReplayBody = await pastDueWebhookReplayRes.json() as any;
      ok(pastDueWebhookReplayBody.duplicate === true, 'Stripe Webhook: duplicate replay flagged');

      const activePayload = JSON.stringify({
        id: 'evt_sub_account_001_active',
        object: 'event',
        type: 'customer.subscription.updated',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'sub_account_001',
            object: 'subscription',
            customer: 'cus_account_001',
            status: 'active',
            metadata: {},
            items: {
              object: 'list',
              data: [{ price: { id: 'price_pro_monthly' } }],
            },
          },
        },
      });
      const activeSignature = stripe.webhooks.generateTestHeaderString({
        payload: activePayload,
        secret: process.env.STRIPE_WEBHOOK_SECRET!,
      });
      const activeWebhookRes = await fetch(`${BASE}/api/v1/billing/stripe/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': activeSignature,
        },
        body: activePayload,
      });
      ok(activeWebhookRes.status === 200, 'Stripe Webhook: active event accepted');
      const activeWebhookBody = await activeWebhookRes.json() as any;
      ok(activeWebhookBody.accountStatus === 'active', 'Stripe Webhook: active event restores account');
      ok(activeWebhookBody.billing.stripeSubscriptionStatus === 'active', 'Stripe Webhook: billing status restored to active');
      ok(activeWebhookBody.mappedPlanId === 'pro', 'Stripe Webhook: Stripe price maps back to hosted plan');

      const allowedAfterActiveWebhookRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
      });
      ok(allowedAfterActiveWebhookRes.status === 200, 'Stripe Webhook: active account key works again');
      const allowedAfterActiveWebhookBody = await allowedAfterActiveWebhookRes.json() as any;
      ok(allowedAfterActiveWebhookBody.tenantContext.planId === 'pro', 'Stripe Webhook: tenant plan updated from Stripe price');
      ok(allowedAfterActiveWebhookBody.usage.quota === 250000, 'Stripe Webhook: tenant quota updated from Stripe price');

      const invoiceFailedPayload = JSON.stringify({
        id: 'evt_invoice_account_001_failed',
        object: 'event',
        type: 'invoice.payment_failed',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'in_account_001_failed',
            object: 'invoice',
            customer: 'cus_account_001',
            subscription: 'sub_account_001',
            status: 'open',
            currency: 'usd',
            amount_paid: 0,
            amount_due: 5000,
            billing_reason: 'subscription_cycle',
            metadata: {
              attestorAccountId: createAccountBody.account.id,
            },
            status_transitions: {
              paid_at: null,
            },
            lines: {
              object: 'list',
              data: [{ price: { id: 'price_pro_monthly' } }],
            },
          },
        },
      });
      const invoiceFailedSignature = stripe.webhooks.generateTestHeaderString({
        payload: invoiceFailedPayload,
        secret: process.env.STRIPE_WEBHOOK_SECRET!,
      });
      const invoiceFailedRes = await fetch(`${BASE}/api/v1/billing/stripe/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': invoiceFailedSignature,
        },
        body: invoiceFailedPayload,
      });
      ok(invoiceFailedRes.status === 200, 'Stripe Webhook: invoice.payment_failed accepted');
      const invoiceFailedBody = await invoiceFailedRes.json() as any;
      ok(invoiceFailedBody.billing.lastInvoiceId === 'in_account_001_failed', 'Stripe Webhook: invoice failure stores invoice id');
      ok(invoiceFailedBody.billing.lastInvoiceStatus === 'open', 'Stripe Webhook: invoice failure stores invoice status');
      ok(invoiceFailedBody.billing.lastInvoiceAmountDue === 5000, 'Stripe Webhook: invoice failure stores amount due');
      ok(typeof invoiceFailedBody.billing.delinquentSince === 'string', 'Stripe Webhook: invoice failure stores delinquentSince');

      const invoicePaidPayload = JSON.stringify({
        id: 'evt_invoice_account_001_paid',
        object: 'event',
        type: 'invoice.paid',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'in_account_001_paid',
            object: 'invoice',
            customer: 'cus_account_001',
            subscription: 'sub_account_001',
            status: 'paid',
            currency: 'usd',
            amount_paid: 5000,
            amount_due: 5000,
            billing_reason: 'subscription_cycle',
            metadata: {
              attestorAccountId: createAccountBody.account.id,
            },
            status_transitions: {
              paid_at: Math.floor(Date.now() / 1000),
            },
            lines: {
              object: 'list',
              has_more: false,
              data: [{
                id: 'il_account_001_paid_1',
                object: 'line_item',
                invoice: 'in_account_001_paid',
                amount: 5000,
                subtotal: 5000,
                currency: 'usd',
                description: 'Attestor Pro Monthly',
                quantity: 1,
                subscription: 'sub_account_001',
                pricing: {
                  type: 'price_details',
                  price_details: {
                    price: 'price_pro_monthly',
                  },
                  unit_amount_decimal: '5000',
                },
                period: {
                  start: Math.floor(Date.now() / 1000) - 3600,
                  end: Math.floor(Date.now() / 1000),
                },
                parent: {
                  type: 'subscription_item_details',
                  invoice_item_details: null,
                  subscription_item_details: {
                    invoice_item: null,
                    proration: false,
                    proration_details: null,
                    subscription: 'sub_account_001',
                    subscription_item: 'si_account_001',
                  },
                },
                metadata: {},
              }],
            },
          },
        },
      });
      const invoicePaidSignature = stripe.webhooks.generateTestHeaderString({
        payload: invoicePaidPayload,
        secret: process.env.STRIPE_WEBHOOK_SECRET!,
      });
      const invoicePaidRes = await fetch(`${BASE}/api/v1/billing/stripe/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': invoicePaidSignature,
        },
        body: invoicePaidPayload,
      });
      ok(invoicePaidRes.status === 200, 'Stripe Webhook: invoice.paid accepted');
      const invoicePaidBody = await invoicePaidRes.json() as any;
      ok(invoicePaidBody.billing.lastInvoiceId === 'in_account_001_paid', 'Stripe Webhook: invoice paid stores latest invoice id');
      ok(invoicePaidBody.billing.lastInvoiceStatus === 'paid', 'Stripe Webhook: invoice paid stores paid status');
      ok(invoicePaidBody.billing.lastInvoiceAmountPaid === 5000, 'Stripe Webhook: invoice paid stores amount paid');
      ok(typeof invoicePaidBody.billing.lastInvoicePaidAt === 'string', 'Stripe Webhook: invoice paid stores paid timestamp');
      ok(invoicePaidBody.billing.delinquentSince === null, 'Stripe Webhook: invoice paid clears delinquentSince');

      const billingAdminPostInvoiceLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'billing@account.example',
          password: 'T8!nR3yM6qW1cZ5',
        }),
      });
      ok(billingAdminPostInvoiceLoginRes.status === 200, 'Auth: billing_admin can re-login after invoice recovery');
      billingAdminCookie = cookieHeaderFromResponse(billingAdminPostInvoiceLoginRes);
      ok(Boolean(billingAdminCookie), 'Auth: billing_admin invoice recovery login refreshes session cookie');

      const portalReadyRes = await fetch(`${BASE}/api/v1/account/billing/portal`, {
        method: 'POST',
        headers: csrfHeaders(billingAdminCookie!),
      });
      ok(portalReadyRes.status === 200, 'Account Billing: portal status 200 once customer exists');
      const portalReadyBody = await portalReadyRes.json() as any;
      ok(String(portalReadyBody.portalUrl).includes('/portal/'), 'Account Billing: portal URL returned');
      ok(portalReadyBody.mock === true, 'Account Billing: portal mock mode surfaced');

      const checkoutSuccessPageRes = await fetch(`${BASE}/billing/success`);
      ok(checkoutSuccessPageRes.status === 200, 'Billing pages: success return surface responds');
      const checkoutSuccessPage = await checkoutSuccessPageRes.text();
      ok(checkoutSuccessPage.includes('Checkout completed'), 'Billing pages: success return surface explains checkout completion');
      ok(checkoutSuccessPage.includes('Stripe webhook reconciliation'), 'Billing pages: success return surface explains webhook reconciliation in human terms');

      const checkoutCancelPageRes = await fetch(`${BASE}/billing/cancel`);
      ok(checkoutCancelPageRes.status === 200, 'Billing pages: cancel return surface responds');
      const checkoutCancelPage = await checkoutCancelPageRes.text();
      ok(checkoutCancelPage.includes('Checkout canceled'), 'Billing pages: cancel return surface explains cancellation');
      ok(checkoutCancelPage.includes('same hosted account'), 'Billing pages: cancel return surface explains that the account is unchanged');

      const billingSettingsPageRes = await fetch(`${BASE}/settings/billing`);
      ok(billingSettingsPageRes.status === 200, 'Billing pages: billing settings return surface responds');
      const billingSettingsPage = await billingSettingsPageRes.text();
      ok(billingSettingsPage.includes('Billing settings'), 'Billing pages: billing settings return surface explains next steps');
      ok(billingSettingsPage.includes('Developer is the free evaluation plan'), 'Billing pages: billing settings summarises the plan ladder in plain language');

      const landingPageRes = await fetch(`${BASE}/`);
      ok(landingPageRes.status === 200, 'Site surface: landing page responds');
      const landingPage = await landingPageRes.text();
      ok(landingPage.includes('AI-assisted financial reporting acceptance'), 'Site surface: landing page leads with the finance wedge');
      ok(landingPage.includes('Counterparty exposure reporting acceptance'), 'Site surface: landing page points at the canonical reporting proof');

      const proofSurfaceRes = await fetch(`${BASE}/proof/financial-reporting-acceptance`);
      ok(proofSurfaceRes.status === 200, 'Site surface: proof page responds');
      const proofSurface = await proofSurfaceRes.text();
      ok(proofSurface.includes('shown as evidence instead of promise'), 'Site surface: proof page frames the product through evidence');
      ok(proofSurface.includes('committed hybrid packet'), 'Site surface: proof page explains that a committed packet is available');

      const proofKitRes = await fetch(`${BASE}/proof/financial-reporting-acceptance/evidence/kit.json`);
      ok(proofKitRes.status === 200, 'Site surface: committed proof kit endpoint responds');
      ok((proofKitRes.headers.get('content-type') ?? '').includes('application/json'), 'Site surface: committed proof kit endpoint returns JSON');
      const proofKitBody = await proofKitRes.json() as any;
      ok(proofKitBody.verification.overall === 'verified', 'Site surface: committed proof kit exposes a verified packet');

      const appReturnRes = await fetch(`${BASE}/app`);
      ok(appReturnRes.status === 200, 'Billing pages: legacy app return path resolves');
      ok(appReturnRes.url.endsWith('/settings/billing'), 'Billing pages: legacy app return path redirects to billing settings');

      const accountSummaryAfterWebhookRes = await fetch(`${BASE}/api/v1/account`, {
        headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
      });
      ok(accountSummaryAfterWebhookRes.status === 200, 'Account API: summary still available after webhook');
      const accountSummaryAfterWebhookBody = await accountSummaryAfterWebhookRes.json() as any;
      ok(accountSummaryAfterWebhookBody.account.billing.stripeCustomerId === 'cus_account_001', 'Account API: summary shows Stripe customer');
      ok(accountSummaryAfterWebhookBody.account.billing.stripeSubscriptionId === 'sub_account_001', 'Account API: summary shows Stripe subscription');
      ok(accountSummaryAfterWebhookBody.account.billing.stripeSubscriptionStatus === 'active', 'Account API: summary shows restored Stripe status');
      ok(accountSummaryAfterWebhookBody.account.billing.lastCheckoutSessionId === checkoutBody.checkoutSessionId, 'Account API: summary shows checkout session');
      ok(accountSummaryAfterWebhookBody.account.billing.lastCheckoutPlanId === 'pro', 'Account API: summary shows checkout plan');
      ok(accountSummaryAfterWebhookBody.account.billing.lastInvoiceStatus === 'paid', 'Account API: summary shows last invoice status');
      ok(accountSummaryAfterWebhookBody.account.billing.lastInvoiceAmountPaid === 5000, 'Account API: summary shows last invoice payment');
      ok(accountSummaryAfterWebhookBody.account.billing.delinquentSince === null, 'Account API: summary shows cleared delinquentSince');
      ok(accountSummaryAfterWebhookBody.tenantContext.planId === 'pro', 'Account API: summary shows synced plan');
      ok(accountSummaryAfterWebhookBody.entitlement.provider === 'stripe', 'Account API: summary entitlement provider switches to stripe');
      ok(accountSummaryAfterWebhookBody.entitlement.status === 'active', 'Account API: summary entitlement reaches active');
      ok(accountSummaryAfterWebhookBody.entitlement.effectivePlanId === 'pro', 'Account API: summary entitlement effective plan synced to pro');

      const accountEntitlementAfterWebhookRes = await fetch(`${BASE}/api/v1/account/entitlement`, {
        headers: csrfHeaders(billingAdminCookie!),
      });
      ok(accountEntitlementAfterWebhookRes.status === 200, 'Account Entitlement: status 200 after webhook lifecycle');
      const accountEntitlementAfterWebhookBody = await accountEntitlementAfterWebhookRes.json() as any;
      ok(accountEntitlementAfterWebhookBody.entitlement.status === 'active', 'Account Entitlement: active after invoice.paid');
      ok(accountEntitlementAfterWebhookBody.entitlement.accessEnabled === true, 'Account Entitlement: access re-enabled after invoice.paid');
      ok(accountEntitlementAfterWebhookBody.entitlement.lastEventId === 'evt_invoice_account_001_paid', 'Account Entitlement: last event tracks latest invoice event');

      const entitlementSummaryPayload = JSON.stringify({
        id: 'evt_entitlements_account_001_updated',
        object: 'event',
        type: 'entitlements.active_entitlement_summary.updated',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            object: 'entitlements.active_entitlement_summary',
            customer: 'cus_account_001',
            entitlements: {
              object: 'list',
              data: [
                {
                  id: 'entacct_001_pro_api',
                  object: 'entitlements.active_entitlement',
                  lookup_key: 'attestor.pro.api',
                  feature: {
                    id: 'feat_pro_api',
                    object: 'entitlements.feature',
                    lookup_key: 'attestor.pro.api',
                  },
                },
                {
                  id: 'entacct_001_export',
                  object: 'entitlements.active_entitlement',
                  lookup_key: 'attestor.pro.billing_export',
                  feature: {
                    id: 'feat_billing_export',
                    object: 'entitlements.feature',
                    lookup_key: 'attestor.pro.billing_export',
                  },
                },
              ],
            },
          },
        },
      });
      const entitlementSummarySignature = stripe.webhooks.generateTestHeaderString({
        payload: entitlementSummaryPayload,
        secret: process.env.STRIPE_WEBHOOK_SECRET!,
      });
      const entitlementSummaryRes = await fetch(`${BASE}/api/v1/billing/stripe/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': entitlementSummarySignature,
        },
        body: entitlementSummaryPayload,
      });
      ok(entitlementSummaryRes.status === 200, 'Stripe Webhook: entitlements.active_entitlement_summary.updated accepted');

      const accountEntitlementAfterSummaryRes = await fetch(`${BASE}/api/v1/account/entitlement`, {
        headers: csrfHeaders(billingAdminCookie!),
      });
      ok(accountEntitlementAfterSummaryRes.status === 200, 'Account Entitlement: readable after entitlement summary update');
      const accountEntitlementAfterSummaryBody = await accountEntitlementAfterSummaryRes.json() as any;
      ok(accountEntitlementAfterSummaryBody.entitlement.lastEventId === 'evt_entitlements_account_001_updated', 'Account Entitlement: last event advances to entitlement summary');
      ok(accountEntitlementAfterSummaryBody.entitlement.stripeEntitlementLookupKeys.includes('attestor.pro.api'), 'Account Entitlement: lookup keys persisted from Stripe entitlement summary');
      ok(accountEntitlementAfterSummaryBody.entitlement.stripeEntitlementFeatureIds.includes('feat_pro_api'), 'Account Entitlement: feature ids persisted from Stripe entitlement summary');
      ok(typeof accountEntitlementAfterSummaryBody.entitlement.stripeEntitlementSummaryUpdatedAt === 'string', 'Account Entitlement: entitlement summary timestamp stored');

      const accountFeaturesRes = await fetch(`${BASE}/api/v1/account/features`, {
        headers: csrfHeaders(billingAdminCookie!),
      });
      ok(accountFeaturesRes.status === 200, 'Account Features: status 200 after entitlement summary');
      const accountFeaturesBody = await accountFeaturesRes.json() as any;
      ok(accountFeaturesBody.summary.stripeSummaryPresent === true, 'Account Features: stripe summary marked present');
      const apiFeature = accountFeaturesBody.features.find((entry: any) => entry.key === 'api.access');
      ok(Boolean(apiFeature), 'Account Features: api.access feature still present');
      ok(apiFeature.granted === true, 'Account Features: api.access granted after Stripe entitlement summary');
      ok(apiFeature.grantSource === 'stripe_entitlement', 'Account Features: api.access source switches to Stripe entitlement');
      ok(apiFeature.matchedLookupKeys.includes('attestor.pro.api'), 'Account Features: api.access matched Stripe lookup key');
      const exportFeature = accountFeaturesBody.features.find((entry: any) => entry.key === 'billing.export');
      ok(Boolean(exportFeature), 'Account Features: billing.export feature present');
      ok(exportFeature.grantSource === 'stripe_entitlement', 'Account Features: billing.export source switches to Stripe entitlement');
      const reconciliationFeature = accountFeaturesBody.features.find((entry: any) => entry.key === 'billing.reconciliation');
      ok(Boolean(reconciliationFeature), 'Account Features: billing.reconciliation feature present');
      ok(reconciliationFeature.granted === false, 'Account Features: missing Stripe-managed reconciliation entitlement stays disabled');
      ok(reconciliationFeature.grantSource === 'stripe_not_granted', 'Account Features: reconciliation shows Stripe-not-granted status');

      const adminAccountFeaturesRes = await fetch(`${BASE}/api/v1/admin/accounts/${createAccountBody.account.id}/features`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(adminAccountFeaturesRes.status === 200, 'Admin Account Features: status 200');
      const adminAccountFeaturesBody = await adminAccountFeaturesRes.json() as any;
      ok(adminAccountFeaturesBody.summary.stripeGrantedCount >= 2, 'Admin Account Features: stripe-backed features counted');
      ok(adminAccountFeaturesBody.features.some((entry: any) => entry.key === 'billing.export' && entry.grantSource === 'stripe_entitlement'), 'Admin Account Features: export feature visible to admin');

      const accountAdminPostInvoiceLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'owner@account.example',
          password: 'BootstrapPass123!',
        }),
      });
      ok(accountAdminPostInvoiceLoginRes.status === 200, 'Auth: account_admin can re-login after invoice recovery');
      accountAdminCookie = cookieHeaderFromResponse(accountAdminPostInvoiceLoginRes);
      ok(Boolean(accountAdminCookie), 'Auth: account_admin post-invoice re-login sets fresh session cookie');

      const accountBillingExportRes = await fetch(`${BASE}/api/v1/account/billing/export?limit=5`, {
        headers: csrfHeaders(billingAdminCookie!),
      });
      ok(accountBillingExportRes.status === 200, 'Account Billing Export: json status 200');
      const accountBillingExportBody = await accountBillingExportRes.json() as any;
      ok(accountBillingExportBody.accountId === createAccountBody.account.id, 'Account Billing Export: account id matches');
      ok(accountBillingExportBody.entitlement.status === 'active', 'Account Billing Export: entitlement included in JSON');
      ok(accountBillingExportBody.checkout.sessionId === checkoutBody.checkoutSessionId, 'Account Billing Export: checkout session propagated');
      ok(accountBillingExportBody.entitlementFeatures.lookupKeys.includes('attestor.pro.api'), 'Account Billing Export: entitlement lookup keys exported');
      ok(accountBillingExportBody.entitlementFeatures.featureIds.includes('feat_pro_api'), 'Account Billing Export: entitlement feature ids exported');
      ok(accountBillingExportBody.reconciliation.summary.status === 'partial', 'Account Billing Export: reconciliation is partial without detailed line-item truth');
      ok(accountBillingExportBody.reconciliation.summary.invoiceCount >= 1, 'Account Billing Export: reconciliation invoice count reported');
      ok(accountBillingExportBody.summary.dataSource === 'ledger_derived' || accountBillingExportBody.summary.dataSource === 'mock_summary', 'Account Billing Export: data source is ledger-derived or mock-summary');
      const exportedInvoice = accountBillingExportBody.invoices.find((entry: any) => entry.invoiceId === 'in_account_001_paid');
      ok(Boolean(exportedInvoice), 'Account Billing Export: paid invoice exported');
      ok(exportedInvoice.amountPaid === 5000, 'Account Billing Export: paid invoice amount exported');
      const exportedCharge = accountBillingExportBody.charges.find((entry: any) => entry.invoiceId === 'in_account_001_paid');
      ok(Boolean(exportedCharge), 'Account Billing Export: derived charge exported from invoice.paid');
      ok(exportedCharge.status === 'succeeded', 'Account Billing Export: derived charge status succeeded');
      if (accountBillingExportBody.summary.dataSource === 'ledger_derived' || accountBillingExportBody.summary.dataSource === 'stripe_live') {
        const exportedLineItem = accountBillingExportBody.lineItems.find((entry: any) => entry.invoiceId === 'in_account_001_paid');
        ok(Boolean(exportedLineItem), 'Account Billing Export: invoice line item exported when detailed billing truth is available');
        ok(exportedLineItem.priceId === 'price_pro_monthly', 'Account Billing Export: invoice line item captures price id');
        ok(accountBillingExportBody.summary.lineItemCount >= 1, 'Account Billing Export: line item count reported when detailed billing truth is available');
      } else {
        ok(accountBillingExportBody.summary.lineItemCount === 0, 'Account Billing Export: line items stay empty without shared billing ledger');
      }
      const exportedReconciliationInvoice = accountBillingExportBody.reconciliation.invoices.find((entry: any) => entry.invoiceId === 'in_account_001_paid');
      ok(Boolean(exportedReconciliationInvoice), 'Account Billing Export: reconciliation includes paid invoice');
      ok(exportedReconciliationInvoice.checks.chargesVsInvoicePaid.status === 'match', 'Account Billing Export: reconciliation matches paid charges');
      ok(exportedReconciliationInvoice.checks.lineItemsVsInvoice.status === 'unavailable', 'Account Billing Export: reconciliation marks missing line items as unavailable in mock-summary mode');

      const accountBillingExportCsvRes = await fetch(`${BASE}/api/v1/account/billing/export?format=csv&limit=5`, {
        headers: csrfHeaders(billingAdminCookie!),
      });
      ok(accountBillingExportCsvRes.status === 200, 'Account Billing Export: csv status 200');
      ok((accountBillingExportCsvRes.headers.get('content-type') ?? '').includes('text/csv'), 'Account Billing Export: csv content-type');
      const accountBillingExportCsv = await accountBillingExportCsvRes.text();
      ok(accountBillingExportCsv.includes('recordType,accountId,tenantId'), 'Account Billing Export: csv header present');
      ok(accountBillingExportCsv.includes('invoice') && accountBillingExportCsv.includes('in_account_001_paid'), 'Account Billing Export: csv includes invoice row');
      if (accountBillingExportBody.summary.lineItemCount > 0) {
        ok(accountBillingExportCsv.includes('line_item') && accountBillingExportCsv.includes('il_account_001_paid_1'), 'Account Billing Export: csv includes invoice line item row when detailed billing truth is available');
      }

      const adminBillingExportNoAuth = await fetch(`${BASE}/api/v1/admin/accounts/${createAccountBody.account.id}/billing/export`);
      ok(adminBillingExportNoAuth.status === 401, 'Admin Account Billing Export: auth required');

      const adminBillingExportRes = await fetch(`${BASE}/api/v1/admin/accounts/${createAccountBody.account.id}/billing/export?limit=5`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(adminBillingExportRes.status === 200, 'Admin Account Billing Export: json status 200');
      const adminBillingExportBody = await adminBillingExportRes.json() as any;
      ok(adminBillingExportBody.accountId === createAccountBody.account.id, 'Admin Account Billing Export: account id matches');
      ok(adminBillingExportBody.summary.invoiceCount >= 1, 'Admin Account Billing Export: invoice count reported');
      ok(adminBillingExportBody.entitlement.status === 'active', 'Admin Account Billing Export: entitlement included');
      ok(adminBillingExportBody.reconciliation.summary.status === 'partial', 'Admin Account Billing Export: reconciliation partial without shared billing ledger');
      if (adminBillingExportBody.summary.dataSource === 'ledger_derived' || adminBillingExportBody.summary.dataSource === 'stripe_live') {
        ok(adminBillingExportBody.summary.lineItemCount >= 1, 'Admin Account Billing Export: line item count reported when detailed billing truth is available');
      } else {
        ok(adminBillingExportBody.summary.lineItemCount === 0, 'Admin Account Billing Export: line items stay empty without shared billing ledger');
      }

      const accountBillingReconciliationRes = await fetch(`${BASE}/api/v1/account/billing/reconciliation?limit=5`, {
        headers: csrfHeaders(billingAdminCookie!),
      });
      ok(accountBillingReconciliationRes.status === 200, 'Account Billing Reconciliation: status 200');
      const accountBillingReconciliationBody = await accountBillingReconciliationRes.json() as any;
      ok(accountBillingReconciliationBody.accountId === createAccountBody.account.id, 'Account Billing Reconciliation: account id matches');
      ok(accountBillingReconciliationBody.reconciliation.summary.status === 'partial', 'Account Billing Reconciliation: partial summary without shared line-item truth');

      const adminBillingReconciliationRes = await fetch(`${BASE}/api/v1/admin/accounts/${createAccountBody.account.id}/billing/reconciliation?limit=5`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(adminBillingReconciliationRes.status === 200, 'Admin Account Billing Reconciliation: status 200');
      const adminBillingReconciliationBody = await adminBillingReconciliationRes.json() as any;
      ok(adminBillingReconciliationBody.reconciliation.summary.invoiceCount >= 1, 'Admin Account Billing Reconciliation: invoice count reported');
      ok(adminBillingReconciliationBody.reconciliation.summary.partialCount >= 1, 'Admin Account Billing Reconciliation: partial reconciliation counted');

      const adminBillingExportCsvRes = await fetch(`${BASE}/api/v1/admin/accounts/${createAccountBody.account.id}/billing/export?format=csv&limit=5`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(adminBillingExportCsvRes.status === 200, 'Admin Account Billing Export: csv status 200');
      ok((adminBillingExportCsvRes.headers.get('content-disposition') ?? '').includes(`${createAccountBody.account.id}-billing-export.csv`), 'Admin Account Billing Export: csv attachment filename');
      ctx.accountAdminCookie = accountAdminCookie;
      ctx.billingAdminCookie = billingAdminCookie;
}
