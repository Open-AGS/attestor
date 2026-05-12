import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createActionSurfaceOnboardingPacket,
  createGenericAdmissionEnvelope,
  createPolicyFoundryCoverageScore,
  createPolicyFoundryOnboardingSession,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  evaluateAttestorIntegrationModeReadiness,
  evaluatePolicyFoundryReadiness,
  evaluatePolicyFoundryRedTeamReplay,
  policyFoundryCoverageScoreDescriptor,
  type ShadowAdmissionEvent,
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
  readonly occurredAt: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly authorityRef?: string | null;
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
}): ShadowAdmissionEvent {
  const admission = createGenericAdmissionEnvelope({
    mode: 'observe',
    actor: input.actor,
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: input.occurredAt,
    decidedAt: input.occurredAt,
    requestId: `request:${input.actor}:${input.occurredAt}`,
    policyRef: input.policyRef === undefined ? 'policy:refund:v1' : input.policyRef,
    evidenceRefs: input.evidenceRefs ?? ['payment:captured'],
    authorityRef: input.authorityRef === undefined ? 'authority:support-lead' : input.authorityRef,
    observedFeatures: input.observedFeatures ?? {},
    recipient: 'raw_recipient_must_not_escape',
  });
  return createShadowAdmissionEvent({
    admission,
    occurredAt: input.occurredAt,
    downstreamOutcome: 'proceeded',
    humanOutcome: 'approved',
    observedFeatures: {
      secretMarker: 'rk_live_must_not_escape',
      ...(input.observedFeatures ?? {}),
    },
  });
}

function candidateFor(events: readonly ShadowAdmissionEvent[]) {
  const report = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-12T18:00:00.000Z',
    minimumPromotionEvents: 5,
  });
  const candidates = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-12T18:01:00.000Z',
  });
  const candidate = candidates.candidates.find((item) =>
    item.actionSurface === 'refund-service.issue_refund'
  ) ?? null;
  return { report, candidate };
}

function packetFor(
  events: readonly ShadowAdmissionEvent[],
  reviewedControls = true,
) {
  return createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-12T18:02:00.000Z',
    declarations: [
      {
        sourceKind: 'openapi',
        actionSurface: 'refund-service.issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        action: 'issue_refund',
        method: 'post',
        path: '/refunds',
        credentialPosture: reviewedControls ? 'gateway-held-secret' : 'agent-held-static-secret',
      },
    ],
    events,
    readinessOverrides: [
      {
        actionSurface: 'refund-service.issue_refund',
        credentialIsolation: reviewedControls ? 'gateway-held-secret' : 'agent-held-static-secret',
        signals: {
          admissionCallObserved: events.length > 0,
          shadowCaptureObserved: events.length > 0,
          downstreamContractBound: reviewedControls,
          verifierImplemented: reviewedControls,
          gatewayProxyConfigured: reviewedControls,
          presentationBindingImplemented: reviewedControls,
          replayProtectionImplemented: reviewedControls,
          idempotencyKeyRequired: reviewedControls,
          tenantBoundaryProven: reviewedControls,
          policySimulationAvailable: reviewedControls,
          customerApprovalRecorded: reviewedControls,
          redTeamReplayPassed: reviewedControls,
          generatedArtifactsReviewed: reviewedControls,
        },
      },
    ],
  });
}

function testEmptySessionScoresNoCoverage(): void {
  const session = createPolicyFoundryOnboardingSession({
    generatedAt: '2026-05-12T18:05:00.000Z',
    tenantId: 'tenant_raw_must_not_escape',
  });
  const score = createPolicyFoundryCoverageScore({
    generatedAt: '2026-05-12T18:06:00.000Z',
    session,
  });
  const serialized = JSON.stringify(score);

  equal(score.version, 'attestor.policy-foundry-coverage-score.v1', 'Coverage score: version is explicit');
  equal(score.status, 'no-coverage', 'Coverage score: empty session has no coverage');
  equal(score.score, 0, 'Coverage score: empty session scores zero');
  equal(score.surfaceCount, 1, 'Coverage score: empty session still returns a session-level surface');
  equal(score.approvalRequired, true, 'Coverage score: approval is required');
  equal(score.autoEnforce, false, 'Coverage score: auto enforcement is false');
  equal(score.productionReady, false, 'Coverage score: production readiness is not claimed');
  equal(score.activatesEnforcement, false, 'Coverage score: enforcement activation is false');
  equal(score.nonBypassableClaimAllowed, false, 'Coverage score: non-bypassable claim is false');
  equal(score.dataMinimizationSurfaceKind, 'policy-foundry-coverage-score', 'Coverage score: data minimization surface is explicit');
  ok(score.blockedDimensions.includes('shadow-traffic'), 'Coverage score: shadow traffic is blocked');
  ok(score.blockedDimensions.includes('verifier-or-gateway'), 'Coverage score: verifier/gateway is blocked');
  ok(score.digest.startsWith('sha256:'), 'Coverage score: digest is generated');
  excludes(serialized, /tenant_raw_must_not_escape|raw_recipient_must_not_escape|rk_live_must_not_escape/iu, 'Coverage score: serialized output excludes raw tenant and payload markers');
}

function testPartialCoverageKeepsControlsVisible(): void {
  const gapEvent = event({
    actor: 'support-agent-one',
    occurredAt: '2026-05-12T18:10:00.000Z',
    policyRef: null,
    evidenceRefs: [],
    authorityRef: null,
  });
  const packet = packetFor([gapEvent], false);
  const { report, candidate } = candidateFor([gapEvent]);
  const readiness = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events: [gapEvent],
    generatedAt: '2026-05-12T18:11:00.000Z',
    minimumSampleSize: 20,
    llmAuthoritySource: true,
  });
  const integration = packet.readinessResults[0]!;
  const session = createPolicyFoundryOnboardingSession({
    generatedAt: '2026-05-12T18:12:00.000Z',
    onboardingPacket: packet,
    readiness,
    integrationReadiness: [integration],
  });
  const score = createPolicyFoundryCoverageScore({
    generatedAt: '2026-05-12T18:13:00.000Z',
    session,
    onboardingPacket: packet,
    readiness,
    integrationReadiness: [integration],
  });
  const surface = score.surfaces[0]!;

  equal(score.status, 'needs-controls', 'Coverage score: partial setup needs controls');
  equal(surface.status, 'needs-controls', 'Coverage score: surface needs controls');
  ok(score.score > 0 && score.score < 100, 'Coverage score: partial setup has partial numeric score');
  ok(surface.missingDimensions.includes('policy-schema'), 'Coverage score: missing policy schema is visible');
  ok(surface.missingDimensions.includes('evidence-binding'), 'Coverage score: missing evidence binding is visible');
  ok(surface.missingDimensions.includes('authority-binding'), 'Coverage score: missing authority binding is visible');
  ok(surface.partialDimensions.includes('verifier-or-gateway'), 'Coverage score: verifier/gateway partial state is visible');
  ok(surface.missingDimensions.includes('credential-isolation'), 'Coverage score: direct static credentials are missing coverage');
  equal(surface.nonBypassableClaimAllowed, false, 'Coverage score: surface cannot claim non-bypassability');
  equal(score.sourceDigests.onboardingPacketDigest, packet.digest, 'Coverage score: onboarding packet digest is bound');
  equal(score.sourceDigests.readinessDigest, readiness.digest, 'Coverage score: readiness digest is bound');
}

function testCleanCoverageCanReachScopedRolloutCoverageReady(): void {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: `support-agent-${index % 4}`,
      occurredAt: `2026-05-12T19:${String(index).padStart(2, '0')}:00.000Z`,
    }),
  );
  const packet = packetFor(events, true);
  const { report, candidate } = candidateFor(events);
  const replay = evaluatePolicyFoundryRedTeamReplay({
    candidate,
    report,
    events,
    tenantId: events[0]?.tenantId ?? null,
    generatedAt: '2026-05-12T19:40:00.000Z',
  });
  const readiness = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    generatedAt: '2026-05-12T19:41:00.000Z',
    customerApproved: true,
    tenantBoundaryProven: true,
    redTeamReplayStatus: replay.status,
    minimumSampleSize: 20,
  });
  const integration = evaluateAttestorIntegrationModeReadiness({
    workflowId: 'refund-workflow',
    mode: 'gateway-proxy',
    credentialIsolation: 'gateway-held-secret',
    actionSurface: 'refund-service.issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    generatedAt: '2026-05-12T19:42:00.000Z',
    generatedArtifacts: [
      'gateway-proxy-config',
      'verifier-helper-config',
      'credential-isolation-plan',
      'policy-twin-backtest',
      'red-team-replay-fixture',
    ],
    signals: {
      admissionCallObserved: true,
      shadowCaptureObserved: true,
      downstreamContractBound: true,
      verifierImplemented: true,
      gatewayProxyConfigured: true,
      presentationBindingImplemented: true,
      replayProtectionImplemented: true,
      idempotencyKeyRequired: true,
      tenantBoundaryProven: true,
      policySimulationAvailable: true,
      customerApprovalRecorded: true,
      redTeamReplayPassed: true,
      generatedArtifactsReviewed: true,
    },
  });
  const session = createPolicyFoundryOnboardingSession({
    generatedAt: '2026-05-12T19:43:00.000Z',
    onboardingPacket: packet,
    readiness,
    redTeamReplay: replay,
    integrationReadiness: [integration],
  });
  const score = createPolicyFoundryCoverageScore({
    generatedAt: '2026-05-12T19:44:00.000Z',
    session,
    onboardingPacket: packet,
    readiness,
    redTeamReplay: replay,
    integrationReadiness: [integration],
  });
  const surface = score.surfaces[0]!;

  equal(score.status, 'scoped-rollout-coverage-ready', 'Coverage score: clean evidence reaches scoped rollout coverage ready');
  equal(score.score, 100, 'Coverage score: clean evidence scores 100');
  equal(score.coveredSurfaceCount, 1, 'Coverage score: one covered surface is counted');
  equal(score.missingDimensionCount, 0, 'Coverage score: no missing dimensions remain');
  equal(score.partialDimensionCount, 0, 'Coverage score: no partial dimensions remain');
  equal(surface.status, 'scoped-rollout-coverage-ready', 'Coverage score: surface is scoped rollout coverage ready');
  ok(surface.dimensions.every((dimension) => dimension.status === 'covered'), 'Coverage score: all dimensions are covered');
  equal(score.sourceDigests.redTeamReplayDigest, replay.digest, 'Coverage score: red-team replay digest is bound');
  equal(score.sourceDigests.integrationReadinessDigests[0], integration.digest, 'Coverage score: integration digest is bound');
  equal(score.activatesEnforcement, false, 'Coverage score: clean score still does not activate enforcement');
}

function testDescriptorDocsAndPackageScriptStayAligned(): void {
  const descriptor = policyFoundryCoverageScoreDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-coverage-score.v1', 'Coverage score descriptor: version is explicit');
  equal(descriptor.autoEnforce, false, 'Coverage score descriptor: auto enforce is false');
  equal(descriptor.activatesEnforcement, false, 'Coverage score descriptor: enforcement activation is false');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-coverage-score', 'Coverage score descriptor: data minimization surface is explicit');
  includes(doc, 'src/consequence-admission/policy-foundry-coverage-score.ts', 'Policy Foundry docs: coverage score contract is named');
  includes(doc, 'test:policy-foundry-coverage-score', 'Policy Foundry docs: coverage score test command is named');
  includes(tracker, 'Step 02', 'Deepening tracker: Step 02 is present');
  includes(tracker, 'Coverage Score v1', 'Deepening tracker: coverage score step is named');
  includes(tracker, 'attestor.policy-foundry-coverage-score.v1', 'Deepening tracker: coverage score version is named');
  equal(
    pkg.scripts['test:policy-foundry-coverage-score'],
    'tsx tests/policy-foundry-coverage-score.test.ts',
    'Package: coverage score test is exposed',
  );
}

try {
  testEmptySessionScoresNoCoverage();
  testPartialCoverageKeepsControlsVisible();
  testCleanCoverageCanReachScopedRolloutCoverageReady();
  testDescriptorDocsAndPackageScriptStayAligned();
  console.log(`Policy Foundry coverage score tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry coverage score tests failed:', error);
  process.exitCode = 1;
}
