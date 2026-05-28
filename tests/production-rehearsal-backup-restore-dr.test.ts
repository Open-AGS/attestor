import assert from 'node:assert/strict';
import EmbeddedPostgres from 'embedded-postgres';
import IORedis from 'ioredis';
import { RedisMemoryServer } from 'redis-memory-server';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer } from 'node:net';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  rehearseProductionBackupRestoreDr,
  type ProductionBackupRestoreDrSummary,
} from '../scripts/rehearse/rehearse-production-backup-restore-dr.ts';
import {
  claimStripeBillingEvent,
  finalizeStripeBillingEvent,
  resetBillingEventLedgerForTests,
  upsertStripeCharges,
  upsertStripeInvoiceLineItems,
} from '../src/service/billing/billing-event-ledger.js';
import {
  appendAdminAuditRecordState,
  consumePipelineRunState,
  createAccountUserState,
  issueAccountSessionState,
  provisionHostedAccountState,
  recordAdminIdempotencyState,
  recordProcessedStripeWebhookState,
  resetSharedControlPlaneStoreForTests,
  upsertAsyncDeadLetterRecordState,
  upsertHostedBillingEntitlementState,
} from '../src/service/control-plane-store.js';
import {
  closeReleaseAuthorityStorePoolForTests,
  ensureReleaseAuthorityStore,
  recordReleaseAuthorityComponentState,
  RELEASE_AUTHORITY_COMPONENTS,
  resetReleaseAuthorityStoreForTests,
} from '../src/service/release-authority-store.js';

let passed = 0;

type Env = Record<string, string | undefined>;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(resolve(process.cwd(), ...segments), 'utf8');
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readProjectFile(...segments)) as T;
}

async function reservePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve TCP port.'));
        return;
      }
      const { port } = address;
      server.close((err) => err ? reject(err) : resolvePort(port));
    });
  });
}

function passedSubstrateSummary() {
  return {
    profileId: 'gke-production-rehearsal',
    readiness: {
      passed: true,
      state: 'ready-for-rehearsal',
      issues: [],
    },
    target: {
      provider: 'gke',
      namespace: 'attestor',
      publicHostname: 'attestor.example.invalid',
    },
  };
}

function passedConsequenceSummary() {
  return {
    profileId: 'gke-production-rehearsal',
    readiness: {
      passed: true,
      state: 'passed-core-consequence-rehearsal',
      issues: [],
    },
  };
}

function passedAsyncSummary() {
  return {
    profileId: 'gke-production-rehearsal',
    readiness: {
      passed: true,
      state: 'passed-async-recovery-rehearsal',
      issues: [],
    },
  };
}

function failedAsyncSummary() {
  return {
    ...passedAsyncSummary(),
    readiness: {
      passed: false,
      state: 'failed-async-recovery-rehearsal',
      issues: ['async recovery failed'],
    },
  };
}

function pitrEvidence(path: string): string {
  writeFileSync(path, `${JSON.stringify({
    schemaVersion: 'attestor.postgres-pitr-drill.v1',
    generatedAt: '2026-04-28T00:00:00.000Z',
    status: 'passed',
    source: {
      baseBackupId: 'basebackup-20260428T000000Z',
      walArchiveRef: 'gs://attestor-dr/wal/gke-production-rehearsal',
      sourcePgRef: 'external-secret:ATTESTOR_CONTROL_PLANE_PG_URL',
    },
    restore: {
      replacementTarget: 'gke-production-rehearsal-dr-replacement',
      recoveredTo: '2026-04-28T00:05:00.000Z',
      restoredAt: '2026-04-28T00:07:00.000Z',
      validatedAt: '2026-04-28T00:09:00.000Z',
      validationQueries: [
        'SELECT COUNT(*) FROM attestor_control_plane.hosted_accounts',
        'SELECT COUNT(*) FROM attestor_release_authority.shared_store_components',
      ],
    },
    operator: 'production-rehearsal-test',
  }, null, 2)}\n`, 'utf8');
  return path;
}

async function configureRedis(redisUrl: string): Promise<void> {
  const redis = new IORedis(redisUrl);
  try {
    await redis.config('SET', 'appendonly', 'yes');
    await redis.config('SET', 'appendfsync', 'everysec');
    await redis.config('SET', 'maxmemory-policy', 'noeviction');
    await redis.set('dr-rehearsal-canary', 'present');
  } finally {
    await redis.quit();
  }
}

async function withReadyServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createHttpServer((req, res) => {
    if (req.url === '/ready') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"status":"ready"}');
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  const port = await reservePort();
  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolveReady());
  });
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolveClose) => (server as Server).close(() => resolveClose()));
  }
}

async function seedSourceControlPlane(env: Env): Promise<void> {
  process.env.ATTESTOR_CONTROL_PLANE_PG_URL = env.ATTESTOR_CONTROL_PLANE_PG_URL;
  process.env.ATTESTOR_BILLING_LEDGER_PG_URL = env.ATTESTOR_BILLING_LEDGER_PG_URL;
  process.env.ATTESTOR_ADMIN_API_KEY = 'dr-test-admin';
  await resetSharedControlPlaneStoreForTests();
  await resetBillingEventLedgerForTests();

  const provisioned = await provisionHostedAccountState({
    account: {
      accountName: 'DR Rehearsal Co',
      contactEmail: 'ops@dr-rehearsal.example',
      primaryTenantId: 'tenant-dr-rehearsal',
    },
    key: {
      tenantId: 'tenant-dr-rehearsal',
      tenantName: 'DR Rehearsal Tenant',
      planId: 'starter',
    },
  });
  const user = await createAccountUserState({
    accountId: provisioned.account.id,
    email: 'owner@dr-rehearsal.example',
    displayName: 'DR Owner',
    password: 'DrOwnerPass123!',
    role: 'account_admin',
  });
  await issueAccountSessionState({
    accountId: provisioned.account.id,
    accountUserId: user.record.id,
    role: user.record.role,
  });
  await upsertHostedBillingEntitlementState({
    account: provisioned.account,
    currentPlanId: 'starter',
    currentMonthlyRunQuota: 100,
    stripeEntitlementLookupKeys: ['attestor.starter.api'],
    stripeEntitlementFeatureIds: ['feat_starter_api'],
    stripeEntitlementSummaryUpdatedAt: '2026-04-28T00:00:00.000Z',
    lastEventId: 'evt_dr_entitlement_1',
    lastEventType: 'manual.provisioning',
    lastEventAt: '2026-04-28T00:00:00.000Z',
  });
  await consumePipelineRunState('tenant-dr-rehearsal', 'starter', 100);
  await appendAdminAuditRecordState({
    actorType: 'admin_api_key',
    actorLabel: 'dr-test-admin',
    action: 'account.created',
    routeId: 'admin.accounts.create',
    accountId: provisioned.account.id,
    tenantId: 'tenant-dr-rehearsal',
    tenantKeyId: provisioned.initialKey.id,
    planId: 'starter',
    monthlyRunQuota: 100,
    idempotencyKey: 'idem-dr-1',
    requestHash: 'req_hash_dr',
    metadata: { source: 'production-rehearsal-step-08' },
  });
  await recordAdminIdempotencyState({
    idempotencyKey: 'idem-dr-1',
    routeId: 'admin.accounts.create',
    requestPayload: { accountId: provisioned.account.id },
    statusCode: 201,
    response: { ok: true, accountId: provisioned.account.id },
  });
  await recordProcessedStripeWebhookState({
    eventId: 'evt_dr_webhook_1',
    eventType: 'invoice.paid',
    accountId: provisioned.account.id,
    stripeCustomerId: 'cus_dr',
    stripeSubscriptionId: 'sub_dr',
    outcome: 'applied',
    reason: null,
    rawPayload: '{"id":"evt_dr_webhook_1"}',
  });
  await upsertAsyncDeadLetterRecordState({
    jobId: 'job_dr_dlq_1',
    name: 'pipeline-run',
    backendMode: 'bullmq',
    tenantId: 'tenant-dr-rehearsal',
    planId: 'starter',
    state: 'failed',
    failedReason: 'synthetic DR rehearsal failure',
    attemptsMade: 3,
    maxAttempts: 3,
    requestedAt: '2026-04-28T00:00:00.000Z',
    submittedAt: '2026-04-28T00:00:01.000Z',
    processedAt: '2026-04-28T00:00:02.000Z',
    failedAt: '2026-04-28T00:00:03.000Z',
    recordedAt: '2026-04-28T00:00:03.000Z',
  });
  const claim = await claimStripeBillingEvent({
    providerEventId: 'evt_dr_billing_1',
    eventType: 'invoice.paid',
    rawPayload: '{"id":"evt_dr_billing_1"}',
  });
  ok(claim.kind === 'claimed', 'Production backup/restore/DR: billing event claim seeded');
  await finalizeStripeBillingEvent({
    providerEventId: 'evt_dr_billing_1',
    outcome: 'applied',
    accountId: provisioned.account.id,
    tenantId: 'tenant-dr-rehearsal',
    stripeCustomerId: 'cus_dr',
    stripeSubscriptionId: 'sub_dr',
    stripePriceId: 'price_starter_monthly',
    stripeInvoiceId: 'in_dr_1',
    stripeInvoiceStatus: 'paid',
    stripeInvoiceCurrency: 'usd',
    stripeInvoiceAmountPaid: 5000,
    stripeInvoiceAmountDue: 0,
    accountStatusBefore: 'active',
    accountStatusAfter: 'active',
    billingStatusBefore: 'active',
    billingStatusAfter: 'active',
    mappedPlanId: 'starter',
    metadata: { paidAt: '2026-04-28T00:00:00.000Z' },
  });
  await upsertStripeInvoiceLineItems({
    accountId: provisioned.account.id,
    tenantId: 'tenant-dr-rehearsal',
    stripeCustomerId: 'cus_dr',
    stripeSubscriptionId: 'sub_dr',
    stripeInvoiceId: 'in_dr_1',
    source: 'stripe_webhook',
    captureMode: 'full',
    replaceExisting: true,
    lineItems: [{
      stripeInvoiceLineItemId: 'il_dr_1',
      stripePriceId: 'price_starter_monthly',
      description: 'Attestor Starter Monthly',
      currency: 'usd',
      amount: 5000,
      subtotal: 5000,
      quantity: 1,
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-05-01T00:00:00.000Z',
      proration: false,
    }],
  });
  await upsertStripeCharges({
    accountId: provisioned.account.id,
    tenantId: 'tenant-dr-rehearsal',
    stripeCustomerId: 'cus_dr',
    stripeSubscriptionId: 'sub_dr',
    source: 'stripe_webhook',
    charges: [{
      stripeChargeId: 'ch_dr_1',
      stripeInvoiceId: 'in_dr_1',
      stripePaymentIntentId: 'pi_dr_1',
      amount: 5000,
      amountRefunded: 0,
      currency: 'usd',
      status: 'succeeded',
      paid: true,
      refunded: false,
      failureCode: null,
      failureMessage: null,
      metadata: { source: 'dr-rehearsal-test' },
      createdAt: '2026-04-28T00:00:00.000Z',
    }],
  });
}

async function seedReleaseAuthority(url: string): Promise<void> {
  process.env.ATTESTOR_RELEASE_AUTHORITY_PG_URL = url;
  await resetReleaseAuthorityStoreForTests();
  await closeReleaseAuthorityStorePoolForTests();
  await ensureReleaseAuthorityStore();
  for (const component of RELEASE_AUTHORITY_COMPONENTS) {
    await recordReleaseAuthorityComponentState({
      component,
      status: 'ready',
      metadata: { seededBy: 'production-rehearsal-backup-restore-dr-test' },
    });
  }
  await closeReleaseAuthorityStorePoolForTests();
}

async function withRedis<T>(run: (sourceRedisUrl: string, replacementRedisUrl: string) => Promise<T>): Promise<T> {
  const sourceDir = mkdtempSync(resolve(tmpdir(), 'attestor-dr-source-redis-'));
  const replacementDir = mkdtempSync(resolve(tmpdir(), 'attestor-dr-replacement-redis-'));
  const source = new RedisMemoryServer({ instance: { args: ['--dir', sourceDir] } });
  const replacement = new RedisMemoryServer({ instance: { args: ['--dir', replacementDir] } });
  const sourceUrl = `redis://${await source.getHost()}:${await source.getPort()}`;
  const replacementUrl = `redis://${await replacement.getHost()}:${await replacement.getPort()}`;
  try {
    await configureRedis(sourceUrl);
    await configureRedis(replacementUrl);
    return await run(sourceUrl, replacementUrl);
  } finally {
    try { await source.stop(); } catch {}
    try { await replacement.stop(); } catch {}
    rmSync(sourceDir, { recursive: true, force: true });
    rmSync(replacementDir, { recursive: true, force: true });
  }
}

async function withPostgres<T>(run: (urls: {
  sourceControl: string;
  sourceBilling: string;
  sourceRelease: string;
  replacementControl: string;
  replacementBilling: string;
  replacementRelease: string;
}) => Promise<T>): Promise<T> {
  const tempRoot = mkdtempSync(join(process.cwd(), '.attestor', 'production-dr-pg-'));
  const pgPort = await reservePort();
  const pg = new EmbeddedPostgres({
    databaseDir: join(tempRoot, 'pg'),
    user: 'dr_rehearsal',
    password: 'dr_rehearsal',
    port: pgPort,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });
  const dbs = [
    'source_control',
    'source_billing',
    'source_release',
    'replacement_control',
    'replacement_billing',
    'replacement_release',
  ];
  try {
    await pg.initialise();
    await pg.start();
    for (const db of dbs) {
      await pg.createDatabase(db);
    }
    const url = (db: string) => `postgres://dr_rehearsal:dr_rehearsal@localhost:${pgPort}/${db}`;
    return await run({
      sourceControl: url('source_control'),
      sourceBilling: url('source_billing'),
      sourceRelease: url('source_release'),
      replacementControl: url('replacement_control'),
      replacementBilling: url('replacement_billing'),
      replacementRelease: url('replacement_release'),
    });
  } finally {
    try { await resetSharedControlPlaneStoreForTests(); } catch {}
    try { await resetBillingEventLedgerForTests(); } catch {}
    try { await resetReleaseAuthorityStoreForTests(); } catch {}
    try { await pg.stop(); } catch {}
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function baseEnv(input: {
  sourceControl: string;
  sourceBilling: string;
  sourceRelease: string;
  replacementControl: string;
  replacementBilling: string;
  replacementRelease: string;
  sourceRedis: string;
  replacementRedis: string;
  readyBaseUrl: string;
  pitrPath: string;
}): Env {
  return {
    ATTESTOR_RUNTIME_PROFILE: 'production-shared',
    ATTESTOR_CONTROL_PLANE_PG_URL: input.sourceControl,
    ATTESTOR_BILLING_LEDGER_PG_URL: input.sourceBilling,
    ATTESTOR_RELEASE_AUTHORITY_PG_URL: input.sourceRelease,
    REDIS_URL: input.sourceRedis,
    ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL: input.replacementControl,
    ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL: input.replacementBilling,
    ATTESTOR_DR_REPLACEMENT_RELEASE_AUTHORITY_PG_URL: input.replacementRelease,
    ATTESTOR_DR_REPLACEMENT_REDIS_URL: input.replacementRedis,
    ATTESTOR_DR_REPLACEMENT_API_READY_URL: `${input.readyBaseUrl}/ready`,
    ATTESTOR_DR_REPLACEMENT_WORKER_READY_URL: `${input.readyBaseUrl}/ready`,
    ATTESTOR_DR_PITR_EVIDENCE_PATH: input.pitrPath,
    ATTESTOR_ADMIN_API_KEY: 'dr-test-admin',
  };
}

async function testBackupRestoreDrPassesAndWritesArtifacts(): Promise<void> {
  mkdirSync('.attestor', { recursive: true });
  await withPostgres(async (urls) => {
    await withRedis(async (sourceRedis, replacementRedis) => {
      await withReadyServer(async (readyBaseUrl) => {
        const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-backup-restore-dr-'));
        const pitrPath = pitrEvidence(resolve(outputDir, 'postgres-pitr-evidence.json'));
        const env = baseEnv({
          ...urls,
          sourceRedis,
          replacementRedis,
          readyBaseUrl,
          pitrPath,
        });
        try {
          await seedSourceControlPlane(env);
          await seedReleaseAuthority(urls.sourceRelease);
          await seedReleaseAuthority(urls.replacementRelease);

          const summary = await rehearseProductionBackupRestoreDr({
            env,
            substrateSummary: passedSubstrateSummary(),
            consequenceSummary: passedConsequenceSummary(),
            asyncSummary: passedAsyncSummary(),
            outputDir,
          });

          if (!summary.readiness.passed) {
            console.error(JSON.stringify(summary.readiness, null, 2));
          }
          equal(summary.readiness.passed, true, 'Production backup/restore/DR: full rehearsal passes');
          equal(summary.readiness.state, 'passed-backup-restore-dr-rehearsal', 'Production backup/restore/DR: pass state is explicit');
          ok(summary.checks.every((check) => check.status === 'pass'), 'Production backup/restore/DR: every check passes');
          ok(summary.behavior !== null, 'Production backup/restore/DR: behavior summary is recorded');
          ok((summary.behavior?.controlPlaneBackup.presentComponents ?? 0) >= 10, 'Production backup/restore/DR: backup captured control-plane components');
          ok((summary.behavior?.controlPlaneRestore.restoredComponentCount ?? 0) >= 10, 'Production backup/restore/DR: restore restored control-plane components');
          equal(summary.behavior?.redisDurability.source.appendonly, 'yes', 'Production backup/restore/DR: source Redis AOF is recorded');
          equal(summary.behavior?.redisDurability.replacement.appendonly, 'yes', 'Production backup/restore/DR: replacement Redis AOF is recorded');
          equal(summary.behavior?.postRestore.apiReadyStatus, 200, 'Production backup/restore/DR: replacement API readiness is checked');
          equal(summary.behavior?.postRestore.workerReadyStatus, 200, 'Production backup/restore/DR: replacement worker readiness is checked');
          equal(summary.behavior?.postRestore.admissionAllowed, true, 'Production backup/restore/DR: post-restore admitted probe allows');
          equal(summary.behavior?.postRestore.blockedFailClosed, true, 'Production backup/restore/DR: post-restore blocked probe fails closed');
          ok(existsSync(resolve(outputDir, 'summary.json')), 'Production backup/restore/DR: summary artifact is written');
          ok(existsSync(resolve(outputDir, 'README.md')), 'Production backup/restore/DR: README artifact is written');
          ok(existsSync(resolve(outputDir, 'control-plane-backup', 'manifest.json')), 'Production backup/restore/DR: backup manifest is written');
          includes(readFileSync(resolve(outputDir, 'README.md'), 'utf8'), 'passed-backup-restore-dr-rehearsal', 'Production backup/restore/DR: README records pass state');
        } finally {
          rmSync(outputDir, { recursive: true, force: true });
        }
      });
    });
  });
}

async function testMissingReplacementBlocksBeforeCoreBehavior(): Promise<void> {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-backup-restore-dr-blocked-'));
  try {
    const summary = await rehearseProductionBackupRestoreDr({
      env: {
        ATTESTOR_RUNTIME_PROFILE: 'production-shared',
        ATTESTOR_CONTROL_PLANE_PG_URL: 'postgres://source/control',
        ATTESTOR_BILLING_LEDGER_PG_URL: 'postgres://source/billing',
        ATTESTOR_RELEASE_AUTHORITY_PG_URL: 'postgres://source/release',
        REDIS_URL: 'redis://source:6379',
        ATTESTOR_DR_PITR_EVIDENCE_PATH: pitrEvidence(resolve(outputDir, 'pitr.json')),
      },
      substrateSummary: passedSubstrateSummary(),
      consequenceSummary: passedConsequenceSummary(),
      asyncSummary: passedAsyncSummary(),
      outputDir,
    });

    equal(summary.readiness.passed, false, 'Production backup/restore/DR: missing replacement target blocks readiness');
    equal(summary.readiness.state, 'blocked-on-target-prerequisites', 'Production backup/restore/DR: missing replacement blocks before behavior');
    ok(summary.readiness.issues.some((issue) => issue.includes('ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL')), 'Production backup/restore/DR: missing replacement control-plane URL is surfaced');
    equal(summary.behavior, null, 'Production backup/restore/DR: behavior is not exercised when replacement target is missing');
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function testSameSourceAndReplacementBlocksBeforeRestore(): Promise<void> {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-backup-restore-dr-same-'));
  try {
    const sameControl = 'postgres://same/control';
    const summary = await rehearseProductionBackupRestoreDr({
      env: {
        ATTESTOR_RUNTIME_PROFILE: 'production-shared',
        ATTESTOR_CONTROL_PLANE_PG_URL: sameControl,
        ATTESTOR_BILLING_LEDGER_PG_URL: 'postgres://source/billing',
        ATTESTOR_RELEASE_AUTHORITY_PG_URL: 'postgres://source/release',
        REDIS_URL: 'redis://source:6379',
        ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL: sameControl,
        ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL: 'postgres://replacement/billing',
        ATTESTOR_DR_REPLACEMENT_RELEASE_AUTHORITY_PG_URL: 'postgres://replacement/release',
        ATTESTOR_DR_REPLACEMENT_REDIS_URL: 'redis://replacement:6379',
        ATTESTOR_DR_REPLACEMENT_API_READY_URL: 'http://127.0.0.1:1/ready',
        ATTESTOR_DR_REPLACEMENT_WORKER_READY_URL: 'http://127.0.0.1:1/ready',
        ATTESTOR_DR_PITR_EVIDENCE_PATH: pitrEvidence(resolve(outputDir, 'pitr.json')),
      },
      substrateSummary: passedSubstrateSummary(),
      consequenceSummary: passedConsequenceSummary(),
      asyncSummary: passedAsyncSummary(),
      outputDir,
    });

    equal(summary.readiness.passed, false, 'Production backup/restore/DR: same source/replacement blocks readiness');
    ok(summary.readiness.issues.some((issue) => issue.includes('replacement control-plane PostgreSQL URL must differ from source')), 'Production backup/restore/DR: same control-plane URL is surfaced');
    equal(summary.behavior, null, 'Production backup/restore/DR: same replacement target skips behavior');
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function testInvalidPitrEvidenceBlocksBeforeCoreBehavior(): Promise<void> {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-backup-restore-dr-pitr-'));
  try {
    const pitrPath = resolve(outputDir, 'pitr.json');
    writeFileSync(pitrPath, `${JSON.stringify({
      schemaVersion: 'attestor.postgres-pitr-drill.v1',
      generatedAt: '2026-04-28T00:00:00.000Z',
      status: 'pending',
      source: { baseBackupId: '', walArchiveRef: '', sourcePgRef: '' },
      restore: {
        replacementTarget: '',
        recoveredTo: '2026-04-28T00:00:00.000Z',
        restoredAt: 'not-a-date',
        validatedAt: 'not-a-date',
        validationQueries: [],
      },
      operator: 'test',
    })}\n`, 'utf8');
    const summary = await rehearseProductionBackupRestoreDr({
      env: {
        ATTESTOR_RUNTIME_PROFILE: 'production-shared',
        ATTESTOR_CONTROL_PLANE_PG_URL: 'postgres://source/control',
        ATTESTOR_BILLING_LEDGER_PG_URL: 'postgres://source/billing',
        ATTESTOR_RELEASE_AUTHORITY_PG_URL: 'postgres://source/release',
        REDIS_URL: 'redis://source:6379',
        ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL: 'postgres://replacement/control',
        ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL: 'postgres://replacement/billing',
        ATTESTOR_DR_REPLACEMENT_RELEASE_AUTHORITY_PG_URL: 'postgres://replacement/release',
        ATTESTOR_DR_REPLACEMENT_REDIS_URL: 'redis://replacement:6379',
        ATTESTOR_DR_REPLACEMENT_API_READY_URL: 'http://127.0.0.1:1/ready',
        ATTESTOR_DR_REPLACEMENT_WORKER_READY_URL: 'http://127.0.0.1:1/ready',
        ATTESTOR_DR_PITR_EVIDENCE_PATH: pitrPath,
      },
      substrateSummary: passedSubstrateSummary(),
      consequenceSummary: passedConsequenceSummary(),
      asyncSummary: passedAsyncSummary(),
      outputDir,
    });

    equal(summary.readiness.passed, false, 'Production backup/restore/DR: invalid PITR evidence blocks readiness');
    ok(summary.readiness.issues.some((issue) => issue.includes('postgres-pitr-evidence')), 'Production backup/restore/DR: PITR evidence issue is surfaced');
    equal(summary.behavior, null, 'Production backup/restore/DR: invalid PITR evidence skips behavior');
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function testFailedAsyncSummaryBlocksBeforeCoreBehavior(): Promise<void> {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-backup-restore-dr-async-'));
  try {
    const summary = await rehearseProductionBackupRestoreDr({
      env: {
        ATTESTOR_RUNTIME_PROFILE: 'production-shared',
        ATTESTOR_CONTROL_PLANE_PG_URL: 'postgres://source/control',
        ATTESTOR_BILLING_LEDGER_PG_URL: 'postgres://source/billing',
        ATTESTOR_RELEASE_AUTHORITY_PG_URL: 'postgres://source/release',
        REDIS_URL: 'redis://source:6379',
        ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL: 'postgres://replacement/control',
        ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL: 'postgres://replacement/billing',
        ATTESTOR_DR_REPLACEMENT_RELEASE_AUTHORITY_PG_URL: 'postgres://replacement/release',
        ATTESTOR_DR_REPLACEMENT_REDIS_URL: 'redis://replacement:6379',
        ATTESTOR_DR_REPLACEMENT_API_READY_URL: 'http://127.0.0.1:1/ready',
        ATTESTOR_DR_REPLACEMENT_WORKER_READY_URL: 'http://127.0.0.1:1/ready',
        ATTESTOR_DR_PITR_EVIDENCE_PATH: pitrEvidence(resolve(outputDir, 'pitr.json')),
      },
      substrateSummary: passedSubstrateSummary(),
      consequenceSummary: passedConsequenceSummary(),
      asyncSummary: failedAsyncSummary(),
      outputDir,
    });

    equal(summary.readiness.passed, false, 'Production backup/restore/DR: failed Step 07 blocks readiness');
    ok(summary.readiness.issues.some((issue) => issue.includes('failed-async-recovery-rehearsal')), 'Production backup/restore/DR: failed Step 07 state is surfaced');
    equal(summary.behavior, null, 'Production backup/restore/DR: behavior is skipped when Step 07 failed');
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

function testDocsAndPackageWireTheRehearsal(): void {
  const packageJson = readJson<{ scripts: Record<string, string> }>('package.json');
  const tracker = readProjectFile('docs', '02-architecture', 'production-rehearsal-buildout.md');
  const manifest = readProjectFile('docs', '08-deployment', 'production-rehearsal-manifest.example.json');
  const manifestDoc = readProjectFile('docs', '08-deployment', 'production-rehearsal-manifest.md');

  equal(packageJson.scripts['rehearse:production-backup-restore-dr'], 'tsx scripts/rehearse/rehearse-production-backup-restore-dr.ts', 'Production backup/restore/DR: package exposes the rehearsal command');
  equal(packageJson.scripts['test:production-rehearsal-backup-restore-dr'], 'tsx tests/production-rehearsal-backup-restore-dr.test.ts', 'Production backup/restore/DR: package exposes the rehearsal test');
  includes(tracker, '| Completed | 10 |', 'Production backup/restore/DR: tracker now reflects Step 10 completion after Step 08');
  includes(tracker, '| Not started | 0 |', 'Production backup/restore/DR: tracker leaves no frozen steps pending after Step 10');
  includes(tracker, '| 08 | complete | Rehearse backup, restore, and DR |', 'Production backup/restore/DR: Step 08 is complete without renumbering');
  includes(tracker, 'The production rehearsal buildout is complete at the repository level.', 'Production backup/restore/DR: immediate next step now advances beyond Step 10');
  includes(manifest, 'npm run rehearse:production-backup-restore-dr', 'Production backup/restore/DR: manifest command plan includes the rehearsal command');
  includes(manifest, 'production-rehearsal-backup-restore-dr', 'Production backup/restore/DR: manifest evidence includes the backup/restore/DR summary');
  includes(manifestDoc, 'Backup / Restore / DR Rehearsal', 'Production backup/restore/DR: manifest docs explain the Step 08 rehearsal');
}

await testBackupRestoreDrPassesAndWritesArtifacts();
await testMissingReplacementBlocksBeforeCoreBehavior();
await testSameSourceAndReplacementBlocksBeforeRestore();
await testInvalidPitrEvidenceBlocksBeforeCoreBehavior();
await testFailedAsyncSummaryBlocksBeforeCoreBehavior();
testDocsAndPackageWireTheRehearsal();

console.log(`production-rehearsal-backup-restore-dr.test.ts: ${passed} assertions passed`);
