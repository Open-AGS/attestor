import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const vendorDir = join(process.cwd(), 'vendor', 'schematron', '2026-CMS-QRDA-III');
const manifestPath = join(vendorDir, 'MANIFEST.sha256');

function listVendorFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      if (entry === 'MANIFEST.sha256') return [];
      const fullPath = join(dir, entry);
      const relativePath = prefix ? `${prefix}/${entry}` : entry;
      return statSync(fullPath).isDirectory() ? listVendorFiles(fullPath, relativePath) : [relativePath];
    })
    .sort();
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readManifest(): Map<string, string> {
  assert.equal(existsSync(manifestPath), true, 'Vendor schematron manifest must exist');
  const entries = new Map<string, string>();

  for (const line of readFileSync(manifestPath, 'utf8').split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([0-9a-f]{64})\s{2,}(.+)$/u.exec(trimmed);
    assert.ok(match, `Manifest line must be "<sha256>  <relative-path>": ${line}`);
    entries.set(match[2], match[1]);
  }

  return entries;
}

function testVendoredSchematronManifest(): void {
  const files = listVendorFiles(vendorDir);
  const manifest = readManifest();

  assert.deepEqual([...manifest.keys()].sort(), files, 'Manifest entries must match vendored schematron files');

  for (const file of files) {
    assert.equal(
      manifest.get(file),
      sha256(join(vendorDir, file)),
      `Manifest hash must match ${file}`,
    );
  }
}

testVendoredSchematronManifest();

console.log('Vendor schematron manifest tests: 1 passed, 0 failed');
