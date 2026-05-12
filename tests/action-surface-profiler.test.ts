import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceProfilerDescriptor,
  createActionSurfaceProfilerReport,
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
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

function event(input: {
  readonly actor: string;
  readonly action: string;
  readonly domain: string;
  readonly downstreamSystem: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly occurredAt: string;
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: input.actor,
      action: input.action,
      domain: input.domain,
      downstreamSystem: input.downstreamSystem,
      requestedAt: '2026-05-12T09:00:00.000Z',
      decidedAt: '2026-05-12T09:00:01.000Z',
      policyRef: input.policyRef ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      recipient: 'raw_recipient_must_not_escape',
      observedFeatures: {
        rawFeature: input.observedFeatures?.rawFeature ?? 'raw_feature_must_not_escape',
      },
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: 'proceeded',
    observedFeatures: {
      rawFeature: 'raw_feature_must_not_escape',
    },
  });
}

function testProfilerCombinesShadowEventsAndDeclarations(): void {
  const report = createActionSurfaceProfilerReport({
    generatedAt: '2026-05-12T09:20:00.000Z',
    events: [
      event({
        actor: 'support-agent-a',
        action: 'issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        occurredAt: '2026-05-12T09:01:00.000Z',
      }),
      event({
        actor: 'support-agent-b',
        action: 'issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        policyRef: 'policy:refunds:v1',
        evidenceRefs: ['order:raw_must_not_escape'],
        occurredAt: '2026-05-12T09:02:00.000Z',
      }),
    ],
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
    ],
  });
  const text = JSON.stringify(report);
  const refund = report.profiles.find((profile) =>
    profile.actionSurface === 'refund-service.issue_refund'
  );
  const mcp = report.profiles.find((profile) =>
    profile.actionSurface === 'warehouse.export_customer_data'
  );

  equal(report.version, 'attestor.action-surface-profiler.v1', 'Action surface profiler: version is explicit');
  equal(report.surfaceCount, 2, 'Action surface profiler: surface count combines observed and declared');
  equal(report.observedSurfaceCount, 1, 'Action surface profiler: observed surface count is retained');
  equal(report.declaredSurfaceCount, 2, 'Action surface profiler: declared surface count is retained');
  equal(report.unobservedDeclaredSurfaceCount, 1, 'Action surface profiler: unobserved declarations are counted');
  equal(report.approvalRequired, true, 'Action surface profiler: approval is required');
  equal(report.autoEnforce, false, 'Action surface profiler: auto enforce is false');
  equal(report.rawPayloadStored, false, 'Action surface profiler: raw payload is not stored');
  equal(report.productionReady, false, 'Action surface profiler: production readiness is not claimed');
  ok(report.digest.startsWith('sha256:'), 'Action surface profiler: digest is generated');
  equal(refund?.eventCount, 2, 'Action surface profiler: refund events are grouped');
  equal(refund?.actorCount, 2, 'Action surface profiler: actor count is retained without raw payload');
  equal(refund?.credentialPosture, 'agent-held-static-secret', 'Action surface profiler: static credential exposure is surfaced');
  equal(refund?.recommendedIntegrationMode, 'gateway-proxy', 'Action surface profiler: OpenAPI write operation recommends gateway proxy');
  equal(refund?.nextStep, 'isolate-credential', 'Action surface profiler: direct credentials are isolated first');
  ok(refund?.signals.includes('direct-credential-risk'), 'Action surface profiler: direct credential signal is present');
  ok(refund?.signals.includes('missing-policy'), 'Action surface profiler: policy gap signal is present');
  ok(refund?.signals.includes('missing-evidence'), 'Action surface profiler: evidence gap signal is present');
  ok(refund?.signals.includes('http-write-operation'), 'Action surface profiler: HTTP write operation is detected');
  equal(mcp?.eventCount, 0, 'Action surface profiler: unobserved MCP surface has no events');
  equal(mcp?.recommendedIntegrationMode, 'mcp-tool-gateway', 'Action surface profiler: MCP tools recommend MCP gateway');
  equal(mcp?.nextStep, 'add-shadow-capture', 'Action surface profiler: unobserved declaration starts with shadow capture');
  ok(mcp?.signals.includes('mcp-tool-surface'), 'Action surface profiler: MCP tool surface signal is present');
  ok(mcp?.signals.includes('candidate-for-shadow-capture'), 'Action surface profiler: MCP declaration becomes shadow candidate');
  ok(!text.includes('raw_recipient_must_not_escape'), 'Action surface profiler: raw recipient is not serialized');
  ok(!text.includes('raw_feature_must_not_escape'), 'Action surface profiler: raw feature is not serialized');
  ok(!text.includes('order:raw_must_not_escape'), 'Action surface profiler: raw evidence ref is not serialized');
}

function testProviderAndWorkflowRecommendations(): void {
  const report = createActionSurfaceProfilerReport({
    generatedAt: '2026-05-12T09:30:00.000Z',
    declarations: [
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
  const deploy = report.profiles.find((profile) =>
    profile.actionSurface === 'github-actions.deploy_production'
  );
  const stripe = report.profiles.find((profile) =>
    profile.actionSurface === 'stripe.issue_refund'
  );

  equal(deploy?.recommendedIntegrationMode, 'sidecar-ext-authz', 'Action surface profiler: workflow manifests map to sidecar/ext-authz');
  ok(deploy?.signals.includes('workflow-execution'), 'Action surface profiler: workflow execution signal is present');
  equal(stripe?.recommendedIntegrationMode, 'provider-native-connector', 'Action surface profiler: provider logs map to provider-native connector');
  ok(stripe?.signals.includes('provider-native-surface'), 'Action surface profiler: provider-native signal is present');
  ok(report.recommendedNextSteps.includes('add-shadow-capture'), 'Action surface profiler: unobserved surfaces recommend shadow capture');
}

function testDescriptorAndDocs(): void {
  const descriptor = actionSurfaceProfilerDescriptor();
  equal(descriptor.autoEnforce, false, 'Action surface profiler descriptor: auto enforce is false');
  equal(descriptor.outputIsDecisionSupportOnly, true, 'Action surface profiler descriptor: output is decision support only');
  ok(descriptor.sourceKinds.includes('openapi'), 'Action surface profiler descriptor: OpenAPI source is listed');
  ok(descriptor.sourceKinds.includes('asyncapi'), 'Action surface profiler descriptor: AsyncAPI source is listed');
  ok(descriptor.sourceKinds.includes('mcp-tools'), 'Action surface profiler descriptor: MCP source is listed');

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-profiler.md');
  includes(doc, 'Action Surface Profiler', 'Action surface profiler doc: title exists');
  includes(doc, 'OpenAPI', 'Action surface profiler doc: OpenAPI anchor is documented');
  includes(doc, 'AsyncAPI', 'Action surface profiler doc: AsyncAPI anchor is documented');
  includes(doc, 'MCP', 'Action surface profiler doc: MCP anchor is documented');
  includes(doc, '`gateway-proxy`', 'Action surface profiler doc: gateway proxy recommendation is documented');

  const readme = readProjectFile('README.md');
  includes(readme, '[Action surface profiler](docs/02-architecture/action-surface-profiler.md)', 'README links action surface profiler');
  excludes(readme, /automatically makes downstream execution non-bypassable/iu, 'README does not overclaim automatic non-bypassability');

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-profiler'],
    'tsx tests/action-surface-profiler.test.ts',
    'package.json exposes action surface profiler test',
  );
}

try {
  testProfilerCombinesShadowEventsAndDeclarations();
  testProviderAndWorkflowRecommendations();
  testDescriptorAndDocs();
  console.log(`Action surface profiler tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface profiler tests failed:', error);
  process.exitCode = 1;
}
