import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BASELINE_COHORT_CONTRACT_VERSION,
  BASELINE_COHORT_DEFAULT_MIN_SOURCE_EVENTS_FOR_PROMOTION,
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  DECISION_TRACE_LOGGER_VERSION,
  SHADOW_RUNTIME_PIPELINE_VERSION,
  baselineCohortContractDescriptor,
  createBaselineCohortCandidate,
  createBaselineCohortSourceFromShadowEvent,
  createCanonicalShadowEvent,
  evaluateBaselineCohortPromotion,
  evidenceRefDigestsForSignals,
  type BaselineCohortSourceDecision,
  type BaselineCohortSourceEvent,
  type SignalEvidenceRef,
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

function shadowEvent(decision: BaselineCohortSourceDecision, suffix: string) {
  return createCanonicalShadowEvent({
    occurredAt: `2026-05-17T14:00:0${suffix}.000Z`,
    observedAt: `2026-05-17T14:00:1${suffix}.000Z`,
    sourceKind: 'target-system-shadow',
    producer: 'attestor.baseline-cohort-contract.test',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest: null,
      actionName: 'refund.create',
      actionKind: 'api-operation',
      consequenceClass: 'financial',
      resourceRefDigest: digestC,
      dataClass: 'money-movement',
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: null,
    decision: {
      admissionDigest: digestD,
      mode: 'observe',
      shadowDecision: decision === 'block'
        ? 'would_block'
        : decision === 'review'
          ? 'would_review'
          : decision === 'narrow'
            ? 'would_narrow'
            : decision === 'admit'
              ? 'would_admit'
              : null,
      effectiveDecision: decision === 'unknown' ? null : decision,
      allowed: decision === 'admit',
      failClosed: decision === 'review' || decision === 'block',
      reasonCodes: [`decision-${decision}`],
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestE, origin: 'observed' }],
    approvalRefs: [{ kind: 'approval', digest: digestF, origin: 'operator-supplied' }],
    receiptRefs: [{ kind: 'receipt', digest: digest1, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digest2, origin: 'observed' }],
    replayRefDigest: digest3,
    rawMaterialPolicy: 'digest-only',
  });
}

function source(
  decision: BaselineCohortSourceDecision,
  suffix: string,
): BaselineCohortSourceEvent {
  return createBaselineCohortSourceFromShadowEvent({
    event: shadowEvent(decision, suffix),
    envelopeRefDigest: suffix === '1' ? digest1 : suffix === '2' ? digest2 : digest3,
    traceRefDigest: digestF,
  });
}

function eligibleCandidate(reviewerAffirmed = false) {
  return createBaselineCohortCandidate({
    cohortId: 'cohort:refunds:r1',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-17T14:01:00.000Z',
    sourceEvents: [
      source('admit', '1'),
      source('narrow', '2'),
      source('admit', '3'),
    ],
    reviewerAffirmed,
    reviewerRefDigest: reviewerAffirmed ? digestB : null,
  });
}

function testDescriptorRecordsNoAuthorityBoundary(): void {
  const descriptor = baselineCohortContractDescriptor();

  equal(descriptor.version, BASELINE_COHORT_CONTRACT_VERSION, 'Baseline cohort: version is explicit');
  equal(descriptor.canonicalShadowEventSchemaVersion, CANONICAL_SHADOW_EVENT_SCHEMA_VERSION, 'Baseline cohort: binds canonical shadow event schema');
  equal(descriptor.shadowRuntimePipelineVersion, SHADOW_RUNTIME_PIPELINE_VERSION, 'Baseline cohort: names shadow runtime pipeline version');
  equal(descriptor.decisionTraceLoggerVersion, DECISION_TRACE_LOGGER_VERSION, 'Baseline cohort: names decision trace logger version');
  ok(descriptor.sourceOrigins.includes('canonical-shadow-event'), 'Baseline cohort: canonical shadow event origin is supported');
  ok(descriptor.excludedSourceDecisions.includes('block'), 'Baseline cohort: block decisions are excluded');
  equal(descriptor.defaultMinimumSourceEventCountForPromotion, BASELINE_COHORT_DEFAULT_MIN_SOURCE_EVENTS_FOR_PROMOTION, 'Baseline cohort: minimum source floor is explicit');
  equal(descriptor.reviewerAffirmationRequired, true, 'Baseline cohort: reviewer affirmation is required');
  equal(descriptor.noAutoPromotion, true, 'Baseline cohort: auto promotion is forbidden');
  equal(descriptor.noRelaxation, true, 'Baseline cohort: relaxation is forbidden');
  equal(descriptor.learnsFromTraffic, false, 'Baseline cohort: descriptor does not learn from traffic');
  equal(descriptor.canAdmit, false, 'Baseline cohort: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Baseline cohort: descriptor cannot activate enforcement');
  equal(descriptor.productionReady, false, 'Baseline cohort: descriptor is not production readiness');
  ok(
    descriptor.nonClaims.includes('not-baseline-mining-engine'),
    'Baseline cohort: mining engine is a non-claim',
  );
}

function testShadowEventProjectionAndCandidateAreDigestOnly(): void {
  const event = shadowEvent('admit', '1');
  const before = JSON.stringify(event);
  const sourceEvent = createBaselineCohortSourceFromShadowEvent({
    event,
    envelopeRefDigest: digest1,
    traceRefDigest: digestF,
  });
  const after = JSON.stringify(event);
  const candidate = eligibleCandidate();

  equal(after, before, 'Baseline cohort: canonical shadow event is not mutated');
  equal(sourceEvent.sourceOrigin, 'canonical-shadow-event', 'Baseline cohort: source origin defaults to canonical shadow event');
  equal(sourceEvent.sourceEventDigest, event.digest, 'Baseline cohort: source event digest is preserved');
  equal(sourceEvent.tenantRefDigest, digestA, 'Baseline cohort: tenant digest is preserved');
  equal(sourceEvent.decision, 'admit', 'Baseline cohort: effective decision is projected');
  equal(sourceEvent.rawPayloadStored, false, 'Baseline cohort: source event stores no raw payload');
  ok(sourceEvent.evidenceRefDigests.includes(event.digest), 'Baseline cohort: source event digest is evidence-bound');
  equal(candidate.version, BASELINE_COHORT_CONTRACT_VERSION, 'Baseline cohort: candidate version is explicit');
  equal(candidate.tenantRefDigest, digestA, 'Baseline cohort: candidate is tenant-bound');
  equal(candidate.sourceEventCount, 3, 'Baseline cohort: source count is explicit');
  equal(candidate.safetyLabel, 'eligible', 'Baseline cohort: admit/narrow source set is eligible');
  equal(candidate.learnsFromTraffic, false, 'Baseline cohort: candidate does not learn from traffic');
  equal(candidate.trainingEnabled, false, 'Baseline cohort: candidate keeps training disabled');
  equal(candidate.autoPromote, false, 'Baseline cohort: candidate cannot auto-promote');
  equal(candidate.crossTenantAggregation, false, 'Baseline cohort: candidate does not aggregate tenants');
  equal(candidate.rawPayloadStored, false, 'Baseline cohort: candidate stores no raw payload');
  equal(candidate.canAdmit, false, 'Baseline cohort: candidate cannot admit');
  ok(candidate.digest.startsWith('sha256:'), 'Baseline cohort: candidate has deterministic digest');
}

function testBlockedUnknownAndCrossTenantInputsFailClosedOrHold(): void {
  throws(
    () =>
      createBaselineCohortCandidate({
        cohortId: 'cohort:blocked',
        tenantRefDigest: digestA,
        generatedAt: '2026-05-17T14:02:00.000Z',
        sourceEvents: [source('block', '1')],
      }),
    /must exclude block decisions/u,
    'Baseline cohort: block decisions cannot enter the cohort',
  );

  throws(
    () =>
      createBaselineCohortCandidate({
        cohortId: 'cohort:cross-tenant',
        tenantRefDigest: digestA,
        generatedAt: '2026-05-17T14:02:00.000Z',
        sourceEvents: [
          {
            ...source('admit', '1'),
            tenantRefDigest: digestB,
          },
        ],
      }),
    /must stay within one tenant/u,
    'Baseline cohort: cross-tenant source sets fail closed',
  );

  const unknown = createBaselineCohortCandidate({
    cohortId: 'cohort:unknown',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-17T14:02:00.000Z',
    sourceEvents: [source('unknown', '1')],
  });
  const review = createBaselineCohortCandidate({
    cohortId: 'cohort:review',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-17T14:02:00.000Z',
    sourceEvents: [source('review', '2')],
  });

  equal(unknown.safetyLabel, 'poisoning-risk', 'Baseline cohort: unknown decisions become poisoning-risk');
  equal(review.safetyLabel, 'needs-review', 'Baseline cohort: review decisions require review');
  equal(
    evaluateBaselineCohortPromotion({ candidate: unknown }).outcome,
    'held-for-safety-label',
    'Baseline cohort: poisoning-risk candidate cannot promote',
  );
  equal(
    evaluateBaselineCohortPromotion({ candidate: review }).outcome,
    'held-for-safety-label',
    'Baseline cohort: needs-review candidate cannot promote',
  );
}

function testPromotionGateRequiresReviewerSampleFloorAndStrengthening(): void {
  const candidate = eligibleCandidate(false);
  const affirmed = eligibleCandidate(true);
  const tooSmall = createBaselineCohortCandidate({
    cohortId: 'cohort:small',
    tenantRefDigest: digestA,
    generatedAt: '2026-05-17T14:03:00.000Z',
    sourceEvents: [source('admit', '1')],
    reviewerAffirmed: true,
    reviewerRefDigest: digestB,
  });

  const heldReview = evaluateBaselineCohortPromotion({ candidate });
  const heldSample = evaluateBaselineCohortPromotion({ candidate: tooSmall });
  const rejectedRelaxation = evaluateBaselineCohortPromotion({
    candidate: affirmed,
    requestedMutationMode: 'relaxation-requested',
  });
  const allowed = evaluateBaselineCohortPromotion({ candidate: affirmed });

  equal(heldReview.outcome, 'held-for-review', 'Baseline cohort: reviewer affirmation is required');
  equal(heldReview.promotionAllowed, false, 'Baseline cohort: review hold cannot promote');
  equal(heldReview.failClosed, true, 'Baseline cohort: review hold fails closed');
  equal(heldSample.outcome, 'held-for-sample-floor', 'Baseline cohort: minimum sample floor is enforced');
  equal(rejectedRelaxation.outcome, 'rejected-relaxation', 'Baseline cohort: relaxation requests are rejected');
  equal(rejectedRelaxation.relaxationAllowed, false, 'Baseline cohort: relaxation remains forbidden');
  equal(allowed.outcome, 'eligible-for-invariant-candidate-review', 'Baseline cohort: eligible reviewer-affirmed cohorts can move to candidate review');
  equal(allowed.promotionAllowed, true, 'Baseline cohort: reviewer-affirmed eligible cohorts can promote to review only');
  equal(allowed.canAdmit, false, 'Baseline cohort: promotion evaluation still cannot admit');
  equal(allowed.activatesEnforcement, false, 'Baseline cohort: promotion evaluation cannot activate enforcement');
  ok(allowed.digest.startsWith('sha256:'), 'Baseline cohort: promotion evaluation has digest');
}

function testDeterminismAndSignalEvidenceDigestHelper(): void {
  const first = eligibleCandidate(true);
  const second = eligibleCandidate(true);
  const refs: readonly SignalEvidenceRef[] = [
    { kind: 'evidence', digest: digestB },
    { kind: 'evidence', digest: digestB },
    { kind: 'trace', digest: digestA },
  ];

  equal(first.digest, second.digest, 'Baseline cohort: same input yields same candidate digest');
  deepEqual(
    evidenceRefDigestsForSignals(refs),
    [digestA, digestB],
    'Baseline cohort: signal evidence helper deduplicates digest-only refs',
  );
}

function testDocsOverviewPackageSurfaceAndScriptStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'baseline-cohort-contract.md');
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
    '# Baseline Cohort Contract',
    'attestor.baseline-cohort-contract.v1',
    'Splunk Enterprise Security UEBA',
    'Microsoft Sentinel UEBA',
    'NIST AI 100-2',
    'Daikon',
    'not a baseline mining engine',
    'not learned invariant promotion',
    'not live enforcement',
    'not production readiness',
  ]) {
    includes(doc, expected, `Baseline cohort doc: records ${expected}`);
  }

  for (const expected of [
    '| W09 | complete | Baseline Cohort Contract |',
    'src/consequence-admission/baseline-cohort-contract.ts',
    'tests/baseline-cohort-contract.test.ts',
    'docs/02-architecture/baseline-cohort-contract.md',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  includes(
    packageProbe,
    'baselineCohortContractDescriptor',
    'Package probe: checks baseline descriptor export',
  );
  includes(
    packageProbe,
    'createBaselineCohortCandidate',
    'Package probe: checks baseline candidate export',
  );
  includes(
    packageProbe,
    'evaluateBaselineCohortPromotion',
    'Package probe: checks baseline promotion export',
  );
  equal(
    packageJson.scripts['test:baseline-cohort-contract'],
    'tsx tests/baseline-cohort-contract.test.ts',
    'Baseline cohort: package script is registered',
  );
}

testDescriptorRecordsNoAuthorityBoundary();
testShadowEventProjectionAndCandidateAreDigestOnly();
testBlockedUnknownAndCrossTenantInputsFailClosedOrHold();
testPromotionGateRequiresReviewerSampleFloorAndStrengthening();
testDeterminismAndSignalEvidenceDigestHelper();
testDocsOverviewPackageSurfaceAndScriptStayAligned();

console.log(`Baseline cohort contract tests: ${passed} passed, 0 failed`);
