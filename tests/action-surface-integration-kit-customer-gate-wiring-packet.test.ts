import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceIntegrationKitCustomerGateWiringPacketDescriptor,
  createActionSurfaceIntegrationKitCustomerGateWiringPacket,
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
    generatedAt: '2026-06-01T10:00:00.000Z',
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
        actionSurface: 'support.summarize_case',
        domain: 'custom',
        downstreamSystem: 'support-console',
        action: 'summarize_case',
        operationRef: 'POST /cases/{id}/summary',
        credentialPosture: 'none',
        integrationModeHint: 'shadow-capture-sdk',
      },
    ],
  });
  return createActionSurfaceIntegrationKitPacket({
    packet: onboardingPacket,
    generatedAt: '2026-06-01T10:01:00.000Z',
  });
}

function testPacketMapsKitToCustomerGateWiringReview(): void {
  const kit = createMultiModeKit();
  const packet = createActionSurfaceIntegrationKitCustomerGateWiringPacket({
    kit,
    generatedAt: '2026-06-01T10:02:00.000Z',
  });
  const text = JSON.stringify(packet);

  equal(
    packet.version,
    'attestor.action-surface-integration-kit-customer-gate-wiring-packet.v1',
    'Customer gate wiring packet: version is explicit',
  );
  equal(packet.sourceKitDigest, kit.digest, 'Customer gate wiring packet: source kit digest is retained');
  equal(
    packet.sourcePacketDigest,
    kit.sourcePacketDigest,
    'Customer gate wiring packet: source packet digest is retained',
  );
  equal(packet.status, 'review-required', 'Customer gate wiring packet: review is required');
  equal(packet.surfaceCount, 3, 'Customer gate wiring packet: three surfaces are counted');
  equal(packet.wiringPlanCount, 3, 'Customer gate wiring packet: one wiring plan per surface');
  equal(packet.enforcementCandidateCount, 2, 'Customer gate wiring packet: observe-only plan is not enforceable');
  ok(packet.modes.includes('gateway-proxy'), 'Customer gate wiring packet: gateway mode is covered');
  ok(packet.modes.includes('mcp-tool-gateway'), 'Customer gate wiring packet: MCP mode is covered');
  ok(packet.modes.includes('shadow-capture-sdk'), 'Customer gate wiring packet: shadow mode is covered');
  equal(
    packet.liveProofRegisterRef,
    'LP-CUSTOMER-PEP-NO-BYPASS',
    'Customer gate wiring packet: names live proof register target',
  );
  equal(packet.autoEnforce, false, 'Customer gate wiring packet: auto enforce is false');
  equal(packet.deploysInfrastructure, false, 'Customer gate wiring packet: deployment is false');
  equal(packet.issuesCredentials, false, 'Customer gate wiring packet: credential issuance is false');
  equal(packet.activatesEnforcement, false, 'Customer gate wiring packet: enforcement activation is false');
  equal(packet.productionReady, false, 'Customer gate wiring packet: production readiness is false');
  equal(
    packet.nonBypassableClaimAllowed,
    false,
    'Customer gate wiring packet: no-bypass claim remains false',
  );
  ok(packet.digest.startsWith('sha256:'), 'Customer gate wiring packet: digest is generated');
  ok(!text.includes('sk_live_must_not_escape'), 'Customer gate wiring packet: secret-like text is not serialized');
}

function testWiringPlansCarryModeSpecificStopPointReview(): void {
  const packet = createActionSurfaceIntegrationKitCustomerGateWiringPacket({
    kit: createMultiModeKit(),
  });

  const gatewayPlan = packet.wiringPlans.find((plan) =>
    plan.actionSurface === 'payments.issue_refund'
  );
  equal(
    gatewayPlan?.targetBoundary,
    'customer-gateway-or-sidecar-pep',
    'Customer gate wiring packet: gateway plan targets customer gateway boundary',
  );
  equal(
    gatewayPlan?.runtimeKind,
    'envoy-ext-authz',
    'Customer gate wiring packet: gateway plan names Envoy runtime kind',
  );
  equal(
    gatewayPlan?.downstreamBoundaryKind,
    'http-handler',
    'Customer gate wiring packet: gateway plan names HTTP downstream boundary',
  );
  ok(
    gatewayPlan?.routeOrToolRefs.includes('POST /refunds'),
    'Customer gate wiring packet: gateway route ref is retained',
  );
  ok(
    gatewayPlan?.sourceReadinessDigest?.startsWith('sha256:'),
    'Customer gate wiring packet: gateway readiness digest is retained',
  );
  ok(
    gatewayPlan?.requiredRuntimeEvidenceKinds.includes('gateway-config'),
    'Customer gate wiring packet: runtime adoption evidence is listed',
  );
  ok(
    gatewayPlan?.requiredAdoptionEvidenceKinds.includes('protected-admission-e2e-proof-plan'),
    'Customer gate wiring packet: adoption package evidence is listed',
  );
  ok(
    gatewayPlan?.requiredEvidenceFields.includes('no-bypass-probe-result'),
    'Customer gate wiring packet: enforcement candidate requires probe result evidence',
  );
  ok(
    gatewayPlan?.missingProofs.includes('customer-stop-point-proof-missing'),
    'Customer gate wiring packet: missing customer stop-point proof is explicit',
  );
  equal(
    gatewayPlan?.evidenceBinding.sourceKitDigest,
    packet.sourceKitDigest,
    'Customer gate wiring packet: plan binds back to kit digest',
  );
  equal(
    gatewayPlan?.evidenceBinding.generatedPacketMayCloseLiveProof,
    false,
    'Customer gate wiring packet: generated packet alone cannot close live proof',
  );
  equal(gatewayPlan?.authority, 'wiring-review-only', 'Customer gate wiring packet: authority is review-only');

  const mcpPlan = packet.wiringPlans.find((plan) =>
    plan.actionSurface === 'warehouse.export_customer_data'
  );
  equal(
    mcpPlan?.targetBoundary,
    'customer-owned-mcp-tool-gateway',
    'Customer gate wiring packet: MCP plan targets the customer-owned MCP gateway',
  );
  equal(
    mcpPlan?.runtimeKind,
    'action-dispatcher',
    'Customer gate wiring packet: MCP plan uses action dispatcher runtime kind',
  );
  ok(
    mcpPlan?.routeOrToolRefs.includes('tool:export_customer_data'),
    'Customer gate wiring packet: MCP tool ref is retained',
  );

  const shadowPlan = packet.wiringPlans.find((plan) =>
    plan.actionSurface === 'support.summarize_case'
  );
  equal(
    shadowPlan?.planStatus,
    'observe-only-not-enforcement',
    'Customer gate wiring packet: shadow path stays observe-only',
  );
  equal(
    shadowPlan?.enforcementCandidate,
    false,
    'Customer gate wiring packet: shadow path is not an enforcement candidate',
  );
  equal(
    shadowPlan?.releaseEnforcementReviewRequired,
    false,
    'Customer gate wiring packet: shadow path does not require release enforcement review',
  );
  ok(
    shadowPlan?.missingProofs.includes('customer-stop-point-not-selected-for-enforcement'),
    'Customer gate wiring packet: shadow path names missing stop-point selection',
  );
}

function testDescriptorDocsAndPackageScript(): void {
  const descriptor = actionSurfaceIntegrationKitCustomerGateWiringPacketDescriptor();
  equal(descriptor.approvalRequired, true, 'Customer gate wiring descriptor: approval is required');
  equal(descriptor.activatesEnforcement, false, 'Customer gate wiring descriptor: activation is false');
  equal(
    descriptor.nonBypassableClaimAllowed,
    false,
    'Customer gate wiring descriptor: no-bypass claim is false',
  );
  ok(
    descriptor.evidenceFields.includes('customer-pep-runtime-adoption-proof'),
    'Customer gate wiring descriptor: runtime adoption evidence field is listed',
  );

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-integration-kit-buildout.md');
  includes(doc, 'Customer Gate Wiring Packet', 'Integration kit doc: customer gate wiring section exists');
  includes(
    doc,
    'action-surface-integration-kit-customer-gate-wiring-packet.ts',
    'Integration kit doc: customer gate wiring source is named',
  );
  includes(
    doc,
    'test:action-surface-integration-kit-customer-gate-wiring-packet',
    'Integration kit doc: customer gate wiring script is named',
  );
  excludes(
    doc,
    /customer gate wiring packet proves customer PEP no-bypass/iu,
    'Integration kit doc: customer gate wiring proof is not overclaimed',
  );

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-integration-kit-customer-gate-wiring-packet'],
    'tsx tests/action-surface-integration-kit-customer-gate-wiring-packet.test.ts',
    'package.json exposes customer gate wiring packet test',
  );
}

try {
  testPacketMapsKitToCustomerGateWiringReview();
  testWiringPlansCarryModeSpecificStopPointReview();
  testDescriptorDocsAndPackageScript();
  console.log(`Action surface integration kit customer gate wiring packet tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface integration kit customer gate wiring packet tests failed:', error);
  process.exitCode = 1;
}
