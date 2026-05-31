import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ShadowCustomerActivationHandoff } from '../../consequence-admission/index.js';
import { withFileLock } from '../file-store.js';
import {
  compareDesc,
  defaultShadowCustomerActivationHandoffStorePath,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  saveShadowStore,
} from './shadow-persistence-helpers.js';
import {
  SHADOW_CUSTOMER_ACTIVATION_HANDOFF_STORE_VERSION,
  type AppendShadowCustomerActivationHandoffInput,
  type AppendShadowCustomerActivationHandoffResult,
  type FileBackedShadowCustomerActivationHandoffStore,
  type ShadowCustomerActivationHandoffStoreRecord,
} from './shadow-persistence-types.js';

interface ShadowCustomerActivationHandoffStoreFile {
  version: 1;
  records: ShadowCustomerActivationHandoffStoreRecord[];
}

function defaultActivationHandoffStore(): ShadowCustomerActivationHandoffStoreFile {
  return { version: 1, records: [] };
}

function normalizeActivationHandoffRecord(
  record: ShadowCustomerActivationHandoffStoreRecord,
): ShadowCustomerActivationHandoffStoreRecord {
  return {
    version: SHADOW_CUSTOMER_ACTIVATION_HANDOFF_STORE_VERSION,
    tenantId: normalizeIdentifier(record.tenantId, 'tenantId'),
    handoffId: normalizeIdentifier(record.handoffId || record.handoff?.handoffId, 'handoffId'),
    handoffDigest: normalizeIdentifier(
      record.handoffDigest || record.handoff?.digest,
      'handoffDigest',
    ),
    sourceActivationReadinessDigest: normalizeIdentifier(
      record.sourceActivationReadinessDigest ||
        record.handoff?.sourceActivationReadinessDigest,
      'sourceActivationReadinessDigest',
    ),
    handoffReady: Boolean(record.handoffReady ?? record.handoff?.handoffReady),
    recordedAt: normalizeIsoTimestamp(record.recordedAt, new Date().toISOString(), 'recordedAt'),
    handoff: record.handoff,
    rawPayloadStored: false,
  };
}

function readActivationHandoffStore(path: string): ShadowCustomerActivationHandoffStoreFile {
  if (!existsSync(path)) return defaultActivationHandoffStore();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ShadowCustomerActivationHandoffStoreFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
      throw new Error('invalid store shape');
    }
    return {
      version: 1,
      records: parsed.records.map(normalizeActivationHandoffRecord),
    };
  } catch {
    throw new Error('Shadow customer activation handoff store corruption detected.');
  }
}

function saveActivationHandoffStore(
  path: string,
  store: ShadowCustomerActivationHandoffStoreFile,
): void {
  saveShadowStore(path, store);
}

function sortActivationHandoffRecords(
  records: readonly ShadowCustomerActivationHandoffStoreRecord[],
): ShadowCustomerActivationHandoffStoreRecord[] {
  return [...records].sort((left, right) => {
    const byRecorded = compareDesc(left.recordedAt, right.recordedAt);
    if (byRecorded !== 0) return byRecorded;
    return left.handoffId.localeCompare(right.handoffId);
  });
}

function assertActivationHandoffTenantMatches(
  tenantId: string,
  handoff: ShadowCustomerActivationHandoff,
): void {
  if (handoff.tenantId !== tenantId) {
    throw new Error('Shadow customer activation handoff tenant does not match the store tenant.');
  }
  if (handoff.rawPayloadStored !== false) {
    throw new Error('Shadow customer activation handoff store only accepts data-minimized handoffs.');
  }
}

export function createFileBackedShadowCustomerActivationHandoffStore(options?: {
  readonly path?: string | null;
}): FileBackedShadowCustomerActivationHandoffStore {
  const path = resolve(options?.path ?? defaultShadowCustomerActivationHandoffStorePath());

  function withStoreLock<T>(action: (store: ShadowCustomerActivationHandoffStoreFile) => T): T {
    return withFileLock(path, () => action(readActivationHandoffStore(path)));
  }

  return Object.freeze({
    append(input: AppendShadowCustomerActivationHandoffInput): AppendShadowCustomerActivationHandoffResult {
      return withStoreLock((store) => {
        const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
        assertActivationHandoffTenantMatches(tenantId, input.handoff);
        const existing = store.records.find((record) =>
          record.tenantId === tenantId &&
          (record.handoffId === input.handoff.handoffId ||
            record.handoffDigest === input.handoff.digest)
        );
        if (existing) {
          return { kind: 'duplicate', record: normalizeActivationHandoffRecord(existing), path };
        }

        const recordedAt = normalizeIsoTimestamp(
          input.recordedAt,
          new Date().toISOString(),
          'recordedAt',
        );
        const record: ShadowCustomerActivationHandoffStoreRecord = {
          version: SHADOW_CUSTOMER_ACTIVATION_HANDOFF_STORE_VERSION,
          tenantId,
          handoffId: input.handoff.handoffId,
          handoffDigest: input.handoff.digest,
          sourceActivationReadinessDigest: input.handoff.sourceActivationReadinessDigest,
          handoffReady: input.handoff.handoffReady,
          recordedAt,
          handoff: input.handoff,
          rawPayloadStored: false,
        };
        store.records.push(record);
        saveActivationHandoffStore(path, store);
        return { kind: 'recorded', record, path };
      });
    },
    find(input: { readonly tenantId: string; readonly handoffId: string }) {
      const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
      const handoffId = normalizeIdentifier(input.handoffId, 'handoffId');
      const record = sortActivationHandoffRecords(readActivationHandoffStore(path).records)
        .find((entry) => entry.tenantId === tenantId && entry.handoffId === handoffId) ?? null;
      return { record: record ? normalizeActivationHandoffRecord(record) : null, path };
    },
  });
}
