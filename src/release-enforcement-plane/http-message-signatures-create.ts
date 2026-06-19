import { createHash, generateKeyPairSync } from 'node:crypto';
import type { JWK } from 'jose';
import type { ReleaseTokenConfirmationClaim } from '../release-kernel/object-model.js';
import {
  DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS,
  DEFAULT_HTTP_MESSAGE_SIGNATURE_MAX_AGE_SECONDS,
  HTTP_MESSAGE_SIGNATURE_ALGORITHM,
  HTTP_MESSAGE_SIGNATURE_LABEL,
  HTTP_MESSAGE_SIGNATURE_PRESENTATION_SPEC_VERSION,
  HTTP_MESSAGE_SIGNATURE_TAG,
  type CreateHttpMessageSignatureInput,
  type HttpMessageSignature,
  type HttpMessageSignatureKeyPair,
} from './http-message-signatures-types.js';
import {
  parseBinaryValue,
  signatureBase,
  signatureHeaderValue,
  signatureInputHeaderValue,
  signatureParamsValue,
} from './http-message-signatures-parse.js';
import {
  publicJwkForHeader,
  publicJwkThumbprint,
  signEd25519,
} from './http-message-signatures-crypto.js';
import {
  epochSeconds,
  normalizeComponentName,
  normalizeIdentifier,
  normalizeIsoTimestamp,
} from './http-message-signatures-utils.js';

export async function generateHttpMessageSignatureKeyPair(): Promise<HttpMessageSignatureKeyPair> {
  const keyPair = generateKeyPairSync('ed25519');
  const privateJwk = keyPair.privateKey.export({ format: 'jwk' }) as JWK;
  const publicJwk = publicJwkForHeader(keyPair.publicKey.export({ format: 'jwk' }) as JWK);
  const publicKeyThumbprint = await publicJwkThumbprint(publicJwk);

  return Object.freeze({
    algorithm: HTTP_MESSAGE_SIGNATURE_ALGORITHM,
    privateJwk: Object.freeze({
      ...privateJwk,
      alg: 'EdDSA',
    }),
    publicJwk: Object.freeze({
      ...publicJwk,
      alg: 'EdDSA',
    }),
    publicKeyThumbprint,
    keyId: publicKeyThumbprint,
  });
}

export function httpMessageSignatureReplayKey(input: {
  readonly nonce?: string | null;
  readonly signature: string;
}): string {
  const nonce = input.nonce?.trim();
  if (nonce) {
    return `http-message-signature:${nonce}`;
  }

  const rawSignature = input.signature.includes('=')
    ? input.signature.slice(input.signature.indexOf('=') + 1)
    : input.signature;
  const signature = parseBinaryValue(rawSignature).toString('base64');
  return `http-message-signature:${createHash('sha256').update(signature).digest('hex')}`;
}

export function createHttpMessageSignatureReleaseTokenConfirmation(input: {
  readonly publicKeyThumbprint: string;
}): ReleaseTokenConfirmationClaim {
  return Object.freeze({
    jkt: normalizeIdentifier(input.publicKeyThumbprint, 'publicKeyThumbprint'),
  });
}

export async function createHttpMessageSignature(
  input: CreateHttpMessageSignatureInput,
): Promise<HttpMessageSignature> {
  const algorithm = input.algorithm ?? HTTP_MESSAGE_SIGNATURE_ALGORITHM;
  if (algorithm !== HTTP_MESSAGE_SIGNATURE_ALGORITHM) {
    throw new Error(`HTTP message signature unsupported algorithm: ${algorithm}`);
  }

  const label = input.label ?? HTTP_MESSAGE_SIGNATURE_LABEL;
  const createdAt = normalizeIsoTimestamp(input.createdAt ?? new Date().toISOString(), 'createdAt');
  const expiresAt =
    input.expiresAt === undefined
      ? new Date(new Date(createdAt).getTime() + DEFAULT_HTTP_MESSAGE_SIGNATURE_MAX_AGE_SECONDS * 1000).toISOString()
      : input.expiresAt === null
        ? null
        : normalizeIsoTimestamp(input.expiresAt, 'expiresAt');
  const keyId = input.keyId ?? await publicJwkThumbprint(input.publicJwk);
  const publicKeyThumbprintValue = await publicJwkThumbprint(input.publicJwk);
  const components = Object.freeze(
    (input.coveredComponents ?? DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS).map(
      normalizeComponentName,
    ),
  );
  const paramsValue = signatureParamsValue({
    components,
    created: epochSeconds(createdAt),
    expires: expiresAt === null ? null : epochSeconds(expiresAt),
    keyId,
    algorithm,
    nonce: input.nonce ?? null,
    tag: input.tag ?? HTTP_MESSAGE_SIGNATURE_TAG,
  });
  const base = signatureBase(input.message, components, paramsValue);
  const signatureBytes = signEd25519({
    privateJwk: input.privateJwk,
    signatureBase: base,
  });
  const signature = signatureHeaderValue(label, signatureBytes);

  return Object.freeze({
    version: HTTP_MESSAGE_SIGNATURE_PRESENTATION_SPEC_VERSION,
    label,
    algorithm,
    keyId,
    publicKeyThumbprint: publicKeyThumbprintValue,
    coveredComponents: components,
    signatureInput: signatureInputHeaderValue(label, paramsValue),
    signature,
    signatureBase: base,
    createdAt,
    expiresAt,
    nonce: input.nonce ?? null,
    tag: input.tag ?? HTTP_MESSAGE_SIGNATURE_TAG,
    replayKey: httpMessageSignatureReplayKey({
      nonce: input.nonce,
      signature,
    }),
  });
}
