import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function testDocMirrorsCurrentSurfaceCounts(): void {
  const doc = readProjectFile('docs', '02-architecture', 'consequence-admission-public-surface.md');
  const indexSource = readProjectFile('src', 'consequence-admission', 'index.ts');
  const contractsSource = readProjectFile('src', 'consequence-admission', 'contracts.ts');
  const publicSurfaceSource = readProjectFile('src', 'consequence-admission', 'public-surface.ts');

  const indexExportLines = [...indexSource.matchAll(/^export\s/gm)].length;
  const indexDirectExportDeclarations = [
    ...indexSource.matchAll(/^export\s+(?:type|interface|class|const|function|enum)\s/gm),
  ].length;
  const contractModuleLines = contractsSource.split(/\r?\n/u).filter((line) => line.length > 0).length;
  const publicSurfaceReExports = [
    ...publicSurfaceSource.matchAll(/^export \* from ['"]\.\/[^'"]+['"];$/gm),
  ].length;

  includes(doc, '# Consequence Admission Public Surface', 'Public surface docs: title is present');
  includes(doc, `index export lines: ${indexExportLines}`, 'Public surface docs: index export count matches source');
  includes(
    doc,
    `index direct export declarations: ${indexDirectExportDeclarations}`,
    'Public surface docs: direct export declaration count matches source',
  );
  includes(
    doc,
    `contract module non-empty lines: ${contractModuleLines}`,
    'Public surface docs: contract module line count matches source',
  );
  includes(
    doc,
    `public-surface module re-exports: ${publicSurfaceReExports}`,
    'Public surface docs: public-surface re-export count matches source',
  );
  includes(
    doc,
    "trailing delegation: export * from './public-surface.js'",
    'Public surface docs: index delegation is explicit',
  );
}

function testDocKeepsBoundaryLabelsAndNoClaims(): void {
  const doc = readProjectFile('docs', '02-architecture', 'consequence-admission-public-surface.md');

  for (const expected of [
    '`stable-public`',
    '`specialized-public`',
    '`evaluation-public`',
    '`compatibility-public`',
    'It is a reference document, not a new API',
    'It does not prove live customer PEP no-bypass.',
    'It does not make package-boundary exports equivalent to hosted HTTP routes.',
    'Those are design candidates only. They are not current public import paths.',
  ]) {
    includes(doc, expected, `Public surface docs: keeps ${expected}`);
  }
}

function testDocLocksV2SplitInventory(): void {
  const doc = readProjectFile('docs', '02-architecture', 'consequence-admission-public-surface.md');

  includes(doc, '## V2-09 Inventory Lock', 'Public surface docs: V2-09 inventory lock is present');

  for (const expected of [
    'Contract constants and literal vocabularies',
    'Core admission request/response types',
    'Generic admission request/envelope types',
    'Normalization helpers',
    'Generic guard orchestration',
    'Decision and mapping helpers',
    'Correction catalogue and retry budget',
    'Builders and descriptor',
    'Compatibility delegation',
  ]) {
    includes(doc, expected, `Public surface docs: V2-09 locks ${expected}`);
  }

  for (const expected of [
    'V2-10 complete',
    'V2-11 descriptor/catalog split',
    'V2-12 engine helpers split',
    "plus trailing `export * from './public-surface.js'`",
    '`contracts.ts` remains internal to the package source tree',
    '`public-surface.ts` remains a pure sibling re-export catalogue',
    'no split PR may change `admit`, `narrow`, `review`, or `block` semantics',
  ]) {
    includes(doc, expected, `Public surface docs: V2-09 keeps split rule ${expected}`);
  }
}

function testDocLinksAndNavigationSurfaces(): void {
  const docPath = join(process.cwd(), 'docs', '02-architecture', 'consequence-admission-public-surface.md');
  const doc = readFileSync(docPath, 'utf8');
  const docDir = dirname(docPath);
  const missing: string[] = [];

  for (const match of doc.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (/^https?:\/\//iu.test(href) || href.startsWith('#')) continue;
    const pathOnly = href.split('#')[0];
    const resolved = normalize(join(docDir, pathOnly));
    if (!existsSync(resolved)) missing.push(href);
  }

  assert.deepEqual(missing, [], 'Public surface docs: all relative links resolve');
  passed += 1;

  includes(doc, 'https://nodejs.org/api/packages.html#exports', 'Public surface docs: links Node package exports source');
  includes(doc, 'https://docs.npmjs.com/cli/v11/using-npm/scripts/#working-directory-for-scripts', 'Public surface docs: links npm script root source');
  includes(doc, 'https://diataxis.fr/reference/', 'Public surface docs: links Diataxis reference source');

  const readme = readProjectFile('README.md');
  const navigator = readProjectFile('docs', '01-overview', 'repository-navigator.md');

  includes(
    readme,
    '[Consequence admission public surface](docs/02-architecture/consequence-admission-public-surface.md)',
    'Public surface docs: README maintainer reference links the doc',
  );
  includes(
    navigator,
    '[Consequence admission public surface](../02-architecture/consequence-admission-public-surface.md)',
    'Public surface docs: repository navigator links the doc',
  );
}

function testPackageExportsStillMatchDocumentedImportPaths(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly exports: Readonly<Record<string, { readonly types: string; readonly default: string }>>;
  };

  equal(
    packageJson.exports['.'].default,
    './dist/consequence-admission/index.js',
    'Public surface docs: main package export remains consequence-admission index',
  );
  equal(
    packageJson.exports['./consequence-admission'].default,
    './dist/consequence-admission/index.js',
    'Public surface docs: compatibility subpath points to the same index',
  );
  assert.deepEqual(
    Object.keys(packageJson.exports).filter((subpath) =>
      subpath.startsWith('./consequence-admission/')),
    [],
    'Public surface docs: no deep consequence-admission subpath is exported',
  );
  passed += 1;
}

testDocMirrorsCurrentSurfaceCounts();
testDocKeepsBoundaryLabelsAndNoClaims();
testDocLocksV2SplitInventory();
testDocLinksAndNavigationSurfaces();
testPackageExportsStillMatchDocumentedImportPaths();

console.log(`Consequence admission public surface docs tests: ${passed} passed, 0 failed`);
