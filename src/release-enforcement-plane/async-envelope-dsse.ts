import type { DsseEnvelope } from './async-envelope-types.js';
import { canonicalJson } from './async-envelope-canonical.js';
import { sha256Digest, sha256Hex } from './async-envelope-crypto.js';

export function dssePreAuthenticationEncoding(payloadType: string, payload: Buffer): Buffer {
  const payloadTypeBytes = Buffer.from(payloadType, 'utf8');
  return Buffer.concat([
    Buffer.from(`DSSEv1 ${payloadTypeBytes.byteLength} `, 'utf8'),
    payloadTypeBytes,
    Buffer.from(` ${payload.byteLength} `, 'utf8'),
    payload,
  ]);
}

export function signatureRef(input: {
  readonly keyId: string;
  readonly signature: string;
}): string {
  return `dsse:${input.keyId}:${sha256Hex(input.signature)}`;
}

export function dsseEnvelopeDigest(envelope: DsseEnvelope): string {
  return sha256Digest(canonicalJson(envelope));
}

export function replayKeyForEnvelope(envelopeDigest: string): string {
  return `signed-json-envelope:${envelopeDigest}`;
}
