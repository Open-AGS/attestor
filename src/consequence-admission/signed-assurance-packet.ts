import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  HUMAN_COMPREHENSION_GATE_VERSION,
  type HumanComprehensionGateResult,
} from './human-comprehension-gate.js';
import {
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
} from './tamper-evident-history.js';

export const SIGNED_ASSURANCE_PACKET_VERSION =
  'attestor.signed-assurance-packet.v1';
export const SIGNED_ASSURANCE_PACKET_SIGNING_PAYLOAD_VERSION =
  'attestor.signed-assurance-packet-signing-payload.v1';

export const SIGNED_ASSURANCE_PACKET_DECISIONS = [
  'admit',
  'narrow',
  'review',
  'block',
] as const;
export type SignedAssurancePacketDecision =
  typeof SIGNED_ASSURANCE_PACKET_DECISIONS[number];

export const SIGNED_ASSURANCE_PACKET_SIGNATURE_ALGORITHMS = [
  'ed25519',
  'external-kms',
] as const;
export type SignedAssurancePacketSignatureAlgorithm =
  typeof SIGNED_ASSURANCE_PACKET_SIGNATURE_ALGORITHMS[number];

export const SIGNED_ASSURANCE_PACKET_SIGNING_BOUNDARIES = [
  'runtime-memory',
  'runtime-file-pem',
  'external-kms-hsm',
] as const;
export type SignedAssurancePacketSigningBoundary =
  typeof SIGNED_ASSURANCE_PACKET_SIGNING_BOUNDARIES[number];

export const SIGNED_ASSURANCE_PACKET_PRODUCTION_SIGNING_BOUNDARIES = [
  'external-kms-hsm',
] as const satisfies readonly SignedAssurancePacketSigningBoundary[];

export type SignedAssurancePacketSignatureStatus =
  | 'unsigned'
  | 'signed-evaluation'
  | 'signed-production';

export const SIGNED_ASSURANCE_PACKET_BLOCKERS = [
  'assurance-packet-signature-required',
  'production-signing-provider-required',
  'production-signing-boundary-invalid',
  'tamper-history-verification-required',
  'human-review-required',
  'review-overload-visible',
  'downstream-authority-required',
] as const;
export type SignedAssurancePacketBlocker =
  typeof SIGNED_ASSURANCE_PACKET_BLOCKERS[number];

export interface SignedAssurancePacketHistoryBinding {
  readonly version: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION;
  readonly rootDigest: string;
  readonly lastEntryDigest: string;
  readonly verificationDigest: string;
  readonly entryCount: number;
  readonly verified: boolean;
}

export interface SignedAssurancePacketDecisionBinding {
  readonly decision: SignedAssurancePacketDecision;
  readonly decisionSourceDigest: string;
  readonly reasonCodes: readonly string[];
}

export interface SignedAssurancePacketHumanGateBinding {
  readonly version: typeof HUMAN_COMPREHENSION_GATE_VERSION;
  readonly resultDigest: string;
  readonly status: HumanComprehensionGateResult['status'];
  readonly escalationRequired: boolean;
  readonly reasonLineCount: number;
  readonly activeQuestionCount: number;
  readonly reviewLoadBand: HumanComprehensionGateResult['reviewLoad']['band'];
  readonly reasonCodes: readonly string[];
}

export interface SignedAssurancePacketSigningPayload {
  readonly version: typeof SIGNED_ASSURANCE_PACKET_SIGNING_PAYLOAD_VERSION;
  readonly packetType: typeof SIGNED_ASSURANCE_PACKET_VERSION;
  readonly envelopeRefDigest: string;
  readonly decisionBinding: SignedAssurancePacketDecisionBinding;
  readonly historyBinding: SignedAssurancePacketHistoryBinding;
  readonly humanGateBinding: SignedAssurancePacketHumanGateBinding;
  readonly policyRefDigests: readonly string[];
  readonly evidenceRefDigests: readonly string[];
  readonly signalRefDigests: readonly string[];
  readonly relationshipRefDigests: readonly string[];
  readonly replayRefDigests: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface SignedAssurancePacketSignature {
  readonly algorithm: SignedAssurancePacketSignatureAlgorithm;
  readonly signature: string;
  readonly signerRef: string;
  readonly publicKeyFingerprint: string | null;
  readonly signedAt: string;
  readonly signingBoundary: SignedAssurancePacketSigningBoundary;
  readonly payloadDigest: string;
  readonly productionReady: boolean;
}

export interface CreateSignedAssurancePacketInput {
  readonly envelopeRefDigest: string;
  readonly decisionBinding: SignedAssurancePacketDecisionBinding;
  readonly historyBinding: SignedAssurancePacketHistoryBinding;
  readonly humanComprehensionGate: HumanComprehensionGateResult;
  readonly policyRefDigests: readonly string[];
  readonly evidenceRefDigests: readonly string[];
  readonly signalRefDigests: readonly string[];
  readonly relationshipRefDigests: readonly string[];
  readonly replayRefDigests: readonly string[];
  readonly signature?: SignedAssurancePacketSignature | null;
  readonly generatedAt?: string | null;
}

export interface SignedAssurancePacket {
  readonly version: typeof SIGNED_ASSURANCE_PACKET_VERSION;
  readonly packetId: string;
  readonly generatedAt: string;
  readonly envelopeRefDigest: string;
  readonly decisionBinding: SignedAssurancePacketDecisionBinding;
  readonly historyBinding: SignedAssurancePacketHistoryBinding;
  readonly humanGateBinding: SignedAssurancePacketHumanGateBinding;
  readonly signingPayload: SignedAssurancePacketSigningPayload;
  readonly signatureStatus: SignedAssurancePacketSignatureStatus;
  readonly signatureRequired: true;
  readonly signature: SignedAssurancePacketSignature | null;
  readonly productionSigningBoundaryRequired: true;
  readonly productionSigningBoundaryReady: boolean;
  readonly packetReady: boolean;
  readonly activationReady: false;
  readonly remainingActivationBlockers: readonly SignedAssurancePacketBlocker[];
  readonly approvalRequired: boolean;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly externalImmutabilityClaimed: false;
  readonly complianceClaimed: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface SignedAssurancePacketDescriptor {
  readonly version: typeof SIGNED_ASSURANCE_PACKET_VERSION;
  readonly signingPayloadVersion:
    typeof SIGNED_ASSURANCE_PACKET_SIGNING_PAYLOAD_VERSION;
  readonly humanComprehensionGateVersion: typeof HUMAN_COMPREHENSION_GATE_VERSION;
  readonly tamperEvidentHistoryVersion:
    typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION;
  readonly decisions: readonly SignedAssurancePacketDecision[];
  readonly signatureAlgorithms: readonly SignedAssurancePacketSignatureAlgorithm[];
  readonly signingBoundaries: readonly SignedAssurancePacketSigningBoundary[];
  readonly blockers: readonly SignedAssurancePacketBlocker[];
  readonly digestOnlyRefs: true;
  readonly tamperEvidentHistoryBound: true;
  readonly signatureRequired: true;
  readonly productionSigningBoundaryRequired: true;
  readonly pureFunction: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly externalImmutabilityClaimed: false;
  readonly complianceClaimed: false;
  readonly productionReady: false;
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function hashCanonical(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function normalizeDigest(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Signed assurance packet ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeDigestSet(
  values: readonly string[],
  fieldName: string,
): readonly string[] {
  if (values.length === 0) {
    throw new Error(`Signed assurance packet ${fieldName} requires at least one digest.`);
  }
  return Object.freeze(
    [...new Set(values.map((value) => normalizeDigest(value, fieldName)))].sort(),
  );
}

function normalizeIdentifier(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 512 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Signed assurance packet ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Signed assurance packet ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `Signed assurance packet ${fieldName} must be a non-negative integer.`,
    );
  }
  return value;
}

function normalizeDecisionBinding(
  input: SignedAssurancePacketDecisionBinding,
): SignedAssurancePacketDecisionBinding {
  if (!SIGNED_ASSURANCE_PACKET_DECISIONS.includes(input.decision)) {
    throw new Error(
      `Signed assurance packet decision must be one of: ${SIGNED_ASSURANCE_PACKET_DECISIONS.join(', ')}.`,
    );
  }
  return Object.freeze({
    decision: input.decision,
    decisionSourceDigest: normalizeDigest(
      input.decisionSourceDigest,
      'decisionSourceDigest',
    ),
    reasonCodes: Object.freeze(
      [...new Set(input.reasonCodes.map((code) => normalizeIdentifier(code, 'reasonCodes')))]
        .sort(),
    ),
  });
}

function normalizeHistoryBinding(
  input: SignedAssurancePacketHistoryBinding,
): SignedAssurancePacketHistoryBinding {
  if (input.version !== CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION) {
    throw new Error(
      'Signed assurance packet historyBinding version must match the tamper-evident history version.',
    );
  }
  return Object.freeze({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    rootDigest: normalizeDigest(input.rootDigest, 'historyBinding.rootDigest'),
    lastEntryDigest: normalizeDigest(
      input.lastEntryDigest,
      'historyBinding.lastEntryDigest',
    ),
    verificationDigest: normalizeDigest(
      input.verificationDigest,
      'historyBinding.verificationDigest',
    ),
    entryCount: normalizeNonNegativeInteger(
      input.entryCount,
      'historyBinding.entryCount',
    ),
    verified: input.verified === true,
  });
}

function humanGateBinding(
  input: HumanComprehensionGateResult,
): SignedAssurancePacketHumanGateBinding {
  if (input.version !== HUMAN_COMPREHENSION_GATE_VERSION) {
    throw new Error(
      'Signed assurance packet humanComprehensionGate version must match the human comprehension gate version.',
    );
  }
  if (
    input.canAdmit ||
    input.grantsAuthority ||
    input.activatesEnforcement ||
    input.autoEnforce ||
    input.rawPayloadStored ||
    input.productionReady
  ) {
    throw new Error(
      'Signed assurance packet humanComprehensionGate must be no-authority and data-minimized.',
    );
  }
  return Object.freeze({
    version: HUMAN_COMPREHENSION_GATE_VERSION,
    resultDigest: hashCanonical(input as unknown as CanonicalReleaseJsonValue),
    status: input.status,
    escalationRequired: input.escalationRequired,
    reasonLineCount: normalizeNonNegativeInteger(
      input.reasonLineCount,
      'humanComprehensionGate.reasonLineCount',
    ),
    activeQuestionCount: normalizeNonNegativeInteger(
      input.activeQuestionCount,
      'humanComprehensionGate.activeQuestionCount',
    ),
    reviewLoadBand: input.reviewLoad.band,
    reasonCodes: Object.freeze(
      [...new Set(input.reasonCodes.map((code) => normalizeIdentifier(code, 'humanGate.reasonCodes')))]
        .sort(),
    ),
  });
}

function normalizeSignature(
  signature: SignedAssurancePacketSignature | null | undefined,
  expectedPayloadDigest: string,
): SignedAssurancePacketSignature | null {
  if (!signature) return null;
  if (!SIGNED_ASSURANCE_PACKET_SIGNATURE_ALGORITHMS.includes(signature.algorithm)) {
    throw new Error(
      `Signed assurance packet signature algorithm must be one of: ${SIGNED_ASSURANCE_PACKET_SIGNATURE_ALGORITHMS.join(', ')}.`,
    );
  }
  if (!SIGNED_ASSURANCE_PACKET_SIGNING_BOUNDARIES.includes(signature.signingBoundary)) {
    throw new Error(
      `Signed assurance packet signingBoundary must be one of: ${SIGNED_ASSURANCE_PACKET_SIGNING_BOUNDARIES.join(', ')}.`,
    );
  }
  const payloadDigest = normalizeDigest(signature.payloadDigest, 'signature.payloadDigest');
  if (payloadDigest !== expectedPayloadDigest) {
    throw new Error(
      'Signed assurance packet signature payloadDigest must match the signing payload digest.',
    );
  }
  return Object.freeze({
    algorithm: signature.algorithm,
    signature: normalizeIdentifier(signature.signature, 'signature.signature'),
    signerRef: normalizeIdentifier(signature.signerRef, 'signature.signerRef'),
    publicKeyFingerprint: signature.publicKeyFingerprint === null
      ? null
      : normalizeIdentifier(
        signature.publicKeyFingerprint,
        'signature.publicKeyFingerprint',
      ),
    signedAt: normalizeIsoTimestamp(
      signature.signedAt,
      new Date().toISOString(),
      'signature.signedAt',
    ),
    signingBoundary: signature.signingBoundary,
    payloadDigest,
    productionReady: signature.productionReady === true,
  });
}

function productionSigningBoundaryReady(
  signature: SignedAssurancePacketSignature | null,
): boolean {
  return signature !== null &&
    signature.productionReady &&
    (SIGNED_ASSURANCE_PACKET_PRODUCTION_SIGNING_BOUNDARIES as readonly SignedAssurancePacketSigningBoundary[])
      .includes(signature.signingBoundary);
}

function signatureStatusFor(
  signature: SignedAssurancePacketSignature | null,
): SignedAssurancePacketSignatureStatus {
  if (!signature) return 'unsigned';
  return productionSigningBoundaryReady(signature)
    ? 'signed-production'
    : 'signed-evaluation';
}

function remainingActivationBlockers(input: {
  readonly signature: SignedAssurancePacketSignature | null;
  readonly signatureStatus: SignedAssurancePacketSignatureStatus;
  readonly historyBinding: SignedAssurancePacketHistoryBinding;
  readonly humanGateBinding: SignedAssurancePacketHumanGateBinding;
  readonly decisionBinding: SignedAssurancePacketDecisionBinding;
  readonly productionSigningBoundaryReady: boolean;
}): readonly SignedAssurancePacketBlocker[] {
  const blockers = new Set<SignedAssurancePacketBlocker>();
  if (input.signatureStatus === 'unsigned') {
    blockers.add('assurance-packet-signature-required');
  }
  if (input.signatureStatus === 'signed-evaluation') {
    blockers.add('production-signing-provider-required');
  }
  if (
    input.signature !== null &&
    input.signature.productionReady &&
    !input.productionSigningBoundaryReady
  ) {
    blockers.add('production-signing-boundary-invalid');
  }
  if (!input.historyBinding.verified) {
    blockers.add('tamper-history-verification-required');
  }
  if (
    input.humanGateBinding.status !== 'compact' ||
    input.decisionBinding.decision === 'review'
  ) {
    blockers.add('human-review-required');
  }
  if (input.humanGateBinding.status === 'overloaded') {
    blockers.add('review-overload-visible');
  }
  if (
    input.decisionBinding.decision === 'admit' ||
    input.decisionBinding.decision === 'narrow'
  ) {
    blockers.add('downstream-authority-required');
  }
  return Object.freeze([...blockers].sort());
}

function packetIdFor(input: {
  readonly envelopeRefDigest: string;
  readonly signingPayloadDigest: string;
  readonly signatureStatus: SignedAssurancePacketSignatureStatus;
  readonly signatureDigest: string | null;
}): string {
  return `signed-assurance-packet:${hashCanonical(input as unknown as CanonicalReleaseJsonValue)}`;
}

export function signedAssurancePacketDescriptor():
  SignedAssurancePacketDescriptor {
  return Object.freeze({
    version: SIGNED_ASSURANCE_PACKET_VERSION,
    signingPayloadVersion: SIGNED_ASSURANCE_PACKET_SIGNING_PAYLOAD_VERSION,
    humanComprehensionGateVersion: HUMAN_COMPREHENSION_GATE_VERSION,
    tamperEvidentHistoryVersion: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    decisions: SIGNED_ASSURANCE_PACKET_DECISIONS,
    signatureAlgorithms: SIGNED_ASSURANCE_PACKET_SIGNATURE_ALGORITHMS,
    signingBoundaries: SIGNED_ASSURANCE_PACKET_SIGNING_BOUNDARIES,
    blockers: SIGNED_ASSURANCE_PACKET_BLOCKERS,
    digestOnlyRefs: true,
    tamperEvidentHistoryBound: true,
    signatureRequired: true,
    productionSigningBoundaryRequired: true,
    pureFunction: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadStored: false,
    externalImmutabilityClaimed: false,
    complianceClaimed: false,
    productionReady: false,
  });
}

export function createSignedAssurancePacketSigningPayload(
  input: CreateSignedAssurancePacketInput,
): SignedAssurancePacketSigningPayload {
  const envelopeRefDigest = normalizeDigest(
    input.envelopeRefDigest,
    'envelopeRefDigest',
  );
  if (input.humanComprehensionGate.envelopeRefDigest !== envelopeRefDigest) {
    throw new Error(
      'Signed assurance packet humanComprehensionGate envelope digest must match input envelope digest.',
    );
  }
  const decisionBinding = normalizeDecisionBinding(input.decisionBinding);
  const historyBinding = normalizeHistoryBinding(input.historyBinding);
  const humanBinding = humanGateBinding(input.humanComprehensionGate);
  const payload = {
    version: SIGNED_ASSURANCE_PACKET_SIGNING_PAYLOAD_VERSION,
    packetType: SIGNED_ASSURANCE_PACKET_VERSION,
    envelopeRefDigest,
    decisionBinding,
    historyBinding,
    humanGateBinding: humanBinding,
    policyRefDigests: normalizeDigestSet(input.policyRefDigests, 'policyRefDigests'),
    evidenceRefDigests: normalizeDigestSet(
      input.evidenceRefDigests,
      'evidenceRefDigests',
    ),
    signalRefDigests: normalizeDigestSet(input.signalRefDigests, 'signalRefDigests'),
    relationshipRefDigests: normalizeDigestSet(
      input.relationshipRefDigests,
      'relationshipRefDigests',
    ),
    replayRefDigests: normalizeDigestSet(input.replayRefDigests, 'replayRefDigests'),
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createSignedAssurancePacket(
  input: CreateSignedAssurancePacketInput,
): SignedAssurancePacket {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const signingPayload = createSignedAssurancePacketSigningPayload(input);
  const signature = normalizeSignature(input.signature, signingPayload.digest);
  const signatureStatus = signatureStatusFor(signature);
  const boundaryReady = productionSigningBoundaryReady(signature);
  const decisionBinding = normalizeDecisionBinding(input.decisionBinding);
  const historyBinding = normalizeHistoryBinding(input.historyBinding);
  const humanBinding = humanGateBinding(input.humanComprehensionGate);
  const blockers = remainingActivationBlockers({
    signature,
    signatureStatus,
    historyBinding,
    humanGateBinding: humanBinding,
    decisionBinding,
    productionSigningBoundaryReady: boundaryReady,
  });
  const packetReady = signatureStatus !== 'unsigned' && historyBinding.verified;
  const payload = {
    version: SIGNED_ASSURANCE_PACKET_VERSION,
    packetId: packetIdFor({
      envelopeRefDigest: signingPayload.envelopeRefDigest,
      signingPayloadDigest: signingPayload.digest,
      signatureStatus,
      signatureDigest: signature === null
        ? null
        : hashCanonical({
          algorithm: signature.algorithm,
          payloadDigest: signature.payloadDigest,
          signature: signature.signature,
          signerRef: signature.signerRef,
          signedAt: signature.signedAt,
          signingBoundary: signature.signingBoundary,
        } as unknown as CanonicalReleaseJsonValue),
    }),
    generatedAt,
    envelopeRefDigest: signingPayload.envelopeRefDigest,
    decisionBinding,
    historyBinding,
    humanGateBinding: humanBinding,
    signingPayload,
    signatureStatus,
    signatureRequired: true,
    signature,
    productionSigningBoundaryRequired: true,
    productionSigningBoundaryReady: boundaryReady,
    packetReady,
    activationReady: false,
    remainingActivationBlockers: blockers,
    approvalRequired: humanBinding.status !== 'compact' ||
      decisionBinding.decision === 'review' ||
      decisionBinding.decision === 'admit' ||
      decisionBinding.decision === 'narrow',
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadStored: false,
    externalImmutabilityClaimed: false,
    complianceClaimed: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
