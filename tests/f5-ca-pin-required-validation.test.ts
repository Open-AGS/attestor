import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  issueCertificate,
  type CertificateInput,
} from '../src/signing/certificate.js';
import { generatePkiHierarchy } from '../src/signing/pki-chain.js';
import { verifyPkiBoundCertificate } from '../src/signing/verification-trust-binding.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function certInput(): CertificateInput {
  return {
    runIdentity: 'run_f5_ca_pin_required',
    decision: 'pass',
    decisionSummary: 'F5 CA pin required validation accepted.',
    warrant: { status: 'fulfilled', obligationsFulfilled: 1, obligationsTotal: 1 },
    escrow: { state: 'released' },
    receipt: { status: 'issued' },
    capsule: { authority: 'valid' },
    evidenceChainRoot: 'root_f5_ca_pin_required',
    evidenceChainTerminal: 'terminal_f5_ca_pin_required',
    auditChainIntact: true,
    auditEntryCount: 1,
    sqlHash: 'sql_hash_f5_ca_pin_required',
    snapshotHash: 'snapshot_hash_f5_ca_pin_required',
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

function testTrustBindingRequiresOutOfBandCaPin(): void {
  const pki = generatePkiHierarchy('F5 CA Pin Test CA', 'F5 CA Pin Test Signer', 'F5 CA Pin Test Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const missingPin = verifyPkiBoundCertificate({
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: pki.chains.signer,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
  });
  const pinned = verifyPkiBoundCertificate({
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: pki.chains.signer,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
    trustedCaFingerprint: pki.ca.certificate.fingerprint,
  });
  const developerMode = verifyPkiBoundCertificate({
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: pki.chains.signer,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
    allowKitContainedCaForDeveloperMode: true,
  });

  equal(missingPin.pkiVerified, false, 'F5 CA pin validation: missing CA pin fails PKI verification');
  ok(
    missingPin.failureReasons.includes('trusted-ca-fingerprint-required'),
    'F5 CA pin validation: missing CA pin has explicit failure reason',
  );
  equal(pinned.pkiVerified, true, 'F5 CA pin validation: pinned CA verifies');
  equal(
    pinned.independentTrustRootVerified,
    true,
    'F5 CA pin validation: pinned CA establishes independent trust root',
  );
  equal(developerMode.pkiVerified, true, 'F5 CA pin validation: developer mode permits chain-integrity check');
  equal(
    developerMode.independentTrustRootVerified,
    false,
    'F5 CA pin validation: developer mode does not establish independent trust',
  );
}

function testRepositoryEvidence(): void {
  const cli = readProjectFile('src', 'signing', 'verify-cli.ts');
  const route = readProjectFile('src', 'service', 'http', 'routes', 'pipeline-verification-routes.ts');
  const docs = readProjectFile('docs', '06-signing', 'signing-verification.md');
  const auditDoc = readProjectFile('docs', 'audit', 'f5-ca-pin-required-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');

  includes(cli, '--developer-mode', 'F5 CA pin validation: CLI has explicit developer mode');
  includes(cli, 'TRUST_ROOT_REQUIRED', 'F5 CA pin validation: CLI fails closed without trust root');
  includes(
    route,
    'trustedCaFingerprint is required for independent PKI verification.',
    'F5 CA pin validation: API route requires trusted CA fingerprint',
  );
  includes(
    docs,
    'trusted CA fingerprint pinned out of band',
    'F5 CA pin validation: docs require out-of-band CA pin',
  );
  includes(
    auditDoc,
    'Status: `fixed` for the scoped repository finding.',
    'F5 CA pin validation: audit doc has scoped fixed status',
  );
  includes(
    tracker,
    'F5-A1 out-of-band trust root optional | `fixed`',
    'F5 CA pin validation: tracker marks F5-A1 fixed',
  );
  includes(
    packageJson,
    '"test:f5-ca-pin-required-validation"',
    'F5 CA pin validation: package script is exposed',
  );
}

testTrustBindingRequiresOutOfBandCaPin();
testRepositoryEvidence();

console.log(`F5 CA pin required validation tests: ${passed} passed, 0 failed`);
