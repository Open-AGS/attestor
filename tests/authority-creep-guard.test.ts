import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  AUTHORITY_CREEP_GUARD_VERSION,
  CONFLICT_ABSTENTION_GATE_VERSION,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
  createAssuranceCaseContract,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  createAssuranceMeasurementPlane,
  createAuthorityCreepGuard,
  createDecisionLineageGraph,
  createOutcomeIncidentFeedbackContract,
  createSignedAssurancePacket,
  createSignedAssurancePacketHistoryBinding,
  createSignedAssurancePacketSigningPayload,
  evaluateHumanComprehensionGate,
  authorityCreepGuardDescriptor,
  type AssuranceCaseContract,
  type ConflictAbstentionGateResult,
  type CreateSignedAssurancePacketInput,
  type DecisionLineageArtifactRefInput,
  type DecisionLineageGraphRecord,
  type SignedAssurancePacket,
  type SignedAssurancePacketSignature,
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

function sha(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

const tenantDigest = sha('tenant:authority-creep');
const scopeDigest = sha('scope:authority-creep');
const actorDigest = sha('actor:authority-creep');
const claimBodyDigest = sha('claim:authority-creep');
const strategyBodyDigest = sha('strategy:authority-creep');
const evidenceBodyDigest = sha('evidence:authority-creep');
const transitionReasonDigest = sha('transition:authority-creep');
const digestA = sha('a');
const digestB = sha('b');
const digestC = sha('c');
const digestD = sha('d');
const digestE = sha('e');
const digestF = sha('f');
const digestG = sha('g');

function fixtureAssuranceCase(): AssuranceCaseContract {
  const claim = createAssuranceCaseNode({
    nodeId: 'claim:authority-bounded',
    kind: 'claim',
    title: 'Candidate authority remains bounded',
    bodyDigest: claimBodyDigest,
    tenantRefDigest: tenantDigest,
    scopeDigest,
    createdByRefDigest: actorDigest,
    createdAt: '2026-05-18T20:00:00.000Z',
  });
  const strategy = createAssuranceCaseNode({
    nodeId: 'strategy:authority-bounded',
    kind: 'strategy',
    title: 'Measurement cannot become authority',
    bodyDigest: strategyBodyDigest,
    tenantRefDigest: tenantDigest,
    scopeDigest,
    createdByRefDigest: actorDigest,
    createdAt: '2026-05-18T20:00:01.000Z',
  });
  const evidence = createAssuranceCaseNode({
    nodeId: 'evidence:runtime-lineage',
    kind: 'evidence',
    title: 'Runtime lineage evidence',
    bodyDigest: evidenceBodyDigest,
    tenantRefDigest: tenantDigest,
    scopeDigest,
    createdByRefDigest: actorDigest,
    createdAt: '2026-05-18T20:00:02.000Z',
  });

  return createAssuranceCaseContract({
    caseId: 'case:authority-creep',
    tenantRefDigest: tenantDigest,
    rootClaimId: claim.nodeId,
    createdAt: '2026-05-18T20:00:00.000Z',
    lastReviewedAt: '2026-05-18T20:10:00.000Z',
    nodes: [claim, strategy, evidence],
    defeaters: [],
    transitions: [
      createAssuranceCaseTransition({
        transitionId: 'transition:create:claim',
        transitionKind: 'create-node',
        actorRefDigest: actorDigest,
        occurredAt: '2026-05-18T20:00:03.000Z',
        reasonDigest: transitionReasonDigest,
        nodeId: claim.nodeId,
        evidenceRefDigest: claim.digest,
      }),
      createAssuranceCaseTransition({
        transitionId: 'transition:create:strategy',
        transitionKind: 'create-node',
        actorRefDigest: actorDigest,
        occurredAt: '2026-05-18T20:00:04.000Z',
        reasonDigest: transitionReasonDigest,
        nodeId: strategy.nodeId,
        evidenceRefDigest: strategy.digest,
      }),
      createAssuranceCaseTransition({
        transitionId: 'transition:create:evidence',
        transitionKind: 'create-node',
        actorRefDigest: actorDigest,
        occurredAt: '2026-05-18T20:00:05.000Z',
        reasonDigest: transitionReasonDigest,
        nodeId: evidence.nodeId,
        evidenceRefDigest: evidence.digest,
      }),
    ],
  });
}

function lineageGraph(
  artifacts: readonly DecisionLineageArtifactRefInput[] = [],
  boundary = false,
): DecisionLineageGraphRecord {
  return createDecisionLineageGraph({
    assuranceCase: fixtureAssuranceCase(),
    lineageId: boundary ? 'lineage:authority-boundary' : 'lineage:authority-ready',
    generatedAt: '2026-05-18T20:11:00.000Z',
    builderRefDigest: actorDigest,
    artifactRefs: artifacts,
    policyActivationRequested: boundary,
  });
}

function measurementArtifact(targetNodeId: string): DecisionLineageArtifactRefInput {
  return {
    artifactId: 'artifact:measurement-plane',
    artifactKind: 'measurement-plane-record',
    artifactDigest: sha('measurement-plane-artifact'),
    sourceVersion: 'attestor.assurance-measurement-plane.v1',
    producedAt: '2026-05-18T20:09:00.000Z',
    producerRefDigest: actorDigest,
    targetNodeId,
  };
}

function conflictGate(): ConflictAbstentionGateResult {
  return {
    version: CONFLICT_ABSTENTION_GATE_VERSION,
    relationshipAwareMonotoneFusionVersion:
      'attestor.relationship-aware-monotone-fusion.v1',
    signalRelationshipContractVersion: 'attestor.signal-relationship-contract.v1',
    layerOpinionSchemaVersion: 'attestor.layer-opinion-schema.v1',
    modulatorAuthorityTierVersion: 'attestor.modulator-authority-tier.v1',
    envelopeRefDigest: digestA,
    outcome: 'continue',
    conflictScore: 0,
    abstentionScore: 0,
    uncertaintyScore: 0.1,
    coverageGapScore: 0,
    blockPressure: 0,
    reviewPressure: 0.1,
    maxGateScore: 0.1,
    reasonCodes: ['fixture'],
    reviewedInputs: {
      opinionCount: 1,
      relationshipCount: 1,
      modulatorCount: 1,
      abstentionCount: 0,
      contradictionCount: 0,
      conflictOpinionCount: 0,
    },
    noLoosening: true,
    failClosedOnUncertainty: true,
    runsAfterRelationshipAwareFusion: true,
    canAdmit: false,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };
}

function readyPacket(): SignedAssurancePacket {
  const historyVerification = Object.freeze({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    historyId: 'history:authority-creep',
    valid: true,
    failClosed: false,
    verifiedEntryCount: 1,
    rootDigest: digestC,
    firstEntryDigest: digestC,
    lastEntryDigest: digestD,
    failureReasons: [],
    reasonCodes: ['tamper-history-verified'],
    rawPayloadStored: false,
  });
  const humanComprehensionGate = evaluateHumanComprehensionGate({
    envelopeRefDigest: digestA,
    conflictGate: conflictGate(),
    reasonLineCandidates: [{
      lineId: 'line-1',
      severity: 'info',
      text: 'Authority creep fixture is compact.',
      sourceDigest: digestB,
      reasonCodes: ['fixture'],
      actionHint: null,
    }],
    activeQuestions: [],
    reviewLoad: {
      pendingReviewItemCount: 0,
      humanActionItemCount: 0,
      reviewerCapacityPerHour: 20,
      currentReviewRatePerMinute: 0,
    },
  });
  const input: CreateSignedAssurancePacketInput = {
    envelopeRefDigest: digestA,
    decisionBinding: {
      decision: 'block',
      decisionSourceDigest: digestB,
      reasonCodes: ['fixture'],
    },
    historyBinding: createSignedAssurancePacketHistoryBinding(historyVerification),
    historyVerification,
    humanComprehensionGate,
    policyRefDigests: [digestF],
    evidenceRefDigests: [digestG],
    signalRefDigests: [sha('signal:authority-creep')],
    relationshipRefDigests: [sha('relationship:authority-creep')],
    replayRefDigests: [sha('replay:authority-creep')],
    generatedAt: '2026-05-18T20:04:00.000Z',
  };
  const payload = createSignedAssurancePacketSigningPayload(input);
  const signature: SignedAssurancePacketSignature = {
    algorithm: 'external-kms',
    signature: `external-kms-signature:${payload.digest}`,
    signerRef: 'kms:authority-creep',
    publicKeyFingerprint: 'kms-fingerprint:authority-creep',
    signedAt: '2026-05-18T20:04:01.000Z',
    signingBoundary: 'external-kms-hsm',
    payloadDigest: payload.digest,
    productionReady: true,
  };
  return createSignedAssurancePacket({ ...input, signature });
}

function measurementPlane(requestedMetricUses: readonly ['policy-relaxation'] | readonly [] = []) {
  const feedback = createOutcomeIncidentFeedbackContract({
    assurancePacket: readyPacket(),
    generatedAt: '2026-05-18T20:05:00.000Z',
    feedbackEvents: [{
      eventId: 'receipt-1',
      sourceClass: 'downstream-receipt',
      sourceDigest: digestA,
      observedAt: '2026-05-18T20:04:30.000Z',
      state: 'receipted',
      outcome: 'succeeded',
      consequenceEffect: 'none',
      confidence: 0.95,
      replayRefDigest: digestB,
      reasonCodes: ['fixture'],
    }],
  });
  return createAssuranceMeasurementPlane({
    outcomeFeedback: feedback,
    auditEvidenceRefDigests: [digestC],
    metricWindow: {
      windowRefDigest: digestD,
      windowStartedAt: '2026-05-18T19:00:00.000Z',
      windowEndedAt: '2026-05-18T20:00:00.000Z',
      decisionCount: 20,
      reviewDecisionCount: 2,
      falseReviewCount: 0,
      falseAdmitRiskCount: 0,
      abstentionDecisionCount: 1,
      duplicateEvidenceDiscountCount: 1,
      conflictTriggerCount: 1,
      policyGapOpenedCount: 2,
      policyGapClosedCount: 1,
      humanDecisionTotalSeconds: 120,
      humanDecisionCount: 2,
      budgetPressureSignalCount: 0,
      measurementDegradedSeconds: 0,
    },
    requestedMetricUses,
    generatedAt: '2026-05-18T20:06:00.000Z',
  });
}

function testDescriptorDeclaresMeasurementIsNotAuthority(): void {
  const descriptor = authorityCreepGuardDescriptor();

  equal(descriptor.version, AUTHORITY_CREEP_GUARD_VERSION, 'Authority creep: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Authority creep: assurance case version is bound');
  ok(descriptor.sourceAnchors.includes('goodhart-law-measure-target-boundary'), 'Authority creep: Goodhart anchor is present');
  ok(descriptor.sourceAnchors.includes('nist-ai-rmf-measure-is-risk-input-not-authority'), 'Authority creep: NIST AI RMF anchor is present');
  equal(descriptor.detectsMeasurementAsAuthority, true, 'Authority creep: measurement-as-authority detection is declared');
  equal(descriptor.opensUndercuttingDefeater, true, 'Authority creep: undercutting defeat output is declared');
  equal(descriptor.doesNotMutateLineageGraph, true, 'Authority creep: lineage graph is read-only');
  equal(descriptor.measurementIsNotAuthority, true, 'Authority creep: measurement is not authority');
  equal(descriptor.canAdmit, false, 'Authority creep: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Authority creep: descriptor cannot enforce');
  ok(descriptor.nonClaims.includes('not-measurement-authority'), 'Authority creep: measurement-authority non-claim is present');
}

function testCleanLineageCreatesEvidenceOnly(): void {
  const graph = lineageGraph();
  const record = createAuthorityCreepGuard({
    lineageGraph: graph,
    guardId: 'guard:clean',
    evaluatedAt: '2026-05-18T20:12:00.000Z',
    evaluatorRefDigest: actorDigest,
    measurementPlane: measurementPlane(),
  });

  equal(record.outcome, 'authority-creep-evidence-ready', 'Authority creep: clean lineage creates evidence');
  equal(record.findings.length, 0, 'Authority creep: clean lineage has no findings');
  ok(record.evidenceNode !== null, 'Authority creep: evidence node is created');
  equal(record.openDefeater, null, 'Authority creep: clean lineage opens no defeater');
  equal(record.grantsAuthority, false, 'Authority creep: record grants no authority');
  equal(record.canAdmit, false, 'Authority creep: record cannot admit');
}

function testMeasurementAsClaimSupportOpensUndercuttingDefeater(): void {
  const graph = lineageGraph([
    measurementArtifact('claim:authority-bounded'),
  ]);
  const record = createAuthorityCreepGuard({
    lineageGraph: graph,
    guardId: 'guard:measurement-as-claim',
    evaluatedAt: '2026-05-18T20:12:00.000Z',
    evaluatorRefDigest: actorDigest,
    measurementPlane: measurementPlane(['policy-relaxation']),
  });

  equal(record.outcome, 'authority-creep-open-undercutting-defeater', 'Authority creep: finding opens undercutting defeat');
  ok(record.findings.includes('measurement-artifact-targets-claim'), 'Authority creep: measurement target finding is present');
  ok(record.findings.includes('measurement-policy-relaxation-requested'), 'Authority creep: policy relaxation finding is present');
  equal(record.opensUndercuttingDefeater, true, 'Authority creep: undercutting flag is set');
  ok(record.openDefeater !== null, 'Authority creep: defeater is created');
  equal(record.openDefeater?.kind, 'undercutting', 'Authority creep: defeater attacks inference, not evidence');
  equal(record.openDefeater?.attacksNodeId, 'claim:authority-bounded', 'Authority creep: root claim is attacked');
  equal(record.evidenceNode, null, 'Authority creep: no evidence node is created when finding exists');
}

function testLineageBoundaryCreatesUndercuttingMaterial(): void {
  const record = createAuthorityCreepGuard({
    lineageGraph: lineageGraph([], true),
    guardId: 'guard:lineage-boundary',
    evaluatedAt: '2026-05-18T20:12:00.000Z',
    evaluatorRefDigest: actorDigest,
  });

  equal(record.outcome, 'authority-creep-open-undercutting-defeater', 'Authority creep: lineage authority finding opens defeat');
  ok(record.findings.includes('lineage-policy-activation-requested'), 'Authority creep: lineage policy activation finding is present');
  ok(record.findings.includes('lineage-rejected-boundary'), 'Authority creep: lineage rejected-boundary finding is present');
  ok(record.openDefeater !== null, 'Authority creep: lineage finding creates defeater');
}

function testOwnBoundaryRequestsRejectWithoutCreatingCaseMaterial(): void {
  const record = createAuthorityCreepGuard({
    lineageGraph: lineageGraph(),
    guardId: 'guard:boundary',
    evaluatedAt: '2026-05-18T20:12:00.000Z',
    evaluatorRefDigest: actorDigest,
    rawPayloadRequested: true,
    policyActivationRequested: true,
  });

  equal(record.outcome, 'authority-creep-rejected-boundary', 'Authority creep: direct boundary request rejects');
  ok(record.findings.includes('raw-payload-requested'), 'Authority creep: raw payload finding is present');
  ok(record.findings.includes('policy-activation-requested'), 'Authority creep: policy activation finding is present');
  equal(record.openDefeater, null, 'Authority creep: rejected boundary does not create trusted defeat');
  equal(record.evidenceNode, null, 'Authority creep: rejected boundary does not create trusted evidence');
}

function testDeterminismAndNoMutation(): void {
  const graph = lineageGraph([measurementArtifact('strategy:authority-bounded')]);
  const input = {
    lineageGraph: graph,
    guardId: 'guard:deterministic',
    evaluatedAt: '2026-05-18T20:12:00.000Z',
    evaluatorRefDigest: actorDigest,
  };
  const before = JSON.stringify(input);
  const first = createAuthorityCreepGuard(input);
  const second = createAuthorityCreepGuard(input);

  equal(first.digest, second.digest, 'Authority creep: identical input yields identical digest');
  equal(JSON.stringify(input), before, 'Authority creep: input is not mutated');
  ok(Object.isFrozen(first), 'Authority creep: output is frozen');
  ok(first.findings.includes('measurement-artifact-targets-strategy'), 'Authority creep: strategy-targeted measurement finding is present');
  throws(
    () => createAuthorityCreepGuard({
      ...input,
      evaluatorRefDigest: 'not-a-digest',
    }),
    /evaluatorRefDigest must be a sha256 digest/u,
    'Authority creep: invalid evaluator digest fails closed',
  );
  throws(
    () => createAuthorityCreepGuard({
      ...input,
      targetClaimNodeId: 'claim:missing',
    }),
    /target claim node must exist/u,
    'Authority creep: missing target claim fails closed',
  );
}

function testDocsAndPackageSurface(): void {
  const docs = readProjectFile('docs', '02-architecture', 'authority-creep-guard.md');
  const overview = readProjectFile('docs', '02-architecture', 'consequence-runtime-assurance-overview.md');
  const annex = readProjectFile('docs', 'research', 'cross-domain-pattern-sources.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageProbe = readProjectFile('scripts', 'probe', 'probe-consequence-admission-package-surface.mjs');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(docs, '# Authority-Creep Guard', 'Authority creep docs: title is present');
  includes(docs, 'attestor.authority-creep-guard.v1', 'Authority creep docs: version is present');
  includes(docs, 'not-measurement-authority', 'Authority creep docs: measurement-authority non-claim is present');
  includes(overview, 'Progress: 14/14 complete after I13. 0 steps remain.', 'Overview: I12 progress is updated');
  includes(overview, '| I12 | complete | Goodhart / Authority-Creep Guard |', 'Overview: I12 is complete');
  includes(overview, 'src/consequence-admission/authority-creep-guard.ts', 'Overview: I12 source file is tracked');
  includes(annex, 'Authority-creep guard', 'Research annex: I12 anchor is present');
  includes(ledger, 'docs/02-architecture/authority-creep-guard.md', 'Research ledger: I12 doc is indexed');
  includes(packageProbe, 'AUTHORITY_CREEP_GUARD_VERSION', 'Package probe: I12 version is checked');
  includes(packageProbe, 'createAuthorityCreepGuard', 'Package probe: I12 builder is checked');
  equal(
    packageJson.scripts['test:authority-creep-guard'],
    'tsx tests/authority-creep-guard.test.ts',
    'Authority creep: package script is registered',
  );
}

testDescriptorDeclaresMeasurementIsNotAuthority();
testCleanLineageCreatesEvidenceOnly();
testMeasurementAsClaimSupportOpensUndercuttingDefeater();
testLineageBoundaryCreatesUndercuttingMaterial();
testOwnBoundaryRequestsRejectWithoutCreatingCaseMaterial();
testDeterminismAndNoMutation();
testDocsAndPackageSurface();

console.log(`Authority creep guard tests: ${passed} passed, 0 failed`);
