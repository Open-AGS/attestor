import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  PolicyFoundryCandidateRegistry,
} from './policy-foundry-candidate-registry.js';
import type {
  PolicyFoundryCounterexampleLedger,
} from './policy-foundry-counterexample-ledger.js';
import type {
  PolicyFoundryCoverageScore,
} from './policy-foundry-coverage-score.js';
import type {
  PolicyFoundryGatePlanner,
} from './policy-foundry-gate-planner.js';
import type {
  PolicyFoundryOutcomeFeedbackLoop,
} from './policy-foundry-outcome-feedback-loop.js';
import type {
  PolicyFoundryPolicyTwinSummary,
} from './policy-foundry-policy-twin-summary.js';

export const POLICY_FOUNDRY_DRIFT_POLICY_DEBT_DETECTOR_VERSION =
  'attestor.policy-foundry-drift-policy-debt-detector.v1';

export const POLICY_FOUNDRY_DRIFT_POLICY_DEBT_STATUSES = [
  'clean',
  'watch',
  'debt-detected',
  'no-go',
] as const;
export type PolicyFoundryDriftPolicyDebtStatus =
  typeof POLICY_FOUNDRY_DRIFT_POLICY_DEBT_STATUSES[number];

export const POLICY_FOUNDRY_DRIFT_POLICY_DEBT_ENTRY_KINDS = [
  'new-action-surface',
  'stale-policy-candidate',
  'verifier-coverage-drift',
  'actor-concentration',
  'policy-shadow-mismatch',
  'outcome-feedback-debt',
  'schema-template-debt',
  'replay-idempotency-debt',
] as const;
export type PolicyFoundryDriftPolicyDebtEntryKind =
  typeof POLICY_FOUNDRY_DRIFT_POLICY_DEBT_ENTRY_KINDS[number];

export const POLICY_FOUNDRY_DRIFT_POLICY_DEBT_NO_GO_REASONS = [
  'unreviewed-new-action-surface',
  'stale-policy-twin-window',
  'missing-verifier-or-gateway',
  'single-actor-concentration',
  'policy-shadow-mismatch',
  'negative-outcome-feedback',
  'schema-template-unbound',
  'replay-idempotency-drift',
] as const;
export type PolicyFoundryDriftPolicyDebtNoGoReason =
  typeof POLICY_FOUNDRY_DRIFT_POLICY_DEBT_NO_GO_REASONS[number];

export interface CreatePolicyFoundryDriftPolicyDebtDetectorInput {
  readonly generatedAt?: string | null;
  readonly coverage?: PolicyFoundryCoverageScore | null;
  readonly gatePlanner?: PolicyFoundryGatePlanner | null;
  readonly candidateRegistry?: PolicyFoundryCandidateRegistry | null;
  readonly counterexampleLedger?: PolicyFoundryCounterexampleLedger | null;
  readonly policyTwinSummary?: PolicyFoundryPolicyTwinSummary | null;
  readonly outcomeFeedback?: PolicyFoundryOutcomeFeedbackLoop | null;
  readonly maxPolicyTwinAgeDays?: number | null;
  readonly maxSingleActorConcentration?: number | null;
  readonly maxReplayDuplicateRate?: number | null;
}

export interface PolicyFoundryDriftPolicyDebtEntry {
  readonly kind: PolicyFoundryDriftPolicyDebtEntryKind;
  readonly status: PolicyFoundryDriftPolicyDebtStatus;
  readonly severity: 'info' | 'medium' | 'high' | 'blocker';
  readonly protectedPrinciple: string;
  readonly observedCount: number;
  readonly affectedSurfaces: readonly string[];
  readonly sourceDigests: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly mappedNoGoReasons: readonly PolicyFoundryDriftPolicyDebtNoGoReason[];
  readonly recommendedAction: string;
  readonly limitation: string;
}

export interface PolicyFoundryDriftPolicyDebtDetector {
  readonly version: typeof POLICY_FOUNDRY_DRIFT_POLICY_DEBT_DETECTOR_VERSION;
  readonly generatedAt: string;
  readonly status: PolicyFoundryDriftPolicyDebtStatus;
  readonly sourceDigests: {
    readonly coverageDigest: string | null;
    readonly gatePlannerDigest: string | null;
    readonly candidateRegistryDigest: string | null;
    readonly counterexampleLedgerDigest: string | null;
    readonly policyTwinSummaryDigest: string | null;
    readonly outcomeFeedbackDigest: string | null;
  };
  readonly entryCount: number;
  readonly blockerCount: number;
  readonly highSeverityCount: number;
  readonly watchCount: number;
  readonly affectedSurfaceCount: number;
  readonly entries: readonly PolicyFoundryDriftPolicyDebtEntry[];
  readonly noGoReasons: readonly PolicyFoundryDriftPolicyDebtNoGoReason[];
  readonly nextSafeStep: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly reviewMaterialOnly: true;
  readonly automaticRemediationAllowed: false;
  readonly policyMutationAllowed: false;
  readonly deploysInfrastructure: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-drift-policy-debt-detector';
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryDriftPolicyDebtDetectorDescriptor {
  readonly version: typeof POLICY_FOUNDRY_DRIFT_POLICY_DEBT_DETECTOR_VERSION;
  readonly statuses: typeof POLICY_FOUNDRY_DRIFT_POLICY_DEBT_STATUSES;
  readonly entryKinds: typeof POLICY_FOUNDRY_DRIFT_POLICY_DEBT_ENTRY_KINDS;
  readonly noGoReasons: typeof POLICY_FOUNDRY_DRIFT_POLICY_DEBT_NO_GO_REASONS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly reviewMaterialOnly: true;
  readonly automaticRemediationAllowed: false;
  readonly policyMutationAllowed: false;
  readonly deploysInfrastructure: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-drift-policy-debt-detector';
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
    throw new Error(`Policy Foundry drift/policy debt detector ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function positiveNumber(
  value: number | null | undefined,
  fallback: number,
  fieldName: string,
): number {
  const raw = value ?? fallback;
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error(`Policy Foundry drift/policy debt detector ${fieldName} must be a positive number.`);
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
    throw new Error(`Policy Foundry drift/policy debt detector ${fieldName} must be between 0 and 1.`);
  }
  return raw;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.filter((value) => value.length > 0))].sort());
}

function entry(input: {
  readonly kind: PolicyFoundryDriftPolicyDebtEntryKind;
  readonly status: PolicyFoundryDriftPolicyDebtStatus;
  readonly severity: 'info' | 'medium' | 'high' | 'blocker';
  readonly protectedPrinciple: string;
  readonly observedCount: number;
  readonly affectedSurfaces?: readonly (string | null)[];
  readonly sourceDigests?: readonly (string | null)[];
  readonly reasonCodes: readonly string[];
  readonly mappedNoGoReasons?: readonly PolicyFoundryDriftPolicyDebtNoGoReason[];
  readonly recommendedAction: string;
  readonly limitation: string;
}): PolicyFoundryDriftPolicyDebtEntry {
  return Object.freeze({
    kind: input.kind,
    status: input.status,
    severity: input.severity,
    protectedPrinciple: input.protectedPrinciple,
    observedCount: input.observedCount,
    affectedSurfaces: uniqueSorted((input.affectedSurfaces ?? [])
      .filter((value): value is string => typeof value === 'string' && value.length > 0)),
    sourceDigests: uniqueSorted((input.sourceDigests ?? [])
      .filter((value): value is string => typeof value === 'string' && value.length > 0)),
    reasonCodes: uniqueSorted(input.reasonCodes),
    mappedNoGoReasons: Object.freeze([...(input.mappedNoGoReasons ?? [])].sort()),
    recommendedAction: input.recommendedAction,
    limitation: input.limitation,
  });
}

function surfaceNamesFromCoverage(
  coverage: PolicyFoundryCoverageScore | null,
): readonly string[] {
  return uniqueSorted((coverage?.surfaces ?? [])
    .map((surface) => surface.actionSurface ?? 'unknown-surface'));
}

function candidateSurfaces(
  registry: PolicyFoundryCandidateRegistry | null,
): readonly string[] {
  return uniqueSorted((registry?.candidates ?? [])
    .map((candidate) => candidate.actionSurface ?? 'unknown-surface'));
}

function newActionSurfaceEntry(input: {
  readonly coverage: PolicyFoundryCoverageScore | null;
  readonly registry: PolicyFoundryCandidateRegistry | null;
}): PolicyFoundryDriftPolicyDebtEntry {
  const coverageSurfaces = surfaceNamesFromCoverage(input.coverage);
  const registeredSurfaces = new Set(candidateSurfaces(input.registry));
  const unregistered = coverageSurfaces.filter((surface) => !registeredSurfaces.has(surface));
  const missingShadow = (input.coverage?.surfaces ?? [])
    .filter((surface) => surface.status === 'needs-shadow-traffic' || surface.eventCount === 0)
    .map((surface) => surface.actionSurface ?? 'unknown-surface');
  const affected = uniqueSorted([...unregistered, ...missingShadow]);
  const hasDebt = affected.length > 0;
  return entry({
    kind: 'new-action-surface',
    status: hasDebt ? 'debt-detected' : 'clean',
    severity: hasDebt ? 'high' : 'info',
    protectedPrinciple: 'customer authority',
    observedCount: affected.length,
    affectedSurfaces: affected,
    sourceDigests: [input.coverage?.digest ?? null, input.registry?.digest ?? null],
    reasonCodes: hasDebt
      ? ['action-surface-not-fully-registered-or-shadowed']
      : ['action-surface-coverage-aligned'],
    mappedNoGoReasons: hasDebt ? ['unreviewed-new-action-surface'] : [],
    recommendedAction: hasDebt
      ? 'Collect shadow traffic and bind the surface to a reviewed candidate before promotion.'
      : 'No new action-surface drift detected.',
    limitation: 'This detects declared/covered surface drift only; it does not scan customer infrastructure.',
  });
}

function stalePolicyEntry(input: {
  readonly generatedAt: string;
  readonly policyTwin: PolicyFoundryPolicyTwinSummary | null;
  readonly maxAgeDays: number;
}): PolicyFoundryDriftPolicyDebtEntry {
  const windowEnd = input.policyTwin?.windowEnd ?? null;
  const ageDays = windowEnd === null
    ? null
    : (new Date(input.generatedAt).getTime() - new Date(windowEnd).getTime()) / 86_400_000;
  const stale = ageDays === null || ageDays > input.maxAgeDays;
  return entry({
    kind: 'stale-policy-candidate',
    status: stale ? 'watch' : 'clean',
    severity: stale ? 'medium' : 'info',
    protectedPrinciple: 'runtime readiness',
    observedCount: stale ? 1 : 0,
    affectedSurfaces: [input.policyTwin?.actionSurface ?? null],
    sourceDigests: [input.policyTwin?.digest ?? null],
    reasonCodes: stale
      ? [`policy-twin-window-stale-or-missing:${Math.round(ageDays ?? -1)}`]
      : ['policy-twin-window-fresh'],
    mappedNoGoReasons: stale ? ['stale-policy-twin-window'] : [],
    recommendedAction: stale
      ? 'Refresh the Policy Twin backtest before relying on candidate scoring.'
      : 'No stale Policy Twin window detected.',
    limitation: 'Fresh backtests are not proof of production readiness.',
  });
}

function verifierCoverageEntry(input: {
  readonly coverage: PolicyFoundryCoverageScore | null;
  readonly gatePlanner: PolicyFoundryGatePlanner | null;
}): PolicyFoundryDriftPolicyDebtEntry {
  const coverageBlocked = input.coverage?.blockedDimensions.includes('verifier-or-gateway') === true;
  const gateBlocked = (input.gatePlanner?.plans ?? [])
    .filter((plan) => plan.blockingDimensions.includes('verifier-or-gateway'));
  const affected = gateBlocked.map((plan) => plan.actionSurface ?? 'unknown-surface');
  const hasDebt = coverageBlocked || affected.length > 0;
  return entry({
    kind: 'verifier-coverage-drift',
    status: hasDebt ? 'no-go' : 'clean',
    severity: hasDebt ? 'blocker' : 'info',
    protectedPrinciple: 'fail-closed boundary',
    observedCount: affected.length || (coverageBlocked ? 1 : 0),
    affectedSurfaces: affected,
    sourceDigests: [input.coverage?.digest ?? null, input.gatePlanner?.digest ?? null],
    reasonCodes: hasDebt ? ['verifier-or-gateway-coverage-missing'] : ['verifier-or-gateway-coverage-present'],
    mappedNoGoReasons: hasDebt ? ['missing-verifier-or-gateway'] : [],
    recommendedAction: hasDebt
      ? 'Close verifier/gateway coverage before claiming scoped enforcement readiness.'
      : 'No verifier/gateway coverage drift detected.',
    limitation: 'Repo evidence cannot prove deployed non-bypassability without runtime deployment evidence.',
  });
}

function actorConcentrationEntry(input: {
  readonly ledger: PolicyFoundryCounterexampleLedger | null;
  readonly maxConcentration: number;
}): PolicyFoundryDriftPolicyDebtEntry {
  const concentration = input.ledger?.singleActorConcentration ?? null;
  const concentrated = input.ledger?.noGoReasons.includes('single-actor-concentration') === true ||
    (concentration !== null && concentration > input.maxConcentration);
  return entry({
    kind: 'actor-concentration',
    status: concentrated ? 'no-go' : concentration === null ? 'watch' : 'clean',
    severity: concentrated ? 'high' : concentration === null ? 'medium' : 'info',
    protectedPrinciple: 'customer authority',
    observedCount: concentrated ? input.ledger?.matchingEventCount ?? 1 : 0,
    affectedSurfaces: [input.ledger?.actionSurface ?? null],
    sourceDigests: [input.ledger?.digest ?? null],
    reasonCodes: concentrated
      ? [`single-actor-concentration:${concentration ?? 'unknown'}`]
      : concentration === null ? ['actor-distribution-not-measured'] : ['actor-distribution-within-limit'],
    mappedNoGoReasons: concentrated ? ['single-actor-concentration'] : [],
    recommendedAction: concentrated
      ? 'Collect broader reviewer/action distribution or keep the candidate review-only.'
      : 'No actor concentration debt detected.',
    limitation: 'Actor identities remain digest-bound; this does not expose raw operator identity.',
  });
}

function policyShadowMismatchEntry(input: {
  readonly policyTwin: PolicyFoundryPolicyTwinSummary | null;
  readonly ledger: PolicyFoundryCounterexampleLedger | null;
}): PolicyFoundryDriftPolicyDebtEntry {
  const mismatch = input.policyTwin?.promotionBlocked === true ||
    (input.policyTwin?.highRiskAutoAdmitCount ?? 0) > 0 ||
    input.ledger?.promotionBlocked === true;
  return entry({
    kind: 'policy-shadow-mismatch',
    status: mismatch ? 'no-go' : input.policyTwin === null ? 'watch' : 'clean',
    severity: mismatch ? 'blocker' : input.policyTwin === null ? 'medium' : 'info',
    protectedPrinciple: 'proof integrity',
    observedCount: (input.policyTwin?.highRiskAutoAdmitCount ?? 0) +
      (input.ledger?.counterexampleCount ?? 0),
    affectedSurfaces: [input.policyTwin?.actionSurface ?? input.ledger?.actionSurface ?? null],
    sourceDigests: [input.policyTwin?.digest ?? null, input.ledger?.digest ?? null],
    reasonCodes: mismatch
      ? ['policy-twin-or-counterexample-promotion-blocked']
      : input.policyTwin === null ? ['policy-twin-summary-missing'] : ['policy-shadow-aligned'],
    mappedNoGoReasons: mismatch ? ['policy-shadow-mismatch'] : [],
    recommendedAction: mismatch
      ? 'Resolve Policy Twin/counterexample blockers before policy promotion.'
      : 'No policy/shadow mismatch detected.',
    limitation: 'This detector summarizes existing evidence; it does not run a fresh simulation.',
  });
}

function outcomeFeedbackEntry(
  outcomeFeedback: PolicyFoundryOutcomeFeedbackLoop | null,
): PolicyFoundryDriftPolicyDebtEntry {
  const negative = outcomeFeedback !== null && outcomeFeedback.noGoReasons.length > 0;
  return entry({
    kind: 'outcome-feedback-debt',
    status: negative ? 'debt-detected' : outcomeFeedback === null ? 'watch' : 'clean',
    severity: negative ? 'high' : outcomeFeedback === null ? 'medium' : 'info',
    protectedPrinciple: 'auditability',
    observedCount: outcomeFeedback?.noGoReasons.length ?? 0,
    affectedSurfaces: [outcomeFeedback?.actionSurface ?? null],
    sourceDigests: [outcomeFeedback?.digest ?? null],
    reasonCodes: negative
      ? outcomeFeedback.noGoReasons.map((reason) => `outcome-feedback:${reason}`)
      : outcomeFeedback === null ? ['outcome-feedback-missing'] : ['outcome-feedback-clean'],
    mappedNoGoReasons: negative ? ['negative-outcome-feedback'] : [],
    recommendedAction: negative
      ? 'Close reviewed-outcome and downstream receipt feedback blockers before increasing confidence.'
      : 'No negative outcome feedback debt detected.',
    limitation: 'Outcome feedback is scoring input only and does not mutate policy authority.',
  });
}

function schemaTemplateEntry(
  registry: PolicyFoundryCandidateRegistry | null,
): PolicyFoundryDriftPolicyDebtEntry {
  const debtCount = (registry?.needsTemplateCount ?? 0) + (registry?.blockedCount ?? 0);
  return entry({
    kind: 'schema-template-debt',
    status: debtCount > 0 ? 'debt-detected' : registry === null ? 'watch' : 'clean',
    severity: debtCount > 0 ? 'high' : registry === null ? 'medium' : 'info',
    protectedPrinciple: 'no overclaim',
    observedCount: debtCount,
    affectedSurfaces: registry?.candidates
      .filter((candidate) => candidate.schemaStatus !== 'schema-bound')
      .map((candidate) => candidate.actionSurface ?? 'unknown-surface') ?? [],
    sourceDigests: [registry?.digest ?? null],
    reasonCodes: debtCount > 0
      ? ['schema-template-debt-present']
      : registry === null ? ['candidate-registry-missing'] : ['schema-template-bound'],
    mappedNoGoReasons: debtCount > 0 ? ['schema-template-unbound'] : [],
    recommendedAction: debtCount > 0
      ? 'Bind candidates to schema templates before using them for rollout review.'
      : 'No schema/template debt detected.',
    limitation: 'Schema binding is necessary but not sufficient for production readiness.',
  });
}

function replayDebtEntry(input: {
  readonly coverage: PolicyFoundryCoverageScore | null;
  readonly ledger: PolicyFoundryCounterexampleLedger | null;
  readonly maxReplayDuplicateRate: number;
}): PolicyFoundryDriftPolicyDebtEntry {
  const coverageDebt = input.coverage?.blockedDimensions.includes('replay-idempotency') === true;
  const replayRate = input.ledger?.replayDuplicateRate ?? 0;
  const ledgerDebt = input.ledger?.noGoReasons.includes('replay-duplicate-pressure') === true ||
    replayRate > input.maxReplayDuplicateRate;
  const hasDebt = coverageDebt || ledgerDebt;
  return entry({
    kind: 'replay-idempotency-debt',
    status: hasDebt ? 'no-go' : 'clean',
    severity: hasDebt ? 'high' : 'info',
    protectedPrinciple: 'replay and idempotency safety',
    observedCount: hasDebt ? 1 : 0,
    affectedSurfaces: [
      ...(input.coverage?.surfaces
        .filter((surface) => surface.missingDimensions.includes('replay-idempotency') ||
          surface.partialDimensions.includes('replay-idempotency'))
        .map((surface) => surface.actionSurface ?? 'unknown-surface') ?? []),
      input.ledger?.actionSurface ?? null,
    ],
    sourceDigests: [input.coverage?.digest ?? null, input.ledger?.digest ?? null],
    reasonCodes: hasDebt
      ? [`replay-idempotency-debt:${replayRate}`]
      : ['replay-idempotency-within-limit'],
    mappedNoGoReasons: hasDebt ? ['replay-idempotency-drift'] : [],
    recommendedAction: hasDebt
      ? 'Close replay/idempotency coverage before scoped rollout review.'
      : 'No replay/idempotency drift detected.',
    limitation: 'This detector does not consume live replay ledgers; it summarizes supplied evidence.',
  });
}

function detectorStatus(
  entries: readonly PolicyFoundryDriftPolicyDebtEntry[],
): PolicyFoundryDriftPolicyDebtStatus {
  if (entries.some((item) => item.status === 'no-go')) return 'no-go';
  if (entries.some((item) => item.status === 'debt-detected')) return 'debt-detected';
  if (entries.some((item) => item.status === 'watch')) return 'watch';
  return 'clean';
}

function nextSafeStep(status: PolicyFoundryDriftPolicyDebtStatus): string {
  switch (status) {
    case 'clean':
      return 'Continue reviewed rollout preparation; drift detector output does not activate enforcement.';
    case 'watch':
      return 'Collect the missing drift evidence before increasing rollout confidence.';
    case 'debt-detected':
      return 'Resolve policy debt entries before promotion or scoped rollout review.';
    case 'no-go':
      return 'Do not promote or scope-enforce until blocker drift/debt entries are closed.';
  }
}

export function createPolicyFoundryDriftPolicyDebtDetector(
  input: CreatePolicyFoundryDriftPolicyDebtDetectorInput,
): PolicyFoundryDriftPolicyDebtDetector {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const maxPolicyTwinAgeDays = positiveNumber(input.maxPolicyTwinAgeDays, 30, 'maxPolicyTwinAgeDays');
  const maxSingleActorConcentration = ratioLimit(
    input.maxSingleActorConcentration,
    0.8,
    'maxSingleActorConcentration',
  );
  const maxReplayDuplicateRate = ratioLimit(input.maxReplayDuplicateRate, 0.1, 'maxReplayDuplicateRate');
  const entries = Object.freeze([
    newActionSurfaceEntry({
      coverage: input.coverage ?? null,
      registry: input.candidateRegistry ?? null,
    }),
    stalePolicyEntry({
      generatedAt,
      policyTwin: input.policyTwinSummary ?? null,
      maxAgeDays: maxPolicyTwinAgeDays,
    }),
    verifierCoverageEntry({
      coverage: input.coverage ?? null,
      gatePlanner: input.gatePlanner ?? null,
    }),
    actorConcentrationEntry({
      ledger: input.counterexampleLedger ?? null,
      maxConcentration: maxSingleActorConcentration,
    }),
    policyShadowMismatchEntry({
      policyTwin: input.policyTwinSummary ?? null,
      ledger: input.counterexampleLedger ?? null,
    }),
    outcomeFeedbackEntry(input.outcomeFeedback ?? null),
    schemaTemplateEntry(input.candidateRegistry ?? null),
    replayDebtEntry({
      coverage: input.coverage ?? null,
      ledger: input.counterexampleLedger ?? null,
      maxReplayDuplicateRate,
    }),
  ]);
  const status = detectorStatus(entries);
  const noGoReasons = Object.freeze([
    ...new Set(entries.flatMap((item) => item.mappedNoGoReasons)),
  ].sort());
  const affectedSurfaceCount = uniqueSorted(entries.flatMap((item) => item.affectedSurfaces)).length;
  const payload = {
    version: POLICY_FOUNDRY_DRIFT_POLICY_DEBT_DETECTOR_VERSION as typeof POLICY_FOUNDRY_DRIFT_POLICY_DEBT_DETECTOR_VERSION,
    generatedAt,
    status,
    sourceDigests: {
      coverageDigest: input.coverage?.digest ?? null,
      gatePlannerDigest: input.gatePlanner?.digest ?? null,
      candidateRegistryDigest: input.candidateRegistry?.digest ?? null,
      counterexampleLedgerDigest: input.counterexampleLedger?.digest ?? null,
      policyTwinSummaryDigest: input.policyTwinSummary?.digest ?? null,
      outcomeFeedbackDigest: input.outcomeFeedback?.digest ?? null,
    },
    entryCount: entries.length,
    blockerCount: entries.filter((item) => item.status === 'no-go' || item.severity === 'blocker').length,
    highSeverityCount: entries.filter((item) => item.severity === 'high').length,
    watchCount: entries.filter((item) => item.status === 'watch').length,
    affectedSurfaceCount,
    entries,
    noGoReasons,
    nextSafeStep: nextSafeStep(status),
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    activatesEnforcement: false as const,
    reviewMaterialOnly: true as const,
    automaticRemediationAllowed: false as const,
    policyMutationAllowed: false as const,
    deploysInfrastructure: false as const,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION as typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-drift-policy-debt-detector' as const,
    limitation:
      'Drift and policy debt detection summarizes supplied evidence only. It does not scan infrastructure, mutate policies, deploy controls, activate enforcement, or prove production readiness.',
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function policyFoundryDriftPolicyDebtDetectorDescriptor():
PolicyFoundryDriftPolicyDebtDetectorDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_DRIFT_POLICY_DEBT_DETECTOR_VERSION,
    statuses: POLICY_FOUNDRY_DRIFT_POLICY_DEBT_STATUSES,
    entryKinds: POLICY_FOUNDRY_DRIFT_POLICY_DEBT_ENTRY_KINDS,
    noGoReasons: POLICY_FOUNDRY_DRIFT_POLICY_DEBT_NO_GO_REASONS,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    reviewMaterialOnly: true,
    automaticRemediationAllowed: false,
    policyMutationAllowed: false,
    deploysInfrastructure: false,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-drift-policy-debt-detector',
  });
}
