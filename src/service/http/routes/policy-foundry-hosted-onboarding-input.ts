import { createHash } from 'node:crypto';
import type { Context } from 'hono';
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
  type createPolicyFoundrySelfOnboardingCliPacket,
} from '../../../consequence-admission/index.js';
import type { HostedBillingEntitlementRecord } from '../../billing/billing-entitlement-store.js';
import type { PipelineIdempotencyService } from '../../application/pipeline-idempotency-service.js';
import type { PolicyFoundryHostedWizardStateStore } from '../../policy-foundry/policy-foundry-hosted-wizard-state.js';
import type { TenantContext } from '../../tenant-isolation.js';
import type { WorkflowEntitlementRecord } from '../../workflow-entitlement.js';

const MAX_HOSTED_MANIFESTS = 20;
const MAX_HOSTED_DECLARATIONS = 500;
const MAX_HOSTED_READINESS_OVERRIDES = 500;
const MAX_HOSTED_REPLAY_OBSERVATIONS = 500;
const MAX_HOSTED_REVIEWED_STEPS = 32;
export const MAX_HOSTED_CAPABILITIES = 64;
const DEFAULT_HOSTED_MANIFEST_MAX_BYTES = 512 * 1024;

export type HostedPolicyFoundryOnboardingRequestBody = {
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
  resolveWorkflowEntitlement?(input: {
    readonly tenant: TenantContext;
    readonly workflowId: string;
  }): Promise<WorkflowEntitlementRecord | null> | WorkflowEntitlementRecord | null;
  wizardStateStore?: PolicyFoundryHostedWizardStateStore;
  pipelineIdempotencyService?: PipelineIdempotencyService;
  now?(): string;
}

export function tenantDigest(tenant: TenantContext): {
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

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertTenantBoundShadowEvents(
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

export function optionalString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Policy Foundry hosted onboarding route ${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function optionalBoolean(value: unknown, fieldName: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error(`Policy Foundry hosted onboarding route ${fieldName} must be a boolean.`);
  }
  return value;
}

export function optionalIsoTimestamp(value: unknown, fallback: string): string {
  const raw = optionalString(value, 'generatedAt') ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Policy Foundry hosted onboarding route generatedAt must be an ISO timestamp.');
  }
  return timestamp.toISOString();
}

export function optionalNonNegativeInteger(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Policy Foundry hosted onboarding route ${fieldName} must be a non-negative integer.`);
  }
  return value;
}

export function optionalPositiveNumber(value: unknown, fieldName: string): number | null {
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

export function normalizeManifestInputs(
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

export function normalizeDeclarations(value: unknown): readonly ActionSurfaceDeclaration[] {
  return arrayFromBody(value, 'declarations', MAX_HOSTED_DECLARATIONS) as readonly ActionSurfaceDeclaration[];
}

export function normalizeReadinessOverrides(value: unknown): readonly ActionSurfaceOnboardingReadinessOverride[] {
  return arrayFromBody(
    value,
    'readinessOverrides',
    MAX_HOSTED_READINESS_OVERRIDES,
  ) as readonly ActionSurfaceOnboardingReadinessOverride[];
}

export function normalizeStringArray(
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

export function normalizeCapabilities(value: unknown): readonly PolicyFoundryCommercialCapability[] {
  return normalizeStringArray(
    value,
    'requestedCapabilities',
    MAX_HOSTED_CAPABILITIES,
    POLICY_FOUNDRY_COMMERCIAL_CAPABILITIES,
  ) as readonly PolicyFoundryCommercialCapability[];
}

export function normalizeReviewedStepIds(value: unknown): readonly PolicyFoundryHostedOnboardingReviewedStepId[] {
  return normalizeStringArray(
    value,
    'reviewedStepIds',
    MAX_HOSTED_REVIEWED_STEPS,
    POLICY_FOUNDRY_HOSTED_ONBOARDING_REVIEWED_STEP_IDS,
  ) as readonly PolicyFoundryHostedOnboardingReviewedStepId[];
}

export function normalizeCommercialPlan(
  value: unknown,
  fallback: string | null,
): PolicyFoundryCommercialPlan | string {
  const normalized = (optionalString(value, 'commercialPlan') ?? fallback ?? 'trial').trim().toLowerCase();
  if (normalized.length === 0) return 'trial';
  const canonical = normalized === 'developer' || normalized === 'community' ? 'trial' : normalized;
  if (!(POLICY_FOUNDRY_COMMERCIAL_PLANS as readonly string[]).includes(canonical)) {
    return canonical;
  }
  return canonical as PolicyFoundryCommercialPlan;
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

export function normalizeReplayObservations(
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

export function normalizeLiveDownstreamReplayObservations(
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
