import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionDecision,
  GenericAdmissionMode,
  GenericAdmissionShadowDecision,
} from './index.js';
import type {
  ShadowAdmissionDownstreamOutcome,
  ShadowAdmissionEvent,
  ShadowAdmissionHumanOutcome,
} from './shadow-events.js';

export const ACTION_RISK_INVENTORY_VERSION =
  'attestor.action-risk-inventory.v1';

export const ACTION_RISK_TIERS = [
  'low',
  'medium',
  'high',
  'critical',
] as const;
export type ActionRiskTier = typeof ACTION_RISK_TIERS[number];

export const ACTION_RISK_SIGNALS = [
  'policy-gap',
  'evidence-gap',
  'authority-gap',
  'adapter-gap',
  'review-load',
  'block-observed',
  'human-rejection',
  'downstream-failure',
  'non-enforcing-shadow',
  'clean-shadow-traffic',
] as const;
export type ActionRiskSignal = typeof ACTION_RISK_SIGNALS[number];

export const ACTION_RISK_NEXT_STEPS = [
  'stay-in-shadow',
  'define-policy',
  'bind-evidence',
  'bind-authority',
  'prepare-adapter',
  'investigate-blocks',
  'reduce-review-load',
  'candidate-for-review',
  'candidate-for-enforce',
] as const;
export type ActionRiskNextStep = typeof ACTION_RISK_NEXT_STEPS[number];

export interface CreateActionRiskInventoryInput {
  readonly events: readonly ShadowAdmissionEvent[];
  readonly generatedAt?: string | null;
  readonly minimumPromotionEvents?: number | null;
}

export interface ActionRiskDecisionCounts {
  readonly admit: number;
  readonly narrow: number;
  readonly review: number;
  readonly block: number;
}

export interface ActionRiskGapCounts {
  readonly policy: number;
  readonly evidence: number;
  readonly authority: number;
  readonly adapter: number;
}

export interface ActionRiskSurface {
  readonly actionSurface: string;
  readonly domain: string;
  readonly downstreamSystem: string;
  readonly action: string;
  readonly eventCount: number;
  readonly actorCount: number;
  readonly modeCounts: Readonly<Record<string, number>>;
  readonly shadowDecisionCounts: Readonly<Record<string, number>>;
  readonly effectiveDecisionCounts: ActionRiskDecisionCounts;
  readonly downstreamOutcomes: Readonly<Record<string, number>>;
  readonly humanOutcomes: Readonly<Record<string, number>>;
  readonly gapCounts: ActionRiskGapCounts;
  readonly reviewLoadCount: number;
  readonly blockedCount: number;
  readonly downstreamFailureCount: number;
  readonly humanRejectedCount: number;
  readonly nonEnforcingEventCount: number;
  readonly evidenceRefCount: number;
  readonly nativeInputRefCount: number;
  readonly riskTier: ActionRiskTier;
  readonly riskSignals: readonly ActionRiskSignal[];
  readonly recommendedNextStep: ActionRiskNextStep;
  readonly eventDigests: readonly string[];
}

export interface ActionRiskDomainSummary {
  readonly domain: string;
  readonly surfaceCount: number;
  readonly eventCount: number;
  readonly highestRiskTier: ActionRiskTier;
}

export interface ActionRiskInventory {
  readonly version: typeof ACTION_RISK_INVENTORY_VERSION;
  readonly generatedAt: string;
  readonly windowStart: string | null;
  readonly windowEnd: string | null;
  readonly eventCount: number;
  readonly surfaceCount: number;
  readonly domainSummaries: readonly ActionRiskDomainSummary[];
  readonly surfaces: readonly ActionRiskSurface[];
  readonly rawPayloadStored: false;
  readonly canonical: string;
  readonly digest: string;
}

interface MutableActionRiskSurface {
  readonly actionSurface: string;
  readonly domain: string;
  readonly downstreamSystem: string;
  readonly action: string;
  readonly actors: Set<string>;
  eventCount: number;
  modeCounts: Record<string, number>;
  shadowDecisionCounts: Record<string, number>;
  effectiveDecisionCounts: ActionRiskDecisionCounts;
  downstreamOutcomes: Record<string, number>;
  humanOutcomes: Record<string, number>;
  gapCounts: ActionRiskGapCounts;
  reviewLoadCount: number;
  blockedCount: number;
  downstreamFailureCount: number;
  humanRejectedCount: number;
  nonEnforcingEventCount: number;
  evidenceRefCount: number;
  nativeInputRefCount: number;
  eventDigests: string[];
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
    throw new Error(`Action risk inventory ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function emptyDecisionCounts(): ActionRiskDecisionCounts {
  return Object.freeze({
    admit: 0,
    narrow: 0,
    review: 0,
    block: 0,
  });
}

function emptyGapCounts(): ActionRiskGapCounts {
  return Object.freeze({
    policy: 0,
    evidence: 0,
    authority: 0,
    adapter: 0,
  });
}

function incrementCount<T extends string | null>(
  counts: Record<string, number>,
  value: T,
): Record<string, number> {
  const key = value ?? 'none';
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}

function incrementDecision(
  counts: ActionRiskDecisionCounts,
  decision: ConsequenceAdmissionDecision,
): ActionRiskDecisionCounts {
  return Object.freeze({
    ...counts,
    [decision]: counts[decision] + 1,
  });
}

function gapCountsFor(event: ShadowAdmissionEvent): ActionRiskGapCounts {
  return Object.freeze({
    policy: event.reasonCodes.includes('policy-ref-missing') ? 1 : 0,
    evidence: event.reasonCodes.includes('evidence-ref-missing') ? 1 : 0,
    authority: event.reasonCodes.includes('authority-ref-missing') ? 1 : 0,
    adapter: event.reasonCodes.includes('adapter-readiness-missing') ? 1 : 0,
  });
}

function addGapCounts(
  left: ActionRiskGapCounts,
  right: ActionRiskGapCounts,
): ActionRiskGapCounts {
  return Object.freeze({
    policy: left.policy + right.policy,
    evidence: left.evidence + right.evidence,
    authority: left.authority + right.authority,
    adapter: left.adapter + right.adapter,
  });
}

function surfaceNameFor(event: ShadowAdmissionEvent): string {
  return event.actionSurface ?? `${event.downstreamSystem}.${event.action}`;
}

function surfaceKey(event: ShadowAdmissionEvent): string {
  return `${event.domain}\n${surfaceNameFor(event)}`;
}

function createMutableSurface(event: ShadowAdmissionEvent): MutableActionRiskSurface {
  return {
    actionSurface: surfaceNameFor(event),
    domain: event.domain,
    downstreamSystem: event.downstreamSystem,
    action: event.action,
    actors: new Set<string>(),
    eventCount: 0,
    modeCounts: {},
    shadowDecisionCounts: {},
    effectiveDecisionCounts: emptyDecisionCounts(),
    downstreamOutcomes: {},
    humanOutcomes: {},
    gapCounts: emptyGapCounts(),
    reviewLoadCount: 0,
    blockedCount: 0,
    downstreamFailureCount: 0,
    humanRejectedCount: 0,
    nonEnforcingEventCount: 0,
    evidenceRefCount: 0,
    nativeInputRefCount: 0,
    eventDigests: [],
  };
}

function onlyNonBlockingShadowSignals(signals: readonly ActionRiskSignal[]): boolean {
  return signals.every((signal) => signal === 'non-enforcing-shadow');
}

function actionRiskSignalsFor(
  surface: MutableActionRiskSurface,
  minimumPromotionEvents: number,
): readonly ActionRiskSignal[] {
  const signals: ActionRiskSignal[] = [];
  if (surface.gapCounts.policy > 0) signals.push('policy-gap');
  if (surface.gapCounts.evidence > 0) signals.push('evidence-gap');
  if (surface.gapCounts.authority > 0) signals.push('authority-gap');
  if (surface.gapCounts.adapter > 0) signals.push('adapter-gap');
  if (surface.reviewLoadCount > 0) signals.push('review-load');
  if (surface.blockedCount > 0) signals.push('block-observed');
  if (surface.humanRejectedCount > 0) signals.push('human-rejection');
  if (surface.downstreamFailureCount > 0) signals.push('downstream-failure');
  if (surface.nonEnforcingEventCount > 0) signals.push('non-enforcing-shadow');
  if (
    surface.eventCount >= minimumPromotionEvents &&
    onlyNonBlockingShadowSignals(signals)
  ) {
    signals.push('clean-shadow-traffic');
  }
  return Object.freeze(signals);
}

function riskTierFor(signals: readonly ActionRiskSignal[]): ActionRiskTier {
  if (
    signals.includes('block-observed') ||
    signals.includes('human-rejection') ||
    signals.includes('downstream-failure')
  ) {
    return 'critical';
  }
  if (
    signals.includes('policy-gap') ||
    signals.includes('authority-gap') ||
    signals.includes('adapter-gap')
  ) {
    return 'high';
  }
  if (signals.includes('evidence-gap') || signals.includes('review-load')) {
    return 'medium';
  }
  return 'low';
}

function recommendedNextStepFor(
  surface: MutableActionRiskSurface,
  signals: readonly ActionRiskSignal[],
  minimumPromotionEvents: number,
): ActionRiskNextStep {
  if (
    signals.includes('block-observed') ||
    signals.includes('human-rejection') ||
    signals.includes('downstream-failure')
  ) {
    return 'investigate-blocks';
  }
  if (signals.includes('policy-gap')) return 'define-policy';
  if (signals.includes('evidence-gap')) return 'bind-evidence';
  if (signals.includes('authority-gap')) return 'bind-authority';
  if (signals.includes('adapter-gap')) return 'prepare-adapter';
  if (signals.includes('review-load')) return 'reduce-review-load';
  if (surface.eventCount < minimumPromotionEvents) return 'stay-in-shadow';
  return surface.reviewLoadCount === 0 ? 'candidate-for-enforce' : 'candidate-for-review';
}

function freezeCounts(counts: Record<string, number>): Readonly<Record<string, number>> {
  return Object.freeze({ ...counts });
}

function freezeSurface(
  surface: MutableActionRiskSurface,
  minimumPromotionEvents: number,
): ActionRiskSurface {
  const riskSignals = actionRiskSignalsFor(surface, minimumPromotionEvents);
  const riskTier = riskTierFor(riskSignals);
  return Object.freeze({
    actionSurface: surface.actionSurface,
    domain: surface.domain,
    downstreamSystem: surface.downstreamSystem,
    action: surface.action,
    eventCount: surface.eventCount,
    actorCount: surface.actors.size,
    modeCounts: freezeCounts(surface.modeCounts),
    shadowDecisionCounts: freezeCounts(surface.shadowDecisionCounts),
    effectiveDecisionCounts: surface.effectiveDecisionCounts,
    downstreamOutcomes: freezeCounts(surface.downstreamOutcomes),
    humanOutcomes: freezeCounts(surface.humanOutcomes),
    gapCounts: surface.gapCounts,
    reviewLoadCount: surface.reviewLoadCount,
    blockedCount: surface.blockedCount,
    downstreamFailureCount: surface.downstreamFailureCount,
    humanRejectedCount: surface.humanRejectedCount,
    nonEnforcingEventCount: surface.nonEnforcingEventCount,
    evidenceRefCount: surface.evidenceRefCount,
    nativeInputRefCount: surface.nativeInputRefCount,
    riskTier,
    riskSignals,
    recommendedNextStep: recommendedNextStepFor(surface, riskSignals, minimumPromotionEvents),
    eventDigests: Object.freeze([...surface.eventDigests].sort()),
  });
}

function windowStartFor(events: readonly ShadowAdmissionEvent[]): string | null {
  if (events.length === 0) return null;
  return events
    .map((event) => event.occurredAt)
    .sort()[0] ?? null;
}

function windowEndFor(events: readonly ShadowAdmissionEvent[]): string | null {
  if (events.length === 0) return null;
  return events
    .map((event) => event.occurredAt)
    .sort()
    .at(-1) ?? null;
}

function riskTierRank(tier: ActionRiskTier): number {
  return ACTION_RISK_TIERS.indexOf(tier);
}

function domainSummariesFor(
  surfaces: readonly ActionRiskSurface[],
): readonly ActionRiskDomainSummary[] {
  const summaries = new Map<string, {
    surfaceCount: number;
    eventCount: number;
    highestRiskTier: ActionRiskTier;
  }>();

  for (const surface of surfaces) {
    const current = summaries.get(surface.domain) ?? {
      surfaceCount: 0,
      eventCount: 0,
      highestRiskTier: 'low' as ActionRiskTier,
    };
    const highestRiskTier =
      riskTierRank(surface.riskTier) > riskTierRank(current.highestRiskTier)
        ? surface.riskTier
        : current.highestRiskTier;
    summaries.set(surface.domain, {
      surfaceCount: current.surfaceCount + 1,
      eventCount: current.eventCount + surface.eventCount,
      highestRiskTier,
    });
  }

  return Object.freeze(
    [...summaries.entries()]
      .map(([domain, summary]) => Object.freeze({
        domain,
        ...summary,
      }))
      .sort((left, right) => left.domain.localeCompare(right.domain)),
  );
}

function updateSurface(
  surface: MutableActionRiskSurface,
  event: ShadowAdmissionEvent,
): void {
  const gaps = gapCountsFor(event);
  surface.eventCount += 1;
  surface.actors.add(event.actor);
  surface.modeCounts = incrementCount<GenericAdmissionMode | null>(
    surface.modeCounts,
    event.mode,
  );
  surface.shadowDecisionCounts = incrementCount<GenericAdmissionShadowDecision | null>(
    surface.shadowDecisionCounts,
    event.shadowDecision,
  );
  surface.effectiveDecisionCounts = incrementDecision(
    surface.effectiveDecisionCounts,
    event.effectiveDecision,
  );
  surface.downstreamOutcomes = incrementCount<ShadowAdmissionDownstreamOutcome>(
    surface.downstreamOutcomes,
    event.downstreamOutcome,
  );
  surface.humanOutcomes = incrementCount<ShadowAdmissionHumanOutcome>(
    surface.humanOutcomes,
    event.humanOutcome,
  );
  surface.gapCounts = addGapCounts(surface.gapCounts, gaps);
  if (event.shadowDecision === 'would_review' || event.effectiveDecision === 'review') {
    surface.reviewLoadCount += 1;
  }
  if (event.shadowDecision === 'would_block' || event.effectiveDecision === 'block') {
    surface.blockedCount += 1;
  }
  if (event.downstreamOutcome === 'failed') surface.downstreamFailureCount += 1;
  if (event.humanOutcome === 'rejected') surface.humanRejectedCount += 1;
  if (event.reasonCodes.includes('non-enforcing-mode')) surface.nonEnforcingEventCount += 1;
  surface.evidenceRefCount += event.evidenceRefCount;
  surface.nativeInputRefCount += event.nativeInputRefCount;
  surface.eventDigests.push(event.digest);
}

export function createActionRiskInventory(
  input: CreateActionRiskInventoryInput,
): ActionRiskInventory {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const minimumPromotionEvents = Math.max(1, input.minimumPromotionEvents ?? 5);
  const surfacesByKey = new Map<string, MutableActionRiskSurface>();

  for (const event of input.events) {
    const key = surfaceKey(event);
    const surface = surfacesByKey.get(key) ?? createMutableSurface(event);
    surfacesByKey.set(key, surface);
    updateSurface(surface, event);
  }

  const surfaces = Object.freeze(
    [...surfacesByKey.values()]
      .map((surface) => freezeSurface(surface, minimumPromotionEvents))
      .sort((left, right) => {
        const riskDelta = riskTierRank(right.riskTier) - riskTierRank(left.riskTier);
        if (riskDelta !== 0) return riskDelta;
        if (right.eventCount !== left.eventCount) return right.eventCount - left.eventCount;
        return left.actionSurface.localeCompare(right.actionSurface);
      }),
  );
  const payload = {
    version: ACTION_RISK_INVENTORY_VERSION,
    generatedAt,
    windowStart: windowStartFor(input.events),
    windowEnd: windowEndFor(input.events),
    eventCount: input.events.length,
    surfaceCount: surfaces.length,
    domainSummaries: domainSummariesFor(surfaces),
    surfaces,
    rawPayloadStored: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
