import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { GenericAdmissionMode } from './index.js';
import type {
  ShadowPolicyRecommendation,
  ShadowPolicyRecommendationKind,
  ShadowPolicyRecommendationSeverity,
  ShadowPolicySimulationReport,
} from './shadow-simulation.js';

export const SHADOW_POLICY_DISCOVERY_VERSION =
  'attestor.shadow-policy-discovery-candidates.v1';

export const POLICY_DISCOVERY_CONTROL_CLOSURES = [
  'policy',
  'evidence',
  'authority',
  'scope',
  'adapter',
  'custom-domain',
  'review-load',
  'block-investigation',
  'customer-approval',
] as const;
export type PolicyDiscoveryControlClosure =
  typeof POLICY_DISCOVERY_CONTROL_CLOSURES[number];

export const POLICY_DISCOVERY_CANDIDATE_ACTIONS = [
  'stay-in-shadow',
  'draft-policy',
  'bind-evidence',
  'bind-authority',
  'bind-amount-scope',
  'bind-recipient-scope',
  'bind-data-scope',
  'prepare-adapter',
  'scope-custom-domain',
  'investigate-blocks',
  'reduce-review-load',
  'review-mode-rehearsal',
  'enforce-mode-rehearsal',
] as const;
export type PolicyDiscoveryCandidateAction =
  typeof POLICY_DISCOVERY_CANDIDATE_ACTIONS[number];

export interface CreateShadowPolicyDiscoveryCandidatesInput {
  readonly report: ShadowPolicySimulationReport | null;
  readonly generatedAt?: string | null;
}

export interface ShadowPolicyDiscoveryCandidate {
  readonly candidateId: string;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly action: PolicyDiscoveryCandidateAction;
  readonly proposedMode: GenericAdmissionMode;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly requiredControls: readonly PolicyDiscoveryControlClosure[];
  readonly sourceRecommendationKinds: readonly ShadowPolicyRecommendationKind[];
  readonly highestSeverity: ShadowPolicyRecommendationSeverity;
  readonly affectedEvents: number;
  readonly confidence: number;
  readonly reasonCodes: readonly string[];
  readonly summary: string;
}

export interface ShadowPolicyDiscoveryCandidates {
  readonly version: typeof SHADOW_POLICY_DISCOVERY_VERSION;
  readonly generatedAt: string;
  readonly sourceReportId: string | null;
  readonly sourceReportDigest: string | null;
  readonly windowStart: string | null;
  readonly windowEnd: string | null;
  readonly candidateCount: number;
  readonly candidates: readonly ShadowPolicyDiscoveryCandidate[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly canonical: string;
  readonly digest: string;
}

interface MutableCandidate {
  readonly actionSurface: string | null;
  readonly domain: string | null;
  action: PolicyDiscoveryCandidateAction;
  proposedMode: GenericAdmissionMode;
  requiredControls: Set<PolicyDiscoveryControlClosure>;
  sourceRecommendationKinds: Set<ShadowPolicyRecommendationKind>;
  highestSeverity: ShadowPolicyRecommendationSeverity;
  affectedEvents: number;
  confidenceTotal: number;
  confidenceSamples: number;
  reasonCodes: Set<string>;
  summaries: string[];
  selectedSummary: string | null;
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
    throw new Error(`Shadow policy discovery ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function severityRank(severity: ShadowPolicyRecommendationSeverity): number {
  if (severity === 'blocker') return 3;
  if (severity === 'high') return 2;
  if (severity === 'medium') return 1;
  return 0;
}

function strongerSeverity(
  left: ShadowPolicyRecommendationSeverity,
  right: ShadowPolicyRecommendationSeverity,
): ShadowPolicyRecommendationSeverity {
  return severityRank(right) > severityRank(left) ? right : left;
}

function actionFor(
  recommendation: ShadowPolicyRecommendation,
): PolicyDiscoveryCandidateAction {
  if (recommendation.kind === 'define-policy') return 'draft-policy';
  if (recommendation.kind === 'bind-evidence') return 'bind-evidence';
  if (recommendation.kind === 'bind-authority') return 'bind-authority';
  if (recommendation.kind === 'bind-amount-scope') return 'bind-amount-scope';
  if (recommendation.kind === 'bind-recipient-scope') return 'bind-recipient-scope';
  if (recommendation.kind === 'bind-data-scope') return 'bind-data-scope';
  if (recommendation.kind === 'prepare-adapter') return 'prepare-adapter';
  if (recommendation.kind === 'scope-custom-domain') return 'scope-custom-domain';
  if (recommendation.kind === 'investigate-blocks') return 'investigate-blocks';
  if (recommendation.kind === 'reduce-review-load') return 'reduce-review-load';
  if (recommendation.kind === 'promote-to-review') return 'review-mode-rehearsal';
  if (recommendation.kind === 'promote-to-enforce') return 'enforce-mode-rehearsal';
  return 'stay-in-shadow';
}

function controlsFor(
  recommendation: ShadowPolicyRecommendation,
): readonly PolicyDiscoveryControlClosure[] {
  if (recommendation.kind === 'define-policy') return Object.freeze(['policy', 'customer-approval']);
  if (recommendation.kind === 'bind-evidence') return Object.freeze(['evidence', 'customer-approval']);
  if (recommendation.kind === 'bind-authority') return Object.freeze(['authority', 'customer-approval']);
  if (
    recommendation.kind === 'bind-amount-scope' ||
    recommendation.kind === 'bind-recipient-scope' ||
    recommendation.kind === 'bind-data-scope'
  ) {
    return Object.freeze(['scope', 'customer-approval']);
  }
  if (recommendation.kind === 'prepare-adapter') return Object.freeze(['adapter', 'customer-approval']);
  if (recommendation.kind === 'scope-custom-domain') {
    return Object.freeze(['custom-domain', 'customer-approval']);
  }
  if (recommendation.kind === 'investigate-blocks') {
    return Object.freeze(['block-investigation', 'customer-approval']);
  }
  if (recommendation.kind === 'reduce-review-load') {
    return Object.freeze(['review-load', 'customer-approval']);
  }
  return Object.freeze(['customer-approval']);
}

function modeFor(
  action: PolicyDiscoveryCandidateAction,
  recommendation: ShadowPolicyRecommendation,
): GenericAdmissionMode {
  if (action === 'enforce-mode-rehearsal') return 'enforce';
  if (action === 'review-mode-rehearsal' || action === 'reduce-review-load') return 'review';
  if (
    action === 'draft-policy' ||
    action === 'bind-evidence' ||
    action === 'bind-authority' ||
    action === 'bind-amount-scope' ||
    action === 'bind-recipient-scope' ||
    action === 'bind-data-scope' ||
    action === 'prepare-adapter' ||
    action === 'scope-custom-domain' ||
    action === 'investigate-blocks' ||
    action === 'stay-in-shadow'
  ) {
    return 'observe';
  }
  return recommendation.nextMode ?? 'observe';
}

function priorityFor(action: PolicyDiscoveryCandidateAction): number {
  if (action === 'investigate-blocks') return 9;
  if (action === 'draft-policy') return 8;
  if (action === 'bind-authority') return 7;
  if (
    action === 'bind-amount-scope' ||
    action === 'bind-recipient-scope' ||
    action === 'bind-data-scope'
  ) {
    return 7;
  }
  if (action === 'bind-evidence') return 6;
  if (action === 'prepare-adapter') return 5;
  if (action === 'scope-custom-domain') return 5;
  if (action === 'reduce-review-load') return 4;
  if (action === 'review-mode-rehearsal') return 3;
  if (action === 'enforce-mode-rehearsal') return 2;
  return 1;
}

function keepHigherPriorityAction(
  current: PolicyDiscoveryCandidateAction,
  next: PolicyDiscoveryCandidateAction,
): PolicyDiscoveryCandidateAction {
  return priorityFor(next) > priorityFor(current) ? next : current;
}

function candidateKey(recommendation: ShadowPolicyRecommendation): string {
  return `${recommendation.domain ?? 'none'}\n${recommendation.actionSurface ?? 'none'}`;
}

function candidateIdFor(input: {
  readonly sourceReportId: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly action: PolicyDiscoveryCandidateAction;
  readonly recommendationKinds: readonly string[];
  readonly reasonCodes: readonly string[];
}): string {
  return `policy-candidate:${canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest}`;
}

function freezeCandidate(
  sourceReportId: string | null,
  candidate: MutableCandidate,
): ShadowPolicyDiscoveryCandidate {
  const sourceRecommendationKinds = Object.freeze([...candidate.sourceRecommendationKinds].sort());
  const reasonCodes = Object.freeze([...candidate.reasonCodes].sort());
  const requiredControls = Object.freeze([...candidate.requiredControls].sort());
  const confidence =
    candidate.confidenceSamples === 0
      ? 0
      : Number((candidate.confidenceTotal / candidate.confidenceSamples).toFixed(2));
  return Object.freeze({
    candidateId: candidateIdFor({
      sourceReportId,
      actionSurface: candidate.actionSurface,
      domain: candidate.domain,
      action: candidate.action,
      recommendationKinds: sourceRecommendationKinds,
      reasonCodes,
    }),
    actionSurface: candidate.actionSurface,
    domain: candidate.domain,
    action: candidate.action,
    proposedMode: candidate.proposedMode,
    approvalRequired: true,
    autoEnforce: false,
    requiredControls,
    sourceRecommendationKinds,
    highestSeverity: candidate.highestSeverity,
    affectedEvents: candidate.affectedEvents,
    confidence,
    reasonCodes,
    summary: candidate.selectedSummary ??
      candidate.summaries[0] ??
      'Review this shadow policy candidate before any enforcement change.',
  });
}

function addRecommendation(
  candidates: Map<string, MutableCandidate>,
  recommendation: ShadowPolicyRecommendation,
): void {
  const key = candidateKey(recommendation);
  const action = actionFor(recommendation);
  const current = candidates.get(key) ?? {
    actionSurface: recommendation.actionSurface,
    domain: recommendation.domain,
    action,
    proposedMode: modeFor(action, recommendation),
    requiredControls: new Set<PolicyDiscoveryControlClosure>(),
    sourceRecommendationKinds: new Set<ShadowPolicyRecommendationKind>(),
    highestSeverity: recommendation.severity,
    affectedEvents: 0,
    confidenceTotal: 0,
    confidenceSamples: 0,
    reasonCodes: new Set<string>(),
    summaries: [],
    selectedSummary: recommendation.summary,
  };

  const selectedAction = keepHigherPriorityAction(current.action, action);
  if (selectedAction !== current.action) {
    current.selectedSummary = recommendation.summary;
  }
  current.action = selectedAction;
  current.proposedMode = modeFor(selectedAction, recommendation);
  for (const control of controlsFor(recommendation)) current.requiredControls.add(control);
  current.sourceRecommendationKinds.add(recommendation.kind);
  current.highestSeverity = strongerSeverity(current.highestSeverity, recommendation.severity);
  current.affectedEvents += recommendation.affectedEvents;
  current.confidenceTotal += recommendation.confidence;
  current.confidenceSamples += 1;
  for (const reasonCode of recommendation.reasonCodes) current.reasonCodes.add(reasonCode);
  current.summaries.push(recommendation.summary);
  candidates.set(key, current);
}

export function createShadowPolicyDiscoveryCandidates(
  input: CreateShadowPolicyDiscoveryCandidatesInput,
): ShadowPolicyDiscoveryCandidates {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const report = input.report;
  const candidatesBySurface = new Map<string, MutableCandidate>();
  for (const recommendation of report?.recommendations ?? []) {
    addRecommendation(candidatesBySurface, recommendation);
  }
  const candidates = Object.freeze(
    [...candidatesBySurface.values()]
      .map((candidate) => freezeCandidate(report?.reportId ?? null, candidate))
      .sort((left, right) => {
        const severityDelta =
          severityRank(right.highestSeverity) - severityRank(left.highestSeverity);
        if (severityDelta !== 0) return severityDelta;
        if (right.affectedEvents !== left.affectedEvents) {
          return right.affectedEvents - left.affectedEvents;
        }
        return (left.actionSurface ?? '').localeCompare(right.actionSurface ?? '');
      }),
  );
  const payload = {
    version: SHADOW_POLICY_DISCOVERY_VERSION,
    generatedAt,
    sourceReportId: report?.reportId ?? null,
    sourceReportDigest: report?.digest ?? null,
    windowStart: report?.windowStart ?? null,
    windowEnd: report?.windowEnd ?? null,
    candidateCount: candidates.length,
    candidates,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
