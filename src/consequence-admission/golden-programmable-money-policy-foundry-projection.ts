import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenProgrammableMoneyShadowFixtureSuite,
  GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION,
  type GoldenProgrammableMoneyShadowFixture,
  type GoldenProgrammableMoneyShadowFixtureSuite,
} from './golden-programmable-money-shadow-fixtures.js';
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

export const GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_PROJECTION_VERSION =
  'attestor.golden-programmable-money-policy-foundry-projection.v1';

export const GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_NAMED_GAP_KINDS = [
  'allowance-scope-overbroad',
  'account-abstraction-preflight-missing',
  'delegated-eoa-authority-stale',
  'x402-settlement-proof-missing',
  'custody-quorum-pending',
  'intent-route-slippage-review',
  'wallet-memo-instruction-review',
] as const;
export type GoldenProgrammableMoneyPolicyFoundryNamedGapKind =
  typeof GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_NAMED_GAP_KINDS[number];

export interface GoldenProgrammableMoneyPolicyFoundryNamedGap {
  readonly kind: GoldenProgrammableMoneyPolicyFoundryNamedGapKind;
  readonly scenario: GoldenProgrammableMoneyShadowFixture['scenario'];
  readonly severity: 'medium' | 'high' | 'blocker';
  readonly protectedPrinciple: string;
  readonly fixtureDigest: string;
  readonly reasonCodes: readonly string[];
  readonly reviewOnly: true;
}

export interface GoldenProgrammableMoneyPolicyFoundryReviewOnlyCandidate {
  readonly candidateId: string;
  readonly actionSurface: 'programmable_money.transaction_intent';
  readonly domain: 'programmable-money';
  readonly proposedMode: 'review';
  readonly requiredControls: readonly [
    'evidence',
    'authority',
    'adapter',
    'customer-approval',
    'policy',
    'block-investigation',
  ];
  readonly sourceFixtureDigests: readonly string[];
  readonly namedGapKinds: readonly GoldenProgrammableMoneyPolicyFoundryNamedGapKind[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly reviewOnly: true;
}

export interface GoldenProgrammableMoneyPolicyFoundryProjection {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'P02';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourceFixtureCount: 8;
  readonly actionSurface: 'programmable_money.transaction_intent';
  readonly domain: 'programmable-money';
  readonly report: ShadowPolicySimulationReport;
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly reviewOnlyCandidate: GoldenProgrammableMoneyPolicyFoundryReviewOnlyCandidate;
  readonly policyTwinSummary: PolicyFoundryPolicyTwinSummary;
  readonly namedGaps: readonly GoldenProgrammableMoneyPolicyFoundryNamedGap[];
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
  readonly rawTransactionPayloadStored: false;
  readonly rawWalletMaterialStored: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenProgrammableMoneyPolicyFoundryProjectionDescriptor {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly step: 'P02';
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION;
  readonly policyTwinSummaryVersion: typeof POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION;
  readonly actionSurface: 'programmable_money.transaction_intent';
  readonly domain: 'programmable-money';
  readonly reviewOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly rawTransactionPayloadStored: false;
  readonly rawWalletMaterialStored: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-26T14:45:00.000Z';
const GOLDEN_PROGRAMMABLE_MONEY_REQUIRED_CONTROLS = [
  'evidence',
  'authority',
  'adapter',
  'customer-approval',
  'policy',
  'block-investigation',
] as const;
const GOLDEN_PROGRAMMABLE_MONEY_SOURCE_RECOMMENDATION_KINDS = [
  'define-policy',
  'bind-authority',
  'bind-evidence',
  'prepare-adapter',
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
  fixtures: readonly GoldenProgrammableMoneyShadowFixture[],
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
  fixtures: readonly GoldenProgrammableMoneyShadowFixture[],
): ShadowPolicyGapCounts {
  return Object.freeze({
    policy: fixtures.filter((fixture) =>
      fixture.operationFacts.policyScopeStatus === 'overbroad' ||
      fixture.operationFacts.policyScopeStatus === 'missing'
    ).length,
    evidence: fixtures.filter((fixture) =>
      fixture.operationFacts.adapterPreflightStatus !== 'passed' ||
      fixture.operationFacts.settlementOrReceiptStatus === 'missing' ||
      fixture.operationFacts.settlementOrReceiptStatus === 'pending' ||
      fixture.operationFacts.instructionLikeEvidence
    ).length,
    authority: fixtures.filter((fixture) =>
      fixture.operationFacts.approvalPosture !== 'fresh' ||
      fixture.operationFacts.consequenceKind === 'approval' ||
      fixture.operationFacts.instructionLikeEvidence
    ).length,
    amountScope: 0,
    recipientScope: 0,
    dataScope: 0,
    adapter: fixtures.filter((fixture) =>
      fixture.operationFacts.adapterPreflightStatus !== 'passed' ||
      fixture.operationFacts.settlementOrReceiptStatus === 'missing' ||
      fixture.operationFacts.settlementOrReceiptStatus === 'pending'
    ).length,
    customDomain: 0,
  });
}

function namedGaps(
  suite: GoldenProgrammableMoneyShadowFixtureSuite,
): readonly GoldenProgrammableMoneyPolicyFoundryNamedGap[] {
  const byScenario = new Map(suite.fixtures.map((fixture) => [fixture.scenario, fixture]));
  const allowance = byScenario.get('unlimited-approval-review');
  const userOperation = byScenario.get('erc4337-user-operation-paymaster-missing');
  const staleDelegation = byScenario.get('delegated-eoa-stale-authorization');
  const x402Payment = byScenario.get('x402-agent-payment-settlement-missing');
  const custodyQuorum = byScenario.get('custody-withdrawal-quorum-pending');
  const intentRoute = byScenario.get('intent-solver-deadline-slippage-review');
  const walletMemo = byScenario.get('prompt-injection-in-wallet-memo');
  if (
    !allowance ||
    !userOperation ||
    !staleDelegation ||
    !x402Payment ||
    !custodyQuorum ||
    !intentRoute ||
    !walletMemo
  ) {
    throw new Error(
      'Golden programmable money Policy Foundry projection requires the full P01 fixture suite.',
    );
  }
  return Object.freeze([
    Object.freeze({
      kind: 'allowance-scope-overbroad',
      scenario: allowance.scenario,
      severity: 'high',
      protectedPrinciple: 'customer authority',
      fixtureDigest: allowance.digest,
      reasonCodes: allowance.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'account-abstraction-preflight-missing',
      scenario: userOperation.scenario,
      severity: 'blocker',
      protectedPrinciple: 'fail-closed boundary',
      fixtureDigest: userOperation.digest,
      reasonCodes: userOperation.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'delegated-eoa-authority-stale',
      scenario: staleDelegation.scenario,
      severity: 'blocker',
      protectedPrinciple: 'replay and idempotency safety',
      fixtureDigest: staleDelegation.digest,
      reasonCodes: staleDelegation.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'x402-settlement-proof-missing',
      scenario: x402Payment.scenario,
      severity: 'blocker',
      protectedPrinciple: 'proof integrity',
      fixtureDigest: x402Payment.digest,
      reasonCodes: x402Payment.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'custody-quorum-pending',
      scenario: custodyQuorum.scenario,
      severity: 'high',
      protectedPrinciple: 'customer authority',
      fixtureDigest: custodyQuorum.digest,
      reasonCodes: custodyQuorum.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'intent-route-slippage-review',
      scenario: intentRoute.scenario,
      severity: 'high',
      protectedPrinciple: 'operational boundedness',
      fixtureDigest: intentRoute.digest,
      reasonCodes: intentRoute.reasonCodes,
      reviewOnly: true,
    }),
    Object.freeze({
      kind: 'wallet-memo-instruction-review',
      scenario: walletMemo.scenario,
      severity: 'blocker',
      protectedPrinciple: 'proof integrity',
      fixtureDigest: walletMemo.digest,
      reasonCodes: walletMemo.reasonCodes,
      reviewOnly: true,
    }),
  ]);
}

function recommendations(
  gaps: readonly GoldenProgrammableMoneyPolicyFoundryNamedGap[],
): readonly ShadowPolicyRecommendation[] {
  return Object.freeze([
    Object.freeze({
      kind: 'define-policy',
      severity: 'high',
      title: 'Define programmable-money scope before any wallet-facing promotion',
      summary: 'Allowance, intent-route, and wallet-memo fixtures keep the programmable-money candidate review-only until scope, deadline, and memo authority boundaries are explicit.',
      actionSurface: 'programmable_money.transaction_intent',
      domain: 'programmable-money',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'allowance-scope-overbroad' ||
        gap.kind === 'intent-route-slippage-review' ||
        gap.kind === 'wallet-memo-instruction-review'
      ).length,
      reasonCodes: Object.freeze([
        'programmable-money:approval-over-policy-cap',
        'programmable-money:deadline-slippage-boundary',
        'programmable-money:wallet-memo-is-not-authority',
      ]),
      nextMode: 'review',
      confidence: 0.86,
    }),
    Object.freeze({
      kind: 'bind-authority',
      severity: 'blocker',
      title: 'Bind fresh authority before delegated, custody, or approval flows',
      summary: 'Unlimited approvals, stale delegated-EOA authorization, custody quorum gaps, and instruction-like wallet memos cannot grant authority.',
      actionSurface: 'programmable_money.transaction_intent',
      domain: 'programmable-money',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'allowance-scope-overbroad' ||
        gap.kind === 'delegated-eoa-authority-stale' ||
        gap.kind === 'custody-quorum-pending' ||
        gap.kind === 'wallet-memo-instruction-review'
      ).length,
      reasonCodes: Object.freeze([
        'programmable-money:narrow-allowance-and-validity-window',
        'programmable-money:eip7702-authorization-stale',
        'programmable-money:custody-quorum-pending',
        'programmable-money:block-instruction-like-evidence',
      ]),
      nextMode: 'review',
      confidence: 0.9,
    }),
    Object.freeze({
      kind: 'bind-evidence',
      severity: 'blocker',
      title: 'Require preflight, simulation, receipt, and settlement evidence',
      summary: 'UserOperation, x402, custody, and intent-settlement fixtures require digest-bound adapter, preflight, settlement, and receipt evidence before any customer gate can act.',
      actionSurface: 'programmable_money.transaction_intent',
      domain: 'programmable-money',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'account-abstraction-preflight-missing' ||
        gap.kind === 'x402-settlement-proof-missing' ||
        gap.kind === 'custody-quorum-pending' ||
        gap.kind === 'intent-route-slippage-review'
      ).length,
      reasonCodes: Object.freeze([
        'programmable-money:paymaster-evidence-missing',
        'programmable-money:x402-settlement-proof-missing',
        'programmable-money:review-before-cosigner-response',
        'programmable-money:intent-route-needs-review',
      ]),
      nextMode: 'review',
      confidence: 0.88,
    }),
    Object.freeze({
      kind: 'prepare-adapter',
      severity: 'high',
      title: 'Keep adapter handoffs behind review-only preparation',
      summary: 'Bundler, custody, x402 facilitator, Safe, and solver handoffs stay as evidence refs only; P02 does not call or activate adapters.',
      actionSurface: 'programmable_money.transaction_intent',
      domain: 'programmable-money',
      affectedEvents: gaps.filter((gap) =>
        gap.kind === 'account-abstraction-preflight-missing' ||
        gap.kind === 'x402-settlement-proof-missing' ||
        gap.kind === 'custody-quorum-pending' ||
        gap.kind === 'intent-route-slippage-review'
      ).length,
      reasonCodes: Object.freeze([
        'programmable-money:block-before-bundler-submission',
        'programmable-money:block-resource-fulfillment',
        'programmable-money:review-before-cosigner-response',
        'programmable-money:deadline-slippage-boundary',
      ]),
      nextMode: 'review',
      confidence: 0.84,
    }),
    Object.freeze({
      kind: 'promote-to-review',
      severity: 'blocker',
      title: 'Keep programmable-money projection in review mode',
      summary: 'The projection can help reviewers inspect scope, authority, evidence, and adapter gaps, but it cannot enforce or reduce review requirements.',
      actionSurface: 'programmable_money.transaction_intent',
      domain: 'programmable-money',
      affectedEvents: gaps.length,
      reasonCodes: Object.freeze([
        'programmable-money:review-before-wallet-action',
        'programmable-money:not-live-settlement-proof',
      ]),
      nextMode: 'review',
      confidence: 0.87,
    }),
  ]);
}

function createReport(
  suite: GoldenProgrammableMoneyShadowFixtureSuite,
  counts: ShadowPolicyDecisionCounts,
  gaps: ShadowPolicyGapCounts,
  gapList: readonly GoldenProgrammableMoneyPolicyFoundryNamedGap[],
): ShadowPolicySimulationReport {
  const eventDigests = Object.freeze(suite.fixtures.map((fixture) => fixture.event.digest));
  const surfaceSimulation = Object.freeze({
    actionSurface: 'programmable_money.transaction_intent',
    domain: 'programmable-money',
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
    reportId: `golden-programmable-money-policy-twin:${suite.digest}`,
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
  gaps: readonly GoldenProgrammableMoneyPolicyFoundryNamedGap[],
): ShadowPolicyDiscoveryCandidate {
  const reasonCodes = Object.freeze(
    [...new Set(gaps.flatMap((gap) => gap.reasonCodes))].sort(),
  );
  return Object.freeze({
    candidateId: `policy-candidate:${digestFor('golden-programmable-money-review-only-candidate', {
      reportDigest: report.digest,
      reasonCodes,
    })}`,
    actionSurface: 'programmable_money.transaction_intent',
    domain: 'programmable-money',
    action: 'review-mode-rehearsal',
    proposedMode: 'review',
    approvalRequired: true,
    autoEnforce: false,
    requiredControls: GOLDEN_PROGRAMMABLE_MONEY_REQUIRED_CONTROLS,
    sourceRecommendationKinds: GOLDEN_PROGRAMMABLE_MONEY_SOURCE_RECOMMENDATION_KINDS,
    highestSeverity: 'blocker',
    affectedEvents: report.eventCount,
    confidence: 0.87,
    reasonCodes,
    summary:
      'Programmable Money candidate is review-only: bind policy scope, authority, preflight, settlement, adapter, custody quorum, and instruction-like memo controls before promotion.',
  });
}

function createReviewOnlyCandidate(
  candidate: ShadowPolicyDiscoveryCandidate,
  suite: GoldenProgrammableMoneyShadowFixtureSuite,
  gaps: readonly GoldenProgrammableMoneyPolicyFoundryNamedGap[],
): GoldenProgrammableMoneyPolicyFoundryReviewOnlyCandidate {
  return Object.freeze({
    candidateId: candidate.candidateId,
    actionSurface: 'programmable_money.transaction_intent',
    domain: 'programmable-money',
    proposedMode: 'review',
    requiredControls: GOLDEN_PROGRAMMABLE_MONEY_REQUIRED_CONTROLS,
    sourceFixtureDigests: Object.freeze(suite.fixtures.map((fixture) => fixture.digest)),
    namedGapKinds: Object.freeze(gaps.map((gap) => gap.kind)),
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    reviewOnly: true,
  });
}

export function createGoldenProgrammableMoneyPolicyFoundryProjection(
  suite: GoldenProgrammableMoneyShadowFixtureSuite = createGoldenProgrammableMoneyShadowFixtureSuite(),
): GoldenProgrammableMoneyPolicyFoundryProjection {
  const counts = decisionCounts(suite.fixtures);
  const gaps = gapCounts(suite.fixtures);
  const gapList = namedGaps(suite);
  const report = createReport(suite, counts, gaps, gapList);
  const candidate = createCandidate(report, gapList);
  const reviewOnlyCandidate = createReviewOnlyCandidate(candidate, suite, gapList);
  const reviewOnlyCandidateDigest = digestFor('golden-programmable-money-review-only-candidate', {
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
    version: GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'P02',
    generatedAt: GENERATED_AT,
    sourceFixtureSuiteVersion: suite.version,
    sourceFixtureSuiteDigest: suite.digest,
    sourceFixtureCount: suite.fixtureCount,
    actionSurface: 'programmable_money.transaction_intent',
    domain: 'programmable-money',
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
    rawTransactionPayloadStored: false,
    rawWalletMaterialStored: false,
    rawCustomerIdentifiersStored: false,
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

export function goldenProgrammableMoneyPolicyFoundryProjectionDescriptor():
  GoldenProgrammableMoneyPolicyFoundryProjectionDescriptor {
  return Object.freeze({
    version: GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_PROJECTION_VERSION,
    step: 'P02',
    sourceFixtureSuiteVersion: GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION,
    policyTwinSummaryVersion: POLICY_FOUNDRY_POLICY_TWIN_SUMMARY_VERSION,
    actionSurface: 'programmable_money.transaction_intent',
    domain: 'programmable-money',
    reviewOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    rawTransactionPayloadStored: false,
    rawWalletMaterialStored: false,
    rawCustomerIdentifiersStored: false,
    productionReady: false,
  });
}
