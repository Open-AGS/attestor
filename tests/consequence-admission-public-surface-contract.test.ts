import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
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

function includes(haystack: string, needle: string, message: string): void {
  ok(haystack.includes(needle), `${message}\nExpected to find: ${needle}`);
}

const indexSource = readProjectFile('src', 'consequence-admission', 'index.ts');
const publicSurfaceSource = readProjectFile('src', 'consequence-admission', 'public-surface.ts');
const packageJson = JSON.parse(readProjectFile('package.json')) as {
  readonly exports: Readonly<Record<string, { readonly types: string; readonly default: string }>>;
};

const exportTargetPattern = /^export \* from ['"]\.\/([^'"]+\.js)['"];$/gm;
const exportLinePattern = /^export \* from ['"]\.\/[^'"]+\.js['"];$/u;
const publicSurfaceTargets = [...publicSurfaceSource.matchAll(exportTargetPattern)].map(
  (match) => match[1],
);
const nonCommentLines = publicSurfaceSource
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('//'));

includes(
  indexSource,
  "export * from './public-surface.js';",
  'Consequence admission public surface: index delegates broad re-exports to public-surface',
);
ok(
  indexSource.trimEnd().endsWith("export * from './public-surface.js';"),
  'Consequence admission public surface: broad re-export remains the trailing index export',
);

ok(
  publicSurfaceTargets.length >= 150,
  'Consequence admission public surface: public-surface keeps the broad catalogue explicit',
);
equal(
  publicSurfaceTargets.length,
  nonCommentLines.length,
  'Consequence admission public surface: every non-comment line is a catalogue re-export',
);
ok(
  nonCommentLines.every((line) => exportLinePattern.test(line)),
  'Consequence admission public surface: catalogue has no implementation logic or local imports',
);

const duplicateTargets = publicSurfaceTargets.filter(
  (target, index, targets) => targets.indexOf(target) !== index,
);
assert.deepEqual(duplicateTargets, [], 'Consequence admission public surface: targets are unique');
passed += 1;

for (const forbiddenTarget of ['index.js', 'public-surface.js']) {
  ok(
    !publicSurfaceTargets.includes(forbiddenTarget),
    `Consequence admission public surface: catalogue must not self-export ${forbiddenTarget}`,
  );
}

for (const target of publicSurfaceTargets) {
  ok(
    !target.includes('/') && !target.includes('\\') && !target.includes('..'),
    `Consequence admission public surface: ${target} stays a sibling module export`,
  );
  ok(
    existsSync(join(process.cwd(), 'src', 'consequence-admission', target.replace(/\.js$/u, '.ts'))),
    `Consequence admission public surface: ${target} maps to an existing TypeScript source file`,
  );
}

equal(
  packageJson.exports['./consequence-admission'].default,
  './dist/consequence-admission/index.js',
  'Consequence admission public surface: package subpath resolves through index.js',
);
equal(
  packageJson.exports['./consequence-admission'].types,
  './dist/consequence-admission/index.d.ts',
  'Consequence admission public surface: package subpath types resolve through index.d.ts',
);
ok(
  !Object.keys(packageJson.exports).some((subpath) =>
    subpath.startsWith('./consequence-admission/')),
  'Consequence admission public surface: package exports do not expose internal consequence-admission files',
);

const architecture = readProjectFile(
  'docs',
  '02-architecture',
  'ai-action-control-plane-architecture.md',
);
includes(
  architecture,
  '`src/consequence-admission/public-surface.ts` is a curated',
  'Consequence admission public surface: architecture doc names the curated catalogue',
);
includes(
  architecture,
  'It does not create a second authority surface',
  'Consequence admission public surface: architecture doc keeps authority boundary explicit',
);

console.log(`consequence admission public surface contract tests passed (${passed} assertions)`);
