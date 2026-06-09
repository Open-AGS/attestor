import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACTIVE_QUESTION_ENGINE_VERSION,
  CONFLICT_ABSTENTION_GATE_VERSION,
  HUMAN_COMPREHENSION_GATE_VERSION,
  HUMAN_COMPREHENSION_LIMITS,
  evaluateHumanComprehensionGate,
  humanComprehensionGateDescriptor,
  type ActiveQuestion,
  type ConflictAbstentionGateResult,
  type HumanComprehensionActiveQuestionRef,
  type HumanComprehensionReasonLineInput,
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

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;

function conflictGate(
  outcome: ConflictAbstentionGateResult['outcome'],
  reasonCodes: ConflictAbstentionGateResult['reasonCodes'] = ['no-admit-authority'],
): ConflictAbstentionGateResult {
  const blockPressure = outcome === 'block-pressure' ? 0.8 : 0;
  const reviewPressure = outcome === 'review' ? 0.5 : 0.1;
  return {
    version: CONFLICT_ABSTENTION_GATE_VERSION,
    relationshipAwareMonotoneFusionVersion:
      'attestor.relationship-aware-monotone-fusion.v1',
    signalRelationshipContractVersion: 'attestor.signal-relationship-contract.v1',
    layerOpinionSchemaVersion: 'attestor.layer-opinion-schema.v1',
    modulatorAuthorityTierVersion: 'attestor.modulator-authority-tier.v1',
    envelopeRefDigest: digestA,
    outcome,
    conflictScore: outcome === 'block-pressure' ? 0.7 : 0.1,
    abstentionScore: outcome === 'abstain-hold' ? 0.7 : 0.1,
    uncertaintyScore: outcome === 'review' ? 0.5 : 0.1,
    coverageGapScore: outcome === 'abstain-hold' ? 0.5 : 0.1,
    blockPressure,
    reviewPressure,
    maxGateScore: Math.max(blockPressure, reviewPressure, 0.1),
    reasonCodes,
    reviewedInputs: {
      opinionCount: 2,
      relationshipCount: 1,
      modulatorCount: 1,
      abstentionCount: outcome === 'abstain-hold' ? 1 : 0,
      contradictionCount: outcome === 'block-pressure' ? 1 : 0,
      conflictOpinionCount: outcome === 'block-pressure' ? 1 : 0,
    },
    noLoosening: true,
    failClosedOnUncertainty: true,
    runsAfterRelationshipAwareFusion: true,
    canAdmit: false,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };
}

function reasonLine(
  lineId: string,
  severity: HumanComprehensionReasonLineInput['severity'],
  text = `Review ${lineId}`,
): HumanComprehensionReasonLineInput {
  return {
    lineId,
    severity,
    text,
    sourceDigest: digestB,
    reasonCodes: [`reason-${lineId}`],
    actionHint: `Handle ${lineId}`,
  };
}

function question(
  id: string,
  priorityScore: number,
  impactBand: ActiveQuestion['impactBand'] = 'medium',
): HumanComprehensionActiveQuestionRef {
  return {
    questionId: id,
    questionDigest: digestB,
    prompt: `Question ${id}?`,
    expectedAnswerKind: 'choice',
    impactBand,
    priorityScore,
    resolvesReasonCodes: [`question-${id}`],
  };
}

function testDescriptorRecordsHumanLimitsAndNoAuthority(): void {
  const descriptor = humanComprehensionGateDescriptor();

  equal(
    descriptor.version,
    HUMAN_COMPREHENSION_GATE_VERSION,
    'Human comprehension gate: descriptor exposes version',
  );
  equal(
    descriptor.conflictAbstentionGateVersion,
    CONFLICT_ABSTENTION_GATE_VERSION,
    'Human comprehension gate: descriptor links conflict gate',
  );
  equal(
    descriptor.activeQuestionEngineVersion,
    ACTIVE_QUESTION_ENGINE_VERSION,
    'Human comprehension gate: descriptor links active question engine',
  );
  equal(descriptor.limits.maxReasonLines, 7, 'Human comprehension gate: max reason lines is 7');
  equal(
    descriptor.limits.defaultActiveQuestionCap,
    3,
    'Human comprehension gate: default active question cap is 3',
  );
  equal(descriptor.maxReasonLinesEnforced, true, 'Human comprehension gate: reason cap is enforced');
  equal(descriptor.activeQuestionCapEnforced, true, 'Human comprehension gate: question cap is enforced');
  equal(descriptor.reviewLoadVisible, true, 'Human comprehension gate: review load is visible');
  equal(descriptor.noNoisyDashboard, true, 'Human comprehension gate: noisy dashboard is rejected');
  equal(descriptor.canAdmit, false, 'Human comprehension gate: descriptor cannot admit');
  equal(descriptor.grantsAuthority, false, 'Human comprehension gate: descriptor cannot grant authority');
  equal(descriptor.activatesEnforcement, false, 'Human comprehension gate: descriptor cannot activate enforcement');
  equal(descriptor.autoEnforce, false, 'Human comprehension gate: descriptor cannot auto-enforce');
  equal(descriptor.productionReady, false, 'Human comprehension gate: descriptor is not production readiness');
}

function testReasonLinesAreCappedAndRanked(): void {
  const result = evaluateHumanComprehensionGate({
    envelopeRefDigest: digestA,
    conflictGate: conflictGate('review', ['conflict-pressure-high', 'no-admit-authority']),
    reasonLineCandidates: [
      reasonLine('info-a', 'info'),
      reasonLine('review-a', 'review'),
      reasonLine('watch-a', 'watch'),
      reasonLine('escalate-a', 'escalate'),
      reasonLine('review-b', 'review'),
      reasonLine('watch-b', 'watch'),
      reasonLine('info-b', 'info'),
      reasonLine('review-c', 'review'),
      reasonLine('escalate-b', 'escalate'),
    ],
    activeQuestions: [],
    reviewLoad: {
      pendingReviewItemCount: 4,
      humanActionItemCount: 1,
      reviewerCapacityPerHour: 20,
      currentReviewRatePerMinute: 0.5,
    },
  });

  equal(result.reasonLineCount, 7, 'Human comprehension gate: reason lines are capped at 7');
  equal(result.omittedReasonLineCount, 2, 'Human comprehension gate: omitted reason lines are counted');
  equal(result.reasonLines[0]?.severity, 'escalate', 'Human comprehension gate: highest severity ranks first');
  ok(
    result.reasonCodes.includes('reason-line-limit-applied'),
    'Human comprehension gate: reason line cap reason is retained',
  );
  equal(result.boundedForHumanReview, true, 'Human comprehension gate: output is bounded');
}

function testActiveQuestionsAreCappedAndRanked(): void {
  const result = evaluateHumanComprehensionGate({
    envelopeRefDigest: digestA,
    conflictGate: conflictGate('review', ['uncertainty-high', 'no-admit-authority']),
    reasonLineCandidates: [reasonLine('review-a', 'review')],
    activeQuestions: [
      question('q-low', 10, 'low'),
      question('q-critical', 90, 'critical'),
      question('q-high', 80, 'high'),
      question('q-medium', 50, 'medium'),
      question('q-extra', 40, 'medium'),
    ],
    reviewLoad: {
      pendingReviewItemCount: 8,
      humanActionItemCount: 3,
      reviewerCapacityPerHour: 20,
      currentReviewRatePerMinute: 1,
    },
  });

  equal(
    result.activeQuestionCount,
    HUMAN_COMPREHENSION_LIMITS.defaultActiveQuestionCap,
    'Human comprehension gate: active questions use default cap',
  );
  equal(result.omittedActiveQuestionCount, 2, 'Human comprehension gate: omitted questions are counted');
  equal(result.activeQuestions[0]?.questionId, 'q-critical', 'Human comprehension gate: highest priority question ranks first');
  ok(
    result.reasonCodes.includes('active-question-cap-applied'),
    'Human comprehension gate: question cap reason is retained',
  );
  equal(result.status, 'needs-human-review', 'Human comprehension gate: questions require review');
}

function testEscalationAndReviewLoadAreVisible(): void {
  const result = evaluateHumanComprehensionGate({
    envelopeRefDigest: digestA,
    conflictGate: conflictGate('abstain-hold', ['weighted-abstention-high', 'no-admit-authority']),
    reasonLineCandidates: [reasonLine('hold-a', 'escalate')],
    activeQuestions: [question('q-hold', 95, 'critical')],
    reviewLoad: {
      pendingReviewItemCount: 50,
      humanActionItemCount: 18,
      reviewerCapacityPerHour: 20,
      currentReviewRatePerMinute: 4,
    },
  });

  equal(result.status, 'overloaded', 'Human comprehension gate: overloaded review load is visible');
  equal(result.reviewLoad.band, 'overloaded', 'Human comprehension gate: review load band is overloaded');
  equal(result.escalationRequired, true, 'Human comprehension gate: escalation is required');
  ok(result.reasonCodes.includes('review-load-overloaded'), 'Human comprehension gate: overload reason is retained');
  ok(result.reasonCodes.includes('conflict-gate-hold'), 'Human comprehension gate: source hold reason is retained');
}

function testCompactContinueDoesNotAdmit(): void {
  const result = evaluateHumanComprehensionGate({
    envelopeRefDigest: digestA,
    conflictGate: conflictGate('continue', ['no-admit-authority']),
    reasonLineCandidates: [reasonLine('info-a', 'info')],
    activeQuestions: [],
    reviewLoad: {
      pendingReviewItemCount: 0,
      humanActionItemCount: 0,
      reviewerCapacityPerHour: 20,
      currentReviewRatePerMinute: 0,
    },
  });

  equal(result.status, 'compact', 'Human comprehension gate: clear compact packet is compact');
  equal(result.canAdmit, false, 'Human comprehension gate: compact is not admit');
  equal(result.grantsAuthority, false, 'Human comprehension gate: compact grants no authority');
  equal(result.activatesEnforcement, false, 'Human comprehension gate: compact activates no enforcement');
  ok(result.reasonCodes.includes('no-admit-authority'), 'Human comprehension gate: no-admit reason is retained');
}

function testInvalidEnvelopeDigestIsRejected(): void {
  assert.throws(
    () => evaluateHumanComprehensionGate({
      envelopeRefDigest: digestA,
      conflictGate: {
        ...conflictGate('review'),
        envelopeRefDigest: `sha256:${'c'.repeat(64)}`,
      },
      reasonLineCandidates: [],
      activeQuestions: [],
      reviewLoad: {
        pendingReviewItemCount: 0,
        humanActionItemCount: 0,
        reviewerCapacityPerHour: 20,
        currentReviewRatePerMinute: 0,
      },
    }),
    /conflict gate envelope digest must match/u,
    'Human comprehension gate: mismatched conflict gate digest is rejected',
  );
  passed += 1;
}

function testDocsOverviewAndPackageScriptStayAligned(): void {
  const contractDoc = readProjectFile(
    'docs',
    '02-architecture',
    'human-comprehension-gate.md',
  );
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '# Human Comprehension Gate',
    'attestor.human-comprehension-gate.v1',
    'HumanComprehensionGateResult',
    'humanComprehensionGateDescriptor()',
    'evaluateHumanComprehensionGate()',
    'max reason lines: 7',
    'default active question cap: 3',
    'hard escalation: 600 seconds',
    'boundedForHumanReview = true',
    'noNoisyDashboard = true',
    'canAdmit = false',
    'NIST AI RMF Appendix C',
    'NASA Human Systems Integration',
    'Google SRE practical alerting',
    'Microsoft Human-AI Interaction Guidelines',
    'not a human-factors',
    'not live reviewer capacity',
  ]) {
    includes(contractDoc, expected, `Human comprehension docs: records ${expected}`);
  }

  includes(
    overview,
    '| 07 | complete | Human comprehension gate |',
    'Consequence runtime assurance overview: Step 07 is marked complete',
  );
  includes(
    overview,
    'src/consequence-admission/human-comprehension-gate.ts',
    'Consequence runtime assurance overview: implementation file is recorded',
  );
  includes(
    overview,
    'src/consequence-admission/signed-assurance-packet.ts',
    'Consequence runtime assurance overview: next implementation file is recorded',
  );
  equal(
    packageJson.scripts['test:human-comprehension-gate'],
    'tsx tests/human-comprehension-gate.test.ts',
    'Human comprehension gate: package script is registered',
  );
}

testDescriptorRecordsHumanLimitsAndNoAuthority();
testReasonLinesAreCappedAndRanked();
testActiveQuestionsAreCappedAndRanked();
testEscalationAndReviewLoadAreVisible();
testCompactContinueDoesNotAdmit();
testInvalidEnvelopeDigestIsRejected();
testDocsOverviewAndPackageScriptStayAligned();

console.log(`Human comprehension gate tests: ${passed} passed, 0 failed`);
