import type { Context } from 'hono';
import type { ReleaseReviewerQueueListOptions } from '../../../release-layer/index.js';
import type { ReleaseAdminRouteActor } from '../release-admin-authorization.js';

export function parsePositiveLimit(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function readReviewField(
  body: Record<string, unknown>,
  key: string,
): string | null {
  const value = body[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function actorDisplayName(actor: ReleaseAdminRouteActor['releaseActor']): string {
  return actor.displayName?.trim() || actor.id;
}

export function actorPolicyRole(authorized: ReleaseAdminRouteActor): string {
  return authorized.releaseActor.role?.trim() || authorized.adminRole;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readReviewListOptions(c: Context): ReleaseReviewerQueueListOptions {
  return {
    limit: parsePositiveLimit(c.req.query('limit')) ?? undefined,
    riskClass: (c.req.query('riskClass')?.trim() || undefined) as
      | ReleaseReviewerQueueListOptions['riskClass']
      | undefined,
    consequenceType: (c.req.query('consequenceType')?.trim() || undefined) as
      | ReleaseReviewerQueueListOptions['consequenceType']
      | undefined,
  };
}

export async function parseReviewActionBody(c: Context): Promise<Record<string, unknown>> {
  const contentType = c.req.header('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const parsed = await c.req.json();
    return isRecord(parsed) ? parsed : {};
  }

  const parsed = await c.req.parseBody();
  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
}
