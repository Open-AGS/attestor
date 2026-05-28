import { timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import type { ReviewerIdentity } from '../financial/types.js';
import {
  createKeylessSignerPair,
  type KeylessSigner,
} from '../signing/keyless-signer.js';
import {
  sessionCookieName,
  sessionCookieSecure,
} from './account/account-session-store.js';
import type { AccountUserRole } from './account/account-user-store.js';
import {
  ACCOUNT_SESSION_TRANSPORT_HEADER,
  anonymousTenantContext,
  getAccountAccessContextFromHeaders,
  getTenantContextFromHeaders,
  hasVerifiedTenantContext,
  isAnonymousTenantContext,
  type AccountAccessContext,
  type TenantContext,
} from './tenant-isolation.js';
import { digestSecretForComparison } from './secret-derivation.js';

export const ACCOUNT_SESSION_CSRF_HEADER = 'x-attestor-csrf';
export const ACCOUNT_SESSION_ALLOWED_ORIGINS_ENV = 'ATTESTOR_ACCOUNT_SESSION_ALLOWED_ORIGINS';

const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CROSS_SITE_FETCH_SITE = 'cross-site';

interface RequestSignerPair {
  signer: KeylessSigner;
  reviewer: KeylessSigner;
}

export function createRequestSigners(
  identitySource: string,
  reviewerName?: string,
): RequestSignerPair {
  return createKeylessSignerPair(
    {
      subject: 'API Runtime Signer',
      source: identitySource === 'oidc_verified' ? 'oidc_verified' : 'ephemeral',
      identifier: 'api-keyless',
    },
    reviewerName
      ? {
          subject: reviewerName,
          source: identitySource === 'oidc_verified' ? 'oidc_verified' : 'operator_asserted',
          identifier: reviewerName,
        }
      : undefined,
  );
}

export function currentTenant(context: Context): TenantContext {
  const headers = context.req.raw.headers;
  return hasVerifiedTenantContext(headers)
    ? getTenantContextFromHeaders(headers)
    : anonymousTenantContext();
}

export function currentAccountAccess(context: Context): AccountAccessContext | null {
  const headers = context.req.raw.headers;
  return hasVerifiedTenantContext(headers)
    ? getAccountAccessContextFromHeaders(headers)
    : null;
}

export function currentAccountRole(context: Context): AccountUserRole | null {
  return currentAccountAccess(context)?.role ?? null;
}

export function currentReleaseRequester(
  context: Context,
  reviewerIdentity?: ReviewerIdentity,
) {
  if (reviewerIdentity) {
    return {
      id: `reviewer:${reviewerIdentity.identifier}`,
      type: 'user' as const,
      displayName: reviewerIdentity.name,
      role: reviewerIdentity.role,
    };
  }

  const tenant = currentTenant(context);
  const anonymousTenant = isAnonymousTenantContext(tenant);
  return {
    id: anonymousTenant ? 'svc.attestor.api' : `tenant:${tenant.tenantId}`,
    type: 'service' as const,
    displayName: anonymousTenant ? 'Attestor API Runtime' : tenant.tenantId,
    role: tenant.planId ?? 'service',
  };
}

export function currentReleaseEvaluationContext(context: Context) {
  const tenant = currentTenant(context);
  const account = currentAccountAccess(context);
  const cohortHeader = context.req.header('x-attestor-release-cohort');
  const cohortId = cohortHeader?.trim() ? cohortHeader.trim() : null;

  return {
    tenantId: isAnonymousTenantContext(tenant) ? null : tenant.tenantId,
    accountId: account?.accountId ?? null,
    planId: tenant.planId ?? null,
    cohortId,
  } as const;
}

export function setSessionCookieForRecord(
  context: Context,
  sessionToken: string,
  expiresAt: string,
): void {
  setCookie(context, sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: sessionCookieSecure(),
    path: '/api/v1',
    expires: new Date(expiresAt),
  });
}

interface OriginSetResult {
  origins: ReadonlySet<string>;
  invalidConfig: boolean;
}

function normalizeHeaderOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value || value === 'null') return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function addExactOrigin(origins: Set<string>, raw: string | undefined): boolean {
  const value = raw?.trim();
  if (!value) return true;
  if (value === '*' || value.includes('*')) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  if ((parsed.pathname && parsed.pathname !== '/') || parsed.search || parsed.hash) {
    return false;
  }
  origins.add(parsed.origin);
  return true;
}

function addHttpsOriginFromHostname(origins: Set<string>, raw: string | undefined): boolean {
  const value = raw?.trim();
  if (!value) return true;
  if (value === '*' || value.includes('*') || value.includes('/') || value.includes('\\')) {
    return false;
  }
  return addExactOrigin(origins, `https://${value}`);
}

export function accountSessionAllowedOrigins(
  requestUrl: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): OriginSetResult {
  const origins = new Set<string>();
  let invalidConfig = false;
  try {
    origins.add(new URL(requestUrl).origin);
  } catch {
    invalidConfig = true;
  }
  invalidConfig = !addExactOrigin(origins, env.ATTESTOR_PUBLIC_BASE_URL) || invalidConfig;
  invalidConfig = !addHttpsOriginFromHostname(origins, env.ATTESTOR_PUBLIC_HOSTNAME) || invalidConfig;
  for (const origin of (env[ACCOUNT_SESSION_ALLOWED_ORIGINS_ENV] ?? '').split(',')) {
    if (!addExactOrigin(origins, origin)) invalidConfig = true;
  }
  return { origins, invalidConfig };
}

function accountSessionBrowserBoundaryResponse(context: Context): Response | null {
  const fetchSite = context.req.header('sec-fetch-site')?.trim().toLowerCase();
  if (fetchSite === CROSS_SITE_FETCH_SITE) {
    return context.json(
      {
        error: 'Cross-site browser request rejected for cookie-authenticated account mutation.',
        requiredHeader: ACCOUNT_SESSION_CSRF_HEADER,
        sessionTransportHeader: ACCOUNT_SESSION_TRANSPORT_HEADER,
        reasonCodes: ['account-session-cross-site-request'],
      },
      403,
    );
  }

  const rawOrigin = context.req.header('origin');
  const origin = normalizeHeaderOrigin(rawOrigin);
  if (rawOrigin?.trim() && !origin) {
    return context.json(
      {
        error: 'Origin not allowed for cookie-authenticated account mutation.',
        requiredHeader: ACCOUNT_SESSION_CSRF_HEADER,
        requiredOriginPolicy: 'same-origin-or-configured-account-session-origin',
        reasonCodes: ['account-session-origin-not-allowed'],
      },
      403,
    );
  }
  if (!origin) return null;

  const allowedOrigins = accountSessionAllowedOrigins(context.req.url);
  if (allowedOrigins.invalidConfig) {
    return context.json(
      {
        error: 'Account-session browser origin allowlist is invalid.',
        requiredEnv: ACCOUNT_SESSION_ALLOWED_ORIGINS_ENV,
        reasonCodes: ['account-session-origin-config-invalid'],
      },
      500,
    );
  }
  if (!allowedOrigins.origins.has(origin)) {
    return context.json(
      {
        error: 'Origin not allowed for cookie-authenticated account mutation.',
        requiredHeader: ACCOUNT_SESSION_CSRF_HEADER,
        requiredOriginPolicy: 'same-origin-or-configured-account-session-origin',
        reasonCodes: ['account-session-origin-not-allowed'],
      },
      403,
    );
  }
  return null;
}

export function requireAccountSession(
  context: Context,
  options?: {
    roles?: AccountUserRole[];
    allowApiKey?: boolean;
  },
): Response | null {
  const access = currentAccountAccess(context);
  if (!access) {
    if (options?.allowApiKey && currentTenant(context).source === 'api_key') return null;
    return context.json({ error: 'Account session required.' }, 401);
  }
  const method = context.req.method.toUpperCase();
  if (
    !SAFE_HTTP_METHODS.has(method)
    && access.sessionTransport === 'cookie'
  ) {
    const browserBoundary = accountSessionBrowserBoundaryResponse(context);
    if (browserBoundary) return browserBoundary;
    if (!context.req.header(ACCOUNT_SESSION_CSRF_HEADER)?.trim()) {
      return context.json(
        {
          error:
            'CSRF confirmation header required for cookie-authenticated account mutations.',
          requiredHeader: ACCOUNT_SESSION_CSRF_HEADER,
          sessionTransportHeader: ACCOUNT_SESSION_TRANSPORT_HEADER,
          reasonCodes: ['account-session-csrf-required'],
        },
        403,
      );
    }
  }
  if (options?.roles && !options.roles.includes(access.role)) {
    return context.json(
      {
        error: `Account role '${access.role}' is not allowed to perform this action.`,
        requiredRoles: options.roles,
      },
      403,
    );
  }
  return null;
}

export function constantTimeSecretEquals(candidate: string, configured: string): boolean {
  if (!candidate || !configured) return false;
  const candidateDigest = digestSecretForComparison(candidate, 'request.bearer-token.compare');
  const configuredDigest = digestSecretForComparison(configured, 'request.bearer-token.compare');
  return timingSafeEqual(candidateDigest, configuredDigest);
}

export const ADMIN_OPERATOR_ROLE_KEY_ENVS = Object.freeze({
  'admin-superuser': 'ATTESTOR_ADMIN_API_KEY',
  'admin-read': 'ATTESTOR_ADMIN_READ_API_KEY',
  'admin-audit': 'ATTESTOR_ADMIN_AUDIT_API_KEY',
  'admin-account-admin': 'ATTESTOR_ADMIN_ACCOUNT_API_KEY',
  'admin-key-admin': 'ATTESTOR_ADMIN_TENANT_KEY_API_KEY',
  'admin-billing-admin': 'ATTESTOR_ADMIN_BILLING_API_KEY',
  'admin-ops-admin': 'ATTESTOR_ADMIN_OPERATIONS_API_KEY',
  'admin-release-admin': 'ATTESTOR_ADMIN_RELEASE_API_KEY',
  'admin-break-glass': 'ATTESTOR_ADMIN_BREAK_GLASS_API_KEY',
});

export type AdminOperatorRole = keyof typeof ADMIN_OPERATOR_ROLE_KEY_ENVS;

export function adminBearerTokenFromContext(context: Context): string {
  const authHeader = context.req.header('authorization') ?? '';
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}

export function configuredAdminRoleKeys(): readonly {
  role: AdminOperatorRole;
  envName: string;
  secret: string;
}[] {
  return Object.entries(ADMIN_OPERATOR_ROLE_KEY_ENVS)
    .map(([role, envName]) => ({
      role: role as AdminOperatorRole,
      envName,
      secret: process.env[envName]?.trim() ?? '',
    }))
    .filter((entry) => entry.secret.length > 0);
}

export function currentAdminAuthorized(context: Context): Response | null {
  const configured = configuredAdminRoleKeys();
  if (configured.length === 0) {
    return context.json(
      {
        error:
          'Admin API disabled. Set ATTESTOR_ADMIN_API_KEY or a role-scoped admin API key to enable tenant management endpoints.',
      },
      503,
    );
  }

  const token = adminBearerTokenFromContext(context);
  if (!configured.some((entry) => constantTimeSecretEquals(token, entry.secret))) {
    return context.json({ error: 'Valid admin API key required in Authorization header.' }, 401);
  }

  return null;
}

export function currentMetricsAuthorized(context: Context): Response | null {
  const configured = process.env.ATTESTOR_METRICS_API_KEY?.trim();
  if (configured) {
    const authHeader = context.req.header('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!constantTimeSecretEquals(token, configured)) {
      return context.json(
        { error: 'Valid metrics API key required in Authorization header.' },
        401,
      );
    }
    return null;
  }

  return currentAdminAuthorized(context);
}
