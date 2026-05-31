import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceAutoContextDescriptor,
  createActionSurfaceAutoContext,
  createActionSurfaceAutoContextOnboardingPacket,
  ingestOpenApiActionSurfaceDeclarations,
  type ActionSurfaceAutoContextCandidate,
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

function firstCandidate(
  candidates: readonly ActionSurfaceAutoContextCandidate[],
): ActionSurfaceAutoContextCandidate {
  const candidate = candidates[0];
  assert.ok(candidate, 'Expected at least one auto-context candidate');
  return candidate;
}

function testMcpToolCallCreatesDigestOnlyObserveDraft(): void {
  const result = createActionSurfaceAutoContext({
    generatedAt: '2026-05-31T10:00:00.000Z',
    defaultActor: 'support-agent',
    signals: [
      {
        signalKind: 'mcp-tool-call',
        sourceRef: 'mcp://warehouse/tools/export_customer_data',
        producerRef: 'warehouse-mcp-prod',
        observedAt: '2026-05-31T10:00:01.000Z',
        downstreamSystem: 'Warehouse MCP',
        toolName: 'export_customer_data',
        credentialPosture: 'agent-held-static-secret',
        toolInputSchema: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
          },
        },
        toolArguments: {
          customerId: 'raw_customer_identifier_must_not_escape',
          token: 'sk_live_must_not_escape',
        },
      },
    ],
  });
  const text = JSON.stringify(result);
  const candidate = firstCandidate(result.candidates);

  equal(result.version, 'attestor.action-surface-auto-context.v1', 'Auto-context: version is explicit');
  equal(result.signalCount, 1, 'Auto-context: signal count is retained');
  equal(result.candidateCount, 1, 'Auto-context: candidate count is retained');
  equal(result.approvalRequired, true, 'Auto-context: approval is required');
  equal(result.autoEnforce, false, 'Auto-context: auto enforce is false');
  equal(result.canGrantAuthority, false, 'Auto-context: cannot grant authority');
  equal(result.activatesEnforcement, false, 'Auto-context: cannot activate enforcement');
  equal(result.rawPayloadStored, false, 'Auto-context: raw payload storage is false');
  equal(result.productionReady, false, 'Auto-context: production readiness is not claimed');
  equal(result.outputIsDecisionSupportOnly, true, 'Auto-context: output is decision support only');
  equal(candidate.signalKind, 'mcp-tool-call', 'Auto-context: MCP signal kind is retained');
  equal(candidate.actionSurface, 'warehouse_mcp.export_customer_data', 'Auto-context: MCP action surface is normalized');
  equal(candidate.domain, 'data-disclosure', 'Auto-context: MCP export infers data disclosure');
  equal(candidate.integrationModeHint, 'mcp-tool-gateway', 'Auto-context: MCP recommends tool gateway');
  equal(candidate.declaration.sourceKind, 'mcp-tools', 'Auto-context: declaration feeds MCP source kind');
  equal(candidate.genericAdmissionDraft.mode, 'observe', 'Auto-context: draft admission starts in observe mode');
  equal(candidate.genericAdmissionDraft.domain, 'data-disclosure', 'Auto-context: draft admission uses the inferred domain');
  ok(candidate.inputShapeDigest?.startsWith('sha256:'), 'Auto-context: input schema is digest-only');
  ok(candidate.argumentDigest?.startsWith('sha256:'), 'Auto-context: tool arguments are digest-only');
  ok(result.reviewChecklist.includes('policy-ref'), 'Auto-context: policy gap is listed');
  ok(result.reviewChecklist.includes('evidence-ref'), 'Auto-context: evidence gap is listed');
  ok(result.reviewChecklist.includes('enforcement-boundary'), 'Auto-context: enforcement gap is listed');
  ok(candidate.digest.startsWith('sha256:'), 'Auto-context: candidate digest is generated');
  ok(result.digest.startsWith('sha256:'), 'Auto-context: result digest is generated');
  excludes(text, /raw_customer_identifier_must_not_escape/u, 'Auto-context: raw tool args do not escape');
  excludes(text, /sk_live_must_not_escape/u, 'Auto-context: secret-like tool args do not escape');
  excludes(text, /warehouse-mcp-prod/u, 'Auto-context: producer ref is digest-only');

  const packet = createActionSurfaceAutoContextOnboardingPacket({
    autoContext: result,
    attestorBaseUrl: 'https://attestor.example.com',
  });
  equal(packet.status, 'requires-review', 'Auto-context: onboarding packet remains review-required');
  equal(packet.autoEnforce, false, 'Auto-context: onboarding packet does not auto-enforce');
  equal(packet.nonBypassableClaimAllowed, false, 'Auto-context: packet does not claim non-bypassability');
  ok(
    packet.surfacePlans[0]?.artifactKinds.includes('mcp-tool-gateway-config'),
    'Auto-context: MCP packet includes MCP gateway draft',
  );
}

function testOpenApiAttestorHintsStayMetadataOnly(): void {
  const ingestion = ingestOpenApiActionSurfaceDeclarations({
    openapi: '3.1.0',
    info: {
      title: 'Generic Admin API',
      version: '1.0.0',
    },
    'x-attestor': {
      downstreamSystem: 'identity-admin',
      credentialPosture: 'gateway-held-secret',
    },
    paths: {
      '/roles/grants': {
        post: {
          operationId: 'createRoleGrant',
          'x-attestor': {
            domain: 'authority-change',
            action: 'grant_admin_role',
            integrationModeHint: 'gateway-proxy',
          },
        },
      },
    },
  });
  const declaration = ingestion.declarations[0];

  equal(declaration?.domain, 'authority-change', 'OpenAPI hints: domain metadata is used');
  equal(declaration?.downstreamSystem, 'identity_admin', 'OpenAPI hints: downstream system is normalized');
  equal(declaration?.action, 'grant_admin_role', 'OpenAPI hints: action metadata is used');
  equal(declaration?.credentialPosture, 'gateway-held-secret', 'OpenAPI hints: credential posture is used');
  equal(declaration?.integrationModeHint, 'gateway-proxy', 'OpenAPI hints: integration mode is used');
  equal(ingestion.autoEnforce, false, 'OpenAPI hints: auto-enforce remains false');
  equal(ingestion.productionReady, false, 'OpenAPI hints: production readiness is not claimed');
}

function testTelemetrySignalsAreDiscoveryOnly(): void {
  const result = createActionSurfaceAutoContext({
    generatedAt: '2026-05-31T10:10:00.000Z',
    defaultActor: 'observe-agent',
    signals: [
      {
        signalKind: 'otel-span',
        spanName: 'POST /customer/export',
        httpMethod: 'POST',
        httpRoute: '/customer/export',
        downstreamSystem: 'customer-api',
      },
      {
        signalKind: 'cloudevents-event',
        cloudEventType: 'com.example.billing.refund.created',
        cloudEventSource: 'billing-events',
        cloudEventSubject: 'raw_subject_must_not_escape',
      },
    ],
  });
  const [httpCandidate, eventCandidate] = result.candidates;
  const text = JSON.stringify(result);

  equal(httpCandidate?.declaration.sourceKind, 'provider-log', 'Auto-context telemetry: OTel maps to provider-log source');
  equal(httpCandidate?.integrationModeHint, 'shadow-capture-sdk', 'Auto-context telemetry: OTel starts as shadow capture');
  equal(httpCandidate?.domain, 'data-disclosure', 'Auto-context telemetry: HTTP route can infer data disclosure');
  equal(eventCandidate?.domain, 'money-movement', 'Auto-context telemetry: CloudEvent type can infer money movement');
  equal(result.autoEnforce, false, 'Auto-context telemetry: auto-enforce is false');
  equal(result.canGrantAuthority, false, 'Auto-context telemetry: cannot grant authority');
  equal(result.activatesEnforcement, false, 'Auto-context telemetry: cannot activate enforcement');
  excludes(text, /raw_subject_must_not_escape/u, 'Auto-context telemetry: CloudEvent subject raw text does not escape');
}

function testDescriptorDocsAndPackageScript(): void {
  const descriptor = actionSurfaceAutoContextDescriptor();
  equal(descriptor.outputIsDecisionSupportOnly, true, 'Auto-context descriptor: decision-support only');
  equal(descriptor.autoEnforce, false, 'Auto-context descriptor: auto-enforce is false');
  equal(descriptor.canGrantAuthority, false, 'Auto-context descriptor: cannot grant authority');
  ok(descriptor.signalKinds.includes('mcp-tool-call'), 'Auto-context descriptor: MCP call signals are listed');
  ok(descriptor.signalKinds.includes('otel-span'), 'Auto-context descriptor: OTel signals are listed');

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-auto-context.md');
  includes(doc, 'Action Surface Auto-Context', 'Auto-context doc: title exists');
  includes(doc, 'MCP tool definitions or tool calls', 'Auto-context doc: MCP input is documented');
  includes(doc, 'OpenAPI', 'Auto-context doc: OpenAPI input is documented');
  includes(doc, 'OpenTelemetry', 'Auto-context doc: OTel input is documented');
  includes(doc, '`x-attestor`', 'Auto-context doc: OpenAPI hints are documented');
  includes(doc, 'The primary next document is', 'Auto-context doc: names one primary next document');
  includes(doc, 'Supporting pieces stay inside that path:', 'Auto-context doc: keeps supporting pieces nested');
  includes(doc, 'auto-context can suggest and digest', 'Auto-context doc: authority boundary is documented');
  excludes(doc, /auto-context proves production readiness/iu, 'Auto-context doc: production readiness is not overclaimed');

  const docsReadme = readProjectFile('docs', 'README.md');
  includes(
    docsReadme,
    '[Action surface auto-context](02-architecture/action-surface-auto-context.md)',
    'Auto-context docs: docs front door links auto-context',
  );

  const readme = readProjectFile('README.md');
  includes(
    readme,
    '[Action surface auto-context](docs/02-architecture/action-surface-auto-context.md)',
    'Auto-context docs: README links auto-context',
  );

  const navigator = readProjectFile('docs', '01-overview', 'repository-navigator.md');
  includes(
    navigator,
    '[Action surface auto-context](../02-architecture/action-surface-auto-context.md)',
    'Auto-context docs: repository navigator links auto-context',
  );

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-auto-context'],
    'tsx tests/action-surface-auto-context.test.ts',
    'package.json exposes auto-context test',
  );
}

try {
  testMcpToolCallCreatesDigestOnlyObserveDraft();
  testOpenApiAttestorHintsStayMetadataOnly();
  testTelemetrySignalsAreDiscoveryOnly();
  testDescriptorDocsAndPackageScript();
  console.log(`Action surface auto-context tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface auto-context tests failed:', error);
  process.exitCode = 1;
}
