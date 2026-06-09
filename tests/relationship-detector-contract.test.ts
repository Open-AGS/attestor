import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RELATIONSHIP_DETECTOR_CONTRACT_VERSION,
  createRelationshipDetectorRule,
  detectSignalRelationships,
  relationshipDetectorDescriptor,
  type SignalRelationshipSignal,
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

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const digestE = `sha256:${'e'.repeat(64)}`;

function signal<Category extends SignalRelationshipSignal['category']>(
  input: {
    readonly id: string;
    readonly category: Category;
    readonly kind: SignalRelationshipSignal<Category>['kind'];
    readonly sourcePlane: SignalRelationshipSignal<Category>['sourcePlane'];
    readonly authorityMode: SignalRelationshipSignal<Category>['authorityMode'];
    readonly evidenceDigest: string;
    readonly readModelDigest?: string;
    readonly envelopeRefDigest?: string;
  },
): SignalRelationshipSignal<Category> {
  return {
    signalId: input.id,
    category: input.category,
    kind: input.kind,
    sourcePlane: input.sourcePlane,
    authorityMode: input.authorityMode,
    envelopeRefDigest: input.envelopeRefDigest ?? digestA,
    evidenceRefs: [{ kind: 'evidence', digest: input.evidenceDigest }],
    readModelRefs: [{ modelKind: 'policy', digest: input.readModelDigest ?? digestB }],
    appliesToConsequenceClasses: ['financial'],
    knows: ['test signal knows its bounded input'],
    cannotKnow: ['test signal cannot grant authority'],
    confidence: 0.7,
    uncertainty: 0.3,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  };
}

function testDescriptorRecordsNoAuthorityBoundaries(): void {
  const descriptor = relationshipDetectorDescriptor();

  equal(descriptor.version, RELATIONSHIP_DETECTOR_CONTRACT_VERSION, 'Relationship detector: descriptor version is explicit');
  equal(descriptor.signalRelationshipContractVersion, 'attestor.signal-relationship-contract.v1', 'Relationship detector: descriptor binds signal relationship contract');
  ok(descriptor.executionModes.includes('shadow-only'), 'Relationship detector: shadow-only execution mode is registered');
  ok(descriptor.outputModes.includes('relationships-and-interaction-rules'), 'Relationship detector: output mode is registered');
  ok(descriptor.ruleModes.includes('duplicate-evidence'), 'Relationship detector: duplicate-evidence rule is registered');
  ok(descriptor.ruleModes.includes('hard-floor-overrides-advisory'), 'Relationship detector: directed hard-floor rule is registered');
  equal(descriptor.builtInRuleCount, 8, 'Relationship detector: built-in rule count is explicit');
  equal(descriptor.sameEnvelopeOnly, true, 'Relationship detector: same-envelope boundary is explicit');
  equal(descriptor.relationshipEvaluationBeforeFusion, true, 'Relationship detector: runs before fusion');
  equal(descriptor.ruleBasedOnly, true, 'Relationship detector: v1 is rule-based only');
  equal(descriptor.learnedInferenceIncluded, false, 'Relationship detector: learned inference is excluded');
  equal(descriptor.correlationLearningIncluded, false, 'Relationship detector: correlation learning is excluded');
  equal(descriptor.fusionIncluded, false, 'Relationship detector: fusion is excluded');
  equal(descriptor.packetSigningIncluded, false, 'Relationship detector: packet signing is excluded');
  equal(descriptor.grantsAuthority, false, 'Relationship detector: cannot grant authority');
  equal(descriptor.canAdmit, false, 'Relationship detector: cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Relationship detector: cannot activate enforcement');
  equal(descriptor.autoEnforce, false, 'Relationship detector: cannot auto-enforce');
  equal(descriptor.productionReady, false, 'Relationship detector: descriptor is not production readiness');
}

function testBuiltInDetectionCreatesTypedRelationships(): void {
  const signals = [
    signal({
      id: 'signal.policy-gap',
      category: 'gap',
      kind: 'policy_gap',
      sourcePlane: 'policy-foundry',
      authorityMode: 'advisory',
      evidenceDigest: digestB,
    }),
    signal({
      id: 'signal.policy-gap.shadow',
      category: 'gap',
      kind: 'policy_gap',
      sourcePlane: 'shadow-baseline',
      authorityMode: 'advisory',
      evidenceDigest: digestC,
    }),
    signal({
      id: 'signal.evidence-gap.duplicate',
      category: 'gap',
      kind: 'evidence_gap',
      sourcePlane: 'policy-foundry',
      authorityMode: 'advisory',
      evidenceDigest: digestB,
    }),
    signal({
      id: 'signal.confirmation',
      category: 'observation',
      kind: 'confirmation',
      sourcePlane: 'shadow-baseline',
      authorityMode: 'advisory',
      evidenceDigest: digestD,
    }),
    signal({
      id: 'signal.contradiction',
      category: 'observation',
      kind: 'contradiction',
      sourcePlane: 'temporal-trajectory',
      authorityMode: 'advisory',
      evidenceDigest: digestE,
    }),
    signal({
      id: 'signal.hard-floor',
      category: 'verdict',
      kind: 'hard_floor',
      sourcePlane: 'tier-1-hard-gate',
      authorityMode: 'hard-floor',
      evidenceDigest: digestE,
    }),
    signal({
      id: 'signal.reversibility-context',
      category: 'context',
      kind: 'reversibility_context',
      sourcePlane: 'policy-foundry',
      authorityMode: 'context-modulator',
      evidenceDigest: digestD,
    }),
    signal({
      id: 'signal.tenant-boundary',
      category: 'boundary',
      kind: 'tenant_boundary_signal',
      sourcePlane: 'policy-foundry',
      authorityMode: 'advisory',
      evidenceDigest: digestC,
    }),
    signal({
      id: 'signal.measurement-degraded',
      category: 'measurement',
      kind: 'measurement_degraded_signal',
      sourcePlane: 'assurance-measurement',
      authorityMode: 'measurement-only',
      evidenceDigest: digestE,
    }),
  ] as const;

  const batch = detectSignalRelationships({
    envelopeRefDigest: digestA,
    signals,
  });

  equal(batch.version, RELATIONSHIP_DETECTOR_CONTRACT_VERSION, 'Relationship detector: batch version is explicit');
  equal(batch.signalCount, signals.length, 'Relationship detector: batch records signal count');
  ok(batch.relationshipCount > 0, 'Relationship detector: built-in rules produce relationships');
  equal(batch.interactionRuleCount, batch.relationshipCount, 'Relationship detector: one interaction rule per relationship');
  ok(batch.relationships.some((relationship) => relationship.kind === 'duplicates'), 'Relationship detector: duplicate evidence relationships are detected');
  ok(batch.relationships.some((relationship) => relationship.kind === 'confirms'), 'Relationship detector: same-kind independent confirmations are detected');
  ok(batch.relationships.some((relationship) => relationship.kind === 'contradicts'), 'Relationship detector: confirmation/contradiction conflicts are detected');
  ok(batch.relationships.some((relationship) => relationship.kind === 'overrides'), 'Relationship detector: hard-floor directed overrides are detected');
  ok(batch.relationships.some((relationship) => relationship.kind === 'modulates'), 'Relationship detector: context directed modulates are detected');
  ok(batch.relationships.some((relationship) => relationship.kind === 'escalates'), 'Relationship detector: boundary directed escalates are detected');
  ok(batch.relationships.some((relationship) => relationship.kind === 'requires_review'), 'Relationship detector: unary review relationships are detected');
  ok(batch.duplicateEvidenceDigests.includes(digestB), 'Relationship detector: duplicate evidence digest is recorded');
  ok(batch.interactionRules.some((rule) => rule.effect === 'discount-duplicate-evidence'), 'Relationship detector: duplicate interaction rule is emitted');
  ok(batch.interactionRules.some((rule) => rule.effect === 'mark-conflict'), 'Relationship detector: conflict interaction rule is emitted');
  ok(batch.interactionRules.some((rule) => rule.effect === 'preserve-hard-floor'), 'Relationship detector: hard-floor interaction rule is emitted');
  ok(batch.interactionRules.every((rule) => rule.noLoosening), 'Relationship detector: all interaction rules are no-loosening');
  equal(batch.relationshipEvaluationBeforeFusion, true, 'Relationship detector: batch marks relationship-before-fusion');
  equal(batch.ruleBasedOnly, true, 'Relationship detector: batch is rule-based only');
  equal(batch.learnedInferenceIncluded, false, 'Relationship detector: learned inference remains excluded');
  equal(batch.correlationLearningIncluded, false, 'Relationship detector: correlation learning remains excluded');
  equal(batch.fusionIncluded, false, 'Relationship detector: fusion remains excluded');
  equal(batch.packetSigningIncluded, false, 'Relationship detector: packet signing remains excluded');
  equal(batch.grantsAuthority, false, 'Relationship detector: batch cannot grant authority');
  equal(batch.canAdmit, false, 'Relationship detector: batch cannot admit');
  equal(batch.activatesEnforcement, false, 'Relationship detector: batch cannot activate enforcement');
  equal(batch.autoEnforce, false, 'Relationship detector: batch cannot auto-enforce');
  equal(batch.productionReady, false, 'Relationship detector: batch is not production readiness');
  equal(batch.rawPayloadStored, false, 'Relationship detector: batch stores no raw payload');
  ok(batch.digest.startsWith('sha256:'), 'Relationship detector: batch digest is generated');
}

function testCustomRuleShapeValidationFailsClosed(): void {
  throws(
    () =>
      createRelationshipDetectorRule({
        ruleId: 'bad.duplicates.directed',
        mode: 'duplicate-evidence',
        relationshipKind: 'duplicates',
        shape: 'directed',
        effect: 'discount-duplicate-evidence',
        reasonCodes: ['bad-shape'],
      }),
    /symmetric relationship kinds require symmetric shape/u,
    'Relationship detector: symmetric kind with directed shape fails closed',
  );
  throws(
    () =>
      createRelationshipDetectorRule({
        ruleId: 'bad.overrides.symmetric',
        mode: 'hard-floor-overrides-advisory',
        relationshipKind: 'overrides',
        shape: 'symmetric',
        effect: 'preserve-hard-floor',
        reasonCodes: ['bad-shape'],
      }),
    /directed relationship kinds require directed shape/u,
    'Relationship detector: directed kind with symmetric shape fails closed',
  );
  throws(
    () =>
      createRelationshipDetectorRule({
        ruleId: 'bad.review.directed',
        mode: 'gap-requires-review',
        relationshipKind: 'requires_review',
        shape: 'directed',
        effect: 'raise-review-pressure',
        reasonCodes: ['bad-shape'],
      }),
    /unary relationship kinds require unary shape/u,
    'Relationship detector: unary kind with directed shape fails closed',
  );
  throws(
    () =>
      createRelationshipDetectorRule({
        ruleId: 'bad.effect',
        mode: 'duplicate-evidence',
        relationshipKind: 'duplicates',
        shape: 'symmetric',
        effect: 'mark-conflict',
        reasonCodes: ['bad-effect'],
      }),
    /interaction effect must match relationship kind/u,
    'Relationship detector: mismatched interaction effect fails closed',
  );
}

function testDetectorRejectsCrossEnvelopeRawAndAuthoritySignals(): void {
  const valid = signal({
    id: 'signal.valid-gap',
    category: 'gap',
    kind: 'evidence_gap',
    sourcePlane: 'policy-foundry',
    authorityMode: 'advisory',
    evidenceDigest: digestB,
  });

  throws(
    () =>
      detectSignalRelationships({
        envelopeRefDigest: digestA,
        signals: [
          valid,
          {
            ...valid,
            signalId: 'signal.other-envelope',
            envelopeRefDigest: digestC,
          },
        ],
      }),
    /signals must belong to the same envelope/u,
    'Relationship detector: cross-envelope signals fail closed',
  );
  throws(
    () =>
      detectSignalRelationships({
        envelopeRefDigest: digestA,
        signals: [
          {
            ...valid,
            signalId: 'signal.raw',
            rawPayloadStored: true,
          } as never,
        ],
      }),
    /no-authority and no-raw-material/u,
    'Relationship detector: raw material signal fails closed',
  );
  throws(
    () =>
      detectSignalRelationships({
        envelopeRefDigest: digestA,
        signals: [
          {
            ...valid,
            signalId: 'signal.authority-upgrade',
            grantsAuthority: true,
          } as never,
        ],
      }),
    /no-authority and no-raw-material/u,
    'Relationship detector: authority-upgrade signal fails closed',
  );
  throws(
    () =>
      detectSignalRelationships({
        envelopeRefDigest: digestA,
        signals: [
          valid,
          {
            ...valid,
          },
        ],
      }),
    /signalId values must be unique/u,
    'Relationship detector: duplicate signal ids fail closed',
  );
  throws(
    () =>
      detectSignalRelationships({
        envelopeRefDigest: digestA,
        signals: [],
      }),
    /requires at least one signal/u,
    'Relationship detector: empty signal batch fails closed',
  );
}

function testDocsOverviewPackageAndProbeStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'relationship-detector-contract.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile('scripts', 'probe', 'probe-consequence-admission-package-surface.mjs');

  for (const expected of [
    '# Relationship Detector Contract',
    'attestor.relationship-detector-contract.v1',
    'detectSignalRelationships()',
    'createRelationshipDetectorRule()',
    'relationshipDetectorDescriptor()',
    'duplicate-evidence',
    'hard-floor-overrides-advisory',
    'NVIDIA Safety Force Field',
    'Accellera UVM',
    'NASA Runtime Assurance',
    'not learned inference',
    'not fusion',
    'sign packets',
    'It only emits relationship structure',
    'never grants authority',
  ]) {
    includes(doc, expected, `Relationship detector doc: records ${expected}`);
  }

  includes(
    overview,
    '| W04 | complete | Relationship Detector Contract |',
    'Relationship detector: runtime wiring tracker marks W04 complete',
  );
  includes(
    overview,
    'src/consequence-admission/relationship-detector-contract.ts',
    'Relationship detector: overview records implementation file',
  );
  equal(
    packageJson.scripts['test:relationship-detector-contract'],
    'tsx tests/relationship-detector-contract.test.ts',
    'Relationship detector: package script is registered',
  );
  includes(
    packageProbe,
    'RELATIONSHIP_DETECTOR_CONTRACT_VERSION',
    'Relationship detector: package surface probe covers export',
  );
}

testDescriptorRecordsNoAuthorityBoundaries();
testBuiltInDetectionCreatesTypedRelationships();
testCustomRuleShapeValidationFailsClosed();
testDetectorRejectsCrossEnvelopeRawAndAuthoritySignals();
testDocsOverviewPackageAndProbeStayAligned();

console.log(`Relationship detector contract tests: ${passed} passed, 0 failed`);
