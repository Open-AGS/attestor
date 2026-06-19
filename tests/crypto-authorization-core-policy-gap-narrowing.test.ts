import {
  CRYPTO_NARROWING_CANDIDATE_KINDS,
  CRYPTO_NARROWING_SCOPE_KINDS,
  CRYPTO_POLICY_COVERAGE_SOURCE_KINDS,
  CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES,
  CRYPTO_POLICY_GAP_CLASSES,
  CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
  CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS,
  CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS,
  CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
  createCryptoPolicyCoverageProfile,
  createCryptoPolicyGapNarrowingAssessment,
  createCryptoPolicyIntelligenceRoutingProfile,
  cryptoPolicyGapNarrowingDescriptor,
  cryptoPolicyIntelligenceRoutingDescriptor,
  cryptoPolicyGapNarrowingLabel,
} from '../src/crypto-authorization-core/policy-gap-narrowing.js';
import {
  createCryptoIntelligenceRiskSignalAssessment,
} from '../src/crypto-authorization-core/intelligence-risk-signals.js';
import {
  createCryptoConsequenceRiskAssessment,
} from '../src/crypto-authorization-core/consequence-risk-mapping.js';
import {
  candidateKinds,
  deepEqual,
  equal,
  fixtureAccount,
  fixtureAsset,
  fixtureCounterparty,
  gapClasses,
  ok,
  passedCount,
  throws,
} from './crypto-authorization-core-policy-gap-narrowing-fixtures.js';

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
  equal(
    descriptor.policyIntelligenceRoutingVersion,
    CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    'crypto policy gap narrowing: descriptor exposes policy intelligence routing version',
  );
  deepEqual(
    descriptor.policyIntelligenceRouteKinds,
    CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS,
    'crypto policy gap narrowing: descriptor exposes policy intelligence route kinds',
  );
  deepEqual(
    descriptor.policyIntelligenceOperatorActions,
    CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS,
    'crypto policy gap narrowing: descriptor exposes policy intelligence operator actions',
  );
  equal(descriptor.approvalRequired, true, 'crypto policy gap narrowing: descriptor requires approval');
  equal(descriptor.autoApply, false, 'crypto policy gap narrowing: descriptor blocks auto-apply');
  equal(descriptor.explicitDenyWins, true, 'crypto policy gap narrowing: explicit deny wins');
  equal(descriptor.implicitDenyFailsClosed, true, 'crypto policy gap narrowing: implicit deny fails closed');
  equal(
    descriptor.conflictResolutionRequired,
    true,
    'crypto policy gap narrowing: policy conflicts require operator resolution',
  );
  equal(
    descriptor.stalePolicyMustRefresh,
    true,
    'crypto policy gap narrowing: stale policy evidence must refresh',
  );

  const routingDescriptor = cryptoPolicyIntelligenceRoutingDescriptor();
  equal(
    routingDescriptor.version,
    CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    'crypto policy routing: descriptor exposes version',
  );
  ok(
    routingDescriptor.routeKinds.includes('block-explicit-deny') &&
      routingDescriptor.routeKinds.includes('block-policy-conflict'),
    'crypto policy routing: descriptor exposes terminal and conflict routes',
  );
  ok(
    routingDescriptor.operatorActions.includes('refresh-policy-evidence'),
    'crypto policy routing: descriptor exposes stale evidence operator action',
  );
  equal(
    routingDescriptor.rawPayloadStored,
    false,
    'crypto policy routing: descriptor rejects raw payload storage',
  );
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

function testPolicyIntelligenceRoutingProfilePrecedenceAndPrivacy(): void {
  const profile = createCryptoPolicyCoverageProfile({
    generatedAt: '2026-05-11T11:55:00.000Z',
    scopeRef: 'policy-coverage:treasury-routing',
    entries: [
      {
        dimension: 'counterparty',
        status: 'conflicting',
        sourceKind: 'policy-rule',
        sourceRef: 'policy-rule:counterparty-conflict',
        reasonCodes: ['counterparty-policy-conflict'],
      },
      {
        dimension: 'protocol',
        status: 'explicit-deny',
        sourceKind: 'policy-rule',
        sourceRef: 'policy-rule:protocol-deny',
        evidenceRefs: [{ kind: 'digest', value: 'sha256:protocol-policy' }],
      },
      {
        dimension: 'budget',
        status: 'covered',
        sourceKind: 'operator-risk-input',
        observedAt: '2026-05-11T11:00:00.000Z',
        maxAgeSeconds: 60,
      },
      {
        dimension: 'approval-quorum',
        status: 'review-required',
        sourceKind: 'external-review',
        sourceRef: 'review:approval-quorum',
      },
      {
        dimension: 'runtime-context',
        status: 'implicit-deny',
        sourceKind: 'scope-binding',
        sourceRef: 'scope-binding:route',
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
    generatedAt: '2026-05-11T11:56:00.000Z',
    policyCoverageProfile: profile,
  });
  const routing = createCryptoPolicyIntelligenceRoutingProfile({
    coverageProfile: profile,
    policyGapAssessment: assessment,
  });

  equal(
    routing.version,
    CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    'crypto policy routing: version is stable',
  );
  equal(
    routing.coverageProfileDigest,
    profile.digest,
    'crypto policy routing: binds coverage profile digest',
  );
  equal(
    routing.policyGapAssessmentDigest,
    assessment.digest,
    'crypto policy routing: binds gap assessment digest',
  );
  equal(
    routing.recommendedDisposition,
    'block',
    'crypto policy routing: deny, conflict, implicit deny, and stale evidence block',
  );
  equal(
    routing.dominantRouteKind,
    'block-explicit-deny',
    'crypto policy routing: explicit deny dominates other block routes',
  );
  equal(
    routing.routeCounts['block-policy-conflict'],
    1,
    'crypto policy routing: conflict route is counted',
  );
  equal(
    routing.routeCounts['block-stale-policy'],
    1,
    'crypto policy routing: stale policy route is counted',
  );
  equal(
    routing.routeCounts['block-implicit-deny'],
    1,
    'crypto policy routing: implicit deny route is counted',
  );
  equal(
    routing.routeCounts['review-required'],
    1,
    'crypto policy routing: review route is counted',
  );
  equal(
    routing.topBlockers[0]?.routeKind,
    'block-explicit-deny',
    'crypto policy routing: top blocker preserves deny precedence',
  );
  ok(
    routing.reviewDimensions.includes('approval-quorum'),
    'crypto policy routing: review dimensions are preserved',
  );
  equal(routing.explicitDenyWins, true, 'crypto policy routing: explicit deny wins');
  equal(routing.implicitDenyFailsClosed, true, 'crypto policy routing: implicit deny fails closed');
  equal(
    routing.conflictResolutionRequired,
    true,
    'crypto policy routing: conflicts require operator resolution',
  );
  equal(
    routing.stalePolicyMustRefresh,
    true,
    'crypto policy routing: stale policy must refresh',
  );
  equal(
    routing.rawPolicyThresholdExposed,
    false,
    'crypto policy routing: private thresholds are not exposed',
  );
  ok(
    !routing.canonical.includes('internal-threshold-value') &&
      !routing.canonical.includes('0x1111111111111111111111111111111111111111'),
    'crypto policy routing: canonical output avoids raw policy and wallet material',
  );
}

function testPolicyIntelligenceRoutingReviewOnlyPath(): void {
  const profile = createCryptoPolicyCoverageProfile({
    generatedAt: '2026-05-11T11:57:00.000Z',
    scopeRef: 'policy-coverage:review-only',
    entries: [
      {
        dimension: 'approval-quorum',
        status: 'review-required',
        sourceKind: 'external-review',
        sourceRef: 'review:manual-approval',
      },
    ],
  });
  const routing = createCryptoPolicyIntelligenceRoutingProfile({
    coverageProfile: profile,
  });

  equal(
    routing.recommendedDisposition,
    'review',
    'crypto policy routing: review-only policy coverage routes to review',
  );
  equal(
    routing.dominantRouteKind,
    'review-required',
    'crypto policy routing: review-only route is dominant without blockers',
  );
  equal(
    routing.blockRouteCount,
    0,
    'crypto policy routing: review-only route does not count as block',
  );
  ok(
    routing.modelSafeSummary.includes('routes to review'),
    'crypto policy routing: review-only summary is model-safe',
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

  throws(
    () =>
      createCryptoPolicyGapNarrowingAssessment({
        signalAssessment: signals,
        generatedAt: 'not-a-date',
    }),
    /ISO timestamp/i,
  );

  throws(
    () =>
      createCryptoPolicyGapNarrowingAssessment({
        signalAssessment: signals,
        generatedAt: '2026-05-11T11:50:00.000Z',
        policyRef: 'policy with spaces',
    }),
    /compact scoped reference/i,
  );

  throws(
    () =>
      createCryptoPolicyGapNarrowingAssessment({
        signalAssessment: signals,
        generatedAt: '2026-05-11T11:50:00.000Z',
        allowedCandidateKinds: ['unknown-kind' as never],
    }),
    /does not support candidate kind/i,
  );

  throws(
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

  throws(
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

  const coverageProfile = createCryptoPolicyCoverageProfile({
    generatedAt: '2026-05-11T11:50:00.000Z',
    entries: [
      {
        dimension: 'counterparty',
        status: 'explicit-deny',
        sourceKind: 'policy-rule',
      },
    ],
  });
  const differentCoverageProfile = createCryptoPolicyCoverageProfile({
    generatedAt: '2026-05-11T11:50:00.000Z',
    entries: [
      {
        dimension: 'asset',
        status: 'explicit-deny',
        sourceKind: 'policy-rule',
      },
    ],
  });
  const assessment = createCryptoPolicyGapNarrowingAssessment({
    signalAssessment: signals,
    generatedAt: '2026-05-11T11:50:00.000Z',
    policyCoverageProfile: coverageProfile,
  });

  throws(
    () =>
      createCryptoPolicyIntelligenceRoutingProfile({
        coverageProfile: differentCoverageProfile,
        policyGapAssessment: assessment,
    }),
    /same coverage profile digest/i,
  );
}

testDescriptorVocabulary();
testAllowanceGapProducesSafeNarrowingWithoutThresholdLeak();
testDelegationGapBlocksUntilEvidenceCanBeBound();
testX402SolverAndRouteGapsProduceDigestOnlyCandidates();
testPolicyDimensionAndAllowedCandidateFiltering();
testVelocityGapAndDeterminism();
testPolicyCoverageProfileAddsExplicitDenyImplicitDenyAndStaleGaps();
testPolicyIntelligenceRoutingProfilePrecedenceAndPrivacy();
testPolicyIntelligenceRoutingReviewOnlyPath();
testInvalidInputsFailClosed();

console.log(`Crypto authorization core policy-gap narrowing tests: ${passedCount()} passed, 0 failed`);
