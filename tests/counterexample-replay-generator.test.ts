import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  counterexampleReplayGeneratorDescriptor,
  createActionSurfaceGraph,
  createActiveQuestionEngine,
  createCanonicalShadowEvent,
  createCounterexampleReplayGenerator,
  createEvidenceStateModel,
  createPolicyCandidatePrContract,
  type CanonicalShadowEvent,
  type CanonicalShadowEventActionKind,
  type CanonicalShadowEventAuthorityDelta,
  type CanonicalShadowEventConsequenceClass,
  type CanonicalShadowEventSourceKind,
  type PolicyCandidatePrContract,
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
const actorA = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const resourceA = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
const accountA = 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const evidenceA = 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const policyA = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const approvalA = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const receiptA = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const simulationA = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';
const replayA = 'sha256:5555555555555555555555555555555555555555555555555555555555555555';
const replayB = 'sha256:5656565656565656565656565656565656565656565656565656565656565656';
const traceA = 'sha256:6666666666666666666666666666666666666666666666666666666666666666';
const schemaA = 'sha256:7777777777777777777777777777777777777777777777777777777777777777';
const questionA = 'sha256:9999999999999999999999999999999999999999999999999999999999999999';

function canonicalEvent(input: {
  readonly occurredAt: string;
  readonly sourceKind: CanonicalShadowEventSourceKind;
  readonly producer?: string;
  readonly targetSystem?: string;
  readonly actionName?: string;
  readonly actionKind?: CanonicalShadowEventActionKind;
  readonly observedConsequenceClass?: CanonicalShadowEventConsequenceClass | null;
  readonly inferredConsequenceClass?: CanonicalShadowEventConsequenceClass | null;
  readonly resourceRefDigest?: string | null;
  readonly dataClass?: string | null;
  readonly authorityDelta?: CanonicalShadowEventAuthorityDelta | null;
  readonly policyRefs?: boolean;
  readonly evidenceRefs?: boolean;
  readonly approvalRefs?: boolean;
  readonly receiptRefs?: boolean;
  readonly simulationRefs?: boolean;
  readonly replayRefDigest?: string | null;
}): CanonicalShadowEvent {
  return createCanonicalShadowEvent({
    occurredAt: input.occurredAt,
    observedAt: input.occurredAt,
    sourceKind: input.sourceKind,
    producer: input.producer ?? 'attestor.counterexample-replay-generator.test',
    tenantRefDigest: tenantA,
    actorRefDigest: actorA,
    observed: {
      targetSystem: input.targetSystem ?? 'refund-service',
      targetAccountRefDigest: accountA,
      actionName: input.actionName ?? 'issue_refund',
      actionKind: input.actionKind ?? 'api-operation',
      consequenceClass: input.observedConsequenceClass ?? null,
      resourceRefDigest: input.resourceRefDigest ?? null,
      dataClass: input.dataClass ?? 'money-movement',
      amountAssetChain: null,
      authorityDelta: input.authorityDelta ?? null,
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
    replayRefDigest: input.replayRefDigest === undefined ? replayA : input.replayRefDigest,
    traceRefDigest: traceA,
    rawMaterialPolicy: 'digest-only',
  });
}

function candidateContract(): PolicyCandidatePrContract {
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
      canonicalEvent({
        occurredAt: '2026-05-17T08:03:00.000Z',
        sourceKind: 'crypto-execution-admission',
        targetSystem: 'wallet-rpc',
        actionName: 'erc20_approve',
        actionKind: 'transaction-proposal',
        observedConsequenceClass: 'programmable-money',
        inferredConsequenceClass: null,
        resourceRefDigest: resourceA,
        dataClass: 'erc20-allowance',
        authorityDelta: {
          authorityKind: 'spender-allowance',
          principalRefDigest: actorA,
          resourceRefDigest: resourceA,
          permissionRefDigest: policyA,
        },
        evidenceRefs: true,
        policyRefs: true,
        approvalRefs: true,
        receiptRefs: true,
        simulationRefs: true,
        replayRefDigest: replayB,
      }),
      canonicalEvent({
        occurredAt: '2026-05-17T08:04:00.000Z',
        sourceKind: 'integration-declaration',
        targetSystem: 'wallet-rpc',
        actionName: 'erc20_approve',
        actionKind: 'transaction-proposal',
        observedConsequenceClass: 'programmable-money',
        inferredConsequenceClass: null,
        resourceRefDigest: resourceA,
        dataClass: 'erc20-allowance',
        replayRefDigest: replayB,
      }),
      canonicalEvent({
        occurredAt: '2026-03-01T08:00:00.000Z',
        sourceKind: 'integration-declaration',
        producer: 'unreviewed.importer',
        targetSystem: 'crm-export',
        actionName: 'export_customer_data',
        resourceRefDigest: null,
        dataClass: 'customer-data',
        inferredConsequenceClass: 'data-movement',
        replayRefDigest: null,
      }),
    ],
  });
  const model = createEvidenceStateModel({
    graph,
    generatedAt: '2026-05-17T09:00:00.000Z',
    maxEvidenceAgeMs: 2 * 60 * 60 * 1000,
    trustedProducers: ['attestor.counterexample-replay-generator.test'],
    approvedSurfaceIds: graph.surfaces.map((surface) => surface.surfaceId),
  });
  const refund = model.surfaces.find((surface) =>
    surface.actionSurface === 'refund-service.issue_refund'
  );
  const crypto = model.surfaces.find((surface) =>
    surface.actionSurface === 'wallet-rpc.erc20_approve'
  );
  const exportSurface = model.surfaces.find((surface) =>
    surface.actionSurface === 'crm-export.export_customer_data'
  );
  assert.ok(refund);
  assert.ok(crypto);
  assert.ok(exportSurface);
  return createPolicyCandidatePrContract({
    evidenceStateModel: model,
    generatedAt: '2026-05-17T09:05:00.000Z',
    schemaDigest: schemaA,
    replayDigestBySurfaceId: {
      [refund.surfaceId]: replayA,
      [crypto.surfaceId]: replayB,
    },
    questionDigestsBySurfaceId: {
      [exportSurface.surfaceId]: [questionA],
    },
  });
}

function testGeneratorProducesTenantBoundSyntheticNegativeFixtures(): void {
  const contract = candidateContract();
  const activeQuestions = createActiveQuestionEngine({
    policyCandidatePrContract: contract,
    generatedAt: '2026-05-17T09:06:00.000Z',
    maxQuestions: 10,
    includeApprovalQuestions: true,
  });
  const result = createCounterexampleReplayGenerator({
    policyCandidatePrContract: contract,
    activeQuestionEngine: activeQuestions,
    generatedAt: '2026-05-17T09:07:00.000Z',
  });
  const serialized = JSON.stringify(result);

  equal(result.version, 'attestor.counterexample-replay-generator.v1', 'Counterexample replay generator: version is explicit');
  equal(result.policyCandidatePrContractDigest, contract.digest, 'Counterexample replay generator: candidate PR digest is retained');
  equal(result.activeQuestionEngineDigest, activeQuestions.digest, 'Counterexample replay generator: active question digest is retained');
  equal(result.tenantRefDigest, tenantA, 'Counterexample replay generator: tenant digest is retained');
  equal(result.candidateCount, 3, 'Counterexample replay generator: candidate count is retained');
  equal(result.candidateWithFixtureCount, 3, 'Counterexample replay generator: every candidate gets fixtures');
  ok(result.fixtureCount >= 24, 'Counterexample replay generator: broad fixture set is generated');
  ok(result.blockerFixtureCount > 0, 'Counterexample replay generator: blocker fixtures are counted');
  equal(result.approvalRequired, true, 'Counterexample replay generator: approval remains required');
  equal(result.autoEnforce, false, 'Counterexample replay generator: generator never auto-enforces');
  equal(result.activatesEnforcement, false, 'Counterexample replay generator: generator cannot activate enforcement');
  equal(result.productionReady, false, 'Counterexample replay generator: production readiness is not claimed');
  equal(result.syntheticOnly, true, 'Counterexample replay generator: fixtures are synthetic only');
  equal(result.localReplayOnly, true, 'Counterexample replay generator: replay scope is local');
  equal(result.executesProductionTraffic, false, 'Counterexample replay generator: production traffic execution is false');
  equal(result.downstreamMutationAllowed, false, 'Counterexample replay generator: downstream mutation is blocked');
  equal(result.credentialUseAllowed, false, 'Counterexample replay generator: credential use is blocked');

  for (const kind of [
    'tenant-mismatch',
    'stale-approval',
    'missing-evidence',
    'bypass-route',
    'repeated-action',
    'prompt-injection',
    'tool-poisoning',
    'unsafe-approval',
    'crypto-transaction-abuse',
  ]) {
    ok(result.fixtureKinds.includes(kind), `Counterexample replay generator: includes ${kind}`);
  }

  ok(
    result.fixtures.every((fixture) =>
      fixture.fixtureDigest.startsWith('sha256:') &&
      fixture.replayInputDigest.startsWith('sha256:') &&
      fixture.mutationDigest.startsWith('sha256:')
    ),
    'Counterexample replay generator: every fixture carries digest-only replay inputs',
  );
  ok(
    result.fixtures.every((fixture) =>
      fixture.mustNotAdmit &&
      fixture.mustNotActivatePolicy &&
      fixture.syntheticOnly &&
      fixture.localReplayOnly &&
      !fixture.rawPayloadStored &&
      !fixture.executesProductionTraffic &&
      !fixture.downstreamMutationAllowed &&
      !fixture.credentialUseAllowed
    ),
    'Counterexample replay generator: every fixture preserves no-side-effect invariants',
  );
  ok(
    result.fixtures.some((fixture) =>
      fixture.kind === 'crypto-transaction-abuse' &&
      fixture.actionSurface === 'wallet-rpc.erc20_approve'
    ),
    'Counterexample replay generator: crypto transaction abuse fixture binds to the crypto adapter surface',
  );
  excludes(
    serialized,
    /unreviewed\.importer|raw_recipient_must_not_escape|private_threshold_must_not_escape/iu,
    'Counterexample replay generator: serialized output excludes raw producer and private markers',
  );
}

function testGeneratorCapsFixturesAndFailsClosedOnInvalidSources(): void {
  const contract = candidateContract();
  const activeQuestions = createActiveQuestionEngine({
    policyCandidatePrContract: contract,
    generatedAt: '2026-05-17T09:06:00.000Z',
    maxQuestions: 10,
  });
  const capped = createCounterexampleReplayGenerator({
    policyCandidatePrContract: contract,
    activeQuestionEngine: activeQuestions,
    generatedAt: '2026-05-17T09:07:00.000Z',
    maxFixturesPerCandidate: 2,
  });

  equal(capped.fixtureCount, contract.candidateCount * 2, 'Counterexample replay generator: maxFixturesPerCandidate caps per candidate');
  ok(capped.omittedFixtureCount > 0, 'Counterexample replay generator: omitted fixtures are counted');

  throws(
    () => createCounterexampleReplayGenerator({
      policyCandidatePrContract: contract,
      activeQuestionEngine: activeQuestions,
      maxFixturesPerCandidate: 0,
    }),
    /maxFixturesPerCandidate must be an integer from 1 to 25/u,
    'Counterexample replay generator: zero maxFixturesPerCandidate fails closed',
  );
  throws(
    () => createCounterexampleReplayGenerator({
      policyCandidatePrContract: contract,
      activeQuestionEngine: activeQuestions,
      generatedAt: 'not-a-date',
    }),
    /generatedAt must be an ISO timestamp/u,
    'Counterexample replay generator: invalid generatedAt fails closed',
  );
  throws(
    () => createCounterexampleReplayGenerator({
      policyCandidatePrContract: contract,
      activeQuestionEngine: {
        ...activeQuestions,
        policyCandidatePrContractDigest:
          'sha256:abababababababababababababababababababababababababababababababab',
      },
    }),
    /source digest must match policy candidate PR contract digest/u,
    'Counterexample replay generator: mismatched active-question source digest fails closed',
  );
}

function testDescriptorDocsAndTrackersStayAligned(): void {
  const descriptor = counterexampleReplayGeneratorDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'counterexample-replay-generator.md');
  const activeQuestionDoc = readProjectFile('docs', '02-architecture', 'active-question-engine.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.counterexample-replay-generator.v1', 'Counterexample replay generator: descriptor version is explicit');
  equal(descriptor.defaultMaxFixturesPerCandidate, 9, 'Counterexample replay generator: descriptor records default fixture cap');
  equal(descriptor.autoEnforce, false, 'Counterexample replay generator: descriptor never auto-enforces');
  equal(descriptor.executesProductionTraffic, false, 'Counterexample replay generator: descriptor blocks production traffic');
  ok(descriptor.fixtureKinds.includes('crypto-transaction-abuse'), 'Counterexample replay generator: descriptor lists crypto abuse fixture');
  ok(descriptor.expectedOutcomes.includes('block'), 'Counterexample replay generator: descriptor lists block outcome');

  for (const expected of [
    '# Counterexample Replay Generator',
    'attestor.counterexample-replay-generator.v1',
    'tenant-mismatch',
    'stale-approval',
    'missing-evidence',
    'bypass-route',
    'repeated-action',
    'prompt-injection',
    'tool-poisoning',
    'unsafe-approval',
    'crypto-transaction-abuse',
    'syntheticOnly = true',
    'executesProductionTraffic = false',
    'OWASP Top 10 for LLM Applications',
    'OWASP Agentic AI',
    'OWASP MCP Tool Poisoning',
    'NIST AI RMF Generative AI Profile',
    'OPA policy testing',
    'OPA decision logs',
    'Cedar policy validation',
  ]) {
    includes(doc, expected, `Counterexample replay generator doc: records ${expected}`);
  }

  for (const expected of [
    '| Complete | 23 |',
    '| Remaining | 3 |',
    '| 18 | complete | Active Question Engine |',
    '| 19 | complete | Counterexample replay generator |',
    '| 20 | complete | Policy Twin backtest |',
    'completion of steps 24-26',
  ]) {
    includes(masterPlan, expected, `Counterexample replay generator: master plan records ${expected}`);
  }

  includes(
    ledger,
    '### 61. Counterexample Replay Generator',
    'Counterexample replay generator: research ledger entry is present',
  );
  includes(
    systemOverview,
    '[Counterexample replay generator](counterexample-replay-generator.md)',
    'Counterexample replay generator: system overview links doc',
  );
  includes(
    activeQuestionDoc,
    '[Counterexample Replay Generator](counterexample-replay-generator.md)',
    'Counterexample replay generator: active question doc links next contract',
  );
  includes(
    readme,
    '[Counterexample replay generator](docs/02-architecture/counterexample-replay-generator.md)',
    'Counterexample replay generator: README links doc',
  );
  assert.equal(
    packageJson.scripts['test:counterexample-replay-generator'],
    'tsx tests/counterexample-replay-generator.test.ts',
    'Counterexample replay generator: package script is registered',
  );
  passed += 1;

  excludes(
    doc,
    /\bproduction-ready\b(?![\s\S]{0,80}(not|without|until|claim|readiness|evidence))/iu,
    'Counterexample replay generator doc: does not make an unqualified production-ready claim',
  );
}

testGeneratorProducesTenantBoundSyntheticNegativeFixtures();
testGeneratorCapsFixturesAndFailsClosedOnInvalidSources();
testDescriptorDocsAndTrackersStayAligned();

console.log(`Counterexample replay generator tests: ${passed} passed, 0 failed`);
