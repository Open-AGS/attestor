import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenOperationalExecutionShadowFixtureSuite,
  GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION,
  type GoldenOperationalExecutionShadowFixture,
  type GoldenOperationalExecutionShadowFixtureSuite,
} from './golden-operational-execution-shadow-fixtures.js';
import {
  createPolicyFoundryPolicyTwinSummary,
  POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION,
  type PolicyFoundryPolicyTwinSummary,
} from './policy-foundry-policy-twin-summary.js';
import type {
  ShadowPolicyDiscoveryCandidate,
} from './policy-discovery-candidates.js';
import type {
  ShadowPolicyDecisionCounts,
  ShadowPolicyGapCounts,
  ShadowPolicyRecommendation,
  ShadowPolicySimulationReport,
} from './shadow-simulation.js';

export const GOLDEN_OPERATIONAL_EXECUTION_POLICY_FOUNDRY_PROJECTION_VERSION =
  'attestor.golden-operational-execution-policy-foundry-projection.v1';

export const GOLDEN_OPERATIONAL_EXECUTION_POLICY_FOUNDRY_NAMED_GAP_KINDS = [
  'rollback-plan-missing',
  'secret-rotation-stale-approval',
  'infrastructure-drift-review',
  'break-glass-secondary-approval',
  'runbook-instruction-review',
  'duplicate-operation-replay',
] as const;
export type GoldenOperationalExecutionPolicyFoundryNamedGapKind =
  typeof GOLDEN_OPERATIONAL_EXECUTION_POLICY_FOUNDRY_NAMED_GAP_KINDS[number];

export interface GoldenOperationalExecutionPolicyFoundryNamedGap {
  readonly kind: GoldenOperationalExecutionPolicyFoundryNamedGapKind;
  readonly scenario: GoldenOperationalExecutionShadowFixture['scenario'];
  readonly severity: 'medium' | 'high' | 'blocker';
  readonly protectedPrinciple: string;
  readonly fixtureDigest: string;
  readonly reasonCodes: readonly string[];
  readonly reviewOnly: true;
}

export interface GoldenOperationalExecutionPolicyFoundryReviewOnlyCandidate {
  readonly candidateId: string;
  readonly actionSurface: 'operational_execution.change_request';
  readonly domain: 'system-operation';
  readonly proposedMode: 'review';
  readonly requiredControls: readonly [
    'evidence',
    'authority',
    'customer-approval',
    'policy',
    'block-investigation',
  ];
  readonly sourceFixtureDigests: readonly string[];
  readonly namedGapKinds: readonly GoldenOperationalExecutionPolicyFoundryNamedGapKind[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly reviewOnly: true;
}

export interface GoldenOperationalExecutionPolicyFoundryProjection {
  readonly version: typeof GOLDEN_OPERATIONAL_EXECUTION_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'O02';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourceFixtureCount: 8;
  readonly actionSurface: 'operational_execution.change_request';
  readonly domain: 'system-operation';
  readonly report: ShadowPolicySimulationReport;
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly reviewOnlyCandidate: GoldenOperationalExecutionPolicyFoundryReviewOnlyCandidate;
  readonly policyTwinSummary: PolicyFoundryPolicyTwinSummary;
  readonly namedGaps: readonly GoldenOperationalExecutionPolicyFoundryNamedGap[];
  readonly backtestMaterial: {
    readonly fixtureDigests: readonly string[];
    readonly eventDigests: readonly string[];
    readonly decisionCounts: ShadowPolicyDecisionCounts;
    readonly gapCounts: ShadowPolicyGapCounts;
    readonly reviewOnlyCandidateDigest: string;
  };
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly rawRunbookTextStored: false;
  readonly rawSecretMaterialStored: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenOperationalExecutionPolicyFoundryProjectionDescriptor {
  readonly version: typeof GOLDEN_OPERATIONAL_EXECUTION_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'O02';
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION;
  readonly policyTwinSummaryVersion: typeof POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION;
  readonly actionSurface: 'operational_execution.change_request';
  readonly domain: 'system-operation';
  readonly reviewOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly rawRunbookTextStored: false;
  readonly rawSecretMaterialStored: false;
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-26T10:30:00.000Z';
const GOLDEN_OPERATIONAL_EXECUTION_REQUIRED_CONTROLS = [
  'evidence',
  'authority',
  'customer-approval',
  'policy',
  'block-investigation',
] as const;
const GOLDEN_OPERATIONAL_EXECUTION_SOURCE_RECOMMENDATION_KINDS = [
  'define-policy',
  'bind-authority',
  'bind-evidence',
  'promote-to-review',
] as const;

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

function digestFor(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

function decisionCounts(
  fixtures: readonly GoldenOperationalExecutionShadowFixture[],
): ShadowPolicyDecisionCounts {
  let admit = 0;
  let narrow = 0;
  let review = 0;
  let block = 0;

  for (const fixture of fixtures) {
    const decision = fixture.event.decision.shadowDecision;
    if (decision === 'would_admit') admit += 1;
    else if (decision === 'would_narrow') narrow += 1;
    else if (decision === 'would_block') block += 1;
    else review += 1;
  }

  return Object.freeze({ admit, narrow, review, block });
}

function gapCounts(
  fixtures: readonly GoldenOperationalExecutionShadowFixture[],
): ShadowPolicyGapCounts {
  return Object.freeze({
    policy: fixtures.filter((fixture) =>
      fixture.operationFacts.rollbackPlanStatus === 'missing' ||
      fixture.operationFacts.dryRunStatus === 'drift-detected' ||
      fixture.operationFacts.duplicateOperationAttempt
    ).length,
    evidence: fixtures.filter((fixture) =>
      fixture.operationFacts.approvalFreshness === 'missing' ||
      fixture.operationFacts.approvalFreshness === 'stale' ||
      fixture.operationFacts.instructionLikeEvidence ||
      fixture.operationFacts.dryRunStatus === 'missing'
    ).length,
    authority: fixtures.filter((fixture) =>
      fixture.operationFacts.operatorAuthority === 'model-rationale-only' ||
      fixture.operationFacts.approvalFreshness === 'missing' ||
      fixture.operationFacts.approvalFreshness === 'stale'
    ).length,
    amountScope: 0,
    recipientScope: 0,
    dataScope: 0,
    adapter: 0,
    customDomain: 0,
  });
}

function namedGaps(
  suite: GoldenOperationalExecutionShadowFixtureSuite,
): readonly GoldenOperationalExecutionPolicyFoundryNamedGap[] {
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));
  const rollbackMissing = byScenario.get('production-deploy-missing-rollback');
  const staleSecret = byScenario.get('secret-rotation-stale-approval');
  const drift = byScenario.get('infrastructure-change-drift-review');
  const breakGlass = byScenario.get('incident-restart-break-glass');
  const runbookInjection = byScenario.get('prompt-injection-in-runbook');
  const duplicateReplay = byScenario.get('duplicate-operation-replay-blocked');
  if (!rollbackMissing || !staleSecret || !drift || !breakGlass || !runbookInjection || !duplicateReplay) {
    throw new Error(
      'Golden operational execution Policy Foundry projection requires the full O01 fixture suite.',
    );
  }
  return Object.freeze([
    Object.freeze({
      kind: 'rollback-plan-missing',
      scenario: rollbackMissing.scenario,
      severity: 'high',
      protectedPrinciple: 'runtime readiness',
      fixtureDigest: rollbackMissing.digest,
      reasonCodes: rollbackMissing.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'secret-rotation-stale-approval',
      scenario: staleSecret.scenario,
      severity: 'blocker',
      protectedPrinciple: 'customer authority',
      fixtureDigest: staleSecret.digest,
      reasonCodes: staleSecret.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'infrastructure-drift-review',
      scenario: drift.scenario,
      severity: 'high',
      protectedPrinciple: 'operational boundedness',
      fixtureDigest: drift.digest,
      reasonCodes: drift.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'break-glass-secondary-approval',
      scenario: breakGlass.scenario,
      severity: 'high',
      protectedPrinciple: 'fail-closed boundary',
      fixtureDigest: breakGlass.digest,
      reasonCodes: breakGlass.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'runbook-instruction-review',
      scenario: runbookInjection.scenario,
      severity: 'high',
      protectedPrinciple: 'proof integrity',
      fixtureDigest: runbookInjection.digest,
      reasonCodes: runbookInjection.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'duplicate-operation-replay',
      scenario: duplicateReplay.scenario,
      severity: 'blocker',
      protectedPrinciple: 'replay and idempotency safety',
      fixtureDigest: duplicateReplay.digest,
      reasonCodes: duplicateReplay.reasonCodes,
      reviewOnly: true,
    }),
  ]);
}

function recommendations(
  gaps: readonly GoldenOperationalExecutionPolicyFoundryNamedGap[],
): readonly ShadowPolicyRecommendation[] {
  return Object.freeze([
    Object.freeze({
      kind: 'define-policy',
      severity: 'high',
      title: 'Define operational change policy before execution promotion',
      summary: 'Deploy, rollback, drift, incident, and secret-rotation fixtures keep the operational candidate review-only.',
      actionSurface: 'operational_execution.change_request',
      domain: 'system-operation',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'rollback-plan-missing' ||
        gap.kind === 'infrastructure-drift-review' ||
        gap.kind === 'break-glass-secondary-approval'
      ).length,
      reasonCodes: Object.freeze([
        'operational-execution:rollback-plan-missing',
        'operational-execution:infrastructure-drift-detected',
        'operational-execution:break-glass-review-required',
      ]),
      nextMode: 'review',
      confidence: 0.86,
    }),
    Object.freeze({
      kind: 'bind-authority',
      severity: 'blocker',
      title: 'Bind operator authority and approval freshness before live operation',
      summary: 'Secret rotation, break-glass incident actions, and model-rationale-only runbook evidence cannot authorize execution.',
      actionSurface: 'operational_execution.change_request',
      domain: 'system-operation',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'secret-rotation-stale-approval' ||
        gap.kind === 'break-glass-secondary-approval' ||
        gap.kind === 'runbook-instruction-review'
      ).length,
      reasonCodes: Object.freeze([
        'operational-execution:stale-approval',
        'operational-execution:break-glass-review-required',
        'operational-execution:model-rationale-not-authority',
      ]),
      nextMode: 'review',
      confidence: 0.9,
    }),
    Object.freeze({
      kind: 'bind-evidence',
      severity: 'high',
      title: 'Require dry-run, plan, rollback, and incident evidence before promotion',
      summary: 'Operational changes need plan/dry-run and rollback evidence; runbook text stays evidence, not authority.',
      actionSurface: 'operational_execution.change_request',
      domain: 'system-operation',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'rollback-plan-missing' ||
        gap.kind === 'infrastructure-drift-review' ||
        gap.kind === 'runbook-instruction-review'
      ).length,
      reasonCodes: Object.freeze([
        'operational-execution:review-before-deploy',
        'operational-execution:review-before-apply',
        'operational-execution:ignore-runbook-text-as-instruction',
      ]),
      nextMode: 'review',
      confidence: 0.84,
    }),
    Object.freeze({
      kind: 'promote-to-review',
      severity: 'blocker',
      title: 'Keep duplicate operations and live execution behind review',
      summary: 'Replay-shaped duplicate deploy attempts remain blocked until idempotency and customer PEP proof exist.',
      actionSurface: 'operational_execution.change_request',
      domain: 'system-operation',
      affectedEvents: gaps.filter((gap) => gap.kind === 'duplicate-operation-replay').length,
      reasonCodes: Object.freeze([
        'operational-execution:duplicate-operation-replay',
        'operational-execution:block-before-execution',
      ]),
      nextMode: 'review',
      confidence: 0.88,
    }),
  ]);
}

function createReport(
  suite: GoldenOperationalExecutionShadowFixtureSuite,
  counts: ShadowPolicyDecisionCounts,
  gaps: ShadowPolicyGapCounts,
  gapList: readonly GoldenOperationalExecutionPolicyFoundryNamedGap[],
): ShadowPolicySimulationReport {
  const eventDigests = Object.freeze(suite.fixtures.map((fixture) => fixture.event.digest));
  const surfaceSimulation = Object.freeze({
    actionSurface: 'operational_execution.change_request',
    domain: 'system-operation',
    eventCount: suite.fixtureCount,
    simulatedDecisionCounts: counts,
    gapCounts: gaps,
    downstreamFailures: 0,
    humanRejections: 0,
    nonEnforcingEvents: suite.fixtureCount,
    eventDigests,
  });
  const payload = {
    version: 'attestor.shadow-policy-simulation.v1',
    reportId: `golden-operational-execution-policy-twin:${suite.digest}`,
    generatedAt: GENERATED_AT,
    windowStart: suite.fixtures[0]?.event.occurredAt ?? null,
    windowEnd: suite.fixtures.at(-1)?.event.observedAt ?? null,
    proposedMode: 'review',
    eventCount: suite.fixtureCount,
    eventDigests,
    requestedMinimumPromotionEvents: 5,
    minimumPromotionEvents: 5,
    minimumPromotionEventsFloor: 5,
    minimumPromotionEventsSource: 'caller-request',
    simulatedDecisionCounts: counts,
    gapCounts: gaps,
    reviewLoadCount: counts.review,
    blockedCount: counts.block,
    nonEnforcingEventCount: suite.fixtureCount,
    rawPayloadEventCount: 0,
    surfaceSimulations: Object.freeze([surfaceSimulation]),
    recommendations: recommendations(gapList),
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function createCandidate(
  report: ShadowPolicySimulationReport,
  gaps: readonly GoldenOperationalExecutionPolicyFoundryNamedGap[],
): ShadowPolicyDiscoveryCandidate {
  const reasonCodes = Object.freeze(
    [...new Set(gaps.flatMap((gap) => gap.reasonCodes))].sort(),
  );
  return Object.freeze({
    candidateId: `policy-candidate:${digestFor('golden-operational-execution-review-only-candidate', {
      reportDigest: report.digest,
      reasonCodes,
    })}`,
    actionSurface: 'operational_execution.change_request',
    domain: 'system-operation',
    action: 'review-mode-rehearsal',
    proposedMode: 'review',
    approvalRequired: true,
    autoEnforce: false,
    requiredControls: GOLDEN_OPERATIONAL_EXECUTION_REQUIRED_CONTROLS,
    sourceRecommendationKinds: GOLDEN_OPERATIONAL_EXECUTION_SOURCE_RECOMMENDATION_KINDS,
    highestSeverity: 'blocker',
    affectedEvents: report.eventCount,
    confidence: 0.86,
    reasonCodes,
    summary:
      'Operational Execution candidate is review-only: bind dry-run, rollback, approval, authority, drift, incident, and replay controls before promotion.',
  });
}

function createReviewOnlyCandidate(
  candidate: ShadowPolicyDiscoveryCandidate,
  suite: GoldenOperationalExecutionShadowFixtureSuite,
  gaps: readonly GoldenOperationalExecutionPolicyFoundryNamedGap[],
): GoldenOperationalExecutionPolicyFoundryReviewOnlyCandidate {
  return Object.freeze({
    candidateId: candidate.candidateId,
    actionSurface: 'operational_execution.change_request',
    domain: 'system-operation',
    proposedMode: 'review',
    requiredControls: GOLDEN_OPERATIONAL_EXECUTION_REQUIRED_CONTROLS,
    sourceFixtureDigests: Object.freeze(suite.fixtures.map((fixture) => fixture.digest)),
    namedGapKinds: Object.freeze(gaps.map((gap) => gap.kind)),
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    reviewOnly: true,
  });
}

export function createGoldenOperationalExecutionPolicyFoundryProjection(
  suite: GoldenOperationalExecutionShadowFixtureSuite = createGoldenOperationalExecutionShadowFixtureSuite(),
): GoldenOperationalExecutionPolicyFoundryProjection {
  const counts = decisionCounts(suite.fixtures);
  const gaps = gapCounts(suite.fixtures);
  const gapList = namedGaps(suite);
  const report = createReport(suite, counts, gaps, gapList);
  const candidate = createCandidate(report, gapList);
  const reviewOnlyCandidate = createReviewOnlyCandidate(candidate, suite, gapList);
  const reviewOnlyCandidateDigest = digestFor('golden-operational-execution-review-only-candidate', {
    candidateId: reviewOnlyCandidate.candidateId,
    fixtureDigests: reviewOnlyCandidate.sourceFixtureDigests,
    namedGapKinds: reviewOnlyCandidate.namedGapKinds,
  });
  const policyTwinSummary = createPolicyFoundryPolicyTwinSummary({
    candidate,
    report,
    readiness: null,
    counterexampleLedger: null,
    generatedAt: GENERATED_AT,
  });
  const payload = {
    version: GOLDEN_OPERATIONAL_EXECUTION_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'O02',
    generatedAt: GENERATED_AT,
    sourceFixtureSuiteVersion: suite.version,
    sourceFixtureSuiteDigest: suite.digest,
    sourceFixtureCount: suite.fixtureCount,
    actionSurface: 'operational_execution.change_request',
    domain: 'system-operation',
    reportDigest: report.digest,
    candidateId: candidate.candidateId,
    reviewOnlyCandidateDigest,
    policyTwinSummaryDigest: policyTwinSummary.digest,
    namedGapKinds: gapList.map((gap) => gap.kind),
    fixtureDigests: suite.fixtures.map((fixture) => fixture.digest),
    eventDigests: suite.fixtures.map((fixture) => fixture.event.digest),
    decisionCounts: counts,
    gapCounts: gaps,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    rawRunbookTextStored: false,
    rawSecretMaterialStored: false,
    productionReady: false,
    reviewMaterialOnly: true,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    report,
    candidate,
    reviewOnlyCandidate,
    policyTwinSummary,
    namedGaps: gapList,
    backtestMaterial: Object.freeze({
      fixtureDigests: Object.freeze(suite.fixtures.map((fixture) => fixture.digest)),
      eventDigests: Object.freeze(suite.fixtures.map((fixture) => fixture.event.digest)),
      decisionCounts: counts,
      gapCounts: gaps,
      reviewOnlyCandidateDigest,
    }),
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function goldenOperationalExecutionPolicyFoundryProjectionDescriptor():
  GoldenOperationalExecutionPolicyFoundryProjectionDescriptor {
  return Object.freeze({
    version: GOLDEN_OPERATIONAL_EXECUTION_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'O02',
    sourceFixtureSuiteVersion: GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION,
    policyTwinSummaryVersion: POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION,
    actionSurface: 'operational_execution.change_request',
    domain: 'system-operation',
    reviewOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    rawRunbookTextStored: false,
    rawSecretMaterialStored: false,
    productionReady: false,
  });
}
