import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createActionSurfaceOnboardingPacket,
  createActionSurfaceOnboardingRedTeamFixtureBundle,
  createPolicyFoundryAdversarialReplayExecutor,
  policyFoundryAdversarialReplayExecutorDescriptor,
  type ActionSurfaceOnboardingRedTeamFixtureBundle,
  type PolicyFoundryAdversarialReplayObservation,
  type PolicyFoundryAdversarialReplayObservedOutcome,
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

function includesNormalized(content: string, expected: string, message: string): void {
  assert.ok(
    content.replace(/\s+/gu, ' ').includes(expected),
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
    generatedAt: '2026-05-13T08:00:00.000Z',
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
    generatedAt: '2026-05-13T08:01:00.000Z',
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
): readonly PolicyFoundryAdversarialReplayObservation[] {
  return bundle.cases.map((entry) => ({
    caseId: entry.caseId,
    observedOutcome: expectedAsPassingObservation(entry.expectedOutcome),
    observedAt: '2026-05-13T08:02:00.000Z',
    executionMode: 'synthetic-local',
    evidenceDigest: digest(entry.caseId),
    reasonCodes: [`fixture:${entry.kind}`],
    rawPayloadStored: false,
    downstreamMutationAttempted: false,
    credentialMaterialUsed: false,
  }));
}

function testPassingReplayReportIsReviewOnly(): void {
  const bundle = fixtureBundle();
  const report = createPolicyFoundryAdversarialReplayExecutor({
    generatedAt: '2026-05-13T08:03:00.000Z',
    fixtureBundle: bundle,
    observations: passingObservations(bundle),
  });
  const serialized = JSON.stringify(report);

  equal(report.version, 'attestor.policy-foundry-adversarial-replay-executor.v1', 'Adversarial replay executor: version is stable');
  equal(report.status, 'passed', 'Adversarial replay executor: passing local replay is marked passed');
  equal(report.fixtureBundleDigest, bundle.digest, 'Adversarial replay executor: fixture bundle digest is retained');
  equal(report.fixtureCaseCount, 12, 'Adversarial replay executor: fixture case count is retained');
  equal(report.observedCaseCount, 12, 'Adversarial replay executor: observed case count is retained');
  equal(report.passedCaseCount, 12, 'Adversarial replay executor: all passing cases are counted');
  equal(report.failedCaseCount, 0, 'Adversarial replay executor: failed case count is zero');
  equal(report.missingCaseCount, 0, 'Adversarial replay executor: missing case count is zero');
  equal(report.noGoReasons.length, 0, 'Adversarial replay executor: no no-go reasons on clean local replay');
  equal(report.approvalRequired, true, 'Adversarial replay executor: approval remains required');
  equal(report.autoEnforce, false, 'Adversarial replay executor: auto enforce is false');
  equal(report.rawPayloadStored, false, 'Adversarial replay executor: raw payload storage is false');
  equal(report.productionReady, false, 'Adversarial replay executor: production readiness is not claimed');
  equal(report.activatesEnforcement, false, 'Adversarial replay executor: enforcement activation is false');
  equal(report.syntheticOnly, true, 'Adversarial replay executor: synthetic-only boundary is explicit');
  equal(report.localExecutionOnly, true, 'Adversarial replay executor: local-only boundary is explicit');
  equal(report.executesProductionTraffic, false, 'Adversarial replay executor: production traffic execution is false');
  equal(report.downstreamMutationAllowed, false, 'Adversarial replay executor: downstream mutation is forbidden');
  equal(report.credentialUseAllowed, false, 'Adversarial replay executor: credential use is forbidden');
  equal(report.reviewMaterialOnly, true, 'Adversarial replay executor: output is review material only');
  equal(
    report.dataMinimizationSurfaceKind,
    'policy-foundry-adversarial-replay-executor',
    'Adversarial replay executor: data minimization surface is explicit',
  );
  ok(report.digest.startsWith('sha256:'), 'Adversarial replay executor: report digest is generated');
  excludes(serialized, /raw_prompt|sk_live|bearer |secret=/iu, 'Adversarial replay executor: serialized report excludes raw/secret markers');
}

function testUnexpectedAllowFailsClosed(): void {
  const bundle = fixtureBundle();
  const observations = [...passingObservations(bundle)];
  const blockerIndex = bundle.cases.findIndex((entry) =>
    entry.expectedOutcome === 'block' && entry.severity === 'blocker'
  );
  assert.notEqual(blockerIndex, -1, 'fixture bundle should contain a blocker case');
  observations[blockerIndex] = {
    ...observations[blockerIndex],
    observedOutcome: 'proceed',
    reasonCodes: ['attempted:auto-promote', 'secret=must-drop'],
  };

  const report = createPolicyFoundryAdversarialReplayExecutor({
    generatedAt: '2026-05-13T08:04:00.000Z',
    fixtureBundle: bundle,
    observations,
  });
  const failedCase = report.results.find((entry) => entry.status === 'failed');

  equal(report.status, 'failed', 'Adversarial replay executor: unexpected allow fails the report');
  ok(report.noGoReasons.includes('unexpected-allow'), 'Adversarial replay executor: unexpected allow is a no-go');
  equal(report.blockerCaseCount, 1, 'Adversarial replay executor: failed blocker case is counted');
  ok(
    failedCase?.reasonCodes.includes('attempted:auto-promote'),
    'Adversarial replay executor: safe reason codes are retained',
  );
  ok(
    failedCase?.reasonCodes.includes('secret=must-drop') === false,
    'Adversarial replay executor: unsafe reason code shape is dropped',
  );
  includes(
    report.nextSafeStep,
    'fix the verifier/gateway behavior',
    'Adversarial replay executor: next safe step points to verifier/gateway fix',
  );
}

function testMissingAndUnsafeHarnessInputsBlockReview(): void {
  const bundle = fixtureBundle();
  const observations = passingObservations(bundle)
    .slice(1)
    .map((entry, index) => index === 0
      ? {
          ...entry,
          rawPayloadStored: true,
          downstreamMutationAttempted: true,
          credentialMaterialUsed: true,
          evidenceDigest: 'not-a-digest',
        }
      : entry);

  const report = createPolicyFoundryAdversarialReplayExecutor({
    generatedAt: '2026-05-13T08:05:00.000Z',
    fixtureBundle: bundle,
    observations,
  });

  equal(report.status, 'failed', 'Adversarial replay executor: unsafe harness inputs fail the report');
  equal(report.missingCaseCount, 1, 'Adversarial replay executor: missing replay case is counted');
  for (const reason of [
    'missing-case-result',
    'raw-payload-stored',
    'downstream-mutation-attempted',
    'credential-material-used',
    'invalid-evidence-digest',
  ] as const) {
    ok(report.noGoReasons.includes(reason), `Adversarial replay executor: ${reason} is a no-go`);
  }
  includes(
    report.nextSafeStep,
    'local synthetic mode',
    'Adversarial replay executor: downstream mutation takes priority in next safe step',
  );
}

function testDescriptorDocsAndPackageSurface(): void {
  const descriptor = policyFoundryAdversarialReplayExecutorDescriptor();
  const docs = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const dataMinimizationDocs = readProjectFile('docs', '02-architecture', 'data-minimization-redaction-policy.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.productionReady, false, 'Adversarial replay descriptor: production readiness is not claimed');
  equal(descriptor.downstreamMutationAllowed, false, 'Adversarial replay descriptor: downstream mutation is forbidden');
  equal(descriptor.credentialUseAllowed, false, 'Adversarial replay descriptor: credential use is forbidden');
  equal(descriptor.executesProductionTraffic, false, 'Adversarial replay descriptor: production traffic execution is false');
  equal(
    descriptor.dataMinimizationSurfaceKind,
    'policy-foundry-adversarial-replay-executor',
    'Adversarial replay descriptor: data minimization surface is stable',
  );
  includes(
    docs,
    'src/consequence-admission/policy-foundry-adversarial-replay-executor.ts',
    'Policy Foundry docs: adversarial replay executor code evidence is named',
  );
  includesNormalized(
    docs,
    'local/synthetic adversarial replay executor',
    'Policy Foundry docs: local synthetic executor boundary is documented',
  );
  includes(
    dataMinimizationDocs,
    'policy-foundry-adversarial-replay-executor',
    'Data minimization docs: adversarial replay executor surface is listed',
  );
  includes(
    docs,
    'local adversarial replay executor',
    'Policy Foundry docs: local adversarial replay executor is named',
  );
  equal(
    pkg.scripts['test:policy-foundry-adversarial-replay-executor'],
    'tsx tests/policy-foundry-adversarial-replay-executor.test.ts',
    'Package: adversarial replay executor test is exposed',
  );
}

testPassingReplayReportIsReviewOnly();
testUnexpectedAllowFailsClosed();
testMissingAndUnsafeHarnessInputsBlockReview();
testDescriptorDocsAndPackageSurface();

ok(passed > 0, 'Policy Foundry adversarial replay executor tests executed');
console.log(`Policy Foundry adversarial replay executor tests: ${passed} passed, 0 failed`);
