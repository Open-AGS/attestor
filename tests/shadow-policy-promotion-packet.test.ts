import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicyPromotionPacket,
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

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-promotion-packet-'));
const candidatePath = join(tempDir, 'shadow-policy-candidates.json');

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_packet',
  tenantName: 'Shadow Packet Tenant',
  authenticatedAt: '2026-05-02T11:00:00.000Z',
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
      requestedAt: '2026-05-02T11:01:00.000Z',
      decidedAt: '2026-05-02T11:01:01.000Z',
      recipient: 'raw_customer_value_must_not_escape',
      evidenceRefs: ['order:987'],
      policyRef: null,
      observedFeatures: {
        rawMarker: 'raw_feature_value_must_not_escape',
      },
    }),
    occurredAt: '2026-05-02T11:01:02.000Z',
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
    now: () => '2026-05-02T11:05:00.000Z',
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
  equal((await transition(app, candidateId, 'proposed')).status, 200, 'Promotion packet route: candidate can be proposed');
  equal((await transition(app, candidateId, 'approved')).status, 200, 'Promotion packet route: candidate can be approved');
}

async function testPromotionPacketShowsActivationBlockersBeforeApprovedCandidates(): Promise<void> {
  const app = createApp([createEvent()]);
  await materializeCandidate(app);
  const response = await app.request('/api/v1/shadow/policy-promotion-packet');
  const body = await response.json() as {
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly productionReady: boolean;
    readonly packet: {
      readonly reviewReady: boolean;
      readonly activationReady: boolean;
      readonly activationBlockers: readonly string[];
      readonly bundleDraft: {
        readonly ruleCount: number;
        readonly activationState: string;
        readonly signatureStatus: string;
      };
    };
  };

  equal(response.status, 200, 'Promotion packet route: empty approved set returns a packet artifact');
  equal(body.productionReady, false, 'Promotion packet route: route is not production-ready');
  equal(body.autoEnforce, false, 'Promotion packet route: route does not auto-enforce');
  equal(body.rawPayloadStored, false, 'Promotion packet route: route is data-minimized');
  equal(body.packet.reviewReady, false, 'Promotion packet route: review is blocked without approved candidates');
  equal(body.packet.activationReady, false, 'Promotion packet route: activation is always false in this slice');
  ok(body.packet.activationBlockers.includes('source-draft-ready'), 'Promotion packet route: source draft blocker is carried');
  ok(body.packet.activationBlockers.includes('policy-simulation-required'), 'Promotion packet route: policy simulation blocker is explicit');
  ok(body.packet.activationBlockers.includes('bundle-signature-required'), 'Promotion packet route: signature blocker is explicit');
  ok(body.packet.activationBlockers.includes('downstream-verification-required'), 'Promotion packet route: downstream verification blocker is explicit');
  equal(body.packet.bundleDraft.ruleCount, 0, 'Promotion packet route: no rules are emitted without approved candidates');
  equal(body.packet.bundleDraft.activationState, 'not-activated', 'Promotion packet route: bundle draft is not activated');
  equal(body.packet.bundleDraft.signatureStatus, 'unsigned', 'Promotion packet route: bundle draft is unsigned');
}

async function testPromotionPacketExportsPolicyBundleDraftWithoutRawPayload(): Promise<void> {
  const app = createApp([createEvent()]);
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);
  const response = await app.request('/api/v1/shadow/policy-promotion-packet');
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly packet: {
      readonly packetId: string;
      readonly sourceDraftDigest: string;
      readonly sourceReportDigests: readonly string[];
      readonly reviewReady: boolean;
      readonly activationReady: boolean;
      readonly activationBlockers: readonly string[];
      readonly gates: readonly { readonly gate: string; readonly status: string }[];
      readonly bundleDraft: {
        readonly digest: string;
        readonly sourceDraftDigest: string;
        readonly ruleCount: number;
        readonly targetModes: readonly string[];
        readonly signatureRequired: boolean;
        readonly signatureStatus: string;
        readonly rules: readonly {
          readonly candidateId: string;
          readonly candidateDigest: string;
          readonly sourceReportDigest: string | null;
          readonly targetMode: string;
          readonly suggestedValidationActions: readonly string[];
          readonly enforcementState: string;
          readonly approvalTrailDigest: string;
        }[];
      };
      readonly digest: string;
    };
  };
  const rule = body.packet.bundleDraft.rules[0];

  equal(response.status, 200, 'Promotion packet route: approved candidate packet returns 200');
  ok(body.packet.packetId.startsWith('policy-promotion-packet:sha256:'), 'Promotion packet route: packet id is digest-bound');
  ok(body.packet.sourceDraftDigest.startsWith('sha256:'), 'Promotion packet route: source draft digest is carried');
  equal(body.packet.sourceReportDigests.length, 1, 'Promotion packet route: source simulation digest is carried');
  equal(body.packet.reviewReady, true, 'Promotion packet route: approved draft is ready for promotion review');
  equal(body.packet.activationReady, false, 'Promotion packet route: packet is still not activation-ready');
  ok(!body.packet.activationBlockers.includes('source-draft-ready'), 'Promotion packet route: source draft gate passes after approval');
  ok(body.packet.activationBlockers.includes('policy-simulation-required'), 'Promotion packet route: policy simulation remains required');
  ok(body.packet.activationBlockers.includes('bundle-signature-required'), 'Promotion packet route: signing remains required');
  ok(body.packet.activationBlockers.includes('downstream-verification-required'), 'Promotion packet route: downstream verification remains required');
  ok(body.packet.gates.some((gate) => gate.gate === 'source-draft-ready' && gate.status === 'pass'), 'Promotion packet route: source gate passes');
  equal(body.packet.bundleDraft.sourceDraftDigest, body.packet.sourceDraftDigest, 'Promotion packet route: bundle draft binds source draft digest');
  equal(body.packet.bundleDraft.ruleCount, 1, 'Promotion packet route: one bundle draft rule is emitted');
  equal(body.packet.bundleDraft.signatureRequired, true, 'Promotion packet route: bundle draft requires signature');
  equal(body.packet.bundleDraft.signatureStatus, 'unsigned', 'Promotion packet route: bundle draft is unsigned');
  ok(body.packet.bundleDraft.digest.startsWith('sha256:'), 'Promotion packet route: bundle draft digest is present');
  equal(body.packet.bundleDraft.targetModes[0], 'observe', 'Promotion packet route: target mode is carried');
  equal(rule?.candidateId, candidateId, 'Promotion packet route: rule references candidate');
  ok(rule?.candidateDigest.startsWith('sha256:'), 'Promotion packet route: rule carries candidate digest');
  ok(rule?.sourceReportDigest?.startsWith('sha256:'), 'Promotion packet route: rule carries source report digest');
  equal(rule?.targetMode, 'observe', 'Promotion packet route: rule target mode is observe for draft-policy candidate');
  ok(rule?.suggestedValidationActions.includes('audit'), 'Promotion packet route: observe maps to audit action');
  equal(rule?.enforcementState, 'packet-draft-only', 'Promotion packet route: rule remains draft-only');
  ok(rule?.approvalTrailDigest.startsWith('sha256:'), 'Promotion packet route: approval trail digest is carried');
  ok(body.packet.digest.startsWith('sha256:'), 'Promotion packet route: packet digest is present');
  ok(!text.includes('raw_customer_value_must_not_escape'), 'Promotion packet route: raw recipient is not exported');
  ok(!text.includes('raw_feature_value_must_not_escape'), 'Promotion packet route: raw feature is not exported');
  ok(!text.includes('order:987'), 'Promotion packet route: raw evidence id is not exported');
}

async function testPromotionPacketSupportsActivatedSourceStatus(): Promise<void> {
  const app = createApp([createEvent()]);
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);
  equal((await transition(app, candidateId, 'activated')).status, 200, 'Promotion packet route: candidate can be activated');
  const response = await app.request('/api/v1/shadow/policy-promotion-packet?status=activated');
  const body = await response.json() as {
    readonly packet: {
      readonly sourceStatus: string;
      readonly reviewReady: boolean;
      readonly bundleDraft: { readonly ruleCount: number };
    };
  };

  equal(response.status, 200, 'Promotion packet route: activated source returns 200');
  equal(body.packet.sourceStatus, 'activated', 'Promotion packet route: activated source status is explicit');
  equal(body.packet.reviewReady, true, 'Promotion packet route: activated source is review-ready');
  equal(body.packet.bundleDraft.ruleCount, 1, 'Promotion packet route: activated source emits a rule');
}

async function testPromotionPacketRejectsUnsafeSourceStatus(): Promise<void> {
  const app = createApp([createEvent()]);
  const response = await app.request('/api/v1/shadow/policy-promotion-packet?status=draft');
  const body = await response.json() as {
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Promotion packet route: draft source status is rejected');
  ok(
    body.reasonCodes.includes('invalid-policy-promotion-source-status'),
    'Promotion packet route: invalid source status has reason code',
  );
}

function testPromotionPacketModuleRejectsInvalidTimestamp(): void {
  assert.throws(
    () => createShadowPolicyPromotionPacket({
      draft: {
        version: 'attestor.shadow-policy-promotion-draft.v1',
        tenantId: 'tenant_shadow_packet',
        generatedAt: '2026-05-02T11:05:00.000Z',
        sourceStatus: 'approved',
        candidateCount: 0,
        entryCount: 0,
        candidateDigests: [],
        sourceReportIds: [],
        sourceReportDigests: [],
        entries: [],
        blockers: ['no-approved-candidates'],
        promotionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        productionReady: false,
        canonical: '{}',
        digest: 'sha256:empty',
      },
      generatedAt: 'not-a-date',
    }),
    /generatedAt must be an ISO timestamp/u,
    'Promotion packet module: generatedAt must be valid',
  );
  passed += 1;
}

try {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPromotionPacketShowsActivationBlockersBeforeApprovedCandidates();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPromotionPacketExportsPolicyBundleDraftWithoutRawPayload();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPromotionPacketSupportsActivatedSourceStatus();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPromotionPacketRejectsUnsafeSourceStatus();
  testPromotionPacketModuleRejectsInvalidTimestamp();

  console.log(`Shadow policy promotion packet tests: ${passed} passed, 0 failed`);
} finally {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
