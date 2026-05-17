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
  createReviewByExceptionInbox,
  reviewByExceptionInboxDescriptor,
  type CanonicalShadowEvent,
  type CanonicalShadowEventConsequenceClass,
  type CanonicalShadowEventSourceKind,
  type PolicyCandidatePrApprovalState,
  type PolicyCandidatePrContract,
  type PolicyTwinBacktestResult,
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
    producer: input.producer ?? 'attestor.review-by-exception-inbox.test',
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
  readonly approvalState: PolicyCandidatePrApprovalState;
  readonly question?: boolean;
  readonly failedReplay?: boolean;
}): {
  readonly contract: PolicyCandidatePrContract;
  readonly backtest: PolicyTwinBacktestResult;
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
    trustedProducers: ['attestor.review-by-exception-inbox.test'],
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
    questionDigestsBySurfaceId: input.question
      ? { [surface.surfaceId]: [questionA] }
      : {},
    approvalStateBySurfaceId: {
      [surface.surfaceId]: input.approvalState,
    },
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
  const firstBlockingFixture = counterexamples.fixtures.find((fixture) =>
    fixture.expectedOutcome === 'block'
  );
  assert.ok(firstBlockingFixture);
  const backtest = createPolicyTwinBacktest({
    policyCandidatePrContract: contract,
    counterexampleReplayGenerator: counterexamples,
    generatedAt: '2026-05-17T09:08:00.000Z',
    fixtureOutcomes: input.failedReplay
      ? [{
        fixtureDigest: firstBlockingFixture.fixtureDigest,
        actualOutcome: 'admit',
        evaluatorDigest: replayA,
      }]
      : [],
  });
  return { contract, backtest };
}

function inboxFor(input: {
  readonly clean: boolean;
  readonly approvalState: PolicyCandidatePrApprovalState;
  readonly question?: boolean;
  readonly failedReplay?: boolean;
}) {
  const { contract, backtest } = buildChain(input);
  return createReviewByExceptionInbox({
    policyCandidatePrContract: contract,
    policyTwinBacktest: backtest,
    generatedAt: '2026-05-17T09:09:00.000Z',
  });
}

function testReadyToApproveLane(): void {
  const inbox = inboxFor({ clean: true, approvalState: 'approval-ready' });
  const item = inbox.items[0];
  assert.ok(item);

  equal(inbox.version, 'attestor.review-by-exception-inbox.v1', 'Review inbox: version is explicit');
  equal(inbox.status, 'ready-for-approval', 'Review inbox: clean approval-ready candidate is ready');
  equal(inbox.approvalPacketReady, true, 'Review inbox: approval packet is ready without blockers');
  equal(inbox.laneCounts.readyToApprove, 1, 'Review inbox: ready lane is counted');
  equal(inbox.humanActionItemCount, 1, 'Review inbox: ready item needs human action');
  equal(inbox.defaultVisibleItemCount, 1, 'Review inbox: ready item is default-visible');
  equal(inbox.noisyEventInspectionRequired, false, 'Review inbox: no noisy event inspection is required');
  equal(inbox.oneItemPerCandidate, true, 'Review inbox: candidate-level grouping is explicit');
  equal(inbox.eventLevelItemsCreated, false, 'Review inbox: event-level item fanout is disabled');
  equal(item.lane, 'ready-to-approve', 'Review inbox: item lane is ready-to-approve');
  equal(item.requiredAction, 'approve-candidate', 'Review inbox: ready item action is approval');
  equal(item.humanActionRequired, true, 'Review inbox: ready item requires a human');
  equal(item.approvalBlocked, false, 'Review inbox: ready item does not block approval');
  ok(item.itemDigest.startsWith('sha256:'), 'Review inbox: item digest is generated');
  ok(inbox.digest.startsWith('sha256:'), 'Review inbox: result digest is generated');
  excludes(
    JSON.stringify(inbox),
    /unreviewed\.importer|raw_recipient_must_not_escape|private_threshold_must_not_escape/iu,
    'Review inbox: serialized output excludes raw producer and private markers',
  );
}

function testMonitoringOnlyLaneSuppressesNoise(): void {
  const inbox = inboxFor({ clean: true, approvalState: 'approved' });
  const item = inbox.items[0];
  assert.ok(item);

  equal(inbox.status, 'monitoring-only', 'Review inbox: approved clean candidate becomes monitoring-only');
  equal(inbox.laneCounts.monitoringOnly, 1, 'Review inbox: monitoring lane is counted');
  equal(inbox.monitoringOnlyCount, 1, 'Review inbox: monitoring-only count is retained');
  equal(inbox.humanActionItemCount, 0, 'Review inbox: monitoring-only does not ask for human action');
  equal(inbox.defaultVisibleItemCount, 0, 'Review inbox: monitoring-only is hidden from default inbox');
  equal(item.lane, 'monitoring-only', 'Review inbox: item lane is monitoring-only');
  equal(item.requiredAction, 'monitor', 'Review inbox: monitoring item action is monitor');
  equal(item.defaultVisible, false, 'Review inbox: monitoring item is not default-visible');
}

function testNeedsAnswerLane(): void {
  const inbox = inboxFor({
    clean: true,
    approvalState: 'needs-answer',
    question: true,
  });
  const item = inbox.items[0];
  assert.ok(item);

  equal(inbox.status, 'needs-human-input', 'Review inbox: open question needs human input');
  equal(inbox.laneCounts.needsAnswer, 1, 'Review inbox: needs-answer lane is counted');
  equal(item.lane, 'needs-answer', 'Review inbox: item lane is needs-answer');
  equal(item.requiredAction, 'answer-question', 'Review inbox: needs-answer action is answer-question');
  ok(
    item.reasonCodes.includes('policy-twin-active-question-open'),
    'Review inbox: active question reason is retained',
  );
  equal(item.sourceQuestionDigests.length, 1, 'Review inbox: source question digest is retained');
}

function testBlockedByEvidenceLane(): void {
  const inbox = inboxFor({ clean: false, approvalState: 'blocked' });
  const item = inbox.items[0];
  assert.ok(item);

  equal(inbox.status, 'blocked', 'Review inbox: missing evidence blocks inbox');
  equal(inbox.approvalPacketReady, false, 'Review inbox: blocked evidence cannot be approval-ready');
  equal(inbox.laneCounts.blockedByEvidence, 1, 'Review inbox: blocked-by-evidence lane is counted');
  equal(item.lane, 'blocked-by-evidence', 'Review inbox: item lane is blocked-by-evidence');
  equal(item.requiredAction, 'provide-evidence', 'Review inbox: blocked evidence action is provide-evidence');
  ok(
    item.reasonCodes.includes('policy-twin-missed-evidence'),
    'Review inbox: missed evidence reason is retained',
  );
}

function testFailedReplayLaneHasHighestPriority(): void {
  const inbox = inboxFor({
    clean: true,
    approvalState: 'approval-ready',
    failedReplay: true,
  });
  const item = inbox.items[0];
  assert.ok(item);

  equal(inbox.status, 'blocked', 'Review inbox: failed replay blocks inbox');
  equal(inbox.laneCounts.failedReplay, 1, 'Review inbox: failed-replay lane is counted');
  equal(item.lane, 'failed-replay', 'Review inbox: item lane is failed-replay');
  equal(item.requiredAction, 'fix-replay', 'Review inbox: failed replay action is fix-replay');
  ok(item.priorityScore >= 90, 'Review inbox: failed replay receives top priority');
  ok(
    item.reasonCodes.includes('policy-twin-counterexample-false-admit'),
    'Review inbox: false-admit reason is retained',
  );
}

function testInboxFailsClosedOnMismatchedSources(): void {
  const { contract, backtest } = buildChain({
    clean: true,
    approvalState: 'approval-ready',
  });

  throws(
    () => createReviewByExceptionInbox({
      policyCandidatePrContract: {
        ...contract,
        digest: 'sha256:abababababababababababababababababababababababababababababababab',
      },
      policyTwinBacktest: backtest,
    }),
    /source digest must match/u,
    'Review inbox: mismatched contract digest fails closed',
  );
  throws(
    () => createReviewByExceptionInbox({
      policyCandidatePrContract: contract,
      policyTwinBacktest: {
        ...backtest,
        candidateResults: [{
          ...backtest.candidateResults[0]!,
          candidateId: 'unknown-candidate',
        }],
      },
    }),
    /must include every policy candidate|must not include unknown policy candidates/u,
    'Review inbox: unknown candidate coverage fails closed',
  );
  throws(
    () => createReviewByExceptionInbox({
      policyCandidatePrContract: contract,
      policyTwinBacktest: backtest,
      generatedAt: 'not-a-date',
    }),
    /generatedAt must be an ISO timestamp/u,
    'Review inbox: invalid generatedAt fails closed',
  );
}

function testDescriptorDocsAndTrackersStayAligned(): void {
  const descriptor = reviewByExceptionInboxDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'review-by-exception-inbox.md');
  const policyTwinDoc = readProjectFile('docs', '02-architecture', 'policy-twin-backtest.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.review-by-exception-inbox.v1', 'Review inbox: descriptor version is explicit');
  equal(descriptor.autoEnforce, false, 'Review inbox: descriptor never auto-enforces');
  equal(descriptor.noisyEventInspectionRequired, false, 'Review inbox: descriptor blocks noisy event inspection');
  ok(descriptor.lanes.includes('ready-to-approve'), 'Review inbox: descriptor lists ready lane');
  ok(descriptor.lanes.includes('monitoring-only'), 'Review inbox: descriptor lists monitoring lane');

  for (const expected of [
    '# Review-by-Exception Inbox',
    'attestor.review-by-exception-inbox.v1',
    'ready-to-approve',
    'needs-answer',
    'blocked-by-evidence',
    'failed-replay',
    'monitoring-only',
    'oneItemPerCandidate = true',
    'eventLevelItemsCreated = false',
    'noisyEventInspectionRequired = false',
    'AWS IAM Access Analyzer policy generation',
    'Google Cloud role recommendations',
    'GitHub code scanning alerts',
    'Workato business approvals',
    'n8n human-in-the-loop tool calls',
    'Camunda agentic orchestration',
    'Microsoft Human-AI Interaction Guidelines',
  ]) {
    includes(doc, expected, `Review inbox doc: records ${expected}`);
  }

  for (const expected of [
    '| Complete | 24 |',
    '| Remaining | 2 |',
    '| 20 | complete | Policy Twin backtest |',
    '| 21 | complete | Review-by-exception inbox |',
    '| 22 | complete | Approval/dismiss feedback loop |',
    'completion of steps 25-26',
  ]) {
    includes(masterPlan, expected, `Review inbox: master plan records ${expected}`);
  }

  includes(
    ledger,
    '### 63. Review-by-Exception Inbox',
    'Review inbox: research ledger entry is present',
  );
  includes(
    systemOverview,
    '[Review-by-exception inbox](review-by-exception-inbox.md)',
    'Review inbox: system overview links doc',
  );
  includes(
    policyTwinDoc,
    '[Review-by-Exception Inbox](review-by-exception-inbox.md)',
    'Review inbox: Policy Twin doc links next contract',
  );
  includes(
    readme,
    '[Review-by-exception inbox](docs/02-architecture/review-by-exception-inbox.md)',
    'Review inbox: README links doc',
  );
  assert.equal(
    packageJson.scripts['test:review-by-exception-inbox'],
    'tsx tests/review-by-exception-inbox.test.ts',
    'Review inbox: package script is registered',
  );
  passed += 1;

  excludes(
    doc,
    /\bproduction-ready\b(?![\s\S]{0,80}(not|without|until|claim|readiness|evidence))/iu,
    'Review inbox doc: does not make an unqualified production-ready claim',
  );
}

testReadyToApproveLane();
testMonitoringOnlyLaneSuppressesNoise();
testNeedsAnswerLane();
testBlockedByEvidenceLane();
testFailedReplayLaneHasHighestPriority();
testInboxFailsClosedOnMismatchedSources();
testDescriptorDocsAndTrackersStayAligned();

console.log(`Review-by-exception inbox tests: ${passed} passed, 0 failed`);
