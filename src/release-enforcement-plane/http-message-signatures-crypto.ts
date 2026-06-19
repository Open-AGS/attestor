import {
  createPrivateKey,
  createPublicKey,
  sign as signBytes,
  timingSafeEqual,
  verify as verifyBytes,
  type JsonWebKey,
} from 'node:crypto';
import { calculateJwkThumbprint } from 'jose';
import type { JWK } from 'jose';

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
  readonly signatureBase: string;
}): Buffer {
  const privateKey = createPrivateKey({
    key: jwkForCrypto(input.privateJwk),
    format: 'jwk',
  });
  return signBytes(null, Buffer.from(input.signatureBase, 'utf8'), privateKey);
}

export function verifyEd25519(input: {
  readonly publicJwk: JWK;
  readonly signatureBase: string;
  readonly signature: Buffer;
}): boolean {
  const publicKey = createPublicKey({
    key: jwkForCrypto(publicJwkForHeader(input.publicJwk)),
    format: 'jwk',
  });
  return verifyBytes(
    null,
    Buffer.from(input.signatureBase, 'utf8'),
    publicKey,
    input.signature,
  );
}

export function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
