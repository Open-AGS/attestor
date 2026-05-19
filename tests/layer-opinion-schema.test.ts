import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LAYER_OPINION_SCHEMA_VERSION,
  assertLayerOpinionRuntimeInvariants,
  layerOpinionSchemaDescriptor,
  type LayerOpinion,
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

function validLayerOpinion(): LayerOpinion<'gap'> {
  return {
    version: LAYER_OPINION_SCHEMA_VERSION,
    opinionId: 'opinion-evidence-gap',
    layerId: 'layer-2-shadow-baseline',
    sourcePlane: 'shadow-baseline',
    envelopeRefDigest: digestA,
    projectedSignal: {
      category: 'gap',
      kind: 'evidence_gap',
      authorityMode: 'advisory',
    },
    position: 'gap-indicated',
    hazardScore: 0.7,
    uncertainty: 0.25,
    calibratedConfidence: 0.75,
    evidenceQuality: 'moderate',
    novelty: 'unusual',
    contextFit: 'medium',
    calibrationState: 'calibration-ref-present',
    calibrationRefDigest: digestB,
    beliefMass: {
      hazard: 0.55,
      noAdvisoryObjection: 0.2,
      uncertainty: 0.25,
      baseRate: 0.1,
    },
    abstention: {
      abstained: false,
      reasons: [],
      neededEvidenceRefs: [],
    },
    sourceDependence: {
      dependsOnEnvelope: true,
      evidenceRefDigests: [digestB],
      readModelDigests: [digestA],
      relationshipIds: ['rel-gap-review'],
      rawTrainingDataAccess: false,
      crossTenantRawDataAccess: false,
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestB }],
    readModelRefs: [{ modelKind: 'shadow-baseline', digest: digestA }],
    appliesToConsequenceClasses: ['financial'],
    reasonCodes: ['missing-required-evidence'],
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

function testDescriptorRecordsLayerScopeAndProjection(): void {
  const descriptor = layerOpinionSchemaDescriptor();

  equal(
    descriptor.version,
    LAYER_OPINION_SCHEMA_VERSION,
    'LayerOpinion: descriptor exposes version',
  );
  equal(
    descriptor.signalRelationshipContractVersion,
    'attestor.signal-relationship-contract.v1',
    'LayerOpinion: descriptor links to signal relationship contract',
  );

  for (const expected of [
    'layer-1-formal-verification',
    'layer-2-shadow-baseline',
    'layer-3-spatial-topology',
    'layer-4-temporal-trajectory',
    'layer-5-collective-intelligence',
  ]) {
    ok(
      descriptor.layerIds.includes(expected),
      `LayerOpinion: layer ${expected} is registered`,
    );
  }

  ok(
    descriptor.sourcePlanes.includes('formal-verification'),
    'LayerOpinion: formal verification source plane is registered',
  );
  ok(
    descriptor.sourcePlanes.includes('collective-intelligence'),
    'LayerOpinion: collective intelligence source plane is registered',
  );
  ok(
    descriptor.authorityModes.includes('advisory'),
    'LayerOpinion: advisory authority mode is allowed',
  );
  ok(
    !descriptor.authorityModes.includes('hard-floor' as never),
    'LayerOpinion: hard-floor authority mode is not allowed',
  );
}

function testDescriptorRecordsUncertaintyAbstentionAndNoLoosening(): void {
  const descriptor = layerOpinionSchemaDescriptor();

  for (const expected of [
    'hazard-indicated',
    'gap-indicated',
    'conflict-indicated',
    'uncertainty-indicated',
    'abstained',
    'no-advisory-objection',
  ]) {
    ok(
      descriptor.positions.includes(expected),
      `LayerOpinion: position ${expected} is registered`,
    );
  }

  ok(
    descriptor.abstentionReasons.includes('out-of-distribution'),
    'LayerOpinion: out-of-distribution abstention is registered',
  );
  ok(
    descriptor.abstentionReasons.includes('dependency-missing'),
    'LayerOpinion: dependency-missing abstention is registered',
  );
  equal(descriptor.advisoryOnly, true, 'LayerOpinion: descriptor is advisory-only');
  equal(descriptor.abstentionIsFirstClass, true, 'LayerOpinion: abstention is first-class');
  equal(descriptor.sourceDependenceRequired, true, 'LayerOpinion: source dependence is required');
  equal(descriptor.beliefMassRequired, true, 'LayerOpinion: belief mass is required');
  equal(
    descriptor.beliefMassConservationRequired,
    true,
    'LayerOpinion: belief mass conservation is required',
  );
  equal(descriptor.noLooseningRequired, true, 'LayerOpinion: no-loosening is required');
  equal(descriptor.mayGrantAuthority, false, 'LayerOpinion: cannot grant authority');
  equal(descriptor.mayActivateEnforcement, false, 'LayerOpinion: cannot activate enforcement');
  equal(descriptor.mayLowerRequiredReview, false, 'LayerOpinion: cannot lower required review');
  equal(descriptor.mayMarkSafe, false, 'LayerOpinion: cannot mark safe');
  equal(descriptor.mayStoreRawMaterial, false, 'LayerOpinion: cannot store raw material');
  equal(descriptor.mayTrainModel, false, 'LayerOpinion: cannot train a model');
  equal(descriptor.productionReady, false, 'LayerOpinion: descriptor is not production readiness');
}

function testLayerOpinionShapeIsAdvisoryAndCategoryBound(): void {
  const opinion = validLayerOpinion();

  equal(opinion.projectedSignal.category, 'gap', 'LayerOpinion: projected category is preserved');
  equal(opinion.projectedSignal.kind, 'evidence_gap', 'LayerOpinion: projected kind is category-bound');
  equal(opinion.sourceDependence.rawTrainingDataAccess, false, 'LayerOpinion: raw training data access is forbidden');
  equal(opinion.noLoosening, true, 'LayerOpinion: no-loosening is part of the instance');
  equal(opinion.mayMarkSafe, false, 'LayerOpinion: instance cannot mark safe');
}

function testLayerOpinionRuntimeInvariantsValidateBeliefMassAndEnvelope(): void {
  const opinion = validLayerOpinion();

  assertLayerOpinionRuntimeInvariants(opinion, { envelopeRefDigest: digestA });
  passed += 1;

  throws(
    () => assertLayerOpinionRuntimeInvariants({
      ...opinion,
      beliefMass: {
        hazard: 0.95,
        noAdvisoryObjection: 0.95,
        uncertainty: 0.95,
        baseRate: 0.1,
      },
    }),
    /beliefMass hazard \+ noAdvisoryObjection \+ uncertainty must equal 1/u,
    'LayerOpinion: runtime invariant rejects non-conserved belief mass',
  );
  throws(
    () => assertLayerOpinionRuntimeInvariants(opinion, { envelopeRefDigest: digestB }),
    /envelopeRefDigest must match fusion envelope/u,
    'LayerOpinion: runtime invariant rejects envelope mismatch',
  );
  throws(
    () => assertLayerOpinionRuntimeInvariants({
      ...opinion,
      reasonCodes: ['Repo Proven'],
    }),
    /reasonCodes\[0\] must be a stable lowercase reason code/u,
    'LayerOpinion: runtime invariant rejects unstable reason codes',
  );
}

function testDocsOverviewAndPackageScriptStayAligned(): void {
  const contractDoc = readProjectFile(
    'docs',
    '02-architecture',
    'layer-opinion-schema.md',
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
    '# LayerOpinion Schema',
    'attestor.layer-opinion-schema.v1',
    'LayerOpinion',
    'LayerOpinionSignalProjection',
    'LayerOpinionBeliefMass',
    'LayerOpinionAbstention',
    'LayerOpinionSourceDependence',
    'assertLayerOpinionRuntimeInvariants()',
    'layerOpinionSchemaDescriptor()',
    'no-advisory-objection',
    'hazard + noAdvisoryObjection + uncertainty = 1',
    'noLoosening = true',
    'mayMarkSafe = false',
    'mayTrainModel = false',
    'STPA / STAMP',
    'NASA runtime assurance',
    'Conformal prediction',
    'NIST AI RMF',
    'that any advisory layer is implemented',
  ]) {
    includes(contractDoc, expected, `LayerOpinion docs: records ${expected}`);
  }

  includes(
    overview,
    '| 03 | complete | LayerOpinion schema |',
    'Consequence runtime assurance overview: Step 03 is marked complete',
  );
  includes(
    overview,
    'src/consequence-admission/layer-opinion-schema.ts',
    'Consequence runtime assurance overview: implementation file is recorded',
  );
  equal(
    packageJson.scripts['test:layer-opinion-schema'],
    'tsx tests/layer-opinion-schema.test.ts',
    'LayerOpinion: package script is registered',
  );
}

testDescriptorRecordsLayerScopeAndProjection();
testDescriptorRecordsUncertaintyAbstentionAndNoLoosening();
testLayerOpinionShapeIsAdvisoryAndCategoryBound();
testLayerOpinionRuntimeInvariantsValidateBeliefMassAndEnvelope();
testDocsOverviewAndPackageScriptStayAligned();

console.log(`LayerOpinion schema tests: ${passed} passed, 0 failed`);
