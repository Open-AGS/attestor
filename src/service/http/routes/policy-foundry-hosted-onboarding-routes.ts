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
  createConsequenceAdmissionProblem,
  createPolicyFoundryAdversarialReplayExecutor,
  createPolicyFoundryCommercialBoundary,
  createPolicyFoundryHostedOnboardingWorkflow,
  createPolicyFoundryHostedReviewSurface,
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
  type ShadowAdmissionEvent,
} from '../../../consequence-admission/index.js';
import type { TenantContext } from '../../tenant-isolation.js';

export const HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE =
  '/api/v1/shadow/policy-foundry/hosted-onboarding-workflow';

const MAX_HOSTED_MANIFESTS = 20;
const MAX_HOSTED_DECLARATIONS = 500;
const MAX_HOSTED_READINESS_OVERRIDES = 500;
const MAX_HOSTED_REPLAY_OBSERVATIONS = 500;
const MAX_HOSTED_REVIEWED_STEPS = 32;
const MAX_HOSTED_CAPABILITIES = 64;
const DEFAULT_HOSTED_MANIFEST_MAX_BYTES = 512 * 1024;

type HostedPolicyFoundryProblemStatus = 400 | 503;

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
};

export interface PolicyFoundryHostedOnboardingRouteDeps {
  currentTenant(context: Context): TenantContext;
  listShadowEvents(input: { readonly tenant: TenantContext }): readonly ShadowAdmissionEvent[];
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

function requiredObservedOutcome(value: unknown): PolicyFoundryAdversarialReplayObservedOutcome {
  const normalized = optionalString(value, 'adversarialReplayObservations[].observedOutcome');
  if (normalized === null) {
    throw new Error('Policy Foundry hosted onboarding route adversarialReplayObservations[].observedOutcome is required.');
  }
  if (!(POLICY_FOUNDRY_ADVERSARIAL_REPLAY_OBSERVED_OUTCOMES as readonly string[]).includes(normalized)) {
    throw new Error(
      `Policy Foundry hosted onboarding route adversarialReplayObservations[].observedOutcome must be one of: ${POLICY_FOUNDRY_ADVERSARIAL_REPLAY_OBSERVED_OUTCOMES.join(', ')}.`,
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

async function readBody(c: Context): Promise<HostedPolicyFoundryOnboardingRequestBody | Response> {
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
      const generatedAt = optionalIsoTimestamp(body.generatedAt, deps.now?.() ?? new Date().toISOString());
      const includeShadowEvents = optionalBoolean(body.includeShadowEvents, 'includeShadowEvents', true);
      const events = includeShadowEvents ? deps.listShadowEvents({ tenant }) : [];
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
      const commercialBoundary = createPolicyFoundryCommercialBoundary({
        generatedAt,
        plan: normalizeCommercialPlan(body.commercialPlan, tenant.planId),
        requestedCapabilities: normalizeCapabilities(body.requestedCapabilities),
        blockedSafetyMinimums: normalizeStringArray(
          body.blockedSafetyMinimums,
          'blockedSafetyMinimums',
          MAX_HOSTED_CAPABILITIES,
        ),
        requestedProductionWorkflowCount:
          optionalNonNegativeInteger(body.requestedProductionWorkflowCount, 'requestedProductionWorkflowCount'),
        requestedHostedProduction:
          optionalBoolean(body.requestedHostedProduction, 'requestedHostedProduction', false),
        requestedCustomerOperatedDeployment:
          optionalBoolean(body.requestedCustomerOperatedDeployment, 'requestedCustomerOperatedDeployment', false),
        shadowAutoEnforceRequested:
          optionalBoolean(body.autoEnforceRequested, 'autoEnforceRequested', false),
      });
      const workflow = createPolicyFoundryHostedOnboardingWorkflow({
        generatedAt,
        workflowId: optionalString(body.workflowId, 'workflowId'),
        tenantId: tenant.tenantId,
        selfOnboardingPacket,
        adversarialReplay,
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

      return c.json({
        tenant: tenantDigest(tenant),
        storageMode: 'stateless-review-workflow',
        route: HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE,
        routeSurface: 'policy-foundry-hosted-onboarding-workflow',
        hostedWorkflowRouteImplemented: true,
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
        selfOnboardingPacket,
        adversarialReplay,
        commercialBoundary,
        workflow,
        reviewSurface,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'The Policy Foundry hosted onboarding workflow could not be rendered.';
      const status: HostedPolicyFoundryProblemStatus =
        detail.includes('hosted onboarding route') ||
        detail.includes('Policy Foundry') ||
        detail.includes('must be') ||
        detail.includes('requires') ||
        detail.includes('is required')
          ? 400
          : 503;
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-foundry-hosted-onboarding-render-failed',
        title: 'Policy Foundry hosted onboarding render failed',
        status,
        detail,
        reasonCodes: ['policy-foundry-hosted-onboarding-render-failed'],
      });
    }
  });
}
