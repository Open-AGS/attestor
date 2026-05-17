import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CounterexampleReplayFixture,
  CounterexampleReplayGeneratorResult,
} from './counterexample-replay-generator.js';
import type {
  PolicyCandidatePrCandidate,
  PolicyCandidatePrContract,
} from './policy-candidate-pr-contract.js';

export const POLICY_TWIN_BACKTEST_VERSION =
  'attestor.policy-twin-backtest.v1';

export const POLICY_TWIN_BACKTEST_STATUSES = [
  'not-enough-evidence',
  'review-required',
  'counterexamples-failed',
  'backtest-passed',
] as const;
export type PolicyTwinBacktestStatus =
  typeof POLICY_TWIN_BACKTEST_STATUSES[number];

export const POLICY_TWIN_BACKTEST_DECISIONS = [
  'admit',
  'review',
  'hold',
  'block',
] as const;
export type PolicyTwinBacktestDecision =
  typeof POLICY_TWIN_BACKTEST_DECISIONS[number];

export interface PolicyTwinBacktestFixtureOutcomeInput {
  readonly fixtureDigest: string;
  readonly actualOutcome: PolicyTwinBacktestDecision;
  readonly evaluatorDigest?: string | null;
}

export interface CreatePolicyTwinBacktestInput {
  readonly policyCandidatePrContract: PolicyCandidatePrContract;
  readonly counterexampleReplayGenerator: CounterexampleReplayGeneratorResult;
  readonly generatedAt?: string | null;
  readonly fixtureOutcomes?: readonly PolicyTwinBacktestFixtureOutcomeInput[] | null;
}

export interface PolicyTwinBacktestFixtureResult {
  readonly fixtureId: string;
  readonly fixtureDigest: string;
  readonly kind: CounterexampleReplayFixture['kind'];
  readonly candidateId: string;
  readonly expectedOutcome: PolicyTwinBacktestDecision;
  readonly actualOutcome: PolicyTwinBacktestDecision;
  readonly evaluatorDigest: string | null;
  readonly outcomeMatched: boolean;
  readonly falseAdmitRisk: boolean;
  readonly mustNotAdmit: true;
  readonly sourceReplayInputDigest: string;
  readonly sourceMutationDigest: string;
  readonly reasonCodes: readonly string[];
}

export interface PolicyTwinBacktestCandidateResult {
  readonly candidateId: string;
  readonly surfaceId: string;
  readonly actionSurface: string;
  readonly sourcePolicyCandidateDigest: string;
  readonly sourceEvidenceStateDigest: string;
  readonly sourceEventDigests: readonly string[];
  readonly fixtureDigests: readonly string[];
  readonly status: PolicyTwinBacktestStatus;
  readonly historicalDecision: PolicyTwinBacktestDecision;
  readonly historicalEventCount: number;
  readonly historicalAdmitCount: number;
  readonly historicalReviewCount: number;
  readonly historicalHoldCount: number;
  readonly historicalBlockCount: number;
  readonly fixtureCount: number;
  readonly fixturePassedCount: number;
  readonly fixtureOutcomeMismatchCount: number;
  readonly falseAdmitRiskCount: number;
  readonly missedEvidenceCount: number;
  readonly unresolvedQuestionCount: number;
  readonly missingReplayDigest: boolean;
  readonly noGoReasons: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface PolicyTwinBacktestDecisionImpact {
  readonly historicalEventCount: number;
  readonly historicalAdmitCount: number;
  readonly historicalReviewCount: number;
  readonly historicalHoldCount: number;
  readonly historicalBlockCount: number;
  readonly historicalAdmitRate: number;
  readonly historicalReviewRate: number;
  readonly historicalHoldRate: number;
  readonly historicalBlockRate: number;
  readonly counterexampleFixtureCount: number;
  readonly counterexampleExpectedBlockCount: number;
  readonly counterexampleExpectedReviewCount: number;
  readonly counterexampleExpectedHoldCount: number;
  readonly counterexampleActualAdmitCount: number;
  readonly counterexampleOutcomeMismatchCount: number;
  readonly falseAdmitRiskCount: number;
}

export interface PolicyTwinBacktestReviewLoadImpact {
  readonly manualReviewBaselineCount: number;
  readonly simulatedReviewCount: number;
  readonly simulatedHoldCount: number;
  readonly reviewLoadDeltaCount: number;
  readonly reviewLoadReductionRate: number;
  readonly baselineAssumption: 'manual-review-everything';
}

export interface PolicyTwinBacktestResult {
  readonly version: typeof POLICY_TWIN_BACKTEST_VERSION;
  readonly generatedAt: string;
  readonly policyCandidatePrContractDigest: string;
  readonly counterexampleReplayGeneratorDigest: string;
  readonly tenantRefDigest: string;
  readonly graphDigest: string;
  readonly schemaDigest: string;
  readonly candidateCount: number;
  readonly candidateBacktestedCount: number;
  readonly fixtureCount: number;
  readonly historicalEventCount: number;
  readonly status: PolicyTwinBacktestStatus;
  readonly promotionBlocked: boolean;
  readonly decisionImpact: PolicyTwinBacktestDecisionImpact;
  readonly reviewLoadImpact: PolicyTwinBacktestReviewLoadImpact;
  readonly missedEvidenceCount: number;
  readonly unresolvedQuestionCount: number;
  readonly missingReplayDigestCount: number;
  readonly falseAdmitRiskCount: number;
  readonly counterexampleOutcomeMismatchCount: number;
  readonly noGoReasons: readonly string[];
  readonly candidateResults: readonly PolicyTwinBacktestCandidateResult[];
  readonly fixtureResults: readonly PolicyTwinBacktestFixtureResult[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly policyTwinEvidenceOnly: true;
  readonly localReplayOnly: true;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly credentialUseAllowed: false;
  readonly reviewMaterialOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyTwinBacktestDescriptor {
  readonly version: typeof POLICY_TWIN_BACKTEST_VERSION;
  readonly statuses: typeof POLICY_TWIN_BACKTEST_STATUSES;
  readonly decisions: typeof POLICY_TWIN_BACKTEST_DECISIONS;
  readonly baselineAssumption: 'manual-review-everything';
  readonly tenantBound: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly policyTwinEvidenceOnly: true;
  readonly localReplayOnly: true;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly credentialUseAllowed: false;
  readonly reviewMaterialOnly: true;
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

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
    throw new Error(`Policy Twin backtest ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeDigest(value: string, fieldName: string): string {
  if (!SHA256_DIGEST_PATTERN.test(value)) {
    throw new Error(`Policy Twin backtest ${fieldName} must be a sha256 digest.`);
  }
  return value;
}

function normalizeDecision(
  value: PolicyTwinBacktestDecision,
  fieldName: string,
): PolicyTwinBacktestDecision {
  if (!(POLICY_TWIN_BACKTEST_DECISIONS as readonly string[]).includes(value)) {
    throw new Error(`Policy Twin backtest ${fieldName} must be a known decision.`);
  }
  return value;
}

function validateSources(input: {
  readonly contract: PolicyCandidatePrContract;
  readonly counterexamples: CounterexampleReplayGeneratorResult;
}): void {
  if (input.counterexamples.policyCandidatePrContractDigest !== input.contract.digest) {
    throw new Error(
      'Policy Twin backtest counterexample source digest must match policy candidate PR contract digest.',
    );
  }
  if (input.counterexamples.tenantRefDigest !== input.contract.tenantRefDigest) {
    throw new Error(
      'Policy Twin backtest counterexample tenant digest must match policy candidate PR contract tenant digest.',
    );
  }
  if (input.counterexamples.graphDigest !== input.contract.graphDigest) {
    throw new Error(
      'Policy Twin backtest counterexample graph digest must match policy candidate PR contract graph digest.',
    );
  }
  if (input.counterexamples.schemaDigest !== input.contract.schemaDigest) {
    throw new Error(
      'Policy Twin backtest counterexample schema digest must match policy candidate PR contract schema digest.',
    );
  }
}

function roundedRate(count: number, total: number): number {
  if (total <= 0) return 0;
  return Number(Math.max(0, Math.min(1, count / total)).toFixed(2));
}

function expectedDecision(
  fixture: CounterexampleReplayFixture,
): PolicyTwinBacktestDecision {
  switch (fixture.expectedOutcome) {
    case 'block':
      return 'block';
    case 'review-required':
      return 'review';
    case 'hold':
      return 'hold';
  }
}

function satisfiesExpected(input: {
  readonly expected: PolicyTwinBacktestDecision;
  readonly actual: PolicyTwinBacktestDecision;
}): boolean {
  if (input.expected === 'block') return input.actual === 'block';
  if (input.expected === 'hold') return input.actual === 'hold' || input.actual === 'block';
  if (input.expected === 'review') return input.actual === 'review' || input.actual === 'block';
  return input.actual === input.expected;
}

function historicalDecisionFor(
  candidate: PolicyCandidatePrCandidate,
): PolicyTwinBacktestDecision {
  if (candidate.blockerReasonCodes.length > 0 || candidate.missingEvidenceFields.length > 0) {
    return 'block';
  }
  if (
    candidate.approvalState === 'approval-ready' ||
    candidate.approvalState === 'approved'
  ) {
    return 'admit';
  }
  return 'review';
}

function outcomeMap(
  fixtures: readonly CounterexampleReplayFixture[],
  outcomes: readonly PolicyTwinBacktestFixtureOutcomeInput[] | null | undefined,
): ReadonlyMap<string, PolicyTwinBacktestFixtureOutcomeInput> {
  const known = new Set(fixtures.map((fixture) => fixture.fixtureDigest));
  const map = new Map<string, PolicyTwinBacktestFixtureOutcomeInput>();
  for (const outcome of outcomes ?? []) {
    const fixtureDigest = normalizeDigest(outcome.fixtureDigest, 'fixtureOutcomes[].fixtureDigest');
    if (!known.has(fixtureDigest)) {
      throw new Error(
        'Policy Twin backtest fixture outcome must reference a generated counterexample fixture digest.',
      );
    }
    if (map.has(fixtureDigest)) {
      throw new Error('Policy Twin backtest fixture outcomes must not contain duplicate digests.');
    }
    const normalized = Object.freeze({
      fixtureDigest,
      actualOutcome: normalizeDecision(outcome.actualOutcome, 'fixtureOutcomes[].actualOutcome'),
      evaluatorDigest: outcome.evaluatorDigest === undefined || outcome.evaluatorDigest === null
        ? null
        : normalizeDigest(outcome.evaluatorDigest, 'fixtureOutcomes[].evaluatorDigest'),
    });
    map.set(fixtureDigest, normalized);
  }
  return map;
}

function fixtureResults(input: {
  readonly fixtures: readonly CounterexampleReplayFixture[];
  readonly outcomes: ReadonlyMap<string, PolicyTwinBacktestFixtureOutcomeInput>;
}): readonly PolicyTwinBacktestFixtureResult[] {
  return Object.freeze(input.fixtures.map((fixture) => {
    const override = input.outcomes.get(fixture.fixtureDigest);
    const expected = expectedDecision(fixture);
    const actual = override?.actualOutcome ?? expected;
    const outcomeMatched = satisfiesExpected({ expected, actual });
    const falseAdmitRisk = fixture.mustNotAdmit && actual === 'admit';
    return Object.freeze({
      fixtureId: fixture.fixtureId,
      fixtureDigest: fixture.fixtureDigest,
      kind: fixture.kind,
      candidateId: fixture.candidateId,
      expectedOutcome: expected,
      actualOutcome: actual,
      evaluatorDigest: override?.evaluatorDigest ?? null,
      outcomeMatched,
      falseAdmitRisk,
      mustNotAdmit: true as const,
      sourceReplayInputDigest: fixture.replayInputDigest,
      sourceMutationDigest: fixture.mutationDigest,
      reasonCodes: fixture.reasonCodes,
    });
  }).sort((left, right) =>
    left.candidateId.localeCompare(right.candidateId) ||
    left.kind.localeCompare(right.kind)
  ));
}

function noGoReasonsForCandidate(input: {
  readonly candidate: PolicyCandidatePrCandidate;
  readonly historicalDecision: PolicyTwinBacktestDecision;
  readonly fixtureResults: readonly PolicyTwinBacktestFixtureResult[];
}): readonly string[] {
  const reasons = new Set<string>();
  if (input.candidate.sourceEventDigests.length === 0) reasons.add('policy-twin-source-events-missing');
  if (input.fixtureResults.length === 0) reasons.add('policy-twin-counterexamples-missing');
  if (input.candidate.missingEvidenceFields.length > 0) reasons.add('policy-twin-missed-evidence');
  if (input.candidate.questionDigests.length > 0) reasons.add('policy-twin-active-question-open');
  if (input.candidate.replayDigest === null) reasons.add('policy-twin-replay-digest-missing');
  if (input.historicalDecision === 'block') reasons.add('policy-twin-historical-blocks');
  if (input.historicalDecision === 'review') reasons.add('policy-twin-historical-review-required');
  if (input.fixtureResults.some((fixture) => fixture.falseAdmitRisk)) {
    reasons.add('policy-twin-counterexample-false-admit');
  }
  if (input.fixtureResults.some((fixture) => !fixture.outcomeMatched)) {
    reasons.add('policy-twin-counterexample-outcome-mismatch');
  }
  return Object.freeze([...reasons].sort());
}

function candidateStatus(input: {
  readonly sourceEventCount: number;
  readonly fixtureCount: number;
  readonly noGoReasons: readonly string[];
}): PolicyTwinBacktestStatus {
  if (input.sourceEventCount === 0 || input.fixtureCount === 0) {
    return 'not-enough-evidence';
  }
  if (
    input.noGoReasons.includes('policy-twin-counterexample-false-admit') ||
    input.noGoReasons.includes('policy-twin-counterexample-outcome-mismatch')
  ) {
    return 'counterexamples-failed';
  }
  if (input.noGoReasons.length > 0) return 'review-required';
  return 'backtest-passed';
}

function createCandidateResult(input: {
  readonly candidate: PolicyCandidatePrCandidate;
  readonly fixtureResults: readonly PolicyTwinBacktestFixtureResult[];
}): PolicyTwinBacktestCandidateResult {
  const historicalDecision = historicalDecisionFor(input.candidate);
  const sourceEventCount = input.candidate.sourceEventDigests.length;
  const noGoReasons = noGoReasonsForCandidate({
    candidate: input.candidate,
    historicalDecision,
    fixtureResults: input.fixtureResults,
  });
  const status = candidateStatus({
    sourceEventCount,
    fixtureCount: input.fixtureResults.length,
    noGoReasons,
  });
  const historicalAdmitCount = historicalDecision === 'admit' ? sourceEventCount : 0;
  const historicalReviewCount = historicalDecision === 'review' ? sourceEventCount : 0;
  const historicalHoldCount = historicalDecision === 'hold' ? sourceEventCount : 0;
  const historicalBlockCount = historicalDecision === 'block' ? sourceEventCount : 0;
  return Object.freeze({
    candidateId: input.candidate.candidateId,
    surfaceId: input.candidate.surfaceId,
    actionSurface: input.candidate.actionSurface,
    sourcePolicyCandidateDigest: input.candidate.digest,
    sourceEvidenceStateDigest: input.candidate.sourceEvidenceStateDigest,
    sourceEventDigests: input.candidate.sourceEventDigests,
    fixtureDigests: Object.freeze(input.fixtureResults.map((fixture) => fixture.fixtureDigest).sort()),
    status,
    historicalDecision,
    historicalEventCount: sourceEventCount,
    historicalAdmitCount,
    historicalReviewCount,
    historicalHoldCount,
    historicalBlockCount,
    fixtureCount: input.fixtureResults.length,
    fixturePassedCount: input.fixtureResults.filter((fixture) => fixture.outcomeMatched).length,
    fixtureOutcomeMismatchCount: input.fixtureResults.filter((fixture) =>
      !fixture.outcomeMatched
    ).length,
    falseAdmitRiskCount: input.fixtureResults.filter((fixture) => fixture.falseAdmitRisk).length,
    missedEvidenceCount: input.candidate.missingEvidenceFields.length,
    unresolvedQuestionCount: input.candidate.questionDigests.length,
    missingReplayDigest: input.candidate.replayDigest === null,
    noGoReasons,
    approvalRequired: true as const,
    autoEnforce: false as const,
    activatesEnforcement: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
  });
}

function aggregateStatus(
  candidateResults: readonly PolicyTwinBacktestCandidateResult[],
): PolicyTwinBacktestStatus {
  if (
    candidateResults.length === 0 ||
    candidateResults.some((candidate) => candidate.status === 'not-enough-evidence')
  ) {
    return 'not-enough-evidence';
  }
  if (candidateResults.some((candidate) => candidate.status === 'counterexamples-failed')) {
    return 'counterexamples-failed';
  }
  if (candidateResults.some((candidate) => candidate.status === 'review-required')) {
    return 'review-required';
  }
  return 'backtest-passed';
}

function decisionImpact(input: {
  readonly candidateResults: readonly PolicyTwinBacktestCandidateResult[];
  readonly fixtureResults: readonly PolicyTwinBacktestFixtureResult[];
}): PolicyTwinBacktestDecisionImpact {
  const historicalEventCount = input.candidateResults.reduce(
    (sum, candidate) => sum + candidate.historicalEventCount,
    0,
  );
  const historicalAdmitCount = input.candidateResults.reduce(
    (sum, candidate) => sum + candidate.historicalAdmitCount,
    0,
  );
  const historicalReviewCount = input.candidateResults.reduce(
    (sum, candidate) => sum + candidate.historicalReviewCount,
    0,
  );
  const historicalHoldCount = input.candidateResults.reduce(
    (sum, candidate) => sum + candidate.historicalHoldCount,
    0,
  );
  const historicalBlockCount = input.candidateResults.reduce(
    (sum, candidate) => sum + candidate.historicalBlockCount,
    0,
  );
  return Object.freeze({
    historicalEventCount,
    historicalAdmitCount,
    historicalReviewCount,
    historicalHoldCount,
    historicalBlockCount,
    historicalAdmitRate: roundedRate(historicalAdmitCount, historicalEventCount),
    historicalReviewRate: roundedRate(historicalReviewCount, historicalEventCount),
    historicalHoldRate: roundedRate(historicalHoldCount, historicalEventCount),
    historicalBlockRate: roundedRate(historicalBlockCount, historicalEventCount),
    counterexampleFixtureCount: input.fixtureResults.length,
    counterexampleExpectedBlockCount: input.fixtureResults.filter((fixture) =>
      fixture.expectedOutcome === 'block'
    ).length,
    counterexampleExpectedReviewCount: input.fixtureResults.filter((fixture) =>
      fixture.expectedOutcome === 'review'
    ).length,
    counterexampleExpectedHoldCount: input.fixtureResults.filter((fixture) =>
      fixture.expectedOutcome === 'hold'
    ).length,
    counterexampleActualAdmitCount: input.fixtureResults.filter((fixture) =>
      fixture.actualOutcome === 'admit'
    ).length,
    counterexampleOutcomeMismatchCount: input.fixtureResults.filter((fixture) =>
      !fixture.outcomeMatched
    ).length,
    falseAdmitRiskCount: input.fixtureResults.filter((fixture) => fixture.falseAdmitRisk).length,
  });
}

function reviewLoadImpact(
  candidateResults: readonly PolicyTwinBacktestCandidateResult[],
): PolicyTwinBacktestReviewLoadImpact {
  const manualReviewBaselineCount = candidateResults.reduce(
    (sum, candidate) => sum + candidate.historicalEventCount,
    0,
  );
  const simulatedReviewCount = candidateResults.reduce(
    (sum, candidate) => sum + candidate.historicalReviewCount,
    0,
  );
  const simulatedHoldCount = candidateResults.reduce(
    (sum, candidate) => sum + candidate.historicalHoldCount,
    0,
  );
  const simulatedHumanWorkCount = simulatedReviewCount + simulatedHoldCount;
  return Object.freeze({
    manualReviewBaselineCount,
    simulatedReviewCount,
    simulatedHoldCount,
    reviewLoadDeltaCount: simulatedHumanWorkCount - manualReviewBaselineCount,
    reviewLoadReductionRate: manualReviewBaselineCount <= 0
      ? 0
      : roundedRate(manualReviewBaselineCount - simulatedHumanWorkCount, manualReviewBaselineCount),
    baselineAssumption: 'manual-review-everything' as const,
  });
}

export function createPolicyTwinBacktest(
  input: CreatePolicyTwinBacktestInput,
): PolicyTwinBacktestResult {
  validateSources({
    contract: input.policyCandidatePrContract,
    counterexamples: input.counterexampleReplayGenerator,
  });
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    input.counterexampleReplayGenerator.generatedAt,
    'generatedAt',
  );
  const fixtureOutcomeMap = outcomeMap(
    input.counterexampleReplayGenerator.fixtures,
    input.fixtureOutcomes,
  );
  const allFixtureResults = fixtureResults({
    fixtures: input.counterexampleReplayGenerator.fixtures,
    outcomes: fixtureOutcomeMap,
  });
  const fixturesByCandidate = new Map<string, PolicyTwinBacktestFixtureResult[]>();
  for (const fixture of allFixtureResults) {
    const list = fixturesByCandidate.get(fixture.candidateId) ?? [];
    list.push(fixture);
    fixturesByCandidate.set(fixture.candidateId, list);
  }
  const candidateResults = Object.freeze(
    input.policyCandidatePrContract.candidates.map((candidate) =>
      createCandidateResult({
        candidate,
        fixtureResults: Object.freeze(
          [...(fixturesByCandidate.get(candidate.candidateId) ?? [])].sort((left, right) =>
            left.kind.localeCompare(right.kind)
          ),
        ),
      })
    ).sort((left, right) =>
      left.actionSurface.localeCompare(right.actionSurface) ||
      left.candidateId.localeCompare(right.candidateId)
    ),
  );
  const status = aggregateStatus(candidateResults);
  const impact = decisionImpact({
    candidateResults,
    fixtureResults: allFixtureResults,
  });
  const reviewImpact = reviewLoadImpact(candidateResults);
  const noGoReasons = Object.freeze(
    [...new Set(candidateResults.flatMap((candidate) => candidate.noGoReasons))].sort(),
  );
  const payload = {
    version: POLICY_TWIN_BACKTEST_VERSION as typeof POLICY_TWIN_BACKTEST_VERSION,
    generatedAt,
    policyCandidatePrContractDigest: input.policyCandidatePrContract.digest,
    counterexampleReplayGeneratorDigest: input.counterexampleReplayGenerator.digest,
    tenantRefDigest: input.policyCandidatePrContract.tenantRefDigest,
    graphDigest: input.policyCandidatePrContract.graphDigest,
    schemaDigest: input.policyCandidatePrContract.schemaDigest,
    candidateCount: input.policyCandidatePrContract.candidateCount,
    candidateBacktestedCount: candidateResults.filter((candidate) =>
      candidate.status !== 'not-enough-evidence'
    ).length,
    fixtureCount: allFixtureResults.length,
    historicalEventCount: impact.historicalEventCount,
    status,
    promotionBlocked: status !== 'backtest-passed',
    decisionImpact: impact,
    reviewLoadImpact: reviewImpact,
    missedEvidenceCount: candidateResults.reduce(
      (sum, candidate) => sum + candidate.missedEvidenceCount,
      0,
    ),
    unresolvedQuestionCount: candidateResults.reduce(
      (sum, candidate) => sum + candidate.unresolvedQuestionCount,
      0,
    ),
    missingReplayDigestCount: candidateResults.filter((candidate) =>
      candidate.missingReplayDigest
    ).length,
    falseAdmitRiskCount: impact.falseAdmitRiskCount,
    counterexampleOutcomeMismatchCount: impact.counterexampleOutcomeMismatchCount,
    noGoReasons,
    candidateResults,
    fixtureResults: allFixtureResults,
    approvalRequired: true as const,
    autoEnforce: false as const,
    activatesEnforcement: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    policyTwinEvidenceOnly: true as const,
    localReplayOnly: true as const,
    executesProductionTraffic: false as const,
    downstreamMutationAllowed: false as const,
    credentialUseAllowed: false as const,
    reviewMaterialOnly: true as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function policyTwinBacktestDescriptor(): PolicyTwinBacktestDescriptor {
  return Object.freeze({
    version: POLICY_TWIN_BACKTEST_VERSION,
    statuses: POLICY_TWIN_BACKTEST_STATUSES,
    decisions: POLICY_TWIN_BACKTEST_DECISIONS,
    baselineAssumption: 'manual-review-everything',
    tenantBound: true,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    productionReady: false,
    policyTwinEvidenceOnly: true,
    localReplayOnly: true,
    executesProductionTraffic: false,
    downstreamMutationAllowed: false,
    credentialUseAllowed: false,
    reviewMaterialOnly: true,
  });
}
