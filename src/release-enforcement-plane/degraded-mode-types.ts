import type { ReleaseActorReference } from '../release-layer/index.js';
import type {
  EnforcementBreakGlassGrant,
  EnforcementRequest,
  VerificationResult,
} from './object-model.js';
import type {
  EnforcementBoundaryKind,
  EnforcementBreakGlassReason,
  EnforcementCacheState,
  EnforcementDegradedState,
  EnforcementFailureReason,
  EnforcementOutcome,
  EnforcementPointKind,
  ReleaseEnforcementConsequenceType,
  ReleaseEnforcementRiskClass,
} from './types.js';
import type { VerificationProfile } from './verification-profiles.js';

export const RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION =
  'attestor.release-enforcement-degraded-mode.v1';

export const DEFAULT_CACHE_ONLY_MAX_TTL_SECONDS = 10 * 60;
export const DEFAULT_BREAK_GLASS_MAX_TTL_SECONDS = 30 * 60;
export const DEFAULT_DEGRADED_MODE_MAX_USES = 1;

export const DEFAULT_DEGRADED_MODE_ALLOWED_FAILURE_REASONS = Object.freeze([
  'introspection-unavailable',
  'fresh-introspection-required',
] as const satisfies readonly EnforcementFailureReason[]);

export const CACHE_ONLY_ACCEPTED_CACHE_STATES = Object.freeze([
  'fresh',
  'stale-allowed',
] as const satisfies readonly EnforcementCacheState[]);

export type DegradedModeGrantState = Extract<
  EnforcementDegradedState,
  'cache-only' | 'break-glass-open'
>;

export type DegradedModeGrantStatus =
  | 'active'
  | 'not-yet-valid'
  | 'expired'
  | 'revoked'
  | 'exhausted';

export type DegradedModeDecisionStatus =
  | 'normal'
  | 'fail-closed'
  | 'cache-only-allow'
  | 'break-glass-allow'
  | 'break-glass-required';

export type DegradedModeAuditAction =
  | 'grant-created'
  | 'grant-used'
  | 'grant-denied'
  | 'grant-revoked';

export interface DegradedModeScope {
  readonly environment?: string | null;
  readonly enforcementPointId?: string | null;
  readonly pointKind?: EnforcementPointKind | null;
  readonly boundaryKind?: EnforcementBoundaryKind | null;
  readonly tenantId?: string | null;
  readonly accountId?: string | null;
  readonly workloadId?: string | null;
  readonly audience?: string | null;
  readonly targetId?: string | null;
  readonly consequenceType?: ReleaseEnforcementConsequenceType | null;
  readonly riskClass?: ReleaseEnforcementRiskClass | null;
}

export interface CreateDegradedModeGrantInput {
  readonly id?: string;
  readonly state: DegradedModeGrantState;
  readonly reason: EnforcementBreakGlassReason;
  readonly scope?: DegradedModeScope | null;
  readonly authorizedBy: ReleaseActorReference;
  readonly approvedBy?: readonly ReleaseActorReference[];
  readonly authorizedAt?: string;
  readonly startsAt?: string;
  readonly expiresAt?: string;
  readonly ttlSeconds?: number;
  readonly maxTtlSeconds?: number;
  readonly ticketId: string;
  readonly rationale: string;
  readonly allowedFailureReasons?: readonly EnforcementFailureReason[];
  readonly maxUses?: number;
  readonly remainingUses?: number;
}

export interface DegradedModeGrant {
  readonly version: typeof RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION;
  readonly id: string;
  readonly state: DegradedModeGrantState;
  readonly reason: EnforcementBreakGlassReason;
  readonly scope: DegradedModeScope;
  readonly authorizedBy: ReleaseActorReference;
  readonly approvedBy: readonly ReleaseActorReference[];
  readonly authorizedAt: string;
  readonly startsAt: string;
  readonly expiresAt: string;
  readonly ticketId: string;
  readonly rationale: string;
  readonly allowedFailureReasons: readonly EnforcementFailureReason[];
  readonly maxUses: number;
  readonly remainingUses: number;
  readonly auditDigest: string;
  readonly revokedAt: string | null;
  readonly revokedBy: ReleaseActorReference | null;
  readonly revocationReason: string | null;
}

export interface DegradedModeAuditRecord {
  readonly version: typeof RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION;
  readonly id: string;
  readonly action: DegradedModeAuditAction;
  readonly grantId: string;
  readonly recordedAt: string;
  readonly actor: ReleaseActorReference | null;
  readonly state: DegradedModeGrantState;
  readonly scope: DegradedModeScope;
  readonly reason: EnforcementBreakGlassReason;
  readonly ticketId: string;
  readonly expiresAt: string;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly outcome: EnforcementOutcome | null;
  readonly remainingUses: number;
  readonly previousDigest: string | null;
  readonly digest: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface EvaluateDegradedModeInput {
  readonly checkedAt: string;
  readonly grant?: DegradedModeGrant | null;
  readonly request?: EnforcementRequest | null;
  readonly scope?: DegradedModeScope | null;
  readonly verification?: VerificationResult | null;
  readonly failureReasons?: readonly EnforcementFailureReason[];
  readonly profile?: VerificationProfile | null;
}

export interface DegradedModeDecision {
  readonly version: typeof RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION;
  readonly checkedAt: string;
  readonly status: DegradedModeDecisionStatus;
  readonly degradedState: EnforcementDegradedState;
  readonly outcome: EnforcementOutcome;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly grant: DegradedModeGrant | null;
  readonly breakGlass: EnforcementBreakGlassGrant | null;
  readonly grantStatus: DegradedModeGrantStatus | null;
  readonly auditRecord: DegradedModeAuditRecord | null;
}

export interface ListDegradedModeGrantOptions {
  readonly status?: DegradedModeGrantStatus | 'all';
  readonly checkedAt?: string;
  readonly scope?: DegradedModeScope | null;
}

export interface RevokeDegradedModeGrantInput {
  readonly id: string;
  readonly revokedAt: string;
  readonly revokedBy: ReleaseActorReference;
  readonly revocationReason: string;
}

export interface ConsumeDegradedModeGrantInput {
  readonly id: string;
  readonly checkedAt: string;
  readonly actor?: ReleaseActorReference | null;
  readonly failureReasons?: readonly EnforcementFailureReason[];
  readonly outcome?: EnforcementOutcome | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DegradedModeGrantStore {
  registerGrant(grant: DegradedModeGrant): DegradedModeGrant;
  findGrant(id: string): DegradedModeGrant | null;
  listGrants(options?: ListDegradedModeGrantOptions): readonly DegradedModeGrant[];
  revokeGrant(input: RevokeDegradedModeGrantInput): DegradedModeGrant | null;
  consumeGrant(input: ConsumeDegradedModeGrantInput): DegradedModeGrant | null;
  listAuditRecords(): readonly DegradedModeAuditRecord[];
  auditHead(): string | null;
}
