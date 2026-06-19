import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import {
  CRYPTO_ALLOWANCE_AMOUNT_POSTURES,
  CRYPTO_ALLOWANCE_DURATION_POSTURES,
  CRYPTO_APPROVAL_ALLOWANCE_MECHANISMS,
  CRYPTO_APPROVAL_ALLOWANCE_REVOCATION_METHODS,
  type CryptoAllowanceAmountPosture,
  type CryptoAllowanceDurationPosture,
  type CryptoApprovalAllowanceCheck,
  type CryptoApprovalAllowanceMechanism,
  type CryptoApprovalAllowanceObservation,
  type CryptoApprovalAllowanceObservationStatus,
  type CryptoApprovalAllowanceRevocationPosture,
} from './approval-allowance-consequence-types.js';

export const ZERO_EVM_ADDRESS = '0x0000000000000000000000000000000000000000';
export const CRYPTO_APPROVAL_MAX_UINT256 =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

const DECIMAL_SCALE = 18n;
const DECIMAL_SCALE_UNITS = 10n ** DECIMAL_SCALE;

const MECHANISM_FUNCTION_SELECTORS: Partial<Record<CryptoApprovalAllowanceMechanism, string>> = {
  'erc20-approve': '0x095ea7b3',
  'erc20-increase-allowance': '0x39509351',
  'erc20-decrease-allowance': '0xa457c2d7',
  'eip-2612-permit': '0xd505accf',
};

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`Crypto approval allowance consequence ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

export function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeIdentifier(value, fieldName);
}

export function normalizeIsoTimestamp(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = normalizeIdentifier(value, fieldName);
  const timestamp = new Date(normalized);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Crypto approval allowance consequence ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

export function normalizeAddress(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
    throw new Error(`Crypto approval allowance consequence ${fieldName} must be an EVM address.`);
  }
  return normalized.toLowerCase();
}

export function normalizeOptionalAddress(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeAddress(value, fieldName);
}

export function normalizeAmount(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  parseDecimalToScaledUnits(normalized, fieldName);
  return normalized;
}

export function normalizeOptionalAmount(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeAmount(value, fieldName);
}

export function parseDecimalToScaledUnits(value: string, fieldName: string): bigint {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d{0,77})(?:\.\d{1,18})?$/.test(normalized)) {
    throw new Error(
      `Crypto approval allowance consequence ${fieldName} must be a non-negative decimal with up to 18 fractional digits.`,
    );
  }
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * DECIMAL_SCALE_UNITS + BigInt(fraction.padEnd(Number(DECIMAL_SCALE), '0'));
}

export function formatScaledUnits(value: bigint): string {
  const whole = value / DECIMAL_SCALE_UNITS;
  const fraction = value % DECIMAL_SCALE_UNITS;
  if (fraction === 0n) {
    return whole.toString();
  }
  return `${whole}.${fraction.toString().padStart(Number(DECIMAL_SCALE), '0').replace(/0+$/, '')}`;
}

export function decimalCompare(left: string, right: string): number {
  const leftValue = parseDecimalToScaledUnits(left, 'amount comparison left');
  const rightValue = parseDecimalToScaledUnits(right, 'amount comparison right');
  if (leftValue === rightValue) return 0;
  return leftValue > rightValue ? 1 : -1;
}

export function decimalAdd(left: string, right: string): string {
  return formatScaledUnits(
    parseDecimalToScaledUnits(left, 'allowance addition left') +
      parseDecimalToScaledUnits(right, 'allowance addition right'),
  );
}

export function decimalSubtractFloor(left: string, right: string): string {
  const leftValue = parseDecimalToScaledUnits(left, 'allowance subtraction left');
  const rightValue = parseDecimalToScaledUnits(right, 'allowance subtraction right');
  return formatScaledUnits(leftValue > rightValue ? leftValue - rightValue : 0n);
}

export function sameAddress(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  return left.toLowerCase() === right.toLowerCase();
}

export function caip2ChainId(intent: CryptoAuthorizationIntent): string {
  return `${intent.chain.namespace}:${intent.chain.chainId}`;
}

export function mechanismFrom(input: CryptoApprovalAllowanceMechanism): CryptoApprovalAllowanceMechanism {
  if (!CRYPTO_APPROVAL_ALLOWANCE_MECHANISMS.includes(input)) {
    throw new Error(`Crypto approval allowance consequence does not support mechanism ${input}.`);
  }
  return input;
}

export function amountPostureFrom(input: {
  readonly mechanism: CryptoApprovalAllowanceMechanism;
  readonly requestedAmount: string;
  readonly amountPosture?: CryptoAllowanceAmountPosture | null;
}): CryptoAllowanceAmountPosture {
  if (input.amountPosture !== undefined && input.amountPosture !== null) {
    if (!CRYPTO_ALLOWANCE_AMOUNT_POSTURES.includes(input.amountPosture)) {
      throw new Error(`Crypto approval allowance consequence does not support amount posture ${input.amountPosture}.`);
    }
    return input.amountPosture;
  }
  if (input.requestedAmount === '0') {
    return 'revoke';
  }
  if (input.mechanism === 'erc20-decrease-allowance') {
    return 'decrease-only';
  }
  if (input.requestedAmount === CRYPTO_APPROVAL_MAX_UINT256) {
    return 'unlimited';
  }
  if (
    input.mechanism === 'permit2-signature-transfer' ||
    input.mechanism === 'erc-7674-temporary-approve'
  ) {
    return 'exact';
  }
  return 'bounded';
}

export function durationPostureFrom(input: {
  readonly mechanism: CryptoApprovalAllowanceMechanism;
  readonly amountPosture: CryptoAllowanceAmountPosture;
  readonly allowanceExpiration: string | null;
  readonly durationPosture?: CryptoAllowanceDurationPosture | null;
}): CryptoAllowanceDurationPosture {
  if (input.durationPosture !== undefined && input.durationPosture !== null) {
    if (!CRYPTO_ALLOWANCE_DURATION_POSTURES.includes(input.durationPosture)) {
      throw new Error(`Crypto approval allowance consequence does not support duration posture ${input.durationPosture}.`);
    }
    return input.durationPosture;
  }
  if (input.amountPosture === 'revoke') {
    return 'revoked';
  }
  if (
    input.mechanism === 'permit2-signature-transfer' ||
    input.mechanism === 'erc-7674-temporary-approve'
  ) {
    return 'transaction-scoped';
  }
  if (input.allowanceExpiration !== null) {
    return 'time-bound';
  }
  return 'persistent';
}

export function revocationFrom(
  input: CryptoApprovalAllowanceRevocationPosture | null | undefined,
  durationPosture: CryptoAllowanceDurationPosture,
): CryptoApprovalAllowanceRevocationPosture {
  const method =
    input?.method ??
    (durationPosture === 'transaction-scoped'
      ? 'temporary-expires'
      : durationPosture === 'revoked'
        ? 'approve-zero'
        : null);
  if (method !== null && !CRYPTO_APPROVAL_ALLOWANCE_REVOCATION_METHODS.includes(method)) {
    throw new Error(`Crypto approval allowance consequence does not support revocation method ${method}.`);
  }
  return Object.freeze({
    revocable:
      input?.revocable ??
      (durationPosture === 'transaction-scoped' ||
        durationPosture === 'revoked'),
    method,
    authorityRef: normalizeOptionalIdentifier(input?.authorityRef, 'revocation.authorityRef'),
    revocationTarget: normalizeOptionalAddress(input?.revocationTarget, 'revocation.revocationTarget'),
  });
}

export function resultingAllowanceFor(input: {
  readonly mechanism: CryptoApprovalAllowanceMechanism;
  readonly amountPosture: CryptoAllowanceAmountPosture;
  readonly requestedAmount: string;
  readonly currentAllowance: string | null;
  readonly resultingAllowance: string | null;
}): string {
  if (input.resultingAllowance !== null) {
    return input.resultingAllowance;
  }
  if (input.amountPosture === 'revoke') {
    return '0';
  }
  if (input.mechanism === 'permit2-signature-transfer') {
    return '0';
  }
  if (input.mechanism === 'erc20-increase-allowance' && input.currentAllowance !== null) {
    return decimalAdd(input.currentAllowance, input.requestedAmount);
  }
  if (input.mechanism === 'erc20-decrease-allowance' && input.currentAllowance !== null) {
    return decimalSubtractFloor(input.currentAllowance, input.requestedAmount);
  }
  return input.requestedAmount;
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

export function observation(input: {
  readonly check: CryptoApprovalAllowanceCheck;
  readonly status: CryptoApprovalAllowanceObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required?: boolean;
  readonly evidence?: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}): CryptoApprovalAllowanceObservation {
  return Object.freeze({
    check: input.check,
    status: input.status,
    code: normalizeIdentifier(input.code, 'observation.code'),
    message: normalizeIdentifier(input.message, 'observation.message'),
    required: input.required ?? true,
    evidence: Object.freeze(input.evidence ?? {}),
  });
}

export function requiresPermitEvidence(mechanism: CryptoApprovalAllowanceMechanism): boolean {
  return (
    mechanism === 'eip-2612-permit' ||
    mechanism === 'permit2-allowance' ||
    mechanism === 'permit2-signature-transfer'
  );
}

export function requiresEvmRuntime(mechanism: CryptoApprovalAllowanceMechanism): boolean {
  return mechanism !== 'wallet-permission-grant';
}

export function expectedSelectorFor(mechanism: CryptoApprovalAllowanceMechanism): string | null {
  return MECHANISM_FUNCTION_SELECTORS[mechanism] ?? null;
}
