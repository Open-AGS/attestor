import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../../release-kernel/release-canonicalization.js';
import type {
  ReleaseSigningProviderKind,
} from './release-signing-provider.js';

export const RELEASE_TENANT_SIGNER_BOUNDARY_SPEC_VERSION =
  'attestor.release-tenant-signer-boundary.v1';

export const RELEASE_TENANT_SIGNER_PROVIDER_CLASSES = [
  'runtime-local',
  'aws-kms',
  'gcp-kms',
  'azure-key-vault',
  'azure-managed-hsm',
  'generic-external-kms',
  'fake-external-kms-test',
] as const;
export type ReleaseTenantSignerProviderClass =
  typeof RELEASE_TENANT_SIGNER_PROVIDER_CLASSES[number];

export const RELEASE_TENANT_SIGNER_ISOLATION_MODES = [
  'shared-runtime-signer',
  'tenant-claim-bound-shared-signer',
  'per-tenant-leaf',
  'tenant-scoped-external-kms',
  'confidential-attested-tenant-kms',
] as const;
export type ReleaseTenantSignerIsolationMode =
  typeof RELEASE_TENANT_SIGNER_ISOLATION_MODES[number];

export const RELEASE_TENANT_SIGNER_ALGORITHMS = [
  'Ed25519',
  'ES256',
  'ES384',
  'PS256',
] as const;
export type ReleaseTenantSignerAlgorithm =
  typeof RELEASE_TENANT_SIGNER_ALGORITHMS[number];

export const RELEASE_TENANT_SIGNER_BOUNDARIES = [
  'runtime-memory',
  'runtime-file-pem',
  'external-kms-hsm',
] as const;
export type ReleaseTenantSignerBoundary =
  typeof RELEASE_TENANT_SIGNER_BOUNDARIES[number];

export const RELEASE_TENANT_SIGNER_ROTATION_MANAGERS = [
  'runtime-ephemeral',
  'runtime-file-store',
  'external-provider',
] as const;
export type ReleaseTenantSignerRotationManager =
  typeof RELEASE_TENANT_SIGNER_ROTATION_MANAGERS[number];

export const RELEASE_TENANT_SIGNER_CONTRACT_BLOCKERS = [
  'tenant-id-missing',
  'key-ref-missing',
  'key-id-missing',
  'key-id-contains-raw-tenant-id',
  'unsupported-algorithm',
  'non-external-signing-boundary',
  'private-key-exportable',
  'tenant-scoped-isolation-missing',
  'confidential-attestation-required',
] as const;
export type ReleaseTenantSignerContractBlocker =
  typeof RELEASE_TENANT_SIGNER_CONTRACT_BLOCKERS[number];

export const RELEASE_TENANT_SIGNER_PRODUCTION_BLOCKERS = [
  ...RELEASE_TENANT_SIGNER_CONTRACT_BLOCKERS,
  'live-provider-sign-verify-probe-missing',
  'fake-external-kms-test-only',
  'runtime-shared-signer-blast-radius',
] as const;
export type ReleaseTenantSignerProductionBlocker =
  typeof RELEASE_TENANT_SIGNER_PRODUCTION_BLOCKERS[number];

export interface CreateRuntimeSharedReleaseTenantSignerDescriptorInput {
  readonly tenantId: string;
  readonly providerKind: Exclude<ReleaseSigningProviderKind, 'external-kms'>;
  readonly pkiPath?: string | null;
}

export interface CreateExternalKmsReleaseTenantSignerDescriptorInput {
  readonly tenantId: string;
  readonly providerClass: Exclude<ReleaseTenantSignerProviderClass, 'runtime-local'>;
  readonly keyRef: string;
  readonly keyId: string;
  readonly algorithm: ReleaseTenantSignerAlgorithm;
  readonly isolationMode?: Extract<
    ReleaseTenantSignerIsolationMode,
    'tenant-scoped-external-kms' | 'confidential-attested-tenant-kms'
  > | null;
  readonly publicVerificationKeyRef?: string | null;
  readonly rotationRef?: string | null;
  readonly liveProviderVerified?: boolean | null;
  readonly attestationRequired?: boolean | null;
  readonly attestationVerified?: boolean | null;
  readonly attestationEvidenceDigest?: string | null;
  readonly testOnly?: boolean | null;
}

export interface ReleaseTenantSignerDescriptor {
  readonly version: typeof RELEASE_TENANT_SIGNER_BOUNDARY_SPEC_VERSION;
  readonly providerKind: ReleaseSigningProviderKind;
  readonly providerClass: ReleaseTenantSignerProviderClass;
  readonly tenantIdDigest: string;
  readonly keyId: string | null;
  readonly keyRefDigest: string | null;
  readonly publicVerificationKeyRefDigest: string | null;
  readonly algorithm: ReleaseTenantSignerAlgorithm | null;
  readonly isolationMode: ReleaseTenantSignerIsolationMode;
  readonly signingBoundary: ReleaseTenantSignerBoundary;
  readonly privateKeyExportable: boolean;
  readonly rotationManagedBy: ReleaseTenantSignerRotationManager;
  readonly rotationRefDigest: string | null;
  readonly liveProviderVerified: boolean;
  readonly attestationRequired: boolean;
  readonly attestationVerified: boolean;
  readonly attestationEvidenceDigest: string | null;
  readonly testOnly: boolean;
  readonly contractSatisfied: boolean;
  readonly productionReady: boolean;
  readonly noLocalFallback: true;
  readonly rawTenantIdStored: false;
  readonly rawKeyRefStored: false;
  readonly rawPayloadStored: false;
  readonly activatesRuntimeSigning: false;
  readonly protectedPrinciples: readonly [
    'tenant isolation',
    'release provenance',
    'fail-closed boundary',
  ];
  readonly contractBlockers: readonly ReleaseTenantSignerContractBlocker[];
  readonly productionBlockers: readonly ReleaseTenantSignerProductionBlocker[];
}

export interface ReleaseTenantSignerPayload {
  readonly tenantId: string;
  readonly payloadDigest: string;
  readonly signingContextDigest?: string | null;
  readonly signedAt?: string | null;
}

export interface ReleaseTenantSignature {
  readonly version: typeof RELEASE_TENANT_SIGNER_BOUNDARY_SPEC_VERSION;
  readonly tenantIdDigest: string;
  readonly payloadDigest: string;
  readonly signingContextDigest: string | null;
  readonly keyId: string;
  readonly keyRefDigest: string;
  readonly algorithm: ReleaseTenantSignerAlgorithm;
  readonly signingBoundary: Extract<ReleaseTenantSignerBoundary, 'external-kms-hsm'>;
  readonly signedAt: string;
  readonly signature: string;
  readonly descriptorDigest: string;
  readonly rawTenantIdStored: false;
  readonly rawKeyRefStored: false;
  readonly rawPayloadStored: false;
  readonly productionReady: boolean;
  readonly testOnly: boolean;
  readonly canonical: string;
  readonly digest: string;
}

export interface FakeExternalKmsReleaseTenantSigner {
  readonly descriptor: ReleaseTenantSignerDescriptor;
  readonly sign: (payload: ReleaseTenantSignerPayload) => ReleaseTenantSignature;
}

export class ReleaseTenantSignerBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReleaseTenantSignerBoundaryError';
  }
}

function digestString(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function digestCanonical(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: digestString(canonical),
  });
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ReleaseTenantSignerBoundaryError(
      `Release tenant signer boundary ${fieldName} requires a string.`,
    );
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new ReleaseTenantSignerBoundaryError(
      `Release tenant signer boundary ${fieldName} requires a non-empty value.`,
    );
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  const normalized = normalizeIdentifier(value, fieldName);
  if (!normalized.startsWith('sha256:')) {
    throw new ReleaseTenantSignerBoundaryError(
      `Release tenant signer boundary ${fieldName} must be a sha256 digest reference.`,
    );
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string | null | undefined): string {
  const raw = value ?? new Date().toISOString();
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new ReleaseTenantSignerBoundaryError(
      'Release tenant signer boundary signedAt must be an ISO timestamp.',
    );
  }
  return timestamp.toISOString();
}

function assertAlgorithm(value: ReleaseTenantSignerAlgorithm): void {
  if (!RELEASE_TENANT_SIGNER_ALGORITHMS.includes(value)) {
    throw new ReleaseTenantSignerBoundaryError(
      `Release tenant signer boundary algorithm must be one of: ${RELEASE_TENANT_SIGNER_ALGORITHMS.join(', ')}.`,
    );
  }
}

function descriptorDigest(descriptor: ReleaseTenantSignerDescriptor): string {
  return digestCanonical({
    version: descriptor.version,
    providerKind: descriptor.providerKind,
    providerClass: descriptor.providerClass,
    tenantIdDigest: descriptor.tenantIdDigest,
    keyId: descriptor.keyId,
    keyRefDigest: descriptor.keyRefDigest,
    publicVerificationKeyRefDigest: descriptor.publicVerificationKeyRefDigest,
    algorithm: descriptor.algorithm,
    isolationMode: descriptor.isolationMode,
    signingBoundary: descriptor.signingBoundary,
    privateKeyExportable: descriptor.privateKeyExportable,
    rotationManagedBy: descriptor.rotationManagedBy,
    rotationRefDigest: descriptor.rotationRefDigest,
    liveProviderVerified: descriptor.liveProviderVerified,
    attestationRequired: descriptor.attestationRequired,
    attestationVerified: descriptor.attestationVerified,
    attestationEvidenceDigest: descriptor.attestationEvidenceDigest,
    testOnly: descriptor.testOnly,
    contractSatisfied: descriptor.contractSatisfied,
    productionReady: descriptor.productionReady,
    contractBlockers: descriptor.contractBlockers,
    productionBlockers: descriptor.productionBlockers,
  } as CanonicalReleaseJsonValue).digest;
}

export function createRuntimeSharedReleaseTenantSignerDescriptor(
  input: CreateRuntimeSharedReleaseTenantSignerDescriptorInput,
): ReleaseTenantSignerDescriptor {
  const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
  const pkiPath = normalizeOptionalIdentifier(input.pkiPath, 'pkiPath');
  const signingBoundary = input.providerKind === 'runtime-ephemeral'
    ? 'runtime-memory'
    : 'runtime-file-pem';

  return Object.freeze({
    version: RELEASE_TENANT_SIGNER_BOUNDARY_SPEC_VERSION,
    providerKind: input.providerKind,
    providerClass: 'runtime-local',
    tenantIdDigest: digestString(tenantId),
    keyId: null,
    keyRefDigest: pkiPath ? digestString(pkiPath) : null,
    publicVerificationKeyRefDigest: null,
    algorithm: 'Ed25519',
    isolationMode: 'tenant-claim-bound-shared-signer',
    signingBoundary,
    privateKeyExportable: true,
    rotationManagedBy: input.providerKind === 'runtime-ephemeral'
      ? 'runtime-ephemeral'
      : 'runtime-file-store',
    rotationRefDigest: null,
    liveProviderVerified: false,
    attestationRequired: false,
    attestationVerified: false,
    attestationEvidenceDigest: null,
    testOnly: false,
    contractSatisfied: false,
    productionReady: false,
    noLocalFallback: true,
    rawTenantIdStored: false,
    rawKeyRefStored: false,
    rawPayloadStored: false,
    activatesRuntimeSigning: false,
    protectedPrinciples: [
      'tenant isolation',
      'release provenance',
      'fail-closed boundary',
    ] as const,
    contractBlockers: [
      'non-external-signing-boundary',
      'private-key-exportable',
      'tenant-scoped-isolation-missing',
    ] as const,
    productionBlockers: [
      'non-external-signing-boundary',
      'private-key-exportable',
      'tenant-scoped-isolation-missing',
      'runtime-shared-signer-blast-radius',
    ] as const,
  });
}

export function createExternalKmsReleaseTenantSignerDescriptor(
  input: CreateExternalKmsReleaseTenantSignerDescriptorInput,
): ReleaseTenantSignerDescriptor {
  const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
  const keyRef = normalizeIdentifier(input.keyRef, 'keyRef');
  const keyId = normalizeIdentifier(input.keyId, 'keyId');
  const publicVerificationKeyRef = normalizeOptionalIdentifier(
    input.publicVerificationKeyRef,
    'publicVerificationKeyRef',
  );
  const rotationRef = normalizeOptionalIdentifier(input.rotationRef, 'rotationRef');
  const algorithm = input.algorithm;
  assertAlgorithm(algorithm);
  const isolationMode = input.isolationMode ?? 'tenant-scoped-external-kms';
  const attestationRequired =
    input.attestationRequired ?? isolationMode === 'confidential-attested-tenant-kms';
  const attestationVerified = input.attestationVerified ?? false;
  const attestationEvidenceDigest = normalizeDigest(
    input.attestationEvidenceDigest,
    'attestationEvidenceDigest',
  );
  const liveProviderVerified = input.liveProviderVerified ?? false;
  const testOnly = input.testOnly ?? input.providerClass === 'fake-external-kms-test';
  const contractBlockers: ReleaseTenantSignerContractBlocker[] = [];

  if (keyId.toLowerCase().includes(tenantId.toLowerCase())) {
    contractBlockers.push('key-id-contains-raw-tenant-id');
  }
  if (
    isolationMode !== 'tenant-scoped-external-kms' &&
    isolationMode !== 'confidential-attested-tenant-kms'
  ) {
    contractBlockers.push('tenant-scoped-isolation-missing');
  }
  if (attestationRequired && (!attestationVerified || attestationEvidenceDigest === null)) {
    contractBlockers.push('confidential-attestation-required');
  }

  const productionBlockers: ReleaseTenantSignerProductionBlocker[] = [
    ...contractBlockers,
  ];
  if (!liveProviderVerified) {
    productionBlockers.push('live-provider-sign-verify-probe-missing');
  }
  if (testOnly) {
    productionBlockers.push('fake-external-kms-test-only');
  }

  return Object.freeze({
    version: RELEASE_TENANT_SIGNER_BOUNDARY_SPEC_VERSION,
    providerKind: 'external-kms',
    providerClass: input.providerClass,
    tenantIdDigest: digestString(tenantId),
    keyId,
    keyRefDigest: digestString(keyRef),
    publicVerificationKeyRefDigest: publicVerificationKeyRef
      ? digestString(publicVerificationKeyRef)
      : null,
    algorithm,
    isolationMode,
    signingBoundary: 'external-kms-hsm',
    privateKeyExportable: false,
    rotationManagedBy: 'external-provider',
    rotationRefDigest: rotationRef ? digestString(rotationRef) : null,
    liveProviderVerified,
    attestationRequired,
    attestationVerified,
    attestationEvidenceDigest,
    testOnly,
    contractSatisfied: contractBlockers.length === 0,
    productionReady: productionBlockers.length === 0,
    noLocalFallback: true,
    rawTenantIdStored: false,
    rawKeyRefStored: false,
    rawPayloadStored: false,
    activatesRuntimeSigning: false,
    protectedPrinciples: [
      'tenant isolation',
      'release provenance',
      'fail-closed boundary',
    ] as const,
    contractBlockers: Object.freeze(contractBlockers),
    productionBlockers: Object.freeze(productionBlockers),
  });
}

export function assertReleaseTenantSignerProductionReady(
  descriptor: ReleaseTenantSignerDescriptor,
): ReleaseTenantSignerDescriptor {
  if (!descriptor.productionReady) {
    throw new ReleaseTenantSignerBoundaryError(
      `Release tenant signer boundary is not production-ready: ${descriptor.productionBlockers.join(', ')}`,
    );
  }
  return descriptor;
}

export function createFakeExternalKmsReleaseTenantSigner(input: {
  readonly tenantId: string;
  readonly keyRef: string;
  readonly keyId: string;
  readonly algorithm?: ReleaseTenantSignerAlgorithm | null;
}): FakeExternalKmsReleaseTenantSigner {
  const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
  const descriptor = createExternalKmsReleaseTenantSignerDescriptor({
    tenantId,
    keyRef: input.keyRef,
    keyId: input.keyId,
    algorithm: input.algorithm ?? 'Ed25519',
    providerClass: 'fake-external-kms-test',
    liveProviderVerified: false,
    testOnly: true,
  });

  const sign = (payload: ReleaseTenantSignerPayload): ReleaseTenantSignature => {
    const payloadTenantId = normalizeIdentifier(payload.tenantId, 'tenantId');
    if (payloadTenantId !== tenantId) {
      throw new ReleaseTenantSignerBoundaryError(
        'Release tenant signer boundary refused to sign for a mismatched tenant.',
      );
    }
    const payloadDigest = normalizeDigest(payload.payloadDigest, 'payloadDigest');
    if (payloadDigest === null) {
      throw new ReleaseTenantSignerBoundaryError(
        'Release tenant signer boundary payloadDigest is required.',
      );
    }
    const signingContextDigest = normalizeDigest(
      payload.signingContextDigest,
      'signingContextDigest',
    );
    const signedAt = normalizeIsoTimestamp(payload.signedAt);
    const descriptorDigestValue = descriptorDigest(descriptor);
    if (descriptor.keyId === null || descriptor.keyRefDigest === null || descriptor.algorithm === null) {
      throw new ReleaseTenantSignerBoundaryError(
        'Release tenant signer boundary descriptor is missing external signer key material references.',
      );
    }
    const canonical = digestCanonical({
      version: RELEASE_TENANT_SIGNER_BOUNDARY_SPEC_VERSION,
      tenantIdDigest: descriptor.tenantIdDigest,
      payloadDigest,
      signingContextDigest,
      keyId: descriptor.keyId,
      keyRefDigest: descriptor.keyRefDigest,
      algorithm: descriptor.algorithm,
      signingBoundary: 'external-kms-hsm',
      signedAt,
      descriptorDigest: descriptorDigestValue,
      testOnly: descriptor.testOnly,
    } as CanonicalReleaseJsonValue);

    return Object.freeze({
      version: RELEASE_TENANT_SIGNER_BOUNDARY_SPEC_VERSION,
      tenantIdDigest: descriptor.tenantIdDigest,
      payloadDigest,
      signingContextDigest,
      keyId: descriptor.keyId,
      keyRefDigest: descriptor.keyRefDigest,
      algorithm: descriptor.algorithm,
      signingBoundary: 'external-kms-hsm',
      signedAt,
      signature: `fake-external-kms-signature:${canonical.digest}`,
      descriptorDigest: descriptorDigestValue,
      rawTenantIdStored: false,
      rawKeyRefStored: false,
      rawPayloadStored: false,
      productionReady: descriptor.productionReady,
      testOnly: descriptor.testOnly,
      canonical: canonical.canonical,
      digest: canonical.digest,
    });
  };

  return Object.freeze({
    descriptor,
    sign,
  });
}
