import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  type ConsequenceFailureControlBinding,
} from './failure-mode-control-bindings.js';

export const CONSEQUENCE_HUMAN_REVIEW_FATIGUE_GUARD_VERSION =
  'attestor.consequence-human-review-fatigue-guard.v1';

export const CONSEQUENCE_HUMAN_REVIEW_FATIGUE_OUTCOMES = [
  'pass',
  'review',
  'block',
] as const;
export type ConsequenceHumanReviewFatigueOutcome =
  typeof CONSEQUENCE_HUMAN_REVIEW_FATIGUE_OUTCOMES[number];

export const CONSEQUENCE_HUMAN_REVIEW_SURFACE_KINDS = [
  'policy-foundry-hosted-review-surface',
  'external-review-packet',
  'release-reviewer-queue',
  'audit-evidence-export',
  'custom-review-packet',
] as const;
export type ConsequenceHumanReviewSurfaceKind =
  typeof CONSEQUENCE_HUMAN_REVIEW_SURFACE_KINDS[number];

export const CONSEQUENCE_HUMAN_REVIEW_FATIGUE_REASON_CODES = [
  'review-packet-missing',
  'no-go-summary-missing',
  'missing-evidence-summary-missing',
  'reviewer-focus-areas-missing',
  'next-safe-step-missing',
  'too-many-review-items',
  'too-many-low-priority-items',
  'too-many-reviewer-instructions',
  'review-time-budget-exceeded',
  'blockers-not-prioritized',
  'raw-payload-stored',
  'auto-enforce-requested',
  'approval-not-required',
  'review-fatigue-pass',
  'review-fatigue-review',
  'review-fatigue-block',
] as const;
export type ConsequenceHumanReviewFatigueReasonCode =
  typeof CONSEQUENCE_HUMAN_REVIEW_FATIGUE_REASON_CODES[number];

export interface ConsequenceHumanReviewFatigueMetrics {
  readonly totalReviewItems?: number | null;
  readonly lowPriorityItems?: number | null;
  readonly blockerItems?: number | null;
  readonly noGoItems?: number | null;
  readonly missingEvidenceItems?: number | null;
  readonly focusAreaCount?: number | null;
  readonly evidenceDigestCardCount?: number | null;
  readonly taskCount?: number | null;
  readonly findingCount?: number | null;
  readonly reviewerInstructionCount?: number | null;
  readonly estimatedReviewMinutes?: number | null;
  readonly blockersFirst?: boolean | null;
  readonly hasNoGoSummary?: boolean | null;
  readonly hasMissingEvidenceSummary?: boolean | null;
  readonly hasReviewerFocusAreas?: boolean | null;
  readonly hasNextSafeStep?: boolean | null;
  readonly approvalRequired?: boolean | null;
  readonly rawPayloadStored?: boolean | null;
  readonly autoEnforceRequested?: boolean | null;
}

export interface ConsequenceHumanReviewFatigueThresholds {
  readonly maxReviewItems?: number | null;
  readonly maxLowPriorityRatio?: number | null;
  readonly maxReviewerInstructionCount?: number | null;
  readonly maxEstimatedReviewMinutes?: number | null;
}

export interface EvaluateConsequenceHumanReviewFatigueInput {
  readonly generatedAt?: string | null;
  readonly actionSurface?: string | null;
  readonly action?: string | null;
  readonly reviewSurfaceKind?: ConsequenceHumanReviewSurfaceKind | null;
  readonly reviewPacketRef?: string | null;
  readonly metrics?: ConsequenceHumanReviewFatigueMetrics | null;
  readonly thresholds?: ConsequenceHumanReviewFatigueThresholds | null;
}

export interface ConsequenceHumanReviewFatigueDecision {
  readonly version: typeof CONSEQUENCE_HUMAN_REVIEW_FATIGUE_GUARD_VERSION;
  readonly generatedAt: string;
  readonly actionSurface?: string;
  readonly action?: string;
  readonly reviewSurfaceKind: ConsequenceHumanReviewSurfaceKind;
  readonly outcome: ConsequenceHumanReviewFatigueOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly ConsequenceHumanReviewFatigueReasonCode[];
  readonly failureModeId: 'human-review-fatigue';
  readonly invariantIds: readonly [
    'human-review-packet-must-highlight-risk',
    'trusted-evidence-required',
    'no-go-hold-overrides-natural-language',
  ];
  readonly protectedPrinciples: readonly [
    'customer authority',
    'no overclaim',
    'auditability',
  ];
  readonly requiredControls: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly requiredAuthoritySources: readonly string[];
  readonly requiredAuditRecords: readonly string[];
  readonly observed: {
    readonly reviewPacketRefDigest: string | null;
    readonly totalReviewItems: number;
    readonly lowPriorityItems: number;
    readonly lowPriorityRatio: number;
    readonly blockerItems: number;
    readonly noGoItems: number;
    readonly missingEvidenceItems: number;
    readonly focusAreaCount: number;
    readonly evidenceDigestCardCount: number;
    readonly taskCount: number;
    readonly findingCount: number;
    readonly reviewerInstructionCount: number;
    readonly estimatedReviewMinutes: number;
    readonly blockersFirst: boolean;
    readonly hasNoGoSummary: boolean;
    readonly hasMissingEvidenceSummary: boolean;
    readonly hasReviewerFocusAreas: boolean;
    readonly hasNextSafeStep: boolean;
    readonly approvalRequired: boolean;
    readonly rawPayloadStored: boolean;
    readonly autoEnforceRequested: boolean;
  };
  readonly thresholds: {
    readonly maxReviewItems: number;
    readonly maxLowPriorityRatio: number;
    readonly maxReviewerInstructionCount: number;
    readonly maxEstimatedReviewMinutes: number;
  };
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly digestOnly: true;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceHumanReviewFatigueGuardDescriptor {
  readonly version: typeof CONSEQUENCE_HUMAN_REVIEW_FATIGUE_GUARD_VERSION;
  readonly failureModeId: 'human-review-fatigue';
  readonly outcomes: typeof CONSEQUENCE_HUMAN_REVIEW_FATIGUE_OUTCOMES;
  readonly reviewSurfaceKinds: typeof CONSEQUENCE_HUMAN_REVIEW_SURFACE_KINDS;
  readonly reasonCodes: typeof CONSEQUENCE_HUMAN_REVIEW_FATIGUE_REASON_CODES;
  readonly defaultMaxReviewItems: number;
  readonly defaultMaxLowPriorityRatio: number;
  readonly defaultMaxReviewerInstructionCount: number;
  readonly defaultMaxEstimatedReviewMinutes: number;
  readonly storesRawReviewPacket: false;
  readonly digestOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
}

const DEFAULT_MAX_REVIEW_ITEMS = 12;
const DEFAULT_MAX_LOW_PRIORITY_RATIO = 0.5;
const DEFAULT_MAX_REVIEWER_INSTRUCTION_COUNT = 5;
const DEFAULT_MAX_ESTIMATED_REVIEW_MINUTES = 12;

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

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeCount(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizePositiveCount(value: number | null | undefined, fallback: number): number {
  const normalized = normalizeCount(value);
  return normalized > 0 ? normalized : fallback;
}

function normalizeRatio(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function normalizeBoolean(value: boolean | null | undefined): boolean {
  return value === true;
}

function uniqueReasonCodes(
  reasonCodes: readonly ConsequenceHumanReviewFatigueReasonCode[],
): readonly ConsequenceHumanReviewFatigueReasonCode[] {
  return Object.freeze([...new Set(reasonCodes)]);
}

function humanReviewFatigueBinding(): ConsequenceFailureControlBinding {
  const found = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find((item) =>
    item.failureModeId === 'human-review-fatigue'
  );
  if (!found) {
    throw new Error('Missing failure control binding for human-review-fatigue.');
  }
  return found;
}

export function evaluateConsequenceHumanReviewFatigue(
  input: EvaluateConsequenceHumanReviewFatigueInput,
): ConsequenceHumanReviewFatigueDecision {
  const generatedAt = normalizeOptionalString(input.generatedAt) ?? new Date(0).toISOString();
  const actionSurface = normalizeOptionalString(input.actionSurface);
  const action = normalizeOptionalString(input.action);
  const reviewSurfaceKind =
    input.reviewSurfaceKind ?? 'custom-review-packet';
  const metrics = input.metrics ?? null;
  const thresholds = Object.freeze({
    maxReviewItems: normalizePositiveCount(
      input.thresholds?.maxReviewItems,
      DEFAULT_MAX_REVIEW_ITEMS,
    ),
    maxLowPriorityRatio: normalizeRatio(
      input.thresholds?.maxLowPriorityRatio,
      DEFAULT_MAX_LOW_PRIORITY_RATIO,
    ),
    maxReviewerInstructionCount: normalizePositiveCount(
      input.thresholds?.maxReviewerInstructionCount,
      DEFAULT_MAX_REVIEWER_INSTRUCTION_COUNT,
    ),
    maxEstimatedReviewMinutes: normalizePositiveCount(
      input.thresholds?.maxEstimatedReviewMinutes,
      DEFAULT_MAX_ESTIMATED_REVIEW_MINUTES,
    ),
  });

  const totalReviewItems = normalizeCount(metrics?.totalReviewItems);
  const lowPriorityItems = normalizeCount(metrics?.lowPriorityItems);
  const blockerItems = normalizeCount(metrics?.blockerItems);
  const noGoItems = normalizeCount(metrics?.noGoItems);
  const missingEvidenceItems = normalizeCount(metrics?.missingEvidenceItems);
  const focusAreaCount = normalizeCount(metrics?.focusAreaCount);
  const evidenceDigestCardCount = normalizeCount(metrics?.evidenceDigestCardCount);
  const taskCount = normalizeCount(metrics?.taskCount);
  const findingCount = normalizeCount(metrics?.findingCount);
  const reviewerInstructionCount = normalizeCount(metrics?.reviewerInstructionCount);
  const estimatedReviewMinutes = normalizeCount(metrics?.estimatedReviewMinutes);
  const lowPriorityRatio =
    totalReviewItems > 0 ? Number((lowPriorityItems / totalReviewItems).toFixed(4)) : 0;

  const observed = Object.freeze({
    reviewPacketRefDigest: normalizeOptionalString(input.reviewPacketRef)
      ? digestText(normalizeOptionalString(input.reviewPacketRef) as string)
      : null,
    totalReviewItems,
    lowPriorityItems,
    lowPriorityRatio,
    blockerItems,
    noGoItems,
    missingEvidenceItems,
    focusAreaCount,
    evidenceDigestCardCount,
    taskCount,
    findingCount,
    reviewerInstructionCount,
    estimatedReviewMinutes,
    blockersFirst: normalizeBoolean(metrics?.blockersFirst),
    hasNoGoSummary: normalizeBoolean(metrics?.hasNoGoSummary),
    hasMissingEvidenceSummary: normalizeBoolean(metrics?.hasMissingEvidenceSummary),
    hasReviewerFocusAreas: normalizeBoolean(metrics?.hasReviewerFocusAreas),
    hasNextSafeStep: normalizeBoolean(metrics?.hasNextSafeStep),
    approvalRequired: metrics?.approvalRequired !== false,
    rawPayloadStored: normalizeBoolean(metrics?.rawPayloadStored),
    autoEnforceRequested: normalizeBoolean(metrics?.autoEnforceRequested),
  });

  const blockReasons: ConsequenceHumanReviewFatigueReasonCode[] = [];
  const reviewReasons: ConsequenceHumanReviewFatigueReasonCode[] = [];

  if (!metrics) blockReasons.push('review-packet-missing');
  if (observed.rawPayloadStored) blockReasons.push('raw-payload-stored');
  if (observed.autoEnforceRequested) blockReasons.push('auto-enforce-requested');
  if (!observed.approvalRequired) blockReasons.push('approval-not-required');
  if (observed.noGoItems > 0 && !observed.hasNoGoSummary) {
    blockReasons.push('no-go-summary-missing');
  }
  if (observed.blockerItems > 0 && !observed.blockersFirst) {
    blockReasons.push('blockers-not-prioritized');
  }

  if (observed.missingEvidenceItems > 0 && !observed.hasMissingEvidenceSummary) {
    reviewReasons.push('missing-evidence-summary-missing');
  }
  if (observed.focusAreaCount === 0 || !observed.hasReviewerFocusAreas) {
    reviewReasons.push('reviewer-focus-areas-missing');
  }
  if (!observed.hasNextSafeStep) reviewReasons.push('next-safe-step-missing');
  if (observed.totalReviewItems > thresholds.maxReviewItems) {
    reviewReasons.push('too-many-review-items');
  }
  if (
    observed.totalReviewItems > 0 &&
    observed.lowPriorityRatio > thresholds.maxLowPriorityRatio
  ) {
    reviewReasons.push('too-many-low-priority-items');
  }
  if (observed.reviewerInstructionCount > thresholds.maxReviewerInstructionCount) {
    reviewReasons.push('too-many-reviewer-instructions');
  }
  if (observed.estimatedReviewMinutes > thresholds.maxEstimatedReviewMinutes) {
    reviewReasons.push('review-time-budget-exceeded');
  }

  const outcome: ConsequenceHumanReviewFatigueOutcome =
    blockReasons.length > 0 ? 'block' : reviewReasons.length > 0 ? 'review' : 'pass';
  const reasonCodes = uniqueReasonCodes([
    ...blockReasons,
    ...reviewReasons,
    outcome === 'block'
      ? 'review-fatigue-block'
      : outcome === 'review'
        ? 'review-fatigue-review'
        : 'review-fatigue-pass',
  ]);
  const binding = humanReviewFatigueBinding();
  const canonical = canonicalObject({
    version: CONSEQUENCE_HUMAN_REVIEW_FATIGUE_GUARD_VERSION,
    generatedAt,
    ...(actionSurface ? { actionSurface } : {}),
    ...(action ? { action } : {}),
    reviewSurfaceKind,
    outcome,
    reasonCodes,
    observed,
    thresholds,
  });

  return Object.freeze({
    version: CONSEQUENCE_HUMAN_REVIEW_FATIGUE_GUARD_VERSION,
    generatedAt,
    ...(actionSurface ? { actionSurface } : {}),
    ...(action ? { action } : {}),
    reviewSurfaceKind,
    outcome,
    allowed: outcome === 'pass',
    failClosed: outcome !== 'pass',
    reasonCodes,
    failureModeId: 'human-review-fatigue',
    invariantIds: [
      'human-review-packet-must-highlight-risk',
      'trusted-evidence-required',
      'no-go-hold-overrides-natural-language',
    ] as const,
    protectedPrinciples: [
      'customer authority',
      'no overclaim',
      'auditability',
    ] as const,
    requiredControls: binding.controlIds,
    requiredEvidence: binding.requiredEvidence,
    requiredAuthoritySources: binding.requiredAuthority,
    requiredAuditRecords: binding.requiredAuditRecords,
    observed,
    thresholds,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    digestOnly: true,
    limitation:
      'This guard checks deterministic review packet hygiene and reviewer-load signals. It is not a human-factors certification and does not prove live reviewer capacity or customer UX telemetry.',
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function consequenceHumanReviewFatigueGuardDescriptor():
ConsequenceHumanReviewFatigueGuardDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_HUMAN_REVIEW_FATIGUE_GUARD_VERSION,
    failureModeId: 'human-review-fatigue',
    outcomes: CONSEQUENCE_HUMAN_REVIEW_FATIGUE_OUTCOMES,
    reviewSurfaceKinds: CONSEQUENCE_HUMAN_REVIEW_SURFACE_KINDS,
    reasonCodes: CONSEQUENCE_HUMAN_REVIEW_FATIGUE_REASON_CODES,
    defaultMaxReviewItems: DEFAULT_MAX_REVIEW_ITEMS,
    defaultMaxLowPriorityRatio: DEFAULT_MAX_LOW_PRIORITY_RATIO,
    defaultMaxReviewerInstructionCount: DEFAULT_MAX_REVIEWER_INSTRUCTION_COUNT,
    defaultMaxEstimatedReviewMinutes: DEFAULT_MAX_ESTIMATED_REVIEW_MINUTES,
    storesRawReviewPacket: false,
    digestOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
  });
}
