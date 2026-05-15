import assert from 'node:assert/strict';
import {
  createDpopProof,
  generateDpopKeyPair,
} from '../src/release-enforcement-plane/dpop.js';
import {
  HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION,
  resolveHostedGenericAdmissionDpopSenderConfirmation,
} from '../src/service/hosted-generic-admission-sender-confirmation.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

async function testValidDpopProofReturnsJktConfirmationWithoutRawProof(): Promise<void> {
  const keyPair = await generateDpopKeyPair();
  const proof = await createDpopProof({
    privateJwk: keyPair.privateJwk,
    publicJwk: keyPair.publicJwk,
    httpMethod: 'POST',
    httpUri: 'https://attestor.test/api/v1/admissions',
    proofJti: 'dpop-generic-admission-valid',
    issuedAt: '2026-05-15T09:20:00.000Z',
  });
  const result = await resolveHostedGenericAdmissionDpopSenderConfirmation({
    proofJwt: proof.proofJwt,
    httpMethod: 'POST',
    httpUri: 'https://attestor.test/api/v1/admissions',
    now: '2026-05-15T09:20:05.000Z',
  });

  equal(
    result.version,
    HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION,
    'Hosted generic sender confirmation: spec version is stable',
  );
  equal(result.status, 'valid', 'Hosted generic sender confirmation: DPoP proof is valid');
  equal(result.source, 'dpop-jkt', 'Hosted generic sender confirmation: source is DPoP jkt');
  equal(
    result.confirmation?.jkt,
    keyPair.publicKeyThumbprint,
    'Hosted generic sender confirmation: confirmation carries public key thumbprint',
  );
  equal(result.rawProofStored, false, 'Hosted generic sender confirmation: raw proof is not stored');
  equal(
    JSON.stringify(result).includes(proof.proofJwt),
    false,
    'Hosted generic sender confirmation: result serialization excludes raw DPoP JWT',
  );
}

async function testMissingDpopProofDoesNotCreateConfirmation(): Promise<void> {
  const result = await resolveHostedGenericAdmissionDpopSenderConfirmation({
    proofJwt: null,
    httpMethod: 'POST',
    httpUri: 'https://attestor.test/api/v1/admissions',
    now: '2026-05-15T09:20:05.000Z',
  });

  equal(result.status, 'missing', 'Hosted generic sender confirmation: missing proof is explicit');
  equal(result.confirmation, null, 'Hosted generic sender confirmation: missing proof has no confirmation');
  ok(
    result.reasonCodes.includes('hosted-generic-admission-dpop-missing'),
    'Hosted generic sender confirmation: missing proof reason is stable',
  );
}

async function testDpopProofMustBindToAdmissionRoute(): Promise<void> {
  const keyPair = await generateDpopKeyPair();
  const proof = await createDpopProof({
    privateJwk: keyPair.privateJwk,
    publicJwk: keyPair.publicJwk,
    httpMethod: 'POST',
    httpUri: 'https://attestor.test/api/v1/other',
    proofJti: 'dpop-generic-admission-wrong-route',
    issuedAt: '2026-05-15T09:20:00.000Z',
  });
  const result = await resolveHostedGenericAdmissionDpopSenderConfirmation({
    proofJwt: proof.proofJwt,
    httpMethod: 'POST',
    httpUri: 'https://attestor.test/api/v1/admissions',
    now: '2026-05-15T09:20:05.000Z',
  });

  equal(result.status, 'invalid', 'Hosted generic sender confirmation: wrong route is invalid');
  equal(result.confirmation, null, 'Hosted generic sender confirmation: invalid proof has no confirmation');
  ok(
    result.reasonCodes.includes('dpop-binding-mismatch'),
    'Hosted generic sender confirmation: route mismatch reason is stable',
  );
}

await testValidDpopProofReturnsJktConfirmationWithoutRawProof();
await testMissingDpopProofDoesNotCreateConfirmation();
await testDpopProofMustBindToAdmissionRoute();

console.log(`Hosted generic admission sender-confirmation tests: ${passed} passed, 0 failed`);
