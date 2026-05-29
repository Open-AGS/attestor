import type { BillingWebhookMetricOutcome, StripeWebhookProcessingHandle } from './stripe-webhook-service.js';
import type {
  StripeWebhookBillingProcessorResult,
  StripeWebhookProcessorContext,
} from './stripe-webhook-billing-processor-types.js';

export async function processUnsupportedStripeBillingEvent(
  stripeWebhook: StripeWebhookProcessingHandle,
  c: StripeWebhookProcessorContext,
  observeBillingWebhookEvent: (eventType: string, outcome: BillingWebhookMetricOutcome) => void,
): Promise<StripeWebhookBillingProcessorResult> {
  const event = stripeWebhook.event;
  const sharedBillingLedger = stripeWebhook.sharedBillingLedger;
  observeBillingWebhookEvent(event.type, 'ignored');
  if (sharedBillingLedger) {
    await stripeWebhook.finalizeSharedEvent({
      providerEventId: event.id,
      outcome: 'ignored',
      reason: 'unsupported_event_type',
      metadata: {
        eventType: event.type,
      },
    });
  } else {
    await stripeWebhook.finalizeDedupe({
      eventType: event.type,
      accountId: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      outcome: 'ignored',
      reason: 'unsupported_event_type',
    });
  }
  return c.json({
    received: true,
    duplicate: false,
    ignored: true,
    eventId: event.id,
    eventType: event.type,
    reason: 'unsupported_event_type',
  });
}
