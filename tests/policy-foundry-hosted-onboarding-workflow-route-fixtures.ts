import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import {
  HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE,
  HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_SESSION_ROUTE,
  HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_VIEW_ROUTE,
  registerPolicyFoundryHostedOnboardingRoutes,
} from '../src/service/http/routes/policy-foundry-hosted-onboarding-routes.js';
import { createPipelineIdempotencyService } from '../src/service/application/pipeline-idempotency-service.js';
import type { PipelineIdempotencyService } from '../src/service/application/pipeline-idempotency-service.js';
import {
  ensurePipelineIdempotencyStateReady,
  lookupPipelineIdempotencyState,
  recordPipelineIdempotencyState,
} from '../src/service/control-plane-store.js';
import { hashJsonValue } from '../src/service/json-stable.js';
import { resetPipelineIdempotencyStoreForTests } from '../src/service/pipeline/pipeline-idempotency-store.js';
import { createFileBackedPolicyFoundryHostedWizardStateStore } from '../src/service/policy-foundry/policy-foundry-hosted-wizard-state.js';
import type { HostedBillingEntitlementRecord } from '../src/service/billing/billing-entitlement-store.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';
import type { WorkflowEntitlementRecord } from '../src/service/workflow-entitlement.js';

let passed = 0;

export function passedCount(): number {
  return passed;
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

export function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to include: ${expected}`,
  );
  passed += 1;
}

export function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

export function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export const tenantA: TenantContext = {
  tenantId: 'tenant_foundry_route_a',
  tenantName: 'Policy Foundry Route Tenant A',
  authenticatedAt: '2026-05-13T09:00:00.000Z',
  source: 'api_key',
  planId: 'trial',
  monthlyRunQuota: 100,
};

export const tenantB: TenantContext = {
  ...tenantA,
  tenantId: 'tenant_foundry_route_b',
  tenantName: 'Policy Foundry Route Tenant B',
};

export function createEvent(tenant: TenantContext): ShadowAdmissionEvent {
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

export function createApp(input: {
  readonly routeTenant?: TenantContext;
  readonly events?: readonly ShadowAdmissionEvent[];
  readonly wizardStateStore?: ReturnType<typeof createFileBackedPolicyFoundryHostedWizardStateStore>;
  readonly pipelineIdempotencyService?: PipelineIdempotencyService;
  readonly billingEntitlement?: HostedBillingEntitlementRecord | null;
  readonly billingResolverConfigured?: boolean;
  readonly workflowEntitlement?: WorkflowEntitlementRecord | null;
  readonly workflowResolverConfigured?: boolean;
} = {}): Hono {
  const app = new Hono();
  const events = input.events ?? [createEvent(tenantA)];
  registerPolicyFoundryHostedOnboardingRoutes(app, {
    currentTenant: () => input.routeTenant ?? tenantA,
    listShadowEvents: ({ tenant }) =>
      events.filter((event) => event.tenantId === tenant.tenantId || event.tenantId === null),
    resolveBillingEntitlement: input.billingResolverConfigured
      ? () => input.billingEntitlement ?? null
      : undefined,
    resolveWorkflowEntitlement: input.workflowResolverConfigured
      ? () => input.workflowEntitlement ?? null
      : undefined,
    wizardStateStore: input.wizardStateStore,
    pipelineIdempotencyService: input.pipelineIdempotencyService,
    now: () => '2026-05-13T09:01:00.000Z',
  });
  return app;
}

export function workflowEntitlement(overrides: Partial<WorkflowEntitlementRecord> = {}): WorkflowEntitlementRecord {
  return {
    workflowId: 'wf_foundry_route',
    tier: 'starter-workflow',
    status: 'active',
    consequencePack: 'money-movement',
    stripeCustomerId: 'cus_foundry_route',
    stripeSubscriptionId: 'sub_foundry_route',
    stripeSubscriptionItemId: 'si_foundry_route',
    stripePriceId: 'price_starter_workflow_monthly',
    stripeOveragePriceId: 'price_starter_workflow_overage',
    customerGateProofPresent: true,
    ...overrides,
  };
}

export function withPipelineIdempotencyEnv(): () => void {
  const previous = new Map<string, string | undefined>();
  const overrides: Record<string, string | undefined> = {
    ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY: 'policy-foundry-wizard-idempotency-test-key',
    ATTESTOR_PIPELINE_IDEMPOTENCY_STORE_PATH: join(
      tmpdir(),
      `attestor-policy-foundry-wizard-idempotency-${randomUUID()}.json`,
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

export function entitlement(overrides: Partial<HostedBillingEntitlementRecord> = {}): HostedBillingEntitlementRecord {
  return {
    id: 'ent_foundry_route',
    accountId: 'acct_foundry_route',
    tenantId: tenantA.tenantId,
    provider: 'stripe',
    status: 'active',
    accessEnabled: true,
    effectivePlanId: 'trial',
    requestedPlanId: 'trial',
    monthlyRunQuota: 100,
    requestsPerWindow: 100,
    asyncPendingJobsPerTenant: 2,
    accountStatus: 'active',
    stripeCustomerId: 'cus_foundry_route',
    stripeSubscriptionId: 'sub_foundry_route',
    stripeSubscriptionStatus: 'active',
    stripePriceId: 'price_starter_workflow_monthly',
    stripeCheckoutSessionId: 'cs_foundry_route',
    stripeInvoiceId: 'in_foundry_route',
    stripeInvoiceStatus: 'paid',
    stripeEntitlementLookupKeys: [],
    stripeEntitlementFeatureIds: [],
    stripeEntitlementSummaryUpdatedAt: '2026-05-13T08:59:00.000Z',
    lastEventId: 'evt_foundry_route',
    lastEventType: 'entitlements.active_entitlement_summary.updated',
    lastEventAt: '2026-05-13T08:59:00.000Z',
    effectiveAt: '2026-05-13T08:59:00.000Z',
    delinquentSince: null,
    reason: 'subscription_active',
    createdAt: '2026-05-13T08:00:00.000Z',
    updatedAt: '2026-05-13T08:59:00.000Z',
    ...overrides,
  };
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

export function baseRequestBody() {
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

type RedTeamCase = {
  readonly caseId: string;
  readonly kind: string;
  readonly expectedOutcome: string;
};

export function passingReplayObservations(cases: readonly RedTeamCase[]) {
  return cases.map((entry) => ({
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
}

export function passingLiveDownstreamReplayObservations(cases: readonly RedTeamCase[]) {
  return cases.map((entry) => ({
    caseId: entry.caseId,
    observedOutcome: entry.expectedOutcome,
    observedAt: '2026-05-13T09:02:30.000Z',
    executionMode: 'gateway-proxy-sandbox',
    environment: 'sandbox',
    evidenceDigest: digest(`live:${entry.caseId}`),
    dryRunProofDigest: digest(`dry-run:${entry.caseId}`),
    downstreamReceiptDigest: digest(`receipt:${entry.caseId}`),
    reasonCodes: [`fixture:${entry.kind}`, 'dry-run:confirmed'],
    rawPayloadStored: false,
    downstreamMutationAttempted: false,
    credentialMaterialUsed: false,
    productionTrafficAttempted: false,
    dryRunConfirmed: true,
    sandboxBoundaryVerified: true,
    unapprovedNetworkEgress: false,
  }));
}

export async function testHostedRouteRendersStatelessReviewWorkflow(): Promise<void> {
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
    readonly liveDownstreamReplay: null;
    readonly commercialBoundary: {
      readonly plan: string;
      readonly noGoReasons: readonly string[];
    };
    readonly billingEntitlementEnforcement: {
      readonly enforcementMode: string;
      readonly entitlementResolverConfigured: boolean;
      readonly commercialPlanForBoundary: string;
      readonly noGoReasons: readonly string[];
      readonly productionReady: boolean;
    };
  };

  equal(response.status, 200, 'Policy Foundry hosted route: request succeeds');
  equal(response.headers.get('cache-control'), 'no-store', 'Policy Foundry hosted route: response is no-store');
  equal(body.tenant.tenantDigest, digest(tenantA.tenantId), 'Policy Foundry hosted route: tenant is digest-only');
  equal(body.tenant.planId, 'trial', 'Policy Foundry hosted route: tenant plan is retained as non-secret context');
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
  equal(body.liveDownstreamReplay, null, 'Policy Foundry hosted route: omitted live downstream replay observations stay missing');
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
  equal(body.commercialBoundary.plan, 'trial', 'Policy Foundry hosted route: commercial boundary uses trial tenant plan');
  equal(body.commercialBoundary.noGoReasons.length, 0, 'Policy Foundry hosted route: trial evaluation request is allowed for requested review capabilities');
  equal(body.billingEntitlementEnforcement.enforcementMode, 'tenant-context-only', 'Policy Foundry hosted route: entitlement enforcement mode is explicit when resolver is absent');
  equal(body.billingEntitlementEnforcement.entitlementResolverConfigured, false, 'Policy Foundry hosted route: missing resolver is not hidden');
  equal(body.billingEntitlementEnforcement.commercialPlanForBoundary, 'trial', 'Policy Foundry hosted route: tenant trial feeds boundary without resolver');
  equal(body.billingEntitlementEnforcement.noGoReasons.length, 0, 'Policy Foundry hosted route: evaluation request is not blocked by absent resolver');
  equal(body.billingEntitlementEnforcement.productionReady, false, 'Policy Foundry hosted route: billing entitlement enforcement does not claim readiness');
  excludes(text, /raw_prompt_must_not_escape/u, 'Policy Foundry hosted route: raw OpenAPI descriptions are not emitted');
  excludes(text, /rk_live_must_not_escape/u, 'Policy Foundry hosted route: secret-like manifest text is not emitted');
  excludes(text, /C:\/Users\/thedi\/private/u, 'Policy Foundry hosted route: caller source path is not emitted');
  excludes(text, /tenant_foundry_route_a/u, 'Policy Foundry hosted route: raw tenant id is not emitted');
}

export function testDocsAndScriptsExposeHostedWorkflowRoute(): void {
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  const docs = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
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
    docs,
    HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE,
    'Policy Foundry hosted route: architecture docs name route',
  );
  includes(
    matrixTest,
    "['src', 'service', 'http', 'routes', 'policy-foundry-hosted-onboarding-routes.ts']",
    'Policy Foundry hosted route: authorization matrix inventories route file',
  );
}
