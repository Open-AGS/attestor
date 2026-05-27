import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenExternalCommunicationShadowFixtureSuite,
  GOLDEN_EXTERNAL_COMMUNICATION_SHADOW_FIXTURES_VERSION,
  type GoldenExternalCommunicationShadowFixture,
  type GoldenExternalCommunicationShadowFixtureSuite,
} from './golden-external-communication-shadow-fixtures.js';
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

export const GOLDEN_EXTERNAL_COMMUNICATION_POLICY_FOUNDRY_PROJECTION_VERSION =
  'attestor.golden-external-communication-policy-foundry-projection.v1';

export const GOLDEN_EXTERNAL_COMMUNICATION_POLICY_FOUNDRY_NAMED_GAP_KINDS = [
  'outbound-promise-needs-authority',
  'legal-claim-without-authority',
  'recipient-tenant-mismatch',
  'public-claim-overclaim',
  'commercial-email-control-gap',
  'instruction-like-ticket-review',
  'duplicate-send-replay',
] as const;
export type GoldenExternalCommunicationPolicyFoundryNamedGapKind =
  typeof GOLDEN_EXTERNAL_COMMUNICATION_POLICY_FOUNDRY_NAMED_GAP_KINDS[number];

export interface GoldenExternalCommunicationPolicyFoundryNamedGap {
  readonly kind: GoldenExternalCommunicationPolicyFoundryNamedGapKind;
  readonly scenario: GoldenExternalCommunicationShadowFixture['scenario'];
  readonly severity: 'medium' | 'high' | 'blocker';
  readonly protectedPrinciple: string;
  readonly fixtureDigest: string;
  readonly reasonCodes: readonly string[];
  readonly reviewOnly: true;
}

export interface GoldenExternalCommunicationPolicyFoundryReviewOnlyCandidate {
  readonly candidateId: string;
  readonly actionSurface: 'external_communication.customer_message';
  readonly domain: 'external-communication';
  readonly proposedMode: 'review';
  readonly requiredControls: readonly [
    'evidence',
    'authority',
    'customer-approval',
    'policy',
  ];
  readonly sourceFixtureDigests: readonly string[];
  readonly namedGapKinds: readonly GoldenExternalCommunicationPolicyFoundryNamedGapKind[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly reviewOnly: true;
}

export interface GoldenExternalCommunicationPolicyFoundryProjection {
  readonly version: typeof GOLDEN_EXTERNAL_COMMUNICATION_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'E02';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_EXTERNAL_COMMUNICATION_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourceFixtureCount: 8;
  readonly actionSurface: 'external_communication.customer_message';
  readonly domain: 'external-communication';
  readonly report: ShadowPolicySimulationReport;
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly reviewOnlyCandidate: GoldenExternalCommunicationPolicyFoundryReviewOnlyCandidate;
  readonly policyTwinSummary: PolicyFoundryPolicyTwinSummary;
  readonly namedGaps: readonly GoldenExternalCommunicationPolicyFoundryNamedGap[];
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
  readonly rawMessageBodyStored: false;
  readonly rawRecipientIdentifiersStored: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenExternalCommunicationPolicyFoundryProjectionDescriptor {
  readonly version: typeof GOLDEN_EXTERNAL_COMMUNICATION_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'E02';
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_EXTERNAL_COMMUNICATION_SHADOW_FIXTURES_VERSION;
  readonly policyTwinSummaryVersion: typeof POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION;
  readonly actionSurface: 'external_communication.customer_message';
  readonly domain: 'external-communication';
  readonly reviewOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly rawMessageBodyStored: false;
  readonly rawRecipientIdentifiersStored: false;
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-26T10:00:00.000Z';
const GOLDEN_EXTERNAL_COMMUNICATION_REQUIRED_CONTROLS = [
  'evidence',
  'authority',
  'customer-approval',
  'policy',
] as const;
const GOLDEN_EXTERNAL_COMMUNICATION_SOURCE_RECOMMENDATION_KINDS = [
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
  fixtures: readonly GoldenExternalCommunicationShadowFixture[],
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
  fixtures: readonly GoldenExternalCommunicationShadowFixture[],
): ShadowPolicyGapCounts {
  return Object.freeze({
    policy: fixtures.filter((fixture) =>
      fixture.messageFacts.publicClaim ||
      fixture.messageFacts.commercialEmailPosture === 'missing-unsubscribe-or-sender-controls' ||
      fixture.messageFacts.duplicateSendAttempt
    ).length,
    evidence: fixtures.filter((fixture) =>
      fixture.messageFacts.approvalFreshness === 'missing' ||
      fixture.messageFacts.approvalFreshness === 'stale' ||
      fixture.messageFacts.instructionLikeEvidence
    ).length,
    authority: fixtures.filter((fixture) =>
      fixture.messageFacts.tenantScope === 'tenant-mismatch' ||
      fixture.messageFacts.claimClass === 'refund-or-credit-promise' ||
      fixture.messageFacts.claimClass === 'legal-liability-statement' ||
      fixture.messageFacts.commercialEmailPosture === 'missing-unsubscribe-or-sender-controls'
    ).length,
    amountScope: 0,
    recipientScope: 0,
    dataScope: 0,
    adapter: 0,
    customDomain: 0,
  });
}

function namedGaps(
  suite: GoldenExternalCommunicationShadowFixtureSuite,
): readonly GoldenExternalCommunicationPolicyFoundryNamedGap[] {
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));
  const refundPromise = byScenario.get('refund-promise-review');
  const legalClaim = byScenario.get('legal-claim-blocked');
  const wrongRecipient = byScenario.get('wrong-recipient-blocked');
  const publicOverclaim = byScenario.get('public-overclaim-narrowing');
  const commercialGap = byScenario.get('commercial-email-control-gap');
  const adversarialTicket = byScenario.get('prompt-injection-in-ticket');
  const duplicateSend = byScenario.get('duplicate-send-replay-blocked');
  if (
    !refundPromise ||
    !legalClaim ||
    !wrongRecipient ||
    !publicOverclaim ||
    !commercialGap ||
    !adversarialTicket ||
    !duplicateSend
  ) {
    throw new Error(
      'Golden external communication Policy Foundry projection requires the full E01 fixture suite.',
    );
  }
  return Object.freeze([
    Object.freeze({
      kind: 'outbound-promise-needs-authority',
      scenario: refundPromise.scenario,
      severity: 'high',
      protectedPrinciple: 'customer authority',
      fixtureDigest: refundPromise.digest,
      reasonCodes: refundPromise.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'legal-claim-without-authority',
      scenario: legalClaim.scenario,
      severity: 'blocker',
      protectedPrinciple: 'fail-closed boundary',
      fixtureDigest: legalClaim.digest,
      reasonCodes: legalClaim.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'recipient-tenant-mismatch',
      scenario: wrongRecipient.scenario,
      severity: 'blocker',
      protectedPrinciple: 'tenant isolation',
      fixtureDigest: wrongRecipient.digest,
      reasonCodes: wrongRecipient.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'public-claim-overclaim',
      scenario: publicOverclaim.scenario,
      severity: 'high',
      protectedPrinciple: 'no overclaim',
      fixtureDigest: publicOverclaim.digest,
      reasonCodes: publicOverclaim.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'commercial-email-control-gap',
      scenario: commercialGap.scenario,
      severity: 'high',
      protectedPrinciple: 'operational boundedness',
      fixtureDigest: commercialGap.digest,
      reasonCodes: commercialGap.reasonCodes,
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
      kind: 'duplicate-send-replay',
      scenario: duplicateSend.scenario,
      severity: 'blocker',
      protectedPrinciple: 'replay and idempotency safety',
      fixtureDigest: duplicateSend.digest,
      reasonCodes: duplicateSend.reasonCodes,
      reviewOnly: true,
    }),
  ]);
}

function recommendations(
  gaps: readonly GoldenExternalCommunicationPolicyFoundryNamedGap[],
): readonly ShadowPolicyRecommendation[] {
  return Object.freeze([
    Object.freeze({
      kind: 'define-policy',
      severity: 'high',
      title: 'Define outbound message claim policy before communication promotion',
      summary: 'Public overclaim, commercial email, and legal-claim fixtures keep the communication candidate review-only.',
      actionSurface: 'external_communication.customer_message',
      domain: 'external-communication',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'public-claim-overclaim' ||
        gap.kind === 'commercial-email-control-gap' ||
        gap.kind === 'legal-claim-without-authority'
      ).length,
      reasonCodes: Object.freeze([
        'external-communication:public-claim-needs-narrowing',
        'external-communication:commercial-email-control-gap',
        'external-communication:legal-claim-without-authority',
      ]),
      nextMode: 'review',
      confidence: 0.87,
    }),
    Object.freeze({
      kind: 'bind-authority',
      severity: 'blocker',
      title: 'Bind recipient, tenant, and claim authority before sending',
      summary: 'Refund promises, legal statements, recipient mismatches, and commercial-email gaps cannot become enforceable send material.',
      actionSurface: 'external_communication.customer_message',
      domain: 'external-communication',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'outbound-promise-needs-authority' ||
        gap.kind === 'legal-claim-without-authority' ||
        gap.kind === 'recipient-tenant-mismatch' ||
        gap.kind === 'commercial-email-control-gap'
      ).length,
      reasonCodes: Object.freeze([
        'external-communication:refund-promise-needs-authority',
        'external-communication:legal-claim-without-authority',
        'external-communication:recipient-tenant-mismatch',
        'external-communication:commercial-email-control-gap',
      ]),
      nextMode: 'review',
      confidence: 0.9,
    }),
    Object.freeze({
      kind: 'bind-evidence',
      severity: 'high',
      title: 'Treat ticket text as evidence, not outbound authority',
      summary: 'Instruction-like ticket text can escalate review but cannot authorize a customer-facing send.',
      actionSurface: 'external_communication.customer_message',
      domain: 'external-communication',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'instruction-like-ticket-review'
      ).length,
      reasonCodes: Object.freeze([
        'external-communication:ignore-evidence-as-instruction',
        'external-communication:untrusted-ticket-text',
      ]),
      nextMode: 'review',
      confidence: 0.85,
    }),
    Object.freeze({
      kind: 'promote-to-review',
      severity: 'blocker',
      title: 'Keep duplicate sends and provider execution behind review',
      summary: 'Replay-shaped duplicate send attempts remain blocked until idempotency and customer PEP proof exist.',
      actionSurface: 'external_communication.customer_message',
      domain: 'external-communication',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'duplicate-send-replay'
      ).length,
      reasonCodes: Object.freeze([
        'external-communication:duplicate-send-replay',
        'external-communication:block-before-send',
      ]),
      nextMode: 'review',
      confidence: 0.88,
    }),
  ]);
}

function createReport(
  suite: GoldenExternalCommunicationShadowFixtureSuite,
  counts: ShadowPolicyDecisionCounts,
  gaps: ShadowPolicyGapCounts,
  gapList: readonly GoldenExternalCommunicationPolicyFoundryNamedGap[],
): ShadowPolicySimulationReport {
  const eventDigests = Object.freeze(suite.fixtures.map((fixture) => fixture.event.digest));
  const surfaceSimulation = Object.freeze({
    actionSurface: 'external_communication.customer_message',
    domain: 'external-communication',
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
    reportId: `golden-external-communication-policy-twin:${suite.digest}`,
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
  gaps: readonly GoldenExternalCommunicationPolicyFoundryNamedGap[],
): ShadowPolicyDiscoveryCandidate {
  const reasonCodes = Object.freeze(
    [...new Set(gaps.flatMap((gap) => gap.reasonCodes))].sort(),
  );
  return Object.freeze({
    candidateId: `policy-candidate:${digestFor('golden-external-communication-review-only-candidate', {
      reportDigest: report.digest,
      reasonCodes,
    })}`,
    actionSurface: 'external_communication.customer_message',
    domain: 'external-communication',
    action: 'review-mode-rehearsal',
    proposedMode: 'review',
    approvalRequired: true,
    autoEnforce: false,
    requiredControls: GOLDEN_EXTERNAL_COMMUNICATION_REQUIRED_CONTROLS,
    sourceRecommendationKinds: GOLDEN_EXTERNAL_COMMUNICATION_SOURCE_RECOMMENDATION_KINDS,
    highestSeverity: 'blocker',
    affectedEvents: report.eventCount,
    confidence: 0.86,
    reasonCodes,
    summary:
      'External Communication candidate is review-only: bind recipient, tenant, claim, evidence, approval, and replay controls before promotion.',
  });
}

function createReviewOnlyCandidate(
  candidate: ShadowPolicyDiscoveryCandidate,
  suite: GoldenExternalCommunicationShadowFixtureSuite,
  gaps: readonly GoldenExternalCommunicationPolicyFoundryNamedGap[],
): GoldenExternalCommunicationPolicyFoundryReviewOnlyCandidate {
  return Object.freeze({
    candidateId: candidate.candidateId,
    actionSurface: 'external_communication.customer_message',
    domain: 'external-communication',
    proposedMode: 'review',
    requiredControls: GOLDEN_EXTERNAL_COMMUNICATION_REQUIRED_CONTROLS,
    sourceFixtureDigests: Object.freeze(suite.fixtures.map((fixture) => fixture.digest)),
    namedGapKinds: Object.freeze(gaps.map((gap) => gap.kind)),
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    reviewOnly: true,
  });
}

export function createGoldenExternalCommunicationPolicyFoundryProjection(
  suite: GoldenExternalCommunicationShadowFixtureSuite = createGoldenExternalCommunicationShadowFixtureSuite(),
): GoldenExternalCommunicationPolicyFoundryProjection {
  const counts = decisionCounts(suite.fixtures);
  const gaps = gapCounts(suite.fixtures);
  const gapList = namedGaps(suite);
  const report = createReport(suite, counts, gaps, gapList);
  const candidate = createCandidate(report, gapList);
  const reviewOnlyCandidate = createReviewOnlyCandidate(candidate, suite, gapList);
  const reviewOnlyCandidateDigest = digestFor('golden-external-communication-review-only-candidate', {
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
    version: GOLDEN_EXTERNAL_COMMUNICATION_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'E02',
    generatedAt: GENERATED_AT,
    sourceFixtureSuiteVersion: suite.version,
    sourceFixtureSuiteDigest: suite.digest,
    sourceFixtureCount: suite.fixtureCount,
    actionSurface: 'external_communication.customer_message',
    domain: 'external-communication',
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
    rawMessageBodyStored: false,
    rawRecipientIdentifiersStored: false,
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

export function goldenExternalCommunicationPolicyFoundryProjectionDescriptor():
  GoldenExternalCommunicationPolicyFoundryProjectionDescriptor {
  return Object.freeze({
    version: GOLDEN_EXTERNAL_COMMUNICATION_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'E02',
    sourceFixtureSuiteVersion: GOLDEN_EXTERNAL_COMMUNICATION_SHADOW_FIXTURES_VERSION,
    policyTwinSummaryVersion: POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION,
    actionSurface: 'external_communication.customer_message',
    domain: 'external-communication',
    reviewOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    rawMessageBodyStored: false,
    rawRecipientIdentifiersStored: false,
    productionReady: false,
  });
}
