import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
  consequenceEnvelopeContractDescriptor,
  type ConsequenceEnvelopeContract,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;

function testDescriptorRecordsRequiredDimensions(): void {
  const descriptor = consequenceEnvelopeContractDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
    'Consequence envelope: descriptor exposes version',
  );

  for (const expected of [
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
  ]) {
    ok(
      descriptor.requiredFields.includes(expected),
      `Consequence envelope: required field ${expected} is registered`,
    );
  }

  for (const expected of [
    'financial',
    'data-movement',
    'authority-change',
    'operational-execution',
    'programmable-money',
    'health-claims',
  ]) {
    ok(
      descriptor.consequenceClasses.includes(expected),
      `Consequence envelope: consequence class ${expected} is registered`,
    );
  }

  ok(
    descriptor.reversibilityClasses.includes('irreversible'),
    'Consequence envelope: irreversibility is a first-order dimension',
  );
  ok(
    descriptor.blastRadiusEstimates.includes('systemic'),
    'Consequence envelope: systemic blast radius is representable',
  );
  ok(
    descriptor.actorAuthorityClasses.includes('break-glass'),
    'Consequence envelope: break-glass authority is explicit context',
  );
  ok(
    descriptor.priorChainRelationships.includes('authority-predecessor'),
    'Consequence envelope: authority predecessor chain is representable',
  );
}

function testDescriptorCannotGrantAuthorityOrStoreRawMaterial(): void {
  const descriptor = consequenceEnvelopeContractDescriptor();

  equal(descriptor.digestOnlyRefsRequired, true, 'Consequence envelope: digest-only refs are required');
  equal(descriptor.relationshipFabricInput, true, 'Consequence envelope: descriptor marks fabric input');
  equal(descriptor.grantsAuthority, false, 'Consequence envelope: descriptor cannot grant authority');
  equal(descriptor.activatesEnforcement, false, 'Consequence envelope: descriptor cannot activate enforcement');
  equal(descriptor.autoEnforce, false, 'Consequence envelope: descriptor cannot auto-enforce');
  equal(descriptor.productionReady, false, 'Consequence envelope: descriptor is not production readiness');

  for (const [field, value] of Object.entries({
    rawPayloadStored: descriptor.rawPayloadStored,
    rawPromptStored: descriptor.rawPromptStored,
    rawToolPayloadStored: descriptor.rawToolPayloadStored,
    rawProviderBodyStored: descriptor.rawProviderBodyStored,
    rawCustomerIdentifierStored: descriptor.rawCustomerIdentifierStored,
    rawTenantIdentifierStored: descriptor.rawTenantIdentifierStored,
    rawWalletMaterialStored: descriptor.rawWalletMaterialStored,
    rawPaymentDetailStored: descriptor.rawPaymentDetailStored,
    rawDownstreamBodyStored: descriptor.rawDownstreamBodyStored,
    rawPrivateThresholdStored: descriptor.rawPrivateThresholdStored,
  })) {
    equal(value, false, `Consequence envelope: ${field} is false`);
  }
}

function testContractShapeAllowsDigestOnlyContext(): void {
  const envelope: ConsequenceEnvelopeContract = {
    version: CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
    sourceEventRef: { kind: 'shadow-event', digest: digestA },
    canonicalActionType: {
      value: 'refund.create',
      source: 'action-surface-graph',
      registryRefDigest: digestB,
    },
    consequenceClass: 'financial',
    reversibilityClass: 'bounded',
    blastRadiusEstimate: 'tenant',
    tenantContext: {
      tenantRefDigest: digestA,
      maturityClass: 'shadow-observed',
      historyDepthClass: 'medium',
      coverageRefDigest: digestB,
    },
    actorContext: {
      actorRefDigest: digestC,
      authorityClass: 'delegated',
      authorityRefDigest: digestD,
      reviewerRefDigest: null,
    },
    timingContext: {
      requestedAt: '2026-05-17T10:00:00.000Z',
      freshnessWindowSeconds: 300,
      freshnessPosture: 'fresh',
      deadlineAt: null,
    },
    priorChain: [
      {
        relationship: 'same-actor',
        eventRefDigest: digestA,
        distance: 1,
      },
    ],
    evidenceRefs: [{ kind: 'evidence', digest: digestB }],
    authorityRefs: [{ kind: 'authority', digest: digestD }],
    policyScope: {
      policyBundleRefDigest: digestA,
      policyScopeRefDigest: digestB,
      rolloutRefDigest: null,
      candidateRefDigest: null,
    },
    targetSystemRef: { kind: 'target-system', digest: digestC },
    resourceRefs: [{ kind: 'resource', digest: digestD }],
    counterpartyRefs: [{ kind: 'counterparty', digest: digestA }],
    rawMaterialBoundary: {
      policy: 'digest-only',
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
    },
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };

  equal(envelope.sourceEventRef.kind, 'shadow-event', 'Consequence envelope: source event is digest referenced');
  equal(envelope.rawMaterialBoundary.rawPromptStored, false, 'Consequence envelope: raw prompt is forbidden');
  equal(envelope.grantsAuthority, false, 'Consequence envelope: instance cannot grant authority');
}

function testDocsOverviewAndPackageScriptStayAligned(): void {
  const contractDoc = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-envelope-contract.md',
  );
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '# Consequence Envelope Contract',
    'attestor.consequence-envelope-contract.v1',
    'ConsequenceEnvelopeContract',
    'consequenceEnvelopeContractDescriptor()',
    'grantsAuthority = false',
    'activatesEnforcement = false',
    'autoEnforce = false',
    'productionReady = false',
    'rawPromptStored = false',
    'rawWalletMaterialStored = false',
    'STPA / STAMP',
    'NASA runtime assurance',
    'NIST AI RMF',
    'Google SRE monitoring',
    'typed signal extraction',
    'relationship activation',
  ]) {
    includes(contractDoc, expected, `Consequence envelope docs: records ${expected}`);
  }

  includes(
    overview,
    '| 01 | complete | Consequence Envelope Contract |',
    'Consequence runtime assurance overview: Step 01 is marked complete',
  );
  includes(
    overview,
    'src/consequence-admission/consequence-envelope-contract.ts',
    'Consequence runtime assurance overview: implementation file is recorded',
  );
  equal(
    packageJson.scripts['test:consequence-envelope-contract'],
    'tsx tests/consequence-envelope-contract.test.ts',
    'Consequence envelope: package script is registered',
  );
}

testDescriptorRecordsRequiredDimensions();
testDescriptorCannotGrantAuthorityOrStoreRawMaterial();
testContractShapeAllowsDigestOnlyContext();
testDocsOverviewAndPackageScriptStayAligned();

console.log(`Consequence envelope contract tests: ${passed} passed, 0 failed`);
