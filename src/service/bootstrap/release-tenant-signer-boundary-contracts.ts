import type {
  ReleaseSigningProviderKind,
} from './release-signing-provider.js';

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
