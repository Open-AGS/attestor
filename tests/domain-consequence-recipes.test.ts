import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createDomainConsequenceRecipeCatalog,
  domainConsequenceRecipeCatalogDescriptor,
  DOMAIN_CONSEQUENCE_RECIPE_TARGETS,
  type DomainConsequenceRecipe,
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
  recipes: readonly DomainConsequenceRecipe[],
  targetSystem: DomainConsequenceRecipe['targetSystem'],
): DomainConsequenceRecipe {
  const found = recipes.find((item) => item.targetSystem === targetSystem);
  assert.ok(found, `Expected domain recipe for ${targetSystem}`);
  return found;
}

function testCatalogCoversDomainTargets(): void {
  const catalog = createDomainConsequenceRecipeCatalog({
    generatedAt: '2026-05-17T14:00:00.000Z',
  });

  equal(
    catalog.version,
    'attestor.domain-consequence-recipes.v1',
    'Domain recipes: version is explicit',
  );
  equal(catalog.generatedAt, '2026-05-17T14:00:00.000Z', 'Domain recipes: generatedAt is stable');
  equal(catalog.recipeCount, 13, 'Domain recipes: all target recipes are present');
  equal(catalog.targetSystems.length, DOMAIN_CONSEQUENCE_RECIPE_TARGETS.length, 'Domain recipes: target list matches descriptor');
  equal(catalog.counts.spendProcurement, 4, 'Domain recipes: spend/procurement count is explicit');
  equal(catalog.counts.dataAiPlatform, 2, 'Domain recipes: data/AI platform count is explicit');
  equal(catalog.counts.iamAuthority, 3, 'Domain recipes: IAM authority count is explicit');
  equal(catalog.counts.healthClinical, 2, 'Domain recipes: health/clinical count is explicit');
  equal(catalog.counts.insuranceCore, 2, 'Domain recipes: insurance core count is explicit');
  equal(catalog.counts.recipeReady, 7, 'Domain recipes: recipe-ready count is explicit');
  equal(catalog.counts.requiresTargetDesign, 6, 'Domain recipes: target-design count is explicit');
  ok(catalog.digest.startsWith('sha256:'), 'Domain recipes: catalog digest is generated');
  equal(catalog.customerOwnsSystemOfRecord, true, 'Domain recipes: customer owns system of record');
  equal(catalog.nativeConnectorCoverage, false, 'Domain recipes: no native connector coverage');
  equal(catalog.customerDeploymentProven, false, 'Domain recipes: no customer deployment proof');
  equal(catalog.recordsSystem, false, 'Domain recipes: no records system claim');
  equal(catalog.workflowWorkspace, false, 'Domain recipes: no workflow workspace claim');
  equal(catalog.productionReady, false, 'Domain recipes: no production readiness claim');

  for (const target of DOMAIN_CONSEQUENCE_RECIPE_TARGETS) {
    const found = recipe(catalog.recipes, target);
    ok(found.digest.startsWith('sha256:'), `Domain recipes: ${target} has a digest`);
    equal(found.customerOwnsSystemOfRecord, true, `Domain recipes: ${target} keeps system-of-record ownership with customer`);
    equal(found.nativeConnectorImplemented, false, `Domain recipes: ${target} does not claim native connector`);
    equal(found.customerDeploymentRequired, true, `Domain recipes: ${target} requires customer deployment`);
    equal(found.approvalRequired, true, `Domain recipes: ${target} requires approval`);
    equal(found.autoEnforce, false, `Domain recipes: ${target} does not auto-enforce`);
    equal(found.rawPayloadStored, false, `Domain recipes: ${target} does not store raw payload`);
    equal(found.recordsSystem, false, `Domain recipes: ${target} does not claim records system role`);
    equal(found.workflowWorkspace, false, `Domain recipes: ${target} does not claim workflow workspace role`);
    equal(found.productionReady, false, `Domain recipes: ${target} does not claim production readiness`);
  }
}

function testRecipesPreserveRequiredFieldsAndPlacement(): void {
  const catalog = createDomainConsequenceRecipeCatalog({
    generatedAt: '2026-05-17T14:10:00.000Z',
  });
  const requiredFields = [
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

  for (const item of catalog.recipes) {
    for (const field of requiredFields) {
      ok(
        item.normalizedFields.includes(field),
        `Domain recipes: ${item.targetSystem} includes normalized field ${field}`,
      );
    }
    ok(item.insertionPoint.includes('Before'), `Domain recipes: ${item.targetSystem} insertion point is pre-side-effect`);
    ok(item.attestorPlacement.includes('Attestor'), `Domain recipes: ${item.targetSystem} names Attestor placement`);
    ok(item.protectedConsequences.length >= 4, `Domain recipes: ${item.targetSystem} lists concrete consequences`);
    ok(item.evidenceRefs.length >= 4, `Domain recipes: ${item.targetSystem} lists evidence refs`);
    ok(item.approvalPath.includes('approval/dismiss feedback event'), `Domain recipes: ${item.targetSystem} binds feedback event`);
    ok(item.receiptRefs.length >= 3, `Domain recipes: ${item.targetSystem} lists receipt refs`);
    ok(item.replayAndIdempotencyRefs.length >= 3, `Domain recipes: ${item.targetSystem} lists replay/idempotency refs`);
    ok(item.riskSignals.length >= 4, `Domain recipes: ${item.targetSystem} lists risk signals`);
    ok(item.implementationSteps.length >= 4, `Domain recipes: ${item.targetSystem} lists implementation steps`);
    ok(item.noGoBoundary.startsWith('No '), `Domain recipes: ${item.targetSystem} no-go is explicit`);
    ok(item.primarySourceUrl.startsWith('https://'), `Domain recipes: ${item.targetSystem} uses HTTPS source`);
  }
}

function testSpecificRecipesAnchorDomainConsequences(): void {
  const catalog = createDomainConsequenceRecipeCatalog({
    generatedAt: '2026-05-17T14:20:00.000Z',
  });

  const coupa = recipe(catalog.recipes, 'coupa-approvals');
  equal(coupa.pattern, 'procurement-approval-gate', 'Domain recipes: Coupa uses procurement approval gate');
  includes(coupa.protectedConsequences.join('|'), 'purchase_order.approve', 'Domain recipes: Coupa covers purchase order approval');

  const sap = recipe(catalog.recipes, 'sap-s4hana-purchase-order');
  includes(sap.protectedConsequences.join('|'), 'purchase_order.send', 'Domain recipes: SAP covers purchase-order send');

  const snowflake = recipe(catalog.recipes, 'snowflake-cortex-agents');
  equal(snowflake.pattern, 'data-tool-gate', 'Domain recipes: Snowflake uses data tool gate');
  includes(snowflake.protectedConsequences.join('|'), 'customer.export', 'Domain recipes: Snowflake covers data export');

  const databricks = recipe(catalog.recipes, 'databricks-agent-tools');
  includes(databricks.protectedConsequences.join('|'), 'uc.function.execute', 'Domain recipes: Databricks covers UC function execution');

  const okta = recipe(catalog.recipes, 'okta-workflows-authority');
  includes(okta.protectedConsequences.join('|'), 'group.add_user', 'Domain recipes: Okta covers group membership changes');

  const entra = recipe(catalog.recipes, 'microsoft-entra-lifecycle-workflows');
  includes(entra.protectedConsequences.join('|'), 'access.assign', 'Domain recipes: Entra covers access assignment');

  const sailpoint = recipe(catalog.recipes, 'sailpoint-workflows');
  includes(sailpoint.protectedConsequences.join('|'), 'entitlement.change', 'Domain recipes: SailPoint covers entitlement change');

  const fhir = recipe(catalog.recipes, 'hl7-fhir-subscriptions');
  includes(fhir.protectedConsequences.join('|'), 'care_gap.notify', 'Domain recipes: FHIR covers care-gap notification');

  const cds = recipe(catalog.recipes, 'cds-hooks-clinical-decision-support');
  includes(cds.protectedConsequences.join('|'), 'prior_auth.prompt', 'Domain recipes: CDS Hooks covers prior-auth prompt');

  const claimCenter = recipe(catalog.recipes, 'guidewire-claimcenter-cloud-api');
  includes(claimCenter.protectedConsequences.join('|'), 'claim.adjust', 'Domain recipes: ClaimCenter covers claim adjustment');

  const policyCenter = recipe(catalog.recipes, 'guidewire-policycenter-cloud-api');
  includes(policyCenter.protectedConsequences.join('|'), 'policy.issue.prepare', 'Domain recipes: PolicyCenter covers policy issue preparation');
}

function testDescriptorDocsAndTrackersStayAligned(): void {
  const descriptor = domainConsequenceRecipeCatalogDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'domain-consequence-recipes.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const tracker = readProjectFile('docs', '02-architecture', 'attestor-unlock-source-of-truth.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.nativeConnectorCoverage, false, 'Domain recipes descriptor: native connector coverage is false');
  equal(descriptor.customerDeploymentProven, false, 'Domain recipes descriptor: customer deployment proof is false');
  equal(descriptor.recordsSystem, false, 'Domain recipes descriptor: records system is false');
  equal(descriptor.workflowWorkspace, false, 'Domain recipes descriptor: workflow workspace is false');
  equal(descriptor.productionReady, false, 'Domain recipes descriptor: productionReady is false');
  ok(descriptor.targetSystems.includes('guidewire-policycenter-cloud-api'), 'Domain recipes descriptor: PolicyCenter target is included');

  for (const expected of [
    '# Domain Consequence Recipes',
    'attestor.domain-consequence-recipes.v1',
    'Ramp spend and accounting API',
    'Brex Expenses API',
    'Coupa approvals',
    'SAP S/4HANA purchase order',
    'Snowflake Cortex Agents',
    'Databricks AI agent tools',
    'Okta Workflows authority changes',
    'Microsoft Entra Lifecycle Workflows',
    'SailPoint Workflows',
    'HL7 FHIR Subscriptions',
    'CDS Hooks clinical decision support',
    'Guidewire ClaimCenter Cloud API',
    'Guidewire PolicyCenter Cloud API',
    'native connector coverage = false',
    'recordsSystem = false',
    'workflowWorkspace = false',
    'productionReady = false',
  ]) {
    includes(doc, expected, `Domain recipes doc: records ${expected}`);
  }

  for (const expected of [
    '| Complete | 26 |',
    '| Remaining | 0 |',
    '| 24 | complete | General Crypto Transaction Gate |',
    '| 25 | complete | Spend, procurement, data, IAM, health, and insurance recipes |',
    '| 26 | complete | Pilot readiness packet |',
    'live customer pilot execution',
  ]) {
    includes(masterPlan, expected, `Domain recipes: master plan records ${expected}`);
  }

  includes(
    tracker,
    'Step 25 records the Domain consequence recipes',
    'Domain recipes: unlock tracker points to Step 25 completion',
  );
  includes(
    tracker,
    'Step 26 records the Pilot readiness packet',
    'Domain recipes: unlock tracker points to Step 26 completion',
  );
  includes(
    systemOverview,
    '[Domain consequence recipes](domain-consequence-recipes.md)',
    'Domain recipes: system overview links doc',
  );
  includes(
    readme,
    '[How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md)',
    'Domain recipes: README links the grouped integration entry point',
  );
  includes(
    ledger,
    '### 67. Domain Consequence Recipes',
    'Domain recipes: research ledger entry is present',
  );
  equal(
    packageJson.scripts['test:domain-consequence-recipes'],
    'tsx tests/domain-consequence-recipes.test.ts',
    'Domain recipes: package script is registered',
  );
  excludes(
    doc,
    /\bnative connector is implemented\b|\bproduction-ready because of recipes\b|\bEHR integration is implemented\b|\binsurance core system is implemented\b/iu,
    'Domain recipes doc: does not overclaim connector, clinical, insurance, or production readiness',
  );
}

testCatalogCoversDomainTargets();
testRecipesPreserveRequiredFieldsAndPlacement();
testSpecificRecipesAnchorDomainConsequences();
testDescriptorDocsAndTrackersStayAligned();

console.log(`Domain consequence recipes tests: ${passed} passed, 0 failed`);
