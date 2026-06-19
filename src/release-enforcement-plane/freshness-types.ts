import type {
  EnforcementBoundaryKind,
  EnforcementCacheState,
  EnforcementDegradedState,
  EnforcementFailureReason,
  ReleaseEnforcementRiskClass,
  ReleasePresentationMode,
} from './types.js';

export const RELEASE_FRESHNESS_RULES_SPEC_VERSION =
  'attestor.release-enforcement-freshness-rules.v1';

export type FreshnessDecisionStatus =
  | 'fresh'
  | 'stale-allowed'
  | 'stale-denied'
  | 'indeterminate'
  | 'invalid';

export type IntrospectionCacheStatus =
  | 'not-required'
  | 'fresh'
  | 'stale-allowed'
  | 'stale-denied'
  | 'negative-hit'
  | 'miss';

export type ReplayProtectionStatus =
  | 'not-required'
  | 'fresh'
  | 'replayed'
  | 'missing-key';

export type ReplaySubjectKind =
  | 'release-token'
  | 'dpop-proof'
  | 'http-message-signature'
  | 'signed-json-envelope'
  | 'idempotency-key';

export type NonceFreshnessStatus =
  | 'not-required'
  | 'valid'
  | 'missing'
  | 'invalid'
  | 'consumed'
  | 'expired';

export interface FreshnessRules {
  readonly version: typeof RELEASE_FRESHNESS_RULES_SPEC_VERSION;
  readonly id: string;
  readonly profileId: string;
  readonly riskClass: ReleaseEnforcementRiskClass;
  readonly boundaryKind: EnforcementBoundaryKind;
  readonly onlineIntrospectionRequired: boolean;
  readonly clockSkewSeconds: number;
  readonly maxTokenAgeSeconds: number;
  readonly positiveCacheTtlSeconds: number;
  readonly negativeCacheTtlSeconds: number;
  readonly staleIfErrorSeconds: number;
  readonly requireFreshOnlineCheck: boolean;
  readonly failClosedWhenStale: boolean;
  readonly negativeCacheAuthoritative: boolean;
  readonly replayProtectionRequired: boolean;
  readonly replayWindowSeconds: number;
  readonly nonceWindowSeconds: number;
  readonly requireNonceForPresentationModes: readonly ReleasePresentationMode[];
}

export interface FreshnessRulesDescriptor {
  readonly version: typeof RELEASE_FRESHNESS_RULES_SPEC_VERSION;
  readonly riskBaselines: readonly ReleaseEnforcementRiskClass[];
  readonly boundaryBaselines: readonly EnforcementBoundaryKind[];
}

export interface AuthorizationTimeClaims {
  readonly issuedAt?: string | null;
  readonly notBefore?: string | null;
  readonly expiresAt?: string | null;
}

export interface AuthorizationTimeBoundsInput extends AuthorizationTimeClaims {
  readonly rules: FreshnessRules;
  readonly now: string;
}

export interface AuthorizationTimeBoundsEvaluation {
  readonly status: 'valid' | 'invalid';
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly checkedAt: string;
  readonly earliestValidAt: string | null;
  readonly validUntil: string | null;
  readonly maxAgeExpiresAt: string | null;
}

export interface IntrospectionCacheObservation {
  readonly checkedAt: string;
  readonly active: boolean;
  readonly tokenExpiresAt?: string | null;
  readonly cacheExpiresAt?: string | null;
}

export interface IntrospectionCacheEvaluationInput {
  readonly rules: FreshnessRules;
  readonly now: string;
  readonly cache: IntrospectionCacheObservation | null;
  readonly introspectionError?: boolean;
}

export interface IntrospectionCacheEvaluation {
  readonly status: IntrospectionCacheStatus;
  readonly cacheState: EnforcementCacheState;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly active: boolean | null;
  readonly checkedAt: string | null;
  readonly freshUntil: string | null;
  readonly staleIfErrorUntil: string | null;
}

export interface ReplayLedgerEntry {
  readonly subjectKind: ReplaySubjectKind;
  readonly key: string;
  readonly firstSeenAt: string;
  readonly expiresAt: string;
}

export interface ReplayProtectionEvaluationInput {
  readonly rules: FreshnessRules;
  readonly now: string;
  readonly replayKey?: string | null;
  readonly subjectKind?: ReplaySubjectKind;
  readonly ledgerEntry?: ReplayLedgerEntry | null;
}

export interface ReplayProtectionEvaluation {
  readonly status: ReplayProtectionStatus;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly replayKey: string | null;
  readonly subjectKind: ReplaySubjectKind | null;
  readonly storeUntil: string | null;
}

export interface NonceLedgerEntry {
  readonly nonce: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly consumedAt?: string | null;
}

export interface NonceFreshnessEvaluationInput {
  readonly rules: FreshnessRules;
  readonly now: string;
  readonly presentationMode: ReleasePresentationMode;
  readonly nonce?: string | null;
  readonly ledgerEntry?: NonceLedgerEntry | null;
}

export interface NonceFreshnessEvaluation {
  readonly status: NonceFreshnessStatus;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly nonce: string | null;
  readonly consumeOnAllow: boolean;
  readonly expiresAt: string | null;
}

export interface ReleaseFreshnessEvaluationInput extends AuthorizationTimeClaims {
  readonly rules: FreshnessRules;
  readonly now: string;
  readonly presentationMode: ReleasePresentationMode;
  readonly introspectionCache?: IntrospectionCacheObservation | null;
  readonly introspectionError?: boolean;
  readonly replayKey?: string | null;
  readonly replaySubjectKind?: ReplaySubjectKind;
  readonly replayLedgerEntry?: ReplayLedgerEntry | null;
  readonly nonce?: string | null;
  readonly nonceLedgerEntry?: NonceLedgerEntry | null;
}

export interface ReleaseFreshnessEvaluation {
  readonly version: typeof RELEASE_FRESHNESS_RULES_SPEC_VERSION;
  readonly status: FreshnessDecisionStatus;
  readonly checkedAt: string;
  readonly cacheState: EnforcementCacheState;
  readonly degradedState: EnforcementDegradedState;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly timeBounds: AuthorizationTimeBoundsEvaluation;
  readonly introspectionCache: IntrospectionCacheEvaluation;
  readonly replay: ReplayProtectionEvaluation;
  readonly nonce: NonceFreshnessEvaluation;
}
