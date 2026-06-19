import { createHash } from 'node:crypto';
import type { ReleaseActorReference } from '../release-layer/index.js';
import {
  ENFORCEMENT_BOUNDARY_KINDS,
  ENFORCEMENT_BREAK_GLASS_REASONS,
  ENFORCEMENT_FAILURE_REASONS,
  ENFORCEMENT_POINT_KINDS,
  type EnforcementBreakGlassReason,
  type EnforcementFailureReason,
} from './types.js';
import {
  DEFAULT_BREAK_GLASS_MAX_TTL_SECONDS,
  DEFAULT_CACHE_ONLY_MAX_TTL_SECONDS,
  DEFAULT_DEGRADED_MODE_ALLOWED_FAILURE_REASONS,
  type DegradedModeGrant,
  type DegradedModeGrantState,
  type DegradedModeScope,
} from './degraded-mode-types.js';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(',')}}`;
}

export function sha256Digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length === 0) {
    throw new Error(`Release enforcement-plane degraded mode ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(
      `Release enforcement-plane degraded mode ${fieldName} cannot be blank when provided.`,
    );
  }
  return normalized;
}

function normalizeOptionalEnum<T extends readonly string[]>(
  value: T[number] | string | null | undefined,
  allowed: T,
  fieldName: string,
): T[number] | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!allowed.includes(value)) {
    throw new Error(`Release enforcement-plane degraded mode ${fieldName} has unknown value: ${value}`);
  }
  return value;
}

export function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  const timestamp = new Date(normalized).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Release enforcement-plane degraded mode ${fieldName} must be an ISO timestamp.`);
  }
  return new Date(timestamp).toISOString();
}

export function normalizeActor(actor: ReleaseActorReference, fieldName: string): ReleaseActorReference {
  const type = actor.type;
  if (type !== 'user' && type !== 'service' && type !== 'system') {
    throw new Error(
      `Release enforcement-plane degraded mode ${fieldName}.type must be user, service, or system.`,
    );
  }

  return Object.freeze({
    id: normalizeIdentifier(actor.id, `${fieldName}.id`),
    type,
    ...(actor.displayName ? { displayName: actor.displayName.trim() } : {}),
    ...(actor.role ? { role: actor.role.trim() } : {}),
  });
}

export function normalizeScope(scope: DegradedModeScope | null | undefined): DegradedModeScope {
  const normalized = {
    environment: normalizeOptionalIdentifier(scope?.environment, 'scope.environment'),
    enforcementPointId: normalizeOptionalIdentifier(
      scope?.enforcementPointId,
      'scope.enforcementPointId',
    ),
    pointKind: normalizeOptionalEnum(scope?.pointKind, ENFORCEMENT_POINT_KINDS, 'scope.pointKind'),
    boundaryKind: normalizeOptionalEnum(
      scope?.boundaryKind,
      ENFORCEMENT_BOUNDARY_KINDS,
      'scope.boundaryKind',
    ),
    tenantId: normalizeOptionalIdentifier(scope?.tenantId, 'scope.tenantId'),
    accountId: normalizeOptionalIdentifier(scope?.accountId, 'scope.accountId'),
    workloadId: normalizeOptionalIdentifier(scope?.workloadId, 'scope.workloadId'),
    audience: normalizeOptionalIdentifier(scope?.audience, 'scope.audience'),
    targetId: normalizeOptionalIdentifier(scope?.targetId, 'scope.targetId'),
    consequenceType: scope?.consequenceType ?? null,
    riskClass: scope?.riskClass ?? null,
  };

  if (normalized.accountId && !normalized.tenantId) {
    throw new Error(
      'Release enforcement-plane degraded mode account scope also requires tenant scope.',
    );
  }

  return Object.freeze(normalized);
}

export function scopeHasNarrowingField(scope: DegradedModeScope): boolean {
  return Object.values(scope).some((value) => value !== null && value !== undefined);
}

export function normalizeFailureReasons(
  reasons: readonly EnforcementFailureReason[] | null | undefined,
  fieldName = 'allowedFailureReasons',
  allowEmpty = false,
): readonly EnforcementFailureReason[] {
  const selected = reasons ?? DEFAULT_DEGRADED_MODE_ALLOWED_FAILURE_REASONS;
  const unique = new Set<EnforcementFailureReason>();
  for (const reason of selected) {
    if (!(ENFORCEMENT_FAILURE_REASONS as readonly string[]).includes(reason)) {
      throw new Error(`Release enforcement-plane degraded mode ${fieldName} has unknown reason: ${reason}`);
    }
    unique.add(reason);
  }

  if (!allowEmpty && unique.size === 0) {
    throw new Error(`Release enforcement-plane degraded mode ${fieldName} requires at least one reason.`);
  }

  return Object.freeze([...unique]);
}

export function uniqueFailureReasons(
  reasons: readonly EnforcementFailureReason[],
): readonly EnforcementFailureReason[] {
  return Object.freeze([...new Set(reasons)]);
}

export function assertReason(reason: EnforcementBreakGlassReason): void {
  if (!(ENFORCEMENT_BREAK_GLASS_REASONS as readonly string[]).includes(reason)) {
    throw new Error(`Release enforcement-plane degraded mode unknown break-glass reason: ${reason}`);
  }
}

export function defaultMaxTtlSeconds(state: DegradedModeGrantState): number {
  return state === 'cache-only'
    ? DEFAULT_CACHE_ONLY_MAX_TTL_SECONDS
    : DEFAULT_BREAK_GLASS_MAX_TTL_SECONDS;
}

export function normalizePositiveInteger(
  value: number | undefined,
  defaultValue: number,
  fieldName: string,
): number {
  const selected = value ?? defaultValue;
  if (!Number.isInteger(selected) || selected <= 0) {
    throw new Error(`Release enforcement-plane degraded mode ${fieldName} must be a positive integer.`);
  }
  return selected;
}

export function createGrantDigest(input: Omit<DegradedModeGrant, 'auditDigest'>): string {
  return sha256Digest({
    version: input.version,
    id: input.id,
    state: input.state,
    reason: input.reason,
    scope: input.scope,
    authorizedBy: input.authorizedBy,
    approvedBy: input.approvedBy,
    authorizedAt: input.authorizedAt,
    startsAt: input.startsAt,
    expiresAt: input.expiresAt,
    ticketId: input.ticketId,
    rationale: input.rationale,
    allowedFailureReasons: input.allowedFailureReasons,
    maxUses: input.maxUses,
    remainingUses: input.remainingUses,
    revokedAt: input.revokedAt,
    revokedBy: input.revokedBy,
    revocationReason: input.revocationReason,
  });
}
