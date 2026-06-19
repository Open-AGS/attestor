import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  GeneralCryptoTransactionAction,
  GeneralCryptoTransactionGateCheck,
  GeneralCryptoTransactionGateCheckOutcome,
  GeneralCryptoTransactionGateRiskClass,
} from './general-crypto-transaction-gate-types.js';

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CHAIN_ID_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,62}$/u;

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

export function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`General crypto transaction gate ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

export function normalizeDigest(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`General crypto transaction gate ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

export function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null || value.trim().length === 0) return null;
  return normalizeDigest(value, fieldName);
}

export function normalizeEnum<T extends readonly string[]>(
  value: T[number],
  allowed: T,
  fieldName: string,
): T[number] {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`General crypto transaction gate ${fieldName} is not supported.`);
  }
  return value;
}

export function optionalEnum<T extends readonly string[]>(
  value: T[number] | null | undefined,
  allowed: T,
  fallback: T[number],
  fieldName: string,
): T[number] {
  if (value === undefined || value === null) return fallback;
  return normalizeEnum(value, allowed, fieldName);
}

export function normalizeChainId(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!CHAIN_ID_PATTERN.test(normalized)) {
    throw new Error('General crypto transaction gate chainId must be a safe chain identifier.');
  }
  return normalized;
}

export function check(
  checkId: string,
  outcome: GeneralCryptoTransactionGateCheckOutcome,
  reasonCode: string,
  message: string,
  requiredEvidence: readonly string[],
  standards: readonly string[],
): GeneralCryptoTransactionGateCheck {
  return Object.freeze({
    checkId,
    outcome,
    reasonCode,
    message,
    requiredEvidence: Object.freeze([...requiredEvidence]),
    standards: Object.freeze([...standards]),
  });
}

export function digestPresenceCheck(
  checkId: string,
  digest: string | null,
  reasonCode: string,
  label: string,
  standards: readonly string[],
  reviewOnly = false,
): GeneralCryptoTransactionGateCheck {
  if (digest !== null) {
    return check(
      checkId,
      'pass',
      `${reasonCode}-bound`,
      `${label} digest is bound.`,
      [label],
      standards,
    );
  }
  return check(
    checkId,
    reviewOnly ? 'review' : 'fail',
    `${reasonCode}-missing`,
    `${label} digest is missing.`,
    [label],
    standards,
  );
}

export function riskClassFor(action: GeneralCryptoTransactionAction): GeneralCryptoTransactionGateRiskClass {
  if (
    action === 'bridge.transfer' ||
    action === 'session_key.grant' ||
    action === 'delegation.authorize'
  ) {
    return 'R4';
  }
  if (
    action === 'erc20.approve' ||
    action === 'permit.sign' ||
    action === 'swap.execute' ||
    action === 'safe.tx.propose' ||
    action === 'userop.submit'
  ) {
    return 'R3';
  }
  return 'R2';
}

export function standardsFor(action: GeneralCryptoTransactionAction): readonly string[] {
  switch (action) {
    case 'native.transfer':
      return Object.freeze(['EVM transaction']);
    case 'erc20.transfer':
      return Object.freeze(['ERC-20']);
    case 'erc20.approve':
      return Object.freeze(['ERC-20']);
    case 'permit.sign':
      return Object.freeze(['EIP-712', 'EIP-2612']);
    case 'swap.execute':
      return Object.freeze(['EIP-5792', 'simulation']);
    case 'bridge.transfer':
      return Object.freeze(['ERC-7683', 'simulation']);
    case 'safe.tx.propose':
      return Object.freeze(['Safe Transaction Service', 'Safe Guard']);
    case 'userop.submit':
      return Object.freeze(['ERC-4337', 'ERC-7562']);
    case 'session_key.grant':
      return Object.freeze(['ERC-7715']);
    case 'delegation.authorize':
      return Object.freeze(['EIP-7702']);
    case 'x402.pay':
      return Object.freeze(['x402']);
  }
}
