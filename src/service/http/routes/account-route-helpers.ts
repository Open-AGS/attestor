import type { Context } from 'hono';
import { createHash } from 'node:crypto';
import type { AccountUserRole } from '../../account/account-user-store.js';
import type { HostedEmailDeliveryProvider, HostedEmailDeliveryStatus } from '../../email-delivery-event-store.js';
import type { AccountAccessContext } from '../../tenant-isolation.js';
import {
  AccountApiKeyServiceError,
} from '../../application/account-api-key-service.js';
import { AccountAuthServiceError } from '../../application/account-auth-service.js';
import {
  AccountUserManagementServiceError,
} from '../../application/account-user-management-service.js';
import {
  checkAuthAttemptAllowedShared as checkAuthAttemptAllowed,
  recordAuthAttemptUseShared as recordAuthAttemptUse,
  resolveAuthAttemptSource,
  type AuthAttemptDecision,
  type AuthAttemptSubject,
} from '../../account/auth-abuse-guard.js';
import { validateAccountPassword } from '../../account/account-password-policy.js';
import { directRemoteAddressFromContext } from '../../trusted-proxy.js';
import { acceptsJsonRequestBody } from '../route-response-helpers.js';

export function accountRouteErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function accountAuthServiceErrorResponse(context: Context, error: unknown): Response | null {
  if (!(error instanceof AccountAuthServiceError)) return null;
  return context.json({ error: error.message }, error.statusCode);
}

export function accountApiKeyServiceErrorResponse(context: Context, error: unknown): Response | null {
  if (!(error instanceof AccountApiKeyServiceError)) return null;
  return context.json({ error: error.message }, error.statusCode);
}

export function accountUserManagementServiceErrorResponse(context: Context, error: unknown): Response | null {
  if (!(error instanceof AccountUserManagementServiceError)) return null;
  return context.json({ error: error.message }, error.statusCode);
}

export function accountUserRoleFilter(value: unknown): AccountUserRole | null {
  switch (value) {
    case 'account_admin':
    case 'billing_admin':
    case 'read_only':
      return value;
    default:
      return null;
  }
}

export function hostedEmailDeliveryStatusFilter(value: string | undefined): HostedEmailDeliveryStatus | null {
  switch (value) {
    case 'manual_delivered':
    case 'smtp_sent':
    case 'processed':
    case 'delivered':
    case 'deferred':
    case 'bounced':
    case 'dropped':
    case 'failed':
    case 'unknown':
      return value;
    default:
      return null;
  }
}

export function hostedEmailDeliveryProviderFilter(value: string | undefined): HostedEmailDeliveryProvider | null {
  switch (value) {
    case 'manual':
    case 'smtp':
    case 'sendgrid_smtp':
    case 'mailgun_smtp':
      return value;
    default:
      return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readAccountJsonBody(context: Context): Promise<Record<string, unknown> | Response> {
  if (!acceptsJsonRequestBody(context)) {
    return context.json({ error: 'Content-Type must be application/json.' }, 415);
  }
  try {
    const body = await context.req.json<unknown>();
    if (!isRecord(body)) {
      return context.json({ error: 'Request body must be a JSON object.' }, 400);
    }
    return body;
  } catch {
    return context.json({ error: 'Request body must be valid JSON.' }, 400);
  }
}

export type AuthAttemptKind =
  | 'current-password'
  | 'federated-callback'
  | 'invite'
  | 'password-reset'
  | 'password-reset-issue';

export const AUTH_ATTEMPT_KIND = Object.freeze({
  currentPassword: 'current-password',
  federatedCallback: 'federated-callback',
  invite: 'invite',
  passwordReset: 'password-reset',
  passwordResetIssue: 'password-reset-issue',
} satisfies Record<string, AuthAttemptKind>);

export function authAttemptBucket(kind: AuthAttemptKind, ...parts: string[]): string {
  return [kind, ...parts].join(':');
}

export function authAttemptFor(context: Context, email: string): AuthAttemptSubject {
  return {
    email,
    source: resolveAuthAttemptSource(context.req.raw.headers, {
      directRemoteAddress: directRemoteAddressFromContext(context),
    }),
  };
}

export function authAttemptForPasswordReset(context: Context, resetToken: string): AuthAttemptSubject {
  return authAttemptForActionToken(context, AUTH_ATTEMPT_KIND.passwordReset, resetToken);
}

export function authAttemptForCurrentPassword(context: Context, access: AccountAccessContext): AuthAttemptSubject {
  return authAttemptFor(context, authAttemptBucket(
    AUTH_ATTEMPT_KIND.currentPassword,
    access.accountId,
    access.accountUserId,
  ));
}

export function authAttemptForActionToken(
  context: Context,
  purpose: typeof AUTH_ATTEMPT_KIND.invite | typeof AUTH_ATTEMPT_KIND.passwordReset,
  token: string,
): AuthAttemptSubject {
  const normalized = token.trim();
  const tokenBucket = normalized
    ? createHash('sha256').update(normalized).digest('hex').slice(0, 24)
    : 'missing-token';
  return authAttemptFor(context, authAttemptBucket(purpose, tokenBucket));
}

export function accountPasswordErrorResponse(
  context: Context,
  password: string,
  fieldName: string,
  policyContext: Parameters<typeof validateAccountPassword>[2],
): Response | null {
  const result = validateAccountPassword(password, fieldName, policyContext);
  return result.ok
    ? null
    : context.json({ error: result.message ?? `${fieldName} does not meet password policy.` }, 400);
}

export function authRateLimitResponse(context: Context, decision: AuthAttemptDecision): Response {
  context.header('Retry-After', String(decision.retryAfterSeconds));
  context.header('x-attestor-auth-rate-limit-reset-at', decision.resetAt);
  return context.json({
    error: 'Too many authentication attempts. Try again later.',
    retryAfterSeconds: decision.retryAfterSeconds,
    resetAt: decision.resetAt,
  }, 429);
}

export async function maybeRateLimitAuthAttempt(
  context: Context,
  subject: AuthAttemptSubject,
): Promise<Response | null> {
  const decision = await checkAuthAttemptAllowed(subject);
  return decision.allowed ? null : authRateLimitResponse(context, decision);
}

export async function maybeRateLimitFederatedCallback(
  context: Context,
  provider: 'oidc' | 'saml',
): Promise<Response | null> {
  const subject = authAttemptFor(context, authAttemptBucket(AUTH_ATTEMPT_KIND.federatedCallback, provider));
  const limited = await maybeRateLimitAuthAttempt(context, subject);
  if (limited) return limited;
  await recordAuthAttemptUse(subject);
  return null;
}

export async function maybeRateLimitCurrentPasswordAttempt(
  context: Context,
  access: AccountAccessContext,
): Promise<{ subject: AuthAttemptSubject; response: Response | null }> {
  const subject = authAttemptForCurrentPassword(context, access);
  return {
    subject,
    response: await maybeRateLimitAuthAttempt(context, subject),
  };
}
