/**
 * Attestor Signing — Ed25519 Sign & Verify
 *
 * Signs and verifies arbitrary payloads using Ed25519.
 * Used by the certificate module to sign attestation certificates.
 */

import { sign, verify, createPrivateKey, createPublicKey } from 'node:crypto';

export const ATTESTOR_SIGNING_CANONICALIZATION_SPEC_VERSION =
  'attestor.signing-canonical-json.v1';

export type SigningCanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly SigningCanonicalJsonValue[]
  | { readonly [key: string]: SigningCanonicalJsonValue };

type SigningCanonicalJsonObject = { readonly [key: string]: SigningCanonicalJsonValue };

/**
 * Sign a payload with an Ed25519 private key.
 * Returns the signature as a hex string.
 */
export function signPayload(payload: string, privateKeyPem: string): string {
  const key = createPrivateKey(privateKeyPem);
  const signature = sign(null, Buffer.from(payload, 'utf-8'), key);
  return signature.toString('hex');
}

/**
 * Verify a payload signature with an Ed25519 public key.
 * Returns true if the signature is valid.
 */
export function verifySignature(payload: string, signatureHex: string, publicKeyPem: string): boolean {
  try {
    const key = createPublicKey(publicKeyPem);
    return verify(null, Buffer.from(payload, 'utf-8'), key, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Canonicalize an object for signing.
 * Produces deterministic, strict JSON by sorting keys recursively.
 *
 * This is Attestor-specific canonical JSON. It deliberately does not claim
 * RFC 8785/JCS interoperability, but it rejects lossy JSON.stringify inputs
 * such as undefined, functions, symbols, bigint, custom objects, NaN, and
 * Infinity before they can become signed bytes.
 */
export function canonicalize(obj: unknown): string {
  return serializeCanonicalValue(normalizeCanonicalValue(obj, '$'));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isCanonicalJsonObject(value: SigningCanonicalJsonValue): value is SigningCanonicalJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCanonicalValue(value: unknown, path: string): SigningCanonicalJsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Signing canonical JSON number must be finite at ${path}.`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item, index) => normalizeCanonicalValue(item, `${path}[${index}]`)),
    );
  }

  if (value === undefined) {
    throw new Error(`Signing canonical JSON cannot include undefined at ${path}.`);
  }

  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new Error(`Signing canonical JSON cannot include ${typeof value} at ${path}.`);
  }

  if (!isPlainObject(value)) {
    throw new Error(`Signing canonical JSON only supports plain objects at ${path}.`);
  }

  const normalizedEntries = Object.keys(value)
    .sort()
    .map((key) => {
      if (value[key] === undefined) {
        throw new Error(`Signing canonical JSON cannot include undefined at ${path}.${key}.`);
      }
      return [key, normalizeCanonicalValue(value[key], `${path}.${key}`)] as const;
    });

  return Object.freeze(
    Object.fromEntries(normalizedEntries) as SigningCanonicalJsonObject,
  );
}

function serializeCanonicalValue(value: SigningCanonicalJsonValue): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number' || typeof value === 'string') {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new Error('Signing canonical JSON serialization failed.');
    }
    return serialized;
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeCanonicalValue(item)).join(',')}]`;
  }

  if (!isCanonicalJsonObject(value)) {
    throw new Error('Only canonical JSON objects may reach object serialization.');
  }

  return serializeCanonicalObject(value);
}

function serializeCanonicalObject(value: SigningCanonicalJsonObject): string {
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${serializeCanonicalValue(value[key])}`)
    .join(',')}}`;
}
