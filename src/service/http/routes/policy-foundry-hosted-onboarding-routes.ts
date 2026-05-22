import { createHash } from 'node:crypto';
import type { Context, Hono } from 'hono';
import {
  ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES,
  ACTION_SURFACE_MANIFEST_FORMATS,
  ACTION_SURFACE_MANIFEST_KINDS,
  POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTION_MODES,
  POLICY_FOUNDRY_ADVERSARIAL_REPLAY_OBSERVED_OUTCOMES,
  POLICY_FOUNDRY_COMMERCIAL_CAPABILITIES,
  POLICY_FOUNDRY_COMMERCIAL_PLANS,
  POLICY_FOUNDRY_HOSTED_ONBOARDING_REVIEWED_STEP_IDS,
  POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_ENVIRONMENTS,
  POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_EXECUTION_MODES,
  createConsequenceAdmissionProblem,
  createPolicyFoundryAdversarialReplayExecutor,
  createPolicyFoundryCommercialBoundary,
  createPolicyFoundryHostedOnboardingWorkflow,
  createPolicyFoundryHostedReviewSurface,
  createPolicyFoundryLiveDownstreamReplay,
  createPolicyFoundrySelfOnboardingCliPacket,
  type ActionSurfaceDeclaration,
  type ActionSurfaceDeclaredCredentialPosture,
  type ActionSurfaceManifestFormat,
  type ActionSurfaceManifestKind,
  type ActionSurfaceOnboardingReadinessOverride,
  type PolicyFoundryAdversarialReplayExecutionMode,
  type PolicyFoundryAdversarialReplayObservation,
  type PolicyFoundryAdversarialReplayObservedOutcome,
  type PolicyFoundryCommercialCapability,
  type PolicyFoundryCommercialPlan,
  type PolicyFoundryHostedOnboardingReviewedStepId,
  type PolicyFoundryLiveDownstreamReplayEnvironment,
  type PolicyFoundryLiveDownstreamReplayExecutionMode,
  type PolicyFoundryLiveDownstreamReplayObservation,
  type ShadowAdmissionEvent,
} from '../../../consequence-admission/index.js';
import { renderPolicyFoundryHostedUiFlow } from '../../policy-foundry-hosted-ui.js';
import type { HostedBillingEntitlementRecord } from '../../billing-entitlement-store.js';
import {
  createPolicyFoundryBillingEntitlementEnforcement,
} from '../../policy-foundry-billing-entitlement-enforcement.js';
import type {
  PolicyFoundryHostedWizardStateRecord,
  PolicyFoundryHostedWizardStateStore,
} from '../../policy-foundry-hosted-wizard-state.js';
import type {
  PipelineIdempotencyReadyResult,
  PipelineIdempotencyService,
} from '../../application/pipeline-idempotency-service.js';
import type { TenantContext } from '../../tenant-isolation.js';
import {
  acceptsJsonRequestBody,
  secureHtmlResponseHeaders,
} from '../route-response-helpers.js';

export const HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE =
  '/api/v1/shadow/policy-foundry/hosted-onboarding-workflow';
export const HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_VIEW_ROUTE =
  '/api/v1/shadow/policy-foundry/hosted-onboarding-workflow/view';
export const HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_SESSION_ROUTE =
  '/api/v1/shadow/policy-foundry/hosted-onboarding-workflow/sessions/:sessionId';
const HOSTED_POLICY_FOUNDRY_ONBOARDING_IDEMPOTENCY_ROUTE_ID =
  'policy_foundry.hosted_onboarding_workflow.persist';

const MAX_HOSTED_MANIFESTS = 20;
const MAX_HOSTED_DECLARATIONS = 500;
const MAX_HOSTED_READINESS_OVERRIDES = 500;
const MAX_HOSTED_REPLAY_OBSERVATIONS = 500;
const MAX_HOSTED_REVIEWED_STEPS = 32;
const MAX_HOSTED_CAPABILITIES = 64;
const DEFAULT_HOSTED_MANIFEST_MAX_BYTES = 512 * 1024;

type HostedPolicyFoundryProblemStatus = 400 | 404 | 409 | 415 | 503;

type HostedPolicyFoundryOnboardingRequestBody = {
  readonly generatedAt?: unknown;
  readonly workflowId?: unknown;
  readonly sessionId?: unknown;
  readonly reviewerRef?: unknown;
  readonly attestorBaseUrl?: unknown;
  readonly includeShadowEvents?: unknown;
  readonly manifests?: unknown;
  readonly declarations?: unknown;
  readonly readinessOverrides?: unknown;
  readonly defaultDomain?: unknown;
  readonly downstreamSystem?: unknown;
  readonly credentialPosture?: unknown;
  readonly adversarialReplayObservations?: unknown;
  readonly liveDownstreamReplayObservations?: unknown;
  readonly commercialPlan?: unknown;
  readonly requestedCapabilities?: unknown;
  readonly requestedProductionWorkflowCount?: unknown;
  readonly requestedHostedProduction?: unknown;
  readonly requestedCustomerOperatedDeployment?: unknown;
  readonly blockedSafetyMinimums?: unknown;
  readonly reviewedStepIds?: unknown;
  readonly customerApprovalRecorded?: unknown;
  readonly autoEnforceRequested?: unknown;
  readonly credentialIssuanceRequested?: unknown;
  readonly infrastructureDeployRequested?: unknown;
  readonly productionTrafficExecutionRequested?: unknown;
  readonly rawPayloadStorageRequested?: unknown;
  readonly persistWizardState?: unknown;
  readonly wizardSessionId?: unknown;
  readonly wizardStateTtlHours?: unknown;
};

export interface PolicyFoundryHostedOnboardingRouteDeps {
  currentTenant(context: Context): TenantContext;
  listShadowEvents(input: { readonly tenant: TenantContext }): readonly ShadowAdmissionEvent[];
  resolveBillingEntitlement?(input: {
    readonly tenant: TenantContext;
  }): Promise<HostedBillingEntitlementRecord | null> | HostedBillingEntitlementRecord | null;
  wizardStateStore?: PolicyFoundryHostedWizardStateStore;
  pipelineIdempotencyService?: PipelineIdempotencyService;
  now?(): string;
}

function tenantDigest(tenant: TenantContext): {
  readonly tenantDigest: string;
  readonly source: TenantContext['source'];
  readonly planId: string | null;
} {
  return Object.freeze({
    tenantDigest: `sha256:${createHash('sha256').update(tenant.tenantId).digest('hex')}`,
    source: tenant.source,
    planId: tenant.planId,
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertTenantBoundShadowEvents(
  tenant: TenantContext,
  events: readonly ShadowAdmissionEvent[],
): readonly ShadowAdmissionEvent[] {
  for (const event of events) {
    if (event.tenantId !== null && event.tenantId !== tenant.tenantId) {
      throw new Error('Policy Foundry hosted onboarding route received a cross-tenant shadow event.');
    }
  }
  return events;
}

function optionalString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Policy Foundry hosted onboarding route ${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function optionalBoolean(value: unknown, fieldName: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error(`Policy Foundry hosted onboarding route ${fieldName} must be a boolean.`);
  }
  return value;
}

function optionalIsoTimestamp(value: unknown, fallback: string): string {
  const raw = optionalString(value, 'generatedAt') ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Policy Foundry hosted onboarding route generatedAt must be an ISO timestamp.');
  }
  return timestamp.toISOString();
}

function optionalNonNegativeInteger(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Policy Foundry hosted onboarding route ${fieldName} must be a non-negative integer.`);
  }
  return value;
}

function optionalPositiveNumber(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Policy Foundry hosted onboarding route ${fieldName} must be a positive number.`);
  }
  return value;
}

function arrayFromBody(value: unknown, fieldName: string, maxItems: number): readonly unknown[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error(`Policy Foundry hosted onboarding route ${fieldName} must be an array.`);
  }
  if (value.length > maxItems) {
    throw new Error(`Policy Foundry hosted onboarding route ${fieldName} is limited to ${maxItems} items.`);
  }
  return Object.freeze(value);
}

function optionalManifestKind(value: unknown): ActionSurfaceManifestKind | 'auto' | null {
  const normalized = optionalString(value, 'manifestKind');
  if (normalized === null) return null;
  if (normalized === 'auto') return normalized;
  if (!(ACTION_SURFACE_MANIFEST_KINDS as readonly string[]).includes(normalized)) {
    throw new Error(
      `Policy Foundry hosted onboarding route manifestKind must be one of: auto, ${ACTION_SURFACE_MANIFEST_KINDS.join(', ')}.`,
    );
  }
  return normalized as ActionSurfaceManifestKind;
}

function optionalManifestFormat(value: unknown): ActionSurfaceManifestFormat | 'auto' | null {
  const normalized = optionalString(value, 'format');
  if (normalized === null) return null;
  if (normalized === 'auto') return normalized;
  if (!(ACTION_SURFACE_MANIFEST_FORMATS as readonly string[]).includes(normalized)) {
    throw new Error(
      `Policy Foundry hosted onboarding route format must be one of: auto, ${ACTION_SURFACE_MANIFEST_FORMATS.join(', ')}.`,
    );
  }
  return normalized as ActionSurfaceManifestFormat;
}

function optionalCredentialPosture(
  value: unknown,
  fallback: string | null,
): ActionSurfaceDeclaredCredentialPosture | null {
  const normalized = optionalString(value, 'credentialPosture') ?? fallback;
  if (normalized === null) return null;
  if (!(ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES as readonly string[]).includes(normalized)) {
    throw new Error(
      `Policy Foundry hosted onboarding route credentialPosture must be one of: ${ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES.join(', ')}.`,
    );
  }
  return normalized as ActionSurfaceDeclaredCredentialPosture;
}

function normalizeManifestInputs(
  body: HostedPolicyFoundryOnboardingRequestBody,
): Parameters<typeof createPolicyFoundrySelfOnboardingCliPacket>[0]['manifests'] {
  const manifests = arrayFromBody(body.manifests, 'manifests', MAX_HOSTED_MANIFESTS);
  const defaultDomain = optionalString(body.defaultDomain, 'defaultDomain');
  const downstreamSystem = optionalString(body.downstreamSystem, 'downstreamSystem');
  const defaultCredentialPosture = optionalCredentialPosture(body.credentialPosture, null);

  return Object.freeze(
    manifests.map((manifest, index) => {
      if (!isRecord(manifest)) {
        throw new Error('Policy Foundry hosted onboarding route manifests entries must be objects.');
      }
      const text = optionalString(manifest.text, 'manifests[].text');
      if (!text) {
        throw new Error('Policy Foundry hosted onboarding route manifests[].text is required.');
      }
      return Object.freeze({
        text,
        sourceRef: `hosted-policy-foundry-manifest:${index + 1}`,
        manifestKind: optionalManifestKind(manifest.manifestKind) ?? 'auto',
        format: optionalManifestFormat(manifest.format) ?? 'auto',
        defaultDomain: optionalString(manifest.defaultDomain, 'manifests[].defaultDomain') ?? defaultDomain,
        downstreamSystem:
          optionalString(manifest.downstreamSystem, 'manifests[].downstreamSystem') ?? downstreamSystem,
        credentialPosture: optionalCredentialPosture(
          manifest.credentialPosture,
          defaultCredentialPosture,
        ),
        maxBytes: DEFAULT_HOSTED_MANIFEST_MAX_BYTES,
      });
    }),
  );
}

function normalizeDeclarations(value: unknown): readonly ActionSurfaceDeclaration[] {
  return arrayFromBody(value, 'declarations', MAX_HOSTED_DECLARATIONS) as readonly ActionSurfaceDeclaration[];
}

function normalizeReadinessOverrides(value: unknown): readonly ActionSurfaceOnboardingReadinessOverride[] {
  return arrayFromBody(
    value,
    'readinessOverrides',
    MAX_HOSTED_READINESS_OVERRIDES,
  ) as readonly ActionSurfaceOnboardingReadinessOverride[];
}

function normalizeStringArray(
  value: unknown,
  fieldName: string,
  maxItems: number,
  allowedValues?: readonly string[],
): readonly string[] {
  return Object.freeze(arrayFromBody(value, fieldName, maxItems).map((item) => {
    if (typeof item !== 'string') {
      throw new Error(`Policy Foundry hosted onboarding route ${fieldName} entries must be strings.`);
    }
    const normalized = item.trim().toLowerCase();
    if (normalized.length === 0) {
      throw new Error(`Policy Foundry hosted onboarding route ${fieldName} entries must not be empty.`);
    }
    if (allowedValues && !allowedValues.includes(normalized)) {
      throw new Error(
        `Policy Foundry hosted onboarding route ${fieldName} entries must be one of: ${allowedValues.join(', ')}.`,
      );
    }
    return normalized;
  }));
}

function normalizeCapabilities(value: unknown): readonly PolicyFoundryCommercialCapability[] {
  return normalizeStringArray(
    value,
    'requestedCapabilities',
    MAX_HOSTED_CAPABILITIES,
    POLICY_FOUNDRY_COMMERCIAL_CAPABILITIES,
  ) as readonly PolicyFoundryCommercialCapability[];
}

function normalizeReviewedStepIds(value: unknown): readonly PolicyFoundryHostedOnboardingReviewedStepId[] {
  return normalizeStringArray(
    value,
    'reviewedStepIds',
    MAX_HOSTED_REVIEWED_STEPS,
    POLICY_FOUNDRY_HOSTED_ONBOARDING_REVIEWED_STEP_IDS,
  ) as readonly PolicyFoundryHostedOnboardingReviewedStepId[];
}

function normalizeCommercialPlan(
  value: unknown,
  fallback: string | null,
): PolicyFoundryCommercialPlan | string {
  const normalized = (optionalString(value, 'commercialPlan') ?? fallback ?? 'developer').trim().toLowerCase();
  if (normalized.length === 0) return 'developer';
  if (!(POLICY_FOUNDRY_COMMERCIAL_PLANS as readonly string[]).includes(normalized)) {
    return normalized;
  }
  return normalized as PolicyFoundryCommercialPlan;
}

function optionalExecutionMode(value: unknown): PolicyFoundryAdversarialReplayExecutionMode | null {
  const normalized = optionalString(value, 'adversarialReplayObservations[].executionMode');
  if (normalized === null) return null;
  if (!(POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTION_MODES as readonly string[]).includes(normalized)) {
    throw new Error(
      `Policy Foundry hosted onboarding route adversarialReplayObservations[].executionMode must be one of: ${POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTION_MODES.join(', ')}.`,
    );
  }
  return normalized as PolicyFoundryAdversarialReplayExecutionMode;
}

function optionalLiveDownstreamExecutionMode(value: unknown):
PolicyFoundryLiveDownstreamReplayExecutionMode | null {
  const normalized = optionalString(value, 'liveDownstreamReplayObservations[].executionMode');
  if (normalized === null) return null;
  if (!(POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_EXECUTION_MODES as readonly string[]).includes(normalized)) {
    throw new Error(
      `Policy Foundry hosted onboarding route liveDownstreamReplayObservations[].executionMode must be one of: ${POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_EXECUTION_MODES.join(', ')}.`,
    );
  }
  return normalized as PolicyFoundryLiveDownstreamReplayExecutionMode;
}

function optionalLiveDownstreamEnvironment(value: unknown):
PolicyFoundryLiveDownstreamReplayEnvironment | null {
  const normalized = optionalString(value, 'liveDownstreamReplayObservations[].environment');
  if (normalized === null) return null;
  if (!(POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_ENVIRONMENTS as readonly string[]).includes(normalized)) {
    throw new Error(
      `Policy Foundry hosted onboarding route liveDownstreamReplayObservations[].environment must be one of: ${POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_ENVIRONMENTS.join(', ')}.`,
    );
  }
  return normalized as PolicyFoundryLiveDownstreamReplayEnvironment;
}

function requiredObservedOutcome(
  value: unknown,
  fieldPrefix = 'adversarialReplayObservations',
): PolicyFoundryAdversarialReplayObservedOutcome {
  const normalized = optionalString(value, `${fieldPrefix}[].observedOutcome`);
  if (normalized === null) {
    throw new Error(`Policy Foundry hosted onboarding route ${fieldPrefix}[].observedOutcome is required.`);
  }
  if (!(POLICY_FOUNDRY_ADVERSARIAL_REPLAY_OBSERVED_OUTCOMES as readonly string[]).includes(normalized)) {
    throw new Error(
      `Policy Foundry hosted onboarding route ${fieldPrefix}[].observedOutcome must be one of: ${POLICY_FOUNDRY_ADVERSARIAL_REPLAY_OBSERVED_OUTCOMES.join(', ')}.`,
    );
  }
  return normalized as PolicyFoundryAdversarialReplayObservedOutcome;
}

function normalizeReplayObservations(
  value: unknown,
): readonly PolicyFoundryAdversarialReplayObservation[] | null {
  if (value === undefined || value === null) return null;
  return Object.freeze(arrayFromBody(value, 'adversarialReplayObservations', MAX_HOSTED_REPLAY_OBSERVATIONS)
    .map((observation) => {
      if (!isRecord(observation)) {
        throw new Error('Policy Foundry hosted onboarding route adversarialReplayObservations entries must be objects.');
      }
      const caseId = optionalString(observation.caseId, 'adversarialReplayObservations[].caseId');
      if (!caseId) {
        throw new Error('Policy Foundry hosted onboarding route adversarialReplayObservations[].caseId is required.');
      }
      return Object.freeze({
        caseId,
        observedOutcome: requiredObservedOutcome(observation.observedOutcome),
        observedAt: optionalString(observation.observedAt, 'adversarialReplayObservations[].observedAt'),
        executionMode: optionalExecutionMode(observation.executionMode),
        evidenceDigest: optionalString(observation.evidenceDigest, 'adversarialReplayObservations[].evidenceDigest'),
        reasonCodes: normalizeStringArray(
          observation.reasonCodes,
          'adversarialReplayObservations[].reasonCodes',
          64,
        ),
        rawPayloadStored: optionalBoolean(
          observation.rawPayloadStored,
          'adversarialReplayObservations[].rawPayloadStored',
          false,
        ),
        downstreamMutationAttempted: optionalBoolean(
          observation.downstreamMutationAttempted,
          'adversarialReplayObservations[].downstreamMutationAttempted',
          false,
        ),
        credentialMaterialUsed: optionalBoolean(
          observation.credentialMaterialUsed,
          'adversarialReplayObservations[].credentialMaterialUsed',
          false,
        ),
      });
    }));
}

function normalizeLiveDownstreamReplayObservations(
  value: unknown,
): readonly PolicyFoundryLiveDownstreamReplayObservation[] | null {
  if (value === undefined || value === null) return null;
  return Object.freeze(arrayFromBody(value, 'liveDownstreamReplayObservations', MAX_HOSTED_REPLAY_OBSERVATIONS)
    .map((observation) => {
      if (!isRecord(observation)) {
        throw new Error('Policy Foundry hosted onboarding route liveDownstreamReplayObservations entries must be objects.');
      }
      const caseId = optionalString(observation.caseId, 'liveDownstreamReplayObservations[].caseId');
      if (!caseId) {
        throw new Error('Policy Foundry hosted onboarding route liveDownstreamReplayObservations[].caseId is required.');
      }
      return Object.freeze({
        caseId,
        observedOutcome: requiredObservedOutcome(observation.observedOutcome, 'liveDownstreamReplayObservations'),
        observedAt: optionalString(observation.observedAt, 'liveDownstreamReplayObservations[].observedAt'),
        executionMode: optionalLiveDownstreamExecutionMode(observation.executionMode),
        environment: optionalLiveDownstreamEnvironment(observation.environment),
        evidenceDigest: optionalString(observation.evidenceDigest, 'liveDownstreamReplayObservations[].evidenceDigest'),
        dryRunProofDigest: optionalString(observation.dryRunProofDigest, 'liveDownstreamReplayObservations[].dryRunProofDigest'),
        downstreamReceiptDigest: optionalString(observation.downstreamReceiptDigest, 'liveDownstreamReplayObservations[].downstreamReceiptDigest'),
        reasonCodes: normalizeStringArray(
          observation.reasonCodes,
          'liveDownstreamReplayObservations[].reasonCodes',
          64,
        ),
        rawPayloadStored: optionalBoolean(
          observation.rawPayloadStored,
          'liveDownstreamReplayObservations[].rawPayloadStored',
          false,
        ),
        downstreamMutationAttempted: optionalBoolean(
          observation.downstreamMutationAttempted,
          'liveDownstreamReplayObservations[].downstreamMutationAttempted',
          false,
        ),
        credentialMaterialUsed: optionalBoolean(
          observation.credentialMaterialUsed,
          'liveDownstreamReplayObservations[].credentialMaterialUsed',
          false,
        ),
        productionTrafficAttempted: optionalBoolean(
          observation.productionTrafficAttempted,
          'liveDownstreamReplayObservations[].productionTrafficAttempted',
          false,
        ),
        dryRunConfirmed: optionalBoolean(
          observation.dryRunConfirmed,
          'liveDownstreamReplayObservations[].dryRunConfirmed',
          false,
        ),
        sandboxBoundaryVerified: optionalBoolean(
          observation.sandboxBoundaryVerified,
          'liveDownstreamReplayObservations[].sandboxBoundaryVerified',
          false,
        ),
        unapprovedNetworkEgress: optionalBoolean(
          observation.unapprovedNetworkEgress,
          'liveDownstreamReplayObservations[].unapprovedNetworkEgress',
          false,
        ),
      });
    }));
}

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
    workflowId: optionalString(body.workflowId, 'workflowId'),
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
