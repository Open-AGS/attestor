import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceIntegrationArtifactsDescriptor,
  createActionSurfaceIntegrationArtifactBundle,
  createActionSurfaceProfilerReport,
  type ActionSurfaceIntegrationArtifact,
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
    `${message}\nExpected to find: ${expected}`,
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

function artifact(
  artifacts: readonly ActionSurfaceIntegrationArtifact[],
  kind: ActionSurfaceIntegrationArtifact['kind'],
  surface: string,
): ActionSurfaceIntegrationArtifact {
  const found = artifacts.find((item) =>
    item.kind === kind && item.actionSurface === surface
  );
  assert.ok(found, `Expected artifact ${kind} for ${surface}`);
  return found;
}

function testGatewayProxyArtifactsAreReviewDrafts(): void {
  const report = createActionSurfaceProfilerReport({
    generatedAt: '2026-05-12T12:00:00.000Z',
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
    ],
  });
  const bundle = createActionSurfaceIntegrationArtifactBundle({
    profiles: report.profiles,
    generatedAt: '2026-05-12T12:01:00.000Z',
    attestorBaseUrl: 'https://attestor.example.com/',
  });
  const text = JSON.stringify(bundle);
  const gateway = artifact(
    bundle.artifacts,
    'gateway-proxy-config',
    'refund-service.issue_refund',
  );
  const verifier = artifact(
    bundle.artifacts,
    'verifier-helper-config',
    'refund-service.issue_refund',
  );
  const credentialPlan = artifact(
    bundle.artifacts,
    'credential-isolation-plan',
    'refund-service.issue_refund',
  );

  equal(bundle.version, 'attestor.action-surface-integration-artifacts.v1', 'Integration artifacts: version is explicit');
  equal(bundle.profileCount, 1, 'Integration artifacts: profile count is retained');
  equal(bundle.artifactCount, 5, 'Integration artifacts: gateway profile gets five draft artifacts');
  equal(bundle.reviewStatus, 'requires-review', 'Integration artifacts: review status is explicit');
  equal(bundle.approvalRequired, true, 'Integration artifacts: customer approval is required');
  equal(bundle.autoEnforce, false, 'Integration artifacts: auto enforce is false');
  equal(bundle.rawPayloadStored, false, 'Integration artifacts: raw payload storage is false');
  equal(bundle.productionReady, false, 'Integration artifacts: production readiness is not claimed');
  equal(bundle.nonBypassableClaimAllowed, false, 'Integration artifacts: non-bypassable claim is blocked');
  ok(bundle.digest.startsWith('sha256:'), 'Integration artifacts: bundle digest is generated');
  ok(gateway.digest.startsWith('sha256:'), 'Integration artifacts: artifact digest is generated');
  equal(gateway.mode, 'gateway-proxy', 'Integration artifacts: gateway artifact keeps recommended mode');
  equal(gateway.template.pattern, 'gateway-proxy', 'Integration artifacts: gateway template declares pattern');
  equal(gateway.template.failClosed, true, 'Integration artifacts: gateway template requires fail closed');
  equal(gateway.template.attestorAdmissionEndpoint, 'https://attestor.example.com/api/v1/admissions', 'Integration artifacts: base URL is normalized');
  equal(
    (gateway.template.envoyExtAuthz as { readonly failureModeAllow: boolean }).failureModeAllow,
    false,
    'Integration artifacts: Envoy ext_authz draft is fail closed',
  );
  equal(
    (gateway.template.nginxAuthRequest as { readonly failClosedOnNon2xx: boolean }).failClosedOnNon2xx,
    true,
    'Integration artifacts: NGINX auth_request draft is fail closed',
  );
  equal(verifier.template.rejectOnReviewRequired, true, 'Integration artifacts: verifier rejects review-required');
  equal(credentialPlan.template.agentDirectCredentialAllowed, false, 'Integration artifacts: credential plan blocks direct agent credentials');
  ok(bundle.artifactKinds.includes('policy-twin-backtest'), 'Integration artifacts: policy twin draft is included');
  ok(bundle.artifactKinds.includes('red-team-replay-fixture'), 'Integration artifacts: red-team replay draft is included');
  ok(!text.includes('raw_prompt_must_not_escape'), 'Integration artifacts: raw prompts are not serialized');
  ok(!text.includes('sk_live'), 'Integration artifacts: secrets are not serialized');
}

function testMcpWorkflowAndProviderArtifacts(): void {
  const report = createActionSurfaceProfilerReport({
    generatedAt: '2026-05-12T12:10:00.000Z',
    declarations: [
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
  const bundle = createActionSurfaceIntegrationArtifactBundle({
    profiles: report.profiles,
    generatedAt: '2026-05-12T12:11:00.000Z',
  });
  const mcp = artifact(
    bundle.artifacts,
    'mcp-tool-gateway-config',
    'warehouse.export_customer_data',
  );
  const sidecar = artifact(
    bundle.artifacts,
    'sidecar-ext-authz-config',
    'github-actions.deploy_production',
  );
  const provider = artifact(
    bundle.artifacts,
    'provider-native-connector-plan',
    'stripe.issue_refund',
  );

  equal(mcp.template.pattern, 'mcp-tool-gateway', 'Integration artifacts: MCP gateway pattern is generated');
  equal(mcp.template.gatewayOwnsToolCredential, true, 'Integration artifacts: MCP gateway owns tool credential');
  equal(mcp.template.agentDirectToolCredentialAllowed, false, 'Integration artifacts: MCP direct tool credential is blocked');
  equal(sidecar.template.pattern, 'sidecar-ext-authz', 'Integration artifacts: sidecar pattern is generated');
  equal(sidecar.template.workflowRef, '.github/workflows/deploy.yml#deploy', 'Integration artifacts: workflow ref is retained without commands');
  equal(provider.template.pattern, 'provider-native-connector', 'Integration artifacts: provider connector plan is generated');
  equal(provider.template.providerDelegationRequired, true, 'Integration artifacts: provider delegation is required');
}

function testDescriptorDocsAndValidation(): void {
  const descriptor = actionSurfaceIntegrationArtifactsDescriptor();
  equal(descriptor.autoEnforce, false, 'Integration artifacts descriptor: auto enforce is false');
  equal(descriptor.outputIsReviewDraftOnly, true, 'Integration artifacts descriptor: output is review draft only');
  equal(descriptor.nonBypassableClaimAllowed, false, 'Integration artifacts descriptor: non-bypassable claim is blocked');

  assert.throws(
    () =>
      createActionSurfaceIntegrationArtifactBundle({
        profiles: [],
        attestorBaseUrl: 'http://attestor.example.com',
      }),
    /must use https/u,
    'Integration artifacts: non-HTTPS base URL is rejected',
  );
  passed += 1;

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-integration-artifacts.md');
  includes(doc, 'Action Surface Integration Artifacts', 'Integration artifacts doc: title exists');
  includes(doc, 'Envoy `ext_authz`', 'Integration artifacts doc: Envoy anchor is documented');
  includes(doc, 'NGINX `auth_request`', 'Integration artifacts doc: NGINX anchor is documented');
  includes(doc, 'MCP tool gateway', 'Integration artifacts doc: MCP anchor is documented');
  includes(doc, 'review drafts only', 'Integration artifacts doc: review-only boundary is documented');
  excludes(doc, /production-ready because of generated artifacts/iu, 'Integration artifacts doc: production readiness is not overclaimed');

  const onboardingDoc = readProjectFile('docs', '02-architecture', 'action-surface-onboarding-packet.md');
  includes(
    onboardingDoc,
    '[Action Surface Integration Artifacts](action-surface-integration-artifacts.md)',
    'Onboarding packet embeds integration artifacts link',
  );

  const readme = readProjectFile('README.md');
  excludes(readme, /generated artifacts make downstream execution non-bypassable/iu, 'README does not overclaim non-bypassability');

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-integration-artifacts'],
    'tsx tests/action-surface-integration-artifacts.test.ts',
    'package.json exposes integration artifacts test',
  );
}

try {
  testGatewayProxyArtifactsAreReviewDrafts();
  testMcpWorkflowAndProviderArtifacts();
  testDescriptorDocsAndValidation();
  console.log(`Action surface integration artifacts tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface integration artifacts tests failed:', error);
  process.exitCode = 1;
}
