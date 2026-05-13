import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import {
  HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE,
  HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_VIEW_ROUTE,
  registerPolicyFoundryHostedOnboardingRoutes,
} from '../src/service/http/routes/policy-foundry-hosted-onboarding-routes.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to include: ${expected}`,
  );
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

const tenantA: TenantContext = {
  tenantId: 'tenant_foundry_route_a',
  tenantName: 'Policy Foundry Route Tenant A',
  authenticatedAt: '2026-05-13T09:00:00.000Z',
  source: 'api_key',
  planId: 'starter',
  monthlyRunQuota: 100,
};

const tenantB: TenantContext = {
  ...tenantA,
  tenantId: 'tenant_foundry_route_b',
  tenantName: 'Policy Foundry Route Tenant B',
};

function createEvent(tenant: TenantContext): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: '2026-05-13T09:00:00.000Z',
      decidedAt: '2026-05-13T09:00:01.000Z',
      evidenceRefs: ['order:123'],
      policyRef: 'policy:refunds:v1',
    }),
    occurredAt: '2026-05-13T09:00:02.000Z',
  });
}

function createApp(input: {
  readonly routeTenant?: TenantContext;
  readonly events?: readonly ShadowAdmissionEvent[];
} = {}): Hono {
  const app = new Hono();
  const events = input.events ?? [createEvent(tenantA)];
  registerPolicyFoundryHostedOnboardingRoutes(app, {
    currentTenant: () => input.routeTenant ?? tenantA,
    listShadowEvents: ({ tenant }) =>
      events.filter((event) => event.tenantId === tenant.tenantId || event.tenantId === null),
    now: () => '2026-05-13T09:01:00.000Z',
  });
  return app;
}

function openApiManifest(): string {
  return JSON.stringify({
    openapi: '3.1.0',
    info: { title: 'Refund API', version: '1.0.0' },
    paths: {
      '/refunds': {
        post: {
          operationId: 'issueRefund',
          description: 'raw_prompt_must_not_escape rk_live_must_not_escape',
          responses: { '200': { description: 'ok' } },
        },
      },
    },
  });
}

function baseRequestBody() {
  return {
    manifests: [
      {
        text: openApiManifest(),
        sourceRef: 'C:/Users/thedi/private/refunds.openapi.json',
        manifestKind: 'openapi',
      },
    ],
    defaultDomain: 'money-movement',
    downstreamSystem: 'refund-service',
    credentialPosture: 'agent-held-static-secret',
    requestedCapabilities: ['basic-shadow-summary', 'active-questions'],
  };
}

async function testHostedRouteRendersStatelessReviewWorkflow(): Promise<void> {
  const app = createApp();
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(baseRequestBody()),
  });
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly tenant: { readonly tenantDigest: string; readonly planId: string };
    readonly storageMode: string;
    readonly route: string;
    readonly hostedWorkflowRouteImplemented: boolean;
    readonly rawPayloadStored: boolean;
    readonly productionReady: boolean;
    readonly includedShadowEvents: boolean;
    readonly selfOnboardingPacket: {
      readonly surfaceCount: number;
      readonly shadowEventCount: number;
      readonly redTeamCaseCount: number;
      readonly rawPayloadStored: boolean;
      readonly productionReady: boolean;
    };
    readonly workflow: {
      readonly status: string;
      readonly hostedRouteImplemented: boolean;
      readonly hostedUiImplemented: boolean;
      readonly noGoReasons: readonly string[];
      readonly currentStepIds: readonly string[];
      readonly productionReady: boolean;
      readonly digest: string;
    };
    readonly reviewSurface: {
      readonly status: string;
      readonly workflowDigest: string;
      readonly headline: string;
      readonly taskCards: readonly { readonly stepId: string; readonly priority: string }[];
      readonly noGoCards: readonly { readonly reason: string }[];
      readonly evidenceCards: readonly { readonly evidenceKind: string }[];
      readonly fullPacketRequiredForImplementation: boolean;
      readonly productionReady: boolean;
      readonly hostedUiImplemented: boolean;
    };
    readonly adversarialReplay: null;
    readonly commercialBoundary: {
      readonly plan: string;
      readonly noGoReasons: readonly string[];
    };
  };

  equal(response.status, 200, 'Policy Foundry hosted route: request succeeds');
  equal(response.headers.get('cache-control'), 'no-store', 'Policy Foundry hosted route: response is no-store');
  equal(body.tenant.tenantDigest, digest(tenantA.tenantId), 'Policy Foundry hosted route: tenant is digest-only');
  equal(body.tenant.planId, 'starter', 'Policy Foundry hosted route: tenant plan is retained as non-secret context');
  equal(body.storageMode, 'stateless-review-workflow', 'Policy Foundry hosted route: storage mode is stateless');
  equal(body.route, HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, 'Policy Foundry hosted route: route id is returned');
  equal(body.hostedWorkflowRouteImplemented, true, 'Policy Foundry hosted route: route wrapper is implemented');
  equal(body.rawPayloadStored, false, 'Policy Foundry hosted route: raw payload storage is false');
  equal(body.productionReady, false, 'Policy Foundry hosted route: production readiness is false');
  equal(body.includedShadowEvents, true, 'Policy Foundry hosted route: shadow events are included by default');
  equal(body.selfOnboardingPacket.surfaceCount > 0, true, 'Policy Foundry hosted route: surfaces are discovered');
  equal(body.selfOnboardingPacket.shadowEventCount, 1, 'Policy Foundry hosted route: tenant shadow event is consumed');
  equal(body.selfOnboardingPacket.redTeamCaseCount > 0, true, 'Policy Foundry hosted route: red-team fixtures are generated');
  equal(body.selfOnboardingPacket.rawPayloadStored, false, 'Policy Foundry hosted route: self-onboarding packet is raw-free');
  equal(body.selfOnboardingPacket.productionReady, false, 'Policy Foundry hosted route: self-onboarding packet is not production-ready');
  equal(body.adversarialReplay, null, 'Policy Foundry hosted route: omitted replay observations stay missing');
  equal(body.workflow.status, 'customer-action-required', 'Policy Foundry hosted route: missing replay requires action');
  equal(body.workflow.hostedRouteImplemented, false, 'Policy Foundry hosted route: workflow contract still does not claim its own route');
  equal(body.workflow.hostedUiImplemented, false, 'Policy Foundry hosted route: hosted UI is not claimed');
  equal(body.workflow.productionReady, false, 'Policy Foundry hosted route: workflow is not production-ready');
  equal(body.reviewSurface.status, body.workflow.status, 'Policy Foundry hosted route: review surface status follows workflow');
  equal(body.reviewSurface.workflowDigest, body.workflow.digest, 'Policy Foundry hosted route: review surface binds workflow digest');
  equal(body.reviewSurface.headline, 'Customer action required', 'Policy Foundry hosted route: review surface headline is compact');
  equal(body.reviewSurface.fullPacketRequiredForImplementation, true, 'Policy Foundry hosted route: compact surface requires full packet for implementation');
  equal(body.reviewSurface.productionReady, false, 'Policy Foundry hosted route: review surface is not production-ready');
  equal(body.reviewSurface.hostedUiImplemented, false, 'Policy Foundry hosted route: review surface does not claim UI');
  ok(
    body.workflow.noGoReasons.includes('adversarial-replay-missing'),
    'Policy Foundry hosted route: missing replay is a no-go',
  );
  ok(
    body.workflow.currentStepIds.includes('adversarial-replay'),
    'Policy Foundry hosted route: adversarial replay remains due',
  );
  ok(
    body.reviewSurface.taskCards.some((task) => task.stepId === 'adversarial-replay'),
    'Policy Foundry hosted route: review surface exposes adversarial replay task',
  );
  ok(
    body.reviewSurface.noGoCards.some((card) => card.reason === 'adversarial-replay-missing'),
    'Policy Foundry hosted route: review surface exposes replay no-go',
  );
  ok(
    body.reviewSurface.evidenceCards.some((card) => card.evidenceKind === 'selfOnboardingPacketDigest'),
    'Policy Foundry hosted route: review surface exposes source evidence digest card',
  );
  equal(body.commercialBoundary.plan, 'starter', 'Policy Foundry hosted route: commercial boundary uses tenant plan');
  equal(body.commercialBoundary.noGoReasons.length, 0, 'Policy Foundry hosted route: starter request is allowed for requested review capabilities');
  excludes(text, /raw_prompt_must_not_escape/u, 'Policy Foundry hosted route: raw OpenAPI descriptions are not emitted');
  excludes(text, /rk_live_must_not_escape/u, 'Policy Foundry hosted route: secret-like manifest text is not emitted');
  excludes(text, /C:\/Users\/thedi\/private/u, 'Policy Foundry hosted route: caller source path is not emitted');
  excludes(text, /tenant_foundry_route_a/u, 'Policy Foundry hosted route: raw tenant id is not emitted');
}

async function testHostedRouteRendersHtmlViewFromSameWorkflow(): Promise<void> {
  const app = createApp();
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_VIEW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(baseRequestBody()),
  });
  const html = await response.text();

  equal(response.status, 200, 'Policy Foundry hosted view route: request succeeds');
  equal(response.headers.get('cache-control'), 'no-store', 'Policy Foundry hosted view route: response is no-store');
  includes(
    response.headers.get('content-type') ?? '',
    'text/html',
    'Policy Foundry hosted view route: content type is HTML',
  );
  includes(html, 'Policy Foundry hosted onboarding', 'Policy Foundry hosted view route: HTML identity is visible');
  includes(html, 'Customer action required', 'Policy Foundry hosted view route: review surface headline renders');
  includes(html, 'Adversarial replay', 'Policy Foundry hosted view route: current task renders');
  includes(html, 'adversarial-replay-missing', 'Policy Foundry hosted view route: no-go condition renders');
  includes(html, 'Review material only', 'Policy Foundry hosted view route: review-only boundary renders');
  excludes(html, /raw_prompt_must_not_escape/u, 'Policy Foundry hosted view route: raw OpenAPI descriptions are not emitted');
  excludes(html, /rk_live_must_not_escape/u, 'Policy Foundry hosted view route: secret-like manifest text is not emitted');
  excludes(html, /C:\/Users\/thedi\/private/u, 'Policy Foundry hosted view route: caller source path is not emitted');
  excludes(html, /tenant_foundry_route_a/u, 'Policy Foundry hosted view route: raw tenant id is not emitted');
}

async function testHostedRouteCanAcceptPassingReplayObservations(): Promise<void> {
  const app = createApp();
  const first = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(baseRequestBody()),
  });
  const firstBody = await first.json() as {
    readonly selfOnboardingPacket: {
      readonly redTeamFixtures: {
        readonly cases: readonly {
          readonly caseId: string;
          readonly kind: string;
          readonly expectedOutcome: string;
        }[];
      };
    };
  };
  const observations = firstBody.selfOnboardingPacket.redTeamFixtures.cases.map((entry) => ({
    caseId: entry.caseId,
    observedOutcome: entry.expectedOutcome,
    observedAt: '2026-05-13T09:02:00.000Z',
    executionMode: 'synthetic-local',
    evidenceDigest: digest(entry.caseId),
    reasonCodes: [`fixture:${entry.kind}`],
    rawPayloadStored: false,
    downstreamMutationAttempted: false,
    credentialMaterialUsed: false,
  }));
  const second = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...baseRequestBody(),
      adversarialReplayObservations: observations,
      reviewedStepIds: ['surface-map', 'adversarial-replay', 'patch-review'],
    }),
  });
  const secondBody = await second.json() as {
    readonly adversarialReplay: {
      readonly status: string;
      readonly observedCaseCount: number;
      readonly missingCaseCount: number;
      readonly productionReady: boolean;
      readonly executesProductionTraffic: boolean;
    };
    readonly workflow: {
      readonly noGoReasons: readonly string[];
      readonly sourceDigests: { readonly adversarialReplayDigest: string | null };
      readonly productionReady: boolean;
    };
    readonly reviewSurface: {
      readonly workflowDigest: string;
      readonly noGoCards: readonly { readonly reason: string }[];
      readonly productionReady: boolean;
    };
  };

  equal(second.status, 200, 'Policy Foundry hosted route: passing replay request succeeds');
  equal(secondBody.adversarialReplay.status, 'passed', 'Policy Foundry hosted route: replay passes');
  equal(secondBody.adversarialReplay.observedCaseCount, observations.length, 'Policy Foundry hosted route: all observations are counted');
  equal(secondBody.adversarialReplay.missingCaseCount, 0, 'Policy Foundry hosted route: no replay cases are missing');
  equal(secondBody.adversarialReplay.productionReady, false, 'Policy Foundry hosted route: replay remains non-production');
  equal(secondBody.adversarialReplay.executesProductionTraffic, false, 'Policy Foundry hosted route: replay does not execute production traffic');
  ok(
    !secondBody.workflow.noGoReasons.includes('adversarial-replay-missing'),
    'Policy Foundry hosted route: replay missing no-go is cleared',
  );
  ok(
    secondBody.workflow.sourceDigests.adversarialReplayDigest?.startsWith('sha256:'),
    'Policy Foundry hosted route: replay digest is bound into workflow',
  );
  equal(secondBody.workflow.productionReady, false, 'Policy Foundry hosted route: passing replay still does not prove production readiness');
  equal(secondBody.reviewSurface.noGoCards.some((card) => card.reason === 'adversarial-replay-missing'), false, 'Policy Foundry hosted route: review surface clears replay-missing no-go');
  equal(secondBody.reviewSurface.productionReady, false, 'Policy Foundry hosted route: review surface still does not prove production readiness');
}

async function testHostedRouteKeepsTenantScopedShadowEvents(): Promise<void> {
  const app = createApp({
    routeTenant: tenantB,
    events: [createEvent(tenantA), createEvent(tenantB)],
  });
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ declarations: [] }),
  });
  const body = await response.json() as {
    readonly tenant: { readonly tenantDigest: string };
    readonly selfOnboardingPacket: {
      readonly shadowEventCount: number;
      readonly onboardingPacket: { readonly eventCount: number };
    };
  };

  equal(response.status, 200, 'Policy Foundry hosted route: tenant B request succeeds');
  equal(body.tenant.tenantDigest, digest(tenantB.tenantId), 'Policy Foundry hosted route: response is tenant B digest');
  equal(body.selfOnboardingPacket.shadowEventCount, 1, 'Policy Foundry hosted route: only tenant B events are included');
  equal(body.selfOnboardingPacket.onboardingPacket.eventCount, 1, 'Policy Foundry hosted route: onboarding packet stays tenant-scoped');
}

async function testHostedRouteRejectsInvalidReplayOutcome(): Promise<void> {
  const app = createApp();
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...baseRequestBody(),
      adversarialReplayObservations: [
        {
          caseId: 'case_invalid',
          observedOutcome: 'allow-everything',
        },
      ],
    }),
  });
  const body = await response.json() as {
    readonly decision: string;
    readonly failClosed: boolean;
    readonly reasonCodes: readonly string[];
    readonly detail: string;
  };

  equal(response.status, 400, 'Policy Foundry hosted route: invalid replay outcome returns 400');
  equal(body.decision, 'block', 'Policy Foundry hosted route: invalid input returns block problem');
  equal(body.failClosed, true, 'Policy Foundry hosted route: invalid input fails closed');
  ok(
    body.reasonCodes.includes('policy-foundry-hosted-onboarding-render-failed'),
    'Policy Foundry hosted route: invalid input has stable reason code',
  );
  includes(
    body.detail,
    'observedOutcome',
    'Policy Foundry hosted route: invalid input explains rejected field',
  );
}

async function testHostedRouteBlocksUnsafeAutomationRequests(): Promise<void> {
  const app = createApp();
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...baseRequestBody(),
      autoEnforceRequested: true,
      credentialIssuanceRequested: true,
      infrastructureDeployRequested: true,
      productionTrafficExecutionRequested: true,
      rawPayloadStorageRequested: true,
    }),
  });
  const body = await response.json() as {
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly productionReady: boolean;
    readonly activatesEnforcement: boolean;
    readonly issuesCredentials: boolean;
    readonly deploysInfrastructure: boolean;
    readonly executesProductionTraffic: boolean;
    readonly workflow: {
      readonly status: string;
      readonly noGoReasons: readonly string[];
    };
    readonly reviewSurface: {
      readonly status: string;
      readonly noGoCards: readonly { readonly reason: string }[];
    };
    readonly commercialBoundary: {
      readonly noGoReasons: readonly string[];
    };
  };

  equal(response.status, 200, 'Policy Foundry hosted route: unsafe request returns review material');
  equal(body.autoEnforce, false, 'Policy Foundry hosted route: top-level autoEnforce remains false');
  equal(body.rawPayloadStored, false, 'Policy Foundry hosted route: top-level rawPayloadStored remains false');
  equal(body.productionReady, false, 'Policy Foundry hosted route: top-level productionReady remains false');
  equal(body.activatesEnforcement, false, 'Policy Foundry hosted route: activation remains false');
  equal(body.issuesCredentials, false, 'Policy Foundry hosted route: credential issuance remains false');
  equal(body.deploysInfrastructure, false, 'Policy Foundry hosted route: deploy remains false');
  equal(body.executesProductionTraffic, false, 'Policy Foundry hosted route: production execution remains false');
  equal(body.workflow.status, 'blocked', 'Policy Foundry hosted route: unsafe requests block workflow');
  equal(body.reviewSurface.status, 'blocked', 'Policy Foundry hosted route: unsafe requests block review surface');
  for (const reason of [
    'auto-enforce-requested',
    'credential-issuance-requested',
    'infrastructure-deploy-requested',
    'production-traffic-execution-requested',
    'raw-payload-storage-requested',
  ] as const) {
    ok(body.workflow.noGoReasons.includes(reason), `Policy Foundry hosted route: ${reason} is recorded`);
  }
  ok(
    body.commercialBoundary.noGoReasons.includes('shadow-auto-enforce-requested'),
    'Policy Foundry hosted route: commercial boundary also rejects shadow auto-enforce',
  );
  ok(
    body.reviewSurface.noGoCards.some((card) => card.reason === 'auto-enforce-requested'),
    'Policy Foundry hosted route: review surface exposes unsafe automation blocker',
  );
}

function testDocsAndScriptsExposeHostedWorkflowRoute(): void {
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  const docs = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const readme = readProjectFile('README.md');
  const matrixTest = readProjectFile('tests', 'hosted-api-authorization-matrix.test.ts');

  equal(
    pkg.scripts['test:policy-foundry-hosted-onboarding-workflow-route'],
    'tsx tests/policy-foundry-hosted-onboarding-workflow-route.test.ts',
    'Policy Foundry hosted route: package test script is exposed',
  );
  includes(
    docs,
    HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE,
    'Policy Foundry hosted route: architecture docs name route',
  );
  includes(
    readme,
    HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE,
    'Policy Foundry hosted route: README names route',
  );
  includes(
    matrixTest,
    "['src', 'service', 'http', 'routes', 'policy-foundry-hosted-onboarding-routes.ts']",
    'Policy Foundry hosted route: authorization matrix inventories route file',
  );
}

try {
  await testHostedRouteRendersStatelessReviewWorkflow();
  await testHostedRouteRendersHtmlViewFromSameWorkflow();
  await testHostedRouteCanAcceptPassingReplayObservations();
  await testHostedRouteKeepsTenantScopedShadowEvents();
  await testHostedRouteRejectsInvalidReplayOutcome();
  await testHostedRouteBlocksUnsafeAutomationRequests();
  testDocsAndScriptsExposeHostedWorkflowRoute();
  console.log(`Policy Foundry hosted onboarding workflow route tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry hosted onboarding workflow route tests failed:', error);
  process.exitCode = 1;
}
