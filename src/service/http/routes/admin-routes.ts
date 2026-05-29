import type { Context, Hono } from 'hono';
import {
  ADMIN_ACCOUNT_READ_ROLES,
  ADMIN_ACCOUNT_ROLES,
  ADMIN_AUDIT_READ_ROLES,
  ADMIN_BILLING_READ_ROLES,
  ADMIN_BILLING_ROLES,
  ADMIN_KEY_READ_ROLES,
  ADMIN_KEY_ROLES,
  ADMIN_OPS_READ_ROLES,
  ADMIN_OPS_ROLES,
  ADMIN_READ_ROLES,
  ADMIN_RELEASE_READ_ROLES,
  ADMIN_RELEASE_ROLES,
  adminAuditActionFilter,
  adminControlBillingEvent,
  adminControlServiceErrorResponse,
  adminDegradedModeActor,
  adminDegradedModeError,
  adminDegradedModeScope,
  adminDegradedModeStringArray,
  adminDegradedModeText,
  adminRouteErrorMessage,
  authorizeAdminRoute,
  beginAdminRouteMutation,
  billingEntitlementStatusFilter,
  billingEventOutcomeFilter,
  billingEventProviderFilter,
  createDegradedModeGrant,
  degradedModeGrantStatus,
  degradedModeGrantView,
  hostedEmailDeliveryProviderFilter,
  hostedEmailDeliveryStatusFilter,
  parseAdminJsonBody,
  parseAdminListLimit,
  type AdminMutationReadyResultWithActor,
  type AdminRouteDeps,
  type AsyncDeadLetterRecord,
  type DegradedModeGrantState,
  type EnforcementBreakGlassReason,
  type EnforcementFailureReason,
  type ListDegradedModeGrantOptions,
} from './admin-route-context.js';

export { resetAdminRouteAuthLimiterForTests } from './admin-route-context.js';
export type { AdminRouteDeps } from './admin-route-context.js';

export function registerAdminRoutes(app: Hono, deps: AdminRouteDeps): void {
  const {
    currentAdminAuthorized,
    adminMutationService,
    adminControlService,
    adminQueryService,
    adminTenantKeyView,
    tenantKeyStorePolicy,
    adminAccountView,
    readHostedBillingEntitlement,
    buildHostedBillingExport,
    buildHostedBillingReconciliation,
    renderHostedBillingExportCsv,
    billingEntitlementView,
    getUsageContext,
    buildHostedFeatureServiceView,
    getTenantAsyncExecutionCoordinatorStatus,
    getTenantAsyncWeightedDispatchCoordinatorStatus,
    adminPlanView,
    DEFAULT_HOSTED_PLAN_ID,
    defaultRateLimitWindowSeconds,
    adminAuditView,
    isBillingEventLedgerConfigured,
    listBillingEvents,
    billingEventView,
    renderPrometheusMetrics,
    currentMetricsAuthorized,
    getTelemetryStatus,
    getHostedEmailDeliveryStatus,
    getSecretEnvelopeStatus,
    asyncBackendMode,
    bullmqQueue,
    getAsyncQueueSummary,
    getAsyncRetryPolicy,
    inProcessJobs,
    inProcessTenantQueueSnapshot,
    listFailedPipelineJobs,
    retryFailedPipelineJob,
    apiReleaseIntrospectionStore,
    releaseDegradedModeGrantStore,
  } = deps;
  const degradedModeGrantStore = releaseDegradedModeGrantStore;

  async function beginAdminMutation(
    context: Context,
    routeId: string,
    requestPayload: unknown,
  ): Promise<AdminMutationReadyResultWithActor | Response> {
    return beginAdminRouteMutation(adminMutationService, context, routeId, requestPayload);
  }

app.get('/api/v1/admin/tenant-keys', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_KEY_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const limit = parseAdminListLimit(c);
  if (limit instanceof Response) return limit;
  const { records } = await adminQueryService.listTenantKeys();
  return c.json({
    keys: records.slice(0, limit).map(adminTenantKeyView),
    defaults: {
      maxActiveKeysPerTenant: tenantKeyStorePolicy().maxActiveKeysPerTenant,
    },
    pagination: {
      limit,
      returned: Math.min(records.length, limit),
      truncated: records.length > limit,
    },
  });
});

app.get('/api/v1/admin/accounts', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_ACCOUNT_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const limit = parseAdminListLimit(c);
  if (limit instanceof Response) return limit;
  const { records } = await adminQueryService.listHostedAccounts();
  return c.json({
    accounts: records.slice(0, limit).map(adminAccountView),
    pagination: {
      limit,
      returned: Math.min(records.length, limit),
      truncated: records.length > limit,
    },
  });
});

app.get('/api/v1/admin/accounts/:id/billing/export', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_BILLING_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const account = await adminQueryService.findHostedAccountById(c.req.param('id'));
  if (!account) {
    return c.json({ error: `Hosted account '${c.req.param('id')}' not found.` }, 404);
  }

  c.set('obs.accountId', account.id);
  c.set('obs.accountStatus', account.status);
  c.set('obs.tenantId', account.primaryTenantId);
  c.set('obs.planId', account.billing.lastCheckoutPlanId ?? null);

  const format = (c.req.query('format')?.trim().toLowerCase() ?? 'json');
  if (format !== 'json' && format !== 'csv') {
    return c.json({ error: "format must be 'json' or 'csv'." }, 400);
  }

  const parsedLimit = parseAdminListLimit(c, { defaultLimit: 20, maxLimit: 100 });
  if (parsedLimit instanceof Response) return parsedLimit;

  const entitlement = await readHostedBillingEntitlement(account);
  const tenantRecord = await adminQueryService.findTenantRecordByTenantId(account.primaryTenantId);
  const usage = await getUsageContext(
    account.primaryTenantId,
    tenantRecord?.planId ?? account.billing.lastCheckoutPlanId,
    tenantRecord?.monthlyRunQuota ?? null,
  );
  const payload = await buildHostedBillingExport({
    account,
    entitlement,
    usage,
    limit: parsedLimit,
  });
  const reconciliation = buildHostedBillingReconciliation(payload);

  if (format === 'csv') {
    c.header('content-type', 'text/csv; charset=utf-8');
    c.header('cache-control', 'no-store');
    c.header('content-disposition', `attachment; filename="${account.id}-billing-export.csv"`);
    return c.body(renderHostedBillingExportCsv(payload));
  }

  return c.json({
    ...payload,
    entitlement: billingEntitlementView(entitlement),
    reconciliation,
  });
});

app.get('/api/v1/admin/accounts/:id/features', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_ACCOUNT_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const accountId = c.req.param('id');
  const account = await adminQueryService.findHostedAccountById(accountId);
  if (!account) {
    return c.json({ error: `Hosted account '${accountId}' was not found.` }, 404);
  }
  const entitlement = await readHostedBillingEntitlement(account);
  return c.json(buildHostedFeatureServiceView(entitlement));
});

app.get('/api/v1/admin/accounts/:id/billing/reconciliation', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_BILLING_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const account = await adminQueryService.findHostedAccountById(c.req.param('id'));
  if (!account) {
    return c.json({ error: `Hosted account '${c.req.param('id')}' not found.` }, 404);
  }

  c.set('obs.accountId', account.id);
  c.set('obs.accountStatus', account.status);
  c.set('obs.tenantId', account.primaryTenantId);
  c.set('obs.planId', account.billing.lastCheckoutPlanId ?? null);

  const parsedLimit = parseAdminListLimit(c, { defaultLimit: 20, maxLimit: 100 });
  if (parsedLimit instanceof Response) return parsedLimit;

  const entitlement = await readHostedBillingEntitlement(account);
  const payload = await buildHostedBillingExport({
    account,
    entitlement,
    limit: parsedLimit,
  });
  const reconciliation = buildHostedBillingReconciliation(payload);

  return c.json({
    accountId: account.id,
    tenantId: account.primaryTenantId,
    stripeCustomerId: account.billing.stripeCustomerId,
    stripeSubscriptionId: account.billing.stripeSubscriptionId,
    entitlement: billingEntitlementView(entitlement),
    reconciliation,
  });
});

app.get('/api/v1/admin/plans', (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const asyncExecutionCoordinator = getTenantAsyncExecutionCoordinatorStatus();
  const asyncWeightedDispatchCoordinator = getTenantAsyncWeightedDispatchCoordinatorStatus();
  return c.json({
    plans: adminPlanView(),
    defaults: {
      hostedProvisioningPlanId: DEFAULT_HOSTED_PLAN_ID,
      maxActiveKeysPerTenant: tenantKeyStorePolicy().maxActiveKeysPerTenant,
      rateLimitWindowSeconds: defaultRateLimitWindowSeconds(),
      asyncExecutionShared: asyncExecutionCoordinator.shared,
      asyncExecutionBackend: asyncExecutionCoordinator.backend,
      asyncWeightedDispatchShared: asyncWeightedDispatchCoordinator.shared,
      asyncWeightedDispatchBackend: asyncWeightedDispatchCoordinator.backend,
    },
  });
});

app.get('/api/v1/admin/audit', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_AUDIT_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const action = adminAuditActionFilter(c.req.query('action')?.trim());
  const tenantId = c.req.query('tenantId')?.trim() || null;
  const accountId = c.req.query('accountId')?.trim() || null;
  const limit = parseAdminListLimit(c, { defaultLimit: 100, maxLimit: 1000 });
  if (limit instanceof Response) return limit;

  const result = await adminQueryService.listAdminAuditRecords({
    action: action ?? null,
    tenantId,
    accountId,
    limit,
  });

  return c.json({
    records: result.records.map(adminAuditView),
    summary: {
      actionFilter: action ?? null,
      tenantFilter: tenantId,
      accountFilter: accountId,
      recordCount: result.records.length,
      chainIntact: result.chainIntact,
      latestHash: result.latestHash,
    },
  });
});

app.get('/api/v1/admin/billing/events', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_BILLING_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  if (!isBillingEventLedgerConfigured()) {
    return c.json({
      error: 'Billing event ledger disabled. Set ATTESTOR_BILLING_LEDGER_PG_URL to enable shared billing event storage.',
    }, 503);
  }

  const provider = billingEventProviderFilter(c.req.query('provider')?.trim());
  const accountId = c.req.query('accountId')?.trim() || null;
  const tenantId = c.req.query('tenantId')?.trim() || null;
  const eventType = c.req.query('eventType')?.trim() || null;
  const outcome = billingEventOutcomeFilter(c.req.query('outcome')?.trim());
  const limit = parseAdminListLimit(c, { defaultLimit: 100, maxLimit: 500 });
  if (limit instanceof Response) return limit;

  const records = await listBillingEvents({
    provider: provider ?? null,
    accountId,
    tenantId,
    eventType,
    outcome: outcome ?? null,
    limit,
  });

  return c.json({
    records: records.map(billingEventView),
    summary: {
      providerFilter: provider ?? null,
      accountFilter: accountId,
      tenantFilter: tenantId,
      eventTypeFilter: eventType,
      outcomeFilter: outcome ?? null,
      recordCount: records.length,
      appliedCount: records.filter((record) => record.outcome === 'applied').length,
      ignoredCount: records.filter((record) => record.outcome === 'ignored').length,
      pendingCount: records.filter((record) => record.outcome === 'pending').length,
    },
  });
});

app.get('/api/v1/admin/billing/entitlements', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_BILLING_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const accountId = c.req.query('accountId')?.trim() || null;
  const tenantId = c.req.query('tenantId')?.trim() || null;
  const statusValue = c.req.query('status')?.trim() || null;
  const status = billingEntitlementStatusFilter(statusValue);
  if (statusValue && !status) {
    return c.json({ error: 'status filter is invalid.' }, 400);
  }

  const limit = parseAdminListLimit(c, { defaultLimit: 100, maxLimit: 500 });
  if (limit instanceof Response) return limit;

  const result = await adminQueryService.listHostedBillingEntitlements({
    accountId,
    tenantId,
    status,
    limit,
  });

  return c.json({
    records: result.records.map(billingEntitlementView),
    summary: {
      accountFilter: accountId,
      tenantFilter: tenantId,
      statusFilter: status,
      recordCount: result.records.length,
      accessEnabledCount: result.records.filter((entry) => entry.accessEnabled).length,
      providerCounts: {
        manual: result.records.filter((entry) => entry.provider === 'manual').length,
        stripe: result.records.filter((entry) => entry.provider === 'stripe').length,
      },
    },
  });
});

app.get('/api/v1/admin/metrics', (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_OPS_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  return c.body(renderPrometheusMetrics('1.0.0'), 200, {
    'content-type': 'text/plain; version=0.0.4; charset=utf-8',
    'cache-control': 'no-store',
  });
});

app.get('/api/v1/metrics', (c) => {
  const unauthorized = currentMetricsAuthorized(c);
  if (unauthorized) return unauthorized;

  return c.body(renderPrometheusMetrics('1.0.0'), 200, {
    'content-type': 'text/plain; version=0.0.4; charset=utf-8',
    'cache-control': 'no-store',
  });
});

app.get('/api/v1/admin/telemetry', (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_OPS_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;
  return c.json({
    telemetry: getTelemetryStatus(),
    emailDelivery: getHostedEmailDeliveryStatus(),
    secretEnvelope: getSecretEnvelopeStatus(),
  });
});

app.get('/api/v1/admin/email/deliveries', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_OPS_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;
  const purpose = c.req.query('purpose')?.trim();
  const status = c.req.query('status')?.trim();
  const provider = c.req.query('provider')?.trim();
  const recipient = c.req.query('recipient')?.trim();
  const accountId = c.req.query('accountId')?.trim();
  const limit = parseAdminListLimit(c, { defaultLimit: 100, maxLimit: 500 });
  if (limit instanceof Response) return limit;
  const deliveries = await adminQueryService.listHostedEmailDeliveries({
    accountId: accountId || null,
    purpose: purpose === 'invite' || purpose === 'password_reset' ? purpose : null,
    status: hostedEmailDeliveryStatusFilter(status),
    provider: hostedEmailDeliveryProviderFilter(provider),
    recipient: recipient || null,
    limit,
  });
  return c.json({
    records: deliveries.records,
    summary: {
      accountFilter: accountId ?? null,
      purposeFilter: purpose ?? null,
      statusFilter: status ?? null,
      providerFilter: provider ?? null,
      recipientFilter: recipient ?? null,
      recordCount: deliveries.records.length,
    },
  });
});

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

app.post('/api/v1/admin/accounts', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_ACCOUNT_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const body = await parseAdminJsonBody(c);
  if (body instanceof Response) return body;
  const accountName = typeof body.accountName === 'string' ? body.accountName.trim() : '';
  const contactEmail = typeof body.contactEmail === 'string' ? body.contactEmail.trim() : '';
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
  const tenantName = typeof body.tenantName === 'string' ? body.tenantName.trim() : '';
  const requestedPlanId = typeof body.planId === 'string' && body.planId.trim() !== '' ? body.planId.trim() : DEFAULT_HOSTED_PLAN_ID;
  const monthlyRunQuota = typeof body.monthlyRunQuota === 'number' && body.monthlyRunQuota >= 0
    ? body.monthlyRunQuota
    : null;
  const requestPayload = {
    accountName,
    contactEmail,
    tenantId,
    tenantName,
    planId: requestedPlanId,
    monthlyRunQuota,
  };

  if (!accountName || !contactEmail || !tenantId || !tenantName) {
    return c.json({ error: 'accountName, contactEmail, tenantId, and tenantName are required' }, 400);
  }

  const adminMutation = await beginAdminMutation(c, 'admin.accounts.create', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  let provisioned;
  try {
    provisioned = await adminControlService.provisionHostedAccount({
      accountName,
      contactEmail,
      tenantId,
      tenantName,
      planId: requestedPlanId,
      monthlyRunQuota,
    });
  } catch (err) {
    const mapped = adminControlServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.accounts.create',
    requestPayload,
    statusCode: 201,
    responseBody: {
      account: adminAccountView(provisioned.account),
      initialKey: {
        ...adminTenantKeyView(provisioned.initialKey),
        apiKey: provisioned.apiKey,
      },
    },
    audit: {
      action: 'account.created',
      accountId: provisioned.account.id,
      tenantId: provisioned.initialKey.tenantId,
      tenantKeyId: provisioned.initialKey.id,
      planId: provisioned.initialKey.planId,
      monthlyRunQuota: provisioned.initialKey.monthlyRunQuota,
      requestHash: adminMutation.requestHash,
      metadata: {
        accountName: provisioned.account.accountName,
        contactEmail: provisioned.account.contactEmail,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody, 201);
});

app.post('/api/v1/admin/accounts/:id/billing/stripe', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_BILLING_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const body = await parseAdminJsonBody(c);
  if (body instanceof Response) return body;
  const requestPayload = {
    id: c.req.param('id'),
    stripeCustomerId: typeof body.stripeCustomerId === 'string' ? body.stripeCustomerId.trim() : '',
    stripeSubscriptionId: typeof body.stripeSubscriptionId === 'string' ? body.stripeSubscriptionId.trim() : '',
    stripeSubscriptionStatus: typeof body.stripeSubscriptionStatus === 'string'
      ? body.stripeSubscriptionStatus.trim()
      : null,
    stripePriceId: typeof body.stripePriceId === 'string' ? body.stripePriceId.trim() : '',
  };
  if (!requestPayload.stripeCustomerId && !requestPayload.stripeSubscriptionId) {
    return c.json({ error: 'stripeCustomerId or stripeSubscriptionId is required.' }, 400);
  }

  const adminMutation = await beginAdminMutation(c, 'admin.accounts.attach_stripe_billing', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  let attached;
  try {
    attached = await adminControlService.attachStripeBilling({
      accountId: c.req.param('id'),
      stripeCustomerId: requestPayload.stripeCustomerId || null,
      stripeSubscriptionId: requestPayload.stripeSubscriptionId || null,
      stripeSubscriptionStatus: requestPayload.stripeSubscriptionStatus,
      stripePriceId: requestPayload.stripePriceId || null,
    });
  } catch (err) {
    const mapped = adminControlServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.accounts.attach_stripe_billing',
    requestPayload,
    statusCode: 200,
    responseBody: {
      account: adminAccountView(attached.record),
    },
    audit: {
      action: 'account.billing.attached',
      accountId: attached.record.id,
      tenantId: attached.record.primaryTenantId,
      requestHash: adminMutation.requestHash,
      metadata: {
        stripeCustomerId: attached.record.billing.stripeCustomerId,
        stripeSubscriptionId: attached.record.billing.stripeSubscriptionId,
        stripeSubscriptionStatus: attached.record.billing.stripeSubscriptionStatus,
        stripePriceId: attached.record.billing.stripePriceId,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody);
});

app.post('/api/v1/admin/accounts/:id/suspend', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_ACCOUNT_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const body = await parseAdminJsonBody(c);
  if (body instanceof Response) return body;
  const requestPayload = {
    id: c.req.param('id'),
    reason: typeof body.reason === 'string' ? body.reason.trim() : '',
  };
  const adminMutation = await beginAdminMutation(c, 'admin.accounts.suspend', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  let result;
  try {
    result = await adminControlService.setHostedAccountStatus({
      accountId: c.req.param('id'),
      status: 'suspended',
    });
  } catch (err) {
    const mapped = adminControlServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.accounts.suspend',
    requestPayload,
    statusCode: 200,
    responseBody: {
      account: adminAccountView(result.record),
    },
    audit: {
      action: 'account.suspended',
      accountId: result.record.id,
      tenantId: result.record.primaryTenantId,
      requestHash: adminMutation.requestHash,
      metadata: {
        reason: requestPayload.reason || null,
        suspendedAt: result.record.suspendedAt,
        revokedSessionCount: result.revokedSessionCount,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody);
});

app.post('/api/v1/admin/accounts/:id/reactivate', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_ACCOUNT_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const body = await parseAdminJsonBody(c);
  if (body instanceof Response) return body;
  const requestPayload = {
    id: c.req.param('id'),
    reason: typeof body.reason === 'string' ? body.reason.trim() : '',
  };
  const adminMutation = await beginAdminMutation(c, 'admin.accounts.reactivate', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  let result;
  try {
    result = await adminControlService.setHostedAccountStatus({
      accountId: c.req.param('id'),
      status: 'active',
    });
  } catch (err) {
    const mapped = adminControlServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.accounts.reactivate',
    requestPayload,
    statusCode: 200,
    responseBody: {
      account: adminAccountView(result.record),
    },
    audit: {
      action: 'account.reactivated',
      accountId: result.record.id,
      tenantId: result.record.primaryTenantId,
      requestHash: adminMutation.requestHash,
      metadata: {
        reason: requestPayload.reason || null,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody);
});

app.post('/api/v1/admin/accounts/:id/archive', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_ACCOUNT_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const body = await parseAdminJsonBody(c);
  if (body instanceof Response) return body;
  const requestPayload = {
    id: c.req.param('id'),
    reason: typeof body.reason === 'string' ? body.reason.trim() : '',
  };
  const adminMutation = await beginAdminMutation(c, 'admin.accounts.archive', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  let result;
  try {
    result = await adminControlService.setHostedAccountStatus({
      accountId: c.req.param('id'),
      status: 'archived',
    });
  } catch (err) {
    const mapped = adminControlServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.accounts.archive',
    requestPayload,
    statusCode: 200,
    responseBody: {
      account: adminAccountView(result.record),
    },
    audit: {
      action: 'account.archived',
      accountId: result.record.id,
      tenantId: result.record.primaryTenantId,
      requestHash: adminMutation.requestHash,
      metadata: {
        reason: requestPayload.reason || null,
        archivedAt: result.record.archivedAt,
        revokedSessionCount: result.revokedSessionCount,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody);
});

app.post('/api/v1/admin/tenant-keys', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_KEY_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const body = await parseAdminJsonBody(c);
  if (body instanceof Response) return body;
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
  const tenantName = typeof body.tenantName === 'string' ? body.tenantName.trim() : '';
  const requestedPlanId = typeof body.planId === 'string' && body.planId.trim() !== '' ? body.planId.trim() : DEFAULT_HOSTED_PLAN_ID;
  const monthlyRunQuota = typeof body.monthlyRunQuota === 'number' && body.monthlyRunQuota >= 0
    ? body.monthlyRunQuota
    : null;
  const requestPayload = {
    tenantId,
    tenantName,
    planId: requestedPlanId,
    monthlyRunQuota,
  };

  if (!tenantId || !tenantName) {
    return c.json({ error: 'tenantId and tenantName are required' }, 400);
  }

  const adminMutation = await beginAdminMutation(c, 'admin.tenant_keys.issue', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  let issued;
  try {
    issued = await adminControlService.issueTenantApiKey({
      tenantId,
      tenantName,
      planId: requestedPlanId,
      monthlyRunQuota,
      billingEvent: adminControlBillingEvent(adminMutation, 'admin.tenant_keys.issue'),
    });
  } catch (err) {
    const mapped = adminControlServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.tenant_keys.issue',
    requestPayload,
    statusCode: 201,
    responseBody: {
      key: {
        ...adminTenantKeyView(issued.record),
        apiKey: issued.apiKey,
      },
    },
    audit: {
      action: 'tenant_key.issued',
      tenantId: issued.record.tenantId,
      tenantKeyId: issued.record.id,
      planId: issued.record.planId,
      monthlyRunQuota: issued.record.monthlyRunQuota,
      requestHash: adminMutation.requestHash,
      metadata: {
        tenantName: issued.record.tenantName,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody, 201);
});

app.post('/api/v1/admin/tenant-keys/:id/rotate', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_KEY_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const body = await parseAdminJsonBody(c);
  if (body instanceof Response) return body;
  const requestedPlanId = typeof body.planId === 'string' && body.planId.trim() !== '' ? body.planId.trim() : null;
  const monthlyRunQuota = typeof body.monthlyRunQuota === 'number' && body.monthlyRunQuota >= 0
    ? body.monthlyRunQuota
    : null;
  const requestPayload = {
    id: c.req.param('id'),
    planId: requestedPlanId,
    monthlyRunQuota,
  };
  const adminMutation = await beginAdminMutation(c, 'admin.tenant_keys.rotate', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  let rotated;
  try {
    rotated = await adminControlService.rotateTenantApiKey({
      id: c.req.param('id'),
      planId: requestedPlanId,
      monthlyRunQuota,
      billingEvent: adminControlBillingEvent(adminMutation, 'admin.tenant_keys.rotate'),
    });
  } catch (err) {
    const mapped = adminControlServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.tenant_keys.rotate',
    requestPayload,
    statusCode: 201,
    responseBody: {
      previousKey: adminTenantKeyView(rotated.previousRecord),
      newKey: {
        ...adminTenantKeyView(rotated.record),
        apiKey: rotated.apiKey,
      },
    },
    audit: {
      action: 'tenant_key.rotated',
      tenantId: rotated.record.tenantId,
      tenantKeyId: rotated.record.id,
      planId: rotated.record.planId,
      monthlyRunQuota: rotated.record.monthlyRunQuota,
      requestHash: adminMutation.requestHash,
      metadata: {
        previousKeyId: rotated.previousRecord.id,
        supersededKeyId: rotated.previousRecord.id,
        replacementKeyId: rotated.record.id,
        previousLastUsedAt: rotated.previousRecord.lastUsedAt,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody, 201);
});

app.post('/api/v1/admin/tenant-keys/:id/deactivate', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_KEY_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const requestPayload = { id: c.req.param('id') };
  const adminMutation = await beginAdminMutation(c, 'admin.tenant_keys.deactivate', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  let result;
  try {
    result = await adminControlService.setTenantApiKeyStatus({
      id: c.req.param('id'),
      status: 'inactive',
      billingEvent: adminControlBillingEvent(adminMutation, 'admin.tenant_keys.deactivate'),
    });
  } catch (err) {
    const mapped = adminControlServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.tenant_keys.deactivate',
    requestPayload,
    statusCode: 200,
    responseBody: {
      key: adminTenantKeyView(result.record),
    },
    audit: {
      action: 'tenant_key.deactivated',
      tenantId: result.record.tenantId,
      tenantKeyId: result.record.id,
      planId: result.record.planId,
      monthlyRunQuota: result.record.monthlyRunQuota,
      requestHash: adminMutation.requestHash,
      metadata: {
        tenantName: result.record.tenantName,
        deactivatedAt: result.record.deactivatedAt,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody);
});

app.post('/api/v1/admin/tenant-keys/:id/reactivate', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_KEY_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const requestPayload = { id: c.req.param('id') };
  const adminMutation = await beginAdminMutation(c, 'admin.tenant_keys.reactivate', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  let result;
  try {
    result = await adminControlService.setTenantApiKeyStatus({
      id: c.req.param('id'),
      status: 'active',
      billingEvent: adminControlBillingEvent(adminMutation, 'admin.tenant_keys.reactivate'),
    });
  } catch (err) {
    const mapped = adminControlServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.tenant_keys.reactivate',
    requestPayload,
    statusCode: 200,
    responseBody: {
      key: adminTenantKeyView(result.record),
    },
    audit: {
      action: 'tenant_key.reactivated',
      tenantId: result.record.tenantId,
      tenantKeyId: result.record.id,
      planId: result.record.planId,
      monthlyRunQuota: result.record.monthlyRunQuota,
      requestHash: adminMutation.requestHash,
      metadata: {
        tenantName: result.record.tenantName,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody);
});

app.post('/api/v1/admin/tenant-keys/:id/recover', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_KEY_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const body = await parseAdminJsonBody(c);
  if (body instanceof Response) return body;
  const requestPayload = {
    id: c.req.param('id'),
    reason: typeof body.reason === 'string' ? body.reason.trim() : '',
  };
  const adminMutation = await beginAdminMutation(c, 'admin.tenant_keys.recover', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  let recovered;
  try {
    recovered = await adminControlService.recoverTenantApiKey({
      id: c.req.param('id'),
    });
  } catch (err) {
    const mapped = adminControlServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.tenant_keys.recover',
    requestPayload,
    statusCode: 200,
    responseBody: {
      key: {
        ...adminTenantKeyView(recovered.record),
        apiKey: recovered.apiKey,
      },
    },
    audit: {
      action: 'tenant_key.recovered',
      tenantId: recovered.record.tenantId,
      tenantKeyId: recovered.record.id,
      planId: recovered.record.planId,
      monthlyRunQuota: recovered.record.monthlyRunQuota,
      requestHash: adminMutation.requestHash,
      metadata: {
        tenantName: recovered.record.tenantName,
        provider: recovered.record.recoveryEnvelope?.provider ?? null,
        keyName: recovered.record.recoveryEnvelope?.keyName ?? null,
        keyVersion: recovered.record.recoveryEnvelope?.keyVersion ?? null,
        reason: requestPayload.reason || null,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody);
});

app.post('/api/v1/admin/tenant-keys/:id/revoke', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_KEY_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const requestPayload = { id: c.req.param('id') };
  const adminMutation = await beginAdminMutation(c, 'admin.tenant_keys.revoke', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  let result;
  try {
    result = await adminControlService.revokeTenantApiKey({
      id: c.req.param('id'),
      billingEvent: adminControlBillingEvent(adminMutation, 'admin.tenant_keys.revoke'),
    });
  } catch (err) {
    const mapped = adminControlServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.tenant_keys.revoke',
    requestPayload,
    statusCode: 200,
    responseBody: {
      key: adminTenantKeyView(result.record),
    },
    audit: {
      action: 'tenant_key.revoked',
      tenantId: result.record.tenantId,
      tenantKeyId: result.record.id,
      planId: result.record.planId,
      monthlyRunQuota: result.record.monthlyRunQuota,
      requestHash: adminMutation.requestHash,
      metadata: {
        tenantName: result.record.tenantName,
        revokedAt: result.record.revokedAt,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody);
});

app.post('/api/v1/admin/release-tokens/:id/revoke', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_RELEASE_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const body = await parseAdminJsonBody(c);
  if (body instanceof Response) return body;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const requestPayload = {
    id: c.req.param('id'),
    reason: reason || null,
  };
  const adminMutation = await beginAdminMutation(c, 'admin.release_tokens.revoke', requestPayload);
  if (adminMutation instanceof Response) return adminMutation;

  const existing = await apiReleaseIntrospectionStore.findToken(c.req.param('id'));
  if (!existing) {
    return c.json({ error: 'Release token not found' }, 404);
  }

  const revoked = await apiReleaseIntrospectionStore.revokeToken({
    tokenId: existing.tokenId,
    revokedAt: new Date().toISOString(),
    reason: reason || undefined,
    revokedBy: adminMutation.adminActor.releaseActor.id,
  });
  if (!revoked) {
    return c.json({ error: 'Release token not found' }, 404);
  }

  const responseBody = await adminMutationService.finalize({
    idempotencyKey: adminMutation.idempotencyKey,
    routeId: 'admin.release_tokens.revoke',
    requestPayload,
    statusCode: 200,
    responseBody: {
      token: {
        id: revoked.tokenId,
        status: revoked.status,
        decisionId: revoked.decisionId,
        consequenceType: revoked.consequenceType,
        riskClass: revoked.riskClass,
        audience: revoked.audience,
        issuedAt: revoked.issuedAt,
        expiresAt: revoked.expiresAt,
        revokedAt: revoked.revokedAt,
        revocationReason: revoked.revocationReason,
        revokedBy: revoked.revokedBy,
      },
    },
    audit: {
      action: 'release_token.revoked',
      requestHash: adminMutation.requestHash,
      metadata: {
        tokenId: revoked.tokenId,
        decisionId: revoked.decisionId,
        consequenceType: revoked.consequenceType,
        riskClass: revoked.riskClass,
        audience: revoked.audience,
        reason: revoked.revocationReason,
        revokedBy: revoked.revokedBy,
      },
    },
    actor: adminMutation.adminActor,
  });

  return c.json(responseBody);
});

app.get('/api/v1/admin/release-enforcement/degraded-mode/grants', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_RELEASE_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const statusQuery = c.req.query('status')?.trim() as ListDegradedModeGrantOptions['status'] | undefined;
  const allowedStatuses: readonly NonNullable<ListDegradedModeGrantOptions['status']>[] = [
    'active',
    'not-yet-valid',
    'expired',
    'revoked',
    'exhausted',
    'all',
  ];
  if (statusQuery && !allowedStatuses.includes(statusQuery)) {
    return c.json({ error: 'status must be active, not-yet-valid, expired, revoked, exhausted, or all.' }, 400);
  }
  const limit = parseAdminListLimit(c, { defaultLimit: 100, maxLimit: 500 });
  if (limit instanceof Response) return limit;

  const grants = await degradedModeGrantStore.listGrants({
    status: statusQuery ?? 'all',
  });
  const visibleGrants = grants.slice(0, limit);
  const auditHead = await degradedModeGrantStore.auditHead();
  const now = new Date().toISOString();
  return c.json({
    version: 'attestor.release-enforcement-degraded-mode.admin.v1',
    grants: visibleGrants.map(degradedModeGrantView),
    summary: {
      grantCount: visibleGrants.length,
      activeCount: visibleGrants.filter((grant) => degradedModeGrantStatus(grant, now) === 'active').length,
      limit,
      truncated: grants.length > limit,
      auditHead,
    },
  });
});

app.post('/api/v1/admin/release-enforcement/degraded-mode/grants', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_RELEASE_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const body = await parseAdminJsonBody(c);
  if (body instanceof Response) return body;
  const state = adminDegradedModeText(body.state ?? body.posture) as DegradedModeGrantState;
  const allowedFailureReasons =
    adminDegradedModeStringArray<EnforcementFailureReason>(body.allowedFailureReasons);
  const approvedBy = Array.isArray(body.approvedBy)
    ? body.approvedBy.map(adminDegradedModeActor)
    : [];
  const requestPayload = {
    id: adminDegradedModeText(body.id) || null,
    state: state || null,
    reason: adminDegradedModeText(body.reason) || null,
    scope: body.scope ?? null,
    ticketId: adminDegradedModeText(body.ticketId) || null,
    ttlSeconds: typeof body.ttlSeconds === 'number' ? body.ttlSeconds : null,
    expiresAt: adminDegradedModeText(body.expiresAt) || null,
    maxUses: typeof body.maxUses === 'number' ? body.maxUses : null,
    allowedFailureReasons: allowedFailureReasons ?? null,
  };
  const adminMutation = await beginAdminMutation(
    c,
    'admin.release_enforcement.degraded_mode.grants.create',
    requestPayload,
  );
  if (adminMutation instanceof Response) return adminMutation;

  try {
    const grant = createDegradedModeGrant({
      id: adminDegradedModeText(body.id) || undefined,
      state,
      reason: adminDegradedModeText(body.reason) as EnforcementBreakGlassReason,
      scope: adminDegradedModeScope(body.scope),
      authorizedBy: adminDegradedModeActor(body.authorizedBy ?? body.grantedBy ?? adminMutation.adminActor.releaseActor),
      approvedBy,
      authorizedAt: adminDegradedModeText(body.authorizedAt) || undefined,
      startsAt: adminDegradedModeText(body.startsAt) || undefined,
      expiresAt: adminDegradedModeText(body.expiresAt) || undefined,
      ttlSeconds: typeof body.ttlSeconds === 'number' ? body.ttlSeconds : undefined,
      maxTtlSeconds: typeof body.maxTtlSeconds === 'number' ? body.maxTtlSeconds : undefined,
      ticketId: adminDegradedModeText(body.ticketId),
      rationale: adminDegradedModeText(body.rationale),
      allowedFailureReasons,
      maxUses: typeof body.maxUses === 'number' ? body.maxUses : undefined,
      remainingUses: typeof body.remainingUses === 'number' ? body.remainingUses : undefined,
    });
    await degradedModeGrantStore.registerGrant(grant);
    const auditHead = await degradedModeGrantStore.auditHead();

    const responseBody = await adminMutationService.finalize({
      idempotencyKey: adminMutation.idempotencyKey,
      routeId: 'admin.release_enforcement.degraded_mode.grants.create',
      requestPayload,
      statusCode: 201,
      responseBody: {
        grant: degradedModeGrantView(grant),
        auditHead,
      },
      audit: {
        action: 'release_enforcement.degraded_mode.grant_created',
        requestHash: adminMutation.requestHash,
        metadata: {
          grantId: grant.id,
          state: grant.state,
          reason: grant.reason,
          ticketId: grant.ticketId,
          expiresAt: grant.expiresAt,
          maxUses: grant.maxUses,
          remainingUses: grant.remainingUses,
          auditDigest: grant.auditDigest,
          auditHead,
        },
      },
      actor: adminMutation.adminActor,
    });

    return c.json(responseBody, 201);
  } catch (error) {
    return c.json({ error: adminDegradedModeError(error) }, 400);
  }
});

app.post('/api/v1/admin/release-enforcement/degraded-mode/grants/:id/revoke', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_RELEASE_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const body = await parseAdminJsonBody(c);
  if (body instanceof Response) return body;
  const reason = adminDegradedModeText(body.reason);
  if (!reason) {
    return c.json({ error: 'Release enforcement degraded mode grant revocation reason is required.' }, 400);
  }
  const requestPayload = {
    id: c.req.param('id'),
    reason,
  };
  const adminMutation = await beginAdminMutation(
    c,
    'admin.release_enforcement.degraded_mode.grants.revoke',
    requestPayload,
  );
  if (adminMutation instanceof Response) return adminMutation;

  try {
    const revoked = await degradedModeGrantStore.revokeGrant({
      id: c.req.param('id'),
      revokedAt: new Date().toISOString(),
      revokedBy: adminDegradedModeActor(body.revokedBy ?? body.actor ?? adminMutation.adminActor.releaseActor),
      revocationReason: reason,
    });
    if (!revoked) {
      return c.json({ error: 'Release enforcement degraded mode grant not found.' }, 404);
    }

    const auditHead = await degradedModeGrantStore.auditHead();
    const responseBody = await adminMutationService.finalize({
      idempotencyKey: adminMutation.idempotencyKey,
      routeId: 'admin.release_enforcement.degraded_mode.grants.revoke',
      requestPayload,
      statusCode: 200,
      responseBody: {
        grant: degradedModeGrantView(revoked),
        auditHead,
      },
      audit: {
        action: 'release_enforcement.degraded_mode.grant_revoked',
        requestHash: adminMutation.requestHash,
        metadata: {
          grantId: revoked.id,
          state: revoked.state,
          reason: revoked.reason,
          revocationReason: revoked.revocationReason,
          revokedAt: revoked.revokedAt,
          revokedBy: revoked.revokedBy,
          auditDigest: revoked.auditDigest,
          auditHead,
        },
      },
      actor: adminMutation.adminActor,
    });

    return c.json(responseBody);
  } catch (error) {
    return c.json({ error: adminDegradedModeError(error) }, 400);
  }
});

app.get('/api/v1/admin/usage', async (c) => {
  const authorized = authorizeAdminRoute(c, ADMIN_BILLING_READ_ROLES, currentAdminAuthorized);
  if (authorized instanceof Response) return authorized;

  const tenantId = c.req.query('tenantId')?.trim() || null;
  const period = c.req.query('period')?.trim() || null;
  const limit = parseAdminListLimit(c, { defaultLimit: 100, maxLimit: 500 });
  if (limit instanceof Response) return limit;
  const allRecords = await adminQueryService.listUsage({ tenantId, period });
  const records = allRecords.slice(0, limit);

  return c.json({
    records,
    summary: {
      tenantFilter: tenantId,
      periodFilter: period,
      recordCount: records.length,
      limit,
      truncated: allRecords.length > limit,
      tenantCount: new Set(records.map((entry) => entry.tenantId)).size,
      totalUsed: records.reduce((sum, entry) => sum + entry.used, 0),
      totalOverageUnits: records.reduce((sum, entry) => sum + entry.overageUnits, 0),
    },
  });
});

}


