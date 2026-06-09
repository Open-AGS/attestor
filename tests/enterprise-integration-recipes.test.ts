import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createEnterpriseIntegrationRecipeCatalog,
  enterpriseIntegrationRecipeCatalogDescriptor,
  ENTERPRISE_INTEGRATION_RECIPE_TARGETS,
  type EnterpriseIntegrationRecipe,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function recipe(
  recipes: readonly EnterpriseIntegrationRecipe[],
  targetSystem: EnterpriseIntegrationRecipe['targetSystem'],
): EnterpriseIntegrationRecipe {
  const found = recipes.find((item) => item.targetSystem === targetSystem);
  assert.ok(found, `Expected enterprise recipe for ${targetSystem}`);
  return found;
}

function testCatalogCoversTheEnterpriseTargets(): void {
  const catalog = createEnterpriseIntegrationRecipeCatalog({
    generatedAt: '2026-05-17T10:00:00.000Z',
  });

  equal(
    catalog.version,
    'attestor.enterprise-integration-recipes.v1',
    'Enterprise recipes: version is explicit',
  );
  equal(catalog.generatedAt, '2026-05-17T10:00:00.000Z', 'Enterprise recipes: generatedAt is stable');
  equal(catalog.recipeCount, 14, 'Enterprise recipes: all target recipes are present');
  equal(catalog.targetSystems.length, ENTERPRISE_INTEGRATION_RECIPE_TARGETS.length, 'Enterprise recipes: target list matches descriptor');
  equal(catalog.counts.crmSupport, 1, 'Enterprise recipes: CRM/support count is explicit');
  equal(catalog.counts.microsoftPowerPlatform, 1, 'Enterprise recipes: Microsoft Power Platform count is explicit');
  equal(catalog.counts.itsmWorkflow, 1, 'Enterprise recipes: ITSM/workflow count is explicit');
  equal(catalog.counts.ipaasOrchestration, 4, 'Enterprise recipes: iPaaS/orchestration count is explicit');
  equal(catalog.counts.supportCommunications, 2, 'Enterprise recipes: support communications count is explicit');
  equal(catalog.counts.dataAiPlatform, 2, 'Enterprise recipes: data/AI count is explicit');
  equal(catalog.counts.iamAuthority, 3, 'Enterprise recipes: IAM authority count is explicit');
  equal(catalog.counts.recipeReady, 7, 'Enterprise recipes: recipe-ready count is explicit');
  equal(catalog.counts.requiresTargetDesign, 6, 'Enterprise recipes: target-design count is explicit');
  equal(catalog.counts.watchSurface, 1, 'Enterprise recipes: watch-surface count is explicit');
  ok(catalog.digest.startsWith('sha256:'), 'Enterprise recipes: catalog digest is generated');

  for (const target of ENTERPRISE_INTEGRATION_RECIPE_TARGETS) {
    const found = recipe(catalog.recipes, target);
    ok(found.digest.startsWith('sha256:'), `Enterprise recipes: ${target} has a digest`);
    equal(found.customerOwnsExecution, true, `Enterprise recipes: ${target} keeps customer execution ownership`);
    equal(found.nativeConnectorImplemented, false, `Enterprise recipes: ${target} does not claim native connector`);
    equal(found.customerDeploymentRequired, true, `Enterprise recipes: ${target} requires customer deployment`);
    equal(found.approvalRequired, true, `Enterprise recipes: ${target} requires approval`);
    equal(found.autoEnforce, false, `Enterprise recipes: ${target} does not auto-enforce`);
    equal(found.rawPayloadStored, false, `Enterprise recipes: ${target} does not store raw payload`);
    equal(found.productionReady, false, `Enterprise recipes: ${target} does not claim production readiness`);
  }
}

function testRecipesPreserveRequiredFieldsAndPlacement(): void {
  const catalog = createEnterpriseIntegrationRecipeCatalog({
    generatedAt: '2026-05-17T10:10:00.000Z',
  });
  const requiredFields = [
    'tenantRefDigest',
    'actorRefDigest',
    'targetSystem',
    'targetAccountRefDigest',
    'actionName',
    'actionKind',
    'consequenceClass',
    'resourceRefDigest',
    'evidenceRefs',
    'approvalRefs',
    'receiptRefDigest',
    'idempotencyRefDigest',
  ] as const;

  for (const item of catalog.recipes) {
    for (const field of requiredFields) {
      ok(
        item.normalizedFields.includes(field),
        `Enterprise recipes: ${item.targetSystem} includes normalized field ${field}`,
      );
    }
    ok(item.insertionPoint.includes('before'), `Enterprise recipes: ${item.targetSystem} insertion point is pre-side-effect`);
    ok(item.attestorPlacement.includes('Attestor'), `Enterprise recipes: ${item.targetSystem} names Attestor placement`);
    ok(item.protectedConsequences.length >= 4, `Enterprise recipes: ${item.targetSystem} lists concrete consequences`);
    ok(item.evidenceRefs.length >= 4, `Enterprise recipes: ${item.targetSystem} lists evidence refs`);
    ok(item.approvalPath.includes('approval/dismiss feedback event'), `Enterprise recipes: ${item.targetSystem} binds feedback event`);
    ok(item.receiptRefs.length >= 3, `Enterprise recipes: ${item.targetSystem} lists receipt refs`);
    ok(item.replayAndIdempotencyRefs.length >= 3, `Enterprise recipes: ${item.targetSystem} lists replay/idempotency refs`);
    ok(item.implementationSteps.length >= 4, `Enterprise recipes: ${item.targetSystem} lists implementation steps`);
    ok(item.noGoBoundary.startsWith('No '), `Enterprise recipes: ${item.targetSystem} no-go is explicit`);
    ok(item.primarySourceUrl.startsWith('https://'), `Enterprise recipes: ${item.targetSystem} uses HTTPS source`);
  }
}

function testSpecificRecipesAnchorHighValueTargets(): void {
  const catalog = createEnterpriseIntegrationRecipeCatalog({
    generatedAt: '2026-05-17T10:20:00.000Z',
  });

  const salesforce = recipe(catalog.recipes, 'salesforce-agentforce');
  equal(salesforce.pattern, 'custom-action-gate', 'Enterprise recipes: Salesforce uses custom action gate');
  includes(
    salesforce.insertionPoint,
    'Apex REST',
    'Enterprise recipes: Salesforce insertion point names Apex REST',
  );

  const microsoft = recipe(catalog.recipes, 'microsoft-copilot-power-automate');
  equal(microsoft.pattern, 'custom-connector-gate', 'Enterprise recipes: Microsoft uses connector gate');
  includes(
    microsoft.insertionPoint,
    'REST API',
    'Enterprise recipes: Microsoft insertion point names REST API',
  );

  const zapier = recipe(catalog.recipes, 'zapier-mcp');
  equal(zapier.readiness, 'watch-surface', 'Enterprise recipes: Zapier MCP remains watch-surface');
  includes(zapier.noGoBoundary, 'beta', 'Enterprise recipes: Zapier beta boundary is explicit');

  const snowflake = recipe(catalog.recipes, 'snowflake-cortex-agents');
  includes(
    snowflake.protectedConsequences.join('|'),
    'customer.export',
    'Enterprise recipes: Snowflake covers data export',
  );

  const okta = recipe(catalog.recipes, 'okta-workflows');
  includes(
    okta.protectedConsequences.join('|'),
    'group.add_user',
    'Enterprise recipes: Okta covers group membership changes',
  );

  const sailpoint = recipe(catalog.recipes, 'sailpoint-identity-security-cloud');
  includes(
    sailpoint.protectedConsequences.join('|'),
    'entitlement.change',
    'Enterprise recipes: SailPoint covers entitlement change',
  );
}

function testDescriptorDocsAndTrackersStayAligned(): void {
  const descriptor = enterpriseIntegrationRecipeCatalogDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'enterprise-integration-recipes.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const tracker = readProjectFile('docs', '02-architecture', 'attestor-unlock-source-of-truth.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const customerRecipes = readProjectFile('docs', '01-overview', 'customer-integration-recipes.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.nativeConnectorCoverage, false, 'Enterprise recipes descriptor: native connector coverage is false');
  equal(descriptor.customerDeploymentProven, false, 'Enterprise recipes descriptor: customer deployment proof is false');
  equal(descriptor.autoEnforce, false, 'Enterprise recipes descriptor: auto enforce is false');
  ok(descriptor.targetSystems.includes('sailpoint-identity-security-cloud'), 'Enterprise recipes descriptor: SailPoint target is included');

  for (const expected of [
    '# Enterprise Integration Recipes',
    'attestor.enterprise-integration-recipes.v1',
    'Salesforce Agentforce',
    'Microsoft Copilot Studio / Power Automate',
    'ServiceNow IntegrationHub',
    'Workato Agent Studio',
    'MuleSoft Agentforce API',
    'n8n AI tool human review',
    'Zapier MCP',
    'Zendesk AI Agents',
    'Intercom Conversations',
    'Snowflake Cortex Agents',
    'Databricks Agent Framework',
    'Okta Workflows',
    'Microsoft Entra ID Governance',
    'SailPoint Identity Security Cloud',
    'native connector coverage = false',
    'autoEnforce = false',
    'productionReady = false',
  ]) {
    includes(doc, expected, `Enterprise recipes doc: records ${expected}`);
  }

  for (const expected of [
    '| Complete | 26 |',
    '| Remaining | 0 |',
    '| 22 | complete | Approval/dismiss feedback loop |',
    '| 23 | complete | Enterprise integration recipes |',
    '| 24 | complete | General Crypto Transaction Gate |',
    'live customer pilot execution',
  ]) {
    includes(masterPlan, expected, `Enterprise recipes: master plan records ${expected}`);
  }

  includes(
    tracker,
    'Step 23 records the Enterprise integration recipes',
    'Enterprise recipes: unlock tracker points to Step 23 completion',
  );
  includes(
    systemOverview,
    '[Enterprise integration recipes](enterprise-integration-recipes.md)',
    'Enterprise recipes: system overview links doc',
  );
  includes(
    readme,
    'href="docs/01-overview/how-attestor-connects-to-existing-systems.md"',
    'Enterprise recipes: README links the integration overview',
  );
  includes(
    customerRecipes,
    '[Enterprise integration recipes](../02-architecture/enterprise-integration-recipes.md)',
    'Enterprise recipes: customer recipes link detailed placement recipes',
  );
  includes(
    ledger,
    '### 65. Enterprise Integration Recipes',
    'Enterprise recipes: research ledger entry is present',
  );
  equal(
    packageJson.scripts['test:enterprise-integration-recipes'],
    'tsx tests/enterprise-integration-recipes.test.ts',
    'Enterprise recipes: package script is registered',
  );
  excludes(
    doc,
    /\bnative connector is implemented\b|\bmarketplace listing is complete\b|\bproduction-ready because of recipes\b/iu,
    'Enterprise recipes doc: does not overclaim connector or production readiness',
  );
}

testCatalogCoversTheEnterpriseTargets();
testRecipesPreserveRequiredFieldsAndPlacement();
testSpecificRecipesAnchorHighValueTargets();
testDescriptorDocsAndTrackersStayAligned();

console.log(`Enterprise integration recipes tests: ${passed} passed, 0 failed`);
