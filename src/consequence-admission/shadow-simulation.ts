import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  GenericAdmissionMode,
  GenericAdmissionShadowDecision,
} from './index.js';
import type {
  ShadowAdmissionEvent,
} from './shadow-events.js';

export const SHADOW_POLICY_SIMULATION_VERSION =
  'attestor.shadow-policy-simulation.v1';
export const SHADOW_POLICY_SIMULATION_MAX_EVENTS = 10_000;
export const SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR = 5;
export const SHADOW_POLICY_SIMULATION_DEFAULT_MINIMUM_PROMOTION_EVENTS =
  SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR;

export const SHADOW_POLICY_RECOMMENDATION_KINDS = [
  'define-policy',
  'bind-evidence',
  'bind-authority',
  'prepare-adapter',
  'investigate-blocks',
  'reduce-review-load',
  'stay-in-shadow',
  'promote-to-review',
  'promote-to-enforce',
] as const;
export type ShadowPolicyRecommendationKind =
  typeof SHADOW_POLICY_RECOMMENDATION_KINDS[number];

export const SHADOW_POLICY_RECOMMENDATION_SEVERITIES = [
  'info',
  'medium',
  'high',
  'blocker',
] as const;
export type ShadowPolicyRecommendationSeverity =
  typeof SHADOW_POLICY_RECOMMENDATION_SEVERITIES[number];

export interface CreateShadowPolicySimulationReportInput {
  readonly events: readonly ShadowAdmissionEvent[];
  readonly proposedMode?: GenericAdmissionMode | null;
  readonly generatedAt?: string | null;
  readonly reportId?: string | null;
  readonly minimumPromotionEvents?: number | null;
}

export interface ShadowPolicyDecisionCounts {
  readonly admit: number;
  readonly narrow: number;
  readonly review: number;
  readonly block: number;
}

export interface ShadowPolicyGapCounts {
  readonly policy: number;
  readonly evidence: number;
  readonly authority: number;
  readonly adapter: number;
}

export interface ShadowPolicySurfaceSimulation {
  readonly actionSurface: string;
  readonly domain: string;
  readonly eventCount: number;
  readonly simulatedDecisionCounts: ShadowPolicyDecisionCounts;
  readonly gapCounts: ShadowPolicyGapCounts;
  readonly downstreamFailures: number;
  readonly humanRejections: number;
  readonly nonEnforcingEvents: number;
  readonly eventDigests: readonly string[];
}

export interface ShadowPolicyRecommendation {
  readonly kind: ShadowPolicyRecommendationKind;
  readonly severity: ShadowPolicyRecommendationSeverity;
  readonly title: string;
  readonly summary: string;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly affectedEvents: number;
  readonly reasonCodes: readonly string[];
  readonly nextMode: GenericAdmissionMode | null;
  readonly confidence: number;
}

export interface ShadowPolicySimulationReport {
  readonly version: typeof SHADOW_POLICY_SIMULATION_VERSION;
  readonly reportId: string;
  readonly generatedAt: string;
  readonly windowStart: string | null;
  readonly windowEnd: string | null;
  readonly proposedMode: GenericAdmissionMode;
  readonly eventCount: number;
  readonly eventDigests: readonly string[];
  readonly requestedMinimumPromotionEvents: number | null;
  readonly minimumPromotionEvents: number;
  readonly minimumPromotionEventsFloor: typeof SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR;
  readonly minimumPromotionEventsSource:
    | 'server-default-floor'
    | 'caller-request'
    | 'caller-request-raised-to-floor';
  readonly simulatedDecisionCounts: ShadowPolicyDecisionCounts;
  readonly gapCounts: ShadowPolicyGapCounts;
  readonly reviewLoadCount: number;
  readonly blockedCount: number;
  readonly nonEnforcingEventCount: number;
  readonly rawPayloadEventCount: number;
  readonly surfaceSimulations: readonly ShadowPolicySurfaceSimulation[];
  readonly recommendations: readonly ShadowPolicyRecommendation[];
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

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Shadow policy simulation ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Shadow policy simulation ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Shadow policy simulation ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeMode(value: GenericAdmissionMode | null | undefined): GenericAdmissionMode {
  if (value === undefined || value === null) return 'review';
  if (!['observe', 'warn', 'review', 'enforce'].includes(value)) {
    throw new Error('Shadow policy simulation proposedMode must be observe, warn, review, or enforce.');
  }
  return value;
}

function normalizeMinimumPromotionEvents(
  value: number | null | undefined,
): {
  readonly requested: number | null;
  readonly effective: number;
  readonly source:
    | 'server-default-floor'
    | 'caller-request'
    | 'caller-request-raised-to-floor';
} {
  if (value === undefined || value === null) {
    return Object.freeze({
      requested: null,
      effective: SHADOW_POLICY_SIMULATION_DEFAULT_MINIMUM_PROMOTION_EVENTS,
      source: 'server-default-floor',
    });
  }
  if (
    !Number.isInteger(value) ||
    value <= 0 ||
    value > SHADOW_POLICY_SIMULATION_MAX_EVENTS
  ) {
    throw new Error(
      `Shadow policy simulation minimumPromotionEvents must be a positive integer no larger than ${SHADOW_POLICY_SIMULATION_MAX_EVENTS}.`,
    );
  }
  if (value < SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR) {
    return Object.freeze({
      requested: value,
      effective: SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR,
      source: 'caller-request-raised-to-floor',
    });
  }
  return Object.freeze({
    requested: value,
    effective: value,
    source: 'caller-request',
  });
}

function emptyDecisionCounts(): ShadowPolicyDecisionCounts {
  return Object.freeze({
    admit: 0,
    narrow: 0,
    review: 0,
    block: 0,
  });
}

function emptyGapCounts(): ShadowPolicyGapCounts {
  return Object.freeze({
    policy: 0,
    evidence: 0,
    authority: 0,
    adapter: 0,
  });
}

function incrementDecision(
  counts: ShadowPolicyDecisionCounts,
  decision: keyof ShadowPolicyDecisionCounts,
): ShadowPolicyDecisionCounts {
  return Object.freeze({
    ...counts,
    [decision]: counts[decision] + 1,
  });
}

function gapCountsFor(event: ShadowAdmissionEvent): ShadowPolicyGapCounts {
  return Object.freeze({
    policy: event.reasonCodes.includes('policy-ref-missing') ? 1 : 0,
    evidence: event.reasonCodes.includes('evidence-ref-missing') ? 1 : 0,
    authority: event.reasonCodes.includes('authority-ref-missing') ? 1 : 0,
    adapter: event.reasonCodes.includes('adapter-readiness-missing') ? 1 : 0,
  });
}

function addGapCounts(
  left: ShadowPolicyGapCounts,
  right: ShadowPolicyGapCounts,
): ShadowPolicyGapCounts {
  return Object.freeze({
    policy: left.policy + right.policy,
    evidence: left.evidence + right.evidence,
    authority: left.authority + right.authority,
    adapter: left.adapter + right.adapter,
  });
}

function simulatedDecisionFor(
  event: ShadowAdmissionEvent,
  proposedMode: GenericAdmissionMode,
): keyof ShadowPolicyDecisionCounts {
  if (proposedMode === 'observe' || proposedMode === 'warn') {
    return 'admit';
  }

  const shadowDecision: GenericAdmissionShadowDecision | null = event.shadowDecision;
  if (shadowDecision === 'would_admit') return 'admit';
  if (shadowDecision === 'would_narrow') return 'narrow';
  if (shadowDecision === 'would_review') return 'review';
  if (shadowDecision === 'would_block') return 'block';
  return event.effectiveDecision;
}

interface MutableSurfaceSimulation {
  readonly actionSurface: string;
  readonly domain: string;
  eventCount: number;
  simulatedDecisionCounts: ShadowPolicyDecisionCounts;
  gapCounts: ShadowPolicyGapCounts;
  downstreamFailures: number;
  humanRejections: number;
  nonEnforcingEvents: number;
  eventDigests: string[];
}

function surfaceKey(event: ShadowAdmissionEvent): string {
  return `${event.domain}\n${event.actionSurface ?? `${event.downstreamSystem}.${event.action}`}`;
}

function createSurfaceSimulation(
  event: ShadowAdmissionEvent,
): MutableSurfaceSimulation {
  return {
    actionSurface: event.actionSurface ?? `${event.downstreamSystem}.${event.action}`,
    domain: event.domain,
    eventCount: 0,
    simulatedDecisionCounts: emptyDecisionCounts(),
    gapCounts: emptyGapCounts(),
    downstreamFailures: 0,
    humanRejections: 0,
    nonEnforcingEvents: 0,
    eventDigests: [],
  };
}

function freezeSurfaceSimulation(
  surface: MutableSurfaceSimulation,
): ShadowPolicySurfaceSimulation {
  return Object.freeze({
    actionSurface: surface.actionSurface,
    domain: surface.domain,
    eventCount: surface.eventCount,
    simulatedDecisionCounts: surface.simulatedDecisionCounts,
    gapCounts: surface.gapCounts,
    downstreamFailures: surface.downstreamFailures,
    humanRejections: surface.humanRejections,
    nonEnforcingEvents: surface.nonEnforcingEvents,
    eventDigests: Object.freeze([...surface.eventDigests].sort()),
  });
}

function recommendation(input: ShadowPolicyRecommendation): ShadowPolicyRecommendation {
  return Object.freeze({
    ...input,
    reasonCodes: Object.freeze([...input.reasonCodes]),
  });
}

function recommendationsForSurface(
  surface: ShadowPolicySurfaceSimulation,
  minimumPromotionEvents: number,
): readonly ShadowPolicyRecommendation[] {
  const items: ShadowPolicyRecommendation[] = [];
  if (surface.gapCounts.policy > 0) {
    items.push(recommendation({
      kind: 'define-policy',
      severity: 'high',
      title: 'Define an enforceable policy for this action surface',
      summary:
        'Shadow traffic reached this action surface without a policy reference. Do not promote it to enforcement until a customer-approved policy is bound.',
      actionSurface: surface.actionSurface,
      domain: surface.domain,
      affectedEvents: surface.gapCounts.policy,
      reasonCodes: ['policy-ref-missing'],
      nextMode: 'observe',
      confidence: 0.95,
    }));
  }
  if (surface.gapCounts.evidence > 0) {
    items.push(recommendation({
      kind: 'bind-evidence',
      severity: 'high',
      title: 'Bind evidence before this action can be admitted',
      summary:
        'The proposed action was evaluated without enough evidence references. Add durable evidence binding before review or enforce mode.',
      actionSurface: surface.actionSurface,
      domain: surface.domain,
      affectedEvents: surface.gapCounts.evidence,
      reasonCodes: ['evidence-ref-missing'],
      nextMode: 'observe',
      confidence: 0.9,
    }));
  }
  if (surface.gapCounts.authority > 0) {
    items.push(recommendation({
      kind: 'bind-authority',
      severity: 'high',
      title: 'Bind actor authority before enforcement',
      summary:
        'Shadow traffic showed missing authority closure. Require actor, reviewer, signer, or delegation evidence before the downstream action executes.',
      actionSurface: surface.actionSurface,
      domain: surface.domain,
      affectedEvents: surface.gapCounts.authority,
      reasonCodes: ['authority-ref-missing'],
      nextMode: 'observe',
      confidence: 0.9,
    }));
  }
  if (surface.gapCounts.adapter > 0) {
    items.push(recommendation({
      kind: 'prepare-adapter',
      severity: 'high',
      title: 'Prepare the downstream adapter before programmable execution',
      summary:
        'The action surface needs adapter readiness before Attestor can safely bind policy, authority, proof, and downstream verification.',
      actionSurface: surface.actionSurface,
      domain: surface.domain,
      affectedEvents: surface.gapCounts.adapter,
      reasonCodes: ['adapter-readiness-missing'],
      nextMode: 'observe',
      confidence: 0.9,
    }));
  }
  if (surface.simulatedDecisionCounts.block > 0 || surface.humanRejections > 0) {
    items.push(recommendation({
      kind: 'investigate-blocks',
      severity: 'blocker',
      title: 'Investigate blocked or rejected actions before promotion',
      summary:
        'Shadow replay found actions that would block or were rejected by humans. Treat this surface as unsafe to auto-enforce until the cause is resolved.',
      actionSurface: surface.actionSurface,
      domain: surface.domain,
      affectedEvents: surface.simulatedDecisionCounts.block + surface.humanRejections,
      reasonCodes: ['shadow-block-or-human-rejection'],
      nextMode: 'observe',
      confidence: 0.85,
    }));
  }
  if (
    surface.simulatedDecisionCounts.review > 0 &&
    surface.simulatedDecisionCounts.review * 2 >= surface.eventCount
  ) {
    items.push(recommendation({
      kind: 'reduce-review-load',
      severity: 'medium',
      title: 'Reduce expected review load before enforcement',
      summary:
        'A large share of this surface would go to review. Add policy, evidence, or adapter closure before using enforce mode.',
      actionSurface: surface.actionSurface,
      domain: surface.domain,
      affectedEvents: surface.simulatedDecisionCounts.review,
      reasonCodes: ['review-load-high'],
      nextMode: 'review',
      confidence: 0.75,
    }));
  }
  if (
    surface.eventCount >= minimumPromotionEvents &&
    surface.gapCounts.policy === 0 &&
    surface.gapCounts.evidence === 0 &&
    surface.gapCounts.authority === 0 &&
    surface.gapCounts.adapter === 0 &&
    surface.simulatedDecisionCounts.block === 0 &&
    surface.humanRejections === 0
  ) {
    items.push(recommendation({
      kind: surface.simulatedDecisionCounts.review === 0
        ? 'promote-to-enforce'
        : 'promote-to-review',
      severity: 'info',
      title: surface.simulatedDecisionCounts.review === 0
        ? 'Candidate for enforce-mode rehearsal'
        : 'Candidate for review-mode rehearsal',
      summary:
        'This action surface has enough shadow events without policy, evidence, authority, adapter, block, or rejection gaps. Rehearse the next mode with customer approval.',
      actionSurface: surface.actionSurface,
      domain: surface.domain,
      affectedEvents: surface.eventCount,
      reasonCodes: ['promotion-candidate'],
      nextMode: surface.simulatedDecisionCounts.review === 0 ? 'enforce' : 'review',
      confidence: 0.7,
    }));
  }
  return Object.freeze(items);
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

function reportIdFor(input: {
  readonly generatedAt: string;
  readonly proposedMode: GenericAdmissionMode;
  readonly eventDigests: readonly string[];
}): string {
  return `shadow-simulation:${canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest}`;
}

export function createShadowPolicySimulationReport(
  input: CreateShadowPolicySimulationReportInput,
): ShadowPolicySimulationReport {
  if (input.events.length > SHADOW_POLICY_SIMULATION_MAX_EVENTS) {
    throw new Error(
      `Shadow policy simulation event count exceeds maximum: ${input.events.length} > ${SHADOW_POLICY_SIMULATION_MAX_EVENTS}.`,
    );
  }
  const proposedMode = normalizeMode(input.proposedMode);
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const minimumPromotionEvents = normalizeMinimumPromotionEvents(input.minimumPromotionEvents);
  const eventDigests = Object.freeze(input.events.map((event) => event.digest).sort());
  const reportId = input.reportId
    ? normalizeIdentifier(input.reportId, 'reportId')
    : reportIdFor({ generatedAt, proposedMode, eventDigests });

  let simulatedDecisionCounts = emptyDecisionCounts();
  let gapCounts = emptyGapCounts();
  let nonEnforcingEventCount = 0;
  let rawPayloadEventCount = 0;
  const surfaces = new Map<string, MutableSurfaceSimulation>();

  for (const event of input.events) {
    const decision = simulatedDecisionFor(event, proposedMode);
    const eventGapCounts = gapCountsFor(event);
    const key = surfaceKey(event);
    const surface = surfaces.get(key) ?? createSurfaceSimulation(event);
    surfaces.set(key, surface);

    simulatedDecisionCounts = incrementDecision(simulatedDecisionCounts, decision);
    gapCounts = addGapCounts(gapCounts, eventGapCounts);
    if (event.reasonCodes.includes('non-enforcing-mode')) nonEnforcingEventCount += 1;
    if (event.rawPayloadStored) rawPayloadEventCount += 1;

    surface.eventCount += 1;
    surface.simulatedDecisionCounts = incrementDecision(
      surface.simulatedDecisionCounts,
      decision,
    );
    surface.gapCounts = addGapCounts(surface.gapCounts, eventGapCounts);
    if (event.downstreamOutcome === 'failed') surface.downstreamFailures += 1;
    if (event.humanOutcome === 'rejected') surface.humanRejections += 1;
    if (event.reasonCodes.includes('non-enforcing-mode')) surface.nonEnforcingEvents += 1;
    surface.eventDigests.push(event.digest);
  }

  const surfaceSimulations = Object.freeze(
    [...surfaces.values()]
      .map(freezeSurfaceSimulation)
      .sort((left, right) => left.actionSurface.localeCompare(right.actionSurface)),
  );
  const recommendations = Object.freeze(
    surfaceSimulations.flatMap((surface) =>
      recommendationsForSurface(surface, minimumPromotionEvents.effective),
    ),
  );
  const payload = {
    version: SHADOW_POLICY_SIMULATION_VERSION,
    reportId,
    generatedAt,
    windowStart: windowStartFor(input.events),
    windowEnd: windowEndFor(input.events),
    proposedMode,
    eventCount: input.events.length,
    eventDigests,
    requestedMinimumPromotionEvents: minimumPromotionEvents.requested,
    minimumPromotionEvents: minimumPromotionEvents.effective,
    minimumPromotionEventsFloor: SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR,
    minimumPromotionEventsSource: minimumPromotionEvents.source,
    simulatedDecisionCounts,
    gapCounts,
    reviewLoadCount: simulatedDecisionCounts.review,
    blockedCount: simulatedDecisionCounts.block,
    nonEnforcingEventCount,
    rawPayloadEventCount,
    surfaceSimulations,
    recommendations,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
