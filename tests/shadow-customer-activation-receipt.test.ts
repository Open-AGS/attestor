import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
  type ShadowAdmissionEvent,
  type ShadowCustomerActivationHandoff,
  type ShadowPolicyBundlePublicationSignature,
  type ShadowPolicyBundleSigningPayload,
} from '../src/consequence-admission/index.js';
import { registerShadowRoutes } from '../src/service/http/routes/shadow-routes.js';
import {
  createFileBackedShadowCustomerActivationReceiptStore,
  createFileBackedShadowPolicyCandidateStore,
  resetShadowPersistenceStoresForTests,
  type ShadowPolicyCandidateStatus,
} from '../src/service/shadow/shadow-persistence-store.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';
import {
  derivePublicKeyIdentity,
  generateKeyPair,
  signPayload,
} from '../src/signing/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-customer-activation-receipt-'));
const candidatePath = join(tempDir, 'shadow-policy-candidates.json');
const activationReceiptPath = join(tempDir, 'shadow-customer-activation-receipts.json');

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_customer_activation_receipt',
  tenantName: 'Shadow Customer Activation Receipt Tenant',
  authenticatedAt: '2026-05-02T18:00:00.000Z',
  source: 'api_key',
  planId: 'community',
  monthlyRunQuota: 100,
};

const signingKey = generateKeyPair();
const signingIdentity = derivePublicKeyIdentity(signingKey.publicKeyPem);
const evidenceDigest = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const rollbackDigest = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const killSwitchDigest = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const monitoringDigest = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';
const activationDigest = 'sha256:5555555555555555555555555555555555555555555555555555555555555555';
const externalReceiptDigest = 'sha256:6666666666666666666666666666666666666666666666666666666666666666';
const rollbackReceiptDigest = 'sha256:7777777777777777777777777777777777777777777777777777777777777777';
const errorDigest = 'sha256:8888888888888888888888888888888888888888888888888888888888888888';

function createSafeEvent(index: number): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: `2026-05-02T18:0${index}:00.000Z`,
      decidedAt: `2026-05-02T18:0${index}:01.000Z`,
      amount: {
        value: 1000 + index,
        currency: 'HUF',
      },
      recipient: 'raw_customer_value_must_not_escape',
      evidenceRefs: [`order:${index}`],
      policyRef: 'policy:refunds:v1',
      observedFeatures: {
        rawMarker: 'raw_feature_value_must_not_escape',
      },
    }),
    occurredAt: `2026-05-02T18:0${index}:02.000Z`,
    downstreamOutcome: 'proceeded',
    observedFeatures: {
      rawMarker: 'raw_feature_value_must_not_escape',
    },
  });
}

function createSignature(
  payload: ShadowPolicyBundleSigningPayload,
  productionReady: boolean,
): ShadowPolicyBundlePublicationSignature {
  if (productionReady) {
    return Object.freeze({
      algorithm: 'external-kms',
      signature: `external-kms-signature:${payload.digest}`,
      signerRef: 'kms:prod-policy-bundle-signer',
      publicKeyFingerprint: 'kms-fingerprint:prod-policy-bundle-signer',
      signedAt: '2026-05-02T18:05:01.000Z',
      signingBoundary: 'external-kms-hsm',
      productionReady: true,
    });
  }

  return Object.freeze({
    algorithm: 'ed25519',
    signature: signPayload(payload.canonical, signingKey.privateKeyPem),
    signerRef: 'test-local-ed25519-signer',
    publicKeyFingerprint: signingIdentity.fingerprint,
    signedAt: '2026-05-02T18:05:01.000Z',
    signingBoundary: 'runtime-memory',
    productionReady: false,
  });
}

function createApp(input: {
  readonly events: readonly ShadowAdmissionEvent[];
  readonly productionSigner?: boolean;
}): Hono {
  const candidateStore = createFileBackedShadowPolicyCandidateStore({ path: candidatePath });
  const activationReceiptStore = createFileBackedShadowCustomerActivationReceiptStore({
    path: activationReceiptPath,
  });
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => tenant,
    listShadowEvents: ({ tenant: routeTenant }) =>
      routeTenant.tenantId === tenant.tenantId ? input.events : [],
    listShadowSimulations: () => [],
    materializeShadowPolicyCandidates: ({ tenant: routeTenant, bundle }) =>
      candidateStore.upsertBundle({
        tenantId: routeTenant.tenantId,
        bundle,
      }),
    listShadowPolicyCandidateRecords: ({ tenant: routeTenant, status }) =>
      candidateStore.list({
        tenantId: routeTenant.tenantId,
        status,
      }).records,
    transitionShadowPolicyCandidateStatus: ({ tenant: routeTenant, candidateId, status, actorRef, reason }) =>
      candidateStore.transitionStatus({
        tenantId: routeTenant.tenantId,
        candidateId,
        status,
        actorRef,
        reason,
      }).record,
    recordShadowCustomerActivationReceipt: ({ tenant: routeTenant, receipt }) =>
      activationReceiptStore.append({
        tenantId: routeTenant.tenantId,
        receipt,
      }),
    listShadowCustomerActivationReceiptRecords: ({ tenant: routeTenant, activationStatus, receiptReady, sourceHandoffDigest }) =>
      activationReceiptStore.list({
        tenantId: routeTenant.tenantId,
        activationStatus,
        receiptReady,
        sourceHandoffDigest,
      }).records,
    findShadowCustomerActivationReceipt: ({ tenant: routeTenant, receiptId }) =>
      activationReceiptStore.find({
        tenantId: routeTenant.tenantId,
        receiptId,
      }).record,
    signShadowPolicyBundlePublication: ({ payload }) =>
      createSignature(payload, input.productionSigner ?? false),
    now: () => '2026-05-02T18:05:00.000Z',
  });
  return app;
}

async function materializeCandidate(app: Hono): Promise<string> {
  const response = await app.request('/api/v1/shadow/policy-candidates/materialize', {
    method: 'POST',
  });
  const body = await response.json() as {
    readonly persisted: {
      readonly records: readonly { readonly candidateId: string }[];
    };
  };
  return body.persisted.records[0]?.candidateId ?? '';
}

async function transition(
  app: Hono,
  candidateId: string,
  status: ShadowPolicyCandidateStatus,
): Promise<Response> {
  return app.request(`/api/v1/shadow/policy-candidates/${encodeURIComponent(candidateId)}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      status,
      actorRef: `operator:${status}`,
      reason: `Move candidate to ${status}.`,
    }),
  });
}

async function approveCandidate(app: Hono, candidateId: string): Promise<void> {
  equal((await transition(app, candidateId, 'proposed')).status, 200, 'Customer activation receipt route: candidate can be proposed');
  equal((await transition(app, candidateId, 'approved')).status, 200, 'Customer activation receipt route: candidate can be approved');
}

async function activateCandidate(app: Hono, candidateId: string): Promise<void> {
  await approveCandidate(app, candidateId);
  equal((await transition(app, candidateId, 'activated')).status, 200, 'Customer activation receipt route: candidate can be activated');
}

function completeHandoffBody(overrides: Record<string, unknown> = {}) {
  return {
    enforcementPointId: 'refund-service/ext-authz',
    boundaryKind: 'http-handler',
    verifierRef: 'verifier:refund-service-ci',
    evidenceRefs: [
      {
        id: 'ci:run:890',
        kind: 'adapter-test',
        digest: evidenceDigest,
        uri: 'https://example.invalid/attestor/evidence/ci-run-890',
      },
    ],
    observedVerificationChecks: SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
    activationRef: 'change:shadow-enforcement-activation-890',
    operatorRef: 'operator:security-reviewer',
    rolloutStrategy: 'canary',
    rollbackRef: {
      id: 'runbook:rollback-shadow-enforcement',
      kind: 'deployment-rollback',
      digest: rollbackDigest,
      uri: 'https://example.invalid/attestor/runbooks/rollback-shadow-enforcement',
    },
    killSwitchRef: {
      id: 'flag:disable-shadow-enforcement',
      kind: 'feature-flag-disable',
      digest: killSwitchDigest,
      uri: 'https://example.invalid/attestor/flags/disable-shadow-enforcement',
    },
    monitoringRef: {
      id: 'slo:shadow-enforcement-error-budget',
      kind: 'slo-alarm',
      digest: monitoringDigest,
      uri: 'https://example.invalid/attestor/alerts/shadow-enforcement',
    },
    expiresAt: '2026-05-02T19:05:00.000Z',
    ...overrides,
  };
}

async function postHandoff(
  app: Hono,
  body: unknown,
  sourceStatus: ShadowPolicyCandidateStatus = 'activated',
): Promise<ShadowCustomerActivationHandoff> {
  const response = await app.request(`/api/v1/shadow/customer-activation-handoff?status=${sourceStatus}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json() as {
    readonly handoff: ShadowCustomerActivationHandoff;
  };
  equal(response.status, 200, 'Customer activation receipt route: source handoff can be generated');
  return responseBody.handoff;
}

async function postReceipt(app: Hono, body: unknown): Promise<Response> {
  return app.request('/api/v1/shadow/customer-activation-receipt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function activatedReceiptBody(handoff: ShadowCustomerActivationHandoff, overrides: Record<string, unknown> = {}) {
  return {
    handoff,
    activationStatus: 'activated',
    attemptedAt: '2026-05-02T18:05:10.000Z',
    observedAt: '2026-05-02T18:06:10.000Z',
    completedAt: '2026-05-02T18:06:20.000Z',
    activationDigest,
    externalReceiptDigest,
    rollbackStatus: 'not-triggered',
    killSwitchStatus: 'verified',
    monitoringStatus: 'healthy',
    ...overrides,
  };
}

async function readyHandoff(app: Hono): Promise<ShadowCustomerActivationHandoff> {
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);
  return postHandoff(app, completeHandoffBody(), 'activated');
}

async function approvedBlockedHandoff(app: Hono): Promise<ShadowCustomerActivationHandoff> {
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);
  return postHandoff(app, completeHandoffBody(), 'approved');
}

async function testActivatedReceiptRecordsWithoutRawData(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const handoff = await readyHandoff(app);
  const response = await postReceipt(app, activatedReceiptBody(handoff));
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly productionReady: boolean;
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly receipt: {
      readonly receiptId: string;
      readonly receiptReady: boolean;
      readonly activationClosed: boolean;
      readonly sourceHandoffDigest: string;
      readonly operatorRefDigest: string;
      readonly activationStatus: string;
      readonly rollbackStatus: string;
      readonly killSwitchStatus: string;
      readonly monitoringStatus: string;
      readonly failureReasons: readonly string[];
      readonly approvalRequired: boolean;
      readonly autoEnforce: boolean;
      readonly rawPayloadStored: boolean;
      readonly productionReady: boolean;
      readonly digest: string;
    };
  };

  equal(response.status, 200, 'Customer activation receipt route: activated receipt returns 200');
  equal(body.productionReady, false, 'Customer activation receipt route: route does not claim production readiness');
  equal(body.autoEnforce, false, 'Customer activation receipt route: route does not auto-enforce');
  equal(body.rawPayloadStored, false, 'Customer activation receipt route: route is data-minimized');
  ok(body.receipt.receiptId.startsWith('customer-activation-receipt:sha256:'), 'Customer activation receipt route: receipt id is digest-bound');
  equal(body.receipt.receiptReady, true, 'Customer activation receipt route: healthy activation receipt records');
  equal(body.receipt.activationClosed, true, 'Customer activation receipt route: activation is closed by receipt');
  equal(body.receipt.sourceHandoffDigest, handoff.digest, 'Customer activation receipt route: source handoff digest is bound');
  ok(body.receipt.operatorRefDigest.startsWith('sha256:'), 'Customer activation receipt route: operator ref is digested');
  equal(body.receipt.activationStatus, 'activated', 'Customer activation receipt route: activation status is carried');
  equal(body.receipt.rollbackStatus, 'not-triggered', 'Customer activation receipt route: rollback status is carried');
  equal(body.receipt.killSwitchStatus, 'verified', 'Customer activation receipt route: kill switch verification is carried');
  equal(body.receipt.monitoringStatus, 'healthy', 'Customer activation receipt route: monitoring status is carried');
  equal(body.receipt.failureReasons.length, 0, 'Customer activation receipt route: no failure reasons remain');
  equal(body.receipt.approvalRequired, true, 'Customer activation receipt route: approval remains explicit');
  equal(body.receipt.autoEnforce, false, 'Customer activation receipt route: receipt never auto-enforces');
  equal(body.receipt.rawPayloadStored, false, 'Customer activation receipt route: receipt is data-minimized');
  equal(body.receipt.productionReady, false, 'Customer activation receipt route: receipt avoids production-ready claim');
  ok(body.receipt.digest.startsWith('sha256:'), 'Customer activation receipt route: receipt digest is present');
  ok(!text.includes('raw_customer_value_must_not_escape'), 'Customer activation receipt route: raw recipient is not exported');
  ok(!text.includes('raw_feature_value_must_not_escape'), 'Customer activation receipt route: raw feature is not exported');
  ok(!text.includes('order:1'), 'Customer activation receipt route: raw evidence id is not exported');
  ok(!text.includes('operator:security-reviewer'), 'Customer activation receipt route: raw operator ref is not exported');
}

async function testBlockedHandoffKeepsReceiptHeld(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
  });
  const handoff = await approvedBlockedHandoff(app);
  const response = await postReceipt(app, activatedReceiptBody(handoff));
  const body = await response.json() as {
    readonly receipt: {
      readonly receiptReady: boolean;
      readonly activationClosed: boolean;
      readonly failureReasons: readonly string[];
    };
  };

  equal(response.status, 200, 'Customer activation receipt route: blocked handoff receipt returns 200');
  equal(body.receipt.receiptReady, false, 'Customer activation receipt route: blocked handoff keeps receipt held');
  equal(body.receipt.activationClosed, false, 'Customer activation receipt route: blocked handoff does not close activation');
  ok(body.receipt.failureReasons.includes('handoff-not-ready'), 'Customer activation receipt route: handoff-not-ready is explicit');
}

async function testMonitoringOrKillSwitchGapKeepsReceiptHeld(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const handoff = await readyHandoff(app);
  const response = await postReceipt(
    app,
    activatedReceiptBody(handoff, {
      killSwitchStatus: 'not-tested',
      monitoringStatus: 'alarm',
    }),
  );
  const body = await response.json() as {
    readonly receipt: {
      readonly receiptReady: boolean;
      readonly failureReasons: readonly string[];
    };
  };

  equal(response.status, 200, 'Customer activation receipt route: control gap receipt returns 200');
  equal(body.receipt.receiptReady, false, 'Customer activation receipt route: control gap keeps receipt held');
  ok(body.receipt.failureReasons.includes('kill-switch-not-verified'), 'Customer activation receipt route: kill switch gap is explicit');
  ok(body.receipt.failureReasons.includes('monitoring-not-healthy'), 'Customer activation receipt route: monitoring gap is explicit');
}

async function testRolledBackReceiptCanRecordRollbackClosure(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const handoff = await readyHandoff(app);
  const response = await postReceipt(app, {
    handoff,
    activationStatus: 'rolled-back',
    attemptedAt: '2026-05-02T18:05:10.000Z',
    observedAt: '2026-05-02T18:06:10.000Z',
    completedAt: '2026-05-02T18:07:00.000Z',
    externalReceiptDigest: rollbackReceiptDigest,
    rollbackStatus: 'completed',
    rollbackDigest,
    killSwitchStatus: 'verified',
    monitoringStatus: 'alarm',
  });
  const body = await response.json() as {
    readonly receipt: {
      readonly receiptReady: boolean;
      readonly activationStatus: string;
      readonly rollbackStatus: string;
      readonly rollbackDigest: string | null;
      readonly failureReasons: readonly string[];
    };
  };

  equal(response.status, 200, 'Customer activation receipt route: rolled-back receipt returns 200');
  equal(body.receipt.receiptReady, true, 'Customer activation receipt route: completed rollback records');
  equal(body.receipt.activationStatus, 'rolled-back', 'Customer activation receipt route: rolled-back status is carried');
  equal(body.receipt.rollbackStatus, 'completed', 'Customer activation receipt route: completed rollback status is carried');
  equal(body.receipt.rollbackDigest, rollbackDigest, 'Customer activation receipt route: rollback digest is carried');
  equal(body.receipt.failureReasons.length, 0, 'Customer activation receipt route: completed rollback has no failure reasons');
}

async function testTamperedHandoffDigestKeepsReceiptHeld(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const handoff = await readyHandoff(app);
  const tampered = {
    ...handoff,
    sourceSimulationDigest: 'sha256:9999999999999999999999999999999999999999999999999999999999999999',
  };
  const response = await postReceipt(app, activatedReceiptBody(tampered));
  const body = await response.json() as {
    readonly receipt: {
      readonly receiptReady: boolean;
      readonly failureReasons: readonly string[];
    };
  };

  equal(response.status, 200, 'Customer activation receipt route: tampered handoff returns 200');
  equal(body.receipt.receiptReady, false, 'Customer activation receipt route: tampered handoff keeps receipt held');
  ok(body.receipt.failureReasons.includes('handoff-digest-mismatch'), 'Customer activation receipt route: handoff digest mismatch is explicit');
}

async function testInvalidActivationDigestIsRejected(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const handoff = await readyHandoff(app);
  const response = await postReceipt(
    app,
    activatedReceiptBody(handoff, {
      activationDigest: 'sha256:not-a-valid-digest',
    }),
  );
  const body = await response.json() as {
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Customer activation receipt route: invalid activation digest is rejected');
  ok(
    body.reasonCodes.includes('customer-activation-receipt-failed'),
    'Customer activation receipt route: invalid digest has fail-closed reason code',
  );
}

async function testFailedReceiptRequiresErrorEvidence(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const handoff = await readyHandoff(app);
  const missingError = await postReceipt(app, {
    handoff,
    activationStatus: 'failed',
    attemptedAt: '2026-05-02T18:05:10.000Z',
    observedAt: '2026-05-02T18:06:10.000Z',
    rollbackStatus: 'not-triggered',
    killSwitchStatus: 'verified',
    monitoringStatus: 'alarm',
  });
  const missingBody = await missingError.json() as {
    readonly receipt: {
      readonly receiptReady: boolean;
      readonly failureReasons: readonly string[];
    };
  };
  const withError = await postReceipt(app, {
    handoff,
    activationStatus: 'failed',
    attemptedAt: '2026-05-02T18:05:10.000Z',
    observedAt: '2026-05-02T18:06:10.000Z',
    errorDigest,
    rollbackStatus: 'not-triggered',
    killSwitchStatus: 'verified',
    monitoringStatus: 'alarm',
  });
  const withErrorBody = await withError.json() as {
    readonly receipt: {
      readonly receiptReady: boolean;
      readonly activationStatus: string;
      readonly errorDigest: string | null;
    };
  };

  equal(missingError.status, 200, 'Customer activation receipt route: failed receipt without error evidence returns 200');
  equal(missingBody.receipt.receiptReady, false, 'Customer activation receipt route: failed receipt without evidence is held');
  ok(missingBody.receipt.failureReasons.includes('activation-error-digest-required'), 'Customer activation receipt route: missing failure digest is explicit');
  equal(withError.status, 200, 'Customer activation receipt route: failed receipt with error evidence returns 200');
  equal(withErrorBody.receipt.receiptReady, true, 'Customer activation receipt route: failed receipt with error evidence records');
  equal(withErrorBody.receipt.activationStatus, 'failed', 'Customer activation receipt route: failed status is carried');
  equal(withErrorBody.receipt.errorDigest, errorDigest, 'Customer activation receipt route: error digest is carried');
}

async function testReceiptHistoryPersistsListsAndLooksUpReceipts(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const handoff = await readyHandoff(app);
  const createResponse = await postReceipt(app, activatedReceiptBody(handoff));
  const createText = await createResponse.text();
  const createBody = JSON.parse(createText) as {
    readonly storageMode: string;
    readonly persisted: {
      readonly kind: string;
      readonly path?: string;
      readonly record: {
        readonly receiptId: string;
        readonly receiptDigest: string;
        readonly sourceHandoffDigest: string;
        readonly activationStatus: string;
        readonly receiptReady: boolean;
        readonly rawPayloadStored: boolean;
      };
    } | null;
    readonly receipt: {
      readonly receiptId: string;
      readonly digest: string;
    };
  };
  const receiptId = createBody.receipt.receiptId;
  const duplicateResponse = await postReceipt(app, activatedReceiptBody(handoff));
  const duplicateBody = await duplicateResponse.json() as {
    readonly persisted: {
      readonly kind: string;
    } | null;
  };
  const listResponse = await app.request('/api/v1/shadow/customer-activation-receipts?activationStatus=activated&receiptReady=true');
  const listText = await listResponse.text();
  const listBody = JSON.parse(listText) as {
    readonly storageMode: string;
    readonly recordCount: number;
    readonly rawPayloadStored: boolean;
    readonly records: readonly {
      readonly receiptId: string;
      readonly receiptDigest: string;
      readonly sourceHandoffDigest: string;
      readonly activationStatus: string;
      readonly receiptReady: boolean;
      readonly rawPayloadStored: boolean;
    }[];
  };
  const lookupResponse = await app.request(`/api/v1/shadow/customer-activation-receipts/${encodeURIComponent(receiptId)}`);
  const lookupBody = await lookupResponse.json() as {
    readonly record: {
      readonly receiptId: string;
      readonly receiptDigest: string;
      readonly receiptReady: boolean;
      readonly rawPayloadStored: boolean;
    };
  };
  const filteredByHandoff = await app.request(
    `/api/v1/shadow/customer-activation-receipts?sourceHandoffDigest=${encodeURIComponent(handoff.digest)}`,
  );
  const filteredByHandoffBody = await filteredByHandoff.json() as {
    readonly recordCount: number;
  };

  equal(createResponse.status, 200, 'Customer activation receipt history route: create returns 200');
  equal(createBody.storageMode, 'file-backed-evaluation', 'Customer activation receipt history route: storage mode is file-backed');
  equal(createBody.persisted?.kind, 'recorded', 'Customer activation receipt history route: receipt is persisted');
  equal(createBody.persisted?.path, undefined, 'Customer activation receipt history route: local path is not exposed');
  equal(createBody.persisted?.record.receiptId, receiptId, 'Customer activation receipt history route: record carries receipt id');
  equal(createBody.persisted?.record.receiptDigest, createBody.receipt.digest, 'Customer activation receipt history route: record digest matches receipt');
  equal(createBody.persisted?.record.sourceHandoffDigest, handoff.digest, 'Customer activation receipt history route: handoff digest is indexed');
  equal(createBody.persisted?.record.activationStatus, 'activated', 'Customer activation receipt history route: activation status is indexed');
  equal(createBody.persisted?.record.receiptReady, true, 'Customer activation receipt history route: ready receipt is indexed');
  equal(createBody.persisted?.record.rawPayloadStored, false, 'Customer activation receipt history route: persisted record is data-minimized');
  equal(duplicateBody.persisted?.kind, 'duplicate', 'Customer activation receipt history route: duplicate receipt is idempotent');

  equal(listResponse.status, 200, 'Customer activation receipt history route: list returns 200');
  equal(listBody.storageMode, 'file-backed-evaluation', 'Customer activation receipt history route: list storage mode is explicit');
  equal(listBody.recordCount, 1, 'Customer activation receipt history route: list filters ready activated receipts');
  equal(listBody.rawPayloadStored, false, 'Customer activation receipt history route: list is data-minimized');
  equal(listBody.records[0]?.receiptId, receiptId, 'Customer activation receipt history route: list returns receipt id');
  equal(listBody.records[0]?.receiptDigest, createBody.receipt.digest, 'Customer activation receipt history route: list returns receipt digest');
  equal(listBody.records[0]?.sourceHandoffDigest, handoff.digest, 'Customer activation receipt history route: list returns source handoff digest');
  equal(listBody.records[0]?.activationStatus, 'activated', 'Customer activation receipt history route: list returns activation status');
  equal(listBody.records[0]?.receiptReady, true, 'Customer activation receipt history route: list returns receipt readiness');
  equal(listBody.records[0]?.rawPayloadStored, false, 'Customer activation receipt history route: list record is data-minimized');
  ok(!createText.includes('raw_customer_value_must_not_escape'), 'Customer activation receipt history route: raw recipient is not persisted response');
  ok(!listText.includes('raw_customer_value_must_not_escape'), 'Customer activation receipt history route: raw recipient is not listed');
  ok(!listText.includes('operator:security-reviewer'), 'Customer activation receipt history route: raw operator ref is not listed');

  equal(lookupResponse.status, 200, 'Customer activation receipt history route: lookup returns 200');
  equal(lookupBody.record.receiptId, receiptId, 'Customer activation receipt history route: lookup returns receipt');
  equal(lookupBody.record.receiptDigest, createBody.receipt.digest, 'Customer activation receipt history route: lookup returns receipt digest');
  equal(lookupBody.record.receiptReady, true, 'Customer activation receipt history route: lookup returns readiness');
  equal(lookupBody.record.rawPayloadStored, false, 'Customer activation receipt history route: lookup is data-minimized');
  equal(filteredByHandoff.status, 200, 'Customer activation receipt history route: source handoff filter returns 200');
  equal(filteredByHandoffBody.recordCount, 1, 'Customer activation receipt history route: source handoff filter works');
}

async function testReceiptHistoryFiltersAndMissingLookupFailClosed(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const handoff = await readyHandoff(app);
  await postReceipt(
    app,
    activatedReceiptBody(handoff, {
      killSwitchStatus: 'not-tested',
      monitoringStatus: 'alarm',
    }),
  );
  const heldList = await app.request('/api/v1/shadow/customer-activation-receipts?receiptReady=false');
  const heldBody = await heldList.json() as {
    readonly recordCount: number;
    readonly records: readonly {
      readonly receiptReady: boolean;
      readonly receipt: {
        readonly failureReasons: readonly string[];
      };
    }[];
  };
  const invalidStatus = await app.request('/api/v1/shadow/customer-activation-receipts?activationStatus=unknown');
  const invalidReady = await app.request('/api/v1/shadow/customer-activation-receipts?receiptReady=maybe');
  const missing = await app.request('/api/v1/shadow/customer-activation-receipts/customer-activation-receipt%3Amissing');

  equal(heldList.status, 200, 'Customer activation receipt history route: held list returns 200');
  equal(heldBody.recordCount, 1, 'Customer activation receipt history route: held filter works');
  equal(heldBody.records[0]?.receiptReady, false, 'Customer activation receipt history route: held record is marked not ready');
  ok(
    heldBody.records[0]?.receipt.failureReasons.includes('kill-switch-not-verified'),
    'Customer activation receipt history route: held record carries failure reasons',
  );
  equal(invalidStatus.status, 400, 'Customer activation receipt history route: invalid status filter is rejected');
  equal(invalidReady.status, 400, 'Customer activation receipt history route: invalid ready filter is rejected');
  equal(missing.status, 404, 'Customer activation receipt history route: missing receipt returns 404');
}

function resetStores(): void {
  resetShadowPersistenceStoresForTests({
    policyCandidatePath: candidatePath,
    customerActivationReceiptPath: activationReceiptPath,
  });
}

try {
  resetStores();
  await testActivatedReceiptRecordsWithoutRawData();
  resetStores();
  await testBlockedHandoffKeepsReceiptHeld();
  resetStores();
  await testMonitoringOrKillSwitchGapKeepsReceiptHeld();
  resetStores();
  await testRolledBackReceiptCanRecordRollbackClosure();
  resetStores();
  await testTamperedHandoffDigestKeepsReceiptHeld();
  resetStores();
  await testInvalidActivationDigestIsRejected();
  resetStores();
  await testFailedReceiptRequiresErrorEvidence();
  resetStores();
  await testReceiptHistoryPersistsListsAndLooksUpReceipts();
  resetStores();
  await testReceiptHistoryFiltersAndMissingLookupFailClosed();

  console.log(`Shadow customer activation receipt tests: ${passed} passed, 0 failed`);
} finally {
  resetStores();
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
