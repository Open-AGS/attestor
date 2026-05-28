import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SIGNAL_EXTRACTOR_CONTRACT_VERSION,
  createCanonicalShadowEvent,
  createShadowEnvelopeProjection,
  createSignalExtractionBatch,
  createSignalExtractorDeclaration,
  signalExtractorContractDescriptor,
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

function fixtureProjection() {
  const event = createCanonicalShadowEvent({
    occurredAt: '2026-05-17T10:00:00.000Z',
    sourceKind: 'target-system-shadow',
    producer: 'attestor.signal-extractor.test',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest: null,
      actionName: 'refund.create',
      actionKind: 'api-operation',
      consequenceClass: 'financial',
      resourceRefDigest: digestC,
      dataClass: 'money-movement',
      amountAssetChain: null,
      authorityDelta: null,
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestA, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digestB, origin: 'observed' }],
    traceRefDigest: digestD,
    rawMaterialPolicy: 'digest-only',
  });
  return createShadowEnvelopeProjection(event, {
    authorityRefDigest: digestD,
  });
}

function gapSignal(
  envelopeRefDigest: string,
): SignalRelationshipSignal<'gap'> {
  return {
    signalId: 'signal.evidence-gap.refund-create',
    category: 'gap',
    kind: 'evidence_gap',
    sourcePlane: 'policy-foundry',
    authorityMode: 'advisory',
    envelopeRefDigest,
    evidenceRefs: [{ kind: 'evidence', digest: digestA }],
    readModelRefs: [{ modelKind: 'policy', digest: digestB }],
    appliesToConsequenceClasses: ['financial'],
    knows: ['required refund evidence digest is missing'],
    cannotKnow: ['whether missing evidence exists outside the envelope'],
    confidence: 0.72,
    uncertainty: 0.28,
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
  const descriptor = signalExtractorContractDescriptor();

  equal(descriptor.version, SIGNAL_EXTRACTOR_CONTRACT_VERSION, 'Signal extractor: descriptor version is explicit');
  equal(descriptor.signalRelationshipContractVersion, 'attestor.signal-relationship-contract.v1', 'Signal extractor: descriptor binds signal relationship contract');
  equal(descriptor.shadowEnvelopeProjectorVersion, 'attestor.shadow-envelope-projector.v1', 'Signal extractor: descriptor binds shadow envelope projector');
  ok(descriptor.executionModes.includes('shadow-only'), 'Signal extractor: shadow-only execution mode is registered');
  ok(descriptor.outputModes.includes('signals-only'), 'Signal extractor: signals-only output mode is registered');
  equal(descriptor.categoryBoundOutputRequired, true, 'Signal extractor: category-bound output is required');
  equal(descriptor.sourcePlaneTagRequired, true, 'Signal extractor: source plane tag is required');
  equal(descriptor.sourceEvidenceDigestRequired, true, 'Signal extractor: source evidence digest is required');
  equal(descriptor.advisoryCannotEmitHardFloor, true, 'Signal extractor: advisory extractors cannot emit hard_floor');
  equal(descriptor.hardFloorRequiresTierOne, true, 'Signal extractor: hard_floor requires tier-1 source');
  equal(descriptor.readsRawPayload, false, 'Signal extractor: descriptor cannot read raw payload');
  equal(descriptor.grantsAuthority, false, 'Signal extractor: descriptor cannot grant authority');
  equal(descriptor.canAdmit, false, 'Signal extractor: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Signal extractor: descriptor cannot activate enforcement');
  equal(descriptor.autoEnforce, false, 'Signal extractor: descriptor cannot auto-enforce');
  equal(descriptor.productionReady, false, 'Signal extractor: descriptor is not production readiness');
}

function testDeclarationAndBatchPreserveTypedSignalShape(): void {
  const projection = fixtureProjection();
  const extractor = createSignalExtractorDeclaration({
    extractorId: 'policy-foundry.evidence-gap.extractor',
    sourcePlane: 'policy-foundry',
    category: 'gap',
    authorityMode: 'advisory',
    allowedKinds: ['evidence_gap', 'policy_gap'],
    readsReadModelRefs: true,
  });
  const signal = gapSignal(projection.envelopeRefDigest);
  const batch = createSignalExtractionBatch({
    projection,
    extractor,
    signals: [signal],
  });

  equal(extractor.version, SIGNAL_EXTRACTOR_CONTRACT_VERSION, 'Signal extractor: declaration version is explicit');
  equal(extractor.allowedKinds.length, 2, 'Signal extractor: declaration records allowed signal kinds');
  equal(extractor.canEmitHardFloor, false, 'Signal extractor: advisory declaration cannot emit hard_floor');
  equal(batch.version, SIGNAL_EXTRACTOR_CONTRACT_VERSION, 'Signal extractor: batch version is explicit');
  equal(batch.projectionDigest, projection.digest, 'Signal extractor: batch binds projection digest');
  equal(batch.envelopeRefDigest, projection.envelopeRefDigest, 'Signal extractor: batch binds envelope digest');
  equal(batch.sourceEventDigest, projection.sourceEventDigest, 'Signal extractor: batch binds source event digest');
  equal(batch.tenantBindingDigest, projection.tenantBindingDigest, 'Signal extractor: batch binds tenant digest proof');
  equal(batch.signalCount, 1, 'Signal extractor: batch signal count is explicit');
  equal(batch.signals[0]?.category, 'gap', 'Signal extractor: signal category is preserved');
  equal(batch.signals[0]?.kind, 'evidence_gap', 'Signal extractor: signal kind is preserved');
  equal(batch.categoryBoundOutput, true, 'Signal extractor: category-bound output flag is true');
  equal(batch.sourcePlaneTagPreserved, true, 'Signal extractor: source plane tag is preserved');
  equal(batch.authorityModePreserved, true, 'Signal extractor: authority mode is preserved');
  equal(batch.sourceEvidenceDigests[0], digestA, 'Signal extractor: source evidence digest is recorded');
  equal(batch.readModelDigests[0], digestB, 'Signal extractor: read model digest is recorded');
  equal(batch.rawPayloadRead, false, 'Signal extractor: batch cannot read raw payload');
  equal(batch.grantsAuthority, false, 'Signal extractor: batch cannot grant authority');
  equal(batch.canAdmit, false, 'Signal extractor: batch cannot admit');
  equal(batch.activatesEnforcement, false, 'Signal extractor: batch cannot activate enforcement');
  equal(batch.autoEnforce, false, 'Signal extractor: batch cannot auto-enforce');
  equal(batch.productionReady, false, 'Signal extractor: batch is not production readiness');
  ok(batch.digest.startsWith('sha256:'), 'Signal extractor: batch digest is generated');
}

function testHardFloorRequiresTierOneHardFloorAuthority(): void {
  throws(
    () =>
      createSignalExtractorDeclaration({
        extractorId: 'policy-foundry.bad-hard-floor',
        sourcePlane: 'policy-foundry',
        category: 'verdict',
        authorityMode: 'advisory',
        allowedKinds: ['hard_floor'],
      }),
    /hard_floor output requires tier-1 hard-floor authority/u,
    'Signal extractor: advisory source cannot declare hard_floor output',
  );

  const declaration = createSignalExtractorDeclaration({
    extractorId: 'tier1.hard-floor.extractor',
    sourcePlane: 'tier-1-hard-gate',
    category: 'verdict',
    authorityMode: 'hard-floor',
    allowedKinds: ['hard_floor'],
  });

  equal(declaration.canEmitHardFloor, true, 'Signal extractor: tier-1 hard-floor declaration may emit hard_floor');
}

function testBatchFailsClosedOnMismatchedOrUnsafeSignals(): void {
  const projection = fixtureProjection();
  const extractor = createSignalExtractorDeclaration({
    extractorId: 'policy-foundry.evidence-gap.extractor',
    sourcePlane: 'policy-foundry',
    category: 'gap',
    authorityMode: 'advisory',
    allowedKinds: ['evidence_gap'],
  });
  const validSignal = gapSignal(projection.envelopeRefDigest);

  throws(
    () =>
      createSignalExtractionBatch({
        projection,
        extractor,
        signals: [
          {
            ...validSignal,
            category: 'observation',
          } as never,
        ],
      }),
    /output category must match/u,
    'Signal extractor: category mismatch fails closed',
  );
  throws(
    () =>
      createSignalExtractionBatch({
        projection,
        extractor,
        signals: [
          {
            ...validSignal,
            kind: 'policy_gap',
          } as never,
        ],
      }),
    /kind must be declared/u,
    'Signal extractor: undeclared signal kind fails closed',
  );
  throws(
    () =>
      createSignalExtractionBatch({
        projection,
        extractor,
        signals: [
          {
            ...validSignal,
            sourcePlane: 'shadow-baseline',
          } as never,
        ],
      }),
    /sourcePlane must match/u,
    'Signal extractor: source plane mismatch fails closed',
  );
  throws(
    () =>
      createSignalExtractionBatch({
        projection,
        extractor,
        signals: [
          {
            ...validSignal,
            evidenceRefs: [],
          },
        ],
      }),
    /must include at least one digest evidence ref/u,
    'Signal extractor: missing evidence refs fail closed',
  );
  throws(
    () =>
      createSignalExtractionBatch({
        projection,
        extractor,
        signals: [
          {
            ...validSignal,
            evidenceRefs: [{ kind: 'evidence', digest: 'raw-evidence-id' }],
          },
        ],
      }),
    /evidenceRefs\[0\]\.digest must be a sha256 digest reference/u,
    'Signal extractor: raw evidence refs fail closed',
  );
  throws(
    () =>
      createSignalExtractionBatch({
        projection,
        extractor,
        signals: [
          {
            ...validSignal,
            appliesToConsequenceClasses: ['programmable-money'],
          },
        ],
      }),
    /must apply to the projection consequence class/u,
    'Signal extractor: consequence-class mismatch fails closed',
  );
  throws(
    () =>
      createSignalExtractionBatch({
        projection,
        extractor,
        signals: [
          {
            ...validSignal,
            grantsAuthority: true,
          } as never,
        ],
      }),
    /no-authority and no-raw-material/u,
    'Signal extractor: authority-upgrade attempts fail closed',
  );
}

function testDocsOverviewPackageAndProbeStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'signal-extractor-contract.md');
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
    '# Signal Extractor Contract',
    'attestor.signal-extractor-contract.v1',
    'SignalExtractorDeclaration',
    'SignalExtractionBatch',
    'createSignalExtractorDeclaration()',
    'createSignalExtractionBatch()',
    'OpenTelemetry',
    'Model Context Protocol',
    'Open Policy Agent decision logs',
    'not adapter registry',
    'not relationship detection',
    'not fusion',
    'not live enforcement',
    'never reads raw payload',
    'never grants authority',
  ]) {
    includes(doc, expected, `Signal extractor doc: records ${expected}`);
  }

  includes(
    overview,
    '| W02 | complete | Signal Extractor Contract |',
    'Signal extractor: runtime wiring tracker marks W02 complete',
  );
  includes(
    overview,
    'src/consequence-admission/signal-extractor-contract.ts',
    'Signal extractor: overview records implementation file',
  );
  equal(
    packageJson.scripts['test:signal-extractor-contract'],
    'tsx tests/signal-extractor-contract.test.ts',
    'Signal extractor: package script is registered',
  );
  includes(
    packageProbe,
    'SIGNAL_EXTRACTOR_CONTRACT_VERSION',
    'Signal extractor: package surface probe covers export',
  );
}

testDescriptorRecordsNoAuthorityBoundaries();
testDeclarationAndBatchPreserveTypedSignalShape();
testHardFloorRequiresTierOneHardFloorAuthority();
testBatchFailsClosedOnMismatchedOrUnsafeSignals();
testDocsOverviewPackageAndProbeStayAligned();

console.log(`Signal extractor contract tests: ${passed} passed, 0 failed`);
