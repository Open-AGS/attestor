import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ActionSurfaceOnboardingPacket,
} from './action-surface-onboarding-packet.js';
import type {
  AttestorGeneratedIntegrationArtifactKind,
  AttestorIntegrationMode,
} from './integration-mode-readiness.js';

export const ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION =
  'attestor.action-surface-integration-kit-packet.v1';

export const ACTION_SURFACE_INTEGRATION_KIT_OUTPUT_FILES = [
  'README.md',
  'summary.json',
  'artifact-manifest.json',
  'no-bypass-probes.json',
  'approval-record.template.json',
] as const;
export type ActionSurfaceIntegrationKitOutputFile =
  typeof ACTION_SURFACE_INTEGRATION_KIT_OUTPUT_FILES[number];

export const ACTION_SURFACE_INTEGRATION_KIT_STATUSES = [
  'no-surfaces',
  'review-required',
] as const;
export type ActionSurfaceIntegrationKitStatus =
  typeof ACTION_SURFACE_INTEGRATION_KIT_STATUSES[number];

export const ACTION_SURFACE_INTEGRATION_KIT_PROBE_KINDS = [
  'direct-downstream-without-attestor-presentation',
  'stale-or-replayed-presentation',
  'narrow-decision-with-original-wide-request',
  'review-or-block-reaches-downstream-execution',
  'verifier-unavailable-in-enforcement-mode',
  'observe-mode-would-block-recorded-only',
] as const;
export type ActionSurfaceIntegrationKitProbeKind =
  typeof ACTION_SURFACE_INTEGRATION_KIT_PROBE_KINDS[number];

export const ACTION_SURFACE_INTEGRATION_KIT_APPROVAL_DECISIONS = [
  'approve',
  'reject',
  'hold',
] as const;
export type ActionSurfaceIntegrationKitApprovalDecision =
  typeof ACTION_SURFACE_INTEGRATION_KIT_APPROVAL_DECISIONS[number];

export interface CreateActionSurfaceIntegrationKitPacketInput {
  readonly packet: ActionSurfaceOnboardingPacket;
  readonly generatedAt?: string | null;
}

export interface ActionSurfaceIntegrationKitReviewFile {
  readonly fileName: ActionSurfaceIntegrationKitOutputFile;
  readonly digest: string;
  readonly purpose: string;
  readonly requiredReview: true;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface ActionSurfaceIntegrationKitArtifactEntry {
  readonly artifactId: string;
  readonly actionSurface: string;
  readonly mode: AttestorIntegrationMode;
  readonly kind: AttestorGeneratedIntegrationArtifactKind;
  readonly domain: string | null;
  readonly downstreamSystem: string | null;
  readonly operationRefs: readonly string[];
  readonly digest: string;
  readonly requiredReview: true;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface ActionSurfaceIntegrationKitArtifactManifest {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION;
  readonly generatedAt: string;
  readonly sourcePacketDigest: string;
  readonly artifactCount: number;
  readonly artifacts: readonly ActionSurfaceIntegrationKitArtifactEntry[];
  readonly artifactKinds: readonly AttestorGeneratedIntegrationArtifactKind[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly nonBypassableClaimAllowed: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceIntegrationKitNoBypassProbeCase {
  readonly probeId: string;
  readonly kind: ActionSurfaceIntegrationKitProbeKind;
  readonly actionSurface: string;
  readonly mode: AttestorIntegrationMode;
  readonly expectedResult: 'fail' | 'recorded-as-would-block-only';
  readonly requiresCustomerStopPoint: true;
  readonly proofResultRecorded: false;
  readonly authority: 'proof-plan-only';
}

export interface ActionSurfaceIntegrationKitNoBypassProbePlan {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION;
  readonly generatedAt: string;
  readonly sourcePacketDigest: string;
  readonly probeCaseCount: number;
  readonly probeCases: readonly ActionSurfaceIntegrationKitNoBypassProbeCase[];
  readonly liveProofRegisterRef: 'LP-CUSTOMER-PEP-NO-BYPASS';
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly nonBypassableClaimAllowed: false;
  readonly proofResultRecorded: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceIntegrationKitApprovalRecordTemplate {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION;
  readonly generatedAt: string;
  readonly sourcePacketDigest: string;
  readonly reviewerFields: readonly string[];
  readonly decisionOptions: typeof ACTION_SURFACE_INTEGRATION_KIT_APPROVAL_DECISIONS;
  readonly grantsAuthority: false;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly nonBypassableClaimAllowed: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceIntegrationKitSummary {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION;
  readonly generatedAt: string;
  readonly status: ActionSurfaceIntegrationKitStatus;
  readonly sourcePacketDigest: string;
  readonly surfaceCount: number;
  readonly artifactManifestDigest: string;
  readonly noBypassProbePlanDigest: string;
  readonly approvalRecordTemplateDigest: string;
  readonly outputFiles: typeof ACTION_SURFACE_INTEGRATION_KIT_OUTPUT_FILES;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly executionPlanOnly: true;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceIntegrationKitPacket {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION;
  readonly generatedAt: string;
  readonly status: ActionSurfaceIntegrationKitStatus;
  readonly sourcePacketDigest: string;
  readonly summary: ActionSurfaceIntegrationKitSummary;
  readonly artifactManifest: ActionSurfaceIntegrationKitArtifactManifest;
  readonly noBypassProbePlan: ActionSurfaceIntegrationKitNoBypassProbePlan;
  readonly approvalRecordTemplate: ActionSurfaceIntegrationKitApprovalRecordTemplate;
  readonly reviewFiles: readonly ActionSurfaceIntegrationKitReviewFile[];
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

export interface ActionSurfaceIntegrationKitPacketDescriptor {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION;
  readonly outputFiles: typeof ACTION_SURFACE_INTEGRATION_KIT_OUTPUT_FILES;
  readonly statuses: typeof ACTION_SURFACE_INTEGRATION_KIT_STATUSES;
  readonly probeKinds: typeof ACTION_SURFACE_INTEGRATION_KIT_PROBE_KINDS;
  readonly approvalDecisionOptions: typeof ACTION_SURFACE_INTEGRATION_KIT_APPROVAL_DECISIONS;
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
    throw new Error(`Action surface integration kit packet ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function withCanonical<T extends object>(
  body: T,
): T & {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalObject(body as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...body,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function createArtifactManifest(input: {
  readonly packet: ActionSurfaceOnboardingPacket;
  readonly generatedAt: string;
}): ActionSurfaceIntegrationKitArtifactManifest {
  const artifacts = Object.freeze(
    input.packet.artifactBundle.artifacts.map((artifact) =>
      Object.freeze({
        artifactId: artifact.artifactId,
        actionSurface: artifact.actionSurface,
        mode: artifact.mode,
        kind: artifact.kind,
        domain: artifact.domain,
        downstreamSystem: artifact.downstreamSystem,
        operationRefs: Object.freeze([...artifact.operationRefs].sort()),
        digest: artifact.digest,
        requiredReview: true,
        rawPayloadStored: false,
        productionReady: false,
      })
    ),
  );
  return withCanonical({
    version: ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION,
    generatedAt: input.generatedAt,
    sourcePacketDigest: input.packet.digest,
    artifactCount: artifacts.length,
    artifacts,
    artifactKinds: Object.freeze([...new Set(artifacts.map((artifact) => artifact.kind))].sort()),
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    nonBypassableClaimAllowed: false,
  } as const);
}

function expectedProbeResult(
  kind: ActionSurfaceIntegrationKitProbeKind,
): ActionSurfaceIntegrationKitNoBypassProbeCase['expectedResult'] {
  return kind === 'observe-mode-would-block-recorded-only'
    ? 'recorded-as-would-block-only'
    : 'fail';
}

function createProbePlan(input: {
  readonly packet: ActionSurfaceOnboardingPacket;
  readonly generatedAt: string;
}): ActionSurfaceIntegrationKitNoBypassProbePlan {
  const probeCases = Object.freeze(
    input.packet.surfacePlans.flatMap((plan) =>
      ACTION_SURFACE_INTEGRATION_KIT_PROBE_KINDS.map((kind) =>
        Object.freeze({
          probeId: `no-bypass:${plan.surfaceId}:${kind}`,
          kind,
          actionSurface: plan.actionSurface,
          mode: plan.recommendedIntegrationMode,
          expectedResult: expectedProbeResult(kind),
          requiresCustomerStopPoint: true,
          proofResultRecorded: false,
          authority: 'proof-plan-only' as const,
        })
      )
    ),
  );
  return withCanonical({
    version: ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION,
    generatedAt: input.generatedAt,
    sourcePacketDigest: input.packet.digest,
    probeCaseCount: probeCases.length,
    probeCases,
    liveProofRegisterRef: 'LP-CUSTOMER-PEP-NO-BYPASS',
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    nonBypassableClaimAllowed: false,
    proofResultRecorded: false,
  } as const);
}

function createApprovalRecordTemplate(input: {
  readonly packet: ActionSurfaceOnboardingPacket;
  readonly generatedAt: string;
}): ActionSurfaceIntegrationKitApprovalRecordTemplate {
  return withCanonical({
    version: ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION,
    generatedAt: input.generatedAt,
    sourcePacketDigest: input.packet.digest,
    reviewerFields: Object.freeze([
      'reviewerName',
      'reviewerRole',
      'reviewedAt',
      'sourcePacketDigest',
      'artifactManifestDigest',
      'noBypassProbePlanDigest',
      'decision',
      'decisionRationale',
    ]),
    decisionOptions: ACTION_SURFACE_INTEGRATION_KIT_APPROVAL_DECISIONS,
    grantsAuthority: false,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    nonBypassableClaimAllowed: false,
  } as const);
}

function createSummary(input: {
  readonly packet: ActionSurfaceOnboardingPacket;
  readonly generatedAt: string;
  readonly artifactManifest: ActionSurfaceIntegrationKitArtifactManifest;
  readonly noBypassProbePlan: ActionSurfaceIntegrationKitNoBypassProbePlan;
  readonly approvalRecordTemplate: ActionSurfaceIntegrationKitApprovalRecordTemplate;
}): ActionSurfaceIntegrationKitSummary {
  return withCanonical({
    version: ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION,
    generatedAt: input.generatedAt,
    status: input.packet.surfacePlans.length === 0 ? 'no-surfaces' : 'review-required',
    sourcePacketDigest: input.packet.digest,
    surfaceCount: input.packet.surfacePlans.length,
    artifactManifestDigest: input.artifactManifest.digest,
    noBypassProbePlanDigest: input.noBypassProbePlan.digest,
    approvalRecordTemplateDigest: input.approvalRecordTemplate.digest,
    outputFiles: ACTION_SURFACE_INTEGRATION_KIT_OUTPUT_FILES,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    executionPlanOnly: true,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
  } as const);
}

function reviewFilesFor(input: {
  readonly summary: ActionSurfaceIntegrationKitSummary;
  readonly artifactManifest: ActionSurfaceIntegrationKitArtifactManifest;
  readonly noBypassProbePlan: ActionSurfaceIntegrationKitNoBypassProbePlan;
  readonly approvalRecordTemplate: ActionSurfaceIntegrationKitApprovalRecordTemplate;
}): readonly ActionSurfaceIntegrationKitReviewFile[] {
  return Object.freeze([
    Object.freeze({
      fileName: 'README.md' as const,
      digest: input.summary.digest,
      purpose: 'human-review-entry-point',
      requiredReview: true,
      rawPayloadStored: false,
      productionReady: false,
    }),
    Object.freeze({
      fileName: 'summary.json' as const,
      digest: input.summary.digest,
      purpose: 'machine-summary-entry-point',
      requiredReview: true,
      rawPayloadStored: false,
      productionReady: false,
    }),
    Object.freeze({
      fileName: 'artifact-manifest.json' as const,
      digest: input.artifactManifest.digest,
      purpose: 'generated-artifact-digest-index',
      requiredReview: true,
      rawPayloadStored: false,
      productionReady: false,
    }),
    Object.freeze({
      fileName: 'no-bypass-probes.json' as const,
      digest: input.noBypassProbePlan.digest,
      purpose: 'customer-stop-point-proof-plan',
      requiredReview: true,
      rawPayloadStored: false,
      productionReady: false,
    }),
    Object.freeze({
      fileName: 'approval-record.template.json' as const,
      digest: input.approvalRecordTemplate.digest,
      purpose: 'reviewer-decision-template',
      requiredReview: true,
      rawPayloadStored: false,
      productionReady: false,
    }),
  ]);
}

export function createActionSurfaceIntegrationKitPacket(
  input: CreateActionSurfaceIntegrationKitPacketInput,
): ActionSurfaceIntegrationKitPacket {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    input.packet.generatedAt,
    'generatedAt',
  );
  const artifactManifest = createArtifactManifest({
    packet: input.packet,
    generatedAt,
  });
  const noBypassProbePlan = createProbePlan({
    packet: input.packet,
    generatedAt,
  });
  const approvalRecordTemplate = createApprovalRecordTemplate({
    packet: input.packet,
    generatedAt,
  });
  const summary = createSummary({
    packet: input.packet,
    generatedAt,
    artifactManifest,
    noBypassProbePlan,
    approvalRecordTemplate,
  });
  const reviewFiles = reviewFilesFor({
    summary,
    artifactManifest,
    noBypassProbePlan,
    approvalRecordTemplate,
  });
  const body = {
    version: ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION,
    generatedAt,
    status: summary.status,
    sourcePacketDigest: input.packet.digest,
    summary,
    artifactManifest,
    noBypassProbePlan,
    approvalRecordTemplate,
    reviewFiles,
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
      'This packet is a review contract, not an apply step.',
      'It does not write files, deploy gateways, issue credentials, or activate enforcement.',
      'No-bypass probes are proof plans until run against a reviewed customer stop point.',
    ]),
  } as const;
  return withCanonical(body);
}

export function actionSurfaceIntegrationKitPacketDescriptor(): ActionSurfaceIntegrationKitPacketDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_INTEGRATION_KIT_PACKET_VERSION,
    outputFiles: ACTION_SURFACE_INTEGRATION_KIT_OUTPUT_FILES,
    statuses: ACTION_SURFACE_INTEGRATION_KIT_STATUSES,
    probeKinds: ACTION_SURFACE_INTEGRATION_KIT_PROBE_KINDS,
    approvalDecisionOptions: ACTION_SURFACE_INTEGRATION_KIT_APPROVAL_DECISIONS,
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
