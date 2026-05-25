import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenAuthorityChangePolicyFoundryProjection,
  GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_PROJECTION_VERSION,
  type GoldenAuthorityChangePolicyFoundryProjection,
} from './golden-authority-change-policy-foundry-projection.js';
import {
  createGoldenAuthorityChangeShadowFixtureSuite,
  GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION,
  type GoldenAuthorityChangeShadowFixtureSuite,
} from './golden-authority-change-shadow-fixtures.js';
import {
  runShadowRuntimeFixtureReplaySmoke,
  SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION,
  type ShadowRuntimeFixtureReplaySmokeResult,
} from './shadow-runtime-fixture-replay-smoke.js';

export const GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION =
  'attestor.golden-authority-change-runtime-smoke.v1';

export interface GoldenAuthorityChangeRuntimeSmokeScenarioResult {
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
  readonly noIdentityProviderCall: true;
  readonly noAccessChange: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly canAdmit: false;
  readonly productionReady: false;
}

export interface GoldenAuthorityChangeRuntimeSmokeResult {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION;
  readonly step: 'A03';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly sourcePolicyFoundryProjectionDigest: string;
  readonly shadowRuntimeFixtureReplaySmokeVersion:
    typeof SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION;
  readonly scenarioCount: 8;
  readonly scenarioResults: readonly GoldenAuthorityChangeRuntimeSmokeScenarioResult[];
  readonly smokeResults: readonly ShadowRuntimeFixtureReplaySmokeResult[];
  readonly phaseDigests: readonly string[];
  readonly allScenariosCompleted: true;
  readonly executionMode: 'shadow-only';
  readonly fixtureOnly: true;
  readonly deterministicReplay: true;
  readonly noTargetSystemCall: true;
  readonly noIdentityProviderCall: true;
  readonly noAccessChange: true;
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
  readonly rawIdentityAttributesRead: false;
  readonly rawIdentityAttributesStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenAuthorityChangeRuntimeSmokeDescriptor {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION;
  readonly step: 'A03';
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly shadowRuntimeFixtureReplaySmokeVersion:
    typeof SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION;
  readonly scenarioCount: 8;
  readonly runsA01FixturesThroughR02ToR07: true;
  readonly executionMode: 'shadow-only';
  readonly fixtureOnly: true;
  readonly deterministicReplay: true;
  readonly noTargetSystemCall: true;
  readonly noIdentityProviderCall: true;
  readonly noAccessChange: true;
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
  readonly rawIdentityAttributesRead: false;
  readonly rawIdentityAttributesStored: false;
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-25T11:15:00.000Z';

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
  return `2026-05-25T11:${String(index).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.000Z`;
}

function assertProjectionMatchesSuite(
  suite: GoldenAuthorityChangeShadowFixtureSuite,
  projection: GoldenAuthorityChangePolicyFoundryProjection,
): void {
  if (projection.sourceFixtureSuiteDigest !== suite.digest) {
    throw new Error(
      'Golden authority change runtime smoke projection must be derived from the fixture suite.',
    );
  }
  if (projection.sourceFixtureCount !== suite.fixtureCount) {
    throw new Error(
      'Golden authority change runtime smoke projection must retain the full fixture count.',
    );
  }
  if (
    !projection.reviewMaterialOnly ||
    projection.autoEnforce ||
    projection.activatesEnforcement ||
    projection.productionReady
  ) {
    throw new Error('Golden authority change runtime smoke requires a review-only projection.');
  }
}

function runScenarioSmoke(
  suite: GoldenAuthorityChangeShadowFixtureSuite,
  index: number,
): ShadowRuntimeFixtureReplaySmokeResult {
  const fixture = suite.fixtures[index];
  if (!fixture) {
    throw new Error('Golden authority change runtime smoke requires a fixture for each scenario.');
  }
  return runShadowRuntimeFixtureReplaySmoke({
    fixtureId: fixture.fixtureId,
    fixtureRefDigest: fixture.digest,
    event: fixture.event,
    sourcePartitionDigest: digestFor('golden-authority-change-source-partition', suite.digest),
    traceContextDigest: digestFor('golden-authority-change-trace-context', {
      scenario: fixture.scenario,
      eventDigest: fixture.event.digest,
    }),
    sourceHistoryRefDigest: digestFor('golden-authority-change-source-history', suite.digest),
    sourceHistorySequence: index + 1,
    requestedAt: minute(index, 0),
    claimedAt: minute(index, 5),
    generatedAt: minute(index, 10),
    observedAt: minute(index, 15),
    outcomeObservedAt: minute(index, 20),
    feedbackGeneratedAt: minute(index, 25),
    evaluatedAt: minute(index, 30),
    workerRefDigest: digestFor('golden-authority-change-worker', 'fixture-only-worker'),
    dispatcherRunDigest: digestFor('golden-authority-change-dispatcher', {
      scenario: fixture.scenario,
      sequence: index,
    }),
    observerRefDigest: digestFor('golden-authority-change-observer', 'fixture-only-observer'),
    evaluatorRefDigest: digestFor('golden-authority-change-evaluator', 'fixture-only-evaluator'),
    scopeDigest: digestFor('golden-authority-change-scope', 'shadow-only-runtime-smoke'),
  });
}

function scenarioResult(
  smoke: ShadowRuntimeFixtureReplaySmokeResult,
): GoldenAuthorityChangeRuntimeSmokeScenarioResult {
  return Object.freeze({
    scenario: smoke.fixtureId.replace(/^golden-authority-change:/u, ''),
    fixtureId: smoke.fixtureId,
    fixtureDigest: smoke.fixtureRefDigest,
    sourceEventDigest: smoke.sourceEventDigest,
    smokeDigest: smoke.digest,
    envelopeRefDigest: smoke.envelopeRefDigest,
    assurancePacketDigest: smoke.activation.assurancePacketDigest,
    finalAssuranceCaseDigest: smoke.finalAssuranceCaseDigest,
    finalLineageGraphDigest: smoke.finalLineageGraphDigest,
    noTargetSystemCall: true,
    noIdentityProviderCall: true,
    noAccessChange: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    canAdmit: false,
    productionReady: false,
  });
}

export function runGoldenAuthorityChangeRuntimeSmoke(
  suite: GoldenAuthorityChangeShadowFixtureSuite = createGoldenAuthorityChangeShadowFixtureSuite(),
  projection: GoldenAuthorityChangePolicyFoundryProjection =
    createGoldenAuthorityChangePolicyFoundryProjection(suite),
): GoldenAuthorityChangeRuntimeSmokeResult {
  assertProjectionMatchesSuite(suite, projection);
  const smokeResults = Object.freeze(
    suite.fixtures.map((_, index) => runScenarioSmoke(suite, index)),
  );
  const scenarioResults = Object.freeze(smokeResults.map(scenarioResult));
  const phaseDigests = Object.freeze(smokeResults.map((smoke) => smoke.digest));
  const payload = {
    version: GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION,
    step: 'A03',
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
    noIdentityProviderCall: true,
    noAccessChange: true,
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
    rawIdentityAttributesRead: false,
    rawIdentityAttributesStored: false,
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

export function goldenAuthorityChangeRuntimeSmokeDescriptor():
  GoldenAuthorityChangeRuntimeSmokeDescriptor {
  return Object.freeze({
    version: GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION,
    step: 'A03',
    sourceFixtureSuiteVersion: GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION,
    sourcePolicyFoundryProjectionVersion:
      GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_PROJECTION_VERSION,
    shadowRuntimeFixtureReplaySmokeVersion: SHADOW_RUNTIME_FIXTURE_REPLAY_SMOKE_VERSION,
    scenarioCount: 8,
    runsA01FixturesThroughR02ToR07: true,
    executionMode: 'shadow-only',
    fixtureOnly: true,
    deterministicReplay: true,
    noTargetSystemCall: true,
    noIdentityProviderCall: true,
    noAccessChange: true,
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
    rawIdentityAttributesRead: false,
    rawIdentityAttributesStored: false,
    productionReady: false,
  });
}
