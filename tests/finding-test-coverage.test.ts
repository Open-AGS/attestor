import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const {
  parseFindingIndexRows,
  validateFindingTestCoverage,
} = await import('../scripts/check/check-finding-test-coverage.mjs') as {
  readonly parseFindingIndexRows: (content: string) => readonly unknown[];
  readonly validateFindingTestCoverage: (options?: {
    readonly content?: string;
    readonly projectRoot?: string;
    readonly requireExistingTests?: boolean;
  }) => {
    readonly ok: boolean;
    readonly failures: readonly string[];
    readonly checkedRows: readonly string[];
    readonly futureContracts: readonly string[];
  };
};

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function withTempRepo<T>(callback: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), 'attestor-finding-test-coverage-'));
  try {
    mkdirSync(join(root, 'tests'), { recursive: true });
    writeFileSync(join(root, 'tests', 'locking.test.ts'), 'export {};\n', 'utf8');
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function tableRow(
  finding: string,
  state: string,
  severity: string,
  evidence: string,
  action = 'No further action.',
): string {
  return `| ${finding} | \`${state}\` | ${severity} | auditability | ${evidence} | ${action} |`;
}

function table(...rows: readonly string[]): string {
  return [
    '| Finding | Current state | Severity | Protected principle | Current evidence | Required action |',
    '|---|---|---:|---|---|---|',
    ...rows,
  ].join('\n');
}

function testParserReadsFindingRows(): void {
  const rows = parseFindingIndexRows(table(tableRow('OPS-X', 'closed', 'P1', 'Locking test: `tests/locking.test.ts`.')));
  equal(rows.length, 1, 'Finding test coverage: parser reads one finding row');
}

function testClosedP1RequiresLockingMarker(): void {
  const result = validateFindingTestCoverage({
    content: table(tableRow('OPS-X missing marker', 'closed', 'P1', '`tests/locking.test.ts` exists but is free text.')),
    requireExistingTests: false,
  });
  equal(result.ok, false, 'Finding test coverage: closed P1 without marker fails');
  ok(result.failures.some((failure) => failure.includes('lacks Locking test:')), 'Finding test coverage: missing marker failure is explicit');
}

function testClosedP1RequiresExistingTestPath(): void {
  withTempRepo((root) => {
    const result = validateFindingTestCoverage({
      content: table(tableRow('OPS-X missing file', 'closed', 'P1', 'Locking test: `tests/missing.test.ts`.')),
      projectRoot: root,
    });
    equal(result.ok, false, 'Finding test coverage: missing test file fails');
    ok(result.failures.some((failure) => failure.includes('does not exist')), 'Finding test coverage: missing file failure is explicit');
  });
}

function testLiveProofRowsRequireFutureContractPath(): void {
  const missing = validateFindingTestCoverage({
    content: table(tableRow('Customer PEP no-bypass', 'needs live test', 'P0', 'Repo primitives are not enough.')),
    requireExistingTests: false,
  });
  equal(missing.ok, false, 'Finding test coverage: live-proof P0 without test contract fails');
  ok(missing.failures.some((failure) => failure.includes('lacks Test contract:')), 'Finding test coverage: missing test contract failure is explicit');

  const present = validateFindingTestCoverage({
    content: table(tableRow('Customer PEP no-bypass', 'needs live test', 'P0', 'Repo primitives are not enough. Test contract: `tests/live-customer-pep-no-bypass.test.ts`.')),
    requireExistingTests: false,
  });
  equal(present.ok, true, 'Finding test coverage: live-proof P0 accepts future live test contract path');
  equal(present.futureContracts.length, 1, 'Finding test coverage: future contract row is counted');
}

function testDisputedClosureDoesNotRequireLockingTest(): void {
  const result = validateFindingTestCoverage({
    content: table(tableRow('OPS-X disputed', 'disputed/closed', 'P1', 'Repository evidence contradicts the original claim.')),
    requireExistingTests: false,
  });
  equal(result.ok, true, 'Finding test coverage: disputed closure is not treated as a fixed closed row');
}

function testCurrentRepositoryPasses(): void {
  const result = validateFindingTestCoverage();
  equal(result.ok, true, 'Finding test coverage: current finding-index passes');
  ok(result.checkedRows.length > 0, 'Finding test coverage: current repository has checked closed P0/P1 rows');

  const output = execFileSync('node', ['scripts/check/check-finding-test-coverage.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  ok(output.includes('Finding test coverage checks: passed'), 'Finding test coverage: CLI reports pass');
}

testParserReadsFindingRows();
testClosedP1RequiresLockingMarker();
testClosedP1RequiresExistingTestPath();
testLiveProofRowsRequireFutureContractPath();
testDisputedClosureDoesNotRequireLockingTest();
testCurrentRepositoryPasses();

console.log(`Finding test coverage tests: ${passed} passed, 0 failed`);
