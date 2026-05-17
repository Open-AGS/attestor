import type {
  ConsequenceEnvelopeBlastRadiusEstimate,
  ConsequenceEnvelopeFreshnessPosture,
  ConsequenceEnvelopeReversibilityClass,
  ConsequenceEnvelopeTenantMaturityClass,
} from './consequence-envelope-contract.js';
import {
  LAYER_OPINION_SCHEMA_VERSION,
  type LayerOpinionContextFitBand,
} from './layer-opinion-schema.js';
import {
  SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  type SignalEvidenceRef,
  type SignalReadModelRef,
} from './signal-relationship-contract.js';

export const MODULATOR_AUTHORITY_TIER_VERSION =
  'attestor.modulator-authority-tier.v1';

export const MODULATOR_DIMENSIONS = [
  'reversibility',
  'blast-radius',
  'tenant-maturity',
  'coverage',
  'freshness',
] as const;
export type ModulatorDimension = typeof MODULATOR_DIMENSIONS[number];

export const MODULATOR_AUTHORITY_CLASSES = [
  'context-only',
  'tightening-only',
  'review-pressure-only',
  'measurement-degraded-only',
] as const;
export type ModulatorAuthorityClass =
  typeof MODULATOR_AUTHORITY_CLASSES[number];

export const MODULATOR_EFFECTS = [
  'increase-review-pressure',
  'increase-block-pressure',
  'raise-evidence-requirement',
  'preserve-hard-floor',
  'mark-context-degraded',
  'mark-coverage-insufficient',
  'mark-freshness-risk',
  'narrow-scope-only',
] as const;
export type ModulatorEffect = typeof MODULATOR_EFFECTS[number];

export const MODULATOR_COVERAGE_POSTURES = [
  'none',
  'low',
  'medium',
  'high',
  'unknown',
] as const;
export type ModulatorCoveragePosture =
  typeof MODULATOR_COVERAGE_POSTURES[number];

export const MODULATOR_STRENGTH_BANDS = [
  'informational',
  'low',
  'medium',
  'high',
] as const;
export type ModulatorStrengthBand = typeof MODULATOR_STRENGTH_BANDS[number];

export const MODULATOR_INPUT_SOURCES = [
  'consequence-envelope',
  'layer-opinion',
  'signal-relationship',
  'policy-scope',
  'shadow-coverage',
  'measurement-plane',
] as const;
export type ModulatorInputSource = typeof MODULATOR_INPUT_SOURCES[number];

export const MODULATOR_REQUIRED_FIELDS = [
  'modulatorId',
  'dimension',
  'authorityClass',
  'effect',
  'inputSource',
  'evidenceRefs',
  'readModelRefs',
  'reasonCodes',
  'noLoosening',
  'preservesHardFloor',
] as const;
export type ModulatorRequiredField =
  typeof MODULATOR_REQUIRED_FIELDS[number];

export interface ModulatorContextSnapshot {
  readonly reversibilityClass: ConsequenceEnvelopeReversibilityClass | null;
  readonly blastRadiusEstimate: ConsequenceEnvelopeBlastRadiusEstimate | null;
  readonly tenantMaturityClass: ConsequenceEnvelopeTenantMaturityClass | null;
  readonly coveragePosture: ModulatorCoveragePosture | null;
  readonly freshnessPosture: ConsequenceEnvelopeFreshnessPosture | null;
  readonly contextFit: LayerOpinionContextFitBand | null;
}

export interface ContextModulator {
  readonly modulatorId: string;
  readonly dimension: ModulatorDimension;
  readonly authorityClass: ModulatorAuthorityClass;
  readonly effect: ModulatorEffect;
  readonly strength: ModulatorStrengthBand;
  readonly inputSource: ModulatorInputSource;
  readonly envelopeRefDigest: string;
  readonly context: ModulatorContextSnapshot;
  readonly evidenceRefs: readonly SignalEvidenceRef[];
  readonly readModelRefs: readonly SignalReadModelRef[];
  readonly reasonCodes: readonly string[];
  readonly noLoosening: true;
  readonly preservesHardFloor: true;
  readonly mayGrantAuthority: false;
  readonly mayActivateEnforcement: false;
  readonly autoEnforce: false;
  readonly mayLowerRequiredReview: false;
  readonly maySuppressHardDeny: false;
  readonly mayMarkSafe: false;
  readonly mayStoreRawMaterial: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
}

export interface ModulatorAuthorityRule {
  readonly ruleId: string;
  readonly dimension: ModulatorDimension;
  readonly allowedEffects: readonly ModulatorEffect[];
  readonly allowedAuthorityClasses: readonly ModulatorAuthorityClass[];
  readonly reasonCodes: readonly string[];
  readonly noLoosening: true;
  readonly preservesHardFloor: true;
  readonly mayGrantAuthority: false;
  readonly mayActivateEnforcement: false;
  readonly autoEnforce: false;
  readonly mayLowerRequiredReview: false;
  readonly maySuppressHardDeny: false;
  readonly mayMarkSafe: false;
  readonly productionReady: false;
}

export interface ModulatorAuthorityTierContract {
  readonly version: typeof MODULATOR_AUTHORITY_TIER_VERSION;
  readonly envelopeRefDigest: string;
  readonly modulators: readonly ContextModulator[];
  readonly rules: readonly ModulatorAuthorityRule[];
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
}

export interface ModulatorAuthorityTierDescriptor {
  readonly version: typeof MODULATOR_AUTHORITY_TIER_VERSION;
  readonly signalRelationshipContractVersion:
    typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly layerOpinionSchemaVersion: typeof LAYER_OPINION_SCHEMA_VERSION;
  readonly dimensions: readonly ModulatorDimension[];
  readonly authorityClasses: readonly ModulatorAuthorityClass[];
  readonly effects: readonly ModulatorEffect[];
  readonly coveragePostures: readonly ModulatorCoveragePosture[];
  readonly strengthBands: readonly ModulatorStrengthBand[];
  readonly inputSources: readonly ModulatorInputSource[];
  readonly requiredFields: readonly ModulatorRequiredField[];
  readonly contextOnly: true;
  readonly monotoneOnly: true;
  readonly preservesHardFloor: true;
  readonly relationshipFabricInput: true;
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly mayLowerRequiredReview: false;
  readonly maySuppressHardDeny: false;
  readonly mayMarkSafe: false;
  readonly mayStoreRawMaterial: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
}

export function modulatorAuthorityTierDescriptor(): ModulatorAuthorityTierDescriptor {
  return Object.freeze({
    version: MODULATOR_AUTHORITY_TIER_VERSION,
    signalRelationshipContractVersion: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    layerOpinionSchemaVersion: LAYER_OPINION_SCHEMA_VERSION,
    dimensions: MODULATOR_DIMENSIONS,
    authorityClasses: MODULATOR_AUTHORITY_CLASSES,
    effects: MODULATOR_EFFECTS,
    coveragePostures: MODULATOR_COVERAGE_POSTURES,
    strengthBands: MODULATOR_STRENGTH_BANDS,
    inputSources: MODULATOR_INPUT_SOURCES,
    requiredFields: MODULATOR_REQUIRED_FIELDS,
    contextOnly: true,
    monotoneOnly: true,
    preservesHardFloor: true,
    relationshipFabricInput: true,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    mayLowerRequiredReview: false,
    maySuppressHardDeny: false,
    mayMarkSafe: false,
    mayStoreRawMaterial: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  });
}
