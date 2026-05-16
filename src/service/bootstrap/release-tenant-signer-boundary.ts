import { createHash } from 'node:crypto';
import {
  canonicalization,
} from '../../release-layer/index.js';
import type {
  ReleaseSigningProviderKind,
} from './release-signing-provider.js';

type CanonicalReleaseJsonValue = canonicalization.CanonicalReleaseJsonValue;

export const RELEASE_TENANT_SIGNER_BOUNDARY_SPEC_VERSION =
  'attestor.release-tenant-signer-boundary.v1';
export const RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_SPEC_VERSION =
  'attestor.release-tenant-signer-live-provider-proof.v1';
export const RELEASE_TENANT_SIGNER_PROVIDER_CAPABILITY_SPEC_VERSION =
  'attestor.release-tenant-signer-provider-capability.v1';
export const RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_CHALLENGE =
  'attestor.release-tenant-signer-live-provider-proof.challenge.v1';
export const DEFAULT_RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_MAX_AGE_MINUTES =
  24 * 60;

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

export const RELEASE_TENANT_SIGNER_PROVIDER_SIGN_INPUT_MODES = [
  'raw',
  'digest-sha256',
  'digest-sha384',
] as const;
export type ReleaseTenantSignerProviderSignInputMode =
  typeof RELEASE_TENANT_SIGNER_PROVIDER_SIGN_INPUT_MODES[number];

export const RELEASE_TENANT_SIGNER_PROVIDER_PROTECTION_LEVELS = [
  'software',
  'hsm',
  'hsm-single-tenant',
  'external',
  'external-vpc',
  'aws-kms-hsm',
  'azure-managed-hsm',
  'unknown',
] as const;
export type ReleaseTenantSignerProviderProtectionLevel =
  typeof RELEASE_TENANT_SIGNER_PROVIDER_PROTECTION_LEVELS[number];

export type ReleaseTenantSignerJoseAlgorithm =
  | 'EdDSA'
  | 'ES256'
  | 'ES384'
  | 'PS256';

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
  'provider-algorithm-unsupported',
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
  'live-provider-proof-invalid',
  'live-provider-proof-stale',
  'live-provider-proof-descriptor-mismatch',
  'live-provider-proof-checked-at-in-future',
  'live-provider-proof-verification-failed',
  'live-provider-protection-level-insufficient',
  'fake-external-kms-test-only',
  'runtime-shared-signer-blast-radius',
] as const;
export type ReleaseTenantSignerProductionBlocker =
  typeof RELEASE_TENANT_SIGNER_PRODUCTION_BLOCKERS[number];

export type ReleaseTenantSignerLiveProviderProofState =
  | 'not-provided'
  | 'valid'
  | 'invalid'
  | 'stale';

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
  /**
   * Legacy caller hint only. Production readiness is derived from
   * liveProviderProof, not from this boolean.
   */
  readonly liveProviderVerified?: boolean | null;
  readonly liveProviderProof?: ReleaseTenantSignerLiveProviderProof | null;
  readonly liveProviderProofMaxAgeMinutes?: number | null;
  readonly nowMs?: number | null;
  readonly attestationRequired?: boolean | null;
  readonly attestationVerified?: boolean | null;
  readonly attestationEvidenceDigest?: string | null;
  readonly testOnly?: boolean | null;
}

export interface CreateReleaseTenantSignerLiveProviderProofInput {
  readonly tenantId: string;
  readonly providerClass: Exclude<
    ReleaseTenantSignerProviderClass,
    'runtime-local' | 'fake-external-kms-test'
  >;
  readonly keyRef: string;
  readonly keyId: string;
  readonly algorithm: ReleaseTenantSignerAlgorithm;
  readonly providerNativeAlgorithm?: string | null;
  readonly providerSignInputMode?: ReleaseTenantSignerProviderSignInputMode | null;
  readonly providerProtectionLevel: ReleaseTenantSignerProviderProtectionLevel;
  readonly payloadDigest?: string | null;
  readonly signingContextDigest?: string | null;
  readonly publicVerificationKeyRef?: string | null;
  readonly signatureDigest: string;
  readonly verificationDigest: string;
  readonly providerRequestDigest: string;
  readonly providerResponseDigest: string;
  readonly signedAt?: string | null;
  readonly verifiedAt?: string | null;
  readonly verificationSucceeded?: boolean | null;
}

export interface ReleaseTenantSignerLiveProviderProof {
  readonly version: typeof RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_SPEC_VERSION;
  readonly providerClass: Exclude<
    ReleaseTenantSignerProviderClass,
    'runtime-local' | 'fake-external-kms-test'
  >;
  readonly tenantIdDigest: string;
  readonly keyRefDigest: string;
  readonly keyId: string;
  readonly algorithm: ReleaseTenantSignerAlgorithm;
  readonly releaseTokenJoseAlgorithm: ReleaseTenantSignerJoseAlgorithm;
  readonly providerNativeAlgorithm: string;
  readonly providerSignInputMode: ReleaseTenantSignerProviderSignInputMode;
  readonly providerProtectionLevel: ReleaseTenantSignerProviderProtectionLevel;
  readonly signingBoundary: Extract<ReleaseTenantSignerBoundary, 'external-kms-hsm'>;
  readonly payloadDigest: string;
  readonly signingContextDigest: string | null;
  readonly publicVerificationKeyRefDigest: string | null;
  readonly signatureDigest: string;
  readonly verificationDigest: string;
  readonly providerRequestDigest: string;
  readonly providerResponseDigest: string;
  readonly signedAt: string;
  readonly verifiedAt: string;
  readonly verificationSucceeded: boolean;
  readonly proofDigest: string;
  readonly rawTenantIdStored: false;
  readonly rawKeyRefStored: false;
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
}

export interface ReleaseTenantSignerLiveProviderProofEvaluation {
  readonly version: typeof RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_SPEC_VERSION;
  readonly state: ReleaseTenantSignerLiveProviderProofState;
  readonly proofDigest: string | null;
  readonly checkedAt: string | null;
  readonly maxAgeMinutes: number;
  readonly blockers: readonly ReleaseTenantSignerProductionBlocker[];
  readonly rawProviderResponseStored: false;
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
  readonly providerAlgorithmSupported: boolean;
  readonly releaseTokenJoseAlgorithm: ReleaseTenantSignerJoseAlgorithm | null;
  readonly providerNativeAlgorithm: string | null;
  readonly providerSignInputMode: ReleaseTenantSignerProviderSignInputMode | null;
  readonly providerProtectionLevel: ReleaseTenantSignerProviderProtectionLevel | null;
  readonly isolationMode: ReleaseTenantSignerIsolationMode;
  readonly signingBoundary: ReleaseTenantSignerBoundary;
  readonly privateKeyExportable: boolean;
  readonly rotationManagedBy: ReleaseTenantSignerRotationManager;
  readonly rotationRefDigest: string | null;
  readonly liveProviderVerified: boolean;
  readonly liveProviderProofDigest: string | null;
  readonly liveProviderProofCheckedAt: string | null;
  readonly liveProviderProofState: ReleaseTenantSignerLiveProviderProofState;
  readonly liveProviderProofProviderRequestDigest: string | null;
  readonly liveProviderProofProviderResponseDigest: string | null;
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
  readonly rawProviderResponseStored: false;
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
  readonly releaseTokenJoseAlgorithm: ReleaseTenantSignerJoseAlgorithm;
  readonly providerNativeAlgorithm: string;
  readonly providerSignInputMode: ReleaseTenantSignerProviderSignInputMode;
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

export interface ReleaseTenantSignerProviderCapability {
  readonly version: typeof RELEASE_TENANT_SIGNER_PROVIDER_CAPABILITY_SPEC_VERSION;
  readonly providerClass: ReleaseTenantSignerProviderClass;
  readonly algorithm: ReleaseTenantSignerAlgorithm;
  readonly supported: boolean;
  readonly releaseTokenJoseAlgorithm: ReleaseTenantSignerJoseAlgorithm | null;
  readonly providerNativeAlgorithm: string | null;
  readonly providerSignInputMode: ReleaseTenantSignerProviderSignInputMode | null;
  readonly sourceAnchor: string;
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

export function releaseTenantSignerLiveProviderProofChallengeDigest(): string {
  return digestString(RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_CHALLENGE);
}

function digestCanonical(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalization.canonicalizeReleaseJson(value);
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

function normalizeRequiredDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeDigest(value, fieldName);
  if (normalized === null) {
    throw new ReleaseTenantSignerBoundaryError(
      `Release tenant signer boundary ${fieldName} is required.`,
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

function normalizeMaxAgeMinutes(value: number | null | undefined): number {
  if (value === undefined || value === null) {
    return DEFAULT_RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_MAX_AGE_MINUTES;
  }
  if (!Number.isInteger(value) || value < 1 || value > 7 * 24 * 60) {
    throw new ReleaseTenantSignerBoundaryError(
      'Release tenant signer boundary liveProviderProofMaxAgeMinutes must be an integer between 1 and 10080.',
    );
  }
  return value;
}

function assertAlgorithm(value: ReleaseTenantSignerAlgorithm): void {
  if (!RELEASE_TENANT_SIGNER_ALGORITHMS.includes(value)) {
    throw new ReleaseTenantSignerBoundaryError(
      `Release tenant signer boundary algorithm must be one of: ${RELEASE_TENANT_SIGNER_ALGORITHMS.join(', ')}.`,
    );
  }
}

function normalizeProviderNativeAlgorithm(value: string | null | undefined): string | null {
  return normalizeOptionalIdentifier(value, 'providerNativeAlgorithm');
}

function normalizeProviderSignInputMode(
  value: ReleaseTenantSignerProviderSignInputMode | null | undefined,
): ReleaseTenantSignerProviderSignInputMode | null {
  if (value === undefined || value === null) return null;
  if (!RELEASE_TENANT_SIGNER_PROVIDER_SIGN_INPUT_MODES.includes(value)) {
    throw new ReleaseTenantSignerBoundaryError(
      `Release tenant signer boundary providerSignInputMode must be one of: ${RELEASE_TENANT_SIGNER_PROVIDER_SIGN_INPUT_MODES.join(', ')}.`,
    );
  }
  return value;
}

function normalizeProviderProtectionLevel(
  value: ReleaseTenantSignerProviderProtectionLevel | null | undefined,
): ReleaseTenantSignerProviderProtectionLevel {
  if (
    value === undefined ||
    value === null ||
    !RELEASE_TENANT_SIGNER_PROVIDER_PROTECTION_LEVELS.includes(value)
  ) {
    throw new ReleaseTenantSignerBoundaryError(
      `Release tenant signer boundary providerProtectionLevel must be one of: ${RELEASE_TENANT_SIGNER_PROVIDER_PROTECTION_LEVELS.join(', ')}.`,
    );
  }
  return value;
}

function providerProtectionLevelProductionReady(
  value: ReleaseTenantSignerProviderProtectionLevel,
): boolean {
  return value !== 'software' && value !== 'unknown';
}

function capability(
  input: {
    readonly providerClass: ReleaseTenantSignerProviderClass;
    readonly algorithm: ReleaseTenantSignerAlgorithm;
    readonly releaseTokenJoseAlgorithm: ReleaseTenantSignerJoseAlgorithm;
    readonly providerNativeAlgorithm: string;
    readonly providerSignInputMode: ReleaseTenantSignerProviderSignInputMode;
    readonly sourceAnchor: string;
  },
): ReleaseTenantSignerProviderCapability {
  return Object.freeze({
    version: RELEASE_TENANT_SIGNER_PROVIDER_CAPABILITY_SPEC_VERSION,
    providerClass: input.providerClass,
    algorithm: input.algorithm,
    supported: true,
    releaseTokenJoseAlgorithm: input.releaseTokenJoseAlgorithm,
    providerNativeAlgorithm: input.providerNativeAlgorithm,
    providerSignInputMode: input.providerSignInputMode,
    sourceAnchor: input.sourceAnchor,
  });
}

function unsupportedCapability(input: {
  readonly providerClass: ReleaseTenantSignerProviderClass;
  readonly algorithm: ReleaseTenantSignerAlgorithm;
  readonly sourceAnchor: string;
}): ReleaseTenantSignerProviderCapability {
  return Object.freeze({
    version: RELEASE_TENANT_SIGNER_PROVIDER_CAPABILITY_SPEC_VERSION,
    providerClass: input.providerClass,
    algorithm: input.algorithm,
    supported: false,
    releaseTokenJoseAlgorithm: null,
    providerNativeAlgorithm: null,
    providerSignInputMode: null,
    sourceAnchor: input.sourceAnchor,
  });
}

export function resolveReleaseTenantSignerProviderCapability(input: {
  readonly providerClass: ReleaseTenantSignerProviderClass;
  readonly algorithm: ReleaseTenantSignerAlgorithm;
}): ReleaseTenantSignerProviderCapability {
  assertAlgorithm(input.algorithm);
  const sourceAnchor =
    input.providerClass === 'aws-kms'
      ? 'AWS KMS Sign API'
      : input.providerClass === 'gcp-kms'
        ? 'Google Cloud KMS asymmetricSign API'
        : input.providerClass === 'azure-key-vault' ||
            input.providerClass === 'azure-managed-hsm'
          ? 'Azure Key Vault / Managed HSM Sign API'
          : input.providerClass === 'fake-external-kms-test'
            ? 'Attestor fake external KMS test adapter'
            : input.providerClass === 'runtime-local'
              ? 'Attestor runtime local signer'
              : 'Generic external KMS/HSM provider';

  if (input.providerClass === 'runtime-local') {
    if (input.algorithm === 'Ed25519') {
      return capability({
        providerClass: input.providerClass,
        algorithm: input.algorithm,
        releaseTokenJoseAlgorithm: 'EdDSA',
        providerNativeAlgorithm: 'local-ed25519',
        providerSignInputMode: 'raw',
        sourceAnchor,
      });
    }
    return unsupportedCapability({ ...input, sourceAnchor });
  }

  if (input.providerClass === 'fake-external-kms-test') {
    const fakeCapabilities: Record<
      ReleaseTenantSignerAlgorithm,
      {
        readonly releaseTokenJoseAlgorithm: ReleaseTenantSignerJoseAlgorithm;
        readonly providerNativeAlgorithm: string;
        readonly providerSignInputMode: ReleaseTenantSignerProviderSignInputMode;
      }
    > = {
      Ed25519: {
        releaseTokenJoseAlgorithm: 'EdDSA',
        providerNativeAlgorithm: 'fake-ed25519',
        providerSignInputMode: 'raw',
      },
      ES256: {
        releaseTokenJoseAlgorithm: 'ES256',
        providerNativeAlgorithm: 'fake-es256',
        providerSignInputMode: 'digest-sha256',
      },
      ES384: {
        releaseTokenJoseAlgorithm: 'ES384',
        providerNativeAlgorithm: 'fake-es384',
        providerSignInputMode: 'digest-sha384',
      },
      PS256: {
        releaseTokenJoseAlgorithm: 'PS256',
        providerNativeAlgorithm: 'fake-ps256',
        providerSignInputMode: 'digest-sha256',
      },
    };
    return capability({
      providerClass: input.providerClass,
      algorithm: input.algorithm,
      ...fakeCapabilities[input.algorithm],
      sourceAnchor,
    });
  }

  if (input.providerClass === 'aws-kms') {
    const awsCapabilities: Record<
      ReleaseTenantSignerAlgorithm,
      {
        readonly releaseTokenJoseAlgorithm: ReleaseTenantSignerJoseAlgorithm;
        readonly providerNativeAlgorithm: string;
        readonly providerSignInputMode: ReleaseTenantSignerProviderSignInputMode;
      }
    > = {
      Ed25519: {
        releaseTokenJoseAlgorithm: 'EdDSA',
        providerNativeAlgorithm: 'ED25519_SHA_512',
        providerSignInputMode: 'raw',
      },
      ES256: {
        releaseTokenJoseAlgorithm: 'ES256',
        providerNativeAlgorithm: 'ECDSA_SHA_256',
        providerSignInputMode: 'digest-sha256',
      },
      ES384: {
        releaseTokenJoseAlgorithm: 'ES384',
        providerNativeAlgorithm: 'ECDSA_SHA_384',
        providerSignInputMode: 'digest-sha384',
      },
      PS256: {
        releaseTokenJoseAlgorithm: 'PS256',
        providerNativeAlgorithm: 'RSASSA_PSS_SHA_256',
        providerSignInputMode: 'digest-sha256',
      },
    };
    return capability({
      providerClass: input.providerClass,
      algorithm: input.algorithm,
      ...awsCapabilities[input.algorithm],
      sourceAnchor,
    });
  }

  if (input.providerClass === 'gcp-kms') {
    const gcpCapabilities: Record<
      ReleaseTenantSignerAlgorithm,
      {
        readonly releaseTokenJoseAlgorithm: ReleaseTenantSignerJoseAlgorithm;
        readonly providerNativeAlgorithm: string;
        readonly providerSignInputMode: ReleaseTenantSignerProviderSignInputMode;
      }
    > = {
      Ed25519: {
        releaseTokenJoseAlgorithm: 'EdDSA',
        providerNativeAlgorithm: 'EC_SIGN_ED25519',
        providerSignInputMode: 'raw',
      },
      ES256: {
        releaseTokenJoseAlgorithm: 'ES256',
        providerNativeAlgorithm: 'EC_SIGN_P256_SHA256',
        providerSignInputMode: 'digest-sha256',
      },
      ES384: {
        releaseTokenJoseAlgorithm: 'ES384',
        providerNativeAlgorithm: 'EC_SIGN_P384_SHA384',
        providerSignInputMode: 'digest-sha384',
      },
      PS256: {
        releaseTokenJoseAlgorithm: 'PS256',
        providerNativeAlgorithm: 'RSA_SIGN_PSS_3072_SHA256',
        providerSignInputMode: 'digest-sha256',
      },
    };
    return capability({
      providerClass: input.providerClass,
      algorithm: input.algorithm,
      ...gcpCapabilities[input.algorithm],
      sourceAnchor,
    });
  }

  if (input.providerClass === 'azure-key-vault' || input.providerClass === 'azure-managed-hsm') {
    if (input.algorithm === 'Ed25519') {
      return unsupportedCapability({ ...input, sourceAnchor });
    }
    const azureCapabilities: Record<
      Exclude<ReleaseTenantSignerAlgorithm, 'Ed25519'>,
      {
        readonly releaseTokenJoseAlgorithm: ReleaseTenantSignerJoseAlgorithm;
        readonly providerNativeAlgorithm: string;
        readonly providerSignInputMode: ReleaseTenantSignerProviderSignInputMode;
      }
    > = {
      ES256: {
        releaseTokenJoseAlgorithm: 'ES256',
        providerNativeAlgorithm: 'ES256',
        providerSignInputMode: 'digest-sha256',
      },
      ES384: {
        releaseTokenJoseAlgorithm: 'ES384',
        providerNativeAlgorithm: 'ES384',
        providerSignInputMode: 'digest-sha384',
      },
      PS256: {
        releaseTokenJoseAlgorithm: 'PS256',
        providerNativeAlgorithm: 'PS256',
        providerSignInputMode: 'digest-sha256',
      },
    };
    return capability({
      providerClass: input.providerClass,
      algorithm: input.algorithm,
      ...azureCapabilities[input.algorithm],
      sourceAnchor,
    });
  }

  return unsupportedCapability({ ...input, sourceAnchor });
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
    providerAlgorithmSupported: descriptor.providerAlgorithmSupported,
    releaseTokenJoseAlgorithm: descriptor.releaseTokenJoseAlgorithm,
    providerNativeAlgorithm: descriptor.providerNativeAlgorithm,
    providerSignInputMode: descriptor.providerSignInputMode,
    providerProtectionLevel: descriptor.providerProtectionLevel,
    isolationMode: descriptor.isolationMode,
    signingBoundary: descriptor.signingBoundary,
    privateKeyExportable: descriptor.privateKeyExportable,
    rotationManagedBy: descriptor.rotationManagedBy,
    rotationRefDigest: descriptor.rotationRefDigest,
    liveProviderVerified: descriptor.liveProviderVerified,
    liveProviderProofDigest: descriptor.liveProviderProofDigest,
    liveProviderProofCheckedAt: descriptor.liveProviderProofCheckedAt,
    liveProviderProofState: descriptor.liveProviderProofState,
    liveProviderProofProviderRequestDigest:
      descriptor.liveProviderProofProviderRequestDigest,
    liveProviderProofProviderResponseDigest:
      descriptor.liveProviderProofProviderResponseDigest,
    attestationRequired: descriptor.attestationRequired,
    attestationVerified: descriptor.attestationVerified,
    attestationEvidenceDigest: descriptor.attestationEvidenceDigest,
    testOnly: descriptor.testOnly,
    contractSatisfied: descriptor.contractSatisfied,
    productionReady: descriptor.productionReady,
    rawProviderResponseStored: descriptor.rawProviderResponseStored,
    contractBlockers: descriptor.contractBlockers,
    productionBlockers: descriptor.productionBlockers,
  } as CanonicalReleaseJsonValue).digest;
}

export function createReleaseTenantSignerLiveProviderProof(
  input: CreateReleaseTenantSignerLiveProviderProofInput,
): ReleaseTenantSignerLiveProviderProof {
  const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
  const keyRef = normalizeIdentifier(input.keyRef, 'keyRef');
  const keyId = normalizeIdentifier(input.keyId, 'keyId');
  assertAlgorithm(input.algorithm);
  const providerCapability = resolveReleaseTenantSignerProviderCapability({
    providerClass: input.providerClass,
    algorithm: input.algorithm,
  });
  if (!providerCapability.supported) {
    throw new ReleaseTenantSignerBoundaryError(
      `Release tenant signer boundary provider ${input.providerClass} does not support algorithm ${input.algorithm}.`,
    );
  }
  const providerNativeAlgorithm =
    normalizeProviderNativeAlgorithm(input.providerNativeAlgorithm) ??
    providerCapability.providerNativeAlgorithm;
  const providerSignInputMode =
    normalizeProviderSignInputMode(input.providerSignInputMode) ??
    providerCapability.providerSignInputMode;
  const providerProtectionLevel = normalizeProviderProtectionLevel(
    input.providerProtectionLevel,
  );
  if (
    providerNativeAlgorithm === null ||
    providerSignInputMode === null ||
    providerCapability.releaseTokenJoseAlgorithm === null
  ) {
    throw new ReleaseTenantSignerBoundaryError(
      'Release tenant signer boundary provider capability is incomplete.',
    );
  }

  const payloadDigest = normalizeRequiredDigest(
    input.payloadDigest ?? releaseTenantSignerLiveProviderProofChallengeDigest(),
    'payloadDigest',
  );
  const signingContextDigest = normalizeDigest(
    input.signingContextDigest,
    'signingContextDigest',
  );
  const publicVerificationKeyRef = normalizeOptionalIdentifier(
    input.publicVerificationKeyRef,
    'publicVerificationKeyRef',
  );
  const signatureDigest = normalizeRequiredDigest(input.signatureDigest, 'signatureDigest');
  const verificationDigest = normalizeRequiredDigest(
    input.verificationDigest,
    'verificationDigest',
  );
  const providerRequestDigest = normalizeRequiredDigest(
    input.providerRequestDigest,
    'providerRequestDigest',
  );
  const providerResponseDigest = normalizeRequiredDigest(
    input.providerResponseDigest,
    'providerResponseDigest',
  );
  const signedAt = normalizeIsoTimestamp(input.signedAt);
  const verifiedAt = normalizeIsoTimestamp(input.verifiedAt ?? signedAt);
  const proofMaterial = {
    version: RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_SPEC_VERSION as typeof
      RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_SPEC_VERSION,
    providerClass: input.providerClass,
    tenantIdDigest: digestString(tenantId),
    keyRefDigest: digestString(keyRef),
    keyId,
    algorithm: input.algorithm,
    releaseTokenJoseAlgorithm: providerCapability.releaseTokenJoseAlgorithm,
    providerNativeAlgorithm,
    providerSignInputMode,
    providerProtectionLevel,
    signingBoundary: 'external-kms-hsm' as const,
    payloadDigest,
    signingContextDigest,
    publicVerificationKeyRefDigest: publicVerificationKeyRef
      ? digestString(publicVerificationKeyRef)
      : null,
    signatureDigest,
    verificationDigest,
    providerRequestDigest,
    providerResponseDigest,
    signedAt,
    verifiedAt,
    verificationSucceeded: input.verificationSucceeded ?? true,
  };

  return Object.freeze({
    ...proofMaterial,
    proofDigest: digestCanonical(proofMaterial as CanonicalReleaseJsonValue).digest,
    rawTenantIdStored: false,
    rawKeyRefStored: false,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
  });
}

export function evaluateReleaseTenantSignerLiveProviderProof(input: {
  readonly proof?: ReleaseTenantSignerLiveProviderProof | null;
  readonly tenantIdDigest: string;
  readonly providerClass: ReleaseTenantSignerProviderClass;
  readonly keyRefDigest: string;
  readonly keyId: string;
  readonly algorithm: ReleaseTenantSignerAlgorithm;
  readonly releaseTokenJoseAlgorithm?: ReleaseTenantSignerJoseAlgorithm | null;
  readonly providerNativeAlgorithm?: string | null;
  readonly providerSignInputMode?: ReleaseTenantSignerProviderSignInputMode | null;
  readonly publicVerificationKeyRefDigest?: string | null;
  readonly nowMs?: number | null;
  readonly maxAgeMinutes?: number | null;
}): ReleaseTenantSignerLiveProviderProofEvaluation {
  const maxAgeMinutes = normalizeMaxAgeMinutes(input.maxAgeMinutes);
  const blockers: ReleaseTenantSignerProductionBlocker[] = [];
  const proof = input.proof ?? null;

  if (proof === null) {
    blockers.push('live-provider-sign-verify-probe-missing');
    return Object.freeze({
      version: RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_SPEC_VERSION,
      state: 'not-provided',
      proofDigest: null,
      checkedAt: null,
      maxAgeMinutes,
      blockers: Object.freeze(blockers),
      rawProviderResponseStored: false,
    });
  }

  if (proof.version !== RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_SPEC_VERSION) {
    blockers.push('live-provider-proof-invalid');
  }
  if (!proof.verificationSucceeded) {
    blockers.push('live-provider-proof-verification-failed');
  }
  if (!providerProtectionLevelProductionReady(proof.providerProtectionLevel)) {
    blockers.push('live-provider-protection-level-insufficient');
  }
  const expectedCapability = resolveReleaseTenantSignerProviderCapability({
    providerClass: input.providerClass,
    algorithm: input.algorithm,
  });
  const expectedReleaseTokenJoseAlgorithm =
    input.releaseTokenJoseAlgorithm ?? expectedCapability.releaseTokenJoseAlgorithm;
  const expectedProviderNativeAlgorithm =
    input.providerNativeAlgorithm ?? expectedCapability.providerNativeAlgorithm;
  const expectedProviderSignInputMode =
    input.providerSignInputMode ?? expectedCapability.providerSignInputMode;
  if (
    proof.providerClass !== input.providerClass ||
    proof.tenantIdDigest !== input.tenantIdDigest ||
    proof.keyRefDigest !== input.keyRefDigest ||
    proof.keyId !== input.keyId ||
    proof.algorithm !== input.algorithm ||
    proof.releaseTokenJoseAlgorithm !== expectedReleaseTokenJoseAlgorithm ||
    proof.providerNativeAlgorithm !== expectedProviderNativeAlgorithm ||
    proof.providerSignInputMode !== expectedProviderSignInputMode ||
    !RELEASE_TENANT_SIGNER_PROVIDER_PROTECTION_LEVELS.includes(
      proof.providerProtectionLevel,
    ) ||
    proof.signingBoundary !== 'external-kms-hsm' ||
    proof.payloadDigest !== releaseTenantSignerLiveProviderProofChallengeDigest() ||
    proof.publicVerificationKeyRefDigest !== (input.publicVerificationKeyRefDigest ?? null)
  ) {
    blockers.push('live-provider-proof-descriptor-mismatch');
  }

  const verifiedAtMs = Date.parse(proof.verifiedAt);
  const nowMs = input.nowMs ?? Date.now();
  let state: ReleaseTenantSignerLiveProviderProofState = 'invalid';
  if (!Number.isFinite(verifiedAtMs)) {
    blockers.push('live-provider-proof-invalid');
  } else if (verifiedAtMs - nowMs > 5 * 60 * 1000) {
    blockers.push('live-provider-proof-checked-at-in-future');
  } else if (nowMs - verifiedAtMs > maxAgeMinutes * 60 * 1000) {
    blockers.push('live-provider-proof-stale');
    state = 'stale';
  }

  if (blockers.length === 0) {
    state = 'valid';
  }

  return Object.freeze({
    version: RELEASE_TENANT_SIGNER_LIVE_PROVIDER_PROOF_SPEC_VERSION,
    state,
    proofDigest: proof.proofDigest,
    checkedAt: proof.verifiedAt,
    maxAgeMinutes,
    blockers: Object.freeze(blockers),
    rawProviderResponseStored: false,
  });
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
    providerAlgorithmSupported: true,
    releaseTokenJoseAlgorithm: 'EdDSA',
    providerNativeAlgorithm: null,
    providerSignInputMode: null,
    providerProtectionLevel: null,
    isolationMode: 'tenant-claim-bound-shared-signer',
    signingBoundary,
    privateKeyExportable: true,
    rotationManagedBy: input.providerKind === 'runtime-ephemeral'
      ? 'runtime-ephemeral'
      : 'runtime-file-store',
    rotationRefDigest: null,
    liveProviderVerified: false,
    liveProviderProofDigest: null,
    liveProviderProofCheckedAt: null,
    liveProviderProofState: 'not-provided',
    liveProviderProofProviderRequestDigest: null,
    liveProviderProofProviderResponseDigest: null,
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
    rawProviderResponseStored: false,
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
  const tenantIdDigest = digestString(tenantId);
  const keyRefDigest = digestString(keyRef);
  const publicVerificationKeyRef = normalizeOptionalIdentifier(
    input.publicVerificationKeyRef,
    'publicVerificationKeyRef',
  );
  const publicVerificationKeyRefDigest = publicVerificationKeyRef
    ? digestString(publicVerificationKeyRef)
    : null;
  const rotationRef = normalizeOptionalIdentifier(input.rotationRef, 'rotationRef');
  const algorithm = input.algorithm;
  assertAlgorithm(algorithm);
  const providerCapability = resolveReleaseTenantSignerProviderCapability({
    providerClass: input.providerClass,
    algorithm,
  });
  const isolationMode = input.isolationMode ?? 'tenant-scoped-external-kms';
  const attestationRequired =
    input.attestationRequired ?? isolationMode === 'confidential-attested-tenant-kms';
  const attestationVerified = input.attestationVerified ?? false;
  const attestationEvidenceDigest = normalizeDigest(
    input.attestationEvidenceDigest,
    'attestationEvidenceDigest',
  );
  const testOnly = input.testOnly ?? input.providerClass === 'fake-external-kms-test';
  const contractBlockers: ReleaseTenantSignerContractBlocker[] = [];

  if (keyId.toLowerCase().includes(tenantId.toLowerCase())) {
    contractBlockers.push('key-id-contains-raw-tenant-id');
  }
  if (!providerCapability.supported) {
    contractBlockers.push('provider-algorithm-unsupported');
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
  const liveProviderProofInput = input.liveProviderProof ?? null;
  const liveProviderProof = evaluateReleaseTenantSignerLiveProviderProof({
    proof: liveProviderProofInput,
    tenantIdDigest,
    providerClass: input.providerClass,
    keyRefDigest,
    keyId,
    algorithm,
    releaseTokenJoseAlgorithm: providerCapability.releaseTokenJoseAlgorithm,
    providerNativeAlgorithm: providerCapability.providerNativeAlgorithm,
    providerSignInputMode: providerCapability.providerSignInputMode,
    publicVerificationKeyRefDigest,
    nowMs: input.nowMs,
    maxAgeMinutes: input.liveProviderProofMaxAgeMinutes,
  });
  const liveProviderVerified = liveProviderProof.state === 'valid';
  productionBlockers.push(...liveProviderProof.blockers);
  if (testOnly) {
    productionBlockers.push('fake-external-kms-test-only');
  }

  return Object.freeze({
    version: RELEASE_TENANT_SIGNER_BOUNDARY_SPEC_VERSION,
    providerKind: 'external-kms',
    providerClass: input.providerClass,
    tenantIdDigest,
    keyId,
    keyRefDigest,
    publicVerificationKeyRefDigest,
    algorithm,
    providerAlgorithmSupported: providerCapability.supported,
    releaseTokenJoseAlgorithm: providerCapability.releaseTokenJoseAlgorithm,
    providerNativeAlgorithm: providerCapability.providerNativeAlgorithm,
    providerSignInputMode: providerCapability.providerSignInputMode,
    providerProtectionLevel: liveProviderProofInput?.providerProtectionLevel ?? null,
    isolationMode,
    signingBoundary: 'external-kms-hsm',
    privateKeyExportable: false,
    rotationManagedBy: 'external-provider',
    rotationRefDigest: rotationRef ? digestString(rotationRef) : null,
    liveProviderVerified,
    liveProviderProofDigest: liveProviderProof.proofDigest,
    liveProviderProofCheckedAt: liveProviderProof.checkedAt,
    liveProviderProofState: liveProviderProof.state,
    liveProviderProofProviderRequestDigest:
      liveProviderProofInput?.providerRequestDigest ?? null,
    liveProviderProofProviderResponseDigest:
      liveProviderProofInput?.providerResponseDigest ?? null,
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
    rawProviderResponseStored: false,
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
    if (
      descriptor.releaseTokenJoseAlgorithm === null ||
      descriptor.providerNativeAlgorithm === null ||
      descriptor.providerSignInputMode === null
    ) {
      throw new ReleaseTenantSignerBoundaryError(
        'Release tenant signer boundary descriptor is missing provider capability material.',
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
      releaseTokenJoseAlgorithm: descriptor.releaseTokenJoseAlgorithm,
      providerNativeAlgorithm: descriptor.providerNativeAlgorithm,
      providerSignInputMode: descriptor.providerSignInputMode,
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
      releaseTokenJoseAlgorithm: descriptor.releaseTokenJoseAlgorithm,
      providerNativeAlgorithm: descriptor.providerNativeAlgorithm,
      providerSignInputMode: descriptor.providerSignInputMode,
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
