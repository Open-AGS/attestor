import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
} from './tamper-evident-history.js';
import {
  CONFLICT_ABSTENTION_GATE_VERSION,
  type ConflictAbstentionGateResult,
  evaluateConflictAbstentionGate,
} from './conflict-abstention-gate.js';
import type {
  ConsequenceEnvelopeDigestRef,
} from './consequence-envelope-contract.js';
import {
  HUMAN_COMPREHENSION_GATE_VERSION,
  type HumanComprehensionActiveQuestionRef,
  type HumanComprehensionReasonLineInput,
  evaluateHumanComprehensionGate,
} from './human-comprehension-gate.js';
import {
  LAYER_OPINION_SCHEMA_VERSION,
  type LayerOpinion,
  type LayerOpinionAbstentionReason,
  type LayerOpinionEvidenceQualityBand,
  type LayerOpinionLayerId,
  type LayerOpinionPosition,
  type LayerOpinionSourcePlane,
} from './layer-opinion-schema.js';
import {
  MODULATOR_AUTHORITY_TIER_VERSION,
  type ContextModulator,
  type ModulatorEffect,
  type ModulatorStrengthBand,
} from './modulator-authority-tier.js';
import {
  RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
  type RelationshipAwareMonotoneFusionResult,
  fuseRelationshipAwareMonotoneHazard,
} from './relationship-aware-monotone-fusion.js';
import {
  RELATIONSHIP_DETECTOR_CONTRACT_VERSION,
  type RelationshipDetectionBatch,
  detectSignalRelationships,
} from './relationship-detector-contract.js';
import {
  SHADOW_ENVELOPE_PROJECTOR_VERSION,
  type ShadowEnvelopeProjection,
  createShadowEnvelopeProjection,
} from './shadow-envelope-projector.js';
import {
  SIGNAL_ADAPTER_REGISTRY_VERSION,
  createBuiltinSignalAdapterRegistry,
  type SignalAdapterRegistration,
  type SignalAdapterRegistry,
} from './signal-adapter-registry.js';
import {
  SIGNAL_EXTRACTOR_CONTRACT_VERSION,
  type SignalExtractionBatch,
  createSignalExtractionBatch,
} from './signal-extractor-contract.js';
import {
  SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  type SignalEvidenceRef,
  type SignalKind,
  type SignalReadModelRef,
  type SignalRelationshipSignal,
} from './signal-relationship-contract.js';
import {
  SIGNED_ASSURANCE_PACKET_VERSION,
  type SignedAssurancePacketDecision,
  createSignedAssurancePacket,
} from './signed-assurance-packet.js';
import { shadowRuntimePipelineDescriptor } from './shadow-runtime-pipeline-descriptor.js';
import {
  normalizeGeneratedAt,
  normalizeReviewCapacity,
  normalizeReviewRate,
} from './shadow-runtime-pipeline-normalize.js';
import {
  SHADOW_RUNTIME_PIPELINE_VERSION,
  type ShadowRuntimePipelineInput,
  type ShadowRuntimePipelineResult,
} from './shadow-runtime-pipeline-types.js';

export * from './shadow-runtime-pipeline-types.js';
export { shadowRuntimePipelineDescriptor };

const SIGNAL_CONFIDENCE = 0.64;
const SIGNAL_UNCERTAINTY = 0.36;

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

function digestValue(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function firstRef<Kind extends ConsequenceEnvelopeDigestRef['kind']>(
  refs: readonly ConsequenceEnvelopeDigestRef<Kind>[],
): ConsequenceEnvelopeDigestRef<Kind> | null {
  return refs[0] ?? null;
}

function fallbackEvidenceRef(
  projection: ShadowEnvelopeProjection,
  kind: SignalEvidenceRef['kind'],
  sourceCheckKind: string,
): SignalEvidenceRef {
  const digest = digestValue('shadow-runtime-pipeline.evidence-ref', {
    envelopeRefDigest: projection.envelopeRefDigest,
    sourceCheckKind,
    kind,
  });
  return Object.freeze({ kind, digest });
}

function evidenceRefForRegistration(
  projection: ShadowEnvelopeProjection,
  registration: SignalAdapterRegistration,
): SignalEvidenceRef {
  if (registration.evidenceRefKind === 'evidence') {
    return firstRef(projection.envelope.evidenceRefs) ??
      fallbackEvidenceRef(projection, 'evidence', registration.sourceCheckKind);
  }
  if (registration.evidenceRefKind === 'authority') {
    return firstRef(projection.envelope.authorityRefs) ??
      fallbackEvidenceRef(projection, 'authority', registration.sourceCheckKind);
  }
  if (registration.evidenceRefKind === 'shadow-event') {
    return projection.envelope.sourceEventRef;
  }
  return fallbackEvidenceRef(
    projection,
    registration.evidenceRefKind,
    registration.sourceCheckKind,
  );
}

function readModelRefForRegistration(
  projection: ShadowEnvelopeProjection,
  registration: SignalAdapterRegistration,
): SignalReadModelRef {
  const policyDigest = projection.envelope.policyScope.policyBundleRefDigest ??
    projection.envelope.policyScope.policyScopeRefDigest;
  const digest = policyDigest ??
    digestValue('shadow-runtime-pipeline.read-model-ref', {
      envelopeRefDigest: projection.envelopeRefDigest,
      sourceCheckKind: registration.sourceCheckKind,
      modelKind: registration.readModelKind,
    });
  return Object.freeze({
    modelKind: registration.readModelKind,
    digest,
  });
}

function signalIdFor(registration: SignalAdapterRegistration): string {
  return `signal.${registration.sourceCheckKind}.${registration.signalKind}`;
}

function createSignalForRegistration(
  projection: ShadowEnvelopeProjection,
  registration: SignalAdapterRegistration,
): SignalRelationshipSignal {
  return Object.freeze({
    signalId: signalIdFor(registration),
    category: registration.signalCategory,
    kind: registration.signalKind,
    sourcePlane: registration.extractor.sourcePlane,
    authorityMode: registration.extractor.authorityMode,
    envelopeRefDigest: projection.envelopeRefDigest,
    evidenceRefs: Object.freeze([
      evidenceRefForRegistration(projection, registration),
    ]),
    readModelRefs: Object.freeze([
      readModelRefForRegistration(projection, registration),
    ]),
    appliesToConsequenceClasses: Object.freeze([
      projection.envelope.consequenceClass,
    ]),
    knows: Object.freeze([
      `${registration.sourceCheckKind} check is represented as a typed shadow signal.`,
    ]),
    cannotKnow: Object.freeze([
      'the live downstream effect because this pipeline is shadow-only',
      'whether evidence exists outside the digest-bound envelope',
    ]),
    confidence: SIGNAL_CONFIDENCE,
    uncertainty: SIGNAL_UNCERTAINTY,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  } satisfies SignalRelationshipSignal);
}

function createSignalBatches(
  projection: ShadowEnvelopeProjection,
  registry: SignalAdapterRegistry,
): readonly SignalExtractionBatch[] {
  return Object.freeze(registry.registrations.map((registration) =>
    createSignalExtractionBatch({
      projection,
      extractor: registration.extractor,
      signals: [createSignalForRegistration(projection, registration)],
    })
  ));
}

function layerForSignal(signal: SignalRelationshipSignal): {
  readonly layerId: LayerOpinionLayerId;
  readonly sourcePlane: LayerOpinionSourcePlane;
} {
  if (signal.sourcePlane === 'temporal-trajectory') {
    return {
      layerId: 'layer-4-temporal-trajectory',
      sourcePlane: 'temporal-trajectory',
    };
  }
  if (signal.sourcePlane === 'assurance-measurement') {
    return {
      layerId: 'layer-2-shadow-baseline',
      sourcePlane: 'shadow-baseline',
    };
  }
  return {
    layerId: 'layer-2-shadow-baseline',
    sourcePlane: 'shadow-baseline',
  };
}

function positionForSignal(signal: SignalRelationshipSignal): LayerOpinionPosition {
  if (signal.category === 'gap') return 'gap-indicated';
  if (signal.category === 'measurement') return 'uncertainty-indicated';
  if (signal.category === 'verdict') return 'hazard-indicated';
  if (signal.kind === 'contradiction') return 'conflict-indicated';
  if (signal.kind === 'abstention') return 'abstained';
  return 'uncertainty-indicated';
}

function evidenceQualityForSignal(
  signal: SignalRelationshipSignal,
): LayerOpinionEvidenceQualityBand {
  if (signal.category === 'gap') return 'weak';
  if (signal.category === 'measurement') return 'weak';
  return 'moderate';
}

function abstentionReasonsForSignal(
  signal: SignalRelationshipSignal,
): readonly LayerOpinionAbstentionReason[] {
  if (signal.category === 'gap') return Object.freeze(['missing-evidence']);
  if (signal.category === 'measurement') {
    return Object.freeze(['measurement-degraded']);
  }
  return Object.freeze([]);
}

function hazardForSignal(signal: SignalRelationshipSignal): number {
  if (signal.category === 'verdict') return 0.58;
  if (signal.category === 'gap') return 0.44;
  if (signal.category === 'measurement') return 0.36;
  return 0.28;
}

function createOpinions(
  signals: readonly SignalRelationshipSignal[],
  relationships: readonly { readonly relationshipId: string }[],
): readonly LayerOpinion[] {
  const relationshipIds = relationships.map((relationship) =>
    relationship.relationshipId
  );
  return Object.freeze(signals.map((signal) => {
    const layer = layerForSignal(signal);
    const hazard = hazardForSignal(signal);
    const uncertainty = signal.uncertainty ?? SIGNAL_UNCERTAINTY;
    const abstentionReasons = abstentionReasonsForSignal(signal);
    return Object.freeze({
      version: LAYER_OPINION_SCHEMA_VERSION,
      opinionId: signal.signalId,
      layerId: layer.layerId,
      sourcePlane: layer.sourcePlane,
      envelopeRefDigest: signal.envelopeRefDigest,
      projectedSignal: Object.freeze({
        category: signal.category,
        kind: signal.kind as SignalKind,
        authorityMode: signal.authorityMode === 'measurement-only'
          ? 'measurement-only'
          : 'advisory',
      }),
      position: positionForSignal(signal),
      hazardScore: hazard,
      uncertainty,
      calibratedConfidence: signal.confidence,
      evidenceQuality: evidenceQualityForSignal(signal),
      novelty: 'unknown',
      contextFit: 'medium',
      calibrationState: 'uncalibrated',
      calibrationRefDigest: null,
      beliefMass: Object.freeze({
        hazard,
        noAdvisoryObjection: 0,
        uncertainty: Math.max(0, 1 - hazard),
        baseRate: 0,
      }),
      abstention: Object.freeze({
        abstained: abstentionReasons.length > 0,
        reasons: abstentionReasons,
        neededEvidenceRefs: Object.freeze(signal.evidenceRefs
          .filter((ref) => ref.kind === 'evidence')
          .map((ref) => Object.freeze({
            kind: 'evidence' as const,
            digest: ref.digest,
          }))),
      }),
      sourceDependence: Object.freeze({
        dependsOnEnvelope: true,
        evidenceRefDigests: uniqueStrings(
          signal.evidenceRefs.map((ref) => ref.digest),
        ),
        readModelDigests: uniqueStrings(
          signal.readModelRefs.map((ref) => ref.digest),
        ),
        relationshipIds,
        rawTrainingDataAccess: false,
        crossTenantRawDataAccess: false,
      }),
      evidenceRefs: signal.evidenceRefs,
      readModelRefs: signal.readModelRefs,
      appliesToConsequenceClasses: signal.appliesToConsequenceClasses,
      reasonCodes: Object.freeze([
        `shadow-runtime-${signal.category}`,
        `shadow-runtime-${signal.kind}`,
      ]),
      noLoosening: true,
      mayGrantAuthority: false,
      mayActivateEnforcement: false,
      mayLowerRequiredReview: false,
      mayMarkSafe: false,
      mayStoreRawMaterial: false,
      mayTrainModel: false,
      productionReady: false,
      rawPayloadStored: false,
      rawPromptStored: false,
      rawProviderBodyStored: false,
    } satisfies LayerOpinion);
  }));
}

function modulatorStrength(
  effect: ModulatorEffect,
): ModulatorStrengthBand {
  if (effect === 'increase-block-pressure') return 'high';
  if (
    effect === 'increase-review-pressure' ||
    effect === 'mark-coverage-insufficient'
  ) {
    return 'medium';
  }
  return 'low';
}

function createContextModulator(input: {
  readonly projection: ShadowEnvelopeProjection;
  readonly modulatorId: string;
  readonly dimension: ContextModulator['dimension'];
  readonly effect: ModulatorEffect;
  readonly reasonCodes: readonly string[];
}): ContextModulator {
  const evidenceRef = fallbackEvidenceRef(
    input.projection,
    'schema',
    input.dimension,
  );
  const readModelRef = Object.freeze({
    modelKind: 'policy' as const,
    digest: digestValue('shadow-runtime-pipeline.modulator-read-model', {
      envelopeRefDigest: input.projection.envelopeRefDigest,
      dimension: input.dimension,
    }),
  });
  return Object.freeze({
    modulatorId: input.modulatorId,
    dimension: input.dimension,
    authorityClass: input.effect === 'mark-context-degraded'
      ? 'measurement-degraded-only'
      : 'review-pressure-only',
    effect: input.effect,
    strength: modulatorStrength(input.effect),
    inputSource: 'consequence-envelope',
    envelopeRefDigest: input.projection.envelopeRefDigest,
    context: Object.freeze({
      reversibilityClass: input.projection.envelope.reversibilityClass,
      blastRadiusEstimate: input.projection.envelope.blastRadiusEstimate,
      tenantMaturityClass: input.projection.envelope.tenantContext.maturityClass,
      coveragePosture: input.projection.envelope.tenantContext.coverageRefDigest
        ? 'medium'
        : 'unknown',
      freshnessPosture: input.projection.envelope.timingContext.freshnessPosture,
      contextFit: 'medium',
    }),
    evidenceRefs: Object.freeze([evidenceRef]),
    readModelRefs: Object.freeze([readModelRef]),
    reasonCodes: input.reasonCodes,
    noLoosening: true,
    preservesHardFloor: true,
    mayGrantAuthority: false,
    mayActivateEnforcement: false,
    autoEnforce: false,
    mayLowerRequiredReview: false,
    maySuppressHardDeny: false,
    mayMarkSafe: false,
    mayStoreRawMaterial: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  });
}

function createModulators(
  projection: ShadowEnvelopeProjection,
): readonly ContextModulator[] {
  const modulators: ContextModulator[] = [
    createContextModulator({
      projection,
      modulatorId: 'modulator.reversibility.shadow-runtime',
      dimension: 'reversibility',
      effect: projection.envelope.reversibilityClass === 'irreversible'
        ? 'increase-block-pressure'
        : 'increase-review-pressure',
      reasonCodes: ['consequence-reversibility-modulates-review'],
    }),
    createContextModulator({
      projection,
      modulatorId: 'modulator.blast-radius.shadow-runtime',
      dimension: 'blast-radius',
      effect: projection.envelope.blastRadiusEstimate === 'systemic' ||
        projection.envelope.blastRadiusEstimate === 'cross-tenant'
        ? 'increase-block-pressure'
        : 'increase-review-pressure',
      reasonCodes: ['blast-radius-modulates-review'],
    }),
    createContextModulator({
      projection,
      modulatorId: 'modulator.coverage.shadow-runtime',
      dimension: 'coverage',
      effect: projection.envelope.tenantContext.coverageRefDigest
        ? 'raise-evidence-requirement'
        : 'mark-coverage-insufficient',
      reasonCodes: ['coverage-posture-modulates-review'],
    }),
  ];

  if (projection.envelope.timingContext.freshnessPosture !== 'fresh') {
    modulators.push(createContextModulator({
      projection,
      modulatorId: 'modulator.freshness.shadow-runtime',
      dimension: 'freshness',
      effect: 'mark-freshness-risk',
      reasonCodes: ['freshness-posture-modulates-review'],
    }));
  }

  return Object.freeze(modulators);
}

function severityForConflictOutcome(
  outcome: ConflictAbstentionGateResult['outcome'],
): HumanComprehensionReasonLineInput['severity'] {
  if (outcome === 'block-pressure' || outcome === 'abstain-hold') {
    return 'escalate';
  }
  if (outcome === 'review') return 'review';
  return 'watch';
}

function reasonLinesFor(input: {
  readonly projection: ShadowEnvelopeProjection;
  readonly relationshipDetection: RelationshipDetectionBatch;
  readonly fusion: RelationshipAwareMonotoneFusionResult;
  readonly conflictGate: ConflictAbstentionGateResult;
}): readonly HumanComprehensionReasonLineInput[] {
  return Object.freeze([
    {
      lineId: 'pipeline-shadow-only',
      severity: 'info',
      text: 'Pipeline ran in shadow-only mode and cannot authorize execution.',
      sourceDigest: input.projection.digest,
      reasonCodes: ['shadow-only', 'no-admit-authority'],
      actionHint: null,
    },
    {
      lineId: 'relationship-count',
      severity: input.relationshipDetection.relationshipCount > 0
        ? 'review'
        : 'watch',
      text: `${input.relationshipDetection.relationshipCount} signal relationships were evaluated before fusion.`,
      sourceDigest: input.relationshipDetection.digest,
      reasonCodes: ['relationship-evaluation-before-fusion'],
      actionHint: 'Review duplicate, conflict, and review-forcing relationships.',
    },
    {
      lineId: 'fusion-posture',
      severity: input.fusion.posture === 'block-pressure'
        ? 'escalate'
        : input.fusion.posture === 'review'
          ? 'review'
          : 'watch',
      text: `Fusion posture is ${input.fusion.posture} with monotone no-loosening preserved.`,
      sourceDigest: input.fusion.contributions[0]?.sourceId
        ? input.fusion.envelopeRefDigest
        : input.projection.envelopeRefDigest,
      reasonCodes: input.fusion.reasonCodes,
      actionHint: 'Use fusion as review pressure only; do not treat it as admit authority.',
    },
    {
      lineId: 'conflict-gate-outcome',
      severity: severityForConflictOutcome(input.conflictGate.outcome),
      text: `Conflict gate outcome is ${input.conflictGate.outcome}; uncertainty cannot admit.`,
      sourceDigest: input.projection.envelopeRefDigest,
      reasonCodes: input.conflictGate.reasonCodes,
      actionHint: 'Keep shadow result advisory until a reviewer promotes a later control.',
    },
  ]);
}

function activeQuestionsFor(input: {
  readonly projection: ShadowEnvelopeProjection;
  readonly conflictGate: ConflictAbstentionGateResult;
  readonly relationshipDetection: RelationshipDetectionBatch;
}): readonly HumanComprehensionActiveQuestionRef[] {
  if (input.conflictGate.outcome === 'continue') {
    return Object.freeze([]);
  }
  return Object.freeze([
    {
      questionId: 'q-shadow-runtime-review',
      questionDigest: digestValue('shadow-runtime-pipeline.question', {
        envelopeRefDigest: input.projection.envelopeRefDigest,
        conflictOutcome: input.conflictGate.outcome,
        relationshipDigest: input.relationshipDetection.digest,
      }),
      prompt: 'Should this shadow-only result become a review candidate?',
      expectedAnswerKind: 'choice',
      impactBand: input.conflictGate.outcome === 'block-pressure'
        ? 'critical'
        : 'high',
      priorityScore: input.conflictGate.outcome === 'block-pressure'
        ? 100
        : 80,
      resolvesReasonCodes: input.conflictGate.reasonCodes,
    },
  ]);
}

function decisionForGate(
  conflictGate: ConflictAbstentionGateResult,
): SignedAssurancePacketDecision {
  return conflictGate.outcome === 'block-pressure' ? 'block' : 'review';
}

function collectPolicyRefDigests(projection: ShadowEnvelopeProjection): readonly string[] {
  return uniqueStrings([
    projection.envelope.policyScope.policyBundleRefDigest,
    projection.envelope.policyScope.policyScopeRefDigest,
    projection.envelope.policyScope.rolloutRefDigest,
    projection.envelope.policyScope.candidateRefDigest,
    digestValue('shadow-runtime-pipeline.policy-fallback', {
      envelopeRefDigest: projection.envelopeRefDigest,
    }),
  ].filter((digest): digest is string => typeof digest === 'string'));
}

function collectEvidenceRefDigests(
  projection: ShadowEnvelopeProjection,
  signals: readonly SignalRelationshipSignal[],
  modulators: readonly ContextModulator[],
): readonly string[] {
  return uniqueStrings([
    projection.envelope.sourceEventRef.digest,
    projection.envelope.targetSystemRef.digest,
    ...projection.envelope.evidenceRefs.map((ref) => ref.digest),
    ...projection.envelope.authorityRefs.map((ref) => ref.digest),
    ...signals.flatMap((signal) => signal.evidenceRefs.map((ref) => ref.digest)),
    ...modulators.flatMap((modulator) =>
      modulator.evidenceRefs.map((ref) => ref.digest)
    ),
  ]);
}

function collectSignalRefDigests(
  signals: readonly SignalRelationshipSignal[],
): readonly string[] {
  return uniqueStrings(signals.map((signal) =>
    digestValue('shadow-runtime-pipeline.signal-ref', signal as unknown as
      CanonicalReleaseJsonValue)
  ));
}

function collectRelationshipRefDigests(
  relationshipDetection: RelationshipDetectionBatch,
): readonly string[] {
  const digests = relationshipDetection.relationships.map((relationship) =>
    digestValue('shadow-runtime-pipeline.relationship-ref', relationship as
      unknown as CanonicalReleaseJsonValue)
  );
  return uniqueStrings(digests.length === 0
    ? [relationshipDetection.digest]
    : digests);
}

function replayRefDigests(projection: ShadowEnvelopeProjection): readonly string[] {
  return uniqueStrings([
    ...projection.envelope.priorChain.map((link) => link.eventRefDigest),
    projection.idempotencyKeyDigest,
  ]);
}

function createHistoryBinding(projection: ShadowEnvelopeProjection) {
  return Object.freeze({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    rootDigest: digestValue('shadow-runtime-pipeline.history-root', {
      envelopeRefDigest: projection.envelopeRefDigest,
    }),
    lastEntryDigest: digestValue('shadow-runtime-pipeline.history-last-entry', {
      sourceEventDigest: projection.sourceEventDigest,
    }),
    verificationDigest: digestValue('shadow-runtime-pipeline.history-verification', {
      projectionDigest: projection.digest,
    }),
    entryCount: 0,
    verified: false,
  });
}

export function runShadowRuntimePipelineDryRun(
  input: ShadowRuntimePipelineInput,
): ShadowRuntimePipelineResult {
  const generatedAt = normalizeGeneratedAt(
    input.generatedAt,
    input.event.occurredAt,
  );
  const projection = createShadowEnvelopeProjection(
    input.event,
    input.projectionOptions ?? {},
  );
  const adapterRegistry = createBuiltinSignalAdapterRegistry();
  const signalBatches = createSignalBatches(projection, adapterRegistry);
  const signals = Object.freeze(signalBatches.flatMap((batch) => batch.signals));
  const relationshipDetection = detectSignalRelationships({
    envelopeRefDigest: projection.envelopeRefDigest,
    signals,
    executionMode: 'shadow-only',
  });
  const opinions = createOpinions(signals, relationshipDetection.relationships);
  const modulators = createModulators(projection);
  const fusion = fuseRelationshipAwareMonotoneHazard({
    envelopeRefDigest: projection.envelopeRefDigest,
    opinions,
    relationships: relationshipDetection.relationships,
    modulators,
  });
  const conflictGate = evaluateConflictAbstentionGate({
    envelopeRefDigest: projection.envelopeRefDigest,
    fusion,
    opinions,
    relationships: relationshipDetection.relationships,
    modulators,
  });
  const activeQuestions = activeQuestionsFor({
    projection,
    conflictGate,
    relationshipDetection,
  });
  const humanComprehensionGate = evaluateHumanComprehensionGate({
    envelopeRefDigest: projection.envelopeRefDigest,
    conflictGate,
    reasonLineCandidates: reasonLinesFor({
      projection,
      relationshipDetection,
      fusion,
      conflictGate,
    }),
    activeQuestions,
    reviewLoad: {
      pendingReviewItemCount: activeQuestions.length,
      humanActionItemCount: activeQuestions.length,
      reviewerCapacityPerHour: normalizeReviewCapacity(
        input.reviewerCapacityPerHour,
      ),
      currentReviewRatePerMinute: normalizeReviewRate(
        input.currentReviewRatePerMinute,
      ),
    },
  });
  const assurancePacket = createSignedAssurancePacket({
    envelopeRefDigest: projection.envelopeRefDigest,
    decisionBinding: {
      decision: decisionForGate(conflictGate),
      decisionSourceDigest: digestValue('shadow-runtime-pipeline.decision', {
        conflictOutcome: conflictGate.outcome,
        fusionPosture: fusion.posture,
        envelopeRefDigest: projection.envelopeRefDigest,
      }),
      reasonCodes: uniqueStrings([
        'shadow-runtime-dry-run-no-authority',
        ...conflictGate.reasonCodes,
      ]),
    },
    historyBinding: createHistoryBinding(projection),
    humanComprehensionGate,
    policyRefDigests: collectPolicyRefDigests(projection),
    evidenceRefDigests: collectEvidenceRefDigests(
      projection,
      signals,
      modulators,
    ),
    signalRefDigests: collectSignalRefDigests(signals),
    relationshipRefDigests: collectRelationshipRefDigests(relationshipDetection),
    replayRefDigests: replayRefDigests(projection),
    generatedAt,
  });
  const counts = Object.freeze({
    signalBatchCount: signalBatches.length,
    signalCount: signals.length,
    relationshipCount: relationshipDetection.relationshipCount,
    interactionRuleCount: relationshipDetection.interactionRuleCount,
    opinionCount: opinions.length,
    modulatorCount: modulators.length,
    reasonLineCount: humanComprehensionGate.reasonLineCount,
    activeQuestionCount: humanComprehensionGate.activeQuestionCount,
  });
  const payload = {
    version: SHADOW_RUNTIME_PIPELINE_VERSION,
    shadowEnvelopeProjectorVersion: SHADOW_ENVELOPE_PROJECTOR_VERSION,
    signalExtractorContractVersion: SIGNAL_EXTRACTOR_CONTRACT_VERSION,
    signalAdapterRegistryVersion: SIGNAL_ADAPTER_REGISTRY_VERSION,
    relationshipDetectorContractVersion: RELATIONSHIP_DETECTOR_CONTRACT_VERSION,
    signalRelationshipContractVersion: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    layerOpinionSchemaVersion: LAYER_OPINION_SCHEMA_VERSION,
    modulatorAuthorityTierVersion: MODULATOR_AUTHORITY_TIER_VERSION,
    relationshipAwareMonotoneFusionVersion:
      RELATIONSHIP_AWARE_MONOTONE_FUSION_VERSION,
    conflictAbstentionGateVersion: CONFLICT_ABSTENTION_GATE_VERSION,
    humanComprehensionGateVersion: HUMAN_COMPREHENSION_GATE_VERSION,
    signedAssurancePacketVersion: SIGNED_ASSURANCE_PACKET_VERSION,
    executionMode: 'shadow-only',
    packetSigningIncluded: false,
    projection,
    adapterRegistry,
    signalBatches,
    signals,
    relationshipDetection,
    opinions,
    modulators,
    fusion,
    conflictGate,
    humanComprehensionGate,
    assurancePacket,
    counts,
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
    nonClaims: shadowRuntimePipelineDescriptor().nonClaims,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
