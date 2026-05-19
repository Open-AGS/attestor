import type {
  ConsequenceEnvelopeConsequenceClass,
  ConsequenceEnvelopeDigestRef,
} from './consequence-envelope-contract.js';
import {
  CONSEQUENCE_ENVELOPE_CONSEQUENCE_CLASSES,
} from './consequence-envelope-contract.js';
import {
  SIGNAL_BOUNDARY_KINDS,
  SIGNAL_CONTEXT_KINDS,
  SIGNAL_GAP_KINDS,
  SIGNAL_MEASUREMENT_KINDS,
  SIGNAL_OBSERVATION_KINDS,
  SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  SIGNAL_VERDICT_KINDS,
  SIGNAL_EVIDENCE_REFERENCE_KINDS,
  type SignalAuthorityMode,
  type SignalCategory,
  type SignalEvidenceRef,
  type SignalKindForCategory,
  type SignalReadModelRef,
  type SignalSourcePlane,
} from './signal-relationship-contract.js';

export const LAYER_OPINION_SCHEMA_VERSION =
  'attestor.layer-opinion-schema.v1';

export const LAYER_OPINION_LAYER_IDS = [
  'layer-1-formal-verification',
  'layer-2-shadow-baseline',
  'layer-3-spatial-topology',
  'layer-4-temporal-trajectory',
  'layer-5-collective-intelligence',
] as const;
export type LayerOpinionLayerId = typeof LAYER_OPINION_LAYER_IDS[number];

export type LayerOpinionSourcePlane = Extract<
  SignalSourcePlane,
  | 'formal-verification'
  | 'shadow-baseline'
  | 'spatial-topology'
  | 'temporal-trajectory'
  | 'collective-intelligence'
>;

export const LAYER_OPINION_SOURCE_PLANES = [
  'formal-verification',
  'shadow-baseline',
  'spatial-topology',
  'temporal-trajectory',
  'collective-intelligence',
] as const satisfies readonly LayerOpinionSourcePlane[];

export type LayerOpinionAuthorityMode = Extract<
  SignalAuthorityMode,
  'advisory' | 'measurement-only'
>;

export const LAYER_OPINION_AUTHORITY_MODES = [
  'advisory',
  'measurement-only',
] as const satisfies readonly LayerOpinionAuthorityMode[];

export const LAYER_OPINION_POSITIONS = [
  'hazard-indicated',
  'gap-indicated',
  'conflict-indicated',
  'uncertainty-indicated',
  'abstained',
  'no-advisory-objection',
] as const;
export type LayerOpinionPosition = typeof LAYER_OPINION_POSITIONS[number];

export const LAYER_OPINION_EVIDENCE_QUALITY_BANDS = [
  'unavailable',
  'weak',
  'moderate',
  'strong',
] as const;
export type LayerOpinionEvidenceQualityBand =
  typeof LAYER_OPINION_EVIDENCE_QUALITY_BANDS[number];

export const LAYER_OPINION_NOVELTY_BANDS = [
  'known',
  'unusual',
  'novel',
  'unknown',
] as const;
export type LayerOpinionNoveltyBand =
  typeof LAYER_OPINION_NOVELTY_BANDS[number];

export const LAYER_OPINION_CONTEXT_FIT_BANDS = [
  'out-of-scope',
  'low',
  'medium',
  'high',
] as const;
export type LayerOpinionContextFitBand =
  typeof LAYER_OPINION_CONTEXT_FIT_BANDS[number];

export const LAYER_OPINION_CALIBRATION_STATES = [
  'uncalibrated',
  'calibration-ref-present',
  'stale-calibration',
  'degraded',
] as const;
export type LayerOpinionCalibrationState =
  typeof LAYER_OPINION_CALIBRATION_STATES[number];

export const LAYER_OPINION_ABSTENTION_REASONS = [
  'insufficient-coverage',
  'out-of-distribution',
  'missing-evidence',
  'conflicting-inputs',
  'measurement-degraded',
  'not-applicable',
  'dependency-missing',
] as const;
export type LayerOpinionAbstentionReason =
  typeof LAYER_OPINION_ABSTENTION_REASONS[number];

export const LAYER_OPINION_BELIEF_MASS_CONSERVATION_TOLERANCE = 1e-6;

export const LAYER_OPINION_REQUIRED_FIELDS = [
  'opinionId',
  'layerId',
  'sourcePlane',
  'envelopeRefDigest',
  'projectedSignal',
  'position',
  'hazardScore',
  'uncertainty',
  'calibratedConfidence',
  'evidenceQuality',
  'novelty',
  'contextFit',
  'calibrationState',
  'beliefMass',
  'abstention',
  'sourceDependence',
  'evidenceRefs',
  'readModelRefs',
  'reasonCodes',
  'noLoosening',
] as const;
export type LayerOpinionRequiredField =
  typeof LAYER_OPINION_REQUIRED_FIELDS[number];

export interface LayerOpinionSignalProjection<
  Category extends SignalCategory = SignalCategory,
> {
  readonly category: Category;
  readonly kind: SignalKindForCategory<Category>;
  readonly authorityMode: LayerOpinionAuthorityMode;
}

export interface LayerOpinionBeliefMass {
  readonly hazard: number;
  readonly noAdvisoryObjection: number;
  readonly uncertainty: number;
  readonly baseRate: number;
}

export interface LayerOpinionAbstention {
  readonly abstained: boolean;
  readonly reasons: readonly LayerOpinionAbstentionReason[];
  readonly neededEvidenceRefs: readonly ConsequenceEnvelopeDigestRef<'evidence'>[];
}

export interface LayerOpinionSourceDependence {
  readonly dependsOnEnvelope: true;
  readonly evidenceRefDigests: readonly string[];
  readonly readModelDigests: readonly string[];
  readonly relationshipIds: readonly string[];
  readonly rawTrainingDataAccess: false;
  readonly crossTenantRawDataAccess: false;
}

export interface LayerOpinion<
  Category extends SignalCategory = SignalCategory,
> {
  readonly version: typeof LAYER_OPINION_SCHEMA_VERSION;
  readonly opinionId: string;
  readonly layerId: LayerOpinionLayerId;
  readonly sourcePlane: LayerOpinionSourcePlane;
  readonly envelopeRefDigest: string;
  readonly projectedSignal: LayerOpinionSignalProjection<Category>;
  readonly position: LayerOpinionPosition;
  readonly hazardScore: number | null;
  readonly uncertainty: number;
  readonly calibratedConfidence: number | null;
  readonly evidenceQuality: LayerOpinionEvidenceQualityBand;
  readonly novelty: LayerOpinionNoveltyBand;
  readonly contextFit: LayerOpinionContextFitBand;
  readonly calibrationState: LayerOpinionCalibrationState;
  readonly calibrationRefDigest: string | null;
  readonly beliefMass: LayerOpinionBeliefMass;
  readonly abstention: LayerOpinionAbstention;
  readonly sourceDependence: LayerOpinionSourceDependence;
  readonly evidenceRefs: readonly SignalEvidenceRef[];
  readonly readModelRefs: readonly SignalReadModelRef[];
  readonly appliesToConsequenceClasses:
    readonly ConsequenceEnvelopeConsequenceClass[];
  readonly reasonCodes: readonly string[];
  readonly noLoosening: true;
  readonly mayGrantAuthority: false;
  readonly mayActivateEnforcement: false;
  readonly mayLowerRequiredReview: false;
  readonly mayMarkSafe: false;
  readonly mayStoreRawMaterial: false;
  readonly mayTrainModel: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
}

export interface LayerOpinionSchemaDescriptor {
  readonly version: typeof LAYER_OPINION_SCHEMA_VERSION;
  readonly signalRelationshipContractVersion:
    typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly layerIds: readonly LayerOpinionLayerId[];
  readonly sourcePlanes: readonly LayerOpinionSourcePlane[];
  readonly authorityModes: readonly LayerOpinionAuthorityMode[];
  readonly positions: readonly LayerOpinionPosition[];
  readonly evidenceQualityBands: readonly LayerOpinionEvidenceQualityBand[];
  readonly noveltyBands: readonly LayerOpinionNoveltyBand[];
  readonly contextFitBands: readonly LayerOpinionContextFitBand[];
  readonly calibrationStates: readonly LayerOpinionCalibrationState[];
  readonly abstentionReasons: readonly LayerOpinionAbstentionReason[];
  readonly requiredFields: readonly LayerOpinionRequiredField[];
  readonly advisoryOnly: true;
  readonly categoryBoundProjectionRequired: true;
  readonly abstentionIsFirstClass: true;
  readonly sourceDependenceRequired: true;
  readonly beliefMassRequired: true;
  readonly beliefMassConservationRequired: true;
  readonly noLooseningRequired: true;
  readonly mayGrantAuthority: false;
  readonly mayActivateEnforcement: false;
  readonly mayLowerRequiredReview: false;
  readonly mayMarkSafe: false;
  readonly mayStoreRawMaterial: false;
  readonly mayTrainModel: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
}

export function layerOpinionSchemaDescriptor(): LayerOpinionSchemaDescriptor {
  return Object.freeze({
    version: LAYER_OPINION_SCHEMA_VERSION,
    signalRelationshipContractVersion: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    layerIds: LAYER_OPINION_LAYER_IDS,
    sourcePlanes: LAYER_OPINION_SOURCE_PLANES,
    authorityModes: LAYER_OPINION_AUTHORITY_MODES,
    positions: LAYER_OPINION_POSITIONS,
    evidenceQualityBands: LAYER_OPINION_EVIDENCE_QUALITY_BANDS,
    noveltyBands: LAYER_OPINION_NOVELTY_BANDS,
    contextFitBands: LAYER_OPINION_CONTEXT_FIT_BANDS,
    calibrationStates: LAYER_OPINION_CALIBRATION_STATES,
    abstentionReasons: LAYER_OPINION_ABSTENTION_REASONS,
    requiredFields: LAYER_OPINION_REQUIRED_FIELDS,
    advisoryOnly: true,
    categoryBoundProjectionRequired: true,
    abstentionIsFirstClass: true,
    sourceDependenceRequired: true,
    beliefMassRequired: true,
    beliefMassConservationRequired: true,
    noLooseningRequired: true,
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
  });
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(`LayerOpinion runtime invariant failed: ${message}`);
}

function isSha256Digest(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function assertDigest(value: string, fieldName: string): void {
  assertTrue(isSha256Digest(value), `${fieldName} must be a sha256 digest reference`);
}

function assertOptionalDigest(value: string | null, fieldName: string): void {
  if (value !== null) assertDigest(value, fieldName);
}

function assertFiniteUnitInterval(value: number, fieldName: string): void {
  assertTrue(Number.isFinite(value), `${fieldName} must be finite`);
  assertTrue(value >= 0 && value <= 1, `${fieldName} must be between 0 and 1`);
}

function assertReasonCode(value: string, fieldName: string): void {
  assertTrue(
    /^[a-z0-9][a-z0-9._:-]*$/u.test(value),
    `${fieldName} must be a stable lowercase reason code`,
  );
}

function allowedSignalKindsForCategory(
  category: SignalCategory,
): readonly string[] {
  switch (category) {
    case 'verdict':
      return SIGNAL_VERDICT_KINDS;
    case 'observation':
      return SIGNAL_OBSERVATION_KINDS;
    case 'gap':
      return SIGNAL_GAP_KINDS;
    case 'boundary':
      return SIGNAL_BOUNDARY_KINDS;
    case 'context':
      return SIGNAL_CONTEXT_KINDS;
    case 'measurement':
      return SIGNAL_MEASUREMENT_KINDS;
  }
}

export function assertLayerOpinionRuntimeInvariants(
  opinion: LayerOpinion,
  options?: {
    readonly envelopeRefDigest?: string;
  },
): void {
  assertTrue(
    opinion.version === LAYER_OPINION_SCHEMA_VERSION,
    'version must match LayerOpinion schema version',
  );
  assertTrue(
    LAYER_OPINION_LAYER_IDS.includes(opinion.layerId),
    'layerId must be registered',
  );
  assertTrue(
    LAYER_OPINION_SOURCE_PLANES.includes(opinion.sourcePlane),
    'sourcePlane must be registered',
  );
  assertDigest(opinion.envelopeRefDigest, 'envelopeRefDigest');
  if (options?.envelopeRefDigest !== undefined) {
    assertTrue(
      opinion.envelopeRefDigest === options.envelopeRefDigest,
      'envelopeRefDigest must match fusion envelope',
    );
  }
  assertTrue(
    LAYER_OPINION_AUTHORITY_MODES.includes(opinion.projectedSignal.authorityMode),
    'projectedSignal.authorityMode must be registered',
  );
  assertTrue(
    allowedSignalKindsForCategory(opinion.projectedSignal.category)
      .includes(opinion.projectedSignal.kind),
    'projectedSignal.kind must belong to projectedSignal.category',
  );
  assertTrue(
    LAYER_OPINION_POSITIONS.includes(opinion.position),
    'position must be registered',
  );
  if (opinion.hazardScore !== null) {
    assertFiniteUnitInterval(opinion.hazardScore, 'hazardScore');
  }
  assertFiniteUnitInterval(opinion.uncertainty, 'uncertainty');
  if (opinion.calibratedConfidence !== null) {
    assertFiniteUnitInterval(opinion.calibratedConfidence, 'calibratedConfidence');
  }
  assertTrue(
    LAYER_OPINION_EVIDENCE_QUALITY_BANDS.includes(opinion.evidenceQuality),
    'evidenceQuality must be registered',
  );
  assertTrue(
    LAYER_OPINION_NOVELTY_BANDS.includes(opinion.novelty),
    'novelty must be registered',
  );
  assertTrue(
    LAYER_OPINION_CONTEXT_FIT_BANDS.includes(opinion.contextFit),
    'contextFit must be registered',
  );
  assertTrue(
    LAYER_OPINION_CALIBRATION_STATES.includes(opinion.calibrationState),
    'calibrationState must be registered',
  );
  assertOptionalDigest(opinion.calibrationRefDigest, 'calibrationRefDigest');

  assertFiniteUnitInterval(opinion.beliefMass.hazard, 'beliefMass.hazard');
  assertFiniteUnitInterval(
    opinion.beliefMass.noAdvisoryObjection,
    'beliefMass.noAdvisoryObjection',
  );
  assertFiniteUnitInterval(opinion.beliefMass.uncertainty, 'beliefMass.uncertainty');
  assertFiniteUnitInterval(opinion.beliefMass.baseRate, 'beliefMass.baseRate');
  const conservedMass =
    opinion.beliefMass.hazard +
    opinion.beliefMass.noAdvisoryObjection +
    opinion.beliefMass.uncertainty;
  assertTrue(
    Math.abs(conservedMass - 1) <= LAYER_OPINION_BELIEF_MASS_CONSERVATION_TOLERANCE,
    'beliefMass hazard + noAdvisoryObjection + uncertainty must equal 1',
  );

  for (const [index, reason] of opinion.abstention.reasons.entries()) {
    assertTrue(
      LAYER_OPINION_ABSTENTION_REASONS.includes(reason),
      `abstention.reasons[${index}] must be registered`,
    );
  }
  for (const [index, ref] of opinion.abstention.neededEvidenceRefs.entries()) {
    assertTrue(ref.kind === 'evidence', `abstention.neededEvidenceRefs[${index}].kind must be evidence`);
    assertDigest(ref.digest, `abstention.neededEvidenceRefs[${index}].digest`);
  }

  assertTrue(opinion.sourceDependence.dependsOnEnvelope === true, 'dependsOnEnvelope must be true');
  assertTrue(
    opinion.sourceDependence.rawTrainingDataAccess === false,
    'rawTrainingDataAccess must be false',
  );
  assertTrue(
    opinion.sourceDependence.crossTenantRawDataAccess === false,
    'crossTenantRawDataAccess must be false',
  );
  for (const [index, digest] of opinion.sourceDependence.evidenceRefDigests.entries()) {
    assertDigest(digest, `sourceDependence.evidenceRefDigests[${index}]`);
  }
  for (const [index, digest] of opinion.sourceDependence.readModelDigests.entries()) {
    assertDigest(digest, `sourceDependence.readModelDigests[${index}]`);
  }
  for (const [index, relationshipId] of opinion.sourceDependence.relationshipIds.entries()) {
    assertReasonCode(relationshipId, `sourceDependence.relationshipIds[${index}]`);
  }

  for (const [index, ref] of opinion.evidenceRefs.entries()) {
    assertTrue(
      SIGNAL_EVIDENCE_REFERENCE_KINDS.includes(ref.kind),
      `evidenceRefs[${index}].kind must be registered`,
    );
    assertDigest(ref.digest, `evidenceRefs[${index}].digest`);
  }
  for (const [index, ref] of opinion.readModelRefs.entries()) {
    assertReasonCode(ref.modelKind, `readModelRefs[${index}].modelKind`);
    assertDigest(ref.digest, `readModelRefs[${index}].digest`);
  }
  for (const [index, consequenceClass] of opinion.appliesToConsequenceClasses.entries()) {
    assertTrue(
      CONSEQUENCE_ENVELOPE_CONSEQUENCE_CLASSES.includes(consequenceClass),
      `appliesToConsequenceClasses[${index}] must be registered`,
    );
  }
  for (const [index, reasonCode] of opinion.reasonCodes.entries()) {
    assertReasonCode(reasonCode, `reasonCodes[${index}]`);
  }

  assertTrue(opinion.noLoosening === true, 'noLoosening must be true');
  assertTrue(opinion.mayGrantAuthority === false, 'mayGrantAuthority must be false');
  assertTrue(opinion.mayActivateEnforcement === false, 'mayActivateEnforcement must be false');
  assertTrue(opinion.mayLowerRequiredReview === false, 'mayLowerRequiredReview must be false');
  assertTrue(opinion.mayMarkSafe === false, 'mayMarkSafe must be false');
  assertTrue(opinion.mayStoreRawMaterial === false, 'mayStoreRawMaterial must be false');
  assertTrue(opinion.mayTrainModel === false, 'mayTrainModel must be false');
  assertTrue(opinion.productionReady === false, 'productionReady must be false');
  assertTrue(opinion.rawPayloadStored === false, 'rawPayloadStored must be false');
  assertTrue(opinion.rawPromptStored === false, 'rawPromptStored must be false');
  assertTrue(opinion.rawProviderBodyStored === false, 'rawProviderBodyStored must be false');
}
