import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import {
  ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV,
  withReleaseAuthorityTransaction,
} from '../src/service/release/release-authority-store.js';
import {
  HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_TABLE,
  createRuntimeHostedGenericAdmissionDpopProofReplayStore,
  createSharedHostedGenericAdmissionDpopProofReplayStore,
  ensureSharedHostedGenericAdmissionDpopProofReplayStore,
  resetSharedHostedGenericAdmissionDpopProofReplayStoreForTests,
} from '../src/service/hosted/hosted-generic-admission-dpop-proof-replay-store.js';

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

async function run(): Promise<void> {
  const previousAuthorityUrl = process.env[ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV];
  delete process.env[ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV];
  const localRuntimeStore = await createRuntimeHostedGenericAdmissionDpopProofReplayStore({
    runtimeProfileId: 'production-shared',
    sharedAuthorityRequestPathReady: false,
  });
  equal(
    localRuntimeStore.durability,
    'local',
    'Shared hosted DPoP proof replay: production-shared stays local when shared authority path is not ready',
  );

  const tempRoot = mkdtempSync(join(tmpdir(), 'attestor-hosted-dpop-proof-replay-'));
  const pgPort = await reservePort();
  const pg = new EmbeddedPostgres({
    databaseDir: join(tempRoot, 'pg'),
    user: 'hosted_dpop_replay',
    password: 'hosted_dpop_replay',
    port: pgPort,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('attestor_release_authority');
    process.env[ATTESTOR_RELEASE_AUTHORITY_PG_URL_ENV] =
      `postgres://hosted_dpop_replay:hosted_dpop_replay@localhost:${pgPort}/attestor_release_authority`;

    const runtimeStore = await createRuntimeHostedGenericAdmissionDpopProofReplayStore({
      runtimeProfileId: 'production-shared',
      sharedAuthorityRequestPathReady: true,
    });
    equal(
      runtimeStore.durability,
      'shared',
      'Shared hosted DPoP proof replay: production-shared selects shared store after shared authority cutover',
    );

    const bootSummary = await ensureSharedHostedGenericAdmissionDpopProofReplayStore();
    equal(
      bootSummary.totalRecords,
      0,
      'Shared hosted DPoP proof replay: boot summary starts empty',
    );
    equal(
      bootSummary.rawProofStored,
      false,
      'Shared hosted DPoP proof replay: summary records raw-proof-free storage',
    );

    const store = createSharedHostedGenericAdmissionDpopProofReplayStore();
    const first = await store.claimProofReplay({
      replayKey: 'dpop-proof:shared-first-jti',
      proofJti: 'shared-first-jti',
      checkedAt: '2026-05-16T09:00:00.000Z',
      expiresAt: '2026-05-16T09:02:30.000Z',
    });
    equal(
      first.accepted,
      true,
      'Shared hosted DPoP proof replay: first proof jti claim is accepted',
    );
    equal(
      first.rawProofStored,
      false,
      'Shared hosted DPoP proof replay: accepted claim does not store raw proof',
    );

    const replay = await store.claimProofReplay({
      replayKey: 'dpop-proof:shared-first-jti',
      proofJti: 'shared-first-jti',
      checkedAt: '2026-05-16T09:00:30.000Z',
      expiresAt: '2026-05-16T09:03:00.000Z',
    });
    equal(
      replay.accepted,
      false,
      'Shared hosted DPoP proof replay: repeated proof jti is rejected',
    );
    equal(
      replay.replayLedgerEntry?.key,
      'dpop-proof:shared-first-jti',
      'Shared hosted DPoP proof replay: replay response returns digest-safe ledger metadata',
    );

    const concurrentInput = {
      replayKey: 'dpop-proof:shared-concurrent-jti',
      proofJti: 'shared-concurrent-jti',
      checkedAt: '2026-05-16T09:01:00.000Z',
      expiresAt: '2026-05-16T09:03:30.000Z',
    };
    const [left, right] = await Promise.all([
      store.claimProofReplay(concurrentInput),
      store.claimProofReplay(concurrentInput),
    ]);
    equal(
      [left, right].filter((claim) => claim.accepted).length,
      1,
      'Shared hosted DPoP proof replay: concurrent claims consume a proof jti only once',
    );

    await store.claimProofReplay({
      replayKey: 'dpop-proof:shared-expiring-jti',
      proofJti: 'shared-expiring-jti',
      checkedAt: '2026-05-16T09:00:00.000Z',
      expiresAt: '2026-05-16T09:00:01.000Z',
    });
    const afterWindow = await store.claimProofReplay({
      replayKey: 'dpop-proof:shared-expiring-jti',
      proofJti: 'shared-expiring-jti',
      checkedAt: '2026-05-16T09:00:02.000Z',
      expiresAt: '2026-05-16T09:02:32.000Z',
    });
    equal(
      afterWindow.accepted,
      true,
      'Shared hosted DPoP proof replay: expired replay keys can be reclaimed after the acceptance window',
    );

    const summary = await store.summary();
    equal(
      summary.totalRecords,
      3,
      'Shared hosted DPoP proof replay: summary counts persisted replay keys after expiry cleanup',
    );

    await withReleaseAuthorityTransaction(async (client) => {
      const result = await client.query(
        `SELECT replay_key, proof_jti, record_json
           FROM ${HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_TABLE}
          WHERE replay_key = $1`,
        ['dpop-proof:shared-first-jti'],
      );
      const row = result.rows[0] as Record<string, unknown>;
      ok(
        !('proof_jwt' in row) && !('raw_proof' in row),
        'Shared hosted DPoP proof replay: table projection has no raw proof columns',
      );
      ok(
        !JSON.stringify(row.record_json).includes('proofJwt'),
        'Shared hosted DPoP proof replay: record JSON does not persist the raw proof JWT',
      );
    });
  } finally {
    await resetSharedHostedGenericAdmissionDpopProofReplayStoreForTests();
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

  console.log(`Shared hosted DPoP proof replay store tests: ${passed} passed, 0 failed`);
}

run().catch((error) => {
  console.error('Shared hosted DPoP proof replay store tests failed:', error);
  process.exit(1);
});
