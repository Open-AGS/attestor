import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import {
  cleanupAtomicWriteTempFiles,
  writeTextFileAtomic,
} from '../src/platform/file-store.js';
import {
  generateKeyPair,
  saveKeyPair,
} from '../src/signing/keys.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

const root = join(process.cwd(), '.attestor-test-runs', `f5-file-store-key-atomicity-${randomUUID()}`);
mkdirSync(root, { recursive: true });

try {
  const targetPath = join(root, 'critical-store.json');
  const orphanPath = `${targetPath}.123.${'a'.repeat(32)}.tmp`;
  const orphanDirectoryPath = join(root, '.critical-store.json.attestor-atomic-orphan');
  const unrelatedPath = `${targetPath}.manual.tmp`;
  writeFileSync(orphanPath, 'orphan');
  mkdirSync(orphanDirectoryPath);
  writeFileSync(join(orphanDirectoryPath, 'payload.tmp'), 'orphan');
  writeFileSync(unrelatedPath, 'unrelated');

  const result = writeTextFileAtomic(targetPath, '{"ok":true}\n');
  equal(readFileSync(targetPath, 'utf8'), '{"ok":true}\n', 'F-5.2: atomic text helper writes final content');
  equal(result.orphanTempFilesRemoved, 2, 'F-5.2: target-scoped orphan temp entries are swept before write');
  equal(existsSync(orphanPath), false, 'F-5.2: orphan temp file no longer exists');
  equal(existsSync(orphanDirectoryPath), false, 'F-5.2: orphan temp directory no longer exists');
  equal(existsSync(unrelatedPath), true, 'F-5.2: unrelated temp-like files are not removed');
  equal(result.directoryFsynced, false, 'F-5.2: parent directory fsync is not claimed by the portable helper');
  ok(result.tempPath.endsWith('.tmp'), 'F-5.2: write result exposes the random temp path used');
  equal(existsSync(dirname(result.tempPath)), false, 'F-5.2: secure temp directory is removed after rename');

  const privateKeyPath = join(root, 'keys', 'private.pem');
  const publicKeyPath = join(root, 'keys', 'public.pem');
  const keyPair = generateKeyPair();
  saveKeyPair(keyPair, privateKeyPath, publicKeyPath);

  equal(readFileSync(privateKeyPath, 'utf8'), keyPair.privateKeyPem, 'F5-A5: private key persists through atomic helper');
  equal(readFileSync(publicKeyPath, 'utf8'), keyPair.publicKeyPem, 'F5-A5: public key persists through atomic helper');
  const privateKeyMode = statSync(privateKeyPath).mode & 0o777;
  ok(
    process.platform === 'win32' || privateKeyMode === 0o600,
    'F5-A5: private key requests 0600 mode where POSIX file modes are enforceable',
  );

  const secondOrphanPath = `${privateKeyPath}.456.${'b'.repeat(32)}.tmp`;
  writeFileSync(secondOrphanPath, 'old-private-key');
  equal(cleanupAtomicWriteTempFiles(privateKeyPath), 1, 'F-5.2: exported orphan sweep removes matching target temp files');
  equal(existsSync(secondOrphanPath), false, 'F-5.2: exported orphan sweep removed the matching private-key temp');

  const keysSource = readFileSync(join(process.cwd(), 'src', 'signing', 'keys.ts'), 'utf8');
  includes(keysSource, 'writeTextFileAtomic(privateKeyPath', 'F5-A5: saveKeyPair writes private key through atomic helper');
  includes(keysSource, 'writeTextFileAtomic(publicKeyPath', 'F5-A5: saveKeyPair writes public key through atomic helper');

  const tracker = readFileSync(join(process.cwd(), 'docs', 'audit', 'attestor-audit-remediation-tracker.md'), 'utf8');
  includes(tracker, 'F-5.2 parent-directory fsync / orphan sweep | `partial`', 'Tracker: F-5.2 is marked partial');
  includes(tracker, 'F5-A5 non-atomic `saveKeyPair` | `fixed`', 'Tracker: F5-A5 is marked fixed');
  includes(tracker, 'F5 File Durability And Key Atomicity Validation', 'Tracker: file durability validation evidence is linked');

  const validationDoc = readFileSync(join(process.cwd(), 'docs', 'audit', 'f5-file-durability-key-atomicity-validation.md'), 'utf8');
  includes(validationDoc, 'Status: partial', 'F5 file durability validation doc: partial status is explicit');

  const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
  includes(packageJson, '"test:f5-file-store-key-atomicity-validation"', 'Package: F5 file/key atomicity validation script is exposed');

  console.log(`f5-file-store-key-atomicity-validation.test.ts: ${passed} assertions passed`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
