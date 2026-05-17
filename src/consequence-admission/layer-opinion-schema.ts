import type {
  ConsequenceEnvelopeConsequenceClass,
  ConsequenceEnvelopeDigestRef,
} from './consequence-envelope-contract.js';
import {
  SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
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
