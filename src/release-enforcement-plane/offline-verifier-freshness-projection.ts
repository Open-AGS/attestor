import type { ReleaseTokenClaims } from '../release-kernel/object-model.js';
import type { ReplaySubjectKind } from './freshness.js';
import type { ReleasePresentation } from './object-model.js';

export function replaySubjectKindForPresentation(
  presentation: ReleasePresentation,
): ReplaySubjectKind {
  if (presentation.proof?.kind === 'dpop') {
    return 'dpop-proof';
  }

  if (presentation.proof?.kind === 'http-message-signature') {
    return 'http-message-signature';
  }

  if (presentation.proof?.kind === 'signed-json-envelope') {
    return 'signed-json-envelope';
  }

  return 'release-token';
}

export function replayKeyForPresentation(
  presentation: ReleasePresentation,
  claims: ReleaseTokenClaims,
): string {
  if (presentation.proof?.kind === 'dpop') {
    return `dpop-proof:${presentation.proof.proofJti}`;
  }

  if (presentation.proof?.kind === 'http-message-signature') {
    return `http-message-signature:${presentation.proof.nonce ?? presentation.proof.signature}`;
  }

  if (presentation.proof?.kind === 'signed-json-envelope') {
    return `signed-json-envelope:${presentation.proof.envelopeDigest}`;
  }

  return `release-token:${claims.jti}`;
}

export function nonceForPresentation(presentation: ReleasePresentation): string | null {
  if (presentation.proof?.kind === 'dpop') {
    return presentation.proof.nonce;
  }

  if (presentation.proof?.kind === 'http-message-signature') {
    return presentation.proof.nonce;
  }

  return null;
}

export function tokenIssuedAtIso(claims: ReleaseTokenClaims): string {
  return new Date(claims.iat * 1000).toISOString();
}

export function tokenNotBeforeIso(claims: ReleaseTokenClaims): string {
  return new Date(claims.nbf * 1000).toISOString();
}

export function tokenExpiresAtIso(claims: ReleaseTokenClaims): string {
  return new Date(claims.exp * 1000).toISOString();
}
