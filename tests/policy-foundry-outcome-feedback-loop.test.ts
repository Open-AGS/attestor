import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPolicyFoundryOutcomeFeedbackLoop,
  policyFoundryOutcomeFeedbackLoopDescriptor,
  type ConsequenceAdmissionDownstreamExecutionReceipt,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function receipt(input: {
  readonly id: string;
  readonly status: 'succeeded' | 'failed' | 'skipped';
  readonly downstreamSystem?: string;
}): ConsequenceAdmissionDownstreamExecutionReceipt {
  return {
    receiptDigest: digest(`receipt:${input.id}`),
    status: input.status,
    downstreamSystem: input.downstreamSystem ?? 'refund-service',
  } as unknown as ConsequenceAdmissionDownstreamExecutionReceipt;
}

function testPositiveFeedbackBecomesScoringInputOnly(): void {
  const feedback = createPolicyFoundryOutcomeFeedbackLoop({
    generatedAt: '2026-05-13T10:00:00.000Z',
    actionSurface: 'refunds.issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    reviewedDecisions: [
      {
        decisionDigest: digest('review:1'),
        decidedAt: '2026-05-13T09:00:00.000Z',
        outcome: 'approved',
        policyCandidateDigest: digest('candidate:1'),
        reviewerRefDigest: digest('reviewer:1'),
        evidenceDigest: digest('evidence:1'),
        reasonCodes: ['human-approved', 'secret=must_not_escape'],
      },
      {
        decisionDigest: digest('review:2'),
        decidedAt: '2026-05-13T09:05:00.000Z',
        outcome: 'approved',
        policyCandidateDigest: digest('candidate:1'),
        reviewerRefDigest: digest('reviewer:2'),
        evidenceDigest: digest('evidence:2'),
      },
    ],
    downstreamReceipts: [
      receipt({ id: '1', status: 'succeeded' }),
      receipt({ id: '2', status: 'succeeded' }),
    ],
  });
  const serialized = JSON.stringify(feedback);

  equal(feedback.version, 'attestor.policy-foundry-outcome-feedback-loop.v1', 'Outcome feedback: version is explicit');
  equal(feedback.status, 'scoring-feedback-ready', 'Outcome feedback: complete positive feedback is scoring-ready');
  equal(feedback.signals.reviewedDecisionCount, 2, 'Outcome feedback: reviewed decisions are counted');
  equal(feedback.signals.approvedCount, 2, 'Outcome feedback: approvals are counted');
  equal(feedback.signals.downstreamReceiptCount, 2, 'Outcome feedback: downstream receipts are counted');
  equal(feedback.signals.succeededCount, 2, 'Outcome feedback: succeeded receipts are counted');
  equal(feedback.signals.reviewerAgreementRate, 1, 'Outcome feedback: reviewer agreement is explicit');
  equal(feedback.signals.downstreamSuccessRate, 1, 'Outcome feedback: downstream success is explicit');
  equal(feedback.signals.feedbackCompletenessRate, 1, 'Outcome feedback: feedback completeness is explicit');
  equal(feedback.signals.scoringSignal, 'positive-outcome-signal', 'Outcome feedback: positive scoring signal is explicit');
  equal(feedback.noGoReasons.length, 0, 'Outcome feedback: no no-go reasons for clean positive feedback');
  equal(feedback.approvalRequired, true, 'Outcome feedback: approval remains required');
  equal(feedback.autoEnforce, false, 'Outcome feedback: auto enforce is false');
  equal(feedback.productionReady, false, 'Outcome feedback: production readiness is not claimed');
  equal(feedback.scoringInputOnly, true, 'Outcome feedback: output is a scoring input only');
  equal(feedback.automaticScoreMutationAllowed, false, 'Outcome feedback: automatic score mutation is blocked');
  equal(feedback.feedbackAuthorityAllowed, false, 'Outcome feedback: feedback cannot become policy authority');
  equal(feedback.llmTrainingAllowed, false, 'Outcome feedback: LLM training is blocked');
  ok(feedback.digest.startsWith('sha256:'), 'Outcome feedback: digest is generated');
  excludes(serialized, /secret=must_not_escape/u, 'Outcome feedback: unsafe reason-code material is dropped');
}

function testIncompleteOrNegativeFeedbackStaysCollecting(): void {
  const feedback = createPolicyFoundryOutcomeFeedbackLoop({
    generatedAt: '2026-05-13T10:10:00.000Z',
    reviewedDecisions: [
      {
        decisionDigest: digest('review:1'),
        decidedAt: '2026-05-13T09:00:00.000Z',
        outcome: 'approved',
      },
      {
        decisionDigest: digest('review:2'),
        decidedAt: '2026-05-13T09:01:00.000Z',
        outcome: 'rejected',
      },
    ],
    downstreamReceipts: [
      receipt({ id: '1', status: 'failed' }),
    ],
  });

  equal(feedback.status, 'collecting-feedback', 'Outcome feedback: negative/incomplete feedback stays collecting');
  equal(feedback.signals.reviewerAgreementRate, 0.5, 'Outcome feedback: reviewer disagreement is measured');
  equal(feedback.signals.downstreamFailureRate, 1, 'Outcome feedback: downstream failure rate is measured');
  ok(feedback.noGoReasons.includes('reviewer-disagreement'), 'Outcome feedback: reviewer disagreement is no-go');
  ok(feedback.noGoReasons.includes('failed-downstream-receipts'), 'Outcome feedback: failed receipts are no-go');
  ok(feedback.noGoReasons.includes('missing-receipts-after-review'), 'Outcome feedback: missing receipts are no-go');
  equal(feedback.signals.scoringSignal, 'negative-outcome-signal', 'Outcome feedback: negative scoring signal is explicit');
}

function testInvalidDigestsDoNotBecomeEvidence(): void {
  const feedback = createPolicyFoundryOutcomeFeedbackLoop({
    generatedAt: '2026-05-13T10:20:00.000Z',
    reviewedDecisions: [
      {
        decisionDigest: 'raw-decision-id-not-a-digest',
        decidedAt: '2026-05-13T09:00:00.000Z',
        outcome: 'approved',
        reviewerRefDigest: 'raw-reviewer-id-not-a-digest',
      },
    ],
    downstreamReceipts: [
      receipt({ id: '1', status: 'succeeded' }),
    ],
  });

  equal(feedback.status, 'collecting-feedback', 'Outcome feedback: invalid digest feedback stays collecting');
  ok(feedback.noGoReasons.includes('invalid-feedback-digests'), 'Outcome feedback: invalid digests are no-go');
  equal(feedback.sourceDigests.reviewedDecisionDigests.length, 0, 'Outcome feedback: invalid decision digest is not retained');
  equal(feedback.sourceDigests.downstreamReceiptDigests.length, 1, 'Outcome feedback: valid receipt digest is retained');
}

function testNoFeedbackIsExplicit(): void {
  const feedback = createPolicyFoundryOutcomeFeedbackLoop({
    generatedAt: '2026-05-13T10:30:00.000Z',
  });

  equal(feedback.status, 'no-feedback', 'Outcome feedback: empty input is explicit no-feedback');
  ok(feedback.noGoReasons.includes('no-reviewed-decisions'), 'Outcome feedback: missing decisions are no-go');
  ok(feedback.noGoReasons.includes('no-downstream-receipts'), 'Outcome feedback: missing receipts are no-go');
  equal(feedback.signals.scoringSignal, 'insufficient-feedback', 'Outcome feedback: empty input is insufficient');
}

function testDescriptorDocsAndPackageSurfaceStayAligned(): void {
  const descriptor = policyFoundryOutcomeFeedbackLoopDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const dataMinDoc = readProjectFile('docs', '02-architecture', 'data-minimization-redaction-policy.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-outcome-feedback-loop.v1', 'Outcome feedback descriptor: version is explicit');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-outcome-feedback-loop', 'Outcome feedback descriptor: data minimization surface is explicit');
  equal(descriptor.automaticScoreMutationAllowed, false, 'Outcome feedback descriptor: score mutation is blocked');
  equal(descriptor.feedbackAuthorityAllowed, false, 'Outcome feedback descriptor: feedback authority is blocked');
  equal(descriptor.llmTrainingAllowed, false, 'Outcome feedback descriptor: LLM training is blocked');
  includes(doc, 'src/consequence-admission/policy-foundry-outcome-feedback-loop.ts', 'Policy Foundry docs: outcome feedback contract is named');
  includes(doc, 'test:policy-foundry-outcome-feedback-loop', 'Policy Foundry docs: outcome feedback test command is named');
  includes(dataMinDoc, 'policy-foundry-outcome-feedback-loop', 'Data minimization docs: outcome feedback surface is named');
  includes(tracker, 'complete | Add Outcome Feedback Loop', 'Deepening tracker: Step 10 is complete');
  includes(tracker, 'attestor.policy-foundry-outcome-feedback-loop.v1', 'Deepening tracker: outcome feedback version is named');
  includes(tracker, 'Step 01 through Step 12 are complete', 'Deepening tracker: self-onboarding list is complete');
  equal(
    pkg.scripts['test:policy-foundry-outcome-feedback-loop'],
    'tsx tests/policy-foundry-outcome-feedback-loop.test.ts',
    'Package: outcome feedback test is exposed',
  );
}

try {
  testPositiveFeedbackBecomesScoringInputOnly();
  testIncompleteOrNegativeFeedbackStaysCollecting();
  testInvalidDigestsDoNotBecomeEvidence();
  testNoFeedbackIsExplicit();
  testDescriptorDocsAndPackageSurfaceStayAligned();
  ok(passed > 0, 'Policy Foundry outcome feedback loop tests executed');
  console.log(`Policy Foundry outcome feedback loop tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry outcome feedback loop tests failed:', error);
  process.exitCode = 1;
}
