import { createHash } from 'node:crypto';
import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  ENFORCEMENT_FAILURE_REASONS,
  type EnforcementFailureReason,
} from './types.js';

export function sha256(value: string | Uint8Array | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function uniqueFailureReasons(
  reasons: readonly EnforcementFailureReason[],
): readonly EnforcementFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(ENFORCEMENT_FAILURE_REASONS.filter((reason) => present.has(reason)));
}

export function normalizeIdentifier(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function requireIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value);
  if (normalized === null) {
    throw new Error(`Envoy ext_authz bridge ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

export function normalizeIsoTimestamp(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Envoy ext_authz bridge now() must return a valid ISO timestamp.');
  }
  return timestamp.toISOString();
}

export function canonicalValue(value: unknown): CanonicalReleaseJsonValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Envoy ext_authz bridge canonical metadata cannot contain non-finite numbers.');
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalValue(entry));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Readonly<Record<string, unknown>>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }

  return String(value);
}
