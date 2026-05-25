import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceHumanReviewFatigueGuardDescriptor,
  evaluateConsequenceHumanReviewFatigue,
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

function testCompactFocusedPacketPasses(): void {
  const decision = evaluateConsequenceHumanReviewFatigue({
    generatedAt: '2026-05-13T12:00:00.000Z',
    actionSurface: 'policy-foundry',
    action: 'review_refund_policy_candidate',
    reviewSurfaceKind: 'policy-foundry-hosted-review-surface',
    reviewPacketRef: 'review-packet:private/customer-refund-candidate',
    metrics: {
      totalReviewItems: 8,
      lowPriorityItems: 2,
      blockerItems: 0,
      noGoItems: 0,
      missingEvidenceItems: 0,
      focusAreaCount: 3,
      evidenceDigestCardCount: 4,
      taskCount: 4,
      findingCount: 2,
      reviewerInstructionCount: 3,
      estimatedReviewMinutes: 7,
      blockersFirst: true,
      hasNoGoSummary: true,
      hasMissingEvidenceSummary: true,
      hasReviewerFocusAreas: true,
      hasNextSafeStep: true,
      approvalRequired: true,
      rawPayloadStored: false,
      autoEnforceRequested: false,
      reviewDecisionCount: 12,
      approvedDecisionCount: 9,
      distinctReviewerCount: 3,
      medianDecisionSeconds: 45,
      minimumDecisionSeconds: 18,
      consecutiveApprovalCount: 4,
      reviewerBehaviorTelemetryPresent: true,
    },
  });
  const serialized = JSON.stringify(decision);

  equal(
    decision.version,
    'attestor.consequence-human-review-fatigue-guard.v1',
    'Human review fatigue guard: version is stable',
  );
  equal(decision.outcome, 'pass', 'Human review fatigue guard: compact packet passes');
  equal(decision.allowed, true, 'Human review fatigue guard: pass is allowed');
  equal(decision.failClosed, false, 'Human review fatigue guard: pass is not fail-closed');
  includes(
    decision.reasonCodes.join(','),
    'review-fatigue-pass',
    'Human review fatigue guard: pass reason is emitted',
  );
  equal(decision.observed.totalReviewItems, 8, 'Human review fatigue guard: total items are counted');
  equal(decision.observed.lowPriorityRatio, 0.25, 'Human review fatigue guard: low priority ratio is normalized');
  equal(decision.observed.approvalRatio, 0.75, 'Human review fatigue guard: behavior approval ratio is normalized');
  ok(decision.digest.startsWith('sha256:'), 'Human review fatigue guard: digest is generated');
  excludes(
    serialized,
    /private\/customer-refund-candidate/u,
    'Human review fatigue guard: raw packet reference is not serialized',
  );
}

function testNoGoWithoutSummaryBlocks(): void {
  const decision = evaluateConsequenceHumanReviewFatigue({
    generatedAt: '2026-05-13T12:01:00.000Z',
    reviewSurfaceKind: 'external-review-packet',
    metrics: {
      totalReviewItems: 9,
      lowPriorityItems: 1,
      blockerItems: 1,
      noGoItems: 1,
      missingEvidenceItems: 0,
      focusAreaCount: 2,
      evidenceDigestCardCount: 3,
      taskCount: 4,
      findingCount: 2,
      reviewerInstructionCount: 3,
      estimatedReviewMinutes: 6,
      blockersFirst: true,
      hasNoGoSummary: false,
      hasMissingEvidenceSummary: true,
      hasReviewerFocusAreas: true,
      hasNextSafeStep: true,
      approvalRequired: true,
      rawPayloadStored: false,
      autoEnforceRequested: false,
    },
  });

  equal(decision.outcome, 'block', 'Human review fatigue guard: hidden no-go summary blocks');
  equal(decision.allowed, false, 'Human review fatigue guard: block is not allowed');
  equal(decision.failClosed, true, 'Human review fatigue guard: block is fail-closed');
  includes(
    decision.reasonCodes.join(','),
    'no-go-summary-missing',
    'Human review fatigue guard: missing no-go summary reason is emitted',
  );
}

function testMissingEvidenceOrFocusRequiresReview(): void {
  const decision = evaluateConsequenceHumanReviewFatigue({
    generatedAt: '2026-05-13T12:02:00.000Z',
    reviewSurfaceKind: 'policy-foundry-hosted-review-surface',
    metrics: {
      totalReviewItems: 7,
      lowPriorityItems: 1,
      blockerItems: 0,
      noGoItems: 0,
      missingEvidenceItems: 2,
      focusAreaCount: 0,
      evidenceDigestCardCount: 2,
      taskCount: 3,
      findingCount: 2,
      reviewerInstructionCount: 2,
      estimatedReviewMinutes: 5,
      blockersFirst: true,
      hasNoGoSummary: true,
      hasMissingEvidenceSummary: false,
      hasReviewerFocusAreas: false,
      hasNextSafeStep: true,
      approvalRequired: true,
      rawPayloadStored: false,
      autoEnforceRequested: false,
    },
  });

  equal(decision.outcome, 'review', 'Human review fatigue guard: missing evidence and focus require review');
  equal(decision.allowed, false, 'Human review fatigue guard: review is not allowed to proceed');
  includes(
    decision.reasonCodes.join(','),
    'missing-evidence-summary-missing',
    'Human review fatigue guard: missing evidence summary reason is emitted',
  );
  includes(
    decision.reasonCodes.join(','),
    'reviewer-focus-areas-missing',
    'Human review fatigue guard: focus-area reason is emitted',
  );
}

function testNoisyPacketRequiresReview(): void {
  const decision = evaluateConsequenceHumanReviewFatigue({
    generatedAt: '2026-05-13T12:03:00.000Z',
    reviewSurfaceKind: 'custom-review-packet',
    metrics: {
      totalReviewItems: 20,
      lowPriorityItems: 14,
      blockerItems: 0,
      noGoItems: 0,
      missingEvidenceItems: 0,
      focusAreaCount: 2,
      evidenceDigestCardCount: 5,
      taskCount: 10,
      findingCount: 10,
      reviewerInstructionCount: 8,
      estimatedReviewMinutes: 18,
      blockersFirst: true,
      hasNoGoSummary: true,
      hasMissingEvidenceSummary: true,
      hasReviewerFocusAreas: true,
      hasNextSafeStep: true,
      approvalRequired: true,
      rawPayloadStored: false,
      autoEnforceRequested: false,
    },
  });

  equal(decision.outcome, 'review', 'Human review fatigue guard: noisy packet requires review');
  includes(
    decision.reasonCodes.join(','),
    'too-many-review-items',
    'Human review fatigue guard: too many items reason is emitted',
  );
  includes(
    decision.reasonCodes.join(','),
    'too-many-low-priority-items',
    'Human review fatigue guard: low-priority noise reason is emitted',
  );
  includes(
    decision.reasonCodes.join(','),
    'too-many-reviewer-instructions',
    'Human review fatigue guard: instruction count reason is emitted',
  );
  includes(
    decision.reasonCodes.join(','),
    'review-time-budget-exceeded',
    'Human review fatigue guard: review time budget reason is emitted',
  );
}

function testReviewerBehaviorAnomaliesRequireReview(): void {
  const decision = evaluateConsequenceHumanReviewFatigue({
    generatedAt: '2026-05-13T12:03:30.000Z',
    reviewSurfaceKind: 'policy-foundry-hosted-review-surface',
    metrics: {
      totalReviewItems: 8,
      lowPriorityItems: 1,
      blockerItems: 0,
      noGoItems: 0,
      missingEvidenceItems: 0,
      focusAreaCount: 3,
      evidenceDigestCardCount: 5,
      taskCount: 4,
      findingCount: 2,
      reviewerInstructionCount: 3,
      estimatedReviewMinutes: 7,
      blockersFirst: true,
      hasNoGoSummary: true,
      hasMissingEvidenceSummary: true,
      hasReviewerFocusAreas: true,
      hasNextSafeStep: true,
      approvalRequired: true,
      rawPayloadStored: false,
      autoEnforceRequested: false,
      reviewDecisionCount: 50,
      approvedDecisionCount: 49,
      distinctReviewerCount: 1,
      medianDecisionSeconds: 3,
      minimumDecisionSeconds: 1,
      consecutiveApprovalCount: 30,
      reviewerBehaviorTelemetryPresent: true,
    },
  });

  equal(decision.outcome, 'review', 'Human review fatigue guard: behavior anomalies require review');
  equal(decision.observed.approvalRatio, 0.98, 'Human review fatigue guard: approval ratio is derived');
  includes(
    decision.reasonCodes.join(','),
    'reviewer-approval-rate-high',
    'Human review fatigue guard: high approval-rate reason is emitted',
  );
  includes(
    decision.reasonCodes.join(','),
    'reviewer-decision-latency-too-low',
    'Human review fatigue guard: low decision-latency reason is emitted',
  );
  includes(
    decision.reasonCodes.join(','),
    'reviewer-distinct-count-too-low',
    'Human review fatigue guard: reviewer concentration reason is emitted',
  );
  includes(
    decision.reasonCodes.join(','),
    'reviewer-consecutive-approval-run-high',
    'Human review fatigue guard: consecutive approval reason is emitted',
  );
}

function testMissingReviewerBehaviorTelemetryRequiresReviewAfterEnoughDecisions(): void {
  const decision = evaluateConsequenceHumanReviewFatigue({
    generatedAt: '2026-05-13T12:03:45.000Z',
    reviewSurfaceKind: 'release-reviewer-queue',
    metrics: {
      totalReviewItems: 6,
      lowPriorityItems: 1,
      blockerItems: 0,
      noGoItems: 0,
      missingEvidenceItems: 0,
      focusAreaCount: 2,
      evidenceDigestCardCount: 3,
      taskCount: 3,
      findingCount: 1,
      reviewerInstructionCount: 2,
      estimatedReviewMinutes: 5,
      blockersFirst: true,
      hasNoGoSummary: true,
      hasMissingEvidenceSummary: true,
      hasReviewerFocusAreas: true,
      hasNextSafeStep: true,
      approvalRequired: true,
      rawPayloadStored: false,
      autoEnforceRequested: false,
      reviewDecisionCount: 12,
      approvedDecisionCount: 8,
      reviewerBehaviorTelemetryPresent: false,
    },
  });

  equal(decision.outcome, 'review', 'Human review fatigue guard: missing behavior telemetry requires review');
  includes(
    decision.reasonCodes.join(','),
    'reviewer-behavior-telemetry-missing',
    'Human review fatigue guard: missing behavior telemetry reason is emitted',
  );
}

function testUnsafeReviewPacketBlocks(): void {
  const decision = evaluateConsequenceHumanReviewFatigue({
    generatedAt: '2026-05-13T12:04:00.000Z',
    reviewSurfaceKind: 'external-review-packet',
    metrics: {
      totalReviewItems: 5,
      lowPriorityItems: 0,
      blockerItems: 1,
      noGoItems: 0,
      missingEvidenceItems: 0,
      focusAreaCount: 2,
      evidenceDigestCardCount: 4,
      taskCount: 2,
      findingCount: 2,
      reviewerInstructionCount: 2,
      estimatedReviewMinutes: 4,
      blockersFirst: false,
      hasNoGoSummary: true,
      hasMissingEvidenceSummary: true,
      hasReviewerFocusAreas: true,
      hasNextSafeStep: true,
      approvalRequired: false,
      rawPayloadStored: true,
      autoEnforceRequested: true,
    },
  });

  equal(decision.outcome, 'block', 'Human review fatigue guard: unsafe packet blocks');
  includes(
    decision.reasonCodes.join(','),
    'raw-payload-stored',
    'Human review fatigue guard: raw-payload reason is emitted',
  );
  includes(
    decision.reasonCodes.join(','),
    'auto-enforce-requested',
    'Human review fatigue guard: auto-enforce reason is emitted',
  );
  includes(
    decision.reasonCodes.join(','),
    'approval-not-required',
    'Human review fatigue guard: approval-required reason is emitted',
  );
  includes(
    decision.reasonCodes.join(','),
    'blockers-not-prioritized',
    'Human review fatigue guard: blocker ordering reason is emitted',
  );
}

function testMissingPacketBlocks(): void {
  const decision = evaluateConsequenceHumanReviewFatigue({
    generatedAt: '2026-05-13T12:05:00.000Z',
    reviewSurfaceKind: 'custom-review-packet',
    metrics: null,
  });

  equal(decision.outcome, 'block', 'Human review fatigue guard: missing packet blocks');
  includes(
    decision.reasonCodes.join(','),
    'review-packet-missing',
    'Human review fatigue guard: missing packet reason is emitted',
  );
}

function testDescriptorAndDocsStayAligned(): void {
  const descriptor = consequenceHumanReviewFatigueGuardDescriptor();
  const registry = readProjectFile('src', 'consequence-admission', 'failure-mode-registry.ts');
  const bindings = readProjectFile('src', 'consequence-admission', 'failure-mode-control-bindings.ts');
  const docs = readProjectFile('docs', '02-architecture', 'human-review-fatigue-guard.md');
  const packageJson = readProjectFile('package.json');
  const publicSurface = readProjectFile('src', 'consequence-admission', 'public-surface.ts');

  equal(
    descriptor.version,
    'attestor.consequence-human-review-fatigue-guard.v1',
    'Human review fatigue guard descriptor: version is stable',
  );
  ok(
    descriptor.reasonCodes.includes('no-go-summary-missing'),
    'Human review fatigue guard descriptor: no-go reason is declared',
  );
  ok(
    descriptor.reasonCodes.includes('reviewer-approval-rate-high'),
    'Human review fatigue guard descriptor: reviewer behavior reason is declared',
  );
  equal(
    descriptor.defaultMaxApprovalRatio,
    0.95,
    'Human review fatigue guard descriptor: approval ratio threshold is declared',
  );
  equal(descriptor.storesRawReviewPacket, false, 'Human review fatigue guard descriptor: raw packet storage is false');
  includes(
    registry,
    "evidence('code', 'src/consequence-admission/human-review-fatigue-guard.ts'",
    'Human review fatigue guard registry: code evidence is recorded',
  );
  includes(
    registry,
    "evidence('test', 'tests/human-review-fatigue-guard.test.ts'",
    'Human review fatigue guard registry: test evidence is recorded',
  );
  includes(
    bindings,
    'reviewer-load and aggregate reviewer-behavior scoring are implemented as deterministic guard signals',
    'Human review fatigue guard bindings: limitation reflects implemented guard',
  );
  includes(
    docs,
    'NIST AI 600-1',
    'Human review fatigue guard docs: NIST source is documented',
  );
  includes(
    docs,
    'test:human-review-fatigue-guard',
    'Human review fatigue guard docs: test command is documented',
  );
  includes(
    docs,
    'aggregate reviewer-behavior signals',
    'Human review fatigue guard docs: behavior telemetry scope is documented',
  );
  includes(
    packageJson,
    '"test:human-review-fatigue-guard"',
    'Human review fatigue guard package: script is registered',
  );
  includes(
    publicSurface,
    "export * from './human-review-fatigue-guard.js';",
    'Human review fatigue guard public surface: module is exported',
  );
}

function run(): void {
  testCompactFocusedPacketPasses();
  testNoGoWithoutSummaryBlocks();
  testMissingEvidenceOrFocusRequiresReview();
  testNoisyPacketRequiresReview();
  testReviewerBehaviorAnomaliesRequireReview();
  testMissingReviewerBehaviorTelemetryRequiresReviewAfterEnoughDecisions();
  testUnsafeReviewPacketBlocks();
  testMissingPacketBlocks();
  testDescriptorAndDocsStayAligned();
  console.log(`Human review fatigue guard tests: ${passed} passed, 0 failed`);
}

try {
  run();
} catch (error) {
  console.error('Human review fatigue guard tests failed:', error);
  process.exitCode = 1;
}
