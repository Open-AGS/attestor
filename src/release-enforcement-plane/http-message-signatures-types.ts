import type { JWK } from 'jose';
import type { IssuedReleaseToken } from '../release-kernel/release-token.js';
import type { ReleasePresentation } from './object-model.js';
import type { ReplayLedgerEntry } from './freshness.js';
import type { EnforcementFailureReason } from './types.js';

/**
 * Signed HTTP authorization envelopes.
 *
 * This module implements Attestor's RFC 9421-style detached request signature
 * path for webhook and callback boundaries. It signs stable HTTP components,
 * release-token headers, and RFC 9530 Content-Digest values so request
 * integrity survives ordinary HTTP intermediaries without turning the release
 * token back into a reusable bearer credential.
 */

export const HTTP_MESSAGE_SIGNATURE_PRESENTATION_SPEC_VERSION =
  'attestor.release-enforcement-http-message-signatures.v1';
export const HTTP_MESSAGE_SIGNATURE_LABEL = 'attestor';
export const HTTP_MESSAGE_SIGNATURE_TAG = 'attestor-release-authorization';
export const HTTP_MESSAGE_SIGNATURE_ALGORITHM = 'ed25519';
export const HTTP_MESSAGE_SIGNATURE_CONTENT_DIGEST_ALGORITHM = 'sha-256';
export const DEFAULT_HTTP_MESSAGE_SIGNATURE_MAX_AGE_SECONDS = 300;
export const DEFAULT_HTTP_MESSAGE_SIGNATURE_CLOCK_SKEW_SECONDS = 30;

export const ATTESTOR_RELEASE_TOKEN_DIGEST_HEADER = 'attestor-release-token-digest';
export const ATTESTOR_RELEASE_TOKEN_ID_HEADER = 'attestor-release-token-id';
export const ATTESTOR_RELEASE_DECISION_ID_HEADER = 'attestor-release-decision-id';
export const ATTESTOR_TARGET_ID_HEADER = 'attestor-target-id';
export const ATTESTOR_OUTPUT_HASH_HEADER = 'attestor-output-hash';
export const ATTESTOR_CONSEQUENCE_HASH_HEADER = 'attestor-consequence-hash';
export const ATTESTOR_POLICY_HASH_HEADER = 'attestor-policy-hash';
export const ATTESTOR_POLICY_VERSION_HEADER = 'attestor-policy-version';
export const ATTESTOR_POLICY_IR_HASH_HEADER = 'attestor-policy-ir-hash';
export const ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER = 'attestor-policy-provenance-source';
export const ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER =
  'attestor-compiled-policy-index-version';
export const ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER =
  'attestor-compiled-policy-ir-version';

export const DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS = Object.freeze([
  '@method',
  '@target-uri',
  'authorization',
  'content-digest',
  ATTESTOR_RELEASE_TOKEN_DIGEST_HEADER,
  ATTESTOR_TARGET_ID_HEADER,
  ATTESTOR_OUTPUT_HASH_HEADER,
  ATTESTOR_CONSEQUENCE_HASH_HEADER,
  ATTESTOR_POLICY_HASH_HEADER,
] as const);

export type HttpMessageSignatureAlgorithm = typeof HTTP_MESSAGE_SIGNATURE_ALGORITHM;

export type HttpMessageHeaderValue =
  | string
  | number
  | readonly (string | number)[]
  | null
  | undefined;

export interface HttpMessageForSignature {
  readonly method: string;
  readonly uri: string;
  readonly headers?: Readonly<Record<string, HttpMessageHeaderValue>>;
  readonly body?: string | Uint8Array | Buffer | null;
}

export interface HttpMessageSignatureKeyPair {
  readonly algorithm: HttpMessageSignatureAlgorithm;
  readonly privateJwk: JWK;
  readonly publicJwk: JWK;
  readonly publicKeyThumbprint: string;
  readonly keyId: string;
}

export interface CreateHttpMessageSignatureInput {
  readonly message: HttpMessageForSignature;
  readonly privateJwk: JWK;
  readonly publicJwk: JWK;
  readonly keyId?: string;
  readonly label?: string;
  readonly tag?: string;
  readonly algorithm?: HttpMessageSignatureAlgorithm;
  readonly coveredComponents?: readonly string[];
  readonly createdAt?: string;
  readonly expiresAt?: string | null;
  readonly nonce?: string | null;
}

export interface HttpMessageSignature {
  readonly version: typeof HTTP_MESSAGE_SIGNATURE_PRESENTATION_SPEC_VERSION;
  readonly label: string;
  readonly algorithm: HttpMessageSignatureAlgorithm;
  readonly keyId: string;
  readonly publicKeyThumbprint: string;
  readonly coveredComponents: readonly string[];
  readonly signatureInput: string;
  readonly signature: string;
  readonly signatureBase: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly nonce: string | null;
  readonly tag: string | null;
  readonly replayKey: string;
}

export interface CreateHttpAuthorizationEnvelopeInput {
  readonly request: HttpMessageForSignature;
  readonly issuedToken: IssuedReleaseToken;
  readonly privateJwk: JWK;
  readonly publicJwk: JWK;
  readonly keyId?: string;
  readonly label?: string;
  readonly tag?: string;
  readonly algorithm?: HttpMessageSignatureAlgorithm;
  readonly coveredComponents?: readonly string[];
  readonly createdAt?: string;
  readonly expiresAt?: string | null;
  readonly nonce?: string | null;
  readonly presentedAt?: string;
  readonly scope?: readonly string[];
}

export interface HttpAuthorizationEnvelope {
  readonly version: typeof HTTP_MESSAGE_SIGNATURE_PRESENTATION_SPEC_VERSION;
  readonly label: string;
  readonly algorithm: HttpMessageSignatureAlgorithm;
  readonly method: string;
  readonly uri: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly bodyDigest: string;
  readonly releaseTokenDigest: string;
  readonly signatureInput: string;
  readonly signature: string;
  readonly coveredComponents: readonly string[];
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly nonce: string | null;
  readonly keyId: string;
  readonly replayKey: string;
  readonly presentation: ReleasePresentation;
}

export interface VerifyHttpMessageSignatureInput {
  readonly message: HttpMessageForSignature;
  readonly signatureInput: string;
  readonly signature: string;
  readonly publicJwk: JWK;
  readonly label?: string;
  readonly expectedKeyId?: string | null;
  readonly expectedJwkThumbprint?: string | null;
  readonly expectedNonce?: string | null;
  readonly expectedTag?: string | null;
  readonly requiredCoveredComponents?: readonly string[];
  readonly now: string;
  readonly maxSignatureAgeSeconds?: number;
  readonly clockSkewSeconds?: number;
  readonly replayLedgerEntry?: ReplayLedgerEntry | null;
}

export interface HttpMessageSignatureVerification {
  readonly version: typeof HTTP_MESSAGE_SIGNATURE_PRESENTATION_SPEC_VERSION;
  readonly status: 'valid' | 'invalid';
  readonly checkedAt: string;
  readonly label: string;
  readonly algorithm: string | null;
  readonly keyId: string | null;
  readonly publicKeyThumbprint: string | null;
  readonly coveredComponents: readonly string[];
  readonly createdAt: string | null;
  readonly expiresAt: string | null;
  readonly nonce: string | null;
  readonly tag: string | null;
  readonly contentDigest: string | null;
  readonly replayKey: string | null;
  readonly failureReasons: readonly EnforcementFailureReason[];
}
