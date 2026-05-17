export const CONSEQUENCE_ENVELOPE_CONTRACT_VERSION =
  'attestor.consequence-envelope-contract.v1';

export const CONSEQUENCE_ENVELOPE_ACTION_TYPE_SOURCES = [
  'action-surface-graph',
  'domain-consequence-recipe',
  'integration-declaration',
  'operator-registered',
] as const;
export type ConsequenceEnvelopeActionTypeSource =
  typeof CONSEQUENCE_ENVELOPE_ACTION_TYPE_SOURCES[number];

export const CONSEQUENCE_ENVELOPE_CONSEQUENCE_CLASSES = [
  'financial',
  'data-movement',
  'authority-change',
  'external-communication',
  'operational-execution',
  'programmable-money',
  'health-claims',
  'unknown',
] as const;
export type ConsequenceEnvelopeConsequenceClass =
  typeof CONSEQUENCE_ENVELOPE_CONSEQUENCE_CLASSES[number];

export const CONSEQUENCE_ENVELOPE_REVERSIBILITY_CLASSES = [
  'reversible',
  'bounded',
  'irreversible',
] as const;
export type ConsequenceEnvelopeReversibilityClass =
  typeof CONSEQUENCE_ENVELOPE_REVERSIBILITY_CLASSES[number];

export const CONSEQUENCE_ENVELOPE_BLAST_RADIUS_ESTIMATES = [
  'single',
  'tenant',
  'cross-tenant',
  'systemic',
] as const;
export type ConsequenceEnvelopeBlastRadiusEstimate =
  typeof CONSEQUENCE_ENVELOPE_BLAST_RADIUS_ESTIMATES[number];

export const CONSEQUENCE_ENVELOPE_TENANT_MATURITY_CLASSES = [
  'new',
  'shadow-observed',
  'pilot',
  'production-shared',
  'mature',
] as const;
export type ConsequenceEnvelopeTenantMaturityClass =
  typeof CONSEQUENCE_ENVELOPE_TENANT_MATURITY_CLASSES[number];

export const CONSEQUENCE_ENVELOPE_HISTORY_DEPTH_CLASSES = [
  'none',
  'low',
  'medium',
  'high',
] as const;
export type ConsequenceEnvelopeHistoryDepthClass =
  typeof CONSEQUENCE_ENVELOPE_HISTORY_DEPTH_CLASSES[number];

export const CONSEQUENCE_ENVELOPE_ACTOR_AUTHORITY_CLASSES = [
  'none',
  'observed',
  'delegated',
  'reviewer-approved',
  'system-owner',
  'break-glass',
] as const;
export type ConsequenceEnvelopeActorAuthorityClass =
  typeof CONSEQUENCE_ENVELOPE_ACTOR_AUTHORITY_CLASSES[number];

export const CONSEQUENCE_ENVELOPE_FRESHNESS_POSTURES = [
  'fresh',
  'expiring',
  'stale',
  'unknown',
] as const;
export type ConsequenceEnvelopeFreshnessPosture =
  typeof CONSEQUENCE_ENVELOPE_FRESHNESS_POSTURES[number];

export const CONSEQUENCE_ENVELOPE_PRIOR_CHAIN_RELATIONSHIPS = [
  'same-actor',
  'same-resource',
  'same-target-system',
  'same-counterparty',
  'authority-predecessor',
  'replay-related',
  'operator-linked',
] as const;
export type ConsequenceEnvelopePriorChainRelationship =
  typeof CONSEQUENCE_ENVELOPE_PRIOR_CHAIN_RELATIONSHIPS[number];

export const CONSEQUENCE_ENVELOPE_REFERENCE_KINDS = [
  'tenant',
  'actor',
  'target-system',
  'action-type-registry',
  'resource',
  'counterparty',
  'policy-bundle',
  'policy-scope',
  'evidence',
  'authority',
  'approval',
  'receipt',
  'shadow-event',
  'trace',
  'schema',
  'runbook',
] as const;
export type ConsequenceEnvelopeReferenceKind =
  typeof CONSEQUENCE_ENVELOPE_REFERENCE_KINDS[number];

export const CONSEQUENCE_ENVELOPE_RAW_MATERIAL_POLICIES = [
  'digest-only',
  'redacted-summary',
] as const;
export type ConsequenceEnvelopeRawMaterialPolicy =
  typeof CONSEQUENCE_ENVELOPE_RAW_MATERIAL_POLICIES[number];

export const CONSEQUENCE_ENVELOPE_REQUIRED_FIELDS = [
  'sourceEventRef',
  'canonicalActionType',
  'consequenceClass',
  'reversibilityClass',
  'blastRadiusEstimate',
  'tenantContext',
  'actorContext',
  'timingContext',
  'priorChain',
  'evidenceRefs',
  'authorityRefs',
  'policyScope',
  'targetSystemRef',
  'rawMaterialBoundary',
] as const;
export type ConsequenceEnvelopeRequiredField =
  typeof CONSEQUENCE_ENVELOPE_REQUIRED_FIELDS[number];

export interface ConsequenceEnvelopeDigestRef<
  Kind extends ConsequenceEnvelopeReferenceKind = ConsequenceEnvelopeReferenceKind,
> {
  readonly kind: Kind;
  readonly digest: string;
}

export interface ConsequenceEnvelopeCanonicalActionType {
  readonly value: string;
  readonly source: ConsequenceEnvelopeActionTypeSource;
  readonly registryRefDigest: string;
}

export interface ConsequenceEnvelopeTenantContext {
  readonly tenantRefDigest: string;
  readonly maturityClass: ConsequenceEnvelopeTenantMaturityClass;
  readonly historyDepthClass: ConsequenceEnvelopeHistoryDepthClass;
  readonly coverageRefDigest: string | null;
}

export interface ConsequenceEnvelopeActorContext {
  readonly actorRefDigest: string;
  readonly authorityClass: ConsequenceEnvelopeActorAuthorityClass;
  readonly authorityRefDigest: string | null;
  readonly reviewerRefDigest: string | null;
}

export interface ConsequenceEnvelopeTimingContext {
  readonly requestedAt: string;
  readonly freshnessWindowSeconds: number | null;
  readonly freshnessPosture: ConsequenceEnvelopeFreshnessPosture;
  readonly deadlineAt: string | null;
}

export interface ConsequenceEnvelopePriorChainLink {
  readonly relationship: ConsequenceEnvelopePriorChainRelationship;
  readonly eventRefDigest: string;
  readonly distance: number;
}

export interface ConsequenceEnvelopePolicyScope {
  readonly policyBundleRefDigest: string | null;
  readonly policyScopeRefDigest: string | null;
  readonly rolloutRefDigest: string | null;
  readonly candidateRefDigest: string | null;
}

export interface ConsequenceEnvelopeRawMaterialBoundary {
  readonly policy: ConsequenceEnvelopeRawMaterialPolicy;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawToolPayloadStored: false;
  readonly rawProviderBodyStored: false;
  readonly rawCustomerIdentifierStored: false;
  readonly rawTenantIdentifierStored: false;
  readonly rawWalletMaterialStored: false;
  readonly rawPaymentDetailStored: false;
  readonly rawDownstreamBodyStored: false;
  readonly rawPrivateThresholdStored: false;
}

export interface ConsequenceEnvelopeContract {
  readonly version: typeof CONSEQUENCE_ENVELOPE_CONTRACT_VERSION;
  readonly sourceEventRef: ConsequenceEnvelopeDigestRef<'shadow-event'>;
  readonly canonicalActionType: ConsequenceEnvelopeCanonicalActionType;
  readonly consequenceClass: ConsequenceEnvelopeConsequenceClass;
  readonly reversibilityClass: ConsequenceEnvelopeReversibilityClass;
  readonly blastRadiusEstimate: ConsequenceEnvelopeBlastRadiusEstimate;
  readonly tenantContext: ConsequenceEnvelopeTenantContext;
  readonly actorContext: ConsequenceEnvelopeActorContext;
  readonly timingContext: ConsequenceEnvelopeTimingContext;
  readonly priorChain: readonly ConsequenceEnvelopePriorChainLink[];
  readonly evidenceRefs: readonly ConsequenceEnvelopeDigestRef<
    'evidence' | 'approval' | 'receipt'
  >[];
  readonly authorityRefs: readonly ConsequenceEnvelopeDigestRef<
    'authority' | 'approval'
  >[];
  readonly policyScope: ConsequenceEnvelopePolicyScope;
  readonly targetSystemRef: ConsequenceEnvelopeDigestRef<'target-system'>;
  readonly resourceRefs: readonly ConsequenceEnvelopeDigestRef<'resource'>[];
  readonly counterpartyRefs: readonly ConsequenceEnvelopeDigestRef<
    'counterparty'
  >[];
  readonly rawMaterialBoundary: ConsequenceEnvelopeRawMaterialBoundary;
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export interface ConsequenceEnvelopeContractDescriptor {
  readonly version: typeof CONSEQUENCE_ENVELOPE_CONTRACT_VERSION;
  readonly requiredFields: readonly ConsequenceEnvelopeRequiredField[];
  readonly actionTypeSources: readonly ConsequenceEnvelopeActionTypeSource[];
  readonly consequenceClasses: readonly ConsequenceEnvelopeConsequenceClass[];
  readonly reversibilityClasses: readonly ConsequenceEnvelopeReversibilityClass[];
  readonly blastRadiusEstimates: readonly ConsequenceEnvelopeBlastRadiusEstimate[];
  readonly tenantMaturityClasses: readonly ConsequenceEnvelopeTenantMaturityClass[];
  readonly historyDepthClasses: readonly ConsequenceEnvelopeHistoryDepthClass[];
  readonly actorAuthorityClasses: readonly ConsequenceEnvelopeActorAuthorityClass[];
  readonly freshnessPostures: readonly ConsequenceEnvelopeFreshnessPosture[];
  readonly priorChainRelationships:
    readonly ConsequenceEnvelopePriorChainRelationship[];
  readonly referenceKinds: readonly ConsequenceEnvelopeReferenceKind[];
  readonly rawMaterialPolicies: readonly ConsequenceEnvelopeRawMaterialPolicy[];
  readonly digestOnlyRefsRequired: true;
  readonly relationshipFabricInput: true;
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawToolPayloadStored: false;
  readonly rawProviderBodyStored: false;
  readonly rawCustomerIdentifierStored: false;
  readonly rawTenantIdentifierStored: false;
  readonly rawWalletMaterialStored: false;
  readonly rawPaymentDetailStored: false;
  readonly rawDownstreamBodyStored: false;
  readonly rawPrivateThresholdStored: false;
}

export function consequenceEnvelopeContractDescriptor(): ConsequenceEnvelopeContractDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
    requiredFields: CONSEQUENCE_ENVELOPE_REQUIRED_FIELDS,
    actionTypeSources: CONSEQUENCE_ENVELOPE_ACTION_TYPE_SOURCES,
    consequenceClasses: CONSEQUENCE_ENVELOPE_CONSEQUENCE_CLASSES,
    reversibilityClasses: CONSEQUENCE_ENVELOPE_REVERSIBILITY_CLASSES,
    blastRadiusEstimates: CONSEQUENCE_ENVELOPE_BLAST_RADIUS_ESTIMATES,
    tenantMaturityClasses: CONSEQUENCE_ENVELOPE_TENANT_MATURITY_CLASSES,
    historyDepthClasses: CONSEQUENCE_ENVELOPE_HISTORY_DEPTH_CLASSES,
    actorAuthorityClasses: CONSEQUENCE_ENVELOPE_ACTOR_AUTHORITY_CLASSES,
    freshnessPostures: CONSEQUENCE_ENVELOPE_FRESHNESS_POSTURES,
    priorChainRelationships: CONSEQUENCE_ENVELOPE_PRIOR_CHAIN_RELATIONSHIPS,
    referenceKinds: CONSEQUENCE_ENVELOPE_REFERENCE_KINDS,
    rawMaterialPolicies: CONSEQUENCE_ENVELOPE_RAW_MATERIAL_POLICIES,
    digestOnlyRefsRequired: true,
    relationshipFabricInput: true,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawToolPayloadStored: false,
    rawProviderBodyStored: false,
    rawCustomerIdentifierStored: false,
    rawTenantIdentifierStored: false,
    rawWalletMaterialStored: false,
    rawPaymentDetailStored: false,
    rawDownstreamBodyStored: false,
    rawPrivateThresholdStored: false,
  });
}
