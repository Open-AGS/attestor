import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  approvalDismissFeedbackLoopDescriptor,
  createActionSurfaceGraph,
  createActiveQuestionEngine,
  createApprovalDismissFeedbackLoop,
  createCanonicalShadowEvent,
  createCounterexampleReplayGenerator,
  createEvidenceStateModel,
  createPolicyCandidatePrContract,
  createPolicyTwinBacktest,
  createReviewByExceptionInbox,
  type ApprovalDismissFeedbackAction,
  type ApprovalDismissFeedbackInput,
  type CanonicalShadowEvent,
  type CanonicalShadowEventConsequenceClass,
  type CanonicalShadowEventSourceKind,
  type PolicyCandidatePrApprovalState,
  type ReviewByExceptionInboxItem,
  type ReviewByExceptionInboxResult,
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
const reviewerA = 'sha256:abababababababababababababababababababababababababababababababab';
const reasonA = 'sha256:bcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc';
const commentA = 'sha256:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd';
const thresholdBefore = 'sha256:dadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadada';
const thresholdAfter = 'sha256:ebebebebebebebebebebebebebebebebebebebebebebebebebebebebebebebeb';
const stricterConstraint = 'sha256:1212121212121212121212121212121212121212121212121212121212121212';
const rollbackPlan = 'sha256:3434343434343434343434343434343434343434343434343434343434343434';

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
    producer: input.producer ?? 'attestor.approval-dismiss-feedback-loop.test',
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

function inboxFor(input: {
  readonly clean: boolean;
  readonly approvalState: PolicyCandidatePrApprovalState;
  readonly question?: boolean;
  readonly failedReplay?: boolean;
}): ReviewByExceptionInboxResult {
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
    trustedProducers: ['attestor.approval-dismiss-feedback-loop.test'],
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
  return createReviewByExceptionInbox({
    policyCandidatePrContract: contract,
    policyTwinBacktest: backtest,
    generatedAt: '2026-05-17T09:09:00.000Z',
  });
}

function feedbackFor(
  item: ReviewByExceptionInboxItem,
  action: ApprovalDismissFeedbackAction,
  overrides: Partial<ApprovalDismissFeedbackInput> = {},
): ApprovalDismissFeedbackInput {
  return {
    itemId: item.itemId,
    itemDigest: item.itemDigest,
    reviewContextDigest: item.reviewContextDigest,
    action,
    reviewerRefDigest: reviewerA,
    decidedAt: '2026-05-17T09:10:00.000Z',
    reasonDigest: reasonA,
    commentDigest: commentA,
    ...overrides,
  };
}

function testApproveCandidateRecordsFeedbackOnly(): void {
  const inbox = inboxFor({ clean: true, approvalState: 'approval-ready' });
  const item = inbox.items[0];
  assert.ok(item);
  const loop = createApprovalDismissFeedbackLoop({
    reviewByExceptionInbox: inbox,
    generatedAt: '2026-05-17T09:11:00.000Z',
    feedback: [feedbackFor(item, 'approve-candidate')],
  });
  const event = loop.events[0];
  assert.ok(event);

  equal(loop.version, 'attestor.approval-dismiss-feedback-loop.v1', 'Feedback loop: version is explicit');
  equal(loop.status, 'feedback-recorded', 'Feedback loop: approval is recorded');
  equal(loop.counts.approved, 1, 'Feedback loop: approval count is updated');
  equal(loop.acceptedFeedbackCount, 1, 'Feedback loop: accepted count is updated');
  equal(event.outcome, 'candidate-approved', 'Feedback loop: approval outcome is explicit');
  equal(event.candidateMayAdvanceToApproved, true, 'Feedback loop: candidate approval state may advance');
  equal(event.requiresNewCandidate, false, 'Feedback loop: approval does not require a new candidate');
  equal(event.autoEnforce, false, 'Feedback loop: approval does not auto-enforce');
  equal(loop.activatesEnforcement, false, 'Feedback loop: result does not activate enforcement');
  equal(loop.mutatesPolicyBundle, false, 'Feedback loop: result does not mutate policy bundle');
  equal(loop.updatesPolicyCandidate, false, 'Feedback loop: result does not mutate candidate in place');
  equal(loop.retrainsModel, false, 'Feedback loop: result does not retrain models');
  ok(loop.digest.startsWith('sha256:'), 'Feedback loop: digest is generated');
  excludes(
    JSON.stringify(loop),
    /manager approved|1000 USD|raw-threshold|unreviewed\.importer/iu,
    'Feedback loop: serialized result excludes raw approval and private context',
  );
}

function testDismissCandidateRecordsStructuredDismissal(): void {
  const inbox = inboxFor({
    clean: true,
    approvalState: 'needs-answer',
    question: true,
  });
  const item = inbox.items[0];
  assert.ok(item);
  const loop = createApprovalDismissFeedbackLoop({
    reviewByExceptionInbox: inbox,
    generatedAt: '2026-05-17T09:11:00.000Z',
    feedback: [feedbackFor(item, 'dismiss-candidate')],
  });
  const event = loop.events[0];
  assert.ok(event);

  equal(loop.status, 'feedback-recorded', 'Feedback loop: dismissal is recorded');
  equal(loop.counts.dismissed, 1, 'Feedback loop: dismissal count is updated');
  equal(event.outcome, 'candidate-dismissed', 'Feedback loop: dismissal outcome is explicit');
  equal(event.candidateMayAdvanceToApproved, false, 'Feedback loop: dismissal cannot approve');
  ok(
    event.reasonCodes.includes('feedback-candidate-dismissed'),
    'Feedback loop: dismissal reason code is retained',
  );
}

function testStricterThresholdAndRollbackRequireNewCandidate(): void {
  const readyInbox = inboxFor({ clean: true, approvalState: 'approval-ready' });
  const readyItem = readyInbox.items[0];
  assert.ok(readyItem);
  const monitoringInbox = inboxFor({ clean: true, approvalState: 'approved' });
  const monitoringItem = monitoringInbox.items[0];
  assert.ok(monitoringItem);

  const stricter = createApprovalDismissFeedbackLoop({
    reviewByExceptionInbox: readyInbox,
    feedback: [feedbackFor(readyItem, 'request-stricter-version', {
      stricterVersionRequest: {
        requestedConstraintDigest: stricterConstraint,
        requestedReasonDigest: reasonA,
      },
    })],
  });
  const threshold = createApprovalDismissFeedbackLoop({
    reviewByExceptionInbox: readyInbox,
    feedback: [feedbackFor(readyItem, 'edit-threshold', {
      thresholdEdit: {
        thresholdField: 'refund.amount.max',
        beforeDigest: thresholdBefore,
        afterDigest: thresholdAfter,
        unitDigest: null,
      },
    })],
  });
  const rollback = createApprovalDismissFeedbackLoop({
    reviewByExceptionInbox: monitoringInbox,
    feedback: [feedbackFor(monitoringItem, 'request-rollback', {
      rollbackRequest: {
        rollbackPlanDigest: rollbackPlan,
        rollbackScopeDigest: monitoringItem.sourcePolicyCandidateDigest,
        rollbackReasonDigest: reasonA,
      },
    })],
  });

  equal(stricter.status, 'new-candidate-required', 'Feedback loop: stricter version requires a candidate');
  equal(stricter.counts.stricterVersionRequested, 1, 'Feedback loop: stricter request is counted');
  equal(stricter.newCandidateRequiredCount, 1, 'Feedback loop: stricter request increments new candidate count');
  equal(threshold.status, 'new-candidate-required', 'Feedback loop: threshold edit requires a candidate');
  equal(threshold.counts.thresholdEdited, 1, 'Feedback loop: threshold edit is counted');
  equal(threshold.events[0]?.thresholdEdit?.thresholdField, 'refund.amount.max', 'Feedback loop: threshold field is structural');
  equal(rollback.status, 'new-candidate-required', 'Feedback loop: rollback request requires a candidate');
  equal(rollback.counts.rollbackRequested, 1, 'Feedback loop: rollback request is counted');
  equal(rollback.events[0]?.rollbackRequest?.rollbackPlanDigest, rollbackPlan, 'Feedback loop: rollback plan digest is retained');
  equal(rollback.events[0]?.activatesEnforcement, false, 'Feedback loop: rollback request does not execute rollback');
}

function testUnsafeApprovalIsBlockedNotAccepted(): void {
  const inbox = inboxFor({ clean: false, approvalState: 'blocked' });
  const item = inbox.items[0];
  assert.ok(item);
  const loop = createApprovalDismissFeedbackLoop({
    reviewByExceptionInbox: inbox,
    feedback: [feedbackFor(item, 'approve-candidate')],
  });
  const event = loop.events[0];
  assert.ok(event);

  equal(loop.status, 'blocked', 'Feedback loop: unsafe approval is blocked');
  equal(loop.blockedFeedbackCount, 1, 'Feedback loop: blocked feedback is counted');
  equal(event.accepted, false, 'Feedback loop: unsafe approval is not accepted');
  equal(event.outcome, 'feedback-blocked', 'Feedback loop: unsafe approval outcome is blocked');
  equal(event.candidateMayAdvanceToApproved, false, 'Feedback loop: unsafe approval cannot advance candidate');
  ok(
    event.reasonCodes.includes('feedback-action-not-allowed-for-lane'),
    'Feedback loop: blocked approval reason is explicit',
  );
}

function testFeedbackFailsClosedOnInvalidReferences(): void {
  const inbox = inboxFor({ clean: true, approvalState: 'approval-ready' });
  const item = inbox.items[0];
  assert.ok(item);

  throws(
    () => createApprovalDismissFeedbackLoop({
      reviewByExceptionInbox: inbox,
      feedback: [feedbackFor(item, 'approve-candidate', {
        reviewContextDigest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      })],
    }),
    /review context digest must match/u,
    'Feedback loop: stale review context fails closed',
  );
  throws(
    () => createApprovalDismissFeedbackLoop({
      reviewByExceptionInbox: inbox,
      feedback: [feedbackFor(item, 'approve-candidate'), feedbackFor(item, 'dismiss-candidate')],
    }),
    /duplicate item feedback/u,
    'Feedback loop: duplicate item feedback fails closed',
  );
  throws(
    () => createApprovalDismissFeedbackLoop({
      reviewByExceptionInbox: inbox,
      feedback: [feedbackFor(item, 'edit-threshold', {
        thresholdEdit: {
          thresholdField: 'refund.amount.max',
          beforeDigest: thresholdBefore,
          afterDigest: thresholdBefore,
        },
      })],
    }),
    /must change the threshold digest/u,
    'Feedback loop: no-op threshold edit fails closed',
  );
  throws(
    () => createApprovalDismissFeedbackLoop({
      reviewByExceptionInbox: inbox,
      feedback: [feedbackFor(item, 'request-rollback')],
    }),
    /rollback request is required/u,
    'Feedback loop: rollback action requires rollback digest material',
  );
  throws(
    () => createApprovalDismissFeedbackLoop({
      reviewByExceptionInbox: inbox,
      feedback: [feedbackFor(item, 'approve-candidate', {
        itemId: 'missing-item',
      })],
    }),
    /item must exist/u,
    'Feedback loop: unknown item fails closed',
  );
}

function testDescriptorDocsAndTrackersStayAligned(): void {
  const descriptor = approvalDismissFeedbackLoopDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'approval-dismiss-feedback-loop.md');
  const reviewInboxDoc = readProjectFile('docs', '02-architecture', 'review-by-exception-inbox.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.approval-dismiss-feedback-loop.v1', 'Feedback loop: descriptor version is explicit');
  equal(descriptor.autoEnforce, false, 'Feedback loop: descriptor never auto-enforces');
  equal(descriptor.mutatesPolicyBundle, false, 'Feedback loop: descriptor does not mutate policy bundle');
  equal(descriptor.retrainsModel, false, 'Feedback loop: descriptor does not retrain');
  ok(descriptor.actions.includes('approve-candidate'), 'Feedback loop: descriptor lists approval');
  ok(descriptor.actions.includes('request-rollback'), 'Feedback loop: descriptor lists rollback');

  for (const expected of [
    '# Approval/Dismiss Feedback Loop',
    'attestor.approval-dismiss-feedback-loop.v1',
    'approve-candidate',
    'dismiss-candidate',
    'request-stricter-version',
    'edit-threshold',
    'request-rollback',
    'requiresReviewContextDigest = true',
    'mutatesPolicyBundle = false',
    'updatesPolicyCandidate = false',
    'retrainsModel = false',
    'AWS IAM Access Analyzer policy generation',
    'Google Cloud Recommender state metadata',
    'GitHub code scanning alert triage',
    'Workato business approvals',
    'n8n human-in-the-loop tool calls',
    'Camunda human tasks',
    'Microsoft Human-AI Interaction Guidelines',
  ]) {
    includes(doc, expected, `Feedback loop doc: records ${expected}`);
  }

  for (const expected of [
    '| Complete | 26 |',
    '| Remaining | 0 |',
    '| 21 | complete | Review-by-exception inbox |',
    '| 22 | complete | Approval/dismiss feedback loop |',
    '| 23 | complete | Enterprise integration recipes |',
    'live customer pilot execution',
  ]) {
    includes(masterPlan, expected, `Feedback loop: master plan records ${expected}`);
  }

  includes(
    ledger,
    '### 64. Approval/Dismiss Feedback Loop',
    'Feedback loop: research ledger entry is present',
  );
  includes(
    systemOverview,
    '[Approval/dismiss feedback loop](approval-dismiss-feedback-loop.md)',
    'Feedback loop: system overview links doc',
  );
  includes(
    reviewInboxDoc,
    '[Approval/Dismiss Feedback Loop](approval-dismiss-feedback-loop.md)',
    'Feedback loop: Review inbox doc links next contract',
  );
  includes(
    readme,
    '[Approval/dismiss feedback loop](docs/02-architecture/approval-dismiss-feedback-loop.md)',
    'Feedback loop: README links doc',
  );
  assert.equal(
    packageJson.scripts['test:approval-dismiss-feedback-loop'],
    'tsx tests/approval-dismiss-feedback-loop.test.ts',
    'Feedback loop: package script is registered',
  );
  passed += 1;

  excludes(
    doc,
    /\bproduction-ready\b(?![\s\S]{0,80}(not|without|until|claim|readiness|evidence))/iu,
    'Feedback loop doc: does not make an unqualified production-ready claim',
  );
}

testApproveCandidateRecordsFeedbackOnly();
testDismissCandidateRecordsStructuredDismissal();
testStricterThresholdAndRollbackRequireNewCandidate();
testUnsafeApprovalIsBlockedNotAccepted();
testFeedbackFailsClosedOnInvalidReferences();
testDescriptorDocsAndTrackersStayAligned();

console.log(`Approval/dismiss feedback loop tests: ${passed} passed, 0 failed`);
