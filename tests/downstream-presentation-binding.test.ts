import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_VERSION,
  consequenceAdmissionPresentationBindingDescriptor,
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionDownstreamContract,
  createConsequenceAdmissionPresentationBinding,
  createConsequenceAdmissionPresentationFreshnessNonce,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
  evaluateConsequenceAdmissionPresentationBinding,
  type ConsequenceAdmissionCheck,
  type ConsequenceAdmissionDownstreamContract,
  type ConsequenceAdmissionRequest,
  type ConsequenceAdmissionResponse,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function paymentRequest(): ConsequenceAdmissionRequest {
  return createConsequenceAdmissionRequest({
    requestedAt: '2026-05-01T12:00:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'internal-service',
      id: 'presentation-binding-payment',
      route: null,
      packageSubpath: null,
      sourceRef: 'customer/payment-adapter',
    },
    proposedConsequence: {
      actor: 'AI-assisted payment workflow',
      action: 'prepare supplier payment dispatch',
      downstreamSystem: 'supplier-payment-service',
      consequenceKind: 'action',
      riskClass: 'R3',
      summary: 'AI-assisted workflow asks to dispatch a supplier payment.',
    },
    policyScope: {
      policyRef: 'policy:payments:v1',
      tenantId: 'tenant_payments',
      environment: 'production',
      dimensions: {
        domain: 'money-movement',
      },
    },
    authority: {
      actorRef: 'actor:payment-agent',
      reviewerRef: 'reviewer:finance-ops',
      authorityMode: 'named-reviewer',
    },
    evidence: [
      {
        id: 'evidence:invoice',
        kind: 'invoice',
        digest: 'sha256:invoice',
        uri: null,
      },
    ],
    nativeInputRefs: ['amount', 'recipient', 'idempotencyKey'],
  });
}

function passCheck(kind: ConsequenceAdmissionCheck['kind']): ConsequenceAdmissionCheck {
  return createConsequenceAdmissionCheck({
    kind,
    label: `${kind} check`,
    outcome: 'pass',
    required: true,
    summary: `${kind} passed for presentation binding coverage.`,
    reasonCodes: [`${kind}-passed`],
    evidenceRefs: [`evidence:${kind}`],
  });
}

function admittedPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T12:00:01.000Z',
    decision: 'admit',
    reason: 'Payment consequence passed admission checks.',
    reasonCodes: ['payment-admitted'],
    checks: [
      passCheck('policy'),
      passCheck('authority'),
      passCheck('evidence'),
      passCheck('freshness'),
      passCheck('enforcement'),
    ],
    proof: [
      {
        kind: 'release-token',
        id: 'rt_payment_presentation',
        digest: 'sha256:token',
        uri: null,
        verifyHint: 'Verify the release token before dispatch.',
      },
    ],
  });
}

function admittedPaymentWithReceiptAndReleaseToken(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T12:00:01.000Z',
    decision: 'admit',
    reason: 'Payment consequence passed admission checks with receipt and release proof.',
    reasonCodes: ['payment-admitted'],
    checks: [
      passCheck('policy'),
      passCheck('authority'),
      passCheck('evidence'),
      passCheck('freshness'),
      passCheck('enforcement'),
    ],
    proof: [
      {
        kind: 'admission-receipt',
        id: 'generic-admission:payment-receipt',
        digest: 'sha256:payment-receipt',
        uri: null,
        verifyHint: 'This proves Attestor produced an admission response, not downstream execution authority.',
      },
      {
        kind: 'release-token',
        id: 'rt_payment_presentation',
        digest: 'sha256:token',
        uri: null,
        verifyHint: 'Verify the release token before dispatch.',
      },
    ],
  });
}

function receiptOnlyPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T12:00:01.500Z',
    decision: 'admit',
    reason: 'Payment consequence has an admission receipt only.',
    reasonCodes: ['payment-admission-receipt-only'],
    checks: [
      passCheck('policy'),
      passCheck('authority'),
      passCheck('evidence'),
      passCheck('freshness'),
      passCheck('enforcement'),
    ],
    proof: [
      {
        kind: 'admission-receipt',
        id: 'generic-admission:payment-receipt-only',
        digest: 'sha256:payment-receipt-only',
        uri: null,
        verifyHint: 'This proves Attestor produced an admission response, not downstream execution authority.',
      },
    ],
  });
}

const RAW_NARROW_CONSTRAINT_ID = 'constraint:max-amount';
const RAW_NARROW_CONSTRAINT_SUMMARY =
  'private-policy-threshold: payment amount must not exceed 250 EUR.';

function narrowedPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T12:00:02.000Z',
    decision: 'narrow',
    reason: 'Payment can proceed only below the bounded amount.',
    reasonCodes: ['payment-narrowed'],
    checks: [passCheck('policy'), passCheck('authority'), passCheck('evidence')],
    constraints: [
      {
        id: RAW_NARROW_CONSTRAINT_ID,
        summary: RAW_NARROW_CONSTRAINT_SUMMARY,
        enforcedBy: 'supplier-payment-service',
      },
    ],
    proof: [
      {
        kind: 'release-token',
        id: 'rt_payment_presentation_narrow',
        digest: 'sha256:narrow-token',
        uri: null,
        verifyHint: 'Verify the narrow release token before dispatch.',
      },
    ],
  });
}

function paymentContract(): ConsequenceAdmissionDownstreamContract {
  return createConsequenceAdmissionDownstreamContract({
    enforcementPointId: 'payment-adapter:supplier-payment-service',
    boundaryKind: 'payment-adapter',
    consequenceDomain: 'money-movement',
    downstreamSystems: ['supplier-payment-service'],
    acceptedConsequenceKinds: ['action', 'agent-payment'],
    acceptedRiskClasses: ['R3', 'R4'],
    policyRefs: ['policy:payments:v1'],
    environment: 'production',
  });
}

function paymentBinding(admission = admittedPayment()) {
  return createConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    target: {
      uri: 'https://payments.example.internal/supplier-payments',
      method: 'POST',
      bodyDigest: 'sha256:payment-body',
    },
    replayKey: 'payment:tenant_a:invoice_1938:attempt_1',
    nonce: 'nonce:payment-adapter:001',
    presentedAt: '2026-05-01T12:00:05.000Z',
    expiresAt: '2026-05-01T12:01:05.000Z',
  });
}

const EXPECTED = {
  targetUri: 'https://payments.example.internal/supplier-payments',
  method: 'POST',
  bodyDigest: 'sha256:payment-body',
  nonce: 'nonce:payment-adapter:001',
  requireBodyDigest: true,
  requireReplayKey: true,
  requireNonce: true,
  maxFreshnessSeconds: 60,
};

function testDescriptor(): void {
  const descriptor = consequenceAdmissionPresentationBindingDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_VERSION,
    'Presentation binding: descriptor exposes stable version',
  );
  ok(
    descriptor.bindingFields.includes('body-digest'),
    'Presentation binding: body digest is a first-class binding field',
  );
  ok(
    descriptor.bindingFields.includes('replay-key'),
    'Presentation binding: replay key is a first-class binding field',
  );
  equal(
    descriptor.cryptographicPresentationVerification,
    false,
    'Presentation binding: descriptor does not overclaim cryptographic verification',
  );
  equal(
    descriptor.storesRawBodies,
    false,
    'Presentation binding: descriptor does not store raw bodies',
  );
  equal(
    descriptor.requiresBodyDigestReferences,
    true,
    'Presentation binding: descriptor requires digest references for bodies',
  );
  equal(
    descriptor.supportsReplayKeyDigestObservations,
    true,
    'Presentation binding: descriptor exposes digest replay-key observations',
  );
  equal(
    descriptor.preferredReplayKeyObservation,
    'usedReplayKeyDigests',
    'Presentation binding: descriptor prefers digest replay-key observation lists',
  );
  equal(
    descriptor.decisionExposesRawReplayKeys,
    false,
    'Presentation binding: decisions do not expose raw replay keys',
  );
  equal(
    descriptor.canonicalUsesTargetDigest,
    true,
    'Presentation binding: canonical payload binds targets by digest',
  );
  equal(
    descriptor.canonicalUsesEnforcementPointIdDigest,
    true,
    'Presentation binding: canonical payload binds enforcement points by digest',
  );
  equal(
    descriptor.canonicalUsesDownstreamSystemDigest,
    true,
    'Presentation binding: canonical payload binds downstream systems by digest',
  );
  equal(
    descriptor.canonicalUsesPolicyRefDigest,
    true,
    'Presentation binding: canonical payload binds policy refs by digest',
  );
  equal(
    descriptor.canonicalUsesReplayKeyDigest,
    true,
    'Presentation binding: canonical payload binds replay keys by digest',
  );
  equal(
    descriptor.canonicalUsesNonceDigest,
    true,
    'Presentation binding: canonical payload binds nonces by digest',
  );
  equal(
    descriptor.canonicalUsesConstraintIdDigests,
    true,
    'Presentation binding: canonical payload binds constraint acknowledgements by digest',
  );
  equal(
    descriptor.supportsAttestorIssuedFreshnessNonce,
    true,
    'Presentation binding: descriptor supports Attestor-issued freshness nonces',
  );
  equal(
    descriptor.freshnessNonceExposesRawNonceInDecision,
    false,
    'Presentation binding: freshness nonce decisions do not expose raw nonce material',
  );
  equal(descriptor.failClosed, true, 'Presentation binding: descriptor is fail-closed');
}

function testMatchingPresentationAllows(): void {
  const admission = admittedPayment();
  const binding = paymentBinding(admission);
  const canonicalPayload = JSON.parse(binding.canonical) as {
    readonly target?: unknown;
    readonly enforcementPointId?: unknown;
    readonly enforcementPointIdDigest?: unknown;
    readonly downstreamSystem?: unknown;
    readonly downstreamSystemDigest?: unknown;
    readonly policyRef?: unknown;
    readonly policyRefDigest?: unknown;
    readonly targetDigest?: unknown;
    readonly replayKeyDigest?: unknown;
    readonly nonceDigest?: unknown;
  };
  const decision = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: EXPECTED,
    now: '2026-05-01T12:00:30.000Z',
  });

  equal(decision.outcome, 'allow', 'Presentation binding: matching presentation allows');
  equal(decision.allowed, true, 'Presentation binding: allowed flag is true on allow');
  equal(decision.failClosed, false, 'Presentation binding: successful decision is not fail-closed');
  equal(decision.downstreamDecision.outcome, 'allow', 'Presentation binding: downstream contract also allows');
  ok(
    decision.receiptDigest.startsWith('sha256:'),
    'Presentation binding: allow decision has digest-shaped receipt',
  );
  ok(
    binding.targetDigest.startsWith('sha256:'),
    'Presentation binding: binding exposes target digest',
  );
  equal(
    binding.enforcementPointIdDigest,
    digestText('payment-adapter:supplier-payment-service'),
    'Presentation binding: binding exposes enforcement point digest',
  );
  equal(
    binding.downstreamSystemDigest,
    digestText('supplier-payment-service'),
    'Presentation binding: binding exposes downstream system digest',
  );
  equal(
    binding.policyRefDigest,
    digestText('policy:payments:v1'),
    'Presentation binding: binding exposes policy ref digest',
  );
  equal(
    binding.replayKeyDigest,
    digestText('payment:tenant_a:invoice_1938:attempt_1'),
    'Presentation binding: binding exposes replay key digest',
  );
  equal(
    binding.nonceDigest,
    digestText('nonce:payment-adapter:001'),
    'Presentation binding: binding exposes nonce digest',
  );
  equal(
    binding.canonical.includes('payment:tenant_a:invoice_1938:attempt_1'),
    false,
    'Presentation binding: canonical payload does not contain raw replay key',
  );
  equal(
    binding.canonical.includes('nonce:payment-adapter:001'),
    false,
    'Presentation binding: canonical payload does not contain raw nonce',
  );
  equal(
    binding.canonical.includes('supplier-payment-service'),
    false,
    'Presentation binding: canonical payload does not contain raw downstream system',
  );
  equal(
    binding.canonical.includes('policy:payments:v1'),
    false,
    'Presentation binding: canonical payload does not contain raw policy ref',
  );
  equal(
    binding.canonical.includes('payment-adapter:supplier-payment-service'),
    false,
    'Presentation binding: canonical payload does not contain raw enforcement point id',
  );
  equal(
    'target' in canonicalPayload,
    false,
    'Presentation binding: canonical payload omits raw target material',
  );
  equal(
    'enforcementPointId' in canonicalPayload,
    false,
    'Presentation binding: canonical payload omits raw enforcement point id',
  );
  equal(
    'downstreamSystem' in canonicalPayload,
    false,
    'Presentation binding: canonical payload omits raw downstream system',
  );
  equal(
    'policyRef' in canonicalPayload,
    false,
    'Presentation binding: canonical payload omits raw policy ref',
  );
  equal(
    canonicalPayload.enforcementPointIdDigest,
    binding.enforcementPointIdDigest,
    'Presentation binding: canonical payload includes enforcement point digest field',
  );
  equal(
    canonicalPayload.downstreamSystemDigest,
    binding.downstreamSystemDigest,
    'Presentation binding: canonical payload includes downstream system digest field',
  );
  equal(
    canonicalPayload.policyRefDigest,
    binding.policyRefDigest,
    'Presentation binding: canonical payload includes policy ref digest field',
  );
  equal(
    canonicalPayload.targetDigest,
    binding.targetDigest,
    'Presentation binding: canonical payload includes target digest field',
  );
  equal(
    canonicalPayload.replayKeyDigest,
    binding.replayKeyDigest,
    'Presentation binding: canonical payload includes replay key digest field',
  );
  equal(
    canonicalPayload.nonceDigest,
    binding.nonceDigest,
    'Presentation binding: canonical payload includes nonce digest field',
  );
}

function testReplayAndExpiryHold(): void {
  const admission = admittedPayment();
  const binding = paymentBinding(admission);
  const replayed = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: {
      ...EXPECTED,
      usedReplayKeys: ['payment:tenant_a:invoice_1938:attempt_1'],
    },
    now: '2026-05-01T12:00:30.000Z',
  });
  const replayedByDigest = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: {
      ...EXPECTED,
      usedReplayKeyDigests: [digestText('payment:tenant_a:invoice_1938:attempt_1')],
    },
    now: '2026-05-01T12:00:30.000Z',
  });
  const expired = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: EXPECTED,
    now: '2026-05-01T12:02:00.000Z',
  });

  deepEqual(
    replayed.failureReasons,
    ['replay-key-reused'],
    'Presentation binding: consumed replay key holds precisely',
  );
  deepEqual(
    replayedByDigest.failureReasons,
    ['replay-key-reused'],
    'Presentation binding: consumed replay key digest holds without raw replay-key lists',
  );
  equal(
    JSON.stringify(replayedByDigest).includes('payment:tenant_a:invoice_1938:attempt_1'),
    false,
    'Presentation binding: digest replay decision does not serialize raw replay key material',
  );
  deepEqual(
    expired.failureReasons,
    ['presentation-expired'],
    'Presentation binding: expired presentation holds precisely',
  );
}

function testTargetBodyAndNonceMustMatch(): void {
  const admission = admittedPayment();
  const binding = paymentBinding(admission);
  const wrongBody = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: {
      ...EXPECTED,
      bodyDigest: 'sha256:different-body',
    },
    now: '2026-05-01T12:00:30.000Z',
  });
  const wrongTarget = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: {
      ...EXPECTED,
      targetUri: 'https://payments.example.internal/manual-payments',
    },
    now: '2026-05-01T12:00:30.000Z',
  });
  const wrongNonce = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: {
      ...EXPECTED,
      nonce: 'nonce:payment-adapter:002',
    },
    now: '2026-05-01T12:00:30.000Z',
  });

  deepEqual(
    wrongBody.failureReasons,
    ['body-digest-mismatch'],
    'Presentation binding: body digest mismatch holds precisely',
  );
  deepEqual(
    wrongTarget.failureReasons,
    ['target-uri-mismatch'],
    'Presentation binding: target mismatch holds precisely',
  );
  deepEqual(
    wrongNonce.failureReasons,
    ['nonce-mismatch'],
    'Presentation binding: nonce mismatch holds precisely',
  );
}

function testAttestorIssuedFreshnessNonceCanBindPresentation(): void {
  const admission = admittedPayment();
  const freshnessNonce = createConsequenceAdmissionPresentationFreshnessNonce({
    issuedAt: '2026-05-01T12:00:05.000Z',
    maxFreshnessSeconds: 60,
    nonce: 'nonce:payment-adapter:attestor-issued',
  });
  const binding = createConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    target: {
      uri: 'https://payments.example.internal/supplier-payments',
      method: 'POST',
      bodyDigest: 'sha256:payment-body',
    },
    replayKey: 'payment:tenant_a:invoice_1938:attempt_nonce_issued',
    nonce: freshnessNonce.nonce,
    presentedAt: freshnessNonce.issuedAt,
    expiresAt: freshnessNonce.expiresAt,
  });
  const allowed = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: {
      targetUri: 'https://payments.example.internal/supplier-payments',
      method: 'POST',
      bodyDigest: 'sha256:payment-body',
      nonceDigest: freshnessNonce.nonceDigest,
      requireBodyDigest: true,
      requireReplayKey: true,
      requireNonce: true,
      maxFreshnessSeconds: freshnessNonce.maxFreshnessSeconds,
    },
    now: '2026-05-01T12:00:30.000Z',
  });
  const wrongDigest = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: {
      nonceDigest: digestText('nonce:payment-adapter:different'),
      requireNonce: true,
      maxFreshnessSeconds: freshnessNonce.maxFreshnessSeconds,
    },
    now: '2026-05-01T12:00:30.000Z',
  });
  const serializedDecision = JSON.stringify(allowed);

  equal(allowed.outcome, 'allow', 'Presentation binding: Attestor-issued nonce digest allows');
  equal(
    binding.nonceDigest,
    freshnessNonce.nonceDigest,
    'Presentation binding: binding nonce digest matches Attestor-issued nonce digest',
  );
  equal(
    serializedDecision.includes(freshnessNonce.nonce),
    false,
    'Presentation binding: decision serialization omits raw Attestor-issued nonce',
  );
  deepEqual(
    wrongDigest.failureReasons,
    ['nonce-mismatch'],
    'Presentation binding: wrong expected nonce digest holds',
  );
}

function testRawBodyDigestMaterialIsRejected(): void {
  const admission = admittedPayment();
  const rawBodyMarker = 'raw_payment_body_must_not_escape';

  assert.throws(
    () =>
      createConsequenceAdmissionPresentationBinding({
        admission,
        contract: paymentContract(),
        target: {
          uri: 'https://payments.example.internal/supplier-payments',
          method: 'POST',
          bodyDigest: rawBodyMarker,
        },
        replayKey: 'payment:tenant_a:invoice_1938:attempt_raw',
        nonce: 'nonce:payment-adapter:raw',
        presentedAt: '2026-05-01T12:00:05.000Z',
        expiresAt: '2026-05-01T12:01:05.000Z',
      }),
    /target\.bodyDigest must be a digest reference/,
    'Presentation binding: raw body material cannot create a binding',
  );
  passed += 1;

  const binding = paymentBinding(admission);
  const rawPresentation = {
    ...binding,
    target: {
      ...binding.target,
      bodyDigest: rawBodyMarker,
    },
  };
  const held = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: rawPresentation,
    expected: EXPECTED,
    now: '2026-05-01T12:00:30.000Z',
  });
  const serialized = JSON.stringify(held);

  deepEqual(
    held.failureReasons,
    ['body-digest-invalid', 'body-digest-missing'],
    'Presentation binding: raw body digest material holds without using it as proof',
  );
  equal(held.outcome, 'hold', 'Presentation binding: raw body digest material fails closed');
  equal(
    serialized.includes(rawBodyMarker),
    false,
    'Presentation binding: raw body marker is not serialized in the decision',
  );
}

function testNarrowPresentationRequiresConstraintAcknowledgement(): void {
  const admission = narrowedPayment();
  const held = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: paymentBinding(admission),
    expected: EXPECTED,
    now: '2026-05-01T12:00:30.000Z',
  });
  const acknowledged = createConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    target: {
      uri: 'https://payments.example.internal/supplier-payments',
      method: 'POST',
      bodyDigest: 'sha256:payment-body',
    },
    replayKey: 'payment:tenant_a:invoice_1938:attempt_2',
    nonce: 'nonce:payment-adapter:001',
    presentedAt: '2026-05-01T12:00:05.000Z',
    expiresAt: '2026-05-01T12:01:05.000Z',
    acceptedConstraintIds: [RAW_NARROW_CONSTRAINT_ID],
  });
  const allowed = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: acknowledged,
    expected: {
      ...EXPECTED,
      usedReplayKeys: [],
    },
    now: '2026-05-01T12:00:30.000Z',
  });
  const serializedDecisions = JSON.stringify({ held, allowed });

  deepEqual(
    held.failureReasons,
    ['constraint-acknowledgement-missing', 'downstream-contract-held'],
    'Presentation binding: unacknowledged narrow constraint holds at both presentation and downstream contract layers',
  );
  equal(allowed.outcome, 'allow', 'Presentation binding: acknowledged narrow constraint allows');
  equal(
    acknowledged.acceptedConstraintIdDigests[0],
    digestText(RAW_NARROW_CONSTRAINT_ID),
    'Presentation binding: accepted constraint ids are digest-indexed',
  );
  equal(
    acknowledged.canonical.includes(RAW_NARROW_CONSTRAINT_ID),
    false,
    'Presentation binding: canonical payload omits raw accepted constraint ids',
  );
  equal(
    serializedDecisions.includes(RAW_NARROW_CONSTRAINT_ID),
    false,
    'Presentation binding: decision serialization omits raw constraint ids',
  );
  equal(
    serializedDecisions.includes(RAW_NARROW_CONSTRAINT_SUMMARY),
    false,
    'Presentation binding: decision serialization omits raw constraint summaries',
  );
}

function testAdmissionReceiptIsNotRequiredAsExecutionProofRef(): void {
  const admission = admittedPaymentWithReceiptAndReleaseToken();
  const binding = createConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    target: {
      uri: 'https://payments.example.internal/supplier-payments',
      method: 'POST',
      bodyDigest: 'sha256:payment-body',
    },
    replayKey: 'payment:tenant_a:invoice_1938:attempt_release_only',
    nonce: 'nonce:payment-adapter:001',
    presentedAt: '2026-05-01T12:00:05.000Z',
    expiresAt: '2026-05-01T12:01:05.000Z',
    proofRefIds: ['rt_payment_presentation'],
  });
  const decision = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: EXPECTED,
    now: '2026-05-01T12:00:30.000Z',
  });

  equal(
    decision.outcome,
    'allow',
    'Presentation binding: release-token proof ref allows without requiring admission receipt ref',
  );
  equal(
    decision.downstreamDecision.proofSatisfied,
    true,
    'Presentation binding: downstream execution proof is satisfied by the release token',
  );
  equal(
    decision.failureReasons.includes('proof-ref-missing'),
    false,
    'Presentation binding: admission receipt is not required as execution proof ref',
  );
}

function testReceiptOnlyPresentationStillHoldsAtDownstreamContract(): void {
  const admission = receiptOnlyPayment();
  const binding = paymentBinding(admission);
  const decision = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: EXPECTED,
    now: '2026-05-01T12:00:30.000Z',
  });

  equal(
    decision.outcome,
    'hold',
    'Presentation binding: receipt-only admission still holds',
  );
  deepEqual(
    decision.failureReasons,
    ['downstream-contract-held'],
    'Presentation binding: receipt-only proof is held by the downstream contract',
  );
  deepEqual(
    decision.downstreamDecision.failureReasons,
    ['proof-missing'],
    'Presentation binding: downstream contract names the missing execution proof',
  );
  equal(
    decision.failureReasons.includes('proof-ref-missing'),
    false,
    'Presentation binding: receipt-only proof is not misclassified as a missing execution proof ref',
  );
}

function testDocsAndScriptsExposePresentationBinding(): void {
  const readme = readProjectFile('README.md');
  const integrationGuide = readProjectFile('docs', '01-overview', 'how-to-integrate-attestor.md');
  const bindingDoc = readProjectFile('docs', '02-architecture', 'downstream-presentation-binding.md');
  const contractDoc = readProjectFile('docs', '02-architecture', 'downstream-enforcement-contract.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    readme,
    '[Repository navigator](docs/01-overview/repository-navigator.md)',
    'Presentation binding: README routes deeper proof docs through the navigator',
  );
  includes(
    integrationGuide,
    '[Downstream presentation binding](../02-architecture/downstream-presentation-binding.md)',
    'Presentation binding: integration guide links presentation binding doc',
  );
  includes(
    bindingDoc,
    'this exact consequence is allowed here, now',
    'Presentation binding: doc states exact final-edge purpose',
  );
  includes(
    bindingDoc,
    '`usedReplayKeyDigests`',
    'Presentation binding: doc names digest replay-key observation field',
  );
  includes(
    bindingDoc,
    'Digest observations are the preferred replay interface',
    'Presentation binding: doc prefers digest replay observations',
  );
  includes(
    bindingDoc,
    'canonical payload binds targets, enforcement points, downstream systems, policy refs, replay keys, and nonces by digest',
    'Presentation binding: doc states target digest canonical binding',
  );
  includes(
    bindingDoc,
    'enforcement points',
    'Presentation binding: doc states enforcement points are digest-bound in canonical proof material',
  );
  includes(
    bindingDoc,
    'policy refs, replay keys, and nonces by digest',
    'Presentation binding: doc states policy refs are digest-bound in canonical proof material',
  );
  includes(
    bindingDoc,
    'downstream systems, policy refs',
    'Presentation binding: doc states downstream systems are digest-bound in canonical proof material',
  );
  includes(
    bindingDoc,
    '`acceptedConstraintIdDigests`',
    'Presentation binding: doc names digest constraint acknowledgement field',
  );
  includes(
    bindingDoc,
    'digest-only `constraintRefs`',
    'Presentation binding: doc states nested downstream constraint refs are digest-only',
  );
  includes(
    bindingDoc,
    'An `admission-receipt` may be carried as admission evidence, but it is not required or counted as execution proof.',
    'Presentation binding: doc states admission receipts are not execution proof refs',
  );
  includes(
    contractDoc,
    '[Downstream presentation binding](downstream-presentation-binding.md)',
    'Presentation binding: downstream contract doc links presentation binding',
  );
  includes(
    systemOverview,
    '[Downstream presentation binding](downstream-presentation-binding.md)',
    'Presentation binding: system overview links presentation binding',
  );
  equal(
    packageJson.scripts['test:downstream-presentation-binding'],
    'tsx tests/downstream-presentation-binding.test.ts',
    'Presentation binding: focused test script is exposed',
  );
}

testDescriptor();
testMatchingPresentationAllows();
testReplayAndExpiryHold();
testTargetBodyAndNonceMustMatch();
testAttestorIssuedFreshnessNonceCanBindPresentation();
testRawBodyDigestMaterialIsRejected();
testNarrowPresentationRequiresConstraintAcknowledgement();
testAdmissionReceiptIsNotRequiredAsExecutionProofRef();
testReceiptOnlyPresentationStillHoldsAtDownstreamContract();
testDocsAndScriptsExposePresentationBinding();

console.log(`Downstream presentation binding tests: ${passed} passed, 0 failed`);
