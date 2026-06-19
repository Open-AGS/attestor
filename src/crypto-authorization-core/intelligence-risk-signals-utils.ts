import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CRYPTO_AUTHORIZATION_POLICY_DIMENSIONS,
  type CryptoAuthorizationPolicyDimension,
  type CryptoAuthorizationRiskClass,
} from './types.js';
import type {
  CryptoIntelligenceEvidenceRef,
  CryptoIntelligenceMissingEvidenceClass,
  CryptoIntelligenceRiskSignal,
  CryptoIntelligenceSignalCategory,
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals-types.js';

const SEVERITY_RANK: Record<CryptoIntelligenceSignalSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

const DISPOSITION_RANK: Record<CryptoIntelligenceSignalDisposition, number> = {
  admit: 0,
  review: 1,
  block: 2,
};

const USD_SCALE = 6;

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`Crypto intelligence risk signals ${fieldName} requires a non-empty value.`);
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
    throw new Error(`Crypto intelligence risk signals ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

export function parseDecimalToScaledUnits(value: string, fieldName: string): bigint {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(normalized)) {
    throw new Error(`Crypto intelligence risk signals ${fieldName} must be a non-negative decimal with up to 6 fractional digits.`);
  }
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 10n ** BigInt(USD_SCALE) + BigInt(fraction.padEnd(USD_SCALE, '0'));
}

export function decimalAtLeast(value: string, threshold: string): boolean {
  return (
    parseDecimalToScaledUnits(value, 'normalizedUsd') >=
    parseDecimalToScaledUnits(threshold, 'threshold')
  );
}

export function maxSeverity(
  left: CryptoIntelligenceSignalSeverity,
  right: CryptoIntelligenceSignalSeverity,
): CryptoIntelligenceSignalSeverity {
  return SEVERITY_RANK[left] >= SEVERITY_RANK[right] ? left : right;
}

export function maxDisposition(
  left: CryptoIntelligenceSignalDisposition,
  right: CryptoIntelligenceSignalDisposition,
): CryptoIntelligenceSignalDisposition {
  return DISPOSITION_RANK[left] >= DISPOSITION_RANK[right] ? left : right;
}

export function unique<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

export function uniqueEvidenceRefs(
  refs: readonly CryptoIntelligenceEvidenceRef[],
): readonly CryptoIntelligenceEvidenceRef[] {
  const seen = new Set<string>();
  const output: CryptoIntelligenceEvidenceRef[] = [];
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push(Object.freeze(ref));
    }
  }
  return Object.freeze(output);
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

export function riskClassSeverity(
  riskClass: CryptoAuthorizationRiskClass,
): CryptoIntelligenceSignalSeverity {
  switch (riskClass) {
    case 'R0':
    case 'R1':
      return 'info';
    case 'R2':
    case 'R3':
      return 'warning';
    case 'R4':
      return 'critical';
  }
}

export function signal(input: {
  readonly code: string;
  readonly category: CryptoIntelligenceSignalCategory;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly message: string;
  readonly sourceRiskClass?: CryptoAuthorizationRiskClass | null;
  readonly requiredPolicyDimensions?: readonly CryptoAuthorizationPolicyDimension[];
  readonly missingEvidenceClasses?: readonly CryptoIntelligenceMissingEvidenceClass[];
  readonly evidenceRefs?: readonly CryptoIntelligenceEvidenceRef[];
}): CryptoIntelligenceRiskSignal {
  for (const dimension of input.requiredPolicyDimensions ?? []) {
    if (!CRYPTO_AUTHORIZATION_POLICY_DIMENSIONS.includes(dimension)) {
      throw new Error(`Crypto intelligence risk signals do not support policy dimension ${dimension}.`);
    }
  }

  return Object.freeze({
    code: normalizeIdentifier(input.code, 'signal.code'),
    category: input.category,
    severity: input.severity,
    disposition: input.disposition,
    message: normalizeIdentifier(input.message, 'signal.message'),
    sourceRiskClass: input.sourceRiskClass ?? null,
    requiredPolicyDimensions: Object.freeze([...(input.requiredPolicyDimensions ?? [])]),
    missingEvidenceClasses: Object.freeze([...(input.missingEvidenceClasses ?? [])]),
    evidenceRefs: uniqueEvidenceRefs(input.evidenceRefs ?? []),
  });
}
