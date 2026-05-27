import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenAuthorityChangeShadowFixtureSuite,
  GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION,
  type GoldenAuthorityChangeShadowFixture,
  type GoldenAuthorityChangeShadowFixtureSuite,
} from './golden-authority-change-shadow-fixtures.js';
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

export const GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_PROJECTION_VERSION =
  'attestor.golden-authority-change-policy-foundry-projection.v1';

export const GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_NAMED_GAP_KINDS = [
  'overbroad-privilege',
  'break-glass-approval-missing',
  'external-delegation-unapproved',
  'tenant-scope-mismatch',
  'stale-approval',
  'instruction-like-ticket-review',
  'separation-of-duties-conflict',
] as const;
export type GoldenAuthorityChangePolicyFoundryNamedGapKind =
  typeof GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_NAMED_GAP_KINDS[number];

export interface GoldenAuthorityChangePolicyFoundryNamedGap {
  readonly kind: GoldenAuthorityChangePolicyFoundryNamedGapKind;
  readonly scenario: GoldenAuthorityChangeShadowFixture['scenario'];
  readonly severity: 'medium' | 'high' | 'blocker';
  readonly protectedPrinciple: string;
  readonly fixtureDigest: string;
  readonly reasonCodes: readonly string[];
  readonly reviewOnly: true;
}

export interface GoldenAuthorityChangePolicyFoundryReviewOnlyCandidate {
  readonly candidateId: string;
  readonly actionSurface: 'authority_change.identity_workflow';
  readonly domain: 'authority-change';
  readonly proposedMode: 'review';
  readonly requiredControls: readonly [
    'evidence',
    'authority',
    'customer-approval',
    'policy',
  ];
  readonly sourceFixtureDigests: readonly string[];
  readonly namedGapKinds: readonly GoldenAuthorityChangePolicyFoundryNamedGapKind[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly reviewOnly: true;
}

export interface GoldenAuthorityChangePolicyFoundryProjection {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'A02';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourceFixtureCount: 8;
  readonly actionSurface: 'authority_change.identity_workflow';
  readonly domain: 'authority-change';
  readonly report: ShadowPolicySimulationReport;
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly reviewOnlyCandidate: GoldenAuthorityChangePolicyFoundryReviewOnlyCandidate;
  readonly policyTwinSummary: PolicyFoundryPolicyTwinSummary;
  readonly namedGaps: readonly GoldenAuthorityChangePolicyFoundryNamedGap[];
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
  readonly rawIdentityAttributesStored: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenAuthorityChangePolicyFoundryProjectionDescriptor {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'A02';
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION;
  readonly policyTwinSummaryVersion: typeof POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION;
  readonly actionSurface: 'authority_change.identity_workflow';
  readonly domain: 'authority-change';
  readonly reviewOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly rawIdentityAttributesStored: false;
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-25T11:00:00.000Z';
const GOLDEN_AUTHORITY_CHANGE_REQUIRED_CONTROLS = [
  'evidence',
  'authority',
  'customer-approval',
  'policy',
] as const;
const GOLDEN_AUTHORITY_CHANGE_SOURCE_RECOMMENDATION_KINDS = [
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
  fixtures: readonly GoldenAuthorityChangeShadowFixture[],
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
  fixtures: readonly GoldenAuthorityChangeShadowFixture[],
): ShadowPolicyGapCounts {
  return Object.freeze({
    policy: fixtures.filter((fixture) =>
      fixture.authorityFacts.leastPrivilege !== 'satisfied' ||
      fixture.authorityFacts.breakGlass
    ).length,
    evidence: fixtures.filter((fixture) =>
      fixture.authorityFacts.approvalFreshness === 'missing' ||
      fixture.authorityFacts.approvalFreshness === 'stale' ||
      fixture.authorityFacts.instructionLikeEvidence
    ).length,
    authority: fixtures.filter((fixture) =>
      fixture.authorityFacts.tenantScope === 'tenant-mismatch' ||
      fixture.authorityFacts.separationOfDuties === 'conflict' ||
      fixture.authorityFacts.approvalFreshness === 'missing' ||
      fixture.authorityFacts.approvalFreshness === 'stale'
    ).length,
    amountScope: 0,
    recipientScope: 0,
    dataScope: 0,
    adapter: 0,
    customDomain: 0,
  });
}

function namedGaps(
  suite: GoldenAuthorityChangeShadowFixtureSuite,
): readonly GoldenAuthorityChangePolicyFoundryNamedGap[] {
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));
  const privilegedRole = byScenario.get('privileged-role-narrowing');
  const breakGlass = byScenario.get('break-glass-unapproved');
  const externalDelegation = byScenario.get('external-delegation-review');
  const tenantMismatch = byScenario.get('tenant-scope-mismatch');
  const staleApproval = byScenario.get('stale-approval');
  const adversarialTicket = byScenario.get('prompt-injection-in-ticket');
  if (
    !privilegedRole ||
    !breakGlass ||
    !externalDelegation ||
    !tenantMismatch ||
    !staleApproval ||
    !adversarialTicket
  ) {
    throw new Error(
      'Golden authority change Policy Foundry projection requires the full A01 fixture suite.',
    );
  }
  return Object.freeze([
    Object.freeze({
      kind: 'overbroad-privilege',
      scenario: privilegedRole.scenario,
      severity: 'high',
      protectedPrinciple: 'customer authority',
      fixtureDigest: privilegedRole.digest,
      reasonCodes: privilegedRole.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'break-glass-approval-missing',
      scenario: breakGlass.scenario,
      severity: 'blocker',
      protectedPrinciple: 'fail-closed boundary',
      fixtureDigest: breakGlass.digest,
      reasonCodes: breakGlass.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'external-delegation-unapproved',
      scenario: externalDelegation.scenario,
      severity: 'high',
      protectedPrinciple: 'customer authority',
      fixtureDigest: externalDelegation.digest,
      reasonCodes: externalDelegation.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'tenant-scope-mismatch',
      scenario: tenantMismatch.scenario,
      severity: 'blocker',
      protectedPrinciple: 'tenant isolation',
      fixtureDigest: tenantMismatch.digest,
      reasonCodes: tenantMismatch.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'stale-approval',
      scenario: staleApproval.scenario,
      severity: 'blocker',
      protectedPrinciple: 'customer authority',
      fixtureDigest: staleApproval.digest,
      reasonCodes: staleApproval.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'instruction-like-ticket-review',
      scenario: adversarialTicket.scenario,
      severity: 'high',
      protectedPrinciple: 'proof integrity',
      fixtureDigest: adversarialTicket.digest,
      reasonCodes: adversarialTicket.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'separation-of-duties-conflict',
      scenario: staleApproval.scenario,
      severity: 'blocker',
      protectedPrinciple: 'customer authority',
      fixtureDigest: staleApproval.digest,
      reasonCodes: staleApproval.reasonCodes,
      reviewOnly: true,
    }),
  ]);
}

function recommendations(
  gaps: readonly GoldenAuthorityChangePolicyFoundryNamedGap[],
): readonly ShadowPolicyRecommendation[] {
  return Object.freeze([
    Object.freeze({
      kind: 'define-policy',
      severity: 'high',
      title: 'Define least-privilege bounds before authority-change promotion',
      summary: 'Overbroad privileged-role fixtures keep authority-change candidates review-only.',
      actionSurface: 'authority_change.identity_workflow',
      domain: 'authority-change',
      affectedEvents: gaps.filter((gap) => gap.kind === 'overbroad-privilege').length,
      reasonCodes: Object.freeze([
        'authority-change:privileged-role-overbroad',
        'authority-change:narrow-to-time-bound-role',
      ]),
      nextMode: 'review',
      confidence: 0.88,
    }),
    Object.freeze({
      kind: 'bind-authority',
      severity: 'blocker',
      title: 'Bind tenant and approval authority before identity workflow promotion',
      summary: 'Tenant-mismatch, stale-approval, and unapproved break-glass fixtures cannot become enforceable policy material.',
      actionSurface: 'authority_change.identity_workflow',
      domain: 'authority-change',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'tenant-scope-mismatch' ||
        gap.kind === 'stale-approval' ||
        gap.kind === 'break-glass-approval-missing'
      ).length,
      reasonCodes: Object.freeze([
        'authority-change:tenant-scope-mismatch',
        'authority-change:approval-stale',
        'authority-change:break-glass-approval-missing',
      ]),
      nextMode: 'review',
      confidence: 0.9,
    }),
    Object.freeze({
      kind: 'bind-evidence',
      severity: 'high',
      title: 'Bind fresh authority evidence and separation-of-duties checks',
      summary: 'Missing, stale, or conflict-shaped evidence keeps the authority candidate review-only.',
      actionSurface: 'authority_change.identity_workflow',
      domain: 'authority-change',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'stale-approval' ||
        gap.kind === 'separation-of-duties-conflict'
      ).length,
      reasonCodes: Object.freeze([
        'authority-change:approval-stale',
        'authority-change:block-stale-entitlement-change',
      ]),
      nextMode: 'review',
      confidence: 0.87,
    }),
    Object.freeze({
      kind: 'promote-to-review',
      severity: 'high',
      title: 'Treat instruction-like ticket text as evidence, not authority',
      summary: 'Prompt-injection-shaped ticket evidence can escalate review but cannot grant authority.',
      actionSurface: 'authority_change.identity_workflow',
      domain: 'authority-change',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'instruction-like-ticket-review'
      ).length,
      reasonCodes: Object.freeze([
        'authority-change:instruction-like-ticket-text',
        'authority-change:ignore-evidence-as-instruction',
      ]),
      nextMode: 'review',
      confidence: 0.84,
    }),
  ]);
}

function createReport(
  suite: GoldenAuthorityChangeShadowFixtureSuite,
  counts: ShadowPolicyDecisionCounts,
  gaps: ShadowPolicyGapCounts,
  gapList: readonly GoldenAuthorityChangePolicyFoundryNamedGap[],
): ShadowPolicySimulationReport {
  const eventDigests = Object.freeze(suite.fixtures.map((fixture) => fixture.event.digest));
  const surfaceSimulation = Object.freeze({
    actionSurface: 'authority_change.identity_workflow',
    domain: 'authority-change',
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
    reportId: `golden-authority-change-policy-twin:${suite.digest}`,
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
  gaps: readonly GoldenAuthorityChangePolicyFoundryNamedGap[],
): ShadowPolicyDiscoveryCandidate {
  const reasonCodes = Object.freeze(
    [...new Set(gaps.flatMap((gap) => gap.reasonCodes))].sort(),
  );
  return Object.freeze({
    candidateId: `policy-candidate:${digestFor('golden-authority-change-review-only-candidate', {
      reportDigest: report.digest,
      reasonCodes,
    })}`,
    actionSurface: 'authority_change.identity_workflow',
    domain: 'authority-change',
    action: 'review-mode-rehearsal',
    proposedMode: 'review',
    approvalRequired: true,
    autoEnforce: false,
    requiredControls: GOLDEN_AUTHORITY_CHANGE_REQUIRED_CONTROLS,
    sourceRecommendationKinds: GOLDEN_AUTHORITY_CHANGE_SOURCE_RECOMMENDATION_KINDS,
    highestSeverity: 'blocker',
    affectedEvents: report.eventCount,
    confidence: 0.86,
    reasonCodes,
    summary:
      'Authority Change candidate is review-only: bind subject, resource, permission, approval, tenant, and least-privilege evidence before promotion.',
  });
}

function createReviewOnlyCandidate(
  candidate: ShadowPolicyDiscoveryCandidate,
  suite: GoldenAuthorityChangeShadowFixtureSuite,
  gaps: readonly GoldenAuthorityChangePolicyFoundryNamedGap[],
): GoldenAuthorityChangePolicyFoundryReviewOnlyCandidate {
  return Object.freeze({
    candidateId: candidate.candidateId,
    actionSurface: 'authority_change.identity_workflow',
    domain: 'authority-change',
    proposedMode: 'review',
    requiredControls: GOLDEN_AUTHORITY_CHANGE_REQUIRED_CONTROLS,
    sourceFixtureDigests: Object.freeze(suite.fixtures.map((fixture) => fixture.digest)),
    namedGapKinds: Object.freeze(gaps.map((gap) => gap.kind)),
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    reviewOnly: true,
  });
}

export function createGoldenAuthorityChangePolicyFoundryProjection(
  suite: GoldenAuthorityChangeShadowFixtureSuite = createGoldenAuthorityChangeShadowFixtureSuite(),
): GoldenAuthorityChangePolicyFoundryProjection {
  const counts = decisionCounts(suite.fixtures);
  const gaps = gapCounts(suite.fixtures);
  const gapList = namedGaps(suite);
  const report = createReport(suite, counts, gaps, gapList);
  const candidate = createCandidate(report, gapList);
  const reviewOnlyCandidate = createReviewOnlyCandidate(candidate, suite, gapList);
  const reviewOnlyCandidateDigest = digestFor('golden-authority-change-review-only-candidate', {
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
    version: GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'A02',
    generatedAt: GENERATED_AT,
    sourceFixtureSuiteVersion: suite.version,
    sourceFixtureSuiteDigest: suite.digest,
    sourceFixtureCount: suite.fixtureCount,
    actionSurface: 'authority_change.identity_workflow',
    domain: 'authority-change',
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
    rawIdentityAttributesStored: false,
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

export function goldenAuthorityChangePolicyFoundryProjectionDescriptor():
  GoldenAuthorityChangePolicyFoundryProjectionDescriptor {
  return Object.freeze({
    version: GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'A02',
    sourceFixtureSuiteVersion: GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION,
    policyTwinSummaryVersion: POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION,
    actionSurface: 'authority_change.identity_workflow',
    domain: 'authority-change',
    reviewOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    rawIdentityAttributesStored: false,
    productionReady: false,
  });
}
