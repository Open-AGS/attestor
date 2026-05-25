import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenDataExportPilotReadinessProbe,
  GOLDEN_DATA_EXPORT_PILOT_READINESS_PROBE_VERSION,
  type GoldenDataExportPilotReadinessProbeResult,
} from './golden-data-export-pilot-readiness-probe.js';
import {
  createGoldenDataExportPolicyFoundryProjection,
  GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_PROJECTION_VERSION,
  type GoldenDataExportPolicyFoundryNamedGap,
  type GoldenDataExportPolicyFoundryProjection,
} from './golden-data-export-policy-foundry-projection.js';
import {
  createGoldenDataExportShadowFixtureSuite,
  GOLDEN_DATA_EXPORT_SHADOW_FIXTURES_VERSION,
  type GoldenDataExportShadowFixtureSuite,
} from './golden-data-export-shadow-fixtures.js';
import {
  GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION,
  runGoldenDataExportRuntimeSmoke,
  type GoldenDataExportRuntimeSmokeResult,
} from './golden-data-export-runtime-smoke.js';

export const GOLDEN_DATA_EXPORT_DEMO_VERSION =
  'attestor.golden-data-export-demo.v1';

export interface GoldenDataExportDemoSummary {
  readonly version: typeof GOLDEN_DATA_EXPORT_DEMO_VERSION;
  readonly step: 'D04';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_DATA_EXPORT_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_DATA_EXPORT_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly sourcePolicyFoundryProjectionDigest: string;
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION;
  readonly sourceRuntimeSmokeDigest: string;
  readonly sourcePilotReadinessProbeVersion:
    typeof GOLDEN_DATA_EXPORT_PILOT_READINESS_PROBE_VERSION;
  readonly sourcePilotReadinessProbeDigest: string;
  readonly actionSurface: 'data_movement.controlled_export';
  readonly domain: 'data-movement';
  readonly scenarioCount: 8;
  readonly scenarioNames: readonly string[];
  readonly candidateId: string;
  readonly candidateMode: 'review';
  readonly namedGaps: readonly GoldenDataExportPolicyFoundryNamedGap[];
  readonly readinessVerdict: 'ready-for-shadow-pilot' | 'not-ready';
  readonly readinessBlockers: readonly string[];
  readonly markdownPrimary: true;
  readonly jsonSecondary: true;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly noTargetSystemCall: true;
  readonly noAuditWrite: true;
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

const GENERATED_AT = '2026-05-25T11:00:00.000Z';

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

function createSummaryPayload(input: {
  readonly suite: GoldenDataExportShadowFixtureSuite;
  readonly projection: GoldenDataExportPolicyFoundryProjection;
  readonly smoke: GoldenDataExportRuntimeSmokeResult;
  readonly probe: GoldenDataExportPilotReadinessProbeResult;
}): Omit<GoldenDataExportDemoSummary, 'canonical' | 'digest'> {
  return Object.freeze({
    version: GOLDEN_DATA_EXPORT_DEMO_VERSION,
    step: 'D04',
    generatedAt: GENERATED_AT,
    sourceFixtureSuiteVersion: input.suite.version,
    sourceFixtureSuiteDigest: input.suite.digest,
    sourcePolicyFoundryProjectionVersion: input.projection.version,
    sourcePolicyFoundryProjectionDigest: input.projection.digest,
    sourceRuntimeSmokeVersion: input.smoke.version,
    sourceRuntimeSmokeDigest: input.smoke.digest,
    sourcePilotReadinessProbeVersion: input.probe.version,
    sourcePilotReadinessProbeDigest: input.probe.digest,
    actionSurface: input.projection.actionSurface,
    domain: input.projection.domain,
    scenarioCount: input.suite.fixtureCount,
    scenarioNames: Object.freeze(input.suite.fixtures.map((fixture) => fixture.scenario)),
    candidateId: input.projection.reviewOnlyCandidate.candidateId,
    candidateMode: input.projection.reviewOnlyCandidate.proposedMode,
    namedGaps: input.projection.namedGaps,
    readinessVerdict: input.probe.decision.verdict,
    readinessBlockers: input.probe.decision.blockers,
    markdownPrimary: true,
    jsonSecondary: true,
    shadowOnly: true,
    fixtureOnly: true,
    previewOnly: true,
    noTargetSystemCall: true,
    noAuditWrite: true,
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

export function createGoldenDataExportDemoSummary(): GoldenDataExportDemoSummary {
  const suite = createGoldenDataExportShadowFixtureSuite();
  const projection = createGoldenDataExportPolicyFoundryProjection(suite);
  const smoke = runGoldenDataExportRuntimeSmoke(suite, projection);
  const probe = createGoldenDataExportPilotReadinessProbe(smoke);
  const payload = createSummaryPayload({ suite, projection, smoke, probe });
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function bulletList(items: readonly string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none';
}

function gapList(gaps: readonly GoldenDataExportPolicyFoundryNamedGap[]): string {
  return gaps.map((gap) =>
    `- ${gap.kind} (${gap.severity}) -> ${gap.scenario}`,
  ).join('\n');
}

export function renderGoldenDataExportDemoMarkdown(
  summary: GoldenDataExportDemoSummary = createGoldenDataExportDemoSummary(),
): string {
  return `# Golden Path: Controlled Data Export

Verdict: ${summary.readinessVerdict}

## Business Contrast

Without Attestor in this repo path:

- no consequence boundary before the export/report action
- no digest-bound evidence, recipient, tenant, approval, or purpose trail
- no explicit no-claim boundary for warehouse execution

With Attestor in this repo path:

- ${summary.scenarioCount} synthetic Data Movement scenarios
- ${summary.namedGaps.length} named Foundry gaps
- ${summary.noTargetSystemCall ? '0' : 'non-zero'} target-system calls
- shadow-pilot readiness verdict: ${summary.readinessVerdict}

## What Ran

- action surface: ${summary.actionSurface}
- domain: ${summary.domain}
- scenarios: ${summary.scenarioCount}
- candidate mode: ${summary.candidateMode}
- output: Markdown primary, JSON secondary

## Scenario Coverage

${bulletList(summary.scenarioNames)}

## Foundry Gaps

${gapList(summary.namedGaps)}

## Runtime Evidence

- fixture suite: ${summary.sourceFixtureSuiteDigest}
- Policy Foundry projection: ${summary.sourcePolicyFoundryProjectionDigest}
- runtime smoke: ${summary.sourceRuntimeSmokeDigest}
- pilot readiness probe: ${summary.sourcePilotReadinessProbeDigest}
- demo digest: ${summary.digest}

## Readiness

- verdict: ${summary.readinessVerdict}
- blockers:
${bulletList(summary.readinessBlockers)}

## Safety Boundary

- shadow only: ${summary.shadowOnly}
- fixture only: ${summary.fixtureOnly}
- preview only: ${summary.previewOnly}
- target-system calls: ${summary.noTargetSystemCall ? 'none' : 'present'}
- audit writes: ${summary.noAuditWrite ? 'none' : 'present'}
- policy activation: ${summary.noPolicyActivation ? 'none' : 'present'}
- learning/training activation: ${summary.noLearningActivation && summary.noTrainingActivation ? 'none' : 'present'}
- can admit: ${summary.canAdmit}
- production ready: ${summary.productionReady}

## Plain-English Result

Attestor can run a synthetic Data Movement shadow pilot end to end: it loads
controlled export/report fixtures, finds recipient, field, tenant, approval, and
purpose gaps, produces review-only candidate material, runs the shadow runtime
smoke chain, and emits a shadow-pilot readiness verdict.

It does not execute warehouse queries, export rows, call Snowflake or
Databricks, or activate policies automatically.
`;
}

export function renderGoldenDataExportDemoJson(
  summary: GoldenDataExportDemoSummary = createGoldenDataExportDemoSummary(),
): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}
