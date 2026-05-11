import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  assertCryptoIntelligencePrivacyMinimized,
} from './intelligence-privacy-minimization.js';

/**
 * Crypto intelligence performance budget contract.
 *
 * This records aggregated benchmark results for hot intelligence paths without
 * persisting raw benchmark inputs, crypto payloads, customer identifiers, or
 * provider responses.
 */

export const CRYPTO_INTELLIGENCE_PERFORMANCE_BUDGET_SPEC_VERSION =
  'attestor.crypto-intelligence-performance-budget.v1';

export const CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS = [
  'risk-signal-assessment',
  'policy-gap-narrowing',
  'operator-risk-input-contract',
  'dashboard-summary-aggregation',
  'privacy-minimization-scan',
  'canonicalization-and-hashing',
  'negative-fixture-validation',
  'telemetry-safety-scan',
] as const;
export type CryptoIntelligencePerformanceOperationKind =
  typeof CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS[number];

export const CRYPTO_INTELLIGENCE_PERFORMANCE_STATUSES = [
  'pass',
  'fail',
  'insufficient-samples',
] as const;
export type CryptoIntelligencePerformanceStatus =
  typeof CRYPTO_INTELLIGENCE_PERFORMANCE_STATUSES[number];

export const CRYPTO_INTELLIGENCE_PERFORMANCE_REASON_CODES = [
  'performance-budget-pass',
  'performance-budget-p95-exceeded',
  'performance-budget-max-exceeded',
  'performance-budget-average-exceeded',
  'performance-budget-insufficient-samples',
] as const;
export type CryptoIntelligencePerformanceReasonCode =
  typeof CRYPTO_INTELLIGENCE_PERFORMANCE_REASON_CODES[number];

export interface CryptoIntelligencePerformanceBudget {
  readonly operationKind: CryptoIntelligencePerformanceOperationKind;
  readonly minSamples: number;
  readonly maxAverageMs: number;
  readonly maxP95Ms: number;
  readonly maxMaxMs: number;
}

export interface CryptoIntelligencePerformanceSample {
  readonly operationKind: CryptoIntelligencePerformanceOperationKind;
  readonly durationMs: number;
  readonly iteration: number;
  readonly unitCount?: number | null;
}

export interface CreateCryptoIntelligencePerformanceBenchmarkInput {
  readonly generatedAt: string;
  readonly benchmarkId?: string | null;
  readonly environmentRef: string;
  readonly samples: readonly CryptoIntelligencePerformanceSample[];
  readonly budgets?: readonly CryptoIntelligencePerformanceBudget[] | null;
}

export interface CryptoIntelligencePerformanceOperationResult {
  readonly operationKind: CryptoIntelligencePerformanceOperationKind;
  readonly sampleCount: number;
  readonly unitCount: number;
  readonly averageMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  readonly budget: CryptoIntelligencePerformanceBudget;
  readonly status: CryptoIntelligencePerformanceStatus;
  readonly reasonCodes: readonly CryptoIntelligencePerformanceReasonCode[];
}

export interface CryptoIntelligencePerformanceBenchmark {
  readonly version: typeof CRYPTO_INTELLIGENCE_PERFORMANCE_BUDGET_SPEC_VERSION;
  readonly generatedAt: string;
  readonly benchmarkId: string;
  readonly environmentRef: string;
  readonly operationCount: number;
  readonly sampleCount: number;
  readonly failedOperationCount: number;
  readonly insufficientSampleOperationCount: number;
  readonly status: CryptoIntelligencePerformanceStatus;
  readonly reasonCodes: readonly CryptoIntelligencePerformanceReasonCode[];
  readonly results: readonly CryptoIntelligencePerformanceOperationResult[];
  readonly failClosedOnBudgetExceeded: true;
  readonly decisionSupportOnly: true;
  readonly rawPayloadStored: false;
  readonly rawBenchmarkInputsStored: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoIntelligencePerformanceBudgetDescriptor {
  readonly version: typeof CRYPTO_INTELLIGENCE_PERFORMANCE_BUDGET_SPEC_VERSION;
  readonly operationKinds: typeof CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS;
  readonly statuses: typeof CRYPTO_INTELLIGENCE_PERFORMANCE_STATUSES;
  readonly reasonCodes: typeof CRYPTO_INTELLIGENCE_PERFORMANCE_REASON_CODES;
  readonly defaultBudgets: readonly CryptoIntelligencePerformanceBudget[];
  readonly failClosedOnBudgetExceeded: true;
  readonly decisionSupportOnly: true;
  readonly rawPayloadStored: false;
  readonly rawBenchmarkInputsStored: false;
}

export const CRYPTO_INTELLIGENCE_DEFAULT_PERFORMANCE_BUDGETS = Object.freeze([
  budget('risk-signal-assessment', 5, 15, 30, 60),
  budget('policy-gap-narrowing', 5, 12, 25, 50),
  budget('operator-risk-input-contract', 5, 15, 30, 60),
  budget('dashboard-summary-aggregation', 5, 20, 45, 90),
  budget('privacy-minimization-scan', 5, 20, 45, 90),
  budget('canonicalization-and-hashing', 5, 10, 20, 40),
  budget('negative-fixture-validation', 5, 35, 80, 160),
  budget('telemetry-safety-scan', 5, 15, 30, 60),
] satisfies readonly CryptoIntelligencePerformanceBudget[]);

function budget(
  operationKind: CryptoIntelligencePerformanceOperationKind,
  minSamples: number,
  maxAverageMs: number,
  maxP95Ms: number,
  maxMaxMs: number,
): CryptoIntelligencePerformanceBudget {
  return Object.freeze({
    operationKind,
    minSamples,
    maxAverageMs,
    maxP95Ms,
    maxMaxMs,
  });
}

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function includesValue<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Crypto intelligence performance budget ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeCompactRef(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    throw new Error(`Crypto intelligence performance budget ${fieldName} requires a non-empty value.`);
  }
  if (/\s/u.test(normalized)) {
    throw new Error(`Crypto intelligence performance budget ${fieldName} must be a compact reference.`);
  }
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`Crypto intelligence performance budget ${fieldName} must not contain control characters.`);
  }
  return normalized;
}

function normalizeNonNegativeNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Crypto intelligence performance budget ${fieldName} must be a non-negative finite number.`);
  }
  return Number(value.toFixed(6));
}

function normalizePositiveNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Crypto intelligence performance budget ${fieldName} must be a positive finite number.`);
  }
  return Number(value.toFixed(6));
}

function normalizePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Crypto intelligence performance budget ${fieldName} must be a positive integer.`);
  }
  return value;
}

function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Crypto intelligence performance budget ${fieldName} must be a non-negative integer.`);
  }
  return value;
}

function normalizeBudget(
  input: CryptoIntelligencePerformanceBudget,
): CryptoIntelligencePerformanceBudget {
  if (!includesValue(CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS, input.operationKind)) {
    throw new Error(`Crypto intelligence performance budget operation is unsupported: ${input.operationKind}.`);
  }
  const minSamples = normalizePositiveInteger(input.minSamples, 'budget.minSamples');
  const maxAverageMs = normalizePositiveNumber(input.maxAverageMs, 'budget.maxAverageMs');
  const maxP95Ms = normalizePositiveNumber(input.maxP95Ms, 'budget.maxP95Ms');
  const maxMaxMs = normalizePositiveNumber(input.maxMaxMs, 'budget.maxMaxMs');
  if (maxP95Ms > maxMaxMs || maxAverageMs > maxMaxMs) {
    throw new Error('Crypto intelligence performance budget maxMaxMs must be at least maxAverageMs and maxP95Ms.');
  }
  return budget(input.operationKind, minSamples, maxAverageMs, maxP95Ms, maxMaxMs);
}

function normalizeSample(
  sample: CryptoIntelligencePerformanceSample,
): CryptoIntelligencePerformanceSample {
  if (!includesValue(CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS, sample.operationKind)) {
    throw new Error(`Crypto intelligence performance sample operation is unsupported: ${sample.operationKind}.`);
  }
  return Object.freeze({
    operationKind: sample.operationKind,
    durationMs: normalizeNonNegativeNumber(sample.durationMs, 'sample.durationMs'),
    iteration: normalizeNonNegativeInteger(sample.iteration, 'sample.iteration'),
    unitCount:
      sample.unitCount === undefined || sample.unitCount === null
        ? null
        : normalizePositiveInteger(sample.unitCount, 'sample.unitCount'),
  });
}

function budgetMap(
  budgets: readonly CryptoIntelligencePerformanceBudget[] | null | undefined,
): Map<CryptoIntelligencePerformanceOperationKind, CryptoIntelligencePerformanceBudget> {
  const map = new Map<CryptoIntelligencePerformanceOperationKind, CryptoIntelligencePerformanceBudget>();
  for (const entry of budgets ?? CRYPTO_INTELLIGENCE_DEFAULT_PERFORMANCE_BUDGETS) {
    const normalized = normalizeBudget(entry);
    map.set(normalized.operationKind, normalized);
  }
  for (const kind of CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS) {
    if (!map.has(kind)) {
      throw new Error(`Crypto intelligence performance budget is missing operation ${kind}.`);
    }
  }
  return map;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function percentile(sorted: readonly number[], percentileRank: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(percentileRank * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

function resultStatus(input: {
  readonly sampleCount: number;
  readonly averageMs: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  readonly budget: CryptoIntelligencePerformanceBudget;
}): {
  readonly status: CryptoIntelligencePerformanceStatus;
  readonly reasonCodes: readonly CryptoIntelligencePerformanceReasonCode[];
} {
  const reasonCodes: CryptoIntelligencePerformanceReasonCode[] = [];
  if (input.sampleCount < input.budget.minSamples) {
    reasonCodes.push('performance-budget-insufficient-samples');
  }
  if (input.averageMs > input.budget.maxAverageMs) {
    reasonCodes.push('performance-budget-average-exceeded');
  }
  if (input.p95Ms > input.budget.maxP95Ms) {
    reasonCodes.push('performance-budget-p95-exceeded');
  }
  if (input.maxMs > input.budget.maxMaxMs) {
    reasonCodes.push('performance-budget-max-exceeded');
  }
  if (reasonCodes.length === 0) {
    return Object.freeze({
      status: 'pass',
      reasonCodes: Object.freeze(['performance-budget-pass'] as const),
    });
  }
  return Object.freeze({
    status: reasonCodes.includes('performance-budget-insufficient-samples')
      ? 'insufficient-samples'
      : 'fail',
    reasonCodes: Object.freeze([...new Set(reasonCodes)].sort()),
  });
}

function operationResult(input: {
  readonly operationKind: CryptoIntelligencePerformanceOperationKind;
  readonly samples: readonly CryptoIntelligencePerformanceSample[];
  readonly budget: CryptoIntelligencePerformanceBudget;
}): CryptoIntelligencePerformanceOperationResult {
  const durations = input.samples
    .map((sample) => sample.durationMs)
    .sort((left, right) => left - right);
  const sampleCount = durations.length;
  const averageMs =
    sampleCount === 0
      ? 0
      : durations.reduce((sum, duration) => sum + duration, 0) / sampleCount;
  const p50Ms = percentile(durations, 0.5);
  const p95Ms = percentile(durations, 0.95);
  const maxMs = durations[durations.length - 1] ?? 0;
  const status = resultStatus({
    sampleCount,
    averageMs,
    p95Ms,
    maxMs,
    budget: input.budget,
  });

  return Object.freeze({
    operationKind: input.operationKind,
    sampleCount,
    unitCount: input.samples.reduce((sum, sample) => sum + (sample.unitCount ?? 1), 0),
    averageMs: round(averageMs),
    p50Ms: round(p50Ms),
    p95Ms: round(p95Ms),
    maxMs: round(maxMs),
    budget: input.budget,
    status: status.status,
    reasonCodes: status.reasonCodes,
  });
}

function overallStatus(
  results: readonly CryptoIntelligencePerformanceOperationResult[],
): CryptoIntelligencePerformanceStatus {
  if (results.some((result) => result.status === 'fail')) return 'fail';
  if (results.some((result) => result.status === 'insufficient-samples')) {
    return 'insufficient-samples';
  }
  return 'pass';
}

function uniqueReasonCodes(
  results: readonly CryptoIntelligencePerformanceOperationResult[],
): readonly CryptoIntelligencePerformanceReasonCode[] {
  return Object.freeze(
    [...new Set(results.flatMap((result) => result.reasonCodes))].sort(),
  );
}

export function cryptoIntelligencePerformanceBudgetDescriptor():
CryptoIntelligencePerformanceBudgetDescriptor {
  return Object.freeze({
    version: CRYPTO_INTELLIGENCE_PERFORMANCE_BUDGET_SPEC_VERSION,
    operationKinds: CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS,
    statuses: CRYPTO_INTELLIGENCE_PERFORMANCE_STATUSES,
    reasonCodes: CRYPTO_INTELLIGENCE_PERFORMANCE_REASON_CODES,
    defaultBudgets: CRYPTO_INTELLIGENCE_DEFAULT_PERFORMANCE_BUDGETS,
    failClosedOnBudgetExceeded: true,
    decisionSupportOnly: true,
    rawPayloadStored: false,
    rawBenchmarkInputsStored: false,
  });
}

export function createCryptoIntelligencePerformanceBenchmark(
  input: CreateCryptoIntelligencePerformanceBenchmarkInput,
): CryptoIntelligencePerformanceBenchmark {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const environmentRef = normalizeCompactRef(input.environmentRef, 'environmentRef');
  const benchmarkId = normalizeCompactRef(
    input.benchmarkId ?? `crypto-intelligence-performance:${environmentRef}`,
    'benchmarkId',
  );
  const budgets = budgetMap(input.budgets);

  assertCryptoIntelligencePrivacyMinimized({
    surfaceKind: 'intelligence-performance-benchmark',
    artifact: input.samples,
  });

  const samples = Object.freeze(input.samples.map(normalizeSample));

  const results = Object.freeze(
    CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS.map((operationKind) =>
      operationResult({
        operationKind,
        samples: samples.filter((sample) => sample.operationKind === operationKind),
        budget: budgets.get(operationKind)!,
      }),
    ),
  );
  const status = overallStatus(results);
  const reasonCodes = uniqueReasonCodes(results);
  const payload = Object.freeze({
    version: CRYPTO_INTELLIGENCE_PERFORMANCE_BUDGET_SPEC_VERSION,
    generatedAt,
    benchmarkId,
    environmentRef,
    operationCount: results.length,
    sampleCount: samples.length,
    failedOperationCount: results.filter((result) => result.status === 'fail').length,
    insufficientSampleOperationCount: results.filter(
      (result) => result.status === 'insufficient-samples',
    ).length,
    status,
    reasonCodes,
    results,
    failClosedOnBudgetExceeded: true,
    decisionSupportOnly: true,
    rawPayloadStored: false,
    rawBenchmarkInputsStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  } satisfies Omit<CryptoIntelligencePerformanceBenchmark, 'canonical' | 'digest'>);

  assertCryptoIntelligencePrivacyMinimized({
    surfaceKind: 'intelligence-performance-benchmark',
    artifact: payload,
  });
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function cryptoIntelligencePerformanceBenchmarkLabel(
  benchmark: CryptoIntelligencePerformanceBenchmark,
): string {
  return [
    'crypto-intelligence-performance',
    `status:${benchmark.status}`,
    `operations:${benchmark.operationCount}`,
    `samples:${benchmark.sampleCount}`,
    `failed:${benchmark.failedOperationCount}`,
  ].join(' / ');
}
