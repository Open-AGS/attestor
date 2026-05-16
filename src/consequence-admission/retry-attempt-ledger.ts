import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionResponse,
  ConsequenceAdmissionRetryAttemptBinding,
  ConsequenceAdmissionRetryBudgetEvaluation,
  ConsequenceAdmissionRetryBudgetOutcome,
} from './index.js';

export const CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION =
  'attestor.consequence-admission-retry-attempt-ledger.v1';

export const CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_OUTCOMES = [
  'recorded',
  'duplicate',
  'held',
] as const;
export type ConsequenceAdmissionRetryAttemptLedgerOutcome =
  typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_OUTCOMES[number];

export const CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_FAILURE_REASONS = [
  'previous-admission-id-mismatch',
  'previous-admission-digest-mismatch',
  'previous-request-id-mismatch',
  'retry-budget-attempt-mismatch',
  'retry-budget-previous-admission-mismatch',
  'retry-budget-previous-digest-mismatch',
  'retry-budget-attempt-number-mismatch',
  'retry-attempt-conflict',
  'idempotency-key-conflict',
  'ledger-capacity-exhausted',
] as const;
export type ConsequenceAdmissionRetryAttemptLedgerFailureReason =
  typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_FAILURE_REASONS[number];

export interface ConsequenceAdmissionRetryAttemptLedgerRecord {
  readonly version: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION;
  readonly ledgerId: string;
  readonly recordId: string;
  readonly recordedAt: string;
  readonly tenantId: string | null;
  readonly environment: string | null;
  readonly previousAdmissionId: string;
  readonly previousAdmissionDigest: string;
  readonly previousRequestId: string;
  readonly retryAttemptId: string;
  readonly retryAttemptDigest: string;
  readonly attemptNumber: number;
  readonly attemptedAt: string;
  readonly correctionReasonCodes: readonly string[];
  readonly correctionFields: readonly string[];
  readonly idempotencyKeyDigest: string | null;
  readonly retryBudgetDigest: string;
  readonly retryBudgetOutcome: ConsequenceAdmissionRetryBudgetOutcome;
  readonly retryAllowed: boolean;
  readonly retryBudgetFailClosed: boolean;
  readonly retryBudgetReasonCodes: readonly string[];
  readonly rawPayloadStored: false;
  readonly recordDigest: string;
}

export interface ConsequenceAdmissionRetryAttemptLedgerDecision {
  readonly version: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION;
  readonly outcome: ConsequenceAdmissionRetryAttemptLedgerOutcome;
  readonly recorded: boolean;
  readonly duplicate: boolean;
  readonly failClosed: boolean;
  readonly ledgerId: string;
  readonly retryAttemptId: string;
  readonly attemptNumber: number;
  readonly previousAdmissionId: string;
  readonly previousAdmissionDigest: string;
  readonly retryBudgetDigest: string;
  readonly retryBudgetOutcome: ConsequenceAdmissionRetryBudgetOutcome;
  readonly retryAllowed: boolean;
  readonly record: ConsequenceAdmissionRetryAttemptLedgerRecord | null;
  readonly failureReasons: readonly ConsequenceAdmissionRetryAttemptLedgerFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly reason: string;
  readonly instruction: string;
  readonly receiptDigest: string;
}

export interface RecordConsequenceAdmissionRetryAttemptInput {
  readonly previousAdmission: ConsequenceAdmissionResponse;
  readonly retryAttempt: ConsequenceAdmissionRetryAttemptBinding;
  readonly retryBudget: ConsequenceAdmissionRetryBudgetEvaluation;
  readonly tenantId?: string | null;
  readonly environment?: string | null;
  readonly recordedAt?: string | null;
}

export interface ConsequenceAdmissionRetryAttemptLedgerSnapshot {
  readonly version: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION;
  readonly ledgerId: string;
  readonly recordCount: number;
  readonly records: readonly ConsequenceAdmissionRetryAttemptLedgerRecord[];
}

export interface ConsequenceAdmissionRetryAttemptLedgerSummary {
  readonly version: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION;
  readonly ledgerId: string;
  readonly recordCount: number;
  readonly retryAllowedCount: number;
  readonly retryHeldCount: number;
  readonly duplicateProtection: 'retry-attempt-id-and-idempotency-key';
  readonly rawPayloadStored: false;
}

export type ConsequenceAdmissionRetryAttemptLedgerStoreKind =
  | 'in-memory-reference'
  | 'shared-atomic';

export type ConsequenceAdmissionRetryAttemptLedgerStoreRecordOutcome =
  | 'recorded'
  | 'duplicate'
  | 'idempotency-key-conflict'
  | 'ledger-capacity-exhausted';

export interface ConsequenceAdmissionRetryAttemptLedgerStoreDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION;
  readonly storeId: string;
  readonly storeKind: ConsequenceAdmissionRetryAttemptLedgerStoreKind;
  readonly duplicateBinding: 'retryAttemptId + idempotencyKeyDigest';
  readonly atomicRecordIfAbsent: true;
  readonly storesRawIdempotencyKeys: false;
  readonly productionReady: boolean;
}

export interface ConsequenceAdmissionRetryAttemptLedgerStoreRecordResult {
  readonly outcome: ConsequenceAdmissionRetryAttemptLedgerStoreRecordOutcome;
  readonly record: ConsequenceAdmissionRetryAttemptLedgerRecord | null;
}

export interface ConsequenceAdmissionRetryAttemptLedgerStore {
  readonly descriptor: ConsequenceAdmissionRetryAttemptLedgerStoreDescriptor;
  readonly find: (retryAttemptId: string) => ConsequenceAdmissionRetryAttemptLedgerRecord | null;
  readonly list: () => readonly ConsequenceAdmissionRetryAttemptLedgerRecord[];
  readonly recordIfAbsent: (input: {
    readonly record: ConsequenceAdmissionRetryAttemptLedgerRecord;
    readonly idempotencyScope: string | null;
    readonly maxRecords: number;
  }) => ConsequenceAdmissionRetryAttemptLedgerStoreRecordResult;
}

export interface ConsequenceAdmissionRetryAttemptLedgerListFilter {
  readonly tenantId?: string | null;
  readonly previousAdmissionId?: string | null;
}

export interface ConsequenceAdmissionRetryAttemptLedger {
  readonly version: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION;
  readonly ledgerId: string;
  readonly storeDescriptor: ConsequenceAdmissionRetryAttemptLedgerStoreDescriptor;
  readonly record: (
    input: RecordConsequenceAdmissionRetryAttemptInput,
  ) => ConsequenceAdmissionRetryAttemptLedgerDecision;
  readonly find: (retryAttemptId: string) => ConsequenceAdmissionRetryAttemptLedgerRecord | null;
  readonly list: (
    filter?: ConsequenceAdmissionRetryAttemptLedgerListFilter,
  ) => readonly ConsequenceAdmissionRetryAttemptLedgerRecord[];
  readonly snapshot: () => ConsequenceAdmissionRetryAttemptLedgerSnapshot;
  readonly summary: () => ConsequenceAdmissionRetryAttemptLedgerSummary;
}

export interface CreateConsequenceAdmissionRetryAttemptLedgerInput {
  readonly ledgerId?: string | null;
  readonly maxRecords?: number | null;
  readonly now?: (() => string) | null;
  readonly store?: ConsequenceAdmissionRetryAttemptLedgerStore | null;
}

export interface CreateConsequenceAdmissionRetryAttemptLedgerInMemoryStoreInput {
  readonly storeId?: string | null;
}

export interface ConsequenceAdmissionRetryAttemptLedgerDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION;
  readonly outcomes: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_OUTCOMES;
  readonly failureReasons: typeof CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_FAILURE_REASONS;
  readonly duplicateBinding: 'retryAttemptId + idempotencyKeyDigest';
  readonly storesRawPayloadsExternally: false;
  readonly storesRawIdempotencyKeysExternally: false;
  readonly inMemoryReferenceImplementation: true;
  readonly sharedStoreContractIncluded: true;
  readonly sharedStoreAtomicRecordRequired: true;
  readonly defaultStoreKind: 'in-memory-reference';
  readonly productionSharedStoreIncluded: true;
  readonly productionSharedStoreRuntimeWired: false;
  readonly productionSharedStoreContractRef: 'src/service/consequence-shared-atomic-stores.ts';
  readonly failClosed: true;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission retry attempt ledger ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      `Consequence admission retry attempt ledger ${fieldName} requires a non-empty value.`,
    );
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(
      `Consequence admission retry attempt ledger ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
  fallback: number,
): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Consequence admission retry attempt ledger ${fieldName} must be a positive integer.`,
    );
  }
  return value;
}

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function digestValue(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function defaultNow(): string {
  return new Date().toISOString();
}

export function createConsequenceAdmissionRetryAttemptLedgerInMemoryStore(
  input: CreateConsequenceAdmissionRetryAttemptLedgerInMemoryStoreInput = {},
): ConsequenceAdmissionRetryAttemptLedgerStore {
  const storeId = normalizeOptionalIdentifier(input.storeId, 'storeId') ??
    'consequence-admission-retry-attempt-ledger-store:memory';
  const recordsByAttemptId = new Map<string, ConsequenceAdmissionRetryAttemptLedgerRecord>();
  const attemptIdByIdempotencyScope = new Map<string, string>();

  return Object.freeze({
    descriptor: Object.freeze({
      version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
      storeId,
      storeKind: 'in-memory-reference',
      duplicateBinding: 'retryAttemptId + idempotencyKeyDigest',
      atomicRecordIfAbsent: true,
      storesRawIdempotencyKeys: false,
      productionReady: false,
    }),
    find(retryAttemptId: string): ConsequenceAdmissionRetryAttemptLedgerRecord | null {
      const attemptId = normalizeIdentifier(retryAttemptId, 'retryAttemptId');
      return recordsByAttemptId.get(attemptId) ?? null;
    },
    list(): readonly ConsequenceAdmissionRetryAttemptLedgerRecord[] {
      return sortedRecords(recordsByAttemptId.values());
    },
    recordIfAbsent(input: {
      readonly record: ConsequenceAdmissionRetryAttemptLedgerRecord;
      readonly idempotencyScope: string | null;
      readonly maxRecords: number;
    }): ConsequenceAdmissionRetryAttemptLedgerStoreRecordResult {
      const existing = recordsByAttemptId.get(input.record.retryAttemptId);
      if (existing !== undefined) {
        return Object.freeze({ outcome: 'duplicate', record: existing });
      }
      if (input.idempotencyScope !== null) {
        const existingAttemptId = attemptIdByIdempotencyScope.get(input.idempotencyScope);
        if (
          existingAttemptId !== undefined &&
          existingAttemptId !== input.record.retryAttemptId
        ) {
          return Object.freeze({ outcome: 'idempotency-key-conflict', record: null });
        }
      }
      if (recordsByAttemptId.size >= input.maxRecords) {
        return Object.freeze({ outcome: 'ledger-capacity-exhausted', record: null });
      }
      recordsByAttemptId.set(input.record.retryAttemptId, input.record);
      if (input.idempotencyScope !== null) {
        attemptIdByIdempotencyScope.set(input.idempotencyScope, input.record.retryAttemptId);
      }
      return Object.freeze({ outcome: 'recorded', record: input.record });
    },
  });
}

function orderedFailureReasons(
  reasons: readonly ConsequenceAdmissionRetryAttemptLedgerFailureReason[],
): readonly ConsequenceAdmissionRetryAttemptLedgerFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_FAILURE_REASONS.filter((reason) =>
      present.has(reason),
    ),
  );
}

function retryAttemptDigest(retryAttempt: ConsequenceAdmissionRetryAttemptBinding): string {
  return digestValue({
    version: retryAttempt.version,
    attemptId: retryAttempt.attemptId,
    previousAdmissionId: retryAttempt.previousAdmissionId,
    previousAdmissionDigest: retryAttempt.previousAdmissionDigest,
    previousRequestId: retryAttempt.previousRequestId,
    attemptNumber: retryAttempt.attemptNumber,
    attemptedAt: retryAttempt.attemptedAt,
    correctionReasonCodes: retryAttempt.correctionReasonCodes,
    correctionFields: retryAttempt.correctionFields,
    idempotencyKey: retryAttempt.idempotencyKey,
  } as CanonicalReleaseJsonValue);
}

function recordIdFor(input: {
  readonly ledgerId: string;
  readonly previousAdmissionId: string;
  readonly previousAdmissionDigest: string;
  readonly retryAttemptId: string;
  readonly retryBudgetDigest: string;
}): string {
  return `retry-attempt-ledger:${digestValue({
    version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
    ledgerId: input.ledgerId,
    previousAdmissionId: input.previousAdmissionId,
    previousAdmissionDigest: input.previousAdmissionDigest,
    retryAttemptId: input.retryAttemptId,
    retryBudgetDigest: input.retryBudgetDigest,
  } as CanonicalReleaseJsonValue)}`;
}

function recordDigest(
  input: Omit<ConsequenceAdmissionRetryAttemptLedgerRecord, 'recordDigest'>,
): string {
  return digestValue({
    version: input.version,
    ledgerId: input.ledgerId,
    recordId: input.recordId,
    recordedAt: input.recordedAt,
    tenantId: input.tenantId,
    environment: input.environment,
    previousAdmissionId: input.previousAdmissionId,
    previousAdmissionDigest: input.previousAdmissionDigest,
    previousRequestId: input.previousRequestId,
    retryAttemptId: input.retryAttemptId,
    retryAttemptDigest: input.retryAttemptDigest,
    attemptNumber: input.attemptNumber,
    attemptedAt: input.attemptedAt,
    correctionReasonCodes: input.correctionReasonCodes,
    correctionFields: input.correctionFields,
    idempotencyKeyDigest: input.idempotencyKeyDigest,
    retryBudgetDigest: input.retryBudgetDigest,
    retryBudgetOutcome: input.retryBudgetOutcome,
    retryAllowed: input.retryAllowed,
    retryBudgetFailClosed: input.retryBudgetFailClosed,
    retryBudgetReasonCodes: input.retryBudgetReasonCodes,
    rawPayloadStored: input.rawPayloadStored,
  } as CanonicalReleaseJsonValue);
}

function receiptDigest(input: {
  readonly outcome: ConsequenceAdmissionRetryAttemptLedgerOutcome;
  readonly ledgerId: string;
  readonly retryAttemptId: string;
  readonly previousAdmissionId: string;
  readonly previousAdmissionDigest: string;
  readonly retryBudgetDigest: string;
  readonly retryBudgetOutcome: ConsequenceAdmissionRetryBudgetOutcome;
  readonly retryAllowed: boolean;
  readonly recordDigest: string | null;
  readonly failureReasons: readonly ConsequenceAdmissionRetryAttemptLedgerFailureReason[];
}): string {
  return digestValue({
    version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
    outcome: input.outcome,
    ledgerId: input.ledgerId,
    retryAttemptId: input.retryAttemptId,
    previousAdmissionId: input.previousAdmissionId,
    previousAdmissionDigest: input.previousAdmissionDigest,
    retryBudgetDigest: input.retryBudgetDigest,
    retryBudgetOutcome: input.retryBudgetOutcome,
    retryAllowed: input.retryAllowed,
    recordDigest: input.recordDigest,
    failureReasons: input.failureReasons,
  } as CanonicalReleaseJsonValue);
}

function reasonFor(input: {
  readonly outcome: ConsequenceAdmissionRetryAttemptLedgerOutcome;
  readonly retryAllowed: boolean;
  readonly failureReasons: readonly ConsequenceAdmissionRetryAttemptLedgerFailureReason[];
}): string {
  if (input.outcome === 'duplicate') {
    return 'Retry attempt ledger found an existing record for the same retry attempt.';
  }
  if (input.outcome === 'recorded' && input.retryAllowed) {
    return 'Retry attempt ledger recorded a bounded retry attempt that remains inside the retry budget.';
  }
  if (input.outcome === 'recorded') {
    return 'Retry attempt ledger recorded a retry attempt that must hold for customer review or operator control.';
  }
  if (input.failureReasons.includes('idempotency-key-conflict')) {
    return 'Retry attempt ledger held the retry because the idempotency key is already bound to another attempt.';
  }
  if (input.failureReasons.includes('ledger-capacity-exhausted')) {
    return 'Retry attempt ledger held the retry because the reference ledger reached its configured record capacity.';
  }
  return 'Retry attempt ledger held the retry because its binding could not close safely.';
}

function decision(input: {
  readonly outcome: ConsequenceAdmissionRetryAttemptLedgerOutcome;
  readonly ledgerId: string;
  readonly retryAttempt: ConsequenceAdmissionRetryAttemptBinding;
  readonly retryBudget: ConsequenceAdmissionRetryBudgetEvaluation;
  readonly record: ConsequenceAdmissionRetryAttemptLedgerRecord | null;
  readonly failureReasons: readonly ConsequenceAdmissionRetryAttemptLedgerFailureReason[];
}): ConsequenceAdmissionRetryAttemptLedgerDecision {
  const failureReasons = orderedFailureReasons(input.failureReasons);
  const retryAllowed = input.outcome === 'held'
    ? false
    : input.record?.retryAllowed ?? input.retryBudget.retryAllowed;
  const digest = receiptDigest({
    outcome: input.outcome,
    ledgerId: input.ledgerId,
    retryAttemptId: input.retryAttempt.attemptId,
    previousAdmissionId: input.retryAttempt.previousAdmissionId,
    previousAdmissionDigest: input.retryAttempt.previousAdmissionDigest,
    retryBudgetDigest: input.retryBudget.digest,
    retryBudgetOutcome: input.retryBudget.outcome,
    retryAllowed,
    recordDigest: input.record?.recordDigest ?? null,
    failureReasons,
  });

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
    outcome: input.outcome,
    recorded: input.outcome === 'recorded',
    duplicate: input.outcome === 'duplicate',
    failClosed: !retryAllowed,
    ledgerId: input.ledgerId,
    retryAttemptId: input.retryAttempt.attemptId,
    attemptNumber: input.retryAttempt.attemptNumber,
    previousAdmissionId: input.retryAttempt.previousAdmissionId,
    previousAdmissionDigest: input.retryAttempt.previousAdmissionDigest,
    retryBudgetDigest: input.retryBudget.digest,
    retryBudgetOutcome: input.retryBudget.outcome,
    retryAllowed,
    record: input.record,
    failureReasons,
    reasonCodes: Object.freeze([
      `retry-attempt-ledger-${input.outcome}`,
      `retry-budget-${input.retryBudget.outcome}`,
      ...input.retryBudget.reasonCodes,
      ...failureReasons.map((reason) => `retry-attempt-ledger-${reason}`),
    ]),
    reason: reasonFor({
      outcome: input.outcome,
      retryAllowed,
      failureReasons,
    }),
    instruction: retryAllowed
      ? 'Proceed only by evaluating the corrected request; the downstream system must still honor the new admission decision.'
      : 'Do not retry automatically. Route the attempt to customer review or operator control.',
    receiptDigest: digest,
  });
}

function consistencyFailures(input: {
  readonly previousAdmission: ConsequenceAdmissionResponse;
  readonly retryAttempt: ConsequenceAdmissionRetryAttemptBinding;
  readonly retryBudget: ConsequenceAdmissionRetryBudgetEvaluation;
}): readonly ConsequenceAdmissionRetryAttemptLedgerFailureReason[] {
  const reasons: ConsequenceAdmissionRetryAttemptLedgerFailureReason[] = [];

  if (input.retryAttempt.previousAdmissionId !== input.previousAdmission.admissionId) {
    reasons.push('previous-admission-id-mismatch');
  }
  if (input.retryAttempt.previousAdmissionDigest !== input.previousAdmission.digest) {
    reasons.push('previous-admission-digest-mismatch');
  }
  if (input.retryAttempt.previousRequestId !== input.previousAdmission.request.requestId) {
    reasons.push('previous-request-id-mismatch');
  }
  if (input.retryBudget.retryAttemptId !== input.retryAttempt.attemptId) {
    reasons.push('retry-budget-attempt-mismatch');
  }
  if (input.retryBudget.previousAdmissionId !== input.retryAttempt.previousAdmissionId) {
    reasons.push('retry-budget-previous-admission-mismatch');
  }
  if (input.retryBudget.previousAdmissionDigest !== input.retryAttempt.previousAdmissionDigest) {
    reasons.push('retry-budget-previous-digest-mismatch');
  }
  if (input.retryBudget.attemptNumber !== input.retryAttempt.attemptNumber) {
    reasons.push('retry-budget-attempt-number-mismatch');
  }

  return orderedFailureReasons(reasons);
}

function idempotencyScope(input: {
  readonly tenantId: string | null;
  readonly previousAdmissionId: string;
  readonly idempotencyKeyDigest: string | null;
}): string | null {
  if (input.idempotencyKeyDigest === null) return null;
  return [
    input.tenantId ?? 'tenant:null',
    input.previousAdmissionId,
    input.idempotencyKeyDigest,
  ].join('|');
}

function sortedRecords(
  records: Iterable<ConsequenceAdmissionRetryAttemptLedgerRecord>,
): readonly ConsequenceAdmissionRetryAttemptLedgerRecord[] {
  return Object.freeze(
    [...records].sort((a, b) =>
      a.recordedAt.localeCompare(b.recordedAt) ||
      a.retryAttemptId.localeCompare(b.retryAttemptId),
    ),
  );
}

export function createConsequenceAdmissionRetryAttemptLedger(
  input: CreateConsequenceAdmissionRetryAttemptLedgerInput = {},
): ConsequenceAdmissionRetryAttemptLedger {
  const ledgerId = normalizeOptionalIdentifier(input.ledgerId, 'ledgerId') ??
    'consequence-admission-retry-attempt-ledger:memory';
  const maxRecords = normalizePositiveInteger(input.maxRecords, 'maxRecords', 1000);
  const now = input.now ?? defaultNow;
  const store = input.store ??
    createConsequenceAdmissionRetryAttemptLedgerInMemoryStore({
      storeId: `${ledgerId}:store`,
    });

  function find(retryAttemptId: string): ConsequenceAdmissionRetryAttemptLedgerRecord | null {
    return store.find(retryAttemptId);
  }

  function list(
    filter: ConsequenceAdmissionRetryAttemptLedgerListFilter = {},
  ): readonly ConsequenceAdmissionRetryAttemptLedgerRecord[] {
    const tenantId = normalizeOptionalIdentifier(filter.tenantId, 'filter.tenantId');
    const previousAdmissionId = normalizeOptionalIdentifier(
      filter.previousAdmissionId,
      'filter.previousAdmissionId',
    );
    return sortedRecords(
      store.list().filter((record) =>
        (tenantId === null || record.tenantId === tenantId) &&
        (previousAdmissionId === null || record.previousAdmissionId === previousAdmissionId),
      ),
    );
  }

  function snapshot(): ConsequenceAdmissionRetryAttemptLedgerSnapshot {
    const records = sortedRecords(store.list());
    return Object.freeze({
      version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
      ledgerId,
      recordCount: records.length,
      records,
    });
  }

  function summary(): ConsequenceAdmissionRetryAttemptLedgerSummary {
    const records = [...store.list()];
    const retryAllowedCount = records.filter((record) => record.retryAllowed).length;
    return Object.freeze({
      version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
      ledgerId,
      recordCount: records.length,
      retryAllowedCount,
      retryHeldCount: records.length - retryAllowedCount,
      duplicateProtection: 'retry-attempt-id-and-idempotency-key',
      rawPayloadStored: false,
    });
  }

  function record(
    recordInput: RecordConsequenceAdmissionRetryAttemptInput,
  ): ConsequenceAdmissionRetryAttemptLedgerDecision {
    const retryAttempt = recordInput.retryAttempt;
    const retryBudget = recordInput.retryBudget;
    const failureReasons = consistencyFailures({
      previousAdmission: recordInput.previousAdmission,
      retryAttempt,
      retryBudget,
    });

    if (failureReasons.length > 0) {
      return decision({
        outcome: 'held',
        ledgerId,
        retryAttempt,
        retryBudget,
        record: null,
        failureReasons,
      });
    }

    const existing = store.find(retryAttempt.attemptId);
    if (existing !== null) {
      if (existing.retryBudgetDigest !== retryBudget.digest) {
        return decision({
          outcome: 'held',
          ledgerId,
          retryAttempt,
          retryBudget,
          record: null,
          failureReasons: ['retry-attempt-conflict'],
        });
      }
      return decision({
        outcome: 'duplicate',
        ledgerId,
        retryAttempt,
        retryBudget,
        record: existing,
        failureReasons: [],
      });
    }

    const tenantId = normalizeOptionalIdentifier(
      recordInput.tenantId ?? recordInput.previousAdmission.request.policyScope.tenantId,
      'tenantId',
    );
    const environment = normalizeOptionalIdentifier(
      recordInput.environment ?? recordInput.previousAdmission.request.policyScope.environment,
      'environment',
    );
    const idempotencyKeyDigest = retryAttempt.idempotencyKey === null
      ? null
      : digestText(retryAttempt.idempotencyKey);
    const scope = idempotencyScope({
      tenantId,
      previousAdmissionId: retryAttempt.previousAdmissionId,
      idempotencyKeyDigest,
    });
    if (scope !== null) {
      normalizeIdentifier(scope, 'idempotencyScope');
    }

    const recordedAt = normalizeIsoTimestamp(recordInput.recordedAt ?? now(), 'recordedAt');
    const recordBase = Object.freeze({
      version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
      ledgerId,
      recordId: recordIdFor({
        ledgerId,
        previousAdmissionId: retryAttempt.previousAdmissionId,
        previousAdmissionDigest: retryAttempt.previousAdmissionDigest,
        retryAttemptId: retryAttempt.attemptId,
        retryBudgetDigest: retryBudget.digest,
      }),
      recordedAt,
      tenantId,
      environment,
      previousAdmissionId: retryAttempt.previousAdmissionId,
      previousAdmissionDigest: retryAttempt.previousAdmissionDigest,
      previousRequestId: retryAttempt.previousRequestId,
      retryAttemptId: retryAttempt.attemptId,
      retryAttemptDigest: retryAttemptDigest(retryAttempt),
      attemptNumber: retryAttempt.attemptNumber,
      attemptedAt: retryAttempt.attemptedAt,
      correctionReasonCodes: Object.freeze([...retryAttempt.correctionReasonCodes]),
      correctionFields: Object.freeze([...retryAttempt.correctionFields]),
      idempotencyKeyDigest,
      retryBudgetDigest: retryBudget.digest,
      retryBudgetOutcome: retryBudget.outcome,
      retryAllowed: retryBudget.retryAllowed,
      retryBudgetFailClosed: retryBudget.failClosed,
      retryBudgetReasonCodes: Object.freeze([...retryBudget.reasonCodes]),
      rawPayloadStored: false,
    } satisfies Omit<ConsequenceAdmissionRetryAttemptLedgerRecord, 'recordDigest'>);
    const ledgerRecord = Object.freeze({
      ...recordBase,
      recordDigest: recordDigest(recordBase),
    });

    const stored = store.recordIfAbsent({
      record: ledgerRecord,
      idempotencyScope: scope,
      maxRecords,
    });
    if (stored.outcome === 'duplicate') {
      if (stored.record?.retryBudgetDigest !== retryBudget.digest) {
        return decision({
          outcome: 'held',
          ledgerId,
          retryAttempt,
          retryBudget,
          record: null,
          failureReasons: ['retry-attempt-conflict'],
        });
      }
      return decision({
        outcome: 'duplicate',
        ledgerId,
        retryAttempt,
        retryBudget,
        record: stored.record,
        failureReasons: [],
      });
    }
    if (stored.outcome === 'idempotency-key-conflict') {
      return decision({
        outcome: 'held',
        ledgerId,
        retryAttempt,
        retryBudget,
        record: null,
        failureReasons: ['idempotency-key-conflict'],
      });
    }
    if (stored.outcome === 'ledger-capacity-exhausted') {
      return decision({
        outcome: 'held',
        ledgerId,
        retryAttempt,
        retryBudget,
        record: null,
        failureReasons: ['ledger-capacity-exhausted'],
      });
    }

    return decision({
      outcome: 'recorded',
      ledgerId,
      retryAttempt,
      retryBudget,
      record: stored.record,
      failureReasons: [],
    });
  }

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
    ledgerId,
    storeDescriptor: store.descriptor,
    record,
    find,
    list,
    snapshot,
    summary,
  });
}

export function consequenceAdmissionRetryAttemptLedgerDescriptor():
ConsequenceAdmissionRetryAttemptLedgerDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
    outcomes: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_OUTCOMES,
    failureReasons: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_FAILURE_REASONS,
    duplicateBinding: 'retryAttemptId + idempotencyKeyDigest',
    storesRawPayloadsExternally: false,
    storesRawIdempotencyKeysExternally: false,
    inMemoryReferenceImplementation: true,
    sharedStoreContractIncluded: true,
    sharedStoreAtomicRecordRequired: true,
    defaultStoreKind: 'in-memory-reference',
    productionSharedStoreIncluded: true,
    productionSharedStoreRuntimeWired: false,
    productionSharedStoreContractRef: 'src/service/consequence-shared-atomic-stores.ts',
    failClosed: true,
  });
}
