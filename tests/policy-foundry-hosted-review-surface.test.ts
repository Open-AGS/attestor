import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPolicyFoundryAdversarialReplayExecutor,
  createPolicyFoundryCommercialBoundary,
  createPolicyFoundryHostedOnboardingWorkflow,
  createPolicyFoundryHostedReviewSurface,
  createPolicyFoundrySelfOnboardingCliPacket,
  policyFoundryHostedReviewSurfaceDescriptor,
  type ActionSurfaceOnboardingRedTeamFixtureBundle,
  type PolicyFoundryAdversarialReplayObservation,
  type PolicyFoundrySelfOnboardingCliPacket,
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
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to include: ${expected}`,
  );
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function refundOpenApi(): string {
  return JSON.stringify({
    openapi: '3.1.0',
    info: {
      title: 'Refund API',
      version: '1.0.0',
    },
    paths: {
      '/refunds': {
        post: {
          operationId: 'issueRefund',
          description: 'raw_prompt_must_not_escape rk_live_must_not_escape',
          responses: {
            '200': { description: 'ok' },
          },
        },
      },
    },
  });
}

function selfOnboardingPacket(): PolicyFoundrySelfOnboardingCliPacket {
  return createPolicyFoundrySelfOnboardingCliPacket({
    generatedAt: '2026-05-13T11:00:00.000Z',
    tenantId: 'tenant_private_review_surface',
    manifests: [
      {
        text: refundOpenApi(),
        sourceRef: 'openapi/refunds.json',
        manifestKind: 'openapi',
        defaultDomain: 'money-movement',
        downstreamSystem: 'refund-service',
        credentialPosture: 'agent-held-static-secret',
      },
    ],
  });
}

function passingObservations(
  bundle: ActionSurfaceOnboardingRedTeamFixtureBundle,
): readonly PolicyFoundryAdversarialReplayObservation[] {
  return bundle.cases.map((entry) => ({
    caseId: entry.caseId,
    observedOutcome: entry.expectedOutcome,
    observedAt: '2026-05-13T11:01:00.000Z',
    executionMode: 'synthetic-local',
    evidenceDigest: digest(entry.caseId),
    reasonCodes: [`fixture:${entry.kind}`],
    rawPayloadStored: false,
    downstreamMutationAttempted: false,
    credentialMaterialUsed: false,
  }));
}

function testReviewSurfaceSummarizesCurrentWorkWithoutRawInputs(): void {
  const packet = selfOnboardingPacket();
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt: '2026-05-13T11:02:00.000Z',
    tenantId: 'tenant_private_review_surface',
    selfOnboardingPacket: packet,
    commercialBoundary: createPolicyFoundryCommercialBoundary({
      generatedAt: '2026-05-13T11:02:00.000Z',
      plan: 'starter',
      requestedCapabilities: ['basic-shadow-summary', 'active-questions'],
    }),
  });
  const surface = createPolicyFoundryHostedReviewSurface({
    generatedAt: '2026-05-13T11:03:00.000Z',
    workflow,
  });
  const serialized = JSON.stringify(surface);

  equal(surface.version, 'attestor.policy-foundry-hosted-review-surface.v1', 'Hosted review surface: version is stable');
  equal(surface.workflowDigest, workflow.digest, 'Hosted review surface: workflow digest is bound');
  equal(surface.tenantDigest, workflow.tenantDigest, 'Hosted review surface: tenant digest is retained');
  equal(surface.status, 'customer-action-required', 'Hosted review surface: status follows workflow');
  equal(surface.headline, 'Customer action required', 'Hosted review surface: headline is compact');
  equal(surface.productionReady, false, 'Hosted review surface: production readiness is false');
  equal(surface.hostedUiImplemented, false, 'Hosted review surface: hosted UI is not claimed');
  equal(surface.rawPayloadStored, false, 'Hosted review surface: raw payload storage is false');
  equal(surface.fullPacketRequiredForImplementation, true, 'Hosted review surface: full packet is required for implementation details');
  ok(surface.taskCards.length >= workflow.steps.length, 'Hosted review surface: task cards cover workflow steps');
  equal(surface.taskCards[0]?.priority, 'currently-due', 'Hosted review surface: currently due work is first when no blockers exist');
  ok(
    surface.taskCards.some((task) => task.stepId === 'adversarial-replay' && task.customerActionRequired),
    'Hosted review surface: adversarial replay task is visible',
  );
  ok(
    surface.noGoCards.some((card) => card.reason === 'adversarial-replay-missing'),
    'Hosted review surface: missing replay no-go is visible',
  );
  ok(
    surface.evidenceCards.some((card) => card.evidenceKind === 'selfOnboardingPacketDigest'),
    'Hosted review surface: self-onboarding packet evidence card is present',
  );
  ok(
    surface.safeAutomations.includes('show-next-safe-step'),
    'Hosted review surface: safe automations are retained',
  );
  ok(
    surface.prohibitedAutomations.includes('auto-enforce-policy'),
    'Hosted review surface: prohibited automations are retained',
  );
  excludes(
    serialized,
    /tenant_private_review_surface|raw_prompt_must_not_escape|rk_live_must_not_escape/u,
    'Hosted review surface: serialized output excludes raw tenant and secret-like input',
  );
}

function testReviewSurfaceShowsBlockersBeforeCurrentWork(): void {
  const packet = selfOnboardingPacket();
  const failedReplay = createPolicyFoundryAdversarialReplayExecutor({
    generatedAt: '2026-05-13T11:04:00.000Z',
    fixtureBundle: packet.redTeamFixtures,
    observations: passingObservations(packet.redTeamFixtures).map((entry, index) =>
      index === 0
        ? { ...entry, observedOutcome: 'proceed' }
        : entry
    ),
  });
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt: '2026-05-13T11:05:00.000Z',
    selfOnboardingPacket: packet,
    adversarialReplay: failedReplay,
    autoEnforceRequested: true,
  });
  const surface = createPolicyFoundryHostedReviewSurface({
    workflow,
  });

  equal(surface.status, 'blocked', 'Hosted review surface: blocked workflow remains blocked');
  equal(surface.headline, 'No-go blockers present', 'Hosted review surface: blocked headline is explicit');
  equal(surface.taskCards[0]?.priority, 'blocked', 'Hosted review surface: blocked work is first');
  ok(
    surface.noGoCards.some((card) =>
      card.reason === 'auto-enforce-requested' && card.severity === 'blocker'
    ),
    'Hosted review surface: unsafe automation request is a blocker card',
  );
  ok(
    surface.noGoCards.some((card) => card.reason === 'adversarial-replay-failed'),
    'Hosted review surface: failed replay no-go is present',
  );
  includes(
    surface.nextSafeStep,
    'review-only mode',
    'Hosted review surface: next safe step remains review-only',
  );
}

function testReviewSurfaceCanRepresentRolloutReviewWithoutProductionClaim(): void {
  const packet = selfOnboardingPacket();
  const replay = createPolicyFoundryAdversarialReplayExecutor({
    generatedAt: '2026-05-13T11:06:00.000Z',
    fixtureBundle: packet.redTeamFixtures,
    observations: passingObservations(packet.redTeamFixtures),
  });
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt: '2026-05-13T11:07:00.000Z',
    selfOnboardingPacket: packet,
    adversarialReplay: replay,
    reviewedStepIds: ['surface-map', 'active-questions', 'coverage-review', 'gate-plan', 'adversarial-replay', 'patch-review'],
    customerApprovalRecorded: true,
  });
  const surface = createPolicyFoundryHostedReviewSurface({
    workflow,
  });

  equal(surface.status, 'scoped-rollout-review-ready', 'Hosted review surface: rollout review status is retained');
  equal(surface.headline, 'Scoped rollout review ready', 'Hosted review surface: rollout headline is compact');
  equal(surface.customerApprovalRecorded, true, 'Hosted review surface: customer approval flag is retained');
  equal(surface.productionReady, false, 'Hosted review surface: rollout review is not production readiness');
  equal(surface.activatesEnforcement, false, 'Hosted review surface: rollout review does not activate enforcement');
  equal(surface.executesProductionTraffic, false, 'Hosted review surface: rollout review does not execute traffic');
  ok(surface.digest.startsWith('sha256:'), 'Hosted review surface: digest is generated');
}

function testDescriptorDocsAndPackageSurface(): void {
  const descriptor = policyFoundryHostedReviewSurfaceDescriptor();
  const docs = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const dataMinimizationDocs = readProjectFile('docs', '02-architecture', 'data-minimization-redaction-policy.md');
  const readme = readProjectFile('README.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.hostedUiImplemented, false, 'Hosted review descriptor: hosted UI is not claimed');
  equal(descriptor.fullPacketRequiredForImplementation, true, 'Hosted review descriptor: compact surface is not implementation detail');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-hosted-review-surface', 'Hosted review descriptor: data minimization surface is stable');
  includes(
    docs,
    'src/consequence-admission/policy-foundry-hosted-review-surface.ts',
    'Policy Foundry docs: hosted review surface contract is named',
  );
  includes(
    docs,
    'compact hosted review surface',
    'Policy Foundry docs: hosted review surface role is explicit',
  );
  includes(
    dataMinimizationDocs,
    'policy-foundry-hosted-review-surface',
    'Data minimization docs: hosted review surface is listed',
  );
  includes(
    readme,
    'hosted review surface',
    'README: hosted review surface is named',
  );
  equal(
    pkg.scripts['test:policy-foundry-hosted-review-surface'],
    'tsx tests/policy-foundry-hosted-review-surface.test.ts',
    'Package: hosted review surface test is exposed',
  );
}

testReviewSurfaceSummarizesCurrentWorkWithoutRawInputs();
testReviewSurfaceShowsBlockersBeforeCurrentWork();
testReviewSurfaceCanRepresentRolloutReviewWithoutProductionClaim();
testDescriptorDocsAndPackageSurface();

ok(passed > 0, 'Policy Foundry hosted review surface tests executed');
console.log(`Policy Foundry hosted review surface tests: ${passed} passed, 0 failed`);
