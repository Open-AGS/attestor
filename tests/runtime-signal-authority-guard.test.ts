import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
  assertRuntimeSignalAuthorityBoundary,
  createRuntimeSignalEnvelope,
  normalizeRuntimeSignal,
  runtimeSignalAuthorityGuardDescriptor,
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

function baseProposedAction() {
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

function testDescriptorIsNoAuthorityBoundary(): void {
  const descriptor = runtimeSignalAuthorityGuardDescriptor();

  equal(descriptor.version, RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION, 'Runtime signal authority guard: descriptor version is explicit');
  equal(descriptor.runtimeSignalEnvelopeVersion, 'attestor.runtime-signal-envelope.v1', 'Runtime signal authority guard: descriptor is tied to RS02 envelope');
  equal(descriptor.failClosed, true, 'Runtime signal authority guard: descriptor is fail-closed');
  equal(descriptor.metadataCannotMarkSafe, true, 'Runtime signal authority guard: metadata cannot mark safe');
  equal(descriptor.telemetryCannotGrantAuthority, true, 'Runtime signal authority guard: telemetry cannot grant authority');
  equal(descriptor.observationCannotAdmit, true, 'Runtime signal authority guard: observation cannot admit');
  equal(descriptor.measurementCannotActivateEnforcement, true, 'Runtime signal authority guard: measurement cannot activate enforcement');
  equal(descriptor.canGrantAuthority, false, 'Runtime signal authority guard: descriptor cannot grant authority');
  equal(descriptor.canAdmit, false, 'Runtime signal authority guard: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Runtime signal authority guard: descriptor cannot activate enforcement');
  equal(descriptor.productionReady, false, 'Runtime signal authority guard: descriptor is not production readiness');
  includes(descriptor.prohibitedUses, 'reduce-customer-gate-requirements', 'Runtime signal authority guard: customer gate requirements cannot be reduced');
}

function testDeclarationAndObservationStayReviewOnly(): void {
  const declaration = normalizeRuntimeSignal({
    sourceKind: 'openapi-operation',
    sourceSystem: 'openapi.customer-api',
    eventTime,
    method: 'POST',
    path: '/api/v1/exports',
    operationId: 'createExport',
    inputSchemaDigest: digestC,
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
  }).envelope;
  const observation = normalizeRuntimeSignal({
    sourceKind: 'otel-log',
    sourceSystem: 'otel.customer-gateway',
    eventTime,
    traceId,
    serviceName: 'export-gateway',
    logRecordRef: 'log:export-001',
    eventName: 'POST /api/v1/exports',
    downstreamSystem: 'export-service',
    actionSurface: 'data-export',
    bodyDigest: digestD,
  }).envelope;

  const declarationReport = assertRuntimeSignalAuthorityBoundary({
    signalKind: declaration.signalKind,
    sourceTrustLevel: declaration.sourceTrustLevel,
    target: declaration,
    targetLabel: 'openapi-declaration',
  });
  const observationReport = assertRuntimeSignalAuthorityBoundary({
    signalKind: observation.signalKind,
    sourceTrustLevel: observation.sourceTrustLevel,
    target: observation,
    targetLabel: 'otel-observation',
  });

  equal(declarationReport.decisionAuthority, 'none', 'Runtime signal authority guard: declaration has no decision authority');
  includes(declarationReport.allowedUses, 'surface-inventory', 'Runtime signal authority guard: declaration can feed surface inventory');
  equal(observationReport.enforcementAuthority, 'none', 'Runtime signal authority guard: observation has no enforcement authority');
  includes(observationReport.allowedUses, 'review-pressure', 'Runtime signal authority guard: observation can add review pressure');
  equal(observationReport.observationCanAdmit, false, 'Runtime signal authority guard: observation cannot admit');
}

function testAuthorityUpgradeAttemptsFailClosed(): void {
  const envelope = baseProposedAction();

  throws(
    () =>
      assertRuntimeSignalAuthorityBoundary({
        signalKind: 'observation',
        sourceTrustLevel: 'observed',
        target: {
          ...envelope,
          signalKind: 'observation',
          sourceTrustLevel: 'observed',
          canAdmit: true,
        },
        targetLabel: 'forged-observation',
      }),
    /canAdmit/u,
    'Runtime signal authority guard: observation cannot forge admission authority',
  );

  throws(
    () =>
      assertRuntimeSignalAuthorityBoundary({
        signalKind: 'declaration',
        sourceTrustLevel: 'declared',
        target: {
          ...envelope,
          signalKind: 'declaration',
          sourceTrustLevel: 'declared',
          markedSafe: true,
        },
        targetLabel: 'forged-declaration',
      }),
    /markedSafe/u,
    'Runtime signal authority guard: declaration metadata cannot mark an action safe',
  );

  throws(
    () =>
      assertRuntimeSignalAuthorityBoundary({
        signalKind: 'observation',
        sourceTrustLevel: 'observed',
        target: {
          ...envelope,
          signalKind: 'observation',
          sourceTrustLevel: 'observed',
          admissionDecision: 'admit',
        },
        targetLabel: 'admission-shaped-telemetry',
      }),
    /admissionDecision/u,
    'Runtime signal authority guard: telemetry cannot carry an admission outcome',
  );

  throws(
    () =>
      assertRuntimeSignalAuthorityBoundary({
        signalKind: 'observation',
        sourceTrustLevel: 'enforcement-proof',
        target: envelope,
        targetLabel: 'proof-trust-observation',
      }),
    /sourceTrustLevel/u,
    'Runtime signal authority guard: proof trust cannot attach to observation telemetry',
  );
}

function testProposedActionIsCandidateOnly(): void {
  const envelope = baseProposedAction();
  const report = assertRuntimeSignalAuthorityBoundary({
    signalKind: envelope.signalKind,
    sourceTrustLevel: envelope.sourceTrustLevel,
    target: envelope,
    targetLabel: 'proposed-action-envelope',
  });

  includes(report.allowedUses, 'admission-material-candidate', 'Runtime signal authority guard: proposed action can become admission material candidate');
  equal(report.canAdmit, false, 'Runtime signal authority guard: proposed action still cannot admit');
  equal(report.activatesEnforcement, false, 'Runtime signal authority guard: proposed action still cannot activate enforcement');
  equal(report.outputIsDecisionSupportOnly, true, 'Runtime signal authority guard: output remains decision-support only');
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

  includes(doc, 'RS07 Signal Authority Guard', 'Runtime signal authority guard: architecture note names RS07');
  includes(doc, 'attestor.runtime-signal-authority-guard.v1', 'Runtime signal authority guard: architecture note records version');
  equal(
    packageJson.scripts['test:runtime-signal-authority-guard'],
    'tsx tests/runtime-signal-authority-guard.test.ts',
    'Runtime signal authority guard: package script is registered',
  );
  includes(
    packageProbe,
    'RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION',
    'Runtime signal authority guard: package surface probe covers version export',
  );
  includes(
    packageProbe,
    'assertRuntimeSignalAuthorityBoundary',
    'Runtime signal authority guard: package surface probe covers guard export',
  );
}

testDescriptorIsNoAuthorityBoundary();
testDeclarationAndObservationStayReviewOnly();
testAuthorityUpgradeAttemptsFailClosed();
testProposedActionIsCandidateOnly();
testDocsPackageAndProbeStayAligned();

console.log(`Runtime signal authority guard tests: ${passed} passed, 0 failed`);
