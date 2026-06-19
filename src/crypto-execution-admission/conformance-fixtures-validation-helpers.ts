import { CRYPTO_ADMISSION_RECEIPT_CLASSIFICATIONS, type CryptoAdmissionReceiptClassification, type CryptoAdmissionTelemetrySignal } from './telemetry-receipts.js';
import type { CryptoExecutionAdmissionOutcome } from './index.js';
import {
  CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES,
  CRYPTO_ADMISSION_CONFORMANCE_TELEMETRY_SIGNALS,
  CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_CLASSES,
  type CryptoAdmissionConformanceSurface,
  type CryptoAdmissionConformanceValidationFinding,
  type CryptoAdmissionNegativeConformanceClass,
} from './conformance-fixtures-types.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringAt(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

export function arrayAt(record: Record<string, unknown>, key: string): readonly unknown[] {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

export function hasStringArray(record: Record<string, unknown>, key: string): boolean {
  return arrayAt(record, key).every((item) => typeof item === 'string');
}

export function pushFinding(
  findings: CryptoAdmissionConformanceValidationFinding[],
  finding: CryptoAdmissionConformanceValidationFinding,
): void {
  findings.push(Object.freeze(finding));
}

export function pushError(
  findings: CryptoAdmissionConformanceValidationFinding[],
  path: string,
  code: string,
  message: string,
): void {
  pushFinding(findings, {
    severity: 'error',
    code,
    path,
    message,
  });
}

export function isRequiredSurface(value: unknown): value is CryptoAdmissionConformanceSurface {
  return typeof value === 'string' &&
    CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES.includes(
      value as CryptoAdmissionConformanceSurface,
    );
}

export function isTelemetrySignal(
  value: unknown,
): value is Exclude<CryptoAdmissionTelemetrySignal, 'receipt-issued'> {
  return typeof value === 'string' &&
    value !== 'receipt-issued' &&
    CRYPTO_ADMISSION_CONFORMANCE_TELEMETRY_SIGNALS.includes(
      value as Exclude<CryptoAdmissionTelemetrySignal, 'receipt-issued'>,
    );
}

export function isReceiptClassification(
  value: unknown,
): value is CryptoAdmissionReceiptClassification {
  return typeof value === 'string' &&
    CRYPTO_ADMISSION_RECEIPT_CLASSIFICATIONS.includes(
      value as CryptoAdmissionReceiptClassification,
    );
}

export function isNegativeClass(value: unknown): value is CryptoAdmissionNegativeConformanceClass {
  return typeof value === 'string' &&
    CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_CLASSES.includes(
      value as CryptoAdmissionNegativeConformanceClass,
    );
}

export function isPlanOutcome(value: unknown): value is CryptoExecutionAdmissionOutcome {
  return value === 'admit' || value === 'deny' || value === 'needs-evidence';
}

export function isSha256Digest(value: unknown): boolean {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

export function assertEqual(
  findings: CryptoAdmissionConformanceValidationFinding[],
  actual: unknown,
  expected: unknown,
  path: string,
  code: string,
  message: string,
): void {
  if (actual !== expected) {
    pushError(findings, path, code, message);
  }
}
