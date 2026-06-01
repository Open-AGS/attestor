import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ShadowAdmissionEvent,
} from './shadow-events.js';
import type {
  ShadowPolicyDiscoveryCandidate,
} from './policy-discovery-candidates.js';
import type {
  ShadowPolicySimulationReport,
  ShadowPolicySurfaceSimulation,
} from './shadow-simulation.js';

export const POLICY_FOUNDRY_READINESS_VERSION =
  'attestor.policy-foundry-readiness.v1';

export const POLICY_FOUNDRY_ROLLOUT_STEPS = [
  'observe-only',
  'warn-only',
  'review-required',
  'scoped-enforce-low-risk',
  'full-enforce',
  'rollback',
] as const;
export type PolicyFoundryRolloutStep =
  typeof POLICY_FOUNDRY_ROLLOUT_STEPS[number];

export const POLICY_FOUNDRY_READINESS_STATUSES = [
  'no-go',
  'shadow-only',
  'review-ready',
  'enforce-eligible',
] as const;
export type PolicyFoundryReadinessStatus =
  typeof POLICY_FOUNDRY_READINESS_STATUSES[number];

export const POLICY_FOUNDRY_ACTOR_DISTRIBUTION_HEALTH = [
  'unknown',
  'weak',
  'partial',
  'healthy',
] as const;
export type PolicyFoundryActorDistributionHealth =
  typeof POLICY_FOUNDRY_ACTOR_DISTRIBUTION_HEALTH[number];

export const POLICY_FOUNDRY_RED_TEAM_REPLAY_STATUSES = [
  'not-run',
  'passed',
  'failed',
] as const;
export type PolicyFoundryRedTeamReplayStatus =
  typeof POLICY_FOUNDRY_RED_TEAM_REPLAY_STATUSES[number];

export const POLICY_FOUNDRY_NO_GO_REASONS = [
  'candidate-missing',
  'no-simulation-report',
  'customer-approval-required',
  'missing-policy-schema',
  'missing-evidence-coverage',
  'missing-authority-binding',
  'missing-scope-binding',
  'adapter-readiness-missing',
  'custom-domain-contract-missing',
  'sample-size-too-small',
  'single-actor-concentration',
  'high-risk-auto-admit',
  'counterexamples-present',
  'replay-duplicate-pressure',
  'tenant-boundary-not-proven',
  'red-team-replay-not-run',
  'red-team-replay-failed',
  'llm-authority-source',
] as const;
export type PolicyFoundryNoGoReason =
  typeof POLICY_FOUNDRY_NO_GO_REASONS[number];

export const POLICY_FOUNDRY_ACTIVE_QUESTION_KINDS = [
  'continue-shadow',
  'choose-policy-template',
  'bind-evidence',
  'bind-authority',
  'bind-scope',
  'prepare-adapter',
  'scope-custom-domain',
  'review-counterexamples',
  'confirm-representative-sample',
  'run-red-team-replay',
  'approve-candidate',
] as const;
export type PolicyFoundryActiveQuestionKind =
  typeof POLICY_FOUNDRY_ACTIVE_QUESTION_KINDS[number];

export interface EvaluatePolicyFoundryReadinessInput {
  readonly candidate: ShadowPolicyDiscoveryCandidate | null;
  readonly report: ShadowPolicySimulationReport | null;
  readonly events?: readonly ShadowAdmissionEvent[] | null;
  readonly generatedAt?: string | null;
  readonly customerApproved?: boolean | null;
  readonly tenantBoundaryProven?: boolean | null;
  readonly llmAuthoritySource?: boolean | null;
  readonly redTeamReplayStatus?: PolicyFoundryRedTeamReplayStatus | null;
  readonly minimumSampleSize?: number | null;
  readonly minimumActorCount?: number | null;
  readonly maxSingleActorConcentration?: number | null;
  readonly maxReplayDuplicateRate?: number | null;
}

export interface PolicyFoundryConfidenceProfile {
  readonly sampleSize: number;
  readonly minimumSampleSize: number;
  readonly actorCount: number;
  readonly minimumActorCount: number;
  readonly actorDistributionHealth: PolicyFoundryActorDistributionHealth;
  readonly singleActorConcentration: number | null;
  readonly dominantActorDigest: string | null;
  readonly evidenceCompleteness: number;
  readonly authorityCompleteness: number;
  readonly policyCompleteness: number;
  readonly scopeCompleteness: number;
  readonly adapterReadiness: number;
  readonly customDomainReadiness: number;
  readonly reviewerAgreement: number | null;
  readonly counterexampleCount: number;
  readonly highRiskAutoAdmitCount: number;
  readonly replayDuplicateRate: number;
  readonly simulationQuality: number;
  readonly redTeamReplayStatus: PolicyFoundryRedTeamReplayStatus;
}

export interface PolicyFoundryActiveQuestion {
  readonly questionId: string;
  readonly kind: PolicyFoundryActiveQuestionKind;
  readonly priority: number;
  readonly prompt: string;
}

export interface PolicyFoundryReadinessEvaluation {
  readonly version: typeof POLICY_FOUNDRY_READINESS_VERSION;
  readonly generatedAt: string;
  readonly candidateId: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly sourceReportId: string | null;
  readonly sourceReportDigest: string | null;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly llmAuthorityAllowed: false;
  readonly evidenceRequired: true;
  readonly simulationRequired: true;
  readonly status: PolicyFoundryReadinessStatus;
  readonly readinessScore: number;
  readonly recommendedRolloutStep: PolicyFoundryRolloutStep;
  readonly noGoReasons: readonly PolicyFoundryNoGoReason[];
  readonly confidence: PolicyFoundryConfidenceProfile;
  readonly activeQuestions: readonly PolicyFoundryActiveQuestion[];
  readonly canonical: string;
  readonly digest: string;
}

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

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Policy Foundry readiness ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function positiveInteger(
  value: number | null | undefined,
  fallback: number,
  fieldName: string,
): number {
  const raw = value ?? fallback;
  if (!Number.isInteger(raw) || raw < 0) {
    throw new Error(`Policy Foundry readiness ${fieldName} must be a non-negative integer.`);
  }
  return raw;
}

function ratioLimit(
  value: number | null | undefined,
  fallback: number,
  fieldName: string,
): number {
  const raw = value ?? fallback;
  if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
    throw new Error(`Policy Foundry readiness ${fieldName} must be between 0 and 1.`);
  }
  return raw;
}

function rounded(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function countRatio(total: number, missing: number): number {
  if (total <= 0) return 0;
  return rounded(1 - (missing / total));
}

function surfaceMatches(
  surface: ShadowPolicySurfaceSimulation,
  candidate: ShadowPolicyDiscoveryCandidate,
): boolean {
  return (
    (candidate.actionSurface === null || surface.actionSurface === candidate.actionSurface) &&
    (candidate.domain === null || surface.domain === candidate.domain)
  );
}

function eventMatches(
  event: ShadowAdmissionEvent,
  candidate: ShadowPolicyDiscoveryCandidate,
): boolean {
  return (
    (candidate.actionSurface === null || event.actionSurface === candidate.actionSurface) &&
    (candidate.domain === null || event.domain === candidate.domain)
  );
}

function digestActor(actor: string): string {
  return `sha256:${createHash('sha256').update(actor).digest('hex')}`;
}

function dominantActor(
  events: readonly ShadowAdmissionEvent[],
): {
  readonly actorCount: number;
  readonly concentration: number | null;
  readonly digest: string | null;
} {
  if (events.length === 0) {
    return Object.freeze({
      actorCount: 0,
      concentration: null,
      digest: null,
    });
  }

  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.actor, (counts.get(event.actor) ?? 0) + 1);
  }

  const [actor, count] = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? [null, 0];

  return Object.freeze({
    actorCount: counts.size,
    concentration: rounded(count / events.length),
    digest: actor === null ? null : digestActor(actor),
  });
}

function actorHealth(input: {
  readonly eventCount: number;
  readonly actorCount: number;
  readonly concentration: number | null;
  readonly minimumActorCount: number;
  readonly maxSingleActorConcentration: number;
}): PolicyFoundryActorDistributionHealth {
  if (input.eventCount === 0 || input.concentration === null) return 'unknown';
  if (input.concentration > input.maxSingleActorConcentration) return 'weak';
  if (input.actorCount < input.minimumActorCount) return 'partial';
  return 'healthy';
}

function duplicateRate(events: readonly ShadowAdmissionEvent[]): number {
  if (events.length === 0) return 0;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const event of events) {
    if (seen.has(event.admissionDigest)) duplicates += 1;
    seen.add(event.admissionDigest);
  }
  return rounded(duplicates / events.length);
}

function reviewerAgreement(events: readonly ShadowAdmissionEvent[]): number | null {
  const reviewed = events.filter((event) =>
    event.humanOutcome === 'approved' ||
    event.humanOutcome === 'rejected' ||
    event.humanOutcome === 'modified'
  );
  if (reviewed.length === 0) return null;
  const counts = new Map<string, number>();
  for (const event of reviewed) {
    counts.set(event.humanOutcome, (counts.get(event.humanOutcome) ?? 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  return rounded(maxCount / reviewed.length);
}

function highRiskAutoAdmits(events: readonly ShadowAdmissionEvent[]): number {
  const highRiskKeys = new Set([
    'highRisk',
    'high-risk',
    'policyBlocked',
    'unsafe',
    'requiresReview',
  ]);
  return events.filter((event) =>
    event.effectiveDecision === 'admit' &&
    event.observedFeatureKeys.some((key) => highRiskKeys.has(key))
  ).length;
}

function addReason(
  reasons: Set<PolicyFoundryNoGoReason>,
  reason: PolicyFoundryNoGoReason,
): void {
  reasons.add(reason);
}

function activeQuestion(
  kind: PolicyFoundryActiveQuestionKind,
  priority: number,
  prompt: string,
): PolicyFoundryActiveQuestion {
  const questionId = `policy-foundry-question:${canonicalObject({
    kind,
    priority,
    prompt,
  } as CanonicalReleaseJsonValue).digest}`;
  return Object.freeze({
    questionId,
    kind,
    priority,
    prompt,
  });
}

function questionsFor(
  reasons: readonly PolicyFoundryNoGoReason[],
): readonly PolicyFoundryActiveQuestion[] {
  const questions: PolicyFoundryActiveQuestion[] = [];
  if (reasons.includes('sample-size-too-small')) {
    questions.push(activeQuestion(
      'continue-shadow',
      90,
      'Keep this action surface in shadow mode until the minimum sample size is reached.',
    ));
  }
  if (reasons.includes('missing-policy-schema')) {
    questions.push(activeQuestion(
      'choose-policy-template',
      80,
      'Choose or define the policy template for this observed action surface before promotion.',
    ));
  }
  if (reasons.includes('missing-evidence-coverage')) {
    questions.push(activeQuestion(
      'bind-evidence',
      75,
      'Bind the required evidence source before this candidate can move toward review or enforcement.',
    ));
  }
  if (reasons.includes('missing-authority-binding')) {
    questions.push(activeQuestion(
      'bind-authority',
      70,
      'Bind the customer authority source for the actor, reviewer, signer, or delegation path.',
    ));
  }
  if (reasons.includes('missing-scope-binding')) {
    questions.push(activeQuestion(
      'bind-scope',
      68,
      'Bind the action scope before this candidate can move toward review or enforcement.',
    ));
  }
  if (reasons.includes('adapter-readiness-missing')) {
    questions.push(activeQuestion(
      'prepare-adapter',
      65,
      'Prepare and verify the downstream adapter before this action can become enforceable.',
    ));
  }
  if (reasons.includes('custom-domain-contract-missing')) {
    questions.push(activeQuestion(
      'scope-custom-domain',
      64,
      'Bind this custom consequence domain to a named pack contract before promotion.',
    ));
  }
  if (
    reasons.includes('counterexamples-present') ||
    reasons.includes('high-risk-auto-admit') ||
    reasons.includes('replay-duplicate-pressure')
  ) {
    questions.push(activeQuestion(
      'review-counterexamples',
      60,
      'Review the blocked, high-risk, duplicate, or failed shadow examples before promotion.',
    ));
  }
  if (reasons.includes('single-actor-concentration')) {
    questions.push(activeQuestion(
      'confirm-representative-sample',
      55,
      'Confirm whether the observed sample represents the workflow, or continue shadow mode with broader actor coverage.',
    ));
  }
  if (
    reasons.includes('red-team-replay-not-run') ||
    reasons.includes('red-team-replay-failed')
  ) {
    questions.push(activeQuestion(
      'run-red-team-replay',
      50,
      'Run the candidate red-team replay set before review or enforcement rollout.',
    ));
  }
  if (reasons.includes('customer-approval-required')) {
    questions.push(activeQuestion(
      'approve-candidate',
      40,
      'Customer approval is required before any enforcement posture changes.',
    ));
  }
  return Object.freeze(
    questions.sort((left, right) => right.priority - left.priority || left.kind.localeCompare(right.kind)),
  );
}

function scoreFor(
  noGoReasons: readonly PolicyFoundryNoGoReason[],
  confidence: PolicyFoundryConfidenceProfile,
): number {
  let score = 100;
  score -= noGoReasons.length * 8;
  score -= Math.round((1 - confidence.simulationQuality) * 20);
  score -= Math.round((1 - confidence.evidenceCompleteness) * 12);
  score -= Math.round((1 - confidence.authorityCompleteness) * 10);
  score -= Math.round((1 - confidence.policyCompleteness) * 10);
  score -= Math.round((1 - confidence.scopeCompleteness) * 10);
  score -= Math.round((1 - confidence.customDomainReadiness) * 8);
  score -= Math.round(confidence.replayDuplicateRate * 10);
  score -= confidence.counterexampleCount > 0 ? 15 : 0;
  score -= confidence.highRiskAutoAdmitCount > 0 ? 20 : 0;
  return Math.max(0, Math.min(100, score));
}

function statusFor(input: {
  readonly candidate: ShadowPolicyDiscoveryCandidate | null;
  readonly noGoReasons: readonly PolicyFoundryNoGoReason[];
  readonly customerApproved: boolean;
  readonly redTeamReplayStatus: PolicyFoundryRedTeamReplayStatus;
}): PolicyFoundryReadinessStatus {
  if (input.candidate === null) return 'no-go';
  const hardReasons = input.noGoReasons.filter((reason) =>
    reason !== 'customer-approval-required' &&
    reason !== 'red-team-replay-not-run'
  );
  if (hardReasons.length > 0) return 'no-go';
  if (input.candidate.proposedMode === 'enforce') {
    return input.customerApproved && input.redTeamReplayStatus === 'passed'
      ? 'enforce-eligible'
      : 'review-ready';
  }
  if (input.candidate.proposedMode === 'review') return 'review-ready';
  return 'shadow-only';
}

function rolloutFor(status: PolicyFoundryReadinessStatus): PolicyFoundryRolloutStep {
  if (status === 'enforce-eligible') return 'scoped-enforce-low-risk';
  if (status === 'review-ready') return 'review-required';
  if (status === 'shadow-only') return 'warn-only';
  return 'observe-only';
}

export function evaluatePolicyFoundryReadiness(
  input: EvaluatePolicyFoundryReadinessInput,
): PolicyFoundryReadinessEvaluation {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const minimumSampleSize = positiveInteger(input.minimumSampleSize, 20, 'minimumSampleSize');
  const minimumActorCount = positiveInteger(input.minimumActorCount, 2, 'minimumActorCount');
  const maxSingleActorConcentration = ratioLimit(
    input.maxSingleActorConcentration,
    0.8,
    'maxSingleActorConcentration',
  );
  const maxReplayDuplicateRate = ratioLimit(
    input.maxReplayDuplicateRate,
    0.1,
    'maxReplayDuplicateRate',
  );
  const candidate = input.candidate;
  const report = input.report;
  const redTeamReplayStatus = input.redTeamReplayStatus ?? 'not-run';
  const customerApproved = input.customerApproved === true;
  const tenantBoundaryProven = input.tenantBoundaryProven === true;
  const noGoReasons = new Set<PolicyFoundryNoGoReason>();

  if (candidate === null) addReason(noGoReasons, 'candidate-missing');
  if (report === null) addReason(noGoReasons, 'no-simulation-report');
  if (!customerApproved) addReason(noGoReasons, 'customer-approval-required');
  if (!tenantBoundaryProven) addReason(noGoReasons, 'tenant-boundary-not-proven');
  if (input.llmAuthoritySource === true) addReason(noGoReasons, 'llm-authority-source');

  const allEvents = input.events ?? [];
  const matchingEvents = candidate === null
    ? []
    : allEvents.filter((event) => eventMatches(event, candidate));
  const surface = candidate === null || report === null
    ? null
    : report.surfaceSimulations.find((item) => surfaceMatches(item, candidate)) ?? null;
  const sampleSize = surface?.eventCount ?? candidate?.affectedEvents ?? matchingEvents.length;
  const actor = dominantActor(matchingEvents);
  const duplicatePressure = duplicateRate(matchingEvents);
  const reviewer = reviewerAgreement(matchingEvents);
  const counterexampleCount =
    (surface?.simulatedDecisionCounts.block ?? 0) +
    (surface?.humanRejections ?? 0) +
    (surface?.downstreamFailures ?? 0);
  const highRiskAutoAdmitCount = highRiskAutoAdmits(matchingEvents);

  if (candidate?.requiredControls.includes('policy') || (surface?.gapCounts.policy ?? 0) > 0) {
    addReason(noGoReasons, 'missing-policy-schema');
  }
  if (candidate?.requiredControls.includes('evidence') || (surface?.gapCounts.evidence ?? 0) > 0) {
    addReason(noGoReasons, 'missing-evidence-coverage');
  }
  if (candidate?.requiredControls.includes('authority') || (surface?.gapCounts.authority ?? 0) > 0) {
    addReason(noGoReasons, 'missing-authority-binding');
  }
  if (
    candidate?.requiredControls.includes('scope') ||
    (surface?.gapCounts.amountScope ?? 0) > 0 ||
    (surface?.gapCounts.recipientScope ?? 0) > 0 ||
    (surface?.gapCounts.dataScope ?? 0) > 0
  ) {
    addReason(noGoReasons, 'missing-scope-binding');
  }
  if (candidate?.requiredControls.includes('adapter') || (surface?.gapCounts.adapter ?? 0) > 0) {
    addReason(noGoReasons, 'adapter-readiness-missing');
  }
  if (
    candidate?.requiredControls.includes('custom-domain') ||
    (surface?.gapCounts.customDomain ?? 0) > 0
  ) {
    addReason(noGoReasons, 'custom-domain-contract-missing');
  }
  if (sampleSize < minimumSampleSize) addReason(noGoReasons, 'sample-size-too-small');
  if (
    actor.concentration !== null &&
    actor.concentration > maxSingleActorConcentration &&
    sampleSize >= minimumSampleSize
  ) {
    addReason(noGoReasons, 'single-actor-concentration');
  }
  if (counterexampleCount > 0) addReason(noGoReasons, 'counterexamples-present');
  if (highRiskAutoAdmitCount > 0) addReason(noGoReasons, 'high-risk-auto-admit');
  if (duplicatePressure > maxReplayDuplicateRate) {
    addReason(noGoReasons, 'replay-duplicate-pressure');
  }
  if (
    candidate !== null &&
    (candidate.proposedMode === 'review' || candidate.proposedMode === 'enforce') &&
    redTeamReplayStatus === 'not-run'
  ) {
    addReason(noGoReasons, 'red-team-replay-not-run');
  }
  if (redTeamReplayStatus === 'failed') addReason(noGoReasons, 'red-team-replay-failed');

  const confidence: PolicyFoundryConfidenceProfile = Object.freeze({
    sampleSize,
    minimumSampleSize,
    actorCount: actor.actorCount,
    minimumActorCount,
    actorDistributionHealth: actorHealth({
      eventCount: matchingEvents.length,
      actorCount: actor.actorCount,
      concentration: actor.concentration,
      minimumActorCount,
      maxSingleActorConcentration,
    }),
    singleActorConcentration: actor.concentration,
    dominantActorDigest: actor.digest,
    evidenceCompleteness: countRatio(sampleSize, surface?.gapCounts.evidence ?? 0),
    authorityCompleteness: countRatio(sampleSize, surface?.gapCounts.authority ?? 0),
    policyCompleteness: countRatio(sampleSize, surface?.gapCounts.policy ?? 0),
    scopeCompleteness: countRatio(
      sampleSize,
      (surface?.gapCounts.amountScope ?? 0) +
        (surface?.gapCounts.recipientScope ?? 0) +
        (surface?.gapCounts.dataScope ?? 0),
    ),
    adapterReadiness: countRatio(sampleSize, surface?.gapCounts.adapter ?? 0),
    customDomainReadiness: countRatio(sampleSize, surface?.gapCounts.customDomain ?? 0),
    reviewerAgreement: reviewer,
    counterexampleCount,
    highRiskAutoAdmitCount,
    replayDuplicateRate: duplicatePressure,
    simulationQuality: report === null ? 0 : countRatio(report.eventCount, report.rawPayloadEventCount),
    redTeamReplayStatus,
  });
  const reasons = Object.freeze([...noGoReasons].sort());
  const status = statusFor({
    candidate,
    noGoReasons: reasons,
    customerApproved,
    redTeamReplayStatus,
  });
  const readinessScore = scoreFor(reasons, confidence);
  const payload = {
    version: POLICY_FOUNDRY_READINESS_VERSION as typeof POLICY_FOUNDRY_READINESS_VERSION,
    generatedAt,
    candidateId: candidate?.candidateId ?? null,
    actionSurface: candidate?.actionSurface ?? null,
    domain: candidate?.domain ?? null,
    sourceReportId: report?.reportId ?? null,
    sourceReportDigest: report?.digest ?? null,
    approvalRequired: true as const,
    autoEnforce: false as const,
    llmAuthorityAllowed: false as const,
    evidenceRequired: true as const,
    simulationRequired: true as const,
    status,
    readinessScore,
    recommendedRolloutStep: rolloutFor(status),
    noGoReasons: reasons,
    confidence,
    activeQuestions: questionsFor(reasons),
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
