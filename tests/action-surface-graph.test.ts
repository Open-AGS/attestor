import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceGraphDescriptor,
  createActionSurfaceGraph,
  createCanonicalShadowEvent,
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
const actorB = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
const resourceA = 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const accountA = 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const evidenceA = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const policyA = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const approvalA = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const receiptA = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';
const simulationA = 'sha256:5555555555555555555555555555555555555555555555555555555555555555';
const replayA = 'sha256:6666666666666666666666666666666666666666666666666666666666666666';
const traceA = 'sha256:7777777777777777777777777777777777777777777777777777777777777777';

function canonicalEvent(input: {
  readonly occurredAt: string;
  readonly sourceKind: 'admission-shadow' | 'target-system-shadow' | 'integration-declaration' | 'manual-import';
  readonly actorRefDigest?: string;
  readonly actionName?: string | null;
  readonly actionKind?: 'api-operation' | 'mcp-tool' | 'transaction-proposal' | null;
  readonly observedConsequenceClass?: 'financial' | 'programmable-money' | null;
  readonly inferredConsequenceClass?: 'financial' | 'programmable-money' | null;
  readonly resourceRefDigest?: string | null;
  readonly targetAccountRefDigest?: string | null;
  readonly policyRefs?: boolean;
  readonly evidenceRefs?: boolean;
  readonly approvalRefs?: boolean;
  readonly receiptRefs?: boolean;
  readonly simulationRefs?: boolean;
  readonly replayRefDigest?: string | null;
  readonly traceRefDigest?: string | null;
  readonly tenantRefDigest?: string;
}): CanonicalShadowEvent {
  const actionName = input.actionName === undefined ? 'issue_refund' : input.actionName;
  const actionKind = input.actionKind === undefined ? 'api-operation' : input.actionKind;
  const inferredConsequenceClass = input.inferredConsequenceClass === undefined
    ? 'financial'
    : input.inferredConsequenceClass;
  return createCanonicalShadowEvent({
    occurredAt: input.occurredAt,
    observedAt: input.occurredAt,
    sourceKind: input.sourceKind,
    producer: 'attestor.action-surface-graph.test',
    tenantRefDigest: input.tenantRefDigest ?? tenantA,
    actorRefDigest: input.actorRefDigest ?? actorA,
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest: input.targetAccountRefDigest ?? null,
      actionName,
      actionKind,
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
      consequenceClass: inferredConsequenceClass,
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
    replayRefDigest: input.replayRefDigest ?? null,
    traceRefDigest: input.traceRefDigest ?? null,
    rawMaterialPolicy: 'digest-only',
  });
}

function testGraphCombinesCanonicalEventsIntoTenantBoundSurface(): void {
  const graph = createActionSurfaceGraph({
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
        actorRefDigest: actorB,
        observedConsequenceClass: 'financial',
        inferredConsequenceClass: null,
        targetAccountRefDigest: accountA,
        resourceRefDigest: resourceA,
        approvalRefs: true,
        receiptRefs: true,
        simulationRefs: true,
        replayRefDigest: replayA,
        traceRefDigest: traceA,
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
  const text = JSON.stringify(graph);
  const surface = graph.surfaces[0];

  equal(graph.version, 'attestor.action-surface-graph.v1', 'Action surface graph: version is explicit');
  equal(graph.tenantRefDigest, tenantA, 'Action surface graph: tenant digest is retained');
  equal(graph.surfaceCount, 1, 'Action surface graph: matching events form one surface');
  equal(graph.observedSurfaceCount, 1, 'Action surface graph: observed surface count is retained');
  equal(graph.receiptLinkedSurfaceCount, 1, 'Action surface graph: receipt-linked count is retained');
  equal(graph.approvalRequired, true, 'Action surface graph: approval remains required');
  equal(graph.autoEnforce, false, 'Action surface graph: graph does not auto-enforce');
  equal(graph.productionReady, false, 'Action surface graph: production readiness is not claimed');
  ok(graph.nodeCount > 8, 'Action surface graph: graph nodes are emitted');
  ok(graph.edgeCount > 8, 'Action surface graph: graph edges are emitted');
  ok(graph.digest.startsWith('sha256:'), 'Action surface graph: graph digest is generated');
  equal(surface?.actionSurface, 'refund-service.issue_refund', 'Action surface graph: action surface is named');
  equal(surface?.eventCount, 3, 'Action surface graph: surface event count is retained');
  equal(surface?.coverageStatus, 'receipt-linked', 'Action surface graph: coverage can reach receipt-linked without enforcement claim');
  equal(surface?.nextStep, 'review-route-coverage', 'Action surface graph: complete coverage still asks for review');
  equal(surface?.routeCoverage.admissionShadowEventCount, 1, 'Action surface graph: admission shadow route coverage is counted');
  equal(surface?.routeCoverage.targetSystemShadowEventCount, 1, 'Action surface graph: target shadow route coverage is counted');
  equal(surface?.routeCoverage.integrationDeclarationEventCount, 1, 'Action surface graph: integration declaration coverage is counted');
  equal(surface?.routeCoverage.policyRefCount, 1, 'Action surface graph: policy refs are counted');
  equal(surface?.routeCoverage.evidenceRefCount, 1, 'Action surface graph: evidence refs are counted');
  equal(surface?.routeCoverage.approvalRefCount, 1, 'Action surface graph: approval refs are counted');
  equal(surface?.routeCoverage.receiptRefCount, 1, 'Action surface graph: receipt refs are counted');
  equal(surface?.routeCoverage.observedConsequenceClassCount, 2, 'Action surface graph: observed class count is retained');
  equal(surface?.routeCoverage.inferredConsequenceClassCount, 1, 'Action surface graph: inferred class count is retained separately');
  ok(surface?.coverageGaps.length === 0, 'Action surface graph: complete review input has no coverage gaps');
  ok(graph.edges.some((edge) => edge.kind === 'surface-has-receipt'), 'Action surface graph: receipt edge is present');
  ok(graph.nodes.some((node) => node.kind === 'tenant' && node.refDigest === tenantA), 'Action surface graph: tenant node is digest-bound');
  ok(!text.includes('tenant_raw_must_not_escape'), 'Action surface graph: raw tenant values are not serialized');
  ok(!text.includes('customer_raw_must_not_escape'), 'Action surface graph: raw customer values are not serialized');
}

function testGraphSurfacesDeclaredOnlyAndInferredOnlyGaps(): void {
  const graph = createActionSurfaceGraph({
    generatedAt: '2026-05-17T09:10:00.000Z',
    events: [
      canonicalEvent({
        occurredAt: '2026-05-17T08:10:00.000Z',
        sourceKind: 'integration-declaration',
        actionName: 'export_customer_data',
        actionKind: 'mcp-tool',
        resourceRefDigest: null,
        inferredConsequenceClass: 'financial',
      }),
    ],
  });
  const surface = graph.surfaces[0];

  equal(graph.declaredOnlySurfaceCount, 1, 'Action surface graph: declared-only surfaces are counted');
  equal(surface?.coverageStatus, 'declared-only', 'Action surface graph: declaration-only surface is explicit');
  equal(surface?.nextStep, 'add-shadow-capture', 'Action surface graph: declaration-only next step adds shadow capture');
  ok(surface?.coverageGaps.includes('missing-shadow-observation'), 'Action surface graph: missing shadow observation gap is present');
  ok(surface?.coverageGaps.includes('missing-policy-ref'), 'Action surface graph: missing policy gap is present');
  ok(surface?.coverageGaps.includes('missing-evidence-ref'), 'Action surface graph: missing evidence gap is present');
  ok(surface?.coverageGaps.includes('missing-receipt-ref'), 'Action surface graph: missing receipt gap is present');
  ok(surface?.coverageGaps.includes('missing-resource-ref'), 'Action surface graph: missing resource gap is present');
  ok(surface?.coverageGaps.includes('inferred-consequence-class-only'), 'Action surface graph: inferred-only class gap is present');
  equal(graph.gapCounts['missing-shadow-observation'], 1, 'Action surface graph: gap counts summarize missing shadow capture');
  ok(graph.recommendedNextSteps.includes('add-shadow-capture'), 'Action surface graph: graph recommends shadow capture');
}

function testGraphFailsClosedAcrossTenants(): void {
  const eventA = canonicalEvent({
    occurredAt: '2026-05-17T08:20:00.000Z',
    sourceKind: 'admission-shadow',
  });
  const eventB = canonicalEvent({
    occurredAt: '2026-05-17T08:21:00.000Z',
    sourceKind: 'admission-shadow',
    tenantRefDigest: tenantB,
  });

  throws(
    () => createActionSurfaceGraph({ events: [eventA, eventB] }),
    /cannot combine multiple tenantRefDigest values/u,
    'Action surface graph: multi-tenant input fails closed',
  );
  throws(
    () => createActionSurfaceGraph({ events: [eventA], tenantRefDigest: tenantB }),
    /must match every event tenantRefDigest/u,
    'Action surface graph: requested tenant mismatch fails closed',
  );
  throws(
    () => createActionSurfaceGraph({ events: [], tenantRefDigest: null }),
    /requires at least one event or an explicit tenantRefDigest/u,
    'Action surface graph: empty unbound graph fails closed',
  );
}

function testDescriptorDocsAndTrackersStayAligned(): void {
  const descriptor = actionSurfaceGraphDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'action-surface-graph.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const targetMatrix = readProjectFile('docs', '02-architecture', 'target-system-compatibility-matrix.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.action-surface-graph.v1', 'Action surface graph: descriptor version is explicit');
  equal(descriptor.tenantBound, true, 'Action surface graph: descriptor is tenant-bound');
  equal(descriptor.outputIsDecisionSupportOnly, true, 'Action surface graph: output is decision support only');
  ok(descriptor.nodeKinds.includes('action-surface'), 'Action surface graph: descriptor lists action-surface node');
  ok(descriptor.edgeKinds.includes('surface-has-receipt'), 'Action surface graph: descriptor lists receipt edge');
  ok(descriptor.gapReasons.includes('missing-target-system-shadow'), 'Action surface graph: descriptor lists target shadow gap');

  for (const expected of [
    '# Action Surface Graph',
    'OpenAPI',
    'AsyncAPI',
    'Model Context Protocol',
    'W3C PROV',
    'tenant-bound',
    'route coverage',
    'missing-policy-ref',
    'missing-evidence-ref',
    'missing-receipt-ref',
    '[Evidence State Model](evidence-state-model.md)',
  ]) {
    includes(doc, expected, `Action surface graph doc: records ${expected}`);
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
    includes(masterPlan, expected, `Action surface graph: master plan records ${expected}`);
  }

  includes(
    ledger,
    '### 57. Action Surface Graph',
    'Action surface graph: research ledger entry is present',
  );
  includes(
    systemOverview,
    '[action surface graph](action-surface-graph.md)',
    'Action surface graph: system overview links graph doc',
  );
  includes(
    targetMatrix,
    '[action surface graph](action-surface-graph.md)',
    'Action surface graph: target matrix links graph doc',
  );
  includes(
    readme,
    '[Action surface graph](docs/02-architecture/action-surface-graph.md)',
    'Action surface graph: README links graph doc',
  );
  assert.equal(
    packageJson.scripts['test:action-surface-graph'],
    'tsx tests/action-surface-graph.test.ts',
    'Action surface graph: package script is registered',
  );
  passed += 1;
  excludes(
    doc,
    /\bproduction-ready\b(?![\s\S]{0,80}(not|without|until|claim|readiness|evidence))/iu,
    'Action surface graph doc: does not make an unqualified production-ready claim',
  );
}

testGraphCombinesCanonicalEventsIntoTenantBoundSurface();
testGraphSurfacesDeclaredOnlyAndInferredOnlyGaps();
testGraphFailsClosedAcrossTenants();
testDescriptorDocsAndTrackersStayAligned();

console.log(`Action surface graph tests: ${passed} passed, 0 failed`);
