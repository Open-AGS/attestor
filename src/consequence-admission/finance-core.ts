import { createConsequenceAdmissionRequest, createConsequenceAdmissionResponse, mapFinancePipelineDecisionToAdmission, type ConsequenceAdmissionRequest, type ConsequenceAdmissionResponse } from './index.js';
import { buildFinanceChecks, defaultNarrowConstraints, effectiveFinanceDecision, failedRequiredChecks, financeBlockGuardHoldChecks, financeReviewGuardHoldChecks, financeScopeConstraints, financeScopeNarrowHoldChecks, financeTrustGuardHoldChecks, financeTrustGuardReasonCodes, nativeDecisionForEffectiveDecision, uniqueChecksByLabel } from './finance-checks.js';
import { financeAgenticSupplyChainGuardDecisionFor, financeApprovalGuardDecisionFor, financeAuthorityGuardDecisionFor, financeDecisionContextDriftDecisionFor, financeGuardInputProvenanceDecisionFor, financeHumanReviewFatigueGuardDecisionFor, financeMultiAgentDelegationGuardDecisionFor, financeNoGoConditionLedgerDecisionFor, financeScopeExplosionGuardDecisionFor, financeStaleAuthorityPolicyGuardDecisionFor, financeToolResultGuardDecisionFor, buildFinanceTrustGuardChecks } from './finance-guards.js';
import { buildProofRefs, normalizeReleaseStatus } from './finance-proof.js';
import { boolOrNull, contextWithoutUndefined, numberOrNull, textOrNull } from './finance-utils.js';
import { FINANCE_PIPELINE_ADMISSION_ENTRY_POINT_ID, FINANCE_PIPELINE_ADMISSION_ROUTE, FINANCE_PIPELINE_ADMISSION_SOURCE_REF, type CreateFinancePipelineAdmissionResponseInput, type FinancePipelineAdmissionRequestInput } from './finance-types.js';

export function createFinancePipelineAdmissionRequest(
  input: FinancePipelineAdmissionRequestInput,
): ConsequenceAdmissionRequest {
  return createConsequenceAdmissionRequest({
    requestedAt: input.requestedAt,
    requestId: input.requestId,
    packFamily: 'finance',
    entryPoint: {
      kind: 'hosted-route',
      id: FINANCE_PIPELINE_ADMISSION_ENTRY_POINT_ID,
      route: FINANCE_PIPELINE_ADMISSION_ROUTE,
      packageSubpath: null,
      sourceRef: FINANCE_PIPELINE_ADMISSION_SOURCE_REF,
    },
    proposedConsequence: {
      actor: textOrNull(input.actor) ?? 'AI-assisted finance workflow',
      action: textOrNull(input.action) ?? 'evaluate a finance consequence before release',
      downstreamSystem: textOrNull(input.downstreamSystem) ?? 'customer finance workflow',
      consequenceKind: input.consequenceKind ?? 'record',
      riskClass: input.riskClass ?? 'R4',
      summary:
        textOrNull(input.summary) ??
        'Finance workflow asks Attestor whether a proposed record, filing, communication, or action may proceed.',
    },
    policyScope: {
      policyRef: input.policyRef ?? 'policy:finance:hosted-proof-wedge',
      tenantId: input.tenantId ?? null,
      environment: input.environment ?? null,
      dimensions: {
        domain: 'finance',
        route: FINANCE_PIPELINE_ADMISSION_ROUTE,
        ...(input.runId ? { runId: input.runId } : {}),
        ...(input.dimensions ?? {}),
      },
    },
    authority: {
      actorRef: input.actorRef ?? null,
      reviewerRef: input.reviewerRef ?? null,
      signerRef: input.signerRef ?? null,
      delegationRef: input.delegationRef ?? null,
      authorityMode: input.authorityMode ?? null,
    },
    evidence: input.evidence,
    nativeInputRefs: input.nativeInputRefs ?? ['candidateSql', 'intent', 'fixtures', 'sign'],
  });
}

export function createFinancePipelineAdmissionResponse(
  input: CreateFinancePipelineAdmissionResponseInput,
): ConsequenceAdmissionResponse {
  const request =
    input.request ??
    createFinancePipelineAdmissionRequest({
      requestedAt: input.decidedAt,
      runId: input.run.runId,
      tenantId: input.run.tenantContext?.tenantId ?? null,
      environment: input.run.tenantContext?.source ?? null,
    });
  const native = normalizeReleaseStatus(input.run);
  const nativeDecision = mapFinancePipelineDecisionToAdmission(native.value);
  const proof = buildProofRefs(input.run);
  const financeChecks = buildFinanceChecks({
    run: input.run,
    request,
    decidedAt: input.decidedAt,
    proof,
    nativeDecisionSource: native.source,
    filingRelease: native.filingRelease,
  });
  const authorityGuardDecision = financeAuthorityGuardDecisionFor({
    request,
    decidedAt: input.decidedAt,
    authoritySources: input.authoritySources,
  });
  const approvalGuardDecision = financeApprovalGuardDecisionFor({
    request,
    decidedAt: input.decidedAt,
    authoritySources: input.authoritySources,
    approvals: input.approvals,
  });
  const toolResultGuardDecision = financeToolResultGuardDecisionFor({
    request,
    decidedAt: input.decidedAt,
    allowedToolResultEvidenceClasses: input.allowedToolResultEvidenceClasses,
    toolResults: input.toolResults,
  });
  const scopeExplosionGuardDecision = financeScopeExplosionGuardDecisionFor({
    request,
    decidedAt: input.decidedAt,
    scopeOwnerPolicyRef: input.scopeOwnerPolicyRef,
    requestedScope: input.requestedScope,
    approvedScope: input.approvedScope,
  });
  const agenticSupplyChainGuardDecision = financeAgenticSupplyChainGuardDecisionFor({
    request,
    decidedAt: input.decidedAt,
    agenticSupplyChain: input.agenticSupplyChain,
  });
  const humanReviewFatigueGuardDecision = financeHumanReviewFatigueGuardDecisionFor({
    request,
    decidedAt: input.decidedAt,
    humanReviewFatigue: input.humanReviewFatigue,
  });
  const multiAgentDelegationGuardDecision = financeMultiAgentDelegationGuardDecisionFor({
    request,
    decidedAt: input.decidedAt,
    multiAgentDelegation: input.multiAgentDelegation,
  });
  const staleAuthorityPolicyGuardDecision = financeStaleAuthorityPolicyGuardDecisionFor({
    request,
    decidedAt: input.decidedAt,
    staleAuthorityPolicy: input.staleAuthorityPolicy,
  });
  const decisionContextDriftDecision = financeDecisionContextDriftDecisionFor({
    request,
    decidedAt: input.decidedAt,
    decisionContextDrift: input.decisionContextDrift,
  });
  const noGoConditionLedgerDecision = financeNoGoConditionLedgerDecisionFor({
    request,
    decidedAt: input.decidedAt,
    noGoLedgerRef: input.noGoLedgerRef,
    noGoConditions: input.noGoConditions,
    noGoNaturalLanguageBypassAttempted: input.noGoNaturalLanguageBypassAttempted,
    noGoNaturalLanguageSignals: input.noGoNaturalLanguageSignals,
    noGoBypassAttemptRef: input.noGoBypassAttemptRef,
  });
  const guardInputProvenanceDecision = financeGuardInputProvenanceDecisionFor({
    request,
    decidedAt: input.decidedAt,
    guardInputProvenance: input.guardInputProvenance,
    requiredGuardInputProvenance: input.requiredGuardInputProvenance,
  });
  const guardChecks = buildFinanceTrustGuardChecks({
    authorityGuardDecision,
    approvalGuardDecision,
    scopeExplosionGuardDecision,
    toolResultGuardDecision,
    agenticSupplyChainGuardDecision,
    humanReviewFatigueGuardDecision,
    multiAgentDelegationGuardDecision,
    staleAuthorityPolicyGuardDecision,
    decisionContextDriftDecision,
    noGoConditionLedgerDecision,
    guardInputProvenanceDecision,
  });
  const checks = Object.freeze([...financeChecks, ...guardChecks]);
  const requiredFailures = failedRequiredChecks(financeChecks);
  const trustGuardHolds = financeTrustGuardHoldChecks(guardChecks);
  const guardBlockHolds = financeBlockGuardHoldChecks(guardChecks);
  const reviewGuardHolds = financeReviewGuardHoldChecks(guardChecks);
  const scopeNarrowHolds = financeScopeNarrowHoldChecks(guardChecks);
  const trustGuardReasons = financeTrustGuardReasonCodes(trustGuardHolds);
  const holdChecks = uniqueChecksByLabel([...requiredFailures, ...trustGuardHolds]);
  const decision = effectiveFinanceDecision(
    nativeDecision,
    requiredFailures,
    guardBlockHolds,
    reviewGuardHolds,
    scopeNarrowHolds,
  );
  const effectiveNativeDecision = nativeDecisionForEffectiveDecision({
    nativeDecision,
    decision,
    holdChecks,
  });
  const scopeConstraints = financeScopeConstraints(scopeExplosionGuardDecision);
  const constraints =
    decision === 'narrow'
      ? input.constraints?.length
        ? input.constraints
        : scopeConstraints.length > 0
          ? scopeConstraints
          : defaultNarrowConstraints()
      : input.constraints ?? [];
  const nativeDecisionPhrase =
    native.source === 'release.filingExport.decisionStatus'
      ? `Finance filing release status ${native.value}`
      : `Finance pipeline decision ${native.value}`;
  const reason =
    guardBlockHolds.length > 0 && decision !== nativeDecision.mappedDecision
      ? `${nativeDecisionPhrase} maps to native ${nativeDecision.mappedDecision}, but structured finance guards blocked so canonical admission is block.`
      : requiredFailures.length > 0 && decision !== nativeDecision.mappedDecision
      ? `${nativeDecisionPhrase} maps to native ${nativeDecision.mappedDecision}, but required checks failed so canonical admission is review.`
      : scopeNarrowHolds.length > 0 && decision !== nativeDecision.mappedDecision
        ? `${nativeDecisionPhrase} maps to native ${nativeDecision.mappedDecision}, but structured finance scope requires narrowing so canonical admission is narrow.`
      : `${nativeDecisionPhrase} maps to canonical ${decision}.`;
  const reasonCodes = [
    `finance-${native.source === 'decision' ? 'pipeline' : 'release'}-${decision}`,
    `finance-native-${native.value.toLowerCase()}`,
    ...(requiredFailures.length > 0 ? ['finance-required-check-failed'] : []),
    ...(trustGuardHolds.length > 0 ? ['finance-trust-guard-held'] : []),
    ...(guardBlockHolds.length > 0 ? ['finance-trust-guard-blocked'] : []),
    ...trustGuardReasons,
  ];

  return createConsequenceAdmissionResponse({
    request,
    decidedAt: input.decidedAt,
    decision,
    reason,
    reasonCodes,
    checks,
    constraints,
    nativeDecision: effectiveNativeDecision,
    proof,
    operationalContext: contextWithoutUndefined({
      tenantId: input.run.tenantContext?.tenantId ?? null,
      tenantSource: input.run.tenantContext?.source ?? null,
      planId: input.run.tenantContext?.planId ?? null,
      proofMode: input.run.proofMode ?? null,
      signingMode: input.run.signingMode ?? null,
      identitySource: input.run.identitySource ?? null,
      reviewerName: input.run.reviewerName ?? null,
      auditChainIntact: boolOrNull(input.run.auditChainIntact),
      usageUsed: numberOrNull(input.run.usage?.used),
      usageRemaining: numberOrNull(input.run.usage?.remaining),
      usageQuota: numberOrNull(input.run.usage?.quota),
      usageEnforced: boolOrNull(input.run.usage?.enforced),
      rateLimitRemaining: numberOrNull(input.run.rateLimit?.remaining),
      rateLimitEnforced: boolOrNull(input.run.rateLimit?.enforced),
      releaseDecisionId: native.filingRelease?.decisionId ?? null,
      releasePolicyVersion: native.filingRelease?.policyVersion ?? null,
      releaseIntrospectionRequired: boolOrNull(native.filingRelease?.introspectionRequired),
      authorityGuardOutcome: authorityGuardDecision?.outcome ?? null,
      approvalGuardOutcome: approvalGuardDecision?.outcome ?? null,
      scopeExplosionGuardOutcome: scopeExplosionGuardDecision?.outcome ?? null,
      toolResultGuardOutcome: toolResultGuardDecision?.outcome ?? null,
      agenticSupplyChainGuardOutcome: agenticSupplyChainGuardDecision?.outcome ?? null,
      humanReviewFatigueGuardOutcome: humanReviewFatigueGuardDecision?.outcome ?? null,
      multiAgentDelegationGuardOutcome: multiAgentDelegationGuardDecision?.outcome ?? null,
      staleAuthorityPolicyGuardOutcome: staleAuthorityPolicyGuardDecision?.outcome ?? null,
      decisionContextDriftOutcome: decisionContextDriftDecision?.outcome ?? null,
      noGoConditionOutcome: noGoConditionLedgerDecision?.outcome ?? null,
      guardInputProvenanceOutcome: guardInputProvenanceDecision?.outcome ?? null,
      ...(input.operationalContext ?? {}),
    }),
  });
}
