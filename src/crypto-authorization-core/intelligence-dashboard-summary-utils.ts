import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import { stripTrailingSlashes } from '../platform/string-normalization.js';
import type {
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals.js';
import type {
  CryptoIntelligenceDashboardPriorityTier,
  CryptoIntelligenceDashboardReadinessStatus,
} from './intelligence-dashboard-summary-types.js';

export const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
export const MAP_KEY_SEPARATOR = '\u0000';
export const MAX_LABEL_LENGTH = 120;
export const MAX_TOP_ROWS = 8;

export const SEVERITY_RANK: Record<CryptoIntelligenceSignalSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

export const DISPOSITION_RANK: Record<CryptoIntelligenceSignalDisposition, number> = {
  admit: 0,
  review: 1,
  block: 2,
};

export const READINESS_STATUS_RANK: Record<CryptoIntelligenceDashboardReadinessStatus, number> = {
  ready: 0,
  'not-observed': 1,
  'needs-evidence': 2,
  blocked: 3,
};

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

export function includesValue<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}

export function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

export function normalizeCompactRef(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} requires a non-empty value.`);
  }
  if (/\s/u.test(normalized)) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must be a compact reference.`);
  }
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must not contain control characters.`);
  }
  return normalized;
}

export function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeCompactRef(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

export function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeDigest(value, fieldName);
}

export function normalizeLabel(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim().replaceAll(/\s+/gu, ' ') ?? '';
  if (normalized.length === 0) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} requires a non-empty label.`);
  }
  if (normalized.length > MAX_LABEL_LENGTH) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} is too long.`);
  }
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must not contain control characters.`);
  }
  return normalized;
}

export function normalizeProofRoute(value: string | null | undefined, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  const normalized = stripTrailingSlashes(normalizeCompactRef(value, fieldName));
  if (normalized === '') return '/';
  if (!normalized.startsWith('/')) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must be a local route path.`);
  }
  if (normalized.includes('?') || normalized.includes('#')) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must not include query or fragment material.`);
  }
  if (/(?:raw|payload|secret|customer|provider-response|wallet-metadata)/iu.test(normalized)) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must not expose raw-data drilldown routes.`);
  }
  return normalized;
}

export function normalizeReasonCode(value: string): string {
  return normalizeCompactRef(value, 'reasonCode');
}

export function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

export function strongerSeverity(
  left: CryptoIntelligenceSignalSeverity,
  right: CryptoIntelligenceSignalSeverity,
): CryptoIntelligenceSignalSeverity {
  return SEVERITY_RANK[right] > SEVERITY_RANK[left] ? right : left;
}

export function strongerDisposition(
  left: CryptoIntelligenceSignalDisposition,
  right: CryptoIntelligenceSignalDisposition,
): CryptoIntelligenceSignalDisposition {
  return DISPOSITION_RANK[right] > DISPOSITION_RANK[left] ? right : left;
}

export function priorityTierForDisposition(
  disposition: CryptoIntelligenceSignalDisposition,
): CryptoIntelligenceDashboardPriorityTier {
  if (disposition === 'block') return 'blocker';
  if (disposition === 'review') return 'review';
  return 'ready';
}

export function priorityTierForReadinessStatus(
  status: CryptoIntelligenceDashboardReadinessStatus,
): CryptoIntelligenceDashboardPriorityTier {
  if (status === 'blocked') return 'blocker';
  if (status === 'needs-evidence' || status === 'not-observed') return 'needs-evidence';
  return 'ready';
}

export function readinessScoreForStatus(
  status: CryptoIntelligenceDashboardReadinessStatus,
): number {
  switch (status) {
    case 'ready':
      return 100;
    case 'not-observed':
      return 50;
    case 'needs-evidence':
      return 25;
    case 'blocked':
      return 0;
  }
}

export function sourceKindSeverity(
  disposition: CryptoIntelligenceSignalDisposition,
): CryptoIntelligenceSignalSeverity {
  if (disposition === 'block') return 'critical';
  if (disposition === 'review') return 'warning';
  return 'info';
}
