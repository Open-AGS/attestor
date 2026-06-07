import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RUNTIME_SIGNAL_REVIEW_PACKET_VERSION,
  createRuntimeSignalEnvelope,
  createRuntimeSignalIntegrationReadinessBridge,
  createRuntimeSignalReviewPacket,
  runtimeSignalReviewPacketDescriptor,
} from '../src/consequence-admission/index.js';
import type {
  AttestorIntegrationModeSignals,
  RuntimeSignalConsequenceCandidate,
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

function openApiDeclarationEnvelope() {
  return createRuntimeSignalEnvelope({
    signalKind: 'declaration',
    sourceTrustLevel: 'declared',
    sourceSystem: 'openapi.customer-api',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    runtimeRef: 'workflow:export-runner',
    traceId,
    runId: 'run-openapi-001',
    eventTime,
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
    operationRef: 'POST /api/v1/exports#createExport',
    inputSchemaDigest: digestC,
    policyRefs: ['policy:data-export.v1'],
    evidenceRefs: ['evidence:export-schema.v1'],
    approvalRefs: ['approval:manager.v1'],
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
    runId: 'run-proposed-001',
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

function testDescriptorPreservesReviewBoundary(): void {
  const descriptor = runtimeSignalReviewPacketDescriptor();

  equal(descriptor.version, RUNTIME_SIGNAL_REVIEW_PACKET_VERSION, 'Runtime signal review packet: descriptor version is explicit');
  equal(descriptor.producesHumanReviewPacket, true, 'Runtime signal review packet: descriptor produces a human review packet');
  equal(descriptor.showsActionConsequenceMissingAndGate, true, 'Runtime signal review packet: descriptor shows the four review fields');
  equal(descriptor.digestOnly, true, 'Runtime signal review packet: descriptor is digest-first');
  equal(descriptor.reviewMaterialOnly, true, 'Runtime signal review packet: descriptor is review material only');
  equal(descriptor.canGrantAuthority, false, 'Runtime signal review packet: descriptor cannot grant authority');
  equal(descriptor.canAdmit, false, 'Runtime signal review packet: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Runtime signal review packet: descriptor cannot activate enforcement');
  equal(descriptor.autoEnforce, false, 'Runtime signal review packet: descriptor cannot auto-enforce');
  equal(descriptor.productionReady, false, 'Runtime signal review packet: descriptor is not production readiness');
  includes(descriptor.requiredFields, 'action', 'Runtime signal review packet: descriptor requires action summary');
  includes(descriptor.requiredFields, 'consequence', 'Runtime signal review packet: descriptor requires consequence summary');
  includes(descriptor.requiredFields, 'missing', 'Runtime signal review packet: descriptor requires missing-control summary');
  includes(descriptor.requiredFields, 'gate', 'Runtime signal review packet: descriptor requires gate summary');
}

function testDeclarationPacketShowsActionConsequenceMissingAndGate(): void {
  const packet = createRuntimeSignalReviewPacket({
    envelope: openApiDeclarationEnvelope(),
    generatedAt: eventTime,
    reviewerScope: 'runtime-signal-review',
  });
  const serialized = JSON.stringify(packet);

  equal(packet.action.actionSurface, 'data-export', 'Runtime signal review packet: action surface is visible');
  equal(packet.action.downstreamSystem, 'export-service', 'Runtime signal review packet: downstream system is visible');
  equal(packet.consequence.consequenceClass, 'data-movement', 'Runtime signal review packet: consequence class is visible');
  includes(packet.missing.consequenceMissingControls, 'source-binding-missing', 'Runtime signal review packet: missing consequence control is visible');
  includes(packet.missing.readinessNoGoReasons, 'missing-admission-call', 'Runtime signal review packet: readiness blocker is visible');
  equal(packet.gate.placement, 'http-gateway-proxy', 'Runtime signal review packet: gate placement is visible');
  equal(packet.gate.nonBypassableClaimAllowed, false, 'Runtime signal review packet: declaration does not claim non-bypassable');
  equal(packet.rawPayloadStored, false, 'Runtime signal review packet: raw payload is not stored');
  equal(packet.canAdmit, false, 'Runtime signal review packet: packet cannot admit');
  equal(packet.activatesEnforcement, false, 'Runtime signal review packet: packet does not activate enforcement');
  ok(packet.digest.startsWith('sha256:'), 'Runtime signal review packet: packet digest is present');
  ok(!serialized.includes('raw_customer_value_must_not_escape'), 'Runtime signal review packet: raw marker is absent');
}

function testReadyBridgeCanInformReviewWithoutTurningPacketIntoDecision(): void {
  const envelope = proposedActionEnvelope();
  const bridge = createRuntimeSignalIntegrationReadinessBridge({
    envelope,
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
    generatedAt: eventTime,
  });
  const packet = createRuntimeSignalReviewPacket({
    envelope,
    readinessBridge: bridge,
    generatedAt: eventTime,
  });

  equal(packet.gate.readinessStatus, 'scoped-enforce-eligible', 'Runtime signal review packet: readiness can be visible');
  equal(packet.gate.nonBypassableClaimAllowed, true, 'Runtime signal review packet: explicit bridge no-bypass candidate can be shown');
  equal(packet.canAdmit, false, 'Runtime signal review packet: ready bridge still cannot admit');
  equal(packet.activatesEnforcement, false, 'Runtime signal review packet: ready bridge still cannot activate enforcement');
  equal(packet.productionReady, false, 'Runtime signal review packet: ready bridge is not production readiness');
  includes(packet.reviewChecklist, 'Confirm the customer gate placement: http-gateway-proxy.', 'Runtime signal review packet: checklist names gate placement');
}

function testLinkedInputsFailClosedOnDigestMismatch(): void {
  const envelope = proposedActionEnvelope();
  const bridge = createRuntimeSignalIntegrationReadinessBridge({
    envelope,
    generatedAt: eventTime,
  });
  const wrongCandidate = {
    ...bridge.readiness,
    sourceSignalDigest: envelope.signalDigest,
  } as unknown as RuntimeSignalConsequenceCandidate;
  throws(
    () =>
      createRuntimeSignalReviewPacket({
        envelope,
        candidate: wrongCandidate,
        readinessBridge: bridge,
      }),
    /bridge candidate digest to match candidate/u,
    'Runtime signal review packet: mismatched candidate and bridge fail closed',
  );
}

function testProofSignalsStayOutUntilProofIntake(): void {
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
      createRuntimeSignalReviewPacket({
        envelope: proofEnvelope,
      }),
    /RS10 proof intake/u,
    'Runtime signal review packet: proof signals stay out until RS10',
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

  includes(doc, 'RS09 Review Packet', 'Runtime signal review packet: architecture note names RS09');
  includes(doc, 'attestor.runtime-signal-review-packet.v1', 'Runtime signal review packet: architecture note records version');
  equal(
    packageJson.scripts['test:runtime-signal-review-packet'],
    'tsx tests/runtime-signal-review-packet.test.ts',
    'Runtime signal review packet: package script is registered',
  );
  includes(
    packageProbe,
    'RUNTIME_SIGNAL_REVIEW_PACKET_VERSION',
    'Runtime signal review packet: package surface probe covers version export',
  );
  includes(
    packageProbe,
    'createRuntimeSignalReviewPacket',
    'Runtime signal review packet: package surface probe covers packet export',
  );
}

testDescriptorPreservesReviewBoundary();
testDeclarationPacketShowsActionConsequenceMissingAndGate();
testReadyBridgeCanInformReviewWithoutTurningPacketIntoDecision();
testLinkedInputsFailClosedOnDigestMismatch();
testProofSignalsStayOutUntilProofIntake();
testDocsPackageAndProbeStayAligned();

console.log(`Runtime signal review packet tests: ${passed} passed, 0 failed`);
