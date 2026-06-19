import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CustodyCosignerAuthMethod,
  CustodyPolicyProvider,
} from '../crypto-authorization-core/custody-cosigner-policy-adapter.js';
import type {
  CustodyPolicyAdmissionExpectation,
  CustodyPolicyAdmissionExpectationKind,
  CustodyPolicyAdmissionExpectationStatus,
  CustodyPolicyCallbackProtocol,
  CustodyPolicyCallbackProviderProfile,
} from './custody-policy-callback-types.js';

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    throw new Error(`custody policy admission callback ${fieldName} requires a non-empty value.`);
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
    throw new Error(`custody policy admission callback ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

export function normalizeNonNegativeNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `custody policy admission callback ${fieldName} must be a non-negative number.`,
    );
  }
  return value;
}

export function normalizeAtomicUnits(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^(?:0|[1-9]\d*)$/u.test(normalized)) {
    throw new Error(
      `custody policy admission callback ${fieldName} must be unsigned atomic units.`,
    );
  }
  return normalized;
}

export function normalizeOptionalUrl(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  const normalized = normalizeOptionalIdentifier(value, fieldName);
  if (normalized === null) return null;
  try {
    return new URL(normalized).toString();
  } catch {
    throw new Error(`custody policy admission callback ${fieldName} must be a URL.`);
  }
}

export function sameIdentifier(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left?.trim() ?? '').toLowerCase() === (right?.trim() ?? '').toLowerCase();
}

export function parseAtomicUnits(value: string, fieldName: string): bigint {
  return BigInt(normalizeAtomicUnits(value, fieldName));
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

export function providerProfileFor(
  provider: CustodyPolicyProvider | string,
): CustodyPolicyCallbackProviderProfile {
  const normalized = normalizeIdentifier(provider, 'provider').toLowerCase();
  if (normalized === 'fireblocks') {
    return Object.freeze({
      provider,
      integrationMode: 'sync-callback',
      responseDeadlineSeconds: 30,
      standards: Object.freeze([
        'Fireblocks API co-signer callback',
        'MPC custody signing',
      ]),
    });
  }
  if (normalized === 'turnkey') {
    return Object.freeze({
      provider,
      integrationMode: 'policy-consensus',
      responseDeadlineSeconds: null,
      standards: Object.freeze([
        'Turnkey policy engine',
        'Turnkey activity consensus',
      ]),
    });
  }
  return Object.freeze({
    provider,
    integrationMode: 'approval-queue',
    responseDeadlineSeconds: null,
    standards: Object.freeze([
      'custody policy engine',
      'co-signer callback',
    ]),
  });
}

export function protocolFor(authMethod: CustodyCosignerAuthMethod | string): CustodyPolicyCallbackProtocol {
  switch (authMethod) {
    case 'jwt-public-key':
    case 'jws':
      return 'jwt-signed-json';
    case 'tls-certificate-pinning':
      return 'tls-pinned-json';
    case 'hmac':
      return 'hmac-signed-json';
    case 'mtls':
    case 'spiffe':
      return 'sender-constrained-json';
    default:
      return 'sender-constrained-json';
  }
}

export function signedResponseRequired(protocol: CustodyPolicyCallbackProtocol): boolean {
  return protocol === 'jwt-signed-json' || protocol === 'hmac-signed-json';
}

export function expectation(input: {
  readonly kind: CustodyPolicyAdmissionExpectationKind;
  readonly status: CustodyPolicyAdmissionExpectationStatus;
  readonly reasonCode: string;
  readonly evidence?: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}): CustodyPolicyAdmissionExpectation {
  return Object.freeze({
    kind: input.kind,
    status: input.status,
    reasonCode: normalizeIdentifier(input.reasonCode, 'expectation.reasonCode'),
    evidence: Object.freeze(input.evidence ?? {}),
  });
}
