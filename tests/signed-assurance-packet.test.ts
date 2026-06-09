import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFLICT_ABSTENTION_GATE_VERSION,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
  HUMAN_COMPREHENSION_GATE_VERSION,
  SIGNED_ASSURANCE_PACKET_SIGNING_PAYLOAD_VERSION,
  SIGNED_ASSURANCE_PACKET_VERSION,
  createSignedAssurancePacketHistoryBinding,
  createSignedAssurancePacket,
  createSignedAssurancePacketSigningPayload,
  evaluateHumanComprehensionGate,
  signedAssurancePacketDescriptor,
  type ConflictAbstentionGateResult,
  type CreateSignedAssurancePacketInput,
  type SignedAssurancePacketSignature,
} from '../src/consequence-admission/index.js';
import { generateKeyPair } from '../src/signing/keys.js';
import { signPayload, verifySignature } from '../src/signing/sign.js';

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

function rejects(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const digestE = `sha256:${'e'.repeat(64)}`;
const digestF = `sha256:${'f'.repeat(64)}`;
const digest1 = `sha256:${'1'.repeat(64)}`;
const digest2 = `sha256:${'2'.repeat(64)}`;
const digest3 = `sha256:${'3'.repeat(64)}`;
const signingKey = generateKeyPair();

function verifiedHistory(entryCount = 4) {
  return Object.freeze({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    historyId: 'history:packet-test',
    valid: true,
    failClosed: false,
    verifiedEntryCount: entryCount,
    rootDigest: digestC,
    firstEntryDigest: digestB,
    lastEntryDigest: digestD,
    failureReasons: [],
    reasonCodes: ['tamper-history-verified'],
    rawPayloadStored: false,
  });
}

function conflictGate(
  outcome: ConflictAbstentionGateResult['outcome'],
): ConflictAbstentionGateResult {
  return {
    version: CONFLICT_ABSTENTION_GATE_VERSION,
    relationshipAwareMonotoneFusionVersion:
      'attestor.relationship-aware-monotone-fusion.v1',
    signalRelationshipContractVersion: 'attestor.signal-relationship-contract.v1',
    layerOpinionSchemaVersion: 'attestor.layer-opinion-schema.v1',
    modulatorAuthorityTierVersion: 'attestor.modulator-authority-tier.v1',
    envelopeRefDigest: digestA,
    outcome,
    conflictScore: outcome === 'block-pressure' ? 0.7 : 0.1,
    abstentionScore: outcome === 'abstain-hold' ? 0.7 : 0.1,
    uncertaintyScore: outcome === 'review' ? 0.5 : 0.1,
    coverageGapScore: outcome === 'abstain-hold' ? 0.5 : 0.1,
    blockPressure: outcome === 'block-pressure' ? 0.8 : 0,
    reviewPressure: outcome === 'review' ? 0.5 : 0.1,
    maxGateScore: outcome === 'block-pressure' ? 0.8 : 0.5,
    reasonCodes: ['no-admit-authority'],
    reviewedInputs: {
      opinionCount: 2,
      relationshipCount: 1,
      modulatorCount: 1,
      abstentionCount: outcome === 'abstain-hold' ? 1 : 0,
      contradictionCount: outcome === 'block-pressure' ? 1 : 0,
      conflictOpinionCount: outcome === 'block-pressure' ? 1 : 0,
    },
    noLoosening: true,
    failClosedOnUncertainty: true,
    runsAfterRelationshipAwareFusion: true,
    canAdmit: false,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  };
}

function compactHumanGate() {
  return evaluateHumanComprehensionGate({
    envelopeRefDigest: digestA,
    conflictGate: conflictGate('continue'),
    reasonLineCandidates: [{
      lineId: 'line-1',
      severity: 'info',
      text: 'Digest-bound packet input is compact.',
      sourceDigest: digestB,
      reasonCodes: ['compact-input'],
      actionHint: null,
    }],
    activeQuestions: [],
    reviewLoad: {
      pendingReviewItemCount: 0,
      humanActionItemCount: 0,
      reviewerCapacityPerHour: 20,
      currentReviewRatePerMinute: 0,
    },
  });
}

function reviewHumanGate() {
  return evaluateHumanComprehensionGate({
    envelopeRefDigest: digestA,
    conflictGate: conflictGate('review'),
    reasonLineCandidates: [{
      lineId: 'review-line',
      severity: 'review',
      text: 'Reviewer must answer one digest-bound question.',
      sourceDigest: digestB,
      reasonCodes: ['review-required'],
      actionHint: 'Review policy gap.',
    }],
    activeQuestions: [{
      questionId: 'q-1',
      questionDigest: digestC,
      prompt: 'Approve the policy gap?',
      expectedAnswerKind: 'choice',
      impactBand: 'high',
      priorityScore: 90,
      resolvesReasonCodes: ['review-required'],
    }],
    reviewLoad: {
      pendingReviewItemCount: 4,
      humanActionItemCount: 1,
      reviewerCapacityPerHour: 20,
      currentReviewRatePerMinute: 1,
    },
  });
}

function baseInput(
  overrides: Partial<CreateSignedAssurancePacketInput> = {},
): CreateSignedAssurancePacketInput {
  const historyVerification = verifiedHistory();
  return {
    envelopeRefDigest: digestA,
    decisionBinding: {
      decision: 'block',
      decisionSourceDigest: digestB,
      reasonCodes: ['conflict-gate-block'],
    },
    historyBinding: createSignedAssurancePacketHistoryBinding(historyVerification),
    historyVerification,
    humanComprehensionGate: compactHumanGate(),
    policyRefDigests: [digestF, digestF],
    evidenceRefDigests: [digest1],
    signalRefDigests: [digest2],
    relationshipRefDigests: [digest3],
    replayRefDigests: [digestB],
    generatedAt: '2026-05-17T15:45:00.000Z',
    ...overrides,
  };
}

function evaluationSignature(
  input: CreateSignedAssurancePacketInput,
  overrides: Partial<SignedAssurancePacketSignature> = {},
): SignedAssurancePacketSignature {
  const payload = createSignedAssurancePacketSigningPayload(input);
  return {
    algorithm: 'ed25519',
    signature: signPayload(payload.canonical, signingKey.privateKeyPem),
    signerRef: 'test-local-ed25519-signer',
    publicKeyFingerprint: signingKey.fingerprint,
    signedAt: '2026-05-17T15:45:01.000Z',
    signingBoundary: 'runtime-memory',
    payloadDigest: payload.digest,
    productionReady: false,
    ...overrides,
  };
}

function testDescriptorRecordsNoAuthorityAndDigestBoundary(): void {
  const descriptor = signedAssurancePacketDescriptor();

  equal(
    descriptor.version,
    SIGNED_ASSURANCE_PACKET_VERSION,
    'Signed assurance packet: descriptor exposes version',
  );
  equal(
    descriptor.signingPayloadVersion,
    SIGNED_ASSURANCE_PACKET_SIGNING_PAYLOAD_VERSION,
    'Signed assurance packet: descriptor exposes signing payload version',
  );
  equal(
    descriptor.humanComprehensionGateVersion,
    HUMAN_COMPREHENSION_GATE_VERSION,
    'Signed assurance packet: descriptor links human comprehension gate',
  );
  equal(
    descriptor.tamperEvidentHistoryVersion,
    CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    'Signed assurance packet: descriptor links tamper-evident history',
  );
  equal(descriptor.digestOnlyRefs, true, 'Signed assurance packet: refs are digest-only');
  equal(descriptor.tamperEvidentHistoryBound, true, 'Signed assurance packet: history binding is required');
  equal(descriptor.signatureRequired, true, 'Signed assurance packet: signature is required');
  equal(descriptor.productionSigningBoundaryRequired, true, 'Signed assurance packet: production boundary is required');
  equal(descriptor.canAdmit, false, 'Signed assurance packet: descriptor cannot admit');
  equal(descriptor.grantsAuthority, false, 'Signed assurance packet: descriptor cannot grant authority');
  equal(descriptor.activatesEnforcement, false, 'Signed assurance packet: descriptor cannot activate enforcement');
  equal(descriptor.autoEnforce, false, 'Signed assurance packet: descriptor cannot auto-enforce');
  equal(descriptor.rawPayloadStored, false, 'Signed assurance packet: descriptor stores no raw payload');
  equal(descriptor.externalImmutabilityClaimed, false, 'Signed assurance packet: descriptor makes no immutability claim');
  equal(descriptor.complianceClaimed, false, 'Signed assurance packet: descriptor makes no compliance claim');
  equal(descriptor.productionReady, false, 'Signed assurance packet: descriptor is not production readiness');
}

function testUnsignedPacketIsDigestBoundAndHeld(): void {
  const packet = createSignedAssurancePacket(baseInput());
  const serialized = JSON.stringify(packet);

  equal(packet.signatureStatus, 'unsigned', 'Signed assurance packet: missing signature is explicit');
  equal(packet.signature, null, 'Signed assurance packet: unsigned packet has null signature');
  equal(packet.packetReady, false, 'Signed assurance packet: unsigned packet is not ready');
  equal(packet.activationReady, false, 'Signed assurance packet: packet never activates execution');
  ok(
    packet.remainingActivationBlockers.includes('assurance-packet-signature-required'),
    'Signed assurance packet: signature blocker is retained',
  );
  equal(
    (packet as unknown as { readonly policyRefDigests?: unknown }).policyRefDigests,
    undefined,
    'Signed assurance packet: packet exposes refs only through signing payload',
  );
  equal(packet.signingPayload.policyRefDigests.length, 1, 'Signed assurance packet: duplicate policy digests are deduplicated');
  ok(packet.signingPayload.digest.startsWith('sha256:'), 'Signed assurance packet: signing payload digest is present');
  ok(packet.digest.startsWith('sha256:'), 'Signed assurance packet: packet digest is present');
  equal(packet.canAdmit, false, 'Signed assurance packet: packet cannot admit');
  equal(packet.grantsAuthority, false, 'Signed assurance packet: packet cannot grant authority');
  equal(packet.rawPayloadStored, false, 'Signed assurance packet: no raw payload storage');
  equal(packet.externalImmutabilityClaimed, false, 'Signed assurance packet: no external immutability claim');
  equal(packet.complianceClaimed, false, 'Signed assurance packet: no compliance claim');
  ok(!serialized.includes('raw_customer_value_must_not_escape'), 'Signed assurance packet: raw customer marker is absent');
}

function testEvaluationSignatureVerifiesButDoesNotBecomeProduction(): void {
  const input = baseInput();
  const signature = evaluationSignature(input);
  const packet = createSignedAssurancePacket({
    ...input,
    signature,
    signatureVerificationPublicKeyPem: signingKey.publicKeyPem,
    signatureExpectedPublicKeyFingerprint: signingKey.fingerprint,
  });

  equal(packet.signatureStatus, 'signed-evaluation', 'Signed assurance packet: runtime signer is evaluation status');
  equal(packet.packetReady, true, 'Signed assurance packet: signed verified packet is packet-ready');
  equal(packet.productionSigningBoundaryReady, false, 'Signed assurance packet: runtime memory is not production boundary');
  ok(
    packet.remainingActivationBlockers.includes('production-signing-provider-required'),
    'Signed assurance packet: production signer remains required',
  );
  ok(
    verifySignature(
      packet.signingPayload.canonical,
      packet.signature?.signature ?? '',
      signingKey.publicKeyPem,
    ),
    'Signed assurance packet: evaluation signature verifies over canonical signing payload',
  );
  equal(packet.activationReady, false, 'Signed assurance packet: signature does not activate execution');
  equal(packet.productionReady, false, 'Signed assurance packet: evaluation signature does not claim production readiness');
}

function testRuntimeProductionClaimIsDowngraded(): void {
  const input = baseInput();
  const signature = evaluationSignature(input, {
    productionReady: true,
    signingBoundary: 'runtime-memory',
  });
  const packet = createSignedAssurancePacket({
    ...input,
    signature,
    signatureVerificationPublicKeyPem: signingKey.publicKeyPem,
    signatureExpectedPublicKeyFingerprint: signingKey.fingerprint,
  });

  equal(packet.signatureStatus, 'signed-evaluation', 'Signed assurance packet: runtime production claim is downgraded');
  equal(packet.productionSigningBoundaryReady, false, 'Signed assurance packet: unsafe boundary is not ready');
  equal(packet.signature?.productionReady, false, 'Signed assurance packet: productionReady is derived from boundary, not caller flag');
  ok(
    !packet.remainingActivationBlockers.includes('production-signing-boundary-invalid'),
    'Signed assurance packet: ignored caller production flag does not create production boundary readiness',
  );
}

function testExternalKmsBoundaryCanBeProductionSignedButNotAuthority(): void {
  const input = baseInput();
  const payload = createSignedAssurancePacketSigningPayload(input);
  const signature: SignedAssurancePacketSignature = {
    algorithm: 'external-kms',
    signature: `external-kms-signature:${payload.digest}`,
    signerRef: 'kms:prod-assurance-packet-signer',
    publicKeyFingerprint: 'kms-fingerprint:prod-assurance-packet-signer',
    signedAt: '2026-05-17T15:45:01.000Z',
    signingBoundary: 'external-kms-hsm',
    payloadDigest: payload.digest,
    productionReady: false,
  };
  const packet = createSignedAssurancePacket({ ...input, signature });

  equal(packet.signatureStatus, 'signed-production', 'Signed assurance packet: external KMS/HSM can be production-signed');
  equal(packet.productionSigningBoundaryReady, true, 'Signed assurance packet: production signing boundary is ready');
  equal(packet.signature?.productionReady, true, 'Signed assurance packet: productionReady is derived from production signing boundary');
  equal(packet.packetReady, true, 'Signed assurance packet: production-signed packet is packet-ready');
  equal(packet.activationReady, false, 'Signed assurance packet: production signature still does not activate');
  equal(packet.canAdmit, false, 'Signed assurance packet: production-signed packet still cannot admit');
  equal(packet.remainingActivationBlockers.length, 0, 'Signed assurance packet: block decision has no activation blockers');
}

function testReviewDecisionAndUnverifiedHistoryStayBlocked(): void {
  const input = baseInput({
    decisionBinding: {
      decision: 'review',
      decisionSourceDigest: digestB,
      reasonCodes: ['review-required'],
    },
    historyBinding: {
      version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
      rootDigest: digestC,
      lastEntryDigest: digestD,
      verificationDigest: digestE,
      entryCount: 4,
      verified: false,
    },
    humanComprehensionGate: reviewHumanGate(),
  });
  const signature = evaluationSignature(input);
  const packet = createSignedAssurancePacket({
    ...input,
    signature,
    signatureVerificationPublicKeyPem: signingKey.publicKeyPem,
    signatureExpectedPublicKeyFingerprint: signingKey.fingerprint,
  });

  equal(packet.packetReady, false, 'Signed assurance packet: unverified history keeps packet not ready');
  equal(packet.approvalRequired, true, 'Signed assurance packet: review path requires approval');
  ok(
    packet.remainingActivationBlockers.includes('tamper-history-verification-required'),
    'Signed assurance packet: unverified history blocker is retained',
  );
  ok(
    packet.remainingActivationBlockers.includes('human-review-required'),
    'Signed assurance packet: review blocker is retained',
  );
}

function testMismatchedInputsFailClosed(): void {
  rejects(
    () => createSignedAssurancePacketSigningPayload({
      ...baseInput(),
      envelopeRefDigest: digestF,
    }),
    /envelope digest must match/u,
    'Signed assurance packet: human gate envelope mismatch fails closed',
  );
  rejects(
    () => createSignedAssurancePacketSigningPayload({
      ...baseInput(),
      policyRefDigests: [],
    }),
    /policyRefDigests requires at least one digest/u,
    'Signed assurance packet: missing policy digest fails closed',
  );
  rejects(
    () => createSignedAssurancePacket({
      ...baseInput(),
      signature: {
        ...evaluationSignature(baseInput()),
        payloadDigest: digestF,
      },
    }),
    /payloadDigest must match/u,
    'Signed assurance packet: signature payload digest mismatch fails closed',
  );
  rejects(
    () => createSignedAssurancePacket({
      ...baseInput(),
      historyVerification: null,
    }),
    /verified historyBinding requires tamper-evident history verification evidence/u,
    'Signed assurance packet: verified history binding requires verification evidence',
  );
  rejects(
    () => createSignedAssurancePacket({
      ...baseInput(),
      historyBinding: {
        ...createSignedAssurancePacketHistoryBinding(verifiedHistory()),
        verificationDigest: digestE,
      },
    }),
    /verificationDigest must match/u,
    'Signed assurance packet: verified history binding rejects mismatched verification digest',
  );
  rejects(
    () => {
      const input = baseInput();
      return createSignedAssurancePacket({
        ...input,
        signature: evaluationSignature(input),
      });
    },
    /ed25519 signature requires a verification public key/u,
    'Signed assurance packet: ed25519 signature requires verification key evidence',
  );
  rejects(
    () => {
      const input = baseInput();
      return createSignedAssurancePacket({
        ...input,
        signature: evaluationSignature(input),
        signatureVerificationPublicKeyPem: signingKey.publicKeyPem,
      });
    },
    /expected public key fingerprint from a trusted source/u,
    'Signed assurance packet: ed25519 signature requires trusted fingerprint evidence',
  );
  rejects(
    () => {
      const input = baseInput();
      return createSignedAssurancePacket({
        ...input,
        signature: evaluationSignature(input),
        signatureVerificationPublicKeyPem: signingKey.publicKeyPem,
        signatureExpectedPublicKeyFingerprint: 'f'.repeat(32),
      });
    },
    /must match the expected trusted fingerprint/u,
    'Signed assurance packet: caller-supplied public key must match trusted fingerprint',
  );
  rejects(
    () => {
      const input = baseInput();
      const signature = evaluationSignature(input, {
        signature: '0'.repeat(128),
      });
      return createSignedAssurancePacket({
        ...input,
        signature,
        signatureVerificationPublicKeyPem: signingKey.publicKeyPem,
        signatureExpectedPublicKeyFingerprint: signingKey.fingerprint,
      });
    },
    /ed25519 signature verification failed/u,
    'Signed assurance packet: invalid ed25519 signature fails closed',
  );
}

function testDocsAndPackageScriptStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'signed-assurance-packet.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '# Signed Assurance Packet',
    'attestor.signed-assurance-packet.v1',
    'createSignedAssurancePacketHistoryBinding()',
    'digest-only references',
    'externalImmutabilityClaimed = false',
    'not a live signing service',
    'productionSigningBoundaryRequired = true',
    'verifier distribution and production KMS/HSM evidence',
    'without claiming in-toto or DSSE interoperability',
    'without converting measurement output into decision authority',
  ]) {
    includes(doc, expected, `Signed assurance packet doc: records ${expected}`);
  }
  includes(
    overview,
    '| 08 | complete | Signed assurance packet |',
    'Signed assurance packet overview: Step 08 is complete',
  );
  includes(
    overview,
    'src/consequence-admission/signed-assurance-packet.ts',
    'Signed assurance packet overview: source file is indexed',
  );
  equal(
    packageJson.scripts['test:signed-assurance-packet'],
    'tsx tests/signed-assurance-packet.test.ts',
    'Signed assurance packet: package script is registered',
  );
}

testDescriptorRecordsNoAuthorityAndDigestBoundary();
testUnsignedPacketIsDigestBoundAndHeld();
testEvaluationSignatureVerifiesButDoesNotBecomeProduction();
testRuntimeProductionClaimIsDowngraded();
testExternalKmsBoundaryCanBeProductionSignedButNotAuthority();
testReviewDecisionAndUnverifiedHistoryStayBlocked();
testMismatchedInputsFailClosed();
testDocsAndPackageScriptStayAligned();

console.log(`Signed assurance packet tests: ${passed} passed, 0 failed`);
