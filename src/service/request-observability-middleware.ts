import type { Context, MiddlewareHandler } from 'hono';
import type { HostedAccountRecord } from './account-store.js';
import type * as ControlPlaneStore from './control-plane-store.js';
import {
  appendStructuredRequestLog,
  beginRequestTrace,
  completeRequestTrace,
  observeRequestComplete,
  observeRequestStart,
} from './observability.js';
import { currentTenant } from './request-context.js';
import { directRemoteAddressFromContext, resolveTrustedClientAddress } from './trusted-proxy.js';

export interface RequestObservabilityMiddlewareDeps {
  serviceInstanceId: string;
  findHostedAccountByTenantId: typeof ControlPlaneStore.findHostedAccountByTenantIdState;
}

function remoteAddressFromContext(context: Context): string | null {
  return resolveTrustedClientAddress({
    headers: context.req.raw.headers,
    directRemoteAddress: directRemoteAddressFromContext(context),
  }).address;
}

function routeLabelFromContext(context: Context, statusCode: number): string {
  const routePath = context.req.routePath;
  if (routePath && routePath.trim()) return routePath;
  return statusCode === 404 ? '__unmatched__' : '__unrouted__';
}

export function createRequestObservabilityMiddleware(
  deps: RequestObservabilityMiddlewareDeps,
): MiddlewareHandler {
  return async (context, next) => {
    const requestUrl = new URL(context.req.url);
    const remoteAddress = remoteAddressFromContext(context);
    const trace = beginRequestTrace(context.req.header('traceparent'), {
      method: context.req.method,
      path: context.req.path,
      url: context.req.url,
      remoteAddress,
      userAgent: context.req.header('user-agent') ?? null,
      serverAddress: requestUrl.hostname || null,
      serverPort: requestUrl.port ? Number.parseInt(requestUrl.port, 10) : null,
    });
    const startedAt = process.hrtime.bigint();
    observeRequestStart();

    let statusCode = 500;
    let route = '__unrouted__';
    let rateLimited = false;
    let quotaRejected = false;
    let thrownError: unknown = null;

    try {
      await next();
      statusCode = context.res.status;
      route = routeLabelFromContext(context, statusCode);
      rateLimited = context.res.headers.get('retry-after') !== null;
      quotaRejected = statusCode === 429 && route === '/api/v1/pipeline/run';
    } catch (error) {
      route = routeLabelFromContext(context, statusCode);
      thrownError = error;
      throw error;
    } finally {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      const tenant = currentTenant(context);
      const observedTenantId = context.get('obs.tenantId') as string | null | undefined;
      const observedPlanId = context.get('obs.planId') as string | null | undefined;
      const observedAccountId = context.get('obs.accountId') as string | null | undefined;
      const observedAccountStatus = context.get('obs.accountStatus') as string | null | undefined;
      let account: HostedAccountRecord | null = null;

      if (!observedAccountId && tenant.tenantId && tenant.tenantId !== 'default') {
        try {
          account = await deps.findHostedAccountByTenantId(tenant.tenantId);
        } catch {
          // Observability must not take down request handling if its lookup backend is unavailable.
        }
      }

      observeRequestComplete({
        route,
        method: context.req.method,
        statusCode,
        durationSeconds,
        traceContextStatus: trace.incomingStatus,
      });
      completeRequestTrace(trace, {
        route,
        method: context.req.method,
        path: context.req.path,
        statusCode,
        durationSeconds,
        tenantId: observedTenantId ?? tenant.tenantId ?? null,
        planId: observedPlanId ?? tenant.planId ?? null,
        accountId: observedAccountId ?? account?.id ?? null,
        accountStatus: observedAccountStatus ?? account?.status ?? null,
        rateLimited,
        quotaRejected,
        remoteAddress,
        userAgent: context.req.header('user-agent') ?? null,
        error: thrownError,
      });

      appendStructuredRequestLog({
        occurredAt: new Date().toISOString(),
        route,
        path: context.req.path,
        method: context.req.method,
        statusCode,
        durationMs: Math.round(durationSeconds * 1000),
        traceId: trace.traceId,
        spanId: trace.spanId,
        parentSpanId: trace.parentSpanId,
        traceFlags: trace.traceFlags,
        tenantId: observedTenantId ?? tenant.tenantId ?? null,
        planId: observedPlanId ?? tenant.planId ?? null,
        accountId: observedAccountId ?? account?.id ?? null,
        accountStatus: observedAccountStatus ?? account?.status ?? null,
        rateLimited,
        quotaRejected,
        remoteAddress,
        userAgent: context.req.header('user-agent') ?? null,
      });

      context.header('traceparent', trace.responseTraceparent);
      context.header('x-attestor-trace-id', trace.traceId);
      context.header('x-attestor-span-id', trace.spanId);
      context.header('x-attestor-instance-id', deps.serviceInstanceId);
    }
  };
}
