import type {
  EnforcementDegradedState,
  EnforcementFailureReason,
  ReleaseEnforcementRiskClass,
  ReleasePresentationMode,
} from './types.js';
import { ENFORCEMENT_FAILURE_REASONS, type EnforcementBoundaryKind } from './types.js';
import type { VerificationProfile } from './verification-profiles.js';
import {
  RELEASE_FRESHNESS_RULES_SPEC_VERSION,
  type AuthorizationTimeBoundsEvaluation,
  type AuthorizationTimeBoundsInput,
  type FreshnessDecisionStatus,
  type FreshnessRules,
  type FreshnessRulesDescriptor,
  type IntrospectionCacheEvaluation,
  type IntrospectionCacheEvaluationInput,
  type NonceFreshnessEvaluation,
  type NonceFreshnessEvaluationInput,
  type ReleaseFreshnessEvaluation,
  type ReleaseFreshnessEvaluationInput,
  type ReplayProtectionEvaluation,
  type ReplayProtectionEvaluationInput,
} from './freshness-types.js';

export { RELEASE_FRESHNESS_RULES_SPEC_VERSION } from './freshness-types.js';
export type {
  AuthorizationTimeBoundsEvaluation,
  AuthorizationTimeBoundsInput,
  AuthorizationTimeClaims,
  FreshnessDecisionStatus,
  FreshnessRules,
  FreshnessRulesDescriptor,
  IntrospectionCacheEvaluation,
  IntrospectionCacheEvaluationInput,
  IntrospectionCacheObservation,
  IntrospectionCacheStatus,
  NonceFreshnessEvaluation,
  NonceFreshnessEvaluationInput,
  NonceFreshnessStatus,
  NonceLedgerEntry,
  ReleaseFreshnessEvaluation,
  ReleaseFreshnessEvaluationInput,
  ReplayLedgerEntry,
  ReplayProtectionEvaluation,
  ReplayProtectionEvaluationInput,
  ReplayProtectionStatus,
  ReplaySubjectKind,
} from './freshness-types.js';

/**
 * Freshness, cache, replay, and nonce rules for release enforcement.
 *
 * Step 04 keeps these semantics separate from signature verification so every
 * downstream PEP applies the same liveness and replay posture before it admits
 * an AI output into a real consequence.
 */

interface FreshnessBaseline {
  readonly clockSkewSeconds: number;
  readonly maxTokenAgeSeconds: number;
  readonly replayWindowSeconds: number;
  readonly nonceWindowSeconds: number;
}

export const RISK_FRESHNESS_BASELINES: Record<
  ReleaseEnforcementRiskClass,
  FreshnessBaseline
> = Object.freeze({
  R0: Object.freeze({
    clockSkewSeconds: 120,
    maxTokenAgeSeconds: 86_400,
    replayWindowSeconds: 0,
    nonceWindowSeconds: 0,
  }),
  R1: Object.freeze({
    clockSkewSeconds: 120,
    maxTokenAgeSeconds: 3_600,
    replayWindowSeconds: 300,
    nonceWindowSeconds: 0,
  }),
  R2: Object.freeze({
    clockSkewSeconds: 60,
    maxTokenAgeSeconds: 900,
    replayWindowSeconds: 120,
    nonceWindowSeconds: 120,
  }),
  R3: Object.freeze({
    clockSkewSeconds: 30,
    maxTokenAgeSeconds: 300,
    replayWindowSeconds: 60,
    nonceWindowSeconds: 60,
  }),
  R4: Object.freeze({
    clockSkewSeconds: 15,
    maxTokenAgeSeconds: 120,
    replayWindowSeconds: 30,
    nonceWindowSeconds: 30,
  }),
});

export const BOUNDARY_FRESHNESS_BASELINES: Record<
  EnforcementBoundaryKind,
  FreshnessBaseline
> = Object.freeze({
  'http-request': Object.freeze({
    clockSkewSeconds: 60,
    maxTokenAgeSeconds: 900,
    replayWindowSeconds: 120,
    nonceWindowSeconds: 120,
  }),
  webhook: Object.freeze({
    clockSkewSeconds: 30,
    maxTokenAgeSeconds: 300,
    replayWindowSeconds: 60,
    nonceWindowSeconds: 60,
  }),
  'async-message': Object.freeze({
    clockSkewSeconds: 60,
    maxTokenAgeSeconds: 3_600,
    replayWindowSeconds: 300,
    nonceWindowSeconds: 0,
  }),
  'record-write': Object.freeze({
    clockSkewSeconds: 30,
    maxTokenAgeSeconds: 300,
    replayWindowSeconds: 60,
    nonceWindowSeconds: 60,
  }),
  'communication-send': Object.freeze({
    clockSkewSeconds: 30,
    maxTokenAgeSeconds: 300,
    replayWindowSeconds: 60,
    nonceWindowSeconds: 60,
  }),
  'action-dispatch': Object.freeze({
    clockSkewSeconds: 15,
    maxTokenAgeSeconds: 120,
    replayWindowSeconds: 30,
    nonceWindowSeconds: 30,
  }),
  'proxy-admission': Object.freeze({
    clockSkewSeconds: 15,
    maxTokenAgeSeconds: 120,
    replayWindowSeconds: 30,
    nonceWindowSeconds: 30,
  }),
  'artifact-export': Object.freeze({
    clockSkewSeconds: 120,
    maxTokenAgeSeconds: 86_400,
    replayWindowSeconds: 0,
    nonceWindowSeconds: 0,
  }),
});

const NONCE_CAPABLE_PRESENTATION_MODES = Object.freeze([
  'dpop-bound-token',
  'http-message-signature',
] as const satisfies readonly ReleasePresentationMode[]);

function normalizeIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Release enforcement-plane freshness ${fieldName} cannot be blank.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Release enforcement-plane freshness ${fieldName} must be a valid ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function epochMs(value: string, fieldName: string): number {
  return new Date(normalizeIsoTimestamp(value, fieldName)).getTime();
}

function addSeconds(timestamp: string, seconds: number): string {
  return new Date(epochMs(timestamp, 'timestamp') + seconds * 1000).toISOString();
}

function earliestIso(values: readonly (string | null)[]): string | null {
  const timestamps = values.filter((value): value is string => value !== null);
  if (timestamps.length === 0) {
    return null;
  }
  return new Date(Math.min(...timestamps.map((value) => epochMs(value, 'timestamp')))).toISOString();
}

function uniqueFailureReasons(
  reasons: readonly EnforcementFailureReason[],
): readonly EnforcementFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(ENFORCEMENT_FAILURE_REASONS.filter((reason) => present.has(reason)));
}

function freshnessRulesId(profile: VerificationProfile): string {
  return [
    'freshness-rules',
    profile.consequenceType,
    profile.riskClass,
    profile.boundaryKind,
  ].join(':');
}

function requiredNonceModes(profile: VerificationProfile): readonly ReleasePresentationMode[] {
  if (profile.senderConstraint !== 'required') {
    return Object.freeze([]);
  }

  const allowed = new Set(profile.senderConstrainedPresentationModes);
  return Object.freeze(
    NONCE_CAPABLE_PRESENTATION_MODES.filter((mode) => allowed.has(mode)),
  );
}

export function resolveFreshnessRules(profile: VerificationProfile): FreshnessRules {
  const risk = RISK_FRESHNESS_BASELINES[profile.riskClass];
  const boundary = BOUNDARY_FRESHNESS_BASELINES[profile.boundaryKind];
  const replayProtectionRequired = profile.replayProtectionRequired;
  const nonceModes = requiredNonceModes(profile);
  const nonceWindowSeconds =
    nonceModes.length > 0
      ? Math.min(risk.nonceWindowSeconds, boundary.nonceWindowSeconds)
      : 0;

  return Object.freeze({
    version: RELEASE_FRESHNESS_RULES_SPEC_VERSION,
    id: freshnessRulesId(profile),
    profileId: profile.id,
    riskClass: profile.riskClass,
    boundaryKind: profile.boundaryKind,
    onlineIntrospectionRequired: profile.onlineIntrospectionRequired,
    clockSkewSeconds: Math.min(risk.clockSkewSeconds, boundary.clockSkewSeconds),
    maxTokenAgeSeconds: Math.min(risk.maxTokenAgeSeconds, boundary.maxTokenAgeSeconds),
    positiveCacheTtlSeconds: profile.cacheBudget.positiveTtlSeconds,
    negativeCacheTtlSeconds: profile.cacheBudget.negativeTtlSeconds,
    staleIfErrorSeconds: profile.cacheBudget.staleIfErrorSeconds,
    requireFreshOnlineCheck: profile.cacheBudget.requireFreshOnlineCheck,
    failClosedWhenStale:
      profile.failClosed &&
      (profile.onlineIntrospectionRequired ||
        profile.cacheBudget.requireFreshOnlineCheck ||
        profile.cacheBudget.staleIfErrorSeconds === 0),
    negativeCacheAuthoritative: profile.failClosed,
    replayProtectionRequired,
    replayWindowSeconds: replayProtectionRequired
      ? Math.min(risk.replayWindowSeconds, boundary.replayWindowSeconds)
      : 0,
    nonceWindowSeconds,
    requireNonceForPresentationModes: nonceModes,
  });
}

export function freshnessRulesDescriptor(): FreshnessRulesDescriptor {
  return Object.freeze({
    version: RELEASE_FRESHNESS_RULES_SPEC_VERSION,
    riskBaselines: Object.freeze(Object.keys(RISK_FRESHNESS_BASELINES) as ReleaseEnforcementRiskClass[]),
    boundaryBaselines: Object.freeze(
      Object.keys(BOUNDARY_FRESHNESS_BASELINES) as EnforcementBoundaryKind[],
    ),
  });
}

export function evaluateAuthorizationTimeBounds(
  input: AuthorizationTimeBoundsInput,
): AuthorizationTimeBoundsEvaluation {
  const checkedAt = normalizeIsoTimestamp(input.now, 'now');
  const nowMs = epochMs(checkedAt, 'now');
  const skewMs = input.rules.clockSkewSeconds * 1000;
  const issuedAt = input.issuedAt
    ? normalizeIsoTimestamp(input.issuedAt, 'issuedAt')
    : null;
  const notBefore = input.notBefore
    ? normalizeIsoTimestamp(input.notBefore, 'notBefore')
    : null;
  const expiresAt = input.expiresAt
    ? normalizeIsoTimestamp(input.expiresAt, 'expiresAt')
    : null;
  const failureReasons: EnforcementFailureReason[] = [];
  let maxAgeExpiresAt: string | null = null;

  if (notBefore !== null && nowMs + skewMs < epochMs(notBefore, 'notBefore')) {
    failureReasons.push('not-yet-valid-authorization');
  }

  if (expiresAt !== null && nowMs - skewMs >= epochMs(expiresAt, 'expiresAt')) {
    failureReasons.push('expired-authorization');
  }

  if (issuedAt !== null) {
    const issuedAtMs = epochMs(issuedAt, 'issuedAt');
    if (issuedAtMs - skewMs > nowMs) {
      failureReasons.push('future-issued-at');
    }

    maxAgeExpiresAt = addSeconds(issuedAt, input.rules.maxTokenAgeSeconds);
    if (nowMs - skewMs > epochMs(maxAgeExpiresAt, 'maxAgeExpiresAt')) {
      failureReasons.push('stale-authorization');
    }
  }

  return Object.freeze({
    status: failureReasons.length > 0 ? 'invalid' : 'valid',
    failureReasons: uniqueFailureReasons(failureReasons),
    checkedAt,
    earliestValidAt: notBefore,
    validUntil: earliestIso([expiresAt, maxAgeExpiresAt]),
    maxAgeExpiresAt,
  });
}

export function evaluateIntrospectionCache(
  input: IntrospectionCacheEvaluationInput,
): IntrospectionCacheEvaluation {
  const checkedNow = normalizeIsoTimestamp(input.now, 'now');
  const nowMs = epochMs(checkedNow, 'now');
  const unavailableReason: readonly EnforcementFailureReason[] = input.introspectionError
    ? ['introspection-unavailable']
    : [];

  if (input.cache === null) {
    const failureReasons = input.rules.onlineIntrospectionRequired
      ? uniqueFailureReasons([
          'fresh-introspection-required',
          ...unavailableReason,
        ])
      : Object.freeze([]);

    return Object.freeze({
      status: input.rules.onlineIntrospectionRequired ? 'miss' : 'not-required',
      cacheState: 'miss',
      failureReasons,
      active: null,
      checkedAt: null,
      freshUntil: null,
      staleIfErrorUntil: null,
    });
  }

  const cacheCheckedAt = normalizeIsoTimestamp(input.cache.checkedAt, 'cache.checkedAt');
  const ttlSeconds = input.cache.active
    ? input.rules.positiveCacheTtlSeconds
    : input.rules.negativeCacheTtlSeconds;
  const configuredFreshUntil = addSeconds(cacheCheckedAt, ttlSeconds);
  const explicitCacheExpiresAt = input.cache.cacheExpiresAt
    ? normalizeIsoTimestamp(input.cache.cacheExpiresAt, 'cache.cacheExpiresAt')
    : null;
  const tokenExpiresAt = input.cache.tokenExpiresAt
    ? normalizeIsoTimestamp(input.cache.tokenExpiresAt, 'cache.tokenExpiresAt')
    : null;
  const freshUntil = earliestIso([
    configuredFreshUntil,
    explicitCacheExpiresAt,
    input.cache.active ? tokenExpiresAt : null,
  ]);
  const freshUntilMs = freshUntil ? epochMs(freshUntil, 'freshUntil') : epochMs(configuredFreshUntil, 'freshUntil');
  const staleIfErrorUntil = addSeconds(
    freshUntil ?? configuredFreshUntil,
    input.rules.staleIfErrorSeconds,
  );

  if (!input.cache.active) {
    if (nowMs <= freshUntilMs) {
      return Object.freeze({
        status: 'negative-hit',
        cacheState: 'negative-hit',
        failureReasons: uniqueFailureReasons(['negative-cache-hit']),
        active: false,
        checkedAt: cacheCheckedAt,
        freshUntil,
        staleIfErrorUntil: null,
      });
    }

    return Object.freeze({
      status: 'miss',
      cacheState: 'miss',
      failureReasons: input.rules.onlineIntrospectionRequired
        ? uniqueFailureReasons(['fresh-introspection-required', ...unavailableReason])
        : Object.freeze([]),
      active: false,
      checkedAt: cacheCheckedAt,
      freshUntil,
      staleIfErrorUntil: null,
    });
  }

  if (nowMs <= freshUntilMs) {
    return Object.freeze({
      status: 'fresh',
      cacheState: 'fresh',
      failureReasons: Object.freeze([]),
      active: true,
      checkedAt: cacheCheckedAt,
      freshUntil,
      staleIfErrorUntil,
    });
  }

  const staleIfErrorUntilMs = epochMs(staleIfErrorUntil, 'staleIfErrorUntil');
  if (
    input.introspectionError === true &&
    input.rules.staleIfErrorSeconds > 0 &&
    !input.rules.requireFreshOnlineCheck &&
    nowMs <= staleIfErrorUntilMs
  ) {
    return Object.freeze({
      status: 'stale-allowed',
      cacheState: 'stale-allowed',
      failureReasons: Object.freeze([]),
      active: true,
      checkedAt: cacheCheckedAt,
      freshUntil,
      staleIfErrorUntil,
    });
  }

  return Object.freeze({
    status: 'stale-denied',
    cacheState: 'stale-denied',
    failureReasons: uniqueFailureReasons([
      'stale-authorization',
      ...(input.rules.onlineIntrospectionRequired ? ['fresh-introspection-required' as const] : []),
      ...unavailableReason,
    ]),
    active: true,
    checkedAt: cacheCheckedAt,
    freshUntil,
    staleIfErrorUntil,
  });
}

export function evaluateReplayProtection(
  input: ReplayProtectionEvaluationInput,
): ReplayProtectionEvaluation {
  const checkedAt = normalizeIsoTimestamp(input.now, 'now');
  const replayKey = normalizeIdentifier(input.replayKey, 'replayKey');
  const subjectKind = input.subjectKind ?? null;

  if (!input.rules.replayProtectionRequired) {
    return Object.freeze({
      status: 'not-required',
      failureReasons: Object.freeze([]),
      replayKey,
      subjectKind,
      storeUntil: null,
    });
  }

  if (replayKey === null) {
    return Object.freeze({
      status: 'missing-key',
      failureReasons: uniqueFailureReasons(['missing-replay-proof']),
      replayKey: null,
      subjectKind,
      storeUntil: null,
    });
  }

  if (input.ledgerEntry && input.ledgerEntry.key === replayKey) {
    const ledgerExpiresAt = normalizeIsoTimestamp(
      input.ledgerEntry.expiresAt,
      'ledgerEntry.expiresAt',
    );
    if (epochMs(checkedAt, 'now') <= epochMs(ledgerExpiresAt, 'ledgerEntry.expiresAt')) {
      return Object.freeze({
        status: 'replayed',
        failureReasons: uniqueFailureReasons(['replayed-authorization']),
        replayKey,
        subjectKind: input.ledgerEntry.subjectKind,
        storeUntil: null,
      });
    }
  }

  return Object.freeze({
    status: 'fresh',
    failureReasons: Object.freeze([]),
    replayKey,
    subjectKind,
    storeUntil: addSeconds(checkedAt, input.rules.replayWindowSeconds),
  });
}

export function evaluateNonceFreshness(
  input: NonceFreshnessEvaluationInput,
): NonceFreshnessEvaluation {
  const checkedAt = normalizeIsoTimestamp(input.now, 'now');
  const nowMs = epochMs(checkedAt, 'now');
  const skewMs = input.rules.clockSkewSeconds * 1000;
  const nonce = normalizeIdentifier(input.nonce, 'nonce');
  const nonceRequired = input.rules.requireNonceForPresentationModes.includes(
    input.presentationMode,
  );

  if (!nonceRequired && nonce === null) {
    return Object.freeze({
      status: 'not-required',
      failureReasons: Object.freeze([]),
      nonce: null,
      consumeOnAllow: false,
      expiresAt: null,
    });
  }

  if (nonceRequired && nonce === null) {
    return Object.freeze({
      status: 'missing',
      failureReasons: uniqueFailureReasons(['missing-nonce']),
      nonce: null,
      consumeOnAllow: false,
      expiresAt: null,
    });
  }

  if (!input.ledgerEntry || input.ledgerEntry.nonce !== nonce) {
    return Object.freeze({
      status: 'invalid',
      failureReasons: uniqueFailureReasons(['invalid-nonce']),
      nonce,
      consumeOnAllow: false,
      expiresAt: null,
    });
  }

  const issuedAt = normalizeIsoTimestamp(input.ledgerEntry.issuedAt, 'nonce.issuedAt');
  const expiresAt = normalizeIsoTimestamp(input.ledgerEntry.expiresAt, 'nonce.expiresAt');

  if (input.ledgerEntry.consumedAt) {
    return Object.freeze({
      status: 'consumed',
      failureReasons: uniqueFailureReasons(['invalid-nonce']),
      nonce,
      consumeOnAllow: false,
      expiresAt,
    });
  }

  if (epochMs(issuedAt, 'nonce.issuedAt') - skewMs > nowMs) {
    return Object.freeze({
      status: 'invalid',
      failureReasons: uniqueFailureReasons(['invalid-nonce']),
      nonce,
      consumeOnAllow: false,
      expiresAt,
    });
  }

  if (nowMs - skewMs > epochMs(expiresAt, 'nonce.expiresAt')) {
    return Object.freeze({
      status: 'expired',
      failureReasons: uniqueFailureReasons(['invalid-nonce']),
      nonce,
      consumeOnAllow: false,
      expiresAt,
    });
  }

  return Object.freeze({
    status: 'valid',
    failureReasons: Object.freeze([]),
    nonce,
    consumeOnAllow: true,
    expiresAt,
  });
}

function deriveFreshnessStatus(
  timeBounds: AuthorizationTimeBoundsEvaluation,
  cache: IntrospectionCacheEvaluation,
  replay: ReplayProtectionEvaluation,
  nonce: NonceFreshnessEvaluation,
): FreshnessDecisionStatus {
  if (
    timeBounds.status === 'invalid' ||
    cache.status === 'negative-hit' ||
    cache.status === 'stale-denied' ||
    replay.status === 'replayed' ||
    replay.status === 'missing-key' ||
    nonce.status === 'missing' ||
    nonce.status === 'invalid' ||
    nonce.status === 'consumed' ||
    nonce.status === 'expired'
  ) {
    return 'invalid';
  }

  if (cache.status === 'miss') {
    return 'indeterminate';
  }

  if (cache.status === 'stale-allowed') {
    return 'stale-allowed';
  }

  return 'fresh';
}

function deriveDegradedState(
  status: FreshnessDecisionStatus,
  rules: FreshnessRules,
  cache: IntrospectionCacheEvaluation,
): EnforcementDegradedState {
  if (status === 'stale-allowed') {
    return 'cache-only';
  }

  if (
    rules.failClosedWhenStale &&
    (cache.status === 'stale-denied' || cache.status === 'miss')
  ) {
    return 'fail-closed';
  }

  return 'normal';
}

export function evaluateReleaseFreshness(
  input: ReleaseFreshnessEvaluationInput,
): ReleaseFreshnessEvaluation {
  const checkedAt = normalizeIsoTimestamp(input.now, 'now');
  const timeBounds = evaluateAuthorizationTimeBounds({
    rules: input.rules,
    now: checkedAt,
    issuedAt: input.issuedAt,
    notBefore: input.notBefore,
    expiresAt: input.expiresAt,
  });
  const introspectionCache = evaluateIntrospectionCache({
    rules: input.rules,
    now: checkedAt,
    cache: input.introspectionCache ?? null,
    introspectionError: input.introspectionError,
  });
  const replay = evaluateReplayProtection({
    rules: input.rules,
    now: checkedAt,
    replayKey: input.replayKey,
    subjectKind: input.replaySubjectKind,
    ledgerEntry: input.replayLedgerEntry,
  });
  const nonce = evaluateNonceFreshness({
    rules: input.rules,
    now: checkedAt,
    presentationMode: input.presentationMode,
    nonce: input.nonce,
    ledgerEntry: input.nonceLedgerEntry,
  });
  const status = deriveFreshnessStatus(timeBounds, introspectionCache, replay, nonce);

  return Object.freeze({
    version: RELEASE_FRESHNESS_RULES_SPEC_VERSION,
    status,
    checkedAt,
    cacheState: introspectionCache.cacheState,
    degradedState: deriveDegradedState(status, input.rules, introspectionCache),
    failureReasons: uniqueFailureReasons([
      ...timeBounds.failureReasons,
      ...introspectionCache.failureReasons,
      ...replay.failureReasons,
      ...nonce.failureReasons,
    ]),
    timeBounds,
    introspectionCache,
    replay,
    nonce,
  });
}
