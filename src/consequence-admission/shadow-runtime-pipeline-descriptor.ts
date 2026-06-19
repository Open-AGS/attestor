import {
  CONFLICT_ABSTENTION_GATE_VERSION,
} from './conflict-abstention-gate.js';
import {
  HUMAN_COMPREHENSION_GATE_VERSION,
} from './human-comprehension-gate.js';
import {
  RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
} from './relationship-aware-monotone-fusion.js';
import {
  RELATIONSHIP_DETECTOR_CONTRACT_VERSION,
} from './relationship-detector-contract.js';
import {
  SHADOW_ENVELOPE_PROJECTOR_VERSION,
} from './shadow-envelope-projector.js';
import {
  SIGNAL_ADAPTER_REGISTRY_VERSION,
} from './signal-adapter-registry.js';
import {
  SIGNAL_EXTRACTOR_CONTRACT_VERSION,
} from './signal-extractor-contract.js';
import {
  SIGNED_ASSURANCE_PACKET_VERSION,
} from './signed-assurance-packet.js';
import {
  SHADOW_RUNTIME_PIPELINE_VERSION,
  type ShadowRuntimePipelineDescriptor,
} from './shadow-runtime-pipeline-types.js';

export function shadowRuntimePipelineDescriptor():
  ShadowRuntimePipelineDescriptor {
  return Object.freeze({
    version: SHADOW_RUNTIME_PIPELINE_VERSION,
    connects: Object.freeze([
      SHADOW_ENVELOPE_PROJECTOR_VERSION,
      SIGNAL_EXTRACTOR_CONTRACT_VERSION,
      SIGNAL_ADAPTER_REGISTRY_VERSION,
      RELATIONSHIP_DETECTOR_CONTRACT_VERSION,
      RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
      CONFLICT_ABSTENTION_GATE_VERSION,
      HUMAN_COMPREHENSION_GATE_VERSION,
      SIGNED_ASSURANCE_PACKET_VERSION,
    ]),
    executionMode: 'shadow-only',
    pureFunction: true,
    deterministicProjection: true,
    builtInAdapterRegistryUsed: true,
    relationshipEvaluationBeforeFusion: true,
    unsignedPacketOnly: true,
    noLiveEnforcement: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    learnsFromTraffic: false,
    crossTenantAggregation: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-live-enforcement',
      'not-policy-activation',
      'not-downstream-execution',
      'not-learning',
      'not-cross-tenant-aggregation',
      'not-production-ready',
    ]),
  });
}
