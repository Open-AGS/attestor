import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testMatrixExistsAndKeepsOneEngine(): void {
  const matrix = readProjectFile(
    'docs',
    '02-architecture',
    'target-system-compatibility-matrix.md',
  );

  for (const expected of [
    '# Target-System Compatibility Matrix',
    'not a native connector claim',
    'Attestor should integrate by consequence grammar, not by vendor shape.',
    'The compatible insertion point is the last customer-controlled edge before a',
    'Crypto is a domain adapter, not a wallet/custody/exchange/broadcaster.',
    'CRM/support, ITSM/workflow, data/IAM, procurement/spend, health/insurance, and',
  ]) {
    includes(matrix, expected, `Compatibility matrix: records ${expected}`);
  }

  excludes(
    matrix,
    /\bSalesforce Attestor\b|\bCrypto Attestor\b|\bServiceNow Attestor\b/u,
    'Compatibility matrix: does not introduce vendor or domain product identities',
  );
}

function testMatrixRecordsContractDimensions(): void {
  const matrix = readProjectFile(
    'docs',
    '02-architecture',
    'target-system-compatibility-matrix.md',
  );

  for (const expected of [
    '| Insertion point | Named pre-side-effect edge',
    '| Consequence identity | `targetSystem`, `actionName`, `actionKind`, `consequenceClass`',
    '| Tenant and actor binding | Tenant reference digest',
    '| Resource and payload boundary | Resource digest, data class',
    '| Evidence refs | Proof references for the business fact',
    '| Approval and review | Whether the target action can be admitted',
    '| Receipt | Downstream receipt',
    '| Replay and idempotency | Idempotency key digest',
    '| No-go | Explicit boundary',
    'rawMaterialPolicy',
  ]) {
    includes(matrix, expected, `Compatibility matrix: contract dimension ${expected} is recorded`);
  }
}

function testMatrixCoversTargetFamilies(): void {
  const matrix = readProjectFile(
    'docs',
    '02-architecture',
    'target-system-compatibility-matrix.md',
  );

  for (const expected of [
    'Salesforce Agentforce',
    'Microsoft Copilot Studio / Power Platform',
    'ServiceNow IntegrationHub',
    'Workato Agent Studio',
    'MuleSoft / Agentforce API Catalog',
    'n8n',
    'Zapier AI Actions / Zapier MCP direction',
    'Camunda Agentic Orchestration',
    'Snowflake Cortex Agents',
    'Databricks Mosaic AI / Agent Framework',
    'Okta Workflows',
    'Microsoft Entra Lifecycle Workflows / Extensions',
    'Fireblocks',
    'BitGo',
    'Coinbase CDP Policy Engine',
    'Safe Transaction Service',
    'OpenZeppelin Defender',
    'Coupa',
    'SAP S/4HANA procurement/workflow',
    'Health / FHIR / clinical workflow',
  ]) {
    includes(matrix, expected, `Compatibility matrix: target family ${expected} is covered`);
  }
}

function testMatrixRecordsSourcesAndNoClaims(): void {
  const matrix = readProjectFile(
    'docs',
    '02-architecture',
    'target-system-compatibility-matrix.md',
  );

  for (const expected of [
    'Salesforce Agentforce actions',
    'Microsoft Copilot Studio tools',
    'ServiceNow IntegrationHub',
    'Workato business approvals',
    'MuleSoft Agentforce API actions',
    'n8n human-in-the-loop tools',
    'Zapier AI Actions reference',
    'Camunda agentic orchestration',
    'Fireblocks transaction authorization policy',
    'BitGo policies overview',
    'Coinbase CDP Policy Engine',
    'Safe Transaction Service',
    'OpenZeppelin Defender transaction proposals',
    'Snowflake Cortex Agents REST API',
    'Databricks AI agent tools',
    'Okta Workflows connector building blocks',
    'Microsoft Entra Lifecycle Workflow extensibility',
    'Coupa approvals API',
    'SAP S/4HANA manage purchase orders',
    'HL7 FHIR Subscriptions',
    'native connector coverage',
    'live Salesforce, Microsoft, ServiceNow',
    'target-system certification or marketplace listing',
    'automatic policy activation',
  ]) {
    includes(matrix, expected, `Compatibility matrix: source/no-claim ${expected} is recorded`);
  }

  excludes(
    matrix,
    /\bproduction-ready\b(?![\s\S]{0,80}(not|without|until|claim|readiness|evidence))/iu,
    'Compatibility matrix: does not make an unqualified production-ready claim',
  );
}

function testTrackersAndScriptsAreUpdated(): void {
  const plan = readProjectFile(
    'docs',
    '02-architecture',
    'unified-shadow-to-policy-master-plan.md',
  );
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const integrationRecipes = readProjectFile('docs', '01-overview', 'customer-integration-recipes.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const targetMatrix = readProjectFile('docs', '02-architecture', 'target-system-compatibility-matrix.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '| Complete | 24 |',
    '| Remaining | 2 |',
    '| 13 | complete | Target-system compatibility matrix |',
    '| 14 | complete | Shadow event canonical schema |',
    '| 15 | complete | Action surface graph |',
    '| 16 | complete | Evidence state model |',
    '| 17 | complete | Policy Candidate PR contract |',
    '| 18 | complete | Active Question Engine |',
    '| 19 | complete | Counterexample replay generator |',
    'completion of steps 25-26',
    'Target-System Compatibility Matrix',
  ]) {
    includes(plan, expected, `Compatibility matrix: unified plan records ${expected}`);
  }

  includes(
    ledger,
    '### 55. Target-System Compatibility Matrix',
    'Compatibility matrix: research ledger entry is present',
  );
  includes(
    ledger,
    'tests/target-system-compatibility-matrix.test.ts',
    'Compatibility matrix: research ledger indexes the test',
  );
  includes(
    integrationRecipes,
    'target-system compatibility matrix](../02-architecture/target-system-compatibility-matrix.md)',
    'Compatibility matrix: customer recipes link the matrix',
  );
  includes(
    systemOverview,
    '[target-system compatibility matrix](target-system-compatibility-matrix.md)',
    'Compatibility matrix: system overview links the matrix',
  );
  includes(
    targetMatrix,
    '[action surface graph](action-surface-graph.md)',
    'Compatibility matrix: links the Step 15 action surface graph',
  );
  assert.equal(
    packageJson.scripts['test:target-system-compatibility-matrix'],
    'tsx tests/target-system-compatibility-matrix.test.ts',
    'Compatibility matrix: package script is registered',
  );
  passed += 1;
}

testMatrixExistsAndKeepsOneEngine();
testMatrixRecordsContractDimensions();
testMatrixCoversTargetFamilies();
testMatrixRecordsSourcesAndNoClaims();
testTrackersAndScriptsAreUpdated();

console.log(`Target-system compatibility matrix tests: ${passed} passed, 0 failed`);
