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
  PolicyFoundryRedTeamReplayStatus,
} from './policy-foundry-readiness.js';
import type {
  ShadowPolicySimulationReport,
  ShadowPolicySurfaceSimulation,
} from './shadow-simulation.js';

export const POLICY_FOUNDRY_RED_TEAM_REPLAY_VERSION =
  'attestor.policy-foundry-red-team-replay.v1';

export const POLICY_FOUNDRY_RED_TEAM_REPLAY_CASE_KINDS = [
  'missing-policy-schema',
  'missing-evidence',
  'missing-authority-binding',
  'adapter-not-ready',
  'foreign-tenant-record',
  'duplicate-replayed-request',
  'actor-burst',
  'high-risk-auto-admit',
  'unsafe-proof-uri-signal',
  'malicious-summary-signal',
] as const;
export type PolicyFoundryRedTeamReplayCaseKind =
  typeof POLICY_FOUNDRY_RED_TEAM_REPLAY_CASE_KINDS[number];

export const POLICY_FOUNDRY_RED_TEAM_REPLAY_CASE_STATUSES = [
  'passed',
  'failed',
] as const;
export type PolicyFoundryRedTeamReplayCaseStatus =
  typeof POLICY_FOUNDRY_RED_TEAM_REPLAY_CASE_STATUSES[number];

export interface EvaluatePolicyFoundryRedTeamReplayInput {
  readonly candidate: ShadowPolicyDiscoveryCandidate | null;
  readonly report: ShadowPolicySimulationReport | null;
  readonly events?: readonly ShadowAdmissionEvent[] | null;
  readonly tenantId?: string | null;
  readonly generatedAt?: string | null;
  readonly maxSingleActorConcentration?: number | null;
  readonly maxReplayDuplicateRate?: number | null;
}

export interface PolicyFoundryRedTeamReplayCase {
  readonly kind: PolicyFoundryRedTeamReplayCaseKind;
  readonly status: PolicyFoundryRedTeamReplayCaseStatus;
  readonly severity: 'medium' | 'high' | 'blocker';
  readonly mappedRisks: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly observedEventCount: number;
  readonly evidenceDigests: readonly string[];
  readonly limitation: string | null;
}

export interface PolicyFoundryRedTeamReplayResult {
  readonly version: typeof POLICY_FOUNDRY_RED_TEAM_REPLAY_VERSION;
  readonly generatedAt: string;
  readonly candidateId: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly sourceReportId: string | null;
  readonly sourceReportDigest: string | null;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly simulationRequired: true;
  readonly evidenceReplayOnly: true;
  readonly status: PolicyFoundryRedTeamReplayStatus;
  readonly caseCount: number;
  readonly failedCaseCount: number;
  readonly matchedEventCount: number;
  readonly dominantActorDigest: string | null;
  readonly singleActorConcentration: number | null;
  readonly replayDuplicateRate: number;
  readonly cases: readonly PolicyFoundryRedTeamReplayCase[];
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
    throw new Error(`Policy Foundry red-team replay ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function ratioLimit(
  value: number | null | undefined,
  fallback: number,
  fieldName: string,
): number {
  const raw = value ?? fallback;
  if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
    throw new Error(`Policy Foundry red-team replay ${fieldName} must be between 0 and 1.`);
  }
  return raw;
}

function rounded(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
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

function surfaceMatches(
  surface: ShadowPolicySurfaceSimulation,
  candidate: ShadowPolicyDiscoveryCandidate,
): boolean {
  return (
    (candidate.actionSurface === null || surface.actionSurface === candidate.actionSurface) &&
    (candidate.domain === null || surface.domain === candidate.domain)
  );
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function dominantActor(
  events: readonly ShadowAdmissionEvent[],
): {
  readonly digest: string | null;
  readonly concentration: number | null;
} {
  if (events.length === 0) return { digest: null, concentration: null };
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.actor, (counts.get(event.actor) ?? 0) + 1);
  const [actor, count] = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? [null, 0];
  return {
    digest: actor === null ? null : digestText(actor),
    concentration: rounded(count / events.length),
  };
}

function duplicateRate(events: readonly ShadowAdmissionEvent[]): number {
  if (events.length === 0) return 0;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const event of events) {
    const key = `${event.requestId}\n${event.admissionDigest}`;
    if (seen.has(key) || seen.has(event.requestId) || seen.has(event.admissionDigest)) duplicates += 1;
    seen.add(key);
    seen.add(event.requestId);
    seen.add(event.admissionDigest);
  }
  return rounded(duplicates / events.length);
}

function evidenceDigests(events: readonly ShadowAdmissionEvent[]): readonly string[] {
  return Object.freeze(
    events
      .map((event) => event.digest)
      .sort()
      .slice(0, 25),
  );
}

function hasAnyFeature(
  event: ShadowAdmissionEvent,
  keys: readonly string[],
): boolean {
  const wanted = new Set(keys);
  return event.observedFeatureKeys.some((key) => wanted.has(key));
}

function caseResult(input: {
  readonly kind: PolicyFoundryRedTeamReplayCaseKind;
  readonly failedEvents: readonly ShadowAdmissionEvent[];
  readonly failed: boolean;
  readonly severity: 'medium' | 'high' | 'blocker';
  readonly mappedRisks: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly limitation?: string | null;
}): PolicyFoundryRedTeamReplayCase {
  return Object.freeze({
    kind: input.kind,
    status: input.failed ? 'failed' : 'passed',
    severity: input.severity,
    mappedRisks: Object.freeze([...input.mappedRisks]),
    reasonCodes: Object.freeze([...input.reasonCodes].sort()),
    observedEventCount: input.failedEvents.length,
    evidenceDigests: evidenceDigests(input.failedEvents),
    limitation: input.limitation ?? null,
  });
}

export function evaluatePolicyFoundryRedTeamReplay(
  input: EvaluatePolicyFoundryRedTeamReplayInput,
): PolicyFoundryRedTeamReplayResult {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
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
  const allEvents = input.events ?? [];
  const matchingEvents = candidate === null
    ? []
    : allEvents.filter((event) => eventMatches(event, candidate));
  const surface = candidate === null || report === null
    ? null
    : report.surfaceSimulations.find((item) => surfaceMatches(item, candidate)) ?? null;
  const actor = dominantActor(matchingEvents);
  const replayRate = duplicateRate(matchingEvents);

  const foreignTenantEvents = input.tenantId
    ? matchingEvents.filter((event) =>
      event.tenantId !== null && event.tenantId !== input.tenantId
    )
    : [];
  const duplicateEvents = matchingEvents.filter((event, index, events) =>
    events.findIndex((candidateEvent) =>
      candidateEvent.requestId === event.requestId ||
      candidateEvent.admissionDigest === event.admissionDigest
    ) !== index
  );
  const highRiskAutoAdmitEvents = matchingEvents.filter((event) =>
    event.effectiveDecision === 'admit' &&
    hasAnyFeature(event, ['highRisk', 'high-risk', 'requiresReview', 'policyBlocked', 'unsafe'])
  );
  const unsafeProofEvents = matchingEvents.filter((event) =>
    hasAnyFeature(event, ['unsafeProofUri', 'proofUriUnsafe', 'ssrf', 'unsafeUri'])
  );
  const maliciousSummaryEvents = matchingEvents.filter((event) =>
    hasAnyFeature(event, ['maliciousSummary', 'promptInjection', 'indirectPromptInjection', 'goalHijack'])
  );

  const policyMissing = candidate?.requiredControls.includes('policy') === true ||
    (surface?.gapCounts.policy ?? 0) > 0 ||
    candidate === null;
  const evidenceMissing = candidate?.requiredControls.includes('evidence') === true ||
    (surface?.gapCounts.evidence ?? 0) > 0 ||
    candidate === null;
  const authorityMissing = candidate?.requiredControls.includes('authority') === true ||
    (surface?.gapCounts.authority ?? 0) > 0 ||
    candidate === null;
  const adapterMissing = candidate?.requiredControls.includes('adapter') === true ||
    (surface?.gapCounts.adapter ?? 0) > 0;
  const actorBurst = actor.concentration !== null &&
    actor.concentration > maxSingleActorConcentration;
  const replayDuplicatePressure = replayRate > maxReplayDuplicateRate;

  const cases: PolicyFoundryRedTeamReplayCase[] = [
    caseResult({
      kind: 'missing-policy-schema',
      failedEvents: policyMissing ? matchingEvents : [],
      failed: policyMissing,
      severity: 'blocker',
      mappedRisks: ['ASI08 Cascading Failures', 'NIST AI RMF Measure'],
      reasonCodes: policyMissing ? ['missing-policy-schema'] : [],
    }),
    caseResult({
      kind: 'missing-evidence',
      failedEvents: evidenceMissing ? matchingEvents : [],
      failed: evidenceMissing,
      severity: 'blocker',
      mappedRisks: ['ASI09 Human-Agent Trust Exploitation', 'proof integrity'],
      reasonCodes: evidenceMissing ? ['missing-evidence-coverage'] : [],
    }),
    caseResult({
      kind: 'missing-authority-binding',
      failedEvents: authorityMissing ? matchingEvents : [],
      failed: authorityMissing,
      severity: 'blocker',
      mappedRisks: ['ASI03 Identity & Privilege Abuse', 'customer authority'],
      reasonCodes: authorityMissing ? ['missing-authority-binding'] : [],
    }),
    caseResult({
      kind: 'adapter-not-ready',
      failedEvents: adapterMissing ? matchingEvents : [],
      failed: adapterMissing,
      severity: 'high',
      mappedRisks: ['ASI02 Tool Misuse & Exploitation'],
      reasonCodes: adapterMissing ? ['adapter-readiness-missing'] : [],
    }),
    caseResult({
      kind: 'foreign-tenant-record',
      failedEvents: foreignTenantEvents,
      failed: foreignTenantEvents.length > 0,
      severity: 'blocker',
      mappedRisks: ['tenant isolation', 'ASI03 Identity & Privilege Abuse'],
      reasonCodes: foreignTenantEvents.length > 0 ? ['foreign-tenant-record'] : [],
    }),
    caseResult({
      kind: 'duplicate-replayed-request',
      failedEvents: duplicateEvents,
      failed: replayDuplicatePressure,
      severity: 'high',
      mappedRisks: ['replay and idempotency safety'],
      reasonCodes: replayDuplicatePressure ? ['replay-duplicate-pressure'] : [],
    }),
    caseResult({
      kind: 'actor-burst',
      failedEvents: actorBurst ? matchingEvents : [],
      failed: actorBurst,
      severity: 'high',
      mappedRisks: ['ASI10 Rogue Agents', 'operational boundedness'],
      reasonCodes: actorBurst ? ['single-actor-concentration'] : [],
    }),
    caseResult({
      kind: 'high-risk-auto-admit',
      failedEvents: highRiskAutoAdmitEvents,
      failed: highRiskAutoAdmitEvents.length > 0,
      severity: 'blocker',
      mappedRisks: ['ASI01 Agent Goal Hijack', 'fail-closed boundary'],
      reasonCodes: highRiskAutoAdmitEvents.length > 0 ? ['high-risk-auto-admit'] : [],
    }),
    caseResult({
      kind: 'unsafe-proof-uri-signal',
      failedEvents: unsafeProofEvents,
      failed: unsafeProofEvents.length > 0,
      severity: 'high',
      mappedRisks: ['OWASP LLM05 Insecure Output Handling', 'proof integrity'],
      reasonCodes: unsafeProofEvents.length > 0 ? ['unsafe-proof-uri-signal'] : [],
      limitation:
        'This replay uses data-minimized observed feature signals; raw proof URIs are not stored or replayed.',
    }),
    caseResult({
      kind: 'malicious-summary-signal',
      failedEvents: maliciousSummaryEvents,
      failed: maliciousSummaryEvents.length > 0,
      severity: 'high',
      mappedRisks: ['ASI01 Agent Goal Hijack', 'ASI06 Memory & Context Poisoning'],
      reasonCodes: maliciousSummaryEvents.length > 0 ? ['malicious-summary-signal'] : [],
      limitation:
        'This replay uses data-minimized observed feature signals; raw prompts and summaries are not stored or replayed.',
    }),
  ];

  const failedCaseCount = cases.filter((entry) => entry.status === 'failed').length;
  const payload = {
    version: POLICY_FOUNDRY_RED_TEAM_REPLAY_VERSION as typeof POLICY_FOUNDRY_RED_TEAM_REPLAY_VERSION,
    generatedAt,
    candidateId: candidate?.candidateId ?? null,
    actionSurface: candidate?.actionSurface ?? null,
    domain: candidate?.domain ?? null,
    sourceReportId: report?.reportId ?? null,
    sourceReportDigest: report?.digest ?? null,
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    simulationRequired: true as const,
    evidenceReplayOnly: true as const,
    status: failedCaseCount === 0 ? 'passed' as const : 'failed' as const,
    caseCount: cases.length,
    failedCaseCount,
    matchedEventCount: matchingEvents.length,
    dominantActorDigest: actor.digest,
    singleActorConcentration: actor.concentration,
    replayDuplicateRate: replayRate,
    cases: Object.freeze(cases),
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
