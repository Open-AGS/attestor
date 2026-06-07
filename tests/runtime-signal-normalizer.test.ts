import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RUNTIME_SIGNAL_NORMALIZER_VERSION,
  normalizeRuntimeSignal,
  runtimeSignalNormalizerDescriptor,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const digestE = `sha256:${'e'.repeat(64)}`;
const eventTime = '2026-05-18T09:30:00Z';
const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';

function testDescriptorRecordsSourceFamiliesAndBoundary(): void {
  const descriptor = runtimeSignalNormalizerDescriptor();

  equal(descriptor.version, RUNTIME_SIGNAL_NORMALIZER_VERSION, 'Runtime signal normalizer: descriptor version is explicit');
  ok(descriptor.sourceKinds.includes('mcp-tool'), 'Runtime signal normalizer: MCP tool source is registered');
  ok(descriptor.sourceKinds.includes('openapi-operation'), 'Runtime signal normalizer: OpenAPI source is registered');
  ok(descriptor.sourceKinds.includes('asyncapi-operation'), 'Runtime signal normalizer: AsyncAPI source is registered');
  ok(descriptor.sourceKinds.includes('cloudevents-event'), 'Runtime signal normalizer: CloudEvents source is registered');
  ok(descriptor.sourceKinds.includes('otel-log'), 'Runtime signal normalizer: OTel log source is registered');
  equal(descriptor.sourceKindToSignalKind['openapi-operation'], 'declaration', 'Runtime signal normalizer: OpenAPI maps to declaration');
  equal(descriptor.sourceKindToSignalKind['otel-log'], 'observation', 'Runtime signal normalizer: OTel logs map to observation');
  equal(descriptor.sourceKindToTrustLevel['mcp-tool'], 'declared', 'Runtime signal normalizer: declaration sources stay declared');
  equal(descriptor.sourceKindToTrustLevel['cloudevents-event'], 'observed', 'Runtime signal normalizer: observation sources stay observed');
  equal(descriptor.digestOnly, true, 'Runtime signal normalizer: digest-only boundary is explicit');
  equal(descriptor.rejectsUnknownInputFields, true, 'Runtime signal normalizer: unknown inputs fail closed');
  equal(descriptor.rejectsRawPayloadFields, true, 'Runtime signal normalizer: raw payload fields are rejected');
  equal(descriptor.sourceInputDigestRequired, true, 'Runtime signal normalizer: source input digest is required');
  equal(descriptor.canGrantAuthority, false, 'Runtime signal normalizer: descriptor cannot grant authority');
  equal(descriptor.canAdmit, false, 'Runtime signal normalizer: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Runtime signal normalizer: descriptor cannot activate enforcement');
  equal(descriptor.productionReady, false, 'Runtime signal normalizer: descriptor is not production readiness');
}

function testMcpToolDeclarationFixture(): void {
  const result = normalizeRuntimeSignal({
    sourceKind: 'mcp-tool',
    sourceSystem: 'mcp.customer-tools',
    eventTime,
    toolName: 'export_customer_records',
    inputSchemaDigest: digestA,
    serverRef: 'customer-tools',
    actionSurface: 'data-export',
    downstreamSystem: 'mcp-tool-server',
    policyRefs: ['policy:data-export.v1'],
  });

  equal(result.version, RUNTIME_SIGNAL_NORMALIZER_VERSION, 'Runtime signal normalizer: MCP result version is explicit');
  equal(result.sourceKind, 'mcp-tool', 'Runtime signal normalizer: MCP source kind is preserved');
  equal(result.normalizedSourceRef, 'mcp.tool:customer-tools:export_customer_records', 'Runtime signal normalizer: MCP operation ref is normalized');
  equal(result.envelope.signalKind, 'declaration', 'Runtime signal normalizer: MCP tool is a declaration signal');
  equal(result.envelope.sourceTrustLevel, 'declared', 'Runtime signal normalizer: MCP declaration stays declared');
  equal(result.envelope.inputSchemaDigest, digestA, 'Runtime signal normalizer: MCP schema digest is bound');
  equal(result.envelope.argumentOrBodyDigest, null, 'Runtime signal normalizer: MCP declaration carries no raw arguments');
  ok(result.sourceInputDigest.startsWith('sha256:'), 'Runtime signal normalizer: MCP source input digest is generated');
  ok(result.normalizerDigest.startsWith('sha256:'), 'Runtime signal normalizer: MCP normalizer digest is generated');
  equal(result.canAdmit, false, 'Runtime signal normalizer: MCP result cannot admit');
  equal(result.activatesEnforcement, false, 'Runtime signal normalizer: MCP result cannot enforce');
}

function testOpenApiOperationDeclarationFixture(): void {
  const result = normalizeRuntimeSignal({
    sourceKind: 'openapi-operation',
    sourceSystem: 'openapi.customer-api',
    eventTime,
    method: 'post',
    path: '/api/v1/exports',
    operationId: 'createExport',
    inputSchemaDigest: digestB,
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
  });

  equal(result.normalizedSourceRef, 'POST /api/v1/exports#createExport', 'Runtime signal normalizer: OpenAPI method/path is normalized');
  equal(result.envelope.signalKind, 'declaration', 'Runtime signal normalizer: OpenAPI operation is a declaration');
  equal(result.envelope.sourceTrustLevel, 'declared', 'Runtime signal normalizer: OpenAPI operation stays declared');
  equal(result.envelope.operationRef, 'POST /api/v1/exports#createExport', 'Runtime signal normalizer: OpenAPI operation ref reaches envelope');
  equal(result.envelope.inputSchemaDigest, digestB, 'Runtime signal normalizer: OpenAPI schema digest reaches envelope');
  equal(result.rawPayloadStored, false, 'Runtime signal normalizer: OpenAPI result stores no raw payload');
}

function testAsyncApiOperationDeclarationFixture(): void {
  const result = normalizeRuntimeSignal({
    sourceKind: 'asyncapi-operation',
    sourceSystem: 'asyncapi.customer-events',
    eventTime,
    channel: 'customer.exports.requested',
    operationId: 'publishExportRequest',
    messageRef: 'messages.exportRequest',
    inputSchemaDigest: digestC,
    actionSurface: 'data-export',
    downstreamSystem: 'event-bus',
  });

  equal(
    result.normalizedSourceRef,
    'asyncapi.operation:publishExportRequest@customer.exports.requested#messages.exportRequest',
    'Runtime signal normalizer: AsyncAPI operation ref is normalized',
  );
  equal(result.envelope.signalKind, 'declaration', 'Runtime signal normalizer: AsyncAPI operation is a declaration');
  equal(result.envelope.sourceTrustLevel, 'declared', 'Runtime signal normalizer: AsyncAPI operation stays declared');
  equal(result.envelope.inputSchemaDigest, digestC, 'Runtime signal normalizer: AsyncAPI schema digest reaches envelope');
}

function testCloudEventsObservationFixtureBindsSourceInputDigest(): void {
  const first = normalizeRuntimeSignal({
    sourceKind: 'cloudevents-event',
    sourceSystem: 'cloudevents.customer-bus',
    eventTime,
    eventType: 'com.example.export.requested',
    eventSource: 'urn:customer:event-bus',
    eventIdDigest: digestA,
    subject: 'exports/request-001',
    dataSchemaDigest: digestB,
    dataDigest: digestC,
    actionSurface: 'data-export',
    downstreamSystem: 'event-router',
  });
  const second = normalizeRuntimeSignal({
    sourceKind: 'cloudevents-event',
    sourceSystem: 'cloudevents.customer-bus',
    eventTime,
    eventType: 'com.example.export.requested',
    eventSource: 'urn:customer:event-bus',
    eventIdDigest: digestD,
    subject: 'exports/request-001',
    dataSchemaDigest: digestB,
    dataDigest: digestC,
    actionSurface: 'data-export',
    downstreamSystem: 'event-router',
  });

  equal(first.envelope.signalKind, 'observation', 'Runtime signal normalizer: CloudEvents event is an observation');
  equal(first.envelope.sourceTrustLevel, 'observed', 'Runtime signal normalizer: CloudEvents event stays observed');
  equal(first.envelope.inputSchemaDigest, digestB, 'Runtime signal normalizer: CloudEvents data schema digest reaches envelope');
  equal(first.envelope.argumentOrBodyDigest, digestC, 'Runtime signal normalizer: CloudEvents data digest reaches envelope');
  equal(first.envelope.canAdmit, false, 'Runtime signal normalizer: CloudEvents observation cannot admit');
  assert.notEqual(
    first.sourceInputDigest,
    second.sourceInputDigest,
    'Runtime signal normalizer: CloudEvents event id digest changes source input digest',
  );
  passed += 1;
  assert.notEqual(
    first.normalizerDigest,
    second.normalizerDigest,
    'Runtime signal normalizer: CloudEvents event id digest changes normalizer digest',
  );
  passed += 1;
}

function testOtelLogObservationFixture(): void {
  const result = normalizeRuntimeSignal({
    sourceKind: 'otel-log',
    sourceSystem: 'otel.customer-collector',
    eventTime,
    serviceName: 'export-worker',
    logRecordRef: 'log-record:export-001',
    spanId: '00f067aa0ba902b7',
    eventName: 'export.intent.observed',
    severity: 'INFO',
    bodyDigest: digestE,
    traceId,
    actionSurface: 'data-export',
    downstreamSystem: 'export-worker',
  });

  equal(result.envelope.signalKind, 'observation', 'Runtime signal normalizer: OTel log is an observation');
  equal(result.envelope.sourceTrustLevel, 'observed', 'Runtime signal normalizer: OTel log stays observed');
  equal(result.envelope.traceId, traceId, 'Runtime signal normalizer: OTel trace id reaches envelope');
  equal(result.envelope.argumentOrBodyDigest, digestE, 'Runtime signal normalizer: OTel body digest reaches envelope');
  equal(result.envelope.operationRef, 'otel.log:export-worker:export.intent.observed#log-record:export-001', 'Runtime signal normalizer: OTel operation ref is normalized');
}

function testFailsClosedOnRawPayloadAuthorityAndInvalidSource(): void {
  throws(
    () =>
      normalizeRuntimeSignal({
        sourceKind: 'mcp-tool',
        sourceSystem: 'mcp.customer-tools',
        eventTime,
        toolName: 'export_customer_records',
        inputSchemaDigest: digestA,
        rawToolArguments: { customerId: 'raw-customer' },
      } as never),
    /raw payload field: rawToolArguments/u,
    'Runtime signal normalizer: raw tool arguments fail closed',
  );
  throws(
    () =>
      normalizeRuntimeSignal({
        sourceKind: 'openapi-operation',
        sourceSystem: 'openapi.customer-api',
        eventTime,
        method: 'CONNECT',
        path: '/api/v1/exports',
        inputSchemaDigest: digestB,
      }),
    /method must be a supported HTTP method/u,
    'Runtime signal normalizer: unsupported HTTP method fails closed',
  );
  throws(
    () =>
      normalizeRuntimeSignal({
        sourceKind: 'openapi-operation',
        sourceSystem: 'openapi.customer-api',
        eventTime,
        method: 'POST',
        path: '/api/v1/exports',
        inputSchemaDigest: 'raw-schema-id',
      }),
    /inputSchemaDigest must be a sha256 digest reference/u,
    'Runtime signal normalizer: raw schema identifiers fail closed',
  );
  throws(
    () =>
      normalizeRuntimeSignal({
        sourceKind: 'otel-log',
        sourceSystem: 'otel.customer-collector',
        eventTime,
        serviceName: 'export-worker',
        logRecordRef: 'log-record:export-001',
        body: 'raw log body',
      } as never),
    /raw payload field: body/u,
    'Runtime signal normalizer: raw log body fails closed',
  );
  throws(
    () =>
      normalizeRuntimeSignal({
        sourceKind: 'cloudevents-event',
        sourceSystem: 'cloudevents.customer-bus',
        eventTime,
        eventType: 'com.example.export.requested',
        eventSource: 'urn:customer:event-bus',
        eventIdDigest: digestA,
        canAdmit: true,
      } as never),
    /unknown field: canAdmit/u,
    'Runtime signal normalizer: authority upgrade input fails closed',
  );
}

function testDocsPackageAndProbeStayAligned(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-signal-handling.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile(
    'scripts',
    'probe',
    'probe-consequence-admission-package-surface.mjs',
  );

  includes(doc, 'RS04 Normalizer Layer', 'Runtime signal normalizer: architecture note names RS04');
  includes(doc, 'attestor.runtime-signal-normalizer.v1', 'Runtime signal normalizer: architecture note records version');
  equal(
    packageJson.scripts['test:runtime-signal-normalizer'],
    'tsx tests/runtime-signal-normalizer.test.ts',
    'Runtime signal normalizer: package script is registered',
  );
  includes(
    packageProbe,
    'RUNTIME_SIGNAL_NORMALIZER_VERSION',
    'Runtime signal normalizer: package surface probe covers version export',
  );
  includes(
    packageProbe,
    'normalizeRuntimeSignal',
    'Runtime signal normalizer: package surface probe covers normalizer export',
  );
}

testDescriptorRecordsSourceFamiliesAndBoundary();
testMcpToolDeclarationFixture();
testOpenApiOperationDeclarationFixture();
testAsyncApiOperationDeclarationFixture();
testCloudEventsObservationFixtureBindsSourceInputDigest();
testOtelLogObservationFixture();
testFailsClosedOnRawPayloadAuthorityAndInvalidSource();
testDocsPackageAndProbeStayAligned();

console.log(`Runtime signal normalizer tests: ${passed} passed, 0 failed`);
