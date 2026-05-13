import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  CRYPTO_INTELLIGENCE_DASHBOARD_ATTENTION_KINDS,
  CRYPTO_INTELLIGENCE_DASHBOARD_PRIORITY_TIERS,
  CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS,
  CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION,
  CRYPTO_INTELLIGENCE_DASHBOARD_TILE_KINDS,
  CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS,
  createCryptoIntelligenceDashboardSummary,
  cryptoIntelligenceDashboardSummaryDescriptor,
  cryptoIntelligenceDashboardSummaryLabel,
} from '../src/crypto-authorization-core/intelligence-dashboard-summary.js';
import {
  createCryptoIntelligenceRiskSignalAssessment,
} from '../src/crypto-authorization-core/intelligence-risk-signals.js';
import {
  createCryptoPolicyCoverageProfile,
  createCryptoPolicyGapNarrowingAssessment,
  createCryptoPolicyIntelligenceRoutingProfile,
} from '../src/crypto-authorization-core/policy-gap-narrowing.js';
import {
  createCryptoOperatorRiskInputBundle,
  type CryptoOperatorRiskInput,
} from '../src/crypto-authorization-core/operator-risk-input-contract.js';
import {
  createCryptoConsequenceRiskAssessment,
} from '../src/crypto-authorization-core/consequence-risk-mapping.js';
import {
  createCryptoCanonicalCounterpartyReference,
} from '../src/crypto-authorization-core/canonical-references.js';
import {
  createCryptoAccountReference,
  createCryptoAssetReference,
  createCryptoChainReference,
} from '../src/crypto-authorization-core/types.js';

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

function riskSignalsFixture() {
  const risk = createCryptoConsequenceRiskAssessment({
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

  return createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
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
    inputId: 'risk-input:counterparty:high',
    inputClass: 'counterparty-risk',
    riskTier: 'high',
    source: {
      sourceKind: 'third-party-provider',
      providerRef: 'provider:screening:test',
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
      {
        kind: 'dataset-version',
        value: 'dataset-version:2026-05-11',
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

function testDescriptor(): void {
  const descriptor = cryptoIntelligenceDashboardSummaryDescriptor();

  equal(
    descriptor.version,
    CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION,
    'crypto dashboard summary: descriptor exposes version',
  );
  deepEqual(
    descriptor.widgets,
    CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS,
    'crypto dashboard summary: descriptor exposes widgets',
  );
  deepEqual(
    descriptor.tileKinds,
    CRYPTO_INTELLIGENCE_DASHBOARD_TILE_KINDS,
    'crypto dashboard summary: descriptor exposes tiles',
  );
  deepEqual(
    descriptor.attentionKinds,
    CRYPTO_INTELLIGENCE_DASHBOARD_ATTENTION_KINDS,
    'crypto dashboard summary: descriptor exposes attention kinds',
  );
  deepEqual(
    descriptor.proofLinkKinds,
    CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS,
    'crypto dashboard summary: descriptor exposes proof link kinds',
  );
  deepEqual(
    descriptor.priorityTiers,
    CRYPTO_INTELLIGENCE_DASHBOARD_PRIORITY_TIERS,
    'crypto dashboard summary: descriptor exposes priority tiers',
  );
  ok(
    descriptor.widgets.includes('priority-queue') &&
      descriptor.widgets.includes('readiness-heatmap') &&
      descriptor.widgets.includes('top-blockers'),
    'crypto dashboard summary: descriptor exposes proof-console hardening widgets',
  );
  ok(
    descriptor.proofLinkKinds.includes('policy-intelligence-routing'),
    'crypto dashboard summary: descriptor exposes policy routing proof links',
  );
  equal(
    descriptor.topBlockersAvailable,
    true,
    'crypto dashboard summary: descriptor exposes top blocker queue',
  );
  equal(
    descriptor.readinessHeatmapAvailable,
    true,
    'crypto dashboard summary: descriptor exposes readiness heatmap',
  );
  equal(
    descriptor.rawPayloadDrilldownEnabled,
    false,
    'crypto dashboard summary: descriptor blocks raw drilldown',
  );
  equal(
    descriptor.financialImpactClaimed,
    false,
    'crypto dashboard summary: descriptor blocks financial impact claims',
  );
}

function testDashboardAggregatesCryptoIntelligenceWithoutRawDrilldown(): void {
  const signals = riskSignalsFixture();
  const gaps = createCryptoPolicyGapNarrowingAssessment({
    signalAssessment: signals,
    generatedAt: '2026-05-11T12:00:00.000Z',
    operatorContextRef: 'operator-context:crypto-review',
  });
  const policyCoverage = createCryptoPolicyCoverageProfile({
    generatedAt: '2026-05-11T12:00:00.000Z',
    scopeRef: 'policy-coverage:dashboard',
    entries: [
      {
        dimension: 'counterparty',
        status: 'explicit-deny',
        sourceKind: 'policy-rule',
        sourceRef: 'policy-rule:dashboard-deny',
        reasonCodes: ['counterparty-denied'],
        evidenceRefs: [{ kind: 'digest', value: digestFor('policy-routing:evidence') }],
      },
      {
        dimension: 'approval-quorum',
        status: 'review-required',
        sourceKind: 'external-review',
        sourceRef: 'review:approval-quorum',
      },
    ],
  });
  const policyRouting = createCryptoPolicyIntelligenceRoutingProfile({
    coverageProfile: policyCoverage,
  });
  const operatorRisk = createCryptoOperatorRiskInputBundle({
    generatedAt: '2026-05-11T12:00:00.000Z',
    scopeRef: 'crypto-intelligence:dashboard',
    inputs: [operatorRiskInputFixture()],
  });
  const summary = createCryptoIntelligenceDashboardSummary({
    generatedAt: '2026-05-11T12:10:00.000Z',
    summaryId: 'crypto-dashboard:step-08',
    scopeRef: 'crypto-intelligence:step-08',
    signalAssessments: [signals],
    policyGapAssessments: [gaps],
    policyIntelligenceRoutingProfiles: [policyRouting],
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
      {
        surface: 'wallet-rpc',
        adapterKind: 'wallet-call-api',
        status: 'ready',
        sourceDigest: digestFor('readiness:wallet-rpc'),
      },
    ],
    proofLinks: [
      {
        kind: 'privacy-minimization',
        label: 'privacy minimization gate',
        digest: digestFor('privacy-minimization:step-08'),
        route: '/crypto-intelligence/dashboard/privacy',
      },
    ],
    routeBase: '/crypto-intelligence/dashboard',
  });

  equal(summary.version, CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION, 'crypto dashboard summary: version is stable');
  equal(summary.posture, 'blocked-for-review', 'crypto dashboard summary: blockers route to review');
  equal(summary.overview.signalAssessmentCount, 1, 'crypto dashboard summary: signal assessments are counted');
  equal(summary.overview.policyGapAssessmentCount, 1, 'crypto dashboard summary: policy gap assessments are counted');
  equal(summary.overview.policyRoutingProfileCount, 1, 'crypto dashboard summary: policy routing profiles are counted');
  equal(summary.overview.blockedPolicyRoutingCount, 1, 'crypto dashboard summary: blocked policy routing profiles are counted');
  equal(summary.overview.operatorRiskInputCount, 1, 'crypto dashboard summary: operator risk inputs are counted');
  equal(summary.readinessCoverage.totalEntries, 3, 'crypto dashboard summary: readiness entries are counted');
  equal(summary.readinessCoverage.readyCount, 1, 'crypto dashboard summary: ready readiness count is tracked');
  equal(summary.readinessCoverage.blockedCount, 1, 'crypto dashboard summary: blocked readiness count is tracked');
  equal(summary.readinessCoverage.readyCoveragePercent, 33, 'crypto dashboard summary: readiness coverage is rounded');
  equal(
    summary.readinessCoverage.heatmapRows[0]?.status,
    'blocked',
    'crypto dashboard summary: readiness heatmap prioritizes blocked rows',
  );
  equal(
    summary.readinessCoverage.heatmapRows[0]?.priorityTier,
    'blocker',
    'crypto dashboard summary: readiness heatmap marks blocked rows as blockers',
  );
  equal(
    summary.readinessCoverage.heatmapRows[0]?.readinessScore,
    0,
    'crypto dashboard summary: readiness heatmap gives blocked rows zero score',
  );
  ok(
    summary.topSurfaces.some((row) => row.surface === 'x402' || row.surface === 'x402-resource-server'),
    'crypto dashboard summary: top surfaces include payment or readiness surfaces',
  );
  ok(
    summary.topFailureReasons.some((row) =>
      row.reasonCode === 'x402-payment-signature-missing' ||
      row.reasonCode === 'payment-binding-missing',
    ),
    'crypto dashboard summary: top failure reasons include payment binding blockers',
  );
  ok(
    summary.attentionItems.some((item) =>
      item.kind === 'adapter-readiness-gap' &&
      item.reasonCodes.includes('solver-settlement-preflight-missing'),
    ),
    'crypto dashboard summary: readiness attention includes readiness reason codes',
  );
  equal(
    summary.topBlockers[0]?.rank,
    1,
    'crypto dashboard summary: top blockers are ranked',
  );
  equal(
    summary.topBlockers[0]?.priorityTier,
    'blocker',
    'crypto dashboard summary: top blockers expose priority tier',
  );
  ok(
    summary.topBlockers.some((item) =>
      item.kind === 'policy-routing-blocker' &&
      item.reasonCodes.includes('block-explicit-deny'),
    ),
    'crypto dashboard summary: top blockers include policy routing blockers',
  );
  ok(
    summary.topFailureReasons.some((row) =>
      row.sourceKind === 'policy-routing' &&
      row.reasonCode === 'block-explicit-deny',
    ),
    'crypto dashboard summary: top failure reasons include policy routing route codes',
  );
  ok(
    summary.missingEvidenceClasses.some((row) => row.evidenceClass === 'x402-payment-signature'),
    'crypto dashboard summary: missing evidence includes x402 signature',
  );
  ok(
    summary.missingEvidenceClasses.some((row) => row.evidenceClass === 'solver-settlement-preflight'),
    'crypto dashboard summary: missing evidence includes solver settlement preflight',
  );
  ok(
    summary.proofLinks.some((link) => link.kind === 'risk-signal-assessment' && link.digest === signals.digest),
    'crypto dashboard summary: proof links include risk signal assessment digest',
  );
  ok(
    summary.proofLinks.some((link) => link.kind === 'policy-gap-narrowing' && link.digest === gaps.digest),
    'crypto dashboard summary: proof links include policy gap digest',
  );
  ok(
    summary.proofLinks.some((link) =>
      link.kind === 'policy-intelligence-routing' &&
      link.digest === policyRouting.digest,
    ),
    'crypto dashboard summary: proof links include policy routing digest',
  );
  equal(summary.decisionSupportOnly, true, 'crypto dashboard summary: summary is decision support only');
  equal(summary.autoEnforce, false, 'crypto dashboard summary: summary cannot auto-enforce');
  equal(summary.complianceClaimed, false, 'crypto dashboard summary: summary makes no compliance claim');
  equal(summary.financialImpactClaimed, false, 'crypto dashboard summary: summary makes no financial impact claim');
  equal(summary.rawPayloadStored, false, 'crypto dashboard summary: raw payload storage is disabled');
  equal(summary.rawPayloadDrilldownEnabled, false, 'crypto dashboard summary: raw payload drilldown is disabled');
  ok(summary.digest.startsWith('sha256:'), 'crypto dashboard summary: summary digest is canonical');
  ok(
    !summary.canonical.includes('0x1111111111111111111111111111111111111111') &&
      !summary.canonical.includes('PAYMENT-SIGNATURE') &&
      !summary.canonical.includes('provider-secret') &&
      !summary.canonical.includes('private-policy-threshold'),
    'crypto dashboard summary: canonical output avoids raw wallet, payment, and provider material',
  );
  equal(
    cryptoIntelligenceDashboardSummaryLabel(summary),
    `crypto-intelligence-dashboard / posture:${summary.posture} / signals:${summary.overview.riskSignalCount} / gaps:${summary.overview.policyGapCount} / readiness:${summary.readinessCoverage.readyCoveragePercent}`,
    'crypto dashboard summary: label is stable',
  );
}

function testEmptyDashboardFailsIntoReviewWithoutInventedImpact(): void {
  const summary = createCryptoIntelligenceDashboardSummary({
    generatedAt: '2026-05-11T12:15:00.000Z',
    scopeRef: 'crypto-intelligence:empty-dashboard',
  });

  equal(summary.posture, 'attention-needed', 'crypto dashboard summary: no signals needs attention');
  equal(summary.overview.riskSignalCount, 0, 'crypto dashboard summary: no risk signals are invented');
  equal(summary.readinessCoverage.readyCoveragePercent, 0, 'crypto dashboard summary: no readiness coverage is invented');
  equal(summary.financialImpactClaimed, false, 'crypto dashboard summary: empty dashboard makes no impact claim');
  ok(
    summary.attentionItems.some((item) => item.kind === 'risk-signal-assessment-missing'),
    'crypto dashboard summary: missing risk signal attention item is present',
  );
}

function testValidationRejectsUnsafeProofSurfaces(): void {
  const repeatedSlashSuffix = '/'.repeat(10_000);
  const normalizedSlashSummary = createCryptoIntelligenceDashboardSummary({
    generatedAt: '2026-05-11T12:19:00.000Z',
    scopeRef: 'crypto-intelligence:slash-normalization',
    signalAssessments: [riskSignalsFixture()],
    routeBase: `/crypto-intelligence/dashboard${repeatedSlashSuffix}`,
    proofLinks: [
      {
        kind: 'privacy-minimization',
        label: 'slash normalized route',
        digest: digestFor('slash-normalized-route'),
        route: repeatedSlashSuffix,
      },
    ],
  });

  ok(
    normalizedSlashSummary.proofLinks.some((link) =>
      link.label === 'slash normalized route' &&
      link.route === '/',
    ),
    'crypto dashboard summary: slash-only proof routes normalize without regex backtracking',
  );
  ok(
    normalizedSlashSummary.proofLinks.some((link) =>
      link.kind === 'risk-signal-assessment' &&
      link.route === '/crypto-intelligence/dashboard/risk-signals',
    ),
    'crypto dashboard summary: long slash route bases normalize before generated proof links',
  );

  assert.throws(
    () =>
      createCryptoIntelligenceDashboardSummary({
        generatedAt: '2026-05-11T12:20:00.000Z',
        scopeRef: 'crypto-intelligence:unsafe-route',
        proofLinks: [
          {
            kind: 'risk-signal-assessment',
            label: 'unsafe raw route',
            digest: digestFor('unsafe-route'),
            route: '/crypto-intelligence/raw-payload',
          },
        ],
      }),
    /raw-data drilldown routes/i,
    'crypto dashboard summary: raw proof drilldown routes are rejected',
  );
  passed += 1;

  assert.throws(
    () =>
      createCryptoIntelligenceDashboardSummary({
        generatedAt: '2026-05-11T12:21:00.000Z',
        scopeRef: 'crypto-intelligence:bad-digest',
        proofLinks: [
          {
            kind: 'risk-signal-assessment',
            label: 'bad digest',
            digest: 'sha256:not-real',
          },
        ],
      }),
    /sha256 digest/i,
    'crypto dashboard summary: malformed proof digests are rejected',
  );
  passed += 1;
}

testDescriptor();
testDashboardAggregatesCryptoIntelligenceWithoutRawDrilldown();
testEmptyDashboardFailsIntoReviewWithoutInventedImpact();
testValidationRejectsUnsafeProofSurfaces();

console.log(`Crypto authorization core intelligence dashboard summary tests: ${passed} passed, 0 failed`);
