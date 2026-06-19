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
  type ConsequenceAdmissionCheck,
  type ConsequenceAdmissionCheckKind,
  type ConsequenceAdmissionCheckOutcome,
  type ConsequenceAdmissionConstraint,
  type ConsequenceAdmissionDecision,
  type ConsequenceAdmissionProofRef,
  type ConsequenceAdmissionRequest,
  type CreateGenericAdmissionInput,
  type GenericAdmissionMode,
  type GenericAdmissionModeEvaluation,
} from './contracts.js';
import {
  createConsequenceAdmissionCheck,
} from './builders.js';
import {
  inferConstraintKind,
} from './normalization.js';
import {
  consequenceAdmissionDomainProfile,
} from './taxonomy.js';

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

export function createGenericAdmissionChecks(
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

export function genericAdmissionReason(
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

export function genericAdmissionConstraints(
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

export function genericAdmissionProof(
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
