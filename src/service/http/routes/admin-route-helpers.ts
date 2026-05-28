import type { Context } from 'hono';
import type { AdminAuditAction } from '../../admin-audit-log.js';
import type * as BillingEventLedger from '../../billing/billing-event-ledger.js';
import type { HostedBillingEntitlementStatus } from '../../billing/billing-entitlement-store.js';
import type { HostedEmailDeliveryProvider, HostedEmailDeliveryStatus } from '../../email-delivery-event-store.js';
import {
  AdminControlServiceError as AdminControlServiceErrorValue,
  type AdminControlBillingEventInput,
} from '../../application/admin-control-service.js';
import type { AdminMutationReadyResult } from '../../application/admin-mutation-service.js';
import {
  adminBearerTokenFromContext,
  configuredAdminRoleKeys,
  constantTimeSecretEquals,
  type AdminOperatorRole,
} from '../../request-context.js';
import type { ReleaseActorReference } from '../../../release-layer/index.js';
import type { DegradedModeScope } from '../../../release-enforcement-plane/degraded-mode.js';
import type {
  EnforcementBoundaryKind,
  EnforcementBreakGlassReason,
  EnforcementFailureReason,
  EnforcementPointKind,
  ReleaseEnforcementConsequenceType,
  ReleaseEnforcementRiskClass,
} from '../../../release-enforcement-plane/types.js';

type BillingEventProviderFilter = BillingEventLedger.BillingEventProvider | null;
type BillingEventOutcomeFilter = Exclude<BillingEventLedger.BillingEventOutcome, 'pending'> | null;
export type AdminRouteRoleSet = readonly AdminOperatorRole[];

export interface AdminRouteActor {
  actorType: 'admin_api_key' | 'admin_operator';
  actorLabel: string;
  actorRole: AdminOperatorRole;
  releaseActor: ReleaseActorReference;
}

export const ADMIN_SUPERUSER_ROLE: AdminOperatorRole = 'admin-superuser';
export const ADMIN_READ_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-read',
] as const satisfies AdminRouteRoleSet);
export const ADMIN_AUDIT_READ_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-read',
  'admin-audit',
] as const satisfies AdminRouteRoleSet);
export const ADMIN_ACCOUNT_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-account-admin',
] as const satisfies AdminRouteRoleSet);
export const ADMIN_ACCOUNT_READ_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-read',
  'admin-account-admin',
] as const satisfies AdminRouteRoleSet);
export const ADMIN_KEY_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-key-admin',
] as const satisfies AdminRouteRoleSet);
export const ADMIN_KEY_READ_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-read',
  'admin-key-admin',
] as const satisfies AdminRouteRoleSet);
export const ADMIN_BILLING_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-billing-admin',
] as const satisfies AdminRouteRoleSet);
export const ADMIN_BILLING_READ_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-read',
  'admin-billing-admin',
] as const satisfies AdminRouteRoleSet);
export const ADMIN_OPS_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-ops-admin',
] as const satisfies AdminRouteRoleSet);
export const ADMIN_OPS_READ_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-read',
  'admin-ops-admin',
] as const satisfies AdminRouteRoleSet);
export const ADMIN_RELEASE_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-release-admin',
  'admin-break-glass',
] as const satisfies AdminRouteRoleSet);
export const ADMIN_RELEASE_READ_ROLES = Object.freeze([
  ADMIN_SUPERUSER_ROLE,
  'admin-read',
  'admin-release-admin',
  'admin-break-glass',
] as const satisfies AdminRouteRoleSet);

const ADMIN_AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const ADMIN_AUTH_RATE_LIMIT_DEFAULT = 240;
const ADMIN_AUTH_RATE_LIMIT_MAX = 10_000;
const adminAuthAttempts = new Map<string, {
  count: number;
  resetAt: number;
}>();
const adminRouteActors = new WeakMap<object, AdminRouteActor>();

export function normalizeAdminRole(value: string | undefined | null): AdminOperatorRole | null {
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

function configuredAdminRateLimit(): number {
  const raw = process.env.ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : ADMIN_AUTH_RATE_LIMIT_DEFAULT;
  if (!Number.isFinite(parsed) || parsed <= 0) return ADMIN_AUTH_RATE_LIMIT_DEFAULT;
  return Math.min(parsed, ADMIN_AUTH_RATE_LIMIT_MAX);
}

function adminRateLimitKey(context: Context): string {
  const forwardedFor = context.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const client =
    context.req.header('cf-connecting-ip')?.trim() ||
    context.req.header('x-real-ip')?.trim() ||
    forwardedFor ||
    'unknown-client';
  return `admin-auth:${client}`;
}

function adminAuthRateLimitResponse(context: Context): Response | null {
  const limit = configuredAdminRateLimit();
  const now = Date.now();
  const key = adminRateLimitKey(context);
  for (const [entryKey, entry] of adminAuthAttempts.entries()) {
    if (entry.resetAt <= now) {
      adminAuthAttempts.delete(entryKey);
    }
  }

  const existing = adminAuthAttempts.get(key);
  const entry = existing && existing.resetAt > now
    ? existing
    : {
        count: 0,
        resetAt: now + ADMIN_AUTH_RATE_LIMIT_WINDOW_MS,
      };
  entry.count += 1;
  adminAuthAttempts.set(key, entry);

  if (entry.count <= limit) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  context.header('retry-after', String(retryAfterSeconds));
  context.header('x-attestor-admin-auth-rate-limit-reset-at', new Date(entry.resetAt).toISOString());
  return context.json({
    error: 'Admin authentication rate limit exceeded.',
    retryAfterSeconds,
  }, 429);
}

function matchedAdminCredentialRoles(token: string): readonly AdminOperatorRole[] {
  return configuredAdminRoleKeys()
    .filter((entry) => constantTimeSecretEquals(token, entry.secret))
    .map((entry) => entry.role);
}

function adminRouteActorFromRequest(
  context: Context,
  allowedRoles: AdminRouteRoleSet,
): AdminRouteActor | Response {
  const token = adminBearerTokenFromContext(context);
  const matchedRoles = matchedAdminCredentialRoles(token);
  const explicitRole = normalizeAdminRole(context.req.header('x-attestor-admin-actor-role'));
  const credentialRole = matchedRoles.includes(ADMIN_SUPERUSER_ROLE)
    ? ADMIN_SUPERUSER_ROLE
    : matchedRoles[0] ?? null;
  if (!credentialRole) {
    return context.json({ error: 'Valid admin API key required in Authorization header.' }, 401);
  }

  const requestedRole = explicitRole ?? credentialRole;
  if (explicitRole && credentialRole !== ADMIN_SUPERUSER_ROLE && explicitRole !== credentialRole) {
    return context.json({
      error: 'Admin actor role does not match the role-scoped admin API key.',
      credentialRole,
      requestedRole: explicitRole,
    }, 403);
  }

  if (!allowedRoles.includes(requestedRole)) {
    return context.json({
      error: `Admin actor role '${requestedRole}' is not allowed for this route.`,
      allowedRoles,
    }, 403);
  }

  const actorId = context.req.header('x-attestor-admin-actor-id')?.trim() || requestedRole;
  const actorName = context.req.header('x-attestor-admin-actor-name')?.trim() || actorId;
  return {
    actorType: actorId === 'admin-superuser' && requestedRole === ADMIN_SUPERUSER_ROLE
      ? 'admin_api_key'
      : 'admin_operator',
    actorLabel: actorId,
    actorRole: requestedRole,
    releaseActor: {
      id: actorId,
      type: actorId === 'admin-superuser' ? 'service' : 'user',
      displayName: actorName,
      role: requestedRole,
    },
  };
}

export function authorizeAdminRoute(
  context: Context,
  allowedRoles: AdminRouteRoleSet,
  currentAdminAuthorized: (context: Context) => Response | null,
): AdminRouteActor | Response {
  const rateLimited = adminAuthRateLimitResponse(context);
  if (rateLimited) return rateLimited;

  const unauthorized = currentAdminAuthorized(context);
  if (unauthorized) return unauthorized;

  const actor = adminRouteActorFromRequest(context, allowedRoles);
  if (actor instanceof Response) return actor;
  adminRouteActors.set(context, actor);
  return actor;
}

export function adminActorForMutation(context: Context): AdminRouteActor {
  const actor = adminRouteActors.get(context);
  if (!actor) {
    return {
      actorType: 'admin_api_key',
      actorLabel: 'ATTESTOR_ADMIN_API_KEY',
      actorRole: ADMIN_SUPERUSER_ROLE,
      releaseActor: {
        id: 'admin-superuser',
        type: 'service',
        displayName: 'Admin API Key',
        role: ADMIN_SUPERUSER_ROLE,
      },
    };
  }
  return actor;
}

export function resetAdminRouteAuthLimiterForTests(): void {
  adminAuthAttempts.clear();
}

export function adminDegradedModeActor(value: unknown): ReleaseActorReference {
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    const id = typeof candidate.id === 'string' && candidate.id.trim()
      ? candidate.id.trim()
      : 'admin_api_key';
    const type = candidate.type === 'user' || candidate.type === 'service' || candidate.type === 'system'
      ? candidate.type
      : 'service';
    return {
      id,
      type,
      ...(typeof candidate.displayName === 'string' && candidate.displayName.trim()
        ? { displayName: candidate.displayName.trim() }
        : {}),
      ...(typeof candidate.role === 'string' && candidate.role.trim()
        ? { role: candidate.role.trim() }
        : {}),
    };
  }

  return {
    id: 'admin_api_key',
    type: 'service',
    displayName: 'Admin API Key',
    role: 'release-enforcement-admin',
  };
}

export function adminDegradedModeScope(value: unknown): DegradedModeScope {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const candidate = value as Record<string, unknown>;
  return {
    environment: typeof candidate.environment === 'string' ? candidate.environment : null,
    enforcementPointId:
      typeof candidate.enforcementPointId === 'string' ? candidate.enforcementPointId : null,
    pointKind: typeof candidate.pointKind === 'string'
      ? candidate.pointKind as EnforcementPointKind
      : null,
    boundaryKind: typeof candidate.boundaryKind === 'string'
      ? candidate.boundaryKind as EnforcementBoundaryKind
      : null,
    tenantId: typeof candidate.tenantId === 'string' ? candidate.tenantId : null,
    accountId: typeof candidate.accountId === 'string' ? candidate.accountId : null,
    workloadId: typeof candidate.workloadId === 'string' ? candidate.workloadId : null,
    audience: typeof candidate.audience === 'string' ? candidate.audience : null,
    targetId: typeof candidate.targetId === 'string' ? candidate.targetId : null,
    consequenceType:
      typeof candidate.consequenceType === 'string'
        ? candidate.consequenceType as ReleaseEnforcementConsequenceType
        : null,
    riskClass: typeof candidate.riskClass === 'string'
      ? candidate.riskClass as ReleaseEnforcementRiskClass
      : null,
  };
}

export function adminDegradedModeStringArray<T extends string>(value: unknown): readonly T[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is T => typeof item === 'string');
}

export function adminDegradedModeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function adminDegradedModeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Release enforcement degraded mode request failed.';
}

export function adminRouteErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function adminControlServiceErrorResponse(c: Context, error: unknown): Response | null {
  if (!(error instanceof AdminControlServiceErrorValue)) return null;
  return c.json({ error: error.message }, error.statusCode);
}

export function adminControlBillingEvent(
  mutation: AdminMutationReadyResult,
  routeId: string,
): AdminControlBillingEventInput {
  return {
    idempotencyKey: mutation.idempotencyKey,
    routeId,
    occurredAt: new Date().toISOString(),
  };
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function adminJsonContentType(context: Context): boolean {
  const contentType = context.req.header('content-type')?.toLowerCase() ?? '';
  return contentType
    .split(';')[0]
    ?.trim()
    .match(/^(application\/json|application\/[^/]+\+json)$/u) !== null;
}

export async function parseAdminJsonBody(context: Context): Promise<Record<string, unknown> | Response> {
  if (!adminJsonContentType(context)) {
    return context.json({
      error: 'Admin mutation routes require Content-Type: application/json.',
    }, 415);
  }
  try {
    const body = await context.req.json();
    if (!isJsonRecord(body)) {
      return context.json({ error: 'JSON request body must be an object.' }, 400);
    }
    return body;
  } catch {
    return context.json({ error: 'Valid JSON request body required.' }, 400);
  }
}

export function parseAdminListLimit(
  context: Context,
  options?: {
    defaultLimit?: number;
    maxLimit?: number;
  },
): number | Response {
  const defaultLimit = options?.defaultLimit ?? 100;
  const maxLimit = options?.maxLimit ?? 1000;
  const raw = context.req.query('limit')?.trim();
  if (raw === undefined || raw.length === 0) return defaultLimit;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || `${parsed}` !== raw) {
    return context.json({ error: 'limit must be a positive integer.' }, 400);
  }
  return Math.min(parsed, maxLimit);
}

export function adminAuditActionFilter(value: string | undefined): AdminAuditAction | null {
  switch (value) {
    case 'account.api_key.issued':
    case 'account.api_key.rotated':
    case 'account.api_key.deactivated':
    case 'account.api_key.reactivated':
    case 'account.api_key.revoked':
    case 'account.billing.checkout_started':
    case 'account.billing.portal_started':
    case 'account.mfa.disabled':
    case 'account.mfa.totp_confirmed':
    case 'account.mfa.totp_enrolled':
    case 'account.password.changed':
    case 'account.passkey.deleted':
    case 'account.passkey.registered':
    case 'account.user.created':
    case 'account.user.deactivated':
    case 'account.user.invite_issued':
    case 'account.user.invite_revoked':
    case 'account.user.password_reset_issued':
    case 'account.user.reactivated':
    case 'account.created':
    case 'account.suspended':
    case 'account.reactivated':
    case 'account.archived':
    case 'account.billing.attached':
    case 'async_job.retried':
    case 'billing.stripe.webhook_applied':
    case 'policy_activation.approval_approved':
    case 'policy_activation.approval_rejected':
    case 'policy_activation.approval_requested':
    case 'policy_activation.activated':
    case 'policy_activation.emergency_frozen':
    case 'policy_activation.emergency_rolled_back':
    case 'policy_activation.rolled_back':
    case 'policy_bundle.published':
    case 'policy_pack.upserted':
    case 'release_break_glass.issued':
    case 'release_enforcement.degraded_mode.grant_created':
    case 'release_enforcement.degraded_mode.grant_revoked':
    case 'release_review.approved':
    case 'release_review.rejected':
    case 'release_token.revoked':
    case 'tenant_key.issued':
    case 'tenant_key.rotated':
    case 'tenant_key.deactivated':
    case 'tenant_key.reactivated':
    case 'tenant_key.recovered':
    case 'tenant_key.revoked':
      return value;
    default:
      return null;
  }
}

export function billingEventProviderFilter(value: string | undefined): BillingEventProviderFilter {
  return value === 'stripe' ? value : null;
}

export function billingEventOutcomeFilter(value: string | undefined): BillingEventOutcomeFilter {
  switch (value) {
    case 'applied':
    case 'ignored':
      return value;
    default:
      return null;
  }
}

export function billingEntitlementStatusFilter(value: string | null): HostedBillingEntitlementStatus | null {
  switch (value) {
    case 'provisioned':
    case 'checkout_completed':
    case 'active':
    case 'trialing':
    case 'delinquent':
    case 'suspended':
    case 'archived':
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

export type {
  EnforcementBreakGlassReason,
  EnforcementFailureReason,
};
