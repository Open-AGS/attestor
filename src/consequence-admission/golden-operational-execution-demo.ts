import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenOperationalExecutionPilotReadinessProbe,
  GOLDEN_OPERATIONAL_EXECUTION_PILOT_READINESS_PROBE_VERSION,
  type GoldenOperationalExecutionPilotReadinessProbeResult,
} from './golden-operational-execution-pilot-readiness-probe.js';
import {
  createGoldenOperationalExecutionPolicyFoundryProjection,
  GOLDEN_OPERATIONAL_EXECUTION_POLICY_FOUNDRY_PROJECTION_VERSION,
  type GoldenOperationalExecutionPolicyFoundryNamedGap,
  type GoldenOperationalExecutionPolicyFoundryProjection,
} from './golden-operational-execution-policy-foundry-projection.js';
import {
  GOLDEN_OPERATIONAL_EXECUTION_RUNTIME_SMOKE_VERSION,
  runGoldenOperationalExecutionRuntimeSmoke,
  type GoldenOperationalExecutionRuntimeSmokeResult,
} from './golden-operational-execution-runtime-smoke.js';
import {
  createGoldenOperationalExecutionShadowFixtureSuite,
  GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION,
  type GoldenOperationalExecutionShadowFixtureSuite,
} from './golden-operational-execution-shadow-fixtures.js';

export const GOLDEN_OPERATIONAL_EXECUTION_DEMO_VERSION =
  'attestor.golden-operational-execution-demo.v1';

export interface GoldenOperationalExecutionDemoSummary {
  readonly version: typeof GOLDEN_OPERATIONAL_EXECUTION_DEMO_VERSION;
  readonly step: 'O04';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_OPERATIONAL_EXECUTION_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly sourcePolicyFoundryProjectionDigest: string;
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_OPERATIONAL_EXECUTION_RUNTIME_SMOKE_VERSION;
  readonly sourceRuntimeSmokeDigest: string;
  readonly sourcePilotReadinessProbeVersion:
    typeof GOLDEN_OPERATIONAL_EXECUTION_PILOT_READINESS_PROBE_VERSION;
  readonly sourcePilotReadinessProbeDigest: string;
  readonly actionSurface: 'operational_execution.change_request';
  readonly domain: 'system-operation';
  readonly scenarioCount: 8;
  readonly scenarioNames: readonly string[];
  readonly candidateId: string;
  readonly candidateMode: 'review';
  readonly namedGaps: readonly GoldenOperationalExecutionPolicyFoundryNamedGap[];
  readonly readinessVerdict: 'ready-for-shadow-pilot' | 'not-ready';
  readonly readinessBlockers: readonly string[];
  readonly markdownPrimary: true;
  readonly jsonSecondary: true;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly deterministicReplay: true;
  readonly noTargetSystemCall: true;
  readonly noDeployment: true;
  readonly noInfrastructureChange: true;
  readonly noSecretManagerWrite: true;
  readonly noIncidentAutomationExecution: true;
  readonly noRunbookExecution: true;
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
  readonly rawDeploymentManifestRead: false;
  readonly rawDeploymentManifestStored: false;
  readonly rawTerraformPlanRead: false;
  readonly rawTerraformPlanStored: false;
  readonly rawSecretMaterialRead: false;
  readonly rawSecretMaterialStored: false;
  readonly rawRunbookTextRead: false;
  readonly rawRunbookTextStored: false;
  readonly rawCustomerIdentifiersRead: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

const GENERATED_AT = '2026-05-26T11:30:00.000Z';

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
  readonly suite: GoldenOperationalExecutionShadowFixtureSuite;
  readonly projection: GoldenOperationalExecutionPolicyFoundryProjection;
  readonly smoke: GoldenOperationalExecutionRuntimeSmokeResult;
  readonly probe: GoldenOperationalExecutionPilotReadinessProbeResult;
}): Omit<GoldenOperationalExecutionDemoSummary, 'canonical' | 'digest'> {
  return Object.freeze({
    version: GOLDEN_OPERATIONAL_EXECUTION_DEMO_VERSION,
    step: 'O04',
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
    deterministicReplay: true,
    noTargetSystemCall: true,
    noDeployment: true,
    noInfrastructureChange: true,
    noSecretManagerWrite: true,
    noIncidentAutomationExecution: true,
    noRunbookExecution: true,
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
    rawDeploymentManifestRead: false,
    rawDeploymentManifestStored: false,
    rawTerraformPlanRead: false,
    rawTerraformPlanStored: false,
    rawSecretMaterialRead: false,
    rawSecretMaterialStored: false,
    rawRunbookTextRead: false,
    rawRunbookTextStored: false,
    rawCustomerIdentifiersRead: false,
    rawCustomerIdentifiersStored: false,
    productionReady: false,
  });
}

export function createGoldenOperationalExecutionDemoSummary():
GoldenOperationalExecutionDemoSummary {
  const suite = createGoldenOperationalExecutionShadowFixtureSuite();
  const projection = createGoldenOperationalExecutionPolicyFoundryProjection(suite);
  const smoke = runGoldenOperationalExecutionRuntimeSmoke(suite, projection);
  const probe = createGoldenOperationalExecutionPilotReadinessProbe(smoke);
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

function gapList(gaps: readonly GoldenOperationalExecutionPolicyFoundryNamedGap[]): string {
  return gaps.map((gap) =>
    `- ${gap.kind} (${gap.severity}) -> ${gap.scenario}`,
  ).join('\n');
}

export function renderGoldenOperationalExecutionDemoMarkdown(
  summary: GoldenOperationalExecutionDemoSummary =
    createGoldenOperationalExecutionDemoSummary(),
): string {
  return `# Golden Path: Operational Execution

Verdict: ${summary.readinessVerdict}

## What This Shows

An AI agent can draft a deploy, rollback, secret rotation, infrastructure
change, or incident action. Attestor holds that proposed operation as structured
intent, checks the evidence and authority shape, replays it through a
shadow-only runtime path, and returns review material before anything touches a
cluster, Terraform workspace, secret manager, incident tool, runbook runner, or
deployment environment.

## Business Contrast

Without Attestor in this repo path:

- no consequence boundary before a live operational change
- no digest-bound rollback, dry-run, approval, incident, replay, or trace trail
- no explicit no-claim boundary between a rehearsal and a real deployment

With Attestor in this repo path:

- ${summary.scenarioCount} synthetic Operational Execution scenarios
- ${summary.namedGaps.length} named Foundry gaps
- ${summary.noDeployment ? '0' : 'non-zero'} deployments
- ${summary.noInfrastructureChange ? '0' : 'non-zero'} infrastructure changes
- ${summary.noSecretManagerWrite ? '0' : 'non-zero'} secret-manager writes
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
- deterministic replay: ${summary.deterministicReplay}
- target-system calls: ${summary.noTargetSystemCall ? 'none' : 'present'}
- deployments: ${summary.noDeployment ? 'none' : 'present'}
- infrastructure changes: ${summary.noInfrastructureChange ? 'none' : 'present'}
- secret-manager writes: ${summary.noSecretManagerWrite ? 'none' : 'present'}
- incident automation execution: ${summary.noIncidentAutomationExecution ? 'none' : 'present'}
- runbook execution: ${summary.noRunbookExecution ? 'none' : 'present'}
- provider calls: ${summary.noProviderCall ? 'none' : 'present'}
- audit writes: ${summary.noAuditWrite ? 'none' : 'present'}
- policy activation: ${summary.noPolicyActivation ? 'none' : 'present'}
- learning/training activation: ${summary.noLearningActivation && summary.noTrainingActivation ? 'none' : 'present'}
- can admit: ${summary.canAdmit}
- production ready: ${summary.productionReady}

## Plain-English Result

Attestor can run a synthetic Operational Execution shadow pilot end to end:
it loads deploy, rollback, secret-rotation, infrastructure-drift, incident,
runbook-instruction, and replay fixtures; turns them into review-only Policy
Foundry material; runs the shadow runtime smoke chain; and emits a shadow-pilot
readiness verdict with digest-bound evidence.

It does not deploy anything, apply Terraform, rotate a secret, execute a
runbook, call Kubernetes, call a cloud provider, call a CI/CD system, call an
incident automation tool, write an audit record, or activate policy.
`;
}

export function renderGoldenOperationalExecutionDemoJson(
  summary: GoldenOperationalExecutionDemoSummary =
    createGoldenOperationalExecutionDemoSummary(),
): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}
