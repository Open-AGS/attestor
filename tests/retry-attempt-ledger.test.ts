import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
  consequenceAdmissionRetryAttemptLedgerDescriptor,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
  createConsequenceAdmissionRetryAttemptLedger,
  evaluateConsequenceAdmissionRetryBudget,
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
  assert.deepEqual(actual, expected);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function firstRequest(): ConsequenceAdmissionRequest {
  return createConsequenceAdmissionRequest({
    requestedAt: '2026-05-02T08:00:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'hosted-route',
      id: 'retry-attempt-ledger-refund',
      route: '/api/v1/admissions',
      packageSubpath: null,
      sourceRef: 'src/service/http/routes/generic-admission-routes.ts',
    },
    proposedConsequence: {
      actor: 'support-ai-agent',
      action: 'issue_refund',
      downstreamSystem: 'refund-service',
      consequenceKind: 'action',
      riskClass: 'R3',
      summary: 'Support copilot proposes a customer refund.',
    },
    policyScope: {
      policyRef: 'policy:refunds:v1',
      tenantId: 'tenant_retail',
      environment: 'production',
      dimensions: {
        domain: 'money-movement',
      },
    },
    authority: {
      actorRef: 'actor:support-ai-agent',
      reviewerRef: 'reviewer:refund-ops',
      authorityMode: 'named-reviewer',
    },
    evidence: [],
    nativeInputRefs: ['amount', 'recipient', 'evidenceRefs'],
  });
}

function heldAdmission(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: firstRequest(),
    decidedAt: '2026-05-02T08:00:01.000Z',
    decision: 'review',
    reason: 'Evidence is missing before the refund can proceed.',
    reasonCodes: ['evidence-ref-missing'],
  });
}

function retryRequest(input: {
  readonly previousAdmission: ConsequenceAdmissionResponse;
  readonly attemptNumber: number;
  readonly attemptedAt: string;
  readonly idempotencyKey?: string | null;
}): ConsequenceAdmissionRequest {
  const previous = input.previousAdmission;
  return createConsequenceAdmissionRequest({
    requestedAt: input.attemptedAt,
    packFamily: 'general',
    entryPoint: previous.request.entryPoint,
    proposedConsequence: previous.request.proposedConsequence,
    policyScope: previous.request.policyScope,
    authority: previous.request.authority,
    evidence: [
      {
        id: 'evidence:refund-order',
        kind: 'evidence_ref',
        digest: 'sha256:refund-order',
        uri: null,
      },
    ],
    nativeInputRefs: ['amount', 'recipient', 'evidenceRefs'],
    retryAttempt: {
      previousAdmissionId: previous.admissionId,
      previousAdmissionDigest: previous.digest,
      previousRequestId: previous.request.requestId,
      attemptNumber: input.attemptNumber,
      attemptedAt: input.attemptedAt,
      correctionReasonCodes: ['evidence-ref-missing'],
      correctionFields: ['evidenceRefs'],
      idempotencyKey: input.idempotencyKey ?? `retry:refund:${input.attemptNumber}`,
    },
  });
}

function testDescriptorAndContractSurface(): void {
  const descriptor = consequenceAdmissionRetryAttemptLedgerDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
    'Retry attempt ledger: descriptor exposes stable version',
  );
  ok(
    descriptor.outcomes.includes('duplicate'),
    'Retry attempt ledger: duplicate outcome is explicit',
  );
  ok(
    descriptor.failureReasons.includes('idempotency-key-conflict'),
    'Retry attempt ledger: idempotency conflict is explicit',
  );
  equal(
    descriptor.storesRawIdempotencyKeysExternally,
    false,
    'Retry attempt ledger: descriptor does not expose raw idempotency keys',
  );
  equal(
    descriptor.productionSharedStoreIncluded,
    false,
    'Retry attempt ledger: descriptor avoids production shared-store overclaiming',
  );
}

function testRecordsAllowedRetryWithoutRawPayload(): void {
  const previousAdmission = heldAdmission();
  const retry = retryRequest({
    previousAdmission,
    attemptNumber: 1,
    attemptedAt: '2026-05-02T08:01:00.000Z',
    idempotencyKey: 'retry:refund:shared-safe-key',
  });
  const retryBudget = evaluateConsequenceAdmissionRetryBudget({
    previousAdmission,
    retryAttempt: retry.retryAttempt!,
  });
  const ledger = createConsequenceAdmissionRetryAttemptLedger({
    ledgerId: 'ledger:retry:tenant_retail',
    now: () => '2026-05-02T08:01:01.000Z',
  });
  const recorded = ledger.record({
    previousAdmission,
    retryAttempt: retry.retryAttempt!,
    retryBudget,
  });

  equal(recorded.outcome, 'recorded', 'Retry attempt ledger: first valid retry is recorded');
  equal(recorded.retryAllowed, true, 'Retry attempt ledger: allowed budget remains allowed');
  equal(recorded.failClosed, false, 'Retry attempt ledger: allowed retry is not fail-closed');
  ok(
    recorded.record?.idempotencyKeyDigest.startsWith('sha256:'),
    'Retry attempt ledger: idempotency key is stored as a digest',
  );
  equal(
    JSON.stringify(recorded).includes('retry:refund:shared-safe-key'),
    false,
    'Retry attempt ledger: raw idempotency key is not exported',
  );
  equal(
    recorded.record?.rawPayloadStored,
    false,
    'Retry attempt ledger: record declares raw payload is not stored',
  );
  equal(ledger.snapshot().recordCount, 1, 'Retry attempt ledger: snapshot records one attempt');
}

function testDuplicateAttemptReturnsExistingRecord(): void {
  const previousAdmission = heldAdmission();
  const retry = retryRequest({
    previousAdmission,
    attemptNumber: 1,
    attemptedAt: '2026-05-02T08:01:00.000Z',
  });
  const retryBudget = evaluateConsequenceAdmissionRetryBudget({
    previousAdmission,
    retryAttempt: retry.retryAttempt!,
  });
  const ledger = createConsequenceAdmissionRetryAttemptLedger({
    ledgerId: 'ledger:retry:duplicates',
    now: () => '2026-05-02T08:01:01.000Z',
  });
  const first = ledger.record({
    previousAdmission,
    retryAttempt: retry.retryAttempt!,
    retryBudget,
  });
  const second = ledger.record({
    previousAdmission,
    retryAttempt: retry.retryAttempt!,
    retryBudget,
  });

  equal(first.outcome, 'recorded', 'Retry attempt ledger: first attempt records');
  equal(second.outcome, 'duplicate', 'Retry attempt ledger: second same attempt is duplicate');
  equal(second.duplicate, true, 'Retry attempt ledger: duplicate flag is true');
  equal(
    second.record?.recordDigest,
    first.record?.recordDigest,
    'Retry attempt ledger: duplicate returns the original record digest',
  );
  equal(ledger.snapshot().recordCount, 1, 'Retry attempt ledger: duplicate does not append');
}

function testIdempotencyKeyConflictHolds(): void {
  const previousAdmission = heldAdmission();
  const firstRetry = retryRequest({
    previousAdmission,
    attemptNumber: 1,
    attemptedAt: '2026-05-02T08:01:00.000Z',
    idempotencyKey: 'retry:refund:collision',
  });
  const secondRetry = retryRequest({
    previousAdmission,
    attemptNumber: 2,
    attemptedAt: '2026-05-02T08:01:30.000Z',
    idempotencyKey: 'retry:refund:collision',
  });
  const ledger = createConsequenceAdmissionRetryAttemptLedger({
    ledgerId: 'ledger:retry:idempotency-conflict',
  });
  ledger.record({
    previousAdmission,
    retryAttempt: firstRetry.retryAttempt!,
    retryBudget: evaluateConsequenceAdmissionRetryBudget({
      previousAdmission,
      retryAttempt: firstRetry.retryAttempt!,
    }),
  });
  const conflict = ledger.record({
    previousAdmission,
    retryAttempt: secondRetry.retryAttempt!,
    retryBudget: evaluateConsequenceAdmissionRetryBudget({
      previousAdmission,
      retryAttempt: secondRetry.retryAttempt!,
    }),
  });

  equal(conflict.outcome, 'held', 'Retry attempt ledger: conflicting idempotency key holds');
  deepEqual(
    conflict.failureReasons,
    ['idempotency-key-conflict'],
    'Retry attempt ledger: idempotency conflict reason is precise',
  );
  equal(conflict.failClosed, true, 'Retry attempt ledger: idempotency conflict is fail-closed');
  equal(ledger.snapshot().recordCount, 1, 'Retry attempt ledger: conflict does not append');
}

function testBudgetHeldAttemptIsStillRecordedAsEvidence(): void {
  const previousAdmission = heldAdmission();
  const retry = retryRequest({
    previousAdmission,
    attemptNumber: 3,
    attemptedAt: '2026-05-02T08:01:30.000Z',
  });
  const retryBudget = evaluateConsequenceAdmissionRetryBudget({
    previousAdmission,
    retryAttempt: retry.retryAttempt!,
  });
  const ledger = createConsequenceAdmissionRetryAttemptLedger({
    ledgerId: 'ledger:retry:budget-held',
  });
  const recorded = ledger.record({
    previousAdmission,
    retryAttempt: retry.retryAttempt!,
    retryBudget,
  });

  equal(retryBudget.outcome, 'hold-for-review', 'Retry attempt ledger: fixture budget holds');
  equal(recorded.outcome, 'recorded', 'Retry attempt ledger: budget-held attempt is still recorded');
  equal(recorded.retryAllowed, false, 'Retry attempt ledger: held budget remains not allowed');
  equal(recorded.failClosed, true, 'Retry attempt ledger: held budget is fail-closed');
  ok(
    recorded.record?.retryBudgetReasonCodes.includes('retry-budget-exhausted'),
    'Retry attempt ledger: record preserves budget reason codes',
  );
  equal(
    ledger.summary().retryHeldCount,
    1,
    'Retry attempt ledger: summary counts budget-held retries',
  );
}

function testMismatchedBudgetFailsClosedWithoutRecord(): void {
  const previousAdmission = heldAdmission();
  const firstRetry = retryRequest({
    previousAdmission,
    attemptNumber: 1,
    attemptedAt: '2026-05-02T08:01:00.000Z',
  });
  const secondRetry = retryRequest({
    previousAdmission,
    attemptNumber: 2,
    attemptedAt: '2026-05-02T08:01:30.000Z',
  });
  const ledger = createConsequenceAdmissionRetryAttemptLedger({
    ledgerId: 'ledger:retry:mismatched-budget',
  });
  const held = ledger.record({
    previousAdmission,
    retryAttempt: firstRetry.retryAttempt!,
    retryBudget: evaluateConsequenceAdmissionRetryBudget({
      previousAdmission,
      retryAttempt: secondRetry.retryAttempt!,
    }),
  });

  equal(held.outcome, 'held', 'Retry attempt ledger: mismatched budget holds');
  ok(
    held.failureReasons.includes('retry-budget-attempt-mismatch'),
    'Retry attempt ledger: detects retry budget attempt mismatch',
  );
  equal(ledger.snapshot().recordCount, 0, 'Retry attempt ledger: mismatched budget is not recorded');
}

function testCapacityLimitFailsClosed(): void {
  const previousAdmission = heldAdmission();
  const firstRetry = retryRequest({
    previousAdmission,
    attemptNumber: 1,
    attemptedAt: '2026-05-02T08:01:00.000Z',
  });
  const secondRetry = retryRequest({
    previousAdmission,
    attemptNumber: 2,
    attemptedAt: '2026-05-02T08:01:30.000Z',
  });
  const ledger = createConsequenceAdmissionRetryAttemptLedger({
    ledgerId: 'ledger:retry:capacity',
    maxRecords: 1,
  });
  ledger.record({
    previousAdmission,
    retryAttempt: firstRetry.retryAttempt!,
    retryBudget: evaluateConsequenceAdmissionRetryBudget({
      previousAdmission,
      retryAttempt: firstRetry.retryAttempt!,
    }),
  });
  const held = ledger.record({
    previousAdmission,
    retryAttempt: secondRetry.retryAttempt!,
    retryBudget: evaluateConsequenceAdmissionRetryBudget({
      previousAdmission,
      retryAttempt: secondRetry.retryAttempt!,
    }),
  });

  equal(held.outcome, 'held', 'Retry attempt ledger: capacity exhaustion holds');
  deepEqual(
    held.failureReasons,
    ['ledger-capacity-exhausted'],
    'Retry attempt ledger: capacity reason is precise',
  );
  equal(held.failClosed, true, 'Retry attempt ledger: capacity exhaustion is fail-closed');
}

function testDocsAndScriptsExposeRetryAttemptLedger(): void {
  const readme = readProjectFile('README.md');
  const quickstart = readProjectFile('docs', '01-overview', 'consequence-admission-quickstart.md');
  const positioning = readProjectFile('docs', '01-overview', 'action-authorization-positioning.md');
  const ledgerDoc = readProjectFile('docs', '02-architecture', 'retry-attempt-ledger.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    readme,
    'docs/02-architecture/retry-attempt-ledger.md',
    'Retry attempt ledger: README links architecture doc',
  );
  includes(
    quickstart,
    'The retry attempt ledger records each bound retry attempt',
    'Retry attempt ledger: quickstart states ledger purpose',
  );
  includes(
    positioning,
    'The fourth layer is retry attempt ledger',
    'Retry attempt ledger: positioning names fourth retry layer',
  );
  includes(
    ledgerDoc,
    'idempotency key digest',
    'Retry attempt ledger: doc states idempotency redaction',
  );
  includes(
    systemOverview,
    '[Retry attempt ledger](retry-attempt-ledger.md)',
    'Retry attempt ledger: system overview links doc',
  );
  equal(
    packageJson.scripts['test:retry-attempt-ledger'],
    'tsx tests/retry-attempt-ledger.test.ts',
    'Retry attempt ledger: focused test script is exposed',
  );
}

testDescriptorAndContractSurface();
testRecordsAllowedRetryWithoutRawPayload();
testDuplicateAttemptReturnsExistingRecord();
testIdempotencyKeyConflictHolds();
testBudgetHeldAttemptIsStillRecordedAsEvidence();
testMismatchedBudgetFailsClosedWithoutRecord();
testCapacityLimitFailsClosed();
testDocsAndScriptsExposeRetryAttemptLedger();

console.log(`Retry attempt ledger tests: ${passed} passed, 0 failed`);
