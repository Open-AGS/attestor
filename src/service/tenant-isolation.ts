/**
 * Tenant Isolation — Bounded Multi-Tenant First Slice
 *
 * Provides request-level tenant identification and isolation
 * via Bearer auth using tenant API keys or hosted account sessions.
 *
 * ARCHITECTURE:
 * - Each request carries either a tenant API key or a hosted account session
 * - Middleware resolves tenant identity from verified control-plane state
 * - All logging/artifacts include tenantId for audit trail
 * - No shared state between tenants
 *
 * BOUNDARY:
 * - API-key/session-based tenant identification (not database isolation)
 * - API key lookup can come from env or local file-backed operator store
 * - Plan/quota metadata can ride with API keys for hosted enforcement
 * - No full multi-node customer identity fabric yet; hosted tenant truth can be shared via the control-plane PostgreSQL first slice
 * - Request routing remains distinct from optional database-level RLS
 * - This is the first request-routing slice
 */

import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import {
  findAccountSessionByTokenState,
  findAccountUserByIdState,
  findHostedAccountByIdState,
  findActiveTenantKeyState,
  findHostedAccountByTenantIdState,
  findTenantRecordByTenantIdState,
  hasTenantKeyRecordsState,
  revokeAccountSessionState,
} from './control-plane-store.js';
import { isProductionLikeRuntimeEnv } from './deployment-safety.js';
import { DEFAULT_HOSTED_PLAN_ID, SELF_HOST_PLAN_ID, resolvePlanSpec } from './plan-catalog.js';
import type { AccountUserRole } from './account-user-store.js';
import { hashSecretForLookup } from './secret-derivation.js';

export interface TenantContext {
  tenantId: string;
  tenantName: string | null;
  authenticatedAt: string;
  source: 'api_key' | 'account_session' | 'anonymous';
  planId: string | null;
  monthlyRunQuota: number | null;
}

export interface AccountAccessContext {
  accountId: string;
  accountUserId: string;
  role: AccountUserRole;
  sessionId: string;
  sessionTransport: 'cookie' | 'header';
  source: 'account_session';
}

export const ANONYMOUS_TENANT_ID = '__attestor_anonymous__';
export const LEGACY_ANONYMOUS_TENANT_ID = 'default';
export const TENANT_CONTEXT_VERIFIED_HEADER = 'x-attestor-tenant-context-verified';
export const TENANT_CONTEXT_VERIFIED_VALUE = 'true';
export const ACCOUNT_SESSION_TRANSPORT_HEADER = 'x-attestor-account-session-transport';

/** Tenant registry: maps hashed API keys to tenants. */
export const TENANT_ENV_KEY_CACHE_DEFAULT_TTL_MS = 30_000;
const TENANT_API_KEY_LOOKUP_PURPOSE = 'tenant.api-key';
const TENANT_ENV_KEY_CONFIG_LOOKUP_PURPOSE = 'tenant.env-key-config';

const tenantKeys = new Map<string, {
  tenantId: string;
  tenantName: string;
  planId: string | null;
  monthlyRunQuota: number | null;
}>();
let loadedTenantKeyConfigDigest: string | null = null;
let loadedTenantKeyConfigAtMs: number | null = null;
let loadedTenantKeyConfigExpiresAtMs: number | null = null;
let envTenantKeyCacheDisabledReason: string | null = null;

const TENANT_CONTEXT_HEADER_NAMES = Object.freeze([
  TENANT_CONTEXT_VERIFIED_HEADER,
  'x-attestor-tenant-id',
  'x-attestor-tenant-source',
  'x-attestor-plan-id',
  'x-attestor-monthly-run-quota',
  'x-attestor-account-id',
  'x-attestor-account-user-id',
  'x-attestor-account-role',
  'x-attestor-account-session-id',
  ACCOUNT_SESSION_TRANSPORT_HEADER,
] as const);

function tenantKeyEnvCacheTtlMs(): number {
  const raw = Number.parseInt(process.env.ATTESTOR_TENANT_KEY_ENV_CACHE_TTL_MS ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : TENANT_ENV_KEY_CACHE_DEFAULT_TTL_MS;
}

function tenantApiKeyLookupHash(apiKey: string): string {
  return hashSecretForLookup(apiKey, TENANT_API_KEY_LOOKUP_PURPOSE);
}

function tenantEnvKeyConfigDigest(rawConfig: string): string {
  return rawConfig.length === 0
    ? 'empty'
    : hashSecretForLookup(rawConfig, TENANT_ENV_KEY_CONFIG_LOOKUP_PURPOSE);
}

function envTenantKeysDisabledForRuntime(): string | null {
  return process.env.ATTESTOR_RUNTIME_PROFILE?.trim() === 'production-shared'
    ? 'production-shared runtime requires shared control-plane tenant key state; env tenant keys are per-pod only'
    : null;
}

export function tenantEnvKeyCacheStatus(nowMs = Date.now()): {
  readonly source: 'env';
  readonly keyCount: number;
  readonly lookupMaterial: 'hashed-api-key';
  readonly plaintextKeysStored: false;
  readonly sharedInvalidation: false;
  readonly loadedAt: string | null;
  readonly expiresAt: string | null;
  readonly cacheAgeMs: number | null;
  readonly ttlMs: number;
  readonly disabledReason: string | null;
} {
  return {
    source: 'env',
    keyCount: tenantKeys.size,
    lookupMaterial: 'hashed-api-key',
    plaintextKeysStored: false,
    sharedInvalidation: false,
    loadedAt:
      loadedTenantKeyConfigAtMs === null
        ? null
        : new Date(loadedTenantKeyConfigAtMs).toISOString(),
    expiresAt:
      loadedTenantKeyConfigExpiresAtMs === null
        ? null
        : new Date(loadedTenantKeyConfigExpiresAtMs).toISOString(),
    cacheAgeMs:
      loadedTenantKeyConfigAtMs === null
        ? null
        : Math.max(0, nowMs - loadedTenantKeyConfigAtMs),
    ttlMs: tenantKeyEnvCacheTtlMs(),
    disabledReason: envTenantKeyCacheDisabledReason,
  };
}

export function resetTenantEnvKeyCacheForTests(): void {
  tenantKeys.clear();
  loadedTenantKeyConfigDigest = null;
  loadedTenantKeyConfigAtMs = null;
  loadedTenantKeyConfigExpiresAtMs = null;
  envTenantKeyCacheDisabledReason = null;
}

function normalizeAnonymousTenantId(
  tenantId: string | null,
  source: TenantContext['source'],
): string {
  const normalized = tenantId?.trim() ?? '';
  if (source === 'anonymous') {
    if (!normalized || normalized === LEGACY_ANONYMOUS_TENANT_ID) return ANONYMOUS_TENANT_ID;
  }
  return normalized || ANONYMOUS_TENANT_ID;
}

export function isAnonymousTenantContext(
  tenant: Pick<TenantContext, 'tenantId' | 'source'>,
): boolean {
  return tenant.source === 'anonymous' || tenant.tenantId === ANONYMOUS_TENANT_ID;
}

export function anonymousTenantContext(authenticatedAt = new Date().toISOString()): TenantContext {
  return {
    tenantId: ANONYMOUS_TENANT_ID,
    tenantName: 'anonymous',
    authenticatedAt,
    source: 'anonymous',
    planId: SELF_HOST_PLAN_ID,
    monthlyRunQuota: null,
  };
}

export function clearTenantContextHeaders(headers: Headers): void {
  for (const header of TENANT_CONTEXT_HEADER_NAMES) headers.delete(header);
}

export function markTenantContextVerified(headers: Headers): void {
  headers.set(TENANT_CONTEXT_VERIFIED_HEADER, TENANT_CONTEXT_VERIFIED_VALUE);
}

export function hasVerifiedTenantContext(headers: Headers): boolean {
  return headers.get(TENANT_CONTEXT_VERIFIED_HEADER) === TENANT_CONTEXT_VERIFIED_VALUE;
}

/**
 * Register an API key for a tenant.
 */
export function registerTenantKey(
  apiKey: string,
  tenantId: string,
  tenantName: string,
  planId: string | null = null,
  monthlyRunQuota: number | null = null,
): void {
  const resolvedPlan = resolvePlanSpec({
    planId,
    monthlyRunQuota,
    defaultPlanId: SELF_HOST_PLAN_ID,
    allowCustomPlan: true,
  });
  tenantKeys.set(tenantApiKeyLookupHash(apiKey), {
    tenantId,
    tenantName,
    planId: resolvedPlan.planId,
    monthlyRunQuota: resolvedPlan.monthlyRunQuota,
  });
}

/**
 * Load tenant keys from environment variable.
 * Format: ATTESTOR_TENANT_KEYS=key1:tenant1:name1[:plan][:quota],key2:tenant2:name2[:plan][:quota]
 */
export function loadTenantKeysFromEnv(): void {
  const nowMs = Date.now();
  const raw = process.env.ATTESTOR_TENANT_KEYS?.trim() ?? '';
  const rawConfigDigest = tenantEnvKeyConfigDigest(raw);
  const disabledReason = envTenantKeysDisabledForRuntime();
  if (disabledReason) {
    tenantKeys.clear();
    loadedTenantKeyConfigDigest = rawConfigDigest;
    loadedTenantKeyConfigAtMs = nowMs;
    loadedTenantKeyConfigExpiresAtMs = nowMs + tenantKeyEnvCacheTtlMs();
    envTenantKeyCacheDisabledReason = disabledReason;
    return;
  }
  if (
    rawConfigDigest === loadedTenantKeyConfigDigest &&
    loadedTenantKeyConfigExpiresAtMs !== null &&
    nowMs < loadedTenantKeyConfigExpiresAtMs
  ) {
    return;
  }

  tenantKeys.clear();
  loadedTenantKeyConfigDigest = rawConfigDigest;
  loadedTenantKeyConfigAtMs = nowMs;
  loadedTenantKeyConfigExpiresAtMs = nowMs + tenantKeyEnvCacheTtlMs();
  envTenantKeyCacheDisabledReason = null;
  if (!raw) return;
  for (const entry of raw.split(',')) {
    const [key, id, name, planId, quotaRaw] = entry.trim().split(':');
    const quota = quotaRaw && quotaRaw.trim() !== '' ? Number.parseInt(quotaRaw, 10) : null;
    if (key && id) registerTenantKey(key, id, name ?? id, planId ?? null, Number.isFinite(quota as number) ? quota : null);
  }
}

/**
 * Extract tenant context from a request.
 */
export async function extractTenantContext(authHeader: string | undefined): Promise<TenantContext | null> {
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const tenant = tenantKeys.get(tenantApiKeyLookupHash(token));
  if (tenant) {
    return {
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      authenticatedAt: new Date().toISOString(),
      source: 'api_key',
      planId: tenant.planId,
      monthlyRunQuota: tenant.monthlyRunQuota,
    };
  }

  const fileBackedTenant = await findActiveTenantKeyState(token, { markUsed: true });
  if (fileBackedTenant) {
    return {
      tenantId: fileBackedTenant.tenantId,
      tenantName: fileBackedTenant.tenantName,
      authenticatedAt: new Date().toISOString(),
      source: 'api_key',
      planId: fileBackedTenant.planId,
      monthlyRunQuota: fileBackedTenant.monthlyRunQuota,
    };
  }

  return null;
}

/**
 * Hono middleware for tenant isolation.
 * When tenant keys exist, requests must carry a valid tenant key.
 * Local-dev without tenant keys can use a reserved anonymous tenant sentinel.
 * Production-like runtimes disable that fallback for non-public routes.
 */
export function tenantMiddleware() {
  return async (c: Context, next: Next) => {
    if (
      c.req.path.startsWith('/api/v1/admin/') ||
      c.req.path === '/api/v1/billing/stripe/webhook' ||
      c.req.path === '/api/v1/email/mailgun/webhook' ||
      c.req.path === '/api/v1/email/sendgrid/webhook' ||
      c.req.path === '/api/v1/startup' ||
      c.req.path === '/api/v1/health' ||
      c.req.path === '/api/v1/ready' ||
      c.req.path === '/api/v1/domains' ||
      c.req.path === '/api/v1/connectors' ||
      c.req.path === '/api/v1/metrics'
    ) {
      clearTenantContextHeaders(c.req.raw.headers);
      return next();
    }

    loadTenantKeysFromEnv();
    const isAuthRoute = c.req.path.startsWith('/api/v1/auth/');
    const isPublicInviteAcceptRoute = c.req.path === '/api/v1/account/users/invites/accept';
    const enforced = tenantKeys.size > 0 || await hasTenantKeyRecordsState();
    const session = await resolveAccountSessionContext(c);
    const tenant = session?.tenant ?? await extractTenantContext(c.req.header('authorization'));

    if (!tenant && !isAuthRoute && !isPublicInviteAcceptRoute) {
      if (enforced) {
        return c.json({ error: 'Valid tenant API key required in Authorization header' }, 401);
      }
      if (isProductionLikeRuntimeEnv()) {
        return c.json({
          error:
            'Anonymous tenant fallback is disabled for production-like runtimes. Configure tenant API keys, hosted account sessions, or remove production/public/HA deployment flags.',
        }, 401);
      }
    }

    // Propagate tenant context via internal headers (Hono-safe approach)
    const resolved = tenant ?? anonymousTenantContext();
    clearTenantContextHeaders(c.req.raw.headers);
    c.req.raw.headers.set('x-attestor-tenant-id', resolved.tenantId);
    c.req.raw.headers.set('x-attestor-tenant-source', resolved.source);
    c.req.raw.headers.set('x-attestor-plan-id', resolved.planId ?? SELF_HOST_PLAN_ID);
    if (resolved.monthlyRunQuota !== null) {
      c.req.raw.headers.set('x-attestor-monthly-run-quota', String(resolved.monthlyRunQuota));
    }
    if (session) {
      c.req.raw.headers.set('x-attestor-account-id', session.accountId);
      c.req.raw.headers.set('x-attestor-account-user-id', session.accountUserId);
      c.req.raw.headers.set('x-attestor-account-role', session.role);
      c.req.raw.headers.set('x-attestor-account-session-id', session.sessionId);
      c.req.raw.headers.set(ACCOUNT_SESSION_TRANSPORT_HEADER, session.sessionTransport);
    }
    markTenantContextVerified(c.req.raw.headers);

    if (isAuthRoute || isPublicInviteAcceptRoute) {
      await next();
      return;
    }

    const account = session?.account ?? await findHostedAccountByTenantIdState(resolved.tenantId);
    const isBillingSelfService = c.req.path.startsWith('/api/v1/account/billing/');
    if (account?.status === 'suspended') {
      if (isBillingSelfService) {
        await next();
        return;
      }
      return c.json({
        error: 'Hosted account is suspended. Restore billing or reactivate the account before using tenant APIs.',
        accountId: account.id,
        accountStatus: account.status,
      }, 403);
    }
    if (account?.status === 'archived') {
      return c.json({
        error: 'Hosted account is archived and no longer allowed to use tenant APIs.',
        accountId: account.id,
        accountStatus: account.status,
      }, 403);
    }
    await next();
  };
}

export function getTenantContextFromHeaders(headers: Headers): TenantContext {
  const quotaRaw = headers.get('x-attestor-monthly-run-quota');
  const parsedQuota = quotaRaw ? Number.parseInt(quotaRaw, 10) : NaN;
  const source =
    (headers.get('x-attestor-tenant-source') as TenantContext['source'] | null)
    ?? 'anonymous';
  return {
    tenantId: normalizeAnonymousTenantId(headers.get('x-attestor-tenant-id'), source),
    tenantName: null,
    authenticatedAt: new Date().toISOString(),
    source,
    planId: headers.get('x-attestor-plan-id') ?? SELF_HOST_PLAN_ID,
    monthlyRunQuota: Number.isFinite(parsedQuota) ? parsedQuota : null,
  };
}

export function getAccountAccessContextFromHeaders(headers: Headers): AccountAccessContext | null {
  const source = headers.get('x-attestor-tenant-source');
  if (source !== 'account_session') return null;
  const accountId = headers.get('x-attestor-account-id');
  const accountUserId = headers.get('x-attestor-account-user-id');
  const role = headers.get('x-attestor-account-role') as AccountUserRole | null;
  const sessionId = headers.get('x-attestor-account-session-id');
  const sessionTransport = headers.get(ACCOUNT_SESSION_TRANSPORT_HEADER);
  if (!accountId || !accountUserId || !role || !sessionId) return null;
  if (sessionTransport !== 'cookie' && sessionTransport !== 'header') return null;
  return {
    accountId,
    accountUserId,
    role,
    sessionId,
    sessionTransport,
    source: 'account_session',
  };
}

async function resolveAccountSessionContext(c: Context): Promise<{
  tenant: TenantContext;
  account: Awaited<ReturnType<typeof findHostedAccountByIdState>>;
  accountId: string;
  accountUserId: string;
  role: AccountUserRole;
  sessionId: string;
  sessionTransport: 'cookie' | 'header';
} | null> {
  const cookieSessionToken = getCookie(c, process.env.ATTESTOR_SESSION_COOKIE_NAME?.trim() || 'attestor_session') ?? null;
  const headerSessionToken = c.req.header('x-attestor-session') ?? null;
  const sessionToken = cookieSessionToken ?? headerSessionToken;
  const sessionTransport = cookieSessionToken ? 'cookie' : headerSessionToken ? 'header' : null;
  if (!sessionToken || !sessionTransport) return null;

  const session = await findAccountSessionByTokenState(sessionToken, { touch: true });
  if (!session) return null;

  const user = await findAccountUserByIdState(session.accountUserId);
  const account = await findHostedAccountByIdState(session.accountId);
  const suspendedAtMs = account?.suspendedAt ? Date.parse(account.suspendedAt) : Number.NaN;
  const sessionCreatedAtMs = Date.parse(session.createdAt);
  const passwordUpdatedAtMs = user?.passwordUpdatedAt ? Date.parse(user.passwordUpdatedAt) : Number.NaN;
  const mfaSessionBoundaryAtMs = user?.mfa?.totp?.sessionBoundaryAt ? Date.parse(user.mfa.totp.sessionBoundaryAt) : Number.NaN;
  const sessionPredatesSuspension = account?.status === 'suspended'
    && Number.isFinite(suspendedAtMs)
    && Number.isFinite(sessionCreatedAtMs)
    && sessionCreatedAtMs <= suspendedAtMs;
  const sessionPredatesPasswordChange = Number.isFinite(passwordUpdatedAtMs)
    && Number.isFinite(sessionCreatedAtMs)
    && sessionCreatedAtMs < passwordUpdatedAtMs;
  const sessionPredatesMfaChange = Number.isFinite(mfaSessionBoundaryAtMs)
    && Number.isFinite(sessionCreatedAtMs)
    && sessionCreatedAtMs < mfaSessionBoundaryAtMs;
  if (
    !user
    || user.status !== 'active'
    || !account
    || account.status === 'archived'
    || sessionPredatesSuspension
    || sessionPredatesPasswordChange
    || sessionPredatesMfaChange
  ) {
    await revokeAccountSessionState(session.id);
    return null;
  }

  const tenantRecord = await findTenantRecordByTenantIdState(account.primaryTenantId);
  const resolvedPlan = resolvePlanSpec({
    planId: tenantRecord?.planId ?? account.billing.lastCheckoutPlanId ?? DEFAULT_HOSTED_PLAN_ID,
    monthlyRunQuota: tenantRecord?.monthlyRunQuota ?? null,
    defaultPlanId: DEFAULT_HOSTED_PLAN_ID,
    allowCustomPlan: true,
  });

  return {
    tenant: {
      tenantId: account.primaryTenantId,
      tenantName: tenantRecord?.tenantName ?? account.accountName,
      authenticatedAt: new Date().toISOString(),
      source: 'account_session',
      planId: resolvedPlan.planId,
      monthlyRunQuota: resolvedPlan.monthlyRunQuota,
    },
    account,
    accountId: account.id,
    accountUserId: user.id,
    role: user.role,
    sessionId: session.id,
    sessionTransport,
  };
}
