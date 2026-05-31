import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { generateKeyPair } from '../src/signing/keys.js';
import {
  createPolicyBundleEntry,
  createPolicyBundleManifest,
  createPolicyPackMetadata,
} from '../src/release-policy-control-plane/object-model.js';
import {
  computePolicyBundleEntryDigest,
  createSignablePolicyBundleArtifact,
} from '../src/release-policy-control-plane/bundle-format.js';
import { createPolicyBundleSigner } from '../src/release-policy-control-plane/bundle-signing.js';
import {
  createInMemoryPolicyControlPlaneStore,
  type PolicyControlPlaneStore,
} from '../src/release-policy-control-plane/store.js';
import {
  createInMemoryPolicyActivationApprovalStore,
  requestPolicyActivationApproval,
  type PolicyActivationApprovalStore,
} from '../src/release-policy-control-plane/activation-approvals.js';
import {
  createInMemoryPolicyMutationAuditLogWriter,
  type PolicyMutationAuditLogWriter,
} from '../src/release-policy-control-plane/audit-log.js';
import { createPolicyActivationTarget } from '../src/release-policy-control-plane/types.js';
import { registerReleasePolicyControlRoutes } from '../src/service/http/routes/release-policy-control-routes.js';
import { policy } from '../src/release-layer/index.js';
import { currentAdminAuthorized } from '../src/service/request-context.js';
import { resetReleaseAdminRouteAuthLimiterForTests } from '../src/service/http/release-admin-authorization.js';

type TestAppFixture = {
  app: Hono;
  store: PolicyControlPlaneStore;
  approvalStore: PolicyActivationApprovalStore;
  auditLog: PolicyMutationAuditLogWriter;
  adminAuditRecords: Array<Record<string, unknown>>;
};

function adminHeaders(extra?: Record<string, string>, token = 'admin-secret'): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    ...extra,
  };
}

function sampleBundleReference(bundleId = 'bundle_finance_core_2026_04_18') {
  return {
    packId: 'finance-core',
    bundleId,
    bundleVersion: bundleId.replace('bundle_', '').replaceAll('_', '.'),
    digest: `sha256:${bundleId}`,
  } as const;
}

function samplePackMetadata(bundleId = 'bundle_finance_core_2026_04_18') {
  return createPolicyPackMetadata({
    id: 'finance-core',
    name: 'Finance Core',
    description: 'Finance release policy pack.',
    lifecycleState: 'published',
    owners: ['risk-platform'],
    labels: ['finance', 'release-gateway'],
    createdAt: '2026-04-18T09:00:00.000Z',
    latestBundleRef: sampleBundleReference(bundleId),
  });
}

function sampleSecondaryPackMetadata(id: string, name: string) {
  const bundleId = `bundle_${id.replaceAll('-', '_')}_2026_04_18`;
  return createPolicyPackMetadata({
    id,
    name,
    description: `${name} release policy pack.`,
    lifecycleState: 'draft',
    owners: ['risk-platform'],
    labels: ['release-gateway'],
    createdAt: '2026-04-18T09:00:00.000Z',
    latestBundleRef: {
      packId: id,
      bundleId,
      bundleVersion: bundleId.replace('bundle_', '').replaceAll('_', '.'),
      digest: `sha256:${bundleId}`,
    },
  });
}

function createEntry() {
  const definition = policy.createFirstHardGatewayReleasePolicy();
  const target = createPolicyActivationTarget({
    environment: 'prod-eu',
    tenantId: 'tenant-finance',
    accountId: 'account-major',
    domainId: 'finance',
    wedgeId: 'finance.record.release',
    consequenceType: 'record',
    riskClass: 'R4',
    planId: 'enterprise',
  });
  const provisional = createPolicyBundleEntry({
    id: 'entry-record-r4',
    scopeTarget: target,
    definition,
    policyHash: 'sha256:placeholder',
  });

  return createPolicyBundleEntry({
    id: 'entry-record-r4',
    scopeTarget: target,
    definition,
    policyHash: computePolicyBundleEntryDigest(provisional),
  });
}

function createSignedBundle(bundleId = 'bundle_finance_core_2026_04_18') {
  const pack = samplePackMetadata(bundleId);
  const manifest = createPolicyBundleManifest({
    bundle: sampleBundleReference(bundleId),
    pack,
    generatedAt: '2026-04-18T09:05:00.000Z',
    entries: [createEntry()],
  });
  const artifact = createSignablePolicyBundleArtifact(pack, manifest);
  const keyPair = generateKeyPair();
  const signer = createPolicyBundleSigner({
    issuer: 'attestor.policy-control-plane',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
  const signedBundle = signer.sign({
    artifact,
    signedAt: '2026-04-18T09:06:00.000Z',
  });

  return {
    pack,
    manifest,
    artifact,
    signedBundle,
    verificationKey: signer.exportVerificationKey(),
  };
}

function sampleTarget() {
  return {
    environment: 'prod-eu',
    tenantId: 'tenant-finance',
    accountId: 'account-major',
    domainId: 'finance',
    wedgeId: 'finance.record.release',
    consequenceType: 'record',
    riskClass: 'R4',
    planId: 'enterprise',
  } as const;
}

function sampleResolverInput() {
  return {
    target: sampleTarget(),
    outputContract: {
      artifactType: 'financial-reporting.record-field',
      expectedShape: 'structured financial record payload',
      consequenceType: 'record',
      riskClass: 'R4',
    },
    capabilityBoundary: {
      allowedTools: ['record-commit'],
      allowedTargets: ['finance.reporting.record-store'],
      allowedDataDomains: ['financial-reporting'],
    },
    targetKind: 'record-store',
    rolloutContext: {
      requestId: 'req_policy_admin_route',
      outputHash: 'sha256:output',
      requesterId: 'user_policy_admin',
      targetId: 'finance.reporting.record-store',
    },
  } as const;
}

function createFixture(options?: { idempotency?: boolean; finalizeError?: Error }): TestAppFixture {
  resetReleaseAdminRouteAuthLimiterForTests();
  const app = new Hono();
  const store = createInMemoryPolicyControlPlaneStore();
  const approvalStore = createInMemoryPolicyActivationApprovalStore();
  const auditLog = createInMemoryPolicyMutationAuditLogWriter();
  const adminAuditRecords: Array<Record<string, unknown>> = [];
  const idempotency = new Map<string, {
    routeId: string;
    requestHash: string;
    statusCode: number;
    responseBody: Record<string, unknown>;
  }>();

  registerReleasePolicyControlRoutes(app, {
    currentAdminAuthorized,
    policyControlPlaneStore: store,
    policyActivationApprovalStore: approvalStore,
    policyMutationAuditLog: auditLog,
    adminMutationRequest: options?.idempotency
      ? async (c, routeId, requestPayload) => {
          const idempotencyKey = c.req.header('Idempotency-Key')?.trim() ?? null;
          const requestHash = JSON.stringify({ routeId, requestPayload });
          if (!idempotencyKey) {
            return { idempotencyKey, requestHash };
          }
          const existing = idempotency.get(idempotencyKey);
          if (!existing) {
            return { idempotencyKey, requestHash };
          }
          if (existing.routeId !== routeId || existing.requestHash !== requestHash) {
            return c.json({ error: 'idempotency conflict' }, 409);
          }
          return new Response(JSON.stringify(existing.responseBody), {
            status: existing.statusCode,
            headers: {
              'content-type': 'application/json; charset=UTF-8',
              'x-attestor-idempotent-replay': 'true',
            },
          });
        }
      : undefined,
    finalizeAdminMutation: options?.finalizeError
      ? async () => {
          throw options.finalizeError;
        }
      : options?.idempotency
      ? async (input) => {
          if (input.idempotencyKey) {
            idempotency.set(input.idempotencyKey, {
              routeId: input.routeId,
              requestHash: input.audit.requestHash ?? '',
              statusCode: input.statusCode,
              responseBody: input.responseBody,
            });
          }
          adminAuditRecords.push(input.audit);
          return input.responseBody;
        }
      : undefined,
  });

  return { app, store, approvalStore, auditLog, adminAuditRecords };
}

async function requestJson(
  app: Hono,
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<{ status: number; headers: Headers; body: any }> {
  const response = await app.request(path, {
    method: options?.method ?? 'GET',
    headers: options?.headers ?? adminHeaders(),
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.json();
  return {
    status: response.status,
    headers: response.headers,
    body,
  };
}

async function publishBundleThroughRoutes(
  fixture: TestAppFixture,
  bundleId = 'bundle_finance_core_2026_04_18',
) {
  const bundle = createSignedBundle(bundleId);
  await requestJson(fixture.app, '/api/v1/admin/release-policy/packs', {
    method: 'POST',
    body: { pack: bundle.pack },
  });
  await requestJson(fixture.app, '/api/v1/admin/release-policy/bundles', {
    method: 'POST',
    body: {
      manifest: bundle.manifest,
      artifact: bundle.artifact,
      signedBundle: bundle.signedBundle,
      verificationKey: bundle.verificationKey,
      storedAt: '2026-04-18T09:07:00.000Z',
    },
  });
  return bundle;
}

async function requestAndApproveActivation(fixture: TestAppFixture): Promise<string> {
  const bundle = await fixture.store.getBundle('finance-core', 'bundle_finance_core_2026_04_18');
  assert.notEqual(bundle, null);
  const request = requestPolicyActivationApproval(fixture.approvalStore, {
    id: 'approval_prod_current',
    target: createPolicyActivationTarget(sampleTarget()),
    bundleRecord: bundle!,
    requestedBy: {
      id: 'external-change-manager',
      type: 'user',
      displayName: 'External Change Manager',
      role: 'policy-admin',
    },
    requestedAt: '2026-04-18T09:08:00.000Z',
    expiresAt: '2026-04-19T09:08:00.000Z',
    rationale: 'Request policy activation approval.',
  });
  assert.equal(request.state, 'pending');
  assert.equal(request.requirement.requiredApprovals, 2);

  const first = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/activation-approvals/approval_prod_current/approve',
    {
      method: 'POST',
      headers: adminHeaders({
        'x-attestor-admin-actor-id': 'risk_owner',
        'x-attestor-policy-actor-role': 'risk-owner',
      }, 'admin-release-secret'),
      body: {
        rationale: 'Risk owner approves activation.',
        decidedAt: '2026-04-18T09:09:00.000Z',
      },
    },
  );
  assert.equal(first.status, 200);
  assert.equal(first.body.approvalRequest.state, 'pending');
  assert.equal(first.body.decision.reviewer.id, 'admin-credential:admin-release-admin');
  assert.equal(first.body.decision.reviewer.role, 'policy-admin');

  const second = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/activation-approvals/approval_prod_current/approve',
    {
      method: 'POST',
      headers: adminHeaders({
        'x-attestor-admin-actor-id': 'compliance_officer',
        'x-attestor-policy-actor-role': 'compliance-officer',
      }, 'admin-secret'),
      body: {
        rationale: 'Compliance approves activation.',
        decidedAt: '2026-04-18T09:10:00.000Z',
      },
    },
  );
  assert.equal(second.status, 200);
  assert.equal(second.body.approvalRequest.state, 'approved');
  assert.equal(second.body.decision.reviewer.id, 'admin-credential:admin-superuser');
  assert.equal(second.body.decision.reviewer.role, 'policy-admin');

  return 'approval_prod_current';
}

async function testAdminAuthIsRequired(): Promise<void> {
  const fixture = createFixture();
  const response = await requestJson(fixture.app, '/api/v1/admin/release-policy/packs', {
    headers: { Authorization: 'Bearer wrong' },
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Valid admin API key required in Authorization header.');
}

async function testRoleScopedAdminKeysCannotEscalateThroughActorHeader(): Promise<void> {
  const fixture = createFixture();

  const readCanList = await requestJson(fixture.app, '/api/v1/admin/release-policy/packs', {
    headers: adminHeaders(undefined, 'admin-read-secret'),
  });
  const readCannotMutate = await requestJson(fixture.app, '/api/v1/admin/release-policy/packs', {
    method: 'POST',
    headers: adminHeaders({
      'x-attestor-admin-actor-role': 'admin-release-admin',
    }, 'admin-read-secret'),
  });
  const readCannotMutateWithPolicyActorLabel = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/packs',
    {
      method: 'POST',
      headers: adminHeaders({
        'x-attestor-policy-actor-role': 'policy-admin',
      }, 'admin-read-secret'),
    },
  );
  const releaseAdminCannotBreakGlass = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/emergency/freeze',
    {
      method: 'POST',
      headers: adminHeaders({
        'x-attestor-admin-actor-id': 'release_admin_attempt',
        'x-attestor-policy-actor-role': 'policy-break-glass',
        'x-attestor-break-glass': 'true',
      }, 'admin-release-secret'),
    },
  );

  assert.equal(readCanList.status, 200);
  assert.equal(readCannotMutate.status, 403);
  assert.equal(
    readCannotMutate.body.error,
    'Admin actor role does not match the role-scoped admin API key.',
  );
  assert.equal(readCannotMutateWithPolicyActorLabel.status, 403);
  assert.equal(
    readCannotMutateWithPolicyActorLabel.body.error,
    "Admin actor role 'admin-read' is not allowed for this route.",
  );
  assert.equal(releaseAdminCannotBreakGlass.status, 403);
  assert.equal(
    releaseAdminCannotBreakGlass.body.error,
    "Admin actor role 'admin-release-admin' is not allowed for this route.",
  );
}

async function testPackAndBundleSurfaces(): Promise<void> {
  const fixture = createFixture();
  const bundle = await publishBundleThroughRoutes(fixture);

  const packs = await requestJson(fixture.app, '/api/v1/admin/release-policy/packs');
  const versions = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/packs/finance-core/versions',
  );
  const detail = await requestJson(
    fixture.app,
    `/api/v1/admin/release-policy/packs/finance-core/bundles/${bundle.manifest.bundle.bundleId}`,
  );

  assert.equal(packs.status, 200);
  assert.equal(packs.body.packs.length, 1);
  assert.equal(versions.body.versions.length, 1);
  assert.equal(versions.body.versions[0].signed, true);
  assert.equal(detail.body.bundle.signedBundle, null);
  assert.equal(detail.body.bundle.artifact.payloadDigest, bundle.artifact.payloadDigest);
}

async function testBundleDetailSupportsCacheHeadersAndConditionalRevalidation(): Promise<void> {
  const fixture = createFixture();
  const bundle = await publishBundleThroughRoutes(fixture);
  const path =
    `/api/v1/admin/release-policy/packs/finance-core/bundles/` +
    bundle.manifest.bundle.bundleId;
  const first = await requestJson(fixture.app, path);
  const etag = first.headers.get('etag');
  const second = await fixture.app.request(path, {
    method: 'GET',
    headers: adminHeaders({
      'if-none-match': etag ?? '',
    }),
  });

  assert.equal(first.status, 200);
  assert.ok(etag);
  assert.equal(first.headers.get('cache-control'), 'private, max-age=60, stale-if-error=300');
  assert.equal(first.headers.get('vary'), 'Authorization');
  assert.equal(first.headers.get('x-attestor-policy-bundle-freshness'), 'fresh');
  assert.equal(first.body.cache.etag, etag);
  assert.equal(second.status, 304);
  assert.equal(second.headers.get('etag'), etag);
}

async function testActivationRequiresApprovalForR4(): Promise<void> {
  const fixture = createFixture();
  await publishBundleThroughRoutes(fixture);

  const activation = await requestJson(fixture.app, '/api/v1/admin/release-policy/activations', {
    method: 'POST',
    body: {
      activationId: 'activation_prod_current',
      packId: 'finance-core',
      bundleId: 'bundle_finance_core_2026_04_18',
      target: sampleTarget(),
      rationale: 'Promote finance record release policy.',
    },
  });

  assert.equal(activation.status, 409);
  assert.equal(activation.body.approval.status, 'approval-required');
  assert.equal(fixture.store.listActivations().length, 0);
}

async function testApprovalRoutesEnforceDualReview(): Promise<void> {
  const fixture = createFixture();
  await publishBundleThroughRoutes(fixture);
  const approvalRequestId = await requestAndApproveActivation(fixture);
  const listed = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/activation-approvals?state=approved',
  );

  assert.equal(approvalRequestId, 'approval_prod_current');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.approvalRequests.length, 1);
  assert.deepEqual(
    listed.body.approvalRequests[0].approvedReviewerIds,
    ['admin-credential:admin-release-admin', 'admin-credential:admin-superuser'],
  );
}

async function testActivationAndRollbackSurfaces(): Promise<void> {
  const fixture = createFixture();
  await publishBundleThroughRoutes(fixture);
  const approvalRequestId = await requestAndApproveActivation(fixture);

  const activation = await requestJson(fixture.app, '/api/v1/admin/release-policy/activations', {
    method: 'POST',
    body: {
      activationId: 'activation_prod_current',
      packId: 'finance-core',
      bundleId: 'bundle_finance_core_2026_04_18',
      approvalRequestId,
      target: sampleTarget(),
      activatedAt: '2026-04-18T09:11:00.000Z',
      rationale: 'Promote finance record release policy.',
    },
  });
  const rollback = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/activations/activation_prod_current/rollback',
    {
      method: 'POST',
      body: {
        activationId: 'activation_prod_rollback',
        rationale: 'Exercise rollback route.',
      },
    },
  );
  const activations = await requestJson(fixture.app, '/api/v1/admin/release-policy/activations');

  assert.equal(activation.status, 201);
  assert.equal(activation.body.activation.state, 'active');
  assert.equal(rollback.status, 201);
  assert.equal(rollback.body.activation.operationType, 'rollback-activation');
  assert.equal(activations.body.activations.length, 2);
  assert.deepEqual(
    fixture.auditLog.entries().map((entry) => entry.action),
    [
      'create-pack',
      'publish-bundle',
      'approve-activation',
      'approve-activation',
      'activate-bundle',
      'rollback-activation',
    ],
  );
}

async function testEmergencyFreezeAndRollbackRequireBreakGlassAndFailClosed(): Promise<void> {
  const fixture = createFixture({ idempotency: true });
  await publishBundleThroughRoutes(fixture);
  const approvalRequestId = await requestAndApproveActivation(fixture);
  await requestJson(fixture.app, '/api/v1/admin/release-policy/activations', {
    method: 'POST',
    body: {
      activationId: 'activation_prod_current',
      packId: 'finance-core',
      bundleId: 'bundle_finance_core_2026_04_18',
      approvalRequestId,
      target: sampleTarget(),
      activatedAt: '2026-04-18T09:11:00.000Z',
      rationale: 'Promote finance record release policy.',
    },
  });

  const blockedFreeze = await requestJson(fixture.app, '/api/v1/admin/release-policy/emergency/freeze', {
    method: 'POST',
    headers: adminHeaders({
      'x-attestor-admin-actor-id': 'ordinary_policy_admin',
      'x-attestor-policy-actor-role': 'policy-break-glass',
    }, 'admin-release-secret'),
    body: {
      activationId: 'freeze_blocked',
      target: sampleTarget(),
      breakGlass: true,
      reasonCode: 'incident-freeze',
      rationale: 'Attempt emergency freeze with the wrong role.',
    },
  });
  const freeze = await requestJson(fixture.app, '/api/v1/admin/release-policy/emergency/freeze', {
    method: 'POST',
    headers: adminHeaders({
      'x-attestor-admin-actor-id': 'incident_commander',
      'x-attestor-policy-actor-role': 'policy-break-glass',
      'x-attestor-break-glass': 'true',
    }, 'admin-break-glass-secret'),
    body: {
      activationId: 'freeze_prod_current',
      target: sampleTarget(),
      breakGlass: true,
      reasonCode: 'incident-freeze',
      rationale: 'Freeze policy resolution while the rollout is investigated.',
      freezeReason: 'Suspected bad policy rollout.',
      incidentId: 'INC-2026-04-18-001',
    },
  });
  const frozenResolution = await requestJson(fixture.app, '/api/v1/admin/release-policy/resolve', {
    method: 'POST',
    body: { resolverInput: sampleResolverInput() },
  });
  const rollback = await requestJson(fixture.app, '/api/v1/admin/release-policy/emergency/rollback', {
    method: 'POST',
    headers: adminHeaders({
      'x-attestor-admin-actor-id': 'incident_commander',
      'x-attestor-policy-actor-role': 'policy-break-glass',
      'x-attestor-break-glass': 'true',
    }, 'admin-break-glass-secret'),
    body: {
      activationId: 'activation_prod_emergency_rollback',
      rollbackTargetActivationId: 'activation_prod_current',
      breakGlass: true,
      reasonCode: 'incident-rollback',
      rationale: 'Restore last known good policy after emergency freeze.',
      incidentId: 'INC-2026-04-18-001',
    },
  });
  const restoredResolution = await requestJson(fixture.app, '/api/v1/admin/release-policy/resolve', {
    method: 'POST',
    body: { resolverInput: sampleResolverInput() },
  });

  assert.equal(blockedFreeze.status, 403);
  assert.equal(freeze.status, 201);
  assert.equal(freeze.body.activation.state, 'frozen');
  assert.equal(freeze.body.activation.operationType, 'freeze-scope');
  assert.equal(frozenResolution.body.resolution.status, 'policy-scope-frozen');
  assert.equal(rollback.status, 201);
  assert.equal(rollback.body.activation.operationType, 'rollback-activation');
  assert.equal(fixture.store.getActivation('freeze_prod_current')?.state, 'rolled-back');
  assert.equal(restoredResolution.body.resolution.status, 'resolved');
  assert.equal(
    fixture.adminAuditRecords.some((record) => record.action === 'policy_activation.emergency_frozen'),
    true,
  );
  assert.equal(
    fixture.adminAuditRecords.some((record) => record.action === 'policy_activation.emergency_rolled_back'),
    true,
  );
  assert.equal(
    fixture.auditLog.entries().some((entry) => entry.action === 'freeze-scope'),
    true,
  );
}

async function testResolveAndSimulationSurfaces(): Promise<void> {
  const fixture = createFixture();
  await publishBundleThroughRoutes(fixture);
  const approvalRequestId = await requestAndApproveActivation(fixture);
  await requestJson(fixture.app, '/api/v1/admin/release-policy/activations', {
    method: 'POST',
    body: {
      activationId: 'activation_prod_current',
      packId: 'finance-core',
      bundleId: 'bundle_finance_core_2026_04_18',
      approvalRequestId,
      target: sampleTarget(),
      activatedAt: '2026-04-18T09:11:00.000Z',
      rationale: 'Promote finance record release policy.',
    },
  });

  const resolution = await requestJson(fixture.app, '/api/v1/admin/release-policy/resolve', {
    method: 'POST',
    body: { resolverInput: sampleResolverInput() },
  });
  const simulation = await requestJson(fixture.app, '/api/v1/admin/release-policy/simulations', {
    method: 'POST',
    body: {
      resolverInput: sampleResolverInput(),
      overlay: {
        packId: 'finance-core',
        bundleId: 'bundle_finance_core_2026_04_18',
        target: sampleTarget(),
        activationId: 'activation_simulated',
      },
    },
  });

  assert.equal(resolution.status, 200);
  assert.equal(resolution.body.resolution.status, 'resolved');
  assert.equal(simulation.status, 200);
  assert.equal(simulation.body.preview.dryRun.simulated.status, 'resolved');
  assert.equal(simulation.body.preview.bundleImpact.candidateBundleId, 'bundle_finance_core_2026_04_18');
}

async function testAuditSurfaceFiltersAndSnapshotDisclosure(): Promise<void> {
  const fixture = createFixture();
  await publishBundleThroughRoutes(fixture);

  const filtered = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/audit?action=publish-bundle',
  );
  const withSnapshot = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/audit?action=publish-bundle&includeSnapshots=true',
  );
  const verification = await requestJson(fixture.app, '/api/v1/admin/release-policy/audit/verify');

  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.entries.length, 1);
  assert.equal(filtered.body.entries[0].mutationSnapshot, undefined);
  assert.equal(withSnapshot.body.entries[0].mutationSnapshot.bundleId, 'bundle_finance_core_2026_04_18');
  assert.equal(verification.body.verification.valid, true);
}

async function testListRoutesApplyPaginationBounds(): Promise<void> {
  const fixture = createFixture();
  await publishBundleThroughRoutes(fixture, 'bundle_finance_core_2026_04_18');
  await publishBundleThroughRoutes(fixture, 'bundle_finance_core_2026_04_19');
  await publishBundleThroughRoutes(fixture, 'bundle_finance_core_2026_04_20');
  await fixture.store.upsertPack(sampleSecondaryPackMetadata('ops-core', 'Ops Core'));
  await requestJson(fixture.app, '/api/v1/admin/release-policy/activation-approvals', {
    method: 'POST',
    body: {
      approvalRequestId: 'approval_page_one',
      packId: 'finance-core',
      bundleId: 'bundle_finance_core_2026_04_18',
      target: sampleTarget(),
      rationale: 'Request first paginated approval.',
    },
  });
  await requestJson(fixture.app, '/api/v1/admin/release-policy/activation-approvals', {
    method: 'POST',
    body: {
      approvalRequestId: 'approval_page_two',
      packId: 'finance-core',
      bundleId: 'bundle_finance_core_2026_04_18',
      target: sampleTarget(),
      rationale: 'Request second paginated approval.',
    },
  });
  const approvalRequestId = await requestAndApproveActivation(fixture);
  await requestJson(fixture.app, '/api/v1/admin/release-policy/activations', {
    method: 'POST',
    body: {
      activationId: 'activation_prod_current',
      packId: 'finance-core',
      bundleId: 'bundle_finance_core_2026_04_18',
      approvalRequestId,
      target: sampleTarget(),
      activatedAt: '2026-04-18T09:11:00.000Z',
      rationale: 'Promote finance record release policy.',
    },
  });
  await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/activations/activation_prod_current/rollback',
    {
      method: 'POST',
      body: {
        activationId: 'activation_prod_rollback',
        rationale: 'Exercise rollback route.',
      },
    },
  );

  const packs = await requestJson(fixture.app, '/api/v1/admin/release-policy/packs?limit=1');
  const bundles = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/packs/finance-core/bundles?limit=2',
  );
  const versions = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/packs/finance-core/versions?cursor=2&limit=2',
  );
  const approvals = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/activation-approvals?limit=1',
  );
  const activations = await requestJson(fixture.app, '/api/v1/admin/release-policy/activations?limit=1');
  const excessiveLimit = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/packs?limit=101',
  );
  const invalidCursor = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/packs?cursor=-1',
  );

  assert.equal(packs.status, 200);
  assert.equal(packs.body.packs.length, 1);
  assert.equal(packs.body.pageInfo.nextCursor, '1');
  assert.equal(packs.body.pageInfo.totalItems, 2);
  assert.equal(bundles.body.bundles.length, 2);
  assert.equal(bundles.body.pageInfo.nextCursor, '2');
  assert.equal(versions.body.versions.length, 1);
  assert.equal(versions.body.pageInfo.nextCursor, null);
  assert.equal(approvals.body.approvalRequests.length, 1);
  assert.equal(approvals.body.pageInfo.totalItems, 3);
  assert.equal(activations.body.activations.length, 1);
  assert.equal(activations.body.pageInfo.totalItems, 2);
  assert.equal(excessiveLimit.status, 400);
  assert.equal(excessiveLimit.body.code, 'bad_request');
  assert.equal(invalidCursor.status, 400);
  assert.equal(invalidCursor.body.code, 'bad_request');
}

async function testTypedErrorsUseBoundedStatusMappings(): Promise<void> {
  const fixture = createFixture();
  await publishBundleThroughRoutes(fixture);
  const missingApproval = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/activation-approvals/missing_approval/approve',
    {
      method: 'POST',
      body: {
        rationale: 'Attempt to approve a missing request.',
      },
    },
  );
  const request = await requestJson(fixture.app, '/api/v1/admin/release-policy/activation-approvals', {
    method: 'POST',
    headers: adminHeaders({
      'x-attestor-admin-actor-id': 'requester_policy_admin',
      'x-attestor-policy-actor-role': 'policy-admin',
    }),
    body: {
      approvalRequestId: 'approval_error_mapping',
      packId: 'finance-core',
      bundleId: 'bundle_finance_core_2026_04_18',
      target: sampleTarget(),
      rationale: 'Request policy activation approval.',
    },
  });
  const requesterCannotApprove = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/activation-approvals/approval_error_mapping/approve',
    {
      method: 'POST',
      headers: adminHeaders({
        'x-attestor-admin-actor-id': 'requester_policy_admin',
        'x-attestor-policy-actor-role': 'policy-admin',
      }),
      body: {
        rationale: 'Requester attempts to approve its own activation request.',
      },
    },
  );
  const firstReviewer = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/activation-approvals/approval_error_mapping/approve',
    {
      method: 'POST',
      headers: adminHeaders({
        'x-attestor-admin-actor-id': 'risk_owner',
        'x-attestor-policy-actor-role': 'risk-owner',
      }, 'admin-release-secret'),
      body: {
        rationale: 'Risk owner approves activation.',
      },
    },
  );
  const duplicateReviewer = await requestJson(
    fixture.app,
    '/api/v1/admin/release-policy/activation-approvals/approval_error_mapping/approve',
    {
      method: 'POST',
      headers: adminHeaders({
        'x-attestor-admin-actor-id': 'risk_owner',
        'x-attestor-policy-actor-role': 'risk-owner',
      }, 'admin-release-secret'),
      body: {
        rationale: 'Risk owner attempts a duplicate approval.',
      },
    },
  );
  const failingFinalizeFixture = createFixture({
    finalizeError: new Error('storage backend exposed raw failure detail'),
  });
  const internalFailure = await requestJson(failingFinalizeFixture.app, '/api/v1/admin/release-policy/packs', {
    method: 'POST',
    body: { pack: samplePackMetadata() },
  });

  assert.equal(missingApproval.status, 404);
  assert.equal(missingApproval.body.code, 'not_found');
  assert.equal(request.status, 201);
  assert.equal(requesterCannotApprove.status, 403);
  assert.equal(requesterCannotApprove.body.code, 'forbidden');
  assert.equal(firstReviewer.status, 200);
  assert.equal(duplicateReviewer.status, 409);
  assert.equal(duplicateReviewer.body.code, 'conflict');
  assert.equal(internalFailure.status, 500);
  assert.equal(internalFailure.body.code, 'internal');
  assert.equal(internalFailure.body.error, 'Release policy control-plane operation failed.');
}

async function testIdempotentMutationReplayDoesNotAppendAuditTwice(): Promise<void> {
  const fixture = createFixture({ idempotency: true });
  const bundle = createSignedBundle();
  const body = { pack: bundle.pack };

  const first = await requestJson(fixture.app, '/api/v1/admin/release-policy/packs', {
    method: 'POST',
    headers: adminHeaders({ 'Idempotency-Key': 'idem-policy-pack' }),
    body,
  });
  const second = await requestJson(fixture.app, '/api/v1/admin/release-policy/packs', {
    method: 'POST',
    headers: adminHeaders({ 'Idempotency-Key': 'idem-policy-pack' }),
    body,
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('x-attestor-idempotent-replay'), 'true');
  assert.equal(fixture.auditLog.entries().length, 1);
  assert.equal(fixture.adminAuditRecords.length, 1);
}

async function run(): Promise<void> {
  const originalAdminApiKey = process.env.ATTESTOR_ADMIN_API_KEY;
  const originalAdminReadApiKey = process.env.ATTESTOR_ADMIN_READ_API_KEY;
  const originalAdminReleaseApiKey = process.env.ATTESTOR_ADMIN_RELEASE_API_KEY;
  const originalAdminBreakGlassApiKey = process.env.ATTESTOR_ADMIN_BREAK_GLASS_API_KEY;
  const originalAdminRateLimit = process.env.ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE;
  process.env.ATTESTOR_ADMIN_API_KEY = 'admin-secret';
  process.env.ATTESTOR_ADMIN_READ_API_KEY = 'admin-read-secret';
  process.env.ATTESTOR_ADMIN_RELEASE_API_KEY = 'admin-release-secret';
  process.env.ATTESTOR_ADMIN_BREAK_GLASS_API_KEY = 'admin-break-glass-secret';
  process.env.ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE = '10000';

  try {
    await testAdminAuthIsRequired();
    await testRoleScopedAdminKeysCannotEscalateThroughActorHeader();
    await testPackAndBundleSurfaces();
    await testBundleDetailSupportsCacheHeadersAndConditionalRevalidation();
    await testActivationRequiresApprovalForR4();
    await testApprovalRoutesEnforceDualReview();
    await testActivationAndRollbackSurfaces();
    await testEmergencyFreezeAndRollbackRequireBreakGlassAndFailClosed();
    await testResolveAndSimulationSurfaces();
    await testAuditSurfaceFiltersAndSnapshotDisclosure();
    await testListRoutesApplyPaginationBounds();
    await testTypedErrorsUseBoundedStatusMappings();
    await testIdempotentMutationReplayDoesNotAppendAuditTwice();
    console.log('Release policy control-plane admin-route tests: 13 passed, 0 failed');
  } finally {
    process.env.ATTESTOR_ADMIN_API_KEY = originalAdminApiKey;
    process.env.ATTESTOR_ADMIN_READ_API_KEY = originalAdminReadApiKey;
    process.env.ATTESTOR_ADMIN_RELEASE_API_KEY = originalAdminReleaseApiKey;
    process.env.ATTESTOR_ADMIN_BREAK_GLASS_API_KEY = originalAdminBreakGlassApiKey;
    process.env.ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE = originalAdminRateLimit;
  }
}

await run();
