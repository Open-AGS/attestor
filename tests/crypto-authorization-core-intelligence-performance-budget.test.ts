import assert from 'node:assert/strict';
import {
  CRYPTO_INTELLIGENCE_DEFAULT_PERFORMANCE_BUDGETS,
  CRYPTO_INTELLIGENCE_PERFORMANCE_BUDGET_SPEC_VERSION,
  CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS,
  CRYPTO_INTELLIGENCE_PERFORMANCE_REASON_CODES,
  CRYPTO_INTELLIGENCE_PERFORMANCE_STATUSES,
  createCryptoIntelligencePerformanceBenchmark,
  cryptoIntelligencePerformanceBenchmarkLabel,
  cryptoIntelligencePerformanceBudgetDescriptor,
  type CryptoIntelligencePerformanceOperationKind,
  type CryptoIntelligencePerformanceSample,
} from '../src/crypto-authorization-core/intelligence-performance-budget.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function samplesFor(
  operationKind: CryptoIntelligencePerformanceOperationKind,
  durations: readonly number[],
): readonly CryptoIntelligencePerformanceSample[] {
  return durations.map((durationMs, iteration) => ({
    operationKind,
    durationMs,
    iteration,
    unitCount: 1,
  }));
}

function passingSamples(): readonly CryptoIntelligencePerformanceSample[] {
  return CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS.flatMap((operationKind) =>
    samplesFor(operationKind, [1, 2, 3, 4, 5]),
  );
}

function testDescriptor(): void {
  const descriptor = cryptoIntelligencePerformanceBudgetDescriptor();

  equal(
    descriptor.version,
    CRYPTO_INTELLIGENCE_PERFORMANCE_BUDGET_SPEC_VERSION,
    'crypto performance budget: descriptor exposes version',
  );
  deepEqual(
    descriptor.operationKinds,
    CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS,
    'crypto performance budget: descriptor exposes operation kinds',
  );
  deepEqual(
    descriptor.statuses,
    CRYPTO_INTELLIGENCE_PERFORMANCE_STATUSES,
    'crypto performance budget: descriptor exposes statuses',
  );
  deepEqual(
    descriptor.reasonCodes,
    CRYPTO_INTELLIGENCE_PERFORMANCE_REASON_CODES,
    'crypto performance budget: descriptor exposes reason codes',
  );
  equal(
    descriptor.defaultBudgets.length,
    CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS.length,
    'crypto performance budget: every operation has a default budget',
  );
  equal(
    descriptor.failClosedOnBudgetExceeded,
    true,
    'crypto performance budget: budget breaches fail closed',
  );
  equal(
    descriptor.rawBenchmarkInputsStored,
    false,
    'crypto performance budget: raw benchmark inputs are not stored',
  );
}

function testPassingBenchmarkAggregatesBudgetResults(): void {
  const benchmark = createCryptoIntelligencePerformanceBenchmark({
    generatedAt: '2026-05-11T14:30:00.000Z',
    benchmarkId: 'crypto-intelligence-performance:test-pass',
    environmentRef: 'ci:unit',
    samples: passingSamples(),
  });

  equal(benchmark.version, CRYPTO_INTELLIGENCE_PERFORMANCE_BUDGET_SPEC_VERSION, 'crypto performance budget: version is stable');
  equal(benchmark.status, 'pass', 'crypto performance budget: passing samples pass');
  equal(benchmark.operationCount, CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS.length, 'crypto performance budget: all operations are evaluated');
  equal(benchmark.sampleCount, CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS.length * 5, 'crypto performance budget: samples are counted');
  equal(benchmark.failedOperationCount, 0, 'crypto performance budget: no failed operations');
  equal(benchmark.insufficientSampleOperationCount, 0, 'crypto performance budget: no insufficient operations');
  ok(
    benchmark.results.every((result) => result.reasonCodes.includes('performance-budget-pass')),
    'crypto performance budget: every operation carries pass reason',
  );
  equal(benchmark.rawPayloadStored, false, 'crypto performance budget: raw payload storage is disabled');
  equal(benchmark.rawBenchmarkInputsStored, false, 'crypto performance budget: raw benchmark input storage is disabled');
  ok(benchmark.digest.startsWith('sha256:'), 'crypto performance budget: benchmark is digest-bound');
  equal(
    cryptoIntelligencePerformanceBenchmarkLabel(benchmark),
    `crypto-intelligence-performance / status:${benchmark.status} / operations:${benchmark.operationCount} / samples:${benchmark.sampleCount} / failed:${benchmark.failedOperationCount}`,
    'crypto performance budget: label is stable',
  );
}

function testBudgetFailuresAndInsufficientSamplesFailClosed(): void {
  const failed = createCryptoIntelligencePerformanceBenchmark({
    generatedAt: '2026-05-11T14:31:00.000Z',
    benchmarkId: 'crypto-intelligence-performance:test-fail',
    environmentRef: 'ci:unit',
    samples: [
      ...passingSamples().filter(
        (sample) => sample.operationKind !== 'dashboard-summary-aggregation',
      ),
      ...samplesFor('dashboard-summary-aggregation', [1, 2, 3, 4, 1000]),
    ],
  });

  equal(failed.status, 'fail', 'crypto performance budget: budget breach fails');
  ok(
    failed.reasonCodes.includes('performance-budget-p95-exceeded') ||
      failed.reasonCodes.includes('performance-budget-max-exceeded'),
    'crypto performance budget: failed benchmark records budget breach reason',
  );
  ok(
    failed.results.some((result) =>
      result.operationKind === 'dashboard-summary-aggregation' &&
      result.status === 'fail',
    ),
    'crypto performance budget: failing operation is identified',
  );

  const insufficient = createCryptoIntelligencePerformanceBenchmark({
    generatedAt: '2026-05-11T14:32:00.000Z',
    benchmarkId: 'crypto-intelligence-performance:test-insufficient',
    environmentRef: 'ci:unit',
    samples: passingSamples().filter(
      (sample) => sample.operationKind !== 'privacy-minimization-scan',
    ),
  });

  equal(
    insufficient.status,
    'insufficient-samples',
    'crypto performance budget: missing samples fail into insufficient state',
  );
  ok(
    insufficient.reasonCodes.includes('performance-budget-insufficient-samples'),
    'crypto performance budget: insufficient sample reason is present',
  );
}

function testValidationAndPrivacyGuards(): void {
  assert.throws(
    () =>
      createCryptoIntelligencePerformanceBenchmark({
        generatedAt: 'not-a-date',
        environmentRef: 'ci:unit',
        samples: passingSamples(),
      }),
    /ISO timestamp/i,
    'crypto performance budget: invalid timestamps are rejected',
  );
  passed += 1;

  assert.throws(
    () =>
      createCryptoIntelligencePerformanceBenchmark({
        generatedAt: '2026-05-11T14:33:00.000Z',
        environmentRef: 'ci:unit',
        samples: [
          ...passingSamples(),
          {
            operationKind: 'risk-signal-assessment',
            durationMs: -1,
            iteration: 6,
          },
        ],
      }),
    /non-negative finite number/i,
    'crypto performance budget: negative durations are rejected',
  );
  passed += 1;

  assert.throws(
    () =>
      createCryptoIntelligencePerformanceBenchmark({
        generatedAt: '2026-05-11T14:34:00.000Z',
        environmentRef: 'ci:unit',
        samples: [
          ...passingSamples(),
          {
            operationKind: 'privacy-minimization-scan',
            durationMs: 1,
            iteration: 6,
            rawPayload: 'raw_customer_value_must_not_escape',
          } as unknown as CryptoIntelligencePerformanceSample,
        ],
      }),
    /raw-payload-field|sensitive-marker-detected/i,
    'crypto performance budget: raw benchmark sample material is rejected',
  );
  passed += 1;

  assert.throws(
    () =>
      createCryptoIntelligencePerformanceBenchmark({
        generatedAt: '2026-05-11T14:35:00.000Z',
        environmentRef: 'ci:unit',
        samples: passingSamples(),
        budgets: CRYPTO_INTELLIGENCE_DEFAULT_PERFORMANCE_BUDGETS.slice(1),
      }),
    /missing operation risk-signal-assessment/i,
    'crypto performance budget: missing budgets are rejected',
  );
  passed += 1;
}

testDescriptor();
testPassingBenchmarkAggregatesBudgetResults();
testBudgetFailuresAndInsufficientSamplesFailClosed();
testValidationAndPrivacyGuards();

console.log(`Crypto authorization core intelligence performance budget tests: ${passed} passed, 0 failed`);
