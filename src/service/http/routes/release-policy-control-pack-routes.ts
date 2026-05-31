import type { Hono } from 'hono';
import type { PolicyPackMetadata } from '../../../release-policy-control-plane/index.js';
import { verifyIssuedPolicyBundle } from '../../../release-policy-control-plane/bundle-signing.js';
import {
  RELEASE_ADMIN_MUTATION_ROLES,
  auditEntryView,
  authorizeReleaseAdminRoute,
  beginMutation,
  bundleSummaryView,
  createPolicyMutationAuditSubjectFromBundle,
  createPolicyMutationAuditSubjectFromPack,
  finishMutation,
  noStore,
  optionalString,
  packView,
  parseBundleUpsertInput,
  parseJsonBody,
  parsePackMetadata,
  policyErrorResponse,
  publishStoreMetadata,
  routeAdminActor,
  type ReleasePolicyControlRouteDeps,
} from './release-policy-control-route-context.js';

export function registerReleasePolicyControlPackRoutes(app: Hono, deps: ReleasePolicyControlRouteDeps): void {
  const {
    policyControlPlaneStore: store,
    policyMutationAuditLog: auditLog,
  } = deps;

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
      if (input.signedBundle) {
        verifyIssuedPolicyBundle({
          issuedBundle: input.signedBundle,
          verificationKey: input.verificationKey ?? input.signedBundle.verificationKey,
        });
      }
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
}
