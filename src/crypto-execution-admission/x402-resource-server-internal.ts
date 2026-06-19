import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  X402_RESOURCE_SERVER_ADMISSION_PHASES,
  type X402ResourceServerAdmissionExpectation,
  type X402ResourceServerAdmissionExpectationKind,
  type X402ResourceServerAdmissionExpectationStatus,
  type X402ResourceServerAdmissionPhase,
  type X402ResourceServerRuntimeObservation,
} from './x402-resource-server-types.js';

function includesValue<T extends string>(
  values: readonly T[],
  candidate: string,
): candidate is T {
  return (values as readonly string[]).includes(candidate);
}

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    throw new Error(
      `x402 resource-server admission ${fieldName} requires a non-empty value.`,
    );
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
    throw new Error(
      `x402 resource-server admission ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
}

export function normalizeMethod(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName).toUpperCase();
  if (!/^[A-Z]+$/u.test(normalized)) {
    throw new Error(
      `x402 resource-server admission ${fieldName} must be an HTTP token.`,
    );
  }
  return normalized;
}

export function normalizeUrl(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  try {
    return new URL(normalized).toString();
  } catch {
    throw new Error(`x402 resource-server admission ${fieldName} must be a URL.`);
  }
}

export function normalizePhase(value: string): X402ResourceServerAdmissionPhase {
  if (!includesValue(X402_RESOURCE_SERVER_ADMISSION_PHASES, value)) {
    throw new Error(
      `x402 resource-server admission phase must be one of ${X402_RESOURCE_SERVER_ADMISSION_PHASES.join(', ')}.`,
    );
  }
  return value;
}

export function normalizeComparable(value: string | null | undefined): string {
  const normalized = normalizeIdentifier(value, 'comparable');
  return normalized.startsWith('0x') ? normalized.toLowerCase() : normalized.toLowerCase();
}

export function normalizeRuntimeObservation(
  value: X402ResourceServerRuntimeObservation | null | undefined,
): X402ResourceServerRuntimeObservation | null {
  if (!value) return null;
  return Object.freeze({
    observedAt: normalizeIsoTimestamp(value.observedAt, 'runtimeObservation.observedAt'),
    paymentRequiredHeaderSent:
      value.paymentRequiredHeaderSent === undefined
        ? null
        : Boolean(value.paymentRequiredHeaderSent),
    paymentSignatureHeaderSeen:
      value.paymentSignatureHeaderSeen === undefined
        ? null
        : Boolean(value.paymentSignatureHeaderSeen),
    paymentResponseHeaderSent:
      value.paymentResponseHeaderSent === undefined
        ? null
        : Boolean(value.paymentResponseHeaderSent),
    verifyAccepted:
      value.verifyAccepted === undefined ? null : Boolean(value.verifyAccepted),
    settlementAccepted:
      value.settlementAccepted === undefined ? null : Boolean(value.settlementAccepted),
    fulfillmentDeferredUntilSettlement:
      value.fulfillmentDeferredUntilSettlement === undefined
        ? null
        : Boolean(value.fulfillmentDeferredUntilSettlement),
    resourceFulfilled:
      value.resourceFulfilled === undefined ? null : Boolean(value.resourceFulfilled),
    duplicatePaymentBlocked:
      value.duplicatePaymentBlocked === undefined
        ? null
        : Boolean(value.duplicatePaymentBlocked),
    returnedStatusCode:
      value.returnedStatusCode === undefined || value.returnedStatusCode === null
        ? null
        : value.returnedStatusCode,
  });
}

export function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  const digest = createHash('sha256').update(canonical).digest('hex');
  return Object.freeze({
    canonical,
    digest: `sha256:${digest}`,
  });
}

export function expectation(
  kind: X402ResourceServerAdmissionExpectationKind,
  status: X402ResourceServerAdmissionExpectationStatus,
  reasonCode: string,
  evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>,
): X402ResourceServerAdmissionExpectation {
  return Object.freeze({
    kind,
    status,
    reasonCode,
    evidence,
  });
}
