import type Stripe from 'stripe';
import type { HostedAccountRecord } from '../account/account-store.js';
import type * as BillingEventLedger from '../billing/billing-event-ledger.js';
import type { HostedBillingEntitlementRecord } from '../billing/billing-entitlement-store.js';
import type * as ControlPlaneStore from '../control-plane-store.js';
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
  metadataStringValue(
    key: string,
    ...sources: Array<Record<string, unknown> | Stripe.Metadata | null | undefined>
  ): string | null;
  upsertWorkflowEntitlementFromStripeState: typeof ControlPlaneStore.upsertWorkflowEntitlementFromStripeState;
  findHostedAccountByStripeRefs(options: {
    accountId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  }): Promise<StripeAccountMatch>;
  syncHostedBillingEntitlement(
    account: HostedAccountRecord,
    options?: SyncHostedBillingEntitlementOptions,
  ): Promise<HostedBillingEntitlementRecord>;
  appendAdminAuditRecordState: typeof ControlPlaneStore.appendAdminAuditRecordState;
  billingEntitlementView(record: HostedBillingEntitlementRecord): Record<string, unknown>;
  listHostedStripeActiveEntitlements: typeof StripeBilling.listHostedStripeActiveEntitlements;
  extractActiveEntitlementsFromSummary: typeof StripeBilling.extractActiveEntitlementsFromSummary;
  parseStripeChargeStatus(raw: unknown): BillingEventLedger.BillingChargeStatus;
  upsertStripeCharges: typeof BillingEventLedger.upsertStripeCharges;
  unixSecondsToIso(value: unknown): string | null;
}
