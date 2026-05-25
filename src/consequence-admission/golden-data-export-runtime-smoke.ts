import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenDataExportPolicyFoundryProjection,
  GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_PROJECTION_VERSION,
  type GoldenDataExportPolicyFoundryProjection,
} from './golden-data-export-policy-foundry-projection.js';
import {
  createGoldenDataExportShadowFixtureSuite,
  GOLDEN_DATA_EXPORT_SHADOW_FIXTURES_VERSION,
  type GoldenDataExportShadowFixtureSuite,
} from './golden-data-export-shadow-fixtures.js';
import {
  runShadowRuntimeFixtureReplaySmoke,
  SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION,
  type ShadowRuntimeFixtureReplaySmokeResult,
} from './shadow-runtime-fixture-replay-smoke.js';

export const GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION =
  'attestor.golden-data-export-runtime-smoke.v1';

export interface GoldenDataExportRuntimeSmokeScenarioResult {
  readonly scenario: string;
  readonly fixtureId: string;
  readonly fixtureDigest: string;
  readonly sourceEventDigest: string;
  readonly smokeDigest: string;
  readonly envelopeRefDigest: string;
  readonly assurancePacketDigest: string;
  readonly finalAssuranceCaseDigest: string;
  readonly finalLineageGraphDigest: string;
  readonly noTargetSystemCall: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly canAdmit: false;
  readonly productionReady: false;
}

export interface GoldenDataExportRuntimeSmokeResult {
  readonly version: typeof GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION;
  readonly step: 'D03';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_DATA_EXPORT_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly sourcePolicyFoundryProjectionDigest: string;
  readonly shadowRuntimeFixtureReplaySmokeVersion:
    typeof SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION;
  readonly scenarioCount: 8;
  readonly scenarioResults: readonly GoldenDataExportRuntimeSmokeScenarioResult[];
  readonly smokeResults: readonly ShadowRuntimeFixtureReplaySmokeResult[];
  readonly phaseDigests: readonly string[];
  readonly allScenariosCompleted: true;
  readonly executionMode: 'shadow-only';
  readonly fixtureOnly: true;
  readonly deterministicReplay: true;
  readonly noTargetSystemCall: true;
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
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenDataExportRuntimeSmokeDescriptor {
  readonly version: typeof GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION;
  readonly step: 'D03';
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_DATA_EXPORT_SHADOW_FIXTURES_VERSION;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly shadowRuntimeFixtureReplaySmokeVersion:
    typeof SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION;
  readonly scenarioCount: 8;
  readonly runsD01FixturesThroughR02ToR07: true;
  readonly executionMode: 'shadow-only';
  readonly fixtureOnly: true;
  readonly deterministicReplay: true;
  readonly noTargetSystemCall: true;
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
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-25T10:30:00.000Z';

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
  return `2026-05-25T10:${String(index).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.000Z`;
}

function assertProjectionMatchesSuite(
  suite: GoldenDataExportShadowFixtureSuite,
  projection: GoldenDataExportPolicyFoundryProjection,
): void {
  if (projection.sourceFixtureSuiteDigest !== suite.digest) {
    throw new Error(
      'Golden data export runtime smoke projection must be derived from the fixture suite.',
    );
  }
  if (projection.autoEnforce || projection.activatesEnforcement || projection.productionReady) {
    throw new Error('Golden data export runtime smoke requires a review-only projection.');
  }
}

function runScenarioSmoke(
  suite: GoldenDataExportShadowFixtureSuite,
  index: number,
): ShadowRuntimeFixtureReplaySmokeResult {
  const fixture = suite.fixtures[index];
  if (!fixture) {
    throw new Error('Golden data export runtime smoke requires a fixture for each scenario.');
  }
  return runShadowRuntimeFixtureReplaySmoke({
    fixtureId: fixture.fixtureId,
    fixtureRefDigest: fixture.digest,
    event: fixture.event,
    sourcePartitionDigest: digestFor('golden-data-export-source-partition', suite.digest),
    traceContextDigest: digestFor('golden-data-export-trace-context', {
      scenario: fixture.scenario,
      eventDigest: fixture.event.digest,
    }),
    sourceHistoryRefDigest: digestFor('golden-data-export-source-history', suite.digest),
    sourceHistorySequence: index + 1,
    requestedAt: minute(index, 0),
    claimedAt: minute(index, 5),
    generatedAt: minute(index, 10),
    observedAt: minute(index, 15),
    outcomeObservedAt: minute(index, 20),
    feedbackGeneratedAt: minute(index, 25),
    evaluatedAt: minute(index, 30),
    workerRefDigest: digestFor('golden-data-export-worker', 'fixture-only-worker'),
    dispatcherRunDigest: digestFor('golden-data-export-dispatcher', {
      scenario: fixture.scenario,
      sequence: index,
    }),
    observerRefDigest: digestFor('golden-data-export-observer', 'fixture-only-observer'),
    evaluatorRefDigest: digestFor('golden-data-export-evaluator', 'fixture-only-evaluator'),
    scopeDigest: digestFor('golden-data-export-scope', 'shadow-only-runtime-smoke'),
  });
}

function scenarioResult(
  smoke: ShadowRuntimeFixtureReplaySmokeResult,
): GoldenDataExportRuntimeSmokeScenarioResult {
  return Object.freeze({
    scenario: smoke.fixtureId.replace(/^golden-data-export:/u, ''),
    fixtureId: smoke.fixtureId,
    fixtureDigest: smoke.fixtureRefDigest,
    sourceEventDigest: smoke.sourceEventDigest,
    smokeDigest: smoke.digest,
    envelopeRefDigest: smoke.envelopeRefDigest,
    assurancePacketDigest: smoke.activation.assurancePacketDigest,
    finalAssuranceCaseDigest: smoke.finalAssuranceCaseDigest,
    finalLineageGraphDigest: smoke.finalLineageGraphDigest,
    noTargetSystemCall: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    canAdmit: false,
    productionReady: false,
  });
}

export function runGoldenDataExportRuntimeSmoke(
  suite: GoldenDataExportShadowFixtureSuite = createGoldenDataExportShadowFixtureSuite(),
  projection: GoldenDataExportPolicyFoundryProjection =
    createGoldenDataExportPolicyFoundryProjection(suite),
): GoldenDataExportRuntimeSmokeResult {
  assertProjectionMatchesSuite(suite, projection);
  const smokeResults = Object.freeze(
    suite.fixtures.map((_, index) => runScenarioSmoke(suite, index)),
  );
  const scenarioResults = Object.freeze(smokeResults.map(scenarioResult));
  const phaseDigests = Object.freeze(smokeResults.map((smoke) => smoke.digest));
  const payload = {
    version: GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION,
    step: 'D03',
    generatedAt: GENERATED_AT,
    sourceFixtureSuiteVersion: suite.version,
    sourceFixtureSuiteDigest: suite.digest,
    sourcePolicyFoundryProjectionVersion: projection.version,
    sourcePolicyFoundryProjectionDigest: projection.digest,
    shadowRuntimeFixtureReplaySmokeVersion: SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION,
    scenarioCount: scenarioResults.length,
    scenarioResults,
    phaseDigests,
    allScenariosCompleted: true,
    executionMode: 'shadow-only',
    fixtureOnly: true,
    deterministicReplay: true,
    noTargetSystemCall: true,
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
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    scenarioCount: 8,
    smokeResults,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function goldenDataExportRuntimeSmokeDescriptor():
  GoldenDataExportRuntimeSmokeDescriptor {
  return Object.freeze({
    version: GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION,
    step: 'D03',
    sourceFixtureSuiteVersion: GOLDEN_DATA_EXPORT_SHADOW_FIXTURES_VERSION,
    sourcePolicyFoundryProjectionVersion: GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_PROJECTION_VERSION,
    shadowRuntimeFixtureReplaySmokeVersion: SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION,
    scenarioCount: 8,
    runsD01FixturesThroughR02ToR07: true,
    executionMode: 'shadow-only',
    fixtureOnly: true,
    deterministicReplay: true,
    noTargetSystemCall: true,
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
    productionReady: false,
  });
}
