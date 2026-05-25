import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import {
  CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
  type ConsequenceAdmissionPresentationReplayLedgerEntry,
} from '../src/consequence-admission/presentation-replay-ledger.js';
import {
  CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
  type ConsequenceAdmissionRetryAttemptLedgerRecord,
} from '../src/consequence-admission/retry-attempt-ledger.js';
import {
  consumeSharedConsequencePresentationReplayIfAbsent,
  ensureConsequenceSharedAtomicStores,
  recordSharedConsequenceRetryAttemptIfAbsent,
  resetConsequenceSharedAtomicStoresForTests,
} from '../src/service/consequence-shared-atomic-stores.js';
import {
  ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV,
  closeReleaseAuthorityStorePoolForTests,
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

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
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

function retryRecord(input: {
  readonly retryAttemptId: string;
  readonly recordId: string;
  readonly idempotencySeed: string;
  readonly recordedAt: string;
}): ConsequenceAdmissionRetryAttemptLedgerRecord {
  const previousAdmissionDigest = digest('local-rehearsal:admission');
  const retryBudgetDigest = digest('local-rehearsal:budget');
  const base = {
    version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
    ledgerId: 'ledger:local-rehearsal:retry',
    recordId: input.recordId,
    recordedAt: input.recordedAt,
    tenantId: 'tenant_local_rehearsal',
    environment: 'local-rehearsal',
    previousAdmissionId: 'admission_local_rehearsal',
    previousAdmissionDigest,
    previousRequestId: 'request_local_rehearsal',
    retryAttemptId: input.retryAttemptId,
    retryAttemptDigest: digest(`local-rehearsal:${input.retryAttemptId}`),
    attemptNumber: input.retryAttemptId.endsWith('_2') ? 2 : 1,
    attemptedAt: input.recordedAt,
    correctionReasonCodes: ['evidence-ref-missing'],
    correctionFields: ['evidenceRefs'],
    idempotencyKeyDigest: digest(input.idempotencySeed),
    retryBudgetDigest,
    retryBudgetOutcome: 'allow-retry',
    retryAllowed: true,
    retryBudgetFailClosed: false,
    retryBudgetReasonCodes: ['retry-budget-allow-retry'],
    rawPayloadStored: false,
  } satisfies Omit<ConsequenceAdmissionRetryAttemptLedgerRecord, 'recordDigest'>;
  return Object.freeze({
    ...base,
    recordDigest: digest(JSON.stringify(base)),
  });
}

function replayEntry(input: {
  readonly entrySeed: string;
  readonly replaySeed: string;
  readonly consumedAt: string;
}): ConsequenceAdmissionPresentationReplayLedgerEntry {
  const base = {
    version: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
    ledgerId: 'ledger:local-rehearsal:presentation-replay',
    replayKeyDigest: digest(input.replaySeed),
    bindingId: 'binding_local_rehearsal',
    bindingDigest: digest('local-rehearsal:binding'),
    admissionId: 'admission_local_rehearsal',
    admissionDigest: digest('local-rehearsal:admission'),
    contractId: 'contract_local_rehearsal',
    enforcementPointId: 'pep_local_rehearsal',
    targetDigest: digest('local-rehearsal:target'),
    nonceDigest: digest('local-rehearsal:nonce'),
    consumedAt: input.consumedAt,
    presentationExpiresAt: '2026-05-25T11:05:00.000Z',
    retainedUntil: '2026-05-25T11:10:00.000Z',
    presentationReceiptDigest: digest('local-rehearsal:presentation-receipt'),
  } satisfies Omit<ConsequenceAdmissionPresentationReplayLedgerEntry, 'entryDigest'>;
  return Object.freeze({
    ...base,
    entryDigest: digest(`${input.entrySeed}:${JSON.stringify(base)}`),
  });
}

async function testRetryAttemptAcrossLocalInstances(): Promise<void> {
  const first = retryRecord({
    retryAttemptId: 'retry_local_rehearsal_1',
    recordId: 'record_local_rehearsal_1',
    idempotencySeed: 'idempotency:local-rehearsal',
    recordedAt: '2026-05-25T10:00:00.000Z',
  });
  const idempotencyScope = [
    first.tenantId,
    first.previousAdmissionId,
    first.idempotencyKeyDigest,
  ].join('|');

  const [runtimeA, runtimeB] = await Promise.all([
    recordSharedConsequenceRetryAttemptIfAbsent({
      record: first,
      idempotencyScope,
      maxRecords: 10,
    }),
    recordSharedConsequenceRetryAttemptIfAbsent({
      record: first,
      idempotencyScope,
      maxRecords: 10,
    }),
  ]);

  equal(
    [runtimeA, runtimeB].filter((result) => result.outcome === 'recorded').length,
    1,
    'Local consequence shared-store rehearsal: one runtime records the retry attempt',
  );
  equal(
    [runtimeA, runtimeB].filter((result) => result.outcome === 'duplicate').length,
    1,
    'Local consequence shared-store rehearsal: the second runtime sees the duplicate retry attempt',
  );
  equal(
    runtimeA.rawIdempotencyKeyStored || runtimeB.rawIdempotencyKeyStored,
    false,
    'Local consequence shared-store rehearsal: retry result does not store raw idempotency keys',
  );

  const conflict = await recordSharedConsequenceRetryAttemptIfAbsent({
    record: retryRecord({
      retryAttemptId: 'retry_local_rehearsal_2',
      recordId: 'record_local_rehearsal_2',
      idempotencySeed: 'idempotency:local-rehearsal',
      recordedAt: '2026-05-25T10:00:30.000Z',
    }),
    idempotencyScope,
    maxRecords: 10,
  });
  equal(
    conflict.outcome,
    'idempotency-key-conflict',
    'Local consequence shared-store rehearsal: reused idempotency scope fails closed across retry attempts',
  );
}

async function testPresentationReplayAcrossLocalInstances(): Promise<void> {
  const entry = replayEntry({
    entrySeed: 'entry:local-rehearsal:1',
    replaySeed: 'replay-key:local-rehearsal',
    consumedAt: '2026-05-25T11:00:00.000Z',
  });
  const [runtimeA, runtimeB] = await Promise.all([
    consumeSharedConsequencePresentationReplayIfAbsent({
      tenantId: 'tenant_local_rehearsal',
      environment: 'local-rehearsal',
      entry,
    }),
    consumeSharedConsequencePresentationReplayIfAbsent({
      tenantId: 'tenant_local_rehearsal',
      environment: 'local-rehearsal',
      entry,
    }),
  ]);

  equal(
    [runtimeA, runtimeB].filter((result) => result.outcome === 'consumed').length,
    1,
    'Local consequence shared-store rehearsal: one runtime consumes the replay key',
  );
  equal(
    [runtimeA, runtimeB].filter((result) => result.outcome === 'duplicate').length,
    1,
    'Local consequence shared-store rehearsal: the second runtime rejects the replay duplicate',
  );
  equal(
    runtimeA.rawReplayKeyStored || runtimeB.rawReplayKeyStored,
    false,
    'Local consequence shared-store rehearsal: replay result does not store raw replay keys',
  );
}

async function testReconnectKeepsSharedStateVisible(): Promise<void> {
  await closeReleaseAuthorityStorePoolForTests();
  const summary = await ensureConsequenceSharedAtomicStores();
  equal(
    summary.retryAttemptRecords,
    1,
    'Local consequence shared-store rehearsal: retry record remains visible after pool reconnect',
  );
  equal(
    summary.presentationReplayRecords,
    1,
    'Local consequence shared-store rehearsal: replay record remains visible after pool reconnect',
  );
  equal(
    summary.rawPayloadStored,
    false,
    'Local consequence shared-store rehearsal: summary remains raw-payload-free',
  );
  equal(
    summary.productionSharedRuntimeWired,
    false,
    'Local consequence shared-store rehearsal: local test does not claim production-shared runtime cutover',
  );
  ok(
    summary.limitation.includes('Repository-side atomic shared stores only'),
    'Local consequence shared-store rehearsal: summary keeps repository-side limitation visible',
  );
}

async function run(): Promise<void> {
  const previousAuthorityUrl = process.env[ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV];
  const tempRoot = mkdtempSync(join(tmpdir(), 'attestor-local-consequence-shared-rehearsal-'));
  const pgPort = await reservePort();
  const pg = new EmbeddedPostgres({
    databaseDir: join(tempRoot, 'pg'),
    user: 'local_consequence_shared_rehearsal',
    password: 'local_consequence_shared_rehearsal',
    port: pgPort,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('attestor_release_authority');
    process.env[ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV] =
      `postgres://local_consequence_shared_rehearsal:local_consequence_shared_rehearsal@localhost:${pgPort}/attestor_release_authority`;

    const boot = await ensureConsequenceSharedAtomicStores();
    equal(
      boot.productionSharedRuntimeWired,
      false,
      'Local consequence shared-store rehearsal: boot summary keeps runtime cutover unclaimed',
    );

    await testRetryAttemptAcrossLocalInstances();
    await testPresentationReplayAcrossLocalInstances();
    await testReconnectKeepsSharedStateVisible();
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

  console.log(`Local consequence shared-store rehearsal tests: ${passed} passed, 0 failed`);
}

run().catch((error) => {
  console.error('Local consequence shared-store rehearsal tests failed:', error);
  process.exit(1);
});
