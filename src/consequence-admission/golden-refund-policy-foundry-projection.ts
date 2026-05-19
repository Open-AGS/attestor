import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenRefundShadowFixtureSuite,
  GOLDEN_REFUND_SHADOW_FIXTURES_VERSION,
  type GoldenRefundShadowFixture,
  type GoldenRefundShadowFixtureSuite,
} from './golden-refund-shadow-fixtures.js';
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

export const GOLDEN_REFUND_POLICY_FOUNDRY_PROJECTION_VERSION =
  'attestor.golden-refund-policy-foundry-projection.v1';

export const GOLDEN_REFUND_POLICY_FOUNDRY_NAMED_GAP_KINDS = [
  'missing-payment-evidence',
  'stale-payment-evidence',
  'prior-refund-relationship-review',
  'human-approval-required',
  'instruction-like-evidence-review',
  'external-risk-signal-review',
  'policy-limit-review',
] as const;
export type GoldenRefundPolicyFoundryNamedGapKind =
  typeof GOLDEN_REFUND_POLICY_FOUNDRY_NAMED_GAP_KINDS[number];

export interface GoldenRefundPolicyFoundryNamedGap {
  readonly kind: GoldenRefundPolicyFoundryNamedGapKind;
  readonly scenario: GoldenRefundShadowFixture['scenario'];
  readonly severity: 'medium' | 'high' | 'blocker';
  readonly protectedPrinciple: string;
  readonly fixtureDigest: string;
  readonly reasonCodes: readonly string[];
  readonly reviewOnly: true;
}

export interface GoldenRefundPolicyFoundryReviewOnlyCandidate {
  readonly candidateId: string;
  readonly actionSurface: 'refund_service.issue_refund';
  readonly domain: 'money-movement';
  readonly proposedMode: 'review';
  readonly requiredControls: readonly [
    'evidence',
    'authority',
    'customer-approval',
  ];
  readonly sourceFixtureDigests: readonly string[];
  readonly namedGapKinds: readonly GoldenRefundPolicyFoundryNamedGapKind[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly reviewOnly: true;
}

export interface GoldenRefundPolicyFoundryProjection {
  readonly version: typeof GOLDEN_REFUND_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'G04';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_REFUND_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourceFixtureCount: 8;
  readonly actionSurface: 'refund_service.issue_refund';
  readonly domain: 'money-movement';
  readonly report: ShadowPolicySimulationReport;
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly reviewOnlyCandidate: GoldenRefundPolicyFoundryReviewOnlyCandidate;
  readonly policyTwinSummary: PolicyFoundryPolicyTwinSummary;
  readonly namedGaps: readonly GoldenRefundPolicyFoundryNamedGap[];
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
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenRefundPolicyFoundryProjectionDescriptor {
  readonly version: typeof GOLDEN_REFUND_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'G04';
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_REFUND_SHADOW_FIXTURES_VERSION;
  readonly policyTwinSummaryVersion: typeof POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION;
  readonly actionSurface: 'refund_service.issue_refund';
  readonly domain: 'money-movement';
  readonly reviewOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-19T07:00:00.000Z';
const GOLDEN_REFUND_REQUIRED_CONTROLS = [
  'evidence',
  'authority',
  'customer-approval',
] as const;
const GOLDEN_REFUND_SOURCE_RECOMMENDATION_KINDS = [
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

function decisionCounts(fixtures: readonly GoldenRefundShadowFixture[]): ShadowPolicyDecisionCounts {
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

function gapCounts(fixtures: readonly GoldenRefundShadowFixture[]): ShadowPolicyGapCounts {
  return Object.freeze({
    policy: fixtures.filter((fixture) =>
      fixture.refundFacts.policyLimitPosture === 'over-policy'
    ).length,
    evidence: fixtures.filter((fixture) =>
      fixture.expectedEvidenceStates.includes('missing') ||
      fixture.expectedEvidenceStates.includes('stale')
    ).length,
    authority: fixtures.filter((fixture) => fixture.refundFacts.approvalRequired).length,
    adapter: 0,
  });
}

function namedGaps(
  suite: GoldenRefundShadowFixtureSuite,
): readonly GoldenRefundPolicyFoundryNamedGap[] {
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));
  const missing = byScenario.get('missing-evidence');
  const stale = byScenario.get('stale-evidence');
  const repeated = byScenario.get('repeated-refund');
  const approval = byScenario.get('approval-required');
  const adversarial = byScenario.get('adversarial-text-in-evidence');
  const externalRisk = byScenario.get('external-fraud-signal-high');
  const overPolicy = byScenario.get('over-policy-amount');
  if (
    !missing ||
    !stale ||
    !repeated ||
    !approval ||
    !adversarial ||
    !externalRisk ||
    !overPolicy
  ) {
    throw new Error('Golden refund Policy Foundry projection requires the full G03 fixture suite.');
  }
  return Object.freeze([
    Object.freeze({
      kind: 'missing-payment-evidence',
      scenario: missing.scenario,
      severity: 'blocker',
      protectedPrinciple: 'data minimization and redaction',
      fixtureDigest: missing.digest,
      reasonCodes: missing.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'stale-payment-evidence',
      scenario: stale.scenario,
      severity: 'high',
      protectedPrinciple: 'runtime readiness',
      fixtureDigest: stale.digest,
      reasonCodes: stale.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'prior-refund-relationship-review',
      scenario: repeated.scenario,
      severity: 'high',
      protectedPrinciple: 'replay and idempotency safety',
      fixtureDigest: repeated.digest,
      reasonCodes: repeated.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'human-approval-required',
      scenario: approval.scenario,
      severity: 'high',
      protectedPrinciple: 'customer authority',
      fixtureDigest: approval.digest,
      reasonCodes: approval.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'instruction-like-evidence-review',
      scenario: adversarial.scenario,
      severity: 'high',
      protectedPrinciple: 'data minimization and redaction',
      fixtureDigest: adversarial.digest,
      reasonCodes: adversarial.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'external-risk-signal-review',
      scenario: externalRisk.scenario,
      severity: 'high',
      protectedPrinciple: 'proof integrity',
      fixtureDigest: externalRisk.digest,
      reasonCodes: externalRisk.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'policy-limit-review',
      scenario: overPolicy.scenario,
      severity: 'high',
      protectedPrinciple: 'customer authority',
      fixtureDigest: overPolicy.digest,
      reasonCodes: overPolicy.reasonCodes,
      reviewOnly: true,
    }),
  ]);
}

function recommendations(
  gaps: readonly GoldenRefundPolicyFoundryNamedGap[],
): readonly ShadowPolicyRecommendation[] {
  return Object.freeze([
    Object.freeze({
      kind: 'bind-evidence',
      severity: 'blocker',
      title: 'Bind payment and order evidence before refund promotion',
      summary: 'Missing or stale payment evidence keeps the refund candidate review-only.',
      actionSurface: 'refund_service.issue_refund',
      domain: 'money-movement',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'missing-payment-evidence' ||
        gap.kind === 'stale-payment-evidence'
      ).length,
      reasonCodes: Object.freeze([
        'refund:missing-payment-evidence',
        'refund:stale-payment-evidence',
      ]),
      nextMode: 'review',
      confidence: 0.9,
    }),
    Object.freeze({
      kind: 'bind-authority',
      severity: 'high',
      title: 'Keep approval-required refunds behind human review',
      summary: 'Approval-required refund fixtures do not create enforceable policy material.',
      actionSurface: 'refund_service.issue_refund',
      domain: 'money-movement',
      affectedEvents: gaps.filter((gap) => gap.kind === 'human-approval-required').length,
      reasonCodes: Object.freeze(['refund:human-approval-required']),
      nextMode: 'review',
      confidence: 0.85,
    }),
    Object.freeze({
      kind: 'promote-to-review',
      severity: 'medium',
      title: 'Use repeated refund signal as review pressure only',
      summary: 'Prior refund relationships can escalate review but cannot activate policy.',
      actionSurface: 'refund_service.issue_refund',
      domain: 'money-movement',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'prior-refund-relationship-review'
      ).length,
      reasonCodes: Object.freeze(['refund:prior-refund-multiple']),
      nextMode: 'review',
      confidence: 0.8,
    }),
    Object.freeze({
      kind: 'promote-to-review',
      severity: 'high',
      title: 'Treat instruction-like evidence text as evidence, not instructions',
      summary: 'Adversarial or instruction-like evidence text creates review pressure only.',
      actionSurface: 'refund_service.issue_refund',
      domain: 'money-movement',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'instruction-like-evidence-review'
      ).length,
      reasonCodes: Object.freeze([
        'refund:instruction-like-evidence-text',
        'refund:ignore-evidence-as-instruction',
      ]),
      nextMode: 'review',
      confidence: 0.82,
    }),
    Object.freeze({
      kind: 'bind-evidence',
      severity: 'high',
      title: 'Bind external risk signals before refund promotion',
      summary: 'External fraud or risk signals are evidence inputs, not Attestor-native fraud detection.',
      actionSurface: 'refund_service.issue_refund',
      domain: 'money-movement',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'external-risk-signal-review'
      ).length,
      reasonCodes: Object.freeze([
        'refund:external-fraud-signal-high',
        'refund:review-external-risk-signal',
      ]),
      nextMode: 'review',
      confidence: 0.82,
    }),
    Object.freeze({
      kind: 'define-policy',
      severity: 'high',
      title: 'Define policy limits for over-policy refund amounts',
      summary: 'Over-policy refund amounts stay review-only until explicit customer policy limits are bound.',
      actionSurface: 'refund_service.issue_refund',
      domain: 'money-movement',
      affectedEvents: gaps.filter((gap) => gap.kind === 'policy-limit-review').length,
      reasonCodes: Object.freeze([
        'refund:over-policy-amount',
        'refund:policy-limit-review-required',
      ]),
      nextMode: 'review',
      confidence: 0.84,
    }),
  ]);
}

function createReport(
  suite: GoldenRefundShadowFixtureSuite,
  counts: ShadowPolicyDecisionCounts,
  gaps: ShadowPolicyGapCounts,
  gapList: readonly GoldenRefundPolicyFoundryNamedGap[],
): ShadowPolicySimulationReport {
  const eventDigests = Object.freeze(suite.fixtures.map((fixture) => fixture.event.digest));
  const surfaceSimulation = Object.freeze({
    actionSurface: 'refund_service.issue_refund',
    domain: 'money-movement',
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
    reportId: `golden-refund-policy-twin:${suite.digest}`,
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
  gaps: readonly GoldenRefundPolicyFoundryNamedGap[],
): ShadowPolicyDiscoveryCandidate {
  const reasonCodes = Object.freeze(
    [...new Set(gaps.flatMap((gap) => gap.reasonCodes))].sort(),
  );
  return Object.freeze({
    candidateId: `policy-candidate:${digestFor('golden-refund-review-only-candidate', {
      reportDigest: report.digest,
      reasonCodes,
    })}`,
    actionSurface: 'refund_service.issue_refund',
    domain: 'money-movement',
    action: 'review-mode-rehearsal',
    proposedMode: 'review',
    approvalRequired: true,
    autoEnforce: false,
    requiredControls: GOLDEN_REFUND_REQUIRED_CONTROLS,
    sourceRecommendationKinds: GOLDEN_REFUND_SOURCE_RECOMMENDATION_KINDS,
    highestSeverity: 'blocker',
    affectedEvents: report.eventCount,
    confidence: 0.85,
    reasonCodes,
    summary:
      'Golden refund candidate is review-only: bind evidence, approval, and prior-refund relationship checks before promotion.',
  });
}

function createReviewOnlyCandidate(
  candidate: ShadowPolicyDiscoveryCandidate,
  suite: GoldenRefundShadowFixtureSuite,
  gaps: readonly GoldenRefundPolicyFoundryNamedGap[],
): GoldenRefundPolicyFoundryReviewOnlyCandidate {
  return Object.freeze({
    candidateId: candidate.candidateId,
    actionSurface: 'refund_service.issue_refund',
    domain: 'money-movement',
    proposedMode: 'review',
    requiredControls: GOLDEN_REFUND_REQUIRED_CONTROLS,
    sourceFixtureDigests: Object.freeze(suite.fixtures.map((fixture) => fixture.digest)),
    namedGapKinds: Object.freeze(gaps.map((gap) => gap.kind)),
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    reviewOnly: true,
  });
}

export function createGoldenRefundPolicyFoundryProjection(
  suite: GoldenRefundShadowFixtureSuite = createGoldenRefundShadowFixtureSuite(),
): GoldenRefundPolicyFoundryProjection {
  const counts = decisionCounts(suite.fixtures);
  const gaps = gapCounts(suite.fixtures);
  const gapList = namedGaps(suite);
  const report = createReport(suite, counts, gaps, gapList);
  const candidate = createCandidate(report, gapList);
  const reviewOnlyCandidate = createReviewOnlyCandidate(candidate, suite, gapList);
  const reviewOnlyCandidateDigest = digestFor('golden-refund-review-only-candidate', {
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
    version: GOLDEN_REFUND_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'G04',
    generatedAt: GENERATED_AT,
    sourceFixtureSuiteVersion: suite.version,
    sourceFixtureSuiteDigest: suite.digest,
    sourceFixtureCount: suite.fixtureCount,
    actionSurface: 'refund_service.issue_refund',
    domain: 'money-movement',
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

export function goldenRefundPolicyFoundryProjectionDescriptor():
  GoldenRefundPolicyFoundryProjectionDescriptor {
  return Object.freeze({
    version: GOLDEN_REFUND_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'G04',
    sourceFixtureSuiteVersion: GOLDEN_REFUND_SHADOW_FIXTURES_VERSION,
    policyTwinSummaryVersion: POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION,
    actionSurface: 'refund_service.issue_refund',
    domain: 'money-movement',
    reviewOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    productionReady: false,
  });
}
