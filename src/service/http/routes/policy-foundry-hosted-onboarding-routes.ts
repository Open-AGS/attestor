import type { Context, Hono } from 'hono';
import {
  createConsequenceAdmissionProblem,
  createPolicyFoundryAdversarialReplayExecutor,
  createPolicyFoundryCommercialBoundary,
  createPolicyFoundryHostedOnboardingWorkflow,
  createPolicyFoundryHostedReviewSurface,
  createPolicyFoundryLiveDownstreamReplay,
  createPolicyFoundrySelfOnboardingCliPacket,
} from '../../../consequence-admission/index.js';
import { renderPolicyFoundryHostedUiFlow } from '../../policy-foundry/policy-foundry-hosted-ui.js';
import {
  createPolicyFoundryBillingEntitlementEnforcement,
} from '../../policy-foundry/policy-foundry-billing-entitlement-enforcement.js';
import type {
  PolicyFoundryHostedWizardStateRecord,
} from '../../policy-foundry/policy-foundry-hosted-wizard-state.js';
import {
  evaluateWorkflowEntitlementAccess,
} from '../../workflow-entitlement.js';
import type {
  PipelineIdempotencyReadyResult,
} from '../../application/pipeline-idempotency-service.js';
import type { TenantContext } from '../../tenant-isolation.js';
import {
  acceptsJsonRequestBody,
  secureHtmlResponseHeaders,
} from '../route-response-helpers.js';
import {
  assertTenantBoundShadowEvents,
  isRecord,
  MAX_HOSTED_CAPABILITIES,
  normalizeCapabilities,
  normalizeCommercialPlan,
  normalizeDeclarations,
  normalizeLiveDownstreamReplayObservations,
  normalizeManifestInputs,
  normalizeReadinessOverrides,
  normalizeReplayObservations,
  normalizeReviewedStepIds,
  normalizeStringArray,
  optionalBoolean,
  optionalIsoTimestamp,
  optionalNonNegativeInteger,
  optionalPositiveNumber,
  optionalString,
  type PolicyFoundryHostedOnboardingRouteDeps,
  tenantDigest,
  type HostedPolicyFoundryOnboardingRequestBody,
} from './policy-foundry-hosted-onboarding-input.js';

export type { PolicyFoundryHostedOnboardingRouteDeps } from './policy-foundry-hosted-onboarding-input.js';

export const HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE =
  '/api/v1/shadow/policy-foundry/hosted-onboarding-workflow';
export const HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_VIEW_ROUTE =
  '/api/v1/shadow/policy-foundry/hosted-onboarding-workflow/view';
export const HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_SESSION_ROUTE =
  '/api/v1/shadow/policy-foundry/hosted-onboarding-workflow/sessions/:sessionId';
const HOSTED_POLICY_FOUNDRY_ONBOARDING_IDEMPOTENCY_ROUTE_ID =
  'policy_foundry.hosted_onboarding_workflow.persist';

type HostedPolicyFoundryProblemStatus = 400 | 404 | 409 | 415 | 503;

function problem(
  c: Context,
  input: {
    readonly type: string;
    readonly title: string;
    readonly status: HostedPolicyFoundryProblemStatus;
    readonly detail: string;
    readonly reasonCodes: readonly string[];
  },
): Response {
  const payload = createConsequenceAdmissionProblem({
    ...input,
    instance: c.req.path,
  });
  return c.json(payload, input.status);
}

function problemStatusFor(detail: string): HostedPolicyFoundryProblemStatus {
  if (detail.includes('not found')) return 404;
  return detail.includes('hosted onboarding route') ||
    detail.includes('Policy Foundry') ||
    detail.includes('must be') ||
    detail.includes('requires') ||
    detail.includes('is required')
    ? 400
    : 503;
}

function renderFailedProblem(c: Context, error: unknown): Response {
  const detail =
    error instanceof Error &&
    (error.message.includes('Policy Foundry hosted onboarding route') ||
      error.message.includes('cross-tenant'))
      ? error.message
      : 'The Policy Foundry hosted onboarding workflow could not be rendered.';
  return problem(c, {
    type: 'https://attestor.dev/problems/policy-foundry-hosted-onboarding-render-failed',
    title: 'Policy Foundry hosted onboarding render failed',
    status: problemStatusFor(detail),
    detail,
    reasonCodes: ['policy-foundry-hosted-onboarding-render-failed'],
  });
}

async function readBody(c: Context): Promise<HostedPolicyFoundryOnboardingRequestBody | Response> {
  if (!acceptsJsonRequestBody(c)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/policy-foundry-hosted-onboarding-json-required',
      title: 'Policy Foundry hosted onboarding JSON required',
      status: 415,
      detail: 'The Policy Foundry hosted onboarding route requires Content-Type: application/json.',
      reasonCodes: ['policy-foundry-hosted-onboarding-json-required'],
    });
  }
  try {
    const parsed = await c.req.json<unknown>();
    if (!isRecord(parsed)) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-hosted-onboarding-body-invalid',
        title: 'Invalid Policy Foundry hosted onboarding body',
        status: 400,
        detail: 'The Policy Foundry hosted onboarding route requires a JSON object.',
        reasonCodes: ['policy-foundry-hosted-onboarding-body-invalid'],
      });
    }
    return parsed;
  } catch {
    return problem(c, {
      type: 'https://attestor.dev/problems/policy-foundry-hosted-onboarding-json-invalid',
      title: 'Invalid Policy Foundry hosted onboarding JSON',
      status: 400,
      detail: 'The Policy Foundry hosted onboarding route requires valid JSON.',
      reasonCodes: ['policy-foundry-hosted-onboarding-json-invalid'],
    });
  }
}

async function createHostedPolicyFoundryOnboardingMaterial(
  c: Context,
  deps: PolicyFoundryHostedOnboardingRouteDeps,
  body: HostedPolicyFoundryOnboardingRequestBody,
) {
  const tenant = deps.currentTenant(c);
  const generatedAt = optionalIsoTimestamp(body.generatedAt, deps.now?.() ?? new Date().toISOString());
  const requestedCommercialPlan = normalizeCommercialPlan(body.commercialPlan, null);
  const requestedCapabilities = normalizeCapabilities(body.requestedCapabilities);
  const requestedProductionWorkflowCount =
    optionalNonNegativeInteger(body.requestedProductionWorkflowCount, 'requestedProductionWorkflowCount');
  const requestedHostedProduction =
    optionalBoolean(body.requestedHostedProduction, 'requestedHostedProduction', false);
  const requestedCustomerOperatedDeployment =
    optionalBoolean(body.requestedCustomerOperatedDeployment, 'requestedCustomerOperatedDeployment', false);
  const billingEntitlement = await deps.resolveBillingEntitlement?.({ tenant }) ?? null;
  const workflowId = optionalString(body.workflowId, 'workflowId');
  const workflowBillingCheckRequired =
    requestedHostedProduction ||
    (requestedProductionWorkflowCount ?? 0) > 0 ||
    requestedCustomerOperatedDeployment;
  const workflowEntitlementAccess =
    deps.resolveWorkflowEntitlement && workflowBillingCheckRequired && workflowId
      ? evaluateWorkflowEntitlementAccess({
          workflowId,
          entitlement: await deps.resolveWorkflowEntitlement({ tenant, workflowId }),
          requestedMode: 'enforce',
          requestedCapability: 'customer-gated-enforce-mode',
          customerGateProofPresent:
            optionalBoolean(body.customerApprovalRecorded, 'customerApprovalRecorded', false),
        })
      : null;
  const billingEntitlementEnforcement = createPolicyFoundryBillingEntitlementEnforcement({
    evaluatedAt: generatedAt,
    tenantPlanId: tenant.planId,
    requestedPlan: requestedCommercialPlan,
    requestedPlanExplicit: body.commercialPlan !== undefined && body.commercialPlan !== null,
    requestedCapabilities,
    requestedProductionWorkflowCount,
    requestedHostedProduction,
    requestedCustomerOperatedDeployment,
    entitlement: billingEntitlement,
    entitlementResolverConfigured: Boolean(deps.resolveBillingEntitlement),
    workflowEntitlementAccess,
    workflowEntitlementResolverConfigured: Boolean(deps.resolveWorkflowEntitlement) && workflowBillingCheckRequired,
  });
  const includeShadowEvents = optionalBoolean(body.includeShadowEvents, 'includeShadowEvents', true);
  const events = includeShadowEvents
    ? assertTenantBoundShadowEvents(tenant, deps.listShadowEvents({ tenant }))
    : [];
  const selfOnboardingPacket = createPolicyFoundrySelfOnboardingCliPacket({
    generatedAt,
    sessionId: optionalString(body.sessionId, 'sessionId'),
    tenantId: tenant.tenantId,
    reviewerRef: optionalString(body.reviewerRef, 'reviewerRef'),
    attestorBaseUrl: optionalString(body.attestorBaseUrl, 'attestorBaseUrl'),
    manifests: normalizeManifestInputs(body),
    declarations: normalizeDeclarations(body.declarations),
    events,
    readinessOverrides: normalizeReadinessOverrides(body.readinessOverrides),
  });
  const replayObservations = normalizeReplayObservations(body.adversarialReplayObservations);
  const adversarialReplay = replayObservations === null
    ? null
    : createPolicyFoundryAdversarialReplayExecutor({
      generatedAt,
      fixtureBundle: selfOnboardingPacket.redTeamFixtures,
      observations: replayObservations,
    });
  const liveDownstreamReplayObservations =
    normalizeLiveDownstreamReplayObservations(body.liveDownstreamReplayObservations);
  const liveDownstreamReplay = liveDownstreamReplayObservations === null
    ? null
    : createPolicyFoundryLiveDownstreamReplay({
      generatedAt,
      fixtureBundle: selfOnboardingPacket.redTeamFixtures,
      observations: liveDownstreamReplayObservations,
    });
  const commercialBoundary = createPolicyFoundryCommercialBoundary({
    generatedAt,
    plan: billingEntitlementEnforcement.commercialPlanForBoundary,
    requestedCapabilities,
    blockedSafetyMinimums: normalizeStringArray(
      body.blockedSafetyMinimums,
      'blockedSafetyMinimums',
      MAX_HOSTED_CAPABILITIES,
    ),
    requestedProductionWorkflowCount,
    requestedHostedProduction,
    requestedCustomerOperatedDeployment,
    shadowAutoEnforceRequested:
      optionalBoolean(body.autoEnforceRequested, 'autoEnforceRequested', false),
  });
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt,
    workflowId,
    tenantId: tenant.tenantId,
    selfOnboardingPacket,
    adversarialReplay,
    liveDownstreamReplay,
    commercialBoundary,
    reviewedStepIds: normalizeReviewedStepIds(body.reviewedStepIds),
    customerApprovalRecorded:
      optionalBoolean(body.customerApprovalRecorded, 'customerApprovalRecorded', false),
    autoEnforceRequested:
      optionalBoolean(body.autoEnforceRequested, 'autoEnforceRequested', false),
    credentialIssuanceRequested:
      optionalBoolean(body.credentialIssuanceRequested, 'credentialIssuanceRequested', false),
    infrastructureDeployRequested:
      optionalBoolean(body.infrastructureDeployRequested, 'infrastructureDeployRequested', false),
    productionTrafficExecutionRequested:
      optionalBoolean(body.productionTrafficExecutionRequested, 'productionTrafficExecutionRequested', false),
    rawPayloadStorageRequested:
      optionalBoolean(body.rawPayloadStorageRequested, 'rawPayloadStorageRequested', false),
  });
  const reviewSurface = createPolicyFoundryHostedReviewSurface({
    generatedAt,
    workflow,
  });

  return Object.freeze({
    tenant: tenantDigest(tenant),
    storageMode: 'stateless-review-workflow',
    route: HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE,
    viewRoute: HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_VIEW_ROUTE,
    routeSurface: 'policy-foundry-hosted-onboarding-workflow',
    hostedWorkflowRouteImplemented: true,
    hostedUiFlowRendered: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    hostedUiImplemented: false,
    executionPlanOnly: true,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    executesProductionTraffic: false,
    appliesPatches: false,
    includedShadowEvents: includeShadowEvents,
    billingEntitlementEnforcement,
    selfOnboardingPacket,
    adversarialReplay,
    liveDownstreamReplay,
    commercialBoundary,
    workflow,
    reviewSurface,
  });
}

function persistWizardStateIfRequested(
  deps: PolicyFoundryHostedOnboardingRouteDeps,
  body: HostedPolicyFoundryOnboardingRequestBody,
  material: Awaited<ReturnType<typeof createHostedPolicyFoundryOnboardingMaterial>>,
): {
  readonly wizardState: {
    readonly kind: 'created' | 'updated';
    readonly session: PolicyFoundryHostedWizardStateRecord;
  } | null;
} {
  if (!optionalBoolean(body.persistWizardState, 'persistWizardState', false)) {
    return { wizardState: null };
  }
  if (!deps.wizardStateStore) {
    throw new Error('Policy Foundry hosted onboarding route wizard state store is not configured.');
  }
  const result = deps.wizardStateStore.upsert({
    sessionId: optionalString(body.wizardSessionId, 'wizardSessionId') ??
      optionalString(body.sessionId, 'sessionId'),
    tenantDigest: material.tenant.tenantDigest,
    tenantSource: material.tenant.source,
    planId: material.tenant.planId,
    reviewSurface: material.reviewSurface,
    ttlHours: optionalPositiveNumber(body.wizardStateTtlHours, 'wizardStateTtlHours'),
    recordedAt: material.reviewSurface.generatedAt,
  });
  return {
    wizardState: {
      kind: result.kind,
      session: result.record,
    },
  };
}

type HostedWizardIdempotencyBegin =
  | { readonly kind: 'ready'; readonly ready: PipelineIdempotencyReadyResult | null }
  | { readonly kind: 'response'; readonly response: Response };

function idempotencyKeyFor(c: Context): string | null {
  const normalized = c.req.header('Idempotency-Key')?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function replayResponse(input: {
  readonly statusCode: number;
  readonly responseBody: unknown;
  readonly replay: boolean;
}): Response {
  return new Response(JSON.stringify(input.responseBody), {
    status: input.statusCode,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      ...(input.replay ? { 'x-attestor-idempotent-replay': 'true' } : {}),
    },
  });
}

async function beginHostedWizardIdempotency(
  c: Context,
  deps: PolicyFoundryHostedOnboardingRouteDeps,
  tenant: TenantContext,
  body: HostedPolicyFoundryOnboardingRequestBody,
): Promise<HostedWizardIdempotencyBegin> {
  if (!optionalBoolean(body.persistWizardState, 'persistWizardState', false)) {
    return { kind: 'ready', ready: null };
  }

  const idempotencyKey = idempotencyKeyFor(c);
  if (!idempotencyKey) {
    return { kind: 'ready', ready: null };
  }

  if (!deps.pipelineIdempotencyService) {
    return {
      kind: 'response',
      response: problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-hosted-onboarding-idempotency-unavailable',
        title: 'Policy Foundry hosted onboarding idempotency unavailable',
        status: 503,
        detail: 'The Policy Foundry hosted onboarding route cannot persist idempotent wizard state in this runtime.',
        reasonCodes: ['policy-foundry-hosted-onboarding-idempotency-unavailable'],
      }),
    };
  }

  const begin = await deps.pipelineIdempotencyService.begin({
    idempotencyKey,
    tenantId: tenant.tenantId,
    routeId: HOSTED_POLICY_FOUNDRY_ONBOARDING_IDEMPOTENCY_ROUTE_ID,
    requestPayload: body,
  });

  if (begin.kind === 'ready') {
    return { kind: 'ready', ready: begin };
  }

  if (begin.kind === 'replay') {
    return {
      kind: 'response',
      response: replayResponse({
        statusCode: begin.statusCode,
        responseBody: begin.responseBody,
        replay: true,
      }),
    };
  }

  if (begin.kind === 'conflict') {
    return {
      kind: 'response',
      response: problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-hosted-onboarding-idempotency-conflict',
        title: 'Policy Foundry hosted onboarding idempotency conflict',
        status: 409,
        detail: 'The Idempotency-Key was already used for a different Policy Foundry hosted onboarding wizard-state request.',
        reasonCodes: ['policy-foundry-hosted-onboarding-idempotency-conflict'],
      }),
    };
  }

  return {
    kind: 'response',
    response: problem(c, {
      type: 'https://attestor.dev/problems/policy-foundry-hosted-onboarding-idempotency-unavailable',
      title: 'Policy Foundry hosted onboarding idempotency unavailable',
      status: 503,
      detail: 'The Policy Foundry hosted onboarding route cannot persist idempotent wizard state in this runtime.',
      reasonCodes: ['policy-foundry-hosted-onboarding-idempotency-unavailable'],
    }),
  };
}

async function finalizeHostedWizardIdempotency(
  deps: PolicyFoundryHostedOnboardingRouteDeps,
  tenant: TenantContext,
  body: HostedPolicyFoundryOnboardingRequestBody,
  idempotency: PipelineIdempotencyReadyResult | null,
  responseBody: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!idempotency?.idempotencyKey || !deps.pipelineIdempotencyService) {
    return responseBody;
  }
  return deps.pipelineIdempotencyService.finalize({
    idempotencyKey: idempotency.idempotencyKey,
    tenantId: tenant.tenantId,
    routeId: HOSTED_POLICY_FOUNDRY_ONBOARDING_IDEMPOTENCY_ROUTE_ID,
    requestPayload: body,
    statusCode: 200,
    responseBody,
  });
}

export function registerPolicyFoundryHostedOnboardingRoutes(
  app: Hono,
  deps: PolicyFoundryHostedOnboardingRouteDeps,
): void {
  app.post(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readBody(c);
    if (body instanceof Response) return body;

    try {
      const tenant = deps.currentTenant(c);
      const idempotency = await beginHostedWizardIdempotency(c, deps, tenant, body);
      if (idempotency.kind === 'response') return idempotency.response;
      const material = await createHostedPolicyFoundryOnboardingMaterial(c, deps, body);
      const persisted = persistWizardStateIfRequested(deps, body, material);
      if (!persisted.wizardState) return c.json(material);
      const responseBody = await finalizeHostedWizardIdempotency(deps, tenant, body, idempotency.ready, {
        ...material,
        storageMode: 'file-backed-wizard-state',
        wizardState: persisted.wizardState,
      });
      return c.json(responseBody);
    } catch (error) {
      return renderFailedProblem(c, error);
    }
  });

  app.post(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_VIEW_ROUTE, async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readBody(c);
    if (body instanceof Response) return body;

    try {
      const material = await createHostedPolicyFoundryOnboardingMaterial(c, deps, body);
      return c.body(renderPolicyFoundryHostedUiFlow(material.reviewSurface), 200, secureHtmlResponseHeaders());
    } catch (error) {
      return renderFailedProblem(c, error);
    }
  });

  app.get(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_SESSION_ROUTE, (c) => {
    c.header('cache-control', 'no-store');
    try {
      if (!deps.wizardStateStore) {
        throw new Error('Policy Foundry hosted onboarding route wizard state store is not configured.');
      }
      const tenant = deps.currentTenant(c);
      const tenantState = tenantDigest(tenant);
      const sessionId = c.req.param('sessionId');
      const found = deps.wizardStateStore.find({
        tenantDigest: tenantState.tenantDigest,
        sessionId,
        now: deps.now?.() ?? new Date().toISOString(),
      });
      if (!found.record) {
        return problem(c, {
          type: 'https://attestor.dev/problems/policy-foundry-hosted-wizard-state-not-found',
          title: 'Policy Foundry hosted wizard state not found',
          status: 404,
          detail: 'The requested Policy Foundry hosted wizard state was not found for this tenant.',
          reasonCodes: ['policy-foundry-hosted-wizard-state-not-found'],
        });
      }
      return c.json({
        tenant: tenantState,
        route: HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_SESSION_ROUTE,
        storageMode: found.record.storageMode,
        routeSurface: 'policy-foundry-hosted-wizard-state',
        rawPayloadStored: false,
        productionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        wizardState: found.record,
      });
    } catch (error) {
      return renderFailedProblem(c, error);
    }
  });
}
