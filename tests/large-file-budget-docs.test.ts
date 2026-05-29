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
  includes(doc, '[Final Large File Refactor Plan](final-large-file-refactor-plan.md)', 'Large file budget doc: links the active final execution contract');
}

function testFinalLargeFileRefactorPlanLocksScopeAndNoClaims(): void {
  const plan = readProjectFile('docs', '02-architecture', 'final-large-file-refactor-plan.md');

  includes(plan, '# Final Large File Refactor Plan', 'Final plan: title is present');
  includes(plan, 'This is a repository maintainability plan only.', 'Final plan: maintainability-only boundary is explicit');
  includes(plan, '`src/service/http/routes/account-routes.ts` | 2588 | 150-250 facade', 'Final plan: account route target is locked');
  includes(plan, '`src/service/http/routes/release-policy-control-routes.ts` | 1679 | 150-300 facade', 'Final plan: release policy route target is locked');
  includes(plan, '`src/service/http/routes/admin-routes.ts` | 1579 | 150-300 facade', 'Final plan: admin route target is locked');
  includes(plan, '## Planned Rounds', 'Final plan: planned rounds section is present');
  includes(plan, '| F-15 | Financial test split and final registry/docs closeout', 'Final plan: closeout round is present');
  includes(plan, '## Parity Locks Before Moves', 'Final plan: parity locks section is present');
  includes(plan, 'method/path inventory, session/auth authority inventory', 'Final plan: account parity lock is explicit');
  includes(plan, 'admin role inventory, read/mutation/break-glass route inventory', 'Final plan: release policy parity lock is explicit');
  includes(plan, 'role-scoped admin route inventory, mutation audit inventory', 'Final plan: admin parity lock is explicit');
  includes(plan, '## Risk Profiles', 'Final plan: risk profiles section is present');
  includes(plan, 'auth/session authority drift, missing CSRF/CORS guard', 'Final plan: account risk profile is explicit');
  includes(plan, 'admin role escalation, break-glass route drift', 'Final plan: release policy risk profile is explicit');
  includes(plan, 'role-scoped key bypass, rate-limit ordering drift', 'Final plan: admin risk profile is explicit');
  includes(plan, 'No runtime behavior change is intended.', 'Final plan: no-behavior-change contract is explicit');
  includes(plan, 'Do not split crypto/protocol adapters in this wave unless a focused audit', 'Final plan: crypto/protocol exclusion is explicit');
  includes(plan, '## Intentional Exceptions', 'Final plan: intentional exceptions section is present');
  includes(plan, '## Rollback Strategy', 'Final plan: rollback strategy section is present');
  includes(plan, 'This plan is repository-side maintainability evidence only.', 'Final plan: no-claims section is explicit');
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
    '[Final Large File Refactor Plan](../02-architecture/final-large-file-refactor-plan.md)',
    'Repository navigator: links the active final large-file refactor plan',
  );
}

testLargeFileBudgetDocNamesThresholdsAndCommand();
testFinalLargeFileRefactorPlanLocksScopeAndNoClaims();
testLargeFileBudgetScriptKeepsThresholdsAndRegistry();
testLargeFileBudgetPackageScriptsExist();
testRepositoryNavigatorLinksLargeFileBudget();

console.log(`Large file budget docs tests: ${passed} passed, 0 failed`);
