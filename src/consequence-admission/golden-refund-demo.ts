import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenRefundEngineVisibilityReport,
  GOLDEN_REFUND_ENGINE_VISIBILITY_VERSION,
  renderGoldenRefundEngineVisibilityMarkdown,
  type GoldenRefundEngineVisibilityReport,
} from './golden-refund-engine-visibility.js';
import {
  createGoldenRefundPilotReadinessProbe,
  GOLDEN_REFUND_PILOT_READINESS_PROBE_VERSION,
  type GoldenRefundPilotReadinessProbeResult,
} from './golden-refund-pilot-readiness-probe.js';
import {
  createGoldenRefundPolicyFoundryProjection,
  GOLDEN_REFUND_POLICY_FOUNDRY_PROJECTION_VERSION,
  type GoldenRefundPolicyFoundryNamedGap,
  type GoldenRefundPolicyFoundryProjection,
} from './golden-refund-policy-foundry-projection.js';
import {
  createGoldenRefundShadowFixtureSuite,
  GOLDEN_REFUND_SHADOW_FIXTURES_VERSION,
  type GoldenRefundShadowFixtureSuite,
} from './golden-refund-shadow-fixtures.js';
import {
  GOLDEN_REFUND_RUNTIME_SMOKE_VERSION,
  runGoldenRefundRuntimeSmoke,
  type GoldenRefundRuntimeSmokeResult,
} from './golden-refund-runtime-smoke.js';

export const GOLDEN_REFUND_DEMO_VERSION = 'attestor.golden-refund-demo.v1';

export interface GoldenRefundDemoSummary {
  readonly version: typeof GOLDEN_REFUND_DEMO_VERSION;
  readonly step: 'G07';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_REFUND_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_REFUND_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly sourcePolicyFoundryProjectionDigest: string;
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_REFUND_RUNTIME_SMOKE_VERSION;
  readonly sourceRuntimeSmokeDigest: string;
  readonly sourcePilotReadinessProbeVersion:
    typeof GOLDEN_REFUND_PILOT_READINESS_PROBE_VERSION;
  readonly sourcePilotReadinessProbeDigest: string;
  readonly sourceEngineVisibilityVersion: typeof GOLDEN_REFUND_ENGINE_VISIBILITY_VERSION;
  readonly sourceEngineVisibilityDigest: string;
  readonly actionSurface: 'refund_service.issue_refund';
  readonly domain: 'money-movement';
  readonly scenarioCount: 8;
  readonly scenarioNames: readonly string[];
  readonly candidateId: string;
  readonly candidateMode: 'review';
  readonly namedGaps: readonly GoldenRefundPolicyFoundryNamedGap[];
  readonly engineVisibility: GoldenRefundEngineVisibilityReport;
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

const GENERATED_AT = '2026-05-19T09:00:00.000Z';

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
  readonly suite: GoldenRefundShadowFixtureSuite;
  readonly projection: GoldenRefundPolicyFoundryProjection;
  readonly smoke: GoldenRefundRuntimeSmokeResult;
  readonly probe: GoldenRefundPilotReadinessProbeResult;
  readonly visibility: GoldenRefundEngineVisibilityReport;
}): Omit<GoldenRefundDemoSummary, 'canonical' | 'digest'> {
  return Object.freeze({
    version: GOLDEN_REFUND_DEMO_VERSION,
    step: 'G07',
    generatedAt: GENERATED_AT,
    sourceFixtureSuiteVersion: input.suite.version,
    sourceFixtureSuiteDigest: input.suite.digest,
    sourcePolicyFoundryProjectionVersion: input.projection.version,
    sourcePolicyFoundryProjectionDigest: input.projection.digest,
    sourceRuntimeSmokeVersion: input.smoke.version,
    sourceRuntimeSmokeDigest: input.smoke.digest,
    sourcePilotReadinessProbeVersion: input.probe.version,
    sourcePilotReadinessProbeDigest: input.probe.digest,
    sourceEngineVisibilityVersion: input.visibility.version,
    sourceEngineVisibilityDigest: input.visibility.digest,
    actionSurface: input.projection.actionSurface,
    domain: input.projection.domain,
    scenarioCount: input.suite.fixtureCount,
    scenarioNames: Object.freeze(input.suite.fixtures.map((fixture) => fixture.scenario)),
    candidateId: input.projection.reviewOnlyCandidate.candidateId,
    candidateMode: input.projection.reviewOnlyCandidate.proposedMode,
    namedGaps: input.projection.namedGaps,
    engineVisibility: input.visibility,
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

export function createGoldenRefundDemoSummary(): GoldenRefundDemoSummary {
  const suite = createGoldenRefundShadowFixtureSuite();
  const projection = createGoldenRefundPolicyFoundryProjection(suite);
  const smoke = runGoldenRefundRuntimeSmoke(suite, projection);
  const probe = createGoldenRefundPilotReadinessProbe(smoke);
  const visibility = createGoldenRefundEngineVisibilityReport({
    suite,
    projection,
    smoke,
    determinismIterations: 10,
  });
  const payload = createSummaryPayload({ suite, projection, smoke, probe, visibility });
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

function gapList(gaps: readonly GoldenRefundPolicyFoundryNamedGap[]): string {
  return gaps.map((gap) =>
    `- ${gap.kind} (${gap.severity}) -> ${gap.scenario}`,
  ).join('\n');
}

export function renderGoldenRefundDemoMarkdown(
  summary: GoldenRefundDemoSummary = createGoldenRefundDemoSummary(),
): string {
  return `# Golden Path: Refund

Verdict: ${summary.readinessVerdict}

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
- engine visibility report: ${summary.sourceEngineVisibilityDigest}
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

${renderGoldenRefundEngineVisibilityMarkdown(summary.engineVisibility).trimEnd()}

## Plain-English Result

Attestor can run a synthetic AI refund shadow pilot end to end: it loads refund
fixtures, finds evidence and authority gaps, produces review-only candidate
material, runs the shadow runtime smoke chain, and emits a shadow-pilot
readiness verdict.

It does not execute refunds automatically.
`;
}

export function renderGoldenRefundDemoJson(
  summary: GoldenRefundDemoSummary = createGoldenRefundDemoSummary(),
): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}
