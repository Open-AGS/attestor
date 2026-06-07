import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ATTESTOR_INTEGRATION_MODE_READINESS_VERSION,
  type AttestorGeneratedIntegrationArtifactKind,
  type AttestorIntegrationControlKind,
  type AttestorIntegrationNoGoReason,
  type AttestorIntegrationReadinessStatus,
} from './integration-mode-readiness.js';
import {
  RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
  assertRuntimeSignalAuthorityBoundary,
} from './runtime-signal-authority-guard.js';
import {
  RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION,
  mapRuntimeSignalToConsequenceCandidate,
  type RuntimeSignalConsequenceCandidate,
  type RuntimeSignalConsequenceMissingControl,
} from './runtime-signal-consequence-mapping.js';
import {
  RUNTIME_SIGNAL_ENVELOPE_VERSION,
  type RuntimeSignalEnvelope,
} from './runtime-signal-envelope.js';
import {
  RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION,
  createRuntimeSignalIntegrationReadinessBridge,
  type RuntimeSignalGatePlacementKind,
  type RuntimeSignalIntegrationReadinessBridge,
} from './runtime-signal-integration-readiness-bridge.js';
import type {
  ActionRiskNextStep,
  ActionRiskSignal,
} from './action-risk-inventory.js';
import type {
  ConsequenceEnvelopeConsequenceClass,
} from './consequence-envelope-contract.js';

export const RUNTIME_SIGNAL_REVIEW_PACKET_VERSION =
  'attestor.runtime-signal-review-packet.v1';

export const RUNTIME_SIGNAL_REVIEW_PACKET_REQUIRED_FIELDS = [
  'sourceSignalDigest',
  'candidateDigest',
  'readinessBridgeDigest',
  'action',
  'consequence',
  'missing',
  'gate',
  'reviewChecklist',
] as const;
export type RuntimeSignalReviewPacketRequiredField =
  typeof RUNTIME_SIGNAL_REVIEW_PACKET_REQUIRED_FIELDS[number];

export const RUNTIME_SIGNAL_REVIEW_PACKET_NON_CLAIMS = [
  'not-authority',
  'not-admission',
  'not-gate-deployment',
  'not-proof-intake',
  'not-production-ready',
] as const;
export type RuntimeSignalReviewPacketNonClaim =
  typeof RUNTIME_SIGNAL_REVIEW_PACKET_NON_CLAIMS[number];

export interface CreateRuntimeSignalReviewPacketInput {
  readonly envelope: RuntimeSignalEnvelope;
  readonly candidate?: RuntimeSignalConsequenceCandidate | null;
  readonly readinessBridge?: RuntimeSignalIntegrationReadinessBridge | null;
  readonly generatedAt?: string | null;
  readonly reviewerScope?: string | null;
}

export interface RuntimeSignalReviewPacketActionSummary {
  readonly signalKind: RuntimeSignalEnvelope['signalKind'];
  readonly sourceTrustLevel: RuntimeSignalEnvelope['sourceTrustLevel'];
  readonly sourceSystem: string;
  readonly actionSurface: string;
  readonly downstreamSystem: string | null;
  readonly operationRef: string | null;
  readonly sourceSignalDigest: string;
}

export interface RuntimeSignalReviewPacketConsequenceSummary {
  readonly consequenceClass: ConsequenceEnvelopeConsequenceClass;
  readonly candidateOrigin: RuntimeSignalConsequenceCandidate['candidateOrigin'];
  readonly riskSignals: readonly ActionRiskSignal[];
  readonly recommendedNextStep: ActionRiskNextStep;
  readonly candidateDigest: string;
}

export interface RuntimeSignalReviewPacketMissingSummary {
  readonly consequenceMissingControls: readonly RuntimeSignalConsequenceMissingControl[];
  readonly readinessMissingControls: readonly AttestorIntegrationControlKind[];
  readonly readinessNoGoReasons: readonly AttestorIntegrationNoGoReason[];
  readonly missingRecommendedArtifacts: readonly AttestorGeneratedIntegrationArtifactKind[];
}

export interface RuntimeSignalReviewPacketGateSummary {
  readonly placement: RuntimeSignalGatePlacementKind;
  readonly mode: RuntimeSignalIntegrationReadinessBridge['mode'];
  readonly readinessStatus: AttestorIntegrationReadinessStatus;
  readonly credentialIsolation: RuntimeSignalIntegrationReadinessBridge['credentialIsolation'];
  readonly bypassRisk: RuntimeSignalIntegrationReadinessBridge['readiness']['bypassRisk'];
  readonly nonBypassableClaimAllowed: boolean;
  readonly nextSafeStep: string;
}

export interface RuntimeSignalReviewPacket {
  readonly version: typeof RUNTIME_SIGNAL_REVIEW_PACKET_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly runtimeSignalConsequenceMappingVersion: typeof RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION;
  readonly runtimeSignalIntegrationReadinessBridgeVersion: typeof RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION;
  readonly runtimeSignalAuthorityGuardVersion: typeof RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION;
  readonly integrationModeReadinessVersion: typeof ATTESTOR_INTEGRATION_MODE_READINESS_VERSION;
  readonly generatedAt: string;
  readonly reviewerScope: string;
  readonly sourceSignalDigest: string;
  readonly candidateDigest: string;
  readonly readinessBridgeDigest: string;
  readonly action: RuntimeSignalReviewPacketActionSummary;
  readonly consequence: RuntimeSignalReviewPacketConsequenceSummary;
  readonly missing: RuntimeSignalReviewPacketMissingSummary;
  readonly gate: RuntimeSignalReviewPacketGateSummary;
  readonly reviewChecklist: readonly string[];
  readonly requiredFields: typeof RUNTIME_SIGNAL_REVIEW_PACKET_REQUIRED_FIELDS;
  readonly nonClaims: typeof RUNTIME_SIGNAL_REVIEW_PACKET_NON_CLAIMS;
  readonly digestOnly: true;
  readonly reviewMaterialOnly: true;
  readonly approvalRequired: true;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawToolPayloadStored: false;
  readonly rawProviderBodyStored: false;
  readonly rawCustomerIdentifierStored: false;
  readonly rawTenantIdentifierStored: false;
  readonly grantsAuthority: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface RuntimeSignalReviewPacketDescriptor {
  readonly version: typeof RUNTIME_SIGNAL_REVIEW_PACKET_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly runtimeSignalConsequenceMappingVersion: typeof RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION;
  readonly runtimeSignalIntegrationReadinessBridgeVersion: typeof RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION;
  readonly runtimeSignalAuthorityGuardVersion: typeof RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION;
  readonly integrationModeReadinessVersion: typeof ATTESTOR_INTEGRATION_MODE_READINESS_VERSION;
  readonly requiredFields: typeof RUNTIME_SIGNAL_REVIEW_PACKET_REQUIRED_FIELDS;
  readonly producesHumanReviewPacket: true;
  readonly showsActionConsequenceMissingAndGate: true;
  readonly digestOnly: true;
  readonly reviewMaterialOnly: true;
  readonly approvalRequired: true;
  readonly grantsAuthority: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly nonClaims: typeof RUNTIME_SIGNAL_REVIEW_PACKET_NON_CLAIMS;
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
    throw new Error('Runtime signal review packet generatedAt must be an ISO timestamp.');
  }
  return timestamp.toISOString();
}

function normalizeReviewerScope(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return 'runtime-signal-review';
  if (!/^[a-z0-9][a-z0-9_.:-]{2,127}$/u.test(normalized)) {
    throw new Error('Runtime signal review packet reviewerScope must be a stable lowercase id.');
  }
  return normalized;
}

function assertLinkedInputs(input: {
  readonly envelope: RuntimeSignalEnvelope;
  readonly candidate: RuntimeSignalConsequenceCandidate;
  readonly readinessBridge: RuntimeSignalIntegrationReadinessBridge;
}): void {
  assertRuntimeSignalAuthorityBoundary({
    signalKind: input.envelope.signalKind,
    sourceTrustLevel: input.envelope.sourceTrustLevel,
    target: input.envelope,
    targetLabel: 'runtime-signal-envelope',
  });
  assertRuntimeSignalAuthorityBoundary({
    signalKind: input.envelope.signalKind,
    sourceTrustLevel: input.envelope.sourceTrustLevel,
    target: input.candidate,
    targetLabel: 'runtime-signal-consequence-candidate',
  });
  assertRuntimeSignalAuthorityBoundary({
    signalKind: input.envelope.signalKind,
    sourceTrustLevel: input.envelope.sourceTrustLevel,
    target: input.readinessBridge,
    targetLabel: 'runtime-signal-integration-readiness-bridge',
  });
  if (input.candidate.sourceSignalDigest !== input.envelope.signalDigest) {
    throw new Error('Runtime signal review packet requires candidate source digest to match envelope.');
  }
  if (input.readinessBridge.sourceSignalDigest !== input.envelope.signalDigest) {
    throw new Error('Runtime signal review packet requires bridge source digest to match envelope.');
  }
  if (input.readinessBridge.candidateDigest !== input.candidate.candidateDigest) {
    throw new Error('Runtime signal review packet requires bridge candidate digest to match candidate.');
  }
}

function firstMissingChecklistItem(input: {
  readonly candidate: RuntimeSignalConsequenceCandidate;
  readonly bridge: RuntimeSignalIntegrationReadinessBridge;
}): string {
  const consequenceMissing = input.candidate.missingControls[0];
  if (consequenceMissing) {
    return `Resolve consequence missing control: ${consequenceMissing}.`;
  }
  const readinessMissing = input.bridge.readiness.missingControls[0];
  if (readinessMissing) {
    return `Close integration readiness control: ${readinessMissing}.`;
  }
  const artifactMissing = input.bridge.readiness.missingRecommendedArtifacts[0];
  if (artifactMissing) {
    return `Review or create integration artifact: ${artifactMissing}.`;
  }
  return 'Review the scoped gate evidence before moving toward admission or enforcement work.';
}

function reviewChecklist(input: {
  readonly candidate: RuntimeSignalConsequenceCandidate;
  readonly bridge: RuntimeSignalIntegrationReadinessBridge;
}): readonly string[] {
  const items = [
    `Confirm the proposed action surface: ${input.candidate.actionSurface}.`,
    `Confirm the consequence class: ${input.candidate.consequenceClass}.`,
    firstMissingChecklistItem(input),
    `Confirm the customer gate placement: ${input.bridge.gatePlacement}.`,
    input.bridge.readiness.nextSafeStep,
  ];
  return Object.freeze([...new Set(items)]);
}

export function createRuntimeSignalReviewPacket(
  input: CreateRuntimeSignalReviewPacketInput,
): RuntimeSignalReviewPacket {
  if (input.envelope.signalKind === 'enforcement-proof') {
    throw new Error('Runtime signal review packet leaves enforcement-proof signals for RS10 proof intake.');
  }
  const candidate = input.candidate ?? mapRuntimeSignalToConsequenceCandidate(input.envelope);
  const readinessBridge = input.readinessBridge ??
    createRuntimeSignalIntegrationReadinessBridge({
      envelope: input.envelope,
      candidate,
      generatedAt: input.generatedAt ?? input.envelope.eventTime,
    });
  assertLinkedInputs({
    envelope: input.envelope,
    candidate,
    readinessBridge,
  });
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    readinessBridge.readiness.generatedAt,
  );
  const payload = {
    version: RUNTIME_SIGNAL_REVIEW_PACKET_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    runtimeSignalConsequenceMappingVersion: RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION,
    runtimeSignalIntegrationReadinessBridgeVersion: RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION,
    runtimeSignalAuthorityGuardVersion: RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
    integrationModeReadinessVersion: ATTESTOR_INTEGRATION_MODE_READINESS_VERSION,
    generatedAt,
    reviewerScope: normalizeReviewerScope(input.reviewerScope),
    sourceSignalDigest: input.envelope.signalDigest,
    candidateDigest: candidate.candidateDigest,
    readinessBridgeDigest: readinessBridge.digest,
    action: {
      signalKind: input.envelope.signalKind,
      sourceTrustLevel: input.envelope.sourceTrustLevel,
      sourceSystem: input.envelope.sourceSystem,
      actionSurface: candidate.actionSurface,
      downstreamSystem: candidate.downstreamSystem,
      operationRef: candidate.operationRef,
      sourceSignalDigest: input.envelope.signalDigest,
    },
    consequence: {
      consequenceClass: candidate.consequenceClass,
      candidateOrigin: candidate.candidateOrigin,
      riskSignals: candidate.riskSignals,
      recommendedNextStep: candidate.recommendedNextStep,
      candidateDigest: candidate.candidateDigest,
    },
    missing: {
      consequenceMissingControls: candidate.missingControls,
      readinessMissingControls: readinessBridge.readiness.missingControls,
      readinessNoGoReasons: readinessBridge.readiness.noGoReasons,
      missingRecommendedArtifacts: readinessBridge.readiness.missingRecommendedArtifacts,
    },
    gate: {
      placement: readinessBridge.gatePlacement,
      mode: readinessBridge.mode,
      readinessStatus: readinessBridge.readiness.status,
      credentialIsolation: readinessBridge.credentialIsolation,
      bypassRisk: readinessBridge.readiness.bypassRisk,
      nonBypassableClaimAllowed: readinessBridge.readiness.nonBypassableClaimAllowed,
      nextSafeStep: readinessBridge.readiness.nextSafeStep,
    },
    reviewChecklist: reviewChecklist({
      candidate,
      bridge: readinessBridge,
    }),
    requiredFields: RUNTIME_SIGNAL_REVIEW_PACKET_REQUIRED_FIELDS,
    nonClaims: RUNTIME_SIGNAL_REVIEW_PACKET_NON_CLAIMS,
    digestOnly: true,
    reviewMaterialOnly: true,
    approvalRequired: true,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawToolPayloadStored: false,
    rawProviderBodyStored: false,
    rawCustomerIdentifierStored: false,
    rawTenantIdentifierStored: false,
    grantsAuthority: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  } as const;
  assertRuntimeSignalAuthorityBoundary({
    signalKind: input.envelope.signalKind,
    sourceTrustLevel: input.envelope.sourceTrustLevel,
    target: payload,
    targetLabel: 'runtime-signal-review-packet',
  });
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function runtimeSignalReviewPacketDescriptor():
  RuntimeSignalReviewPacketDescriptor {
  return Object.freeze({
    version: RUNTIME_SIGNAL_REVIEW_PACKET_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    runtimeSignalConsequenceMappingVersion: RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION,
    runtimeSignalIntegrationReadinessBridgeVersion: RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION,
    runtimeSignalAuthorityGuardVersion: RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
    integrationModeReadinessVersion: ATTESTOR_INTEGRATION_MODE_READINESS_VERSION,
    requiredFields: RUNTIME_SIGNAL_REVIEW_PACKET_REQUIRED_FIELDS,
    producesHumanReviewPacket: true,
    showsActionConsequenceMissingAndGate: true,
    digestOnly: true,
    reviewMaterialOnly: true,
    approvalRequired: true,
    grantsAuthority: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
    nonClaims: RUNTIME_SIGNAL_REVIEW_PACKET_NON_CLAIMS,
  });
}
