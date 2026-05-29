export type BillingEventProvider = 'stripe';
export type BillingEventSource = 'stripe_webhook';
export type BillingEventOutcome = 'pending' | 'applied' | 'ignored';
export type BillingAccountStatus = 'active' | 'suspended' | 'archived' | null;
export type BillingSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'
  | null;
export type BillingInvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'uncollectible'
  | 'void'
  | null;
export type BillingChargeStatus = 'succeeded' | 'pending' | 'failed' | null;
export type BillingInvoiceLineItemSource = 'stripe_webhook' | 'stripe_live_fetch';
export type BillingInvoiceLineItemCaptureMode = 'full' | 'partial';
export type BillingChargeSource = 'stripe_webhook' | 'stripe_live_fetch';

export interface BillingEventRecord {
  id: string;
  provider: BillingEventProvider;
  source: BillingEventSource;
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  outcome: BillingEventOutcome;
  reason: string | null;
  accountId: string | null;
  tenantId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeInvoiceId: string | null;
  stripeInvoiceStatus: BillingInvoiceStatus;
  stripeInvoiceCurrency: string | null;
  stripeInvoiceAmountPaid: number | null;
  stripeInvoiceAmountDue: number | null;
  accountStatusBefore: BillingAccountStatus;
  accountStatusAfter: BillingAccountStatus;
  billingStatusBefore: BillingSubscriptionStatus;
  billingStatusAfter: BillingSubscriptionStatus;
  mappedPlanId: string | null;
  receivedAt: string;
  processedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface BillingInvoiceLineItemRecord {
  id: string;
  provider: BillingEventProvider;
  accountId: string | null;
  tenantId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string;
  stripeInvoiceLineItemId: string;
  stripePriceId: string | null;
  description: string | null;
  currency: string | null;
  amount: number | null;
  subtotal: number | null;
  quantity: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  proration: boolean | null;
  source: BillingInvoiceLineItemSource;
  captureMode: BillingInvoiceLineItemCaptureMode;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BillingChargeRecord {
  id: string;
  provider: BillingEventProvider;
  accountId: string | null;
  tenantId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string | null;
  stripeChargeId: string;
  stripePaymentIntentId: string | null;
  amount: number | null;
  amountRefunded: number | null;
  currency: string | null;
  status: BillingChargeStatus;
  paid: boolean | null;
  refunded: boolean | null;
  failureCode: string | null;
  failureMessage: string | null;
  source: BillingChargeSource;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type BillingEventClaim =
  | { kind: 'claimed'; payloadHash: string; record: BillingEventRecord }
  | { kind: 'duplicate'; payloadHash: string; record: BillingEventRecord }
  | { kind: 'conflict'; payloadHash: string; record: BillingEventRecord };

export interface BillingEventListFilters {
  accountId?: string | null;
  tenantId?: string | null;
  provider?: BillingEventProvider | null;
  eventType?: string | null;
  outcome?: Exclude<BillingEventOutcome, 'pending'> | null;
  limit?: number | null;
}

export interface BillingEventLedgerSnapshot {
  version: 3;
  provider: 'stripe';
  exportedAt: string;
  eventRecordCount: number;
  lineItemRecordCount: number;
  chargeRecordCount: number;
  recordCount: number;
  records: BillingEventRecord[];
  lineItems: BillingInvoiceLineItemRecord[];
  charges: BillingChargeRecord[];
}

export interface BillingInvoiceLineItemInput {
  stripeInvoiceLineItemId: string;
  stripePriceId?: string | null;
  description?: string | null;
  currency?: string | null;
  amount?: number | null;
  subtotal?: number | null;
  quantity?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  proration?: boolean | null;
  metadata?: Record<string, unknown>;
}

export interface BillingInvoiceLineItemListFilters {
  accountId?: string | null;
  tenantId?: string | null;
  stripeInvoiceId?: string | null;
  limit?: number | null;
}

export interface BillingChargeInput {
  stripeChargeId: string;
  stripePaymentIntentId?: string | null;
  stripeInvoiceId?: string | null;
  amount?: number | null;
  amountRefunded?: number | null;
  currency?: string | null;
  status?: BillingChargeStatus;
  paid?: boolean | null;
  refunded?: boolean | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string | null;
}

export interface BillingChargeListFilters {
  accountId?: string | null;
  tenantId?: string | null;
  stripeInvoiceId?: string | null;
  limit?: number | null;
}
