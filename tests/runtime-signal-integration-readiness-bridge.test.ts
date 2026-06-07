import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION,
  createRuntimeSignalEnvelope,
  createRuntimeSignalIntegrationReadinessBridge,
  normalizeRuntimeSignal,
  runtimeSignalIntegrationReadinessBridgeDescriptor,
} from '../src/consequence-admission/index.js';
import type {
  AttestorIntegrationModeSignals,
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

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const eventTime = '2026-05-18T09:30:00Z';
const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';

function completeSignals(): AttestorIntegrationModeSignals {
  return Object.freeze({
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
  });
}

function proposedActionEnvelope() {
  return createRuntimeSignalEnvelope({
    signalKind: 'proposed-action',
    sourceTrustLevel: 'signed-or-bound',
    sourceSystem: 'sdk.customer-gate',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    runtimeRef: 'workflow:export-runner',
    traceId,
    runId: 'run-001',
    eventTime,
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
    operationRef: 'POST /api/v1/exports#createExport',
    inputSchemaDigest: digestC,
    argumentOrBodyDigest: digestD,
    policyRefs: ['policy:data-export.v1'],
    evidenceRefs: ['evidence:export-request.v1'],
    approvalRefs: ['approval:manager.v1'],
  });
}

function testDescriptorPreservesReadinessBoundary(): void {
  const descriptor = runtimeSignalIntegrationReadinessBridgeDescriptor();

  equal(descriptor.version, RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION, 'Runtime signal readiness bridge: descriptor version is explicit');
  equal(descriptor.integrationModeReadinessVersion, 'attestor.integration-mode-readiness.v1', 'Runtime signal readiness bridge: descriptor feeds existing readiness evaluator');
  equal(descriptor.usesExistingReadinessEvaluator, true, 'Runtime signal readiness bridge: existing evaluator is used');
  equal(descriptor.runtimeSignalAloneCanClaimNonBypassable, false, 'Runtime signal readiness bridge: signal alone cannot claim non-bypassable');
  equal(descriptor.credentialIsolationInferredFromSignal, false, 'Runtime signal readiness bridge: credential isolation is not inferred from signal');
  equal(descriptor.generatedArtifactsNeedReview, true, 'Runtime signal readiness bridge: generated artifacts still need review');
  equal(descriptor.canGrantAuthority, false, 'Runtime signal readiness bridge: descriptor cannot grant authority');
  equal(descriptor.canAdmit, false, 'Runtime signal readiness bridge: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Runtime signal readiness bridge: descriptor cannot activate enforcement');
  equal(descriptor.productionReady, false, 'Runtime signal readiness bridge: descriptor is not production readiness');
  includes(descriptor.gatePlacementKinds, 'http-gateway-proxy', 'Runtime signal readiness bridge: HTTP gateway placement is listed');
}

function testOpenApiDeclarationFeedsReadinessWithoutClaimingGate(): void {
  const normalized = normalizeRuntimeSignal({
    sourceKind: 'openapi-operation',
    sourceSystem: 'openapi.customer-api',
    eventTime,
    method: 'POST',
    path: '/api/v1/exports',
    operationId: 'createExport',
    inputSchemaDigest: digestC,
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
  });
  const bridge = createRuntimeSignalIntegrationReadinessBridge({
    envelope: normalized.envelope,
    workflowId: 'wf-openapi-export',
  });

  equal(bridge.mode, 'gateway-proxy', 'Runtime signal readiness bridge: OpenAPI write declaration maps to gateway proxy review');
  equal(bridge.gatePlacement, 'http-gateway-proxy', 'Runtime signal readiness bridge: HTTP placement is explicit');
  equal(bridge.credentialIsolation, 'agent-held-static-secret', 'Runtime signal readiness bridge: missing credential evidence defaults to direct credential risk');
  equal(bridge.readiness.status, 'no-go', 'Runtime signal readiness bridge: declaration alone is no-go');
  equal(bridge.readiness.nonBypassableClaimAllowed, false, 'Runtime signal readiness bridge: declaration alone cannot claim non-bypassable');
  includes(bridge.readiness.noGoReasons, 'missing-admission-call', 'Runtime signal readiness bridge: admission call remains missing');
  includes(bridge.readiness.noGoReasons, 'agent-direct-credential-exposed', 'Runtime signal readiness bridge: direct credential risk remains explicit');
  equal(bridge.runtimeSignalAloneCanClaimNonBypassable, false, 'Runtime signal readiness bridge: no-bypass cannot come from signal alone');
  equal(bridge.autoEnforce, false, 'Runtime signal readiness bridge: bridge does not auto-enforce');
  equal(bridge.productionReady, false, 'Runtime signal readiness bridge: bridge does not claim production readiness');
}

function testObservationFeedsShadowReadinessOnly(): void {
  const normalized = normalizeRuntimeSignal({
    sourceKind: 'otel-log',
    sourceSystem: 'otel.customer-gateway',
    eventTime,
    traceId,
    serviceName: 'export-gateway',
    logRecordRef: 'log:export-001',
    eventName: 'POST /api/v1/exports',
    bodyDigest: digestD,
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
  });
  const bridge = createRuntimeSignalIntegrationReadinessBridge({
    envelope: normalized.envelope,
    workflowId: 'wf-otel-export',
  });

  equal(bridge.mode, 'shadow-capture-sdk', 'Runtime signal readiness bridge: observation defaults to shadow capture');
  equal(bridge.gatePlacement, 'shadow-capture', 'Runtime signal readiness bridge: observation placement is shadow only');
  equal(bridge.signalsApplied.shadowCaptureObserved, true, 'Runtime signal readiness bridge: observation can mark shadow capture observed');
  equal(bridge.readiness.status, 'no-go', 'Runtime signal readiness bridge: observation still lacks admission call');
  equal(bridge.readiness.enforcementCapable, false, 'Runtime signal readiness bridge: shadow capture is not enforcement-capable');
  equal(bridge.readiness.nonBypassableClaimAllowed, false, 'Runtime signal readiness bridge: observation cannot claim non-bypassable');
}

function testExplicitControlsCanFeedExistingReadinessEvaluator(): void {
  const bridge = createRuntimeSignalIntegrationReadinessBridge({
    envelope: proposedActionEnvelope(),
    workflowId: 'wf-export-gateway-ready',
    modeHint: 'gateway-proxy',
    credentialIsolationHint: 'gateway-held-secret',
    controlSignals: completeSignals(),
    generatedArtifacts: [
      'credential-isolation-plan',
      'gateway-proxy-config',
      'policy-twin-backtest',
      'red-team-replay-fixture',
      'verifier-helper-config',
    ],
  });

  equal(bridge.mode, 'gateway-proxy', 'Runtime signal readiness bridge: explicit mode is preserved');
  equal(bridge.credentialIsolation, 'gateway-held-secret', 'Runtime signal readiness bridge: explicit credential isolation is preserved');
  equal(bridge.readiness.status, 'scoped-enforce-eligible', 'Runtime signal readiness bridge: explicit complete controls feed existing readiness evaluator');
  equal(bridge.readiness.nonBypassableClaimAllowed, true, 'Runtime signal readiness bridge: no-bypass candidate requires explicit complete controls');
  equal(bridge.credentialIsolationInferredFromSignal, false, 'Runtime signal readiness bridge: credential isolation was not inferred from the signal');
  equal(bridge.generatedArtifactsNeedReview, true, 'Runtime signal readiness bridge: generated artifacts remain review-gated');
  ok(bridge.digest.startsWith('sha256:'), 'Runtime signal readiness bridge: bridge digest is generated');
}

function testProofSignalsRemainProofIntakeWork(): void {
  const proofEnvelope = createRuntimeSignalEnvelope({
    signalKind: 'enforcement-proof',
    sourceTrustLevel: 'enforcement-proof',
    sourceSystem: 'pep.customer-gate',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    runtimeRef: 'pep:data-export',
    traceId,
    runId: 'run-proof-001',
    eventTime,
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
    operationRef: 'pep.receipt:data-export',
    inputSchemaDigest: digestC,
    argumentOrBodyDigest: digestD,
    policyRefs: ['policy:data-export.v1'],
    evidenceRefs: ['evidence:pep-receipt.v1'],
    approvalRefs: ['approval:manager.v1'],
  });

  throws(
    () =>
      createRuntimeSignalIntegrationReadinessBridge({
        envelope: proofEnvelope,
      }),
    /RS10 proof intake/u,
    'Runtime signal readiness bridge: proof signals stay out of RS08 readiness bridge',
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

  includes(doc, 'RS08 Integration Readiness Bridge', 'Runtime signal readiness bridge: architecture note names RS08');
  includes(doc, 'attestor.runtime-signal-integration-readiness-bridge.v1', 'Runtime signal readiness bridge: architecture note records version');
  equal(
    packageJson.scripts['test:runtime-signal-integration-readiness-bridge'],
    'tsx tests/runtime-signal-integration-readiness-bridge.test.ts',
    'Runtime signal readiness bridge: package script is registered',
  );
  includes(
    packageProbe,
    'RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION',
    'Runtime signal readiness bridge: package surface probe covers version export',
  );
  includes(
    packageProbe,
    'createRuntimeSignalIntegrationReadinessBridge',
    'Runtime signal readiness bridge: package surface probe covers bridge export',
  );
}

testDescriptorPreservesReadinessBoundary();
testOpenApiDeclarationFeedsReadinessWithoutClaimingGate();
testObservationFeedsShadowReadinessOnly();
testExplicitControlsCanFeedExistingReadinessEvaluator();
testProofSignalsRemainProofIntakeWork();
testDocsPackageAndProbeStayAligned();

console.log(`Runtime signal integration readiness bridge tests: ${passed} passed, 0 failed`);
