import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  evaluateConsequenceAgenticSupplyChain,
  type ConsequenceAgenticSupplyChainDecision,
} from './agentic-supply-chain-guard.js';
import {
  evaluateConsequenceApprovalProvenance,
  type ConsequenceApprovalProvenanceDecision,
} from './approval-provenance-guard.js';
import {
  AUTHORITY_CREEP_GUARD_VERSION,
  createAuthorityCreepGuard,
  type AuthorityCreepGuardRecord,
} from './authority-creep-guard.js';
import {
  GENERIC_ADMISSION_AGENTIC_SUPPLY_CHAIN_REASON_CODES,
  GENERIC_ADMISSION_APPROVAL_GUARD_REASON_CODES,
  GENERIC_ADMISSION_AUTHORITY_GUARD_REASON_CODES,
  GENERIC_ADMISSION_DECISION_CONTEXT_DRIFT_REASON_CODES,
  GENERIC_ADMISSION_GUARD_INPUT_PROVENANCE_REASON_CODES,
  GENERIC_ADMISSION_HUMAN_REVIEW_FATIGUE_REASON_CODES,
  GENERIC_ADMISSION_MULTI_AGENT_DELEGATION_REASON_CODES,
  GENERIC_ADMISSION_NO_GO_REASON_CODES,
  GENERIC_ADMISSION_SCOPE_EXPLOSION_REASON_CODES,
  GENERIC_ADMISSION_TOOL_RESULT_REASON_CODES,
  GENERIC_ADMISSION_TRUSTED_OBSERVED_FEATURE_ORIGINS,
  type ConsequenceAdmissionCheck,
  type ConsequenceAdmissionCheckKind,
  type ConsequenceAdmissionCheckOutcome,
  type ConsequenceAdmissionConstraint,
  type ConsequenceAdmissionDecision,
  type ConsequenceAdmissionProofRef,
  type ConsequenceAdmissionRequest,
  type CreateGenericAdmissionInput,
  type GenericAdmissionDownstreamPosture,
  type GenericAdmissionEnvelope,
  type GenericAdmissionGuardInputProvenanceDecision,
  type GenericAdmissionMode,
  type GenericAdmissionModeEvaluation,
  type GenericAdmissionObservedFeatureOrigin,
  type GenericAdmissionShadowDecision,
} from './contracts.js';
import {
  evaluateConsequenceDecisionContextDrift,
  type ConsequenceDecisionContextDriftDecision,
} from './decision-context-drift-binding.js';
import {
  normalizeCreateGenericAdmissionInput,
} from './generic-input-normalization.js';
import {
  evaluateGenericAdmissionGuardInputProvenance,
} from './guard-input-provenance.js';
import {
  evaluateConsequenceHumanReviewFatigue,
  type ConsequenceHumanReviewFatigueDecision,
} from './human-review-fatigue-guard.js';
import {
  evaluateConsequenceMultiAgentDelegation,
  type ConsequenceMultiAgentDelegationDecision,
} from './multi-agent-delegation-guard.js';
import {
  evaluateConsequenceNoGoConditionLedger,
  type ConsequenceNoGoConditionLedgerDecision,
} from './no-go-condition-ledger.js';
import {
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
} from './builders.js';
import {
  canonicalObject,
  inferConstraintKind,
} from './normalization.js';
import {
  evaluateConsequenceScopeExplosion,
  type ConsequenceScopeExplosionDecision,
} from './scope-explosion-guard.js';
import {
  evaluateConsequenceStaleAuthorityPolicy,
  type ConsequenceStaleAuthorityPolicyDecision,
} from './stale-authority-policy-guard.js';
import {
  consequenceAdmissionDomainProfile,
} from './taxonomy.js';
import {
  evaluateConsequenceToolResultPoisoning,
  type ConsequenceToolResultPoisoningDecision,
} from './tool-result-poisoning-guard.js';
import {
  evaluateConsequenceUntrustedContentAuthority,
  type ConsequenceUntrustedContentAuthorityDecision,
} from './untrusted-content-authority-guard.js';

function observedFeatureTrue(
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

function genericAdmissionAuthorityGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceUntrustedContentAuthorityDecision | null {
  const profile = consequenceAdmissionDomainProfile(input.domain);
  const authorityRequired = profile.requiredChecks.includes('authority');
  const authoritySources = input.authoritySources ?? [];
  if (!authorityRequired && authoritySources.length === 0) return null;
  return evaluateConsequenceUntrustedContentAuthority({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    requiredAuthority: authorityRequired,
    sources: authoritySources,
  });
}

function authorityGuardReviewReasonCodes(
  decision: ConsequenceUntrustedContentAuthorityDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionRequiresApprovalProvenance(
  input: CreateGenericAdmissionInput,
): boolean {
  return (input.approvals ?? []).length > 0 ||
    (input.authoritySources ?? []).some((source) => source.claimKind === 'approval');
}

function genericAdmissionApprovalGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceApprovalProvenanceDecision | null {
  if (!genericAdmissionRequiresApprovalProvenance(input)) return null;
  return evaluateConsequenceApprovalProvenance({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    approvals: input.approvals ?? [],
  });
}

function approvalGuardReviewReasonCodes(
  decision: ConsequenceApprovalProvenanceDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionHasScopeExplosionInput(
  input: CreateGenericAdmissionInput,
): boolean {
  return (input.scopeOwnerPolicyRef !== null && input.scopeOwnerPolicyRef !== undefined) ||
    (input.requestedScope !== null && input.requestedScope !== undefined) ||
    (input.approvedScope !== null && input.approvedScope !== undefined);
}

function genericAdmissionScopeExplosionGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceScopeExplosionDecision | null {
  if (!genericAdmissionHasScopeExplosionInput(input)) return null;
  return evaluateConsequenceScopeExplosion({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    scopeOwnerPolicyRef: input.scopeOwnerPolicyRef ?? null,
    requestedScope: input.requestedScope ?? null,
    approvedScope: input.approvedScope ?? null,
  });
}

function scopeExplosionReviewReasonCodes(
  decision: ConsequenceScopeExplosionDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass' || decision.outcome === 'narrow') {
    return Object.freeze([]);
  }
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionHasToolResultInput(
  input: CreateGenericAdmissionInput,
): boolean {
  return (input.allowedToolResultEvidenceClasses !== null &&
    input.allowedToolResultEvidenceClasses !== undefined) ||
    (input.toolResults !== null && input.toolResults !== undefined);
}

function genericAdmissionToolResultGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceToolResultPoisoningDecision | null {
  if (!genericAdmissionHasToolResultInput(input)) return null;
  return evaluateConsequenceToolResultPoisoning({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    allowedEvidenceClasses: input.allowedToolResultEvidenceClasses ?? null,
    toolResults: input.toolResults ?? null,
  });
}

function toolResultGuardReviewReasonCodes(
  decision: ConsequenceToolResultPoisoningDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionAgenticSupplyChainGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceAgenticSupplyChainDecision | null {
  if (input.agenticSupplyChain === null || input.agenticSupplyChain === undefined) {
    return null;
  }
  return evaluateConsequenceAgenticSupplyChain({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    components: input.agenticSupplyChain.components,
  });
}

function agenticSupplyChainReviewReasonCodes(
  decision: ConsequenceAgenticSupplyChainDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionHumanReviewFatigueGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceHumanReviewFatigueDecision | null {
  if (input.humanReviewFatigue === null || input.humanReviewFatigue === undefined) {
    return null;
  }
  return evaluateConsequenceHumanReviewFatigue({
    ...input.humanReviewFatigue,
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
  });
}

function humanReviewFatigueReviewReasonCodes(
  decision: ConsequenceHumanReviewFatigueDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionMultiAgentDelegationGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceMultiAgentDelegationDecision | null {
  if (input.multiAgentDelegation === null || input.multiAgentDelegation === undefined) {
    return null;
  }
  return evaluateConsequenceMultiAgentDelegation({
    ...input.multiAgentDelegation,
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
  });
}

function multiAgentDelegationReviewReasonCodes(
  decision: ConsequenceMultiAgentDelegationDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionStaleAuthorityPolicyGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceStaleAuthorityPolicyDecision | null {
  if (input.staleAuthorityPolicy === null || input.staleAuthorityPolicy === undefined) {
    return null;
  }
  return evaluateConsequenceStaleAuthorityPolicy({
    ...input.staleAuthorityPolicy,
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
  });
}

function staleAuthorityPolicyReviewReasonCodes(
  decision: ConsequenceStaleAuthorityPolicyDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionDecisionContextDriftDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceDecisionContextDriftDecision | null {
  if (input.decisionContextDrift === null || input.decisionContextDrift === undefined) {
    return null;
  }
  return evaluateConsequenceDecisionContextDrift({
    ...input.decisionContextDrift,
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
  });
}

function decisionContextDriftReviewReasonCodes(
  decision: ConsequenceDecisionContextDriftDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function authorityCreepFallbackGuardId(input: CreateGenericAdmissionInput): string {
  const authorityCreep = input.authorityCreep;
  const digest = canonicalObject({
    version: AUTHORITY_CREEP_GUARD_VERSION,
    domain: input.domain,
    action: input.action,
    requestedAt: input.requestedAt ?? null,
    decidedAt: input.decidedAt ?? null,
    lineageDigest: authorityCreep?.lineageGraph.digest ?? null,
    measurementPlaneDigest: authorityCreep?.measurementPlane?.digest ?? null,
  } as unknown as CanonicalReleaseJsonValue).digest;
  return `guard:generic-admission:authority-creep:${digest}`;
}

function genericAdmissionAuthorityCreepGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): AuthorityCreepGuardRecord | null {
  if (input.authorityCreep === null || input.authorityCreep === undefined) {
    return null;
  }
  return createAuthorityCreepGuard({
    lineageGraph: input.authorityCreep.lineageGraph,
    guardId: input.authorityCreep.guardId ?? authorityCreepFallbackGuardId(input),
    evaluatedAt:
      input.decidedAt ??
      input.requestedAt ??
      input.authorityCreep.lineageGraph.generatedAt,
    evaluatorRefDigest: input.authorityCreep.evaluatorRefDigest,
    targetClaimNodeId: input.authorityCreep.targetClaimNodeId ?? null,
    measurementPlane: input.authorityCreep.measurementPlane ?? null,
    evidenceNodeId: input.authorityCreep.evidenceNodeId ?? null,
    defeaterId: input.authorityCreep.defeaterId ?? null,
    rawPayloadRequested: input.authorityCreep.rawPayloadRequested ?? null,
    rawEvidenceRequested: input.authorityCreep.rawEvidenceRequested ?? null,
    auditWriteRequested: input.authorityCreep.auditWriteRequested ?? null,
    policyActivationRequested: input.authorityCreep.policyActivationRequested ?? null,
    liveEnforcementRequested: input.authorityCreep.liveEnforcementRequested ?? null,
    authorityActionRequested: input.authorityCreep.authorityActionRequested ?? null,
  });
}

function authorityCreepReviewReasonCodes(
  decision: AuthorityCreepGuardRecord | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'authority-creep-evidence-ready') {
    return Object.freeze([]);
  }
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionHasNoGoConditionInput(
  input: CreateGenericAdmissionInput,
): boolean {
  return input.noGoLedgerRef !== null && input.noGoLedgerRef !== undefined ||
    input.noGoConditions !== null && input.noGoConditions !== undefined ||
    input.noGoNaturalLanguageBypassAttempted === true ||
    (input.noGoNaturalLanguageSignals ?? []).length > 0 ||
    input.noGoBypassAttemptRef !== null && input.noGoBypassAttemptRef !== undefined;
}

function genericAdmissionNoGoConditionLedgerDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceNoGoConditionLedgerDecision | null {
  if (!genericAdmissionHasNoGoConditionInput(input)) return null;
  return evaluateConsequenceNoGoConditionLedger({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    ledgerRef: input.noGoLedgerRef ?? null,
    conditions: input.noGoConditions ?? null,
    naturalLanguageBypassAttempted: input.noGoNaturalLanguageBypassAttempted ?? null,
    naturalLanguageSignals: input.noGoNaturalLanguageSignals ?? [],
    bypassAttemptRef: input.noGoBypassAttemptRef ?? null,
  });
}

function noGoConditionLedgerReviewReasonCodes(
  decision: ConsequenceNoGoConditionLedgerDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionGuardInputProvenanceDecisionFor(
  input: CreateGenericAdmissionInput,
): GenericAdmissionGuardInputProvenanceDecision | null {
  const records = input.guardInputProvenance ?? [];
  const requiredGuardKinds = input.requiredGuardInputProvenance ?? [];
  if (records.length === 0 && requiredGuardKinds.length === 0) return null;
  return evaluateGenericAdmissionGuardInputProvenance({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    records,
    requiredGuardKinds,
  });
}

function guardInputProvenanceReviewReasonCodes(
  decision: GenericAdmissionGuardInputProvenanceDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionReviewReasons(
  input: CreateGenericAdmissionInput,
  authorityGuardDecision: ConsequenceUntrustedContentAuthorityDecision | null,
  approvalGuardDecision: ConsequenceApprovalProvenanceDecision | null,
  scopeExplosionGuardDecision: ConsequenceScopeExplosionDecision | null,
  toolResultGuardDecision: ConsequenceToolResultPoisoningDecision | null,
  agenticSupplyChainGuardDecision: ConsequenceAgenticSupplyChainDecision | null,
  humanReviewFatigueGuardDecision: ConsequenceHumanReviewFatigueDecision | null,
  multiAgentDelegationGuardDecision: ConsequenceMultiAgentDelegationDecision | null,
  staleAuthorityPolicyGuardDecision: ConsequenceStaleAuthorityPolicyDecision | null,
  decisionContextDriftDecision: ConsequenceDecisionContextDriftDecision | null,
  authorityCreepGuardDecision: AuthorityCreepGuardRecord | null,
  noGoConditionLedgerDecision: ConsequenceNoGoConditionLedgerDecision | null,
  guardInputProvenanceDecision: GenericAdmissionGuardInputProvenanceDecision | null,
): readonly string[] {
  const reasons: string[] = [];
  const profile = consequenceAdmissionDomainProfile(input.domain);

  if (!input.policyRef) reasons.push('policy-ref-missing');
  if ((input.evidenceRefs ?? []).length === 0) reasons.push('evidence-ref-missing');

  if (
    input.domain === 'money-movement' ||
    input.domain === 'programmable-money'
  ) {
    if (!input.amount) reasons.push('amount-scope-missing');
    if (!input.recipient) reasons.push('recipient-scope-missing');
  }

  if (input.domain === 'data-disclosure' && !input.dataScope) {
    reasons.push('data-scope-missing');
  }

  if (input.domain === 'authority-change' && !input.authorityMode) {
    reasons.push('authority-mode-missing');
  }
  reasons.push(...authorityGuardReviewReasonCodes(authorityGuardDecision));
  reasons.push(...approvalGuardReviewReasonCodes(approvalGuardDecision));
  reasons.push(...scopeExplosionReviewReasonCodes(scopeExplosionGuardDecision));
  reasons.push(...toolResultGuardReviewReasonCodes(toolResultGuardDecision));
  reasons.push(...agenticSupplyChainReviewReasonCodes(agenticSupplyChainGuardDecision));
  reasons.push(...humanReviewFatigueReviewReasonCodes(humanReviewFatigueGuardDecision));
  reasons.push(...multiAgentDelegationReviewReasonCodes(multiAgentDelegationGuardDecision));
  reasons.push(...staleAuthorityPolicyReviewReasonCodes(staleAuthorityPolicyGuardDecision));
  reasons.push(...decisionContextDriftReviewReasonCodes(decisionContextDriftDecision));
  reasons.push(...authorityCreepReviewReasonCodes(authorityCreepGuardDecision));
  reasons.push(...noGoConditionLedgerReviewReasonCodes(noGoConditionLedgerDecision));
  reasons.push(...guardInputProvenanceReviewReasonCodes(guardInputProvenanceDecision));

  if (profile.requiredChecks.includes('adapter-readiness')) {
    if (!observedFeatureTrue(input, 'adapterReady')) {
      reasons.push('adapter-readiness-missing');
    } else if (!trustedObservedFeatureTrue(input, 'adapterReady')) {
      reasons.push('adapter-readiness-origin-untrusted');
    }
  }

  if (input.domain === 'custom') {
    reasons.push('custom-domain-review-required');
  }

  return Object.freeze(reasons);
}

function genericAdmissionShadowDecisionFor(
  input: CreateGenericAdmissionInput,
  reviewReasons: readonly string[],
  authorityGuardDecision: ConsequenceUntrustedContentAuthorityDecision | null,
  approvalGuardDecision: ConsequenceApprovalProvenanceDecision | null,
  scopeExplosionGuardDecision: ConsequenceScopeExplosionDecision | null,
  toolResultGuardDecision: ConsequenceToolResultPoisoningDecision | null,
  agenticSupplyChainGuardDecision: ConsequenceAgenticSupplyChainDecision | null,
  humanReviewFatigueGuardDecision: ConsequenceHumanReviewFatigueDecision | null,
  multiAgentDelegationGuardDecision: ConsequenceMultiAgentDelegationDecision | null,
  staleAuthorityPolicyGuardDecision: ConsequenceStaleAuthorityPolicyDecision | null,
  decisionContextDriftDecision: ConsequenceDecisionContextDriftDecision | null,
  authorityCreepGuardDecision: AuthorityCreepGuardRecord | null,
  noGoConditionLedgerDecision: ConsequenceNoGoConditionLedgerDecision | null,
  guardInputProvenanceDecision: GenericAdmissionGuardInputProvenanceDecision | null,
): GenericAdmissionShadowDecision {
  if (authorityGuardDecision?.outcome === 'block') return 'would_block';
  if (approvalGuardDecision?.outcome === 'block') return 'would_block';
  if (scopeExplosionGuardDecision?.outcome === 'block') return 'would_block';
  if (toolResultGuardDecision?.outcome === 'block') return 'would_block';
  if (agenticSupplyChainGuardDecision?.outcome === 'block') return 'would_block';
  if (humanReviewFatigueGuardDecision?.outcome === 'block') return 'would_block';
  if (multiAgentDelegationGuardDecision?.outcome === 'block') return 'would_block';
  if (staleAuthorityPolicyGuardDecision?.outcome === 'block') return 'would_block';
  if (decisionContextDriftDecision?.outcome === 'block') return 'would_block';
  if (authorityCreepGuardDecision?.outcome === 'authority-creep-rejected-boundary') {
    return 'would_block';
  }
  if (noGoConditionLedgerDecision?.outcome === 'block') return 'would_block';
  if (guardInputProvenanceDecision?.outcome === 'block') return 'would_block';
  if (
    observedFeatureTrue(input, 'policyBlocked') ||
    observedFeatureTrue(input, 'blocked') ||
    observedFeatureTrue(input, 'unsafe')
  ) {
    return 'would_block';
  }
  if (reviewReasons.length > 0) return 'would_review';
  if (scopeExplosionGuardDecision?.outcome === 'narrow') return 'would_narrow';
  if (observedFeatureTrue(input, 'narrowRequired')) return 'would_narrow';
  return 'would_admit';
}

function effectiveDecisionForGenericMode(
  mode: GenericAdmissionMode,
  shadowDecision: GenericAdmissionShadowDecision,
): ConsequenceAdmissionDecision {
  if (mode === 'observe' || mode === 'warn') return 'admit';
  if (mode === 'review') {
    return shadowDecision === 'would_admit' ? 'admit' : 'review';
  }
  if (shadowDecision === 'would_block') return 'block';
  if (shadowDecision === 'would_review') return 'review';
  if (shadowDecision === 'would_narrow') return 'narrow';
  return 'admit';
}

function downstreamPostureForGenericMode(
  mode: GenericAdmissionMode,
  effectiveDecision: ConsequenceAdmissionDecision,
): GenericAdmissionDownstreamPosture {
  if (mode === 'observe') return 'observe-only';
  if (mode === 'warn') return 'warn-only';
  if (effectiveDecision === 'review') return 'hold-for-review';
  return 'enforce-decision';
}

function genericReasonCodes(
  input: CreateGenericAdmissionInput,
  shadowDecision: GenericAdmissionShadowDecision,
  reviewReasons: readonly string[],
  scopeExplosionGuardDecision: ConsequenceScopeExplosionDecision | null,
  toolResultGuardDecision: ConsequenceToolResultPoisoningDecision | null,
  agenticSupplyChainGuardDecision: ConsequenceAgenticSupplyChainDecision | null,
  humanReviewFatigueGuardDecision: ConsequenceHumanReviewFatigueDecision | null,
  multiAgentDelegationGuardDecision: ConsequenceMultiAgentDelegationDecision | null,
  staleAuthorityPolicyGuardDecision: ConsequenceStaleAuthorityPolicyDecision | null,
  decisionContextDriftDecision: ConsequenceDecisionContextDriftDecision | null,
  authorityCreepGuardDecision: AuthorityCreepGuardRecord | null,
): readonly string[] {
  const reasons = [
    `mode-${input.mode}`,
    `shadow-${shadowDecision}`,
    ...reviewReasons,
    ...(scopeExplosionGuardDecision?.reasonCodes ?? []),
    ...(toolResultGuardDecision?.reasonCodes ?? []),
    ...(agenticSupplyChainGuardDecision?.reasonCodes ?? []),
    ...(humanReviewFatigueGuardDecision?.reasonCodes ?? []),
    ...(multiAgentDelegationGuardDecision?.reasonCodes ?? []),
    ...(staleAuthorityPolicyGuardDecision?.reasonCodes ?? []),
    ...(decisionContextDriftDecision?.reasonCodes ?? []),
    ...(authorityCreepGuardDecision?.reasonCodes ?? []),
  ];
  if (input.mode === 'observe' || input.mode === 'warn') {
    reasons.push('non-enforcing-mode');
  }
  if (observedFeatureTrue(input, 'policyBlocked')) reasons.push('policy-blocked');
  if (observedFeatureTrue(input, 'blocked')) reasons.push('feature-blocked');
  if (observedFeatureTrue(input, 'unsafe')) reasons.push('feature-unsafe');
  if (observedFeatureTrue(input, 'narrowRequired')) reasons.push('narrow-required');
  if (input.retryAttempt !== null && input.retryAttempt !== undefined) {
    reasons.push('retry-attempt-bound');
  }
  return Object.freeze([...new Set(reasons)]);
}

function createGenericAdmissionEvaluation(
  input: CreateGenericAdmissionInput,
): GenericAdmissionModeEvaluation {
  const authorityGuardDecision = genericAdmissionAuthorityGuardDecisionFor(input);
  const approvalGuardDecision = genericAdmissionApprovalGuardDecisionFor(input);
  const scopeExplosionGuardDecision = genericAdmissionScopeExplosionGuardDecisionFor(input);
  const toolResultGuardDecision = genericAdmissionToolResultGuardDecisionFor(input);
  const agenticSupplyChainGuardDecision =
    genericAdmissionAgenticSupplyChainGuardDecisionFor(input);
  const humanReviewFatigueGuardDecision =
    genericAdmissionHumanReviewFatigueGuardDecisionFor(input);
  const multiAgentDelegationGuardDecision =
    genericAdmissionMultiAgentDelegationGuardDecisionFor(input);
  const staleAuthorityPolicyGuardDecision =
    genericAdmissionStaleAuthorityPolicyGuardDecisionFor(input);
  const decisionContextDriftDecision =
    genericAdmissionDecisionContextDriftDecisionFor(input);
  const authorityCreepGuardDecision =
    genericAdmissionAuthorityCreepGuardDecisionFor(input);
  const noGoConditionLedgerDecision = genericAdmissionNoGoConditionLedgerDecisionFor(input);
  const guardInputProvenanceDecision =
    genericAdmissionGuardInputProvenanceDecisionFor(input);
  const reviewReasons = genericAdmissionReviewReasons(
    input,
    authorityGuardDecision,
    approvalGuardDecision,
    scopeExplosionGuardDecision,
    toolResultGuardDecision,
    agenticSupplyChainGuardDecision,
    humanReviewFatigueGuardDecision,
    multiAgentDelegationGuardDecision,
    staleAuthorityPolicyGuardDecision,
    decisionContextDriftDecision,
    authorityCreepGuardDecision,
    noGoConditionLedgerDecision,
    guardInputProvenanceDecision,
  );
  const shadowDecision = genericAdmissionShadowDecisionFor(
    input,
    reviewReasons,
    authorityGuardDecision,
    approvalGuardDecision,
    scopeExplosionGuardDecision,
    toolResultGuardDecision,
    agenticSupplyChainGuardDecision,
    humanReviewFatigueGuardDecision,
    multiAgentDelegationGuardDecision,
    staleAuthorityPolicyGuardDecision,
    decisionContextDriftDecision,
    authorityCreepGuardDecision,
    noGoConditionLedgerDecision,
    guardInputProvenanceDecision,
  );
  const effectiveDecision = effectiveDecisionForGenericMode(input.mode, shadowDecision);
  const downstreamPosture = downstreamPostureForGenericMode(input.mode, effectiveDecision);

  return Object.freeze({
    mode: input.mode,
    shadowDecision,
    effectiveDecision,
    downstreamPosture,
    enforcementActive: input.mode === 'review' || input.mode === 'enforce',
    reasonCodes: genericReasonCodes(
      input,
      shadowDecision,
      reviewReasons,
      scopeExplosionGuardDecision,
      toolResultGuardDecision,
      agenticSupplyChainGuardDecision,
      humanReviewFatigueGuardDecision,
      multiAgentDelegationGuardDecision,
      staleAuthorityPolicyGuardDecision,
      decisionContextDriftDecision,
      authorityCreepGuardDecision,
    ),
    authorityGuardDecision,
    approvalGuardDecision,
    scopeExplosionGuardDecision,
    toolResultGuardDecision,
    agenticSupplyChainGuardDecision,
    humanReviewFatigueGuardDecision,
    multiAgentDelegationGuardDecision,
    staleAuthorityPolicyGuardDecision,
    decisionContextDriftDecision,
    authorityCreepGuardDecision,
    noGoConditionLedgerDecision,
    guardInputProvenanceDecision,
  });
}

function reasonCodesForCheck(
  kind: ConsequenceAdmissionCheckKind,
  reasonCodes: readonly string[],
): readonly string[] {
  const matches = reasonCodes.filter((reason) => {
    if (reason.endsWith('-pass')) return false;
    if (kind === 'policy') {
      return reason.startsWith('policy-') ||
        reason.startsWith('current-policy-') ||
        reason === 'stale-policy-review' ||
        reason === 'stale-policy-block' ||
        reason.startsWith('drift-state-') ||
        reason === 'no-go-reason-present' ||
        reason === 'supply-chain-domain-pack-boundary-unverified' ||
        reason === 'policy-version-drift' ||
        reason === 'policy-digest-drift' ||
        reason === 'authority-creep-finding:policy-activation-requested' ||
        reason === 'authority-creep-finding:lineage-policy-activation-requested' ||
        reason === 'guard-input-policy-untrusted' ||
        reason === 'guard-input-provenance-missing' ||
        GENERIC_ADMISSION_SCOPE_EXPLOSION_REASON_CODES.has(reason) ||
        GENERIC_ADMISSION_NO_GO_REASON_CODES.has(reason) ||
        (
          GENERIC_ADMISSION_GUARD_INPUT_PROVENANCE_REASON_CODES.has(reason) &&
          reason.includes('policy')
        );
    }
    if (kind === 'authority') {
      return (reason.startsWith('authority-') &&
          !reason.startsWith('authority-creep-')) ||
        reason.startsWith('approval-') ||
        reason === 'authority-creep-finding:authority-action-requested' ||
        reason === 'authority-creep-finding:lineage-authority-action-requested' ||
        reason === 'supply-chain-owner-authority-missing' ||
        reason === 'supply-chain-review-missing' ||
        GENERIC_ADMISSION_MULTI_AGENT_DELEGATION_REASON_CODES.has(reason) ||
        GENERIC_ADMISSION_AUTHORITY_GUARD_REASON_CODES.has(reason) ||
        GENERIC_ADMISSION_APPROVAL_GUARD_REASON_CODES.has(reason) ||
        reason === 'guard-input-source-untrusted' ||
        reason === 'guard-input-authority-untrusted' ||
        reason === 'guard-input-provenance-missing' ||
        reason === 'guard-input-block';
    }
    if (kind === 'evidence') {
      return reason.startsWith('evidence-') ||
        reason.startsWith('authority-creep-finding:') ||
        reason.startsWith('authority-creep-blocked-metric-use:') ||
        reason === 'authority-creep-outcome:authority-creep-open-undercutting-defeater' ||
        reason === 'authority-creep-outcome:authority-creep-held-for-lineage-binding' ||
        reason === 'authority-creep-outcome:authority-creep-rejected-boundary' ||
        GENERIC_ADMISSION_TOOL_RESULT_REASON_CODES.has(reason) ||
        GENERIC_ADMISSION_AGENTIC_SUPPLY_CHAIN_REASON_CODES.has(reason) ||
        GENERIC_ADMISSION_HUMAN_REVIEW_FATIGUE_REASON_CODES.has(reason) ||
        GENERIC_ADMISSION_DECISION_CONTEXT_DRIFT_REASON_CODES.has(reason) ||
        reason === 'guard-input-source-untrusted' ||
        reason === 'guard-input-digest-missing' ||
        reason === 'guard-input-evidence-untrusted' ||
        reason === 'guard-input-provenance-missing' ||
        reason === 'guard-input-review';
    }
    if (kind === 'enforcement') {
      return reason === 'non-enforcing-mode' ||
        reason === 'supply-chain-permission-scope-missing' ||
        reason === 'supply-chain-permission-overbroad' ||
        reason === 'supply-chain-install-scripts-present' ||
        reason === 'supply-chain-network-egress-unreviewed' ||
        reason === 'supply-chain-runtime-replay-missing' ||
        reason === 'authority-creep-finding:live-enforcement-requested' ||
        reason === 'authority-creep-finding:lineage-live-enforcement-requested' ||
        reason === 'authority-creep-outcome:authority-creep-rejected-boundary';
    }
    if (kind === 'adapter-readiness') {
      return reason.startsWith('adapter-') ||
        reason === 'supply-chain-adapter-readiness-missing';
    }
    if (kind === 'freshness') {
      return reason.startsWith('freshness-') ||
        reason.includes('freshness') ||
        reason === 'approval-validity-window-missing' ||
        reason === 'approval-not-yet-valid' ||
        reason === 'approval-expired' ||
        reason === 'authority-expired' ||
        reason === 'authority-expires-at-invalid' ||
        reason === 'decision-context-expired' ||
        reason === 'decision-context-age-exceeded' ||
        reason === 'simulation-refresh-required' ||
        reason === 'simulation-digest-missing' ||
        reason === 'guard-input-timestamp-missing';
    }
    return false;
  });
  return Object.freeze(matches);
}

function checkOutcomeForGenericMode(
  mode: GenericAdmissionMode,
  effectiveDecision: ConsequenceAdmissionDecision,
  checkReasons: readonly string[],
): ConsequenceAdmissionCheckOutcome {
  if (checkReasons.length === 0) return 'pass';
  if (effectiveDecision === 'narrow') return 'warn';
  return mode === 'observe' || mode === 'warn' ? 'warn' : 'fail';
}

function createGenericAdmissionChecks(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionCheck[] {
  const profile = consequenceAdmissionDomainProfile(input.domain);
  return Object.freeze(
    profile.requiredChecks.map((kind) => {
      const checkReasons = reasonCodesForCheck(kind, evaluation.reasonCodes);
      const outcome = checkOutcomeForGenericMode(
        input.mode,
        evaluation.effectiveDecision,
        checkReasons,
      );
      const evidenceRefs =
        kind === 'authority'
          ? [
              ...(input.evidenceRefs ?? []),
              ...(evaluation.authorityGuardDecision !== null
                ? [evaluation.authorityGuardDecision.digest]
                : []),
              ...(evaluation.approvalGuardDecision !== null
                ? [evaluation.approvalGuardDecision.digest]
                : []),
              ...(evaluation.guardInputProvenanceDecision !== null
                ? [evaluation.guardInputProvenanceDecision.digest]
                : []),
              ...(evaluation.multiAgentDelegationGuardDecision !== null
                ? [evaluation.multiAgentDelegationGuardDecision.digest]
                : []),
              ...(evaluation.authorityCreepGuardDecision !== null &&
              evaluation.authorityCreepGuardDecision.findings.some((finding) =>
                finding.includes('authority-action'))
                ? [evaluation.authorityCreepGuardDecision.digest]
                : []),
            ]
          : kind === 'policy'
            ? [
                ...(input.evidenceRefs ?? []),
                ...(evaluation.noGoConditionLedgerDecision !== null
                  ? [evaluation.noGoConditionLedgerDecision.digest]
                  : []),
                ...(evaluation.decisionContextDriftDecision !== null
                  ? [evaluation.decisionContextDriftDecision.digest]
                  : []),
                ...(evaluation.guardInputProvenanceDecision !== null
                  ? [evaluation.guardInputProvenanceDecision.digest]
                  : []),
                ...(evaluation.authorityCreepGuardDecision !== null &&
                evaluation.authorityCreepGuardDecision.findings.some((finding) =>
                  finding.includes('policy-activation'))
                  ? [evaluation.authorityCreepGuardDecision.digest]
                  : []),
              ]
          : [
              ...(input.evidenceRefs ?? []),
              ...(evaluation.decisionContextDriftDecision !== null &&
              (kind === 'evidence' || kind === 'freshness')
                ? [evaluation.decisionContextDriftDecision.digest]
                : []),
              ...(evaluation.guardInputProvenanceDecision !== null &&
              (kind === 'evidence' || kind === 'freshness')
                ? [evaluation.guardInputProvenanceDecision.digest]
                : []),
              ...(evaluation.humanReviewFatigueGuardDecision !== null && kind === 'evidence'
                ? [evaluation.humanReviewFatigueGuardDecision.digest]
                : []),
              ...(evaluation.authorityCreepGuardDecision !== null && kind === 'evidence'
                ? [evaluation.authorityCreepGuardDecision.digest]
                : []),
            ];
      return createConsequenceAdmissionCheck({
        kind,
        label: `${kind} check`,
        outcome,
        required: input.mode === 'review' || input.mode === 'enforce',
        summary:
          outcome === 'pass'
            ? `${kind} closure is present for the proposed consequence.`
            : `${kind} closure is incomplete for the proposed consequence.`,
        reasonCodes: checkReasons,
        evidenceRefs,
      });
    }),
  );
}

function genericAdmissionReason(
  evaluation: GenericAdmissionModeEvaluation,
): string {
  if (evaluation.mode === 'observe') {
    return 'Observe mode recorded the shadow admission decision without blocking downstream execution.';
  }
  if (evaluation.mode === 'warn') {
    return 'Warn mode allowed the request while returning the shadow admission decision and warning checks.';
  }
  if (evaluation.effectiveDecision === 'review') {
    return 'The proposed consequence is held for review before downstream execution.';
  }
  if (evaluation.effectiveDecision === 'block') {
    return 'The proposed consequence is blocked before downstream execution.';
  }
  if (evaluation.effectiveDecision === 'narrow') {
    return 'The proposed consequence may proceed only through the returned constraints.';
  }
  return 'The proposed consequence passed the generic admission mode ladder.';
}

function genericAdmissionConstraints(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionConstraint[] {
  if (evaluation.effectiveDecision !== 'narrow') return Object.freeze([]);
  const scopeConstraints =
    evaluation.scopeExplosionGuardDecision?.constraints.map((constraint) => Object.freeze({
      id: `constraint:${input.domain}:scope:${constraint.dimension}`,
      kind: inferConstraintKind(`${constraint.dimension}:${constraint.reasonCode}`),
      summary: constraint.safeSummary,
      enforcedBy: input.downstreamSystem,
      parameterDigest: constraint.constraintDigest,
    })) ?? [];
  if (scopeConstraints.length > 0) return Object.freeze(scopeConstraints);
  return Object.freeze([
    {
      id: `constraint:${input.domain}:generic-narrow`,
      kind: 'customer-approved-scope',
      summary: 'Proceed only with the customer-approved narrowed scope.',
      enforcedBy: input.downstreamSystem,
      parameterDigest: null,
    },
  ]);
}

function genericAdmissionProof(
  request: ConsequenceAdmissionRequest,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionProofRef[] {
  if (evaluation.effectiveDecision !== 'admit' && evaluation.effectiveDecision !== 'narrow') {
    return Object.freeze([]);
  }
  return Object.freeze([
    {
      kind: 'admission-receipt',
      id: `generic-admission:${request.requestId}`,
      digest: request.requestId,
      uri: null,
      verifyHint:
        evaluation.mode === 'observe' || evaluation.mode === 'warn'
          ? 'Observe and warn modes are adoption modes; inspect shadowDecision before promoting to review or enforce.'
          : 'Verify the admission digest and downstream enforcement contract before execution.',
    },
  ]);
}

function genericAdmissionSummary(input: CreateGenericAdmissionInput): string {
  return input.summary ?? `${input.actor} proposes ${input.action} on ${input.downstreamSystem}.`;
}

function genericAdmissionDimensions(
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

export function createGenericAdmissionEnvelope(input: unknown): GenericAdmissionEnvelope {
  const normalized = normalizeCreateGenericAdmissionInput(input);
  const evaluation = createGenericAdmissionEvaluation(normalized);
  const profile = consequenceAdmissionDomainProfile(normalized.domain);
  const requestedAt = normalized.requestedAt ?? new Date().toISOString();
  const decidedAt = normalized.decidedAt ?? requestedAt;
  const request = createConsequenceAdmissionRequest({
    requestedAt,
    requestId: normalized.requestId,
    packFamily: 'general',
    entryPoint: {
      kind: 'hosted-route',
      id: 'generic-admission-api',
      route: '/api/v1/admissions',
      packageSubpath: null,
      sourceRef: 'src/service/http/routes/generic-admission-routes.ts',
    },
    proposedConsequence: {
      actor: normalized.actor,
      action: normalized.action,
      downstreamSystem: normalized.downstreamSystem,
      consequenceKind: profile.defaultConsequenceKinds[0] ?? 'custom',
      riskClass: profile.minimumRiskClass,
      summary: genericAdmissionSummary(normalized),
    },
    policyScope: {
      policyRef: normalized.policyRef,
      tenantId: normalized.tenantId,
      environment: normalized.environment,
      dimensions: genericAdmissionDimensions(normalized, evaluation),
    },
    authority: {
      actorRef: normalized.actorRef ?? normalized.actor,
      reviewerRef: normalized.reviewerRef,
      signerRef: normalized.signerRef,
      delegationRef: normalized.delegationRef,
      authorityMode: normalized.authorityMode,
    },
    evidence: (normalized.evidenceRefs ?? []).map((ref) => ({
      id: ref,
      kind: 'reference',
      digest: null,
      uri: null,
    })),
    nativeInputRefs: normalized.nativeInputRefs,
    retryAttempt: normalized.retryAttempt,
  });
  const response = createConsequenceAdmissionResponse({
    request,
    decidedAt,
    decision: evaluation.effectiveDecision,
    reason: genericAdmissionReason(evaluation),
    reasonCodes: evaluation.reasonCodes,
    checks: createGenericAdmissionChecks(normalized, evaluation),
    constraints: genericAdmissionConstraints(normalized, evaluation),
    proof: genericAdmissionProof(request, evaluation),
    operationalContext: {
      mode: evaluation.mode,
      shadowDecision: evaluation.shadowDecision,
      downstreamPosture: evaluation.downstreamPosture,
      enforcementActive: evaluation.enforcementActive,
      modeBlocksDownstream:
        evaluation.downstreamPosture === 'hold-for-review' ||
        evaluation.effectiveDecision === 'block',
      consequenceDomain: normalized.domain,
      taxonomyRiskClass: profile.minimumRiskClass,
      nonEnforcingMode: normalized.mode === 'observe' || normalized.mode === 'warn',
    },
  });

  return Object.freeze({
    mode: evaluation.mode,
    shadowDecision: evaluation.shadowDecision,
    downstreamPosture: evaluation.downstreamPosture,
    enforcementActive: evaluation.enforcementActive,
    admission: response,
  });
}
