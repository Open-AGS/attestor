import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  BASELINE_COHORT_BUILDER_VERSION,
  BASELINE_COHORT_CONTRACT_VERSION,
  LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION,
  SHADOW_DATA_QUALITY_GATE_VERSION,
  baselineCohortBuilderDescriptor,
  createBaselineCohortCandidate,
  createBaselineCohortEvidence,
  createBaselineCohortSourceFromShadowEvent,
  createCanonicalShadowEvent,
  createLearnedArtifactReleaseBudget,
  createShadowDataQualityGate,
  type BaselineCohortCandidate,
  type CanonicalShadowEvent,
  type CreateCanonicalShadowEventInput,
  type LearnedArtifactReleaseBudgetRecord,
  type ShadowDataQualityGateRecord,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
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
    occurredAt: `2026-05-18T10:00:0${suffix}.000Z`,
    observedAt: `2026-05-18T10:01:0${suffix}.000Z`,
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
      reasonCodes: [`baseline-cohort-builder-${suffix}`],
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

function sourceEvent(shadowEvent: CanonicalShadowEvent) {
  return createBaselineCohortSourceFromShadowEvent({
    event: shadowEvent,
    envelopeRefDigest: digest2,
    traceRefDigest: digestF,
  });
}

function cleanQualityGate(
  shadowEvent: CanonicalShadowEvent,
  overrides?: Partial<Parameters<typeof createShadowDataQualityGate>[0]>,
): ShadowDataQualityGateRecord {
  return createShadowDataQualityGate({
    event: shadowEvent,
    evaluatedAt: '2026-05-18T10:02:00.000Z',
    evaluatorRefDigest: digest1,
    assuranceCaseRefDigest: digest0,
    attacksNodeId: 'evidence:baseline-cohort:test',
    trustedProducers: ['attestor.consequence-admission'],
    ...overrides,
  });
}

function candidateAndEvents(): {
  readonly candidate: BaselineCohortCandidate;
  readonly events: readonly CanonicalShadowEvent[];
} {
  const events = [event('1'), event('2'), event('3')];
  const candidate = createBaselineCohortCandidate({
    cohortId: 'cohort:refunds:i03',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-18T10:03:00.000Z',
    sourceEvents: events.map(sourceEvent),
    reviewerAffirmed: true,
    reviewerRefDigest: digestB,
  });
  return { candidate, events };
}

function releaseBudgetFor(
  candidate: BaselineCohortCandidate,
  overrides?: Partial<Parameters<typeof createLearnedArtifactReleaseBudget>[0]>,
): LearnedArtifactReleaseBudgetRecord {
  return createLearnedArtifactReleaseBudget({
    artifactId: 'learned-artifact:baseline-cohort-summary:i03',
    artifactKind: 'baseline-cohort-summary',
    artifactRefDigest: candidate.digest,
    tenantRefDigest: candidate.tenantRefDigest,
    cohortRefDigest: candidate.cohortRefDigest,
    generatedAt: '2026-05-18T10:04:00.000Z',
    requestedReleaseMode: 'assurance-review',
    sourceEventCount: candidate.sourceEventCount,
    minimumCohortEventCount: 3,
    privacyBudget: {
      budgetId: 'budget:tenant-a:baseline-cohort:i03',
      budgetRefDigest: digest3,
      tenantRefDigest: candidate.tenantRefDigest,
      cohortRefDigest: candidate.cohortRefDigest,
      totalBudgetUnits: 100,
      spentBudgetUnits: 10,
      requestedBudgetUnits: 5,
      expiresAt: '2026-06-18T10:00:00.000Z',
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
    ...overrides,
  });
}

function testDescriptorRecordsBoundaries(): void {
  const descriptor = baselineCohortBuilderDescriptor();

  equal(descriptor.version, BASELINE_COHORT_BUILDER_VERSION, 'Baseline cohort builder: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Baseline cohort builder: binds assurance case contract');
  equal(descriptor.baselineCohortContractVersion, BASELINE_COHORT_CONTRACT_VERSION, 'Baseline cohort builder: binds baseline cohort contract');
  equal(descriptor.shadowDataQualityGateVersion, SHADOW_DATA_QUALITY_GATE_VERSION, 'Baseline cohort builder: binds shadow data quality gate');
  equal(descriptor.learnedArtifactReleaseBudgetVersion, LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION, 'Baseline cohort builder: binds learned artifact budget');
  ok(descriptor.sourceAnchors.includes('tensorflow-data-validation-anomaly-gate'), 'Baseline cohort builder: TFDV source anchor is present');
  ok(descriptor.sourceAnchors.includes('tfx-mlmd-artifact-execution-lineage'), 'Baseline cohort builder: MLMD source anchor is present');
  ok(descriptor.sourceAnchors.includes('google-data-cards-dataset-documentation'), 'Baseline cohort builder: Data Cards source anchor is present');
  ok(descriptor.sourceAnchors.includes('lakefs-content-addressed-commits'), 'Baseline cohort builder: lakeFS source anchor is present');
  ok(descriptor.sourceAnchors.includes('openlineage-run-job-dataset-facets'), 'Baseline cohort builder: OpenLineage source anchor is present');
  equal(descriptor.createsAssuranceEvidenceNode, true, 'Baseline cohort builder: creates assurance evidence nodes');
  equal(descriptor.requiresQualityGateForEverySourceEvent, true, 'Baseline cohort builder: quality gate coverage is required');
  equal(descriptor.requiresReleaseBudget, true, 'Baseline cohort builder: release budget is required');
  equal(descriptor.noLearning, true, 'Baseline cohort builder: descriptor forbids learning');
  equal(descriptor.noAutoPromotion, true, 'Baseline cohort builder: descriptor forbids auto-promotion');
  equal(descriptor.canAdmit, false, 'Baseline cohort builder: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Baseline cohort builder: descriptor cannot enforce');
  equal(descriptor.productionReady, false, 'Baseline cohort builder: descriptor is not production readiness');
  ok(descriptor.nonClaims.includes('not-baseline-mining-engine'), 'Baseline cohort builder: mining engine is a non-claim');
}

function testCleanCohortBuildsEvidenceNodeForCandidateClaim(): void {
  const { candidate, events } = candidateAndEvents();
  const qualityGates = events.map((shadowEvent) => cleanQualityGate(shadowEvent));
  const releaseBudget = releaseBudgetFor(candidate);
  const record = createBaselineCohortEvidence({
    candidate,
    qualityGates,
    releaseBudget,
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T10:05:00.000Z',
  });

  equal(record.version, BASELINE_COHORT_BUILDER_VERSION, 'Baseline cohort builder: record version is explicit');
  equal(record.outcome, 'cohort-evidence-ready-for-candidate-claim', 'Baseline cohort builder: clean cohort is ready');
  equal(record.readyForCandidateClaim, true, 'Baseline cohort builder: readiness is true');
  equal(record.underminingDefeaterRequired, false, 'Baseline cohort builder: clean cohort needs no defeater');
  equal(record.qualityGateCount, 3, 'Baseline cohort builder: quality gates are counted');
  equal(record.qualityReadyCount, 3, 'Baseline cohort builder: ready gates are counted');
  equal(record.qualityHeldCount, 0, 'Baseline cohort builder: no gates are held');
  equal(record.releaseBudgetOutcome, 'release-ready-for-assurance-review', 'Baseline cohort builder: release budget outcome is recorded');
  equal(record.evidenceNode?.kind, 'evidence', 'Baseline cohort builder: evidence node is created');
  equal(record.evidenceNode?.tenantRefDigest, candidate.tenantRefDigest, 'Baseline cohort builder: evidence node is tenant-bound');
  equal(record.evidenceNode?.scopeDigest, candidate.cohortRefDigest, 'Baseline cohort builder: evidence node is cohort-scoped');
  equal(record.evidenceTransition?.transitionKind, 'create-node', 'Baseline cohort builder: evidence transition is recorded');
  equal(record.assuranceEvidenceOnly, true, 'Baseline cohort builder: output is assurance evidence only');
  equal(record.noLearning, true, 'Baseline cohort builder: output does not learn');
  equal(record.canAdmit, false, 'Baseline cohort builder: record cannot admit');
  equal(record.activatesEnforcement, false, 'Baseline cohort builder: record cannot enforce');
  ok(record.digest.startsWith('sha256:'), 'Baseline cohort builder: record has digest');
}

function testQualityDefeaterMissingGateAndBudgetHold(): void {
  const { candidate, events } = candidateAndEvents();
  const badEvent = event('4', {
    evidenceRefs: [],
    schemaRefDigest: null,
  });
  const badCandidate = createBaselineCohortCandidate({
    cohortId: 'cohort:refunds:i03-bad',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-18T10:03:00.000Z',
    sourceEvents: [events[0], events[1], badEvent].map(sourceEvent),
    reviewerAffirmed: true,
    reviewerRefDigest: digestB,
  });
  const qualityHeld = createBaselineCohortEvidence({
    candidate: badCandidate,
    qualityGates: [
      cleanQualityGate(events[0]),
      cleanQualityGate(events[1]),
      cleanQualityGate(badEvent),
    ],
    releaseBudget: releaseBudgetFor(badCandidate),
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T10:05:00.000Z',
  });
  const missingGate = createBaselineCohortEvidence({
    candidate,
    qualityGates: [cleanQualityGate(events[0]), cleanQualityGate(events[1])],
    releaseBudget: releaseBudgetFor(candidate),
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T10:05:00.000Z',
  });
  const budgetHeld = createBaselineCohortEvidence({
    candidate,
    qualityGates: events.map((shadowEvent) => cleanQualityGate(shadowEvent)),
    releaseBudget: releaseBudgetFor(candidate, {
      privacyBudget: {
        ...releaseBudgetFor(candidate).privacyBudget,
        spentBudgetUnits: 99,
        requestedBudgetUnits: 5,
      },
    }),
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T10:05:00.000Z',
  });

  equal(qualityHeld.outcome, 'cohort-held-for-quality-defeaters', 'Baseline cohort builder: quality failure holds cohort');
  ok(qualityHeld.dangerFlags.includes('quality-defeater-present'), 'Baseline cohort builder: quality defeater flag is present');
  equal(qualityHeld.underminingDefeaterRequired, true, 'Baseline cohort builder: quality failure opens defeater material');
  equal(missingGate.outcome, 'cohort-held-for-quality-defeaters', 'Baseline cohort builder: missing gate holds cohort');
  ok(missingGate.dangerFlags.includes('quality-gate-missing'), 'Baseline cohort builder: missing gate flag is present');
  equal(missingGate.excludedSourceEventDigests.length, 1, 'Baseline cohort builder: missing gate excludes one source');
  equal(budgetHeld.outcome, 'cohort-held-for-budget', 'Baseline cohort builder: budget hold is propagated');
  ok(budgetHeld.dangerFlags.includes('budget-not-ready'), 'Baseline cohort builder: budget-not-ready flag is present');
}

function testAssuranceCaseAndSafetyLabelHolds(): void {
  const { candidate, events } = candidateAndEvents();
  const noCase = createBaselineCohortEvidence({
    candidate,
    qualityGates: events.map((shadowEvent) => cleanQualityGate(shadowEvent)),
    releaseBudget: releaseBudgetFor(candidate),
    assuranceCaseRefDigest: null,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T10:05:00.000Z',
  });
  const unknownEvent = event('5', {
    decision: {
      admissionDigest: digestE,
      mode: 'observe',
      shadowDecision: null,
      effectiveDecision: null,
      allowed: false,
      failClosed: true,
      reasonCodes: ['unknown'],
    },
  });
  const unsafeCandidate = createBaselineCohortCandidate({
    cohortId: 'cohort:refunds:i03-unsafe',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-18T10:03:00.000Z',
    sourceEvents: [events[0], events[1], unknownEvent].map(sourceEvent),
    reviewerAffirmed: true,
    reviewerRefDigest: digestB,
  });
  const unsafe = createBaselineCohortEvidence({
    candidate: unsafeCandidate,
    qualityGates: [
      cleanQualityGate(events[0]),
      cleanQualityGate(events[1]),
      cleanQualityGate(unknownEvent),
    ],
    releaseBudget: releaseBudgetFor(unsafeCandidate),
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T10:05:00.000Z',
  });

  equal(noCase.outcome, 'cohort-held-for-assurance-case', 'Baseline cohort builder: missing assurance case holds cohort');
  equal(noCase.evidenceNode, null, 'Baseline cohort builder: no assurance case means no evidence node');
  ok(noCase.dangerFlags.includes('assurance-case-unbound'), 'Baseline cohort builder: assurance case flag is present');
  equal(unsafe.outcome, 'cohort-held-for-safety-label', 'Baseline cohort builder: unsafe cohort safety label holds');
  ok(unsafe.dangerFlags.includes('unsafe-baseline-cohort'), 'Baseline cohort builder: unsafe cohort flag is present');
}

function testMismatchesAndDuplicatesFailClosed(): void {
  const { candidate, events } = candidateAndEvents();
  const gate = cleanQualityGate(events[0]);

  throws(
    () => createBaselineCohortEvidence({
      candidate,
      qualityGates: [
        { ...gate, tenantRefDigest: digestB },
      ],
      releaseBudget: releaseBudgetFor(candidate),
      assuranceCaseRefDigest: digest0,
      createdByRefDigest: digestB,
      createdAt: '2026-05-18T10:05:00.000Z',
    }),
    /tenant mismatch in quality gate/u,
    'Baseline cohort builder: quality gate tenant mismatch fails closed',
  );

  throws(
    () => createBaselineCohortEvidence({
      candidate,
      qualityGates: [gate, gate],
      releaseBudget: releaseBudgetFor(candidate),
      assuranceCaseRefDigest: digest0,
      createdByRefDigest: digestB,
      createdAt: '2026-05-18T10:05:00.000Z',
    }),
    /duplicate quality gate/u,
    'Baseline cohort builder: duplicate quality gate fails closed',
  );

  throws(
    () => createBaselineCohortEvidence({
      candidate,
      qualityGates: events.map((shadowEvent) => cleanQualityGate(shadowEvent)),
      releaseBudget: {
        ...releaseBudgetFor(candidate),
        artifactRefDigest: digestB,
      },
      assuranceCaseRefDigest: digest0,
      createdByRefDigest: digestB,
      createdAt: '2026-05-18T10:05:00.000Z',
    }),
    /artifact ref mismatch/u,
    'Baseline cohort builder: release budget artifact mismatch fails closed',
  );
}

function testDeterminismAndNoMutation(): void {
  const { candidate, events } = candidateAndEvents();
  const input = {
    candidate,
    qualityGates: events.map((shadowEvent) => cleanQualityGate(shadowEvent)),
    releaseBudget: releaseBudgetFor(candidate),
    assuranceCaseRefDigest: digest0,
    createdByRefDigest: digestB,
    createdAt: '2026-05-18T10:05:00.000Z',
  } as const;
  const before = JSON.stringify(input);
  const first = createBaselineCohortEvidence(input);
  const second = createBaselineCohortEvidence(input);

  equal(first.digest, second.digest, 'Baseline cohort builder: identical input yields identical digest');
  equal(JSON.stringify(input), before, 'Baseline cohort builder: input is not mutated');
  ok(Object.isFrozen(first), 'Baseline cohort builder: record is frozen');
  deepEqual(first.includedSourceEventDigests, candidate.sourceEventDigests, 'Baseline cohort builder: included source digests are stable');
}

function testDocsPackageAndOverview(): void {
  const docs = readProjectFile(
    'docs',
    '02-architecture',
    'baseline-cohort-builder.md',
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
    '# Baseline Cohort Builder',
    'I03',
    'TensorFlow Data Validation',
    'ML Metadata',
    'Data Cards',
    'Datasheets for Datasets',
    'DVC',
    'lakeFS',
    'OpenLineage',
    'not-baseline-mining-engine',
    'not-live-enforcement',
  ]) {
    includes(docs, expected, `Baseline cohort builder docs: records ${expected}`);
  }

  includes(overview, 'Progress: 10/14 complete after I09. 4 steps remain.', 'Overview: progress is updated');
  includes(overview, '| I03 | complete | Baseline Cohort Builder |', 'Overview: I03 is complete');
  includes(overview, 'src/consequence-admission/baseline-cohort-builder.ts', 'Overview: I03 source file is tracked');
  includes(overview, 'tests/baseline-cohort-builder.test.ts', 'Overview: I03 test file is tracked');
  includes(annex, 'TensorFlow Data Validation anomaly gate', 'Research annex: TFDV anchor is present');
  includes(annex, 'TFX ML Metadata artifact lineage', 'Research annex: MLMD anchor is present');
  includes(annex, 'Data Cards and Datasheets', 'Research annex: dataset documentation anchor is present');
  equal(
    packageJson.scripts['test:baseline-cohort-builder'],
    'tsx tests/baseline-cohort-builder.test.ts',
    'Baseline cohort builder: package script is registered',
  );
  includes(packageProbe, 'BASELINE_COHORT_BUILDER_VERSION', 'Package probe: I03 version is checked');
}

testDescriptorRecordsBoundaries();
testCleanCohortBuildsEvidenceNodeForCandidateClaim();
testQualityDefeaterMissingGateAndBudgetHold();
testAssuranceCaseAndSafetyLabelHolds();
testMismatchesAndDuplicatesFailClosed();
testDeterminismAndNoMutation();
testDocsPackageAndOverview();

console.log(`Baseline cohort builder tests: ${passed} passed, 0 failed`);
