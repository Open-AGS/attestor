import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BASELINE_COHORT_CONTRACT_VERSION,
  CANDIDATE_INVARIANTS_CATALOG_VERSION,
  candidateInvariantsCatalogDescriptor,
  createBaselineCohortCandidate,
  createCandidateInvariantFromBaseline,
  evaluateBaselineCohortPromotion,
  evaluateCandidateInvariantReviewReadiness,
  type BaselineCohortCandidate,
  type BaselineCohortSourceEvent,
  type CandidateInvariant,
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
const digest1 = `sha256:${'1'.repeat(64)}`;
const digest2 = `sha256:${'2'.repeat(64)}`;
const digest3 = `sha256:${'3'.repeat(64)}`;

function sourceEvent(digest: string, decision: 'admit' | 'narrow' | 'review'): BaselineCohortSourceEvent {
  return {
    sourceOrigin: 'canonical-shadow-event',
    sourceEventDigest: digest,
    tenantRefDigest: digestA,
    envelopeRefDigest: digestB,
    traceRefDigest: digestC,
    observedAt: '2026-05-18T08:00:00.000Z',
    decision,
    evidenceRefDigests: [digestD, digestE],
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  };
}

function baseline(overrides?: {
  readonly reviewerAffirmed?: boolean;
  readonly sourceEvents?: readonly BaselineCohortSourceEvent[];
  readonly minimumSourceEventCountForPromotion?: number;
}): BaselineCohortCandidate {
  return createBaselineCohortCandidate({
    cohortId: 'cohort:refunds:r1',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-18T08:01:00.000Z',
    sourceEvents: overrides?.sourceEvents ?? [
      sourceEvent(digest1, 'admit'),
      sourceEvent(digest2, 'narrow'),
      sourceEvent(digest3, 'admit'),
    ],
    reviewerAffirmed: overrides?.reviewerAffirmed ?? true,
    reviewerRefDigest: overrides?.reviewerAffirmed === false ? null : digestF,
    minimumSourceEventCountForPromotion: overrides?.minimumSourceEventCountForPromotion,
  });
}

function invariant(input?: {
  readonly baselineCohort?: BaselineCohortCandidate;
  readonly evidenceBases?: readonly ('baseline-cohort' | 'counterexample-replay' | 'operator-review' | 'frequency-only')[];
  readonly effect?: 'strengthen-only' | 'review-only' | 'measure-only' | 'relaxation-requested';
  readonly counterexampleReplayRefDigest?: string | null;
  readonly reviewerRefDigest?: string | null;
}): CandidateInvariant {
  const baselineCohort = input?.baselineCohort ?? baseline();
  return createCandidateInvariantFromBaseline({
    candidateId: 'candidate:refund-authority-evidence',
    generatedAt: '2026-05-18T08:02:00.000Z',
    kind: 'authority-evidence-required',
    effect: input?.effect ?? 'strengthen-only',
    pattern: {
      templateKind: 'always',
      naturalLanguage: 'Refund create requests must include an authority evidence digest.',
      formalShape: 'G(refund.create -> authorityEvidenceDigest.present)',
      parameters: {
        actionType: 'refund.create',
        evidenceKind: 'authority',
      },
    },
    scope: {
      tenantRefDigest: digestA,
      baselineCohortRefDigest: baselineCohort.cohortRefDigest,
      consequenceClass: 'financial',
      actionType: 'refund.create',
      appliesToPackFamilies: ['finance', 'general'],
    },
    baselineCohort,
    baselinePromotion: evaluateBaselineCohortPromotion({ candidate: baselineCohort }),
    evidenceBases: input?.evidenceBases ?? [
      'baseline-cohort',
      'counterexample-replay',
      'operator-review',
    ],
    evidenceRefDigests: [digestF],
    counterexampleReplayRefDigest: input?.counterexampleReplayRefDigest === undefined
      ? digestE
      : input.counterexampleReplayRefDigest,
    reviewerRefDigest: input?.reviewerRefDigest === undefined
      ? digestF
      : input.reviewerRefDigest,
  });
}

function testDescriptorRecordsSafeTaxonomy(): void {
  const descriptor = candidateInvariantsCatalogDescriptor();

  equal(descriptor.version, CANDIDATE_INVARIANTS_CATALOG_VERSION, 'Candidate invariants: version is explicit');
  equal(descriptor.baselineCohortContractVersion, BASELINE_COHORT_CONTRACT_VERSION, 'Candidate invariants: binds baseline cohort contract');
  ok(descriptor.kinds.includes('authority-evidence-required'), 'Candidate invariants: authority evidence invariant kind exists');
  ok(descriptor.templateKinds.includes('precedence'), 'Candidate invariants: temporal template kind exists');
  ok(descriptor.evidenceBases.includes('counterexample-replay'), 'Candidate invariants: counterexample replay evidence basis exists');
  ok(descriptor.dangerFlags.includes('frequency-implies-safety'), 'Candidate invariants: frequency-is-safe danger flag exists');
  equal(descriptor.frequencyImpliesSafetyRejected, true, 'Candidate invariants: frequency-only safety is rejected');
  equal(descriptor.counterexampleReplayRequired, true, 'Candidate invariants: counterexample replay is required');
  equal(descriptor.reviewerRequired, true, 'Candidate invariants: reviewer is required');
  equal(descriptor.noRelaxation, true, 'Candidate invariants: relaxation is forbidden');
  equal(descriptor.noAutoPromotion, true, 'Candidate invariants: auto promotion is forbidden');
  equal(descriptor.learnsFromTraffic, false, 'Candidate invariants: descriptor does not learn from traffic');
  equal(descriptor.canAdmit, false, 'Candidate invariants: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Candidate invariants: descriptor cannot activate enforcement');
  equal(descriptor.productionReady, false, 'Candidate invariants: descriptor is not production readiness');
  ok(
    descriptor.nonClaims.includes('not-invariant-mining-engine'),
    'Candidate invariants: mining engine is a non-claim',
  );
}

function testReviewReadyCandidateStaysNonAuthoritative(): void {
  const candidate = invariant();
  const evaluation = evaluateCandidateInvariantReviewReadiness(candidate);

  equal(candidate.version, CANDIDATE_INVARIANTS_CATALOG_VERSION, 'Candidate invariants: candidate version is explicit');
  equal(candidate.baselineCohortContractVersion, BASELINE_COHORT_CONTRACT_VERSION, 'Candidate invariants: candidate binds baseline cohort contract');
  equal(candidate.baselinePromotionOutcome, 'eligible-for-invariant-candidate-review', 'Candidate invariants: eligible baseline outcome is recorded');
  equal(candidate.reviewOutcome, 'review-ready', 'Candidate invariants: fully evidenced candidate is review-ready');
  equal(candidate.noFrequencyImpliesSafety, true, 'Candidate invariants: frequency-only safety is forbidden');
  equal(candidate.noRelaxation, true, 'Candidate invariants: relaxation remains forbidden');
  equal(candidate.autoPromote, false, 'Candidate invariants: candidate cannot auto-promote');
  equal(candidate.learnsFromTraffic, false, 'Candidate invariants: candidate does not learn');
  equal(candidate.trainingEnabled, false, 'Candidate invariants: training stays disabled');
  equal(candidate.canAdmit, false, 'Candidate invariants: candidate cannot admit');
  equal(candidate.activatesEnforcement, false, 'Candidate invariants: candidate cannot enforce');
  equal(candidate.productionReady, false, 'Candidate invariants: candidate is not production readiness');
  deepEqual(candidate.dangerFlags, [], 'Candidate invariants: clean candidate has no danger flags');
  equal(evaluation.readyForReviewer, true, 'Candidate invariants: review-ready evaluation can be shown to reviewer');
  equal(evaluation.failClosed, false, 'Candidate invariants: review-ready evaluation is not fail-closed');
  equal(evaluation.canAdmit, false, 'Candidate invariants: evaluation still cannot admit');
  ok(candidate.digest.startsWith('sha256:'), 'Candidate invariants: candidate has digest');
  ok(evaluation.digest.startsWith('sha256:'), 'Candidate invariants: evaluation has digest');
}

function testFrequencyOnlyAndRelaxationAreRejected(): void {
  const frequencyOnly = invariant({
    evidenceBases: ['frequency-only'],
  });
  const relaxation = invariant({
    effect: 'relaxation-requested',
  });

  equal(frequencyOnly.reviewOutcome, 'rejected-danger-flag', 'Candidate invariants: frequency-only candidate is rejected');
  ok(
    frequencyOnly.dangerFlags.includes('frequency-implies-safety'),
    'Candidate invariants: frequency-only danger flag is explicit',
  );
  equal(
    evaluateCandidateInvariantReviewReadiness(frequencyOnly).failClosed,
    true,
    'Candidate invariants: frequency-only rejection fails closed',
  );
  equal(relaxation.reviewOutcome, 'rejected-danger-flag', 'Candidate invariants: relaxation candidate is rejected');
  ok(
    relaxation.dangerFlags.includes('relaxes-existing-control'),
    'Candidate invariants: relaxation danger flag is explicit',
  );
}

function testCounterexampleReviewerAndBaselineHolds(): void {
  const missingReplay = invariant({
    counterexampleReplayRefDigest: null,
  });
  const missingReviewer = invariant({
    reviewerRefDigest: null,
  });
  const insufficientBaseline = baseline({
    reviewerAffirmed: true,
    sourceEvents: [sourceEvent(digest1, 'admit')],
  });
  const insufficient = invariant({
    baselineCohort: insufficientBaseline,
  });
  const needsReviewBaseline = baseline({
    reviewerAffirmed: true,
    sourceEvents: [
      sourceEvent(digest1, 'admit'),
      sourceEvent(digest2, 'review'),
      sourceEvent(digest3, 'admit'),
    ],
  });
  const needsReview = invariant({
    baselineCohort: needsReviewBaseline,
  });

  equal(missingReplay.reviewOutcome, 'held-for-counterexample-replay', 'Candidate invariants: missing replay holds');
  ok(
    missingReplay.dangerFlags.includes('missing-counterexample-replay'),
    'Candidate invariants: missing replay flag is explicit',
  );
  equal(missingReviewer.reviewOutcome, 'held-for-review', 'Candidate invariants: missing reviewer holds');
  ok(
    missingReviewer.dangerFlags.includes('unreviewed-promotion'),
    'Candidate invariants: missing reviewer flag is explicit',
  );
  equal(insufficient.reviewOutcome, 'held-for-baseline', 'Candidate invariants: insufficient baseline holds');
  ok(
    insufficient.dangerFlags.includes('insufficient-sample'),
    'Candidate invariants: insufficient sample flag is explicit',
  );
  equal(needsReview.reviewOutcome, 'held-for-baseline', 'Candidate invariants: unsafe baseline holds');
  ok(
    needsReview.dangerFlags.includes('unsafe-baseline-cohort'),
    'Candidate invariants: unsafe baseline flag is explicit',
  );
}

function testScopeAndDeterminismGuards(): void {
  const baselineCohort = baseline();
  const first = invariant({ baselineCohort });
  const second = invariant({ baselineCohort });

  equal(first.digest, second.digest, 'Candidate invariants: same input yields same digest');
  throws(
    () =>
      createCandidateInvariantFromBaseline({
        candidateId: 'candidate:bad-scope',
        generatedAt: '2026-05-18T08:03:00.000Z',
        kind: 'tenant-boundary',
        effect: 'strengthen-only',
        pattern: {
          templateKind: 'always',
          naturalLanguage: 'Tenant references must match.',
          formalShape: 'G(request.tenant == envelope.tenant)',
          parameters: {},
        },
        scope: {
          tenantRefDigest: digestB,
          baselineCohortRefDigest: baselineCohort.cohortRefDigest,
          consequenceClass: 'financial',
          actionType: 'refund.create',
          appliesToPackFamilies: ['general'],
        },
        baselineCohort,
        evidenceBases: ['baseline-cohort', 'counterexample-replay'],
        counterexampleReplayRefDigest: digestE,
        reviewerRefDigest: digestF,
      }),
    /scope must match the baseline cohort tenant/u,
    'Candidate invariants: cross-tenant scope fails closed',
  );
}

function testDocsOverviewPackageSurfaceAndScriptStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'candidate-invariants-catalog.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile('scripts', 'probe', 'probe-consequence-admission-package-surface.mjs');

  for (const expected of [
    '# Candidate Invariants Catalog',
    'attestor.candidate-invariants-catalog.v1',
    'Daikon',
    'DIDUCE',
    'Texada',
    'Dwyer',
    'NIST AI 100-2',
    'frequency-implies-safety',
    'not an invariant mining engine',
    'not learned invariant promotion',
    'not live enforcement',
    'not production readiness',
  ]) {
    includes(doc, expected, `Candidate invariants doc: records ${expected}`);
  }

  for (const expected of [
    '| W10 | complete | Candidate Invariants Catalog |',
    'src/consequence-admission/candidate-invariants-catalog.ts',
    'tests/candidate-invariants-catalog.test.ts',
    'docs/02-architecture/candidate-invariants-catalog.md',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  includes(
    packageProbe,
    'candidateInvariantsCatalogDescriptor',
    'Package probe: checks candidate invariant descriptor export',
  );
  includes(
    packageProbe,
    'createCandidateInvariantFromBaseline',
    'Package probe: checks candidate invariant builder export',
  );
  includes(
    packageProbe,
    'evaluateCandidateInvariantReviewReadiness',
    'Package probe: checks candidate invariant evaluator export',
  );
  equal(
    packageJson.scripts['test:candidate-invariants-catalog'],
    'tsx tests/candidate-invariants-catalog.test.ts',
    'Candidate invariants: package script is registered',
  );
}

testDescriptorRecordsSafeTaxonomy();
testReviewReadyCandidateStaysNonAuthoritative();
testFrequencyOnlyAndRelaxationAreRejected();
testCounterexampleReviewerAndBaselineHolds();
testScopeAndDeterminismGuards();
testDocsOverviewPackageSurfaceAndScriptStayAligned();

console.log(`Candidate invariants catalog tests: ${passed} passed, 0 failed`);
