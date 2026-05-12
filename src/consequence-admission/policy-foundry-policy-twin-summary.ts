import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  PolicyFoundryCounterexampleLedger,
} from './policy-foundry-counterexample-ledger.js';
import type {
  PolicyFoundryReadinessEvaluation,
  PolicyFoundryRolloutStep,
} from './policy-foundry-readiness.js';
import type {
  ShadowPolicyDecisionCounts,
  ShadowPolicySimulationReport,
  ShadowPolicySurfaceSimulation,
} from './shadow-simulation.js';
import type {
  ShadowPolicyDiscoveryCandidate,
} from './policy-discovery-candidates.js';

export const POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION =
  'attestor.policy-foundry-policy-twin-summary.v1';

export const POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_STATUSES = [
  'not-enough-evidence',
  'review-only',
  'rollout-candidate',
] as const;
export type PolicyFoundryPolicyTwinSummaryStatus =
  typeof POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_STATUSES[number];

export interface CreatePolicyFoundryPolicyTwinSummaryInput {
  readonly candidate: ShadowPolicyDiscoveryCandidate | null;
  readonly report: ShadowPolicySimulationReport | null;
  readonly readiness?: PolicyFoundryReadinessEvaluation | null;
  readonly counterexampleLedger?: PolicyFoundryCounterexampleLedger | null;
  readonly generatedAt?: string | null;
}

export interface PolicyFoundryPolicyTwinDecisionImpact {
  readonly admitCount: number;
  readonly narrowCount: number;
  readonly reviewCount: number;
  readonly blockCount: number;
  readonly admitRate: number;
  readonly narrowRate: number;
  readonly reviewRate: number;
  readonly blockRate: number;
}

export interface PolicyFoundryPolicyTwinReviewLoadImpact {
  readonly manualReviewBaselineCount: number;
  readonly simulatedReviewCount: number;
  readonly simulatedBlockCount: number;
  readonly reviewLoadDeltaCount: number;
  readonly reviewLoadReductionRate: number;
  readonly baselineAssumption: 'manual-review-everything';
}

export interface PolicyFoundryPolicyTwinSummary {
  readonly version: typeof POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION;
  readonly generatedAt: string;
  readonly candidateId: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly sourceReportId: string | null;
  readonly sourceReportDigest: string | null;
  readonly readinessDigest: string | null;
  readonly counterexampleLedgerDigest: string | null;
  readonly windowStart: string | null;
  readonly windowEnd: string | null;
  readonly proposedMode: string | null;
  readonly status: PolicyFoundryPolicyTwinSummaryStatus;
  readonly recommendedRolloutStep: PolicyFoundryRolloutStep;
  readonly eventCount: number;
  readonly decisionImpact: PolicyFoundryPolicyTwinDecisionImpact;
  readonly reviewLoadImpact: PolicyFoundryPolicyTwinReviewLoadImpact;
  readonly gapCounts: {
    readonly policy: number;
    readonly evidence: number;
    readonly authority: number;
    readonly adapter: number;
  };
  readonly noGoReasons: readonly string[];
  readonly promotionBlocked: boolean;
  readonly counterexampleCount: number;
  readonly highRiskAutoAdmitCount: number;
  readonly replayDuplicateRate: number | null;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly policyTwinEvidenceOnly: true;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-policy-twin-summary';
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryPolicyTwinSummaryDescriptor {
  readonly version: typeof POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION;
  readonly statuses: typeof POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_STATUSES;
  readonly baselineAssumption: 'manual-review-everything';
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly policyTwinEvidenceOnly: true;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-policy-twin-summary';
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
    throw new Error(`Policy Foundry Policy Twin summary ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function rounded(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function countRate(count: number, total: number): number {
  if (total <= 0) return 0;
  return rounded(count / total);
}

function emptyCounts(): ShadowPolicyDecisionCounts {
  return Object.freeze({
    admit: 0,
    narrow: 0,
    review: 0,
    block: 0,
  });
}

function matchingSurface(
  report: ShadowPolicySimulationReport | null,
  candidate: ShadowPolicyDiscoveryCandidate | null,
): ShadowPolicySurfaceSimulation | null {
  if (report === null || candidate === null) return null;
  return report.surfaceSimulations.find((surface) =>
    (candidate.actionSurface === null || surface.actionSurface === candidate.actionSurface) &&
    (candidate.domain === null || surface.domain === candidate.domain)
  ) ?? null;
}

function decisionImpact(
  counts: ShadowPolicyDecisionCounts,
  eventCount: number,
): PolicyFoundryPolicyTwinDecisionImpact {
  return Object.freeze({
    admitCount: counts.admit,
    narrowCount: counts.narrow,
    reviewCount: counts.review,
    blockCount: counts.block,
    admitRate: countRate(counts.admit, eventCount),
    narrowRate: countRate(counts.narrow, eventCount),
    reviewRate: countRate(counts.review, eventCount),
    blockRate: countRate(counts.block, eventCount),
  });
}

function reviewLoadImpact(input: {
  readonly eventCount: number;
  readonly reviewCount: number;
  readonly blockCount: number;
}): PolicyFoundryPolicyTwinReviewLoadImpact {
  const reduction = input.eventCount <= 0
    ? 0
    : rounded((input.eventCount - input.reviewCount) / input.eventCount);
  return Object.freeze({
    manualReviewBaselineCount: input.eventCount,
    simulatedReviewCount: input.reviewCount,
    simulatedBlockCount: input.blockCount,
    reviewLoadDeltaCount: input.reviewCount - input.eventCount,
    reviewLoadReductionRate: reduction,
    baselineAssumption: 'manual-review-everything',
  });
}

function statusFor(input: {
  readonly report: ShadowPolicySimulationReport | null;
  readonly readiness: PolicyFoundryReadinessEvaluation | null | undefined;
  readonly promotionBlocked: boolean;
}): PolicyFoundryPolicyTwinSummaryStatus {
  if (input.report === null) return 'not-enough-evidence';
  if (input.promotionBlocked || input.readiness?.status === 'no-go') return 'review-only';
  if (input.readiness?.status === 'enforce-eligible' || input.readiness?.status === 'review-ready') {
    return 'rollout-candidate';
  }
  return 'review-only';
}

function recommendedRolloutStep(
  status: PolicyFoundryPolicyTwinSummaryStatus,
  readiness: PolicyFoundryReadinessEvaluation | null | undefined,
): PolicyFoundryRolloutStep {
  if (status === 'rollout-candidate') return readiness?.recommendedRolloutStep ?? 'review-required';
  if (status === 'review-only') return 'review-required';
  return 'observe-only';
}

export function createPolicyFoundryPolicyTwinSummary(
  input: CreatePolicyFoundryPolicyTwinSummaryInput,
): PolicyFoundryPolicyTwinSummary {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const report = input.report;
  const candidate = input.candidate;
  const surface = matchingSurface(report, candidate);
  const eventCount = surface?.eventCount ?? report?.eventCount ?? 0;
  const counts = surface?.simulatedDecisionCounts ?? report?.simulatedDecisionCounts ?? emptyCounts();
  const gaps = surface?.gapCounts ?? report?.gapCounts ?? {
    policy: 0,
    evidence: 0,
    authority: 0,
    adapter: 0,
  };
  const noGoReasons = Object.freeze(
    [...new Set([
      ...(input.readiness?.noGoReasons ?? []),
      ...(input.counterexampleLedger?.noGoReasons ?? []),
    ])].sort(),
  );
  const promotionBlocked = input.counterexampleLedger?.promotionBlocked === true ||
    noGoReasons.length > 0;
  const status = statusFor({
    report,
    readiness: input.readiness,
    promotionBlocked,
  });
  const impact = decisionImpact(counts, eventCount);
  const reviewImpact = reviewLoadImpact({
    eventCount,
    reviewCount: counts.review,
    blockCount: counts.block,
  });
  const payload = {
    version: POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION as typeof POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION,
    generatedAt,
    candidateId: candidate?.candidateId ?? input.counterexampleLedger?.candidateId ?? null,
    actionSurface: candidate?.actionSurface ?? input.counterexampleLedger?.actionSurface ?? null,
    domain: candidate?.domain ?? input.counterexampleLedger?.domain ?? null,
    sourceReportId: report?.reportId ?? null,
    sourceReportDigest: report?.digest ?? null,
    readinessDigest: input.readiness?.digest ?? null,
    counterexampleLedgerDigest: input.counterexampleLedger?.digest ?? null,
    windowStart: report?.windowStart ?? null,
    windowEnd: report?.windowEnd ?? null,
    proposedMode: report?.proposedMode ?? null,
    status,
    recommendedRolloutStep: recommendedRolloutStep(status, input.readiness),
    eventCount,
    decisionImpact: impact,
    reviewLoadImpact: reviewImpact,
    gapCounts: Object.freeze({
      policy: gaps.policy,
      evidence: gaps.evidence,
      authority: gaps.authority,
      adapter: gaps.adapter,
    }),
    noGoReasons,
    promotionBlocked,
    counterexampleCount: input.counterexampleLedger?.counterexampleCount ?? 0,
    highRiskAutoAdmitCount: input.counterexampleLedger?.highRiskAutoAdmitCount ?? 0,
    replayDuplicateRate: input.counterexampleLedger?.replayDuplicateRate ?? null,
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    activatesEnforcement: false as const,
    policyTwinEvidenceOnly: true as const,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION as typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-policy-twin-summary' as const,
    limitation:
      'Policy Twin summary is a digest-bound backtest summary. It does not activate enforcement or prove production readiness.',
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function policyFoundryPolicyTwinSummaryDescriptor(): PolicyFoundryPolicyTwinSummaryDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION,
    statuses: POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_STATUSES,
    baselineAssumption: 'manual-review-everything',
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    policyTwinEvidenceOnly: true,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-policy-twin-summary',
  });
}
