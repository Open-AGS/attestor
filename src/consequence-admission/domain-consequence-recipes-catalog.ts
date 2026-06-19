import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import { RECIPES } from './domain-consequence-recipes-data.js';
import {
  DOMAIN_CONSEQUENCE_RECIPES_VERSION,
  DOMAIN_CONSEQUENCE_RECIPE_FAMILIES,
  DOMAIN_CONSEQUENCE_RECIPE_PATTERNS,
  DOMAIN_CONSEQUENCE_RECIPE_READINESS,
  DOMAIN_CONSEQUENCE_RECIPE_TARGETS,
  type CreateDomainConsequenceRecipeCatalogInput,
  type DomainConsequenceRecipe,
  type DomainConsequenceRecipeCatalog,
  type DomainConsequenceRecipeCatalogCounts,
  type DomainConsequenceRecipeCatalogDescriptor,
  type DomainConsequenceRecipeFamily,
  type DomainConsequenceRecipeReadiness,
} from './domain-consequence-recipes-types.js';
import {
  canonicalObject,
  normalizeIsoTimestamp,
} from './domain-consequence-recipes-utils.js';

function countByFamily(
  recipes: readonly DomainConsequenceRecipe[],
  family: DomainConsequenceRecipeFamily,
): number {
  return recipes.filter((recipe) => recipe.targetFamily === family).length;
}

function countByReadiness(
  recipes: readonly DomainConsequenceRecipe[],
  readiness: DomainConsequenceRecipeReadiness,
): number {
  return recipes.filter((recipe) => recipe.readiness === readiness).length;
}

export function createDomainConsequenceRecipeCatalog(
  input: CreateDomainConsequenceRecipeCatalogInput = {},
): DomainConsequenceRecipeCatalog {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const recipes = Object.freeze([...RECIPES]);
  const counts: DomainConsequenceRecipeCatalogCounts = Object.freeze({
    spendProcurement: countByFamily(recipes, 'spend-procurement'),
    dataAiPlatform: countByFamily(recipes, 'data-ai-platform'),
    iamAuthority: countByFamily(recipes, 'iam-authority'),
    healthClinical: countByFamily(recipes, 'health-clinical'),
    insuranceCore: countByFamily(recipes, 'insurance-core'),
    recipeReady: countByReadiness(recipes, 'recipe-ready'),
    requiresTargetDesign: countByReadiness(recipes, 'requires-target-design'),
  });
  const canonical = canonicalObject({
    version: DOMAIN_CONSEQUENCE_RECIPES_VERSION,
    generatedAt,
    recipeCount: recipes.length,
    targetSystems: DOMAIN_CONSEQUENCE_RECIPE_TARGETS,
    families: DOMAIN_CONSEQUENCE_RECIPE_FAMILIES,
    patterns: DOMAIN_CONSEQUENCE_RECIPE_PATTERNS,
    counts,
    recipes,
    sourceBacked: true,
    oneEngineAdapterModel: true,
    customerOwnsSystemOfRecord: true,
    nativeConnectorCoverage: false,
    customerDeploymentProven: false,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    recordsSystem: false,
    workflowWorkspace: false,
    productionReady: false,
  } as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    version: DOMAIN_CONSEQUENCE_RECIPES_VERSION,
    generatedAt,
    recipeCount: recipes.length,
    targetSystems: DOMAIN_CONSEQUENCE_RECIPE_TARGETS,
    families: DOMAIN_CONSEQUENCE_RECIPE_FAMILIES,
    patterns: DOMAIN_CONSEQUENCE_RECIPE_PATTERNS,
    counts,
    recipes,
    sourceBacked: true,
    oneEngineAdapterModel: true,
    customerOwnsSystemOfRecord: true,
    nativeConnectorCoverage: false,
    customerDeploymentProven: false,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    recordsSystem: false,
    workflowWorkspace: false,
    productionReady: false,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function domainConsequenceRecipeCatalogDescriptor():
DomainConsequenceRecipeCatalogDescriptor {
  return Object.freeze({
    version: DOMAIN_CONSEQUENCE_RECIPES_VERSION,
    targetSystems: DOMAIN_CONSEQUENCE_RECIPE_TARGETS,
    families: DOMAIN_CONSEQUENCE_RECIPE_FAMILIES,
    patterns: DOMAIN_CONSEQUENCE_RECIPE_PATTERNS,
    readiness: DOMAIN_CONSEQUENCE_RECIPE_READINESS,
    sourceBacked: true,
    oneEngineAdapterModel: true,
    customerOwnsSystemOfRecord: true,
    nativeConnectorCoverage: false,
    customerDeploymentProven: false,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    recordsSystem: false,
    workflowWorkspace: false,
    productionReady: false,
  });
}
