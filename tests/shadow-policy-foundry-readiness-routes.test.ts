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
    redTeamReplay: {
      status: string;
      caseCount: number;
      failedCaseCount: number;
    };
    readiness: {
      status: string;
      approvalRequired: boolean;
      autoEnforce: boolean;
      noGoReasons: readonly string[];
      recommendedRolloutStep: string;
      confidence: { redTeamReplayStatus: string };
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
  equal(body.redTeamReplay.status, 'passed', 'Policy Foundry readiness route: computes red-team replay status');
  ok(body.redTeamReplay.caseCount >= 10, 'Policy Foundry readiness route: computed replay case count is returned');
  equal(body.redTeamReplay.failedCaseCount, 0, 'Policy Foundry readiness route: clean computed replay has no failures');
  equal(
    body.readiness.confidence.redTeamReplayStatus,
    body.redTeamReplay.status,
    'Policy Foundry readiness route: readiness uses computed replay status',
  );
  ok(
    body.readiness.noGoReasons.includes('customer-approval-required'),
    'Policy Foundry readiness route: missing customer approval is explicit',
  );
  ok(
    !body.readiness.noGoReasons.includes('red-team-replay-not-run'),
    'Policy Foundry readiness route: computed red-team replay removes self-attested not-run state',
  );
  ok(!text.includes('ops-agent-'), 'Policy Foundry readiness route: raw actor IDs are not returned');
  ok(!text.includes('raw_recipient_must_not_escape'), 'Policy Foundry readiness route: raw recipient is not returned');
  ok(!text.includes('raw_feature_must_not_escape'), 'Policy Foundry readiness route: raw feature values are not returned');
}

async function testApprovedAndReplayedRouteCanBecomeScopedEnforceEligible(): Promise<void> {
  const app = createApp(cleanEvents());
  const response = await app.request(
    '/api/v1/shadow/policy-foundry/readiness?customerApproved=true',
  );
  const body = await response.json() as {
    readiness: {
      status: string;
      recommendedRolloutStep: string;
      noGoReasons: readonly string[];
      confidence: { actorDistributionHealth: string; redTeamReplayStatus: string };
    };
    redTeamReplay: { status: string };
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
    body.redTeamReplay.status,
    'Policy Foundry readiness route: red-team replay status is computed and retained',
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
    '/api/v1/shadow/policy-foundry/readiness?customerApproved=true',
  );
  const body = await response.json() as {
    readiness: {
      status: string;
      noGoReasons: readonly string[];
      activeQuestions: readonly { kind: string }[];
      confidence: { redTeamReplayStatus: string };
    };
    redTeamReplay: { status: string; failedCaseCount: number };
  };

  equal(response.status, 200, 'Policy Foundry readiness route: concentrated sample returns 200');
  equal(body.readiness.status, 'no-go', 'Policy Foundry readiness route: concentrated sample is no-go');
  ok(
    body.readiness.noGoReasons.includes('single-actor-concentration'),
    'Policy Foundry readiness route: concentration no-go is explicit',
  );
  equal(body.redTeamReplay.status, 'failed', 'Policy Foundry readiness route: concentrated sample fails computed replay');
  ok(body.redTeamReplay.failedCaseCount > 0, 'Policy Foundry readiness route: concentrated replay failure count is returned');
  ok(
    body.readiness.noGoReasons.includes('red-team-replay-failed'),
    'Policy Foundry readiness route: failed computed replay becomes no-go',
  );
  equal(
    body.readiness.confidence.redTeamReplayStatus,
    'failed',
    'Policy Foundry readiness route: readiness records failed computed replay',
  );
  ok(
    body.readiness.activeQuestions.some((question) => question.kind === 'confirm-representative-sample'),
    'Policy Foundry readiness route: concentration asks representative sample question',
  );
}

async function testInvalidReadinessQueryFailsClosed(): Promise<void> {
  const app = createApp(cleanEvents());
  const response = await app.request(
    '/api/v1/shadow/policy-foundry/readiness?redTeamReplayStatus=passed',
  );
  const body = await response.json() as {
    reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Policy Foundry readiness route: caller-supplied replay status returns 400');
  ok(
    body.reasonCodes.includes('policy-foundry-red-team-status-computed'),
    'Policy Foundry readiness route: computed replay status reason is explicit',
  );
}

async function testActiveQuestionRouteIsDataMinimizedAndPrioritized(): Promise<void> {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: `support-agent-${index % 3}`,
      occurredAt: `2026-05-07T22:${String(index).padStart(2, '0')}:02.000Z`,
      policyRef: null,
      evidenceRefs: [],
    }),
  );
  const app = createApp(events);
  const response = await app.request('/api/v1/shadow/policy-foundry/active-questions');
  const text = await response.text();
  const body = JSON.parse(text) as {
    productionReady: boolean;
    approvalRequired: boolean;
    autoEnforce: boolean;
    rawPayloadStored: boolean;
    decisionSupportOnly: boolean;
    candidateSelection: { matched: boolean; candidateCount: number };
    redTeamReplay: { status: string; failedCaseCount: number };
    readiness: { status: string; digest: string };
    activeQuestionPacket: {
      status: string;
      questionCount: number;
      omittedQuestionCount: number;
      readinessDigest: string;
      rawPayloadStored: boolean;
      decisionSupportOnly: boolean;
      questions: readonly {
        kind: string;
        expectedAnswerKind: string;
        blocksReasonCodes: readonly string[];
      }[];
    };
  };

  equal(response.status, 200, 'Policy Foundry active questions route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Policy Foundry active questions route: response is no-store');
  equal(body.productionReady, false, 'Policy Foundry active questions route: production readiness is not overclaimed');
  equal(body.approvalRequired, true, 'Policy Foundry active questions route: approval is required');
  equal(body.autoEnforce, false, 'Policy Foundry active questions route: route never auto-enforces');
  equal(body.rawPayloadStored, false, 'Policy Foundry active questions route: raw payload boundary is explicit');
  equal(body.decisionSupportOnly, true, 'Policy Foundry active questions route: output is decision support only');
  equal(body.candidateSelection.matched, true, 'Policy Foundry active questions route: candidate is selected');
  ok(body.candidateSelection.candidateCount > 0, 'Policy Foundry active questions route: candidates are derived from shadow traffic');
  equal(body.redTeamReplay.status, 'failed', 'Policy Foundry active questions route: replay status is computed');
  ok(body.redTeamReplay.failedCaseCount > 0, 'Policy Foundry active questions route: replay failures are retained');
  equal(body.activeQuestionPacket.status, 'questions-required', 'Policy Foundry active questions route: missing controls produce questions');
  equal(body.activeQuestionPacket.rawPayloadStored, false, 'Policy Foundry active questions route: packet stores no raw payload');
  equal(body.activeQuestionPacket.decisionSupportOnly, true, 'Policy Foundry active questions route: packet is decision support only');
  equal(body.activeQuestionPacket.questionCount, 3, 'Policy Foundry active questions route: packet asks only top three questions');
  ok(body.activeQuestionPacket.omittedQuestionCount > 0, 'Policy Foundry active questions route: omitted questions are counted');
  equal(
    body.activeQuestionPacket.readinessDigest,
    body.readiness.digest,
    'Policy Foundry active questions route: packet binds readiness digest',
  );
  ok(
    body.activeQuestionPacket.questions.some((question) => question.kind === 'choose-policy-template'),
    'Policy Foundry active questions route: policy template question is included',
  );
  ok(
    body.activeQuestionPacket.questions.some((question) => question.expectedAnswerKind === 'evidence-source-ref'),
    'Policy Foundry active questions route: evidence source question is included',
  );
  ok(
    body.activeQuestionPacket.questions.every((question) => question.blocksReasonCodes.length > 0),
    'Policy Foundry active questions route: each question maps to blocking reasons',
  );
  ok(!text.includes('support-agent-'), 'Policy Foundry active questions route: raw actor IDs are not returned');
  ok(!text.includes('raw_recipient_must_not_escape'), 'Policy Foundry active questions route: raw recipient is not returned');
  ok(!text.includes('raw_feature_must_not_escape'), 'Policy Foundry active questions route: raw feature values are not returned');
}

async function testRedTeamReplayRouteIsDataMinimized(): Promise<void> {
  const app = createApp(cleanEvents());
  const response = await app.request('/api/v1/shadow/policy-foundry/red-team-replay');
  const text = await response.text();
  const body = JSON.parse(text) as {
    tenant: { tenantId: string };
    approvalRequired: boolean;
    autoEnforce: boolean;
    rawPayloadStored: boolean;
    decisionSupportOnly: boolean;
    candidateSelection: { matched: boolean };
    replay: {
      status: string;
      caseCount: number;
      failedCaseCount: number;
      rawPayloadStored: boolean;
      evidenceReplayOnly: boolean;
    };
  };

  equal(response.status, 200, 'Policy Foundry red-team route: valid request returns 200');
  equal(response.headers.get('cache-control'), 'no-store', 'Policy Foundry red-team route: response is no-store');
  equal(body.tenant.tenantId, 'tenant_policy_foundry', 'Policy Foundry red-team route: tenant context is included');
  equal(body.approvalRequired, true, 'Policy Foundry red-team route: approval is required');
  equal(body.autoEnforce, false, 'Policy Foundry red-team route: route never auto-enforces');
  equal(body.rawPayloadStored, false, 'Policy Foundry red-team route: raw payload boundary is explicit');
  equal(body.decisionSupportOnly, true, 'Policy Foundry red-team route: output is decision support only');
  equal(body.candidateSelection.matched, true, 'Policy Foundry red-team route: default candidate is selected');
  equal(body.replay.status, 'passed', 'Policy Foundry red-team route: clean replay passes');
  equal(body.replay.failedCaseCount, 0, 'Policy Foundry red-team route: clean replay has no failed cases');
  equal(body.replay.rawPayloadStored, false, 'Policy Foundry red-team route: replay output stays data-minimized');
  equal(body.replay.evidenceReplayOnly, true, 'Policy Foundry red-team route: evidence replay limitation is explicit');
  ok(body.replay.caseCount >= 10, 'Policy Foundry red-team route: case set is returned');
  ok(!text.includes('ops-agent-'), 'Policy Foundry red-team route: raw actor IDs are not returned');
  ok(!text.includes('raw_recipient_must_not_escape'), 'Policy Foundry red-team route: raw recipient is not returned');
  ok(!text.includes('raw_feature_must_not_escape'), 'Policy Foundry red-team route: raw feature values are not returned');
}

await testReadinessRouteIsDataMinimizedAndApprovalRequired();
await testApprovedAndReplayedRouteCanBecomeScopedEnforceEligible();
await testSingleActorRouteBlocksEnforcement();
await testInvalidReadinessQueryFailsClosed();
await testActiveQuestionRouteIsDataMinimizedAndPrioritized();
await testRedTeamReplayRouteIsDataMinimized();

console.log(`Shadow Policy Foundry readiness route tests: ${passed} passed, 0 failed`);
