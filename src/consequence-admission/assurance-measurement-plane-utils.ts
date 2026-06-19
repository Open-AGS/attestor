import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

export function normalizeDigest(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Assurance measurement ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

export function normalizeDigestSet(values: readonly string[], fieldName: string): readonly string[] {
  return Object.freeze(
    [...new Set(values.map((value) => normalizeDigest(value, fieldName)))].sort(),
  );
}

export function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const trimmed = value.trim();
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Assurance measurement ${fieldName} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

export function normalizeGeneratedAt(value: string | null | undefined): string {
  return value ? normalizeIsoTimestamp(value, 'generatedAt') : new Date().toISOString();
}

export function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Assurance measurement ${fieldName} must be a non-negative integer.`);
  }
  return value;
}

export function normalizeNonNegativeNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Assurance measurement ${fieldName} must be a non-negative number.`);
  }
  return value;
}

export function normalizePositiveNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Assurance measurement ${fieldName} must be a positive number.`);
  }
  return value;
}
