import type { Context, Hono } from 'hono';
import {
  ADMIN_OPS_READ_ROLES,
  ADMIN_OPS_ROLES,
  adminRouteErrorMessage,
  authorizeAdminRoute,
  beginAdminRouteMutation,
  parseAdminListLimit,
  type AdminMutationReadyResultWithActor,
  type AdminRouteDeps,
  type AsyncDeadLetterRecord,
} from './admin-route-context.js';

export function registerAdminQueueRoutes(app: Hono, deps: AdminRouteDeps): void {
  const {
    currentAdminAuthorized,
    adminMutationService,
    adminQueryService,
    asyncBackendMode,
    bullmqQueue,
    getAsyncQueueSummary,
    getAsyncRetryPolicy,
    inProcessJobs,
    inProcessTenantQueueSnapshot,
    listFailedPipelineJobs,
    retryFailedPipelineJob,
  } = deps;
  async function beginAdminMutation(
    context: Context,
    routeId: string,
    requestPayload: unknown,
  ): Promise<AdminMutationReadyResultWithActor | Response> {
    return beginAdminRouteMutation(adminMutationService, context, routeId, requestPayload);
  }


app.get('/api/v1/admin/queue', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_OPS_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const tenantId = c.req.query('tenantId')?.trim() || null;
  const planId = c.req.query('planId')?.trim() || null;

  if (asyncBackendMode === 'bullmq' && bullmqQueue) {
    const summary = await getAsyncQueueSummary(bullmqQueue, tenantId, planId);
    return c.json({
      backendMode: 'bullmq',
      queueName: summary.queueName,
      counts: summary.counts,
      retryPolicy: summary.retryPolicy,
      tenant: summary.tenant,
    });
  }

  const retryPolicy = getAsyncRetryPolicy();
  return c.json({
    backendMode: 'in_process',
    queueName: null,
    counts: {
      waiting: Array.from(inProcessJobs.values()).filter((job) => job.status === 'queued').length,
      active: Array.from(inProcessJobs.values()).filter((job) => job.status === 'running').length,
      delayed: 0,
      prioritized: 0,
      completed: Array.from(inProcessJobs.values()).filter((job) => job.status === 'completed').length,
      failed: Array.from(inProcessJobs.values()).filter((job) => job.status === 'failed').length,
      paused: 0,
    },
    retryPolicy: {
      ...retryPolicy,
      attempts: 1,
      backoffMs: 0,
      maxStalledCount: 0,
    },
    tenant: tenantId ? inProcessTenantQueueSnapshot(tenantId, planId) : null,
  });
});

app.get('/api/v1/admin/queue/dlq', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_OPS_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const tenantId = c.req.query('tenantId')?.trim() || null;
  const limit = parseAdminListLimit(c, { defaultLimit: 25, maxLimit: 250 });
  if (limit instanceof Response) return limit;

  if (asyncBackendMode === 'bullmq' && bullmqQueue) {
    const persisted = await adminQueryService.listAsyncDeadLetters({ tenantId, backendMode: 'bullmq', limit });
    const live = persisted.records.length < limit
      ? await listFailedPipelineJobs(bullmqQueue, { tenantId, limit: limit * 2 })
      : [];
    const merged = new Map<string, AsyncDeadLetterRecord>();
    for (const record of persisted.records) merged.set(record.jobId, record);
    for (const record of live) {
      if (merged.size >= limit && merged.has(record.jobId)) continue;
      if (!merged.has(record.jobId)) merged.set(record.jobId, record);
      if (merged.size >= limit) break;
    }
    const records = [...merged.values()].slice(0, limit);
    return c.json({
      records,
      summary: {
        backendMode: 'bullmq',
        tenantFilter: tenantId,
        limit,
        recordCount: records.length,
      },
    });
  }

  const persisted = await adminQueryService.listAsyncDeadLetters({ tenantId, backendMode: 'in_process', limit });
  const live = Array.from(inProcessJobs.values())
    .filter((job) => job.status === 'failed')
    .filter((job) => !tenantId || job.tenantId === tenantId)
    .slice(0, limit)
    .map((job) => ({
      jobId: job.id,
      name: 'pipeline-run',
      backendMode: 'in_process' as const,
      tenantId: job.tenantId,
      planId: job.planId,
      state: 'failed',
      failedReason: job.error,
      attemptsMade: 0,
      maxAttempts: 1,
      requestedAt: job.submittedAt,
      submittedAt: job.submittedAt,
      processedAt: null,
      failedAt: job.completedAt,
      recordedAt: job.completedAt ?? job.submittedAt,
    }));
  const merged = new Map<string, AsyncDeadLetterRecord>();
  for (const record of persisted.records) merged.set(record.jobId, record);
  for (const record of live) {
    if (!merged.has(record.jobId)) merged.set(record.jobId, record);
    if (merged.size >= limit) break;
  }
  const records = [...merged.values()].slice(0, limit);

  return c.json({
    records,
    summary: {
      backendMode: 'in_process',
      tenantFilter: tenantId,
      limit,
      recordCount: records.length,
    },
  });
});

app.post('/api/v1/admin/queue/jobs/:id/retry', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_OPS_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const requestPayload = { jobId: c.req.param('id') };
  const adminMutation = await beginAdminMutation(c, 'admin.queue.jobs.retry', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  if (asyncBackendMode !== 'bullmq' || !bullmqQueue) {
    return c.json({ error: 'Manual async retry is only available when BullMQ is active.' }, 409);
  }

  let retried;
  try {
    retried = await retryFailedPipelineJob(bullmqQueue, c.req.param('id'));
  } catch (err) {
    return c.json({ error: adminRouteErrorMessage(err) }, 409);
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.queue.jobs.retry',
    requestPayload,
    statusCode: 202,
    responseBody: {
      job: retried,
    },
    audit: {
      action: 'async_job.retried',
      tenantId: retried.tenantId,
      planId: retried.planId,
      metadata: {
        queueName: bullmqQueue.name,
        attemptsMade: retried.attemptsMade,
        maxAttempts: retried.maxAttempts,
      },
      requestHash: adminMutation.requestHash,
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody, 202);
});
}
