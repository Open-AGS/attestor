import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { withFileLock, writeTextFileAtomic } from '../platform/file-store.js';
import {
  ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH_ENV,
  ReleaseEvidencePackStoreError,
  type IssuedReleaseEvidencePack,
  type ReleaseEvidencePackStore,
} from './release-evidence-pack-types.js';
import { freezeIssuedReleaseEvidencePack } from './release-evidence-pack-freeze.js';
import { verifyIssuedReleaseEvidencePack } from './release-evidence-pack-verification.js';

const DEFAULT_RELEASE_EVIDENCE_PACK_STORE_PATH =
  '.attestor/release-evidence-pack-store.json';

interface ReleaseEvidencePackStoreFile {
  readonly version: 1;
  packs: IssuedReleaseEvidencePack[];
}

function defaultReleaseEvidencePackStoreFile(): ReleaseEvidencePackStoreFile {
  return {
    version: 1,
    packs: [],
  };
}

function defaultReleaseEvidencePackStorePath(): string {
  return resolve(
    process.env[ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH_ENV] ??
      DEFAULT_RELEASE_EVIDENCE_PACK_STORE_PATH,
  );
}

function ensureReleaseEvidencePackStoreDirectory(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function verifyReleaseEvidencePackStoreFileIntegrity(
  file: ReleaseEvidencePackStoreFile,
  path: string,
): void {
  for (const pack of file.packs) {
    try {
      verifyIssuedReleaseEvidencePack({
        issuedEvidencePack: pack,
        verificationKey: pack.verificationKey,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ReleaseEvidencePackStoreError(
        `Release evidence pack store '${path}' failed integrity verification for pack '${pack.evidencePack?.id ?? 'unknown'}': ${message}`,
      );
    }
  }
}

function normalizeReleaseEvidencePackStoreFile(
  value: unknown,
  path: string,
): ReleaseEvidencePackStoreFile {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (value as { version?: unknown }).version !== 1 ||
    !Array.isArray((value as { packs?: unknown }).packs)
  ) {
    throw new ReleaseEvidencePackStoreError(
      `Release evidence pack store '${path}' has an invalid file shape.`,
    );
  }

  const file: ReleaseEvidencePackStoreFile = {
    version: 1,
    packs: (value as { packs: IssuedReleaseEvidencePack[] }).packs.map((pack) =>
      freezeIssuedReleaseEvidencePack(pack),
    ),
  };
  verifyReleaseEvidencePackStoreFileIntegrity(file, path);
  return file;
}

function loadReleaseEvidencePackStoreFile(path: string): ReleaseEvidencePackStoreFile {
  ensureReleaseEvidencePackStoreDirectory(path);
  if (!existsSync(path)) return defaultReleaseEvidencePackStoreFile();

  try {
    return normalizeReleaseEvidencePackStoreFile(
      JSON.parse(readFileSync(path, 'utf8')) as unknown,
      path,
    );
  } catch (error) {
    if (error instanceof ReleaseEvidencePackStoreError) throw error;
    throw new ReleaseEvidencePackStoreError(
      `Release evidence pack store '${path}' could not be parsed.`,
    );
  }
}

function saveReleaseEvidencePackStoreFile(
  path: string,
  file: ReleaseEvidencePackStoreFile,
): void {
  writeTextFileAtomic(
    path,
    `${JSON.stringify(
      {
        version: 1,
        packs: file.packs,
      },
      null,
      2,
    )}\n`,
  );
}

function upsertIssuedReleaseEvidencePack(
  file: ReleaseEvidencePackStoreFile,
  pack: IssuedReleaseEvidencePack,
): IssuedReleaseEvidencePack {
  verifyIssuedReleaseEvidencePack({
    issuedEvidencePack: pack,
    verificationKey: pack.verificationKey,
  });
  const stored = freezeIssuedReleaseEvidencePack(pack);
  const existingIndex = file.packs.findIndex(
    (entry) => entry.evidencePack.id === stored.evidencePack.id,
  );
  if (existingIndex >= 0) {
    const existing = file.packs[existingIndex];
    if (existing.bundleDigest !== stored.bundleDigest) {
      throw new ReleaseEvidencePackStoreError(
        `Release evidence pack '${stored.evidencePack.id}' already exists with a different bundle digest.`,
      );
    }
    return existing;
  }
  file.packs.push(stored);
  return stored;
}

function createReleaseEvidencePackStoreFromAccessors(accessors: {
  readonly read: () => ReleaseEvidencePackStoreFile;
  readonly mutate: <T>(action: (file: ReleaseEvidencePackStoreFile) => T) => T;
}): ReleaseEvidencePackStore {
  return {
    upsert(pack: IssuedReleaseEvidencePack): IssuedReleaseEvidencePack {
      return accessors.mutate((file) => upsertIssuedReleaseEvidencePack(file, pack));
    },
    get(id: string): IssuedReleaseEvidencePack | null {
      return accessors.read().packs.find((pack) => pack.evidencePack.id === id) ?? null;
    },
  };
}

export function createInMemoryReleaseEvidencePackStore(): ReleaseEvidencePackStore {
  let file = defaultReleaseEvidencePackStoreFile();

  return createReleaseEvidencePackStoreFromAccessors({
    read: () => file,
    mutate: (action) => {
      const workingCopy: ReleaseEvidencePackStoreFile = {
        version: 1,
        packs: [...file.packs],
      };
      const result = action(workingCopy);
      file = workingCopy;
      return result;
    },
  });
}

export function createFileBackedReleaseEvidencePackStore(
  path = defaultReleaseEvidencePackStorePath(),
): ReleaseEvidencePackStore {
  loadReleaseEvidencePackStoreFile(path);

  return createReleaseEvidencePackStoreFromAccessors({
    read: () => withFileLock(path, () => loadReleaseEvidencePackStoreFile(path)),
    mutate: (action) =>
      withFileLock(path, () => {
        const file = loadReleaseEvidencePackStoreFile(path);
        const result = action(file);
        saveReleaseEvidencePackStoreFile(path, file);
        return result;
      }),
  });
}

export function resetFileBackedReleaseEvidencePackStoreForTests(path?: string): void {
  const resolvedPath = path ?? defaultReleaseEvidencePackStorePath();
  if (existsSync(resolvedPath)) {
    rmSync(resolvedPath, { force: true });
  }
  if (existsSync(`${resolvedPath}.lock`)) {
    rmSync(`${resolvedPath}.lock`, { recursive: true, force: true });
  }
}
