import type { Hono } from 'hono';
import type { AccountMutationAuditInput, AccountRouteDeps } from './account-routes.js';
import {
  hostedEmailDeliveryProviderFilter,
  hostedEmailDeliveryStatusFilter,
  readAccountJsonBody,
} from './account-route-helpers.js';

export function registerAccountBillingRoutes(app: Hono, deps: AccountRouteDeps): void {
  const {
    stateService,
    currentHostedAccount,
    adminAccountView,
    requireAccountSession,
    currentAccountAccess,
    getTenantPipelineRateLimit,
    readHostedBillingEntitlement,
    buildHostedFeatureServiceView,
    getHostedPlan,
    createHostedCheckoutSession,
    stripeBillingErrorResponse,
    createHostedBillingPortalSession,
    buildHostedBillingExport,
    renderHostedBillingExportCsv,
    buildHostedBillingReconciliation,
    billingEntitlementView,
    currentTenant,
    recordAccountMutationAudit,
  } = deps;

  async function recordAccountSessionMutationAudit(input: AccountMutationAuditInput): Promise<void> {
    await recordAccountMutationAudit(input);
  }

  app.get('/api/v1/account/usage', async (c) => {
    const tenant = currentTenant(c);
    const usage = await stateService.getUsageContext(tenant.tenantId, tenant.planId, tenant.monthlyRunQuota);
    const rateLimit = await getTenantPipelineRateLimit(tenant.tenantId, tenant.planId);
    return c.json({
      tenantContext: {
        tenantId: tenant.tenantId,
        source: tenant.source,
        planId: tenant.planId,
      },
      usage,
      rateLimit,
    });
  });

  app.get('/api/v1/account', async (c) => {
    const current = await currentHostedAccount(c);
    if (current instanceof Response) return current;
    const entitlement = await readHostedBillingEntitlement(current.account);
    return c.json({
      account: adminAccountView(current.account),
      entitlement: billingEntitlementView(entitlement),
      tenantContext: {
        tenantId: current.tenant.tenantId,
        source: current.tenant.source,
        planId: current.tenant.planId,
      },
      usage: current.usage,
      rateLimit: current.rateLimit,
    });
  });

  app.get('/api/v1/account/entitlement', async (c) => {
    const current = await currentHostedAccount(c);
    if (current instanceof Response) return current;
    const entitlement = await readHostedBillingEntitlement(current.account);
    return c.json({
      entitlement: billingEntitlementView(entitlement),
    });
  });

  app.get('/api/v1/account/features', async (c) => {
    const current = await currentHostedAccount(c);
    if (current instanceof Response) return current;
    const entitlement = await readHostedBillingEntitlement(current.account);
    return c.json(buildHostedFeatureServiceView(entitlement));
  });

  app.get('/api/v1/account/email/deliveries', async (c) => {
    const unauthorized = requireAccountSession(c, {
      roles: ['account_admin', 'billing_admin'],
    });
    if (unauthorized) return unauthorized;
    const access = currentAccountAccess(c)!;
    const purpose = c.req.query('purpose')?.trim();
    const status = c.req.query('status')?.trim();
    const provider = c.req.query('provider')?.trim();
    const recipient = c.req.query('recipient')?.trim();
    const limitRaw = c.req.query('limit')?.trim();
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const statusFilter = hostedEmailDeliveryStatusFilter(status);
    const providerFilter = hostedEmailDeliveryProviderFilter(provider);
    const deliveries = await stateService.listHostedEmailDeliveries({
      accountId: access.accountId,
      purpose: purpose === 'invite' || purpose === 'password_reset' ? purpose : null,
      status: statusFilter,
      provider: providerFilter,
      recipient: recipient || null,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return c.json({
      accountId: access.accountId,
      records: deliveries.records,
      summary: {
        purposeFilter: purpose ?? null,
        statusFilter: status ?? null,
        providerFilter: provider ?? null,
        recipientFilter: recipient ?? null,
        recordCount: deliveries.records.length,
      },
    });
  });

  app.post('/api/v1/account/billing/checkout', async (c) => {
    const roleGate = requireAccountSession(c, {
      roles: ['account_admin', 'billing_admin'],
    });
    if (roleGate) return roleGate;
    const access = currentAccountAccess(c)!;
    const current = await currentHostedAccount(c);
    if (current instanceof Response) return current;

    const body = await readAccountJsonBody(c);
    if (body instanceof Response) return body;
    const idempotencyKey = c.req.header('Idempotency-Key')?.trim() ?? '';
    if (!idempotencyKey) {
      return c.json({ error: 'Idempotency-Key header is required for hosted checkout.' }, 400);
    }
    const requestedPlanId = typeof body.planId === 'string' ? body.planId.trim() : '';
    if (!requestedPlanId) {
      return c.json({ error: 'planId is required.' }, 400);
    }

    const plan = getHostedPlan(requestedPlanId);
    if (!plan || plan.intendedFor === 'evaluation') {
      return c.json({
        error: `Hosted billing checkout only supports hosted/enterprise plans. Valid hosted plans: starter, pro, scale, enterprise.`,
      }, 400);
    }

    let checkout;
    try {
      checkout = await createHostedCheckoutSession({
        account: current.account,
        tenant: current.tenant,
        plan,
        idempotencyKey,
      });
    } catch (err) {
      const mapped = stripeBillingErrorResponse(c, err);
      if (mapped) return mapped;
      throw err;
    }
    await recordAccountSessionMutationAudit({
      routeId: 'account.billing.checkout',
      action: 'account.billing.checkout_started',
      access,
      requestPayload: {
        accountId: current.account.id,
        tenantId: current.tenant.tenantId,
        planId: requestedPlanId,
      },
      statusCode: 200,
      tenantId: current.tenant.tenantId,
      planId: checkout.planId,
      idempotencyKey,
      metadata: {
        mock: checkout.mock,
      },
    });

    c.header('x-attestor-idempotency-key', idempotencyKey);
    return c.json({
      accountId: current.account.id,
      tenantId: current.tenant.tenantId,
      planId: checkout.planId,
      stripePriceId: checkout.stripePriceId,
      stripeOveragePriceId: checkout.stripeOveragePriceId,
      trialDays: checkout.trialDays,
      checkoutSessionId: checkout.sessionId,
      checkoutUrl: checkout.url,
      mock: checkout.mock,
    });
  });

  app.post('/api/v1/account/billing/portal', async (c) => {
    const roleGate = requireAccountSession(c, {
      roles: ['account_admin', 'billing_admin'],
    });
    if (roleGate) return roleGate;
    const access = currentAccountAccess(c)!;
    const current = await currentHostedAccount(c);
    if (current instanceof Response) return current;

    let portal;
    try {
      portal = await createHostedBillingPortalSession({
        account: current.account,
      });
    } catch (err) {
      const mapped = stripeBillingErrorResponse(c, err);
      if (mapped) return mapped;
      throw err;
    }
    await recordAccountSessionMutationAudit({
      routeId: 'account.billing.portal',
      action: 'account.billing.portal_started',
      access,
      requestPayload: {
        accountId: current.account.id,
        tenantId: current.tenant.tenantId,
      },
      statusCode: 200,
      tenantId: current.tenant.tenantId,
      metadata: {
        mock: portal.mock,
      },
    });

    return c.json({
      accountId: current.account.id,
      tenantId: current.tenant.tenantId,
      portalSessionId: portal.sessionId,
      portalUrl: portal.url,
      mock: portal.mock,
    });
  });

  app.get('/api/v1/account/billing/export', async (c) => {
    const current = await currentHostedAccount(c);
    if (current instanceof Response) return current;

    c.set('obs.accountId', current.account.id);
    c.set('obs.accountStatus', current.account.status);
    c.set('obs.tenantId', current.account.primaryTenantId);
    c.set('obs.planId', current.tenant.planId ?? current.account.billing.lastCheckoutPlanId ?? null);

    const format = (c.req.query('format')?.trim().toLowerCase() ?? 'json');
    if (format !== 'json' && format !== 'csv') {
      return c.json({ error: "format must be 'json' or 'csv'." }, 400);
    }

    const rawLimit = c.req.query('limit');
    const parsedLimit = rawLimit === undefined
      ? null
      : Number.parseInt(rawLimit, 10);
    if (rawLimit !== undefined && (parsedLimit === null || !Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      return c.json({ error: 'limit must be a positive integer.' }, 400);
    }

    const entitlement = await readHostedBillingEntitlement(current.account);
    const payload = await buildHostedBillingExport({
      account: current.account,
      entitlement,
      usage: current.usage,
      limit: parsedLimit ?? undefined,
    });
    const reconciliation = buildHostedBillingReconciliation(payload);

    if (format === 'csv') {
      c.header('content-type', 'text/csv; charset=utf-8');
      c.header('cache-control', 'no-store');
      c.header('content-disposition', `attachment; filename="${current.account.id}-billing-export.csv"`);
      return c.body(renderHostedBillingExportCsv(payload));
    }

    return c.json({
      ...payload,
      entitlement: billingEntitlementView(entitlement),
      reconciliation,
    });
  });

  app.get('/api/v1/account/billing/reconciliation', async (c) => {
    const roleGate = requireAccountSession(c, {
      roles: ['account_admin', 'billing_admin', 'read_only'],
    });
    if (roleGate) return roleGate;
    const current = await currentHostedAccount(c);
    if (current instanceof Response) return current;

    c.set('obs.accountId', current.account.id);
    c.set('obs.accountStatus', current.account.status);
    c.set('obs.tenantId', current.account.primaryTenantId);
    c.set('obs.planId', current.tenant.planId ?? current.account.billing.lastCheckoutPlanId ?? null);

    const rawLimit = c.req.query('limit');
    const parsedLimit = rawLimit === undefined
      ? null
      : Number.parseInt(rawLimit, 10);
    if (rawLimit !== undefined && (parsedLimit === null || !Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      return c.json({ error: 'limit must be a positive integer.' }, 400);
    }

    const entitlement = await readHostedBillingEntitlement(current.account);
    const payload = await buildHostedBillingExport({
      account: current.account,
      entitlement,
      usage: current.usage,
      limit: parsedLimit ?? undefined,
    });
    const reconciliation = buildHostedBillingReconciliation(payload);

    return c.json({
      accountId: current.account.id,
      tenantId: current.account.primaryTenantId,
      stripeCustomerId: current.account.billing.stripeCustomerId,
      stripeSubscriptionId: current.account.billing.stripeSubscriptionId,
      entitlement: billingEntitlementView(entitlement),
      reconciliation,
    });
  });
}
