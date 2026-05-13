import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPolicyFoundryAdversarialReplayExecutor,
  createPolicyFoundryCommercialBoundary,
  createPolicyFoundryHostedOnboardingWorkflow,
  createPolicyFoundrySelfOnboardingCliPacket,
  policyFoundryHostedOnboardingWorkflowDescriptor,
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
    generatedAt: '2026-05-13T10:00:00.000Z',
    tenantId: 'tenant_live_private_id',
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
    observedAt: '2026-05-13T10:01:00.000Z',
    executionMode: 'synthetic-local',
    evidenceDigest: digest(entry.caseId),
    reasonCodes: [`fixture:${entry.kind}`],
    rawPayloadStored: false,
    downstreamMutationAttempted: false,
    credentialMaterialUsed: false,
  }));
}

function testNoInputWorkflowStartsAtSourceIntake(): void {
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt: '2026-05-13T10:02:00.000Z',
  });

  equal(workflow.version, 'attestor.policy-foundry-hosted-onboarding-workflow.v1', 'Hosted onboarding workflow: version is stable');
  equal(workflow.status, 'no-input', 'Hosted onboarding workflow: no input status is explicit');
  ok(workflow.currentStepIds.includes('source-intake'), 'Hosted onboarding workflow: source intake is currently due');
  ok(workflow.noGoReasons.includes('source-packet-missing'), 'Hosted onboarding workflow: missing source packet is a no-go');
  equal(workflow.hostedUiWorkflowContract, true, 'Hosted onboarding workflow: contract boundary is explicit');
  equal(workflow.hostedUiImplemented, false, 'Hosted onboarding workflow: hosted UI is not claimed');
  equal(workflow.hostedRouteImplemented, false, 'Hosted onboarding workflow: hosted route is not claimed');
  equal(workflow.productionReady, false, 'Hosted onboarding workflow: production readiness is false');
  equal(workflow.autoEnforce, false, 'Hosted onboarding workflow: auto enforce is false');
  equal(workflow.rawPayloadStored, false, 'Hosted onboarding workflow: raw payload storage is false');
}

function testPacketWithoutReplayRequiresCustomerAction(): void {
  const packet = selfOnboardingPacket();
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt: '2026-05-13T10:03:00.000Z',
    tenantId: 'tenant_live_private_id',
    selfOnboardingPacket: packet,
    commercialBoundary: createPolicyFoundryCommercialBoundary({
      generatedAt: '2026-05-13T10:03:00.000Z',
      plan: 'starter',
      requestedCapabilities: ['basic-shadow-summary', 'active-questions'],
    }),
  });
  const serialized = JSON.stringify(workflow);

  equal(workflow.status, 'customer-action-required', 'Hosted onboarding workflow: missing replay leaves customer action due');
  equal(workflow.sourceDigests.selfOnboardingPacketDigest, packet.digest, 'Hosted onboarding workflow: packet digest is bound');
  equal(workflow.sourceDigests.redTeamFixtureDigest, packet.redTeamFixtures.digest, 'Hosted onboarding workflow: fixture digest is bound');
  ok(workflow.currentStepIds.includes('adversarial-replay'), 'Hosted onboarding workflow: adversarial replay is currently due');
  ok(workflow.currentStepIds.includes('coverage-review'), 'Hosted onboarding workflow: coverage review remains currently due');
  ok(workflow.noGoReasons.includes('adversarial-replay-missing'), 'Hosted onboarding workflow: missing replay is tracked');
  ok(workflow.tenantDigest?.startsWith('sha256:'), 'Hosted onboarding workflow: tenant id is digest-only');
  excludes(serialized, /tenant_live_private_id|raw_prompt_must_not_escape|rk_live_must_not_escape/u, 'Hosted onboarding workflow: serialized output excludes raw tenant and secret-like input');
}

function testFailedReplayAndUnsafeRequestsBlockWorkflow(): void {
  const packet = selfOnboardingPacket();
  const replay = createPolicyFoundryAdversarialReplayExecutor({
    generatedAt: '2026-05-13T10:04:00.000Z',
    fixtureBundle: packet.redTeamFixtures,
    observations: passingObservations(packet.redTeamFixtures).map((entry, index) =>
      index === 0
        ? { ...entry, observedOutcome: 'proceed' }
        : entry
    ),
  });
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt: '2026-05-13T10:05:00.000Z',
    selfOnboardingPacket: packet,
    adversarialReplay: replay,
    autoEnforceRequested: true,
    credentialIssuanceRequested: true,
    infrastructureDeployRequested: true,
    productionTrafficExecutionRequested: true,
    rawPayloadStorageRequested: true,
  });

  equal(replay.status, 'failed', 'Hosted onboarding workflow fixture: replay fails with unexpected allow');
  equal(workflow.status, 'blocked', 'Hosted onboarding workflow: failed replay and unsafe requests block');
  ok(workflow.blockedStepIds.includes('adversarial-replay'), 'Hosted onboarding workflow: replay step is blocked');
  for (const reason of [
    'adversarial-replay-failed',
    'auto-enforce-requested',
    'credential-issuance-requested',
    'infrastructure-deploy-requested',
    'production-traffic-execution-requested',
    'raw-payload-storage-requested',
  ] as const) {
    ok(workflow.noGoReasons.includes(reason), `Hosted onboarding workflow: ${reason} is recorded`);
  }
  includes(
    workflow.nextSafeStep,
    'review-only mode',
    'Hosted onboarding workflow: unsafe requests route to review-only next step',
  );
}

function testPassingReplayStillDoesNotClaimUiOrProduction(): void {
  const packet = selfOnboardingPacket();
  const replay = createPolicyFoundryAdversarialReplayExecutor({
    generatedAt: '2026-05-13T10:06:00.000Z',
    fixtureBundle: packet.redTeamFixtures,
    observations: passingObservations(packet.redTeamFixtures),
  });
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt: '2026-05-13T10:07:00.000Z',
    selfOnboardingPacket: packet,
    adversarialReplay: replay,
    reviewedStepIds: ['surface-map', 'adversarial-replay', 'patch-review'],
    customerApprovalRecorded: true,
  });

  equal(replay.status, 'passed', 'Hosted onboarding workflow fixture: replay passes');
  equal(workflow.sourceDigests.adversarialReplayDigest, replay.digest, 'Hosted onboarding workflow: replay digest is bound');
  equal(workflow.customerApprovalRecorded, true, 'Hosted onboarding workflow: customer approval flag is retained');
  equal(workflow.hostedUiImplemented, false, 'Hosted onboarding workflow: passing replay still does not implement hosted UI');
  equal(workflow.hostedRouteImplemented, false, 'Hosted onboarding workflow: passing replay still does not implement hosted route');
  equal(workflow.executesProductionTraffic, false, 'Hosted onboarding workflow: passing replay still does not execute production traffic');
  equal(workflow.deploymentEntitlementEnforcementImplemented, false, 'Hosted onboarding workflow: entitlement enforcement is not claimed');
  ok(workflow.digest.startsWith('sha256:'), 'Hosted onboarding workflow: digest is generated');
}

function testDescriptorDocsAndPackageSurface(): void {
  const descriptor = policyFoundryHostedOnboardingWorkflowDescriptor();
  const docs = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const dataMinimizationDocs = readProjectFile('docs', '02-architecture', 'data-minimization-redaction-policy.md');
  const readme = readProjectFile('README.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.hostedUiWorkflowContract, true, 'Hosted onboarding descriptor: contract boundary is true');
  equal(descriptor.hostedUiImplemented, false, 'Hosted onboarding descriptor: hosted UI is not claimed');
  equal(descriptor.hostedRouteImplemented, false, 'Hosted onboarding descriptor: hosted route is not claimed');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-hosted-onboarding-workflow', 'Hosted onboarding descriptor: data minimization surface is stable');
  includes(
    docs,
    'src/consequence-admission/policy-foundry-hosted-onboarding-workflow.ts',
    'Policy Foundry docs: hosted onboarding workflow contract is named',
  );
  includes(
    docs,
    'not a hosted UI implementation or hosted route',
    'Policy Foundry docs: hosted workflow limitation is explicit',
  );
  includes(
    dataMinimizationDocs,
    'policy-foundry-hosted-onboarding-workflow',
    'Data minimization docs: hosted onboarding workflow surface is listed',
  );
  includes(
    readme,
    'hosted onboarding workflow contract',
    'README: hosted onboarding workflow contract is named',
  );
  equal(
    pkg.scripts['test:policy-foundry-hosted-onboarding-workflow'],
    'tsx tests/policy-foundry-hosted-onboarding-workflow.test.ts',
    'Package: hosted onboarding workflow test is exposed',
  );
}

testNoInputWorkflowStartsAtSourceIntake();
testPacketWithoutReplayRequiresCustomerAction();
testFailedReplayAndUnsafeRequestsBlockWorkflow();
testPassingReplayStillDoesNotClaimUiOrProduction();
testDescriptorDocsAndPackageSurface();

ok(passed > 0, 'Policy Foundry hosted onboarding workflow tests executed');
console.log(`Policy Foundry hosted onboarding workflow tests: ${passed} passed, 0 failed`);
