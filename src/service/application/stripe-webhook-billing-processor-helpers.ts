import type Stripe from 'stripe';

export function isStripeChargeEvent(eventType: string): boolean {
  return eventType === 'charge.succeeded'
    || eventType === 'charge.failed'
    || eventType === 'charge.refunded';
}

export function stripeSubscriptionHostedPriceId(
  subscription: Stripe.Subscription,
): string | null {
  const priceIds = (subscription.items?.data ?? [])
    .map((item) => typeof item.price?.id === 'string' ? item.price.id : null)
    .filter((priceId): priceId is string => priceId !== null);
  return priceIds[0] ?? null;
}
