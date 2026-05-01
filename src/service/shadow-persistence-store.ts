/**
 * Shadow persistence stores - evaluation file-backed first slice.
 *
 * BOUNDARY:
 * - Local file-backed stores for evaluation/self-hosted development
 * - Tenant-scoped logical records with atomic writes and file locks
 * - Stores data-minimized shadow events and approval-required policy candidates
 * - Not a production shared database, SIEM, policy authoring UI, or immutable ledger
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type {
  ShadowAdmissionEvent,
  ShadowPolicyDiscoveryCandidate,
  ShadowPolicyDiscoveryCandidates,
} from '../consequence-admission/index.js';
import { hashJsonValue } from './json-stable.js';
import { withFileLock, writeTextFileAtomic } from './file-store.js';

export const SHADOW_ADMISSION_EVENT_STORE_VERSION =
  'attestor.shadow-admission-event-store.v1';
export const SHADOW_POLICY_CANDIDATE_STORE_VERSION =
  'attestor.shadow-policy-candidate-store.v1';

export const SHADOW_POLICY_CANDIDATE_STATUSES = [
  'draft',
  'proposed',
  'approved',
  'rejected',
  'activated',
  'superseded',
] as const;
export type ShadowPolicyCandidateStatus =
  typeof SHADOW_POLICY_CANDIDATE_STATUSES[number];

export type ShadowAdmissionStoreAppendResultKind = 'recorded' | 'duplicate';
export type ShadowPolicyCandidateUpsertKind = 'created' | 'updated' | 'unchanged';

export interface ShadowAdmissionEventStoreRecord {
  readonly version: typeof SHADOW_ADMISSION_EVENT_STORE_VERSION;
  readonly tenantId: string;
  readonly sequence: number;
  readonly recordedAt: string;
  readonly event: ShadowAdmissionEvent;
  readonly rawPayloadStored: false;
}

interface ShadowAdmissionEventStoreFile {
  version: 1;
  records: ShadowAdmissionEventStoreRecord[];
}

export interface ShadowAdmissionEventListFilters {
  readonly tenantId: string;
  readonly actionSurface?: string | null;
  readonly domain?: string | null;
  readonly limit?: number | null;
}

export interface ShadowAdmissionEventStoreSummary {
  readonly tenantId: string;
  readonly storageMode: 'file-backed-evaluation';
  readonly eventCount: number;
  readonly latestEventDigest: string | null;
  readonly latestRecordedAt: string | null;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface AppendShadowAdmissionEventInput {
  readonly tenantId: string;
  readonly event: ShadowAdmissionEvent;
  readonly recordedAt?: string | null;
}

export interface AppendShadowAdmissionEventResult {
  readonly kind: ShadowAdmissionStoreAppendResultKind;
  readonly record: ShadowAdmissionEventStoreRecord;
  readonly path: string;
}

export interface FileBackedShadowAdmissionEventStore {
  append(input: AppendShadowAdmissionEventInput): AppendShadowAdmissionEventResult;
  list(filters: ShadowAdmissionEventListFilters): {
    readonly records: readonly ShadowAdmissionEventStoreRecord[];
    readonly events: readonly ShadowAdmissionEvent[];
    readonly path: string;
  };
  summarize(input: { readonly tenantId: string }): {
    readonly summary: ShadowAdmissionEventStoreSummary;
    readonly path: string;
  };
  exportSnapshot(): {
    readonly path: string;
    readonly version: 1;
    readonly exportedAt: string;
    readonly recordCount: number;
    readonly records: readonly ShadowAdmissionEventStoreRecord[];
  };
}

export interface ShadowPolicyCandidateStatusChange {
  readonly status: ShadowPolicyCandidateStatus;
  readonly changedAt: string;
  readonly actorRef: string;
  readonly reason: string;
}

export interface ShadowPolicyCandidateStoreRecord {
  readonly version: typeof SHADOW_POLICY_CANDIDATE_STORE_VERSION;
  readonly tenantId: string;
  readonly candidateId: string;
  readonly candidateDigest: string;
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly sourceReportId: string | null;
  readonly sourceReportDigest: string | null;
  readonly status: ShadowPolicyCandidateStatus;
  readonly statusHistory: readonly ShadowPolicyCandidateStatusChange[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
}

interface ShadowPolicyCandidateStoreFile {
  version: 1;
  records: ShadowPolicyCandidateStoreRecord[];
}

export interface UpsertShadowPolicyCandidateInput {
  readonly tenantId: string;
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly sourceReportId?: string | null;
  readonly sourceReportDigest?: string | null;
  readonly observedAt?: string | null;
}

export interface UpsertShadowPolicyCandidateResult {
  readonly kind: ShadowPolicyCandidateUpsertKind;
  readonly record: ShadowPolicyCandidateStoreRecord;
  readonly path: string;
}

export interface UpsertShadowPolicyCandidateBundleResult {
  readonly records: readonly ShadowPolicyCandidateStoreRecord[];
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly unchangedCount: number;
  readonly path: string;
}

export interface ShadowPolicyCandidateListFilters {
  readonly tenantId: string;
  readonly status?: ShadowPolicyCandidateStatus | null;
  readonly actionSurface?: string | null;
  readonly domain?: string | null;
  readonly limit?: number | null;
}

export interface TransitionShadowPolicyCandidateInput {
  readonly tenantId: string;
  readonly candidateId: string;
  readonly status: ShadowPolicyCandidateStatus;
  readonly actorRef: string;
  readonly reason: string;
  readonly changedAt?: string | null;
}

export interface FileBackedShadowPolicyCandidateStore {
  upsertCandidate(input: UpsertShadowPolicyCandidateInput): UpsertShadowPolicyCandidateResult;
  upsertBundle(input: {
    readonly tenantId: string;
    readonly bundle: ShadowPolicyDiscoveryCandidates;
  }): UpsertShadowPolicyCandidateBundleResult;
  list(filters: ShadowPolicyCandidateListFilters): {
    readonly records: readonly ShadowPolicyCandidateStoreRecord[];
    readonly path: string;
  };
  transitionStatus(input: TransitionShadowPolicyCandidateInput): {
    readonly record: ShadowPolicyCandidateStoreRecord;
    readonly path: string;
  };
  summarize(input: { readonly tenantId: string }): {
    readonly summary: {
      readonly tenantId: string;
      readonly storageMode: 'file-backed-evaluation';
      readonly candidateCount: number;
      readonly byStatus: Readonly<Record<ShadowPolicyCandidateStatus, number>>;
      readonly approvalRequired: true;
      readonly autoEnforce: false;
      readonly rawPayloadStored: false;
      readonly productionReady: false;
    };
    readonly path: string;
  };
}

function defaultShadowAdmissionEventStorePath(): string {
  return resolve(process.env.ATTESTOR_SHADOW_ADMISSION_EVENT_STORE_PATH ?? '.attestor/shadow-admission-events.json');
}

function defaultShadowPolicyCandidateStorePath(): string {
  return resolve(process.env.ATTESTOR_SHADOW_POLICY_CANDIDATE_STORE_PATH ?? '.attestor/shadow-policy-candidates.json');
}

function defaultAdmissionStore(): ShadowAdmissionEventStoreFile {
  return { version: 1, records: [] };
}

function defaultCandidateStore(): ShadowPolicyCandidateStoreFile {
  return { version: 1, records: [] };
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Shadow persistence ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Shadow persistence ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeIsoTimestamp(
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

function normalizeLimit(limit: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(limit ?? Number.NaN) || (limit ?? 0) <= 0) return fallback;
  return Math.min(Math.trunc(limit as number), 1_000);
}

function isCandidateStatus(value: string): value is ShadowPolicyCandidateStatus {
  return SHADOW_POLICY_CANDIDATE_STATUSES.includes(value as ShadowPolicyCandidateStatus);
}

function normalizeCandidateStatus(
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

function compareDesc(left: string | null, right: string | null): number {
  const leftKey = left ?? '';
  const rightKey = right ?? '';
  if (leftKey === rightKey) return 0;
  return leftKey < rightKey ? 1 : -1;
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
  mkdirSync(dirname(path), { recursive: true });
  writeTextFileAtomic(path, `${JSON.stringify(store, null, 2)}\n`);
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

function normalizeStatusHistory(
  history: readonly ShadowPolicyCandidateStatusChange[],
): readonly ShadowPolicyCandidateStatusChange[] {
  return Object.freeze(history.map((entry) => ({
    status: normalizeCandidateStatus(entry.status, 'statusHistory.status'),
    changedAt: normalizeIsoTimestamp(entry.changedAt, new Date().toISOString(), 'statusHistory.changedAt'),
    actorRef: normalizeIdentifier(entry.actorRef, 'statusHistory.actorRef'),
    reason: normalizeIdentifier(entry.reason, 'statusHistory.reason'),
  })));
}

function candidateDigest(candidate: ShadowPolicyDiscoveryCandidate): string {
  return `sha256:${hashJsonValue(candidate)}`;
}

function normalizeCandidateRecord(
  record: ShadowPolicyCandidateStoreRecord,
): ShadowPolicyCandidateStoreRecord {
  const candidateId = normalizeIdentifier(
    record.candidateId || record.candidate?.candidateId,
    'candidateId',
  );
  const digest = record.candidateDigest?.startsWith('sha256:')
    ? record.candidateDigest
    : candidateDigest(record.candidate);
  return {
    version: SHADOW_POLICY_CANDIDATE_STORE_VERSION,
    tenantId: normalizeIdentifier(record.tenantId, 'tenantId'),
    candidateId,
    candidateDigest: digest,
    candidate: record.candidate,
    sourceReportId: normalizeOptionalString(record.sourceReportId),
    sourceReportDigest: normalizeOptionalString(record.sourceReportDigest),
    status: normalizeCandidateStatus(record.status, 'status'),
    statusHistory: normalizeStatusHistory(record.statusHistory ?? []),
    createdAt: normalizeIsoTimestamp(record.createdAt, new Date().toISOString(), 'createdAt'),
    updatedAt: normalizeIsoTimestamp(record.updatedAt, new Date().toISOString(), 'updatedAt'),
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
  };
}

function readCandidateStore(path: string): ShadowPolicyCandidateStoreFile {
  if (!existsSync(path)) return defaultCandidateStore();
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as ShadowPolicyCandidateStoreFile;
  if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
    throw new Error('Shadow policy candidate store file is invalid.');
  }
  return {
    version: 1,
    records: parsed.records.map(normalizeCandidateRecord),
  };
}

function saveCandidateStore(path: string, store: ShadowPolicyCandidateStoreFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeTextFileAtomic(path, `${JSON.stringify(store, null, 2)}\n`);
}

function sortCandidateRecords(
  records: readonly ShadowPolicyCandidateStoreRecord[],
): ShadowPolicyCandidateStoreRecord[] {
  return [...records].sort((left, right) => {
    const byUpdated = compareDesc(left.updatedAt, right.updatedAt);
    if (byUpdated !== 0) return byUpdated;
    return left.candidateId.localeCompare(right.candidateId);
  });
}

function createInitialStatusHistory(createdAt: string): readonly ShadowPolicyCandidateStatusChange[] {
  return Object.freeze([
    {
      status: 'draft',
      changedAt: createdAt,
      actorRef: 'attestor:policy-discovery',
      reason: 'Candidate was derived from shadow-mode observations and requires customer approval.',
    },
  ]);
}

function createCandidateRecord(input: UpsertShadowPolicyCandidateInput): ShadowPolicyCandidateStoreRecord {
  const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
  const createdAt = normalizeIsoTimestamp(
    input.observedAt,
    new Date().toISOString(),
    'observedAt',
  );
  return {
    version: SHADOW_POLICY_CANDIDATE_STORE_VERSION,
    tenantId,
    candidateId: normalizeIdentifier(input.candidate.candidateId, 'candidateId'),
    candidateDigest: candidateDigest(input.candidate),
    candidate: input.candidate,
    sourceReportId: normalizeOptionalString(input.sourceReportId),
    sourceReportDigest: normalizeOptionalString(input.sourceReportDigest),
    status: 'draft',
    statusHistory: createInitialStatusHistory(createdAt),
    createdAt,
    updatedAt: createdAt,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
  };
}

function upsertCandidateInStore(
  store: ShadowPolicyCandidateStoreFile,
  input: UpsertShadowPolicyCandidateInput,
): { kind: ShadowPolicyCandidateUpsertKind; record: ShadowPolicyCandidateStoreRecord } {
  const next = createCandidateRecord(input);
  const existingIndex = store.records.findIndex((record) =>
    record.tenantId === next.tenantId && record.candidateId === next.candidateId
  );
  if (existingIndex < 0) {
    store.records.push(next);
    return { kind: 'created', record: next };
  }

  const existing = normalizeCandidateRecord(store.records[existingIndex]!);
  if (
    existing.candidateDigest === next.candidateDigest &&
    existing.sourceReportId === next.sourceReportId &&
    existing.sourceReportDigest === next.sourceReportDigest
  ) {
    store.records[existingIndex] = existing;
    return { kind: 'unchanged', record: existing };
  }

  const updated: ShadowPolicyCandidateStoreRecord = {
    ...existing,
    candidateDigest: next.candidateDigest,
    candidate: next.candidate,
    sourceReportId: next.sourceReportId,
    sourceReportDigest: next.sourceReportDigest,
    updatedAt: next.updatedAt,
  };
  store.records[existingIndex] = updated;
  return { kind: 'updated', record: updated };
}

function allowedNextStatuses(status: ShadowPolicyCandidateStatus): readonly ShadowPolicyCandidateStatus[] {
  if (status === 'draft') return Object.freeze(['proposed', 'rejected', 'superseded']);
  if (status === 'proposed') return Object.freeze(['approved', 'rejected', 'superseded']);
  if (status === 'approved') return Object.freeze(['activated', 'superseded']);
  if (status === 'activated' || status === 'rejected') return Object.freeze(['superseded']);
  return Object.freeze([]);
}

function statusCounts(
  records: readonly ShadowPolicyCandidateStoreRecord[],
): Readonly<Record<ShadowPolicyCandidateStatus, number>> {
  const counts: Record<ShadowPolicyCandidateStatus, number> = {
    draft: 0,
    proposed: 0,
    approved: 0,
    rejected: 0,
    activated: 0,
    superseded: 0,
  };
  for (const record of records) counts[record.status] += 1;
  return Object.freeze(counts);
}

export function createFileBackedShadowPolicyCandidateStore(options?: {
  readonly path?: string | null;
}): FileBackedShadowPolicyCandidateStore {
  const path = resolve(options?.path ?? defaultShadowPolicyCandidateStorePath());

  function withStoreLock<T>(action: (store: ShadowPolicyCandidateStoreFile) => T): T {
    return withFileLock(path, () => action(readCandidateStore(path)));
  }

  return Object.freeze({
    upsertCandidate(input: UpsertShadowPolicyCandidateInput): UpsertShadowPolicyCandidateResult {
      return withStoreLock((store) => {
        const result = upsertCandidateInStore(store, input);
        if (result.kind !== 'unchanged') saveCandidateStore(path, store);
        return { ...result, path };
      });
    },
    upsertBundle(input: {
      readonly tenantId: string;
      readonly bundle: ShadowPolicyDiscoveryCandidates;
    }): UpsertShadowPolicyCandidateBundleResult {
      return withStoreLock((store) => {
        let createdCount = 0;
        let updatedCount = 0;
        let unchangedCount = 0;
        const records: ShadowPolicyCandidateStoreRecord[] = [];
        for (const candidate of input.bundle.candidates) {
          const result = upsertCandidateInStore(store, {
            tenantId: input.tenantId,
            candidate,
            sourceReportId: input.bundle.sourceReportId,
            sourceReportDigest: input.bundle.sourceReportDigest,
            observedAt: input.bundle.generatedAt,
          });
          if (result.kind === 'created') createdCount += 1;
          if (result.kind === 'updated') updatedCount += 1;
          if (result.kind === 'unchanged') unchangedCount += 1;
          records.push(result.record);
        }
        if (createdCount > 0 || updatedCount > 0) saveCandidateStore(path, store);
        return {
          records,
          createdCount,
          updatedCount,
          unchangedCount,
          path,
        };
      });
    },
    list(filters: ShadowPolicyCandidateListFilters) {
      const tenantId = normalizeIdentifier(filters.tenantId, 'tenantId');
      const status = filters.status ? normalizeCandidateStatus(filters.status, 'status') : null;
      const actionSurface = normalizeOptionalString(filters.actionSurface);
      const domain = normalizeOptionalString(filters.domain);
      const limit = normalizeLimit(filters.limit, 500);
      const records = sortCandidateRecords(readCandidateStore(path).records)
        .filter((record) => record.tenantId === tenantId)
        .filter((record) => !status || record.status === status)
        .filter((record) => !actionSurface || record.candidate.actionSurface === actionSurface)
        .filter((record) => !domain || record.candidate.domain === domain)
        .slice(0, limit);
      return { records, path };
    },
    transitionStatus(input: TransitionShadowPolicyCandidateInput) {
      return withStoreLock((store) => {
        const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
        const candidateId = normalizeIdentifier(input.candidateId, 'candidateId');
        const nextStatus = normalizeCandidateStatus(input.status, 'status');
        const actorRef = normalizeIdentifier(input.actorRef, 'actorRef');
        const reason = normalizeIdentifier(input.reason, 'reason');
        const changedAt = normalizeIsoTimestamp(
          input.changedAt,
          new Date().toISOString(),
          'changedAt',
        );
        const index = store.records.findIndex((record) =>
          record.tenantId === tenantId && record.candidateId === candidateId
        );
        if (index < 0) {
          throw new Error(`Shadow policy candidate '${candidateId}' was not found.`);
        }
        const current = normalizeCandidateRecord(store.records[index]!);
        if (current.status === nextStatus) return { record: current, path };
        const allowed = allowedNextStatuses(current.status);
        if (!allowed.includes(nextStatus)) {
          throw new Error(
            `Shadow policy candidate cannot transition from ${current.status} to ${nextStatus}.`,
          );
        }
        const record: ShadowPolicyCandidateStoreRecord = {
          ...current,
          status: nextStatus,
          updatedAt: changedAt,
          statusHistory: Object.freeze([
            ...current.statusHistory,
            {
              status: nextStatus,
              changedAt,
              actorRef,
              reason,
            },
          ]),
          approvalRequired: true,
          autoEnforce: false,
          rawPayloadStored: false,
        };
        store.records[index] = record;
        saveCandidateStore(path, store);
        return { record, path };
      });
    },
    summarize(input: { readonly tenantId: string }) {
      const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
      const records = readCandidateStore(path).records
        .filter((record) => record.tenantId === tenantId);
      return {
        summary: {
          tenantId,
          storageMode: 'file-backed-evaluation',
          candidateCount: records.length,
          byStatus: statusCounts(records),
          approvalRequired: true,
          autoEnforce: false,
          rawPayloadStored: false,
          productionReady: false,
        } as const,
        path,
      };
    },
  });
}

export function resetShadowPersistenceStoresForTests(options?: {
  readonly admissionEventPath?: string | null;
  readonly policyCandidatePath?: string | null;
}): void {
  const admissionPath = resolve(options?.admissionEventPath ?? defaultShadowAdmissionEventStorePath());
  const candidatePath = resolve(options?.policyCandidatePath ?? defaultShadowPolicyCandidateStorePath());
  for (const path of [admissionPath, candidatePath]) {
    if (existsSync(path)) rmSync(path, { force: true });
    if (existsSync(`${path}.lock`)) rmSync(`${path}.lock`, { recursive: true, force: true });
  }
}
