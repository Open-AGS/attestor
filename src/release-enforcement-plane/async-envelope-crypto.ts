import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signBytes,
  timingSafeEqual,
  verify as verifyBytes,
  type JsonWebKey,
} from 'node:crypto';
import { calculateJwkThumbprint } from 'jose';
import type { JWK } from 'jose';
import {
  ASYNC_CONSEQUENCE_ENVELOPE_ALGORITHM,
  type AsyncConsequenceEnvelopeKeyPair,
} from './async-envelope-types.js';

export function sha256Hex(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256Digest(bytes: Buffer | string): string {
  return `sha256:${sha256Hex(bytes)}`;
}

export function asyncReleaseTokenDigest(token: string): string {
  return sha256Digest(token);
}

export function publicJwkForHeader(jwk: JWK): JWK {
  const {
    d: _d,
    p: _p,
    q: _q,
    dp: _dp,
    dq: _dq,
    qi: _qi,
    k: _k,
    key_ops: _keyOps,
    ext: _ext,
    ...publicJwk
  } = jwk as JWK & Record<string, unknown>;

  return publicJwk;
}

function jwkForCrypto(jwk: JWK): JsonWebKey {
  const {
    alg: _alg,
    kid: _kid,
    use: _use,
    key_ops: _keyOps,
    ext: _ext,
    ...key
  } = jwk as JWK & Record<string, unknown>;
  return key as unknown as JsonWebKey;
}

export async function publicJwkThumbprint(publicJwk: JWK): Promise<string> {
  return calculateJwkThumbprint(publicJwkForHeader(publicJwk), 'sha256');
}

export function signEd25519(input: {
  readonly privateJwk: JWK;
  readonly bytes: Buffer;
}): Buffer {
  const privateKey = createPrivateKey({
    key: jwkForCrypto(input.privateJwk),
    format: 'jwk',
  });
  return signBytes(null, input.bytes, privateKey);
}

export function verifyEd25519(input: {
  readonly publicJwk: JWK;
  readonly bytes: Buffer;
  readonly signature: Buffer;
}): boolean {
  const publicKey = createPublicKey({
    key: jwkForCrypto(publicJwkForHeader(input.publicJwk)),
    format: 'jwk',
  });
  return verifyBytes(null, input.bytes, publicKey, input.signature);
}

export function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export async function generateAsyncConsequenceEnvelopeKeyPair(): Promise<AsyncConsequenceEnvelopeKeyPair> {
  const keyPair = generateKeyPairSync('ed25519');
  const privateJwk = keyPair.privateKey.export({ format: 'jwk' }) as JWK;
  const publicJwk = publicJwkForHeader(keyPair.publicKey.export({ format: 'jwk' }) as JWK);
  const publicKeyThumbprint = await publicJwkThumbprint(publicJwk);

  return Object.freeze({
    algorithm: ASYNC_CONSEQUENCE_ENVELOPE_ALGORITHM,
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
