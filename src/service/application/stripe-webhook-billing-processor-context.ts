import {
  AccountStoreError,
  type HostedAccountRecord,
} from '../account/account-store.js';
import type {
  StripeWebhookBillingProcessorResult,
  StripeWebhookProcessorContext,
  StripeWebhookProcessorObservability,
} from './stripe-webhook-billing-processor-types.js';

export function createProcessorContext(): StripeWebhookProcessorContext {
  const observability: StripeWebhookProcessorObservability = {};
  return {
    observability,
    json(responseBody, statusCode = 200) {
      return {
        statusCode,
        responseBody,
        observability,
      };
    },
    set(key, value) {
      switch (key) {
        case 'obs.accountId':
          observability.accountId = typeof value === 'string' ? value : null;
          break;
        case 'obs.accountStatus':
          observability.accountStatus = typeof value === 'string'
            ? value as HostedAccountRecord['status']
            : null;
          break;
        case 'obs.tenantId':
          observability.tenantId = typeof value === 'string' ? value : null;
          break;
        case 'obs.planId':
          observability.planId = typeof value === 'string' ? value : null;
          break;
      }
    },
  };
}

export function accountStoreErrorResponse(
  c: StripeWebhookProcessorContext,
  err: unknown,
): StripeWebhookBillingProcessorResult | null {
  if (!(err instanceof AccountStoreError)) return null;
  if (err.code === 'NOT_FOUND') {
    return c.json({ error: err.message }, 404);
  }
  return c.json({ error: err.message }, 409);
}
