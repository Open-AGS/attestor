import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RUNTIME_SIGNAL_SOURCE_BINDING_VERSION,
  createRuntimeSignalEnvelope,
  createRuntimeSignalSourceBinding,
  runtimeSignalSourceBindingDescriptor,
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
const digestF = `sha256:${'f'.repeat(64)}`;

function envelope(sourceTrustLevel = 'signed-or-bound' as const) {
  return createRuntimeSignalEnvelope({
    signalKind: sourceTrustLevel === 'enforcement-proof' ? 'enforcement-proof' : 'proposed-action',
    sourceTrustLevel,
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
    policyRefs: ['policy:data-export.v1'],
    evidenceRefs: ['trace:export-run-001'],
    approvalRefs: ['approval:ticket-123'],
  });
}

function testDescriptorRecordsTrustClassesAndNonAuthority(): void {
  const descriptor = runtimeSignalSourceBindingDescriptor();

  equal(descriptor.version, RUNTIME_SIGNAL_SOURCE_BINDING_VERSION, 'Runtime signal source binding: descriptor version is explicit');
  ok(descriptor.bindingClasses.includes('unverified'), 'Runtime signal source binding: unverified class is registered');
  ok(descriptor.bindingClasses.includes('authenticated'), 'Runtime signal source binding: authenticated class is registered');
  ok(descriptor.bindingClasses.includes('signed'), 'Runtime signal source binding: signed class is registered');
  ok(descriptor.bindingClasses.includes('customer-attested'), 'Runtime signal source binding: customer-attested class is registered');
  ok(descriptor.bindingClasses.includes('pep-proof'), 'Runtime signal source binding: PEP-proof class is registered');
  ok(descriptor.evidenceKinds.includes('http-message-signature'), 'Runtime signal source binding: HTTP Message Signature evidence is registered');
  ok(descriptor.evidenceKinds.includes('dpop-proof'), 'Runtime signal source binding: DPoP evidence is registered');
  ok(descriptor.evidenceKinds.includes('mtls-client-certificate'), 'Runtime signal source binding: mTLS evidence is registered');
  ok(descriptor.evidenceKinds.includes('spiffe-svid'), 'Runtime signal source binding: SPIFFE evidence is registered');
  equal(descriptor.trustLevelToBindingClass['signed-or-bound'], 'signed', 'Runtime signal source binding: signed trust maps to signed class');
  equal(descriptor.trustLevelToBindingClass['enforcement-proof'], 'pep-proof', 'Runtime signal source binding: enforcement trust maps to PEP proof');
  equal(descriptor.signedEvidenceMustCoverEnvelopeDigest, true, 'Runtime signal source binding: signed evidence must cover envelope digest');
  equal(descriptor.pepProofRequiresEnforcementProofSignal, true, 'Runtime signal source binding: PEP proof requires enforcement-proof signal');
  equal(descriptor.digestOnly, true, 'Runtime signal source binding: digest-only boundary is explicit');
  equal(descriptor.canGrantAuthority, false, 'Runtime signal source binding: descriptor cannot grant authority');
  equal(descriptor.canAdmit, false, 'Runtime signal source binding: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Runtime signal source binding: descriptor cannot activate enforcement');
  equal(descriptor.productionReady, false, 'Runtime signal source binding: descriptor is not production readiness');
}

function testSignedEvidenceBindsEnvelopeDigest(): void {
  const env = envelope();
  const binding = createRuntimeSignalSourceBinding({
    envelope: env,
    evidence: [
      {
        kind: 'http-message-signature',
        evidenceRefDigest: digestE,
        bindingRefDigest: digestF,
        coveredSignalDigest: env.signalDigest,
      },
      {
        kind: 'dpop-proof',
        evidenceRefDigest: digestE,
        bindingRefDigest: digestF,
        coveredSignalDigest: env.signalDigest,
      },
    ],
  });

  equal(binding.version, RUNTIME_SIGNAL_SOURCE_BINDING_VERSION, 'Runtime signal source binding: result version is explicit');
  equal(binding.bindingClass, 'signed', 'Runtime signal source binding: signed evidence derives signed class');
  equal(binding.envelopeSignalDigest, env.signalDigest, 'Runtime signal source binding: envelope digest is bound');
  equal(binding.evidenceRefDigests.length, 1, 'Runtime signal source binding: duplicate evidence digests are deduped');
  equal(binding.bindingRefDigests[0], digestF, 'Runtime signal source binding: binding digest is recorded');
  equal(binding.coveredSignalDigests[0], env.signalDigest, 'Runtime signal source binding: covered signal digest is recorded');
  ok(binding.sourceBindingDigest.startsWith('sha256:'), 'Runtime signal source binding: canonical digest is generated');
  equal(binding.sourceVerifiedForReview, true, 'Runtime signal source binding: signed source is verified for review');
  equal(binding.canAdmit, false, 'Runtime signal source binding: signed binding cannot admit');
  equal(binding.activatesEnforcement, false, 'Runtime signal source binding: signed binding cannot enforce');
}

function testUnverifiedAuthenticatedCustomerAndPepClasses(): void {
  const unverified = createRuntimeSignalSourceBinding({
    envelope: envelope('observed'),
    evidence: [{ kind: 'none' }],
  });
  const authenticated = createRuntimeSignalSourceBinding({
    envelope: envelope('authenticated-source'),
    evidence: [{ kind: 'transport-auth', evidenceRefDigest: digestE }],
  });
  const attested = createRuntimeSignalSourceBinding({
    envelope: envelope('customer-attested'),
    evidence: [{ kind: 'customer-attestation', evidenceRefDigest: digestE }],
  });
  const pepEnv = envelope('enforcement-proof');
  const pep = createRuntimeSignalSourceBinding({
    envelope: pepEnv,
    evidence: [
      {
        kind: 'pep-receipt',
        evidenceRefDigest: digestE,
        bindingRefDigest: digestF,
        coveredSignalDigest: pepEnv.signalDigest,
      },
    ],
  });

  equal(unverified.bindingClass, 'unverified', 'Runtime signal source binding: none evidence maps to unverified');
  equal(unverified.sourceVerifiedForReview, false, 'Runtime signal source binding: unverified source is not verified');
  equal(authenticated.bindingClass, 'authenticated', 'Runtime signal source binding: transport auth maps to authenticated');
  equal(attested.bindingClass, 'customer-attested', 'Runtime signal source binding: customer attestation maps to attested');
  equal(pep.bindingClass, 'pep-proof', 'Runtime signal source binding: PEP receipt maps to PEP proof');
  equal(pep.signalKind, 'enforcement-proof', 'Runtime signal source binding: PEP proof binds enforcement-proof signal');
}

function testFailsClosedOnMismatchedOrUnboundTrust(): void {
  const signedEnv = envelope('signed-or-bound');

  throws(
    () =>
      createRuntimeSignalSourceBinding({
        envelope: signedEnv,
        evidence: [{ kind: 'transport-auth', evidenceRefDigest: digestE }],
      }),
    /does not match envelope sourceTrustLevel signed-or-bound/u,
    'Runtime signal source binding: signed envelope cannot be satisfied by transport auth only',
  );
  throws(
    () =>
      createRuntimeSignalSourceBinding({
        envelope: signedEnv,
        evidence: [
          {
            kind: 'http-message-signature',
            evidenceRefDigest: digestE,
            bindingRefDigest: digestF,
            coveredSignalDigest: digestA,
          },
        ],
      }),
    /must cover the envelope signalDigest/u,
    'Runtime signal source binding: signed evidence must cover the envelope digest',
  );
  throws(
    () =>
      createRuntimeSignalSourceBinding({
        envelope: signedEnv,
        evidence: [
          {
            kind: 'dpop-proof',
            evidenceRefDigest: digestE,
            coveredSignalDigest: signedEnv.signalDigest,
          },
        ],
      }),
    /requires bindingRefDigest/u,
    'Runtime signal source binding: sender-bound evidence requires a binding digest',
  );
  throws(
    () =>
      createRuntimeSignalSourceBinding({
        envelope: signedEnv,
        evidence: [{ kind: 'none' }, { kind: 'dpop-proof', evidenceRefDigest: digestE }],
      }),
    /none evidence cannot be mixed/u,
    'Runtime signal source binding: none evidence cannot be mixed with verified evidence',
  );
  throws(
    () =>
      createRuntimeSignalSourceBinding({
        envelope: signedEnv,
        evidence: [
          {
            kind: 'pep-receipt',
            evidenceRefDigest: digestE,
            bindingRefDigest: digestF,
            coveredSignalDigest: signedEnv.signalDigest,
          },
        ],
      }),
    /does not match envelope sourceTrustLevel signed-or-bound/u,
    'Runtime signal source binding: PEP proof cannot attach to non-enforcement envelope trust',
  );
  throws(
    () =>
      createRuntimeSignalSourceBinding({
        envelope: signedEnv,
        evidence: [
          {
            kind: 'http-message-signature',
            evidenceRefDigest: 'http-message-signature-id',
            bindingRefDigest: digestF,
            coveredSignalDigest: signedEnv.signalDigest,
          },
        ],
      }),
    /evidenceRefDigest must be a sha256 digest reference/u,
    'Runtime signal source binding: raw evidence refs fail closed',
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

  includes(doc, 'RS03 Source Binding', 'Runtime signal source binding: architecture note names RS03');
  includes(doc, 'attestor.runtime-signal-source-binding.v1', 'Runtime signal source binding: architecture note records version');
  equal(
    packageJson.scripts['test:runtime-signal-source-binding'],
    'tsx tests/runtime-signal-source-binding.test.ts',
    'Runtime signal source binding: package script is registered',
  );
  includes(
    packageProbe,
    'RUNTIME_SIGNAL_SOURCE_BINDING_VERSION',
    'Runtime signal source binding: package surface probe covers version export',
  );
  includes(
    packageProbe,
    'createRuntimeSignalSourceBinding',
    'Runtime signal source binding: package surface probe covers builder export',
  );
}

testDescriptorRecordsTrustClassesAndNonAuthority();
testSignedEvidenceBindsEnvelopeDigest();
testUnverifiedAuthenticatedCustomerAndPepClasses();
testFailsClosedOnMismatchedOrUnboundTrust();
testDocsPackageAndProbeStayAligned();

console.log(`Runtime signal source binding tests: ${passed} passed, 0 failed`);
