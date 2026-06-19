import {
  GENERIC_ADMISSION_TRUSTED_OBSERVED_FEATURE_ORIGINS,
  type CreateGenericAdmissionInput,
  type GenericAdmissionModeEvaluation,
  type GenericAdmissionObservedFeatureOrigin,
} from './contracts.js';

export function observedFeatureTrue(
  input: CreateGenericAdmissionInput,
  key: string,
): boolean {
  return input.observedFeatures?.[key] === true;
}

function observedFeatureOriginFor(
  input: CreateGenericAdmissionInput,
  key: string,
): GenericAdmissionObservedFeatureOrigin | null {
  return input.observedFeatureOrigins?.[key] ?? null;
}

function observedFeatureHasTrustedOrigin(
  input: CreateGenericAdmissionInput,
  key: string,
): boolean {
  const origin = observedFeatureOriginFor(input, key);
  return origin !== null && GENERIC_ADMISSION_TRUSTED_OBSERVED_FEATURE_ORIGINS.has(origin);
}

function trustedObservedFeatureTrue(
  input: CreateGenericAdmissionInput,
  key: string,
): boolean {
  return observedFeatureTrue(input, key) && observedFeatureHasTrustedOrigin(input, key);
}

export function genericAdmissionSummary(input: CreateGenericAdmissionInput): string {
  return input.summary ?? `${input.actor} proposes ${input.action} on ${input.downstreamSystem}.`;
}

export function genericAdmissionDimensions(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): Readonly<Record<string, string | number | boolean | null>> {
  return Object.freeze({
    domain: input.domain,
    mode: input.mode,
    shadowDecision: evaluation.shadowDecision,
    downstreamPosture: evaluation.downstreamPosture,
    hasAmount: input.amount !== null && input.amount !== undefined,
    hasRecipient: input.recipient !== null && input.recipient !== undefined,
    hasDataScope: input.dataScope !== null && input.dataScope !== undefined,
    adapterReady: trustedObservedFeatureTrue(input, 'adapterReady'),
    adapterReadyObserved: observedFeatureTrue(input, 'adapterReady'),
    adapterReadyOrigin: observedFeatureOriginFor(input, 'adapterReady'),
    authorityGuardOutcome: evaluation.authorityGuardDecision?.outcome ?? null,
    authorityGuardDigest: evaluation.authorityGuardDecision?.digest ?? null,
    authoritySourceCount: evaluation.authorityGuardDecision?.counts.sourceCount ?? 0,
    trustedAuthoritySourceCount:
      evaluation.authorityGuardDecision?.counts.trustedAuthoritySourceCount ?? 0,
    untrustedAuthoritySourceCount:
      evaluation.authorityGuardDecision?.counts.untrustedAuthoritySourceCount ?? 0,
    approvalGuardOutcome: evaluation.approvalGuardDecision?.outcome ?? null,
    approvalGuardDigest: evaluation.approvalGuardDecision?.digest ?? null,
    approvalCount: evaluation.approvalGuardDecision?.counts.approvalCount ?? 0,
    validApprovalCount: evaluation.approvalGuardDecision?.counts.validApprovalCount ?? 0,
    untrustedApprovalCount:
      evaluation.approvalGuardDecision?.counts.untrustedApprovalCount ?? 0,
    noGoConditionOutcome: evaluation.noGoConditionLedgerDecision?.outcome ?? null,
    noGoConditionDigest: evaluation.noGoConditionLedgerDecision?.digest ?? null,
    noGoConditionCount:
      evaluation.noGoConditionLedgerDecision?.observed.conditionCount ?? 0,
    noGoActiveConditionCount:
      evaluation.noGoConditionLedgerDecision?.observed.activeCount ?? 0,
    noGoPendingReviewCount:
      evaluation.noGoConditionLedgerDecision?.observed.pendingReviewCount ?? 0,
    noGoUntrustedSourceCount:
      evaluation.noGoConditionLedgerDecision?.observed.untrustedSourceCount ?? 0,
    noGoNaturalLanguageBypassAttempted:
      evaluation.noGoConditionLedgerDecision?.observed.naturalLanguageBypassAttempted ?? false,
    noGoNaturalLanguageBypassSignalCount:
      evaluation.noGoConditionLedgerDecision?.observed.naturalLanguageBypassSignalCount ?? 0,
    scopeExplosionGuardOutcome: evaluation.scopeExplosionGuardDecision?.outcome ?? null,
    scopeExplosionGuardDigest: evaluation.scopeExplosionGuardDecision?.digest ?? null,
    scopeExceededDimensionCount:
      evaluation.scopeExplosionGuardDecision?.observed.exceededDimensions.length ?? 0,
    scopeNarrowingDimensionCount:
      evaluation.scopeExplosionGuardDecision?.observed.narrowingDimensions.length ?? 0,
    scopeBlockingDimensionCount:
      evaluation.scopeExplosionGuardDecision?.observed.blockingDimensions.length ?? 0,
    scopeReviewDimensionCount:
      evaluation.scopeExplosionGuardDecision?.observed.reviewDimensions.length ?? 0,
    toolResultGuardOutcome: evaluation.toolResultGuardDecision?.outcome ?? null,
    toolResultGuardDigest: evaluation.toolResultGuardDecision?.digest ?? null,
    toolResultCount: evaluation.toolResultGuardDecision?.counts.toolResultCount ?? 0,
    trustedToolResultEvidenceCount:
      evaluation.toolResultGuardDecision?.counts.trustedEvidenceCount ?? 0,
    toolResultReviewCount: evaluation.toolResultGuardDecision?.counts.reviewCount ?? 0,
    toolResultBlockCount: evaluation.toolResultGuardDecision?.counts.blockCount ?? 0,
    untrustedToolResultSourceCount:
      evaluation.toolResultGuardDecision?.counts.untrustedSourceCount ?? 0,
    modelGeneratedToolResultSourceCount:
      evaluation.toolResultGuardDecision?.counts.modelGeneratedSourceCount ?? 0,
    toolResultMissingIntegrityCount:
      evaluation.toolResultGuardDecision?.counts.missingIntegrityCount ?? 0,
    toolResultMissingTimestampCount:
      evaluation.toolResultGuardDecision?.counts.missingTimestampCount ?? 0,
    toolResultEvidenceClassMismatchCount:
      evaluation.toolResultGuardDecision?.counts.evidenceClassMismatchCount ?? 0,
    agenticSupplyChainGuardOutcome:
      evaluation.agenticSupplyChainGuardDecision?.outcome ?? null,
    agenticSupplyChainGuardDigest:
      evaluation.agenticSupplyChainGuardDecision?.digest ?? null,
    agenticSupplyChainComponentCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.componentCount ?? 0,
    agenticSupplyChainBlockCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.blockCount ?? 0,
    agenticSupplyChainReviewCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.reviewCount ?? 0,
    agenticSupplyChainUnpinnedCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.unpinnedCount ?? 0,
    agenticSupplyChainMissingProvenanceCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.missingProvenanceCount ?? 0,
    agenticSupplyChainUnverifiedProvenanceCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.unverifiedProvenanceCount ?? 0,
    agenticSupplyChainOverbroadPermissionCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.overbroadPermissionCount ?? 0,
    agenticSupplyChainUnreviewedGeneratedArtifactCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.unreviewedGeneratedArtifactCount ?? 0,
    humanReviewFatigueGuardOutcome:
      evaluation.humanReviewFatigueGuardDecision?.outcome ?? null,
    humanReviewFatigueGuardDigest:
      evaluation.humanReviewFatigueGuardDecision?.digest ?? null,
    humanReviewTotalReviewItems:
      evaluation.humanReviewFatigueGuardDecision?.observed.totalReviewItems ?? 0,
    humanReviewLowPriorityRatio:
      evaluation.humanReviewFatigueGuardDecision?.observed.lowPriorityRatio ?? 0,
    humanReviewNoGoItems:
      evaluation.humanReviewFatigueGuardDecision?.observed.noGoItems ?? 0,
    humanReviewMissingEvidenceItems:
      evaluation.humanReviewFatigueGuardDecision?.observed.missingEvidenceItems ?? 0,
    humanReviewApprovalRatio:
      evaluation.humanReviewFatigueGuardDecision?.observed.approvalRatio ?? 0,
    humanReviewRawPayloadStored:
      evaluation.humanReviewFatigueGuardDecision?.observed.rawPayloadStored ?? false,
    humanReviewAutoEnforceRequested:
      evaluation.humanReviewFatigueGuardDecision?.observed.autoEnforceRequested ?? false,
    multiAgentDelegationGuardOutcome:
      evaluation.multiAgentDelegationGuardDecision?.outcome ?? null,
    multiAgentDelegationGuardDigest:
      evaluation.multiAgentDelegationGuardDecision?.digest ?? null,
    multiAgentDelegationPrincipalCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.principalCount ?? 0,
    multiAgentDelegationAgentPrincipalCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.agentPrincipalCount ?? 0,
    multiAgentDelegationMissingIdentityCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.missingIdentityCount ?? 0,
    multiAgentDelegationMissingAuthorityCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.missingAuthorityCount ?? 0,
    multiAgentDelegationMissingScopeCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.missingScopeCount ?? 0,
    multiAgentDelegationDistinctTenantCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.distinctTenantCount ?? 0,
    staleAuthorityPolicyGuardOutcome:
      evaluation.staleAuthorityPolicyGuardDecision?.outcome ?? null,
    staleAuthorityPolicyGuardDigest:
      evaluation.staleAuthorityPolicyGuardDecision?.digest ?? null,
    staleAuthorityPolicyNoGoReasonCount:
      evaluation.staleAuthorityPolicyGuardDecision?.counts.noGoReasonCount ?? 0,
    staleAuthorityPolicyBlockReasonCount:
      evaluation.staleAuthorityPolicyGuardDecision?.counts.blockReasonCount ?? 0,
    staleAuthorityPolicyReviewReasonCount:
      evaluation.staleAuthorityPolicyGuardDecision?.counts.reviewReasonCount ?? 0,
    staleAuthorityPolicyDriftState:
      evaluation.staleAuthorityPolicyGuardDecision?.observed.driftState ?? null,
    decisionContextDriftOutcome:
      evaluation.decisionContextDriftDecision?.outcome ?? null,
    decisionContextDriftDigest:
      evaluation.decisionContextDriftDecision?.digest ?? null,
    decisionContextDriftDimensionCount:
      evaluation.decisionContextDriftDecision?.counts.driftDimensionCount ?? 0,
    decisionContextMissingDimensionCount:
      evaluation.decisionContextDriftDecision?.counts.missingDimensionCount ?? 0,
    decisionContextBlockReasonCount:
      evaluation.decisionContextDriftDecision?.counts.blockReasonCount ?? 0,
    decisionContextReviewReasonCount:
      evaluation.decisionContextDriftDecision?.counts.reviewReasonCount ?? 0,
    decisionContextAgeHours:
      evaluation.decisionContextDriftDecision?.observed.contextAgeHours ?? null,
    authorityCreepGuardOutcome:
      evaluation.authorityCreepGuardDecision?.outcome ?? null,
    authorityCreepGuardDigest:
      evaluation.authorityCreepGuardDecision?.digest ?? null,
    authorityCreepFindingCount:
      evaluation.authorityCreepGuardDecision?.findings.length ?? 0,
    authorityCreepBlockedMetricUseCount:
      evaluation.authorityCreepGuardDecision?.blockedMetricUses.length ?? 0,
    authorityCreepArtifactFindingCount:
      evaluation.authorityCreepGuardDecision?.artifactFindings.length ?? 0,
    authorityCreepOpensUndercuttingDefeater:
      evaluation.authorityCreepGuardDecision?.opensUndercuttingDefeater ?? false,
    authorityCreepRejectedBoundary:
      evaluation.authorityCreepGuardDecision?.outcome === 'authority-creep-rejected-boundary',
    guardInputProvenanceOutcome:
      evaluation.guardInputProvenanceDecision?.outcome ?? null,
    guardInputProvenanceDigest:
      evaluation.guardInputProvenanceDecision?.digest ?? null,
    guardInputProvenanceRecordCount:
      evaluation.guardInputProvenanceDecision?.counts.recordCount ?? 0,
    guardInputProvenanceRequiredKindCount:
      evaluation.guardInputProvenanceDecision?.counts.requiredKindCount ?? 0,
    guardInputProvenanceMissingRequiredKindCount:
      evaluation.guardInputProvenanceDecision?.counts.missingRequiredKindCount ?? 0,
    guardInputProvenanceUntrustedSourceCount:
      evaluation.guardInputProvenanceDecision?.counts.untrustedSourceCount ?? 0,
    guardInputProvenanceMissingDigestCount:
      evaluation.guardInputProvenanceDecision?.counts.missingDigestCount ?? 0,
    guardInputProvenanceMissingTimestampCount:
      evaluation.guardInputProvenanceDecision?.counts.missingTimestampCount ?? 0,
    guardInputProvenanceMissingTenantCount:
      evaluation.guardInputProvenanceDecision?.counts.missingTenantCount ?? 0,
  });
}
