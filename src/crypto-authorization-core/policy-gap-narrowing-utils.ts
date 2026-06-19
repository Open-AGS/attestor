import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CryptoIntelligenceEvidenceRef,
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals.js';

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

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`Crypto policy gap narrowing ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

export function normalizeOptionalRef(value: string | null | undefined, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  const normalized = normalizeIdentifier(value, fieldName);
  if (/\s/.test(normalized)) {
    throw new Error(`Crypto policy gap narrowing ${fieldName} must be a compact scoped reference.`);
  }
  return normalized;
}

export function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Crypto policy gap narrowing ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

export function includesValue<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}

export function unique<T extends string>(values: readonly T[]): readonly T[] {
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

export function safeEvidenceRefs(
  refs: readonly CryptoIntelligenceEvidenceRef[],
): readonly CryptoIntelligenceEvidenceRef[] {
  const output: CryptoIntelligenceEvidenceRef[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const value = normalizeIdentifier(ref.value, 'evidenceRef.value');
    if (ref.kind === 'digest' && !value.startsWith('sha256:')) {
      throw new Error('Crypto policy gap narrowing digest evidence refs must use sha256 digests.');
    }
    if ((ref.kind === 'reason-code' || ref.kind === 'scoped-ref') && /\s/.test(value)) {
      throw new Error('Crypto policy gap narrowing reason-code and scoped-ref evidence refs must be compact.');
    }
    const key = `${ref.kind}:${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push(Object.freeze({ kind: ref.kind, value }));
    }
  }

  return Object.freeze(output);
}

export function safeReasonCodes(codes: readonly string[] | null | undefined): readonly string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const code of codes ?? []) {
    const normalized = normalizeIdentifier(code, 'reasonCode');
    if (/\s/.test(normalized)) {
      throw new Error('Crypto policy gap narrowing reason codes must be compact.');
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      output.push(normalized);
    }
  }
  return Object.freeze(output.sort());
}

export function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Crypto policy gap narrowing ${fieldName} must be a positive integer.`);
  }
  return value;
}
