import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  INTENT_SOLVER_COUNTERPARTY_SCREENING_STATUSES,
  INTENT_SOLVER_ORDER_KINDS,
  INTENT_SOLVER_REPLAY_PROTECTION_MODES,
  INTENT_SOLVER_SETTLEMENT_METHODS,
  type IntentSolverAdmissionExpectation,
  type IntentSolverCounterpartyScreeningStatus,
  type IntentSolverExpectationKind,
  type IntentSolverExpectationStatus,
  type IntentSolverOrderKind,
  type IntentSolverReplayProtectionMode,
  type IntentSolverSettlementMethod,
} from './intent-solver-types.js';

function includesValue<T extends string>(
  values: readonly T[],
  candidate: string,
): candidate is T {
  return (values as readonly string[]).includes(candidate);
}

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    throw new Error(`intent-solver admission ${fieldName} requires a non-empty value.`);
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

export function normalizeStringList(values: readonly string[], fieldName: string): readonly string[] {
  if (values.length === 0) {
    throw new Error(`intent-solver admission ${fieldName} requires at least one value.`);
  }
  return Object.freeze(
    values.map((value, index) => normalizeIdentifier(value, `${fieldName}[${index}]`)),
  );
}

export function normalizeOptionalStringList(
  values: readonly string[] | null | undefined,
  fieldName: string,
): readonly string[] | null {
  if (values === undefined || values === null) return null;
  return Object.freeze(
    values.map((value, index) => normalizeIdentifier(value, `${fieldName}[${index}]`)),
  );
}

export function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`intent-solver admission ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

export function normalizeOptionalIsoTimestamp(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIsoTimestamp(value, fieldName);
}

export function normalizeOrderKind(value: string): IntentSolverOrderKind {
  const normalized = normalizeIdentifier(value, 'order.orderKind');
  if (!includesValue(INTENT_SOLVER_ORDER_KINDS, normalized)) {
    throw new Error(`intent-solver admission orderKind is unsupported: ${normalized}.`);
  }
  return normalized;
}

export function normalizeSettlementMethod(value: string): IntentSolverSettlementMethod {
  const normalized = normalizeIdentifier(value, 'settlement.settlementMethod');
  if (!includesValue(INTENT_SOLVER_SETTLEMENT_METHODS, normalized)) {
    throw new Error(`intent-solver admission settlementMethod is unsupported: ${normalized}.`);
  }
  return normalized;
}

export function normalizeReplayProtectionMode(value: string): IntentSolverReplayProtectionMode {
  const normalized = normalizeIdentifier(value, 'replay.replayProtectionMode');
  if (!includesValue(INTENT_SOLVER_REPLAY_PROTECTION_MODES, normalized)) {
    throw new Error(
      `intent-solver admission replayProtectionMode is unsupported: ${normalized}.`,
    );
  }
  return normalized;
}

export function normalizeScreeningStatus(value: string): IntentSolverCounterpartyScreeningStatus {
  const normalized = normalizeIdentifier(value, 'counterparty.screeningStatus');
  if (!includesValue(INTENT_SOLVER_COUNTERPARTY_SCREENING_STATUSES, normalized)) {
    throw new Error(
      `intent-solver admission screeningStatus is unsupported: ${normalized}.`,
    );
  }
  return normalized;
}

export function normalizeAtomicUnits(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^(?:0|[1-9]\d*)$/u.test(normalized)) {
    throw new Error(`intent-solver admission ${fieldName} must be unsigned atomic units.`);
  }
  return normalized;
}

export function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`intent-solver admission ${fieldName} must be a non-negative integer.`);
  }
  return value;
}

export function normalizePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`intent-solver admission ${fieldName} must be a positive integer.`);
  }
  return value;
}

export function parseAtomicUnits(value: string, fieldName: string): bigint {
  return BigInt(normalizeAtomicUnits(value, fieldName));
}

export function sameIdentifier(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left?.trim() ?? '').toLowerCase() === (right?.trim() ?? '').toLowerCase();
}

export function deadlineInFuture(deadline: string | null, createdAt: string): boolean {
  if (deadline === null) return true;
  return Date.parse(deadline) > Date.parse(createdAt);
}

export function deadlineNotAfter(
  left: string | null,
  right: string,
): boolean {
  if (left === null) return true;
  return Date.parse(left) <= Date.parse(right);
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

export function expectation(input: {
  readonly kind: IntentSolverExpectationKind;
  readonly status: IntentSolverExpectationStatus;
  readonly reasonCode: string;
  readonly evidence?: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}): IntentSolverAdmissionExpectation {
  return Object.freeze({
    kind: input.kind,
    status: input.status,
    reasonCode: normalizeIdentifier(input.reasonCode, 'expectation.reasonCode'),
    evidence: Object.freeze(input.evidence ?? {}),
  });
}
