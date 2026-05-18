import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
  INVARIANT_PROMOTION_GATE_VERSION,
  PROMOTION_GATE_RUNNER_VERSION,
  REVIEWER_OPEN_DEFEATER_VIEW_VERSION,
  createPromotionGateRunner,
  promotionGateRunnerDescriptor,
  type CandidateInvariantSynthesizerRecord,
  type CreatePromotionGateRunnerInput,
  type PromotionGateRunnerDangerFlag,
  type ReviewerOpenDefeaterViewRecord,
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

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const digestE = `sha256:${'e'.repeat(64)}`;
const digestF = `sha256:${'f'.repeat(64)}`;
const digest0 = `sha256:${'0'.repeat(64)}`;
const digest1 = `sha256:${'1'.repeat(64)}`;
const digest2 = `sha256:${'2'.repeat(64)}`;
const digest3 = `sha256:${'3'.repeat(64)}`;

function synthesizedClaim(
  overrides?: Partial<CandidateInvariantSynthesizerRecord>,
): CandidateInvariantSynthesizerRecord {
  return Object.freeze({
    version: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    digest: digestF,
    candidateInvariantDigest: digestC,
    invariantRefDigest: digestD,
    tenantRefDigest: digestA,
    cohortRefDigest: digestB,
    assuranceCaseRefDigest: digest0,
    claimNodeDigest: digest1,
    strategyNodeDigest: digest2,
    readyForOpenDefeaterReview: true,
    ...overrides,
  } as CandidateInvariantSynthesizerRecord);
}

function reviewerView(
  claim = synthesizedClaim(),
  overrides?: Partial<ReviewerOpenDefeaterViewRecord>,
): ReviewerOpenDefeaterViewRecord {
  return Object.freeze({
    version: REVIEWER_OPEN_DEFEATER_VIEW_VERSION,
    digest: digestE,
    synthesizedClaimDigest: claim.digest,
    candidateInvariantDigest: claim.candidateInvariantDigest,
    invariantRefDigest: claim.invariantRefDigest,
    tenantRefDigest: claim.tenantRefDigest,
    cohortRefDigest: claim.cohortRefDigest,
    assuranceCaseRefDigest: claim.assuranceCaseRefDigest,
    claimNodeDigest: claim.claimNodeDigest,
    strategyNodeDigest: claim.strategyNodeDigest,
    openDefeaterCount: 0,
    sourceRecordDigests: [digest3],
    readyForReviewer: true,
    readyForPromotionGateInput: true,
    ...overrides,
  } as ReviewerOpenDefeaterViewRecord);
}

function input(
  overrides?: Partial<CreatePromotionGateRunnerInput>,
): CreatePromotionGateRunnerInput {
  const claim = synthesizedClaim();
  return {
    synthesizedClaim: claim,
    reviewerView: reviewerView(claim),
    gateId: 'promotion-gate:i08:refund-authority',
    evaluatedAt: '2026-05-18T15:00:00.000Z',
    evaluatorRefDigest: digest3,
    ...overrides,
  };
}

function testDescriptorRecordsBoundaries(): void {
  const descriptor = promotionGateRunnerDescriptor();

  equal(descriptor.version, PROMOTION_GATE_RUNNER_VERSION, 'Promotion gate: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Promotion gate: binds assurance case');
  equal(descriptor.candidateInvariantSynthesizerVersion, CANDIDATE_INVARIANT_SYNTHESIZER_VERSION, 'Promotion gate: binds synthesized claim');
  equal(descriptor.reviewerOpenDefeaterViewVersion, REVIEWER_OPEN_DEFEATER_VIEW_VERSION, 'Promotion gate: binds reviewer view');
  equal(descriptor.invariantPromotionGateVersion, INVARIANT_PROMOTION_GATE_VERSION, 'Promotion gate: binds downstream invariant gate version');
  ok(descriptor.sourceAnchors.includes('assurance-2-indefeasibility-explicit-defeaters'), 'Promotion gate: Assurance 2.0 anchor is present');
  ok(descriptor.sourceAnchors.includes('cisa-ssvc-evidence-to-action-decision-tree'), 'Promotion gate: SSVC decision-tree anchor is present');
  equal(descriptor.requiresNoOpenDefeaters, true, 'Promotion gate: no-open-defeat is required');
  equal(descriptor.requiresAssuranceCaseBinding, true, 'Promotion gate: assurance case is required');
  equal(descriptor.handoffOnly, true, 'Promotion gate: only handoff is allowed');
  equal(descriptor.noReviewerDecision, true, 'Promotion gate: reviewer decision is forbidden');
  equal(descriptor.noDefeaterClosure, true, 'Promotion gate: defeater closure is forbidden');
  equal(descriptor.noPolicyActivation, true, 'Promotion gate: policy activation is forbidden');
  equal(descriptor.noLiveEnforcement, true, 'Promotion gate: live enforcement is forbidden');
  equal(descriptor.noPatchGeneration, true, 'Promotion gate: patch generation is forbidden');
  equal(descriptor.grantsAuthority, false, 'Promotion gate: grants no authority');
  equal(descriptor.canAdmit, false, 'Promotion gate: cannot admit');
  ok(descriptor.nonClaims.includes('not-policy-patch-generator'), 'Promotion gate: patch generator is a non-claim');
}

function testReadyViewCanHandoffOnly(): void {
  const record = createPromotionGateRunner(input());

  equal(record.version, PROMOTION_GATE_RUNNER_VERSION, 'Promotion gate: record version is explicit');
  equal(record.outcome, 'promotion-gate-ready-for-review-only-patch-handoff', 'Promotion gate: clean input is handoff-ready');
  equal(record.boundedIndefeasibilityPredicateSatisfied, true, 'Promotion gate: bounded predicate is satisfied');
  equal(record.readyForReviewOnlyPatchHandoff, true, 'Promotion gate: review-only patch handoff is ready');
  equal(record.reviewOnlyPatchHandoffAllowed, true, 'Promotion gate: handoff is allowed');
  equal(record.failClosed, false, 'Promotion gate: clean handoff does not fail closed');
  equal(record.openDefeaterCount, 0, 'Promotion gate: no open defeat remains');
  equal(record.predicateScope, 'reviewer-open-defeater-view', 'Promotion gate: predicate scope is bounded');
  equal(record.noReviewerDecision, true, 'Promotion gate: no reviewer decision is recorded');
  equal(record.noDefeaterClosure, true, 'Promotion gate: no defeater closure is recorded');
  equal(record.noPolicyActivation, true, 'Promotion gate: no policy activation is recorded');
  equal(record.noLiveEnforcement, true, 'Promotion gate: no live enforcement is recorded');
  equal(record.noPatchGeneration, true, 'Promotion gate: no patch generation is recorded');
  equal(record.canAdmit, false, 'Promotion gate: cannot admit');
  equal(record.activatesEnforcement, false, 'Promotion gate: cannot activate enforcement');
  ok(record.digest.startsWith('sha256:'), 'Promotion gate: record has digest');
}

function testOpenDefeatersAndViewHolds(): void {
  const claim = synthesizedClaim();
  const open = createPromotionGateRunner(input({
    synthesizedClaim: claim,
    reviewerView: reviewerView(claim, {
      openDefeaterCount: 2,
      readyForPromotionGateInput: false,
    }),
  }));
  const notReady = createPromotionGateRunner(input({
    reviewerView: reviewerView(synthesizedClaim(), {
      readyForReviewer: false,
      readyForPromotionGateInput: false,
      openDefeaterCount: 0,
    }),
  }));

  equal(open.outcome, 'promotion-gate-held-for-open-defeaters', 'Promotion gate: open defeat holds');
  ok(open.dangerFlags.includes('open-defeaters-present'), 'Promotion gate: open-defeater flag is explicit');
  equal(open.readyForReviewOnlyPatchHandoff, false, 'Promotion gate: open defeat blocks handoff');
  equal(open.failClosed, true, 'Promotion gate: open defeat fails closed');
  equal(notReady.outcome, 'promotion-gate-held-for-reviewer-view', 'Promotion gate: non-ready view holds');
  ok(notReady.dangerFlags.includes('reviewer-view-not-ready'), 'Promotion gate: reviewer view flag is explicit');
}

function testAssuranceCaseAndClaimReadinessHolds(): void {
  const noCase = synthesizedClaim({
    assuranceCaseRefDigest: null,
  });
  const noCaseRecord = createPromotionGateRunner(input({
    synthesizedClaim: noCase,
    reviewerView: reviewerView(noCase, {
      assuranceCaseRefDigest: null,
      readyForPromotionGateInput: true,
    }),
  }));
  const notReadyClaim = synthesizedClaim({
    readyForOpenDefeaterReview: false,
  });
  const notReadyRecord = createPromotionGateRunner(input({
    synthesizedClaim: notReadyClaim,
    reviewerView: reviewerView(notReadyClaim),
  }));

  equal(noCaseRecord.outcome, 'promotion-gate-held-for-assurance-case', 'Promotion gate: missing assurance case holds');
  ok(noCaseRecord.dangerFlags.includes('assurance-case-unbound'), 'Promotion gate: assurance-case flag is explicit');
  equal(notReadyRecord.outcome, 'promotion-gate-held-for-claim-readiness', 'Promotion gate: not-ready claim holds');
  ok(notReadyRecord.dangerFlags.includes('synthesized-claim-not-ready'), 'Promotion gate: claim readiness flag is explicit');
}

function testBoundaryRequestsAreRejected(): void {
  const cases: readonly [
    Partial<CreatePromotionGateRunnerInput>,
    PromotionGateRunnerDangerFlag,
  ][] = [
    [{ rawEvidenceRequested: true }, 'raw-evidence-requested'],
    [{ requestedAction: 'record-review-decision' }, 'reviewer-decision-requested'],
    [{ requestedAction: 'close-defeaters' }, 'defeater-closure-requested'],
    [{ requestedAction: 'activate-policy' }, 'policy-activation-requested'],
    [{ requestedAction: 'activate-live-enforcement' }, 'live-enforcement-requested'],
    [{ authorityActionRequested: true }, 'authority-action-requested'],
  ];

  for (const [overrides, flag] of cases) {
    const record = createPromotionGateRunner(input(overrides));
    equal(record.outcome, 'promotion-gate-rejected-boundary', `Promotion gate: ${flag} rejects boundary`);
    ok(record.dangerFlags.includes(flag), `Promotion gate: ${flag} flag is present`);
    equal(record.reviewOnlyPatchHandoffAllowed, false, `Promotion gate: ${flag} cannot hand off`);
  }
}

function testBindingMismatchesFailClosed(): void {
  const claim = synthesizedClaim();
  throws(
    () => createPromotionGateRunner(input({
      synthesizedClaim: claim,
      reviewerView: reviewerView(claim, { tenantRefDigest: digestB }),
    })),
    /tenant mismatch/u,
    'Promotion gate: tenant mismatch fails closed',
  );
  throws(
    () => createPromotionGateRunner(input({
      synthesizedClaim: claim,
      reviewerView: reviewerView(claim, { synthesizedClaimDigest: digestA }),
    })),
    /synthesized claim mismatch/u,
    'Promotion gate: synthesized claim mismatch fails closed',
  );
}

function testDeterministicAndImmutable(): void {
  const source = input();
  const before = JSON.stringify(source);
  const first = createPromotionGateRunner(source);
  const second = createPromotionGateRunner(source);

  equal(first.digest, second.digest, 'Promotion gate: identical input yields identical digest');
  equal(JSON.stringify(source), before, 'Promotion gate: input is not mutated');
  ok(Object.isFrozen(first), 'Promotion gate: output is frozen');
}

function testDocsAndPackageSurface(): void {
  const docs = readProjectFile('docs', '02-architecture', 'promotion-gate-runner.md');
  const overview = readProjectFile('docs', '02-architecture', 'consequence-runtime-assurance-overview.md');
  const annex = readProjectFile('docs', 'research', 'cross-domain-pattern-sources.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(docs, '# Promotion Gate Runner', 'Promotion gate docs: title is present');
  includes(docs, 'attestor.promotion-gate-runner.v1', 'Promotion gate docs: version is present');
  includes(docs, 'not-review-decision', 'Promotion gate docs: review decision non-claim is present');
  includes(docs, 'not-defeater-closure', 'Promotion gate docs: defeater closure non-claim is present');
  includes(docs, 'not-policy-activation', 'Promotion gate docs: policy activation non-claim is present');
  includes(overview, 'Progress: 10/14 complete after I09. 4 steps remain.', 'Overview: I08 progress is updated');
  includes(overview, 'src/consequence-admission/promotion-gate-runner.ts', 'Overview: I08 source file is tracked');
  includes(overview, 'I08 runs the bounded indefeasibility predicate', 'Overview: I08 explanation is present');
  includes(annex, 'Promotion gate runner', 'Research annex: I08 anchor is present');
  includes(annex, 'Promotion gates should execute a bounded indefeasibility predicate', 'Research annex: I08 translation rule is present');
  includes(ledger, 'docs/02-architecture/promotion-gate-runner.md', 'Research ledger: I08 doc is indexed');
  equal(
    packageJson.scripts['test:promotion-gate-runner'],
    'tsx tests/promotion-gate-runner.test.ts',
    'Promotion gate: package script is registered',
  );
}

testDescriptorRecordsBoundaries();
testReadyViewCanHandoffOnly();
testOpenDefeatersAndViewHolds();
testAssuranceCaseAndClaimReadinessHolds();
testBoundaryRequestsAreRejected();
testBindingMismatchesFailClosed();
testDeterministicAndImmutable();
testDocsAndPackageSurface();

console.log(`Promotion gate runner tests: ${passed} passed, 0 failed`);
