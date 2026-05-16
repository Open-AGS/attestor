import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATTESTOR_EXTERNAL_KMS_PROVIDER_ENV,
  ATTESTOR_GCP_KMS_EXPECTED_PROTECTION_LEVEL_ENV,
  ATTESTOR_GCP_KMS_KEY_ID_ENV,
  ATTESTOR_GCP_KMS_KEY_VERSION_NAME_ENV,
  ATTESTOR_GCP_KMS_PUBLIC_KEY_REF_ENV,
  ATTESTOR_GCP_KMS_ROTATION_REF_ENV,
  GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION,
  GcpKmsReleaseSignerAdapterError,
  buildGcpKmsEd25519AsymmetricSignRequest,
  buildGcpKmsReleaseTenantSignerConfigFromEnv,
  gcpKmsCrc32cBase10,
  probeGcpKmsReleaseTenantSigner,
  type GcpKmsHttpClient,
  type GcpKmsReleaseTenantSignerConfig,
} from '../src/service/bootstrap/gcp-kms-release-signer.js';
import {
  ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV,
} from '../src/service/bootstrap/release-signing-provider.js';
import {
  RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_CHALLENGE,
  releaseTenantSignerLiveProviderProofChallengeDigest,
} from '../src/service/bootstrap/release-tenant-signer-boundary.js';

let passed = 0;

const KEY_VERSION_NAME =
  'projects/prod-control/locations/europe-west4/keyRings/release-signing/cryptoKeys/release-authority/cryptoKeyVersions/1';

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to include: ${expected}\nActual: ${value}`,
  );
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function excludes(value: string, unexpected: string, message: string): void {
  assert.ok(
    !value.includes(unexpected),
    `${message}\nDid not expect to include: ${unexpected}\nActual: ${value}`,
  );
  passed += 1;
}

function config(overrides: Partial<GcpKmsReleaseTenantSignerConfig> = {}): GcpKmsReleaseTenantSignerConfig {
  return {
    version: GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION,
    providerClass: 'gcp-kms',
    tenantId: 'tenant-a',
    keyVersionName: KEY_VERSION_NAME,
    keyId: 'release-key-v1',
    publicVerificationKeyRef: `${KEY_VERSION_NAME}/publicKey`,
    expectedProtectionLevel: 'hsm',
    rotationRef: 'gcp-kms:key-version-roll-forward',
    rawProviderResponseStored: false,
    activatesRuntimeSigning: false,
    ...overrides,
  };
}

function testEnvContractIsExplicitAndProviderScoped(): void {
  const parsed = buildGcpKmsReleaseTenantSignerConfigFromEnv({
    tenantId: 'tenant-a',
    env: {
      [ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV]: 'external-kms',
      [ATTESTOR_EXTERNAL_KMS_PROVIDER_ENV]: 'gcp-kms',
      [ATTESTOR_GCP_KMS_KEY_VERSION_NAME_ENV]: KEY_VERSION_NAME,
      [ATTESTOR_GCP_KMS_KEY_ID_ENV]: 'release-key-v1',
      [ATTESTOR_GCP_KMS_PUBLIC_KEY_REF_ENV]: `${KEY_VERSION_NAME}/publicKey`,
      [ATTESTOR_GCP_KMS_ROTATION_REF_ENV]: 'gcp-kms:key-version-roll-forward',
      [ATTESTOR_GCP_KMS_EXPECTED_PROTECTION_LEVEL_ENV]: 'HSM',
    },
  });

  equal(
    parsed.providerClass,
    'gcp-kms',
    'GCP KMS adapter: env contract pins the provider class',
  );
  equal(
    parsed.expectedProtectionLevel,
    'hsm',
    'GCP KMS adapter: env contract normalizes expected protection level',
  );
  equal(
    parsed.activatesRuntimeSigning,
    false,
    'GCP KMS adapter: env config does not activate runtime issuance',
  );
  equal(
    parsed.rawProviderResponseStored,
    false,
    'GCP KMS adapter: env config records provider-response redaction boundary',
  );

  assert.throws(
    () =>
      buildGcpKmsReleaseTenantSignerConfigFromEnv({
        tenantId: 'tenant-a',
        env: {
          [ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV]: 'file-pem',
          [ATTESTOR_EXTERNAL_KMS_PROVIDER_ENV]: 'gcp-kms',
          [ATTESTOR_GCP_KMS_KEY_VERSION_NAME_ENV]: KEY_VERSION_NAME,
          [ATTESTOR_GCP_KMS_KEY_ID_ENV]: 'release-key-v1',
          [ATTESTOR_GCP_KMS_PUBLIC_KEY_REF_ENV]: `${KEY_VERSION_NAME}/publicKey`,
        },
      }),
    GcpKmsReleaseSignerAdapterError,
    'GCP KMS adapter: config fails closed unless external-kms is declared',
  );
  passed += 1;

  assert.throws(
    () =>
      buildGcpKmsReleaseTenantSignerConfigFromEnv({
        tenantId: 'tenant-a',
        env: {
          [ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV]: 'external-kms',
          [ATTESTOR_EXTERNAL_KMS_PROVIDER_ENV]: 'gcp-kms',
          [ATTESTOR_GCP_KMS_KEY_VERSION_NAME_ENV]: 'release-authority',
          [ATTESTOR_GCP_KMS_KEY_ID_ENV]: 'release-key-v1',
          [ATTESTOR_GCP_KMS_PUBLIC_KEY_REF_ENV]: `${KEY_VERSION_NAME}/publicKey`,
        },
      }),
    /full Google Cloud KMS cryptoKeyVersion resource/u,
    'GCP KMS adapter: config requires full cryptoKeyVersion resource name',
  );
  passed += 1;
}

function testEd25519RequestUsesRawDataNotDigest(): void {
  const payload = Buffer.from(RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_CHALLENGE, 'utf8');
  const request = buildGcpKmsEd25519AsymmetricSignRequest({
    keyVersionName: KEY_VERSION_NAME,
    payload,
  });

  equal(
    request.providerNativeAlgorithm,
    'EC_SIGN_ED25519',
    'GCP KMS adapter: request pins EC_SIGN_ED25519',
  );
  equal(
    request.providerSignInputMode,
    'raw',
    'GCP KMS adapter: request pins raw Ed25519 signing input',
  );
  equal(
    request.body.data,
    payload.toString('base64'),
    'GCP KMS adapter: request sends raw challenge bytes through data',
  );
  equal(
    request.body.dataCrc32c,
    gcpKmsCrc32cBase10(payload),
    'GCP KMS adapter: request carries CRC32C for input integrity',
  );
  equal(
    Object.hasOwn(request.body, 'digest'),
    false,
    'GCP KMS adapter: Ed25519 request does not use digest input',
  );
  ok(
    request.requestDigest.startsWith('sha256:'),
    'GCP KMS adapter: request is bound by digest',
  );
  equal(
    request.rawAccessTokenStored,
    false,
    'GCP KMS adapter: request digest envelope does not store access tokens',
  );
}

async function testProbeProducesDigestOnlyProof(): Promise<void> {
  const keyPair = generateKeyPairSync('ed25519');
  const publicVerificationKeyPem = keyPair.publicKey.export({
    format: 'pem',
    type: 'spki',
  }) as string;
  let capturedBody = '';
  let capturedAuthorization = '';
  const httpClient: GcpKmsHttpClient = async (_url, init) => {
    capturedBody = init.body;
    capturedAuthorization = init.headers.authorization;
    const requestBody = JSON.parse(init.body) as { data: string };
    const signature = sign(
      null,
      Buffer.from(requestBody.data, 'base64'),
      keyPair.privateKey,
    );
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: KEY_VERSION_NAME,
        signature: signature.toString('base64'),
        signatureCrc32c: gcpKmsCrc32cBase10(signature),
        verifiedDataCrc32c: true,
        protectionLevel: 'HSM',
      }),
    };
  };

  const result = await probeGcpKmsReleaseTenantSigner({
    config: config(),
    publicVerificationKeyPem,
    accessTokenProvider: () => 'ya29.test-token',
    httpClient,
    now: '2026-05-16T07:00:00.000Z',
  });

  equal(
    capturedAuthorization,
    'Bearer ya29.test-token',
    'GCP KMS adapter: live probe sends bearer token only in transport header',
  );
  includes(
    capturedBody,
    Buffer.from(RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_CHALLENGE, 'utf8').toString('base64'),
    'GCP KMS adapter: live probe sends raw challenge data for Ed25519',
  );
  equal(
    result.providerProtectionLevel,
    'hsm',
    'GCP KMS adapter: live probe maps GCP HSM protection level',
  );
  equal(
    result.proof.payloadDigest,
    releaseTenantSignerLiveProviderProofChallengeDigest(),
    'GCP KMS adapter: proof binds the standard challenge digest',
  );
  equal(
    result.proof.providerRequestDigest,
    result.providerRequestDigest,
    'GCP KMS adapter: proof records provider request by digest',
  );
  equal(
    result.proof.providerResponseDigest,
    result.providerResponseDigest,
    'GCP KMS adapter: proof records provider response by digest',
  );
  equal(
    result.proof.rawProviderResponseStored,
    false,
    'GCP KMS adapter: proof does not store raw provider response',
  );
  equal(
    result.descriptor.productionReady,
    true,
    'GCP KMS adapter: descriptor can satisfy repository-side production-oriented signer proof',
  );
  equal(
    result.descriptor.activatesRuntimeSigning,
    false,
    'GCP KMS adapter: descriptor still does not activate runtime issuance',
  );
  equal(
    result.signatureVerifiedLocally,
    true,
    'GCP KMS adapter: live probe verifies returned signature locally',
  );
  equal(
    result.rawSignatureStored,
    false,
    'GCP KMS adapter: result does not store raw signature material',
  );
  const serialized = JSON.stringify(result);
  excludes(
    serialized,
    'ya29.test-token',
    'GCP KMS adapter: result never stores the access token',
  );
  excludes(
    serialized,
    'tenant-a',
    'GCP KMS adapter: result stores tenant identity through descriptor/proof digests',
  );
}

async function testProbeFailsClosedOnProviderIntegrityProblems(): Promise<void> {
  const keyPair = generateKeyPairSync('ed25519');
  const publicVerificationKeyPem = keyPair.publicKey.export({
    format: 'pem',
    type: 'spki',
  }) as string;
  const payload = Buffer.from(RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_CHALLENGE, 'utf8');
  const signature = sign(null, payload, keyPair.privateKey);
  const baseResponse = {
    name: KEY_VERSION_NAME,
    signature: signature.toString('base64'),
    signatureCrc32c: gcpKmsCrc32cBase10(signature),
    verifiedDataCrc32c: true,
    protectionLevel: 'HSM',
  };

  const callProbe = (responseBody: Record<string, unknown>) =>
    probeGcpKmsReleaseTenantSigner({
      config: config(),
      publicVerificationKeyPem,
      accessTokenProvider: () => 'ya29.test-token',
      httpClient: async () => ({
        ok: true,
        status: 200,
        json: async () => responseBody,
      }),
      now: '2026-05-16T07:00:00.000Z',
    });

  await assert.rejects(
    () => callProbe({ ...baseResponse, protectionLevel: 'SOFTWARE' }),
    /protection level software does not match expected hsm/u,
    'GCP KMS adapter: software protection fails closed',
  );
  passed += 1;

  await assert.rejects(
    () => callProbe({ ...baseResponse, signatureCrc32c: '1' }),
    /signature CRC32C verification failed/u,
    'GCP KMS adapter: signature CRC32C mismatch fails closed',
  );
  passed += 1;

  await assert.rejects(
    () => callProbe({ ...baseResponse, name: `${KEY_VERSION_NAME}-other` }),
    /response name did not match/u,
    'GCP KMS adapter: mismatched key version response fails closed',
  );
  passed += 1;
}

function testDocsPackageAndBootstrapBoundaryStayAligned(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'gcp-kms-release-signer-adapter.md',
  );
  const releaseSigningProvider = readProjectFile(
    'src',
    'service',
    'bootstrap',
    'release-signing-provider.ts',
  );
  const deployment = readProjectFile('docs', '08-deployment', 'deployment.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '# Google Cloud KMS Release Signer Adapter',
    'EC_SIGN_ED25519',
    '`dataCrc32c`',
    '`verifiedDataCrc32c`',
    'Runtime bootstrap still fails closed',
    'not runtime release-token issuance wiring',
  ]) {
    includes(doc, expected, `GCP KMS adapter: doc records ${expected}`);
  }
  includes(
    releaseSigningProvider,
    'not wired into runtime release-token issuance yet',
    'GCP KMS adapter: bootstrap boundary still refuses external-kms fallback',
  );
  includes(
    deployment,
    'ATTESTOR_GCP_KMS_KEY_VERSION_NAME',
    'GCP KMS adapter: deployment env contract lists key version name',
  );
  equal(
    packageJson.scripts['test:gcp-kms-release-signer-adapter'],
    'tsx tests/gcp-kms-release-signer-adapter.test.ts',
    'GCP KMS adapter: package script is registered',
  );
}

async function main(): Promise<void> {
  testEnvContractIsExplicitAndProviderScoped();
  testEd25519RequestUsesRawDataNotDigest();
  await testProbeProducesDigestOnlyProof();
  await testProbeFailsClosedOnProviderIntegrityProblems();
  testDocsPackageAndBootstrapBoundaryStayAligned();

  console.log(`GCP KMS release signer adapter tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
