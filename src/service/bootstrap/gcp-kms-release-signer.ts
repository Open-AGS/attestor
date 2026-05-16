import { Buffer } from 'node:buffer';
import { createHash, verify } from 'node:crypto';
import { canonicalization } from '../../release-layer/index.js';
import {
  ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV,
} from './release-signing-provider.js';
import {
  RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_CHALLENGE,
  createExternalKmsReleaseTenantSignerDescriptor,
  createReleaseTenantSignerLiveProviderProof,
  resolveReleaseTenantSignerProviderCapability,
  type ReleaseTenantSignerDescriptor,
  type ReleaseTenantSignerLiveProviderProof,
  type ReleaseTenantSignerProviderProtectionLevel,
} from './release-tenant-signer-boundary.js';

type CanonicalReleaseJsonValue = canonicalization.CanonicalReleaseJsonValue;

export const ATTESTOR_EXTERNAL_KMS_PROVIDER_ENV = 'ATTESTOR_EXTERNAL_KMS_PROVIDER';
export const ATTESTOR_GCP_KMS_KEY_VERSION_NAME_ENV =
  'ATTESTOR_GCP_KMS_KEY_VERSION_NAME';
export const ATTESTOR_GCP_KMS_KEY_ID_ENV = 'ATTESTOR_GCP_KMS_KEY_ID';
export const ATTESTOR_GCP_KMS_PUBLIC_KEY_REF_ENV =
  'ATTESTOR_GCP_KMS_PUBLIC_KEY_REF';
export const ATTESTOR_GCP_KMS_ROTATION_REF_ENV =
  'ATTESTOR_GCP_KMS_ROTATION_REF';
export const ATTESTOR_GCP_KMS_EXPECTED_PROTECTION_LEVEL_ENV =
  'ATTESTOR_GCP_KMS_EXPECTED_PROTECTION_LEVEL';
export const GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION =
  'attestor.gcp-kms-release-signer-adapter.v1';

export interface GcpKmsReleaseTenantSignerConfig {
  readonly version: typeof GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION;
  readonly providerClass: 'gcp-kms';
  readonly tenantId: string;
  readonly keyVersionName: string;
  readonly keyId: string;
  readonly publicVerificationKeyRef: string;
  readonly expectedProtectionLevel: ReleaseTenantSignerProviderProtectionLevel;
  readonly rotationRef: string | null;
  readonly rawProviderResponseStored: false;
  readonly activatesRuntimeSigning: false;
}

export interface GcpKmsAsymmetricSignRequestEnvelope {
  readonly version: typeof GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION;
  readonly url: string;
  readonly method: 'POST';
  readonly body: {
    readonly data: string;
    readonly dataCrc32c: string;
  };
  readonly requestDigest: string;
  readonly providerNativeAlgorithm: 'EC_SIGN_ED25519';
  readonly providerSignInputMode: 'raw';
  readonly rawPayloadStored: false;
  readonly rawAccessTokenStored: false;
}

export interface GcpKmsReleaseTenantSignerProbeResult {
  readonly version: typeof GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION;
  readonly descriptor: ReleaseTenantSignerDescriptor;
  readonly proof: ReleaseTenantSignerLiveProviderProof;
  readonly providerRequestDigest: string;
  readonly providerResponseDigest: string;
  readonly providerProtectionLevel: ReleaseTenantSignerProviderProtectionLevel;
  readonly providerResponseIntegrityVerified: true;
  readonly signatureVerifiedLocally: true;
  readonly rawProviderResponseStored: false;
  readonly rawSignatureStored: false;
  readonly activatesRuntimeSigning: false;
}

export interface GcpKmsHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly json: () => Promise<unknown>;
}

export type GcpKmsHttpClient = (
  url: string,
  init: {
    readonly method: 'POST';
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
  },
) => Promise<GcpKmsHttpResponse>;

interface GcpKmsAsymmetricSignResponse {
  readonly name?: unknown;
  readonly signature?: unknown;
  readonly signatureCrc32c?: unknown;
  readonly verifiedDataCrc32c?: unknown;
  readonly protectionLevel?: unknown;
}

export class GcpKmsReleaseSignerAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GcpKmsReleaseSignerAdapterError';
  }
}

const GCP_KMS_KEY_VERSION_RE =
  /^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+\/cryptoKeyVersions\/[^/]+$/u;

const CRC32C_TABLE: readonly number[] = Object.freeze(
  Array.from({ length: 256 }, (_, index) => {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0x82f63b78 : crc >>> 1;
    }
    return crc >>> 0;
  }),
);

function digestString(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function digestBytes(value: Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function digestCanonical(value: CanonicalReleaseJsonValue): string {
  return digestString(canonicalization.canonicalizeReleaseJson(value));
}

function normalizeRequiredEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new GcpKmsReleaseSignerAdapterError(`${key} is required for GCP KMS signing.`);
  }
  return value;
}

function normalizeOptionalEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string | null {
  const value = env[key]?.trim();
  return value && value.length > 0 ? value : null;
}

function normalizeKeyVersionName(value: string): string {
  const normalized = value.trim();
  if (!GCP_KMS_KEY_VERSION_RE.test(normalized)) {
    throw new GcpKmsReleaseSignerAdapterError(
      `${ATTESTOR_GCP_KMS_KEY_VERSION_NAME_ENV} must be a full Google Cloud KMS cryptoKeyVersion resource name.`,
    );
  }
  return normalized;
}

function normalizeProtectionLevel(
  value: string | null,
): ReleaseTenantSignerProviderProtectionLevel {
  const normalized = value?.trim().toLowerCase().replace(/_/gu, '-') ?? 'hsm';
  if (
    normalized === 'hsm' ||
    normalized === 'external' ||
    normalized === 'external-vpc'
  ) {
    return normalized;
  }
  if (normalized === 'software') {
    return 'software';
  }
  throw new GcpKmsReleaseSignerAdapterError(
    `${ATTESTOR_GCP_KMS_EXPECTED_PROTECTION_LEVEL_ENV} must be hsm, external, or external-vpc for production-oriented proof.`,
  );
}

function protectionLevelFromGcp(
  value: unknown,
): ReleaseTenantSignerProviderProtectionLevel {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toUpperCase();
  if (normalized === 'HSM') return 'hsm';
  if (normalized === 'SOFTWARE') return 'software';
  if (normalized === 'EXTERNAL') return 'external';
  if (normalized === 'EXTERNAL_VPC') return 'external-vpc';
  return 'unknown';
}

function assertExpectedProtectionLevel(input: {
  readonly actual: ReleaseTenantSignerProviderProtectionLevel;
  readonly expected: ReleaseTenantSignerProviderProtectionLevel;
}): void {
  if (input.actual !== input.expected) {
    throw new GcpKmsReleaseSignerAdapterError(
      `GCP KMS protection level ${input.actual} does not match expected ${input.expected}.`,
    );
  }
  if (input.actual === 'software' || input.actual === 'unknown') {
    throw new GcpKmsReleaseSignerAdapterError(
      `GCP KMS protection level ${input.actual} cannot satisfy external signer proof.`,
    );
  }
}

function assertExternalKmsEnv(env: Readonly<Record<string, string | undefined>>): void {
  const provider = env[ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV]?.trim().toLowerCase();
  if (provider !== 'external-kms') {
    throw new GcpKmsReleaseSignerAdapterError(
      `${ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV}=external-kms is required before loading GCP KMS signer config.`,
    );
  }
  const externalProvider = env[ATTESTOR_EXTERNAL_KMS_PROVIDER_ENV]?.trim().toLowerCase();
  if (externalProvider !== 'gcp-kms') {
    throw new GcpKmsReleaseSignerAdapterError(
      `${ATTESTOR_EXTERNAL_KMS_PROVIDER_ENV}=gcp-kms is required before loading GCP KMS signer config.`,
    );
  }
}

function gcpKmsUrl(keyVersionName: string): string {
  const encodedName = keyVersionName
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://cloudkms.googleapis.com/v1/${encodedName}:asymmetricSign`;
}

function parseAsymmetricSignResponse(value: unknown): GcpKmsAsymmetricSignResponse {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new GcpKmsReleaseSignerAdapterError(
      'GCP KMS asymmetricSign returned a non-object response.',
    );
  }
  return value as GcpKmsAsymmetricSignResponse;
}

function assertResponseName(value: unknown, expected: string): string {
  if (typeof value !== 'string' || value !== expected) {
    throw new GcpKmsReleaseSignerAdapterError(
      'GCP KMS asymmetricSign response name did not match the requested key version.',
    );
  }
  return value;
}

function assertBase64Signature(value: unknown): Buffer {
  if (typeof value !== 'string' || value.length === 0) {
    throw new GcpKmsReleaseSignerAdapterError(
      'GCP KMS asymmetricSign response is missing a signature.',
    );
  }
  return Buffer.from(value, 'base64');
}

function assertCrc32cString(value: unknown, fieldName: string): string {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return String(value);
  }
  if (typeof value === 'string' && /^\d+$/u.test(value)) {
    return value;
  }
  throw new GcpKmsReleaseSignerAdapterError(
    `GCP KMS asymmetricSign response has invalid ${fieldName}.`,
  );
}

function defaultHttpClient(): GcpKmsHttpClient {
  return async (url, init) => {
    const response = await fetch(url, init);
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json() as Promise<unknown>,
    };
  };
}

export function gcpKmsCrc32cBase10(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32C_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return String((crc ^ 0xffffffff) >>> 0);
}

export function buildGcpKmsReleaseTenantSignerConfigFromEnv(input: {
  readonly tenantId: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}): GcpKmsReleaseTenantSignerConfig {
  const env = input.env ?? process.env;
  assertExternalKmsEnv(env);
  const keyVersionName = normalizeKeyVersionName(
    normalizeRequiredEnv(env, ATTESTOR_GCP_KMS_KEY_VERSION_NAME_ENV),
  );
  const keyId = normalizeRequiredEnv(env, ATTESTOR_GCP_KMS_KEY_ID_ENV);
  const publicVerificationKeyRef = normalizeRequiredEnv(
    env,
    ATTESTOR_GCP_KMS_PUBLIC_KEY_REF_ENV,
  );

  return Object.freeze({
    version: GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION,
    providerClass: 'gcp-kms' as const,
    tenantId: input.tenantId,
    keyVersionName,
    keyId,
    publicVerificationKeyRef,
    expectedProtectionLevel: normalizeProtectionLevel(
      normalizeOptionalEnv(env, ATTESTOR_GCP_KMS_EXPECTED_PROTECTION_LEVEL_ENV),
    ),
    rotationRef: normalizeOptionalEnv(env, ATTESTOR_GCP_KMS_ROTATION_REF_ENV),
    rawProviderResponseStored: false,
    activatesRuntimeSigning: false,
  });
}

export function buildGcpKmsEd25519AsymmetricSignRequest(input: {
  readonly keyVersionName: string;
  readonly payload: Uint8Array;
}): GcpKmsAsymmetricSignRequestEnvelope {
  const capability = resolveReleaseTenantSignerProviderCapability({
    providerClass: 'gcp-kms',
    algorithm: 'Ed25519',
  });
  if (
    !capability.supported ||
    capability.providerNativeAlgorithm !== 'EC_SIGN_ED25519' ||
    capability.providerSignInputMode !== 'raw'
  ) {
    throw new GcpKmsReleaseSignerAdapterError(
      'GCP KMS release signer adapter requires EC_SIGN_ED25519 with raw data input.',
    );
  }
  const keyVersionName = normalizeKeyVersionName(input.keyVersionName);
  const body = {
    data: Buffer.from(input.payload).toString('base64'),
    dataCrc32c: gcpKmsCrc32cBase10(input.payload),
  };
  const requestDigest = digestCanonical({
    version: GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION,
    providerClass: 'gcp-kms',
    method: 'POST',
    url: gcpKmsUrl(keyVersionName),
    providerNativeAlgorithm: capability.providerNativeAlgorithm,
    providerSignInputMode: capability.providerSignInputMode,
    body,
  } as CanonicalReleaseJsonValue);

  return Object.freeze({
    version: GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION,
    url: gcpKmsUrl(keyVersionName),
    method: 'POST' as const,
    body,
    requestDigest,
    providerNativeAlgorithm: 'EC_SIGN_ED25519' as const,
    providerSignInputMode: 'raw' as const,
    rawPayloadStored: false,
    rawAccessTokenStored: false,
  });
}

export async function probeGcpKmsReleaseTenantSigner(input: {
  readonly config: GcpKmsReleaseTenantSignerConfig;
  readonly publicVerificationKeyPem: string;
  readonly accessTokenProvider: () => string | Promise<string>;
  readonly httpClient?: GcpKmsHttpClient;
  readonly now?: string | null;
}): Promise<GcpKmsReleaseTenantSignerProbeResult> {
  const payload = Buffer.from(RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_CHALLENGE, 'utf8');
  const request = buildGcpKmsEd25519AsymmetricSignRequest({
    keyVersionName: input.config.keyVersionName,
    payload,
  });
  const accessToken = (await input.accessTokenProvider()).trim();
  if (!accessToken) {
    throw new GcpKmsReleaseSignerAdapterError(
      'GCP KMS access token provider returned an empty token.',
    );
  }
  const httpClient = input.httpClient ?? defaultHttpClient();
  const response = await httpClient(request.url, {
    method: request.method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(request.body),
  });
  if (!response.ok) {
    throw new GcpKmsReleaseSignerAdapterError(
      `GCP KMS asymmetricSign failed with HTTP ${response.status}.`,
    );
  }

  const rawResponse = parseAsymmetricSignResponse(await response.json());
  const responseName = assertResponseName(
    rawResponse.name,
    input.config.keyVersionName,
  );
  if (rawResponse.verifiedDataCrc32c !== true) {
    throw new GcpKmsReleaseSignerAdapterError(
      'GCP KMS did not verify the asymmetricSign request data CRC32C.',
    );
  }
  const signature = assertBase64Signature(rawResponse.signature);
  const signatureCrc32c = assertCrc32cString(
    rawResponse.signatureCrc32c,
    'signatureCrc32c',
  );
  const computedSignatureCrc32c = gcpKmsCrc32cBase10(signature);
  if (signatureCrc32c !== computedSignatureCrc32c) {
    throw new GcpKmsReleaseSignerAdapterError(
      'GCP KMS asymmetricSign signature CRC32C verification failed.',
    );
  }

  const providerProtectionLevel = protectionLevelFromGcp(rawResponse.protectionLevel);
  assertExpectedProtectionLevel({
    actual: providerProtectionLevel,
    expected: input.config.expectedProtectionLevel,
  });
  const signatureVerifiedLocally = verify(
    null,
    payload,
    input.publicVerificationKeyPem,
    signature,
  );
  if (!signatureVerifiedLocally) {
    throw new GcpKmsReleaseSignerAdapterError(
      'GCP KMS signature did not verify with the configured public key.',
    );
  }

  const providerResponseDigest = digestCanonical({
    version: GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION,
    providerClass: 'gcp-kms',
    name: responseName,
    protectionLevel: rawResponse.protectionLevel,
    signature: rawResponse.signature,
    signatureCrc32c,
    verifiedDataCrc32c: true,
  } as CanonicalReleaseJsonValue);
  const verificationDigest = digestCanonical({
    version: GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION,
    providerClass: 'gcp-kms',
    keyVersionNameDigest: digestString(input.config.keyVersionName),
    publicVerificationKeyRefDigest: digestString(input.config.publicVerificationKeyRef),
    challengeDigest: digestString(RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_CHALLENGE),
    signatureDigest: digestBytes(signature),
    signatureCrc32cVerified: true,
    providerResponseIntegrityVerified: true,
    signatureVerifiedLocally: true,
  } as CanonicalReleaseJsonValue);
  const checkedAt = input.now ? new Date(input.now).toISOString() : new Date().toISOString();
  const proof = createReleaseTenantSignerLiveProviderProof({
    tenantId: input.config.tenantId,
    providerClass: 'gcp-kms',
    keyRef: input.config.keyVersionName,
    keyId: input.config.keyId,
    algorithm: 'Ed25519',
    providerProtectionLevel,
    publicVerificationKeyRef: input.config.publicVerificationKeyRef,
    signatureDigest: digestBytes(signature),
    verificationDigest,
    providerRequestDigest: request.requestDigest,
    providerResponseDigest,
    signedAt: checkedAt,
    verifiedAt: checkedAt,
  });
  const descriptor = createExternalKmsReleaseTenantSignerDescriptor({
    tenantId: input.config.tenantId,
    providerClass: 'gcp-kms',
    keyRef: input.config.keyVersionName,
    keyId: input.config.keyId,
    algorithm: 'Ed25519',
    publicVerificationKeyRef: input.config.publicVerificationKeyRef,
    rotationRef: input.config.rotationRef,
    liveProviderProof: proof,
    nowMs: Date.parse(checkedAt),
  });

  return Object.freeze({
    version: GCP_KMS_RELEASE_SIGNER_ADAPTER_SPEC_VERSION,
    descriptor,
    proof,
    providerRequestDigest: request.requestDigest,
    providerResponseDigest,
    providerProtectionLevel,
    providerResponseIntegrityVerified: true as const,
    signatureVerifiedLocally: true as const,
    rawProviderResponseStored: false,
    rawSignatureStored: false,
    activatesRuntimeSigning: false,
  });
}
