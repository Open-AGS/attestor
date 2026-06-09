import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_DOWNSTREAM_EXECUTION_RECEIPT_VERSION,
  consequenceAdmissionDownstreamExecutionReceiptDescriptor,
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionDownstreamContract,
  createConsequenceAdmissionPresentationBinding,
  createConsequenceAdmissionPresentationReplayLedger,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
  recordConsequenceAdmissionDownstreamExecution,
  type ConsequenceAdmissionCheck,
  type ConsequenceAdmissionDownstreamContract,
  type ConsequenceAdmissionPresentationReplayLedgerDecision,
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

function paymentRequest(): ConsequenceAdmissionRequest {
  return createConsequenceAdmissionRequest({
    requestedAt: '2026-05-01T14:00:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'internal-service',
      id: 'downstream-execution-receipt-payment',
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
    summary: `${kind} passed for downstream execution receipt coverage.`,
    reasonCodes: [`${kind}-passed`],
    evidenceRefs: [`evidence:${kind}`],
  });
}

function admittedPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T14:00:01.000Z',
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
        id: 'rt_payment_execution_receipt',
        digest: 'sha256:token',
        uri: null,
        verifyHint: 'Verify the release token before dispatch.',
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

function consumedReplay(input: {
  readonly admission: ConsequenceAdmissionResponse;
  readonly replayKey?: string;
  readonly consumedAt?: string;
}): ConsequenceAdmissionPresentationReplayLedgerDecision {
  const ledger = createConsequenceAdmissionPresentationReplayLedger({
    ledgerId: 'ledger:payment-adapter',
    retentionSeconds: 120,
    now: () => input.consumedAt ?? '2026-05-01T14:00:30.000Z',
  });
  const presentation = createConsequenceAdmissionPresentationBinding({
    admission: input.admission,
    contract: paymentContract(),
    target: {
      uri: 'https://payments.example.internal/supplier-payments',
      method: 'POST',
      bodyDigest: 'sha256:payment-body',
    },
    replayKey: input.replayKey ?? 'payment:tenant_a:invoice_1938:attempt_1',
    nonce: 'nonce:payment-adapter:001',
    presentedAt: '2026-05-01T14:00:05.000Z',
    expiresAt: '2026-05-01T14:01:05.000Z',
  });

  return ledger.consume({
    admission: input.admission,
    contract: paymentContract(),
    presentation,
    expected: EXPECTED,
    consumedAt: input.consumedAt,
  });
}

function testDescriptor(): void {
  const descriptor = consequenceAdmissionDownstreamExecutionReceiptDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_ADMISSION_DOWNSTREAM_EXECUTION_RECEIPT_VERSION,
    'Execution receipt: descriptor exposes stable version',
  );
  ok(
    descriptor.statuses.includes('succeeded'),
    'Execution receipt: succeeded is a status',
  );
  equal(
    descriptor.storesRawResults,
    false,
    'Execution receipt: descriptor does not store raw results',
  );
  equal(
    descriptor.cloudEventsCompatible,
    true,
    'Execution receipt: descriptor marks CloudEvents compatibility',
  );
}

function testRecordsSuccessfulExecutionAfterReplayConsumption(): void {
  const admission = admittedPayment();
  const replayDecision = consumedReplay({ admission });
  const recorded = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision,
    execution: {
      status: 'succeeded',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:31.000Z',
      completedAt: '2026-05-01T14:00:34.000Z',
      externalReceiptDigest: 'sha256:payment-provider-receipt',
      operatorRef: 'operator:payment-adapter-worker-1',
      idempotencyRef: 'payment:tenant_a:invoice_1938:attempt_1',
    },
  });

  equal(recorded.outcome, 'recorded', 'Execution receipt: successful execution records');
  equal(recorded.recorded, true, 'Execution receipt: recorded flag is true');
  equal(recorded.failClosed, false, 'Execution receipt: recorded receipt is not fail-closed');
  ok(
    recorded.receipt?.receiptDigest.startsWith('sha256:'),
    'Execution receipt: receipt has digest-shaped id',
  );
  equal(
    recorded.receipt?.cloudEvent.specversion,
    '1.0',
    'Execution receipt: receipt carries CloudEvents-compatible envelope',
  );
  equal(
    JSON.stringify(recorded).includes('operator:payment-adapter-worker-1'),
    false,
    'Execution receipt: raw operator ref is not exported',
  );
  equal(
    JSON.stringify(recorded).includes('payment:tenant_a:invoice_1938:attempt_1'),
    false,
    'Execution receipt: raw idempotency ref is not exported',
  );
}

function testHoldsWithoutReplayConsumption(): void {
  const admission = admittedPayment();
  const replayDecision = consumedReplay({ admission });
  const heldReplay = {
    ...replayDecision,
    consumed: false,
    outcome: 'held' as const,
    entry: null,
  };
  const held = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision: heldReplay,
    execution: {
      status: 'succeeded',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:31.000Z',
      externalReceiptDigest: 'sha256:payment-provider-receipt',
    },
  });

  equal(held.outcome, 'held', 'Execution receipt: unconsumed replay holds');
  deepEqual(
    held.failureReasons,
    ['replay-not-consumed'],
    'Execution receipt: missing replay consumption reason is precise',
  );
  equal(held.receipt, null, 'Execution receipt: no receipt is emitted on hold');
}

function testTargetAndTimingMustMatch(): void {
  const admission = admittedPayment();
  const replayDecision = consumedReplay({ admission });
  const wrongTarget = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision,
    targetDigest: 'sha256:wrong-target',
    execution: {
      status: 'succeeded',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:31.000Z',
      externalReceiptDigest: 'sha256:payment-provider-receipt',
    },
  });
  const earlyExecution = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision,
    execution: {
      status: 'succeeded',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:29.000Z',
      externalReceiptDigest: 'sha256:payment-provider-receipt',
    },
  });
  const invertedTime = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision,
    execution: {
      status: 'failed',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:35.000Z',
      completedAt: '2026-05-01T14:00:34.000Z',
      errorDigest: 'sha256:error',
    },
  });

  deepEqual(
    wrongTarget.failureReasons,
    ['target-digest-mismatch'],
    'Execution receipt: target digest mismatch holds precisely',
  );
  deepEqual(
    earlyExecution.failureReasons,
    ['executed-before-replay-consumption'],
    'Execution receipt: execution before replay consumption holds precisely',
  );
  deepEqual(
    invertedTime.failureReasons,
    ['completed-before-executed'],
    'Execution receipt: completed-before-executed holds precisely',
  );
}

function testStatusSpecificEvidenceRequirements(): void {
  const admission = admittedPayment();
  const replayDecision = consumedReplay({ admission });
  const successMissing = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision,
    execution: {
      status: 'succeeded',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:31.000Z',
    },
  });
  const failureMissing = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision,
    execution: {
      status: 'failed',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:31.000Z',
    },
  });
  const skippedMissing = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision,
    execution: {
      status: 'skipped',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:31.000Z',
    },
  });
  const skippedRecorded = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision,
    execution: {
      status: 'skipped',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:31.000Z',
      skipReasonCode: 'downstream-maintenance-window',
    },
  });

  deepEqual(
    successMissing.failureReasons,
    ['success-result-missing'],
    'Execution receipt: success requires result or external receipt digest',
  );
  deepEqual(
    failureMissing.failureReasons,
    ['failure-result-missing'],
    'Execution receipt: failure requires error or external receipt digest',
  );
  deepEqual(
    skippedMissing.failureReasons,
    ['skip-reason-missing'],
    'Execution receipt: skipped requires reason code',
  );
  equal(skippedRecorded.outcome, 'recorded', 'Execution receipt: skipped with reason records');
}

function testRawResultMaterialMustBeDigestShaped(): void {
  const admission = admittedPayment();
  const replayDecision = consumedReplay({ admission });
  const rawSuccessMarker = 'raw_customer_payment_result_must_not_escape';
  const rawErrorMarker = 'raw_downstream_error_must_not_escape';
  const rawReceiptMarker = 'raw_external_receipt_must_not_escape';
  const rawResultHeld = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision,
    execution: {
      status: 'succeeded',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:31.000Z',
      resultDigest: rawSuccessMarker,
    },
  });
  const rawErrorHeld = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision,
    execution: {
      status: 'failed',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:31.000Z',
      errorDigest: rawErrorMarker,
    },
  });
  const rawReceiptHeld = recordConsequenceAdmissionDownstreamExecution({
    admission,
    replayDecision,
    execution: {
      status: 'succeeded',
      downstreamSystem: 'supplier-payment-service',
      executedAt: '2026-05-01T14:00:31.000Z',
      externalReceiptDigest: rawReceiptMarker,
    },
  });
  const serialized = JSON.stringify({ rawResultHeld, rawErrorHeld, rawReceiptHeld });

  deepEqual(
    rawResultHeld.failureReasons,
    ['result-digest-invalid', 'success-result-missing'],
    'Execution receipt: raw result material is rejected before recording',
  );
  deepEqual(
    rawErrorHeld.failureReasons,
    ['error-digest-invalid', 'failure-result-missing'],
    'Execution receipt: raw error material is rejected before recording',
  );
  deepEqual(
    rawReceiptHeld.failureReasons,
    ['external-receipt-digest-invalid', 'success-result-missing'],
    'Execution receipt: raw external receipt material is rejected before recording',
  );
  equal(rawResultHeld.receipt, null, 'Execution receipt: invalid result digest emits no receipt');
  equal(rawErrorHeld.receipt, null, 'Execution receipt: invalid error digest emits no receipt');
  equal(rawReceiptHeld.receipt, null, 'Execution receipt: invalid external receipt digest emits no receipt');
  equal(
    serialized.includes(rawSuccessMarker),
    false,
    'Execution receipt: raw result marker is not serialized',
  );
  equal(
    serialized.includes(rawErrorMarker),
    false,
    'Execution receipt: raw error marker is not serialized',
  );
  equal(
    serialized.includes(rawReceiptMarker),
    false,
    'Execution receipt: raw external receipt marker is not serialized',
  );
}

function testDocsAndScriptsExposeExecutionReceipt(): void {
  const readme = readProjectFile('README.md');
  const receiptDoc = readProjectFile('docs', '02-architecture', 'downstream-execution-receipt.md');
  const replayDoc = readProjectFile('docs', '02-architecture', 'presentation-replay-ledger.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    readme,
    'reasons and proof references',
    'Execution receipt: README names proof references',
  );
  includes(
    receiptDoc,
    'What consequence was actually attempted, and what result was observed?',
    'Execution receipt: doc states post-consequence question',
  );
  includes(
    replayDoc,
    '[Downstream execution receipt](downstream-execution-receipt.md)',
    'Execution receipt: replay ledger doc links execution receipt',
  );
  includes(
    systemOverview,
    '[Downstream execution receipt](downstream-execution-receipt.md)',
    'Execution receipt: system overview links execution receipt',
  );
  equal(
    packageJson.scripts['test:downstream-execution-receipt'],
    'tsx tests/downstream-execution-receipt.test.ts',
    'Execution receipt: focused test script is exposed',
  );
}

testDescriptor();
testRecordsSuccessfulExecutionAfterReplayConsumption();
testHoldsWithoutReplayConsumption();
testTargetAndTimingMustMatch();
testStatusSpecificEvidenceRequirements();
testRawResultMaterialMustBeDigestShaped();
testDocsAndScriptsExposeExecutionReceipt();

console.log(`Downstream execution receipt tests: ${passed} passed, 0 failed`);
