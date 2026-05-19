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
} from './account-session-store.js';
import type { AccountUserRole } from './account-user-store.js';
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

const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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
    && !context.req.header(ACCOUNT_SESSION_CSRF_HEADER)?.trim()
  ) {
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

export function currentAdminAuthorized(context: Context): Response | null {
  const configured = process.env.ATTESTOR_ADMIN_API_KEY?.trim();
  if (!configured) {
    return context.json(
      {
        error:
          'Admin API disabled. Set ATTESTOR_ADMIN_API_KEY to enable tenant management endpoints.',
      },
      503,
    );
  }

  const authHeader = context.req.header('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!constantTimeSecretEquals(token, configured)) {
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
