import type { ReleaseActorReference } from '../release-layer/index.js';
import type { EnforcementBreakGlassGrant, EnforcementRequest, VerificationResult } from './object-model.js';
import type { EnforcementCacheState, EnforcementFailureReason } from './types.js';
import {
  resolveVerificationProfile,
  type VerificationProfile,
} from './verification-profiles.js';
import {
  CACHE_ONLY_ACCEPTED_CACHE_STATES,
  RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION,
  type DegradedModeDecision,
  type DegradedModeDecisionStatus,
  type DegradedModeGrant,
  type DegradedModeGrantStatus,
  type DegradedModeScope,
  type EvaluateDegradedModeInput,
} from './degraded-mode-types.js';
import {
  degradedModeGrantStatus,
  degradedModeScopeFromRequest,
  degradedModeScopeMatches,
} from './degraded-mode-grant.js';
import {
  normalizeFailureReasons,
  normalizeIsoTimestamp,
  normalizeScope,
  uniqueFailureReasons,
} from './degraded-mode-utils.js';

function actorIdentity(actor: ReleaseActorReference): string {
  return `${actor.type}:${actor.id}`;
}

function distinctApproverIdentities(
  grant: DegradedModeGrant,
): ReadonlySet<string> {
  const authorizer = actorIdentity(grant.authorizedBy);
  return new Set(
    grant.approvedBy
      .map(actorIdentity)
      .filter((identity) => identity !== authorizer),
  );
}

function scopeCanResolveVerificationProfile(scope: DegradedModeScope): scope is DegradedModeScope & {
  readonly boundaryKind: NonNullable<DegradedModeScope['boundaryKind']>;
  readonly consequenceType: NonNullable<DegradedModeScope['consequenceType']>;
  readonly riskClass: NonNullable<DegradedModeScope['riskClass']>;
} {
  return (
    scope.boundaryKind !== null &&
    scope.boundaryKind !== undefined &&
    scope.consequenceType !== null &&
    scope.consequenceType !== undefined &&
    scope.riskClass !== null &&
    scope.riskClass !== undefined
  );
}

function profileMatchesScope(profile: VerificationProfile, scope: DegradedModeScope): boolean {
  return (
    (scope.boundaryKind === null ||
      scope.boundaryKind === undefined ||
      profile.boundaryKind === scope.boundaryKind) &&
    (scope.consequenceType === null ||
      scope.consequenceType === undefined ||
      profile.consequenceType === scope.consequenceType) &&
    (scope.riskClass === null ||
      scope.riskClass === undefined ||
      profile.riskClass === scope.riskClass)
  );
}

function resolveDegradedModeProfile(input: {
  readonly profile?: VerificationProfile | null;
  readonly request?: EnforcementRequest | null;
  readonly scope: DegradedModeScope;
}): VerificationProfile | null {
  const requestProfile = input.request
    ? resolveVerificationProfile({
        consequenceType: input.request.enforcementPoint.consequenceType,
        riskClass: input.request.enforcementPoint.riskClass,
        boundaryKind: input.request.enforcementPoint.boundaryKind,
      })
    : null;
  const selectedProfile = input.profile ?? requestProfile;

  if (selectedProfile) {
    if (
      requestProfile &&
      (selectedProfile.consequenceType !== requestProfile.consequenceType ||
        selectedProfile.riskClass !== requestProfile.riskClass ||
        selectedProfile.boundaryKind !== requestProfile.boundaryKind)
    ) {
      throw new Error(
        'Release enforcement-plane degraded mode profile must match the enforcement request boundary, consequence type, and risk class.',
      );
    }
    if (!profileMatchesScope(selectedProfile, input.scope)) {
      throw new Error(
        'Release enforcement-plane degraded mode profile must match the evaluated scope.',
      );
    }
    return selectedProfile;
  }

  return scopeCanResolveVerificationProfile(input.scope)
    ? resolveVerificationProfile({
        consequenceType: input.scope.consequenceType,
        riskClass: input.scope.riskClass,
        boundaryKind: input.scope.boundaryKind,
      })
    : null;
}

export function degradedModeGrantView(grant: DegradedModeGrant): Record<string, unknown> {
  return Object.freeze({
    version: grant.version,
    id: grant.id,
    state: grant.state,
    reason: grant.reason,
    scope: grant.scope,
    authorizedBy: grant.authorizedBy,
    approvedBy: grant.approvedBy,
    authorizedAt: grant.authorizedAt,
    startsAt: grant.startsAt,
    expiresAt: grant.expiresAt,
    ticketId: grant.ticketId,
    rationale: grant.rationale,
    allowedFailureReasons: grant.allowedFailureReasons,
    maxUses: grant.maxUses,
    remainingUses: grant.remainingUses,
    status: degradedModeGrantStatus(grant, new Date().toISOString()),
    auditDigest: grant.auditDigest,
    revokedAt: grant.revokedAt,
    revokedBy: grant.revokedBy,
    revocationReason: grant.revocationReason,
  });
}

export function grantToBreakGlassGrant(grant: DegradedModeGrant): EnforcementBreakGlassGrant {
  return Object.freeze({
    reason: grant.reason,
    authorizedBy: grant.authorizedBy,
    authorizedAt: grant.authorizedAt,
    expiresAt: grant.expiresAt,
    ticketId: grant.ticketId,
    rationale: grant.rationale,
  });
}

function cacheStateAllowsDegradedMode(verification: VerificationResult | null | undefined): boolean {
  if (!verification) {
    return false;
  }
  if (verification.status === 'invalid') {
    return false;
  }
  return (CACHE_ONLY_ACCEPTED_CACHE_STATES as readonly EnforcementCacheState[]).includes(
    verification.cacheState,
  );
}

function allFailuresAllowed(
  failures: readonly EnforcementFailureReason[],
  allowed: readonly EnforcementFailureReason[],
): boolean {
  const allowedSet = new Set(allowed);
  return failures.length > 0 && failures.every((reason) => allowedSet.has(reason));
}

function emptyDecision(input: EvaluateDegradedModeInput): DegradedModeDecision {
  return Object.freeze({
    version: RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION,
    checkedAt: normalizeIsoTimestamp(input.checkedAt, 'checkedAt'),
    status: 'normal',
    degradedState: 'normal',
    outcome: 'allow',
    failureReasons: Object.freeze([]),
    grant: null,
    breakGlass: null,
    grantStatus: null,
    auditRecord: null,
  });
}

function failClosedDecision(input: {
  readonly checkedAt: string;
  readonly status: DegradedModeDecisionStatus;
  readonly failures: readonly EnforcementFailureReason[];
  readonly grant: DegradedModeGrant | null;
  readonly grantStatus: DegradedModeGrantStatus | null;
}): DegradedModeDecision {
  return Object.freeze({
    version: RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION,
    checkedAt: normalizeIsoTimestamp(input.checkedAt, 'checkedAt'),
    status: input.status,
    degradedState: 'fail-closed',
    outcome: 'deny',
    failureReasons: uniqueFailureReasons([...input.failures, 'break-glass-required']),
    grant: input.grant,
    breakGlass: null,
    grantStatus: input.grantStatus,
    auditRecord: null,
  });
}

export function evaluateDegradedMode(input: EvaluateDegradedModeInput): DegradedModeDecision {
  const checkedAt = normalizeIsoTimestamp(input.checkedAt, 'checkedAt');
  if (!input.verification) {
    const grant = input.grant ?? null;
    return failClosedDecision({
      checkedAt,
      status: 'fail-closed',
      failures: ['missing-release-authorization'],
      grant,
      grantStatus: grant ? degradedModeGrantStatus(grant, checkedAt) : null,
    });
  }

  const explicitFailures = input.failureReasons ?? input.verification.failureReasons ?? [];
  const failures = normalizeFailureReasons(
    explicitFailures.length > 0 || input.verification.status === 'valid'
      ? explicitFailures
      : ['fresh-introspection-required'],
    'failureReasons',
    true,
  );

  if (failures.length === 0 && input.verification.status === 'valid') {
    return emptyDecision({ ...input, checkedAt });
  }

  const grant = input.grant ?? null;
  if (!grant) {
    return failClosedDecision({
      checkedAt,
      status: 'break-glass-required',
      failures,
      grant: null,
      grantStatus: null,
    });
  }

  const grantStatus = degradedModeGrantStatus(grant, checkedAt);
  const requestScope = normalizeScope(input.scope ?? (input.request ? degradedModeScopeFromRequest(input.request) : null));
  const profile = resolveDegradedModeProfile({
    profile: input.profile,
    request: input.request,
    scope: requestScope,
  });
  if (
    grantStatus !== 'active' ||
    !degradedModeScopeMatches(grant.scope, requestScope) ||
    !allFailuresAllowed(failures, grant.allowedFailureReasons)
  ) {
    return failClosedDecision({
      checkedAt,
      status: 'fail-closed',
      failures,
      grant,
      grantStatus,
    });
  }

  if (grant.state === 'cache-only') {
    if (profile?.cacheBudget.requireFreshOnlineCheck) {
      return failClosedDecision({
        checkedAt,
        status: 'fail-closed',
        failures: uniqueFailureReasons([...failures, 'fresh-introspection-required']),
        grant,
        grantStatus,
      });
    }
    if (!cacheStateAllowsDegradedMode(input.verification)) {
      return failClosedDecision({
        checkedAt,
        status: 'fail-closed',
        failures,
        grant,
        grantStatus,
      });
    }
    return Object.freeze({
      version: RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION,
      checkedAt,
      status: 'cache-only-allow',
      degradedState: 'cache-only',
      outcome: 'allow',
      failureReasons: failures,
      grant,
      breakGlass: null,
      grantStatus,
      auditRecord: null,
    });
  }

  if (profile?.overridePosture === 'not-allowed') {
    return failClosedDecision({
      checkedAt,
      status: 'fail-closed',
      failures: uniqueFailureReasons([...failures, 'binding-mismatch']),
      grant,
      grantStatus,
    });
  }

  if (
    profile?.overridePosture === 'dual-break-glass' &&
    distinctApproverIdentities(grant).size < 2
  ) {
    return failClosedDecision({
      checkedAt,
      status: 'fail-closed',
      failures: uniqueFailureReasons([...failures, 'binding-mismatch']),
      grant,
      grantStatus,
    });
  }

  return Object.freeze({
    version: RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION,
    checkedAt,
    status: 'break-glass-allow',
    degradedState: 'break-glass-open',
    outcome: 'break-glass-allow',
    failureReasons: failures,
    grant,
    breakGlass: grantToBreakGlassGrant(grant),
    grantStatus,
    auditRecord: null,
  });
}
