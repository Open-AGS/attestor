import assert from 'node:assert/strict';
import {
  GENERIC_ADMISSION_MODES,
  createGenericAdmissionEnvelope,
  consequenceAdmissionDescriptor,
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

function baseMoneyAdmission(mode: string) {
  return {
    mode,
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T17:00:00.000Z',
    decidedAt: '2026-05-01T17:00:01.000Z',
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    evidenceRefs: ['order:987', 'payment:456'],
    policyRef: 'policy:refunds:v1',
  };
}

function testDescriptorExposesModeLadder(): void {
  const descriptor = consequenceAdmissionDescriptor();

  equal(GENERIC_ADMISSION_MODES.length, 4, 'Generic admission: four adoption modes exist');
  assert.deepEqual(
    [...descriptor.genericAdmissionModes],
    ['observe', 'warn', 'review', 'enforce'],
  );
  passed += 1;
  assert.deepEqual(
    [...descriptor.genericAdmissionShadowDecisions],
    ['would_admit', 'would_narrow', 'would_review', 'would_block'],
  );
  passed += 1;
  assert.deepEqual(
    [...descriptor.genericAdmissionDownstreamPostures],
    ['observe-only', 'warn-only', 'hold-for-review', 'enforce-decision'],
  );
  passed += 1;
}

function testObserveModeRecordsShadowWithoutBlocking(): void {
  const envelope = createGenericAdmissionEnvelope({
    mode: 'observe',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T17:01:00.000Z',
    decidedAt: '2026-05-01T17:01:01.000Z',
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
  });

  equal(envelope.mode, 'observe', 'Generic admission: observe mode is preserved');
  equal(envelope.shadowDecision, 'would_review', 'Generic admission: observe records would-review shadow');
  equal(envelope.downstreamPosture, 'observe-only', 'Generic admission: observe posture is non-enforcing');
  equal(envelope.enforcementActive, false, 'Generic admission: observe mode does not enforce');
  equal(envelope.admission.decision, 'admit', 'Generic admission: observe does not block downstream');
  equal(envelope.admission.allowed, true, 'Generic admission: observe admission is allowed for adoption logging');
  equal(envelope.admission.operationalContext.nonEnforcingMode, true, 'Generic admission: observe marks non-enforcing mode');
  ok(envelope.admission.reasonCodes.includes('policy-ref-missing'), 'Generic admission: observe still records policy gap');
  ok(envelope.admission.reasonCodes.includes('evidence-ref-missing'), 'Generic admission: observe still records evidence gap');
}

function testReviewModeHoldsIncompleteActions(): void {
  const envelope = createGenericAdmissionEnvelope({
    mode: 'review',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T17:02:00.000Z',
    decidedAt: '2026-05-01T17:02:01.000Z',
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
  });

  equal(envelope.mode, 'review', 'Generic admission: review mode is preserved');
  equal(envelope.shadowDecision, 'would_review', 'Generic admission: review sees incomplete policy/evidence');
  equal(envelope.downstreamPosture, 'hold-for-review', 'Generic admission: review mode holds incomplete actions');
  equal(envelope.enforcementActive, true, 'Generic admission: review mode enforces the hold');
  equal(envelope.admission.decision, 'review', 'Generic admission: incomplete review-mode action returns review');
  equal(envelope.admission.allowed, false, 'Generic admission: review decision is not allowed');
  equal(envelope.admission.failClosed, true, 'Generic admission: review decision fails closed');
}

function testEnforceModeAdmitsCompleteMoneyMovement(): void {
  const envelope = createGenericAdmissionEnvelope(baseMoneyAdmission('enforce'));

  equal(envelope.mode, 'enforce', 'Generic admission: enforce mode is preserved');
  equal(envelope.shadowDecision, 'would_admit', 'Generic admission: complete money movement would admit');
  equal(envelope.downstreamPosture, 'enforce-decision', 'Generic admission: enforce posture is decision enforcing');
  equal(envelope.admission.request.packFamily, 'general', 'Generic admission: generic API uses general pack family');
  equal(envelope.admission.request.entryPoint.route, '/api/v1/admissions', 'Generic admission: route is canonical');
  equal(envelope.admission.request.policyScope.dimensions.domain, 'money-movement', 'Generic admission: domain is carried in dimensions');
  equal(envelope.admission.decision, 'admit', 'Generic admission: complete enforce request admits');
  equal(envelope.admission.allowed, true, 'Generic admission: complete enforce request is allowed');
  equal(envelope.admission.proof[0]?.kind, 'admission-receipt', 'Generic admission: admitted request has receipt proof');
}

function testProgrammableMoneyRequiresAdapterReadiness(): void {
  const incomplete = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    domain: 'programmable-money',
    downstreamSystem: 'wallet-rpc',
  });
  const complete = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    domain: 'programmable-money',
    downstreamSystem: 'wallet-rpc',
    observedFeatures: {
      adapterReady: true,
    },
  });

  equal(incomplete.shadowDecision, 'would_review', 'Generic admission: programmable money needs adapter readiness');
  equal(incomplete.admission.decision, 'review', 'Generic admission: missing adapter readiness holds execution');
  ok(incomplete.admission.reasonCodes.includes('adapter-readiness-missing'), 'Generic admission: adapter gap is explicit');
  equal(complete.shadowDecision, 'would_admit', 'Generic admission: adapter-ready programmable money can admit');
  equal(complete.admission.allowed, true, 'Generic admission: adapter-ready programmable money is allowed');
}

function testEnforceModeBlocksKnownUnsafeSignals(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    observedFeatures: {
      policyBlocked: true,
    },
  });

  equal(envelope.shadowDecision, 'would_block', 'Generic admission: policyBlocked feature shadows block');
  equal(envelope.admission.decision, 'block', 'Generic admission: enforce mode applies block');
  equal(envelope.admission.allowed, false, 'Generic admission: block is not allowed');
  equal(envelope.admission.failClosed, true, 'Generic admission: block fails closed');
}

function testInvalidInputFailsClosed(): void {
  throws(
    () =>
      createGenericAdmissionEnvelope({
        ...baseMoneyAdmission('maybe'),
      }),
    /mode must be one of/u,
    'Generic admission: invalid modes fail closed',
  );
  throws(
    () =>
      createGenericAdmissionEnvelope({
        ...baseMoneyAdmission('enforce'),
        domain: 'finance-but-not-really',
      }),
    /domain must be one of/u,
    'Generic admission: invalid domains fail closed',
  );
}

testDescriptorExposesModeLadder();
testObserveModeRecordsShadowWithoutBlocking();
testReviewModeHoldsIncompleteActions();
testEnforceModeAdmitsCompleteMoneyMovement();
testProgrammableMoneyRequiresAdapterReadiness();
testEnforceModeBlocksKnownUnsafeSignals();
testInvalidInputFailsClosed();

console.log(`Generic admission mode ladder tests: ${passed} passed, 0 failed`);
