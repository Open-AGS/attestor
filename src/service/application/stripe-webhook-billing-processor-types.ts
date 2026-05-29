import type Stripe from 'stripe';
import type {
  HostedAccountRecord,
  StripeInvoiceStatus,
} from '../account/account-store.js';
import type * as BillingEventLedger from '../billing/billing-event-ledger.js';
import type { HostedBillingEntitlementRecord } from '../billing/billing-entitlement-store.js';
import type * as ControlPlaneStore from '../control-plane-store.js';
import type * as PlanCatalog from '../plan-catalog.js';
import type * as StripeBilling from '../billing/stripe/stripe-billing.js';
import type {
  BillingWebhookMetricOutcome,
  StripeWebhookProcessingHandle,
} from './stripe-webhook-service.js';

export interface SyncHostedBillingEntitlementOptions {
  lastEventId?: string | null;
  lastEventType?: string | null;
  lastEventAt?: string | null;
  stripeEntitlementLookupKeys?: string[] | null;
  stripeEntitlementFeatureIds?: string[] | null;
  stripeEntitlementSummaryUpdatedAt?: string | null;
}

export type StripeAccountMatchReason = 'account_id' | 'subscription_id' | 'customer_id' | 'none';

export interface StripeAccountMatch {
  record: HostedAccountRecord | null;
  matchReason: StripeAccountMatchReason;
}

export type StripeInvoiceWebhookObject = Stripe.Invoice & {
  subscription?: unknown;
  subscription_details?: {
    metadata?: Record<string, unknown> | Stripe.Metadata | null;
  } | null;
  status_transitions?: {
    paid_at?: unknown;
  } | null;
  billing_reason?: string | null;
};

export interface StripeWebhookProcessorObservability {
  accountId?: string | null;
  accountStatus?: HostedAccountRecord['status'] | null;
  tenantId?: string | null;
  planId?: string | null;
}

export interface StripeWebhookBillingProcessorResult {
  statusCode: 200 | 404 | 409;
  responseBody: Record<string, unknown>;
  observability: StripeWebhookProcessorObservability;
}

export interface StripeWebhookProcessorContext {
  observability: StripeWebhookProcessorObservability;
  json(
    responseBody: Record<string, unknown>,
    statusCode?: 200 | 404 | 409,
  ): StripeWebhookBillingProcessorResult;
  set(key: string, value: unknown): void;
}

export interface StripeWebhookBillingProcessor {
  process(stripeWebhook: StripeWebhookProcessingHandle): Promise<StripeWebhookBillingProcessorResult>;
}

export interface StripeWebhookBillingProcessorDeps {
  observeBillingWebhookEvent(eventType: string, outcome: BillingWebhookMetricOutcome): void;
  isSupportedStripeWebhookEvent(eventType: string): boolean;
  stripeReferenceId(value: unknown): string | null;
  parseStripeInvoiceStatus(raw: unknown): StripeInvoiceStatus;
  stripeInvoicePriceId(invoice: Stripe.Invoice): string | null;
  metadataStringValue(
    key: string,
    ...sources: Array<Record<string, unknown> | Stripe.Metadata | null | undefined>
  ): string | null;
  applyStripeSubscriptionStateState: typeof ControlPlaneStore.applyStripeSubscriptionStateState;
  applyStripeInvoiceStateState: typeof ControlPlaneStore.applyStripeInvoiceStateState;
  applyStripeCheckoutCompletionState: typeof ControlPlaneStore.applyStripeCheckoutCompletionState;
  findHostedAccountByStripeRefs(options: {
    accountId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  }): Promise<StripeAccountMatch>;
  findHostedPlanByStripePriceId: typeof PlanCatalog.findHostedPlanByStripePriceId;
  resolvePlanSpec: typeof PlanCatalog.resolvePlanSpec;
  DEFAULT_HOSTED_PLAN_ID: typeof PlanCatalog.DEFAULT_HOSTED_PLAN_ID;
  syncTenantPlanByTenantIdState: typeof ControlPlaneStore.syncTenantPlanByTenantIdState;
  syncHostedBillingEntitlement(
    account: HostedAccountRecord,
    options?: SyncHostedBillingEntitlementOptions,
  ): Promise<HostedBillingEntitlementRecord>;
  revokeAccountSessionsForLifecycleChange(options: {
    account: HostedAccountRecord | null;
    previousStatus: HostedAccountRecord['status'] | null;
    nextStatus: HostedAccountRecord['status'] | null;
  }): Promise<number>;
  appendAdminAuditRecordState: typeof ControlPlaneStore.appendAdminAuditRecordState;
  billingEntitlementView(record: HostedBillingEntitlementRecord): Record<string, unknown>;
  extractInvoiceLineItemSnapshotsFromInvoice: typeof StripeBilling.extractInvoiceLineItemSnapshotsFromInvoice;
  listHostedStripeActiveEntitlements: typeof StripeBilling.listHostedStripeActiveEntitlements;
  extractActiveEntitlementsFromSummary: typeof StripeBilling.extractActiveEntitlementsFromSummary;
  listHostedStripeInvoiceLineItems: typeof StripeBilling.listHostedStripeInvoiceLineItems;
  upsertStripeInvoiceLineItems: typeof BillingEventLedger.upsertStripeInvoiceLineItems;
  parseStripeChargeStatus(raw: unknown): BillingEventLedger.BillingChargeStatus;
  getHostedPlan: typeof PlanCatalog.getHostedPlan;
  upsertStripeCharges: typeof BillingEventLedger.upsertStripeCharges;
  unixSecondsToIso(value: unknown): string | null;
  resolvePlanStripePrice: typeof PlanCatalog.resolvePlanStripePrice;
}
