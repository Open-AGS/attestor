import type {
  ConsequenceEnvelopeConsequenceClass,
  ConsequenceEnvelopeDigestRef,
} from './consequence-envelope-contract.js';

export const SIGNAL_RELATIONSHIP_CONTRACT_VERSION =
  'attestor.signal-relationship-contract.v1';

export const SIGNAL_CATEGORIES = [
  'verdict',
  'observation',
  'gap',
  'boundary',
  'context',
  'measurement',
] as const;
export type SignalCategory = typeof SIGNAL_CATEGORIES[number];

export const SIGNAL_VERDICT_KINDS = [
  'hard_floor',
  'hazard',
  'abstention',
] as const;
export type SignalVerdictKind = typeof SIGNAL_VERDICT_KINDS[number];

export const SIGNAL_OBSERVATION_KINDS = [
  'anomaly',
  'prediction',
  'confirmation',
  'contradiction',
] as const;
export type SignalObservationKind = typeof SIGNAL_OBSERVATION_KINDS[number];

export const SIGNAL_GAP_KINDS = [
  'evidence_gap',
  'authority_gap',
  'policy_gap',
  'freshness_gap',
] as const;
export type SignalGapKind = typeof SIGNAL_GAP_KINDS[number];

export const SIGNAL_BOUNDARY_KINDS = [
  'tenant_boundary_signal',
  'blast_radius_signal',
] as const;
export type SignalBoundaryKind = typeof SIGNAL_BOUNDARY_KINDS[number];

export const SIGNAL_CONTEXT_KINDS = [
  'reversibility_context',
  'maturity_context',
  'coverage_context',
] as const;
export type SignalContextKind = typeof SIGNAL_CONTEXT_KINDS[number];

export const SIGNAL_MEASUREMENT_KINDS = [
  'drift_signal',
  'regression_signal',
  'budget_pressure_signal',
  'measurement_degraded_signal',
] as const;
export type SignalMeasurementKind = typeof SIGNAL_MEASUREMENT_KINDS[number];

export interface SignalKindByCategory {
  readonly verdict: SignalVerdictKind;
  readonly observation: SignalObservationKind;
  readonly gap: SignalGapKind;
  readonly boundary: SignalBoundaryKind;
  readonly context: SignalContextKind;
  readonly measurement: SignalMeasurementKind;
}

export type SignalKindForCategory<Category extends SignalCategory> =
  SignalKindByCategory[Category];

export type SignalKind = SignalKindByCategory[SignalCategory];

export const SIGNAL_SOURCE_PLANES = [
  'tier-1-hard-gate',
  'formal-verification',
  'shadow-baseline',
  'spatial-topology',
  'temporal-trajectory',
  'collective-intelligence',
  'policy-foundry',
  'assurance-measurement',
  'operator-review',
] as const;
export type SignalSourcePlane = typeof SIGNAL_SOURCE_PLANES[number];

export const SIGNAL_AUTHORITY_MODES = [
  'hard-floor',
  'advisory',
  'context-modulator',
  'measurement-only',
] as const;
export type SignalAuthorityMode = typeof SIGNAL_AUTHORITY_MODES[number];

export const SIGNAL_EVIDENCE_REFERENCE_KINDS = [
  'evidence',
  'authority',
  'approval',
  'receipt',
  'shadow-event',
  'trace',
  'schema',
  'runbook',
] as const;
export type SignalEvidenceReferenceKind =
  typeof SIGNAL_EVIDENCE_REFERENCE_KINDS[number];

export const SIGNAL_RELATIONSHIP_SHAPES = [
  'symmetric',
  'directed',
  'unary',
] as const;
export type SignalRelationshipShape = typeof SIGNAL_RELATIONSHIP_SHAPES[number];

export const SIGNAL_SYMMETRIC_RELATIONSHIP_KINDS = [
  'confirms',
  'contradicts',
  'duplicates',
] as const;
export type SignalSymmetricRelationshipKind =
  typeof SIGNAL_SYMMETRIC_RELATIONSHIP_KINDS[number];

export const SIGNAL_DIRECTED_RELATIONSHIP_KINDS = [
  'overrides',
  'depends_on',
  'modulates',
  'escalates',
  'suppresses',
] as const;
export type SignalDirectedRelationshipKind =
  typeof SIGNAL_DIRECTED_RELATIONSHIP_KINDS[number];

export const SIGNAL_UNARY_RELATIONSHIP_KINDS = [
  'requires_review',
] as const;
export type SignalUnaryRelationshipKind =
  typeof SIGNAL_UNARY_RELATIONSHIP_KINDS[number];

export type SignalRelationshipKind =
  | SignalSymmetricRelationshipKind
  | SignalDirectedRelationshipKind
  | SignalUnaryRelationshipKind;

export const SIGNAL_INTERACTION_EFFECTS = [
  'raise-review-pressure',
  'raise-block-pressure',
  'mark-conflict',
  'discount-duplicate-evidence',
  'preserve-hard-floor',
  'mark-dependency-missing',
  'mark-measurement-degraded',
] as const;
export type SignalInteractionEffect =
  typeof SIGNAL_INTERACTION_EFFECTS[number];

export const SIGNAL_RELATIONSHIP_REQUIRED_FIELDS = [
  'relationshipId',
  'kind',
  'shape',
  'evidenceRefs',
  'reasonCodes',
  'grantsAuthority',
  'activatesEnforcement',
  'autoEnforce',
  'productionReady',
] as const;
export type SignalRelationshipRequiredField =
  typeof SIGNAL_RELATIONSHIP_REQUIRED_FIELDS[number];

export interface SignalEvidenceRef extends
  ConsequenceEnvelopeDigestRef<SignalEvidenceReferenceKind> {}

export interface SignalReadModelRef {
  readonly modelKind:
    | 'policy'
    | 'formal-invariant'
    | 'shadow-baseline'
    | 'trajectory'
    | 'tenant-boundary'
    | 'measurement'
    | 'operator-review';
  readonly digest: string;
}

export interface SignalRelationshipSignal<
  Category extends SignalCategory = SignalCategory,
> {
  readonly signalId: string;
  readonly category: Category;
  readonly kind: SignalKindForCategory<Category>;
  readonly sourcePlane: SignalSourcePlane;
  readonly authorityMode: SignalAuthorityMode;
  readonly envelopeRefDigest: string;
  readonly evidenceRefs: readonly SignalEvidenceRef[];
  readonly readModelRefs: readonly SignalReadModelRef[];
  readonly appliesToConsequenceClasses:
    readonly ConsequenceEnvelopeConsequenceClass[];
  readonly knows: readonly string[];
  readonly cannotKnow: readonly string[];
  readonly confidence: number | null;
  readonly uncertainty: number | null;
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
}

export interface SignalSymmetricRelationship {
  readonly relationshipId: string;
  readonly kind: SignalSymmetricRelationshipKind;
  readonly shape: 'symmetric';
  readonly leftSignalId: string;
  readonly rightSignalId: string;
  readonly evidenceRefs: readonly SignalEvidenceRef[];
  readonly reasonCodes: readonly string[];
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export interface SignalDirectedRelationship {
  readonly relationshipId: string;
  readonly kind: SignalDirectedRelationshipKind;
  readonly shape: 'directed';
  readonly sourceSignalId: string;
  readonly targetSignalId: string;
  readonly evidenceRefs: readonly SignalEvidenceRef[];
  readonly reasonCodes: readonly string[];
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export interface SignalUnaryRelationship {
  readonly relationshipId: string;
  readonly kind: SignalUnaryRelationshipKind;
  readonly shape: 'unary';
  readonly signalId: string;
  readonly evidenceRefs: readonly SignalEvidenceRef[];
  readonly reasonCodes: readonly string[];
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export type SignalRelationship =
  | SignalSymmetricRelationship
  | SignalDirectedRelationship
  | SignalUnaryRelationship;

export interface SignalInteractionRule {
  readonly ruleId: string;
  readonly relationshipKind: SignalRelationshipKind;
  readonly effect: SignalInteractionEffect;
  readonly evidenceRefs: readonly SignalEvidenceRef[];
  readonly reasonCodes: readonly string[];
  readonly noLoosening: true;
  readonly mayGrantAuthority: false;
  readonly mayActivateEnforcement: false;
  readonly mayLowerRequiredReview: false;
  readonly mayStoreRawMaterial: false;
  readonly productionReady: false;
}

export interface SignalRelationshipFabricContract {
  readonly version: typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly envelopeRefDigest: string;
  readonly signals: readonly SignalRelationshipSignal[];
  readonly relationships: readonly SignalRelationship[];
  readonly interactionRules: readonly SignalInteractionRule[];
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
}

export interface SignalRelationshipContractDescriptor {
  readonly version: typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly categories: readonly SignalCategory[];
  readonly kindsByCategory: {
    readonly verdict: readonly SignalVerdictKind[];
    readonly observation: readonly SignalObservationKind[];
    readonly gap: readonly SignalGapKind[];
    readonly boundary: readonly SignalBoundaryKind[];
    readonly context: readonly SignalContextKind[];
    readonly measurement: readonly SignalMeasurementKind[];
  };
  readonly sourcePlanes: readonly SignalSourcePlane[];
  readonly authorityModes: readonly SignalAuthorityMode[];
  readonly evidenceReferenceKinds: readonly SignalEvidenceReferenceKind[];
  readonly relationshipShapes: readonly SignalRelationshipShape[];
  readonly symmetricRelationshipKinds:
    readonly SignalSymmetricRelationshipKind[];
  readonly directedRelationshipKinds: readonly SignalDirectedRelationshipKind[];
  readonly unaryRelationshipKinds: readonly SignalUnaryRelationshipKind[];
  readonly interactionEffects: readonly SignalInteractionEffect[];
  readonly requiredFields: readonly SignalRelationshipRequiredField[];
  readonly categoryBoundSignalKindsRequired: true;
  readonly directionalityRequired: true;
  readonly unaryRelationshipsAllowed: true;
  readonly interactionRulesMustBeMonotone: true;
  readonly relationshipEvaluationBeforeFusion: true;
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
}

export function signalRelationshipContractDescriptor(): SignalRelationshipContractDescriptor {
  return Object.freeze({
    version: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    categories: SIGNAL_CATEGORIES,
    kindsByCategory: {
      verdict: SIGNAL_VERDICT_KINDS,
      observation: SIGNAL_OBSERVATION_KINDS,
      gap: SIGNAL_GAP_KINDS,
      boundary: SIGNAL_BOUNDARY_KINDS,
      context: SIGNAL_CONTEXT_KINDS,
      measurement: SIGNAL_MEASUREMENT_KINDS,
    },
    sourcePlanes: SIGNAL_SOURCE_PLANES,
    authorityModes: SIGNAL_AUTHORITY_MODES,
    evidenceReferenceKinds: SIGNAL_EVIDENCE_REFERENCE_KINDS,
    relationshipShapes: SIGNAL_RELATIONSHIP_SHAPES,
    symmetricRelationshipKinds: SIGNAL_SYMMETRIC_RELATIONSHIP_KINDS,
    directedRelationshipKinds: SIGNAL_DIRECTED_RELATIONSHIP_KINDS,
    unaryRelationshipKinds: SIGNAL_UNARY_RELATIONSHIP_KINDS,
    interactionEffects: SIGNAL_INTERACTION_EFFECTS,
    requiredFields: SIGNAL_RELATIONSHIP_REQUIRED_FIELDS,
    categoryBoundSignalKindsRequired: true,
    directionalityRequired: true,
    unaryRelationshipsAllowed: true,
    interactionRulesMustBeMonotone: true,
    relationshipEvaluationBeforeFusion: true,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  });
}
