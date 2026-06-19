import assert from 'node:assert/strict';
import {
  createGenericAdmissionEnvelope,
  createInMemoryShadowAdmissionEventRecorder,
  createShadowAdmissionEvent,
  GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_GUARD_IDS,
  summarizeShadowAdmissionEvents,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

function baseAdmissionInput(mode: string) {
  return {
    mode,
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T19:00:00.000Z',
    decidedAt: '2026-05-01T19:00:01.000Z',
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    evidenceRefs: ['order:987', 'payment:456'],
    policyRef: 'policy:refunds:v1',
  };
}

function testShadowEventRedactsRawInputs(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseAdmissionInput('observe'),
    policyRef: null,
  });
  const event = createShadowAdmissionEvent({
    admission: envelope,
    occurredAt: '2026-05-01T19:00:02.000Z',
    downstreamOutcome: 'proceeded',
    observedFeatures: {
      amountBucket: '25k-50k',
      secretCustomerMarker: 'raw-value-that-must-not-appear',
      recurringRecipient: true,
    },
  });
  const serialized = JSON.stringify(event);

  equal(event.version, 'attestor.shadow-admission-event.v1', 'Shadow event: version is explicit');
  equal(event.mode, 'observe', 'Shadow event: observe mode is retained');
  equal(event.shadowDecision, 'would_review', 'Shadow event: shadow decision is retained');
  equal(event.effectiveDecision, 'admit', 'Shadow event: observe mode still admits effective response');
  equal(event.rawPayloadStored, false, 'Shadow event: raw payload storage is explicitly false');
  equal(event.originWitness.version, 'attestor.shadow-admission-origin-witness.v1', 'Shadow event: origin witness version is explicit');
  equal(event.originWitness.admissionDigest, event.admissionDigest, 'Shadow event: origin witness binds admission digest');
  equal(event.originWitnessDigest, event.originWitness.digest, 'Shadow event: origin witness digest is carried');
  equal(event.redactionWitness.version, 'attestor.shadow-admission-redaction-witness.v1', 'Shadow event: redaction witness version is explicit');
  equal(event.redactionWitness.redactionPolicyVersion, 'attestor.consequence-data-minimization-redaction-policy.v1', 'Shadow event: redaction witness binds policy version');
  equal(event.redactionWitness.observedFeatureDigest, event.observedFeatureDigest, 'Shadow event: redaction witness binds observed feature digest');
  equal(event.redactionWitness.rawObservedValuesStored, false, 'Shadow event: redaction witness declares raw observed values are not stored');
  equal(event.redactionWitnessDigest, event.redactionWitness.digest, 'Shadow event: redaction witness digest is carried');
  equal(event.evidenceRefCount, 2, 'Shadow event: evidence is counted instead of copied');
  equal(
    event.guardOutcomes.length,
    GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_GUARD_IDS.length,
    'Shadow event: guard outcome trace preserves every generic guard slot',
  );
  equal(
    event.guardOutcomes[0]?.guardId ?? null,
    'hard-invariant',
    'Shadow event: guard outcome trace starts with hard invariant slot',
  );
  equal(
    event.guardOutcomes[0]?.effect ?? null,
    'review',
    'Shadow event: guard outcome trace records hard invariant review effect',
  );
  ok(event.eventId.startsWith('shadow:sha256:'), 'Shadow event: generated id is digest-backed');
  ok(event.admissionDigest.startsWith('sha256:'), 'Shadow event: admission digest is carried');
  ok(event.observedFeatureDigest?.startsWith('sha256:'), 'Shadow event: observed feature digest is carried');
  ok(event.observedFeatureKeys.includes('amountBucket'), 'Shadow event: observed feature keys are retained');
  ok(event.originWitness.digest.startsWith('sha256:'), 'Shadow event: origin witness is digest-backed');
  ok(event.redactionWitness.digest.startsWith('sha256:'), 'Shadow event: redaction witness is digest-backed');
  ok(!serialized.includes('raw-value-that-must-not-appear'), 'Shadow event: raw observed feature values are not serialized');
  ok(!serialized.includes('customer_123'), 'Shadow event: raw recipient is not serialized');
  ok(!serialized.includes('order:987'), 'Shadow event: raw evidence refs are not serialized');
}

function testRecorderSummarizesPolicyGapsAndReviewLoad(): void {
  const recorder = createInMemoryShadowAdmissionEventRecorder();
  const observed = createGenericAdmissionEnvelope({
    mode: 'observe',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T19:01:00.000Z',
    decidedAt: '2026-05-01T19:01:01.000Z',
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
  });
  const blocked = createGenericAdmissionEnvelope({
    ...baseAdmissionInput('enforce'),
    observedFeatures: {
      policyBlocked: true,
    },
  });

  const observedEvent = recorder.record({
    admission: observed,
    downstreamOutcome: 'proceeded',
    humanOutcome: 'not-reviewed',
    observedFeatures: {
      amountBucket: '25k-50k',
    },
  });
  const blockedEvent = recorder.record({
    admission: blocked,
    downstreamOutcome: 'blocked',
    humanOutcome: 'rejected',
    observedFeatures: {
      policyBlocked: true,
    },
  });
  const summary = recorder.summarize();

  equal(recorder.list().length, 2, 'Shadow recorder: events are retained');
  equal(recorder.findByAdmissionId(observedEvent.admissionId)?.eventId, observedEvent.eventId, 'Shadow recorder: lookup by admission id works');
  equal(summary.totalEvents, 2, 'Shadow summary: total count is correct');
  equal(summary.byMode.observe, 1, 'Shadow summary: observe mode is counted');
  equal(summary.byMode.enforce, 1, 'Shadow summary: enforce mode is counted');
  equal(summary.byDomain['money-movement'], 2, 'Shadow summary: consequence domain is counted');
  equal(summary.downstreamOutcomes.proceeded, 1, 'Shadow summary: proceeded outcome is counted');
  equal(summary.downstreamOutcomes.blocked, 1, 'Shadow summary: blocked outcome is counted');
  equal(summary.humanOutcomes.rejected, 1, 'Shadow summary: human rejected outcome is counted');
  equal(summary.policyGapCount, 1, 'Shadow summary: policy gaps are counted');
  equal(summary.reviewLoadCount, 1, 'Shadow summary: would-review events are counted as review load');
  equal(summary.blockedCount, 1, 'Shadow summary: block decisions are counted');
  equal(summary.nonEnforcingEventCount, 1, 'Shadow summary: non-enforcing adoption events are counted');
  equal(summary.rawPayloadEventCount, 0, 'Shadow summary: raw payload events remain zero');
  equal(observedEvent.originWitness.admissionId, observedEvent.admissionId, 'Shadow recorder: recorded event carries origin witness');
  equal(blockedEvent.redactionWitness.rawPayloadStored, false, 'Shadow recorder: recorded event carries redaction witness');
  equal(
    blockedEvent.guardOutcomes.find((entry) => entry.guardId === 'hard-invariant')?.effect ?? null,
    'block',
    'Shadow recorder: recorded event carries guard outcome effects',
  );
  equal(
    summarizeShadowAdmissionEvents([blockedEvent]).blockedCount,
    1,
    'Shadow summary: pure helper works without recorder',
  );
}

function testInvalidOutcomesFailClosed(): void {
  const envelope = createGenericAdmissionEnvelope(baseAdmissionInput('observe'));

  throws(
    () =>
      createShadowAdmissionEvent({
        admission: envelope,
        downstreamOutcome: 'sent-to-nowhere' as never,
      }),
    /downstreamOutcome must be one of/u,
    'Shadow event: invalid downstream outcome fails closed',
  );
  throws(
    () =>
      createShadowAdmissionEvent({
        admission: envelope,
        humanOutcome: 'rubber-stamped' as never,
      }),
    /humanOutcome must be one of/u,
    'Shadow event: invalid human outcome fails closed',
  );
}

testShadowEventRedactsRawInputs();
testRecorderSummarizesPolicyGapsAndReviewLoad();
testInvalidOutcomesFailClosed();

console.log(`Shadow admission event tests: ${passed} passed, 0 failed`);
