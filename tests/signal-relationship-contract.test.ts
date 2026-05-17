import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  signalRelationshipContractDescriptor,
  type SignalDirectedRelationship,
  type SignalInteractionRule,
  type SignalRelationshipFabricContract,
  type SignalRelationshipSignal,
  type SignalSymmetricRelationship,
  type SignalUnaryRelationship,
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

function testDescriptorRecordsCategoryBoundSignalKinds(): void {
  const descriptor = signalRelationshipContractDescriptor();

  equal(
    descriptor.version,
    SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    'Signal relationship: descriptor exposes version',
  );
  equal(
    descriptor.categoryBoundSignalKindsRequired,
    true,
    'Signal relationship: category-bound signal kinds are required',
  );

  for (const expected of [
    'verdict',
    'observation',
    'gap',
    'boundary',
    'context',
    'measurement',
  ]) {
    ok(
      descriptor.categories.includes(expected),
      `Signal relationship: category ${expected} is registered`,
    );
  }

  ok(
    descriptor.kindsByCategory.verdict.includes('hard_floor'),
    'Signal relationship: hard_floor is a verdict kind',
  );
  ok(
    !descriptor.kindsByCategory.verdict.includes('evidence_gap' as never),
    'Signal relationship: evidence_gap is not a verdict kind',
  );
  ok(
    descriptor.kindsByCategory.gap.includes('evidence_gap'),
    'Signal relationship: evidence_gap is a gap kind',
  );
  ok(
    descriptor.kindsByCategory.measurement.includes('measurement_degraded_signal'),
    'Signal relationship: measurement degraded is a measurement kind',
  );
}

function testDescriptorRecordsRelationshipDirectionality(): void {
  const descriptor = signalRelationshipContractDescriptor();

  equal(descriptor.directionalityRequired, true, 'Signal relationship: directionality is required');
  equal(descriptor.unaryRelationshipsAllowed, true, 'Signal relationship: unary relationships are allowed');
  equal(
    descriptor.relationshipEvaluationBeforeFusion,
    true,
    'Signal relationship: relationships must be evaluated before fusion',
  );

  for (const expected of ['confirms', 'contradicts', 'duplicates']) {
    ok(
      descriptor.symmetricRelationshipKinds.includes(expected),
      `Signal relationship: ${expected} is symmetric`,
    );
  }

  for (const expected of [
    'overrides',
    'depends_on',
    'modulates',
    'escalates',
    'suppresses',
  ]) {
    ok(
      descriptor.directedRelationshipKinds.includes(expected),
      `Signal relationship: ${expected} is directed`,
    );
  }

  ok(
    descriptor.unaryRelationshipKinds.includes('requires_review'),
    'Signal relationship: requires_review is unary',
  );
}

function testNoAuthorityAndRawMaterialInvariants(): void {
  const descriptor = signalRelationshipContractDescriptor();

  equal(descriptor.interactionRulesMustBeMonotone, true, 'Signal relationship: rules must be monotone');
  equal(descriptor.grantsAuthority, false, 'Signal relationship: descriptor cannot grant authority');
  equal(descriptor.activatesEnforcement, false, 'Signal relationship: descriptor cannot activate enforcement');
  equal(descriptor.autoEnforce, false, 'Signal relationship: descriptor cannot auto-enforce');
  equal(descriptor.productionReady, false, 'Signal relationship: descriptor is not production readiness');
  equal(descriptor.rawPayloadStored, false, 'Signal relationship: descriptor stores no raw payload');
  equal(descriptor.rawPromptStored, false, 'Signal relationship: descriptor stores no raw prompt');
  equal(descriptor.rawProviderBodyStored, false, 'Signal relationship: descriptor stores no raw provider body');
}

function testTypedSignalsRelationshipsAndRules(): void {
  const hardFloorSignal: SignalRelationshipSignal<'verdict'> = {
    signalId: 'signal-hard-floor',
    category: 'verdict',
    kind: 'hard_floor',
    sourcePlane: 'tier-1-hard-gate',
    authorityMode: 'hard-floor',
    envelopeRefDigest: digestA,
    evidenceRefs: [{ kind: 'evidence', digest: digestB }],
    readModelRefs: [{ modelKind: 'policy', digest: digestA }],
    appliesToConsequenceClasses: ['financial', 'programmable-money'],
    knows: ['policy hard floor was triggered'],
    cannotKnow: ['whether downstream execution occurred'],
    confidence: 1,
    uncertainty: 0,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  };

  const gapSignal: SignalRelationshipSignal<'gap'> = {
    signalId: 'signal-evidence-gap',
    category: 'gap',
    kind: 'evidence_gap',
    sourcePlane: 'policy-foundry',
    authorityMode: 'advisory',
    envelopeRefDigest: digestA,
    evidenceRefs: [{ kind: 'trace', digest: digestB }],
    readModelRefs: [{ modelKind: 'shadow-baseline', digest: digestB }],
    appliesToConsequenceClasses: ['financial'],
    knows: ['expected evidence is absent'],
    cannotKnow: ['whether the user intended the omission'],
    confidence: 0.8,
    uncertainty: 0.2,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  };

  const symmetric: SignalSymmetricRelationship = {
    relationshipId: 'rel-confirm-gap',
    kind: 'confirms',
    shape: 'symmetric',
    leftSignalId: hardFloorSignal.signalId,
    rightSignalId: gapSignal.signalId,
    evidenceRefs: [{ kind: 'schema', digest: digestA }],
    reasonCodes: ['independent-evidence-alignment'],
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };

  const directed: SignalDirectedRelationship = {
    relationshipId: 'rel-hard-floor-overrides-gap',
    kind: 'overrides',
    shape: 'directed',
    sourceSignalId: hardFloorSignal.signalId,
    targetSignalId: gapSignal.signalId,
    evidenceRefs: [{ kind: 'authority', digest: digestA }],
    reasonCodes: ['hard-floor-preserved'],
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };

  const unary: SignalUnaryRelationship = {
    relationshipId: 'rel-gap-review',
    kind: 'requires_review',
    shape: 'unary',
    signalId: gapSignal.signalId,
    evidenceRefs: [{ kind: 'trace', digest: digestB }],
    reasonCodes: ['missing-required-evidence'],
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };

  const rule: SignalInteractionRule = {
    ruleId: 'rule-require-review',
    relationshipKind: 'requires_review',
    effect: 'raise-review-pressure',
    evidenceRefs: [{ kind: 'runbook', digest: digestA }],
    reasonCodes: ['review-only-interaction'],
    noLoosening: true,
    mayGrantAuthority: false,
    mayActivateEnforcement: false,
    mayLowerRequiredReview: false,
    mayStoreRawMaterial: false,
    productionReady: false,
  };

  const contract: SignalRelationshipFabricContract = {
    version: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    envelopeRefDigest: digestA,
    signals: [hardFloorSignal, gapSignal],
    relationships: [symmetric, directed, unary],
    interactionRules: [rule],
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  };

  equal(contract.signals.length, 2, 'Signal relationship: typed signals can compose');
  equal(contract.relationships[1]?.shape, 'directed', 'Signal relationship: directed shape is preserved');
  equal(rule.noLoosening, true, 'Signal relationship: interaction rule cannot loosen');
  equal(contract.grantsAuthority, false, 'Signal relationship: contract cannot grant authority');
}

function testDocsOverviewAndPackageScriptStayAligned(): void {
  const contractDoc = readProjectFile(
    'docs',
    '02-architecture',
    'signal-relationship-contract.md',
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
    '# Signal Relationship Contract',
    'attestor.signal-relationship-contract.v1',
    'SignalRelationshipSignal',
    'SignalRelationship',
    'SignalInteractionRule',
    'SignalRelationshipFabricContract',
    'signalRelationshipContractDescriptor()',
    'Signals are not a flat enum.',
    'Direction is part of the type:',
    'requires_review',
    'noLoosening = true',
    'mayGrantAuthority = false',
    'mayActivateEnforcement = false',
    'STPA / STAMP',
    'NRC fault tree work',
    'Pearl causality',
    'that relationship-aware hazard fusion is implemented',
  ]) {
    includes(contractDoc, expected, `Signal relationship docs: records ${expected}`);
  }

  includes(
    overview,
    '| 02 | complete | Signal Relationship Contract |',
    'Consequence runtime assurance overview: Step 02 is marked complete',
  );
  includes(
    overview,
    'src/consequence-admission/signal-relationship-contract.ts',
    'Consequence runtime assurance overview: implementation file is recorded',
  );
  equal(
    packageJson.scripts['test:signal-relationship-contract'],
    'tsx tests/signal-relationship-contract.test.ts',
    'Signal relationship: package script is registered',
  );
}

testDescriptorRecordsCategoryBoundSignalKinds();
testDescriptorRecordsRelationshipDirectionality();
testNoAuthorityAndRawMaterialInvariants();
testTypedSignalsRelationshipsAndRules();
testDocsOverviewAndPackageScriptStayAligned();

console.log(`Signal relationship contract tests: ${passed} passed, 0 failed`);
