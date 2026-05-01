import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_CONTROL_REQUIREMENTS,
  CONSEQUENCE_ADMISSION_DOMAINS,
  CONSEQUENCE_ADMISSION_TAXONOMY,
  consequenceAdmissionDescriptor,
  consequenceAdmissionDomainsForKind,
  consequenceAdmissionDomainProfile,
  consequenceAdmissionProfilesForKind,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected);
  passed += 1;
}

function testDescriptorExposesGatewayTaxonomy(): void {
  const descriptor = consequenceAdmissionDescriptor();

  deepEqual(
    descriptor.consequenceDomains,
    CONSEQUENCE_ADMISSION_DOMAINS,
    'Consequence taxonomy: descriptor exposes domain vocabulary',
  );
  deepEqual(
    descriptor.controlRequirements,
    CONSEQUENCE_ADMISSION_CONTROL_REQUIREMENTS,
    'Consequence taxonomy: descriptor exposes control requirements',
  );
  equal(
    descriptor.taxonomy['programmable-money'].minimumRiskClass,
    'R3',
    'Consequence taxonomy: programmable money has a high-consequence risk floor',
  );
  ok(
    descriptor.consequenceKinds.includes('wallet-call'),
    'Consequence taxonomy: descriptor includes crypto execution handoff kinds',
  );
  ok(
    descriptor.riskClasses.includes('custom'),
    'Consequence taxonomy: descriptor keeps custom risk for customer-defined surfaces',
  );
}

function testDomainProfilesKeepConcreteControlLanguage(): void {
  const moneyMovement = consequenceAdmissionDomainProfile('money-movement');
  const authorityChange = consequenceAdmissionDomainProfile('authority-change');
  const dataDisclosure = consequenceAdmissionDomainProfile('data-disclosure');
  const decisionSupport = consequenceAdmissionDomainProfile('decision-support');

  ok(
    moneyMovement.controlRequirements.includes('non-bypassable-integration'),
    'Consequence taxonomy: money movement requires non-bypassable downstream integration',
  );
  ok(
    moneyMovement.controlRequirements.includes('replay-protection'),
    'Consequence taxonomy: money movement requires replay protection',
  );
  equal(
    authorityChange.minimumRiskClass,
    'R4',
    'Consequence taxonomy: authority change has the strongest default risk floor',
  );
  ok(
    dataDisclosure.controlRequirements.includes('data-minimization'),
    'Consequence taxonomy: data disclosure requires minimization',
  );
  equal(
    decisionSupport.minimumRiskClass,
    'R0',
    'Consequence taxonomy: advisory decision support stays lower risk by default',
  );
}

function testKindToDomainMappingKeepsFinanceCryptoAndOpsCoherent(): void {
  deepEqual(
    consequenceAdmissionDomainsForKind('approval'),
    ['programmable-money'],
    'Consequence taxonomy: token approvals are programmable-money consequences',
  );
  deepEqual(
    consequenceAdmissionDomainsForKind('agent-payment'),
    ['programmable-money', 'money-movement'],
    'Consequence taxonomy: agent payments bridge crypto and money movement',
  );
  deepEqual(
    consequenceAdmissionDomainsForKind('record'),
    ['financial-record', 'regulated-filing', 'data-disclosure'],
    'Consequence taxonomy: records can belong to finance, filing, or data disclosure',
  );
  ok(
    consequenceAdmissionProfilesForKind('action').some(
      (profile) => profile.id === 'system-operation',
    ),
    'Consequence taxonomy: generic actions can be system-operation consequences',
  );
}

function testDocsAndScriptsExposeTheTaxonomy(): void {
  const readme = readProjectFile('README.md');
  const taxonomy = readProjectFile('docs', '02-architecture', 'consequence-taxonomy.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const purpose = readProjectFile('docs', '01-overview', 'purpose.md');
  const useCases = readProjectFile('docs', '01-overview', 'what-you-can-do.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    readme,
    'docs/02-architecture/consequence-taxonomy.md',
    'Consequence taxonomy: README links the architecture taxonomy',
  );
  includes(
    taxonomy,
    'Attestor controls proposed consequences, not generic tool calls.',
    'Consequence taxonomy: doc opens on the consequence boundary',
  );
  includes(
    taxonomy,
    'The taxonomy comes before the pack.',
    'Consequence taxonomy: doc keeps pack status separate from consequence classification',
  );
  includes(
    systemOverview,
    'The consequence domain vocabulary lives in [Consequence taxonomy](consequence-taxonomy.md).',
    'Consequence taxonomy: system overview links the taxonomy',
  );
  includes(
    purpose,
    'For the consequence domain vocabulary, use [Consequence taxonomy](../02-architecture/consequence-taxonomy.md).',
    'Consequence taxonomy: purpose points to the taxonomy',
  );
  includes(
    useCases,
    'For the shared consequence-domain vocabulary behind these examples, see [Consequence taxonomy](../02-architecture/consequence-taxonomy.md).',
    'Consequence taxonomy: use-case map points to the taxonomy',
  );
  equal(
    packageJson.scripts['test:consequence-taxonomy'],
    'tsx tests/consequence-taxonomy.test.ts',
    'Consequence taxonomy: focused test script is exposed',
  );
}

testDescriptorExposesGatewayTaxonomy();
testDomainProfilesKeepConcreteControlLanguage();
testKindToDomainMappingKeepsFinanceCryptoAndOpsCoherent();
testDocsAndScriptsExposeTheTaxonomy();

ok(
  Object.keys(CONSEQUENCE_ADMISSION_TAXONOMY).length >= 10,
  'Consequence taxonomy: domain vocabulary covers all current gateway domains',
);

console.log(`Consequence taxonomy tests: ${passed} passed, 0 failed`);
