import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import {
  canonicalizeReleaseJson,
} from '../src/release-kernel/release-canonicalization.js';
import {
  createCryptoCanonicalCounterpartyReference,
} from '../src/crypto-authorization-core/canonical-references.js';
import {
  createCryptoConsequenceRiskAssessment,
} from '../src/crypto-authorization-core/consequence-risk-mapping.js';
import {
  createCryptoIntelligenceRiskSignalAssessment,
} from '../src/crypto-authorization-core/intelligence-risk-signals.js';
import {
  createCryptoPolicyGapNarrowingAssessment,
} from '../src/crypto-authorization-core/policy-gap-narrowing.js';
import {
  createCryptoOperatorRiskInputBundle,
  type CryptoOperatorRiskInput,
} from '../src/crypto-authorization-core/operator-risk-input-contract.js';
import {
  createCryptoIntelligenceDashboardSummary,
} from '../src/crypto-authorization-core/intelligence-dashboard-summary.js';
import {
  createCryptoIntelligencePerformanceBenchmark,
  createCryptoIntelligencePerformanceEfficiencyProfile,
  type CryptoIntelligencePerformanceOperationKind,
  type CryptoIntelligencePerformanceSample,
} from '../src/crypto-authorization-core/intelligence-performance-budget.js';
import {
  evaluateCryptoIntelligencePrivacyMinimizationArtifact,
} from '../src/crypto-authorization-core/intelligence-privacy-minimization.js';
import {
  createCryptoAccountReference,
  createCryptoAssetReference,
  createCryptoChainReference,
} from '../src/crypto-authorization-core/types.js';
import {
  CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_FIXTURES,
} from '../src/crypto-execution-admission/index.js';

interface BenchmarkOptions {
  readonly iterations: number;
  readonly warmupIterations: number;
  readonly outputDir: string;
  readonly environmentRef: string;
  readonly generatedAt: string;
}

function arg(name: string, fallback?: string): string | undefined {
  const prefixed = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefixed));
  if (found) return found.slice(prefixed.length);
  return fallback;
}

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function parsePositiveInteger(value: string | undefined, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string | undefined, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  return parsed;
}

function digestFor(label: string): string {
  return `sha256:${createHash('sha256').update(label).digest('hex')}`;
}

function fixtureChain() {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId: '1',
  });
}

function fixtureAccount() {
  return createCryptoAccountReference({
    accountKind: 'agent-wallet',
    chain: fixtureChain(),
    address: '0x1111111111111111111111111111111111111111',
  });
}

function fixtureAsset() {
  return createCryptoAssetReference({
    assetKind: 'stablecoin',
    chain: fixtureChain(),
    assetId: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
  });
}

function fixtureCounterparty() {
  return createCryptoCanonicalCounterpartyReference({
    counterpartyKind: 'contract',
    counterpartyId: 'contract:main',
    chain: fixtureChain(),
  });
}

function riskAssessmentFixture() {
  return createCryptoConsequenceRiskAssessment({
    consequenceKind: 'agent-payment',
    account: fixtureAccount(),
    asset: fixtureAsset(),
    amount: {
      assetAmount: '12.50',
      normalizedUsd: '12.50',
    },
    counterparty: fixtureCounterparty(),
    context: {
      executionAdapterKind: 'x402-payment',
      hasBudget: true,
      hasExpiry: true,
    },
  });
}

function signalAssessmentFixture() {
  return createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: riskAssessmentFixture(),
    context: {
      x402: {
        paymentRequirementDigest: digestFor('payment-requirement'),
        paymentSignatureDigest: null,
        paymentResponseDigest: null,
        idempotencyKeyDigest: null,
      },
      solver: {
        routeCommitmentDigest: null,
        settlementPreflightDigest: null,
        refundPathBound: false,
      },
      route: {
        isCrossChain: true,
        usesBridge: true,
        routeCommitmentDigest: null,
        refundPathBound: false,
      },
    },
  });
}

function operatorRiskInputFixture(): CryptoOperatorRiskInput {
  return {
    inputId: 'risk-input:benchmark',
    inputClass: 'counterparty-risk',
    riskTier: 'high',
    source: {
      sourceKind: 'third-party-provider',
      providerRef: 'provider:benchmark',
      datasetRef: 'dataset:counterparty-risk',
      datasetVersionRef: 'dataset-version:2026-05-11',
      methodRef: 'method:counterparty-risk:v1',
      retrievedAt: '2026-05-11T11:58:00.000Z',
      evidenceDigest: digestFor('counterparty-risk:source:evidence'),
      providerRunDigest: digestFor('counterparty-risk:provider-run'),
    },
    freshness: {
      observedAt: '2026-05-11T11:57:00.000Z',
      maxAgeSeconds: 3600,
    },
    scope: {
      scopeKind: 'counterparty',
      consequenceKind: 'agent-payment',
      chainRef: 'eip155:1',
      counterpartyDigest: digestFor('counterparty:scoped'),
      policyRef: 'policy:crypto-risk-input',
    },
    evidenceRefs: [
      {
        kind: 'digest',
        value: digestFor('counterparty-risk:evidence'),
      },
    ],
    claimsAttestorNativeOracle: false,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  };
}

function dashboardSummaryFixture() {
  const signals = signalAssessmentFixture();
  const gaps = createCryptoPolicyGapNarrowingAssessment({
    signalAssessment: signals,
    generatedAt: '2026-05-11T12:00:00.000Z',
  });
  const operatorRisk = createCryptoOperatorRiskInputBundle({
    generatedAt: '2026-05-11T12:00:00.000Z',
    scopeRef: 'crypto-intelligence:benchmark',
    inputs: [operatorRiskInputFixture()],
  });

  return createCryptoIntelligenceDashboardSummary({
    generatedAt: '2026-05-11T12:05:00.000Z',
    scopeRef: 'crypto-intelligence:benchmark',
    signalAssessments: [signals],
    policyGapAssessments: [gaps],
    operatorRiskInputBundles: [operatorRisk],
    readiness: [
      {
        surface: 'x402-resource-server',
        adapterKind: 'x402-payment',
        status: 'blocked',
        sourceDigest: digestFor('readiness:x402'),
        reasonCodes: ['x402-facilitator-verification-missing'],
        missingEvidenceClasses: ['x402-payment-response'],
      },
      {
        surface: 'intent-solver',
        adapterKind: 'intent-settlement',
        status: 'needs-evidence',
        sourceDigest: digestFor('readiness:intent-solver'),
        reasonCodes: ['solver-settlement-preflight-missing'],
        missingEvidenceClasses: ['solver-settlement-preflight'],
      },
    ],
  });
}

function measureOperation(input: {
  readonly operationKind: CryptoIntelligencePerformanceOperationKind;
  readonly iterations: number;
  readonly warmupIterations: number;
  readonly execute: () => unknown;
}): readonly CryptoIntelligencePerformanceSample[] {
  for (let index = 0; index < input.warmupIterations; index += 1) {
    input.execute();
  }

  const samples: CryptoIntelligencePerformanceSample[] = [];
  for (let iteration = 0; iteration < input.iterations; iteration += 1) {
    const startedAt = performance.now();
    input.execute();
    const endedAt = performance.now();
    samples.push({
      operationKind: input.operationKind,
      durationMs: endedAt - startedAt,
      iteration,
      unitCount: 1,
    });
  }
  return Object.freeze(samples);
}

export function captureCryptoIntelligencePerformanceBenchmark(
  options: BenchmarkOptions,
) {
  const signals = signalAssessmentFixture();
  const gaps = createCryptoPolicyGapNarrowingAssessment({
    signalAssessment: signals,
    generatedAt: '2026-05-11T12:00:00.000Z',
  });
  const samples = [
    ...measureOperation({
      operationKind: 'risk-signal-assessment',
      iterations: options.iterations,
      warmupIterations: options.warmupIterations,
      execute: signalAssessmentFixture,
    }),
    ...measureOperation({
      operationKind: 'policy-gap-narrowing',
      iterations: options.iterations,
      warmupIterations: options.warmupIterations,
      execute: () =>
        createCryptoPolicyGapNarrowingAssessment({
          signalAssessment: signals,
          generatedAt: '2026-05-11T12:00:00.000Z',
        }),
    }),
    ...measureOperation({
      operationKind: 'operator-risk-input-contract',
      iterations: options.iterations,
      warmupIterations: options.warmupIterations,
      execute: () =>
        createCryptoOperatorRiskInputBundle({
          generatedAt: '2026-05-11T12:00:00.000Z',
          scopeRef: 'crypto-intelligence:benchmark',
          inputs: [operatorRiskInputFixture()],
        }),
    }),
    ...measureOperation({
      operationKind: 'dashboard-summary-aggregation',
      iterations: options.iterations,
      warmupIterations: options.warmupIterations,
      execute: dashboardSummaryFixture,
    }),
    ...measureOperation({
      operationKind: 'privacy-minimization-scan',
      iterations: options.iterations,
      warmupIterations: options.warmupIterations,
      execute: () =>
        evaluateCryptoIntelligencePrivacyMinimizationArtifact({
          surfaceKind: 'intelligence-dashboard-summary',
          artifact: dashboardSummaryFixture(),
        }),
    }),
    ...measureOperation({
      operationKind: 'canonicalization-and-hashing',
      iterations: options.iterations,
      warmupIterations: options.warmupIterations,
      execute: () => {
        const canonical = canonicalizeReleaseJson({
          signalsDigest: signals.digest,
          gapsDigest: gaps.digest,
          dashboardDigest: dashboardSummaryFixture().digest,
        });
        return createHash('sha256').update(canonical).digest('hex');
      },
    }),
    ...measureOperation({
      operationKind: 'negative-fixture-validation',
      iterations: options.iterations,
      warmupIterations: options.warmupIterations,
      execute: () =>
        evaluateCryptoIntelligencePrivacyMinimizationArtifact({
          surfaceKind: 'negative-conformance-fixtures',
          artifact: CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_FIXTURES,
        }),
    }),
    ...measureOperation({
      operationKind: 'telemetry-safety-scan',
      iterations: options.iterations,
      warmupIterations: options.warmupIterations,
      execute: () =>
        evaluateCryptoIntelligencePrivacyMinimizationArtifact({
          surfaceKind: 'admission-telemetry-event',
          artifact: {
            eventName: 'crypto-intelligence.benchmark',
            reasonCodes: ['performance-budget-pass'],
            dashboardDigest: dashboardSummaryFixture().digest,
          },
        }),
    }),
  ];

  const benchmark = createCryptoIntelligencePerformanceBenchmark({
    generatedAt: options.generatedAt,
    benchmarkId: `crypto-intelligence-performance:${options.environmentRef}`,
    environmentRef: options.environmentRef,
    samples,
  });
  const efficiencyProfile = createCryptoIntelligencePerformanceEfficiencyProfile({
    benchmark,
    baselineBenchmark: benchmark,
  });

  mkdirSync(options.outputDir, { recursive: true });
  writeFileSync(
    resolve(options.outputDir, 'benchmark.json'),
    `${JSON.stringify({
      version: benchmark.version,
      generatedAt: benchmark.generatedAt,
      benchmarkId: benchmark.benchmarkId,
      environmentRef: benchmark.environmentRef,
      status: benchmark.status,
      reasonCodes: benchmark.reasonCodes,
      operationCount: benchmark.operationCount,
      sampleCount: benchmark.sampleCount,
      failedOperationCount: benchmark.failedOperationCount,
      insufficientSampleOperationCount: benchmark.insufficientSampleOperationCount,
      results: benchmark.results,
      efficiencyProfile: {
        status: efficiencyProfile.status,
        reasonCodes: efficiencyProfile.reasonCodes,
        failedRegressionOperationCount: efficiencyProfile.failedRegressionOperationCount,
        insufficientRegressionBaselineCount:
          efficiencyProfile.insufficientRegressionBaselineCount,
        digest: efficiencyProfile.digest,
      },
      digest: benchmark.digest,
    }, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    resolve(options.outputDir, 'README.md'),
    `# Crypto intelligence performance benchmark

Generated: ${benchmark.generatedAt}

- environment: ${benchmark.environmentRef}
- status: ${benchmark.status}
- samples: ${benchmark.sampleCount}
- digest: ${benchmark.digest}
- efficiency profile digest: ${efficiencyProfile.digest}

This benchmark stores aggregated operation timings only. It does not persist raw crypto payloads, wallet metadata, customer identifiers, provider responses, private policy thresholds, or solver route secrets.
`,
    'utf8',
  );

  return benchmark;
}

async function main(): Promise<void> {
  const benchmark = captureCryptoIntelligencePerformanceBenchmark({
    iterations: parsePositiveInteger(
      arg('iterations', env('ATTESTOR_CRYPTO_INTELLIGENCE_BENCHMARK_ITERATIONS') ?? '20'),
      'iterations',
    ),
    warmupIterations: parseNonNegativeInteger(
      arg('warmup-iterations', env('ATTESTOR_CRYPTO_INTELLIGENCE_BENCHMARK_WARMUP') ?? '3'),
      'warmup-iterations',
    ),
    outputDir: resolve(
      arg('output-dir', '.attestor/crypto-intelligence/performance/latest')!,
    ),
    environmentRef: arg(
      'environment-ref',
      env('ATTESTOR_CRYPTO_INTELLIGENCE_BENCHMARK_ENVIRONMENT') ?? 'local',
    )!,
    generatedAt: new Date().toISOString(),
  });

  console.log(JSON.stringify(benchmark, null, 2));
  if (benchmark.status !== 'pass') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Unexpected crypto intelligence benchmark failure.');
    process.exit(1);
  });
}
