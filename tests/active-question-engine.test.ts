import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  activeQuestionEngineDescriptor,
  createActionSurfaceGraph,
  createActiveQuestionEngine,
  createCanonicalShadowEvent,
  createEvidenceStateModel,
  createPolicyCandidatePrContract,
  type CanonicalShadowEvent,
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
const traceA = 'sha256:6666666666666666666666666666666666666666666666666666666666666666';
const schemaA = 'sha256:7777777777777777777777777777777777777777777777777777777777777777';
const questionA = 'sha256:9999999999999999999999999999999999999999999999999999999999999999';

function canonicalEvent(input: {
  readonly occurredAt: string;
  readonly sourceKind: 'admission-shadow' | 'target-system-shadow' | 'integration-declaration';
  readonly producer?: string;
  readonly targetSystem?: string;
  readonly actionName?: string;
  readonly observedConsequenceClass?: 'financial' | 'data-movement' | null;
  readonly inferredConsequenceClass?: 'financial' | 'data-movement' | null;
  readonly resourceRefDigest?: string | null;
  readonly policyRefs?: boolean;
  readonly evidenceRefs?: boolean;
  readonly approvalRefs?: boolean;
  readonly receiptRefs?: boolean;
  readonly simulationRefs?: boolean;
}): CanonicalShadowEvent {
  return createCanonicalShadowEvent({
    occurredAt: input.occurredAt,
    observedAt: input.occurredAt,
    sourceKind: input.sourceKind,
    producer: input.producer ?? 'attestor.active-question-engine.test',
    tenantRefDigest: tenantA,
    actorRefDigest: actorA,
    observed: {
      targetSystem: input.targetSystem ?? 'refund-service',
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
        occurredAt: '2026-03-01T08:00:00.000Z',
        sourceKind: 'integration-declaration',
        producer: 'unreviewed.importer',
        targetSystem: 'crm-export',
        actionName: 'export_customer_data',
        resourceRefDigest: null,
        inferredConsequenceClass: 'data-movement',
      }),
    ],
  });
  const model = createEvidenceStateModel({
    graph,
    generatedAt: '2026-05-17T09:00:00.000Z',
    maxEvidenceAgeMs: 2 * 60 * 60 * 1000,
    trustedProducers: ['attestor.active-question-engine.test'],
    approvedSurfaceIds: graph.surfaces.map((surface) => surface.surfaceId),
  });
  const refund = model.surfaces.find((surface) =>
    surface.actionSurface === 'refund-service.issue_refund'
  );
  const exportSurface = model.surfaces.find((surface) =>
    surface.actionSurface === 'crm-export.export_customer_data'
  );
  assert.ok(refund);
  assert.ok(exportSurface);
  return createPolicyCandidatePrContract({
    evidenceStateModel: model,
    generatedAt: '2026-05-17T09:05:00.000Z',
    schemaDigest: schemaA,
    replayDigestBySurfaceId: {
      [refund.surfaceId]: replayA,
    },
    questionDigestsBySurfaceId: {
      [exportSurface.surfaceId]: [questionA],
    },
  });
}

function testEngineRanksSmallHighImpactQuestions(): void {
  const contract = candidateContract();
  const result = createActiveQuestionEngine({
    policyCandidatePrContract: contract,
    generatedAt: '2026-05-17T09:06:00.000Z',
    maxQuestions: 3,
  });
  const serialized = JSON.stringify(result);

  equal(result.version, 'attestor.active-question-engine.v1', 'Active question engine: version is explicit');
  equal(result.policyCandidatePrContractDigest, contract.digest, 'Active question engine: candidate PR digest is retained');
  equal(result.tenantRefDigest, tenantA, 'Active question engine: tenant digest is retained');
  equal(result.candidateCount, 2, 'Active question engine: candidate count is retained');
  equal(result.questionCount, 3, 'Active question engine: maxQuestions limits output');
  ok(result.omittedQuestionCount > 0, 'Active question engine: omitted lower-impact questions are counted');
  equal(result.status, 'questions-required', 'Active question engine: status requires questions');
  equal(result.approvalRequired, true, 'Active question engine: approval remains required');
  equal(result.autoEnforce, false, 'Active question engine: engine never auto-enforces');
  equal(result.activatesEnforcement, false, 'Active question engine: engine cannot activate enforcement');
  equal(result.productionReady, false, 'Active question engine: production readiness is not claimed');
  ok(result.questions.some((question) => question.kind === 'bind-missing-evidence'), 'Active question engine: missing evidence question is present');
  ok(result.questions.some((question) => question.kind === 'approve-or-replace-producer'), 'Active question engine: producer trust question is present');
  ok(result.questions.every((question, index, list) =>
    index === 0 || list[index - 1]!.priorityScore >= question.priorityScore
  ), 'Active question engine: questions are sorted by descending priority');
  ok(result.questions.every((question) => question.questionDigest.startsWith('sha256:')), 'Active question engine: every question has a digest');
  ok(result.questions.every((question) => question.decisionSupportOnly), 'Active question engine: questions are decision support only');
  ok(!serialized.includes('raw_recipient_must_not_escape'), 'Active question engine: raw recipient is not serialized');
  ok(!serialized.includes('unreviewed.importer'), 'Active question engine: raw producer string is not serialized');
}

function testEngineCanFocusOnlyApprovalQuestions(): void {
  const contract = candidateContract();
  const result = createActiveQuestionEngine({
    policyCandidatePrContract: contract,
    generatedAt: '2026-05-17T09:06:00.000Z',
    maxQuestions: 10,
    includeApprovalQuestions: true,
  });

  ok(
    result.questions.some((question) =>
      question.kind === 'approve-or-dismiss-candidate' &&
      question.expectedAnswerKind === 'approval-decision'
    ),
    'Active question engine: approval-ready candidates create approval questions',
  );
  ok(
    result.questions.some((question) =>
      question.kind === 'answer-review-gate' &&
      question.sourceQuestionDigests.includes(questionA)
    ),
    'Active question engine: existing question digests become review-gate questions',
  );
}

function testEngineFailsClosedOnInvalidInputs(): void {
  const contract = candidateContract();

  throws(
    () => createActiveQuestionEngine({
      policyCandidatePrContract: contract,
      maxQuestions: 0,
    }),
    /maxQuestions must be an integer from 1 to 25/u,
    'Active question engine: zero maxQuestions fails closed',
  );
  throws(
    () => createActiveQuestionEngine({
      policyCandidatePrContract: contract,
      generatedAt: 'not-a-date',
    }),
    /generatedAt must be an ISO timestamp/u,
    'Active question engine: invalid generatedAt fails closed',
  );
}

function testDescriptorDocsAndTrackersStayAligned(): void {
  const descriptor = activeQuestionEngineDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'active-question-engine.md');
  const candidateDoc = readProjectFile('docs', '02-architecture', 'policy-candidate-pr-contract.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.active-question-engine.v1', 'Active question engine: descriptor version is explicit');
  equal(descriptor.defaultMaxQuestions, 5, 'Active question engine: descriptor records default max questions');
  equal(descriptor.autoEnforce, false, 'Active question engine: descriptor never auto-enforces');
  equal(descriptor.activatesEnforcement, false, 'Active question engine: descriptor cannot activate enforcement');
  ok(descriptor.questionKinds.includes('bind-missing-evidence'), 'Active question engine: descriptor lists missing evidence question kind');
  ok(descriptor.expectedAnswerKinds.includes('approval-decision'), 'Active question engine: descriptor lists approval decision answer kind');

  for (const expected of [
    '# Active Question Engine',
    'attestor.active-question-engine.v1',
    'riskReductionScore',
    'eventCoverageScore',
    'reviewLoadDeltaScore',
    'uncertaintyReductionScore',
    'approvalRequired = true',
    'autoEnforce = false',
    'Microsoft Human-AI Experience Toolkit',
    'Google People + AI Guidebook',
    'AWS IAM Access Analyzer policy generation',
    'Google Cloud role recommendations',
    'Cedar policy validation',
    'OPA policy testing',
    'OPA decision logs',
  ]) {
    includes(doc, expected, `Active question engine doc: records ${expected}`);
  }

  for (const expected of [
    '| Complete | 22 |',
    '| Remaining | 4 |',
    '| 17 | complete | Policy Candidate PR contract |',
    '| 18 | complete | Active Question Engine |',
    '| 19 | complete | Counterexample replay generator |',
    '| 20 | complete | Policy Twin backtest |',
    'completion of steps 23-26',
  ]) {
    includes(masterPlan, expected, `Active question engine: master plan records ${expected}`);
  }

  includes(
    ledger,
    '### 60. Active Question Engine',
    'Active question engine: research ledger entry is present',
  );
  includes(
    systemOverview,
    '[Active Question Engine](active-question-engine.md)',
    'Active question engine: system overview links doc',
  );
  includes(
    candidateDoc,
    '[Active Question Engine](active-question-engine.md)',
    'Active question engine: candidate contract doc links next contract',
  );
  includes(
    readme,
    '[Active Question Engine](docs/02-architecture/active-question-engine.md)',
    'Active question engine: README links doc',
  );
  assert.equal(
    packageJson.scripts['test:active-question-engine'],
    'tsx tests/active-question-engine.test.ts',
    'Active question engine: package script is registered',
  );
  passed += 1;

  excludes(
    doc,
    /\bproduction-ready\b(?![\s\S]{0,80}(not|without|until|claim|readiness|evidence))/iu,
    'Active question engine doc: does not make an unqualified production-ready claim',
  );
}

testEngineRanksSmallHighImpactQuestions();
testEngineCanFocusOnlyApprovalQuestions();
testEngineFailsClosedOnInvalidInputs();
testDescriptorDocsAndTrackersStayAligned();

console.log(`Active question engine tests: ${passed} passed, 0 failed`);
