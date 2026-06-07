import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RUNTIME_SIGNAL_EXAMPLE_PATH_VERSION,
  createRuntimeSignalExamplePath,
} from '../examples/runtime-signal-path/metadata-to-gate-plan.js';

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

function includes<T>(values: readonly T[] | string, expected: T | string, message: string): void {
  if (typeof values === 'string' && typeof expected === 'string') {
    assert.ok(values.includes(expected), `${message}\nExpected to find: ${expected}`);
  } else {
    assert.ok(
      (values as readonly T[]).includes(expected as T),
      `${message}\nExpected to find: ${String(expected)}`,
    );
  }
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function stepByLabel(label: string) {
  const step = createRuntimeSignalExamplePath().steps.find((candidate) => candidate.label === label);
  assert.ok(step, `Runtime signal example path: expected step ${label}`);
  return step;
}

function testExamplePathBoundaryIsReviewOnly(): void {
  const example = createRuntimeSignalExamplePath();

  equal(example.version, RUNTIME_SIGNAL_EXAMPLE_PATH_VERSION, 'Runtime signal example path: version is explicit');
  equal(example.scope, 'metadata-to-signal-to-candidate-to-gate-plan', 'Runtime signal example path: scope names the local path');
  equal(example.digestOnly, true, 'Runtime signal example path: example is digest-only');
  equal(example.reviewMaterialOnly, true, 'Runtime signal example path: example is review material only');
  equal(example.rawPayloadStored, false, 'Runtime signal example path: raw payloads are not stored');
  equal(example.rawPromptStored, false, 'Runtime signal example path: raw prompts are not stored');
  equal(example.rawToolPayloadStored, false, 'Runtime signal example path: raw tool payloads are not stored');
  equal(example.rawProviderBodyStored, false, 'Runtime signal example path: raw provider bodies are not stored');
  equal(example.grantsAuthority, false, 'Runtime signal example path: example grants no authority');
  equal(example.canGrantAuthority, false, 'Runtime signal example path: example cannot grant authority');
  equal(example.canAdmit, false, 'Runtime signal example path: example cannot admit');
  equal(example.activatesEnforcement, false, 'Runtime signal example path: example cannot activate enforcement');
  equal(example.autoEnforce, false, 'Runtime signal example path: example cannot auto-enforce');
  equal(example.productionReady, false, 'Runtime signal example path: example is not production readiness');
  equal(example.outputIsDecisionSupportOnly, true, 'Runtime signal example path: example remains decision support only');
  equal(example.steps.length, 3, 'Runtime signal example path: OpenAPI, MCP, and OTel steps are present');
}

function testOpenApiMetadataFlowsToHttpGatewayPlan(): void {
  const step = stepByLabel('openapi-export-route');

  equal(step.sourceKind, 'openapi-operation', 'Runtime signal example path: OpenAPI source is represented');
  equal(step.signalKind, 'declaration', 'Runtime signal example path: OpenAPI operation becomes declaration signal');
  equal(step.sourceTrustLevel, 'declared', 'Runtime signal example path: OpenAPI trust is declared');
  equal(step.actionSurface, 'data-export', 'Runtime signal example path: OpenAPI action surface is preserved');
  equal(step.consequenceClass, 'data-movement', 'Runtime signal example path: OpenAPI export maps to data movement');
  equal(step.gatePlan.mode, 'gateway-proxy', 'Runtime signal example path: OpenAPI write operation maps to gateway-proxy mode');
  equal(step.gatePlan.placement, 'http-gateway-proxy', 'Runtime signal example path: OpenAPI gate placement is HTTP gateway');
  equal(step.gatePlan.readinessStatus, 'no-go', 'Runtime signal example path: OpenAPI declaration alone is no-go');
  equal(step.gatePlan.nonBypassableClaimAllowed, false, 'Runtime signal example path: OpenAPI metadata cannot claim non-bypassable');
  includes(step.gatePlan.missingControls, 'source-binding-missing', 'Runtime signal example path: OpenAPI source binding remains missing');
  includes(step.gatePlan.noGoReasons, 'missing-admission-call', 'Runtime signal example path: OpenAPI path still needs admission call evidence');
  ok(step.signalDigest.startsWith('sha256:'), 'Runtime signal example path: OpenAPI signal digest is present');
  ok(step.candidateDigest.startsWith('sha256:'), 'Runtime signal example path: OpenAPI candidate digest is present');
}

function testMcpToolMetadataFlowsToMcpGatewayPlan(): void {
  const step = stepByLabel('mcp-export-tool');

  equal(step.sourceKind, 'mcp-tool', 'Runtime signal example path: MCP source is represented');
  equal(step.signalKind, 'declaration', 'Runtime signal example path: MCP tool becomes declaration signal');
  equal(step.sourceTrustLevel, 'declared', 'Runtime signal example path: MCP trust is declared');
  equal(step.consequenceClass, 'data-movement', 'Runtime signal example path: MCP export maps to data movement');
  equal(step.gatePlan.mode, 'mcp-tool-gateway', 'Runtime signal example path: MCP tool maps to MCP gateway mode');
  equal(step.gatePlan.placement, 'mcp-tool-gateway', 'Runtime signal example path: MCP gate placement is explicit');
  equal(step.gatePlan.readinessStatus, 'no-go', 'Runtime signal example path: MCP declaration alone is no-go');
  includes(step.normalizedSourceRef, 'mcp.tool:', 'Runtime signal example path: MCP normalized source ref is a tool ref');
  includes(step.gatePlan.missingControls, 'gate-proof-missing', 'Runtime signal example path: MCP gate proof remains missing');
  includes(step.gatePlan.noGoReasons, 'missing-adapter-or-proxy', 'Runtime signal example path: MCP gateway remains unproven');
}

function testOtelObservationFlowsToShadowOnlyPlan(): void {
  const step = stepByLabel('otel-export-observation');

  equal(step.sourceKind, 'otel-log', 'Runtime signal example path: OTel source is represented');
  equal(step.signalKind, 'observation', 'Runtime signal example path: OTel log becomes observation signal');
  equal(step.sourceTrustLevel, 'observed', 'Runtime signal example path: OTel trust is observed');
  equal(step.consequenceClass, 'data-movement', 'Runtime signal example path: OTel export maps to data movement');
  equal(step.gatePlan.mode, 'shadow-capture-sdk', 'Runtime signal example path: OTel observation maps to shadow capture mode');
  equal(step.gatePlan.placement, 'shadow-capture', 'Runtime signal example path: OTel placement is shadow capture');
  equal(step.gatePlan.readinessStatus, 'no-go', 'Runtime signal example path: OTel observation alone is no-go');
  includes(step.gatePlan.missingControls, 'schema-digest-missing', 'Runtime signal example path: OTel schema digest remains missing');
  includes(step.gatePlan.noGoReasons, 'missing-admission-call', 'Runtime signal example path: shadow capture still needs admission evidence');
}

function testDocsPackageAndNoModelNameBoundaryStayAligned(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-signal-handling.md',
  );
  const example = readProjectFile(
    'examples',
    'runtime-signal-path',
    'metadata-to-gate-plan.ts',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const forbiddenModelNamePattern = new RegExp(
    `\\b(${
      [
        ['Co', 'dex'].join(''),
        ['G', 'PT'].join(''),
        ['Clau', 'de'].join(''),
        ['Op', 'us'].join(''),
      ].join('|')
    })\\b`,
    'u',
  );

  includes(doc, 'RS12 Example Path', 'Runtime signal example path: architecture note names RS12');
  includes(doc, 'examples/runtime-signal-path/metadata-to-gate-plan.ts', 'Runtime signal example path: architecture note names example path');
  includes(doc, 'OpenAPI/MCP/OpenTelemetry', 'Runtime signal example path: architecture note names the three example source families');
  includes(doc, '`example path != live run`', 'Runtime signal example path: architecture note keeps live-run no-claim');
  equal(
    packageJson.scripts['test:runtime-signal-example-path'],
    'tsx tests/runtime-signal-example-path.test.ts',
    'Runtime signal example path: package script is registered',
  );
  excludes(example, forbiddenModelNamePattern, 'Runtime signal example path: example source has no model or tool names');
}

testExamplePathBoundaryIsReviewOnly();
testOpenApiMetadataFlowsToHttpGatewayPlan();
testMcpToolMetadataFlowsToMcpGatewayPlan();
testOtelObservationFlowsToShadowOnlyPlan();
testDocsPackageAndNoModelNameBoundaryStayAligned();

console.log(`Runtime signal example path tests: ${passed} passed, 0 failed`);
