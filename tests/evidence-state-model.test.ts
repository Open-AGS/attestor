import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createActionSurfaceGraph,
  createCanonicalShadowEvent,
  createEvidenceStateModel,
  evidenceStateModelDescriptor,
  type CanonicalShadowEvent,
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

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const tenantA = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const tenantB = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const actorA = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const resourceA = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
const accountA = 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const evidenceA = 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const policyA = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const approvalA = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const receiptA = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const simulationA = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';
const replayA = 'sha256:5555555555555555555555555555555555555555555555555555555555555555';
const traceA = 'sha256:6666666666666666666666666666666666666666666666666666666666666666';

function canonicalEvent(input: {
  readonly occurredAt: string;
  readonly sourceKind: 'admission-shadow' | 'target-system-shadow' | 'integration-declaration';
  readonly producer?: string;
  readonly actionName?: string;
  readonly observedConsequenceClass?: 'financial' | 'programmable-money' | null;
  readonly inferredConsequenceClass?: 'financial' | 'programmable-money' | null;
  readonly resourceRefDigest?: string | null;
  readonly policyRefs?: boolean;
  readonly evidenceRefs?: boolean;
  readonly approvalRefs?: boolean;
  readonly receiptRefs?: boolean;
  readonly simulationRefs?: boolean;
  readonly tenantRefDigest?: string;
}): CanonicalShadowEvent {
  return createCanonicalShadowEvent({
    occurredAt: input.occurredAt,
    observedAt: input.occurredAt,
    sourceKind: input.sourceKind,
    producer: input.producer ?? 'attestor.evidence-state-model.test',
    tenantRefDigest: input.tenantRefDigest ?? tenantA,
    actorRefDigest: actorA,
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest: accountA,
      actionName: input.actionName ?? 'issue_refund',
      actionKind: 'api-operation',
      consequenceClass: input.observedConsequenceClass ?? null,
      resourceRefDigest: input.resourceRefDigest ?? null,
      dataClass: 'money-movement',
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: input.inferredConsequenceClass === undefined
        ? 'financial'
        : input.inferredConsequenceClass,
      resourceRefDigest: null,
      dataClass: null,
      amountAssetChain: null,
      authorityDelta: null,
    },
    evidenceRefs: input.evidenceRefs
      ? [{ kind: 'evidence', digest: evidenceA, origin: 'observed' }]
      : [],
    policyRefs: input.policyRefs
      ? [{ kind: 'policy', digest: policyA, origin: 'observed' }]
      : [],
    approvalRefs: input.approvalRefs
      ? [{ kind: 'approval', digest: approvalA, origin: 'operator-supplied' }]
      : [],
    receiptRefs: input.receiptRefs
      ? [{ kind: 'receipt', digest: receiptA, origin: 'observed' }]
      : [],
    simulationRefs: input.simulationRefs
      ? [{ kind: 'simulation', digest: simulationA, origin: 'inferred' }]
      : [],
    replayRefDigest: replayA,
    traceRefDigest: traceA,
    rawMaterialPolicy: 'digest-only',
  });
}

function completeGraph() {
  return createActionSurfaceGraph({
    generatedAt: '2026-05-17T09:00:00.000Z',
    events: [
      canonicalEvent({
        occurredAt: '2026-05-17T08:00:00.000Z',
        sourceKind: 'admission-shadow',
        evidenceRefs: true,
        policyRefs: true,
        resourceRefDigest: resourceA,
      }),
      canonicalEvent({
        occurredAt: '2026-05-17T08:01:00.000Z',
        sourceKind: 'target-system-shadow',
        observedConsequenceClass: 'financial',
        inferredConsequenceClass: null,
        resourceRefDigest: resourceA,
        approvalRefs: true,
        receiptRefs: true,
        simulationRefs: true,
      }),
      canonicalEvent({
        occurredAt: '2026-05-17T08:02:00.000Z',
        sourceKind: 'integration-declaration',
        observedConsequenceClass: 'financial',
        inferredConsequenceClass: null,
        resourceRefDigest: resourceA,
      }),
    ],
  });
}

function stateFor(surface: {
  readonly states: readonly { readonly field: string; readonly state: string }[];
}, field: string): string {
  const found = surface.states.find((state) => state.field === field);
  assert.ok(found, `Missing state field ${field}`);
  return found.state;
}

function testCompleteApprovedSurfaceCanBecomeExplicitlyEnforceable(): void {
  const graph = completeGraph();
  const surface = graph.surfaces[0];
  assert.ok(surface);
  const model = createEvidenceStateModel({
    graph,
    generatedAt: '2026-05-17T09:00:00.000Z',
    maxEvidenceAgeMs: 2 * 60 * 60 * 1000,
    trustedProducers: ['attestor.evidence-state-model.test'],
    approvedSurfaceIds: [surface.surfaceId],
    enforceableSurfaceIds: [surface.surfaceId],
  });
  const modeledSurface = model.surfaces[0];
  const text = JSON.stringify(model);

  equal(model.version, 'attestor.evidence-state-model.v1', 'Evidence state model: version is explicit');
  equal(model.graphDigest, graph.digest, 'Evidence state model: graph digest is retained');
  equal(model.tenantRefDigest, tenantA, 'Evidence state model: tenant digest is retained');
  equal(model.surfaceCount, 1, 'Evidence state model: surface count is retained');
  equal(model.readyForEnforcementCount, 1, 'Evidence state model: one explicitly approved clean surface can be marked enforceable');
  equal(model.blockedSurfaceCount, 0, 'Evidence state model: clean enforceable surface has no blockers');
  equal(model.approvalRequired, true, 'Evidence state model: approval remains required');
  equal(model.autoEnforce, false, 'Evidence state model: model never auto-enforces');
  equal(model.productionReady, false, 'Evidence state model: production readiness is not claimed');
  equal(modeledSurface?.readyForEnforcement, true, 'Evidence state model: surface is ready only after explicit enforceability input');
  equal(modeledSurface?.sourceEventDigests.length, graph.surfaces[0]?.eventDigests.length, 'Evidence state model: source event digest set is retained');
  equal(modeledSurface?.promotionBlockers.length, 0, 'Evidence state model: no blockers on complete approved surface');
  equal(stateFor(modeledSurface!, 'approval-ref'), 'approved', 'Evidence state model: approval state is explicit');
  equal(stateFor(modeledSurface!, 'producer-trust'), 'approved', 'Evidence state model: trusted producer approval is explicit');
  equal(stateFor(modeledSurface!, 'enforceability'), 'enforceable', 'Evidence state model: enforceable is explicit and separate');
  ok(model.stateCounts.observed > 0, 'Evidence state model: observed states are counted');
  ok(model.stateCounts.approved >= 2, 'Evidence state model: approved states are counted');
  ok(model.stateCounts.enforceable === 1, 'Evidence state model: enforceable state is counted');
  ok(model.digest.startsWith('sha256:'), 'Evidence state model: digest is generated');
  ok(!text.includes('tenant_raw_must_not_escape'), 'Evidence state model: raw tenant value is not serialized');
}

function testMissingStaleAndUntrustedInputsBlockPromotion(): void {
  const graph = createActionSurfaceGraph({
    generatedAt: '2026-05-17T09:00:00.000Z',
    events: [
      canonicalEvent({
        occurredAt: '2026-03-01T08:00:00.000Z',
        sourceKind: 'integration-declaration',
        producer: 'unreviewed.importer',
        actionName: 'export_customer_data',
        resourceRefDigest: null,
        inferredConsequenceClass: 'financial',
      }),
    ],
  });
  const model = createEvidenceStateModel({
    graph,
    generatedAt: '2026-05-17T09:00:00.000Z',
    maxEvidenceAgeMs: 1,
    trustedProducers: ['attestor.evidence-state-model.test'],
  });
  const surface = model.surfaces[0];
  assert.ok(surface);

  equal(surface.readyForEnforcement, false, 'Evidence state model: incomplete surface is not enforcement-ready');
  equal(stateFor(surface, 'shadow-observation'), 'missing', 'Evidence state model: missing shadow observation is explicit');
  equal(stateFor(surface, 'evidence-ref'), 'missing', 'Evidence state model: missing evidence is explicit');
  equal(stateFor(surface, 'consequence-class'), 'inferred', 'Evidence state model: inferred-only consequence class is explicit');
  equal(stateFor(surface, 'producer-trust'), 'untrusted', 'Evidence state model: untrusted producer is explicit');
  equal(stateFor(surface, 'freshness'), 'stale', 'Evidence state model: stale evidence is explicit');
  ok(surface.promotionBlockers.some((blocker) => blocker.reasonCodes.includes('shadow-observation-missing')), 'Evidence state model: missing shadow observation becomes blocker');
  ok(surface.promotionBlockers.some((blocker) => blocker.reasonCodes.includes('untrusted-producer-present')), 'Evidence state model: untrusted producer becomes blocker');
  ok(surface.promotionBlockers.some((blocker) => blocker.reasonCodes.includes('evidence-stale')), 'Evidence state model: stale evidence becomes blocker');
  equal(model.readyForEnforcementCount, 0, 'Evidence state model: blocked model has zero enforcement-ready surfaces');
}

function testConflictingObservedAndInferredConsequencesAreNotFlattened(): void {
  const graph = createActionSurfaceGraph({
    generatedAt: '2026-05-17T09:00:00.000Z',
    events: [
      canonicalEvent({
        occurredAt: '2026-05-17T08:00:00.000Z',
        sourceKind: 'target-system-shadow',
        observedConsequenceClass: 'financial',
        inferredConsequenceClass: null,
        evidenceRefs: true,
        policyRefs: true,
        approvalRefs: true,
        receiptRefs: true,
        resourceRefDigest: resourceA,
      }),
      canonicalEvent({
        occurredAt: '2026-05-17T08:01:00.000Z',
        sourceKind: 'admission-shadow',
        observedConsequenceClass: null,
        inferredConsequenceClass: 'programmable-money',
        evidenceRefs: true,
        policyRefs: true,
        resourceRefDigest: resourceA,
      }),
    ],
  });
  const surface = graph.surfaces[0];
  assert.ok(surface);
  const model = createEvidenceStateModel({
    graph,
    generatedAt: '2026-05-17T09:00:00.000Z',
    trustedProducers: ['attestor.evidence-state-model.test'],
    approvedSurfaceIds: [surface.surfaceId],
    enforceableSurfaceIds: [surface.surfaceId],
  });
  const modeledSurface = model.surfaces[0];
  assert.ok(modeledSurface);

  equal(stateFor(modeledSurface, 'consequence-class'), 'conflicting', 'Evidence state model: consequence conflicts are explicit');
  equal(stateFor(modeledSurface, 'enforceability'), 'conflicting', 'Evidence state model: enforceability request conflicts with blockers');
  ok(
    modeledSurface.promotionBlockers.some((blocker) =>
      blocker.reasonCodes.includes('consequence-class-conflict')
    ),
    'Evidence state model: consequence conflict blocks promotion',
  );
  equal(model.readyForEnforcementCount, 0, 'Evidence state model: conflicting consequence cannot be enforcement-ready');
}

function testModelFailsClosedOnTenantMismatchAndBadFreshnessPolicy(): void {
  const graph = completeGraph();
  const badGraph = {
    ...graph,
    surfaces: [
      {
        ...graph.surfaces[0],
        tenantRefDigest: tenantB,
      },
    ],
  } as typeof graph;

  throws(
    () => createEvidenceStateModel({ graph: badGraph }),
    /surface tenantRefDigest must match graph tenantRefDigest/u,
    'Evidence state model: graph tenant mismatch fails closed',
  );
  throws(
    () => createEvidenceStateModel({ graph, maxEvidenceAgeMs: -1 }),
    /maxEvidenceAgeMs must be a non-negative number/u,
    'Evidence state model: negative freshness policy fails closed',
  );
}

function testDescriptorDocsAndTrackersStayAligned(): void {
  const descriptor = evidenceStateModelDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'evidence-state-model.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const actionGraphDoc = readProjectFile('docs', '02-architecture', 'action-surface-graph.md');
  const shadowEventDoc = readProjectFile('docs', '02-architecture', 'shadow-event-canonical-schema.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.evidence-state-model.v1', 'Evidence state model: descriptor version is explicit');
  equal(descriptor.tenantBound, true, 'Evidence state model: descriptor is tenant-bound');
  equal(descriptor.autoEnforce, false, 'Evidence state model: descriptor never auto-enforces');
  ok(descriptor.stateKinds.includes('conflicting'), 'Evidence state model: descriptor lists conflicting state');
  ok(descriptor.fields.includes('producer-trust'), 'Evidence state model: descriptor lists producer trust field');

  for (const expected of [
    '# Evidence State Model',
    'observed',
    'inferred',
    'missing',
    'conflicting',
    'stale',
    'untrusted',
    'approved',
    'enforceable',
    'W3C PROV Data Model',
    'OpenTelemetry Logs Data Model',
    'CloudEvents',
    'OPA decision logs',
    'Cedar policy validation',
    'SLSA Provenance',
  ]) {
    includes(doc, expected, `Evidence state model doc: records ${expected}`);
  }

  for (const expected of [
    '| Complete | 21 |',
    '| Remaining | 5 |',
    '| 15 | complete | Action surface graph |',
    '| 16 | complete | Evidence state model |',
    '| 17 | complete | Policy Candidate PR contract |',
    '| 18 | complete | Active Question Engine |',
    '| 19 | complete | Counterexample replay generator |',
    'completion of steps 22-26',
  ]) {
    includes(masterPlan, expected, `Evidence state model: master plan records ${expected}`);
  }

  includes(
    ledger,
    '### 58. Evidence State Model',
    'Evidence state model: research ledger entry is present',
  );
  includes(
    systemOverview,
    '[evidence state model](evidence-state-model.md)',
    'Evidence state model: system overview links doc',
  );
  includes(
    actionGraphDoc,
    '[Evidence State Model](evidence-state-model.md)',
    'Evidence state model: action graph doc links next contract',
  );
  includes(
    shadowEventDoc,
    '[Evidence State Model](evidence-state-model.md)',
    'Evidence state model: shadow event doc links state vocabulary',
  );
  includes(
    readme,
    '[Evidence state model](docs/02-architecture/evidence-state-model.md)',
    'Evidence state model: README links doc',
  );
  assert.equal(
    packageJson.scripts['test:evidence-state-model'],
    'tsx tests/evidence-state-model.test.ts',
    'Evidence state model: package script is registered',
  );
  passed += 1;

  excludes(
    doc,
    /\bproduction-ready\b(?![\s\S]{0,80}(not|without|until|claim|readiness|evidence))/iu,
    'Evidence state model doc: does not make an unqualified production-ready claim',
  );
}

testCompleteApprovedSurfaceCanBecomeExplicitlyEnforceable();
testMissingStaleAndUntrustedInputsBlockPromotion();
testConflictingObservedAndInferredConsequencesAreNotFlattened();
testModelFailsClosedOnTenantMismatchAndBadFreshnessPolicy();
testDescriptorDocsAndTrackersStayAligned();

console.log(`Evidence state model tests: ${passed} passed, 0 failed`);
