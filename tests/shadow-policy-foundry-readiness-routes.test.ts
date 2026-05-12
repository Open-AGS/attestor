import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import { registerShadowRoutes } from '../src/service/http/routes/shadow-routes.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function event(input: {
  readonly actor: string;
  readonly occurredAt: string;
  readonly humanOutcome?: 'not-reviewed' | 'approved' | 'rejected';
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: input.actor,
      action: 'rotate_secret',
      domain: 'system-operation',
      downstreamSystem: 'secret-manager',
      requestedAt: input.occurredAt,
      decidedAt: input.occurredAt,
      requestId: `request:${input.actor}:${input.occurredAt}`,
      policyRef: input.policyRef === undefined ? 'policy:ops:v1' : input.policyRef,
      evidenceRefs: input.evidenceRefs ?? ['change:approved'],
      recipient: 'raw_recipient_must_not_escape',
      observedFeatures: {
        secretMarker: 'raw_feature_must_not_escape',
      },
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: input.humanOutcome === 'rejected' ? 'blocked' : 'proceeded',
    humanOutcome: input.humanOutcome ?? 'not-reviewed',
    observedFeatures: {
      secretMarker: 'raw_feature_must_not_escape',
    },
  });
}

function cleanEvents(): readonly ShadowAdmissionEvent[] {
  return Array.from({ length: 24 }, (_, index) =>
    event({
      actor: `ops-agent-${index % 4}`,
      occurredAt: `2026-05-01T22:${String(index).padStart(2, '0')}:02.000Z`,
      humanOutcome: index % 4 === 0 ? 'approved' : 'not-reviewed',
    }),
  );
}

function createApp(events: readonly ShadowAdmissionEvent[]): Hono {
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_policy_foundry',
      tenantName: 'Policy Foundry Tenant',
      authenticatedAt: '2026-05-01T21:10:00.000Z',
      source: 'api_key',
      planId: 'trial',
      monthlyRunQuota: 5_000,
    }),
    listShadowEvents: ({ tenant }) =>
      tenant.tenantId === 'tenant_policy_foundry' ? events : [],
    listShadowSimulations: () => [],
    now: () => '2026-05-01T23:02:00.000Z',
  });
  return app;
}

async function testReadinessRouteIsDataMinimizedAndApprovalRequired(): Promise<void> {
  const app = createApp(cleanEvents());
  const response = await app.request('/api/v1/shadow/policy-foundry/readiness');
  const text = await response.text();
  const body = JSON.parse(text) as {
    tenant: { tenantId: string };
    productionReady: boolean;
    approvalRequired: boolean;
    autoEnforce: boolean;
    rawPayloadStored: boolean;
    decisionSupportOnly: boolean;
    candidateSelection: { matched: boolean; candidateCount: number };
    readiness: {
      status: string;
      approvalRequired: boolean;
      autoEnforce: boolean;
      noGoReasons: readonly string[];
      recommendedRolloutStep: string;
    };
  };

  equal(response.status, 200, 'Policy Foundry readiness route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Policy Foundry readiness route: response is no-store');
  equal(body.tenant.tenantId, 'tenant_policy_foundry', 'Policy Foundry readiness route: tenant context is included');
  equal(body.productionReady, false, 'Policy Foundry readiness route: production readiness is not overclaimed');
  equal(body.approvalRequired, true, 'Policy Foundry readiness route: approval is required');
  equal(body.autoEnforce, false, 'Policy Foundry readiness route: route never auto-enforces');
  equal(body.rawPayloadStored, false, 'Policy Foundry readiness route: raw payload boundary is explicit');
  equal(body.decisionSupportOnly, true, 'Policy Foundry readiness route: output is decision support only');
  equal(body.candidateSelection.matched, true, 'Policy Foundry readiness route: default candidate is selected');
  ok(body.candidateSelection.candidateCount > 0, 'Policy Foundry readiness route: candidates are derived from shadow traffic');
  equal(body.readiness.approvalRequired, true, 'Policy Foundry readiness route: readiness keeps approval required');
  equal(body.readiness.autoEnforce, false, 'Policy Foundry readiness route: readiness never auto-enforces');
  ok(
    body.readiness.noGoReasons.includes('customer-approval-required'),
    'Policy Foundry readiness route: missing customer approval is explicit',
  );
  ok(
    body.readiness.noGoReasons.includes('red-team-replay-not-run'),
    'Policy Foundry readiness route: missing red-team replay is explicit',
  );
  ok(!text.includes('ops-agent-'), 'Policy Foundry readiness route: raw actor IDs are not returned');
  ok(!text.includes('raw_recipient_must_not_escape'), 'Policy Foundry readiness route: raw recipient is not returned');
  ok(!text.includes('raw_feature_must_not_escape'), 'Policy Foundry readiness route: raw feature values are not returned');
}

async function testApprovedAndReplayedRouteCanBecomeScopedEnforceEligible(): Promise<void> {
  const app = createApp(cleanEvents());
  const response = await app.request(
    '/api/v1/shadow/policy-foundry/readiness?customerApproved=true&redTeamReplayStatus=passed',
  );
  const body = await response.json() as {
    readiness: {
      status: string;
      recommendedRolloutStep: string;
      noGoReasons: readonly string[];
      confidence: { actorDistributionHealth: string; redTeamReplayStatus: string };
    };
  };

  equal(response.status, 200, 'Policy Foundry readiness route: approved replayed request returns 200');
  equal(body.readiness.status, 'enforce-eligible', 'Policy Foundry readiness route: clean approved sample can be enforce eligible');
  equal(
    body.readiness.recommendedRolloutStep,
    'scoped-enforce-low-risk',
    'Policy Foundry readiness route: enforce starts scoped',
  );
  equal(body.readiness.noGoReasons.length, 0, 'Policy Foundry readiness route: clean approved sample has no no-go reasons');
  equal(
    body.readiness.confidence.actorDistributionHealth,
    'healthy',
    'Policy Foundry readiness route: distributed actors are healthy',
  );
  equal(
    body.readiness.confidence.redTeamReplayStatus,
    'passed',
    'Policy Foundry readiness route: red-team replay status is retained',
  );
}

async function testSingleActorRouteBlocksEnforcement(): Promise<void> {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: 'single-operator-agent',
      occurredAt: `2026-05-02T22:${String(index).padStart(2, '0')}:02.000Z`,
    }),
  );
  const app = createApp(events);
  const response = await app.request(
    '/api/v1/shadow/policy-foundry/readiness?customerApproved=true&redTeamReplayStatus=passed',
  );
  const body = await response.json() as {
    readiness: {
      status: string;
      noGoReasons: readonly string[];
      activeQuestions: readonly { kind: string }[];
    };
  };

  equal(response.status, 200, 'Policy Foundry readiness route: concentrated sample returns 200');
  equal(body.readiness.status, 'no-go', 'Policy Foundry readiness route: concentrated sample is no-go');
  ok(
    body.readiness.noGoReasons.includes('single-actor-concentration'),
    'Policy Foundry readiness route: concentration no-go is explicit',
  );
  ok(
    body.readiness.activeQuestions.some((question) => question.kind === 'confirm-representative-sample'),
    'Policy Foundry readiness route: concentration asks representative sample question',
  );
}

async function testInvalidReadinessQueryFailsClosed(): Promise<void> {
  const app = createApp(cleanEvents());
  const response = await app.request(
    '/api/v1/shadow/policy-foundry/readiness?redTeamReplayStatus=maybe',
  );
  const body = await response.json() as {
    reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Policy Foundry readiness route: invalid replay status returns 400');
  ok(
    body.reasonCodes.includes('invalid-policy-foundry-red-team-status'),
    'Policy Foundry readiness route: invalid replay status reason is explicit',
  );
}

await testReadinessRouteIsDataMinimizedAndApprovalRequired();
await testApprovedAndReplayedRouteCanBecomeScopedEnforceEligible();
await testSingleActorRouteBlocksEnforcement();
await testInvalidReadinessQueryFailsClosed();

console.log(`Shadow Policy Foundry readiness route tests: ${passed} passed, 0 failed`);
