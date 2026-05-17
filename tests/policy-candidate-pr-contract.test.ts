import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createActionSurfaceGraph,
  createCanonicalShadowEvent,
  createEvidenceStateModel,
  createPolicyCandidatePrContract,
  policyCandidatePrContractDescriptor,
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
const basePolicyA = 'sha256:8888888888888888888888888888888888888888888888888888888888888888';
const questionA = 'sha256:9999999999999999999999999999999999999999999999999999999999999999';

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
}): CanonicalShadowEvent {
  return createCanonicalShadowEvent({
    occurredAt: input.occurredAt,
    observedAt: input.occurredAt,
    sourceKind: input.sourceKind,
    producer: input.producer ?? 'attestor.policy-candidate-pr-contract.test',
    tenantRefDigest: tenantA,
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

function completeEvidenceModel() {
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
    ],
  });
  const surface = graph.surfaces[0];
  assert.ok(surface);
  return createEvidenceStateModel({
    graph,
    generatedAt: '2026-05-17T09:00:00.000Z',
    maxEvidenceAgeMs: 2 * 60 * 60 * 1000,
    trustedProducers: ['attestor.policy-candidate-pr-contract.test'],
    approvedSurfaceIds: [surface.surfaceId],
  });
}

function blockedEvidenceModel() {
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
  return createEvidenceStateModel({
    graph,
    generatedAt: '2026-05-17T09:00:00.000Z',
    maxEvidenceAgeMs: 1,
    trustedProducers: ['attestor.policy-candidate-pr-contract.test'],
  });
}

function testApprovalReadyCandidateIsDigestBoundAndReviewOnly(): void {
  const model = completeEvidenceModel();
  const surface = model.surfaces[0];
  assert.ok(surface);
  const contract = createPolicyCandidatePrContract({
    evidenceStateModel: model,
    generatedAt: '2026-05-17T09:05:00.000Z',
    schemaDigest: schemaA,
    basePolicyBundleDigest: basePolicyA,
    replayDigestBySurfaceId: {
      [surface.surfaceId]: replayA,
    },
  });
  const candidate = contract.candidates[0];
  assert.ok(candidate);
  const text = JSON.stringify(contract);

  equal(contract.version, 'attestor.policy-candidate-pr-contract.v1', 'Policy candidate PR: version is explicit');
  equal(contract.evidenceStateModelDigest, model.digest, 'Policy candidate PR: evidence model digest is retained');
  equal(contract.graphDigest, model.graphDigest, 'Policy candidate PR: source graph digest is retained');
  equal(contract.tenantRefDigest, tenantA, 'Policy candidate PR: tenant digest is retained');
  equal(contract.candidateCount, 1, 'Policy candidate PR: one candidate is emitted');
  equal(contract.approvalReadyCount, 1, 'Policy candidate PR: clean replayed candidate is approval-ready');
  equal(contract.autoEnforce, false, 'Policy candidate PR: bundle never auto-enforces');
  equal(contract.activatesEnforcement, false, 'Policy candidate PR: bundle never activates enforcement');
  equal(contract.reviewMaterialOnly, true, 'Policy candidate PR: bundle is review material only');
  equal(candidate.diffKind, 'add-policy-candidate', 'Policy candidate PR: clean replayed surface can become a candidate diff');
  equal(candidate.approvalState, 'approval-ready', 'Policy candidate PR: clean replayed candidate is approval-ready');
  equal(candidate.replayDigest, replayA, 'Policy candidate PR: replay digest is retained');
  equal(candidate.schemaDigest, schemaA, 'Policy candidate PR: schema digest is retained');
  equal(candidate.basePolicyBundleDigest, basePolicyA, 'Policy candidate PR: base policy bundle digest is retained');
  equal(candidate.sourceEvidenceStateDigest, surface.digest, 'Policy candidate PR: source evidence surface digest is retained');
  equal(candidate.sourceEvidenceModelDigest, model.digest, 'Policy candidate PR: source evidence model digest is retained');
  equal(candidate.sourceGraphDigest, model.graphDigest, 'Policy candidate PR: source graph digest is retained');
  equal(candidate.sourceEventDigests.length, surface.sourceEventDigests.length, 'Policy candidate PR: source event digest set is retained');
  ok(candidate.proposedPolicyDigest.startsWith('sha256:'), 'Policy candidate PR: proposed policy is digest-only');
  ok(candidate.proposedPolicyPatch.afterDigest.startsWith('sha256:'), 'Policy candidate PR: patch after digest is set');
  equal(candidate.approvalRequired, true, 'Policy candidate PR: candidate approval remains required');
  equal(candidate.autoEnforce, false, 'Policy candidate PR: candidate never auto-enforces');
  equal(candidate.activatesEnforcement, false, 'Policy candidate PR: candidate cannot activate enforcement');
  equal(candidate.rawPayloadStored, false, 'Policy candidate PR: raw payload storage is prohibited');
  equal(candidate.productionReady, false, 'Policy candidate PR: production readiness is not claimed');
  ok(candidate.reviewChecklist.some((entry) => entry.includes('human reviewer')), 'Policy candidate PR: checklist is human-review oriented');
  ok(!text.includes('tenant_raw_must_not_escape'), 'Policy candidate PR: raw tenant value is not serialized');
  ok(!text.includes('customer_raw_must_not_escape'), 'Policy candidate PR: raw customer value is not serialized');
}

function testBlockedCandidateKeepsEvidenceGapsAndShadowPosture(): void {
  const model = blockedEvidenceModel();
  const surface = model.surfaces[0];
  assert.ok(surface);
  const contract = createPolicyCandidatePrContract({
    evidenceStateModel: model,
    schemaDigest: schemaA,
    questionDigestsBySurfaceId: {
      [surface.surfaceId]: [questionA],
    },
  });
  const candidate = contract.candidates[0];
  assert.ok(candidate);

  equal(contract.blockedCount, 1, 'Policy candidate PR: blocked candidate count is retained');
  equal(candidate.approvalState, 'blocked', 'Policy candidate PR: blocker state wins over questions');
  equal(candidate.diffKind, 'add-evidence-requirement', 'Policy candidate PR: missing fields become evidence requirement diffs');
  ok(candidate.missingEvidenceFields.includes('shadow-observation'), 'Policy candidate PR: missing shadow observation is carried');
  ok(candidate.missingEvidenceFields.includes('evidence-ref'), 'Policy candidate PR: missing evidence ref is carried');
  ok(candidate.inferredFields.includes('consequence-class'), 'Policy candidate PR: inferred fields are retained separately');
  ok(candidate.blockerReasonCodes.includes('untrusted-producer-present'), 'Policy candidate PR: untrusted producer blocker is carried');
  ok(candidate.reviewChecklist.includes('keep candidate in shadow until blockers are closed'), 'Policy candidate PR: blocked candidate stays in shadow');
  equal(candidate.autoEnforce, false, 'Policy candidate PR: blocked candidate never auto-enforces');
  equal(candidate.activatesEnforcement, false, 'Policy candidate PR: blocked candidate never activates enforcement');
}

function testContractFailsClosedOnInvalidOrUnsafeInputs(): void {
  const clean = completeEvidenceModel();
  const cleanSurface = clean.surfaces[0];
  assert.ok(cleanSurface);
  const blocked = blockedEvidenceModel();
  const blockedSurface = blocked.surfaces[0];
  assert.ok(blockedSurface);

  throws(
    () => createPolicyCandidatePrContract({
      evidenceStateModel: clean,
      schemaDigest: 'sha256:not-valid',
    }),
    /schemaDigest must be a sha256 digest/u,
    'Policy candidate PR: invalid schema digest fails closed',
  );
  throws(
    () => createPolicyCandidatePrContract({
      evidenceStateModel: clean,
      schemaDigest: schemaA,
      replayDigestBySurfaceId: {
        [cleanSurface.surfaceId]: replayA,
      },
      riskScoreBySurfaceId: {
        [cleanSurface.surfaceId]: 101,
      },
    }),
    /riskScoreBySurfaceId.*integer from 0 to 100/u,
    'Policy candidate PR: invalid risk score fails closed',
  );
  throws(
    () => createPolicyCandidatePrContract({
      evidenceStateModel: blocked,
      schemaDigest: schemaA,
      replayDigestBySurfaceId: {
        [blockedSurface.surfaceId]: replayA,
      },
      approvalStateBySurfaceId: {
        [blockedSurface.surfaceId]: 'approved',
      },
    }),
    /cannot mark blocked candidate/u,
    'Policy candidate PR: approved override with blockers fails closed',
  );
}

function testDescriptorDocsAndTrackersStayAligned(): void {
  const descriptor = policyCandidatePrContractDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-candidate-pr-contract.md');
  const evidenceDoc = readProjectFile('docs', '02-architecture', 'evidence-state-model.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.policy-candidate-pr-contract.v1', 'Policy candidate PR: descriptor version is explicit');
  equal(descriptor.tenantBound, true, 'Policy candidate PR: descriptor is tenant-bound');
  equal(descriptor.autoEnforce, false, 'Policy candidate PR: descriptor never auto-enforces');
  equal(descriptor.activatesEnforcement, false, 'Policy candidate PR: descriptor never activates enforcement');
  ok(descriptor.diffKinds.includes('add-policy-candidate'), 'Policy candidate PR: descriptor lists candidate diff');
  ok(descriptor.approvalStates.includes('approval-ready'), 'Policy candidate PR: descriptor lists approval-ready state');

  for (const expected of [
    '# Policy Candidate PR Contract',
    'attestor.policy-candidate-pr-contract.v1',
    'schemaDigest',
    'sourceEventDigests',
    'replayDigest',
    'questionDigests',
    'approvalState',
    'approvalRequired = true',
    'autoEnforce = false',
    'AWS IAM Access Analyzer policy generation',
    'Google Cloud role recommendations',
    'Cedar policy validation',
    'OPA policy testing',
    'OPA decision logs',
    'Terraform plan',
    'Kubernetes dry-run',
  ]) {
    includes(doc, expected, `Policy candidate PR doc: records ${expected}`);
  }

  for (const expected of [
    '| Complete | 24 |',
    '| Remaining | 2 |',
    '| 16 | complete | Evidence state model |',
    '| 17 | complete | Policy Candidate PR contract |',
    '| 18 | complete | Active Question Engine |',
    '| 19 | complete | Counterexample replay generator |',
    'completion of steps 25-26',
  ]) {
    includes(masterPlan, expected, `Policy candidate PR: master plan records ${expected}`);
  }

  includes(
    ledger,
    '### 59. Policy Candidate PR Contract',
    'Policy candidate PR: research ledger entry is present',
  );
  includes(
    systemOverview,
    '[policy candidate PR contract](policy-candidate-pr-contract.md)',
    'Policy candidate PR: system overview links doc',
  );
  includes(
    evidenceDoc,
    '[Policy Candidate PR Contract](policy-candidate-pr-contract.md)',
    'Policy candidate PR: evidence model links next contract',
  );
  includes(
    readme,
    '[Policy Candidate PR contract](docs/02-architecture/policy-candidate-pr-contract.md)',
    'Policy candidate PR: README links doc',
  );
  assert.equal(
    packageJson.scripts['test:policy-candidate-pr-contract'],
    'tsx tests/policy-candidate-pr-contract.test.ts',
    'Policy candidate PR: package script is registered',
  );
  passed += 1;

  excludes(
    doc,
    /\bproduction-ready\b(?![\s\S]{0,80}(not|without|until|claim|readiness|evidence))/iu,
    'Policy candidate PR doc: does not make an unqualified production-ready claim',
  );
}

testApprovalReadyCandidateIsDigestBoundAndReviewOnly();
testBlockedCandidateKeepsEvidenceGapsAndShadowPosture();
testContractFailsClosedOnInvalidOrUnsafeInputs();
testDescriptorDocsAndTrackersStayAligned();

console.log(`Policy candidate PR contract tests: ${passed} passed, 0 failed`);
