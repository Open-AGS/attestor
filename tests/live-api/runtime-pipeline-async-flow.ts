import {
  BASE,
  COUNTERPARTY_FIXTURE,
  COUNTERPARTY_INTENT,
  COUNTERPARTY_REPORT,
  COUNTERPARTY_REPORT_CONTRACT,
  COUNTERPARTY_SQL,
  issueTenantApiKey,
  ok,
  readAsyncDeadLetterStoreSnapshot,
  waitForJobStatus,
} from './helpers.js';

export async function runRuntimePipelineAsyncFlow(): Promise<void> {
  console.log('\n  [POST /api/v1/pipeline/run-async — submit]');
  let asyncJobId: string;
  {
    const res = await fetch(`${BASE}/api/v1/pipeline/run-async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'runtime-pipeline-async-submit',
      },
      body: JSON.stringify({
        candidateSql: COUNTERPARTY_SQL,
        intent: COUNTERPARTY_INTENT,
        fixtures: [COUNTERPARTY_FIXTURE],
        generatedReport: COUNTERPARTY_REPORT,
        reportContract: COUNTERPARTY_REPORT_CONTRACT,
        sign: true,
      }),
    });
    ok(res.status === 202, 'Async: submit returns 202');
    const body = await res.json() as any;
    ok(body.jobId !== undefined, 'Async: jobId returned');
    ok(body.status === 'queued', 'Async: status=queued');
    ok(body.backendMode === 'in_process' || body.backendMode === 'bullmq', 'Async: backendMode truthful');
    ok(typeof body.asyncQueue?.tenantPendingJobs === 'number', 'Async: queue snapshot present');
    ok(typeof body.asyncQueue?.tenantActiveExecutions === 'number', 'Async: active execution snapshot present');
    ok(typeof body.asyncQueue?.tenantWeightedDispatchEnforced === 'boolean', 'Async: weighted dispatch enforcement surfaced');
    ok(typeof body.asyncQueue?.tenantWeightedDispatchWeight === 'number' || body.asyncQueue?.tenantWeightedDispatchWeight === null, 'Async: weighted dispatch weight surfaced');
    ok(body.asyncQueue?.retryPolicy?.attempts >= 1, 'Async: retry policy present');
    asyncJobId = body.jobId;
    console.log(`    jobId=${asyncJobId}, status=${body.status}, backend=${body.backendMode}`);
  }

  console.log('\n  [GET /api/v1/pipeline/status/:jobId — poll]');
  {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${BASE}/api/v1/pipeline/status/${asyncJobId}`);
    ok(res.status === 200, 'Async: status endpoint 200');
    const body = await res.json() as any;
    ok(body.status === 'completed', 'Async: job completed');
    ok(body.backendMode === 'in_process' || body.backendMode === 'bullmq', 'Async: status shows backendMode');
    ok(body.result !== null, 'Async: result present');
    ok(body.result.decision === 'pass', 'Async: decision=pass');
    ok(body.result.certificateId !== null, 'Async: certificate issued');
    ok(body.result.certificate !== null, 'Async: full cert in result');
    ok(body.result.trustChain !== null, 'Async: trust chain in result');
    ok(typeof body.attemptsMade === 'number', 'Async: attemptsMade returned');
    ok(typeof body.maxAttempts === 'number' && body.maxAttempts >= 1, 'Async: maxAttempts returned');
    ok(body.tenantContext?.tenantId === '__attestor_anonymous__', 'Async: tenant context returned in status');
    console.log(`    status=${body.status}, backend=${body.backendMode}, decision=${body.result.decision}, cert=${body.result.certificateId}`);
  }

  console.log('\n  [GET /api/v1/pipeline/status/nonexistent]');
  {
    const res = await fetch(`${BASE}/api/v1/pipeline/status/nonexistent`);
    ok(res.status === 404, 'Async: unknown job = 404');
    console.log('    unknown job rejected');
  }

  console.log('\n  [Async Queue Hardening — tenant cap + DLQ + retry]');
  {
    const queueTenant = issueTenantApiKey({
      tenantId: 'tenant-queue',
      tenantName: 'Queue Tenant',
      planId: 'trial',
    });
    const queueHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${queueTenant.apiKey}`,
    };

    const payload = JSON.stringify({
      candidateSql: COUNTERPARTY_SQL,
      intent: COUNTERPARTY_INTENT,
      fixtures: [COUNTERPARTY_FIXTURE],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
      sign: false,
    });
    const [queueAttemptA, queueAttemptB] = await Promise.all([
      fetch(`${BASE}/api/v1/pipeline/run-async`, {
        method: 'POST',
        headers: {
          ...queueHeaders,
          'Idempotency-Key': 'runtime-pipeline-queue-cap-a',
        },
        body: payload,
      }),
      fetch(`${BASE}/api/v1/pipeline/run-async`, {
        method: 'POST',
        headers: {
          ...queueHeaders,
          'Idempotency-Key': 'runtime-pipeline-queue-cap-b',
        },
        body: payload,
      }),
    ]);
    const queueBodies = [
      { status: queueAttemptA.status, body: await queueAttemptA.json() as any },
      { status: queueAttemptB.status, body: await queueAttemptB.json() as any },
    ];
    const acceptedQueueJob = queueBodies.find((entry) => entry.status === 202);
    const rejectedQueueJob = queueBodies.find((entry) => entry.status === 429);
    ok(Boolean(acceptedQueueJob), 'Async Queue: one starter job accepted');
    ok(Boolean(rejectedQueueJob), 'Async Queue: one starter job rejected at pending cap');
    ok(acceptedQueueJob!.body.asyncQueue.tenantIsolationEnforced === true, 'Async Queue: starter tenant isolation enforced');
    ok(acceptedQueueJob!.body.asyncQueue.tenantPendingLimit === 1, 'Async Queue: starter tenant pending cap = 1');
    ok(acceptedQueueJob!.body.asyncQueue.tenantActiveExecutionLimit === 1, 'Async Queue: starter tenant active execution cap = 1');
    ok(acceptedQueueJob!.body.asyncQueue.tenantWeightedDispatchEnforced === true, 'Async Queue: starter weighted dispatch enforced');
    ok(acceptedQueueJob!.body.asyncQueue.tenantWeightedDispatchWeight === 1, 'Async Queue: starter weighted dispatch weight = 1');
    ok(acceptedQueueJob!.body.asyncQueue.tenantWeightedDispatchWindowMs === 400, 'Async Queue: starter weighted dispatch window = 400ms');
    ok(rejectedQueueJob!.body.asyncQueue.tenantPendingJobs >= 1, 'Async Queue: rejected response reports pending jobs');
    ok(rejectedQueueJob!.body.asyncQueue.tenantPendingLimit === 1, 'Async Queue: rejected response reports pending limit');

    const failedTenant = issueTenantApiKey({
      tenantId: 'tenant-dlq',
      tenantName: 'DLQ Tenant',
      planId: 'trial',
    });
    const failedSubmit = await fetch(`${BASE}/api/v1/pipeline/run-async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${failedTenant.apiKey}`,
        'Idempotency-Key': 'runtime-pipeline-dlq-proof',
      },
      body: JSON.stringify({
        candidateSql: 123,
        intent: 'bad-intent',
        sign: false,
      }),
    });
    ok(failedSubmit.status === 202, 'Async Queue: invalid payload still reaches worker for DLQ proof');
    const failedSubmitBody = await failedSubmit.json() as any;
    const failedStatus = await waitForJobStatus(
      failedSubmitBody.jobId,
      'failed',
      6000,
      { Authorization: `Bearer ${failedTenant.apiKey}` },
    );
    ok(
      failedStatus.error.includes('candidateSql')
        || failedStatus.error.includes('intent')
        || failedStatus.error.includes('Async job payload requires')
        || failedStatus.error.includes('non-empty string')
        || failedStatus.error.includes('object'),
      `Async Queue: worker exposes validation failure (actual=${failedStatus.error})`,
    );
    ok(failedStatus.maxAttempts >= 1, 'Async Queue: failed status reports retry ceiling');
    ok(failedStatus.tenantContext?.tenantId === 'tenant-dlq', 'Async Queue: failed status keeps tenant context');

    const adminQueueNoAuth = await fetch(`${BASE}/api/v1/admin/queue`);
    ok(adminQueueNoAuth.status === 401, 'Admin Queue: auth required');

    const adminQueueRes = await fetch(`${BASE}/api/v1/admin/queue?tenantId=tenant-dlq&planId=pro`, {
      headers: { Authorization: 'Bearer admin-secret' },
    });
    ok(adminQueueRes.status === 200, 'Admin Queue: status 200');
    const adminQueueBody = await adminQueueRes.json() as any;
    ok(adminQueueBody.retryPolicy.attempts >= 1, 'Admin Queue: retry policy exposed');
    ok(adminQueueBody.tenant?.tenantId === 'tenant-dlq', 'Admin Queue: tenant snapshot returned');
    ok(adminQueueBody.counts.failed >= 1, 'Admin Queue: failed count reflected');
    ok(typeof adminQueueBody.tenant?.weightedDispatchEnforced === 'boolean', 'Admin Queue: weighted dispatch enforcement surfaced');
    ok(typeof adminQueueBody.tenant?.weightedDispatchWindowMs === 'number' || adminQueueBody.tenant?.weightedDispatchWindowMs === null, 'Admin Queue: weighted dispatch window surfaced');

    const dlqNoAuth = await fetch(`${BASE}/api/v1/admin/queue/dlq`);
    ok(dlqNoAuth.status === 401, 'Admin DLQ: auth required');

    const dlqRes = await fetch(`${BASE}/api/v1/admin/queue/dlq?tenantId=tenant-dlq&limit=10`, {
      headers: { Authorization: 'Bearer admin-secret' },
    });
    ok(dlqRes.status === 200, 'Admin DLQ: status 200');
    const dlqBody = await dlqRes.json() as any;
    ok(dlqBody.summary.recordCount >= 1, 'Admin DLQ: at least one failed job listed');
    const dlqRecord = dlqBody.records.find((record: any) => record.jobId === failedSubmitBody.jobId);
    ok(Boolean(dlqRecord), 'Admin DLQ: failed job record present');
    ok(dlqRecord.failedReason.includes('candidateSql') || dlqRecord.failedReason.includes('intent'), 'Admin DLQ: failure reason preserved');
    ok(dlqRecord.backendMode === 'bullmq', 'Admin DLQ: backendMode truthful');
    ok(typeof dlqRecord.recordedAt === 'string', 'Admin DLQ: recordedAt surfaced');
    const persistedDlq = readAsyncDeadLetterStoreSnapshot();
    ok(persistedDlq.records.some((record) => record.jobId === failedSubmitBody.jobId), 'Admin DLQ: failed job persisted to local DLQ store');

    const retryNoAuth = await fetch(`${BASE}/api/v1/admin/queue/jobs/${failedSubmitBody.jobId}/retry`, {
      method: 'POST',
    });
    ok(retryNoAuth.status === 401, 'Admin Queue Retry: auth required');

    const retryRes = await fetch(`${BASE}/api/v1/admin/queue/jobs/${failedSubmitBody.jobId}/retry`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-secret',
        'Idempotency-Key': 'queue-retry-live-api',
      },
    });
    ok(retryRes.status === 202, 'Admin Queue Retry: status 202');
    const retryBody = await retryRes.json() as any;
    ok(retryBody.job.jobId === failedSubmitBody.jobId, 'Admin Queue Retry: same job retried');
    ok(!readAsyncDeadLetterStoreSnapshot().records.some((record) => record.jobId === failedSubmitBody.jobId), 'Admin Queue Retry: DLQ record removed after retry');

    const retryAuditRes = await fetch(`${BASE}/api/v1/admin/audit?action=async_job.retried`, {
      headers: { Authorization: 'Bearer admin-secret' },
    });
    ok(retryAuditRes.status === 200, 'Admin Queue Retry: audit status 200');
    const retryAuditBody = await retryAuditRes.json() as any;
    ok(retryAuditBody.summary.recordCount >= 1, 'Admin Queue Retry: retry action audited');
    console.log(`    cap=1, failedJob=${failedSubmitBody.jobId}, dlqRecords=${dlqBody.summary.recordCount}`);
  }
}
