import { strict as assert } from 'node:assert';
import {
  StripeBillingError,
  createHostedBillingPortalSession,
  createHostedCheckoutSession,
  createHostedWorkflowCheckoutSession,
  recordStripeOverageMeterEvent,
  recordWorkflowStripeOverageMeterEvent,
} from '../src/service/billing/stripe/stripe-billing.js';
import { getHostedPlan, resolvePlanStripeOveragePrice, resolvePlanStripeTrialDays } from '../src/service/plan-catalog.js';

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
    ATTESTOR_STRIPE_STARTER_TRIAL_DAYS: process.env.ATTESTOR_STRIPE_STARTER_TRIAL_DAYS,
    ATTESTOR_STRIPE_PRICE_STARTER: process.env.ATTESTOR_STRIPE_PRICE_STARTER,
    ATTESTOR_STRIPE_PRICE_PRO: process.env.ATTESTOR_STRIPE_PRICE_PRO,
    ATTESTOR_STRIPE_PRICE_SCALE: process.env.ATTESTOR_STRIPE_PRICE_SCALE,
    ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER: process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER,
    ATTESTOR_STRIPE_OVERAGE_PRICE_PRO: process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_PRO,
    ATTESTOR_STRIPE_OVERAGE_PRICE_SCALE: process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_SCALE,
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
  process.env.ATTESTOR_STRIPE_PRICE_STARTER = 'price_starter_live';
  process.env.ATTESTOR_STRIPE_PRICE_PRO = 'price_pro_live';
  process.env.ATTESTOR_STRIPE_PRICE_SCALE = 'price_scale_live';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER = 'price_starter_overage_live';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_PRO = 'price_pro_overage_live';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_SCALE = 'price_scale_overage_live';
  process.env.ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW = 'price_pilot_workflow_live';
  process.env.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_live';
  process.env.ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW = 'price_pro_workflow_live';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_overage_live';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW = 'price_pro_workflow_overage_live';

  try {
    const starter = getHostedPlan('starter');
    const pro = getHostedPlan('pro');
    const scale = getHostedPlan('scale');
    const developer = getHostedPlan('developer');
    const legacyCommunity = getHostedPlan('community');

    ok(starter?.defaultStripeTrialDays === null, 'Stripe commercial config: starter defaults to no paid Stripe trial');
    ok(pro?.defaultStripeTrialDays === null, 'Stripe commercial config: pro defaults to no trial');
    ok(scale?.defaultMonthlyRunQuota === 1_000_000, 'Stripe commercial config: scale exposes one million included admissions');
    ok(developer?.intendedFor === 'evaluation', 'Stripe commercial config: developer remains the non-Stripe evaluation plan');
    ok(developer?.defaultMonthlyRunQuota === 500, 'Stripe commercial config: developer exposes 500 included admissions');
    ok(legacyCommunity?.id === 'developer', 'Stripe commercial config: legacy community resolves to developer');
    ok(resolvePlanStripeOveragePrice('starter').priceId === 'price_starter_overage_live', 'Stripe commercial config: starter overage price resolves from env');
    ok(resolvePlanStripeOveragePrice('developer').billable === false, 'Stripe commercial config: developer is not metered for paid overage');

    process.env.ATTESTOR_STRIPE_STARTER_TRIAL_DAYS = '21';
    ok(resolvePlanStripeTrialDays('starter').trialDays === 21, 'Stripe commercial config: starter trial can be overridden by env');

    process.env.ATTESTOR_STRIPE_STARTER_TRIAL_DAYS = '0';
    ok(resolvePlanStripeTrialDays('starter').trialDays === null, 'Stripe commercial config: invalid starter trial override falls back to no paid trial');

    delete process.env.ATTESTOR_STRIPE_STARTER_TRIAL_DAYS;

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
      planId: 'starter',
    } as any;

    const starterCheckout = await createHostedCheckoutSession({
      account,
      tenant,
      plan: starter!,
      idempotencyKey: 'starter-trial-test',
    });
    ok(starterCheckout.trialDays === null, 'Stripe commercial config: starter checkout returns no paid Stripe trial in mock mode');
    ok(starterCheckout.stripeOveragePriceId === 'price_starter_overage_live', 'Stripe commercial config: starter checkout includes the metered overage price');

    const proCheckout = await createHostedCheckoutSession({
      account,
      tenant: { ...tenant, planId: 'pro' },
      plan: pro!,
      idempotencyKey: 'pro-no-trial-test',
    });
    ok(proCheckout.trialDays === null, 'Stripe commercial config: pro checkout returns no trial in mock mode');
    ok(proCheckout.stripeOveragePriceId === 'price_pro_overage_live', 'Stripe commercial config: pro checkout includes the metered overage price');

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

    delete process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER;
    let missingOveragePriceError: unknown = null;
    try {
      await createHostedCheckoutSession({
        account,
        tenant,
        plan: starter!,
        idempotencyKey: 'missing-overage-price-test',
      });
    } catch (error) {
      missingOveragePriceError = error;
    }
    ok(missingOveragePriceError instanceof StripeBillingError, 'Stripe commercial config: missing paid overage price raises StripeBillingError');
    ok((missingOveragePriceError as StripeBillingError).code === 'PLAN_UNAVAILABLE', 'Stripe commercial config: missing paid overage price is treated as unavailable plan config');
    process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER = 'price_starter_overage_live';

    const metering = await recordStripeOverageMeterEvent({
      account: {
        ...account,
        billing: {
          provider: 'stripe',
          stripeCustomerId: 'cus_mock_123',
        },
      },
      tenant,
      usage: {
        tenantId: 'tenant_123',
        planId: 'starter',
        meter: 'monthly_admission_runs',
        period: '2026-05',
        used: 25_001,
        quota: 25_000,
        remaining: 0,
        enforced: false,
        hardLimit: false,
        overage: true,
        overageUnits: 1,
      },
    });
    ok(metering.status === 'mock_recorded', 'Stripe commercial config: mock Stripe overage metering records over-quota usage');
    ok(metering.value === 1, 'Stripe commercial config: overage meter emits one admission unit per over-quota run');
    ok(typeof metering.eventIdentifier === 'string' && metering.eventIdentifier.startsWith('attestor_'), 'Stripe commercial config: overage meter event gets a stable Attestor identifier');

    process.env.ATTESTOR_BILLING_SUCCESS_URL = '/billing/success';
    let invalidCheckoutUrlError: unknown = null;
    try {
      await createHostedCheckoutSession({
        account,
        tenant,
        plan: starter!,
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
