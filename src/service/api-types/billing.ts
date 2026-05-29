/**
 * Attestor service API billing and email types.
 *
 * This module is re-exported by ../api-types.ts for compatibility.
 */

import type { AccountBillingEntitlementRecord } from './account.js';
import type { UsageContext } from './shared.js';

export interface AccountBillingCheckoutRequest {
  planId: 'starter' | 'pro' | 'enterprise';
}

export interface EmailDeliveryRecordView {
  deliveryId: string;
  accountId: string | null;
  accountUserId: string | null;
  purpose: 'invite' | 'password_reset' | null;
  provider: 'manual' | 'smtp' | 'sendgrid_smtp' | 'mailgun_smtp';
  channel: 'api_response' | 'smtp';
  recipient: string;
  messageId: string | null;
  providerMessageId: string | null;
  actionUrl: string | null;
  tokenReturned: boolean;
  status: 'manual_delivered' | 'smtp_sent' | 'processed' | 'delivered' | 'deferred' | 'bounced' | 'dropped' | 'failed' | 'unknown';
  latestEventType: string | null;
  latestEventAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  deferredAt: string | null;
  failedAt: string | null;
  firstOpenedAt: string | null;
  lastClickedAt: string | null;
  opened: boolean;
  clicked: boolean;
  unsubscribed: boolean;
  spamReported: boolean;
  failureReason: string | null;
  eventCount: number;
}

export interface AccountEmailDeliveriesResponse {
  accountId: string;
  records: EmailDeliveryRecordView[];
  summary: {
    purposeFilter: 'invite' | 'password_reset' | null;
    statusFilter: EmailDeliveryRecordView['status'] | null;
    providerFilter: EmailDeliveryRecordView['provider'] | null;
    recipientFilter: string | null;
    recordCount: number;
  };
}

export interface AdminEmailDeliveriesResponse {
  records: EmailDeliveryRecordView[];
  summary: {
    accountFilter: string | null;
    purposeFilter: 'invite' | 'password_reset' | null;
    statusFilter: EmailDeliveryRecordView['status'] | null;
    providerFilter: EmailDeliveryRecordView['provider'] | null;
    recipientFilter: string | null;
    recordCount: number;
  };
}

export interface SendGridWebhookResponse {
  received: true;
  provider: 'sendgrid_smtp';
  eventCount: number;
  applied: number;
  duplicate: number;
  ignored: number;
  conflict: number;
}

export interface MailgunWebhookResponse {
  received: true;
  provider: 'mailgun_smtp';
  eventCount: number;
  applied: number;
  duplicate: number;
  ignored: number;
  conflict: number;
}

export interface AccountBillingCheckoutResponse {
  accountId: string;
  tenantId: string;
  planId: 'starter' | 'pro' | 'enterprise';
  stripePriceId: string;
  trialDays: number | null;
  checkoutSessionId: string;
  checkoutUrl: string;
  mock: boolean;
}

export interface AccountBillingPortalResponse {
  accountId: string;
  tenantId: string;
  portalSessionId: string;
  portalUrl: string;
  mock: boolean;
}

export interface BillingExportCheckoutSummary {
  sessionId: string | null;
  completedAt: string | null;
  planId: string | null;
}

export interface BillingExportInvoiceRecord {
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
  lastEventType: string | null;
  source: 'stripe_live' | 'ledger_derived' | 'summary_only' | 'mock_summary';
}

export interface BillingExportChargeRecord {
  chargeId: string | null;
  invoiceId: string | null;
  amount: number | null;
  amountRefunded: number | null;
  currency: string | null;
  status: 'succeeded' | 'pending' | 'failed' | null;
  paid: boolean | null;
  refunded: boolean | null;
  createdAt: string | null;
  source: 'stripe_live' | 'ledger_derived' | 'summary_only' | 'mock_summary';
}

export interface BillingExportInvoiceLineItemRecord {
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
  source: 'stripe_live' | 'ledger_derived' | 'mock_summary';
}

export interface BillingExportEntitlementFeatures {
  lookupKeys: string[];
  featureIds: string[];
  source: 'stripe_live' | 'entitlement_read_model' | 'none';
}

export interface AccountBillingExportResponse {
  accountId: string;
  tenantId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  entitlement: AccountBillingEntitlementRecord;
  checkout: BillingExportCheckoutSummary;
  invoices: BillingExportInvoiceRecord[];
  charges: BillingExportChargeRecord[];
  lineItems: BillingExportInvoiceLineItemRecord[];
  usage: UsageContext | null;
  entitlementFeatures: BillingExportEntitlementFeatures;
  reconciliation: AccountBillingReconciliationSummary;
  summary: {
    dataSource: 'stripe_live' | 'ledger_derived' | 'summary_only' | 'mock_summary' | 'empty';
    mock: boolean;
    sharedBillingLedger: boolean;
    requestedLimit: number;
    invoiceCount: number;
    chargeCount: number;
    lineItemCount: number;
    usageOverage: boolean;
    usageOverageUnits: number;
    usageHardLimit: boolean;
  };
}

export interface BillingReconciliationCheck {
  status: 'match' | 'mismatch' | 'unavailable';
  basis: 'invoice_amount_due' | 'invoice_amount_paid' | null;
  expectedAmount: number | null;
  actualAmount: number | null;
}

export interface BillingReconciliationInvoiceRecord {
  invoiceId: string;
  source: 'stripe_live' | 'ledger_derived' | 'summary_only' | 'mock_summary';
  currency: string | null;
  invoiceStatus: string | null;
  amountPaid: number | null;
  amountDue: number | null;
  chargeCount: number;
  lineItemCount: number;
  chargeAmountTotal: number | null;
  chargeNetAmountTotal: number | null;
  lineItemAmountTotal: number | null;
  lineItemSubtotalTotal: number | null;
  checks: {
    lineItemsVsInvoice: BillingReconciliationCheck;
    chargesVsInvoicePaid: BillingReconciliationCheck;
    netChargesVsInvoicePaid: BillingReconciliationCheck;
  };
  overallStatus: 'reconciled' | 'partial' | 'needs_attention';
  reasons: string[];
}

export interface AccountBillingReconciliationSummary {
  invoices: BillingReconciliationInvoiceRecord[];
  summary: {
    status: 'reconciled' | 'partial' | 'needs_attention' | 'empty';
    dataSource: 'stripe_live' | 'ledger_derived' | 'summary_only' | 'mock_summary' | 'empty';
    sharedBillingLedger: boolean;
    invoiceCount: number;
    reconciledCount: number;
    partialCount: number;
    attentionCount: number;
    chargeRecordCount: number;
    lineItemRecordCount: number;
  };
}

export interface AccountBillingReconciliationResponse {
  accountId: string;
  tenantId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  entitlement: AccountBillingEntitlementRecord;
  reconciliation: AccountBillingReconciliationSummary;
}
