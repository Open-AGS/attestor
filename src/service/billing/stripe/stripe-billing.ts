/**
 * Stripe Billing - workflow checkout, customer portal, and billing export
 *
 * BOUNDARY:
 * - Stripe-hosted checkout and portal
 * - Live billing export can read invoices, charges, line items, and active entitlements
 * - Supports a deterministic mock mode for local integration tests
 */

import { createHash } from 'node:crypto';
import Stripe from 'stripe';
import type { HostedAccountRecord } from '../../account/account-store.js';
import type { TenantContext } from '../../tenant-isolation.js';
import {
  resolveWorkflowTierStripeOveragePrice,
  resolveWorkflowTierStripePrice,
  type WorkflowBillingTierId,
  type WorkflowConsequencePackId,
} from '../../workflow-entitlement-catalog.js';
import {
  buildWorkflowStripeMetadata,
  tenantWorkflowMetadataDigest,
  type StoredWorkflowEntitlementRecord,
  type WorkflowCheckoutAction,
  type WorkflowUsageContext,
} from '../../workflow-entitlement-store.js';

export class StripeBillingError extends Error {
  constructor(
    public readonly code: 'DISABLED' | 'CONFIG' | 'PLAN_UNAVAILABLE' | 'NO_CUSTOMER',
    message: string,
  ) {
    super(message);
    this.name = 'StripeBillingError';
  }
}

let cachedStripeClient: Stripe | null = null;

function useMockStripeBilling(): boolean {
  return process.env.ATTESTOR_STRIPE_USE_MOCK === 'true';
}

function requireStripeApiKey(): string {
  const key = process.env.STRIPE_API_KEY?.trim();
  if (!key) {
    throw new StripeBillingError(
      'DISABLED',
      'Stripe billing routes are disabled. Set STRIPE_API_KEY to enable hosted checkout and portal sessions.',
    );
  }
  return key;
}

function stripeClient(): Stripe {
  if (useMockStripeBilling()) {
    return new Stripe('sk_test_attestor_mock');
  }
  if (!cachedStripeClient) {
    cachedStripeClient = new Stripe(requireStripeApiKey());
  }
  return cachedStripeClient;
}

function requiredUrl(envName: 'ATTESTOR_BILLING_SUCCESS_URL' | 'ATTESTOR_BILLING_CANCEL_URL' | 'ATTESTOR_BILLING_PORTAL_RETURN_URL'): string {
  const value = process.env[envName]?.trim();
  if (!value) {
    throw new StripeBillingError('CONFIG', `${envName} must be set for hosted Stripe billing flows.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new StripeBillingError('CONFIG', `${envName} must be a valid absolute URL for hosted Stripe billing flows.`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new StripeBillingError('CONFIG', `${envName} must use http:// or https:// for hosted Stripe billing flows.`);
  }
  return parsed.toString();
}

function workflowPriceOrThrow(tierId: WorkflowBillingTierId): { tierId: WorkflowBillingTierId; priceId: string } {
  const resolved = resolveWorkflowTierStripePrice(tierId);
  if (!resolved.knownTier || !resolved.priceId) {
    throw new StripeBillingError(
      'PLAN_UNAVAILABLE',
      `Stripe workflow price not configured for tier '${tierId}'. Set ${resolved.envName || 'ATTESTOR_STRIPE_PRICE_<WORKFLOW_TIER>'} first.`,
    );
  }
  return {
    tierId: resolved.tierId as WorkflowBillingTierId,
    priceId: resolved.priceId,
  };
}

function workflowOveragePriceOrThrow(tierId: WorkflowBillingTierId): {
  priceId: string | null;
  meterEventName: string;
} {
  const resolved = resolveWorkflowTierStripeOveragePrice(tierId);
  if (resolved.billable && !resolved.priceId) {
    throw new StripeBillingError(
      'PLAN_UNAVAILABLE',
      `Stripe workflow overage price not configured for tier '${tierId}'. Set ${resolved.envName} first.`,
    );
  }
  return {
    priceId: resolved.priceId,
    meterEventName: resolved.meterEventName,
  };
}

export interface HostedBillingPortalSessionResult {
  sessionId: string;
  url: string;
  mock: boolean;
}

export interface HostedWorkflowCheckoutSessionResult {
  sessionId: string;
  url: string;
  workflowId: string;
  workflowAction: WorkflowCheckoutAction;
  tier: WorkflowBillingTierId;
  consequencePack: WorkflowConsequencePackId;
  stripePriceId: string;
  stripeOveragePriceId: string | null;
  mode: 'subscription';
  mock: boolean;
}

export interface HostedStripeInvoiceSnapshot {
  invoiceId: string;
  status: string | null;
  currency: string | null;
  amountPaid: number | null;
  amountDue: number | null;
  subscriptionId: string | null;
  priceId: string | null;
  billingReason: string | null;
  createdAt: string | null;
  paidAt: string | null;
  source: 'stripe_live' | 'mock_summary';
}

export interface HostedStripeChargeSnapshot {
  chargeId: string | null;
  invoiceId: string | null;
  amount: number | null;
  amountRefunded: number | null;
  currency: string | null;
  status: 'succeeded' | 'pending' | 'failed' | null;
  paid: boolean | null;
  refunded: boolean | null;
  createdAt: string | null;
  source: 'stripe_live' | 'mock_summary';
}

export interface HostedStripeActiveEntitlementSnapshot {
  entitlementId: string;
  lookupKey: string;
  featureId: string | null;
  source: 'stripe_live' | 'stripe_webhook';
}

export interface HostedStripeInvoiceLineItemSnapshot {
  lineItemId: string;
  invoiceId: string;
  subscriptionId: string | null;
  priceId: string | null;
  description: string | null;
  currency: string | null;
  amount: number | null;
  subtotal: number | null;
  quantity: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  proration: boolean | null;
  captureMode: 'full' | 'partial';
  source: 'stripe_live' | 'stripe_webhook' | 'mock_summary';
}

export interface HostedStripeBillingSnapshot {
  source: 'stripe_live' | 'mock_summary' | 'no_customer';
  mock: boolean;
  customerId: string | null;
  invoices: HostedStripeInvoiceSnapshot[];
  charges: HostedStripeChargeSnapshot[];
  lineItems: HostedStripeInvoiceLineItemSnapshot[];
  entitlements: HostedStripeActiveEntitlementSnapshot[];
}

export interface StripeOverageMeteringResult {
  provider: 'stripe';
  status: 'not_applicable' | 'skipped' | 'mock_recorded' | 'sent' | 'failed';
  reason: string | null;
  eventName: string | null;
  eventIdentifier: string | null;
  value: number;
  mock: boolean;
}

function stripeReferenceId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return ((value as { id: string }).id).trim();
  }
  return null;
}

function stripeFeatureId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return ((value as { id: string }).id).trim();
  }
  return null;
}

function unixSecondsToIso(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? new Date(value * 1000).toISOString()
    : null;
}

function stripeInvoicePriceId(invoice: Stripe.Invoice): string | null {
  for (const entry of invoice.lines?.data ?? []) {
    const directPriceId = stripeReferenceId((entry as { price?: unknown }).price);
    if (directPriceId) return directPriceId;
    const pricingPriceId = stripeReferenceId(
      (entry as { pricing?: { price_details?: { price?: unknown } | null } | null }).pricing?.price_details?.price,
    );
    if (pricingPriceId) return pricingPriceId;
  }
  return null;
}

function stripeInvoiceLineItemPriceId(lineItem: Stripe.InvoiceLineItem): string | null {
  const directPriceId = stripeReferenceId((lineItem as { price?: unknown }).price);
  if (directPriceId) return directPriceId;
  return stripeReferenceId(lineItem.pricing?.price_details?.price);
}

function stripeInvoiceLineItemProration(lineItem: Stripe.InvoiceLineItem): boolean | null {
  const invoiceItemDetails = lineItem.parent?.invoice_item_details;
  if (invoiceItemDetails && typeof invoiceItemDetails.proration === 'boolean') {
    return invoiceItemDetails.proration;
  }
  const subscriptionItemDetails = lineItem.parent?.subscription_item_details;
  if (subscriptionItemDetails && typeof subscriptionItemDetails.proration === 'boolean') {
    return subscriptionItemDetails.proration;
  }
  return null;
}

function mapStripeInvoiceLineItem(
  lineItem: Stripe.InvoiceLineItem,
  source: HostedStripeInvoiceLineItemSnapshot['source'],
  captureMode: HostedStripeInvoiceLineItemSnapshot['captureMode'],
): HostedStripeInvoiceLineItemSnapshot {
  return {
    lineItemId: lineItem.id,
    invoiceId: stripeReferenceId(lineItem.invoice) ?? 'invoice_missing',
    subscriptionId: stripeReferenceId(lineItem.subscription),
    priceId: stripeInvoiceLineItemPriceId(lineItem),
    description: typeof lineItem.description === 'string' ? lineItem.description : null,
    currency: typeof lineItem.currency === 'string' ? lineItem.currency : null,
    amount: typeof lineItem.amount === 'number' ? lineItem.amount : null,
    subtotal: typeof lineItem.subtotal === 'number' ? lineItem.subtotal : null,
    quantity: typeof lineItem.quantity === 'number' ? lineItem.quantity : null,
    periodStart: unixSecondsToIso(lineItem.period?.start),
    periodEnd: unixSecondsToIso(lineItem.period?.end),
    proration: stripeInvoiceLineItemProration(lineItem),
    captureMode,
    source,
  };
}

export function extractInvoiceLineItemSnapshotsFromInvoice(invoice: Stripe.Invoice): {
  lineItems: HostedStripeInvoiceLineItemSnapshot[];
  hasMore: boolean;
} {
  const lines = invoice.lines?.data ?? [];
  const hasMore = Boolean((invoice.lines as { has_more?: unknown } | null | undefined)?.has_more);
  return {
    lineItems: lines.map((lineItem) => mapStripeInvoiceLineItem(lineItem, 'stripe_webhook', hasMore ? 'partial' : 'full')),
    hasMore,
  };
}

export async function listHostedStripeInvoiceLineItems(options: {
  invoiceId: string;
  limit?: number;
}): Promise<HostedStripeInvoiceLineItemSnapshot[]> {
  if (!options.invoiceId?.trim() || useMockStripeBilling()) return [];
  const pageSize = 100;
  const maxRecords = Math.max(1, Math.min(5_000, options.limit ?? 1_000));
  const records: HostedStripeInvoiceLineItemSnapshot[] = [];
  let startingAfter: string | undefined;

  while (records.length < maxRecords) {
    const remaining = maxRecords - records.length;
    const page = await stripeClient().invoices.listLineItems(options.invoiceId, {
      limit: Math.min(pageSize, remaining),
      starting_after: startingAfter,
    });
    if (page.data.length === 0) break;
    records.push(...page.data.map((lineItem) => mapStripeInvoiceLineItem(lineItem, 'stripe_live', 'full')));
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }

  return records;
}

function mapStripeActiveEntitlement(
  record: Stripe.Entitlements.ActiveEntitlement,
  source: HostedStripeActiveEntitlementSnapshot['source'],
): HostedStripeActiveEntitlementSnapshot {
  return {
    entitlementId: record.id,
    lookupKey: record.lookup_key,
    featureId: stripeFeatureId(record.feature),
    source,
  };
}

export function extractActiveEntitlementsFromSummary(
  summary: Stripe.Entitlements.ActiveEntitlementSummary,
): HostedStripeActiveEntitlementSnapshot[] {
  const entries = Array.isArray(summary.entitlements?.data) ? summary.entitlements.data : [];
  return entries.map((entry) => mapStripeActiveEntitlement(entry, 'stripe_webhook'));
}

export async function listHostedStripeActiveEntitlements(options: {
  customerId: string;
  limit?: number;
}): Promise<HostedStripeActiveEntitlementSnapshot[]> {
  if (!options.customerId?.trim() || useMockStripeBilling()) return [];
  const pageSize = 100;
  const maxRecords = Math.max(1, Math.min(5_000, options.limit ?? 1_000));
  const records: HostedStripeActiveEntitlementSnapshot[] = [];
  let startingAfter: string | undefined;

  while (records.length < maxRecords) {
    const remaining = maxRecords - records.length;
    const page = await stripeClient().entitlements.activeEntitlements.list({
      customer: options.customerId,
      limit: Math.min(pageSize, remaining),
      starting_after: startingAfter,
      expand: ['data.feature'],
    });
    if (page.data.length === 0) break;
    records.push(...page.data.map((entry) => mapStripeActiveEntitlement(entry, 'stripe_live')));
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }

  return records;
}

export async function createHostedWorkflowCheckoutSession(options: {
  account: HostedAccountRecord;
  tenant: TenantContext;
  workflowAction: WorkflowCheckoutAction;
  workflowId: string;
  tier: WorkflowBillingTierId;
  consequencePack: WorkflowConsequencePackId;
  downstreamSystemRefDigest: string | null;
  policyGatePathRefDigest: string | null;
  idempotencyKey: string;
}): Promise<HostedWorkflowCheckoutSessionResult> {
  const { tierId, priceId } = workflowPriceOrThrow(options.tier);
  const { priceId: overagePriceId } = workflowOveragePriceOrThrow(options.tier);
  const successUrl = requiredUrl('ATTESTOR_BILLING_SUCCESS_URL');
  const cancelUrl = requiredUrl('ATTESTOR_BILLING_CANCEL_URL');
  const idempotencyKey = options.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new StripeBillingError(
      'CONFIG',
      'Idempotency-Key header is required for hosted workflow checkout session creation.',
    );
  }

  if (useMockStripeBilling()) {
    const token = Buffer.from(
      `${options.account.id}:${options.workflowId}:${tierId}:${idempotencyKey}`,
      'utf8',
    ).toString('base64url').slice(0, 32);
    return {
      sessionId: `cs_mock_wf_${token}`,
      url: `https://billing.stripe.test/workflow-checkout/${token}`,
      workflowId: options.workflowId,
      workflowAction: options.workflowAction,
      tier: tierId,
      consequencePack: options.consequencePack,
      stripePriceId: priceId,
      stripeOveragePriceId: overagePriceId,
      mode: 'subscription',
      mock: true,
    };
  }

  const metadata = buildWorkflowStripeMetadata({
    accountId: options.account.id,
    tenantDigest: tenantWorkflowMetadataDigest(options.tenant.tenantId),
    workflowId: options.workflowId,
    tier: tierId,
    consequencePack: options.consequencePack,
    downstreamSystemRefDigest: options.downstreamSystemRefDigest,
    policyGatePathRefDigest: options.policyGatePathRefDigest,
  });

  const session = await stripeClient().checkout.sessions.create({
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      { price: priceId, quantity: 1 },
      ...(overagePriceId ? [{ price: overagePriceId }] : []),
    ],
    customer: options.account.billing.stripeCustomerId ?? undefined,
    customer_email: options.account.billing.stripeCustomerId ? undefined : options.account.contactEmail,
    metadata,
    subscription_data: { metadata },
    allow_promotion_codes: true,
  }, {
    idempotencyKey,
  });

  if (!session.url) {
    throw new StripeBillingError('CONFIG', 'Stripe workflow checkout session did not return a hosted URL.');
  }

  return {
    sessionId: session.id,
    url: session.url,
    workflowId: options.workflowId,
    workflowAction: options.workflowAction,
    tier: tierId,
    consequencePack: options.consequencePack,
    stripePriceId: priceId,
    stripeOveragePriceId: overagePriceId,
    mode: 'subscription',
    mock: false,
  };
}

function workflowMeterEventIdentifier(options: {
  workflowId: string;
  accountId: string;
  tenantId: string;
  tier: string;
  meter: string;
  period: string;
  used: number;
}): string {
  const digest = createHash('sha256')
    .update(JSON.stringify({
      workflowId: options.workflowId,
      accountId: options.accountId,
      tenantId: options.tenantId,
      tier: options.tier,
      meter: options.meter,
      period: options.period,
      used: options.used,
    }))
    .digest('hex')
    .slice(0, 40);
  return `attestor_wf_${digest}`;
}

export async function recordWorkflowStripeOverageMeterEvent(options: {
  entitlement: StoredWorkflowEntitlementRecord;
  usage: WorkflowUsageContext;
}): Promise<StripeOverageMeteringResult> {
  if (!options.usage.overage || options.usage.overageUnits <= 0) {
    return {
      provider: 'stripe',
      status: 'not_applicable',
      reason: 'workflow_usage_within_included_quota',
      eventName: null,
      eventIdentifier: null,
      value: 0,
      mock: useMockStripeBilling(),
    };
  }

  const overagePrice = resolveWorkflowTierStripeOveragePrice(options.entitlement.tier);
  if (!overagePrice.billable) {
    return {
      provider: 'stripe',
      status: 'not_applicable',
      reason: 'workflow_tier_not_metered_for_overage',
      eventName: overagePrice.meterEventName,
      eventIdentifier: null,
      value: 0,
      mock: useMockStripeBilling(),
    };
  }
  if (!overagePrice.priceId) {
    return {
      provider: 'stripe',
      status: 'failed',
      reason: `Stripe workflow overage price is not configured for tier '${overagePrice.tierId}'.`,
      eventName: overagePrice.meterEventName,
      eventIdentifier: null,
      value: 1,
      mock: useMockStripeBilling(),
    };
  }

  const stripeCustomerId = options.entitlement.stripeCustomerId;
  if (!stripeCustomerId) {
    return {
      provider: 'stripe',
      status: 'skipped',
      reason: 'workflow entitlement has no Stripe customer id',
      eventName: overagePrice.meterEventName,
      eventIdentifier: null,
      value: 1,
      mock: useMockStripeBilling(),
    };
  }

  const identifier = workflowMeterEventIdentifier({
    workflowId: options.entitlement.workflowId,
    accountId: options.entitlement.accountId,
    tenantId: options.entitlement.tenantId,
    tier: options.entitlement.tier,
    meter: options.usage.meter,
    period: options.usage.period,
    used: options.usage.used,
  });

  if (useMockStripeBilling()) {
    return {
      provider: 'stripe',
      status: 'mock_recorded',
      reason: null,
      eventName: overagePrice.meterEventName,
      eventIdentifier: identifier,
      value: 1,
      mock: true,
    };
  }

  try {
    await stripeClient().billing.meterEvents.create({
      event_name: overagePrice.meterEventName,
      identifier,
      payload: {
        stripe_customer_id: stripeCustomerId,
        value: '1',
      },
      timestamp: Math.floor(Date.now() / 1000),
    }, {
      idempotencyKey: identifier,
    });
    return {
      provider: 'stripe',
      status: 'sent',
      reason: null,
      eventName: overagePrice.meterEventName,
      eventIdentifier: identifier,
      value: 1,
      mock: false,
    };
  } catch (error) {
    return {
      provider: 'stripe',
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
      eventName: overagePrice.meterEventName,
      eventIdentifier: identifier,
      value: 1,
      mock: false,
    };
  }
}

export async function createHostedBillingPortalSession(options: {
  account: HostedAccountRecord;
}): Promise<HostedBillingPortalSessionResult> {
  const customerId = options.account.billing.stripeCustomerId;
  if (!customerId) {
    throw new StripeBillingError(
      'NO_CUSTOMER',
      `Hosted account '${options.account.id}' does not have a Stripe customer id yet.`,
    );
  }

  const returnUrl = requiredUrl('ATTESTOR_BILLING_PORTAL_RETURN_URL');

  if (useMockStripeBilling()) {
    return {
      sessionId: `bps_mock_${options.account.id}`,
      url: `https://billing.stripe.test/portal/${options.account.id}`,
      mock: true,
    };
  }

  const session = await stripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return {
    sessionId: session.id,
    url: session.url,
    mock: false,
  };
}

export async function exportHostedStripeBillingSnapshot(options: {
  account: HostedAccountRecord;
  limit: number;
}): Promise<HostedStripeBillingSnapshot> {
  const customerId = options.account.billing.stripeCustomerId;
  if (!customerId) {
    return {
      source: 'no_customer',
      mock: useMockStripeBilling(),
      customerId: null,
      invoices: [],
      charges: [],
      lineItems: [],
      entitlements: [],
    };
  }

  if (useMockStripeBilling()) {
    const invoices: HostedStripeInvoiceSnapshot[] = options.account.billing.lastInvoiceId
      ? [{
          invoiceId: options.account.billing.lastInvoiceId,
          status: options.account.billing.lastInvoiceStatus,
          currency: options.account.billing.lastInvoiceCurrency,
          amountPaid: options.account.billing.lastInvoiceAmountPaid,
          amountDue: options.account.billing.lastInvoiceAmountDue,
          subscriptionId: options.account.billing.stripeSubscriptionId,
          priceId: options.account.billing.stripePriceId,
          billingReason: 'subscription_cycle',
          createdAt: options.account.billing.lastInvoiceProcessedAt ?? options.account.billing.lastWebhookProcessedAt,
          paidAt: options.account.billing.lastInvoicePaidAt,
          source: 'mock_summary',
        }]
      : [];
    const charges: HostedStripeChargeSnapshot[] =
      options.account.billing.lastInvoiceId && options.account.billing.lastInvoiceStatus === 'paid'
        ? [{
            chargeId: `ch_mock_${options.account.id}`,
            invoiceId: options.account.billing.lastInvoiceId,
            amount: options.account.billing.lastInvoiceAmountPaid,
            amountRefunded: 0,
            currency: options.account.billing.lastInvoiceCurrency,
            status: 'succeeded',
            paid: true,
            refunded: false,
            createdAt: options.account.billing.lastInvoicePaidAt ?? options.account.billing.lastInvoiceProcessedAt,
            source: 'mock_summary',
          }]
        : [];
    return {
      source: 'mock_summary',
      mock: true,
      customerId,
      invoices,
      charges,
      lineItems: [],
      entitlements: [],
    };
  }

  const limit = Math.max(1, Math.min(100, options.limit));
  const [invoiceList, chargeList, entitlements] = await Promise.all([
    stripeClient().invoices.list({ customer: customerId, limit }),
    stripeClient().charges.list({ customer: customerId, limit }),
    listHostedStripeActiveEntitlements({ customerId, limit: Math.max(limit * 5, 100) }),
  ]);
  const lineItems = (await Promise.all(
    invoiceList.data.map(async (invoice) => listHostedStripeInvoiceLineItems({
      invoiceId: invoice.id,
      limit: 1_000,
    })),
  )).flat();

  return {
    source: 'stripe_live',
    mock: false,
    customerId,
    invoices: invoiceList.data.map((invoice) => ({
      invoiceId: invoice.id,
      status: typeof invoice.status === 'string' ? invoice.status : null,
      currency: typeof invoice.currency === 'string' ? invoice.currency : null,
      amountPaid: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : null,
      amountDue: typeof invoice.amount_due === 'number' ? invoice.amount_due : null,
      subscriptionId: stripeReferenceId((invoice as Stripe.Invoice & { subscription?: unknown }).subscription),
      priceId: stripeInvoicePriceId(invoice),
      billingReason: typeof invoice.billing_reason === 'string' ? invoice.billing_reason : null,
      createdAt: unixSecondsToIso(invoice.created),
      paidAt: unixSecondsToIso((invoice.status_transitions as { paid_at?: unknown } | null | undefined)?.paid_at),
      source: 'stripe_live',
    })),
    charges: chargeList.data.map((charge) => ({
      chargeId: charge.id,
      invoiceId: stripeReferenceId((charge as Stripe.Charge & { invoice?: unknown }).invoice),
      amount: typeof charge.amount === 'number' ? charge.amount : null,
      amountRefunded: typeof charge.amount_refunded === 'number' ? charge.amount_refunded : null,
      currency: typeof charge.currency === 'string' ? charge.currency : null,
      status: charge.status === 'succeeded' || charge.status === 'pending' || charge.status === 'failed'
        ? charge.status
        : null,
      paid: typeof charge.paid === 'boolean' ? charge.paid : null,
      refunded: typeof charge.refunded === 'boolean' ? charge.refunded : null,
      createdAt: unixSecondsToIso(charge.created),
      source: 'stripe_live',
    })),
    lineItems,
    entitlements,
  };
}
