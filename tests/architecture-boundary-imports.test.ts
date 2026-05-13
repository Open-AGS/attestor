import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

type SourceImport = {
  readonly from: string;
  readonly specifier: string;
  readonly target: string;
};

let passed = 0;

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}

function projectPath(filePath: string): string {
  return normalizePath(relative(ROOT, filePath));
}

function collectTypeScriptFiles(root: string): readonly string[] {
  const results: string[] = [];

  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      results.push(...collectTypeScriptFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith('.ts')) {
      results.push(fullPath);
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
}

function importedSpecifiers(content: string): readonly string[] {
  const specifiers: string[] = [];
  const importPattern =
    /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/gu;

  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(content)) !== null) {
    const specifier = match[1] ?? match[2];
    if (specifier) specifiers.push(specifier);
  }

  return specifiers;
}

function resolveRelativeSourceImport(filePath: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;

  const resolved = resolve(dirname(filePath), specifier);
  const extension = extname(resolved);
  const sourceTarget = extension === '.js'
    ? `${resolved.slice(0, -'.js'.length)}.ts`
    : extension === ''
      ? `${resolved}.ts`
      : resolved;
  const relativeTarget = projectPath(sourceTarget);

  return relativeTarget.startsWith('src/') && relativeTarget.endsWith('.ts')
    ? relativeTarget
    : null;
}

function collectSourceImports(): readonly SourceImport[] {
  return collectTypeScriptFiles(SRC_ROOT).flatMap((filePath) => {
    const from = projectPath(filePath);
    const content = readFileSync(filePath, 'utf8');
    return importedSpecifiers(content)
      .map((specifier) => ({
        from,
        specifier,
        target: resolveRelativeSourceImport(filePath, specifier),
      }))
      .filter((item): item is SourceImport => item.target !== null);
  });
}

function assertNoViolations(violations: readonly string[], message: string): void {
  assert.deepEqual([...violations].sort(), [], message);
  passed += 1;
}

function testPlatformStaysDomainNeutral(): void {
  const violations = collectSourceImports()
    .filter((item) => item.from.startsWith('src/platform/'))
    .filter((item) => !item.target.startsWith('src/platform/'))
    .map((item) => `${item.from} imports ${item.specifier} -> ${item.target}`);

  assertNoViolations(
    violations,
    'src/platform must stay domain-neutral and must not import service, packs, release planes, or other domain modules',
  );
}

function testDomainAndCoreDoNotImportHostedServiceInternals(): void {
  const violations = collectSourceImports()
    .filter((item) => !item.from.startsWith('src/service/'))
    .filter((item) => item.target.startsWith('src/service/'))
    .map((item) => `${item.from} imports ${item.specifier} -> ${item.target}`);

  assertNoViolations(
    violations,
    'Only src/service may import hosted service internals; domain, core, platform, and pack modules must not depend on service composition code',
  );
}

function testPublicPackageExportsDoNotExposeHostedOrPlatformInternals(): void {
  const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    readonly exports?: Readonly<Record<string, { readonly default?: string; readonly types?: string }>>;
  };
  const exportsMap = packageJson.exports ?? {};
  const violations = Object.entries(exportsMap)
    .flatMap(([subpath, target]) => [
      `${subpath} default ${target.default ?? ''}`,
      `${subpath} types ${target.types ?? ''}`,
    ])
    .filter((entry) => /dist\/(?:service|platform|utils)\//u.test(entry));

  assertNoViolations(
    violations,
    'Public package exports must not expose hosted service, platform primitive, or generic utility internals as customer import surfaces',
  );
}

function testArchitectureDecisionNamesTheGuardedBoundaries(): void {
  const architecture = readFileSync(
    join(ROOT, 'docs', '02-architecture', 'ai-action-control-plane-architecture.md'),
    'utf8',
  );

  for (const expected of [
    '`src/platform` may contain only domain-neutral primitives.',
    '`src/service` is a composition root.',
    'Public/package entrypoints should be explicit.',
    'Deep imports across bounded',
  ]) {
    assert.ok(
      architecture.includes(expected),
      `Architecture boundary guard should be anchored in the ADR. Missing: ${expected}`,
    );
    passed += 1;
  }
}

testPlatformStaysDomainNeutral();
testDomainAndCoreDoNotImportHostedServiceInternals();
testPublicPackageExportsDoNotExposeHostedOrPlatformInternals();
testArchitectureDecisionNamesTheGuardedBoundaries();

console.log(`Architecture boundary import tests: ${passed} passed, 0 failed`);
