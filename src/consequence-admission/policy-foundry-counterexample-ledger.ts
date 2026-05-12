import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  PolicyFoundryRegisteredCandidate,
} from './policy-foundry-candidate-registry.js';
import type {
  PolicyFoundryNoGoReason,
  PolicyFoundryReadinessEvaluation,
} from './policy-foundry-readiness.js';
import type {
  PolicyFoundryRedTeamReplayResult,
} from './policy-foundry-red-team-replay.js';
import type {
  ShadowPolicyDiscoveryCandidate,
} from './policy-discovery-candidates.js';
import type {
  ShadowAdmissionEvent,
} from './shadow-events.js';

export const POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_VERSION =
  'attestor.policy-foundry-counterexample-ledger.v1';

export const POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_ENTRY_KINDS = [
  'supporting-evidence',
  'simulation-counterexample',
  'missing-proof',
  'high-risk-auto-admit',
  'actor-concentration',
  'replay-duplicate-pressure',
  'schema-template-gap',
  'red-team-replay-failure',
] as const;
export type PolicyFoundryCounterexampleLedgerEntryKind =
  typeof POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_ENTRY_KINDS[number];

export const POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_ENTRY_STATUSES = [
  'supporting',
  'warning',
  'blocking',
] as const;
export type PolicyFoundryCounterexampleLedgerEntryStatus =
  typeof POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_ENTRY_STATUSES[number];

export const POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_STATUSES = [
  'clean',
  'review-required',
  'blocked',
] as const;
export type PolicyFoundryCounterexampleLedgerStatus =
  typeof POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_STATUSES[number];

export interface CreatePolicyFoundryCounterexampleLedgerInput {
  readonly candidate: ShadowPolicyDiscoveryCandidate | null;
  readonly registeredCandidate?: PolicyFoundryRegisteredCandidate | null;
  readonly readiness?: PolicyFoundryReadinessEvaluation | null;
  readonly redTeamReplay?: PolicyFoundryRedTeamReplayResult | null;
  readonly events?: readonly ShadowAdmissionEvent[] | null;
  readonly generatedAt?: string | null;
  readonly maxSingleActorConcentration?: number | null;
  readonly maxReplayDuplicateRate?: number | null;
  readonly maxEvidenceDigests?: number | null;
}

export interface PolicyFoundryCounterexampleLedgerEntry {
  readonly kind: PolicyFoundryCounterexampleLedgerEntryKind;
  readonly status: PolicyFoundryCounterexampleLedgerEntryStatus;
  readonly severity: 'info' | 'medium' | 'high' | 'blocker';
  readonly protectedPrinciple: string;
  readonly observedCount: number;
  readonly evidenceDigests: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly mappedNoGoReasons: readonly PolicyFoundryNoGoReason[];
  readonly limitation: string | null;
}

export interface PolicyFoundryCounterexampleLedger {
  readonly version: typeof POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_VERSION;
  readonly generatedAt: string;
  readonly candidateId: string | null;
  readonly sourceCandidateDigest: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly schemaStatus: string | null;
  readonly templateId: string | null;
  readonly readinessDigest: string | null;
  readonly redTeamReplayDigest: string | null;
  readonly status: PolicyFoundryCounterexampleLedgerStatus;
  readonly promotionBlocked: boolean;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly evidenceDigestOnly: true;
  readonly matchingEventCount: number;
  readonly supportingEvidenceCount: number;
  readonly counterexampleCount: number;
  readonly missingProofCount: number;
  readonly highRiskAutoAdmitCount: number;
  readonly dominantActorDigest: string | null;
  readonly singleActorConcentration: number | null;
  readonly replayDuplicateRate: number;
  readonly blockingEntryCount: number;
  readonly warningEntryCount: number;
  readonly entries: readonly PolicyFoundryCounterexampleLedgerEntry[];
  readonly noGoReasons: readonly string[];
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-counterexample-ledger';
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryCounterexampleLedgerDescriptor {
  readonly version: typeof POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_VERSION;
  readonly entryKinds: typeof POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_ENTRY_KINDS;
  readonly entryStatuses: typeof POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_ENTRY_STATUSES;
  readonly statuses: typeof POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_STATUSES;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly evidenceDigestOnly: true;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-counterexample-ledger';
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
    throw new Error(`Policy Foundry counterexample ledger ${fieldName} must be an ISO timestamp.`);
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
    throw new Error(`Policy Foundry counterexample ledger ${fieldName} must be between 0 and 1.`);
  }
  return raw;
}

function positiveInteger(
  value: number | null | undefined,
  fallback: number,
  fieldName: string,
): number {
  const raw = value ?? fallback;
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new Error(`Policy Foundry counterexample ledger ${fieldName} must be a positive integer.`);
  }
  return raw;
}

function rounded(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function targetFor(input: CreatePolicyFoundryCounterexampleLedgerInput): {
  readonly candidateId: string | null;
  readonly sourceCandidateDigest: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
} {
  return Object.freeze({
    candidateId: input.registeredCandidate?.candidateId ?? input.candidate?.candidateId ?? null,
    sourceCandidateDigest: input.registeredCandidate?.sourceCandidateDigest ?? null,
    actionSurface: input.registeredCandidate?.actionSurface ?? input.candidate?.actionSurface ?? null,
    domain: input.registeredCandidate?.domain ?? input.candidate?.domain ?? null,
  });
}

function eventMatches(
  event: ShadowAdmissionEvent,
  target: {
    readonly actionSurface: string | null;
    readonly domain: string | null;
  },
): boolean {
  return (
    (target.actionSurface === null || event.actionSurface === target.actionSurface) &&
    (target.domain === null || event.domain === target.domain)
  );
}

function evidenceDigests(
  events: readonly ShadowAdmissionEvent[],
  maxEvidenceDigests: number,
): readonly string[] {
  return Object.freeze(
    [...new Set(events.map((event) => event.digest))]
      .sort()
      .slice(0, maxEvidenceDigests),
  );
}

function dominantActor(
  events: readonly ShadowAdmissionEvent[],
): {
  readonly digest: string | null;
  readonly concentration: number | null;
} {
  if (events.length === 0) return Object.freeze({ digest: null, concentration: null });
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.actor, (counts.get(event.actor) ?? 0) + 1);
  const [actor, count] = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? [null, 0];
  return Object.freeze({
    digest: actor === null ? null : digestText(actor),
    concentration: rounded(count / events.length),
  });
}

function duplicateRate(events: readonly ShadowAdmissionEvent[]): number {
  if (events.length === 0) return 0;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const event of events) {
    const composite = `${event.requestId}\n${event.admissionDigest}`;
    if (seen.has(composite) || seen.has(event.requestId) || seen.has(event.admissionDigest)) {
      duplicates += 1;
    }
    seen.add(composite);
    seen.add(event.requestId);
    seen.add(event.admissionDigest);
  }
  return rounded(duplicates / events.length);
}

function hasAnyFeature(
  event: ShadowAdmissionEvent,
  keys: readonly string[],
): boolean {
  const wanted = new Set(keys);
  return event.observedFeatureKeys.some((key) => wanted.has(key));
}

function counterexampleEvents(events: readonly ShadowAdmissionEvent[]): readonly ShadowAdmissionEvent[] {
  return Object.freeze(
    events.filter((event) =>
      event.shadowDecision === 'would_block' ||
      event.effectiveDecision === 'block' ||
      event.downstreamOutcome === 'blocked' ||
      event.downstreamOutcome === 'failed' ||
      event.humanOutcome === 'rejected'
    ),
  );
}

function missingProofEvents(events: readonly ShadowAdmissionEvent[]): readonly ShadowAdmissionEvent[] {
  return Object.freeze(
    events.filter((event) =>
      event.evidenceRefCount === 0 ||
      event.policyRef === null ||
      event.reasonCodes.some((reason) =>
        reason === 'policy-ref-missing' ||
        reason === 'evidence-ref-missing' ||
        reason === 'authority-ref-missing' ||
        reason === 'adapter-readiness-missing'
      )
    ),
  );
}

function highRiskAutoAdmitEvents(events: readonly ShadowAdmissionEvent[]): readonly ShadowAdmissionEvent[] {
  const highRiskKeys = [
    'highRisk',
    'high-risk',
    'policyBlocked',
    'unsafe',
    'requiresReview',
  ];
  return Object.freeze(
    events.filter((event) =>
      event.effectiveDecision === 'admit' &&
      hasAnyFeature(event, highRiskKeys)
    ),
  );
}

function duplicateEvents(events: readonly ShadowAdmissionEvent[]): readonly ShadowAdmissionEvent[] {
  const seen = new Set<string>();
  const duplicates: ShadowAdmissionEvent[] = [];
  for (const event of events) {
    const composite = `${event.requestId}\n${event.admissionDigest}`;
    if (seen.has(composite) || seen.has(event.requestId) || seen.has(event.admissionDigest)) {
      duplicates.push(event);
    }
    seen.add(composite);
    seen.add(event.requestId);
    seen.add(event.admissionDigest);
  }
  return Object.freeze(duplicates);
}

function entry(input: {
  readonly kind: PolicyFoundryCounterexampleLedgerEntryKind;
  readonly status: PolicyFoundryCounterexampleLedgerEntryStatus;
  readonly severity: 'info' | 'medium' | 'high' | 'blocker';
  readonly protectedPrinciple: string;
  readonly observedCount: number;
  readonly events: readonly ShadowAdmissionEvent[];
  readonly reasonCodes: readonly string[];
  readonly mappedNoGoReasons: readonly PolicyFoundryNoGoReason[];
  readonly limitation?: string | null;
  readonly maxEvidenceDigests: number;
}): PolicyFoundryCounterexampleLedgerEntry {
  return Object.freeze({
    kind: input.kind,
    status: input.status,
    severity: input.severity,
    protectedPrinciple: input.protectedPrinciple,
    observedCount: input.observedCount,
    evidenceDigests: evidenceDigests(input.events, input.maxEvidenceDigests),
    reasonCodes: Object.freeze([...new Set(input.reasonCodes)].sort()),
    mappedNoGoReasons: Object.freeze([...new Set(input.mappedNoGoReasons)].sort()),
    limitation: input.limitation ?? null,
  });
}

function reasonSetFromReadiness(
  readiness: PolicyFoundryReadinessEvaluation | null | undefined,
): Set<string> {
  return new Set(readiness?.noGoReasons ?? []);
}

function statusFor(entries: readonly PolicyFoundryCounterexampleLedgerEntry[]): PolicyFoundryCounterexampleLedgerStatus {
  if (entries.some((item) => item.status === 'blocking')) return 'blocked';
  if (entries.some((item) => item.status === 'warning')) return 'review-required';
  return 'clean';
}

export function createPolicyFoundryCounterexampleLedger(
  input: CreatePolicyFoundryCounterexampleLedgerInput,
): PolicyFoundryCounterexampleLedger {
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
  const maxEvidenceDigests = positiveInteger(input.maxEvidenceDigests, 25, 'maxEvidenceDigests');
  const target = targetFor(input);
  const allEvents = input.events ?? [];
  const matchingEvents = Object.freeze(allEvents.filter((event) => eventMatches(event, target)));
  const counterexamples = counterexampleEvents(matchingEvents);
  const missingProof = missingProofEvents(matchingEvents);
  const highRiskAutoAdmits = highRiskAutoAdmitEvents(matchingEvents);
  const duplicates = duplicateEvents(matchingEvents);
  const actor = dominantActor(matchingEvents);
  const replayRate = duplicateRate(matchingEvents);
  const schemaNoGoReasons = input.registeredCandidate?.noGoReasons ?? [];
  const readinessReasons = reasonSetFromReadiness(input.readiness);
  const actorConcentrated =
    actor.concentration !== null &&
    actor.concentration > maxSingleActorConcentration &&
    matchingEvents.length > 0;
  const replayPressure = replayRate > maxReplayDuplicateRate;
  const schemaGap =
    (input.registeredCandidate?.schemaStatus ?? null) !== null &&
    input.registeredCandidate?.schemaStatus !== 'schema-bound';
  const redTeamFailed = input.redTeamReplay?.status === 'failed';
  const redTeamNotRun = input.redTeamReplay === null || input.redTeamReplay === undefined;

  const entries = Object.freeze([
    entry({
      kind: 'supporting-evidence',
      status: matchingEvents.length > 0 ? 'supporting' : 'warning',
      severity: matchingEvents.length > 0 ? 'info' : 'medium',
      protectedPrinciple: 'auditability',
      observedCount: matchingEvents.length,
      events: matchingEvents,
      reasonCodes: matchingEvents.length > 0
        ? ['supporting-shadow-evidence-digest-bound']
        : ['supporting-shadow-evidence-missing'],
      mappedNoGoReasons: [],
      limitation: matchingEvents.length > 0
        ? 'Digest-only supporting evidence does not prove production readiness.'
        : 'No matching shadow evidence was provided for this candidate.',
      maxEvidenceDigests,
    }),
    entry({
      kind: 'simulation-counterexample',
      status: counterexamples.length > 0 || readinessReasons.has('counterexamples-present')
        ? 'blocking'
        : 'supporting',
      severity: counterexamples.length > 0 ? 'blocker' : 'info',
      protectedPrinciple: 'fail-closed boundary',
      observedCount: counterexamples.length,
      events: counterexamples,
      reasonCodes: counterexamples.length > 0
        ? ['counterexamples-present']
        : ['counterexamples-not-observed'],
      mappedNoGoReasons: counterexamples.length > 0 || readinessReasons.has('counterexamples-present')
        ? ['counterexamples-present']
        : [],
      limitation: 'Counterexamples are promotion blockers until reviewed and resolved.',
      maxEvidenceDigests,
    }),
    entry({
      kind: 'missing-proof',
      status: missingProof.length > 0 ? 'blocking' : 'supporting',
      severity: missingProof.length > 0 ? 'high' : 'info',
      protectedPrinciple: 'proof integrity',
      observedCount: missingProof.length,
      events: missingProof,
      reasonCodes: missingProof.length > 0
        ? ['missing-policy-evidence-authority-or-adapter-proof']
        : ['required-proof-not-missing-in-sample'],
      mappedNoGoReasons: missingProof.length > 0
        ? ['missing-policy-schema', 'missing-evidence-coverage', 'missing-authority-binding', 'adapter-readiness-missing']
        : [],
      limitation: 'The ledger records missing proof signals; it does not repair the proof source.',
      maxEvidenceDigests,
    }),
    entry({
      kind: 'high-risk-auto-admit',
      status: highRiskAutoAdmits.length > 0 || readinessReasons.has('high-risk-auto-admit')
        ? 'blocking'
        : 'supporting',
      severity: highRiskAutoAdmits.length > 0 ? 'blocker' : 'info',
      protectedPrinciple: 'fail-closed boundary',
      observedCount: highRiskAutoAdmits.length,
      events: highRiskAutoAdmits,
      reasonCodes: highRiskAutoAdmits.length > 0
        ? ['high-risk-auto-admit']
        : ['high-risk-auto-admit-not-observed'],
      mappedNoGoReasons: highRiskAutoAdmits.length > 0 || readinessReasons.has('high-risk-auto-admit')
        ? ['high-risk-auto-admit']
        : [],
      limitation: 'High-risk auto-admits must be resolved before promotion.',
      maxEvidenceDigests,
    }),
    entry({
      kind: 'actor-concentration',
      status: actorConcentrated || readinessReasons.has('single-actor-concentration')
        ? 'blocking'
        : 'supporting',
      severity: actorConcentrated ? 'high' : 'info',
      protectedPrinciple: 'customer authority',
      observedCount: actorConcentrated ? matchingEvents.length : 0,
      events: actorConcentrated ? matchingEvents : [],
      reasonCodes: actorConcentrated
        ? ['single-actor-concentration']
        : ['actor-concentration-within-limit'],
      mappedNoGoReasons: actorConcentrated || readinessReasons.has('single-actor-concentration')
        ? ['single-actor-concentration']
        : [],
      limitation: actor.digest === null
        ? 'No actor distribution could be measured.'
        : `Dominant actor is digest-bound; raw actor identity is not stored.`,
      maxEvidenceDigests,
    }),
    entry({
      kind: 'replay-duplicate-pressure',
      status: replayPressure || readinessReasons.has('replay-duplicate-pressure')
        ? 'blocking'
        : 'supporting',
      severity: replayPressure ? 'high' : 'info',
      protectedPrinciple: 'replay and idempotency safety',
      observedCount: duplicates.length,
      events: duplicates,
      reasonCodes: replayPressure ? ['replay-duplicate-pressure'] : ['replay-pressure-within-limit'],
      mappedNoGoReasons: replayPressure || readinessReasons.has('replay-duplicate-pressure')
        ? ['replay-duplicate-pressure']
        : [],
      limitation: 'Replay pressure requires downstream idempotency and replay-ledger evidence before promotion.',
      maxEvidenceDigests,
    }),
    entry({
      kind: 'schema-template-gap',
      status: schemaGap || schemaNoGoReasons.length > 0 ? 'blocking' : 'supporting',
      severity: schemaGap || schemaNoGoReasons.length > 0 ? 'high' : 'info',
      protectedPrinciple: 'no overclaim',
      observedCount: schemaNoGoReasons.length,
      events: [],
      reasonCodes: schemaNoGoReasons.length > 0
        ? schemaNoGoReasons
        : ['schema-template-bound'],
      mappedNoGoReasons: schemaGap ? ['missing-policy-schema'] : [],
      limitation: 'Custom or unbound templates are review material, not policy authority.',
      maxEvidenceDigests,
    }),
    entry({
      kind: 'red-team-replay-failure',
      status: redTeamFailed ? 'blocking' : redTeamNotRun ? 'warning' : 'supporting',
      severity: redTeamFailed ? 'blocker' : redTeamNotRun ? 'medium' : 'info',
      protectedPrinciple: 'operational boundedness',
      observedCount: input.redTeamReplay?.failedCaseCount ?? 0,
      events: [],
      reasonCodes: redTeamFailed
        ? ['red-team-replay-failed']
        : redTeamNotRun
          ? ['red-team-replay-not-run']
          : ['red-team-replay-passed'],
      mappedNoGoReasons: redTeamFailed
        ? ['red-team-replay-failed']
        : redTeamNotRun
          ? ['red-team-replay-not-run']
          : [],
      limitation: 'Red-team replay is evidence replay only; passing it does not prove production readiness.',
      maxEvidenceDigests,
    }),
  ]);
  const ledgerStatus = statusFor(entries);
  const noGoReasons = Object.freeze(
    [...new Set([
      ...entries.flatMap((item) => item.mappedNoGoReasons),
      ...readinessReasons,
      ...schemaNoGoReasons,
    ])].sort(),
  );
  const payload = {
    version: POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_VERSION as typeof POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_VERSION,
    generatedAt,
    candidateId: target.candidateId,
    sourceCandidateDigest: target.sourceCandidateDigest,
    actionSurface: target.actionSurface,
    domain: target.domain,
    schemaStatus: input.registeredCandidate?.schemaStatus ?? null,
    templateId: input.registeredCandidate?.templateId ?? null,
    readinessDigest: input.readiness?.digest ?? null,
    redTeamReplayDigest: input.redTeamReplay?.digest ?? null,
    status: ledgerStatus,
    promotionBlocked: ledgerStatus === 'blocked',
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    activatesEnforcement: false as const,
    evidenceDigestOnly: true as const,
    matchingEventCount: matchingEvents.length,
    supportingEvidenceCount: matchingEvents.length,
    counterexampleCount: counterexamples.length,
    missingProofCount: missingProof.length,
    highRiskAutoAdmitCount: highRiskAutoAdmits.length,
    dominantActorDigest: actor.digest,
    singleActorConcentration: actor.concentration,
    replayDuplicateRate: replayRate,
    blockingEntryCount: entries.filter((item) => item.status === 'blocking').length,
    warningEntryCount: entries.filter((item) => item.status === 'warning').length,
    entries,
    noGoReasons,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION as typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-counterexample-ledger' as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function policyFoundryCounterexampleLedgerDescriptor(): PolicyFoundryCounterexampleLedgerDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_VERSION,
    entryKinds: POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_ENTRY_KINDS,
    entryStatuses: POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_ENTRY_STATUSES,
    statuses: POLICY_FOUNDRY_COUNTEREXAMPLE_LEDGER_STATUSES,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    evidenceDigestOnly: true,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-counterexample-ledger',
  });
}
