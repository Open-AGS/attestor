import { strict as assert } from 'node:assert';
import { validateDataContracts } from '../src/financial/data-contracts.js';
import type {
  BusinessConstraint,
  DataContractColumn,
  ExecutionEvidence,
} from '../src/financial/types.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function baseEvidence(overrides: Partial<ExecutionEvidence>): ExecutionEvidence {
  return {
    success: true,
    durationMs: 1,
    rowCount: overrides.rows?.length ?? 1,
    columns: ['amount'],
    columnTypes: ['number'],
    rows: [{ amount: 100 }],
    error: null,
    schemaHash: 'sha256:test-schema',
    ...overrides,
  };
}

function numberColumn(name = 'amount'): DataContractColumn[] {
  return [{ name, type: 'number', required: true, notNull: true }];
}

function runContract(
  evidence: ExecutionEvidence,
  constraints: BusinessConstraint[],
): ReturnType<typeof validateDataContracts> {
  return validateDataContracts(evidence, numberColumn(), constraints);
}

function testDeclaredNumberTypeRejectsStringRows(): void {
  const result = runContract(
    baseEvidence({
      columnTypes: ['string'],
      rows: [{ amount: '100.00' }],
    }),
    [],
  );

  ok(result.result === 'fail', 'Data contracts: declared number rejects string metadata and row value');
  ok(
    result.checks.some((check) => check.check === 'column_type:amount:number' && !check.passed),
    'Data contracts: column metadata mismatch is explicit',
  );
  ok(
    result.checks.some((check) => check.check === 'row_type:amount:number' && !check.passed),
    'Data contracts: row type mismatch is explicit',
  );
}

function testNumericConstraintsRejectZeroNumericValues(): void {
  for (const constraint of [
    { description: 'amount non-negative', column: 'amount', check: 'non_negative' },
    { description: 'amount in range', column: 'amount', check: 'range', min: 0, max: 1000 },
    { description: 'amount sum', column: 'amount', check: 'sum_equals', value: 0 },
  ] as const satisfies readonly BusinessConstraint[]) {
    const result = runContract(
      baseEvidence({
        columnTypes: ['string'],
        rows: [{ amount: '' }, { amount: 'not-a-number' }],
      }),
      [constraint],
    );

    ok(result.result === 'fail', `Data contracts: ${constraint.check} rejects zero numeric values`);
    ok(
      result.checks.some((check) => check.check.startsWith(`${constraint.check}:amount`) && !check.passed),
      `Data contracts: ${constraint.check} failure is visible`,
    );
  }
}

function testControlTotalsRejectNonNumericValues(): void {
  const result = validateDataContracts(
    baseEvidence({
      columnTypes: ['string'],
      rows: [{ amount: '0' }],
    }),
    numberColumn(),
    [],
    [{ description: 'amount balance', column: 'amount', expectedTotal: 0, tolerance: 0 }],
  );

  ok(result.result === 'fail', 'Data contracts: control totals reject non-numeric values');
  ok(
    result.checks.some((check) => check.check === 'control_total:amount' && !check.passed),
    'Data contracts: control total numeric failure is visible',
  );
}

function testValidNumericContractPasses(): void {
  const result = runContract(
    baseEvidence({
      rows: [{ amount: 25 }, { amount: 75 }],
    }),
    [
      { description: 'amount non-negative', column: 'amount', check: 'non_negative' },
      { description: 'amount in range', column: 'amount', check: 'range', min: 0, max: 100 },
      { description: 'amount sum', column: 'amount', check: 'sum_equals', value: 100 },
    ],
  );

  ok(result.result === 'pass', 'Data contracts: valid numeric evidence still passes');
}

testDeclaredNumberTypeRejectsStringRows();
testNumericConstraintsRejectZeroNumericValues();
testControlTotalsRejectNonNumericValues();
testValidNumericContractPasses();

console.log(`Financial data-contract tests: ${passed} passed, 0 failed`);
