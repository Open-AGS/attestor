import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  STRIPE_PRICE_EXPECTATIONS,
  probeStripeLiveReadiness,
  requiredStripePriceManifest,
} from '../scripts/probe-stripe-live-readiness.ts';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function fakeStripe(overrides?: {
  account?: any;
  prices?: Record<string, any>;
  products?: Record<string, any>;
  portalConfigurations?: any[];
}): any {
  const defaultPrices = Object.fromEntries(
    STRIPE_PRICE_EXPECTATIONS.map((expectation) => [
      `price_${expectation.planId}_live`,
      {
        id: `price_${expectation.planId}_live`,
        active: true,
        livemode: true,
        currency: expectation.expectedCurrency,
        unit_amount: expectation.expectedUnitAmount,
        type: 'recurring',
        recurring: {
          interval: expectation.expectedInterval,
          interval_count: expectation.expectedIntervalCount,
        },
        product: `prod_${expectation.planId}`,
      },
    ]),
  );
  const defaultProducts = Object.fromEntries(
    STRIPE_PRICE_EXPECTATIONS.map((expectation) => [
      `prod_${expectation.planId}`,
      {
        id: `prod_${expectation.planId}`,
        active: true,
      },
    ]),
  );

  return {
    accounts: {
      retrieveCurrent: async () => overrides?.account ?? {
        id: 'acct_ready',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        country: 'US',
        default_currency: 'usd',
        business_profile: { name: 'Attestor' },
        requirements: {
          currently_due: [],
          disabled_reason: null,
        },
      },
    },
    prices: {
      retrieve: async (id: string) => {
        const price = (overrides?.prices ?? defaultPrices)[id];
        if (!price) throw new Error(`No such price: ${id}`);
        return price;
      },
    },
    products: {
      retrieve: async (id: string) => {
        const product = (overrides?.products ?? defaultProducts)[id];
        if (!product) throw new Error(`No such product: ${id}`);
        return product;
      },
    },
    billingPortal: {
      configurations: {
        list: async () => ({
          data: overrides?.portalConfigurations ?? [{
            id: 'bpc_ready',
            active: true,
            features: {
              payment_method_update: { enabled: true },
              invoice_history: { enabled: true },
              subscription_cancel: { enabled: true },
              subscription_update: { enabled: true },
            },
          }],
        }),
      },
    },
  };
}

async function testHappyPath(): Promise<void> {
  const summary = await probeStripeLiveReadiness({
    stripe: fakeStripe(),
    env: {
      STRIPE_API_KEY: 'sk_live_ready',
      ATTESTOR_STRIPE_PRICE_STARTER: 'price_starter_live',
      ATTESTOR_STRIPE_PRICE_PRO: 'price_pro_live',
      ATTESTOR_STRIPE_PRICE_SCALE: 'price_scale_live',
    },
  });

  ok(summary.ok === true, 'Stripe live readiness probe: ready account, prices, and portal pass');
  ok(summary.account.payoutsEnabled === true, 'Stripe live readiness probe: payout readiness is surfaced');
  ok(summary.customerPortal.defaultConfigurationId === 'bpc_ready', 'Stripe live readiness probe: default portal config is surfaced');
  ok(summary.prices.every((price) => price.matchesExpected), 'Stripe live readiness probe: all required prices match expected commercial model');
}

async function testFailClosedIssues(): Promise<void> {
  const brokenPrices = {
    price_starter_live: {
      id: 'price_starter_live',
      active: false,
      livemode: false,
      currency: 'eur',
      unit_amount: 49_900,
      type: 'recurring',
      recurring: { interval: 'year', interval_count: 1 },
      product: 'prod_starter',
    },
    price_pro_live: {
      id: 'price_pro_live',
      active: true,
      livemode: true,
      currency: 'usd',
      unit_amount: 149_900,
      type: 'recurring',
      recurring: { interval: 'month', interval_count: 1 },
      product: 'prod_pro',
    },
    price_scale_live: {
      id: 'price_scale_live',
      active: true,
      livemode: true,
      currency: 'usd',
      unit_amount: 599_900,
      type: 'recurring',
      recurring: { interval: 'month', interval_count: 1 },
      product: 'prod_scale',
    },
  };

  const summary = await probeStripeLiveReadiness({
    stripe: fakeStripe({
      account: {
        id: 'acct_blocked',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        country: 'US',
        default_currency: 'usd',
        business_profile: {},
        requirements: {
          currently_due: ['business_profile.url'],
          disabled_reason: 'requirements.past_due',
        },
      },
      prices: brokenPrices,
      portalConfigurations: [],
    }),
    env: {
      STRIPE_API_KEY: 'sk_test_not_live',
      ATTESTOR_STRIPE_PRICE_STARTER: 'price_starter_live',
      ATTESTOR_STRIPE_PRICE_PRO: 'price_pro_live',
      ATTESTOR_STRIPE_PRICE_SCALE: 'price_scale_live',
    },
  });

  ok(summary.ok === false, 'Stripe live readiness probe: missing commercial readiness fails closed');
  ok(summary.issues.some((issue) => issue.includes('live-mode key')), 'Stripe live readiness probe: test API key is blocked');
  ok(summary.issues.some((issue) => issue.includes('payouts are not enabled')), 'Stripe live readiness probe: missing payout readiness is blocked');
  ok(summary.issues.some((issue) => issue.includes('Customer Portal')), 'Stripe live readiness probe: missing Customer Portal is blocked');
  ok(summary.issues.some((issue) => issue.includes('Starter Stripe price amount')), 'Stripe live readiness probe: price mismatch is blocked');
}

function testManifestCanPrintWithoutKey(): void {
  const manifest = requiredStripePriceManifest();
  ok(manifest.length === 3, 'Stripe live readiness probe: required price manifest covers Starter, Pro, and Scale');

  const run = spawnSync(
    process.execPath,
    [
      resolve('node_modules/tsx/dist/cli.mjs'),
      'scripts/probe-stripe-live-readiness.ts',
      '--print-required-prices',
    ],
    {
      cwd: resolve('.'),
      encoding: 'utf8',
      env: {
        ...process.env,
        STRIPE_API_KEY: '',
      },
    },
  );
  ok(run.status === 0, 'Stripe live readiness probe: required-price manifest prints without Stripe API key');
  const printed = JSON.parse(run.stdout) as { requiredPrices: Array<{ envName: string; expectedCurrency: string }> };
  ok(
    printed.requiredPrices.map((entry) => entry.envName).join(',') === 'ATTESTOR_STRIPE_PRICE_STARTER,ATTESTOR_STRIPE_PRICE_PRO,ATTESTOR_STRIPE_PRICE_SCALE',
    'Stripe live readiness probe: printed manifest names required hosted price env vars',
  );
  ok(
    printed.requiredPrices.every((entry) => entry.expectedCurrency === 'usd'),
    'Stripe live readiness probe: printed manifest preserves USD commercial model',
  );
}

async function main(): Promise<void> {
  await testHappyPath();
  await testFailClosedIssues();
  testManifestCanPrintWithoutKey();
  console.log(`\nStripe live readiness probe tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nStripe live readiness probe tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
