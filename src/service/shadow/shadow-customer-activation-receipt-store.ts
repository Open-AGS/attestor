import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ShadowCustomerActivationReceipt } from '../../consequence-admission/index.js';
import { withFileLock } from '../file-store.js';
import {
  compareDesc,
  defaultShadowCustomerActivationReceiptStorePath,
  normalizeActivationReceiptStatus,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeLimit,
  normalizeOptionalString,
  saveShadowStore,
} from './shadow-persistence-helpers.js';
import {
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STORE_VERSION,
  type AppendShadowCustomerActivationReceiptInput,
  type AppendShadowCustomerActivationReceiptResult,
  type FileBackedShadowCustomerActivationReceiptStore,
  type ShadowCustomerActivationReceiptListFilters,
  type ShadowCustomerActivationReceiptStoreRecord,
} from './shadow-persistence-types.js';

interface ShadowCustomerActivationReceiptStoreFile {
  version: 1;
  records: ShadowCustomerActivationReceiptStoreRecord[];
}

function defaultActivationReceiptStore(): ShadowCustomerActivationReceiptStoreFile {
  return { version: 1, records: [] };
}

function normalizeActivationReceiptRecord(
  record: ShadowCustomerActivationReceiptStoreRecord,
): ShadowCustomerActivationReceiptStoreRecord {
  return {
    version: SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STORE_VERSION,
    tenantId: normalizeIdentifier(record.tenantId, 'tenantId'),
    receiptId: normalizeIdentifier(record.receiptId || record.receipt?.receiptId, 'receiptId'),
    receiptDigest: normalizeIdentifier(record.receiptDigest || record.receipt?.digest, 'receiptDigest'),
    sourceHandoffId: normalizeIdentifier(
      record.sourceHandoffId || record.receipt?.sourceHandoffId,
      'sourceHandoffId',
    ),
    sourceHandoffDigest: normalizeIdentifier(
      record.sourceHandoffDigest || record.receipt?.sourceHandoffDigest,
      'sourceHandoffDigest',
    ),
    activationStatus: normalizeActivationReceiptStatus(
      record.activationStatus ?? record.receipt?.activationStatus,
      'activationStatus',
    ) ?? 'failed',
    receiptReady: Boolean(record.receiptReady ?? record.receipt?.receiptReady),
    activationClosed: Boolean(record.activationClosed ?? record.receipt?.activationClosed),
    recordedAt: normalizeIsoTimestamp(record.recordedAt, new Date().toISOString(), 'recordedAt'),
    receipt: record.receipt,
    rawPayloadStored: false,
  };
}

function readActivationReceiptStore(path: string): ShadowCustomerActivationReceiptStoreFile {
  if (!existsSync(path)) return defaultActivationReceiptStore();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ShadowCustomerActivationReceiptStoreFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
      throw new Error('invalid store shape');
    }
    return {
      version: 1,
      records: parsed.records.map(normalizeActivationReceiptRecord),
    };
  } catch {
    throw new Error('Shadow customer activation receipt store corruption detected.');
  }
}

function saveActivationReceiptStore(
  path: string,
  store: ShadowCustomerActivationReceiptStoreFile,
): void {
  saveShadowStore(path, store);
}

function sortActivationReceiptRecords(
  records: readonly ShadowCustomerActivationReceiptStoreRecord[],
): ShadowCustomerActivationReceiptStoreRecord[] {
  return [...records].sort((left, right) => {
    const byRecorded = compareDesc(left.recordedAt, right.recordedAt);
    if (byRecorded !== 0) return byRecorded;
    return left.receiptId.localeCompare(right.receiptId);
  });
}

function assertActivationReceiptTenantMatches(
  tenantId: string,
  receipt: ShadowCustomerActivationReceipt,
): void {
  if (receipt.tenantId !== tenantId) {
    throw new Error('Shadow customer activation receipt tenant does not match the store tenant.');
  }
  if (receipt.rawPayloadStored !== false) {
    throw new Error('Shadow customer activation receipt store only accepts data-minimized receipts.');
  }
}

function activationReceiptSummary(
  records: readonly ShadowCustomerActivationReceiptStoreRecord[],
): {
  readonly receiptCount: number;
  readonly readyReceiptCount: number;
  readonly heldReceiptCount: number;
} {
  let readyReceiptCount = 0;
  for (const record of records) {
    if (record.receiptReady) readyReceiptCount += 1;
  }
  return {
    receiptCount: records.length,
    readyReceiptCount,
    heldReceiptCount: records.length - readyReceiptCount,
  };
}

export function createFileBackedShadowCustomerActivationReceiptStore(options?: {
  readonly path?: string | null;
}): FileBackedShadowCustomerActivationReceiptStore {
  const path = resolve(options?.path ?? defaultShadowCustomerActivationReceiptStorePath());

  function withStoreLock<T>(action: (store: ShadowCustomerActivationReceiptStoreFile) => T): T {
    return withFileLock(path, () => action(readActivationReceiptStore(path)));
  }

  return Object.freeze({
    append(input: AppendShadowCustomerActivationReceiptInput): AppendShadowCustomerActivationReceiptResult {
      return withStoreLock((store) => {
        const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
        assertActivationReceiptTenantMatches(tenantId, input.receipt);
        const existing = store.records.find((record) =>
          record.tenantId === tenantId &&
          (record.receiptId === input.receipt.receiptId || record.receiptDigest === input.receipt.digest)
        );
        if (existing) {
          return { kind: 'duplicate', record: normalizeActivationReceiptRecord(existing), path };
        }

        const recordedAt = normalizeIsoTimestamp(
          input.recordedAt,
          new Date().toISOString(),
          'recordedAt',
        );
        const record: ShadowCustomerActivationReceiptStoreRecord = {
          version: SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STORE_VERSION,
          tenantId,
          receiptId: input.receipt.receiptId,
          receiptDigest: input.receipt.digest,
          sourceHandoffId: input.receipt.sourceHandoffId,
          sourceHandoffDigest: input.receipt.sourceHandoffDigest,
          activationStatus: input.receipt.activationStatus,
          receiptReady: input.receipt.receiptReady,
          activationClosed: input.receipt.activationClosed,
          recordedAt,
          receipt: input.receipt,
          rawPayloadStored: false,
        };
        store.records.push(record);
        saveActivationReceiptStore(path, store);
        return { kind: 'recorded', record, path };
      });
    },
    list(filters: ShadowCustomerActivationReceiptListFilters) {
      const tenantId = normalizeIdentifier(filters.tenantId, 'tenantId');
      const activationStatus = normalizeActivationReceiptStatus(
        filters.activationStatus,
        'activationStatus',
      );
      const receiptReady = filters.receiptReady ?? null;
      const sourceHandoffDigest = normalizeOptionalString(filters.sourceHandoffDigest);
      const limit = normalizeLimit(filters.limit, 100);
      const records = sortActivationReceiptRecords(readActivationReceiptStore(path).records)
        .filter((record) => record.tenantId === tenantId)
        .filter((record) => !activationStatus || record.activationStatus === activationStatus)
        .filter((record) => receiptReady === null || record.receiptReady === receiptReady)
        .filter((record) => !sourceHandoffDigest || record.sourceHandoffDigest === sourceHandoffDigest)
        .slice(0, limit);
      return {
        records,
        receipts: records.map((record) => record.receipt),
        path,
      };
    },
    find(input: { readonly tenantId: string; readonly receiptId: string }) {
      const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
      const receiptId = normalizeIdentifier(input.receiptId, 'receiptId');
      const record = readActivationReceiptStore(path).records.find((entry) =>
        entry.tenantId === tenantId && entry.receiptId === receiptId
      ) ?? null;
      return { record: record ? normalizeActivationReceiptRecord(record) : null, path };
    },
    summarize(input: { readonly tenantId: string }) {
      const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
      const records = sortActivationReceiptRecords(readActivationReceiptStore(path).records)
        .filter((record) => record.tenantId === tenantId);
      const summary = activationReceiptSummary(records);
      return {
        summary: {
          tenantId,
          storageMode: 'file-backed-evaluation',
          ...summary,
          latestReceiptDigest: records[0]?.receiptDigest ?? null,
          latestRecordedAt: records[0]?.recordedAt ?? null,
          rawPayloadStored: false,
          productionReady: false,
        } as const,
        path,
      };
    },
  });
}
