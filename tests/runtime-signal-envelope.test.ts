import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RUNTIME_SIGNAL_ENVELOPE_VERSION,
  createRuntimeSignalEnvelope,
  runtimeSignalEnvelopeDescriptor,
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

const baseInput = Object.freeze({
  signalKind: 'proposed-action',
  sourceTrustLevel: 'signed-or-bound',
  sourceSystem: 'customer.export-gateway',
  tenantRefDigest: digestA,
  actorRefDigest: digestB,
  runtimeRef: 'otel.span.export-001',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  runId: 'run:2026-05-18:001',
  eventTime: '2026-05-18T09:30:00Z',
  actionSurface: 'data-export',
  downstreamSystem: 'warehouse-export-service',
  operationRef: 'POST /api/v1/exports',
  inputSchemaDigest: digestC,
  argumentOrBodyDigest: digestD,
  policyRefs: ['policy:data-export.v1', 'policy:data-export.v1'],
  evidenceRefs: ['trace:export-run-001', 'evidence:approval-chain'],
  approvalRefs: ['approval:ticket-123'],
} as const);

function testDescriptorRecordsNoAuthorityBoundaries(): void {
  const descriptor = runtimeSignalEnvelopeDescriptor();

  equal(descriptor.version, RUNTIME_SIGNAL_ENVELOPE_VERSION, 'Runtime signal envelope: descriptor version is explicit');
  ok(descriptor.signalKinds.includes('declaration'), 'Runtime signal envelope: declaration kind is registered');
  ok(descriptor.signalKinds.includes('observation'), 'Runtime signal envelope: observation kind is registered');
  ok(descriptor.signalKinds.includes('proposed-action'), 'Runtime signal envelope: proposed-action kind is registered');
  ok(descriptor.signalKinds.includes('enforcement-proof'), 'Runtime signal envelope: enforcement-proof kind is registered');
  ok(descriptor.sourceTrustLevels.includes('signed-or-bound'), 'Runtime signal envelope: signed-or-bound trust is registered');
  equal(descriptor.digestFirst, true, 'Runtime signal envelope: digest-first boundary is explicit');
  equal(descriptor.rejectsUnknownInputFields, true, 'Runtime signal envelope: unknown inputs fail closed');
  equal(descriptor.canonicalDigestRequired, true, 'Runtime signal envelope: canonical digest is required');
  equal(descriptor.rawPayloadStored, false, 'Runtime signal envelope: descriptor stores no raw payload');
  equal(descriptor.rawPromptStored, false, 'Runtime signal envelope: descriptor stores no raw prompt');
  equal(descriptor.rawToolPayloadStored, false, 'Runtime signal envelope: descriptor stores no raw tool payload');
  equal(descriptor.rawProviderBodyStored, false, 'Runtime signal envelope: descriptor stores no raw provider body');
  equal(descriptor.canGrantAuthority, false, 'Runtime signal envelope: descriptor cannot grant authority');
  equal(descriptor.canAdmit, false, 'Runtime signal envelope: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Runtime signal envelope: descriptor cannot activate enforcement');
  equal(descriptor.autoEnforce, false, 'Runtime signal envelope: descriptor cannot auto-enforce');
  equal(descriptor.productionReady, false, 'Runtime signal envelope: descriptor is not production readiness');
  ok(descriptor.nonClaims.includes('not-admission'), 'Runtime signal envelope: non-claim list stays short and explicit');
}

function testEnvelopeNormalizesAndBindsSignalDigest(): void {
  const envelope = createRuntimeSignalEnvelope(baseInput);

  equal(envelope.version, RUNTIME_SIGNAL_ENVELOPE_VERSION, 'Runtime signal envelope: version is explicit');
  equal(envelope.signalKind, 'proposed-action', 'Runtime signal envelope: signal kind is preserved');
  equal(envelope.sourceTrustLevel, 'signed-or-bound', 'Runtime signal envelope: trust level is preserved');
  equal(envelope.sourceSystem, 'customer.export-gateway', 'Runtime signal envelope: source system is preserved');
  equal(envelope.tenantRefDigest, digestA, 'Runtime signal envelope: tenant digest is bound');
  equal(envelope.actorRefDigest, digestB, 'Runtime signal envelope: actor digest is bound');
  equal(envelope.eventTime, '2026-05-18T09:30:00.000Z', 'Runtime signal envelope: event time is normalized');
  equal(envelope.traceId, baseInput.traceId, 'Runtime signal envelope: W3C trace id is preserved');
  equal(envelope.policyRefs.length, 1, 'Runtime signal envelope: duplicate policy refs are removed');
  equal(envelope.evidenceRefs[0], 'evidence:approval-chain', 'Runtime signal envelope: refs are sorted');
  ok(envelope.canonical.includes('"signalKind":"proposed-action"'), 'Runtime signal envelope: canonical payload includes signal kind');
  ok(envelope.signalDigest.startsWith('sha256:'), 'Runtime signal envelope: signal digest is generated');
  equal(envelope.rawPayloadStored, false, 'Runtime signal envelope: no raw payload is stored');
  equal(envelope.rawCustomerIdentifierStored, false, 'Runtime signal envelope: no raw customer identifier is stored');
  equal(envelope.canGrantAuthority, false, 'Runtime signal envelope: output cannot grant authority');
  equal(envelope.grantsAuthority, false, 'Runtime signal envelope: output grants no authority');
  equal(envelope.canAdmit, false, 'Runtime signal envelope: output cannot admit');
  equal(envelope.activatesEnforcement, false, 'Runtime signal envelope: output cannot activate enforcement');
  equal(envelope.outputIsDecisionSupportOnly, true, 'Runtime signal envelope: output is decision-support only');
}

function testDigestIsStableAcrossReferenceOrdering(): void {
  const first = createRuntimeSignalEnvelope(baseInput);
  const second = createRuntimeSignalEnvelope({
    ...baseInput,
    policyRefs: ['policy:data-export.v1'],
    evidenceRefs: ['evidence:approval-chain', 'trace:export-run-001'],
  });

  equal(first.signalDigest, second.signalDigest, 'Runtime signal envelope: digest is stable after ref normalization');
}

function testFailsClosedOnUnsafeOrOverclaimingInput(): void {
  throws(
    () =>
      createRuntimeSignalEnvelope({
        ...baseInput,
        tenantRefDigest: 'tenant-raw-id',
      }),
    /tenantRefDigest must be a sha256 digest reference/u,
    'Runtime signal envelope: raw tenant references fail closed',
  );
  throws(
    () =>
      createRuntimeSignalEnvelope({
        ...baseInput,
        traceId: '00000000000000000000000000000000',
      }),
    /traceId must be a non-zero W3C trace-id/u,
    'Runtime signal envelope: invalid trace id fails closed',
  );
  throws(
    () =>
      createRuntimeSignalEnvelope({
        ...baseInput,
        evidenceRefs: ['evidence:sk_live_sensitive'],
      }),
    /must not contain raw sensitive material/u,
    'Runtime signal envelope: secret-like refs fail closed',
  );
  throws(
    () =>
      createRuntimeSignalEnvelope({
        ...baseInput,
        operationRef: '{"raw":"payload"}',
      }),
    /operationRef must be bounded metadata/u,
    'Runtime signal envelope: JSON-shaped raw material fails closed',
  );
  throws(
    () =>
      createRuntimeSignalEnvelope({
        ...baseInput,
        signalKind: 'observation',
        sourceTrustLevel: 'enforcement-proof',
      }),
    /enforcement-proof trust is only valid/u,
    'Runtime signal envelope: proof trust cannot attach to observation signals',
  );
  throws(
    () =>
      createRuntimeSignalEnvelope({
        ...baseInput,
        canAdmit: true,
      } as never),
    /unknown field: canAdmit/u,
    'Runtime signal envelope: authority-upgrade input fails closed',
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

  includes(doc, 'src/consequence-admission/runtime-signal-envelope.ts', 'Runtime signal envelope: architecture note links implementation');
  includes(doc, 'attestor.runtime-signal-envelope.v1', 'Runtime signal envelope: architecture note records version');
  equal(
    packageJson.scripts['test:runtime-signal-envelope'],
    'tsx tests/runtime-signal-envelope.test.ts',
    'Runtime signal envelope: package script is registered',
  );
  includes(
    packageProbe,
    'RUNTIME_SIGNAL_ENVELOPE_VERSION',
    'Runtime signal envelope: package surface probe covers version export',
  );
  includes(
    packageProbe,
    'createRuntimeSignalEnvelope',
    'Runtime signal envelope: package surface probe covers builder export',
  );
}

testDescriptorRecordsNoAuthorityBoundaries();
testEnvelopeNormalizesAndBindsSignalDigest();
testDigestIsStableAcrossReferenceOrdering();
testFailsClosedOnUnsafeOrOverclaimingInput();
testDocsPackageAndProbeStayAligned();

console.log(`Runtime signal envelope tests: ${passed} passed, 0 failed`);
