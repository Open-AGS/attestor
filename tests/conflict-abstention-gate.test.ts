import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFLICT_ABSTENTION_GATE_VERSION,
  LAYER_OPINION_SCHEMA_VERSION,
  MODULATOR_AUTHORITY_TIER_VERSION,
  RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
  SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  conflictAbstentionGateDescriptor,
  evaluateConflictAbstentionGate,
  fuseRelationshipAwareMonotoneHazard,
  type ConflictAbstentionGateOutcome,
  type ContextModulator,
  type LayerOpinion,
  type LayerOpinionAbstentionReason,
  type SignalRelationship,
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

function opinion(input: {
  readonly id: string;
  readonly position: LayerOpinion['position'];
  readonly hazardScore: number | null;
  readonly uncertainty?: number;
  readonly calibratedConfidence?: number | null;
  readonly signalKind?: LayerOpinion['projectedSignal']['kind'];
  readonly abstentionReasons?: readonly LayerOpinionAbstentionReason[];
  readonly evidenceQuality?: LayerOpinion['evidenceQuality'];
  readonly novelty?: LayerOpinion['novelty'];
  readonly contextFit?: LayerOpinion['contextFit'];
  readonly calibrationState?: LayerOpinion['calibrationState'];
}): LayerOpinion {
  const uncertainty = input.uncertainty ?? 0.1;
  const hazard = input.hazardScore ?? 0;
  const beliefUncertainty = Math.min(uncertainty, Math.max(0, 1 - hazard));
  const noAdvisoryObjection = Math.max(0, 1 - hazard - beliefUncertainty);
  const abstentionReasons = input.abstentionReasons ?? [];
  const signalKind = input.signalKind ?? 'evidence_gap';
  return {
    version: LAYER_OPINION_SCHEMA_VERSION,
    opinionId: input.id,
    layerId: 'layer-2-shadow-baseline',
    sourcePlane: 'shadow-baseline',
    envelopeRefDigest: digestA,
    projectedSignal: {
      category: signalKind === 'hard_floor' || signalKind === 'hazard' ||
        signalKind === 'abstention'
        ? 'verdict'
        : 'gap',
      kind: signalKind,
      authorityMode: 'advisory',
    },
    position: input.position,
    hazardScore: input.hazardScore,
    uncertainty,
    calibratedConfidence: input.calibratedConfidence ?? 1 - uncertainty,
    evidenceQuality: input.evidenceQuality ?? 'moderate',
    novelty: input.novelty ?? 'unusual',
    contextFit: input.contextFit ?? 'medium',
    calibrationState: input.calibrationState ?? 'calibration-ref-present',
    calibrationRefDigest: digestB,
    beliefMass: {
      hazard,
      noAdvisoryObjection,
      uncertainty: beliefUncertainty,
      baseRate: 0.1,
    },
    abstention: {
      abstained: input.position === 'abstained' || abstentionReasons.length > 0,
      reasons: abstentionReasons,
      neededEvidenceRefs: [],
    },
    sourceDependence: {
      dependsOnEnvelope: true,
      evidenceRefDigests: [digestB],
      readModelDigests: [digestA],
      relationshipIds: [],
      rawTrainingDataAccess: false,
      crossTenantRawDataAccess: false,
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestB }],
    readModelRefs: [{ modelKind: 'shadow-baseline', digest: digestA }],
    appliesToConsequenceClasses: ['financial'],
    reasonCodes: ['test-opinion'],
    noLoosening: true,
    mayGrantAuthority: false,
    mayActivateEnforcement: false,
    mayLowerRequiredReview: false,
    mayMarkSafe: false,
    mayStoreRawMaterial: false,
    mayTrainModel: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  };
}

function modulator(input: {
  readonly effect: ContextModulator['effect'];
  readonly coveragePosture?: ContextModulator['context']['coveragePosture'];
}): ContextModulator {
  return {
    modulatorId: `modulator-${input.effect}-${input.coveragePosture ?? 'medium'}`,
    dimension: input.effect === 'mark-freshness-risk' ? 'freshness' : 'coverage',
    authorityClass: 'tightening-only',
    effect: input.effect,
    strength: 'medium',
    inputSource: 'shadow-coverage',
    envelopeRefDigest: digestA,
    context: {
      reversibilityClass: 'irreversible',
      blastRadiusEstimate: 'tenant',
      tenantMaturityClass: 'pilot',
      coveragePosture: input.coveragePosture ?? 'medium',
      freshnessPosture: input.effect === 'mark-freshness-risk' ? 'stale' : 'fresh',
      contextFit: 'medium',
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestB }],
    readModelRefs: [{ modelKind: 'policy', digest: digestA }],
    reasonCodes: ['test-modulator'],
    noLoosening: true,
    preservesHardFloor: true,
    mayGrantAuthority: false,
    mayActivateEnforcement: false,
    autoEnforce: false,
    mayLowerRequiredReview: false,
    maySuppressHardDeny: false,
    mayMarkSafe: false,
    mayStoreRawMaterial: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  };
}

function gateFor(input: {
  readonly opinions: readonly LayerOpinion[];
  readonly relationships?: readonly SignalRelationship[];
  readonly modulators?: readonly ContextModulator[];
}) {
  const relationships = input.relationships ?? [];
  const modulators = input.modulators ?? [];
  const fusion = fuseRelationshipAwareMonotoneHazard({
    envelopeRefDigest: digestA,
    opinions: input.opinions,
    relationships,
    modulators,
  });
  return evaluateConflictAbstentionGate({
    envelopeRefDigest: digestA,
    fusion,
    opinions: input.opinions,
    relationships,
    modulators,
  });
}

function emptyFusion() {
  return fuseRelationshipAwareMonotoneHazard({
    envelopeRefDigest: digestA,
    opinions: [],
    relationships: [],
    modulators: [],
  });
}

function assertOutcome(
  actual: ConflictAbstentionGateOutcome,
  expected: ConflictAbstentionGateOutcome,
  message: string,
): void {
  equal(actual, expected, message);
}

function testDescriptorRecordsNoAuthorityAndThresholds(): void {
  const descriptor = conflictAbstentionGateDescriptor();

  equal(
    descriptor.version,
    CONFLICT_ABSTENTION_GATE_VERSION,
    'Conflict gate: descriptor exposes version',
  );
  equal(
    descriptor.relationshipAwareMonotoneFusionVersion,
    RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
    'Conflict gate: descriptor links fusion version',
  );
  equal(
    descriptor.signalRelationshipContractVersion,
    SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    'Conflict gate: descriptor links relationship contract',
  );
  equal(
    descriptor.layerOpinionSchemaVersion,
    LAYER_OPINION_SCHEMA_VERSION,
    'Conflict gate: descriptor links LayerOpinion schema',
  );
  equal(
    descriptor.modulatorAuthorityTierVersion,
    MODULATOR_AUTHORITY_TIER_VERSION,
    'Conflict gate: descriptor links modulator tier',
  );
  ok(descriptor.outcomes.includes('abstain-hold'), 'Conflict gate: abstain-hold is registered');
  ok(descriptor.outcomes.includes('block-pressure'), 'Conflict gate: block-pressure is registered');
  equal(descriptor.uncertaintyCannotAdmit, true, 'Conflict gate: uncertainty cannot admit');
  equal(descriptor.canAdmit, false, 'Conflict gate: descriptor cannot admit');
  equal(descriptor.grantsAuthority, false, 'Conflict gate: descriptor cannot grant authority');
  equal(descriptor.activatesEnforcement, false, 'Conflict gate: descriptor cannot activate enforcement');
  equal(descriptor.autoEnforce, false, 'Conflict gate: descriptor cannot auto-enforce');
  equal(descriptor.productionReady, false, 'Conflict gate: descriptor is not production readiness');
}

function testContradictionAndConflictEscalateToBlockPressure(): void {
  const left = opinion({
    id: 'opinion-left-conflict',
    position: 'conflict-indicated',
    hazardScore: 0.35,
  });
  const right = opinion({
    id: 'opinion-right-conflict',
    position: 'conflict-indicated',
    hazardScore: 0.34,
    abstentionReasons: ['conflicting-inputs'],
  });
  const relationships: readonly SignalRelationship[] = [
    {
      relationshipId: 'rel-contradicts-a',
      kind: 'contradicts',
      shape: 'symmetric',
      leftSignalId: left.opinionId,
      rightSignalId: right.opinionId,
      evidenceRefs: [{ kind: 'schema', digest: digestA }],
      reasonCodes: ['test-contradiction'],
      grantsAuthority: false,
      activatesEnforcement: false,
      autoEnforce: false,
      productionReady: false,
    },
    {
      relationshipId: 'rel-contradicts-b',
      kind: 'contradicts',
      shape: 'symmetric',
      leftSignalId: right.opinionId,
      rightSignalId: left.opinionId,
      evidenceRefs: [{ kind: 'trace', digest: digestB }],
      reasonCodes: ['test-contradiction'],
      grantsAuthority: false,
      activatesEnforcement: false,
      autoEnforce: false,
      productionReady: false,
    },
  ];

  const result = gateFor({ opinions: [left, right], relationships });

  assertOutcome(
    result.outcome,
    'block-pressure',
    'Conflict gate: high conflict escalates to block-pressure',
  );
  ok(result.conflictScore >= 0.5, 'Conflict gate: conflict score is high');
  ok(
    result.reasonCodes.includes('contradiction-relationship'),
    'Conflict gate: contradiction reason is retained',
  );
  ok(
    result.reasonCodes.includes('conflict-pressure-high'),
    'Conflict gate: conflict pressure reason is retained',
  );
  equal(result.canAdmit, false, 'Conflict gate: conflict output cannot admit');
}

function testAbstentionAndLowCoverageHold(): void {
  const abstained = opinion({
    id: 'opinion-abstain',
    position: 'abstained',
    hazardScore: null,
    uncertainty: 0.62,
    signalKind: 'abstention',
    abstentionReasons: [
      'insufficient-coverage',
      'out-of-distribution',
      'missing-evidence',
      'dependency-missing',
    ],
    evidenceQuality: 'unavailable',
    novelty: 'unknown',
    contextFit: 'out-of-scope',
    calibrationState: 'degraded',
  });

  const result = gateFor({
    opinions: [abstained],
    modulators: [modulator({ effect: 'mark-coverage-insufficient', coveragePosture: 'none' })],
  });

  assertOutcome(
    result.outcome,
    'abstain-hold',
    'Conflict gate: weighted abstention and low coverage hold',
  );
  ok(result.abstentionScore >= 0.5, 'Conflict gate: abstention score crosses hold threshold');
  ok(result.coverageGapScore > 0, 'Conflict gate: coverage gap is visible');
  ok(result.reasonCodes.includes('weighted-abstention-high'), 'Conflict gate: abstention reason is retained');
  ok(result.reasonCodes.includes('insufficient-coverage'), 'Conflict gate: coverage reason is retained');
  ok(result.reasonCodes.includes('out-of-distribution'), 'Conflict gate: OOD reason is retained');
}

function testHighUncertaintyReviewsButNeverAdmits(): void {
  const uncertain = opinion({
    id: 'opinion-uncertain',
    position: 'uncertainty-indicated',
    hazardScore: 0.12,
    uncertainty: 0.77,
    calibratedConfidence: 0.23,
    evidenceQuality: 'weak',
    novelty: 'novel',
    contextFit: 'low',
  });

  const result = gateFor({ opinions: [uncertain] });

  assertOutcome(result.outcome, 'review', 'Conflict gate: high uncertainty reviews');
  ok(result.uncertaintyScore >= 0.35, 'Conflict gate: uncertainty score crosses review threshold');
  ok(result.reasonCodes.includes('uncertainty-high'), 'Conflict gate: uncertainty reason is retained');
  ok(result.reasonCodes.includes('low-confidence'), 'Conflict gate: confidence reason is retained');
  equal(result.canAdmit, false, 'Conflict gate: uncertainty cannot admit');
  equal(result.grantsAuthority, false, 'Conflict gate: uncertainty cannot grant authority');
}

function testClearSignalsContinueWithoutAdmissionAuthority(): void {
  const clear = opinion({
    id: 'opinion-clear',
    position: 'no-advisory-objection',
    hazardScore: 0,
    uncertainty: 0.02,
    evidenceQuality: 'strong',
    novelty: 'known',
    contextFit: 'high',
  });

  const result = gateFor({ opinions: [clear] });

  assertOutcome(result.outcome, 'continue', 'Conflict gate: clear signal can continue');
  equal(result.canAdmit, false, 'Conflict gate: continue is not admit');
  equal(result.activatesEnforcement, false, 'Conflict gate: continue does not activate enforcement');
  ok(result.reasonCodes.includes('no-admit-authority'), 'Conflict gate: no-admit reason is retained');
}

function testEmptyInputsFailClosedToAbstainHold(): void {
  const result = evaluateConflictAbstentionGate({
    envelopeRefDigest: digestA,
    fusion: emptyFusion(),
    opinions: [],
    relationships: [],
    modulators: [],
  });

  assertOutcome(result.outcome, 'abstain-hold', 'Conflict gate: empty reviewed inputs fail closed');
  equal(result.reviewedInputs.opinionCount, 0, 'Conflict gate: empty input records zero opinions');
  equal(result.reviewedInputs.relationshipCount, 0, 'Conflict gate: empty input records zero relationships');
  equal(result.reviewedInputs.modulatorCount, 0, 'Conflict gate: empty input records zero modulators');
  ok(result.coverageGapScore >= 1, 'Conflict gate: empty input marks full coverage gap');
  ok(result.reasonCodes.includes('insufficient-coverage'), 'Conflict gate: empty input records insufficient coverage');
  equal(result.canAdmit, false, 'Conflict gate: empty input cannot admit');
}

function testFusionWatchPostureEscalatesToReview(): void {
  const watch = opinion({
    id: 'opinion-watch',
    position: 'hazard-indicated',
    hazardScore: 0.1,
    uncertainty: 0.02,
    evidenceQuality: 'strong',
    novelty: 'known',
    contextFit: 'high',
  });

  const result = gateFor({ opinions: [watch] });

  equal(result.outcome, 'review', 'Conflict gate: fusion watch posture is visible to reviewers');
  ok(result.reasonCodes.includes('fusion-watch-pressure'), 'Conflict gate: fusion watch reason is retained');
  equal(result.canAdmit, false, 'Conflict gate: fusion watch cannot admit');
}

function testFusionBlockPressureIsPreserved(): void {
  const hard = opinion({
    id: 'opinion-hard-floor',
    position: 'hazard-indicated',
    hazardScore: 0.92,
    signalKind: 'hard_floor',
  });

  const result = gateFor({
    opinions: [hard],
    modulators: [modulator({ effect: 'increase-block-pressure' })],
  });

  assertOutcome(result.outcome, 'block-pressure', 'Conflict gate: fusion block pressure is preserved');
  ok(result.reasonCodes.includes('hard-floor-preserved'), 'Conflict gate: hard floor reason is retained');
  ok(result.reasonCodes.includes('fusion-block-pressure'), 'Conflict gate: fusion block reason is retained');
  equal(result.noLoosening, true, 'Conflict gate: hard floor cannot loosen');
}

function testDocsOverviewAndPackageScriptStayAligned(): void {
  const contractDoc = readProjectFile(
    'docs',
    '02-architecture',
    'conflict-abstention-gate.md',
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
    '# Conflict And Abstention Gate',
    'attestor.conflict-abstention-gate.v1',
    'ConflictAbstentionGateResult',
    'conflictAbstentionGateDescriptor()',
    'evaluateConflictAbstentionGate()',
    'continue       -> no conflict/abstention objection from this gate only',
    'abstain-hold',
    'block-pressure',
    'canAdmit = false',
    'grantsAuthority = false',
    'STPA / STAMP',
    'NIST AI RMF',
    'Conformal prediction with reject option',
    'Google SRE monitoring',
    'calibrated probability or conformal validity',
  ]) {
    includes(contractDoc, expected, `Conflict gate docs: records ${expected}`);
  }

  includes(
    overview,
    '| 06 | complete | Conflict and abstention gate |',
    'Consequence runtime assurance overview: Step 06 is marked complete',
  );
  includes(
    overview,
    'src/consequence-admission/conflict-abstention-gate.ts',
    'Consequence runtime assurance overview: implementation file is recorded',
  );
  includes(
    overview,
    'src/consequence-admission/human-comprehension-gate.ts',
    'Consequence runtime assurance overview: next implementation file is recorded',
  );
  equal(
    packageJson.scripts['test:conflict-abstention-gate'],
    'tsx tests/conflict-abstention-gate.test.ts',
    'Conflict gate: package script is registered',
  );
}

testDescriptorRecordsNoAuthorityAndThresholds();
testContradictionAndConflictEscalateToBlockPressure();
testAbstentionAndLowCoverageHold();
testHighUncertaintyReviewsButNeverAdmits();
testClearSignalsContinueWithoutAdmissionAuthority();
testEmptyInputsFailClosedToAbstainHold();
testFusionWatchPostureEscalatesToReview();
testFusionBlockPressureIsPreserved();
testDocsOverviewAndPackageScriptStayAligned();

console.log(`Conflict and abstention gate tests: ${passed} passed, 0 failed`);
