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
  includes(doc, '[Large File Refactor V2 Plan](large-file-refactor-v2-plan.md)', 'Large file budget doc: links the active V2 execution contract');
}

function testLargeFileRefactorV2PlanLocksScopeAndNoClaims(): void {
  const plan = readProjectFile('docs', '02-architecture', 'large-file-refactor-v2-plan.md');

  includes(plan, '# Large File Refactor V2 Plan', 'V2 plan: title is present');
  includes(plan, 'This is a repository maintainability plan only.', 'V2 plan: maintainability-only boundary is explicit');
  includes(plan, '`src/service/control-plane-store.ts` | 3415 | 700-1000', 'V2 plan: control-plane-store target is locked');
  includes(plan, '`src/consequence-admission/index.ts` | 108 after V2-12 | achieved', 'V2 plan: consequence-admission target is locked');
  includes(plan, '`src/service/http/routes/shadow-routes.ts` | 1611 after V2-15 | 900-1300', 'V2 plan: shadow-routes target is locked');
  includes(plan, '## Planned Rounds', 'V2 plan: planned rounds section is present');
  includes(plan, '| 16 | `shadow-routes.ts`: activation/receipt routes plus closeout', 'V2 plan: round 16 closeout is present');
  includes(plan, '## Parity Locks Before Moves', 'V2 plan: parity locks section is present');
  includes(plan, 'public store method inventory, state key inventory', 'V2 plan: control-plane parity lock is explicit');
  includes(plan, 'public export inventory, admission outcome contract inventory', 'V2 plan: consequence-admission parity lock is explicit');
  includes(plan, 'route registry inventory, method/path/status/header inventory', 'V2 plan: shadow route parity lock is explicit');
  includes(plan, '## Risk Profiles', 'V2 plan: risk profiles section is present');
  includes(plan, 'state shape drift, key-name drift, tenant scope mixup', 'V2 plan: store risk profile is explicit');
  includes(plan, 'public export drift, `admit`/`narrow`/`review`/`block` semantic drift', 'V2 plan: admission risk profile is explicit');
  includes(plan, 'missing `no-store` header, raw evidence/payload/impact leakage', 'V2 plan: shadow risk profile is explicit');
  includes(plan, 'No runtime behavior change is intended.', 'V2 plan: no-behavior-change contract is explicit');
  includes(plan, 'Do not split crypto/protocol adapters in this wave.', 'V2 plan: crypto/protocol exclusion is explicit');
  includes(plan, 'Do not split `account-routes.ts` in this wave', 'V2 plan: account-routes exclusion is explicit');
  includes(plan, 'Use a read-only Opus/second-opinion audit at each major surface boundary', 'V2 plan: second-opinion checkpoint is explicit');
  includes(plan, '## Rollback Strategy', 'V2 plan: rollback strategy section is present');
  includes(plan, 'This plan is repository-side maintainability evidence only.', 'V2 plan: no-claims section is explicit');
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
  includes(
    navigator,
    '[Large File Refactor V2 Plan](../02-architecture/large-file-refactor-v2-plan.md)',
    'Repository navigator: links the active large-file refactor V2 plan',
  );
}

testLargeFileBudgetDocNamesThresholdsAndCommand();
testLargeFileRefactorV2PlanLocksScopeAndNoClaims();
testLargeFileBudgetScriptKeepsThresholdsAndRegistry();
testLargeFileBudgetPackageScriptsExist();
testRepositoryNavigatorLinksLargeFileBudget();

console.log(`Large file budget docs tests: ${passed} passed, 0 failed`);
