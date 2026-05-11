import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const cryptoCore = await import('attestor/crypto-authorization-core');

function digestFor(label) {
  return `sha256:${createHash('sha256').update(label).digest('hex')}`;
}

assert.equal(
  cryptoCore.CRYPTO_AUTHORIZATION_CORE_PLATFORM_SURFACE_SPEC_VERSION,
  'attestor.crypto-authorization-core-platform.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.types.CRYPTO_AUTHORIZATION_CORE_SPEC_VERSION,
  'attestor.crypto-authorization-core.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.simulation.CRYPTO_AUTHORIZATION_SIMULATION_SPEC_VERSION,
  'attestor.crypto-authorization-simulation.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.intelligenceRiskSignals.CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
  'attestor.crypto-intelligence-risk-signals.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.policyGapNarrowing.CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
  'attestor.crypto-policy-gap-narrowing.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.intelligencePrivacyMinimization
    .CRYPTO_INTELLIGENCE_PRIVACY_MINIMIZATION_SPEC_VERSION,
  'attestor.crypto-intelligence-privacy-minimization.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.operatorRiskInputContract
    .CRYPTO_OPERATOR_RISK_INPUT_CONTRACT_SPEC_VERSION,
  'attestor.crypto-operator-risk-input-contract.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.intelligenceDashboardSummary
    .CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION,
  'attestor.crypto-intelligence-dashboard-summary.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.intelligencePerformanceBudget
    .CRYPTO_INTELLIGENCE_PERFORMANCE_BUDGET_SPEC_VERSION,
  'attestor.crypto-intelligence-performance-budget.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.x402AgenticPayment.X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION,
  'attestor.crypto-x402-agentic-payment-adapter.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.custodyCosignerPolicy.CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
  'attestor.crypto-custody-cosigner-policy-adapter.v1',
);

let blockedInternalPath = false;
try {
  await import('attestor/crypto-authorization-core/types.js');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  blockedInternalPath =
    message.includes('Package subpath') ||
    message.includes('ERR_PACKAGE_PATH_NOT_EXPORTED');
}

assert.equal(
  blockedInternalPath,
  true,
  'internal crypto authorization core module paths should stay outside the public package surface',
);

const privacyEvaluation =
  cryptoCore.cryptoAuthorizationCore.intelligencePrivacyMinimization
    .evaluateCryptoIntelligencePrivacyMinimizationArtifact({
      surfaceKind: 'risk-signal-assessment',
      artifact: {
        reasonCodes: ['route-boundary-unsafe'],
        routeCommitmentDigest: 'sha256:route',
      },
    });
assert.equal(privacyEvaluation.allowed, true);
assert.equal(privacyEvaluation.rawPayloadStored, false);

const unsafePrivacyEvaluation =
  cryptoCore.cryptoAuthorizationCore.intelligencePrivacyMinimization
    .evaluateCryptoIntelligencePrivacyMinimizationArtifact({
      surfaceKind: 'admission-telemetry-event',
      artifact: {
        rawTransactionPayload: '0xraw',
      },
    });
assert.equal(unsafePrivacyEvaluation.allowed, false);
assert.ok(unsafePrivacyEvaluation.reasonCodes.includes('raw-transaction-payload-field'));

const operatorRiskBundle =
  cryptoCore.cryptoAuthorizationCore.operatorRiskInputContract
    .createCryptoOperatorRiskInputBundle({
      generatedAt: '2026-05-11T12:00:00.000Z',
      scopeRef: 'package-surface:operator-risk',
      inputs: [
        {
          inputId: 'risk-input:package-surface',
          inputClass: 'counterparty-risk',
          riskTier: 'high',
          source: {
            sourceKind: 'third-party-provider',
            providerRef: 'provider:package-surface',
            datasetRef: 'dataset:counterparty-risk',
            datasetVersionRef: 'dataset-version:2026-05-11',
            methodRef: 'method:counterparty-risk:v1',
            retrievedAt: '2026-05-11T11:58:00.000Z',
            evidenceDigest: digestFor('operator-risk-source'),
          },
          freshness: {
            observedAt: '2026-05-11T11:57:00.000Z',
            maxAgeSeconds: 3600,
          },
          scope: {
            scopeKind: 'counterparty',
            consequenceKind: 'transfer',
            chainRef: 'eip155:1',
            counterpartyDigest: digestFor('counterparty-scope'),
          },
          evidenceRefs: [
            {
              kind: 'digest',
              value: digestFor('operator-risk-evidence'),
            },
          ],
        },
      ],
    });
assert.equal(operatorRiskBundle.status, 'accepted');
assert.equal(operatorRiskBundle.attestorNativeOracleClaim, false);
assert.equal(operatorRiskBundle.recommendedDisposition, 'review');

const dashboardSummary =
  cryptoCore.cryptoAuthorizationCore.intelligenceDashboardSummary
    .createCryptoIntelligenceDashboardSummary({
      generatedAt: '2026-05-11T12:10:00.000Z',
      scopeRef: 'package-surface:dashboard-summary',
      operatorRiskInputBundles: [operatorRiskBundle],
    });
assert.equal(dashboardSummary.rawPayloadDrilldownEnabled, false);
assert.equal(dashboardSummary.financialImpactClaimed, false);
assert.equal(dashboardSummary.decisionSupportOnly, true);
assert.equal(dashboardSummary.posture, 'attention-needed');

const performanceSamples =
  cryptoCore.cryptoAuthorizationCore.intelligencePerformanceBudget
    .CRYPTO_INTELLIGENCE_PERFORMANCE_OPERATION_KINDS.flatMap((operationKind) =>
      [1, 2, 3, 4, 5].map((durationMs, iteration) => ({
        operationKind,
        durationMs,
        iteration,
      })),
    );
const performanceBenchmark =
  cryptoCore.cryptoAuthorizationCore.intelligencePerformanceBudget
    .createCryptoIntelligencePerformanceBenchmark({
      generatedAt: '2026-05-11T12:20:00.000Z',
      environmentRef: 'package-surface:performance',
      samples: performanceSamples,
    });
assert.equal(performanceBenchmark.status, 'pass');
assert.equal(performanceBenchmark.rawBenchmarkInputsStored, false);
assert.equal(performanceBenchmark.failClosedOnBudgetExceeded, true);

console.log('crypto-authorization-core package surface probe passed');
