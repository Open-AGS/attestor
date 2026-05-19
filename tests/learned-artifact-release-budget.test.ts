import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  LEARNED_ARTIFACT_RELEASE_BUDGET_DEFAULT_MIN_COHORT_EVENTS,
  LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION,
  createLearnedArtifactReleaseBudget,
  evaluateLearnedArtifactReleaseBudget,
  learnedArtifactReleaseBudgetDescriptor,
  type CreateLearnedArtifactReleaseBudgetInput,
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

function baseInput(
  overrides?: Partial<CreateLearnedArtifactReleaseBudgetInput>,
): CreateLearnedArtifactReleaseBudgetInput {
  return {
    artifactId: 'learned-artifact:refund-authority-presence',
    artifactKind: 'candidate-invariant',
    artifactRefDigest: digestB,
    tenantRefDigest: digestA,
    cohortRefDigest: digestC,
    generatedAt: '2026-05-18T10:00:00.000Z',
    requestedReleaseMode: 'assurance-review',
    sourceEventCount: 64,
    privacyBudget: {
      budgetId: 'budget:tenant-a:refunds:v1',
      budgetRefDigest: digestD,
      tenantRefDigest: digestA,
      cohortRefDigest: digestC,
      totalBudgetUnits: 100,
      spentBudgetUnits: 20,
      requestedBudgetUnits: 10,
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
      mitigationRefDigest: digestE,
    },
    assuranceCaseRefDigest: digestF,
    reviewerRefDigest: digestE,
    ...overrides,
  };
}

function testDescriptorRecordsBudgetBoundary(): void {
  const descriptor = learnedArtifactReleaseBudgetDescriptor();

  equal(descriptor.version, LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION, 'Learned artifact budget: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Learned artifact budget: binds assurance case contract');
  ok(descriptor.sourceAnchors.includes('nist-sp-800-226-dp-hazards'), 'Learned artifact budget: NIST DP hazards anchor is present');
  ok(descriptor.sourceAnchors.includes('opendp-context-composition'), 'Learned artifact budget: OpenDP composition anchor is present');
  ok(descriptor.sourceAnchors.includes('census-reconstruction-attack'), 'Learned artifact budget: Census reconstruction anchor is present');
  ok(descriptor.artifactKinds.includes('candidate-invariant'), 'Learned artifact budget: candidate invariant artifact is represented');
  ok(descriptor.releaseModes.includes('public-release'), 'Learned artifact budget: public release is representable for rejection');
  equal(descriptor.defaultMinimumCohortEventCount, LEARNED_ARTIFACT_RELEASE_BUDGET_DEFAULT_MIN_COHORT_EVENTS, 'Learned artifact budget: cohort floor is explicit');
  equal(descriptor.budgetRequiredBeforeRelease, true, 'Learned artifact budget: budget is required');
  equal(descriptor.assuranceCaseContextRequired, true, 'Learned artifact budget: assurance-case context is required');
  equal(descriptor.underminingDefeaterOnRisk, true, 'Learned artifact budget: risk opens undermining defeaters');
  equal(descriptor.differentialPrivacyEngine, false, 'Learned artifact budget: descriptor is not a DP engine');
  equal(descriptor.externalDpProofAcceptedAsEvidenceOnly, true, 'Learned artifact budget: external DP proof is evidence only');
  equal(descriptor.noCrossTenantRelease, true, 'Learned artifact budget: cross-tenant release is forbidden');
  equal(descriptor.noPublicRelease, true, 'Learned artifact budget: public release is forbidden');
  equal(descriptor.noAutoPromotion, true, 'Learned artifact budget: auto-promotion is forbidden');
  equal(descriptor.learnsFromTraffic, false, 'Learned artifact budget: descriptor does not learn from traffic');
  equal(descriptor.canAdmit, false, 'Learned artifact budget: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Learned artifact budget: descriptor cannot enforce');
  equal(descriptor.productionReady, false, 'Learned artifact budget: descriptor is not production readiness');
  ok(descriptor.nonClaims.includes('not-differential-privacy-engine'), 'Learned artifact budget: DP engine is a non-claim');
  ok(descriptor.nonClaims.includes('not-dp-guarantee'), 'Learned artifact budget: DP guarantee is a non-claim');
}

function testCleanBudgetIsReadyForAssuranceReviewOnly(): void {
  const record = createLearnedArtifactReleaseBudget(baseInput());
  const evaluation = evaluateLearnedArtifactReleaseBudget(record);

  equal(record.version, LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION, 'Learned artifact budget: record version is explicit');
  equal(record.outcome, 'release-ready-for-assurance-review', 'Learned artifact budget: clean internal request is review-ready');
  equal(record.releaseReadyForAssuranceReview, true, 'Learned artifact budget: review readiness is true');
  equal(record.budgetAvailable, true, 'Learned artifact budget: budget is available');
  equal(record.remainingBudgetUnitsBefore, 80, 'Learned artifact budget: remaining budget before release is computed');
  equal(record.remainingBudgetUnitsAfter, 70, 'Learned artifact budget: remaining budget after release is computed');
  equal(record.dangerFlags.length, 0, 'Learned artifact budget: clean request has no danger flags');
  equal(record.underminingDefeaterRequired, false, 'Learned artifact budget: clean request needs no undermining defeater');
  equal(record.differentialPrivacyGuaranteeProvided, false, 'Learned artifact budget: no DP guarantee is provided');
  equal(record.noRawMaterial, true, 'Learned artifact budget: raw material is forbidden');
  equal(record.noCrossTenantRelease, true, 'Learned artifact budget: cross-tenant release is forbidden');
  equal(record.noPublicRelease, true, 'Learned artifact budget: public release is forbidden');
  equal(record.canAdmit, false, 'Learned artifact budget: record cannot admit');
  equal(record.activatesEnforcement, false, 'Learned artifact budget: record cannot enforce');
  equal(record.productionReady, false, 'Learned artifact budget: record is not production readiness');
  equal(evaluation.releaseReadyForAssuranceReview, true, 'Learned artifact budget: evaluation preserves readiness');
  equal(evaluation.canAdmit, false, 'Learned artifact budget: evaluation cannot admit');
  ok(record.digest.startsWith('sha256:'), 'Learned artifact budget: record has digest');
  ok(evaluation.digest.startsWith('sha256:'), 'Learned artifact budget: evaluation has digest');
}

function testBudgetCohortAndReviewerHolds(): void {
  const budgetHeld = createLearnedArtifactReleaseBudget(baseInput({
    privacyBudget: {
      ...baseInput().privacyBudget,
      spentBudgetUnits: 95,
      requestedBudgetUnits: 10,
    },
  }));
  const cohortHeld = createLearnedArtifactReleaseBudget(baseInput({
    sourceEventCount: 12,
  }));
  const reviewerHeld = createLearnedArtifactReleaseBudget(baseInput({
    reviewerRefDigest: null,
  }));

  equal(budgetHeld.outcome, 'held-for-budget', 'Learned artifact budget: exhausted budget holds release');
  ok(budgetHeld.dangerFlags.includes('budget-exceeded'), 'Learned artifact budget: budget danger flag is present');
  equal(budgetHeld.underminingDefeaterRequired, true, 'Learned artifact budget: budget hold opens defeater');
  equal(cohortHeld.outcome, 'held-for-cohort-floor', 'Learned artifact budget: small cohort holds release');
  ok(cohortHeld.dangerFlags.includes('insufficient-cohort-size'), 'Learned artifact budget: cohort floor flag is present');
  equal(reviewerHeld.outcome, 'held-for-reviewer', 'Learned artifact budget: missing reviewer holds release');
  ok(reviewerHeld.dangerFlags.includes('missing-reviewer'), 'Learned artifact budget: missing reviewer flag is present');
}

function testRawCrossTenantAndPublicRequestsAreRejected(): void {
  const raw = createLearnedArtifactReleaseBudget(baseInput({
    rawMaterialRequested: true,
  }));
  const crossTenant = createLearnedArtifactReleaseBudget(baseInput({
    requestedReleaseMode: 'cross-tenant-redacted-signal',
  }));
  const publicRelease = createLearnedArtifactReleaseBudget(baseInput({
    requestedReleaseMode: 'public-release',
  }));

  equal(raw.outcome, 'rejected-raw-material', 'Learned artifact budget: raw material request is rejected');
  equal(crossTenant.outcome, 'rejected-cross-tenant-release', 'Learned artifact budget: cross-tenant request is rejected');
  equal(publicRelease.outcome, 'rejected-public-release', 'Learned artifact budget: public release request is rejected');
  ok(raw.dangerFlags.includes('raw-material-requested'), 'Learned artifact budget: raw flag is present');
  ok(crossTenant.dangerFlags.includes('cross-tenant-release-requested'), 'Learned artifact budget: cross-tenant flag is present');
  ok(publicRelease.dangerFlags.includes('public-release-requested'), 'Learned artifact budget: public release flag is present');
}

function testDpClaimAndReconstructionRiskAreDefeaterMaterial(): void {
  const dpMissingProof = createLearnedArtifactReleaseBudget(baseInput({
    differentialPrivacyGuaranteeClaimed: true,
  }));
  const dpProofEvidenceOnly = createLearnedArtifactReleaseBudget(baseInput({
    differentialPrivacyGuaranteeClaimed: true,
    privacyBudget: {
      ...baseInput().privacyBudget,
      accountingMode: 'external-dp-proof-bound',
      externalDpProofRefDigest: digestF,
    },
  }));
  const reconstructionHeld = createLearnedArtifactReleaseBudget(baseInput({
    reconstructionRisk: {
      riskLevel: 'high',
      reconstructionAttackConsidered: true,
      highResolutionPattern: true,
      uniqueSubjectRisk: true,
      frequentPatternCandidate: true,
      mitigationRefDigest: null,
    },
  }));

  equal(dpMissingProof.outcome, 'held-for-dp-proof-review', 'Learned artifact budget: DP claim without proof is held');
  ok(dpMissingProof.dangerFlags.includes('differential-privacy-claim-without-proof'), 'Learned artifact budget: missing DP proof flag is present');
  equal(dpProofEvidenceOnly.differentialPrivacyGuaranteeProvided, false, 'Learned artifact budget: external proof does not become Attestor DP guarantee');
  ok(dpProofEvidenceOnly.dangerFlags.includes('external-dp-proof-evidence-only'), 'Learned artifact budget: external DP proof is evidence-only');
  equal(reconstructionHeld.outcome, 'held-for-reconstruction-risk', 'Learned artifact budget: reconstruction risk holds release');
  ok(reconstructionHeld.dangerFlags.includes('reconstruction-risk-high'), 'Learned artifact budget: reconstruction high flag is present');
  ok(reconstructionHeld.dangerFlags.includes('high-resolution-pattern'), 'Learned artifact budget: high-resolution flag is present');
  ok(reconstructionHeld.dangerFlags.includes('unique-subject-risk'), 'Learned artifact budget: unique subject flag is present');
  ok(reconstructionHeld.dangerFlags.includes('frequent-pattern-release'), 'Learned artifact budget: frequent-pattern flag is present');
  equal(reconstructionHeld.underminingDefeaterRequired, true, 'Learned artifact budget: risky release requires undermining defeater');
}

function testTenantCohortAndBudgetShapeInvariants(): void {
  throws(
    () => createLearnedArtifactReleaseBudget(baseInput({
      privacyBudget: {
        ...baseInput().privacyBudget,
        tenantRefDigest: digestB,
      },
    })),
    /tenantRefDigest mismatch/u,
    'Learned artifact budget: budget tenant mismatch fails closed',
  );

  throws(
    () => createLearnedArtifactReleaseBudget(baseInput({
      privacyBudget: {
        ...baseInput().privacyBudget,
        cohortRefDigest: digestB,
      },
    })),
    /cohortRefDigest mismatch/u,
    'Learned artifact budget: budget cohort mismatch fails closed',
  );

  throws(
    () => createLearnedArtifactReleaseBudget(baseInput({
      privacyBudget: {
        ...baseInput().privacyBudget,
        totalBudgetUnits: 10,
        spentBudgetUnits: 11,
      },
    })),
    /spentBudgetUnits must not exceed/u,
    'Learned artifact budget: overspent budget shape is rejected',
  );
}

function testDeterminismAndNoMutation(): void {
  const input = baseInput();
  const before = JSON.stringify(input);
  const first = createLearnedArtifactReleaseBudget(input);
  const second = createLearnedArtifactReleaseBudget(input);

  equal(first.digest, second.digest, 'Learned artifact budget: identical input yields identical digest');
  equal(JSON.stringify(input), before, 'Learned artifact budget: input is not mutated');
  ok(Object.isFrozen(first), 'Learned artifact budget: record is frozen');
}

function testDocsPackageAndOverview(): void {
  const docs = readProjectFile(
    'docs',
    '02-architecture',
    'learned-artifact-release-budget.md',
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
    '# Learned Artifact Release Budget',
    'I01',
    'NIST SP 800-226',
    'OpenDP',
    'Census reconstruction',
    'undermining defeater',
    'not-differential-privacy-engine',
    'not-dp-guarantee',
    'not-cross-tenant-aggregation',
  ]) {
    includes(docs, expected, `Learned artifact budget docs: records ${expected}`);
  }

  includes(overview, 'Progress: 14/14 complete after I13. 0 steps remain.', 'Overview: progress is updated');
  includes(overview, '| I01 | complete | Learned Artifact Release Budget |', 'Overview: I01 is complete');
  includes(overview, 'src/consequence-admission/learned-artifact-release-budget.ts', 'Overview: I01 source file is tracked');
  includes(overview, 'tests/learned-artifact-release-budget.test.ts', 'Overview: I01 test file is tracked');
  assert.equal(
    packageJson.scripts['test:learned-artifact-release-budget'],
    'tsx tests/learned-artifact-release-budget.test.ts',
    'Learned artifact budget: package script is registered',
  );
  passed += 1;
}

testDescriptorRecordsBudgetBoundary();
testCleanBudgetIsReadyForAssuranceReviewOnly();
testBudgetCohortAndReviewerHolds();
testRawCrossTenantAndPublicRequestsAreRejected();
testDpClaimAndReconstructionRiskAreDefeaterMaterial();
testTenantCohortAndBudgetShapeInvariants();
testDeterminismAndNoMutation();
testDocsPackageAndOverview();

console.log(`Learned artifact release budget tests: ${passed} passed, 0 failed`);
