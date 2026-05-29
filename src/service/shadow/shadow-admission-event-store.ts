import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ShadowAdmissionEvent } from '../../consequence-admission/index.js';
import { withFileLock } from '../file-store.js';
import {
  compareDesc,
  defaultShadowAdmissionEventStorePath,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeLimit,
  normalizeOptionalString,
  saveShadowStore,
} from './shadow-persistence-helpers.js';
import {
  SHADOW_ADMISSION_EVENT_STORE_VERSION,
  type AppendShadowAdmissionEventInput,
  type AppendShadowAdmissionEventResult,
  type FileBackedShadowAdmissionEventStore,
  type ShadowAdmissionEventListFilters,
  type ShadowAdmissionEventStoreRecord,
} from './shadow-persistence-types.js';

interface ShadowAdmissionEventStoreFile {
  version: 1;
  records: ShadowAdmissionEventStoreRecord[];
}

function defaultAdmissionStore(): ShadowAdmissionEventStoreFile {
  return { version: 1, records: [] };
}

function normalizeAdmissionRecord(
  record: ShadowAdmissionEventStoreRecord,
): ShadowAdmissionEventStoreRecord {
  return {
    version: SHADOW_ADMISSION_EVENT_STORE_VERSION,
    tenantId: normalizeIdentifier(record.tenantId, 'tenantId'),
    sequence: Number.isFinite(record.sequence) && record.sequence > 0
      ? Math.trunc(record.sequence)
      : 1,
    recordedAt: normalizeIsoTimestamp(record.recordedAt, new Date().toISOString(), 'recordedAt'),
    event: record.event,
    rawPayloadStored: false,
  };
}

function readAdmissionStore(path: string): ShadowAdmissionEventStoreFile {
  if (!existsSync(path)) return defaultAdmissionStore();
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as ShadowAdmissionEventStoreFile;
  if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
    throw new Error('Shadow admission event store file is invalid.');
  }
  return {
    version: 1,
    records: parsed.records.map(normalizeAdmissionRecord),
  };
}

function saveAdmissionStore(path: string, store: ShadowAdmissionEventStoreFile): void {
  saveShadowStore(path, store);
}

function sortAdmissionRecords(
  records: readonly ShadowAdmissionEventStoreRecord[],
): ShadowAdmissionEventStoreRecord[] {
  return [...records].sort((left, right) => {
    const byRecorded = compareDesc(left.recordedAt, right.recordedAt);
    if (byRecorded !== 0) return byRecorded;
    return right.sequence - left.sequence;
  });
}

function assertEventTenantMatches(tenantId: string, event: ShadowAdmissionEvent): void {
  if (event.tenantId !== null && event.tenantId !== tenantId) {
    throw new Error('Shadow admission event tenant does not match the store tenant.');
  }
  if (event.rawPayloadStored !== false) {
    throw new Error('Shadow admission event store only accepts data-minimized events.');
  }
}

export function createFileBackedShadowAdmissionEventStore(options?: {
  readonly path?: string | null;
}): FileBackedShadowAdmissionEventStore {
  const path = resolve(options?.path ?? defaultShadowAdmissionEventStorePath());

  function withStoreLock<T>(action: (store: ShadowAdmissionEventStoreFile) => T): T {
    return withFileLock(path, () => action(readAdmissionStore(path)));
  }

  return Object.freeze({
    append(input: AppendShadowAdmissionEventInput): AppendShadowAdmissionEventResult {
      return withStoreLock((store) => {
        const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
        assertEventTenantMatches(tenantId, input.event);
        const existing = store.records.find((record) =>
          record.tenantId === tenantId &&
          (record.event.eventId === input.event.eventId || record.event.digest === input.event.digest)
        );
        if (existing) {
          return { kind: 'duplicate', record: normalizeAdmissionRecord(existing), path };
        }

        const recordedAt = normalizeIsoTimestamp(
          input.recordedAt,
          new Date().toISOString(),
          'recordedAt',
        );
        const sequence =
          store.records.reduce((max, record) => Math.max(max, record.sequence), 0) + 1;
        const record: ShadowAdmissionEventStoreRecord = {
          version: SHADOW_ADMISSION_EVENT_STORE_VERSION,
          tenantId,
          sequence,
          recordedAt,
          event: input.event,
          rawPayloadStored: false,
        };
        store.records.push(record);
        saveAdmissionStore(path, store);
        return { kind: 'recorded', record, path };
      });
    },
    list(filters: ShadowAdmissionEventListFilters) {
      const tenantId = normalizeIdentifier(filters.tenantId, 'tenantId');
      const actionSurface = normalizeOptionalString(filters.actionSurface);
      const domain = normalizeOptionalString(filters.domain);
      const limit = normalizeLimit(filters.limit, 500);
      const records = sortAdmissionRecords(readAdmissionStore(path).records)
        .filter((record) => record.tenantId === tenantId)
        .filter((record) => !actionSurface || record.event.actionSurface === actionSurface)
        .filter((record) => !domain || record.event.domain === domain)
        .slice(0, limit);
      return {
        records,
        events: records.map((record) => record.event),
        path,
      };
    },
    summarize(input: { readonly tenantId: string }) {
      const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
      const records = sortAdmissionRecords(readAdmissionStore(path).records)
        .filter((record) => record.tenantId === tenantId);
      return {
        summary: {
          tenantId,
          storageMode: 'file-backed-evaluation',
          eventCount: records.length,
          latestEventDigest: records[0]?.event.digest ?? null,
          latestRecordedAt: records[0]?.recordedAt ?? null,
          rawPayloadStored: false,
          productionReady: false,
        } as const,
        path,
      };
    },
    exportSnapshot() {
      const records = sortAdmissionRecords(readAdmissionStore(path).records).reverse();
      return {
        path,
        version: 1 as const,
        exportedAt: new Date().toISOString(),
        recordCount: records.length,
        records,
      };
    },
  });
}
