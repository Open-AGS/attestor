import {
  GENERIC_ADMISSION_MODES,
  assert,
  baseMoneyAdmission,
  cleanAuthorityCreepMetadata,
  consequenceAdmissionDescriptor,
  createGenericAdmissionEnvelope,
  digest,
  equal,
  markPassed,
  ok,
  throws,
  trustedApprovals,
} from './helpers.js';

function testDescriptorExposesModeLadder(): void {
  const descriptor = consequenceAdmissionDescriptor();

  equal(GENERIC_ADMISSION_MODES.length, 4, 'Generic admission: four adoption modes exist');
  assert.deepEqual(
    [...descriptor.genericAdmissionModes],
    ['observe', 'warn', 'review', 'enforce'],
  );
  markPassed();
  assert.deepEqual(
    [...descriptor.genericAdmissionShadowDecisions],
    ['would_admit', 'would_narrow', 'would_review', 'would_block'],
  );
  markPassed();
  assert.deepEqual(
    [...descriptor.genericAdmissionDownstreamPostures],
    ['observe-only', 'warn-only', 'hold-for-review', 'enforce-decision'],
  );
  markPassed();
  assert.deepEqual(
    [...descriptor.genericAdmissionObservedFeatureOrigins],
    [
      'caller-supplied',
      'operator-attested',
      'customer-gateway',
      'attestor-runtime',
      'trusted-adapter',
    ],
  );
  markPassed();
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
  ok(envelope.admission.reasonCodes.includes('authority-source-missing'), 'Generic admission: observe still records authority-source gap');
  equal(envelope.admission.feedback.disclosureLevel, 'actionable', 'Generic admission: observe emits actionable feedback for gaps');
  equal(envelope.admission.retry.retryAllowed, false, 'Generic admission: observe feedback is not an execution retry loop');
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
  equal(envelope.admission.feedback.safeForModel, true, 'Generic admission: feedback is marked safe for model repair');
  ok(envelope.admission.feedback.missingFields.includes('policyRef'), 'Generic admission: feedback names missing policy ref field');
  ok(envelope.admission.feedback.missingFields.includes('evidenceRefs'), 'Generic admission: feedback names missing evidence refs field');
  ok(envelope.admission.feedback.missingFields.includes('authoritySources'), 'Generic admission: feedback names missing authority sources');
  ok(envelope.admission.feedback.requiredEvidenceKinds.includes('policy_ref'), 'Generic admission: feedback names policy ref evidence kind');
  ok(envelope.admission.feedback.requiredEvidenceKinds.includes('evidence_ref'), 'Generic admission: feedback names evidence ref evidence kind');
  ok(envelope.admission.feedback.requiredEvidenceKinds.includes('trusted_authority_source_ref'), 'Generic admission: feedback names trusted authority source evidence kind');
  ok(envelope.admission.feedback.operatorOnlyReasonCodes.includes('authority-source-missing'), 'Generic admission: missing authority source is operator-only feedback');
  equal(envelope.admission.retry.retryAllowed, false, 'Generic admission: operator authority gaps are not model-retryable');
  equal(envelope.admission.retry.retryCategory, 'human-review-required', 'Generic admission: retry category is human review when authority is missing');
  equal(envelope.admission.retry.nextAllowedMode, null, 'Generic admission: operator authority gap has no model retry rung');
  equal(envelope.admission.retry.requiresChangedRequest, false, 'Generic admission: operator authority gap cannot be repaired by same model retry');
  equal(envelope.admission.retry.sameRequestReplayAllowed, false, 'Generic admission: same request replay is not model repair');
  equal(envelope.admission.retry.retryBindingRequired, false, 'Generic admission: operator authority gap does not request a retry binding');
  ok(
    envelope.admission.retry.nonRetryableReasonCodes.includes('authority-source-missing'),
    'Generic admission: missing authority source is listed as non-retryable',
  );
}

function testRetryAttemptBindingIsCarriedByGenericRequest(): void {
  const held = createGenericAdmissionEnvelope({
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
  const retry = createGenericAdmissionEnvelope({
    mode: 'review',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T17:03:00.000Z',
    decidedAt: '2026-05-01T17:03:01.000Z',
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    policyRef: 'policy:refunds:v1',
    evidenceRefs: ['order:987', 'payment:456'],
    authoritySources: [
      {
        sourceKind: 'verified-approval',
        claimKind: 'approval',
        sourceRef: 'approval:refund:987',
        evidenceDigest: `sha256:${'a'.repeat(64)}`,
      },
    ],
    approvals: trustedApprovals(),
    retryAttempt: {
      previousAdmissionId: held.admission.admissionId,
      previousAdmissionDigest: held.admission.digest,
      previousRequestId: held.admission.request.requestId,
      attemptNumber: 1,
      attemptedAt: '2026-05-01T17:03:00.000Z',
      correctionReasonCodes: ['policy-ref-missing', 'evidence-ref-missing', 'authority-source-missing'],
      correctionFields: ['policyRef', 'evidenceRefs', 'authoritySources'],
      idempotencyKey: 'retry:refund:1',
    },
  });

  equal(retry.admission.decision, 'admit', 'Generic admission: corrected bound retry can admit');
  equal(
    retry.admission.request.retryAttempt?.previousAdmissionDigest,
    held.admission.digest,
    'Generic admission: corrected retry binds to previous admission digest',
  );
  ok(
    retry.admission.reasonCodes.includes('retry-attempt-bound'),
    'Generic admission: bound retry is marked in reason codes',
  );
  ok(
    retry.admission.request.requestId !== held.admission.request.requestId,
    'Generic admission: bound retry has a new request id',
  );
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
  equal(envelope.admission.retry.retryAllowed, false, 'Generic admission: admitted request does not need retry');
  equal(envelope.admission.retry.retryCategory, 'not-needed', 'Generic admission: admitted request retry category is not-needed');
  equal(
    envelope.admission.request.policyScope.dimensions.authorityGuardOutcome,
    'pass',
    'Generic admission: trusted authority source passes the authority guard',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.approvalGuardOutcome,
    'pass',
    'Generic admission: trusted approval provenance passes the approval guard',
  );
  ok(
    typeof envelope.admission.request.policyScope.dimensions.authorityGuardDigest === 'string',
    'Generic admission: authority guard digest is carried without raw source material',
  );
  ok(
    typeof envelope.admission.request.policyScope.dimensions.approvalGuardDigest === 'string',
    'Generic admission: approval guard digest is carried without raw approval material',
  );
}

function testProgrammableMoneyRequiresAdapterReadiness(): void {
  const incomplete = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    domain: 'programmable-money',
    downstreamSystem: 'wallet-rpc',
  });
  const callerOnly = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    domain: 'programmable-money',
    downstreamSystem: 'wallet-rpc',
    observedFeatures: {
      adapterReady: true,
    },
    observedFeatureOrigins: {
      adapterReady: 'caller-supplied',
    },
  });
  const complete = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    domain: 'programmable-money',
    downstreamSystem: 'wallet-rpc',
    observedFeatures: {
      adapterReady: true,
    },
    observedFeatureOrigins: {
      adapterReady: 'operator-attested',
    },
  });

  equal(incomplete.shadowDecision, 'would_review', 'Generic admission: programmable money needs adapter readiness');
  equal(incomplete.admission.decision, 'review', 'Generic admission: missing adapter readiness holds execution');
  ok(incomplete.admission.reasonCodes.includes('adapter-readiness-missing'), 'Generic admission: adapter gap is explicit');
  equal(incomplete.admission.retry.retryAllowed, false, 'Generic admission: adapter readiness is not model-retryable');
  ok(
    incomplete.admission.feedback.operatorOnlyReasonCodes.includes('adapter-readiness-missing'),
    'Generic admission: adapter readiness is operator-only feedback',
  );
  equal(callerOnly.shadowDecision, 'would_review', 'Generic admission: caller-only adapter readiness cannot admit');
  equal(callerOnly.admission.decision, 'review', 'Generic admission: caller-only adapter readiness holds execution');
  ok(
    callerOnly.admission.reasonCodes.includes('adapter-readiness-origin-untrusted'),
    'Generic admission: caller-only adapter readiness origin is explicit',
  );
  ok(
    callerOnly.admission.feedback.operatorOnlyReasonCodes.includes('adapter-readiness-origin-untrusted'),
    'Generic admission: untrusted adapter origin is operator-only feedback',
  );
  equal(
    callerOnly.admission.request.policyScope.dimensions.adapterReady,
    false,
    'Generic admission: caller-only adapter readiness is not materialized as trusted readiness',
  );
  equal(
    callerOnly.admission.request.policyScope.dimensions.adapterReadyObserved,
    true,
    'Generic admission: caller-only adapter observation remains visible as an observation',
  );
  equal(
    callerOnly.admission.request.policyScope.dimensions.adapterReadyOrigin,
    'caller-supplied',
    'Generic admission: caller-only adapter origin is preserved for audit',
  );
  equal(complete.shadowDecision, 'would_admit', 'Generic admission: trusted adapter-ready programmable money can admit');
  equal(complete.admission.allowed, true, 'Generic admission: trusted adapter-ready programmable money is allowed');
  equal(
    complete.admission.request.policyScope.dimensions.adapterReady,
    true,
    'Generic admission: trusted adapter readiness is materialized as readiness',
  );
}

export function runCoreModeTests(): void {
  testDescriptorExposesModeLadder();
  testObserveModeRecordsShadowWithoutBlocking();
  testReviewModeHoldsIncompleteActions();
  testRetryAttemptBindingIsCarriedByGenericRequest();
  testEnforceModeAdmitsCompleteMoneyMovement();
  testProgrammableMoneyRequiresAdapterReadiness();
}
