export const DOMAIN_CONSEQUENCE_RECIPES_VERSION =
  'attestor.domain-consequence-recipes.v1';

export const DOMAIN_CONSEQUENCE_RECIPE_FAMILIES = [
  'spend-procurement',
  'data-ai-platform',
  'iam-authority',
  'health-clinical',
  'insurance-core',
] as const;
export type DomainConsequenceRecipeFamily =
  typeof DOMAIN_CONSEQUENCE_RECIPE_FAMILIES[number];

export const DOMAIN_CONSEQUENCE_RECIPE_TARGETS = [
  'ramp-spend-accounting',
  'brex-expenses-api',
  'coupa-approvals',
  'sap-s4hana-purchase-order',
  'snowflake-cortex-agents',
  'databricks-agent-tools',
  'okta-workflows-authority',
  'microsoft-entra-lifecycle-workflows',
  'sailpoint-workflows',
  'hl7-fhir-subscriptions',
  'cds-hooks-clinical-decision-support',
  'guidewire-claimcenter-cloud-api',
  'guidewire-policycenter-cloud-api',
] as const;
export type DomainConsequenceRecipeTarget =
  typeof DOMAIN_CONSEQUENCE_RECIPE_TARGETS[number];

export const DOMAIN_CONSEQUENCE_RECIPE_PATTERNS = [
  'spend-request-gate',
  'procurement-approval-gate',
  'data-tool-gate',
  'identity-workflow-gate',
  'clinical-event-gate',
  'insurance-api-gate',
] as const;
export type DomainConsequenceRecipePattern =
  typeof DOMAIN_CONSEQUENCE_RECIPE_PATTERNS[number];

export const DOMAIN_CONSEQUENCE_RECIPE_READINESS = [
  'recipe-ready',
  'requires-target-design',
] as const;
export type DomainConsequenceRecipeReadiness =
  typeof DOMAIN_CONSEQUENCE_RECIPE_READINESS[number];

export interface DomainConsequenceRecipe {
  readonly recipeId: string;
  readonly targetSystem: DomainConsequenceRecipeTarget;
  readonly targetFamily: DomainConsequenceRecipeFamily;
  readonly displayName: string;
  readonly primarySourceName: string;
  readonly primarySourceUrl: string;
  readonly pattern: DomainConsequenceRecipePattern;
  readonly readiness: DomainConsequenceRecipeReadiness;
  readonly insertionPoint: string;
  readonly attestorPlacement: string;
  readonly protectedConsequences: readonly string[];
  readonly normalizedFields: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly approvalPath: readonly string[];
  readonly receiptRefs: readonly string[];
  readonly replayAndIdempotencyRefs: readonly string[];
  readonly riskSignals: readonly string[];
  readonly implementationSteps: readonly string[];
  readonly noGoBoundary: string;
  readonly customerOwnsSystemOfRecord: true;
  readonly nativeConnectorImplemented: false;
  readonly customerDeploymentRequired: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly recordsSystem: false;
  readonly workflowWorkspace: false;
  readonly productionReady: false;
  readonly digest: string;
}

export interface DomainConsequenceRecipeCatalogCounts {
  readonly spendProcurement: number;
  readonly dataAiPlatform: number;
  readonly iamAuthority: number;
  readonly healthClinical: number;
  readonly insuranceCore: number;
  readonly recipeReady: number;
  readonly requiresTargetDesign: number;
}

export interface DomainConsequenceRecipeCatalog {
  readonly version: typeof DOMAIN_CONSEQUENCE_RECIPES_VERSION;
  readonly generatedAt: string;
  readonly recipeCount: number;
  readonly targetSystems: readonly DomainConsequenceRecipeTarget[];
  readonly families: readonly DomainConsequenceRecipeFamily[];
  readonly patterns: readonly DomainConsequenceRecipePattern[];
  readonly counts: DomainConsequenceRecipeCatalogCounts;
  readonly recipes: readonly DomainConsequenceRecipe[];
  readonly sourceBacked: true;
  readonly oneEngineAdapterModel: true;
  readonly customerOwnsSystemOfRecord: true;
  readonly nativeConnectorCoverage: false;
  readonly customerDeploymentProven: false;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly recordsSystem: false;
  readonly workflowWorkspace: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface DomainConsequenceRecipeCatalogDescriptor {
  readonly version: typeof DOMAIN_CONSEQUENCE_RECIPES_VERSION;
  readonly targetSystems: typeof DOMAIN_CONSEQUENCE_RECIPE_TARGETS;
  readonly families: typeof DOMAIN_CONSEQUENCE_RECIPE_FAMILIES;
  readonly patterns: typeof DOMAIN_CONSEQUENCE_RECIPE_PATTERNS;
  readonly readiness: typeof DOMAIN_CONSEQUENCE_RECIPE_READINESS;
  readonly sourceBacked: true;
  readonly oneEngineAdapterModel: true;
  readonly customerOwnsSystemOfRecord: true;
  readonly nativeConnectorCoverage: false;
  readonly customerDeploymentProven: false;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly recordsSystem: false;
  readonly workflowWorkspace: false;
  readonly productionReady: false;
}

export interface CreateDomainConsequenceRecipeCatalogInput {
  readonly generatedAt?: string | null;
}

export type RecipeDefinition = Omit<DomainConsequenceRecipe, 'digest'>;
