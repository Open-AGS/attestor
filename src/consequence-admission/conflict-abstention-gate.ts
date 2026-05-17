import {
  LAYER_OPINION_SCHEMA_VERSION,
  type LayerOpinion,
} from './layer-opinion-schema.js';
import {
  MODULATOR_AUTHORITY_TIER_VERSION,
  type ContextModulator,
} from './modulator-authority-tier.js';
import {
  RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
  type RelationshipAwareMonotoneFusionResult,
} from './relationship-aware-monotone-fusion.js';
import {
  SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  type SignalRelationship,
} from './signal-relationship-contract.js';

export const CONFLICT_ABSTENTION_GATE_VERSION =
  'attestor.conflict-abstention-gate.v1';

export const CONFLICT_ABSTENTION_GATE_OUTCOMES = [
  'continue',
  'review',
  'abstain-hold',
  'block-pressure',
] as const;
export type ConflictAbstentionGateOutcome =
  typeof CONFLICT_ABSTENTION_GATE_OUTCOMES[number];

export const CONFLICT_ABSTENTION_GATE_REASON_CODES = [
  'hard-floor-preserved',
  'fusion-block-pressure',
  'fusion-review-pressure',
  'conflict-pressure-high',
  'contradiction-relationship',
  'conflict-opinion',
  'weighted-abstention-high',
  'abstention-opinion',
  'insufficient-coverage',
  'out-of-distribution',
  'missing-evidence',
  'dependency-missing',
  'measurement-degraded',
  'uncertainty-high',
  'low-confidence',
  'weak-evidence',
  'novel-context',
  'context-fit-low',
  'coverage-modulator',
  'freshness-risk',
  'no-admit-authority',
] as const;
export type ConflictAbstentionGateReasonCode =
  typeof CONFLICT_ABSTENTION_GATE_REASON_CODES[number];

export const CONFLICT_ABSTENTION_GATE_THRESHOLDS = Object.freeze({
  conflictReview: 0.2,
  conflictBlockPressure: 0.5,
  abstentionReview: 0.25,
  abstentionHold: 0.5,
  uncertaintyReview: 0.35,
  coverageReview: 0.3,
  fusionReviewPressure: 0.35,
  fusionBlockPressure: 0.7,
});

export interface ConflictAbstentionGateInput {
  readonly envelopeRefDigest: string;
  readonly fusion: RelationshipAwareMonotoneFusionResult;
  readonly opinions: readonly LayerOpinion[];
  readonly relationships: readonly SignalRelationship[];
  readonly modulators: readonly ContextModulator[];
}

export interface ConflictAbstentionGateReviewedInputs {
  readonly opinionCount: number;
  readonly relationshipCount: number;
  readonly modulatorCount: number;
  readonly abstentionCount: number;
  readonly contradictionCount: number;
  readonly conflictOpinionCount: number;
}

export interface ConflictAbstentionGateResult {
  readonly version: typeof CONFLICT_ABSTENTION_GATE_VERSION;
  readonly relationshipAwareMonotoneFusionVersion:
    typeof RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION;
  readonly signalRelationshipContractVersion:
    typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly layerOpinionSchemaVersion: typeof LAYER_OPINION_SCHEMA_VERSION;
  readonly modulatorAuthorityTierVersion: typeof MODULATOR_AUTHORITY_TIER_VERSION;
  readonly envelopeRefDigest: string;
  readonly outcome: ConflictAbstentionGateOutcome;
  readonly conflictScore: number;
  readonly abstentionScore: number;
  readonly uncertaintyScore: number;
  readonly coverageGapScore: number;
  readonly blockPressure: number;
  readonly reviewPressure: number;
  readonly maxGateScore: number;
  readonly reasonCodes: readonly ConflictAbstentionGateReasonCode[];
  readonly reviewedInputs: ConflictAbstentionGateReviewedInputs;
  readonly noLoosening: true;
  readonly failClosedOnUncertainty: true;
  readonly runsAfterRelationshipAwareFusion: true;
  readonly canAdmit: false;
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export interface ConflictAbstentionGateDescriptor {
  readonly version: typeof CONFLICT_ABSTENTION_GATE_VERSION;
  readonly relationshipAwareMonotoneFusionVersion:
    typeof RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION;
  readonly signalRelationshipContractVersion:
    typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly layerOpinionSchemaVersion: typeof LAYER_OPINION_SCHEMA_VERSION;
  readonly modulatorAuthorityTierVersion: typeof MODULATOR_AUTHORITY_TIER_VERSION;
  readonly outcomes: readonly ConflictAbstentionGateOutcome[];
  readonly reasonCodes: readonly ConflictAbstentionGateReasonCode[];
  readonly thresholds: typeof CONFLICT_ABSTENTION_GATE_THRESHOLDS;
  readonly pureFunction: true;
  readonly runsAfterRelationshipAwareFusion: true;
  readonly uncertaintyCannotAdmit: true;
  readonly conflictRequiresReviewOrPressure: true;
  readonly abstentionIsTerminalHoldCapable: true;
  readonly noLoosening: true;
  readonly canAdmit: false;
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
  codes: readonly ConflictAbstentionGateReasonCode[],
): readonly ConflictAbstentionGateReasonCode[] {
  return Object.freeze([...new Set(codes)]);
}

function abstentionReasonWeight(reason: string): number {
  switch (reason) {
    case 'out-of-distribution':
    case 'conflicting-inputs':
    case 'measurement-degraded':
      return 0.12;
    case 'insufficient-coverage':
    case 'missing-evidence':
    case 'dependency-missing':
      return 0.08;
    case 'not-applicable':
      return 0.03;
    default:
      return 0.05;
  }
}

function evidenceQualityPressure(opinion: LayerOpinion): number {
  if (opinion.evidenceQuality === 'unavailable') return 0.12;
  if (opinion.evidenceQuality === 'weak') return 0.08;
  return 0;
}

function noveltyPressure(opinion: LayerOpinion): number {
  if (opinion.novelty === 'unknown') return 0.1;
  if (opinion.novelty === 'novel') return 0.06;
  return 0;
}

function contextFitPressure(opinion: LayerOpinion): number {
  if (opinion.contextFit === 'out-of-scope') return 0.14;
  if (opinion.contextFit === 'low') return 0.08;
  return 0;
}

function coverageModulatorPressure(modulator: ContextModulator): number {
  if (modulator.effect === 'mark-coverage-insufficient') return 0.18;
  if (modulator.context.coveragePosture === 'none') return 0.25;
  if (modulator.context.coveragePosture === 'low') return 0.16;
  if (modulator.context.coveragePosture === 'unknown') return 0.14;
  return 0;
}

function addOpinionReasons(
  opinion: LayerOpinion,
  codes: ConflictAbstentionGateReasonCode[],
): void {
  if (opinion.position === 'conflict-indicated') codes.push('conflict-opinion');
  if (opinion.position === 'abstained' || opinion.abstention.abstained) {
    codes.push('abstention-opinion');
  }
  if (opinion.uncertainty >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.uncertaintyReview) {
    codes.push('uncertainty-high');
  }
  if (opinion.calibratedConfidence !== null && opinion.calibratedConfidence <= 0.5) {
    codes.push('low-confidence');
  }
  if (opinion.evidenceQuality === 'unavailable' || opinion.evidenceQuality === 'weak') {
    codes.push('weak-evidence');
  }
  if (opinion.novelty === 'novel' || opinion.novelty === 'unknown') {
    codes.push('novel-context');
  }
  if (opinion.contextFit === 'low' || opinion.contextFit === 'out-of-scope') {
    codes.push('context-fit-low');
  }
  for (const reason of opinion.abstention.reasons) {
    if (reason === 'insufficient-coverage') codes.push('insufficient-coverage');
    if (reason === 'out-of-distribution') codes.push('out-of-distribution');
    if (reason === 'missing-evidence') codes.push('missing-evidence');
    if (reason === 'dependency-missing') codes.push('dependency-missing');
    if (reason === 'measurement-degraded') codes.push('measurement-degraded');
  }
}

export function conflictAbstentionGateDescriptor():
  ConflictAbstentionGateDescriptor {
  return Object.freeze({
    version: CONFLICT_ABSTENTION_GATE_VERSION,
    relationshipAwareMonotoneFusionVersion:
      RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
    signalRelationshipContractVersion: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    layerOpinionSchemaVersion: LAYER_OPINION_SCHEMA_VERSION,
    modulatorAuthorityTierVersion: MODULATOR_AUTHORITY_TIER_VERSION,
    outcomes: CONFLICT_ABSTENTION_GATE_OUTCOMES,
    reasonCodes: CONFLICT_ABSTENTION_GATE_REASON_CODES,
    thresholds: CONFLICT_ABSTENTION_GATE_THRESHOLDS,
    pureFunction: true,
    runsAfterRelationshipAwareFusion: true,
    uncertaintyCannotAdmit: true,
    conflictRequiresReviewOrPressure: true,
    abstentionIsTerminalHoldCapable: true,
    noLoosening: true,
    canAdmit: false,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  });
}

export function evaluateConflictAbstentionGate(
  input: ConflictAbstentionGateInput,
): ConflictAbstentionGateResult {
  const contradictionCount = input.relationships.filter(
    (relationship) => relationship.kind === 'contradicts',
  ).length;
  const conflictOpinionCount = input.opinions.filter(
    (opinion) => opinion.position === 'conflict-indicated',
  ).length;
  const abstentionOpinions = input.opinions.filter(
    (opinion) => opinion.position === 'abstained' || opinion.abstention.abstained,
  );

  const conflictScore = clamp01(
    input.fusion.conflictPressure +
      contradictionCount * 0.12 +
      conflictOpinionCount * 0.18 +
      input.opinions.filter((opinion) =>
        opinion.abstention.reasons.includes('conflicting-inputs')
      ).length * 0.16,
  );
  const abstentionScore = clamp01(
    abstentionOpinions.length * 0.16 +
      input.opinions.filter((opinion) =>
        opinion.projectedSignal.kind === 'abstention'
      ).length * 0.12 +
      input.opinions.reduce(
        (total, opinion) =>
          total + opinion.abstention.reasons.reduce(
            (subtotal, reason) => subtotal + abstentionReasonWeight(reason),
            0,
          ),
        0,
      ),
  );
  const uncertaintyScore = clamp01(
    Math.max(0, ...input.opinions.map((opinion) => opinion.uncertainty)) * 0.6 +
      input.opinions.filter((opinion) =>
        opinion.calibrationState === 'degraded' ||
        opinion.calibrationState === 'stale-calibration'
      ).length * 0.12 +
      input.opinions.reduce(
        (total, opinion) =>
          total +
          evidenceQualityPressure(opinion) +
          noveltyPressure(opinion) +
          contextFitPressure(opinion),
        0,
      ),
  );
  const coverageGapScore = clamp01(
    input.modulators.reduce(
      (total, modulator) => total + coverageModulatorPressure(modulator),
      0,
    ) +
      input.opinions.filter((opinion) =>
        opinion.abstention.reasons.some((reason) =>
          reason === 'insufficient-coverage' ||
          reason === 'missing-evidence' ||
          reason === 'dependency-missing'
        )
      ).length * 0.1,
  );

  const reasonCodes: ConflictAbstentionGateReasonCode[] = ['no-admit-authority'];
  if (input.fusion.reasonCodes.includes('hard-floor-preserved')) {
    reasonCodes.push('hard-floor-preserved');
  }
  if (
    input.fusion.posture === 'block-pressure' ||
    input.fusion.blockPressure >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.fusionBlockPressure
  ) {
    reasonCodes.push('fusion-block-pressure');
  }
  if (
    input.fusion.posture === 'review' ||
    input.fusion.reviewPressure >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.fusionReviewPressure
  ) {
    reasonCodes.push('fusion-review-pressure');
  }
  if (conflictScore >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.conflictReview) {
    reasonCodes.push('conflict-pressure-high');
  }
  if (contradictionCount > 0) reasonCodes.push('contradiction-relationship');
  for (const opinion of input.opinions) addOpinionReasons(opinion, reasonCodes);
  if (abstentionScore >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.abstentionReview) {
    reasonCodes.push('weighted-abstention-high');
  }
  if (coverageGapScore >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.coverageReview) {
    reasonCodes.push('coverage-modulator');
  }
  if (input.modulators.some((modulator) => modulator.effect === 'mark-freshness-risk')) {
    reasonCodes.push('freshness-risk');
  }

  const blockPressure = clamp01(
    Math.max(
      input.fusion.blockPressure,
      input.fusion.posture === 'block-pressure' ? 0.7 : 0,
      conflictScore * 0.8,
    ),
  );
  const reviewPressure = clamp01(
    Math.max(
      input.fusion.reviewPressure,
      conflictScore,
      abstentionScore,
      uncertaintyScore,
      coverageGapScore,
    ),
  );
  const maxGateScore = clamp01(
    Math.max(
      conflictScore,
      abstentionScore,
      uncertaintyScore,
      coverageGapScore,
      blockPressure,
      reviewPressure,
    ),
  );

  const outcome = blockPressure >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.fusionBlockPressure ||
    conflictScore >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.conflictBlockPressure
    ? 'block-pressure'
    : abstentionScore >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.abstentionHold ||
        coverageGapScore >= 0.5 && uncertaintyScore >= 0.35
      ? 'abstain-hold'
      : conflictScore >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.conflictReview ||
          abstentionScore >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.abstentionReview ||
          uncertaintyScore >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.uncertaintyReview ||
          coverageGapScore >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.coverageReview ||
          input.fusion.posture === 'review' ||
          input.fusion.reviewPressure >= CONFLICT_ABSTENTION_GATE_THRESHOLDS.fusionReviewPressure
        ? 'review'
        : 'continue';

  return {
    version: CONFLICT_ABSTENTION_GATE_VERSION,
    relationshipAwareMonotoneFusionVersion:
      RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
    signalRelationshipContractVersion: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    layerOpinionSchemaVersion: LAYER_OPINION_SCHEMA_VERSION,
    modulatorAuthorityTierVersion: MODULATOR_AUTHORITY_TIER_VERSION,
    envelopeRefDigest: input.envelopeRefDigest,
    outcome,
    conflictScore,
    abstentionScore,
    uncertaintyScore,
    coverageGapScore,
    blockPressure,
    reviewPressure,
    maxGateScore,
    reasonCodes: uniqueReasonCodes(reasonCodes),
    reviewedInputs: {
      opinionCount: input.opinions.length,
      relationshipCount: input.relationships.length,
      modulatorCount: input.modulators.length,
      abstentionCount: abstentionOpinions.length,
      contradictionCount,
      conflictOpinionCount,
    },
    noLoosening: true,
    failClosedOnUncertainty: true,
    runsAfterRelationshipAwareFusion: true,
    canAdmit: false,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };
}
