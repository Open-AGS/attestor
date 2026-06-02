import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceIntegrationKitMcpGatewayDraftDescriptor,
  createActionSurfaceIntegrationKitMcpGatewayDraftBundle,
  createActionSurfaceIntegrationKitPacket,
  createActionSurfaceOnboardingPacket,
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

function createMcpKit() {
  const onboardingPacket = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-31T11:00:00.000Z',
    declarations: [
      {
        sourceKind: 'mcp-tools',
        actionSurface: 'warehouse.export_customer_data',
        domain: 'data-disclosure',
        downstreamSystem: 'warehouse-mcp',
        action: 'export_customer_data',
        toolName: 'export_customer_data',
        credentialPosture: 'agent-held-static-secret',
        integrationModeHint: 'mcp-tool-gateway',
      },
    ],
  });
  return createActionSurfaceIntegrationKitPacket({
    packet: onboardingPacket,
    generatedAt: '2026-05-31T11:01:00.000Z',
  });
}

function testMcpGatewayDraftCreatesReviewOnlyToolSchema(): void {
  const kit = createMcpKit();
  const bundle = createActionSurfaceIntegrationKitMcpGatewayDraftBundle({
    kit,
    generatedAt: '2026-05-31T11:02:00.000Z',
    serverName: 'warehouse-review-gateway',
  });
  const tool = bundle.tools[0];
  const text = JSON.stringify(bundle);

  equal(
    bundle.version,
    'attestor.action-surface-integration-kit-mcp-gateway-drafts.v1',
    'MCP gateway drafts: version is explicit',
  );
  equal(bundle.sourceKitDigest, kit.digest, 'MCP gateway drafts: source kit digest is retained');
  equal(bundle.serverName, 'warehouse-review-gateway', 'MCP gateway drafts: server name is retained');
  equal(bundle.toolCount, 1, 'MCP gateway drafts: one tool draft is produced');
  equal(tool?.name, 'export_customer_data', 'MCP gateway drafts: tool name is normalized from MCP ref');
  equal(tool?.actionSurface, 'warehouse.export_customer_data', 'MCP gateway drafts: action surface is retained');
  equal(tool?.inputSchema.type, 'object', 'MCP gateway drafts: tool input schema is object-shaped');
  equal(tool?.inputSchema.additionalProperties, false, 'MCP gateway drafts: tool input schema is bounded');
  equal(tool?.requiredReview, true, 'MCP gateway drafts: tool requires review');
  equal(tool?.annotationsTrusted, false, 'MCP gateway drafts: annotations are not trusted authority');
  equal(tool?.annotationAuthority, 'hint-only', 'MCP gateway drafts: annotations are hint-only');
  equal(
    tool?.customerGatewayRequired,
    true,
    'MCP gateway drafts: customer-owned gateway is required',
  );
  equal(
    tool?.credentialBoundaryReviewRequired,
    true,
    'MCP gateway drafts: credential boundary review is required',
  );
  ok(
    tool?.requiredEvidence.includes('tool-call-request-digest'),
    'MCP gateway drafts: tool request evidence is named',
  );
  includes(
    tool?.reviewerAction ?? '',
    'customer-owned MCP gateway',
    'MCP gateway drafts: tool reviewer action names the gateway boundary',
  );
  equal(
    tool?.authority,
    'tool-review-draft-only',
    'MCP gateway drafts: tool draft has no independent authority',
  );
  equal(tool?.rawPayloadStored, false, 'MCP gateway drafts: tool stores no raw payload');
  equal(tool?.productionReady, false, 'MCP gateway drafts: tool is not production-ready');
  equal(bundle.authorizationRequired, true, 'MCP gateway drafts: authorization is required');
  equal(bundle.approvalRequired, true, 'MCP gateway drafts: approval is required');
  equal(bundle.autoEnforce, false, 'MCP gateway drafts: auto enforce is false');
  equal(bundle.rawPayloadStored, false, 'MCP gateway drafts: raw payload storage is false');
  equal(bundle.productionReady, false, 'MCP gateway drafts: production readiness is false');
  equal(bundle.deploysInfrastructure, false, 'MCP gateway drafts: deployment is false');
  equal(bundle.issuesCredentials, false, 'MCP gateway drafts: credential issuance is false');
  equal(bundle.rotatesCredentials, false, 'MCP gateway drafts: credential rotation is false');
  equal(bundle.activatesEnforcement, false, 'MCP gateway drafts: enforcement activation is false');
  equal(bundle.nonBypassableClaimAllowed, false, 'MCP gateway drafts: no-bypass claim is false');
  equal(bundle.annotationAuthority, 'hint-only', 'MCP gateway drafts: bundle annotation authority is hint-only');
  equal(bundle.customerGatewayRequired, true, 'MCP gateway drafts: bundle requires customer gateway');
  ok(bundle.digest.startsWith('sha256:'), 'MCP gateway drafts: digest is generated');
  ok(
    !text.includes('raw_tool_description_must_not_escape'),
    'MCP gateway drafts: raw tool description is not serialized',
  );
}

function testCredentialIsolationChecksStayHumanReviewed(): void {
  const bundle = createActionSurfaceIntegrationKitMcpGatewayDraftBundle({
    kit: createMcpKit(),
  });
  const check = bundle.credentialIsolationChecks[0];

  equal(check?.actionSurface, 'warehouse.export_customer_data', 'MCP gateway drafts: credential check names surface');
  equal(
    check?.targetCredentialPosture,
    'gateway-held-secret',
    'MCP gateway drafts: target credential posture is gateway-held',
  );
  equal(check?.gatewayOwnsToolCredentialRequired, true, 'MCP gateway drafts: gateway-owned credential is required');
  equal(check?.agentDirectCredentialAllowed, false, 'MCP gateway drafts: agent direct credential is forbidden');
  equal(check?.credentialIssued, false, 'MCP gateway drafts: credential issuance is not performed');
  equal(check?.credentialRotated, false, 'MCP gateway drafts: credential rotation is not performed');
  equal(check?.customerApprovalRequired, true, 'MCP gateway drafts: customer approval is required');
  equal(check?.reviewRequired, true, 'MCP gateway drafts: credential check requires review');
  ok(
    check?.requiredEvidence.includes('gateway-decision-digest'),
    'MCP gateway drafts: credential check names gateway decision evidence',
  );
  includes(
    check?.reviewerAction ?? '',
    'agent-held credentials',
    'MCP gateway drafts: credential check tells reviewer what to replace',
  );
  ok(
    check?.noGoReasons.includes('credential-boundary-review-required'),
    'MCP gateway drafts: credential boundary blocker is explicit',
  );
}

function testDescriptorDocsAndPackageScript(): void {
  const descriptor = actionSurfaceIntegrationKitMcpGatewayDraftDescriptor();
  equal(descriptor.authorizationRequired, true, 'MCP gateway descriptor: authorization is required');
  equal(descriptor.annotationsTrusted, false, 'MCP gateway descriptor: annotations are not trusted');
  equal(descriptor.deploysInfrastructure, false, 'MCP gateway descriptor: deployment is false');
  equal(descriptor.issuesCredentials, false, 'MCP gateway descriptor: credential issuance is false');
  equal(descriptor.rotatesCredentials, false, 'MCP gateway descriptor: credential rotation is false');
  equal(descriptor.activatesEnforcement, false, 'MCP gateway descriptor: enforcement activation is false');
  equal(descriptor.annotationAuthority, 'hint-only', 'MCP gateway descriptor: annotations are hint-only');
  equal(descriptor.customerGatewayRequired, true, 'MCP gateway descriptor: customer gateway is required');
  ok(
    descriptor.evidenceFields.includes('tool-result-or-denial-digest'),
    'MCP gateway descriptor: tool result or denial evidence is exposed',
  );

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-integration-kit-buildout.md');
  includes(doc, 'MCP Gateway Drafts', 'Integration kit doc: MCP gateway draft section exists');
  includes(
    doc,
    'action-surface-integration-kit-mcp-gateway-drafts.ts',
    'Integration kit doc: MCP gateway source is named',
  );
  includes(
    doc,
    'test:action-surface-integration-kit-mcp-gateway-drafts',
    'Integration kit doc: MCP gateway script is named',
  );
  excludes(
    doc,
    /MCP gateway drafts issue credentials/iu,
    'Integration kit doc: credential issuance is not overclaimed',
  );

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-integration-kit-mcp-gateway-drafts'],
    'tsx tests/action-surface-integration-kit-mcp-gateway-drafts.test.ts',
    'package.json exposes MCP gateway draft test',
  );
}

try {
  testMcpGatewayDraftCreatesReviewOnlyToolSchema();
  testCredentialIsolationChecksStayHumanReviewed();
  testDescriptorDocsAndPackageScript();
  console.log(`Action surface integration kit MCP gateway draft tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface integration kit MCP gateway draft tests failed:', error);
  process.exitCode = 1;
}
