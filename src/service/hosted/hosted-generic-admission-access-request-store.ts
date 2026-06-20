/**
 * Hosted generic admission access-request task store.
 *
 * BOUNDARY:
 * - Local file-backed evaluation store by default.
 * - Stores digest-first requestable-denial tasks only.
 * - Does not store raw approval refs, raw actor refs, raw policy refs, release
 *   tokens, sender proofs, or customer payloads.
 * - Not a live approval workflow, shared production queue, or customer PEP.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  completeConsequenceAdmissionAccessRequestTask,
  createConsequenceAdmissionAccessRequestTask,
  type CompleteConsequenceAdmissionAccessRequestTaskInput,
  type ConsequenceAdmissionAccessRequestPrincipalBinding,
  type ConsequenceAdmissionAccessRequestTask,
  type ConsequenceAdmissionRequestableDenial,
} from '../../consequence-admission/index.js';
import { withFileLock } from '../file-store.js';
import {
  compareDesc,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeLimit,
  saveShadowStore,
} from '../shadow/shadow-persistence-helpers.js';

export const HOSTED_GENERIC_ADMISSION_ACCESS_REQUEST_STORE_VERSION =
  'attestor.hosted-generic-admission-access-request-store.v1';

export interface HostedGenericAdmissionAccessRequestStoreRecord {
  readonly version: typeof HOSTED_GENERIC_ADMISSION_ACCESS_REQUEST_STORE_VERSION;
  readonly tenantId: string;
  readonly task: ConsequenceAdmissionAccessRequestTask;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface HostedGenericAdmissionAccessRequestStoreListInput {
  readonly tenantId: string;
  readonly limit?: number | null;
}

export interface HostedGenericAdmissionAccessRequestStoreCreateInput {
  readonly tenantId: string;
  readonly denial: ConsequenceAdmissionRequestableDenial;
  readonly createdAt: string;
  readonly requester: NonNullable<CompleteConsequenceAdmissionAccessRequestTaskInput['decisionAuthority']>;
  readonly statusEndpoint?: string | null;
}

export interface HostedGenericAdmissionAccessRequestStoreCompleteInput {
  readonly tenantId: string;
  readonly taskId: string;
  readonly status: CompleteConsequenceAdmissionAccessRequestTaskInput['status'];
  readonly decidedAt: string;
  readonly decisionAuthority?: CompleteConsequenceAdmissionAccessRequestTaskInput['decisionAuthority'];
  readonly approval?: CompleteConsequenceAdmissionAccessRequestTaskInput['approval'];
}

export interface HostedGenericAdmissionAccessRequestStore {
  create(input: HostedGenericAdmissionAccessRequestStoreCreateInput):
    HostedGenericAdmissionAccessRequestStoreRecord;
  complete(input: HostedGenericAdmissionAccessRequestStoreCompleteInput):
    HostedGenericAdmissionAccessRequestStoreRecord | null;
  get(input: {
    readonly tenantId: string;
    readonly taskId: string;
  }): HostedGenericAdmissionAccessRequestStoreRecord | null;
  list(input: HostedGenericAdmissionAccessRequestStoreListInput): {
    readonly records: readonly HostedGenericAdmissionAccessRequestStoreRecord[];
    readonly path: string;
  };
  exportSnapshot(): {
    readonly path: string;
    readonly version: 1;
    readonly exportedAt: string;
    readonly recordCount: number;
    readonly records: readonly HostedGenericAdmissionAccessRequestStoreRecord[];
  };
}

interface StoreFile {
  version: 1;
  records: HostedGenericAdmissionAccessRequestStoreRecord[];
}

function defaultStorePath(): string {
  return process.env.ATTESTOR_GENERIC_ADMISSION_ACCESS_REQUEST_STORE_PATH ??
    '.attestor/generic-admission-access-requests.json';
}

function defaultStore(): StoreFile {
  return { version: 1, records: [] };
}

function normalizeTask(
  task: ConsequenceAdmissionAccessRequestTask,
): ConsequenceAdmissionAccessRequestTask {
  const legacyTask = task as ConsequenceAdmissionAccessRequestTask & {
    readonly requester?: ConsequenceAdmissionAccessRequestPrincipalBinding | null;
  };
  return {
    ...task,
    statusEndpoint: task.statusEndpoint?.trim() || null,
    createdAt: normalizeIsoTimestamp(task.createdAt, new Date().toISOString(), 'task.createdAt'),
    updatedAt: normalizeIsoTimestamp(task.updatedAt, new Date().toISOString(), 'task.updatedAt'),
    expiresAt: normalizeIsoTimestamp(task.expiresAt, new Date().toISOString(), 'task.expiresAt'),
    requester: legacyTask.requester ?? null,
    result: task.result
      ? {
          ...task.result,
          approval: {
            ...task.result.approval,
            decisionAuthority: task.result.approval.decisionAuthority ?? null,
          },
        } as ConsequenceAdmissionAccessRequestTask['result']
      : null,
    accessPermitted: false,
    releaseTokenMayBeIssued: false,
    rawPayloadStored: false,
  };
}

function normalizeRecord(
  record: HostedGenericAdmissionAccessRequestStoreRecord,
): HostedGenericAdmissionAccessRequestStoreRecord {
  return {
    version: HOSTED_GENERIC_ADMISSION_ACCESS_REQUEST_STORE_VERSION,
    tenantId: normalizeIdentifier(record.tenantId, 'tenantId'),
    task: normalizeTask(record.task),
    createdAt: normalizeIsoTimestamp(record.createdAt, new Date().toISOString(), 'createdAt'),
    updatedAt: normalizeIsoTimestamp(record.updatedAt, new Date().toISOString(), 'updatedAt'),
    rawPayloadStored: false,
    productionReady: false,
  };
}

function readStore(path: string): StoreFile {
  if (!existsSync(path)) return defaultStore();
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as StoreFile;
  if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
    throw new Error('Hosted generic admission access request store file is invalid.');
  }
  return {
    version: 1,
    records: parsed.records.map(normalizeRecord),
  };
}

function sortRecords(
  records: readonly HostedGenericAdmissionAccessRequestStoreRecord[],
): HostedGenericAdmissionAccessRequestStoreRecord[] {
  return [...records].sort((left, right) => {
    const byUpdated = compareDesc(left.updatedAt, right.updatedAt);
    if (byUpdated !== 0) return byUpdated;
    return left.task.id < right.task.id ? 1 : -1;
  });
}

function taskIdFor(denial: ConsequenceAdmissionRequestableDenial): string {
  return `arq_${denial.binding.digest.slice('sha256:'.length, 'sha256:'.length + 24)}`;
}

function assertTaskIsSafe(record: HostedGenericAdmissionAccessRequestStoreRecord): void {
  if (record.rawPayloadStored !== false || record.task.rawPayloadStored !== false) {
    throw new Error('Hosted generic admission access request store only accepts data-minimized tasks.');
  }
  if (record.task.accessPermitted !== false || record.task.releaseTokenMayBeIssued !== false) {
    throw new Error('Hosted generic admission access request tasks cannot permit access or issue release tokens.');
  }
}

export function createFileBackedHostedGenericAdmissionAccessRequestStore(options?: {
  readonly path?: string | null;
}): HostedGenericAdmissionAccessRequestStore {
  const path = resolve(options?.path ?? defaultStorePath());

  function withStoreLock<T>(action: (store: StoreFile) => T): T {
    return withFileLock(path, () => action(readStore(path)));
  }

  return Object.freeze({
    create(input: HostedGenericAdmissionAccessRequestStoreCreateInput) {
      return withStoreLock((store) => {
        const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
        const createdAt = normalizeIsoTimestamp(input.createdAt, new Date().toISOString(), 'createdAt');
        const existing = store.records.find((record) =>
          record.tenantId === tenantId &&
          record.task.denial.binding.digest === input.denial.binding.digest
        );
        if (existing) {
          return normalizeRecord(existing);
        }

        const taskId = taskIdFor(input.denial);
        const task = createConsequenceAdmissionAccessRequestTask({
          denial: input.denial,
          taskId,
          createdAt,
          requester: input.requester,
          statusEndpoint: input.statusEndpoint ?? `/api/v1/admissions/access-requests/${taskId}`,
        });
        const record: HostedGenericAdmissionAccessRequestStoreRecord = {
          version: HOSTED_GENERIC_ADMISSION_ACCESS_REQUEST_STORE_VERSION,
          tenantId,
          task,
          createdAt,
          updatedAt: task.updatedAt,
          rawPayloadStored: false,
          productionReady: false,
        };
        assertTaskIsSafe(record);
        store.records.push(record);
        saveShadowStore(path, store);
        return record;
      });
    },
    complete(input: HostedGenericAdmissionAccessRequestStoreCompleteInput) {
      return withStoreLock((store) => {
        const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
        const taskId = normalizeIdentifier(input.taskId, 'taskId');
        const index = store.records.findIndex((record) =>
          record.tenantId === tenantId && record.task.id === taskId
        );
        if (index < 0) return null;
        const current = normalizeRecord(store.records[index]);
        const completedTask = completeConsequenceAdmissionAccessRequestTask({
          task: current.task,
          status: input.status,
          decidedAt: input.decidedAt,
          decisionAuthority: input.decisionAuthority,
          approval: input.approval,
        });
        const record: HostedGenericAdmissionAccessRequestStoreRecord = {
          ...current,
          task: completedTask,
          updatedAt: completedTask.updatedAt,
          rawPayloadStored: false,
          productionReady: false,
        };
        assertTaskIsSafe(record);
        store.records[index] = record;
        saveShadowStore(path, store);
        return normalizeRecord(record);
      });
    },
    get(input: {
      readonly tenantId: string;
      readonly taskId: string;
    }) {
      const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
      const taskId = normalizeIdentifier(input.taskId, 'taskId');
      const record = readStore(path).records.find((item) =>
        item.tenantId === tenantId && item.task.id === taskId
      );
      return record ? normalizeRecord(record) : null;
    },
    list(input: HostedGenericAdmissionAccessRequestStoreListInput) {
      const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
      const limit = normalizeLimit(input.limit, 100);
      const records = sortRecords(readStore(path).records)
        .filter((record) => record.tenantId === tenantId)
        .slice(0, limit)
        .map(normalizeRecord);
      return { records, path };
    },
    exportSnapshot() {
      const records = sortRecords(readStore(path).records).reverse();
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
