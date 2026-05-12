import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ActionSurfaceOnboardingPacket,
  ActionSurfaceOnboardingPacketStatus,
  ActionSurfaceOnboardingSurfacePlan,
} from './action-surface-onboarding-packet.js';
import type {
  AttestorGeneratedIntegrationArtifactKind,
  AttestorIntegrationControlKind,
  AttestorIntegrationNoGoReason,
  AttestorIntegrationReadinessStatus,
} from './integration-mode-readiness.js';

export const ACTION_SURFACE_ONBOARDING_REVIEW_HANDOFF_VERSION =
  'attestor.action-surface-onboarding-review-handoff.v1';

export const ACTION_SURFACE_ONBOARDING_REVIEW_STATUSES = [
  'blocked',
  'open',
  'ready-for-review',
] as const;
export type ActionSurfaceOnboardingReviewStatus =
  typeof ACTION_SURFACE_ONBOARDING_REVIEW_STATUSES[number];

export const ACTION_SURFACE_ONBOARDING_REVIEW_CHECKLIST_KINDS = [
  'packet-digest-reviewed',
  'shadow-capture-reviewed',
  'generated-artifacts-reviewed',
  'credential-boundary-reviewed',
  'downstream-verifier-reviewed',
  'policy-twin-reviewed',
  'red-team-replay-reviewed',
  'tenant-boundary-reviewed',
  'customer-approval-reviewed',
  'non-bypassable-claim-blocked',
] as const;
export type ActionSurfaceOnboardingReviewChecklistKind =
  typeof ACTION_SURFACE_ONBOARDING_REVIEW_CHECKLIST_KINDS[number];

export interface ActionSurfaceOnboardingReviewChecklistItem {
  readonly kind: ActionSurfaceOnboardingReviewChecklistKind;
  readonly status: ActionSurfaceOnboardingReviewStatus;
  readonly required: true;
  readonly protectedPrinciple: string;
  readonly evidenceRefs: readonly string[];
  readonly blockers: readonly string[];
}

export interface ActionSurfaceOnboardingReviewSurfaceSummary {
  readonly actionSurface: string;
  readonly surfaceId: string;
  readonly readinessStatus: AttestorIntegrationReadinessStatus;
  readonly reviewStatus: ActionSurfaceOnboardingReviewStatus;
  readonly recommendedIntegrationMode: ActionSurfaceOnboardingSurfacePlan['recommendedIntegrationMode'];
  readonly bypassRisk: ActionSurfaceOnboardingSurfacePlan['bypassRisk'];
  readonly eventCount: number;
  readonly declarationCount: number;
  readonly artifactKinds: readonly AttestorGeneratedIntegrationArtifactKind[];
  readonly readinessDigest: string;
  readonly missingControls: readonly AttestorIntegrationControlKind[];
  readonly noGoReasons: readonly AttestorIntegrationNoGoReason[];
  readonly nextReviewSteps: readonly string[];
}

export interface ActionSurfaceOnboardingReviewHandoff {
  readonly version: typeof ACTION_SURFACE_ONBOARDING_REVIEW_HANDOFF_VERSION;
  readonly handoffId: string;
  readonly generatedAt: string;
  readonly reviewerRef: string | null;
  readonly packetDigest: string;
  readonly packetStatus: ActionSurfaceOnboardingPacketStatus;
  readonly reviewStatus: ActionSurfaceOnboardingReviewStatus;
  readonly surfaceCount: number;
  readonly blockedSurfaceCount: number;
  readonly readyForReviewSurfaceCount: number;
  readonly artifactCount: number;
  readonly checklistItems: readonly ActionSurfaceOnboardingReviewChecklistItem[];
  readonly surfaceSummaries: readonly ActionSurfaceOnboardingReviewSurfaceSummary[];
  readonly nextReviewSteps: readonly string[];
  readonly remainingBlockers: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly executionPlanOnly: true;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly limitations: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateActionSurfaceOnboardingReviewHandoffInput {
  readonly packet: ActionSurfaceOnboardingPacket;
  readonly generatedAt?: string | null;
  readonly reviewerRef?: string | null;
}

export interface ActionSurfaceOnboardingReviewHandoffDescriptor {
  readonly version: typeof ACTION_SURFACE_ONBOARDING_REVIEW_HANDOFF_VERSION;
  readonly statuses: typeof ACTION_SURFACE_ONBOARDING_REVIEW_STATUSES;
  readonly checklistKinds: typeof ACTION_SURFACE_ONBOARDING_REVIEW_CHECKLIST_KINDS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly executionPlanOnly: true;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
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
    throw new Error(`Action surface onboarding review handoff ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function surfaceReviewStatus(
  plan: ActionSurfaceOnboardingSurfacePlan,
): ActionSurfaceOnboardingReviewStatus {
  if (plan.readinessStatus === 'no-go') return 'blocked';
  if (plan.readinessStatus === 'scoped-enforce-eligible') return 'ready-for-review';
  return 'open';
}

function evidenceForArtifactKind(
  packet: ActionSurfaceOnboardingPacket,
  kind: AttestorGeneratedIntegrationArtifactKind,
): readonly string[] {
  return Object.freeze(
    packet.artifactBundle.artifacts
      .filter((artifact) => artifact.kind === kind)
      .map((artifact) => artifact.digest)
      .sort(),
  );
}

function plansMissingControl(
  packet: ActionSurfaceOnboardingPacket,
  control: AttestorIntegrationControlKind,
): readonly ActionSurfaceOnboardingSurfacePlan[] {
  return Object.freeze(packet.surfacePlans.filter((plan) => plan.missingControls.includes(control)));
}

function plansMissingReason(
  packet: ActionSurfaceOnboardingPacket,
  reason: AttestorIntegrationNoGoReason,
): readonly ActionSurfaceOnboardingSurfacePlan[] {
  return Object.freeze(packet.surfacePlans.filter((plan) => plan.noGoReasons.includes(reason)));
}

function plansWithoutArtifact(
  packet: ActionSurfaceOnboardingPacket,
  kind: AttestorGeneratedIntegrationArtifactKind,
): readonly ActionSurfaceOnboardingSurfacePlan[] {
  return Object.freeze(packet.surfacePlans.filter((plan) => !plan.artifactKinds.includes(kind)));
}

function missingSurfaceBlockers(
  plans: readonly ActionSurfaceOnboardingSurfacePlan[],
  blockerPrefix: string,
): readonly string[] {
  return Object.freeze(
    plans.map((plan) => `${blockerPrefix}:${plan.actionSurface}`).sort(),
  );
}

function checklistItem(input: {
  readonly kind: ActionSurfaceOnboardingReviewChecklistKind;
  readonly status: ActionSurfaceOnboardingReviewStatus;
  readonly protectedPrinciple: string;
  readonly evidenceRefs?: readonly string[];
  readonly blockers?: readonly string[];
}): ActionSurfaceOnboardingReviewChecklistItem {
  return Object.freeze({
    kind: input.kind,
    status: input.status,
    required: true,
    protectedPrinciple: input.protectedPrinciple,
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])].sort()),
    blockers: Object.freeze([...(input.blockers ?? [])].sort()),
  });
}

function createChecklist(
  packet: ActionSurfaceOnboardingPacket,
): readonly ActionSurfaceOnboardingReviewChecklistItem[] {
  const emptyPacket = packet.surfacePlans.length === 0;
  const missingShadow = packet.surfacePlans.filter((plan) => plan.eventCount === 0);
  const missingVerifier = plansMissingControl(packet, 'verifier');
  const missingTenantBoundary = plansMissingControl(packet, 'tenant-boundary');
  const missingApproval = plansMissingControl(packet, 'customer-approval');
  const credentialExposure = plansMissingReason(packet, 'agent-direct-credential-exposed');
  const missingPolicyTwin = plansWithoutArtifact(packet, 'policy-twin-backtest');
  const missingRedTeamReplay = plansWithoutArtifact(packet, 'red-team-replay-fixture');
  const generatedArtifactsReviewed = plansMissingControl(packet, 'generated-artifacts-reviewed');

  return Object.freeze([
    checklistItem({
      kind: 'packet-digest-reviewed',
      status: emptyPacket ? 'blocked' : 'ready-for-review',
      protectedPrinciple: 'auditability',
      evidenceRefs: [packet.digest],
      blockers: emptyPacket ? ['no-action-surfaces-discovered'] : [],
    }),
    checklistItem({
      kind: 'shadow-capture-reviewed',
      status: emptyPacket || missingShadow.length > 0 ? 'blocked' : 'ready-for-review',
      protectedPrinciple: 'runtime readiness',
      evidenceRefs: packet.readinessDigests,
      blockers: emptyPacket
        ? ['no-action-surfaces-discovered']
        : missingSurfaceBlockers(missingShadow, 'shadow-capture-required'),
    }),
    checklistItem({
      kind: 'generated-artifacts-reviewed',
      status: emptyPacket || packet.artifactCount === 0 || generatedArtifactsReviewed.length > 0
        ? 'blocked'
        : 'ready-for-review',
      protectedPrinciple: 'no overclaim',
      evidenceRefs: packet.artifactBundle.artifacts.map((artifact) => artifact.digest),
      blockers: emptyPacket || packet.artifactCount === 0
        ? ['generated-artifacts-required']
        : missingSurfaceBlockers(generatedArtifactsReviewed, 'generated-artifact-review-required'),
    }),
    checklistItem({
      kind: 'credential-boundary-reviewed',
      status: credentialExposure.length > 0 ? 'blocked' : emptyPacket ? 'blocked' : 'ready-for-review',
      protectedPrinciple: 'customer authority',
      evidenceRefs: evidenceForArtifactKind(packet, 'credential-isolation-plan'),
      blockers: emptyPacket
        ? ['no-action-surfaces-discovered']
        : missingSurfaceBlockers(credentialExposure, 'credential-boundary-required'),
    }),
    checklistItem({
      kind: 'downstream-verifier-reviewed',
      status: missingVerifier.length > 0 || emptyPacket ? 'blocked' : 'ready-for-review',
      protectedPrinciple: 'fail-closed boundary',
      evidenceRefs: evidenceForArtifactKind(packet, 'verifier-helper-config'),
      blockers: emptyPacket
        ? ['no-action-surfaces-discovered']
        : missingSurfaceBlockers(missingVerifier, 'downstream-verifier-required'),
    }),
    checklistItem({
      kind: 'policy-twin-reviewed',
      status: emptyPacket || missingPolicyTwin.length > 0 ? 'blocked' : 'ready-for-review',
      protectedPrinciple: 'proof integrity',
      evidenceRefs: evidenceForArtifactKind(packet, 'policy-twin-backtest'),
      blockers: emptyPacket
        ? ['no-action-surfaces-discovered']
        : missingSurfaceBlockers(missingPolicyTwin, 'policy-twin-backtest-required'),
    }),
    checklistItem({
      kind: 'red-team-replay-reviewed',
      status: emptyPacket || missingRedTeamReplay.length > 0 ? 'blocked' : 'ready-for-review',
      protectedPrinciple: 'replay and idempotency safety',
      evidenceRefs: evidenceForArtifactKind(packet, 'red-team-replay-fixture'),
      blockers: emptyPacket
        ? ['no-action-surfaces-discovered']
        : missingSurfaceBlockers(missingRedTeamReplay, 'red-team-replay-required'),
    }),
    checklistItem({
      kind: 'tenant-boundary-reviewed',
      status: missingTenantBoundary.length > 0 || emptyPacket ? 'blocked' : 'ready-for-review',
      protectedPrinciple: 'tenant isolation',
      evidenceRefs: packet.readinessDigests,
      blockers: emptyPacket
        ? ['no-action-surfaces-discovered']
        : missingSurfaceBlockers(missingTenantBoundary, 'tenant-boundary-proof-required'),
    }),
    checklistItem({
      kind: 'customer-approval-reviewed',
      status: missingApproval.length > 0 || emptyPacket ? 'blocked' : 'ready-for-review',
      protectedPrinciple: 'customer authority',
      evidenceRefs: packet.readinessDigests,
      blockers: emptyPacket
        ? ['no-action-surfaces-discovered']
        : missingSurfaceBlockers(missingApproval, 'customer-approval-required'),
    }),
    checklistItem({
      kind: 'non-bypassable-claim-blocked',
      status: 'ready-for-review',
      protectedPrinciple: 'no overclaim',
      evidenceRefs: [packet.digest],
      blockers: [],
    }),
  ]);
}

function createSurfaceSummaries(
  packet: ActionSurfaceOnboardingPacket,
): readonly ActionSurfaceOnboardingReviewSurfaceSummary[] {
  return Object.freeze(
    packet.surfacePlans.map((plan) =>
      Object.freeze({
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        readinessStatus: plan.readinessStatus,
        reviewStatus: surfaceReviewStatus(plan),
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        bypassRisk: plan.bypassRisk,
        eventCount: plan.eventCount,
        declarationCount: plan.declarationCount,
        artifactKinds: plan.artifactKinds,
        readinessDigest: plan.readinessDigest,
        missingControls: plan.missingControls,
        noGoReasons: plan.noGoReasons,
        nextReviewSteps: plan.nextOnboardingSteps,
      })
    ),
  );
}

function overallReviewStatus(input: {
  readonly packet: ActionSurfaceOnboardingPacket;
  readonly surfaceSummaries: readonly ActionSurfaceOnboardingReviewSurfaceSummary[];
  readonly checklistItems: readonly ActionSurfaceOnboardingReviewChecklistItem[];
}): ActionSurfaceOnboardingReviewStatus {
  if (input.packet.surfacePlans.length === 0) return 'blocked';
  if (
    input.surfaceSummaries.some((summary) => summary.reviewStatus === 'blocked') ||
    input.checklistItems.some((item) => item.status === 'blocked')
  ) {
    return 'blocked';
  }
  if (input.surfaceSummaries.every((summary) => summary.reviewStatus === 'ready-for-review')) {
    return 'ready-for-review';
  }
  return 'open';
}

function remainingBlockers(input: {
  readonly surfaceSummaries: readonly ActionSurfaceOnboardingReviewSurfaceSummary[];
  readonly checklistItems: readonly ActionSurfaceOnboardingReviewChecklistItem[];
}): readonly string[] {
  const blockers = new Set<string>();
  for (const summary of input.surfaceSummaries) {
    for (const control of summary.missingControls) {
      blockers.add(`missing-control:${summary.actionSurface}:${control}`);
    }
    for (const reason of summary.noGoReasons) {
      blockers.add(`no-go:${summary.actionSurface}:${reason}`);
    }
  }
  for (const item of input.checklistItems) {
    for (const blocker of item.blockers) blockers.add(blocker);
  }
  return Object.freeze([...blockers].sort());
}

function nextReviewSteps(input: {
  readonly packet: ActionSurfaceOnboardingPacket;
  readonly surfaceSummaries: readonly ActionSurfaceOnboardingReviewSurfaceSummary[];
  readonly checklistItems: readonly ActionSurfaceOnboardingReviewChecklistItem[];
}): readonly string[] {
  const steps = new Set<string>();
  for (const summary of input.surfaceSummaries) {
    for (const step of summary.nextReviewSteps) steps.add(step);
  }
  for (const item of input.checklistItems) {
    if (item.status !== 'ready-for-review') steps.add(`${item.kind}:resolve`);
  }
  if (input.packet.surfacePlans.length > 0) steps.add('record-human-review-decision');
  if (steps.size === 0) steps.add('record-human-review-decision');
  return Object.freeze([...steps].sort());
}

export function createActionSurfaceOnboardingReviewHandoff(
  input: CreateActionSurfaceOnboardingReviewHandoffInput,
): ActionSurfaceOnboardingReviewHandoff {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const reviewerRef = normalizeOptionalString(input.reviewerRef);
  const checklistItems = createChecklist(input.packet);
  const surfaceSummaries = createSurfaceSummaries(input.packet);
  const reviewStatus = overallReviewStatus({
    packet: input.packet,
    surfaceSummaries,
    checklistItems,
  });
  const blockers = remainingBlockers({ surfaceSummaries, checklistItems });
  const body = {
    version: ACTION_SURFACE_ONBOARDING_REVIEW_HANDOFF_VERSION,
    handoffId: `action-surface-onboarding-review-handoff:${input.packet.digest}`,
    generatedAt,
    reviewerRef,
    packetDigest: input.packet.digest,
    packetStatus: input.packet.status,
    reviewStatus,
    surfaceCount: input.packet.profileCount,
    blockedSurfaceCount: surfaceSummaries.filter((summary) => summary.reviewStatus === 'blocked').length,
    readyForReviewSurfaceCount: surfaceSummaries.filter((summary) => summary.reviewStatus === 'ready-for-review').length,
    artifactCount: input.packet.artifactCount,
    checklistItems,
    surfaceSummaries,
    nextReviewSteps: nextReviewSteps({
      packet: input.packet,
      surfaceSummaries,
      checklistItems,
    }),
    remainingBlockers: blockers,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    executionPlanOnly: true,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
    limitations: Object.freeze([
      'This handoff summarizes onboarding review work only.',
      'It does not deploy infrastructure, issue credentials, activate enforcement, or claim production readiness.',
      'A ready-for-review handoff still requires customer-controlled approval and downstream deployment evidence before scoped enforcement can be considered.',
    ]),
  } as const;
  const canonical = canonicalObject(body as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...body,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function actionSurfaceOnboardingReviewHandoffDescriptor(): ActionSurfaceOnboardingReviewHandoffDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_ONBOARDING_REVIEW_HANDOFF_VERSION,
    statuses: ACTION_SURFACE_ONBOARDING_REVIEW_STATUSES,
    checklistKinds: ACTION_SURFACE_ONBOARDING_REVIEW_CHECKLIST_KINDS,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    executionPlanOnly: true,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
  });
}
