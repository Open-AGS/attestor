import { strict as assert } from 'node:assert';
import {
  DEFAULT_ACCEPTED_DPOP_ALGORITHMS,
  DEFAULT_DPOP_SIGNING_ALGORITHM,
  createDpopProof,
  generateDpopKeyPair,
  verifyDpopProof,
  type DpopSigningAlgorithm,
} from '../src/release-enforcement-plane/dpop.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

async function verifyProofWithAlgorithm(
  algorithm: DpopSigningAlgorithm,
  acceptedAlgorithms?: readonly DpopSigningAlgorithm[],
): Promise<'valid' | 'invalid'> {
  const keyPair = await generateDpopKeyPair(algorithm);
  const proof = await createDpopProof({
    privateJwk: keyPair.privateJwk,
    publicJwk: keyPair.publicJwk,
    algorithm,
    httpMethod: 'POST',
    httpUri: `https://api.attestor.test/dpop-${algorithm.toLowerCase()}`,
    accessToken: 'release-token-value',
    proofJti: `dpop-default-policy-${algorithm.toLowerCase()}`,
    issuedAt: '2026-04-18T11:01:00.000Z',
  });
  const verified = await verifyDpopProof({
    proofJwt: proof.proofJwt,
    httpMethod: 'POST',
    httpUri: proof.httpUri,
    accessToken: 'release-token-value',
    expectedJwkThumbprint: keyPair.publicKeyThumbprint,
    now: '2026-04-18T11:01:10.000Z',
    ...(acceptedAlgorithms ? { acceptedAlgorithms } : {}),
  });

  return verified.status;
}

async function main(): Promise<void> {
  deepEqual(
    DEFAULT_ACCEPTED_DPOP_ALGORITHMS,
    [DEFAULT_DPOP_SIGNING_ALGORITHM, 'EdDSA'],
    'DPoP default policy: default accepted algorithms stay ES256 plus EdDSA',
  );
  ok(
    Object.isFrozen(DEFAULT_ACCEPTED_DPOP_ALGORITHMS),
    'DPoP default policy: accepted algorithm default is frozen at module scope',
  );

  equal(
    await verifyProofWithAlgorithm(DEFAULT_DPOP_SIGNING_ALGORITHM),
    'valid',
    'DPoP default policy: ES256 proof verifies under the default allowlist',
  );
  equal(
    await verifyProofWithAlgorithm('EdDSA'),
    'valid',
    'DPoP default policy: EdDSA proof verifies under the default allowlist',
  );
  equal(
    await verifyProofWithAlgorithm('RS256'),
    'invalid',
    'DPoP default policy: RS256 is not accepted unless explicitly configured',
  );
  equal(
    await verifyProofWithAlgorithm('RS256', [...DEFAULT_ACCEPTED_DPOP_ALGORITHMS, 'RS256']),
    'valid',
    'DPoP default policy: explicit caller allowlist expansion can accept RS256',
  );

  console.log(`\nRelease enforcement-plane DPoP default-policy tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease enforcement-plane DPoP default-policy tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
