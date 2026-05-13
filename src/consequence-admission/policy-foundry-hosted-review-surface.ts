import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  PolicyFoundryHostedOnboardingWorkflow,
  PolicyFoundryHostedOnboardingWorkflowNoGoReason,
  PolicyFoundryHostedOnboardingWorkflowStep,
  PolicyFoundryHostedOnboardingWorkflowStepId,
  PolicyFoundryHostedOnboardingWorkflowStepStatus,
  PolicyFoundryHostedOnboardingWorkflowStatus,
} from './policy-foundry-hosted-onboarding-workflow.js';

export const POLICY_FOUNDRY_HOSTED_REVIEW_SURFACE_VERSION =
  'attestor.policy-foundry-hosted-review-surface.v1';

export const POLICY_FOUNDRY_HOSTED_REVIEW_SURFACE_TASK_PRIORITIES = [
  'blocked',
  'currently-due',
  'eventually-due',
  'satisfied',
] as const;
export type PolicyFoundryHostedReviewSurfaceTaskPriority =
  typeof POLICY_FOUNDRY_HOSTED_REVIEW_SURFACE_TASK_PRIORITIES[number];

export interface CreatePolicyFoundryHostedReviewSurfaceInput {
  readonly generatedAt?: string | null;
  readonly workflow: PolicyFoundryHostedOnboardingWorkflow;
}

export interface PolicyFoundryHostedReviewTask {
  readonly stepId: PolicyFoundryHostedOnboardingWorkflowStepId;
  readonly status: PolicyFoundryHostedOnboardingWorkflowStepStatus;
  readonly priority: PolicyFoundryHostedReviewSurfaceTaskPriority;
  readonly title: string;
  readonly safeInstruction: string;
  readonly reasonCodes: readonly string[];
  readonly sourceDigest: string | null;
  readonly customerActionRequired: boolean;
  readonly approvalRequired: boolean;
}

export interface PolicyFoundryHostedReviewEvidenceCard {
  readonly evidenceKind: string;
  readonly digest: string;
  readonly label: string;
}

export interface PolicyFoundryHostedReviewNoGoCard {
  readonly reason: PolicyFoundryHostedOnboardingWorkflowNoGoReason;
  readonly severity: 'blocker' | 'missing-evidence';
  readonly safeInstruction: string;
}

export interface PolicyFoundryHostedReviewSurface {
  readonly version: typeof POLICY_FOUNDRY_HOSTED_REVIEW_SURFACE_VERSION;
  readonly generatedAt: string;
  readonly reviewSurfaceId: string;
  readonly workflowId: string;
  readonly workflowDigest: string;
  readonly tenantDigest: string | null;
  readonly status: PolicyFoundryHostedOnboardingWorkflowStatus;
  readonly headline: string;
  readonly nextSafeStep: string;
  readonly surfaceCount: number;
  readonly shadowEventCount: number;
  readonly blockerCount: number;
  readonly currentTaskCount: number;
  readonly noGoCount: number;
  readonly taskCards: readonly PolicyFoundryHostedReviewTask[];
  readonly noGoCards: readonly PolicyFoundryHostedReviewNoGoCard[];
  readonly evidenceCards: readonly PolicyFoundryHostedReviewEvidenceCard[];
  readonly safeAutomations: readonly string[];
  readonly approvalGatedAutomations: readonly string[];
  readonly prohibitedAutomations: readonly string[];
  readonly approvalRequired: true;
  readonly customerApprovalRecorded: boolean;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly hostedUiImplemented: false;
  readonly appliesPatches: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly executesProductionTraffic: false;
  readonly nonBypassableClaimAllowed: false;
  readonly reviewMaterialOnly: true;
  readonly fullPacketRequiredForImplementation: true;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-hosted-review-surface';
  readonly limitations: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryHostedReviewSurfaceDescriptor {
  readonly version: typeof POLICY_FOUNDRY_HOSTED_REVIEW_SURFACE_VERSION;
  readonly taskPriorities: typeof POLICY_FOUNDRY_HOSTED_REVIEW_SURFACE_TASK_PRIORITIES;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly hostedUiImplemented: false;
  readonly appliesPatches: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly executesProductionTraffic: false;
  readonly nonBypassableClaimAllowed: false;
  readonly reviewMaterialOnly: true;
  readonly fullPacketRequiredForImplementation: true;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-hosted-review-surface';
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
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Policy Foundry hosted review surface generatedAt must be an ISO timestamp.');
  }
  return timestamp.toISOString();
}

function reviewSurfaceId(workflow: PolicyFoundryHostedOnboardingWorkflow): string {
  return `hosted_review_${createHash('sha256').update(workflow.digest).digest('hex').slice(0, 24)}`;
}

function headlineFor(status: PolicyFoundryHostedOnboardingWorkflowStatus): string {
  switch (status) {
    case 'no-input':
      return 'Source intake required';
    case 'customer-action-required':
      return 'Customer action required';
    case 'blocked':
      return 'No-go blockers present';
    case 'review-material-ready':
      return 'Review material ready';
    case 'scoped-rollout-review-ready':
      return 'Scoped rollout review ready';
  }
}

function titleForStep(stepId: PolicyFoundryHostedOnboardingWorkflowStepId): string {
  switch (stepId) {
    case 'source-intake':
      return 'Source intake';
    case 'surface-map':
      return 'Surface map review';
    case 'active-questions':
      return 'Active questions';
    case 'coverage-review':
      return 'Coverage review';
    case 'gate-plan':
      return 'Gate plan review';
    case 'adversarial-replay':
      return 'Adversarial replay';
    case 'patch-review':
      return 'Patch review';
    case 'customer-approval':
      return 'Customer approval';
    case 'scoped-rollout-review':
      return 'Scoped rollout review';
  }
}

function priorityFor(status: PolicyFoundryHostedOnboardingWorkflowStepStatus):
PolicyFoundryHostedReviewSurfaceTaskPriority {
  return status;
}

function taskCard(step: PolicyFoundryHostedOnboardingWorkflowStep): PolicyFoundryHostedReviewTask {
  return Object.freeze({
    stepId: step.stepId,
    status: step.status,
    priority: priorityFor(step.status),
    title: titleForStep(step.stepId),
    safeInstruction: step.nextSafeStep,
    reasonCodes: step.reasonCodes,
    sourceDigest: step.sourceDigest,
    customerActionRequired: step.customerActionRequired,
    approvalRequired: step.approvalRequired,
  });
}

function noGoInstruction(reason: PolicyFoundryHostedOnboardingWorkflowNoGoReason): string {
  switch (reason) {
    case 'source-packet-missing':
      return 'Collect customer-owned manifests, declarations, or shadow evidence before rendering review material.';
    case 'adversarial-replay-missing':
      return 'Run local synthetic adversarial replay before using the workflow for approval.';
    case 'adversarial-replay-failed':
      return 'Keep the workflow blocked until failed replay cases are fixed and rerun.';
    case 'commercial-boundary-blocked':
      return 'Reduce requested capability scope or resolve plan boundary review before activation.';
    case 'auto-enforce-requested':
      return 'Remove auto-enforcement from the hosted workflow request.';
    case 'credential-issuance-requested':
      return 'Keep credential issuance outside this review surface.';
    case 'infrastructure-deploy-requested':
      return 'Keep infrastructure deployment outside this review surface.';
    case 'production-traffic-execution-requested':
      return 'Do not execute production traffic from the hosted onboarding workflow.';
    case 'raw-payload-storage-requested':
      return 'Remove raw payload storage from the request and keep digest-only review material.';
  }
}

function noGoCard(reason: PolicyFoundryHostedOnboardingWorkflowNoGoReason):
PolicyFoundryHostedReviewNoGoCard {
  return Object.freeze({
    reason,
    severity: reason === 'adversarial-replay-missing' || reason === 'source-packet-missing'
      ? 'missing-evidence'
      : 'blocker',
    safeInstruction: noGoInstruction(reason),
  });
}

function evidenceLabel(kind: string): string {
  switch (kind) {
    case 'selfOnboardingPacketDigest':
      return 'Self-onboarding packet';
    case 'onboardingSessionDigest':
      return 'Onboarding session';
    case 'coverageScoreDigest':
      return 'Coverage score';
    case 'gatePlannerDigest':
      return 'Gate planner';
    case 'reviewHandoffDigest':
      return 'Review handoff';
    case 'redTeamFixtureDigest':
      return 'Red-team fixtures';
    case 'reviewOnlyPatchPackDigest':
      return 'Review-only patch pack';
    case 'adversarialReplayDigest':
      return 'Adversarial replay report';
    case 'commercialBoundaryDigest':
      return 'Commercial boundary';
    default:
      return kind;
  }
}

function evidenceCards(
  workflow: PolicyFoundryHostedOnboardingWorkflow,
): readonly PolicyFoundryHostedReviewEvidenceCard[] {
  return Object.freeze(Object.entries(workflow.sourceDigests)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
    .map(([evidenceKind, digest]) => Object.freeze({
      evidenceKind,
      digest,
      label: evidenceLabel(evidenceKind),
    })));
}

function sortTasks(
  tasks: readonly PolicyFoundryHostedReviewTask[],
): readonly PolicyFoundryHostedReviewTask[] {
  const order = new Map<PolicyFoundryHostedReviewSurfaceTaskPriority, number>(
    POLICY_FOUNDRY_HOSTED_REVIEW_SURFACE_TASK_PRIORITIES.map((priority, index) => [priority, index]),
  );
  return Object.freeze([...tasks].sort((left, right) =>
    (order.get(left.priority) ?? 99) - (order.get(right.priority) ?? 99)
  ));
}

export function createPolicyFoundryHostedReviewSurface(
  input: CreatePolicyFoundryHostedReviewSurfaceInput,
): PolicyFoundryHostedReviewSurface {
  const workflow = input.workflow;
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, workflow.generatedAt);
  const tasks = sortTasks(workflow.steps.map(taskCard));
  const noGoCards = Object.freeze(workflow.noGoReasons.map(noGoCard));
  const payload: Omit<PolicyFoundryHostedReviewSurface, 'canonical' | 'digest'> = {
    version: POLICY_FOUNDRY_HOSTED_REVIEW_SURFACE_VERSION,
    generatedAt,
    reviewSurfaceId: reviewSurfaceId(workflow),
    workflowId: workflow.workflowId,
    workflowDigest: workflow.digest,
    tenantDigest: workflow.tenantDigest,
    status: workflow.status,
    headline: headlineFor(workflow.status),
    nextSafeStep: workflow.nextSafeStep,
    surfaceCount: workflow.surfaceCount,
    shadowEventCount: workflow.shadowEventCount,
    blockerCount: workflow.blockerCount,
    currentTaskCount: workflow.currentStepIds.length + workflow.blockedStepIds.length,
    noGoCount: workflow.noGoReasons.length,
    taskCards: tasks,
    noGoCards,
    evidenceCards: evidenceCards(workflow),
    safeAutomations: workflow.safeAutomations,
    approvalGatedAutomations: workflow.approvalGatedAutomations,
    prohibitedAutomations: workflow.prohibitedAutomations,
    approvalRequired: true,
    customerApprovalRecorded: workflow.customerApprovalRecorded,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    hostedUiImplemented: false,
    appliesPatches: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    executesProductionTraffic: false,
    nonBypassableClaimAllowed: false,
    reviewMaterialOnly: true,
    fullPacketRequiredForImplementation: true,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-hosted-review-surface',
    limitations: Object.freeze([
      'This is a compact hosted review surface, not a hosted UI implementation.',
      'It intentionally omits raw onboarding inputs and uses workflow/source digests for deeper evidence lookup.',
      'It does not apply patches, deploy infrastructure, issue credentials, execute production traffic, activate enforcement, or prove production readiness.',
    ]),
  };
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}

export function policyFoundryHostedReviewSurfaceDescriptor():
PolicyFoundryHostedReviewSurfaceDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_HOSTED_REVIEW_SURFACE_VERSION,
    taskPriorities: POLICY_FOUNDRY_HOSTED_REVIEW_SURFACE_TASK_PRIORITIES,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    hostedUiImplemented: false,
    appliesPatches: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    executesProductionTraffic: false,
    nonBypassableClaimAllowed: false,
    reviewMaterialOnly: true,
    fullPacketRequiredForImplementation: true,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-hosted-review-surface',
  });
}
