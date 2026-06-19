import { createHash } from 'node:crypto';
import { canonicalizeReleaseJson, type CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';

export function normalizeIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    throw new Error(`Crypto adapter readiness ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

export function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

export function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Crypto adapter readiness ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

export function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

export function unique<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}
