import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  BASELINE_COHORT_BUILDER_VERSION,
  CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
  COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
  counterexampleMinimalWitnessDescriptor,
  createBaselineCohortCandidate,
  createBaselineCohortEvidence,
  createBaselineCohortSourceFromShadowEvent,
  createCandidateInvariantFromBaseline,
  createCanonicalShadowEvent,
  createCounterexampleMinimalWitness,
  createLearnedArtifactReleaseBudget,
  createShadowDataQualityGate,
  synthesizeCandidateInvariantAssuranceCase,
  type BaselineCohortCandidate,
  type CandidateInvariant,
  type CandidateInvariantSynthesizerRecord,
  type CanonicalShadowEvent,
  type CreateCanonicalShadowEventInput,
  type CreateCounterexampleMinimalWitnessInput,
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
const digest6 = `sha256:${'6'.repeat(64)}`;
const digest7 = `sha256:${'7'.repeat(64)}`;

function canonicalInput(
  suffix: string,
  overrides?: Partial<CreateCanonicalShadowEventInput>,
): CreateCanonicalShadowEventInput {
  return {
    occurredAt: `2026-05-18T12:00:0${suffix}.000Z`,
    observedAt: `2026-05-18T12:01:0${suffix}.000Z`,
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
      reasonCodes: [`counterexample-minimal-witness-${suffix}`],
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

function cohortCandidateFixture(): {
  readonly candidate: BaselineCohortCandidate;
  readonly events: readonly CanonicalShadowEvent[];
} {
  const events = [event('1'), event('2'), event('3')];
  const candidate = createBaselineCohortCandidate({
    cohortId: 'cohort:refunds:i05',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-18T12:02:00.000Z',
    sourceEvents: events.map((shadowEvent) =>
      createBaselineCohortSourceFromShadowEvent({
        event: shadowEvent,
        envelopeRefDigest: digest2,
        traceRefDigest: digestF,
      })),
    reviewerAffirmed: true,
    reviewerRefDigest: digestB,
  });
  return { candidate, events };
}

function invariantFor(
  candidate: BaselineCohortCandidate,
  overrides?: { readonly missingReviewer?: boolean },
): CandidateInvariant {
  return createCandidateInvariantFromBaseline({
    candidateId: 'candidate:refund-authority-evidence:i05',
    generatedAt: '2026-05-18T12:06:00.000Z',
    kind: 'authority-evidence-required',
    effect: 'strengthen-only',
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
    evidenceBases: ['baseline-cohort', 'counterexample-replay', 'operator-review'],
    evidenceRefDigests: [digestF],
    counterexampleReplayRefDigest: digestE,
    reviewerRefDigest: overrides?.missingReviewer ? null : digestF,
  });
}

function synthesizedClaimFixture(overrides?: {
  readonly missingReviewer?: boolean;
  readonly noAssuranceCase?: boolean;
}): CandidateInvariantSynthesizerRecord {
  const { candidate, events } = cohortCandidateFixture();
  const invariant = invariantFor(candidate, {
    missingReviewer: overrides?.missingReviewer,
  });
  const releaseBudget = createLearnedArtifactReleaseBudget({
    artifactId: 'learned-artifact:baseline-cohort-summary:i05',
    artifactKind: 'baseline-cohort-summary',
    artifactRefDigest: candidate.digest,
    tenantRefDigest: candidate.tenantRefDigest,
    cohortRefDigest: candidate.cohortRefDigest,
    generatedAt: '2026-05-18T12:03:00.000Z',
    requestedReleaseMode: 'assurance-review',
    sourceEventCount: candidate.sourceEventCount,
    minimumCohortEventCount: 3,
    privacyBudget: {
      budgetId: 'budget:tenant-a:i05',
      budgetRefDigest: digest3,
      tenantRefDigest: candidate.tenantRefDigest,
      cohortRefDigest: candidate.cohortRefDigest,
      totalBudgetUnits: 100,
      spentBudgetUnits: 5,
      requestedBudgetUnits: 5,
      expiresAt: '2026-06-18T12:00:00.000Z',
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
      evaluatedAt: '2026-05-18T12:04:00.000Z',
      evaluatorRefDigest: digest1,
      assuranceCaseRefDigest: digest0,
      attacksNodeId: 'evidence:baseline-cohort:i05',
      trustedProducers: ['attestor.consequence-admission'],
    }));
  const baselineEvidence = createBaselineCohortEvidence({
    candidate,
    qualityGates,
    releaseBudget,
    assuranceCaseRefDigest: overrides?.noAssuranceCase ? null : digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T12:05:00.000Z',
  });
  return synthesizeCandidateInvariantAssuranceCase({
    baselineEvidence,
    candidateInvariant: invariant,
    assuranceCaseRefDigest: overrides?.noAssuranceCase ? null : digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T12:07:00.000Z',
  });
}

function witnessInput(
  synthesizedClaim: CandidateInvariantSynthesizerRecord,
  overrides?: Partial<CreateCounterexampleMinimalWitnessInput>,
): CreateCounterexampleMinimalWitnessInput {
  return {
    synthesizedClaim,
    witnessId: 'witness:refund-authority-counterexample:i05',
    witnessKind: 'cycle-witness',
    observedAt: '2026-05-18T12:08:00.000Z',
    createdByRefDigest: digestB,
    sourceReplayDigest: digest6,
    replaySeedDigest: digest7,
    candidateInvariantDigest: synthesizedClaim.candidateInvariantDigest,
    invariantRefDigest: synthesizedClaim.invariantRefDigest,
    tenantRefDigest: synthesizedClaim.tenantRefDigest,
    cohortRefDigest: synthesizedClaim.cohortRefDigest,
    traceRefDigests: [digestF],
    eventRefDigests: [digestA, digestB],
    counterexampleRefDigests: [digestC],
    minimalityMethod: 'cycle-reduction',
    originalStepCount: 7,
    minimalStepCount: 3,
    removedStepCount: 4,
    reproducesViolation: true,
    ...overrides,
  };
}

function testDescriptorRecordsBoundaries(): void {
  const descriptor = counterexampleMinimalWitnessDescriptor();

  equal(descriptor.version, COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION, 'Counterexample minimal witness: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Counterexample minimal witness: binds assurance case contract');
  equal(descriptor.candidateInvariantSynthesizerVersion, CANDIDATE_INVARIANT_SYNTHESIZER_VERSION, 'Counterexample minimal witness: binds synthesizer contract');
  ok(descriptor.sourceAnchors.includes('jepsen-elle-minimal-cycle-witness'), 'Counterexample minimal witness: Elle anchor is present');
  ok(descriptor.sourceAnchors.includes('clusterfuzz-testcase-minimization'), 'Counterexample minimal witness: ClusterFuzz anchor is present');
  ok(descriptor.sourceAnchors.includes('quickcheck-shrinking'), 'Counterexample minimal witness: QuickCheck anchor is present');
  ok(descriptor.sourceAnchors.includes('zeller-delta-debugging'), 'Counterexample minimal witness: Zeller anchor is present');
  ok(descriptor.sourceAnchors.includes('foundationdb-deterministic-simulation-seed-replay'), 'Counterexample minimal witness: FoundationDB anchor is present');
  equal(descriptor.createsEvidenceNode, true, 'Counterexample minimal witness: creates evidence node');
  equal(descriptor.opensRebuttingDefeater, true, 'Counterexample minimal witness: opens rebutting defeater');
  equal(descriptor.noReplayExecution, true, 'Counterexample minimal witness: replay execution is forbidden');
  equal(descriptor.noProductionTraffic, true, 'Counterexample minimal witness: production traffic is forbidden');
  equal(descriptor.noCredentialUse, true, 'Counterexample minimal witness: credential use is forbidden');
  equal(descriptor.noAutoClaimRejection, true, 'Counterexample minimal witness: automatic claim rejection is forbidden');
  equal(descriptor.canAdmit, false, 'Counterexample minimal witness: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Counterexample minimal witness: descriptor cannot enforce');
  ok(descriptor.nonClaims.includes('not-replay-execution-engine'), 'Counterexample minimal witness: replay execution is a non-claim');
}

function testReadyWitnessCreatesEvidenceAndRebuttingDefeater(): void {
  const synthesizedClaim = synthesizedClaimFixture();
  const record = createCounterexampleMinimalWitness(witnessInput(synthesizedClaim));

  equal(record.version, COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION, 'Counterexample minimal witness: record version is explicit');
  equal(record.outcome, 'minimal-witness-ready-for-rebutting-defeater', 'Counterexample minimal witness: ready witness opens defeater');
  equal(record.readyForReviewer, true, 'Counterexample minimal witness: ready for reviewer is true');
  equal(record.opensRebuttingDefeater, true, 'Counterexample minimal witness: rebutting defeater opens');
  equal(record.evidenceNode?.kind, 'evidence', 'Counterexample minimal witness: evidence node is created');
  equal(record.rebuttingDefeater?.kind, 'rebutting', 'Counterexample minimal witness: rebutting defeater is created');
  equal(record.rebuttingDefeater?.state, 'open', 'Counterexample minimal witness: defeater is open');
  equal(record.rebuttingDefeater?.attacksNodeId, synthesizedClaim.claimNode?.nodeId, 'Counterexample minimal witness: defeater attacks claim node');
  equal(record.evidenceTransition?.transitionKind, 'create-node', 'Counterexample minimal witness: evidence transition is recorded');
  equal(record.defeaterTransition?.transitionKind, 'open-defeater', 'Counterexample minimal witness: defeater transition is recorded');
  equal(record.minimalWitnessEvidenceOnly, true, 'Counterexample minimal witness: evidence-only flag is true');
  equal(record.noReplayExecution, true, 'Counterexample minimal witness: no replay execution');
  equal(record.noProductionTraffic, true, 'Counterexample minimal witness: no production traffic');
  equal(record.noCredentialUse, true, 'Counterexample minimal witness: no credential use');
  equal(record.canAdmit, false, 'Counterexample minimal witness: record cannot admit');
  equal(record.activatesEnforcement, false, 'Counterexample minimal witness: record cannot enforce');
}

function testHeldWitnessesCreateNoDefeater(): void {
  const unready = createCounterexampleMinimalWitness(
    witnessInput(synthesizedClaimFixture({ missingReviewer: true })),
  );
  const noCase = createCounterexampleMinimalWitness(
    witnessInput(synthesizedClaimFixture({ noAssuranceCase: true })),
  );
  const notReproduced = createCounterexampleMinimalWitness(
    witnessInput(synthesizedClaimFixture(), {
      reproducesViolation: false,
    }),
  );
  const notReduced = createCounterexampleMinimalWitness(
    witnessInput(synthesizedClaimFixture(), {
      minimalityMethod: 'shrinking',
      originalStepCount: 3,
      minimalStepCount: 3,
      removedStepCount: 0,
    }),
  );

  equal(unready.outcome, 'minimal-witness-held-for-synthesizer-readiness', 'Counterexample minimal witness: unready claim holds');
  ok(unready.dangerFlags.includes('synthesized-claim-not-ready'), 'Counterexample minimal witness: unready flag is present');
  equal(unready.rebuttingDefeater, null, 'Counterexample minimal witness: unready claim creates no defeater');
  equal(noCase.outcome, 'minimal-witness-held-for-assurance-case', 'Counterexample minimal witness: missing assurance case holds');
  ok(noCase.dangerFlags.includes('assurance-case-unbound'), 'Counterexample minimal witness: assurance-case flag is present');
  equal(noCase.evidenceNode, null, 'Counterexample minimal witness: missing case creates no evidence node');
  equal(notReproduced.outcome, 'minimal-witness-held-for-minimality', 'Counterexample minimal witness: non-reproducing witness holds');
  ok(notReproduced.dangerFlags.includes('violation-not-reproduced'), 'Counterexample minimal witness: reproduction flag is present');
  equal(notReduced.outcome, 'minimal-witness-held-for-minimality', 'Counterexample minimal witness: non-reduced shrink holds');
  ok(notReduced.dangerFlags.includes('minimality-not-reduced'), 'Counterexample minimal witness: minimality flag is present');
}

function testFailClosedScopeAndShapeMismatches(): void {
  const synthesizedClaim = synthesizedClaimFixture();

  throws(
    () => createCounterexampleMinimalWitness(witnessInput(synthesizedClaim, {
      tenantRefDigest: digestC,
    })),
    /tenant mismatch/u,
    'Counterexample minimal witness: tenant mismatch fails closed',
  );
  throws(
    () => createCounterexampleMinimalWitness(witnessInput(synthesizedClaim, {
      invariantRefDigest: digestC,
    })),
    /invariant ref mismatch/u,
    'Counterexample minimal witness: invariant mismatch fails closed',
  );
  throws(
    () => createCounterexampleMinimalWitness(witnessInput(synthesizedClaim, {
      violatedClaimNodeId: 'claim:wrong',
    })),
    /violated claim node mismatch/u,
    'Counterexample minimal witness: violated claim mismatch fails closed',
  );
  throws(
    () => createCounterexampleMinimalWitness(witnessInput(synthesizedClaim, {
      originalStepCount: 3,
      minimalStepCount: 4,
      removedStepCount: 0,
    })),
    /minimalStepCount must not exceed/u,
    'Counterexample minimal witness: invalid step counts fail closed',
  );
  throws(
    () => createCounterexampleMinimalWitness(witnessInput(synthesizedClaim, {
      eventRefDigests: [],
    })),
    /eventRefDigests must not be empty/u,
    'Counterexample minimal witness: empty event refs fail closed',
  );
}

function testDeterminismAndNoMutation(): void {
  const synthesizedClaim = synthesizedClaimFixture();
  const input = witnessInput(synthesizedClaim);
  const before = JSON.stringify(input);
  const first = createCounterexampleMinimalWitness(input);
  const second = createCounterexampleMinimalWitness(input);

  equal(first.digest, second.digest, 'Counterexample minimal witness: identical input yields identical digest');
  equal(JSON.stringify(input), before, 'Counterexample minimal witness: input is not mutated');
  ok(Object.isFrozen(first), 'Counterexample minimal witness: output is frozen');
}

function testDocsPackageOverviewAndProbe(): void {
  const docs = readProjectFile(
    'docs',
    '02-architecture',
    'counterexample-minimal-witness.md',
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
    'probe',
    'probe-consequence-admission-package-surface.mjs',
  );

  for (const expected of [
    '# Counterexample Minimal Witness',
    'I05',
    'Elle',
    'ClusterFuzz',
    'QuickCheck',
    'Delta Debugging',
    'FoundationDB',
    'not a replay execution engine',
    'does not reject the claim automatically',
    'not live',
  ]) {
    includes(docs, expected, `Counterexample minimal witness docs: records ${expected}`);
  }

  includes(overview, 'Progress: 14/14 complete after I13. 0 steps remain.', 'Overview: progress is updated');
  includes(overview, '| I05 | complete | Counterexample Minimal Witness |', 'Overview: I05 is complete');
  includes(overview, 'src/consequence-admission/counterexample-minimal-witness.ts', 'Overview: I05 source file is tracked');
  includes(overview, 'tests/counterexample-minimal-witness.test.ts', 'Overview: I05 test file is tracked');
  includes(overview, 'I05 turns a minimal reproducing counterexample witness into', 'Overview: I05 explanation is present');
  includes(annex, 'Counterexample minimal witness', 'Research annex: I05 anchor is present');
  includes(annex, 'FoundationDB deterministic simulation', 'Research annex: FoundationDB anchor is present');
  includes(annex, 'Minimal counterexamples become review material', 'Research annex: I05 translation rule is present');
  equal(
    packageJson.scripts['test:counterexample-minimal-witness'],
    'tsx tests/counterexample-minimal-witness.test.ts',
    'Counterexample minimal witness: package script is registered',
  );
  includes(packageProbe, 'COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION', 'Package probe: I05 version is checked');
}

testDescriptorRecordsBoundaries();
testReadyWitnessCreatesEvidenceAndRebuttingDefeater();
testHeldWitnessesCreateNoDefeater();
testFailClosedScopeAndShapeMismatches();
testDeterminismAndNoMutation();
testDocsPackageOverviewAndProbe();

console.log(`Counterexample minimal witness tests: ${passed} passed, 0 failed`);
