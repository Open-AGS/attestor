import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

function scriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts'))
    .filter((entry) => /\.(?:mjs|ts)$/u.test(entry))
    .sort();
}

function checkScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'check'))
    .filter((entry) => /^check-.*\.mjs$/u.test(entry))
    .sort();
}

function familyCounts(files: readonly string[]): Readonly<Record<string, number>> {
  const family = {
    check: files.filter((file) => file.startsWith('check-')).length,
    probe: files.filter((file) => file.startsWith('probe-')).length,
    render: files.filter((file) => file.startsWith('render-')).length,
    demo: files.filter((file) => file.startsWith('demo-')).length,
    rehearse: files.filter((file) => file.startsWith('rehearse-')).length,
    run: files.filter((file) => file.startsWith('run-')).length,
    validateVerify: files.filter((file) => file.startsWith('validate-') || file.startsWith('verify-')).length,
    benchmark: files.filter((file) => file.startsWith('benchmark-')).length,
  };

  const assigned = family.check + family.probe + family.render + family.demo +
    family.rehearse + family.run + family.validateVerify + family.benchmark;

  return {
    ...family,
    namedOps: files.length - assigned,
  };
}

function testInventoryMirrorsCurrentScriptCounts(): void {
  const doc = readProjectFile('docs', '02-architecture', 'scripts-inventory.md');
  const files = scriptFiles();
  const checkFiles = checkScriptFiles();
  const counts = familyCounts(files);

  includes(doc, '# Scripts Inventory', 'Scripts inventory: title is present');
  includes(doc, `Root script files: ${files.length}.`, 'Scripts inventory: root script count matches directory');
  includes(doc, `Check script files under \`scripts/check/\`: ${checkFiles.length}.`, 'Scripts inventory: check script count matches directory');

  for (const [label, count] of [
    ['`scripts/check/check-*`', checkFiles.length],
    ['`probe-*`', counts.probe],
    ['`render-*`', counts.render],
    ['`demo-*`', counts.demo],
    ['`rehearse-*`', counts.rehearse],
    ['`run-*`', counts.run],
    ['`validate-*` and `verify-*`', counts.validateVerify],
    ['`benchmark-*`', counts.benchmark],
    ['named ops helpers', counts.namedOps],
  ] as const) {
    includes(doc, `| ${label} | ${count} |`, `Scripts inventory: ${label} count matches directory`);
  }
}

function testInventoryKeepsPreflightAndMoveRules(): void {
  const doc = readProjectFile('docs', '02-architecture', 'scripts-inventory.md');

  for (const expected of [
    '## PR Preflight',
    'npm run check:pr-body -- <path-to-pr-body.md>',
    'npm run test:package-script-runner',
    'git diff --check',
    'same mistake can pass local tests and fail in GitHub.',
    '## Move Rule',
    'Do not move scripts just to make the directory look cleaner.',
    'Move one family at a time.',
  ]) {
    includes(doc, expected, `Scripts inventory: keeps ${expected}`);
  }
}

function testInventoryKeepsAuthorityBoundariesAndSourceAnchors(): void {
  const doc = readProjectFile('docs', '02-architecture', 'scripts-inventory.md');

  for (const expected of [
    'It is a reference document, not a path migration plan.',
    'Scripts are local, CI, or opt-in operator helpers.',
    'They do not prove production readiness by name alone.',
    'check script is not production proof',
    'probe script is not customer PEP no-bypass proof',
    'rendered packet is not live deployment evidence',
    'demo script is not hosted enforcement',
    'https://docs.npmjs.com/cli/v11/using-npm/scripts/#working-directory-for-scripts',
    'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes',
    'https://diataxis.fr/reference/',
  ]) {
    includes(doc, expected, `Scripts inventory: keeps source/boundary ${expected}`);
  }
}

function testInventoryNamesFailurePreventionScripts(): void {
  const doc = readProjectFile('docs', '02-architecture', 'scripts-inventory.md');

  for (const expected of [
    'validate-pr-body.mjs',
    'validate-pr-contract.mjs',
    'check-baseline-alignment.mjs',
    'check-public-artifacts-redaction.mjs',
    'run-suite.mjs',
  ]) {
    includes(doc, expected, `Scripts inventory: names ${expected}`);
  }
}

function testInventoryLinksResolveAndNavigationSurfaces(): void {
  const docPath = join(process.cwd(), 'docs', '02-architecture', 'scripts-inventory.md');
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

  assert.deepEqual(missing, [], 'Scripts inventory: all relative links resolve');
  passed += 1;

  const readme = readProjectFile('README.md');
  const navigator = readProjectFile('docs', '01-overview', 'repository-navigator.md');

  includes(
    readme,
    '[Scripts inventory](docs/02-architecture/scripts-inventory.md)',
    'Scripts inventory: README maintainer reference links the doc',
  );
  includes(
    navigator,
    '[Scripts inventory](../02-architecture/scripts-inventory.md)',
    'Scripts inventory: repository navigator links the doc',
  );
}

function testPackageScriptExposesInventoryGuard(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(
    packageJson.scripts['test:scripts-inventory-docs'],
    'tsx tests/scripts-inventory-docs.test.ts',
    'Package scripts: scripts inventory docs guard is exposed',
  );
}

testInventoryMirrorsCurrentScriptCounts();
testInventoryKeepsPreflightAndMoveRules();
testInventoryKeepsAuthorityBoundariesAndSourceAnchors();
testInventoryNamesFailurePreventionScripts();
testInventoryLinksResolveAndNavigationSurfaces();
testPackageScriptExposesInventoryGuard();

console.log(`Scripts inventory docs tests: ${passed} passed, 0 failed`);
