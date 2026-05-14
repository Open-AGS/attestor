import assert from 'node:assert/strict';
import {
  issueCertificate,
  type CertificateInput,
} from '../src/signing/certificate.js';
import { generatePkiHierarchy } from '../src/signing/pki-chain.js';
import { verifyPkiBoundCertificate } from '../src/signing/verification-trust-binding.js';

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
    runIdentity: 'run_pki_trust_binding_test',
    decision: 'pass',
    decisionSummary: 'PKI trust binding test accepted.',
    warrant: { status: 'fulfilled', obligationsFulfilled: 1, obligationsTotal: 1 },
    escrow: { state: 'released' },
    receipt: { status: 'issued' },
    capsule: { authority: 'valid' },
    evidenceChainRoot: 'root_pki_trust_binding_test',
    evidenceChainTerminal: 'terminal_pki_trust_binding_test',
    auditChainIntact: true,
    auditEntryCount: 1,
    sqlHash: 'sql_hash_pki_trust_binding_test',
    snapshotHash: 'snapshot_hash_pki_trust_binding_test',
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

function testValidTrustBindingWithPinnedCa(): void {
  const pki = generatePkiHierarchy('Trust Binding CA', 'Trust Binding Signer', 'Trust Binding Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const result = verifyPkiBoundCertificate({
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: pki.chains.signer,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
    trustedCaFingerprint: pki.ca.certificate.fingerprint,
  });

  equal(result.pkiVerified, true, 'PKI trust binding: valid pinned CA verifies');
  equal(result.trustedCaFingerprintMatch, true, 'PKI trust binding: CA pin matches');
  equal(result.failureReasons.length, 0, 'PKI trust binding: valid chain has no failure reasons');
}

function testTrustedCaFingerprintMismatchFailsBinding(): void {
  const pki = generatePkiHierarchy('Trust Binding CA', 'Trust Binding Signer', 'Trust Binding Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const result = verifyPkiBoundCertificate({
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: pki.chains.signer,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
    trustedCaFingerprint: 'ffffffffffffffff',
  });

  equal(result.pkiVerified, false, 'PKI trust binding: mismatched CA pin fails verification');
  equal(result.trustedCaFingerprintMatch, false, 'PKI trust binding: mismatched CA pin is explicit');
  ok(
    result.failureReasons.includes('trusted-ca-fingerprint-mismatch'),
    'PKI trust binding: mismatched CA pin is recorded as a failure reason',
  );
}

function testTrustedCaFingerprintRequiredByDefault(): void {
  const pki = generatePkiHierarchy('Trust Binding CA', 'Trust Binding Signer', 'Trust Binding Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const result = verifyPkiBoundCertificate({
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: pki.chains.signer,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
  });

  equal(result.pkiVerified, false, 'PKI trust binding: missing CA pin fails by default');
  equal(
    result.independentTrustRootVerified,
    false,
    'PKI trust binding: missing CA pin does not establish independent trust',
  );
  ok(
    result.failureReasons.includes('trusted-ca-fingerprint-required'),
    'PKI trust binding: missing CA pin is recorded as required',
  );
}

function testDeveloperModeAllowsKitContainedCaWithoutIndependentTrust(): void {
  const pki = generatePkiHierarchy('Trust Binding CA', 'Trust Binding Signer', 'Trust Binding Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const result = verifyPkiBoundCertificate({
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: pki.chains.signer,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
    allowKitContainedCaForDeveloperMode: true,
  });

  equal(result.pkiVerified, true, 'PKI trust binding: developer mode permits kit-contained CA checks');
  equal(
    result.independentTrustRootVerified,
    false,
    'PKI trust binding: developer mode does not establish independent trust',
  );
  equal(result.kitContainedCaDeveloperMode, true, 'PKI trust binding: developer mode is explicit');
}

function testLeafFingerprintMismatchFailsBinding(): void {
  const pki = generatePkiHierarchy('Trust Binding CA', 'Trust Binding Signer', 'Trust Binding Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const tamperedChain = {
    ...pki.chains.signer,
    leaf: {
      ...pki.chains.signer.leaf,
      subjectFingerprint: '0000000000000000',
    },
  };
  const result = verifyPkiBoundCertificate({
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: tamperedChain,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
    trustedCaFingerprint: pki.ca.certificate.fingerprint,
  });

  equal(result.pkiVerified, false, 'PKI trust binding: tampered leaf fingerprint fails verification');
  ok(
    result.failureReasons.includes('leaf-does-not-match-signer-public-key'),
    'PKI trust binding: tampered leaf-to-key binding is recorded',
  );
  ok(
    result.failureReasons.includes('certificate-fingerprint-does-not-match-leaf'),
    'PKI trust binding: tampered leaf-to-certificate binding is recorded',
  );
}

testValidTrustBindingWithPinnedCa();
testTrustedCaFingerprintMismatchFailsBinding();
testTrustedCaFingerprintRequiredByDefault();
testDeveloperModeAllowsKitContainedCaWithoutIndependentTrust();
testLeafFingerprintMismatchFailsBinding();

console.log(`pki-trust-binding.test.ts: ${passed} assertions passed`);
