import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createActionSurfaceIntegrationArtifactBundle,
  createActionSurfaceProfilerReport,
  createPolicyFoundryReviewOnlyPatchPack,
  policyFoundryReviewOnlyPatchPackDescriptor,
  type PolicyFoundryReviewOnlyPatchDraft,
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

function patch(
  patches: readonly PolicyFoundryReviewOnlyPatchDraft[],
  artifactKind: PolicyFoundryReviewOnlyPatchDraft['artifactKind'],
): PolicyFoundryReviewOnlyPatchDraft {
  const found = patches.find((item) => item.artifactKind === artifactKind);
  assert.ok(found, `expected patch for ${artifactKind}`);
  return found;
}

function testPatchPackIsReviewOnlyAndCoversGateTargets(): void {
  const report = createActionSurfaceProfilerReport({
    generatedAt: '2026-05-13T07:00:00.000Z',
    declarations: [
      {
        sourceKind: 'openapi',
        actionSurface: 'refund-service.issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        action: 'issue_refund',
        method: 'post',
        path: '/refunds',
        credentialPosture: 'agent-held-static-secret',
      },
      {
        sourceKind: 'mcp-tools',
        actionSurface: 'warehouse.export_customer_data',
        domain: 'data-disclosure',
        downstreamSystem: 'warehouse-mcp',
        action: 'export_customer_data',
        toolName: 'export_customer_data',
        credentialPosture: 'gateway-held-secret',
      },
      {
        sourceKind: 'workflow-manifest',
        actionSurface: 'github-actions.deploy_production',
        domain: 'system-operation',
        downstreamSystem: 'github-actions',
        action: 'deploy_production',
        workflowRef: '.github/workflows/deploy.yml#deploy',
        credentialPosture: 'short-lived-downscoped-token',
      },
      {
        sourceKind: 'provider-log',
        actionSurface: 'stripe.issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'stripe',
        action: 'issue_refund',
        operationRef: 'stripe.refunds.create',
        credentialPosture: 'provider-native-delegation',
      },
    ],
  });
  const artifactBundle = createActionSurfaceIntegrationArtifactBundle({
    profiles: report.profiles,
    generatedAt: '2026-05-13T07:01:00.000Z',
    attestorBaseUrl: 'https://attestor.example.com',
  });
  const pack = createPolicyFoundryReviewOnlyPatchPack({
    artifactBundle,
    generatedAt: '2026-05-13T07:02:00.000Z',
  });
  const serialized = JSON.stringify(pack);
  const gatewayPatch = patch(pack.patches, 'gateway-proxy-config');
  const mcpPatch = patch(pack.patches, 'mcp-tool-gateway-config');
  const sidecarPatch = patch(pack.patches, 'sidecar-ext-authz-config');
  const providerPatch = patch(pack.patches, 'provider-native-connector-plan');

  equal(pack.version, 'attestor.policy-foundry-review-only-patch-pack.v1', 'Review patch pack: version is explicit');
  equal(pack.status, 'requires-review', 'Review patch pack: generated artifacts require review');
  equal(pack.patchCount, artifactBundle.artifactCount, 'Review patch pack: one patch draft per source artifact');
  equal(pack.approvalRequired, true, 'Review patch pack: approval is required');
  equal(pack.autoEnforce, false, 'Review patch pack: auto enforce is false');
  equal(pack.appliesPatches, false, 'Review patch pack: does not apply patches');
  equal(pack.deploysInfrastructure, false, 'Review patch pack: does not deploy infrastructure');
  equal(pack.issuesCredentials, false, 'Review patch pack: does not issue credentials');
  equal(pack.activatesEnforcement, false, 'Review patch pack: does not activate enforcement');
  equal(pack.nonBypassableClaimAllowed, false, 'Review patch pack: non-bypassable claim is blocked');
  equal(pack.reviewMaterialOnly, true, 'Review patch pack: review-only invariant is explicit');
  ok(pack.digest.startsWith('sha256:'), 'Review patch pack: digest is generated');
  ok(pack.targetKinds.includes('gateway'), 'Review patch pack: gateway target is covered');
  ok(pack.targetKinds.includes('mcp-gateway'), 'Review patch pack: MCP gateway target is covered');
  ok(pack.targetKinds.includes('sidecar'), 'Review patch pack: sidecar target is covered');
  ok(pack.targetKinds.includes('provider-connector'), 'Review patch pack: provider connector target is covered');
  equal(gatewayPatch.targetKind, 'gateway', 'Review patch pack: gateway artifact maps to gateway target');
  equal(mcpPatch.targetKind, 'mcp-gateway', 'Review patch pack: MCP artifact maps to MCP gateway target');
  equal(sidecarPatch.targetKind, 'sidecar', 'Review patch pack: sidecar artifact maps to sidecar target');
  equal(providerPatch.targetKind, 'provider-connector', 'Review patch pack: provider artifact maps to provider target');
  equal(gatewayPatch.appliesPatch, false, 'Review patch pack: individual gateway draft is not applied');
  equal(gatewayPatch.deploysInfrastructure, false, 'Review patch pack: individual gateway draft does not deploy');
  equal(gatewayPatch.issuesCredentials, false, 'Review patch pack: individual gateway draft does not issue credentials');
  ok(
    gatewayPatch.reviewChecklist.some((item) => item.includes('Do not claim non-bypassability')),
    'Review patch pack: gateway checklist blocks non-bypassable claim',
  );
  ok(pack.prohibitedAutomations.includes('auto-apply-patch'), 'Review patch pack: auto-apply is prohibited');
  ok(pack.prohibitedAutomations.includes('issue-credential'), 'Review patch pack: credential issuance is prohibited');
  excludes(serialized, /sk_live|whsec|raw_prompt_must_not_escape|raw_tool_payload/iu, 'Review patch pack: serialized output excludes secret and raw payload markers');
}

function testMissingArtifactsStayNoArtifacts(): void {
  const pack = createPolicyFoundryReviewOnlyPatchPack({
    generatedAt: '2026-05-13T07:03:00.000Z',
  });

  equal(pack.status, 'no-artifacts', 'Review patch pack: missing artifacts produce no-artifacts status');
  equal(pack.patchCount, 0, 'Review patch pack: missing artifacts produce zero patches');
  equal(pack.sourceDigests.artifactBundleDigest, null, 'Review patch pack: missing artifacts have no bundle digest');
  equal(pack.nextSafeStep.includes('Generate reviewed integration artifacts'), true, 'Review patch pack: next step asks for artifacts first');
}

function testDescriptorDocsAndPackageScriptStayAligned(): void {
  const descriptor = policyFoundryReviewOnlyPatchPackDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-review-only-patch-pack.v1', 'Review patch pack descriptor: version is explicit');
  ok(descriptor.targetKinds.includes('gateway'), 'Review patch pack descriptor: gateway target is exposed');
  ok(descriptor.targetKinds.includes('mcp-gateway'), 'Review patch pack descriptor: MCP target is exposed');
  ok(descriptor.targetKinds.includes('sidecar'), 'Review patch pack descriptor: sidecar target is exposed');
  ok(descriptor.targetKinds.includes('provider-connector'), 'Review patch pack descriptor: provider target is exposed');
  equal(descriptor.appliesPatches, false, 'Review patch pack descriptor: applies patches is false');
  equal(descriptor.deploysInfrastructure, false, 'Review patch pack descriptor: deploy infrastructure is false');
  equal(descriptor.issuesCredentials, false, 'Review patch pack descriptor: issue credentials is false');
  equal(descriptor.reviewMaterialOnly, true, 'Review patch pack descriptor: review-only invariant is explicit');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-review-only-patch-pack', 'Review patch pack descriptor: data minimization surface is explicit');
  includes(doc, 'src/consequence-admission/policy-foundry-review-only-patch-pack.ts', 'Policy Foundry docs: review-only patch pack contract is named');
  includes(doc, 'test:policy-foundry-review-only-patch-pack', 'Policy Foundry docs: review-only patch pack test command is named');
  includes(tracker, 'Step 08', 'Deepening tracker: Step 08 is present');
  includes(tracker, 'complete | Add Review-Only Integration Patch Pack', 'Deepening tracker: Step 08 is complete');
  includes(tracker, 'Step 01 through Step 12 are complete', 'Deepening tracker: self-onboarding list is complete');
  includes(
    pkg.scripts['test:policy-foundry-review-only-patch-pack'] ?? '',
    'tsx tests/policy-foundry-review-only-patch-pack.test.ts',
    'Package: review-only patch pack test command is exposed',
  );
}

testPatchPackIsReviewOnlyAndCoversGateTargets();
testMissingArtifactsStayNoArtifacts();
testDescriptorDocsAndPackageScriptStayAligned();

ok(passed > 0, 'Policy Foundry review-only patch pack tests executed');
console.log(`Policy Foundry review-only patch pack tests: ${passed} passed, 0 failed`);
