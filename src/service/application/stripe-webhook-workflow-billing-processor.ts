import Stripe from 'stripe';
import type {
  StripeAccountMatch,
  StripeInvoiceWebhookObject,
  StripeWebhookBillingProcessorDeps,
  StripeWebhookBillingProcessorResult,
  StripeWebhookProcessorContext,
} from './stripe-webhook-billing-processor-types.js';
import type { StripeWebhookProcessingHandle } from './stripe-webhook-service.js';
import type { WorkflowEntitlementStatus } from '../workflow-entitlement.js';
import {
  resolveWorkflowTierStripeOveragePrice,
  resolveWorkflowTierStripePrice,
} from '../workflow-entitlement-catalog.js';
import {
  parseWorkflowStripeMetadata,
  tenantWorkflowMetadataDigest,
} from '../workflow-entitlement-store.js';

export interface StripeWebhookWorkflowBillingProcessor {
  processSubscriptionEvent(
    stripeWebhook: StripeWebhookProcessingHandle,
    c: StripeWebhookProcessorContext,
  ): Promise<StripeWebhookBillingProcessorResult | null>;
  processCheckoutCompletedEvent(
    stripeWebhook: StripeWebhookProcessingHandle,
    c: StripeWebhookProcessorContext,
  ): Promise<StripeWebhookBillingProcessorResult | null>;
  processInvoiceEvent(
    stripeWebhook: StripeWebhookProcessingHandle,
    c: StripeWebhookProcessorContext,
  ): Promise<StripeWebhookBillingProcessorResult | null>;
}

export function createStripeWebhookWorkflowBillingProcessor(
  deps: StripeWebhookBillingProcessorDeps,
): StripeWebhookWorkflowBillingProcessor {
  const {
    observeBillingWebhookEvent,
    stripeReferenceId,
    upsertWorkflowEntitlementFromStripeState,
    findHostedAccountByStripeRefs,
    appendAdminAuditRecordState,
    unixSecondsToIso,
  } = deps;

  function workflowStatusFromSubscription(
    status: string | null,
    eventType: string,
  ): WorkflowEntitlementStatus {
    if (eventType === 'customer.subscription.deleted') return 'canceled';
    if (status === 'active' || status === 'trialing' || status === 'past_due' || status === 'canceled') {
      return status;
    }
    if (status === 'unpaid') return 'past_due';
    return 'incomplete';
  }

  function workflowStatusFromInvoice(eventType: string): WorkflowEntitlementStatus {
    if (eventType === 'invoice.paid') return 'active';
    if (eventType === 'invoice.payment_failed') return 'past_due';
    return 'incomplete';
  }

  function stripeSubscriptionWorkflowItemId(
    subscription: Stripe.Subscription,
    stripePriceId: string | null,
  ): string | null {
    if (!stripePriceId) return null;
    for (const item of subscription.items?.data ?? []) {
      const itemPriceId = stripeReferenceId((item as { price?: unknown }).price);
      if (itemPriceId === stripePriceId) return stripeReferenceId(item.id);
    }
    return null;
  }

  function stripeInvoiceWorkflowItemId(
    invoice: StripeInvoiceWebhookObject,
    stripePriceId: string | null,
  ): string | null {
    if (!stripePriceId) return null;
    for (const lineItem of invoice.lines?.data ?? []) {
      const linePriceId = stripeReferenceId((lineItem as { price?: unknown }).price)
        ?? stripeReferenceId(lineItem.pricing?.price_details?.price);
      if (linePriceId !== stripePriceId) continue;
      return stripeReferenceId(lineItem.parent?.subscription_item_details?.subscription_item);
    }
    return null;
  }

  async function workflowAccountForMetadata(input: {
    accountId: string;
    tenantDigest: string;
    stripeCustomerId: string | null;
  }): Promise<StripeAccountMatch> {
    const matched = await findHostedAccountByStripeRefs({
      accountId: input.accountId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: null,
    });
    if (!matched.record) return matched;
    const expectedDigest = tenantWorkflowMetadataDigest(matched.record.primaryTenantId);
    return expectedDigest === input.tenantDigest
      ? matched
      : { record: null, matchReason: 'none' };
  }

  return {
    async processSubscriptionEvent(stripeWebhook, c) {
      const event = stripeWebhook.event;
      const sharedBillingLedger = stripeWebhook.sharedBillingLedger;
      const subscription = event.data.object as Stripe.Subscription;
      const workflowMetadata = parseWorkflowStripeMetadata(subscription.metadata);
      if (!workflowMetadata) return null;

      const stripeCustomerId = stripeReferenceId(subscription.customer);
      const stripeSubscriptionId = stripeReferenceId(subscription.id);
      const stripeSubscriptionStatus =
        typeof subscription.status === 'string'
          ? subscription.status
          : event.type === 'customer.subscription.deleted'
            ? 'canceled'
            : null;
      const eventCreatedAt = unixSecondsToIso(event.created) ?? new Date().toISOString();
      const basePrice = resolveWorkflowTierStripePrice(workflowMetadata.tier);
      const overagePrice = resolveWorkflowTierStripeOveragePrice(workflowMetadata.tier);
      const workflowStripePriceId = basePrice.priceId;
      const stripeSubscriptionItemId = stripeSubscriptionWorkflowItemId(
        subscription,
        workflowStripePriceId,
      );
      const matched = await workflowAccountForMetadata({
        accountId: workflowMetadata.accountId,
        tenantDigest: workflowMetadata.tenantDigest,
        stripeCustomerId,
      });
      const account = matched.record;

      if (!account) {
        observeBillingWebhookEvent(event.type, 'ignored');
        if (sharedBillingLedger) {
          await stripeWebhook.finalizeSharedEvent({
            providerEventId: event.id,
            outcome: 'ignored',
            reason: 'no_account_match',
            stripeCustomerId,
            stripeSubscriptionId,
            stripePriceId: workflowStripePriceId,
            billingStatusAfter: stripeSubscriptionStatus,
            metadata: {
              eventType: event.type,
              workflowId: workflowMetadata.workflowId,
              workflowTier: workflowMetadata.tier,
              workflowMetadata: true,
            },
          });
        } else {
          await stripeWebhook.finalizeDedupe({
            eventType: event.type,
            accountId: null,
            stripeCustomerId,
            stripeSubscriptionId,
            outcome: 'ignored',
            reason: 'no_account_match',
          });
        }
        return c.json({
          received: true,
          duplicate: false,
          ignored: true,
          eventId: event.id,
          eventType: event.type,
          reason: 'no_account_match',
          stripeCustomerId,
          stripeSubscriptionId,
          workflowId: workflowMetadata.workflowId,
        });
      }

      const entitlement = await upsertWorkflowEntitlementFromStripeState({
        accountId: account.id,
        tenantId: account.primaryTenantId,
        workflowId: workflowMetadata.workflowId,
        tier: workflowMetadata.tier,
        consequencePack: workflowMetadata.consequencePack,
        downstreamSystemRefDigest: workflowMetadata.downstreamSystemRefDigest,
        policyGatePathRefDigest: workflowMetadata.policyGatePathRefDigest,
        stripeCustomerId,
        stripeSubscriptionId,
        stripeSubscriptionItemId,
        stripePriceId: workflowStripePriceId,
        stripeOveragePriceId: overagePrice.priceId,
        status: workflowStatusFromSubscription(stripeSubscriptionStatus, event.type),
        eventId: event.id,
        eventType: event.type,
        eventAt: eventCreatedAt,
      });

      c.set('obs.accountId', account.id);
      c.set('obs.accountStatus', account.status);
      c.set('obs.tenantId', account.primaryTenantId);
      c.set('obs.planId', workflowMetadata.tier);

      if (sharedBillingLedger) {
        await stripeWebhook.finalizeSharedEvent({
          providerEventId: event.id,
          outcome: 'applied',
          accountId: account.id,
          tenantId: account.primaryTenantId,
          stripeCustomerId,
          stripeSubscriptionId,
          stripePriceId: workflowStripePriceId,
          billingStatusAfter: stripeSubscriptionStatus,
          metadata: {
            eventType: event.type,
            matchReason: matched.matchReason,
            workflowId: workflowMetadata.workflowId,
            workflowTier: workflowMetadata.tier,
            workflowEntitlementStatus: entitlement.record.status,
            stripeSubscriptionItemId,
          },
        });
      } else {
        await stripeWebhook.finalizeDedupe({
          eventType: event.type,
          accountId: account.id,
          stripeCustomerId,
          stripeSubscriptionId,
          outcome: 'applied',
          reason: null,
        });
      }

      observeBillingWebhookEvent(event.type, 'applied');

      await appendAdminAuditRecordState({
        actorType: 'stripe_webhook',
        actorLabel: 'stripe.webhooks',
        action: 'billing.stripe.webhook_applied',
        routeId: 'billing.stripe.workflow_webhook',
        accountId: account.id,
        tenantId: account.primaryTenantId,
        tenantKeyId: null,
        planId: workflowMetadata.tier,
        monthlyRunQuota: null,
        idempotencyKey: event.id,
        requestHash: stripeWebhook.payloadHash,
        metadata: {
          eventType: event.type,
          matchReason: matched.matchReason,
          stripeCustomerId,
          stripeSubscriptionId,
          stripeSubscriptionStatus,
          stripeSubscriptionItemId,
          stripePriceId: workflowStripePriceId,
          workflowId: workflowMetadata.workflowId,
          workflowTier: workflowMetadata.tier,
          workflowEntitlementStatus: entitlement.record.status,
          sharedLedger: sharedBillingLedger,
        },
      });

      return c.json({
        received: true,
        duplicate: false,
        eventId: event.id,
        eventType: event.type,
        accountId: account.id,
        accountStatus: account.status,
        workflowId: workflowMetadata.workflowId,
        workflowTier: workflowMetadata.tier,
        workflowEntitlementStatus: entitlement.record.status,
      });
    },

    async processCheckoutCompletedEvent(stripeWebhook, c) {
      const event = stripeWebhook.event;
      const sharedBillingLedger = stripeWebhook.sharedBillingLedger;
      const session = event.data.object as Stripe.Checkout.Session;
      const workflowMetadata = parseWorkflowStripeMetadata(session.metadata);
      if (!workflowMetadata) return null;

      const stripeCheckoutSessionId = stripeReferenceId(session.id);
      const stripeCustomerId = stripeReferenceId(session.customer);
      const stripeSubscriptionId = stripeReferenceId(session.subscription);
      const completedAt = unixSecondsToIso(session.created) ?? new Date().toISOString();
      const basePrice = resolveWorkflowTierStripePrice(workflowMetadata.tier);
      const overagePrice = resolveWorkflowTierStripeOveragePrice(workflowMetadata.tier);
      const matched = await workflowAccountForMetadata({
        accountId: workflowMetadata.accountId,
        tenantDigest: workflowMetadata.tenantDigest,
        stripeCustomerId,
      });
      const account = matched.record;

      if (!account) {
        observeBillingWebhookEvent(event.type, 'ignored');
        if (sharedBillingLedger) {
          await stripeWebhook.finalizeSharedEvent({
            providerEventId: event.id,
            outcome: 'ignored',
            reason: 'no_account_match',
            stripeCheckoutSessionId,
            stripeCustomerId,
            stripeSubscriptionId,
            stripePriceId: basePrice.priceId,
            metadata: {
              eventType: event.type,
              checkoutMode: session.mode ?? null,
              workflowId: workflowMetadata.workflowId,
              workflowTier: workflowMetadata.tier,
              workflowMetadata: true,
            },
          });
        } else {
          await stripeWebhook.finalizeDedupe({
            eventType: event.type,
            accountId: null,
            stripeCustomerId,
            stripeSubscriptionId,
            outcome: 'ignored',
            reason: 'no_account_match',
          });
        }
        return c.json({
          received: true,
          duplicate: false,
          ignored: true,
          eventId: event.id,
          eventType: event.type,
          reason: 'no_account_match',
          stripeCustomerId,
          stripeSubscriptionId,
          checkoutSessionId: stripeCheckoutSessionId,
          workflowId: workflowMetadata.workflowId,
        });
      }

      const entitlement = await upsertWorkflowEntitlementFromStripeState({
        accountId: account.id,
        tenantId: account.primaryTenantId,
        workflowId: workflowMetadata.workflowId,
        tier: workflowMetadata.tier,
        consequencePack: workflowMetadata.consequencePack,
        downstreamSystemRefDigest: workflowMetadata.downstreamSystemRefDigest,
        policyGatePathRefDigest: workflowMetadata.policyGatePathRefDigest,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId: basePrice.priceId,
        stripeOveragePriceId: overagePrice.priceId,
        status: 'incomplete',
        checkoutSessionId: stripeCheckoutSessionId,
        checkoutCompletedAt: completedAt,
        eventId: event.id,
        eventType: event.type,
        eventAt: completedAt,
      });

      c.set('obs.accountId', account.id);
      c.set('obs.accountStatus', account.status);
      c.set('obs.tenantId', account.primaryTenantId);
      c.set('obs.planId', workflowMetadata.tier);

      if (sharedBillingLedger) {
        await stripeWebhook.finalizeSharedEvent({
          providerEventId: event.id,
          outcome: 'applied',
          accountId: account.id,
          tenantId: account.primaryTenantId,
          stripeCheckoutSessionId,
          stripeCustomerId,
          stripeSubscriptionId,
          stripePriceId: basePrice.priceId,
          metadata: {
            eventType: event.type,
            matchReason: matched.matchReason,
            completedAt,
            checkoutMode: session.mode ?? null,
            workflowId: workflowMetadata.workflowId,
            workflowTier: workflowMetadata.tier,
            workflowEntitlementStatus: entitlement.record.status,
          },
        });
      } else {
        await stripeWebhook.finalizeDedupe({
          eventType: event.type,
          accountId: account.id,
          stripeCustomerId,
          stripeSubscriptionId,
          outcome: 'applied',
          reason: null,
        });
      }

      observeBillingWebhookEvent(event.type, 'applied');

      await appendAdminAuditRecordState({
        actorType: 'stripe_webhook',
        actorLabel: 'stripe.webhooks',
        action: 'billing.stripe.webhook_applied',
        routeId: 'billing.stripe.workflow_webhook',
        accountId: account.id,
        tenantId: account.primaryTenantId,
        tenantKeyId: null,
        planId: workflowMetadata.tier,
        monthlyRunQuota: null,
        idempotencyKey: event.id,
        requestHash: stripeWebhook.payloadHash,
        metadata: {
          eventType: event.type,
          matchReason: matched.matchReason,
          stripeCheckoutSessionId,
          stripeCustomerId,
          stripeSubscriptionId,
          stripePriceId: basePrice.priceId,
          completedAt,
          workflowId: workflowMetadata.workflowId,
          workflowTier: workflowMetadata.tier,
          workflowEntitlementStatus: entitlement.record.status,
          sharedLedger: sharedBillingLedger,
        },
      });

      return c.json({
        received: true,
        duplicate: false,
        eventId: event.id,
        eventType: event.type,
        accountId: account.id,
        accountStatus: account.status,
        workflowId: workflowMetadata.workflowId,
        workflowTier: workflowMetadata.tier,
        workflowEntitlementStatus: entitlement.record.status,
      });
    },

    async processInvoiceEvent(stripeWebhook, c) {
      const event = stripeWebhook.event;
      const sharedBillingLedger = stripeWebhook.sharedBillingLedger;
      const invoice = event.data.object as StripeInvoiceWebhookObject;
      const workflowMetadata = parseWorkflowStripeMetadata(
        invoice.metadata,
        invoice.subscription_details?.metadata ?? null,
      );
      if (!workflowMetadata) return null;

      const stripeCustomerId = stripeReferenceId(invoice.customer);
      const stripeSubscriptionId = stripeReferenceId(invoice.subscription);
      const stripeInvoiceId = stripeReferenceId(invoice.id);
      const stripeInvoiceStatus =
        typeof invoice.status === 'string'
          ? invoice.status
          : event.type === 'invoice.paid'
            ? 'paid'
            : null;
      const stripeInvoiceCurrency = typeof invoice.currency === 'string' ? invoice.currency : null;
      const eventCreatedAt = unixSecondsToIso(event.created) ?? new Date().toISOString();
      const basePrice = resolveWorkflowTierStripePrice(workflowMetadata.tier);
      const overagePrice = resolveWorkflowTierStripeOveragePrice(workflowMetadata.tier);
      const workflowStripePriceId = basePrice.priceId;
      const stripeSubscriptionItemId = stripeInvoiceWorkflowItemId(
        invoice,
        workflowStripePriceId,
      );
      const matched = await workflowAccountForMetadata({
        accountId: workflowMetadata.accountId,
        tenantDigest: workflowMetadata.tenantDigest,
        stripeCustomerId,
      });
      const account = matched.record;

      if (!account) {
        observeBillingWebhookEvent(event.type, 'ignored');
        if (sharedBillingLedger) {
          await stripeWebhook.finalizeSharedEvent({
            providerEventId: event.id,
            outcome: 'ignored',
            reason: 'no_account_match',
            stripeCustomerId,
            stripeSubscriptionId,
            stripePriceId: workflowStripePriceId,
            stripeInvoiceId,
            stripeInvoiceStatus,
            stripeInvoiceCurrency,
            stripeInvoiceAmountPaid: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : null,
            stripeInvoiceAmountDue: typeof invoice.amount_due === 'number' ? invoice.amount_due : null,
            metadata: {
              eventType: event.type,
              billingReason: invoice.billing_reason ?? null,
              workflowId: workflowMetadata.workflowId,
              workflowTier: workflowMetadata.tier,
              workflowMetadata: true,
            },
          });
        } else {
          await stripeWebhook.finalizeDedupe({
            eventType: event.type,
            accountId: null,
            stripeCustomerId,
            stripeSubscriptionId,
            outcome: 'ignored',
            reason: 'no_account_match',
          });
        }
        return c.json({
          received: true,
          duplicate: false,
          ignored: true,
          eventId: event.id,
          eventType: event.type,
          reason: 'no_account_match',
          stripeCustomerId,
          stripeSubscriptionId,
          invoiceId: stripeInvoiceId,
          workflowId: workflowMetadata.workflowId,
        });
      }

      const entitlement = await upsertWorkflowEntitlementFromStripeState({
        accountId: account.id,
        tenantId: account.primaryTenantId,
        workflowId: workflowMetadata.workflowId,
        tier: workflowMetadata.tier,
        consequencePack: workflowMetadata.consequencePack,
        downstreamSystemRefDigest: workflowMetadata.downstreamSystemRefDigest,
        policyGatePathRefDigest: workflowMetadata.policyGatePathRefDigest,
        stripeCustomerId,
        stripeSubscriptionId,
        stripeSubscriptionItemId,
        stripePriceId: workflowStripePriceId,
        stripeOveragePriceId: overagePrice.priceId,
        status: workflowStatusFromInvoice(event.type),
        eventId: event.id,
        eventType: event.type,
        eventAt: eventCreatedAt,
      });

      c.set('obs.accountId', account.id);
      c.set('obs.accountStatus', account.status);
      c.set('obs.tenantId', account.primaryTenantId);
      c.set('obs.planId', workflowMetadata.tier);

      if (sharedBillingLedger) {
        await stripeWebhook.finalizeSharedEvent({
          providerEventId: event.id,
          outcome: 'applied',
          accountId: account.id,
          tenantId: account.primaryTenantId,
          stripeCustomerId,
          stripeSubscriptionId,
          stripePriceId: workflowStripePriceId,
          stripeInvoiceId,
          stripeInvoiceStatus,
          stripeInvoiceCurrency,
          stripeInvoiceAmountPaid: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : null,
          stripeInvoiceAmountDue: typeof invoice.amount_due === 'number' ? invoice.amount_due : null,
          billingStatusAfter: entitlement.record.status,
          metadata: {
            eventType: event.type,
            matchReason: matched.matchReason,
            billingReason: invoice.billing_reason ?? null,
            workflowId: workflowMetadata.workflowId,
            workflowTier: workflowMetadata.tier,
            workflowEntitlementStatus: entitlement.record.status,
            stripeSubscriptionItemId,
          },
        });
      } else {
        await stripeWebhook.finalizeDedupe({
          eventType: event.type,
          accountId: account.id,
          stripeCustomerId,
          stripeSubscriptionId,
          outcome: 'applied',
          reason: null,
        });
      }

      observeBillingWebhookEvent(event.type, 'applied');

      await appendAdminAuditRecordState({
        actorType: 'stripe_webhook',
        actorLabel: 'stripe.webhooks',
        action: 'billing.stripe.webhook_applied',
        routeId: 'billing.stripe.workflow_webhook',
        accountId: account.id,
        tenantId: account.primaryTenantId,
        tenantKeyId: null,
        planId: workflowMetadata.tier,
        monthlyRunQuota: null,
        idempotencyKey: event.id,
        requestHash: stripeWebhook.payloadHash,
        metadata: {
          eventType: event.type,
          matchReason: matched.matchReason,
          stripeCustomerId,
          stripeSubscriptionId,
          stripePriceId: workflowStripePriceId,
          stripeInvoiceId,
          stripeInvoiceStatus,
          stripeInvoiceCurrency,
          billingReason: invoice.billing_reason ?? null,
          workflowId: workflowMetadata.workflowId,
          workflowTier: workflowMetadata.tier,
          workflowEntitlementStatus: entitlement.record.status,
          sharedLedger: sharedBillingLedger,
        },
      });

      return c.json({
        received: true,
        duplicate: false,
        eventId: event.id,
        eventType: event.type,
        accountId: account.id,
        accountStatus: account.status,
        workflowId: workflowMetadata.workflowId,
        workflowTier: workflowMetadata.tier,
        workflowEntitlementStatus: entitlement.record.status,
      });
    },
  };
}
