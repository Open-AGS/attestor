import {
  RELEASE_TENANT_SIGNER_ALGORITHMS,
  RELEASE_TENANT_SIGNER_PROVIDER_CAPABILITY_SPEC_VERSION,
  ReleaseTenantSignerBoundaryError,
} from './release-tenant-signer-boundary-contracts.js';
import type {
  ReleaseTenantSignerAlgorithm,
  ReleaseTenantSignerJoseAlgorithm,
  ReleaseTenantSignerProviderCapability,
  ReleaseTenantSignerProviderClass,
  ReleaseTenantSignerProviderSignInputMode,
} from './release-tenant-signer-boundary-contracts.js';

export function assertReleaseTenantSignerAlgorithm(
  value: ReleaseTenantSignerAlgorithm,
): void {
  if (!RELEASE_TENANT_SIGNER_ALGORITHMS.includes(value)) {
    throw new ReleaseTenantSignerBoundaryError(
      `Release tenant signer boundary algorithm must be one of: ${RELEASE_TENANT_SIGNER_ALGORITHMS.join(', ')}.`,
    );
  }
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
  assertReleaseTenantSignerAlgorithm(input.algorithm);
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
