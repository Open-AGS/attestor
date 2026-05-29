import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function testLargeFileBudgetDocNamesThresholdsAndCommand(): void {
  const doc = readProjectFile('docs', '02-architecture', 'large-file-budget.md');

  includes(doc, '# Large File Budget', 'Large file budget doc: title is present');
  includes(doc, '`<= 800` lines', 'Large file budget doc: target threshold is explicit');
  includes(doc, '`801-1200` lines', 'Large file budget doc: tolerated range is explicit');
  includes(doc, '`> 1200` lines', 'Large file budget doc: hard-limit exception is explicit');
  includes(doc, 'npm run test:large-file-budget', 'Large file budget doc: package script is documented');
  includes(doc, 'Generated files, lockfiles, OpenAPI JSON, and large fixture JSON are outside', 'Large file budget doc: generated/fixture boundary is explicit');
  includes(doc, 'This guard is repository-side maintainability evidence only.', 'Large file budget doc: no-claim boundary is explicit');
}

function testLargeFileBudgetScriptKeepsThresholdsAndRegistry(): void {
  const script = readProjectFile('scripts', 'check', 'check-large-file-budget.mjs');

  includes(script, 'const TARGET_LINES = 800;', 'Large file budget script: target threshold is locked');
  includes(script, 'const HARD_LIMIT_LINES = 1200;', 'Large file budget script: hard limit is locked');
  includes(script, 'const HARD_LIMIT_REGISTRY = Object.freeze([', 'Large file budget script: hard-limit registry exists');
  includes(script, 'git\', [\'ls-files\']', 'Large file budget script: scans tracked files only');
}

function testLargeFileBudgetPackageScriptsExist(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  equal(
    packageJson.scripts['check:large-file-budget'],
    'node scripts/check/check-large-file-budget.mjs',
    'Package: check:large-file-budget points at the guard script',
  );
  equal(
    packageJson.scripts['test:large-file-budget'],
    'npm run check:large-file-budget',
    'Package: test:large-file-budget wraps the guard script',
  );
}

function testRepositoryNavigatorLinksLargeFileBudget(): void {
  const navigator = readProjectFile('docs', '01-overview', 'repository-navigator.md');

  includes(
    navigator,
    '[Large file budget](../02-architecture/large-file-budget.md)',
    'Repository navigator: links the large file budget',
  );
  includes(
    navigator,
    '`npm run test:large-file-budget`',
    'Repository navigator: names the large-file budget test command',
  );
}

testLargeFileBudgetDocNamesThresholdsAndCommand();
testLargeFileBudgetScriptKeepsThresholdsAndRegistry();
testLargeFileBudgetPackageScriptsExist();
testRepositoryNavigatorLinksLargeFileBudget();

console.log(`Large file budget docs tests: ${passed} passed, 0 failed`);
