import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { ShadowAdmissionEvent } from './shadow-events.js';
import type {
  ShadowPolicyPromotionPacket,
  ShadowPolicyPromotionPacketRule,
} from './shadow-policy-promotion-packet.js';

export const SHADOW_POLICY_PROMOTION_SIMULATION_VERSION =
  'attestor.shadow-policy-promotion-simulation.v1';
export const SHADOW_POLICY_PROMOTION_SIMULATION_MAX_EVENTS = 10_000;

export const SHADOW_POLICY_PROMOTION_SIMULATION_OUTCOMES = [
  'admit',
  'audit',
  'warn',
  'hold-for-review',
  'block',
] as const;
export type ShadowPolicyPromotionSimulationOutcome =
  typeof SHADOW_POLICY_PROMOTION_SIMULATION_OUTCOMES[number];

export interface ShadowPolicyPromotionSimulationCounts {
  readonly admit: number;
  readonly audit: number;
  readonly warn: number;
  readonly holdForReview: number;
  readonly block: number;
}

export interface ShadowPolicyPromotionRuleSimulation {
  readonly ruleId: string;
  readonly candidateId: string;
  readonly candidateDigest: string;
  readonly sourceReportDigest: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly targetMode: ShadowPolicyPromotionPacketRule['targetMode'];
  readonly eventCount: number;
  readonly matchedEventDigests: readonly string[];
  readonly impactCounts: ShadowPolicyPromotionSimulationCounts;
  readonly suggestedValidationActions: ShadowPolicyPromotionPacketRule['suggestedValidationActions'];
  readonly requiredControls: ShadowPolicyPromotionPacketRule['requiredControls'];
  readonly reasonCodes: readonly string[];
  readonly simulationNotes: readonly string[];
}

export interface ShadowPolicyPromotionSimulation {
  readonly version: typeof SHADOW_POLICY_PROMOTION_SIMULATION_VERSION;
  readonly simulationId: string;
  readonly generatedAt: string;
  readonly sourcePacketId: string;
  readonly sourcePacketDigest: string;
  readonly sourceBundleDraftDigest: string;
  readonly tenantId: string;
  readonly eventCount: number;
  readonly matchedEventCount: number;
  readonly unmatchedEventCount: number;
  readonly evaluationCount: number;
  readonly impactCounts: ShadowPolicyPromotionSimulationCounts;
  readonly ruleSimulations: readonly ShadowPolicyPromotionRuleSimulation[];
  readonly simulationReady: boolean;
  readonly activationReady: false;
  readonly remainingActivationBlockers: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateShadowPolicyPromotionSimulationInput {
  readonly packet: ShadowPolicyPromotionPacket;
  readonly events: readonly ShadowAdmissionEvent[];
  readonly generatedAt?: string | null;
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

function hashCanonical(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Shadow policy promotion simulation ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function emptyCounts(): ShadowPolicyPromotionSimulationCounts {
  return Object.freeze({
    admit: 0,
    audit: 0,
    warn: 0,
    holdForReview: 0,
    block: 0,
  });
}

function addOutcome(
  counts: ShadowPolicyPromotionSimulationCounts,
  outcome: ShadowPolicyPromotionSimulationOutcome,
): ShadowPolicyPromotionSimulationCounts {
  if (outcome === 'hold-for-review') {
    return Object.freeze({
      ...counts,
      holdForReview: counts.holdForReview + 1,
    });
  }
  return Object.freeze({
    ...counts,
    [outcome]: counts[outcome] + 1,
  });
}

function addCounts(
  left: ShadowPolicyPromotionSimulationCounts,
  right: ShadowPolicyPromotionSimulationCounts,
): ShadowPolicyPromotionSimulationCounts {
  return Object.freeze({
    admit: left.admit + right.admit,
    audit: left.audit + right.audit,
    warn: left.warn + right.warn,
    holdForReview: left.holdForReview + right.holdForReview,
    block: left.block + right.block,
  });
}

function eventMatchesRule(
  event: ShadowAdmissionEvent,
  rule: ShadowPolicyPromotionPacketRule,
): boolean {
  // Tenant filtering is done by the route/store. The matcher only uses
  // data-minimized action metadata and avoids raw payload fields.
  if (rule.domain && event.domain !== rule.domain) return false;
  if (rule.actionSurface && event.actionSurface !== rule.actionSurface) return false;
  return true;
}

function outcomeFor(
  event: ShadowAdmissionEvent,
  rule: ShadowPolicyPromotionPacketRule,
): ShadowPolicyPromotionSimulationOutcome {
  if (rule.targetMode === 'observe') return 'audit';
  if (rule.targetMode === 'warn') return 'warn';
  if (rule.targetMode === 'review') return 'hold-for-review';
  if (event.humanOutcome === 'rejected') return 'block';
  if (event.shadowDecision === 'would_block' || event.effectiveDecision === 'block') return 'block';
  if (event.shadowDecision === 'would_review' || event.effectiveDecision === 'review') {
    return 'hold-for-review';
  }
  if (event.shadowDecision === 'would_narrow' || event.effectiveDecision === 'narrow') {
    return 'hold-for-review';
  }
  return 'admit';
}

function simulationNotesFor(
  rule: ShadowPolicyPromotionPacketRule,
  eventCount: number,
): readonly string[] {
  const notes: string[] = [];
  if (eventCount === 0) notes.push('no-shadow-events-matched-rule');
  if (rule.targetMode === 'enforce') notes.push('enforce-preview-not-activation');
  if (rule.requiredControls.length > 0) notes.push('required-controls-carried-forward');
  return Object.freeze(notes.sort());
}

function simulateRule(
  rule: ShadowPolicyPromotionPacketRule,
  events: readonly ShadowAdmissionEvent[],
): ShadowPolicyPromotionRuleSimulation {
  let impactCounts = emptyCounts();
  const matchedEventDigests: string[] = [];
  for (const event of events) {
    if (!eventMatchesRule(event, rule)) continue;
    const outcome = outcomeFor(event, rule);
    impactCounts = addOutcome(impactCounts, outcome);
    matchedEventDigests.push(event.digest);
  }
  return Object.freeze({
    ruleId: rule.ruleId,
    candidateId: rule.candidateId,
    candidateDigest: rule.candidateDigest,
    sourceReportDigest: rule.sourceReportDigest,
    actionSurface: rule.actionSurface,
    domain: rule.domain,
    targetMode: rule.targetMode,
    eventCount: matchedEventDigests.length,
    matchedEventDigests: Object.freeze([...matchedEventDigests].sort()),
    impactCounts,
    suggestedValidationActions: rule.suggestedValidationActions,
    requiredControls: rule.requiredControls,
    reasonCodes: rule.reasonCodes,
    simulationNotes: simulationNotesFor(rule, matchedEventDigests.length),
  });
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function remainingActivationBlockers(input: {
  readonly packet: ShadowPolicyPromotionPacket;
  readonly ruleSimulations: readonly ShadowPolicyPromotionRuleSimulation[];
}): readonly string[] {
  const blockers = new Set(
    input.packet.activationBlockers.filter((blocker) => blocker !== 'policy-simulation-required'),
  );
  if (input.packet.bundleDraft.ruleCount === 0) blockers.add('policy-simulation-no-rules');
  if (input.ruleSimulations.some((rule) => rule.eventCount === 0)) {
    blockers.add('policy-simulation-unmatched-rules');
  }
  return Object.freeze([...blockers].sort());
}

function simulationIdFor(input: {
  readonly sourcePacketDigest: string;
  readonly sourceBundleDraftDigest: string;
  readonly eventDigests: readonly string[];
}): string {
  return `policy-promotion-simulation:${hashCanonical(input as unknown as CanonicalReleaseJsonValue)}`;
}

export function createShadowPolicyPromotionSimulation(
  input: CreateShadowPolicyPromotionSimulationInput,
): ShadowPolicyPromotionSimulation {
  if (input.events.length > SHADOW_POLICY_PROMOTION_SIMULATION_MAX_EVENTS) {
    throw new Error(
      `Shadow policy promotion simulation event count exceeds maximum: ${input.events.length} > ${SHADOW_POLICY_PROMOTION_SIMULATION_MAX_EVENTS}.`,
    );
  }
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const packet = input.packet;
  const ruleSimulations = Object.freeze(
    packet.bundleDraft.rules
      .map((rule) => simulateRule(rule, input.events))
      .sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
  );
  const matchedEventDigests = uniqueSorted(
    ruleSimulations.flatMap((rule) => [...rule.matchedEventDigests]),
  );
  const eventDigests = uniqueSorted(input.events.map((event) => event.digest));
  const impactCounts = ruleSimulations.reduce(
    (counts, rule) => addCounts(counts, rule.impactCounts),
    emptyCounts(),
  );
  const evaluationCount = ruleSimulations.reduce((sum, rule) => sum + rule.eventCount, 0);
  const blockers = remainingActivationBlockers({ packet, ruleSimulations });
  const payload = {
    version: SHADOW_POLICY_PROMOTION_SIMULATION_VERSION,
    simulationId: simulationIdFor({
      sourcePacketDigest: packet.digest,
      sourceBundleDraftDigest: packet.bundleDraft.digest,
      eventDigests,
    }),
    generatedAt,
    sourcePacketId: packet.packetId,
    sourcePacketDigest: packet.digest,
    sourceBundleDraftDigest: packet.bundleDraft.digest,
    tenantId: packet.tenantId,
    eventCount: input.events.length,
    matchedEventCount: matchedEventDigests.length,
    unmatchedEventCount: input.events.length - matchedEventDigests.length,
    evaluationCount,
    impactCounts,
    ruleSimulations,
    simulationReady: packet.reviewReady && packet.bundleDraft.ruleCount > 0,
    activationReady: false,
    remainingActivationBlockers: blockers,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
