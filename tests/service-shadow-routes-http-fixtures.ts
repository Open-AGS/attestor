import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
  type ShadowAdmissionEvent,
  type ShadowCustomerActivationHandoff,
} from '../src/consequence-admission/index.js';
import {
  registerShadowRoutes,
  type ShadowMutationAuditInput,
} from '../src/service/http/routes/shadow-routes.js';
import {
  createFileBackedShadowCustomerActivationHandoffStore,
  createFileBackedShadowCustomerActivationReceiptStore,
  createFileBackedShadowPolicyCandidateStore,
  createFileBackedShadowPolicySimulationReportStore,
} from '../src/service/shadow/shadow-persistence-store.js';
import { createPipelineIdempotencyService } from '../src/service/application/pipeline-idempotency-service.js';
import type { PipelineIdempotencyService } from '../src/service/application/pipeline-idempotency-service.js';
import {
  ensurePipelineIdempotencyStateReady,
  lookupPipelineIdempotencyState,
  recordPipelineIdempotencyState,
} from '../src/service/control-plane-store.js';
import { hashJsonValue } from '../src/service/json-stable.js';
import { resetPipelineIdempotencyStoreForTests } from '../src/service/pipeline/pipeline-idempotency-store.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';

let passed = 0;

export function passedCount(): number {
  return passed;
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

export const tenant: TenantContext = {
  tenantId: 'tenant_shadow_http',
  tenantName: 'Shadow HTTP Tenant',
  authenticatedAt: '2026-05-21T09:00:00.000Z',
  source: 'api_key',
  planId: 'trial',
  monthlyRunQuota: 100,
};

export const tempDir = mkdtempSync(join(tmpdir(), 'attestor-service-shadow-routes-http-'));
export const digestA = `sha256:${'a'.repeat(64)}`;
export const digestB = `sha256:${'b'.repeat(64)}`;
export const digestC = `sha256:${'c'.repeat(64)}`;

function createEvent(index: number): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: `2026-05-21T09:0${index}:00.000Z`,
      decidedAt: `2026-05-21T09:0${index}:01.000Z`,
      recipient: 'raw_customer_marker_must_not_enter_audit',
      evidenceRefs: [`order:${index}`],
      policyRef: 'policy:refunds:v1',
      observedFeatures: {
        rawMarker: 'raw_feature_marker_must_not_enter_audit',
      },
    }),
    occurredAt: `2026-05-21T09:0${index}:02.000Z`,
    downstreamOutcome: 'proceeded',
    observedFeatures: {
      rawMarker: 'raw_feature_marker_must_not_enter_audit',
    },
  });
}

export function createApp(
  auditInputs: ShadowMutationAuditInput[],
  options?: {
    readonly now?: () => string;
    readonly pipelineIdempotencyService?: PipelineIdempotencyService;
    readonly currentShadowMutationActorRef?: () => string;
  },
): Hono {
  const simulationStore = createFileBackedShadowPolicySimulationReportStore({
    path: join(tempDir, `simulations-${auditInputs.length}-${Date.now()}.json`),
  });
  const candidateStore = createFileBackedShadowPolicyCandidateStore({
    path: join(tempDir, `candidates-${auditInputs.length}-${Date.now()}.json`),
  });
  const handoffStore = createFileBackedShadowCustomerActivationHandoffStore({
    path: join(tempDir, `handoffs-${auditInputs.length}-${Date.now()}.json`),
  });
  const receiptStore = createFileBackedShadowCustomerActivationReceiptStore({
    path: join(tempDir, `receipts-${auditInputs.length}-${Date.now()}.json`),
  });
  const events = Array.from({ length: 5 }, (_, index) => createEvent(index + 1));
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => tenant,
    ...(options?.currentShadowMutationActorRef
      ? { currentShadowMutationActorRef: () => options.currentShadowMutationActorRef!() }
      : {}),
    listShadowEvents: ({ tenant: routeTenant }) =>
      routeTenant.tenantId === tenant.tenantId ? events : [],
    listShadowSimulations: ({ tenant: routeTenant }) =>
      simulationStore.list({ tenantId: routeTenant.tenantId }).reports,
    recordShadowMutationAudit: async (input) => {
      auditInputs.push(input);
    },
    pipelineIdempotencyService: options?.pipelineIdempotencyService,
    recordShadowPolicySimulationReport: ({ tenant: routeTenant, report }) =>
      simulationStore.append({
        tenantId: routeTenant.tenantId,
        report,
      }),
    listShadowPolicySimulationReports: ({ tenant: routeTenant, proposedMode }) =>
      simulationStore.list({
        tenantId: routeTenant.tenantId,
        proposedMode,
      }).records,
    findShadowPolicySimulationReport: ({ tenant: routeTenant, reportId }) =>
      simulationStore.find({
        tenantId: routeTenant.tenantId,
        reportId,
      }).record,
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
    recordShadowCustomerActivationHandoff: ({ tenant: routeTenant, handoff }) =>
      handoffStore.append({
        tenantId: routeTenant.tenantId,
        handoff,
      }),
    findShadowCustomerActivationHandoff: ({ tenant: routeTenant, handoffId }) =>
      handoffStore.find({
        tenantId: routeTenant.tenantId,
        handoffId,
      }).record,
    recordShadowCustomerActivationReceipt: ({ tenant: routeTenant, receipt }) =>
      receiptStore.append({
        tenantId: routeTenant.tenantId,
        receipt,
      }),
    listShadowCustomerActivationReceiptRecords: ({ tenant: routeTenant, activationStatus, receiptReady, sourceHandoffDigest }) =>
      receiptStore.list({
        tenantId: routeTenant.tenantId,
        activationStatus,
        receiptReady,
        sourceHandoffDigest,
      }).records,
    findShadowCustomerActivationReceipt: ({ tenant: routeTenant, receiptId }) =>
      receiptStore.find({
        tenantId: routeTenant.tenantId,
        receiptId,
      }).record,
    now: options?.now ?? (() => '2026-05-21T09:10:00.000Z'),
  });
  return app;
}

export function withPipelineIdempotencyEnv(): () => void {
  const previous = new Map<string, string | undefined>();
  const overrides: Record<string, string | undefined> = {
    ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY: 'shadow-mutation-idempotency-test-key',
    ATTESTOR_PIPELINE_IDEMPOTENCY_STORE_PATH: join(
      tmpdir(),
      `attestor-shadow-mutation-idempotency-${randomUUID()}.json`,
    ),
    ATTESTOR_CONTROL_PLANE_PG_URL: undefined,
  };
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  resetPipelineIdempotencyStoreForTests();
  return () => {
    resetPipelineIdempotencyStoreForTests();
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

export function pipelineIdempotencyService(): PipelineIdempotencyService {
  return createPipelineIdempotencyService({
    hashJsonValue,
    ensurePipelineIdempotencyStateReady,
    lookupPipelineIdempotencyState,
    recordPipelineIdempotencyState,
  });
}

export async function postJson(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchJson(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function proofBody() {
  return {
    enforcementPointId: 'refund-service/ext-authz',
    boundaryKind: 'http-handler',
    verifierRef: 'verifier:refund-service-ci',
    evidenceRefs: [
      {
        id: 'ci:run:shadow-http',
        kind: 'adapter-test',
        digest: digestA,
        uri: 'https://example.invalid/attestor/evidence/shadow-http',
      },
    ],
    observedVerificationChecks: SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
  };
}

export function handoffBody() {
  return {
    ...proofBody(),
    activationRef: 'change:shadow-http',
    operatorRef: 'operator:shadow-http',
    rolloutStrategy: 'canary',
    rollbackRef: {
      id: 'runbook:rollback-shadow-http',
      kind: 'deployment-rollback',
      digest: digestB,
      uri: 'https://example.invalid/attestor/runbooks/rollback-shadow-http',
    },
    killSwitchRef: {
      id: 'flag:disable-shadow-http',
      kind: 'feature-flag-disable',
      digest: digestC,
      uri: 'https://example.invalid/attestor/flags/disable-shadow-http',
    },
    monitoringRef: {
      id: 'slo:shadow-http',
      kind: 'slo-alarm',
      digest: digestA,
      uri: 'https://example.invalid/attestor/alerts/shadow-http',
    },
    expiresAt: '2026-05-21T12:10:00.000Z',
  };
}

export async function seedShadowState(app: Hono): Promise<{
  readonly reportId: string;
  readonly candidateId: string;
  readonly handoff: ShadowCustomerActivationHandoff;
  readonly receiptId: string;
}> {
  const simulationResponse = await postJson(app, '/api/v1/shadow/simulations', {
    proposedMode: 'review',
  });
  const simulation = await simulationResponse.json() as {
    readonly persisted: { readonly record: { readonly reportId: string } };
  };

  const materializeResponse = await app.request('/api/v1/shadow/policy-candidates/materialize', {
    method: 'POST',
  });
  const materialize = await materializeResponse.json() as {
    readonly persisted: { readonly records: readonly { readonly candidateId: string }[] };
  };
  const candidateId = materialize.persisted.records[0]?.candidateId ?? '';

  await patchJson(app, `/api/v1/shadow/policy-candidates/${encodeURIComponent(candidateId)}/status`, {
    status: 'proposed',
    actorRef: 'operator:shadow-http',
    reason: 'Move candidate to proposed for route coverage.',
  });
  await patchJson(app, `/api/v1/shadow/policy-candidates/${encodeURIComponent(candidateId)}/status`, {
    status: 'approved',
    actorRef: 'operator:shadow-http',
    reason: 'Move candidate to approved for route coverage.',
  });

  const handoffResponse = await postJson(
    app,
    '/api/v1/shadow/customer-activation-handoff?status=approved',
    handoffBody(),
  );
  const handoff = await handoffResponse.json() as {
    readonly handoff: ShadowCustomerActivationHandoff;
  };

  const receiptResponse = await postJson(app, '/api/v1/shadow/customer-activation-receipt', {
    handoffId: handoff.handoff.handoffId,
    handoffDigest: handoff.handoff.digest,
    activationStatus: 'activated',
    attemptedAt: '2026-05-21T09:11:00.000Z',
    observedAt: '2026-05-21T09:12:00.000Z',
    completedAt: '2026-05-21T09:13:00.000Z',
    activationDigest: digestB,
    externalReceiptDigest: digestC,
    rollbackStatus: 'not-triggered',
    killSwitchStatus: 'verified',
    monitoringStatus: 'healthy',
  });
  const receipt = await receiptResponse.json() as {
    readonly receipt: { readonly receiptId: string };
  };

  return {
    reportId: simulation.persisted.record.reportId,
    candidateId,
    handoff: handoff.handoff,
    receiptId: receipt.receipt.receiptId,
  };
}
