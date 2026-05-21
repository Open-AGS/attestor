import type { Context } from 'hono';

const WEBHOOK_AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const WEBHOOK_AUTH_RATE_LIMIT_DEFAULT = 600;
const WEBHOOK_AUTH_RATE_LIMIT_MAX = 50_000;

const webhookAuthAttempts = new Map<string, {
  count: number;
  resetAt: number;
}>();

function configuredWebhookRateLimit(): number {
  const raw = process.env.ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : WEBHOOK_AUTH_RATE_LIMIT_DEFAULT;
  if (!Number.isFinite(parsed) || parsed <= 0) return WEBHOOK_AUTH_RATE_LIMIT_DEFAULT;
  return Math.min(parsed, WEBHOOK_AUTH_RATE_LIMIT_MAX);
}

function webhookRateLimitKey(context: Context, scope: string): string {
  const forwardedFor = context.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const client =
    context.req.header('cf-connecting-ip')?.trim() ||
    context.req.header('x-real-ip')?.trim() ||
    forwardedFor ||
    'unknown-client';
  return `webhook-auth:${scope}:${client}`;
}

export function webhookAuthRateLimitResponse(context: Context, scope: string): Response | null {
  const limit = configuredWebhookRateLimit();
  const now = Date.now();
  const key = webhookRateLimitKey(context, scope);
  for (const [entryKey, entry] of webhookAuthAttempts.entries()) {
    if (entry.resetAt <= now) webhookAuthAttempts.delete(entryKey);
  }

  const existing = webhookAuthAttempts.get(key);
  const entry = existing && existing.resetAt > now
    ? existing
    : {
        count: 0,
        resetAt: now + WEBHOOK_AUTH_RATE_LIMIT_WINDOW_MS,
      };
  entry.count += 1;
  webhookAuthAttempts.set(key, entry);

  if (entry.count <= limit) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  context.header('retry-after', String(retryAfterSeconds));
  context.header('x-attestor-webhook-auth-rate-limit-reset-at', new Date(entry.resetAt).toISOString());
  return context.json({
    error: 'Webhook authentication rate limit exceeded.',
    retryAfterSeconds,
  }, 429);
}

export function resetWebhookAuthRateLimiterForTests(): void {
  webhookAuthAttempts.clear();
}
