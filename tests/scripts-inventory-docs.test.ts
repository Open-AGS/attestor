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

function probeScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'probe'))
    .filter((entry) => /^probe-.*\.(?:mjs|ts)$/u.test(entry))
    .sort();
}

function renderScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'render'))
    .filter((entry) => /^render-.*\.(?:mjs|ts)$/u.test(entry))
    .sort();
}

function demoScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'demo'))
    .filter((entry) => /^demo-.*\.(?:mjs|ts)$/u.test(entry))
    .sort();
}

function rehearseScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'rehearse'))
    .filter((entry) => /\.(?:mjs|ts)$/u.test(entry))
    .sort();
}

function runScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'run'))
    .filter((entry) => /^run-.*\.mjs$/u.test(entry))
    .sort();
}

function benchmarkScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'benchmark'))
    .filter((entry) => /\.ts$/u.test(entry))
    .sort();
}

function opsScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'ops'))
    .filter((entry) => /\.ts$/u.test(entry))
    .sort();
}

function previewScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'preview'))
    .filter((entry) => /^preview-.*\.ts$/u.test(entry))
    .sort();
}

function proofScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'proof'))
    .filter((entry) => /-proof\.ts$/u.test(entry))
    .sort();
}

function libScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'lib'))
    .filter((entry) => /^(?:secret-safe-output|remote-secret-keys|repo-pipeline-readiness)\.ts$/u.test(entry))
    .sort();
}

function verifyScriptFiles(): readonly string[] {
  return readdirSync(join(process.cwd(), 'scripts', 'verify'))
    .filter((entry) => /^(?:validate|verify)-.*\.(?:mjs|ts)$/u.test(entry))
    .sort();
}

function testInventoryMirrorsCurrentScriptCounts(): void {
  const doc = readProjectFile('docs', '02-architecture', 'scripts-inventory.md');
  const files = scriptFiles();
  const checkFiles = checkScriptFiles();
  const probeFiles = probeScriptFiles();
  const renderFiles = renderScriptFiles();
  const demoFiles = demoScriptFiles();
  const rehearseFiles = rehearseScriptFiles();
  const runFiles = runScriptFiles();
  const benchmarkFiles = benchmarkScriptFiles();
  const opsFiles = opsScriptFiles();
  const previewFiles = previewScriptFiles();
  const proofFiles = proofScriptFiles();
  const libFiles = libScriptFiles();
  const verifyFiles = verifyScriptFiles();

  includes(doc, '# Scripts Inventory', 'Scripts inventory: title is present');
  includes(doc, `Root script files: ${files.length}.`, 'Scripts inventory: root script count matches directory');
  includes(doc, `Check script files under \`scripts/check/\`: ${checkFiles.length}.`, 'Scripts inventory: check script count matches directory');
  includes(doc, `Probe script files under \`scripts/probe/\`: ${probeFiles.length}.`, 'Scripts inventory: probe script count matches directory');
  includes(doc, `Render script files under \`scripts/render/\`: ${renderFiles.length}.`, 'Scripts inventory: render script count matches directory');
  includes(doc, `Demo script files under \`scripts/demo/\`: ${demoFiles.length}.`, 'Scripts inventory: demo script count matches directory');
  includes(doc, `Rehearsal script files under \`scripts/rehearse/\`: ${rehearseFiles.length}.`, 'Scripts inventory: rehearse script count matches directory');
  includes(doc, `Run script files under \`scripts/run/\`: ${runFiles.length}.`, 'Scripts inventory: run script count matches directory');
  includes(doc, `Benchmark script files under \`scripts/benchmark/\`: ${benchmarkFiles.length}.`, 'Scripts inventory: benchmark script count matches directory');
  includes(doc, `Ops script files under \`scripts/ops/\`: ${opsFiles.length}.`, 'Scripts inventory: ops script count matches directory');
  includes(doc, `Preview script files under \`scripts/preview/\`: ${previewFiles.length}.`, 'Scripts inventory: preview script count matches directory');
  includes(doc, `Proof script files under \`scripts/proof/\`: ${proofFiles.length}.`, 'Scripts inventory: proof script count matches directory');
  includes(doc, `Shared helper files under \`scripts/lib/\`: ${libFiles.length}.`, 'Scripts inventory: lib helper count matches directory');
  includes(doc, `Verification script files under \`scripts/verify/\`: ${verifyFiles.length}.`, 'Scripts inventory: verify script count matches directory');

  for (const [label, count] of [
    ['`scripts/check/check-*`', checkFiles.length],
    ['`scripts/probe/probe-*`', probeFiles.length],
    ['`scripts/render/render-*`', renderFiles.length],
    ['`scripts/demo/demo-*`', demoFiles.length],
    ['`scripts/rehearse/*.ts`', rehearseFiles.length],
    ['`scripts/run/run-*`', runFiles.length],
    ['`scripts/verify/{validate,verify}-*`', verifyFiles.length],
    ['`scripts/benchmark/*.ts`', benchmarkFiles.length],
    ['`scripts/ops/*.ts`', opsFiles.length],
    ['`scripts/preview/preview-*`', previewFiles.length],
    ['`scripts/proof/*-proof.ts`', proofFiles.length],
    ['`scripts/lib/{secret,remote,repo}-*`', libFiles.length],
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
    'scripts/run/run-suite.mjs',
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
    '[Repository navigator](docs/01-overview/repository-navigator.md)',
    'Scripts inventory: README routes maintainers through the repository navigator',
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
