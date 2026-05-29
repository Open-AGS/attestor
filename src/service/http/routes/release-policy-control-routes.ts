import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import type { PolicyPackMetadata } from '../../../release-policy-control-plane/index.js';
import {
  RELEASE_ADMIN_BREAK_GLASS_ROLES,
  RELEASE_ADMIN_MUTATION_ROLES,
  RELEASE_ADMIN_READ_ROLES,
  activatePolicyBundle,
  activationView,
  applyBundleCacheHeaders,
  applyPolicyLifecycle,
  approvalGateView,
  approvalRequestView,
  auditEntryView,
  authorizeReleaseAdminRoute,
  beginMutation,
  bundleDetailView,
  bundleSummaryView,
  createPolicyBundleConditionalResponse,
  createPolicyImpactApi,
  createPolicyMutationAuditSubjectFromActivation,
  createPolicyMutationAuditSubjectFromBundle,
  createPolicyMutationAuditSubjectFromPack,
  createPolicySimulationApi,
  evaluateActivationApprovalGate,
  filterAuditEntries,
  findLatestActiveExactTargetActivation,
  findRequiredBundle,
  finishMutation,
  freezePolicyActivationScope,
  isJsonRecord,
  noStore,
  optionalString,
  packView,
  paginateReleasePolicyList,
  parseActivationTarget,
  parseApprovalState,
  parseBundleUpsertInput,
  parseJsonBody,
  parsePackMetadata,
  parseRolloutMode,
  policyErrorResponse,
  publishStoreMetadata,
  recordActivationApprovalDecision,
  requestActivationApproval,
  requireBreakGlassAuthorization,
  requiredString,
  rollbackPolicyActivation,
  routeAdminActor,
  snapshotPolicyStore,
  type ReleasePolicyControlRouteDeps,
} from './release-policy-control-route-context.js';

export type { ReleasePolicyControlRouteDeps } from './release-policy-control-route-context.js';

export function registerReleasePolicyControlRoutes(app: Hono, deps: ReleasePolicyControlRouteDeps): void {
  const {
    policyControlPlaneStore: store,
    policyActivationApprovalStore: approvalStore,
    policyMutationAuditLog: auditLog,
  } = deps;

  app.get('/api/v1/admin/release-policy/control-plane', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const snapshot = await store.exportSnapshot();
    const auditVerification = await auditLog.verify();
    noStore(c);
    return c.json({
      storeKind: store.kind,
      metadata: snapshot.metadata,
      counts: {
        packs: snapshot.packs.length,
        bundles: snapshot.bundles.length,
        activations: snapshot.activations.length,
        activationApprovals: (await approvalStore.list()).length,
        auditEntries: (await auditLog.entries()).length,
      },
      audit: {
        valid: auditVerification.valid,
        latestEntryDigest: await auditLog.latestEntryDigest(),
      },
    });
  });

  app.get('/api/v1/admin/release-policy/packs', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const page = paginateReleasePolicyList(await store.listPacks(), c);
    if (page instanceof Response) return page;
    noStore(c);
    return c.json({
      packs: page.items.map(packView),
      pageInfo: page.pageInfo,
    });
  });

  app.post('/api/v1/admin/release-policy/packs', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_MUTATION_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseJsonBody(c);
    if (body instanceof Response) return body;
    const routeId = 'admin.release_policy.packs.upsert';
    const mutation = await beginMutation(c, deps, routeId, body);
    if (mutation instanceof Response) return mutation;

    try {
      const pack = parsePackMetadata(body.pack ?? body);
      const stored = await store.upsertPack(pack);
      const audit = await auditLog.append({
        occurredAt: new Date().toISOString(),
        action: 'create-pack',
        actor: routeAdminActor(c),
        subject: createPolicyMutationAuditSubjectFromPack(stored),
        reasonCode: optionalString(body, 'reasonCode') ?? 'upsert-pack',
        rationale: optionalString(body, 'rationale'),
        mutationSnapshot: stored,
      });
      const responseBody = {
        pack: packView(stored),
        audit: auditEntryView(audit, false),
      };
      const finalized = await finishMutation(deps, {
        ...mutation,
        routeId,
        requestPayload: body,
        statusCode: 200,
        responseBody,
        adminAuditAction: 'policy_pack.upserted',
        metadata: { packId: stored.id, auditEntryId: audit.entryId },
      });
      noStore(c);
      return c.json(finalized, 200);
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });

  app.get('/api/v1/admin/release-policy/packs/:packId', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const pack = await store.getPack(c.req.param('packId'));
    if (!pack) {
      return c.json({ error: `Policy pack '${c.req.param('packId')}' not found.` }, 404);
    }
    noStore(c);
    return c.json({ pack: packView(pack) });
  });

  app.get('/api/v1/admin/release-policy/packs/:packId/bundles', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const page = paginateReleasePolicyList(await store.listBundleHistory(c.req.param('packId')), c);
    if (page instanceof Response) return page;
    noStore(c);
    return c.json({
      packId: c.req.param('packId'),
      bundles: page.items.map(bundleSummaryView),
      pageInfo: page.pageInfo,
    });
  });

  app.get('/api/v1/admin/release-policy/packs/:packId/versions', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const history = await store.listBundleHistory(c.req.param('packId'));
    const page = paginateReleasePolicyList(history, c);
    if (page instanceof Response) return page;
    noStore(c);
    return c.json({
      packId: c.req.param('packId'),
      versions: page.items.map(bundleSummaryView),
      pageInfo: page.pageInfo,
    });
  });

  app.post('/api/v1/admin/release-policy/bundles', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_MUTATION_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseJsonBody(c);
    if (body instanceof Response) return body;
    const routeId = 'admin.release_policy.bundles.publish';
    const mutation = await beginMutation(c, deps, routeId, body);
    if (mutation instanceof Response) return mutation;

    try {
      const input = parseBundleUpsertInput(body);
      const pack = input.artifact.statement.predicate.pack as PolicyPackMetadata;
      await store.upsertPack({
        ...pack,
        latestBundleRef: input.manifest.bundle,
        updatedAt: input.storedAt ?? new Date().toISOString(),
      });
      const record = await store.upsertBundle(input);
      await publishStoreMetadata(store, record, null);
      const audit = await auditLog.append({
        occurredAt: new Date().toISOString(),
        action: 'publish-bundle',
        actor: routeAdminActor(c),
        subject: createPolicyMutationAuditSubjectFromBundle(record),
        reasonCode: optionalString(body, 'reasonCode') ?? 'publish-bundle',
        rationale: optionalString(body, 'rationale'),
        mutationSnapshot: record,
      });
      const responseBody = {
        bundle: bundleSummaryView(record),
        audit: auditEntryView(audit, false),
      };
      const finalized = await finishMutation(deps, {
        ...mutation,
        routeId,
        requestPayload: body,
        statusCode: 201,
        responseBody,
        adminAuditAction: 'policy_bundle.published',
        metadata: {
          packId: record.packId,
          bundleId: record.bundleId,
          auditEntryId: audit.entryId,
        },
      });
      noStore(c);
      return c.json(finalized, 201);
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });

  app.get('/api/v1/admin/release-policy/packs/:packId/bundles/:bundleId', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const record = await findRequiredBundle(store, c.req.param('packId'), c.req.param('bundleId'));
    if (!record) {
      return c.json({
        error: `Policy bundle '${c.req.param('bundleId')}' in pack '${c.req.param('packId')}' not found.`,
      }, 404);
    }
    const conditional = createPolicyBundleConditionalResponse(
      record,
      c.req.header('if-none-match'),
      {
        now: new Date().toISOString(),
        persisted: store.kind === 'file-backed' || store.kind === 'postgres',
      },
    );
    applyBundleCacheHeaders(c, conditional.descriptor);
    if (conditional.status === 'not-modified') {
      return c.body(null, 304);
    }
    return c.json({
      bundle: bundleDetailView(record, c),
      cache: conditional.descriptor,
    });
  });

  app.get('/api/v1/admin/release-policy/activation-approvals', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    try {
      const requests = await approvalStore.list({
        state: parseApprovalState(c.req.query('state')),
        targetLabel: c.req.query('targetLabel')?.trim() || null,
        packId: c.req.query('packId')?.trim() || null,
        bundleId: c.req.query('bundleId')?.trim() || null,
      });
      const page = paginateReleasePolicyList(requests, c);
      if (page instanceof Response) return page;
      noStore(c);
      return c.json({
        approvalRequests: page.items.map(approvalRequestView),
        pageInfo: page.pageInfo,
      });
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });

  app.post('/api/v1/admin/release-policy/activation-approvals', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_MUTATION_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseJsonBody(c);
    if (body instanceof Response) return body;
    const routeId = 'admin.release_policy.activation_approvals.request';
    const mutation = await beginMutation(c, deps, routeId, body);
    if (mutation instanceof Response) return mutation;

    try {
      const packId = requiredString(body, 'packId');
      const bundleId = requiredString(body, 'bundleId');
      const target = parseActivationTarget(body.target);
      const bundle = await findRequiredBundle(store, packId, bundleId);
      if (!bundle) {
        return c.json({ error: `Policy bundle '${bundleId}' in pack '${packId}' not found.` }, 404);
      }

      const approvalRequest = await requestActivationApproval(approvalStore, {
        id: optionalString(body, 'approvalRequestId') ?? undefined,
        target,
        bundleRecord: bundle,
        requestedBy: routeAdminActor(c),
        requestedAt: optionalString(body, 'requestedAt') ?? undefined,
        expiresAt: optionalString(body, 'expiresAt') ?? undefined,
        reasonCode: optionalString(body, 'reasonCode') ?? undefined,
        rationale:
          optionalString(body, 'rationale') ??
          `Request approval to activate policy bundle ${bundle.bundleId}.`,
      });
      const audit = await auditLog.append({
        occurredAt: new Date().toISOString(),
        action: 'request-activation-approval',
        actor: routeAdminActor(c),
        subject: {
          packId: approvalRequest.bundle.packId,
          bundleId: approvalRequest.bundle.bundleId,
          bundleVersion: approvalRequest.bundle.bundleVersion,
          activationId: null,
          targetLabel: approvalRequest.targetLabel,
        },
        reasonCode: approvalRequest.reasonCode,
        rationale: approvalRequest.rationale,
        mutationSnapshot: approvalRequest,
      });
      const responseBody = {
        approvalRequest: approvalRequestView(approvalRequest),
        audit: auditEntryView(audit, false),
      };
      const finalized = await finishMutation(deps, {
        ...mutation,
        routeId,
        requestPayload: body,
        statusCode: 201,
        responseBody,
        adminAuditAction: 'policy_activation.approval_requested',
        target,
        metadata: {
          packId,
          bundleId,
          approvalRequestId: approvalRequest.id,
          targetLabel: approvalRequest.targetLabel,
          auditEntryId: audit.entryId,
        },
      });
      noStore(c);
      return c.json(finalized, 201);
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });

  app.get('/api/v1/admin/release-policy/activation-approvals/:id', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const approvalRequest = await approvalStore.get(c.req.param('id'));
    if (!approvalRequest) {
      return c.json({
        error: `Policy activation approval request '${c.req.param('id')}' not found.`,
      }, 404);
    }
    noStore(c);
    return c.json({ approvalRequest: approvalRequestView(approvalRequest) });
  });

  app.post('/api/v1/admin/release-policy/activation-approvals/:id/approve', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_MUTATION_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseJsonBody(c);
    if (body instanceof Response) return body;
    const routeId = 'admin.release_policy.activation_approvals.approve';
    const mutation = await beginMutation(c, deps, routeId, body);
    if (mutation instanceof Response) return mutation;

    try {
      const approvalRequest = await recordActivationApprovalDecision(approvalStore, {
        requestId: c.req.param('id'),
        decision: 'approve',
        reviewer: routeAdminActor(c),
        decidedAt: optionalString(body, 'decidedAt') ?? undefined,
        rationale: optionalString(body, 'rationale') ?? 'Approve policy activation request.',
      });
      const latestDecision = approvalRequest.decisions.at(-1)!;
      const audit = await auditLog.append({
        occurredAt: new Date().toISOString(),
        action: 'approve-activation',
        actor: routeAdminActor(c),
        subject: {
          packId: approvalRequest.bundle.packId,
          bundleId: approvalRequest.bundle.bundleId,
          bundleVersion: approvalRequest.bundle.bundleVersion,
          activationId: null,
          targetLabel: approvalRequest.targetLabel,
        },
        reasonCode: approvalRequest.reasonCode,
        rationale: latestDecision.rationale,
        mutationSnapshot: approvalRequest,
      });
      const responseBody = {
        approvalRequest: approvalRequestView(approvalRequest),
        decision: latestDecision,
        audit: auditEntryView(audit, false),
      };
      const finalized = await finishMutation(deps, {
        ...mutation,
        routeId,
        requestPayload: body,
        statusCode: 200,
        responseBody,
        adminAuditAction: 'policy_activation.approval_approved',
        target: approvalRequest.target,
        metadata: {
          approvalRequestId: approvalRequest.id,
          targetLabel: approvalRequest.targetLabel,
          reviewerId: latestDecision.reviewer.id,
          auditEntryId: audit.entryId,
        },
      });
      noStore(c);
      return c.json(finalized, 200);
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });

  app.post('/api/v1/admin/release-policy/activation-approvals/:id/reject', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_MUTATION_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseJsonBody(c);
    if (body instanceof Response) return body;
    const routeId = 'admin.release_policy.activation_approvals.reject';
    const mutation = await beginMutation(c, deps, routeId, body);
    if (mutation instanceof Response) return mutation;

    try {
      const approvalRequest = await recordActivationApprovalDecision(approvalStore, {
        requestId: c.req.param('id'),
        decision: 'reject',
        reviewer: routeAdminActor(c),
        decidedAt: optionalString(body, 'decidedAt') ?? undefined,
        rationale: optionalString(body, 'rationale') ?? 'Reject policy activation request.',
      });
      const latestDecision = approvalRequest.decisions.at(-1)!;
      const audit = await auditLog.append({
        occurredAt: new Date().toISOString(),
        action: 'reject-activation',
        actor: routeAdminActor(c),
        subject: {
          packId: approvalRequest.bundle.packId,
          bundleId: approvalRequest.bundle.bundleId,
          bundleVersion: approvalRequest.bundle.bundleVersion,
          activationId: null,
          targetLabel: approvalRequest.targetLabel,
        },
        reasonCode: approvalRequest.reasonCode,
        rationale: latestDecision.rationale,
        mutationSnapshot: approvalRequest,
      });
      const responseBody = {
        approvalRequest: approvalRequestView(approvalRequest),
        decision: latestDecision,
        audit: auditEntryView(audit, false),
      };
      const finalized = await finishMutation(deps, {
        ...mutation,
        routeId,
        requestPayload: body,
        statusCode: 200,
        responseBody,
        adminAuditAction: 'policy_activation.approval_rejected',
        target: approvalRequest.target,
        metadata: {
          approvalRequestId: approvalRequest.id,
          targetLabel: approvalRequest.targetLabel,
          reviewerId: latestDecision.reviewer.id,
          auditEntryId: audit.entryId,
        },
      });
      noStore(c);
      return c.json(finalized, 200);
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });

  app.get('/api/v1/admin/release-policy/activations', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const targetLabel = c.req.query('targetLabel')?.trim();
    const state = c.req.query('state')?.trim();
    const activations = (await store
      .listActivations())
      .filter((record) => !targetLabel || record.targetLabel === targetLabel)
      .filter((record) => !state || record.state === state);
    const page = paginateReleasePolicyList(activations, c);
    if (page instanceof Response) return page;
    noStore(c);
    return c.json({
      activations: page.items.map(activationView),
      pageInfo: page.pageInfo,
    });
  });

  app.post('/api/v1/admin/release-policy/activations', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_MUTATION_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseJsonBody(c);
    if (body instanceof Response) return body;
    const routeId = 'admin.release_policy.activations.activate';
    const mutation = await beginMutation(c, deps, routeId, body);
    if (mutation instanceof Response) return mutation;

    try {
      const packId = requiredString(body, 'packId');
      const bundleId = requiredString(body, 'bundleId');
      const target = parseActivationTarget(body.target);
      const bundle = await findRequiredBundle(store, packId, bundleId);
      if (!bundle) {
        return c.json({ error: `Policy bundle '${bundleId}' in pack '${packId}' not found.` }, 404);
      }
      const approvalGate = await evaluateActivationApprovalGate(approvalStore, {
        target,
        bundleRecord: bundle,
        approvalRequestId: optionalString(body, 'approvalRequestId'),
        now: optionalString(body, 'activatedAt') ?? undefined,
      });
      if (!approvalGate.allowed) {
        return c.json({
          error: approvalGate.message,
          approval: approvalGateView(approvalGate),
        }, 409);
      }
      const lifecycle = await applyPolicyLifecycle(store, (localStore) => activatePolicyBundle(localStore, {
        id: optionalString(body, 'activationId') ?? `activation_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        target,
        bundle: bundle.manifest.bundle,
        activatedBy: routeAdminActor(c),
        activatedAt: optionalString(body, 'activatedAt') ?? new Date().toISOString(),
        rolloutMode: parseRolloutMode(body.rolloutMode),
        reasonCode: optionalString(body, 'reasonCode') ?? 'activate-bundle',
        rationale: optionalString(body, 'rationale') ?? `Activate policy bundle ${bundle.bundleId}.`,
      }));
      await publishStoreMetadata(store, bundle, lifecycle.appliedRecord.id);
      const audit = await auditLog.append({
        occurredAt: new Date().toISOString(),
        action: 'activate-bundle',
        actor: routeAdminActor(c),
        subject: createPolicyMutationAuditSubjectFromActivation(lifecycle.appliedRecord),
        reasonCode: lifecycle.appliedRecord.reasonCode,
        rationale: lifecycle.appliedRecord.rationale,
        mutationSnapshot: lifecycle,
      });
      const responseBody = {
        activation: activationView(lifecycle.appliedRecord),
        lifecycle,
        approval: approvalGateView(approvalGate),
        audit: auditEntryView(audit, false),
      };
      const finalized = await finishMutation(deps, {
        ...mutation,
        routeId,
        requestPayload: body,
        statusCode: 201,
        responseBody,
        adminAuditAction: 'policy_activation.activated',
        target,
        metadata: {
          packId,
          bundleId,
          activationId: lifecycle.appliedRecord.id,
          approvalRequestId: approvalGate.request?.id ?? null,
          targetLabel: lifecycle.targetLabel,
          auditEntryId: audit.entryId,
        },
      });
      noStore(c);
      return c.json(finalized, 201);
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });

  app.get('/api/v1/admin/release-policy/activations/:id', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const record = await store.getActivation(c.req.param('id'));
    if (!record) {
      return c.json({ error: `Policy activation '${c.req.param('id')}' not found.` }, 404);
    }
    noStore(c);
    return c.json({ activation: activationView(record) });
  });

  app.post('/api/v1/admin/release-policy/activations/:id/rollback', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_MUTATION_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseJsonBody(c);
    if (body instanceof Response) return body;
    const routeId = 'admin.release_policy.activations.rollback';
    const mutation = await beginMutation(c, deps, routeId, body);
    if (mutation instanceof Response) return mutation;

    try {
      const rollbackTarget = await store.getActivation(c.req.param('id'));
      if (!rollbackTarget) {
        return c.json({ error: `Policy activation '${c.req.param('id')}' not found.` }, 404);
      }
      const lifecycle = await applyPolicyLifecycle(store, (localStore) => rollbackPolicyActivation(localStore, {
        id: optionalString(body, 'activationId') ?? `rollback_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        target: rollbackTarget.target,
        rollbackTargetActivationId: rollbackTarget.id,
        activatedBy: routeAdminActor(c),
        activatedAt: optionalString(body, 'activatedAt') ?? new Date().toISOString(),
        reasonCode: optionalString(body, 'reasonCode') ?? 'rollback',
        rationale: optionalString(body, 'rationale') ?? `Rollback to policy activation ${rollbackTarget.id}.`,
      }));
      const bundle = await findRequiredBundle(
        store,
        lifecycle.appliedRecord.bundle.packId,
        lifecycle.appliedRecord.bundle.bundleId,
      );
      if (bundle) {
        await publishStoreMetadata(store, bundle, lifecycle.appliedRecord.id);
      }
      const audit = await auditLog.append({
        occurredAt: new Date().toISOString(),
        action: 'rollback-activation',
        actor: routeAdminActor(c),
        subject: createPolicyMutationAuditSubjectFromActivation(lifecycle.appliedRecord),
        reasonCode: lifecycle.appliedRecord.reasonCode,
        rationale: lifecycle.appliedRecord.rationale,
        mutationSnapshot: lifecycle,
      });
      const responseBody = {
        activation: activationView(lifecycle.appliedRecord),
        lifecycle,
        audit: auditEntryView(audit, false),
      };
      const finalized = await finishMutation(deps, {
        ...mutation,
        routeId,
        requestPayload: body,
        statusCode: 201,
        responseBody,
        adminAuditAction: 'policy_activation.rolled_back',
        target: lifecycle.appliedRecord.target,
        metadata: {
          rollbackTargetActivationId: rollbackTarget.id,
          activationId: lifecycle.appliedRecord.id,
          targetLabel: lifecycle.targetLabel,
          auditEntryId: audit.entryId,
        },
      });
      noStore(c);
      return c.json(finalized, 201);
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });

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
          : currentActive
            ? await findRequiredBundle(store, currentActive.bundle.packId, currentActive.bundle.bundleId)
            : null;
      if (!bundle) {
        return c.json({
          error: packId && bundleId
            ? `Policy bundle '${bundleId}' in pack '${packId}' not found.`
            : 'Emergency freeze requires an exact active activation or an explicit packId and bundleId.',
        }, packId && bundleId ? 404 : 400);
      }

      const lifecycle = await applyPolicyLifecycle(store, (localStore) => freezePolicyActivationScope(localStore, {
        id: optionalString(body, 'activationId') ?? `freeze_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        target,
        bundle: bundle.manifest.bundle,
        activatedBy: breakGlass.actor,
        activatedAt: optionalString(body, 'activatedAt') ?? new Date().toISOString(),
        reasonCode: breakGlass.reasonCode,
        rationale: breakGlass.rationale,
        freezeReason: optionalString(body, 'freezeReason') ?? breakGlass.rationale,
      }));
      await publishStoreMetadata(store, bundle, lifecycle.appliedRecord.id);
      const audit = await auditLog.append({
        occurredAt: new Date().toISOString(),
        action: 'freeze-scope',
        actor: breakGlass.actor,
        subject: createPolicyMutationAuditSubjectFromActivation(lifecycle.appliedRecord),
        reasonCode: lifecycle.appliedRecord.reasonCode,
        rationale: lifecycle.appliedRecord.rationale,
        mutationSnapshot: {
          lifecycle,
          breakGlass: {
            actor: breakGlass.actor,
            reasonCode: breakGlass.reasonCode,
            incidentId: breakGlass.incidentId,
          },
        },
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
      const lifecycle = await applyPolicyLifecycle(store, (localStore) => rollbackPolicyActivation(localStore, {
        id: optionalString(body, 'activationId') ?? `emergency_rollback_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        target: rollbackTarget.target,
        rollbackTargetActivationId: rollbackTarget.id,
        activatedBy: breakGlass.actor,
        activatedAt: optionalString(body, 'activatedAt') ?? new Date().toISOString(),
        reasonCode: breakGlass.reasonCode,
        rationale: breakGlass.rationale,
      }));
      const bundle = await findRequiredBundle(
        store,
        lifecycle.appliedRecord.bundle.packId,
        lifecycle.appliedRecord.bundle.bundleId,
      );
      if (bundle) {
        await publishStoreMetadata(store, bundle, lifecycle.appliedRecord.id);
      }
      const audit = await auditLog.append({
        occurredAt: new Date().toISOString(),
        action: 'rollback-activation',
        actor: breakGlass.actor,
        subject: createPolicyMutationAuditSubjectFromActivation(lifecycle.appliedRecord),
        reasonCode: lifecycle.appliedRecord.reasonCode,
        rationale: lifecycle.appliedRecord.rationale,
        mutationSnapshot: {
          lifecycle,
          breakGlass: {
            actor: breakGlass.actor,
            reasonCode: breakGlass.reasonCode,
            incidentId: breakGlass.incidentId,
          },
        },
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

  app.post('/api/v1/admin/release-policy/resolve', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_MUTATION_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseJsonBody(c);
    if (body instanceof Response) return body;
    try {
      const resolverInput = (body.resolverInput ?? body.input ?? body) as never;
      const result = createPolicySimulationApi(await snapshotPolicyStore(store)).resolveCurrent(resolverInput);
      noStore(c);
      return c.json({ resolution: result });
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });

  app.post('/api/v1/admin/release-policy/simulations', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_MUTATION_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseJsonBody(c);
    if (body instanceof Response) return body;
    try {
      const overlaySource = body.overlay;
      if (!isJsonRecord(overlaySource)) {
        return c.json({ error: 'overlay must be provided as an object.' }, 400);
      }
      const packId = requiredString(overlaySource, 'packId');
      const bundleId = requiredString(overlaySource, 'bundleId');
      const bundle = await findRequiredBundle(store, packId, bundleId);
      if (!bundle) {
        return c.json({ error: `Policy bundle '${bundleId}' in pack '${packId}' not found.` }, 404);
      }
      const resolverInput = (body.resolverInput ?? body.input) as never;
      if (!resolverInput) {
        return c.json({ error: 'resolverInput is required.' }, 400);
      }
      const preview = createPolicyImpactApi(await snapshotPolicyStore(store)).previewCandidateActivation(resolverInput, {
        bundleRecord: bundle,
        target: parseActivationTarget(overlaySource.target),
        discoveryMode: (optionalString(overlaySource, 'discoveryMode') ?? undefined) as never,
        activationId: optionalString(overlaySource, 'activationId') ?? undefined,
        actor: routeAdminActor(c),
        activatedAt: optionalString(overlaySource, 'activatedAt') ?? undefined,
        reasonCode: optionalString(overlaySource, 'reasonCode') ?? 'simulation',
        rationale:
          optionalString(overlaySource, 'rationale') ??
          `Simulate policy bundle ${bundle.bundleId}.`,
      });
      noStore(c);
      return c.json({ preview });
    } catch (error) {
      return policyErrorResponse(c, error);
    }
  });

  app.get('/api/v1/admin/release-policy/audit', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const entries = filterAuditEntries(await auditLog.entries(), c);
    if (entries instanceof Response) return entries;
    const includeSnapshots = c.req.query('includeSnapshots') === 'true';
    const verification = await auditLog.verify();
    noStore(c);
    return c.json({
      verification,
      latestEntryDigest: await auditLog.latestEntryDigest(),
      entries: entries.map((entry) => auditEntryView(entry, includeSnapshots)),
    });
  });

  app.get('/api/v1/admin/release-policy/audit/verify', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, deps.currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    noStore(c);
    return c.json({
      verification: await auditLog.verify(),
      latestEntryDigest: await auditLog.latestEntryDigest(),
    });
  });
}
