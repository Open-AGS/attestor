import type { Context, Hono, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { isProductionLikeRuntimeEnv } from './deployment-safety.js';

export const DEFAULT_API_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

export interface HttpProductionEdgeContractOptions {
  apiBodyLimitBytes?: number;
  env?: Readonly<Record<string, string | undefined>>;
  logger?: Pick<Console, 'error'>;
}

function sanitizeLogField(value: string): string {
  return value.replace(/[\r\n\t]/gu, ' ').slice(0, 240);
}

function errorKind(error: unknown): string {
  if (error instanceof Error) return error.name || 'Error';
  return typeof error;
}

export function resolveApiBodyLimitBytes(
  rawValue: string | undefined = process.env.ATTESTOR_HTTP_BODY_LIMIT_BYTES,
): number {
  if (rawValue === undefined || rawValue.trim() === '') {
    return DEFAULT_API_BODY_LIMIT_BYTES;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || `${parsed}` !== rawValue.trim()) {
    throw new Error('ATTESTOR_HTTP_BODY_LIMIT_BYTES must be a positive integer byte count');
  }
  return parsed;
}

function createApiNoStoreMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.header('cache-control', 'no-store');
  };
}

function createPayloadTooLargeResponse(maxSizeBytes: number) {
  return (c: Context) => c.json({
    error: 'payload_too_large',
    message: 'Request body exceeds the configured Attestor API limit.',
    maxSizeBytes,
  }, 413);
}

function normalizeHostname(raw: string | null | undefined): string | null {
  const value = raw?.trim().toLowerCase() ?? '';
  if (!value) return null;
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    return end > 1 ? value.slice(1, end) : null;
  }
  const withoutPort = value.replace(/:\d+$/u, '');
  return withoutPort || null;
}

function hostFromBaseUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return normalizeHostname(new URL(value).hostname);
  } catch {
    return null;
  }
}

function allowedHostnames(env: Readonly<Record<string, string | undefined>>): ReadonlySet<string> {
  const hosts = new Set<string>();
  const publicHostname = normalizeHostname(env.ATTESTOR_PUBLIC_HOSTNAME);
  if (publicHostname) hosts.add(publicHostname);
  const publicBaseHostname = hostFromBaseUrl(env.ATTESTOR_PUBLIC_BASE_URL);
  if (publicBaseHostname) hosts.add(publicBaseHostname);
  for (const host of (env.ATTESTOR_ALLOWED_HOSTS ?? '').split(',')) {
    const normalized = normalizeHostname(host);
    if (normalized) hosts.add(normalized);
  }
  return hosts;
}

function createHostValidationMiddleware(
  env: Readonly<Record<string, string | undefined>>,
): MiddlewareHandler {
  const allowedHosts = allowedHostnames(env);
  const enforce = isProductionLikeRuntimeEnv(env) && allowedHosts.size > 0;

  return async (c, next) => {
    if (!enforce) {
      await next();
      return;
    }

    const requestHost = normalizeHostname(c.req.header('host'));
    if (requestHost && allowedHosts.has(requestHost)) {
      await next();
      return;
    }

    c.header('cache-control', 'no-store');
    return c.json({
      error: 'host_not_allowed',
      message: 'Request Host is not allowed by the Attestor HTTP edge contract.',
    }, 421);
  };
}

function createNotFoundHandler() {
  return (c: Context) => {
    if (c.req.path.startsWith('/api/')) {
      c.header('cache-control', 'no-store');
      return c.json({ error: 'not_found' }, 404);
    }
    return c.text('Not found', 404);
  };
}

function createErrorHandler(logger: Pick<Console, 'error'>) {
  return (error: Error, c: Context) => {
    logger.error(
      `[http] unhandled request error method=${sanitizeLogField(c.req.method)} path=${sanitizeLogField(c.req.path)} kind=${sanitizeLogField(errorKind(error))}`,
    );
    c.header('cache-control', 'no-store');
    return c.json({
      error: 'internal_error',
      message: 'Internal server error',
    }, 500);
  };
}

export function installHttpProductionEdgeContract(
  app: Hono,
  options: HttpProductionEdgeContractOptions = {},
): void {
  const apiBodyLimitBytes = options.apiBodyLimitBytes ?? resolveApiBodyLimitBytes();
  const env = options.env ?? process.env;
  const logger = options.logger ?? console;

  app.use('*', secureHeaders({
    contentSecurityPolicy: {
      frameAncestors: ["'none'"],
    },
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
    permissionsPolicy: {
      camera: [],
      geolocation: [],
      microphone: [],
      payment: [],
    },
    referrerPolicy: 'no-referrer',
    strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'DENY',
  }));

  app.use('*', createHostValidationMiddleware(env));
  app.use('/api/*', createApiNoStoreMiddleware());
  app.use('/api/*', bodyLimit({
    maxSize: apiBodyLimitBytes,
    onError: createPayloadTooLargeResponse(apiBodyLimitBytes),
  }));
  app.notFound(createNotFoundHandler());
  app.onError(createErrorHandler(logger));
}
