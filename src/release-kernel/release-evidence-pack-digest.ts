import { createHash } from 'node:crypto';
import type { EvidenceArtifactReference } from './object-model.js';
import { canonicalizeReleaseJson } from './release-canonicalization.js';

function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function taggedSha256Hex(value: string | Buffer): string {
  return `sha256:${sha256Hex(value)}`;
}

export function stripSha256Prefix(value: string): string {
  return value.startsWith('sha256:') ? value.slice('sha256:'.length) : value;
}

export function canonicalDigest(value: unknown): string {
  return taggedSha256Hex(canonicalizeReleaseJson(value as never));
}

const STRICT_SHA256_ARTIFACT_DIGEST = /^sha256:[0-9a-f]{64}$/u;

export function assertStrictSha256ArtifactDigest(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (!STRICT_SHA256_ARTIFACT_DIGEST.test(normalized)) {
    throw new Error(`${fieldName} must use sha256:<64 lowercase hex> syntax.`);
  }
  return normalized;
}

export function issuerDerivedArtifact(
  artifact: Omit<EvidenceArtifactReference, 'verificationStatus'>,
): EvidenceArtifactReference {
  return Object.freeze({
    ...artifact,
    digest: assertStrictSha256ArtifactDigest(artifact.digest, `artifact '${artifact.path}' digest`),
    verificationStatus: 'issuer-derived',
  });
}

export function declaredUnverifiedArtifact(
  artifact: EvidenceArtifactReference,
): EvidenceArtifactReference {
  const path = artifact.path.trim();
  if (!path) {
    throw new Error('Declared evidence artifact reference requires a non-empty path.');
  }

  return Object.freeze({
    kind: artifact.kind,
    path,
    digest: assertStrictSha256ArtifactDigest(artifact.digest, `artifact '${path}' digest`),
    verificationStatus: 'declared-unverified',
  });
}

export function canonicalEqual(left: unknown, right: unknown): boolean {
  return canonicalizeReleaseJson(left as never) === canonicalizeReleaseJson(right as never);
}
