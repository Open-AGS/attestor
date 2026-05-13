import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createActionSurfaceOnboardingPacket,
  createActionSurfaceOnboardingRedTeamFixtureBundle,
  createPolicyFoundryLiveDownstreamReplay,
  policyFoundryLiveDownstreamReplayDescriptor,
  type ActionSurfaceOnboardingRedTeamFixtureBundle,
  type PolicyFoundryAdversarialReplayObservedOutcome,
  type PolicyFoundryLiveDownstreamReplayObservation,
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

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function fixtureBundle(): ActionSurfaceOnboardingRedTeamFixtureBundle {
  const packet = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-13T12:00:00.000Z',
    declarations: [
      {
        sourceKind: 'openapi',
        actionSurface: 'refund-service.issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        action: 'issue_refund',
        method: 'post',
        path: '/refunds',
        credentialPosture: 'gateway-held-secret',
      },
    ],
  });
  return createActionSurfaceOnboardingRedTeamFixtureBundle({
    packet,
    generatedAt: '2026-05-13T12:01:00.000Z',
  });
}

function expectedAsPassingObservation(
  expected: 'block' | 'review-required' | 'hold',
): PolicyFoundryAdversarialReplayObservedOutcome {
  if (expected === 'block') return 'block';
  if (expected === 'review-required') return 'review-required';
  return 'hold';
}

function passingObservations(
  bundle: ActionSurfaceOnboardingRedTeamFixtureBundle,
): readonly PolicyFoundryLiveDownstreamReplayObservation[] {
  return bundle.cases.map((entry) => ({
    caseId: entry.caseId,
    observedOutcome: expectedAsPassingObservation(entry.expectedOutcome),
    observedAt: '2026-05-13T12:02:00.000Z',
    executionMode: 'gateway-proxy-sandbox',
    environment: 'sandbox',
    evidenceDigest: digest(`evidence:${entry.caseId}`),
    dryRunProofDigest: digest(`dry-run:${entry.caseId}`),
    downstreamReceiptDigest: digest(`receipt:${entry.caseId}`),
    reasonCodes: [`fixture:${entry.kind}`, 'dry-run:confirmed'],
    rawPayloadStored: false,
    downstreamMutationAttempted: false,
    credentialMaterialUsed: false,
    productionTrafficAttempted: false,
    dryRunConfirmed: true,
    sandboxBoundaryVerified: true,
    unapprovedNetworkEgress: false,
  }));
}

function testPassingSandboxReplayIsReviewEvidenceOnly(): void {
  const bundle = fixtureBundle();
  const report = createPolicyFoundryLiveDownstreamReplay({
    generatedAt: '2026-05-13T12:03:00.000Z',
    fixtureBundle: bundle,
    observations: passingObservations(bundle),
  });
  const serialized = JSON.stringify(report);

  equal(report.version, 'attestor.policy-foundry-live-downstream-replay.v1', 'Live downstream replay: version is stable');
  equal(report.status, 'passed', 'Live downstream replay: passing sandbox replay is marked passed');
  equal(report.fixtureBundleDigest, bundle.digest, 'Live downstream replay: fixture bundle digest is retained');
  equal(report.fixtureCaseCount, 12, 'Live downstream replay: fixture case count is retained');
  equal(report.observedCaseCount, 12, 'Live downstream replay: observed case count is retained');
  equal(report.liveDownstreamObservationCount, 12, 'Live downstream replay: live downstream observations are counted');
  equal(report.noGoReasons.length, 0, 'Live downstream replay: clean sandbox replay has no no-go');
  equal(report.approvalRequired, true, 'Live downstream replay: approval remains required');
  equal(report.autoEnforce, false, 'Live downstream replay: auto enforce is false');
  equal(report.rawPayloadStored, false, 'Live downstream replay: raw payload storage is false');
  equal(report.productionReady, false, 'Live downstream replay: production readiness is not claimed');
  equal(report.activatesEnforcement, false, 'Live downstream replay: enforcement activation is false');
  equal(report.dryRunRequired, true, 'Live downstream replay: dry-run proof is required');
  equal(report.sandboxOrStagingOnly, true, 'Live downstream replay: sandbox/staging boundary is explicit');
  equal(report.executesProductionTraffic, false, 'Live downstream replay: production traffic execution is false');
  equal(report.downstreamMutationAllowed, false, 'Live downstream replay: downstream mutation is forbidden');
  equal(report.credentialUseAllowed, false, 'Live downstream replay: credential use is forbidden');
  equal(report.reviewMaterialOnly, true, 'Live downstream replay: report is review material only');
  equal(report.dataMinimizationSurfaceKind, 'policy-foundry-live-downstream-replay', 'Live downstream replay: data minimization surface is explicit');
  ok(report.digest.startsWith('sha256:'), 'Live downstream replay: report digest is generated');
  excludes(serialized, /raw_prompt|sk_live|bearer |secret=/iu, 'Live downstream replay: serialized report excludes raw/secret markers');
}

function testUnsafeLiveReplayInputsFailClosed(): void {
  const bundle = fixtureBundle();
  const observations = passingObservations(bundle)
    .map((entry, index) => index === 0
      ? {
          ...entry,
          rawPayloadStored: true,
          downstreamMutationAttempted: true,
          credentialMaterialUsed: true,
          productionTrafficAttempted: true,
          dryRunConfirmed: false,
          sandboxBoundaryVerified: false,
          unapprovedNetworkEgress: true,
          evidenceDigest: 'not-a-digest',
          dryRunProofDigest: null,
          downstreamReceiptDigest: 'not-a-digest-either',
        }
      : entry);

  const report = createPolicyFoundryLiveDownstreamReplay({
    generatedAt: '2026-05-13T12:04:00.000Z',
    fixtureBundle: bundle,
    observations,
  });

  equal(report.status, 'failed', 'Live downstream replay: unsafe replay inputs fail');
  for (const reason of [
    'raw-payload-stored',
    'downstream-mutation-attempted',
    'credential-material-used',
    'production-traffic-attempted',
    'dry-run-proof-missing',
    'sandbox-boundary-unverified',
    'unapproved-network-egress',
    'invalid-evidence-digest',
  ] as const) {
    ok(report.noGoReasons.includes(reason), `Live downstream replay: ${reason} is a no-go`);
  }
  includes(
    report.nextSafeStep,
    'sandbox, staging, or ephemeral preview',
    'Live downstream replay: production traffic no-go has safe next step',
  );
}

function testUnexpectedAllowAndMissingCaseBlockRolloutReview(): void {
  const bundle = fixtureBundle();
  const observations = [...passingObservations(bundle)].slice(1);
  const blockerIndex = observations.findIndex((entry) => {
    const fixture = bundle.cases.find((candidate) => candidate.caseId === entry.caseId);
    return fixture?.expectedOutcome === 'block' && fixture.severity === 'blocker';
  });
  assert.notEqual(blockerIndex, -1, 'fixture bundle should contain a blocker case after the omitted first result');
  observations[blockerIndex] = {
    ...observations[blockerIndex],
    observedOutcome: 'proceed',
    reasonCodes: ['attempted:auto-promote', 'secret=must-drop'],
  };

  const report = createPolicyFoundryLiveDownstreamReplay({
    generatedAt: '2026-05-13T12:05:00.000Z',
    fixtureBundle: bundle,
    observations,
  });
  const failedCase = report.results.find((entry) => entry.status === 'failed');

  equal(report.status, 'failed', 'Live downstream replay: unexpected allow and missing result fail report');
  ok(report.noGoReasons.includes('missing-case-result'), 'Live downstream replay: missing case result is no-go');
  ok(report.noGoReasons.includes('unexpected-allow'), 'Live downstream replay: unexpected allow is no-go');
  ok(
    failedCase?.reasonCodes.includes('attempted:auto-promote'),
    'Live downstream replay: safe reason code is retained',
  );
  ok(
    failedCase?.reasonCodes.includes('secret=must-drop') === false,
    'Live downstream replay: unsafe reason code is dropped',
  );
}

function testDescriptorDocsAndPackageSurface(): void {
  const descriptor = policyFoundryLiveDownstreamReplayDescriptor();
  const docs = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const dataMinimizationDocs = readProjectFile('docs', '02-architecture', 'data-minimization-redaction-policy.md');
  const readme = readProjectFile('README.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.productionReady, false, 'Live downstream replay descriptor: production readiness is not claimed');
  equal(descriptor.downstreamMutationAllowed, false, 'Live downstream replay descriptor: downstream mutation is forbidden');
  equal(descriptor.credentialUseAllowed, false, 'Live downstream replay descriptor: credential use is forbidden');
  equal(descriptor.executesProductionTraffic, false, 'Live downstream replay descriptor: production traffic execution is false');
  equal(descriptor.dryRunRequired, true, 'Live downstream replay descriptor: dry-run proof is required');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-live-downstream-replay', 'Live downstream replay descriptor: data minimization surface is stable');
  includes(docs, 'src/consequence-admission/policy-foundry-live-downstream-replay.ts', 'Policy Foundry docs: live downstream replay code evidence is named');
  includes(docs, 'test:policy-foundry-live-downstream-replay', 'Policy Foundry docs: live downstream replay test command is named');
  includes(tracker, 'attestor.policy-foundry-live-downstream-replay.v1', 'Deepening tracker: live downstream replay version is named');
  includes(dataMinimizationDocs, 'policy-foundry-live-downstream-replay', 'Data minimization docs: live downstream replay surface is listed');
  includes(readme, 'live downstream replay evidence', 'README: live downstream replay evidence is named');
  equal(
    pkg.scripts['test:policy-foundry-live-downstream-replay'],
    'tsx tests/policy-foundry-live-downstream-replay.test.ts',
    'Package: live downstream replay test is exposed',
  );
}

testPassingSandboxReplayIsReviewEvidenceOnly();
testUnsafeLiveReplayInputsFailClosed();
testUnexpectedAllowAndMissingCaseBlockRolloutReview();
testDescriptorDocsAndPackageSurface();

ok(passed > 0, 'Policy Foundry live downstream replay tests executed');
console.log(`Policy Foundry live downstream replay tests: ${passed} passed, 0 failed`);
