import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CreateGenericAdmissionInput,
  GenericAdmissionModeEvaluation,
} from './contracts.js';
import {
  genericAdmissionHardInvariantReasonCodes,
  genericAdmissionHasHardBlockFeature,
  genericAdmissionHasNarrowFeature,
} from './generic-hard-invariants.js';

export const GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_VERSION =
  'attestor.generic-admission-guard-outcome-trace.v1';

export const GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_GUARD_IDS = [
  'hard-invariant',
  'authority',
  'approval',
  'scope-explosion',
  'tool-result',
  'agentic-supply-chain',
  'human-review-fatigue',
  'multi-agent-delegation',
  'stale-authority-policy',
  'decision-context-drift',
  'authority-creep',
  'no-go-condition',
  'guard-input-provenance',
] as const;
export type GenericAdmissionGuardOutcomeTraceGuardId =
  typeof GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_GUARD_IDS[number];

export const GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_EFFECTS = [
  'not-evaluated',
  'pass',
  'narrow',
  'review',
  'block',
] as const;
export type GenericAdmissionGuardOutcomeTraceEffect =
  typeof GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_EFFECTS[number];

export interface GenericAdmissionGuardOutcomeTraceEntry {
  readonly version: typeof GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_VERSION;
  readonly guardId: GenericAdmissionGuardOutcomeTraceGuardId;
  readonly outcome: string;
  readonly effect: GenericAdmissionGuardOutcomeTraceEffect;
  readonly reasonCodes: readonly string[];
  readonly decisionDigest: string | null;
  readonly rawPayloadStored: false;
}

type GuardDecision = {
  readonly outcome: string;
  readonly reasonCodes: readonly string[];
  readonly digest?: string | null;
};

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function readonlyReasonCodes(reasonCodes: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(reasonCodes)].sort());
}

function effectForOutcome(outcome: string): GenericAdmissionGuardOutcomeTraceEffect {
  if (outcome === 'pass' || outcome === 'authority-creep-evidence-ready') return 'pass';
  if (outcome === 'narrow') return 'narrow';
  if (outcome === 'block' || outcome === 'authority-creep-rejected-boundary') return 'block';
  return 'review';
}

function hardInvariantReasonCodes(input: CreateGenericAdmissionInput): readonly string[] {
  const reasonCodes = [...genericAdmissionHardInvariantReasonCodes(input)];
  if (input.observedFeatures?.policyBlocked === true) reasonCodes.push('policy-blocked');
  if (input.observedFeatures?.blocked === true) reasonCodes.push('feature-blocked');
  if (input.observedFeatures?.unsafe === true) reasonCodes.push('feature-unsafe');
  if (genericAdmissionHasNarrowFeature(input)) reasonCodes.push('narrow-required');
  return readonlyReasonCodes(reasonCodes);
}

function hardInvariantEntry(input: CreateGenericAdmissionInput): GenericAdmissionGuardOutcomeTraceEntry {
  const reasonCodes = hardInvariantReasonCodes(input);
  const effect: GenericAdmissionGuardOutcomeTraceEffect = genericAdmissionHasHardBlockFeature(input)
    ? 'block'
    : genericAdmissionHardInvariantReasonCodes(input).length > 0
      ? 'review'
      : genericAdmissionHasNarrowFeature(input)
        ? 'narrow'
        : 'pass';
  const decisionDigest = canonicalObject({
    version: GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_VERSION,
    guardId: 'hard-invariant',
    effect,
    reasonCodes,
  }).digest;
  return Object.freeze({
    version: GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_VERSION,
    guardId: 'hard-invariant',
    outcome: effect,
    effect,
    reasonCodes,
    decisionDigest,
    rawPayloadStored: false,
  });
}

function traceEntry(
  guardId: GenericAdmissionGuardOutcomeTraceGuardId,
  decision: GuardDecision | null,
): GenericAdmissionGuardOutcomeTraceEntry {
  if (decision === null) {
    return Object.freeze({
      version: GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_VERSION,
      guardId,
      outcome: 'not-evaluated',
      effect: 'not-evaluated',
      reasonCodes: Object.freeze([]),
      decisionDigest: null,
      rawPayloadStored: false,
    });
  }
  return Object.freeze({
    version: GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_VERSION,
    guardId,
    outcome: decision.outcome,
    effect: effectForOutcome(decision.outcome),
    reasonCodes: readonlyReasonCodes(decision.reasonCodes),
    decisionDigest: decision.digest ?? null,
    rawPayloadStored: false,
  });
}

export function createGenericAdmissionGuardOutcomeTrace(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): readonly GenericAdmissionGuardOutcomeTraceEntry[] {
  return Object.freeze([
    hardInvariantEntry(input),
    traceEntry('authority', evaluation.authorityGuardDecision),
    traceEntry('approval', evaluation.approvalGuardDecision),
    traceEntry('scope-explosion', evaluation.scopeExplosionGuardDecision),
    traceEntry('tool-result', evaluation.toolResultGuardDecision),
    traceEntry('agentic-supply-chain', evaluation.agenticSupplyChainGuardDecision),
    traceEntry('human-review-fatigue', evaluation.humanReviewFatigueGuardDecision),
    traceEntry('multi-agent-delegation', evaluation.multiAgentDelegationGuardDecision),
    traceEntry('stale-authority-policy', evaluation.staleAuthorityPolicyGuardDecision),
    traceEntry('decision-context-drift', evaluation.decisionContextDriftDecision),
    traceEntry('authority-creep', evaluation.authorityCreepGuardDecision),
    traceEntry('no-go-condition', evaluation.noGoConditionLedgerDecision),
    traceEntry('guard-input-provenance', evaluation.guardInputProvenanceDecision),
  ]);
}

export function normalizeGenericAdmissionGuardOutcomeTrace(
  entries: readonly GenericAdmissionGuardOutcomeTraceEntry[] | null | undefined,
): readonly GenericAdmissionGuardOutcomeTraceEntry[] {
  return Object.freeze((entries ?? []).map((entry) => Object.freeze({
    version: GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_VERSION,
    guardId: entry.guardId,
    outcome: entry.outcome,
    effect: entry.effect,
    reasonCodes: readonlyReasonCodes(entry.reasonCodes),
    decisionDigest: entry.decisionDigest,
    rawPayloadStored: false as const,
  })).sort((left, right) => {
    const leftIndex = GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_GUARD_IDS.indexOf(left.guardId);
    const rightIndex = GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_GUARD_IDS.indexOf(right.guardId);
    return leftIndex - rightIndex;
  }));
}
