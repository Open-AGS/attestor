import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenAuthorityChangePilotReadinessProbe,
  GOLDEN_AUTHORITY_CHANGE_PILOT_READINESS_PROBE_VERSION,
  type GoldenAuthorityChangePilotReadinessProbeResult,
} from './golden-authority-change-pilot-readiness-probe.js';
import {
  createGoldenAuthorityChangePolicyFoundryProjection,
  GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_PROJECTION_VERSION,
  type GoldenAuthorityChangePolicyFoundryNamedGap,
  type GoldenAuthorityChangePolicyFoundryProjection,
} from './golden-authority-change-policy-foundry-projection.js';
import {
  createGoldenAuthorityChangeShadowFixtureSuite,
  GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION,
  type GoldenAuthorityChangeShadowFixtureSuite,
} from './golden-authority-change-shadow-fixtures.js';
import {
  GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION,
  runGoldenAuthorityChangeRuntimeSmoke,
  type GoldenAuthorityChangeRuntimeSmokeResult,
} from './golden-authority-change-runtime-smoke.js';

export const GOLDEN_AUTHORITY_CHANGE_DEMO_VERSION =
  'attestor.golden-authority-change-demo.v1';

export interface GoldenAuthorityChangeDemoSummary {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_DEMO_VERSION;
  readonly step: 'A04';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_AUTHORITY_CHANGE_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_AUTHORITY_CHANGE_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly sourcePolicyFoundryProjectionDigest: string;
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION;
  readonly sourceRuntimeSmokeDigest: string;
  readonly sourcePilotReadinessProbeVersion:
    typeof GOLDEN_AUTHORITY_CHANGE_PILOT_READINESS_PROBE_VERSION;
  readonly sourcePilotReadinessProbeDigest: string;
  readonly actionSurface: 'authority_change.identity_workflow';
  readonly domain: 'authority-change';
  readonly scenarioCount: 8;
  readonly scenarioNames: readonly string[];
  readonly candidateId: string;
  readonly candidateMode: 'review';
  readonly namedGaps: readonly GoldenAuthorityChangePolicyFoundryNamedGap[];
  readonly readinessVerdict: 'ready-for-shadow-pilot' | 'not-ready';
  readonly readinessBlockers: readonly string[];
  readonly markdownPrimary: true;
  readonly jsonSecondary: true;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly noTargetSystemCall: true;
  readonly noIdentityProviderCall: true;
  readonly noAccessChange: true;
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
  readonly rawIdentityAttributesRead: false;
  readonly rawIdentityAttributesStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

const GENERATED_AT = '2026-05-25T11:45:00.000Z';

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
  readonly suite: GoldenAuthorityChangeShadowFixtureSuite;
  readonly projection: GoldenAuthorityChangePolicyFoundryProjection;
  readonly smoke: GoldenAuthorityChangeRuntimeSmokeResult;
  readonly probe: GoldenAuthorityChangePilotReadinessProbeResult;
}): Omit<GoldenAuthorityChangeDemoSummary, 'canonical' | 'digest'> {
  return Object.freeze({
    version: GOLDEN_AUTHORITY_CHANGE_DEMO_VERSION,
    step: 'A04',
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
    noIdentityProviderCall: true,
    noAccessChange: true,
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
    rawIdentityAttributesRead: false,
    rawIdentityAttributesStored: false,
    productionReady: false,
  });
}

export function createGoldenAuthorityChangeDemoSummary(): GoldenAuthorityChangeDemoSummary {
  const suite = createGoldenAuthorityChangeShadowFixtureSuite();
  const projection = createGoldenAuthorityChangePolicyFoundryProjection(suite);
  const smoke = runGoldenAuthorityChangeRuntimeSmoke(suite, projection);
  const probe = createGoldenAuthorityChangePilotReadinessProbe(smoke);
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

function gapList(gaps: readonly GoldenAuthorityChangePolicyFoundryNamedGap[]): string {
  return gaps.map((gap) =>
    `- ${gap.kind} (${gap.severity}) -> ${gap.scenario}`,
  ).join('\n');
}

export function renderGoldenAuthorityChangeDemoMarkdown(
  summary: GoldenAuthorityChangeDemoSummary = createGoldenAuthorityChangeDemoSummary(),
): string {
  return `# Golden Path: Authority Change

Verdict: ${summary.readinessVerdict}

## Business Contrast

Without Attestor in this repo path:

- no consequence boundary before the identity or access-change action
- no digest-bound subject, resource, permission, approval, tenant, or replay trail
- no explicit no-claim boundary for identity-provider execution

With Attestor in this repo path:

- ${summary.scenarioCount} synthetic Authority Change scenarios
- ${summary.namedGaps.length} named Foundry gaps
- ${summary.noIdentityProviderCall ? '0' : 'non-zero'} identity-provider calls
- ${summary.noAccessChange ? '0' : 'non-zero'} access changes
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
- identity-provider calls: ${summary.noIdentityProviderCall ? 'none' : 'present'}
- access changes: ${summary.noAccessChange ? 'none' : 'present'}
- audit writes: ${summary.noAuditWrite ? 'none' : 'present'}
- policy activation: ${summary.noPolicyActivation ? 'none' : 'present'}
- learning/training activation: ${summary.noLearningActivation && summary.noTrainingActivation ? 'none' : 'present'}
- can admit: ${summary.canAdmit}
- production ready: ${summary.productionReady}

## Plain-English Result

Attestor can run a synthetic Authority Change shadow pilot end to end: it loads
identity/access-change fixtures, finds privilege, approval, tenant, delegation,
instruction-like evidence, and separation-of-duties gaps, produces review-only
candidate material, runs the shadow runtime smoke chain, and emits a
shadow-pilot readiness verdict.

It does not call Okta, Microsoft Entra, SailPoint, or any identity provider,
does not grant or revoke access, and does not activate policies automatically.
`;
}

export function renderGoldenAuthorityChangeDemoJson(
  summary: GoldenAuthorityChangeDemoSummary = createGoldenAuthorityChangeDemoSummary(),
): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}
