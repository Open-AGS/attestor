import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
  consequenceAdmissionPresentationReplayLedgerDescriptor,
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionDownstreamContract,
  createConsequenceAdmissionPresentationBinding,
  createConsequenceAdmissionPresentationReplayLedger,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
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

function paymentRequest(): ConsequenceAdmissionRequest {
  return createConsequenceAdmissionRequest({
    requestedAt: '2026-05-01T13:00:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'internal-service',
      id: 'presentation-replay-ledger-payment',
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
    summary: `${kind} passed for replay ledger coverage.`,
    reasonCodes: [`${kind}-passed`],
    evidenceRefs: [`evidence:${kind}`],
  });
}

function admittedPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T13:00:01.000Z',
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
        id: 'rt_payment_replay_ledger',
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

function paymentBinding(input: {
  readonly admission: ConsequenceAdmissionResponse;
  readonly replayKey?: string | null;
  readonly bodyDigest?: string | null;
  readonly presentedAt?: string;
  readonly expiresAt?: string;
}) {
  return createConsequenceAdmissionPresentationBinding({
    admission: input.admission,
    contract: paymentContract(),
    target: {
      uri: 'https://payments.example.internal/supplier-payments',
      method: 'POST',
      bodyDigest: input.bodyDigest ?? 'sha256:payment-body',
    },
    replayKey: 'replayKey' in input
      ? input.replayKey
      : 'payment:tenant_a:invoice_1938:attempt_1',
    nonce: 'nonce:payment-adapter:001',
    presentedAt: input.presentedAt ?? '2026-05-01T13:00:05.000Z',
    expiresAt: input.expiresAt ?? '2026-05-01T13:01:05.000Z',
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
  const descriptor = consequenceAdmissionPresentationReplayLedgerDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
    'Replay ledger: descriptor exposes stable version',
  );
  ok(
    descriptor.failureReasons.includes('replay-key-already-consumed'),
    'Replay ledger: duplicate replay failure reason is explicit',
  );
  equal(
    descriptor.storesRawReplayKeysExternally,
    false,
    'Replay ledger: exported entries do not expose raw replay keys',
  );
  equal(
    descriptor.storesRawReplayKeysInMemory,
    false,
    'Replay ledger: in-memory reference does not retain raw replay keys',
  );
  equal(
    descriptor.replayKeyIndex,
    'sha256-digest',
    'Replay ledger: duplicate detection is indexed by replay key digest',
  );
  equal(
    descriptor.productionSharedStoreIncluded,
    false,
    'Replay ledger: descriptor does not overclaim production shared store',
  );
}

function testFirstConsumeStoresRedactedEntry(): void {
  const admission = admittedPayment();
  const ledger = createConsequenceAdmissionPresentationReplayLedger({
    ledgerId: 'ledger:payment-adapter',
    retentionSeconds: 120,
    now: () => '2026-05-01T13:00:30.000Z',
  });
  const consumed = ledger.consume({
    admission,
    contract: paymentContract(),
    presentation: paymentBinding({ admission }),
    expected: EXPECTED,
  });
  const snapshot = ledger.snapshot('2026-05-01T13:00:31.000Z');

  equal(consumed.outcome, 'consumed', 'Replay ledger: first valid consume succeeds');
  equal(consumed.consumed, true, 'Replay ledger: consumed flag is true');
  equal(consumed.failClosed, false, 'Replay ledger: successful consumption is not fail-closed');
  ok(
    consumed.entry?.replayKeyDigest.startsWith('sha256:'),
    'Replay ledger: entry stores replay key digest',
  );
  equal(snapshot.entryCount, 1, 'Replay ledger: snapshot has one entry');
  equal(
    JSON.stringify(snapshot).includes('payment:tenant_a:invoice_1938:attempt_1'),
    false,
    'Replay ledger: snapshot does not expose raw replay key',
  );
  equal(
    JSON.stringify(consumed).includes('payment:tenant_a:invoice_1938:attempt_1'),
    false,
    'Replay ledger: consume decision does not expose raw replay key',
  );
  const snapshotText = JSON.stringify(snapshot);
  const targetNeedle = ['https://payments.example.internal', 'supplier-payments'].join('/');
  equal(
    snapshotText.includes(targetNeedle),
    false,
    'Replay ledger: snapshot does not expose raw target URI',
  );
  equal(
    ledger.has('payment:tenant_a:invoice_1938:attempt_1', '2026-05-01T13:00:31.000Z'),
    true,
    'Replay ledger: has detects consumed key inside retention window',
  );
}

function testSecondConsumeHoldsAsReplay(): void {
  const admission = admittedPayment();
  const ledger = createConsequenceAdmissionPresentationReplayLedger({
    ledgerId: 'ledger:payment-adapter',
    now: () => '2026-05-01T13:00:30.000Z',
  });
  const binding = paymentBinding({ admission });
  ledger.consume({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: EXPECTED,
  });
  const replay = ledger.consume({
    admission,
    contract: paymentContract(),
    presentation: binding,
    expected: EXPECTED,
    consumedAt: '2026-05-01T13:00:40.000Z',
  });

  equal(replay.outcome, 'held', 'Replay ledger: second consume holds');
  equal(replay.failClosed, true, 'Replay ledger: replay is fail-closed');
  deepEqual(
    replay.failureReasons,
    ['presentation-held', 'replay-key-already-consumed'],
    'Replay ledger: duplicate failure reasons are precise',
  );
  ok(
    replay.presentationDecision.failureReasons.includes('replay-key-reused'),
    'Replay ledger: attached presentation decision preserves replay-key-reused reason',
  );
}

function testInvalidPresentationDoesNotConsume(): void {
  const admission = admittedPayment();
  const ledger = createConsequenceAdmissionPresentationReplayLedger({
    ledgerId: 'ledger:payment-adapter',
    now: () => '2026-05-01T13:00:30.000Z',
  });
  const held = ledger.consume({
    admission,
    contract: paymentContract(),
    presentation: paymentBinding({
      admission,
      replayKey: 'payment:tenant_a:invoice_1938:attempt_2',
      bodyDigest: 'sha256:tampered-body',
    }),
    expected: EXPECTED,
  });

  equal(held.outcome, 'held', 'Replay ledger: invalid presentation holds');
  deepEqual(
    held.failureReasons,
    ['presentation-held'],
    'Replay ledger: invalid presentation is not consumed',
  );
  equal(
    ledger.has('payment:tenant_a:invoice_1938:attempt_2', '2026-05-01T13:00:31.000Z'),
    false,
    'Replay ledger: invalid presentation does not mark replay key consumed',
  );
}

function testMissingReplayKeyAndExpiryHold(): void {
  const admission = admittedPayment();
  const ledger = createConsequenceAdmissionPresentationReplayLedger({
    ledgerId: 'ledger:payment-adapter',
  });
  const missing = ledger.consume({
    admission,
    contract: paymentContract(),
    presentation: paymentBinding({
      admission,
      replayKey: null,
    }),
    expected: EXPECTED,
    consumedAt: '2026-05-01T13:00:30.000Z',
  });
  const expired = ledger.consume({
    admission,
    contract: paymentContract(),
    presentation: paymentBinding({
      admission,
      replayKey: 'payment:tenant_a:invoice_1938:attempt_3',
      presentedAt: '2026-05-01T13:00:05.000Z',
      expiresAt: '2026-05-01T13:00:15.000Z',
    }),
    expected: EXPECTED,
    consumedAt: '2026-05-01T13:00:30.000Z',
  });

  deepEqual(
    missing.failureReasons,
    ['presentation-held', 'replay-key-missing'],
    'Replay ledger: missing replay key holds at presentation and ledger layers',
  );
  deepEqual(
    expired.failureReasons,
    ['presentation-held'],
    'Replay ledger: expired presentation holds before consumption',
  );
  ok(
    expired.presentationDecision.failureReasons.includes('presentation-expired'),
    'Replay ledger: expired presentation reason remains attached',
  );
}

function testPruneRemovesEntriesAfterRetention(): void {
  const admission = admittedPayment();
  const ledger = createConsequenceAdmissionPresentationReplayLedger({
    ledgerId: 'ledger:payment-adapter',
    retentionSeconds: 30,
    now: () => '2026-05-01T13:00:30.000Z',
  });
  ledger.consume({
    admission,
    contract: paymentContract(),
    presentation: paymentBinding({
      admission,
      replayKey: 'payment:tenant_a:invoice_1938:attempt_4',
      expiresAt: '2026-05-01T13:01:05.000Z',
    }),
    expected: EXPECTED,
  });

  equal(
    ledger.prune('2026-05-01T13:02:00.000Z'),
    1,
    'Replay ledger: prune removes entries after retention window',
  );
  equal(
    ledger.snapshot('2026-05-01T13:02:01.000Z').entryCount,
    0,
    'Replay ledger: snapshot is empty after prune',
  );
}

function testDocsAndScriptsExposeReplayLedger(): void {
  const readme = readProjectFile('README.md');
  const ledgerDoc = readProjectFile('docs', '02-architecture', 'presentation-replay-ledger.md');
  const bindingDoc = readProjectFile('docs', '02-architecture', 'downstream-presentation-binding.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const ledgerSource = readProjectFile('src', 'consequence-admission', 'presentation-replay-ledger.ts');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    readme,
    'docs/02-architecture/presentation-replay-ledger.md',
    'Replay ledger: README links replay ledger doc',
  );
  includes(
    ledgerDoc,
    'indexes replay consumption by `replayKeyDigest`',
    'Replay ledger: doc states digest-indexed replay consumption',
  );
  includes(
    ledgerSource,
    'entriesByReplayKeyDigest',
    'Replay ledger: source names digest-indexed storage',
  );
  equal(
    ledgerSource.includes('entries.set(replayKey'),
    false,
    'Replay ledger: source does not index entries by raw replay key',
  );
  includes(
    bindingDoc,
    '[Presentation replay ledger](presentation-replay-ledger.md)',
    'Replay ledger: presentation binding doc links replay ledger',
  );
  includes(
    systemOverview,
    '[Presentation replay ledger](presentation-replay-ledger.md)',
    'Replay ledger: system overview links replay ledger',
  );
  equal(
    packageJson.scripts['test:presentation-replay-ledger'],
    'tsx tests/presentation-replay-ledger.test.ts',
    'Replay ledger: focused test script is exposed',
  );
}

testDescriptor();
testFirstConsumeStoresRedactedEntry();
testSecondConsumeHoldsAsReplay();
testInvalidPresentationDoesNotConsume();
testMissingReplayKeyAndExpiryHold();
testPruneRemovesEntriesAfterRetention();
testDocsAndScriptsExposeReplayLedger();

console.log(`Presentation replay ledger tests: ${passed} passed, 0 failed`);
