import {
  LAYER_OPINION_SCHEMA_VERSION,
  type LayerOpinion,
} from './layer-opinion-schema.js';
import {
  MODULATOR_AUTHORITY_TIER_VERSION,
  type ContextModulator,
} from './modulator-authority-tier.js';
import {
  SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  type SignalDirectedRelationship,
  type SignalRelationship,
  type SignalSymmetricRelationship,
  type SignalUnaryRelationship,
} from './signal-relationship-contract.js';

export const RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION =
  'attestor.relationship-aware-monotone-fusion.v1';

export const MONOTONE_FUSION_POSTURES = [
  'clear',
  'watch',
  'review',
  'block-pressure',
] as const;
export type MonotoneFusionPosture = typeof MONOTONE_FUSION_POSTURES[number];

export const MONOTONE_FUSION_REASON_CODES = [
  'hard-floor-preserved',
  'hazard-opinion',
  'gap-opinion',
  'conflict-opinion',
  'uncertainty-opinion',
  'abstention-opinion',
  'duplicate-discount-applied',
  'confirmation-boost-applied',
  'contradiction-conflict-applied',
  'directed-override-preserved',
  'directed-escalation-applied',
  'modulator-tightening-applied',
  'review-required-relationship',
] as const;
export type MonotoneFusionReasonCode =
  typeof MONOTONE_FUSION_REASON_CODES[number];

export interface MonotoneFusionInput {
  readonly envelopeRefDigest: string;
  readonly opinions: readonly LayerOpinion[];
  readonly relationships: readonly SignalRelationship[];
  readonly modulators: readonly ContextModulator[];
}

export interface MonotoneFusionSignalContribution {
  readonly sourceId: string;
  readonly sourceKind: 'opinion' | 'relationship' | 'modulator';
  readonly rawHazard: number;
  readonly effectiveHazard: number;
  readonly duplicateDiscount: number;
  readonly reasonCodes: readonly MonotoneFusionReasonCode[];
}

export interface RelationshipAwareMonotoneFusionResult {
  readonly version: typeof RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION;
  readonly signalRelationshipContractVersion:
    typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly layerOpinionSchemaVersion: typeof LAYER_OPINION_SCHEMA_VERSION;
  readonly modulatorAuthorityTierVersion: typeof MODULATOR_AUTHORITY_TIER_VERSION;
  readonly envelopeRefDigest: string;
  readonly fusedHazardScore: number;
  readonly maxInputHazardScore: number;
  readonly duplicateDiscountTotal: number;
  readonly confirmationBoostTotal: number;
  readonly conflictPressure: number;
  readonly reviewPressure: number;
  readonly blockPressure: number;
  readonly posture: MonotoneFusionPosture;
  readonly contributions: readonly MonotoneFusionSignalContribution[];
  readonly reasonCodes: readonly MonotoneFusionReasonCode[];
  readonly monotoneNoLoosening: true;
  readonly preservesHardFloor: true;
  readonly duplicateDiscountApplied: boolean;
  readonly relationshipAware: true;
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export interface RelationshipAwareMonotoneFusionDescriptor {
  readonly version: typeof RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION;
  readonly signalRelationshipContractVersion:
    typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly layerOpinionSchemaVersion: typeof LAYER_OPINION_SCHEMA_VERSION;
  readonly modulatorAuthorityTierVersion: typeof MODULATOR_AUTHORITY_TIER_VERSION;
  readonly postures: readonly MonotoneFusionPosture[];
  readonly reasonCodes: readonly MonotoneFusionReasonCode[];
  readonly pureFunction: true;
  readonly relationshipEvaluationBeforeFusion: true;
  readonly duplicateDiscountSupported: true;
  readonly confirmationBoostSupported: true;
  readonly contradictionPressureSupported: true;
  readonly hardFloorPreservationRequired: true;
  readonly monotoneNoLoosening: true;
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function uniqueReasonCodes(
  codes: readonly MonotoneFusionReasonCode[],
): readonly MonotoneFusionReasonCode[] {
  return Object.freeze([...new Set(codes)]);
}

function opinionRawHazard(opinion: LayerOpinion): number {
  const hazard = opinion.hazardScore ?? opinion.beliefMass.hazard;
  const uncertaintyPressure = opinion.uncertainty * 0.5;
  const abstentionPressure = opinion.abstention.abstained ? 0.2 : 0;
  const positionPressure = opinion.position === 'hazard-indicated'
    ? 0.25
    : opinion.position === 'gap-indicated'
      ? 0.18
      : opinion.position === 'conflict-indicated'
        ? 0.25
        : opinion.position === 'uncertainty-indicated'
          ? 0.16
          : opinion.position === 'abstained'
            ? 0.2
            : 0;

  return clamp01(Math.max(hazard, uncertaintyPressure, abstentionPressure) + positionPressure);
}

function opinionReasonCodes(opinion: LayerOpinion): readonly MonotoneFusionReasonCode[] {
  const codes: MonotoneFusionReasonCode[] = [];
  if (opinion.projectedSignal.kind === 'hard_floor') codes.push('hard-floor-preserved');
  if (opinion.position === 'hazard-indicated') codes.push('hazard-opinion');
  if (opinion.position === 'gap-indicated') codes.push('gap-opinion');
  if (opinion.position === 'conflict-indicated') codes.push('conflict-opinion');
  if (opinion.position === 'uncertainty-indicated') codes.push('uncertainty-opinion');
  if (opinion.position === 'abstained' || opinion.abstention.abstained) {
    codes.push('abstention-opinion');
  }
  return uniqueReasonCodes(codes);
}

function duplicateDiscountForSignal(
  signalId: string,
  duplicateRelationships: readonly SignalSymmetricRelationship[],
): number {
  const duplicateCount = duplicateRelationships.filter((relationship) =>
    relationship.leftSignalId === signalId || relationship.rightSignalId === signalId
  ).length;

  return duplicateCount === 0 ? 1 : 1 / (1 + duplicateCount);
}

function relationshipContribution(
  relationship: SignalRelationship,
): MonotoneFusionSignalContribution {
  const rawHazard = relationship.kind === 'requires_review'
    ? 0.22
    : relationship.kind === 'contradicts'
      ? 0.16
      : relationship.kind === 'confirms'
        ? 0.08
        : relationship.kind === 'escalates'
          ? 0.18
          : relationship.kind === 'overrides'
            ? 0.1
            : relationship.kind === 'modulates'
              ? 0.08
              : 0;
  const reasonCodes: MonotoneFusionReasonCode[] = [];

  if (relationship.kind === 'confirms') reasonCodes.push('confirmation-boost-applied');
  if (relationship.kind === 'contradicts') reasonCodes.push('contradiction-conflict-applied');
  if (relationship.kind === 'duplicates') reasonCodes.push('duplicate-discount-applied');
  if (relationship.kind === 'overrides') reasonCodes.push('directed-override-preserved');
  if (relationship.kind === 'escalates') reasonCodes.push('directed-escalation-applied');
  if (relationship.kind === 'requires_review') reasonCodes.push('review-required-relationship');

  return {
    sourceId: relationship.relationshipId,
    sourceKind: 'relationship',
    rawHazard,
    effectiveHazard: rawHazard,
    duplicateDiscount: relationship.kind === 'duplicates' ? 0 : 1,
    reasonCodes: uniqueReasonCodes(reasonCodes),
  };
}

function modulatorContribution(
  modulator: ContextModulator,
): MonotoneFusionSignalContribution {
  const rawHazard = modulator.effect === 'increase-block-pressure'
    ? 0.18
    : modulator.effect === 'increase-review-pressure'
      ? 0.14
      : modulator.effect === 'raise-evidence-requirement'
        ? 0.12
        : modulator.effect === 'mark-coverage-insufficient'
          ? 0.14
          : modulator.effect === 'mark-freshness-risk'
            ? 0.12
            : modulator.effect === 'mark-context-degraded'
              ? 0.1
              : 0.06;
  return {
    sourceId: modulator.modulatorId,
    sourceKind: 'modulator',
    rawHazard,
    effectiveHazard: rawHazard,
    duplicateDiscount: 1,
    reasonCodes: ['modulator-tightening-applied'],
  };
}

function postureForScore(
  fusedHazardScore: number,
  reviewPressure: number,
  blockPressure: number,
): MonotoneFusionPosture {
  if (blockPressure >= 0.7 || fusedHazardScore >= 0.85) return 'block-pressure';
  if (reviewPressure >= 0.35 || fusedHazardScore >= 0.45) return 'review';
  if (fusedHazardScore > 0) return 'watch';
  return 'clear';
}

export function relationshipAwareMonotoneFusionDescriptor():
  RelationshipAwareMonotoneFusionDescriptor {
  return Object.freeze({
    version: RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
    signalRelationshipContractVersion: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    layerOpinionSchemaVersion: LAYER_OPINION_SCHEMA_VERSION,
    modulatorAuthorityTierVersion: MODULATOR_AUTHORITY_TIER_VERSION,
    postures: MONOTONE_FUSION_POSTURES,
    reasonCodes: MONOTONE_FUSION_REASON_CODES,
    pureFunction: true,
    relationshipEvaluationBeforeFusion: true,
    duplicateDiscountSupported: true,
    confirmationBoostSupported: true,
    contradictionPressureSupported: true,
    hardFloorPreservationRequired: true,
    monotoneNoLoosening: true,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  });
}

export function fuseRelationshipAwareMonotoneHazard(
  input: MonotoneFusionInput,
): RelationshipAwareMonotoneFusionResult {
  const duplicateRelationships = input.relationships.filter(
    (relationship): relationship is SignalSymmetricRelationship =>
      relationship.shape === 'symmetric' && relationship.kind === 'duplicates',
  );
  const confirmationRelationships = input.relationships.filter(
    (relationship): relationship is SignalSymmetricRelationship =>
      relationship.shape === 'symmetric' && relationship.kind === 'confirms',
  );
  const contradictionRelationships = input.relationships.filter(
    (relationship): relationship is SignalSymmetricRelationship =>
      relationship.shape === 'symmetric' && relationship.kind === 'contradicts',
  );
  const directedRelationships = input.relationships.filter(
    (relationship): relationship is SignalDirectedRelationship =>
      relationship.shape === 'directed',
  );
  const unaryRelationships = input.relationships.filter(
    (relationship): relationship is SignalUnaryRelationship =>
      relationship.shape === 'unary',
  );

  const opinionContributions = input.opinions.map((opinion) => {
    const rawHazard = opinionRawHazard(opinion);
    const duplicateDiscount = duplicateDiscountForSignal(
      opinion.opinionId,
      duplicateRelationships,
    );
    const effectiveHazard = rawHazard * duplicateDiscount;

    return {
      sourceId: opinion.opinionId,
      sourceKind: 'opinion' as const,
      rawHazard,
      effectiveHazard,
      duplicateDiscount,
      reasonCodes: opinionReasonCodes(opinion),
    };
  });

  const relationshipContributions = input.relationships.map(relationshipContribution);
  const modulatorContributions = input.modulators.map(modulatorContribution);
  const contributions = [
    ...opinionContributions,
    ...relationshipContributions,
    ...modulatorContributions,
  ];

  const additivePressure = contributions.reduce(
    (total, contribution) => total + contribution.effectiveHazard,
    0,
  );
  const maxInputHazardScore = clamp01(
    Math.max(0, ...contributions.map((contribution) => contribution.rawHazard)),
  );
  const confirmationBoostTotal = clamp01(confirmationRelationships.length * 0.08);
  const conflictPressure = clamp01(
    contradictionRelationships.length * 0.16 +
      input.opinions.filter((opinion) => opinion.position === 'conflict-indicated').length * 0.12,
  );
  const reviewPressure = clamp01(
    unaryRelationships.length * 0.22 +
      input.opinions.filter((opinion) =>
        opinion.position === 'abstained' ||
        opinion.position === 'uncertainty-indicated' ||
        opinion.abstention.abstained
      ).length * 0.14 +
      input.modulators.filter((modulator) =>
        modulator.effect === 'increase-review-pressure' ||
        modulator.effect === 'raise-evidence-requirement' ||
        modulator.effect === 'mark-coverage-insufficient'
      ).length * 0.12,
  );
  const blockPressure = clamp01(
    input.opinions.filter((opinion) =>
      opinion.projectedSignal.kind === 'hard_floor' ||
      opinion.projectedSignal.authorityMode === 'advisory' &&
        opinion.position === 'hazard-indicated' &&
        opinion.hazardScore !== null &&
        opinion.hazardScore >= 0.85
    ).length * 0.45 +
      directedRelationships.filter((relationship) =>
        relationship.kind === 'overrides' || relationship.kind === 'escalates'
      ).length * 0.16 +
      input.modulators.filter((modulator) =>
        modulator.effect === 'increase-block-pressure' ||
        modulator.effect === 'preserve-hard-floor'
      ).length * 0.14,
  );

  const fusedHazardScore = clamp01(
    Math.max(maxInputHazardScore, additivePressure / 3) +
      confirmationBoostTotal +
      conflictPressure * 0.5 +
      reviewPressure * 0.35 +
      blockPressure * 0.5,
  );
  const duplicateDiscountTotal = clamp01(
    opinionContributions.reduce(
      (total, contribution) => total + (1 - contribution.duplicateDiscount),
      0,
    ),
  );

  const reasonCodes = uniqueReasonCodes(
    contributions.flatMap((contribution) => contribution.reasonCodes),
  );

  return {
    version: RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
    signalRelationshipContractVersion: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    layerOpinionSchemaVersion: LAYER_OPINION_SCHEMA_VERSION,
    modulatorAuthorityTierVersion: MODULATOR_AUTHORITY_TIER_VERSION,
    envelopeRefDigest: input.envelopeRefDigest,
    fusedHazardScore,
    maxInputHazardScore,
    duplicateDiscountTotal,
    confirmationBoostTotal,
    conflictPressure,
    reviewPressure,
    blockPressure,
    posture: postureForScore(fusedHazardScore, reviewPressure, blockPressure),
    contributions,
    reasonCodes,
    monotoneNoLoosening: true,
    preservesHardFloor: true,
    duplicateDiscountApplied: duplicateDiscountTotal > 0,
    relationshipAware: true,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };
}
