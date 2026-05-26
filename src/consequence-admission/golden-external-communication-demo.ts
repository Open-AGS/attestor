import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenExternalCommunicationPilotReadinessProbe,
  GOLDEN_EXTERNAL_COMMUNICATION_PILOT_READINESS_PROBE_VERSION,
  type GoldenExternalCommunicationPilotReadinessProbeResult,
} from './golden-external-communication-pilot-readiness-probe.js';
import {
  createGoldenExternalCommunicationPolicyFoundryProjection,
  GOLDEN_EXTERNAL_COMMUNICATION_POLICY_FOUNDRY_PROJECTION_VERSION,
  type GoldenExternalCommunicationPolicyFoundryNamedGap,
  type GoldenExternalCommunicationPolicyFoundryProjection,
} from './golden-external-communication-policy-foundry-projection.js';
import {
  createGoldenExternalCommunicationShadowFixtureSuite,
  GOLDEN_EXTERNAL_COMMUNICATION_SHADOW_FIXTURES_VERSION,
  type GoldenExternalCommunicationShadowFixtureSuite,
} from './golden-external-communication-shadow-fixtures.js';
import {
  GOLDEN_EXTERNAL_COMMUNICATION_RUNTIME_SMOKE_VERSION,
  runGoldenExternalCommunicationRuntimeSmoke,
  type GoldenExternalCommunicationRuntimeSmokeResult,
} from './golden-external-communication-runtime-smoke.js';

export const GOLDEN_EXTERNAL_COMMUNICATION_DEMO_VERSION =
  'attestor.golden-external-communication-demo.v1';

export interface GoldenExternalCommunicationDemoSummary {
  readonly version: typeof GOLDEN_EXTERNAL_COMMUNICATION_DEMO_VERSION;
  readonly step: 'E04';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_EXTERNAL_COMMUNICATION_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_EXTERNAL_COMMUNICATION_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly sourcePolicyFoundryProjectionDigest: string;
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_EXTERNAL_COMMUNICATION_RUNTIME_SMOKE_VERSION;
  readonly sourceRuntimeSmokeDigest: string;
  readonly sourcePilotReadinessProbeVersion:
    typeof GOLDEN_EXTERNAL_COMMUNICATION_PILOT_READINESS_PROBE_VERSION;
  readonly sourcePilotReadinessProbeDigest: string;
  readonly actionSurface: 'external_communication.customer_message';
  readonly domain: 'external-communication';
  readonly scenarioCount: 8;
  readonly scenarioNames: readonly string[];
  readonly candidateId: string;
  readonly candidateMode: 'review';
  readonly namedGaps: readonly GoldenExternalCommunicationPolicyFoundryNamedGap[];
  readonly readinessVerdict: 'ready-for-shadow-pilot' | 'not-ready';
  readonly readinessBlockers: readonly string[];
  readonly markdownPrimary: true;
  readonly jsonSecondary: true;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly noTargetSystemCall: true;
  readonly noMessageDelivery: true;
  readonly noProviderCall: true;
  readonly noCrmOrTicketingCall: true;
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
  readonly rawMessageBodyRead: false;
  readonly rawMessageBodyStored: false;
  readonly rawRecipientIdentifiersRead: false;
  readonly rawRecipientIdentifiersStored: false;
  readonly rawCustomerIdentifiersRead: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

const GENERATED_AT = '2026-05-26T11:00:00.000Z';

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
  readonly suite: GoldenExternalCommunicationShadowFixtureSuite;
  readonly projection: GoldenExternalCommunicationPolicyFoundryProjection;
  readonly smoke: GoldenExternalCommunicationRuntimeSmokeResult;
  readonly probe: GoldenExternalCommunicationPilotReadinessProbeResult;
}): Omit<GoldenExternalCommunicationDemoSummary, 'canonical' | 'digest'> {
  return Object.freeze({
    version: GOLDEN_EXTERNAL_COMMUNICATION_DEMO_VERSION,
    step: 'E04',
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
    noMessageDelivery: true,
    noProviderCall: true,
    noCrmOrTicketingCall: true,
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
    rawMessageBodyRead: false,
    rawMessageBodyStored: false,
    rawRecipientIdentifiersRead: false,
    rawRecipientIdentifiersStored: false,
    rawCustomerIdentifiersRead: false,
    rawCustomerIdentifiersStored: false,
    productionReady: false,
  });
}

export function createGoldenExternalCommunicationDemoSummary():
GoldenExternalCommunicationDemoSummary {
  const suite = createGoldenExternalCommunicationShadowFixtureSuite();
  const projection = createGoldenExternalCommunicationPolicyFoundryProjection(suite);
  const smoke = runGoldenExternalCommunicationRuntimeSmoke(suite, projection);
  const probe = createGoldenExternalCommunicationPilotReadinessProbe(smoke);
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

function gapList(gaps: readonly GoldenExternalCommunicationPolicyFoundryNamedGap[]): string {
  return gaps.map((gap) =>
    `- ${gap.kind} (${gap.severity}) -> ${gap.scenario}`,
  ).join('\n');
}

export function renderGoldenExternalCommunicationDemoMarkdown(
  summary: GoldenExternalCommunicationDemoSummary =
    createGoldenExternalCommunicationDemoSummary(),
): string {
  return `# Golden Path: External Communication

Verdict: ${summary.readinessVerdict}

## Business Contrast

Without Attestor in this repo path:

- no consequence boundary before a customer-facing send or public message
- no digest-bound recipient, claim, authority, approval, policy, or replay trail
- no explicit no-claim boundary for email, SMS, ticketing, CRM, or provider execution

With Attestor in this repo path:

- ${summary.scenarioCount} synthetic External Communication scenarios
- ${summary.namedGaps.length} named Foundry gaps
- ${summary.noMessageDelivery ? '0' : 'non-zero'} message deliveries
- ${summary.noProviderCall ? '0' : 'non-zero'} provider calls
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
- message delivery: ${summary.noMessageDelivery ? 'none' : 'present'}
- provider calls: ${summary.noProviderCall ? 'none' : 'present'}
- CRM/ticketing calls: ${summary.noCrmOrTicketingCall ? 'none' : 'present'}
- audit writes: ${summary.noAuditWrite ? 'none' : 'present'}
- policy activation: ${summary.noPolicyActivation ? 'none' : 'present'}
- learning/training activation: ${summary.noLearningActivation && summary.noTrainingActivation ? 'none' : 'present'}
- can admit: ${summary.canAdmit}
- production ready: ${summary.productionReady}

## Plain-English Result

Attestor can run a synthetic External Communication shadow pilot end to end:
it loads customer-message fixtures, finds promise, legal-claim, recipient,
public-overclaim, commercial-email, instruction-like-evidence, and replay gaps,
produces review-only candidate material, runs the shadow runtime smoke chain,
and emits a shadow-pilot readiness verdict.

It does not send email, SMS, support replies, public posts, or legal notices,
does not call SendGrid, Mailgun, a CRM, a ticketing system, or a social
platform, and does not activate policies automatically.
`;
}

export function renderGoldenExternalCommunicationDemoJson(
  summary: GoldenExternalCommunicationDemoSummary =
    createGoldenExternalCommunicationDemoSummary(),
): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}
