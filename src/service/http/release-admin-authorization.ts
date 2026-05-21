import { timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import type { ReleaseActorReference } from '../../release-layer/index.js';
import { digestSecretForComparison } from '../secret-derivation.js';
import {
  adminBearerTokenFromContext,
  configuredAdminRoleKeys,
  type AdminOperatorRole,
} from '../request-context.js';

export type ReleaseAdminRouteRoleSet = readonly AdminOperatorRole[];

export interface ReleaseAdminRouteActor {
  adminRole: AdminOperatorRole;
  releaseActor: ReleaseActorReference;
}

const ADMIN_SUPERUSER_ROLE: AdminOperatorRole = 'admin-superuser';

export const RELEASE_ADMIN_READ_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-read',
  'admin-release-admin',
  'admin-break-glass',
] as const satisfies ReleaseAdminRouteRoleSet);

export const RELEASE_ADMIN_MUTATION_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-release-admin',
] as const satisfies ReleaseAdminRouteRoleSet);

export const RELEASE_ADMIN_BREAK_GLASS_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-break-glass',
] as const satisfies ReleaseAdminRouteRoleSet);

const RELEASE_ADMIN_AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const RELEASE_ADMIN_AUTH_RATE_LIMIT_DEFAULT = 240;
const RELEASE_ADMIN_AUTH_RATE_LIMIT_MAX = 10_000;
const releaseAdminAuthAttempts = new Map<string, {
  count: number;
  resetAt: number;
}>();
const releaseAdminRouteActors = new WeakMap<object, ReleaseAdminRouteActor>();
let releaseAdminCredentialDigestCache: {
  snapshot: string;
  entries: readonly {
    role: AdminOperatorRole;
    digest: Buffer;
  }[];
} | null = null;

function normalizeAdminRole(value: string | undefined | null): AdminOperatorRole | null {
  const role = value?.trim() ?? '';
  switch (role) {
    case 'admin-superuser':
    case 'admin-read':
    case 'admin-audit':
    case 'admin-account-admin':
    case 'admin-key-admin':
    case 'admin-billing-admin':
    case 'admin-ops-admin':
    case 'admin-release-admin':
    case 'admin-break-glass':
      return role;
    default:
      return null;
  }
}

function configuredReleaseAdminRateLimit(): number {
  const raw = process.env.ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : RELEASE_ADMIN_AUTH_RATE_LIMIT_DEFAULT;
  if (!Number.isFinite(parsed) || parsed <= 0) return RELEASE_ADMIN_AUTH_RATE_LIMIT_DEFAULT;
  return Math.min(parsed, RELEASE_ADMIN_AUTH_RATE_LIMIT_MAX);
}

function releaseAdminRateLimitKey(context: Context): string {
  const forwardedFor = context.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const client =
    context.req.header('cf-connecting-ip')?.trim() ||
    context.req.header('x-real-ip')?.trim() ||
    forwardedFor ||
    'unknown-client';
  return `release-admin-auth:${client}`;
}

function releaseAdminAuthRateLimitResponse(context: Context): Response | null {
  const limit = configuredReleaseAdminRateLimit();
  const now = Date.now();
  const key = releaseAdminRateLimitKey(context);
  for (const [entryKey, entry] of releaseAdminAuthAttempts.entries()) {
    if (entry.resetAt <= now) {
      releaseAdminAuthAttempts.delete(entryKey);
    }
  }

  const existing = releaseAdminAuthAttempts.get(key);
  const entry = existing && existing.resetAt > now
    ? existing
    : {
        count: 0,
        resetAt: now + RELEASE_ADMIN_AUTH_RATE_LIMIT_WINDOW_MS,
      };
  entry.count += 1;
  releaseAdminAuthAttempts.set(key, entry);

  if (entry.count <= limit) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  context.header('retry-after', String(retryAfterSeconds));
  context.header('x-attestor-admin-auth-rate-limit-reset-at', new Date(entry.resetAt).toISOString());
  return context.json({
    error: 'Admin authentication rate limit exceeded.',
    retryAfterSeconds,
  }, 429);
}

function configuredAdminCredentialDigests(): readonly {
  role: AdminOperatorRole;
  digest: Buffer;
}[] {
  const configured = configuredAdminRoleKeys();
  const snapshot = configured
    .map((entry) => `${entry.role}:${entry.envName}:${entry.secret}`)
    .join('\n');
  if (releaseAdminCredentialDigestCache?.snapshot === snapshot) {
    return releaseAdminCredentialDigestCache.entries;
  }

  const entries = configured.map((entry) => ({
    role: entry.role,
    digest: digestSecretForComparison(entry.secret, 'request.bearer-token.compare'),
  }));
  releaseAdminCredentialDigestCache = { snapshot, entries };
  return entries;
}

function matchedAdminCredentialRole(token: string): {
  configured: boolean;
  role: AdminOperatorRole | null;
} {
  const entries = configuredAdminCredentialDigests();
  if (entries.length === 0) return { configured: false, role: null };
  if (!token) return { configured: true, role: null };

  const tokenDigest = digestSecretForComparison(token, 'request.bearer-token.compare');
  let matchedRole: AdminOperatorRole | null = null;
  for (const entry of entries) {
    if (timingSafeEqual(tokenDigest, entry.digest) && matchedRole === null) {
      matchedRole = entry.role;
    }
  }
  return { configured: true, role: matchedRole };
}

export function authorizeReleaseAdminRoute(
  context: Context,
  allowedRoles: ReleaseAdminRouteRoleSet,
  currentAdminAuthorized: (context: Context) => Response | null,
): ReleaseAdminRouteActor | Response {
  const rateLimited = releaseAdminAuthRateLimitResponse(context);
  if (rateLimited) return rateLimited;

  const token = adminBearerTokenFromContext(context);
  const credentialMatch = matchedAdminCredentialRole(token);
  if (!credentialMatch.configured) {
    const unauthorized = currentAdminAuthorized(context);
    if (unauthorized) return unauthorized;
    return context.json({ error: 'Role-scoped admin API key configuration is required for release routes.' }, 503);
  }

  const explicitAdminRole = normalizeAdminRole(context.req.header('x-attestor-admin-actor-role'));
  const credentialRole = credentialMatch.role;
  if (!credentialRole) {
    return context.json({ error: 'Valid admin API key required in Authorization header.' }, 401);
  }

  const requestedAdminRole = explicitAdminRole ?? credentialRole;
  if (
    explicitAdminRole &&
    credentialRole !== ADMIN_SUPERUSER_ROLE &&
    explicitAdminRole !== credentialRole
  ) {
    return context.json({
      error: 'Admin actor role does not match the role-scoped admin API key.',
      credentialRole,
      requestedRole: explicitAdminRole,
    }, 403);
  }

  if (!allowedRoles.includes(requestedAdminRole)) {
    return context.json({
      error: `Admin actor role '${requestedAdminRole}' is not allowed for this route.`,
      allowedRoles,
    }, 403);
  }

  const actorId = context.req.header('x-attestor-admin-actor-id')?.trim() || requestedAdminRole;
  const actorName = context.req.header('x-attestor-admin-actor-name')?.trim() || actorId;
  const releaseActorRole = context.req.header('x-attestor-admin-actor-role')?.trim() || requestedAdminRole;
  const actor: ReleaseAdminRouteActor = {
    adminRole: requestedAdminRole,
    releaseActor: {
      id: actorId,
      type: actorId === 'admin-superuser' ? 'service' : 'user',
      displayName: actorName,
      role: releaseActorRole,
    },
  };
  releaseAdminRouteActors.set(context, actor);
  return actor;
}

export function releaseAdminActorForContext(context: Context): ReleaseAdminRouteActor {
  const actor = releaseAdminRouteActors.get(context);
  if (actor) return actor;
  return {
    adminRole: ADMIN_SUPERUSER_ROLE,
    releaseActor: {
      id: 'admin-superuser',
      type: 'service',
      displayName: 'Admin API Key',
      role: ADMIN_SUPERUSER_ROLE,
    },
  };
}

export function resetReleaseAdminRouteAuthLimiterForTests(): void {
  releaseAdminAuthAttempts.clear();
  releaseAdminCredentialDigestCache = null;
}
