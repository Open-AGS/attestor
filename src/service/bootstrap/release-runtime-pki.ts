import { existsSync, readFileSync, chmodSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generatePkiHierarchy } from '../../signing/pki-chain.js';
import { withFileLock, writeTextFileAtomic } from '../file-store.js';
import { envTruthy } from '../deployment-safety.js';
import type {
  AttestorRuntimeProfile,
} from './runtime-profile.js';

export const RELEASE_ISSUER = 'attestor.api.release.local';
const API_CA_SUBJECT = 'Attestor Keyless CA';
const API_SIGNER_SUBJECT = 'API Runtime Signer';
const API_REVIEWER_SUBJECT = 'API Reviewer';

export const ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV = 'ATTESTOR_RELEASE_RUNTIME_PKI_PATH';
export const ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV =
  'ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH';
export const ATTESTOR_RELEASE_RUNTIME_PKI_REQUIRE_SHARED_PATH_ENV =
  'ATTESTOR_RELEASE_RUNTIME_PKI_REQUIRE_SHARED_PATH';
export const ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID_ENV =
  'ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID';
export const RELEASE_RUNTIME_PKI_STORE_SPEC_VERSION = 'attestor.release-runtime-pki-store.v1';

export type ReleaseRuntimePki = ReturnType<typeof generatePkiHierarchy>;

interface StoredReleaseRuntimeVerificationKey {
  readonly keyId: string;
  readonly algorithm: 'EdDSA';
  readonly publicKeyFingerprint: string;
  readonly publicKeyPem: string;
  readonly retiredAt: string;
  readonly rotationId: string | null;
}

export interface ReleaseRuntimePkiPersistence {
  readonly mode: 'ephemeral' | 'file';
  readonly path: string | null;
  readonly sharedPathRequired: boolean;
  readonly sharedPathAttested: boolean;
  readonly generated: boolean;
  readonly rotated: boolean;
  readonly rotationId: string | null;
  readonly retiredVerificationKeyCount: number;
}

interface StoredReleaseRuntimePki {
  readonly version: typeof RELEASE_RUNTIME_PKI_STORE_SPEC_VERSION;
  readonly issuer: typeof RELEASE_ISSUER;
  readonly createdAt: string;
  readonly rotationId?: string | null;
  readonly rotatedAt?: string | null;
  readonly retiredVerificationKeys?: readonly StoredReleaseRuntimeVerificationKey[];
  readonly pki: ReleaseRuntimePki;
}

function releaseRuntimePkiPath(): string {
  const configured = process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV]?.trim();
  return configured && configured.length > 0
    ? configured
    : join(process.cwd(), '.attestor', 'release-runtime-pki.json');
}

function releaseRuntimePkiPathConfigured(): boolean {
  return Boolean(process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV]?.trim());
}

function releaseRuntimePkiSharedPathRequired(runtimeProfile?: AttestorRuntimeProfile): boolean {
  return runtimeProfile?.id === 'production-shared'
    || envTruthy(process.env.ATTESTOR_HA_MODE)
    || envTruthy(process.env[ATTESTOR_RELEASE_RUNTIME_PKI_REQUIRE_SHARED_PATH_ENV]);
}

function releaseRuntimePkiSharedPathAttested(): boolean {
  return envTruthy(process.env[ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV]);
}

function assertReleaseRuntimePkiSharedPathBoundary(
  runtimeProfile?: AttestorRuntimeProfile,
): {
  readonly sharedPathRequired: boolean;
  readonly sharedPathAttested: boolean;
} {
  const sharedPathRequired = releaseRuntimePkiSharedPathRequired(runtimeProfile);
  const sharedPathAttested = releaseRuntimePkiSharedPathAttested();
  if (!sharedPathRequired) return { sharedPathRequired, sharedPathAttested };

  if (!releaseRuntimePkiPathConfigured()) {
    throw new Error(
      `${ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV} must be set explicitly when release runtime PKI shared-path enforcement is required.`,
    );
  }
  if (!sharedPathAttested) {
    throw new Error(
      `${ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV}=true is required when release runtime PKI shared-path enforcement is required.`,
    );
  }
  return { sharedPathRequired, sharedPathAttested };
}

function releaseRuntimePkiRotationId(): string | null {
  const configured = process.env[ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID_ENV]?.trim();
  return configured && configured.length > 0 ? configured : null;
}

function assertPem(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || !value.includes('-----BEGIN') || !value.includes('-----END')) {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.`);
  }
}

function assertStoredVerificationKey(
  value: unknown,
  fieldName: string,
): asserts value is StoredReleaseRuntimeVerificationKey {
  const record = value as Partial<StoredReleaseRuntimeVerificationKey> | undefined;
  if (!record || typeof record !== 'object') {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.`);
  }
  if (typeof record.keyId !== 'string' || record.keyId.length === 0) {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.keyId.`);
  }
  if (record.algorithm !== 'EdDSA') {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.algorithm.`);
  }
  if (
    typeof record.publicKeyFingerprint !== 'string' ||
    record.publicKeyFingerprint.length === 0
  ) {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.publicKeyFingerprint.`);
  }
  assertPem(record.publicKeyPem, `${fieldName}.publicKeyPem`);
  if (typeof record.retiredAt !== 'string' || Number.isNaN(new Date(record.retiredAt).getTime())) {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.retiredAt.`);
  }
  if (record.rotationId !== null && typeof record.rotationId !== 'string') {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.rotationId.`);
  }
}

function signerVerificationKeyFromPki(
  pki: ReleaseRuntimePki,
  retiredAt: string,
  rotationId: string | null,
): StoredReleaseRuntimeVerificationKey {
  return Object.freeze({
    keyId: pki.signer.keyPair.fingerprint,
    algorithm: 'EdDSA' as const,
    publicKeyFingerprint: pki.signer.keyPair.fingerprint,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    retiredAt,
    rotationId,
  });
}

function parseStoredReleaseRuntimePki(content: string): {
  pki: ReleaseRuntimePki;
  rotationId: string | null;
  retiredVerificationKeys: readonly StoredReleaseRuntimeVerificationKey[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Release runtime PKI store is not valid JSON.');
  }

  const record = parsed as Partial<StoredReleaseRuntimePki>;
  if (record.version !== RELEASE_RUNTIME_PKI_STORE_SPEC_VERSION) {
    throw new Error('Release runtime PKI store has an unsupported version.');
  }
  if (record.issuer !== RELEASE_ISSUER) {
    throw new Error('Release runtime PKI store issuer does not match this runtime.');
  }

  const pki = record.pki as ReleaseRuntimePki | undefined;
  assertPem(pki?.ca?.keyPair?.privateKeyPem, 'ca.keyPair.privateKeyPem');
  assertPem(pki?.ca?.keyPair?.publicKeyPem, 'ca.keyPair.publicKeyPem');
  assertPem(pki?.signer?.keyPair?.privateKeyPem, 'signer.keyPair.privateKeyPem');
  assertPem(pki?.signer?.keyPair?.publicKeyPem, 'signer.keyPair.publicKeyPem');
  assertPem(pki?.reviewer?.keyPair?.privateKeyPem, 'reviewer.keyPair.privateKeyPem');
  assertPem(pki?.reviewer?.keyPair?.publicKeyPem, 'reviewer.keyPair.publicKeyPem');

  const retiredVerificationKeys = Array.isArray(record.retiredVerificationKeys)
    ? record.retiredVerificationKeys
    : [];
  retiredVerificationKeys.forEach((key, index) =>
    assertStoredVerificationKey(key, `retiredVerificationKeys[${index}]`),
  );

  return {
    pki,
    rotationId: typeof record.rotationId === 'string' ? record.rotationId : null,
    retiredVerificationKeys: Object.freeze([...retiredVerificationKeys]),
  };
}

function loadOrCreateFileBackedReleaseRuntimePki(
  path: string,
  runtimeProfile?: AttestorRuntimeProfile,
): {
  pki: ReleaseRuntimePki;
  retiredVerificationKeys: readonly StoredReleaseRuntimeVerificationKey[];
  persistence: ReleaseRuntimePkiPersistence;
} {
  const sharedPathBoundary = assertReleaseRuntimePkiSharedPathBoundary(runtimeProfile);
  mkdirSync(dirname(path), { recursive: true });
  return withFileLock(path, () => {
    const rotationId = releaseRuntimePkiRotationId();
    if (existsSync(path)) {
      const stored = parseStoredReleaseRuntimePki(readFileSync(path, 'utf8'));
      if (rotationId !== null && stored.rotationId !== rotationId) {
        const now = new Date().toISOString();
        const pki = generatePkiHierarchy(API_CA_SUBJECT, API_SIGNER_SUBJECT, API_REVIEWER_SUBJECT);
        const retiredVerificationKeys = Object.freeze([
          signerVerificationKeyFromPki(stored.pki, now, stored.rotationId),
          ...stored.retiredVerificationKeys,
        ]);
        const next: StoredReleaseRuntimePki = {
          version: RELEASE_RUNTIME_PKI_STORE_SPEC_VERSION,
          issuer: RELEASE_ISSUER,
          createdAt: now,
          rotationId,
          rotatedAt: now,
          retiredVerificationKeys,
          pki,
        };
        writeTextFileAtomic(path, `${JSON.stringify(next, null, 2)}\n`);
        try {
          chmodSync(path, 0o600);
        } catch {
          // chmod is best-effort on some Windows filesystems.
        }

        return {
          pki,
          retiredVerificationKeys,
          persistence: {
            mode: 'file',
            path,
            ...sharedPathBoundary,
            generated: true,
            rotated: true,
            rotationId,
            retiredVerificationKeyCount: retiredVerificationKeys.length,
          },
        };
      }

      return {
        pki: stored.pki,
        retiredVerificationKeys: stored.retiredVerificationKeys,
        persistence: {
          mode: 'file',
          path,
          ...sharedPathBoundary,
          generated: false,
          rotated: false,
          rotationId: stored.rotationId,
          retiredVerificationKeyCount: stored.retiredVerificationKeys.length,
        },
      };
    }

    const pki = generatePkiHierarchy(API_CA_SUBJECT, API_SIGNER_SUBJECT, API_REVIEWER_SUBJECT);
    const stored: StoredReleaseRuntimePki = {
      version: RELEASE_RUNTIME_PKI_STORE_SPEC_VERSION,
      issuer: RELEASE_ISSUER,
      createdAt: new Date().toISOString(),
      rotationId,
      rotatedAt: null,
      retiredVerificationKeys: [],
      pki,
    };
    writeTextFileAtomic(path, `${JSON.stringify(stored, null, 2)}\n`);
    try {
      chmodSync(path, 0o600);
    } catch {
      // chmod is best-effort on some Windows filesystems; the file remains
      // local to the selected runtime store path and is never committed.
    }

    return {
      pki,
      retiredVerificationKeys: [],
      persistence: {
        mode: 'file',
        path,
        ...sharedPathBoundary,
        generated: true,
        rotated: false,
        rotationId,
        retiredVerificationKeyCount: 0,
      },
    };
  });
}

export function resolveReleaseRuntimePki(
  runtimeProfile: AttestorRuntimeProfile,
  options: {
    readonly allowPreflightOnSharedPathViolation?: boolean;
  } = {},
): {
  pki: ReleaseRuntimePki;
  retiredVerificationKeys: readonly StoredReleaseRuntimeVerificationKey[];
  persistence: ReleaseRuntimePkiPersistence;
} {
  if (releaseRuntimePkiSharedPathRequired(runtimeProfile)) {
    try {
      assertReleaseRuntimePkiSharedPathBoundary(runtimeProfile);
    } catch (error) {
      if (
        runtimeProfile.id === 'production-shared' &&
        options.allowPreflightOnSharedPathViolation === true
      ) {
        return {
          pki: generatePkiHierarchy(API_CA_SUBJECT, API_SIGNER_SUBJECT, API_REVIEWER_SUBJECT),
          retiredVerificationKeys: [],
          persistence: {
            mode: 'ephemeral',
            path: null,
            sharedPathRequired: true,
            sharedPathAttested: false,
            generated: true,
            rotated: false,
            rotationId: null,
            retiredVerificationKeyCount: 0,
          },
        };
      }
      throw error;
    }
  }

  if (
    runtimeProfile.id === 'local-dev' &&
    !(process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV]?.trim())
  ) {
    return {
      pki: generatePkiHierarchy(API_CA_SUBJECT, API_SIGNER_SUBJECT, API_REVIEWER_SUBJECT),
      retiredVerificationKeys: [],
      persistence: {
        mode: 'ephemeral',
        path: null,
        sharedPathRequired: false,
        sharedPathAttested: false,
        generated: true,
        rotated: false,
        rotationId: null,
        retiredVerificationKeyCount: 0,
      },
    };
  }

  return loadOrCreateFileBackedReleaseRuntimePki(releaseRuntimePkiPath(), runtimeProfile);
}
