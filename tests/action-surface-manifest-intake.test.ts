import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceManifestIntakeDescriptor,
  createActionSurfaceProfilerReport,
  ingestActionSurfaceManifestText,
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
  assert.ok(content.includes(expected), message);
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function testYamlOpenApiManifestIntake(): void {
  const result = ingestActionSurfaceManifestText(`
openapi: 3.1.0
info:
  title: Refund API
  version: 1.0.0
paths:
  /refunds:
    post:
      operationId: issueRefund
      summary: Issue a customer refund
      description: raw_yaml_payload_must_not_escape
      tags:
        - refunds
`, {
    sourceRef: 'openapi/refund.yaml',
  });
  const text = JSON.stringify(result);
  const refund = result.declarations[0];

  equal(result.version, 'attestor.action-surface-manifest-intake.v1', 'Manifest intake: version is explicit');
  equal(result.format, 'yaml', 'Manifest intake: YAML format is detected from source ref');
  equal(result.manifestKind, 'openapi', 'Manifest intake: OpenAPI kind is detected');
  equal(result.declarationCount, 1, 'Manifest intake: OpenAPI declaration is produced');
  equal(result.approvalRequired, true, 'Manifest intake: approval is required');
  equal(result.autoEnforce, false, 'Manifest intake: auto enforce is false');
  equal(result.rawPayloadStored, false, 'Manifest intake: raw payload storage is false');
  equal(result.productionReady, false, 'Manifest intake: production readiness is not claimed');
  ok(result.contentDigest.startsWith('sha256:'), 'Manifest intake: content digest is produced without raw text');
  ok(result.digest.startsWith('sha256:'), 'Manifest intake: result digest is produced');
  equal(refund?.actionSurface, 'refund_api.issue_refund', 'Manifest intake: OpenAPI operation becomes action surface');
  equal(refund?.domain, 'money-movement', 'Manifest intake: refund operation maps to money movement');
  equal(refund?.integrationModeHint, 'gateway-proxy', 'Manifest intake: OpenAPI write operation hints gateway proxy');
  ok(!text.includes('raw_yaml_payload_must_not_escape'), 'Manifest intake: YAML operation descriptions are not serialized');

  const report = createActionSurfaceProfilerReport({
    generatedAt: '2026-05-12T14:00:00.000Z',
    declarations: result.declarations,
  });
  equal(report.profiles[0]?.recommendedIntegrationMode, 'gateway-proxy', 'Manifest intake: profiler consumes manifest declarations');
}

function testJsonMcpManifestIntake(): void {
  const result = ingestActionSurfaceManifestText(JSON.stringify({
    serverName: 'Warehouse MCP',
    tools: [
      {
        name: 'export_customer_data',
        description: 'raw_tool_description_must_not_escape',
        inputSchema: {
          type: 'object',
        },
      },
    ],
  }), {
    sourceRef: 'mcp-tools.json',
  });
  const text = JSON.stringify(result);

  equal(result.format, 'json', 'Manifest intake: JSON format is detected');
  equal(result.manifestKind, 'mcp-tools', 'Manifest intake: MCP tools kind is detected');
  equal(result.declarations[0]?.actionSurface, 'warehouse_mcp.export_customer_data', 'Manifest intake: MCP tool becomes action surface');
  equal(result.declarations[0]?.integrationModeHint, 'mcp-tool-gateway', 'Manifest intake: MCP tool gateway hint is set');
  ok(!text.includes('raw_tool_description_must_not_escape'), 'Manifest intake: MCP descriptions are not serialized');
}

function testWorkflowYamlManifestIntakeDetectsSecretRisk(): void {
  const result = ingestActionSurfaceManifestText(`
name: Deploy production
on:
  workflow_dispatch:
permissions:
  contents: read
  deployments: write
jobs:
  deploy_production:
    name: Deploy production
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        env:
          CANARY_ENV: \${{ secrets.DO_NOT_SERIALIZE_NAME }}
        run: raw_workflow_command_must_not_escape
`, {
    sourceRef: '.github/workflows/deploy.yml',
  });
  const text = JSON.stringify(result);
  const deploy = result.declarations[0];

  equal(result.manifestKind, 'workflow-manifest', 'Manifest intake: workflow manifest is detected');
  equal(deploy?.domain, 'system-operation', 'Manifest intake: deploy jobs map to system operation');
  equal(deploy?.credentialPosture, 'agent-held-static-secret', 'Manifest intake: workflow secret references become credential-risk posture');
  equal(deploy?.integrationModeHint, 'sidecar-ext-authz', 'Manifest intake: workflow execution hints sidecar/ext-authz');
  ok(!text.includes('DO_NOT_SERIALIZE_NAME'), 'Manifest intake: workflow secret names are not serialized');
  ok(!text.includes('raw_workflow_command_must_not_escape'), 'Manifest intake: workflow commands are not serialized');
}

function testLimitsAndExplicitKind(): void {
  assert.throws(
    () => ingestActionSurfaceManifestText('{"tools":[]}', {
      maxBytes: 4,
    }),
    /larger than 4 bytes/u,
    'Manifest intake: oversized manifests are rejected before parsing',
  );
  passed += 1;

  assert.throws(
    () => ingestActionSurfaceManifestText('not: a recognized manifest', {
      sourceRef: 'unknown.yml',
    }),
    /could not detect manifest kind/u,
    'Manifest intake: unknown manifests fail closed unless kind is explicit',
  );
  passed += 1;

  const asyncapi = ingestActionSurfaceManifestText(`
channels:
  customer/notifications:
    publish:
      summary: Publish customer notification
`, {
    manifestKind: 'asyncapi',
    sourceRef: 'legacy-asyncapi.yml',
    downstreamSystem: 'notification-events',
  });
  equal(asyncapi.manifestKind, 'asyncapi', 'Manifest intake: explicit manifest kind is honored');
  equal(asyncapi.declarations[0]?.domain, 'external-communication', 'Manifest intake: explicit AsyncAPI channel maps to communication');
}

function testDescriptorDocsPackageAndDependency(): void {
  const descriptor = actionSurfaceManifestIntakeDescriptor();
  equal(descriptor.defaultMaxBytes, 524288, 'Manifest intake descriptor: default size limit is explicit');
  equal(descriptor.liveProviderAccessRequired, false, 'Manifest intake descriptor: live provider access is not required');
  ok(descriptor.formats.includes('yaml'), 'Manifest intake descriptor: YAML is supported');
  ok(descriptor.manifestKinds.includes('workflow-manifest'), 'Manifest intake descriptor: workflow manifests are supported');

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-manifest-intake.md');
  includes(doc, 'Action Surface Manifest Intake', 'Manifest intake doc: title exists');
  includes(doc, 'YAML', 'Manifest intake doc: YAML support is documented');
  includes(doc, '512 KiB', 'Manifest intake doc: size limit is documented');
  excludes(doc, /production-ready because of manifest intake/iu, 'Manifest intake doc: does not overclaim production readiness');

  const readme = readProjectFile('README.md');
  includes(readme, '[Action surface manifest intake](docs/02-architecture/action-surface-manifest-intake.md)', 'README links manifest intake');

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly dependencies: Record<string, string>;
    readonly devDependencies: Record<string, string>;
    readonly scripts: Record<string, string>;
  };
  equal(pkg.dependencies['js-yaml'], '^4.1.1', 'Manifest intake package: js-yaml is a direct dependency');
  equal(pkg.devDependencies['@types/js-yaml'], '^4.0.9', 'Manifest intake package: js-yaml types are direct dev dependency');
  equal(
    pkg.scripts['test:action-surface-manifest-intake'],
    'tsx tests/action-surface-manifest-intake.test.ts',
    'Manifest intake package: test script is exposed',
  );
}

try {
  testYamlOpenApiManifestIntake();
  testJsonMcpManifestIntake();
  testWorkflowYamlManifestIntakeDetectsSecretRisk();
  testLimitsAndExplicitKind();
  testDescriptorDocsPackageAndDependency();
  console.log(`Action surface manifest intake tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface manifest intake tests failed:', error);
  process.exitCode = 1;
}
