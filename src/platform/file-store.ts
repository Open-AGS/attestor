import { randomBytes } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { hostname } from 'node:os';
import { basename, dirname, join } from 'node:path';

const SLEEP_BUFFER = new SharedArrayBuffer(4);
const SLEEP_VIEW = new Int32Array(SLEEP_BUFFER);

function sleepSync(milliseconds: number): void {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
  Atomics.wait(SLEEP_VIEW, 0, 0, milliseconds);
}

interface FileLockOwner {
  pid: number;
  hostname: string;
  acquiredAtMs: number;
  acquiredAt: string;
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function defaultLockTimeoutMs(): number {
  return positiveIntegerEnv('ATTESTOR_FILE_LOCK_TIMEOUT_MS', 5_000);
}

function defaultLockRetryDelayMs(): number {
  return positiveIntegerEnv('ATTESTOR_FILE_LOCK_RETRY_DELAY_MS', 25);
}

function defaultLockStaleMs(): number {
  return positiveIntegerEnv('ATTESTOR_FILE_LOCK_STALE_MS', 60_000);
}

function readLockOwner(lockPath: string): FileLockOwner | null {
  try {
    const parsed = JSON.parse(readFileSync(`${lockPath}/owner.json`, 'utf8')) as Partial<FileLockOwner>;
    if (
      typeof parsed.pid === 'number' &&
      typeof parsed.hostname === 'string' &&
      typeof parsed.acquiredAtMs === 'number' &&
      typeof parsed.acquiredAt === 'string'
    ) {
      return {
        pid: parsed.pid,
        hostname: parsed.hostname,
        acquiredAtMs: parsed.acquiredAtMs,
        acquiredAt: parsed.acquiredAt,
      };
    }
  } catch {
    // fall back to directory mtime below
  }
  return null;
}

function processAppearsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === 'EPERM';
  }
}

function lockAgeMs(lockPath: string, nowMs: number): {
  ageMs: number;
  owner: FileLockOwner | null;
} | null {
  const owner = readLockOwner(lockPath);
  if (owner) {
    return { ageMs: nowMs - owner.acquiredAtMs, owner };
  }
  try {
    return { ageMs: nowMs - statSync(lockPath).mtimeMs, owner: null };
  } catch {
    return null;
  }
}

function tryRecoverStaleLock(lockPath: string, staleMs: number): boolean {
  const age = lockAgeMs(lockPath, Date.now());
  if (!age || age.ageMs < staleMs) return false;
  if (age.owner?.hostname === hostname() && processAppearsAlive(age.owner.pid)) return false;
  rmSync(lockPath, { recursive: true, force: true });
  return true;
}

function writeLockOwner(lockPath: string): void {
  const acquiredAtMs = Date.now();
  const owner: FileLockOwner = {
    pid: process.pid,
    hostname: hostname(),
    acquiredAtMs,
    acquiredAt: new Date(acquiredAtMs).toISOString(),
  };
  writeFileSync(`${lockPath}/owner.json`, `${JSON.stringify(owner, null, 2)}\n`, { mode: 0o600 });
}

export interface AtomicTextFileWriteResult {
  readonly tempPath: string;
  readonly directoryFsynced: boolean;
  readonly orphanTempFilesRemoved: number;
}

export interface AtomicTextFileWriteOptions {
  readonly mode?: number;
  readonly cleanupOrphans?: boolean;
}

function isDecimalDigits(value: string): boolean {
  if (value.length === 0) return false;
  for (const character of value) {
    if (character < '0' || character > '9') return false;
  }
  return true;
}

function isLowercaseHex(value: string): boolean {
  if (value.length !== 32) return false;
  for (const character of value) {
    const isDigit = character >= '0' && character <= '9';
    const isLowerHex = character >= 'a' && character <= 'f';
    if (!isDigit && !isLowerHex) return false;
  }
  return true;
}

function isLegacyAtomicTempFile(entry: string, targetBaseName: string): boolean {
  const prefix = `${targetBaseName}.`;
  const suffix = '.tmp';
  if (!entry.startsWith(prefix) || !entry.endsWith(suffix)) return false;

  const body = entry.slice(prefix.length, entry.length - suffix.length);
  const separatorIndex = body.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === body.length - 1) return false;
  const pid = body.slice(0, separatorIndex);
  const nonce = body.slice(separatorIndex + 1);
  return isDecimalDigits(pid) && isLowercaseHex(nonce);
}

function isAtomicTempDirectory(entry: string, targetBaseName: string): boolean {
  return entry.startsWith(`.${targetBaseName}.attestor-atomic-`);
}

export function cleanupAtomicWriteTempFiles(path: string): number {
  const directoryPath = dirname(path);
  const targetBaseName = basename(path);
  let removed = 0;

  try {
    for (const entry of readdirSync(directoryPath)) {
      if (!isLegacyAtomicTempFile(entry, targetBaseName) && !isAtomicTempDirectory(entry, targetBaseName)) {
        continue;
      }
      rmSync(join(directoryPath, entry), { recursive: true, force: true });
      removed += 1;
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'ENOENT') throw error;
  }

  return removed;
}

export function withFileLock<T>(
  targetPath: string,
  action: () => T,
  options?: {
    timeoutMs?: number;
    retryDelayMs?: number;
    staleMs?: number;
  },
): T {
  const lockPath = `${targetPath}.lock`;
  const timeoutMs = options?.timeoutMs ?? defaultLockTimeoutMs();
  const retryDelayMs = options?.retryDelayMs ?? defaultLockRetryDelayMs();
  const staleMs = options?.staleMs ?? defaultLockStaleMs();
  const startedAt = Date.now();

  while (true) {
    try {
      mkdirSync(lockPath);
      try {
        writeLockOwner(lockPath);
      } catch (error) {
        rmSync(lockPath, { recursive: true, force: true });
        throw error;
      }
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== 'EEXIST') throw error;
      if (tryRecoverStaleLock(lockPath, staleMs)) continue;
      if ((Date.now() - startedAt) >= timeoutMs) {
        throw new Error(`Timed out waiting for file lock: ${lockPath}`);
      }
      sleepSync(retryDelayMs);
    }
  }

  try {
    return action();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

export function writeTextFileAtomic(
  path: string,
  content: string,
  options: AtomicTextFileWriteOptions = {},
): AtomicTextFileWriteResult {
  const directoryPath = dirname(path);
  mkdirSync(directoryPath, { recursive: true });
  const orphanTempFilesRemoved =
    options.cleanupOrphans === false ? 0 : cleanupAtomicWriteTempFiles(path);
  const tempDirectoryPath = mkdtempSync(join(directoryPath, `.${basename(path)}.attestor-atomic-`));
  const tempPath = join(tempDirectoryPath, `${randomBytes(16).toString('hex')}.tmp`);
  try {
    const fd = openSync(tempPath, 'wx', options.mode ?? 0o600);
    try {
      writeSync(fd, content);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tempPath, path);
    return { tempPath, directoryFsynced: false, orphanTempFilesRemoved };
  } finally {
    rmSync(tempDirectoryPath, { recursive: true, force: true });
  }
}
