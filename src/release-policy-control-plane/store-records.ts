import { canonicalizeReleaseJson } from '../release-kernel/release-canonicalization.js';
import {
  createSignablePolicyBundleArtifact,
  type SignablePolicyBundleArtifact,
} from './bundle-format.js';
import type {
  IssuedPolicyBundleSignature,
  PolicyBundleVerificationKey,
} from './bundle-signing.js';
import { verifyIssuedPolicyBundle } from './bundle-signing.js';
import type {
  PolicyActivationRecord,
  PolicyBundleManifest,
  PolicyControlPlaneMetadata,
  PolicyPackMetadata,
} from './object-model.js';

export const POLICY_STORE_RECORD_SPEC_VERSION =
  'attestor.policy-store-record.v1';
export const POLICY_STORE_SNAPSHOT_SPEC_VERSION =
  'attestor.policy-store-snapshot.v1';

export interface StoredPolicyBundleRecord {
  readonly version: typeof POLICY_STORE_RECORD_SPEC_VERSION;
  readonly packId: string;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly storedAt: string;
  readonly manifest: PolicyBundleManifest;
  readonly artifact: SignablePolicyBundleArtifact;
  readonly signedBundle: IssuedPolicyBundleSignature | null;
  readonly verificationKey: PolicyBundleVerificationKey | null;
}

export interface PolicyStoreSnapshot {
  readonly version: typeof POLICY_STORE_SNAPSHOT_SPEC_VERSION;
  readonly metadata: PolicyControlPlaneMetadata | null;
  readonly packs: readonly PolicyPackMetadata[];
  readonly bundles: readonly StoredPolicyBundleRecord[];
  readonly activations: readonly PolicyActivationRecord[];
}

export interface UpsertStoredPolicyBundleInput {
  readonly manifest: PolicyBundleManifest;
  readonly artifact: SignablePolicyBundleArtifact;
  readonly signedBundle?: IssuedPolicyBundleSignature | null;
  readonly verificationKey?: PolicyBundleVerificationKey | null;
  readonly storedAt?: string;
}

export interface PolicyStoreFile {
  readonly version: 1;
  metadata: PolicyControlPlaneMetadata | null;
  packs: PolicyPackMetadata[];
  bundles: StoredPolicyBundleRecord[];
  activations: PolicyActivationRecord[];
}

export function defaultPolicyStoreFile(): PolicyStoreFile {
  return {
    version: 1,
    metadata: null,
    packs: [],
    bundles: [],
    activations: [],
  };
}

function resolveStoredAt(storedAt?: string): string {
  const timestamp = storedAt ? new Date(storedAt) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Policy store records require a valid storedAt timestamp.');
  }
  return timestamp.toISOString();
}

function assertBundleRecordCoherence(
  input: UpsertStoredPolicyBundleInput,
): void {
  const manifestBundle = input.manifest.bundle;
  if (
    input.artifact.bundleId !== manifestBundle.bundleId ||
    input.artifact.packId !== manifestBundle.packId
  ) {
    throw new Error('Policy store bundle artifact must match the manifest bundle reference.');
  }

  const expectedArtifact = createSignablePolicyBundleArtifact(
    input.artifact.statement.predicate.pack,
    input.manifest,
  );
  if (
    input.artifact.version !== expectedArtifact.version ||
    input.artifact.bundleId !== expectedArtifact.bundleId ||
    input.artifact.packId !== expectedArtifact.packId ||
    input.artifact.payloadType !== expectedArtifact.payloadType ||
    input.artifact.canonicalPayload !== expectedArtifact.canonicalPayload ||
    input.artifact.payloadDigest !== expectedArtifact.payloadDigest ||
    input.artifact.packDigest !== expectedArtifact.packDigest ||
    input.artifact.manifestDigest !== expectedArtifact.manifestDigest ||
    input.artifact.entriesDigest !== expectedArtifact.entriesDigest ||
    input.artifact.schemasDigest !== expectedArtifact.schemasDigest ||
    canonicalizeReleaseJson(input.artifact.statement as never) !==
      expectedArtifact.canonicalPayload
  ) {
    throw new Error(
      'Policy store bundle artifact must be regenerated from the supplied manifest and pack predicate.',
    );
  }

  if (input.signedBundle) {
    if (
      input.signedBundle.artifact.bundleId !== input.artifact.bundleId ||
      input.signedBundle.artifact.packId !== input.artifact.packId
    ) {
      throw new Error('Policy store signed bundle must wrap the same bundle artifact.');
    }
    if (
      input.signedBundle.artifact.payloadDigest !== input.artifact.payloadDigest ||
      input.signedBundle.artifact.canonicalPayload !== input.artifact.canonicalPayload ||
      canonicalizeReleaseJson(input.signedBundle.artifact as never) !==
        canonicalizeReleaseJson(input.artifact as never)
    ) {
      throw new Error('Policy store signed bundle must wrap the exact bundle artifact content.');
    }
  }

  if (input.verificationKey && input.signedBundle) {
    if (input.verificationKey.keyId !== input.signedBundle.keyId) {
      throw new Error('Policy store verification key must match the signed bundle key id.');
    }
  }
  if (input.signedBundle) {
    const verificationKey = input.verificationKey ?? input.signedBundle.verificationKey;
    verifyIssuedPolicyBundle({
      issuedBundle: input.signedBundle,
      verificationKey,
    });
  }
}

export function assertBundleRecordContentIsImmutable(
  existing: StoredPolicyBundleRecord,
  next: StoredPolicyBundleRecord,
): void {
  if (
    existing.manifest.bundle.digest !== next.manifest.bundle.digest ||
    existing.artifact.payloadDigest !== next.artifact.payloadDigest ||
    existing.bundleVersion !== next.bundleVersion
  ) {
    throw new Error(
      'Policy store bundle content is immutable for an existing packId and bundleId; publish changed content under a new bundleId.',
    );
  }
}

export function compareBundleRecords(
  left: StoredPolicyBundleRecord,
  right: StoredPolicyBundleRecord,
): number {
  const byStoredAt =
    Date.parse(right.storedAt) - Date.parse(left.storedAt);
  if (byStoredAt !== 0) return byStoredAt;
  return (
    right.bundleVersion.localeCompare(left.bundleVersion) ||
    right.bundleId.localeCompare(left.bundleId)
  );
}

export function comparePacks(
  left: PolicyPackMetadata,
  right: PolicyPackMetadata,
): number {
  return left.id.localeCompare(right.id);
}

export function compareActivations(
  left: PolicyActivationRecord,
  right: PolicyActivationRecord,
): number {
  const byActivatedAt =
    Date.parse(right.activatedAt) - Date.parse(left.activatedAt);
  if (byActivatedAt !== 0) return byActivatedAt;
  return right.id.localeCompare(left.id);
}

export function cloneAndFreeze<T>(value: T): T {
  const clone = structuredClone(value);

  function deepFreeze(input: unknown): unknown {
    if (input === null || typeof input !== 'object') {
      return input;
    }
    if (Object.isFrozen(input)) {
      return input;
    }
    if (Array.isArray(input)) {
      for (const item of input) {
        deepFreeze(item);
      }
      return Object.freeze(input);
    }

    for (const nested of Object.values(input)) {
      deepFreeze(nested);
    }
    return Object.freeze(input);
  }

  return deepFreeze(clone) as T;
}

export function normalizeBundleRecord(
  input: UpsertStoredPolicyBundleInput,
): StoredPolicyBundleRecord {
  assertBundleRecordCoherence(input);
  return cloneAndFreeze({
    version: POLICY_STORE_RECORD_SPEC_VERSION,
    packId: input.manifest.packId,
    bundleId: input.manifest.bundle.bundleId,
    bundleVersion: input.manifest.bundle.bundleVersion,
    storedAt: resolveStoredAt(input.storedAt),
    manifest: input.manifest,
    artifact: input.artifact,
    signedBundle: input.signedBundle ?? null,
    verificationKey:
      input.verificationKey ?? input.signedBundle?.verificationKey ?? null,
  });
}

export function normalizeSnapshot(file: PolicyStoreFile): PolicyStoreSnapshot {
  return cloneAndFreeze({
    version: POLICY_STORE_SNAPSHOT_SPEC_VERSION,
    metadata: file.metadata,
    packs: [...file.packs].sort(comparePacks),
    bundles: [...file.bundles].sort(compareBundleRecords),
    activations: [...file.activations].sort(compareActivations),
  });
}
