import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LAYER_OPINION_SCHEMA_VERSION,
  MODULATOR_AUTHORITY_TIER_VERSION,
  RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
  SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  fuseRelationshipAwareMonotoneHazard,
  relationshipAwareMonotoneFusionDescriptor,
  type ContextModulator,
  type LayerOpinion,
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

function opinion(input: {
  readonly id: string;
  readonly position: LayerOpinion['position'];
  readonly hazardScore: number | null;
  readonly uncertainty?: number;
  readonly signalKind?: LayerOpinion['projectedSignal']['kind'];
}): LayerOpinion {
  const uncertainty = input.uncertainty ?? 0.1;
  return {
    version: LAYER_OPINION_SCHEMA_VERSION,
    opinionId: input.id,
    layerId: 'layer-2-shadow-baseline',
    sourcePlane: 'shadow-baseline',
    envelopeRefDigest: digestA,
    projectedSignal: {
      category: input.signalKind === 'hard_floor' ? 'verdict' : 'gap',
      kind: input.signalKind ?? 'evidence_gap',
      authorityMode: 'advisory',
    },
    position: input.position,
    hazardScore: input.hazardScore,
    uncertainty,
    calibratedConfidence: 1 - uncertainty,
    evidenceQuality: 'moderate',
    novelty: 'unusual',
    contextFit: 'medium',
    calibrationState: 'calibration-ref-present',
    calibrationRefDigest: digestB,
    beliefMass: {
      hazard: input.hazardScore ?? 0,
      noAdvisoryObjection: 1 - uncertainty - (input.hazardScore ?? 0),
      uncertainty,
      baseRate: 0.1,
    },
    abstention: {
      abstained: input.position === 'abstained',
      reasons: input.position === 'abstained' ? ['insufficient-coverage'] : [],
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

function modulator(effect: ContextModulator['effect']): ContextModulator {
  return {
    modulatorId: `modulator-${effect}`,
    dimension: 'reversibility',
    authorityClass: 'tightening-only',
    effect,
    strength: 'medium',
    inputSource: 'consequence-envelope',
    envelopeRefDigest: digestA,
    context: {
      reversibilityClass: 'irreversible',
      blastRadiusEstimate: 'tenant',
      tenantMaturityClass: 'pilot',
      coveragePosture: 'medium',
      freshnessPosture: 'fresh',
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

function testDescriptorRecordsNoAuthorityAndFusionFeatures(): void {
  const descriptor = relationshipAwareMonotoneFusionDescriptor();

  equal(
    descriptor.version,
    RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
    'Monotone fusion: descriptor exposes version',
  );
  equal(
    descriptor.signalRelationshipContractVersion,
    SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    'Monotone fusion: descriptor links signal contract',
  );
  equal(
    descriptor.layerOpinionSchemaVersion,
    LAYER_OPINION_SCHEMA_VERSION,
    'Monotone fusion: descriptor links LayerOpinion',
  );
  equal(
    descriptor.modulatorAuthorityTierVersion,
    MODULATOR_AUTHORITY_TIER_VERSION,
    'Monotone fusion: descriptor links modulator tier',
  );
  equal(descriptor.pureFunction, true, 'Monotone fusion: implementation is pure function');
  equal(descriptor.duplicateDiscountSupported, true, 'Monotone fusion: duplicate discount is supported');
  equal(descriptor.confirmationBoostSupported, true, 'Monotone fusion: confirmation boost is supported');
  equal(descriptor.hardFloorPreservationRequired, true, 'Monotone fusion: hard floor is preserved');
  equal(descriptor.monotoneNoLoosening, true, 'Monotone fusion: no-loosening is required');
  equal(descriptor.grantsAuthority, false, 'Monotone fusion: cannot grant authority');
  equal(descriptor.activatesEnforcement, false, 'Monotone fusion: cannot activate enforcement');
  equal(descriptor.autoEnforce, false, 'Monotone fusion: cannot auto-enforce');
  equal(descriptor.productionReady, false, 'Monotone fusion: descriptor is not production readiness');
}

function testFusionPreservesMaxInputHazardAndAddsPressure(): void {
  const high = opinion({
    id: 'opinion-high',
    position: 'hazard-indicated',
    hazardScore: 0.72,
  });
  const gap = opinion({
    id: 'opinion-gap',
    position: 'gap-indicated',
    hazardScore: 0.31,
  });
  const relationships: readonly SignalRelationship[] = [
    {
      relationshipId: 'rel-confirm',
      kind: 'confirms',
      shape: 'symmetric',
      leftSignalId: high.opinionId,
      rightSignalId: gap.opinionId,
      evidenceRefs: [{ kind: 'schema', digest: digestA }],
      reasonCodes: ['test-confirm'],
      grantsAuthority: false,
      activatesEnforcement: false,
      autoEnforce: false,
      productionReady: false,
    },
  ];

  const result = fuseRelationshipAwareMonotoneHazard({
    envelopeRefDigest: digestA,
    opinions: [high, gap],
    relationships,
    modulators: [modulator('increase-review-pressure')],
  });

  ok(
    result.fusedHazardScore >= result.maxInputHazardScore,
    'Monotone fusion: fused score preserves max input hazard',
  );
  ok(
    result.confirmationBoostTotal > 0,
    'Monotone fusion: confirmation boost is visible',
  );
  ok(
    result.reasonCodes.includes('confirmation-boost-applied'),
    'Monotone fusion: confirmation reason is retained',
  );
  equal(result.grantsAuthority, false, 'Monotone fusion: result cannot grant authority');
}

function testDuplicateDiscountDoesNotAverageAwayStrongHazard(): void {
  const left = opinion({
    id: 'opinion-left',
    position: 'hazard-indicated',
    hazardScore: 0.8,
  });
  const right = opinion({
    id: 'opinion-right',
    position: 'hazard-indicated',
    hazardScore: 0.8,
  });
  const duplicate: SignalRelationship = {
    relationshipId: 'rel-duplicate',
    kind: 'duplicates',
    shape: 'symmetric',
    leftSignalId: left.opinionId,
    rightSignalId: right.opinionId,
    evidenceRefs: [{ kind: 'trace', digest: digestB }],
    reasonCodes: ['same-evidence'],
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };

  const result = fuseRelationshipAwareMonotoneHazard({
    envelopeRefDigest: digestA,
    opinions: [left, right],
    relationships: [duplicate],
    modulators: [],
  });

  equal(result.duplicateDiscountApplied, true, 'Monotone fusion: duplicate discount is applied');
  ok(result.duplicateDiscountTotal > 0, 'Monotone fusion: duplicate discount total is visible');
  ok(
    result.fusedHazardScore >= result.maxInputHazardScore,
    'Monotone fusion: duplicate discount does not average away max hazard',
  );
  ok(
    result.reasonCodes.includes('duplicate-discount-applied'),
    'Monotone fusion: duplicate reason is retained',
  );
}

function testRelationshipOnlyHazardsArePreserved(): void {
  const reviewRelationship: SignalRelationship = {
    relationshipId: 'rel-review-only',
    kind: 'requires_review',
    shape: 'unary',
    signalId: 'signal-shadow-abstention',
    evidenceRefs: [{ kind: 'runbook', digest: digestA }],
    reasonCodes: ['requires-review'],
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };

  const result = fuseRelationshipAwareMonotoneHazard({
    envelopeRefDigest: digestA,
    opinions: [],
    relationships: [reviewRelationship],
    modulators: [],
  });

  ok(
    result.maxInputHazardScore > 0,
    'Monotone fusion: relationship-only raw hazard is counted',
  );
  ok(
    result.fusedHazardScore >= result.maxInputHazardScore,
    'Monotone fusion: relationship-only raw hazard is preserved',
  );
}

function testReviewAndBlockPressureRemainNonAuthority(): void {
  const hard = opinion({
    id: 'opinion-hard',
    position: 'hazard-indicated',
    hazardScore: 0.9,
    signalKind: 'hard_floor',
  });
  const reviewRelationship: SignalRelationship = {
    relationshipId: 'rel-review',
    kind: 'requires_review',
    shape: 'unary',
    signalId: hard.opinionId,
    evidenceRefs: [{ kind: 'runbook', digest: digestA }],
    reasonCodes: ['requires-review'],
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };

  const result = fuseRelationshipAwareMonotoneHazard({
    envelopeRefDigest: digestA,
    opinions: [hard],
    relationships: [reviewRelationship],
    modulators: [modulator('increase-block-pressure')],
  });

  ok(result.blockPressure > 0, 'Monotone fusion: block pressure is visible');
  ok(result.reviewPressure > 0, 'Monotone fusion: review pressure is visible');
  equal(result.preservesHardFloor, true, 'Monotone fusion: hard floor is preserved');
  equal(result.activatesEnforcement, false, 'Monotone fusion: result does not activate enforcement');
  equal(result.autoEnforce, false, 'Monotone fusion: result does not auto-enforce');
}

function testHardFloorPreservationIsBehavioral(): void {
  const hard = opinion({
    id: 'opinion-hard-floor-low-score',
    position: 'no-advisory-objection',
    hazardScore: 0,
    signalKind: 'hard_floor',
  });

  const result = fuseRelationshipAwareMonotoneHazard({
    envelopeRefDigest: digestA,
    opinions: [hard],
    relationships: [],
    modulators: [],
  });

  equal(result.preservesHardFloor, true, 'Monotone fusion: hard-floor preservation claim remains true');
  ok(
    result.reasonCodes.includes('hard-floor-preserved'),
    'Monotone fusion: hard-floor input emits a hard-floor preservation reason',
  );
  ok(
    result.blockPressure >= 0.45,
    'Monotone fusion: hard-floor input contributes block pressure even with a low score',
  );
  ok(
    result.posture !== 'clear',
    'Monotone fusion: hard-floor input cannot produce a clear posture',
  );
}

function testFusionOutputIsStableUnderInputOrdering(): void {
  const first = opinion({
    id: 'opinion-1-high',
    position: 'hazard-indicated',
    hazardScore: 0.72,
  });
  const second = opinion({
    id: 'opinion-2-gap',
    position: 'gap-indicated',
    hazardScore: 0.31,
  });
  const third = opinion({
    id: 'opinion-3-abstained',
    position: 'abstained',
    hazardScore: null,
  });
  const duplicate: SignalRelationship = {
    relationshipId: 'rel-1-duplicate',
    kind: 'duplicates',
    shape: 'symmetric',
    leftSignalId: first.opinionId,
    rightSignalId: second.opinionId,
    evidenceRefs: [{ kind: 'trace', digest: digestA }],
    reasonCodes: ['same-evidence'],
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };
  const review: SignalRelationship = {
    relationshipId: 'rel-2-review',
    kind: 'requires_review',
    shape: 'unary',
    signalId: third.opinionId,
    evidenceRefs: [{ kind: 'runbook', digest: digestB }],
    reasonCodes: ['requires-review'],
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };
  const reviewModulator = modulator('increase-review-pressure');
  const blockModulator = modulator('increase-block-pressure');

  const canonical = fuseRelationshipAwareMonotoneHazard({
    envelopeRefDigest: digestA,
    opinions: [first, second, third],
    relationships: [duplicate, review],
    modulators: [reviewModulator, blockModulator],
  });
  const shuffled = fuseRelationshipAwareMonotoneHazard({
    envelopeRefDigest: digestA,
    opinions: [third, first, second],
    relationships: [review, duplicate],
    modulators: [blockModulator, reviewModulator],
  });

  deepEqual(
    shuffled,
    canonical,
    'Monotone fusion: shuffled opinions, relationships, and modulators produce identical output',
  );
}

function testFusionRejectsNonConservedLayerOpinionBeliefMass(): void {
  const badOpinion = {
    ...opinion({
      id: 'opinion-bad-mass',
      position: 'hazard-indicated',
      hazardScore: 0.7,
    }),
    beliefMass: {
      hazard: 0.8,
      noAdvisoryObjection: 0.8,
      uncertainty: 0.8,
      baseRate: 0.1,
    },
  };

  throws(
    () => fuseRelationshipAwareMonotoneHazard({
      envelopeRefDigest: digestA,
      opinions: [badOpinion],
      relationships: [],
      modulators: [],
    }),
    /beliefMass hazard \+ noAdvisoryObjection \+ uncertainty must equal 1/u,
    'Monotone fusion: rejects non-conserved LayerOpinion belief mass before scoring',
  );
}

function testDocsOverviewAndPackageScriptStayAligned(): void {
  const contractDoc = readProjectFile(
    'docs',
    '02-architecture',
    'relationship-aware-monotone-fusion.md',
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
    '# Relationship-Aware Monotone Fusion',
    'attestor.relationship-aware-monotone-fusion.v1',
    'RelationshipAwareMonotoneFusionResult',
    'relationshipAwareMonotoneFusionDescriptor()',
    'fuseRelationshipAwareMonotoneHazard()',
    'duplicate relationships discount duplicate advisory contributions',
    'monotoneNoLoosening = true',
    'preservesHardFloor = true',
    'grantsAuthority = false',
    'autoEnforce = false',
    'STPA / STAMP',
    'NRC fault tree analysis',
    'NASA FMEA',
    'Google SRE monitoring',
    'computes caution pressure',
    '`block-pressure` is not a block decision',
  ]) {
    includes(contractDoc, expected, `Monotone fusion docs: records ${expected}`);
  }

  includes(
    overview,
    '| 05 | complete | Relationship-aware monotone fusion |',
    'Consequence runtime assurance overview: Step 05 is marked complete',
  );
  includes(
    overview,
    'src/consequence-admission/relationship-aware-monotone-fusion.ts',
    'Consequence runtime assurance overview: implementation file is recorded',
  );
  equal(
    packageJson.scripts['test:relationship-aware-monotone-fusion'],
    'tsx tests/relationship-aware-monotone-fusion.test.ts',
    'Monotone fusion: package script is registered',
  );
}

testDescriptorRecordsNoAuthorityAndFusionFeatures();
testFusionPreservesMaxInputHazardAndAddsPressure();
testDuplicateDiscountDoesNotAverageAwayStrongHazard();
testRelationshipOnlyHazardsArePreserved();
testReviewAndBlockPressureRemainNonAuthority();
testHardFloorPreservationIsBehavioral();
testFusionOutputIsStableUnderInputOrdering();
testFusionRejectsNonConservedLayerOpinionBeliefMass();
testDocsOverviewAndPackageScriptStayAligned();

console.log(`Relationship-aware monotone fusion tests: ${passed} passed, 0 failed`);
