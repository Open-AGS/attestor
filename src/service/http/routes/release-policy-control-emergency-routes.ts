import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import {
  RELEASE_ADMIN_BREAK_GLASS_ROLES,
  activationView,
  applyPolicyLifecycleMutation,
  auditEntryView,
  authorizeReleaseAdminRoute,
  beginMutation,
  createLifecycleMetadataPublisher,
  createLifecycleMetadataPublisherFromAppliedRecord,
  createPolicyMutationAuditSubjectFromActivation,
  findLatestActiveExactTargetActivation,
  findRequiredBundle,
  finishMutation,
  freezePolicyActivationScope,
  noStore,
  optionalString,
  parseActivationTarget,
  parseJsonBody,
  policyErrorResponse,
  requireBreakGlassAuthorization,
  requiredString,
  rollbackPolicyActivation,
  snapshotPolicyStore,
  type ReleasePolicyControlRouteDeps,
} from './release-policy-control-route-context.js';

export function registerReleasePolicyControlEmergencyRoutes(app: Hono, deps: ReleasePolicyControlRouteDeps): void {
  const {
    policyControlPlaneStore: store,
    policyMutationAuditLog: auditLog,
  } = deps;

  app.post('/api/v1/admin/release-policy/emergency/freeze', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_BREAK_GLASS_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseJsonBody(c);
    if (body instanceof Response) return body;
    const breakGlass = requireBreakGlassAuthorization(c, body);
    if (breakGlass instanceof Response) return breakGlass;
    const routeId = 'admin.release_policy.emergency.freeze';
    const mutation = await beginMutation(c, deps, routeId, body);
    if (mutation instanceof Response) return mutation;

    try {
      const target = parseActivationTarget(body.target);
      const packId = optionalString(body, 'packId');
      const bundleId = optionalString(body, 'bundleId');
      if ((packId && !bundleId) || (!packId && bundleId)) {
        return c.json({ error: 'Emergency freeze requires both packId and bundleId when either is provided.' }, 400);
      }

      const currentActive = findLatestActiveExactTargetActivation(await snapshotPolicyStore(store), target);
      const bundle =
        packId && bundleId
          ? await findRequiredBundle(store, packId, bundleId)
          : null;
      if (!bundle && (!currentActive || packId || bundleId)) {
        return c.json({
          error: packId && bundleId
            ? `Policy bundle '${bundleId}' in pack '${packId}' not found.`
            : 'Emergency freeze requires an exact active activation or an explicit packId and bundleId.',
        }, packId && bundleId ? 404 : 400);
      }

      const createMetadata = bundle
        ? createLifecycleMetadataPublisher(store.kind, bundle)
        : createLifecycleMetadataPublisherFromAppliedRecord(store.kind);

      const { lifecycle, audit } = await applyPolicyLifecycleMutation({
        store,
        auditLog,
        requireAtomicLifecycle: deps.requireAtomicPolicyLifecycle === true,
        action: (localStore) => freezePolicyActivationScope(localStore, {
          id: optionalString(body, 'activationId') ?? `freeze_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
          target,
          bundle: bundle?.manifest.bundle,
          activatedBy: breakGlass.actor,
          activatedAt: optionalString(body, 'activatedAt') ?? new Date().toISOString(),
          reasonCode: breakGlass.reasonCode,
          rationale: breakGlass.rationale,
          freezeReason: optionalString(body, 'freezeReason') ?? breakGlass.rationale,
        }),
        createMetadata,
        createAudit: (nextLifecycle) => ({
          occurredAt: new Date().toISOString(),
          action: 'freeze-scope',
          actor: breakGlass.actor,
          subject: createPolicyMutationAuditSubjectFromActivation(nextLifecycle.appliedRecord),
          reasonCode: nextLifecycle.appliedRecord.reasonCode,
          rationale: nextLifecycle.appliedRecord.rationale,
          mutationSnapshot: {
            lifecycle: nextLifecycle,
            breakGlass: {
              actor: breakGlass.actor,
              reasonCode: breakGlass.reasonCode,
              incidentId: breakGlass.incidentId,
            },
          },
        }),
      });
      const responseBody = {
        activation: activationView(lifecycle.appliedRecord),
        lifecycle,
        breakGlass: {
          actor: breakGlass.actor,
          reasonCode: breakGlass.reasonCode,
          incidentId: breakGlass.incidentId,
        },
        audit: auditEntryView(audit, false),
      };
      const finalized = await finishMutation(deps, {
        ...mutation,
        routeId,
        requestPayload: body,
        statusCode: 201,
        responseBody,
        adminAuditAction: 'policy_activation.emergency_frozen',
        target: lifecycle.appliedRecord.target,
        metadata: {
          activationId: lifecycle.appliedRecord.id,
          previousActivationId: lifecycle.appliedRecord.previousActivationId,
          targetLabel: lifecycle.targetLabel,
          auditEntryId: audit.entryId,
          incidentId: breakGlass.incidentId,
        },
      });
      noStore(c);
      return c.json(finalized, 201);
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });

  app.post('/api/v1/admin/release-policy/emergency/rollback', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_BREAK_GLASS_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseJsonBody(c);
    if (body instanceof Response) return body;
    const breakGlass = requireBreakGlassAuthorization(c, body);
    if (breakGlass instanceof Response) return breakGlass;
    const routeId = 'admin.release_policy.emergency.rollback';
    const mutation = await beginMutation(c, deps, routeId, body);
    if (mutation instanceof Response) return mutation;

    try {
      const rollbackTargetId = requiredString(body, 'rollbackTargetActivationId');
      const rollbackTarget = await store.getActivation(rollbackTargetId);
      if (!rollbackTarget) {
        return c.json({ error: `Policy activation '${rollbackTargetId}' not found.` }, 404);
      }
      const bundle = await findRequiredBundle(
        store,
        rollbackTarget.bundle.packId,
        rollbackTarget.bundle.bundleId,
      );
      if (!bundle) {
        return c.json({
          error: `Policy bundle '${rollbackTarget.bundle.bundleId}' in pack '${rollbackTarget.bundle.packId}' not found.`,
        }, 404);
      }
      const { lifecycle, audit } = await applyPolicyLifecycleMutation({
        store,
        auditLog,
        requireAtomicLifecycle: deps.requireAtomicPolicyLifecycle === true,
        action: (localStore) => rollbackPolicyActivation(localStore, {
          id: optionalString(body, 'activationId') ?? `emergency_rollback_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
          target: rollbackTarget.target,
          rollbackTargetActivationId: rollbackTarget.id,
          activatedBy: breakGlass.actor,
          activatedAt: optionalString(body, 'activatedAt') ?? new Date().toISOString(),
          reasonCode: breakGlass.reasonCode,
          rationale: breakGlass.rationale,
        }),
        createMetadata: createLifecycleMetadataPublisher(store.kind, bundle),
        createAudit: (nextLifecycle) => ({
          occurredAt: new Date().toISOString(),
          action: 'rollback-activation',
          actor: breakGlass.actor,
          subject: createPolicyMutationAuditSubjectFromActivation(nextLifecycle.appliedRecord),
          reasonCode: nextLifecycle.appliedRecord.reasonCode,
          rationale: nextLifecycle.appliedRecord.rationale,
          mutationSnapshot: {
            lifecycle: nextLifecycle,
            breakGlass: {
              actor: breakGlass.actor,
              reasonCode: breakGlass.reasonCode,
              incidentId: breakGlass.incidentId,
            },
          },
        }),
      });
      const responseBody = {
        activation: activationView(lifecycle.appliedRecord),
        lifecycle,
        breakGlass: {
          actor: breakGlass.actor,
          reasonCode: breakGlass.reasonCode,
          incidentId: breakGlass.incidentId,
        },
        audit: auditEntryView(audit, false),
      };
      const finalized = await finishMutation(deps, {
        ...mutation,
        routeId,
        requestPayload: body,
        statusCode: 201,
        responseBody,
        adminAuditAction: 'policy_activation.emergency_rolled_back',
        target: lifecycle.appliedRecord.target,
        metadata: {
          rollbackTargetActivationId: rollbackTarget.id,
          activationId: lifecycle.appliedRecord.id,
          replacedActivationId: lifecycle.currentActiveRecord?.id ?? null,
          targetLabel: lifecycle.targetLabel,
          auditEntryId: audit.entryId,
          incidentId: breakGlass.incidentId,
        },
      });
      noStore(c);
      return c.json(finalized, 201);
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });
}
