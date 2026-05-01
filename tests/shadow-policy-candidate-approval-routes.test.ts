import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import { registerShadowRoutes } from '../src/service/http/routes/shadow-routes.js';
import {
  createFileBackedShadowPolicyCandidateStore,
  resetShadowPersistenceStoresForTests,
  type ShadowPolicyCandidateStatus,
} from '../src/service/shadow-persistence-store.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-approval-routes-'));
const candidatePath = join(tempDir, 'shadow-policy-candidates.json');

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_approval',
  tenantName: 'Shadow Approval Tenant',
  authenticatedAt: '2026-05-02T09:00:00.000Z',
  source: 'api_key',
  planId: 'community',
  monthlyRunQuota: 100,
};

function createEvent(): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: '2026-05-02T09:01:00.000Z',
      decidedAt: '2026-05-02T09:01:01.000Z',
      recipient: 'raw_customer_value_must_not_escape',
      evidenceRefs: ['order:987'],
      policyRef: null,
      observedFeatures: {
        rawMarker: 'raw_feature_value_must_not_escape',
      },
    }),
    occurredAt: '2026-05-02T09:01:02.000Z',
    downstreamOutcome: 'proceeded',
    observedFeatures: {
      rawMarker: 'raw_feature_value_must_not_escape',
    },
  });
}

function createApp(events: readonly ShadowAdmissionEvent[]): Hono {
  const candidateStore = createFileBackedShadowPolicyCandidateStore({ path: candidatePath });
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => tenant,
    listShadowEvents: ({ tenant: routeTenant }) =>
      routeTenant.tenantId === tenant.tenantId ? events : [],
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
    now: () => '2026-05-02T09:05:00.000Z',
  });
  return app;
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

async function testMaterializeListAndTransitionLifecycle(): Promise<void> {
  const app = createApp([createEvent()]);
  const materializeResponse = await app.request('/api/v1/shadow/policy-candidates/materialize', {
    method: 'POST',
  });
  const materializeText = await materializeResponse.text();
  const materializeBody = JSON.parse(materializeText) as {
    readonly candidateCount: number;
    readonly approvalRequired: boolean;
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly persisted: {
      readonly createdCount: number;
      readonly records: readonly {
        readonly candidateId: string;
        readonly status: string;
        readonly approvalRequired: boolean;
        readonly autoEnforce: boolean;
        readonly rawPayloadStored: boolean;
      }[];
      readonly path?: string;
    };
  };
  const candidateId = materializeBody.persisted.records[0]?.candidateId ?? '';
  const listResponse = await app.request('/api/v1/shadow/policy-candidate-records?status=draft');
  const listText = await listResponse.text();
  const listBody = JSON.parse(listText) as {
    readonly recordCount: number;
    readonly productionReady: boolean;
    readonly records: readonly { readonly candidateId: string; readonly status: string }[];
  };
  const invalidDirectActivation = await transition(app, candidateId, 'activated');
  const proposedResponse = await transition(app, candidateId, 'proposed');
  const approvedResponse = await transition(app, candidateId, 'approved');
  const activatedResponse = await transition(app, candidateId, 'activated');
  const activatedText = await activatedResponse.text();
  const activatedBody = JSON.parse(activatedText) as {
    readonly approvalRequired: boolean;
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly record: {
      readonly status: string;
      readonly statusHistory: readonly unknown[];
      readonly approvalRequired: boolean;
      readonly autoEnforce: boolean;
      readonly rawPayloadStored: boolean;
    };
  };

  equal(materializeResponse.status, 200, 'Policy candidate approval route: materialize returns 200');
  ok(materializeBody.candidateCount > 0, 'Policy candidate approval route: candidates are generated');
  ok(materializeBody.persisted.createdCount > 0, 'Policy candidate approval route: candidates are persisted');
  equal(materializeBody.approvalRequired, true, 'Policy candidate approval route: bundle requires approval');
  equal(materializeBody.autoEnforce, false, 'Policy candidate approval route: bundle does not auto-enforce');
  equal(materializeBody.rawPayloadStored, false, 'Policy candidate approval route: materialize remains data-minimized');
  equal(materializeBody.persisted.records[0]?.status, 'draft', 'Policy candidate approval route: persisted candidate starts as draft');
  equal(materializeBody.persisted.records[0]?.approvalRequired, true, 'Policy candidate approval route: record requires approval');
  equal(materializeBody.persisted.records[0]?.autoEnforce, false, 'Policy candidate approval route: record does not auto-enforce');
  equal(materializeBody.persisted.records[0]?.rawPayloadStored, false, 'Policy candidate approval route: record raw payload boundary is explicit');
  equal(materializeBody.persisted.path, undefined, 'Policy candidate approval route: local store path is not exposed');
  ok(!materializeText.includes('raw_customer_value_must_not_escape'), 'Policy candidate approval route: raw recipient is not materialized');
  ok(!materializeText.includes('raw_feature_value_must_not_escape'), 'Policy candidate approval route: raw feature is not materialized');
  ok(!materializeText.includes('order:987'), 'Policy candidate approval route: raw evidence id is not materialized');

  equal(listResponse.status, 200, 'Policy candidate approval route: list returns 200');
  equal(listBody.recordCount, 1, 'Policy candidate approval route: list filters by status');
  equal(listBody.productionReady, false, 'Policy candidate approval route: list is explicit about evaluation storage');
  equal(listBody.records[0]?.candidateId, candidateId, 'Policy candidate approval route: list returns candidate id');
  ok(!listText.includes('raw_customer_value_must_not_escape'), 'Policy candidate approval route: raw recipient is not listed');

  equal(invalidDirectActivation.status, 409, 'Policy candidate approval route: draft cannot activate directly');
  equal(proposedResponse.status, 200, 'Policy candidate approval route: candidate can be proposed');
  equal(approvedResponse.status, 200, 'Policy candidate approval route: candidate can be approved');
  equal(activatedResponse.status, 200, 'Policy candidate approval route: approved candidate can be activated');
  equal(activatedBody.approvalRequired, true, 'Policy candidate approval route: activation response requires approval');
  equal(activatedBody.autoEnforce, false, 'Policy candidate approval route: activation response does not auto-enforce');
  equal(activatedBody.rawPayloadStored, false, 'Policy candidate approval route: activation response is data-minimized');
  equal(activatedBody.record.status, 'activated', 'Policy candidate approval route: record status is activated');
  equal(activatedBody.record.statusHistory.length, 4, 'Policy candidate approval route: status history is retained');
  equal(activatedBody.record.approvalRequired, true, 'Policy candidate approval route: activated record requires approval boundary');
  equal(activatedBody.record.autoEnforce, false, 'Policy candidate approval route: activated record does not auto-enforce');
  equal(activatedBody.record.rawPayloadStored, false, 'Policy candidate approval route: activated record is data-minimized');
  ok(!activatedText.includes('raw_customer_value_must_not_escape'), 'Policy candidate approval route: raw recipient is not returned after transition');
}

async function testInvalidStatusInputsFailClosed(): Promise<void> {
  const app = createApp([createEvent()]);
  const materializeResponse = await app.request('/api/v1/shadow/policy-candidates/materialize', {
    method: 'POST',
  });
  const materializeBody = await materializeResponse.json() as {
    readonly persisted: {
      readonly records: readonly { readonly candidateId: string }[];
    };
  };
  const candidateId = materializeBody.persisted.records[0]?.candidateId ?? '';
  const invalidList = await app.request('/api/v1/shadow/policy-candidate-records?status=force');
  const invalidBody = await app.request(`/api/v1/shadow/policy-candidates/${encodeURIComponent(candidateId)}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      status: 'force',
      actorRef: 'operator:bad',
      reason: 'Invalid status.',
    }),
  });
  const missingReason = await app.request(`/api/v1/shadow/policy-candidates/${encodeURIComponent(candidateId)}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      status: 'proposed',
      actorRef: 'operator:bad',
    }),
  });

  equal(invalidList.status, 400, 'Policy candidate approval route: invalid list status is rejected');
  equal(invalidBody.status, 400, 'Policy candidate approval route: invalid body status is rejected');
  equal(missingReason.status, 400, 'Policy candidate approval route: missing reason is rejected');
}

try {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testMaterializeListAndTransitionLifecycle();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testInvalidStatusInputsFailClosed();

  console.log(`Shadow policy candidate approval route tests: ${passed} passed, 0 failed`);
} finally {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
