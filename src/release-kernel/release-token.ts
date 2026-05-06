import { randomUUID } from 'node:crypto';
import { SignJWT, exportJWK, importPKCS8, importSPKI, jwtVerify, errors as joseErrors } from 'jose';
import type { JWK, JWTHeaderParameters } from 'jose';
import type {
  ReleaseDecision,
  ReleaseTokenActorClaim,
  ReleaseTokenClaims,
  ReleaseTokenConfirmationClaim,
} from './object-model.js';
import {
  buildReleaseTokenClaims,
  defaultReleaseTokenTtlSecondsForRiskClass,
  releaseDecisionExpiresAt,
} from './object-model.js';
import { derivePublicKeyIdentity } from '../signing/keys.js';

/**
 * Signed release token issuance.
 *
 * This module turns accepted release decisions into short-lived JWT/JWS
 * artifacts that downstream systems can later verify and enforce. Step 12 is
 * intentionally about issuance and cryptographic integrity; the downstream SDK
 * and middleware wrappers arrive in the next step.
 */

export const RELEASE_TOKEN_ISSUANCE_SPEC_VERSION = 'attestor.release-token-issuance.v1';
export const RELEASE_TOKEN_VERIFICATION_KEY_SPEC_VERSION =
  'attestor.release-token-verification-key.v1';
export const RELEASE_TOKEN_VERIFICATION_SPEC_VERSION = 'attestor.release-token-verification.v1';

export type ReleaseTokenSigningAlgorithm = 'EdDSA';

export interface CreateReleaseTokenIssuerInput {
  readonly issuer: string;
  readonly privateKeyPem: string;
  readonly publicKeyPem: string;
  readonly keyId?: string;
  readonly algorithm?: ReleaseTokenSigningAlgorithm;
  readonly overrideAuthorityRoles?: readonly string[];
}

export interface CreateReleaseTokenVerificationKeyInput {
  readonly issuer: string;
  readonly publicKeyPem: string;
  readonly keyId?: string;
  readonly algorithm?: ReleaseTokenSigningAlgorithm;
}

export interface ReleaseTokenIssueInput {
  readonly decision: ReleaseDecision;
  readonly subject?: string;
  readonly issuedAt?: string;
  readonly tokenId?: string;
  readonly ttlSeconds?: number;
  readonly audience?: string;
  readonly scope?: string;
  readonly resource?: string;
  readonly actor?: ReleaseTokenActorClaim;
  readonly parentTokenId?: string;
  readonly exchangeId?: string;
  readonly exchangedAt?: string;
  readonly sourceAudience?: string;
  readonly tokenUse?: ReleaseTokenClaims['token_use'];
  readonly confirmation?: ReleaseTokenConfirmationClaim;
}

export interface IssuedReleaseToken {
  readonly version: typeof RELEASE_TOKEN_ISSUANCE_SPEC_VERSION;
  readonly tokenId: string;
  readonly token: string;
  readonly claims: ReleaseTokenClaims;
  readonly keyId: string;
  readonly algorithm: ReleaseTokenSigningAlgorithm;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly publicKeyFingerprint: string;
}

export interface ReleaseTokenVerificationKey {
  readonly version: typeof RELEASE_TOKEN_VERIFICATION_KEY_SPEC_VERSION;
  readonly issuer: string;
  readonly algorithm: ReleaseTokenSigningAlgorithm;
  readonly keyId: string;
  readonly publicKeyFingerprint: string;
  readonly publicKeyPem: string;
  readonly jwk: JWK;
}

export interface ReleaseTokenJwks {
  readonly keys: readonly JWK[];
}

export interface VerifyReleaseTokenInput {
  readonly token: string;
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly audience?: string;
  readonly currentDate?: string;
}

export interface ReleaseTokenVerificationResult {
  readonly version: typeof RELEASE_TOKEN_VERIFICATION_SPEC_VERSION;
  readonly valid: true;
  readonly claims: ReleaseTokenClaims;
  readonly protectedHeader: JWTHeaderParameters;
  readonly keyId: string | null;
  readonly publicKeyFingerprint: string;
}

export type ReleaseTokenVerificationFailureCode = 'expired' | 'invalid';

export class ReleaseTokenVerificationFailure extends Error {
  readonly code: ReleaseTokenVerificationFailureCode;

  constructor(code: ReleaseTokenVerificationFailureCode, message: string) {
    super(message);
    this.name = 'ReleaseTokenVerificationFailure';
    this.code = code;
  }
}

export interface ReleaseTokenIssuer {
  issue(input: ReleaseTokenIssueInput): Promise<IssuedReleaseToken>;
  exportVerificationKey(): Promise<ReleaseTokenVerificationKey>;
}

export const DEFAULT_RELEASE_TOKEN_OVERRIDE_AUTHORITY_ROLES = Object.freeze([
  'policy-admin',
  'risk-owner',
  'compliance-officer',
  'security-admin',
  'incident-commander',
  'financial_reporting_manager',
] as const);

export async function createReleaseTokenVerificationKey(
  input: CreateReleaseTokenVerificationKeyInput,
): Promise<ReleaseTokenVerificationKey> {
  const algorithm = input.algorithm ?? 'EdDSA';
  const keyIdentity = derivePublicKeyIdentity(input.publicKeyPem);
  const keyId = input.keyId ?? keyIdentity.fingerprint;
  const publicKey = await importSPKI(input.publicKeyPem, algorithm);
  const jwk = await exportJWK(publicKey);

  return {
    version: RELEASE_TOKEN_VERIFICATION_KEY_SPEC_VERSION,
    issuer: input.issuer,
    algorithm,
    keyId,
    publicKeyFingerprint: keyIdentity.fingerprint,
    publicKeyPem: input.publicKeyPem,
    jwk: {
      ...jwk,
      kid: keyId,
      use: 'sig',
      alg: algorithm,
    },
  };
}

function isExpiredJoseError(error: unknown): boolean {
  return (
    error instanceof joseErrors.JWTExpired ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ERR_JWT_EXPIRED')
  );
}

function normalizeRole(role: string | undefined): string {
  return role?.trim().toLowerCase() ?? '';
}

function assertDecisionEligibleForReleaseToken(
  decision: ReleaseDecision,
  overrideAuthorityRoles: readonly string[],
): void {
  if (decision.status !== 'accepted' && decision.status !== 'overridden') {
    throw new Error(
      `Release token issuance requires an accepted or overridden decision, received ${decision.status}.`,
    );
  }
  if (decision.status !== 'overridden') {
    return;
  }
  if (!decision.override) {
    throw new Error('Overridden release token issuance requires an explicit override grant.');
  }
  if (!decision.override.reasonCode.trim()) {
    throw new Error('Overridden release token issuance requires an override reasonCode.');
  }
  const overrideRole = normalizeRole(decision.override.requestedBy.role);
  if (!overrideRole) {
    throw new Error('Overridden release token issuance requires an override requester role.');
  }
  const allowedRoles = new Set(
    (decision.reviewAuthority.requiredRoles.length > 0
      ? decision.reviewAuthority.requiredRoles
      : overrideAuthorityRoles
    ).map(normalizeRole),
  );
  if (!allowedRoles.has(overrideRole)) {
    throw new Error(
      `Overridden release token issuance requires an authorized override requester role, received ${decision.override.requestedBy.role}.`,
    );
  }
}

function parseIssuedAt(issuedAt?: string): Date {
  const value = issuedAt ? new Date(issuedAt) : new Date();
  if (Number.isNaN(value.getTime())) {
    throw new Error('Release token issuance requires a valid issuedAt timestamp.');
  }

  return value;
}

function parseOptionalEpochSeconds(value: string | undefined, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Release token issuance requires a valid ${fieldName} timestamp.`);
  }

  return Math.floor(parsed.getTime() / 1000);
}

function resolveTokenTtlSeconds(decision: ReleaseDecision, issuedAt: Date, requestedTtl?: number): number {
  const maxExpiry = releaseDecisionExpiresAt(decision);

  if (requestedTtl !== undefined && requestedTtl <= 0) {
    throw new Error('Release token issuance requires ttlSeconds to be positive when provided.');
  }

  if (!maxExpiry) {
    return requestedTtl ?? defaultReleaseTokenTtlSecondsForRiskClass(decision.riskClass);
  }

  const decisionExpiry = new Date(maxExpiry);
  if (Number.isNaN(decisionExpiry.getTime())) {
    throw new Error('Release decision expiry is invalid and cannot be used for token issuance.');
  }

  const maxAllowedTtl = Math.floor((decisionExpiry.getTime() - issuedAt.getTime()) / 1000);
  if (maxAllowedTtl <= 0) {
    throw new Error('Release decision is already expired for token issuance.');
  }

  return requestedTtl === undefined ? maxAllowedTtl : Math.min(requestedTtl, maxAllowedTtl);
}

export function createReleaseTokenIssuer(
  input: CreateReleaseTokenIssuerInput,
): ReleaseTokenIssuer {
  const algorithm = input.algorithm ?? 'EdDSA';
  const keyIdentity = derivePublicKeyIdentity(input.publicKeyPem);
  const keyId = input.keyId ?? keyIdentity.fingerprint;
  const overrideAuthorityRoles =
    input.overrideAuthorityRoles ?? DEFAULT_RELEASE_TOKEN_OVERRIDE_AUTHORITY_ROLES;

  return {
    async issue(issueInput: ReleaseTokenIssueInput): Promise<IssuedReleaseToken> {
      assertDecisionEligibleForReleaseToken(issueInput.decision, overrideAuthorityRoles);
      const issuedAt = parseIssuedAt(issueInput.issuedAt);
      const issuedAtEpochSeconds = Math.floor(issuedAt.getTime() / 1000);
      const ttlSeconds = resolveTokenTtlSeconds(
        issueInput.decision,
        issuedAt,
        issueInput.ttlSeconds,
      );
      const tokenId = issueInput.tokenId ?? `rt_${randomUUID()}`;
      const claims = buildReleaseTokenClaims({
        issuer: input.issuer,
        subject: issueInput.subject ?? `releaseDecision:${issueInput.decision.id}`,
        tokenId,
        issuedAtEpochSeconds,
        ttlSeconds,
        decision: issueInput.decision,
        audience: issueInput.audience,
        scope: issueInput.scope,
        resource: issueInput.resource,
        actor: issueInput.actor,
        parentTokenId: issueInput.parentTokenId,
        exchangeId: issueInput.exchangeId,
        exchangedAtEpochSeconds: parseOptionalEpochSeconds(
          issueInput.exchangedAt,
          'exchangedAt',
        ),
        sourceAudience: issueInput.sourceAudience,
        tokenUse: issueInput.tokenUse,
        confirmation: issueInput.confirmation,
      });

      const privateKey = await importPKCS8(input.privateKeyPem, algorithm);
      const token = await new SignJWT(claims as unknown as Record<string, unknown>)
        .setProtectedHeader({
          alg: algorithm,
          kid: keyId,
          typ: 'JWT',
        })
        .sign(privateKey);

      return {
        version: RELEASE_TOKEN_ISSUANCE_SPEC_VERSION,
        tokenId,
        token,
        claims,
        keyId,
        algorithm,
        issuedAt: new Date(claims.iat * 1000).toISOString(),
        expiresAt: new Date(claims.exp * 1000).toISOString(),
        publicKeyFingerprint: keyIdentity.fingerprint,
      };
    },

    async exportVerificationKey(): Promise<ReleaseTokenVerificationKey> {
      return createReleaseTokenVerificationKey({
        issuer: input.issuer,
        publicKeyPem: input.publicKeyPem,
        keyId,
        algorithm,
      });
    },
  };
}

function releaseTokenVerificationKeyToJwk(
  verificationKey: ReleaseTokenVerificationKey,
): JWK {
  const {
    d: _d,
    p: _p,
    q: _q,
    dp: _dp,
    dq: _dq,
    qi: _qi,
    k: _k,
    ...publicJwk
  } = verificationKey.jwk as JWK & Record<string, unknown>;

  return Object.freeze({
    ...publicJwk,
    kid: verificationKey.keyId,
    use: 'sig',
    alg: verificationKey.algorithm,
    key_ops: ['verify'],
  });
}

export function releaseTokenVerificationKeysToJwks(
  verificationKeys: readonly ReleaseTokenVerificationKey[],
): ReleaseTokenJwks {
  const seen = new Set<string>();
  const keys = verificationKeys.flatMap((verificationKey) => {
    if (seen.has(verificationKey.keyId)) {
      return [];
    }
    seen.add(verificationKey.keyId);
    return [releaseTokenVerificationKeyToJwk(verificationKey)];
  });

  return {
    keys,
  };
}

export function releaseTokenVerificationKeyToJwks(
  verificationKey: ReleaseTokenVerificationKey,
): ReleaseTokenJwks {
  return releaseTokenVerificationKeysToJwks([verificationKey]);
}

export async function verifyIssuedReleaseToken(
  input: VerifyReleaseTokenInput,
): Promise<ReleaseTokenVerificationResult> {
  const publicKey = await importSPKI(
    input.verificationKey.publicKeyPem,
    input.verificationKey.algorithm,
  );

  let verified;
  try {
    verified = await jwtVerify(input.token, publicKey, {
      issuer: input.verificationKey.issuer,
      audience: input.audience,
      currentDate: input.currentDate ? new Date(input.currentDate) : undefined,
    });
  } catch (error) {
    if (isExpiredJoseError(error)) {
      throw new ReleaseTokenVerificationFailure('expired', 'Release token has expired.');
    }

    const message =
      error instanceof Error ? error.message : 'Release token verification failed.';
    throw new ReleaseTokenVerificationFailure('invalid', message);
  }

  if (verified.protectedHeader.alg !== input.verificationKey.algorithm) {
    throw new ReleaseTokenVerificationFailure(
      'invalid',
      'Release token protected header algorithm does not match the verification key.',
    );
  }

  if (verified.protectedHeader.kid !== input.verificationKey.keyId) {
    throw new ReleaseTokenVerificationFailure(
      'invalid',
      'Release token protected header kid does not match the verification key.',
    );
  }

  return {
    version: RELEASE_TOKEN_VERIFICATION_SPEC_VERSION,
    valid: true,
    claims: verified.payload as unknown as ReleaseTokenClaims,
    protectedHeader: verified.protectedHeader,
    keyId: verified.protectedHeader.kid ?? null,
    publicKeyFingerprint: input.verificationKey.publicKeyFingerprint,
  };
}
