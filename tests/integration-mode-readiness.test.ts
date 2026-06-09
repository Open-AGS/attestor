import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  attestorIntegrationModeReadinessDescriptor,
  evaluateAttestorIntegrationModeReadiness,
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
  assert.ok(value.includes(expected), message);
  passed += 1;
}

function excludes(value: string, pattern: RegExp, message: string): void {
  assert.ok(!pattern.test(value), message);
  passed += 1;
}

function readProjectFile(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), 'utf8');
}

function completeSignals() {
  return {
    admissionCallObserved: true,
    shadowCaptureObserved: true,
    downstreamContractBound: true,
    verifierImplemented: true,
    protectedAdapterImplemented: true,
    gatewayProxyConfigured: true,
    mcpToolGatewayConfigured: true,
    sidecarExtAuthzConfigured: true,
    providerNativeConnectorConfigured: true,
    presentationBindingImplemented: true,
    replayProtectionImplemented: true,
    idempotencyKeyRequired: true,
    tenantBoundaryProven: true,
    policySimulationAvailable: true,
    customerApprovalRecorded: true,
    redTeamReplayPassed: true,
    generatedArtifactsReviewed: true,
  } as const;
}

function testAdvisoryApiIsNotEnforcement(): void {
  const readiness = evaluateAttestorIntegrationModeReadiness({
    workflowId: 'wf-refund-advisory',
    mode: 'advisory-api',
    credentialIsolation: 'agent-held-static-secret',
    actionSurface: 'refund-service.issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    generatedAt: '2026-05-12T08:00:00.000Z',
    generatedArtifacts: ['sdk-snippet'],
    signals: {
      admissionCallObserved: true,
    },
  });

  equal(readiness.status, 'advisory-only', 'Integration readiness: advisory API remains advisory-only');
  equal(readiness.bypassRisk, 'critical', 'Integration readiness: agent-held static secret is critical bypass risk');
  equal(readiness.enforcementCapable, false, 'Integration readiness: advisory mode is not enforcement-capable');
  equal(readiness.nonBypassableClaimAllowed, false, 'Integration readiness: advisory mode cannot claim non-bypassable');
  equal(readiness.approvalRequired, true, 'Integration readiness: approval is required');
  equal(readiness.autoEnforce, false, 'Integration readiness: auto-enforce is false');
  equal(readiness.rawPayloadStored, false, 'Integration readiness: raw payload is not stored');
  equal(readiness.productionReady, false, 'Integration readiness: production readiness is not claimed');
  ok(readiness.noGoReasons.includes('agent-direct-credential-exposed'), 'Integration readiness: direct credential exposure is explicit');
  ok(readiness.nextSafeStep.includes('Move the downstream credential'), 'Integration readiness: next step points to credential isolation');
}

function testGatewayProxyCanBecomeScopedEnforceEligible(): void {
  const readiness = evaluateAttestorIntegrationModeReadiness({
    workflowId: 'wf-refund-gateway',
    mode: 'gateway-proxy',
    credentialIsolation: 'gateway-held-secret',
    actionSurface: 'refund-service.issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    generatedAt: '2026-05-12T08:05:00.000Z',
    generatedArtifacts: [
      'credential-isolation-plan',
      'gateway-proxy-config',
      'policy-twin-backtest',
      'red-team-replay-fixture',
      'verifier-helper-config',
    ],
    signals: completeSignals(),
  });

  equal(readiness.status, 'scoped-enforce-eligible', 'Integration readiness: complete gateway proxy is scoped enforce eligible');
  equal(readiness.bypassRisk, 'low', 'Integration readiness: complete gateway proxy has low bypass risk');
  equal(readiness.nonBypassableClaimAllowed, true, 'Integration readiness: complete proxy can claim non-bypassable candidate');
  equal(readiness.noGoReasons.length, 0, 'Integration readiness: complete proxy has no no-go reasons');
  equal(readiness.missingRecommendedArtifacts.length, 0, 'Integration readiness: complete proxy has all recommended artifacts');
  ok(readiness.digest.startsWith('sha256:'), 'Integration readiness: result carries digest');
  ok(
    readiness.automation.safeAutomations.includes('generate-verifier-or-proxy-config'),
    'Integration readiness: generated proxy artifacts are automation-safe',
  );
  ok(
    readiness.automation.approvalGatedAutomations.includes('promote-to-scoped-enforce'),
    'Integration readiness: scoped enforce promotion stays approval-gated',
  );
  ok(
    readiness.automation.prohibitedAutomations.includes('auto-enforce-without-customer-approval'),
    'Integration readiness: auto enforce without approval is prohibited',
  );
}

function testMcpGatewayBlocksWhenAgentStillHasCredential(): void {
  const readiness = evaluateAttestorIntegrationModeReadiness({
    workflowId: 'wf-mcp-customer-data-export',
    mode: 'mcp-tool-gateway',
    credentialIsolation: 'agent-held-scoped-secret',
    actionSurface: 'warehouse.export_customer_data',
    domain: 'data-disclosure',
    downstreamSystem: 'warehouse-mcp-server',
    generatedAt: '2026-05-12T08:10:00.000Z',
    generatedArtifacts: [
      'credential-isolation-plan',
      'mcp-tool-gateway-config',
      'policy-twin-backtest',
      'red-team-replay-fixture',
      'verifier-helper-config',
    ],
    signals: completeSignals(),
  });

  equal(readiness.status, 'no-go', 'Integration readiness: MCP gateway is no-go if agent still holds credential');
  equal(readiness.bypassRisk, 'high', 'Integration readiness: scoped agent credential is high bypass risk');
  equal(readiness.nonBypassableClaimAllowed, false, 'Integration readiness: direct credential blocks non-bypassable claim');
  ok(readiness.noGoReasons.includes('agent-direct-credential-exposed'), 'Integration readiness: exposed MCP credential is explicit');
  ok(readiness.noGoReasons.includes('missing-credential-isolation'), 'Integration readiness: missing isolation is explicit');
}

function testGeneratedArtifactsMustBeReviewed(): void {
  const signals = {
    ...completeSignals(),
    generatedArtifactsReviewed: false,
  };
  const readiness = evaluateAttestorIntegrationModeReadiness({
    workflowId: 'wf-sidecar-review-required',
    mode: 'sidecar-ext-authz',
    credentialIsolation: 'short-lived-downscoped-token',
    generatedAt: '2026-05-12T08:15:00.000Z',
    generatedArtifacts: [
      'credential-isolation-plan',
      'policy-twin-backtest',
      'red-team-replay-fixture',
      'sidecar-ext-authz-config',
      'verifier-helper-config',
    ],
    signals,
  });

  equal(readiness.status, 'enforcement-incomplete', 'Integration readiness: unreviewed artifacts block enforcement');
  equal(readiness.bypassRisk, 'medium', 'Integration readiness: unreviewed artifacts keep medium bypass risk');
  ok(readiness.noGoReasons.includes('generated-artifacts-unreviewed'), 'Integration readiness: unreviewed artifact blocker is explicit');
  ok(readiness.nextSafeStep.includes('Review the generated integration artifacts'), 'Integration readiness: next step asks for artifact review');
}

function testShadowCaptureReadiness(): void {
  const readiness = evaluateAttestorIntegrationModeReadiness({
    workflowId: 'wf-shadow-only',
    mode: 'shadow-capture-sdk',
    credentialIsolation: 'not-required',
    generatedAt: '2026-05-12T08:20:00.000Z',
    generatedArtifacts: ['policy-twin-backtest', 'red-team-replay-fixture', 'sdk-snippet'],
    signals: {
      admissionCallObserved: true,
      shadowCaptureObserved: true,
    },
  });

  equal(readiness.status, 'shadow-ready', 'Integration readiness: shadow capture can be ready without enforcement');
  equal(readiness.enforcementCapable, false, 'Integration readiness: shadow capture is not enforcement-capable');
  equal(readiness.nonBypassableClaimAllowed, false, 'Integration readiness: shadow capture cannot claim non-bypassable');
  equal(readiness.noGoReasons.length, 0, 'Integration readiness: complete shadow capture has no shadow blockers');
}

function testDescriptorAndDocs(): void {
  const descriptor = attestorIntegrationModeReadinessDescriptor();
  equal(descriptor.autoEnforce, false, 'Integration readiness descriptor: auto enforce is false');
  equal(descriptor.nonBypassableRequiresCredentialIsolation, true, 'Integration readiness descriptor: credential isolation is required');
  ok(descriptor.modes.includes('gateway-proxy'), 'Integration readiness descriptor: gateway proxy mode is listed');
  ok(descriptor.modes.includes('mcp-tool-gateway'), 'Integration readiness descriptor: MCP tool gateway mode is listed');

  const doc = readProjectFile('docs', '02-architecture', 'integration-mode-readiness.md');
  includes(doc, 'Integration Mode Readiness', 'Integration readiness doc: title exists');
  includes(doc, '`advisory-api`', 'Integration readiness doc: advisory mode is documented');
  includes(doc, '`gateway-proxy`', 'Integration readiness doc: gateway proxy is documented');
  includes(doc, '`mcp-tool-gateway`', 'Integration readiness doc: MCP tool gateway is documented');
  includes(doc, 'automationSafe', 'Integration readiness doc: automation safety is documented');
  includes(doc, 'auto-enforce', 'Integration readiness doc: auto-enforce no-go is documented');
  includes(doc, 'agent-held-static-secret', 'Integration readiness doc: credential exposure is documented');

  const readme = readProjectFile('README.md');
  includes(
    readme,
    'href="docs/01-overview/how-attestor-connects-to-existing-systems.md"',
    'README links the integration overview',
  );
  excludes(readme, /production-ready because of integration mode readiness/iu, 'README does not overclaim production readiness');

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:integration-mode-readiness'],
    'tsx tests/integration-mode-readiness.test.ts',
    'package.json exposes integration mode readiness test',
  );
}

try {
  testAdvisoryApiIsNotEnforcement();
  testGatewayProxyCanBecomeScopedEnforceEligible();
  testMcpGatewayBlocksWhenAgentStillHasCredential();
  testGeneratedArtifactsMustBeReviewed();
  testShadowCaptureReadiness();
  testDescriptorAndDocs();
  console.log(`Integration mode readiness tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Integration mode readiness tests failed:', error);
  process.exitCode = 1;
}
