import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { withFileLock, writeTextFileAtomic } from '../platform/file-store.js';
import type { ReleaseActorReference } from '../release-layer/index.js';
import type { EnforcementFailureReason, EnforcementOutcome } from './types.js';
import {
  degradedModeGrantStatus,
  degradedModeScopeMatches,
} from './degraded-mode-grant.js';
import {
  RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION,
  type ConsumeDegradedModeGrantInput,
  type DegradedModeAuditAction,
  type DegradedModeAuditRecord,
  type DegradedModeGrant,
  type DegradedModeGrantStore,
  type ListDegradedModeGrantOptions,
  type RevokeDegradedModeGrantInput,
} from './degraded-mode-types.js';
import {
  createGrantDigest,
  normalizeActor,
  normalizeFailureReasons,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeScope,
  sha256Digest,
} from './degraded-mode-utils.js';

interface DegradedModeGrantStoreFile {
  readonly version: 1;
  grants: DegradedModeGrant[];
  auditRecords: DegradedModeAuditRecord[];
}

function createAuditRecord(input: {
  readonly id?: string;
  readonly action: DegradedModeAuditAction;
  readonly grant: DegradedModeGrant;
  readonly recordedAt: string;
  readonly actor?: ReleaseActorReference | null;
  readonly failureReasons?: readonly EnforcementFailureReason[];
  readonly outcome?: EnforcementOutcome | null;
  readonly remainingUses: number;
  readonly previousDigest: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): DegradedModeAuditRecord {
  const recordWithoutDigest: Omit<DegradedModeAuditRecord, 'digest'> = {
    version: RELEASE_DEGRADED_MODE_CONTROL_SPEC_VERSION,
    id: input.id ?? `dma_${randomUUID().replaceAll('-', '')}`,
    action: input.action,
    grantId: input.grant.id,
    recordedAt: normalizeIsoTimestamp(input.recordedAt, 'recordedAt'),
    actor: input.actor ? normalizeActor(input.actor, 'audit.actor') : null,
    state: input.grant.state,
    scope: input.grant.scope,
    reason: input.grant.reason,
    ticketId: input.grant.ticketId,
    expiresAt: input.grant.expiresAt,
    failureReasons: normalizeFailureReasons(input.failureReasons ?? [], 'audit.failureReasons', true),
    outcome: input.outcome ?? null,
    remainingUses: input.remainingUses,
    previousDigest: input.previousDigest,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  };

  return Object.freeze({
    ...recordWithoutDigest,
    digest: sha256Digest(recordWithoutDigest),
  });
}

function replaceGrantUseBudget(grant: DegradedModeGrant, remainingUses: number): DegradedModeGrant {
  const withoutDigest: Omit<DegradedModeGrant, 'auditDigest'> = Object.freeze({
    ...grant,
    remainingUses,
  });
  return Object.freeze({
    ...withoutDigest,
    auditDigest: createGrantDigest(withoutDigest),
  });
}

function replaceGrantRevocation(
  grant: DegradedModeGrant,
  input: RevokeDegradedModeGrantInput,
): DegradedModeGrant {
  const withoutDigest: Omit<DegradedModeGrant, 'auditDigest'> = Object.freeze({
    ...grant,
    revokedAt: normalizeIsoTimestamp(input.revokedAt, 'revokedAt'),
    revokedBy: normalizeActor(input.revokedBy, 'revokedBy'),
    revocationReason: normalizeIdentifier(input.revocationReason, 'revocationReason'),
  });
  return Object.freeze({
    ...withoutDigest,
    auditDigest: createGrantDigest(withoutDigest),
  });
}

function cloneGrant(grant: DegradedModeGrant): DegradedModeGrant {
  return Object.freeze(structuredClone(grant)) as DegradedModeGrant;
}

function cloneAuditRecord(record: DegradedModeAuditRecord): DegradedModeAuditRecord {
  return Object.freeze(structuredClone(record)) as DegradedModeAuditRecord;
}

function defaultDegradedModeGrantStoreFile(): DegradedModeGrantStoreFile {
  return {
    version: 1,
    grants: [],
    auditRecords: [],
  };
}

function loadDegradedModeGrantStoreFile(path: string): DegradedModeGrantStoreFile {
  if (!existsSync(path)) {
    return defaultDegradedModeGrantStoreFile();
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as DegradedModeGrantStoreFile;
    if (
      parsed.version === 1 &&
      Array.isArray(parsed.grants) &&
      Array.isArray(parsed.auditRecords)
    ) {
      return parsed;
    }
  } catch {
    // fall through to safe default
  }
  return defaultDegradedModeGrantStoreFile();
}

function saveDegradedModeGrantStoreFile(path: string, file: DegradedModeGrantStoreFile): void {
  writeTextFileAtomic(path, `${JSON.stringify(file, null, 2)}\n`);
}

function defaultDegradedModeGrantStorePath(): string {
  return resolve(
    process.env.ATTESTOR_RELEASE_ENFORCEMENT_DEGRADED_MODE_STORE_PATH ??
      '.attestor/release-enforcement-degraded-mode-store.json',
  );
}

function ensureDegradedModeGrantStoreDirectory(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function createDegradedModeGrantStoreFromAccessors(accessors: {
  readonly read: () => DegradedModeGrantStoreFile;
  readonly mutate: <T>(action: (file: DegradedModeGrantStoreFile) => T) => T;
}): DegradedModeGrantStore {
  function appendAudit(
    file: DegradedModeGrantStoreFile,
    input: Omit<Parameters<typeof createAuditRecord>[0], 'previousDigest'>,
  ): void {
    file.auditRecords.push(
      createAuditRecord({
        ...input,
        previousDigest: file.auditRecords.at(-1)?.digest ?? null,
      }),
    );
  }

  return Object.freeze({
    registerGrant(grant: DegradedModeGrant): DegradedModeGrant {
      const normalizedGrant = cloneGrant(grant);
      return accessors.mutate((file) => {
        if (file.grants.some((entry) => entry.id === normalizedGrant.id)) {
          throw new Error(`Release enforcement-plane degraded mode grant already exists: ${grant.id}`);
        }
        file.grants.push(normalizedGrant);
        appendAudit(file, {
          action: 'grant-created',
          grant: normalizedGrant,
          recordedAt: normalizedGrant.authorizedAt,
          actor: normalizedGrant.authorizedBy,
          failureReasons: normalizedGrant.allowedFailureReasons,
          outcome: null,
          remainingUses: normalizedGrant.remainingUses,
          metadata: { auditDigest: normalizedGrant.auditDigest },
        });
        return cloneGrant(normalizedGrant);
      });
    },
    findGrant(id: string): DegradedModeGrant | null {
      const grant = accessors.read().grants.find((entry) => entry.id === normalizeIdentifier(id, 'id'));
      return grant ? cloneGrant(grant) : null;
    },
    listGrants(options?: ListDegradedModeGrantOptions): readonly DegradedModeGrant[] {
      const checkedAt = options?.checkedAt ?? new Date().toISOString();
      const status = options?.status ?? 'all';
      const scope = options?.scope ? normalizeScope(options.scope) : null;
      return Object.freeze(
        accessors.read().grants.filter((grant) => {
          if (status !== 'all' && degradedModeGrantStatus(grant, checkedAt) !== status) {
            return false;
          }
          return scope ? degradedModeScopeMatches(grant.scope, scope) : true;
        }).map((grant) => cloneGrant(grant)),
      );
    },
    revokeGrant(input: RevokeDegradedModeGrantInput): DegradedModeGrant | null {
      return accessors.mutate((file) => {
        const id = normalizeIdentifier(input.id, 'id');
        const index = file.grants.findIndex((entry) => entry.id === id);
        if (index < 0) {
          return null;
        }
        const revoked = replaceGrantRevocation(file.grants[index], input);
        file.grants[index] = revoked;
        appendAudit(file, {
          action: 'grant-revoked',
          grant: revoked,
          recordedAt: revoked.revokedAt ?? input.revokedAt,
          actor: revoked.revokedBy,
          failureReasons: [],
          outcome: null,
          remainingUses: revoked.remainingUses,
          metadata: { revocationReason: revoked.revocationReason },
        });
        return cloneGrant(revoked);
      });
    },
    consumeGrant(input: ConsumeDegradedModeGrantInput): DegradedModeGrant | null {
      return accessors.mutate((file) => {
        const id = normalizeIdentifier(input.id, 'id');
        const index = file.grants.findIndex((entry) => entry.id === id);
        if (index < 0 || degradedModeGrantStatus(file.grants[index], input.checkedAt) !== 'active') {
          return null;
        }
        const consumed = replaceGrantUseBudget(file.grants[index], file.grants[index].remainingUses - 1);
        file.grants[index] = consumed;
        appendAudit(file, {
          action: 'grant-used',
          grant: consumed,
          recordedAt: input.checkedAt,
          actor: input.actor ?? null,
          failureReasons: input.failureReasons ?? [],
          outcome: input.outcome ?? null,
          remainingUses: consumed.remainingUses,
          metadata: input.metadata,
        });
        return cloneGrant(consumed);
      });
    },
    listAuditRecords(): readonly DegradedModeAuditRecord[] {
      return Object.freeze(accessors.read().auditRecords.map((record) => cloneAuditRecord(record)));
    },
    auditHead(): string | null {
      return accessors.read().auditRecords.at(-1)?.digest ?? null;
    },
  });
}

export function createInMemoryDegradedModeGrantStore(): DegradedModeGrantStore {
  let file = defaultDegradedModeGrantStoreFile();
  return createDegradedModeGrantStoreFromAccessors({
    read: () => file,
    mutate: (action) => {
      const workingCopy = structuredClone(file) as DegradedModeGrantStoreFile;
      const result = action(workingCopy);
      file = workingCopy;
      return result;
    },
  });
}

export function createFileBackedDegradedModeGrantStore(
  path = defaultDegradedModeGrantStorePath(),
): DegradedModeGrantStore {
  return createDegradedModeGrantStoreFromAccessors({
    read: () => {
      ensureDegradedModeGrantStoreDirectory(path);
      return withFileLock(path, () => loadDegradedModeGrantStoreFile(path));
    },
    mutate: (action) => {
      ensureDegradedModeGrantStoreDirectory(path);
      return withFileLock(path, () => {
        const file = loadDegradedModeGrantStoreFile(path);
        const result = action(file);
        saveDegradedModeGrantStoreFile(path, file);
        return result;
      });
    },
  });
}

export function resetFileBackedDegradedModeGrantStoreForTests(path?: string): void {
  const resolvedPath = path ?? defaultDegradedModeGrantStorePath();
  if (existsSync(resolvedPath)) {
    rmSync(resolvedPath, { force: true });
  }
  if (existsSync(`${resolvedPath}.lock`)) {
    rmSync(`${resolvedPath}.lock`, { recursive: true, force: true });
  }
}
