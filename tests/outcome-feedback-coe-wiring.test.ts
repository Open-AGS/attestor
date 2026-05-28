import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  CONFLICT_ABSTENTION_GATE_VERSION,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
  OUTCOME_FEEDBACK_COE_WIRING_VERSION,
  OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
  createAssuranceCaseContract,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  createOutcomeFeedbackCoeWiring,
  createOutcomeIncidentFeedbackContract,
  createSignedAssurancePacket,
  createSignedAssurancePacketHistoryBinding,
  createSignedAssurancePacketSigningPayload,
  evaluateHumanComprehensionGate,
  outcomeFeedbackCoeWiringDescriptor,
  type AssuranceCaseContract,
  type ConflictAbstentionGateResult,
  type CreateSignedAssurancePacketInput,
  type OutcomeIncidentFeedbackContract,
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

const tenantDigest = sha('tenant:outcome-coe');
const scopeDigest = sha('scope:outcome-coe');
const actorDigest = sha('actor:outcome-coe');
const claimBodyDigest = sha('claim:outcome-coe');
const evidenceBodyDigest = sha('evidence:outcome-coe');
const transitionReasonDigest = sha('transition:outcome-coe');
const digestA = sha('a');
const digestB = sha('b');
const digestC = sha('c');
const digestD = sha('d');
const digestE = sha('e');
const digestF = sha('f');
const digestG = sha('g');
const digestH = sha('h');

function fixtureAssuranceCase(): AssuranceCaseContract {
  const claim = createAssuranceCaseNode({
    nodeId: 'claim:outcome-bounded',
    kind: 'claim',
    title: 'Candidate remains valid after observed outcome feedback',
    bodyDigest: claimBodyDigest,
    tenantRefDigest: tenantDigest,
    scopeDigest,
    createdByRefDigest: actorDigest,
    createdAt: '2026-05-18T21:00:00.000Z',
  });
  const evidence = createAssuranceCaseNode({
    nodeId: 'evidence:prior-review',
    kind: 'evidence',
    title: 'Prior review evidence',
    bodyDigest: evidenceBodyDigest,
    tenantRefDigest: tenantDigest,
    scopeDigest,
    createdByRefDigest: actorDigest,
    createdAt: '2026-05-18T21:00:01.000Z',
  });

  return createAssuranceCaseContract({
    caseId: 'case:outcome-coe',
    tenantRefDigest: tenantDigest,
    rootClaimId: claim.nodeId,
    createdAt: '2026-05-18T21:00:00.000Z',
    lastReviewedAt: '2026-05-18T21:10:00.000Z',
    nodes: [claim, evidence],
    defeaters: [],
    transitions: [
      createAssuranceCaseTransition({
        transitionId: 'transition:create:outcome-claim',
        transitionKind: 'create-node',
        actorRefDigest: actorDigest,
        occurredAt: '2026-05-18T21:00:02.000Z',
        reasonDigest: transitionReasonDigest,
        nodeId: claim.nodeId,
        evidenceRefDigest: claim.digest,
      }),
      createAssuranceCaseTransition({
        transitionId: 'transition:create:prior-evidence',
        transitionKind: 'create-node',
        actorRefDigest: actorDigest,
        occurredAt: '2026-05-18T21:00:03.000Z',
        reasonDigest: transitionReasonDigest,
        nodeId: evidence.nodeId,
        evidenceRefDigest: evidence.digest,
      }),
    ],
  });
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
    historyId: 'history:outcome-coe',
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
      text: 'Outcome COE fixture is compact.',
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
    signalRefDigests: [sha('signal:outcome-coe')],
    relationshipRefDigests: [sha('relationship:outcome-coe')],
    replayRefDigests: [sha('replay:outcome-coe')],
    generatedAt: '2026-05-18T21:04:00.000Z',
  };
  const payload = createSignedAssurancePacketSigningPayload(input);
  const signature: SignedAssurancePacketSignature = {
    algorithm: 'external-kms',
    signature: `external-kms-signature:${payload.digest}`,
    signerRef: 'kms:outcome-coe',
    publicKeyFingerprint: 'kms-fingerprint:outcome-coe',
    signedAt: '2026-05-18T21:04:01.000Z',
    signingBoundary: 'external-kms-hsm',
    payloadDigest: payload.digest,
    productionReady: true,
  };
  return createSignedAssurancePacket({ ...input, signature });
}

function positiveFeedback(): OutcomeIncidentFeedbackContract {
  return createOutcomeIncidentFeedbackContract({
    assurancePacket: readyPacket(),
    generatedAt: '2026-05-18T21:05:00.000Z',
    feedbackEvents: [
      {
        eventId: 'receipt-1',
        sourceClass: 'downstream-receipt',
        sourceDigest: digestA,
        observedAt: '2026-05-18T21:04:30.000Z',
        state: 'receipted',
        outcome: 'succeeded',
        consequenceEffect: 'bounded',
        confidence: 0.98,
        replayRefDigest: digestB,
      },
      {
        eventId: 'review-1',
        sourceClass: 'reviewer-label',
        sourceDigest: digestC,
        observedAt: '2026-05-18T21:04:35.000Z',
        state: 'learned',
        outcome: 'succeeded',
        consequenceEffect: 'bounded',
        confidence: 0.95,
        reviewerRefDigest: digestD,
      },
    ],
  });
}

function incidentFeedback(actionItems: readonly string[] = [digestF]):
OutcomeIncidentFeedbackContract {
  return createOutcomeIncidentFeedbackContract({
    assurancePacket: readyPacket(),
    generatedAt: '2026-05-18T21:06:00.000Z',
    feedbackEvents: [{
      eventId: 'incident-1',
      sourceClass: 'confirmed-incident',
      sourceDigest: digestA,
      observedAt: '2026-05-18T21:05:30.000Z',
      state: 'incident',
      outcome: 'failed',
      consequenceEffect: 'customer-impact',
      confidence: 1,
      incidentRefDigest: digestB,
      postmortemRefDigest: digestC,
      replayRefDigest: digestD,
      actionItemDigests: actionItems,
    }],
  });
}

function inferredOnlyFeedback(): OutcomeIncidentFeedbackContract {
  return createOutcomeIncidentFeedbackContract({
    assurancePacket: readyPacket(),
    generatedAt: '2026-05-18T21:07:00.000Z',
    feedbackEvents: [{
      eventId: 'inferred-1',
      sourceClass: 'inferred-signal',
      sourceDigest: digestA,
      observedAt: '2026-05-18T21:06:30.000Z',
      state: 'receipted',
      outcome: 'unknown',
      consequenceEffect: 'none',
      confidence: 0.4,
    }],
  });
}

function completeCoe() {
  return {
    coeRefDigest: digestA,
    impactRefDigest: digestB,
    timelineRefDigest: digestC,
    fiveWhysRefDigest: digestD,
    actionItemDigests: [digestE],
  };
}

function testDescriptorDeclaresRebuttingFeedback(): void {
  const descriptor = outcomeFeedbackCoeWiringDescriptor();

  equal(descriptor.version, OUTCOME_FEEDBACK_COE_WIRING_VERSION, 'Outcome COE: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Outcome COE: assurance case version is bound');
  equal(descriptor.outcomeIncidentFeedbackContractVersion, OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION, 'Outcome COE: feedback version is bound');
  ok(descriptor.sourceAnchors.includes('aws-correction-of-error-systemic-action-items'), 'Outcome COE: AWS COE anchor is present');
  ok(descriptor.sourceAnchors.includes('google-sre-blameless-postmortem-action-items'), 'Outcome COE: Google SRE anchor is present');
  ok(descriptor.sourceAnchors.includes('nist-sp800-61r3-lessons-learned-lifecycle'), 'Outcome COE: NIST incident anchor is present');
  equal(descriptor.mapsOutcomeToRebuttingDefeater, true, 'Outcome COE: outcome maps to rebutting defeat');
  equal(descriptor.requiresCoeForNegativeOutcome, true, 'Outcome COE: negative outcomes require COE');
  equal(descriptor.requiresActionItemsForIncidentLearning, true, 'Outcome COE: action items are required');
  equal(descriptor.feedbackIsNotAuthority, true, 'Outcome COE: feedback is not authority');
  equal(descriptor.canAdmit, false, 'Outcome COE: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Outcome COE: descriptor cannot enforce');
  ok(descriptor.nonClaims.includes('not-coe-conformance'), 'Outcome COE: COE conformance non-claim is present');
}

function testPositiveFeedbackCreatesEvidenceOnly(): void {
  const record = createOutcomeFeedbackCoeWiring({
    assuranceCase: fixtureAssuranceCase(),
    feedback: positiveFeedback(),
    wiringId: 'wiring:positive',
    evaluatedAt: '2026-05-18T21:08:00.000Z',
    evaluatorRefDigest: actorDigest,
  });

  equal(record.outcome, 'outcome-feedback-coe-evidence-ready', 'Outcome COE: clean positive feedback creates evidence');
  equal(record.findings.length, 0, 'Outcome COE: clean positive feedback has no findings');
  ok(record.evidenceNode !== null, 'Outcome COE: evidence node is created');
  equal(record.openDefeater, null, 'Outcome COE: no defeater is opened for clean feedback');
  equal(record.coeRequired, false, 'Outcome COE: COE is not required for clean positive feedback');
  equal(record.coeComplete, true, 'Outcome COE: COE completeness is true when not required');
  equal(record.grantsAuthority, false, 'Outcome COE: record grants no authority');
  equal(record.canAdmit, false, 'Outcome COE: record cannot admit');
}

function testIncidentFeedbackOpensRebuttingDefeater(): void {
  const record = createOutcomeFeedbackCoeWiring({
    assuranceCase: fixtureAssuranceCase(),
    feedback: incidentFeedback(),
    wiringId: 'wiring:incident',
    evaluatedAt: '2026-05-18T21:08:00.000Z',
    evaluatorRefDigest: actorDigest,
    coe: completeCoe(),
  });

  equal(record.outcome, 'outcome-feedback-coe-open-rebutting-defeater', 'Outcome COE: incident opens rebutting defeat');
  ok(record.findings.includes('failed-outcome-observed'), 'Outcome COE: failed outcome finding is present');
  ok(record.findings.includes('confirmed-incident-observed'), 'Outcome COE: incident finding is present');
  ok(record.findings.includes('customer-impact-observed'), 'Outcome COE: customer impact finding is present');
  ok(record.findings.includes('replay-regression-required'), 'Outcome COE: replay finding is present');
  equal(record.coeRequired, true, 'Outcome COE: COE is required for incident feedback');
  equal(record.coeComplete, true, 'Outcome COE: complete COE refs are recognized');
  equal(record.opensRebuttingDefeater, true, 'Outcome COE: rebutting flag is set');
  ok(record.openDefeater !== null, 'Outcome COE: open defeater is created');
  equal(record.openDefeater?.kind, 'rebutting', 'Outcome COE: defeater attacks the claim');
  equal(record.openDefeater?.attacksNodeId, 'claim:outcome-bounded', 'Outcome COE: root claim is attacked');
}

function testMissingCoeMaterialStaysVisibleOnRebuttingDefeater(): void {
  const record = createOutcomeFeedbackCoeWiring({
    assuranceCase: fixtureAssuranceCase(),
    feedback: incidentFeedback([]),
    wiringId: 'wiring:missing-coe',
    evaluatedAt: '2026-05-18T21:08:00.000Z',
    evaluatorRefDigest: actorDigest,
    minimumActionItemCount: 2,
  });

  equal(record.outcome, 'outcome-feedback-coe-open-rebutting-defeater', 'Outcome COE: missing COE does not hide negative feedback');
  ok(record.findings.includes('coe-reference-missing'), 'Outcome COE: COE ref missing finding is present');
  ok(record.findings.includes('coe-impact-missing'), 'Outcome COE: impact ref missing finding is present');
  ok(record.findings.includes('coe-timeline-missing'), 'Outcome COE: timeline ref missing finding is present');
  ok(record.findings.includes('coe-five-whys-missing'), 'Outcome COE: five-whys ref missing finding is present');
  ok(record.findings.includes('coe-action-items-missing'), 'Outcome COE: action item finding is present');
  equal(record.coeComplete, false, 'Outcome COE: COE completeness is false');
  ok(record.openDefeater !== null, 'Outcome COE: rebutting defeater still opens');
}

function testInferredOnlyFeedbackIsHeldForBinding(): void {
  const record = createOutcomeFeedbackCoeWiring({
    assuranceCase: fixtureAssuranceCase(),
    feedback: inferredOnlyFeedback(),
    wiringId: 'wiring:inferred',
    evaluatedAt: '2026-05-18T21:08:00.000Z',
    evaluatorRefDigest: actorDigest,
  });

  equal(record.outcome, 'outcome-feedback-coe-held-for-feedback-binding', 'Outcome COE: inferred-only feedback is held');
  ok(record.findings.includes('only-inferred-feedback'), 'Outcome COE: inferred-only finding is present');
  equal(record.evidenceNode, null, 'Outcome COE: no evidence node for inferred-only feedback');
  equal(record.openDefeater, null, 'Outcome COE: no rebutting defeater without observed negative outcome');
}

function testBoundaryRequestsRejectWithoutCaseMaterial(): void {
  const record = createOutcomeFeedbackCoeWiring({
    assuranceCase: fixtureAssuranceCase(),
    feedback: positiveFeedback(),
    wiringId: 'wiring:boundary',
    evaluatedAt: '2026-05-18T21:08:00.000Z',
    evaluatorRefDigest: actorDigest,
    rawFeedbackRequested: true,
    policyActivationRequested: true,
  });

  equal(record.outcome, 'outcome-feedback-coe-rejected-boundary', 'Outcome COE: direct boundary request rejects');
  ok(record.findings.includes('raw-feedback-requested'), 'Outcome COE: raw feedback finding is present');
  ok(record.findings.includes('policy-activation-requested'), 'Outcome COE: policy activation finding is present');
  equal(record.evidenceNode, null, 'Outcome COE: rejected boundary creates no evidence');
  equal(record.openDefeater, null, 'Outcome COE: rejected boundary creates no trusted defeater');
}

function testDeterminismNoMutationAndValidation(): void {
  const assuranceCase = fixtureAssuranceCase();
  const feedback = incidentFeedback();
  const input = {
    assuranceCase,
    feedback,
    wiringId: 'wiring:deterministic',
    evaluatedAt: '2026-05-18T21:08:00.000Z',
    evaluatorRefDigest: actorDigest,
    coe: completeCoe(),
  };
  const before = JSON.stringify(input);
  const first = createOutcomeFeedbackCoeWiring(input);
  const second = createOutcomeFeedbackCoeWiring(input);

  equal(first.digest, second.digest, 'Outcome COE: identical input yields identical digest');
  equal(JSON.stringify(input), before, 'Outcome COE: input is not mutated');
  ok(Object.isFrozen(first), 'Outcome COE: output is frozen');
  throws(
    () => createOutcomeFeedbackCoeWiring({
      ...input,
      evaluatorRefDigest: 'not-a-digest',
    }),
    /evaluatorRefDigest must be a sha256 digest/u,
    'Outcome COE: invalid evaluator digest fails closed',
  );
  throws(
    () => createOutcomeFeedbackCoeWiring({
      ...input,
      targetClaimNodeId: 'claim:missing',
    }),
    /target claim node must exist/u,
    'Outcome COE: missing target claim fails closed',
  );
}

function testDocsAndPackageSurface(): void {
  const docs = readProjectFile('docs', '02-architecture', 'outcome-feedback-coe-wiring.md');
  const overview = readProjectFile('docs', '02-architecture', 'consequence-runtime-assurance-overview.md');
  const annex = readProjectFile('docs', 'research', 'cross-domain-pattern-sources.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageProbe = readProjectFile('scripts', 'probe', 'probe-consequence-admission-package-surface.mjs');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(docs, '# Outcome Feedback / COE Wiring', 'Outcome COE docs: title is present');
  includes(docs, 'attestor.outcome-feedback-coe-wiring.v1', 'Outcome COE docs: version is present');
  includes(docs, 'not-coe-conformance', 'Outcome COE docs: COE conformance non-claim is present');
  includes(overview, 'Progress: 14/14 complete after I13. 0 steps remain.', 'Overview: I13 progress is updated');
  includes(overview, '| I13 | complete | Outcome Feedback / COE Wiring |', 'Overview: I13 is complete');
  includes(overview, 'src/consequence-admission/outcome-feedback-coe-wiring.ts', 'Overview: I13 source file is tracked');
  includes(annex, 'Outcome feedback / COE wiring', 'Research annex: I13 anchor is present');
  includes(ledger, 'docs/02-architecture/outcome-feedback-coe-wiring.md', 'Research ledger: I13 doc is indexed');
  includes(packageProbe, 'OUTCOME_FEEDBACK_COE_WIRING_VERSION', 'Package probe: I13 version is checked');
  includes(packageProbe, 'createOutcomeFeedbackCoeWiring', 'Package probe: I13 builder is checked');
  equal(
    packageJson.scripts['test:outcome-feedback-coe-wiring'],
    'tsx tests/outcome-feedback-coe-wiring.test.ts',
    'Outcome COE: package script is registered',
  );
}

testDescriptorDeclaresRebuttingFeedback();
testPositiveFeedbackCreatesEvidenceOnly();
testIncidentFeedbackOpensRebuttingDefeater();
testMissingCoeMaterialStaysVisibleOnRebuttingDefeater();
testInferredOnlyFeedbackIsHeldForBinding();
testBoundaryRequestsRejectWithoutCaseMaterial();
testDeterminismNoMutationAndValidation();
testDocsAndPackageSurface();

console.log(`Outcome feedback COE wiring tests: ${passed} passed, 0 failed`);
