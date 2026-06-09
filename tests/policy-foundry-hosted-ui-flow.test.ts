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
  type ActionSurfaceOnboardingRedTeamFixtureBundle,
  type PolicyFoundryAdversarialReplayObservation,
  type PolicyFoundrySelfOnboardingCliPacket,
} from '../src/consequence-admission/index.js';
import {
  POLICY_FOUNDRY_HOSTED_UI_FLOW_VERSION,
  policyFoundryHostedUiFlowDescriptor,
  renderPolicyFoundryHostedUiFlow,
} from '../src/service/policy-foundry/policy-foundry-hosted-ui.js';
import {
  createPolicyFoundryHostedUiPreviewApp,
  createPolicyFoundryHostedUiPreviewHtml,
} from '../scripts/preview/preview-policy-foundry-hosted-ui.ts';

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
    generatedAt: '2026-05-13T12:00:00.000Z',
    tenantId: 'tenant_private_ui_flow',
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
    observedAt: '2026-05-13T12:01:00.000Z',
    executionMode: 'synthetic-local',
    evidenceDigest: digest(entry.caseId),
    reasonCodes: [`fixture:${entry.kind}`],
    rawPayloadStored: false,
    downstreamMutationAttempted: false,
    credentialMaterialUsed: false,
  }));
}

function testHostedUiFlowRendersAccessibleReviewMaterial(): void {
  const packet = selfOnboardingPacket();
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt: '2026-05-13T12:02:00.000Z',
    tenantId: 'tenant_private_ui_flow',
    selfOnboardingPacket: packet,
    commercialBoundary: createPolicyFoundryCommercialBoundary({
      generatedAt: '2026-05-13T12:02:00.000Z',
      plan: 'starter',
      requestedCapabilities: ['basic-shadow-summary', 'active-questions'],
    }),
  });
  const surface = createPolicyFoundryHostedReviewSurface({
    generatedAt: '2026-05-13T12:03:00.000Z',
    workflow,
  });
  const html = renderPolicyFoundryHostedUiFlow(surface);

  includes(html, '<!doctype html>', 'Hosted UI flow: HTML document is rendered');
  includes(html, 'Policy Foundry hosted onboarding', 'Hosted UI flow: page identity is visible');
  includes(html, 'Skip to onboarding tasks', 'Hosted UI flow: skip link is present for browser navigation');
  includes(html, 'data-testid="policy-foundry-status-panel"', 'Hosted UI flow: status panel has a stable browser QA selector');
  includes(html, 'data-testid="policy-foundry-task-list"', 'Hosted UI flow: task list has a stable browser QA selector');
  includes(html, 'role="alert"', 'Hosted UI flow: missing no-go state is announced as alert');
  includes(html, 'aria-live="assertive"', 'Hosted UI flow: blocker status uses assertive live region');
  includes(html, '<ol class="task-list">', 'Hosted UI flow: tasks render as ordered task list');
  includes(html, 'Adversarial replay', 'Hosted UI flow: current task is visible');
  includes(html, 'adversarial-replay-missing', 'Hosted UI flow: no-go reason is visible');
  includes(html, 'Evidence digests', 'Hosted UI flow: digest evidence section is visible');
  includes(html, surface.workflowDigest, 'Hosted UI flow: workflow digest is visible');
  includes(html, surface.digest, 'Hosted UI flow: surface digest is visible');
  includes(html, 'Review material only', 'Hosted UI flow: boundary statement is visible');
  excludes(
    html,
    /tenant_private_ui_flow|raw_prompt_must_not_escape|rk_live_must_not_escape/u,
    'Hosted UI flow: raw tenant and secret-like manifest content are not rendered',
  );
}

function testHostedUiFlowKeepsRolloutReviewNonProduction(): void {
  const packet = selfOnboardingPacket();
  const replay = createPolicyFoundryAdversarialReplayExecutor({
    generatedAt: '2026-05-13T12:04:00.000Z',
    fixtureBundle: packet.redTeamFixtures,
    observations: passingObservations(packet.redTeamFixtures),
  });
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt: '2026-05-13T12:05:00.000Z',
    selfOnboardingPacket: packet,
    adversarialReplay: replay,
    reviewedStepIds: ['surface-map', 'active-questions', 'coverage-review', 'gate-plan', 'adversarial-replay', 'patch-review'],
    customerApprovalRecorded: true,
  });
  const surface = createPolicyFoundryHostedReviewSurface({ workflow });
  const html = renderPolicyFoundryHostedUiFlow(surface);

  includes(html, 'Scoped rollout review ready', 'Hosted UI flow: rollout review status is visible');
  includes(html, 'role="status"', 'Hosted UI flow: non-blocked state is status');
  includes(html, 'aria-live="polite"', 'Hosted UI flow: non-blocked state uses polite live region');
  includes(html, 'No no-go blocker is present in this review surface.', 'Hosted UI flow: no-go absence is explicit');
  includes(html, 'No raw payload storage', 'Hosted UI flow: raw payload boundary is visible');
  includes(html, 'data-testid="policy-foundry-boundary-statement"', 'Hosted UI flow: boundary statement has a stable browser QA selector');
  excludes(
    html,
    /production-ready|Production ready|activates enforcement|executes production traffic/u,
    'Hosted UI flow: rollout review does not overclaim production readiness or activation',
  );
}

async function testHostedUiFlowBrowserPreviewHarness(): Promise<void> {
  const blockedHtml = createPolicyFoundryHostedUiPreviewHtml('blocked');
  const readyHtml = createPolicyFoundryHostedUiPreviewHtml('ready');
  const app = createPolicyFoundryHostedUiPreviewApp();
  const readyResponse = await app.request('/policy-foundry/hosted-ui-preview?state=ready');
  const readyRouteHtml = await readyResponse.text();

  includes(blockedHtml, 'class="skip-link"', 'Hosted UI browser QA: preview includes keyboard skip link');
  includes(blockedHtml, 'id="tasks"', 'Hosted UI browser QA: task section has a stable jump target');
  includes(blockedHtml, 'overflow-wrap: anywhere', 'Hosted UI browser QA: long text and digests cannot force horizontal overflow');
  includes(blockedHtml, '@media (max-width: 640px)', 'Hosted UI browser QA: mobile viewport CSS is present');
  includes(blockedHtml, 'role="alert"', 'Hosted UI browser QA: blocked preview announces no-go state');
  includes(readyHtml, 'role="status"', 'Hosted UI browser QA: ready preview announces non-blocked state');
  includes(readyRouteHtml, 'Scoped rollout review ready', 'Hosted UI browser QA: preview route can render ready state');
  equal(readyResponse.headers.get('cache-control'), 'no-store', 'Hosted UI browser QA: preview route is no-store');
  excludes(
    `${blockedHtml}\n${readyHtml}\n${readyRouteHtml}`,
    /tenant_policy_foundry_preview|raw_prompt_must_not_escape|rk_live_|sk_live_|whsec_/u,
    'Hosted UI browser QA: preview output remains data-minimized and secret-safe',
  );
}

function testHostedUiFlowDescriptorDocsAndScript(): void {
  const descriptor = policyFoundryHostedUiFlowDescriptor();
  const docs = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const dataMinimizationDocs = readProjectFile('docs', '02-architecture', 'data-minimization-redaction-policy.md');
  const readme = readProjectFile('README.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, POLICY_FOUNDRY_HOSTED_UI_FLOW_VERSION, 'Hosted UI flow: descriptor version is stable');
  equal(descriptor.rendersFromReviewSurfaceOnly, true, 'Hosted UI flow: descriptor renders from review surface only');
  equal(descriptor.rawPayloadStored, false, 'Hosted UI flow: descriptor stores no raw payload');
  equal(descriptor.autoEnforce, false, 'Hosted UI flow: descriptor forbids auto enforce');
  equal(descriptor.productionReady, false, 'Hosted UI flow: descriptor does not claim production readiness');
  includes(
    docs,
    'src/service/policy-foundry/policy-foundry-hosted-ui.ts',
    'Policy Foundry docs: hosted UI renderer evidence is named',
  );
  includes(
    docs,
    'scripts/preview/preview-policy-foundry-hosted-ui.ts',
    'Policy Foundry docs: hosted UI browser preview evidence is named',
  );
  includes(
    dataMinimizationDocs,
    'policy-foundry-hosted-ui-flow',
    'Data minimization docs: hosted UI flow surface is listed',
  );
  includes(
    readme,
    'href="docs/01-overview/how-attestor-connects-to-existing-systems.md"',
    'README: existing-systems overview is linked',
  );
  equal(
    pkg.scripts['test:policy-foundry-hosted-ui-flow'],
    'tsx tests/policy-foundry-hosted-ui-flow.test.ts',
    'Package: hosted UI flow test is exposed',
  );
  equal(
    pkg.scripts['preview:policy-foundry-hosted-ui'],
    'tsx scripts/preview/preview-policy-foundry-hosted-ui.ts',
    'Package: hosted UI preview script is exposed',
  );
}

testHostedUiFlowRendersAccessibleReviewMaterial();
testHostedUiFlowKeepsRolloutReviewNonProduction();
await testHostedUiFlowBrowserPreviewHarness();
testHostedUiFlowDescriptorDocsAndScript();

ok(passed > 0, 'Policy Foundry hosted UI flow tests executed');
console.log(`Policy Foundry hosted UI flow tests: ${passed} passed, 0 failed`);
