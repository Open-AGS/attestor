import type { IssuedReleaseToken } from '../release-kernel/release-token.js';
import {
  createReleasePresentation,
  type ReleasePresentationProof,
} from './object-model.js';
import {
  ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER,
  ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER,
  ATTESTOR_CONSEQUENCE_HASH_HEADER,
  ATTESTOR_OUTPUT_HASH_HEADER,
  ATTESTOR_POLICY_HASH_HEADER,
  ATTESTOR_POLICY_IR_HASH_HEADER,
  ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER,
  ATTESTOR_POLICY_VERSION_HEADER,
  ATTESTOR_RELEASE_DECISION_ID_HEADER,
  ATTESTOR_RELEASE_TOKEN_DIGEST_HEADER,
  ATTESTOR_RELEASE_TOKEN_ID_HEADER,
  ATTESTOR_TARGET_ID_HEADER,
  DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS,
  HTTP_MESSAGE_SIGNATURE_PRESENTATION_SPEC_VERSION,
  type CreateHttpAuthorizationEnvelopeInput,
  type HttpAuthorizationEnvelope,
  type HttpMessageForSignature,
  type HttpMessageSignature,
} from './http-message-signatures-types.js';
import {
  createHttpMessageSignature,
} from './http-message-signatures-create.js';
import {
  contentDigestForBody,
  httpReleaseTokenDigest,
  normalizeHttpMessageHeaders,
  normalizeHttpMethod,
  normalizeHttpSignatureTargetUri,
} from './http-message-signatures-utils.js';

function signedEnvelopeHeaders(input: {
  readonly request: HttpMessageForSignature;
  readonly issuedToken: IssuedReleaseToken;
}): Readonly<Record<string, string>> {
  const headers = {
    ...normalizeHttpMessageHeaders(input.request.headers),
    authorization: `Bearer ${input.issuedToken.token}`,
    'content-digest': contentDigestForBody(input.request.body),
    [ATTESTOR_RELEASE_TOKEN_DIGEST_HEADER]: httpReleaseTokenDigest(input.issuedToken.token),
    [ATTESTOR_RELEASE_TOKEN_ID_HEADER]: input.issuedToken.tokenId,
    [ATTESTOR_RELEASE_DECISION_ID_HEADER]: input.issuedToken.claims.decision_id,
    [ATTESTOR_TARGET_ID_HEADER]: input.issuedToken.claims.aud,
    [ATTESTOR_OUTPUT_HASH_HEADER]: input.issuedToken.claims.output_hash,
    [ATTESTOR_CONSEQUENCE_HASH_HEADER]: input.issuedToken.claims.consequence_hash,
    [ATTESTOR_POLICY_HASH_HEADER]: input.issuedToken.claims.policy_hash,
    ...(input.issuedToken.claims.policy_version
      ? { [ATTESTOR_POLICY_VERSION_HEADER]: input.issuedToken.claims.policy_version }
      : {}),
    ...(input.issuedToken.claims.policy_ir_hash
      ? { [ATTESTOR_POLICY_IR_HASH_HEADER]: input.issuedToken.claims.policy_ir_hash }
      : {}),
    ...(input.issuedToken.claims.policy_provenance_source
      ? {
          [ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER]:
            input.issuedToken.claims.policy_provenance_source,
        }
      : {}),
    ...(input.issuedToken.claims.compiled_policy_index_version
      ? {
          [ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER]:
            input.issuedToken.claims.compiled_policy_index_version,
        }
      : {}),
    ...(input.issuedToken.claims.compiled_policy_ir_version
      ? {
          [ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER]:
            input.issuedToken.claims.compiled_policy_ir_version,
        }
      : {}),
  };

  return Object.freeze(headers);
}

function proofFromHttpSignature(signature: HttpMessageSignature): ReleasePresentationProof {
  return Object.freeze({
    kind: 'http-message-signature',
    signatureInput: signature.signatureInput,
    signature: signature.signature,
    keyId: signature.keyId,
    coveredComponents: signature.coveredComponents,
    createdAt: signature.createdAt,
    expiresAt: signature.expiresAt,
    nonce: signature.nonce,
  });
}

export async function createHttpAuthorizationEnvelope(
  input: CreateHttpAuthorizationEnvelopeInput,
): Promise<HttpAuthorizationEnvelope> {
  const headers = signedEnvelopeHeaders({
    request: input.request,
    issuedToken: input.issuedToken,
  });
  const message: HttpMessageForSignature = {
    method: input.request.method,
    uri: input.request.uri,
    headers,
    body: input.request.body,
  };
  const policyProvenanceComponents = [
    ATTESTOR_POLICY_VERSION_HEADER,
    ATTESTOR_POLICY_IR_HASH_HEADER,
    ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER,
    ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER,
    ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER,
  ].filter((component) => headers[component] !== undefined);
  const coveredComponents =
    input.coveredComponents ??
    Object.freeze([
      ...DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS,
      ...policyProvenanceComponents,
    ] as const);
  const signature = await createHttpMessageSignature({
    message,
    privateJwk: input.privateJwk,
    publicJwk: input.publicJwk,
    keyId: input.keyId,
    label: input.label,
    tag: input.tag,
    algorithm: input.algorithm,
    coveredComponents,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    nonce: input.nonce,
  });
  const finalHeaders = Object.freeze({
    ...headers,
    'signature-input': signature.signatureInput,
    signature: signature.signature,
  });
  const presentation = createReleasePresentation({
    mode: 'http-message-signature',
    presentedAt: input.presentedAt ?? signature.createdAt,
    releaseToken: input.issuedToken.token,
    releaseTokenId: input.issuedToken.tokenId,
    releaseTokenDigest: httpReleaseTokenDigest(input.issuedToken.token),
    issuer: input.issuedToken.claims.iss,
    subject: input.issuedToken.claims.sub,
    audience: input.issuedToken.claims.aud,
    expiresAt: input.issuedToken.expiresAt,
    scope: input.scope ?? input.issuedToken.claims.scope?.split(/\s+/) ?? [],
    proof: proofFromHttpSignature(signature),
  });

  return Object.freeze({
    version: HTTP_MESSAGE_SIGNATURE_PRESENTATION_SPEC_VERSION,
    label: signature.label,
    algorithm: signature.algorithm,
    method: normalizeHttpMethod(input.request.method),
    uri: normalizeHttpSignatureTargetUri(input.request.uri),
    headers: finalHeaders,
    bodyDigest: headers['content-digest'],
    releaseTokenDigest: headers[ATTESTOR_RELEASE_TOKEN_DIGEST_HEADER],
    signatureInput: signature.signatureInput,
    signature: signature.signature,
    coveredComponents: signature.coveredComponents,
    createdAt: signature.createdAt,
    expiresAt: signature.expiresAt,
    nonce: signature.nonce,
    keyId: signature.keyId,
    replayKey: signature.replayKey,
    presentation,
  });
}

export function httpMessageFromAuthorizationEnvelope(
  envelope: HttpAuthorizationEnvelope,
  body?: HttpMessageForSignature['body'],
): HttpMessageForSignature {
  return Object.freeze({
    method: envelope.method,
    uri: envelope.uri,
    headers: envelope.headers,
    body: body ?? null,
  });
}
