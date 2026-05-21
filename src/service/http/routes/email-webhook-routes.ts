import type { Hono } from 'hono';
import type { EmailWebhookService } from '../../application/email-webhook-service.js';
import { webhookAuthRateLimitResponse } from '../../webhook-rate-limit.js';

export interface EmailWebhookRouteDeps {
  emailWebhookService: EmailWebhookService;
}

export function registerEmailWebhookRoutes(app: Hono, deps: EmailWebhookRouteDeps): void {
  const { emailWebhookService } = deps;

  app.post('/api/v1/email/sendgrid/webhook', async (c) => {
    const rateLimited = webhookAuthRateLimitResponse(c, 'sendgrid');
    if (rateLimited) return rateLimited;

    const result = await emailWebhookService.handleSendGrid({
      rawPayload: await c.req.text(),
      signature: c.req.header('x-twilio-email-event-webhook-signature'),
      timestamp: c.req.header('x-twilio-email-event-webhook-timestamp'),
    });
    return c.json(result.responseBody, result.statusCode);
  });

  app.post('/api/v1/email/mailgun/webhook', async (c) => {
    const rateLimited = webhookAuthRateLimitResponse(c, 'mailgun');
    if (rateLimited) return rateLimited;

    const result = await emailWebhookService.handleMailgun({
      rawPayload: await c.req.text(),
    });
    return c.json(result.responseBody, result.statusCode);
  });
}
