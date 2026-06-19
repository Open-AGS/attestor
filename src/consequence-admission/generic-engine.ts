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
  type ConsequenceAdmissionDecision,
  type CreateGenericAdmissionInput,
  type GenericAdmissionDownstreamPosture,
  type GenericAdmissionEnvelope,
  type GenericAdmissionGuardInputProvenanceDecision,
  type GenericAdmissionMode,
  type GenericAdmissionModeEvaluation,
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
  createGenericAdmissionChecks,
  genericAdmissionConstraints,
  genericAdmissionProof,
  genericAdmissionReason,
} from './generic-engine-checks.js';
import {
  genericAdmissionDimensions,
  genericAdmissionSummary,
  observedFeatureTrue,
} from './generic-engine-dimensions.js';
import {
  effectiveDecisionForGenericAdmissionMode,
  genericAdmissionHardInvariantReasonCodes,
  genericAdmissionHasHardBlockFeature,
  genericAdmissionHasNarrowFeature,
  reduceGenericAdmissionShadowDecision,
} from './generic-hard-invariants.js';
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
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
} from './builders.js';
import {
  canonicalObject,
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
  reasons.push(...genericAdmissionHardInvariantReasonCodes(input));
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
  return reduceGenericAdmissionShadowDecision({
    reviewReasons,
    blockingGuardOutcomes: [
      authorityGuardDecision?.outcome === 'block',
      approvalGuardDecision?.outcome === 'block',
      scopeExplosionGuardDecision?.outcome === 'block',
      toolResultGuardDecision?.outcome === 'block',
      agenticSupplyChainGuardDecision?.outcome === 'block',
      humanReviewFatigueGuardDecision?.outcome === 'block',
      multiAgentDelegationGuardDecision?.outcome === 'block',
      staleAuthorityPolicyGuardDecision?.outcome === 'block',
      decisionContextDriftDecision?.outcome === 'block',
      authorityCreepGuardDecision?.outcome === 'authority-creep-rejected-boundary',
      noGoConditionLedgerDecision?.outcome === 'block',
      guardInputProvenanceDecision?.outcome === 'block',
      genericAdmissionHasHardBlockFeature(input),
    ],
    narrowingGuardOutcomes: [
      scopeExplosionGuardDecision?.outcome === 'narrow',
      genericAdmissionHasNarrowFeature(input),
    ],
  });
}

function effectiveDecisionForGenericMode(
  mode: GenericAdmissionMode,
  shadowDecision: GenericAdmissionShadowDecision,
): ConsequenceAdmissionDecision {
  return effectiveDecisionForGenericAdmissionMode(mode, shadowDecision);
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
