import type { Context, MiddlewareHandler } from 'hono';
import type {
  ReleaseTokenVerificationKey,
  ReleaseTokenVerificationResult,
  VerifyReleaseTokenInput,
} from './release-token.js';
import {
  ReleaseTokenVerificationFailure,
  verifyIssuedReleaseToken,
} from './release-token.js';
import type {
  ActiveReleaseTokenIntrospectionResult,
  AwaitableReleaseTokenIntrospectionStore,
  ReleaseTokenIntrospectionResult,
  ReleaseTokenIntrospector,
} from './release-introspection.js';
import type { ReleasePolicyProvenanceSource } from './object-model.js';
import {
  verifyDpopProof,
  type DpopProofVerification,
} from '../release-enforcement-plane/dpop.js';

/**
 * Downstream release-token verification SDK and middleware.
 *
 * This is the first consumer-side contract for "no token -> no release". It
 * verifies the token cryptographically, then verifies that the token still
 * matches the concrete output/consequence/target binding the downstream path
 * is about to admit.
 */

export const RELEASE_VERIFICATION_SPEC_VERSION = 'attestor.release-verification.v1';
export const DEFAULT_RELEASE_CONTEXT_KEY = 'attestor.release';
export const DEFAULT_RELEASE_TOKEN_HEADER = 'x-attestor-release-token';

export type ReleaseVerificationErrorCode =
  | 'missing_token'
  | 'invalid_request'
  | 'invalid_token'
  | 'insufficient_scope';

export interface ReleaseVerificationErrorShape {
  readonly error: ReleaseVerificationErrorCode;
  readonly error_description: string;
}

export interface ReleaseVerificationInput extends VerifyReleaseTokenInput {
  readonly expectedTargetId?: string;
  readonly expectedOutputHash?: string;
  readonly expectedConsequenceHash?: string;
  readonly expectedPolicyHash?: string;
  readonly expectedPolicyVersion?: string;
  readonly expectedPolicyIrHash?: string;
  readonly expectedPolicyProvenanceSource?: ReleasePolicyProvenanceSource;
  readonly expectedCompiledPolicyIndexVersion?: string;
  readonly expectedCompiledPolicyIrVersion?: string;
  readonly introspector?: ReleaseTokenIntrospector;
  readonly usageStore?: AwaitableReleaseTokenIntrospectionStore;
  readonly consumeOnSuccess?: boolean;
  readonly tokenTypeHint?: string;
  readonly resourceServerId?: string;
  readonly requireSenderConstrainedToken?: boolean;
  readonly dpopProofJwt?: string | null;
  readonly dpopHttpMethod?: string;
  readonly dpopHttpUri?: string;
}

export interface ReleaseVerificationPolicyContext {
  readonly policyVersion: string | null;
  readonly policyHash: string;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
}

export interface ReleaseVerificationContext {
  readonly version: typeof RELEASE_VERIFICATION_SPEC_VERSION;
  readonly token: string;
  readonly verification: ReleaseTokenVerificationResult;
  readonly tokenPolicy: ReleaseVerificationPolicyContext;
  readonly audience: string | undefined;
  readonly expectedTargetId: string | undefined;
  readonly expectedOutputHash: string | undefined;
  readonly expectedConsequenceHash: string | undefined;
  readonly expectedPolicyHash: string | undefined;
  readonly expectedPolicyVersion: string | undefined;
  readonly expectedPolicyIrHash: string | undefined;
  readonly expectedPolicyProvenanceSource: ReleasePolicyProvenanceSource | undefined;
  readonly expectedCompiledPolicyIndexVersion: string | undefined;
  readonly expectedCompiledPolicyIrVersion: string | undefined;
  readonly requireSenderConstrainedToken: boolean;
  readonly senderBinding: ReleaseVerificationSenderBindingContext;
  readonly introspection: ReleaseTokenIntrospectionResult | null;
  readonly usage: {
    readonly consumed: boolean;
    readonly useCount: number | null;
    readonly maxUses: number | null;
  } | null;
}

export interface ReleaseVerificationSenderBindingContext {
  readonly mode: 'bearer' | 'dpop-bound-token';
  readonly required: boolean;
  readonly verified: boolean;
  readonly proofJti: string | null;
  readonly publicKeyThumbprint: string | null;
  readonly failureReasons: readonly string[];
}

export class ReleaseVerificationError extends Error {
  readonly status: 401 | 403;
  readonly code: ReleaseVerificationErrorCode;
  readonly challenge: string;

  constructor(
    status: 401 | 403,
    code: ReleaseVerificationErrorCode,
    description: string,
    challenge: string,
  ) {
    super(description);
    this.name = 'ReleaseVerificationError';
    this.status = status;
    this.code = code;
    this.challenge = challenge;
  }

  toResponseBody(): ReleaseVerificationErrorShape {
    return {
      error: this.code,
      error_description: this.message,
    };
  }
}

type ResolveMaybe<T> = T | ((context: Context) => T | Promise<T>);

export interface CreateReleaseVerificationMiddlewareInput {
  readonly verificationKey:
    | ReleaseTokenVerificationKey
    | ((context: Context) => ReleaseTokenVerificationKey | Promise<ReleaseTokenVerificationKey>);
  readonly audience?: ResolveMaybe<string | undefined>;
  readonly expectedTargetId?: ResolveMaybe<string | undefined>;
  readonly expectedOutputHash?: ResolveMaybe<string | undefined>;
  readonly expectedConsequenceHash?: ResolveMaybe<string | undefined>;
  readonly expectedPolicyHash?: ResolveMaybe<string | undefined>;
  readonly expectedPolicyVersion?: ResolveMaybe<string | undefined>;
  readonly expectedPolicyIrHash?: ResolveMaybe<string | undefined>;
  readonly expectedPolicyProvenanceSource?: ResolveMaybe<ReleasePolicyProvenanceSource | undefined>;
  readonly expectedCompiledPolicyIndexVersion?: ResolveMaybe<string | undefined>;
  readonly expectedCompiledPolicyIrVersion?: ResolveMaybe<string | undefined>;
  readonly currentDate?: ResolveMaybe<string | undefined>;
  readonly introspector?:
    | ReleaseTokenIntrospector
    | ((context: Context) => ReleaseTokenIntrospector | Promise<ReleaseTokenIntrospector>);
  readonly usageStore?:
    | AwaitableReleaseTokenIntrospectionStore
    | ((
        context: Context,
      ) => AwaitableReleaseTokenIntrospectionStore | Promise<AwaitableReleaseTokenIntrospectionStore>);
  readonly consumeOnSuccess?: ResolveMaybe<boolean | undefined>;
  readonly tokenTypeHint?: ResolveMaybe<string | undefined>;
  readonly resourceServerId?: ResolveMaybe<string | undefined>;
  readonly requireSenderConstrainedToken?: ResolveMaybe<boolean | undefined>;
  readonly dpopHttpUri?: ResolveMaybe<string | undefined>;
  readonly dpopProofHeaderName?: string;
  readonly tokenHeaderName?: string;
  readonly contextKey?: string;
}

function escapeChallengeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildBearerChallenge(
  error: ReleaseVerificationErrorCode,
  description: string,
): string {
  return `Bearer realm="attestor-release", error="${error}", error_description="${escapeChallengeValue(description)}"`;
}

function resolveTokenFromHeaders(
  headers: Headers,
  tokenHeaderName: string,
): string | null {
  const authorization = headers.get('authorization');
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }

    throw new ReleaseVerificationError(
      401,
      'invalid_request',
      'Authorization header must use Bearer token syntax.',
      buildBearerChallenge('invalid_request', 'Authorization header must use Bearer token syntax.'),
    );
  }

  const dedicatedHeader = headers.get(tokenHeaderName);
  if (dedicatedHeader) {
    return dedicatedHeader.trim();
  }

  return null;
}

async function resolveValue<T>(
  candidate: ResolveMaybe<T> | undefined,
  context: Context,
): Promise<T | undefined> {
  if (candidate === undefined) {
    return undefined;
  }

  return typeof candidate === 'function'
    ? await (candidate as (context: Context) => T | Promise<T>)(context)
    : candidate;
}

export function resolveReleaseTokenFromRequest(
  request: Request,
  tokenHeaderName = DEFAULT_RELEASE_TOKEN_HEADER,
): string {
  const token = resolveTokenFromHeaders(request.headers, tokenHeaderName);
  if (!token) {
    throw new ReleaseVerificationError(
      401,
      'missing_token',
      'A release token is required before this consequence path may proceed.',
      buildBearerChallenge(
        'invalid_token',
        'A release token is required before this consequence path may proceed.',
      ),
    );
  }

  return token;
}

function assertVerifiedBinding(
  verification: ReleaseTokenVerificationResult,
  input: ReleaseVerificationInput,
): void {
  if (
    input.expectedTargetId !== undefined &&
    verification.claims.aud !== input.expectedTargetId
  ) {
    throw new ReleaseVerificationError(
      403,
      'insufficient_scope',
      'Release token audience does not match the downstream target.',
      buildBearerChallenge(
        'insufficient_scope',
        'Release token audience does not match the downstream target.',
      ),
    );
  }

  if (
    input.expectedOutputHash !== undefined &&
    verification.claims.output_hash !== input.expectedOutputHash
  ) {
    throw new ReleaseVerificationError(
      403,
      'insufficient_scope',
      'Release token output hash does not match the downstream release candidate.',
      buildBearerChallenge(
        'insufficient_scope',
        'Release token output hash does not match the downstream release candidate.',
      ),
    );
  }

  if (
    input.expectedConsequenceHash !== undefined &&
    verification.claims.consequence_hash !== input.expectedConsequenceHash
  ) {
    throw new ReleaseVerificationError(
      403,
      'insufficient_scope',
      'Release token consequence hash does not match the downstream consequence candidate.',
      buildBearerChallenge(
        'insufficient_scope',
        'Release token consequence hash does not match the downstream consequence candidate.',
      ),
    );
  }

  if (
    input.expectedPolicyHash !== undefined &&
    verification.claims.policy_hash !== input.expectedPolicyHash
  ) {
    throw new ReleaseVerificationError(
      403,
      'insufficient_scope',
      'Release token policy hash does not match the downstream policy provenance requirement.',
      buildBearerChallenge(
        'insufficient_scope',
        'Release token policy hash does not match the downstream policy provenance requirement.',
      ),
    );
  }

  if (
    input.expectedPolicyVersion !== undefined &&
    verification.claims.policy_version !== input.expectedPolicyVersion
  ) {
    throw new ReleaseVerificationError(
      403,
      'insufficient_scope',
      'Release token policy version does not match the downstream policy provenance requirement.',
      buildBearerChallenge(
        'insufficient_scope',
        'Release token policy version does not match the downstream policy provenance requirement.',
      ),
    );
  }

  if (
    input.expectedPolicyIrHash !== undefined &&
    verification.claims.policy_ir_hash !== input.expectedPolicyIrHash
  ) {
    throw new ReleaseVerificationError(
      403,
      'insufficient_scope',
      'Release token policy IR hash does not match the downstream policy provenance requirement.',
      buildBearerChallenge(
        'insufficient_scope',
        'Release token policy IR hash does not match the downstream policy provenance requirement.',
      ),
    );
  }

  if (
    input.expectedPolicyProvenanceSource !== undefined &&
    verification.claims.policy_provenance_source !== input.expectedPolicyProvenanceSource
  ) {
    throw new ReleaseVerificationError(
      403,
      'insufficient_scope',
      'Release token policy provenance source does not match the downstream policy provenance requirement.',
      buildBearerChallenge(
        'insufficient_scope',
        'Release token policy provenance source does not match the downstream policy provenance requirement.',
      ),
    );
  }

  if (
    input.expectedCompiledPolicyIndexVersion !== undefined &&
    verification.claims.compiled_policy_index_version !== input.expectedCompiledPolicyIndexVersion
  ) {
    throw new ReleaseVerificationError(
      403,
      'insufficient_scope',
      'Release token compiled policy index version does not match the downstream policy provenance requirement.',
      buildBearerChallenge(
        'insufficient_scope',
        'Release token compiled policy index version does not match the downstream policy provenance requirement.',
      ),
    );
  }

  if (
    input.expectedCompiledPolicyIrVersion !== undefined &&
    verification.claims.compiled_policy_ir_version !== input.expectedCompiledPolicyIrVersion
  ) {
    throw new ReleaseVerificationError(
      403,
      'insufficient_scope',
      'Release token compiled policy IR version does not match the downstream policy provenance requirement.',
      buildBearerChallenge(
        'insufficient_scope',
        'Release token compiled policy IR version does not match the downstream policy provenance requirement.',
      ),
    );
  }
}

function normalizedDpopProof(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function senderBindingContext(input: {
  readonly mode: ReleaseVerificationSenderBindingContext['mode'];
  readonly required: boolean;
  readonly verified: boolean;
  readonly verification?: DpopProofVerification | null;
}): ReleaseVerificationSenderBindingContext {
  return Object.freeze({
    mode: input.mode,
    required: input.required,
    verified: input.verified,
    proofJti: input.verification?.proofJti ?? null,
    publicKeyThumbprint: input.verification?.publicKeyThumbprint ?? null,
    failureReasons: input.verification?.failureReasons ?? Object.freeze([]),
  });
}

async function verifySenderBinding(
  verification: ReleaseTokenVerificationResult,
  input: ReleaseVerificationInput,
): Promise<ReleaseVerificationSenderBindingContext> {
  const requireSenderConstrainedToken = input.requireSenderConstrainedToken === true;
  const expectedJwkThumbprint = verification.claims.cnf?.jkt?.trim() || null;

  if (!expectedJwkThumbprint) {
    if (requireSenderConstrainedToken) {
      throw new ReleaseVerificationError(
        403,
        'insufficient_scope',
        'Release token must be sender-constrained for this consequence path.',
        buildBearerChallenge(
          'insufficient_scope',
          'Release token must be sender-constrained for this consequence path.',
        ),
      );
    }

    return senderBindingContext({
      mode: 'bearer',
      required: false,
      verified: false,
    });
  }

  const dpopProofJwt = normalizedDpopProof(input.dpopProofJwt);
  if (!dpopProofJwt || !input.dpopHttpMethod || !input.dpopHttpUri) {
    throw new ReleaseVerificationError(
      401,
      'invalid_token',
      'DPoP proof is required for this sender-constrained release token.',
      buildBearerChallenge(
        'invalid_token',
        'DPoP proof is required for this sender-constrained release token.',
      ),
    );
  }

  const dpop = await verifyDpopProof({
    proofJwt: dpopProofJwt,
    httpMethod: input.dpopHttpMethod,
    httpUri: input.dpopHttpUri,
    accessToken: input.token,
    expectedJwkThumbprint,
    now: input.currentDate ?? new Date().toISOString(),
  });

  if (dpop.status !== 'valid') {
    throw new ReleaseVerificationError(
      403,
      'insufficient_scope',
      'DPoP proof does not match the sender-constrained release token.',
      buildBearerChallenge(
        'insufficient_scope',
        'DPoP proof does not match the sender-constrained release token.',
      ),
    );
  }

  return senderBindingContext({
    mode: 'dpop-bound-token',
    required: true,
    verified: true,
    verification: dpop,
  });
}

function assertActiveIntrospectionConsistency(
  verification: ReleaseTokenVerificationResult,
  introspection: ActiveReleaseTokenIntrospectionResult,
): void {
  if (
    introspection.jti !== verification.claims.jti ||
    introspection.decision_id !== verification.claims.decision_id ||
    introspection.aud !== verification.claims.aud ||
    introspection.output_hash !== verification.claims.output_hash ||
    introspection.consequence_hash !== verification.claims.consequence_hash ||
    introspection.policy_hash !== verification.claims.policy_hash ||
    (introspection.policy_version ?? null) !== (verification.claims.policy_version ?? null) ||
    (introspection.policy_ir_hash ?? null) !== (verification.claims.policy_ir_hash ?? null) ||
    (introspection.policy_provenance_source ?? null) !==
      (verification.claims.policy_provenance_source ?? null) ||
    (introspection.compiled_policy_index_version ?? null) !==
      (verification.claims.compiled_policy_index_version ?? null) ||
    (introspection.compiled_policy_ir_version ?? null) !==
      (verification.claims.compiled_policy_ir_version ?? null) ||
    (introspection.tenant_id ?? null) !== (verification.claims.tenant_id ?? null) ||
    (introspection.cnf?.jkt ?? null) !== (verification.claims.cnf?.jkt ?? null) ||
    introspection.decision !== verification.claims.decision ||
    introspection.risk_class !== verification.claims.risk_class
  ) {
    throw new ReleaseVerificationError(
      401,
      'invalid_token',
      'Release token introspection does not match the verified token claims.',
      buildBearerChallenge(
        'invalid_token',
        'Release token introspection does not match the verified token claims.',
      ),
    );
  }
}

function introspectionInactiveDescription(
  reason: Exclude<ReleaseTokenIntrospectionResult, ActiveReleaseTokenIntrospectionResult>['inactive_reason'],
): string {
  switch (reason) {
    case 'revoked':
      return 'Release token was revoked by the Attestor release authority.';
    case 'expired':
      return 'Release token has expired.';
    case 'usage_exhausted':
      return 'Release token has already been consumed and cannot be replayed.';
    case 'claim_mismatch':
      return 'Release token registry state does not match the verified token claims.';
    case 'unsupported_token_type':
      return 'Release token type hint is not supported by the Attestor introspection registry.';
    case 'unknown':
      return 'Release token is not registered in the Attestor release authority plane.';
    case 'invalid':
    default:
      return 'Release token is not active according to the Attestor introspection registry.';
  }
}

export async function verifyReleaseAuthorization(
  input: ReleaseVerificationInput,
): Promise<ReleaseVerificationContext> {
  let verification: ReleaseTokenVerificationResult;

  try {
    verification = await verifyIssuedReleaseToken(input);
  } catch (error) {
    const description =
      error instanceof ReleaseTokenVerificationFailure
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Release token verification failed.';
    throw new ReleaseVerificationError(
      401,
      'invalid_token',
      description,
      buildBearerChallenge('invalid_token', description),
    );
  }

  assertVerifiedBinding(verification, input);
  const senderBinding = await verifySenderBinding(verification, input);

  let introspection: ReleaseTokenIntrospectionResult | null = null;
  if (verification.claims.introspection_required) {
    if (!input.introspector) {
      throw new ReleaseVerificationError(
        401,
        'invalid_token',
        'This high-risk release token requires active introspection before the consequence path may proceed.',
        buildBearerChallenge(
          'invalid_token',
          'This high-risk release token requires active introspection before the consequence path may proceed.',
        ),
      );
    }

    introspection = await input.introspector.introspect({
      token: input.token,
      verificationKey: input.verificationKey,
      audience: input.audience,
      currentDate: input.currentDate,
      tokenTypeHint: input.tokenTypeHint,
      resourceServerId: input.resourceServerId,
    });

    if (!introspection.active) {
      const description = introspectionInactiveDescription(introspection.inactive_reason);
      throw new ReleaseVerificationError(
        401,
        'invalid_token',
        description,
        buildBearerChallenge(
          'invalid_token',
          description,
        ),
      );
    }

    assertActiveIntrospectionConsistency(verification, introspection);
  }

  let usage: ReleaseVerificationContext['usage'] = null;
  if (input.consumeOnSuccess) {
    if (!input.usageStore) {
      throw new ReleaseVerificationError(
        401,
        'invalid_token',
        'Release token consumption requires a replay-protection ledger.',
        buildBearerChallenge(
          'invalid_token',
          'Release token consumption requires a replay-protection ledger.',
        ),
      );
    }

    const consumed = await input.usageStore.recordTokenUse({
      tokenId: verification.claims.jti,
      usedAt: input.currentDate,
      resourceServerId: input.resourceServerId,
    });
    if (!consumed.accepted || !consumed.record) {
      const description = introspectionInactiveDescription(
        consumed.inactiveReason ?? 'invalid',
      );
      throw new ReleaseVerificationError(
        401,
        'invalid_token',
        description,
        buildBearerChallenge('invalid_token', description),
      );
    }

    usage = Object.freeze({
      consumed: true,
      useCount: consumed.record.useCount,
      maxUses: consumed.record.maxUses,
    });
  }

  return Object.freeze({
    version: RELEASE_VERIFICATION_SPEC_VERSION,
    token: input.token,
    verification,
    tokenPolicy: Object.freeze({
      policyVersion: verification.claims.policy_version ?? null,
      policyHash: verification.claims.policy_hash,
      policyIrHash: verification.claims.policy_ir_hash ?? null,
      policyProvenanceSource: verification.claims.policy_provenance_source ?? null,
      compiledPolicyIndexVersion:
        verification.claims.compiled_policy_index_version ?? null,
      compiledPolicyIrVersion: verification.claims.compiled_policy_ir_version ?? null,
    }),
    audience: input.audience,
    expectedTargetId: input.expectedTargetId,
    expectedOutputHash: input.expectedOutputHash,
    expectedConsequenceHash: input.expectedConsequenceHash,
    expectedPolicyHash: input.expectedPolicyHash,
    expectedPolicyVersion: input.expectedPolicyVersion,
    expectedPolicyIrHash: input.expectedPolicyIrHash,
    expectedPolicyProvenanceSource: input.expectedPolicyProvenanceSource,
    expectedCompiledPolicyIndexVersion: input.expectedCompiledPolicyIndexVersion,
    expectedCompiledPolicyIrVersion: input.expectedCompiledPolicyIrVersion,
    requireSenderConstrainedToken: input.requireSenderConstrainedToken === true,
    senderBinding,
    introspection,
    usage,
  });
}

export function createReleaseVerificationMiddleware(
  input: CreateReleaseVerificationMiddlewareInput,
): MiddlewareHandler {
  const tokenHeaderName = input.tokenHeaderName ?? DEFAULT_RELEASE_TOKEN_HEADER;
  const dpopProofHeaderName = input.dpopProofHeaderName ?? 'DPoP';
  const contextKey = input.contextKey ?? DEFAULT_RELEASE_CONTEXT_KEY;

  return async (context, next) => {
    try {
      const token = resolveReleaseTokenFromRequest(context.req.raw, tokenHeaderName);
      const verificationKey =
        typeof input.verificationKey === 'function'
          ? await input.verificationKey(context)
          : input.verificationKey;
      const audience = await resolveValue(input.audience, context);
      const expectedTargetId = await resolveValue(input.expectedTargetId, context);
      const expectedOutputHash = await resolveValue(input.expectedOutputHash, context);
      const expectedConsequenceHash = await resolveValue(
        input.expectedConsequenceHash,
        context,
      );
      const expectedPolicyHash = await resolveValue(input.expectedPolicyHash, context);
      const expectedPolicyVersion = await resolveValue(input.expectedPolicyVersion, context);
      const expectedPolicyIrHash = await resolveValue(input.expectedPolicyIrHash, context);
      const expectedPolicyProvenanceSource = await resolveValue(
        input.expectedPolicyProvenanceSource,
        context,
      );
      const expectedCompiledPolicyIndexVersion = await resolveValue(
        input.expectedCompiledPolicyIndexVersion,
        context,
      );
      const expectedCompiledPolicyIrVersion = await resolveValue(
        input.expectedCompiledPolicyIrVersion,
        context,
      );
      const currentDate = await resolveValue(input.currentDate, context);
      const introspector = await resolveValue(input.introspector, context);
      const usageStore = await resolveValue(input.usageStore, context);
      const consumeOnSuccess = await resolveValue(input.consumeOnSuccess, context);
      const tokenTypeHint = await resolveValue(input.tokenTypeHint, context);
      const resourceServerId = await resolveValue(input.resourceServerId, context);
      const requireSenderConstrainedToken = await resolveValue(
        input.requireSenderConstrainedToken,
        context,
      );
      const dpopHttpUri = await resolveValue(input.dpopHttpUri, context);

      const verified = await verifyReleaseAuthorization({
        token,
        verificationKey,
        audience,
        expectedTargetId,
        expectedOutputHash,
        expectedConsequenceHash,
        expectedPolicyHash,
        expectedPolicyVersion,
        expectedPolicyIrHash,
        expectedPolicyProvenanceSource,
        expectedCompiledPolicyIndexVersion,
        expectedCompiledPolicyIrVersion,
        currentDate,
        introspector,
        usageStore,
        consumeOnSuccess,
        tokenTypeHint,
        resourceServerId,
        requireSenderConstrainedToken,
        dpopProofJwt: context.req.header(dpopProofHeaderName) ?? null,
        dpopHttpMethod: context.req.method,
        dpopHttpUri: dpopHttpUri ?? context.req.url,
      });

      context.set(contextKey, verified);
      await next();
    } catch (error) {
      if (error instanceof ReleaseVerificationError) {
        context.header('WWW-Authenticate', error.challenge);
        return context.json(error.toResponseBody(), error.status);
      }

      const description =
        error instanceof Error ? error.message : 'Release verification failed unexpectedly.';
      const failure = new ReleaseVerificationError(
        401,
        'invalid_token',
        description,
        buildBearerChallenge('invalid_token', description),
      );
      context.header('WWW-Authenticate', failure.challenge);
      return context.json(failure.toResponseBody(), failure.status);
    }
  };
}
