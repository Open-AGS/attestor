import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RELEASE_TENANT_SIGNER_BOUNDARY_SPEC_VERSION,
  RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_SPEC_VERSION,
  RELEASE_TENANT_SIGNER_PROVIDER_CAPABILITY_SPEC_VERSION,
  ReleaseTenantSignerBoundaryError,
  assertReleaseTenantSignerProductionReady,
  createExternalKmsReleaseTenantSignerDescriptor,
  createFakeExternalKmsReleaseTenantSigner,
  createReleaseTenantSignerLiveProviderProof,
  createRuntimeSharedReleaseTenantSignerDescriptor,
  evaluateReleaseTenantSignerLiveProviderProof,
  releaseTenantSignerLiveProviderProofChallengeDigest,
  resolveReleaseTenantSignerProviderCapability,
} from '../src/service/bootstrap/release-tenant-signer-boundary.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to include: ${expected}`,
  );
  passed += 1;
}

function excludes(value: string, unexpected: string, message: string): void {
  assert.ok(!value.includes(unexpected), message);
  passed += 1;
}

function testRuntimeSharedSignerIsNotTenantIsolated(): void {
  const descriptor = createRuntimeSharedReleaseTenantSignerDescriptor({
    tenantId: 'tenant-a',
    providerKind: 'file-pem',
    pkiPath: '/var/lib/attestor/release-runtime-pki.json',
  });

  equal(
    descriptor.version,
    RELEASE_TENANT_SIGNER_BOUNDARY_SPEC_VERSION,
    'Tenant signer boundary: runtime descriptor exposes stable version',
  );
  equal(
    descriptor.providerClass,
    'runtime-local',
    'Tenant signer boundary: runtime signer is classified as local',
  );
  equal(
    descriptor.isolationMode,
    'tenant-claim-bound-shared-signer',
    'Tenant signer boundary: runtime signer remains claim-bound shared signer',
  );
  equal(
    descriptor.contractSatisfied,
    false,
    'Tenant signer boundary: shared runtime signer does not satisfy tenant signer contract',
  );
  equal(
    descriptor.productionReady,
    false,
    'Tenant signer boundary: shared runtime signer is not production-ready',
  );
  equal(
    descriptor.privateKeyExportable,
    true,
    'Tenant signer boundary: runtime file PEM remains exportable private key material',
  );
  ok(
    descriptor.productionBlockers.includes('runtime-shared-signer-blast-radius'),
    'Tenant signer boundary: shared runtime signer records blast-radius blocker',
  );
  equal(
    descriptor.rawTenantIdStored,
    false,
    'Tenant signer boundary: runtime descriptor stores tenant id by digest only',
  );
}

function testFakeExternalKmsSignerIsContractOnly(): void {
  const signer = createFakeExternalKmsReleaseTenantSigner({
    tenantId: 'tenant-a',
    keyRef: 'aws:kms:us-east-1:111122223333:key/tenant-a-release',
    keyId: 'release-key-v1',
  });

  equal(
    signer.descriptor.providerKind,
    'external-kms',
    'Tenant signer boundary: fake signer uses external-kms provider kind',
  );
  equal(
    signer.descriptor.providerClass,
    'fake-external-kms-test',
    'Tenant signer boundary: fake signer is explicitly test-only',
  );
  equal(
    signer.descriptor.contractSatisfied,
    true,
    'Tenant signer boundary: fake signer satisfies the descriptor contract',
  );
  equal(
    signer.descriptor.productionReady,
    false,
    'Tenant signer boundary: fake signer never claims production readiness',
  );
  equal(
    signer.descriptor.privateKeyExportable,
    false,
    'Tenant signer boundary: fake external signer descriptor is non-exportable',
  );
  equal(
    signer.descriptor.releaseTokenJoseAlgorithm,
    'EdDSA',
    'Tenant signer boundary: fake signer descriptor binds release-token JOSE algorithm',
  );
  equal(
    signer.descriptor.providerNativeAlgorithm,
    'fake-ed25519',
    'Tenant signer boundary: fake signer descriptor binds provider-native algorithm',
  );
  equal(
    signer.descriptor.providerSignInputMode,
    'raw',
    'Tenant signer boundary: fake signer descriptor binds provider input mode',
  );
  equal(
    signer.descriptor.rawTenantIdStored,
    false,
    'Tenant signer boundary: fake descriptor does not store raw tenant id',
  );
  equal(
    signer.descriptor.rawKeyRefStored,
    false,
    'Tenant signer boundary: fake descriptor does not store raw key ref',
  );
  ok(
    signer.descriptor.productionBlockers.includes('fake-external-kms-test-only'),
    'Tenant signer boundary: fake signer carries test-only production blocker',
  );

  const signature = signer.sign({
    tenantId: 'tenant-a',
    payloadDigest: 'sha256:release-payload',
    signingContextDigest: 'sha256:context',
    signedAt: '2026-05-15T09:30:00.000Z',
  });

  ok(
    signature.signature.startsWith('fake-external-kms-signature:sha256:'),
    'Tenant signer boundary: fake signature is digest-bound',
  );
  equal(
    signature.rawPayloadStored,
    false,
    'Tenant signer boundary: signature does not store raw payload',
  );
  equal(
    signature.rawTenantIdStored,
    false,
    'Tenant signer boundary: signature does not store raw tenant id',
  );
  equal(
    signature.rawKeyRefStored,
    false,
    'Tenant signer boundary: signature does not store raw key ref',
  );
  equal(
    signature.providerNativeAlgorithm,
    'fake-ed25519',
    'Tenant signer boundary: fake signature carries provider-native algorithm',
  );
  equal(
    signature.providerSignInputMode,
    'raw',
    'Tenant signer boundary: fake signature carries provider input mode',
  );
  excludes(
    signature.canonical,
    'tenant-a',
    'Tenant signer boundary: canonical signature payload does not contain raw tenant id',
  );
  excludes(
    signature.canonical,
    'aws:kms',
    'Tenant signer boundary: canonical signature payload does not contain raw key ref',
  );
}

function testFakeExternalKmsFailsClosedOnTenantMismatch(): void {
  const signer = createFakeExternalKmsReleaseTenantSigner({
    tenantId: 'tenant-a',
    keyRef: 'gcp:kms:tenant-a-release',
    keyId: 'release-key-v1',
  });

  assert.throws(
    () =>
      signer.sign({
        tenantId: 'tenant-b',
        payloadDigest: 'sha256:release-payload',
      }),
    (error: unknown) =>
      error instanceof ReleaseTenantSignerBoundaryError &&
      error.message.includes('mismatched tenant'),
    'Tenant signer boundary: fake signer refuses tenant mismatch',
  );
  passed += 1;
}

function testProviderCapabilityMapsNativeSigningAlgorithms(): void {
  const awsEd25519 = resolveReleaseTenantSignerProviderCapability({
    providerClass: 'aws-kms',
    algorithm: 'Ed25519',
  });
  equal(
    awsEd25519.version,
    RELEASE_TENANT_SIGNER_PROVIDER_CAPABILITY_SPEC_VERSION,
    'Tenant signer boundary: provider capability version is stable',
  );
  equal(
    awsEd25519.releaseTokenJoseAlgorithm,
    'EdDSA',
    'Tenant signer boundary: AWS Ed25519 maps to the release-token EdDSA JOSE algorithm',
  );
  equal(
    awsEd25519.providerNativeAlgorithm,
    'ED25519_SHA_512',
    'Tenant signer boundary: AWS Ed25519 pins the KMS native signing algorithm',
  );
  equal(
    awsEd25519.providerSignInputMode,
    'raw',
    'Tenant signer boundary: AWS Ed25519 uses raw signing input',
  );

  const gcpEs256 = resolveReleaseTenantSignerProviderCapability({
    providerClass: 'gcp-kms',
    algorithm: 'ES256',
  });
  equal(
    gcpEs256.providerNativeAlgorithm,
    'EC_SIGN_P256_SHA256',
    'Tenant signer boundary: GCP ES256 pins the Cloud KMS native algorithm',
  );
  equal(
    gcpEs256.providerSignInputMode,
    'digest-sha256',
    'Tenant signer boundary: GCP ES256 requires SHA-256 digest signing input',
  );

  const azurePs256 = resolveReleaseTenantSignerProviderCapability({
    providerClass: 'azure-managed-hsm',
    algorithm: 'PS256',
  });
  equal(
    azurePs256.providerNativeAlgorithm,
    'PS256',
    'Tenant signer boundary: Azure PS256 pins the Key Vault / Managed HSM algorithm id',
  );
  equal(
    azurePs256.providerSignInputMode,
    'digest-sha256',
    'Tenant signer boundary: Azure PS256 signs a caller-provided SHA-256 digest',
  );
}

function testUnsupportedProviderAlgorithmFailsClosed(): void {
  const azureEd25519 = resolveReleaseTenantSignerProviderCapability({
    providerClass: 'azure-key-vault',
    algorithm: 'Ed25519',
  });
  equal(
    azureEd25519.supported,
    false,
    'Tenant signer boundary: Azure Key Vault Ed25519 is not marked supported',
  );

  const descriptor = createExternalKmsReleaseTenantSignerDescriptor({
    tenantId: 'tenant-a',
    providerClass: 'azure-key-vault',
    keyRef: 'azure:key-vault:tenant-a-release',
    keyId: 'release-key-v1',
    algorithm: 'Ed25519',
    nowMs: Date.parse('2026-05-15T09:30:00.000Z'),
  });
  equal(
    descriptor.contractSatisfied,
    false,
    'Tenant signer boundary: unsupported provider algorithm does not satisfy the contract',
  );
  ok(
    descriptor.contractBlockers.includes('provider-algorithm-unsupported'),
    'Tenant signer boundary: unsupported provider algorithm blocker is explicit',
  );
  equal(
    descriptor.providerNativeAlgorithm,
    null,
    'Tenant signer boundary: unsupported provider algorithm has no native algorithm claim',
  );
  assert.throws(
    () =>
      createReleaseTenantSignerLiveProviderProof({
        tenantId: 'tenant-a',
        providerClass: 'azure-key-vault',
        keyRef: 'azure:key-vault:tenant-a-release',
        keyId: 'release-key-v1',
        algorithm: 'Ed25519',
        signatureDigest: 'sha256:azure-ed25519-signature',
        verificationDigest: 'sha256:azure-ed25519-verification',
      }),
    /does not support algorithm/u,
    'Tenant signer boundary: unsupported provider algorithm cannot produce a live proof envelope',
  );
  passed += 1;
}

function testProductionReadinessRequiresLiveProviderProof(): void {
  const checkedAt = '2026-05-15T09:30:00.000Z';
  const missingLiveProbe = createExternalKmsReleaseTenantSignerDescriptor({
    tenantId: 'tenant-a',
    providerClass: 'aws-kms',
    keyRef: 'aws:kms:us-east-1:111122223333:key/tenant-a-release',
    keyId: 'release-key-v1',
    algorithm: 'Ed25519',
    liveProviderVerified: true,
    nowMs: Date.parse(checkedAt),
  });

  equal(
    missingLiveProbe.contractSatisfied,
    true,
    'Tenant signer boundary: external KMS descriptor can satisfy static contract',
  );
  equal(
    missingLiveProbe.productionReady,
    false,
    'Tenant signer boundary: live sign/verify proof is required even if a caller passes a boolean',
  );
  equal(
    missingLiveProbe.liveProviderVerified,
    false,
    'Tenant signer boundary: live provider verification is derived from structured proof',
  );
  equal(
    missingLiveProbe.liveProviderProofState,
    'not-provided',
    'Tenant signer boundary: missing live proof state is explicit',
  );
  ok(
    missingLiveProbe.productionBlockers.includes('live-provider-sign-verify-probe-missing'),
    'Tenant signer boundary: live provider proof blocker is explicit',
  );
  assert.throws(
    () => assertReleaseTenantSignerProductionReady(missingLiveProbe),
    ReleaseTenantSignerBoundaryError,
    'Tenant signer boundary: production assert fails closed without live proof',
  );
  passed += 1;

  const liveProof = createReleaseTenantSignerLiveProviderProof({
    tenantId: 'tenant-a',
    providerClass: 'gcp-kms',
    keyRef: 'gcp:kms:projects/p/locations/us/keyRings/r/cryptoKeys/tenant-a',
    keyId: 'release-key-v1',
    algorithm: 'Ed25519',
    signatureDigest: 'sha256:gcp-signature',
    verificationDigest: 'sha256:gcp-verification',
    providerRequestDigest: 'sha256:gcp-request',
    signedAt: checkedAt,
    verifiedAt: checkedAt,
  });
  equal(
    liveProof.version,
    RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_SPEC_VERSION,
    'Tenant signer boundary: live provider proof version is stable',
  );
  equal(
    liveProof.payloadDigest,
    releaseTenantSignerLiveProviderProofChallengeDigest(),
    'Tenant signer boundary: live provider proof signs the standard challenge digest',
  );
  equal(
    liveProof.releaseTokenJoseAlgorithm,
    'EdDSA',
    'Tenant signer boundary: live provider proof binds the release-token JOSE algorithm',
  );
  equal(
    liveProof.providerNativeAlgorithm,
    'EC_SIGN_ED25519',
    'Tenant signer boundary: live provider proof binds the provider-native algorithm',
  );
  equal(
    liveProof.providerSignInputMode,
    'raw',
    'Tenant signer boundary: live provider proof binds the provider input mode',
  );
  equal(
    liveProof.rawProviderResponseStored,
    false,
    'Tenant signer boundary: live provider proof does not store raw provider response',
  );
  const proofEvaluation = evaluateReleaseTenantSignerLiveProviderProof({
    proof: liveProof,
    tenantIdDigest: liveProof.tenantIdDigest,
    providerClass: 'gcp-kms',
    keyRefDigest: liveProof.keyRefDigest,
    keyId: liveProof.keyId,
    algorithm: liveProof.algorithm,
    nowMs: Date.parse(checkedAt),
  });
  equal(
    proofEvaluation.state,
    'valid',
    'Tenant signer boundary: matching fresh proof evaluates valid',
  );

  const liveVerified = createExternalKmsReleaseTenantSignerDescriptor({
    tenantId: 'tenant-a',
    providerClass: 'gcp-kms',
    keyRef: 'gcp:kms:projects/p/locations/us/keyRings/r/cryptoKeys/tenant-a',
    keyId: 'release-key-v1',
    algorithm: 'Ed25519',
    liveProviderProof: liveProof,
    nowMs: Date.parse(checkedAt),
  });

  equal(
    liveVerified.productionReady,
    true,
    'Tenant signer boundary: production readiness is possible only with live provider proof',
  );
  equal(
    liveVerified.liveProviderVerified,
    true,
    'Tenant signer boundary: structured live proof marks provider verified',
  );
  equal(
    liveVerified.liveProviderProofDigest,
    liveProof.proofDigest,
    'Tenant signer boundary: descriptor stores live proof by digest',
  );
  equal(
    liveVerified.providerNativeAlgorithm,
    'EC_SIGN_ED25519',
    'Tenant signer boundary: descriptor records the provider-native signing algorithm',
  );
  equal(
    liveVerified.activatesRuntimeSigning,
    false,
    'Tenant signer boundary: descriptor still does not activate runtime signing',
  );
}

function testLiveProviderProofFailsClosedOnCapabilityMismatch(): void {
  const checkedAt = '2026-05-15T09:30:00.000Z';
  const proof = createReleaseTenantSignerLiveProviderProof({
    tenantId: 'tenant-a',
    providerClass: 'aws-kms',
    keyRef: 'aws:kms:us-east-1:111122223333:key/tenant-a-release',
    keyId: 'release-key-v1',
    algorithm: 'Ed25519',
    providerNativeAlgorithm: 'ED25519_PH_SHA_512',
    signatureDigest: 'sha256:aws-prehash-signature',
    verificationDigest: 'sha256:aws-prehash-verification',
    signedAt: checkedAt,
    verifiedAt: checkedAt,
  });
  const descriptor = createExternalKmsReleaseTenantSignerDescriptor({
    tenantId: 'tenant-a',
    providerClass: 'aws-kms',
    keyRef: 'aws:kms:us-east-1:111122223333:key/tenant-a-release',
    keyId: 'release-key-v1',
    algorithm: 'Ed25519',
    liveProviderProof: proof,
    nowMs: Date.parse(checkedAt),
  });

  equal(
    descriptor.liveProviderProofState,
    'invalid',
    'Tenant signer boundary: provider-native algorithm mismatch invalidates live proof',
  );
  ok(
    descriptor.productionBlockers.includes('live-provider-proof-descriptor-mismatch'),
    'Tenant signer boundary: provider-native algorithm mismatch blocks production readiness',
  );
}

function testLiveProviderProofFailsClosedOnStaleOrMismatch(): void {
  const proof = createReleaseTenantSignerLiveProviderProof({
    tenantId: 'tenant-a',
    providerClass: 'aws-kms',
    keyRef: 'aws:kms:us-east-1:111122223333:key/tenant-a-release',
    keyId: 'release-key-v1',
    algorithm: 'Ed25519',
    signatureDigest: 'sha256:aws-signature',
    verificationDigest: 'sha256:aws-verification',
    signedAt: '2026-05-13T09:30:00.000Z',
    verifiedAt: '2026-05-13T09:30:00.000Z',
  });
  const stale = createExternalKmsReleaseTenantSignerDescriptor({
    tenantId: 'tenant-a',
    providerClass: 'aws-kms',
    keyRef: 'aws:kms:us-east-1:111122223333:key/tenant-a-release',
    keyId: 'release-key-v1',
    algorithm: 'Ed25519',
    liveProviderProof: proof,
    nowMs: Date.parse('2026-05-15T09:30:00.000Z'),
  });
  equal(
    stale.liveProviderProofState,
    'stale',
    'Tenant signer boundary: stale live provider proof is named',
  );
  ok(
    stale.productionBlockers.includes('live-provider-proof-stale'),
    'Tenant signer boundary: stale proof blocks production readiness',
  );

  const mismatch = createExternalKmsReleaseTenantSignerDescriptor({
    tenantId: 'tenant-a',
    providerClass: 'aws-kms',
    keyRef: 'aws:kms:us-east-1:111122223333:key/other-tenant-release',
    keyId: 'release-key-v1',
    algorithm: 'Ed25519',
    liveProviderProof: proof,
    nowMs: Date.parse('2026-05-13T09:31:00.000Z'),
  });
  equal(
    mismatch.liveProviderProofState,
    'invalid',
    'Tenant signer boundary: mismatched live provider proof is invalid',
  );
  ok(
    mismatch.productionBlockers.includes('live-provider-proof-descriptor-mismatch'),
    'Tenant signer boundary: descriptor/proof mismatch blocks production readiness',
  );
}

function testConfidentialSignerRequiresAttestationEvidence(): void {
  const checkedAt = '2026-05-15T09:30:00.000Z';
  const missingAttestation = createExternalKmsReleaseTenantSignerDescriptor({
    tenantId: 'tenant-a',
    providerClass: 'azure-managed-hsm',
    keyRef: 'azure:managed-hsm:tenant-a-release',
    keyId: 'release-key-v1',
    algorithm: 'ES256',
    isolationMode: 'confidential-attested-tenant-kms',
    liveProviderProof: createReleaseTenantSignerLiveProviderProof({
      tenantId: 'tenant-a',
      providerClass: 'azure-managed-hsm',
      keyRef: 'azure:managed-hsm:tenant-a-release',
      keyId: 'release-key-v1',
      algorithm: 'ES256',
      signatureDigest: 'sha256:azure-signature',
      verificationDigest: 'sha256:azure-verification',
      signedAt: checkedAt,
      verifiedAt: checkedAt,
    }),
    nowMs: Date.parse(checkedAt),
    attestationRequired: true,
    attestationVerified: false,
  });

  equal(
    missingAttestation.contractSatisfied,
    false,
    'Tenant signer boundary: confidential signer contract requires attestation',
  );
  ok(
    missingAttestation.contractBlockers.includes('confidential-attestation-required'),
    'Tenant signer boundary: missing attestation blocker is explicit',
  );

  const attested = createExternalKmsReleaseTenantSignerDescriptor({
    tenantId: 'tenant-a',
    providerClass: 'azure-managed-hsm',
    keyRef: 'azure:managed-hsm:tenant-a-release',
    keyId: 'release-key-v1',
    algorithm: 'ES256',
    isolationMode: 'confidential-attested-tenant-kms',
    liveProviderProof: createReleaseTenantSignerLiveProviderProof({
      tenantId: 'tenant-a',
      providerClass: 'azure-managed-hsm',
      keyRef: 'azure:managed-hsm:tenant-a-release',
      keyId: 'release-key-v1',
      algorithm: 'ES256',
      signatureDigest: 'sha256:azure-signature',
      verificationDigest: 'sha256:azure-verification',
      signedAt: checkedAt,
      verifiedAt: checkedAt,
    }),
    nowMs: Date.parse(checkedAt),
    attestationRequired: true,
    attestationVerified: true,
    attestationEvidenceDigest: 'sha256:attestation-evidence',
  });

  equal(
    attested.contractSatisfied,
    true,
    'Tenant signer boundary: verified attestation satisfies confidential signer contract',
  );
  equal(
    attested.productionReady,
    true,
    'Tenant signer boundary: verified attestation plus live provider proof can be production-ready',
  );
}

function testKeyIdMustBeOpaque(): void {
  const descriptor = createExternalKmsReleaseTenantSignerDescriptor({
    tenantId: 'tenant-a',
    providerClass: 'aws-kms',
    keyRef: 'aws:kms:us-east-1:111122223333:key/tenant-a-release',
    keyId: 'tenant-a-release-key-v1',
    algorithm: 'Ed25519',
    liveProviderVerified: true,
  });

  equal(
    descriptor.contractSatisfied,
    false,
    'Tenant signer boundary: key ids containing raw tenant ids do not satisfy contract',
  );
  ok(
    descriptor.contractBlockers.includes('key-id-contains-raw-tenant-id'),
    'Tenant signer boundary: raw-tenant key id blocker is explicit',
  );
}

function testDocsAndPackageExposeBoundary(): void {
  const cryptoPolicy = readProjectFile('docs', '03-governance', 'cryptography-policy.md');
  const f6Validation = readProjectFile('docs', 'audit', 'f6-tenant-blast-radius-validation.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  includes(
    cryptoPolicy,
    'Tenant Signer / External KMS Boundary',
    'Tenant signer boundary: cryptography policy documents boundary',
  );
  includes(
    cryptoPolicy,
    'AWS KMS',
    'Tenant signer boundary: cryptography policy cites AWS KMS',
  );
  includes(
    cryptoPolicy,
    'structured digest-only proof',
    'Tenant signer boundary: cryptography policy requires structured proof',
  );
  includes(
    cryptoPolicy,
    'provider-native signing',
    'Tenant signer boundary: cryptography policy requires provider-native capability pinning',
  );
  includes(
    cryptoPolicy,
    'Azure Ed25519',
    'Tenant signer boundary: cryptography policy records unsupported Azure Ed25519 boundary',
  );
  includes(
    f6Validation,
    'tenant signer boundary contract',
    'Tenant signer boundary: F6 validation mentions contract slice',
  );
  includes(
    f6Validation,
    'provider-native algorithm/input-mode capability checks',
    'Tenant signer boundary: F6 validation mentions provider capability checks',
  );
  includes(
    f6Validation,
    'structured live-proof gate',
    'Tenant signer boundary: F6 validation mentions structured live proof gate',
  );
  equal(
    packageJson.scripts['test:production-tenant-signer-boundary'],
    'tsx tests/production-tenant-signer-boundary.test.ts',
    'Tenant signer boundary: focused test script is exposed',
  );
}

testRuntimeSharedSignerIsNotTenantIsolated();
testFakeExternalKmsSignerIsContractOnly();
testFakeExternalKmsFailsClosedOnTenantMismatch();
testProviderCapabilityMapsNativeSigningAlgorithms();
testUnsupportedProviderAlgorithmFailsClosed();
testProductionReadinessRequiresLiveProviderProof();
testLiveProviderProofFailsClosedOnCapabilityMismatch();
testLiveProviderProofFailsClosedOnStaleOrMismatch();
testConfidentialSignerRequiresAttestationEvidence();
testKeyIdMustBeOpaque();
testDocsAndPackageExposeBoundary();

console.log(`Production tenant signer boundary tests: ${passed} passed, 0 failed`);
