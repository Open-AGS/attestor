import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  PolicyFoundryAdversarialReplayExecutor,
} from './policy-foundry-adversarial-replay-executor.js';
import type {
  PolicyFoundryCommercialBoundary,
} from './policy-foundry-commercial-boundary.js';
import type {
  PolicyFoundrySelfOnboardingCliPacket,
} from './policy-foundry-self-onboarding-cli.js';

export const POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_VERSION =
  'attestor.policy-foundry-hosted-onboarding-workflow.v1';

export const POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STEP_IDS = [
  'source-intake',
  'surface-map',
  'active-questions',
  'coverage-review',
  'gate-plan',
  'adversarial-replay',
  'patch-review',
  'customer-approval',
  'scoped-rollout-review',
] as const;
export type PolicyFoundryHostedOnboardingWorkflowStepId =
  typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STEP_IDS[number];

export const POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STEP_STATUSES = [
  'currently-due',
  'eventually-due',
  'satisfied',
  'blocked',
] as const;
export type PolicyFoundryHostedOnboardingWorkflowStepStatus =
  typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STEP_STATUSES[number];

export const POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STATUSES = [
  'no-input',
  'customer-action-required',
  'blocked',
  'review-material-ready',
  'scoped-rollout-review-ready',
] as const;
export type PolicyFoundryHostedOnboardingWorkflowStatus =
  typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STATUSES[number];

export const POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_NO_GO_REASONS = [
  'source-packet-missing',
  'adversarial-replay-missing',
  'adversarial-replay-failed',
  'commercial-boundary-blocked',
  'auto-enforce-requested',
  'credential-issuance-requested',
  'infrastructure-deploy-requested',
  'production-traffic-execution-requested',
  'raw-payload-storage-requested',
] as const;
export type PolicyFoundryHostedOnboardingWorkflowNoGoReason =
  typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_NO_GO_REASONS[number];

export const POLICY_FOUNDRY_HOSTED_ONBOARDING_REVIEWED_STEP_IDS = [
  'surface-map',
  'active-questions',
  'coverage-review',
  'gate-plan',
  'adversarial-replay',
  'patch-review',
] as const;
export type PolicyFoundryHostedOnboardingReviewedStepId =
  typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_REVIEWED_STEP_IDS[number];

export interface CreatePolicyFoundryHostedOnboardingWorkflowInput {
  readonly generatedAt?: string | null;
  readonly workflowId?: string | null;
  readonly tenantId?: string | null;
  readonly selfOnboardingPacket?: PolicyFoundrySelfOnboardingCliPacket | null;
  readonly adversarialReplay?: PolicyFoundryAdversarialReplayExecutor | null;
  readonly commercialBoundary?: PolicyFoundryCommercialBoundary | null;
  readonly reviewedStepIds?: readonly string[] | null;
  readonly customerApprovalRecorded?: boolean | null;
  readonly autoEnforceRequested?: boolean | null;
  readonly credentialIssuanceRequested?: boolean | null;
  readonly infrastructureDeployRequested?: boolean | null;
  readonly productionTrafficExecutionRequested?: boolean | null;
  readonly rawPayloadStorageRequested?: boolean | null;
}

export interface PolicyFoundryHostedOnboardingWorkflowStep {
  readonly stepId: PolicyFoundryHostedOnboardingWorkflowStepId;
  readonly status: PolicyFoundryHostedOnboardingWorkflowStepStatus;
  readonly customerActionRequired: boolean;
  readonly safeAutomationAllowed: boolean;
  readonly approvalRequired: boolean;
  readonly reasonCodes: readonly string[];
  readonly sourceDigest: string | null;
  readonly nextSafeStep: string;
}

export interface PolicyFoundryHostedOnboardingWorkflowSourceDigests {
  readonly selfOnboardingPacketDigest: string | null;
  readonly onboardingSessionDigest: string | null;
  readonly coverageScoreDigest: string | null;
  readonly gatePlannerDigest: string | null;
  readonly reviewHandoffDigest: string | null;
  readonly redTeamFixtureDigest: string | null;
  readonly reviewOnlyPatchPackDigest: string | null;
  readonly adversarialReplayDigest: string | null;
  readonly commercialBoundaryDigest: string | null;
}

export interface PolicyFoundryHostedOnboardingWorkflow {
  readonly version: typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_VERSION;
  readonly generatedAt: string;
  readonly workflowId: string;
  readonly tenantDigest: string | null;
  readonly status: PolicyFoundryHostedOnboardingWorkflowStatus;
  readonly sourceDigests: PolicyFoundryHostedOnboardingWorkflowSourceDigests;
  readonly surfaceCount: number;
  readonly shadowEventCount: number;
  readonly blockerCount: number;
  readonly currentStepIds: readonly PolicyFoundryHostedOnboardingWorkflowStepId[];
  readonly eventuallyDueStepIds: readonly PolicyFoundryHostedOnboardingWorkflowStepId[];
  readonly satisfiedStepIds: readonly PolicyFoundryHostedOnboardingWorkflowStepId[];
  readonly blockedStepIds: readonly PolicyFoundryHostedOnboardingWorkflowStepId[];
  readonly steps: readonly PolicyFoundryHostedOnboardingWorkflowStep[];
  readonly noGoReasons: readonly PolicyFoundryHostedOnboardingWorkflowNoGoReason[];
  readonly safeAutomations: readonly string[];
  readonly approvalGatedAutomations: readonly string[];
  readonly prohibitedAutomations: readonly string[];
  readonly nextSafeStep: string;
  readonly approvalRequired: true;
  readonly customerApprovalRecorded: boolean;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly hostedUiWorkflowContract: true;
  readonly hostedUiImplemented: false;
  readonly hostedRouteImplemented: false;
  readonly appliesPatches: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly executesProductionTraffic: false;
  readonly nonBypassableClaimAllowed: false;
  readonly reviewMaterialOnly: true;
  readonly deploymentEntitlementEnforcementImplemented: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-hosted-onboarding-workflow';
  readonly limitations: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryHostedOnboardingWorkflowDescriptor {
  readonly version: typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_VERSION;
  readonly statuses: typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STATUSES;
  readonly stepIds: typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STEP_IDS;
  readonly stepStatuses: typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STEP_STATUSES;
  readonly noGoReasons: typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_NO_GO_REASONS;
  readonly reviewedStepIds: typeof POLICY_FOUNDRY_HOSTED_ONBOARDING_REVIEWED_STEP_IDS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly hostedUiWorkflowContract: true;
  readonly hostedUiImplemented: false;
  readonly hostedRouteImplemented: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly executesProductionTraffic: false;
  readonly nonBypassableClaimAllowed: false;
  readonly reviewMaterialOnly: true;
  readonly deploymentEntitlementEnforcementImplemented: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-hosted-onboarding-workflow';
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
    throw new Error(`Policy Foundry hosted onboarding workflow ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function reviewedSteps(values: readonly string[] | null | undefined):
ReadonlySet<PolicyFoundryHostedOnboardingReviewedStepId> {
  const reviewed = new Set<PolicyFoundryHostedOnboardingReviewedStepId>();
  for (const value of values ?? []) {
    if ((POLICY_FOUNDRY_HOSTED_ONBOARDING_REVIEWED_STEP_IDS as readonly string[]).includes(value)) {
      reviewed.add(value as PolicyFoundryHostedOnboardingReviewedStepId);
    }
  }
  return reviewed;
}

function workflowId(input: CreatePolicyFoundryHostedOnboardingWorkflowInput): string {
  const explicit = normalizeOptionalString(input.workflowId);
  if (explicit) return explicit;
  const seed = [
    input.selfOnboardingPacket?.digest ?? 'no-packet',
    input.adversarialReplay?.digest ?? 'no-replay',
    input.commercialBoundary?.digest ?? 'no-commercial-boundary',
  ].join('\n');
  return `hosted_foundry_${createHash('sha256').update(seed).digest('hex').slice(0, 24)}`;
}

function sourceDigests(input: CreatePolicyFoundryHostedOnboardingWorkflowInput):
PolicyFoundryHostedOnboardingWorkflowSourceDigests {
  const packet = input.selfOnboardingPacket ?? null;
  return Object.freeze({
    selfOnboardingPacketDigest: packet?.digest ?? null,
    onboardingSessionDigest: packet?.sourceDigests.onboardingSessionDigest ?? null,
    coverageScoreDigest: packet?.sourceDigests.coverageScoreDigest ?? null,
    gatePlannerDigest: packet?.sourceDigests.gatePlannerDigest ?? null,
    reviewHandoffDigest: packet?.sourceDigests.reviewHandoffDigest ?? null,
    redTeamFixtureDigest: packet?.sourceDigests.redTeamFixtureDigest ?? null,
    reviewOnlyPatchPackDigest: packet?.sourceDigests.reviewOnlyPatchPackDigest ?? null,
    adversarialReplayDigest: input.adversarialReplay?.digest ?? null,
    commercialBoundaryDigest: input.commercialBoundary?.digest ?? null,
  });
}

function noGoReasons(input: CreatePolicyFoundryHostedOnboardingWorkflowInput):
readonly PolicyFoundryHostedOnboardingWorkflowNoGoReason[] {
  const reasons = new Set<PolicyFoundryHostedOnboardingWorkflowNoGoReason>();
  if (!input.selfOnboardingPacket) reasons.add('source-packet-missing');
  if (!input.adversarialReplay) reasons.add('adversarial-replay-missing');
  if (input.adversarialReplay?.status === 'failed') reasons.add('adversarial-replay-failed');
  if ((input.commercialBoundary?.noGoReasons.length ?? 0) > 0) reasons.add('commercial-boundary-blocked');
  if (input.autoEnforceRequested === true) reasons.add('auto-enforce-requested');
  if (input.credentialIssuanceRequested === true) reasons.add('credential-issuance-requested');
  if (input.infrastructureDeployRequested === true) reasons.add('infrastructure-deploy-requested');
  if (input.productionTrafficExecutionRequested === true) reasons.add('production-traffic-execution-requested');
  if (input.rawPayloadStorageRequested === true) reasons.add('raw-payload-storage-requested');
  return Object.freeze([...reasons].sort());
}

function stepReasonCodes(stepId: PolicyFoundryHostedOnboardingWorkflowStepId):
readonly string[] {
  switch (stepId) {
    case 'source-intake':
      return Object.freeze(['collect-customer-owned-inputs', 'no-raw-payload-storage']);
    case 'surface-map':
      return Object.freeze(['data-minimized-surface-map', 'tenant-scoped-context']);
    case 'active-questions':
      return Object.freeze(['only-blocking-questions', 'currently-due-first']);
    case 'coverage-review':
      return Object.freeze(['coverage-no-go-review', 'evidence-gap-review']);
    case 'gate-plan':
      return Object.freeze(['smallest-safe-gate', 'verify-before-execute']);
    case 'adversarial-replay':
      return Object.freeze(['synthetic-local-replay', 'negative-case-no-go']);
    case 'patch-review':
      return Object.freeze(['review-only-patches', 'no-auto-apply']);
    case 'customer-approval':
      return Object.freeze(['human-approval-required', 'approval-not-evidence-substitute']);
    case 'scoped-rollout-review':
      return Object.freeze(['scoped-rollout-review-only', 'production-readiness-not-proven']);
  }
}

function nextSafeStepForStep(stepId: PolicyFoundryHostedOnboardingWorkflowStepId): string {
  switch (stepId) {
    case 'source-intake':
      return 'Upload or reference customer-owned OpenAPI, manifest, declaration, or shadow event inputs.';
    case 'surface-map':
      return 'Review the discovered action surfaces before generating policy or gate work.';
    case 'active-questions':
      return 'Answer only the active questions that block the next safe onboarding step.';
    case 'coverage-review':
      return 'Review coverage gaps before trusting a candidate or generated integration plan.';
    case 'gate-plan':
      return 'Choose the smallest reviewed verifier, gateway, MCP, sidecar, or provider-native gate path.';
    case 'adversarial-replay':
      return 'Run local synthetic adversarial replay and keep failed or missing cases as no-go evidence.';
    case 'patch-review':
      return 'Review generated patches manually; do not apply or deploy them from the hosted workflow.';
    case 'customer-approval':
      return 'Record customer approval only after evidence, replay, and gate blockers are closed.';
    case 'scoped-rollout-review':
      return 'Prepare a scoped rollout review packet; production deployment and smoke tests remain separate.';
  }
}

function sourceDigestForStep(
  stepId: PolicyFoundryHostedOnboardingWorkflowStepId,
  digests: PolicyFoundryHostedOnboardingWorkflowSourceDigests,
): string | null {
  switch (stepId) {
    case 'source-intake':
    case 'surface-map':
      return digests.selfOnboardingPacketDigest;
    case 'active-questions':
      return digests.onboardingSessionDigest;
    case 'coverage-review':
      return digests.coverageScoreDigest;
    case 'gate-plan':
      return digests.gatePlannerDigest;
    case 'adversarial-replay':
      return digests.adversarialReplayDigest ?? digests.redTeamFixtureDigest;
    case 'patch-review':
      return digests.reviewOnlyPatchPackDigest;
    case 'customer-approval':
      return digests.reviewHandoffDigest;
    case 'scoped-rollout-review':
      return digests.commercialBoundaryDigest ?? digests.gatePlannerDigest;
  }
}

function stepStatus(input: {
  readonly stepId: PolicyFoundryHostedOnboardingWorkflowStepId;
  readonly packet: PolicyFoundrySelfOnboardingCliPacket | null;
  readonly replay: PolicyFoundryAdversarialReplayExecutor | null;
  readonly reviewed: ReadonlySet<PolicyFoundryHostedOnboardingReviewedStepId>;
  readonly customerApprovalRecorded: boolean;
  readonly noGoReasons: readonly PolicyFoundryHostedOnboardingWorkflowNoGoReason[];
}): PolicyFoundryHostedOnboardingWorkflowStepStatus {
  if (!input.packet) {
    return input.stepId === 'source-intake' ? 'currently-due' : 'eventually-due';
  }
  if (
    input.stepId === 'adversarial-replay' &&
    input.replay?.status === 'failed'
  ) {
    return 'blocked';
  }
  if (
    input.stepId === 'scoped-rollout-review' &&
    input.noGoReasons.some((reason) =>
      reason === 'commercial-boundary-blocked' ||
      reason === 'auto-enforce-requested' ||
      reason === 'credential-issuance-requested' ||
      reason === 'infrastructure-deploy-requested' ||
      reason === 'production-traffic-execution-requested' ||
      reason === 'raw-payload-storage-requested'
    )
  ) {
    return 'blocked';
  }
  switch (input.stepId) {
    case 'source-intake':
      return input.packet.surfaceCount > 0 ? 'satisfied' : 'currently-due';
    case 'surface-map':
      return input.reviewed.has('surface-map') ? 'satisfied' : 'currently-due';
    case 'active-questions':
      if (input.packet.onboardingSession.activeQuestionCount === 0) return 'satisfied';
      return input.reviewed.has('active-questions') ? 'satisfied' : 'currently-due';
    case 'coverage-review':
      if (input.packet.coverage.blockedDimensions.length === 0 && input.packet.coverage.score >= 80) {
        return input.reviewed.has('coverage-review') ? 'satisfied' : 'currently-due';
      }
      return 'currently-due';
    case 'gate-plan':
      if (input.packet.gatePlanner.status === 'customer-review-ready' ||
        input.packet.gatePlanner.status === 'scoped-rollout-review-ready') {
        return input.reviewed.has('gate-plan') ? 'satisfied' : 'currently-due';
      }
      return 'currently-due';
    case 'adversarial-replay':
      if (!input.replay || input.replay.status === 'not-run') return 'currently-due';
      return input.reviewed.has('adversarial-replay') ? 'satisfied' : 'currently-due';
    case 'patch-review':
      if (input.packet.reviewOnlyPatchPack.patchCount === 0) return 'eventually-due';
      return input.reviewed.has('patch-review') ? 'satisfied' : 'currently-due';
    case 'customer-approval':
      return input.customerApprovalRecorded ? 'satisfied' : 'currently-due';
    case 'scoped-rollout-review':
      return input.customerApprovalRecorded && input.replay?.status === 'passed'
        ? 'satisfied'
        : 'eventually-due';
  }
}

function workflowStatus(input: {
  readonly packet: PolicyFoundrySelfOnboardingCliPacket | null;
  readonly replay: PolicyFoundryAdversarialReplayExecutor | null;
  readonly noGoReasons: readonly PolicyFoundryHostedOnboardingWorkflowNoGoReason[];
  readonly currentStepIds: readonly PolicyFoundryHostedOnboardingWorkflowStepId[];
  readonly blockedStepIds: readonly PolicyFoundryHostedOnboardingWorkflowStepId[];
  readonly customerApprovalRecorded: boolean;
}): PolicyFoundryHostedOnboardingWorkflowStatus {
  if (!input.packet) return 'no-input';
  if (input.blockedStepIds.length > 0 || input.noGoReasons.some((reason) =>
    reason !== 'adversarial-replay-missing'
  )) {
    return 'blocked';
  }
  if (input.customerApprovalRecorded && input.replay?.status === 'passed') {
    return 'scoped-rollout-review-ready';
  }
  if (input.currentStepIds.length > 0) return 'customer-action-required';
  return 'review-material-ready';
}

function nextSafeStep(input: {
  readonly status: PolicyFoundryHostedOnboardingWorkflowStatus;
  readonly noGoReasons: readonly PolicyFoundryHostedOnboardingWorkflowNoGoReason[];
  readonly steps: readonly PolicyFoundryHostedOnboardingWorkflowStep[];
}): string {
  if (input.noGoReasons.includes('source-packet-missing')) {
    return 'Create a self-onboarding packet from customer-owned manifest, declaration, or shadow evidence first.';
  }
  if (input.noGoReasons.some((reason) =>
    reason.endsWith('-requested') ||
    reason === 'commercial-boundary-blocked' ||
    reason === 'adversarial-replay-failed'
  )) {
    return 'Keep the hosted workflow in review-only mode and resolve the no-go reason before continuing.';
  }
  const current = input.steps.find((step) => step.status === 'currently-due');
  if (current) return current.nextSafeStep;
  if (input.status === 'scoped-rollout-review-ready') {
    return 'Prepare scoped rollout review evidence; deployment, entitlement enforcement, and production smoke tests remain separate.';
  }
  return 'Keep the workflow as review material until customer approval and rollout evidence are recorded.';
}

export function createPolicyFoundryHostedOnboardingWorkflow(
  input: CreatePolicyFoundryHostedOnboardingWorkflowInput = {},
): PolicyFoundryHostedOnboardingWorkflow {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date(0).toISOString(),
    'generatedAt',
  );
  const packet = input.selfOnboardingPacket ?? null;
  const replay = input.adversarialReplay ?? null;
  const reviewed = reviewedSteps(input.reviewedStepIds);
  const approvalRecorded = input.customerApprovalRecorded === true;
  const digests = sourceDigests(input);
  const reasons = noGoReasons(input);
  const steps = Object.freeze(POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STEP_IDS.map((stepId) => {
    const status = stepStatus({
      stepId,
      packet,
      replay,
      reviewed,
      customerApprovalRecorded: approvalRecorded,
      noGoReasons: reasons,
    });
    return Object.freeze({
      stepId,
      status,
      customerActionRequired: status === 'currently-due' || status === 'blocked',
      safeAutomationAllowed: status !== 'blocked',
      approvalRequired: stepId === 'customer-approval' || stepId === 'scoped-rollout-review',
      reasonCodes: stepReasonCodes(stepId),
      sourceDigest: sourceDigestForStep(stepId, digests),
      nextSafeStep: nextSafeStepForStep(stepId),
    });
  }));
  const currentStepIds = Object.freeze(steps
    .filter((step) => step.status === 'currently-due')
    .map((step) => step.stepId));
  const eventuallyDueStepIds = Object.freeze(steps
    .filter((step) => step.status === 'eventually-due')
    .map((step) => step.stepId));
  const satisfiedStepIds = Object.freeze(steps
    .filter((step) => step.status === 'satisfied')
    .map((step) => step.stepId));
  const blockedStepIds = Object.freeze(steps
    .filter((step) => step.status === 'blocked')
    .map((step) => step.stepId));
  const status = workflowStatus({
    packet,
    replay,
    noGoReasons: reasons,
    currentStepIds,
    blockedStepIds,
    customerApprovalRecorded: approvalRecorded,
  });
  const payload: Omit<PolicyFoundryHostedOnboardingWorkflow, 'canonical' | 'digest'> = {
    version: POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_VERSION,
    generatedAt,
    workflowId: workflowId(input),
    tenantDigest: normalizeOptionalString(input.tenantId) === null
      ? null
      : digestText(normalizeOptionalString(input.tenantId)!),
    status,
    sourceDigests: digests,
    surfaceCount: packet?.surfaceCount ?? 0,
    shadowEventCount: packet?.shadowEventCount ?? 0,
    blockerCount: (packet?.blockerCount ?? 0) + blockedStepIds.length + reasons.length,
    currentStepIds,
    eventuallyDueStepIds,
    satisfiedStepIds,
    blockedStepIds,
    steps,
    noGoReasons: reasons,
    safeAutomations: Object.freeze([
      'render-currently-due-checklist',
      'prefill-from-digest-bound-sources',
      'show-next-safe-step',
      'produce-review-links',
    ]),
    approvalGatedAutomations: Object.freeze([
      'apply-generated-patches',
      'activate-scoped-enforcement',
      'run-production-adversarial-replay',
      'change-commercial-entitlements',
    ]),
    prohibitedAutomations: Object.freeze([
      'store-raw-payloads',
      'issue-credentials',
      'deploy-infrastructure',
      'execute-production-traffic',
      'auto-enforce-policy',
    ]),
    nextSafeStep: nextSafeStep({ status, noGoReasons: reasons, steps }),
    approvalRequired: true,
    customerApprovalRecorded: approvalRecorded,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    hostedUiWorkflowContract: true,
    hostedUiImplemented: false,
    hostedRouteImplemented: false,
    appliesPatches: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    executesProductionTraffic: false,
    nonBypassableClaimAllowed: false,
    reviewMaterialOnly: true,
    deploymentEntitlementEnforcementImplemented: false,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-hosted-onboarding-workflow',
    limitations: Object.freeze([
      'This is a hosted workflow contract for review-state orchestration, not a hosted UI implementation.',
      'It does not deploy infrastructure, issue credentials, apply patches, execute production traffic, activate enforcement, or prove production readiness.',
      'Hosted entitlement enforcement, production adversarial replay, deployment restart, and smoke tests remain separate rollout evidence.',
    ]),
  };
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}

export function policyFoundryHostedOnboardingWorkflowDescriptor():
PolicyFoundryHostedOnboardingWorkflowDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_VERSION,
    statuses: POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STATUSES,
    stepIds: POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STEP_IDS,
    stepStatuses: POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_STEP_STATUSES,
    noGoReasons: POLICY_FOUNDRY_HOSTED_ONBOARDING_WORKFLOW_NO_GO_REASONS,
    reviewedStepIds: POLICY_FOUNDRY_HOSTED_ONBOARDING_REVIEWED_STEP_IDS,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    hostedUiWorkflowContract: true,
    hostedUiImplemented: false,
    hostedRouteImplemented: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    executesProductionTraffic: false,
    nonBypassableClaimAllowed: false,
    reviewMaterialOnly: true,
    deploymentEntitlementEnforcementImplemented: false,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-hosted-onboarding-workflow',
  });
}
