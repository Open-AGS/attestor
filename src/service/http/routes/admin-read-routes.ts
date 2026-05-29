import type { Hono } from 'hono';
import {
  ADMIN_ACCOUNT_READ_ROLES,
  ADMIN_AUDIT_READ_ROLES,
  ADMIN_BILLING_READ_ROLES,
  ADMIN_KEY_READ_ROLES,
  ADMIN_OPS_READ_ROLES,
  ADMIN_READ_ROLES,
  adminAuditActionFilter,
  authorizeAdminRoute,
  billingEntitlementStatusFilter,
  billingEventOutcomeFilter,
  billingEventProviderFilter,
  hostedEmailDeliveryProviderFilter,
  hostedEmailDeliveryStatusFilter,
  parseAdminListLimit,
  type AdminRouteDeps,
} from './admin-route-context.js';

export function registerAdminReadRoutes(app: Hono, deps: AdminRouteDeps): void {
  const {
    currentAdminAuthorized,
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
  } = deps;

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
