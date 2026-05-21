import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { registerEmailWebhookRoutes } from '../src/service/http/routes/email-webhook-routes.js';
import { registerStripeWebhookRoutes } from '../src/service/http/routes/stripe-webhook-routes.js';
import { resetWebhookAuthRateLimiterForTests } from '../src/service/webhook-rate-limit.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

async function testStripeWebhookRateLimitRunsBeforeService(): Promise<void> {
  const saved = process.env.ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE;
  process.env.ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE = '1';
  resetWebhookAuthRateLimiterForTests();
  try {
    let beginCalls = 0;
    const app = new Hono();
    registerStripeWebhookRoutes(app, {
      stripeWebhookService: {
        async begin() {
          beginCalls += 1;
          return {
            kind: 'rejected',
            statusCode: 400,
            responseBody: { error: 'fake stripe signature failure' },
          };
        },
      },
      stripeWebhookBillingProcessor: {
        async process() {
          throw new Error('processor should not run in rate-limit test');
        },
      },
    } as never);

    const first = await app.request('/api/v1/billing/stripe/webhook', {
      method: 'POST',
      headers: { 'x-real-ip': '198.51.100.8' },
      body: '{}',
    });
    const second = await app.request('/api/v1/billing/stripe/webhook', {
      method: 'POST',
      headers: { 'x-real-ip': '198.51.100.8' },
      body: '{}',
    });

    equal(first.status, 400, 'Stripe webhook first request reaches service');
    equal(second.status, 429, 'Stripe webhook second request is rate-limited');
    equal(beginCalls, 1, 'Stripe webhook rate limit runs before signature/service work');
  } finally {
    resetWebhookAuthRateLimiterForTests();
    if (saved === undefined) delete process.env.ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE;
    else process.env.ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE = saved;
  }
}

async function testEmailWebhookRateLimitScopesProvidersSeparately(): Promise<void> {
  const saved = process.env.ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE;
  process.env.ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE = '1';
  resetWebhookAuthRateLimiterForTests();
  try {
    let sendGridCalls = 0;
    let mailgunCalls = 0;
    const app = new Hono();
    registerEmailWebhookRoutes(app, {
      emailWebhookService: {
        async handleSendGrid() {
          sendGridCalls += 1;
          return {
            statusCode: 400,
            responseBody: { error: 'fake sendgrid signature failure' },
          };
        },
        async handleMailgun() {
          mailgunCalls += 1;
          return {
            statusCode: 400,
            responseBody: { error: 'fake mailgun signature failure' },
          };
        },
      },
    } as never);

    const ipHeaders = { 'x-real-ip': '198.51.100.9' };
    const firstSendGrid = await app.request('/api/v1/email/sendgrid/webhook', {
      method: 'POST',
      headers: ipHeaders,
      body: '[]',
    });
    const secondSendGrid = await app.request('/api/v1/email/sendgrid/webhook', {
      method: 'POST',
      headers: ipHeaders,
      body: '[]',
    });
    const firstMailgun = await app.request('/api/v1/email/mailgun/webhook', {
      method: 'POST',
      headers: ipHeaders,
      body: '{}',
    });
    const secondMailgun = await app.request('/api/v1/email/mailgun/webhook', {
      method: 'POST',
      headers: ipHeaders,
      body: '{}',
    });

    equal(firstSendGrid.status, 400, 'SendGrid first request reaches service');
    equal(secondSendGrid.status, 429, 'SendGrid second request is rate-limited');
    equal(firstMailgun.status, 400, 'Mailgun first request has its own rate-limit scope');
    equal(secondMailgun.status, 429, 'Mailgun second request is rate-limited');
    equal(sendGridCalls, 1, 'SendGrid rate limit runs before service work');
    equal(mailgunCalls, 1, 'Mailgun rate limit runs before service work');
  } finally {
    resetWebhookAuthRateLimiterForTests();
    if (saved === undefined) delete process.env.ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE;
    else process.env.ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE = saved;
  }
}

await testStripeWebhookRateLimitRunsBeforeService();
await testEmailWebhookRateLimitScopesProvidersSeparately();

console.log(`Service webhook route rate-limit tests: ${passed} passed, 0 failed`);
