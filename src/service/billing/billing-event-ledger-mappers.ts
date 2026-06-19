import { hashJsonValue } from '../json-stable.js';
import type {
  BillingAccountStatus,
  BillingChargeRecord,
  BillingChargeStatus,
  BillingEventOutcome,
  BillingEventProvider,
  BillingEventRecord,
  BillingEventSource,
  BillingInvoiceLineItemCaptureMode,
  BillingInvoiceLineItemRecord,
  BillingInvoiceLineItemSource,
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
} from './billing-event-ledger-types.js';

export function payloadHash(rawPayload: string): string {
  return hashJsonValue({ payload: rawPayload });
}

function toNullableObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toNullableInvoiceStatus(value: unknown): BillingInvoiceStatus {
  if (value === null || value === undefined) return null;
  switch (String(value)) {
    case 'draft':
    case 'open':
    case 'paid':
    case 'uncollectible':
    case 'void':
      return String(value) as BillingInvoiceStatus;
    default:
      return null;
  }
}

export function rowToRecord(row: Record<string, unknown>): BillingEventRecord {
  return {
    id: String(row.id),
    provider: String(row.provider) as BillingEventProvider,
    source: String(row.source) as BillingEventSource,
    providerEventId: String(row.provider_event_id),
    eventType: String(row.event_type),
    payloadHash: String(row.payload_hash),
    outcome: String(row.outcome) as BillingEventOutcome,
    reason: row.reason === null ? null : String(row.reason),
    accountId: row.account_id === null ? null : String(row.account_id),
    tenantId: row.tenant_id === null ? null : String(row.tenant_id),
    stripeCheckoutSessionId: row.stripe_checkout_session_id === null ? null : String(row.stripe_checkout_session_id),
    stripeCustomerId: row.stripe_customer_id === null ? null : String(row.stripe_customer_id),
    stripeSubscriptionId: row.stripe_subscription_id === null ? null : String(row.stripe_subscription_id),
    stripePriceId: row.stripe_price_id === null ? null : String(row.stripe_price_id),
    stripeInvoiceId: row.stripe_invoice_id === null ? null : String(row.stripe_invoice_id),
    stripeInvoiceStatus: toNullableInvoiceStatus(row.stripe_invoice_status),
    stripeInvoiceCurrency: row.stripe_invoice_currency === null ? null : String(row.stripe_invoice_currency),
    stripeInvoiceAmountPaid: row.stripe_invoice_amount_paid === null ? null : Number(row.stripe_invoice_amount_paid),
    stripeInvoiceAmountDue: row.stripe_invoice_amount_due === null ? null : Number(row.stripe_invoice_amount_due),
    accountStatusBefore: row.account_status_before === null ? null : String(row.account_status_before) as BillingAccountStatus,
    accountStatusAfter: row.account_status_after === null ? null : String(row.account_status_after) as BillingAccountStatus,
    billingStatusBefore: row.billing_status_before === null ? null : String(row.billing_status_before) as BillingSubscriptionStatus,
    billingStatusAfter: row.billing_status_after === null ? null : String(row.billing_status_after) as BillingSubscriptionStatus,
    mappedPlanId: row.mapped_plan_id === null ? null : String(row.mapped_plan_id),
    receivedAt: new Date(String(row.received_at)).toISOString(),
    processedAt: row.processed_at === null ? null : new Date(String(row.processed_at)).toISOString(),
    metadata: toNullableObject(row.metadata),
  };
}

function toNullableLineItemSource(value: unknown): BillingInvoiceLineItemSource {
  return value === 'stripe_live_fetch' ? 'stripe_live_fetch' : 'stripe_webhook';
}

function toNullableCaptureMode(value: unknown): BillingInvoiceLineItemCaptureMode {
  return value === 'partial' ? 'partial' : 'full';
}

export function rowToLineItemRecord(row: Record<string, unknown>): BillingInvoiceLineItemRecord {
  return {
    id: String(row.id),
    provider: String(row.provider) as BillingEventProvider,
    accountId: row.account_id === null ? null : String(row.account_id),
    tenantId: row.tenant_id === null ? null : String(row.tenant_id),
    stripeCustomerId: row.stripe_customer_id === null ? null : String(row.stripe_customer_id),
    stripeSubscriptionId: row.stripe_subscription_id === null ? null : String(row.stripe_subscription_id),
    stripeInvoiceId: String(row.stripe_invoice_id),
    stripeInvoiceLineItemId: String(row.stripe_invoice_line_item_id),
    stripePriceId: row.stripe_price_id === null ? null : String(row.stripe_price_id),
    description: row.description === null ? null : String(row.description),
    currency: row.currency === null ? null : String(row.currency),
    amount: row.amount === null ? null : Number(row.amount),
    subtotal: row.subtotal === null ? null : Number(row.subtotal),
    quantity: row.quantity === null ? null : Number(row.quantity),
    periodStart: row.period_start === null ? null : new Date(String(row.period_start)).toISOString(),
    periodEnd: row.period_end === null ? null : new Date(String(row.period_end)).toISOString(),
    proration: row.proration === null ? null : Boolean(row.proration),
    source: toNullableLineItemSource(row.source),
    captureMode: toNullableCaptureMode(row.capture_mode),
    metadata: toNullableObject(row.metadata),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function toNullableChargeStatus(value: unknown): BillingChargeStatus {
  if (value === 'succeeded' || value === 'pending' || value === 'failed') {
    return value;
  }
  return null;
}

export function rowToChargeRecord(row: Record<string, unknown>): BillingChargeRecord {
  return {
    id: String(row.id),
    provider: String(row.provider) as BillingEventProvider,
    accountId: row.account_id === null ? null : String(row.account_id),
    tenantId: row.tenant_id === null ? null : String(row.tenant_id),
    stripeCustomerId: row.stripe_customer_id === null ? null : String(row.stripe_customer_id),
    stripeSubscriptionId: row.stripe_subscription_id === null ? null : String(row.stripe_subscription_id),
    stripeInvoiceId: row.stripe_invoice_id === null ? null : String(row.stripe_invoice_id),
    stripeChargeId: String(row.stripe_charge_id),
    stripePaymentIntentId: row.stripe_payment_intent_id === null ? null : String(row.stripe_payment_intent_id),
    amount: row.amount === null ? null : Number(row.amount),
    amountRefunded: row.amount_refunded === null ? null : Number(row.amount_refunded),
    currency: row.currency === null ? null : String(row.currency),
    status: toNullableChargeStatus(row.status),
    paid: row.paid === null ? null : Boolean(row.paid),
    refunded: row.refunded === null ? null : Boolean(row.refunded),
    failureCode: row.failure_code === null ? null : String(row.failure_code),
    failureMessage: row.failure_message === null ? null : String(row.failure_message),
    source: row.source === 'stripe_live_fetch' ? 'stripe_live_fetch' : 'stripe_webhook',
    metadata: toNullableObject(row.metadata),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}
