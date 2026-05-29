import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface CatalogSurface {
  readonly id: string;
  readonly tier: string;
  readonly hermetic: boolean;
  readonly protectedPrinciples: readonly string[];
  readonly primaryScripts: readonly string[];
  readonly referenceFiles: readonly string[];
}

interface Catalog {
  readonly version: string;
  readonly authorityBoundary: string;
  readonly tierModel: readonly { readonly id: string }[];
  readonly surfaces: readonly CatalogSurface[];
  readonly implementationGates: readonly {
    readonly id: string;
    readonly script: string;
    readonly status: string;
  }[];
  readonly rehomePlan: {
    readonly rule: string;
    readonly targetDirectories: readonly string[];
    readonly currentTransitionState: string;
  };
  readonly nonClaims: readonly string[];
}

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function readProjectFile(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), 'utf8');
}

function existsProjectPath(path: string): boolean {
  return existsSync(join(process.cwd(), path));
}

function isDirectoryProjectPath(path: string): boolean {
  const fullPath = join(process.cwd(), path);
  return existsSync(fullPath) && statSync(fullPath).isDirectory();
}

const packageJson = JSON.parse(readProjectFile('package.json')) as {
  readonly scripts: Record<string, string>;
};
const catalog = JSON.parse(
  readProjectFile('docs', '02-architecture', 'test-system-catalog.json'),
) as Catalog;
const mapDoc = readProjectFile('docs', '02-architecture', 'test-system-map.md');
const testsReadme = readProjectFile('tests', 'README.md');

equal(
  catalog.version,
  'attestor.test-system-catalog.v1',
  'Test catalog: version is stable',
);
ok(
  catalog.authorityBoundary.includes('does not prove live customer PEP no-bypass'),
  'Test catalog: authority boundary does not overclaim live PEP proof',
);
for (const tier of ['T0', 'T1', 'T2', 'T3', 'T4', 'T5']) {
  ok(
    catalog.tierModel.some((entry) => entry.id === tier),
    `Test catalog: tier ${tier} is defined`,
  );
}

for (const expectedSurface of [
  'admission-core',
  'admission-routes',
  'api-evidence-shapes',
  'golden-paths',
  'service-control-plane',
  'live-and-ops',
]) {
  ok(
    catalog.surfaces.some((surface) => surface.id === expectedSurface),
    `Test catalog: ${expectedSurface} surface is present`,
  );
}

for (const surface of catalog.surfaces) {
  ok(surface.protectedPrinciples.length > 0, `Test catalog: ${surface.id} has protected principles`);
  for (const script of surface.primaryScripts) {
    ok(
      packageJson.scripts[script] !== undefined,
      `Test catalog: ${surface.id} references existing package script ${script}`,
    );
  }
  for (const path of surface.referenceFiles) {
    const pathExists = path.endsWith('/')
      ? isDirectoryProjectPath(path.slice(0, -1))
      : existsProjectPath(path);
    ok(pathExists, `Test catalog: ${surface.id} reference exists: ${path}`);
  }
}

for (const expectedGate of ['T-00', 'T-01', 'T-02', 'T-03', 'T-04']) {
  const gate = catalog.implementationGates.find((entry) => entry.id === expectedGate);
  ok(gate, `Test catalog: ${expectedGate} is tracked`);
  ok(Boolean(gate && packageJson.scripts[gate.script]), `Test catalog: ${expectedGate} script exists`);
}

ok(
  catalog.rehomePlan.rule.includes('Do not mass-move'),
  'Test catalog: rehome plan forbids mass test moves',
);
ok(
  catalog.rehomePlan.targetDirectories.includes('tests/admission/'),
  'Test catalog: target rehome directory includes admission',
);
ok(
  catalog.nonClaims.some((claim) => claim.includes('production readiness')),
  'Test catalog: non-claims include production readiness',
);

for (const requiredDocPhrase of [
  'If You Changed This, Start Here',
  'T3 | snapshot-and-golden',
  'T4 | property-and-fuzz',
  'Do not mass-move the 600+ root test files in one PR',
  'It is not a production proof',
]) {
  ok(mapDoc.includes(requiredDocPhrase), `Test system map: includes "${requiredDocPhrase}"`);
}

for (const requiredReadmePhrase of [
  'Attestor Test Navigator',
  'npm run test:critical-admission-property-suite',
  'npm run test:api-evidence-shape-snapshots',
  'npm run test:golden-output-baseline-diff',
  'Do not run live/operator gates accidentally',
]) {
  ok(testsReadme.includes(requiredReadmePhrase), `Tests README: includes "${requiredReadmePhrase}"`);
}

console.log(`test-system-map.test.ts: ${passed} assertions passed`);
