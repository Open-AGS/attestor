import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceDeclarationIngestorsDescriptor,
  createActionSurfaceProfilerReport,
  ingestAsyncApiActionSurfaceDeclarations,
  ingestMcpToolActionSurfaceDeclarations,
  ingestOpenApiActionSurfaceDeclarations,
  ingestWorkflowActionSurfaceDeclarations,
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

function testOpenApiIngestionProducesDataMinimizedDeclarations(): void {
  const result = ingestOpenApiActionSurfaceDeclarations({
    openapi: '3.1.0',
    info: {
      title: 'Refund API',
      version: '1.0.0',
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/refunds': {
        post: {
          operationId: 'issueRefund',
          tags: ['refunds'],
          summary: 'Issue a customer refund',
          description: 'raw_customer_payload_must_not_escape',
        },
      },
      '/customers/{id}/export': {
        get: {
          operationId: 'exportCustomerData',
          tags: ['customers', 'exports'],
          summary: 'Export customer data',
        },
      },
    },
  }, {
    sourceRef: 'openapi://refund-service',
  });
  const text = JSON.stringify(result);
  const refund = result.declarations.find((item) =>
    item.actionSurface === 'refund_api.issue_refund'
  );
  const exportCustomer = result.declarations.find((item) =>
    item.actionSurface === 'refund_api.export_customer_data'
  );

  equal(result.version, 'attestor.action-surface-declaration-ingestors.v1', 'OpenAPI ingestor: version is explicit');
  equal(result.sourceKind, 'openapi', 'OpenAPI ingestor: source kind is openapi');
  equal(result.declarationCount, 2, 'OpenAPI ingestor: declarations are produced per operation');
  equal(result.approvalRequired, true, 'OpenAPI ingestor: approval is required');
  equal(result.autoEnforce, false, 'OpenAPI ingestor: auto enforce is false');
  equal(result.rawPayloadStored, false, 'OpenAPI ingestor: raw payload storage is false');
  equal(result.productionReady, false, 'OpenAPI ingestor: production readiness is not claimed');
  ok(result.digest.startsWith('sha256:'), 'OpenAPI ingestor: digest is generated');
  equal(refund?.domain, 'money-movement', 'OpenAPI ingestor: refund operation maps to money movement');
  equal(refund?.method, 'POST', 'OpenAPI ingestor: method is normalized');
  equal(refund?.path, '/refunds', 'OpenAPI ingestor: path is retained as metadata');
  equal(refund?.integrationModeHint, 'gateway-proxy', 'OpenAPI ingestor: write operations hint gateway proxy');
  equal(exportCustomer?.domain, 'data-disclosure', 'OpenAPI ingestor: export operation maps to data disclosure');
  ok(!text.includes('raw_customer_payload_must_not_escape'), 'OpenAPI ingestor: operation descriptions are not serialized');

  const profile = createActionSurfaceProfilerReport({
    generatedAt: '2026-05-12T13:15:00.000Z',
    declarations: result.declarations,
  });
  const refundProfile = profile.profiles.find((item) =>
    item.actionSurface === 'refund_api.issue_refund'
  );
  equal(refundProfile?.recommendedIntegrationMode, 'gateway-proxy', 'OpenAPI ingestor: profiler can consume generated declarations');
}

function testAsyncApiIngestionSupportsV3OperationsAndV2Channels(): void {
  const v3 = ingestAsyncApiActionSurfaceDeclarations({
    asyncapi: '3.0.0',
    info: {
      title: 'Billing Events',
      version: '1.0.0',
    },
    channels: {
      RefundIssued: {
        address: 'billing.refunds.issued',
      },
    },
    operations: {
      ConsumeRefundIssued: {
        action: 'receive',
        channel: {
          $ref: '#/channels/RefundIssued',
        },
        summary: 'Consume refund issue events',
      },
    },
  });
  const v2 = ingestAsyncApiActionSurfaceDeclarations({
    asyncapi: '2.6.0',
    info: {
      title: 'Notification Events',
      version: '1.0.0',
    },
    channels: {
      'customer/notifications': {
        publish: {
          summary: 'Publish customer notification',
        },
      },
    },
  });

  equal(v3.declarationCount, 1, 'AsyncAPI ingestor: v3 operations are ingested');
  equal(v3.declarations[0]?.channel, 'RefundIssued', 'AsyncAPI ingestor: v3 channel refs are normalized');
  equal(v3.declarations[0]?.domain, 'money-movement', 'AsyncAPI ingestor: refund events infer money movement');
  equal(v2.declarationCount, 1, 'AsyncAPI ingestor: v2 channel operations are ingested');
  equal(v2.declarations[0]?.channel, 'customer/notifications', 'AsyncAPI ingestor: v2 channel name is retained');
  equal(v2.declarations[0]?.domain, 'external-communication', 'AsyncAPI ingestor: notifications infer external communication');
}

function testMcpAndWorkflowIngestionAvoidRawSecrets(): void {
  const mcp = ingestMcpToolActionSurfaceDeclarations({
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
  });
  const workflow = ingestWorkflowActionSurfaceDeclarations({
    name: 'Deploy production',
    permissions: {
      contents: 'read',
      deployments: 'write',
    },
    jobs: {
      deploy_production: {
        name: 'Deploy production',
        runsOn: 'ubuntu-latest',
        steps: [
          {
            name: 'Deploy',
            env: {
              CANARY_ENV: '${{ secrets.DO_NOT_SERIALIZE_NAME }}',
            },
            run: 'raw_deploy_command_must_not_escape',
          },
        ],
      },
    },
  }, {
    sourceRef: '.github/workflows/deploy.yml',
  });
  const text = `${JSON.stringify(mcp)}\n${JSON.stringify(workflow)}`;

  equal(mcp.declarations[0]?.sourceKind, 'mcp-tools', 'MCP ingestor: source kind is MCP tools');
  equal(mcp.declarations[0]?.actionSurface, 'warehouse_mcp.export_customer_data', 'MCP ingestor: tool name becomes action surface');
  equal(mcp.declarations[0]?.integrationModeHint, 'mcp-tool-gateway', 'MCP ingestor: tool gateway hint is set');
  equal(workflow.declarations[0]?.sourceKind, 'workflow-manifest', 'Workflow ingestor: source kind is workflow manifest');
  equal(workflow.declarations[0]?.domain, 'system-operation', 'Workflow ingestor: deploy job maps to system operation');
  equal(workflow.declarations[0]?.credentialPosture, 'agent-held-static-secret', 'Workflow ingestor: secret references are surfaced as direct credential risk');
  equal(workflow.declarations[0]?.integrationModeHint, 'sidecar-ext-authz', 'Workflow ingestor: workflow execution hints sidecar/ext-authz');
  ok(!text.includes('DO_NOT_SERIALIZE_NAME'), 'Workflow ingestor: secret names are not serialized');
  ok(!text.includes('raw_deploy_command_must_not_escape'), 'Workflow ingestor: run commands are not serialized');
  ok(!text.includes('raw_tool_description_must_not_escape'), 'MCP ingestor: tool descriptions are not serialized');
}

function testDescriptorDocsAndPackageScript(): void {
  const descriptor = actionSurfaceDeclarationIngestorsDescriptor();
  equal(descriptor.outputIsDeclarationOnly, true, 'Declaration ingestors descriptor: output is declaration only');
  equal(descriptor.liveProviderAccessRequired, false, 'Declaration ingestors descriptor: live provider access is not required');
  ok(descriptor.sourceKinds.includes('openapi'), 'Declaration ingestors descriptor: OpenAPI is supported');
  ok(descriptor.sourceKinds.includes('workflow-manifest'), 'Declaration ingestors descriptor: workflow manifests are supported');

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-declaration-ingestors.md');
  includes(doc, 'Action Surface Declaration Ingestors', 'Declaration ingestors doc: title exists');
  includes(doc, 'OpenAPI', 'Declaration ingestors doc: OpenAPI is documented');
  includes(doc, 'AsyncAPI', 'Declaration ingestors doc: AsyncAPI is documented');
  includes(doc, 'MCP', 'Declaration ingestors doc: MCP is documented');
  excludes(doc, /auto-enforce/iu, 'Declaration ingestors doc: does not claim auto-enforce');

  const onboardingDoc = readProjectFile('docs', '02-architecture', 'action-surface-onboarding-packet.md');
  includes(
    onboardingDoc,
    '[Action Surface Declaration\nIngestors](action-surface-declaration-ingestors.md)',
    'Onboarding packet embeds declaration ingestors link',
  );

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-ingestors'],
    'tsx tests/action-surface-declaration-ingestors.test.ts',
    'package.json exposes declaration ingestors test',
  );
}

try {
  testOpenApiIngestionProducesDataMinimizedDeclarations();
  testAsyncApiIngestionSupportsV3OperationsAndV2Channels();
  testMcpAndWorkflowIngestionAvoidRawSecrets();
  testDescriptorDocsAndPackageScript();
  console.log(`Action surface declaration ingestors tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface declaration ingestors tests failed:', error);
  process.exitCode = 1;
}
