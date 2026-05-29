import type Stripe from 'stripe';
import type * as PlanCatalog from '../plan-catalog.js';

export function isStripeChargeEvent(eventType: string): boolean {
  return eventType === 'charge.succeeded'
    || eventType === 'charge.failed'
    || eventType === 'charge.refunded';
}

export function stripeSubscriptionHostedPriceId(
  subscription: Stripe.Subscription,
  findHostedPlanByStripePriceId: typeof PlanCatalog.findHostedPlanByStripePriceId,
): string | null {
  const priceIds = (subscription.items?.data ?? [])
    .map((item) => typeof item.price?.id === 'string' ? item.price.id : null)
    .filter((priceId): priceId is string => priceId !== null);
  return priceIds.find((priceId) => findHostedPlanByStripePriceId(priceId) !== null)
    ?? priceIds[0]
    ?? null;
}
