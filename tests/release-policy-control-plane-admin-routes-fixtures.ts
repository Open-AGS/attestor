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
  createInMemoryPolicyControlPlaneStoreFromSnapshot,
  type PolicyControlPlaneStore,
} from '../src/release-policy-control-plane/store.js';
import {
  activatePolicyBundle,
} from '../src/release-policy-control-plane/activation-records.js';
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

export { createInMemoryPolicyControlPlaneStore };

export type TestAppFixture = {
  app: Hono;
  store: PolicyControlPlaneStore;
  approvalStore: PolicyActivationApprovalStore;
  auditLog: PolicyMutationAuditLogWriter;
  adminAuditRecords: Array<Record<string, unknown>>;
};

type TestFixtureOptions = {
  idempotency?: boolean;
  finalizeError?: Error;
  store?: PolicyControlPlaneStore;
  requireAtomicPolicyLifecycle?: boolean;
};

export function adminHeaders(extra?: Record<string, string>, token = 'admin-secret'): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    ...extra,
  };
}

export function sampleBundleReference(bundleId = 'bundle_finance_core_2026_04_18') {
  return {
    packId: 'finance-core',
    bundleId,
    bundleVersion: bundleId.replace('bundle_', '').replaceAll('_', '.'),
    digest: `sha256:${bundleId}`,
  } as const;
}

export function samplePackMetadata(bundleId = 'bundle_finance_core_2026_04_18') {
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

export function sampleSecondaryPackMetadata(id: string, name: string) {
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

export function createEntry() {
  const definition = policy.createFirstHardGatewayReleasePolicy();
  const target = createPolicyActivationTarget({
    environment: 'prod-eu',
    tenantId: 'tenant-finance',
    accountId: 'account-major',
    domainId: 'finance',
    wedgeId: 'finance.record.release',
    consequenceType: 'record',
    riskClass: 'R4',
    planId: 'trial',
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

export function createSignedBundle(bundleId = 'bundle_finance_core_2026_04_18') {
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

export function actor(id: string) {
  return {
    id,
    type: 'user' as const,
    displayName: id,
    role: 'policy-admin',
  };
}

export function insertReplacementActivation(
  store: PolicyControlPlaneStore,
  bundle: ReturnType<typeof createSignedBundle>,
  activationId: string,
): void {
  store.upsertPack(bundle.pack);
  store.upsertBundle({
    manifest: bundle.manifest,
    artifact: bundle.artifact,
    signedBundle: bundle.signedBundle,
    verificationKey: bundle.verificationKey,
  });
  const localStore = createInMemoryPolicyControlPlaneStoreFromSnapshot(store.exportSnapshot());
  const lifecycle = activatePolicyBundle(localStore, {
    id: activationId,
    target: sampleTarget(),
    bundle: bundle.manifest.bundle,
    activatedBy: actor('policy_admin_race'),
    activatedAt: '2026-04-18T09:12:00.000Z',
    rationale: 'Replacement activation races with an emergency freeze.',
  });
  store.upsertActivation(lifecycle.appliedRecord);
  if (lifecycle.updatedHistoricalRecord) {
    store.upsertActivation(lifecycle.updatedHistoricalRecord);
  }
}

export function createFirstSnapshotRaceStore(
  base: PolicyControlPlaneStore,
  replacement: ReturnType<typeof createSignedBundle>,
): { readonly store: PolicyControlPlaneStore; readonly arm: () => void } {
  let armed = false;
  let triggered = false;

  return {
    store: {
      ...base,
      exportSnapshot() {
        const snapshot = base.exportSnapshot();
        if (armed && !triggered) {
          triggered = true;
          insertReplacementActivation(base, replacement, 'activation_prod_replacement');
        }
        return snapshot;
      },
    },
    arm() {
      armed = true;
    },
  };
}

export function sampleTarget() {
  return {
    environment: 'prod-eu',
    tenantId: 'tenant-finance',
    accountId: 'account-major',
    domainId: 'finance',
    wedgeId: 'finance.record.release',
    consequenceType: 'record',
    riskClass: 'R4',
    planId: 'trial',
  } as const;
}

export function sampleResolverInput() {
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

export function createFixture(options?: TestFixtureOptions): TestAppFixture {
  resetReleaseAdminRouteAuthLimiterForTests();
  const app = new Hono();
  const store = options?.store ?? createInMemoryPolicyControlPlaneStore();
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
    requireAtomicPolicyLifecycle: options?.requireAtomicPolicyLifecycle,
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

export async function requestJson(
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

export async function publishBundleThroughRoutes(
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

export async function requestAndApproveActivation(fixture: TestAppFixture): Promise<string> {
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
