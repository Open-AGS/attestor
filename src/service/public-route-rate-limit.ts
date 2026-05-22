import type { Context } from 'hono';

export interface PublicRouteRateLimitOptions {
  readonly scope: string;
  readonly envVar: string;
  readonly defaultLimit: number;
  readonly maxLimit: number;
  readonly windowMs?: number;
  readonly errorMessage: string;
  readonly resetHeaderName: string;
}

const PUBLIC_ROUTE_RATE_LIMIT_WINDOW_MS = 60_000;

const publicRouteAttempts = new Map<string, {
  count: number;
  resetAt: number;
}>();

function configuredPublicRouteRateLimit(options: PublicRouteRateLimitOptions): number {
  const raw = process.env[options.envVar]?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : options.defaultLimit;
  if (!Number.isFinite(parsed) || parsed <= 0) return options.defaultLimit;
  return Math.min(parsed, options.maxLimit);
}

function publicRouteRateLimitKey(context: Context, scope: string): string {
  const forwardedFor = context.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const client =
    context.req.header('cf-connecting-ip')?.trim() ||
    context.req.header('x-real-ip')?.trim() ||
    forwardedFor ||
    'unknown-client';
  return `public-route:${scope}:${client}`;
}

export function publicRouteRateLimitResponse(
  context: Context,
  options: PublicRouteRateLimitOptions,
): Response | null {
  const limit = configuredPublicRouteRateLimit(options);
  const now = Date.now();
  const windowMs = options.windowMs ?? PUBLIC_ROUTE_RATE_LIMIT_WINDOW_MS;
  const key = publicRouteRateLimitKey(context, options.scope);
  for (const [entryKey, entry] of publicRouteAttempts.entries()) {
    if (entry.resetAt <= now) publicRouteAttempts.delete(entryKey);
  }

  const existing = publicRouteAttempts.get(key);
  const entry = existing && existing.resetAt > now
    ? existing
    : {
        count: 0,
        resetAt: now + windowMs,
      };
  entry.count += 1;
  publicRouteAttempts.set(key, entry);

  if (entry.count <= limit) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  context.header('retry-after', String(retryAfterSeconds));
  context.header(options.resetHeaderName, new Date(entry.resetAt).toISOString());
  return context.json({
    error: options.errorMessage,
    retryAfterSeconds,
  }, 429);
}

export function resetPublicRouteRateLimiterForTests(): void {
  publicRouteAttempts.clear();
}
