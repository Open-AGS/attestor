import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  issueCertificate,
  type CertificateInput,
} from '../src/signing/certificate.js';
import { derivePublicKeyIdentity } from '../src/signing/keys.js';
import {
  generatePkiHierarchy,
  verifyTrustChain,
} from '../src/signing/pki-chain.js';
import { verifyCertificate } from '../src/signing/certificate.js';
import { registerPipelineVerificationRoutes } from '../src/service/http/routes/pipeline-verification-routes.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function certInput(): CertificateInput {
  return {
    runIdentity: 'run_pki_route_test',
    decision: 'pass',
    decisionSummary: 'PKI route test accepted.',
    warrant: { status: 'fulfilled', obligationsFulfilled: 1, obligationsTotal: 1 },
    escrow: { state: 'released' },
    receipt: { status: 'issued' },
    capsule: { authority: 'valid' },
    evidenceChainRoot: 'root_pki_route_test',
    evidenceChainTerminal: 'terminal_pki_route_test',
    auditChainIntact: true,
    auditEntryCount: 1,
    sqlHash: 'sql_hash_pki_route_test',
    snapshotHash: 'snapshot_hash_pki_route_test',
    sqlGovernance: 'pass',
    policy: 'pass',
    guardrails: 'pass',
    dataContracts: 'pass',
    scorersRun: 1,
    reviewRequired: false,
    liveProofMode: 'live_runtime',
    upstreamLive: true,
    executionLive: true,
    liveProofConsistent: true,
  };
}

function routeApp(): Hono {
  const app = new Hono();
  registerPipelineVerificationRoutes(app, {
    verifyCertificate,
    verifyTrustChain,
    derivePublicKeyIdentity,
  });
  return app;
}

async function postVerify(app: Hono, body: unknown): Promise<{
  readonly status: number;
  readonly body: Record<string, unknown>;
}> {
  const response = await app.request('/api/v1/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

async function testPkiBoundVerificationPasses(): Promise<void> {
  const pki = generatePkiHierarchy('Route Test CA', 'Route Test Signer', 'Route Test Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const result = await postVerify(routeApp(), {
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: pki.chains.signer,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
    trustedCaFingerprint: pki.ca.certificate.fingerprint,
  });

  equal(result.status, 200, 'PKI verification route: valid request returns 200');
  equal(result.body.overall, 'valid', 'PKI verification route: valid chain returns overall valid');
  equal(
    (result.body.trustBinding as { pkiVerified: boolean }).pkiVerified,
    true,
    'PKI verification route: valid chain is fully PKI verified',
  );
  equal(
    (result.body.chainVerification as { independentTrustRootVerified: boolean }).independentTrustRootVerified,
    true,
    'PKI verification route: pinned CA establishes independent trust root',
  );
}

async function testPkiBindingFailureControlsOverall(): Promise<void> {
  const pki = generatePkiHierarchy('Route Test CA', 'Route Test Signer', 'Route Test Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const tamperedChain = {
    ...pki.chains.signer,
    leaf: {
      ...pki.chains.signer.leaf,
      subjectFingerprint: '00000000000000000000000000000000',
    },
  };
  const result = await postVerify(routeApp(), {
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: tamperedChain,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
    trustedCaFingerprint: pki.ca.certificate.fingerprint,
  });

  equal(result.status, 200, 'PKI verification route: binding failure is reported as verification result');
  equal(result.body.overall, 'invalid', 'PKI verification route: PKI binding failure controls overall invalid');
  equal(
    (result.body.trustBinding as { pkiVerified: boolean }).pkiVerified,
    false,
    'PKI verification route: tampered chain is not PKI verified',
  );
  ok(
    String(result.body.explanation).includes('PKI trust binding failed'),
    'PKI verification route: explanation names trust-binding failure',
  );
}

async function testMissingTrustedCaFingerprintFailsClosed(): Promise<void> {
  const pki = generatePkiHierarchy('Route Test CA', 'Route Test Signer', 'Route Test Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const result = await postVerify(routeApp(), {
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: pki.chains.signer,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
  });

  equal(result.status, 422, 'PKI verification route: missing trusted CA fingerprint returns 422');
  equal(
    result.body.error,
    'trustedCaFingerprint is required for independent PKI verification.',
    'PKI verification route: trusted CA pin is required for third-party verification',
  );
}

async function testMissingPkiMaterialFailsClosed(): Promise<void> {
  const pki = generatePkiHierarchy('Route Test CA', 'Route Test Signer', 'Route Test Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const result = await postVerify(routeApp(), {
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
  });

  equal(result.status, 422, 'PKI verification route: missing chain material returns 422');
  equal(
    result.body.error,
    'PKI trust chain required for verification.',
    'PKI verification route: missing chain material is fail-closed',
  );
}

await testPkiBoundVerificationPasses();
await testPkiBindingFailureControlsOverall();
await testMissingTrustedCaFingerprintFailsClosed();
await testMissingPkiMaterialFailsClosed();

console.log(`pipeline-verification-routes.test.ts: ${passed} assertions passed`);
