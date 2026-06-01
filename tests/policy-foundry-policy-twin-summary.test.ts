import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGenericAdmissionEnvelope,
  createPolicyFoundryCandidateRegistry,
  createPolicyFoundryCounterexampleLedger,
  createPolicyFoundryPolicyTwinSummary,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  evaluatePolicyFoundryReadiness,
  evaluatePolicyFoundryRedTeamReplay,
  policyFoundryPolicyTwinSummaryDescriptor,
  type PolicyFoundryRegisteredCandidate,
  type ShadowAdmissionEvent,
  type ShadowPolicyDiscoveryCandidate,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function event(input: {
  readonly actor: string;
  readonly requestId?: string | null;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
  readonly occurredAt: string;
  readonly humanOutcome?: 'not-reviewed' | 'approved' | 'rejected';
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: input.actor,
      action: 'rotate_secret',
      domain: 'system-operation',
      downstreamSystem: 'secret-manager',
      requestedAt: input.occurredAt,
      decidedAt: input.occurredAt,
      requestId: input.requestId ?? `request:${input.actor}:${input.occurredAt}`,
      policyRef: input.policyRef === undefined ? 'policy:ops:v1' : input.policyRef,
      evidenceRefs: input.evidenceRefs ?? ['change:approved'],
      recipient: 'raw_recipient_must_not_escape',
      authoritySources: [
        {
          sourceKind: 'authority-record',
          claimKind: 'authorization',
          sourceRef: `authority:${input.actor}`,
          trustClass: 'trusted-authority',
          evidenceDigest: `sha256:authority-${input.actor}`,
        },
      ],
      observedFeatures: input.observedFeatures ?? { adapterReady: true },
      observedFeatureOrigins: {
        adapterReady: 'trusted-adapter',
      },
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: input.humanOutcome === 'rejected' ? 'blocked' : 'proceeded',
    humanOutcome: input.humanOutcome ?? 'approved',
    observedFeatures: {
      secretMarker: 'raw_feature_must_not_escape',
      privateThreshold: 'threshold_must_not_escape',
      ...(input.observedFeatures ?? { adapterReady: true }),
    },
  });
}

function candidateContext(events: readonly ShadowAdmissionEvent[]): {
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly registeredCandidate: PolicyFoundryRegisteredCandidate;
  readonly report: ReturnType<typeof createShadowPolicySimulationReport>;
} {
  const report = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-13T03:00:00.000Z',
    minimumPromotionEvents: 5,
  });
  const bundle = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-13T03:01:00.000Z',
  });
  const registry = createPolicyFoundryCandidateRegistry({
    candidates: bundle,
    generatedAt: '2026-05-13T03:02:00.000Z',
  });
  const candidate = bundle.candidates.find((item) =>
    item.actionSurface === 'secret-manager.rotate_secret'
  );
  assert.ok(candidate, 'expected test candidate');
  const registeredCandidate = registry.candidates.find((item) =>
    item.candidateId === candidate.candidateId
  );
  assert.ok(registeredCandidate, 'expected registered candidate');
  return { candidate, registeredCandidate, report };
}

function cleanEvents(): readonly ShadowAdmissionEvent[] {
  return Array.from({ length: 24 }, (_, index) =>
    event({
      actor: `ops-agent-${index % 4}`,
      occurredAt: `2026-05-13T03:${String(index).padStart(2, '0')}:00.000Z`,
      humanOutcome: index % 4 === 0 ? 'approved' : 'not-reviewed',
    }),
  );
}

function testCleanPolicyTwinSummaryIsRolloutCandidate(): void {
  const events = cleanEvents();
  const { candidate, registeredCandidate, report } = candidateContext(events);
  const replay = evaluatePolicyFoundryRedTeamReplay({
    candidate,
    report,
    events,
    tenantId: 'tenant_policy_foundry',
    generatedAt: '2026-05-13T03:03:00.000Z',
  });
  const readiness = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    customerApproved: true,
    tenantBoundaryProven: true,
    redTeamReplayStatus: replay.status,
    generatedAt: '2026-05-13T03:04:00.000Z',
  });
  const ledger = createPolicyFoundryCounterexampleLedger({
    candidate,
    registeredCandidate,
    readiness,
    redTeamReplay: replay,
    events,
    generatedAt: '2026-05-13T03:05:00.000Z',
  });
  const summary = createPolicyFoundryPolicyTwinSummary({
    candidate,
    report,
    readiness,
    counterexampleLedger: ledger,
    generatedAt: '2026-05-13T03:06:00.000Z',
  });
  const serialized = JSON.stringify(summary);

  equal(summary.version, 'attestor.policy-foundry-policy-twin-summary.v1', 'Policy Twin summary: version is explicit');
  equal(summary.status, 'rollout-candidate', 'Policy Twin summary: clean approved sample is rollout candidate');
  equal(summary.recommendedRolloutStep, 'scoped-enforce-low-risk', 'Policy Twin summary: rollout stays scoped');
  equal(summary.eventCount, 24, 'Policy Twin summary: event count is retained');
  equal(summary.decisionImpact.admitCount, 24, 'Policy Twin summary: admits are counted');
  equal(summary.decisionImpact.reviewCount, 0, 'Policy Twin summary: reviews are counted');
  equal(summary.decisionImpact.blockCount, 0, 'Policy Twin summary: blocks are counted');
  equal(summary.reviewLoadImpact.manualReviewBaselineCount, 24, 'Policy Twin summary: baseline is manual review everything');
  equal(summary.reviewLoadImpact.simulatedReviewCount, 0, 'Policy Twin summary: simulated review count is retained');
  equal(summary.reviewLoadImpact.reviewLoadDeltaCount, -24, 'Policy Twin summary: review-load delta is explicit');
  equal(summary.reviewLoadImpact.reviewLoadReductionRate, 1, 'Policy Twin summary: review-load reduction rate is explicit');
  equal(summary.gapCounts.amountScope, 0, 'Policy Twin summary: amount scope gaps are retained');
  equal(summary.gapCounts.recipientScope, 0, 'Policy Twin summary: recipient scope gaps are retained');
  equal(summary.gapCounts.dataScope, 0, 'Policy Twin summary: data scope gaps are retained');
  equal(summary.gapCounts.customDomain, 0, 'Policy Twin summary: custom-domain gaps are retained');
  equal(summary.promotionBlocked, false, 'Policy Twin summary: clean ledger does not block promotion');
  equal(summary.approvalRequired, true, 'Policy Twin summary: approval remains required');
  equal(summary.autoEnforce, false, 'Policy Twin summary: auto enforce is false');
  equal(summary.productionReady, false, 'Policy Twin summary: production readiness is not claimed');
  equal(summary.policyTwinEvidenceOnly, true, 'Policy Twin summary: evidence-only limitation is explicit');
  ok(summary.digest.startsWith('sha256:'), 'Policy Twin summary: digest is generated');
  excludes(serialized, /ops-agent-|raw_recipient_must_not_escape|raw_feature_must_not_escape|threshold_must_not_escape/iu, 'Policy Twin summary: serialized output excludes raw actor, recipient, feature, and threshold markers');
}

function testRiskyPolicyTwinSummaryIsReviewOnly(): void {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: 'single-operator-agent',
      requestId: index < 8 ? 'duplicate-request' : `request:${index}`,
      policyRef: null,
      evidenceRefs: [],
      observedFeatures: {
        highRisk: true,
        adapterReady: false,
      },
      occurredAt: `2026-05-13T04:${String(index).padStart(2, '0')}:00.000Z`,
      humanOutcome: index === 0 ? 'rejected' : 'approved',
    }),
  );
  const { candidate, registeredCandidate, report } = candidateContext(events);
  const replay = evaluatePolicyFoundryRedTeamReplay({
    candidate,
    report,
    events,
    tenantId: 'tenant_policy_foundry',
    generatedAt: '2026-05-13T04:30:00.000Z',
  });
  const readiness = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    customerApproved: true,
    tenantBoundaryProven: true,
    redTeamReplayStatus: replay.status,
    generatedAt: '2026-05-13T04:31:00.000Z',
  });
  const ledger = createPolicyFoundryCounterexampleLedger({
    candidate,
    registeredCandidate,
    readiness,
    redTeamReplay: replay,
    events,
    generatedAt: '2026-05-13T04:32:00.000Z',
  });
  const summary = createPolicyFoundryPolicyTwinSummary({
    candidate,
    report,
    readiness,
    counterexampleLedger: ledger,
    generatedAt: '2026-05-13T04:33:00.000Z',
  });

  equal(summary.status, 'review-only', 'Policy Twin summary: risky sample is review-only');
  equal(summary.recommendedRolloutStep, 'review-required', 'Policy Twin summary: risky rollout stays review-required');
  equal(summary.promotionBlocked, true, 'Policy Twin summary: promotion block is retained');
  ok(summary.counterexampleCount > 0, 'Policy Twin summary: counterexample count is retained');
  ok(summary.highRiskAutoAdmitCount > 0, 'Policy Twin summary: high-risk auto-admits are retained');
  ok(summary.noGoReasons.includes('counterexamples-present'), 'Policy Twin summary: counterexample no-go is retained');
  ok(summary.noGoReasons.includes('missing-evidence-coverage'), 'Policy Twin summary: missing evidence no-go is retained');
  ok(summary.noGoReasons.includes('replay-duplicate-pressure'), 'Policy Twin summary: replay no-go is retained');
}

function testMissingReportIsNotEnoughEvidence(): void {
  const summary = createPolicyFoundryPolicyTwinSummary({
    candidate: null,
    report: null,
    generatedAt: '2026-05-13T05:00:00.000Z',
  });

  equal(summary.status, 'not-enough-evidence', 'Policy Twin summary: missing report is not enough evidence');
  equal(summary.recommendedRolloutStep, 'observe-only', 'Policy Twin summary: missing report stays observe-only');
  equal(summary.eventCount, 0, 'Policy Twin summary: missing report has zero events');
  equal(summary.sourceReportDigest, null, 'Policy Twin summary: missing report has no digest');
}

function testDescriptorDocsAndPackageScriptStayAligned(): void {
  const descriptor = policyFoundryPolicyTwinSummaryDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-policy-twin-summary.v1', 'Policy Twin summary descriptor: version is explicit');
  equal(descriptor.autoEnforce, false, 'Policy Twin summary descriptor: auto enforce is false');
  equal(descriptor.policyTwinEvidenceOnly, true, 'Policy Twin summary descriptor: evidence-only limitation is explicit');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-policy-twin-summary', 'Policy Twin summary descriptor: data minimization surface is explicit');
  includes(doc, 'src/consequence-admission/policy-foundry-policy-twin-summary.ts', 'Policy Foundry docs: Policy Twin summary contract is named');
  includes(doc, 'test:policy-foundry-policy-twin-summary', 'Policy Foundry docs: Policy Twin summary test command is named');
  includes(tracker, 'Step 06', 'Deepening tracker: Step 06 is present');
  includes(tracker, 'Policy Twin v2 Summary', 'Deepening tracker: Policy Twin summary step is named');
  includes(tracker, 'attestor.policy-foundry-policy-twin-summary.v1', 'Deepening tracker: Policy Twin summary version is named');
  equal(
    pkg.scripts['test:policy-foundry-policy-twin-summary'],
    'tsx tests/policy-foundry-policy-twin-summary.test.ts',
    'Package: Policy Twin summary test is exposed',
  );
}

try {
  testCleanPolicyTwinSummaryIsRolloutCandidate();
  testRiskyPolicyTwinSummaryIsReviewOnly();
  testMissingReportIsNotEnoughEvidence();
  testDescriptorDocsAndPackageScriptStayAligned();
  console.log(`Policy Foundry Policy Twin summary tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry Policy Twin summary tests failed:', error);
  process.exitCode = 1;
}
