import { createConsequenceAdmissionCheck, type ConsequenceAdmissionCheck, type ConsequenceAdmissionCheckKind, type ConsequenceAdmissionCheckOutcome, type ConsequenceAdmissionRequest } from './index.js';
import { evaluateConsequenceApprovalProvenance, type ConsequenceApprovalProvenanceClaim, type ConsequenceApprovalProvenanceDecision } from './approval-provenance-guard.js';
import { evaluateConsequenceAgenticSupplyChain, type ConsequenceAgenticSupplyChainDecision } from './agentic-supply-chain-guard.js';
import type { GenericAdmissionAgenticSupplyChain, GenericAdmissionDecisionContextDrift, GenericAdmissionGuardInputKind, GenericAdmissionGuardInputProvenanceDecision, GenericAdmissionGuardInputProvenanceRecord, GenericAdmissionHumanReviewFatigue, GenericAdmissionMultiAgentDelegation, GenericAdmissionScopeInput, GenericAdmissionStaleAuthorityPolicy } from './contracts.js';
import { evaluateConsequenceDecisionContextDrift, type ConsequenceDecisionContextDriftDecision } from './decision-context-drift-binding.js';
import { evaluateGenericAdmissionGuardInputProvenance } from './guard-input-provenance.js';
import { evaluateConsequenceHumanReviewFatigue, type ConsequenceHumanReviewFatigueDecision } from './human-review-fatigue-guard.js';
import { evaluateConsequenceMultiAgentDelegation, type ConsequenceMultiAgentDelegationDecision } from './multi-agent-delegation-guard.js';
import { evaluateConsequenceNoGoConditionLedger, type ConsequenceNoGoConditionLedgerDecision } from './no-go-condition-ledger.js';
import { evaluateConsequenceScopeExplosion, type ConsequenceScopeExplosionDecision } from './scope-explosion-guard.js';
import { evaluateConsequenceStaleAuthorityPolicy, type ConsequenceStaleAuthorityPolicyDecision } from './stale-authority-policy-guard.js';
import { evaluateConsequenceToolResultPoisoning, type ConsequenceToolResultClaim, type ConsequenceToolResultEvidenceClass, type ConsequenceToolResultPoisoningDecision } from './tool-result-poisoning-guard.js';
import { evaluateConsequenceUntrustedContentAuthority, type ConsequenceUntrustedContentAuthorityDecision, type ConsequenceUntrustedContentAuthoritySource } from './untrusted-content-authority-guard.js';
import type { FinancePipelineAdmissionTrustGuardInput } from './finance-types.js';

export function financeAuthorityGuardDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly authoritySources?: readonly ConsequenceUntrustedContentAuthoritySource[];
}): ConsequenceUntrustedContentAuthorityDecision | null {
  const authoritySources = input.authoritySources ?? [];
  if (authoritySources.length === 0) return null;
  return evaluateConsequenceUntrustedContentAuthority({
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
    requiredAuthority: true,
    sources: authoritySources,
  });
}

export function financeApprovalGuardDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly authoritySources?: readonly ConsequenceUntrustedContentAuthoritySource[];
  readonly approvals?: readonly ConsequenceApprovalProvenanceClaim[];
}): ConsequenceApprovalProvenanceDecision | null {
  const approvals = input.approvals ?? [];
  const approvalClaimPresent = (input.authoritySources ?? [])
    .some((source) => source.claimKind === 'approval');
  if (approvals.length === 0 && !approvalClaimPresent) return null;
  return evaluateConsequenceApprovalProvenance({
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
    approvals,
  });
}

export function financeToolResultGuardDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly allowedToolResultEvidenceClasses?:
    readonly ConsequenceToolResultEvidenceClass[] | null;
  readonly toolResults?: readonly ConsequenceToolResultClaim[] | null;
}): ConsequenceToolResultPoisoningDecision | null {
  const hasInput =
    (input.allowedToolResultEvidenceClasses !== null &&
      input.allowedToolResultEvidenceClasses !== undefined) ||
    (input.toolResults !== null &&
      input.toolResults !== undefined);
  if (!hasInput) return null;
  return evaluateConsequenceToolResultPoisoning({
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
    allowedEvidenceClasses: input.allowedToolResultEvidenceClasses ?? null,
    toolResults: input.toolResults ?? null,
  });
}

export function financeScopeExplosionGuardDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly scopeOwnerPolicyRef?: string | null;
  readonly requestedScope?: GenericAdmissionScopeInput | null;
  readonly approvedScope?: GenericAdmissionScopeInput | null;
}): ConsequenceScopeExplosionDecision | null {
  const hasInput =
    (input.scopeOwnerPolicyRef !== null && input.scopeOwnerPolicyRef !== undefined) ||
    (input.requestedScope !== null && input.requestedScope !== undefined) ||
    (input.approvedScope !== null && input.approvedScope !== undefined);
  if (!hasInput) return null;
  return evaluateConsequenceScopeExplosion({
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
    scopeOwnerPolicyRef: input.scopeOwnerPolicyRef ?? null,
    requestedScope: input.requestedScope ?? null,
    approvedScope: input.approvedScope ?? null,
  });
}

export function financeAgenticSupplyChainGuardDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly agenticSupplyChain?: GenericAdmissionAgenticSupplyChain | null;
}): ConsequenceAgenticSupplyChainDecision | null {
  if (input.agenticSupplyChain === null || input.agenticSupplyChain === undefined) return null;
  return evaluateConsequenceAgenticSupplyChain({
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
    components: input.agenticSupplyChain.components,
  });
}

export function financeHumanReviewFatigueGuardDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly humanReviewFatigue?: GenericAdmissionHumanReviewFatigue | null;
}): ConsequenceHumanReviewFatigueDecision | null {
  if (input.humanReviewFatigue === null || input.humanReviewFatigue === undefined) return null;
  return evaluateConsequenceHumanReviewFatigue({
    ...input.humanReviewFatigue,
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
  });
}

export function financeMultiAgentDelegationGuardDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly multiAgentDelegation?: GenericAdmissionMultiAgentDelegation | null;
}): ConsequenceMultiAgentDelegationDecision | null {
  if (input.multiAgentDelegation === null || input.multiAgentDelegation === undefined) {
    return null;
  }
  return evaluateConsequenceMultiAgentDelegation({
    ...input.multiAgentDelegation,
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
  });
}

export function financeStaleAuthorityPolicyGuardDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly staleAuthorityPolicy?: GenericAdmissionStaleAuthorityPolicy | null;
}): ConsequenceStaleAuthorityPolicyDecision | null {
  if (input.staleAuthorityPolicy === null || input.staleAuthorityPolicy === undefined) {
    return null;
  }
  return evaluateConsequenceStaleAuthorityPolicy({
    ...input.staleAuthorityPolicy,
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
  });
}

export function financeDecisionContextDriftDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly decisionContextDrift?: GenericAdmissionDecisionContextDrift | null;
}): ConsequenceDecisionContextDriftDecision | null {
  if (input.decisionContextDrift === null || input.decisionContextDrift === undefined) {
    return null;
  }
  return evaluateConsequenceDecisionContextDrift({
    ...input.decisionContextDrift,
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
  });
}

export function financeHasNoGoInput(input: FinancePipelineAdmissionTrustGuardInput): boolean {
  return input.noGoLedgerRef !== null && input.noGoLedgerRef !== undefined ||
    input.noGoConditions !== null && input.noGoConditions !== undefined ||
    input.noGoNaturalLanguageBypassAttempted === true ||
    (input.noGoNaturalLanguageSignals ?? []).length > 0 ||
    input.noGoBypassAttemptRef !== null && input.noGoBypassAttemptRef !== undefined;
}

export function financeNoGoConditionLedgerDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
} & FinancePipelineAdmissionTrustGuardInput): ConsequenceNoGoConditionLedgerDecision | null {
  if (!financeHasNoGoInput(input)) return null;
  return evaluateConsequenceNoGoConditionLedger({
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
    ledgerRef: input.noGoLedgerRef ?? null,
    conditions: input.noGoConditions ?? null,
    naturalLanguageBypassAttempted: input.noGoNaturalLanguageBypassAttempted ?? null,
    naturalLanguageSignals: input.noGoNaturalLanguageSignals ?? [],
    bypassAttemptRef: input.noGoBypassAttemptRef ?? null,
  });
}

export function financeGuardInputProvenanceDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly guardInputProvenance?:
    readonly GenericAdmissionGuardInputProvenanceRecord[];
  readonly requiredGuardInputProvenance?:
    readonly GenericAdmissionGuardInputKind[];
}): GenericAdmissionGuardInputProvenanceDecision | null {
  const records = input.guardInputProvenance ?? [];
  const requiredGuardKinds = input.requiredGuardInputProvenance ?? [];
  if (records.length === 0 && requiredGuardKinds.length === 0) return null;
  return evaluateGenericAdmissionGuardInputProvenance({
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
    records,
    requiredGuardKinds,
  });
}

export function financeGuardOutcome(
  outcome: 'pass' | 'review' | 'block' | 'narrow',
): ConsequenceAdmissionCheckOutcome {
  if (outcome === 'pass') return 'pass';
  if (outcome === 'block') return 'fail';
  return 'warn';
}

export function addFinanceGuardCheck(
  checks: ConsequenceAdmissionCheck[],
  input: {
    readonly kind: ConsequenceAdmissionCheckKind;
    readonly label: string;
    readonly outcome: 'pass' | 'review' | 'block' | 'narrow';
    readonly passSummary: string;
    readonly holdSummary: string;
    readonly reasonCodes: readonly string[];
    readonly digest: string;
  },
): void {
  checks.push(createConsequenceAdmissionCheck({
    kind: input.kind,
    label: input.label,
    outcome: financeGuardOutcome(input.outcome),
    required: true,
    summary: input.outcome === 'pass' ? input.passSummary : input.holdSummary,
    reasonCodes: input.reasonCodes,
    evidenceRefs: [input.digest],
  }));
}

export function buildFinanceTrustGuardChecks(input: {
  readonly authorityGuardDecision: ConsequenceUntrustedContentAuthorityDecision | null;
  readonly approvalGuardDecision: ConsequenceApprovalProvenanceDecision | null;
  readonly scopeExplosionGuardDecision: ConsequenceScopeExplosionDecision | null;
  readonly toolResultGuardDecision: ConsequenceToolResultPoisoningDecision | null;
  readonly agenticSupplyChainGuardDecision: ConsequenceAgenticSupplyChainDecision | null;
  readonly humanReviewFatigueGuardDecision: ConsequenceHumanReviewFatigueDecision | null;
  readonly multiAgentDelegationGuardDecision: ConsequenceMultiAgentDelegationDecision | null;
  readonly staleAuthorityPolicyGuardDecision: ConsequenceStaleAuthorityPolicyDecision | null;
  readonly decisionContextDriftDecision: ConsequenceDecisionContextDriftDecision | null;
  readonly noGoConditionLedgerDecision: ConsequenceNoGoConditionLedgerDecision | null;
  readonly guardInputProvenanceDecision: GenericAdmissionGuardInputProvenanceDecision | null;
}): readonly ConsequenceAdmissionCheck[] {
  const checks: ConsequenceAdmissionCheck[] = [];

  if (input.authorityGuardDecision !== null) {
    addFinanceGuardCheck(checks, {
      kind: 'authority',
      label: 'Finance authority-source guard',
      outcome: input.authorityGuardDecision.outcome,
      passSummary: 'Structured finance authority sources passed the untrusted-content guard.',
      holdSummary:
        'Structured finance authority sources require review before downstream consequence.',
      reasonCodes: input.authorityGuardDecision.reasonCodes,
      digest: input.authorityGuardDecision.digest,
    });
  }

  if (input.approvalGuardDecision !== null) {
    addFinanceGuardCheck(checks, {
      kind: 'authority',
      label: 'Finance approval provenance guard',
      outcome: input.approvalGuardDecision.outcome,
      passSummary: 'Structured finance approvals passed provenance checks.',
      holdSummary: 'Structured finance approvals require review before downstream consequence.',
      reasonCodes: input.approvalGuardDecision.reasonCodes,
      digest: input.approvalGuardDecision.digest,
    });
  }

  if (input.scopeExplosionGuardDecision !== null) {
    addFinanceGuardCheck(checks, {
      kind: 'authority',
      label: 'Finance scope guard',
      outcome: input.scopeExplosionGuardDecision.outcome,
      passSummary: 'Structured finance scope metadata stayed within the approved boundary.',
      holdSummary: 'Structured finance scope metadata requires narrowing or review.',
      reasonCodes: input.scopeExplosionGuardDecision.reasonCodes,
      digest: input.scopeExplosionGuardDecision.digest,
    });
  }

  if (input.toolResultGuardDecision !== null) {
    addFinanceGuardCheck(checks, {
      kind: 'evidence',
      label: 'Finance tool-result guard',
      outcome: input.toolResultGuardDecision.outcome,
      passSummary: 'Structured finance tool-result evidence passed poisoning checks.',
      holdSummary:
        'Structured finance tool-result evidence requires review before downstream consequence.',
      reasonCodes: input.toolResultGuardDecision.reasonCodes,
      digest: input.toolResultGuardDecision.digest,
    });
  }

  if (input.agenticSupplyChainGuardDecision !== null) {
    addFinanceGuardCheck(checks, {
      kind: 'evidence',
      label: 'Finance supply-chain guard',
      outcome: input.agenticSupplyChainGuardDecision.outcome,
      passSummary: 'Structured finance supply-chain metadata passed guard checks.',
      holdSummary: 'Structured finance supply-chain metadata requires review.',
      reasonCodes: input.agenticSupplyChainGuardDecision.reasonCodes,
      digest: input.agenticSupplyChainGuardDecision.digest,
    });
  }

  if (input.humanReviewFatigueGuardDecision !== null) {
    addFinanceGuardCheck(checks, {
      kind: 'evidence',
      label: 'Finance human-review guard',
      outcome: input.humanReviewFatigueGuardDecision.outcome,
      passSummary: 'Structured finance review metadata passed reviewer-safety checks.',
      holdSummary: 'Structured finance review metadata requires review before promotion.',
      reasonCodes: input.humanReviewFatigueGuardDecision.reasonCodes,
      digest: input.humanReviewFatigueGuardDecision.digest,
    });
  }

  if (input.multiAgentDelegationGuardDecision !== null) {
    addFinanceGuardCheck(checks, {
      kind: 'authority',
      label: 'Finance delegation guard',
      outcome: input.multiAgentDelegationGuardDecision.outcome,
      passSummary: 'Structured finance delegation metadata passed guard checks.',
      holdSummary: 'Structured finance delegation metadata requires review.',
      reasonCodes: input.multiAgentDelegationGuardDecision.reasonCodes,
      digest: input.multiAgentDelegationGuardDecision.digest,
    });
  }

  if (input.staleAuthorityPolicyGuardDecision !== null) {
    addFinanceGuardCheck(checks, {
      kind: 'policy',
      label: 'Finance stale-policy guard',
      outcome: input.staleAuthorityPolicyGuardDecision.outcome,
      passSummary: 'Structured finance policy and authority freshness metadata passed.',
      holdSummary: 'Structured finance policy or authority freshness requires review.',
      reasonCodes: input.staleAuthorityPolicyGuardDecision.reasonCodes,
      digest: input.staleAuthorityPolicyGuardDecision.digest,
    });
  }

  if (input.decisionContextDriftDecision !== null) {
    addFinanceGuardCheck(checks, {
      kind: 'freshness',
      label: 'Finance decision-context guard',
      outcome: input.decisionContextDriftDecision.outcome,
      passSummary: 'Structured finance decision context stayed bound to current metadata.',
      holdSummary: 'Structured finance decision context requires review.',
      reasonCodes: input.decisionContextDriftDecision.reasonCodes,
      digest: input.decisionContextDriftDecision.digest,
    });
  }

  if (input.noGoConditionLedgerDecision !== null) {
    addFinanceGuardCheck(checks, {
      kind: 'policy',
      label: 'Finance no-go ledger guard',
      outcome: input.noGoConditionLedgerDecision.outcome,
      passSummary: 'Structured finance no-go ledger metadata passed guard checks.',
      holdSummary: 'Structured finance no-go ledger metadata requires review or block.',
      reasonCodes: input.noGoConditionLedgerDecision.reasonCodes,
      digest: input.noGoConditionLedgerDecision.digest,
    });
  }

  if (input.guardInputProvenanceDecision !== null) {
    addFinanceGuardCheck(checks, {
      kind: 'authority',
      label: 'Finance guard-input provenance guard',
      outcome: input.guardInputProvenanceDecision.outcome,
      passSummary: 'Structured finance guard-input provenance passed guard checks.',
      holdSummary: 'Structured finance guard-input provenance requires review or block.',
      reasonCodes: input.guardInputProvenanceDecision.reasonCodes,
      digest: input.guardInputProvenanceDecision.digest,
    });
  }

  return Object.freeze(checks);
}
