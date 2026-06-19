import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { withFileLock, writeTextFileAtomic } from '../platform/file-store.js';
import type { RiskClass } from './types.js';
import {
  ATTESTOR_RELEASE_REVIEWER_QUEUE_STORE_PATH_ENV,
  ReleaseReviewerQueueError,
  ReleaseReviewerQueueStoreError,
  type CommitPendingReviewerQueueTransitionInput,
  type ReleaseReviewerQueueDetail,
  type ReleaseReviewerQueueListOptions,
  type ReleaseReviewerQueueListResult,
  type ReleaseReviewerQueueRecord,
  type ReleaseReviewerQueueStore,
} from './reviewer-queue-types.js';
import { freezeRecord, riskRank } from './reviewer-queue-helpers.js';

interface ReleaseReviewerQueueStoreFile {
  readonly version: 1;
  records: ReleaseReviewerQueueRecord[];
}

const DEFAULT_RELEASE_REVIEWER_QUEUE_STORE_PATH = '.attestor/release-reviewer-queue-store.json';

function defaultReleaseReviewerQueueStoreFile(): ReleaseReviewerQueueStoreFile {
  return {
    version: 1,
    records: [],
  };
}

function defaultReleaseReviewerQueueStorePath(): string {
  return resolve(
    process.env[ATTESTOR_RELEASE_REVIEWER_QUEUE_STORE_PATH_ENV] ??
      DEFAULT_RELEASE_REVIEWER_QUEUE_STORE_PATH,
  );
}

function ensureReleaseReviewerQueueStoreDirectory(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function normalizeReleaseReviewerQueueStoreFile(
  value: unknown,
  path: string,
): ReleaseReviewerQueueStoreFile {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (value as { version?: unknown }).version !== 1 ||
    !Array.isArray((value as { records?: unknown }).records)
  ) {
    throw new ReleaseReviewerQueueStoreError(
      `Release reviewer queue store '${path}' has an invalid file shape.`,
    );
  }

  return {
    version: 1,
    records: (value as { records: ReleaseReviewerQueueRecord[] }).records.map((record) =>
      freezeRecord(record),
    ),
  };
}

function loadReleaseReviewerQueueStoreFile(path: string): ReleaseReviewerQueueStoreFile {
  ensureReleaseReviewerQueueStoreDirectory(path);
  if (!existsSync(path)) return defaultReleaseReviewerQueueStoreFile();

  try {
    return normalizeReleaseReviewerQueueStoreFile(
      JSON.parse(readFileSync(path, 'utf8')) as unknown,
      path,
    );
  } catch (error) {
    if (error instanceof ReleaseReviewerQueueStoreError) throw error;
    throw new ReleaseReviewerQueueStoreError(
      `Release reviewer queue store '${path}' could not be parsed.`,
    );
  }
}

function saveReleaseReviewerQueueStoreFile(
  path: string,
  file: ReleaseReviewerQueueStoreFile,
): void {
  writeTextFileAtomic(
    path,
    `${JSON.stringify(
      {
        version: 1,
        records: file.records,
      },
      null,
      2,
    )}\n`,
  );
}

function createReleaseReviewerQueueStoreFromAccessors(accessors: {
  readonly read: () => ReleaseReviewerQueueStoreFile;
  readonly mutate: <T>(action: (file: ReleaseReviewerQueueStoreFile) => T) => T;
}): ReleaseReviewerQueueStore {
  return {
    upsert(record: ReleaseReviewerQueueRecord): ReleaseReviewerQueueDetail {
      return accessors.mutate((file) => {
        const stored = freezeRecord(record);
        const existingIndex = file.records.findIndex((entry) => entry.detail.id === stored.detail.id);
        if (existingIndex >= 0) {
          file.records[existingIndex] = stored;
        } else {
          file.records.push(stored);
        }
        return stored.detail;
      });
    },
    commitPendingTransition(input: CommitPendingReviewerQueueTransitionInput): ReleaseReviewerQueueDetail {
      return accessors.mutate((file) => {
        const stored = freezeRecord(input.record);
        const existingIndex = file.records.findIndex((entry) => entry.detail.id === stored.detail.id);
        if (existingIndex < 0) {
          throw new ReleaseReviewerQueueError(
            'already_finalized',
            `Release review '${stored.detail.id}' is no longer pending or is missing.`,
          );
        }
        const existing = file.records[existingIndex];
        if (
          existing.detail.status !== 'pending-review' ||
          existing.detail.authorityState !== input.expectedAuthorityState ||
          existing.detail.reviewerDecisions.length !== input.expectedReviewerDecisionCount
        ) {
          throw new ReleaseReviewerQueueError(
            'already_finalized',
            `Release review '${stored.detail.id}' changed before this transition could be committed.`,
          );
        }
        file.records[existingIndex] = stored;
        return stored.detail;
      });
    },
    get(id: string): ReleaseReviewerQueueDetail | null {
      return accessors.read().records.find((record) => record.detail.id === id)?.detail ?? null;
    },
    getRecord(id: string): ReleaseReviewerQueueRecord | null {
      return accessors.read().records.find((record) => record.detail.id === id) ?? null;
    },
    listPending(options: ReleaseReviewerQueueListOptions = {}): ReleaseReviewerQueueListResult {
      const generatedAt = new Date().toISOString();
      const filtered = accessors
        .read()
        .records
        .map((record) => record.detail)
        .filter((item) => item.status === 'pending-review')
        .filter((item) => !options.riskClass || item.riskClass === options.riskClass)
        .filter((item) => !options.consequenceType || item.consequenceType === options.consequenceType)
        .sort((left, right) => {
          const rankDelta = riskRank(right.riskClass) - riskRank(left.riskClass);
          if (rankDelta !== 0) return rankDelta;
          return left.createdAt.localeCompare(right.createdAt);
        });

      const limited = options.limit ? filtered.slice(0, options.limit) : filtered;
      const counts = filtered.reduce<Record<RiskClass, number>>((acc, item) => {
        acc[item.riskClass] += 1;
        return acc;
      }, { R0: 0, R1: 0, R2: 0, R3: 0, R4: 0 });

      return {
        generatedAt,
        totalPending: filtered.length,
        countsByRiskClass: Object.freeze(counts),
        items: Object.freeze(limited),
      };
    },
  };
}

export function createInMemoryReleaseReviewerQueueStore(): ReleaseReviewerQueueStore {
  let file = defaultReleaseReviewerQueueStoreFile();

  return createReleaseReviewerQueueStoreFromAccessors({
    read: () => file,
    mutate: (action) => {
      const workingCopy: ReleaseReviewerQueueStoreFile = {
        version: 1,
        records: [...file.records],
      };
      const result = action(workingCopy);
      file = workingCopy;
      return result;
    },
  });
}

export function createFileBackedReleaseReviewerQueueStore(
  path = defaultReleaseReviewerQueueStorePath(),
): ReleaseReviewerQueueStore {
  loadReleaseReviewerQueueStoreFile(path);

  return createReleaseReviewerQueueStoreFromAccessors({
    read: () => withFileLock(path, () => loadReleaseReviewerQueueStoreFile(path)),
    mutate: (action) =>
      withFileLock(path, () => {
        const file = loadReleaseReviewerQueueStoreFile(path);
        const result = action(file);
        saveReleaseReviewerQueueStoreFile(path, file);
        return result;
      }),
  });
}

export function resetFileBackedReleaseReviewerQueueStoreForTests(path?: string): void {
  const resolvedPath = path ?? defaultReleaseReviewerQueueStorePath();
  if (existsSync(resolvedPath)) {
    rmSync(resolvedPath, { force: true });
  }
  if (existsSync(`${resolvedPath}.lock`)) {
    rmSync(`${resolvedPath}.lock`, { recursive: true, force: true });
  }
}
