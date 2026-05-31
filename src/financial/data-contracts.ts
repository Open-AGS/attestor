/**
 * Data Contract Validation — Post-execution deterministic gates.
 *
 * Validates that SQL execution results conform to expected data contracts.
 * Inspired by dbt model contracts, Great Expectations, and Soda Core patterns.
 * Implementation: Attestor-native, deterministic, no external dependencies.
 *
 * Checks:
 * 1. Schema match (columns present and typed)
 * 2. Required columns present
 * 3. Nullability enforcement
 * 4. Business constraints (min, max, range, non_negative, sum_equals, row_count)
 * 5. Row-count / emptiness checks
 */

import type {
  DataContractResult,
  DataContractCheck,
  DataContractColumn,
  BusinessConstraint,
  ControlTotal,
  ExecutionEvidence,
} from './types.js';

type DataContractScalarType = DataContractColumn['type'];

function normalizeColumnTypeMetadata(value: string | undefined): DataContractScalarType | 'unknown' {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) return 'unknown';
  if (
    normalized === 'number' ||
    normalized.includes('int') ||
    normalized.includes('real') ||
    normalized.includes('double') ||
    normalized.includes('numeric') ||
    normalized.includes('decimal') ||
    normalized.includes('float')
  ) {
    return 'number';
  }
  if (normalized === 'boolean' || normalized === 'bool') return 'boolean';
  if (normalized === 'date' || normalized.includes('date') || normalized.includes('time')) return 'date';
  if (normalized === 'null') return 'null';
  if (
    normalized === 'string' ||
    normalized.includes('text') ||
    normalized.includes('char') ||
    normalized.includes('clob') ||
    normalized.includes('varchar')
  ) {
    return 'string';
  }
  return 'unknown';
}

function columnTypeMetadataMatches(
  expected: DataContractScalarType,
  actual: DataContractScalarType | 'unknown',
): boolean {
  if (actual === 'unknown') return true;
  if (expected === actual) return true;
  return expected === 'date' && actual === 'string';
}

function valueMatchesDeclaredType(value: unknown, expected: DataContractScalarType): boolean {
  if (value === null || value === undefined) return true;
  switch (expected) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      return (
        value instanceof Date && !Number.isNaN(value.getTime())
      ) || (
        typeof value === 'string' &&
        value.trim().length > 0 &&
        !Number.isNaN(Date.parse(value))
      );
    case 'null':
      return value === null;
  }
}

// ─── Schema Checks ───────────────────────────────────────────────────────────

function checkSchemaMatch(
  evidence: ExecutionEvidence,
  expectedColumns: DataContractColumn[],
): DataContractCheck[] {
  const checks: DataContractCheck[] = [];

  for (const col of expectedColumns) {
    const idx = evidence.columns.indexOf(col.name);
    if (idx === -1) {
      if (col.required) {
        checks.push({
          check: `column_present:${col.name}`,
          passed: false,
          detail: `Required column "${col.name}" missing from result`,
          severity: 'hard',
        });
      } else {
        checks.push({
          check: `column_present:${col.name}`,
          passed: true,
          detail: `Optional column "${col.name}" not present (acceptable)`,
          severity: 'soft',
        });
      }
    } else {
      const metadataType = normalizeColumnTypeMetadata(evidence.columnTypes[idx]);
      const metadataMatches = columnTypeMetadataMatches(col.type, metadataType);
      checks.push({
        check: `column_present:${col.name}`,
        passed: true,
        detail: `Column "${col.name}" present at index ${idx}`,
        severity: col.required ? 'hard' : 'soft',
      });
      checks.push({
        check: `column_type:${col.name}:${col.type}`,
        passed: metadataMatches,
        detail: metadataMatches
          ? `Column "${col.name}" declared type ${col.type} matches metadata ${metadataType}`
          : `Column "${col.name}" declared type ${col.type} does not match metadata ${metadataType}`,
        severity: 'hard',
      });
    }
  }

  return checks;
}

function checkRowValueTypes(
  evidence: ExecutionEvidence,
  expectedColumns: DataContractColumn[],
): DataContractCheck[] {
  const checks: DataContractCheck[] = [];

  for (const col of expectedColumns) {
    const colIdx = evidence.columns.indexOf(col.name);
    if (colIdx === -1) continue;

    const mismatches = evidence.rows.filter((row) => !valueMatchesDeclaredType(row[col.name], col.type));
    checks.push({
      check: `row_type:${col.name}:${col.type}`,
      passed: mismatches.length === 0,
      detail: mismatches.length === 0
        ? `Column "${col.name}": all non-null row values match declared type ${col.type}`
        : `Column "${col.name}": ${mismatches.length} row values do not match declared type ${col.type}`,
      severity: 'hard',
    });
  }

  return checks;
}

// ─── Nullability Checks ──────────────────────────────────────────────────────

function checkNullability(
  evidence: ExecutionEvidence,
  expectedColumns: DataContractColumn[],
): DataContractCheck[] {
  const checks: DataContractCheck[] = [];

  for (const col of expectedColumns) {
    if (!col.notNull) continue;
    const colIdx = evidence.columns.indexOf(col.name);
    if (colIdx === -1) continue; // handled by schema check

    const nullCount = evidence.rows.filter((r) => r[col.name] === null || r[col.name] === undefined).length;
    checks.push({
      check: `not_null:${col.name}`,
      passed: nullCount === 0,
      detail: nullCount === 0
        ? `Column "${col.name}": no null values (${evidence.rows.length} rows)`
        : `Column "${col.name}": ${nullCount} null values found (not-null constraint violated)`,
      severity: 'hard',
    });
  }

  return checks;
}

// ─── Business Constraint Checks ──────────────────────────────────────────────

function checkBusinessConstraints(
  evidence: ExecutionEvidence,
  constraints: BusinessConstraint[],
): DataContractCheck[] {
  const checks: DataContractCheck[] = [];

  const numericColumnValues = (column: string) => {
    const rawValues = evidence.rows.map((r) => r[column]);
    const values = rawValues.filter((v) => typeof v === 'number' && Number.isFinite(v)) as number[];
    const nonNumericCount = rawValues.filter((v) => v !== null && v !== undefined && (
      typeof v !== 'number' || !Number.isFinite(v)
    )).length;
    return {
      values,
      nonNumericCount,
    };
  };

  const numericSetupFailure = (column: string, values: number[], nonNumericCount: number): string | null => {
    if (!evidence.columns.includes(column)) {
      return `Column "${column}" missing from result`;
    }
    if (nonNumericCount > 0) {
      return `Column "${column}": ${nonNumericCount} non-numeric constrained values found`;
    }
    if (values.length === 0) {
      return `Column "${column}": no numeric values available for numeric constraint`;
    }
    return null;
  };

  for (const constraint of constraints) {
    switch (constraint.check) {
      case 'not_empty': {
        checks.push({
          check: `not_empty`,
          passed: evidence.rows.length > 0,
          detail: evidence.rows.length > 0
            ? `Result has ${evidence.rows.length} rows`
            : 'Result is empty (not_empty constraint violated)',
          severity: 'hard',
        });
        break;
      }
      case 'row_count_min': {
        const pass = evidence.rows.length >= (constraint.value ?? 0);
        checks.push({
          check: `row_count_min:${constraint.value}`,
          passed: pass,
          detail: `Row count ${evidence.rows.length} ${pass ? '>=' : '<'} minimum ${constraint.value}`,
          severity: 'hard',
        });
        break;
      }
      case 'row_count_max': {
        const pass = evidence.rows.length <= (constraint.value ?? Infinity);
        checks.push({
          check: `row_count_max:${constraint.value}`,
          passed: pass,
          detail: `Row count ${evidence.rows.length} ${pass ? '<=' : '>'} maximum ${constraint.value}`,
          severity: 'soft',
        });
        break;
      }
      case 'non_negative': {
        const col = constraint.column;
        const { values, nonNumericCount } = numericColumnValues(col);
        const setupFailure = numericSetupFailure(col, values, nonNumericCount);
        const negatives = values.filter((value) => value < 0);
        const pass = setupFailure === null && negatives.length === 0;
        checks.push({
          check: `non_negative:${col}`,
          passed: pass,
          detail: setupFailure ?? (negatives.length === 0
            ? `Column "${col}": all values non-negative`
            : `Column "${col}": ${negatives.length} negative values found`),
          severity: 'hard',
        });
        break;
      }
      case 'min': {
        const col = constraint.column;
        const { values, nonNumericCount } = numericColumnValues(col);
        const setupFailure = numericSetupFailure(col, values, nonNumericCount);
        const minVal = Math.min(...values);
        const pass = setupFailure === null && minVal >= (constraint.value ?? -Infinity);
        checks.push({
          check: `min:${col}:${constraint.value}`,
          passed: pass,
          detail: setupFailure ?? `Column "${col}": min value ${minVal} ${pass ? '>=' : '<'} threshold ${constraint.value}`,
          severity: 'hard',
        });
        break;
      }
      case 'max': {
        const col = constraint.column;
        const { values, nonNumericCount } = numericColumnValues(col);
        const setupFailure = numericSetupFailure(col, values, nonNumericCount);
        const maxVal = Math.max(...values);
        const pass = setupFailure === null && maxVal <= (constraint.value ?? Infinity);
        checks.push({
          check: `max:${col}:${constraint.value}`,
          passed: pass,
          detail: setupFailure ?? `Column "${col}": max value ${maxVal} ${pass ? '<=' : '>'} threshold ${constraint.value}`,
          severity: 'hard',
        });
        break;
      }
      case 'sum_equals': {
        const col = constraint.column;
        const { values, nonNumericCount } = numericColumnValues(col);
        const setupFailure = numericSetupFailure(col, values, nonNumericCount);
        const sum = values.reduce((a, b) => a + b, 0);
        // Use a small tolerance for floating point
        const pass = setupFailure === null && Math.abs(sum - (constraint.value ?? 0)) < 0.01;
        checks.push({
          check: `sum_equals:${col}:${constraint.value}`,
          passed: pass,
          detail: setupFailure ?? `Column "${col}": sum ${sum.toFixed(2)} ${pass ? '≈' : '≠'} expected ${constraint.value}`,
          severity: 'hard',
        });
        break;
      }
      case 'range': {
        const col = constraint.column;
        const { values, nonNumericCount } = numericColumnValues(col);
        const setupFailure = numericSetupFailure(col, values, nonNumericCount);
        const outOfRange = values.filter((v) => v < (constraint.min ?? -Infinity) || v > (constraint.max ?? Infinity));
        const pass = setupFailure === null && outOfRange.length === 0;
        checks.push({
          check: `range:${col}:${constraint.min}-${constraint.max}`,
          passed: pass,
          detail: setupFailure ?? (outOfRange.length === 0
            ? `Column "${col}": all ${values.length} values within [${constraint.min}, ${constraint.max}]`
            : `Column "${col}": ${outOfRange.length} values outside [${constraint.min}, ${constraint.max}]`),
          severity: 'hard',
        });
        break;
      }
    }
  }

  return checks;
}

// ─── Main Contract Validation ────────────────────────────────────────────────

/**
 * Validate execution evidence against data contracts.
 * All checks are deterministic — no LLM calls, no external services.
 */
// ─── Control Total Checks ────────────────────────────────────────────────────

function checkControlTotals(
  evidence: ExecutionEvidence,
  controlTotals: ControlTotal[],
): DataContractCheck[] {
  const checks: DataContractCheck[] = [];

  for (const ct of controlTotals) {
    const rawValues = evidence.rows.map((r) => r[ct.column]);
    const values = rawValues.filter((v) => typeof v === 'number' && Number.isFinite(v)) as number[];
    const nonNumericCount = rawValues.filter((v) => v !== null && v !== undefined && (
      typeof v !== 'number' || !Number.isFinite(v)
    )).length;
    const setupFailure = !evidence.columns.includes(ct.column)
      ? `Column "${ct.column}" missing from result`
      : nonNumericCount > 0
        ? `Column "${ct.column}": ${nonNumericCount} non-numeric control-total values found`
        : values.length === 0
          ? `Column "${ct.column}": no numeric values available for control total`
          : null;
    const actualTotal = values.reduce((a, b) => a + b, 0);
    const variance = Math.abs(actualTotal - ct.expectedTotal);
    const pass = setupFailure === null && variance <= ct.tolerance;

    checks.push({
      check: `control_total:${ct.column}`,
      passed: pass,
      detail: setupFailure ?? (pass
        ? `Control total "${ct.description}": ${actualTotal.toFixed(2)} within tolerance ${ct.tolerance} of expected ${ct.expectedTotal}`
        : `Control total BREACH "${ct.description}": actual=${actualTotal.toFixed(2)}, expected=${ct.expectedTotal}, variance=${variance.toFixed(2)} exceeds tolerance ${ct.tolerance}`),
      severity: 'hard',
    });
  }

  return checks;
}

// ─── Main Contract Validation ────────────────────────────────────────────────

/**
 * Validate execution evidence against data contracts.
 * All checks are deterministic — no LLM calls, no external services.
 */
export function validateDataContracts(
  evidence: ExecutionEvidence,
  expectedColumns: DataContractColumn[],
  constraints: BusinessConstraint[],
  controlTotals?: ControlTotal[],
): DataContractResult {
  const allChecks: DataContractCheck[] = [
    ...checkSchemaMatch(evidence, expectedColumns),
    ...checkRowValueTypes(evidence, expectedColumns),
    ...checkNullability(evidence, expectedColumns),
    ...checkBusinessConstraints(evidence, constraints),
    ...checkControlTotals(evidence, controlTotals ?? []),
  ];

  const failedChecks = allChecks.filter((c) => !c.passed);
  const hardFailures = failedChecks.filter((c) => c.severity === 'hard');

  return {
    result: hardFailures.length > 0 ? 'fail' : failedChecks.length > 0 ? 'warn' : 'pass',
    checks: allChecks,
    totalChecks: allChecks.length,
    failedChecks: failedChecks.length,
  };
}
