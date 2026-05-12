import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  ActionSurfaceOnboardingPacket,
  ActionSurfaceOnboardingSurfacePlan,
} from './action-surface-onboarding-packet.js';
import type {
  AttestorGeneratedIntegrationArtifactKind,
  AttestorIntegrationMode,
  AttestorIntegrationModeReadiness,
} from './integration-mode-readiness.js';
import type {
  PolicyFoundryCoverageDimension,
  PolicyFoundryCoverageScore,
  PolicyFoundrySurfaceCoverageScore,
} from './policy-foundry-coverage-score.js';

export const POLICY_FOUNDRY_GATE_PLANNER_VERSION =
  'attestor.policy-foundry-gate-planner.v1';

export const POLICY_FOUNDRY_GATE_PLAN_STATUSES = [
  'collect-shadow',
  'prepare-gate',
  'customer-review-ready',
  'scoped-rollout-review-ready',
] as const;
export type PolicyFoundryGatePlanStatus =
  typeof POLICY_FOUNDRY_GATE_PLAN_STATUSES[number];

export const POLICY_FOUNDRY_GATE_STRENGTHS = [
  'shadow-only',
  'sdk-soft-gate',
  'gateway-bound',
  'provider-bound',
] as const;
export type PolicyFoundryGateStrength =
  typeof POLICY_FOUNDRY_GATE_STRENGTHS[number];

export interface CreatePolicyFoundryGatePlannerInput {
  readonly generatedAt?: string | null;
  readonly coverage: PolicyFoundryCoverageScore;
  readonly onboardingPacket?: ActionSurfaceOnboardingPacket | null;
  readonly integrationReadiness?: readonly AttestorIntegrationModeReadiness[] | null;
}

export interface PolicyFoundrySurfaceGatePlan {
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly downstreamSystem: string | null;
  readonly coverageScore: number;
  readonly coverageStatus: PolicyFoundrySurfaceCoverageScore['status'];
  readonly planStatus: PolicyFoundryGatePlanStatus;
  readonly selectedMode: AttestorIntegrationMode;
  readonly gateStrength: PolicyFoundryGateStrength;
  readonly selectedReasonCodes: readonly string[];
  readonly blockingDimensions: readonly PolicyFoundryCoverageDimension[];
  readonly requiredArtifacts: readonly AttestorGeneratedIntegrationArtifactKind[];
  readonly artifactDigests: readonly string[];
  readonly requiredCustomerWork: readonly string[];
  readonly nonBypassableCandidate: boolean;
  readonly nonBypassableClaimAllowed: false;
  readonly nextSafeStep: string;
}

export interface PolicyFoundryGatePlanner {
  readonly version: typeof POLICY_FOUNDRY_GATE_PLANNER_VERSION;
  readonly generatedAt: string;
  readonly coverageDigest: string;
  readonly sourceDigests: {
    readonly onboardingPacketDigest: string | null;
    readonly integrationReadinessDigests: readonly string[];
  };
  readonly status: PolicyFoundryGatePlanStatus;
  readonly surfaceCount: number;
  readonly gateReadySurfaceCount: number;
  readonly plans: readonly PolicyFoundrySurfaceGatePlan[];
  readonly safeAutomations: readonly string[];
  readonly approvalGatedAutomations: readonly string[];
  readonly prohibitedAutomations: readonly string[];
  readonly nextSafeStep: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly nonBypassableClaimAllowed: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-gate-planner';
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryGatePlannerDescriptor {
  readonly version: typeof POLICY_FOUNDRY_GATE_PLANNER_VERSION;
  readonly statuses: typeof POLICY_FOUNDRY_GATE_PLAN_STATUSES;
  readonly gateStrengths: typeof POLICY_FOUNDRY_GATE_STRENGTHS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly nonBypassableClaimAllowed: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-gate-planner';
}

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Policy Foundry gate planner ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function artifactKindsForMode(
  mode: AttestorIntegrationMode,
): readonly AttestorGeneratedIntegrationArtifactKind[] {
  switch (mode) {
    case 'advisory-api':
      return Object.freeze(['sdk-snippet', 'policy-twin-backtest']);
    case 'shadow-capture-sdk':
      return Object.freeze(['sdk-snippet', 'policy-twin-backtest', 'red-team-replay-fixture']);
    case 'sdk-gate':
      return Object.freeze([
        'sdk-snippet',
        'verifier-helper-config',
        'protected-adapter-skeleton',
        'policy-twin-backtest',
        'red-team-replay-fixture',
      ]);
    case 'gateway-proxy':
      return Object.freeze([
        'gateway-proxy-config',
        'verifier-helper-config',
        'credential-isolation-plan',
        'policy-twin-backtest',
        'red-team-replay-fixture',
      ]);
    case 'mcp-tool-gateway':
      return Object.freeze([
        'mcp-tool-gateway-config',
        'verifier-helper-config',
        'credential-isolation-plan',
        'policy-twin-backtest',
        'red-team-replay-fixture',
      ]);
    case 'sidecar-ext-authz':
      return Object.freeze([
        'sidecar-ext-authz-config',
        'verifier-helper-config',
        'credential-isolation-plan',
        'policy-twin-backtest',
        'red-team-replay-fixture',
      ]);
    case 'provider-native-connector':
      return Object.freeze([
        'provider-native-connector-plan',
        'verifier-helper-config',
        'credential-isolation-plan',
        'policy-twin-backtest',
        'red-team-replay-fixture',
      ]);
  }
}

function gateStrength(mode: AttestorIntegrationMode): PolicyFoundryGateStrength {
  switch (mode) {
    case 'advisory-api':
    case 'shadow-capture-sdk':
      return 'shadow-only';
    case 'sdk-gate':
      return 'sdk-soft-gate';
    case 'gateway-proxy':
    case 'mcp-tool-gateway':
    case 'sidecar-ext-authz':
      return 'gateway-bound';
    case 'provider-native-connector':
      return 'provider-bound';
  }
}

function surfacePlansByActionSurface(
  packet: ActionSurfaceOnboardingPacket | null,
): ReadonlyMap<string, ActionSurfaceOnboardingSurfacePlan> {
  const map = new Map<string, ActionSurfaceOnboardingSurfacePlan>();
  for (const plan of packet?.surfacePlans ?? []) {
    map.set(plan.actionSurface, plan);
  }
  return map;
}

function integrationByActionSurface(
  integrations: readonly AttestorIntegrationModeReadiness[],
): ReadonlyMap<string, AttestorIntegrationModeReadiness> {
  const map = new Map<string, AttestorIntegrationModeReadiness>();
  for (const integration of integrations) {
    if (integration.actionSurface) map.set(integration.actionSurface, integration);
  }
  return map;
}

function selectedMode(input: {
  readonly surface: PolicyFoundrySurfaceCoverageScore;
  readonly plan: ActionSurfaceOnboardingSurfacePlan | null;
  readonly integration: AttestorIntegrationModeReadiness | null;
}): AttestorIntegrationMode {
  if (
    input.surface.status === 'no-coverage' ||
    input.surface.status === 'needs-shadow-traffic'
  ) {
    return 'shadow-capture-sdk';
  }
  return input.plan?.recommendedIntegrationMode ??
    input.integration?.mode ??
    (
      input.surface.missingDimensions.includes('verifier-or-gateway') ||
      input.surface.partialDimensions.includes('verifier-or-gateway')
        ? 'gateway-proxy'
        : 'sdk-gate'
    );
}

function planStatus(
  surface: PolicyFoundrySurfaceCoverageScore,
): PolicyFoundryGatePlanStatus {
  switch (surface.status) {
    case 'no-coverage':
    case 'needs-shadow-traffic':
      return 'collect-shadow';
    case 'needs-controls':
      return 'prepare-gate';
    case 'review-ready':
      return 'customer-review-ready';
    case 'scoped-rollout-coverage-ready':
      return 'scoped-rollout-review-ready';
  }
}

function selectedReasonCodes(
  surface: PolicyFoundrySurfaceCoverageScore,
  mode: AttestorIntegrationMode,
): readonly string[] {
  const reasons = new Set<string>();
  reasons.add(`coverage-status:${surface.status}`);
  reasons.add(`selected-mode:${mode}`);
  for (const dimension of surface.missingDimensions) reasons.add(`missing:${dimension}`);
  for (const dimension of surface.partialDimensions) reasons.add(`partial:${dimension}`);
  if (mode !== 'shadow-capture-sdk' && surface.eventCount > 0) reasons.add('shadow-traffic-present');
  if (surface.bypassRisk) reasons.add(`bypass-risk:${surface.bypassRisk}`);
  return Object.freeze([...reasons].sort());
}

function requiredCustomerWork(
  surface: PolicyFoundrySurfaceCoverageScore,
  mode: AttestorIntegrationMode,
): readonly string[] {
  const work = new Set<string>();
  for (const dimension of surface.missingDimensions) {
    switch (dimension) {
      case 'action-surface-inventory':
        work.add('provide-action-surface-inventory');
        break;
      case 'shadow-traffic':
        work.add('send-shadow-traffic');
        break;
      case 'policy-twin':
        work.add('run-policy-twin');
        break;
      case 'policy-schema':
        work.add('choose-schema-bound-policy-template');
        break;
      case 'evidence-binding':
        work.add('bind-evidence-source');
        break;
      case 'authority-binding':
        work.add('bind-authority-source');
        break;
      case 'verifier-or-gateway':
        work.add(`review-${mode}-gate-draft`);
        break;
      case 'credential-isolation':
        work.add('isolate-agent-credentials');
        break;
      case 'tenant-boundary':
        work.add('prove-tenant-boundary');
        break;
      case 'replay-idempotency':
        work.add('add-replay-and-idempotency-controls');
        break;
      case 'red-team-replay':
        work.add('run-red-team-replay');
        break;
      case 'customer-approval':
        work.add('record-customer-approval');
        break;
      case 'generated-artifact-review':
        work.add('review-generated-artifacts');
        break;
    }
  }
  for (const dimension of surface.partialDimensions) {
    work.add(`close-partial-${dimension}`);
    if (dimension === 'verifier-or-gateway') {
      work.add(`review-${mode}-gate-draft`);
    }
    if (dimension === 'credential-isolation') {
      work.add('isolate-agent-credentials');
    }
    if (dimension === 'generated-artifact-review') {
      work.add('review-generated-artifacts');
    }
  }
  if (work.size === 0) work.add('prepare-customer-controlled-scoped-rollout-review');
  return Object.freeze([...work].sort());
}

function artifactDigestsForMode(
  packet: ActionSurfaceOnboardingPacket | null,
  actionSurface: string | null,
  kinds: readonly AttestorGeneratedIntegrationArtifactKind[],
): readonly string[] {
  if (!actionSurface) return Object.freeze([]);
  return Object.freeze(
    (packet?.artifactBundle.artifacts ?? [])
      .filter((artifact) =>
        artifact.actionSurface === actionSurface && kinds.includes(artifact.kind)
      )
      .map((artifact) => artifact.digest)
      .sort(),
  );
}

function nextSafeStep(
  status: PolicyFoundryGatePlanStatus,
  mode: AttestorIntegrationMode,
): string {
  switch (status) {
    case 'collect-shadow':
      return 'Collect shadow traffic before selecting an enforcement gate.';
    case 'prepare-gate':
      return `Prepare and review the ${mode} gate plan; do not activate enforcement.`;
    case 'customer-review-ready':
      return 'Prepare customer review; gate planner output is still review material only.';
    case 'scoped-rollout-review-ready':
      return 'Prepare scoped rollout review with downstream verifier or gateway evidence.';
  }
}

function nonBypassableCandidate(mode: AttestorIntegrationMode): boolean {
  return mode === 'gateway-proxy' ||
    mode === 'mcp-tool-gateway' ||
    mode === 'sidecar-ext-authz' ||
    mode === 'provider-native-connector';
}

function surfaceGatePlan(input: {
  readonly surface: PolicyFoundrySurfaceCoverageScore;
  readonly plan: ActionSurfaceOnboardingSurfacePlan | null;
  readonly integration: AttestorIntegrationModeReadiness | null;
  readonly packet: ActionSurfaceOnboardingPacket | null;
}): PolicyFoundrySurfaceGatePlan {
  const mode = selectedMode(input);
  const requiredArtifacts = artifactKindsForMode(mode);
  const status = planStatus(input.surface);
  const blockingDimensions = Object.freeze([
    ...new Set([
      ...input.surface.missingDimensions,
      ...input.surface.partialDimensions,
    ]),
  ].sort());
  return Object.freeze({
    actionSurface: input.surface.actionSurface,
    domain: input.surface.domain,
    downstreamSystem: input.surface.downstreamSystem,
    coverageScore: input.surface.score,
    coverageStatus: input.surface.status,
    planStatus: status,
    selectedMode: mode,
    gateStrength: gateStrength(mode),
    selectedReasonCodes: selectedReasonCodes(input.surface, mode),
    blockingDimensions,
    requiredArtifacts,
    artifactDigests: artifactDigestsForMode(input.packet, input.surface.actionSurface, requiredArtifacts),
    requiredCustomerWork: requiredCustomerWork(input.surface, mode),
    nonBypassableCandidate: nonBypassableCandidate(mode),
    nonBypassableClaimAllowed: false,
    nextSafeStep: nextSafeStep(status, mode),
  });
}

function plannerStatus(plans: readonly PolicyFoundrySurfaceGatePlan[]): PolicyFoundryGatePlanStatus {
  if (plans.some((plan) => plan.planStatus === 'collect-shadow')) return 'collect-shadow';
  if (plans.some((plan) => plan.planStatus === 'prepare-gate')) return 'prepare-gate';
  if (plans.every((plan) => plan.planStatus === 'scoped-rollout-review-ready')) {
    return 'scoped-rollout-review-ready';
  }
  return 'customer-review-ready';
}

export function createPolicyFoundryGatePlanner(
  input: CreatePolicyFoundryGatePlannerInput,
): PolicyFoundryGatePlanner {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const packet = input.onboardingPacket ?? null;
  const integrations = Object.freeze([...(input.integrationReadiness ?? [])]);
  const plansBySurface = surfacePlansByActionSurface(packet);
  const integrationsBySurface = integrationByActionSurface(integrations);
  const plans = Object.freeze(input.coverage.surfaces.map((surface) =>
    surfaceGatePlan({
      surface,
      plan: surface.actionSurface ? plansBySurface.get(surface.actionSurface) ?? null : null,
      integration: surface.actionSurface ? integrationsBySurface.get(surface.actionSurface) ?? null : null,
      packet,
    })
  ));
  const status = plannerStatus(plans);
  const payload = {
    version: POLICY_FOUNDRY_GATE_PLANNER_VERSION as typeof POLICY_FOUNDRY_GATE_PLANNER_VERSION,
    generatedAt,
    coverageDigest: input.coverage.digest,
    sourceDigests: {
      onboardingPacketDigest: packet?.digest ?? input.coverage.sourceDigests.onboardingPacketDigest,
      integrationReadinessDigests: Object.freeze(integrations.map((integration) => integration.digest).sort()),
    },
    status,
    surfaceCount: plans.length,
    gateReadySurfaceCount: plans.filter((plan) =>
      plan.planStatus === 'customer-review-ready' ||
      plan.planStatus === 'scoped-rollout-review-ready'
    ).length,
    plans,
    safeAutomations: Object.freeze([
      'render-review-only-gate-plan',
      'render-review-only-integration-artifact-list',
      'render-missing-control-checklist',
    ]),
    approvalGatedAutomations: Object.freeze([
      'generate-review-only-patch-pack',
      'prepare-scoped-rollout-review',
    ]),
    prohibitedAutomations: Object.freeze([
      'deploy-gateway',
      'issue-downstream-credentials',
      'activate-enforcement',
      'claim-production-readiness',
      'claim-non-bypassability-without-runtime-evidence',
    ]),
    nextSafeStep: nextSafeStep(status, plans[0]?.selectedMode ?? 'shadow-capture-sdk'),
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    activatesEnforcement: false as const,
    deploysInfrastructure: false as const,
    issuesCredentials: false as const,
    nonBypassableClaimAllowed: false as const,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION as typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-gate-planner' as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function policyFoundryGatePlannerDescriptor(): PolicyFoundryGatePlannerDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_GATE_PLANNER_VERSION,
    statuses: POLICY_FOUNDRY_GATE_PLAN_STATUSES,
    gateStrengths: POLICY_FOUNDRY_GATE_STRENGTHS,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    nonBypassableClaimAllowed: false,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-gate-planner',
  });
}
