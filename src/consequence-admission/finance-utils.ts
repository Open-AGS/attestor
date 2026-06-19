import type { ConsequenceAdmissionProofRef, ConsequenceAdmissionRequest } from './index.js';
import type { OperationalPrimitive } from './finance-types.js';

export function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function statusOrNull(value: string | null | undefined): string | null {
  return textOrNull(value)?.toLowerCase() ?? null;
}

export function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function stringField(record: Record<string, unknown> | null | undefined, key: string): string | null {
  return textOrNull(record?.[key]);
}

export function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function boolOrNull(value: boolean | null | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function contextWithoutUndefined(
  input: Readonly<Record<string, OperationalPrimitive | undefined>>,
): Readonly<Record<string, OperationalPrimitive>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Record<string, OperationalPrimitive>,
  );
}

export function evidenceIds(
  request: ConsequenceAdmissionRequest,
  proof: readonly ConsequenceAdmissionProofRef[],
): readonly string[] {
  return Object.freeze([
    ...request.evidence.map((entry) => entry.id),
    ...proof.map((entry) => entry.id),
  ]);
}
