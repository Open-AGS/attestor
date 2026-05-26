import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenProgrammableMoneyPilotReadinessProbe,
  GOLDEN_PROGRAMMABLE_MONEY_PILOT_READINESS_PROBE_VERSION,
  type GoldenProgrammableMoneyPilotReadinessProbeResult,
} from './golden-programmable-money-pilot-readiness-probe.js';
import {
  createGoldenProgrammableMoneyPolicyFoundryProjection,
  GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_PROJECTION_VERSION,
  type GoldenProgrammableMoneyPolicyFoundryNamedGap,
  type GoldenProgrammableMoneyPolicyFoundryProjection,
} from './golden-programmable-money-policy-foundry-projection.js';
import {
  GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION,
  runGoldenProgrammableMoneyRuntimeSmoke,
  type GoldenProgrammableMoneyRuntimeSmokeResult,
} from './golden-programmable-money-runtime-smoke.js';
import {
  createGoldenProgrammableMoneyShadowFixtureSuite,
  GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION,
  type GoldenProgrammableMoneyShadowFixtureSuite,
} from './golden-programmable-money-shadow-fixtures.js';

export const GOLDEN_PROGRAMMABLE_MONEY_DEMO_VERSION =
  'attestor.golden-programmable-money-demo.v1';

export interface GoldenProgrammableMoneyDemoSummary {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_DEMO_VERSION;
  readonly step: 'P04';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_PROGRAMMABLE_MONEY_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly sourcePolicyFoundryProjectionDigest: string;
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION;
  readonly sourceRuntimeSmokeDigest: string;
  readonly sourcePilotReadinessProbeVersion:
    typeof GOLDEN_PROGRAMMABLE_MONEY_PILOT_READINESS_PROBE_VERSION;
  readonly sourcePilotReadinessProbeDigest: string;
  readonly actionSurface: 'programmable_money.transaction_intent';
  readonly domain: 'programmable-money';
  readonly scenarioCount: 8;
  readonly scenarioNames: readonly string[];
  readonly candidateId: string;
  readonly candidateMode: 'review';
  readonly namedGaps: readonly GoldenProgrammableMoneyPolicyFoundryNamedGap[];
  readonly readinessVerdict: 'ready-for-shadow-pilot' | 'not-ready';
  readonly readinessBlockers: readonly string[];
  readonly markdownPrimary: true;
  readonly jsonSecondary: true;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
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

const GENERATED_AT = '2026-05-26T16:00:00.000Z';

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
  readonly suite: GoldenProgrammableMoneyShadowFixtureSuite;
  readonly projection: GoldenProgrammableMoneyPolicyFoundryProjection;
  readonly smoke: GoldenProgrammableMoneyRuntimeSmokeResult;
  readonly probe: GoldenProgrammableMoneyPilotReadinessProbeResult;
}): Omit<GoldenProgrammableMoneyDemoSummary, 'canonical' | 'digest'> {
  return Object.freeze({
    version: GOLDEN_PROGRAMMABLE_MONEY_DEMO_VERSION,
    step: 'P04',
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
  });
}

export function createGoldenProgrammableMoneyDemoSummary():
GoldenProgrammableMoneyDemoSummary {
  const suite = createGoldenProgrammableMoneyShadowFixtureSuite();
  const projection = createGoldenProgrammableMoneyPolicyFoundryProjection(suite);
  const smoke = runGoldenProgrammableMoneyRuntimeSmoke(suite, projection);
  const probe = createGoldenProgrammableMoneyPilotReadinessProbe(smoke);
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

function gapList(gaps: readonly GoldenProgrammableMoneyPolicyFoundryNamedGap[]): string {
  return gaps.map((gap) =>
    `- ${gap.kind} (${gap.severity}) -> ${gap.scenario}`,
  ).join('\n');
}

export function renderGoldenProgrammableMoneyDemoMarkdown(
  summary: GoldenProgrammableMoneyDemoSummary =
    createGoldenProgrammableMoneyDemoSummary(),
): string {
  return `# Golden Path: Programmable Money

Verdict: ${summary.readinessVerdict}

## What This Shows

An AI agent can prepare a Safe transfer, wallet approval, ERC-4337
UserOperation, delegated-EOA call, x402 payment, custody withdrawal, or intent
settlement. Attestor holds that proposed programmable-money action as
structured intent, checks the evidence and authority shape, replays it through
a shadow-only runtime path, and returns review material before anything calls a
wallet, signer, Safe, custody engine, bundler, facilitator, solver, chain, or
payment rail.

## Business Contrast

Without Attestor in this repo path:

- no consequence boundary before wallet-facing or payment-facing side effects
- no digest-bound policy, approval, adapter, preflight, replay, settlement, or receipt trail
- no explicit no-claim boundary between a rehearsal and a live money movement

With Attestor in this repo path:

- ${summary.scenarioCount} synthetic Programmable Money scenarios
- ${summary.namedGaps.length} named Foundry gaps
- ${summary.noWalletCall ? '0' : 'non-zero'} wallet calls
- ${summary.noSigning ? '0' : 'non-zero'} signatures
- ${summary.noBroadcast ? '0' : 'non-zero'} broadcasts
- ${summary.noCustodyCallback ? '0' : 'non-zero'} custody callbacks
- ${summary.noBundlerCall ? '0' : 'non-zero'} bundler calls
- ${summary.noFacilitatorCall ? '0' : 'non-zero'} facilitator calls
- ${summary.noSolverCall ? '0' : 'non-zero'} solver calls
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
- wallet calls: ${summary.noWalletCall ? 'none' : 'present'}
- signing: ${summary.noSigning ? 'none' : 'present'}
- broadcasts: ${summary.noBroadcast ? 'none' : 'present'}
- custody callbacks: ${summary.noCustodyCallback ? 'none' : 'present'}
- bundler calls: ${summary.noBundlerCall ? 'none' : 'present'}
- facilitator calls: ${summary.noFacilitatorCall ? 'none' : 'present'}
- solver calls: ${summary.noSolverCall ? 'none' : 'present'}
- provider calls: ${summary.noProviderCall ? 'none' : 'present'}
- audit writes: ${summary.noAuditWrite ? 'none' : 'present'}
- policy activation: ${summary.noPolicyActivation ? 'none' : 'present'}
- learning/training activation: ${summary.noLearningActivation && summary.noTrainingActivation ? 'none' : 'present'}
- can admit: ${summary.canAdmit}
- production ready: ${summary.productionReady}

## Plain-English Result

Attestor can run a synthetic Programmable Money shadow pilot end to end:
it loads Safe, approval, account-abstraction, delegated-EOA, x402, custody,
intent-settlement, and wallet-memo fixtures; turns them into review-only Policy
Foundry material; runs the shadow runtime smoke chain; and emits a shadow-pilot
readiness verdict with digest-bound evidence.

It does not call a wallet, sign, broadcast, submit a UserOperation, submit a
Safe transaction, answer a custody callback, call a bundler, call an x402
facilitator, call a solver, settle an intent, verify chain finality, write an
audit record, activate policy, or admit a real action.
`;
}

export function renderGoldenProgrammableMoneyDemoJson(
  summary: GoldenProgrammableMoneyDemoSummary =
    createGoldenProgrammableMoneyDemoSummary(),
): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}
