import { strict as assert } from 'node:assert';
import {
  StripeBillingError,
  createHostedBillingPortalSession,
  createHostedWorkflowCheckoutSession,
  recordWorkflowStripeOverageMeterEvent,
} from '../src/service/billing/stripe/stripe-billing.js';
import { getHostedPlan } from '../src/service/plan-catalog.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

async function main(): Promise<void> {
  const previous = {
    ATTESTOR_STRIPE_USE_MOCK: process.env.ATTESTOR_STRIPE_USE_MOCK,
    ATTESTOR_BILLING_SUCCESS_URL: process.env.ATTESTOR_BILLING_SUCCESS_URL,
    ATTESTOR_BILLING_CANCEL_URL: process.env.ATTESTOR_BILLING_CANCEL_URL,
    ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW: process.env.ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW,
    ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW: process.env.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW,
    ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW: process.env.ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW,
    ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW: process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW,
    ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW: process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW,
    ATTESTOR_STRIPE_OVERAGE_METER_EVENT_NAME: process.env.ATTESTOR_STRIPE_OVERAGE_METER_EVENT_NAME,
  };

  process.env.ATTESTOR_STRIPE_USE_MOCK = 'true';
  process.env.ATTESTOR_BILLING_SUCCESS_URL = 'https://attestor.example.invalid/billing/success';
  process.env.ATTESTOR_BILLING_CANCEL_URL = 'https://attestor.example.invalid/billing/cancel';
  process.env.ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW = 'price_pilot_workflow_live';
  process.env.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_live';
  process.env.ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW = 'price_pro_workflow_live';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_overage_live';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW = 'price_pro_workflow_overage_live';

  try {
    const starter = getHostedPlan('starter');
    const pro = getHostedPlan('pro');
    const trial = getHostedPlan('trial');
    const legacyDeveloper = getHostedPlan('developer');
    const legacyCommunity = getHostedPlan('community');

    ok(trial?.defaultMonthlyRunQuota === 10_000, 'Stripe commercial config: trial account access exposes ten thousand evaluation admissions');
    ok(trial?.defaultForHostedProvisioning === true, 'Stripe commercial config: trial is the default hosted provisioning access plan');
    ok(starter?.id === 'trial', 'Stripe commercial config: legacy starter account plan resolves to trial');
    ok(pro?.id === 'trial', 'Stripe commercial config: legacy pro account plan resolves to trial');
    ok(legacyDeveloper?.id === 'trial', 'Stripe commercial config: legacy developer resolves to trial');
    ok(legacyCommunity?.id === 'trial', 'Stripe commercial config: legacy community resolves to trial');

    const account = {
      id: 'acct_123',
      primaryTenantId: 'tenant_123',
      contactEmail: 'ops@attestor.example.invalid',
      billing: {
        stripeCustomerId: null,
      },
    } as any;

    const tenant = {
      tenantId: 'tenant_123',
      source: 'account_session',
      planId: 'trial',
    } as any;

    const workflowCheckout = await createHostedWorkflowCheckoutSession({
      account,
      tenant,
      workflowAction: 'create',
      workflowId: 'wf_refunds',
      tier: 'starter-workflow',
      consequencePack: 'money-movement',
      downstreamSystemRefDigest: 'sha256:downstream',
      policyGatePathRefDigest: 'sha256:gate',
      idempotencyKey: 'workflow-checkout-test',
    });
    ok(workflowCheckout.mock, 'Stripe commercial config: workflow checkout supports mock mode');
    ok(workflowCheckout.stripePriceId === 'price_starter_workflow_live', 'Stripe commercial config: workflow checkout uses tier base price');
    ok(workflowCheckout.stripeOveragePriceId === 'price_starter_workflow_overage_live', 'Stripe commercial config: workflow checkout includes metered workflow overage price');

    const workflowMetering = await recordWorkflowStripeOverageMeterEvent({
      entitlement: {
        id: 'went_123',
        schemaVersion: 'attestor.workflow-entitlement.v1',
        workflowId: 'wf_refunds',
        accountId: 'acct_123',
        tenantId: 'tenant_123',
        tier: 'starter-workflow',
        status: 'active',
        stripeCustomerId: 'cus_mock_123',
        stripeSubscriptionId: 'sub_mock_123',
        stripeSubscriptionItemId: 'si_mock_123',
        stripePriceId: 'price_starter_workflow_live',
        stripeOveragePriceId: 'price_starter_workflow_overage_live',
        consequencePack: 'money-movement',
        downstreamSystemRefDigest: 'sha256:downstream',
        policyGatePathRefDigest: 'sha256:gate',
        includedAdmissionsMonthly: 25_000,
        monthlyAdmissionsUsed: 25_001,
        admissionPeriod: '2026-05',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        customerGateProofPresent: true,
        lastCheckoutAction: 'create',
        lastCheckoutSessionId: 'cs_mock_123',
        lastCheckoutCompletedAt: null,
        lastEventId: null,
        lastEventType: null,
        lastEventAt: null,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
      usage: {
        workflowId: 'wf_refunds',
        accountId: 'acct_123',
        tenantId: 'tenant_123',
        tier: 'starter-workflow',
        meter: 'workflow_monthly_admissions',
        period: '2026-05',
        used: 25_001,
        quota: 25_000,
        remaining: 0,
        hardLimit: false,
        overage: true,
        overageUnits: 1,
      },
    });
    ok(workflowMetering.status === 'mock_recorded', 'Stripe commercial config: workflow overage metering records mock event');
    ok(workflowMetering.eventIdentifier?.startsWith('attestor_wf_'), 'Stripe commercial config: workflow meter event identifier is workflow-scoped');

    delete process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW;
    let missingWorkflowOveragePriceError: unknown = null;
    try {
      await createHostedWorkflowCheckoutSession({
        account,
        tenant,
        workflowAction: 'create',
        workflowId: 'wf_missing_overage',
        tier: 'starter-workflow',
        consequencePack: 'money-movement',
        downstreamSystemRefDigest: 'sha256:downstream',
        policyGatePathRefDigest: 'sha256:gate',
        idempotencyKey: 'missing-workflow-overage-price-test',
      });
    } catch (error) {
      missingWorkflowOveragePriceError = error;
    }
    ok(missingWorkflowOveragePriceError instanceof StripeBillingError, 'Stripe commercial config: missing workflow overage price raises StripeBillingError');
    ok((missingWorkflowOveragePriceError as StripeBillingError).code === 'PLAN_UNAVAILABLE', 'Stripe commercial config: missing workflow overage price is treated as unavailable tier config');
    process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_overage_live';

    process.env.ATTESTOR_BILLING_SUCCESS_URL = '/billing/success';
    let invalidCheckoutUrlError: unknown = null;
    try {
      await createHostedWorkflowCheckoutSession({
        account,
        tenant,
        workflowAction: 'create',
        workflowId: 'wf_invalid_url',
        tier: 'starter-workflow',
        consequencePack: 'money-movement',
        downstreamSystemRefDigest: 'sha256:downstream',
        policyGatePathRefDigest: 'sha256:gate',
        idempotencyKey: 'invalid-url-test',
      });
    } catch (error) {
      invalidCheckoutUrlError = error;
    }
    ok(invalidCheckoutUrlError instanceof StripeBillingError, 'Stripe commercial config: invalid checkout return URL raises StripeBillingError');
    ok((invalidCheckoutUrlError as StripeBillingError).code === 'CONFIG', 'Stripe commercial config: invalid checkout return URL is treated as config error');

    process.env.ATTESTOR_BILLING_SUCCESS_URL = 'https://attestor.example.invalid/billing/success';
    process.env.ATTESTOR_BILLING_PORTAL_RETURN_URL = 'javascript:alert(1)';
    let invalidPortalUrlError: unknown = null;
    try {
      await createHostedBillingPortalSession({
        account: {
          ...account,
          billing: {
            stripeCustomerId: 'cus_123',
          },
        },
      });
    } catch (error) {
      invalidPortalUrlError = error;
    }
    ok(invalidPortalUrlError instanceof StripeBillingError, 'Stripe commercial config: invalid portal return URL raises StripeBillingError');
    ok((invalidPortalUrlError as StripeBillingError).code === 'CONFIG', 'Stripe commercial config: invalid portal return URL is treated as config error');

    console.log(`\nStripe commercial config tests: ${passed} passed, 0 failed`);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error('\nStripe commercial config tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
