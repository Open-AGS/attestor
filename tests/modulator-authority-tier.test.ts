import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MODULATOR_AUTHORITY_TIER_VERSION,
  modulatorAuthorityTierDescriptor,
  type ContextModulator,
  type ModulatorAuthorityRule,
  type ModulatorAuthorityTierContract,
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

function testDescriptorRecordsDimensionsAndEffects(): void {
  const descriptor = modulatorAuthorityTierDescriptor();

  equal(
    descriptor.version,
    MODULATOR_AUTHORITY_TIER_VERSION,
    'Modulator authority: descriptor exposes version',
  );
  equal(
    descriptor.signalRelationshipContractVersion,
    'attestor.signal-relationship-contract.v1',
    'Modulator authority: descriptor links signal relationship contract',
  );
  equal(
    descriptor.layerOpinionSchemaVersion,
    'attestor.layer-opinion-schema.v1',
    'Modulator authority: descriptor links LayerOpinion schema',
  );

  for (const expected of [
    'reversibility',
    'blast-radius',
    'tenant-maturity',
    'coverage',
    'freshness',
  ]) {
    ok(
      descriptor.dimensions.includes(expected),
      `Modulator authority: dimension ${expected} is registered`,
    );
  }

  for (const expected of [
    'increase-review-pressure',
    'increase-block-pressure',
    'raise-evidence-requirement',
    'preserve-hard-floor',
    'mark-context-degraded',
    'mark-coverage-insufficient',
    'mark-freshness-risk',
    'narrow-scope-only',
  ]) {
    ok(
      descriptor.effects.includes(expected),
      `Modulator authority: effect ${expected} is registered`,
    );
  }
}

function testDescriptorCannotLoosenOrOverrideHardFloor(): void {
  const descriptor = modulatorAuthorityTierDescriptor();

  equal(descriptor.contextOnly, true, 'Modulator authority: descriptor is context-only');
  equal(descriptor.monotoneOnly, true, 'Modulator authority: descriptor is monotone-only');
  equal(descriptor.preservesHardFloor, true, 'Modulator authority: hard floors are preserved');
  equal(descriptor.relationshipFabricInput, true, 'Modulator authority: feeds relationship fabric');
  equal(descriptor.grantsAuthority, false, 'Modulator authority: cannot grant authority');
  equal(descriptor.activatesEnforcement, false, 'Modulator authority: cannot activate enforcement');
  equal(descriptor.autoEnforce, false, 'Modulator authority: cannot auto-enforce');
  equal(descriptor.mayLowerRequiredReview, false, 'Modulator authority: cannot lower review');
  equal(descriptor.maySuppressHardDeny, false, 'Modulator authority: cannot suppress hard deny');
  equal(descriptor.mayMarkSafe, false, 'Modulator authority: cannot mark safe');
  equal(descriptor.mayStoreRawMaterial, false, 'Modulator authority: cannot store raw material');
  equal(descriptor.productionReady, false, 'Modulator authority: descriptor is not production readiness');
  equal(descriptor.rawPayloadStored, false, 'Modulator authority: no raw payload');
  equal(descriptor.rawPromptStored, false, 'Modulator authority: no raw prompt');
  equal(descriptor.rawProviderBodyStored, false, 'Modulator authority: no raw provider body');
}

function testModulatorContractShapeIsContextOnly(): void {
  const modulator: ContextModulator = {
    modulatorId: 'modulator-irreversible-review',
    dimension: 'reversibility',
    authorityClass: 'tightening-only',
    effect: 'increase-review-pressure',
    strength: 'high',
    inputSource: 'consequence-envelope',
    envelopeRefDigest: digestA,
    context: {
      reversibilityClass: 'irreversible',
      blastRadiusEstimate: 'tenant',
      tenantMaturityClass: 'pilot',
      coveragePosture: 'medium',
      freshnessPosture: 'fresh',
      contextFit: 'high',
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestB }],
    readModelRefs: [{ modelKind: 'policy', digest: digestA }],
    reasonCodes: ['irreversible-consequence-review-pressure'],
    noLoosening: true,
    preservesHardFloor: true,
    mayGrantAuthority: false,
    mayActivateEnforcement: false,
    autoEnforce: false,
    mayLowerRequiredReview: false,
    maySuppressHardDeny: false,
    mayMarkSafe: false,
    mayStoreRawMaterial: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  };

  const rule: ModulatorAuthorityRule = {
    ruleId: 'rule-reversibility-tightening',
    dimension: 'reversibility',
    allowedEffects: ['increase-review-pressure', 'preserve-hard-floor'],
    allowedAuthorityClasses: ['tightening-only', 'review-pressure-only'],
    reasonCodes: ['reversibility-can-only-tighten'],
    noLoosening: true,
    preservesHardFloor: true,
    mayGrantAuthority: false,
    mayActivateEnforcement: false,
    autoEnforce: false,
    mayLowerRequiredReview: false,
    maySuppressHardDeny: false,
    mayMarkSafe: false,
    productionReady: false,
  };

  const contract: ModulatorAuthorityTierContract = {
    version: MODULATOR_AUTHORITY_TIER_VERSION,
    envelopeRefDigest: digestA,
    modulators: [modulator],
    rules: [rule],
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  };

  equal(contract.modulators[0]?.context.reversibilityClass, 'irreversible', 'Modulator authority: context snapshot is typed');
  equal(contract.modulators[0]?.noLoosening, true, 'Modulator authority: instance cannot loosen');
  equal(contract.rules[0]?.preservesHardFloor, true, 'Modulator authority: rule preserves hard floor');
  equal(contract.grantsAuthority, false, 'Modulator authority: contract cannot grant authority');
}

function testDocsOverviewAndPackageScriptStayAligned(): void {
  const contractDoc = readProjectFile(
    'docs',
    '02-architecture',
    'modulator-authority-tier.md',
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
    '# Modulator Authority Tier',
    'attestor.modulator-authority-tier.v1',
    'ContextModulator',
    'ModulatorAuthorityRule',
    'ModulatorAuthorityTierContract',
    'modulatorAuthorityTierDescriptor()',
    'reversibility',
    'blast-radius',
    'tenant-maturity',
    'coverage',
    'freshness',
    'preservesHardFloor = true',
    'maySuppressHardDeny = false',
    'mayMarkSafe = false',
    'STPA / STAMP',
    'NASA runtime assurance',
    'NIST AI RMF',
    'Google SRE',
    'This is a types-only shape for context',
    'It does not decide whether an action can run',
    'These dimensions are inputs to later fabric/fusion work',
  ]) {
    includes(contractDoc, expected, `Modulator authority docs: records ${expected}`);
  }

  includes(
    overview,
    '| 04 | complete | Modulator authority tier |',
    'Consequence runtime assurance overview: Step 04 is marked complete',
  );
  includes(
    overview,
    'src/consequence-admission/modulator-authority-tier.ts',
    'Consequence runtime assurance overview: implementation file is recorded',
  );
  equal(
    packageJson.scripts['test:modulator-authority-tier'],
    'tsx tests/modulator-authority-tier.test.ts',
    'Modulator authority: package script is registered',
  );
}

testDescriptorRecordsDimensionsAndEffects();
testDescriptorCannotLoosenOrOverrideHardFloor();
testModulatorContractShapeIsContextOnly();
testDocsOverviewAndPackageScriptStayAligned();

console.log(`Modulator authority tier tests: ${passed} passed, 0 failed`);
