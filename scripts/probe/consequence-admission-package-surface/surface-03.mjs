export async function runConsequenceAdmissionPackageSurface03({ assert, root, admission }) {
  assert.equal(
    admission.signedAssurancePacketDescriptor().signatureRequired,
    true,
  );

  assert.equal(
    admission.signedAssurancePacketDescriptor().canAdmit,
    false,
  );

  assert.equal(
    typeof admission.createSignedAssurancePacketSigningPayload,
    'function',
  );

  assert.equal(
    typeof admission.createSignedAssurancePacket,
    'function',
  );

  assert.equal(
    admission.OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
    'attestor.outcome-incident-feedback-contract.v1',
  );

  assert.equal(
    admission.outcomeIncidentFeedbackContractDescriptor().separatesSourceClasses,
    true,
  );

  assert.equal(
    admission.outcomeIncidentFeedbackContractDescriptor().incidentPathFirstClass,
    true,
  );

  assert.equal(
    admission.outcomeIncidentFeedbackContractDescriptor().replayRegressionTriggering,
    true,
  );

  assert.equal(
    admission.outcomeIncidentFeedbackContractDescriptor().automaticPolicyMutationAllowed,
    false,
  );

  assert.equal(
    admission.outcomeIncidentFeedbackContractDescriptor().canAdmit,
    false,
  );

  assert.equal(
    typeof admission.createOutcomeIncidentFeedbackContract,
    'function',
  );

  assert.equal(
    admission.ASSURANCE_MEASUREMENT_PLANE_VERSION,
    'attestor.assurance-measurement-plane.v1',
  );

  assert.equal(
    admission.assuranceMeasurementPlaneDescriptor().readOnly,
    true,
  );

  assert.equal(
    admission.assuranceMeasurementPlaneDescriptor().writesAuditPlane,
    false,
  );

  assert.equal(
    admission.assuranceMeasurementPlaneDescriptor().goodhartProtected,
    true,
  );

  assert.equal(
    admission.assuranceMeasurementPlaneDescriptor().driftDetectionSupported,
    true,
  );

  assert.equal(
    admission.assuranceMeasurementPlaneDescriptor().scopedBudgetAccountingSupported,
    true,
  );

  assert.equal(
    admission.assuranceMeasurementPlaneDescriptor().canAdmit,
    false,
  );

  assert.equal(
    typeof admission.createAssuranceMeasurementPlane,
    'function',
  );

  assert.equal(
    admission.SHADOW_ENVELOPE_PROJECTOR_VERSION,
    'attestor.shadow-envelope-projector.v1',
  );

  assert.equal(
    admission.shadowEnvelopeProjectorDescriptor().accepts,
    admission.CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  );

  assert.equal(
    admission.shadowEnvelopeProjectorDescriptor().produces,
    admission.CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
  );

  assert.equal(
    admission.shadowEnvelopeProjectorDescriptor().projectionMode,
    'shadow-only',
  );

  assert.equal(
    admission.shadowEnvelopeProjectorDescriptor().rawPayloadRead,
    false,
  );

  assert.equal(
    admission.shadowEnvelopeProjectorDescriptor().canAdmit,
    false,
  );

  assert.equal(
    admission.shadowEnvelopeProjectorDescriptor().activatesEnforcement,
    false,
  );

  assert.equal(
    typeof admission.createShadowEnvelopeProjection,
    'function',
  );

  assert.equal(
    admission.RUNTIME_SIGNAL_ENVELOPE_VERSION,
    'attestor.runtime-signal-envelope.v1',
  );

  assert.equal(
    admission.runtimeSignalEnvelopeDescriptor().digestFirst,
    true,
  );

  assert.equal(
    admission.runtimeSignalEnvelopeDescriptor().rawPayloadStored,
    false,
  );

  assert.equal(
    admission.runtimeSignalEnvelopeDescriptor().canAdmit,
    false,
  );

  assert.equal(
    typeof admission.createRuntimeSignalEnvelope,
    'function',
  );

  assert.equal(
    admission.RUNTIME_SIGNAL_SOURCE_BINDING_VERSION,
    'attestor.runtime-signal-source-binding.v1',
  );

  assert.equal(
    admission.runtimeSignalSourceBindingDescriptor().signedEvidenceMustCoverEnvelopeDigest,
    true,
  );

  assert.equal(
    admission.runtimeSignalSourceBindingDescriptor().canAdmit,
    false,
  );

  assert.equal(
    typeof admission.createRuntimeSignalSourceBinding,
    'function',
  );

  assert.equal(
    admission.RUNTIME_SIGNAL_NORMALIZER_VERSION,
    'attestor.runtime-signal-normalizer.v1',
  );

  assert.equal(
    admission.runtimeSignalNormalizerDescriptor().runtimeSignalEnvelopeVersion,
    admission.RUNTIME_SIGNAL_ENVELOPE_VERSION,
  );

  assert.equal(
    admission.runtimeSignalNormalizerDescriptor().sourceInputDigestRequired,
    true,
  );

  assert.equal(
    admission.runtimeSignalNormalizerDescriptor().canAdmit,
    false,
  );

  assert.equal(
    typeof admission.normalizeRuntimeSignal,
    'function',
  );

  assert.equal(
    admission.SIGNAL_EXTRACTOR_CONTRACT_VERSION,
    'attestor.signal-extractor-contract.v1',
  );

  assert.equal(
    admission.signalExtractorContractDescriptor().signalRelationshipContractVersion,
    admission.SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  );

  assert.equal(
    admission.signalExtractorContractDescriptor().shadowEnvelopeProjectorVersion,
    admission.SHADOW_ENVELOPE_PROJECTOR_VERSION,
  );

  assert.equal(
    admission.signalExtractorContractDescriptor().categoryBoundOutputRequired,
    true,
  );

  assert.equal(
    admission.signalExtractorContractDescriptor().advisoryCannotEmitHardFloor,
    true,
  );

  assert.equal(
    admission.signalExtractorContractDescriptor().readsRawPayload,
    false,
  );

  assert.equal(
    admission.signalExtractorContractDescriptor().canAdmit,
    false,
  );

  assert.equal(
    typeof admission.createSignalExtractorDeclaration,
    'function',
  );

  assert.equal(
    typeof admission.createSignalExtractionBatch,
    'function',
  );

  assert.equal(
    admission.SIGNAL_ADAPTER_REGISTRY_VERSION,
    'attestor.signal-adapter-registry.v1',
  );

  assert.equal(
    admission.signalAdapterRegistryDescriptor().signalExtractorContractVersion,
    admission.SIGNAL_EXTRACTOR_CONTRACT_VERSION,
  );

  assert.equal(
    admission.signalAdapterRegistryDescriptor().signalRelationshipContractVersion,
    admission.SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  );

  assert.equal(
    admission.signalAdapterRegistryDescriptor().coverageComplete,
    true,
  );

  assert.equal(
    admission.signalAdapterRegistryDescriptor().passOutcomeMayMarkSafe,
    false,
  );

  assert.equal(
    admission.signalAdapterRegistryDescriptor().relationshipDetectionIncluded,
    false,
  );

  assert.equal(
    admission.signalAdapterRegistryDescriptor().canAdmit,
    false,
  );

  assert.equal(
    typeof admission.createBuiltinSignalAdapterRegistry,
    'function',
  );

  assert.equal(
    admission.createBuiltinSignalAdapterRegistry().registrations.length,
    6,
  );

  assert.equal(
    admission.RELATIONSHIP_DETECTOR_CONTRACT_VERSION,
    'attestor.relationship-detector-contract.v1',
  );

  assert.equal(
    admission.relationshipDetectorDescriptor().signalRelationshipContractVersion,
    admission.SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  );

  assert.equal(
    admission.relationshipDetectorDescriptor().ruleBasedOnly,
    true,
  );

  assert.equal(
    admission.relationshipDetectorDescriptor().sameEnvelopeOnly,
    true,
  );

  assert.equal(
    admission.relationshipDetectorDescriptor().learnedInferenceIncluded,
    false,
  );

  assert.equal(
    admission.relationshipDetectorDescriptor().correlationLearningIncluded,
    false,
  );

  assert.equal(
    admission.relationshipDetectorDescriptor().fusionIncluded,
    false,
  );

  assert.equal(
    admission.relationshipDetectorDescriptor().packetSigningIncluded,
    false,
  );

  assert.equal(
    admission.relationshipDetectorDescriptor().canAdmit,
    false,
  );

  assert.equal(
    typeof admission.createRelationshipDetectorRule,
    'function',
  );

  assert.equal(
    typeof admission.detectSignalRelationships,
    'function',
  );

  assert.equal(
    admission.SHADOW_RUNTIME_PIPELINE_VERSION,
    'attestor.shadow-runtime-pipeline.v1',
  );

  assert.equal(
    admission.shadowRuntimePipelineDescriptor().executionMode,
    'shadow-only',
  );

  assert.equal(
    admission.shadowRuntimePipelineDescriptor().relationshipEvaluationBeforeFusion,
    true,
  );

  assert.equal(
    admission.shadowRuntimePipelineDescriptor().unsignedPacketOnly,
    true,
  );

  assert.equal(
    admission.shadowRuntimePipelineDescriptor().canAdmit,
    false,
  );

  assert.equal(
    admission.shadowRuntimePipelineDescriptor().activatesEnforcement,
    false,
  );

  assert.equal(
    admission.shadowRuntimePipelineDescriptor().learnsFromTraffic,
    false,
  );

  assert.equal(
    typeof admission.runShadowRuntimePipelineDryRun,
    'function',
  );

  assert.equal(
    admission.SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
    'attestor.shadow-activation-profile-contract.v1',
  );

  assert.equal(
    admission.SHADOW_ACTIVATION_WORK_KEY_VERSION,
    'attestor.runtime-activation-work-key.v1',
  );

  assert.equal(
    admission.shadowActivationProfileContractDescriptor().sourceEventSchemaVersion,
    admission.CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  );

  assert.equal(
    admission.shadowActivationProfileContractDescriptor().shadowRuntimePipelineVersion,
    admission.SHADOW_RUNTIME_PIPELINE_VERSION,
  );

  assert.equal(
    admission.shadowActivationProfileContractDescriptor().deliverySemantics,
    'at-least-once',
  );

  assert.equal(
    admission.shadowActivationProfileContractDescriptor().duplicateHandling,
    'activation-work-key-digest',
  );

  assert.equal(
    admission.shadowActivationProfileContractDescriptor().orderingScope,
    'tenant-source-partition',
  );

  assert.equal(
    admission.shadowActivationProfileContractDescriptor().rawIdempotencyKeyStored,
    false,
  );

  assert.equal(
    admission.shadowActivationProfileContractDescriptor().workerBehaviorIncluded,
    false,
  );

  assert.equal(
    admission.shadowActivationProfileContractDescriptor().canAdmit,
    false,
  );

  assert.equal(
    admission.shadowActivationProfileContractDescriptor().activatesEnforcement,
    false,
  );

  assert.equal(
    typeof admission.createShadowActivationProfileContract,
    'function',
  );

  assert.equal(
    admission.SHADOW_OUTBOX_WORK_ITEM_CONTRACT_VERSION,
    'attestor.shadow-outbox-work-item-contract.v1',
  );

  assert.equal(
    admission.SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
    'attestor.shadow-runtime.activation.requested.v1',
  );

  assert.equal(
    admission.shadowOutboxWorkItemContractDescriptor().activationProfileContractVersion,
    admission.SHADOW_ACTIVATION_PROFILE_CONTRACT_VERSION,
  );

  assert.equal(
    admission.shadowOutboxWorkItemContractDescriptor().workKeyVersion,
    admission.SHADOW_ACTIVATION_WORK_KEY_VERSION,
  );

  assert.equal(
    admission.shadowOutboxWorkItemContractDescriptor().eventType,
    admission.SHADOW_OUTBOX_WORK_ITEM_EVENT_TYPE,
  );

  assert.equal(
    admission.shadowOutboxWorkItemContractDescriptor().status,
    'pending',
  );

  assert.equal(
    admission.shadowOutboxWorkItemContractDescriptor().deliverySemantics,
    'at-least-once',
  );

  assert.equal(
    admission.shadowOutboxWorkItemContractDescriptor().duplicateHandling,
    'activation-work-key-digest',
  );

  assert.equal(
    admission.shadowOutboxWorkItemContractDescriptor().claimBehaviorIncluded,
    false,
  );

  assert.equal(
    admission.shadowOutboxWorkItemContractDescriptor().workerBehaviorIncluded,
    false,
  );

}
