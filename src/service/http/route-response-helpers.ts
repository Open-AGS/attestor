import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';

export function acceptsJsonRequestBody(context: Context): boolean {
  const mediaType = context.req.header('content-type')
    ?.toLowerCase()
    .split(';')[0]
    ?.trim() ?? '';

  return mediaType === 'application/json' || /^application\/[^/]+\+json$/u.test(mediaType);
}

export function opaqueRouteRunId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function secureHtmlResponseHeaders(): Record<string, string> {
  return {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': [
      "default-src 'none'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data:",
      "style-src 'unsafe-inline'",
    ].join('; '),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
  };
}
