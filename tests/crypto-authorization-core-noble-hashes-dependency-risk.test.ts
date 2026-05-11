import assert from 'node:assert/strict';
import {
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex } from '@noble/hashes/utils.js';

type PackageJson = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly type?: string;
  readonly version?: string;
  readonly engines?: {
    readonly node?: string;
  };
  readonly exports?: Readonly<Record<string, string>>;
};

type PackageLock = {
  readonly packages: Readonly<Record<string, {
    readonly version?: string;
    readonly resolved?: string;
    readonly integrity?: string;
    readonly engines?: {
      readonly node?: string;
    };
  }>>;
};

let passed = 0;

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readFileSync(join(process.cwd(), ...segments), 'utf8')) as T;
}

function readText(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

function sourceFiles(root: string): readonly string[] {
  const absoluteRoot = join(process.cwd(), root);
  const files: string[] = [];

  function visit(directory: string): void {
    for (const entry of readdirSync(directory)) {
      const absolutePath = join(directory, entry);
      const stat = statSync(absolutePath);
      if (stat.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (entry.endsWith('.ts')) {
        files.push(absolutePath);
      }
    }
  }

  visit(absoluteRoot);
  return files;
}

function testPackageAndLockCarryReviewedV2(): void {
  const pkg = readJson<PackageJson>('package.json');
  const lock = readJson<PackageLock>('package-lock.json');
  const installed = readJson<PackageJson>('node_modules', '@noble', 'hashes', 'package.json');
  const locked = lock.packages['node_modules/@noble/hashes'];

  equal(
    pkg.dependencies?.['@noble/hashes'],
    '^2.2.0',
    '@noble/hashes dependency risk: package.json carries the reviewed v2 range',
  );
  equal(
    locked?.version,
    '2.2.0',
    '@noble/hashes dependency risk: package-lock pins the reviewed v2 artifact',
  );
  equal(
    locked?.resolved,
    'https://registry.npmjs.org/@noble/hashes/-/hashes-2.2.0.tgz',
    '@noble/hashes dependency risk: package-lock resolves the expected tarball',
  );
  ok(
    typeof locked?.integrity === 'string' && locked.integrity.startsWith('sha512-'),
    '@noble/hashes dependency risk: package-lock keeps npm integrity metadata',
  );
  equal(
    locked?.engines?.node,
    '>= 20.19.0',
    '@noble/hashes dependency risk: lockfile records the v2 Node runtime floor',
  );
  equal(
    installed.version,
    '2.2.0',
    '@noble/hashes dependency risk: local install matches the lockfile after npm install/ci',
  );
  equal(
    installed.type,
    'module',
    '@noble/hashes dependency risk: v2 remains ESM-only and must use ESM imports',
  );
  equal(
    installed.exports?.['./sha3.js'],
    './sha3.js',
    '@noble/hashes dependency risk: sha3.js is an exported public subpath',
  );
  equal(
    installed.exports?.['./utils.js'],
    './utils.js',
    '@noble/hashes dependency risk: utils.js is an exported public subpath',
  );
}

function testSourceUsesOnlyReviewedPublicSubpaths(): void {
  const allowedRuntimeImports = new Set([
    '@noble/hashes/sha3.js',
  ]);
  const importPattern = /from\s+['"](@noble\/hashes[^'"]*)['"]|import\(\s*['"](@noble\/hashes[^'"]*)['"]\s*\)/g;

  for (const filePath of sourceFiles('src')) {
    const text = readFileSync(filePath, 'utf8');
    for (const match of text.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2] ?? '';
      ok(
        allowedRuntimeImports.has(specifier),
        `@noble/hashes dependency risk: ${relative(process.cwd(), filePath)} uses reviewed public subpath ${specifier}`,
      );
    }
  }
}

function testKeccakVectorUsesBytesInput(): void {
  const abc = Buffer.from('abc', 'utf8');
  const digest = bytesToHex(keccak_256(abc));

  equal(
    digest,
    '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45',
    '@noble/hashes dependency risk: keccak_256 matches the canonical Keccak-256 abc vector',
  );
  throws(
    () => keccak_256('abc' as unknown as Uint8Array),
    /expected Uint8Array, got type=string/,
    '@noble/hashes dependency risk: v2 rejects string input, so callers must pass bytes',
  );
}

function testScriptIsExposed(): void {
  const pkg = readJson<PackageJson>('package.json');

  equal(
    pkg.scripts?.['test:crypto-authorization-core-noble-hashes-dependency-risk'],
    'tsx tests/crypto-authorization-core-noble-hashes-dependency-risk.test.ts',
    '@noble/hashes dependency risk: focused regression script is exposed',
  );
  ok(
    readText('docs', '02-architecture', 'crypto-engine-hardening-ii.md').includes(
      '| 08 | complete | Dependency risk cleanup |',
    ),
    '@noble/hashes dependency risk: tracker records Step 08 as complete',
  );
}

testPackageAndLockCarryReviewedV2();
testSourceUsesOnlyReviewedPublicSubpaths();
testKeccakVectorUsesBytesInput();
testScriptIsExposed();

console.log(`crypto-authorization-core-noble-hashes-dependency-risk: ${passed} assertions passed`);
