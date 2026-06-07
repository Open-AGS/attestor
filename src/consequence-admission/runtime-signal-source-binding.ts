import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  RUNTIME_SIGNAL_ENVELOPE_VERSION,
  type RuntimeSignalEnvelope,
  type RuntimeSignalSourceTrustLevel,
} from './runtime-signal-envelope.js';

export const RUNTIME_SIGNAL_SOURCE_BINDING_VERSION =
  'attestor.runtime-signal-source-binding.v1';

export const RUNTIME_SIGNAL_SOURCE_BINDING_CLASSES = [
  'unverified',
  'authenticated',
  'signed',
  'customer-attested',
  'pep-proof',
] as const;
export type RuntimeSignalSourceBindingClass =
  typeof RUNTIME_SIGNAL_SOURCE_BINDING_CLASSES[number];

export const RUNTIME_SIGNAL_SOURCE_BINDING_EVIDENCE_KINDS = [
  'none',
  'transport-auth',
  'http-message-signature',
  'dpop-proof',
  'mtls-client-certificate',
  'spiffe-svid',
  'customer-attestation',
  'pep-receipt',
] as const;
export type RuntimeSignalSourceBindingEvidenceKind =
  typeof RUNTIME_SIGNAL_SOURCE_BINDING_EVIDENCE_KINDS[number];

export const RUNTIME_SIGNAL_SOURCE_BINDING_REQUIRED_FIELDS = [
  'envelopeSignalDigest',
  'sourceSystem',
  'signalKind',
  'envelopeSourceTrustLevel',
  'bindingClass',
  'evidenceKinds',
  'evidenceRefDigests',
  'bindingRefDigests',
  'coveredSignalDigests',
  'sourceBindingDigest',
] as const;
export type RuntimeSignalSourceBindingRequiredField =
  typeof RUNTIME_SIGNAL_SOURCE_BINDING_REQUIRED_FIELDS[number];

export interface RuntimeSignalSourceBindingEvidenceInput {
  readonly kind: RuntimeSignalSourceBindingEvidenceKind;
  readonly evidenceRefDigest?: string | null;
  readonly bindingRefDigest?: string | null;
  readonly coveredSignalDigest?: string | null;
}

export interface CreateRuntimeSignalSourceBindingInput {
  readonly envelope: RuntimeSignalEnvelope;
  readonly evidence: readonly RuntimeSignalSourceBindingEvidenceInput[];
}

export interface RuntimeSignalSourceBinding {
  readonly version: typeof RUNTIME_SIGNAL_SOURCE_BINDING_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly envelopeSignalDigest: string;
  readonly sourceSystem: string;
  readonly signalKind: RuntimeSignalEnvelope['signalKind'];
  readonly envelopeSourceTrustLevel: RuntimeSignalSourceTrustLevel;
  readonly bindingClass: RuntimeSignalSourceBindingClass;
  readonly evidenceKinds: readonly RuntimeSignalSourceBindingEvidenceKind[];
  readonly evidenceRefDigests: readonly string[];
  readonly bindingRefDigests: readonly string[];
  readonly coveredSignalDigests: readonly string[];
  readonly classificationReasons: readonly string[];
  readonly digestOnly: true;
  readonly sourceVerifiedForReview: boolean;
  readonly grantsAuthority: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly canonical: string;
  readonly sourceBindingDigest: string;
}

export interface RuntimeSignalSourceBindingDescriptor {
  readonly version: typeof RUNTIME_SIGNAL_SOURCE_BINDING_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly bindingClasses: typeof RUNTIME_SIGNAL_SOURCE_BINDING_CLASSES;
  readonly evidenceKinds: typeof RUNTIME_SIGNAL_SOURCE_BINDING_EVIDENCE_KINDS;
  readonly requiredFields: typeof RUNTIME_SIGNAL_SOURCE_BINDING_REQUIRED_FIELDS;
  readonly trustLevelToBindingClass: Readonly<Record<
    RuntimeSignalSourceTrustLevel,
    RuntimeSignalSourceBindingClass
  >>;
  readonly digestOnly: true;
  readonly signedEvidenceMustCoverEnvelopeDigest: true;
  readonly pepProofRequiresEnforcementProofSignal: true;
  readonly grantsAuthority: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly nonClaims: readonly string[];
}

const TRUST_LEVEL_TO_BINDING_CLASS = Object.freeze({
  declared: 'unverified',
  observed: 'unverified',
  'authenticated-source': 'authenticated',
  'signed-or-bound': 'signed',
  'customer-attested': 'customer-attested',
  'enforcement-proof': 'pep-proof',
} satisfies Readonly<Record<
  RuntimeSignalSourceTrustLevel,
  RuntimeSignalSourceBindingClass
>>);

const SIGNED_EVIDENCE_KINDS = new Set<RuntimeSignalSourceBindingEvidenceKind>([
  'http-message-signature',
  'dpop-proof',
  'mtls-client-certificate',
  'spiffe-svid',
]);

const ALLOWED_EVIDENCE_FIELDS = new Set([
  'kind',
  'evidenceRefDigest',
  'bindingRefDigest',
  'coveredSignalDigest',
]);

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

function normalizeDigest(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`Runtime signal source binding ${fieldName} must be a sha256 digest reference.`);
  }
  return value;
}

function normalizeOptionalDigest(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeEvidenceKind(value: unknown): RuntimeSignalSourceBindingEvidenceKind {
  if (
    typeof value !== 'string' ||
    !RUNTIME_SIGNAL_SOURCE_BINDING_EVIDENCE_KINDS.includes(
      value as RuntimeSignalSourceBindingEvidenceKind,
    )
  ) {
    throw new Error(
      `Runtime signal source binding evidence kind must be one of: ${RUNTIME_SIGNAL_SOURCE_BINDING_EVIDENCE_KINDS.join(', ')}.`,
    );
  }
  return value as RuntimeSignalSourceBindingEvidenceKind;
}

function assertNoUnknownEvidenceFields(
  evidence: RuntimeSignalSourceBindingEvidenceInput,
): void {
  for (const key of Object.keys(evidence)) {
    if (!ALLOWED_EVIDENCE_FIELDS.has(key)) {
      throw new Error(`Runtime signal source binding evidence contains unknown field: ${key}.`);
    }
  }
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function uniqueKinds(
  values: readonly RuntimeSignalSourceBindingEvidenceKind[],
): readonly RuntimeSignalSourceBindingEvidenceKind[] {
  return Object.freeze([...new Set(values)].sort());
}

function bindingClassForEvidenceKinds(
  evidenceKinds: readonly RuntimeSignalSourceBindingEvidenceKind[],
): RuntimeSignalSourceBindingClass {
  if (evidenceKinds.includes('pep-receipt')) return 'pep-proof';
  if (evidenceKinds.includes('customer-attestation')) return 'customer-attested';
  if (evidenceKinds.some((kind) => SIGNED_EVIDENCE_KINDS.has(kind))) return 'signed';
  if (evidenceKinds.includes('transport-auth')) return 'authenticated';
  return 'unverified';
}

function reasonForBindingClass(
  bindingClass: RuntimeSignalSourceBindingClass,
): readonly string[] {
  switch (bindingClass) {
    case 'unverified':
      return Object.freeze(['source-not-authenticated']);
    case 'authenticated':
      return Object.freeze(['transport-or-source-authenticated']);
    case 'signed':
      return Object.freeze(['sender-or-message-bound']);
    case 'customer-attested':
      return Object.freeze(['customer-attested-source']);
    case 'pep-proof':
      return Object.freeze(['customer-gate-proof-source']);
  }
}

function assertEnvelopeBoundary(envelope: RuntimeSignalEnvelope): void {
  if (
    envelope.version !== RUNTIME_SIGNAL_ENVELOPE_VERSION ||
    envelope.grantsAuthority !== false ||
    envelope.canAdmit !== false ||
    envelope.activatesEnforcement !== false ||
    envelope.autoEnforce !== false ||
    envelope.productionReady !== false ||
    envelope.rawPayloadStored !== false
  ) {
    throw new Error('Runtime signal source binding requires a no-authority runtime signal envelope.');
  }
  normalizeDigest(envelope.signalDigest, 'envelope.signalDigest');
}

function assertExpectedClass(
  envelope: RuntimeSignalEnvelope,
  bindingClass: RuntimeSignalSourceBindingClass,
): void {
  const expected = TRUST_LEVEL_TO_BINDING_CLASS[envelope.sourceTrustLevel];
  if (bindingClass !== expected) {
    throw new Error(
      `Runtime signal source binding evidence class ${bindingClass} does not match envelope sourceTrustLevel ${envelope.sourceTrustLevel}.`,
    );
  }
  if (bindingClass === 'pep-proof' && envelope.signalKind !== 'enforcement-proof') {
    throw new Error('Runtime signal source binding PEP proof requires an enforcement-proof signal.');
  }
}

function assertEvidenceBindings(
  envelope: RuntimeSignalEnvelope,
  bindingClass: RuntimeSignalSourceBindingClass,
  evidenceKinds: readonly RuntimeSignalSourceBindingEvidenceKind[],
  coveredSignalDigests: readonly string[],
  evidenceRefDigests: readonly string[],
  bindingRefDigests: readonly string[],
): void {
  if (bindingClass === 'unverified') {
    if (evidenceKinds.some((kind) => kind !== 'none')) {
      throw new Error('Runtime signal source binding unverified class may only carry none evidence.');
    }
    if (
      evidenceRefDigests.length > 0 ||
      bindingRefDigests.length > 0 ||
      coveredSignalDigests.length > 0
    ) {
      throw new Error('Runtime signal source binding none evidence must not carry proof digests.');
    }
    return;
  }

  if (evidenceKinds.includes('none')) {
    throw new Error('Runtime signal source binding none evidence cannot be mixed with verified evidence.');
  }
  if (evidenceRefDigests.length === 0) {
    throw new Error('Runtime signal source binding verified classes require evidenceRefDigest.');
  }
  if (bindingClass === 'signed' || bindingClass === 'pep-proof') {
    if (!coveredSignalDigests.includes(envelope.signalDigest)) {
      throw new Error('Runtime signal source binding signed or PEP proof evidence must cover the envelope signalDigest.');
    }
    if (bindingRefDigests.length === 0) {
      throw new Error('Runtime signal source binding signed or PEP proof evidence requires bindingRefDigest.');
    }
  }
}

export function createRuntimeSignalSourceBinding(
  input: CreateRuntimeSignalSourceBindingInput,
): RuntimeSignalSourceBinding {
  assertEnvelopeBoundary(input.envelope);
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    throw new Error('Runtime signal source binding requires at least one evidence item.');
  }

  const normalizedEvidence = input.evidence.map((item) => {
    assertNoUnknownEvidenceFields(item);
    return Object.freeze({
      kind: normalizeEvidenceKind(item.kind),
      evidenceRefDigest: normalizeOptionalDigest(item.evidenceRefDigest, 'evidenceRefDigest'),
      bindingRefDigest: normalizeOptionalDigest(item.bindingRefDigest, 'bindingRefDigest'),
      coveredSignalDigest: normalizeOptionalDigest(item.coveredSignalDigest, 'coveredSignalDigest'),
    });
  });

  const evidenceKinds = uniqueKinds(normalizedEvidence.map((item) => item.kind));
  const evidenceRefDigests = uniqueStrings(normalizedEvidence.flatMap((item) =>
    item.evidenceRefDigest ? [item.evidenceRefDigest] : []
  ));
  const bindingRefDigests = uniqueStrings(normalizedEvidence.flatMap((item) =>
    item.bindingRefDigest ? [item.bindingRefDigest] : []
  ));
  const coveredSignalDigests = uniqueStrings(normalizedEvidence.flatMap((item) =>
    item.coveredSignalDigest ? [item.coveredSignalDigest] : []
  ));
  const bindingClass = bindingClassForEvidenceKinds(evidenceKinds);

  assertExpectedClass(input.envelope, bindingClass);
  assertEvidenceBindings(
    input.envelope,
    bindingClass,
    evidenceKinds,
    coveredSignalDigests,
    evidenceRefDigests,
    bindingRefDigests,
  );

  const payload = {
    version: RUNTIME_SIGNAL_SOURCE_BINDING_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    envelopeSignalDigest: input.envelope.signalDigest,
    sourceSystem: input.envelope.sourceSystem,
    signalKind: input.envelope.signalKind,
    envelopeSourceTrustLevel: input.envelope.sourceTrustLevel,
    bindingClass,
    evidenceKinds,
    evidenceRefDigests,
    bindingRefDigests,
    coveredSignalDigests,
    classificationReasons: reasonForBindingClass(bindingClass),
    digestOnly: true,
    sourceVerifiedForReview: bindingClass !== 'unverified',
    grantsAuthority: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    sourceBindingDigest: canonical.digest,
  });
}

export function runtimeSignalSourceBindingDescriptor(): RuntimeSignalSourceBindingDescriptor {
  return Object.freeze({
    version: RUNTIME_SIGNAL_SOURCE_BINDING_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    bindingClasses: RUNTIME_SIGNAL_SOURCE_BINDING_CLASSES,
    evidenceKinds: RUNTIME_SIGNAL_SOURCE_BINDING_EVIDENCE_KINDS,
    requiredFields: RUNTIME_SIGNAL_SOURCE_BINDING_REQUIRED_FIELDS,
    trustLevelToBindingClass: TRUST_LEVEL_TO_BINDING_CLASS,
    digestOnly: true,
    signedEvidenceMustCoverEnvelopeDigest: true,
    pepProofRequiresEnforcementProofSignal: true,
    grantsAuthority: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
    nonClaims: Object.freeze([
      'not-source-verification-runtime',
      'not-authority',
      'not-admission',
      'not-enforcement',
      'not-production-ready',
    ]),
  });
}
