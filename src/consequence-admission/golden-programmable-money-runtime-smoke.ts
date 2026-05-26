import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenProgrammableMoneyPolicyFoundryProjection,
  GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_PROJECTION_VERSION,
  type GoldenProgrammableMoneyPolicyFoundryProjection,
} from './golden-programmable-money-policy-foundry-projection.js';
import {
  createGoldenProgrammableMoneyShadowFixtureSuite,
  GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION,
  type GoldenProgrammableMoneyShadowFixtureScenario,
  type GoldenProgrammableMoneyShadowFixtureSuite,
} from './golden-programmable-money-shadow-fixtures.js';
import {
  runShadowRuntimeFixtureReplaySmoke,
  SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION,
  type ShadowRuntimeFixtureReplaySmokeResult,
} from './shadow-runtime-fixture-replay-smoke.js';

export const GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION =
  'attestor.golden-programmable-money-runtime-smoke.v1';

export interface GoldenProgrammableMoneyRuntimeSmokeScenarioResult {
  readonly scenario: GoldenProgrammableMoneyShadowFixtureScenario;
  readonly fixtureId: string;
  readonly fixtureDigest: string;
  readonly sourceEventDigest: string;
  readonly smokeDigest: string;
  readonly envelopeRefDigest: string;
  readonly assurancePacketDigest: string;
  readonly finalAssuranceCaseDigest: string;
  readonly finalLineageGraphDigest: string;
  readonly adapterKind: string;
  readonly consequenceKind: string;
  readonly expectedDecision: string;
  readonly noTargetSystemCall: true;
  readonly noWalletCall: true;
  readonly noSigning: true;
  readonly noBroadcast: true;
  readonly noCustodyCallback: true;
  readonly noBundlerCall: true;
  readonly noFacilitatorCall: true;
  readonly noSolverCall: true;
  readonly noProviderCall: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly canAdmit: false;
  readonly productionReady: false;
}

export interface GoldenProgrammableMoneyRuntimeSmokeResult {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION;
  readonly step: 'P03';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly sourcePolicyFoundryProjectionDigest: string;
  readonly shadowRuntimeFixtureReplaySmokeVersion:
    typeof SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION;
  readonly scenarioCount: 8;
  readonly scenarioResults: readonly GoldenProgrammableMoneyRuntimeSmokeScenarioResult[];
  readonly smokeResults: readonly ShadowRuntimeFixtureReplaySmokeResult[];
  readonly phaseDigests: readonly string[];
  readonly allScenariosCompleted: true;
  readonly executionMode: 'shadow-only';
  readonly fixtureOnly: true;
  readonly deterministicReplay: true;
  readonly noTargetSystemCall: true;
  readonly noWalletCall: true;
  readonly noSigning: true;
  readonly noBroadcast: true;
  readonly noCustodyCallback: true;
  readonly noBundlerCall: true;
  readonly noFacilitatorCall: true;
  readonly noSolverCall: true;
  readonly noProviderCall: true;
  readonly noAuditWrite: true;
  readonly noExternalEventBus: true;
  readonly noExternalTraceExport: true;
  readonly noExternalLineageExport: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly noTrainingActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly rawTransactionPayloadRead: false;
  readonly rawTransactionPayloadStored: false;
  readonly rawWalletMaterialRead: false;
  readonly rawWalletMaterialStored: false;
  readonly rawCustomerIdentifiersRead: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenProgrammableMoneyRuntimeSmokeDescriptor {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION;
  readonly step: 'P03';
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly shadowRuntimeFixtureReplaySmokeVersion:
    typeof SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION;
  readonly scenarioCount: 8;
  readonly runsP01FixturesThroughR02ToR07: true;
  readonly executionMode: 'shadow-only';
  readonly fixtureOnly: true;
  readonly deterministicReplay: true;
  readonly noTargetSystemCall: true;
  readonly noWalletCall: true;
  readonly noSigning: true;
  readonly noBroadcast: true;
  readonly noCustodyCallback: true;
  readonly noBundlerCall: true;
  readonly noFacilitatorCall: true;
  readonly noSolverCall: true;
  readonly noProviderCall: true;
  readonly noAuditWrite: true;
  readonly noExternalEventBus: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly noTrainingActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly rawTransactionPayloadRead: false;
  readonly rawTransactionPayloadStored: false;
  readonly rawWalletMaterialRead: false;
  readonly rawWalletMaterialStored: false;
  readonly rawCustomerIdentifiersRead: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-26T15:15:00.000Z';

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

function minute(index: number, seconds: number): string {
  return `2026-05-26T15:${String(index).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.000Z`;
}

function assertProjectionMatchesSuite(
  suite: GoldenProgrammableMoneyShadowFixtureSuite,
  projection: GoldenProgrammableMoneyPolicyFoundryProjection,
): void {
  if (projection.sourceFixtureSuiteDigest !== suite.digest) {
    throw new Error(
      'Golden programmable money runtime smoke projection must be derived from the fixture suite.',
    );
  }
  if (projection.sourceFixtureCount !== suite.fixtureCount) {
    throw new Error(
      'Golden programmable money runtime smoke projection must retain the full fixture count.',
    );
  }
  if (
    !projection.reviewMaterialOnly ||
    projection.autoEnforce ||
    projection.activatesEnforcement ||
    projection.productionReady
  ) {
    throw new Error(
      'Golden programmable money runtime smoke requires a review-only projection.',
    );
  }
}

function runScenarioSmoke(
  suite: GoldenProgrammableMoneyShadowFixtureSuite,
  index: number,
): ShadowRuntimeFixtureReplaySmokeResult {
  const fixture = suite.fixtures[index];
  if (!fixture) {
    throw new Error('Golden programmable money runtime smoke requires a fixture for each scenario.');
  }
  return runShadowRuntimeFixtureReplaySmoke({
    fixtureId: fixture.fixtureId,
    fixtureRefDigest: fixture.digest,
    event: fixture.event,
    sourcePartitionDigest: digestFor('golden-programmable-money-source-partition', suite.digest),
    traceContextDigest: digestFor('golden-programmable-money-trace-context', {
      scenario: fixture.scenario,
      eventDigest: fixture.event.digest,
    }),
    sourceHistoryRefDigest: digestFor('golden-programmable-money-source-history', suite.digest),
    sourceHistorySequence: index + 1,
    requestedAt: minute(index, 0),
    claimedAt: minute(index, 5),
    generatedAt: minute(index, 10),
    observedAt: minute(index, 15),
    outcomeObservedAt: minute(index, 20),
    feedbackGeneratedAt: minute(index, 25),
    evaluatedAt: minute(index, 30),
    workerRefDigest: digestFor('golden-programmable-money-worker', 'fixture-only-worker'),
    dispatcherRunDigest: digestFor('golden-programmable-money-dispatcher', {
      scenario: fixture.scenario,
      sequence: index,
    }),
    observerRefDigest: digestFor('golden-programmable-money-observer', 'fixture-only-observer'),
    evaluatorRefDigest: digestFor('golden-programmable-money-evaluator', 'fixture-only-evaluator'),
    scopeDigest: digestFor('golden-programmable-money-scope', 'shadow-only-runtime-smoke'),
  });
}

function scenarioResult(
  suite: GoldenProgrammableMoneyShadowFixtureSuite,
  smoke: ShadowRuntimeFixtureReplaySmokeResult,
): GoldenProgrammableMoneyRuntimeSmokeScenarioResult {
  const fixture = suite.fixtures.find((entry) => entry.fixtureId === smoke.fixtureId);
  if (!fixture) {
    throw new Error('Golden programmable money runtime smoke result must bind back to a fixture.');
  }
  return Object.freeze({
    scenario: fixture.scenario,
    fixtureId: smoke.fixtureId,
    fixtureDigest: smoke.fixtureRefDigest,
    sourceEventDigest: smoke.sourceEventDigest,
    smokeDigest: smoke.digest,
    envelopeRefDigest: smoke.envelopeRefDigest,
    assurancePacketDigest: smoke.activation.assurancePacketDigest,
    finalAssuranceCaseDigest: smoke.finalAssuranceCaseDigest,
    finalLineageGraphDigest: smoke.finalLineageGraphDigest,
    adapterKind: fixture.operationFacts.adapterKind,
    consequenceKind: fixture.operationFacts.consequenceKind,
    expectedDecision: fixture.expectedDecision,
    noTargetSystemCall: true,
    noWalletCall: true,
    noSigning: true,
    noBroadcast: true,
    noCustodyCallback: true,
    noBundlerCall: true,
    noFacilitatorCall: true,
    noSolverCall: true,
    noProviderCall: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    canAdmit: false,
    productionReady: false,
  });
}

export function runGoldenProgrammableMoneyRuntimeSmoke(
  suite: GoldenProgrammableMoneyShadowFixtureSuite =
    createGoldenProgrammableMoneyShadowFixtureSuite(),
  projection: GoldenProgrammableMoneyPolicyFoundryProjection =
    createGoldenProgrammableMoneyPolicyFoundryProjection(suite),
): GoldenProgrammableMoneyRuntimeSmokeResult {
  assertProjectionMatchesSuite(suite, projection);
  const smokeResults = Object.freeze(
    suite.fixtures.map((_, index) => runScenarioSmoke(suite, index)),
  );
  const scenarioResults = Object.freeze(
    smokeResults.map((smoke) => scenarioResult(suite, smoke)),
  );
  const phaseDigests = Object.freeze(smokeResults.map((smoke) => smoke.digest));
  const payload = {
    version: GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION,
    step: 'P03',
    generatedAt: GENERATED_AT,
    sourceFixtureSuiteVersion: suite.version,
    sourceFixtureSuiteDigest: suite.digest,
    sourcePolicyFoundryProjectionVersion: projection.version,
    sourcePolicyFoundryProjectionDigest: projection.digest,
    shadowRuntimeFixtureReplaySmokeVersion: SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION,
    scenarioCount: suite.fixtureCount,
    phaseDigests,
    allScenariosCompleted: true,
    executionMode: 'shadow-only',
    fixtureOnly: true,
    deterministicReplay: true,
    noTargetSystemCall: true,
    noWalletCall: true,
    noSigning: true,
    noBroadcast: true,
    noCustodyCallback: true,
    noBundlerCall: true,
    noFacilitatorCall: true,
    noSolverCall: true,
    noProviderCall: true,
    noAuditWrite: true,
    noExternalEventBus: true,
    noExternalTraceExport: true,
    noExternalLineageExport: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    noTrainingActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    rawTransactionPayloadRead: false,
    rawTransactionPayloadStored: false,
    rawWalletMaterialRead: false,
    rawWalletMaterialStored: false,
    rawCustomerIdentifiersRead: false,
    rawCustomerIdentifiersStored: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    scenarioResults,
    smokeResults,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function goldenProgrammableMoneyRuntimeSmokeDescriptor():
  GoldenProgrammableMoneyRuntimeSmokeDescriptor {
  return Object.freeze({
    version: GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION,
    step: 'P03',
    sourceFixtureSuiteVersion: GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION,
    sourcePolicyFoundryProjectionVersion:
      GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_PROJECTION_VERSION,
    shadowRuntimeFixtureReplaySmokeVersion: SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION,
    scenarioCount: 8,
    runsP01FixturesThroughR02ToR07: true,
    executionMode: 'shadow-only',
    fixtureOnly: true,
    deterministicReplay: true,
    noTargetSystemCall: true,
    noWalletCall: true,
    noSigning: true,
    noBroadcast: true,
    noCustodyCallback: true,
    noBundlerCall: true,
    noFacilitatorCall: true,
    noSolverCall: true,
    noProviderCall: true,
    noAuditWrite: true,
    noExternalEventBus: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    noTrainingActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    rawTransactionPayloadRead: false,
    rawTransactionPayloadStored: false,
    rawWalletMaterialRead: false,
    rawWalletMaterialStored: false,
    rawCustomerIdentifiersRead: false,
    rawCustomerIdentifiersStored: false,
    productionReady: false,
  });
}
