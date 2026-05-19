/**
 * Strict parser for release-enforcement authorization credentials.
 *
 * RFC 6750 bearer credentials are single b64token values. Authorization-like
 * release credentials are therefore rejected if header folding, duplicate
 * joining, whitespace, or parameter suffixes make the credential ambiguous.
 */

export const RELEASE_AUTHORIZATION_CREDENTIAL_SPEC_VERSION =
  'attestor.release-authorization-credential.v1';

const AUTHORIZATION_CREDENTIAL_PATTERN = /^([A-Za-z][A-Za-z0-9!#$%&'*+.^_`|~-]*)[ \t]+([A-Za-z0-9._~+/=-]+)$/u;
const RELEASE_TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]+$/u;

export function strictReleaseTokenCredential(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 && RELEASE_TOKEN_PATTERN.test(normalized) ? normalized : null;
}

export function strictAuthorizationCredential(
  value: string | null | undefined,
  allowedSchemes: readonly string[],
): {
  readonly scheme: string;
  readonly credential: string;
} | null {
  if (value === null || value === undefined) {
    return null;
  }
  const match = AUTHORIZATION_CREDENTIAL_PATTERN.exec(value.trim());
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const scheme = match[1].toLowerCase();
  const allowed = new Set(allowedSchemes.map((entry) => entry.toLowerCase()));
  if (!allowed.has(scheme)) {
    return null;
  }

  return Object.freeze({
    scheme,
    credential: match[2],
  });
}
