import { randomUUID } from 'node:crypto';
import type {
  ReleaseActorReference,
  ReleaseDecision,
  ReleasePolicyProvenance,
  ReleaseTargetKind,
  ReleaseTokenActorClaim,
  ReleaseTokenClaims,
} from '../release-kernel/object-model.js';
import {
  createReleaseDecisionSkeleton,
  retentionClassForRiskClass,
} from '../release-kernel/object-model.js';
import type {
  IssuedReleaseToken,
  ReleaseTokenIssuer,
  ReleaseTokenVerificationKey,
} from '../release-kernel/release-token.js';
import {
  ReleaseTokenVerificationFailure,
  verifyIssuedReleaseToken,
} from '../release-kernel/release-token.js';
import {
  DEFAULT_RELEASE_TOKEN_TYPE_HINT,
  ReleaseTokenIntrospectionStoreError,
  type ReleaseTokenIntrospectionStore,
  type ReleaseTokenIntrospector,
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

function normalizeIdentifier(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Release token exchange ${fieldName} requires a non-empty value.`);
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
  return normalizeIdentifier(value, fieldName);
}

function normalizeOptionalTokenType(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Release token exchange ${fieldName} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function epochSeconds(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

function normalizeScope(scope: string | readonly string[] | null | undefined): readonly string[] {
  const values =
    typeof scope === 'string'
      ? scope.split(/\s+/)
      : scope ?? [];

  return Object.freeze(
    Array.from(
      new Set(
        values
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    ).sort(),
  );
}

function scopeText(scope: readonly string[]): string {
  return scope.join(' ');
}

function normalizeResource(resource: string | null | undefined): string | null {
  const normalized = normalizeOptionalIdentifier(resource, 'resource');
  if (normalized === null) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('Release token exchange resource must be an absolute URI.');
  }

  if (parsed.hash.length > 0) {
    throw new Error('Release token exchange resource URI must not include a fragment.');
  }

  return parsed.toString();
}

function includesAll(
  allowed: readonly string[] | undefined,
  requested: readonly string[],
): boolean {
  if (!allowed || allowed.length === 0) {
    return requested.length === 0;
  }

  const allowedSet = new Set(allowed);
  return requested.every((value) => allowedSet.has(value));
}

function singleValueAllowed(
  allowed: readonly string[] | undefined,
  value: string | null,
): boolean {
  if (!allowed || allowed.length === 0) {
    return value === null;
  }
  return value !== null && allowed.includes(value);
}

function explicitPolicyMaxTtlSeconds(policy: ReleaseTokenExchangePolicy): number | null {
  const value = policy.maxTtlSeconds;
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function targetKindForClaims(claims: ReleaseTokenClaims): ReleaseTargetKind {
  switch (claims.consequence_type) {
    case 'record':
      return 'record-store';
    case 'action':
      return 'workflow';
    case 'communication':
    case 'decision-support':
    default:
      return 'endpoint';
  }
}

function defaultScopeForClaims(claims: ReleaseTokenClaims): readonly string[] {
  return Object.freeze([`release:${claims.consequence_type}`]);
}

function releaseConditionsForExchange(input: {
  readonly claims: ReleaseTokenClaims;
  readonly audience: string;
  readonly expiresAt: string;
  readonly maxUses: number;
}): ReleaseDecision['releaseConditions'] {
  return Object.freeze({
    items: Object.freeze([
      Object.freeze({
        kind: 'target-binding',
        allowedTargetId: input.audience,
      }),
      Object.freeze({
        kind: 'usage-limit',
        maxUses: input.maxUses,
      }),
      Object.freeze({
        kind: 'expiry',
        expiresAt: input.expiresAt,
      }),
      Object.freeze({
        kind: 'introspection',
        required:
          input.claims.introspection_required ||
          input.claims.risk_class === 'R3' ||
          input.claims.risk_class === 'R4',
      }),
      Object.freeze({
        kind: 'retention',
        retentionClass: retentionClassForRiskClass(input.claims.risk_class),
      }),
    ]),
  });
}

function requesterFromActorOrSubject(
  actor: ReleaseTokenExchangeActor | null | undefined,
  claims: ReleaseTokenClaims,
): ReleaseActorReference {
  if (actor) {
    return Object.freeze({
      id: normalizeIdentifier(actor.id, 'actor.id'),
      type: actor.type,
      ...(actor.displayName ? { displayName: actor.displayName.trim() } : {}),
      ...(actor.role ? { role: actor.role.trim() } : {}),
    });
  }

  return Object.freeze({
    id: claims.sub,
    type: 'service',
  });
}

function actorClaimFromRequest(
  actor: ReleaseTokenExchangeActor,
  previousActor: ReleaseTokenActorClaim | undefined,
): ReleaseTokenActorClaim {
  const claim: ReleaseTokenActorClaim = {
    sub: normalizeIdentifier(actor.tokenSubject ?? actor.id, 'actor.tokenSubject'),
    actor_type: actor.type,
    ...(actor.displayName ? { display_name: actor.displayName.trim() } : {}),
    ...(actor.role ? { role: actor.role.trim() } : {}),
    ...(previousActor ? { act: previousActor } : {}),
  };

  return Object.freeze(claim);
}

function actorAuthorityKey(actor: ReleaseTokenExchangeActor): string {
  return JSON.stringify({
    id: normalizeIdentifier(actor.id, 'actor.id'),
    type: actor.type,
    tokenSubject: normalizeIdentifier(actor.tokenSubject ?? actor.id, 'actor.tokenSubject'),
    role: actor.role ? actor.role.trim() : null,
  });
}

function requestActorMatchesTrustedActor(input: {
  readonly requestActor: ReleaseTokenExchangeActor | null | undefined;
  readonly trustedActor: ReleaseTokenExchangeTrustedActor | null;
}): boolean {
  if (!input.requestActor || !input.trustedActor) {
    return true;
  }
  return actorAuthorityKey(input.requestActor) === actorAuthorityKey(input.trustedActor);
}

function flattenActorChain(
  actor: ReleaseTokenActorClaim | undefined,
): readonly ReleaseTokenActorClaim[] {
  if (!actor) {
    return Object.freeze([]);
  }

  const chain: ReleaseTokenActorClaim[] = [];
  let current: ReleaseTokenActorClaim | undefined = actor;
  while (current) {
    chain.push(current);
    current = current.act;
  }
  return Object.freeze(chain);
}

function policyProvenanceFromClaims(
  claims: ReleaseTokenClaims,
): ReleasePolicyProvenance | null {
  if (claims.policy_provenance_source === undefined) {
    return null;
  }

  return Object.freeze({
    source: claims.policy_provenance_source,
    policyId:
      claims.policy_id ??
      claims.policy_version ??
      'attestor.release-token-exchange.derived-policy',
    policySpecVersion:
      claims.policy_version ?? 'attestor.release-token-exchange.derived-policy.v1',
    policyHash: claims.policy_hash,
    compiledPolicyHash: claims.policy_hash,
    compiledPolicyIrHash: claims.policy_ir_hash ?? null,
    compiledPolicyIndexVersion: claims.compiled_policy_index_version ?? null,
    compiledPolicyIrVersion: claims.compiled_policy_ir_version ?? null,
    verificationValid: null,
    verificationErrorCodes: Object.freeze([]),
    verificationWarningCodes: Object.freeze([]),
  });
}

function derivedDecisionForExchange(input: {
  readonly claims: ReleaseTokenClaims;
  readonly request: ReleaseTokenExchangeRequest;
  readonly trustedActor: ReleaseTokenExchangeTrustedActor | null;
  readonly audience: string;
  readonly requestedAt: string;
  readonly expiresAt: string;
  readonly maxUses: number;
}): ReleaseDecision {
  return createReleaseDecisionSkeleton({
    id: input.claims.decision_id,
    createdAt: input.requestedAt,
    status: input.claims.decision,
    policyVersion: 'attestor.release-token-exchange.derived-policy.v1',
    policyHash: input.claims.policy_hash,
    policyProvenance: policyProvenanceFromClaims(input.claims),
    outputHash: input.claims.output_hash,
    consequenceHash: input.claims.consequence_hash,
    outputContract: {
      artifactType: 'release-token-exchange.downstream-authorization',
      expectedShape: 'audience-scoped release authorization',
      consequenceType: input.claims.consequence_type,
      riskClass: input.claims.risk_class,
    },
    capabilityBoundary: {
      allowedTools: [],
      allowedTargets: [input.audience],
      allowedDataDomains: [],
    },
    requester: requesterFromActorOrSubject(input.trustedActor, input.claims),
    target: {
      kind: targetKindForClaims(input.claims),
      id: input.audience,
    },
    reviewAuthority: {
      mode: input.claims.authority_mode,
    },
    releaseConditions: releaseConditionsForExchange({
      claims: input.claims,
      audience: input.audience,
      expiresAt: input.expiresAt,
      maxUses: input.maxUses,
    }),
  });
}

function deny(input: {
  readonly request: ReleaseTokenExchangeRequest;
  readonly requestedAt: string;
  readonly requestedTokenType: string;
  readonly subjectTokenType: string;
  readonly actorTokenType: string | null;
  readonly audience: string;
  readonly resource: string | null;
  readonly scope: readonly string[];
  readonly exchangeMode: ReleaseTokenExchangeMode;
  readonly actor: ReleaseTokenActorClaim | null;
  readonly subjectTokenId?: string | null;
  readonly sourceAudience?: string | null;
  readonly parentIntrospectionChecked?: boolean;
  readonly failureReasons: readonly ReleaseTokenExchangeFailureReason[];
}): ReleaseTokenExchangeDenied {
  return Object.freeze({
    version: RELEASE_TOKEN_EXCHANGE_SPEC_VERSION,
    grantType: RELEASE_TOKEN_EXCHANGE_GRANT_TYPE,
    requestedAt: input.requestedAt,
    requestId: input.request.id,
    requestedTokenType: input.requestedTokenType,
    subjectTokenType: input.subjectTokenType,
    actorTokenType: input.actorTokenType,
    issuedTokenType: ATTESTOR_RELEASE_TOKEN_TYPE,
    audience: input.audience,
    resource: input.resource,
    scope: input.scope,
    scopeText: scopeText(input.scope),
    exchangeMode: input.exchangeMode,
    actor: input.actor,
    actorChain: flattenActorChain(input.actor ?? undefined),
    subjectTokenId: input.subjectTokenId ?? null,
    sourceAudience: input.sourceAudience ?? null,
    parentIntrospectionChecked: input.parentIntrospectionChecked ?? false,
    failureReasons: Object.freeze(Array.from(new Set(input.failureReasons))),
    status: 'denied',
    exchangeId: null,
    issuedToken: null,
    decision: null,
    ttlSeconds: null,
  });
}

function requestedTtlSeconds(input: {
  readonly request: ReleaseTokenExchangeRequest;
  readonly maxTtlSeconds: number;
  readonly claims: ReleaseTokenClaims;
  readonly requestedAt: string;
}): number {
  const nowEpoch = epochSeconds(input.requestedAt);
  const subjectRemainingSeconds = input.claims.exp - nowEpoch;
  const requested = input.request.ttlSeconds ?? input.maxTtlSeconds;
  return Math.min(subjectRemainingSeconds, input.maxTtlSeconds, requested);
}

export async function exchangeReleaseToken(
  input: ReleaseTokenExchangeInput,
): Promise<ReleaseTokenExchangeResult> {
  const requestedAt = normalizeIsoTimestamp(input.request.requestedAt, 'requestedAt');
  const requestedTokenType =
    normalizeOptionalTokenType(input.request.requestedTokenType) ??
    ATTESTOR_RELEASE_TOKEN_TYPE;
  const subjectTokenType =
    input.request.subjectTokenType ?? ATTESTOR_RELEASE_TOKEN_TYPE;
  const actorToken = normalizeOptionalTokenType(input.request.actorToken);
  const actorTokenType = normalizeOptionalTokenType(input.request.actorTokenType);
  const audience = normalizeIdentifier(input.request.audience, 'audience');
  const exchangeMode = input.request.exchangeMode ?? 'delegation';
  let resource: string | null;

  try {
    resource = normalizeResource(input.request.resource);
  } catch {
    resource = null;
    return deny({
      request: input.request,
      requestedAt,
      requestedTokenType,
      subjectTokenType,
      actorTokenType,
      audience,
      resource,
      scope: normalizeScope(input.request.scope),
      exchangeMode,
      actor: null,
      failureReasons: ['invalid-target'],
    });
  }

  if (requestedTokenType !== ATTESTOR_RELEASE_TOKEN_TYPE) {
    return deny({
      request: input.request,
      requestedAt,
      requestedTokenType,
      subjectTokenType,
      actorTokenType,
      audience,
      resource,
      scope: normalizeScope(input.request.scope),
      exchangeMode,
      actor: null,
      failureReasons: ['unsupported-requested-token-type'],
    });
  }

  if (actorToken !== null) {
    return deny({
      request: input.request,
      requestedAt,
      requestedTokenType,
      subjectTokenType,
      actorTokenType,
      audience,
      resource,
      scope: normalizeScope(input.request.scope),
      exchangeMode,
      actor: null,
      failureReasons:
        actorTokenType === ATTESTOR_RELEASE_TOKEN_TYPE
          ? ['actor-token-not-supported']
          : ['unsupported-actor-token-type'],
    });
  }

  if (actorTokenType !== null) {
    return deny({
      request: input.request,
      requestedAt,
      requestedTokenType,
      subjectTokenType,
      actorTokenType,
      audience,
      resource,
      scope: normalizeScope(input.request.scope),
      exchangeMode,
      actor: null,
      failureReasons: ['unsupported-actor-token-type'],
    });
  }

  if (subjectTokenType !== ATTESTOR_RELEASE_TOKEN_TYPE) {
    return deny({
      request: input.request,
      requestedAt,
      requestedTokenType,
      subjectTokenType,
      actorTokenType,
      audience,
      resource,
      scope: normalizeScope(input.request.scope),
      exchangeMode,
      actor: null,
      failureReasons: ['unsupported-subject-token-type'],
    });
  }

  let subject;
  try {
    subject = await verifyIssuedReleaseToken({
      token: input.request.subjectToken,
      verificationKey: input.verificationKey,
      audience: input.sourceAudience,
      currentDate: requestedAt,
    });
  } catch (error) {
    const failureReason =
      error instanceof ReleaseTokenVerificationFailure && error.code === 'expired'
        ? 'expired-subject-token'
        : 'invalid-subject-token';
    return deny({
      request: input.request,
      requestedAt,
      requestedTokenType,
      subjectTokenType,
      actorTokenType,
      audience,
      resource,
      scope: normalizeScope(input.request.scope),
      exchangeMode,
      actor: null,
      failureReasons: [failureReason],
    });
  }

  const claims = subject.claims;
  const parentIntrospectionRequired =
    claims.introspection_required || claims.risk_class === 'R3' || claims.risk_class === 'R4';
  const parentBoundaryFailures: ReleaseTokenExchangeFailureReason[] = [];
  if (parentIntrospectionRequired && !input.subjectIntrospector) {
    parentBoundaryFailures.push('subject-introspection-unavailable');
  }
  if (parentIntrospectionRequired && !input.store) {
    parentBoundaryFailures.push('child-registration-store-required');
  }
  if (parentBoundaryFailures.length > 0) {
    return deny({
      request: input.request,
      requestedAt,
      requestedTokenType,
      subjectTokenType,
      actorTokenType,
      audience,
      resource,
      scope: normalizeScope(input.request.scope),
      exchangeMode,
      actor: null,
      subjectTokenId: claims.jti,
      sourceAudience: claims.aud,
      failureReasons: parentBoundaryFailures,
    });
  }

  let parentIntrospectionChecked = false;
  if (input.subjectIntrospector) {
    try {
      const introspection = await input.subjectIntrospector.introspect({
        token: input.request.subjectToken,
        verificationKey: input.verificationKey,
        audience: input.sourceAudience ?? claims.aud,
        currentDate: requestedAt,
        tokenTypeHint: input.subjectTokenTypeHint ?? DEFAULT_RELEASE_TOKEN_TYPE_HINT,
        resourceServerId: 'attestor.release-token-exchange',
      });
      parentIntrospectionChecked = true;

      if (!introspection.active || introspection.jti !== claims.jti) {
        return deny({
          request: input.request,
          requestedAt,
          requestedTokenType,
          subjectTokenType,
          actorTokenType,
          audience,
          resource,
          scope: normalizeScope(input.request.scope),
          exchangeMode,
          actor: null,
          subjectTokenId: claims.jti,
          sourceAudience: claims.aud,
          parentIntrospectionChecked,
          failureReasons: ['inactive-subject-token'],
        });
      }
    } catch {
      return deny({
        request: input.request,
        requestedAt,
        requestedTokenType,
        subjectTokenType,
        actorTokenType,
        audience,
        resource,
        scope: normalizeScope(input.request.scope),
        exchangeMode,
        actor: null,
        subjectTokenId: claims.jti,
        sourceAudience: claims.aud,
        parentIntrospectionChecked,
        failureReasons: ['subject-introspection-unavailable'],
      });
    }
  }

  const requestedScope = normalizeScope(input.request.scope);
  const scope =
    requestedScope.length > 0 ? requestedScope : defaultScopeForClaims(claims);
  const trustedActor = input.trustedActor ?? null;
  const actor = trustedActor
    ? actorClaimFromRequest(trustedActor, claims.act)
    : claims.act ?? null;

  const policyFailures: ReleaseTokenExchangeFailureReason[] = [];
  if (!input.policy.allowedAudiences.includes(audience)) {
    policyFailures.push('audience-not-allowed');
  }
  if (
    input.policy.allowedSourceAudiences &&
    !input.policy.allowedSourceAudiences.includes(claims.aud)
  ) {
    policyFailures.push('source-audience-not-allowed');
  }
  if (!includesAll(input.policy.allowedScopes, scope)) {
    policyFailures.push('scope-not-allowed');
  }
  if (!singleValueAllowed(input.policy.allowedResources, resource)) {
    policyFailures.push('resource-not-allowed');
  }
  if (
    !requestActorMatchesTrustedActor({
      requestActor: input.request.actor,
      trustedActor,
    })
  ) {
    policyFailures.push('actor-proof-mismatch');
  }
  const actorProofRequired =
    input.policy.requireActor === true &&
    input.request.actor !== null &&
    input.request.actor !== undefined &&
    trustedActor === null;
  if (actorProofRequired) {
    policyFailures.push('actor-proof-required');
  }
  if (input.policy.requireActor === true && actor === null && !actorProofRequired) {
    policyFailures.push('actor-required');
  }

  const maxTtlSeconds = explicitPolicyMaxTtlSeconds(input.policy);
  if (maxTtlSeconds === null) {
    policyFailures.push('ttl-policy-required');
  }

  const ttlSeconds =
    maxTtlSeconds === null
      ? 0
      : requestedTtlSeconds({
          request: input.request,
          maxTtlSeconds,
          claims,
          requestedAt,
        });
  if (maxTtlSeconds !== null && ttlSeconds <= 0) {
    policyFailures.push('ttl-exhausted');
  }

  if (policyFailures.length > 0) {
    return deny({
      request: input.request,
      requestedAt,
      requestedTokenType,
      subjectTokenType,
      actorTokenType,
      audience,
      resource,
      scope,
      exchangeMode,
      actor,
      subjectTokenId: claims.jti,
      sourceAudience: claims.aud,
      parentIntrospectionChecked,
      failureReasons: policyFailures,
    });
  }

  if (input.request.tokenId && input.store?.findToken(input.request.tokenId)) {
    return deny({
      request: input.request,
      requestedAt,
      requestedTokenType,
      subjectTokenType,
      actorTokenType,
      audience,
      resource,
      scope,
      exchangeMode,
      actor,
      subjectTokenId: claims.jti,
      sourceAudience: claims.aud,
      parentIntrospectionChecked,
      failureReasons: ['child-token-id-conflict'],
    });
  }

  const exchangeId = input.request.id;
  const expiresAt = new Date(
    new Date(requestedAt).getTime() + ttlSeconds * 1000,
  ).toISOString();
  const decision = derivedDecisionForExchange({
    claims,
    request: input.request,
    trustedActor,
    audience,
    requestedAt,
    expiresAt,
    maxUses: input.policy.maxUses ?? 1,
  });
  const issuedToken = await input.issuer.issue({
    decision,
    subject:
      exchangeMode === 'impersonation' && trustedActor
        ? trustedActor.tokenSubject ?? trustedActor.id
        : claims.sub,
    issuedAt: requestedAt,
    ttlSeconds,
    tokenId: input.request.tokenId ?? `rtx_${randomUUID()}`,
    audience,
    tenantId: claims.tenant_id ?? null,
    scope: scopeText(scope),
    resource: resource ?? undefined,
    actor: actor ?? undefined,
    parentTokenId: claims.jti,
    exchangeId,
    exchangedAt: requestedAt,
    sourceAudience: claims.aud,
    tokenUse: 'exchanged-release',
    confirmation: claims.cnf,
  });

  try {
    input.store?.registerIssuedToken({ issuedToken, decision });
  } catch (error) {
    if (error instanceof ReleaseTokenIntrospectionStoreError) {
      return deny({
        request: input.request,
        requestedAt,
        requestedTokenType,
        subjectTokenType,
        actorTokenType,
        audience,
        resource,
        scope,
        exchangeMode,
        actor,
        subjectTokenId: claims.jti,
        sourceAudience: claims.aud,
        parentIntrospectionChecked,
        failureReasons: ['child-token-id-conflict'],
      });
    }
    throw error;
  }

  return Object.freeze({
    version: RELEASE_TOKEN_EXCHANGE_SPEC_VERSION,
    grantType: RELEASE_TOKEN_EXCHANGE_GRANT_TYPE,
    requestedAt,
    requestId: input.request.id,
    requestedTokenType,
    subjectTokenType,
    actorTokenType,
    issuedTokenType: ATTESTOR_RELEASE_TOKEN_TYPE,
    audience,
    resource,
    scope,
    scopeText: scopeText(scope),
    exchangeMode,
    actor,
    actorChain: flattenActorChain(actor ?? undefined),
    subjectTokenId: claims.jti,
    sourceAudience: claims.aud,
    parentIntrospectionChecked,
    failureReasons: Object.freeze([]),
    status: 'issued',
    exchangeId,
    issuedToken,
    decision,
    ttlSeconds,
  });
}
