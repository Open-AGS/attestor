import type { Context, Hono } from 'hono';
import {
  ADMIN_RELEASE_READ_ROLES,
  ADMIN_RELEASE_ROLES,
  adminDegradedModeActor,
  adminDegradedModeError,
  adminDegradedModeScope,
  adminDegradedModeStringArray,
  adminDegradedModeText,
  authorizeAdminRoute,
  beginAdminRouteMutation,
  createDegradedModeGrant,
  degradedModeGrantStatus,
  degradedModeGrantView,
  parseAdminListLimit,
  parseAdminJsonBody,
  type AdminMutationReadyResultWithActor,
  type AdminRouteDeps,
  type DegradedModeGrantState,
  type EnforcementBreakGlassReason,
  type EnforcementFailureReason,
  type ListDegradedModeGrantOptions,
} from './admin-route-context.js';

export function registerAdminReleaseEnforcementRoutes(app: Hono, deps: AdminRouteDeps): void {
  const {
    currentAdminAuthorized,
    adminMutationService,
    apiReleaseIntrospectionStore,
    releaseDegradedModeGrantStore: degradedModeGrantStore,
  } = deps;
  async function beginAdminMutation(
    context: Context,
    routeId: string,
    requestPayload: unknown,
  ): Promise<AdminMutationReadyResultWithActor | Response> {
    return beginAdminRouteMutation(adminMutationService, context, routeId, requestPayload);
  }


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
}
