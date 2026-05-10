import type {
  ReleaseActorReference,
  ReleaseDecision,
  ReleaseFinding,
  ReleasePolicyProvenance,
  ReleaseTargetReference,
} from './object-model.js';
import { createReleaseDecisionSkeleton } from './object-model.js';
import type {
  CompiledAdmissionPolicyIndex,
  CompiledAdmissionPolicyIndexEntry,
} from './compiled-policy-index.js';
import {
  COMPILED_ADMISSION_POLICY_INDEX_VERSION,
  createCompiledAdmissionPolicyIndex,
  resolveCompiledAdmissionPolicyIndexEntries,
  resolveCompiledAdmissionPolicyIndexEntry,
} from './compiled-policy-index.js';
import type { DeterministicCheckObservation } from './release-deterministic-checks.js';
import {
  applyDeterministicCheckReport,
  runDeterministicReleaseChecks,
} from './release-deterministic-checks.js';
import type {
  ReleaseDecisionLogPhase,
  ReleaseDecisionLogWriter,
} from './release-decision-log.js';
import type { DeterministicControlCategory } from './risk-controls.js';
import type { ReleasePolicyDefinition } from './release-policy.js';
import {
  createFirstHardGatewayReleasePolicy,
  matchesReleasePolicyScope,
} from './release-policy.js';
import {
  resolveReleasePolicyRollout,
  type ReleasePolicyRolloutEvaluationContext,
  type ReleasePolicyRolloutEvaluationMode,
  type ReleasePolicyRolloutMode,
  type ReleasePolicyRolloutResolution,
} from './release-policy-rollout.js';
import type { CapabilityBoundaryDescriptor, OutputContractDescriptor } from './types.js';

/**
 * Release decision engine skeleton.
 *
 * This is the first policy decision point for the release layer. It does not
 * execute deterministic checks yet; instead, it resolves the matching policy,
 * stamps an initial decision skeleton, and returns the next evaluation work
 * that later steps must complete.
 */

export const RELEASE_DECISION_ENGINE_SPEC_VERSION = 'attestor.release-decision-engine.v1';

export type ReleaseEvaluationPhase =
  | 'policy-resolution'
  | 'deterministic-checks'
  | 'review'
  | 'terminal-accept'
  | 'terminal-deny';

export interface ReleaseEvaluationScopeContext {
  readonly tenantId?: string | null;
  readonly accountId?: string | null;
  readonly planId?: string | null;
  readonly cohortId?: string | null;
}

export interface ReleaseEvaluationRequest {
  readonly id: string;
  readonly createdAt: string;
  readonly outputHash: string;
  readonly consequenceHash: string;
  readonly outputContract: OutputContractDescriptor;
  readonly capabilityBoundary: CapabilityBoundaryDescriptor;
  readonly requester: ReleaseActorReference;
  readonly target: ReleaseTargetReference;
  readonly context?: ReleaseEvaluationScopeContext;
}

export interface ReleaseEvaluationPlan {
  readonly phase: ReleaseEvaluationPhase;
  readonly pendingChecks: readonly DeterministicControlCategory[];
  readonly pendingEvidenceKinds: readonly string[];
  readonly requiresReview: boolean;
  readonly policyId: string | null;
  readonly effectivePolicyId: string | null;
  readonly rolloutMode: ReleasePolicyRolloutMode | null;
  readonly rolloutEvaluationMode: ReleasePolicyRolloutEvaluationMode | null;
  readonly rolloutReason: string | null;
  readonly rolloutCanaryBucket: number | null;
  readonly rolloutFallbackPolicyId: string | null;
}

export interface ReleaseEvaluationResult {
  readonly version: typeof RELEASE_DECISION_ENGINE_SPEC_VERSION;
  readonly matchedPolicyId: string | null;
  readonly policyMatched: boolean;
  readonly decision: ReleaseDecision;
  readonly plan: ReleaseEvaluationPlan;
}

export interface ReleaseDeterministicEvaluationResult extends ReleaseEvaluationResult {
  readonly deterministicChecksCompleted: boolean;
}

export interface ReleaseDecisionEngine {
  evaluate(input: ReleaseEvaluationRequest): ReleaseEvaluationResult;
  evaluateWithDeterministicChecks(
    input: ReleaseEvaluationRequest,
    observation: DeterministicCheckObservation,
  ): ReleaseDeterministicEvaluationResult;
}

export interface CreateReleaseDecisionEngineInput {
  readonly policies?: readonly ReleasePolicyDefinition[];
  readonly decisionLog?: ReleaseDecisionLogWriter;
}

function buildPolicyScopeMismatchFinding(): ReleaseFinding {
  return {
    code: 'policy_scope_mismatch',
    result: 'fail',
    message:
      'No active release policy matched the requested consequence, risk, target kind, and output contract.',
    source: 'policy',
  };
}

function buildPendingChecksFinding(policyId: string): ReleaseFinding {
  return {
    code: 'deterministic_checks_pending',
    result: 'info',
    message: `Release policy ${policyId} matched. Deterministic release checks must run before final release.`,
    source: 'policy',
  };
}

function buildPolicyProvenance(
  resolution: EffectiveReleasePolicyResolution,
): ReleasePolicyProvenance {
  const compiledPolicy = resolution.effectiveCompiledPolicy;
  if (compiledPolicy) {
    return Object.freeze({
      source: 'compiled-admission-policy-index',
      policyId: compiledPolicy.compiled.sourcePolicyId,
      policySpecVersion: compiledPolicy.compiled.sourcePolicyVersion,
      policyHash: compiledPolicy.compiled.policyHash,
      compiledPolicyHash: compiledPolicy.compiled.policyHash,
      compiledPolicyIrHash: compiledPolicy.compiled.irHash,
      compiledPolicyIndexVersion: COMPILED_ADMISSION_POLICY_INDEX_VERSION,
      compiledPolicyIrVersion: compiledPolicy.compiled.version,
      verificationValid: compiledPolicy.verification.valid,
      verificationErrorCodes: Object.freeze(
        compiledPolicy.verification.errors.map((finding) => finding.code),
      ),
      verificationWarningCodes: Object.freeze(
        compiledPolicy.verification.warnings.map((finding) => finding.code),
      ),
    });
  }

  return Object.freeze({
    source: 'policy-definition',
    policyId: resolution.effectivePolicy.id,
    policySpecVersion: resolution.effectivePolicy.version,
    policyHash: resolution.effectivePolicy.id,
    compiledPolicyHash: null,
    compiledPolicyIrHash: null,
    compiledPolicyIndexVersion: null,
    compiledPolicyIrVersion: null,
    verificationValid: null,
    verificationErrorCodes: Object.freeze([]),
    verificationWarningCodes: Object.freeze([]),
  });
}

function buildRolloutContext(
  input: ReleaseEvaluationRequest,
): ReleasePolicyRolloutEvaluationContext {
  return {
    requestId: input.id,
    outputHash: input.outputHash,
    requesterId: input.requester.id,
    targetId: input.target.id,
    tenantId: input.context?.tenantId ?? null,
    accountId: input.context?.accountId ?? null,
    planId: input.context?.planId ?? null,
    cohortId: input.context?.cohortId ?? null,
  };
}

interface EffectiveReleasePolicyResolution {
  readonly matchedPolicy: ReleasePolicyDefinition;
  readonly effectivePolicy: ReleasePolicyDefinition;
  readonly effectiveCompiledPolicy: CompiledAdmissionPolicyIndexEntry | null;
  readonly rollout: ReleasePolicyRolloutResolution;
  readonly fallbackPolicyId: string | null;
}

function findRollbackFallbackPolicy(
  policies: readonly ReleasePolicyDefinition[],
  matchedPolicy: ReleasePolicyDefinition,
  input: ReleaseEvaluationRequest,
): ReleasePolicyDefinition | null {
  const fallbackPolicyId = matchedPolicy.rollout.fallbackPolicyId;
  if (!fallbackPolicyId) {
    return null;
  }

  const fallback = policies.find((policy) => policy.id === fallbackPolicyId) ?? null;
  if (!fallback || fallback.status === 'draft') {
    return null;
  }

  return matchesReleasePolicyScope(
    fallback,
    input.outputContract,
    input.capabilityBoundary,
    input.target.kind,
  )
    ? fallback
    : null;
}

function findRollbackFallbackCompiledPolicy(
  index: CompiledAdmissionPolicyIndex,
  matchedPolicy: ReleasePolicyDefinition,
  input: ReleaseEvaluationRequest,
): CompiledAdmissionPolicyIndexEntry | null {
  const fallbackPolicyId = matchedPolicy.rollout.fallbackPolicyId;
  if (!fallbackPolicyId) {
    return null;
  }

  return (
    resolveCompiledAdmissionPolicyIndexEntries(index, input).find(
      (entry) => entry.definition.id === fallbackPolicyId,
    ) ?? null
  );
}

function resolveEffectiveReleasePolicy(
  policies: readonly ReleasePolicyDefinition[],
  input: ReleaseEvaluationRequest,
  compiledPolicyIndex?: CompiledAdmissionPolicyIndex,
): EffectiveReleasePolicyResolution | null {
  const matchedCompiledPolicy = compiledPolicyIndex
    ? resolveCompiledAdmissionPolicyIndexEntry(compiledPolicyIndex, input)
    : null;
  const matchedPolicy = compiledPolicyIndex
    ? matchedCompiledPolicy?.definition ?? null
    : resolveMatchingReleasePolicy(policies, input);
  if (!matchedPolicy) {
    return null;
  }

  const rolloutContext = buildRolloutContext(input);
  if (matchedPolicy.rollout.mode !== 'rolled-back') {
    return {
      matchedPolicy,
      effectivePolicy: matchedPolicy,
      effectiveCompiledPolicy: matchedCompiledPolicy,
      rollout: resolveReleasePolicyRollout(matchedPolicy.rollout, rolloutContext),
      fallbackPolicyId: null,
    };
  }

  const fallbackCompiledPolicy = compiledPolicyIndex
    ? findRollbackFallbackCompiledPolicy(compiledPolicyIndex, matchedPolicy, input)
    : null;
  const fallback = compiledPolicyIndex
    ? fallbackCompiledPolicy?.definition ?? null
    : findRollbackFallbackPolicy(policies, matchedPolicy, input);
  if (!fallback) {
    return {
      matchedPolicy,
      effectivePolicy: matchedPolicy,
      effectiveCompiledPolicy: matchedCompiledPolicy,
      rollout: resolveReleasePolicyRollout(matchedPolicy.rollout, rolloutContext),
      fallbackPolicyId: matchedPolicy.rollout.fallbackPolicyId,
    };
  }

  const fallbackRollout = resolveReleasePolicyRollout(fallback.rollout, rolloutContext);
  return {
    matchedPolicy,
    effectivePolicy: fallback,
    effectiveCompiledPolicy: fallbackCompiledPolicy,
    rollout: {
      rolloutMode: 'rolled-back',
      evaluationMode: fallbackRollout.evaluationMode,
      reason: 'rolled-back',
      canaryBucket: fallbackRollout.canaryBucket,
    },
    fallbackPolicyId: fallback.id,
  };
}

function logEvaluation(
  writer: ReleaseDecisionLogWriter | undefined,
  request: ReleaseEvaluationRequest,
  result: ReleaseEvaluationResult,
  phase: ReleaseDecisionLogPhase,
  deterministicChecksCompleted: boolean,
): void {
  writer?.append({
    occurredAt: request.createdAt,
    requestId: request.id,
    phase,
    matchedPolicyId: result.matchedPolicyId,
    decision: result.decision,
      metadata: {
        policyMatched: result.policyMatched,
        pendingChecks: result.plan.pendingChecks,
        pendingEvidenceKinds: result.plan.pendingEvidenceKinds,
        requiresReview: result.plan.requiresReview,
        deterministicChecksCompleted,
        effectivePolicyId: result.plan.effectivePolicyId,
        policyHash: result.decision.policyHash,
        policyIrHash: result.decision.policyProvenance?.compiledPolicyIrHash ?? null,
        policyProvenanceSource: result.decision.policyProvenance?.source ?? null,
        rolloutMode: result.plan.rolloutMode,
        rolloutEvaluationMode: result.plan.rolloutEvaluationMode,
        rolloutReason: result.plan.rolloutReason,
        rolloutCanaryBucket: result.plan.rolloutCanaryBucket,
        rolloutFallbackPolicyId: result.plan.rolloutFallbackPolicyId,
      },
    });
}

export function resolveMatchingReleasePolicy(
  policies: readonly ReleasePolicyDefinition[],
  input: ReleaseEvaluationRequest,
): ReleasePolicyDefinition | null {
  return (
    policies.find(
      (policy) =>
        policy.status === 'active' &&
        matchesReleasePolicyScope(
          policy,
          input.outputContract,
          input.capabilityBoundary,
          input.target.kind,
        ),
    ) ?? null
  );
}

export function evaluateReleaseDecisionSkeleton(
  input: ReleaseEvaluationRequest,
  policies: readonly ReleasePolicyDefinition[],
  compiledPolicyIndex?: CompiledAdmissionPolicyIndex,
): ReleaseEvaluationResult {
  const resolvedPolicy = resolveEffectiveReleasePolicy(policies, input, compiledPolicyIndex);

  if (!resolvedPolicy) {
    const decision = createReleaseDecisionSkeleton({
      id: input.id,
      createdAt: input.createdAt,
      status: 'denied',
      policyVersion: 'unmatched',
      policyHash: 'unmatched',
      outputHash: input.outputHash,
      consequenceHash: input.consequenceHash,
      outputContract: input.outputContract,
      capabilityBoundary: input.capabilityBoundary,
      requester: input.requester,
      target: input.target,
      findings: [buildPolicyScopeMismatchFinding()],
    });

    return {
      version: RELEASE_DECISION_ENGINE_SPEC_VERSION,
      matchedPolicyId: null,
      policyMatched: false,
      decision,
      plan: {
        phase: 'terminal-deny',
        pendingChecks: [],
        pendingEvidenceKinds: [],
        requiresReview: false,
        policyId: null,
        effectivePolicyId: null,
        rolloutMode: null,
        rolloutEvaluationMode: null,
        rolloutReason: null,
        rolloutCanaryBucket: null,
        rolloutFallbackPolicyId: null,
      },
    };
  }

  const matchedPolicy = resolvedPolicy.matchedPolicy;
  const effectivePolicy = resolvedPolicy.effectivePolicy;
  const requiresReview =
    effectivePolicy.release.reviewMode === 'named-reviewer' ||
    effectivePolicy.release.reviewMode === 'dual-approval';

  const decision = createReleaseDecisionSkeleton({
    id: input.id,
    createdAt: input.createdAt,
    status: 'hold',
    policyVersion: effectivePolicy.id,
    policyHash: resolvedPolicy.effectiveCompiledPolicy?.compiled.policyHash ?? effectivePolicy.id,
    policyProvenance: buildPolicyProvenance(resolvedPolicy),
    outputHash: input.outputHash,
    consequenceHash: input.consequenceHash,
    outputContract: input.outputContract,
    capabilityBoundary: input.capabilityBoundary,
    requester: input.requester,
    target: input.target,
    findings: [buildPendingChecksFinding(effectivePolicy.id)],
  });

  return {
    version: RELEASE_DECISION_ENGINE_SPEC_VERSION,
    matchedPolicyId: matchedPolicy.id,
    policyMatched: true,
    decision,
    plan: {
      phase: 'deterministic-checks',
      pendingChecks: effectivePolicy.acceptance.requiredChecks,
      pendingEvidenceKinds: effectivePolicy.acceptance.requiredEvidenceKinds,
      requiresReview,
      policyId: matchedPolicy.id,
      effectivePolicyId: effectivePolicy.id,
      rolloutMode: resolvedPolicy.rollout.rolloutMode,
      rolloutEvaluationMode: resolvedPolicy.rollout.evaluationMode,
      rolloutReason: resolvedPolicy.rollout.reason,
      rolloutCanaryBucket: resolvedPolicy.rollout.canaryBucket,
      rolloutFallbackPolicyId: resolvedPolicy.fallbackPolicyId,
    },
  };
}

export function createReleaseDecisionEngine(
  input: CreateReleaseDecisionEngineInput = {},
): ReleaseDecisionEngine {
  const policies = input.policies ?? [createFirstHardGatewayReleasePolicy()];
  const compiledPolicyIndex = createCompiledAdmissionPolicyIndex(policies);
  const decisionLog = input.decisionLog;

  return {
    evaluate(request: ReleaseEvaluationRequest): ReleaseEvaluationResult {
      const result = evaluateReleaseDecisionSkeleton(request, policies, compiledPolicyIndex);
      logEvaluation(decisionLog, request, result, 'policy-resolution', false);
      return result;
    },
    evaluateWithDeterministicChecks(
      request: ReleaseEvaluationRequest,
      observation: DeterministicCheckObservation,
    ): ReleaseDeterministicEvaluationResult {
      const initial = evaluateReleaseDecisionSkeleton(request, policies, compiledPolicyIndex);
      logEvaluation(decisionLog, request, initial, 'policy-resolution', false);

      if (!initial.policyMatched || initial.matchedPolicyId === null) {
        return {
          ...initial,
          deterministicChecksCompleted: false,
        };
      }

      const resolvedPolicy = resolveEffectiveReleasePolicy(policies, request, compiledPolicyIndex);
      if (!resolvedPolicy) {
        return {
          ...initial,
          deterministicChecksCompleted: false,
        };
      }

      const report = runDeterministicReleaseChecks(
        resolvedPolicy.effectivePolicy,
        initial.decision,
        observation,
      );
      const decision = applyDeterministicCheckReport(initial.decision, report);
      const finalResult: ReleaseDeterministicEvaluationResult = {
        version: initial.version,
        matchedPolicyId: initial.matchedPolicyId,
        policyMatched: true,
        decision,
        plan: {
          phase: report.nextPhase,
          pendingChecks: [],
          pendingEvidenceKinds: [],
          requiresReview: report.nextPhase === 'review',
          policyId: initial.matchedPolicyId,
          effectivePolicyId: initial.plan.effectivePolicyId,
          rolloutMode: initial.plan.rolloutMode,
          rolloutEvaluationMode: initial.plan.rolloutEvaluationMode,
          rolloutReason: initial.plan.rolloutReason,
          rolloutCanaryBucket: initial.plan.rolloutCanaryBucket,
          rolloutFallbackPolicyId: initial.plan.rolloutFallbackPolicyId,
        },
        deterministicChecksCompleted: true,
      };
      logEvaluation(decisionLog, request, finalResult, 'deterministic-checks', true);
      return finalResult;
    },
  };
}
