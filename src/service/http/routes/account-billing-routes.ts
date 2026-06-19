import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import type { AccountMutationAuditInput, AccountRouteDeps } from './account-routes.js';
import {
  hostedEmailDeliveryProviderFilter,
  hostedEmailDeliveryStatusFilter,
  readAccountJsonBody,
} from './account-route-helpers.js';
import {
  WORKFLOW_CONSEQUENCE_PACKS,
  getWorkflowBillingTier,
  type WorkflowBillingTierId,
  type WorkflowConsequencePackId,
} from '../../workflow-entitlement-catalog.js';
import {
  digestWorkflowMetadataRef,
  type StoredWorkflowEntitlementRecord,
  type WorkflowCheckoutAction,
} from '../../workflow-entitlement-store.js';

function isWorkflowCheckoutAction(value: string): value is WorkflowCheckoutAction {
  return value === 'create' || value === 'upgrade' || value === 'downgrade';
}

function workflowIdFromBody(body: Record<string, unknown>, action: WorkflowCheckoutAction): string {
  const provided = typeof body.workflowId === 'string' ? body.workflowId.trim() : '';
  if (provided) return provided;
  if (action !== 'create') return '';
  return `wf_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function workflowPackFromBody(body: Record<string, unknown>): WorkflowConsequencePackId | null {
  const value = typeof body.consequencePack === 'string' ? body.consequencePack.trim() : '';
  return WORKFLOW_CONSEQUENCE_PACKS.includes(value as WorkflowConsequencePackId)
    ? value as WorkflowConsequencePackId
    : null;
}

function workflowRefDigest(
  body: Record<string, unknown>,
  rawKey: 'downstreamSystemRef' | 'policyGatePathRef',
  digestKey: 'downstreamSystemRefDigest' | 'policyGatePathRefDigest',
): string | null {
  const providedDigest = typeof body[digestKey] === 'string' ? body[digestKey].trim() : '';
  if (providedDigest.startsWith('sha256:')) return providedDigest;
  const rawValue = typeof body[rawKey] === 'string' ? body[rawKey].trim() : '';
  return rawValue ? digestWorkflowMetadataRef(rawValue) : null;
}

function workflowEntitlementView(record: StoredWorkflowEntitlementRecord): Record<string, unknown> {
  return {
    workflowId: record.workflowId,
    accountId: record.accountId,
    tenantId: record.tenantId,
    tier: record.tier,
    status: record.status,
    consequencePack: record.consequencePack,
    stripeCustomerId: record.stripeCustomerId,
    stripeSubscriptionId: record.stripeSubscriptionId,
    stripeSubscriptionItemId: record.stripeSubscriptionItemId,
    stripePriceId: record.stripePriceId,
    stripeOveragePriceId: record.stripeOveragePriceId,
    downstreamSystemRefDigest: record.downstreamSystemRefDigest,
    policyGatePathRefDigest: record.policyGatePathRefDigest,
    includedAdmissionsMonthly: record.includedAdmissionsMonthly,
    monthlyAdmissionsUsed: record.monthlyAdmissionsUsed,
    admissionPeriod: record.admissionPeriod,
    customerGateProofPresent: record.customerGateProofPresent,
    lastCheckoutAction: record.lastCheckoutAction,
    lastCheckoutSessionId: record.lastCheckoutSessionId,
    lastCheckoutCompletedAt: record.lastCheckoutCompletedAt,
    lastEventId: record.lastEventId,
    lastEventType: record.lastEventType,
    lastEventAt: record.lastEventAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

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
    createHostedWorkflowCheckoutSession,
    listWorkflowEntitlements,
    findWorkflowEntitlementByTenantAndWorkflow,
    upsertPendingWorkflowEntitlement,
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

    await recordAccountSessionMutationAudit({
      routeId: 'account.billing.checkout',
      action: 'account.billing.checkout_started',
      access,
      requestPayload: {
        accountId: current.account.id,
        tenantId: current.tenant.tenantId,
        retired: true,
      },
      statusCode: 410,
      tenantId: current.tenant.tenantId,
      planId: null,
      metadata: {
        retired: true,
        replacementRoute: '/api/v1/account/billing/workflows/checkout',
      },
    });

    return c.json({
      accountId: current.account.id,
      tenantId: current.tenant.tenantId,
      error: 'Account-plan checkout is retired. Use workflow billing checkout.',
      replacementRoute: '/api/v1/account/billing/workflows/checkout',
      allowedWorkflowTiers: ['pilot-workflow', 'starter-workflow', 'pro-workflow'],
    }, 410);
  });

  app.get('/api/v1/account/billing/workflows', async (c) => {
    const roleGate = requireAccountSession(c, {
      roles: ['account_admin', 'billing_admin', 'read_only'],
    });
    if (roleGate) return roleGate;
    const current = await currentHostedAccount(c);
    if (current instanceof Response) return current;
    const status = c.req.query('status')?.trim();
    const limitRaw = c.req.query('limit')?.trim();
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const records = await listWorkflowEntitlements({
      accountId: current.account.id,
      tenantId: current.tenant.tenantId,
      status:
        status === 'active' ||
        status === 'trialing' ||
        status === 'past_due' ||
        status === 'canceled' ||
        status === 'incomplete'
          ? status
          : null,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return c.json({
      accountId: current.account.id,
      tenantId: current.tenant.tenantId,
      workflows: records.records.map(workflowEntitlementView),
      recordCount: records.records.length,
    });
  });

  app.post('/api/v1/account/billing/workflows/checkout', async (c) => {
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
      return c.json({ error: 'Idempotency-Key header is required for hosted workflow checkout.' }, 400);
    }

    const rawAction = typeof body.workflowAction === 'string'
      ? body.workflowAction.trim()
      : 'create';
    if (!isWorkflowCheckoutAction(rawAction)) {
      return c.json({ error: "workflowAction must be 'create', 'upgrade', or 'downgrade'." }, 400);
    }
    const workflowId = workflowIdFromBody(body, rawAction);
    if (!workflowId) {
      return c.json({ error: 'workflowId is required for workflow upgrade or downgrade checkout.' }, 400);
    }
    const tierId = typeof body.tier === 'string' ? body.tier.trim() : '';
    const tier = getWorkflowBillingTier(tierId);
    if (!tier) {
      return c.json({ error: 'tier must be pilot-workflow, starter-workflow, or pro-workflow.' }, 400);
    }
    const consequencePack = workflowPackFromBody(body);
    if (!consequencePack) {
      return c.json({ error: 'consequencePack is required and must be a known Attestor pack.' }, 400);
    }
    const downstreamSystemRefDigest = workflowRefDigest(
      body,
      'downstreamSystemRef',
      'downstreamSystemRefDigest',
    );
    const policyGatePathRefDigest = workflowRefDigest(
      body,
      'policyGatePathRef',
      'policyGatePathRefDigest',
    );
    if (!downstreamSystemRefDigest || !policyGatePathRefDigest) {
      return c.json({
        error: 'downstreamSystemRef and policyGatePathRef, or their sha256 digests, are required for workflow checkout.',
      }, 400);
    }

    const existing = await findWorkflowEntitlementByTenantAndWorkflow(
      current.tenant.tenantId,
      workflowId,
    );
    if (rawAction === 'create' && existing) {
      return c.json({ error: 'workflowId already exists for this tenant.' }, 409);
    }
    if (rawAction !== 'create' && !existing) {
      return c.json({ error: 'workflowId must already exist for upgrade or downgrade checkout.' }, 404);
    }

    let checkout;
    try {
      checkout = await createHostedWorkflowCheckoutSession({
        account: current.account,
        tenant: current.tenant,
        workflowAction: rawAction,
        workflowId,
        tier: tier.id as WorkflowBillingTierId,
        consequencePack,
        downstreamSystemRefDigest,
        policyGatePathRefDigest,
        idempotencyKey,
      });
    } catch (err) {
      const mapped = stripeBillingErrorResponse(c, err);
      if (mapped) return mapped;
      throw err;
    }
    const entitlement = await upsertPendingWorkflowEntitlement({
      accountId: current.account.id,
      tenantId: current.tenant.tenantId,
      workflowId,
      tier: checkout.tier,
      consequencePack,
      downstreamSystemRefDigest,
      policyGatePathRefDigest,
      stripeCustomerId: current.account.billing.stripeCustomerId,
      stripePriceId: checkout.stripePriceId,
      stripeOveragePriceId: checkout.stripeOveragePriceId,
      checkoutAction: checkout.workflowAction,
      checkoutSessionId: checkout.sessionId,
    });
    await recordAccountSessionMutationAudit({
      routeId: 'account.billing.workflow_checkout',
      action: 'account.billing.checkout_started',
      access,
      requestPayload: {
        accountId: current.account.id,
        tenantId: current.tenant.tenantId,
        workflowId,
        workflowAction: checkout.workflowAction,
        tier: checkout.tier,
        consequencePack,
        downstreamSystemRefDigest,
        policyGatePathRefDigest,
      },
      statusCode: 200,
      tenantId: current.tenant.tenantId,
      planId: checkout.tier,
      idempotencyKey,
      metadata: {
        mock: checkout.mock,
        workflowId,
        workflowAction: checkout.workflowAction,
        tier: checkout.tier,
        consequencePack,
      },
    });

    c.header('x-attestor-idempotency-key', idempotencyKey);
    return c.json({
      accountId: current.account.id,
      tenantId: current.tenant.tenantId,
      workflowId,
      workflowAction: checkout.workflowAction,
      tier: checkout.tier,
      consequencePack,
      stripePriceId: checkout.stripePriceId,
      stripeOveragePriceId: checkout.stripeOveragePriceId,
      checkoutSessionId: checkout.sessionId,
      checkoutUrl: checkout.url,
      mock: checkout.mock,
      entitlement: workflowEntitlementView(entitlement.record),
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
