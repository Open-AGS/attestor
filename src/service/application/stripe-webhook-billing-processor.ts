import Stripe from 'stripe';
import type { BillingInvoiceStatus } from '../billing/billing-event-ledger.js';
import { createProcessorContext } from './stripe-webhook-billing-processor-context.js';
import {
  isStripeChargeEvent,
  stripeSubscriptionHostedPriceId,
} from './stripe-webhook-billing-processor-helpers.js';
import type {
  StripeInvoiceWebhookObject,
  StripeWebhookBillingProcessor,
  StripeWebhookBillingProcessorDeps,
  StripeWebhookBillingProcessorResult,
  StripeWebhookProcessorContext,
} from './stripe-webhook-billing-processor-types.js';
import type { StripeWebhookProcessingHandle } from './stripe-webhook-service.js';
import { processUnsupportedStripeBillingEvent } from './stripe-webhook-billing-unsupported-event.js';
import { createStripeWebhookWorkflowBillingProcessor } from './stripe-webhook-workflow-billing-processor.js';

export type {
  StripeAccountMatch,
  StripeAccountMatchReason,
  StripeInvoiceWebhookObject,
  StripeWebhookBillingProcessor,
  StripeWebhookBillingProcessorDeps,
  StripeWebhookBillingProcessorResult,
  StripeWebhookProcessorObservability,
} from './stripe-webhook-billing-processor-types.js';

export function createStripeWebhookBillingProcessor(
  deps: StripeWebhookBillingProcessorDeps,
): StripeWebhookBillingProcessor {
  const {
    observeBillingWebhookEvent,
    isSupportedStripeWebhookEvent,
    stripeReferenceId,
    metadataStringValue,
    findHostedAccountByStripeRefs,
    syncHostedBillingEntitlement,
    appendAdminAuditRecordState,
    billingEntitlementView,
    listHostedStripeActiveEntitlements,
    extractActiveEntitlementsFromSummary,
    parseStripeChargeStatus,
    upsertStripeCharges,
    unixSecondsToIso,
  } = deps;
  const workflowBillingProcessor = createStripeWebhookWorkflowBillingProcessor(deps);

  async function processRetiredAccountPlanBillingEvent(
    stripeWebhook: StripeWebhookProcessingHandle,
    c: StripeWebhookProcessorContext,
    input: {
      accountId: string | null;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      stripeCheckoutSessionId?: string | null;
      stripePriceId?: string | null;
      stripeInvoiceId?: string | null;
      stripeInvoiceStatus?: BillingInvoiceStatus | null;
      stripeInvoiceCurrency?: string | null;
      stripeInvoiceAmountPaid?: number | null;
      stripeInvoiceAmountDue?: number | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<StripeWebhookBillingProcessorResult> {
    const event = stripeWebhook.event;
    const sharedBillingLedger = stripeWebhook.sharedBillingLedger;
    const matched = await findHostedAccountByStripeRefs({
      accountId: input.accountId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    });
    const account = matched.record;

    observeBillingWebhookEvent(event.type, 'ignored');
    if (account) {
      c.set('obs.accountId', account.id);
      c.set('obs.accountStatus', account.status);
      c.set('obs.tenantId', account.primaryTenantId);
      c.set('obs.planId', null);
    }

    if (sharedBillingLedger) {
      await stripeWebhook.finalizeSharedEvent({
        providerEventId: event.id,
        outcome: 'ignored',
        reason: 'legacy_account_plan_billing_retired',
        accountId: account?.id ?? null,
        tenantId: account?.primaryTenantId ?? null,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
        stripePriceId: input.stripePriceId ?? null,
        stripeInvoiceId: input.stripeInvoiceId ?? null,
        stripeInvoiceStatus: input.stripeInvoiceStatus ?? null,
        stripeInvoiceCurrency: input.stripeInvoiceCurrency ?? null,
        stripeInvoiceAmountPaid: input.stripeInvoiceAmountPaid ?? null,
        stripeInvoiceAmountDue: input.stripeInvoiceAmountDue ?? null,
        metadata: {
          eventType: event.type,
          matchReason: matched.matchReason,
          replacementBillingSurface: 'workflow_entitlement',
          ...(input.metadata ?? {}),
        },
      });
    } else {
      await stripeWebhook.finalizeDedupe({
        eventType: event.type,
        accountId: account?.id ?? null,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        outcome: 'ignored',
        reason: 'legacy_account_plan_billing_retired',
      });
    }

    if (account) {
      await appendAdminAuditRecordState({
        actorType: 'stripe_webhook',
        actorLabel: 'stripe.webhooks',
        action: 'billing.stripe.webhook_applied',
        routeId: 'billing.stripe.webhook',
        accountId: account.id,
        tenantId: account.primaryTenantId,
        tenantKeyId: null,
        planId: null,
        monthlyRunQuota: null,
        idempotencyKey: event.id,
        requestHash: stripeWebhook.payloadHash,
        metadata: {
          eventType: event.type,
          matchReason: matched.matchReason,
          replacementBillingSurface: 'workflow_entitlement',
          ...(input.metadata ?? {}),
        },
      });
    }

    return c.json({
      received: true,
      duplicate: false,
      ignored: true,
      eventId: event.id,
      eventType: event.type,
      reason: 'legacy_account_plan_billing_retired',
      accountId: account?.id ?? null,
      replacementBillingSurface: 'workflow_entitlement',
    });
  }

  async function processSubscriptionEvent(
    stripeWebhook: StripeWebhookProcessingHandle,
    c: StripeWebhookProcessorContext,
  ): Promise<StripeWebhookBillingProcessorResult> {
    const event = stripeWebhook.event;
    const subscription = event.data.object as Stripe.Subscription;
    const stripeCustomerId = stripeReferenceId(subscription.customer);
    const stripeSubscriptionId = stripeReferenceId(subscription.id);
    const stripeSubscriptionStatus =
      typeof subscription.status === 'string'
        ? subscription.status
        : event.type === 'customer.subscription.deleted'
          ? 'canceled'
          : null;
    const stripePriceId = stripeSubscriptionHostedPriceId(subscription);
    const accountIdFromMetadata = metadataStringValue('attestorAccountId', subscription.metadata);
    const workflowResult = await workflowBillingProcessor.processSubscriptionEvent(stripeWebhook, c);
    if (workflowResult) return workflowResult;

    return processRetiredAccountPlanBillingEvent(stripeWebhook, c, {
      accountId: accountIdFromMetadata,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      metadata: {
        stripeSubscriptionStatus,
      },
    });
  }

  async function processCheckoutCompletedEvent(
    stripeWebhook: StripeWebhookProcessingHandle,
    c: StripeWebhookProcessorContext,
  ): Promise<StripeWebhookBillingProcessorResult> {
    const event = stripeWebhook.event;
    const session = event.data.object as Stripe.Checkout.Session;
    const stripeCheckoutSessionId = stripeReferenceId(session.id);
    const stripeCustomerId = stripeReferenceId(session.customer);
    const stripeSubscriptionId = stripeReferenceId(session.subscription);
    const accountIdFromMetadata = metadataStringValue('attestorAccountId', session.metadata);
    const legacyPlanMetadataKey = ['attestor', 'PlanId'].join('');
    const planIdFromMetadata = metadataStringValue(legacyPlanMetadataKey, session.metadata);
    const workflowResult = await workflowBillingProcessor.processCheckoutCompletedEvent(stripeWebhook, c);
    if (workflowResult) return workflowResult;

    return processRetiredAccountPlanBillingEvent(stripeWebhook, c, {
      accountId: accountIdFromMetadata,
      stripeCustomerId,
      stripeSubscriptionId,
      stripeCheckoutSessionId,
      metadata: {
        checkoutMode: session.mode ?? null,
        legacyPlanMetadataPresent: Boolean(planIdFromMetadata),
      },
    });
  }

  async function processChargeEvent(
    stripeWebhook: StripeWebhookProcessingHandle,
    c: StripeWebhookProcessorContext,
  ): Promise<StripeWebhookBillingProcessorResult> {
    const event = stripeWebhook.event;
    const sharedBillingLedger = stripeWebhook.sharedBillingLedger;
    const charge = event.data.object as Stripe.Charge;
    const stripeChargeId = stripeReferenceId(charge.id);
    const stripeCustomerId = stripeReferenceId(charge.customer);
    const stripeInvoiceId = stripeReferenceId((charge as { invoice?: unknown }).invoice);
    const accountIdFromMetadata = metadataStringValue('attestorAccountId', charge.metadata);
    const matched = await findHostedAccountByStripeRefs({
      accountId: accountIdFromMetadata,
      stripeCustomerId,
      stripeSubscriptionId: null,
    });
    const account = matched.record;
    const chargeCreatedAt = unixSecondsToIso(charge.created) ?? new Date().toISOString();

    if (sharedBillingLedger && stripeChargeId) {
      await upsertStripeCharges({
        accountId: account?.id ?? null,
        tenantId: account?.primaryTenantId ?? null,
        stripeCustomerId,
        stripeSubscriptionId: account?.billing.stripeSubscriptionId ?? null,
        charges: [{
          stripeChargeId,
          stripeInvoiceId,
          stripePaymentIntentId: stripeReferenceId(charge.payment_intent),
          amount: typeof charge.amount === 'number' ? charge.amount : null,
          amountRefunded: typeof charge.amount_refunded === 'number' ? charge.amount_refunded : null,
          currency: typeof charge.currency === 'string' ? charge.currency : null,
          status: parseStripeChargeStatus(charge.status),
          paid: typeof charge.paid === 'boolean' ? charge.paid : null,
          refunded: typeof charge.refunded === 'boolean' ? charge.refunded : null,
          failureCode: typeof charge.failure_code === 'string' ? charge.failure_code : null,
          failureMessage: typeof charge.failure_message === 'string' ? charge.failure_message : null,
          metadata: {
            eventType: event.type,
          },
          createdAt: chargeCreatedAt,
        }],
        source: 'stripe_webhook',
      });
    }

    if (!account) {
      observeBillingWebhookEvent(event.type, 'ignored');
      if (sharedBillingLedger) {
        await stripeWebhook.finalizeSharedEvent({
          providerEventId: event.id,
          outcome: 'ignored',
          reason: 'no_account_match',
          stripeCustomerId,
          stripeSubscriptionId: null,
          stripeInvoiceId,
          metadata: {
            eventType: event.type,
            stripeChargeId,
            chargeStatus: parseStripeChargeStatus(charge.status),
            chargeCreatedAt,
          },
        });
      } else {
        await stripeWebhook.finalizeDedupe({
          eventType: event.type,
          accountId: null,
          stripeCustomerId,
          stripeSubscriptionId: null,
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
        stripeChargeId,
        invoiceId: stripeInvoiceId,
      });
    }

    const entitlement = await syncHostedBillingEntitlement(account, {
      lastEventId: event.id,
      lastEventType: event.type,
      lastEventAt: chargeCreatedAt,
    });

    c.set('obs.accountId', account.id);
    c.set('obs.accountStatus', account.status);
    c.set('obs.tenantId', account.primaryTenantId);
    c.set('obs.planId', account.billing.lastCheckoutPlanId ?? entitlement.effectivePlanId ?? null);

    if (sharedBillingLedger) {
      await stripeWebhook.finalizeSharedEvent({
        providerEventId: event.id,
        outcome: 'applied',
        accountId: account.id,
        tenantId: account.primaryTenantId,
        stripeCustomerId,
        stripeSubscriptionId: account.billing.stripeSubscriptionId,
        stripePriceId: account.billing.stripePriceId,
        stripeInvoiceId,
        metadata: {
          eventType: event.type,
          matchReason: matched.matchReason,
          stripeChargeId,
          chargeStatus: parseStripeChargeStatus(charge.status),
          chargeCreatedAt,
          entitlementStatus: entitlement.status,
          entitlementAccessEnabled: entitlement.accessEnabled,
          effectivePlanId: entitlement.effectivePlanId,
        },
      });
    } else {
      await stripeWebhook.finalizeDedupe({
        eventType: event.type,
        accountId: account.id,
        stripeCustomerId,
        stripeSubscriptionId: account.billing.stripeSubscriptionId,
        outcome: 'applied',
        reason: null,
      });
    }

    observeBillingWebhookEvent(event.type, 'applied');

    await appendAdminAuditRecordState({
      actorType: 'stripe_webhook',
      actorLabel: 'stripe.webhooks',
      action: 'billing.stripe.webhook_applied',
      routeId: 'billing.stripe.webhook',
      accountId: account.id,
      tenantId: account.primaryTenantId,
      tenantKeyId: null,
      planId: account.billing.lastCheckoutPlanId ?? entitlement.effectivePlanId ?? null,
      monthlyRunQuota: null,
      idempotencyKey: event.id,
      requestHash: stripeWebhook.payloadHash,
      metadata: {
        eventType: event.type,
        matchReason: matched.matchReason,
        stripeChargeId,
        stripeCustomerId,
        stripeInvoiceId,
        chargeStatus: parseStripeChargeStatus(charge.status),
        chargeCreatedAt,
        entitlementStatus: entitlement.status,
        entitlementAccessEnabled: entitlement.accessEnabled,
        effectivePlanId: entitlement.effectivePlanId,
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
      chargeId: stripeChargeId,
      invoiceId: stripeInvoiceId,
    });
  }

  async function processEntitlementSummaryEvent(
    stripeWebhook: StripeWebhookProcessingHandle,
    c: StripeWebhookProcessorContext,
  ): Promise<StripeWebhookBillingProcessorResult> {
    const event = stripeWebhook.event;
    const sharedBillingLedger = stripeWebhook.sharedBillingLedger;
    const summary = event.data.object as Stripe.Entitlements.ActiveEntitlementSummary;
    const stripeCustomerId = stripeReferenceId((summary as { customer?: unknown }).customer);
    const matched = await findHostedAccountByStripeRefs({
      accountId: null,
      stripeCustomerId,
      stripeSubscriptionId: null,
    });
    const account = matched.record;
    const summaryUpdatedAt = unixSecondsToIso(event.created) ?? new Date().toISOString();
    const canFetchCanonicalEntitlements = process.env.ATTESTOR_STRIPE_USE_MOCK !== 'true'
      && Boolean(process.env.STRIPE_API_KEY?.trim())
      && Boolean(stripeCustomerId);
    const summaryEntitlements = extractActiveEntitlementsFromSummary(summary);
    const canonicalEntitlements = canFetchCanonicalEntitlements && stripeCustomerId
      ? await listHostedStripeActiveEntitlements({
        customerId: stripeCustomerId,
        limit: 5_000,
      })
      : [];
    const entitlementRecords = canonicalEntitlements.length > 0 ? canonicalEntitlements : summaryEntitlements;
    const lookupKeys = [...new Set(entitlementRecords.map((record) => record.lookupKey).filter((value) => value.trim() !== ''))].sort();
    const featureIds = [...new Set(entitlementRecords.map((record) => record.featureId ?? '').filter((value) => value.trim() !== ''))].sort();

    if (!account) {
      observeBillingWebhookEvent(event.type, 'ignored');
      if (sharedBillingLedger) {
        await stripeWebhook.finalizeSharedEvent({
          providerEventId: event.id,
          outcome: 'ignored',
          reason: 'no_account_match',
          stripeCustomerId,
          stripeSubscriptionId: null,
          metadata: {
            eventType: event.type,
            entitlementLookupKeyCount: lookupKeys.length,
            entitlementFeatureIdCount: featureIds.length,
            entitlementSummaryUpdatedAt: summaryUpdatedAt,
          },
        });
      } else {
        await stripeWebhook.finalizeDedupe({
          eventType: event.type,
          accountId: null,
          stripeCustomerId,
          stripeSubscriptionId: null,
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
      });
    }

    const entitlement = await syncHostedBillingEntitlement(account, {
      lastEventId: event.id,
      lastEventType: event.type,
      lastEventAt: summaryUpdatedAt,
      stripeEntitlementLookupKeys: lookupKeys,
      stripeEntitlementFeatureIds: featureIds,
      stripeEntitlementSummaryUpdatedAt: summaryUpdatedAt,
    });

    c.set('obs.accountId', account.id);
    c.set('obs.accountStatus', account.status);
    c.set('obs.tenantId', account.primaryTenantId);
    c.set('obs.planId', account.billing.lastCheckoutPlanId ?? entitlement.effectivePlanId ?? null);

    if (sharedBillingLedger) {
      await stripeWebhook.finalizeSharedEvent({
        providerEventId: event.id,
        outcome: 'applied',
        accountId: account.id,
        tenantId: account.primaryTenantId,
        stripeCustomerId,
        stripeSubscriptionId: account.billing.stripeSubscriptionId,
        stripePriceId: account.billing.stripePriceId,
        metadata: {
          eventType: event.type,
          matchReason: matched.matchReason,
          entitlementLookupKeys: lookupKeys,
          entitlementFeatureIds: featureIds,
          entitlementSummaryUpdatedAt: summaryUpdatedAt,
          entitlementStatus: entitlement.status,
          entitlementAccessEnabled: entitlement.accessEnabled,
          effectivePlanId: entitlement.effectivePlanId,
        },
      });
    } else {
      await stripeWebhook.finalizeDedupe({
        eventType: event.type,
        accountId: account.id,
        stripeCustomerId,
        stripeSubscriptionId: account.billing.stripeSubscriptionId,
        outcome: 'applied',
        reason: null,
      });
    }

    observeBillingWebhookEvent(event.type, 'applied');

    await appendAdminAuditRecordState({
      actorType: 'stripe_webhook',
      actorLabel: 'stripe.webhooks',
      action: 'billing.stripe.webhook_applied',
      routeId: 'billing.stripe.webhook',
      accountId: account.id,
      tenantId: account.primaryTenantId,
      tenantKeyId: null,
      planId: account.billing.lastCheckoutPlanId ?? entitlement.effectivePlanId ?? null,
      monthlyRunQuota: null,
      idempotencyKey: event.id,
      requestHash: stripeWebhook.payloadHash,
      metadata: {
        eventType: event.type,
        matchReason: matched.matchReason,
        stripeCustomerId,
        entitlementLookupKeys: lookupKeys,
        entitlementFeatureIds: featureIds,
        entitlementSummaryUpdatedAt: summaryUpdatedAt,
        entitlementStatus: entitlement.status,
        entitlementAccessEnabled: entitlement.accessEnabled,
        effectivePlanId: entitlement.effectivePlanId,
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
      entitlement: billingEntitlementView(entitlement),
    });
  }

  async function processInvoiceEvent(
    stripeWebhook: StripeWebhookProcessingHandle,
    c: StripeWebhookProcessorContext,
  ): Promise<StripeWebhookBillingProcessorResult> {
    const event = stripeWebhook.event;
    const invoice = event.data.object as StripeInvoiceWebhookObject;
    const stripeCustomerId = stripeReferenceId(invoice.customer);
    const stripeSubscriptionId = stripeReferenceId(invoice.subscription);
    const stripePriceId = null;
    const stripeInvoiceId = stripeReferenceId(invoice.id);
    const stripeInvoiceStatus: BillingInvoiceStatus | null = invoice.status === 'draft'
      || invoice.status === 'open'
      || invoice.status === 'paid'
      || invoice.status === 'uncollectible'
      || invoice.status === 'void'
      ? invoice.status
      : event.type === 'invoice.paid'
        ? 'paid'
        : null;
    const stripeInvoiceCurrency = typeof invoice.currency === 'string' ? invoice.currency : null;
    const accountIdFromMetadata = metadataStringValue(
      'attestorAccountId',
      invoice.metadata,
      invoice.subscription_details?.metadata ?? null,
    );
    const workflowResult = await workflowBillingProcessor.processInvoiceEvent(stripeWebhook, c);
    if (workflowResult) return workflowResult;

    return processRetiredAccountPlanBillingEvent(stripeWebhook, c, {
      accountId: accountIdFromMetadata,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      stripeInvoiceId,
      stripeInvoiceStatus,
      stripeInvoiceCurrency,
      stripeInvoiceAmountPaid: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : null,
      stripeInvoiceAmountDue: typeof invoice.amount_due === 'number' ? invoice.amount_due : null,
      metadata: {
        billingReason: invoice.billing_reason ?? null,
      },
    });
  }

  return {
    async process(stripeWebhook) {
      const c = createProcessorContext();
      const event = stripeWebhook.event;
      try {
        if (!isSupportedStripeWebhookEvent(event.type)) {
          return processUnsupportedStripeBillingEvent(stripeWebhook, c, observeBillingWebhookEvent);
        }

        if (event.type.startsWith('customer.subscription.')) {
          return processSubscriptionEvent(stripeWebhook, c);
        }

        if (event.type === 'checkout.session.completed') {
          return processCheckoutCompletedEvent(stripeWebhook, c);
        }

        if (isStripeChargeEvent(event.type)) {
          return processChargeEvent(stripeWebhook, c);
        }

        if (event.type === 'entitlements.active_entitlement_summary.updated') {
          return processEntitlementSummaryEvent(stripeWebhook, c);
        }

        return processInvoiceEvent(stripeWebhook, c);
      } catch (err) {
        try {
          await stripeWebhook.releaseClaim();
        } catch {
          // allow original failure to surface
        }
        throw err;
      }
    },
  };
}
