import type { Context, Hono } from 'hono';
import {
  ADMIN_ACCOUNT_ROLES,
  ADMIN_BILLING_ROLES,
  adminControlServiceErrorResponse,
  authorizeAdminRoute,
  beginAdminRouteMutation,
  parseAdminJsonBody,
  type AdminMutationReadyResultWithActor,
  type AdminRouteDeps,
} from './admin-route-context.js';

export function registerAdminAccountMutationRoutes(app: Hono, deps: AdminRouteDeps): void {
  const {
    currentAdminAuthorized,
    adminMutationService,
    adminControlService,
    DEFAULT_HOSTED_PLAN_ID,
    adminAccountView,
    adminTenantKeyView,
  } = deps;
  async function beginAdminMutation(
    context: Context,
    routeId: string,
    requestPayload: unknown,
  ): Promise<AdminMutationReadyResultWithActor | Response> {
    return beginAdminRouteMutation(adminMutationService, context, routeId, requestPayload);
  }


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
}
