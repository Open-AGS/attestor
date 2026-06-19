import type { CanonicalShadowEvent } from './canonical-shadow-event-schema.js';
import type { ConflictAbstentionGateResult, CONFLICT_ABSTENTION_GATE_VERSION } from './conflict-abstention-gate.js';
import type { ContextModulator, MODULATOR_AUTHORITY_TIER_VERSION } from './modulator-authority-tier.js';
import type { CreateShadowEnvelopeProjectionOptions, ShadowEnvelopeProjection, SHADOW_ENVELOPE_PROJECTOR_VERSION } from './shadow-envelope-projector.js';
import type { HumanComprehensionGateResult, HUMAN_COMPREHENSION_GATE_VERSION } from './human-comprehension-gate.js';
import type { LayerOpinion, LAYER_OPINION_SCHEMA_VERSION } from './layer-opinion-schema.js';
import type { RelationshipAwareMonotoneFusionResult, RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION } from './relationship-aware-monotone-fusion.js';
import type { RelationshipDetectionBatch, RELATIONSHIP_DETECTOR_CONTRACT_VERSION } from './relationship-detector-contract.js';
import type { SignalAdapterRegistry, SIGNAL_ADAPTER_REGISTRY_VERSION } from './signal-adapter-registry.js';
import type { SignalExtractionBatch, SIGNAL_EXTRACTOR_CONTRACT_VERSION } from './signal-extractor-contract.js';
import type { SignalRelationshipSignal, SIGNAL_RELATIONSHIP_CONTRACT_VERSION } from './signal-relationship-contract.js';
import type { SignedAssurancePacket, SIGNED_ASSURANCE_PACKET_VERSION } from './signed-assurance-packet.js';

export const SHADOW_RUNTIME_PIPELINE_VERSION =
  'attestor.shadow-runtime-pipeline.v1';

export interface ShadowRuntimePipelineInput {
  readonly event: CanonicalShadowEvent;
  readonly projectionOptions?: CreateShadowEnvelopeProjectionOptions | null;
  readonly generatedAt?: string | null;
  readonly reviewerCapacityPerHour?: number | null;
  readonly currentReviewRatePerMinute?: number | null;
}

export interface ShadowRuntimePipelineCounts {
  readonly signalBatchCount: number;
  readonly signalCount: number;
  readonly relationshipCount: number;
  readonly interactionRuleCount: number;
  readonly opinionCount: number;
  readonly modulatorCount: number;
  readonly reasonLineCount: number;
  readonly activeQuestionCount: number;
}

export interface ShadowRuntimePipelineResult {
  readonly version: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly shadowEnvelopeProjectorVersion:
    typeof SHADOW_ENVELOPE_PROJECTOR_VERSION;
  readonly signalExtractorContractVersion:
    typeof SIGNAL_EXTRACTOR_CONTRACT_VERSION;
  readonly signalAdapterRegistryVersion:
    typeof SIGNAL_ADAPTER_REGISTRY_VERSION;
  readonly relationshipDetectorContractVersion:
    typeof RELATIONSHIP_DETECTOR_CONTRACT_VERSION;
  readonly signalRelationshipContractVersion:
    typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly layerOpinionSchemaVersion: typeof LAYER_OPINION_SCHEMA_VERSION;
  readonly modulatorAuthorityTierVersion:
    typeof MODULATOR_AUTHORITY_TIER_VERSION;
  readonly relationshipAwareMonotoneFusionVersion:
    typeof RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION;
  readonly conflictAbstentionGateVersion:
    typeof CONFLICT_ABSTENTION_GATE_VERSION;
  readonly humanComprehensionGateVersion:
    typeof HUMAN_COMPREHENSION_GATE_VERSION;
  readonly signedAssurancePacketVersion:
    typeof SIGNED_ASSURANCE_PACKET_VERSION;
  readonly executionMode: 'shadow-only';
  readonly packetSigningIncluded: false;
  readonly projection: ShadowEnvelopeProjection;
  readonly adapterRegistry: SignalAdapterRegistry;
  readonly signalBatches: readonly SignalExtractionBatch[];
  readonly signals: readonly SignalRelationshipSignal[];
  readonly relationshipDetection: RelationshipDetectionBatch;
  readonly opinions: readonly LayerOpinion[];
  readonly modulators: readonly ContextModulator[];
  readonly fusion: RelationshipAwareMonotoneFusionResult;
  readonly conflictGate: ConflictAbstentionGateResult;
  readonly humanComprehensionGate: HumanComprehensionGateResult;
  readonly assurancePacket: SignedAssurancePacket;
  readonly counts: ShadowRuntimePipelineCounts;
  readonly noLiveEnforcement: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly learnsFromTraffic: false;
  readonly crossTenantAggregation: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowRuntimePipelineDescriptor {
  readonly version: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly connects: readonly string[];
  readonly executionMode: 'shadow-only';
  readonly pureFunction: true;
  readonly deterministicProjection: true;
  readonly builtInAdapterRegistryUsed: true;
  readonly relationshipEvaluationBeforeFusion: true;
  readonly unsignedPacketOnly: true;
  readonly noLiveEnforcement: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly learnsFromTraffic: false;
  readonly crossTenantAggregation: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}
