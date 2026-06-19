import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  DOMAIN_CONSEQUENCE_RECIPES_VERSION,
  type DomainConsequenceRecipe,
  type RecipeDefinition,
} from './domain-consequence-recipes-types.js';

export const REQUIRED_NORMALIZED_FIELDS = [
  'tenantRefDigest',
  'actorRefDigest',
  'targetSystem',
  'targetAccountRefDigest',
  'domainFamily',
  'actionName',
  'actionKind',
  'consequenceClass',
  'resourceRefDigest',
  'subjectRefDigest',
  'evidenceRefs',
  'approvalRefs',
  'receiptRefDigest',
  'idempotencyRefDigest',
] as const;

export function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

export function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Domain consequence recipes ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function assertNonEmptyList(
  values: readonly string[],
  fieldName: string,
): readonly string[] {
  if (values.length === 0) {
    throw new Error(`Domain consequence recipes ${fieldName} must not be empty.`);
  }
  for (const value of values) {
    if (value.trim().length === 0) {
      throw new Error(`Domain consequence recipes ${fieldName} must not contain blank values.`);
    }
  }
  return Object.freeze([...values]);
}

function assertOfficialHttpsUrl(value: string, recipeId: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') {
    throw new Error(`Domain consequence recipe ${recipeId} source URL must use HTTPS.`);
  }
  return parsed.toString();
}

function recipeDigest(recipe: RecipeDefinition): string {
  return canonicalObject({
    version: DOMAIN_CONSEQUENCE_RECIPES_VERSION,
    recipeId: recipe.recipeId,
    targetSystem: recipe.targetSystem,
    targetFamily: recipe.targetFamily,
    displayName: recipe.displayName,
    primarySourceName: recipe.primarySourceName,
    primarySourceUrl: recipe.primarySourceUrl,
    pattern: recipe.pattern,
    readiness: recipe.readiness,
    insertionPoint: recipe.insertionPoint,
    attestorPlacement: recipe.attestorPlacement,
    protectedConsequences: recipe.protectedConsequences,
    normalizedFields: recipe.normalizedFields,
    evidenceRefs: recipe.evidenceRefs,
    approvalPath: recipe.approvalPath,
    receiptRefs: recipe.receiptRefs,
    replayAndIdempotencyRefs: recipe.replayAndIdempotencyRefs,
    riskSignals: recipe.riskSignals,
    implementationSteps: recipe.implementationSteps,
    noGoBoundary: recipe.noGoBoundary,
    customerOwnsSystemOfRecord: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    recordsSystem: false,
    workflowWorkspace: false,
    productionReady: false,
  } as unknown as CanonicalReleaseJsonValue).digest;
}

export function createRecipe(input: RecipeDefinition): DomainConsequenceRecipe {
  const normalizedFields = assertNonEmptyList(input.normalizedFields, `${input.recipeId}.normalizedFields`);
  for (const field of REQUIRED_NORMALIZED_FIELDS) {
    if (!normalizedFields.includes(field)) {
      throw new Error(
        `Domain consequence recipe ${input.recipeId} must include normalized field ${field}.`,
      );
    }
  }
  if (!input.noGoBoundary.startsWith('No ')) {
    throw new Error(`Domain consequence recipe ${input.recipeId} no-go boundary must start with "No ".`);
  }
  const recipe: RecipeDefinition = Object.freeze({
    ...input,
    primarySourceUrl: assertOfficialHttpsUrl(input.primarySourceUrl, input.recipeId),
    protectedConsequences: assertNonEmptyList(input.protectedConsequences, `${input.recipeId}.protectedConsequences`),
    normalizedFields,
    evidenceRefs: assertNonEmptyList(input.evidenceRefs, `${input.recipeId}.evidenceRefs`),
    approvalPath: assertNonEmptyList(input.approvalPath, `${input.recipeId}.approvalPath`),
    receiptRefs: assertNonEmptyList(input.receiptRefs, `${input.recipeId}.receiptRefs`),
    replayAndIdempotencyRefs: assertNonEmptyList(
      input.replayAndIdempotencyRefs,
      `${input.recipeId}.replayAndIdempotencyRefs`,
    ),
    riskSignals: assertNonEmptyList(input.riskSignals, `${input.recipeId}.riskSignals`),
    implementationSteps: assertNonEmptyList(input.implementationSteps, `${input.recipeId}.implementationSteps`),
    customerOwnsSystemOfRecord: true,
    nativeConnectorImplemented: false,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    recordsSystem: false,
    workflowWorkspace: false,
    productionReady: false,
  });
  return Object.freeze({
    ...recipe,
    digest: recipeDigest(recipe),
  });
}
