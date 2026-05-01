import type { AttestorRuntimeProfile } from './runtime-profile.js';

export const ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV = 'ATTESTOR_RELEASE_SIGNING_PROVIDER';
export const ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER_ENV =
  'ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER';
export const RELEASE_SIGNING_PROVIDER_DIAGNOSTICS_SPEC_VERSION =
  'attestor.release-signing-provider-diagnostics.v1';

export const RELEASE_SIGNING_PROVIDER_KINDS = Object.freeze([
  'runtime-ephemeral',
  'file-pem',
  'external-kms',
] as const);

export type ReleaseSigningProviderKind = typeof RELEASE_SIGNING_PROVIDER_KINDS[number];

export interface ReleaseSigningProviderPkiPersistence {
  readonly mode: 'ephemeral' | 'file';
  readonly path: string | null;
}

export interface ReleaseSigningProviderDiagnostics {
  readonly version: typeof RELEASE_SIGNING_PROVIDER_DIAGNOSTICS_SPEC_VERSION;
  readonly kind: ReleaseSigningProviderKind;
  readonly configuredProvider: string | null;
  readonly derivedProvider: Exclude<ReleaseSigningProviderKind, 'external-kms'>;
  readonly productionProviderRequired: boolean;
  readonly productionReady: boolean;
  readonly privateKeyExportable: boolean;
  readonly signingBoundary: 'runtime-memory' | 'runtime-file-pem' | 'external-kms-hsm';
  readonly rotationManagedBy: 'runtime-ephemeral' | 'runtime-file-store' | 'external-provider';
  readonly publicVerificationKeysServedBy: 'runtime-jwks';
  readonly pkiPath: string | null;
  readonly blockers: readonly string[];
}

export class ReleaseSigningProviderConfigurationError extends Error {
  readonly diagnostics: ReleaseSigningProviderDiagnostics | null;

  constructor(message: string, diagnostics: ReleaseSigningProviderDiagnostics | null = null) {
    super(message);
    this.name = 'ReleaseSigningProviderConfigurationError';
    this.diagnostics = diagnostics;
  }
}

function normalizedProvider(
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  const configured = env[ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV]?.trim().toLowerCase();
  return configured && configured.length > 0 ? configured : null;
}

function booleanEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): boolean {
  const value = env[key]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function assertKnownProvider(
  configuredProvider: string | null,
): asserts configuredProvider is ReleaseSigningProviderKind | null {
  if (
    configuredProvider !== null &&
    !RELEASE_SIGNING_PROVIDER_KINDS.includes(configuredProvider as ReleaseSigningProviderKind)
  ) {
    throw new ReleaseSigningProviderConfigurationError(
      `Unsupported ${ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV}: ${configuredProvider}. Supported values: ${RELEASE_SIGNING_PROVIDER_KINDS.join(', ')}`,
    );
  }
}

function derivedProviderFromPki(
  pkiPersistence: ReleaseSigningProviderPkiPersistence,
): Exclude<ReleaseSigningProviderKind, 'external-kms'> {
  return pkiPersistence.mode === 'ephemeral' ? 'runtime-ephemeral' : 'file-pem';
}

export function buildReleaseSigningProviderDiagnostics(input: {
  readonly runtimeProfile: AttestorRuntimeProfile;
  readonly pkiPersistence: ReleaseSigningProviderPkiPersistence;
  readonly env?: Readonly<Record<string, string | undefined>>;
}): ReleaseSigningProviderDiagnostics {
  const env = input.env ?? process.env;
  const configuredProvider = normalizedProvider(env);
  assertKnownProvider(configuredProvider);

  const derivedProvider = derivedProviderFromPki(input.pkiPersistence);
  const productionProviderRequired = booleanEnv(
    env,
    ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER_ENV,
  );
  const kind = configuredProvider ?? derivedProvider;
  const blockers: string[] = [];

  if (kind === 'runtime-ephemeral') {
    blockers.push('release signer is ephemeral and changes on runtime restart');
  }
  if (kind === 'file-pem') {
    blockers.push(
      'release signer private key is exportable file-backed PEM; use an external KMS/HSM provider before production promotion',
    );
  }
  if (kind === 'external-kms') {
    blockers.push(
      'external KMS/HSM release signing provider is declared but not implemented in this runtime',
    );
  }
  if (configuredProvider !== null && configuredProvider !== 'external-kms' && configuredProvider !== derivedProvider) {
    blockers.push(
      `configured release signing provider ${configuredProvider} does not match resolved runtime signer ${derivedProvider}`,
    );
  }
  if (productionProviderRequired && kind !== 'external-kms') {
    blockers.push(
      `${ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER_ENV}=true requires an external KMS/HSM release signing provider`,
    );
  }

  return Object.freeze({
    version: RELEASE_SIGNING_PROVIDER_DIAGNOSTICS_SPEC_VERSION,
    kind,
    configuredProvider,
    derivedProvider,
    productionProviderRequired,
    productionReady: false,
    privateKeyExportable: kind !== 'external-kms',
    signingBoundary:
      kind === 'runtime-ephemeral'
        ? 'runtime-memory'
        : kind === 'file-pem'
          ? 'runtime-file-pem'
          : 'external-kms-hsm',
    rotationManagedBy:
      kind === 'runtime-ephemeral'
        ? 'runtime-ephemeral'
        : kind === 'file-pem'
          ? 'runtime-file-store'
          : 'external-provider',
    publicVerificationKeysServedBy: 'runtime-jwks',
    pkiPath: input.pkiPersistence.path,
    blockers: Object.freeze(blockers),
  });
}

export function assertReleaseSigningProviderPreflight(input: {
  readonly env?: Readonly<Record<string, string | undefined>>;
} = {}): void {
  const env = input.env ?? process.env;
  const configuredProvider = normalizedProvider(env);
  assertKnownProvider(configuredProvider);

  if (configuredProvider === 'external-kms') {
    throw new ReleaseSigningProviderConfigurationError(
      `${ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV}=external-kms is not implemented yet; refusing to fall back to local release signer material`,
    );
  }
  if (booleanEnv(env, ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER_ENV)) {
    throw new ReleaseSigningProviderConfigurationError(
      `${ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER_ENV}=true requires a supported external KMS/HSM release signing provider; refusing to use local release signer material`,
    );
  }
}

export function assertReleaseSigningProviderAllowed(input: {
  readonly runtimeProfile: AttestorRuntimeProfile;
  readonly pkiPersistence: ReleaseSigningProviderPkiPersistence;
  readonly env?: Readonly<Record<string, string | undefined>>;
}): ReleaseSigningProviderDiagnostics {
  const diagnostics = buildReleaseSigningProviderDiagnostics(input);

  if (diagnostics.kind === 'external-kms') {
    throw new ReleaseSigningProviderConfigurationError(
      `${ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV}=external-kms is not implemented yet; refusing to fall back to local release signer material`,
      diagnostics,
    );
  }
  if (
    diagnostics.configuredProvider !== null &&
    diagnostics.configuredProvider !== diagnostics.derivedProvider
  ) {
    throw new ReleaseSigningProviderConfigurationError(
      `Configured release signing provider ${diagnostics.configuredProvider} does not match resolved runtime signer ${diagnostics.derivedProvider}.`,
      diagnostics,
    );
  }
  if (diagnostics.productionProviderRequired) {
    throw new ReleaseSigningProviderConfigurationError(
      `${ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER_ENV}=true requires a supported external KMS/HSM release signing provider; refusing to use local release signer material`,
      diagnostics,
    );
  }

  return diagnostics;
}
