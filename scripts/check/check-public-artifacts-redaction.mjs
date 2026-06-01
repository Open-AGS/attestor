#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { redactSensitiveOutput } from '../lib/secret-safe-output.ts';

const PUBLIC_ARTIFACT_ROOTS = Object.freeze([
  'README.md',
  'SECURITY.md',
  '.well-known/security.txt',
  'docs/00-evaluation',
  'docs/evidence',
  '.attestor/proof-surface/latest',
  '.attestor/showcase/latest',
  '.attestor/release-provenance',
]);

const TEXT_EXTENSIONS = new Set([
  '',
  '.html',
  '.json',
  '.md',
  '.pem',
  '.txt',
  '.yaml',
  '.yml',
]);

function parseArtifactRoots(args) {
  if (args.length === 0) return PUBLIC_ARTIFACT_ROOTS;

  const roots = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--root') {
      const root = args[index + 1];
      if (!root) {
        throw new Error('check-public-artifacts-redaction requires a value after --root.');
      }
      roots.push(root);
      index += 1;
      continue;
    }
    if (arg?.startsWith('--root=')) {
      const root = arg.slice('--root='.length);
      if (!root) {
        throw new Error('check-public-artifacts-redaction requires a non-empty --root value.');
      }
      roots.push(root);
      continue;
    }
    throw new Error(`check-public-artifacts-redaction does not recognize argument: ${arg}`);
  }

  return Object.freeze(roots);
}

function listFiles(path) {
  if (!existsSync(path)) return [];
  const stats = statSync(path);
  if (stats.isFile()) return [path];
  if (!stats.isDirectory()) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return listFiles(child);
    if (entry.isFile()) return [child];
    return [];
  });
}

const artifactRoots = parseArtifactRoots(process.argv.slice(2));

const scannedFiles = artifactRoots.flatMap(listFiles)
  .filter((file) => TEXT_EXTENSIONS.has(extname(file).toLowerCase()));

const leakingFiles = [];

for (const file of scannedFiles) {
  const material = readFileSync(file, 'utf8');
  if (redactSensitiveOutput(material) !== material) {
    leakingFiles.push(relative(process.cwd(), file).replaceAll('\\', '/'));
  }
}

if (leakingFiles.length > 0) {
  console.error('Public artifact redaction scan failed. Sensitive-output patterns matched these files:');
  for (const file of leakingFiles) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`Public artifact redaction scan: ${scannedFiles.length} files passed, 0 failed`);
