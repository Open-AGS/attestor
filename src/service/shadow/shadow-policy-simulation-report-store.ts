import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ShadowPolicySimulationReport } from '../../consequence-admission/index.js';
import { withFileLock } from '../file-store.js';
import {
  compareDesc,
  defaultShadowPolicySimulationReportStorePath,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeLimit,
  normalizeMode,
  normalizeOptionalString,
  saveShadowStore,
} from './shadow-persistence-helpers.js';
import {
  SHADOW_POLICY_SIMULATION_REPORT_STORE_VERSION,
  type AppendShadowPolicySimulationReportInput,
  type AppendShadowPolicySimulationReportResult,
  type FileBackedShadowPolicySimulationReportStore,
  type ShadowPolicySimulationReportListFilters,
  type ShadowPolicySimulationReportStoreRecord,
} from './shadow-persistence-types.js';

interface ShadowPolicySimulationReportStoreFile {
  version: 1;
  records: ShadowPolicySimulationReportStoreRecord[];
}

function defaultSimulationStore(): ShadowPolicySimulationReportStoreFile {
  return { version: 1, records: [] };
}

function normalizeSimulationRecord(
  record: ShadowPolicySimulationReportStoreRecord,
): ShadowPolicySimulationReportStoreRecord {
  return {
    version: SHADOW_POLICY_SIMULATION_REPORT_STORE_VERSION,
    tenantId: normalizeIdentifier(record.tenantId, 'tenantId'),
    reportId: normalizeIdentifier(record.reportId || record.report?.reportId, 'reportId'),
    reportDigest: normalizeIdentifier(record.reportDigest || record.report?.digest, 'reportDigest'),
    proposedMode: normalizeMode(record.proposedMode ?? record.report?.proposedMode, 'proposedMode') ?? 'review',
    eventCount: Number.isFinite(record.eventCount)
      ? Math.max(0, Math.trunc(record.eventCount))
      : record.report?.eventCount ?? 0,
    windowStart: normalizeOptionalString(record.windowStart ?? record.report?.windowStart),
    windowEnd: normalizeOptionalString(record.windowEnd ?? record.report?.windowEnd),
    recordedAt: normalizeIsoTimestamp(record.recordedAt, new Date().toISOString(), 'recordedAt'),
    report: record.report,
    rawPayloadStored: false,
  };
}

function readSimulationStore(path: string): ShadowPolicySimulationReportStoreFile {
  if (!existsSync(path)) return defaultSimulationStore();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ShadowPolicySimulationReportStoreFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
      throw new Error('invalid store shape');
    }
    return {
      version: 1,
      records: parsed.records.map(normalizeSimulationRecord),
    };
  } catch {
    throw new Error('Shadow policy simulation report store corruption detected.');
  }
}

function saveSimulationStore(path: string, store: ShadowPolicySimulationReportStoreFile): void {
  saveShadowStore(path, store);
}

function sortSimulationRecords(
  records: readonly ShadowPolicySimulationReportStoreRecord[],
): ShadowPolicySimulationReportStoreRecord[] {
  return [...records].sort((left, right) => {
    const byRecorded = compareDesc(left.recordedAt, right.recordedAt);
    if (byRecorded !== 0) return byRecorded;
    return left.reportId.localeCompare(right.reportId);
  });
}

function assertSimulationReportDataMinimized(report: ShadowPolicySimulationReport): void {
  if (report.rawPayloadEventCount !== 0) {
    throw new Error('Shadow policy simulation store only accepts data-minimized reports.');
  }
}

export function createFileBackedShadowPolicySimulationReportStore(options?: {
  readonly path?: string | null;
}): FileBackedShadowPolicySimulationReportStore {
  const path = resolve(options?.path ?? defaultShadowPolicySimulationReportStorePath());

  function withStoreLock<T>(action: (store: ShadowPolicySimulationReportStoreFile) => T): T {
    return withFileLock(path, () => action(readSimulationStore(path)));
  }

  return Object.freeze({
    append(input: AppendShadowPolicySimulationReportInput): AppendShadowPolicySimulationReportResult {
      return withStoreLock((store) => {
        const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
        assertSimulationReportDataMinimized(input.report);
        const existing = store.records.find((record) =>
          record.tenantId === tenantId &&
          (record.reportId === input.report.reportId || record.reportDigest === input.report.digest)
        );
        if (existing) {
          return { kind: 'duplicate', record: normalizeSimulationRecord(existing), path };
        }

        const recordedAt = normalizeIsoTimestamp(
          input.recordedAt,
          new Date().toISOString(),
          'recordedAt',
        );
        const record: ShadowPolicySimulationReportStoreRecord = {
          version: SHADOW_POLICY_SIMULATION_REPORT_STORE_VERSION,
          tenantId,
          reportId: input.report.reportId,
          reportDigest: input.report.digest,
          proposedMode: input.report.proposedMode,
          eventCount: input.report.eventCount,
          windowStart: input.report.windowStart,
          windowEnd: input.report.windowEnd,
          recordedAt,
          report: input.report,
          rawPayloadStored: false,
        };
        store.records.push(record);
        saveSimulationStore(path, store);
        return { kind: 'recorded', record, path };
      });
    },
    list(filters: ShadowPolicySimulationReportListFilters) {
      const tenantId = normalizeIdentifier(filters.tenantId, 'tenantId');
      const proposedMode = normalizeMode(filters.proposedMode, 'proposedMode');
      const limit = normalizeLimit(filters.limit, 100);
      const records = sortSimulationRecords(readSimulationStore(path).records)
        .filter((record) => record.tenantId === tenantId)
        .filter((record) => !proposedMode || record.proposedMode === proposedMode)
        .slice(0, limit);
      return {
        records,
        reports: records.map((record) => record.report),
        path,
      };
    },
    find(input: { readonly tenantId: string; readonly reportId: string }) {
      const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
      const reportId = normalizeIdentifier(input.reportId, 'reportId');
      const record = readSimulationStore(path).records.find((entry) =>
        entry.tenantId === tenantId && entry.reportId === reportId
      ) ?? null;
      return { record: record ? normalizeSimulationRecord(record) : null, path };
    },
    summarize(input: { readonly tenantId: string }) {
      const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
      const records = sortSimulationRecords(readSimulationStore(path).records)
        .filter((record) => record.tenantId === tenantId);
      return {
        summary: {
          tenantId,
          storageMode: 'file-backed-evaluation',
          reportCount: records.length,
          latestReportDigest: records[0]?.reportDigest ?? null,
          latestRecordedAt: records[0]?.recordedAt ?? null,
          rawPayloadStored: false,
          productionReady: false,
        } as const,
        path,
      };
    },
  });
}
