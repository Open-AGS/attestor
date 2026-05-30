import { pathToFileURL } from 'node:url';
import Stripe from 'stripe';
import {
  DEFAULT_WORKFLOW_STRIPE_OVERAGE_METER_EVENT_NAME,
  listWorkflowBillingTiers,
  type WorkflowBillingTierId,
} from '../../src/service/workflow-entitlement-catalog.js';

type PaidPlanId = WorkflowBillingTierId;

export interface StripePriceExpectation {
  planId: PaidPlanId;
  kind: 'base' | 'overage';
  displayName: string;
  envName: string;
  expectedCurrency: string;
  expectedUnitAmountDecimal: string;
  expectedInterval: 'month';
  expectedIntervalCount: number;
  expectedUsageType: 'licensed' | 'metered';
  expectedMeterEventName: string | null;
}

export interface StripePriceReadiness {
  planId: PaidPlanId;
  envName: string;
  configuredPriceId: string | null;
  active: boolean | null;
  livemode: boolean | null;
  currency: string | null;
  unitAmount: string | null;
  interval: string | null;
  intervalCount: number | null;
  usageType: string | null;
  meterId: string | null;
  meterEventName: string | null;
  productId: string | null;
  productActive: boolean | null;
  matchesExpected: boolean;
  issues: string[];
}

export interface StripeAccountReadiness {
  accountId: string | null;
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
  detailsSubmitted: boolean | null;
  country: string | null;
  defaultCurrency: string | null;
  currentlyDue: string[];
  disabledReason: string | null;
  issues: string[];
  warnings: string[];
}

export interface StripeCustomerPortalReadiness {
  activeConfigurationCount: number;
  defaultConfigurationId: string | null;
  defaultConfigurationActive: boolean | null;
  paymentMethodUpdateEnabled: boolean | null;
  invoiceHistoryEnabled: boolean | null;
  subscriptionCancelEnabled: boolean | null;
  subscriptionUpdateEnabled: boolean | null;
  subscriptionUpdateAllowedUpdates: string[];
  subscriptionUpdateProductCount: number | null;
  subscriptionUpdatePriceIds: string[];
  subscriptionUpdateMissingPriceIds: string[];
  subscriptionUpdateProrationBehavior: string | null;
  subscriptionUpdateScheduleAtPeriodEndConditions: string[];
  issues: string[];
  warnings: string[];
}

export interface StripeLiveReadinessSummary {
  apiKeyMode: 'live' | 'test' | 'unknown';
  allowTestMode: boolean;
  account: StripeAccountReadiness;
  prices: StripePriceReadiness[];
  customerPortal: StripeCustomerPortalReadiness;
  issues: string[];
  warnings: string[];
  ok: boolean;
}

export interface StripeReadinessClient {
  accounts: {
    retrieveCurrent(): Promise<Stripe.Account>;
  };
  prices: {
    retrieve(id: string): Promise<Stripe.Price>;
  };
  products: {
    retrieve(id: string): Promise<Stripe.Product | Stripe.DeletedProduct>;
  };
  billing: {
    meters: {
      retrieve(id: string): Promise<Stripe.Billing.Meter>;
    };
  };
  billingPortal: {
    configurations: {
      list(params: Stripe.BillingPortal.ConfigurationListParams): Promise<{ data: Stripe.BillingPortal.Configuration[] }>;
    };
  };
}

export interface StripeLiveReadinessProbeOptions {
  stripe?: StripeReadinessClient;
  env?: Record<string, string | undefined>;
  allowTestMode?: boolean;
}

export const STRIPE_PRICE_EXPECTATIONS: readonly StripePriceExpectation[] =
  Object.freeze(listWorkflowBillingTiers().flatMap((tier) => [
    {
      planId: tier.id,
      kind: 'base' as const,
      displayName: tier.publicName,
      envName: tier.basePriceEnvName,
      expectedCurrency: tier.currency,
      expectedUnitAmountDecimal: String(tier.unitAmountCents),
      expectedInterval: tier.interval,
      expectedIntervalCount: 1,
      expectedUsageType: 'licensed' as const,
      expectedMeterEventName: null,
    },
    ...(tier.overagePriceEnvName && tier.overageUnitAmountDecimal ? [{
      planId: tier.id,
      kind: 'overage' as const,
      displayName: `${tier.publicName} overage`,
      envName: tier.overagePriceEnvName,
      expectedCurrency: tier.currency,
      expectedUnitAmountDecimal: tier.overageUnitAmountDecimal,
      expectedInterval: tier.interval,
      expectedIntervalCount: 1,
      expectedUsageType: 'metered' as const,
      expectedMeterEventName: DEFAULT_WORKFLOW_STRIPE_OVERAGE_METER_EVENT_NAME,
    }] : []),
  ]));

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const entry = process.argv.find((candidate) => candidate.startsWith(prefix));
  return entry ? entry.slice(prefix.length).trim() : null;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function envValue(env: Record<string, string | undefined>, name: string): string | null {
  const value = env[name];
  return value && value.trim() ? value.trim() : null;
}

function apiKeyMode(apiKey: string | null): 'live' | 'test' | 'unknown' {
  if (!apiKey) return 'unknown';
  if (apiKey.startsWith('sk_live_') || apiKey.startsWith('rk_live_')) return 'live';
  if (apiKey.startsWith('sk_test_') || apiKey.startsWith('rk_test_')) return 'test';
  return 'unknown';
}

function createStripeClient(env: Record<string, string | undefined>): StripeReadinessClient {
  const apiKey = envValue(env, 'STRIPE_API_KEY');
  if (!apiKey) {
    throw new Error('STRIPE_API_KEY must be set to probe Stripe live readiness.');
  }
  return new Stripe(apiKey);
}

function productIdFromPrice(price: Stripe.Price): string | null {
  if (typeof price.product === 'string') return price.product;
  if (!price.product || 'deleted' in price.product) return null;
  return price.product.id;
}

function productActive(product: Stripe.Product | Stripe.DeletedProduct): boolean | null {
  if ('deleted' in product && product.deleted) return false;
  if ('active' in product) return product.active;
  return null;
}

function priceInterval(price: Stripe.Price): string | null {
  return price.recurring?.interval ?? null;
}

function priceIntervalCount(price: Stripe.Price): number | null {
  return price.recurring?.interval_count ?? null;
}

function priceUsageType(price: Stripe.Price): string | null {
  return price.recurring?.usage_type ?? null;
}

function priceMeterId(price: Stripe.Price): string | null {
  return price.recurring?.meter ?? null;
}

function priceUnitAmount(price: Stripe.Price): string | null {
  const decimal = price.unit_amount_decimal as unknown;
  if (typeof decimal === 'string' && decimal.trim() !== '') return decimal.trim();
  if (decimal && typeof decimal === 'object' && typeof (decimal as { toString?: unknown }).toString === 'function') {
    const serialized = (decimal as { toString: () => string }).toString().trim();
    if (serialized !== '' && serialized !== '[object Object]') return serialized;
  }
  return typeof price.unit_amount === 'number' ? String(price.unit_amount) : null;
}

function decimalAmountsMatch(actual: string | null, expected: string): boolean {
  if (actual === null) return false;
  return Number(actual) === Number(expected);
}

function sortedUnique(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter((value) => value.trim() !== ''))).sort();
}

function requiredPortalPriceIds(env: Record<string, string | undefined>): string[] {
  return sortedUnique(STRIPE_PRICE_EXPECTATIONS
    .filter((expectation) => expectation.kind === 'base')
    .map((expectation) => envValue(env, expectation.envName))
    .filter((value): value is string => value !== null));
}

async function evaluateAccount(stripe: StripeReadinessClient): Promise<StripeAccountReadiness> {
  const issues: string[] = [];
  const warnings: string[] = [];
  const account = await stripe.accounts.retrieveCurrent();
  const currentlyDue = account.requirements?.currently_due ?? [];
  const disabledReason = account.requirements?.disabled_reason ?? null;

  if (account.details_submitted !== true) {
    issues.push('Stripe account details are not fully submitted.');
  }
  if (account.charges_enabled !== true) {
    issues.push('Stripe charges are not enabled.');
  }
  if (account.payouts_enabled !== true) {
    issues.push('Stripe payouts are not enabled; connect a payout bank account before calling billing commercially live.');
  }
  if (currentlyDue.length > 0) {
    issues.push(`Stripe account still has currently_due requirement(s): ${currentlyDue.join(', ')}`);
  }
  if (disabledReason) {
    issues.push(`Stripe account has disabled_reason: ${disabledReason}`);
  }
  if (!account.business_profile?.url && !account.business_profile?.name) {
    warnings.push('Stripe business profile name or URL is not visible in the account response.');
  }

  return {
    accountId: account.id,
    chargesEnabled: account.charges_enabled ?? null,
    payoutsEnabled: account.payouts_enabled ?? null,
    detailsSubmitted: account.details_submitted ?? null,
    country: account.country ?? null,
    defaultCurrency: account.default_currency ?? null,
    currentlyDue,
    disabledReason,
    issues,
    warnings,
  };
}

async function evaluatePrice(
  stripe: StripeReadinessClient,
  env: Record<string, string | undefined>,
  expectation: StripePriceExpectation,
  allowTestMode: boolean,
): Promise<StripePriceReadiness> {
  const issues: string[] = [];
  const priceId = envValue(env, expectation.envName);

  if (!priceId) {
    issues.push(`${expectation.envName} is not configured.`);
    return {
      planId: expectation.planId,
      envName: expectation.envName,
      configuredPriceId: null,
      active: null,
      livemode: null,
      currency: null,
      unitAmount: null,
      interval: null,
      intervalCount: null,
      usageType: null,
      meterId: null,
      meterEventName: null,
      productId: null,
      productActive: null,
      matchesExpected: false,
      issues,
    };
  }

  try {
    const price = await stripe.prices.retrieve(priceId);
    const productId = productIdFromPrice(price);
    let retrievedProductActive: boolean | null = null;
    if (productId) {
      const product = await stripe.products.retrieve(productId);
      retrievedProductActive = productActive(product);
    }

    const interval = priceInterval(price);
    const intervalCount = priceIntervalCount(price);
    const usageType = priceUsageType(price);
    const meterId = priceMeterId(price);
    const unitAmount = priceUnitAmount(price);
    let meterEventName: string | null = null;
    if (meterId) {
      const meter = await stripe.billing.meters.retrieve(meterId);
      meterEventName = meter.event_name;
      if (meter.status !== 'active') {
        issues.push(`${expectation.displayName} Stripe meter is ${meter.status}, expected active.`);
      }
      if (!allowTestMode && meter.livemode !== true) {
        issues.push(`${expectation.displayName} Stripe meter is not a live-mode meter.`);
      }
    }
    if (price.active !== true) issues.push(`${expectation.displayName} Stripe price is not active.`);
    if (!allowTestMode && price.livemode !== true) issues.push(`${expectation.displayName} Stripe price is not a live-mode price.`);
    if (price.currency !== expectation.expectedCurrency) {
      issues.push(`${expectation.displayName} Stripe price currency is ${price.currency}, expected ${expectation.expectedCurrency}.`);
    }
    if (!decimalAmountsMatch(unitAmount, expectation.expectedUnitAmountDecimal)) {
      issues.push(`${expectation.displayName} Stripe price amount is ${unitAmount ?? 'null'}, expected ${expectation.expectedUnitAmountDecimal}.`);
    }
    if (price.type !== 'recurring') issues.push(`${expectation.displayName} Stripe price is not recurring.`);
    if (interval !== expectation.expectedInterval) {
      issues.push(`${expectation.displayName} Stripe price interval is ${interval ?? 'null'}, expected ${expectation.expectedInterval}.`);
    }
    if (intervalCount !== expectation.expectedIntervalCount) {
      issues.push(`${expectation.displayName} Stripe price interval_count is ${intervalCount ?? 'null'}, expected ${expectation.expectedIntervalCount}.`);
    }
    if (usageType !== expectation.expectedUsageType) {
      issues.push(`${expectation.displayName} Stripe price usage_type is ${usageType ?? 'null'}, expected ${expectation.expectedUsageType}.`);
    }
    if (expectation.expectedMeterEventName && !meterId) {
      issues.push(`${expectation.displayName} Stripe price must be attached to a billing meter.`);
    }
    if (expectation.expectedMeterEventName && meterEventName !== expectation.expectedMeterEventName) {
      issues.push(`${expectation.displayName} Stripe meter event_name is ${meterEventName ?? 'null'}, expected ${expectation.expectedMeterEventName}.`);
    }
    if (!expectation.expectedMeterEventName && meterId) {
      issues.push(`${expectation.displayName} Stripe base price must not be attached to a metered usage meter.`);
    }
    if (retrievedProductActive !== true) issues.push(`${expectation.displayName} Stripe product is not active.`);

    return {
      planId: expectation.planId,
      envName: expectation.envName,
      configuredPriceId: priceId,
      active: price.active,
      livemode: price.livemode,
      currency: price.currency,
      unitAmount,
      interval,
      intervalCount,
      usageType,
      meterId,
      meterEventName,
      productId,
      productActive: retrievedProductActive,
      matchesExpected: issues.length === 0,
      issues,
    };
  } catch (error) {
    issues.push(`${expectation.displayName} Stripe price '${priceId}' could not be retrieved: ${error instanceof Error ? error.message : String(error)}`);
    return {
      planId: expectation.planId,
      envName: expectation.envName,
      configuredPriceId: priceId,
      active: null,
      livemode: null,
      currency: null,
      unitAmount: null,
      interval: null,
      intervalCount: null,
      usageType: null,
      meterId: null,
      meterEventName: null,
      productId: null,
      productActive: null,
      matchesExpected: false,
      issues,
    };
  }
}

async function evaluateCustomerPortal(
  stripe: StripeReadinessClient,
  requiredPriceIds: string[],
): Promise<StripeCustomerPortalReadiness> {
  const issues: string[] = [];
  const warnings: string[] = [];
  const configurations = await stripe.billingPortal.configurations.list({
    active: true,
    is_default: true,
    limit: 10,
    expand: ['data.features.subscription_update.products'],
  });
  const defaultConfiguration = configurations.data[0] ?? null;

  if (!defaultConfiguration) {
    issues.push('No active default Stripe Customer Portal configuration was found.');
    return {
      activeConfigurationCount: 0,
      defaultConfigurationId: null,
      defaultConfigurationActive: null,
      paymentMethodUpdateEnabled: null,
      invoiceHistoryEnabled: null,
      subscriptionCancelEnabled: null,
      subscriptionUpdateEnabled: null,
      subscriptionUpdateAllowedUpdates: [],
      subscriptionUpdateProductCount: null,
      subscriptionUpdatePriceIds: [],
      subscriptionUpdateMissingPriceIds: requiredPriceIds,
      subscriptionUpdateProrationBehavior: null,
      subscriptionUpdateScheduleAtPeriodEndConditions: [],
      issues,
      warnings,
    };
  }

  const paymentMethodUpdateEnabled = defaultConfiguration.features.payment_method_update.enabled;
  const invoiceHistoryEnabled = defaultConfiguration.features.invoice_history.enabled;
  const subscriptionCancelEnabled = defaultConfiguration.features.subscription_cancel.enabled;
  const subscriptionUpdateEnabled = defaultConfiguration.features.subscription_update.enabled;
  const subscriptionUpdate = defaultConfiguration.features.subscription_update;
  const subscriptionUpdateAllowedUpdates = sortedUnique(subscriptionUpdate.default_allowed_updates ?? []);
  const subscriptionUpdateProducts = subscriptionUpdate.products ?? [];
  const subscriptionUpdatePriceIds = sortedUnique(subscriptionUpdateProducts.flatMap((product) => product.prices ?? []));
  const subscriptionUpdateMissingPriceIds = requiredPriceIds.filter((priceId) => !subscriptionUpdatePriceIds.includes(priceId));
  const subscriptionUpdateProrationBehavior = subscriptionUpdate.proration_behavior ?? null;
  const subscriptionUpdateScheduleAtPeriodEndConditions = sortedUnique(
    subscriptionUpdate.schedule_at_period_end?.conditions?.map((condition) => condition.type) ?? [],
  );

  if (paymentMethodUpdateEnabled !== true) {
    warnings.push('Default Stripe Customer Portal does not allow customers to update payment methods.');
  }
  if (invoiceHistoryEnabled !== true) {
    warnings.push('Default Stripe Customer Portal does not expose invoice history.');
  }
  if (subscriptionCancelEnabled !== true && subscriptionUpdateEnabled !== true) {
    warnings.push('Default Stripe Customer Portal does not enable subscription cancel or update actions.');
  }
  if (subscriptionUpdateEnabled !== true) {
    issues.push(
      'Default Stripe Customer Portal must allow subscription price updates ' +
      'for Pilot/Starter/Pro Workflow self-service changes.',
    );
  }
  if (!subscriptionUpdateAllowedUpdates.includes('price')) {
    issues.push('Default Stripe Customer Portal subscription updates must allow price changes.');
  }
  if (subscriptionUpdateAllowedUpdates.includes('quantity')) {
    issues.push(
      'Default Stripe Customer Portal subscription updates must not allow ' +
      'quantity changes; Attestor workflow entitlements are bound to ' +
      'workflow ids, not seat quantities.',
    );
  }
  if (subscriptionUpdateMissingPriceIds.length > 0) {
    issues.push(`Default Stripe Customer Portal subscription update products are missing configured price id(s): ${subscriptionUpdateMissingPriceIds.join(', ')}.`);
  }
  if (subscriptionUpdateProrationBehavior !== 'none') {
    issues.push(`Default Stripe Customer Portal subscription update proration_behavior is ${subscriptionUpdateProrationBehavior ?? 'null'}, expected none.`);
  }
  for (const requiredCondition of ['decreasing_item_amount', 'shortening_interval']) {
    if (!subscriptionUpdateScheduleAtPeriodEndConditions.includes(requiredCondition)) {
      warnings.push(`Default Stripe Customer Portal does not schedule '${requiredCondition}' changes at period end.`);
    }
  }

  return {
    activeConfigurationCount: configurations.data.length,
    defaultConfigurationId: defaultConfiguration.id,
    defaultConfigurationActive: defaultConfiguration.active,
    paymentMethodUpdateEnabled,
    invoiceHistoryEnabled,
    subscriptionCancelEnabled,
    subscriptionUpdateEnabled,
    subscriptionUpdateAllowedUpdates,
    subscriptionUpdateProductCount: subscriptionUpdateProducts.length,
    subscriptionUpdatePriceIds,
    subscriptionUpdateMissingPriceIds,
    subscriptionUpdateProrationBehavior,
    subscriptionUpdateScheduleAtPeriodEndConditions,
    issues,
    warnings,
  };
}

export function requiredStripePriceManifest(): StripePriceExpectation[] {
  return STRIPE_PRICE_EXPECTATIONS.map((expectation) => ({ ...expectation }));
}

export async function probeStripeLiveReadiness(
  options: StripeLiveReadinessProbeOptions = {},
): Promise<StripeLiveReadinessSummary> {
  const env = options.env ?? process.env;
  const allowTestMode = options.allowTestMode ?? false;
  const stripe = options.stripe ?? createStripeClient(env);
  const mode = apiKeyMode(envValue(env, 'STRIPE_API_KEY'));
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!allowTestMode && mode !== 'live') {
    issues.push('STRIPE_API_KEY must be a live-mode key for commercial readiness.');
  }
  if (envValue(env, 'ATTESTOR_STRIPE_PRICE_SCALE')) {
    warnings.push(
      'ATTESTOR_STRIPE_PRICE_SCALE is configured. Keep Scale out of ' +
      'self-service workflow launch unless intentionally re-enabled.',
    );
  }
  if (envValue(env, 'ATTESTOR_STRIPE_PRICE_ENTERPRISE')) {
    warnings.push('ATTESTOR_STRIPE_PRICE_ENTERPRISE is configured. Keep Enterprise self-service checkout disabled unless intentionally enabled.');
  }
  const portalPriceIds = requiredPortalPriceIds(env);

  const [account, customerPortal, prices] = await Promise.all([
    evaluateAccount(stripe),
    evaluateCustomerPortal(stripe, portalPriceIds),
    Promise.all(STRIPE_PRICE_EXPECTATIONS.map((expectation) => evaluatePrice(stripe, env, expectation, allowTestMode))),
  ]);

  issues.push(...account.issues, ...customerPortal.issues, ...prices.flatMap((price) => price.issues));
  warnings.push(...account.warnings, ...customerPortal.warnings);

  return {
    apiKeyMode: mode,
    allowTestMode,
    account,
    prices,
    customerPortal,
    issues,
    warnings,
    ok: issues.length === 0,
  };
}

async function main(): Promise<void> {
  if (flag('print-required-prices')) {
    console.log(JSON.stringify({
      requiredPrices: requiredStripePriceManifest(),
      requiredCustomerPortal: {
        subscriptionUpdateEnabled: true,
        defaultAllowedUpdates: ['price'],
        forbiddenAllowedUpdates: ['quantity'],
        prorationBehavior: 'none',
        scheduleAtPeriodEndConditions: ['decreasing_item_amount', 'shortening_interval'],
        priceEnvVars: STRIPE_PRICE_EXPECTATIONS
          .filter((expectation) => expectation.kind === 'base')
          .map((expectation) => expectation.envName),
      },
      requiredMeterEvent: {
        eventName: DEFAULT_WORKFLOW_STRIPE_OVERAGE_METER_EVENT_NAME,
        customerPayloadKey: 'stripe_customer_id',
        valuePayloadKey: 'value',
        defaultAggregation: 'sum',
      },
      note:
        'Create or update these live recurring workflow base and metered ' +
        'overage prices, map the ids to the listed env vars, then run this ' +
        'probe with STRIPE_API_KEY.',
    }, null, 2));
    return;
  }

  const summary = await probeStripeLiveReadiness({
    allowTestMode: flag('allow-test-mode') || arg('allow-test-mode') === 'true',
  });
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) {
    throw new Error(`Stripe commercial readiness failed with ${summary.issues.length} issue(s).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
