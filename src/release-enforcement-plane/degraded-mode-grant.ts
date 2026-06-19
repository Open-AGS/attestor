import { randomUUID } from 'node:crypto';
import type { EnforcementRequest } from './object-model.js';
import {
  DEFAULT_DEGRADED_MODE_MAX_USES,
  RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION,
  type CreateDegradedModeGrantInput,
  type DegradedModeGrant,
  type DegradedModeGrantStatus,
  type DegradedModeScope,
} from './degraded-mode-types.js';
import {
  assertReason,
  createGrantDigest,
  defaultMaxTtlSeconds,
  normalizeActor,
  normalizeFailureReasons,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizePositiveInteger,
  normalizeScope,
  scopeHasNarrowingField,
} from './degraded-mode-utils.js';

export function createDegradedModeGrantId(): string {
  return `dmg_${randomUUID().replaceAll('-', '')}`;
}

export function createDegradedModeGrant(input: CreateDegradedModeGrantInput): DegradedModeGrant {
  if (input.state !== 'cache-only' && input.state !== 'break-glass-open') {
    throw new Error(
      'Release enforcement-plane degraded mode grant state must be cache-only or break-glass-open.',
    );
  }
  assertReason(input.reason);

  const authorizedAt = normalizeIsoTimestamp(
    input.authorizedAt ?? new Date().toISOString(),
    'authorizedAt',
  );
  const startsAt = normalizeIsoTimestamp(input.startsAt ?? authorizedAt, 'startsAt');
  const maxTtlSeconds = normalizePositiveInteger(
    input.maxTtlSeconds,
    defaultMaxTtlSeconds(input.state),
    'maxTtlSeconds',
  );
  const ttlSeconds =
    input.expiresAt === undefined
      ? normalizePositiveInteger(input.ttlSeconds, maxTtlSeconds, 'ttlSeconds')
      : null;
  const expiresAt = normalizeIsoTimestamp(
    input.expiresAt ??
      new Date(new Date(startsAt).getTime() + (ttlSeconds ?? maxTtlSeconds) * 1000).toISOString(),
    'expiresAt',
  );
  const startsAtMs = new Date(startsAt).getTime();
  const expiresAtMs = new Date(expiresAt).getTime();
  if (expiresAtMs <= startsAtMs) {
    throw new Error('Release enforcement-plane degraded mode grant expiresAt must be after startsAt.');
  }
  if (expiresAtMs - startsAtMs > maxTtlSeconds * 1000) {
    throw new Error(
      `Release enforcement-plane degraded mode grant ttl cannot exceed ${maxTtlSeconds} seconds.`,
    );
  }

  const maxUses = normalizePositiveInteger(
    input.maxUses,
    DEFAULT_DEGRADED_MODE_MAX_USES,
    'maxUses',
  );
  const remainingUses = normalizePositiveInteger(
    input.remainingUses,
    maxUses,
    'remainingUses',
  );
  if (remainingUses > maxUses) {
    throw new Error('Release enforcement-plane degraded mode remainingUses cannot exceed maxUses.');
  }
  const scope = normalizeScope(input.scope);
  if (!scopeHasNarrowingField(scope)) {
    throw new Error(
      'Release enforcement-plane degraded mode grant scope requires at least one non-wildcard field.',
    );
  }

  const withoutDigest: Omit<DegradedModeGrant, 'auditDigest'> = Object.freeze({
    version: RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION,
    id: normalizeIdentifier(input.id ?? createDegradedModeGrantId(), 'id'),
    state: input.state,
    reason: input.reason,
    scope,
    authorizedBy: normalizeActor(input.authorizedBy, 'authorizedBy'),
    approvedBy: Object.freeze((input.approvedBy ?? []).map((actor) => normalizeActor(actor, 'approvedBy'))),
    authorizedAt,
    startsAt,
    expiresAt,
    ticketId: normalizeIdentifier(input.ticketId, 'ticketId'),
    rationale: normalizeIdentifier(input.rationale, 'rationale'),
    allowedFailureReasons: normalizeFailureReasons(input.allowedFailureReasons),
    maxUses,
    remainingUses,
    revokedAt: null,
    revokedBy: null,
    revocationReason: null,
  });

  return Object.freeze({
    ...withoutDigest,
    auditDigest: createGrantDigest(withoutDigest),
  });
}

export function degradedModeGrantStatus(
  grant: DegradedModeGrant,
  checkedAt: string,
): DegradedModeGrantStatus {
  if (grant.revokedAt !== null) {
    return 'revoked';
  }
  if (grant.remainingUses <= 0) {
    return 'exhausted';
  }
  const checkedAtMs = new Date(normalizeIsoTimestamp(checkedAt, 'checkedAt')).getTime();
  const startsAtMs = new Date(grant.startsAt).getTime();
  const expiresAtMs = new Date(grant.expiresAt).getTime();
  if (checkedAtMs < startsAtMs) {
    return 'not-yet-valid';
  }
  if (checkedAtMs >= expiresAtMs) {
    return 'expired';
  }
  return 'active';
}

export function degradedModeScopeFromRequest(request: EnforcementRequest): DegradedModeScope {
  return Object.freeze({
    environment: request.enforcementPoint.environment,
    enforcementPointId: request.enforcementPoint.enforcementPointId,
    pointKind: request.enforcementPoint.pointKind,
    boundaryKind: request.enforcementPoint.boundaryKind,
    tenantId: request.enforcementPoint.tenantId,
    accountId: request.enforcementPoint.accountId,
    workloadId: request.enforcementPoint.workloadId,
    audience: request.enforcementPoint.audience,
    targetId: request.targetId,
    consequenceType: request.enforcementPoint.consequenceType,
    riskClass: request.enforcementPoint.riskClass,
  });
}

function scopeFieldMatches<T>(
  grantValue: T | null | undefined,
  requestValue: T | null | undefined,
): boolean {
  return grantValue === null || grantValue === undefined || grantValue === requestValue;
}

export function degradedModeScopeMatches(
  grantScope: DegradedModeScope,
  requestScope: DegradedModeScope | null | undefined,
): boolean {
  if (!requestScope) {
    return Object.values(grantScope).every((value) => value === null || value === undefined);
  }

  return (
    scopeFieldMatches(grantScope.environment, requestScope.environment) &&
    scopeFieldMatches(grantScope.enforcementPointId, requestScope.enforcementPointId) &&
    scopeFieldMatches(grantScope.pointKind, requestScope.pointKind) &&
    scopeFieldMatches(grantScope.boundaryKind, requestScope.boundaryKind) &&
    scopeFieldMatches(grantScope.tenantId, requestScope.tenantId) &&
    scopeFieldMatches(grantScope.accountId, requestScope.accountId) &&
    scopeFieldMatches(grantScope.workloadId, requestScope.workloadId) &&
    scopeFieldMatches(grantScope.audience, requestScope.audience) &&
    scopeFieldMatches(grantScope.targetId, requestScope.targetId) &&
    scopeFieldMatches(grantScope.consequenceType, requestScope.consequenceType) &&
    scopeFieldMatches(grantScope.riskClass, requestScope.riskClass)
  );
}
