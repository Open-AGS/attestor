import assert from 'node:assert/strict';
import {
  CRYPTO_NARROWING_CANDIDATE_KINDS,
  CRYPTO_NARROWING_SCOPE_KINDS,
  CRYPTO_POLICY_COVERAGE_SOURCE_KINDS,
  CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES,
  CRYPTO_POLICY_GAP_CLASSES,
  CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
  createCryptoPolicyCoverageProfile,
  createCryptoPolicyGapNarrowingAssessment,
  cryptoPolicyGapNarrowingDescriptor,
  cryptoPolicyGapNarrowingLabel,
} from '../src/crypto-authorization-core/policy-gap-narrowing.js';
import {
  createCryptoIntelligenceRiskSignalAssessment,
} from '../src/crypto-authorization-core/intelligence-risk-signals.js';
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

function fixtureChain() {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId: '1',
  });
}

function fixtureAccount(accountKind: Parameters<typeof createCryptoAccountReference>[0]['accountKind'] = 'eoa') {
  return createCryptoAccountReference({
    accountKind,
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

function fixtureCounterparty(counterpartyKind: Parameters<typeof createCryptoCanonicalCounterpartyReference>[0]['counterpartyKind'] = 'account') {
  return createCryptoCanonicalCounterpartyReference({
    counterpartyKind,
    counterpartyId: `${counterpartyKind}:main`,
    chain: fixtureChain(),
  });
}

function candidateKinds(
  assessment: ReturnType<typeof createCryptoPolicyGapNarrowingAssessment>,
): readonly string[] {
  return assessment.candidates.map((candidate) => candidate.kind);
}

function gapClasses(
  assessment: ReturnType<typeof createCryptoPolicyGapNarrowingAssessment>,
): readonly string[] {
  return assessment.gaps.map((gap) => gap.gapClass);
}

function testDescriptorVocabulary(): void {
  const descriptor = cryptoPolicyGapNarrowingDescriptor();

  equal(
    descriptor.version,
    CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
    'crypto policy gap narrowing: descriptor exposes version',
  );
  deepEqual(
    descriptor.gapClasses,
    CRYPTO_POLICY_GAP_CLASSES,
    'crypto policy gap narrowing: descriptor exposes gap classes',
  );
  deepEqual(
    descriptor.candidateKinds,
    CRYPTO_NARROWING_CANDIDATE_KINDS,
    'crypto policy gap narrowing: descriptor exposes candidate kinds',
  );
  deepEqual(
    descriptor.scopeKinds,
    CRYPTO_NARROWING_SCOPE_KINDS,
    'crypto policy gap narrowing: descriptor exposes scope kinds',
  );
  deepEqual(
    descriptor.policyCoverageStatuses,
    CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES,
    'crypto policy gap narrowing: descriptor exposes policy coverage statuses',
  );
  deepEqual(
    descriptor.policyCoverageSourceKinds,
    CRYPTO_POLICY_COVERAGE_SOURCE_KINDS,
    'crypto policy gap narrowing: descriptor exposes policy coverage source kinds',
  );
  equal(descriptor.approvalRequired, true, 'crypto policy gap narrowing: descriptor requires approval');
  equal(descriptor.autoApply, false, 'crypto policy gap narrowing: descriptor blocks auto-apply');
  equal(descriptor.explicitDenyWins, true, 'crypto policy gap narrowing: explicit deny wins');
  equal(descriptor.implicitDenyFailsClosed, true, 'crypto policy gap narrowing: implicit deny fails closed');
}

function testAllowanceGapProducesSafeNarrowingWithoutThresholdLeak(): void {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'approval',
    account: fixtureAccount(),
    asset: fixtureAsset(),
    amount: {
      isUnlimitedApproval: true,
    },
    counterparty: fixtureCounterparty('contract'),
    context: {
      hasRevocationPath: false,
      hasExpiry: false,
    },
  });
  const signals = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
    context: {
      allowance: {
        isUnlimitedApproval: true,
        hasRevocationPath: false,
        hasExpiry: false,
        spenderKnown: true,
      },
    },
  });
  const assessment = createCryptoPolicyGapNarrowingAssessment({
    signalAssessment: signals,
    generatedAt: '2026-05-11T11:45:00.000Z',
    policyRef: 'policy:crypto:allowance',
  });

  equal(assessment.version, CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION, 'crypto policy gap narrowing: version is stable');
  equal(assessment.approvalRequired, true, 'crypto policy gap narrowing: approval is required');
  equal(assessment.autoApply, false, 'crypto policy gap narrowing: auto apply is blocked');
  equal(assessment.rawPolicyThresholdExposed, false, 'crypto policy gap narrowing: private thresholds are not exposed');
  ok(gapClasses(assessment).includes('allowance-boundary-unsafe'), 'crypto policy gap narrowing: allowance gap is produced');
  ok(candidateKinds(assessment).includes('bind-revocation-path'), 'crypto policy gap narrowing: revocation candidate is produced');
  ok(
    assessment.candidates.every((candidate) => candidate.modelFeedback.safeInstruction.length > 0),
    'crypto policy gap narrowing: every candidate has model-safe instruction',
  );
  ok(
    !assessment.canonical.includes('100000') && !assessment.canonical.includes('threshold'),
    'crypto policy gap narrowing: canonical output avoids private threshold language',
  );
}

function testDelegationGapBlocksUntilEvidenceCanBeBound(): void {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'account-delegation',
    account: fixtureAccount(),
    context: {
      executionAdapterKind: 'eip-7702-delegation',
    },
  });
  const signals = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
    context: {
      delegation: {
        nonceFresh: false,
        delegateRevocationPath: false,
      },
      freshness: {
        evaluatedAt: '2026-05-11T11:45:00.000Z',
        evidenceCreatedAt: '2026-05-11T10:00:00.000Z',
        maxAgeSeconds: 60,
      },
    },
  });
  const assessment = createCryptoPolicyGapNarrowingAssessment({
    signalAssessment: signals,
    generatedAt: '2026-05-11T11:46:00.000Z',
  });

  equal(assessment.recommendedDisposition, 'block', 'crypto policy gap narrowing: unsafe delegation blocks');
  ok(gapClasses(assessment).includes('delegation-boundary-unsafe'), 'crypto policy gap narrowing: delegation gap is produced');
  ok(gapClasses(assessment).includes('freshness-window-missing'), 'crypto policy gap narrowing: freshness gap is produced');
  ok(candidateKinds(assessment).includes('bind-revocation-path'), 'crypto policy gap narrowing: delegation revocation candidate is produced');
  ok(candidateKinds(assessment).includes('shorten-validity-window'), 'crypto policy gap narrowing: freshness candidate is produced');
  ok(
    assessment.candidates.some((candidate) =>
      candidate.modelFeedback.missingEvidenceClasses.includes('delegation-authorization'),
    ),
    'crypto policy gap narrowing: model feedback names missing delegation evidence class',
  );
}

function testX402SolverAndRouteGapsProduceDigestOnlyCandidates(): void {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'agent-payment',
    account: fixtureAccount('agent-wallet'),
    asset: fixtureAsset(),
    amount: {
      assetAmount: '12.50',
      normalizedUsd: '12.50',
    },
    context: {
      executionAdapterKind: 'x402-payment',
      hasBudget: true,
      hasExpiry: true,
    },
  });
  const signals = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
    context: {
      x402: {
        paymentRequirementDigest: 'sha256:payment-requirement',
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
  const assessment = createCryptoPolicyGapNarrowingAssessment({
    signalAssessment: signals,
    generatedAt: '2026-05-11T11:47:00.000Z',
    operatorContextRef: 'operator-context:crypto-review',
  });

  ok(gapClasses(assessment).includes('payment-binding-missing'), 'crypto policy gap narrowing: payment binding gap is produced');
  ok(gapClasses(assessment).includes('solver-settlement-missing'), 'crypto policy gap narrowing: solver settlement gap is produced');
  ok(gapClasses(assessment).includes('route-boundary-unsafe'), 'crypto policy gap narrowing: route gap is produced');
  ok(candidateKinds(assessment).includes('bind-payment-proof'), 'crypto policy gap narrowing: payment proof candidate is produced');
  ok(candidateKinds(assessment).includes('bind-settlement-proof'), 'crypto policy gap narrowing: settlement proof candidate is produced');
  ok(candidateKinds(assessment).includes('bind-route-commitment'), 'crypto policy gap narrowing: route commitment candidate is produced');
  ok(
    !assessment.canonical.includes('PAYMENT-SIGNATURE') &&
      !assessment.canonical.includes('0x1111111111111111111111111111111111111111'),
    'crypto policy gap narrowing: canonical output avoids raw payment and wallet material',
  );
}

function testPolicyDimensionAndAllowedCandidateFiltering(): void {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'transfer',
    account: fixtureAccount(),
    asset: fixtureAsset(),
    amount: {
      assetAmount: '1',
      normalizedUsd: '1',
    },
  });
  const signals = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
  });
  const assessment = createCryptoPolicyGapNarrowingAssessment({
    signalAssessment: signals,
    generatedAt: '2026-05-11T11:48:00.000Z',
    allowedCandidateKinds: ['bind-counterparty-scope'],
  });

  ok(gapClasses(assessment).includes('counterparty-boundary-unsafe'), 'crypto policy gap narrowing: counterparty gap is produced');
  deepEqual(
    candidateKinds(assessment),
    ['bind-counterparty-scope'],
    'crypto policy gap narrowing: allowed candidate filter keeps only requested kind',
  );
}

function testVelocityGapAndDeterminism(): void {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'agent-payment',
    account: fixtureAccount(),
    asset: fixtureAsset(),
    amount: {
      assetAmount: '10',
      normalizedUsd: '10',
    },
  });
  const signals = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
    context: {
      velocity: {
        windowSeconds: 3600,
        operationCount: 20,
        normalizedUsd: '250000',
        distinctCounterparties: 10,
      },
    },
  });
  const left = createCryptoPolicyGapNarrowingAssessment({
    signalAssessment: signals,
    generatedAt: '2026-05-11T11:49:00.000Z',
  });
  const right = createCryptoPolicyGapNarrowingAssessment({
    generatedAt: '2026-05-11T11:49:00.000Z',
    signalAssessment: signals,
  });

  ok(gapClasses(left).includes('velocity-boundary-unsafe'), 'crypto policy gap narrowing: velocity gap is produced');
  ok(candidateKinds(left).includes('reduce-operation-count'), 'crypto policy gap narrowing: velocity narrowing candidate is produced');
  equal(left.digest, right.digest, 'crypto policy gap narrowing: digest is deterministic');
  equal(
    cryptoPolicyGapNarrowingLabel(left),
    `crypto-policy-gap-narrowing / disposition:${left.recommendedDisposition} / gaps:${left.gapCount} / candidates:${left.candidateCount}`,
    'crypto policy gap narrowing: label is stable',
  );
}

function testPolicyCoverageProfileAddsExplicitDenyImplicitDenyAndStaleGaps(): void {
  const profile = createCryptoPolicyCoverageProfile({
    generatedAt: '2026-05-11T11:51:00.000Z',
    scopeRef: 'policy-coverage:treasury',
    entries: [
      {
        dimension: 'amount',
        status: 'covered',
        sourceKind: 'policy-rule',
        sourceRef: 'policy-rule:amount-band',
        evidenceRefs: [{ kind: 'digest', value: 'sha256:amount-policy' }],
        observedAt: '2026-05-11T11:50:00.000Z',
        maxAgeSeconds: 600,
      },
      {
        dimension: 'counterparty',
        status: 'explicit-deny',
        sourceKind: 'policy-rule',
        sourceRef: 'policy-rule:counterparty-deny',
        reasonCodes: ['counterparty-denied'],
        evidenceRefs: [{ kind: 'digest', value: 'sha256:counterparty-policy' }],
      },
      {
        dimension: 'protocol',
        status: 'implicit-deny',
        sourceKind: 'scope-binding',
        sourceRef: 'scope-binding:protocol',
      },
      {
        dimension: 'budget',
        status: 'covered',
        sourceKind: 'operator-risk-input',
        sourceRef: 'operator-input:budget',
        observedAt: '2026-05-11T10:00:00.000Z',
        maxAgeSeconds: 60,
      },
      {
        dimension: 'approval-quorum',
        status: 'review-required',
        sourceKind: 'external-review',
        sourceRef: 'review:quorum',
      },
    ],
  });
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'transfer',
    account: fixtureAccount(),
    asset: fixtureAsset(),
    amount: {
      assetAmount: '25',
      normalizedUsd: '25',
    },
    counterparty: fixtureCounterparty(),
  });
  const signals = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
  });
  const assessment = createCryptoPolicyGapNarrowingAssessment({
    signalAssessment: signals,
    generatedAt: '2026-05-11T11:52:00.000Z',
    policyCoverageProfile: profile,
  });

  equal(profile.recommendedDisposition, 'block', 'policy coverage profile: deny and stale coverage block');
  equal(profile.coveredCount, 1, 'policy coverage profile: only fresh covered dimensions count as covered');
  equal(profile.blockCount, 3, 'policy coverage profile: explicit deny, implicit deny, and stale entries block');
  equal(profile.reviewCount, 1, 'policy coverage profile: review-required entries are counted');
  equal(profile.explicitDenyWins, true, 'policy coverage profile: explicit deny precedence is documented');
  equal(profile.implicitDenyFailsClosed, true, 'policy coverage profile: implicit deny fails closed');
  equal(profile.rawPolicyThresholdExposed, false, 'policy coverage profile: private thresholds are not exposed');
  ok(
    profile.reasonCodes.includes('policy-coverage-explicit-deny') &&
      profile.reasonCodes.includes('policy-coverage-implicit-deny') &&
      profile.reasonCodes.includes('policy-coverage-stale'),
    'policy coverage profile: reason codes preserve deny and stale posture',
  );
  ok(
    gapClasses(assessment).includes('policy-explicit-deny'),
    'crypto policy gap narrowing: explicit deny gap is produced',
  );
  ok(
    gapClasses(assessment).includes('policy-implicit-deny'),
    'crypto policy gap narrowing: implicit deny gap is produced',
  );
  ok(
    gapClasses(assessment).includes('policy-evidence-stale'),
    'crypto policy gap narrowing: stale policy evidence gap is produced',
  );
  ok(
    gapClasses(assessment).includes('authority-review-required'),
    'crypto policy gap narrowing: review-required policy coverage creates review gap',
  );
  ok(
    candidateKinds(assessment).includes('block-until-policy'),
    'crypto policy gap narrowing: deny/conflict coverage blocks until policy changes',
  );
  ok(
    candidateKinds(assessment).includes('collect-evidence'),
    'crypto policy gap narrowing: stale coverage asks for fresh evidence',
  );
  equal(
    assessment.policyCoverageProfileDigest,
    profile.digest,
    'crypto policy gap narrowing: assessment binds policy coverage profile digest',
  );
  ok(
    !assessment.canonical.includes('private-limit') &&
      !assessment.canonical.includes('internal-threshold-value'),
    'crypto policy gap narrowing: policy coverage canonical output avoids private policy internals',
  );
}

function testInvalidInputsFailClosed(): void {
  const risk = createCryptoConsequenceRiskAssessment({
    consequenceKind: 'agent-payment',
    account: fixtureAccount(),
    asset: fixtureAsset(),
    amount: {
      assetAmount: '10',
      normalizedUsd: '10',
    },
  });
  const signals = createCryptoIntelligenceRiskSignalAssessment({
    riskAssessment: risk,
  });

  assert.throws(
    () =>
      createCryptoPolicyGapNarrowingAssessment({
        signalAssessment: signals,
        generatedAt: 'not-a-date',
      }),
    /ISO timestamp/i,
  );
  passed += 1;

  assert.throws(
    () =>
      createCryptoPolicyGapNarrowingAssessment({
        signalAssessment: signals,
        generatedAt: '2026-05-11T11:50:00.000Z',
        policyRef: 'policy with spaces',
      }),
    /compact scoped reference/i,
  );
  passed += 1;

  assert.throws(
    () =>
      createCryptoPolicyGapNarrowingAssessment({
        signalAssessment: signals,
        generatedAt: '2026-05-11T11:50:00.000Z',
        allowedCandidateKinds: ['unknown-kind' as never],
      }),
    /does not support candidate kind/i,
  );
  passed += 1;

  assert.throws(
    () =>
      createCryptoPolicyCoverageProfile({
        generatedAt: '2026-05-11T11:50:00.000Z',
        entries: [
          {
            dimension: 'unknown-dimension' as never,
            status: 'covered',
            sourceKind: 'policy-rule',
          },
        ],
      }),
    /does not support policy dimension/i,
  );
  passed += 1;

  assert.throws(
    () =>
      createCryptoPolicyCoverageProfile({
        generatedAt: '2026-05-11T11:50:00.000Z',
        entries: [
          {
            dimension: 'amount',
            status: 'covered',
            sourceKind: 'policy-rule',
            observedAt: '2026-05-11T11:51:00.000Z',
            maxAgeSeconds: 60,
          },
        ],
      }),
    /observedAt cannot be after generatedAt/i,
  );
  passed += 1;
}

testDescriptorVocabulary();
testAllowanceGapProducesSafeNarrowingWithoutThresholdLeak();
testDelegationGapBlocksUntilEvidenceCanBeBound();
testX402SolverAndRouteGapsProduceDigestOnlyCandidates();
testPolicyDimensionAndAllowedCandidateFiltering();
testVelocityGapAndDeterminism();
testPolicyCoverageProfileAddsExplicitDenyImplicitDenyAndStaleGaps();
testInvalidInputsFailClosed();

console.log(`Crypto authorization core policy-gap narrowing tests: ${passed} passed, 0 failed`);
