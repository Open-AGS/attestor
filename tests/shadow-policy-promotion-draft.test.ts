import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicyPromotionDraft,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import { registerShadowRoutes } from '../src/service/http/routes/shadow-routes.js';
import {
  createFileBackedShadowPolicyCandidateStore,
  resetShadowPersistenceStoresForTests,
  type ShadowPolicyCandidateStatus,
} from '../src/service/shadow/shadow-persistence-store.js';
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

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-promotion-draft-'));
const candidatePath = join(tempDir, 'shadow-policy-candidates.json');

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_promotion',
  tenantName: 'Shadow Promotion Tenant',
  authenticatedAt: '2026-05-02T10:00:00.000Z',
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
      requestedAt: '2026-05-02T10:01:00.000Z',
      decidedAt: '2026-05-02T10:01:01.000Z',
      recipient: 'raw_customer_value_must_not_escape',
      evidenceRefs: ['order:987'],
      policyRef: null,
      observedFeatures: {
        rawMarker: 'raw_feature_value_must_not_escape',
      },
    }),
    occurredAt: '2026-05-02T10:01:02.000Z',
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
    now: () => '2026-05-02T10:05:00.000Z',
  });
  return app;
}

async function materializeCandidate(app: Hono): Promise<string> {
  const materializeResponse = await app.request('/api/v1/shadow/policy-candidates/materialize', {
    method: 'POST',
  });
  const materializeBody = await materializeResponse.json() as {
    readonly persisted: {
      readonly records: readonly { readonly candidateId: string }[];
    };
  };
  return materializeBody.persisted.records[0]?.candidateId ?? '';
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
  equal((await transition(app, candidateId, 'proposed')).status, 200, 'Promotion draft route: candidate can be proposed');
  equal((await transition(app, candidateId, 'approved')).status, 200, 'Promotion draft route: candidate can be approved');
}

async function testPromotionDraftWaitsForApprovedCandidates(): Promise<void> {
  const app = createApp([createEvent()]);
  await materializeCandidate(app);
  const response = await app.request('/api/v1/shadow/policy-promotion-draft');
  const body = await response.json() as {
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly productionReady: boolean;
    readonly draft: {
      readonly sourceStatus: string;
      readonly candidateCount: number;
      readonly promotionReady: boolean;
      readonly blockers: readonly string[];
      readonly autoEnforce: boolean;
      readonly rawPayloadStored: boolean;
      readonly productionReady: boolean;
    };
  };

  equal(response.status, 200, 'Promotion draft route: empty approved set still returns a draft artifact');
  equal(body.productionReady, false, 'Promotion draft route: route is not production-ready');
  equal(body.autoEnforce, false, 'Promotion draft route: route does not auto-enforce');
  equal(body.rawPayloadStored, false, 'Promotion draft route: route is data-minimized');
  equal(body.draft.sourceStatus, 'approved', 'Promotion draft route: default source status is approved');
  equal(body.draft.candidateCount, 0, 'Promotion draft route: draft candidates are excluded before approval');
  equal(body.draft.promotionReady, false, 'Promotion draft route: no approved candidate is not ready');
  ok(body.draft.blockers.includes('no-approved-candidates'), 'Promotion draft route: missing approved candidates is explicit');
  equal(body.draft.autoEnforce, false, 'Promotion draft route: draft artifact does not auto-enforce');
  equal(body.draft.rawPayloadStored, false, 'Promotion draft route: draft artifact is data-minimized');
  equal(body.draft.productionReady, false, 'Promotion draft route: draft artifact is evaluation-scoped');
}

async function testPromotionDraftExportsApprovedCandidateWithoutRawPayload(): Promise<void> {
  const app = createApp([createEvent()]);
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);
  const response = await app.request('/api/v1/shadow/policy-promotion-draft');
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly draft: {
      readonly candidateCount: number;
      readonly promotionReady: boolean;
      readonly blockers: readonly string[];
      readonly candidateDigests: readonly string[];
      readonly sourceReportDigests: readonly string[];
      readonly entries: readonly {
        readonly candidateId: string;
        readonly candidateDigest: string;
        readonly sourceReportDigest: string | null;
        readonly proposedMode: string;
        readonly enforcementState: string;
        readonly approvalStatus: string;
        readonly approverRefs: readonly string[];
        readonly approvalTrailDigest: string;
      }[];
      readonly digest: string;
    };
  };
  const entry = body.draft.entries[0];

  equal(response.status, 200, 'Promotion draft route: approved candidate draft returns 200');
  equal(body.draft.candidateCount, 1, 'Promotion draft route: approved candidate is included');
  equal(body.draft.promotionReady, true, 'Promotion draft route: approved candidate with source binding is ready for promotion review');
  equal(body.draft.blockers.length, 0, 'Promotion draft route: approved candidate has no draft blockers');
  equal(body.draft.candidateDigests.length, 1, 'Promotion draft route: candidate digest is carried');
  equal(body.draft.sourceReportDigests.length, 1, 'Promotion draft route: source report digest is carried');
  equal(entry?.candidateId, candidateId, 'Promotion draft route: entry references the approved candidate');
  ok(entry?.candidateDigest.startsWith('sha256:'), 'Promotion draft route: entry carries candidate digest');
  ok(entry?.sourceReportDigest?.startsWith('sha256:'), 'Promotion draft route: entry carries source simulation digest');
  equal(entry?.proposedMode, 'observe', 'Promotion draft route: entry keeps the proposed mode from the candidate');
  equal(entry?.enforcementState, 'draft-only', 'Promotion draft route: entry remains draft-only');
  equal(entry?.approvalStatus, 'approved', 'Promotion draft route: entry records approval status');
  ok(entry?.approverRefs.includes('operator:approved'), 'Promotion draft route: entry carries approval actor ref');
  ok(entry?.approvalTrailDigest.startsWith('sha256:'), 'Promotion draft route: approval trail is digest-bound');
  ok(body.draft.digest.startsWith('sha256:'), 'Promotion draft route: draft has deterministic digest');
  ok(!text.includes('raw_customer_value_must_not_escape'), 'Promotion draft route: raw recipient is not exported');
  ok(!text.includes('raw_feature_value_must_not_escape'), 'Promotion draft route: raw feature is not exported');
  ok(!text.includes('order:987'), 'Promotion draft route: raw evidence id is not exported');
}

async function testPromotionDraftSupportsActivatedSourceStatus(): Promise<void> {
  const app = createApp([createEvent()]);
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);
  equal((await transition(app, candidateId, 'activated')).status, 200, 'Promotion draft route: candidate can be activated');
  const response = await app.request('/api/v1/shadow/policy-promotion-draft?status=activated');
  const body = await response.json() as {
    readonly draft: {
      readonly sourceStatus: string;
      readonly candidateCount: number;
      readonly promotionReady: boolean;
      readonly entries: readonly { readonly approvalStatus: string }[];
    };
  };

  equal(response.status, 200, 'Promotion draft route: activated draft returns 200');
  equal(body.draft.sourceStatus, 'activated', 'Promotion draft route: activated source status is explicit');
  equal(body.draft.candidateCount, 1, 'Promotion draft route: activated candidate is included');
  equal(body.draft.promotionReady, true, 'Promotion draft route: activated candidate can produce review artifact');
  equal(body.draft.entries[0]?.approvalStatus, 'activated', 'Promotion draft route: entry records activated status');
}

async function testPromotionDraftRejectsUnsafeSourceStatus(): Promise<void> {
  const app = createApp([createEvent()]);
  const response = await app.request('/api/v1/shadow/policy-promotion-draft?status=draft');
  const body = await response.json() as {
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Promotion draft route: draft source status is rejected');
  ok(
    body.reasonCodes.includes('invalid-policy-promotion-source-status'),
    'Promotion draft route: invalid source status has reason code',
  );
}

function testPromotionDraftModuleRejectsEmptyTenant(): void {
  assert.throws(
    () => createShadowPolicyPromotionDraft({
      tenantId: ' ',
      records: [],
      generatedAt: '2026-05-02T10:05:00.000Z',
    }),
    /tenantId is required/u,
    'Promotion draft module: tenant id is required',
  );
  passed += 1;
}

try {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPromotionDraftWaitsForApprovedCandidates();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPromotionDraftExportsApprovedCandidateWithoutRawPayload();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPromotionDraftSupportsActivatedSourceStatus();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPromotionDraftRejectsUnsafeSourceStatus();
  testPromotionDraftModuleRejectsEmptyTenant();

  console.log(`Shadow policy promotion draft tests: ${passed} passed, 0 failed`);
} finally {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
