import type { Context, Hono } from 'hono';
import {
  ADMIN_KEY_ROLES,
  adminControlBillingEvent,
  adminControlServiceErrorResponse,
  authorizeAdminRoute,
  beginAdminRouteMutation,
  parseAdminJsonBody,
  type AdminMutationReadyResultWithActor,
  type AdminRouteDeps,
} from './admin-route-context.js';

export function registerAdminTenantKeyRoutes(app: Hono, deps: AdminRouteDeps): void {
  const {
    currentAdminAuthorized,
    adminMutationService,
    adminControlService,
    DEFAULT_HOSTED_PLAN_ID,
    adminTenantKeyView,
  } = deps;
  async function beginAdminMutation(
    context: Context,
    routeId: string,
    requestPayload: unknown,
  ): Promise<AdminMutationReadyResultWithActor | Response> {
    return beginAdminRouteMutation(adminMutationService, context, routeId, requestPayload);
  }


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
}
