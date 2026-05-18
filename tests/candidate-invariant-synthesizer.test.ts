import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  BASELINE_COHORT_BUILDER_VERSION,
  CANDIDATE_INVARIANTS_CATALOG_VERSION,
  CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
  candidateInvariantSynthesizerDescriptor,
  createBaselineCohortCandidate,
  createBaselineCohortEvidence,
  createBaselineCohortSourceFromShadowEvent,
  createCandidateInvariantFromBaseline,
  createCanonicalShadowEvent,
  createLearnedArtifactReleaseBudget,
  createShadowDataQualityGate,
  synthesizeCandidateInvariantAssuranceCase,
  type BaselineCohortBuilderRecord,
  type BaselineCohortCandidate,
  type CandidateInvariant,
  type CanonicalShadowEvent,
  type CreateCanonicalShadowEventInput,
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
const digest4 = `sha256:${'4'.repeat(64)}`;
const digest5 = `sha256:${'5'.repeat(64)}`;

function canonicalInput(
  suffix: string,
  overrides?: Partial<CreateCanonicalShadowEventInput>,
): CreateCanonicalShadowEventInput {
  return {
    occurredAt: `2026-05-18T11:00:0${suffix}.000Z`,
    observedAt: `2026-05-18T11:01:0${suffix}.000Z`,
    sourceKind: 'admission-shadow',
    producer: 'attestor.consequence-admission',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest: digestC,
      actionName: 'issue_refund',
      actionKind: 'api-operation',
      consequenceClass: 'financial',
      resourceRefDigest: digestD,
      dataClass: 'money-movement',
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: null,
    decision: {
      admissionDigest: digestE,
      mode: 'observe',
      shadowDecision: 'would_narrow',
      effectiveDecision: 'narrow',
      allowed: false,
      failClosed: true,
      reasonCodes: [`candidate-invariant-synthesizer-${suffix}`],
    },
    outcome: {
      downstreamOutcome: null,
      humanOutcome: null,
    },
    evidenceRefs: [
      { kind: 'evidence', digest: digestE, origin: 'observed' },
      { kind: 'provenance', digest: digestF, origin: 'observed' },
    ],
    approvalRefs: [{ kind: 'approval', digest: digest0, origin: 'operator-supplied' }],
    receiptRefs: [{ kind: 'receipt', digest: digest1, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digestC, origin: 'observed' }],
    idempotencyRefDigest: digestD,
    replayRefDigest: digestE,
    traceRefDigest: digestF,
    schemaRefDigest: digest0,
    rawMaterialPolicy: 'digest-only',
    ...overrides,
  };
}

function event(suffix: string, overrides?: Partial<CreateCanonicalShadowEventInput>):
  CanonicalShadowEvent {
  return createCanonicalShadowEvent(canonicalInput(suffix, overrides));
}

function cohortFixture(overrides?: {
  readonly heldEvidence?: boolean;
  readonly noAssuranceCase?: boolean;
}): {
  readonly candidate: BaselineCohortCandidate;
  readonly baselineEvidence: BaselineCohortBuilderRecord;
} {
  const events = [
    event('1'),
    event('2'),
    overrides?.heldEvidence
      ? event('3', { evidenceRefs: [], schemaRefDigest: null })
      : event('3'),
  ];
  const candidate = createBaselineCohortCandidate({
    cohortId: 'cohort:refunds:i04',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-18T11:02:00.000Z',
    sourceEvents: events.map((shadowEvent) =>
      createBaselineCohortSourceFromShadowEvent({
        event: shadowEvent,
        envelopeRefDigest: digest2,
        traceRefDigest: digestF,
      })),
    reviewerAffirmed: true,
    reviewerRefDigest: digestB,
  });
  const releaseBudget = createLearnedArtifactReleaseBudget({
    artifactId: 'learned-artifact:baseline-cohort-summary:i04',
    artifactKind: 'baseline-cohort-summary',
    artifactRefDigest: candidate.digest,
    tenantRefDigest: candidate.tenantRefDigest,
    cohortRefDigest: candidate.cohortRefDigest,
    generatedAt: '2026-05-18T11:03:00.000Z',
    requestedReleaseMode: 'assurance-review',
    sourceEventCount: candidate.sourceEventCount,
    minimumCohortEventCount: 3,
    privacyBudget: {
      budgetId: 'budget:tenant-a:i04',
      budgetRefDigest: digest3,
      tenantRefDigest: candidate.tenantRefDigest,
      cohortRefDigest: candidate.cohortRefDigest,
      totalBudgetUnits: 100,
      spentBudgetUnits: 5,
      requestedBudgetUnits: 5,
      expiresAt: '2026-06-18T11:00:00.000Z',
      accountingMode: 'release-budget-only',
      externalDpProofRefDigest: null,
    },
    reconstructionRisk: {
      riskLevel: 'low',
      reconstructionAttackConsidered: true,
      highResolutionPattern: false,
      uniqueSubjectRisk: false,
      frequentPatternCandidate: false,
      mitigationRefDigest: digest4,
    },
    assuranceCaseRefDigest: digest0,
    reviewerRefDigest: digest5,
  });
  const qualityGates = events.map((shadowEvent) =>
    createShadowDataQualityGate({
      event: shadowEvent,
      evaluatedAt: '2026-05-18T11:04:00.000Z',
      evaluatorRefDigest: digest1,
      assuranceCaseRefDigest: digest0,
      attacksNodeId: 'evidence:baseline-cohort:i04',
      trustedProducers: ['attestor.consequence-admission'],
    }));
  const baselineEvidence = createBaselineCohortEvidence({
    candidate,
    qualityGates,
    releaseBudget,
    assuranceCaseRefDigest: overrides?.noAssuranceCase ? null : digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T11:05:00.000Z',
  });
  return { candidate, baselineEvidence };
}

function invariantFor(
  candidate: BaselineCohortCandidate,
  overrides?: {
    readonly frequencyOnly?: boolean;
    readonly relaxation?: boolean;
    readonly missingReviewer?: boolean;
  },
): CandidateInvariant {
  return createCandidateInvariantFromBaseline({
    candidateId: 'candidate:refund-authority-evidence:i04',
    generatedAt: '2026-05-18T11:06:00.000Z',
    kind: 'authority-evidence-required',
    effect: overrides?.relaxation ? 'relaxation-requested' : 'strengthen-only',
    pattern: {
      templateKind: 'always',
      naturalLanguage: 'Refund create requests must include authority evidence.',
      formalShape: 'G(refund.create -> authorityEvidenceDigest.present)',
      parameters: {
        actionType: 'refund.create',
        evidenceKind: 'authority',
      },
    },
    scope: {
      tenantRefDigest: candidate.tenantRefDigest,
      baselineCohortRefDigest: candidate.cohortRefDigest,
      consequenceClass: 'financial',
      actionType: 'refund.create',
      appliesToPackFamilies: ['finance', 'general'],
    },
    baselineCohort: candidate,
    evidenceBases: overrides?.frequencyOnly
      ? ['frequency-only']
      : ['baseline-cohort', 'counterexample-replay', 'operator-review'],
    evidenceRefDigests: [digestF],
    counterexampleReplayRefDigest: digestE,
    reviewerRefDigest: overrides?.missingReviewer ? null : digestF,
  });
}

function testDescriptorRecordsBoundaries(): void {
  const descriptor = candidateInvariantSynthesizerDescriptor();

  equal(descriptor.version, CANDIDATE_INVARIANT_SYNTHESIZER_VERSION, 'Candidate invariant synthesizer: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Candidate invariant synthesizer: binds assurance case contract');
  equal(descriptor.baselineCohortBuilderVersion, BASELINE_COHORT_BUILDER_VERSION, 'Candidate invariant synthesizer: binds baseline cohort builder');
  equal(descriptor.candidateInvariantsCatalogVersion, CANDIDATE_INVARIANTS_CATALOG_VERSION, 'Candidate invariant synthesizer: binds candidate invariant catalog');
  ok(descriptor.sourceAnchors.includes('daikon-likely-invariant-not-proof'), 'Candidate invariant synthesizer: Daikon anchor is present');
  ok(descriptor.sourceAnchors.includes('texada-ltl-specification-mining'), 'Candidate invariant synthesizer: Texada anchor is present');
  ok(descriptor.sourceAnchors.includes('synoptic-log-invariant-mining'), 'Candidate invariant synthesizer: Synoptic anchor is present');
  ok(descriptor.sourceAnchors.includes('dwyer-property-specification-patterns'), 'Candidate invariant synthesizer: Dwyer anchor is present');
  ok(descriptor.sourceAnchors.includes('codeql-modeling-alert-family-suppression'), 'Candidate invariant synthesizer: CodeQL anchor is present');
  equal(descriptor.createsClaimNode, true, 'Candidate invariant synthesizer: creates claim node');
  equal(descriptor.createsStrategyNode, true, 'Candidate invariant synthesizer: creates strategy node');
  equal(descriptor.requiresBaselineEvidenceReady, true, 'Candidate invariant synthesizer: baseline evidence readiness is required');
  equal(descriptor.requiresCandidateReviewReady, true, 'Candidate invariant synthesizer: candidate review readiness is required');
  equal(descriptor.noMining, true, 'Candidate invariant synthesizer: mining is forbidden');
  equal(descriptor.noLearning, true, 'Candidate invariant synthesizer: learning is forbidden');
  equal(descriptor.noAutoPromotion, true, 'Candidate invariant synthesizer: auto-promotion is forbidden');
  equal(descriptor.canAdmit, false, 'Candidate invariant synthesizer: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Candidate invariant synthesizer: descriptor cannot enforce');
  equal(descriptor.productionReady, false, 'Candidate invariant synthesizer: descriptor is not production readiness');
  ok(descriptor.nonClaims.includes('not-invariant-mining-engine'), 'Candidate invariant synthesizer: mining engine is a non-claim');
}

function testReadyCandidateCreatesClaimAndStrategyNodes(): void {
  const { candidate, baselineEvidence } = cohortFixture();
  const candidateInvariant = invariantFor(candidate);
  const record = synthesizeCandidateInvariantAssuranceCase({
    baselineEvidence,
    candidateInvariant,
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T11:07:00.000Z',
  });

  equal(record.version, CANDIDATE_INVARIANT_SYNTHESIZER_VERSION, 'Candidate invariant synthesizer: record version is explicit');
  equal(record.outcome, 'invariant-claim-ready-for-open-defeater-review', 'Candidate invariant synthesizer: ready input creates reviewable claim');
  equal(record.readyForOpenDefeaterReview, true, 'Candidate invariant synthesizer: readiness is true');
  equal(record.underminingDefeaterRequired, false, 'Candidate invariant synthesizer: ready input needs no new defeater');
  equal(record.claimNode?.kind, 'claim', 'Candidate invariant synthesizer: claim node is created');
  equal(record.strategyNode?.kind, 'strategy', 'Candidate invariant synthesizer: strategy node is created');
  equal(record.claimNode?.scopeDigest, candidateInvariant.invariantRefDigest, 'Candidate invariant synthesizer: claim is invariant-scoped');
  equal(record.strategyNode?.scopeDigest, candidateInvariant.invariantRefDigest, 'Candidate invariant synthesizer: strategy is invariant-scoped');
  equal(record.claimTransition?.transitionKind, 'create-node', 'Candidate invariant synthesizer: claim transition is recorded');
  equal(record.strategyTransition?.transitionKind, 'create-node', 'Candidate invariant synthesizer: strategy transition is recorded');
  equal(record.claimOnly, true, 'Candidate invariant synthesizer: output is claim-only');
  equal(record.reviewOnly, true, 'Candidate invariant synthesizer: output is review-only');
  equal(record.noPolicyActivation, true, 'Candidate invariant synthesizer: policy activation is forbidden');
  equal(record.canAdmit, false, 'Candidate invariant synthesizer: record cannot admit');
  equal(record.activatesEnforcement, false, 'Candidate invariant synthesizer: record cannot enforce');
  ok(record.digest.startsWith('sha256:'), 'Candidate invariant synthesizer: record has digest');
}

function testHeldInputsCreateNoNodes(): void {
  const heldFixture = cohortFixture({ heldEvidence: true });
  const heldInvariant = invariantFor(heldFixture.candidate);
  const heldBaseline = synthesizeCandidateInvariantAssuranceCase({
    baselineEvidence: heldFixture.baselineEvidence,
    candidateInvariant: heldInvariant,
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T11:07:00.000Z',
  });
  const cleanFixture = cohortFixture();
  const candidateNotReady = synthesizeCandidateInvariantAssuranceCase({
    baselineEvidence: cleanFixture.baselineEvidence,
    candidateInvariant: invariantFor(cleanFixture.candidate, { missingReviewer: true }),
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T11:07:00.000Z',
  });
  const noCase = synthesizeCandidateInvariantAssuranceCase({
    baselineEvidence: cleanFixture.baselineEvidence,
    candidateInvariant: invariantFor(cleanFixture.candidate),
    assuranceCaseRefDigest: null,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T11:07:00.000Z',
  });

  equal(heldBaseline.outcome, 'invariant-held-for-baseline-evidence', 'Candidate invariant synthesizer: held baseline evidence holds');
  ok(heldBaseline.dangerFlags.includes('baseline-evidence-not-ready'), 'Candidate invariant synthesizer: baseline evidence flag is present');
  equal(heldBaseline.claimNode, null, 'Candidate invariant synthesizer: held baseline creates no claim node');
  equal(candidateNotReady.outcome, 'invariant-held-for-candidate-readiness', 'Candidate invariant synthesizer: unready candidate holds');
  ok(candidateNotReady.dangerFlags.includes('candidate-not-review-ready'), 'Candidate invariant synthesizer: candidate readiness flag is present');
  equal(candidateNotReady.strategyNode, null, 'Candidate invariant synthesizer: unready candidate creates no strategy node');
  equal(noCase.outcome, 'invariant-held-for-assurance-case', 'Candidate invariant synthesizer: missing assurance case holds');
  ok(noCase.dangerFlags.includes('assurance-case-unbound'), 'Candidate invariant synthesizer: assurance-case flag is present');
}

function testDangerFlagsAndScopeMismatch(): void {
  const { candidate, baselineEvidence } = cohortFixture();
  const frequency = synthesizeCandidateInvariantAssuranceCase({
    baselineEvidence,
    candidateInvariant: invariantFor(candidate, { frequencyOnly: true }),
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T11:07:00.000Z',
  });
  const relaxation = synthesizeCandidateInvariantAssuranceCase({
    baselineEvidence,
    candidateInvariant: invariantFor(candidate, { relaxation: true }),
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T11:07:00.000Z',
  });

  equal(frequency.outcome, 'invariant-rejected-danger-flag', 'Candidate invariant synthesizer: frequency-only danger rejects');
  ok(frequency.dangerFlags.includes('frequency-safety-danger'), 'Candidate invariant synthesizer: frequency danger flag is present');
  equal(relaxation.outcome, 'invariant-rejected-danger-flag', 'Candidate invariant synthesizer: relaxation danger rejects');
  ok(relaxation.dangerFlags.includes('relaxation-danger'), 'Candidate invariant synthesizer: relaxation danger flag is present');

  throws(
    () => synthesizeCandidateInvariantAssuranceCase({
      baselineEvidence: {
        ...baselineEvidence,
        tenantRefDigest: digestC,
      },
      candidateInvariant: invariantFor(candidate),
      assuranceCaseRefDigest: digest0,
      createdByRefDigest: digestB,
      createdAt: '2026-05-18T11:07:00.000Z',
    }),
    /tenant mismatch/u,
    'Candidate invariant synthesizer: tenant mismatch fails closed',
  );
}

function testDeterminismAndNoMutation(): void {
  const { candidate, baselineEvidence } = cohortFixture();
  const candidateInvariant = invariantFor(candidate);
  const input = {
    baselineEvidence,
    candidateInvariant,
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T11:07:00.000Z',
  } as const;
  const before = JSON.stringify(input);
  const first = synthesizeCandidateInvariantAssuranceCase(input);
  const second = synthesizeCandidateInvariantAssuranceCase(input);

  equal(first.digest, second.digest, 'Candidate invariant synthesizer: identical input yields identical digest');
  equal(JSON.stringify(input), before, 'Candidate invariant synthesizer: input is not mutated');
  ok(Object.isFrozen(first), 'Candidate invariant synthesizer: record is frozen');
}

function testDocsPackageAndOverview(): void {
  const docs = readProjectFile(
    'docs',
    '02-architecture',
    'candidate-invariant-synthesizer.md',
  );
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const annex = readProjectFile('docs', 'research', 'cross-domain-pattern-sources.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile(
    'scripts',
    'probe-consequence-admission-package-surface.mjs',
  );

  for (const expected of [
    '# Candidate Invariant Synthesizer',
    'I04',
    'Daikon',
    'Texada',
    'Synoptic',
    'Dwyer',
    'CodeQL',
    'not-invariant-mining-engine',
    'not-automatic-claim-acceptance',
    'not-live-enforcement',
  ]) {
    includes(docs, expected, `Candidate invariant synthesizer docs: records ${expected}`);
  }

  includes(overview, 'Progress: 6/14 complete after I05. 8 steps remain.', 'Overview: progress is updated');
  includes(overview, '| I04 | complete | Candidate Invariant Synthesizer |', 'Overview: I04 is complete');
  includes(overview, 'src/consequence-admission/candidate-invariant-synthesizer.ts', 'Overview: I04 source file is tracked');
  includes(overview, 'tests/candidate-invariant-synthesizer.test.ts', 'Overview: I04 test file is tracked');
  includes(annex, 'Daikon likely invariants', 'Research annex: Daikon anchor is present');
  includes(annex, 'Synoptic log invariant mining', 'Research annex: Synoptic anchor is present');
  includes(annex, 'CodeQL model and sanitizer workflows', 'Research annex: CodeQL anchor is present');
  equal(
    packageJson.scripts['test:candidate-invariant-synthesizer'],
    'tsx tests/candidate-invariant-synthesizer.test.ts',
    'Candidate invariant synthesizer: package script is registered',
  );
  includes(packageProbe, 'CANDIDATE_INVARIANT_SYNTHESIZER_VERSION', 'Package probe: I04 version is checked');
}

testDescriptorRecordsBoundaries();
testReadyCandidateCreatesClaimAndStrategyNodes();
testHeldInputsCreateNoNodes();
testDangerFlagsAndScopeMismatch();
testDeterminismAndNoMutation();
testDocsPackageAndOverview();

console.log(`Candidate invariant synthesizer tests: ${passed} passed, 0 failed`);
