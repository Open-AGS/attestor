/**
 * Attestor service API billing and email types.
 *
 * This module is re-exported by ../api-types.ts for compatibility.
 */

import type { AccountBillingEntitlementRecord } from './account.js';
import type { UsageContext } from './shared.js';

export type AccountWorkflowBillingTierId =
  | 'pilot-workflow'
  | 'starter-workflow'
  | 'pro-workflow';

export type AccountWorkflowConsequencePackId =
  | 'money-movement'
  | 'data-movement'
  | 'authority-change'
  | 'external-communication'
  | 'operational-execution'
  | 'programmable-money';

export interface RetiredAccountPlanCheckoutResponse {
  accountId: string;
  tenantId: string;
  error: string;
  replacementRoute: '/api/v1/account/billing/workflows/checkout';
  allowedWorkflowTiers: AccountWorkflowBillingTierId[];
}

export interface AccountWorkflowBillingCheckoutRequest {
  workflowAction?: 'create' | 'upgrade' | 'downgrade';
  workflowId?: string;
  tier: AccountWorkflowBillingTierId;
  consequencePack: AccountWorkflowConsequencePackId;
  downstreamSystemRef?: string;
  downstreamSystemRefDigest?: string;
  policyGatePathRef?: string;
  policyGatePathRefDigest?: string;
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

export interface AccountWorkflowEntitlementView {
  workflowId: string;
  accountId: string;
  tenantId: string;
  tier: AccountWorkflowBillingTierId;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  consequencePack: AccountWorkflowConsequencePackId;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionItemId: string | null;
  stripePriceId: string | null;
  stripeOveragePriceId: string | null;
  downstreamSystemRefDigest: string;
  policyGatePathRefDigest: string;
  includedAdmissionsMonthly: number;
  monthlyAdmissionsUsed: number;
  admissionPeriod: string | null;
  customerGateProofPresent: boolean;
  lastCheckoutAction: 'create' | 'upgrade' | 'downgrade' | null;
  lastCheckoutSessionId: string | null;
  lastCheckoutCompletedAt: string | null;
  lastEventId: string | null;
  lastEventType: string | null;
  lastEventAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountWorkflowBillingCheckoutResponse {
  accountId: string;
  tenantId: string;
  workflowId: string;
  workflowAction: 'create' | 'upgrade' | 'downgrade';
  tier: AccountWorkflowBillingTierId;
  consequencePack: AccountWorkflowConsequencePackId;
  stripePriceId: string;
  stripeOveragePriceId: string | null;
  checkoutSessionId: string;
  checkoutUrl: string;
  mock: boolean;
  entitlement: AccountWorkflowEntitlementView;
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
