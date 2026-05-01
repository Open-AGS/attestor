import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicyPromotionSimulation,
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

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-promotion-simulation-'));
const candidatePath = join(tempDir, 'shadow-policy-candidates.json');

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_policy_simulation',
  tenantName: 'Shadow Policy Simulation Tenant',
  authenticatedAt: '2026-05-02T12:00:00.000Z',
  source: 'api_key',
  planId: 'community',
  monthlyRunQuota: 100,
};

function createSafeEvent(index: number): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: `2026-05-02T12:0${index}:00.000Z`,
      decidedAt: `2026-05-02T12:0${index}:01.000Z`,
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
    occurredAt: `2026-05-02T12:0${index}:02.000Z`,
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
    now: () => '2026-05-02T12:05:00.000Z',
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
  equal((await transition(app, candidateId, 'proposed')).status, 200, 'Promotion simulation route: candidate can be proposed');
  equal((await transition(app, candidateId, 'approved')).status, 200, 'Promotion simulation route: candidate can be approved');
}

async function testPromotionSimulationBlocksWithoutApprovedCandidates(): Promise<void> {
  const app = createApp(Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)));
  await materializeCandidate(app);
  const response = await app.request('/api/v1/shadow/policy-promotion-simulation');
  const body = await response.json() as {
    readonly productionReady: boolean;
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly simulation: {
      readonly simulationReady: boolean;
      readonly activationReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
      readonly ruleSimulations: readonly unknown[];
    };
  };

  equal(response.status, 200, 'Promotion simulation route: unapproved packet simulation returns 200');
  equal(body.productionReady, false, 'Promotion simulation route: route is not production-ready');
  equal(body.autoEnforce, false, 'Promotion simulation route: route does not auto-enforce');
  equal(body.rawPayloadStored, false, 'Promotion simulation route: route is data-minimized');
  equal(body.simulation.simulationReady, false, 'Promotion simulation route: simulation waits for approved candidate');
  equal(body.simulation.activationReady, false, 'Promotion simulation route: activation is still false');
  ok(body.simulation.remainingActivationBlockers.includes('source-draft-ready'), 'Promotion simulation route: source draft blocker remains');
  ok(body.simulation.remainingActivationBlockers.includes('policy-simulation-no-rules'), 'Promotion simulation route: empty rules are explicit');
  equal(body.simulation.ruleSimulations.length, 0, 'Promotion simulation route: no rule simulations without approved candidates');
}

async function testPromotionSimulationReplaysApprovedPacketWithoutRawPayload(): Promise<void> {
  const app = createApp(Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)));
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);
  const response = await app.request('/api/v1/shadow/policy-promotion-simulation');
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly simulation: {
      readonly simulationId: string;
      readonly sourcePacketDigest: string;
      readonly sourceBundleDraftDigest: string;
      readonly eventCount: number;
      readonly matchedEventCount: number;
      readonly unmatchedEventCount: number;
      readonly evaluationCount: number;
      readonly impactCounts: {
        readonly admit: number;
        readonly audit: number;
        readonly warn: number;
        readonly holdForReview: number;
        readonly block: number;
      };
      readonly simulationReady: boolean;
      readonly activationReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
      readonly ruleSimulations: readonly {
        readonly candidateId: string;
        readonly targetMode: string;
        readonly eventCount: number;
        readonly matchedEventDigests: readonly string[];
        readonly suggestedValidationActions: readonly string[];
        readonly impactCounts: {
          readonly admit: number;
          readonly audit: number;
          readonly warn: number;
          readonly holdForReview: number;
          readonly block: number;
        };
        readonly simulationNotes: readonly string[];
      }[];
      readonly digest: string;
    };
  };
  const rule = body.simulation.ruleSimulations[0];

  equal(response.status, 200, 'Promotion simulation route: approved packet simulation returns 200');
  ok(body.simulation.simulationId.startsWith('policy-promotion-simulation:sha256:'), 'Promotion simulation route: simulation id is digest-bound');
  ok(body.simulation.sourcePacketDigest.startsWith('sha256:'), 'Promotion simulation route: source packet digest is carried');
  ok(body.simulation.sourceBundleDraftDigest.startsWith('sha256:'), 'Promotion simulation route: source bundle digest is carried');
  equal(body.simulation.eventCount, 5, 'Promotion simulation route: event count is carried');
  equal(body.simulation.matchedEventCount, 5, 'Promotion simulation route: all events match the approved rule');
  equal(body.simulation.unmatchedEventCount, 0, 'Promotion simulation route: no unmatched event remains');
  equal(body.simulation.evaluationCount, 5, 'Promotion simulation route: evaluation count is per matched rule-event');
  equal(body.simulation.impactCounts.admit, 5, 'Promotion simulation route: enforce preview would admit clean events');
  equal(body.simulation.impactCounts.audit, 0, 'Promotion simulation route: enforce preview does not only audit');
  equal(body.simulation.impactCounts.warn, 0, 'Promotion simulation route: enforce preview does not warn');
  equal(body.simulation.impactCounts.holdForReview, 0, 'Promotion simulation route: enforce preview has no review hold');
  equal(body.simulation.impactCounts.block, 0, 'Promotion simulation route: enforce preview has no block');
  equal(body.simulation.simulationReady, true, 'Promotion simulation route: approved packet is simulation-ready');
  equal(body.simulation.activationReady, false, 'Promotion simulation route: activation remains false');
  ok(!body.simulation.remainingActivationBlockers.includes('policy-simulation-required'), 'Promotion simulation route: simulation-required gate is closed by artifact');
  ok(body.simulation.remainingActivationBlockers.includes('bundle-signature-required'), 'Promotion simulation route: signing remains required');
  ok(body.simulation.remainingActivationBlockers.includes('downstream-verification-required'), 'Promotion simulation route: downstream verification remains required');
  equal(rule?.candidateId, candidateId, 'Promotion simulation route: rule references approved candidate');
  equal(rule?.targetMode, 'enforce', 'Promotion simulation route: promotion candidate targets enforce rehearsal');
  equal(rule?.eventCount, 5, 'Promotion simulation route: rule sees all matching events');
  equal(rule?.matchedEventDigests.length, 5, 'Promotion simulation route: rule carries event digests');
  ok(rule?.suggestedValidationActions.includes('enforce-decision'), 'Promotion simulation route: enforce target maps to enforce-decision action');
  ok(rule?.suggestedValidationActions.includes('audit'), 'Promotion simulation route: enforce target still carries audit action');
  equal(rule?.impactCounts.admit, 5, 'Promotion simulation route: rule admits clean events');
  ok(rule?.simulationNotes.includes('enforce-preview-not-activation'), 'Promotion simulation route: enforce preview is not activation');
  ok(body.simulation.digest.startsWith('sha256:'), 'Promotion simulation route: simulation digest is present');
  ok(!text.includes('raw_customer_value_must_not_escape'), 'Promotion simulation route: raw recipient is not exported');
  ok(!text.includes('raw_feature_value_must_not_escape'), 'Promotion simulation route: raw feature is not exported');
  ok(!text.includes('order:1'), 'Promotion simulation route: raw evidence id is not exported');
}

async function testPromotionSimulationRejectsUnsafeSourceStatus(): Promise<void> {
  const app = createApp(Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)));
  const response = await app.request('/api/v1/shadow/policy-promotion-simulation?status=draft');
  const body = await response.json() as {
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Promotion simulation route: draft source status is rejected');
  ok(
    body.reasonCodes.includes('invalid-policy-promotion-source-status'),
    'Promotion simulation route: invalid source status has reason code',
  );
}

function testPromotionSimulationModuleRejectsTooManyEvents(): void {
  assert.throws(
    () => createShadowPolicyPromotionSimulation({
      packet: {
        version: 'attestor.shadow-policy-promotion-packet.v1',
        packetId: 'policy-promotion-packet:sha256:test',
        tenantId: tenant.tenantId,
        generatedAt: '2026-05-02T12:05:00.000Z',
        sourceDraftVersion: 'attestor.shadow-policy-promotion-draft.v1',
        sourceDraftDigest: 'sha256:draft',
        sourceStatus: 'approved',
        sourceCandidateDigests: [],
        sourceReportIds: [],
        sourceReportDigests: [],
        bundleDraft: {
          version: 'attestor.shadow-policy-bundle-draft.v1',
          activationState: 'not-activated',
          signatureStatus: 'unsigned',
          signatureRequired: true,
          sourceDraftDigest: 'sha256:draft',
          targetModes: [],
          ruleCount: 0,
          rules: [],
          canonical: '{}',
          digest: 'sha256:bundle',
        },
        gates: [],
        reviewReady: false,
        activationReady: false,
        activationBlockers: ['policy-simulation-required'],
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        productionReady: false,
        canonical: '{}',
        digest: 'sha256:packet',
      },
      events: Array.from({ length: 10_001 }, (_, index) => createSafeEvent((index % 5) + 1)),
      generatedAt: '2026-05-02T12:05:00.000Z',
    }),
    /event count exceeds maximum/u,
    'Promotion simulation module: oversized event sets fail closed',
  );
  passed += 1;
}

try {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPromotionSimulationBlocksWithoutApprovedCandidates();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPromotionSimulationReplaysApprovedPacketWithoutRawPayload();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPromotionSimulationRejectsUnsafeSourceStatus();
  testPromotionSimulationModuleRejectsTooManyEvents();

  console.log(`Shadow policy promotion simulation tests: ${passed} passed, 0 failed`);
} finally {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
