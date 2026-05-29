import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ShadowPolicyDiscoveryCandidate } from '../../consequence-admission/index.js';
import { withFileLock } from '../file-store.js';
import { hashJsonValue } from '../json-stable.js';
import {
  compareDesc,
  defaultShadowPolicyCandidateStorePath,
  normalizeCandidateStatus,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeLimit,
  normalizeOptionalString,
  saveShadowStore,
} from './shadow-persistence-helpers.js';
import {
  SHADOW_POLICY_CANDIDATE_STORE_VERSION,
  type FileBackedShadowPolicyCandidateStore,
  type ShadowPolicyCandidateListFilters,
  type ShadowPolicyCandidateStatus,
  type ShadowPolicyCandidateStatusChange,
  type ShadowPolicyCandidateStoreRecord,
  type ShadowPolicyCandidateUpsertKind,
  type TransitionShadowPolicyCandidateInput,
  type UpsertShadowPolicyCandidateInput,
  type UpsertShadowPolicyCandidateResult,
  type UpsertShadowPolicyCandidateBundleResult,
} from './shadow-persistence-types.js';

interface ShadowPolicyCandidateStoreFile {
  version: 1;
  records: ShadowPolicyCandidateStoreRecord[];
}

function defaultCandidateStore(): ShadowPolicyCandidateStoreFile {
  return { version: 1, records: [] };
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
  saveShadowStore(path, store);
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
      readonly bundle: Parameters<FileBackedShadowPolicyCandidateStore['upsertBundle']>[0]['bundle'];
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
