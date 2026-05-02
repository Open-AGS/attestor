import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowDownstreamVerificationBinding,
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

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-downstream-binding-'));
const candidatePath = join(tempDir, 'shadow-policy-candidates.json');

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_downstream_binding',
  tenantName: 'Shadow Downstream Binding Tenant',
  authenticatedAt: '2026-05-02T13:00:00.000Z',
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
      requestedAt: `2026-05-02T13:0${index}:00.000Z`,
      decidedAt: `2026-05-02T13:0${index}:01.000Z`,
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
    occurredAt: `2026-05-02T13:0${index}:02.000Z`,
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
    now: () => '2026-05-02T13:05:00.000Z',
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
  equal((await transition(app, candidateId, 'proposed')).status, 200, 'Downstream binding route: candidate can be proposed');
  equal((await transition(app, candidateId, 'approved')).status, 200, 'Downstream binding route: candidate can be approved');
}

async function testDownstreamBindingBlocksWithoutApprovedCandidates(): Promise<void> {
  const app = createApp(Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)));
  await materializeCandidate(app);
  const response = await app.request('/api/v1/shadow/downstream-verification-binding');
  const body = await response.json() as {
    readonly productionReady: boolean;
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly binding: {
      readonly downstreamVerificationDraftReady: boolean;
      readonly activationReady: boolean;
      readonly ruleBindings: readonly unknown[];
      readonly remainingActivationBlockers: readonly string[];
    };
  };

  equal(response.status, 200, 'Downstream binding route: unapproved candidate set returns 200');
  equal(body.productionReady, false, 'Downstream binding route: route is not production-ready');
  equal(body.autoEnforce, false, 'Downstream binding route: route does not auto-enforce');
  equal(body.rawPayloadStored, false, 'Downstream binding route: route is data-minimized');
  equal(body.binding.downstreamVerificationDraftReady, false, 'Downstream binding route: draft is blocked without approved candidates');
  equal(body.binding.activationReady, false, 'Downstream binding route: activation remains false');
  equal(body.binding.ruleBindings.length, 0, 'Downstream binding route: no rule bindings without approved candidates');
  ok(body.binding.remainingActivationBlockers.includes('downstream-verification-required'), 'Downstream binding route: downstream binding blocker remains');
  ok(body.binding.remainingActivationBlockers.includes('policy-simulation-no-rules'), 'Downstream binding route: empty simulation blocker remains');
}

async function testDownstreamBindingExportsVerifierContractWithoutRawPayload(): Promise<void> {
  const app = createApp(Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)));
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);
  const response = await app.request('/api/v1/shadow/downstream-verification-binding');
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly binding: {
      readonly bindingId: string;
      readonly tenantId: string;
      readonly sourceSimulationDigest: string;
      readonly sourcePacketDigest: string;
      readonly sourceBundleDraftDigest: string;
      readonly eventCount: number;
      readonly matchedEventCount: number;
      readonly ruleCount: number;
      readonly downstreamVerificationDraftReady: boolean;
      readonly activationReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
      readonly requiredVerificationChecks: readonly {
        readonly check: string;
        readonly bindingFields: readonly string[];
      }[];
      readonly ruleBindings: readonly {
        readonly ruleId: string;
        readonly sourceRuleDigest: string;
        readonly candidateId: string;
        readonly candidateDigest: string;
        readonly targetMode: string;
        readonly matchedEventCount: number;
        readonly matchedEventSetDigest: string;
        readonly requiredClaims: readonly string[];
        readonly failClosedOnMismatch: boolean;
      }[];
      readonly digest: string;
    };
  };
  const binding = body.binding;
  const rule = binding.ruleBindings[0];
  const checkNames = binding.requiredVerificationChecks.map((check) => check.check);

  equal(response.status, 200, 'Downstream binding route: approved candidate binding returns 200');
  ok(binding.bindingId.startsWith('downstream-verification-binding:sha256:'), 'Downstream binding route: binding id is digest-bound');
  equal(binding.tenantId, tenant.tenantId, 'Downstream binding route: tenant scope is carried');
  ok(binding.sourceSimulationDigest.startsWith('sha256:'), 'Downstream binding route: source simulation digest is carried');
  ok(binding.sourcePacketDigest.startsWith('sha256:'), 'Downstream binding route: source packet digest is carried');
  ok(binding.sourceBundleDraftDigest.startsWith('sha256:'), 'Downstream binding route: source bundle draft digest is carried');
  equal(binding.eventCount, 5, 'Downstream binding route: event count is carried');
  equal(binding.matchedEventCount, 5, 'Downstream binding route: matched event count is carried');
  equal(binding.ruleCount, 1, 'Downstream binding route: one rule binding is emitted');
  equal(binding.downstreamVerificationDraftReady, true, 'Downstream binding route: binding draft is ready after approved simulation');
  equal(binding.activationReady, false, 'Downstream binding route: activation remains false');
  ok(!binding.remainingActivationBlockers.includes('downstream-verification-required'), 'Downstream binding route: binding draft closes downstream-verification-required');
  ok(binding.remainingActivationBlockers.includes('downstream-integration-proof-required'), 'Downstream binding route: integration proof remains required');
  ok(binding.remainingActivationBlockers.includes('bundle-signature-required'), 'Downstream binding route: signing still remains required');
  ok(checkNames.includes('verify-artifact-signature'), 'Downstream binding route: artifact signature check is required');
  ok(checkNames.includes('verify-source-digests'), 'Downstream binding route: source digest check is required');
  ok(checkNames.includes('verify-replay-protection'), 'Downstream binding route: replay protection check is required');
  ok(checkNames.includes('hold-on-mismatch'), 'Downstream binding route: mismatch hold check is required');
  equal(rule?.candidateId, candidateId, 'Downstream binding route: rule binding references approved candidate');
  ok(rule?.sourceRuleDigest.startsWith('sha256:'), 'Downstream binding route: rule binding has source digest');
  ok(rule?.candidateDigest.startsWith('sha256:'), 'Downstream binding route: candidate digest is carried');
  equal(rule?.targetMode, 'enforce', 'Downstream binding route: enforce target mode is carried as a verifier input');
  equal(rule?.matchedEventCount, 5, 'Downstream binding route: matched event count is per rule');
  ok(rule?.matchedEventSetDigest.startsWith('sha256:'), 'Downstream binding route: matched event set digest is carried');
  ok(rule?.requiredClaims.includes('tenantId'), 'Downstream binding route: tenant claim is required');
  ok(rule?.requiredClaims.includes('sourceSimulationDigest'), 'Downstream binding route: simulation digest claim is required');
  ok(rule?.requiredClaims.includes('replayNonce'), 'Downstream binding route: replay nonce claim is required');
  equal(rule?.failClosedOnMismatch, true, 'Downstream binding route: rule binding fails closed on mismatch');
  ok(binding.digest.startsWith('sha256:'), 'Downstream binding route: binding digest is present');
  ok(!text.includes('raw_customer_value_must_not_escape'), 'Downstream binding route: raw recipient is not exported');
  ok(!text.includes('raw_feature_value_must_not_escape'), 'Downstream binding route: raw feature is not exported');
  ok(!text.includes('order:1'), 'Downstream binding route: raw evidence id is not exported');
}

async function testDownstreamBindingRejectsUnsafeSourceStatus(): Promise<void> {
  const app = createApp(Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)));
  const response = await app.request('/api/v1/shadow/downstream-verification-binding?status=draft');
  const body = await response.json() as {
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Downstream binding route: draft source status is rejected');
  ok(
    body.reasonCodes.includes('invalid-policy-promotion-source-status'),
    'Downstream binding route: invalid source status has reason code',
  );
}

function testDownstreamBindingModuleRejectsInvalidTimestamp(): void {
  assert.throws(
    () => createShadowDownstreamVerificationBinding({
      simulation: {
        version: 'attestor.shadow-policy-promotion-simulation.v1',
        simulationId: 'policy-promotion-simulation:sha256:test',
        generatedAt: '2026-05-02T13:05:00.000Z',
        sourcePacketId: 'policy-promotion-packet:sha256:test',
        sourcePacketDigest: 'sha256:packet',
        sourceBundleDraftDigest: 'sha256:bundle',
        tenantId: tenant.tenantId,
        eventCount: 0,
        matchedEventCount: 0,
        unmatchedEventCount: 0,
        evaluationCount: 0,
        impactCounts: {
          admit: 0,
          audit: 0,
          warn: 0,
          holdForReview: 0,
          block: 0,
        },
        ruleSimulations: [],
        simulationReady: false,
        activationReady: false,
        remainingActivationBlockers: ['downstream-verification-required'],
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        productionReady: false,
        canonical: '{}',
        digest: 'sha256:simulation',
      },
      generatedAt: 'not-a-date',
    }),
    /generatedAt must be an ISO timestamp/u,
    'Downstream binding module: generatedAt must be valid',
  );
  passed += 1;
}

try {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testDownstreamBindingBlocksWithoutApprovedCandidates();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testDownstreamBindingExportsVerifierContractWithoutRawPayload();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testDownstreamBindingRejectsUnsafeSourceStatus();
  testDownstreamBindingModuleRejectsInvalidTimestamp();

  console.log(`Shadow downstream verification binding tests: ${passed} passed, 0 failed`);
} finally {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
