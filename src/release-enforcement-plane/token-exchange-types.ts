import type {
  ReleaseActorReference,
  ReleaseDecision,
  ReleaseTokenActorClaim,
} from '../release-kernel/object-model.js';
import type {
  IssuedReleaseToken,
  ReleaseTokenIssuer,
  ReleaseTokenVerificationKey,
} from '../release-kernel/release-token.js';
import type {
  ReleaseTokenIntrospectionStore,
  ReleaseTokenIntrospector,
} from '../release-kernel/release-introspection.js';

/**
 * Audience-scoped release-token exchange.
 *
 * This is the Attestor release-layer analogue of OAuth token exchange: a
 * general release authorization is not forwarded unchanged to every
 * downstream boundary. It is validated, narrowed to one target audience and
 * scope, annotated with actor history, then re-issued as a downstream-specific
 * release token that the normal offline/online verifiers can enforce.
 */

export const RELEASE_TOKEN_EXCHANGE_SPEC_VERSION =
  'attestor.release-enforcement-token-exchange.v1';
export const RELEASE_TOKEN_EXCHANGE_GRANT_TYPE =
  'urn:ietf:params:oauth:grant-type:token-exchange';
export const ATTESTOR_RELEASE_TOKEN_TYPE =
  'urn:attestor:params:oauth:token-type:release_token';

export type ReleaseTokenExchangeMode = 'delegation' | 'impersonation';

export type ReleaseTokenExchangeFailureReason =
  | 'invalid-subject-token'
  | 'expired-subject-token'
  | 'unsupported-requested-token-type'
  | 'unsupported-subject-token-type'
  | 'unsupported-actor-token-type'
  | 'actor-token-not-supported'
  | 'audience-not-allowed'
  | 'source-audience-not-allowed'
  | 'scope-not-allowed'
  | 'resource-not-allowed'
  | 'invalid-target'
  | 'actor-required'
  | 'actor-proof-required'
  | 'actor-proof-mismatch'
  | 'ttl-policy-required'
  | 'ttl-exhausted'
  | 'inactive-subject-token'
  | 'subject-introspection-unavailable'
  | 'child-registration-store-required'
  | 'child-token-id-conflict';

export interface ReleaseTokenExchangeActor extends ReleaseActorReference {
  readonly tokenSubject?: string;
}

export type ReleaseTokenExchangeTrustedActorSource =
  | 'account-session'
  | 'actor-token'
  | 'mtls-spiffe'
  | 'trusted-exchange-gateway';

export interface ReleaseTokenExchangeTrustedActor extends ReleaseTokenExchangeActor {
  readonly proofSource: ReleaseTokenExchangeTrustedActorSource;
  readonly proofId?: string;
}

export interface ReleaseTokenExchangePolicy {
  readonly allowedAudiences: readonly string[];
  readonly allowedSourceAudiences?: readonly string[];
  readonly allowedScopes?: readonly string[];
  readonly allowedResources?: readonly string[];
  readonly maxTtlSeconds: number;
  readonly maxUses?: number;
  readonly requireActor?: boolean;
}

export interface ReleaseTokenExchangeRequest {
  readonly id: string;
  readonly requestedAt: string;
  readonly subjectToken: string;
  readonly requestedTokenType?: string | null;
  readonly subjectTokenType?: string;
  readonly actorToken?: string | null;
  readonly actorTokenType?: string | null;
  readonly audience: string;
  readonly resource?: string | null;
  readonly scope?: string | readonly string[] | null;
  readonly actor?: ReleaseTokenExchangeActor | null;
  readonly exchangeMode?: ReleaseTokenExchangeMode;
  readonly ttlSeconds?: number;
  readonly tokenId?: string;
}

export interface ReleaseTokenExchangeInput {
  readonly request: ReleaseTokenExchangeRequest;
  readonly issuer: ReleaseTokenIssuer;
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly policy: ReleaseTokenExchangePolicy;
  readonly trustedActor?: ReleaseTokenExchangeTrustedActor | null;
  readonly sourceAudience?: string;
  readonly store?: ReleaseTokenIntrospectionStore;
  readonly subjectIntrospector?: ReleaseTokenIntrospector;
  readonly subjectTokenTypeHint?: string;
}

interface ReleaseTokenExchangeBase {
  readonly version: typeof RELEASE_TOKEN_EXCHANGE_SPEC_VERSION;
  readonly grantType: typeof RELEASE_TOKEN_EXCHANGE_GRANT_TYPE;
  readonly requestedAt: string;
  readonly requestId: string;
  readonly requestedTokenType: string;
  readonly subjectTokenType: string;
  readonly actorTokenType: string | null;
  readonly issuedTokenType: typeof ATTESTOR_RELEASE_TOKEN_TYPE;
  readonly audience: string;
  readonly resource: string | null;
  readonly scope: readonly string[];
  readonly scopeText: string;
  readonly exchangeMode: ReleaseTokenExchangeMode;
  readonly actor: ReleaseTokenActorClaim | null;
  readonly actorChain: readonly ReleaseTokenActorClaim[];
  readonly subjectTokenId: string | null;
  readonly sourceAudience: string | null;
  readonly parentIntrospectionChecked: boolean;
  readonly failureReasons: readonly ReleaseTokenExchangeFailureReason[];
}

export interface ReleaseTokenExchangeIssued extends ReleaseTokenExchangeBase {
  readonly status: 'issued';
  readonly exchangeId: string;
  readonly issuedToken: IssuedReleaseToken;
  readonly decision: ReleaseDecision;
  readonly ttlSeconds: number;
}

export interface ReleaseTokenExchangeDenied extends ReleaseTokenExchangeBase {
  readonly status: 'denied';
  readonly exchangeId: null;
  readonly issuedToken: null;
  readonly decision: null;
  readonly ttlSeconds: null;
}

export type ReleaseTokenExchangeResult =
  | ReleaseTokenExchangeIssued
  | ReleaseTokenExchangeDenied;
