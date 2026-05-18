import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  DECISION_LINEAGE_GRAPH_VERSION,
  OUTCOME_FEEDBACK_COE_WIRING_VERSION,
  OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
  SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
  SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION,
  createCanonicalShadowEvent,
  createOutcomeIncidentFeedbackContract,
  createShadowActivationProfileContract,
  createShadowDispatchClaimContract,
  createShadowOutboxWorkItemContract,
  runShadowRuntimeActivation,
  runShadowRuntimeObservabilityHooks,
  runShadowRuntimeOutcomeFeedbackHook,
  shadowRuntimeOutcomeFeedbackHookDescriptor,
  type ShadowRuntimeObservabilityHooksResult,
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
const digestF = `sha256:${'f'.repeat(64)}`;
const observedAt = '2026-05-19T12:00:00.000Z';
const feedbackAt = '2026-05-19T12:05:00.000Z';

function fixtureActivation() {
  const event = createCanonicalShadowEvent({
    occurredAt: '2026-05-19T11:58:00.000Z',
    sourceKind: 'target-system-shadow',
    producer: 'attestor.shadow-runtime-outcome-feedback-hook.test',
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
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: null,
      resourceRefDigest: null,
      dataClass: null,
      amountAssetChain: null,
      authorityDelta: null,
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestA, origin: 'observed' }],
    approvalRefs: [{ kind: 'approval', digest: digestB, origin: 'operator-supplied' }],
    receiptRefs: [{ kind: 'receipt', digest: digestC, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digestD, origin: 'observed' }],
    replayRefDigest: digestE,
    rawMaterialPolicy: 'digest-only',
  });
  const profile = createShadowActivationProfileContract({
    sourceEventDigest: event.digest,
    tenantRefDigest: event.tenantRefDigest,
    sourcePartitionDigest: digestC,
    traceContextDigest: digestD,
  });
  const workItem = createShadowOutboxWorkItemContract({
    activationProfile: profile,
    sourceHistoryRefDigest: digestE,
    requestedAt: '2026-05-19T11:59:00.000Z',
    sourceHistorySequence: 42,
  });
  const claim = createShadowDispatchClaimContract({
    workItem,
    workerRefDigest: digestF,
    claimedAt: '2026-05-19T11:59:30.000Z',
    dispatcherRunDigest: digestD,
  });
  return runShadowRuntimeActivation({
    claim,
    event,
    generatedAt: '2026-05-19T12:00:00.000Z',
  });
}

function fixtureObservability(
  activation = fixtureActivation(),
): ShadowRuntimeObservabilityHooksResult {
  return runShadowRuntimeObservabilityHooks({
    activation,
    observedAt,
    observerRefDigest: digestF,
    scopeDigest: digestB,
  });
}

function incidentFeedback(activation: ReturnType<typeof fixtureActivation>) {
  return createOutcomeIncidentFeedbackContract({
    assurancePacket: activation.pipeline.assurancePacket,
    generatedAt: feedbackAt,
    feedbackEvents: [{
      eventId: 'incident-1',
      sourceClass: 'confirmed-incident',
      sourceDigest: digestA,
      observedAt: '2026-05-19T12:03:00.000Z',
      state: 'incident',
      outcome: 'failed',
      consequenceEffect: 'tenant-impact',
      confidence: 0.99,
      incidentRefDigest: digestC,
      replayRefDigest: digestD,
      actionItemDigests: [digestE],
      reasonCodes: ['downstream:failed'],
    }],
  });
}

function positiveFeedback(activation: ReturnType<typeof fixtureActivation>) {
  return createOutcomeIncidentFeedbackContract({
    assurancePacket: activation.pipeline.assurancePacket,
    generatedAt: feedbackAt,
    feedbackEvents: [{
      eventId: 'receipt-1',
      sourceClass: 'downstream-receipt',
      sourceDigest: digestA,
      observedAt: '2026-05-19T12:03:00.000Z',
      state: 'receipted',
      outcome: 'succeeded',
      consequenceEffect: 'bounded',
      confidence: 0.98,
      replayRefDigest: digestD,
    }],
  });
}

function testDescriptorRecordsBoundary(): void {
  const descriptor = shadowRuntimeOutcomeFeedbackHookDescriptor();

  equal(descriptor.version, SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION, 'R07: descriptor version is explicit');
  equal(descriptor.shadowRuntimeObservabilityHooksVersion, SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION, 'R07: descriptor binds R06 observability');
  equal(descriptor.outcomeIncidentFeedbackContractVersion, OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION, 'R07: descriptor binds outcome incident feedback');
  equal(descriptor.outcomeFeedbackCoeWiringVersion, OUTCOME_FEEDBACK_COE_WIRING_VERSION, 'R07: descriptor binds COE wiring');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'R07: descriptor binds assurance case');
  equal(descriptor.decisionLineageGraphVersion, DECISION_LINEAGE_GRAPH_VERSION, 'R07: descriptor binds lineage graph');
  ok(descriptor.sourceAnchors.includes('aws-correction-of-error-systemic-action-items'), 'R07: AWS COE anchor is present');
  ok(descriptor.sourceAnchors.includes('w3c-prov-outcome-feedback-lineage'), 'R07: W3C PROV anchor is present');
  equal(descriptor.requiresR06Observability, true, 'R07: R06 observability input is required');
  equal(descriptor.requiresPacketDigestBinding, true, 'R07: packet digest binding is required');
  equal(descriptor.producesDerivedAssuranceCaseValue, true, 'R07: derived assurance case value is explicit');
  equal(descriptor.writesAuditPlane, false, 'R07: descriptor cannot write audit plane');
  equal(descriptor.mutatesPolicy, false, 'R07: descriptor cannot mutate policy');
  equal(descriptor.activatesLearning, false, 'R07: descriptor cannot activate learning');
  equal(descriptor.activatesTraining, false, 'R07: descriptor cannot activate training');
  equal(descriptor.canAdmit, false, 'R07: descriptor cannot admit');
  equal(descriptor.productionReady, false, 'R07: descriptor is not production ready');
}

function testHookBindsIncidentFeedbackAndOpensDefeater(): void {
  const activation = fixtureActivation();
  const observability = fixtureObservability(activation);
  const result = runShadowRuntimeOutcomeFeedbackHook({
    observability,
    feedback: incidentFeedback(activation),
    evaluatedAt: '2026-05-19T12:06:00.000Z',
    evaluatorRefDigest: digestF,
    coe: {
      coeRefDigest: digestA,
      impactRefDigest: digestB,
      timelineRefDigest: digestC,
      fiveWhysRefDigest: digestD,
      actionItemDigests: [digestE],
    },
  });

  equal(result.version, SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION, 'R07: result version is explicit');
  equal(result.hookStatus, 'outcome-feedback-bound', 'R07: result status is outcome-feedback-bound');
  equal(result.executionMode, 'shadow-only', 'R07: result remains shadow-only');
  equal(result.observabilityDigest, observability.digest, 'R07: observability digest is bound');
  equal(result.feedbackAssurancePacketDigest, observability.runtimeMonitor.packetDigest, 'R07: feedback packet digest matches observed packet');
  equal(result.coeWiringDigest, result.coeWiring.digest, 'R07: COE wiring digest is bound');
  equal(result.feedbackBoundAssuranceCaseDigest, result.feedbackBoundAssuranceCase.digest, 'R07: derived assurance case digest is bound');
  equal(result.lineageGraphDigest, result.lineageGraph.digest, 'R07: lineage digest is bound');
  equal(result.feedbackOpenedDefeater, true, 'R07: incident feedback opens a rebutting defeater');
  equal(result.opensRebuttingDefeater, true, 'R07: rebutting defeater flag is explicit');
  equal(result.feedbackAppliedAsEvidence, false, 'R07: failed outcome is not applied as positive evidence');
  equal(result.coeRequired, true, 'R07: COE is required for negative outcome');
  equal(result.coeComplete, true, 'R07: provided COE refs satisfy the COE completeness check');
  equal(result.feedbackBoundAssuranceCase.openDefeaterCount, 1, 'R07: derived case carries the open defeater');
  equal(result.lineageGraph.artifactCount, 3, 'R07: lineage includes observability, feedback, and COE artifacts');
  equal(result.writesAuditPlane, false, 'R07: result cannot write audit plane');
  equal(result.mutatesPolicy, false, 'R07: result cannot mutate policy');
  equal(result.activatesLearning, false, 'R07: result cannot activate learning');
  equal(result.canAdmit, false, 'R07: result cannot admit');
  equal(result.productionReady, false, 'R07: result is not production ready');
  ok(result.reasonCodes.includes('assurance-case:rebutting-defeater-opened'), 'R07: reason codes record rebutting defeater');
}

function testHookIsDeterministicAndDoesNotMutateInputs(): void {
  const activation = fixtureActivation();
  const observability = fixtureObservability(activation);
  const feedback = incidentFeedback(activation);
  const beforeObservability = JSON.stringify(observability);
  const beforeFeedback = JSON.stringify(feedback);
  const input = {
    observability,
    feedback,
    evaluatedAt: '2026-05-19T12:06:00.000Z',
    evaluatorRefDigest: digestF,
    coe: {
      coeRefDigest: digestA,
      impactRefDigest: digestB,
      timelineRefDigest: digestC,
      fiveWhysRefDigest: digestD,
      actionItemDigests: [digestE],
    },
  } as const;
  const first = runShadowRuntimeOutcomeFeedbackHook(input);
  const second = runShadowRuntimeOutcomeFeedbackHook(input);

  equal(JSON.stringify(observability), beforeObservability, 'R07: observability input is not mutated');
  equal(JSON.stringify(feedback), beforeFeedback, 'R07: feedback input is not mutated');
  equal(first.coeWiringDigest, second.coeWiringDigest, 'R07: COE wiring digest is deterministic');
  equal(first.feedbackBoundAssuranceCaseDigest, second.feedbackBoundAssuranceCaseDigest, 'R07: derived case digest is deterministic');
  equal(first.lineageGraphDigest, second.lineageGraphDigest, 'R07: lineage digest is deterministic');
  equal(first.digest, second.digest, 'R07: full result digest is deterministic');
}

function testHookFailClosedForMismatchedOrUnsafeInputs(): void {
  const activation = fixtureActivation();
  const observability = fixtureObservability(activation);
  const feedback = positiveFeedback(activation);

  throws(
    () => runShadowRuntimeOutcomeFeedbackHook({
      observability: { ...observability, version: 'attestor.other.v1' } as never,
      feedback,
      evaluatedAt: '2026-05-19T12:06:00.000Z',
      evaluatorRefDigest: digestF,
    }),
    /observability\.version must be attestor\.shadow-runtime-observability-hooks\.v1/u,
    'R07: wrong observability version fails closed',
  );
  throws(
    () => runShadowRuntimeOutcomeFeedbackHook({
      observability,
      feedback: { ...feedback, assurancePacketDigest: digestF } as never,
      evaluatedAt: '2026-05-19T12:06:00.000Z',
      evaluatorRefDigest: digestF,
    }),
    /feedback assurance packet digest must match/u,
    'R07: feedback packet mismatch fails closed',
  );
  throws(
    () => runShadowRuntimeOutcomeFeedbackHook({
      observability,
      feedback,
      evaluatedAt: 'not-a-date',
      evaluatorRefDigest: digestF,
    }),
    /evaluatedAt must be an ISO timestamp/u,
    'R07: invalid timestamp fails closed',
  );
  throws(
    () => runShadowRuntimeOutcomeFeedbackHook({
      observability,
      feedback,
      evaluatedAt: '2026-05-19T12:06:00.000Z',
      evaluatorRefDigest: 'raw-evaluator',
    }),
    /evaluatorRefDigest must be a sha256 digest/u,
    'R07: raw evaluator id fails closed',
  );
}

function testDocsOverviewLedgerAndPackageSurfaceStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'shadow-runtime-outcome-feedback-hook.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const decisionPacket = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-activation-decision-packet.md',
  );
  const ledger = readProjectFile(
    'docs',
    'research',
    'attestor-research-provenance-ledger.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile('scripts', 'probe-consequence-admission-package-surface.mjs');

  for (const expected of [
    '# Shadow Runtime Outcome Feedback Hook',
    'attestor.shadow-runtime-outcome-feedback-hook.v1',
    'attestor.shadow-runtime-observability-hooks.v1',
    'attestor.outcome-incident-feedback-contract.v1',
    'attestor.outcome-feedback-coe-wiring.v1',
    'AWS Correction of Error',
    'W3C PROV',
    'NIST AI RMF Manage',
    'not audit-plane write',
    'not policy activation',
    'not learning activation',
    'not production readiness',
  ]) {
    includes(doc, expected, `R07 doc: records ${expected}`);
  }

  for (const expected of [
    'Progress: 7/8 complete after R07. 1 step remains.',
    '| R07 | complete | Outcome Feedback Hook |',
    'src/consequence-admission/shadow-runtime-outcome-feedback-hook.ts',
    'tests/shadow-runtime-outcome-feedback-hook.test.ts',
    'docs/02-architecture/shadow-runtime-outcome-feedback-hook.md',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  for (const expected of [
    'Current progress after R07:',
    '7/8 complete, 1 step remains.',
    '| R07 | complete | Outcome Feedback Hook |',
    'The next safe step is R08',
  ]) {
    includes(decisionPacket, expected, `Runtime activation packet: records ${expected}`);
  }

  includes(
    ledger,
    'docs/02-architecture/shadow-runtime-outcome-feedback-hook.md',
    'Research ledger: indexes R07 outcome feedback hook',
  );
  equal(
    packageJson.scripts['test:shadow-runtime-outcome-feedback-hook'],
    'tsx tests/shadow-runtime-outcome-feedback-hook.test.ts',
    'Package scripts: exposes R07 test',
  );
  includes(
    packageProbe,
    'SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION',
    'Package surface probe: covers R07 export',
  );
}

testDescriptorRecordsBoundary();
testHookBindsIncidentFeedbackAndOpensDefeater();
testHookIsDeterministicAndDoesNotMutateInputs();
testHookFailClosedForMismatchedOrUnsafeInputs();
testDocsOverviewLedgerAndPackageSurfaceStayAligned();

console.log(`shadow-runtime-outcome-feedback-hook tests passed (${passed} assertions)`);
