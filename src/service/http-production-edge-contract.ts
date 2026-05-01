import type { Context, Hono, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';

export const DEFAULT_API_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

export interface HttpProductionEdgeContractOptions {
  apiBodyLimitBytes?: number;
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
  const logger = options.logger ?? console;

  app.use('*', secureHeaders({
    contentSecurityPolicy: {
      frameAncestors: ["'none'"],
    },
    permissionsPolicy: {
      camera: [],
      geolocation: [],
      microphone: [],
      payment: [],
    },
    xFrameOptions: 'DENY',
  }));

  app.use('/api/*', createApiNoStoreMiddleware());
  app.use('/api/*', bodyLimit({
    maxSize: apiBodyLimitBytes,
    onError: createPayloadTooLargeResponse(apiBodyLimitBytes),
  }));
  app.notFound(createNotFoundHandler());
  app.onError(createErrorHandler(logger));
}
