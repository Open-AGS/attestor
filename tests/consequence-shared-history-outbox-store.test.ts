import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import {
  CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION,
  CONSEQUENCE_SHARED_HISTORY_TABLE,
  CONSEQUENCE_SHARED_OUTBOX_TABLE,
  appendSharedConsequenceHistory,
  claimSharedConsequenceOutboxMessages,
  ensureConsequenceSharedHistoryOutboxStore,
  publishSharedConsequenceOutboxMessage,
  resetConsequenceSharedHistoryOutboxStoreForTests,
  type AppendSharedConsequenceHistoryInput,
} from '../src/service/consequence-shared-history-outbox-store.js';
import {
  ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV,
  withReleaseAuthorityTransaction,
} from '../src/service/release/release-authority-store.js';

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

function historyInput(input: {
  readonly tenantId: string;
  readonly sourceKind: AppendSharedConsequenceHistoryInput['sourceKind'];
  readonly source: string;
  readonly payload: string;
  readonly occurredAt: string;
}): AppendSharedConsequenceHistoryInput {
  return {
    tenantId: input.tenantId,
    environment: 'production',
    sourceKind: input.sourceKind,
    sourceKeyDigest: digest(`source-key:${input.source}`),
    sourceDigest: digest(`source:${input.source}`),
    payloadDigest: digest(`payload:${input.payload}`),
    payloadSchema: 'attestor.test.digest-only-source.v1',
    occurredAt: input.occurredAt,
    recordedAt: input.occurredAt,
    artifactRefs: [
      {
        kind: 'source-fixture',
        digest: digest(`artifact:${input.source}`),
      },
    ],
  };
}

async function testSummaryShape(): Promise<void> {
  const summary = await ensureConsequenceSharedHistoryOutboxStore();
  equal(
    summary.version,
    CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION,
    'Consequence shared history outbox: summary exposes version',
  );
  equal(
    summary.rawPayloadStored,
    false,
    'Consequence shared history outbox: summary is raw-payload-free',
  );
  equal(
    summary.rawTenantIdStored,
    false,
    'Consequence shared history outbox: summary does not store raw tenant ids',
  );
  equal(
    summary.rlsForced,
    true,
    'Consequence shared history outbox: summary declares FORCE RLS schema posture',
  );
  equal(
    summary.debeziumConnectorWired,
    false,
    'Consequence shared history outbox: summary does not claim Debezium delivery',
  );
  ok(
    summary.operationalEvidence.some((evidence) =>
      evidence.component === 'shadow-admission-events'
    ),
    'Consequence shared history outbox: shadow event evidence is exposed',
  );
  ok(
    summary.operationalEvidence.some((evidence) =>
      evidence.component === 'audit-evidence-export' &&
      /^sha256:[a-f0-9]{64}$/u.test(evidence.workerClaimQueryDigest)
    ),
    'Consequence shared history outbox: read-model worker claim proof is exposed',
  );
  ok(
    summary.operationalEvidence.every((evidence) =>
      /^sha256:[a-f0-9]{64}$/u.test(evidence.schemaDigest) &&
      /^sha256:[a-f0-9]{64}$/u.test(evidence.tenantScopeDigest) &&
      /^sha256:[a-f0-9]{64}$/u.test(evidence.outboxContractDigest) &&
      /^sha256:[a-f0-9]{64}$/u.test(evidence.advisoryLockKeyspaceDigest) &&
      evidence.rawPayloadStored === false &&
      evidence.rawTenantIdStored === false &&
      evidence.exposesConnectionStrings === false
    ),
    'Consequence shared history outbox: operational evidence uses digest-shaped proofs',
  );
  await withReleaseAuthorityTransaction(async (client) => {
    const rlsState = await client.query(
      `SELECT bool_and(relforcerowsecurity) AS forced
         FROM pg_class
        WHERE oid IN ($1::regclass, $2::regclass)`,
      [
        CONSEQUENCE_SHARED_HISTORY_TABLE,
        CONSEQUENCE_SHARED_OUTBOX_TABLE,
      ],
    );
    equal(
      rlsState.rows[0]?.forced,
      true,
      'Consequence shared history outbox: PostgreSQL catalogs mark both tables FORCE RLS',
    );
  });
}

async function testAppendOnlyHistoryAndConflicts(): Promise<void> {
  const tenant = 'tenant_history_demo';
  const first = await appendSharedConsequenceHistory(historyInput({
    tenantId: tenant,
    sourceKind: 'shadow-admission-event',
    source: 'shadow-refund-1',
    payload: 'refund-payload-1',
    occurredAt: '2026-05-16T11:00:00.000Z',
  }));
  equal(
    first.outcome,
    'recorded',
    'Consequence shared history outbox: first source event is recorded',
  );
  equal(
    first.record?.sequence,
    1,
    'Consequence shared history outbox: first tenant sequence starts at one',
  );
  equal(
    first.outboxMessage?.status,
    'pending',
    'Consequence shared history outbox: append creates pending outbox message',
  );

  const duplicate = await appendSharedConsequenceHistory(historyInput({
    tenantId: tenant,
    sourceKind: 'shadow-admission-event',
    source: 'shadow-refund-1',
    payload: 'refund-payload-1',
    occurredAt: '2026-05-16T11:00:00.000Z',
  }));
  equal(
    duplicate.outcome,
    'duplicate',
    'Consequence shared history outbox: same source digest reports duplicate',
  );
  equal(
    duplicate.record?.historyId,
    first.record?.historyId,
    'Consequence shared history outbox: duplicate returns the existing record',
  );

  const conflictInput = historyInput({
    tenantId: tenant,
    sourceKind: 'shadow-admission-event',
    source: 'shadow-refund-1',
    payload: 'refund-payload-conflict',
    occurredAt: '2026-05-16T11:00:01.000Z',
  });
  const conflict = await appendSharedConsequenceHistory({
    ...conflictInput,
    sourceDigest: digest('source:shadow-refund-1:changed'),
  });
  equal(
    conflict.outcome,
    'source-conflict',
    'Consequence shared history outbox: same source key with different digest conflicts',
  );
  equal(
    conflict.record,
    null,
    'Consequence shared history outbox: source conflict does not expose a replacement record',
  );

  const second = await appendSharedConsequenceHistory(historyInput({
    tenantId: tenant,
    sourceKind: 'audit-evidence-export',
    source: 'audit-export-1',
    payload: 'audit-export-payload',
    occurredAt: '2026-05-16T11:01:00.000Z',
  }));
  equal(
    second.record?.sequence,
    2,
    'Consequence shared history outbox: second tenant record advances sequence',
  );

  const otherTenant = await appendSharedConsequenceHistory(historyInput({
    tenantId: 'tenant_history_other',
    sourceKind: 'business-risk-dashboard',
    source: 'dashboard-1',
    payload: 'dashboard-payload',
    occurredAt: '2026-05-16T11:02:00.000Z',
  }));
  equal(
    otherTenant.record?.sequence,
    1,
    'Consequence shared history outbox: sequences are tenant scoped',
  );

  await withReleaseAuthorityTransaction(async (client) => {
    const historyRows = await client.query(
      `SELECT record_json::text AS record_text
         FROM ${CONSEQUENCE_SHARED_HISTORY_TABLE}`,
    );
    const outboxRows = await client.query(
      `SELECT event_json::text AS event_text
         FROM ${CONSEQUENCE_SHARED_OUTBOX_TABLE}`,
    );
    equal(
      historyRows.rows.length,
      3,
      'Consequence shared history outbox: duplicate and conflict do not append extra rows',
    );
    const combinedText = JSON.stringify([historyRows.rows, outboxRows.rows]);
    equal(
      combinedText.includes(tenant),
      false,
      'Consequence shared history outbox: stored history does not include raw tenant ids',
    );
    equal(
      combinedText.includes('refund-payload-1'),
      false,
      'Consequence shared history outbox: stored history does not include raw payload labels',
    );
  });
}

async function testWorkerClaimAndPublish(): Promise<void> {
  const [left, right] = await Promise.all([
    claimSharedConsequenceOutboxMessages({
      tenantId: 'tenant_history_demo',
      environment: 'production',
      workerId: 'worker-alpha',
      limit: 1,
      leaseSeconds: 60,
      now: '2026-05-16T11:05:00.000Z',
    }),
    claimSharedConsequenceOutboxMessages({
      tenantId: 'tenant_history_demo',
      environment: 'production',
      workerId: 'worker-beta',
      limit: 1,
      leaseSeconds: 60,
      now: '2026-05-16T11:05:00.000Z',
    }),
  ]);
  const claimed = [...left, ...right];
  equal(
    claimed.length,
    2,
    'Consequence shared history outbox: two workers claim two tenant messages',
  );
  equal(
    new Set(claimed.map((message) => message.outboxId)).size,
    2,
    'Consequence shared history outbox: SKIP LOCKED claim does not duplicate messages',
  );
  ok(
    claimed.every((message) => message.status === 'claimed' && message.claimToken !== null),
    'Consequence shared history outbox: claimed messages carry lease tokens',
  );

  const publish = await publishSharedConsequenceOutboxMessage({
    tenantId: 'tenant_history_demo',
    environment: 'production',
    outboxId: claimed[0]!.outboxId,
    claimToken: claimed[0]!.claimToken!,
    publishedAt: '2026-05-16T11:05:30.000Z',
  });
  equal(
    publish.outcome,
    'published',
    'Consequence shared history outbox: claimed message can be marked published',
  );
  equal(
    publish.message?.status,
    'published',
    'Consequence shared history outbox: published message returns published status',
  );

  await withReleaseAuthorityTransaction(async (client) => {
    const rows = await client.query(
      `SELECT event_json::text AS event_text,
              COALESCE(claim_worker_digest, '') AS worker_digest
         FROM ${CONSEQUENCE_SHARED_OUTBOX_TABLE}`,
    );
    const tableText = JSON.stringify(rows.rows);
    equal(
      tableText.includes('worker-alpha'),
      false,
      'Consequence shared history outbox: outbox table does not store raw worker id',
    );
    equal(
      tableText.includes('tenant_history_demo'),
      false,
      'Consequence shared history outbox: outbox table does not store raw tenant id',
    );
  });
}

async function testFinalSummary(pgPort: number): Promise<void> {
  const summary = await ensureConsequenceSharedHistoryOutboxStore();
  equal(
    summary.historyRecords,
    3,
    'Consequence shared history outbox: summary counts history rows',
  );
  equal(
    summary.outboxMessages,
    3,
    'Consequence shared history outbox: summary counts outbox rows',
  );
  equal(
    summary.pendingOutboxMessages,
    1,
    'Consequence shared history outbox: other tenant pending message remains pending',
  );
  equal(
    summary.claimedOutboxMessages,
    1,
    'Consequence shared history outbox: summary counts one still-claimed message',
  );
  equal(
    summary.publishedOutboxMessages,
    1,
    'Consequence shared history outbox: summary counts one published message',
  );
  equal(
    JSON.stringify(summary).includes(`localhost:${pgPort}`),
    false,
    'Consequence shared history outbox: summary does not expose database URL or host',
  );
}

async function run(): Promise<void> {
  const previousAuthorityUrl = process.env[ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV];
  const tempRoot = mkdtempSync(join(tmpdir(), 'attestor-consequence-history-outbox-'));
  const pgPort = await reservePort();
  const pg = new EmbeddedPostgres({
    databaseDir: join(tempRoot, 'pg'),
    user: 'consequence_history_outbox',
    password: 'consequence_history_outbox',
    port: pgPort,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('attestor_release_authority');
    process.env[ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV] =
      `postgres://consequence_history_outbox:consequence_history_outbox@localhost:${pgPort}/attestor_release_authority`;

    await testSummaryShape();
    await testAppendOnlyHistoryAndConflicts();
    await testWorkerClaimAndPublish();
    await testFinalSummary(pgPort);
  } finally {
    await resetConsequenceSharedHistoryOutboxStoreForTests();
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

  console.log(`Consequence shared history outbox tests: ${passed} passed, 0 failed`);
}

run().catch((error) => {
  console.error('Consequence shared history outbox tests failed:', error);
  process.exit(1);
});
