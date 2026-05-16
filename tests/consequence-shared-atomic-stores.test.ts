import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import {
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionDownstreamContract,
  createConsequenceAdmissionPresentationBinding,
  createConsequenceAdmissionPresentationReplayLedger,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
  createConsequenceAdmissionRetryAttemptLedger,
  evaluateConsequenceAdmissionRetryBudget,
  type ConsequenceAdmissionCheck,
  type ConsequenceAdmissionDownstreamContract,
  type ConsequenceAdmissionRequest,
  type ConsequenceAdmissionResponse,
} from '../src/consequence-admission/index.js';
import {
  CONSEQUENCE_SHARED_ATOMIC_STORES_VERSION,
  CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE,
  CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE,
  consumeSharedConsequencePresentationReplayIfAbsent,
  ensureConsequenceSharedAtomicStores,
  recordSharedConsequenceRetryAttemptIfAbsent,
  resetConsequenceSharedAtomicStoresForTests,
} from '../src/service/consequence-shared-atomic-stores.js';
import {
  ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV,
  withReleaseAuthorityTransaction,
} from '../src/service/release-authority-store.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve a TCP port.'));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function retryAdmissionRequest(): ConsequenceAdmissionRequest {
  return createConsequenceAdmissionRequest({
    requestedAt: '2026-05-16T09:00:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'hosted-route',
      id: 'shared-atomic-retry',
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
    request: retryAdmissionRequest(),
    decidedAt: '2026-05-16T09:00:01.000Z',
    decision: 'review',
    reason: 'Evidence is missing before the refund can proceed.',
    reasonCodes: ['evidence-ref-missing'],
  });
}

function retryRequest(input: {
  readonly previousAdmission: ConsequenceAdmissionResponse;
  readonly attemptNumber: number;
  readonly attemptedAt: string;
  readonly idempotencyKey: string;
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
      idempotencyKey: input.idempotencyKey,
    },
  });
}

function passCheck(kind: ConsequenceAdmissionCheck['kind']): ConsequenceAdmissionCheck {
  return createConsequenceAdmissionCheck({
    kind,
    label: `${kind} check`,
    outcome: 'pass',
    required: true,
    summary: `${kind} passed for shared replay coverage.`,
    reasonCodes: [`${kind}-passed`],
    evidenceRefs: [`evidence:${kind}`],
  });
}

function paymentRequest(): ConsequenceAdmissionRequest {
  return createConsequenceAdmissionRequest({
    requestedAt: '2026-05-16T10:00:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'internal-service',
      id: 'shared-atomic-presentation-replay',
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

function admittedPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-16T10:00:01.000Z',
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
        id: 'rt_payment_shared_atomic_replay',
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

function retryIdempotencyScope(input: {
  readonly tenantId: string | null;
  readonly previousAdmissionId: string;
  readonly idempotencyKeyDigest: string | null;
}): string | null {
  if (input.idempotencyKeyDigest === null) return null;
  return [
    input.tenantId ?? 'tenant:null',
    input.previousAdmissionId,
    input.idempotencyKeyDigest,
  ].join('|');
}

async function testSharedRetryAttemptStore(): Promise<void> {
  const previousAdmission = heldAdmission();
  const retry = retryRequest({
    previousAdmission,
    attemptNumber: 1,
    attemptedAt: '2026-05-16T09:01:00.000Z',
    idempotencyKey: 'retry:refund:shared-atomic',
  });
  const retryBudget = evaluateConsequenceAdmissionRetryBudget({
    previousAdmission,
    retryAttempt: retry.retryAttempt!,
  });
  const ledger = createConsequenceAdmissionRetryAttemptLedger({
    ledgerId: 'ledger:retry:shared-atomic',
    now: () => '2026-05-16T09:01:01.000Z',
  });
  const recorded = ledger.record({
    previousAdmission,
    retryAttempt: retry.retryAttempt!,
    retryBudget,
  });
  const record = recorded.record!;
  const idempotencyScope = retryIdempotencyScope({
    tenantId: record.tenantId,
    previousAdmissionId: record.previousAdmissionId,
    idempotencyKeyDigest: record.idempotencyKeyDigest,
  });

  const [left, right] = await Promise.all([
    recordSharedConsequenceRetryAttemptIfAbsent({
      record,
      idempotencyScope,
      maxRecords: 25,
    }),
    recordSharedConsequenceRetryAttemptIfAbsent({
      record,
      idempotencyScope,
      maxRecords: 25,
    }),
  ]);
  equal(
    [left, right].filter((result) => result.outcome === 'recorded').length,
    1,
    'Consequence shared atomic stores: concurrent retry insert records once',
  );
  equal(
    [left, right].filter((result) => result.outcome === 'duplicate').length,
    1,
    'Consequence shared atomic stores: concurrent retry insert reports the duplicate',
  );

  const conflictingRetry = retryRequest({
    previousAdmission,
    attemptNumber: 2,
    attemptedAt: '2026-05-16T09:01:30.000Z',
    idempotencyKey: 'retry:refund:shared-atomic',
  });
  const conflictingLedger = createConsequenceAdmissionRetryAttemptLedger({
    ledgerId: 'ledger:retry:shared-atomic-conflict',
    now: () => '2026-05-16T09:01:31.000Z',
  });
  const conflictingDecision = conflictingLedger.record({
    previousAdmission,
    retryAttempt: conflictingRetry.retryAttempt!,
    retryBudget: evaluateConsequenceAdmissionRetryBudget({
      previousAdmission,
      retryAttempt: conflictingRetry.retryAttempt!,
    }),
  });
  const conflict = await recordSharedConsequenceRetryAttemptIfAbsent({
    record: conflictingDecision.record!,
    idempotencyScope,
    maxRecords: 25,
  });
  equal(
    conflict.outcome,
    'idempotency-key-conflict',
    'Consequence shared atomic stores: idempotency digest reuse conflicts across attempts',
  );

  await withReleaseAuthorityTransaction(async (client) => {
    const rows = await client.query(
      `SELECT record_json::text AS record_text
         FROM ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE}`,
    );
    equal(
      rows.rows.length,
      1,
      'Consequence shared atomic stores: failed idempotency conflict does not append retry row',
    );
    const recordText = String(rows.rows[0]?.record_text ?? '');
    equal(
      recordText.includes('retry:refund:shared-atomic'),
      false,
      'Consequence shared atomic stores: retry table does not store raw idempotency key',
    );
  });
}

async function testSharedPresentationReplayStore(): Promise<void> {
  const admission = admittedPayment();
  const contract = paymentContract();
  const binding = createConsequenceAdmissionPresentationBinding({
    admission,
    contract,
    target: {
      uri: 'https://payments.example.internal/supplier-payments',
      method: 'POST',
      bodyDigest: 'sha256:payment-body',
    },
    replayKey: 'payment:tenant_a:invoice_1938:shared_atomic',
    nonce: 'nonce:payment-adapter:shared-atomic',
    presentedAt: '2026-05-16T10:00:05.000Z',
    expiresAt: '2026-05-16T10:01:05.000Z',
  });
  const ledger = createConsequenceAdmissionPresentationReplayLedger({
    ledgerId: 'ledger:payment-adapter:shared-atomic',
    retentionSeconds: 120,
    now: () => '2026-05-16T10:00:30.000Z',
  });
  const consumed = ledger.consume({
    admission,
    contract,
    presentation: binding,
    expected: {
      targetUri: 'https://payments.example.internal/supplier-payments',
      method: 'POST',
      bodyDigest: 'sha256:payment-body',
      nonce: 'nonce:payment-adapter:shared-atomic',
      requireBodyDigest: true,
      requireReplayKey: true,
      requireNonce: true,
      maxFreshnessSeconds: 60,
    },
  });
  const entry = consumed.entry!;
  const [left, right] = await Promise.all([
    consumeSharedConsequencePresentationReplayIfAbsent({
      tenantId: 'tenant_payments',
      environment: 'production',
      entry,
    }),
    consumeSharedConsequencePresentationReplayIfAbsent({
      tenantId: 'tenant_payments',
      environment: 'production',
      entry,
    }),
  ]);

  equal(
    [left, right].filter((result) => result.outcome === 'consumed').length,
    1,
    'Consequence shared atomic stores: concurrent presentation replay consumes once',
  );
  equal(
    [left, right].filter((result) => result.outcome === 'duplicate').length,
    1,
    'Consequence shared atomic stores: concurrent presentation replay reports duplicate',
  );

  await withReleaseAuthorityTransaction(async (client) => {
    const rows = await client.query(
      `SELECT entry_json::text AS entry_text
         FROM ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE}`,
    );
    equal(
      rows.rows.length,
      1,
      'Consequence shared atomic stores: presentation replay table stores one entry',
    );
    const entryText = String(rows.rows[0]?.entry_text ?? '');
    equal(
      entryText.includes('payment:tenant_a:invoice_1938:shared_atomic'),
      false,
      'Consequence shared atomic stores: replay table does not store raw replay key',
    );
  });
}

async function run(): Promise<void> {
  const previousAuthorityUrl = process.env[ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV];
  const tempRoot = mkdtempSync(join(tmpdir(), 'attestor-consequence-shared-atomic-'));
  const pgPort = await reservePort();
  const pg = new EmbeddedPostgres({
    databaseDir: join(tempRoot, 'pg'),
    user: 'consequence_shared_atomic',
    password: 'consequence_shared_atomic',
    port: pgPort,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('attestor_release_authority');
    process.env[ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV] =
      `postgres://consequence_shared_atomic:consequence_shared_atomic@localhost:${pgPort}/attestor_release_authority`;

    const bootSummary = await ensureConsequenceSharedAtomicStores();
    equal(
      bootSummary.version,
      CONSEQUENCE_SHARED_ATOMIC_STORES_VERSION,
      'Consequence shared atomic stores: boot summary exposes version',
    );
    equal(
      bootSummary.rawPayloadStored,
      false,
      'Consequence shared atomic stores: boot summary is raw-payload-free',
    );
    equal(
      bootSummary.rawIdempotencyKeyStored,
      false,
      'Consequence shared atomic stores: boot summary records raw-idempotency-key-free storage',
    );
    equal(
      bootSummary.rawReplayKeyStored,
      false,
      'Consequence shared atomic stores: boot summary records raw-replay-key-free storage',
    );
    ok(
      bootSummary.operationalEvidence.every((evidence) =>
        /^sha256:[a-f0-9]{64}$/u.test(evidence.schemaDigest) &&
        /^sha256:[a-f0-9]{64}$/u.test(evidence.tenantScopeDigest) &&
        /^sha256:[a-f0-9]{64}$/u.test(evidence.idempotencyConstraintDigest)
      ),
      'Consequence shared atomic stores: operational evidence exposes digest-shaped proofs',
    );
    equal(
      bootSummary.productionSharedRuntimeWired,
      false,
      'Consequence shared atomic stores: summary does not claim runtime cutover',
    );

    await testSharedRetryAttemptStore();
    await testSharedPresentationReplayStore();

    const summary = await ensureConsequenceSharedAtomicStores();
    equal(
      summary.retryAttemptRecords,
      1,
      'Consequence shared atomic stores: summary counts retry records',
    );
    equal(
      summary.presentationReplayRecords,
      1,
      'Consequence shared atomic stores: summary counts presentation replay records',
    );
    equal(
      JSON.stringify(summary).includes(`localhost:${pgPort}`),
      false,
      'Consequence shared atomic stores: summary does not expose database URL or host',
    );
  } finally {
    await resetConsequenceSharedAtomicStoresForTests();
    if (previousAuthorityUrl === undefined) {
      delete process.env[ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV];
    } else {
      process.env[ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV] = previousAuthorityUrl;
    }
    try {
      await pg.stop();
    } catch {}
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {}
  }

  console.log(`Consequence shared atomic stores tests: ${passed} passed, 0 failed`);
}

run().catch((error) => {
  console.error('Consequence shared atomic stores tests failed:', error);
  process.exit(1);
});
