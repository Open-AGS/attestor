import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createActionSurfaceGraph,
  createActiveQuestionEngine,
  createCanonicalShadowEvent,
  createCounterexampleReplayGenerator,
  createEvidenceStateModel,
  createPolicyCandidatePrContract,
  createPolicyTwinBacktest,
  policyTwinBacktestDescriptor,
  type CanonicalShadowEvent,
  type CanonicalShadowEventConsequenceClass,
  type CanonicalShadowEventSourceKind,
  type CounterexampleReplayGeneratorResult,
  type PolicyCandidatePrContract,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const tenantA = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const actorA = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const resourceA = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
const accountA = 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const evidenceA = 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const policyA = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const approvalA = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const receiptA = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const simulationA = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';
const replayA = 'sha256:5555555555555555555555555555555555555555555555555555555555555555';
const traceA = 'sha256:6666666666666666666666666666666666666666666666666666666666666666';
const schemaA = 'sha256:7777777777777777777777777777777777777777777777777777777777777777';
const questionA = 'sha256:9999999999999999999999999999999999999999999999999999999999999999';

function canonicalEvent(input: {
  readonly occurredAt: string;
  readonly sourceKind: CanonicalShadowEventSourceKind;
  readonly producer?: string;
  readonly targetSystem?: string;
  readonly actionName?: string;
  readonly observedConsequenceClass?: CanonicalShadowEventConsequenceClass | null;
  readonly inferredConsequenceClass?: CanonicalShadowEventConsequenceClass | null;
  readonly resourceRefDigest?: string | null;
  readonly policyRefs?: boolean;
  readonly evidenceRefs?: boolean;
  readonly approvalRefs?: boolean;
  readonly receiptRefs?: boolean;
  readonly simulationRefs?: boolean;
  readonly replayRefDigest?: string | null;
}): CanonicalShadowEvent {
  return createCanonicalShadowEvent({
    occurredAt: input.occurredAt,
    observedAt: input.occurredAt,
    sourceKind: input.sourceKind,
    producer: input.producer ?? 'attestor.policy-twin-backtest.test',
    tenantRefDigest: tenantA,
    actorRefDigest: actorA,
    observed: {
      targetSystem: input.targetSystem ?? 'refund-service',
      targetAccountRefDigest: accountA,
      actionName: input.actionName ?? 'issue_refund',
      actionKind: 'api-operation',
      consequenceClass: input.observedConsequenceClass ?? null,
      resourceRefDigest: input.resourceRefDigest ?? null,
      dataClass: 'money-movement',
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: input.inferredConsequenceClass === undefined
        ? 'financial'
        : input.inferredConsequenceClass,
      resourceRefDigest: null,
      dataClass: null,
      amountAssetChain: null,
      authorityDelta: null,
    },
    evidenceRefs: input.evidenceRefs
      ? [{ kind: 'evidence', digest: evidenceA, origin: 'observed' }]
      : [],
    policyRefs: input.policyRefs
      ? [{ kind: 'policy', digest: policyA, origin: 'observed' }]
      : [],
    approvalRefs: input.approvalRefs
      ? [{ kind: 'approval', digest: approvalA, origin: 'operator-supplied' }]
      : [],
    receiptRefs: input.receiptRefs
      ? [{ kind: 'receipt', digest: receiptA, origin: 'observed' }]
      : [],
    simulationRefs: input.simulationRefs
      ? [{ kind: 'simulation', digest: simulationA, origin: 'inferred' }]
      : [],
    replayRefDigest: input.replayRefDigest === undefined ? replayA : input.replayRefDigest,
    traceRefDigest: traceA,
    rawMaterialPolicy: 'digest-only',
  });
}

function buildChain(input: {
  readonly clean: boolean;
}): {
  readonly contract: PolicyCandidatePrContract;
  readonly counterexamples: CounterexampleReplayGeneratorResult;
} {
  const events = input.clean
    ? [
      canonicalEvent({
        occurredAt: '2026-05-17T08:00:00.000Z',
        sourceKind: 'admission-shadow',
        evidenceRefs: true,
        policyRefs: true,
        resourceRefDigest: resourceA,
      }),
      canonicalEvent({
        occurredAt: '2026-05-17T08:01:00.000Z',
        sourceKind: 'target-system-shadow',
        observedConsequenceClass: 'financial',
        inferredConsequenceClass: null,
        resourceRefDigest: resourceA,
        approvalRefs: true,
        receiptRefs: true,
        simulationRefs: true,
      }),
      canonicalEvent({
        occurredAt: '2026-05-17T08:02:00.000Z',
        sourceKind: 'integration-declaration',
        observedConsequenceClass: 'financial',
        inferredConsequenceClass: null,
        resourceRefDigest: resourceA,
      }),
    ]
    : [
      canonicalEvent({
        occurredAt: '2026-03-01T08:00:00.000Z',
        sourceKind: 'integration-declaration',
        producer: 'unreviewed.importer',
        targetSystem: 'crm-export',
        actionName: 'export_customer_data',
        resourceRefDigest: null,
        inferredConsequenceClass: 'data-movement',
        replayRefDigest: null,
      }),
    ];
  const graph = createActionSurfaceGraph({
    generatedAt: '2026-05-17T09:00:00.000Z',
    events,
  });
  const model = createEvidenceStateModel({
    graph,
    generatedAt: '2026-05-17T09:00:00.000Z',
    maxEvidenceAgeMs: 2 * 60 * 60 * 1000,
    trustedProducers: ['attestor.policy-twin-backtest.test'],
    approvedSurfaceIds: input.clean ? graph.surfaces.map((surface) => surface.surfaceId) : [],
  });
  const surface = model.surfaces[0];
  assert.ok(surface);
  const contract = createPolicyCandidatePrContract({
    evidenceStateModel: model,
    generatedAt: '2026-05-17T09:05:00.000Z',
    schemaDigest: schemaA,
    replayDigestBySurfaceId: input.clean
      ? { [surface.surfaceId]: replayA }
      : {},
    questionDigestsBySurfaceId: input.clean
      ? {}
      : { [surface.surfaceId]: [questionA] },
  });
  const activeQuestions = createActiveQuestionEngine({
    policyCandidatePrContract: contract,
    generatedAt: '2026-05-17T09:06:00.000Z',
    maxQuestions: 10,
  });
  const counterexamples = createCounterexampleReplayGenerator({
    policyCandidatePrContract: contract,
    activeQuestionEngine: activeQuestions,
    generatedAt: '2026-05-17T09:07:00.000Z',
  });
  return { contract, counterexamples };
}

function testBacktestPassesWhenHistoricalAndCounterexamplesHold(): void {
  const { contract, counterexamples } = buildChain({ clean: true });
  const result = createPolicyTwinBacktest({
    policyCandidatePrContract: contract,
    counterexampleReplayGenerator: counterexamples,
    generatedAt: '2026-05-17T09:08:00.000Z',
  });
  const serialized = JSON.stringify(result);

  equal(result.version, 'attestor.policy-twin-backtest.v1', 'Policy Twin backtest: version is explicit');
  equal(result.policyCandidatePrContractDigest, contract.digest, 'Policy Twin backtest: candidate PR digest is retained');
  equal(result.counterexampleReplayGeneratorDigest, counterexamples.digest, 'Policy Twin backtest: counterexample digest is retained');
  equal(result.tenantRefDigest, tenantA, 'Policy Twin backtest: tenant digest is retained');
  equal(result.status, 'backtest-passed', 'Policy Twin backtest: clean fixture set passes');
  equal(result.promotionBlocked, false, 'Policy Twin backtest: clean result does not block promotion');
  equal(result.candidateCount, 1, 'Policy Twin backtest: candidate count is retained');
  equal(result.candidateBacktestedCount, 1, 'Policy Twin backtest: backtested candidate is counted');
  equal(result.historicalEventCount, 3, 'Policy Twin backtest: historical source events are counted');
  equal(result.decisionImpact.historicalAdmitCount, 3, 'Policy Twin backtest: clean historical events would admit');
  equal(result.decisionImpact.falseAdmitRiskCount, 0, 'Policy Twin backtest: false-admit count is zero');
  equal(result.counterexampleOutcomeMismatchCount, 0, 'Policy Twin backtest: counterexample mismatches are zero');
  equal(result.reviewLoadImpact.manualReviewBaselineCount, 3, 'Policy Twin backtest: review baseline is manual review everything');
  equal(result.reviewLoadImpact.simulatedReviewCount, 0, 'Policy Twin backtest: simulated review count is retained');
  equal(result.reviewLoadImpact.reviewLoadDeltaCount, -3, 'Policy Twin backtest: review-load delta is explicit');
  equal(result.approvalRequired, true, 'Policy Twin backtest: approval remains required');
  equal(result.autoEnforce, false, 'Policy Twin backtest: backtest never auto-enforces');
  equal(result.activatesEnforcement, false, 'Policy Twin backtest: backtest cannot activate enforcement');
  equal(result.productionReady, false, 'Policy Twin backtest: production readiness is not claimed');
  equal(result.localReplayOnly, true, 'Policy Twin backtest: replay scope is local');
  equal(result.executesProductionTraffic, false, 'Policy Twin backtest: production traffic execution is false');
  equal(result.downstreamMutationAllowed, false, 'Policy Twin backtest: downstream mutation is false');
  equal(result.credentialUseAllowed, false, 'Policy Twin backtest: credential use is false');
  ok(result.fixtureResults.every((fixture) => fixture.outcomeMatched), 'Policy Twin backtest: all fixture outcomes match expected posture');
  ok(result.digest.startsWith('sha256:'), 'Policy Twin backtest: digest is generated');
  excludes(
    serialized,
    /unreviewed\.importer|raw_recipient_must_not_escape|private_threshold_must_not_escape/iu,
    'Policy Twin backtest: serialized output excludes raw producer and private markers',
  );
}

function testBacktestBlocksFalseAdmitCounterexample(): void {
  const { contract, counterexamples } = buildChain({ clean: true });
  const firstBlockingFixture = counterexamples.fixtures.find((fixture) =>
    fixture.expectedOutcome === 'block'
  );
  assert.ok(firstBlockingFixture);
  const result = createPolicyTwinBacktest({
    policyCandidatePrContract: contract,
    counterexampleReplayGenerator: counterexamples,
    generatedAt: '2026-05-17T09:08:00.000Z',
    fixtureOutcomes: [{
      fixtureDigest: firstBlockingFixture.fixtureDigest,
      actualOutcome: 'admit',
      evaluatorDigest: replayA,
    }],
  });

  equal(result.status, 'counterexamples-failed', 'Policy Twin backtest: admitted counterexample fails');
  equal(result.promotionBlocked, true, 'Policy Twin backtest: false admit blocks promotion');
  equal(result.falseAdmitRiskCount, 1, 'Policy Twin backtest: false admit risk is counted');
  ok(
    result.noGoReasons.includes('policy-twin-counterexample-false-admit'),
    'Policy Twin backtest: false admit no-go reason is retained',
  );
  ok(
    result.fixtureResults.some((fixture) => fixture.actualOutcome === 'admit' && fixture.falseAdmitRisk),
    'Policy Twin backtest: failing fixture carries false-admit marker',
  );
}

function testBacktestRequiresReviewForMissingEvidence(): void {
  const { contract, counterexamples } = buildChain({ clean: false });
  const result = createPolicyTwinBacktest({
    policyCandidatePrContract: contract,
    counterexampleReplayGenerator: counterexamples,
    generatedAt: '2026-05-17T09:08:00.000Z',
  });

  equal(result.status, 'review-required', 'Policy Twin backtest: missing evidence stays review-required');
  equal(result.promotionBlocked, true, 'Policy Twin backtest: review-required blocks promotion');
  ok(result.missedEvidenceCount > 0, 'Policy Twin backtest: missed evidence is counted');
  equal(result.unresolvedQuestionCount, 1, 'Policy Twin backtest: unresolved question digest is counted');
  equal(result.missingReplayDigestCount, 1, 'Policy Twin backtest: missing replay digest is counted');
  ok(
    result.noGoReasons.includes('policy-twin-missed-evidence'),
    'Policy Twin backtest: missed evidence no-go reason is retained',
  );
  ok(
    result.noGoReasons.includes('policy-twin-replay-digest-missing'),
    'Policy Twin backtest: missing replay no-go reason is retained',
  );
}

function testBacktestFailsClosedOnInvalidInputs(): void {
  const { contract, counterexamples } = buildChain({ clean: true });
  const firstFixture = counterexamples.fixtures[0];
  assert.ok(firstFixture);

  throws(
    () => createPolicyTwinBacktest({
      policyCandidatePrContract: contract,
      counterexampleReplayGenerator: counterexamples,
      generatedAt: 'not-a-date',
    }),
    /generatedAt must be an ISO timestamp/u,
    'Policy Twin backtest: invalid generatedAt fails closed',
  );
  throws(
    () => createPolicyTwinBacktest({
      policyCandidatePrContract: contract,
      counterexampleReplayGenerator: {
        ...counterexamples,
        policyCandidatePrContractDigest:
          'sha256:abababababababababababababababababababababababababababababababab',
      },
    }),
    /counterexample source digest must match policy candidate PR contract digest/u,
    'Policy Twin backtest: mismatched counterexample source digest fails closed',
  );
  throws(
    () => createPolicyTwinBacktest({
      policyCandidatePrContract: contract,
      counterexampleReplayGenerator: counterexamples,
      fixtureOutcomes: [{
        fixtureDigest:
          'sha256:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
        actualOutcome: 'block',
      }],
    }),
    /must reference a generated counterexample fixture digest/u,
    'Policy Twin backtest: unknown fixture outcome digest fails closed',
  );
  throws(
    () => createPolicyTwinBacktest({
      policyCandidatePrContract: contract,
      counterexampleReplayGenerator: counterexamples,
      fixtureOutcomes: [
        { fixtureDigest: firstFixture.fixtureDigest, actualOutcome: 'block' },
        { fixtureDigest: firstFixture.fixtureDigest, actualOutcome: 'block' },
      ],
    }),
    /must not contain duplicate digests/u,
    'Policy Twin backtest: duplicate fixture outcome digests fail closed',
  );
}

function testDescriptorDocsAndTrackersStayAligned(): void {
  const descriptor = policyTwinBacktestDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-twin-backtest.md');
  const counterexampleDoc = readProjectFile('docs', '02-architecture', 'counterexample-replay-generator.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.policy-twin-backtest.v1', 'Policy Twin backtest: descriptor version is explicit');
  equal(descriptor.autoEnforce, false, 'Policy Twin backtest: descriptor never auto-enforces');
  equal(descriptor.policyTwinEvidenceOnly, true, 'Policy Twin backtest: descriptor is evidence-only');
  equal(descriptor.executesProductionTraffic, false, 'Policy Twin backtest: descriptor blocks production traffic');
  ok(descriptor.statuses.includes('counterexamples-failed'), 'Policy Twin backtest: descriptor lists failed status');
  ok(descriptor.decisions.includes('admit'), 'Policy Twin backtest: descriptor lists admit decision');

  for (const expected of [
    '# Policy Twin Backtest',
    'attestor.policy-twin-backtest.v1',
    'historicalAdmitCount',
    'historicalReviewCount',
    'historicalBlockCount',
    'falseAdmitRiskCount',
    'reviewLoadReductionRate',
    'policyTwinEvidenceOnly = true',
    'executesProductionTraffic = false',
    'OPA policy testing',
    'OPA decision logs',
    'Cedar policy validation',
    'Terraform plan',
    'Kubernetes dry-run',
    'AWS IAM Access Analyzer policy generation',
    'Google Cloud role recommendations',
    'NIST AI RMF Generative AI Profile',
  ]) {
    includes(doc, expected, `Policy Twin backtest doc: records ${expected}`);
  }

  for (const expected of [
    '| Complete | 26 |',
    '| Remaining | 0 |',
    '| 19 | complete | Counterexample replay generator |',
    '| 20 | complete | Policy Twin backtest |',
    '| 21 | complete | Review-by-exception inbox |',
    'live customer pilot execution',
  ]) {
    includes(masterPlan, expected, `Policy Twin backtest: master plan records ${expected}`);
  }

  includes(
    ledger,
    '### 62. Policy Twin Backtest',
    'Policy Twin backtest: research ledger entry is present',
  );
  includes(
    systemOverview,
    '[Policy Twin backtest](policy-twin-backtest.md)',
    'Policy Twin backtest: system overview links doc',
  );
  includes(
    counterexampleDoc,
    '[Policy Twin Backtest](policy-twin-backtest.md)',
    'Policy Twin backtest: counterexample doc links next contract',
  );
  includes(
    readme,
    'href="docs/01-overview/how-attestor-connects-to-existing-systems.md"',
    'Policy Twin backtest: README links the integration overview',
  );
  assert.equal(
    packageJson.scripts['test:policy-twin-backtest'],
    'tsx tests/policy-twin-backtest.test.ts',
    'Policy Twin backtest: package script is registered',
  );
  passed += 1;

  excludes(
    doc,
    /\bproduction-ready\b(?![\s\S]{0,80}(not|without|until|claim|readiness|evidence))/iu,
    'Policy Twin backtest doc: does not make an unqualified production-ready claim',
  );
}

testBacktestPassesWhenHistoricalAndCounterexamplesHold();
testBacktestBlocksFalseAdmitCounterexample();
testBacktestRequiresReviewForMissingEvidence();
testBacktestFailsClosedOnInvalidInputs();
testDescriptorDocsAndTrackersStayAligned();

console.log(`Policy Twin backtest tests: ${passed} passed, 0 failed`);
