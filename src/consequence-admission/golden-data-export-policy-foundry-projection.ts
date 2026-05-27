import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenDataExportShadowFixtureSuite,
  GOLDEN_DATA_EXPORT_SHADOW_FIXTURES_VERSION,
  type GoldenDataExportShadowFixture,
  type GoldenDataExportShadowFixtureSuite,
} from './golden-data-export-shadow-fixtures.js';
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

export const GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_PROJECTION_VERSION =
  'attestor.golden-data-export-policy-foundry-projection.v1';

export const GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_NAMED_GAP_KINDS = [
  'overbroad-personal-data',
  'external-recipient-unapproved',
  'tenant-scope-mismatch',
  'stale-approval',
  'instruction-like-evidence-review',
  'write-side-effect',
  'purpose-binding-missing',
] as const;
export type GoldenDataExportPolicyFoundryNamedGapKind =
  typeof GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_NAMED_GAP_KINDS[number];

export interface GoldenDataExportPolicyFoundryNamedGap {
  readonly kind: GoldenDataExportPolicyFoundryNamedGapKind;
  readonly scenario: GoldenDataExportShadowFixture['scenario'];
  readonly severity: 'medium' | 'high' | 'blocker';
  readonly protectedPrinciple: string;
  readonly fixtureDigest: string;
  readonly reasonCodes: readonly string[];
  readonly reviewOnly: true;
}

export interface GoldenDataExportPolicyFoundryReviewOnlyCandidate {
  readonly candidateId: string;
  readonly actionSurface: 'data_movement.controlled_export';
  readonly domain: 'data-movement';
  readonly proposedMode: 'review';
  readonly requiredControls: readonly [
    'evidence',
    'authority',
    'customer-approval',
  ];
  readonly sourceFixtureDigests: readonly string[];
  readonly namedGapKinds: readonly GoldenDataExportPolicyFoundryNamedGapKind[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly reviewOnly: true;
}

export interface GoldenDataExportPolicyFoundryProjection {
  readonly version: typeof GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'D02';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_DATA_EXPORT_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourceFixtureCount: 8;
  readonly actionSurface: 'data_movement.controlled_export';
  readonly domain: 'data-movement';
  readonly report: ShadowPolicySimulationReport;
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly reviewOnlyCandidate: GoldenDataExportPolicyFoundryReviewOnlyCandidate;
  readonly policyTwinSummary: PolicyFoundryPolicyTwinSummary;
  readonly namedGaps: readonly GoldenDataExportPolicyFoundryNamedGap[];
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

export interface GoldenDataExportPolicyFoundryProjectionDescriptor {
  readonly version: typeof GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'D02';
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_DATA_EXPORT_SHADOW_FIXTURES_VERSION;
  readonly policyTwinSummaryVersion: typeof POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION;
  readonly actionSurface: 'data_movement.controlled_export';
  readonly domain: 'data-movement';
  readonly reviewOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-25T10:00:00.000Z';
const GOLDEN_DATA_EXPORT_REQUIRED_CONTROLS = [
  'evidence',
  'authority',
  'customer-approval',
] as const;
const GOLDEN_DATA_EXPORT_SOURCE_RECOMMENDATION_KINDS = [
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
  fixtures: readonly GoldenDataExportShadowFixture[],
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
  fixtures: readonly GoldenDataExportShadowFixture[],
): ShadowPolicyGapCounts {
  return Object.freeze({
    policy: fixtures.filter((fixture) =>
      fixture.dataFacts.requestedFieldsClass === 'overbroad-personal-data' ||
      fixture.dataFacts.writeSideEffect ||
      !fixture.dataFacts.purposeBound
    ).length,
    evidence: fixtures.filter((fixture) =>
      fixture.dataFacts.approvalFreshness === 'missing' ||
      fixture.dataFacts.approvalFreshness === 'stale' ||
      fixture.dataFacts.instructionLikeEvidence
    ).length,
    authority: fixtures.filter((fixture) =>
      fixture.dataFacts.recipientClass === 'unapproved-external-recipient' ||
      fixture.dataFacts.recipientClass === 'cross-tenant-principal' ||
      fixture.dataFacts.approvalFreshness === 'missing' ||
      fixture.dataFacts.approvalFreshness === 'stale'
    ).length,
    amountScope: 0,
    recipientScope: 0,
    dataScope: 0,
    adapter: 0,
    customDomain: 0,
  });
}

function namedGaps(
  suite: GoldenDataExportShadowFixtureSuite,
): readonly GoldenDataExportPolicyFoundryNamedGap[] {
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));
  const overbroad = byScenario.get('pii-column-narrowing');
  const externalRecipient = byScenario.get('external-recipient-review');
  const tenantMismatch = byScenario.get('tenant-scope-mismatch');
  const staleApproval = byScenario.get('stale-approval');
  const adversarial = byScenario.get('prompt-injection-in-evidence');
  const writeQuery = byScenario.get('write-query-blocked');
  if (
    !overbroad ||
    !externalRecipient ||
    !tenantMismatch ||
    !staleApproval ||
    !adversarial ||
    !writeQuery
  ) {
    throw new Error(
      'Golden data export Policy Foundry projection requires the full D01 fixture suite.',
    );
  }
  return Object.freeze([
    Object.freeze({
      kind: 'overbroad-personal-data',
      scenario: overbroad.scenario,
      severity: 'high',
      protectedPrinciple: 'data minimization and redaction',
      fixtureDigest: overbroad.digest,
      reasonCodes: overbroad.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'external-recipient-unapproved',
      scenario: externalRecipient.scenario,
      severity: 'high',
      protectedPrinciple: 'customer authority',
      fixtureDigest: externalRecipient.digest,
      reasonCodes: externalRecipient.reasonCodes,
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
      kind: 'instruction-like-evidence-review',
      scenario: adversarial.scenario,
      severity: 'high',
      protectedPrinciple: 'proof integrity',
      fixtureDigest: adversarial.digest,
      reasonCodes: adversarial.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'write-side-effect',
      scenario: writeQuery.scenario,
      severity: 'blocker',
      protectedPrinciple: 'fail-closed boundary',
      fixtureDigest: writeQuery.digest,
      reasonCodes: writeQuery.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'purpose-binding-missing',
      scenario: writeQuery.scenario,
      severity: 'high',
      protectedPrinciple: 'auditability',
      fixtureDigest: writeQuery.digest,
      reasonCodes: writeQuery.reasonCodes,
      reviewOnly: true,
    }),
  ]);
}

function recommendations(
  gaps: readonly GoldenDataExportPolicyFoundryNamedGap[],
): readonly ShadowPolicyRecommendation[] {
  return Object.freeze([
    Object.freeze({
      kind: 'define-policy',
      severity: 'high',
      title: 'Define field minimization before data export promotion',
      summary: 'Overbroad personal-data fields keep controlled export candidates review-only.',
      actionSurface: 'data_movement.controlled_export',
      domain: 'data-movement',
      affectedEvents: gaps.filter((gap) => gap.kind === 'overbroad-personal-data').length,
      reasonCodes: Object.freeze([
        'data-export:overbroad-personal-data',
        'data-export:narrow-to-approved-fields',
      ]),
      nextMode: 'review',
      confidence: 0.88,
    }),
    Object.freeze({
      kind: 'bind-authority',
      severity: 'blocker',
      title: 'Bind recipient and tenant authority before export promotion',
      summary: 'External-recipient and cross-tenant gaps cannot become enforceable policy material.',
      actionSurface: 'data_movement.controlled_export',
      domain: 'data-movement',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'external-recipient-unapproved' ||
        gap.kind === 'tenant-scope-mismatch'
      ).length,
      reasonCodes: Object.freeze([
        'data-export:external-recipient-unapproved',
        'data-export:tenant-scope-mismatch',
      ]),
      nextMode: 'review',
      confidence: 0.9,
    }),
    Object.freeze({
      kind: 'bind-evidence',
      severity: 'blocker',
      title: 'Bind fresh export approval and purpose evidence',
      summary: 'Missing, stale, or purpose-unbound evidence keeps the export candidate review-only.',
      actionSurface: 'data_movement.controlled_export',
      domain: 'data-movement',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'stale-approval' ||
        gap.kind === 'purpose-binding-missing'
      ).length,
      reasonCodes: Object.freeze([
        'data-export:approval-stale',
        'data-export:block-stale-approval',
        'data-export:write-side-effect',
        'data-export:block-write-query',
      ]),
      nextMode: 'review',
      confidence: 0.88,
    }),
    Object.freeze({
      kind: 'promote-to-review',
      severity: 'high',
      title: 'Treat instruction-like evidence as evidence, not authority',
      summary: 'Prompt-injection-shaped evidence can escalate review but cannot grant authority.',
      actionSurface: 'data_movement.controlled_export',
      domain: 'data-movement',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'instruction-like-evidence-review'
      ).length,
      reasonCodes: Object.freeze([
        'data-export:instruction-like-evidence-text',
        'data-export:ignore-evidence-as-instruction',
      ]),
      nextMode: 'review',
      confidence: 0.84,
    }),
    Object.freeze({
      kind: 'define-policy',
      severity: 'blocker',
      title: 'Block write-side-effect queries from export promotion',
      summary: 'Write-query fixtures are not data export policy candidates and stay blocked.',
      actionSurface: 'data_movement.controlled_export',
      domain: 'data-movement',
      affectedEvents: gaps.filter((gap) => gap.kind === 'write-side-effect').length,
      reasonCodes: Object.freeze([
        'data-export:write-side-effect',
        'data-export:block-write-query',
      ]),
      nextMode: 'review',
      confidence: 0.92,
    }),
  ]);
}

function createReport(
  suite: GoldenDataExportShadowFixtureSuite,
  counts: ShadowPolicyDecisionCounts,
  gaps: ShadowPolicyGapCounts,
  gapList: readonly GoldenDataExportPolicyFoundryNamedGap[],
): ShadowPolicySimulationReport {
  const eventDigests = Object.freeze(suite.fixtures.map((fixture) => fixture.event.digest));
  const surfaceSimulation = Object.freeze({
    actionSurface: 'data_movement.controlled_export',
    domain: 'data-movement',
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
    reportId: `golden-data-export-policy-twin:${suite.digest}`,
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
  gaps: readonly GoldenDataExportPolicyFoundryNamedGap[],
): ShadowPolicyDiscoveryCandidate {
  const reasonCodes = Object.freeze(
    [...new Set(gaps.flatMap((gap) => gap.reasonCodes))].sort(),
  );
  return Object.freeze({
    candidateId: `policy-candidate:${digestFor('golden-data-export-review-only-candidate', {
      reportDigest: report.digest,
      reasonCodes,
    })}`,
    actionSurface: 'data_movement.controlled_export',
    domain: 'data-movement',
    action: 'review-mode-rehearsal',
    proposedMode: 'review',
    approvalRequired: true,
    autoEnforce: false,
    requiredControls: GOLDEN_DATA_EXPORT_REQUIRED_CONTROLS,
    sourceRecommendationKinds: GOLDEN_DATA_EXPORT_SOURCE_RECOMMENDATION_KINDS,
    highestSeverity: 'blocker',
    affectedEvents: report.eventCount,
    confidence: 0.86,
    reasonCodes,
    summary:
      'Controlled data export candidate is review-only: bind recipient, field, tenant, approval, and purpose evidence before promotion.',
  });
}

function createReviewOnlyCandidate(
  candidate: ShadowPolicyDiscoveryCandidate,
  suite: GoldenDataExportShadowFixtureSuite,
  gaps: readonly GoldenDataExportPolicyFoundryNamedGap[],
): GoldenDataExportPolicyFoundryReviewOnlyCandidate {
  return Object.freeze({
    candidateId: candidate.candidateId,
    actionSurface: 'data_movement.controlled_export',
    domain: 'data-movement',
    proposedMode: 'review',
    requiredControls: GOLDEN_DATA_EXPORT_REQUIRED_CONTROLS,
    sourceFixtureDigests: Object.freeze(suite.fixtures.map((fixture) => fixture.digest)),
    namedGapKinds: Object.freeze(gaps.map((gap) => gap.kind)),
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    reviewOnly: true,
  });
}

export function createGoldenDataExportPolicyFoundryProjection(
  suite: GoldenDataExportShadowFixtureSuite = createGoldenDataExportShadowFixtureSuite(),
): GoldenDataExportPolicyFoundryProjection {
  const counts = decisionCounts(suite.fixtures);
  const gaps = gapCounts(suite.fixtures);
  const gapList = namedGaps(suite);
  const report = createReport(suite, counts, gaps, gapList);
  const candidate = createCandidate(report, gapList);
  const reviewOnlyCandidate = createReviewOnlyCandidate(candidate, suite, gapList);
  const reviewOnlyCandidateDigest = digestFor('golden-data-export-review-only-candidate', {
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
    version: GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'D02',
    generatedAt: GENERATED_AT,
    sourceFixtureSuiteVersion: suite.version,
    sourceFixtureSuiteDigest: suite.digest,
    sourceFixtureCount: suite.fixtureCount,
    actionSurface: 'data_movement.controlled_export',
    domain: 'data-movement',
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

export function goldenDataExportPolicyFoundryProjectionDescriptor():
  GoldenDataExportPolicyFoundryProjectionDescriptor {
  return Object.freeze({
    version: GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'D02',
    sourceFixtureSuiteVersion: GOLDEN_DATA_EXPORT_SHADOW_FIXTURES_VERSION,
    policyTwinSummaryVersion: POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION,
    actionSurface: 'data_movement.controlled_export',
    domain: 'data-movement',
    reviewOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    productionReady: false,
  });
}
