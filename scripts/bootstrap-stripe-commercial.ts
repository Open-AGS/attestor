import { pathToFileURL } from 'node:url';
import Stripe from 'stripe';
import { STRIPE_PRICE_EXPECTATIONS } from './probe-stripe-live-readiness.ts';
import {
  STRIPE_SUPPORTED_WEBHOOK_EVENTS,
  STRIPE_WEBHOOK_ROUTE,
} from '../src/service/stripe-webhook-events.js';
import { trimAndStripTrailingSlashes } from '../src/platform/string-normalization.js';

type PaidPlanId = 'starter' | 'pro' | 'scale';

type BootstrapAccountSummary = {
  id: string | null;
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
  detailsSubmitted: boolean | null;
  readAvailable: boolean;
  readWarning: string | null;
};

const PLAN_PRODUCTS: Record<PaidPlanId, { name: string; description: string }> = {
  starter: {
    name: 'Attestor Starter',
    description: 'Hosted Attestor subscription for small production teams.',
  },
  pro: {
    name: 'Attestor Pro',
    description: 'Hosted Attestor subscription for growing teams with SSO, dual-control, and longer audit retention.',
  },
  scale: {
    name: 'Attestor Scale',
    description: 'Hosted Attestor subscription for high-volume production deployments.',
  },
};

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const entry = process.argv.find((candidate) => candidate.startsWith(prefix));
  return entry ? entry.slice(prefix.length).trim() : null;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function requireStripeApiKey(): string {
  const apiKey = env('STRIPE_API_KEY');
  if (!apiKey) {
    throw new Error('STRIPE_API_KEY must be set to bootstrap Stripe commercial billing.');
  }
  return apiKey;
}

function redactStripeApiKeys(message: string): string {
  return message.replace(/\b[rs]k_(?:test|live)_[A-Za-z0-9]+\b/g, (match) => `${match.slice(0, 8)}_[redacted]`);
}

function accountIdFromStripeError(message: string): string | null {
  return message.match(/\baccount '([^']+)'/)?.[1] ?? null;
}

async function tryRetrieveAccount(stripe: Stripe): Promise<BootstrapAccountSummary> {
  try {
    const account = await stripe.accounts.retrieve();
    return {
      id: account.id,
      chargesEnabled: account.charges_enabled ?? null,
      payoutsEnabled: account.payouts_enabled ?? null,
      detailsSubmitted: account.details_submitted ?? null,
      readAvailable: true,
      readWarning: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: accountIdFromStripeError(message),
      chargesEnabled: null,
      payoutsEnabled: null,
      detailsSubmitted: null,
      readAvailable: false,
      readWarning: redactStripeApiKeys(message),
    };
  }
}

function normalizeUrl(value: string): string {
  return trimAndStripTrailingSlashes(value);
}

function expectedWebhookUrl(): string | null {
  const explicitUrl = arg('webhook-url') ?? env('ATTESTOR_STRIPE_WEBHOOK_URL');
  if (explicitUrl) return normalizeUrl(explicitUrl);

  const publicBaseUrl = env('ATTESTOR_PUBLIC_BASE_URL');
  if (publicBaseUrl) return `${normalizeUrl(publicBaseUrl)}${STRIPE_WEBHOOK_ROUTE}`;

  const hostname = env('ATTESTOR_PUBLIC_HOSTNAME');
  if (hostname) return `https://${hostname}${STRIPE_WEBHOOK_ROUTE}`;

  return null;
}

function portalReturnUrl(): string {
  const value = arg('portal-return-url') ?? env('ATTESTOR_BILLING_PORTAL_RETURN_URL') ?? 'https://github.com/AI-gateway-systems/attestor';
  return normalizeUrl(value);
}

function decimalAmount(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value && typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function') {
    const serialized = (value as { toString: () => string }).toString().trim();
    if (serialized !== '' && serialized !== '[object Object]') return serialized;
  }
  return null;
}

function decimalMatches(actual: unknown, expected: string): boolean {
  const serialized = decimalAmount(actual);
  return serialized !== null && Number(serialized) === Number(expected);
}

async function listAll<T>(pageFn: (params: { limit: number; starting_after?: string }) => Promise<{ data: T[]; has_more: boolean }>): Promise<T[]> {
  const output: T[] = [];
  let startingAfter: string | undefined;
  for (;;) {
    const page = await pageFn({ limit: 100, starting_after: startingAfter });
    output.push(...page.data);
    if (!page.has_more || page.data.length === 0) return output;
    startingAfter = (page.data[page.data.length - 1] as { id?: string }).id;
  }
}

async function ensureProduct(stripe: Stripe, planId: PaidPlanId): Promise<Stripe.Product> {
  const products = await listAll((params) => stripe.products.list({ ...params, active: true }));
  const existing = products.find((product) => product.metadata?.attestor_plan === planId);
  if (existing) return existing;

  const spec = PLAN_PRODUCTS[planId];
  return stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: {
      attestor_managed: 'true',
      attestor_plan: planId,
    },
  });
}

async function ensureAdmissionMeter(stripe: Stripe): Promise<Stripe.Billing.Meter> {
  const meters = await listAll((params) => stripe.billing.meters.list(params));
  const existing = meters.find((meter) => meter.event_name === 'attestor_admission_overage');
  if (existing) return existing;

  return stripe.billing.meters.create({
    display_name: 'Attestor admission overage',
    event_name: 'attestor_admission_overage',
    default_aggregation: {
      formula: 'sum',
    },
    customer_mapping: {
      type: 'by_id',
      event_payload_key: 'stripe_customer_id',
    },
    value_settings: {
      event_payload_key: 'value',
    },
  });
}

async function ensurePrice(options: {
  stripe: Stripe;
  planId: PaidPlanId;
  productId: string;
  kind: 'base' | 'overage';
  expectedUnitAmountDecimal: string;
  meterId: string | null;
}): Promise<Stripe.Price> {
  const prices = await listAll((params) => options.stripe.prices.list({
    ...params,
    product: options.productId,
    active: true,
  }));
  const existing = prices.find((price) => {
    const metadataKind = price.metadata?.attestor_price_kind;
    const recurring = price.recurring;
    const meterMatches = options.meterId === null
      ? !recurring?.meter
      : recurring?.meter === options.meterId;
    return metadataKind === options.kind
      && price.currency === 'usd'
      && price.type === 'recurring'
      && recurring?.interval === 'month'
      && recurring.interval_count === 1
      && recurring.usage_type === (options.kind === 'base' ? 'licensed' : 'metered')
      && meterMatches
      && decimalMatches(price.unit_amount_decimal ?? price.unit_amount, options.expectedUnitAmountDecimal);
  });
  if (existing) return existing;

  const nickname = options.kind === 'base'
    ? `${PLAN_PRODUCTS[options.planId].name} monthly`
    : `${PLAN_PRODUCTS[options.planId].name} admission overage`;

  return options.stripe.prices.create({
    currency: 'usd',
    product: options.productId,
    nickname,
    unit_amount_decimal: options.expectedUnitAmountDecimal,
    recurring: {
      interval: 'month',
      usage_type: options.kind === 'base' ? 'licensed' : 'metered',
      ...(options.meterId ? { meter: options.meterId } : {}),
    },
    metadata: {
      attestor_managed: 'true',
      attestor_plan: options.planId,
      attestor_price_kind: options.kind,
      ...(options.kind === 'overage' ? { attestor_meter_event: 'attestor_admission_overage' } : {}),
    },
  });
}

async function ensurePortalConfiguration(options: {
  stripe: Stripe;
  products: Record<PaidPlanId, Stripe.Product>;
  basePrices: Record<PaidPlanId, Stripe.Price>;
}): Promise<Stripe.BillingPortal.Configuration> {
  const productEntries = (Object.keys(PLAN_PRODUCTS) as PaidPlanId[]).map((planId) => ({
    product: options.products[planId].id,
    prices: [options.basePrices[planId].id],
    adjustable_quantity: {
      enabled: false,
    },
  }));
  const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
    customer_update: {
      enabled: true,
      allowed_updates: ['address', 'email', 'name', 'phone', 'tax_id'],
    },
    invoice_history: {
      enabled: true,
    },
    payment_method_update: {
      enabled: true,
    },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
      proration_behavior: 'none',
      cancellation_reason: {
        enabled: true,
        options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'],
      },
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      products: productEntries,
      proration_behavior: 'none',
      billing_cycle_anchor: 'unchanged',
      schedule_at_period_end: {
        conditions: [
          { type: 'decreasing_item_amount' },
          { type: 'shortening_interval' },
        ],
      },
    },
  };

  const activeDefaults = await options.stripe.billingPortal.configurations.list({
    active: true,
    is_default: true,
    limit: 1,
  });
  const existing = activeDefaults.data[0] ?? null;
  const update = {
    name: 'Attestor self-service portal',
    default_return_url: portalReturnUrl(),
    login_page: { enabled: false },
    business_profile: {
      headline: 'Manage your Attestor subscription.',
      privacy_policy_url: 'https://github.com/AI-gateway-systems/attestor',
      terms_of_service_url: 'https://github.com/AI-gateway-systems/attestor',
    },
    metadata: {
      attestor_managed: 'true',
    },
    features,
    expand: ['features.subscription_update.products'],
  };

  if (existing) {
    return options.stripe.billingPortal.configurations.update(existing.id, update);
  }
  return options.stripe.billingPortal.configurations.create(update);
}

async function ensureWebhookEndpoint(stripe: Stripe): Promise<{ endpoint: Stripe.WebhookEndpoint; secret: string | null; skipped: boolean }> {
  const url = expectedWebhookUrl();
  if (!url) {
    if (flag('skip-webhook')) {
      return { endpoint: null as unknown as Stripe.WebhookEndpoint, secret: null, skipped: true };
    }
    throw new Error('Set --webhook-url=<https://.../api/v1/billing/stripe/webhook>, ATTESTOR_STRIPE_WEBHOOK_URL, ATTESTOR_PUBLIC_BASE_URL, or ATTESTOR_PUBLIC_HOSTNAME.');
  }

  const endpoints = await listAll((params) => stripe.webhookEndpoints.list(params));
  const existing = endpoints.find((endpoint) => normalizeUrl(endpoint.url) === url);
  if (existing) {
    const endpoint = await stripe.webhookEndpoints.update(existing.id, {
      enabled_events: [...STRIPE_SUPPORTED_WEBHOOK_EVENTS],
      description: 'Attestor hosted billing and subscription webhook',
    });
    return { endpoint, secret: null, skipped: false };
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: [...STRIPE_SUPPORTED_WEBHOOK_EVENTS],
    description: 'Attestor hosted billing and subscription webhook',
  });
  return {
    endpoint,
    secret: endpoint.secret ?? null,
    skipped: false,
  };
}

async function main(): Promise<void> {
  const apiKey = requireStripeApiKey();
  const stripe = new Stripe(apiKey);
  const account = await tryRetrieveAccount(stripe);
  const meter = await ensureAdmissionMeter(stripe);
  const products = {} as Record<PaidPlanId, Stripe.Product>;
  const basePrices = {} as Record<PaidPlanId, Stripe.Price>;
  const overagePrices = {} as Record<PaidPlanId, Stripe.Price>;

  for (const planId of Object.keys(PLAN_PRODUCTS) as PaidPlanId[]) {
    products[planId] = await ensureProduct(stripe, planId);
    const baseExpectation = STRIPE_PRICE_EXPECTATIONS.find((entry) => entry.planId === planId && entry.kind === 'base');
    const overageExpectation = STRIPE_PRICE_EXPECTATIONS.find((entry) => entry.planId === planId && entry.kind === 'overage');
    if (!baseExpectation || !overageExpectation) {
      throw new Error(`Missing Stripe price expectation for plan '${planId}'.`);
    }
    basePrices[planId] = await ensurePrice({
      stripe,
      planId,
      productId: products[planId].id,
      kind: 'base',
      expectedUnitAmountDecimal: baseExpectation.expectedUnitAmountDecimal,
      meterId: null,
    });
    overagePrices[planId] = await ensurePrice({
      stripe,
      planId,
      productId: products[planId].id,
      kind: 'overage',
      expectedUnitAmountDecimal: overageExpectation.expectedUnitAmountDecimal,
      meterId: meter.id,
    });
  }

  const portal = await ensurePortalConfiguration({ stripe, products, basePrices });
  const webhook = await ensureWebhookEndpoint(stripe);

  const manifest = {
    account: {
      id: account.id,
      livemode: !apiKey.includes('_test_'),
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
      readAvailable: account.readAvailable,
      readWarning: account.readWarning,
    },
    env: {
      ATTESTOR_STRIPE_PRICE_STARTER: basePrices.starter.id,
      ATTESTOR_STRIPE_PRICE_PRO: basePrices.pro.id,
      ATTESTOR_STRIPE_PRICE_SCALE: basePrices.scale.id,
      ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER: overagePrices.starter.id,
      ATTESTOR_STRIPE_OVERAGE_PRICE_PRO: overagePrices.pro.id,
      ATTESTOR_STRIPE_OVERAGE_PRICE_SCALE: overagePrices.scale.id,
      ATTESTOR_STRIPE_OVERAGE_METER_EVENT_NAME: 'attestor_admission_overage',
      ATTESTOR_STRIPE_WEBHOOK_ENDPOINT_ID: webhook.skipped ? null : webhook.endpoint.id,
      STRIPE_WEBHOOK_SECRET: webhook.secret ? '<returned-on-create-see-secret-output>' : '<existing-or-reveal-in-stripe-dashboard>',
    },
    stripe: {
      products: Object.fromEntries((Object.keys(products) as PaidPlanId[]).map((planId) => [planId, products[planId].id])),
      meter: {
        id: meter.id,
        eventName: meter.event_name,
      },
      portal: {
        id: portal.id,
        active: portal.active,
        isDefault: portal.is_default,
      },
      webhook: webhook.skipped
        ? { skipped: true }
        : {
            skipped: false,
            id: webhook.endpoint.id,
            url: webhook.endpoint.url,
            status: webhook.endpoint.status,
            secretReturnedOnCreate: Boolean(webhook.secret),
            secret: webhook.secret ?? undefined,
          },
    },
    nextProbe: 'Run npm run probe:stripe-live-readiness with these env values. For test keys, add -- --allow-test-mode=true.',
  };

  console.log(JSON.stringify(manifest, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
