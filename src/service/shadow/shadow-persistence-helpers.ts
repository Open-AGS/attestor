import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { GenericAdmissionMode, ShadowCustomerActivationReceiptStatus } from '../../consequence-admission/index.js';
import { writeTextFileAtomic } from '../file-store.js';
import {
  SHADOW_POLICY_CANDIDATE_STATUSES,
  type ShadowPolicyCandidateStatus,
} from './shadow-persistence-types.js';

export function defaultShadowAdmissionEventStorePath(): string {
  return resolve(process.env.ATTESTOR_SHADOW_ADMISSION_EVENT_STORE_PATH ?? '.attestor/shadow-admission-events.json');
}

export function defaultShadowPolicyCandidateStorePath(): string {
  return resolve(process.env.ATTESTOR_SHADOW_POLICY_CANDIDATE_STORE_PATH ?? '.attestor/shadow-policy-candidates.json');
}

export function defaultShadowPolicySimulationReportStorePath(): string {
  return resolve(process.env.ATTESTOR_SHADOW_POLICY_SIMULATION_REPORT_STORE_PATH ?? '.attestor/shadow-policy-simulation-reports.json');
}

export function defaultShadowCustomerActivationReceiptStorePath(): string {
  return resolve(process.env.ATTESTOR_SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STORE_PATH ?? '.attestor/shadow-customer-activation-receipts.json');
}

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Shadow persistence ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Shadow persistence ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

export function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Shadow persistence ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

export function normalizeLimit(limit: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(limit ?? Number.NaN) || (limit ?? 0) <= 0) return fallback;
  return Math.min(Math.trunc(limit as number), 1_000);
}

export function isCandidateStatus(value: string): value is ShadowPolicyCandidateStatus {
  return SHADOW_POLICY_CANDIDATE_STATUSES.includes(value as ShadowPolicyCandidateStatus);
}

export function normalizeMode(value: GenericAdmissionMode | null | undefined, fieldName: string): GenericAdmissionMode | null {
  if (value === undefined || value === null) return null;
  if (value === 'observe' || value === 'warn' || value === 'review' || value === 'enforce') {
    return value;
  }
  throw new Error(`Shadow persistence ${fieldName} must be observe, warn, review, or enforce.`);
}

export function normalizeActivationReceiptStatus(
  value: ShadowCustomerActivationReceiptStatus | null | undefined,
  fieldName: string,
): ShadowCustomerActivationReceiptStatus | null {
  if (value === undefined || value === null) return null;
  if (
    value === 'activated' ||
    value === 'rolled-back' ||
    value === 'failed' ||
    value === 'aborted'
  ) {
    return value;
  }
  throw new Error(`Shadow persistence ${fieldName} must be activated, rolled-back, failed, or aborted.`);
}

export function normalizeCandidateStatus(
  value: string | null | undefined,
  fieldName: string,
): ShadowPolicyCandidateStatus {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!isCandidateStatus(normalized)) {
    throw new Error(
      `Shadow persistence ${fieldName} must be one of: ${SHADOW_POLICY_CANDIDATE_STATUSES.join(', ')}.`,
    );
  }
  return normalized;
}

export function compareDesc(left: string | null, right: string | null): number {
  const leftKey = left ?? '';
  const rightKey = right ?? '';
  if (leftKey === rightKey) return 0;
  return leftKey < rightKey ? 1 : -1;
}

export function saveShadowStore(path: string, store: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeTextFileAtomic(path, `${JSON.stringify(store, null, 2)}\n`);
}
