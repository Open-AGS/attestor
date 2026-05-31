import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceIntegrationKitNoBypassProbeBundleDescriptor,
  createActionSurfaceIntegrationKitNoBypassProbeBundle,
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

function createMultiModeKit() {
  const onboardingPacket = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-31T12:00:00.000Z',
    declarations: [
      {
        sourceKind: 'openapi',
        actionSurface: 'payments.issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        action: 'issue_refund',
        method: 'POST',
        path: '/refunds',
        credentialPosture: 'gateway-held-secret',
        integrationModeHint: 'gateway-proxy',
      },
      {
        sourceKind: 'mcp-tools',
        actionSurface: 'warehouse.export_customer_data',
        domain: 'data-disclosure',
        downstreamSystem: 'warehouse-mcp',
        action: 'export_customer_data',
        toolName: 'export_customer_data',
        credentialPosture: 'gateway-held-secret',
        integrationModeHint: 'mcp-tool-gateway',
      },
      {
        sourceKind: 'manual',
        actionSurface: 'crm.update_account',
        domain: 'custom',
        downstreamSystem: 'crm',
        action: 'update_account',
        operationRef: 'PATCH /accounts/{id}',
        credentialPosture: 'short-lived-downscoped-token',
        integrationModeHint: 'sdk-gate',
      },
    ],
  });
  return createActionSurfaceIntegrationKitPacket({
    packet: onboardingPacket,
    generatedAt: '2026-05-31T12:01:00.000Z',
  });
}

function testBundleExpandsProbePlanWithoutRunning(): void {
  const kit = createMultiModeKit();
  const bundle = createActionSurfaceIntegrationKitNoBypassProbeBundle({
    kit,
    generatedAt: '2026-05-31T12:02:00.000Z',
  });
  const text = JSON.stringify(bundle);

  equal(
    bundle.version,
    'attestor.action-surface-integration-kit-no-bypass-probe-bundle.v1',
    'No-bypass probe bundle: version is explicit',
  );
  equal(bundle.sourceKitDigest, kit.digest, 'No-bypass probe bundle: source kit digest is retained');
  equal(
    bundle.sourceProbePlanDigest,
    kit.noBypassProbePlan.digest,
    'No-bypass probe bundle: source probe plan digest is retained',
  );
  equal(bundle.surfaceCount, 3, 'No-bypass probe bundle: three surfaces are counted');
  equal(bundle.probeCaseCount, 18, 'No-bypass probe bundle: six probes are created per surface');
  ok(bundle.modes.includes('gateway-proxy'), 'No-bypass probe bundle: gateway mode is covered');
  ok(bundle.modes.includes('mcp-tool-gateway'), 'No-bypass probe bundle: MCP mode is covered');
  ok(bundle.modes.includes('sdk-gate'), 'No-bypass probe bundle: SDK mode is covered');
  equal(bundle.autoEnforce, false, 'No-bypass probe bundle: auto enforce is false');
  equal(bundle.deploysInfrastructure, false, 'No-bypass probe bundle: deployment is false');
  equal(bundle.executesProbes, false, 'No-bypass probe bundle: probe execution is false');
  equal(bundle.proofResultRecorded, false, 'No-bypass probe bundle: proof result is not recorded');
  equal(bundle.productionReady, false, 'No-bypass probe bundle: production readiness is false');
  equal(
    bundle.nonBypassableClaimAllowed,
    false,
    'No-bypass probe bundle: no-bypass claim is false',
  );
  ok(bundle.digest.startsWith('sha256:'), 'No-bypass probe bundle: digest is generated');
  ok(!text.includes('sk_live_must_not_escape'), 'No-bypass probe bundle: secret-like text is not serialized');
}

function testProbeCasesCarryModeSpecificHumanReviewTargets(): void {
  const bundle = createActionSurfaceIntegrationKitNoBypassProbeBundle({
    kit: createMultiModeKit(),
  });

  const gatewayProbe = bundle.probeCases.find((probe) =>
    probe.actionSurface === 'payments.issue_refund' &&
    probe.kind === 'direct-downstream-without-attestor-presentation'
  );
  equal(
    gatewayProbe?.targetBoundary,
    'customer-gateway-or-sidecar-pep',
    'No-bypass probe bundle: gateway probe targets the customer gateway boundary',
  );
  equal(
    gatewayProbe?.probeMethod,
    'black-box-direct-call-deny',
    'No-bypass probe bundle: gateway direct probe uses black-box deny method',
  );
  equal(gatewayProbe?.expectedResult, 'fail', 'No-bypass probe bundle: gateway direct probe fails');
  ok(
    gatewayProbe?.routeOrToolRefs.includes('POST /refunds'),
    'No-bypass probe bundle: gateway route ref is retained',
  );
  ok(
    (gatewayProbe?.sourceArtifactDigests.length ?? 0) > 0,
    'No-bypass probe bundle: gateway artifact digests are retained',
  );
  ok(
    gatewayProbe?.requiredEvidence.includes('customer-stop-point-decision-digest'),
    'No-bypass probe bundle: customer stop-point evidence is required',
  );
  equal(gatewayProbe?.safeToAutoRun, false, 'No-bypass probe bundle: auto-run is forbidden');
  equal(gatewayProbe?.executesProbe, false, 'No-bypass probe bundle: probe is not executed');
  equal(gatewayProbe?.resultStatus, 'not-run', 'No-bypass probe bundle: result status is not-run');

  const mcpProbe = bundle.probeCases.find((probe) =>
    probe.actionSurface === 'warehouse.export_customer_data' &&
    probe.kind === 'stale-or-replayed-presentation'
  );
  equal(
    mcpProbe?.targetBoundary,
    'customer-owned-mcp-tool-gateway',
    'No-bypass probe bundle: MCP probe targets the customer-owned MCP gateway',
  );
  ok(
    mcpProbe?.routeOrToolRefs.includes('tool:export_customer_data'),
    'No-bypass probe bundle: MCP tool ref is retained',
  );
  ok(
    mcpProbe?.requiredEvidence.includes('attestor-presentation-digest'),
    'No-bypass probe bundle: replay probe requires presentation digest',
  );

  const sdkProbe = bundle.probeCases.find((probe) =>
    probe.actionSurface === 'crm.update_account' &&
    probe.kind === 'observe-mode-would-block-recorded-only'
  );
  equal(
    sdkProbe?.targetBoundary,
    'customer-sdk-protected-adapter',
    'No-bypass probe bundle: SDK probe targets the protected adapter',
  );
  equal(
    sdkProbe?.expectedResult,
    'recorded-as-would-block-only',
    'No-bypass probe bundle: observe-mode case is record-only',
  );
  includes(
    sdkProbe?.passCondition ?? '',
    'recorded only',
    'No-bypass probe bundle: observe-mode pass condition is human-readable',
  );
}

function testDescriptorDocsAndPackageScript(): void {
  const descriptor = actionSurfaceIntegrationKitNoBypassProbeBundleDescriptor();
  equal(descriptor.approvalRequired, true, 'No-bypass probe descriptor: approval is required');
  equal(descriptor.executesProbes, false, 'No-bypass probe descriptor: execution is false');
  equal(
    descriptor.nonBypassableClaimAllowed,
    false,
    'No-bypass probe descriptor: no-bypass claim is false',
  );
  ok(
    descriptor.probeMethods.includes('verifier-outage-fail-closed'),
    'No-bypass probe descriptor: outage method is represented',
  );

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-integration-kit-buildout.md');
  includes(doc, 'No-Bypass Probe Plan', 'Integration kit doc: no-bypass section exists');
  includes(
    doc,
    'action-surface-integration-kit-no-bypass-probe-bundle.ts',
    'Integration kit doc: no-bypass source is named',
  );
  includes(
    doc,
    'test:action-surface-integration-kit-no-bypass-probe-bundle',
    'Integration kit doc: no-bypass script is named',
  );
  excludes(
    doc,
    /probe bundle proves customer PEP no-bypass/iu,
    'Integration kit doc: no-bypass proof is not overclaimed',
  );

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-integration-kit-no-bypass-probe-bundle'],
    'tsx tests/action-surface-integration-kit-no-bypass-probe-bundle.test.ts',
    'package.json exposes no-bypass probe bundle test',
  );
}

try {
  testBundleExpandsProbePlanWithoutRunning();
  testProbeCasesCarryModeSpecificHumanReviewTargets();
  testDescriptorDocsAndPackageScript();
  console.log(`Action surface integration kit no-bypass probe bundle tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface integration kit no-bypass probe bundle tests failed:', error);
  process.exitCode = 1;
}
