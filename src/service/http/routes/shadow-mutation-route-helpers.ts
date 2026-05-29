import type { Context } from 'hono';
import type { AdminAuditAction } from '../../admin-audit-log.js';
import type {
  PipelineIdempotencyReadyResult,
} from '../../application/pipeline-idempotency-service.js';
import type { TenantContext } from '../../tenant-isolation.js';
import type { ShadowRouteDeps } from './shadow-routes.js';
import { problem } from './shadow-route-helpers.js';

const SHADOW_MUTATION_RATE_LIMIT_DEFAULT = 60;
const SHADOW_MUTATION_RATE_LIMIT_MAX = 600;
const SHADOW_MUTATION_RATE_LIMIT_WINDOW_MS = 60_000;

const shadowMutationAttempts = new Map<string, {
  count: number;
  resetAtMs: number;
}>();

export interface ShadowMutationAuditInput {
  readonly routeId: string;
  readonly action: AdminAuditAction;
  readonly tenant: TenantContext;
  readonly requestPayload: unknown;
  readonly statusCode: number;
  readonly metadata?: Record<string, unknown>;
}

type ShadowMutationIdempotencyBegin =
  | {
      readonly kind: 'ready';
      readonly tenant: TenantContext;
      readonly ready: PipelineIdempotencyReadyResult | null;
    }
  | { readonly kind: 'response'; readonly response: Response };

function configuredShadowMutationRateLimit(): number {
  const raw = process.env.ATTESTOR_SHADOW_MUTATION_RATE_LIMIT_PER_MINUTE?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : SHADOW_MUTATION_RATE_LIMIT_DEFAULT;
  if (!Number.isFinite(parsed) || parsed <= 0) return SHADOW_MUTATION_RATE_LIMIT_DEFAULT;
  return Math.min(parsed, SHADOW_MUTATION_RATE_LIMIT_MAX);
}

function shadowMutationRateLimitResponse(
  c: Context,
  tenant: TenantContext,
  routeId: string,
): Response | null {
  const limit = configuredShadowMutationRateLimit();
  const now = Date.now();
  for (const [key, attempt] of shadowMutationAttempts.entries()) {
    if (attempt.resetAtMs <= now) shadowMutationAttempts.delete(key);
  }

  const key = `${tenant.tenantId}:${routeId}`;
  const current = shadowMutationAttempts.get(key);
  const attempt = current && current.resetAtMs > now
    ? current
    : { count: 0, resetAtMs: now + SHADOW_MUTATION_RATE_LIMIT_WINDOW_MS };
  attempt.count += 1;
  shadowMutationAttempts.set(key, attempt);

  const remaining = Math.max(0, limit - attempt.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((attempt.resetAtMs - now) / 1000));
  c.header('cache-control', 'no-store');
  c.header('x-attestor-rate-limit-limit', String(limit));
  c.header('x-attestor-rate-limit-remaining', String(remaining));
  c.header('x-attestor-rate-limit-reset', new Date(attempt.resetAtMs).toISOString());
  if (attempt.count <= limit) return null;

  c.header('retry-after', String(retryAfterSeconds));
  return problem(c, {
    type: 'https://attestor.dev/problems/shadow-mutation-rate-limit-exceeded',
    title: 'Shadow mutation rate limit exceeded',
    status: 429,
    detail: 'Shadow mutation writes are rate limited per tenant and route.',
    reasonCodes: ['shadow-mutation-rate-limit-exceeded'],
  });
}

function shadowIdempotencyKeyFor(c: Context): string | null {
  const normalized = c.req.header('Idempotency-Key')?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function shadowReplayResponse(input: {
  readonly statusCode: number;
  readonly responseBody: unknown;
  readonly replay: boolean;
}): Response {
  return new Response(JSON.stringify(input.responseBody), {
    status: input.statusCode,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      ...(input.replay ? { 'x-attestor-idempotent-replay': 'true' } : {}),
    },
  });
}

export async function beginShadowMutationIdempotency(
  c: Context,
  deps: ShadowRouteDeps,
  routeId: string,
  requestPayload: unknown,
): Promise<ShadowMutationIdempotencyBegin> {
  const tenant = deps.currentTenant(c);
  const idempotencyKey = shadowIdempotencyKeyFor(c);

  if (idempotencyKey) {
    if (!deps.pipelineIdempotencyService) {
      return {
        kind: 'response',
        response: problem(c, {
          type: 'https://attestor.dev/problems/shadow-mutation-idempotency-unavailable',
          title: 'Shadow mutation idempotency unavailable',
          status: 503,
          detail: 'The shadow mutation route cannot persist idempotent mutation responses in this runtime.',
          reasonCodes: ['shadow-mutation-idempotency-unavailable'],
        }),
      };
    }

    const begin = await deps.pipelineIdempotencyService.begin({
      idempotencyKey,
      tenantId: tenant.tenantId,
      routeId,
      requestPayload,
    });

    if (begin.kind === 'replay') {
      return {
        kind: 'response',
        response: shadowReplayResponse({
          statusCode: begin.statusCode,
          responseBody: begin.responseBody,
          replay: true,
        }),
      };
    }

    if (begin.kind === 'conflict') {
      return {
        kind: 'response',
        response: problem(c, {
          type: 'https://attestor.dev/problems/shadow-mutation-idempotency-conflict',
          title: 'Shadow mutation idempotency conflict',
          status: 409,
          detail: 'The Idempotency-Key was already used for a different shadow mutation request.',
          reasonCodes: ['shadow-mutation-idempotency-conflict'],
        }),
      };
    }

    if (begin.kind === 'unavailable') {
      return {
        kind: 'response',
        response: problem(c, {
          type: 'https://attestor.dev/problems/shadow-mutation-idempotency-unavailable',
          title: 'Shadow mutation idempotency unavailable',
          status: 503,
          detail: 'The shadow mutation route cannot persist idempotent mutation responses in this runtime.',
          reasonCodes: ['shadow-mutation-idempotency-unavailable'],
        }),
      };
    }

    const rateLimited = shadowMutationRateLimitResponse(c, tenant, routeId);
    if (rateLimited) return { kind: 'response', response: rateLimited };
    return { kind: 'ready', tenant, ready: begin };
  }

  const rateLimited = shadowMutationRateLimitResponse(c, tenant, routeId);
  if (rateLimited) return { kind: 'response', response: rateLimited };
  return { kind: 'ready', tenant, ready: null };
}

export async function finalizeShadowMutationIdempotency(
  deps: ShadowRouteDeps,
  tenant: TenantContext,
  routeId: string,
  requestPayload: unknown,
  idempotency: PipelineIdempotencyReadyResult | null,
  statusCode: number,
  responseBody: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!idempotency?.idempotencyKey || !deps.pipelineIdempotencyService) {
    return responseBody;
  }
  return deps.pipelineIdempotencyService.finalize({
    idempotencyKey: idempotency.idempotencyKey,
    tenantId: tenant.tenantId,
    routeId,
    requestPayload,
    statusCode,
    responseBody,
  });
}

export async function recordShadowMutationAudit(
  deps: ShadowRouteDeps,
  input: ShadowMutationAuditInput,
): Promise<void> {
  await deps.recordShadowMutationAudit?.(input);
}

export function resetShadowMutationRateLimiterForTests(): void {
  shadowMutationAttempts.clear();
}
