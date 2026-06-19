import type { Handler } from 'hono';
import {
  ATTESTOR_WEBHOOK_RECEIVER_STATUS_HEADER,
  HONO_RELEASE_WEBHOOK_BODY_CONTEXT_KEY,
  HONO_RELEASE_WEBHOOK_RECEIVER_CONTEXT_KEY,
  type HonoReleaseWebhookReceiverEnv,
  type HonoReleaseWebhookReceiverHandler,
  type ReleaseWebhookReceiverOptions,
} from './webhook-receiver-types.js';
import {
  evaluateReleaseWebhookRequest,
} from './webhook-receiver-core.js';
import {
  rejectedResponse,
} from './webhook-receiver-result.js';

export function createHonoReleaseWebhookReceiver<E extends HonoReleaseWebhookReceiverEnv = HonoReleaseWebhookReceiverEnv>(
  options: ReleaseWebhookReceiverOptions,
  handler: HonoReleaseWebhookReceiverHandler<E>,
): Handler<E> {
  return async (context) => {
    const body = new Uint8Array(await context.req.raw.arrayBuffer());
    const result = await evaluateReleaseWebhookRequest(
      {
        method: context.req.method,
        url: context.req.url,
        headers: context.req.raw.headers,
        body,
      },
      options,
      'hono',
      context,
    );
    context.set(HONO_RELEASE_WEBHOOK_RECEIVER_CONTEXT_KEY, result);
    context.set(HONO_RELEASE_WEBHOOK_BODY_CONTEXT_KEY, body);
    context.header(ATTESTOR_WEBHOOK_RECEIVER_STATUS_HEADER, result.status);

    if (result.status === 'rejected') {
      return rejectedResponse(result);
    }

    return handler(context, result, body);
  };
}
